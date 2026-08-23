"use client";

import { Button } from "@hate_evidence_copilot/ui/components/button";
import { Checkbox } from "@hate_evidence_copilot/ui/components/checkbox";
import { Input } from "@hate_evidence_copilot/ui/components/input";
import { Textarea } from "@hate_evidence_copilot/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FIELD, Field, TEXTAREA } from "@/components/field";
import { formatEnum, formatPlatform } from "@/components/hw";
import { client, orpc } from "@/utils/orpc";

const TARGET_TYPES = [
	"individual",
	"group_of_people",
	"mosque_or_islamic_institution",
	"community_organization",
	"business",
	"event",
	"online_community",
	"other",
	"unknown",
] as const;

const PLATFORMS = [
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

/**
 * Intake as a paper form. Uses the native <dialog> so focus trapping, Escape,
 * and the backdrop come from the platform instead of a modal library.
 */
export default function NewIncidentForm() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const dialog = useRef<HTMLDialogElement>(null);

	const [title, setTitle] = useState("");
	const [situationSummary, setSituationSummary] = useState("");
	const [targetType, setTargetType] =
		useState<(typeof TARGET_TYPES)[number]>("unknown");
	const [targetDescription, setTargetDescription] = useState("");
	const [platforms, setPlatforms] = useState<string[]>([]);
	const [flagForSafetyReview, setFlagForSafetyReview] = useState(false);
	const [safetyReviewNote, setSafetyReviewNote] = useState("");

	const create = useMutation({
		mutationFn: () =>
			client.incident.create({
				title,
				situationSummary: situationSummary || undefined,
				targetType,
				targetDescription: targetDescription || undefined,
				declaredPlatforms: platforms as (typeof PLATFORMS)[number][],
				flagForSafetyReview,
				safetyReviewNote: flagForSafetyReview
					? safetyReviewNote || undefined
					: undefined,
			}),
		onSuccess: async (incident) => {
			toast.success(`Opened ${incident.referenceCode}`);
			dialog.current?.close();
			await queryClient.invalidateQueries({
				queryKey: orpc.incident.list.key(),
			});
			router.push(`/incidents/${incident.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Could not create the incident.");
		},
	});

	function togglePlatform(platform: string) {
		setPlatforms((current) =>
			current.includes(platform)
				? current.filter((item) => item !== platform)
				: [...current, platform],
		);
	}

	return (
		<>
			<Button
				size="lg"
				className="px-4 font-mono uppercase tracking-[0.12em]"
				onClick={() => dialog.current?.showModal()}
			>
				+ New incident
			</Button>

			<dialog
				ref={dialog}
				className="m-auto w-[min(44rem,92vw)] border border-rule bg-card p-0 text-foreground backdrop:bg-background/80 backdrop:backdrop-blur-sm"
			>
				<form
					className="flex max-h-[85vh] flex-col"
					onSubmit={(event) => {
						event.preventDefault();
						if (!title.trim()) {
							toast.error("Title is required.");
							return;
						}
						create.mutate();
					}}
				>
					<header className="flex items-center justify-between border-rule border-b bg-surface-2 px-4 py-2.5">
						<div>
							<p className="hw-label text-primary-ink">form hw-intake-01</p>
							<h2 className="mt-1 font-medium text-sm">Open a new incident</h2>
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

					<div className="flex flex-col gap-4 overflow-y-auto p-4">
						<Field label="Title" htmlFor="incident-title">
							<Input
								id="incident-title"
								className={FIELD}
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="Hostility after open day announcement"
								required
							/>
						</Field>

						<Field
							label="Situation summary"
							htmlFor="incident-summary"
							hint="In the advocate's own words. Optional."
						>
							<Textarea
								id="incident-summary"
								className={TEXTAREA}
								value={situationSummary}
								onChange={(event) => setSituationSummary(event.target.value)}
								placeholder="What happened, and when it started."
							/>
						</Field>

						<div className="grid gap-4 sm:grid-cols-2">
							<Field label="Target type" htmlFor="incident-target-type">
								<select
									id="incident-target-type"
									className={FIELD}
									value={targetType}
									onChange={(event) =>
										setTargetType(
											event.target.value as (typeof TARGET_TYPES)[number],
										)
									}
								>
									{TARGET_TYPES.map((value) => (
										<option key={value} value={value}>
											{formatEnum(value)}
										</option>
									))}
								</select>
							</Field>
							<Field label="Target description" htmlFor="incident-target">
								<Input
									id="incident-target"
									className={FIELD}
									value={targetDescription}
									onChange={(event) => setTargetDescription(event.target.value)}
									placeholder="Who or what was targeted"
								/>
							</Field>
						</div>

						<fieldset className="flex flex-col gap-2">
							<legend className="hw-label">Expected platforms</legend>
							<div className="mt-1 flex flex-wrap gap-1.5">
								{PLATFORMS.map((platform) => {
									const on = platforms.includes(platform);
									return (
										<button
											key={platform}
											type="button"
											onClick={() => togglePlatform(platform)}
											aria-pressed={on}
											className={`border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
												on
													? "border-primary bg-primary/15 text-foreground"
													: "border-rule text-muted-foreground hover:text-foreground"
											}`}
										>
											{formatPlatform(platform)}
										</button>
									);
								})}
							</div>
						</fieldset>

						{/* Framed as queueing a human, never as scoring risk. */}
						<div className="flex items-start gap-2.5 border border-rule bg-surface-2/60 p-3 text-xs">
							<Checkbox
								id="safety-flag"
								checked={flagForSafetyReview}
								onCheckedChange={(checked) =>
									setFlagForSafetyReview(checked === true)
								}
								className="mt-0.5"
							/>
							<label htmlFor="safety-flag">
								<span className="font-medium">Flag for safety review</span>
								<span className="mt-0.5 block text-muted-foreground">
									Queues a second human to look sooner. This does not score risk
									and does not contact anyone.
								</span>
							</label>
						</div>

						{flagForSafetyReview && (
							<Field label="Safety note" htmlFor="safety-note">
								<Textarea
									id="safety-note"
									className={TEXTAREA}
									value={safetyReviewNote}
									onChange={(event) => setSafetyReviewNote(event.target.value)}
									placeholder="Why a second reviewer should look sooner."
								/>
							</Field>
						)}
					</div>

					<footer className="flex items-center justify-between gap-2 border-rule border-t bg-surface-2 px-4 py-2.5">
						<p className="hw-label">reference code assigned on save</p>
						<Button
							type="submit"
							className="font-mono uppercase tracking-[0.12em]"
							disabled={create.isPending}
						>
							{create.isPending ? "Opening…" : "Open incident"}
						</Button>
					</footer>
				</form>
			</dialog>
		</>
	);
}
