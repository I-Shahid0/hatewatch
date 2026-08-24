"use client";

import type { AppRouterClient } from "@hate_evidence_copilot/api/routers/index";
import { Button } from "@hate_evidence_copilot/ui/components/button";
import { Input } from "@hate_evidence_copilot/ui/components/input";
import { Textarea } from "@hate_evidence_copilot/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FIELD, Field, TEXTAREA } from "@/components/field";
import { formatEnum, formatPlatform, Panel, Stamp } from "@/components/hw";
import { client, orpc } from "@/utils/orpc";

import { PLATFORMS } from "./evidence-inbox";

type IncidentDetail = Awaited<ReturnType<AppRouterClient["incident"]["get"]>>;
type RoutingRow = IncidentDetail["routingActions"][number];
type EvidenceRow = IncidentDetail["evidence"][number];
type RoutingStatus = RoutingRow["status"];
type RoutingKind = RoutingRow["kind"];

const KINDS = [
	"preserve_evidence",
	"platform_report_preparation",
	"community_packet",
	"urgent_human_escalation",
	"support_referral",
	"other",
] as const;

const STATUS_TONE = {
	proposed: "info",
	in_progress: "warn",
	completed: "ok",
	declined: "neutral",
	blocked: "gap",
} as const;

/** Where each status can go next, and the word on the button that takes it there. */
const NEXT: Record<RoutingStatus, Array<[RoutingStatus, string]>> = {
	proposed: [
		["in_progress", "▸ start"],
		["declined", "✕ decline"],
	],
	in_progress: [
		["completed", "✓ complete"],
		["blocked", "⏸ block"],
	],
	blocked: [
		["in_progress", "▸ resume"],
		["declined", "✕ decline"],
	],
	declined: [["proposed", "↺ reopen"]],
	completed: [],
};

/** Open work sorts above settled work, so the sidebar reads as a worklist. */
const STATUS_RANK: Record<RoutingStatus, number> = {
	in_progress: 0,
	proposed: 1,
	blocked: 2,
	completed: 3,
	declined: 4,
};

const ROUTING_BUTTON =
	"px-1.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

/**
 * What happens next, once the evidence has been reviewed: preserve, prepare a
 * platform report, share a community packet, or escalate for urgent human
 * review.
 *
 * Every row here is a decision a human recorded with a reason. Advancing an
 * action changes a status and writes an audit event — HateWatch never contacts
 * a platform or an authority on anyone's behalf.
 */
export default function RoutingPanel({
	incidentId,
	actions,
	evidence,
}: {
	incidentId: string;
	actions: RoutingRow[];
	evidence: EvidenceRow[];
}) {
	const queryClient = useQueryClient();
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [note, setNote] = useState<Record<string, string>>({});

	const [kind, setKind] = useState<RoutingKind>("platform_report_preparation");
	const [rationale, setRationale] = useState("");
	const [targetPlatform, setTargetPlatform] = useState<
		(typeof PLATFORMS)[number] | ""
	>("");
	const [policyReference, setPolicyReference] = useState("");

	const sequenceById = new Map(
		evidence.map((item) => [item.id, item.sequenceNumber]),
	);

	async function refresh() {
		await queryClient.invalidateQueries({
			queryKey: orpc.incident.get.key({ input: { id: incidentId } }),
		});
	}

	const advance = useMutation({
		mutationFn: (input: {
			routingActionId: string;
			status: RoutingStatus;
			note?: string;
		}) => client.routing.updateStatus(input),
		onSuccess: async (_row, input) => {
			setPendingId(null);
			setNote((current) => ({ ...current, [input.routingActionId]: "" }));
			await refresh();
		},
		onError: (error) => {
			setPendingId(null);
			toast.error(error.message || "Could not update the routing action.");
		},
	});

	const propose = useMutation({
		mutationFn: (input: {
			kind: RoutingKind;
			rationale: string;
			evidenceId?: string;
			targetPlatform?: (typeof PLATFORMS)[number];
			platformPolicyReference?: string;
		}) => client.routing.create({ incidentId, ...input }),
		onSuccess: async () => {
			toast.success("Routing action proposed");
			setRationale("");
			setPolicyReference("");
			setTargetPlatform("");
			await refresh();
		},
		onError: (error) => {
			toast.error(error.message || "Could not propose the action.");
		},
	});

	/**
	 * Evidence a human flagged for priority review, with no escalation recorded
	 * against it yet. This is the one place the app volunteers a next step, and
	 * it still only pre-fills a proposal a human has to confirm.
	 */
	const escalated = new Set(
		actions
			.filter((action) => action.kind === "urgent_human_escalation")
			.map((action) => action.evidenceId),
	);
	const unescalated = evidence.filter(
		(item) => item.needsPriorityReview && !escalated.has(item.id),
	);

	const sorted = [...actions].sort(
		(a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
	);
	const openCount = actions.filter(
		(action) => action.status !== "completed" && action.status !== "declined",
	).length;

	return (
		<Panel
			title="routing · what happens next"
			aside={<Stamp tone={openCount ? "warn" : "ok"}>{openCount} open</Stamp>}
			bodyClassName="space-y-3 p-3"
		>
			{unescalated.map((item) => (
				<div
					key={item.id}
					className="border border-signal-gap/60 bg-signal-gap/5 p-2.5"
				>
					<div className="flex flex-wrap items-center gap-1.5">
						<Stamp tone="gap">priority review</Stamp>
						<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
							exhibit {String(item.sequenceNumber).padStart(2, "0")}
						</span>
					</div>
					<p className="mt-2 text-[12px] leading-snug">
						{item.priorityReviewReason ??
							"Flagged for priority review with no escalation recorded."}
					</p>
					<button
						type="button"
						className={`${ROUTING_BUTTON} mt-1.5`}
						disabled={propose.isPending}
						onClick={() =>
							propose.mutate({
								kind: "urgent_human_escalation",
								evidenceId: item.id,
								rationale:
									item.priorityReviewReason ??
									`Exhibit ${String(item.sequenceNumber).padStart(2, "0")} was flagged for priority review and needs a second human before the packet is shared.`,
							})
						}
					>
						▲ propose urgent human escalation
					</button>
				</div>
			))}

			{sorted.length === 0 ? (
				<p className="text-muted-foreground text-xs leading-relaxed">
					No routing decisions recorded yet. Routing is what the advocate
					decided to do next — it is never an action the app takes on its own.
				</p>
			) : (
				sorted.map((action) => {
					const busy = pendingId === action.id && advance.isPending;
					const sequence = action.evidenceId
						? sequenceById.get(action.evidenceId)
						: undefined;
					const settled =
						action.status === "completed" || action.status === "declined";

					return (
						<article key={action.id} className="border border-rule p-2.5">
							<div className="flex flex-wrap items-center gap-1.5">
								<Stamp tone="info">{formatEnum(action.kind)}</Stamp>
								<Stamp tone={STATUS_TONE[action.status]}>
									{formatEnum(action.status)}
								</Stamp>
								{sequence !== undefined && (
									<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
										exhibit {String(sequence).padStart(2, "0")}
									</span>
								)}
							</div>

							<p className="mt-2 text-[12px] leading-snug">
								{action.rationale}
							</p>

							{action.targetPlatform && (
								<p className="mt-1.5 font-mono text-[11px] text-foreground/70">
									{formatPlatform(action.targetPlatform)}
									{action.platformPolicyReference &&
										` · ${action.platformPolicyReference}`}
								</p>
							)}

							{!settled && (
								<div className="mt-2 space-y-2 border-rule/60 border-t pt-2">
									<Input
										className={FIELD}
										value={note[action.id] ?? ""}
										onChange={(event) =>
											setNote((current) => ({
												...current,
												[action.id]: event.target.value,
											}))
										}
										placeholder="Note (optional)"
										aria-label="Routing note"
									/>
									<div className="flex flex-wrap items-center gap-1">
										{NEXT[action.status].map(([status, label]) => (
											<button
												key={status}
												type="button"
												className={ROUTING_BUTTON}
												disabled={busy}
												onClick={() => {
													setPendingId(action.id);
													advance.mutate({
														routingActionId: action.id,
														status,
														note: note[action.id]?.trim() || undefined,
													});
												}}
											>
												{label}
											</button>
										))}
										{busy && <span className="hw-label px-1.5">saving…</span>}
									</div>
								</div>
							)}

							{settled && NEXT[action.status].length > 0 && (
								<div className="mt-2 border-rule/60 border-t pt-2">
									{NEXT[action.status].map(([status, label]) => (
										<button
											key={status}
											type="button"
											className={ROUTING_BUTTON}
											disabled={busy}
											onClick={() => {
												setPendingId(action.id);
												advance.mutate({
													routingActionId: action.id,
													status,
												});
											}}
										>
											{label}
										</button>
									))}
								</div>
							)}
						</article>
					);
				})
			)}

			<details className="group border border-rule border-dashed">
				<summary className="hw-label cursor-pointer select-none px-2.5 py-2 transition-colors hover:text-foreground">
					<span className="group-open:hidden">+ propose an action</span>
					<span className="hidden group-open:inline">− close</span>
				</summary>

				<form
					className="space-y-3 border-rule/60 border-t p-2.5"
					onSubmit={(event) => {
						event.preventDefault();
						propose.mutate({
							kind,
							rationale: rationale.trim(),
							targetPlatform: targetPlatform || undefined,
							platformPolicyReference: policyReference.trim() || undefined,
						});
					}}
				>
					<Field label="Action" htmlFor="routing-kind">
						<select
							id="routing-kind"
							className={FIELD}
							value={kind}
							onChange={(event) => setKind(event.target.value as RoutingKind)}
						>
							{KINDS.map((value) => (
								<option key={value} value={value}>
									{formatEnum(value)}
								</option>
							))}
						</select>
					</Field>

					<Field
						label="Rationale"
						htmlFor="routing-rationale"
						hint="Why this is the right next step. Travels with the decision."
					>
						<Textarea
							id="routing-rationale"
							className={TEXTAREA}
							value={rationale}
							onChange={(event) => setRationale(event.target.value)}
							placeholder="What should happen next, and why."
							required
						/>
					</Field>

					{kind === "platform_report_preparation" && (
						<>
							<Field label="Target platform" htmlFor="routing-platform">
								<select
									id="routing-platform"
									className={FIELD}
									value={targetPlatform}
									onChange={(event) =>
										setTargetPlatform(
											event.target.value as (typeof PLATFORMS)[number] | "",
										)
									}
								>
									<option value="">—</option>
									{PLATFORMS.map((value) => (
										<option key={value} value={value}>
											{formatPlatform(value)}
										</option>
									))}
								</select>
							</Field>
							<Field
								label="Policy reference"
								htmlFor="routing-policy"
								hint="The rule being cited, in the platform's own words."
							>
								<Input
									id="routing-policy"
									className={FIELD}
									value={policyReference}
									onChange={(event) => setPolicyReference(event.target.value)}
									placeholder="Hateful conduct — dehumanising speech"
								/>
							</Field>
						</>
					)}

					<Button
						type="submit"
						className="w-full font-mono uppercase tracking-[0.12em]"
						disabled={propose.isPending || !rationale.trim()}
					>
						{propose.isPending ? "Proposing…" : "Propose action"}
					</Button>
				</form>
			</details>
		</Panel>
	);
}
