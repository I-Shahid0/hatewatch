import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { primaryId, timestamps } from "./columns";
import {
	incidentPriorityEnum,
	incidentStatusEnum,
	platformEnum,
	reportingContextEnum,
	safetyReviewStatusEnum,
	targetTypeEnum,
} from "./enums";

/**
 * The unit of work: one documented episode of harassment, owned by the advocate
 * who created it.
 */
export const incident = pgTable(
	"incident",
	{
		id: primaryId(),

		/**
		 * `sequenceNumber` is database-assigned so the human-facing reference code
		 * (`HW-2026-0142`) can be derived deterministically instead of guessed from
		 * a row count.
		 */
		sequenceNumber: serial("sequence_number").notNull(),
		referenceCode: text("reference_code").notNull(),

		title: text("title").notNull(),
		/** The advocate's own account of the situation, before any AI involvement. */
		situationSummary: text("situation_summary"),

		status: incidentStatusEnum("status").default("draft").notNull(),
		priority: incidentPriorityEnum("priority").default("standard").notNull(),

		safetyReviewStatus: safetyReviewStatusEnum("safety_review_status")
			.default("not_flagged")
			.notNull(),
		safetyReviewNote: text("safety_review_note"),

		targetType: targetTypeEnum("target_type").default("unknown").notNull(),
		targetDescription: text("target_description"),
		reportingContext: reportingContextEnum("reporting_context")
			.default("supporting_someone_else")
			.notNull(),

		/**
		 * Platforms declared at intake. Evidence rows carry the authoritative
		 * per-item platform; this captures what the advocate expected to find.
		 */
		declaredPlatforms: platformEnum("declared_platforms")
			.array()
			.default(sql`'{}'`)
			.notNull(),

		/** Cached incident window, recomputed from verified evidence timestamps. */
		windowStartAt: timestamp("window_start_at", { withTimezone: true }),
		windowEndAt: timestamp("window_end_at", { withTimezone: true }),

		/** Weighted roll-up of per-evidence Context Integrity, 0-100. */
		contextIntegrityScore: integer("context_integrity_score"),
		contextIntegrityComputedAt: timestamp("context_integrity_computed_at", {
			withTimezone: true,
		}),

		/**
		 * The packet narrative is split in two: an AI draft that is never exported
		 * on its own, and the text a human approved.
		 */
		summaryDraft: text("summary_draft"),
		summaryApproved: text("summary_approved"),
		summaryApprovedBy: text("summary_approved_by").references(() => user.id, {
			onDelete: "set null",
		}),
		summaryApprovedAt: timestamp("summary_approved_at", { withTimezone: true }),

		/** Demo mode: every attached artifact is synthetic or already redacted. */
		isDemo: boolean("is_demo").default(false).notNull(),

		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		organizationName: text("organization_name"),

		closedAt: timestamp("closed_at", { withTimezone: true }),
		...timestamps(),
	},
	(table) => [
		uniqueIndex("incident_reference_code_idx").on(table.referenceCode),
		uniqueIndex("incident_sequence_number_idx").on(table.sequenceNumber),
		index("incident_created_by_idx").on(table.createdBy),
		index("incident_status_idx").on(table.status, table.updatedAt),
		index("incident_safety_review_status_idx").on(table.safetyReviewStatus),
		check(
			"incident_context_integrity_score_range",
			sql`${table.contextIntegrityScore} is null or (${table.contextIntegrityScore} between 0 and 100)`,
		),
		check(
			"incident_window_order",
			sql`${table.windowStartAt} is null or ${table.windowEndAt} is null or ${table.windowStartAt} <= ${table.windowEndAt}`,
		),
	],
);

export type Incident = typeof incident.$inferSelect;
export type NewIncident = typeof incident.$inferInsert;
