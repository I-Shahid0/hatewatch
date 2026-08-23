"use client";

import { env } from "@hate_evidence_copilot/env/web";
import { Button } from "@hate_evidence_copilot/ui/components/button";
import { Input } from "@hate_evidence_copilot/ui/components/input";
import { Textarea } from "@hate_evidence_copilot/ui/components/textarea";
import { cn } from "@hate_evidence_copilot/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FIELD, TEXTAREA } from "@/components/field";
import {
	ContextChecklist,
	ContextMeter,
	formatDate,
	formatEnum,
	formatPlatform,
	Panel,
	Stamp,
	VerificationStamp,
} from "@/components/hw";
import Loader from "@/components/loader";
import { client, orpc } from "@/utils/orpc";

import ClassificationPanel from "../../classification-review";

const PLATFORMS = [
	"unknown",
	"x",
	"instagram",
	"tiktok",
	"facebook",
	"youtube",
	"discord",
	"telegram",
	"whatsapp",
	"other",
] as const;

const SURFACES = [
	"unknown",
	"public_post",
	"reply",
	"comment",
	"quote_post",
	"direct_message",
	"group_chat",
	"story",
	"other",
] as const;

const CAPTURE_METHODS = [
	"unknown",
	"device_screenshot",
	"browser_screenshot",
	"platform_data_export",
	"archive_service",
	"forwarded_by_target",
	"manual_transcription",
] as const;

type ReviewDecision =
	| "confirmed"
	| "edited"
	| "marked_uncertain"
	| "marked_unavailable";

type FieldDef = {
	field:
		| "platform"
		| "content_surface"
		| "source_url"
		| "displayed_account_handle"
		| "displayed_account_display_name"
		| "content_text"
		| "content_language"
		| "occurred_at"
		| "occurred_at_timezone"
		| "capture_method"
		| "target_context"
		| "parent_context_url"
		| "parent_context_summary";
	label: string;
	kind: "text" | "textarea" | "select" | "datetime";
	options?: readonly string[];
	core?: boolean;
};

type EvidenceFieldName = FieldDef["field"];

/** Core fields first — they are what `verified` is computed from. */
const FIELD_DEFS: FieldDef[] = [
	{
		field: "platform",
		label: "Platform",
		kind: "select",
		options: PLATFORMS,
		core: true,
	},
	{
		field: "content_surface",
		label: "Surface",
		kind: "select",
		options: SURFACES,
		core: true,
	},
	{ field: "source_url", label: "Source URL", kind: "text", core: true },
	{
		field: "content_text",
		label: "Content text",
		kind: "textarea",
		core: true,
	},
	{ field: "occurred_at", label: "Occurred at", kind: "datetime", core: true },
	{
		field: "target_context",
		label: "Target context",
		kind: "textarea",
		core: true,
	},
	{
		field: "capture_method",
		label: "Capture method",
		kind: "select",
		options: CAPTURE_METHODS,
		core: true,
	},
	{
		field: "displayed_account_handle",
		label: "Displayed handle",
		kind: "text",
	},
	{
		field: "displayed_account_display_name",
		label: "Displayed name",
		kind: "text",
	},
	{ field: "content_language", label: "Language", kind: "text" },
	{ field: "occurred_at_timezone", label: "Timezone", kind: "text" },
	{ field: "parent_context_url", label: "Parent URL", kind: "text" },
	{
		field: "parent_context_summary",
		label: "Parent summary",
		kind: "textarea",
	},
];

const CORE_FIELD_COUNT = FIELD_DEFS.filter((def) => def.core).length;

function fileUrl(storageKey: string) {
	const base = env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, "");
	return `${base}/files/${storageKey}`;
}

function readRowValue(
	row: Record<string, unknown>,
	field: EvidenceFieldName,
): string {
	switch (field) {
		case "platform":
			return String(row.platform ?? "");
		case "content_surface":
			return String(row.contentSurface ?? "");
		case "source_url":
			return String(row.sourceUrl ?? "");
		case "displayed_account_handle":
			return String(row.displayedAccountHandle ?? "");
		case "displayed_account_display_name":
			return String(row.displayedAccountDisplayName ?? "");
		case "content_text":
			return String(row.contentText ?? "");
		case "content_language":
			return String(row.contentLanguage ?? "");
		case "occurred_at":
			return row.occurredAt
				? new Date(row.occurredAt as string).toISOString().slice(0, 16)
				: "";
		case "occurred_at_timezone":
			return String(row.occurredAtTimezone ?? "");
		case "capture_method":
			return String(row.captureMethod ?? "");
		case "target_context":
			return String(row.targetContext ?? "");
		case "parent_context_url":
			return String(row.parentContextUrl ?? "");
		case "parent_context_summary":
			return String(row.parentContextSummary ?? "");
		default:
			return "";
	}
}

const DECISION_TONE: Record<
	ReviewDecision,
	"ok" | "lime" | "warn" | "gap" | "neutral"
> = {
	confirmed: "ok",
	edited: "lime",
	marked_uncertain: "warn",
	marked_unavailable: "gap",
};

const ACTION_BUTTON =
	"px-1.5 py-1 font-mono text-[12px] leading-none text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

function RegisterRow({
	def,
	current,
	suggestion,
	latestDecision,
	editing,
	editValue,
	onEditValue,
	onDecision,
	onStartEdit,
	onCancelEdit,
	busy,
}: {
	def: FieldDef;
	current: string;
	suggestion: string | null;
	latestDecision: ReviewDecision | null;
	editing: boolean;
	editValue: string;
	onEditValue: (value: string) => void;
	onDecision: (decision: ReviewDecision, value?: string) => void;
	onStartEdit: () => void;
	onCancelEdit: () => void;
	busy: boolean;
}) {
	const empty = current.trim().length === 0;

	function handleKeyDown(event: React.KeyboardEvent) {
		if (event.key === "Enter" && def.kind !== "textarea") {
			event.preventDefault();
			onDecision("edited", editValue);
		}
		if (event.key === "Escape") onCancelEdit();
	}

	return (
		<div className="group border-rule border-b last:border-0">
			<div className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-baseline gap-3 px-3 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
				<span className="hw-label flex items-center gap-1.5 text-foreground/80">
					{def.core && (
						<span className="text-primary-ink" title="Core verification field">
							•
						</span>
					)}
					{def.label}
				</span>

				<div className="min-w-0">
					<p
						className={cn(
							"wrap-break-word text-[13px] leading-snug",
							empty && "text-signal-gap italic",
							def.kind !== "textarea" && !empty && "font-mono text-[12px]",
						)}
					>
						{empty ? "not recorded" : current}
					</p>
					{suggestion && suggestion !== current && (
						<p className="mt-1 border-rule border-l border-dashed pl-2 font-mono text-[11px] text-muted-foreground leading-snug">
							ai draft · {suggestion}
						</p>
					)}
				</div>

				<div className="flex items-center gap-0.5">
					{busy ? (
						<span className="hw-label px-1.5">saving…</span>
					) : (
						<>
							{latestDecision && (
								<Stamp tone={DECISION_TONE[latestDecision]} className="mr-1.5">
									{formatEnum(latestDecision)}
								</Stamp>
							)}
							<div className="flex items-center opacity-40 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
								<button
									type="button"
									title="Confirm as recorded"
									className={cn(ACTION_BUTTON, "hover:text-signal-ok")}
									onClick={() => onDecision("confirmed")}
								>
									✓
								</button>
								<button
									type="button"
									title="Edit value"
									className={ACTION_BUTTON}
									onClick={onStartEdit}
								>
									✎
								</button>
								<button
									type="button"
									title="Mark uncertain — value cannot be established"
									className={cn(ACTION_BUTTON, "hover:text-signal-warn")}
									onClick={() => onDecision("marked_uncertain")}
								>
									?
								</button>
								<button
									type="button"
									title="Mark unavailable — does not exist for this item"
									className={cn(ACTION_BUTTON, "hover:text-signal-gap")}
									onClick={() => onDecision("marked_unavailable")}
								>
									∅
								</button>
							</div>
						</>
					)}
				</div>
			</div>

			{editing && (
				<div className="border-rule/60 border-t bg-surface-2/40 px-3 py-3 sm:pl-40.5">
					<div className="space-y-2">
						{def.kind === "textarea" ? (
							<Textarea
								className={TEXTAREA}
								value={editValue}
								autoFocus
								onChange={(event) => onEditValue(event.target.value)}
								onKeyDown={handleKeyDown}
							/>
						) : def.kind === "select" && def.options ? (
							<select
								className={FIELD}
								value={editValue}
								autoFocus
								onChange={(event) => onEditValue(event.target.value)}
								onKeyDown={handleKeyDown}
							>
								{def.options.map((option) => (
									<option key={option} value={option}>
										{option === "x" ? "X" : formatEnum(option)}
									</option>
								))}
							</select>
						) : (
							<Input
								className={FIELD}
								type={def.kind === "datetime" ? "datetime-local" : "text"}
								value={editValue}
								autoFocus
								onChange={(event) => onEditValue(event.target.value)}
								onKeyDown={handleKeyDown}
							/>
						)}
						<div className="flex items-center gap-2">
							<Button
								size="xs"
								disabled={busy}
								onClick={() => onDecision("edited", editValue)}
							>
								Save edit
							</Button>
							<Button
								size="xs"
								variant="ghost"
								disabled={busy}
								onClick={onCancelEdit}
							>
								Cancel
							</Button>
							<span className="hw-label ml-auto">
								enter saves · esc cancels
							</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default function EvidenceVerify({
	incidentId,
	evidenceId,
}: {
	incidentId: string;
	evidenceId: string;
}) {
	const queryClient = useQueryClient();
	const [editingField, setEditingField] = useState<EvidenceFieldName | null>(
		null,
	);
	const [editValues, setEditValues] = useState<Record<string, string>>({});
	const [pendingField, setPendingField] = useState<EvidenceFieldName | null>(
		null,
	);

	const evidence = useQuery(
		orpc.evidence.get.queryOptions({ input: { id: evidenceId } }),
	);

	const review = useMutation({
		mutationFn: (input: {
			field: EvidenceFieldName;
			decision: ReviewDecision;
			reviewedValue?: string;
		}) =>
			client.evidence.reviewField({
				evidenceId,
				field: input.field,
				decision: input.decision,
				reviewedValue: input.reviewedValue,
			}),
		onSuccess: async () => {
			setEditingField(null);
			setPendingField(null);
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
				queryClient.invalidateQueries({
					queryKey: orpc.incident.gaps.key({ input: { id: incidentId } }),
				}),
			]);
		},
		onError: (error) => {
			setPendingField(null);
			toast.error(error.message || "Could not save the review.");
		},
	});

	const latestByField = useMemo(() => {
		const map = new Map<EvidenceFieldName, ReviewDecision>();
		for (const entry of evidence.data?.fieldReviews ?? []) {
			if (!map.has(entry.field)) {
				map.set(entry.field, entry.decision);
			}
		}
		return map;
	}, [evidence.data?.fieldReviews]);

	const extraction = evidence.data?.extractions?.[0]?.extracted as
		| Partial<Record<EvidenceFieldName, string | null>>
		| undefined;

	if (evidence.isPending) {
		return <Loader label="opening verification" />;
	}

	if (!evidence.data) {
		return (
			<p className="p-8 text-center text-muted-foreground text-sm">
				Evidence not found.
			</p>
		);
	}

	const row = evidence.data;
	const originalAsset = row.assets.find((asset) => asset.role === "original");
	const artifactUrl = originalAsset ? fileUrl(originalAsset.storageKey) : null;
	const isImage = originalAsset?.mimeType?.startsWith("image/");
	const isVideo = originalAsset?.mimeType?.startsWith("video/");

	const coreReviewed = FIELD_DEFS.filter(
		(def) => def.core && latestByField.has(def.field),
	).length;

	async function submit(
		field: EvidenceFieldName,
		decision: ReviewDecision,
		reviewedValue?: string,
	) {
		setPendingField(field);
		await review.mutateAsync({ field, decision, reviewedValue });
	}

	return (
		<div className="mx-auto max-w-6xl px-4 py-6">
			<Link
				href={`/incidents/${incidentId}`}
				className="hw-label transition-colors hover:text-foreground"
			>
				← back to case file
			</Link>

			<header className="mt-4 border border-rule bg-card px-4 py-3 sm:px-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
						<p className="font-mono text-primary-ink text-xs tracking-[0.14em]">
							{row.incident.referenceCode} · exhibit{" "}
							{String(row.sequenceNumber).padStart(2, "0")}
						</p>
						<VerificationStamp status={row.verificationStatus} />
						<span className="hw-label">
							core {coreReviewed}/{CORE_FIELD_COUNT} reviewed
						</span>
					</div>
					<ContextMeter
						score={row.contextIntegrityScore}
						checks={row.contextChecks}
					/>
				</div>
			</header>

			<div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
				{/* Artifact + live CI stay in view while fields are reviewed. */}
				<div className="space-y-4 lg:sticky lg:top-6">
					<Panel title="artifact" bodyClassName="p-0">
						{artifactUrl ? (
							<div className="bg-surface-2/30">
								{isImage ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={artifactUrl}
										alt={originalAsset?.fileName ?? "Evidence capture"}
										className="max-h-[60vh] w-full object-contain"
									/>
								) : isVideo ? (
									<video
										src={artifactUrl}
										controls
										className="max-h-[60vh] w-full bg-black"
									>
										<track kind="captions" />
									</video>
								) : (
									<div className="flex flex-col items-center gap-3 px-4 py-12">
										<p className="text-muted-foreground text-sm">
											{originalAsset?.fileName ?? "Attached file"}
										</p>
										<a
											href={artifactUrl}
											target="_blank"
											rel="noreferrer"
											className="font-mono text-[11px] text-primary-ink underline underline-offset-4"
										>
											open file ↗
										</a>
									</div>
								)}
							</div>
						) : (
							<div className="px-4 py-10 text-center">
								<p className="hw-label text-signal-gap">no artifact attached</p>
								{row.sourceUrl && (
									<a
										href={row.sourceUrl}
										target="_blank"
										rel="noreferrer"
										className="mt-3 inline-block font-mono text-[11px] text-primary-ink underline underline-offset-4"
									>
										{row.sourceUrl} ↗
									</a>
								)}
								{row.contentText && (
									<blockquote className="mx-auto mt-4 max-w-md border-primary/60 border-l-2 bg-surface-2/40 py-1.5 pl-3 text-left text-[13px] leading-relaxed">
										{row.contentText}
									</blockquote>
								)}
							</div>
						)}

						<dl className="grid border-rule border-t sm:grid-cols-2">
							{(
								[
									["platform", formatPlatform(row.platform)],
									["surface", formatEnum(row.contentSurface)],
									["captured", formatDate(row.capturedAt)],
									["kind", formatEnum(row.kind)],
								] as const
							).map(([label, value]) => (
								<div
									key={label}
									className="border-rule border-b px-3 py-2 last:border-b-0 sm:border-r sm:nth-[2n]:border-r-0"
								>
									<dt className="hw-label">{label}</dt>
									<dd className="mt-1 font-mono text-[11px]">{value}</dd>
								</div>
							))}
						</dl>
					</Panel>

					<Panel title="context integrity · live" bodyClassName="space-y-3 p-3">
						<ContextMeter
							score={row.contextIntegrityScore}
							checks={row.contextChecks}
						/>
						<ContextChecklist checks={row.contextChecks} />
					</Panel>
				</div>

				{/* Verification register — one ruled line per field. */}
				<section>
					<div className="flex items-baseline justify-between border-rule border-b pb-2">
						<h2 className="hw-label text-foreground/80">
							verification register
						</h2>
						<span className="hw-label">
							✓ confirm · ✎ edit · ? uncertain · ∅ unavailable
						</span>
					</div>

					<div className="mt-3 border border-rule bg-card">
						{FIELD_DEFS.map((def) => {
							const current = readRowValue(
								row as unknown as Record<string, unknown>,
								def.field,
							);
							return (
								<RegisterRow
									key={def.field}
									def={def}
									current={current}
									suggestion={extraction?.[def.field] ?? null}
									latestDecision={latestByField.get(def.field) ?? null}
									editing={editingField === def.field}
									editValue={editValues[def.field] ?? current}
									onEditValue={(value) =>
										setEditValues((prev) => ({ ...prev, [def.field]: value }))
									}
									onDecision={(decision, value) =>
										submit(def.field, decision, value)
									}
									onStartEdit={() => {
										setEditingField(def.field);
										setEditValues((prev) => ({
											...prev,
											[def.field]: current,
										}));
									}}
									onCancelEdit={() => setEditingField(null)}
									busy={pendingField === def.field && review.isPending}
								/>
							);
						})}
					</div>

					<p className="mt-3 text-[11px] text-muted-foreground leading-snug">
						<span className="text-primary-ink">•</span> core fields decide the
						verification status. Exports read only from these verified values —
						never from raw captures or AI drafts.
					</p>

					<ClassificationPanel
						incidentId={incidentId}
						evidenceId={evidenceId}
						classifications={row.classifications}
					/>
				</section>
			</div>
		</div>
	);
}
