"use client";

import { Button } from "@hate_evidence_copilot/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/**
 * One button, two states. "System" stays the default until someone clicks;
 * this only ever sets an explicit choice.
 *
 * Both icons are always rendered and swapped with the `dark:` variant rather
 * than branching in JS: `resolvedTheme` is undefined during SSR, so branching
 * on it renders a different icon on the server than on the client and trips a
 * hydration mismatch.
 */
export function ModeToggle() {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<Button
			variant="outline"
			size="icon"
			aria-label="Toggle theme"
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
		>
			<Moon className="size-4 dark:hidden" />
			<Sun className="hidden size-4 dark:block" />
		</Button>
	);
}
