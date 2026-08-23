"use client";
import {
	Empty,
	EmptyDescription,
	EmptyTitle,
} from "@hate_evidence_copilot/ui/components/empty";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export default function Dashboard() {
	const incidents = useQuery(orpc.incident.list.queryOptions({ input: {} }));

	if (incidents.isPending) {
		return <Loader />;
	}

	if (!incidents.data || incidents.data.length === 0) {
		return (
			<Empty>
				<EmptyTitle>No incidents yet</EmptyTitle>
				<EmptyDescription>
					Seed the demo incident with `bun run db:seed` to see the dashboard.
				</EmptyDescription>
			</Empty>
		);
	}

	return (
		<div className="flex flex-col gap-2 p-4">
			{incidents.data.map((row) => (
				<Link
					key={row.id}
					href={`/incidents/${row.id}`}
					className="flex flex-col gap-2 rounded-none bg-card p-4 text-xs/relaxed ring-1 ring-foreground/10 hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">{row.title}</span>
							<span className="text-muted-foreground">{row.referenceCode}</span>
							{row.isDemo && (
								<span className="rounded-none bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
									Demo
								</span>
							)}
						</div>
						<div className="flex items-center gap-2">
							<StatusBadge status={row.status} />
							<PriorityBadge priority={row.priority} />
							{row.priorityReviewCount > 0 && (
								<span className="rounded-none bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive uppercase tracking-wide">
									{row.priorityReviewCount} flagged
								</span>
							)}
						</div>
					</div>
					<div className="flex items-center gap-4 text-muted-foreground">
						<span>
							{row.evidenceCount} evidence · {row.platformCount} platform
							{row.platformCount === 1 ? "" : "s"}
						</span>
						<span>
							CI:{" "}
							{row.contextIntegrityScore === null
								? "—"
								: `${row.contextIntegrityScore}%`}
						</span>
					</div>
				</Link>
			))}
		</div>
	);
}
