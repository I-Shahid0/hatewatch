"use client";

import { Button } from "@hate_evidence_copilot/ui/components/button";
import { Input } from "@hate_evidence_copilot/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { FIELD, Field } from "@/components/field";
import { Stamp } from "@/components/hw";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";

/**
 * Sign in and sign up are one form: they differ by a single name field and
 * which Better Auth call runs, so keeping them apart only duplicated a layout.
 */
export default function LoginPage() {
	const router = useRouter();
	const { isPending } = authClient.useSession();
	const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
	const signingUp = mode === "sign-up";

	const form = useForm({
		defaultValues: { name: "", email: "", password: "" },
		onSubmit: async ({ value }) => {
			const handlers = {
				onSuccess: () => {
					router.push("/dashboard");
					toast.success(signingUp ? "Account created" : "Signed in");
				},
				onError: (error: {
					error: { message?: string; statusText: string };
				}) => {
					toast.error(error.error.message || error.error.statusText);
				},
			};

			if (signingUp) {
				await authClient.signUp.email(
					{ email: value.email, password: value.password, name: value.name },
					handlers,
				);
			} else {
				await authClient.signIn.email(
					{ email: value.email, password: value.password },
					handlers,
				);
			}
		},
		validators: {
			onSubmit: z.object({
				name: signingUp
					? z.string().min(2, "Name must be at least 2 characters")
					: z.string(),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) {
		return <Loader label="checking session" />;
	}

	return (
		<div className="grid min-h-[calc(100svh-8rem)] lg:grid-cols-2">
			{/* Left: the argument. */}
			<section className="hidden flex-col justify-center border-rule border-r px-10 lg:flex">
				<Stamp tone="lime">access · community advocates</Stamp>
				<h1 className="mt-5 max-w-md text-balance font-semibold text-4xl leading-[1.08] tracking-[-0.035em]">
					Evidence that keeps its{" "}
					<span className="hw-redact text-primary">context</span>.
				</h1>
				<p className="mt-5 max-w-sm text-muted-foreground leading-relaxed">
					Fourteen screenshots become one incident record another person can
					actually read — with every gap in the evidence written down instead of
					quietly lost.
				</p>
				<dl className="mt-10 max-w-sm space-y-2.5 font-mono text-[11px]">
					{[
						["capture", "screenshots, text, URLs"],
						["verify", "a human confirms every field"],
						["export", "verified fields only"],
					].map(([key, value]) => (
						<div
							key={key}
							className="flex justify-between border-rule/60 border-b pb-2"
						>
							<dt className="text-primary uppercase tracking-[0.14em]">
								{key}
							</dt>
							<dd className="text-muted-foreground">{value}</dd>
						</div>
					))}
				</dl>
			</section>

			{/* Right: the form. */}
			<section className="flex items-center justify-center px-4 py-12">
				<div className="w-full max-w-sm border border-rule bg-card">
					<div className="grid grid-cols-2 border-rule border-b">
						{(
							[
								["sign-in", "Sign in"],
								["sign-up", "Create account"],
							] as const
						).map(([value, label], index) => (
							<button
								key={value}
								type="button"
								onClick={() => setMode(value)}
								aria-pressed={mode === value}
								className={`hw-label py-3 transition-colors ${index === 0 ? "border-rule border-r" : ""} ${
									mode === value
										? "bg-primary/10 text-primary"
										: "hover:text-foreground"
								}`}
							>
								{label}
							</button>
						))}
					</div>

					<form
						className="flex flex-col gap-4 p-5"
						onSubmit={(event) => {
							event.preventDefault();
							event.stopPropagation();
							form.handleSubmit();
						}}
					>
						{signingUp && (
							<form.Field name="name">
								{(field) => (
									<Field label="Name" htmlFor={field.name}>
										<Input
											id={field.name}
											name={field.name}
											className={FIELD}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										{field.state.meta.errors.map((error) => (
											<p
												key={error?.message}
												className="font-mono text-[11px] text-signal-gap"
											>
												{error?.message}
											</p>
										))}
									</Field>
								)}
							</form.Field>
						)}

						<form.Field name="email">
							{(field) => (
								<Field label="Email" htmlFor={field.name}>
									<Input
										id={field.name}
										name={field.name}
										type="email"
										className={FIELD}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.errors.map((error) => (
										<p
											key={error?.message}
											className="font-mono text-[11px] text-signal-gap"
										>
											{error?.message}
										</p>
									))}
								</Field>
							)}
						</form.Field>

						<form.Field name="password">
							{(field) => (
								<Field label="Password" htmlFor={field.name}>
									<Input
										id={field.name}
										name={field.name}
										type="password"
										className={FIELD}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
									/>
									{field.state.meta.errors.map((error) => (
										<p
											key={error?.message}
											className="font-mono text-[11px] text-signal-gap"
										>
											{error?.message}
										</p>
									))}
								</Field>
							)}
						</form.Field>

						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
							})}
						>
							{({ canSubmit, isSubmitting }) => (
								<Button
									type="submit"
									size="lg"
									className="mt-1 w-full font-mono uppercase tracking-[0.12em]"
									disabled={!canSubmit || isSubmitting}
								>
									{isSubmitting
										? "Working…"
										: signingUp
											? "Create account"
											: "Sign in"}
								</Button>
							)}
						</form.Subscribe>
					</form>
				</div>
			</section>
		</div>
	);
}
