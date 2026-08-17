import type { DnaS13PrivacyClassification, DnaS13RealizationProvenance } from "../strictProvenance"
import type { DnaS13ComparisonConclusionMode } from "../strictContracts"

export const DNA_S13_CANARY_TELEMETRY_VERSION = "dna-s13-internal-canary-telemetry@1" as const
export const DNA_S13_CANARY_FEEDBACK_VERSION = "dna-s13-internal-canary-feedback@1" as const
export const DNA_S13_CANARY_TRAINING_ANNOTATION_VERSION = "dna-s13-canary-training-annotation@1" as const

export const DNA_S13_CANARY_FEEDBACK_LABELS = Object.freeze([
  "GOOD",
  "WRONG_INFORMATION",
  "WRONG_TOPIC",
  "INCOMPLETE",
  "TOO_SHALLOW",
  "UNNATURAL_TURKISH",
  "UNNECESSARY_ABSTENTION",
  "UNNECESSARY_WARNING",
  "FOLLOWUP_FAILURE",
  "COMPARISON_FAILURE",
  "OTHER",
] as const)

export const DNA_S13_CANARY_LUNA_VALUE_LABELS = Object.freeze([
  "LUNA_QUALITY_GAIN",
  "DETERMINISTIC_ALREADY_SUFFICIENT",
  "LUNA_REQUIRED",
  "LUNA_CALL_UNNECESSARY",
] as const)

export type DnaS13CanaryFeedbackLabel = typeof DNA_S13_CANARY_FEEDBACK_LABELS[number]
export type DnaS13CanaryLunaValueLabel = typeof DNA_S13_CANARY_LUNA_VALUE_LABELS[number]

export type DnaS13CanaryQualityFields = Readonly<{
  answer_correct: boolean | null
  answer_complete: boolean | null
  answer_relevant: boolean | null
  natural_turkish: boolean | null
  too_short: boolean | null
  too_long: boolean | null
  unnecessary_warning: boolean | null
  unnecessary_abstention: boolean | null
  wrong_topic: boolean | null
  followup_failed: boolean | null
  comparison_failed: boolean | null
  explanation_failed: boolean | null
  overall_quality: number | null
}>

export const EMPTY_DNA_S13_CANARY_QUALITY: DnaS13CanaryQualityFields = Object.freeze({
  answer_correct: null,
  answer_complete: null,
  answer_relevant: null,
  natural_turkish: null,
  too_short: null,
  too_long: null,
  unnecessary_warning: null,
  unnecessary_abstention: null,
  wrong_topic: null,
  followup_failed: null,
  comparison_failed: null,
  explanation_failed: null,
  overall_quality: null,
})

export type DnaS13CanaryMessageRecord = Readonly<{
  schemaVersion: typeof DNA_S13_CANARY_TELEMETRY_VERSION
  architectureVersion: string
  architectureHash: string
  sessionId: string
  messageId: string
  createdAt: string
  testerIdHash: string
  question: string
  normalizedQuestion: string
  answer: string
  privacy: DnaS13PrivacyClassification
  routing: Readonly<{
    intent: readonly string[]
    detectedTopicIds: readonly string[]
    focus: readonly string[]
    questionType: readonly string[]
    followUp: boolean
    correction: boolean
    subquestionCount: number
    answerability: readonly string[]
    comparisonMode: DnaS13ComparisonConclusionMode | null
    parserUncertainty: boolean
  }>
  retrieval: Readonly<{
    candidateCount: number
    selectedRequiredClaimIds: readonly string[]
    selectedExplanatoryClaimIds: readonly string[]
    confidence: number | null
    contribution: Readonly<{ lexical: number | null; semantic: number | null; graph: number | null }>
    comparisonSideACovered: boolean | null
    comparisonSideBCovered: boolean | null
    missingRequiredSlotIds: readonly string[]
  }>
  realization: Readonly<{
    provider: "luna" | "local" | "deterministic" | "none"
    status: "realized" | "repaired" | "deterministic_fallback" | "deterministic_only" | "not_answered"
    firstPassValidatorPassed: boolean | null
    repairValidatorPassed: boolean | null
    inputTokens: number
    cachedInputTokens: number
    outputTokens: number
    latencyMs: number
    costMicrousd: number
    cache: "hit" | "miss" | "not_applicable"
    lunaCalls: number
    repairCalls: number
  }>
  validation: Readonly<{
    pass: boolean
    wrongClaimSubstitution: number
    claimViolation: number
    relationViolation: number
    comparisonConclusionViolation: number
    unsupportedAddition: number
    sourceViolation: number
    safetyViolation: number
    failureCodes: readonly string[]
  }>
  quality: DnaS13CanaryQualityFields
  training: Readonly<{
    training_candidate: false
    exclude_from_training: true
    exclusion_reason: "review_pending" | "privacy_sensitive" | "validator_not_passed" | "fallback_or_rejected" | "not_answered"
  }>
  provenanceHash: string | null
  provenance: DnaS13RealizationProvenance | null
}>

export type DnaS13CanaryFeedbackRecord = Readonly<{
  schemaVersion: typeof DNA_S13_CANARY_FEEDBACK_VERSION
  sessionId: string
  messageId: string
  createdAt: string
  testerIdHash: string
  label: DnaS13CanaryFeedbackLabel
  note: string | null
  lunaValue: DnaS13CanaryLunaValueLabel | null
  quality: DnaS13CanaryQualityFields
}>

export type DnaS13CanaryTrainingAnnotation = Readonly<{
  schemaVersion: typeof DNA_S13_CANARY_TRAINING_ANNOTATION_VERSION
  sessionId: string
  messageId: string
  createdAt: string
  provenanceHash: string | null
  selectionPolicy: "latest_annotation_per_message"
  training_candidate: boolean
  exclude_from_training: boolean
  exclusion_reason: "reviewer_good" | "review_not_good" | "privacy_sensitive" | "validator_not_passed" | "fallback_or_rejected" | "no_provenance"
}>
