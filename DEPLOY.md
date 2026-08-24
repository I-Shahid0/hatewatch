# Deploy: Vercel (web) + Fly.io (API)

HateWatch is a monorepo. The Next.js app runs on Vercel; the Hono/Bun API runs on Fly.

```
Browser → Vercel (apps/web)
              ↓  NEXT_PUBLIC_SERVER_URL
         Fly.io (apps/server) → Postgres (Neon / Fly Postgres)
                              → volume: /app/apps/server/storage
```

---

## 1. Fly.io — API

### Prerequisites

- [flyctl](https://fly.io/docs/hands-on/install-flyctl/) installed and logged in (`fly auth login`)
- A Postgres URL (your existing Neon DB works; or `fly postgres create`)

### First-time setup

From the **repo root**:

```bash
# Create the app (skip if `hatewatch-api` already exists / rename in fly.toml)
fly apps create hatewatch-api

# Persistent disk for uploaded evidence (must match fly.toml mounts + primary_region)
fly volumes create server_storage --region iad --size 3 --app hatewatch-api

# Secrets — use your real production Vercel origin (no trailing slash)
fly secrets set \
  DATABASE_URL="postgresql://..." \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  BETTER_AUTH_URL="https://hatewatch-api.fly.dev" \
  CORS_ORIGIN="https://YOUR_PROJECT.vercel.app" \
  --app hatewatch-api

# Optional AI extraction
fly secrets set AI_GATEWAY_API_KEY="..." AI_GATEWAY_MODEL="..." --app hatewatch-api
```

If the Fly app hostname differs, set `BETTER_AUTH_URL` to `https://<app-name>.fly.dev` (or your custom domain).

### Deploy

```bash
fly deploy
```

Smoke-check: `curl https://hatewatch-api.fly.dev/` → `OK`

### Schema

Against the **same** `DATABASE_URL` you set on Fly:

```bash
bun run db:push
# optional demo data:
bun run db:seed
```

### Volume caveat

Evidence files are stored on the Fly volume. Keep **one** Machine in the volume’s region (`fly scale count 1`). Horizontal scaling needs object storage (S3/R2/Tigris), not more volumes of the same name without care.

---

## 2. Vercel — web

### Project settings

| Setting | Value |
| --- | --- |
| Root Directory | `.` (monorepo root) |
| Install Command | `bun install` |
| Build Command | `bun run build --filter=web` |
| Output Directory | leave default (Next.js) |
| Framework Preset | Next.js |

Enable Bun in the Vercel project if prompted (or set install/build as above).

`apps/web/next.config.ts` enables `output: "standalone"` only when **not** on Vercel (needed for Docker; breaks Vercel’s Next 16.3 adapter otherwise).

### Environment variables

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | `https://hatewatch-api.fly.dev` (no trailing slash) |

Redeploy the web app after the API URL is known. `NEXT_PUBLIC_*` is inlined at **build** time.

### Preview deployments

`CORS_ORIGIN` / Better Auth `trustedOrigins` currently allow a **single** origin. Previews on `*.vercel.app` will fail auth/CORS unless you point them at a fixed production web URL or extend the server to accept multiple origins.

---

## 3. Wire-up checklist

1. Fly health: `GET /` → `OK`
2. Vercel loads with `NEXT_PUBLIC_SERVER_URL` → Fly
3. Sign up / sign in (cookies are `SameSite=None; Secure` for cross-origin)
4. Create an incident and upload a screenshot (hits the volume)
5. If extraction is enabled, confirm `AI_GATEWAY_*` secrets are set

### Local vs production URLs

| Var | Local | Production |
| --- | --- | --- |
| `BETTER_AUTH_URL` | `http://localhost:3000` | `https://hatewatch-api.fly.dev` |
| `CORS_ORIGIN` | `http://localhost:3001` | `https://YOUR_PROJECT.vercel.app` |
| `NEXT_PUBLIC_SERVER_URL` | `http://localhost:3000` | `https://hatewatch-api.fly.dev` |

---

## Useful commands

```bash
fly status
fly logs
fly secrets list
fly volumes list
fly ssh console
```
