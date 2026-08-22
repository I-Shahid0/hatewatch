import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

import { aiRun } from "./ai";
import { user } from "./auth";
import { primaryId, timestamps } from "./columns";
import {
	authorKindEnum,
	classificationCategoryEnum,
	classificationReviewStatusEnum,
	confidenceLevelEnum,
	patternKindEnum,
	patternStatusEnum,
} from "./enums";
import { evidence } from "./evidence";
import { incident } from "./incident";

/**
 * A suggested or human-recorded category for one piece of content.
 *
 * Every row must be able to answer claim → supporting evidence → reason, which
 * is why `claim` and `rationale` are required and the quote span points back into
 * the verified `evidence.contentText`.
 */
export const classification = pgTable(
	"classification",
	{
		id: primaryId(),
		evidenceId: uuid("evidence_id")
			.notNull()
			.references(() => evidence.id, { onDelete: "cascade" }),

		category: classificationCategoryEnum("category").notNull(),
		authorKind: authorKindEnum("author_kind").notNull(),
		aiRunId: uuid("ai_run_id").references(() => aiRun.id, {
			onDelete: "set null",
		}),

		claim: text("claim").notNull(),
		rationale: text("rationale").notNull(),
		/** The exact words relied on, plus where they sit in the verified text. */
		supportingQuote: text("supporting_quote"),
		quoteStart: integer("quote_start"),
		quoteEnd: integer("quote_end"),

		confidence: confidenceLevelEnum("confidence")
			.default("unavailable")
			.notNull(),

		reviewStatus: classificationReviewStatusEnum("review_status")
			.default("pending_review")
			.notNull(),
		reviewerNote: text("reviewer_note"),
		reviewedBy: text("reviewed_by").references(() => user.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

		/**
		 * When a reviewer changes a category, the original row is kept and the
		 * replacement points at it, so the disagreement stays visible.
		 */
		supersedesId: uuid("supersedes_id").references(
			(): AnyPgColumn => classification.id,
			{ onDelete: "set null" },
		),

		...timestamps(),
	},
	(table) => [
		index("classification_evidence_id_idx").on(table.evidenceId),
		index("classification_category_idx").on(table.category),
		index("classification_review_status_idx").on(table.reviewStatus),
		index("classification_supersedes_id_idx").on(table.supersedesId),
		check(
			"classification_quote_span_order",
			sql`${table.quoteStart} is null or ${table.quoteEnd} is null or ${table.quoteStart} <= ${table.quoteEnd}`,
		),
		check(
			"classification_ai_rows_have_a_run",
			sql`${table.authorKind} <> 'ai' or ${table.aiRunId} is not null`,
		),
	],
);

/**
 * A relationship observed *between* evidence items — repetition, escalation,
 * spread across platforms, possible coordination indicators.
 *
 * A pattern is scoped to an incident and is meaningless without its supporting
 * evidence, which lives in `pattern_evidence`.
 */
export const pattern = pgTable(
	"pattern",
	{
		id: primaryId(),
		incidentId: uuid("incident_id")
			.notNull()
			.references(() => incident.id, { onDelete: "cascade" }),

		kind: patternKindEnum("kind").notNull(),
		name: text("name").notNull(),
		description: text("description").notNull(),

		authorKind: authorKindEnum("author_kind").notNull(),
		aiRunId: uuid("ai_run_id").references(() => aiRun.id, {
			onDelete: "set null",
		}),
		confidence: confidenceLevelEnum("confidence")
			.default("unavailable")
			.notNull(),

		status: patternStatusEnum("status").default("suggested").notNull(),
		reviewerNote: text("reviewer_note"),
		reviewedBy: text("reviewed_by").references(() => user.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

		/** Window the pattern spans, derived from its supporting evidence. */
		firstObservedAt: timestamp("first_observed_at", { withTimezone: true }),
		lastObservedAt: timestamp("last_observed_at", { withTimezone: true }),

		...timestamps(),
	},
	(table) => [
		index("pattern_incident_id_idx").on(table.incidentId),
		index("pattern_status_idx").on(table.incidentId, table.status),
		check(
			"pattern_ai_rows_have_a_run",
			sql`${table.authorKind} <> 'ai' or ${table.aiRunId} is not null`,
		),
	],
);

/**
 * Which evidence supports a pattern. A join table rather than an id array so a
 * finding can be traced from either direction and annotated per link.
 */
export const patternEvidence = pgTable(
	"pattern_evidence",
	{
		patternId: uuid("pattern_id")
			.notNull()
			.references(() => pattern.id, { onDelete: "cascade" }),
		evidenceId: uuid("evidence_id")
			.notNull()
			.references(() => evidence.id, { onDelete: "cascade" }),

		/** Why this item was pulled in — the same phrase, the same handle, the escalation step. */
		note: text("note"),
		addedBy: text("added_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamps().createdAt,
	},
	(table) => [
		primaryKey({ columns: [table.patternId, table.evidenceId] }),
		index("pattern_evidence_evidence_id_idx").on(table.evidenceId),
	],
);

export type Classification = typeof classification.$inferSelect;
export type NewClassification = typeof classification.$inferInsert;
export type Pattern = typeof pattern.$inferSelect;
export type NewPattern = typeof pattern.$inferInsert;
export type PatternEvidence = typeof patternEvidence.$inferSelect;
export type NewPatternEvidence = typeof patternEvidence.$inferInsert;
