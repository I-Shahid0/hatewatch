"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import {
	formatDate,
	PriorityStamp,
	Stamp,
	StatusStamp,
	scoreLabel,
} from "@/components/hw";
import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

import NewIncidentForm from "./new-incident-form";

/**
 * The case board. Rows are ledger entries rather than cards: one ruled line
 * per incident, scannable top to bottom, with the two numbers an advocate
 * triages on — flagged items and Context Integrity — pinned to the right edge.
 */
export default function Dashboard({ advocateName }: { advocateName: string }) {
	const incidents = useQuery(orpc.incident.list.queryOptions({ input: {} }));
	const rows = incidents.data ?? [];

	const totals = rows.reduce(
		(acc, row) => ({
			evidence: acc.evidence + row.evidenceCount,
			flagged: acc.flagged + row.priorityReviewCount,
			scored: acc.scored + (row.contextIntegrityScore === null ? 0 : 1),
			scoreSum: acc.scoreSum + (row.contextIntegrityScore ?? 0),
		}),
		{ evidence: 0, flagged: 0, scored: 0, scoreSum: 0 },
	);
	const meanScore = totals.scored
		? Math.round(totals.scoreSum / totals.scored)
		: null;

	return (
		<div className="mx-auto max-w-6xl px-4 py-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="hw-label">case board · {advocateName}</p>
					<h1 className="mt-2 font-semibold text-3xl tracking-[-0.03em]">
						Open incidents
					</h1>
				</div>
				<NewIncidentForm />
			</div>

			{/* Four numbers, ruled like a form header. */}
			<dl className="mt-6 grid grid-cols-2 border-rule border-t border-l sm:grid-cols-4">
				{(
					[
						["incidents", String(rows.length)],
						["evidence items", String(totals.evidence)],
						["flagged for review", String(totals.flagged)],
						["mean context", scoreLabel(meanScore)],
					] as const
				).map(([label, value]) => (
					<div key={label} className="border-rule border-r border-b px-3 py-3">
						<dt className="hw-label">{label}</dt>
						<dd className="mt-1.5 font-mono text-xl tabular-nums leading-none">
							{value}
						</dd>
					</div>
				))}
			</dl>

			{incidents.isPending ? (
				<Loader label="loading case board" />
			) : rows.length === 0 ? (
				<div className="mt-6 border border-rule border-dashed bg-surface-2/50 px-4 py-14 text-center">
					<p className="hw-label">no incidents on file</p>
					<p className="mt-3 text-muted-foreground text-sm">
						Open one above, or seed the fictional demo case with{" "}
						<code className="bg-muted px-1 py-0.5 font-mono text-foreground text-xs">
							bun run db:seed
						</code>
						.
					</p>
				</div>
			) : (
				<ul className="mt-6 border-rule border-x border-t">
					{rows.map((row, index) => (
						<li key={row.id}>
							<Link
								href={`/incidents/${row.id}`}
								style={{ animationDelay: `${index * 35}ms` }}
								className="group flex animate-rise flex-col gap-3 border-rule border-b bg-card px-4 py-3.5 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="flex min-w-0 flex-col gap-2">
									<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
										<span className="font-mono text-[11px] text-primary tracking-[0.08em] transition-transform group-hover:translate-x-0.5">
											{row.referenceCode}
										</span>
										<span className="truncate font-medium text-[15px] tracking-[-0.01em]">
											{row.title}
										</span>
										{row.isDemo && <Stamp tone="lime">demo</Stamp>}
									</div>
									<div className="flex flex-wrap items-center gap-1.5">
										<StatusStamp status={row.status} />
										<PriorityStamp priority={row.priority} />
										{row.priorityReviewCount > 0 && (
											<Stamp tone="gap">
												{row.priorityReviewCount} flagged
											</Stamp>
										)}
									</div>
								</div>

								<div className="flex shrink-0 items-center gap-5 font-mono text-[11px]">
									<span className="text-muted-foreground">
										<span className="text-foreground tabular-nums">
											{row.evidenceCount}
										</span>{" "}
										items ·{" "}
										<span className="text-foreground tabular-nums">
											{row.platformCount}
										</span>{" "}
										platform{row.platformCount === 1 ? "" : "s"}
									</span>

									<span className="flex items-center gap-2">
										<span className="relative block h-1.5 w-16 bg-rule">
											<span
												className="absolute inset-y-0 left-0 bg-primary"
												style={{ width: `${row.contextIntegrityScore ?? 0}%` }}
											/>
										</span>
										<span className="w-9 text-right tabular-nums">
											{scoreLabel(row.contextIntegrityScore)}
										</span>
									</span>

									<span className="hidden text-muted-foreground lg:inline">
										{formatDate(row.updatedAt)}
									</span>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
