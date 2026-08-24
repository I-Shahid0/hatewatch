import { expect, test } from "bun:test";

import { extractionModel, normalizeExtraction } from "./extraction";

/**
 * The whole point of extraction is that a gap stays a gap. If any of these
 * start returning a value, the model's guesses reach Context Integrity and the
 * packet starts scoring invented context as present.
 */
test("gaps stay gaps", () => {
	const { extracted, fieldConfidence } = normalizeExtraction({
		platform: { value: "unknown", confidence: "medium" },
		capture_method: { value: "unknown", confidence: "high" },
		source_url: { value: "   ", confidence: "high" },
		content_text: { value: null, confidence: "low" },
		// occurred_at omitted entirely — a model may just drop a field.
	});

	for (const field of [
		"platform",
		"capture_method",
		"source_url",
		"content_text",
		"occurred_at",
	] as const) {
		expect(extracted[field]).toBeNull();
		expect(fieldConfidence[field]).toBe("unavailable");
	}
});

test("read values are kept verbatim, with their confidence", () => {
	const { extracted, fieldConfidence } = normalizeExtraction({
		platform: { value: "x", confidence: "high" },
		displayed_account_handle: { value: "  @Someone_ ", confidence: "medium" },
		content_text: {
			value: "go back to  where you came from",
			confidence: "high",
		},
	});

	expect(extracted.platform).toBe("x");
	/** Trimmed at the edges, never "cleaned up" on the inside. */
	expect(extracted.displayed_account_handle).toBe("@Someone_");
	expect(extracted.content_text).toBe("go back to  where you came from");

	expect(fieldConfidence.platform).toBe("high");
	expect(fieldConfidence.displayed_account_handle).toBe("medium");
});

/** `unknown` is only a gap for the enum fields; it is real text elsewhere. */
test("literal text is not mistaken for an enum gap", () => {
	const { extracted, fieldConfidence } = normalizeExtraction({
		target_context: { value: "unknown", confidence: "low" },
	});

	expect(extracted.target_context).toBe("unknown");
	expect(fieldConfidence.target_context).toBe("low");
});

test("model slug splits into provider and model", () => {
	expect(extractionModel()).toEqual({
		provider: "google",
		model: "gemini-2.5-flash",
	});
});
