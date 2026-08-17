import type { DnaS13QueryFrame } from "./contracts"
import { dnaS13HasPresentationModifier, type DnaS13PragmaticAction } from "./pragmaticTask"
import type { DnaS13StrictPlan } from "./strictContracts"

export const DNA_S13_ADAPTIVE_REALIZATION_POLICY_VERSION = "dna-s13-adaptive-realization@3" as const

export type DnaS13AdaptiveCatalogStatus = "SUPPORTED" | "CATALOG_LIMITED"
export type DnaS13DeterministicConfidence = "HIGH" | "MEDIUM" | "LOW"
export type DnaS13RealizationDecisionReason =
  | "catalog_limited_safe_response"
  | "routing_confidence_not_provider_correctable"
  | "deepen_requires_natural_synthesis"
  | "comparison_requires_natural_synthesis"
  | "two_subquestion_synthesis"
  | "complex_multiturn_synthesis"
  | "multi_slot_synthesis"
  | "multiple_relation_synthesis"
  | "standard_or_deep_multi_claim_explanation"
  | "low_deterministic_realization_confidence"
  | "simple_supported_definition"
  | "short_supported_why"
  | "supported_simplify_deterministic_first"
  | "short_one_slot_explanation"
  | "single_claim_low_complexity"
  | "deterministic_supported_default"

export type DnaS13RealizationDecision = Readonly<{
  version: typeof DNA_S13_ADAPTIVE_REALIZATION_POLICY_VERSION
  action: DnaS13PragmaticAction
  responseDepth: DnaS13StrictPlan["responseDepth"]
  slotCount: number
  facetCount: number
  multiTurn: boolean
  comparison: boolean
  twoSubquestion: boolean
  relationCount: number
  catalogStatus: DnaS13AdaptiveCatalogStatus
  deterministicConfidence: DnaS13DeterministicConfidence
  useLuna: boolean
  reason: DnaS13RealizationDecisionReason
}>

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function decision(input: Omit<DnaS13RealizationDecision, "version" | "useLuna" | "reason">,
  useLuna: boolean, reason: DnaS13RealizationDecisionReason): DnaS13RealizationDecision {
  return Object.freeze({
    version: DNA_S13_ADAPTIVE_REALIZATION_POLICY_VERSION,
    ...input,
    useLuna,
    reason,
  })
}

/**
 * Pure post-routing decision. It never changes topic, action, facet, retrieval,
 * evidence or the locked content plan; it only chooses how that immutable plan
 * is realized.
 */
export function resolveDnaS13RealizationDecision(input: Readonly<{
  frame: DnaS13QueryFrame
  plan: DnaS13StrictPlan
  action: DnaS13PragmaticAction
  multiTurn: boolean
  routingConfidence: "HIGH" | "MEDIUM" | "LOW"
}>): DnaS13RealizationDecision {
  const requestedEvidence = (input.plan.facetEvidenceMatrix ?? [])
    .filter((row) => row.status !== "NOT_REQUESTED")
  const facetCount = unique(requestedEvidence.map((row) => row.facet)).length
    || unique(input.plan.pragmaticTaskFrame?.requestedFacets ?? []).length
  const slotCount = input.plan.slots.length
  const relationCount = unique([
    ...(input.plan.relationContracts ?? []).map((row) => row.id),
    ...input.plan.slots.flatMap((slot) => (slot.relationContracts ?? []).map((row) => row.id)),
  ]).length
  const claimCount = unique(input.plan.lockedClaimIds).length
  const twoSubquestion = input.frame.subquestions.length > 1
  const comparison = input.action === "COMPARE"
    || input.plan.slots.some((slot) => slot.kind === "comparison_side" || slot.kind === "comparison_conclusion")
  const catalogLimited = requestedEvidence.some((row) => row.status === "UNSUPPORTED")
    || (input.plan.answerSufficiency ?? []).some((row) => row.status !== "SUFFICIENT")
    || Boolean(input.plan.evidenceLimitation || input.plan.evidenceLimitations?.length)
  const catalogStatus: DnaS13AdaptiveCatalogStatus = catalogLimited ? "CATALOG_LIMITED" : "SUPPORTED"
  const deterministicConfidence: DnaS13DeterministicConfidence = catalogLimited
    || (slotCount === 1 && claimCount <= 1 && relationCount <= 1)
    ? "HIGH"
    : twoSubquestion || slotCount > 1 || relationCount > 1
      || (input.plan.responseDepth === "deep" && claimCount > 1)
      ? "LOW"
      : "MEDIUM"
  const base = Object.freeze({
    action: input.action,
    responseDepth: input.plan.responseDepth,
    slotCount,
    facetCount,
    multiTurn: input.multiTurn,
    comparison,
    twoSubquestion,
    relationCount,
    catalogStatus,
    deterministicConfidence,
  })

  // A provider must never be used to repair uncertain upstream routing or to
  // invent content for a catalog gap.
  if (catalogLimited) return decision(base, false, "catalog_limited_safe_response")
  if (input.routingConfidence === "LOW") {
    return decision(base, false, "routing_confidence_not_provider_correctable")
  }
  if (dnaS13HasPresentationModifier(input.plan.pragmaticTaskFrame, "SIMPLIFY")) {
    return decision(base, false, "supported_simplify_deterministic_first")
  }
  if (input.action === "DEEPEN") return decision(base, true, "deepen_requires_natural_synthesis")
  if (comparison) return decision(base, true, "comparison_requires_natural_synthesis")
  if (twoSubquestion) return decision(base, true, "two_subquestion_synthesis")
  if (input.multiTurn && input.action !== "DEFINE") {
    return decision(base, true, "complex_multiturn_synthesis")
  }
  if (slotCount > 1) return decision(base, true, "multi_slot_synthesis")
  if (relationCount > 1) return decision(base, true, "multiple_relation_synthesis")
  if (claimCount > 1 && input.plan.responseDepth !== "short") {
    return decision(base, true, "standard_or_deep_multi_claim_explanation")
  }
  if (deterministicConfidence === "LOW") {
    return decision(base, true, "low_deterministic_realization_confidence")
  }
  if (input.action === "DEFINE" && input.plan.responseDepth === "short") {
    return decision(base, false, "simple_supported_definition")
  }
  if (input.action === "WHY_SIGNIFICANCE" && input.plan.responseDepth === "short") {
    return decision(base, false, "short_supported_why")
  }
  if (slotCount === 1 && input.plan.responseDepth === "short") {
    return decision(base, false, "short_one_slot_explanation")
  }
  if (claimCount <= 1) return decision(base, false, "single_claim_low_complexity")
  return decision(base, false, "deterministic_supported_default")
}
