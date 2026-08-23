import { evidence, incident } from "@hate_evidence_copilot/db";
import {
	and,
	asc,
	count,
	countDistinct,
	desc,
	eq,
	sql,
} from "@hate_evidence_copilot/db/sql";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { visibleIncidents } from "./visibility";

const listInput = z.object({
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
});

const byId = z.object({ id: z.uuid() });

export const incidentRouter = {
	/**
	 * Dashboard rows. Counts are aggregated in SQL rather than by loading the
	 * evidence, because the dashboard only needs the totals.
	 */
	list: protectedProcedure
		.input(listInput)
		.handler(async ({ context, input }) => {
			return context.db
				.select({
					id: incident.id,
					referenceCode: incident.referenceCode,
					title: incident.title,
					status: incident.status,
					priority: incident.priority,
					safetyReviewStatus: incident.safetyReviewStatus,
					contextIntegrityScore: incident.contextIntegrityScore,
					windowStartAt: incident.windowStartAt,
					windowEndAt: incident.windowEndAt,
					isDemo: incident.isDemo,
					updatedAt: incident.updatedAt,
					evidenceCount: count(evidence.id),
					/** Includes `unknown` as a platform, which is itself worth surfacing. */
					platformCount: countDistinct(evidence.platform),
					priorityReviewCount: count(
						sql`case when ${evidence.needsPriorityReview} then 1 end`,
					),
				})
				.from(incident)
				.leftJoin(evidence, eq(evidence.incidentId, incident.id))
				.where(visibleIncidents(context.session.user.id))
				.groupBy(incident.id)
				.orderBy(desc(incident.updatedAt))
				.limit(input.limit)
				.offset(input.offset);
		}),

	/**
	 * Everything the incident, timeline, and packet screens need in one read.
	 * Evidence comes back in citation order (Evidence 01, 02, …) with its
	 * Context Integrity checklist attached, so the score can always be expanded.
	 */
	get: protectedProcedure.input(byId).handler(async ({ context, input }) => {
		const row = await context.db.query.incident.findFirst({
			where: and(
				eq(incident.id, input.id),
				visibleIncidents(context.session.user.id),
			),
			with: {
				createdByUser: { columns: { id: true, name: true, email: true } },
				evidence: {
					orderBy: [asc(evidence.sequenceNumber)],
					with: {
						assets: true,
						contextChecks: true,
						classifications: true,
					},
				},
				patterns: { with: { evidenceLinks: true } },
				routingActions: true,
				packets: true,
			},
		});

		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Incident not found." });
		}

		return row;
	}),

	/**
	 * The known gaps section of a packet: every context element that is missing
	 * or unresolved, grouped so an advocate can see what to chase.
	 */
	gaps: protectedProcedure.input(byId).handler(async ({ context, input }) => {
		const [visible] = await context.db
			.select({ id: incident.id })
			.from(incident)
			.where(
				and(
					eq(incident.id, input.id),
					visibleIncidents(context.session.user.id),
				),
			)
			.limit(1);

		if (!visible) {
			throw new ORPCError("NOT_FOUND", { message: "Incident not found." });
		}

		return context.db.query.evidence.findMany({
			where: eq(evidence.incidentId, input.id),
			orderBy: [asc(evidence.sequenceNumber)],
			columns: {
				id: true,
				sequenceNumber: true,
				platform: true,
				contextIntegrityScore: true,
			},
			with: {
				/**
				 * `not_applicable` is excluded: a direct message with no parent post
				 * is complete, not incomplete.
				 */
				contextChecks: {
					where: (check, { inArray }) =>
						inArray(check.status, ["missing", "unknown"]),
				},
			},
		});
	}),
};
