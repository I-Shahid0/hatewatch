import {
	type ConfidenceLevel,
	captureMethodEnum,
	confidenceLevelEnum,
	contentSurfaceEnum,
	type EvidenceFieldName,
	type ExtractedEvidenceFields,
	type FieldConfidenceMap,
	platformEnum,
} from "@hate_evidence_copilot/db";
import { env } from "@hate_evidence_copilot/env/server";
import { generateObject } from "ai";
import { z } from "zod";

/**
 * Evidence extraction: the model proposes, a human disposes.
 *
 * Nothing here writes to `evidence`. Output lands in `evidence_extraction` as a
 * versioned proposal and only reaches a verified column once an advocate
 * confirms it through `evidence.reviewField`.
 *
 * Bump the version when the prompt or the field list changes —
 * `ai_run.promptVersion` is what lets an exported packet say which instructions
 * produced a given draft.
 */
export const EXTRACTION_PROMPT_VERSION = "evidence-extraction/2026-08-v1";

/** Overridable via `AI_GATEWAY_MODEL`; model slugs change faster than this code. */
const DEFAULT_MODEL = "google/gemini-2.5-flash";

/** Gemini reads these inline; anything else falls back to the pasted text. */
const READABLE_ARTIFACT = /^(image\/|video\/|audio\/|application\/pdf)/;

/**
 * Enum-backed fields already carry `unknown`, so they are extracted as plain
 * enums and normalised to null afterwards. A nullable enum is the shape
 * providers most often mangle in structured output.
 */
const ENUM_FIELDS = {
	platform: platformEnum.enumValues,
	content_surface: contentSurfaceEnum.enumValues,
	capture_method: captureMethodEnum.enumValues,
} as const;

/** Per-field instructions. These matter more than the system prompt. */
const FIELDS: ReadonlyArray<readonly [EvidenceFieldName, string]> = [
	[
		"platform",
		"The platform the content lived on, from visible chrome, branding, or UI. `unknown` if you cannot tell.",
	],
	[
		"content_surface",
		"Where on the platform: a public post, a reply, a comment, a direct message, a story. `unknown` if the surface is not visible.",
	],
	[
		"source_url",
		"The permalink, only if it is legible in an address bar or share sheet. Never reconstruct one from a handle.",
	],
	[
		"displayed_account_handle",
		"The account handle exactly as displayed, including the leading @ if shown. Do not resolve it to a person.",
	],
	[
		"displayed_account_display_name",
		"The display name exactly as shown next to the handle.",
	],
	[
		"content_text",
		"The message body, transcribed verbatim: original spelling, punctuation, casing, emoji, and line breaks. Never summarise, translate, or tidy it.",
	],
	[
		"content_language",
		"BCP-47 tag for the language of content_text, e.g. `en`, `ur`, `ar`.",
	],
	[
		"occurred_at",
		"ISO 8601 timestamp, only when an absolute date and time are visible. A relative stamp ('2h ago', 'yesterday') is not an absolute time: return null and say so in `limitations`.",
	],
	[
		"occurred_at_timezone",
		"IANA timezone, only if the artifact states it. Do not infer one from the platform or the language.",
	],
	[
		"capture_method",
		"How the artifact was captured, from visible evidence: a phone status bar means `device_screenshot`, browser chrome means `browser_screenshot`. `unknown` otherwise.",
	],
	[
		"target_context",
		"Who or what the content is aimed at, as visible in the artifact — a named account, an organisation, an event. Describe, do not characterise.",
	],
	[
		"parent_context_url",
		"Link to the post being replied to or quoted, only if visible.",
	],
	[
		"parent_context_summary",
		"The quoted or replied-to content, transcribed as shown. Null if the thread above is cut off.",
	],
];

const SYSTEM_PROMPT = [
	"You transcribe evidence of online harassment for a human advocate who verifies every field before it is used. You are a careful transcriber, not an analyst.",
	"",
	"Rules, in order of importance:",
	"1. Report only what is literally visible in the artifact or present in the supplied text. Never infer, complete, or guess a partial value.",
	'2. If something is cropped, blurred, cut off, illegible, or simply absent, return null (or "unknown" for enum fields) and set confidence to "unavailable". A recorded gap is more useful than a plausible invention.',
	"3. Do not judge, score, characterise, or classify the content or anyone in it. That is a separate step, done by a human.",
	"4. Copy handles, names, and message text exactly as shown. Do not correct spelling, expand abbreviations, or resolve accounts to real-world identities.",
	"",
	"Confidence, per field:",
	'- "high": read directly and unambiguously.',
	'- "medium": legible but partly obscured, or ambiguous between two readings.',
	'- "low": a reading a human should check closely.',
	'- "unavailable": not present in the artifact.',
	"",
	"In `limitations`, state in one sentence what you could not read and why. Null if nothing was obscured.",
].join("\n");

const confidenceSchema = z.enum(confidenceLevelEnum.enumValues);

const extractionSchema = z.object({
	fields: z.object(
		Object.fromEntries(
			FIELDS.map(([field, guidance]) => {
				const values = (
					ENUM_FIELDS as Record<
						string,
						readonly [string, ...string[]] | undefined
					>
				)[field];
				return [
					field,
					z.object({
						value: values
							? z.enum(values).describe(guidance)
							: z.string().nullable().describe(guidance),
						confidence: confidenceSchema,
					}),
				];
			}),
		),
	),
	limitations: z
		.string()
		.nullable()
		.describe(
			"One sentence on what could not be read. Null if nothing was obscured.",
		),
});

export type FieldPart = { value: string | null; confidence: ConfidenceLevel };

export type ExtractionResult = {
	extracted: ExtractedEvidenceFields;
	fieldConfidence: FieldConfidenceMap;
	limitationsNote: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
};

export function isExtractionConfigured(): boolean {
	return Boolean(env.AI_GATEWAY_API_KEY);
}

function modelSlug(): string {
	return env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
}

/** `google/gemini-2.5-flash` → provider and model, as `ai_run` records them. */
export function extractionModel(): { provider: string; model: string } {
	const slug = modelSlug();
	const slash = slug.indexOf("/");
	return slash === -1
		? { provider: "vercel-ai-gateway", model: slug }
		: { provider: slug.slice(0, slash), model: slug.slice(slash + 1) };
}

export function isReadableArtifact(mimeType: string | null): boolean {
	return Boolean(mimeType && READABLE_ARTIFACT.test(mimeType));
}

/**
 * Model output → the two column shapes `evidence_extraction` stores.
 *
 * A blank string, a missing field, and an enum's `unknown` all mean the same
 * thing — the model could not read it — and all become an explicit null with
 * `unavailable` confidence. Recording the gap is what keeps Context Integrity
 * honest instead of quietly scoring an invented value.
 */
export function normalizeExtraction(
	parts: Record<string, FieldPart | undefined>,
): { extracted: ExtractedEvidenceFields; fieldConfidence: FieldConfidenceMap } {
	const extracted: ExtractedEvidenceFields = {};
	const fieldConfidence: FieldConfidenceMap = {};

	for (const [field] of FIELDS) {
		const part = parts[field];
		const raw = typeof part?.value === "string" ? part.value.trim() : null;
		const value =
			raw && !(field in ENUM_FIELDS && raw === "unknown") ? raw : null;

		extracted[field] = value;
		fieldConfidence[field] =
			value === null ? "unavailable" : (part?.confidence ?? "low");
	}

	return { extracted, fieldConfidence };
}

/**
 * One multimodal call through the Vercel AI Gateway. Throws on model failure —
 * the caller owns recording that on `ai_run` and `evidence.verificationStatus`.
 */
export async function extractEvidenceFields(input: {
	artifact: { data: Uint8Array; mediaType: string } | null;
	contentText: string | null;
	sourceUrl: string | null;
	captureNote: string | null;
}): Promise<ExtractionResult> {
	const brief = [
		input.artifact
			? "The attached artifact is the evidence. Read it."
			: "There is no artifact. Work only from the text below.",
		input.contentText
			? `Text supplied with this item:\n"""\n${input.contentText}\n"""`
			: null,
		input.sourceUrl
			? `Source URL recorded by the advocate: ${input.sourceUrl}`
			: null,
		input.captureNote
			? `Advocate's capture note — context only, never a source of extracted values: ${input.captureNote}`
			: null,
		"Extract every field you can read. Leave the rest empty.",
	]
		.filter(Boolean)
		.join("\n\n");

	const { object, usage } = await generateObject({
		model: modelSlug(),
		schema: extractionSchema,
		system: SYSTEM_PROMPT,
		messages: [
			{
				role: "user",
				content: [
					{ type: "text" as const, text: brief },
					...(input.artifact
						? [
								{
									type: "file" as const,
									mediaType: input.artifact.mediaType,
									data: input.artifact.data,
								},
							]
						: []),
				],
			},
		],
	});

	return {
		...normalizeExtraction(
			object.fields as Record<string, FieldPart | undefined>,
		),
		limitationsNote: object.limitations?.trim() || null,
		inputTokens: usage.inputTokens ?? null,
		outputTokens: usage.outputTokens ?? null,
	};
}
