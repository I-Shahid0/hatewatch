import {
	auditEvent,
	evidence,
	platformEnum,
	routingAction,
	routingActionKindEnum,
	routingActionStatusEnum,
} from "@hate_evidence_copilot/db";
import { and, eq } from "@hate_evidence_copilot/db/sql";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { statusTransition } from "../routing-status";
import { assertIncidentVisible } from "./visibility";

const createInput = z.object({
	incidentId: z.uuid(),
	/** Omitted when the action covers the whole incident rather than one item. */
	evidenceId: z.uuid().optional(),
	kind: z.enum(routingActionKindEnum.enumValues),
	rationale: z.string().trim().min(1).max(2_000),
	targetPlatform: z.enum(platformEnum.enumValues).optional(),
	platformPolicyReference: z.string().trim().max(500).optional(),
});

const statusInput = z.object({
	routingActionId: z.uuid(),
	status: z.enum(routingActionStatusEnum.enumValues),
	/** Why it moved — kept in the audit trail alongside the before/after. */
	note: z.string().trim().max(2_000).optional(),
});

export const routingRouter = {
	/**
	 * Propose what happens next: preserve, prepare a platform report, share a
	 * community packet, or escalate for urgent human review.
	 *
	 * A routing action is a recorded decision with a rationale, nothing more.
	 * HateWatch never contacts a platform or an authority on anyone's behalf, so
	 * this writes a row and an audit event and stops there.
	 */
	create: protectedProcedure
		.input(createInput)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			await assertIncidentVisible(context.db, userId, input.incidentId);

			/**
			 * An evidence-scoped action must point at evidence in the same incident,
			 * otherwise a visible incident becomes a handle onto someone else's item.
			 */
			if (input.evidenceId) {
				const [item] = await context.db
					.select({ id: evidence.id })
					.from(evidence)
					.where(
						and(
							eq(evidence.id, input.evidenceId),
							eq(evidence.incidentId, input.incidentId),
						),
					)
					.limit(1);

				if (!item) {
					throw new ORPCError("NOT_FOUND", {
						message: "Evidence not found on this incident.",
					});
				}
			}

			return context.db.transaction(async (tx) => {
				const [row] = await tx
					.insert(routingAction)
					.values({
						incidentId: input.incidentId,
						evidenceId: input.evidenceId ?? null,
						kind: input.kind,
						status: "proposed",
						rationale: input.rationale,
						targetPlatform: input.targetPlatform ?? null,
						platformPolicyReference:
							input.platformPolicyReference?.trim() || null,
						createdBy: userId,
					})
					.returning();

				if (!row) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Routing action insert returned no row.",
					});
				}

				await tx.insert(auditEvent).values({
					incidentId: input.incidentId,
					actorKind: "user",
					actorUserId: userId,
					action: "routing_action.proposed",
					entityType: "routing_action",
					entityId: row.id,
					valueAfter: {
						kind: row.kind,
						status: row.status,
						evidenceId: row.evidenceId,
						targetPlatform: row.targetPlatform,
					},
					note: row.rationale,
				});

				return row;
			});
		}),

	/**
	 * Move an action along: proposed → in_progress → completed / declined /
	 * blocked. The transition rule itself lives in `statusTransition`; this
	 * handler is the visibility check, the write, and the audit event.
	 */
	updateStatus: protectedProcedure
		.input(statusInput)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await context.db.query.routingAction.findFirst({
				where: eq(routingAction.id, input.routingActionId),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", {
					message: "Routing action not found.",
				});
			}

			await assertIncidentVisible(context.db, userId, existing.incidentId);

			const note = input.note?.trim() || null;

			return context.db.transaction(async (tx) => {
				const [row] = await tx
					.update(routingAction)
					.set(statusTransition(input.status, existing.assignedTo, userId))
					.where(eq(routingAction.id, existing.id))
					.returning();

				if (!row) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Routing action update returned no row.",
					});
				}

				await tx.insert(auditEvent).values({
					incidentId: existing.incidentId,
					actorKind: "user",
					actorUserId: userId,
					action: "routing_action.status_changed",
					entityType: "routing_action",
					entityId: existing.id,
					valueBefore: { status: existing.status },
					valueAfter: { status: row.status },
					note,
				});

				return row;
			});
		}),
};
