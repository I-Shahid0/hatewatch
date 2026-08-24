import type { RoutingActionStatus } from "@hate_evidence_copilot/db";

/**
 * The two columns a routing status change derives rather than reads: who owns
 * the action, and whether it currently reads as completed.
 *
 * Taking something to `in_progress` claims it for whoever moved it, but never
 * takes it off the person already holding it. `completedAt` is cleared on any
 * move away from `completed`, so a reopened action cannot keep a stale
 * completion date and claim in the packet that work finished when it did not.
 *
 * Lives outside the router so the rule can be read and tested on its own —
 * importing a router pulls in the whole oRPC graph.
 */
export function statusTransition(
	next: RoutingActionStatus,
	assignedTo: string | null,
	actorId: string,
	now: Date = new Date(),
) {
	return {
		status: next,
		assignedTo: next === "in_progress" && !assignedTo ? actorId : assignedTo,
		completedAt: next === "completed" ? now : null,
	};
}
