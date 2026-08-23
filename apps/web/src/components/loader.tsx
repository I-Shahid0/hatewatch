/** Blinking cursor blocks rather than a spinner — the product is reading a file. */
export default function Loader({
	label = "reading evidence",
}: {
	label?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-3 py-16">
			<div className="flex gap-1">
				{[0, 180, 360].map((delay) => (
					<span
						key={delay}
						className="size-2 animate-blink bg-primary"
						style={{ animationDelay: `${delay}ms` }}
					/>
				))}
			</div>
			<p className="hw-label">{label}</p>
		</div>
	);
}
