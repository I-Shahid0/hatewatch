"use client";

import type { AppRouterClient } from "@hate_evidence_copilot/api/routers/index";
import { Button } from "@hate_evidence_copilot/ui/components/button";
import { Input } from "@hate_evidence_copilot/ui/components/input";
import { Textarea } from "@hate_evidence_copilot/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FIELD, Field, TEXTAREA } from "@/components/field";
import {
	ConfidenceStamp,
	formatEnum,
	ReviewStamp,
	Stamp,
} from "@/components/hw";
import { client, orpc } from "@/utils/orpc";

type EvidenceDetail = Awaited<ReturnType<AppRouterClient["evidence"]["get"]>>;
type ClassificationRow = NonNullable<EvidenceDetail>["classifications"][number];

export const CATEGORIES = [
	"explicit_anti_muslim_hostility",
	"collective_blame",
	"dehumanization",
	"exclusion_rhetoric",
	"conspiracy_narrative",
	"threatening_language",
	"targeted_harassment",
	"institution_targeting",
	"coded_or_ambiguous_rhetoric",
	"no_apparent_hate_indicators",
	"other_uncertain",
	"insufficient_context",
] as const;

type Category = (typeof CATEGORIES)[number];

type ReviewDecision =
	| "confirmed"
	| "changed"
	| "marked_insufficient_context"
	| "marked_not_relevant";

type FormValues = {
	category: Category;
	claim: string;
	rationale: string;
	supportingQuote: string;
};

const EMPTY_FORM: FormValues = {
	category: "explicit_anti_muslim_hostility",
	claim: "",
	rationale: "",
	supportingQuote: "",
};

/** Claim → category → reason → optional quote. Shared by add and change. */
function ClassificationForm({
	initial,
	busy,
	submitLabel,
	onSubmit,
	onCancel,
}: {
	initial: FormValues;
	busy: boolean;
	submitLabel: string;
	onSubmit: (values: FormValues) => void;
	onCancel: () => void;
}) {
	const [values, setValues] = useState<FormValues>(initial);
	const set = (patch: Partial<FormValues>) =>
		setValues((prev) => ({ ...prev, ...patch }));

	return (
		<form
			className="space-y-3 border border-rule border-dashed bg-surface-2/40 p-3"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit(values);
			}}
		>
			<Field label="Category" htmlFor="classification-category">
				<select
					id="classification-category"
					className={FIELD}
					value={values.category}
					onChange={(event) =>
						set({ category: event.target.value as Category })
					}
				>
					{CATEGORIES.map((value) => (
						<option key={value} value={value}>
							{formatEnum(value)}
						</option>
					))}
				</select>
			</Field>

			<Field
				label="Claim"
				htmlFor="classification-claim"
				hint="One sentence: what this content does, as documented — never who the person is."
			>
				<Input
					id="classification-claim"
					className={FIELD}
					value={values.claim}
					onChange={(event) => set({ claim: event.target.value })}
					placeholder="e.g. This post attributes the actions of individuals to Muslims as a group."
					required
				/>
			</Field>

			<Field
				label="Rationale"
				htmlFor="classification-rationale"
				hint="Why this category fits — the reasoning a reviewer or court could follow."
			>
				<Textarea
					id="classification-rationale"
					className={TEXTAREA}
					value={values.rationale}
					onChange={(event) => set({ rationale: event.target.value })}
					required
				/>
			</Field>

			<Field
				label="Supporting quote (optional)"
				htmlFor="classification-quote"
				hint="The exact words relied on, copied from the verified text."
			>
				<Input
					id="classification-quote"
					className={FIELD}
					value={values.supportingQuote}
					onChange={(event) => set({ supportingQuote: event.target.value })}
				/>
			</Field>

			<div className="flex items-center gap-2">
				<Button type="submit" size="xs" disabled={busy}>
					{busy ? "Saving…" : submitLabel}
				</Button>
				<Button
					type="button"
					size="xs"
					variant="ghost"
					disabled={busy}
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</form>
	);
}

const QUEUE_BUTTON =
	"px-1.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

/**
 * The classification register for one exhibit: every category on record, the
 * review actions for pending rows, and the human-authored entry form. Humans
 * own these rows — AI suggestions only ever arrive as `pending_review`.
 */
export default function ClassificationPanel({
	incidentId,
	evidenceId,
	classifications,
}: {
	incidentId: string;
	evidenceId: string;
	classifications: ClassificationRow[];
}) {
	const queryClient = useQueryClient();
	const [adding, setAdding] = useState(false);
	const [changingId, setChangingId] = useState<string | null>(null);
	const [pendingId, setPendingId] = useState<string | null>(null);

	async function invalidate() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: orpc.evidence.get.key({ input: { id: evidenceId } }),
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.evidence.list.key({
					input: { incidentId, order: "timeline" },
				}),
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.incident.get.key({ input: { id: incidentId } }),
			}),
		]);
	}

	const create = useMutation({
		mutationFn: (values: FormValues) =>
			client.classification.create({
				evidenceId,
				category: values.category,
				claim: values.claim.trim(),
				rationale: values.rationale.trim(),
				supportingQuote: values.supportingQuote.trim() || undefined,
			}),
		onSuccess: async () => {
			toast.success("Classification recorded");
			setAdding(false);
			await invalidate();
		},
		onError: (error) => {
			setPendingId(null);
			toast.error(error.message || "Could not save the classification.");
		},
	});

	const review = useMutation({
		mutationFn: (input: {
			classificationId: string;
			decision: ReviewDecision;
			replacement?: {
				category: Category;
				claim: string;
				rationale: string;
				supportingQuote?: string;
			};
		}) => client.classification.review(input),
		onSuccess: async () => {
			setChangingId(null);
			setPendingId(null);
			await invalidate();
		},
		onError: (error) => {
			setPendingId(null);
			toast.error(error.message || "Could not save the review.");
		},
	});

	function decide(classificationId: string, decision: ReviewDecision) {
		setPendingId(classificationId);
		review.mutate({ classificationId, decision });
	}

	return (
		<section className="mt-6">
			<div className="flex items-baseline justify-between border-rule border-b pb-2">
				<h2 className="hw-label text-foreground/80">
					classifications · {classifications.length}
				</h2>
				<button
					type="button"
					className="hw-label text-primary-ink transition-colors hover:text-foreground"
					onClick={() => setAdding((open) => !open)}
				>
					{adding ? "− cancel" : "+ add classification"}
				</button>
			</div>

			<div className="mt-3 space-y-3">
				{classifications.length === 0 && !adding && (
					<p className="border border-rule border-dashed bg-surface-2/50 px-4 py-6 text-center text-muted-foreground text-xs">
						No categories on record. A human-reviewed classification is what
						carries findings into the evidence packet.
					</p>
				)}

				{classifications.map((c) => {
					const pending = c.reviewStatus === "pending_review";
					const busy =
						pendingId === c.id && (review.isPending || create.isPending);

					return (
						<article key={c.id} className="border border-rule bg-card p-3">
							<div className="flex flex-wrap items-center gap-1.5">
								<Stamp tone="info">{formatEnum(c.category)}</Stamp>
								<ConfidenceStamp confidence={c.confidence} />
								<ReviewStamp status={c.reviewStatus} />
								<span className="hw-label ml-auto">
									{c.authorKind === "ai" ? "ai suggestion" : "human entry"}
								</span>
							</div>

							<p className="mt-2 font-medium text-[13px] leading-snug">
								{c.claim}
							</p>
							{c.supportingQuote && (
								<p className="mt-1.5 font-mono text-[11px] text-foreground/75">
									“{c.supportingQuote}”
								</p>
							)}
							<p className="mt-1.5 text-[12px] text-muted-foreground leading-snug">
								{c.rationale}
							</p>
							{c.reviewerNote && (
								<p className="mt-1.5 border-rule border-l-2 pl-2.5 text-[12px] text-muted-foreground leading-snug">
									<span className="hw-label mr-1">reviewer</span>
									{c.reviewerNote}
								</p>
							)}

							{pending && (
								<div className="mt-2.5 flex flex-wrap items-center gap-1 border-rule/60 border-t pt-2.5">
									<button
										type="button"
										className={QUEUE_BUTTON}
										disabled={busy}
										onClick={() => decide(c.id, "confirmed")}
									>
										✓ confirm
									</button>
									<button
										type="button"
										className={QUEUE_BUTTON}
										disabled={busy}
										onClick={() => setChangingId(c.id)}
									>
										✎ change
									</button>
									<button
										type="button"
										className={QUEUE_BUTTON}
										disabled={busy}
										onClick={() => decide(c.id, "marked_insufficient_context")}
									>
										? insufficient context
									</button>
									<button
										type="button"
										className={QUEUE_BUTTON}
										disabled={busy}
										onClick={() => decide(c.id, "marked_not_relevant")}
									>
										∅ not relevant
									</button>
									{busy && <span className="hw-label px-1.5">saving…</span>}
								</div>
							)}

							{changingId === c.id && (
								<div className="mt-3">
									<ClassificationForm
										initial={{
											category: c.category as Category,
											claim: c.claim,
											rationale: c.rationale,
											supportingQuote: c.supportingQuote ?? "",
										}}
										busy={review.isPending}
										submitLabel="Save change"
										onCancel={() => setChangingId(null)}
										onSubmit={(values) => {
											setPendingId(c.id);
											review.mutate({
												classificationId: c.id,
												decision: "changed",
												replacement: {
													category: values.category,
													claim: values.claim.trim(),
													rationale: values.rationale.trim(),
													supportingQuote:
														values.supportingQuote.trim() || undefined,
												},
											});
										}}
									/>
								</div>
							)}
						</article>
					);
				})}

				{adding && (
					<ClassificationForm
						initial={EMPTY_FORM}
						busy={create.isPending}
						submitLabel="Record classification"
						onCancel={() => setAdding(false)}
						onSubmit={(values) => create.mutate(values)}
					/>
				)}
			</div>
		</section>
	);
}
