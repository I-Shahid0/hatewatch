"use client";
import { cn } from "@hate_evidence_copilot/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const LINKS = [
	{ to: "/", label: "Overview" },
	{ to: "/dashboard", label: "Incidents" },
] as const;

/** The wordmark: a redaction bar that slides off "WATCH" on first paint. */
function Wordmark() {
	return (
		<Link href="/" className="flex items-baseline gap-[1px]">
			<span className="font-mono font-semibold text-base tracking-[-0.02em]">
				HATE
			</span>
			<span className="hw-redact font-mono font-semibold text-base text-primary tracking-[-0.02em]">
				WATCH
			</span>
		</Link>
	);
}

export default function Header() {
	const pathname = usePathname();

	return (
		<header className="sticky top-0 z-20 border-rule border-b bg-background/85 backdrop-blur-md">
			<div className="flex items-center justify-between gap-4 px-4 py-2.5">
				<div className="flex items-center gap-6">
					<Wordmark />
					<nav className="flex items-center gap-1">
						{LINKS.map(({ to, label }) => {
							const active =
								to === "/" ? pathname === "/" : pathname.startsWith(to);
							return (
								<Link
									key={to}
									href={to}
									className={cn(
										"border border-transparent px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
										active
											? "border-rule bg-surface-2 text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{label}
								</Link>
							);
						})}
					</nav>
				</div>

				<div className="flex items-center gap-2">
					<span className="hidden items-center gap-1.5 sm:flex">
						<span className="size-1.5 animate-blink bg-primary" />
						<span className="hw-label">demo mode · synthetic evidence</span>
					</span>
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
