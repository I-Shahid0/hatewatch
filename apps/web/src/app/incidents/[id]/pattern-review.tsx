"use client";

import type { AppRouterClient } from "@hate_evidence_copilot/api/routers/index";
import { Input } from "@hate_evidence_copilot/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FIELD } from "@/components/field";
import {
	ConfidenceStamp,
	formatEnum,
	ReviewStamp,
	Stamp,
} from "@/components/hw";
import { client, orpc } from "@/utils/orpc";

type IncidentDetail = Awaited<ReturnType<AppRouterClient["incident"]["get"]>>;
type PatternRow = IncidentDetail["patterns"][number];

type PatternDecision = "confirmed" | "rejected" | "marked_insufficient_context";

const QUEUE_BUTTON =
	"px-1.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

/**
 * One suggested pattern with its human review controls. Confirm, reject, or
 * mark insufficient — the reviewer's note travels with the finding.
 */
export default function PatternCard({
	incidentId,
	pattern,
	sequenceById,
}: {
	incidentId: string;
	pattern: PatternRow;
	sequenceById: Map<string, number>;
}) {
	const queryClient = useQueryClient();
	const [note, setNote] = useState("");

	const reviewable =
		pattern.status === "suggested" || pattern.status === "under_review";

	const review = useMutation({
		mutationFn: (decision: PatternDecision) =>
			client.pattern.review({
				patternId: pattern.id,
				decision,
				note: note.trim() || undefined,
			}),
		onSuccess: async () => {
			setNote("");
			await queryClient.invalidateQueries({
				queryKey: orpc.incident.get.key({ input: { id: incidentId } }),
			});
		},
		onError: (error) => {
			toast.error(error.message || "Could not save the review.");
		},
	});

	return (
		<article className="border border-rule p-2.5">
			<div className="flex flex-wrap items-center gap-1.5">
				<Stamp tone="info">{formatEnum(pattern.kind)}</Stamp>
				<ConfidenceStamp confidence={pattern.confidence} />
				<ReviewStamp status={pattern.status} />
			</div>
			<h3 className="mt-2 font-medium text-[13px]">{pattern.name}</h3>
			<p className="mt-1 text-[12px] text-muted-foreground leading-snug">
				{pattern.description}
			</p>
			<p className="mt-2 font-mono text-[11px] text-foreground/70">
				exhibits{" "}
				{pattern.evidenceLinks
					.map((link) =>
						String(sequenceById.get(link.evidenceId) ?? "?").padStart(2, "0"),
					)
					.join(" · ") || "—"}
			</p>

			{pattern.reviewerNote && (
				<p className="mt-2 border-rule border-l-2 pl-2.5 text-[12px] text-muted-foreground leading-snug">
					<span className="hw-label mr-1">reviewer</span>
					{pattern.reviewerNote}
				</p>
			)}

			{reviewable && (
				<div className="mt-2.5 space-y-2 border-rule/60 border-t pt-2.5">
					<Input
						className={FIELD}
						value={note}
						onChange={(event) => setNote(event.target.value)}
						placeholder="Reviewer note (optional)"
						aria-label="Reviewer note"
					/>
					<div className="flex flex-wrap items-center gap-1">
						<button
							type="button"
							className={QUEUE_BUTTON}
							disabled={review.isPending}
							onClick={() => review.mutate("confirmed")}
						>
							✓ confirm
						</button>
						<button
							type="button"
							className={QUEUE_BUTTON}
							disabled={review.isPending}
							onClick={() => review.mutate("rejected")}
						>
							✕ reject
						</button>
						<button
							type="button"
							className={QUEUE_BUTTON}
							disabled={review.isPending}
							onClick={() => review.mutate("marked_insufficient_context")}
						>
							? insufficient
						</button>
						{review.isPending && (
							<span className="hw-label px-1.5">saving…</span>
						)}
					</div>
				</div>
			)}
		</article>
	);
}
