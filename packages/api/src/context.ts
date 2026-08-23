import { auth } from "@hate_evidence_copilot/auth";
import { db } from "@hate_evidence_copilot/db";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		db,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
