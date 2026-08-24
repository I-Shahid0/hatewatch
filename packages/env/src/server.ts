import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),

		/**
		 * Vercel AI Gateway. Optional on purpose: without it extraction is
		 * unavailable and the app falls back to manual verification, which is the
		 * only path that ever writes verified values anyway.
		 */
		AI_GATEWAY_API_KEY: z.string().min(1).optional(),
		/** Overrides the default model in `@hate_evidence_copilot/api/extraction`. */
		AI_GATEWAY_MODEL: z.string().min(1).optional(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
