import { incident } from "@hate_evidence_copilot/db";
import { eq, or } from "@hate_evidence_copilot/db/sql";

/**
 * Which incidents a signed-in advocate may read.
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
