import type { CanonicalAnamnesisEvidenceFact } from "./contracts"
import { factSupportsDifficulty, factSupportsPreservedCapacity } from "./canonicalAnamnesisEvidence"

export type CaregiverEvidenceRole = Readonly<{
  sourcePresent: boolean
  directionalComplaint: boolean
  functionalEvidence: boolean
  functionalExample: boolean
  preservedCapacity: boolean
}>

export function classifyCaregiverEvidenceRole(fact: CanonicalAnamnesisEvidenceFact): CaregiverEvidenceRole {
  const sourcePresent = fact.evidence_status !== "UNUSABLE"
  const context = fact.functional_context
  const functionalEvidence = sourcePresent
    && fact.epistemic_status === "OBSERVED_OR_REPORTED"
    && Boolean(context.task || context.environment || context.trigger || context.support || context.outcome)
  return Object.freeze({
    sourcePresent,
    directionalComplaint: sourcePresent && factSupportsDifficulty(fact),
    functionalEvidence,
    functionalExample: functionalEvidence,
    preservedCapacity: sourcePresent && factSupportsPreservedCapacity(fact),
  })
}
