import {
	auditEvent,
	captureMethodEnum,
	computeContextIntegrity,
	contentSurfaceEnum,
	type Db,
	deriveContextChecks,
	evidence,
	evidenceAsset,
	evidenceContextCheck,
	evidenceKindEnum,
	incident,
	platformEnum,
} from "@hate_evidence_copilot/db";
import { and, asc, eq, max, sql } from "@hate_evidence_copilot/db/sql";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { removeStoredFile, storeEvidenceFile } from "../storage";
import { visibleIncidents } from "./visibility";

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

/** Throws unless the signed-in advocate may read this incident. */
async function assertIncidentVisible(
	db: Db,
	userId: string,
	incidentId: string,
) {
	const [row] = await db
		.select({ id: incident.id })
		.from(incident)
		.where(and(eq(incident.id, incidentId), visibleIncidents(userId)))
		.limit(1);

	if (!row) {
		throw new ORPCError("NOT_FOUND", { message: "Incident not found." });
	}
}

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

/**
 * Next citation number for this incident. The incident row is locked so two
 * concurrent uploads cannot claim the same sequence under the unique index.
 */
async function allocateSequenceNumber(
	tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
	incidentId: string,
): Promise<number> {
	const [locked] = await tx
		.select({ id: incident.id })
		.from(incident)
		.where(eq(incident.id, incidentId))
		.for("update");

	if (!locked) {
		throw new ORPCError("NOT_FOUND", { message: "Incident not found." });
	}

	const [agg] = await tx
		.select({ highest: max(evidence.sequenceNumber) })
		.from(evidence)
		.where(eq(evidence.incidentId, incidentId));

	return (agg?.highest ?? 0) + 1;
}

async function refreshIncidentIntegrity(
	tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
	incidentId: string,
) {
	const rows = await tx
		.select({ score: evidence.contextIntegrityScore })
		.from(evidence)
		.where(eq(evidence.incidentId, incidentId));

	const scores = rows
		.map((row) => row.score)
		.filter((score): score is number => score !== null);

	const incidentScore =
		scores.length > 0
			? Math.round(
					scores.reduce((sum, value) => sum + value, 0) / scores.length,
				)
			: null;

	const [current] = await tx
		.select({ status: incident.status })
		.from(incident)
		.where(eq(incident.id, incidentId))
		.limit(1);

	await tx
		.update(incident)
		.set({
			contextIntegrityScore: incidentScore,
			contextIntegrityComputedAt: new Date(),
			...(current?.status === "draft" ? { status: "intake" as const } : {}),
		})
		.where(eq(incident.id, incidentId));
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
					fieldReviews: true,
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
};
