import { db } from "@hate_evidence_copilot/db";
import * as schema from "@hate_evidence_copilot/db/schema/auth";
import { env } from "@hate_evidence_copilot/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/**
 * Web (Vercel) and API (Fly) on sibling hosts under one parent domain are
 * same-site — cookies can be Lax. Distinct sites (localhost ports, or
 * `*.fly.dev` vs `*.ishahid.pro`) need SameSite=None + Secure, which Safari
 * still often blocks as third-party. Prefer AUTH_COOKIE_DOMAIN in production.
 * @see https://better-auth.com/docs/concepts/cookies#safari-itp-and-cross-domain-setups
 */
const sharedParentDomain = env.AUTH_COOKIE_DOMAIN;

export function createAuth() {
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",

			schema: schema,
		}),
		trustedOrigins: [env.CORS_ORIGIN],
		emailAndPassword: {
			enabled: true,
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: {
			...(sharedParentDomain
				? {
						crossSubDomainCookies: {
							enabled: true,
							domain: sharedParentDomain,
						},
						defaultCookieAttributes: {
							sameSite: "lax",
							secure: true,
							httpOnly: true,
						},
					}
				: {
						defaultCookieAttributes: {
							sameSite: "none",
							secure: true,
							httpOnly: true,
						},
					}),
		},
		plugins: [],
	});
}

export const auth = createAuth();
