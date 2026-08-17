import { hashDnaS13Artifact } from "../strictHash"
import {
  DNA_S13_CANARY_FEEDBACK_LABELS,
  DNA_S13_CANARY_FEEDBACK_VERSION,
  DNA_S13_CANARY_LUNA_VALUE_LABELS,
  DNA_S13_CANARY_TRAINING_ANNOTATION_VERSION,
  EMPTY_DNA_S13_CANARY_QUALITY,
  type DnaS13CanaryFeedbackLabel,
  type DnaS13CanaryFeedbackRecord,
  type DnaS13CanaryLunaValueLabel,
  type DnaS13CanaryMessageRecord,
  type DnaS13CanaryQualityFields,
  type DnaS13CanaryTrainingAnnotation,
} from "./contracts"
import { inspectDnaS13CanaryNote } from "./privacy"

function qualityFromLabel(label: DnaS13CanaryFeedbackLabel, score: number | null): DnaS13CanaryQualityFields {
  const bad = label !== "GOOD"
  return Object.freeze({
    ...EMPTY_DNA_S13_CANARY_QUALITY,
    answer_correct: ["GOOD", "INCOMPLETE", "TOO_SHALLOW", "UNNATURAL_TURKISH", "UNNECESSARY_WARNING", "UNNECESSARY_ABSTENTION"].includes(label) ? true
      : label === "WRONG_INFORMATION" ? false : null,
    answer_complete: label === "GOOD" ? true : ["INCOMPLETE", "TOO_SHALLOW"].includes(label) ? false : null,
    answer_relevant: label === "GOOD" ? true : label === "WRONG_TOPIC" ? false : null,
    natural_turkish: label === "GOOD" ? true : label === "UNNATURAL_TURKISH" ? false : null,
    too_short: ["INCOMPLETE", "TOO_SHALLOW"].includes(label) ? true : label === "GOOD" ? false : null,
    too_long: label === "GOOD" ? false : null,
    unnecessary_warning: label === "UNNECESSARY_WARNING" ? true : bad ? null : false,
    unnecessary_abstention: label === "UNNECESSARY_ABSTENTION" ? true : bad ? null : false,
    wrong_topic: label === "WRONG_TOPIC" ? true : bad ? null : false,
    followup_failed: label === "FOLLOWUP_FAILURE" ? true : bad ? null : false,
    comparison_failed: label === "COMPARISON_FAILURE" ? true : bad ? null : false,
    explanation_failed: ["INCOMPLETE", "TOO_SHALLOW"].includes(label) ? true : bad ? null : false,
    overall_quality: score,
  })
}

export function buildDnaS13CanaryFeedback(input: Readonly<{
  sessionId: string
  messageId: string
  testerIdHash: string
  label: string
  note?: string | null
  lunaValue?: string | null
  overallQuality?: number | null
  createdAt?: string
}>): DnaS13CanaryFeedbackRecord {
  if (!/^[a-zA-Z0-9_-]{8,80}$/u.test(input.sessionId) || !/^[a-zA-Z0-9_-]{8,80}$/u.test(input.messageId)) {
    throw new Error("dna_s13_canary_feedback_identifier_invalid")
  }
  if (!DNA_S13_CANARY_FEEDBACK_LABELS.includes(input.label as DnaS13CanaryFeedbackLabel)) {
    throw new Error("dna_s13_canary_feedback_label_invalid")
  }
  if (input.lunaValue && !DNA_S13_CANARY_LUNA_VALUE_LABELS.includes(input.lunaValue as DnaS13CanaryLunaValueLabel)) {
    throw new Error("dna_s13_canary_luna_value_invalid")
  }
  const note = String(input.note || "").trim().slice(0, 500)
  const notePrivacy = inspectDnaS13CanaryNote(note)
  if (!notePrivacy.allowed) throw new Error("dna_s13_canary_feedback_note_privacy_blocked")
  const overallQuality = input.overallQuality == null ? null : Number(input.overallQuality)
  if (overallQuality !== null && (!Number.isInteger(overallQuality) || overallQuality < 1 || overallQuality > 5)) {
    throw new Error("dna_s13_canary_feedback_quality_invalid")
  }
  const label = input.label as DnaS13CanaryFeedbackLabel
  return Object.freeze({
    schemaVersion: DNA_S13_CANARY_FEEDBACK_VERSION,
    sessionId: input.sessionId,
    messageId: input.messageId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    testerIdHash: input.testerIdHash,
    label,
    note: note || null,
    lunaValue: input.lunaValue as DnaS13CanaryLunaValueLabel | null || null,
    quality: qualityFromLabel(label, overallQuality),
  })
}

export function deriveDnaS13CanaryTrainingAnnotation(input: Readonly<{
  message: DnaS13CanaryMessageRecord
  feedback: DnaS13CanaryFeedbackRecord
  createdAt?: string
}>): DnaS13CanaryTrainingAnnotation {
  const { message, feedback } = input
  const reason = feedback.label !== "GOOD" ? "review_not_good" as const
    : !message.privacy.automaticTrainingAllowed ? "privacy_sensitive" as const
      : !message.validation.pass ? "validator_not_passed" as const
        : ["deterministic_fallback", "not_answered"].includes(message.realization.status) ? "fallback_or_rejected" as const
          : !message.provenanceHash ? "no_provenance" as const
            : "reviewer_good" as const
  const candidate = reason === "reviewer_good"
  return Object.freeze({
    schemaVersion: DNA_S13_CANARY_TRAINING_ANNOTATION_VERSION,
    sessionId: message.sessionId,
    messageId: message.messageId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    provenanceHash: message.provenanceHash,
    selectionPolicy: "latest_annotation_per_message",
    training_candidate: candidate,
    exclude_from_training: !candidate,
    exclusion_reason: reason,
  })
}

export function hashDnaS13CanaryTester(userId: string) {
  return hashDnaS13Artifact({ scope: "dna-s13-canary-tester", userId })
}
