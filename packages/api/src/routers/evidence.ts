import { type Db, evidence, incident } from "@hate_evidence_copilot/db";
import { and, asc, eq, sql } from "@hate_evidence_copilot/db/sql";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { visibleIncidents } from "./visibility";

const listInput = z.object({
	incidentId: z.uuid(),
	/**
	 * `timeline` reconstructs chronology across platforms; `capture` keeps the
	 * order items were added, which is how they are cited in a packet.
	 */
	order: z.enum(["timeline", "capture"]).default("timeline"),
});

/** Throws unless the signed-in advocate may read this incident. */
async function assertIncidentVisible(
	db: Db,
	userId: string,
	incidentId: string,
) {
	const [row] = await db
		.select({ id: incident.id })
		.from(incident)
		.where(and(eq(incident.id, incidentId), visibleIncidents(userId)))
		.limit(1);

	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Incident not found." });
	}
}

export const evidenceRouter = {
	list: protectedProcedure
		.input(listInput)
		.handler(async ({ context, input }) => {
			await assertIncidentVisible(
				context.db,
				context.session.user.id,
				input.incidentId,
			);

			/**
			 * Items with no established time sort last rather than first: an unknown
			 * timestamp should not silently open the chronology.
			 */
			const ordering =
				input.order === "timeline"
					? [
							sql`${evidence.occurredAt} asc nulls last`,
							asc(evidence.sequenceNumber),
						]
					: [asc(evidence.sequenceNumber)];

			return context.db.query.evidence.findMany({
				where: eq(evidence.incidentId, input.incidentId),
				orderBy: ordering,
				with: {
					assets: true,
					contextChecks: true,
					classifications: true,
				},
			});
		}),

	/**
	 * One item with everything the verification screen compares: the artifact,
	 * the current extraction, the review history, and the redaction record.
	 */
	get: protectedProcedure
		.input(z.object({ id: z.uuid() }))
		.handler(async ({ context, input }) => {
			const row = await context.db.query.evidence.findFirst({
				where: eq(evidence.id, input.id),
				with: {
					incident: { columns: { id: true, referenceCode: true, title: true } },
					assets: true,
					contextChecks: true,
					classifications: true,
					fieldReviews: true,
					redactions: true,
					extractions: {
						where: (extraction, { eq: equals }) =>
							equals(extraction.isCurrent, true),
					},
					parent: {
						columns: { id: true, sequenceNumber: true, contentText: true },
					},
				},
			});

			if (!row) {
				throw new ORPCError("NOT_FOUND", { message: "Evidence not found." });
			}

			await assertIncidentVisible(
				context.db,
				context.session.user.id,
				row.incidentId,
			);

			return row;
		}),
};
