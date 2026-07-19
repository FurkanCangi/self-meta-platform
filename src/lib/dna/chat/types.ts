import type { DnaIntelligencePublicIntendedUse } from "./intendedUse"

export const DNA_CHAT_SCHEMA_VERSION = "1.0" as const
export const DNA_CHAT_ENGINE_VERSION = "dna-chat-engine@2" as const
export const DNA_CHAT_KNOWLEDGE_CONTRACT_VERSION = "dna-chat-knowledge@1.0.0" as const

export const DNA_CHAT_DOMAIN_KEYS = [
  "physiological",
  "sensory",
  "emotional",
  "cognitive",
  "executive",
  "interoception",
] as const

export type DnaChatDomainKey = (typeof DNA_CHAT_DOMAIN_KEYS)[number]
export type DnaChatDomainLevel = "Tipik" | "Riskli" | "Atipik"
export type DnaChatRoute = "theory" | "dna" | "case" | "unknown"
export type DnaChatMode = "theory" | "dna" | "case"
export type DnaChatOutcome = "answered" | "clarification" | "not_available" | "refused"
export type DnaChatClassification =
  | "dna_concept"
  | "literature"
  | "case_finding"
  | "hypothesis"
  | "clarification"
  | "not_available"
  | "refusal"

export type DnaChatQueryKind =
  | "definition"
  | "comparison"
  | "relation"
  | "measurement"
  | "development"
  | "evidence"
  | "misconception"
  | "dna_relation"
  | "case_finding"
  | "case_theory"
  | "unknown"

export type DnaChatSourceType =
  | "clinical_kb"
  | "literature"
  | "dna_contract"
  | "knowledge_entry"
  | "catalog"
  | "case"

export type DnaChatEvidenceStatus = "approved" | "verified" | "bounded"

export type DnaChatKnowledgeEntry = {
  version: typeof DNA_CHAT_KNOWLEDGE_CONTRACT_VERSION
  topic: string
  summary: string
  details: readonly string[]
  chunkIds: readonly string[]
  sourceIds: readonly string[]
  evidenceStatus: DnaChatEvidenceStatus
  ageScope: string
  claimBoundary: string
  reviewedAt: string
  keywords: readonly string[]
  exampleQuestions: readonly string[]
}

export type DnaChatSourceRef = {
  id: string
  type: DnaChatSourceType
  title: string
  labelTr: string
  excerptTr: string
  citation?: string
  year?: number
  doi?: string | null
  url?: string
  claimBoundary?: string
  ageScope?: string
  studyType?: string
  sampleScope?: string
}

export type DnaChatCaseContextInput = {
  dataStatus: "synthetic" | "deidentified"
  caseId?: string
  ageMonths?: number | null
  scores?: Partial<Record<DnaChatDomainKey, number>>
  levels?: Partial<Record<DnaChatDomainKey, DnaChatDomainLevel>>
  themes?: string[]
  observations?: string[]
  externalFindings?: string[]
  chatContext?: {
    primaryAxis?: string | null
    secondaryAxes?: string[]
    mechanismLabel?: string | null
    mechanismSummary?: string | null
    caseEvidenceLines?: string[]
    counterEvidenceLines?: string[]
    preservedCapacityLines?: string[]
    dataLimitations?: string[]
    confidenceLevel?: string | null
    confidenceRationale?: string | null
    evidence?: string[]
    counterEvidence?: string[]
    preservedCapacities?: string[]
    confidence?: string | null
    limitations?: string[]
    weakDomains?: string[]
    strongDomains?: string[]
    patterns?: string[]
  }
}

export type DnaChatSafeCaseContext = {
  readonly safe: true
  readonly dataStatus: "synthetic" | "deidentified"
  readonly caseId: string | null
  readonly ageMonths: number | null
  readonly scores: Partial<Record<DnaChatDomainKey, number>>
  readonly levels: Partial<Record<DnaChatDomainKey, DnaChatDomainLevel>>
  readonly themes: string[]
  readonly observations: string[]
  readonly externalFindings: string[]
  readonly chatContext: {
    primaryAxis: string | null
    secondaryAxes: string[]
    mechanismLabel: string | null
    mechanismSummary: string | null
    evidence: string[]
    counterEvidence: string[]
    preservedCapacities: string[]
    confidence: string | null
    confidenceRationale: string | null
    limitations: string[]
    weakDomains: string[]
    strongDomains: string[]
    patterns: string[]
  }
  readonly redactionCount: number
}

export type DnaChatRequest = {
  question: string
  mode?: DnaChatMode
  previousTopic?: string | null
  caseContext?: DnaChatCaseContextInput | DnaChatSafeCaseContext
}

export type DnaChatSafetyCategory =
  | "none"
  | "privacy"
  | "diagnosis"
  | "treatment"
  | "medication"
  | "prognosis"
  | "causality"
  | "internal_data"
  | "cross_case"
  | "crisis"
  | "manipulation"
  | "unsafe_case_context"
  | "biological_inference"
  | "measurement_overreach"
  | "internal_reasoning"
  | "self_learning"

export type DnaChatSafetyResult = {
  blocked: boolean
  category: DnaChatSafetyCategory
  code: string | null
  redactedQuestion: string
  boundaryTr: string
}

export type DnaChatDiagnostics = {
  normalizedQuestion: string
  matchMethod: "exact" | "phrase" | "weighted" | "context" | "none"
  routeScores: Record<DnaChatRoute, number>
  intentScore: number
  threshold: number
  tokenScore: number
  ngramScore: number
  queryKind?: DnaChatQueryKind
}

export type DnaChatContextRequest = {
  type: "report"
  preferNewest: boolean
}

export type DnaChatEvidenceSummary = {
  level: string
  ageScope: string
  sampleScope: string
  boundary: string
}

export type DnaChatResponse = {
  schemaVersion: typeof DNA_CHAT_SCHEMA_VERSION
  engineVersion: typeof DNA_CHAT_ENGINE_VERSION
  route: DnaChatRoute
  outcome: DnaChatOutcome
  classification: DnaChatClassification
  topic: string | null
  intentId: string | null
  summary: string
  details: string[]
  answerTr: string
  sourceRefs: DnaChatSourceRef[]
  sources: DnaChatSourceRef[]
  caseEvidence: string[]
  limitations: string[]
  safetyBoundary: string
  intendedUse: DnaIntelligencePublicIntendedUse
  suggestedQuestions: string[]
  safety: DnaChatSafetyResult
  contextRequest?: DnaChatContextRequest
  evidenceSummary?: DnaChatEvidenceSummary
}

export type DnaChatIntentDefinition = {
  id: string
  route: Exclude<DnaChatRoute, "unknown">
  labelTr: string
  patterns: readonly string[]
  sourceIds: readonly string[]
  threshold: number
  summaryTr?: string
  detailsTr?: readonly string[]
  suggestedQuestions?: readonly string[]
  domain?: DnaChatDomainKey
}
