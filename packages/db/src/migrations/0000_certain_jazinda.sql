CREATE TYPE "public"."actor_kind" AS ENUM('user', 'system', 'ai');--> statement-breakpoint
CREATE TYPE "public"."ai_run_status" AS ENUM('pending', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_task" AS ENUM('evidence_extraction', 'pii_scan', 'classification_suggestion', 'pattern_analysis', 'summary_draft', 'translation');--> statement-breakpoint
CREATE TYPE "public"."audit_entity" AS ENUM('incident', 'evidence', 'evidence_asset', 'evidence_extraction', 'evidence_field_review', 'evidence_context_check', 'classification', 'pattern', 'pattern_evidence', 'redaction', 'routing_action', 'evidence_packet');--> statement-breakpoint
CREATE TYPE "public"."author_kind" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."capture_method" AS ENUM('device_screenshot', 'browser_screenshot', 'platform_data_export', 'archive_service', 'forwarded_by_target', 'manual_transcription', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."classification_category" AS ENUM('explicit_anti_muslim_hostility', 'collective_blame', 'dehumanization', 'exclusion_rhetoric', 'conspiracy_narrative', 'threatening_language', 'targeted_harassment', 'institution_targeting', 'coded_or_ambiguous_rhetoric', 'no_apparent_hate_indicators', 'other_uncertain', 'insufficient_context');--> statement-breakpoint
CREATE TYPE "public"."classification_review_status" AS ENUM('pending_review', 'confirmed', 'changed', 'marked_insufficient_context', 'marked_not_relevant');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'low', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."content_surface" AS ENUM('public_post', 'reply', 'comment', 'quote_post', 'repost', 'story', 'direct_message', 'group_chat', 'live_stream', 'profile', 'review', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."context_element" AS ENUM('evidence_artifact', 'platform', 'content_text', 'timestamp', 'source_url', 'target_context', 'parent_context', 'capture_provenance');--> statement-breakpoint
CREATE TYPE "public"."context_element_status" AS ENUM('present', 'missing', 'unknown', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."evidence_asset_role" AS ENUM('original', 'redacted', 'thumbnail', 'extracted_text');--> statement-breakpoint
CREATE TYPE "public"."evidence_field" AS ENUM('platform', 'content_surface', 'source_url', 'displayed_account_handle', 'displayed_account_display_name', 'content_text', 'content_language', 'occurred_at', 'occurred_at_timezone', 'capture_method', 'target_context', 'parent_context_url', 'parent_context_summary');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('screenshot', 'screen_recording', 'pasted_text', 'url', 'document', 'audio', 'other');--> statement-breakpoint
CREATE TYPE "public"."incident_priority" AS ENUM('standard', 'needs_attention', 'priority_review');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('draft', 'intake', 'in_review', 'awaiting_human_review', 'ready_to_export', 'exported', 'closed');--> statement-breakpoint
CREATE TYPE "public"."packet_format" AS ENUM('pdf', 'json');--> statement-breakpoint
CREATE TYPE "public"."packet_status" AS ENUM('draft', 'generated', 'failed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."pattern_kind" AS ENUM('repetition', 'possible_coordination_indicators', 'escalation', 'cross_platform_spread', 'public_to_private_shift', 'coded_language_shift', 'recurring_account_behaviour', 'other');--> statement-breakpoint
CREATE TYPE "public"."pattern_status" AS ENUM('suggested', 'under_review', 'confirmed', 'marked_insufficient_context', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('x', 'instagram', 'tiktok', 'facebook', 'threads', 'youtube', 'reddit', 'snapchat', 'twitch', 'linkedin', 'discord', 'telegram', 'whatsapp', 'sms', 'email', 'forum', 'news_comments', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."redaction_kind" AS ENUM('face', 'personal_name', 'account_handle', 'phone_number', 'email_address', 'physical_address', 'government_id', 'minor_identifier', 'health_information', 'unrelated_bystander', 'other_personal_information');--> statement-breakpoint
CREATE TYPE "public"."redaction_status" AS ENUM('suggested', 'applied', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."reporting_context" AS ENUM('supporting_someone_else', 'documenting_own_experience', 'community_monitoring', 'third_party_referral');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('confirmed', 'edited', 'marked_uncertain', 'marked_unavailable');--> statement-breakpoint
CREATE TYPE "public"."routing_action_kind" AS ENUM('preserve_evidence', 'platform_report_preparation', 'community_packet', 'urgent_human_escalation', 'support_referral', 'other');--> statement-breakpoint
CREATE TYPE "public"."routing_action_status" AS ENUM('proposed', 'in_progress', 'completed', 'declined', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."safety_review_status" AS ENUM('not_flagged', 'needs_human_review', 'under_human_review', 'reviewed_no_action', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('individual', 'group_of_people', 'mosque_or_islamic_institution', 'community_organization', 'business', 'event', 'online_community', 'other', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."time_precision" AS ENUM('exact', 'minute', 'hour', 'day', 'approximate', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('uploaded', 'extracting', 'extraction_failed', 'needs_verification', 'partially_verified', 'verified', 'marked_uncertain', 'excluded');--> statement-breakpoint
CREATE TABLE "ai_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid,
	"evidence_id" uuid,
	"task" "ai_task" NOT NULL,
	"status" "ai_run_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_digest" text,
	"output" jsonb,
	"error_message" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"cost_usd" numeric(12, 6),
	"triggered_by" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_extraction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"ai_run_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"extracted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_confidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"limitations_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"category" "classification_category" NOT NULL,
	"author_kind" "author_kind" NOT NULL,
	"ai_run_id" uuid,
	"claim" text NOT NULL,
	"rationale" text NOT NULL,
	"supporting_quote" text,
	"quote_start" integer,
	"quote_end" integer,
	"confidence" "confidence_level" DEFAULT 'unavailable' NOT NULL,
	"review_status" "classification_review_status" DEFAULT 'pending_review' NOT NULL,
	"reviewer_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classification_quote_span_order" CHECK ("classification"."quote_start" is null or "classification"."quote_end" is null or "classification"."quote_start" <= "classification"."quote_end"),
	CONSTRAINT "classification_ai_rows_have_a_run" CHECK ("classification"."author_kind" <> 'ai' or "classification"."ai_run_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "pattern" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"kind" "pattern_kind" NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"author_kind" "author_kind" NOT NULL,
	"ai_run_id" uuid,
	"confidence" "confidence_level" DEFAULT 'unavailable' NOT NULL,
	"status" "pattern_status" DEFAULT 'suggested' NOT NULL,
	"reviewer_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"first_observed_at" timestamp with time zone,
	"last_observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pattern_ai_rows_have_a_run" CHECK ("pattern"."author_kind" <> 'ai' or "pattern"."ai_run_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "pattern_evidence" (
	"pattern_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"note" text,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pattern_evidence_pattern_id_evidence_id_pk" PRIMARY KEY("pattern_id","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid,
	"actor_kind" "actor_kind" NOT NULL,
	"actor_user_id" text,
	"ai_run_id" uuid,
	"action" text NOT NULL,
	"entity_type" "audit_entity" NOT NULL,
	"entity_id" text NOT NULL,
	"value_before" jsonb,
	"value_after" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_context_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"element" "context_element" NOT NULL,
	"status" "context_element_status" DEFAULT 'missing' NOT NULL,
	"weight" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"verification_status" "verification_status" DEFAULT 'uploaded' NOT NULL,
	"platform" "platform" DEFAULT 'unknown' NOT NULL,
	"content_surface" "content_surface" DEFAULT 'unknown' NOT NULL,
	"source_url" text,
	"displayed_account_handle" text,
	"displayed_account_display_name" text,
	"content_text" text,
	"content_language" text,
	"occurred_at" timestamp with time zone,
	"occurred_at_timezone" text,
	"occurred_at_precision" time_precision DEFAULT 'unknown' NOT NULL,
	"captured_at" timestamp with time zone,
	"capture_method" "capture_method" DEFAULT 'unknown' NOT NULL,
	"capture_note" text,
	"parent_evidence_id" uuid,
	"parent_context_url" text,
	"parent_context_summary" text,
	"target_context" text,
	"advocate_note" text,
	"needs_priority_review" boolean DEFAULT false NOT NULL,
	"priority_review_reason" text,
	"context_integrity_score" integer,
	"context_integrity_computed_at" timestamp with time zone,
	"exclusion_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_context_integrity_score_range" CHECK ("evidence"."context_integrity_score" is null or ("evidence"."context_integrity_score" between 0 and 100)),
	CONSTRAINT "evidence_parent_is_not_self" CHECK ("evidence"."parent_evidence_id" is null or "evidence"."parent_evidence_id" <> "evidence"."id")
);
--> statement-breakpoint
CREATE TABLE "evidence_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"role" "evidence_asset_role" DEFAULT 'original' NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text,
	"mime_type" text,
	"byte_size" bigint,
	"width_px" integer,
	"height_px" integer,
	"sha256" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_field_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"field" "evidence_field" NOT NULL,
	"original_value" text,
	"reviewed_value" text,
	"decision" "review_decision" NOT NULL,
	"note" text,
	"reviewed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" serial NOT NULL,
	"reference_code" text NOT NULL,
	"title" text NOT NULL,
	"situation_summary" text,
	"status" "incident_status" DEFAULT 'draft' NOT NULL,
	"priority" "incident_priority" DEFAULT 'standard' NOT NULL,
	"safety_review_status" "safety_review_status" DEFAULT 'not_flagged' NOT NULL,
	"safety_review_note" text,
	"target_type" "target_type" DEFAULT 'unknown' NOT NULL,
	"target_description" text,
	"reporting_context" "reporting_context" DEFAULT 'supporting_someone_else' NOT NULL,
	"declared_platforms" "platform"[] DEFAULT '{}' NOT NULL,
	"window_start_at" timestamp with time zone,
	"window_end_at" timestamp with time zone,
	"context_integrity_score" integer,
	"context_integrity_computed_at" timestamp with time zone,
	"summary_draft" text,
	"summary_approved" text,
	"summary_approved_by" text,
	"summary_approved_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text NOT NULL,
	"organization_name" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incident_context_integrity_score_range" CHECK ("incident"."context_integrity_score" is null or ("incident"."context_integrity_score" between 0 and 100)),
	CONSTRAINT "incident_window_order" CHECK ("incident"."window_start_at" is null or "incident"."window_end_at" is null or "incident"."window_start_at" <= "incident"."window_end_at")
);
--> statement-breakpoint
CREATE TABLE "redaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"evidence_asset_id" uuid,
	"kind" "redaction_kind" NOT NULL,
	"status" "redaction_status" DEFAULT 'suggested' NOT NULL,
	"location" jsonb,
	"detected_by" "author_kind" NOT NULL,
	"ai_run_id" uuid,
	"confidence" "confidence_level" DEFAULT 'unavailable' NOT NULL,
	"reason" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redaction_decisions_have_a_decider" CHECK ("redaction"."status" = 'suggested' or "redaction"."decided_by" is not null)
);
--> statement-breakpoint
CREATE TABLE "evidence_packet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"format" "packet_format" NOT NULL,
	"status" "packet_status" DEFAULT 'draft' NOT NULL,
	"redacted_assets_only" boolean DEFAULT true NOT NULL,
	"snapshot" jsonb,
	"approved_summary" text,
	"ai_disclosure" text NOT NULL,
	"storage_key" text,
	"checksum" text,
	"error_message" text,
	"generated_by" text NOT NULL,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_packet_generated_rows_have_a_file" CHECK ("evidence_packet"."status" <> 'generated' or ("evidence_packet"."storage_key" is not null and "evidence_packet"."snapshot" is not null))
);
--> statement-breakpoint
CREATE TABLE "routing_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"evidence_id" uuid,
	"kind" "routing_action_kind" NOT NULL,
	"status" "routing_action_status" DEFAULT 'proposed' NOT NULL,
	"rationale" text NOT NULL,
	"target_platform" "platform",
	"platform_policy_reference" text,
	"assigned_to" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_triggered_by_user_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_extraction" ADD CONSTRAINT "evidence_extraction_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_extraction" ADD CONSTRAINT "evidence_extraction_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification" ADD CONSTRAINT "classification_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification" ADD CONSTRAINT "classification_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification" ADD CONSTRAINT "classification_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification" ADD CONSTRAINT "classification_supersedes_id_classification_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."classification"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern" ADD CONSTRAINT "pattern_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern" ADD CONSTRAINT "pattern_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern" ADD CONSTRAINT "pattern_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_evidence" ADD CONSTRAINT "pattern_evidence_pattern_id_pattern_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."pattern"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_evidence" ADD CONSTRAINT "pattern_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pattern_evidence" ADD CONSTRAINT "pattern_evidence_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_context_check" ADD CONSTRAINT "evidence_context_check_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_parent_evidence_id_evidence_id_fk" FOREIGN KEY ("parent_evidence_id") REFERENCES "public"."evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_asset" ADD CONSTRAINT "evidence_asset_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_asset" ADD CONSTRAINT "evidence_asset_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_field_review" ADD CONSTRAINT "evidence_field_review_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_field_review" ADD CONSTRAINT "evidence_field_review_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_summary_approved_by_user_id_fk" FOREIGN KEY ("summary_approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident" ADD CONSTRAINT "incident_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redaction" ADD CONSTRAINT "redaction_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redaction" ADD CONSTRAINT "redaction_evidence_asset_id_evidence_asset_id_fk" FOREIGN KEY ("evidence_asset_id") REFERENCES "public"."evidence_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redaction" ADD CONSTRAINT "redaction_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redaction" ADD CONSTRAINT "redaction_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_packet" ADD CONSTRAINT "evidence_packet_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_packet" ADD CONSTRAINT "evidence_packet_generated_by_user_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_action" ADD CONSTRAINT "routing_action_incident_id_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_action" ADD CONSTRAINT "routing_action_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_action" ADD CONSTRAINT "routing_action_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_action" ADD CONSTRAINT "routing_action_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_run_incident_id_idx" ON "ai_run" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "ai_run_evidence_id_idx" ON "ai_run" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "ai_run_task_status_idx" ON "ai_run" USING btree ("task","status");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_extraction_version_idx" ON "evidence_extraction" USING btree ("evidence_id","version");--> statement-breakpoint
CREATE INDEX "evidence_extraction_current_idx" ON "evidence_extraction" USING btree ("evidence_id","is_current");--> statement-breakpoint
CREATE INDEX "classification_evidence_id_idx" ON "classification" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "classification_category_idx" ON "classification" USING btree ("category");--> statement-breakpoint
CREATE INDEX "classification_review_status_idx" ON "classification" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "classification_supersedes_id_idx" ON "classification" USING btree ("supersedes_id");--> statement-breakpoint
CREATE INDEX "pattern_incident_id_idx" ON "pattern" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "pattern_status_idx" ON "pattern" USING btree ("incident_id","status");--> statement-breakpoint
CREATE INDEX "pattern_evidence_evidence_id_idx" ON "pattern_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "audit_event_incident_idx" ON "audit_event" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_event_entity_idx" ON "audit_event" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_event_actor_idx" ON "audit_event" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_context_check_element_idx" ON "evidence_context_check" USING btree ("evidence_id","element");--> statement-breakpoint
CREATE INDEX "evidence_context_check_status_idx" ON "evidence_context_check" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_incident_sequence_idx" ON "evidence" USING btree ("incident_id","sequence_number");--> statement-breakpoint
CREATE INDEX "evidence_incident_id_idx" ON "evidence" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "evidence_timeline_idx" ON "evidence" USING btree ("incident_id","occurred_at");--> statement-breakpoint
CREATE INDEX "evidence_platform_idx" ON "evidence" USING btree ("incident_id","platform");--> statement-breakpoint
CREATE INDEX "evidence_verification_status_idx" ON "evidence" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "evidence_parent_evidence_id_idx" ON "evidence" USING btree ("parent_evidence_id");--> statement-breakpoint
CREATE INDEX "evidence_displayed_account_idx" ON "evidence" USING btree ("incident_id","platform","displayed_account_handle");--> statement-breakpoint
CREATE INDEX "evidence_asset_evidence_id_idx" ON "evidence_asset" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "evidence_asset_sha256_idx" ON "evidence_asset" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "evidence_field_review_evidence_field_idx" ON "evidence_field_review" USING btree ("evidence_id","field");--> statement-breakpoint
CREATE INDEX "evidence_field_review_reviewed_by_idx" ON "evidence_field_review" USING btree ("reviewed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_reference_code_idx" ON "incident" USING btree ("reference_code");--> statement-breakpoint
CREATE UNIQUE INDEX "incident_sequence_number_idx" ON "incident" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "incident_created_by_idx" ON "incident" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "incident_status_idx" ON "incident" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "incident_safety_review_status_idx" ON "incident" USING btree ("safety_review_status");--> statement-breakpoint
CREATE INDEX "redaction_evidence_id_idx" ON "redaction" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "redaction_status_idx" ON "redaction" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_packet_version_idx" ON "evidence_packet" USING btree ("incident_id","version","format");--> statement-breakpoint
CREATE INDEX "evidence_packet_incident_id_idx" ON "evidence_packet" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "routing_action_incident_id_idx" ON "routing_action" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "routing_action_status_idx" ON "routing_action" USING btree ("incident_id","status");--> statement-breakpoint
CREATE INDEX "routing_action_assigned_to_idx" ON "routing_action" USING btree ("assigned_to");