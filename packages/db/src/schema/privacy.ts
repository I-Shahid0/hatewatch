import { sql } from "drizzle-orm";
import {
	check,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

import { aiRun } from "./ai";
import { user } from "./auth";
import { primaryId, timestamps } from "./columns";
import {
	authorKindEnum,
	confidenceLevelEnum,
	redactionKindEnum,
	redactionStatusEnum,
} from "./enums";
import { evidence, evidenceAsset } from "./evidence";

/** Where the personal information sits inside the artifact. */
export type RedactionLocation =
	| {
			type: "image_region";
			x: number;
			y: number;
			width: number;
			height: number;
	  }
	| { type: "text_span"; start: number; end: number }
	| { type: "field"; field: string };

/**
 * The redaction record. Covers both what a PII scan proposed and what a human
 * actually applied, because an export has to disclose both: dismissing a
 * suggestion is itself a decision worth recording.
 */
export const redaction = pgTable(
	"redaction",
	{
		id: primaryId(),
		evidenceId: uuid("evidence_id")
			.notNull()
			.references(() => evidence.id, { onDelete: "cascade" }),
		/** Set when the redaction targets a specific file rather than a text field. */
		evidenceAssetId: uuid("evidence_asset_id").references(
			() => evidenceAsset.id,
			{ onDelete: "cascade" },
		),

		kind: redactionKindEnum("kind").notNull(),
		status: redactionStatusEnum("status").default("suggested").notNull(),
		location: jsonb("location").$type<RedactionLocation>(),

		detectedBy: authorKindEnum("detected_by").notNull(),
		aiRunId: uuid("ai_run_id").references(() => aiRun.id, {
			onDelete: "set null",
		}),
		confidence: confidenceLevelEnum("confidence")
			.default("unavailable")
			.notNull(),

		reason: text("reason").notNull(),

		decidedBy: text("decided_by").references(() => user.id, {
			onDelete: "set null",
		}),
		decidedAt: timestamp("decided_at", { withTimezone: true }),

		...timestamps(),
	},
	(table) => [
		index("redaction_evidence_id_idx").on(table.evidenceId),
		index("redaction_status_idx").on(table.status),
		check(
			"redaction_decisions_have_a_decider",
			sql`${table.status} = 'suggested' or ${table.decidedBy} is not null`,
		),
	],
);

export type Redaction = typeof redaction.$inferSelect;
export type NewRedaction = typeof redaction.$inferInsert;
