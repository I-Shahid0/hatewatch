import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { primaryId, timestamps } from "./columns";
import {
	captureMethodEnum,
	contentSurfaceEnum,
	evidenceAssetRoleEnum,
	evidenceFieldEnum,
	evidenceKindEnum,
	platformEnum,
	reviewDecisionEnum,
	timePrecisionEnum,
	verificationStatusEnum,
} from "./enums";
import { incident } from "./incident";

/**
 * One piece of evidence, holding **verified** values only.
 *
 * Raw model output lives in `evidence_extraction`; these columns are what a
 * human confirmed, edited, or explicitly left unknown. Exports read from here,
 * never from an extraction row, which is what keeps the packet defensible.
 */
export const evidence = pgTable(
	"evidence",
	{
		id: primaryId(),
		incidentId: uuid("incident_id")
			.notNull()
			.references(() => incident.id, { onDelete: "cascade" }),

		/** Stable per-incident label ("Evidence 03") used to cite evidence in packets. */
		sequenceNumber: integer("sequence_number").notNull(),

		kind: evidenceKindEnum("kind").notNull(),
		verificationStatus: verificationStatusEnum("verification_status")
			.default("uploaded")
			.notNull(),

		platform: platformEnum("platform").default("unknown").notNull(),
		contentSurface: contentSurfaceEnum("content_surface")
			.default("unknown")
			.notNull(),
		sourceUrl: text("source_url"),

		/**
		 * Identifiers exactly as they appeared in the artifact. HateWatch does not
		 * resolve these to real-world identity, so no account table joins here.
		 */
		displayedAccountHandle: text("displayed_account_handle"),
		displayedAccountDisplayName: text("displayed_account_display_name"),

		contentText: text("content_text"),
		contentLanguage: text("content_language"),

		/** When the content was posted, plus how precisely that is actually known. */
		occurredAt: timestamp("occurred_at", { withTimezone: true }),
		occurredAtTimezone: text("occurred_at_timezone"),
		occurredAtPrecision: timePrecisionEnum("occurred_at_precision")
			.default("unknown")
			.notNull(),

		/** Capture provenance. */
		capturedAt: timestamp("captured_at", { withTimezone: true }),
		captureMethod: captureMethodEnum("capture_method")
			.default("unknown")
			.notNull(),
		captureNote: text("capture_note"),

		/** Thread context: the post being replied to, quoted, or reacted to. */
		parentEvidenceId: uuid("parent_evidence_id").references(
			(): AnyPgColumn => evidence.id,
			{ onDelete: "set null" },
		),
		parentContextUrl: text("parent_context_url"),
		parentContextSummary: text("parent_context_summary"),

		/** Who or what this item was aimed at, as documented by the advocate. */
		targetContext: text("target_context"),
		advocateNote: text("advocate_note"),

		/** Routes the item into the Priority Review queue without scoring it. */
		needsPriorityReview: boolean("needs_priority_review")
			.default(false)
			.notNull(),
		priorityReviewReason: text("priority_review_reason"),

		contextIntegrityScore: integer("context_integrity_score"),
		contextIntegrityComputedAt: timestamp("context_integrity_computed_at", {
			withTimezone: true,
		}),

		/** Set when `verificationStatus` is `excluded` (duplicate, off-topic, unusable). */
		exclusionReason: text("exclusion_reason"),

		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		...timestamps(),
	},
	(table) => [
		uniqueIndex("evidence_incident_sequence_idx").on(
			table.incidentId,
			table.sequenceNumber,
		),
		index("evidence_incident_id_idx").on(table.incidentId),
		index("evidence_timeline_idx").on(table.incidentId, table.occurredAt),
		index("evidence_platform_idx").on(table.incidentId, table.platform),
		index("evidence_verification_status_idx").on(table.verificationStatus),
		index("evidence_parent_evidence_id_idx").on(table.parentEvidenceId),
		/** Grouping repeated handles is how recurring-account patterns are found. */
		index("evidence_displayed_account_idx").on(
			table.incidentId,
			table.platform,
			table.displayedAccountHandle,
		),
		check(
			"evidence_context_integrity_score_range",
			sql`${table.contextIntegrityScore} is null or (${table.contextIntegrityScore} between 0 and 100)`,
		),
		check(
			"evidence_parent_is_not_self",
			sql`${table.parentEvidenceId} is null or ${table.parentEvidenceId} <> ${table.id}`,
		),
	],
);

/**
 * Files backing a piece of evidence. Split from `evidence` so an item can hold
 * an original alongside its redacted counterpart, and so exports can be built
 * from redacted assets only.
 */
export const evidenceAsset = pgTable(
	"evidence_asset",
	{
		id: primaryId(),
		evidenceId: uuid("evidence_id")
			.notNull()
			.references(() => evidence.id, { onDelete: "cascade" }),

		role: evidenceAssetRoleEnum("role").default("original").notNull(),
		storageKey: text("storage_key").notNull(),
		fileName: text("file_name"),
		mimeType: text("mime_type"),
		byteSize: bigint("byte_size", { mode: "number" }),
		widthPx: integer("width_px"),
		heightPx: integer("height_px"),

		/** Content hash: file integrity in the packet, and duplicate detection later. */
		sha256: text("sha256"),

		uploadedBy: text("uploaded_by").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamps().createdAt,
	},
	(table) => [
		index("evidence_asset_evidence_id_idx").on(table.evidenceId),
		index("evidence_asset_sha256_idx").on(table.sha256),
	],
);

/**
 * The verification audit trail: one row per human decision about one field.
 *
 * Append-only. `evidence` holds the current value; this holds how it got there,
 * including the case where a human overrode a confident extraction.
 */
export const evidenceFieldReview = pgTable(
	"evidence_field_review",
	{
		id: primaryId(),
		evidenceId: uuid("evidence_id")
			.notNull()
			.references(() => evidence.id, { onDelete: "cascade" }),

		field: evidenceFieldEnum("field").notNull(),
		/** Values are kept as text so any field's history reads the same way. */
		originalValue: text("original_value"),
		reviewedValue: text("reviewed_value"),

		decision: reviewDecisionEnum("decision").notNull(),
		note: text("note"),

		reviewedBy: text("reviewed_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamps().createdAt,
	},
	(table) => [
		index("evidence_field_review_evidence_field_idx").on(
			table.evidenceId,
			table.field,
		),
		index("evidence_field_review_reviewed_by_idx").on(table.reviewedBy),
	],
);

export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;
export type EvidenceAsset = typeof evidenceAsset.$inferSelect;
export type NewEvidenceAsset = typeof evidenceAsset.$inferInsert;
export type EvidenceFieldReview = typeof evidenceFieldReview.$inferSelect;
export type NewEvidenceFieldReview = typeof evidenceFieldReview.$inferInsert;
