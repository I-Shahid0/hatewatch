import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { primaryId, timestamps } from "./columns";
import {
	packetFormatEnum,
	packetStatusEnum,
	platformEnum,
	routingActionKindEnum,
	routingActionStatusEnum,
} from "./enums";
import { evidence } from "./evidence";
import { incident } from "./incident";

/**
 * What the advocate decided to do next: preserve, prepare a platform report,
 * share a packet, or escalate for urgent human review.
 *
 * Routing is recorded as an explicit decision with a rationale. HateWatch never
 * contacts a platform or an authority on anyone's behalf.
 */
export const routingAction = pgTable(
	"routing_action",
	{
		id: primaryId(),
		incidentId: uuid("incident_id")
			.notNull()
			.references(() => incident.id, { onDelete: "cascade" }),
		/** Null when the action covers the whole incident rather than one item. */
		evidenceId: uuid("evidence_id").references(() => evidence.id, {
			onDelete: "cascade",
		}),

		kind: routingActionKindEnum("kind").notNull(),
		status: routingActionStatusEnum("status").default("proposed").notNull(),
		rationale: text("rationale").notNull(),

		/** For platform report preparation: which platform, and the rule cited. */
		targetPlatform: platformEnum("target_platform"),
		platformPolicyReference: text("platform_policy_reference"),

		assignedTo: text("assigned_to").references(() => user.id, {
			onDelete: "set null",
		}),
		dueAt: timestamp("due_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),

		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		...timestamps(),
	},
	(table) => [
		index("routing_action_incident_id_idx").on(table.incidentId),
		index("routing_action_status_idx").on(table.incidentId, table.status),
		index("routing_action_assigned_to_idx").on(table.assignedTo),
	],
);

/**
 * A generated evidence packet.
 *
 * `snapshot` freezes the verified fields, timeline, reviewed patterns, known
 * gaps, redaction record, and AI disclosure at generation time. Re-rendering an
 * old packet must not pick up later edits, and `checksum` lets a recipient prove
 * the file they hold is the one that was generated.
 */
export const evidencePacket = pgTable(
	"evidence_packet",
	{
		id: primaryId(),
		incidentId: uuid("incident_id")
			.notNull()
			.references(() => incident.id, { onDelete: "cascade" }),

		version: integer("version").default(1).notNull(),
		format: packetFormatEnum("format").notNull(),
		status: packetStatusEnum("status").default("draft").notNull(),

		/** Default posture: exports carry redacted assets unless deliberately overridden. */
		redactedAssetsOnly: boolean("redacted_assets_only").default(true).notNull(),

		snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
		/** The human-approved narrative as it read at generation time. */
		approvedSummary: text("approved_summary"),
		/** Which AI assistance was used, and what it was not used for. */
		aiDisclosure: text("ai_disclosure").notNull(),

		storageKey: text("storage_key"),
		checksum: text("checksum"),
		errorMessage: text("error_message"),

		generatedBy: text("generated_by")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		generatedAt: timestamp("generated_at", { withTimezone: true }),
		createdAt: timestamps().createdAt,
	},
	(table) => [
		uniqueIndex("evidence_packet_version_idx").on(
			table.incidentId,
			table.version,
			table.format,
		),
		index("evidence_packet_incident_id_idx").on(table.incidentId),
		check(
			"evidence_packet_generated_rows_have_a_file",
			sql`${table.status} <> 'generated' or (${table.storageKey} is not null and ${table.snapshot} is not null)`,
		),
	],
);

export type RoutingAction = typeof routingAction.$inferSelect;
export type NewRoutingAction = typeof routingAction.$inferInsert;
export type EvidencePacket = typeof evidencePacket.$inferSelect;
export type NewEvidencePacket = typeof evidencePacket.$inferInsert;
