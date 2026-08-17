import {
  DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
  type DnaIntelligencePublicIntendedUse,
} from "./intendedUse"
import type { DnaChatResponseDepth } from "./conversationPolicy"
import type {
  DnaChatConversationContext,
  DnaChatConversationQueryKind,
} from "./types"
import {
  isDnaS13LimitedOwnerBookAuthority,
  validateDnaS13LimitedPublicResponse,
} from "./s13/limitedRollout/responseContract"

export type DnaChatPublicClassification =
  | "dna_concept"
  | "literature"
  | "case_finding"
  | "hypothesis"
  | "clarification"
  | "not_available"
  | "refusal"

export type DnaChatPublicKnowledgeAuthority = {
  contractVersion: string
  layer:
    | "dna_product_information"
    | "external_scientific_information"
    | "owner_book_information"
    | "case_information"
    | "safety_and_product_boundaries"
  labelTr: string
  approvalRequirement: string
  verificationStatus: "pending" | "verified" | "test_only"
  releaseEligible: boolean
  boundaryTr?: string
}

export type DnaChatPublicV3AnswerSection =
  | "definition"
  | "function_or_relation"
  | "development"
  | "measurement"
  | "evidence_status"
  | "counter_evidence"
  | "dna_boundary"
  | "case_context"
  | "case_finding"
  | "case_missing"
  | "general_literature"
  | "case_non_inference"
  | "preserved_capacity"
  | "boundary"

export type DnaChatPublicAnswerUnit = {
  id: string
  section: DnaChatPublicV3AnswerSection | null
  kind: "summary" | "detail" | "case_evidence" | "limitation" | "safety_boundary"
  role:
    | "product_definition"
    | "owner_book_information"
    | "scientific_evidence"
    | "dna_specific_validation"
    | "case_finding"
    | "safety_boundary"
  text: string
  authority: DnaChatPublicKnowledgeAuthority
  claimIds: string[]
  passageIds: string[]
  sourceIds: string[]
  citationCardIds: string[]
}

type DnaValidationStatus =
  | "product_definition"
  | "supported_relation"
  | "conceptual_proximity"
  | "theory_only"
  | "not_established"
  | "contradicted"
  | "not_applicable"

export type DnaChatPublicSourceRef = {
  id: string
  sourceId?: string
  type?: string
  title?: string
  labelTr?: string
  excerpt?: string
  excerptTr?: string
  citation?: string
  publicationYear?: number
  year?: number
  doi?: string | null
  url?: string
  claimBoundary?: string
  ageScope?: string
  studyType?: string
  sampleScope?: string
  authors?: string
  sourceType?: string
  officialUrl?: string
  locator?: string
  evidenceLevel?: string
  supportedClaim?: string
  knownBoundary?: string
  supportedBoundary?: string
  authority?: DnaChatPublicKnowledgeAuthority
}

type ContextRequest = {
  type: "report"
  preferNewest: boolean
}

type EvidenceSummary = {
  level: string
  scientificEvidenceLevel?: string
  dnaValidationStatus?: DnaValidationStatus
  ageScope: string
  sampleScope: string
  boundary: string
}

export type DnaChatPublicAnswer = {
  requestId: string
  responseDepth: DnaChatResponseDepth
  runtimeGeneration: "v2_legacy" | "v3"
  classification: DnaChatPublicClassification
  availabilityScope?: "knowledge" | "report"
  summary: string
  details: string[]
  sources: DnaChatPublicSourceRef[]
  caseEvidence: string[]
  limitations: string[]
  safetyBoundary: string
  intendedUse: DnaIntelligencePublicIntendedUse
  suggestedQuestions: string[]
  engineVersion: string
  catalogVersion: string
  packageVersion: string
  packageSha256: string | null
  topic: string | null
  limitedRolloutFeedbackEligible: boolean
  limitedRolloutContextToken: string | null
  conversationContext?: DnaChatConversationContext
  contextRequest?: ContextRequest
  evidenceSummary?: EvidenceSummary
  authoritySummary: DnaChatPublicKnowledgeAuthority[]
  answerUnits: DnaChatPublicAnswerUnit[]
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : []
}

const CLASSIFICATIONS = new Set<DnaChatPublicClassification>([
  "dna_concept", "literature", "case_finding", "hypothesis", "clarification", "not_available", "refusal",
])
const RESPONSE_DEPTHS = new Set<DnaChatResponseDepth>(["short", "standard", "deep"])
const AUTHORITY_LAYERS = new Set<DnaChatPublicKnowledgeAuthority["layer"]>([
  "dna_product_information",
  "external_scientific_information",
  "owner_book_information",
  "case_information",
  "safety_and_product_boundaries",
])
const AUTHORITY_CONTRACT_VERSION = "dna-knowledge-authority@1"
const AUTHORITY_STATUSES = new Set<DnaChatPublicKnowledgeAuthority["verificationStatus"]>([
  "pending", "verified", "test_only",
])
const AUTHORITY_APPROVAL_BY_LAYER: Record<DnaChatPublicKnowledgeAuthority["layer"], string> = {
  dna_product_information: "owner_approved",
  external_scientific_information: "codex_multi_pass_audited",
  owner_book_information: "owner_approved",
  case_information: "report_derived",
  safety_and_product_boundaries: "policy_enforced",
}
const ANSWER_UNIT_KINDS = new Set<DnaChatPublicAnswerUnit["kind"]>([
  "summary", "detail", "case_evidence", "limitation", "safety_boundary",
])
const ANSWER_UNIT_ROLES = new Set<DnaChatPublicAnswerUnit["role"]>([
  "product_definition", "owner_book_information", "scientific_evidence", "dna_specific_validation", "case_finding", "safety_boundary",
])
const ANSWER_ROLE_LAYER: Record<DnaChatPublicAnswerUnit["role"], DnaChatPublicKnowledgeAuthority["layer"]> = {
  product_definition: "dna_product_information",
  owner_book_information: "owner_book_information",
  scientific_evidence: "external_scientific_information",
  dna_specific_validation: "external_scientific_information",
  case_finding: "case_information",
  safety_boundary: "safety_and_product_boundaries",
}
const V3_ANSWER_SECTIONS = new Set<DnaChatPublicV3AnswerSection>([
  "definition", "function_or_relation", "development", "measurement", "evidence_status",
  "counter_evidence", "dna_boundary", "case_context", "case_finding", "case_missing",
  "general_literature", "case_non_inference", "preserved_capacity", "boundary",
])
const DNA_VALIDATION_STATUSES = new Set<DnaValidationStatus>([
  "product_definition", "supported_relation", "conceptual_proximity", "theory_only",
  "not_established", "contradicted", "not_applicable",
])
const CONVERSATION_QUERY_KINDS = new Set<DnaChatConversationQueryKind>([
  "definition", "comparison", "relation", "measurement", "development", "evidence", "case", "unknown",
])

function normalizeAuthority(value: unknown, limitedResponse = false): DnaChatPublicKnowledgeAuthority | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (limitedResponse) {
    if (!isDnaS13LimitedOwnerBookAuthority(row)) return null
    return {
      contractVersion: String(row.contractVersion),
      layer: "owner_book_information",
      labelTr: String(row.labelTr),
      approvalRequirement: String(row.approvalRequirement),
      verificationStatus: "verified",
      releaseEligible: true,
      boundaryTr: String(row.boundaryTr),
    }
  }
  const layer = String(row.layer || "") as DnaChatPublicKnowledgeAuthority["layer"]
  const verificationStatus = String(row.verificationStatus || "") as DnaChatPublicKnowledgeAuthority["verificationStatus"]
  const contractVersion = String(row.contractVersion || "").trim()
  const labelTr = String(row.labelTr || "").trim()
  const approvalRequirement = String(row.approvalRequirement || "").trim()
  const releaseEligible = row.releaseEligible === true
  if (
    contractVersion !== AUTHORITY_CONTRACT_VERSION
    || !AUTHORITY_LAYERS.has(layer)
    || !AUTHORITY_STATUSES.has(verificationStatus)
    || !labelTr
    || approvalRequirement !== AUTHORITY_APPROVAL_BY_LAYER[layer]
    || (releaseEligible && verificationStatus !== "verified")
  ) return null
  return {
    contractVersion,
    layer,
    labelTr,
    approvalRequirement,
    verificationStatus,
    releaseEligible,
    ...(String(row.boundaryTr || "").trim() ? { boundaryTr: String(row.boundaryTr).trim() } : {}),
  }
}

function normalizeSource(value: unknown, limitedResponse = false): DnaChatPublicSourceRef | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const id = String(row.id || "").trim()
  if (!id) return null
  const authority = normalizeAuthority(row.authority, limitedResponse)
  const optionalString = (key: string) => {
    const candidate = String(row[key] || "").trim()
    return candidate || undefined
  }
  const year = Number(row.year)
  const publicationYear = Number(row.publicationYear)
  const rawUrl = optionalString("url") || optionalString("officialUrl")
  let safeUrl: string | undefined
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl)
      if (parsed.protocol === "https:" || parsed.protocol === "http:") safeUrl = parsed.toString()
    } catch {}
  }
  return {
    id,
    sourceId: optionalString("sourceId"),
    type: optionalString("type"),
    title: optionalString("title"),
    labelTr: optionalString("labelTr"),
    excerpt: optionalString("excerpt"),
    excerptTr: optionalString("excerptTr"),
    citation: optionalString("citation"),
    publicationYear: Number.isFinite(publicationYear) ? publicationYear : undefined,
    year: Number.isFinite(year) ? year : undefined,
    doi: row.doi === null ? null : optionalString("doi"),
    url: safeUrl,
    claimBoundary: optionalString("claimBoundary"),
    ageScope: optionalString("ageScope"),
    studyType: optionalString("studyType"),
    sampleScope: optionalString("sampleScope"),
    authors: optionalString("authors"),
    sourceType: optionalString("sourceType"),
    officialUrl: safeUrl,
    locator: optionalString("locator"),
    evidenceLevel: optionalString("evidenceLevel"),
    supportedClaim: optionalString("supportedClaim"),
    knownBoundary: optionalString("knownBoundary"),
    supportedBoundary: optionalString("supportedBoundary"),
    ...(authority ? { authority } : {}),
  }
}

function normalizeAnswerUnit(
  value: unknown,
  runtimeGeneration: DnaChatPublicAnswer["runtimeGeneration"],
  limitedResponse = false,
): DnaChatPublicAnswerUnit | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const kind = String(row.kind || "") as DnaChatPublicAnswerUnit["kind"]
  const role = String(row.role || "") as DnaChatPublicAnswerUnit["role"]
  const authority = normalizeAuthority(row.authority, limitedResponse)
  const id = String(row.id || "").trim()
  const text = String(row.text || "").trim()
  const rawSection = String(row.section || "") as DnaChatPublicV3AnswerSection
  const section = V3_ANSWER_SECTIONS.has(rawSection) ? rawSection : null
  if (!id || !text || !authority || !ANSWER_UNIT_KINDS.has(kind) || !ANSWER_UNIT_ROLES.has(role)) return null
  if (runtimeGeneration === "v3" && !section) return null
  return {
    id,
    section,
    kind,
    role,
    text,
    authority,
    claimIds: normalizeStringList(row.claimIds),
    passageIds: normalizeStringList(row.passageIds),
    sourceIds: normalizeStringList(row.sourceIds),
    citationCardIds: normalizeStringList(row.citationCardIds),
  }
}

export function normalizeDnaChatPublicResponse(value: unknown): DnaChatPublicAnswer | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const hasLimitedRolloutContract = row.limitedRolloutContract !== undefined
  const limitedRolloutContract = hasLimitedRolloutContract ? validateDnaS13LimitedPublicResponse(row) : null
  if (hasLimitedRolloutContract && !limitedRolloutContract) return null
  if (row.limitedRolloutFeedbackEligible === true && !limitedRolloutContract) return null
  const limitedResponse = Boolean(limitedRolloutContract)
  const classification = String(row.classification || "") as DnaChatPublicClassification
  if (!CLASSIFICATIONS.has(classification)) return null
  const requestId = String(row.requestId || "").trim()
  const responseDepth = String(row.responseDepth || "standard") as DnaChatResponseDepth
  const runtimeGeneration = row.runtimeGeneration === "v3" ? "v3" : "v2_legacy"
  if (!requestId || !RESPONSE_DEPTHS.has(responseDepth)) return null

  const rawContextRequest = row.contextRequest
  const contextRequest = rawContextRequest && typeof rawContextRequest === "object"
    && (rawContextRequest as Record<string, unknown>).type === "report"
    ? { type: "report" as const, preferNewest: (rawContextRequest as Record<string, unknown>).preferNewest !== false }
    : undefined
  const rawEvidenceSummary = row.evidenceSummary
  const rawDnaValidationStatus = rawEvidenceSummary && typeof rawEvidenceSummary === "object"
    ? String((rawEvidenceSummary as Record<string, unknown>).dnaValidationStatus || "") as DnaValidationStatus
    : null
  const evidenceSummary = rawEvidenceSummary && typeof rawEvidenceSummary === "object" ? {
    level: String((rawEvidenceSummary as Record<string, unknown>).level || "").trim(),
    scientificEvidenceLevel: String((rawEvidenceSummary as Record<string, unknown>).scientificEvidenceLevel || "").trim(),
    ...(rawDnaValidationStatus && DNA_VALIDATION_STATUSES.has(rawDnaValidationStatus)
      ? { dnaValidationStatus: rawDnaValidationStatus } : {}),
    ageScope: String((rawEvidenceSummary as Record<string, unknown>).ageScope || "").trim(),
    sampleScope: String((rawEvidenceSummary as Record<string, unknown>).sampleScope || "").trim(),
    boundary: String((rawEvidenceSummary as Record<string, unknown>).boundary || "").trim(),
  } : undefined
  const rawConversationContext = row.conversationContext
  const rawConversationTopicIds = rawConversationContext && typeof rawConversationContext === "object"
    ? normalizeStringList((rawConversationContext as Record<string, unknown>).topicIds).slice(0, 2) : []
  const rawLastQueryKind = rawConversationContext && typeof rawConversationContext === "object"
    ? String((rawConversationContext as Record<string, unknown>).lastQueryKind || "") as DnaChatConversationQueryKind : null
  const conversationContext = rawConversationTopicIds.length && rawLastQueryKind
    && CONVERSATION_QUERY_KINDS.has(rawLastQueryKind)
    ? { topicIds: rawConversationTopicIds, lastQueryKind: rawLastQueryKind } : undefined
  const limitedRolloutContextToken = rawConversationContext && typeof rawConversationContext === "object"
    && typeof (rawConversationContext as Record<string, unknown>).limitedRolloutContextToken === "string"
    ? String((rawConversationContext as Record<string, unknown>).limitedRolloutContextToken).slice(0, 2_048) : null

  const sources = Array.isArray(row.sources)
    ? row.sources.map((entry) => normalizeSource(entry, limitedResponse))
      .filter((entry): entry is DnaChatPublicSourceRef => Boolean(entry)) : []
  if (Array.isArray(row.sources) && sources.length !== row.sources.length) return null
  const authoritySummary = Array.isArray(row.authoritySummary)
    ? row.authoritySummary.map((entry) => normalizeAuthority(entry, limitedResponse))
      .filter((entry): entry is DnaChatPublicKnowledgeAuthority => Boolean(entry)) : []
  if (!Array.isArray(row.authoritySummary) || authoritySummary.length !== row.authoritySummary.length) return null
  const answerUnits = Array.isArray(row.answerUnits)
    ? row.answerUnits.map((entry) => normalizeAnswerUnit(entry, runtimeGeneration, limitedResponse))
      .filter((entry): entry is DnaChatPublicAnswerUnit => Boolean(entry)) : []
  if (!Array.isArray(row.answerUnits) || !answerUnits.length || answerUnits.length !== row.answerUnits.length) return null

  const sourceById = new Map<string, DnaChatPublicSourceRef>()
  const sourceCardsBySourceId = new Map<string, DnaChatPublicSourceRef[]>()
  sources.forEach((source) => {
    sourceById.set(source.id, source)
    const sourceId = source.sourceId || source.id
    sourceCardsBySourceId.set(sourceId, [...(sourceCardsBySourceId.get(sourceId) || []), source])
  })
  if (answerUnits.some((unit) => ANSWER_ROLE_LAYER[unit.role] !== unit.authority.layer
    || unit.sourceIds.some((sourceId) => {
      const cards = sourceCardsBySourceId.get(sourceId) || []
      return !cards.length || cards.some((source) => source.authority?.layer !== unit.authority.layer)
    }))) return null

  if (runtimeGeneration === "v3" && answerUnits.some((unit) => {
    const isScientific = unit.role === "product_definition" || unit.role === "owner_book_information"
      || unit.role === "scientific_evidence" || unit.role === "dna_specific_validation"
    if (!isScientific) return unit.citationCardIds.length > 0 || unit.claimIds.length > 0
      || unit.passageIds.length > 0 || unit.sourceIds.length > 0
    if (!unit.citationCardIds.length) return true
    return unit.citationCardIds.some((cardId) => {
      const card = sourceById.get(cardId)
      return !card || card.authority?.layer !== unit.authority.layer
    })
  })) return null

  return {
    requestId,
    responseDepth,
    runtimeGeneration,
    classification,
    ...(row.availabilityScope === "knowledge" || row.availabilityScope === "report"
      ? { availabilityScope: row.availabilityScope } : {}),
    summary: String(row.summary || "Yanıt oluşturuldu.").trim(),
    details: normalizeStringList(row.details),
    sources,
    authoritySummary,
    answerUnits,
    caseEvidence: normalizeStringList(row.caseEvidence),
    limitations: normalizeStringList(row.limitations),
    safetyBoundary: String(row.safetyBoundary || "").trim(),
    intendedUse: row.intendedUse && typeof row.intendedUse === "object"
      ? row.intendedUse as DnaIntelligencePublicIntendedUse : DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    suggestedQuestions: normalizeStringList(row.suggestedQuestions),
    engineVersion: String(row.engineVersion || "dna-chat-engine@2.1").trim(),
    catalogVersion: String(row.catalogVersion || "dna-chat-catalog@2").trim(),
    packageVersion: String(row.packageVersion || "dna-chat-catalog@2").trim(),
    packageSha256: typeof row.packageSha256 === "string" && /^[a-f0-9]{64}$/u.test(row.packageSha256)
      ? row.packageSha256 : null,
    topic: typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : null,
    limitedRolloutFeedbackEligible: limitedResponse,
    limitedRolloutContextToken,
    ...(conversationContext ? { conversationContext } : {}),
    ...(contextRequest ? { contextRequest } : {}),
    ...(evidenceSummary && Object.values(evidenceSummary).some(Boolean) ? { evidenceSummary } : {}),
  }
}
