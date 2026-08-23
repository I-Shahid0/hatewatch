"use client";
import { Button } from "@hate_evidence_copilot/ui/components/button";
import { cn } from "@hate_evidence_copilot/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import Loader from "@/components/loader";
import { client, orpc } from "@/utils/orpc";

function formatEnum(value: string) {
	return value.replaceAll("_", " ");
}

function formatDate(value: Date | string | null) {
	if (!value) return "Unknown";
	return new Date(value).toLocaleString();
}

const CHECK_STATUS_STYLE: Record<string, string> = {
	present: "text-emerald-600 dark:text-emerald-400",
	missing: "text-destructive",
	unknown: "text-amber-600 dark:text-amber-400",
	not_applicable: "text-muted-foreground",
};

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

	if (incident.isPending || timeline.isPending) {
		return <Loader />;
	}

	if (!incident.data) {
		return <p className="p-4">Incident not found.</p>;
	}

	const row = incident.data;

	return (
		<div className="flex flex-col gap-6 p-4">
			<Link href="/dashboard" className="text-muted-foreground text-xs">
				← Dashboard
			</Link>

			<div className="flex flex-col gap-3 rounded-none bg-card p-4 ring-1 ring-foreground/10">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<h1 className="font-medium text-lg">{row.title}</h1>
						<span className="text-muted-foreground text-xs">
							{row.referenceCode}
						</span>
					</div>
					<Button
						size="sm"
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
						{downloading ? "Preparing…" : "Download Evidence Packet (JSON)"}
					</Button>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge status={row.status} />
					<PriorityBadge priority={row.priority} />
					<span className="text-muted-foreground text-xs">
						Context Integrity:{" "}
						{row.contextIntegrityScore === null
							? "—"
							: `${row.contextIntegrityScore}%`}
					</span>
				</div>

				<dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
					<div className="flex gap-1">
						<dt className="text-muted-foreground">Target:</dt>
						<dd>
							{formatEnum(row.targetType)}
							{row.targetDescription ? ` — ${row.targetDescription}` : ""}
						</dd>
					</div>
					<div className="flex gap-1">
						<dt className="text-muted-foreground">Reporting context:</dt>
						<dd>{formatEnum(row.reportingContext)}</dd>
					</div>
					<div className="flex gap-1">
						<dt className="text-muted-foreground">Window:</dt>
						<dd>
							{formatDate(row.windowStartAt)} – {formatDate(row.windowEndAt)}
						</dd>
					</div>
					<div className="flex gap-1">
						<dt className="text-muted-foreground">Safety review:</dt>
						<dd>{formatEnum(row.safetyReviewStatus)}</dd>
					</div>
				</dl>

				{row.summaryApproved && (
					<p className="border-t pt-3 text-sm/relaxed">{row.summaryApproved}</p>
				)}
			</div>

			<div className="flex flex-col gap-3">
				<h2 className="font-medium text-sm">
					Timeline ({timeline.data?.length ?? 0} items)
				</h2>

				{timeline.data?.map((item) => (
					<div
						key={item.id}
						className="flex flex-col gap-2 rounded-none bg-card p-4 text-xs/relaxed ring-1 ring-foreground/10"
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<span className="font-medium">
									Evidence {String(item.sequenceNumber).padStart(2, "0")}
								</span>
								<span className="text-muted-foreground">
									{formatEnum(item.platform)} ·{" "}
									{formatEnum(item.contentSurface)}
								</span>
								{item.needsPriorityReview && (
									<span className="rounded-none bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive uppercase tracking-wide">
										Priority review
									</span>
								)}
							</div>
							<span className="text-muted-foreground">
								{formatDate(item.occurredAt)}
								{item.occurredAtPrecision !== "exact" &&
									item.occurredAt &&
									` (${formatEnum(item.occurredAtPrecision)})`}
							</span>
						</div>

						{item.contentText && (
							<blockquote className="border-l-2 pl-2 text-foreground/90">
								{item.contentText}
							</blockquote>
						)}

						<div className="flex flex-wrap items-center gap-3 text-muted-foreground">
							{item.sourceUrl && (
								<a
									href={item.sourceUrl}
									target="_blank"
									rel="noreferrer"
									className="underline underline-offset-4"
								>
									Source
								</a>
							)}
							<span>
								CI:{" "}
								{item.contextIntegrityScore === null
									? "—"
									: `${item.contextIntegrityScore}%`}
							</span>
						</div>

						<details className="text-muted-foreground">
							<summary className="cursor-pointer select-none text-foreground/70">
								Context Integrity checklist
							</summary>
							<ul className="mt-2 flex flex-col gap-1">
								{item.contextChecks.map((check) => (
									<li key={check.id} className="flex items-center gap-2">
										<span
											className={cn(
												"w-24 shrink-0 uppercase",
												CHECK_STATUS_STYLE[check.status],
											)}
										>
											{formatEnum(check.status)}
										</span>
										<span>{formatEnum(check.element)}</span>
										{check.note && (
											<span className="text-foreground/60">— {check.note}</span>
										)}
									</li>
								))}
							</ul>
						</details>
					</div>
				))}
			</div>
		</div>
	);
}
