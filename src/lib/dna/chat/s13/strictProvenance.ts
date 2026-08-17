import { inspectDnaChatSafety } from "../safety"
import { normalizeDnaChatText } from "../text"
import type { DnaS13Claim, DnaS13QueryFrame } from "./contracts"
import { hashDnaS13Artifact, stableDnaS13Json } from "./strictHash"
import type { DnaS13RealizerAttempt } from "./strictRealizer"
import type { DnaS13StrictPlan } from "./strictContracts"
import type { DnaS13StrictPipelineResult } from "./strictPipeline"
import type { DnaS13StrictValidation } from "./strictValidator"

export const DNA_S13_PROVENANCE_VERSION = "dna-s13-realization-provenance@1" as const
export const DNA_S13_TRAINING_EXPORT_VERSION = "dna-s13-training-export@1" as const

export type DnaS13ArtifactFingerprint = Readonly<{
  version: string
  hash: string
}>

export type DnaS13PrivacyCategory =
  | "synthetic_non_sensitive"
  | "general_non_sensitive"
  | "clinical_case"
  | "personal_data"
  | "sensitive_or_unknown"

export type DnaS13PrivacyClassification = Readonly<{
  category: DnaS13PrivacyCategory
  containsClinicalOrCaseData: boolean
  containsPersonalData: boolean
  automaticTrainingAllowed: boolean
  reasons: readonly string[]
}>

export type DnaS13PrivacyContext = "synthetic" | "general" | "clinical_case" | "unknown"

const CASE_MARKERS = [
  "vaka", "danisan", "danışan", "hasta", "anamnez", "seans", "raporunda",
  "degerlendirme sonucu", "değerlendirme sonucu", "bu cocuk", "bu çocuk", "cocugum", "çocuğum",
] as const

export function classifyDnaS13Privacy(input: Readonly<{
  question: string
  context: DnaS13PrivacyContext
}>): DnaS13PrivacyClassification {
  const normalized = normalizeDnaChatText(input.question)
  const safety = inspectDnaChatSafety(input.question)
  const personal = safety.category === "privacy"
  const clinical = input.context === "clinical_case"
    || CASE_MARKERS.some((marker) => normalized.includes(normalizeDnaChatText(marker)))

  if (personal) {
    return Object.freeze({
      category: "personal_data",
      containsClinicalOrCaseData: clinical,
      containsPersonalData: true,
      automaticTrainingAllowed: false,
      reasons: Object.freeze(["direct_or_inferred_personal_identifier"]),
    })
  }
  if (clinical) {
    return Object.freeze({
      category: "clinical_case",
      containsClinicalOrCaseData: true,
      containsPersonalData: false,
      automaticTrainingAllowed: false,
      reasons: Object.freeze(["clinical_or_case_context"]),
    })
  }
  if (input.context === "synthetic") {
    return Object.freeze({
      category: "synthetic_non_sensitive",
      containsClinicalOrCaseData: false,
      containsPersonalData: false,
      automaticTrainingAllowed: true,
      reasons: Object.freeze(["explicit_synthetic_context"]),
    })
  }
  if (input.context === "general" && !safety.blocked) {
    return Object.freeze({
      category: "general_non_sensitive",
      containsClinicalOrCaseData: false,
      containsPersonalData: false,
      automaticTrainingAllowed: true,
      reasons: Object.freeze(["general_non_sensitive_context"]),
    })
  }
  return Object.freeze({
    category: "sensitive_or_unknown",
    containsClinicalOrCaseData: false,
    containsPersonalData: false,
    automaticTrainingAllowed: false,
    reasons: Object.freeze([safety.blocked ? "safety_blocked" : "privacy_context_not_confirmed"]),
  })
}

export type DnaS13TrainingExclusionReason =
  | "not_requested"
  | "validator_not_passed"
  | "fallback_or_rejected"
  | "privacy_sensitive"
  | "no_accepted_target"
  | null

export type DnaS13TrainingDisposition = Readonly<{
  training_candidate: boolean
  exclude_from_training: boolean
  exclusion_reason: DnaS13TrainingExclusionReason
}>

export type DnaS13RealizationProvenance = Readonly<{
  schemaVersion: typeof DNA_S13_PROVENANCE_VERSION
  question: string
  normalizedQuestion: string
  queryFrame: DnaS13QueryFrame
  requiredAnswerSlots: DnaS13StrictPlan["slots"]
  requiredClaimIds: readonly string[]
  explanatoryClaimIds: readonly string[]
  lockedContentPlan: DnaS13StrictPlan
  realizer: DnaS13RealizerAttempt["identity"]
  prompt: DnaS13ArtifactFingerprint
  repairPrompt: DnaS13ArtifactFingerprint | null
  catalog: DnaS13ArtifactFingerprint
  retrieval: DnaS13ArtifactFingerprint
  validator: DnaS13ArtifactFingerprint
  rawFirstOutput: string | null
  rawRepairOutput: string | null
  finalAcceptedOutput: string | null
  status: "accepted" | "repaired" | "rejected" | "fallback"
  finalValidation: DnaS13StrictValidation
  rejectedAttemptValidations: readonly DnaS13StrictValidation[]
  validatorFailureCodes: readonly string[]
  rejectedAttemptValidatorFailureCodes: readonly string[]
  usage: DnaS13RealizerAttempt["usage"]
  latencyMs: number
  costMicrousd: number
  privacy: DnaS13PrivacyClassification
  training_candidate: boolean
  exclude_from_training: boolean
  exclusion_reason: DnaS13TrainingExclusionReason
  provenanceHash: string
}>

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function assertFingerprint(name: string, value: DnaS13ArtifactFingerprint) {
  if (!value.version.trim() || !/^[a-f0-9]{64}$/u.test(value.hash)) {
    throw new Error(`dna_s13_provenance_${name}_fingerprint_invalid`)
  }
}

function trainingDisposition(input: Readonly<{
  requested: boolean
  result: DnaS13StrictPipelineResult
  privacy: DnaS13PrivacyClassification
}>): DnaS13TrainingDisposition {
  if (!input.requested) return { training_candidate: false, exclude_from_training: true, exclusion_reason: "not_requested" }
  if (!input.privacy.automaticTrainingAllowed) return { training_candidate: false, exclude_from_training: true, exclusion_reason: "privacy_sensitive" }
  if (input.result.status === "deterministic_fallback") return { training_candidate: false, exclude_from_training: true, exclusion_reason: "fallback_or_rejected" }
  if (!input.result.finalValidation.pass) return { training_candidate: false, exclude_from_training: true, exclusion_reason: "validator_not_passed" }
  if (!input.result.answer.trim()) return { training_candidate: false, exclude_from_training: true, exclusion_reason: "no_accepted_target" }
  return { training_candidate: true, exclude_from_training: false, exclusion_reason: null }
}

function sumUsage(attempts: readonly DnaS13RealizerAttempt[]): DnaS13RealizerAttempt["usage"] {
  return Object.freeze(attempts.reduce((total, attempt) => ({
    inputTokens: total.inputTokens + attempt.usage.inputTokens,
    cachedInputTokens: total.cachedInputTokens + attempt.usage.cachedInputTokens,
    outputTokens: total.outputTokens + attempt.usage.outputTokens,
    costMicrousd: total.costMicrousd + attempt.usage.costMicrousd,
  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }))
}

export function buildDnaS13RealizationProvenance(input: Readonly<{
  question: string
  normalizedQuestion: string
  queryFrame: DnaS13QueryFrame
  plan: DnaS13StrictPlan
  result: DnaS13StrictPipelineResult
  attempts: readonly DnaS13RealizerAttempt[]
  catalog: DnaS13ArtifactFingerprint
  retrieval: DnaS13ArtifactFingerprint
  validator: DnaS13ArtifactFingerprint
  privacy: DnaS13PrivacyClassification
  trainingCandidateRequested?: boolean
}>): DnaS13RealizationProvenance {
  const first = input.attempts[0] ?? null
  const repair = input.attempts[1] ?? null
  if (!first) throw new Error("dna_s13_provenance_first_attempt_missing")
  assertFingerprint("prompt", first.prompt)
  if (repair) assertFingerprint("repair_prompt", repair.prompt)
  assertFingerprint("catalog", input.catalog)
  assertFingerprint("retrieval", input.retrieval)
  assertFingerprint("validator", input.validator)
  const usage = sumUsage(input.attempts)
  const disposition = trainingDisposition({
    requested: input.trainingCandidateRequested !== false,
    result: input.result,
    privacy: input.privacy,
  })
  const base = {
    schemaVersion: DNA_S13_PROVENANCE_VERSION,
    question: input.question,
    normalizedQuestion: input.normalizedQuestion,
    queryFrame: input.queryFrame,
    requiredAnswerSlots: input.plan.slots,
    requiredClaimIds: Object.freeze(unique(input.plan.slots.flatMap((slot) => slot.requiredClaimIds))),
    explanatoryClaimIds: Object.freeze(unique(input.plan.slots.flatMap((slot) =>
      slot.lockedClaims.filter((entry) => entry.role === "explanatory").map((entry) => entry.claim.id),
    ))),
    lockedContentPlan: input.plan,
    realizer: first.identity,
    prompt: first.prompt,
    repairPrompt: repair?.prompt ?? null,
    catalog: input.catalog,
    retrieval: input.retrieval,
    validator: input.validator,
    rawFirstOutput: first.rawOutput,
    rawRepairOutput: repair?.rawOutput ?? null,
    finalAcceptedOutput: input.result.answer.trim() || null,
    status: input.result.status === "realized" ? "accepted" as const
      : input.result.status === "repaired" ? "repaired" as const
        : "fallback" as const,
    finalValidation: input.result.finalValidation,
    rejectedAttemptValidations: input.result.rejectedAttemptValidations,
    validatorFailureCodes: Object.freeze([...input.result.finalValidation.failureCodes]),
    rejectedAttemptValidatorFailureCodes: Object.freeze(unique(input.result.rejectedAttemptValidations.flatMap((validation) => validation.failureCodes))),
    usage,
    latencyMs: input.attempts.reduce((total, attempt) => total + attempt.latencyMs, 0),
    costMicrousd: usage.costMicrousd,
    privacy: input.privacy,
    ...disposition,
  }
  return Object.freeze({ ...base, provenanceHash: hashDnaS13Artifact(base) })
}

export type DnaS13TrainingExportRecord = Readonly<{
  schema_version: typeof DNA_S13_TRAINING_EXPORT_VERSION
  question: string
  query_frame: DnaS13QueryFrame
  locked_plan: DnaS13StrictPlan
  approved_claims: readonly DnaS13Claim[]
  target_answer: string
  metadata: Readonly<{
    provenance_hash: string
    realizer: DnaS13RealizerAttempt["identity"]
    prompt: DnaS13ArtifactFingerprint
    catalog: DnaS13ArtifactFingerprint
    retrieval: DnaS13ArtifactFingerprint
    validator: DnaS13ArtifactFingerprint
    privacy: DnaS13PrivacyClassification
    training_candidate: true
    exclude_from_training: false
    exclusion_reason: null
  }>
}>

export function toDnaS13TrainingExportRecord(
  provenance: DnaS13RealizationProvenance,
): DnaS13TrainingExportRecord | null {
  if (!provenance.training_candidate || provenance.exclude_from_training || !provenance.finalAcceptedOutput) return null
  const claims = provenance.lockedContentPlan.slots.flatMap((slot) => slot.lockedClaims.map((entry) => entry.claim))
  const uniqueClaims = [...new Map(claims.map((claim) => [claim.id, claim])).values()]
  return Object.freeze({
    schema_version: DNA_S13_TRAINING_EXPORT_VERSION,
    question: provenance.question,
    query_frame: provenance.queryFrame,
    locked_plan: provenance.lockedContentPlan,
    approved_claims: Object.freeze(uniqueClaims),
    target_answer: provenance.finalAcceptedOutput,
    metadata: Object.freeze({
      provenance_hash: provenance.provenanceHash,
      realizer: provenance.realizer,
      prompt: provenance.prompt,
      catalog: provenance.catalog,
      retrieval: provenance.retrieval,
      validator: provenance.validator,
      privacy: provenance.privacy,
      training_candidate: true as const,
      exclude_from_training: false as const,
      exclusion_reason: null,
    }),
  })
}

/** Pure serializer only; callers choose an approved destination in a separate step. */
export function serializeDnaS13TrainingJsonl(records: readonly DnaS13RealizationProvenance[]) {
  const rows = records.flatMap((record) => {
    const exportRecord = toDnaS13TrainingExportRecord(record)
    return exportRecord ? [stableDnaS13Json(exportRecord)] : []
  })
  return rows.length ? `${rows.join("\n")}\n` : ""
}
