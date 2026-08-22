import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Vocabulary for the whole domain.
 *
 * Two rules shape these lists:
 *
 * 1. `unknown` / `insufficient_context` are always real values. HateWatch
 *    records what is missing instead of guessing, and a missing value lowers
 *    Context Integrity rather than silently defaulting.
 * 2. Nothing here describes a person. Categories describe content, visible
 *    behaviour, and patterns between evidence.
 */

export const incidentStatusEnum = pgEnum("incident_status", [
	"draft",
	"intake",
	"in_review",
	"awaiting_human_review",
	"ready_to_export",
	"exported",
	"closed",
]);

/**
 * Deliberately not a risk score. "priority_review" means a human should look
 * sooner, not that the content has been judged.
 */
export const incidentPriorityEnum = pgEnum("incident_priority", [
	"standard",
	"needs_attention",
	"priority_review",
]);

export const safetyReviewStatusEnum = pgEnum("safety_review_status", [
	"not_flagged",
	"needs_human_review",
	"under_human_review",
	"reviewed_no_action",
	"escalated",
]);

/** What was targeted, as documented by the advocate — never inferred identity. */
export const targetTypeEnum = pgEnum("target_type", [
	"individual",
	"group_of_people",
	"mosque_or_islamic_institution",
	"community_organization",
	"business",
	"event",
	"online_community",
	"other",
	"unknown",
]);

export const reportingContextEnum = pgEnum("reporting_context", [
	"supporting_someone_else",
	"documenting_own_experience",
	"community_monitoring",
	"third_party_referral",
]);

export const platformEnum = pgEnum("platform", [
	"x",
	"instagram",
	"tiktok",
	"facebook",
	"threads",
	"youtube",
	"reddit",
	"snapchat",
	"twitch",
	"linkedin",
	"discord",
	"telegram",
	"whatsapp",
	"sms",
	"email",
	"forum",
	"news_comments",
	"other",
	"unknown",
]);

/** Where on the platform the content lived. Drives the public → private narrative. */
export const contentSurfaceEnum = pgEnum("content_surface", [
	"public_post",
	"reply",
	"comment",
	"quote_post",
	"repost",
	"story",
	"direct_message",
	"group_chat",
	"live_stream",
	"profile",
	"review",
	"other",
	"unknown",
]);

export const evidenceKindEnum = pgEnum("evidence_kind", [
	"screenshot",
	"screen_recording",
	"pasted_text",
	"url",
	"document",
	"audio",
	"other",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
	"uploaded",
	"extracting",
	"extraction_failed",
	"needs_verification",
	"partially_verified",
	"verified",
	"marked_uncertain",
	"excluded",
]);

/** Capture provenance: how the artifact came to exist. */
export const captureMethodEnum = pgEnum("capture_method", [
	"device_screenshot",
	"browser_screenshot",
	"platform_data_export",
	"archive_service",
	"forwarded_by_target",
	"manual_transcription",
	"unknown",
]);

/**
 * How precisely `occurred_at` is known. A screenshot showing "2h ago" is not the
 * same as a post with a full timestamp, and the export must not pretend it is.
 */
export const timePrecisionEnum = pgEnum("time_precision", [
	"exact",
	"minute",
	"hour",
	"day",
	"approximate",
	"unknown",
]);

/** Field-level confidence. No percentages, no fake precision. */
export const confidenceLevelEnum = pgEnum("confidence_level", [
	"high",
	"medium",
	"low",
	"unavailable",
]);

export const authorKindEnum = pgEnum("author_kind", ["ai", "human"]);

export const actorKindEnum = pgEnum("actor_kind", ["user", "system", "ai"]);

/** Evidence fields that can be extracted, confirmed, edited, or marked uncertain. */
export const evidenceFieldEnum = pgEnum("evidence_field", [
	"platform",
	"content_surface",
	"source_url",
	"displayed_account_handle",
	"displayed_account_display_name",
	"content_text",
	"content_language",
	"occurred_at",
	"occurred_at_timezone",
	"capture_method",
	"target_context",
	"parent_context_url",
	"parent_context_summary",
]);

export const reviewDecisionEnum = pgEnum("review_decision", [
	"confirmed",
	"edited",
	"marked_uncertain",
	"marked_unavailable",
]);

/** The Context Integrity checklist. Weights live in `context-integrity.ts`. */
export const contextElementEnum = pgEnum("context_element", [
	"evidence_artifact",
	"platform",
	"content_text",
	"timestamp",
	"source_url",
	"target_context",
	"parent_context",
	"capture_provenance",
]);

export const contextElementStatusEnum = pgEnum("context_element_status", [
	"present",
	"missing",
	"unknown",
	"not_applicable",
]);

export const classificationCategoryEnum = pgEnum("classification_category", [
	"explicit_anti_muslim_hostility",
	"collective_blame",
	"dehumanization",
	"exclusion_rhetoric",
	"conspiracy_narrative",
	"threatening_language",
	"targeted_harassment",
	"institution_targeting",
	"coded_or_ambiguous_rhetoric",
	"no_apparent_hate_indicators",
	"other_uncertain",
	"insufficient_context",
]);

export const classificationReviewStatusEnum = pgEnum(
	"classification_review_status",
	[
		"pending_review",
		"confirmed",
		"changed",
		"marked_insufficient_context",
		"marked_not_relevant",
	],
);

/** Patterns describe relationships between evidence, never campaigns as fact. */
export const patternKindEnum = pgEnum("pattern_kind", [
	"repetition",
	"possible_coordination_indicators",
	"escalation",
	"cross_platform_spread",
	"public_to_private_shift",
	"coded_language_shift",
	"recurring_account_behaviour",
	"other",
]);

export const patternStatusEnum = pgEnum("pattern_status", [
	"suggested",
	"under_review",
	"confirmed",
	"marked_insufficient_context",
	"rejected",
]);

export const aiTaskEnum = pgEnum("ai_task", [
	"evidence_extraction",
	"pii_scan",
	"classification_suggestion",
	"pattern_analysis",
	"summary_draft",
	"translation",
]);

export const aiRunStatusEnum = pgEnum("ai_run_status", [
	"pending",
	"running",
	"succeeded",
	"failed",
]);

export const evidenceAssetRoleEnum = pgEnum("evidence_asset_role", [
	"original",
	"redacted",
	"thumbnail",
	"extracted_text",
]);

export const redactionKindEnum = pgEnum("redaction_kind", [
	"face",
	"personal_name",
	"account_handle",
	"phone_number",
	"email_address",
	"physical_address",
	"government_id",
	"minor_identifier",
	"health_information",
	"unrelated_bystander",
	"other_personal_information",
]);

export const redactionStatusEnum = pgEnum("redaction_status", [
	"suggested",
	"applied",
	"dismissed",
]);

export const routingActionKindEnum = pgEnum("routing_action_kind", [
	"preserve_evidence",
	"platform_report_preparation",
	"community_packet",
	"urgent_human_escalation",
	"support_referral",
	"other",
]);

export const routingActionStatusEnum = pgEnum("routing_action_status", [
	"proposed",
	"in_progress",
	"completed",
	"declined",
	"blocked",
]);

export const packetFormatEnum = pgEnum("packet_format", ["pdf", "json"]);

export const packetStatusEnum = pgEnum("packet_status", [
	"draft",
	"generated",
	"failed",
	"superseded",
]);

export const auditEntityEnum = pgEnum("audit_entity", [
	"incident",
	"evidence",
	"evidence_asset",
	"evidence_extraction",
	"evidence_field_review",
	"evidence_context_check",
	"classification",
	"pattern",
	"pattern_evidence",
	"redaction",
	"routing_action",
	"evidence_packet",
]);

export type IncidentStatus = (typeof incidentStatusEnum.enumValues)[number];
export type IncidentPriority = (typeof incidentPriorityEnum.enumValues)[number];
export type SafetyReviewStatus =
	(typeof safetyReviewStatusEnum.enumValues)[number];
export type TargetType = (typeof targetTypeEnum.enumValues)[number];
export type ReportingContext = (typeof reportingContextEnum.enumValues)[number];
export type Platform = (typeof platformEnum.enumValues)[number];
export type ContentSurface = (typeof contentSurfaceEnum.enumValues)[number];
export type EvidenceKind = (typeof evidenceKindEnum.enumValues)[number];
export type VerificationStatus =
	(typeof verificationStatusEnum.enumValues)[number];
export type CaptureMethod = (typeof captureMethodEnum.enumValues)[number];
export type TimePrecision = (typeof timePrecisionEnum.enumValues)[number];
export type ConfidenceLevel = (typeof confidenceLevelEnum.enumValues)[number];
export type AuthorKind = (typeof authorKindEnum.enumValues)[number];
export type ActorKind = (typeof actorKindEnum.enumValues)[number];
export type EvidenceFieldName = (typeof evidenceFieldEnum.enumValues)[number];
export type ReviewDecision = (typeof reviewDecisionEnum.enumValues)[number];
export type ContextElement = (typeof contextElementEnum.enumValues)[number];
export type ContextElementStatus =
	(typeof contextElementStatusEnum.enumValues)[number];
export type ClassificationCategory =
	(typeof classificationCategoryEnum.enumValues)[number];
export type ClassificationReviewStatus =
	(typeof classificationReviewStatusEnum.enumValues)[number];
export type PatternKind = (typeof patternKindEnum.enumValues)[number];
export type PatternStatus = (typeof patternStatusEnum.enumValues)[number];
export type AiTask = (typeof aiTaskEnum.enumValues)[number];
export type AiRunStatus = (typeof aiRunStatusEnum.enumValues)[number];
export type EvidenceAssetRole =
	(typeof evidenceAssetRoleEnum.enumValues)[number];
export type RedactionKind = (typeof redactionKindEnum.enumValues)[number];
export type RedactionStatus = (typeof redactionStatusEnum.enumValues)[number];
export type RoutingActionKind =
	(typeof routingActionKindEnum.enumValues)[number];
export type RoutingActionStatus =
	(typeof routingActionStatusEnum.enumValues)[number];
export type PacketFormat = (typeof packetFormatEnum.enumValues)[number];
export type PacketStatus = (typeof packetStatusEnum.enumValues)[number];
export type AuditEntity = (typeof auditEntityEnum.enumValues)[number];
