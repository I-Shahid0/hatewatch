import { expect, test } from "bun:test";

import { statusTransition } from "./routing-status";

const NOW = new Date("2026-08-24T10:00:00.000Z");
const ACTOR = "user_advocate";
const HOLDER = "user_someone_else";

test("starting an unclaimed action assigns it to whoever started it", () => {
	const next = statusTransition("in_progress", null, ACTOR, NOW);

	expect(next.assignedTo).toBe(ACTOR);
	expect(next.completedAt).toBeNull();
});

test("starting an action never takes it off the person already holding it", () => {
	const next = statusTransition("in_progress", HOLDER, ACTOR, NOW);

	expect(next.assignedTo).toBe(HOLDER);
});

test("completing stamps the completion time", () => {
	const next = statusTransition("completed", HOLDER, ACTOR, NOW);

	expect(next.status).toBe("completed");
	expect(next.completedAt).toEqual(NOW);
	expect(next.assignedTo).toBe(HOLDER);
});

/**
 * The one that actually matters: a completed action that is reopened or
 * declined must lose its completion date. If it kept one, the packet would
 * carry a routing decision that reads as finished work when it is not.
 */
test("moving away from completed clears the completion time", () => {
	const statuses = ["proposed", "in_progress", "blocked", "declined"] as const;

	for (const status of statuses) {
		expect(statusTransition(status, HOLDER, ACTOR, NOW).completedAt).toBeNull();
	}
});
