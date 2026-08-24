import PDFDocument from "pdfkit";

import type { IncidentPacket } from "./routers/incident";

/**
 * Renders the Evidence Packet snapshot as a PDF.
 *
 * The snapshot is the single source of truth: whatever `buildIncidentPacket`
 * decided to include is what gets printed, so the PDF and the JSON export can
 * never disagree about what was verified. No model is involved in producing
 * this document — it is a renderer, not a summariser.
 *
 * ponytail: the standard Helvetica face is WinAnsi-only. Embed a Unicode font
 * (Noto Sans) when non-Latin evidence text has to render correctly.
 */

const MARGIN = 54;
const INK = "#1a1a1a";
const MUTED = "#6b6b6b";
const RULE = "#c9c4bb";

function formatEnum(value: string | null | undefined) {
	return value ? value.replace(/_/g, " ") : "—";
}

function formatDate(value: Date | string | null | undefined) {
	if (!value) {
		return "—";
	}
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime())
		? "—"
		: `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function exhibit(sequenceNumber: number) {
	return `Evidence ${String(sequenceNumber).padStart(2, "0")}`;
}

export function renderPacketPdf(packet: IncidentPacket): Promise<Buffer> {
	const doc = new PDFDocument({
		size: "LETTER",
		margin: MARGIN,
		info: {
			Title: `${packet.incident.referenceCode} — Evidence Packet`,
			Author: packet.incident.organizationName ?? "Hate Evidence Copilot",
			Subject: packet.incident.title,
		},
	});

	const chunks: Buffer[] = [];
	doc.on("data", (chunk: Buffer) => chunks.push(chunk));
	const done = new Promise<Buffer>((resolve, reject) => {
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);
	});

	/** Running header, so a loose page still traces back to the case. */
	doc.on("pageAdded", () => {
		doc
			.font("Helvetica")
			.fontSize(7.5)
			.fillColor(MUTED)
			.text(
				`${packet.incident.referenceCode} · evidence packet`,
				MARGIN,
				MARGIN / 2,
			);
		doc.x = MARGIN;
		doc.y = MARGIN;
	});

	const section = (title: string) => {
		doc.moveDown(1.1);
		doc
			.font("Helvetica-Bold")
			.fontSize(9)
			.fillColor(MUTED)
			.text(title.toUpperCase(), { characterSpacing: 1.1 });
		doc
			.moveTo(MARGIN, doc.y + 2)
			.lineTo(doc.page.width - MARGIN, doc.y + 2)
			.strokeColor(RULE)
			.lineWidth(0.5)
			.stroke();
		doc.moveDown(0.6);
	};

	const body = (text: string, indent = 0) => {
		doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(text, { indent });
	};

	const note = (text: string) => {
		doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(MUTED).text(text);
	};

	const field = (key: string, value: string, indent = 0) => {
		doc
			.font("Helvetica-Bold")
			.fontSize(9.5)
			.fillColor(MUTED)
			.text(`${key}: `, { indent, continued: true })
			.font("Helvetica")
			.fillColor(INK)
			.text(value);
	};

	// Cover block.
	doc
		.font("Helvetica-Bold")
		.fontSize(20)
		.fillColor(INK)
		.text(packet.incident.referenceCode);
	doc.font("Helvetica").fontSize(13).text(packet.incident.title);
	doc.moveDown(0.4);
	doc
		.fontSize(8.5)
		.fillColor(MUTED)
		.text(
			`Generated ${formatDate(packet.generatedAt)}${
				packet.incident.organizationName
					? ` · ${packet.incident.organizationName}`
					: ""
			}`,
		);
	doc.moveDown(0.5);
	note(
		"Human-verified fields only. AI drafts, pending-review suggestions, and pre-redaction originals are excluded from this document.",
	);

	section("Overview");
	field("Status", formatEnum(packet.incident.status));
	field("Priority", formatEnum(packet.incident.priority));
	field("Safety review", formatEnum(packet.incident.safetyReviewStatus));
	field(
		"Target",
		`${formatEnum(packet.incident.targetType)}${
			packet.incident.targetDescription
				? ` — ${packet.incident.targetDescription}`
				: ""
		}`,
	);
	field("Reporting context", formatEnum(packet.incident.reportingContext));
	field(
		"Declared platforms",
		packet.incident.declaredPlatforms.map(formatEnum).join(", ") || "—",
	);
	field(
		"Incident window",
		`${formatDate(packet.incident.windowStartAt)} → ${formatDate(
			packet.incident.windowEndAt,
		)}`,
	);
	field(
		"Context integrity",
		packet.incident.contextIntegrityScore === null
			? "not computed"
			: `${packet.incident.contextIntegrityScore} / 100`,
	);
	field("Exhibits", String(packet.evidence.length));
	if (packet.incident.closedAt) {
		field("Closed", formatDate(packet.incident.closedAt));
	}

	section("Approved summary");
	if (packet.incident.summaryApproved) {
		body(packet.incident.summaryApproved);
	} else {
		note("No human-approved summary. Nothing is exported in its place.");
	}

	section("Timeline");
	for (const item of packet.evidence) {
		doc.moveDown(0.5);
		doc
			.font("Helvetica-Bold")
			.fontSize(10.5)
			.fillColor(INK)
			.text(
				`${exhibit(item.sequenceNumber)} · ${formatEnum(
					item.platform,
				)} · ${formatEnum(item.contentSurface)}`,
			);
		doc.moveDown(0.2);
		field(
			"Occurred",
			`${formatDate(item.occurredAt)}${
				item.occurredAtPrecision
					? ` (${formatEnum(item.occurredAtPrecision)})`
					: ""
			}`,
		);
		field(
			"Captured",
			`${formatDate(item.capturedAt)} · ${formatEnum(item.captureMethod)}`,
		);
		field(
			"Account",
			item.displayedAccountHandle || item.displayedAccountDisplayName || "—",
		);
		field("Source", item.sourceUrl || "—");
		field("Verification", formatEnum(item.verificationStatus));
		field(
			"Context integrity",
			item.contextIntegrityScore === null
				? "not computed"
				: `${item.contextIntegrityScore} / 100`,
		);
		if (item.contentText) {
			doc.moveDown(0.3);
			doc
				.font("Helvetica-Oblique")
				.fontSize(9.5)
				.fillColor(INK)
				.text(`"${item.contentText}"`, { indent: 14 });
			doc.moveDown(0.2);
		}
		if (item.parentContextSummary) {
			field("Parent context", item.parentContextSummary);
		}
		if (item.targetContext) {
			field("Target context", item.targetContext);
		}
		if (item.advocateNote) {
			field("Advocate note", item.advocateNote);
		}
		if (item.needsPriorityReview) {
			field(
				"Priority review",
				item.priorityReviewReason || "flagged for human review",
			);
		}

		for (const entry of item.classifications) {
			doc.moveDown(0.3);
			doc
				.font("Helvetica-Bold")
				.fontSize(9.5)
				.fillColor(INK)
				.text(
					`${formatEnum(entry.category)} — ${formatEnum(
						entry.reviewStatus,
					)} (confidence: ${formatEnum(entry.confidence)})`,
					{ indent: 14 },
				);
			body(entry.claim, 14);
			body(entry.rationale, 14);
			if (entry.supportingQuote) {
				doc
					.font("Helvetica-Oblique")
					.fontSize(9.5)
					.fillColor(MUTED)
					.text(`Relied on: "${entry.supportingQuote}"`, { indent: 14 });
			}
		}
	}

	section("Reviewed patterns");
	if (packet.patterns.length === 0) {
		note("No pattern has been reviewed by a human yet.");
	}
	for (const item of packet.patterns) {
		doc.moveDown(0.4);
		doc
			.font("Helvetica-Bold")
			.fontSize(10)
			.fillColor(INK)
			.text(`${item.name} — ${formatEnum(item.status)}`);
		field(
			"Kind",
			`${formatEnum(item.kind)} (confidence: ${formatEnum(item.confidence)})`,
		);
		field(
			"Observed",
			`${formatDate(item.firstObservedAt)} → ${formatDate(item.lastObservedAt)}`,
		);
		field(
			"Exhibits",
			item.evidenceSequenceNumbers.map(exhibit).join(", ") || "—",
		);
		body(item.description);
		if (item.reviewerNote) {
			field("Reviewer note", item.reviewerNote);
		}
	}

	section("Known gaps");
	note(
		"Context elements that are missing or unresolved, listed so the reader can weigh them.",
	);
	doc.moveDown(0.3);
	let gapCount = 0;
	for (const item of packet.evidence) {
		const gaps = item.contextChecks.filter(
			(check) => check.status === "missing" || check.status === "unknown",
		);
		if (gaps.length === 0) {
			continue;
		}
		gapCount += gaps.length;
		doc
			.font("Helvetica-Bold")
			.fontSize(9.5)
			.fillColor(INK)
			.text(exhibit(item.sequenceNumber));
		for (const gap of gaps) {
			body(
				`• ${formatEnum(gap.element)} — ${formatEnum(gap.status)}${
					gap.note ? ` — ${gap.note}` : ""
				}`,
				14,
			);
		}
	}
	if (gapCount === 0) {
		body("No open context gaps.");
	}

	section("Redaction record");
	note(
		"Exports are built from redacted artifacts only. Dismissed suggestions are listed too, because dismissing one is itself a decision.",
	);
	doc.moveDown(0.3);
	const redactions = packet.evidence.flatMap((item) =>
		item.redactions.map((entry) => ({ item, entry })),
	);
	if (redactions.length === 0) {
		body("No redaction was proposed or applied.");
	}
	for (const { item, entry } of redactions) {
		body(
			`• ${exhibit(item.sequenceNumber)} — ${formatEnum(
				entry.kind,
			)} — ${formatEnum(entry.status)} — detected by ${formatEnum(
				entry.detectedBy,
			)} — ${entry.reason}`,
		);
	}

	section("AI transparency");
	note(
		"Every model invocation recorded against this incident. Model output never writes to a verified field: a person reviewed each one before it reached this document.",
	);
	doc.moveDown(0.3);
	if (packet.aiRuns.length === 0) {
		body("No model was run on this incident.");
	}
	for (const run of packet.aiRuns) {
		body(
			`• ${formatEnum(run.task)} — ${run.provider}/${run.model} (${
				run.promptVersion
			}) — ${formatEnum(run.status)}${
				run.evidenceSequenceNumber === null
					? ""
					: ` — ${exhibit(run.evidenceSequenceNumber)}`
			} — ${formatDate(run.completedAt)}`,
		);
	}

	doc.end();
	return done;
}
