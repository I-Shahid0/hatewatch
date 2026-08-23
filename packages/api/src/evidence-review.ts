import type { Db } from "@hate_evidence_copilot/db";
import {
	computeContextIntegrity,
	deriveContextChecks,
	type Evidence,
	type EvidenceFieldName,
	evidence,
	evidenceContextCheck,
	incident,
	type ReviewDecision,
} from "@hate_evidence_copilot/db";
import { eq, max } from "@hate_evidence_copilot/db/sql";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Fields that must be reviewed before an item can reach `verified`. */
export const VERIFICATION_CORE_FIELDS = [
	"platform",
	"content_surface",
	"source_url",
	"content_text",
	"occurred_at",
	"target_context",
	"capture_method",
] as const satisfies readonly EvidenceFieldName[];

export type VerifiableField = (typeof VERIFICATION_CORE_FIELDS)[number];

type FieldUpdate = Partial<
	Pick<
		Evidence,
		| "platform"
		| "contentSurface"
		| "sourceUrl"
		| "displayedAccountHandle"
		| "displayedAccountDisplayName"
		| "contentText"
		| "contentLanguage"
		| "occurredAt"
		| "occurredAtTimezone"
		| "occurredAtPrecision"
		| "captureMethod"
		| "targetContext"
		| "parentContextUrl"
		| "parentContextSummary"
	>
>;

/** Maps `evidenceFieldEnum` values to the column(s) they touch. */
export function readFieldValue(
	row: Evidence,
	field: EvidenceFieldName,
): string | null {
	switch (field) {
		case "platform":
			return row.platform;
		case "content_surface":
			return row.contentSurface;
		case "source_url":
			return row.sourceUrl;
		case "displayed_account_handle":
			return row.displayedAccountHandle;
		case "displayed_account_display_name":
			return row.displayedAccountDisplayName;
		case "content_text":
			return row.contentText;
		case "content_language":
			return row.contentLanguage;
		case "occurred_at":
			return row.occurredAt?.toISOString() ?? null;
		case "occurred_at_timezone":
			return row.occurredAtTimezone;
		case "capture_method":
			return row.captureMethod;
		case "target_context":
			return row.targetContext;
		case "parent_context_url":
			return row.parentContextUrl;
		case "parent_context_summary":
			return row.parentContextSummary;
		default:
			return null;
	}
}

/** Applies a human review decision to the verified columns on `evidence`. */
export function applyFieldDecision(
	field: EvidenceFieldName,
	decision: ReviewDecision,
	reviewedValue: string | null | undefined,
): FieldUpdate {
	const trimmed = reviewedValue?.trim() ?? null;

	switch (decision) {
		case "confirmed":
			return {};

		case "edited":
			return applyEditedValue(field, trimmed);

		case "marked_unavailable":
			return applyUnavailable(field);

		case "marked_uncertain":
			return applyUncertain(field);

		default:
			return {};
	}
}

function applyEditedValue(
	field: EvidenceFieldName,
	value: string | null,
): FieldUpdate {
	switch (field) {
		case "platform":
			return value ? { platform: value as Evidence["platform"] } : {};
		case "content_surface":
			return value
				? { contentSurface: value as Evidence["contentSurface"] }
				: {};
		case "source_url":
			return { sourceUrl: value };
		case "displayed_account_handle":
			return { displayedAccountHandle: value };
		case "displayed_account_display_name":
			return { displayedAccountDisplayName: value };
		case "content_text":
			return {
				contentText: value,
				contentLanguage: value ? "en" : null,
			};
		case "content_language":
			return { contentLanguage: value };
		case "occurred_at":
			return {
				occurredAt: value ? new Date(value) : null,
				occurredAtPrecision: value ? "minute" : "unknown",
			};
		case "occurred_at_timezone":
			return { occurredAtTimezone: value };
		case "capture_method":
			return value ? { captureMethod: value as Evidence["captureMethod"] } : {};
		case "target_context":
			return { targetContext: value };
		case "parent_context_url":
			return { parentContextUrl: value };
		case "parent_context_summary":
			return { parentContextSummary: value };
		default:
			return {};
	}
}

function applyUnavailable(field: EvidenceFieldName): FieldUpdate {
	switch (field) {
		case "platform":
			return { platform: "unknown" };
		case "content_surface":
			return { contentSurface: "unknown" };
		case "source_url":
			return { sourceUrl: null };
		case "displayed_account_handle":
			return { displayedAccountHandle: null };
		case "displayed_account_display_name":
			return { displayedAccountDisplayName: null };
		case "content_text":
			return { contentText: null, contentLanguage: null };
		case "content_language":
			return { contentLanguage: null };
		case "occurred_at":
			return { occurredAt: null, occurredAtPrecision: "unknown" };
		case "occurred_at_timezone":
			return { occurredAtTimezone: null };
		case "capture_method":
			return { captureMethod: "unknown" };
		case "target_context":
			return { targetContext: null };
		case "parent_context_url":
			return { parentContextUrl: null };
		case "parent_context_summary":
			return { parentContextSummary: null };
		default:
			return {};
	}
}

function applyUncertain(field: EvidenceFieldName): FieldUpdate {
	switch (field) {
		case "platform":
			return { platform: "unknown" };
		case "content_surface":
			return { contentSurface: "unknown" };
		case "capture_method":
			return { captureMethod: "unknown" };
		default:
			return {};
	}
}

export function computeVerificationStatus(
	row: Evidence,
	latestReviews: Map<EvidenceFieldName, ReviewDecision>,
	hasArtifact: boolean,
): Evidence["verificationStatus"] {
	if (row.verificationStatus === "excluded") return "excluded";

	const reviewedCore = VERIFICATION_CORE_FIELDS.filter((field) =>
		latestReviews.has(field),
	);

	if (reviewedCore.length === 0) {
		return hasArtifact ? "uploaded" : "needs_verification";
	}

	const allCoreReviewed = VERIFICATION_CORE_FIELDS.every((field) =>
		latestReviews.has(field),
	);

	const hasUncertain = VERIFICATION_CORE_FIELDS.some(
		(field) => latestReviews.get(field) === "marked_uncertain",
	);

	if (allCoreReviewed) {
		return hasUncertain ? "marked_uncertain" : "verified";
	}

	if (hasUncertain) return "marked_uncertain";
	return "partially_verified";
}

export async function recomputeEvidenceIntegrity(
	tx: Tx,
	row: Evidence,
	hasArtifact: boolean,
) {
	const checks = deriveContextChecks({
		hasArtifact,
		platform: row.platform,
		contentText: row.contentText,
		occurredAt: row.occurredAt,
		occurredAtPrecision: row.occurredAtPrecision,
		sourceUrl: row.sourceUrl,
		targetContext: row.targetContext,
		contentSurface: row.contentSurface,
		parentEvidenceId: row.parentEvidenceId,
		parentContextUrl: row.parentContextUrl,
		parentContextSummary: row.parentContextSummary,
		captureMethod: row.captureMethod,
	});

	await tx
		.delete(evidenceContextCheck)
		.where(eq(evidenceContextCheck.evidenceId, row.id));

	await tx.insert(evidenceContextCheck).values(
		checks.map((entry) => ({
			evidenceId: row.id,
			element: entry.element,
			status: entry.status,
			weight: entry.weight,
			note: entry.note,
		})),
	);

	const score = computeContextIntegrity(checks);
	const now = new Date();

	await tx
		.update(evidence)
		.set({
			contextIntegrityScore: score,
			contextIntegrityComputedAt: now,
		})
		.where(eq(evidence.id, row.id));

	return { checks, score };
}

export async function refreshIncidentIntegrity(tx: Tx, incidentId: string) {
	const rows = await tx
		.select({ score: evidence.contextIntegrityScore })
		.from(evidence)
		.where(eq(evidence.incidentId, incidentId));

	const scores = rows
		.map((row) => row.score)
		.filter((score): score is number => score !== null);

	const incidentScore =
		scores.length > 0
			? Math.round(
					scores.reduce((sum, value) => sum + value, 0) / scores.length,
				)
			: null;

	const [current] = await tx
		.select({ status: incident.status })
		.from(incident)
		.where(eq(incident.id, incidentId))
		.limit(1);

	await tx
		.update(incident)
		.set({
			contextIntegrityScore: incidentScore,
			contextIntegrityComputedAt: new Date(),
			...(current?.status === "draft" ? { status: "intake" as const } : {}),
		})
		.where(eq(incident.id, incidentId));
}

/** Next citation number — exported for create path reuse. */
export async function allocateSequenceNumber(
	tx: Tx,
	incidentId: string,
): Promise<number> {
	const [locked] = await tx
		.select({ id: incident.id })
		.from(incident)
		.where(eq(incident.id, incidentId))
		.for("update");

	if (!locked) throw new Error("Incident not found.");

	const [agg] = await tx
		.select({ highest: max(evidence.sequenceNumber) })
		.from(evidence)
		.where(eq(evidence.incidentId, incidentId));

	return (agg?.highest ?? 0) + 1;
}
