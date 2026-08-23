import type { AppRouterClient } from "@hate_evidence_copilot/api/routers/index";
import { cn } from "@hate_evidence_copilot/ui/lib/utils";

type IncidentRow = Awaited<
	ReturnType<AppRouterClient["incident"]["list"]>
>[number];
type IncidentStatus = IncidentRow["status"];
type IncidentPriority = IncidentRow["priority"];

function Badge({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<span
			className={cn(
				"rounded-none px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
				className,
			)}
		>
			{children}
		</span>
	);
}

const STATUS_LABEL: Record<IncidentStatus, string> = {
	draft: "Draft",
	intake: "Intake",
	in_review: "In review",
	awaiting_human_review: "Awaiting review",
	ready_to_export: "Ready to export",
	exported: "Exported",
	closed: "Closed",
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
	return (
		<Badge className="bg-secondary text-secondary-foreground">
			{STATUS_LABEL[status]}
		</Badge>
	);
}

const PRIORITY_LABEL: Record<IncidentPriority, string> = {
	standard: "Standard",
	needs_attention: "Needs attention",
	priority_review: "Priority review",
};

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
	if (priority === "standard") {
		return null;
	}

	return (
		<Badge
			className={cn(
				priority === "priority_review"
					? "bg-destructive/10 text-destructive"
					: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
			)}
		>
			{PRIORITY_LABEL[priority]}
		</Badge>
	);
}
