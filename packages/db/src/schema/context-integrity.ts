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
	type CaptureMethod,
	type ContentSurface,
	type ContextElement,
	type ContextElementStatus,
	contextElementEnum,
	contextElementStatusEnum,
	type Platform,
	type TimePrecision,
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

/** The verified evidence fields the checklist is derived from. */
export type ContextCheckInput = {
	hasArtifact: boolean;
	platform: Platform;
	contentText: string | null;
	occurredAt: Date | null;
	occurredAtPrecision: TimePrecision;
	sourceUrl: string | null;
	targetContext: string | null;
	contentSurface: ContentSurface;
	parentEvidenceId: string | null;
	parentContextUrl: string | null;
	parentContextSummary: string | null;
	captureMethod: CaptureMethod;
};

export type DerivedContextCheck = {
	element: ContextElement;
	status: ContextElementStatus;
	weight: number;
	note: string | null;
};

/**
 * Surfaces that have nothing above them in a thread. A direct message or a
 * top-level post is not penalised for having no parent post.
 */
const SURFACES_WITHOUT_PARENT: ReadonlySet<ContentSurface> = new Set([
	"public_post",
	"story",
	"direct_message",
	"group_chat",
	"live_stream",
	"profile",
]);

/**
 * Turns verified evidence fields into the eight checklist rows.
 *
 * The distinction that matters here is `missing` versus `unknown`: a screenshot
 * with no visible platform is not the same as one an advocate has not filled in
 * yet, and the checklist says which it is rather than flattening both to absent.
 */
export function deriveContextChecks(
	input: ContextCheckInput,
): DerivedContextCheck[] {
	const check = (
		element: ContextElement,
		status: ContextElementStatus,
		note: string | null = null,
	): DerivedContextCheck => ({
		element,
		status,
		weight: CONTEXT_ELEMENT_WEIGHTS[element],
		note,
	});

	const hasParentContext =
		input.parentEvidenceId !== null ||
		input.parentContextUrl !== null ||
		input.parentContextSummary !== null;

	return [
		input.hasArtifact
			? check("evidence_artifact", "present")
			: check(
					"evidence_artifact",
					"missing",
					"No screenshot or capture attached — only a reference to the content.",
				),

		input.platform === "unknown"
			? check("platform", "unknown", "No platform visible in the capture.")
			: check("platform", "present"),

		input.contentText && input.contentText.trim().length > 0
			? check("content_text", "present")
			: check("content_text", "missing", "No readable content text recorded."),

		input.occurredAt === null
			? check("timestamp", "missing", "No post time recorded.")
			: input.occurredAtPrecision === "unknown"
				? check(
						"timestamp",
						"unknown",
						"A time is recorded but its precision could not be established.",
					)
				: check("timestamp", "present"),

		input.sourceUrl
			? check("source_url", "present")
			: check(
					"source_url",
					"missing",
					"No original URL — the content cannot be re-checked at source.",
				),

		input.targetContext
			? check("target_context", "present")
			: check(
					"target_context",
					"missing",
					"Who or what was targeted has not been recorded.",
				),

		SURFACES_WITHOUT_PARENT.has(input.contentSurface)
			? check(
					"parent_context",
					"not_applicable",
					"This surface has no parent post.",
				)
			: input.contentSurface === "unknown" || input.contentSurface === "other"
				? check(
						"parent_context",
						"unknown",
						"Surface unknown, so it is unclear whether a parent post exists.",
					)
				: hasParentContext
					? check("parent_context", "present")
					: check(
							"parent_context",
							"missing",
							"Replies to something that has not been captured.",
						),

		input.captureMethod === "unknown"
			? check(
					"capture_provenance",
					"unknown",
					"How this capture was made has not been recorded.",
				)
			: check("capture_provenance", "present"),
	];
}

export type EvidenceContextCheck = typeof evidenceContextCheck.$inferSelect;
export type NewEvidenceContextCheck = typeof evidenceContextCheck.$inferInsert;
