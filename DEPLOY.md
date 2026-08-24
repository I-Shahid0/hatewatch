# Deploy: Vercel (web) + Fly.io (API)

HateWatch is a monorepo. The Next.js app runs on Vercel; the Hono/Bun API runs on Fly.

```
Browser → Vercel (apps/web)  https://gnci-hackathon.ishahid.pro
              ↓  NEXT_PUBLIC_SERVER_URL
         Fly.io (apps/server) https://hatewatch-api.ishahid.pro
                              → Postgres (Neon / Fly Postgres)
                              → volume: /app/apps/server/storage
```

Auth needs both hosts under the **same parent domain** (`ishahid.pro`) so
cookies are first-party. Do **not** leave the API on `*.fly.dev` for production
logins — Safari/Chrome treat that as third-party and drop the session.

---

## 0. Shared parent domain (required for auth)

Goal:

| Role | Hostname |
| --- | --- |
| Web | `gnci-hackathon.ishahid.pro` (already on Vercel) |
| API | `hatewatch-api.ishahid.pro` → Fly app `hatewatch-api` |
| Cookie domain | `ishahid.pro` (`AUTH_COOKIE_DOMAIN`) |

### A. Attach the hostname on Fly

```powershell
fly certs add hatewatch-api.ishahid.pro --app hatewatch-api
fly certs setup hatewatch-api.ishahid.pro --app hatewatch-api
```

Follow the printed DNS instructions. Typical subdomain setup:

1. **CNAME** `hatewatch-api` → `hatewatch-api.fly.dev`  
   (or A/AAAA to the IPs from `fly ips list --app hatewatch-api` if you prefer)
2. Whatever ownership/ACME records Fly shows (`_acme-challenge` and/or `_fly-ownership`)

Wait until issued:

```powershell
fly certs check hatewatch-api.ishahid.pro --app hatewatch-api
```

Smoke: `curl https://hatewatch-api.ishahid.pro/` → `OK`

### B. Point secrets at the custom hosts

```powershell
fly secrets set `
  BETTER_AUTH_URL="https://hatewatch-api.ishahid.pro" `
  CORS_ORIGIN="https://gnci-hackathon.ishahid.pro" `
  AUTH_COOKIE_DOMAIN="ishahid.pro" `
  --app hatewatch-api
```

Redeploy after secrets change if Machines were already running (`fly deploy` or they restart automatically for secrets).

### C. Point Vercel at the API hostname

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | `https://hatewatch-api.ishahid.pro` |

Redeploy the web app (build-time env).

### D. Verify auth

1. Open the web app in a private window  
2. Sign up / sign in  
3. DevTools → Application → Cookies: session cookie `Domain=.ishahid.pro`, `SameSite=Lax`  
4. Reload — you should stay signed in (including Safari)

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
```

**Secrets (bash / macOS / Linux)** — use the shared-parent hosts from §0:

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  BETTER_AUTH_URL="https://hatewatch-api.ishahid.pro" \
  CORS_ORIGIN="https://gnci-hackathon.ishahid.pro" \
  AUTH_COOKIE_DOMAIN="ishahid.pro" \
  --app hatewatch-api
```

**Secrets (PowerShell)** — no `\` line breaks; generate the secret first:

```powershell
$secret = -join ((48..57 + 65..90 + 97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
fly secrets set `
  DATABASE_URL="postgresql://..." `
  BETTER_AUTH_SECRET="$secret" `
  BETTER_AUTH_URL="https://hatewatch-api.ishahid.pro" `
  CORS_ORIGIN="https://gnci-hackathon.ishahid.pro" `
  AUTH_COOKIE_DOMAIN="ishahid.pro" `
  --app hatewatch-api
```

Optional AI extraction:

```bash
fly secrets set AI_GATEWAY_API_KEY="..." AI_GATEWAY_MODEL="..." --app hatewatch-api
```

If you have not finished [§0 Shared parent domain](#0-shared-parent-domain-required-for-auth), auth will keep failing in Safari even when CORS looks correct.

### Deploy

```bash
fly deploy
```

Smoke-check: `curl https://hatewatch-api.ishahid.pro/` → `OK` (or `*.fly.dev` before the custom domain is live)

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
| `NEXT_PUBLIC_SERVER_URL` | `https://hatewatch-api.ishahid.pro` (no trailing slash) |

Redeploy the web app after the API URL is known. `NEXT_PUBLIC_*` is inlined at **build** time.

### Preview deployments

`CORS_ORIGIN` / Better Auth `trustedOrigins` currently allow a **single** origin. Previews on `*.vercel.app` will fail auth/CORS unless you point them at a fixed production web URL or extend the server to accept multiple origins.

---

## 3. Wire-up checklist

1. Fly health on the **custom** host: `GET https://hatewatch-api.ishahid.pro/` → `OK`
2. Vercel `NEXT_PUBLIC_SERVER_URL` → that same host
3. Fly secrets: `AUTH_COOKIE_DOMAIN=ishahid.pro`, matching `CORS_ORIGIN` / `BETTER_AUTH_URL`
4. Sign up / sign in — cookie `Domain=.ishahid.pro`, stay logged in after refresh (test Safari)
5. Create an incident and upload a screenshot (hits the volume)
6. If extraction is enabled, confirm `AI_GATEWAY_*` secrets are set

### Local vs production URLs

| Var | Local | Production |
| --- | --- | --- |
| `BETTER_AUTH_URL` | `http://localhost:3000` | `https://hatewatch-api.ishahid.pro` |
| `CORS_ORIGIN` | `http://localhost:3001` | `https://gnci-hackathon.ishahid.pro` |
| `AUTH_COOKIE_DOMAIN` | *(unset)* | `ishahid.pro` |
| `NEXT_PUBLIC_SERVER_URL` | `http://localhost:3000` | `https://hatewatch-api.ishahid.pro` |

---

## Useful commands

```bash
fly status
fly logs
fly secrets list
fly volumes list
fly ssh console
```
