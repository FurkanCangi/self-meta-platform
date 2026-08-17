import type { DnaS13QueryFrame } from "./contracts"
import type { DnaS13PragmaticBaseAction } from "./pragmaticTask"
import { dnaS13HasPresentationModifier } from "./pragmaticTask"
import type { DnaS13StrictPlan } from "./strictContracts"

export const DNA_S13_SIMPLIFY_PRESENTATION_VERSION = "dna-s13-simplify-presentation@1" as const

export type DnaS13BasePayloadFingerprint = Readonly<{
  topicIds: readonly string[]
  baseAction: DnaS13PragmaticBaseAction | null
  requestedFacets: readonly string[]
  lockedClaimIds: readonly string[]
}>

export type DnaS13BasePayloadInvariance = Readonly<{
  version: typeof DNA_S13_SIMPLIFY_PRESENTATION_VERSION
  simplifyIsPresentationModifier: boolean
  sameTopics: boolean
  sameBaseAction: boolean
  sameFacets: boolean
  sameLockedClaimSet: boolean
  pass: boolean
  base: DnaS13BasePayloadFingerprint
  simplified: DnaS13BasePayloadFingerprint
}>

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort()
}

function sameSet(left: readonly string[], right: readonly string[]) {
  const a = uniqueSorted(left)
  const b = uniqueSorted(right)
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function fingerprintDnaS13BasePayload(
  frame: DnaS13QueryFrame,
  plan: DnaS13StrictPlan,
): DnaS13BasePayloadFingerprint {
  const action = plan.pragmaticTaskFrame?.baseAction
    ?? (plan.pragmaticTaskFrame?.pragmaticAction === "SIMPLIFY"
      ? null : plan.pragmaticTaskFrame?.pragmaticAction ?? null)
  return Object.freeze({
    topicIds: Object.freeze(uniqueSorted(frame.subquestions.map((row) => row.topicId))),
    baseAction: action as DnaS13PragmaticBaseAction | null,
    requestedFacets: Object.freeze(uniqueSorted(frame.subquestions.flatMap((row) => row.requestedFacets ?? []))),
    lockedClaimIds: Object.freeze(uniqueSorted(plan.lockedClaimIds.filter((claimId) => !claimId.startsWith("system.")))),
  })
}

/**
 * Provider-free paired-plan gate. It compares scientific payload only; surface
 * realization is deliberately excluded from the fingerprint.
 */
export function compareDnaS13SimplifyBasePayload(input: Readonly<{
  baseFrame: DnaS13QueryFrame
  basePlan: DnaS13StrictPlan
  simplifyFrame: DnaS13QueryFrame
  simplifyPlan: DnaS13StrictPlan
}>): DnaS13BasePayloadInvariance {
  const base = fingerprintDnaS13BasePayload(input.baseFrame, input.basePlan)
  const simplified = fingerprintDnaS13BasePayload(input.simplifyFrame, input.simplifyPlan)
  const simplifyIsPresentationModifier = dnaS13HasPresentationModifier(
    input.simplifyPlan.pragmaticTaskFrame,
    "SIMPLIFY",
  ) && input.simplifyPlan.pragmaticTaskFrame?.pragmaticAction !== "SIMPLIFY"
  const sameTopics = sameSet(base.topicIds, simplified.topicIds)
  const sameBaseAction = base.baseAction !== null && base.baseAction === simplified.baseAction
  const sameFacets = sameSet(base.requestedFacets, simplified.requestedFacets)
  const sameLockedClaimSet = sameSet(base.lockedClaimIds, simplified.lockedClaimIds)
  return Object.freeze({
    version: DNA_S13_SIMPLIFY_PRESENTATION_VERSION,
    simplifyIsPresentationModifier,
    sameTopics,
    sameBaseAction,
    sameFacets,
    sameLockedClaimSet,
    pass: simplifyIsPresentationModifier && sameTopics && sameBaseAction && sameFacets && sameLockedClaimSet,
    base,
    simplified,
  })
}
