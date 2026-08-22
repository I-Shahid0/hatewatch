/**
 * Seeds the demo incident from the HateWatch demo script.
 *
 * Everything here is **fictional**. The accounts, the community centre, the
 * posts, and the messages were written for this seed; the content is deliberately
 * brief and exists so the review, Context Integrity, and packet flows have
 * something realistic to operate on. Every incident created here is marked
 * `is_demo`.
 *
 * The seed writes through the same derivation helpers the application uses, so a
 * seeded incident and an uploaded one cannot drift apart: Context Integrity is
 * computed from the evidence rows rather than hand-written.
 *
 * Run with `bun run db:seed`. Re-running replaces the demo incident.
 *
 * The incident is attached to `SEED_OWNER_EMAIL` if set, otherwise to the first
 * registered user, otherwise to a placeholder advocate who cannot sign in. Sign
 * up first if you want the demo incident to appear on your own dashboard.
 */

import { createHash, randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { db } from "./index";
import {
	aiRun,
	type CaptureMethod,
	type ClassificationCategory,
	type ClassificationReviewStatus,
	type ConfidenceLevel,
	type ContentSurface,
	classification,
	computeContextIntegrity,
	deriveContextChecks,
	type EvidenceFieldName,
	type EvidenceKind,
	evidence,
	evidenceAsset,
	evidenceContextCheck,
	evidenceExtraction,
	evidenceFieldReview,
	formatIncidentReference,
	incident,
	type Platform,
	pattern,
	patternEvidence,
	type RedactionKind,
	type RedactionStatus,
	type ReviewDecision,
	redaction,
	routingAction,
	type TimePrecision,
	user,
} from "./schema";

const DEMO_TITLE =
	"Replies and direct messages targeting Crescent Community Centre open day";

const MODEL = { provider: "demo", model: "seeded-extraction", version: "v0" };

/** All demo timestamps sit in a three-day window in August 2026. */
const at = (day: number, hour: number, minute = 0) =>
	new Date(Date.UTC(2026, 7, day, hour, minute));

type AssetSeed = {
	role: "original" | "redacted";
	widthPx: number;
	heightPx: number;
};

type ClassificationSeed = {
	category: ClassificationCategory;
	claim: string;
	rationale: string;
	supportingQuote: string | null;
	confidence: ConfidenceLevel;
	reviewStatus: ClassificationReviewStatus;
	reviewerNote: string | null;
	/** A human category that replaces the AI suggestion above it. */
	replacedBy?: {
		category: ClassificationCategory;
		claim: string;
		rationale: string;
		reviewerNote: string;
	};
};

type FieldReviewSeed = {
	field: EvidenceFieldName;
	originalValue: string | null;
	reviewedValue: string | null;
	decision: ReviewDecision;
	note: string | null;
};

type RedactionSeed = {
	kind: RedactionKind;
	status: RedactionStatus;
	reason: string;
	confidence: ConfidenceLevel;
	onRedactedAsset: boolean;
};

type EvidenceSeed = {
	label: string;
	kind: EvidenceKind;
	platform: Platform;
	contentSurface: ContentSurface;
	verificationStatus:
		| "verified"
		| "partially_verified"
		| "needs_verification"
		| "marked_uncertain";
	sourceUrl: string | null;
	displayedAccountHandle: string | null;
	displayedAccountDisplayName: string | null;
	contentText: string | null;
	occurredAt: Date | null;
	occurredAtTimezone: string | null;
	occurredAtPrecision: TimePrecision;
	capturedAt: Date | null;
	captureMethod: CaptureMethod;
	captureNote: string | null;
	parentLabel: string | null;
	parentContextUrl: string | null;
	parentContextSummary: string | null;
	targetContext: string | null;
	advocateNote: string | null;
	needsPriorityReview: boolean;
	priorityReviewReason: string | null;
	assets: AssetSeed[];
	/** Extraction values that differ from the verified ones, keyed by field. */
	extractionOverrides?: Partial<Record<EvidenceFieldName, string | null>>;
	confidenceOverrides?: Partial<Record<EvidenceFieldName, ConfidenceLevel>>;
	limitationsNote: string | null;
	classifications: ClassificationSeed[];
	fieldReviews: FieldReviewSeed[];
	redactions: RedactionSeed[];
};

const TARGET = "Crescent Community Centre and its open day attendees";

const EVIDENCE: EvidenceSeed[] = [
	{
		label: "centre-post",
		kind: "screenshot",
		platform: "x",
		contentSurface: "public_post",
		verificationStatus: "verified",
		sourceUrl: "https://x.com/crescentcc/status/1901000000000000001",
		displayedAccountHandle: "@crescentcc",
		displayedAccountDisplayName: "Crescent Community Centre",
		contentText:
			"Our new community hall opens Saturday. Free tea, food stalls and a kids' corner. Everyone welcome!",
		occurredAt: at(20, 9, 15),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 5),
		captureMethod: "browser_screenshot",
		captureNote: "Captured by the advocate from the centre's public profile.",
		parentLabel: null,
		parentContextUrl: null,
		parentContextSummary: null,
		targetContext: TARGET,
		advocateNote:
			"The centre's own announcement. Kept as the anchor post the replies attach to.",
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [{ role: "original", widthPx: 1170, heightPx: 1704 }],
		limitationsNote: null,
		classifications: [],
		fieldReviews: [
			{
				field: "content_text",
				originalValue:
					"Our new community hall opens Saturday. Free tea, food stalls and a kids' corner. Everyone welcome!",
				reviewedValue: null,
				decision: "confirmed",
				note: null,
			},
		],
		redactions: [],
	},
	{
		label: "reply-supportive",
		kind: "screenshot",
		platform: "x",
		contentSurface: "reply",
		verificationStatus: "verified",
		sourceUrl: "https://x.com/localvoice_ns/status/1901000000000000014",
		displayedAccountHandle: "@localvoice_ns",
		displayedAccountDisplayName: "Northside Local",
		contentText:
			"Congratulations on the new hall, hope the open day goes brilliantly.",
		occurredAt: at(20, 10, 2),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 6),
		captureMethod: "browser_screenshot",
		captureNote: null,
		parentLabel: "centre-post",
		parentContextUrl: "https://x.com/crescentcc/status/1901000000000000001",
		parentContextSummary: "Reply to the centre's open day announcement.",
		targetContext: TARGET,
		advocateNote:
			"Included deliberately: not every reply in the thread is hostile, and the record should show that.",
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [{ role: "original", widthPx: 1170, heightPx: 980 }],
		limitationsNote: null,
		classifications: [
			{
				category: "no_apparent_hate_indicators",
				claim: "This reply is supportive and shows no anti-Muslim indicators.",
				rationale:
					"The message congratulates the centre and expresses goodwill toward the event. Nothing in the text targets the community.",
				supportingQuote: "hope the open day goes brilliantly",
				confidence: "high",
				reviewStatus: "confirmed",
				reviewerNote: "Agreed. Keeping it in the record for context.",
			},
		],
		fieldReviews: [],
		redactions: [],
	},
	{
		label: "reply-collective-blame",
		kind: "screenshot",
		platform: "x",
		contentSurface: "reply",
		verificationStatus: "verified",
		sourceUrl: "https://x.com/truth_over_all_22/status/1901000000000000027",
		displayedAccountHandle: "@truth_over_all_22",
		displayedAccountDisplayName: "Truth Over All",
		contentText:
			"Convenient how the whole community goes quiet every time one of them makes the news.",
		occurredAt: at(20, 14, 47),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 8),
		captureMethod: "browser_screenshot",
		captureNote: null,
		parentLabel: "centre-post",
		parentContextUrl: "https://x.com/crescentcc/status/1901000000000000001",
		parentContextSummary: "Reply to the centre's open day announcement.",
		targetContext: TARGET,
		advocateNote: null,
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [{ role: "original", widthPx: 1170, heightPx: 1010 }],
		extractionOverrides: {
			content_text:
				"Convenient how the whole community goes quiet every time one of them makes the news",
		},
		limitationsNote: "Trailing punctuation was cropped in the capture.",
		classifications: [
			{
				category: "collective_blame",
				claim:
					"The reply holds an entire community responsible for the actions of unnamed individuals.",
				rationale:
					"“the whole community goes quiet” attributes a collective failure to respond, and “one of them” frames individuals as representatives of that community.",
				supportingQuote: "the whole community goes quiet",
				confidence: "medium",
				reviewStatus: "confirmed",
				reviewerNote:
					"Confirmed as collective blame. The phrasing recurs on two other platforms.",
			},
		],
		fieldReviews: [
			{
				field: "content_text",
				originalValue:
					"Convenient how the whole community goes quiet every time one of them makes the news",
				reviewedValue:
					"Convenient how the whole community goes quiet every time one of them makes the news.",
				decision: "edited",
				note: "Restored the full stop visible in the original screenshot.",
			},
		],
		redactions: [],
	},
	{
		label: "reply-dehumanization",
		kind: "screenshot",
		platform: "x",
		contentSurface: "reply",
		verificationStatus: "verified",
		sourceUrl: "https://x.com/quiet_observer7/status/1901000000000000031",
		displayedAccountHandle: "@quiet_observer7",
		displayedAccountDisplayName: "Quiet Observer",
		contentText:
			"They breed like rats and call it community outreach. Nothing welcome about it.",
		occurredAt: at(20, 16, 20),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 9),
		captureMethod: "browser_screenshot",
		captureNote: null,
		parentLabel: "centre-post",
		parentContextUrl: "https://x.com/crescentcc/status/1901000000000000001",
		parentContextSummary: "Reply to the centre's open day announcement.",
		targetContext: TARGET,
		advocateNote: null,
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [{ role: "original", widthPx: 1170, heightPx: 1024 }],
		limitationsNote: null,
		classifications: [
			{
				category: "dehumanization",
				claim: "The reply compares a group of people to vermin.",
				rationale:
					"“breed like rats” applies animal imagery to a community, which is dehumanising language rather than criticism of the event.",
				supportingQuote: "They breed like rats",
				confidence: "high",
				reviewStatus: "confirmed",
				reviewerNote: "Clear-cut. Included in the platform report preparation.",
			},
		],
		fieldReviews: [],
		redactions: [],
	},
	{
		label: "quote-conspiracy",
		kind: "screenshot",
		platform: "x",
		contentSurface: "quote_post",
		verificationStatus: "verified",
		sourceUrl: "https://x.com/truth_over_all_22/status/1901000000000000044",
		displayedAccountHandle: "@truth_over_all_22",
		displayedAccountDisplayName: "Truth Over All",
		contentText:
			"A 'community centre' is always stage one. They plan this decades ahead and the council waves it through.",
		occurredAt: at(20, 18, 5),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 11),
		captureMethod: "browser_screenshot",
		captureNote: null,
		parentLabel: "centre-post",
		parentContextUrl: "https://x.com/crescentcc/status/1901000000000000001",
		parentContextSummary:
			"Quote post of the centre's announcement, adding commentary.",
		targetContext: TARGET,
		advocateNote:
			"Same account as the earlier collective-blame reply, now amplifying to its own followers.",
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [{ role: "original", widthPx: 1170, heightPx: 1180 }],
		limitationsNote: null,
		classifications: [
			{
				category: "threatening_language",
				claim: "The post may contain a veiled threat about the centre.",
				rationale:
					"“stage one” could imply an escalating sequence of events directed at the centre.",
				supportingQuote: "always stage one",
				confidence: "low",
				reviewStatus: "changed",
				reviewerNote: null,
				replacedBy: {
					category: "conspiracy_narrative",
					claim:
						"The post frames the community centre as part of a long-term coordinated plan.",
					rationale:
						"“stage one”, “plan this decades ahead” and the claim that the council is complicit describe a hidden coordinated scheme. There is no threat of action by the author, so this is conspiracy narrative rather than threatening language.",
					reviewerNote:
						"Reviewer changed the category: no action is threatened by the author. Recorded as conspiracy narrative.",
				},
			},
		],
		fieldReviews: [],
		redactions: [],
	},
	{
		label: "ig-comment-exclusion",
		kind: "screenshot",
		platform: "instagram",
		contentSurface: "comment",
		verificationStatus: "partially_verified",
		sourceUrl: null,
		displayedAccountHandle: "@northgate_watch",
		displayedAccountDisplayName: "Northgate Watch",
		contentText:
			"This isn't their country. Build it somewhere they actually belong.",
		occurredAt: at(21, 8, 30),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 14),
		captureMethod: "device_screenshot",
		captureNote: "Sent to the advocate by the centre's volunteer coordinator.",
		parentLabel: null,
		parentContextUrl: null,
		parentContextSummary:
			"Comment under the centre's Instagram post about the open day; the parent post itself was not captured.",
		targetContext: TARGET,
		advocateNote:
			"The screenshot has no address bar, so the comment permalink could not be recovered.",
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [{ role: "original", widthPx: 1080, heightPx: 1440 }],
		confidenceOverrides: { source_url: "unavailable" },
		limitationsNote:
			"No URL visible in the capture; the permalink could not be reconstructed.",
		classifications: [
			{
				category: "exclusion_rhetoric",
				claim:
					"The comment asserts the targeted community does not belong in the country.",
				rationale:
					"“isn't their country” and “somewhere they actually belong” deny belonging on the basis of group membership.",
				supportingQuote: "This isn't their country",
				confidence: "high",
				reviewStatus: "confirmed",
				reviewerNote: null,
			},
		],
		fieldReviews: [
			{
				field: "source_url",
				originalValue: null,
				reviewedValue: null,
				decision: "marked_unavailable",
				note: "Screenshot was cropped above the address bar. Original link not recoverable.",
			},
		],
		redactions: [],
	},
	{
		label: "ig-story-institution",
		kind: "screenshot",
		platform: "instagram",
		contentSurface: "story",
		verificationStatus: "verified",
		sourceUrl: "https://instagram.com/stories/northgate_watch/3210000000001",
		displayedAccountHandle: "@northgate_watch",
		displayedAccountDisplayName: "Northgate Watch",
		contentText:
			"Someone should ring the council every single day until the annex is shut down.",
		occurredAt: at(21, 11, 0),
		occurredAtTimezone: null,
		occurredAtPrecision: "hour",
		capturedAt: at(22, 10, 16),
		captureMethod: "device_screenshot",
		captureNote:
			"Story reshared the centre's announcement with text overlaid. Captured before it expired.",
		parentLabel: null,
		parentContextUrl: null,
		parentContextSummary: null,
		targetContext: TARGET,
		advocateNote:
			"Story showed a relative timestamp only, so the hour is known but not the minute, and the timezone is unconfirmed.",
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [{ role: "original", widthPx: 1080, heightPx: 1920 }],
		confidenceOverrides: {
			occurred_at: "medium",
			occurred_at_timezone: "unavailable",
		},
		limitationsNote:
			"Story showed “3h ago” rather than an absolute time; the hour is inferred from the capture time.",
		classifications: [
			{
				category: "institution_targeting",
				claim:
					"The story calls for sustained pressure to close the centre's annex.",
				rationale:
					"“ring the council every single day until the annex is shut down” urges repeated action against a specific Muslim community institution.",
				supportingQuote: "until the annex is shut down",
				confidence: "medium",
				reviewStatus: "pending_review",
				reviewerNote: null,
			},
		],
		fieldReviews: [
			{
				field: "occurred_at_timezone",
				originalValue: null,
				reviewedValue: null,
				decision: "marked_uncertain",
				note: "Device timezone at capture is unknown, so the posting timezone cannot be confirmed.",
			},
		],
		redactions: [
			{
				kind: "unrelated_bystander",
				status: "dismissed",
				reason:
					"Scan flagged a face in the reshared event photo; it belongs to the centre's own published promotional image.",
				confidence: "low",
				onRedactedAsset: false,
			},
		],
	},
	{
		label: "tiktok-video-link",
		kind: "url",
		platform: "tiktok",
		contentSurface: "public_post",
		verificationStatus: "needs_verification",
		sourceUrl: "https://tiktok.com/@northgate_watch/video/7410000000000000001",
		displayedAccountHandle: "@northgate_watch",
		displayedAccountDisplayName: null,
		contentText: null,
		occurredAt: at(21, 13, 0),
		occurredAtTimezone: null,
		occurredAtPrecision: "day",
		capturedAt: null,
		captureMethod: "unknown",
		captureNote: null,
		parentLabel: null,
		parentContextUrl: null,
		parentContextSummary: null,
		targetContext: TARGET,
		advocateNote:
			"Link was passed on without a capture. Needs preserving before it is deleted.",
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [],
		confidenceOverrides: {
			content_text: "unavailable",
			occurred_at: "low",
		},
		limitationsNote:
			"No capture attached, so nothing could be extracted from the video itself.",
		classifications: [
			{
				category: "insufficient_context",
				claim:
					"There is not enough captured context to categorise this content.",
				rationale:
					"Only a URL was supplied. Without a capture or transcript there is no content to assess, and the video may be removed before anyone reviews it.",
				supportingQuote: null,
				confidence: "unavailable",
				reviewStatus: "marked_insufficient_context",
				reviewerNote:
					"Queued for preservation. Do not categorise until a capture exists.",
			},
		],
		fieldReviews: [],
		redactions: [],
	},
	{
		label: "tiktok-comment-coded",
		kind: "screenshot",
		platform: "tiktok",
		contentSurface: "comment",
		verificationStatus: "verified",
		sourceUrl:
			"https://tiktok.com/@northgate_watch/video/7410000000000000001?comment=88213",
		displayedAccountHandle: "@quiet_observer7",
		displayedAccountDisplayName: "Quiet Observer",
		contentText:
			"We all know what 'community centre' really means. Clock's ticking on that one.",
		occurredAt: at(21, 15, 42),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 21),
		captureMethod: "device_screenshot",
		captureNote: null,
		parentLabel: "tiktok-video-link",
		parentContextUrl:
			"https://tiktok.com/@northgate_watch/video/7410000000000000001",
		parentContextSummary: "Comment under the reaction video listed above.",
		targetContext: TARGET,
		advocateNote:
			"Same account as the dehumanising reply on X two days earlier.",
		needsPriorityReview: true,
		priorityReviewReason:
			"“Clock's ticking” may be an implied threat, but the phrasing is ambiguous. Needs a human decision.",
		assets: [{ role: "original", widthPx: 1080, heightPx: 1350 }],
		limitationsNote: null,
		classifications: [
			{
				category: "coded_or_ambiguous_rhetoric",
				claim:
					"The comment uses insinuation rather than explicit statements about the centre.",
				rationale:
					"“we all know what it really means” invites the reader to supply an unstated meaning, and “clock's ticking” is ambiguous between prediction and warning. Reading it as a threat would require context this evidence does not contain.",
				supportingQuote: "Clock's ticking on that one",
				confidence: "low",
				reviewStatus: "pending_review",
				reviewerNote: null,
			},
		],
		fieldReviews: [],
		redactions: [],
	},
	{
		label: "dm-implied-threat",
		kind: "screenshot",
		platform: "x",
		contentSurface: "direct_message",
		verificationStatus: "verified",
		sourceUrl: null,
		displayedAccountHandle: "@quiet_observer7",
		displayedAccountDisplayName: "Quiet Observer",
		contentText:
			"Enjoy your open day. We know which building it is and we know what time you lock up.",
		occurredAt: at(21, 22, 10),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 24),
		captureMethod: "forwarded_by_target",
		captureNote:
			"Forwarded by the centre's coordinator, who received the message directly.",
		parentLabel: null,
		parentContextUrl: null,
		parentContextSummary: null,
		targetContext: TARGET,
		advocateNote:
			"Private message. Escalated for human review the same day it was received.",
		needsPriorityReview: true,
		priorityReviewReason:
			"References the building and closing time alongside the event. Escalated for urgent human review.",
		assets: [
			{ role: "original", widthPx: 1170, heightPx: 2100 },
			{ role: "redacted", widthPx: 1170, heightPx: 2100 },
		],
		confidenceOverrides: { source_url: "unavailable" },
		limitationsNote: null,
		classifications: [
			{
				category: "threatening_language",
				claim:
					"The message pairs the event with knowledge of the building and its closing time.",
				rationale:
					"“we know which building it is” and “what time you lock up” state surveillance of a physical location in the same message as the event. No explicit act is named, so this is recorded as threatening language for human decision rather than as a criminal threat.",
				supportingQuote: "we know what time you lock up",
				confidence: "medium",
				reviewStatus: "confirmed",
				reviewerNote:
					"Confirmed and escalated. Advised the coordinator to contact local police directly; HateWatch does not do that for them.",
			},
		],
		fieldReviews: [
			{
				field: "source_url",
				originalValue: null,
				reviewedValue: null,
				decision: "marked_unavailable",
				note: "Direct messages have no public URL.",
			},
			{
				field: "content_text",
				originalValue:
					"Enjoy your open day. We know which building it is and we know what time you lock up.",
				reviewedValue: null,
				decision: "confirmed",
				note: "Checked against the forwarded screenshot word for word.",
			},
		],
		redactions: [
			{
				kind: "face",
				status: "applied",
				reason:
					"Profile photo of the account holder was visible; removed before the packet was shared.",
				confidence: "high",
				onRedactedAsset: true,
			},
		],
	},
	{
		label: "dm-harassment",
		kind: "screenshot",
		platform: "instagram",
		contentSurface: "direct_message",
		verificationStatus: "verified",
		sourceUrl: null,
		displayedAccountHandle: "@northgate_watch",
		displayedAccountDisplayName: "Northgate Watch",
		contentText:
			"Third message. You will not get a quiet night until that place is gone.",
		occurredAt: at(22, 1, 35),
		occurredAtTimezone: "Europe/London",
		occurredAtPrecision: "minute",
		capturedAt: at(22, 10, 26),
		captureMethod: "forwarded_by_target",
		captureNote: "Third message from the same account in nine hours.",
		parentLabel: null,
		parentContextUrl: null,
		parentContextSummary: null,
		targetContext: TARGET,
		advocateNote: null,
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [
			{ role: "original", widthPx: 1080, heightPx: 1920 },
			{ role: "redacted", widthPx: 1080, heightPx: 1920 },
		],
		confidenceOverrides: { source_url: "unavailable" },
		limitationsNote: null,
		classifications: [
			{
				category: "targeted_harassment",
				claim:
					"The message is part of a repeated private campaign against one recipient.",
				rationale:
					"“Third message” establishes repetition by the sender's own account, and “you will not get a quiet night” states an intention to continue.",
				supportingQuote: "You will not get a quiet night",
				confidence: "high",
				reviewStatus: "confirmed",
				reviewerNote: null,
			},
		],
		fieldReviews: [
			{
				field: "source_url",
				originalValue: null,
				reviewedValue: null,
				decision: "marked_unavailable",
				note: "Direct messages have no public URL.",
			},
		],
		redactions: [
			{
				kind: "account_handle",
				status: "suggested",
				reason:
					"A second participant's handle is visible in the conversation list and is unrelated to the incident.",
				confidence: "medium",
				onRedactedAsset: false,
			},
		],
	},
	{
		label: "unattributed-screenshot",
		kind: "screenshot",
		platform: "unknown",
		contentSurface: "unknown",
		verificationStatus: "marked_uncertain",
		sourceUrl: null,
		displayedAccountHandle: null,
		displayedAccountDisplayName: null,
		contentText: "they should have never been given planning permission for it",
		occurredAt: null,
		occurredAtTimezone: null,
		occurredAtPrecision: "unknown",
		capturedAt: null,
		captureMethod: "unknown",
		captureNote: null,
		parentLabel: null,
		parentContextUrl: null,
		parentContextSummary: null,
		targetContext: null,
		advocateNote:
			"Cropped screenshot with no username, platform chrome, or timestamp. Kept in the record but cannot support a finding on its own.",
		needsPriorityReview: false,
		priorityReviewReason: null,
		assets: [{ role: "original", widthPx: 828, heightPx: 420 }],
		confidenceOverrides: {
			platform: "unavailable",
			displayed_account_handle: "unavailable",
			occurred_at: "unavailable",
			content_text: "low",
		},
		limitationsNote:
			"Crop contains only message text. No account, platform, or timestamp visible.",
		classifications: [
			{
				category: "insufficient_context",
				claim: "There is not enough context to categorise this content.",
				rationale:
					"The crop has no account, platform, or timestamp, so the text cannot be attributed or placed in the chronology. It may be unrelated to this incident.",
				supportingQuote: null,
				confidence: "unavailable",
				reviewStatus: "pending_review",
				reviewerNote: null,
			},
		],
		fieldReviews: [
			{
				field: "platform",
				originalValue: null,
				reviewedValue: null,
				decision: "marked_uncertain",
				note: "No platform interface visible anywhere in the crop.",
			},
			{
				field: "displayed_account_handle",
				originalValue: null,
				reviewedValue: null,
				decision: "marked_uncertain",
				note: "Username row was cropped out.",
			},
		],
		redactions: [],
	},
];

type PatternSeed = {
	kind:
		| "repetition"
		| "public_to_private_shift"
		| "possible_coordination_indicators";
	name: string;
	description: string;
	confidence: ConfidenceLevel;
	status: "suggested" | "confirmed";
	reviewerNote: string | null;
	links: Array<{ label: string; note: string }>;
};

const PATTERNS: PatternSeed[] = [
	{
		kind: "repetition",
		name: "Same collective-blame framing on three platforms",
		description:
			"Three separate accounts use the construction “them / their community” to attribute collective responsibility, on X, Instagram, and TikTok within 32 hours. The wording differs but the framing is the same.",
		confidence: "medium",
		status: "confirmed",
		reviewerNote:
			"Confirmed. This is the pattern worth showing the centre's trustees.",
		links: [
			{
				label: "reply-collective-blame",
				note: "“the whole community goes quiet” — earliest instance.",
			},
			{
				label: "ig-comment-exclusion",
				note: "“their country” — same framing on a different platform.",
			},
			{
				label: "tiktok-comment-coded",
				note: "“we all know what it really means” — implied version of the same claim.",
			},
		],
	},
	{
		kind: "public_to_private_shift",
		name: "Public replies moved into direct messages",
		description:
			"Two accounts that replied publicly on 20 August sent direct messages to the centre's coordinator on 21 and 22 August. The move from a public thread to private messages happened after the open day was announced.",
		confidence: "medium",
		status: "confirmed",
		reviewerNote:
			"Confirmed. This is the sequence that justified the urgent escalation.",
		links: [
			{
				label: "reply-dehumanization",
				note: "Public reply from @quiet_observer7 on 20 August.",
			},
			{
				label: "dm-implied-threat",
				note: "Direct message from the same handle on 21 August.",
			},
			{
				label: "dm-harassment",
				note: "Third direct message from @northgate_watch on 22 August.",
			},
		],
	},
	{
		kind: "possible_coordination_indicators",
		name: "Possible coordination indicators between three accounts",
		description:
			"Three accounts posted within a four-hour window, two of them reusing the same phrasing, and one amplified another's reply as a quote post. This is consistent with coordination but also with ordinary reply-thread pile-on. No account-level evidence of coordination was captured.",
		confidence: "low",
		status: "suggested",
		reviewerNote: null,
		links: [
			{
				label: "reply-collective-blame",
				note: "First of the three posts in the window.",
			},
			{
				label: "quote-conspiracy",
				note: "Same account amplifying to its own followers three hours later.",
			},
			{
				label: "reply-dehumanization",
				note: "Third account posting in the same window.",
			},
		],
	},
];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function resolveOwnerId(tx: Tx): Promise<string> {
	const requested = process.env.SEED_OWNER_EMAIL;

	if (requested) {
		const [found] = await tx
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, requested))
			.limit(1);
		if (!found) {
			throw new Error(
				`SEED_OWNER_EMAIL is set to ${requested} but no user has that email. Sign up first, or unset it.`,
			);
		}
		return found.id;
	}

	const [existing] = await tx
		.select({ id: user.id })
		.from(user)
		.orderBy(asc(user.createdAt))
		.limit(1);
	if (existing) return existing.id;

	/**
	 * No account exists yet. The placeholder has no credentials row, so it cannot
	 * sign in — it exists only to satisfy the `created_by` foreign key.
	 */
	const [created] = await tx
		.insert(user)
		.values({
			id: randomUUID(),
			name: "Demo Advocate",
			email: "demo-advocate@hatewatch.local",
			emailVerified: false,
		})
		.returning({ id: user.id });

	if (!created) throw new Error("Could not create the placeholder advocate.");
	return created.id;
}

const digest = (value: string) =>
	createHash("sha256").update(value).digest("hex");

function buildExtraction(item: EvidenceSeed) {
	const verified: Partial<Record<EvidenceFieldName, string | null>> = {
		platform: item.platform === "unknown" ? null : item.platform,
		content_surface:
			item.contentSurface === "unknown" ? null : item.contentSurface,
		source_url: item.sourceUrl,
		displayed_account_handle: item.displayedAccountHandle,
		displayed_account_display_name: item.displayedAccountDisplayName,
		content_text: item.contentText,
		content_language: item.contentText ? "en" : null,
		occurred_at: item.occurredAt?.toISOString() ?? null,
		occurred_at_timezone: item.occurredAtTimezone,
		capture_method:
			item.captureMethod === "unknown" ? null : item.captureMethod,
		target_context: item.targetContext,
		parent_context_url: item.parentContextUrl,
		parent_context_summary: item.parentContextSummary,
	};

	const extracted = { ...verified, ...(item.extractionOverrides ?? {}) };

	const fieldConfidence: Partial<Record<EvidenceFieldName, ConfidenceLevel>> =
		{};
	for (const [field, value] of Object.entries(extracted)) {
		fieldConfidence[field as EvidenceFieldName] =
			value === null ? "unavailable" : "high";
	}

	return {
		extracted,
		fieldConfidence: {
			...fieldConfidence,
			...(item.confidenceOverrides ?? {}),
		},
	};
}

async function seed() {
	const result = await db.transaction(async (tx) => {
		const ownerId = await resolveOwnerId(tx);

		await tx
			.delete(incident)
			.where(and(eq(incident.isDemo, true), eq(incident.title, DEMO_TITLE)));

		const [created] = await tx
			.insert(incident)
			.values({
				referenceCode: `pending-${randomUUID()}`,
				title: DEMO_TITLE,
				situationSummary:
					"The centre announced an open day on 20 August. Replies on X, comments on Instagram, and a TikTok reaction video followed, and by 21 August the coordinator was receiving direct messages. The coordinator asked for help documenting it before the open day on 23 August.",
				status: "in_review",
				priority: "priority_review",
				safetyReviewStatus: "needs_human_review",
				safetyReviewNote:
					"One direct message references the building and its closing time ahead of a public event. Awaiting a second reviewer before the packet is shared.",
				targetType: "mosque_or_islamic_institution",
				targetDescription:
					"Crescent Community Centre, a Muslim community centre with a prayer annex, and the volunteers running its open day.",
				reportingContext: "supporting_someone_else",
				declaredPlatforms: ["x", "instagram", "tiktok"],
				organizationName: "Northgate Community Advocacy (demo)",
				isDemo: true,
				createdBy: ownerId,
			})
			.returning({ id: incident.id, sequenceNumber: incident.sequenceNumber });

		if (!created) throw new Error("Incident insert returned no row.");

		const referenceCode = formatIncidentReference(created.sequenceNumber);
		await tx
			.update(incident)
			.set({ referenceCode })
			.where(eq(incident.id, created.id));

		const [classificationRun] = await tx
			.insert(aiRun)
			.values({
				incidentId: created.id,
				task: "classification_suggestion",
				status: "succeeded",
				provider: MODEL.provider,
				model: MODEL.model,
				promptVersion: MODEL.version,
				inputDigest: digest(`${referenceCode}:classification`),
				inputTokens: 4820,
				outputTokens: 1140,
				latencyMs: 7310,
				triggeredBy: ownerId,
				startedAt: at(22, 10, 40),
				completedAt: at(22, 10, 40),
			})
			.returning({ id: aiRun.id });

		const [patternRun] = await tx
			.insert(aiRun)
			.values({
				incidentId: created.id,
				task: "pattern_analysis",
				status: "succeeded",
				provider: MODEL.provider,
				model: MODEL.model,
				promptVersion: MODEL.version,
				inputDigest: digest(`${referenceCode}:patterns`),
				inputTokens: 5210,
				outputTokens: 860,
				latencyMs: 9040,
				triggeredBy: ownerId,
				startedAt: at(22, 10, 52),
				completedAt: at(22, 10, 52),
			})
			.returning({ id: aiRun.id });

		if (!classificationRun || !patternRun) {
			throw new Error("AI run inserts returned no rows.");
		}

		const evidenceIds = new Map<string, string>();
		const scores: number[] = [];
		let sequenceNumber = 0;

		for (const item of EVIDENCE) {
			sequenceNumber += 1;
			const parentEvidenceId = item.parentLabel
				? (evidenceIds.get(item.parentLabel) ?? null)
				: null;

			const [row] = await tx
				.insert(evidence)
				.values({
					incidentId: created.id,
					sequenceNumber,
					kind: item.kind,
					verificationStatus: item.verificationStatus,
					platform: item.platform,
					contentSurface: item.contentSurface,
					sourceUrl: item.sourceUrl,
					displayedAccountHandle: item.displayedAccountHandle,
					displayedAccountDisplayName: item.displayedAccountDisplayName,
					contentText: item.contentText,
					contentLanguage: item.contentText ? "en" : null,
					occurredAt: item.occurredAt,
					occurredAtTimezone: item.occurredAtTimezone,
					occurredAtPrecision: item.occurredAtPrecision,
					capturedAt: item.capturedAt,
					captureMethod: item.captureMethod,
					captureNote: item.captureNote,
					parentEvidenceId,
					parentContextUrl: item.parentContextUrl,
					parentContextSummary: item.parentContextSummary,
					targetContext: item.targetContext,
					advocateNote: item.advocateNote,
					needsPriorityReview: item.needsPriorityReview,
					priorityReviewReason: item.priorityReviewReason,
					createdBy: ownerId,
				})
				.returning({ id: evidence.id });

			if (!row) throw new Error(`Evidence insert failed for ${item.label}.`);
			evidenceIds.set(item.label, row.id);

			const label = `evidence-${String(sequenceNumber).padStart(2, "0")}`;
			const assetIds = new Map<string, string>();
			for (const asset of item.assets) {
				const storageKey = `demo/${referenceCode}/${label}-${asset.role}.png`;
				const [inserted] = await tx
					.insert(evidenceAsset)
					.values({
						evidenceId: row.id,
						role: asset.role,
						storageKey,
						fileName: `${label}-${asset.role}.png`,
						mimeType: "image/png",
						byteSize: 180_000 + sequenceNumber * 4_096,
						widthPx: asset.widthPx,
						heightPx: asset.heightPx,
						sha256: digest(storageKey),
						uploadedBy: ownerId,
					})
					.returning({ id: evidenceAsset.id });
				if (inserted) assetIds.set(asset.role, inserted.id);
			}

			const [extractionRun] = await tx
				.insert(aiRun)
				.values({
					incidentId: created.id,
					evidenceId: row.id,
					task: "evidence_extraction",
					status: item.assets.length === 0 ? "failed" : "succeeded",
					provider: MODEL.provider,
					model: MODEL.model,
					promptVersion: MODEL.version,
					inputDigest: digest(`${referenceCode}:${label}`),
					errorMessage:
						item.assets.length === 0
							? "No artifact attached; nothing to extract."
							: null,
					inputTokens: item.assets.length === 0 ? null : 1420,
					outputTokens: item.assets.length === 0 ? null : 320,
					latencyMs: item.assets.length === 0 ? 120 : 2840,
					triggeredBy: ownerId,
					startedAt: at(22, 10, 30),
					completedAt: at(22, 10, 30),
				})
				.returning({ id: aiRun.id });

			const { extracted, fieldConfidence } = buildExtraction(item);
			await tx.insert(evidenceExtraction).values({
				evidenceId: row.id,
				aiRunId: extractionRun?.id ?? null,
				version: 1,
				isCurrent: true,
				extracted,
				fieldConfidence,
				limitationsNote: item.limitationsNote,
			});

			const checks = deriveContextChecks({
				hasArtifact: item.assets.length > 0,
				platform: item.platform,
				contentText: item.contentText,
				occurredAt: item.occurredAt,
				occurredAtPrecision: item.occurredAtPrecision,
				sourceUrl: item.sourceUrl,
				targetContext: item.targetContext,
				contentSurface: item.contentSurface,
				parentEvidenceId,
				parentContextUrl: item.parentContextUrl,
				parentContextSummary: item.parentContextSummary,
				captureMethod: item.captureMethod,
			});

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
			if (score !== null) scores.push(score);
			await tx
				.update(evidence)
				.set({
					contextIntegrityScore: score,
					contextIntegrityComputedAt: at(22, 10, 35),
				})
				.where(eq(evidence.id, row.id));

			for (const entry of item.classifications) {
				const [suggestion] = await tx
					.insert(classification)
					.values({
						evidenceId: row.id,
						category: entry.category,
						authorKind: "ai",
						aiRunId: classificationRun.id,
						claim: entry.claim,
						rationale: entry.rationale,
						supportingQuote: entry.supportingQuote,
						quoteStart:
							entry.supportingQuote && item.contentText
								? item.contentText.indexOf(entry.supportingQuote)
								: null,
						quoteEnd:
							entry.supportingQuote && item.contentText
								? item.contentText.indexOf(entry.supportingQuote) +
									entry.supportingQuote.length
								: null,
						confidence: entry.confidence,
						reviewStatus: entry.reviewStatus,
						reviewerNote: entry.reviewerNote,
						reviewedBy:
							entry.reviewStatus === "pending_review" ? null : ownerId,
						reviewedAt:
							entry.reviewStatus === "pending_review" ? null : at(22, 11, 5),
					})
					.returning({ id: classification.id });

				if (entry.replacedBy && suggestion) {
					await tx.insert(classification).values({
						evidenceId: row.id,
						category: entry.replacedBy.category,
						authorKind: "human",
						claim: entry.replacedBy.claim,
						rationale: entry.replacedBy.rationale,
						confidence: "medium",
						reviewStatus: "confirmed",
						reviewerNote: entry.replacedBy.reviewerNote,
						reviewedBy: ownerId,
						reviewedAt: at(22, 11, 12),
						supersedesId: suggestion.id,
					});
				}
			}

			for (const review of item.fieldReviews) {
				await tx.insert(evidenceFieldReview).values({
					evidenceId: row.id,
					field: review.field,
					originalValue: review.originalValue,
					reviewedValue: review.reviewedValue,
					decision: review.decision,
					note: review.note,
					reviewedBy: ownerId,
				});
			}

			for (const entry of item.redactions) {
				await tx.insert(redaction).values({
					evidenceId: row.id,
					evidenceAssetId: entry.onRedactedAsset
						? (assetIds.get("redacted") ?? null)
						: (assetIds.get("original") ?? null),
					kind: entry.kind,
					status: entry.status,
					location:
						entry.kind === "face"
							? { type: "image_region", x: 48, y: 120, width: 96, height: 96 }
							: { type: "field", field: "displayed_account_handle" },
					detectedBy: "ai",
					confidence: entry.confidence,
					reason: entry.reason,
					decidedBy: entry.status === "suggested" ? null : ownerId,
					decidedAt: entry.status === "suggested" ? null : at(22, 11, 30),
				});
			}
		}

		for (const entry of PATTERNS) {
			const linked = entry.links
				.map((link) => evidenceIds.get(link.label))
				.filter((id): id is string => Boolean(id));
			if (linked.length === 0) continue;

			const observed = EVIDENCE.filter(
				(item) =>
					entry.links.some((link) => link.label === item.label) &&
					item.occurredAt !== null,
			).map((item) => item.occurredAt as Date);

			const [row] = await tx
				.insert(pattern)
				.values({
					incidentId: created.id,
					kind: entry.kind,
					name: entry.name,
					description: entry.description,
					authorKind: "ai",
					aiRunId: patternRun.id,
					confidence: entry.confidence,
					status: entry.status,
					reviewerNote: entry.reviewerNote,
					reviewedBy: entry.status === "confirmed" ? ownerId : null,
					reviewedAt: entry.status === "confirmed" ? at(22, 11, 45) : null,
					firstObservedAt:
						observed.length > 0
							? new Date(Math.min(...observed.map((d) => d.getTime())))
							: null,
					lastObservedAt:
						observed.length > 0
							? new Date(Math.max(...observed.map((d) => d.getTime())))
							: null,
				})
				.returning({ id: pattern.id });

			if (!row) continue;

			await tx.insert(patternEvidence).values(
				entry.links
					.filter((link) => evidenceIds.has(link.label))
					.map((link) => ({
						patternId: row.id,
						evidenceId: evidenceIds.get(link.label) as string,
						note: link.note,
						addedBy: ownerId,
					})),
			);
		}

		await tx.insert(routingAction).values([
			{
				incidentId: created.id,
				kind: "preserve_evidence",
				status: "completed",
				rationale:
					"Two items are on surfaces that expire or can be deleted. Captures and hashes were stored before anything else.",
				createdBy: ownerId,
				completedAt: at(22, 12, 0),
			},
			{
				incidentId: created.id,
				evidenceId: evidenceIds.get("dm-implied-threat") ?? null,
				kind: "urgent_human_escalation",
				status: "in_progress",
				rationale:
					"Private message references the building and closing time two days before a public event. A second reviewer is needed before the packet is shared, and the coordinator has been advised to contact local police directly.",
				assignedTo: ownerId,
				dueAt: at(22, 18, 0),
				createdBy: ownerId,
			},
			{
				incidentId: created.id,
				evidenceId: evidenceIds.get("reply-dehumanization") ?? null,
				kind: "platform_report_preparation",
				status: "proposed",
				rationale:
					"Dehumanising language in a public reply is the clearest single item to report, and the account is still active.",
				targetPlatform: "x",
				platformPolicyReference: "Hateful conduct — dehumanising speech",
				createdBy: ownerId,
			},
			{
				incidentId: created.id,
				kind: "community_packet",
				status: "proposed",
				rationale:
					"The centre's trustees asked for a summary they can read before the open day. Redacted assets only.",
				createdBy: ownerId,
			},
		]);

		const incidentScore =
			scores.length > 0
				? Math.round(
						scores.reduce((sum, value) => sum + value, 0) / scores.length,
					)
				: null;

		const timestamps = EVIDENCE.map((item) => item.occurredAt).filter(
			(value): value is Date => value !== null,
		);

		await tx
			.update(incident)
			.set({
				contextIntegrityScore: incidentScore,
				contextIntegrityComputedAt: at(22, 10, 35),
				windowStartAt: new Date(
					Math.min(...timestamps.map((value) => value.getTime())),
				),
				windowEndAt: new Date(
					Math.max(...timestamps.map((value) => value.getTime())),
				),
				summaryDraft:
					"Following the centre's open day announcement on 20 August, twelve items were collected across X, Instagram, and TikTok. Content includes collective blame, dehumanising language, exclusion rhetoric, and two direct messages, one of which references the building and its closing time.",
				summaryApproved:
					"Between 20 and 22 August 2026, Crescent Community Centre received hostile replies and direct messages after announcing a public open day. Twelve evidence items were documented across three platforms. Six were categorised after human review, including collective blame, dehumanising language, exclusion rhetoric, and targeted harassment. One direct message referencing the building and its closing time has been escalated for urgent human review. Two items lack the context needed to support any finding and are recorded as such.",
				summaryApprovedBy: ownerId,
				summaryApprovedAt: at(22, 12, 15),
			})
			.where(eq(incident.id, created.id));

		return { referenceCode, evidenceCount: EVIDENCE.length, incidentScore };
	});

	console.log(
		`Seeded ${result.referenceCode}: ${result.evidenceCount} evidence items, context integrity ${result.incidentScore ?? "n/a"}%.`,
	);
}

seed()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
