import {
	boolean,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { primaryId, timestamps } from "./columns";
import {
	aiRunStatusEnum,
	aiTaskEnum,
	type ConfidenceLevel,
	type EvidenceFieldName,
} from "./enums";
import { evidence } from "./evidence";
import { incident } from "./incident";

/** Model output for the evidence fields, before any human touches it. */
export type ExtractedEvidenceFields = Partial<
	Record<EvidenceFieldName, string | null>
>;

export type FieldConfidenceMap = Partial<
	Record<EvidenceFieldName, ConfidenceLevel>
>;

/**
 * Every model invocation, whatever it was for.
 *
 * This is the backbone of the AI transparency section in an exported packet: a
 * packet can state exactly which model touched which evidence, for which task,
 * and whether a human accepted the result.
 *
 * Prompt inputs are recorded as a digest rather than raw text so the log does
 * not become a second copy of the evidence.
 */
export const aiRun = pgTable(
	"ai_run",
	{
		id: primaryId(),
		incidentId: uuid("incident_id").references(() => incident.id, {
			onDelete: "cascade",
		}),
		evidenceId: uuid("evidence_id").references(() => evidence.id, {
			onDelete: "cascade",
		}),

		task: aiTaskEnum("task").notNull(),
		status: aiRunStatusEnum("status").default("pending").notNull(),

		provider: text("provider").notNull(),
		model: text("model").notNull(),
		promptVersion: text("prompt_version").notNull(),
		inputDigest: text("input_digest"),

		output: jsonb("output").$type<Record<string, unknown>>(),
		errorMessage: text("error_message"),

		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		latencyMs: integer("latency_ms"),
		costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),

		/** Null when the run was triggered by a background job rather than a person. */
		triggeredBy: text("triggered_by").references(() => user.id, {
			onDelete: "set null",
		}),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamps().createdAt,
	},
	(table) => [
		index("ai_run_incident_id_idx").on(table.incidentId),
		index("ai_run_evidence_id_idx").on(table.evidenceId),
		index("ai_run_task_status_idx").on(table.task, table.status),
	],
);

/**
 * A structured extraction attempt against one evidence item.
 *
 * Kept separate from `evidence` on purpose: re-running extraction must never
 * overwrite verified values, and the verification screen needs the original
 * proposal to show alongside the artifact.
 */
export const evidenceExtraction = pgTable(
	"evidence_extraction",
	{
		id: primaryId(),
		evidenceId: uuid("evidence_id")
			.notNull()
			.references(() => evidence.id, { onDelete: "cascade" }),
		aiRunId: uuid("ai_run_id").references(() => aiRun.id, {
			onDelete: "set null",
		}),

		/** Increments per evidence item so re-extractions are additive. */
		version: integer("version").default(1).notNull(),
		isCurrent: boolean("is_current").default(true).notNull(),

		extracted: jsonb("extracted")
			.$type<ExtractedEvidenceFields>()
			.default({})
			.notNull(),
		/** Per-field High / Medium / Low / Unavailable — never a single overall score. */
		fieldConfidence: jsonb("field_confidence")
			.$type<FieldConfidenceMap>()
			.default({})
			.notNull(),

		/** What the model could not read: cropped text, blurred handle, cut-off thread. */
		limitationsNote: text("limitations_note"),

		createdAt: timestamps().createdAt,
	},
	(table) => [
		uniqueIndex("evidence_extraction_version_idx").on(
			table.evidenceId,
			table.version,
		),
		index("evidence_extraction_current_idx").on(
			table.evidenceId,
			table.isCurrent,
		),
	],
);

export type AiRun = typeof aiRun.$inferSelect;
export type NewAiRun = typeof aiRun.$inferInsert;
export type EvidenceExtraction = typeof evidenceExtraction.$inferSelect;
export type NewEvidenceExtraction = typeof evidenceExtraction.$inferInsert;
