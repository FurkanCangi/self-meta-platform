import ownerBookManifestJson from "./catalog/generated/owner-book/manifest.json"
import ownerBookRuntimeJson from "./catalog/generated/owner-book/runtime.json"
import denseKnowledgeRuntimeJson from "./catalog/generated/dense/runtime.json"
import { normalizeDnaChatText, tokenizeDnaChatText } from "./text"

export const DNA_OWNER_BOOK_RUNTIME_VERSION = "dna-owner-book-retrieval@1" as const
export const DNA_OWNER_BOOK_SOURCE_ID = "book.self-regulation.owner-current" as const

type OwnerBookNode = Readonly<{
  id: string
  order: number
  kind: "heading" | "paragraph" | "table"
  headingLevel: number | null
  headingPath: readonly string[]
  sectionId: string
  text: string
  sentences: readonly string[]
  tokens: readonly string[]
  headingTokens: readonly string[]
}>

type OwnerBookRuntimePackage = Readonly<{
  schemaVersion: "dna-owner-book-runtime@1"
  pipelineVersion: string
  source: Readonly<{
    id: typeof DNA_OWNER_BOOK_SOURCE_ID
    title: string
    author: string
    year: number
    fileName: string
    sha256: string
    modifiedAt: string | null
    selectedByOwner: true
    citationStatus: "pending_sentence_mapping"
    legacyChapterFilesIncluded: readonly []
  }>
  content: Readonly<{
    bodyTextSha256: string
    referenceTextSha256: string
    nodesSha256: string
  }>
  counts: Readonly<{
    nodes: number
    headings: number
    paragraphs: number
    tables: number
    sentences: number
    sentencesWithoutInlineCitation: number
    sentencesWithInlineCitation: number
    citationPendingSentences: number
    references: number
  }>
  runtimePolicy: Readonly<{
    externalLlm: false
    runtimeInternet: false
    embedding: false
    vectorDatabase: false
    safetyGateRequired: true
    citationMappingPending: true
  }>
  nodes: readonly OwnerBookNode[]
}>

type OwnerBookManifest = Readonly<{
  schemaVersion: "dna-owner-book-runtime-manifest@1"
  source: OwnerBookRuntimePackage["source"]
  counts: OwnerBookRuntimePackage["counts"]
  runtimeSha256: string
  runtimeBytes: number
}>

type DenseOwnerBookUnit = Readonly<{
  id: string
  claimId: string
  passageId: string
  sourceId: typeof DNA_OWNER_BOOK_SOURCE_ID
  sentenceSha256: string
  text: string
  title: string
  topicId: string
  domain: string
  dimensions: readonly string[]
  focus: string
}>

type DenseOwnerBookRuntime = Readonly<{
  schemaVersion: "dna-dense-knowledge-runtime@1"
  pipelineVersion: string
  source: OwnerBookRuntimePackage["source"] & Readonly<{
    approvalStatus: "owner_approved_for_chat_use"
    scientificValidationStatus: "not_established_by_owner_approval"
  }>
  counts: Readonly<{
    ownerUnits: number
    externalCandidatesPreserved: number
    externalUnitsLive: number
  }>
  units: readonly DenseOwnerBookUnit[]
}>

export type DnaOwnerBookMatch = Readonly<{
  retrievalVersion: typeof DNA_OWNER_BOOK_RUNTIME_VERSION
  sourceId: typeof DNA_OWNER_BOOK_SOURCE_ID
  sourceTitle: string
  sourceAuthor: string
  sourceYear: number
  sourceSha256: string
  citationStatus: "pending_sentence_mapping"
  topic: string
  topicId: string
  topicIds: readonly string[]
  summary: string
  details: readonly string[]
  claimIds: readonly string[]
  passageIds: readonly string[]
  excerpt: string
  score: number
  headingCoverage: number
  leafHeadingCoverage: number
}>

type IndexedNode = Readonly<{
  node: OwnerBookNode
  units: readonly DenseOwnerBookUnit[]
  tokenSet: ReadonlySet<string>
  headingTokenSet: ReadonlySet<string>
  normalizedText: string
}>

type ScoredNode = Readonly<{
  indexed: IndexedNode
  score: number
  coverage: number
  matchedTokens: readonly string[]
}>

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const OWNER_BOOK_TOPIC_PREFIX = "owner-book-section/"
const GENERIC_QUERY_TOKENS = new Set([
  "acik",
  "acikla",
  "aciklar",
  "acisindan",
  "anlat",
  "anlatiliyor",
  "anlatir",
  "arasinda",
  "arasindaki",
  "ayrinti",
  "baglanti",
  "bicimde",
  "bilgi",
  "detay",
  "demek",
  "fark",
  "farkli",
  "genel",
  "gore",
  "gosterir",
  "ifade",
  "ifadesi",
  "ifadesini",
  "ifadesinin",
  "anlama",
  "anlamaliyim",
  "anliyorum",
  "aciklaniyor",
  "aciklanir",
  "cumle",
  "cumleyi",
  "anlayamadim",
  "kitaptaki",
  "bilgisini",
  "kismi",
  "nokta",
  "noktasi",
  "process",
  "iliski",
  "ise",
  "kapsamli",
  "kitab",
  "kitaba",
  "kitap",
  "kisaca",
  "konusunda",
  "konu",
  "misin",
  "nedemek",
  "neler",
  "ayni",
  "sey",
  "soru",
  "sade",
  "temel",
  "tam",
  "ver",
  "verir",
  "yarar",
  "yeniden",
])
const QUERY_EXPANSIONS = Object.freeze([
  ["self regulation", "self regülasyon öz düzenleme"],
  ["oz duzenleme", "self regülasyon"],
  ["coregulation", "ko regülasyon"],
  ["co regulation", "ko regülasyon"],
  ["effortful control", "çabalı kontrol"],
  ["social buffering", "sosyal tamponlama"],
  ["private speech", "özel konuşma"],
  ["predictive processing", "öngörücü işlemleme"],
  ["active inference", "aktif çıkarım"],
  ["executive function", "yürütücü işlev"],
  ["working memory", "çalışma belleği"],
  ["prospective memory", "prospektif bellek"],
  ["inhibitory control", "inhibitör kontrol"],
  ["inhibitor control", "inhibisyon"],
  ["inhibitor kontrol", "inhibisyon"],
  ["cognitive flexibility", "bilişsel esneklik"],
  ["sensory modulation", "duyusal modülasyon"],
  ["sensory registration", "duyusal kayıt"],
  ["sensory discrimination", "duyusal ayırt etme"],
  ["sensory integration", "duyusal bütünleme"],
  ["adaptive response", "adaptif yanıt"],
  ["top down modulation", "yukarıdan aşağıya modülasyon"],
  ["multisensory integration", "multisensoryal bütünleme"],
  ["emotion regulation", "duygu düzenleme"],
  ["interoception", "interosepsiyon"],
  ["uyarilmislik", "arousal"],
  ["recovery", "toparlanma"],
  ["autonomic nervous system", "otonom sinir sistemi"],
  ["central autonomic network", "merkezi otonom ağ"],
  ["hypothalamic pituitary adrenal axis", "hipotalamus hipofiz adrenal ekseni hpa"],
  ["default mode network", "varsayılan mod ağı default mode network"],
  ["dorsal attention network", "dorsal dikkat ağı"],
  ["belirginlik agi", "salience ağı"],
  ["hrv", "kalp hızı değişkenliği"],
  ["rsa", "respiratuvar sinüs aritmisi"],
  ["hpa", "hipotalamus hipofiz adrenal ekseni"],
  ["nts", "nucleus tractus solitarius"],
  ["polyvagal", "polyvagal teori"],
] as const)

const GENERIC_SECTION_TITLES = new Set([
  "teorinin temel cercevesi",
  "temel norofizyoloji",
  "genel cerceve",
  "genel degerlendirme",
  "guclu yonleri",
  "sinirliliklari",
  "gunluk yasam ornegi",
  "klinik ornek",
  "bilissel katman",
  "duygusal katman",
  "duyusal katman",
  "fizyolojik katman",
  "ergoterapi acisindan sonuc",
  "pediatrik ergoterapi acisindan sonuc",
])

const runtimePackage = ownerBookRuntimeJson as unknown as OwnerBookRuntimePackage
const runtimeManifest = ownerBookManifestJson as unknown as OwnerBookManifest
const denseRuntime = denseKnowledgeRuntimeJson as unknown as DenseOwnerBookRuntime

function validatePackage(): OwnerBookRuntimePackage {
  if (runtimePackage.schemaVersion !== "dna-owner-book-runtime@1"
    || runtimeManifest.schemaVersion !== "dna-owner-book-runtime-manifest@1"
    || runtimePackage.source.id !== DNA_OWNER_BOOK_SOURCE_ID
    || runtimePackage.source.sha256 !== runtimeManifest.source.sha256
    || !SHA256_PATTERN.test(runtimePackage.source.sha256)
    || !SHA256_PATTERN.test(runtimeManifest.runtimeSha256)
    || runtimePackage.source.selectedByOwner !== true
    || runtimePackage.source.citationStatus !== "pending_sentence_mapping"
    || runtimePackage.source.legacyChapterFilesIncluded.length !== 0
    || runtimePackage.runtimePolicy.externalLlm !== false
    || runtimePackage.runtimePolicy.runtimeInternet !== false
    || runtimePackage.runtimePolicy.safetyGateRequired !== true
    || runtimePackage.nodes.length !== runtimePackage.counts.nodes
    || runtimePackage.counts.citationPendingSentences !== runtimePackage.counts.sentences
    || runtimePackage.nodes.some((node) => !node.id || !node.text || node.order < 1)) {
    throw new Error("dna_owner_book_runtime_package_invalid")
  }
  return runtimePackage
}

const BOOK = validatePackage()
const BOOK_NODE_IDS = new Set(BOOK.nodes.map((node) => node.id))

function validateDenseRuntime(): DenseOwnerBookRuntime {
  if (denseRuntime.schemaVersion !== "dna-dense-knowledge-runtime@1"
    || denseRuntime.source.id !== DNA_OWNER_BOOK_SOURCE_ID
    || denseRuntime.source.sha256 !== BOOK.source.sha256
    || denseRuntime.source.approvalStatus !== "owner_approved_for_chat_use"
    || denseRuntime.source.scientificValidationStatus !== "not_established_by_owner_approval"
    || denseRuntime.counts.ownerUnits !== denseRuntime.units.length
    || denseRuntime.counts.externalCandidatesPreserved !== 1_000
    || denseRuntime.counts.externalUnitsLive !== 0
    || denseRuntime.units.some((unit) =>
      !unit.id
      || unit.id !== unit.claimId
      || unit.sourceId !== DNA_OWNER_BOOK_SOURCE_ID
      || !unit.passageId
      || !unit.text
      || !SHA256_PATTERN.test(unit.sentenceSha256)
      || !unit.topicId.startsWith(OWNER_BOOK_TOPIC_PREFIX)
      || !BOOK_NODE_IDS.has(unit.passageId.split(":sentence:")[0] ?? ""))) {
    throw new Error("dna_owner_book_dense_runtime_invalid")
  }
  return denseRuntime
}

const DENSE_BOOK = validateDenseRuntime()
const DENSE_UNITS_BY_NODE_ID = new Map<string, DenseOwnerBookUnit[]>()
for (const unit of DENSE_BOOK.units) {
  const nodeId = unit.passageId.split(":sentence:")[0]!
  const rows = DENSE_UNITS_BY_NODE_ID.get(nodeId) ?? []
  rows.push(unit)
  DENSE_UNITS_BY_NODE_ID.set(nodeId, rows)
}
const SEARCHABLE_NODES: readonly IndexedNode[] = Object.freeze(BOOK.nodes
  .filter((node) => node.kind !== "heading" && DENSE_UNITS_BY_NODE_ID.has(node.id))
  .map((node) => {
    const units = Object.freeze([...(DENSE_UNITS_BY_NODE_ID.get(node.id) ?? [])])
    const unitText = units.map((unit) => unit.text).join(" ")
    return Object.freeze({
    node,
    units,
    tokenSet: new Set(tokenizeDnaChatText(unitText)),
    headingTokenSet: new Set(node.headingTokens),
    normalizedText: normalizeDnaChatText(unitText),
  })}))
const NODE_BY_ID = new Map(BOOK.nodes.map((node) => [node.id, node]))
const SECTION_NODES = new Map<string, IndexedNode[]>()
const DOCUMENT_FREQUENCY = new Map<string, number>()
const TOKEN_POSTINGS = new Map<string, IndexedNode[]>()
const EQUIVALENT_TOKEN_CACHE = new Map<string, readonly string[]>()
const VOCABULARY_BY_FIRST_AND_LENGTH = new Map<string, string[]>()

for (const indexed of SEARCHABLE_NODES) {
  const rows = SECTION_NODES.get(indexed.node.sectionId) ?? []
  rows.push(indexed)
  SECTION_NODES.set(indexed.node.sectionId, rows)
  for (const token of new Set([...indexed.tokenSet, ...indexed.headingTokenSet])) {
    DOCUMENT_FREQUENCY.set(token, (DOCUMENT_FREQUENCY.get(token) ?? 0) + 1)
    const postings = TOKEN_POSTINGS.get(token) ?? []
    postings.push(indexed)
    TOKEN_POSTINGS.set(token, postings)
  }
}
for (const token of TOKEN_POSTINGS.keys()) {
  const key = `${token[0] ?? ""}:${token.length}`
  const values = VOCABULARY_BY_FIRST_AND_LENGTH.get(key) ?? []
  values.push(token)
  VOCABULARY_BY_FIRST_AND_LENGTH.set(key, values)
}

function tokensEquivalent(left: string, right: string): boolean {
  if (left === right) return true
  const shortest = Math.min(left.length, right.length)
  if (shortest >= 6 && (left.startsWith(right) || right.startsWith(left))) return true
  if (left.length === right.length && left.length >= 6) {
    const mismatches: number[] = []
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) mismatches.push(index)
    }
    if (
      mismatches.length === 2 &&
      mismatches[1] === mismatches[0] + 1 &&
      left[mismatches[0]] === right[mismatches[1]] &&
      left[mismatches[1]] === right[mismatches[0]]
    ) return true
  }
  if (shortest < 5 || Math.abs(left.length - right.length) > 1) return false
  let leftIndex = 0
  let rightIndex = 0
  let edits = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1
      rightIndex += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (left.length > right.length) leftIndex += 1
    else if (right.length > left.length) rightIndex += 1
    else {
      leftIndex += 1
      rightIndex += 1
    }
  }
  return edits + Number(leftIndex < left.length || rightIndex < right.length) <= 1
}

function setHasEquivalent(values: ReadonlySet<string>, token: string): boolean {
  if (values.has(token)) return true
  return [...values].some((candidate) => tokensEquivalent(candidate, token))
}

function equivalentVocabularyTokens(token: string): readonly string[] {
  const cached = EQUIVALENT_TOKEN_CACHE.get(token)
  if (cached) return cached
  if (TOKEN_POSTINGS.has(token)) {
    const exact = Object.freeze([token])
    EQUIVALENT_TOKEN_CACHE.set(token, exact)
    return exact
  }
  const candidates = [-1, 0, 1].flatMap((offset) =>
    VOCABULARY_BY_FIRST_AND_LENGTH.get(`${token[0] ?? ""}:${token.length + offset}`) ?? [])
  const values = Object.freeze(candidates.filter((candidate) => tokensEquivalent(candidate, token)))
  EQUIVALENT_TOKEN_CACHE.set(token, values)
  return values
}

function documentFrequency(token: string): number {
  const exact = DOCUMENT_FREQUENCY.get(token)
  if (exact !== undefined) return exact
  return equivalentVocabularyTokens(token).reduce(
    (sum, candidate) => sum + (DOCUMENT_FREQUENCY.get(candidate) ?? 0),
    0,
  )
}

function inverseDocumentFrequency(token: string): number {
  const frequency = documentFrequency(token)
  return Math.log(1 + ((SEARCHABLE_NODES.length - frequency + 0.5) / (frequency + 0.5)))
}

function expandedQuestion(question: string): string {
  const outputTokens = normalizeDnaChatText(question).split(" ").filter(Boolean)
  for (const [pattern, addition] of QUERY_EXPANSIONS) {
    const patternTokens = normalizeDnaChatText(pattern).split(" ").filter(Boolean)
    if (!patternTokens.length || patternTokens.length > outputTokens.length) continue
    for (let index = 0; index <= outputTokens.length - patternTokens.length; index += 1) {
      const window = outputTokens.slice(index, index + patternTokens.length)
      if (!window.every((token, tokenIndex) => tokensEquivalent(token, patternTokens[tokenIndex]))) continue
      outputTokens.splice(
        index,
        patternTokens.length,
        ...normalizeDnaChatText(addition).split(" ").filter(Boolean),
      )
      break
    }
  }
  return outputTokens.join(" ")
}

function isGenericQueryToken(token: string): boolean {
  return GENERIC_QUERY_TOKENS.has(token) ||
    /^(?:acikla|anlat|detaylandir|ayrintilandir|bahset|soyle|verir|ogren|tanit|ilisk|karsilastir|fark)\w*$/.test(token)
}

function queryTokens(question: string, topicHeading?: string | null): string[] {
  const tokens = tokenizeDnaChatText(expandedQuestion(question))
    .filter((token) => !isGenericQueryToken(token))
  const topicalTokens = topicHeading ? tokenizeDnaChatText(topicHeading) : []
  return [...new Set([...tokens, ...topicalTokens])].slice(0, 18)
}

function topicIdForSection(sectionId: string): string {
  return `${OWNER_BOOK_TOPIC_PREFIX}${sectionId}`
}

function sectionIdFromTopicId(topicId: string | null | undefined): string | null {
  if (!topicId?.startsWith(OWNER_BOOK_TOPIC_PREFIX)) return null
  const sectionId = topicId.slice(OWNER_BOOK_TOPIC_PREFIX.length)
  return SECTION_NODES.has(sectionId) ? sectionId : null
}

function topicHeading(sectionId: string): string | null {
  return NODE_BY_ID.get(sectionId)?.text ?? null
}

function displayTopicForNode(node: OwnerBookNode): string {
  const path = node.headingPath.filter(Boolean)
  const leaf = path.at(-1) ?? "Self-Regülasyon Kitabı"
  if (path.length < 2) return leaf
  const parent = path.at(-2) ?? ""
  return GENERIC_SECTION_TITLES.has(normalizeDnaChatText(leaf)) || parent !== leaf
    ? `${parent} · ${leaf}`
    : leaf
}

function candidateNodes(tokens: readonly string[], sectionId: string | null): readonly IndexedNode[] {
  const values = new Map<string, IndexedNode>()
  for (const token of tokens) {
    for (const equivalent of equivalentVocabularyTokens(token)) {
      for (const indexed of TOKEN_POSTINGS.get(equivalent) ?? []) {
        if (!sectionId || indexed.node.sectionId === sectionId) {
          values.set(indexed.node.id, indexed)
        }
      }
    }
  }
  return [...values.values()]
}

function quotedQuestionAnchor(question: string): string | null {
  const match = String(question || "").match(/[“"]([^”"]{24,})[”"]/u)
  if (!match?.[1]) return null
  const anchor = normalizeDnaChatText(match[1]).trim()
  return anchor.split(" ").length >= 5 ? anchor : null
}

function isFollowUpQuestion(question: string): boolean {
  const normalized = normalizeDnaChatText(question)
  return /^(?:bunu|biraz daha|ikisi|bunun|bu bilgi|onceki cevap)\b/.test(normalized)
    || /^daha\s+(?:detayli|ayrintili|basit|sade|anlasilir|fazla ac)\b/.test(normalized)
    || /^(?:peki|ya)\s+(?:bu|bunun|cocuklarda|ergenlerde|yetiskinlerde|kaniti|olcumu|siniri|kaynaklari)\b/.test(normalized)
    || /^(?:cocuklarda|ergenlerde|yetiskinlerde|kaniti|olcumu|siniri|kaynaklari|neyi|ne zaman|neden)\b/.test(normalized)
}

function scoreNode(indexed: IndexedNode, tokens: readonly string[], question: string): ScoredNode {
  const matchedTokens = tokens.filter((token) =>
    setHasEquivalent(indexed.tokenSet, token) || setHasEquivalent(indexed.headingTokenSet, token))
  const headingMatches = tokens.filter((token) => setHasEquivalent(indexed.headingTokenSet, token))
  const leafHeadingTokens = new Set(tokenizeDnaChatText(indexed.node.headingPath.at(-1) ?? ""))
  const leafHeadingMatches = tokens.filter((token) => setHasEquivalent(leafHeadingTokens, token))
  const tokenWeight = matchedTokens.reduce((sum, token) => sum + inverseDocumentFrequency(token), 0)
  const headingWeight = headingMatches.reduce(
    (sum, token) => sum + inverseDocumentFrequency(token) * 1.65,
    0,
  )
  const leafHeadingWeight = leafHeadingMatches.reduce(
    (sum, token) => sum + inverseDocumentFrequency(token) * 2.35,
    0,
  )
  const coverage = tokens.length ? matchedTokens.length / tokens.length : 0
  const completeCoverageBonus = coverage === 1 && tokens.length > 1 ? 12 : 0
  const atomicCompleteCoverage = tokens.length > 1 && indexed.units.some((unit) => {
    const unitTokens = new Set(tokenizeDnaChatText(unit.text))
    return tokens.every((token) => setHasEquivalent(unitTokens, token))
  })
  // Prefer a single accepted claim that contains the whole query over a score
  // assembled from one token in a heading and another in an unrelated claim.
  const atomicClaimBonus = atomicCompleteCoverage ? 24 : 0
  const normalizedQuestion = normalizeDnaChatText(question)
  const quotedAnchor = quotedQuestionAnchor(question)
  const contentPhrase = tokens.slice(0, 4).join(" ")
  const normalizedHeadingPath = normalizeDnaChatText(indexed.node.headingPath.join(" "))
  const normalizedLeafHeading = normalizeDnaChatText(indexed.node.headingPath.at(-1) ?? "")
  const headingPhraseBonus = contentPhrase.length >= 4 && normalizedHeadingPath.includes(contentPhrase)
    ? 7
    : headingMatches.length === tokens.length && tokens.length > 0
      ? 3
      : 0
  const leafPhraseBonus = contentPhrase.length >= 4 && normalizedLeafHeading.includes(contentPhrase)
    ? 10
    : leafHeadingMatches.length === tokens.length && tokens.length > 0
      ? 5
      : 0
  const phraseBonus = contentPhrase.length >= 8 && indexed.normalizedText.includes(contentPhrase)
    ? 4
    : normalizedQuestion.length >= 8 && indexed.normalizedText.includes(normalizedQuestion)
      ? 5
      : 0
  return Object.freeze({
    indexed,
    score: Number((tokenWeight + headingWeight + leafHeadingWeight + coverage * 4 + completeCoverageBonus + atomicClaimBonus + phraseBonus + headingPhraseBonus + leafPhraseBonus +
      (quotedAnchor && indexed.normalizedText.includes(quotedAnchor) ? 80 : 0)).toFixed(6)),
    coverage: Number(coverage.toFixed(6)),
    matchedTokens: Object.freeze(matchedTokens),
  })
}

function displaySentence(value: string): string {
  return value
    .replace(/\s*\([^)]*\b(?:19|20)\d{2}[a-z]?[^)]*\)/giu, "")
    .replace(/\s*\[[^\]]*\b(?:19|20)\d{2}[a-z]?[^\]]*\]/giu, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

function matchedDisplayPhrase(sentence: string, tokens: readonly string[]): string | null {
  if (!tokens.length || tokens.length > 4) return null
  const words = sentence.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) ?? []
  const normalizedWords = words.map((word) => normalizeDnaChatText(word))
  for (let index = 0; index <= normalizedWords.length - tokens.length; index += 1) {
    if (tokens.every((token, offset) => tokensEquivalent(token, normalizedWords[index + offset]!))) {
      return words.slice(index, index + tokens.length).join(" ")
    }
  }
  return null
}

function sentenceScore(
  sentence: string,
  node: ScoredNode,
  tokens: readonly string[],
  sentenceIndex: number,
): number {
  const sentenceTokens = new Set(tokenizeDnaChatText(sentence))
  const matched = tokens.filter((token) => setHasEquivalent(sentenceTokens, token))
  const direct = matched.reduce((sum, token) => sum + inverseDocumentFrequency(token), 0)
  const definitionBonus = /\b(?:olarak|ifade eder|tanımlanır|tanımlanabilir|anlamına gelir|adı verilir)\b/iu.test(sentence)
    ? 1.2
    : 0
  return direct * 2 + node.score * 0.16 + definitionBonus - sentenceIndex * 0.015
}

function desiredSentenceCount(
  question: string,
  responseDepth: "short" | "standard" | "deep" = "standard",
): number {
  const normalized = normalizeDnaChatText(question)
  if (/\b(?:kisaca|tek cumle|ozetle|daha basit|daha sade|sade bicimde)\b/.test(normalized)) return 2
  if (/\b(?:detayli|ayrintili|kapsamli|biraz ac|daha ac)\b/.test(normalized)) return 6
  return responseDepth === "short" ? 2 : responseDepth === "deep" ? 6 : 4
}

function safeExcerpt(value: string): string {
  const clean = displaySentence(value)
  return clean.length <= 320 ? clean : `${clean.slice(0, 317).trimEnd()}...`
}

const BOUND_DISPLAY_SENTENCES = new Set(DENSE_BOOK.units
  .map((unit) => displaySentence(unit.text)).filter(Boolean))

export function isDnaOwnerBookTopicId(value: string | null | undefined): boolean {
  return sectionIdFromTopicId(value) !== null
}

export function getDnaOwnerBookTopicTitle(value: string | null | undefined): string | null {
  const sectionId = sectionIdFromTopicId(value)
  const node = sectionId ? NODE_BY_ID.get(sectionId) : null
  return node ? displayTopicForNode(node) : null
}

export function hasDnaOwnerBookSourceId(sourceId: string): boolean {
  return sourceId === DNA_OWNER_BOOK_SOURCE_ID
}

export function isDnaOwnerBookOutputTextBound(value: string): boolean {
  return BOUND_DISPLAY_SENTENCES.has(String(value || "").trim())
}

export function getDnaOwnerBookRuntimeStatus() {
  return Object.freeze({
    retrievalVersion: DNA_OWNER_BOOK_RUNTIME_VERSION,
    sourceId: BOOK.source.id,
    sourceSha256: BOOK.source.sha256,
    citationStatus: BOOK.source.citationStatus,
    counts: Object.freeze({ ...BOOK.counts }),
    atomicKnowledgeUnits: DENSE_BOOK.counts.ownerUnits,
    externalCandidatesPreserved: DENSE_BOOK.counts.externalCandidatesPreserved,
    externalUnitsLive: DENSE_BOOK.counts.externalUnitsLive,
    legacyChapterFilesIncluded: Object.freeze([...BOOK.source.legacyChapterFilesIncluded]),
  })
}

export function resolveDnaOwnerBook(
  question: string,
  conversationTopicIds: readonly string[] = [],
  responseDepth: "short" | "standard" | "deep" = "standard",
): DnaOwnerBookMatch | null {
  const normalizedQuestion = normalizeDnaChatText(question)
  const previousSectionId = conversationTopicIds
    .map(sectionIdFromTopicId)
    .find((value): value is string => Boolean(value)) ?? null
  if (!previousSectionId && /^(?:erken cocukluk|cocukluk|cocuklar|ergenler|yetiskinler) icin ne degis\w*/.test(
    normalizedQuestion,
  )) return null
  const followUp = isFollowUpQuestion(question)
  if (followUp && !previousSectionId) return null
  const usePreviousSection = Boolean(previousSectionId && followUp)
  const previousHeading = usePreviousSection && previousSectionId
    ? topicHeading(previousSectionId)
    : null
  const tokens = queryTokens(question, previousHeading)
  if (!tokens.length) return null

  const quotedAnchor = quotedQuestionAnchor(question)
  const exactAnchorCandidates = quotedAnchor
    ? SEARCHABLE_NODES.filter((indexed) =>
        (!usePreviousSection || indexed.node.sectionId === previousSectionId) &&
        indexed.normalizedText.includes(quotedAnchor))
    : []
  const candidates = exactAnchorCandidates.length
    ? exactAnchorCandidates
    : candidateNodes(tokens, usePreviousSection ? previousSectionId : null)
  const scored = candidates
    .map((indexed) => scoreNode(indexed, tokens, question))
    .filter((row) => row.matchedTokens.length > 0)
    .sort((left, right) =>
      right.score - left.score ||
      right.coverage - left.coverage ||
      left.indexed.node.order - right.indexed.node.order)
  const best = scored[0]
  if (!best) return null

  const distinctiveMatches = best.matchedTokens.filter((token) =>
    token.length >= 5 && documentFrequency(token) <= 90)
  const minimumCoverage = tokens.length <= 2 ? 0.9 : 0.5
  if (best.coverage < minimumCoverage || (!distinctiveMatches.length && best.score < 8.5)) {
    return null
  }

  const requestedSentenceCount = desiredSentenceCount(question, responseDepth)
  const deepAnswer = requestedSentenceCount >= 6
  const comparisonRequest = /\b(?:fark\w*|karsilastir\w*|ayni\s+sey)\b/.test(
    normalizedQuestion,
  )
  const relationRequest = /\bilisk\w*\b/.test(normalizedQuestion) && !comparisonRequest
  if (relationRequest && best.coverage < 0.85) return null
  const sectionLeaders = [...new Map(scored.map((row) => [row.indexed.node.sectionId, row])).values()]
  const selectedSectionLeaders: ScoredNode[] = [best]
  if (comparisonRequest && best.coverage < 0.85) {
    const bestMatched = new Set(best.matchedTokens)
    const complementary = sectionLeaders.find((row) =>
      row.indexed.node.sectionId !== best.indexed.node.sectionId &&
      row.score >= best.score * 0.32 &&
      row.coverage >= 0.25 &&
      row.matchedTokens.some((token) => !bestMatched.has(token)))
    if (complementary) selectedSectionLeaders.push(complementary)
  }
  const selectedSectionIds = new Set(selectedSectionLeaders.map((row) => row.indexed.node.sectionId))
  const sectionLeaderScores = new Map(selectedSectionLeaders.map((row) => [
    row.indexed.node.sectionId,
    row.score,
  ]))
  const topNodes = scored
    .filter((row) => {
      if (comparisonRequest) {
        const leaderScore = sectionLeaderScores.get(row.indexed.node.sectionId)
        return selectedSectionIds.has(row.indexed.node.sectionId) &&
          row.score >= (leaderScore ?? best.score) * 0.28 &&
          row.coverage >= 0.2
      }
      return (deepAnswer || row.indexed.node.sectionId === best.indexed.node.sectionId) &&
        row.score >= best.score * (deepAnswer ? 0.48 : 0.3) &&
        row.coverage >= Math.min(best.coverage, deepAnswer ? 0.34 : 0.25)
    })
    .slice(0, deepAnswer ? 12 : 8)
  const sentenceCandidates = topNodes.flatMap((row) => row.indexed.units
    .map((unit, unitIndex) => ({
      sentence: displaySentence(unit.text),
      unit,
      unitIndex,
      row,
      score: sentenceScore(unit.text, row, tokens, unitIndex),
    })))
    .filter((candidate) => candidate.sentence.length >= 24)
    .sort((left, right) =>
      right.score - left.score ||
      left.row.indexed.node.order - right.row.indexed.node.order ||
      left.unitIndex - right.unitIndex)
  const alternateAnswer = /\b(?:baska turlu|farkli bicimde|farkli anlat|yeniden anlat|tekrar acikla)\b/.test(
    normalizedQuestion,
  )
  const orderedSentenceCandidates = alternateAnswer && sentenceCandidates.length > 1
    ? [...sentenceCandidates.slice(1), sentenceCandidates[0]]
    : sentenceCandidates

  const selected: typeof sentenceCandidates = []
  const seen = new Set<string>()
  const bestHeadingCoverage = tokens.length
    ? tokens.filter((token) => setHasEquivalent(best.indexed.headingTokenSet, token)).length / tokens.length
    : 0
  const bestLeafHeadingTokens = new Set(tokenizeDnaChatText(best.indexed.node.headingPath.at(-1) ?? ""))
  const bestLeafHeadingCoverage = tokens.length
    ? tokens.filter((token) => setHasEquivalent(bestLeafHeadingTokens, token)).length / tokens.length
    : 0
  const canSelect = (candidate: (typeof sentenceCandidates)[number]): boolean => {
    const normalized = normalizeDnaChatText(candidate.sentence)
    if (!normalized || seen.has(normalized)) return false
    const sentenceTokens = new Set(tokenizeDnaChatText(candidate.sentence))
    const sentenceHasQueryToken = tokens.some((token) => setHasEquivalent(sentenceTokens, token))
    const sentenceBelongsToStrongHeading = candidate.row.indexed.node.sectionId === best.indexed.node.sectionId &&
      bestHeadingCoverage >= 0.7
    return sentenceHasQueryToken || sentenceBelongsToStrongHeading ||
      selectedSectionIds.has(candidate.row.indexed.node.sectionId)
  }
  const addCandidate = (candidate: (typeof sentenceCandidates)[number]) => {
    selected.push(candidate)
    seen.add(normalizeDnaChatText(candidate.sentence))
  }
  if (selectedSectionLeaders.length > 1) {
    for (const leader of selectedSectionLeaders) {
      const candidate = orderedSentenceCandidates.find((row) =>
        row.row.indexed.node.sectionId === leader.indexed.node.sectionId && canSelect(row))
      if (candidate) addCandidate(candidate)
    }
  }
  for (const candidate of orderedSentenceCandidates) {
    if (selected.length >= requestedSentenceCount) break
    if (!canSelect(candidate)) continue
    addCandidate(candidate)
  }
  if (!selected.length) return null

  const bestNode = best.indexed.node
  const topicLabels = selectedSectionLeaders.map((row) => displayTopicForNode(row.indexed.node))
  const topicIds = selectedSectionLeaders.map((row) => topicIdForSection(row.indexed.node.sectionId))
  const directMatchedTopic = selectedSectionLeaders.length === 1 && bestLeafHeadingCoverage < 0.5
    ? selected.map((candidate) => matchedDisplayPhrase(candidate.sentence, tokens))
      .find((value): value is string => Boolean(value)) ?? null
    : null
  const topic = directMatchedTopic ?? [...new Set(topicLabels)].join(" · ")
  return Object.freeze({
    retrievalVersion: DNA_OWNER_BOOK_RUNTIME_VERSION,
    sourceId: BOOK.source.id,
    sourceTitle: BOOK.source.title,
    sourceAuthor: BOOK.source.author,
    sourceYear: BOOK.source.year,
    sourceSha256: BOOK.source.sha256,
    citationStatus: BOOK.source.citationStatus,
    topic,
    topicId: topicIdForSection(bestNode.sectionId),
    topicIds: Object.freeze(topicIds),
    summary: selected[0].sentence,
    details: Object.freeze(selected.slice(1).map((candidate) => candidate.sentence)),
    claimIds: Object.freeze(selected.map((candidate) => candidate.unit.claimId)),
    passageIds: Object.freeze(selected.map((candidate) => candidate.unit.passageId)),
    excerpt: safeExcerpt(bestNode.text),
    score: best.score,
    headingCoverage: Number(bestHeadingCoverage.toFixed(6)),
    leafHeadingCoverage: Number(bestLeafHeadingCoverage.toFixed(6)),
  })
}
