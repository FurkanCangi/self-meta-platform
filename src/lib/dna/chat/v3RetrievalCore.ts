import { evaluateClaimGuard } from "../clinicalClaimRegistry"
import { getDnaChatCaseContextAuthority } from "./caseContext"
import { isReleaseEligibleAuthority } from "./knowledgeAuthority"
import { inspectDnaChatSafety } from "./safety"
import {
  dnaCharacterNgrams,
  normalizeDnaChatText,
  tokenizeDnaChatText,
} from "./text"
import type { DnaChatSafeCaseContext } from "./types"
import {
  createDnaV3PolicyUnit,
  createDnaV3ScientificUnit,
  createDnaV3SourceCards,
  sectionForDnaV3ClaimType,
  validateDnaV3AnswerEvidence,
  type DnaV3AnswerSection,
  type DnaV3AnswerUnit,
} from "./v3AnswerEvidence"
import {
  DNA_V3_RESPONSE_DEPTH_SPEC,
  resolveDnaV3ResponseDepth,
  type DnaV3ResponseDepth,
} from "./v3ResponseProfiles"
import {
  dnaV3CaseAgeGroupFromMonths,
  isDnaV3AgeCompatible,
  isDnaV3AgeScopeCompatibleWithGroup,
  type DnaV3AgeGroup,
} from "./v3AgePolicy"
import {
  assembleDnaV3CaseOnlyAnswer,
  assembleDnaV3CaseTheoryAnswer,
} from "./v3CaseTheoryAssembler"

export const DNA_V3_RETRIEVAL_VERSION = "dna-v3-retrieval@1" as const
export const DNA_V3_RETRIEVAL_ENGINE_VERSION = "dna-chat-engine@3" as const

export const DNA_V3_RETRIEVAL_THRESHOLDS = Object.freeze({
  answer: 0.72,
  clarification: 0.5,
  minimumAnswerMargin: 0.12,
  maxSubquestions: 2,
})

export const DNA_V3_QUERY_KINDS = [
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

export type DnaV3QueryKind = (typeof DNA_V3_QUERY_KINDS)[number]
export type DnaV3RetrievalIntent = "theory" | "case" | "case_theory"
export type DnaV3RetrievalStatus = "answer" | "clarification" | "not_available" | "refusal"
export type DnaV3ConfidenceBand = "high" | "medium" | "low" | "blocked"

export type DnaV3RetrievalSource = Readonly<{
  id: string
  title: string
  authors: string | readonly string[]
  year: number | null
  sourceType: string
  doi: string | null
  officialUrl: string | null
  evidenceLevel: string
  ageScope: string
  licenseStatus: "permitted" | "restricted" | "pending" | "not_applicable"
  releaseStatus: "release_eligible" | "owner_approved"
}>

export type DnaV3RetrievalPassage = Readonly<{
  id: string
  sourceId: string
  locator: string
  originalText: string
  approvedTurkishText: string
  ageScope: string
  population: string
  releaseStatus: "release_eligible" | "owner_approved"
}>

export type DnaV3RetrievalClaim = Readonly<{
  id: string
  sourceClaimId: string
  topicId: string
  title: string
  aliases: readonly string[]
  keywords: readonly string[]
  summaryTr: string
  detailsTr: readonly string[]
  claimType: string
  passageIds: readonly string[]
  sourceIds: readonly string[]
  evidenceLevel: string
  ageScope: string
  claimBoundary: string
  authority: "dna_product_information" | "external_scientific_information"
  dnaRelationship:
    | "product_definition"
    | "supported_relation"
    | "conceptual_proximity"
    | "theory_only"
    | "not_established"
    | "contradicted"
    | "not_applicable"
  releaseStatus: "release_eligible" | "owner_approved"
}>

export type DnaV3RetrievalRelation = Readonly<{
  id: string
  fromTopicId: string
  toTopicId: string
  predicate: string
  summaryTr: string
  claimIds: readonly string[]
  sourceIds: readonly string[]
  maxHops: 1
  releaseStatus: "release_eligible" | "owner_approved"
}>

export type DnaV3RetrievalClaimPassageLink = Readonly<{
  claimId: string
  passageId: string
  entailmentStatus: "entailed"
}>

export type DnaV3RetrievalLexicalDocument = Readonly<{
  claimId: string
  titleTokens: readonly string[]
  aliasTokens: readonly string[]
  keywordTokens: readonly string[]
  summaryTokens: readonly string[]
  detailTokens: readonly string[]
}>

export type DnaV3RetrievalPackage = Readonly<{
  manifest: Readonly<{
    packageVersion: string
    packageSha256: string
    includedClaimCount: number
  }>
  sources: readonly DnaV3RetrievalSource[]
  passages: readonly DnaV3RetrievalPassage[]
  claims: readonly DnaV3RetrievalClaim[]
  relations: readonly DnaV3RetrievalRelation[]
  claimPassageLinks: readonly DnaV3RetrievalClaimPassageLink[]
  lexicalIndex: readonly DnaV3RetrievalLexicalDocument[]
}>

export type DnaV3RetrievalSourceCard = Readonly<{
  id: string
  sourceId: string
  passageId: string
  supportedClaimId: string
  title: string
  authors: string
  year: number | null
  sourceType: string
  doi: string | null
  officialUrl: string | null
  locator: string
  evidenceLevel: string
  ageScope: string
  supportedClaim: string
  knownBoundary: string
  /** @deprecated Use `knownBoundary`; retained for the later public adapter. */
  supportedBoundary: string
}>

export type DnaV3RetrievalAnswer = Readonly<{
  retrievalVersion: typeof DNA_V3_RETRIEVAL_VERSION
  engineVersion: typeof DNA_V3_RETRIEVAL_ENGINE_VERSION
  status: DnaV3RetrievalStatus
  classification:
    | "dna_concept"
    | "literature"
    | "case_finding"
    | "hypothesis"
    | "clarification"
    | "not_available"
    | "refusal"
  intent: DnaV3RetrievalIntent
  queryKind: DnaV3QueryKind
  responseDepth: DnaV3ResponseDepth
  topic: string | null
  summary: string
  details: readonly string[]
  sources: readonly DnaV3RetrievalSourceCard[]
  limitations: readonly string[]
  safetyBoundary: string
  suggestedQuestions: readonly string[]
  evidenceSummary: Readonly<{
    level: string
    ageScope: string
    boundary: string
    dnaValidationStatus: DnaV3RetrievalClaim["dnaRelationship"]
  }> | null
  answerUnits: readonly DnaV3AnswerUnit[]
  sections: readonly DnaV3AnswerSection[]
  contextRequest?: Readonly<{
    type: "report"
    preferNewest: true
  }>
  confidenceBand: DnaV3ConfidenceBand
}>

export type DnaV3RetrievalRank = Readonly<{
  claimId: string
  topicId: string
  score: number
  exactScore: number
  tokenCoverage: number
  bm25Score: number
  ngramScore: number
}>

type PreparedClaim = Readonly<{
  claim: DnaV3RetrievalClaim
  lexical: DnaV3RetrievalLexicalDocument
  fieldTokens: Readonly<{
    title: readonly string[]
    aliases: readonly string[]
    keywords: readonly string[]
    summary: readonly string[]
    details: readonly string[]
  }>
  normalizedPatterns: readonly string[]
  ngramPatterns: readonly ReadonlySet<string>[]
}>

const ELIGIBLE_CLAIM_CACHE = new WeakMap<object, readonly DnaV3RetrievalClaim[]>()
const PREPARED_CLAIM_CACHE = new WeakMap<object, readonly PreparedClaim[]>()
const WEIGHTED_DOCUMENT_TOKEN_CACHE = new WeakMap<object, readonly string[]>()
const DOCUMENT_TOKEN_FREQUENCY_CACHE = new WeakMap<object, ReadonlyMap<string, number>>()

const QUERY_KIND_PATTERNS: ReadonlyArray<Readonly<{
  kind: DnaV3QueryKind
  patterns: readonly RegExp[]
}>> = [
  { kind: "comparison", patterns: [/\b(?:fark|farki|karsilastir|ayrilir|benzerlik|benzerligi)\b/, /\bile\b.*\barasinda\b/] },
  { kind: "measurement", patterns: [/\b(?:olculur|olcum|olcek|test|indeks|gecerlik|guvenirlik)\b/] },
  // Age/population words are handled by the independent age-scope filter.
  // They must not turn a definition/evidence question into a development
  // question and thereby exclude otherwise compatible claim types.
  { kind: "development", patterns: [/\b(?:gelisim|gelisimsel|yasla|yasa gore|gelisir|degisir|olgunlas)\w*\b/] },
  { kind: "evidence", patterns: [/\b(?:kanit|literatur|kaynak|calisma|arastirma)\w*\b/] },
  { kind: "misconception", patterns: [/\b(?:yanlis mi|dogru mu|mit|yanlis bilinen)\b/] },
  { kind: "dna_relation", patterns: [/\bdna\b.*\b(?:iliski|baglanti|alan|konsept)\w*\b/] },
  { kind: "relation", patterns: [/\b(?:iliski|baglanti|etkilesim|birlikte)\w*\b/] },
  { kind: "definition", patterns: [/\b(?:nedir|ne demek|tanimla|acikla)\b/] },
]

const CASE_PATTERNS = [
  /\b(?:bu|sectigim|secili|son) (?:rapor|vaka|degerlendirme)\w*\b/,
  /\b(?:raporum|raporda|rapordaki|vakadaki|vaka skor|danisanin)\w*\b/,
] as const

const THEORY_PATTERNS = [
  /\b(?:teori|literatur|kanit|kaynak|mekanizma|norofizyoloji)\w*\b/,
  /\b(?:korteks|sinir sistemi|interosepsiyon|hrv|uyarilma|regulasyon)\w*\b/,
] as const

const CASE_ONLY_FIELD_PATTERNS = [
  /\b(?:karsi kanit|karsi bulgu|korunmus kapasite|ana eksen|birincil eksen)\w*\b/,
  /\b(?:eksik veri|veri siniri|raporda yok)\w*\b/,
] as const

const EXPLICIT_EXTERNAL_THEORY_PATTERNS = [
  /\b(?:teori|literatur|mekanizma|norofizyoloji|bilimsel kaynak)\w*\b/,
  /\b(?:korteks|sinir sistemi|interosepsiyon|hrv|uyarilma)\w*\b/,
] as const

const ALLOWED_EVIDENCE_LEVELS = new Set([
  "high",
  "moderate",
  "low",
  "very_low",
  "very low",
  "strong",
  "limited",
  "theoretical",
  "boundary",
])

const FINAL_CLAIM_FORBIDDEN_PATTERNS = [
  /\b(?:tani|tanidir|taniyi)\b.{0,28}\b(?:kesin|gosterir|koyar|dogrular)\b/,
  /\b(?:kesin|gosterir|koyar|dogrular)\b.{0,28}\b(?:tani|tanidir|taniyi)\b/,
  /\b(?:tedavi plani|seans plani|ilac dozu|recete|prognoz)\b/,
  /\b(?:kesin neden|kesin sebep|kesin nedensellik)\b/,
  /\bbu (?:vaka|rapor|danisan)\b.{0,80}\b(?:beyin bolgesi|hrv|kortizol|otonom durum)\b/,
  /\b(?:reasoning trace|chain of thought|internal rule|rule id|audit trail|gizli esik)\b/,
] as const

const OUTPUT_BOUNDARY_LANGUAGE =
  /\b(?:uretmez|onermez|degildir|cikarilamaz|gostermez|saglamaz|yerine gecmez|olusturmaz|kapsam disidir)\b/
const OUTPUT_AFFIRMATIVE_UNSAFE_LANGUAGE =
  /\b(?:tani koyar|tani konur|tanisi vardir|tedavi edilmelidir|mudahale uygulanmalidir|ilac baslanmalidir|seans plani uygulanmalidir|otizmle uyumludur|dehb ile uyumludur)\b/
const OUTPUT_PRACTICE_LANGUAGE =
  /\b(?:tedavi\w*|mudahale\w*|terapi\w*|seans\w*|ilac\w*|recete\w*|danismanlik|destek plani|uygulama yonergesi|program\w*|protokol\w*|egzersiz\w*|odev\w*)\b/
const OUTPUT_DIRECTIVE_LANGUAGE =
  /\b(?:\w*(?:malidir|melidir|mali|meli)|yapilmali|uygulanmali|baslanmali|baslanmasi|verilmeli|onerilmeli|calisilmali|gerekir|uygundur)\b/
const OUTPUT_DIAGNOSTIC_LANGUAGE =
  /\b(?:tani\w*|teshis\w*|otizm\w*|otistik\w*|dehb\w*|adhd\w*|semptom\w*|bozukluk\w*|patoloji\w*|patolojik\w*)\b/
const OUTPUT_DIAGNOSTIC_ASSERTION =
  /\b(?:uyumludur|uyumlu|vardir|var|gosterir|belirtisidir|dusundurur|olabilir)\b/

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"))
}

function tokenFrequency(tokens: readonly string[]): Map<string, number> {
  const result = new Map<string, number>()
  for (const token of tokens) result.set(token, (result.get(token) ?? 0) + 1)
  return result
}

function fieldTokens(claim: DnaV3RetrievalClaim): PreparedClaim["fieldTokens"] {
  return Object.freeze({
    title: tokenizeDnaChatText(claim.title),
    aliases: claim.aliases.flatMap(tokenizeDnaChatText),
    keywords: claim.keywords.flatMap(tokenizeDnaChatText),
    summary: tokenizeDnaChatText(claim.summaryTr),
    details: claim.detailsTr.flatMap(tokenizeDnaChatText),
  })
}

function lexicalForClaim(
  claim: DnaV3RetrievalClaim,
  lexicalIndex: readonly DnaV3RetrievalLexicalDocument[],
): DnaV3RetrievalLexicalDocument {
  const indexed = lexicalIndex.find((row) => row.claimId === claim.id)
  if (indexed) return indexed
  const fields = fieldTokens(claim)
  return Object.freeze({
    claimId: claim.id,
    titleTokens: fields.title,
    aliasTokens: fields.aliases,
    keywordTokens: fields.keywords,
    summaryTokens: fields.summary,
    detailTokens: fields.details,
  })
}

function isQueryKindCompatible(question: string, claimType: string): boolean {
  const kind = classifyDnaV3QueryKind(question)
  const type = normalizeDnaChatText(claimType).replace(/\s+/g, "_")
  if (kind === "measurement") return /(?:measurement|psychometric|measure|olcum)/.test(type)
  if (kind === "development") return /(?:development|trajectory|age|gelisim)/.test(type)
  if (kind === "misconception") return /(?:misconception|correction|boundary)/.test(type)
  return true
}

function claimMatchesRequiredAgeGroup(
  claim: DnaV3RetrievalClaim,
  passageById: ReadonlyMap<string, DnaV3RetrievalPassage>,
  requiredAgeGroup: DnaV3AgeGroup | null | undefined,
): boolean {
  if (!requiredAgeGroup) return true
  return isDnaV3AgeScopeCompatibleWithGroup(claim.ageScope, requiredAgeGroup)
    && claim.passageIds.every((passageId) => {
      const passage = passageById.get(passageId)
      return Boolean(passage
        && isDnaV3AgeScopeCompatibleWithGroup(passage.ageScope, requiredAgeGroup))
    })
}

function eligibleClaims(
  pkg: DnaV3RetrievalPackage,
  question: string,
  requiredAgeGroup?: DnaV3AgeGroup | null,
): DnaV3RetrievalClaim[] {
  const cached = ELIGIBLE_CLAIM_CACHE.get(pkg)
  if (cached) {
    const passageById = new Map(pkg.passages.map((passage) => [passage.id, passage]))
    return cached.filter((claim) =>
      isDnaV3AgeCompatible(
        question,
        claim.ageScope,
        ...claim.passageIds.map((passageId) => passageById.get(passageId)?.ageScope ?? ""),
      ) && isQueryKindCompatible(question, claim.claimType)
        && claimMatchesRequiredAgeGroup(claim, passageById, requiredAgeGroup))
  }
  const sourceById = new Map(pkg.sources.map((source) => [source.id, source]))
  const passageById = new Map(pkg.passages.map((passage) => [passage.id, passage]))
  const entailedLinks = new Set(pkg.claimPassageLinks
    .filter((link) => link.entailmentStatus === "entailed")
    .map((link) => `${link.claimId}\u0000${link.passageId}`))

  const eligible = pkg.claims.filter((claim) => {
    if (!ALLOWED_EVIDENCE_LEVELS.has(normalizeDnaChatText(claim.evidenceLevel))) return false
    if (!claim.passageIds.length || !claim.sourceIds.length) return false
    const boundPassages = claim.passageIds.map((passageId) => passageById.get(passageId))
    if (boundPassages.some((passage) => !passage)) return false
    if (!boundPassages.every((passage) => {
      if (!passage) return false
      return Boolean(
        claim.sourceIds.includes(passage.sourceId) &&
        passage.releaseStatus === claim.releaseStatus &&
        entailedLinks.has(`${claim.sourceClaimId}\u0000${passage.id}`),
      )
    })) return false
    return claim.sourceIds.every((sourceId) => {
      const source = sourceById.get(sourceId)
      return Boolean(
        source &&
        source.releaseStatus === claim.releaseStatus &&
        ["permitted", "not_applicable"].includes(source.licenseStatus) &&
        boundPassages.some((passage) => passage?.sourceId === sourceId),
      )
    })
  }).sort((left, right) => left.id.localeCompare(right.id, "en"))
  ELIGIBLE_CLAIM_CACHE.set(pkg, Object.freeze(eligible))
  return eligible.filter((claim) => {
    const passages = claim.passageIds.map((passageId) => passageById.get(passageId))
    return isDnaV3AgeCompatible(question, claim.ageScope, ...passages.map((passage) => passage?.ageScope ?? ""))
      && isQueryKindCompatible(question, claim.claimType)
      && claimMatchesRequiredAgeGroup(claim, passageById, requiredAgeGroup)
  })
}

function preparedClaims(
  pkg: DnaV3RetrievalPackage,
  question: string,
  requiredAgeGroup?: DnaV3AgeGroup | null,
): readonly PreparedClaim[] {
  let prepared = PREPARED_CLAIM_CACHE.get(pkg)
  if (!prepared) {
    prepared = Object.freeze(eligibleClaims(pkg, "").map((claim) => {
      const lexical = lexicalForClaim(claim, pkg.lexicalIndex)
      const normalizedPatterns = Object.freeze([claim.title, ...claim.aliases]
        .map(normalizeDnaChatText)
        .filter((pattern) => pattern.length >= 3))
      return Object.freeze({
        claim,
        lexical,
        fieldTokens: fieldTokens(claim),
        normalizedPatterns,
        ngramPatterns: Object.freeze(normalizedPatterns.map((pattern) => dnaCharacterNgrams(pattern))),
      })
    }))
    PREPARED_CLAIM_CACHE.set(pkg, prepared)
  }
  const passageById = new Map(pkg.passages.map((passage) => [passage.id, passage]))
  return prepared.filter((row) =>
    isDnaV3AgeCompatible(
      question,
      row.claim.ageScope,
      ...row.claim.passageIds.map((passageId) => passageById.get(passageId)?.ageScope ?? ""),
    ) && isQueryKindCompatible(question, row.claim.claimType)
      && claimMatchesRequiredAgeGroup(row.claim, passageById, requiredAgeGroup))
}

function weightedDocumentTokens(prepared: PreparedClaim): readonly string[] {
  const cached = WEIGHTED_DOCUMENT_TOKEN_CACHE.get(prepared)
  if (cached) return cached
  const tokens = Object.freeze([
    ...prepared.lexical.titleTokens.flatMap((token) => [token, token, token]),
    ...prepared.lexical.aliasTokens.flatMap((token) => [token, token, token]),
    ...prepared.lexical.keywordTokens.flatMap((token) => [token, token]),
    ...prepared.lexical.summaryTokens,
    ...prepared.lexical.detailTokens,
  ])
  WEIGHTED_DOCUMENT_TOKEN_CACHE.set(prepared, tokens)
  return tokens
}

function documentTokenFrequency(prepared: PreparedClaim): ReadonlyMap<string, number> {
  const cached = DOCUMENT_TOKEN_FREQUENCY_CACHE.get(prepared)
  if (cached) return cached
  const frequency = tokenFrequency(weightedDocumentTokens(prepared))
  DOCUMENT_TOKEN_FREQUENCY_CACHE.set(prepared, frequency)
  return frequency
}

function ngramSetDice(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (!left.size || !right.size) return 0
  let intersection = 0
  for (const gram of left) if (right.has(gram)) intersection += 1
  return (2 * intersection) / (left.size + right.size)
}

function exactTopicScore(question: string, prepared: PreparedClaim): number {
  const normalized = normalizeDnaChatText(question)
  const normalizedCore = normalized
    .replace(/\b(?:nedir|ne demek|tanimla|acikla|anlat|hakkinda)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const patterns = prepared.normalizedPatterns
  if (patterns.some((pattern) => normalized === pattern || normalizedCore === pattern)) return 1
  if (patterns.some((pattern) => ` ${normalized} `.includes(` ${pattern} `))) return 0.94
  const coreNgrams = dnaCharacterNgrams(normalizedCore)
  if (prepared.ngramPatterns.some((pattern) => ngramSetDice(coreNgrams, pattern) >= 0.68)) return 0.82
  return 0
}

function weightedTokenCoverage(queryTokens: readonly string[], prepared: PreparedClaim): number {
  if (!queryTokens.length) return 0
  const title = new Set(prepared.fieldTokens.title)
  const aliases = new Set(prepared.fieldTokens.aliases)
  const keywords = new Set(prepared.fieldTokens.keywords)
  const summary = new Set(prepared.fieldTokens.summary)
  const details = new Set(prepared.fieldTokens.details)
  const matched = queryTokens.reduce((total, token) => {
    if (title.has(token)) return total + 1
    if (aliases.has(token)) return total + 0.95
    if (keywords.has(token)) return total + 0.8
    if (summary.has(token)) return total + 0.65
    if (details.has(token)) return total + 0.45
    return total
  }, 0)
  return Math.min(1, matched / queryTokens.length)
}

function isFollowupQuestion(question: string): boolean {
  const normalized = normalizeDnaChatText(question)
  return /\b(?:bunu|devam|biraz daha|kanit|kaynak|sinir|olcum|peki)\w*\b/.test(normalized)
}

function bm25Scores(queryTokens: readonly string[], prepared: readonly PreparedClaim[]): Map<string, number> {
  const documents = prepared.map((row) => ({
    row,
    tokens: weightedDocumentTokens(row),
    frequency: documentTokenFrequency(row),
  }))
  const averageLength = documents.length
    ? documents.reduce((sum, document) => sum + document.tokens.length, 0) / documents.length
    : 1
  const documentFrequency = new Map<string, number>()
  for (const token of stableUnique(queryTokens)) {
    documentFrequency.set(token, documents.filter((document) => document.frequency.has(token)).length)
  }

  const raw = new Map<string, number>()
  const k1 = 1.2
  const b = 0.75
  for (const document of documents) {
    const frequency = document.frequency
    let score = 0
    for (const token of stableUnique(queryTokens)) {
      const tf = frequency.get(token) ?? 0
      if (!tf) continue
      const df = documentFrequency.get(token) ?? 0
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5))
      const denominator = tf + k1 * (1 - b + b * document.tokens.length / Math.max(1, averageLength))
      score += idf * ((tf * (k1 + 1)) / denominator)
    }
    raw.set(document.row.claim.id, score)
  }
  const max = Math.max(0, ...raw.values())
  return new Map([...raw].map(([claimId, score]) => [claimId, max ? score / max : 0]))
}

export function splitDnaV3Subquestions(question: string): Readonly<{
  questions: readonly string[]
  exceedsLimit: boolean
}> {
  const source = String(question || "").trim()
  let parts = source
    .split(/(?:\?+|\n+|;|\b(?:ayrica|ayrıca)\b)/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
  if (parts.length === 1) {
    const twoPredicateQuestions = source.match(
      /^(.+\b(?:nedir|ne demek|nasil olculur|nasıl ölçülür|acikla|açıkla)\b)\s+ve\s+(.+\b(?:nedir|ne demek|nasil olculur|nasıl ölçülür|acikla|açıkla)\b)[?.!]*$/i,
    )
    if (twoPredicateQuestions) parts = [twoPredicateQuestions[1]!, twoPredicateQuestions[2]!]
  }
  const questions = parts.length ? parts : [source].filter(Boolean)
  return Object.freeze({
    questions: Object.freeze(questions.slice(0, DNA_V3_RETRIEVAL_THRESHOLDS.maxSubquestions)),
    exceedsLimit: questions.length > DNA_V3_RETRIEVAL_THRESHOLDS.maxSubquestions,
  })
}

export function classifyDnaV3RetrievalIntent(question: string): DnaV3RetrievalIntent {
  const normalized = normalizeDnaChatText(question)
  const hasCase = CASE_PATTERNS.some((pattern) => pattern.test(normalized))
  const hasTheory = THEORY_PATTERNS.some((pattern) => pattern.test(normalized))
  const asksOnlyStructuredCaseField = CASE_ONLY_FIELD_PATTERNS.some((pattern) => pattern.test(normalized))
    && !EXPLICIT_EXTERNAL_THEORY_PATTERNS.some((pattern) => pattern.test(normalized))
  if (hasCase && asksOnlyStructuredCaseField) return "case"
  if (hasCase && hasTheory) return "case_theory"
  return hasCase ? "case" : "theory"
}

export function classifyDnaV3QueryKind(question: string): DnaV3QueryKind {
  const normalized = normalizeDnaChatText(question)
  const intent = classifyDnaV3RetrievalIntent(question)
  if (intent === "case_theory") return "case_theory"
  if (intent === "case") return "case_finding"
  return QUERY_KIND_PATTERNS.find((row) => row.patterns.some((pattern) => pattern.test(normalized)))?.kind
    ?? "unknown"
}

export function rankDnaV3RetrievalCandidates(
  question: string,
  pkg: DnaV3RetrievalPackage,
  options: Readonly<{
    previousTopic?: string | null
    requiredAgeGroup?: DnaV3AgeGroup | null
  }> = {},
): readonly DnaV3RetrievalRank[] {
  const prepared = preparedClaims(pkg, question, options.requiredAgeGroup)
  const queryTokens = tokenizeDnaChatText(question)
  const queryNgrams = dnaCharacterNgrams(question)
  const bm25 = bm25Scores(queryTokens, prepared)

  return Object.freeze(prepared.map((row) => {
    const exactScore = exactTopicScore(question, row)
    const tokenCoverage = weightedTokenCoverage(queryTokens, row)
    const bm25Score = bm25.get(row.claim.id) ?? 0
    const ngramScore = Math.max(0, ...row.ngramPatterns.map((pattern) => ngramSetDice(queryNgrams, pattern)))
    const previousTopicHint = options.previousTopic === row.claim.topicId && queryTokens.length <= 5
      ? 0.13
      : 0
    const compositeScore = Math.min(1,
      exactScore * 0.5 + tokenCoverage * 0.25 + bm25Score * 0.15 + ngramScore * 0.1 + previousTopicHint,
    )
    const score = Number((
      options.previousTopic === row.claim.topicId && exactScore === 0 && isFollowupQuestion(question)
        ? Math.max(0.78, compositeScore)
        : compositeScore
    ).toFixed(6))
    return Object.freeze({
      claimId: row.claim.id,
      topicId: row.claim.topicId,
      score,
      exactScore: Number(exactScore.toFixed(6)),
      tokenCoverage: Number(tokenCoverage.toFixed(6)),
      bm25Score: Number(bm25Score.toFixed(6)),
      ngramScore: Number(ngramScore.toFixed(6)),
    })
  }).sort((left, right) => right.score - left.score || left.claimId.localeCompare(right.claimId, "en")))
}

function refusalAnswer(
  question: string,
  intent: DnaV3RetrievalIntent,
  queryKind: DnaV3QueryKind,
  responseDepth: DnaV3ResponseDepth,
): DnaV3RetrievalAnswer | null {
  const safety = inspectDnaChatSafety(question)
  if (!safety.blocked) return null
  return Object.freeze({
    retrievalVersion: DNA_V3_RETRIEVAL_VERSION,
    engineVersion: DNA_V3_RETRIEVAL_ENGINE_VERSION,
    status: "refusal",
    classification: "refusal",
    intent,
    queryKind,
    responseDepth,
    topic: null,
    summary: safety.boundaryTr,
    details: Object.freeze([]),
    sources: Object.freeze([]),
    limitations: Object.freeze(["Bu güvenlik sınırı kaynak eşleştirmesinden önce uygulanır."]),
    safetyBoundary: safety.boundaryTr,
    suggestedQuestions: Object.freeze(["Genel bir nörofizyoloji kavramını kaynaklarıyla açıklar mısın?"]),
    evidenceSummary: null,
    answerUnits: Object.freeze([]),
    sections: Object.freeze([]),
    confidenceBand: "blocked",
  })
}

function noAnswer(input: {
  status: "clarification" | "not_available"
  intent: DnaV3RetrievalIntent
  queryKind: DnaV3QueryKind
  summary: string
  details?: readonly string[]
  topic?: string | null
  contextRequest?: { type: "report"; preferNewest: true }
  suggestions?: readonly string[]
  responseDepth?: DnaV3ResponseDepth
}): DnaV3RetrievalAnswer {
  return Object.freeze({
    retrievalVersion: DNA_V3_RETRIEVAL_VERSION,
    engineVersion: DNA_V3_RETRIEVAL_ENGINE_VERSION,
    status: input.status,
    classification: input.status,
    intent: input.intent,
    queryKind: input.queryKind,
    responseDepth: input.responseDepth ?? "standard",
    topic: input.topic ?? null,
    summary: input.summary,
    details: Object.freeze([...(input.details ?? [])]),
    sources: Object.freeze([]),
    limitations: Object.freeze(["Yalnız yayıma uygun ve pasajla doğrulanmış V3 kayıtları kullanılabilir."]),
    safetyBoundary: "Tanı, tedavi, prognoz, kesin nedensellik veya bireysel biyolojik mekanizma çıkarımı yapılmaz.",
    suggestedQuestions: Object.freeze([...(input.suggestions ?? [])]),
    evidenceSummary: null,
    answerUnits: Object.freeze([]),
    sections: Object.freeze([]),
    ...(input.contextRequest ? { contextRequest: Object.freeze(input.contextRequest) } : {}),
    confidenceBand: input.status === "clarification" ? "medium" : "low",
  })
}

function eligibleOneHopRelations(
  topicIds: readonly [string, string],
  pkg: DnaV3RetrievalPackage,
): readonly DnaV3RetrievalRelation[] {
  const eligible = eligibleClaims(pkg, "")
  const claimIds = new Set(eligible.map((claim) => claim.sourceClaimId))
  const releaseStatusesByClaimId = new Map<string, Set<DnaV3RetrievalClaim["releaseStatus"]>>()
  for (const claim of eligible) {
    const statuses = releaseStatusesByClaimId.get(claim.sourceClaimId) ?? new Set()
    statuses.add(claim.releaseStatus)
    releaseStatusesByClaimId.set(claim.sourceClaimId, statuses)
  }
  const sourceIds = new Set(pkg.sources
    .filter((source) => ["permitted", "not_applicable"].includes(source.licenseStatus))
    .map((source) => source.id))
  const requested = new Set(topicIds)
  return pkg.relations.filter((relation) =>
    relation.maxHops === 1 &&
    ["release_eligible", "owner_approved"].includes(relation.releaseStatus) &&
    requested.size === 2 &&
    requested.has(relation.fromTopicId) &&
    requested.has(relation.toTopicId) &&
    relation.claimIds.length > 0 &&
    relation.claimIds.every((claimId) => claimIds.has(claimId)) &&
    relation.claimIds.every((claimId) => {
      const statuses = releaseStatusesByClaimId.get(claimId)
      return statuses?.size === 1 && statuses.has(relation.releaseStatus)
    }) &&
    relation.sourceIds.length > 0 &&
    relation.sourceIds.every((sourceId) => sourceIds.has(sourceId)),
  ).sort((left, right) => left.id.localeCompare(right.id, "en"))
}

function hasVerifiedReportContext(context: DnaChatSafeCaseContext | null | undefined): boolean {
  if (!context || context.dataStatus !== "deidentified") return false
  try {
    return isReleaseEligibleAuthority(getDnaChatCaseContextAuthority(context))
  } catch {
    return false
  }
}

function theoryQuestionFromMixedCaseQuestion(question: string): string {
  return String(question || "")
    .replace(/\b(?:(?:bu|sectigim|seçtiğim|secili|seçili|son)\s+)?(?:rapor(?:da|de|daki|deki|um|umdaki)?|vaka(?:da|de|daki|deki)?|degerlendirme(?:de|deki)?|değerlendirme(?:de|deki)?)\b/gi, " ")
    .replace(/\b(?:danisanin|danışanın)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function finalClaimGuard(texts: readonly string[]): boolean {
  const sentences = texts.flatMap((text) => String(text || "").split(/(?<=[.!?;])\s+/))
  return sentences.every((sentence) => {
    const normalized = normalizeDnaChatText(sentence)
    if (!normalized) return false
    const affirmativeUnsafe = OUTPUT_AFFIRMATIVE_UNSAFE_LANGUAGE.test(normalized)
    const directivePractice = OUTPUT_PRACTICE_LANGUAGE.test(normalized)
      && OUTPUT_DIRECTIVE_LANGUAGE.test(normalized)
    const diagnosticAssertion = OUTPUT_DIAGNOSTIC_LANGUAGE.test(normalized)
      && OUTPUT_DIAGNOSTIC_ASSERTION.test(normalized)
    if (OUTPUT_BOUNDARY_LANGUAGE.test(normalized)
      && !affirmativeUnsafe && !directivePractice && !diagnosticAssertion) return true
    return !affirmativeUnsafe
      && !directivePractice
      && !diagnosticAssertion
      && !FINAL_CLAIM_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(normalized))
      && !evaluateClaimGuard(sentence).some((issue) => issue.severity === "critical")
  })
}

export function dnaV3RelationshipBoundary(
  relationship: DnaV3RetrievalClaim["dnaRelationship"],
): string | null {
  switch (relationship) {
    case "product_definition":
      return "Bu bağlantı DNA ürün tanımıdır; bilimsel geçerlik iddiası değildir."
    case "supported_relation":
      return "Açık tek-adımlı kaynak ilişkisi desteklenmektedir; bu, DNA ürününün genel geçerliğini kanıtlamaz."
    case "conceptual_proximity":
      return "Yalnız kavramsal yakınlık kurulabilir; doğrudan bilimsel DNA ilişkisi gösterilmemiştir."
    case "theory_only":
      return "Bu bağlantı yalnız teori düzeyindedir ve yerleşik olgu olarak sunulamaz."
    case "not_established":
      return "Bu DNA ilişkisi mevcut onaylı kanıt paketiyle kurulmuş değildir."
    case "contradicted":
      return "Önerilen DNA ilişkisiyle çelişen kanıt vardır; desteklenmiş bağlantı olarak sunulamaz."
    case "not_applicable":
      return null
  }
}

const SECTION_TITLES: Readonly<Record<DnaV3AnswerSection["kind"], string>> = Object.freeze({
  definition: "Tanım",
  function_or_relation: "İşlev, mekanizma veya ilişki",
  development: "Gelişim",
  measurement: "Ölçüm",
  evidence_status: "Kanıt durumu",
  counter_evidence: "Karşı kanıt ve sınırlar",
  dna_boundary: "DNA bağlantısının sınırı",
  case_context: "Vaka bağlamı",
  case_finding: "Raporda bulunan bulgu",
  case_missing: "Raporda bulunmayan veya eksik veri",
  general_literature: "Genel literatür",
  case_non_inference: "Bu vaka için çıkarılamayacak sonuç",
  preserved_capacity: "Korunmuş kapasite veya karşı kanıt",
  boundary: "Temel sınır",
})

function profileSectionKinds(depth: DnaV3ResponseDepth): readonly DnaV3AnswerSection["kind"][] {
  if (depth === "short") return Object.freeze(["definition", "boundary"])
  if (depth === "standard") {
    return Object.freeze(["definition", "function_or_relation", "evidence_status", "dna_boundary", "boundary"])
  }
  return Object.freeze([
    "definition",
    "function_or_relation",
    "development",
    "measurement",
    "evidence_status",
    "counter_evidence",
    "dna_boundary",
    "case_context",
    "boundary",
  ])
}

function buildSections(
  depth: DnaV3ResponseDepth,
  units: readonly DnaV3AnswerUnit[],
): readonly DnaV3AnswerSection[] {
  const kinds = [...new Set([
    ...profileSectionKinds(depth),
    ...units.map((unit) => unit.section),
  ])] as DnaV3AnswerSection["kind"][]
  return Object.freeze(kinds.map((kind) => Object.freeze({
    kind,
    titleTr: SECTION_TITLES[kind],
    unitIds: Object.freeze(units.filter((unit) => unit.section === kind).map((unit) => unit.id)),
  })))
}

function selectScientificUnitsForProfile(
  units: readonly DnaV3AnswerUnit[],
  depth: DnaV3ResponseDepth,
  minimumRequiredUnits = 0,
): readonly DnaV3AnswerUnit[] {
  const selected: DnaV3AnswerUnit[] = []
  const displayedClaims = new Set<string>()
  const spec = DNA_V3_RESPONSE_DEPTH_SPEC[depth]
  for (const unit of units) {
    const newClaims = unit.claimIds.filter((claimId) => !displayedClaims.has(claimId))
    if (displayedClaims.size + newClaims.length > spec.maxSources) continue
    selected.push(unit)
    newClaims.forEach((claimId) => displayedClaims.add(claimId))
    if (selected.length >= Math.max(spec.maxScientificUnits, minimumRequiredUnits)) break
  }
  return Object.freeze(selected)
}

function sourceCardsForDisplayedUnits(
  cards: readonly DnaV3RetrievalSourceCard[],
  units: readonly DnaV3AnswerUnit[],
  maxSources: number,
): readonly DnaV3RetrievalSourceCard[] {
  const claimOrder = [...new Set(units.flatMap((unit) => unit.claimIds))]
  const selected: DnaV3RetrievalSourceCard[] = []
  for (const claimId of claimOrder) {
    const card = cards.find((candidate) => candidate.supportedClaimId === claimId)
    if (card) selected.push(card)
  }
  for (const card of cards) {
    if (!selected.some((candidate) => candidate.id === card.id)) selected.push(card)
  }
  return Object.freeze(selected.slice(0, maxSources))
}

export function resolveDnaV3Retrieval(
  input: Readonly<{
    question: string
    previousTopic?: string | null
    caseContext?: DnaChatSafeCaseContext | null
    responseDepth?: DnaV3ResponseDepth | null
    /** Internal age filter derived from an owned report; never accepted as clinical evidence. */
    requiredAgeGroup?: DnaV3AgeGroup | null
  }>,
  pkg: DnaV3RetrievalPackage,
): DnaV3RetrievalAnswer {
  const question = String(input.question || "").trim()
  const responseDepth = resolveDnaV3ResponseDepth(question, input.responseDepth)
  if (question.length < 2 || question.length > 600) {
    return noAnswer({
      status: "clarification",
      intent: "theory",
      queryKind: "unknown",
      responseDepth,
      summary: "Soru 2–600 karakter arasında ve tek ile iki alt soru içerecek biçimde yazılmalıdır.",
    })
  }
  const intent = classifyDnaV3RetrievalIntent(question)
  const queryKind = classifyDnaV3QueryKind(question)
  const refused = refusalAnswer(question, intent, queryKind, responseDepth)
  if (refused) return refused

  const split = splitDnaV3Subquestions(question)
  if (split.exceedsLimit) {
    return noAnswer({
      status: "clarification",
      intent,
      queryKind,
      responseDepth,
      summary: "Bir mesajda en fazla iki ayrı soruyu değerlendirebilirim. Lütfen sorulardan en fazla ikisini seçin.",
      suggestions: split.questions,
    })
  }

  const verifiedReportContext = hasVerifiedReportContext(input.caseContext)
  if (intent !== "theory" && !verifiedReportContext) {
    return noAnswer({
      status: "clarification",
      intent,
      queryKind,
      responseDepth,
      summary: "Bu soru bir rapor bağlamı gerektiriyor. Tartışılacak raporu seçin.",
      contextRequest: { type: "report", preferNewest: true },
      suggestions: ["En yeni raporu seç", "Başka bir rapor seç"],
    })
  }
  if (intent === "case_theory" && input.caseContext) {
    const theoryQuestion = theoryQuestionFromMixedCaseQuestion(question)
    const reportAgeGroup = dnaV3CaseAgeGroupFromMonths(input.caseContext.ageMonths)
    const theoryAnswer = resolveDnaV3Retrieval({
      question: theoryQuestion,
      previousTopic: input.previousTopic,
      responseDepth,
      requiredAgeGroup: reportAgeGroup,
    }, pkg)
    const mixed = assembleDnaV3CaseTheoryAnswer({
      context: input.caseContext,
      theoryAnswer,
      pkg,
    })
    if (mixed) return mixed
    return noAnswer({
      status: "not_available",
      intent,
      queryKind,
      responseDepth,
      summary: "Rapor bağlamı doğrulandı; ancak soruyla eşleşen yayıma uygun teori iddiası ve claim–passage bağları birlikte doğrulanamadı.",
    })
  }
  if (intent !== "theory") {
    const caseOnly = input.caseContext
      ? assembleDnaV3CaseOnlyAnswer({
          question,
          context: input.caseContext,
          responseDepth,
          pkg,
        })
      : null
    if (caseOnly) return caseOnly
    return noAnswer({
      status: "not_available",
      intent,
      queryKind,
      responseDepth,
      summary: "Doğrulanmış rapor bağlamında bu soruyu yanıtlayacak güvenli yapılandırılmış vaka alanı bulunmuyor.",
    })
  }

  const previousTopic = input.previousTopic && eligibleClaims(
    pkg,
    question,
    input.requiredAgeGroup,
  )
    .some((claim) => claim.topicId === input.previousTopic)
    ? input.previousTopic
    : null

  if (split.questions.length > 1) {
    const childAnswers = split.questions.map((subquestion) => resolveDnaV3Retrieval({
      question: subquestion,
      previousTopic,
      caseContext: input.caseContext,
      responseDepth,
      requiredAgeGroup: input.requiredAgeGroup,
    }, pkg))
    if (childAnswers.some((answer) => answer.status !== "answer")) {
      return noAnswer({
        status: "clarification",
        intent,
        queryKind,
        responseDepth,
        summary: "Sorunun iki bölümünden en az biri güvenle eşleştirilemedi.",
        // Do not copy a successfully matched child's scientific prose into a
        // citation-free clarification response. The caller may retry either
        // subquestion separately and receive the exact bound answer then.
        details: childAnswers.map((answer, index) =>
          `${index + 1}. bölüm: ${answer.status === "answer"
            ? "eşleşti; birleşik yanıt gösterilmedi"
            : "güvenle eşleştirilemedi"}.`),
        suggestions: split.questions,
      })
    }
    const classifications = new Set(childAnswers.map((answer) => answer.classification))
    const childUnits = childAnswers.map((answer, answerIndex) =>
      answer.answerUnits.map((unit) => Object.freeze({
        ...unit,
        id: `subquestion-${answerIndex + 1}::${unit.id}`,
      })))
    const essentialSummaryUnits = childAnswers.flatMap((answer, answerIndex) =>
      childUnits[answerIndex]!.filter((unit) => unit.text === answer.summary).slice(0, 1))
    const essentialBoundaryUnits = childAnswers.flatMap((answer, answerIndex) =>
      childUnits[answerIndex]!.filter((unit) =>
        (unit.authority === "external_science" || unit.authority === "dna_product")
        && answer.limitations.includes(unit.text)).slice(0, 1))
    const remainingScientificUnits = childUnits.flat().filter((unit) =>
      (unit.authority === "external_science" || unit.authority === "dna_product")
      && ![...essentialSummaryUnits, ...essentialBoundaryUnits]
        .some((essential) => essential.id === unit.id))
    const selectedScientificUnits = selectScientificUnitsForProfile([
      ...essentialSummaryUnits,
      ...essentialBoundaryUnits,
      ...remainingScientificUnits,
    ], responseDepth, essentialSummaryUnits.length)
    const selectedScientificTexts = new Set(selectedScientificUnits.map((unit) => unit.text))
    const displayedPolicyUnits = childUnits.flat().filter((unit) =>
      unit.authority === "safety_policy"
      && childAnswers.some((answer) => answer.limitations.includes(unit.text)))
    const combinedUnits = Object.freeze([...selectedScientificUnits, ...displayedPolicyUnits])
    const allSourceCards = [...new Map(childAnswers.flatMap((answer) => answer.sources)
      .map((source) => [source.id, source])).values()]
      .sort((left, right) => left.id.localeCompare(right.id, "en"))
    const combinedSources = sourceCardsForDisplayedUnits(
      allSourceCards,
      selectedScientificUnits,
      DNA_V3_RESPONSE_DEPTH_SPEC[responseDepth].maxSources,
    )
    const combinedLimitations = Object.freeze(stableUnique(childAnswers
      .flatMap((answer) => answer.limitations)
      .filter((text) => displayedPolicyUnits.some((unit) => unit.text === text)
        || selectedScientificTexts.has(text))))
    const combinedSummary = childAnswers.map((answer, index) => `${index + 1}. ${answer.summary}`).join("\n")
    const combinedDetails = Object.freeze(childAnswers.flatMap((answer, index) =>
      answer.details
        .filter((detail) => selectedScientificTexts.has(detail))
        .map((detail) => `${index + 1}. ${detail}`)))
    const bindingErrors = validateDnaV3AnswerEvidence({
      summary: combinedSummary,
      details: combinedDetails,
      limitations: combinedLimitations,
      units: combinedUnits,
      sources: combinedSources,
      pkg,
    })
    if (bindingErrors.length) {
      return noAnswer({
        status: "not_available",
        intent,
        queryKind,
        responseDepth,
        summary: "Birleşik yanıtın claim–passage bağları doğrulanamadığı için yanıt gösterilmedi.",
      })
    }
    return Object.freeze({
      retrievalVersion: DNA_V3_RETRIEVAL_VERSION,
      engineVersion: DNA_V3_RETRIEVAL_ENGINE_VERSION,
      status: "answer",
      classification: classifications.size === 1
        ? childAnswers[0]!.classification
        : "literature",
      intent,
      queryKind,
      responseDepth,
      topic: null,
      summary: combinedSummary,
      details: combinedDetails,
      sources: combinedSources,
      limitations: combinedLimitations,
      safetyBoundary: "Bu birleşik yanıt tanı, tedavi, prognoz veya bireysel biyolojik mekanizma çıkarımı değildir.",
      suggestedQuestions: Object.freeze(stableUnique(childAnswers.flatMap((answer) => answer.suggestedQuestions))),
      evidenceSummary: null,
      answerUnits: combinedUnits,
      sections: buildSections(responseDepth, combinedUnits),
      confidenceBand: childAnswers.every((answer) => answer.confidenceBand === "high") ? "high" : "medium",
    })
  }

  const ranks = rankDnaV3RetrievalCandidates(question, pkg, {
    previousTopic,
    requiredAgeGroup: input.requiredAgeGroup,
  })
  let best = ranks[0]
  const second = ranks[1]
  if (!best || best.score < DNA_V3_RETRIEVAL_THRESHOLDS.clarification) {
    return noAnswer({
      status: "not_available",
      intent,
      queryKind,
      responseDepth,
      summary: "Bu soru için yayıma uygun, pasajla doğrulanmış V3 bilgisi bulunmuyor.",
      suggestions: ["Soruyu tek bir kavram adıyla yeniden yazın."],
    })
  }

  let relations: readonly DnaV3RetrievalRelation[] = []
  if (queryKind === "relation" || queryKind === "comparison") {
    const namedTopics = [...new Set(ranks
      .filter((rank) => rank.exactScore >= 0.82 && rank.score >= DNA_V3_RETRIEVAL_THRESHOLDS.clarification)
      .map((rank) => rank.topicId))]
    if (namedTopics.length !== 2) {
      return noAnswer({
        status: "not_available",
        intent,
        queryKind,
        responseDepth,
        summary: "İki ayrı konu güvenle belirlenemediği için aralarında ilişki veya karşılaştırma üretilmedi.",
      })
    }
    relations = eligibleOneHopRelations([namedTopics[0]!, namedTopics[1]!], pkg)
    if (!relations.length) {
      return noAnswer({
        status: "not_available",
        intent,
        queryKind,
        responseDepth,
        summary: "Bu iki konu arasında yayıma uygun, doğrudan ve tek-adımlı bir ilişki kaydı bulunmuyor.",
      })
    }
    const relationClaimIds = new Set(relations.flatMap((relation) => relation.claimIds))
    best = ranks.find((rank) => {
      const candidate = pkg.claims.find((claim) => claim.id === rank.claimId)
      return Boolean(candidate && relationClaimIds.has(candidate.sourceClaimId))
    }) ?? best
  }

  const margin = best.score - (second?.score ?? 0)
  if ((queryKind !== "relation" && queryKind !== "comparison") &&
    (best.score < DNA_V3_RETRIEVAL_THRESHOLDS.answer ||
      margin < DNA_V3_RETRIEVAL_THRESHOLDS.minimumAnswerMargin)) {
    const candidates = ranks.slice(0, 2)
      .map((rank) => pkg.claims.find((claim) => claim.id === rank.claimId)?.title)
      .filter((title): title is string => Boolean(title))
    return noAnswer({
      status: "clarification",
      intent,
      queryKind,
      responseDepth,
      topic: previousTopic,
      summary: candidates.length > 1
        ? "Sorunuz iki yakın başlıkla eşleşiyor. Hangisini kastettiğinizi seçin."
        : "Soruyu güvenle eşleştirmek için biraz daha açıklayın.",
      suggestions: candidates,
    })
  }

  const claim = pkg.claims.find((candidate) => candidate.id === best.claimId)
  if (!claim) {
    return noAnswer({ status: "not_available", intent, queryKind, responseDepth, summary: "Doğrulanmış iddia kaydı bulunamadı." })
  }
  const relationClaimIds = new Set(relations.flatMap((relation) => relation.claimIds))
  const rankedSameTopicClaims = ranks
    .map((rank) => pkg.claims.find((candidate) => candidate.id === rank.claimId))
    .filter((candidate): candidate is DnaV3RetrievalClaim => Boolean(candidate))
    .filter((candidate) => candidate.topicId === claim.topicId)
  const supportingClaims = [...new Map([
    claim,
    ...rankedSameTopicClaims,
    ...pkg.claims.filter((candidate) => relationClaimIds.has(candidate.sourceClaimId)),
  ].map((candidate) => [candidate.id, candidate])).values()]

  const scientificUnits: DnaV3AnswerUnit[] = [createDnaV3ScientificUnit({
    claim,
    text: claim.summaryTr,
    section: sectionForDnaV3ClaimType(claim.claimType),
    suffix: "summary",
  })]
  if (responseDepth !== "short") {
    for (const supportingClaim of supportingClaims) {
      if (supportingClaim.id !== claim.id) {
        scientificUnits.push(createDnaV3ScientificUnit({
          claim: supportingClaim,
          text: supportingClaim.summaryTr,
          suffix: "summary",
        }))
      }
      supportingClaim.detailsTr.forEach((detail, index) => scientificUnits.push(
        createDnaV3ScientificUnit({
          claim: supportingClaim,
          text: detail,
          suffix: `detail-${index + 1}`,
        }),
      ))
    }
    relations.slice(0, 2).forEach((relation) => {
      const relationClaim = supportingClaims.find((candidate) =>
        relation.claimIds.includes(candidate.sourceClaimId))
      if (relationClaim) {
        scientificUnits.push(createDnaV3ScientificUnit({
          claim: relationClaim,
          text: relation.summaryTr,
          section: "function_or_relation",
          suffix: relation.id,
        }))
      }
    })
  }
  const selectedScientificUnits = selectScientificUnitsForProfile(
    scientificUnits.filter((unit, index, all) =>
      all.findIndex((candidate) => candidate.text === unit.text) === index),
    responseDepth,
  )
  const usedClaimIds = new Set(selectedScientificUnits.flatMap((unit) => unit.claimIds))
  const usedClaims = supportingClaims.filter((candidate) => usedClaimIds.has(candidate.sourceClaimId))
  const cards = createDnaV3SourceCards(
    usedClaims,
    pkg,
    DNA_V3_RESPONSE_DEPTH_SPEC[responseDepth].maxSources,
  )
  if (!cards.length) {
    return noAnswer({ status: "not_available", intent, queryKind, responseDepth, summary: "İddiaya bağlı yayıma uygun kaynak kartı bulunamadı." })
  }

  const classification = queryKind === "dna_relation" || claim.dnaRelationship === "product_definition"
    ? "dna_concept"
    : "literature"
  const claimBoundaryUnit = createDnaV3ScientificUnit({
    claim,
    text: claim.claimBoundary,
    section: "boundary",
    suffix: "claim-boundary",
  })
  const dnaBoundary = dnaV3RelationshipBoundary(claim.dnaRelationship)
  const showDnaBoundary = Boolean(dnaBoundary) && (
    responseDepth !== "short" || queryKind === "dna_relation"
  )
  const policyUnits = showDnaBoundary && dnaBoundary
    ? [createDnaV3PolicyUnit({
      id: `${claim.sourceClaimId}-dna-boundary`,
      text: dnaBoundary,
      section: "dna_boundary",
    })]
    : []
  if (responseDepth === "deep") {
    const covered = new Set([
      ...selectedScientificUnits.map((unit) => unit.section),
      ...policyUnits.map((unit) => unit.section),
    ])
    for (const section of [
      "definition",
      "function_or_relation",
      "development",
      "measurement",
      "evidence_status",
      "counter_evidence",
      "dna_boundary",
    ] as const) {
      if (!covered.has(section)) {
        policyUnits.push(createDnaV3PolicyUnit({
          id: `${claim.sourceClaimId}-${section}-unavailable`,
          text: `${SECTION_TITLES[section]} için yayıma uygun, pasajla doğrulanmış ayrı bir iddia bulunmadığından bu bölüm içerik üretilmeden bırakıldı.`,
          section,
        }))
      }
    }
    policyUnits.push(createDnaV3PolicyUnit({
      id: `${claim.sourceClaimId}-case-context-unbound`,
      text: "Bu yanıta bir vaka raporu bağlanmadı; içerik yalnız genel bilgi ve literatür bağlamındadır.",
      section: "case_context",
    }))
  }
  const summary = selectedScientificUnits[0]!.text
  const details = selectedScientificUnits.slice(1).map((unit) => unit.text)
  // A short DNA-relation answer must state the relationship status instead of
  // spending its single visible boundary on a broader claim limitation.
  const boundaryUnits = responseDepth === "short" && queryKind === "dna_relation" && policyUnits.length
    ? policyUnits
    : [claimBoundaryUnit, ...policyUnits]
  const limitations = boundaryUnits.map((unit) => unit.text)
  const answerUnits = Object.freeze([
    ...selectedScientificUnits,
    ...boundaryUnits,
  ])
  if (!finalClaimGuard([summary, ...details, ...limitations])) {
    return noAnswer({
      status: "not_available",
      intent,
      queryKind,
      responseDepth,
      summary: "Eşleşen kayıt nihai klinik iddia güvenlik kontrolünü geçmediği için gösterilmedi.",
    })
  }

  const bindingErrors = validateDnaV3AnswerEvidence({
    summary,
    details,
    limitations,
    units: answerUnits,
    sources: cards,
    pkg,
  })
  if (bindingErrors.length) {
    return noAnswer({
      status: "not_available",
      intent,
      queryKind,
      responseDepth,
      summary: "Eşleşen yanıtın claim–passage ve kaynak kartı bağları eksiksiz doğrulanamadığı için gösterilmedi.",
    })
  }

  return Object.freeze({
    retrievalVersion: DNA_V3_RETRIEVAL_VERSION,
    engineVersion: DNA_V3_RETRIEVAL_ENGINE_VERSION,
    status: "answer",
    classification,
    intent,
    queryKind,
    responseDepth,
    topic: claim.topicId,
    summary,
    details: Object.freeze(details),
    sources: cards,
    limitations: Object.freeze(limitations),
    safetyBoundary: "Bu bilgi tanı, tedavi, prognoz veya bireysel biyolojik mekanizma çıkarımı değildir.",
    suggestedQuestions: Object.freeze([
      `${claim.title} için kanıt sınırı nedir?`,
      `${claim.title} nasıl ölçülür?`,
    ]),
    evidenceSummary: Object.freeze({
      level: claim.evidenceLevel,
      ageScope: claim.ageScope,
      boundary: claim.claimBoundary,
      dnaValidationStatus: claim.dnaRelationship,
    }),
    answerUnits,
    sections: buildSections(responseDepth, answerUnits),
    confidenceBand: "high",
  })
}
