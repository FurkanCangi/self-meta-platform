import type { DnaS13RequestedFacet } from "./contracts"
import type { DnaS13PragmaticAction } from "./pragmaticTask"
import type {
  DnaS13AnswerSufficiency,
  DnaS13FacetEvidence,
  DnaS13KnowledgeGapTelemetry,
  DnaS13MissingEvidenceType,
} from "./strictContracts"

export const DNA_S13_ANSWER_SUFFICIENCY_GATE_VERSION = "dna-s13-answer-sufficiency@1" as const

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function missingEvidenceType(facet: DnaS13RequestedFacet, action: DnaS13PragmaticAction | null): DnaS13MissingEvidenceType {
  if (action === "DEEPEN") return "deepening"
  if (action === "COMPARE") return "comparison"
  if (facet === "distinction") return "comparison"
  if (facet === "function") return "function_significance"
  if (facet === "verified_example") return "example"
  return facet
}

export function resolveDnaS13AnswerSufficiency(input: Readonly<{
  questionHash: string
  action: DnaS13PragmaticAction | null
  facetEvidence: readonly DnaS13FacetEvidence[]
  followupInformationGain: boolean | null
}>): Readonly<{
  results: readonly DnaS13AnswerSufficiency[]
  knowledgeGaps: readonly DnaS13KnowledgeGapTelemetry[]
}> {
  const subquestionIds = unique(input.facetEvidence.map((entry) => entry.subquestionId))
  const results = subquestionIds.map((subquestionId): DnaS13AnswerSufficiency => {
    const entries = input.facetEvidence.filter((entry) => entry.subquestionId === subquestionId
      && entry.status !== "NOT_REQUESTED")
    const supported = entries.filter((entry) => entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
    const unsupported = entries.filter((entry) => entry.status === "UNSUPPORTED")
    const deepenWithoutGain = input.action === "DEEPEN" && input.followupInformationGain === false
    const supportedFacets = deepenWithoutGain ? [] : unique(supported.map((entry) => entry.facet))
    const unsupportedFacets = deepenWithoutGain
      ? unique(entries.map((entry) => entry.facet))
      : unique(unsupported.map((entry) => entry.facet))
    const partial = unsupported.some((entry) => entry.entailment === "PARTIAL")
    const availableEntailing = unique(unsupported.flatMap((entry) => entry.availableEntailingClaimIds ?? []))
    const status = unsupportedFacets.length === 0
      ? "SUFFICIENT" as const
      : supportedFacets.length > 0 || partial
        ? "PARTIALLY_SUFFICIENT" as const
        : "INSUFFICIENT_WITH_AVAILABLE_EVIDENCE" as const
    const evidenceAvailability = unsupportedFacets.length === 0 ? null
      : deepenWithoutGain ? "CATALOG_GAP" as const
        : availableEntailing.length > 0 ? "AVAILABLE_BUT_NOT_SELECTED" as const : "CATALOG_GAP" as const
    return Object.freeze({
      subquestionId,
      topicId: entries[0]?.topicId ?? "unknown",
      status,
      supportedFacets: Object.freeze(supportedFacets),
      unsupportedFacets: Object.freeze(unsupportedFacets),
      evidenceAvailability,
      selectedClaimIds: Object.freeze(unique(supported.flatMap((entry) => entry.supportClaimIds))),
      availableClaimIds: Object.freeze(unique(entries.flatMap((entry) => [
        ...entry.evaluatedClaimIds,
        ...(entry.availableEntailingClaimIds ?? []),
        ...(entry.partialClaimIds ?? []),
      ]))),
      missingEvidenceTypes: Object.freeze(unique(unsupportedFacets.map((facet) => missingEvidenceType(facet, input.action)))),
    })
  })
  const knowledgeGaps = results.flatMap((result): DnaS13KnowledgeGapTelemetry[] => {
    if (!result.evidenceAvailability) return []
    return result.unsupportedFacets.map((facet) => Object.freeze({
      questionHash: input.questionHash,
      topicId: result.topicId,
      pragmaticAction: input.action ?? "OTHER",
      requestedFacet: facet,
      availableClaimIds: result.availableClaimIds,
      missingEvidenceType: missingEvidenceType(facet, input.action),
      classification: result.evidenceAvailability!,
    }))
  })
  return Object.freeze({ results: Object.freeze(results), knowledgeGaps: Object.freeze(knowledgeGaps) })
}
