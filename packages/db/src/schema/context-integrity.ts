import {
	index,
	integer,
	pgTable,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { primaryId, timestamps } from "./columns";
import {
	type ContextElement,
	type ContextElementStatus,
	contextElementEnum,
	contextElementStatusEnum,
} from "./enums";
import { evidence } from "./evidence";

/**
 * Weights for the Context Integrity checklist.
 *
 * The artifact itself is a gate rather than a weighted element: without it there
 * is nothing to score. The remaining weights sum to 100.
 */
export const CONTEXT_ELEMENT_WEIGHTS = {
	evidence_artifact: 0,
	platform: 10,
	content_text: 15,
	timestamp: 15,
	source_url: 20,
	target_context: 15,
	parent_context: 15,
	capture_provenance: 10,
} as const satisfies Record<ContextElement, number>;

/**
 * One row per checklist element per evidence item, so the score is always
 * inspectable: a user can see which elements are present, missing, unknown, or
 * not applicable, and what each was worth.
 *
 * `weight` is stored per row rather than read from the constant above so an
 * exported packet stays explainable even after the weights are retuned.
 */
export const evidenceContextCheck = pgTable(
	"evidence_context_check",
	{
		id: primaryId(),
		evidenceId: uuid("evidence_id")
			.notNull()
			.references(() => evidence.id, { onDelete: "cascade" }),

		element: contextElementEnum("element").notNull(),
		status: contextElementStatusEnum("status").default("missing").notNull(),
		weight: integer("weight").notNull(),

		/** Why an element is unknown or not applicable — e.g. a DM has no parent post. */
		note: text("note"),

		...timestamps(),
	},
	(table) => [
		uniqueIndex("evidence_context_check_element_idx").on(
			table.evidenceId,
			table.element,
		),
		index("evidence_context_check_status_idx").on(table.status),
	],
);

/**
 * Context Integrity = available context / applicable context.
 *
 * `not_applicable` elements leave the denominator, so a DM is not penalised for
 * having no parent post. `unknown` stays in the denominator: an unresolved
 * question is a gap, not a free pass.
 */
export function computeContextIntegrity(
	checks: ReadonlyArray<{ status: ContextElementStatus; weight: number }>,
): number | null {
	let applicable = 0;
	let available = 0;

	for (const check of checks) {
		if (check.status === "not_applicable") continue;
		applicable += check.weight;
		if (check.status === "present") available += check.weight;
	}

	if (applicable === 0) return null;
	return Math.round((available / applicable) * 100);
}

export type EvidenceContextCheck = typeof evidenceContextCheck.$inferSelect;
export type NewEvidenceContextCheck = typeof evidenceContextCheck.$inferInsert;
