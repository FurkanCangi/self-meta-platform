import { normalizeDnaChatText } from "../text"
import { dnaS13HasPresentationModifier } from "./pragmaticTask"
import type { DnaS13StrictPlan, DnaS13StrictRealization } from "./strictContracts"

export const DNA_S13_SEMANTIC_ACTION_VALIDATOR_VERSION = "dna-s13-semantic-action-validator@5" as const

export type DnaS13SemanticActionValidation = Readonly<{
  routingCorrect: boolean
  actionLabelCorrect: boolean
  actionExecutionCorrect: boolean
  facetEntailmentCorrect: boolean
  finalAnswerDirect: boolean
  finalAnswerNonempty: boolean
  definitionSemanticEntailment: boolean | null
  simplifyNoOp: boolean | null
  simplifyActualTransformation: boolean | null
  simplifyMainMeaningRetained: boolean | null
  simplifyComplexityIncreased: boolean | null
  simplifyLanguageFailure: boolean | null
  simplifyTerminologyDriftTerms: readonly string[]
  deepenEvidenceEligible: boolean | null
  deepenInformationGain: boolean | null
  compareEvidenceEligible: boolean | null
  compareExplicitContrast: boolean | null
  safeEvidenceLimitation: boolean
  failureCodes: readonly string[]
}>

function bigrams(value: string) {
  const values = normalizeDnaChatText(value).split(/\s+/u).filter(Boolean)
  return new Set(values.length < 2 ? values : values.slice(0, -1).map((token, index) => `${token} ${values[index + 1]}`))
}

export function dnaS13SemanticSimilarity(left: string, right: string) {
  const a = bigrams(left)
  const b = bigrams(right)
  const union = new Set([...a, ...b])
  return union.size ? [...a].filter((value) => b.has(value)).length / union.size : 1
}

function withoutSimplifyFraming(value: string) {
  return value.replace(/^(?:Günlük dille|En yalın hâliyle):\s*/iu, "").trim()
}

const PROTECTED_SIMPLIFY_TERMS = Object.freeze([
  "self-regülasyon", "interosepsiyon", "arousal", "reaktivite", "toparlanma", "yürütücü işlev", "okupasyon",
])
const SIMPLIFY_STOP = new Set(["acikca", "ayrica", "bunun", "icin", "olarak", "olan", "temel", "yani", "veya"])
const SIMPLIFY_ACADEMIC = /\b(?:araciligiyla|bilesen\w*|degerlendiril\w*|fizyolojik|algoritmik|disiplinler|gastrointestinal|inhibisyon|otonom|ornegin)\b/gu
const SIMPLIFY_EQUIVALENCE_FAMILIES = Object.freeze([
  Object.freeze(["katki", "yardim"]), Object.freeze(["bilesen", "parca"]),
  Object.freeze(["islev", "gorev"]), Object.freeze(["yanit", "tepki"]),
  Object.freeze(["gereksin", "ihtiyac"]), Object.freeze(["etkisiz", "yaramayan"]),
  Object.freeze(["fark", "ayir", "sec"]), Object.freeze(["uygulama", "adim"]),
  Object.freeze(["motor", "hareket"]), Object.freeze(["literatur", "yayin", "yazin"]),
])

function contentTokens(value: string) {
  return normalizeDnaChatText(value).split(/\s+/u)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 5 && !SIMPLIFY_STOP.has(token))
}

function sameContentFamily(left: string, right: string) {
  if (left === right || (left.length >= 6 && right.length >= 6 && left.slice(0, 6) === right.slice(0, 6))) return true
  return SIMPLIFY_EQUIVALENCE_FAMILIES.some((family) =>
    family.some((stem) => left.startsWith(stem)) && family.some((stem) => right.startsWith(stem)))
}

function sameSurfaceFamily(left: string, right: string) {
  return left === right || (left.length >= 6 && right.length >= 6 && left.slice(0, 6) === right.slice(0, 6))
}

function changedContentTokenCount(source: string, realized: string) {
  const sourceTokens = contentTokens(source)
  const targetTokens = contentTokens(realized)
  return sourceTokens.filter((sourceToken) =>
    !targetTokens.some((targetToken) => sameSurfaceFamily(sourceToken, targetToken))).length
}

function mainMeaningRetention(source: string, realized: string) {
  const sourceTokens = contentTokens(source)
  if (!sourceTokens.length) return true
  const targetTokens = contentTokens(realized)
  const retained = sourceTokens.filter((sourceToken) =>
    targetTokens.some((targetToken) => sameContentFamily(sourceToken, targetToken))).length
  return retained / sourceTokens.length >= 0.38
}

function sentenceTokenCounts(value: string) {
  return value.split(/(?<=[.!?;])\s+/u).map((sentence) =>
    normalizeDnaChatText(sentence).split(/\s+/u).filter(Boolean).length).filter(Boolean)
}

function simplifyComplexity(value: string) {
  const normalized = normalizeDnaChatText(value)
  const tokens = normalized.split(/\s+/u).filter(Boolean)
  const sentences = sentenceTokenCounts(value)
  const meanWordLength = tokens.reduce((sum, token) => sum + token.length, 0) / Math.max(1, tokens.length)
  const longWordRatio = tokens.filter((token) => token.length >= 10).length / Math.max(1, tokens.length)
  const maxSentenceLength = Math.max(0, ...sentences)
  const academicBurden = normalized.match(SIMPLIFY_ACADEMIC)?.length ?? 0
  return meanWordLength + longWordRatio * 4 + maxSentenceLength * 0.08 + academicBurden * 0.8
}

function academicBurden(value: string) {
  return normalizeDnaChatText(value).match(SIMPLIFY_ACADEMIC)?.length ?? 0
}

function languageFailure(value: string) {
  return !value.trim() || /\b(?:olarak olarak|gibi gibi|ve ve|bir bir)\b/iu.test(value)
    || /[.!?]\s+[a-zçğıöşü]/u.test(value)
}

function substantiveSimplification(source: string, realized: string) {
  const sourceSentences = sentenceTokenCounts(source)
  const realizedSentences = sentenceTokenCounts(realized)
  const sourceMax = Math.max(0, ...sourceSentences)
  const realizedMax = Math.max(0, ...realizedSentences)
  return changedContentTokenCount(source, realized) >= 2
    || academicBurden(realized) < academicBurden(source)
    || (sourceMax >= 12 && realizedMax <= sourceMax * 0.85)
    || (realizedSentences.length > sourceSentences.length && realizedMax < sourceMax)
    || realized.length <= source.length * 0.9
}

function terminologyDrift(source: string, realized: string) {
  const sourceLower = source.toLocaleLowerCase("tr-TR")
  const realizedLower = realized.toLocaleLowerCase("tr-TR")
  return PROTECTED_SIMPLIFY_TERMS.filter((term) => sourceLower.includes(term) && !realizedLower.includes(term))
}

export function validateDnaS13SemanticAction(input: Readonly<{
  plan: DnaS13StrictPlan
  realization: DnaS13StrictRealization
  requiredSlotCoveragePercent: number
  requiredClaimCoveragePercent: number
  correctionRejectedTargetLeakCount: number
  subquestionOrderViolationCount: number
  facetEntailmentFalsePositiveCount: number
  invalidClaimRoleCount: number
  unsupportedAdditionCount: number
  unsupportedRelationCount: number
  sourceViolationCount: number
  safetyViolationCount: number
  allowUntransformedSimplifyFallback?: boolean
}>): DnaS13SemanticActionValidation {
  const failures = new Set<string>()
  const action = input.plan.pragmaticTaskFrame?.pragmaticAction ?? null
  const simplifyPresentation = dnaS13HasPresentationModifier(input.plan.pragmaticTaskFrame, "SIMPLIFY")
  const bySlot = new Map(input.realization.slotRealizations.map((slot) => [slot.slotId, slot]))
  const finalText = input.realization.slotRealizations.map((slot) => slot.text.trim()).filter(Boolean).join("\n\n")
  const finalAnswerNonempty = finalText.length > 0
  if (!finalAnswerNonempty) failures.add("FINAL_ANSWER_EMPTY")

  const slotTopicIds = new Set(input.plan.slots.filter((slot) => slot.kind !== "comparison_conclusion").map((slot) => slot.topicId))
  const activeTargetIds = new Set(input.plan.semanticOperationAudit?.targets
    .filter((target) => target.polarity === "ACTIVE_TARGET").map((target) => target.topicId) ?? [])
  const routingCorrect = input.correctionRejectedTargetLeakCount === 0
    && input.subquestionOrderViolationCount === 0
    && (activeTargetIds.size === 0 || [...activeTargetIds].every((topicId) => slotTopicIds.has(topicId)))
  if (!routingCorrect) failures.add("ROUTING_NOT_SEMANTICALLY_CONSISTENT")
  const actionLabelCorrect = action !== null

  const supported = (input.plan.facetEvidenceMatrix ?? []).filter((entry) =>
    entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
  const unsupported = (input.plan.facetEvidenceMatrix ?? []).filter((entry) => entry.status === "UNSUPPORTED")
  const plannedEvidenceLimitation = (input.plan.evidenceLimitations ?? []).length > 0
  let safeEvidenceLimitation = plannedEvidenceLimitation
  const facetEntailmentCorrect = input.facetEntailmentFalsePositiveCount === 0 && input.invalidClaimRoleCount === 0
  if (!facetEntailmentCorrect) failures.add("FACET_ENTAILMENT_INCORRECT")

  let definitionSemanticEntailment: boolean | null = null
  let simplifyNoOp: boolean | null = null
  let simplifyActualTransformation: boolean | null = null
  let simplifyMainMeaningRetained: boolean | null = null
  let simplifyComplexityIncreased: boolean | null = null
  let simplifyLanguageFailure: boolean | null = null
  let simplifyTerminologyDriftTerms: readonly string[] = Object.freeze([])
  let deepenEvidenceEligible: boolean | null = null
  let deepenInformationGain: boolean | null = null
  let compareEvidenceEligible: boolean | null = null
  let compareExplicitContrast: boolean | null = null
  let actionExecutionCorrect = true

  if (action === "DEFINE") {
    if (supported.length === 0) {
      actionExecutionCorrect = safeEvidenceLimitation
    } else {
      const conceptTypes = new Map((input.plan.topicConceptTypes ?? []).map((entry) => [entry.topicId, entry.conceptType]))
      definitionSemanticEntailment = supported.filter((entry) => entry.facet === "definition").every((entry) => {
        const conceptType = conceptTypes.get(entry.topicId) ?? "CANONICAL_CONCEPT"
        return conceptType === "CANONICAL_CONCEPT"
          ? entry.status === "SUPPORTED_DIRECT" && entry.allowedDerivationType === null
          : entry.status === "SUPPORTED_DERIVED" && entry.allowedDerivationType === "heading_scope_for_definition"
      }) && supported.some((entry) => entry.facet === "definition")
      actionExecutionCorrect = definitionSemanticEntailment
    }
  } else if (action === "DEEPEN") {
    const audit = input.plan.semanticOperationAudit
    deepenEvidenceEligible = Boolean(audit && (audit.newClaimIds.length || audit.newAnsweredFacets.length || audit.newRelationIds.length))
    deepenInformationGain = deepenEvidenceEligible ? audit?.followupInformationGain === true : null
    actionExecutionCorrect = deepenEvidenceEligible ? deepenInformationGain === true : safeEvidenceLimitation
  } else if (action === "COMPARE") {
    const sideSlots = input.plan.slots.filter((slot) => slot.kind === "comparison_side")
    const conclusion = input.plan.slots.find((slot) => slot.kind === "comparison_conclusion")
    const safeComparisonAbstention = conclusion?.comparisonConclusionMode === "abstain"
      && Boolean(conclusion.controlledText?.trim())
    safeEvidenceLimitation = safeEvidenceLimitation || safeComparisonAbstention
    compareEvidenceEligible = sideSlots.length === 2 && sideSlots.every((slot) => slot.lockedClaimIds.length > 0)
      && Boolean(conclusion && conclusion.comparisonConclusionMode !== "abstain")
    compareExplicitContrast = compareEvidenceEligible ? Boolean(conclusion?.controlledText
      && conclusion.comparisonConclusionSupportClaimIds?.length
      && ["direct", "safe_categorical_inference", "contrast_by_verified_definitions"].includes(conclusion.comparisonConclusionMode ?? "")) : null
    actionExecutionCorrect = compareEvidenceEligible ? compareExplicitContrast === true : safeComparisonAbstention || plannedEvidenceLimitation
  }

  if (simplifyPresentation) {
    const baseActionExecutionCorrect = actionExecutionCorrect
    const answerSlots = input.plan.slots.filter((slot) =>
      slot.kind !== "comparison_conclusion" && slot.kind !== "evidence_limitation" && slot.lockedClaimIds.length > 0)
    const pairs = answerSlots.map((slot) => Object.freeze({
      source: slot.lockedClaims.map((entry) => entry.claim.text).join(" "),
      realized: withoutSimplifyFraming(bySlot.get(slot.id)?.text ?? ""),
    }))
    simplifyNoOp = pairs.length > 0 && pairs.some((pair) => !substantiveSimplification(pair.source, pair.realized))
    simplifyMainMeaningRetained = pairs.length > 0 && pairs.every((pair) => mainMeaningRetention(pair.source, pair.realized))
    simplifyComplexityIncreased = pairs.some((pair) => {
      const sourceMax = Math.max(0, ...sentenceTokenCounts(pair.source))
      const realizedMax = Math.max(0, ...sentenceTokenCounts(pair.realized))
      return simplifyComplexity(pair.realized) > simplifyComplexity(pair.source) * 1.12
        && (realizedMax > sourceMax || academicBurden(pair.realized) > academicBurden(pair.source))
    })
    simplifyLanguageFailure = pairs.some((pair) => languageFailure(pair.realized))
    simplifyTerminologyDriftTerms = Object.freeze([...new Set(pairs.flatMap((pair) => terminologyDrift(pair.source, pair.realized)))])
    simplifyActualTransformation = pairs.length > 0 && pairs.every((pair) => substantiveSimplification(pair.source, pair.realized))
    const surfaceExecutionCorrect = input.allowUntransformedSimplifyFallback
      ? answerSlots.length > 0
      : answerSlots.length > 0
        ? simplifyActualTransformation && simplifyMainMeaningRetained
          && !simplifyComplexityIncreased && simplifyTerminologyDriftTerms.length === 0
          && !simplifyLanguageFailure
        : safeEvidenceLimitation
    actionExecutionCorrect = baseActionExecutionCorrect && surfaceExecutionCorrect
    if (!input.allowUntransformedSimplifyFallback) {
      if (!simplifyActualTransformation) failures.add("SIMPLIFY_NOT_ACTUALLY_SIMPLIFIED")
      if (!simplifyMainMeaningRetained) failures.add("SIMPLIFY_MAIN_MEANING_NOT_ENTAILED")
      if (simplifyComplexityIncreased) failures.add("SIMPLIFY_COMPLEXITY_INCREASED")
      if (simplifyLanguageFailure) failures.add("SIMPLIFY_LANGUAGE_FAILURE")
      if (simplifyTerminologyDriftTerms.length) failures.add("SIMPLIFY_TERMINOLOGY_DRIFT")
    }
  }

  if (!actionExecutionCorrect) failures.add("ACTION_EXECUTION_INCORRECT")
  const grounded = input.requiredSlotCoveragePercent === 100 && input.requiredClaimCoveragePercent === 100
    && input.unsupportedAdditionCount === 0 && input.unsupportedRelationCount === 0
    && input.sourceViolationCount === 0 && input.safetyViolationCount === 0
  const finalAnswerDirect = finalAnswerNonempty && actionExecutionCorrect && facetEntailmentCorrect && grounded
  if (!finalAnswerDirect) failures.add("FINAL_ANSWER_NOT_DIRECT")

  return Object.freeze({
    routingCorrect, actionLabelCorrect, actionExecutionCorrect, facetEntailmentCorrect,
    finalAnswerDirect, finalAnswerNonempty, definitionSemanticEntailment, simplifyNoOp,
    simplifyActualTransformation, simplifyMainMeaningRetained, simplifyComplexityIncreased, simplifyLanguageFailure,
    simplifyTerminologyDriftTerms,
    deepenEvidenceEligible, deepenInformationGain, compareEvidenceEligible, compareExplicitContrast,
    safeEvidenceLimitation, failureCodes: Object.freeze([...failures].sort()),
  })
}
