import { expect, test } from "bun:test";

import { renderPacketPdf } from "./packet-pdf";
import type { IncidentPacket } from "./routers/incident";

const emptyPacket: IncidentPacket = {
	generatedAt: new Date().toISOString(),
	incident: {
		referenceCode: "HW-2026-0001",
		title: "Coordinated harassment across two platforms",
		status: "in_review",
		priority: "standard",
		safetyReviewStatus: "not_flagged",
		targetType: "individual",
		targetDescription: null,
		reportingContext: "supporting_someone_else",
		declaredPlatforms: [],
		windowStartAt: null,
		windowEndAt: null,
		contextIntegrityScore: null,
		summaryApproved: null,
		organizationName: null,
		closedAt: null,
	},
	evidence: [],
	patterns: [],
	aiRuns: [],
};

/** Nulls everywhere is the shape that breaks a report renderer first. */
test("renders a packet with nothing filled in", async () => {
	const pdf = await renderPacketPdf(emptyPacket);
	expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
	expect(pdf.length).toBeGreaterThan(1_000);
});

/** Exported so a layout preview can be rendered without a database. */
export const samplePacket: IncidentPacket = {
	...emptyPacket,
	incident: {
		...emptyPacket.incident,
		summaryApproved: "Approved by the advocate on 2026-08-22.",
		contextIntegrityScore: 72,
		windowStartAt: new Date("2026-08-01T10:00:00Z"),
		windowEndAt: new Date("2026-08-20T18:30:00Z"),
	},
	evidence: [
		{
			sequenceNumber: 1,
			platform: "x",
			contentSurface: "public_post",
			sourceUrl: "https://example.test/post/1",
			displayedAccountHandle: "@example",
			displayedAccountDisplayName: null,
			contentText: "lorem ipsum ".repeat(120),
			contentLanguage: "en",
			occurredAt: new Date("2026-08-01T10:00:00Z"),
			occurredAtTimezone: "UTC",
			occurredAtPrecision: "exact",
			capturedAt: new Date("2026-08-02T09:00:00Z"),
			captureMethod: "browser_screenshot",
			captureNote: null,
			parentContextUrl: null,
			parentContextSummary: null,
			targetContext: "Named the school's only Sikh teacher.",
			advocateNote: null,
			needsPriorityReview: true,
			priorityReviewReason: "threat language",
			contextIntegrityScore: 68,
			verificationStatus: "verified",
			contextChecks: [
				{
					element: "parent_context",
					status: "missing",
					weight: 2,
					note: null,
				},
				{ element: "source_url", status: "present", weight: 3, note: null },
			],
			classifications: [
				{
					category: "threatening_language",
					claim: "Reads as a threat of physical harm.",
					rationale: "Names a location and a time.",
					supportingQuote: "see you at the gates",
					confidence: "high",
					reviewStatus: "confirmed",
				},
			],
			redactions: [
				{
					kind: "personal_name",
					status: "applied",
					reason: "Bystander named in the reply.",
					detectedBy: "ai",
					decidedAt: new Date("2026-08-03T09:00:00Z"),
				},
			],
			assets: [
				{
					role: "redacted",
					fileName: "post-1.png",
					mimeType: "image/png",
					sha256: "a".repeat(64),
				},
			],
		},
	],
	patterns: [
		{
			kind: "escalation",
			name: "Escalation over three weeks",
			description: "Volume and severity both rise after the first reply.",
			status: "confirmed",
			confidence: "medium",
			reviewerNote: null,
			firstObservedAt: new Date("2026-08-01T10:00:00Z"),
			lastObservedAt: new Date("2026-08-20T18:30:00Z"),
			evidenceSequenceNumbers: [1],
		},
	],
	aiRuns: [
		{
			task: "classification_suggestion",
			provider: "anthropic",
			model: "claude-opus-5",
			promptVersion: "v1",
			status: "succeeded",
			completedAt: new Date("2026-08-03T09:00:00Z"),
			evidenceSequenceNumber: 1,
		},
	],
};

test("renders evidence, patterns, gaps, redactions, and ai runs", async () => {
	const pdf = await renderPacketPdf(samplePacket);

	expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
	/** Long content text has to push the document past one page. */
	expect(pdf.toString("latin1")).toContain("/Count 2");
});
