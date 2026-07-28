import type {
  DnaCoverageDimensionId,
  DnaScienceDomainId,
} from "../../src/lib/dna/chat/governance/coverageMap"

/**
 * Internal contract for the source-bound V3.2 book catalog.
 *
 * This contract deliberately has no loader and no runtime adapter. Artifacts
 * conforming to it remain on ResearchSSD until the owner-book, evaluation and
 * release gates independently authorize a later package.
 */
export const DNA_BOOK_KNOWLEDGE_UNIT_SCHEMA = "DnaBookKnowledgeUnit@1" as const

export const DNA_BOOK_QUESTION_TYPES = [
  "definition_foundation",
  "process_function",
  "relation_comparison",
  "development_age",
  "measurement_evidence",
  "misconception_boundary",
  "single_step_synthesis",
] as const

export type DnaBookQuestionType = (typeof DNA_BOOK_QUESTION_TYPES)[number]

export type DnaBookAnswerAtom = Readonly<{
  text: string
  claimId: string
  passageId: string
  sourceId: string
  sourceTitle: string
  sourceYear: number | null
  page: number | null
  locator: string
}>

export type DnaBookKnowledgeUnitV1 = Readonly<{
  id: string
  domain: DnaScienceDomainId
  questionType: DnaBookQuestionType
  dimensions: readonly DnaCoverageDimensionId[]
  canonicalQuestion: string
  queryVariants: Readonly<{
    terminology: string
    conversational: string
    noisySpelling: string
    contextualFollowup: string
  }>
  answerProfiles: Readonly<{
    short: readonly [DnaBookAnswerAtom]
    standard: readonly [DnaBookAnswerAtom, DnaBookAnswerAtom]
    deep: readonly [DnaBookAnswerAtom, DnaBookAnswerAtom, DnaBookAnswerAtom]
  }>
  primaryClaimId: string
  passageIds: readonly string[]
  sourceIds: readonly string[]
  bookAnchor: Readonly<{
    passageId: string
    sourceId: string
    page: number
  }>
  evidenceLevel: string
  ageScope: string
  claimBoundary: string
  licenseDecision: "licensed_runtime_candidate_text_only"
  reviewDecision: "reconciled_a_b" | "rereview_c_candidate"
  authorityClass: "external_science_candidate"
  runtimeEligible: false
  releaseEligible: false
  provenance: Readonly<{
    sourceHashes: readonly string[]
    reviewHashes: readonly string[]
    candidateId: string
    reviewPolicyVersion: string
    translationModels: readonly string[]
  }>
}>
