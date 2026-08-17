import type { DnaS13Claim, DnaS13Depth, DnaS13Focus, DnaS13QuestionType, DnaS13RequestedFacet } from "./contracts"
import type { DnaS13PragmaticTaskFrame } from "./pragmaticTask"
import type { DnaS13ClaimSemantic, DnaS13TopicSemanticFrame } from "./topicSemantic"
import type { DnaS13ConceptTypeClassification } from "./conceptType"

export const DNA_S13_STRICT_PLAN_VERSION = "dna-s13-strict-plan@12" as const
export const DNA_S13_STRICT_REALIZATION_VERSION = "dna-s13-strict-realization@1" as const

export type DnaS13StrictClaimRole = "required" | "explanatory"
export type DnaS13StrictSlotKind = "answer" | "comparison_side" | "comparison_conclusion" | "evidence_limitation"
export const DNA_S13_FACET_EVIDENCE_STATUSES = Object.freeze([
  "SUPPORTED_DIRECT", "SUPPORTED_DERIVED", "UNSUPPORTED", "NOT_REQUESTED",
] as const)
export type DnaS13FacetEvidenceStatus = typeof DNA_S13_FACET_EVIDENCE_STATUSES[number]
export const DNA_S13_FACET_ENTAILMENT_RESULTS = Object.freeze([
  "ENTAILS", "PARTIAL", "DOES_NOT_ENTAIL",
] as const)
export type DnaS13FacetEntailmentResult = typeof DNA_S13_FACET_ENTAILMENT_RESULTS[number]
export type DnaS13AllowedDerivationType =
  | "definition_plus_verified_boundary_to_distinction"
  | "verified_relation_to_distinction"
  | "verified_lead_in_plus_adjacent_enumeration"
  | "heading_scope_for_definition"
  | "verified_main_meaning_for_simplify"

export type DnaS13SimplifyPayloadMode = "CONTEXTUAL_SIMPLIFY" | "EXPLICIT_TOPIC_SIMPLIFY"
export type DnaS13SimplifyPayloadAudit = Readonly<{
  subquestionId: string
  topicId: string
  mode: DnaS13SimplifyPayloadMode
  sourceFacet: string | null
  supportClaimIds: readonly string[]
  previousClaimIds: readonly string[]
  previousFacets: readonly DnaS13RequestedFacet[]
  mainMeaningEntailed: boolean | null
  contextualClaimSetPreserved: boolean | null
  contextualFacetSetPreserved: boolean | null
  selectionReason: string
}>
export type DnaS13FacetEvidence = Readonly<{
  subquestionId: string
  topicId: string
  facet: DnaS13RequestedFacet
  status: DnaS13FacetEvidenceStatus
  supportClaimIds: readonly string[]
  supportRelationIds: readonly string[]
  entailment: DnaS13FacetEntailmentResult
  allowedDerivationType: DnaS13AllowedDerivationType | null
  derivedFacet: DnaS13RequestedFacet | null
  evaluatedClaimIds: readonly string[]
  availableEntailingClaimIds?: readonly string[]
  partialClaimIds?: readonly string[]
  confidence: number
}>

export const DNA_S13_ANSWER_SUFFICIENCY_STATUSES = Object.freeze([
  "SUFFICIENT", "PARTIALLY_SUFFICIENT", "INSUFFICIENT_WITH_AVAILABLE_EVIDENCE",
] as const)
export type DnaS13AnswerSufficiencyStatus = typeof DNA_S13_ANSWER_SUFFICIENCY_STATUSES[number]
export type DnaS13EvidenceAvailability = "AVAILABLE_BUT_NOT_SELECTED" | "CATALOG_GAP" | null
export type DnaS13MissingEvidenceType =
  | "definition"
  | "function_significance"
  | "example"
  | "boundary"
  | "comparison"
  | "deepening"
  | "supported_meaning"
  | "components"
  | "core_scope"
  | "explanatory_detail"
  | "limitation"

export type DnaS13AnswerSufficiency = Readonly<{
  subquestionId: string
  topicId: string
  status: DnaS13AnswerSufficiencyStatus
  supportedFacets: readonly DnaS13RequestedFacet[]
  unsupportedFacets: readonly DnaS13RequestedFacet[]
  evidenceAvailability: DnaS13EvidenceAvailability
  selectedClaimIds: readonly string[]
  availableClaimIds: readonly string[]
  missingEvidenceTypes: readonly DnaS13MissingEvidenceType[]
}>

export type DnaS13KnowledgeGapTelemetry = Readonly<{
  questionHash: string
  topicId: string
  pragmaticAction: string
  requestedFacet: DnaS13RequestedFacet
  availableClaimIds: readonly string[]
  missingEvidenceType: DnaS13MissingEvidenceType
  classification: Exclude<DnaS13EvidenceAvailability, null>
}>

export type DnaS13TargetPolarity = "ACTIVE_TARGET" | "REJECTED_TARGET" | "CONTEXT_ONLY"
export type DnaS13TargetPolarityRecord = Readonly<{
  topicId: string
  polarity: DnaS13TargetPolarity
  surface: string | null
}>

export type DnaS13SemanticOperationAudit = Readonly<{
  operation: string
  targets: readonly DnaS13TargetPolarityRecord[]
  alreadyShownClaimIds: readonly string[]
  alreadyAnsweredFacets: readonly DnaS13RequestedFacet[]
  newClaimIds: readonly string[]
  newAnsweredFacets: readonly DnaS13RequestedFacet[]
  newRelationIds: readonly string[]
  followupInformationGain: boolean | null
  semanticRepeatWithoutNeedCount?: number
}>
export type DnaS13ComparisonConclusionMode =
  | "direct"
  | "safe_categorical_inference"
  | "contrast_by_verified_definitions"
  | "abstain"
export type DnaS13ComparisonCategory =
  | "yapı"
  | "süreç"
  | "ölçüm"
  | "kuramsal çerçeve"
  | "klinik örnek"
  | "değerlendirme başlığı"
  | "işlevsel hedef"
  | "fizyolojik sistem"
  | "bilişsel süreç"
  | "gelişimsel kavram"

export type DnaS13ComparisonCategoryEvidence = Readonly<{
  claimId: string
  category: DnaS13ComparisonCategory | null
  evidenceCode: string
}>

export type DnaS13ComparisonConclusionBasis = Readonly<{
  rule: "direct_explicit_comparison"
    | "distinct_locked_categories"
    | "distinct_verified_definitions"
    | "insufficient_locked_category_evidence"
  sideA: readonly DnaS13ComparisonCategoryEvidence[]
  sideB: readonly DnaS13ComparisonCategoryEvidence[]
}>
export type DnaS13StrictRelationType =
  | "causality"
  | "consequence"
  | "explanation"
  | "contrast"
  | "temporal_order"
  | "equivalence"
  | "hierarchy"
  | "comparison_conclusion"

export type DnaS13StrictRelationContract = Readonly<{
  id: string
  version: "dna-s13-strict-relations@1"
  type: DnaS13StrictRelationType
  support: "claim_text" | "controlled_conclusion"
  sourceClaimIds: readonly string[]
  targetClaimIds: readonly string[]
  surfaceMarkers: readonly string[]
  controlledText: string | null
}>

export type DnaS13StrictExplanatoryDecision = Readonly<{
  subquestionId: string
  claimId: string
  decision: "kept" | "excluded"
  reasons: readonly string[]
}>

export type DnaS13StrictLockedClaim = Readonly<{
  claim: DnaS13Claim
  role: DnaS13StrictClaimRole
}>

export type DnaS13StrictSlot = Readonly<{
  id: string
  orderIndex?: number
  kind?: DnaS13StrictSlotKind
  subquestionId: string
  question: string
  topicId: string
  focus: DnaS13Focus
  questionType: DnaS13QuestionType
  requestedFacet?: DnaS13RequestedFacet | null
  comparisonTargetTopicIds: readonly string[]
  lockedClaims: readonly DnaS13StrictLockedClaim[]
  requiredClaimIds: readonly string[]
  lockedClaimIds: readonly string[]
  sourceIds: readonly string[]
  relationContracts?: readonly DnaS13StrictRelationContract[]
  controlledText?: string | null
  comparisonConclusionMode?: DnaS13ComparisonConclusionMode | null
  comparisonConclusionSupportClaimIds?: readonly string[]
  comparisonConclusionCategoryLabels?: Readonly<{
    sideA: DnaS13ComparisonCategory | null
    sideB: DnaS13ComparisonCategory | null
  }> | null
  comparisonConclusionBasis?: DnaS13ComparisonConclusionBasis | null
  topicThesisClaimIds?: readonly string[]
  claimSemantics?: readonly DnaS13ClaimSemantic[]
}>

export type DnaS13StrictPlan = Readonly<{
  version: typeof DNA_S13_STRICT_PLAN_VERSION
  responseDepth: DnaS13Depth
  pragmaticTaskFrame?: DnaS13PragmaticTaskFrame | null
  slots: readonly DnaS13StrictSlot[]
  lockedClaimIds: readonly string[]
  sourceIds: readonly string[]
  relationContracts?: readonly DnaS13StrictRelationContract[]
  explanatoryDecisions?: readonly DnaS13StrictExplanatoryDecision[]
  comparisonConclusionMode?: DnaS13ComparisonConclusionMode | null
  comparisonConclusionSupportClaimIds?: readonly string[]
  facetEvidenceMatrix?: readonly DnaS13FacetEvidence[]
  orderedSubquestionIds?: readonly string[]
  semanticOperationAudit?: DnaS13SemanticOperationAudit | null
  answerSufficiency?: readonly DnaS13AnswerSufficiency[]
  knowledgeGaps?: readonly DnaS13KnowledgeGapTelemetry[]
  topicSemanticFrames?: readonly DnaS13TopicSemanticFrame[]
  topicConceptTypes?: readonly DnaS13ConceptTypeClassification[]
  simplifyPayloadAudit?: readonly DnaS13SimplifyPayloadAudit[]
  evidenceLimitation?: Readonly<{
    slotId: string
    unsupportedFacets: readonly DnaS13RequestedFacet[]
    controlledText: string
  }> | null
  evidenceLimitations?: readonly Readonly<{
    slotId: string
    subquestionId: string
    unsupportedFacets: readonly DnaS13RequestedFacet[]
    controlledText: string
  }>[]
}>

export type DnaS13StrictSlotRealization = Readonly<{
  slotId: string
  text: string
  usedClaimIds: readonly string[]
}>

export type DnaS13StrictRealization = Readonly<{
  version: typeof DNA_S13_STRICT_REALIZATION_VERSION
  slotRealizations: readonly DnaS13StrictSlotRealization[]
  unsupportedAddition: boolean
}>

function uniqueStringArray(value: unknown, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null
  const result = value.map((item) => typeof item === "string" ? item.trim() : "")
  return result.every(Boolean) && new Set(result).size === result.length ? result : null
}

export function validateDnaS13StrictRealization(
  candidate: unknown,
  allowedSlotIds: readonly string[],
  allowedClaimIds: readonly string[],
): DnaS13StrictRealization | null {
  if (!candidate || typeof candidate !== "object") return null
  const row = candidate as Record<string, unknown>
  if (typeof row.unsupportedAddition !== "boolean") return null
  if (!Array.isArray(row.slotRealizations) || row.slotRealizations.length !== allowedSlotIds.length) return null
  const allowedSlots = new Set(allowedSlotIds)
  const allowedClaims = new Set(allowedClaimIds)
  const parsed: DnaS13StrictSlotRealization[] = []
  for (const raw of row.slotRealizations) {
    if (!raw || typeof raw !== "object") return null
    const item = raw as Record<string, unknown>
    const slotId = typeof item.slotId === "string" ? item.slotId.trim() : ""
    const text = typeof item.text === "string" ? item.text.trim() : ""
    const usedClaimIds = uniqueStringArray(item.usedClaimIds, 8)
    if (!allowedSlots.has(slotId) || text.length < 2 || text.length > 2_000 || !usedClaimIds) return null
    if (usedClaimIds.some((claimId) => !allowedClaims.has(claimId))) return null
    parsed.push(Object.freeze({ slotId, text, usedClaimIds: Object.freeze(usedClaimIds) }))
  }
  if (new Set(parsed.map((item) => item.slotId)).size !== allowedSlotIds.length) return null
  return Object.freeze({
    version: DNA_S13_STRICT_REALIZATION_VERSION,
    slotRealizations: Object.freeze(parsed),
    unsupportedAddition: row.unsupportedAddition,
  })
}
