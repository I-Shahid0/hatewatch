"use client";

import { Button } from "@hate_evidence_copilot/ui/components/button";
import { Input } from "@hate_evidence_copilot/ui/components/input";
import { Textarea } from "@hate_evidence_copilot/ui/components/textarea";
import { cn } from "@hate_evidence_copilot/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { FIELD, Field, TEXTAREA } from "@/components/field";
import { formatEnum, formatPlatform } from "@/components/hw";
import { client, orpc } from "@/utils/orpc";

const PLATFORMS = [
	"unknown",
	"x",
	"instagram",
	"tiktok",
	"facebook",
	"youtube",
	"discord",
	"telegram",
	"whatsapp",
	"other",
] as const;

const SURFACES = [
	"unknown",
	"public_post",
	"reply",
	"comment",
	"quote_post",
	"direct_message",
	"group_chat",
	"story",
	"other",
] as const;

/** Each capture mode says what it costs you in context, not just what it is. */
const MODES = [
	["file", "Screenshot", "the capture itself"],
	["text", "Pasted text", "no artifact yet"],
	["url", "URL only", "link, nothing preserved"],
] as const;

type Mode = (typeof MODES)[number][0];

export default function EvidenceInbox({ incidentId }: { incidentId: string }) {
	const queryClient = useQueryClient();
	const dialog = useRef<HTMLDialogElement>(null);

	const [mode, setMode] = useState<Mode>("file");
	const [dragging, setDragging] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [contentText, setContentText] = useState("");
	const [sourceUrl, setSourceUrl] = useState("");
	const [platform, setPlatform] =
		useState<(typeof PLATFORMS)[number]>("unknown");
	const [contentSurface, setContentSurface] =
		useState<(typeof SURFACES)[number]>("unknown");
	const [targetContext, setTargetContext] = useState("");
	const [advocateNote, setAdvocateNote] = useState("");

	const create = useMutation({
		mutationFn: () =>
			client.evidence.create({
				incidentId,
				platform,
				contentSurface,
				sourceUrl: sourceUrl.trim() || undefined,
				contentText: contentText.trim() || undefined,
				targetContext: targetContext.trim() || undefined,
				advocateNote: advocateNote.trim() || undefined,
				file: file ?? undefined,
			}),
		onSuccess: async () => {
			toast.success("Evidence added to the timeline");
			setFile(null);
			setContentText("");
			setSourceUrl("");
			setTargetContext("");
			setAdvocateNote("");
			dialog.current?.close();
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.incident.get.key({ input: { id: incidentId } }),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.incident.gaps.key({ input: { id: incidentId } }),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.evidence.list.key({
						input: { incidentId, order: "timeline" },
					}),
				}),
				queryClient.invalidateQueries({ queryKey: orpc.incident.list.key() }),
			]);
		},
		onError: (error) => {
			toast.error(error.message || "Could not add evidence.");
		},
	});

	const takeFile = useCallback((next: File | null) => {
		if (!next) return;
		setFile(next);
		setMode("file");
	}, []);

	return (
		<>
			<Button
				className="font-mono uppercase tracking-[0.12em]"
				onClick={() => dialog.current?.showModal()}
			>
				+ Add evidence
			</Button>

			<dialog
				ref={dialog}
				className="m-auto w-[min(44rem,92vw)] border border-rule bg-card p-0 text-foreground backdrop:bg-background/80 backdrop:backdrop-blur-sm"
			>
				<form
					className="flex max-h-[85vh] flex-col"
					onSubmit={(event) => {
						event.preventDefault();
						create.mutate();
					}}
				>
					<header className="flex items-center justify-between border-rule border-b bg-surface-2 px-4 py-2.5">
						<div>
							<p className="hw-label text-primary-ink">evidence inbox</p>
							<h2 className="mt-1 font-medium text-sm">Capture one item</h2>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => dialog.current?.close()}
						>
							Esc
						</Button>
					</header>

					<div className="grid border-rule border-b sm:grid-cols-3">
						{MODES.map(([value, label, detail]) => (
							<button
								key={value}
								type="button"
								onClick={() => setMode(value)}
								aria-pressed={mode === value}
								className={cn(
									"border-rule border-b px-3 py-2.5 text-left transition-colors sm:border-r sm:border-b-0",
									mode === value
										? "bg-primary/10"
										: "text-muted-foreground hover:bg-surface-2",
								)}
							>
								<span
									className={cn(
										"hw-label",
										mode === value && "text-primary-ink",
									)}
								>
									{label}
								</span>
								<span className="mt-1.5 block text-[11px] leading-snug">
									{detail}
								</span>
							</button>
						))}
					</div>

					<div className="flex flex-col gap-4 overflow-y-auto p-4">
						{mode === "file" && (
							// Drag-and-drop is a pointer-only shortcut; the file input
							// inside is the accessible path and does the same thing.
							<section
								aria-label="Screenshot drop zone"
								className={cn(
									"flex flex-col items-center justify-center gap-3 border border-rule border-dashed px-4 py-8 text-center transition-colors",
									dragging && "border-primary bg-primary/5",
								)}
								onDragOver={(event) => {
									event.preventDefault();
									setDragging(true);
								}}
								onDragLeave={() => setDragging(false)}
								onDrop={(event) => {
									event.preventDefault();
									setDragging(false);
									takeFile(event.dataTransfer.files[0] ?? null);
								}}
							>
								<p className="hw-label">drop a screenshot</p>
								<Input
									type="file"
									accept="image/*,video/*,application/pdf,text/plain"
									className="max-w-xs font-mono text-xs"
									onChange={(event) =>
										takeFile(event.target.files?.[0] ?? null)
									}
								/>
								{file && (
									<p className="font-mono text-[11px] text-primary-ink">
										{file.name} · {Math.round(file.size / 1024)} KB
									</p>
								)}
							</section>
						)}

						{mode === "text" && (
							<Field
								label="Pasted content"
								htmlFor="evidence-text"
								hint="Transcribe exactly. Do not paraphrase."
							>
								<Textarea
									id="evidence-text"
									className={TEXTAREA}
									value={contentText}
									onChange={(event) => setContentText(event.target.value)}
									placeholder="Paste the message or post text here."
									required
								/>
							</Field>
						)}

						{mode === "url" && (
							<Field
								label="Source URL"
								htmlFor="evidence-url"
								hint="No file, so Context Integrity will record the missing capture."
							>
								<Input
									id="evidence-url"
									type="url"
									className={FIELD}
									value={sourceUrl}
									onChange={(event) => setSourceUrl(event.target.value)}
									placeholder="https://…"
									required
								/>
							</Field>
						)}

						{mode !== "url" && (
							<Field
								label="Source URL"
								htmlFor="evidence-url-optional"
								hint="Worth 20 — the heaviest single context element."
							>
								<Input
									id="evidence-url-optional"
									type="url"
									className={FIELD}
									value={sourceUrl}
									onChange={(event) => setSourceUrl(event.target.value)}
									placeholder="https://…"
								/>
							</Field>
						)}

						{mode === "file" && (
							<Field label="Visible text" htmlFor="evidence-text-optional">
								<Textarea
									id="evidence-text-optional"
									className={TEXTAREA}
									value={contentText}
									onChange={(event) => setContentText(event.target.value)}
									placeholder="Transcribe what is readable in the capture."
								/>
							</Field>
						)}

						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="Platform" htmlFor="evidence-platform">
								<select
									id="evidence-platform"
									className={FIELD}
									value={platform}
									onChange={(event) =>
										setPlatform(
											event.target.value as (typeof PLATFORMS)[number],
										)
									}
								>
									{PLATFORMS.map((value) => (
										<option key={value} value={value}>
											{formatPlatform(value)}
										</option>
									))}
								</select>
							</Field>
							<Field label="Surface" htmlFor="evidence-surface">
								<select
									id="evidence-surface"
									className={FIELD}
									value={contentSurface}
									onChange={(event) =>
										setContentSurface(
											event.target.value as (typeof SURFACES)[number],
										)
									}
								>
									{SURFACES.map((value) => (
										<option key={value} value={value}>
											{formatEnum(value)}
										</option>
									))}
								</select>
							</Field>
						</div>

						<Field label="Target context" htmlFor="evidence-target">
							<Input
								id="evidence-target"
								className={FIELD}
								value={targetContext}
								onChange={(event) => setTargetContext(event.target.value)}
								placeholder="Who or what this item was aimed at"
							/>
						</Field>

						<Field
							label="Advocate note"
							htmlFor="evidence-note"
							hint="Anything a reviewer should know about this capture."
						>
							<Textarea
								id="evidence-note"
								className={TEXTAREA}
								value={advocateNote}
								onChange={(event) => setAdvocateNote(event.target.value)}
								placeholder="Context that is not visible in the artifact."
							/>
						</Field>
					</div>

					<footer className="flex items-center justify-between gap-2 border-rule border-t bg-surface-2 px-4 py-2.5">
						<p className="hw-label">minimise personal information</p>
						<Button
							type="submit"
							className="font-mono uppercase tracking-[0.12em]"
							disabled={create.isPending}
						>
							{create.isPending ? "Adding…" : "Add to timeline"}
						</Button>
					</footer>
				</form>
			</dialog>
		</>
	);
}
