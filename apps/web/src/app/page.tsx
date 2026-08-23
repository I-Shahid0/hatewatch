"use client";
import { Button } from "@hate_evidence_copilot/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ContextMeter, Panel, Stamp } from "@/components/hw";
import { orpc } from "@/utils/orpc";

/** The folder an advocate actually receives. */
const MESSY = [
	"IMG_3821.PNG",
	"Screenshot_2026-08-21.png",
	"twitter-link.txt",
	"IMG_3822.PNG",
	"dm-2.jpeg",
	"unknown-account.png",
	"tiktok.txt",
	"IMG_3830.PNG",
];

const PIPELINE = [
	["Capture", "screenshots, text, URLs"],
	["Verify", "human confirms extraction"],
	["Organize", "chronology across platforms"],
	["Analyze", "patterns tied to evidence IDs"],
	["Review", "classification + audit trail"],
	["Route", "preserve, report, escalate"],
	["Export", "packet from verified fields"],
] as const;

/** The README's worked example, rendered through the real meter component. */
const SAMPLE_CHECKS = [
	{ element: "evidence_artifact", status: "present" },
	{ element: "platform", status: "present", weight: 10 },
	{ element: "content_text", status: "present", weight: 15 },
	{ element: "timestamp", status: "present", weight: 15 },
	{ element: "source_url", status: "missing", weight: 20 },
	{ element: "target_context", status: "present", weight: 15 },
	{ element: "parent_context", status: "missing", weight: 15 },
	{ element: "capture_provenance", status: "unknown", weight: 10 },
];

const NEVER = [
	"scrape social networks",
	"monitor individuals",
	"infer religious identity",
	"identify anonymous users",
	"publicly score accounts",
	"automatically accuse anyone",
	"determine whether something is illegal",
	"contact police on your behalf",
];

export default function Home() {
	const healthCheck = useQuery(orpc.healthCheck.queryOptions());

	return (
		<div className="mx-auto max-w-6xl px-4 pb-16">
			{/* ------------------------------------------------------------ hero */}
			<section className="grid items-center gap-10 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
				<div className="animate-rise">
					<Stamp tone="lime">evidence assistant · human reviewed</Stamp>

					<h1 className="mt-5 text-balance font-semibold text-4xl leading-[1.05] tracking-[-0.035em] sm:text-6xl">
						Preserve the{" "}
						<span className="hw-redact text-primary-ink">context</span> behind
						online hate.
					</h1>

					<p className="mt-5 max-w-xl text-pretty text-muted-foreground leading-relaxed">
						A classifier asks whether one post looks hateful. HateWatch asks
						whether the evidence needed to understand an{" "}
						<span className="text-foreground">entire incident</span> has been
						preserved — and shows you exactly what is missing.
					</p>

					<div className="mt-8 flex flex-wrap items-center gap-3">
						<Link href="/dashboard">
							<Button
								size="lg"
								className="px-4 font-mono uppercase tracking-[0.12em]"
							>
								Open the case board
							</Button>
						</Link>
						<Link href="/login">
							<Button
								size="lg"
								variant="outline"
								className="px-4 font-mono uppercase tracking-[0.12em]"
							>
								Sign in
							</Button>
						</Link>
					</div>

					<p className="mt-6 flex items-center gap-2">
						<span
							className={`size-1.5 ${healthCheck.data ? "animate-blink bg-signal-ok" : "bg-signal-gap"}`}
						/>
						<span className="hw-label">
							api{" "}
							{healthCheck.isLoading
								? "checking"
								: healthCheck.data
									? "connected"
									: "disconnected"}
						</span>
					</p>
				</div>

				{/* before → after: the whole pitch in one picture */}
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="border border-rule border-dashed bg-surface-2/60 p-3">
						<p className="hw-label mb-3">what you receive</p>
						<ul className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
							{MESSY.map((name) => (
								<li
									key={name}
									className="truncate line-through decoration-rule"
								>
									{name}
								</li>
							))}
						</ul>
					</div>

					<div className="hw-glow border border-rule bg-card p-3">
						<p className="hw-label mb-3 text-primary-ink">what you get</p>
						<p className="font-mono text-sm tracking-[-0.01em]">HW-2026-0142</p>
						<p className="mt-1 text-[13px] leading-snug">
							Hostility after community centre open day
						</p>
						<dl className="mt-3 space-y-1.5 font-mono text-[11px]">
							<div className="flex justify-between border-rule/60 border-b pb-1">
								<dt className="text-muted-foreground">evidence</dt>
								<dd className="tabular-nums">14</dd>
							</div>
							<div className="flex justify-between border-rule/60 border-b pb-1">
								<dt className="text-muted-foreground">platforms</dt>
								<dd className="tabular-nums">3</dd>
							</div>
							<div className="flex justify-between border-rule/60 border-b pb-1">
								<dt className="text-muted-foreground">known gaps</dt>
								<dd className="text-signal-gap tabular-nums">4</dd>
							</div>
						</dl>
						<div className="mt-3">
							<ContextMeter score={67} checks={SAMPLE_CHECKS} />
						</div>
					</div>
				</div>
			</section>

			{/* -------------------------------------------------------- pipeline */}
			<section className="border-rule border-y py-6">
				<ol className="grid gap-px sm:grid-cols-4 lg:grid-cols-7">
					{PIPELINE.map(([step, detail], index) => (
						<li key={step} className="px-2 py-1">
							<span className="hw-label text-primary-ink">
								{String(index + 1).padStart(2, "0")}
							</span>
							<p className="mt-1.5 font-medium text-sm">{step}</p>
							<p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
								{detail}
							</p>
						</li>
					))}
				</ol>
			</section>

			{/* ------------------------------------------------ context integrity */}
			<section className="grid gap-6 py-14 lg:grid-cols-[1fr_1.1fr]">
				<div>
					<Stamp>signature metric</Stamp>
					<h2 className="mt-4 font-semibold text-2xl tracking-[-0.02em] sm:text-3xl">
						Context Integrity is not a hate score.
					</h2>
					<p className="mt-4 text-muted-foreground leading-relaxed">
						It is a transparent completeness checklist: whether enough context
						exists for a human to review this responsibly. Eight weighted
						elements, every one of them inspectable. Nothing here rates a
						person, and nothing here invents precision it does not have.
					</p>
					<p className="mt-4 font-mono text-[11px] text-muted-foreground">
						context integrity = available context ÷ applicable context
					</p>
				</div>

				<Panel
					title="Evidence 03 — checklist"
					aside={<Stamp tone="warn">67%</Stamp>}
				>
					<ul className="space-y-1.5 font-mono text-[11px]">
						{SAMPLE_CHECKS.map((check) => {
							const mark =
								check.status === "present"
									? "✓"
									: check.status === "missing"
										? "✕"
										: "?";
							const tone =
								check.status === "present"
									? "text-signal-ok"
									: check.status === "missing"
										? "text-signal-gap"
										: "text-signal-warn";
							return (
								<li
									key={check.element}
									className="flex items-baseline gap-2 border-rule/60 border-b pb-1.5"
								>
									<span className={`w-3 text-center ${tone}`}>{mark}</span>
									<span className="flex-1 uppercase tracking-[0.08em]">
										{check.element.replaceAll("_", " ")}
									</span>
									<span className="text-muted-foreground tabular-nums">
										{check.weight ?? "req"}
									</span>
								</li>
							);
						})}
					</ul>
				</Panel>
			</section>

			{/* ---------------------------------------------------- what it won't */}
			<section className="border-rule border-t py-14">
				<Stamp tone="gap">boundaries</Stamp>
				<h2 className="mt-4 font-semibold text-2xl tracking-[-0.02em] sm:text-3xl">
					HateWatch never does this.
				</h2>
				<ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
					{NEVER.map((item) => (
						<li
							key={item}
							className="border border-rule bg-surface-2/60 px-3 py-2.5 text-[12px] leading-snug"
						>
							<span className="mr-1.5 font-mono text-signal-gap">✕</span>
							{item}
						</li>
					))}
				</ul>
				<p className="mt-6 max-w-2xl text-muted-foreground text-sm leading-relaxed">
					We classify content, visible behaviour, and patterns between evidence
					— never people. Every finding stays tied to its source evidence and
					subject to human review.
				</p>
			</section>
		</div>
	);
}
