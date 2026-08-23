import { type Db, incident } from "@hate_evidence_copilot/db";
import { and, eq, or } from "@hate_evidence_copilot/db/sql";
import { ORPCError } from "@orpc/server";

/**
 * Which incidents a signed-in advocate may read or mutate.
 *
 * Real incidents are visible only to the advocate who created them: there is no
 * organisation or membership model yet, so ownership is the only boundary
 * available. Demo incidents are synthetic by definition and are shared with any
 * signed-in user so a freshly seeded database is not an empty dashboard.
 *
 * Replace this with a membership check when organisations exist.
 */
export function visibleIncidents(userId: string) {
	return or(eq(incident.createdBy, userId), eq(incident.isDemo, true));
}

/** Throws unless the signed-in advocate may read this incident. */
export async function assertIncidentVisible(
	db: Db,
	userId: string,
	incidentId: string,
) {
	const [row] = await db
		.select({ id: incident.id })
		.from(incident)
		.where(and(eq(incident.id, incidentId), visibleIncidents(userId)))
		.limit(1);

	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Incident not found." });
	}
}
