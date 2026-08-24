import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { classificationRouter } from "./classification";
import { evidenceRouter } from "./evidence";
import { incidentRouter } from "./incident";
import { patternRouter } from "./pattern";
import { routingRouter } from "./routing";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	incident: incidentRouter,
	evidence: evidenceRouter,
	classification: classificationRouter,
	pattern: patternRouter,
	routing: routingRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
