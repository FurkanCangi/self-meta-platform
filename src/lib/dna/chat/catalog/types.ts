export const DNA_CHAT_CATALOG_VERSION = "dna-chat-catalog@2" as const

export const DNA_CHAT_CATALOG_CATEGORIES = [
  "self_regulation",
  "central_nervous_system",
  "autonomic_nervous_system",
  "sympathetic_parasympathetic",
] as const

export const DNA_CHAT_QUERY_KINDS = [
  "definition",
  "comparison",
  "relation",
  "measurement",
  "development",
  "evidence",
  "misconception",
  "dna_relation",
  "case_finding",
  "case_theory",
  "unknown",
] as const

export const DNA_CHAT_EVIDENCE_LEVELS = [
  "strong",
  "moderate",
  "limited",
  "theoretical",
  "boundary",
] as const

export const DNA_CHAT_AGE_SCOPES = [
  "all_ages",
  "developmental",
  "early_childhood",
  "childhood",
  "adolescence",
  "adult_weighted",
  "mixed",
] as const

export const DNA_CHAT_CLAIM_TYPES = [
  "definition",
  "mechanism",
  "association",
  "development",
  "measurement_boundary",
  "misconception_correction",
  "product_boundary",
] as const

export const DNA_CHAT_DNA_RELATIONS = [
  "conceptual_proximity",
  "not_established",
  "theory_only",
  "none",
] as const

export type DnaChatCatalogCategory = (typeof DNA_CHAT_CATALOG_CATEGORIES)[number]
export type DnaChatQueryKind = (typeof DNA_CHAT_QUERY_KINDS)[number]
export type DnaChatCatalogEvidenceLevel = (typeof DNA_CHAT_EVIDENCE_LEVELS)[number]
export type DnaChatCatalogAgeScope = (typeof DNA_CHAT_AGE_SCOPES)[number]
export type DnaChatCatalogClaimType = (typeof DNA_CHAT_CLAIM_TYPES)[number]
export type DnaChatCatalogDnaRelation = (typeof DNA_CHAT_DNA_RELATIONS)[number]

export type DnaChatCatalogReviewStatus = "source_verified_expert_pending" | "expert_approved"
export type DnaChatCatalogPublicationStatus = "published" | "consensus" | "practice_brief"

export type DnaChatCatalogTopic = {
  readonly version: typeof DNA_CHAT_CATALOG_VERSION
  readonly id: string
  readonly category: DnaChatCatalogCategory
  readonly title: string
  readonly aliases: readonly string[]
  readonly summary: string
  readonly details: readonly string[]
  readonly keywords: readonly string[]
  readonly claimIds: readonly string[]
  readonly sourceIds: readonly string[]
  readonly evidenceLevel: DnaChatCatalogEvidenceLevel
  readonly ageScope: DnaChatCatalogAgeScope
  readonly claimBoundary: string
  readonly reviewStatus: DnaChatCatalogReviewStatus
}

export type DnaChatCatalogClaim = {
  readonly version: typeof DNA_CHAT_CATALOG_VERSION
  readonly id: string
  readonly topicId: string
  readonly text: string
  readonly detail: string
  readonly sourceIds: readonly string[]
  readonly evidenceLevel: DnaChatCatalogEvidenceLevel
  readonly ageScope: DnaChatCatalogAgeScope
  readonly claimType: DnaChatCatalogClaimType
  readonly dnaRelation: DnaChatCatalogDnaRelation
  readonly safetyStatus: "safe"
  readonly sourceVerified: true
}

export type DnaChatCatalogRelation = {
  readonly version: typeof DNA_CHAT_CATALOG_VERSION
  readonly id: string
  readonly fromTopicId: string
  readonly toTopicId: string
  readonly predicate:
    | "part_of"
    | "includes"
    | "distinguished_from"
    | "associated_with"
    | "measured_indirectly_by"
    | "supports"
    | "conceptually_related_to"
  readonly summary: string
  readonly sourceIds: readonly string[]
  readonly evidenceLevel: DnaChatCatalogEvidenceLevel
  readonly ageScope: DnaChatCatalogAgeScope
  readonly claimBoundary: string
  readonly maxHops: 1
}

export type DnaChatCatalogSource = {
  readonly version: typeof DNA_CHAT_CATALOG_VERSION
  readonly id: string
  readonly title: string
  readonly authors: string
  readonly year: number
  readonly publication: string
  readonly publicationStatus: DnaChatCatalogPublicationStatus
  readonly studyType: string
  readonly doi: string | null
  readonly pmid: string | null
  readonly url: string
  readonly evidenceDomain: string
  readonly ageScope: DnaChatCatalogAgeScope
  readonly claimBoundary: string
  readonly verifiedAt: string
  readonly sourceVerified: true
  readonly existingLiteratureId?: string
  readonly repairNote?: string
}

export type DnaChatCatalogSafetyRule = {
  readonly version: typeof DNA_CHAT_CATALOG_VERSION
  readonly id: string
  readonly patterns: readonly string[]
  readonly response: string
  readonly category:
    | "biological_inference"
    | "measurement_overreach"
    | "causality"
    | "diagnosis"
    | "treatment"
    | "internal_reasoning"
  readonly sourceIds: readonly string[]
}

export type DnaChatCatalogBenchmarkQuestion = {
  readonly version: typeof DNA_CHAT_CATALOG_VERSION
  readonly id: string
  /** The research-pack category that owns this canonical question row. */
  readonly sourceCategory: DnaChatCatalogCategory
  /** The question code exactly as written in the canonical Markdown table. */
  readonly sourceCode: string
  /** Present only when the source table has a dedicated question-category column. */
  readonly sourceQuestionCategory: string | null
  /** The answer label exactly as written in the canonical Markdown table. */
  readonly documentExpected: string
  /** The complete Markdown row, retained so audit tests can compare bytes. */
  readonly canonicalRow: string
  /** Normalized question text used only to keep duplicate semantic families together. */
  readonly semanticFamily: string
  readonly question: string
  readonly expectedQueryKind: DnaChatQueryKind | null
  readonly expectedTopicId: string | null
  readonly expected: "answer" | "clarification" | "not_available" | "refusal"
  readonly evaluationScope:
    | "supported_answerable"
    | "unsupported_safe"
    | "safety_refusal"
  readonly holdout: boolean
}

export type DnaChatCatalogProvenance = {
  readonly version: typeof DNA_CHAT_CATALOG_VERSION
  readonly id: string
  readonly category: DnaChatCatalogCategory
  readonly canonicalFile: string
  readonly sha256: string
  readonly importedAt: string
  readonly sourceFormat: "markdown"
  readonly originalPackage: string
  readonly rawCounts: {
    readonly claims: number
    readonly conceptCards: number
    readonly questions: number
    readonly sources: number
  }
  readonly expertReview: "pending"
  readonly runtimePolicy: "verified_safe_subset_only"
}

export type DnaChatCatalog = {
  readonly version: typeof DNA_CHAT_CATALOG_VERSION
  readonly topics: readonly DnaChatCatalogTopic[]
  readonly claims: readonly DnaChatCatalogClaim[]
  readonly relations: readonly DnaChatCatalogRelation[]
  readonly sources: readonly DnaChatCatalogSource[]
  readonly safetyRules: readonly DnaChatCatalogSafetyRule[]
  readonly benchmarkQuestions: readonly DnaChatCatalogBenchmarkQuestion[]
  readonly provenance: readonly DnaChatCatalogProvenance[]
}
