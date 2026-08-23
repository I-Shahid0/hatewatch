import { auditEvent, pattern } from "@hate_evidence_copilot/db";
import { eq } from "@hate_evidence_copilot/db/sql";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { assertIncidentVisible } from "./visibility";

const reviewInput = z.object({
	patternId: z.uuid(),
	decision: z.enum(["confirmed", "rejected", "marked_insufficient_context"]),
	/** Why the reviewer landed here — exported with the finding. */
	note: z.string().trim().max(2_000).optional(),
});

export const patternRouter = {
	/**
	 * Human decision on a suggested pattern. Patterns describe relationships
	 * between evidence, so the review is a judgement on the rows as written —
	 * confirm, reject, or record that the context is insufficient. The reviewer
	 * and their note are stamped on the row and into the audit trail.
	 */
	review: protectedProcedure
		.input(reviewInput)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await context.db.query.pattern.findFirst({
				where: eq(pattern.id, input.patternId),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Pattern not found." });
			}

			await assertIncidentVisible(context.db, userId, existing.incidentId);

			const note = input.note?.trim() || null;

			const updated = await context.db.transaction(async (tx) => {
				const [row] = await tx
					.update(pattern)
					.set({
						status: input.decision,
						reviewerNote: note,
						reviewedBy: userId,
						reviewedAt: new Date(),
					})
					.where(eq(pattern.id, existing.id))
					.returning();

				if (!row) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Pattern update returned no row.",
					});
				}

				await tx.insert(auditEvent).values({
					incidentId: existing.incidentId,
					actorKind: "user",
					actorUserId: userId,
					action: "pattern.reviewed",
					entityType: "pattern",
					entityId: existing.id,
					valueBefore: { status: existing.status },
					valueAfter: { status: input.decision },
					note,
				});

				return row;
			});

			return updated;
		}),
};
