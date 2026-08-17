import type { DnaS13QueryFrame } from "./contracts"
import { dnaS13HasPresentationModifier } from "./pragmaticTask"
import {
  DNA_S13_STRICT_FAILURES,
  DNA_S13_STRICT_VALIDATOR_VERSION,
} from "./strictValidator"
import { hashDnaS13Artifact } from "./strictHash"
import { runDnaS13StrictPipeline, type DnaS13StrictPipelineResult } from "./strictPipeline"
import type { DnaS13StrictPlan } from "./strictContracts"
import { DeterministicRealizer, type DnaS13RealizerAttempt, type Realizer } from "./strictRealizer"
import {
  buildDnaS13RealizationProvenance,
  type DnaS13ArtifactFingerprint,
  type DnaS13PrivacyClassification,
  type DnaS13RealizationProvenance,
} from "./strictProvenance"

export const DNA_S13_SHADOW_VERSION = "dna-s13-realizer-shadow@1" as const

export type DnaS13StrictRuntimeResult = DnaS13StrictPipelineResult & Readonly<{
  attempts: readonly DnaS13RealizerAttempt[]
  provenance: DnaS13RealizationProvenance
}>

export const DNA_S13_SIMPLIFY_RESOLUTION_VERSION = "dna-s13-simplify-resolution@1" as const
export const DNA_S13_SIMPLIFY_QUALITY_LIMITATION = "SIMPLIFY_QUALITY_LIMITATION" as const

export type DnaS13SimplifyResolution = Readonly<{
  version: typeof DNA_S13_SIMPLIFY_RESOLUTION_VERSION
  deterministicFirst: true
  deterministicSuccess: boolean
  escalationEligible: boolean
  escalationTriggered: boolean
  escalationReasonCodes: readonly string[]
  lunaSuccess: boolean | null
  finalQualityStatus: "PASS" | typeof DNA_S13_SIMPLIFY_QUALITY_LIMITATION
}>

export type DnaS13SelectiveSimplifyRuntimeResult = DnaS13StrictRuntimeResult & Readonly<{
  simplifyResolution: DnaS13SimplifyResolution
}>

export type DnaS13StrictRuntimeInput = Readonly<{
  question: string
  normalizedQuestion: string
  queryFrame: DnaS13QueryFrame
  plan: DnaS13StrictPlan
  realizer: Realizer
  catalog: DnaS13ArtifactFingerprint
  retrieval: DnaS13ArtifactFingerprint
  privacy: DnaS13PrivacyClassification
  trainingCandidateRequested?: boolean
}>

function validatorFingerprint(): DnaS13ArtifactFingerprint {
  return Object.freeze({
    version: DNA_S13_STRICT_VALIDATOR_VERSION,
    hash: hashDnaS13Artifact({
      version: DNA_S13_STRICT_VALIDATOR_VERSION,
      failureCodes: DNA_S13_STRICT_FAILURES,
    }),
  })
}

export async function runDnaS13StrictRuntime(input: DnaS13StrictRuntimeInput): Promise<DnaS13StrictRuntimeResult> {
  const attempts: DnaS13RealizerAttempt[] = []
  const result = await runDnaS13StrictPipeline({
    plan: input.plan,
    realize: async ({ repair, previous }) => {
      const attempt = await input.realizer.realize({
        question: input.question,
        normalizedQuestion: input.normalizedQuestion,
        queryFrame: input.queryFrame,
        plan: input.plan,
        attempt: repair ? "repair" : "initial",
        validationFailureCodes: repair?.failureCodes ?? [],
        previousCandidate: previous ?? null,
      })
      attempts.push(attempt)
      return attempt.realization
    },
  })
  const provenance = buildDnaS13RealizationProvenance({
    question: input.question,
    normalizedQuestion: input.normalizedQuestion,
    queryFrame: input.queryFrame,
    plan: input.plan,
    result,
    attempts,
    catalog: input.catalog,
    retrieval: input.retrieval,
    validator: validatorFingerprint(),
    privacy: input.privacy,
    trainingCandidateRequested: input.trainingCandidateRequested,
  })
  return Object.freeze({ ...result, attempts: Object.freeze(attempts), provenance })
}

const SIMPLIFY_ESCALATION_FAILURES = new Set([
  "SIMPLIFY_NOT_TRANSFORMED",
  "SIMPLIFY_NO_OP",
  "SIMPLIFY_NOT_ACTUALLY_SIMPLIFIED",
  "SIMPLIFY_COMPLEXITY_INCREASED",
  "SIMPLIFY_LANGUAGE_FAILURE",
])
const SIMPLIFY_DERIVED_FAILURES = new Set(["ACTION_EXECUTION_INCORRECT", "FINAL_ANSWER_NOT_DIRECT"])

function rejectedFailureCodes(result: DnaS13StrictRuntimeResult) {
  return [...new Set(result.rejectedAttemptValidations.flatMap((validation) => validation.failureCodes))].sort()
}

function withSimplifyResolution(result: DnaS13StrictRuntimeResult, resolution: DnaS13SimplifyResolution) {
  return Object.freeze({ ...result, simplifyResolution: Object.freeze(resolution) })
}

/**
 * SIMPLIFY-only realization controller. The immutable plan is first rendered
 * provider-free. Luna may see that same plan only when the deterministic
 * rejection contains surface-quality failures and no routing, payload,
 * terminology, science, source, certainty, privacy, or safety failure.
 */
export async function runDnaS13SelectiveSimplifyRuntime(input: Omit<DnaS13StrictRuntimeInput, "realizer"> & Readonly<{
  lunaRealizer?: Realizer | null
  deterministicRealizer?: Realizer
}>): Promise<DnaS13SelectiveSimplifyRuntimeResult> {
  if (!dnaS13HasPresentationModifier(input.plan.pragmaticTaskFrame, "SIMPLIFY")) {
    throw new Error("dna_s13_selective_simplify_action_required")
  }
  const baseInput = {
    question: input.question,
    normalizedQuestion: input.normalizedQuestion,
    queryFrame: input.queryFrame,
    plan: input.plan,
    catalog: input.catalog,
    retrieval: input.retrieval,
    privacy: input.privacy,
    trainingCandidateRequested: input.trainingCandidateRequested,
  }
  const deterministic = await runDnaS13StrictRuntime({
    ...baseInput,
    realizer: input.deterministicRealizer ?? new DeterministicRealizer(),
  })
  const deterministicSuccess = deterministic.status !== "deterministic_fallback"
    && deterministic.finalValidation.pass && Boolean(deterministic.answer.trim())
  if (deterministicSuccess) {
    return withSimplifyResolution(deterministic, {
      version: DNA_S13_SIMPLIFY_RESOLUTION_VERSION,
      deterministicFirst: true,
      deterministicSuccess: true,
      escalationEligible: false,
      escalationTriggered: false,
      escalationReasonCodes: Object.freeze([]),
      lunaSuccess: null,
      finalQualityStatus: "PASS",
    })
  }
  const failureCodes = rejectedFailureCodes(deterministic)
  const substantiveFailures = failureCodes.filter((code) => !SIMPLIFY_DERIVED_FAILURES.has(code))
  const escalationEligible = substantiveFailures.length > 0
    && substantiveFailures.every((code) => SIMPLIFY_ESCALATION_FAILURES.has(code))
  if (!escalationEligible || !input.lunaRealizer) {
    return withSimplifyResolution(deterministic, {
      version: DNA_S13_SIMPLIFY_RESOLUTION_VERSION,
      deterministicFirst: true,
      deterministicSuccess: false,
      escalationEligible,
      escalationTriggered: false,
      escalationReasonCodes: Object.freeze(substantiveFailures),
      lunaSuccess: null,
      finalQualityStatus: DNA_S13_SIMPLIFY_QUALITY_LIMITATION,
    })
  }
  try {
    const luna = await runDnaS13StrictRuntime({ ...baseInput, realizer: input.lunaRealizer })
    const lunaSuccess = luna.status !== "deterministic_fallback"
      && luna.finalValidation.pass && Boolean(luna.answer.trim())
    return withSimplifyResolution(luna, {
      version: DNA_S13_SIMPLIFY_RESOLUTION_VERSION,
      deterministicFirst: true,
      deterministicSuccess: false,
      escalationEligible: true,
      escalationTriggered: true,
      escalationReasonCodes: Object.freeze(substantiveFailures),
      lunaSuccess,
      finalQualityStatus: lunaSuccess ? "PASS" : DNA_S13_SIMPLIFY_QUALITY_LIMITATION,
    })
  } catch {
    return withSimplifyResolution(deterministic, {
      version: DNA_S13_SIMPLIFY_RESOLUTION_VERSION,
      deterministicFirst: true,
      deterministicSuccess: false,
      escalationEligible: true,
      escalationTriggered: true,
      escalationReasonCodes: Object.freeze(substantiveFailures),
      lunaSuccess: false,
      finalQualityStatus: DNA_S13_SIMPLIFY_QUALITY_LIMITATION,
    })
  }
}

export type DnaS13ShadowComparison = Readonly<{
  version: typeof DNA_S13_SHADOW_VERSION
  publicAnswer: string
  primary: DnaS13StrictRuntimeResult
  shadow: Readonly<{
    displayEligible: false
    result: DnaS13StrictRuntimeResult
  }>
  comparison: Readonly<{
    sameStatus: boolean
    exactAnswerMatch: boolean
    bothValidatorPassed: boolean
    primaryProvider: string
    shadowProvider: string
  }>
}>

/**
 * Runs both realizers on the same immutable locked plan. The shadow answer is
 * structurally marked as non-displayable and never selects the public answer.
 */
export async function runDnaS13StrictShadow(input: Readonly<{
  primary: DnaS13StrictRuntimeInput
  shadow: Omit<DnaS13StrictRuntimeInput, "question" | "normalizedQuestion" | "queryFrame" | "plan" | "catalog" | "retrieval" | "privacy">
}>): Promise<DnaS13ShadowComparison> {
  const [primary, shadow] = await Promise.all([
    runDnaS13StrictRuntime(input.primary),
    runDnaS13StrictRuntime({
      ...input.primary,
      ...input.shadow,
      trainingCandidateRequested: false,
    }),
  ])
  return Object.freeze({
    version: DNA_S13_SHADOW_VERSION,
    publicAnswer: primary.answer,
    primary,
    shadow: Object.freeze({ displayEligible: false as const, result: shadow }),
    comparison: Object.freeze({
      sameStatus: primary.status === shadow.status,
      exactAnswerMatch: primary.answer === shadow.answer,
      bothValidatorPassed: primary.validation.pass && shadow.validation.pass,
      primaryProvider: primary.provenance.realizer.provider,
      shadowProvider: shadow.provenance.realizer.provider,
    }),
  })
}
