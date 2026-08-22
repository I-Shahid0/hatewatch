import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { aiRun } from "./ai";
import { user } from "./auth";
import { primaryId, timestamps } from "./columns";
import { actorKindEnum, auditEntityEnum } from "./enums";
import { incident } from "./incident";

/**
 * Append-only record of every modification, whoever made it.
 *
 * `evidence_field_review` is the reviewer-facing trail for field verification;
 * this is the system-wide one, and it covers actions with no field of their own:
 * status changes, routing decisions, packet generation, AI runs accepted or
 * rejected.
 *
 * The entity reference is intentionally loose — `entityId` is text so it can
 * hold both UUID domain ids and Better Auth's text ids — so writes here must
 * never be the only place a fact is stored.
 */
export const auditEvent = pgTable(
	"audit_event",
	{
		id: primaryId(),
		/** Scoping to an incident keeps the activity feed a single indexed read. */
		incidentId: uuid("incident_id").references(() => incident.id, {
			onDelete: "cascade",
		}),

		actorKind: actorKindEnum("actor_kind").notNull(),
		actorUserId: text("actor_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		aiRunId: uuid("ai_run_id").references(() => aiRun.id, {
			onDelete: "set null",
		}),

		/** Dotted verb, e.g. `evidence.verified`, `pattern.rejected`, `packet.generated`. */
		action: text("action").notNull(),
		entityType: auditEntityEnum("entity_type").notNull(),
		entityId: text("entity_id").notNull(),

		valueBefore: jsonb("value_before").$type<Record<string, unknown>>(),
		valueAfter: jsonb("value_after").$type<Record<string, unknown>>(),
		note: text("note"),

		createdAt: timestamps().createdAt,
	},
	(table) => [
		index("audit_event_incident_idx").on(table.incidentId, table.createdAt),
		index("audit_event_entity_idx").on(table.entityType, table.entityId),
		index("audit_event_actor_idx").on(table.actorUserId),
	],
);

export type AuditEvent = typeof auditEvent.$inferSelect;
export type NewAuditEvent = typeof auditEvent.$inferInsert;
