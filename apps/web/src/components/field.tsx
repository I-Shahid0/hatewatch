/**
 * Form field skin shared by intake and the evidence inbox, so every input in
 * the product reads as the same ruled box on the same paper form.
 */

const FOCUS =
	"outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50";

export const FIELD = `h-9 w-full border border-input bg-transparent px-2.5 font-mono text-xs ${FOCUS}`;

export const TEXTAREA = `min-h-20 w-full border border-input bg-transparent p-2.5 text-xs ${FOCUS}`;

export function Field({
	label,
	hint,
	htmlFor,
	children,
}: {
	label: string;
	hint?: string;
	htmlFor?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<label className="hw-label" htmlFor={htmlFor}>
				{label}
			</label>
			{children}
			{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
		</div>
	);
}
