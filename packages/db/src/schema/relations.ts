import { relations } from "drizzle-orm";

import { aiRun, evidenceExtraction } from "./ai";
import { classification, pattern, patternEvidence } from "./analysis";
import { auditEvent } from "./audit";
import { user } from "./auth";
import { evidenceContextCheck } from "./context-integrity";
import { evidence, evidenceAsset, evidenceFieldReview } from "./evidence";
import { incident } from "./incident";
import { redaction } from "./privacy";
import { evidencePacket, routingAction } from "./routing";

/**
 * All domain relations live here rather than beside their tables: several of
 * them point in both directions, and a single module keeps the table files free
 * of circular imports.
 */

export const incidentRelations = relations(incident, ({ one, many }) => ({
	createdByUser: one(user, {
		fields: [incident.createdBy],
		references: [user.id],
	}),
	summaryApprovedByUser: one(user, {
		fields: [incident.summaryApprovedBy],
		references: [user.id],
	}),
	evidence: many(evidence),
	patterns: many(pattern),
	routingActions: many(routingAction),
	packets: many(evidencePacket),
	aiRuns: many(aiRun),
	auditEvents: many(auditEvent),
}));

export const evidenceRelations = relations(evidence, ({ one, many }) => ({
	incident: one(incident, {
		fields: [evidence.incidentId],
		references: [incident.id],
	}),
	createdByUser: one(user, {
		fields: [evidence.createdBy],
		references: [user.id],
	}),
	parent: one(evidence, {
		fields: [evidence.parentEvidenceId],
		references: [evidence.id],
		relationName: "evidence_thread",
	}),
	replies: many(evidence, { relationName: "evidence_thread" }),
	assets: many(evidenceAsset),
	contextChecks: many(evidenceContextCheck),
	fieldReviews: many(evidenceFieldReview),
	extractions: many(evidenceExtraction),
	classifications: many(classification),
	redactions: many(redaction),
	patternLinks: many(patternEvidence),
	routingActions: many(routingAction),
	aiRuns: many(aiRun),
}));

export const evidenceAssetRelations = relations(
	evidenceAsset,
	({ one, many }) => ({
		evidence: one(evidence, {
			fields: [evidenceAsset.evidenceId],
			references: [evidence.id],
		}),
		uploadedByUser: one(user, {
			fields: [evidenceAsset.uploadedBy],
			references: [user.id],
		}),
		redactions: many(redaction),
	}),
);

export const evidenceFieldReviewRelations = relations(
	evidenceFieldReview,
	({ one }) => ({
		evidence: one(evidence, {
			fields: [evidenceFieldReview.evidenceId],
			references: [evidence.id],
		}),
		reviewedByUser: one(user, {
			fields: [evidenceFieldReview.reviewedBy],
			references: [user.id],
		}),
	}),
);

export const evidenceContextCheckRelations = relations(
	evidenceContextCheck,
	({ one }) => ({
		evidence: one(evidence, {
			fields: [evidenceContextCheck.evidenceId],
			references: [evidence.id],
		}),
	}),
);

export const aiRunRelations = relations(aiRun, ({ one, many }) => ({
	incident: one(incident, {
		fields: [aiRun.incidentId],
		references: [incident.id],
	}),
	evidence: one(evidence, {
		fields: [aiRun.evidenceId],
		references: [evidence.id],
	}),
	triggeredByUser: one(user, {
		fields: [aiRun.triggeredBy],
		references: [user.id],
	}),
	extractions: many(evidenceExtraction),
	classifications: many(classification),
	patterns: many(pattern),
	redactions: many(redaction),
	auditEvents: many(auditEvent),
}));

export const evidenceExtractionRelations = relations(
	evidenceExtraction,
	({ one }) => ({
		evidence: one(evidence, {
			fields: [evidenceExtraction.evidenceId],
			references: [evidence.id],
		}),
		aiRun: one(aiRun, {
			fields: [evidenceExtraction.aiRunId],
			references: [aiRun.id],
		}),
	}),
);

export const classificationRelations = relations(
	classification,
	({ one, many }) => ({
		evidence: one(evidence, {
			fields: [classification.evidenceId],
			references: [evidence.id],
		}),
		aiRun: one(aiRun, {
			fields: [classification.aiRunId],
			references: [aiRun.id],
		}),
		reviewedByUser: one(user, {
			fields: [classification.reviewedBy],
			references: [user.id],
		}),
		supersedes: one(classification, {
			fields: [classification.supersedesId],
			references: [classification.id],
			relationName: "classification_revision",
		}),
		supersededBy: many(classification, {
			relationName: "classification_revision",
		}),
	}),
);

export const patternRelations = relations(pattern, ({ one, many }) => ({
	incident: one(incident, {
		fields: [pattern.incidentId],
		references: [incident.id],
	}),
	aiRun: one(aiRun, {
		fields: [pattern.aiRunId],
		references: [aiRun.id],
	}),
	reviewedByUser: one(user, {
		fields: [pattern.reviewedBy],
		references: [user.id],
	}),
	evidenceLinks: many(patternEvidence),
}));

export const patternEvidenceRelations = relations(
	patternEvidence,
	({ one }) => ({
		pattern: one(pattern, {
			fields: [patternEvidence.patternId],
			references: [pattern.id],
		}),
		evidence: one(evidence, {
			fields: [patternEvidence.evidenceId],
			references: [evidence.id],
		}),
		addedByUser: one(user, {
			fields: [patternEvidence.addedBy],
			references: [user.id],
		}),
	}),
);

export const redactionRelations = relations(redaction, ({ one }) => ({
	evidence: one(evidence, {
		fields: [redaction.evidenceId],
		references: [evidence.id],
	}),
	evidenceAsset: one(evidenceAsset, {
		fields: [redaction.evidenceAssetId],
		references: [evidenceAsset.id],
	}),
	aiRun: one(aiRun, {
		fields: [redaction.aiRunId],
		references: [aiRun.id],
	}),
	decidedByUser: one(user, {
		fields: [redaction.decidedBy],
		references: [user.id],
	}),
}));

export const routingActionRelations = relations(routingAction, ({ one }) => ({
	incident: one(incident, {
		fields: [routingAction.incidentId],
		references: [incident.id],
	}),
	evidence: one(evidence, {
		fields: [routingAction.evidenceId],
		references: [evidence.id],
	}),
	assignedToUser: one(user, {
		fields: [routingAction.assignedTo],
		references: [user.id],
	}),
	createdByUser: one(user, {
		fields: [routingAction.createdBy],
		references: [user.id],
	}),
}));

export const evidencePacketRelations = relations(evidencePacket, ({ one }) => ({
	incident: one(incident, {
		fields: [evidencePacket.incidentId],
		references: [incident.id],
	}),
	generatedByUser: one(user, {
		fields: [evidencePacket.generatedBy],
		references: [user.id],
	}),
}));

export const auditEventRelations = relations(auditEvent, ({ one }) => ({
	incident: one(incident, {
		fields: [auditEvent.incidentId],
		references: [incident.id],
	}),
	actorUser: one(user, {
		fields: [auditEvent.actorUserId],
		references: [user.id],
	}),
	aiRun: one(aiRun, {
		fields: [auditEvent.aiRunId],
		references: [aiRun.id],
	}),
}));
