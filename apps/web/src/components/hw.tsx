import type { AppRouterClient } from "@hate_evidence_copilot/api/routers/index";
import { cn } from "@hate_evidence_copilot/ui/lib/utils";

/**
 * The HateWatch visual vocabulary: stamps, panels, and the two Context
 * Integrity gauges. Every screen is either a ruled field or a stamp on a form,
 * so these few primitives cover the whole product.
 */

type IncidentRow = Awaited<
	ReturnType<AppRouterClient["incident"]["list"]>
>[number];
type IncidentStatus = IncidentRow["status"];
type IncidentPriority = IncidentRow["priority"];

export function formatEnum(value: string) {
	return value.replaceAll("_", " ");
}

export function formatPlatform(value: string) {
	return value === "x" ? "X" : formatEnum(value);
}

export function formatDate(value: Date | string | null) {
	if (!value) return "unknown";
	return new Date(value).toLocaleString(undefined, {
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/* ------------------------------------------------------------------ stamps */

type Tone = "neutral" | "lime" | "ok" | "warn" | "gap" | "info";

const TONE: Record<Tone, string> = {
	neutral: "border-rule text-muted-foreground",
	lime: "border-primary/60 bg-primary/10 text-foreground",
	ok: "border-signal-ok/50 bg-signal-ok/10 text-signal-ok",
	warn: "border-signal-warn/50 bg-signal-warn/10 text-signal-warn",
	gap: "border-signal-gap/50 bg-signal-gap/10 text-signal-gap",
	info: "border-signal-info/50 bg-signal-info/10 text-signal-info",
};

export function Stamp({
	tone = "neutral",
	className,
	children,
}: {
	tone?: Tone;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 border px-1.5 py-[3px] font-mono text-[10px] uppercase leading-none tracking-[0.14em]",
				TONE[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}

const STATUS: Record<IncidentStatus, { label: string; tone: Tone }> = {
	draft: { label: "Draft", tone: "neutral" },
	intake: { label: "Intake", tone: "info" },
	in_review: { label: "In review", tone: "info" },
	awaiting_human_review: { label: "Awaiting review", tone: "warn" },
	ready_to_export: { label: "Ready to export", tone: "ok" },
	exported: { label: "Exported", tone: "lime" },
	closed: { label: "Closed", tone: "neutral" },
};

export function StatusStamp({ status }: { status: IncidentStatus }) {
	const it = STATUS[status];
	return <Stamp tone={it.tone}>{it.label}</Stamp>;
}

const PRIORITY: Record<IncidentPriority, { label: string; tone: Tone } | null> =
	{
		standard: null,
		needs_attention: { label: "Needs attention", tone: "warn" },
		priority_review: { label: "Priority review", tone: "gap" },
	};

export function PriorityStamp({ priority }: { priority: IncidentPriority }) {
	const it = PRIORITY[priority];
	if (!it) return null;
	return <Stamp tone={it.tone}>{it.label}</Stamp>;
}

/** Verification is the human step, so it gets a status word, never a score. */
const VERIFICATION_TONE: Record<string, Tone> = {
	uploaded: "neutral",
	extracting: "info",
	needs_verification: "warn",
	partially_verified: "warn",
	verified: "ok",
	unverifiable: "gap",
	excluded: "neutral",
};

export function VerificationStamp({ status }: { status: string }) {
	return (
		<Stamp tone={VERIFICATION_TONE[status] ?? "neutral"}>
			{formatEnum(status)}
		</Stamp>
	);
}

/**
 * Confidence is deliberately a word, never a percentage — fake precision like
 * "91.7% threat" is exactly what HateWatch refuses to render.
 */
const CONFIDENCE_TONE: Record<string, Tone> = {
	high: "ok",
	medium: "warn",
	low: "gap",
	unavailable: "neutral",
};

export function ConfidenceStamp({ confidence }: { confidence: string }) {
	return (
		<Stamp tone={CONFIDENCE_TONE[confidence] ?? "neutral"}>
			conf · {formatEnum(confidence)}
		</Stamp>
	);
}

const REVIEW_TONE: Record<string, Tone> = {
	suggested: "info",
	pending_review: "info",
	under_review: "warn",
	confirmed: "ok",
	changed: "lime",
	marked_insufficient_context: "warn",
	marked_not_relevant: "neutral",
	rejected: "neutral",
};

export function ReviewStamp({ status }: { status: string }) {
	return (
		<Stamp tone={REVIEW_TONE[status] ?? "neutral"}>{formatEnum(status)}</Stamp>
	);
}

export function PlatformTag({ platform }: { platform: string }) {
	return (
		<span className="font-mono text-[11px] text-foreground/70 uppercase tracking-[0.1em]">
			{formatPlatform(platform)}
		</span>
	);
}

/* ------------------------------------------------------------------ panels */

export function Panel({
	title,
	aside,
	className,
	bodyClassName,
	children,
}: {
	title?: React.ReactNode;
	aside?: React.ReactNode;
	className?: string;
	bodyClassName?: string;
	children: React.ReactNode;
}) {
	return (
		<section className={cn("border border-rule bg-card", className)}>
			{title !== undefined && (
				<header className="flex flex-wrap items-center justify-between gap-2 border-rule border-b bg-surface-2 px-3 py-2">
					<h2 className="hw-label text-foreground/80">{title}</h2>
					{aside}
				</header>
			)}
			<div className={cn("p-3 sm:p-4", bodyClassName)}>{children}</div>
		</section>
	);
}

/* ---------------------------------------------------- context integrity -- */

type Check = {
	element: string;
	status: string;
	weight?: number | null;
	note?: string | null;
};

/** README order, so the meter reads the same way on every card. */
const ELEMENT_ORDER = [
	"evidence_artifact",
	"platform",
	"content_text",
	"timestamp",
	"source_url",
	"target_context",
	"parent_context",
	"capture_provenance",
] as const;

const CHECK_FILL: Record<string, string> = {
	present: "bg-signal-ok",
	missing: "bg-signal-gap",
	unknown: "bg-signal-warn",
	not_applicable: "bg-rule",
};

const CHECK_TEXT: Record<string, string> = {
	present: "text-signal-ok",
	missing: "text-signal-gap",
	unknown: "text-signal-warn",
	not_applicable: "text-muted-foreground",
};

const CHECK_MARK: Record<string, string> = {
	present: "✓",
	missing: "✕",
	unknown: "?",
	not_applicable: "–",
};

function orderChecks(checks: Check[]) {
	return [...checks].sort(
		(a, b) =>
			ELEMENT_ORDER.indexOf(a.element as (typeof ELEMENT_ORDER)[number]) -
			ELEMENT_ORDER.indexOf(b.element as (typeof ELEMENT_ORDER)[number]),
	);
}

export function scoreLabel(score: number | null) {
	return score === null ? "—" : `${score}%`;
}

/**
 * The eight-slot bar. One segment per context element, so the score is never
 * an opaque number: you can see which slot is dark before you read the digits.
 */
export function ContextMeter({
	score,
	checks,
	className,
}: {
	score: number | null;
	checks: Check[];
	className?: string;
}) {
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<div className="flex gap-[3px]">
				{orderChecks(checks).map((check) => (
					<span
						key={check.element}
						title={`${formatEnum(check.element)}: ${formatEnum(check.status)}`}
						className={cn(
							"h-3.5 w-1.5",
							CHECK_FILL[check.status] ?? "bg-rule",
							check.status === "not_applicable" && "opacity-40",
						)}
					/>
				))}
			</div>
			<span className="font-mono text-[11px] tabular-nums">
				{scoreLabel(score)}
			</span>
		</div>
	);
}

/** The expanded checklist — the "why this number exists" the README promises. */
export function ContextChecklist({ checks }: { checks: Check[] }) {
	return (
		<ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
			{orderChecks(checks).map((check) => (
				<li
					key={check.element}
					className="flex items-baseline gap-2 border-rule/60 border-b pb-1.5 font-mono text-[11px]"
				>
					<span
						className={cn(
							"w-3 shrink-0 text-center",
							CHECK_TEXT[check.status] ?? "text-muted-foreground",
						)}
					>
						{CHECK_MARK[check.status] ?? "–"}
					</span>
					<span className="flex-1 uppercase tracking-[0.08em]">
						{formatEnum(check.element)}
					</span>
					{check.weight ? (
						<span className="text-muted-foreground tabular-nums">
							{check.weight}
						</span>
					) : (
						<span className="text-muted-foreground">req</span>
					)}
				</li>
			))}
		</ul>
	);
}

/**
 * Incident-level gauge. A ring rather than a bar because at the top of the
 * page it has to carry the screen — this is the number the demo is built on.
 */
export function ContextRing({
	score,
	size = 128,
}: {
	score: number | null;
	size?: number;
}) {
	const radius = size / 2 - 9;
	const circumference = 2 * Math.PI * radius;
	const filled = ((score ?? 0) / 100) * circumference;

	return (
		<div
			className="relative shrink-0"
			style={{ width: size, height: size }}
			role="img"
			aria-label={`Context Integrity ${scoreLabel(score)}`}
		>
			<svg width={size} height={size} className="-rotate-90">
				<title>Context Integrity</title>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--rule)"
					strokeWidth={6}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--primary)"
					strokeWidth={6}
					strokeDasharray={`${filled} ${circumference}`}
					className="transition-[stroke-dasharray] duration-700 ease-out"
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
				<span className="font-mono text-2xl tabular-nums leading-none">
					{score === null ? "—" : score}
					{score !== null && <span className="text-sm">%</span>}
				</span>
				<span className="hw-label text-[8px]">context</span>
			</div>
		</div>
	);
}
