import denseKnowledgeRuntimeJson from "../catalog/generated/dense/runtime.json"
import { getDnaOwnerBookTopicTitle, isDnaOwnerBookTopicId, type DnaOwnerBookMatch } from "../ownerBookRuntime"
import { normalizeDnaChatText } from "../text"
import type { DnaS13Depth, DnaS13Focus, DnaS13QueryFrame, DnaS13QuestionType } from "./contracts"
import type { DnaS13RequestedFacet } from "./contracts"
import type { DnaS13PragmaticAction, DnaS13RoutingConfidence } from "./pragmaticTask"
import type { DnaS13ComparisonConclusionMode, DnaS13StrictPlan } from "./strictContracts"

export const DNA_S13_CONVERSATION_CONTEXT_VERSION = "dna-s13-conversation-context@5" as const

export const DNA_S13_CONTEXT_OPERATIONS = Object.freeze([
  "standalone",
  "explain_same_topic",
  "expand_same_topic",
  "simplify_same_topic",
  "example_same_topic",
  "why_same_topic",
  "boundary_same_topic",
  "compare_previous_targets",
  "summarize_same_topic",
  "replace_previous_target",
  "clarification_required",
] as const)

export type DnaS13ContextOperation = typeof DNA_S13_CONTEXT_OPERATIONS[number]
export type DnaS13ContextResolutionMethod =
  | "none"
  | "conversation_referent"
  | "named_title_exact"
  | "named_title_normalized"
  | "named_title_contextual"
  | "controlled_alias"
  | "correction_named_target"
  | "correction_positional_target"
  | "intra_turn_coreference"

export type DnaS13TargetPolarity = "ACTIVE_TARGET" | "REJECTED_TARGET" | "CONTEXT_ONLY"
export type DnaS13TopicMention = Readonly<{
  topicId: string
  title: string
  surface: string | null
  polarity: DnaS13TargetPolarity
}>

export type DnaS13ConversationAnswerSlotSnapshot = Readonly<{
  id: string
  topicId: string
  questionType: DnaS13QuestionType
  requiredClaimIds: readonly string[]
  requestedFacet: DnaS13RequestedFacet | null
}>

/**
 * Provider-independent, science-free conversation state. Previous prose is
 * deliberately absent: verified catalog identifiers are the only authority
 * that may be inherited by a later turn.
 */
export type DnaS13ConversationState = Readonly<{
  version: typeof DNA_S13_CONVERSATION_CONTEXT_VERSION
  sessionId: string
  privacyCategory: "general_non_sensitive"
  lastEligibleTopicIds: readonly string[]
  lastEligibleFocus: DnaS13Focus
  lastEligibleQuestionType: DnaS13QuestionType
  lastEligibleRequiredClaimIds: readonly string[]
  lastEligibleLockedClaimIds: readonly string[]
  lastEligibleAnswerSlots: readonly DnaS13ConversationAnswerSlotSnapshot[]
  lastEligibleNormalizedQuestion: string
  lastEligibleUserQuestion: string
  lastEligibleAnswerDepth: DnaS13Depth
  lastEligibleComparisonSideA: string | null
  lastEligibleComparisonSideB: string | null
  lastEligibleComparisonConclusionMode: DnaS13ComparisonConclusionMode | null
  lastEligibleActiveTopicId: string
  lastEligibleRejectedTopicIds?: readonly string[]
  lastEligiblePragmaticAction?: DnaS13PragmaticAction | null
  lastEligibleRequestedFacets?: readonly DnaS13RequestedFacet[]
  alreadyShownClaimIds?: readonly string[]
  alreadyAnsweredFacets?: readonly string[]
  alreadyShownRelationIds?: readonly string[]
}>

export type DnaS13NamedTopicResolution = Readonly<{
  topicId: string
  title: string
  surface: string
  canonicalConcept: string
  headingLabel: string
  parentContext: string | null
  confidence: DnaS13RoutingConfidence
  candidateTopicIds: readonly string[]
  method: Extract<DnaS13ContextResolutionMethod,
    "named_title_exact" | "named_title_normalized" | "named_title_contextual" | "controlled_alias">
}>

export type DnaS13ResolvedUserQuery = Readonly<{
  version: typeof DNA_S13_CONVERSATION_CONTEXT_VERSION
  originalQuestion: string
  normalizedQuestion: string
  operation: DnaS13ContextOperation
  followUp: boolean
  correction: boolean
  targetSurface: string | null
  targetTopicIds: readonly string[]
  topicMentions: readonly DnaS13TopicMention[]
  retrievalQuestions: readonly string[]
  responseDepth: DnaS13Depth
  resolutionMethod: DnaS13ContextResolutionMethod
  ambiguityReason: string | null
  contextInherited: boolean
  intraTurnCoreferenceCount?: number
  topicResolutionConfidence?: DnaS13RoutingConfidence
  candidateTopicIds?: readonly string[]
  previousAction?: DnaS13PragmaticAction | null
  previousFacets?: readonly DnaS13RequestedFacet[]
}>

type DenseTopicRow = Readonly<{ title?: string; topicId?: string }>
type TopicSurface = Readonly<{
  title: string
  normalized: string
  topicId: string
  canonicalConcept: string
  headingLabel: string
  parentContext: string | null
  supportCount: number
}>

const denseRows = (denseKnowledgeRuntimeJson as unknown as { units: readonly DenseTopicRow[] }).units
const SUPPORT_COUNT_BY_TOPIC = new Map<string, number>()
for (const row of denseRows) {
  const topicId = String(row.topicId || "").trim()
  if (topicId) SUPPORT_COUNT_BY_TOPIC.set(topicId, (SUPPORT_COUNT_BY_TOPIC.get(topicId) ?? 0) + 1)
}

const TOPIC_SURFACES: readonly TopicSurface[] = Object.freeze([...new Map(denseRows
  .map((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    const headingLabel = getDnaOwnerBookTopicTitle(topicId) ?? title
    const headingParts = headingLabel.split(" · ").map((part) => part.trim()).filter(Boolean)
    return [`${topicId}\u0000${title}`, Object.freeze({
      title,
      normalized: normalizeDnaChatText(title),
      topicId,
      canonicalConcept: title,
      headingLabel,
      parentContext: headingParts.length > 1 ? headingParts.slice(0, -1).join(" · ") : null,
      supportCount: SUPPORT_COUNT_BY_TOPIC.get(topicId) ?? 0,
    })] as const
  })
  .filter(([, row]) => row.title.length >= 2 && row.normalized.length >= 2 && isDnaOwnerBookTopicId(row.topicId))).values()]
  .sort((left, right) => right.normalized.length - left.normalized.length || left.title.localeCompare(right.title, "tr")))

const SURFACES_BY_TOPIC_ID = new Map<string, readonly TopicSurface[]>()
for (const surface of TOPIC_SURFACES) {
  const rows = SURFACES_BY_TOPIC_ID.get(surface.topicId) ?? []
  SURFACES_BY_TOPIC_ID.set(surface.topicId, Object.freeze([...rows, surface]))
}

const SURFACES_BY_CANONICAL = new Map<string, readonly TopicSurface[]>()
for (const surface of TOPIC_SURFACES) {
  const rows = SURFACES_BY_CANONICAL.get(surface.normalized) ?? []
  SURFACES_BY_CANONICAL.set(surface.normalized, Object.freeze([...rows, surface]
    .sort((left, right) => right.supportCount - left.supportCount || left.topicId.localeCompare(right.topicId))))
}

const CONTROLLED_ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "maia y": Object.freeze(["maia-y"]),
  "hpa ekseni": Object.freeze(["HPA Ekseninin Temel İşleyişi"]),
  "gunluk olay kaydi": Object.freeze(["Günlük ve Olay Kaydı"]),
})

const CORRECTION_PATTERN = /\b(?:hayir|yok|onu degil|degil|dgl|kastim|kastettim|kastetmedim|demek istedigim|demek istemedim|duzeltme|asil sordugum|hedefim|hedef|hedefm|soruyorum|bos ver|onu birak|bunu birak|basligi\w* birak|tarafi\w* birak|konuyu\w* birak|onu gec|bunu gec)\b|\b(?:yalniz|yalnz)\b.{0,120}\b(?:acikla|anlat|soruyorum)\b/u
const REPLACEMENT_GRAMMAR = /\b(?:yerine|degil|dgl|demek isteme\w*|kastetme\w*|birak\w*|brak\w*|gec\w*)\b/u
const CORRECTION_META = /\b(?:yanlis\w* (?:ifade|soyle)\w*|duzelt\w*|demek istemed\w*|kastetmed\w*)\b/u
const EXCLUSIVE_TARGET_GRAMMAR = /\b(?:yalniz|yalnz|sadece|tek olarak)\b/u
const BOUNDARY_PATTERN = /\b(?:kanit\w*.{0,48}(?:kesin )?soyleyemedig\w*|emin olamayacag\w*|guvenli bilimsel sinir|yorum sinir\w*|bilimsel sinir\w*|tek basina tani koy\w*|neyi (?:kanitlamaz|gostermez|soylemez)|ne (?:cikarilamaz|soylenemez)|ne kadar kesin|sinir\w* (?:ne|nedir|nerede))\b/u
const POSITIONAL_CORRECTION_PATTERN = /^(?:ilkini|birincisini|ilk kismi|ikincisini|ikinciyi|ikinci kismi|digerini|oburunu)(?:\s+(?:ac|acikla|anlat|soruyorum))?$/u
const EXPAND_PATTERN = /\b(?:biraz daha (?:ac|acar misin|detay|ayrinti|anlat)|brz\b.{0,16}\bdha\b.{0,16}\bac\w*|(?:bir|bi) adim (?:daha|ileri|otesi)(?:\s+(?:ilerle\w*|git\w*|gid\w*|ac\w*|gotur\w*|gec\w*))?|devam (?:et\w*|ed\w*|edelim|etsene)|ileri (?:gotur\w*|tas\w*)|daha (?:detayli|ayrintili) anlat|asil isleyisi ac|mekanizmayi biraz daha anlat|bu basligi biraz derinlestir|ayrintisini ac\w*|ayrintiyi ac\w*|otesine gecen ayrintiyi ac\w*|bu konunun isleyisini genislet|bir kademe daha detaylandir|daha derine in\w*|biraz derinlestir\w*|detaylandir\w*|bir kat daha ayrinti\w*|derinlestir\w*|ayni konunun bir kat otesi\w*|oncekini yinelemeden yeni\w*.{0,20}ayrinti|buraya eklenebilecek baska\w*.{0,30}(?:nokta|bilgi|ayrinti)|baska guvenli (?:nokta|bilgi|ayrinti))\b/u
const SIMPLIFY_PATTERN = /\b(?:daha basit anlat|gunluk dille soyle\w*|teknik olmadan anlat|anlamadim daha sade anlat|daha sade anlat|bunu sadelestir|daha yalin soyle\w*|jargonsuz anlat|teknik terimleri azalt|anlasilir soyle\w*|gundelik turkce)\b/u
const COMPLEXITY_SIGNAL = /\b(?:teknik|jargon\w*|agir|karmasik|soyut|anlasilma\w*|kavrayama\w*)\b/u
const PLAIN_STYLE_SIGNAL = /\b(?:basit|sade|yalin|gundelik|gunluk|normal dil\w*|insan gibi|ogrenci gibi|ogrencinin anlayacag\w*|cocuk\w* anlay\w* gibi|kolay|anlasilir)\b/u
const REPHRASE_SIGNAL = /\b(?:anlat\w*|soyle\w*|acikla\w*|ifade\w*|kur\w*|cevir\w*)\b/u
const EXAMPLE_PATTERN = /\b(?:ornek\w*|mesela|gunluk hayattan|gundelik bir durum|gercek (?:yasamda|bir durumda).{0,40}nasil gorunur|somutlastir\w*|somut olay|pratikte.{0,40}nasil gorunur)\b/u
const WHY_PATTERN = /\b(?:neden|neden onemli|niye onemli|peki niye|bunun onemi ne|asil onemi|nicin onemli|bu neden gerekli|buradaki gerekce ne|onemi nerede|pratik (?:onem|deger)\w*|onem gerekcesi|dikkate deger|ne ise yar\w*)\b/u
const EXPLAIN_PATTERN = /\b(?:bu ne demek|ne demek yani|nasil yani|biraz aciklar misin|bunu acikla|daha anlasilir anlat|bunun anlami ne|burada ne anlatiliyor|bunu baska turlu aciklar misin|soyledigini aciklar misin|daha anlasilir bicimde acikla|peki bunun (?:kaynaklari|kaniti|olcumu|siniri) ne (?:diyor|gosteriyor))\b/u
const CONTEXT_DEPENDENT_PATTERN = /\b(?:az onceki|onceki|konustugumuz|bu baslik|bu konu|ayni aciklama|dedigimiz|mevzu)\b/u
const SUMMARY_PATTERN = /\b(?:kisaca toparla\w*|ana fikri toparla\w*|tek paragrafta ozetle\w*|ozetle\w*|kisa bir ozet)\b/u
const CONTEXT_COMPARE_PATTERN = /\b(?:(?:ikisi|bunlar|bu ikisi)\w*.{0,80}(?:fark|ayrim|ayni|karsilastir)|aralarindaki (?:fark|ayrim|iliski))\w*\b/u
const INTRA_TURN_SEQUENCE = /\b(?:daha sonra|sonra|ardından|ardindan)\b/iu
const INTRA_TURN_ANAPHOR = /^(?:\s|[,;:.-])*(?:bu modelin|bu yaklasimin|bu teorinin|bu kavramin|ayni modelin|modelin|bunun|onun|ilkinin|birincisinin|ikincisinin)\b/iu

export type DnaS13IntraTurnCoreferenceResolution = Readonly<{
  namedTargets: readonly DnaS13NamedTopicResolution[]
  retrievalQuestions: readonly string[]
  resolvedReferenceCount: number
}>

function phraseIncludes(value: string, phrase: string) {
  return ` ${value} `.includes(` ${phrase} `)
}

const ROUTING_LEXICAL_STOP_TOKENS = new Set([
  "acikla", "anlat", "ayriliyor", "core", "demek", "ifade", "kavramlardan",
  "kisaca", "meaning", "nasi", "nasil", "ne", "nedir", "ndr", "neyi", "neydi",
  "tam", "yakın", "yakin", "ya",
])

function boundedEditDistance(left: string, right: string, maximum: number) {
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i]
    let rowMinimum = i
    for (let j = 1; j <= right.length; j += 1) {
      const value = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      current.push(value)
      rowMinimum = Math.min(rowMinimum, value)
    }
    if (rowMinimum > maximum) return maximum + 1
    previous = current
  }
  return previous[right.length]!
}

function lexicalTokens(value: string) {
  return normalizeDnaChatText(value).split(/\s+/u)
    .filter((token) => token.length >= 2 && !ROUTING_LEXICAL_STOP_TOKENS.has(token))
}

function lexicalTokenMatch(left: string, right: string) {
  if (left === right) return true
  if (Math.min(left.length, right.length) < 4) return false
  const maximum = Math.max(left.length, right.length) >= 9 ? 2 : 1
  return boundedEditDistance(left, right, maximum) <= maximum
}

function fuzzySurfaceEvidence(question: string, surface: TopicSurface) {
  const questionTokens = lexicalTokens(question)
  const surfaceTokens = lexicalTokens(surface.normalized)
  if (surfaceTokens.length < 3 || questionTokens.length < 3) return null
  const used = new Set<number>()
  let matches = 0
  for (const token of surfaceTokens) {
    const index = questionTokens.findIndex((candidate, candidateIndex) =>
      !used.has(candidateIndex) && lexicalTokenMatch(token, candidate))
    if (index < 0) continue
    used.add(index)
    matches += 1
  }
  const coverage = matches / surfaceTokens.length
  if (matches < 3 || coverage < 0.8) return null
  return Object.freeze({ matches, coverage, score: coverage * 100 + matches + surfaceTokens.length / 100 })
}

function fuzzyTopicCandidates(normalizedQuestion: string) {
  return TOPIC_SURFACES.map((surface) => {
    const evidence = fuzzySurfaceEvidence(normalizedQuestion, surface)
    return evidence ? Object.freeze({ surface, ...evidence }) : null
  }).filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((left, right) => right.score - left.score
      || right.surface.normalized.length - left.surface.normalized.length
      || right.surface.supportCount - left.surface.supportCount)
}

/**
 * Resolves grammatically dependent references inside the current message
 * before the dependent clause is allowed to participate in global heading
 * lookup. A corpus heading beginning with “Modelin …” therefore cannot steal
 * the scope established by an earlier explicit model target.
 */
export function resolveDnaS13IntraTurnCoreferences(
  question: string,
  preferredTopicIds: readonly string[] = [],
): DnaS13IntraTurnCoreferenceResolution {
  const segments = question.split(INTRA_TURN_SEQUENCE).map((part) => part.trim()).filter(Boolean)
  if (segments.length < 2) return Object.freeze({
    namedTargets: Object.freeze(resolveDnaS13NamedTopicSurfaces(question, preferredTopicIds, 8)),
    retrievalQuestions: Object.freeze([]),
    resolvedReferenceCount: 0,
  })
  const resolved: DnaS13NamedTopicResolution[] = []
  const retrievalQuestions: string[] = []
  let referenceCount = 0
  for (const segment of segments) {
    const normalizedSegment = normalizeDnaChatText(segment).replace(/^once\s+/u, "")
    const anaphor = normalizedSegment.match(INTRA_TURN_ANAPHOR)?.[0] ?? null
    // An explicit canonical concept always wins over a lexical anaphor such
    // as a heading that happens to begin with “Modelin”, but a lowercase
    // grammatical “modelin ...” after an established target remains anaphoric.
    const explicit = resolveDnaS13NamedTopicSurfaces(segment, preferredTopicIds, 8)
    const explicitCanonicalCasing = /^(?:\s|[,;:.-])*[“"']?[A-ZÇĞİÖŞÜ]/u.test(segment)
    if (explicit.length && (!anaphor || explicitCanonicalCasing)
      && !explicit.every((row) => row.confidence === "LOW")) {
      resolved.push(...explicit)
      retrievalQuestions.push(...explicit.map(() => segment))
      continue
    }
    if (anaphor && resolved.length) {
      const positional = /^(?:ikincisinin)/u.test(anaphor.trim()) ? resolved[1]
        : /^(?:ilkinin|birincisinin)/u.test(anaphor.trim()) ? resolved[0]
          : resolved.at(-1)
      if (positional) {
        resolved.push(Object.freeze({ ...positional, surface: anaphor.trim(), method: "named_title_contextual" as const, confidence: "HIGH" as const }))
        retrievalQuestions.push(segment)
        referenceCount += 1
        continue
      }
    }
    if (explicit.length) {
      resolved.push(...explicit)
      retrievalQuestions.push(...explicit.map(() => segment))
    }
  }
  return Object.freeze({
    namedTargets: Object.freeze(resolved),
    retrievalQuestions: Object.freeze(retrievalQuestions),
    resolvedReferenceCount: referenceCount,
  })
}

function eligibleState(input: Readonly<{
  sessionId: string
  privacyAllowed: boolean
  state?: DnaS13ConversationState | null
}>) {
  const state = input.state
  return input.privacyAllowed && state?.sessionId === input.sessionId
    && state.privacyCategory === "general_non_sensitive"
    && state.lastEligibleTopicIds.length > 0
    && state.lastEligibleTopicIds.every(isDnaOwnerBookTopicId)
    ? state
    : null
}

function positionalTarget(normalized: string, state: DnaS13ConversationState): string | null {
  const sideA = state.lastEligibleComparisonSideA
  const sideB = state.lastEligibleComparisonSideB
  if (!sideA || !sideB) return null
  if (/\b(?:ilkini|birincisini|ilk kismi)\b.*\bdegil\b.*\b(?:ikincisini|ikinciyi|ikinci kismi)\b/u.test(normalized)) return sideB
  if (/\b(?:ikincisini|ikinciyi|ikinci kismi)\b.*\bdegil\b.*\b(?:ilkini|birincisini|ilk kismi)\b/u.test(normalized)) return sideA
  if (/\b(?:ilkini|birincisini|ilk basligi)\b.*\b(?:gec|birak)\b.*\b(?:ikincisini|ikinciyi|ikinci basligi)\b/u.test(normalized)) return sideB
  if (/\b(?:ikincisini|ikinciyi|ikinci basligi)\b.*\b(?:gec|birak)\b.*\b(?:ilkini|birincisini|ilk basligi)\b/u.test(normalized)) return sideA
  if (/\b(?:ilkini|birincisini|ilk kismi)\b.*\bdegil\b.*\b(?:digerini|oburunu)\b/u.test(normalized)) return sideB
  if (/\b(?:ikincisini|ikinci kismi|ikinciyi)\b.*\bdegil\b.*\b(?:digerini|oburunu)\b/u.test(normalized)) return sideA
  if (/\b(?:ilkini|birincisini|ilk kismi)\b/u.test(normalized)) return sideA
  if (/\b(?:ikincisini|ikinci kismi|ikinciyi)\b/u.test(normalized)) return sideB
  if (/\b(?:digerini|oburunu)\b/u.test(normalized)) {
    return state.lastEligibleActiveTopicId === sideA ? sideB : sideA
  }
  return null
}

function correctionTopicMentions(question: string, state: DnaS13ConversationState | null) {
  const normalized = normalizeDnaChatText(question)
  const named = resolveDnaS13NamedTopicSurfaces(question, state?.lastEligibleTopicIds ?? [], 8)
  const positions = named.map((row) => ({ row, index: normalized.indexOf(normalizeDnaChatText(row.title)) }))
  const activeCues = [...normalized.matchAll(/\b(?:yerine|degil|dgl|demek isteme\w*|kastetme\w*|asil sordugum|hedefim|hedef|hedefm|kastim|yalniz|yalnz|bos ver|onu birak|birak|brak|gec)\b/gu)]
  // A trailing discourse instruction such as “doğru başlığa geç” is not a
  // target cue. Prefer the latest cue that is actually followed by a resolved
  // topic surface; fall back to the latest cue for single-target corrections.
  const activeCue = [...activeCues].reverse().find((cue) => positions.some((entry) =>
    entry.index > (cue.index ?? -1) + cue[0].length)) ?? activeCues.at(-1)
  const afterCue = activeCue ? positions.filter((entry) => entry.index > (activeCue.index ?? -1) + activeCue[0].length) : []
  const beforePositiveTargetCue = activeCue && /(?:hedef|demek istiyor\w*|demek istedig\w*|kastim|kastettim)/u.test(activeCue[0])
    ? positions.filter((entry) => entry.index >= 0 && entry.index < (activeCue.index ?? -1)).at(-1)?.row
    : null
  const explicitTarget = afterCue[0]?.row
    ?? beforePositiveTargetCue
    ?? (/(?:demek iste\w*|kast\w*|soruyorum|yalniz|yalnz)/u.test(normalized) ? positions.at(-1)?.row : null)
    ?? (named.length === 1 ? named[0] : null)
  const records: DnaS13TopicMention[] = named.map((row) => Object.freeze({
    topicId: row.topicId,
    title: row.title,
    surface: row.surface,
    polarity: row.topicId === explicitTarget?.topicId ? "ACTIVE_TARGET" as const : "REJECTED_TARGET" as const,
  }))
  const rejectsPriorContext = REPLACEMENT_GRAMMAR.test(normalized) || EXCLUSIVE_TARGET_GRAMMAR.test(normalized)
  for (const topicId of state?.lastEligibleTopicIds ?? []) {
    if (records.some((row) => row.topicId === topicId)) continue
    records.push(Object.freeze({
      topicId,
      title: getDnaOwnerBookTopicTitle(topicId) ?? topicId,
      surface: null,
      polarity: rejectsPriorContext ? "REJECTED_TARGET" as const : "CONTEXT_ONLY" as const,
    }))
  }
  return Object.freeze({ active: explicitTarget ?? null, records: Object.freeze(records) })
}

function nextDepth(previous: DnaS13Depth) {
  return previous === "short" ? "standard" : "deep"
}

function retrievalQuestion(operation: DnaS13ContextOperation) {
  if (operation === "expand_same_topic") return "bunu biraz daha detaylı anlat"
  if (operation === "simplify_same_topic") return "bunu daha sade anlat"
  if (operation === "example_same_topic") return "bunu günlük hayattan örnekle açıkla"
  if (operation === "why_same_topic") return "bunun neden önemli olduğunu açıkla"
  if (operation === "boundary_same_topic") return "bunun bilimsel yorum sınırını açıkla"
  if (operation === "compare_previous_targets") return "bu kavramı karşılaştırma için tanımla"
  if (operation === "summarize_same_topic") return "bunu kısa ve doğrulanmış bir özetle anlat"
  return "bunu açıkla"
}

function detectedContextOperation(normalized: string): DnaS13ContextOperation {
  const simplify = SIMPLIFY_PATTERN.test(normalized)
    || (COMPLEXITY_SIGNAL.test(normalized) && (PLAIN_STYLE_SIGNAL.test(normalized) || REPHRASE_SIGNAL.test(normalized)))
    || (PLAIN_STYLE_SIGNAL.test(normalized) && REPHRASE_SIGNAL.test(normalized))
  return EXPAND_PATTERN.test(normalized) ? "expand_same_topic"
    : simplify ? "simplify_same_topic"
      : EXAMPLE_PATTERN.test(normalized) ? "example_same_topic"
        : WHY_PATTERN.test(normalized) ? "why_same_topic"
          : BOUNDARY_PATTERN.test(normalized) ? "boundary_same_topic"
          : CONTEXT_COMPARE_PATTERN.test(normalized) ? "compare_previous_targets"
          : SUMMARY_PATTERN.test(normalized) ? "summarize_same_topic"
          : EXPLAIN_PATTERN.test(normalized) || CONTEXT_DEPENDENT_PATTERN.test(normalized) ? "explain_same_topic" : "standalone"
}

function standalone(question: string, depth: DnaS13Depth, named: readonly DnaS13NamedTopicResolution[] = []): DnaS13ResolvedUserQuery {
  const confidence = named.some((row) => row.confidence === "LOW") ? "LOW"
    : named.some((row) => row.confidence === "MEDIUM") ? "MEDIUM" : named.length ? "HIGH" : "LOW"
  return Object.freeze({
    version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
    originalQuestion: question,
    normalizedQuestion: normalizeDnaChatText(question),
    operation: "standalone",
    followUp: false,
    correction: false,
    targetSurface: named.length === 1 ? named[0]!.surface : null,
    targetTopicIds: Object.freeze(named.map((row) => row.topicId)),
    topicMentions: Object.freeze(named.map((row) => Object.freeze({
      topicId: row.topicId, title: row.title, surface: row.surface, polarity: "ACTIVE_TARGET" as const,
    }))),
    retrievalQuestions: Object.freeze(named.length ? named.map(() => "bunu açıkla") : [question]),
    responseDepth: depth,
    resolutionMethod: named[0]?.method ?? "none",
    ambiguityReason: null,
    contextInherited: false,
    topicResolutionConfidence: confidence,
    candidateTopicIds: Object.freeze([...new Set(named.flatMap((row) => row.candidateTopicIds))]),
    previousAction: null,
    previousFacets: Object.freeze([]),
  })
}

/** Resolve only catalog-backed title surfaces; it never creates a new topic. */
export function resolveDnaS13NamedTopicSurfaces(
  question: string,
  preferredTopicIds: readonly string[] = [],
  maximum = 2,
): readonly DnaS13NamedTopicResolution[] {
  const normalized = normalizeDnaChatText(question)
  if (!normalized) return Object.freeze([])
  const preferred = new Set(preferredTopicIds)
  const matches = TOPIC_SURFACES.filter((surface) => phraseIncludes(normalized, surface.normalized))
    .sort((left, right) => normalized.indexOf(left.normalized) - normalized.indexOf(right.normalized)
      || right.normalized.length - left.normalized.length || left.title.localeCompare(right.title, "tr"))
  const selected: TopicSurface[] = []
  for (const match of matches) {
    if (selected.some((row) => row.normalized.includes(match.normalized))) continue
    const matchStart = normalized.indexOf(match.normalized)
    const matchEnd = matchStart + match.normalized.length
    if (selected.some((row) => {
      const rowStart = normalized.indexOf(row.normalized)
      const rowEnd = rowStart + row.normalized.length
      return matchStart < rowEnd && rowStart < matchEnd
    })) continue
    const sameTitle = SURFACES_BY_CANONICAL.get(match.normalized) ?? [match]
    const preferredMatch = sameTitle.find((row) => preferred.has(row.topicId))
    const hierarchicalMatches = sameTitle.filter((row) => phraseIncludes(normalized, normalizeDnaChatText(row.headingLabel)))
    const resolved = preferredMatch ?? (hierarchicalMatches.length === 1 ? hierarchicalMatches[0]
      : sameTitle.length === 1 ? match : sameTitle[0])
    if (resolved && !selected.some((row) => row.topicId === resolved.topicId)) selected.push(resolved)
    if (selected.length >= Math.max(1, Math.min(8, maximum))) break
  }
  const exactQuestionTokens = selected.length === 1 ? lexicalTokens(selected[0]!.normalized) : []
  const remainingQuestionEvidence = selected.length === 1
    ? lexicalTokens(normalized).filter((token) => !exactQuestionTokens.some((exact) => lexicalTokenMatch(token, exact)))
    : []
  const fuzzy = selected.length === 0 || (selected.length === 1 && remainingQuestionEvidence.length >= 2)
    ? fuzzyTopicCandidates(normalized) : []
  const strongestFuzzy = fuzzy[0]
  const exactTokenCount = exactQuestionTokens.length
  // A long, typo-tolerant canonical surface can outrank an embedded short
  // exact surface only when it carries materially more lexical evidence.
  if (selected.length === 1 && strongestFuzzy && strongestFuzzy.matches >= exactTokenCount + 2) {
    selected.splice(0, selected.length, strongestFuzzy.surface)
  }
  if (selected.length) return Object.freeze(selected.map((row) => Object.freeze({
    topicId: row.topicId,
    title: row.title,
    surface: row.title,
    canonicalConcept: row.canonicalConcept,
    headingLabel: row.headingLabel,
    parentContext: row.parentContext,
    candidateTopicIds: Object.freeze([...(SURFACES_BY_CANONICAL.get(row.normalized) ?? [row])].map((entry) => entry.topicId)),
    confidence: preferred.has(row.topicId) || (SURFACES_BY_CANONICAL.get(row.normalized)?.length ?? 0) === 1
      ? "HIGH" as const
      : phraseIncludes(normalized, normalizeDnaChatText(row.headingLabel)) ? "MEDIUM" as const : "LOW" as const,
    method: preferred.has(row.topicId) ? "named_title_contextual" as const
      : normalized === row.normalized ? "named_title_exact" as const : "named_title_normalized" as const,
  })))

  for (const [alias, titles] of Object.entries(CONTROLLED_ALIASES)) {
    if (!phraseIncludes(normalized, alias)) continue
    const rows = TOPIC_SURFACES.filter((surface) => titles.includes(surface.title))
    const row = rows.find((surface) => preferred.has(surface.topicId)) ?? (rows.length === 1 ? rows[0] : null)
    if (row) return Object.freeze([Object.freeze({
      topicId: row.topicId, title: row.title, surface: alias,
      canonicalConcept: row.canonicalConcept, headingLabel: row.headingLabel, parentContext: row.parentContext,
      confidence: "HIGH" as const, candidateTopicIds: Object.freeze([row.topicId]), method: "controlled_alias" as const,
    })])
  }

  if (strongestFuzzy) {
    const sameCanonical = SURFACES_BY_CANONICAL.get(strongestFuzzy.surface.normalized) ?? [strongestFuzzy.surface]
    const preferredMatch = sameCanonical.find((row) => preferred.has(row.topicId))
    const row = preferredMatch ?? sameCanonical[0]!
    return Object.freeze([Object.freeze({
      topicId: row.topicId,
      title: row.title,
      surface: row.title,
      canonicalConcept: row.canonicalConcept,
      headingLabel: row.headingLabel,
      parentContext: row.parentContext,
      confidence: sameCanonical.length === 1 ? "MEDIUM" as const : "LOW" as const,
      candidateTopicIds: Object.freeze(sameCanonical.map((entry) => entry.topicId)),
      method: "named_title_normalized" as const,
    })])
  }

  const headingParents = TOPIC_SURFACES.flatMap((surface) => {
    const parts = surface.headingLabel.split(" · ").map((part) => part.trim()).filter(Boolean)
    return parts.slice(0, -1).filter((part) => phraseIncludes(normalized, normalizeDnaChatText(part)))
      .map((part) => Object.freeze({ surface, part }))
  })
  if (headingParents.length) {
    const parent = headingParents[0]!.part
    const candidates = headingParents.filter((row) => row.part === parent).map((row) => row.surface)
    const uniqueCandidates = [...new Map(candidates.map((row) => [row.topicId, row])).values()]
    const row = uniqueCandidates.find((entry) => preferred.has(entry.topicId)) ?? uniqueCandidates[0]!
    return Object.freeze([Object.freeze({
      topicId: row.topicId,
      title: parent,
      surface: parent,
      canonicalConcept: parent,
      headingLabel: row.headingLabel,
      parentContext: null,
      confidence: "LOW" as const,
      candidateTopicIds: Object.freeze(uniqueCandidates.map((entry) => entry.topicId)),
      method: "named_title_contextual" as const,
    })])
  }
  return Object.freeze([])
}

/**
 * Runs before S13 query interpretation. It resolves only conversational
 * reference and catalog title identity; all answer claims are retrieved again.
 */
export function resolveDnaS13ConversationContext(input: Readonly<{
  sessionId: string
  question: string
  responseDepth: DnaS13Depth
  privacyAllowed: boolean
  state?: DnaS13ConversationState | null
}>): DnaS13ResolvedUserQuery {
  const question = String(input.question || "").trim()
  const normalized = normalizeDnaChatText(question)
  const state = eligibleState(input)
  const intraTurn = resolveDnaS13IntraTurnCoreferences(question, state?.lastEligibleTopicIds ?? [])
  const fullNamed = intraTurn.namedTargets
  const outsideNamedTitles = fullNamed.reduce((value, row) =>
    value.replace(normalizeDnaChatText(row.surface || row.title), " "), normalized)
  const correctionOutside = outsideNamedTitles
    .replace(/\b(?:sonucu?\s+)?sona birak\w*\b/gu, " ")
  const replacementHasFollowingTarget = [...normalized.matchAll(new RegExp(REPLACEMENT_GRAMMAR.source, "gu"))]
    .some(() => fullNamed.length > 0 && REPLACEMENT_GRAMMAR.test(correctionOutside))
  // Catalog titles may themselves contain words such as “değil” or “hedef”.
  // Only correction markers outside resolved topic surfaces are operational.
  const correction = CORRECTION_PATTERN.test(correctionOutside)
    || (fullNamed.length >= 1 && CORRECTION_META.test(correctionOutside))
    || replacementHasFollowingTarget
    || Boolean(state && fullNamed.length === 1 && EXCLUSIVE_TARGET_GRAMMAR.test(correctionOutside))
    || Boolean(state && fullNamed.length === 0 && POSITIONAL_CORRECTION_PATTERN.test(normalized))

  if (correction) {
    const mentionResolution = correctionTopicMentions(question, state)
    if (mentionResolution.active?.confidence === "LOW" && mentionResolution.active.candidateTopicIds.length > 1) {
      return Object.freeze({
        ...standalone(question, input.responseDepth, [mentionResolution.active]),
        correction: true,
        operation: "clarification_required",
        ambiguityReason: "correction_target_canonical_collision",
      })
    }
    const positional = mentionResolution.active || !state ? null : positionalTarget(normalized, state)
    const target = mentionResolution.active?.topicId ?? positional
    if (!target) return Object.freeze({ ...standalone(question, input.responseDepth), correction: true, operation: "clarification_required", ambiguityReason: "correction_target_ambiguous" })
    const positionalMentions: readonly DnaS13TopicMention[] = mentionResolution.active || !state ? mentionResolution.records
      : Object.freeze(state.lastEligibleTopicIds.map((topicId) => Object.freeze({
          topicId,
          title: getDnaOwnerBookTopicTitle(topicId) ?? topicId,
          surface: null,
          polarity: topicId === target ? "ACTIVE_TARGET" as const
            : /(?:degil|dgl|birak|brak|gec)/u.test(normalized) ? "REJECTED_TARGET" as const : "CONTEXT_ONLY" as const,
        })))
    return Object.freeze({
      version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
      originalQuestion: question,
      normalizedQuestion: normalized,
      operation: "replace_previous_target",
      followUp: true,
      correction: true,
      targetSurface: mentionResolution.active?.surface ?? getDnaOwnerBookTopicTitle(target),
      targetTopicIds: Object.freeze([target]),
      topicMentions: positionalMentions,
      retrievalQuestions: Object.freeze(["bunu açıkla"]),
      responseDepth: input.responseDepth,
      resolutionMethod: positional ? "correction_positional_target" : "correction_named_target",
      ambiguityReason: null,
      contextInherited: Boolean(state),
      topicResolutionConfidence: mentionResolution.active?.confidence ?? "HIGH",
      candidateTopicIds: Object.freeze(mentionResolution.active?.candidateTopicIds ?? [target]),
      previousAction: state?.lastEligiblePragmaticAction ?? null,
      previousFacets: Object.freeze([...(state?.lastEligibleRequestedFacets ?? state?.alreadyAnsweredFacets ?? [])]
        .filter((facet): facet is DnaS13RequestedFacet => typeof facet === "string")),
    })
  }

  const named = fullNamed
  if (named.some((row) => row.confidence === "LOW")) {
    return Object.freeze({
      ...standalone(question, input.responseDepth, named),
      operation: "clarification_required",
      ambiguityReason: "canonical_topic_collision",
    })
  }
  if ((intraTurn.resolvedReferenceCount > 0
    || (named.length > 1 && intraTurn.retrievalQuestions.length === named.length)) && named.length > 0) {
    return Object.freeze({
      ...standalone(question, input.responseDepth, named),
      targetTopicIds: Object.freeze(named.map((row) => row.topicId)),
      topicMentions: Object.freeze(named.map((row) => Object.freeze({
        topicId: row.topicId, title: row.title, surface: row.surface, polarity: "ACTIVE_TARGET" as const,
      }))),
      retrievalQuestions: intraTurn.retrievalQuestions.length === named.length
        ? intraTurn.retrievalQuestions : Object.freeze(named.map(() => question)),
      resolutionMethod: "intra_turn_coreference" as const,
      intraTurnCoreferenceCount: intraTurn.resolvedReferenceCount,
      topicResolutionConfidence: named.some((row) => row.confidence === "MEDIUM") ? "MEDIUM" : "HIGH",
      candidateTopicIds: Object.freeze([...new Set(named.flatMap((row) => row.candidateTopicIds))]),
    })
  }
  const namedOperation = detectedContextOperation(outsideNamedTitles.replace(/\s+/gu, " ").trim())
  if (named.length === 1 && namedOperation === "explain_same_topic" && !state) {
    return standalone(question, input.responseDepth, named)
  }
  if (named.length === 1 && namedOperation !== "standalone") {
    const target = named[0]!
    const depth = namedOperation === "expand_same_topic" ? nextDepth(state?.lastEligibleAnswerDepth ?? input.responseDepth)
      : namedOperation === "simplify_same_topic" ? "short"
        : namedOperation === "why_same_topic" || namedOperation === "example_same_topic" ? "deep" : input.responseDepth
    return Object.freeze({
      version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
      originalQuestion: question,
      normalizedQuestion: normalized,
      operation: namedOperation,
      followUp: true,
      correction: false,
      targetSurface: target.surface,
      targetTopicIds: Object.freeze([target.topicId]),
      topicMentions: Object.freeze([Object.freeze({
        topicId: target.topicId, title: target.title, surface: target.surface, polarity: "ACTIVE_TARGET" as const,
      })]),
      retrievalQuestions: Object.freeze([retrievalQuestion(namedOperation)]),
      responseDepth: depth,
      resolutionMethod: target.method,
      ambiguityReason: null,
      contextInherited: Boolean(state?.lastEligibleTopicIds.includes(target.topicId)),
      topicResolutionConfidence: target.confidence,
      candidateTopicIds: target.candidateTopicIds,
      previousAction: state?.lastEligiblePragmaticAction ?? null,
      previousFacets: Object.freeze([...(state?.lastEligibleRequestedFacets ?? state?.alreadyAnsweredFacets ?? [])]
        .filter((facet): facet is DnaS13RequestedFacet => typeof facet === "string")),
    })
  }
  if (named.length) return standalone(question, input.responseDepth, named)

  const operation = namedOperation
  if (operation === "standalone") return standalone(question, input.responseDepth)
  if (!state) return Object.freeze({ ...standalone(question, input.responseDepth), followUp: true, operation: "clarification_required", ambiguityReason: "no_eligible_context" })

  const compareTargets = operation === "compare_previous_targets" ? state.lastEligibleTopicIds.slice(0, 2) : []
  if (operation === "compare_previous_targets" && compareTargets.length !== 2) {
    return Object.freeze({ ...standalone(question, input.responseDepth), followUp: true,
      operation: "clarification_required", ambiguityReason: "comparison_context_requires_two_targets" })
  }
  const target = state.lastEligibleActiveTopicId || state.lastEligibleTopicIds.at(-1)!
  const contextualSimplifyTargets = operation === "simplify_same_topic"
    && state.lastEligiblePragmaticAction === "COMPARE"
    ? state.lastEligibleTopicIds.slice(0, 2)
    : []
  const inheritedTargets = compareTargets.length ? compareTargets
    : contextualSimplifyTargets.length ? contextualSimplifyTargets : [target]
  const depth = operation === "expand_same_topic" ? nextDepth(state.lastEligibleAnswerDepth)
    : operation === "simplify_same_topic" ? "short"
      : operation === "why_same_topic" || operation === "example_same_topic" ? "deep" : input.responseDepth
  return Object.freeze({
    version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
    originalQuestion: question,
    normalizedQuestion: normalized,
    operation,
    followUp: true,
    correction: false,
    targetSurface: getDnaOwnerBookTopicTitle(target),
    targetTopicIds: Object.freeze(inheritedTargets),
    topicMentions: Object.freeze(inheritedTargets.map((topicId) => Object.freeze({
      topicId,
      title: getDnaOwnerBookTopicTitle(topicId) ?? topicId,
      surface: null,
      polarity: "ACTIVE_TARGET" as const,
    }))),
    retrievalQuestions: Object.freeze(inheritedTargets.map(() => retrievalQuestion(operation))),
    responseDepth: depth,
    resolutionMethod: "conversation_referent",
    ambiguityReason: null,
    contextInherited: true,
    topicResolutionConfidence: "HIGH",
    candidateTopicIds: Object.freeze(inheritedTargets),
    previousAction: state.lastEligiblePragmaticAction ?? null,
    previousFacets: Object.freeze([...(state.lastEligibleRequestedFacets ?? state.alreadyAnsweredFacets ?? [])]
      .filter((facet): facet is DnaS13RequestedFacet => typeof facet === "string")),
  })
}

export function createDnaS13ConversationState(input: Readonly<{
  sessionId: string
  question: string
  normalizedQuestion: string
  responseDepth: DnaS13Depth
  queryFrame: DnaS13QueryFrame
  plan: DnaS13StrictPlan
  validationPassed: boolean
  privacyCategory: string
}>): DnaS13ConversationState | null {
  if (!input.validationPassed || input.privacyCategory !== "general_non_sensitive") return null
  const topicIds = [...new Set(input.queryFrame.subquestions.map((row) => row.topicId))]
    .filter(isDnaOwnerBookTopicId).slice(0, 2)
  if (!topicIds.length || topicIds.length !== input.queryFrame.subquestions.length) return null
  const slots = input.plan.slots.map((slot) => Object.freeze({
    id: slot.id,
    topicId: slot.topicId,
    questionType: slot.questionType,
    requiredClaimIds: Object.freeze([...slot.requiredClaimIds]),
    requestedFacet: slot.requestedFacet ?? null,
  }))
  const first = input.queryFrame.subquestions[0]!
  return Object.freeze({
    version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
    sessionId: input.sessionId,
    privacyCategory: "general_non_sensitive",
    lastEligibleTopicIds: Object.freeze(topicIds),
    lastEligibleFocus: first.focus,
    lastEligibleQuestionType: first.questionType,
    lastEligibleRequiredClaimIds: Object.freeze([...new Set(input.plan.slots.flatMap((slot) => slot.requiredClaimIds))]),
    lastEligibleLockedClaimIds: Object.freeze([...input.plan.lockedClaimIds]),
    lastEligibleAnswerSlots: Object.freeze(slots),
    lastEligibleNormalizedQuestion: input.normalizedQuestion,
    lastEligibleUserQuestion: input.question,
    lastEligibleAnswerDepth: input.responseDepth,
    lastEligibleComparisonSideA: topicIds.length === 2 ? topicIds[0]! : null,
    lastEligibleComparisonSideB: topicIds.length === 2 ? topicIds[1]! : null,
    lastEligibleComparisonConclusionMode: input.plan.comparisonConclusionMode ?? null,
    lastEligibleActiveTopicId: topicIds.at(-1)!,
    lastEligibleRejectedTopicIds: Object.freeze(input.plan.semanticOperationAudit?.targets
      .filter((target) => target.polarity === "REJECTED_TARGET").map((target) => target.topicId) ?? []),
    lastEligiblePragmaticAction: input.plan.pragmaticTaskFrame?.pragmaticAction ?? null,
    lastEligibleRequestedFacets: Object.freeze([...(input.plan.pragmaticTaskFrame?.requestedFacets ?? [])]),
    alreadyShownClaimIds: Object.freeze([...input.plan.lockedClaimIds].filter((claimId) => !claimId.startsWith("system."))),
    alreadyAnsweredFacets: Object.freeze([...(input.plan.facetEvidenceMatrix ?? [])
      .filter((entry) => entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
      .map((entry) => entry.facet)]),
    alreadyShownRelationIds: Object.freeze([...(input.plan.relationContracts ?? []).map((relation) => relation.id)]),
  })
}

export function dnaS13ContextOperationHasVerifiedSupport(operation: DnaS13ContextOperation, match: DnaOwnerBookMatch) {
  const text = normalizeDnaChatText([match.summary, ...match.details].join(" "))
  if (operation === "example_same_topic") return /\b(?:ornek|ornegin|gunluk yasam|mesela)\b/u.test(text)
  if (operation === "why_same_topic") return /\b(?:cunku|bu nedenle|nedeniyle|ilisk|etkil|katki|rol|onem)\w*/u.test(text)
  return true
}

export function isDnaS13ConversationStateForSession(state: DnaS13ConversationState | null, sessionId: string) {
  return Boolean(state && state.sessionId === sessionId && state.privacyCategory === "general_non_sensitive")
}
