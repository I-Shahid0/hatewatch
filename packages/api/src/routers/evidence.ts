import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
	aiRun,
	auditEvent,
	captureMethodEnum,
	computeContextIntegrity,
	contentSurfaceEnum,
	deriveContextChecks,
	type EvidenceFieldName,
	evidence,
	evidenceAsset,
	evidenceContextCheck,
	evidenceExtraction,
	evidenceFieldEnum,
	evidenceFieldReview,
	evidenceKindEnum,
	platformEnum,
	type ReviewDecision,
	reviewDecisionEnum,
} from "@hate_evidence_copilot/db";
import { asc, eq, max, sql } from "@hate_evidence_copilot/db/sql";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import {
	allocateSequenceNumber,
	applyFieldDecision,
	computeVerificationStatus,
	readFieldValue,
	recomputeEvidenceIntegrity,
	refreshIncidentIntegrity,
} from "../evidence-review";
import {
	EXTRACTION_PROMPT_VERSION,
	extractEvidenceFields,
	extractionModel,
	isExtractionConfigured,
	isReadableArtifact,
} from "../extraction";
import { protectedProcedure } from "../index";
import {
	removeStoredFile,
	resolveStoragePath,
	storeEvidenceFile,
} from "../storage";
import { assertIncidentVisible } from "./visibility";

const listInput = z.object({
	incidentId: z.uuid(),
	/**
	 * `timeline` reconstructs chronology across platforms; `capture` keeps the
	 * order items were added, which is how they are cited in a packet.
	 */
	order: z.enum(["timeline", "capture"]).default("timeline"),
});

const createInput = z
	.object({
		incidentId: z.uuid(),
		kind: z.enum(evidenceKindEnum.enumValues).optional(),
		platform: z.enum(platformEnum.enumValues).default("unknown"),
		contentSurface: z.enum(contentSurfaceEnum.enumValues).default("unknown"),
		sourceUrl: z.string().trim().max(2_048).optional(),
		contentText: z.string().trim().max(20_000).optional(),
		captureMethod: z.enum(captureMethodEnum.enumValues).default("unknown"),
		captureNote: z.string().trim().max(2_000).optional(),
		targetContext: z.string().trim().max(2_000).optional(),
		advocateNote: z.string().trim().max(4_000).optional(),
		/** Optional file; paste-text and URL-only evidence are first-class too. */
		file: z
			.file()
			.max(20 * 1024 * 1024)
			.optional(),
	})
	.superRefine((value, ctx) => {
		const hasFile = Boolean(value.file);
		const hasText = Boolean(value.contentText?.trim());
		const hasUrl = Boolean(value.sourceUrl?.trim());
		if (!hasFile && !hasText && !hasUrl) {
			ctx.addIssue({
				code: "custom",
				message: "Attach a file, paste text, or provide a source URL.",
				path: ["file"],
			});
		}
		if (hasUrl) {
			try {
				new URL(value.sourceUrl!.trim());
			} catch {
				ctx.addIssue({
					code: "custom",
					message: "Source URL must be a valid URL.",
					path: ["sourceUrl"],
				});
			}
		}
	});

const reviewFieldInput = z
	.object({
		evidenceId: z.uuid(),
		field: z.enum(evidenceFieldEnum.enumValues),
		decision: z.enum(reviewDecisionEnum.enumValues),
		reviewedValue: z.string().max(20_000).optional(),
		note: z.string().trim().max(2_000).optional(),
	})
	.superRefine((value, ctx) => {
		if (value.decision === "edited" && value.reviewedValue === undefined) {
			ctx.addIssue({
				code: "custom",
				message: "Edited reviews require a value.",
				path: ["reviewedValue"],
			});
		}
	});

/**
 * Statuses extraction is allowed to move. Anything further along means a human
 * has already reviewed a field, and their status must survive a re-run.
 */
const EXTRACTION_STATUSES = new Set([
	"uploaded",
	"extraction_failed",
	"needs_verification",
]);

function inferKind(input: {
	kind?: (typeof evidenceKindEnum.enumValues)[number];
	file?: File;
	contentText?: string;
	sourceUrl?: string;
}): (typeof evidenceKindEnum.enumValues)[number] {
	if (input.kind) return input.kind;
	if (input.file) {
		const mime = input.file.type;
		if (mime.startsWith("video/")) return "screen_recording";
		if (mime.startsWith("audio/")) return "audio";
		if (mime === "application/pdf" || mime.startsWith("text/"))
			return "document";
		return "screenshot";
	}
	if (input.contentText?.trim()) return "pasted_text";
	if (input.sourceUrl?.trim()) return "url";
	return "other";
}

export const evidenceRouter = {
	list: protectedProcedure
		.input(listInput)
		.handler(async ({ context, input }) => {
			await assertIncidentVisible(
				context.db,
				context.session.user.id,
				input.incidentId,
			);

			/**
			 * Items with no established time sort last rather than first: an unknown
			 * timestamp should not silently open the chronology.
			 */
			const ordering =
				input.order === "timeline"
					? [
							sql`${evidence.occurredAt} asc nulls last`,
							asc(evidence.sequenceNumber),
						]
					: [asc(evidence.sequenceNumber)];

			return context.db.query.evidence.findMany({
				where: eq(evidence.incidentId, input.incidentId),
				orderBy: ordering,
				with: {
					assets: true,
					contextChecks: true,
					classifications: true,
				},
			});
		}),

	/**
	 * One item with everything the verification screen compares: the artifact,
	 * the current extraction, the review history, and the redaction record.
	 */
	get: protectedProcedure
		.input(z.object({ id: z.uuid() }))
		.handler(async ({ context, input }) => {
			const row = await context.db.query.evidence.findFirst({
				where: eq(evidence.id, input.id),
				with: {
					incident: { columns: { id: true, referenceCode: true, title: true } },
					assets: true,
					contextChecks: true,
					classifications: true,
					fieldReviews: {
						orderBy: (review, { desc }) => [desc(review.createdAt)],
					},
					redactions: true,
					extractions: {
						where: (extraction, { eq: equals }) =>
							equals(extraction.isCurrent, true),
					},
					parent: {
						columns: { id: true, sequenceNumber: true, contentText: true },
					},
				},
			});

			if (!row) {
				throw new ORPCError("NOT_FOUND", { message: "Evidence not found." });
			}

			await assertIncidentVisible(
				context.db,
				context.session.user.id,
				row.incidentId,
			);

			return row;
		}),

	/**
	 * Ingest path: evidence row + optional asset + eight Context Integrity rows
	 * + audit event, in one transaction. No extraction yet — status stays at
	 * `uploaded` (file) or `needs_verification` (text / URL only).
	 */
	create: protectedProcedure
		.input(createInput)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			await assertIncidentVisible(context.db, userId, input.incidentId);

			const sourceUrl = input.sourceUrl?.trim() || null;
			const contentText = input.contentText?.trim() || null;
			const kind = inferKind({
				kind: input.kind,
				file: input.file,
				contentText: contentText ?? undefined,
				sourceUrl: sourceUrl ?? undefined,
			});
			const hasArtifact = Boolean(input.file);
			const verificationStatus = hasArtifact
				? "uploaded"
				: "needs_verification";

			let writtenKey: string | null = null;

			try {
				const created = await context.db.transaction(async (tx) => {
					const sequenceNumber = await allocateSequenceNumber(
						tx,
						input.incidentId,
					);

					const [row] = await tx
						.insert(evidence)
						.values({
							incidentId: input.incidentId,
							sequenceNumber,
							kind,
							verificationStatus,
							platform: input.platform,
							contentSurface: input.contentSurface,
							sourceUrl,
							contentText,
							contentLanguage: contentText ? "en" : null,
							captureMethod: input.captureMethod,
							captureNote: input.captureNote?.trim() || null,
							targetContext: input.targetContext?.trim() || null,
							advocateNote: input.advocateNote?.trim() || null,
							capturedAt: hasArtifact ? new Date() : null,
							createdBy: userId,
						})
						.returning();

					if (!row) {
						throw new ORPCError("INTERNAL_SERVER_ERROR", {
							message: "Evidence insert returned no row.",
						});
					}

					if (input.file) {
						const stored = await storeEvidenceFile({
							incidentId: input.incidentId,
							evidenceId: row.id,
							file: input.file,
						});
						writtenKey = stored.storageKey;

						await tx.insert(evidenceAsset).values({
							evidenceId: row.id,
							role: "original",
							storageKey: stored.storageKey,
							fileName: stored.fileName,
							mimeType: stored.mimeType,
							byteSize: stored.byteSize,
							sha256: stored.sha256,
							uploadedBy: userId,
						});
					}

					const checks = deriveContextChecks({
						hasArtifact,
						platform: input.platform,
						contentText,
						occurredAt: null,
						occurredAtPrecision: "unknown",
						sourceUrl,
						targetContext: input.targetContext?.trim() || null,
						contentSurface: input.contentSurface,
						parentEvidenceId: null,
						parentContextUrl: null,
						parentContextSummary: null,
						captureMethod: input.captureMethod,
					});

					await tx.insert(evidenceContextCheck).values(
						checks.map((entry) => ({
							evidenceId: row.id,
							element: entry.element,
							status: entry.status,
							weight: entry.weight,
							note: entry.note,
						})),
					);

					const score = computeContextIntegrity(checks);
					const now = new Date();

					const [updated] = await tx
						.update(evidence)
						.set({
							contextIntegrityScore: score,
							contextIntegrityComputedAt: now,
						})
						.where(eq(evidence.id, row.id))
						.returning();

					await tx.insert(auditEvent).values({
						incidentId: input.incidentId,
						actorKind: "user",
						actorUserId: userId,
						action: "evidence.created",
						entityType: "evidence",
						entityId: row.id,
						valueAfter: {
							sequenceNumber,
							kind,
							verificationStatus,
							platform: input.platform,
							hasArtifact,
							contextIntegrityScore: score,
						},
					});

					await refreshIncidentIntegrity(tx, input.incidentId);

					return updated ?? row;
				});

				writtenKey = null;

				const full = await context.db.query.evidence.findFirst({
					where: eq(evidence.id, created.id),
					with: {
						assets: true,
						contextChecks: true,
						classifications: true,
					},
				});

				if (!full) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Evidence created but could not be reloaded.",
					});
				}

				return full;
			} catch (error) {
				if (writtenKey) await removeStoredFile(writtenKey);
				throw error;
			}
		}),

	/**
	 * Ask the model to read one item and propose values for it.
	 *
	 * The proposal is written to `evidence_extraction` and nowhere else — no
	 * verified column on `evidence` is touched, so a re-run can never overwrite a
	 * human decision, and a model outage costs the advocate nothing but the
	 * suggestion column. `reviewField` stays the only path to a verified value.
	 */
	extract: protectedProcedure
		.input(z.object({ evidenceId: z.uuid() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const row = await context.db.query.evidence.findFirst({
				where: eq(evidence.id, input.evidenceId),
				with: { assets: true },
			});

			if (!row) {
				throw new ORPCError("NOT_FOUND", { message: "Evidence not found." });
			}

			await assertIncidentVisible(context.db, userId, row.incidentId);

			if (!isExtractionConfigured()) {
				throw new ORPCError("SERVICE_UNAVAILABLE", {
					message:
						"AI extraction is not configured. Verify the fields manually.",
				});
			}

			const original = row.assets.find((asset) => asset.role === "original");
			const artifact =
				original && isReadableArtifact(original.mimeType) ? original : null;
			const contentText = row.contentText?.trim() || null;

			if (!artifact && !contentText) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Nothing to extract from: attach a readable artifact or paste the content text.",
				});
			}

			/**
			 * Only items no human has touched follow the extracting → verify status
			 * arc. Once a field is reviewed, a re-run leaves the status exactly where
			 * the reviewer left it.
			 */
			const tracksStatus = EXTRACTION_STATUSES.has(row.verificationStatus);
			const { provider, model } = extractionModel();
			const startedAt = new Date();

			const [run] = await context.db
				.insert(aiRun)
				.values({
					incidentId: row.incidentId,
					evidenceId: row.id,
					task: "evidence_extraction",
					status: "running",
					provider,
					model,
					promptVersion: EXTRACTION_PROMPT_VERSION,
					/** A digest, so the log does not become a second copy of the evidence. */
					inputDigest: createHash("sha256")
						.update(
							`${EXTRACTION_PROMPT_VERSION}:${original?.sha256 ?? ""}:${contentText ?? ""}`,
						)
						.digest("hex"),
					triggeredBy: userId,
					startedAt,
				})
				.returning({ id: aiRun.id });

			if (!run) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "AI run insert returned no row.",
				});
			}

			if (tracksStatus) {
				await context.db
					.update(evidence)
					.set({ verificationStatus: "extracting" })
					.where(eq(evidence.id, row.id));
			}

			try {
				const result = await extractEvidenceFields({
					artifact: artifact
						? {
								data: await readFile(resolveStoragePath(artifact.storageKey)),
								mediaType: artifact.mimeType ?? "application/octet-stream",
							}
						: null,
					contentText,
					sourceUrl: row.sourceUrl,
					captureNote: row.captureNote,
				});

				await context.db.transaction(async (tx) => {
					/** Serialises concurrent runs against the version unique index. */
					await tx
						.select({ id: evidence.id })
						.from(evidence)
						.where(eq(evidence.id, row.id))
						.for("update");

					const [agg] = await tx
						.select({ highest: max(evidenceExtraction.version) })
						.from(evidenceExtraction)
						.where(eq(evidenceExtraction.evidenceId, row.id));

					await tx
						.update(evidenceExtraction)
						.set({ isCurrent: false })
						.where(eq(evidenceExtraction.evidenceId, row.id));

					const [extraction] = await tx
						.insert(evidenceExtraction)
						.values({
							evidenceId: row.id,
							aiRunId: run.id,
							version: (agg?.highest ?? 0) + 1,
							isCurrent: true,
							extracted: result.extracted,
							fieldConfidence: result.fieldConfidence,
							limitationsNote: result.limitationsNote,
						})
						.returning();

					if (!extraction) {
						throw new ORPCError("INTERNAL_SERVER_ERROR", {
							message: "Extraction insert returned no row.",
						});
					}

					await tx
						.update(aiRun)
						.set({
							status: "succeeded",
							output: {
								extracted: result.extracted,
								fieldConfidence: result.fieldConfidence,
								limitations: result.limitationsNote,
							},
							inputTokens: result.inputTokens,
							outputTokens: result.outputTokens,
							latencyMs: Date.now() - startedAt.getTime(),
							completedAt: new Date(),
						})
						.where(eq(aiRun.id, run.id));

					if (tracksStatus) {
						await tx
							.update(evidence)
							.set({ verificationStatus: "needs_verification" })
							.where(eq(evidence.id, row.id));
					}

					await tx.insert(auditEvent).values({
						incidentId: row.incidentId,
						actorKind: "ai",
						actorUserId: userId,
						aiRunId: run.id,
						action: "evidence.extracted",
						entityType: "evidence_extraction",
						entityId: extraction.id,
						valueAfter: {
							version: extraction.version,
							model: `${provider}/${model}`,
							promptVersion: EXTRACTION_PROMPT_VERSION,
							fieldConfidence: result.fieldConfidence,
							limitations: result.limitationsNote,
						},
						note: "Proposed values only - no verified field was changed.",
					});
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Extraction failed.";

				/**
				 * Recorded, not swallowed: the item lands on `extraction_failed`
				 * rather than stranding on `extracting`, and every field stays
				 * manually reviewable.
				 */
				await context.db
					.update(aiRun)
					.set({
						status: "failed",
						errorMessage: message.slice(0, 2_000),
						latencyMs: Date.now() - startedAt.getTime(),
						completedAt: new Date(),
					})
					.where(eq(aiRun.id, run.id));

				if (tracksStatus) {
					await context.db
						.update(evidence)
						.set({ verificationStatus: "extraction_failed" })
						.where(eq(evidence.id, row.id));
				}

				await context.db.insert(auditEvent).values({
					incidentId: row.incidentId,
					actorKind: "ai",
					actorUserId: userId,
					aiRunId: run.id,
					action: "evidence.extraction_failed",
					entityType: "evidence",
					entityId: row.id,
					valueAfter: {
						model: `${provider}/${model}`,
						error: message.slice(0, 2_000),
					},
				});

				throw new ORPCError("SERVICE_UNAVAILABLE", {
					message: `Extraction failed: ${message} The fields can still be verified manually.`,
				});
			}

			return context.db.query.evidence.findFirst({
				where: eq(evidence.id, row.id),
				with: {
					incident: { columns: { id: true, referenceCode: true, title: true } },
					assets: true,
					contextChecks: true,
					classifications: true,
					fieldReviews: true,
					extractions: {
						where: (extraction, { eq: equals }) =>
							equals(extraction.isCurrent, true),
					},
				},
			});
		}),

	/**
	 * Human verification: one field decision in one transaction — update the
	 * verified column, append the audit trail, re-score Context Integrity, and
	 * bump verification status.
	 */
	reviewField: protectedProcedure
		.input(reviewFieldInput)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await context.db.query.evidence.findFirst({
				where: eq(evidence.id, input.evidenceId),
				with: {
					assets: true,
					fieldReviews: {
						orderBy: (review, { desc }) => [desc(review.createdAt)],
					},
				},
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Evidence not found." });
			}

			await assertIncidentVisible(context.db, userId, existing.incidentId);

			const originalValue = readFieldValue(existing, input.field);
			const fieldUpdate = applyFieldDecision(
				input.field,
				input.decision,
				input.reviewedValue,
			);

			const reviewedValue =
				input.decision === "edited"
					? (input.reviewedValue?.trim() ?? null)
					: input.decision === "confirmed"
						? originalValue
						: null;

			await context.db.transaction(async (tx) => {
				/**
				 * `confirmed` yields no column changes — the value already says what the
				 * human agrees with — so the update is skipped rather than sent empty.
				 */
				const hasFieldUpdates = Object.keys(fieldUpdate).length > 0;
				const updated = hasFieldUpdates
					? (
							await tx
								.update(evidence)
								.set(fieldUpdate)
								.where(eq(evidence.id, existing.id))
								.returning()
						)[0]
					: existing;

				if (!updated) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Evidence update returned no row.",
					});
				}

				await tx.insert(evidenceFieldReview).values({
					evidenceId: existing.id,
					field: input.field,
					originalValue,
					reviewedValue,
					decision: input.decision,
					note: input.note?.trim() || null,
					reviewedBy: userId,
				});

				const latestReviews = new Map<EvidenceFieldName, ReviewDecision>();
				for (const review of existing.fieldReviews) {
					if (!latestReviews.has(review.field)) {
						latestReviews.set(review.field, review.decision);
					}
				}
				latestReviews.set(input.field, input.decision);

				const hasArtifact = existing.assets.some(
					(asset) => asset.role === "original",
				);
				const verificationStatus = computeVerificationStatus(
					updated,
					latestReviews,
					hasArtifact,
				);

				const [withStatus] = await tx
					.update(evidence)
					.set({ verificationStatus })
					.where(eq(evidence.id, existing.id))
					.returning();

				const rowForChecks = withStatus ?? { ...updated, verificationStatus };
				const { score } = await recomputeEvidenceIntegrity(
					tx,
					rowForChecks,
					hasArtifact,
				);

				await tx.insert(auditEvent).values({
					incidentId: existing.incidentId,
					actorKind: "user",
					actorUserId: userId,
					action: "evidence.field_reviewed",
					entityType: "evidence_field_review",
					entityId: existing.id,
					valueBefore: { [input.field]: originalValue },
					valueAfter: {
						field: input.field,
						decision: input.decision,
						reviewedValue,
						verificationStatus,
						contextIntegrityScore: score,
					},
					note: input.note?.trim() || null,
				});

				await refreshIncidentIntegrity(tx, existing.incidentId);
			});

			return context.db.query.evidence.findFirst({
				where: eq(evidence.id, input.evidenceId),
				with: {
					incident: { columns: { id: true, referenceCode: true, title: true } },
					assets: true,
					contextChecks: true,
					classifications: true,
					fieldReviews: true,
					extractions: {
						where: (extraction, { eq: equals }) =>
							equals(extraction.isCurrent, true),
					},
				},
			});
		}),
};
