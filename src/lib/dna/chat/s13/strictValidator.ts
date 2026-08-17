import { normalizeDnaChatText } from "../text"
import type { DnaS13Claim } from "./contracts"
import { dnaS13HasPresentationModifier } from "./pragmaticTask"
import { deriveDnaS13ComparisonConclusion } from "./strictComparisonConclusion"
import type {
  DnaS13StrictPlan,
  DnaS13StrictRealization,
  DnaS13StrictSlot,
  DnaS13StrictSlotRealization,
} from "./strictContracts"
import { detectDnaS13Relations, relationMarkerAllowed } from "./strictRelations"
import { claimRoleSupportsFacet } from "./topicSemantic"
import { validateDnaS13SemanticAction, type DnaS13SemanticActionValidation } from "./semanticActionValidator"

export const DNA_S13_STRICT_VALIDATOR_VERSION = "dna-s13-strict-validator@15" as const

export const DNA_S13_STRICT_FAILURES = [
  "unsupported_addition_declared",
  "slot_order_changed",
  "required_slot_uncovered",
  "wrong_claim_substitution",
  "required_claim_missing",
  "locked_claim_missing",
  "claim_reused_across_slots",
  "comparison_side_uncovered",
  "comparison_conclusion_uncovered",
  "comparison_conclusion_unsupported",
  "unsupported_relation_addition",
  "source_violation",
  "invented_number",
  "age_scope_changed",
  "negation_changed",
  "causality_escalated",
  "epistemic_force_escalated",
  "safety_violation",
  "unaligned_factual_sentence",
  "SUPPORTED_FACET_OMITTED",
  "facet_evidence_invalid",
  "facet_entailment_invalid",
  "rejected_target_in_plan",
  "subquestion_order_violation",
  "evidence_limitation_mismatch",
  "internal_evidence_jargon",
  "TOPIC_THESIS_CONTRADICTION",
  "INVALID_CLAIM_ROLE_FOR_FACET",
  "non_self_contained_final_claim",
  "DEFINE_NOT_SATISFIED",
  "WHY_NOT_SATISFIED",
  "DEEPEN_NO_INFORMATION_GAIN",
  "EXAMPLE_NOT_SATISFIED",
  "COMPARE_CONCLUSION_NOT_INFORMATIVE",
  "FINAL_ANSWER_EMPTY",
  "ROUTING_NOT_SEMANTICALLY_CONSISTENT",
  "FACET_ENTAILMENT_INCORRECT",
  "ACTION_EXECUTION_INCORRECT",
  "FINAL_ANSWER_NOT_DIRECT",
  "SIMPLIFY_NOT_TRANSFORMED",
  "SIMPLIFY_NOT_ACTUALLY_SIMPLIFIED",
  "SIMPLIFY_MAIN_MEANING_NOT_ENTAILED",
  "SIMPLIFY_COMPLEXITY_INCREASED",
  "SIMPLIFY_LANGUAGE_FAILURE",
  "SIMPLIFY_TERMINOLOGY_DRIFT",
  "SIMPLIFY_MAIN_MEANING_UNSUPPORTED",
  "CONTEXTUAL_SIMPLIFY_PAYLOAD_CHANGED",
  "REQUESTED_SLOT_SILENTLY_DROPPED",
] as const

export type DnaS13StrictFailure = typeof DNA_S13_STRICT_FAILURES[number]
export type DnaS13StrictRelationCheck = Readonly<{
  slotId: string
  type: string
  marker: string
  supported: boolean
  contractId: string | null
}>
export type DnaS13StrictValidation = Readonly<{
  pass: boolean
  failureCodes: readonly DnaS13StrictFailure[]
  requiredSlotCoveragePercent: number
  requestedSlotCount: number
  answeredSupportedSlotCount: number
  answeredUnsupportedSlotCount: number
  silentlyDroppedRequestedSlotCount: number
  requiredClaimCoveragePercent: number
  sentenceCoveragePercent: number
  wrongClaimSubstitutionCount: number
  unsupportedAdditionCount: number
  sourceViolationCount: number
  safetyViolationCount: number
  unsupportedRelationCount: number
  relationChecks: readonly DnaS13StrictRelationCheck[]
  comparisonSideCoveragePercent: number
  comparisonConclusionCoveragePercent: number
  comparisonSideASupported: boolean
  comparisonSideBSupported: boolean
  comparisonConclusionSupported: boolean
  requestedFacetCount: number
  directSupportedFacetCount: number
  derivedSupportedFacetCount: number
  unsupportedFacetCount: number
  omittedSupportedFacetCount: number
  facetEntailmentFalsePositiveCount: number
  falseExampleSupportCount: number
  falseSignificanceSupportCount: number
  correctionRejectedTargetLeakCount: number
  followupInformationGain: boolean | null
  subquestionOrderViolationCount: number
  topicThesisContradictionCount: number
  invalidClaimRoleCount: number
  nonSelfContainedFinalClaimCount: number
  semanticRepeatWithoutNeedCount: number
  comparisonUserFacingSpecificity: boolean | null
  answerSufficiency: Readonly<{
    sufficient: number
    partiallySufficient: number
    insufficientWithAvailableEvidence: number
  }>
  semanticAction: DnaS13SemanticActionValidation
  simplifyMainMeaningEligibleCount: number
  simplifyMainMeaningSupportedCount: number
  contextualSimplifyCount: number
  contextualSimplifyFidelityCount: number
}>

const STOP = new Set(["acik", "acikca", "ayrica", "bunun", "icin", "kisaca", "olarak", "temelde", "yani"])
const CAUSAL = ["neden olur", "yol acar", "dogrudan belirler", "tetikler", "sonuc verir"] as const
const FORCE = ["kanitlar", "kesindir", "daima", "her zaman", "zorunludur"] as const
const SAFETY = ["tani koy", "ilac oner", "doz oner", "seans plani", "prognoz"] as const
const INTERNAL_EVIDENCE_JARGON = /(?:dogrulanmis kapsam|mevcut dogrulanmis icerik|yeterli dogrulanmis aciklama|kilitli icerik|locked claim|\bclaims?\b|\bfacet\w*\b|system facet boundary|\bcatalog\w*\b|\bkatalog\w*\b|\btopicid\b|\brequiredclaim\w*\b|\bsupport claim\b|\bevidence status\b)/u

function tokens(value: string) {
  return normalizeDnaChatText(value).split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    .filter((token) => token.length >= 3 && !STOP.has(token))
}

function tokenBigrams(value: string) {
  const normalizedTokens = normalizeDnaChatText(value).split(/\s+/u).filter(Boolean)
  if (normalizedTokens.length < 2) return new Set(normalizedTokens)
  return new Set(normalizedTokens.slice(0, -1).map((token, index) => `${token} ${normalizedTokens[index + 1]}`))
}

function nearIdentical(left: string, right: string) {
  const leftBigrams = tokenBigrams(left)
  const rightBigrams = tokenBigrams(right)
  const union = new Set([...leftBigrams, ...rightBigrams])
  if (!union.size) return true
  const shared = [...leftBigrams].filter((value) => rightBigrams.has(value)).length
  return shared / union.size >= 0.9
}

function sameTokenFamily(left: string, right: string) {
  if (left === right) return true
  if (left.length < 5 || right.length < 5) return false
  return left.slice(0, 5) === right.slice(0, 5)
}

function numbers(value: string) {
  return new Set(value.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])
}

function markers(value: string, values: readonly string[]) {
  const normalized = normalizeDnaChatText(value)
  return new Set(values.filter((marker) => normalized.includes(normalizeDnaChatText(marker))))
}

function ageMarkers(value: string) {
  const normalized = normalizeDnaChatText(value)
  const found = new Set<string>()
  if (/(?:^|\s)bebek\w*(?:\s|$)/u.test(normalized)) found.add("bebek")
  if (/(?:^|\s)(?:cocuk\w*|pediatrik\w*)(?:\s|$)/u.test(normalized)) found.add("cocuk")
  if (/(?:^|\s)ergen\w*(?:\s|$)/u.test(normalized)) found.add("ergen")
  if (/(?:^|\s)yetiskin\w*(?:\s|$)/u.test(normalized)) found.add("yetiskin")
  if (/(?:^|\s)yasli\w*(?:\s|$)/u.test(normalized)) found.add("yasli")
  if (/(?:^|\s)okul oncesi(?:\s|$)/u.test(normalized)) found.add("okul oncesi")
  return found
}

function negationCount(value: string) {
  return (normalizeDnaChatText(value).match(/\b(?:degil\w*|yok\w*|olamaz\w*|olmaz\w*|olmad\w*|olmayan\w*|kanitlamaz\w*|kanitlanamaz\w*|gostermez\w*|cikarilamaz\w*|gelmez\w*|gorulmez\w*|gorulmem\w*|degerlendirilmem\w*|bulunmuyor\w*|almiyor\w*|yansitmaz\w*)\b/g) ?? []).length
}

function sentenceAligned(sentence: string, claims: readonly DnaS13Claim[]) {
  const sentenceTokens = tokens(sentence)
  if (sentenceTokens.length <= 3) return true
  return claims.some((claim) => {
    const claimTokens = tokens(claim.text)
    const shared = sentenceTokens.filter((token) => claimTokens.some((candidate) => sameTokenFamily(token, candidate))).length
    return shared / sentenceTokens.length >= 0.3 || shared >= Math.min(5, sentenceTokens.length)
  })
}

function safeDiscourseRestatement(sentence: string, previousAligned: boolean) {
  if (!previousAligned) return false
  const normalized = normalizeDnaChatText(sentence)
  if (!/^(?:temel nokta|bu iki unsur|bu durum)/.test(normalized)) return false
  return numbers(sentence).size === 0
    && ageMarkers(sentence).size === 0
    && markers(sentence, CAUSAL).size === 0
    && markers(sentence, FORCE).size === 0
    && markers(sentence, SAFETY).size === 0
}

function negationMeaningChanged(input: Readonly<{
  realized: string
  evidence: string
  comparisonReady: boolean
}>) {
  const normalizedRealized = normalizeDnaChatText(input.realized)
  const normalizedEvidence = normalizeDnaChatText(input.evidence)
  const realizedCount = negationCount(input.realized)
  const evidenceCount = negationCount(input.evidence)
  if (realizedCount === 0 && evidenceCount === 0) return false
  if (normalizedEvidence.includes(normalizedRealized)) return false
  if (/(?:yalnizca|sadece).{0,80}sinirli degil/u.test(normalizedRealized)
    && /(?:daha genis|daha kapsamli)/u.test(normalizedEvidence)) return false

  const clauses = (value: string) => value.split(/(?<=[.!?;])\s+/u)
    .map((clause) => clause.trim()).filter(Boolean)
  const evidenceClauses = clauses(input.evidence)
  const realizedNegatedClauses = clauses(input.realized).filter((clause) => negationCount(clause) > 0)
  const evidenceNegatedClauses = evidenceClauses.filter((clause) => negationCount(clause) > 0)
  if (realizedCount === evidenceCount && realizedCount > 0
    && realizedNegatedClauses.every((realizedClause) => {
      const realizedTokens = tokens(realizedClause)
      return evidenceNegatedClauses.some((evidenceClause) => {
        const evidenceTokens = tokens(evidenceClause)
        const shared = realizedTokens.filter((token) =>
          evidenceTokens.some((candidate) => sameTokenFamily(token, candidate))).length
        return shared >= 2 || shared / Math.max(1, realizedTokens.length) >= 0.2
      })
    })) return false
  for (const realizedClause of clauses(input.realized)) {
    const realizedTokens = tokens(realizedClause)
    if (!realizedTokens.length) continue
    const ranked = evidenceClauses.map((evidenceClause) => {
      const evidenceTokens = tokens(evidenceClause)
      const shared = realizedTokens.filter((token) =>
        evidenceTokens.some((candidate) => sameTokenFamily(token, candidate))).length
      return { evidenceClause, similarity: shared / Math.max(1, realizedTokens.length) }
    }).sort((left, right) => right.similarity - left.similarity)
    const best = ranked[0]
    if (best && best.similarity >= 0.5
      && (negationCount(realizedClause) > 0) !== (negationCount(best.evidenceClause) > 0)) return true
    if (negationCount(realizedClause) > 0
      && !evidenceClauses.some((clause) => negationCount(clause) > 0 && ranked.some((row) => row.evidenceClause === clause && row.similarity >= 0.35))) {
      return true
    }
  }
  return false
}

function sameSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value))
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function comparisonSideSupported(input: Readonly<{
  slot: DnaS13StrictSlot
  realized: DnaS13StrictSlotRealization | undefined
  comparisonReady: boolean
}>) {
  const { slot, realized } = input
  if (slot.controlledText && slot.lockedClaims.length === 0) {
    return Boolean(realized
      && slot.requiredClaimIds.length === 0
      && slot.lockedClaimIds.length === 0
      && slot.sourceIds.length === 0
      && realized.usedClaimIds.length === 0
      && normalizeDnaChatText(realized.text) === normalizeDnaChatText(slot.controlledText))
  }
  if (!realized || !sameSet(realized.usedClaimIds, slot.lockedClaimIds)) return false
  if (slot.requiredClaimIds.some((claimId) => !realized.usedClaimIds.includes(claimId))) return false
  const claims = slot.lockedClaims.map((entry) => entry.claim)
  if (claims.some((claim) => !claim.passageId.trim() || claim.sourceIds.length === 0
    || claim.sourceIds.some((sourceId) => !slot.sourceIds.includes(sourceId)))) return false
  const allowedContracts = (slot.relationContracts ?? []).filter((contract) =>
    [...contract.sourceClaimIds, ...contract.targetClaimIds].every((claimId) => realized.usedClaimIds.includes(claimId)),
  )
  if (detectDnaS13Relations(realized.text).some((detected) => !allowedContracts.some((contract) => relationMarkerAllowed(detected, [contract])))) return false
  const evidence = claims.map((claim) => claim.text).join(". ")
  if ([...numbers(realized.text)].some((value) => !numbers(evidence).has(value))) return false
  if ([...ageMarkers(realized.text)].some((value) => !ageMarkers(evidence).has(value))) return false
  if (negationMeaningChanged({ realized: realized.text, evidence, comparisonReady: input.comparisonReady })) return false
  if ([...markers(realized.text, CAUSAL)].some((value) => !markers(evidence, CAUSAL).has(value))) return false
  if ([...markers(realized.text, FORCE)].some((value) => !markers(evidence, FORCE).has(value))) return false
  if ([...markers(realized.text, SAFETY)].some((value) => !markers(evidence, SAFETY).has(value))) return false
  const sentences = realized.text.split(/(?<=[.!?])\s+/u).map((value) => value.trim()).filter(Boolean)
  let previousAligned = false
  for (const sentence of sentences) {
    const aligned: boolean = sentenceAligned(sentence, claims) || safeDiscourseRestatement(sentence, previousAligned)
    if (!aligned) return false
    previousAligned = aligned
  }
  return sentences.length > 0
}

export function validateDnaS13StrictGrounding(input: Readonly<{
  plan: DnaS13StrictPlan
  realization: DnaS13StrictRealization
  allowUntransformedSimplifyFallback?: boolean
}>): DnaS13StrictValidation {
  const failures = new Set<DnaS13StrictFailure>()
  if (input.realization.unsupportedAddition) failures.add("unsupported_addition_declared")
  if (input.realization.slotRealizations.some((slot) => INTERNAL_EVIDENCE_JARGON.test(normalizeDnaChatText(slot.text)))) {
    failures.add("internal_evidence_jargon")
  }
  const facetEvidence = input.plan.facetEvidenceMatrix ?? []
  const requestedFacetCount = facetEvidence.filter((entry) => entry.status !== "NOT_REQUESTED").length
  const directSupportedFacetCount = facetEvidence.filter((entry) => entry.status === "SUPPORTED_DIRECT").length
  const derivedSupportedFacetCount = facetEvidence.filter((entry) => entry.status === "SUPPORTED_DERIVED").length
  const unsupportedFacetCount = facetEvidence.filter((entry) => entry.status === "UNSUPPORTED").length
  const expectedOrder = input.plan.slots.map((slot) => slot.id)
  const actualOrder = input.realization.slotRealizations.map((slot) => slot.slotId)
  if (expectedOrder.join("|") !== actualOrder.join("|")) failures.add("slot_order_changed")
  const plannedSubquestionOrder = input.plan.orderedSubquestionIds ?? []
  // An evidence-limitation slot still represents its subquestion and must
  // remain in the user-requested order. Only the shared comparison conclusion
  // is not itself a subquestion.
  const actualSubquestionOrder = input.plan.slots.filter((slot) =>
    slot.kind !== "comparison_conclusion")
    .map((slot) => slot.subquestionId)
    .filter((subquestionId, index, rows) => index === 0 || rows[index - 1] !== subquestionId)
  const subquestionOrderViolationCount = plannedSubquestionOrder.length
    && plannedSubquestionOrder.join("|") !== actualSubquestionOrder.join("|") ? 1 : 0
  if (subquestionOrderViolationCount) failures.add("subquestion_order_violation")
  const rejectedTargetIds = new Set(input.plan.semanticOperationAudit?.targets
    .filter((target) => target.polarity === "REJECTED_TARGET").map((target) => target.topicId) ?? [])
  const correctionRejectedTargetLeakCount = input.plan.slots.filter((slot) =>
    rejectedTargetIds.has(slot.topicId) || slot.lockedClaims.some((entry) => rejectedTargetIds.has(entry.claim.topicId))).length
  if (correctionRejectedTargetLeakCount) failures.add("rejected_target_in_plan")

  const realizationBySlot = new Map(input.realization.slotRealizations.map((slot) => [slot.slotId, slot]))
  const plannedLimitations = input.plan.evidenceLimitations
    ?? (input.plan.evidenceLimitation ? [Object.freeze({
        ...input.plan.evidenceLimitation,
        subquestionId: input.plan.slots.find((slot) => slot.id === input.plan.evidenceLimitation?.slotId)?.subquestionId ?? "unknown",
      })] : [])
  const informationGainLimitedSubquestions = new Set(input.plan.semanticOperationAudit?.followupInformationGain === false
    && input.plan.pragmaticTaskFrame?.pragmaticAction === "DEEPEN"
    ? plannedLimitations.map((entry) => entry.subquestionId) : [])
  const previouslyShownClaimIds = new Set(input.plan.semanticOperationAudit?.alreadyShownClaimIds ?? [])
  const requestedEvidenceSlots = facetEvidence.filter((entry) => entry.status !== "NOT_REQUESTED")
  const answeredSupportedSlotCount = requestedEvidenceSlots.filter((entry) => {
    if (entry.status !== "SUPPORTED_DIRECT" && entry.status !== "SUPPORTED_DERIVED") return false
    // One locked claim may directly support more than one requested facet. The
    // planner deliberately realizes that claim once; coverage is therefore
    // bound to the facet matrix's supportClaimIds, not duplicate slot labels.
    return input.plan.slots.some((slot) => slot.subquestionId === entry.subquestionId
      && realizationBySlot.has(slot.id)
      && entry.supportClaimIds.every((claimId) => realizationBySlot.get(slot.id)?.usedClaimIds.includes(claimId)))
      || (informationGainLimitedSubquestions.has(entry.subquestionId)
        && plannedLimitations.some((limitation) => limitation.subquestionId === entry.subquestionId
          && realizationBySlot.has(limitation.slotId)))
  }).length
  const answeredUnsupportedSlotCount = requestedEvidenceSlots.filter((entry) => {
    if (entry.status !== "UNSUPPORTED") return false
    return plannedLimitations.some((limitation) => limitation.subquestionId === entry.subquestionId
      && limitation.unsupportedFacets.includes(entry.facet)
      && realizationBySlot.has(limitation.slotId))
  }).length
  const requestedSlotCount = requestedEvidenceSlots.length
  const silentlyDroppedRequestedSlotCount = Math.max(0,
    requestedSlotCount - answeredSupportedSlotCount - answeredUnsupportedSlotCount)
  if (silentlyDroppedRequestedSlotCount > 0) failures.add("REQUESTED_SLOT_SILENTLY_DROPPED")
  const comparisonSideSlots = input.plan.slots.filter((slot) => slot.kind === "comparison_side")
  const comparisonConclusionSlots = input.plan.slots.filter((slot) => slot.kind === "comparison_conclusion")
  const comparisonReady = comparisonSideSlots.length === 2
    && new Set(comparisonSideSlots.map((slot) => slot.topicId)).size === 2
  const sideASupported = comparisonSideSlots.length === 0 || Boolean(comparisonSideSlots[0]
    && comparisonSideSupported({ slot: comparisonSideSlots[0], realized: realizationBySlot.get(comparisonSideSlots[0].id), comparisonReady }))
  const sideBSupported = comparisonSideSlots.length === 0 || Boolean(comparisonSideSlots[1]
    && comparisonSideSupported({ slot: comparisonSideSlots[1], realized: realizationBySlot.get(comparisonSideSlots[1].id), comparisonReady }))
  const coveredComparisonSides = Number(sideASupported) + Number(sideBSupported)
  if (comparisonSideSlots.length > 0 && (!comparisonReady || !sideASupported || !sideBSupported)) failures.add("comparison_side_uncovered")
  if (comparisonSideSlots.length > 0 && comparisonConclusionSlots.length !== 1) failures.add("comparison_conclusion_uncovered")
  const expectedConclusion = comparisonReady ? deriveDnaS13ComparisonConclusion(comparisonSideSlots) : null
  const usedAcrossSlots = new Map<string, number>()
  const relationChecks: DnaS13StrictRelationCheck[] = []
  let coveredSlots = 0
  let coveredRequiredClaims = 0
  let requiredClaimCount = 0
  let alignedSentences = 0
  let sentenceCount = 0
  let wrongClaimSubstitutionCount = 0
  let safetyViolationCount = 0
  let sourceViolationCount = 0
  let unsupportedRelationCount = 0
  let coveredComparisonConclusions = 0
  let comparisonConclusionSupported = comparisonSideSlots.length === 0
  let evidenceLimitationCount = 0
  let topicThesisContradictionCount = 0
  let invalidClaimRoleCount = 0
  let nonSelfContainedFinalClaimCount = 0

  for (const slot of input.plan.slots) {
    const realized = realizationBySlot.get(slot.id)
    requiredClaimCount += slot.requiredClaimIds.length
    if (!realized) {
      failures.add("required_slot_uncovered")
      continue
    }
    coveredSlots += 1
    const wrongClaims = realized.usedClaimIds.filter((claimId) => !slot.lockedClaimIds.includes(claimId))
    if (wrongClaims.length) {
      failures.add("wrong_claim_substitution")
      wrongClaimSubstitutionCount += wrongClaims.length
    }
    if (!sameSet(realized.usedClaimIds, slot.lockedClaimIds)) failures.add("locked_claim_missing")
    for (const requiredClaimId of slot.requiredClaimIds) {
      if (realized.usedClaimIds.includes(requiredClaimId)) coveredRequiredClaims += 1
      else failures.add("required_claim_missing")
    }
    // A comparison conclusion is a controlled synthesis of the two already
    // displayed sides. Reusing those original support IDs is provenance, not
    // accidental cross-slot claim duplication.
    if (slot.kind !== "comparison_conclusion") {
      for (const claimId of realized.usedClaimIds) usedAcrossSlots.set(claimId, (usedAcrossSlots.get(claimId) ?? 0) + 1)
    }

    const claims = slot.lockedClaims.map((entry) => entry.claim)
    if (!["comparison_conclusion", "evidence_limitation"].includes(slot.kind ?? "answer")) {
      const semantics = new Map((slot.claimSemantics ?? []).map((entry) => [entry.claimId, entry]))
      const requiredSemantics = slot.requiredClaimIds.flatMap((claimId) => {
        const semantic = semantics.get(claimId)
        return semantic ? [semantic] : []
      })
      const nonSelfContained = (slot.claimSemantics ?? []).filter((entry) =>
        slot.lockedClaimIds.includes(entry.claimId) && !entry.selfContained)
      if (nonSelfContained.length) {
        failures.add("non_self_contained_final_claim")
        nonSelfContainedFinalClaimCount += nonSelfContained.length
      }
      if (slot.requestedFacet) {
        const invalidRoles = requiredSemantics.filter((entry) =>
          !claimRoleSupportsFacet(entry.role, slot.requestedFacet!))
        if (invalidRoles.length) {
          failures.add("INVALID_CLAIM_ROLE_FOR_FACET")
          invalidClaimRoleCount += invalidRoles.length
        }
        if (["definition", "core_scope"].includes(slot.requestedFacet)
          && requiredSemantics.some((entry) => entry.role === "MYTH_OR_COMMON_CLAIM")) {
          failures.add("TOPIC_THESIS_CONTRADICTION")
          topicThesisContradictionCount += 1
        }
      }
    }
    const invalidSourceClaims = claims.filter((claim) => !claim.passageId.trim() || claim.sourceIds.length === 0 || claim.sourceIds.some((sourceId) => !slot.sourceIds.includes(sourceId)))
    if (invalidSourceClaims.length) {
      failures.add("source_violation")
      sourceViolationCount += invalidSourceClaims.length
    }

    const limitationContract = plannedLimitations.find((entry) => entry.slotId === slot.id) ?? null
    if (limitationContract) {
      evidenceLimitationCount += 1
      const supported = Boolean(limitationContract.slotId === slot.id
        && slot.controlledText
        && normalizeDnaChatText(realized.text) === normalizeDnaChatText(slot.controlledText)
        && normalizeDnaChatText(slot.controlledText) === normalizeDnaChatText(limitationContract.controlledText)
        && slot.lockedClaims.length === 0
        && slot.requiredClaimIds.length === 0
        && slot.lockedClaimIds.length === 0
        && slot.sourceIds.length === 0
        && realized.usedClaimIds.length === 0)
      sentenceCount += 1
      if (supported) alignedSentences += 1
      else failures.add("evidence_limitation_mismatch")
      continue
    }

    if (slot.kind === "comparison_conclusion") {
      const contract = (slot.relationContracts ?? []).find((entry) => entry.type === "comparison_conclusion") ?? null
      const supportIds = expectedConclusion?.supportClaimIds ?? []
      const expectedSourceIds = comparisonSideSlots[0]?.requiredClaimIds.filter((claimId) => supportIds.includes(claimId)) ?? []
      const expectedTargetIds = comparisonSideSlots[1]?.requiredClaimIds.filter((claimId) => supportIds.includes(claimId)) ?? []
      const supported = Boolean(expectedConclusion && contract?.controlledText && slot.controlledText
        && normalizeDnaChatText(realized.text) === normalizeDnaChatText(slot.controlledText)
        && normalizeDnaChatText(slot.controlledText) === normalizeDnaChatText(expectedConclusion.controlledText)
        && sameSet(realized.usedClaimIds, slot.lockedClaimIds)
        && slot.comparisonConclusionMode === expectedConclusion.mode
        && sameSet(slot.comparisonConclusionSupportClaimIds ?? [], supportIds)
        && sameJson(slot.comparisonConclusionCategoryLabels ?? null, expectedConclusion.categoryLabels)
        && sameJson(slot.comparisonConclusionBasis ?? null, expectedConclusion.basis)
        && input.plan.comparisonConclusionMode === expectedConclusion.mode
        && sameSet(input.plan.comparisonConclusionSupportClaimIds ?? [], supportIds)
        && sameSet(contract.sourceClaimIds, expectedSourceIds)
        && sameSet(contract.targetClaimIds, expectedTargetIds))
      relationChecks.push(Object.freeze({
        slotId: slot.id,
        type: "comparison_conclusion",
        marker: "controlled_conclusion",
        supported,
        contractId: supported ? contract?.id ?? null : null,
      }))
      sentenceCount += 1
      if (supported) {
        coveredComparisonConclusions += 1
        comparisonConclusionSupported = true
        alignedSentences += 1
      } else {
        failures.add("comparison_conclusion_unsupported")
        unsupportedRelationCount += 1
      }
      continue
    }

    const allowedRelationContracts = (slot.relationContracts ?? []).filter((contract) =>
      [...contract.sourceClaimIds, ...contract.targetClaimIds].every((claimId) => realized.usedClaimIds.includes(claimId)),
    )
    for (const detected of detectDnaS13Relations(realized.text)) {
      const contract = allowedRelationContracts.find((entry) => relationMarkerAllowed(detected, [entry])) ?? null
      const supported = Boolean(contract)
      relationChecks.push(Object.freeze({
        slotId: slot.id,
        type: detected.type,
        marker: detected.marker,
        supported,
        contractId: contract?.id ?? null,
      }))
      if (!supported) unsupportedRelationCount += 1
    }
    if (relationChecks.some((check) => check.slotId === slot.id && !check.supported)) failures.add("unsupported_relation_addition")

    const evidence = claims.map((claim) => claim.text).join(". ")
    if ([...numbers(realized.text)].some((value) => !numbers(evidence).has(value))) failures.add("invented_number")
    if ([...ageMarkers(realized.text)].some((value) => !ageMarkers(evidence).has(value))) failures.add("age_scope_changed")
    if (negationMeaningChanged({ realized: realized.text, evidence, comparisonReady })) failures.add("negation_changed")
    if ([...markers(realized.text, CAUSAL)].some((value) => !markers(evidence, CAUSAL).has(value))) failures.add("causality_escalated")
    if ([...markers(realized.text, FORCE)].some((value) => !markers(evidence, FORCE).has(value))) failures.add("epistemic_force_escalated")
    const safetyMarkers = [...markers(realized.text, SAFETY)].filter((value) => !markers(evidence, SAFETY).has(value))
    if (safetyMarkers.length) {
      failures.add("safety_violation")
      safetyViolationCount += safetyMarkers.length
    }
    const sentences = realized.text.split(/(?<=[.!?])\s+/u).map((value) => value.trim()).filter(Boolean)
    sentenceCount += sentences.length
    let previousAligned = false
    let aligned = 0
    for (const sentence of sentences) {
      const currentAligned: boolean = sentenceAligned(sentence, claims)
        || safeDiscourseRestatement(sentence, previousAligned)
      if (currentAligned) aligned += 1
      previousAligned = currentAligned
    }
    alignedSentences += aligned
    if (aligned !== sentences.length) failures.add("unaligned_factual_sentence")
  }

  const usedClaimIds = new Set(usedAcrossSlots.keys())
  const planRelationIds = new Set((input.plan.relationContracts ?? []).map((contract) => contract.id))
  let omittedSupportedFacetCount = 0
  let facetEntailmentFalsePositiveCount = 0
  let falseExampleSupportCount = 0
  let falseSignificanceSupportCount = 0
  for (const evidence of facetEvidence) {
    const informationGainLimited = informationGainLimitedSubquestions.has(evidence.subquestionId)
    const supportIdsAreClean = evidence.supportClaimIds.every((claimId) =>
      !claimId.startsWith("system.facet-boundary:")
        && (input.plan.lockedClaimIds.includes(claimId)
          || (informationGainLimited && previouslyShownClaimIds.has(claimId))))
    const relationIdsAreBound = evidence.supportRelationIds.every((relationId) => planRelationIds.has(relationId))
    if (evidence.status === "SUPPORTED_DIRECT" || evidence.status === "SUPPORTED_DERIVED") {
      const directContractValid = evidence.status !== "SUPPORTED_DIRECT"
        || (evidence.entailment === "ENTAILS" && evidence.allowedDerivationType === null && evidence.derivedFacet === null)
      const derivedContractValid = evidence.status !== "SUPPORTED_DERIVED"
        || (evidence.entailment === "ENTAILS" && evidence.allowedDerivationType !== null && evidence.derivedFacet === evidence.facet)
      if (!directContractValid || !derivedContractValid) {
        failures.add("facet_entailment_invalid")
        facetEntailmentFalsePositiveCount += 1
        if (evidence.facet === "verified_example") falseExampleSupportCount += 1
        if (evidence.facet === "function") falseSignificanceSupportCount += 1
      }
      if (!evidence.supportClaimIds.length || !supportIdsAreClean || !relationIdsAreBound) {
        failures.add("facet_evidence_invalid")
      }
      if ((!evidence.supportClaimIds.length || evidence.supportClaimIds.some((claimId) => !usedClaimIds.has(claimId)))
        && !informationGainLimited) {
        failures.add("SUPPORTED_FACET_OMITTED")
        omittedSupportedFacetCount += 1
      }
    } else if (evidence.supportClaimIds.length || evidence.supportRelationIds.length
      || evidence.allowedDerivationType !== null || evidence.derivedFacet !== null) {
      failures.add("facet_evidence_invalid")
    }
  }
  if (input.plan.lockedClaimIds.some((claimId) => claimId.startsWith("system.facet-boundary:"))) {
    failures.add("facet_evidence_invalid")
  }
  const expectedUnsupportedFacets = [...new Set(facetEvidence
    .filter((entry) => entry.status === "UNSUPPORTED")
    .map((entry) => entry.facet))]
  const plannedLimitationFacets = [...new Set(plannedLimitations.flatMap((entry) => entry.unsupportedFacets))]
  const informationGainLimitationAllowed = unsupportedFacetCount === 0
    && input.plan.semanticOperationAudit?.followupInformationGain === false
  if ((unsupportedFacetCount > 0 && plannedLimitations.length === 0)
    || (unsupportedFacetCount === 0 && evidenceLimitationCount > 0 && !informationGainLimitationAllowed)
    || evidenceLimitationCount !== plannedLimitations.length
    || !sameSet(plannedLimitationFacets, expectedUnsupportedFacets)) {
    failures.add("evidence_limitation_mismatch")
  }
  if ([...usedAcrossSlots.values()].some((count) => count > 1)) failures.add("claim_reused_across_slots")
  const requiredSlotCoveragePercent = input.plan.slots.length ? Math.round((coveredSlots / input.plan.slots.length) * 100) : 100
  const requiredClaimCoveragePercent = requiredClaimCount ? Math.round((coveredRequiredClaims / requiredClaimCount) * 100) : 100
  const comparisonSideCoveragePercent = comparisonSideSlots.length
    ? Math.round((coveredComparisonSides / 2) * 100)
    : 100
  const comparisonConclusionCoveragePercent = comparisonConclusionSlots.length
    ? Math.round((coveredComparisonConclusions / comparisonConclusionSlots.length) * 100)
    : comparisonSideSlots.length ? 0 : 100
  if (comparisonSideSlots.length > 0 && comparisonConclusionCoveragePercent !== 100) failures.add("comparison_conclusion_uncovered")
  const action = input.plan.pragmaticTaskFrame?.pragmaticAction ?? null
  const simplifyPresentation = dnaS13HasPresentationModifier(input.plan.pragmaticTaskFrame, "SIMPLIFY")
  const sufficiencyRows = input.plan.answerSufficiency ?? []
  const honestLimitationPresent = plannedLimitations.length > 0
  const allSufficient = sufficiencyRows.length > 0 && sufficiencyRows.every((entry) => entry.status === "SUFFICIENT")
  const realizedSlots = input.plan.slots.filter((slot) => realizationBySlot.has(slot.id))
  const realizedFacet = (facet: string) => realizedSlots.some((slot) => slot.requestedFacet === facet
    && slot.lockedClaimIds.length > 0)
  if (action === "DEFINE" && allSufficient && !realizedFacet("definition")) failures.add("DEFINE_NOT_SATISFIED")
  if (action === "WHY_SIGNIFICANCE" && allSufficient && !realizedFacet("function")) failures.add("WHY_NOT_SATISFIED")
  if (action === "WHY_SIGNIFICANCE" && sufficiencyRows.length > 0 && !allSufficient && !honestLimitationPresent) failures.add("WHY_NOT_SATISFIED")
  const semanticRepeatWithoutNeedCount = input.plan.semanticOperationAudit?.semanticRepeatWithoutNeedCount ?? 0
  if (action === "DEEPEN" && (semanticRepeatWithoutNeedCount > 0
    || (input.plan.semanticOperationAudit?.followupInformationGain === false && !honestLimitationPresent))) {
    failures.add("DEEPEN_NO_INFORMATION_GAIN")
  }
  if (action === "EXAMPLE" && allSufficient && !realizedFacet("verified_example")) failures.add("EXAMPLE_NOT_SATISFIED")
  if (action === "EXAMPLE" && sufficiencyRows.length > 0 && !allSufficient && !honestLimitationPresent) failures.add("EXAMPLE_NOT_SATISFIED")
  if (simplifyPresentation && allSufficient && !input.allowUntransformedSimplifyFallback) {
    const transformed = realizedSlots.filter((slot) =>
      slot.kind !== "comparison_conclusion" && slot.kind !== "evidence_limitation").some((slot) => {
      const realized = realizationBySlot.get(slot.id)
      const lockedText = slot.lockedClaims.map((entry) => entry.claim.text).join(" ")
      return realized && !nearIdentical(realized.text, lockedText)
    })
    if (!transformed) failures.add("SIMPLIFY_NOT_TRANSFORMED")
  }
  const simplifyAudits = input.plan.simplifyPayloadAudit ?? []
  const explicitSimplifyAudits = simplifyAudits.filter((entry) => entry.mode === "EXPLICIT_TOPIC_SIMPLIFY"
    && entry.supportClaimIds.length > 0)
  const simplifyMainMeaningSupportedCount = explicitSimplifyAudits
    .filter((entry) => entry.mainMeaningEntailed === true
      && entry.supportClaimIds.every((claimId) => input.plan.lockedClaimIds.includes(claimId))).length
  if (simplifyPresentation && simplifyMainMeaningSupportedCount !== explicitSimplifyAudits.length) {
    failures.add("SIMPLIFY_MAIN_MEANING_UNSUPPORTED")
  }
  const contextualSimplifyAudits = simplifyAudits.filter((entry) => entry.mode === "CONTEXTUAL_SIMPLIFY")
  const contextualSimplifyFidelityCount = contextualSimplifyAudits.filter((entry) =>
    entry.contextualClaimSetPreserved === true && entry.contextualFacetSetPreserved === true
      && entry.supportClaimIds.every((claimId) => input.plan.lockedClaimIds.includes(claimId))).length
  if (simplifyPresentation && contextualSimplifyFidelityCount !== contextualSimplifyAudits.length) {
    failures.add("CONTEXTUAL_SIMPLIFY_PAYLOAD_CHANGED")
  }
  const conclusionSlot = comparisonConclusionSlots[0]
  const conclusionText = conclusionSlot ? realizationBySlot.get(conclusionSlot.id)?.text ?? "" : ""
  const comparisonUserFacingSpecificity = expectedConclusion?.mode === "abstain" ? null
    : expectedConclusion ? (() => {
        const normalized = normalizeDnaChatText(conclusionText)
        const titles = comparisonSideSlots.map((slot, index) => titleTokensForSpecificity(
          slot.lockedClaims[0]?.claim.title ?? (index === 0 ? "ilk kavram" : "ikinci kavram"),
        ))
        return titles.every((sideTokens) => sideTokens.length === 0
          || sideTokens.some((token) => normalized.includes(token)))
          && !/^(?:ayni kavram degildir|farkli seylerdir|ayrim bu iki kapsam arasindadir)[.!]?$/u.test(normalized)
      })() : comparisonSideSlots.length ? false : null
  if (action === "COMPARE" && comparisonUserFacingSpecificity === false) {
    failures.add("COMPARE_CONCLUSION_NOT_INFORMATIVE")
  }
  const answerSufficiency = Object.freeze({
    sufficient: sufficiencyRows.filter((entry) => entry.status === "SUFFICIENT").length,
    partiallySufficient: sufficiencyRows.filter((entry) => entry.status === "PARTIALLY_SUFFICIENT").length,
    insufficientWithAvailableEvidence: sufficiencyRows.filter((entry) => entry.status === "INSUFFICIENT_WITH_AVAILABLE_EVIDENCE").length,
  })
  const semanticAction = validateDnaS13SemanticAction({
    plan: input.plan,
    realization: input.realization,
    requiredSlotCoveragePercent,
    requiredClaimCoveragePercent,
    correctionRejectedTargetLeakCount,
    subquestionOrderViolationCount,
    facetEntailmentFalsePositiveCount,
    invalidClaimRoleCount,
    unsupportedAdditionCount: input.realization.unsupportedAddition ? 1 : 0,
    unsupportedRelationCount,
    sourceViolationCount,
    safetyViolationCount,
    allowUntransformedSimplifyFallback: input.allowUntransformedSimplifyFallback,
  })
  semanticAction.failureCodes.forEach((code) => failures.add(code as DnaS13StrictFailure))
  return Object.freeze({
    pass: failures.size === 0 && requiredSlotCoveragePercent === 100 && requiredClaimCoveragePercent === 100
      && silentlyDroppedRequestedSlotCount === 0
      && semanticAction.routingCorrect && semanticAction.actionExecutionCorrect
      && semanticAction.facetEntailmentCorrect && semanticAction.finalAnswerNonempty,
    failureCodes: Object.freeze([...failures].sort()),
    requiredSlotCoveragePercent,
    requestedSlotCount,
    answeredSupportedSlotCount,
    answeredUnsupportedSlotCount,
    silentlyDroppedRequestedSlotCount,
    requiredClaimCoveragePercent,
    sentenceCoveragePercent: sentenceCount ? Math.round((alignedSentences / sentenceCount) * 100) : 100,
    wrongClaimSubstitutionCount,
    unsupportedAdditionCount: input.realization.unsupportedAddition ? 1 : 0,
    sourceViolationCount,
    safetyViolationCount,
    unsupportedRelationCount,
    relationChecks: Object.freeze(relationChecks),
    comparisonSideCoveragePercent,
    comparisonConclusionCoveragePercent,
    comparisonSideASupported: sideASupported,
    comparisonSideBSupported: sideBSupported,
    comparisonConclusionSupported,
    requestedFacetCount,
    directSupportedFacetCount,
    derivedSupportedFacetCount,
    unsupportedFacetCount,
    omittedSupportedFacetCount,
    facetEntailmentFalsePositiveCount,
    falseExampleSupportCount,
    falseSignificanceSupportCount,
    correctionRejectedTargetLeakCount,
    followupInformationGain: input.plan.semanticOperationAudit?.followupInformationGain ?? null,
    subquestionOrderViolationCount,
    topicThesisContradictionCount,
    invalidClaimRoleCount,
    nonSelfContainedFinalClaimCount,
    semanticRepeatWithoutNeedCount,
    comparisonUserFacingSpecificity,
    answerSufficiency,
    semanticAction,
    simplifyMainMeaningEligibleCount: explicitSimplifyAudits.length,
    simplifyMainMeaningSupportedCount,
    contextualSimplifyCount: contextualSimplifyAudits.length,
    contextualSimplifyFidelityCount,
  })
}

function titleTokensForSpecificity(value: string) {
  return normalizeDnaChatText(value).split(/\s+/u)
    .filter((token) => token.length >= 4 && !["nedir", "olarak", "acisindan"].includes(token))
}
