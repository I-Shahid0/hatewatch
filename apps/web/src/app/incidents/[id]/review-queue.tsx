"use client";

import type { AppRouterClient } from "@hate_evidence_copilot/api/routers/index";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { formatEnum, Panel, Stamp } from "@/components/hw";
import { client, orpc } from "@/utils/orpc";

type IncidentDetail = Awaited<ReturnType<AppRouterClient["incident"]["get"]>>;
type EvidenceRow = IncidentDetail["evidence"][number];
type ClassificationRow = EvidenceRow["classifications"][number];

type QueueEntry = {
	classification: ClassificationRow;
	evidenceId: string;
	sequenceNumber: number;
	priority: boolean;
};

type QuickDecision =
	| "confirmed"
	| "marked_insufficient_context"
	| "marked_not_relevant";

const QUEUE_BUTTON =
	"px-1.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

/**
 * Every classification still waiting on a human, across all exhibits.
 * Priority-flagged evidence surfaces first; anything needing a rewrite is
 * one click away on the verification screen.
 */
export default function ReviewQueue({
	incidentId,
	evidence,
}: {
	incidentId: string;
	evidence: EvidenceRow[];
}) {
	const queryClient = useQueryClient();
	const [pendingId, setPendingId] = useState<string | null>(null);

	const queue: QueueEntry[] = evidence
		.flatMap((item) =>
			item.classifications
				.filter((c) => c.reviewStatus === "pending_review")
				.map((classification) => ({
					classification,
					evidenceId: item.id,
					sequenceNumber: item.sequenceNumber,
					priority: item.needsPriorityReview,
				})),
		)
		.sort((a, b) =>
			a.priority === b.priority
				? a.sequenceNumber - b.sequenceNumber
				: a.priority
					? -1
					: 1,
		);

	const review = useMutation({
		mutationFn: (input: {
			classificationId: string;
			decision: QuickDecision;
		}) => client.classification.review(input),
		onSuccess: async () => {
			setPendingId(null);
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.incident.get.key({ input: { id: incidentId } }),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.evidence.list.key({
						input: { incidentId, order: "timeline" },
					}),
				}),
			]);
		},
		onError: (error) => {
			setPendingId(null);
			toast.error(error.message || "Could not save the review.");
		},
	});

	function decide(entry: QueueEntry, decision: QuickDecision) {
		setPendingId(entry.classification.id);
		review.mutate({ classificationId: entry.classification.id, decision });
	}

	return (
		<Panel
			title="review queue"
			aside={<Stamp tone={queue.length ? "warn" : "ok"}>{queue.length}</Stamp>}
			bodyClassName="space-y-3 p-3"
		>
			{queue.length === 0 ? (
				<p className="text-muted-foreground text-xs leading-relaxed">
					Nothing waiting on review. Reviewed classifications are what flow into
					the evidence packet.
				</p>
			) : (
				queue.map((entry) => {
					const c = entry.classification;
					const busy = pendingId === c.id && review.isPending;

					return (
						<article
							key={c.id}
							className={
								entry.priority
									? "border border-signal-gap/60 bg-signal-gap/5 p-2.5"
									: "border border-rule p-2.5"
							}
						>
							<div className="flex flex-wrap items-center gap-1.5">
								<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
									exhibit {String(entry.sequenceNumber).padStart(2, "0")}
								</span>
								{entry.priority && <Stamp tone="gap">priority</Stamp>}
								<Stamp tone="info">{formatEnum(c.category)}</Stamp>
								<span className="hw-label ml-auto">
									{c.authorKind === "ai" ? "ai suggestion" : "human entry"}
								</span>
							</div>

							<p className="mt-2 text-[12px] leading-snug">{c.claim}</p>

							<div className="mt-2 flex flex-wrap items-center gap-1 border-rule/60 border-t pt-2">
								<button
									type="button"
									className={QUEUE_BUTTON}
									disabled={busy}
									onClick={() => decide(entry, "confirmed")}
								>
									✓ confirm
								</button>
								<button
									type="button"
									className={QUEUE_BUTTON}
									disabled={busy}
									onClick={() => decide(entry, "marked_insufficient_context")}
								>
									? insufficient
								</button>
								<button
									type="button"
									className={QUEUE_BUTTON}
									disabled={busy}
									onClick={() => decide(entry, "marked_not_relevant")}
								>
									∅ not relevant
								</button>
								<Link
									href={
										`/incidents/${incidentId}/evidence/${entry.evidenceId}` as Route
									}
									className="ml-auto font-mono text-[10px] text-primary-ink uppercase tracking-[0.12em] underline underline-offset-4"
								>
									open →
								</Link>
							</div>
						</article>
					);
				})
			)}
		</Panel>
	);
}
