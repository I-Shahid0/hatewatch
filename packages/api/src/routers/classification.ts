import {
	auditEvent,
	classification,
	classificationCategoryEnum,
	evidence,
} from "@hate_evidence_copilot/db";
import { eq } from "@hate_evidence_copilot/db/sql";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { assertIncidentVisible } from "./visibility";

/**
 * Categories describe content and visible behaviour — never the person behind
 * an account. The enum already enforces that; these procedures keep it so by
 * accepting no people-level fields at all.
 */

const classificationBody = {
	category: z.enum(classificationCategoryEnum.enumValues),
	claim: z.string().trim().min(1).max(2_000),
	rationale: z.string().trim().min(1).max(4_000),
	/** The exact words relied on; the span is located in the verified text. */
	supportingQuote: z.string().trim().max(2_000).optional(),
};

const createInput = z.object({
	evidenceId: z.uuid(),
	...classificationBody,
});

const reviewInput = z
	.object({
		classificationId: z.uuid(),
		decision: z.enum([
			"confirmed",
			"changed",
			"marked_insufficient_context",
			"marked_not_relevant",
		]),
		note: z.string().trim().max(2_000).optional(),
		/** Required when the decision is `changed` — the reviewer writes the replacement. */
		replacement: z.object(classificationBody).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.decision === "changed" && !value.replacement) {
			ctx.addIssue({
				code: "custom",
				message:
					"Changing a classification requires the replacement category, claim, and rationale.",
				path: ["replacement"],
			});
		}
	});

/** Locates the quote inside the verified text, or records no span. */
function quoteSpan(contentText: string | null, quote: string | undefined) {
	const start = contentText && quote ? contentText.indexOf(quote) : -1;
	return start >= 0 && quote
		? { quoteStart: start, quoteEnd: start + quote.length }
		: { quoteStart: null, quoteEnd: null };
}

export const classificationRouter = {
	/**
	 * A human-authored category. The advocate is the reviewer, so the row is
	 * born `confirmed` and flows straight into the packet — claim, rationale,
	 * and an optional quote are required up front so it can defend itself.
	 */
	create: protectedProcedure
		.input(createInput)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const item = await context.db.query.evidence.findFirst({
				where: eq(evidence.id, input.evidenceId),
				columns: { id: true, incidentId: true, contentText: true },
			});

			if (!item) {
				throw new ORPCError("NOT_FOUND", { message: "Evidence not found." });
			}

			await assertIncidentVisible(context.db, userId, item.incidentId);

			const quote = input.supportingQuote?.trim() || undefined;

			const created = await context.db.transaction(async (tx) => {
				const [row] = await tx
					.insert(classification)
					.values({
						evidenceId: item.id,
						category: input.category,
						authorKind: "human",
						claim: input.claim,
						rationale: input.rationale,
						supportingQuote: quote ?? null,
						...quoteSpan(item.contentText, quote),
						confidence: "unavailable",
						reviewStatus: "confirmed",
						reviewedBy: userId,
						reviewedAt: new Date(),
					})
					.returning();

				if (!row) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Classification insert returned no row.",
					});
				}

				await tx.insert(auditEvent).values({
					incidentId: item.incidentId,
					actorKind: "user",
					actorUserId: userId,
					action: "classification.created",
					entityType: "classification",
					entityId: row.id,
					valueAfter: {
						evidenceId: item.id,
						category: row.category,
						claim: row.claim,
						reviewStatus: row.reviewStatus,
					},
				});

				return row;
			});

			return created;
		}),

	/**
	 * Reviewer decision on one classification. `confirmed`, `insufficient`, and
	 * `not relevant` update the row in place; `changed` keeps the original row
	 * (marked `changed`) and writes the reviewer's replacement with
	 * `supersedesId` pointing back, so the disagreement stays visible.
	 */
	review: protectedProcedure
		.input(reviewInput)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await context.db.query.classification.findFirst({
				where: eq(classification.id, input.classificationId),
				with: {
					evidence: {
						columns: { id: true, incidentId: true, contentText: true },
					},
				},
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", {
					message: "Classification not found.",
				});
			}

			await assertIncidentVisible(
				context.db,
				userId,
				existing.evidence.incidentId,
			);

			const note = input.note?.trim() || null;
			const now = new Date();

			const result = await context.db.transaction(async (tx) => {
				const [updated] = await tx
					.update(classification)
					.set({
						reviewStatus: input.decision,
						reviewerNote: note,
						reviewedBy: userId,
						reviewedAt: now,
					})
					.where(eq(classification.id, existing.id))
					.returning();

				if (!updated) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Classification update returned no row.",
					});
				}

				let replacementRow: typeof updated | null = null;

				if (input.decision === "changed" && input.replacement) {
					const quote = input.replacement.supportingQuote?.trim() || undefined;

					const [inserted] = await tx
						.insert(classification)
						.values({
							evidenceId: existing.evidenceId,
							category: input.replacement.category,
							authorKind: "human",
							claim: input.replacement.claim,
							rationale: input.replacement.rationale,
							supportingQuote: quote ?? null,
							...quoteSpan(existing.evidence.contentText, quote),
							confidence: "unavailable",
							reviewStatus: "confirmed",
							reviewerNote: note,
							reviewedBy: userId,
							reviewedAt: now,
							supersedesId: existing.id,
						})
						.returning();

					if (!inserted) {
						throw new ORPCError("INTERNAL_SERVER_ERROR", {
							message: "Replacement classification insert returned no row.",
						});
					}

					replacementRow = inserted;

					await tx.insert(auditEvent).values({
						incidentId: existing.evidence.incidentId,
						actorKind: "user",
						actorUserId: userId,
						action: "classification.created",
						entityType: "classification",
						entityId: inserted.id,
						valueAfter: {
							evidenceId: existing.evidenceId,
							category: inserted.category,
							claim: inserted.claim,
							reviewStatus: inserted.reviewStatus,
							supersedesId: existing.id,
						},
					});
				}

				await tx.insert(auditEvent).values({
					incidentId: existing.evidence.incidentId,
					actorKind: "user",
					actorUserId: userId,
					action: "classification.reviewed",
					entityType: "classification",
					entityId: existing.id,
					valueBefore: { reviewStatus: existing.reviewStatus },
					valueAfter: {
						reviewStatus: input.decision,
						replacedById: replacementRow?.id ?? null,
					},
					note,
				});

				return { classification: updated, replacement: replacementRow };
			});

			return result;
		}),
};
