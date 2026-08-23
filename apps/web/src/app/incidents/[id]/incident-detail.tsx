"use client";
import { Button } from "@hate_evidence_copilot/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { toast } from "sonner";

import {
	ConfidenceStamp,
	ContextChecklist,
	ContextMeter,
	ContextRing,
	formatDate,
	formatEnum,
	formatPlatform,
	Panel,
	PriorityStamp,
	ReviewStamp,
	Stamp,
	StatusStamp,
	scoreLabel,
	VerificationStamp,
} from "@/components/hw";
import Loader from "@/components/loader";
import { client, orpc } from "@/utils/orpc";

import EvidenceInbox from "./evidence-inbox";

async function downloadPacket(incidentId: string, referenceCode: string) {
	const packet = await client.incident.packet({ id: incidentId });
	const blob = new Blob([JSON.stringify(packet, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${referenceCode}-evidence-packet.json`;
	link.click();
	URL.revokeObjectURL(url);
}

export default function IncidentDetail({ incidentId }: { incidentId: string }) {
	const [downloading, setDownloading] = useState(false);

	const incident = useQuery(
		orpc.incident.get.queryOptions({ input: { id: incidentId } }),
	);
	const timeline = useQuery(
		orpc.evidence.list.queryOptions({
			input: { incidentId, order: "timeline" },
		}),
	);
	const gaps = useQuery(
		orpc.incident.gaps.queryOptions({ input: { id: incidentId } }),
	);

	if (incident.isPending || timeline.isPending) {
		return <Loader label="opening case file" />;
	}

	if (!incident.data) {
		return (
			<p className="p-8 text-center text-muted-foreground text-sm">
				Incident not found.
			</p>
		);
	}

	const row = incident.data;
	const items = timeline.data ?? [];

	/** Patterns cite evidence by exhibit number, so build the lookup once. */
	const sequenceById = new Map(
		items.map((item) => [item.id, item.sequenceNumber]),
	);
	const gapCount = (gaps.data ?? []).reduce(
		(total, item) => total + item.contextChecks.length,
		0,
	);

	const needsVerify = (status: string) =>
		status === "uploaded" ||
		status === "needs_verification" ||
		status === "partially_verified" ||
		status === "marked_uncertain";

	return (
		<div className="mx-auto max-w-6xl px-4 py-6">
			<Link
				href="/dashboard"
				className="hw-label transition-colors hover:text-foreground"
			>
				← case board
			</Link>

			{/* ------------------------------------------------------ case header */}
			<header className="mt-4 border border-rule bg-card">
				<div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
					<div className="min-w-0">
						<p className="font-mono text-primary-ink text-xs tracking-[0.14em]">
							{row.referenceCode}
						</p>
						<h1 className="mt-2 text-balance font-semibold text-2xl tracking-[-0.025em] sm:text-3xl">
							{row.title}
						</h1>
						<div className="mt-3 flex flex-wrap items-center gap-1.5">
							<StatusStamp status={row.status} />
							<PriorityStamp priority={row.priority} />
							{row.safetyReviewStatus !== "not_flagged" && (
								<Stamp tone="warn">
									safety · {formatEnum(row.safetyReviewStatus)}
								</Stamp>
							)}
							{row.isDemo && <Stamp tone="lime">synthetic demo evidence</Stamp>}
						</div>
					</div>

					<div className="flex shrink-0 items-center gap-5">
						<ContextRing score={row.contextIntegrityScore} />
						<div className="flex flex-col gap-2">
							<EvidenceInbox incidentId={incidentId} />
							<Button
								variant="outline"
								className="font-mono uppercase tracking-[0.12em]"
								disabled={downloading}
								onClick={async () => {
									setDownloading(true);
									try {
										await downloadPacket(incidentId, row.referenceCode);
									} catch {
										toast.error("Could not generate the evidence packet.");
									} finally {
										setDownloading(false);
									}
								}}
							>
								{downloading ? "Preparing…" : "Export packet (JSON)"}
							</Button>
						</div>
					</div>
				</div>

				{/* Case facts as a ruled register strip. */}
				<dl className="grid border-rule border-t sm:grid-cols-2 lg:grid-cols-4">
					{(
						[
							[
								"target",
								`${formatEnum(row.targetType)}${row.targetDescription ? ` — ${row.targetDescription}` : ""}`,
							],
							["reporting context", formatEnum(row.reportingContext)],
							[
								"incident window",
								`${formatDate(row.windowStartAt)} → ${formatDate(row.windowEndAt)}`,
							],
							["exhibits", `${items.length} · ${gapCount} open gaps`],
						] as const
					).map(([label, value]) => (
						<div
							key={label}
							className="border-rule border-b px-4 py-3 sm:border-r"
						>
							<dt className="hw-label">{label}</dt>
							<dd className="mt-1.5 text-[13px] leading-snug">{value}</dd>
						</div>
					))}
				</dl>

				{row.summaryApproved && (
					<div className="border-rule border-t bg-surface-2/50 p-4">
						<p className="hw-label mb-2 text-signal-ok">
							approved summary · human written
						</p>
						<p className="text-[14px] leading-relaxed">{row.summaryApproved}</p>
					</div>
				)}
			</header>

			<div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
				{/* -------------------------------------------------------- timeline */}
				<section>
					<div className="flex items-baseline justify-between border-rule border-b pb-2">
						<h2 className="hw-label text-foreground/80">
							timeline · {items.length} exhibits
						</h2>
						<span className="hw-label">chronological, undated last</span>
					</div>

					{items.length === 0 ? (
						<div className="mt-4 border border-rule border-dashed bg-surface-2/50 px-4 py-12 text-center text-muted-foreground text-sm">
							Nothing captured yet. Add a screenshot, pasted text, or a URL.
						</div>
					) : (
						<ol className="relative mt-4 space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-rule">
							{items.map((item, index) => (
								<li
									key={item.id}
									style={{ animationDelay: `${index * 40}ms` }}
									className="relative flex animate-rise gap-4"
								>
									{/* Exhibit node sitting on the spine. */}
									<span
										className={`z-10 mt-1 flex size-8 shrink-0 items-center justify-center border font-mono text-[11px] tabular-nums ${
											item.needsPriorityReview
												? "border-signal-gap bg-signal-gap/15 text-signal-gap"
												: "border-rule bg-card text-muted-foreground"
										}`}
									>
										{String(item.sequenceNumber).padStart(2, "0")}
									</span>

									<article className="min-w-0 flex-1 border border-rule bg-card">
										<header className="flex flex-wrap items-center justify-between gap-2 border-rule border-b bg-surface-2/60 px-3 py-2">
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-mono text-[11px] uppercase tracking-[0.1em]">
													{formatPlatform(item.platform)}
												</span>
												<span className="text-muted-foreground text-xs">
													{formatEnum(item.contentSurface)}
												</span>
												<VerificationStamp status={item.verificationStatus} />
												{item.needsPriorityReview && (
													<Stamp tone="gap">priority review</Stamp>
												)}
											</div>
											<div className="flex items-center gap-3">
												{needsVerify(item.verificationStatus) && (
													<Link
														href={
															`/incidents/${incidentId}/evidence/${item.id}` as Route
														}
														className="font-mono text-[10px] text-primary-ink uppercase tracking-[0.12em] underline underline-offset-4"
													>
														verify →
													</Link>
												)}
												<span className="font-mono text-[11px] text-muted-foreground">
													{formatDate(item.occurredAt)}
													{item.occurredAtPrecision !== "exact" &&
														item.occurredAt &&
														` · ${formatEnum(item.occurredAtPrecision)}`}
												</span>
											</div>
										</header>

										<div className="space-y-3 p-3">
											{item.contentText && (
												<blockquote className="border-primary/60 border-l-2 bg-surface-2/40 py-1.5 pl-3 text-[13px] leading-relaxed">
													{item.contentText}
												</blockquote>
											)}

											{item.displayedAccountHandle && (
												<p className="font-mono text-[11px] text-muted-foreground">
													displayed identifier:{" "}
													<span className="text-foreground">
														{item.displayedAccountHandle}
													</span>
													<span className="ml-2 text-ink-faint">
														(never resolved to a real person)
													</span>
												</p>
											)}

											{/* Claim → supporting evidence → reason. */}
											{item.classifications.map((c) => (
												<div
													key={c.id}
													className="border border-rule border-dashed p-2.5"
												>
													<div className="flex flex-wrap items-center gap-1.5">
														<Stamp tone="info">{formatEnum(c.category)}</Stamp>
														<ConfidenceStamp confidence={c.confidence} />
														<ReviewStamp status={c.reviewStatus} />
														<span className="hw-label ml-auto">
															{c.authorKind === "ai"
																? "ai suggestion"
																: "human entry"}
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
												</div>
											))}

											<div className="flex flex-wrap items-center justify-between gap-3 border-rule/60 border-t pt-2.5">
												<ContextMeter
													score={item.contextIntegrityScore}
													checks={item.contextChecks}
												/>
												{item.sourceUrl ? (
													<a
														href={item.sourceUrl}
														target="_blank"
														rel="noreferrer"
														className="font-mono text-[11px] text-primary-ink underline underline-offset-4"
													>
														source ↗
													</a>
												) : (
													<span className="font-mono text-[11px] text-signal-gap">
														no source url
													</span>
												)}
											</div>

											<details className="group">
												<summary className="hw-label cursor-pointer select-none transition-colors hover:text-foreground">
													<span className="group-open:hidden">
														+ why this score
													</span>
													<span className="hidden group-open:inline">
														− hide checklist
													</span>
												</summary>
												<div className="mt-3">
													<ContextChecklist checks={item.contextChecks} />
													{item.advocateNote && (
														<p className="mt-3 border-rule border-l-2 pl-2.5 text-[12px] text-muted-foreground leading-snug">
															<span className="hw-label mr-1">note</span>
															{item.advocateNote}
														</p>
													)}
												</div>
											</details>
										</div>
									</article>
								</li>
							))}
						</ol>
					)}
				</section>

				{/* --------------------------------------------------------- sidebar */}
				<div className="space-y-4 lg:sticky lg:top-20">
					<Panel
						title="possible patterns"
						aside={<Stamp>{row.patterns.length}</Stamp>}
						bodyClassName="space-y-3 p-3"
					>
						{row.patterns.length === 0 ? (
							<p className="text-muted-foreground text-xs leading-relaxed">
								No patterns proposed yet. Patterns describe relationships
								between evidence — never campaigns as fact.
							</p>
						) : (
							row.patterns.map((p) => (
								<article key={p.id} className="border border-rule p-2.5">
									<div className="flex flex-wrap items-center gap-1.5">
										<Stamp tone="info">{formatEnum(p.kind)}</Stamp>
										<ConfidenceStamp confidence={p.confidence} />
										<ReviewStamp status={p.status} />
									</div>
									<h3 className="mt-2 font-medium text-[13px]">{p.name}</h3>
									<p className="mt-1 text-[12px] text-muted-foreground leading-snug">
										{p.description}
									</p>
									<p className="mt-2 font-mono text-[11px] text-foreground/70">
										exhibits{" "}
										{p.evidenceLinks
											.map((link) =>
												String(
													sequenceById.get(link.evidenceId) ?? "?",
												).padStart(2, "0"),
											)
											.join(" · ") || "—"}
									</p>
								</article>
							))
						)}
					</Panel>

					<Panel
						title="known gaps"
						aside={<Stamp tone={gapCount ? "gap" : "ok"}>{gapCount}</Stamp>}
						bodyClassName="p-3"
					>
						{gaps.isPending ? (
							<p className="hw-label">checking…</p>
						) : gapCount === 0 ? (
							<p className="text-muted-foreground text-xs">
								Every applicable context element is recorded.
							</p>
						) : (
							<ul className="space-y-2">
								{(gaps.data ?? [])
									.filter((item) => item.contextChecks.length > 0)
									.map((item) => (
										<li
											key={item.id}
											className="flex gap-2.5 border-rule/60 border-b pb-2 last:border-0"
										>
											<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
												{String(item.sequenceNumber).padStart(2, "0")}
											</span>
											<div className="min-w-0 flex-1">
												<p className="font-mono text-[11px] text-foreground/70 uppercase tracking-[0.1em]">
													{formatPlatform(item.platform)} ·{" "}
													{scoreLabel(item.contextIntegrityScore)}
												</p>
												<p className="mt-1 text-[12px] leading-snug">
													{item.contextChecks
														.map((check) => formatEnum(check.element))
														.join(", ")}
												</p>
											</div>
										</li>
									))}
							</ul>
						)}
					</Panel>

					<Panel title="ai transparency" bodyClassName="p-3">
						<ul className="space-y-1.5 text-[12px] text-muted-foreground leading-snug">
							<li>
								<span className="mr-1.5 font-mono text-signal-ok">✓</span>
								Exports are built from verified database fields, never from raw
								screenshots.
							</li>
							<li>
								<span className="mr-1.5 font-mono text-signal-ok">✓</span>
								AI drafts and pending-review suggestions are excluded from the
								packet.
							</li>
							<li>
								<span className="mr-1.5 font-mono text-signal-gap">✕</span>
								No identity inference, no account scoring, no automatic
								reporting.
							</li>
						</ul>
						<p className="hw-label mt-3">
							opened by {row.createdByUser?.name ?? "unknown"}
						</p>
					</Panel>
				</div>
			</div>
		</div>
	);
}
