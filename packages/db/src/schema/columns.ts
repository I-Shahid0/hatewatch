import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Helpers are factories rather than shared builder instances so each table gets
 * its own column builder.
 */

export const primaryId = () => uuid("id").defaultRandom().primaryKey();

/**
 * Domain timestamps are stored with a timezone: an incident chronology is
 * reconstructed across platforms, capture devices, and reader timezones, so a
 * naive local time is not enough.
 */
export const createdAt = () =>
	timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const updatedAt = () =>
	timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull();

export const timestamps = () => ({
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});
