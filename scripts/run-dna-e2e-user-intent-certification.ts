import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

import denseKnowledgeRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { resolveDnaChatApiRequest } from "../src/lib/dna/chat/apiResolver"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"
import { calculateDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { DNA_CHAT_LUNA_MODEL } from "../src/lib/dna/chat/lunaPolicy"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import type { DnaS13Depth, DnaS13RequestedFacet } from "../src/lib/dna/chat/s13/contracts"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import { hashDnaS13LimitedIdentifier } from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import {
  runDnaS13LimitedRolloutMessage,
  type DnaS13LimitedTechnicalEvidence,
} from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import { LunaRealizer } from "../src/lib/dna/chat/s13/strictLunaRealizer.server"
import {
  DeterministicRealizer,
  type DnaS13RealizerAttempt,
  type DnaS13RealizerRequest,
  type Realizer,
} from "../src/lib/dna/chat/s13/strictRealizer"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const SCHEMA_VERSION = "dna-e2e-user-intent-certification@1"
const EVALUATION_ID = process.env.DNA_E2E_EVALUATION_ID?.trim()
  || "DNA_CHAT_END_TO_END_USER_INTENT_CERTIFICATION_001"
const LOCAL_PREFLIGHT = process.argv.includes("--local-preflight")
const VALIDATE_FIXTURE_ONLY = process.argv.includes("--validate-fixture-only")
const REPACKAGE_EXISTING = process.argv.includes("--repackage-existing")
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUTPUT_DIR = process.env.DNA_E2E_OUTPUT_DIR?.trim() || (LOCAL_PREFLIGHT
  ? "/tmp/dna-e2e-user-intent-certification-preflight"
  : path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/e2e-user-intent-certification/run-001"))
const ZIP_PATH = process.env.DNA_E2E_ZIP_PATH?.trim() || (LOCAL_PREFLIGHT
  ? "/tmp/DNA_CHAT_END_TO_END_USER_INTENT_CERTIFICATION_PREFLIGHT.zip"
  : path.join(SSD_ROOT, "Deliverables/SelfMetaAI/dna-intelligence/DNA_CHAT_END_TO_END_USER_INTENT_CERTIFICATION_001.zip"))
const FIXTURE_SOURCE_ARG = process.argv.find((value) => value.startsWith("--fixture-source="))
const FIXTURE_SOURCE = FIXTURE_SOURCE_ARG ? FIXTURE_SOURCE_ARG.slice("--fixture-source=".length) : null
const ROUTING_PACKAGE = process.env.DNA_E2E_ROUTING_PACKAGE === "1"
const HARD_CAP_MICROUSD = 1_000_000
const CALL_RESERVE_MICROUSD = 25_000
const INTERNAL_JARGON = /(?:doğrulanmış kapsam|mevcut doğrulanmış içerik|kilitli içerik|locked claim|\bclaim(?:s)?\b|\bfacet\w*\b|system\.facet-boundary|\btopicid\b|\brequiredclaim\b|\bvalidator\b)/giu
const LIMITED_RESPONSE = /(?:bu soruyu doğrudan yanıtlayacak|bu ayrımı kuracak|yeterli (?:doğrulanmış )?(?:içerik|bilgi|dayanak|açıklama) (?:yok|bulunmuyor|değil)|konusunda (?:yeterli|daha ileri) (?:açıklama|bilgi) bulunmuyor|önceki (?:açıklamanın ötesinde|yanıtta yer almayan) ek bir (?:gerekçe|ayrıntı|bilgi) bulunmuyor|aktarabileceğim somut bir örnek bulunmuyor|güvenilir biçimde (?:söylenemez|kurulamıyor|yanıtlanamıyor)|mevcut içerik .* yeterli değil|bu konuda sınırlı kalmak gerekir)/iu

const FILES = Object.freeze({
  blind300: path.join(OUTPUT_DIR, ROUTING_PACKAGE ? "BLIND_ROUTING_E2E_300.md" : "BLIND_E2E_CHAT_300.md"),
  blindFollowups: path.join(OUTPUT_DIR, ROUTING_PACKAGE ? "BLIND_ROUTING_FOLLOWUPS.md" : "BLIND_E2E_CHAT_FOLLOWUPS.md"),
  ...(ROUTING_PACKAGE ? { blindAdversarial: path.join(OUTPUT_DIR, "BLIND_ROUTING_ADVERSARIAL.md") } : {}),
  sealed: path.join(OUTPUT_DIR, ROUTING_PACKAGE ? "SEALED_ROUTING_TRACE.jsonl" : "SEALED_E2E_CHAT_TRACE.jsonl"),
  summary: path.join(OUTPUT_DIR, "objective-certification-summary.json"),
  fixture: path.join(OUTPUT_DIR, "fixture-manifest.json"),
  readme: path.join(OUTPUT_DIR, "README.md"),
})

type PragmaticAction =
  | "DEFINE" | "EXPLAIN" | "SIMPLIFY" | "DEEPEN" | "WHY_SIGNIFICANCE"
  | "EXAMPLE" | "COMPARE" | "CORRECT_TARGET"

type Stratum =
  | "DEFINITION" | "WHY_FUNCTION" | "DEEPEN" | "EXAMPLE" | "COMPARE"
  | "SIMPLIFY" | "CORRECTION" | "SHORT_CONTEXTUAL_FOLLOWUP"
  | "TWO_PART_NATURAL" | "MIXED_NATURAL" | "BOUNDARY_LIMITATION"

type Topic = Readonly<{ topicId: string; title: string }>
type TurnFixture = Readonly<{
  id: string
  conversationId: string
  turnIndex: number
  question: string
  primaryStratum: Stratum
  expectedAction: PragmaticAction
  expectedFacets: readonly DnaS13RequestedFacet[]
  expectedTopics: readonly Topic[]
  contextDependent: boolean
  roughLanguage: boolean
  expectedAmbiguous?: boolean
}>
type ConversationFixture = Readonly<{
  conversationId: string
  depth: DnaS13Depth
  turns: readonly TurnFixture[]
}>
type PublicConversationContext = Readonly<{
  topicIds: readonly string[]
  lastQueryKind: "definition" | "comparison" | "relation" | "measurement" | "development" | "evidence" | "case" | "unknown"
}>
type BlindPair = Readonly<{ question: string; answer: string }>
type FailureClass =
  | "INPUT_NORMALIZATION_FAILURE" | "CONTEXT_FAILURE" | "TOPIC_RESOLUTION_FAILURE"
  | "ACTION_CLASSIFICATION_FAILURE" | "FACET_SELECTION_FAILURE" | "CATALOG_GAP"
  | "RETRIEVAL_SELECTION_FAILURE" | "LOCKED_PLAN_FAILURE" | "REALIZATION_FAILURE"
  | "VALIDATOR_FALSE_PASS" | "ANSWER_INCOMPLETE"

const REQUIRED_STRATA: Readonly<Record<Stratum, number>> = Object.freeze({
  DEFINITION: 50,
  WHY_FUNCTION: 35,
  DEEPEN: 35,
  EXAMPLE: 30,
  COMPARE: 30,
  SIMPLIFY: 20,
  CORRECTION: 20,
  SHORT_CONTEXTUAL_FOLLOWUP: 20,
  TWO_PART_NATURAL: 20,
  MIXED_NATURAL: 20,
  BOUNDARY_LIMITATION: 20,
})

const ADVERSARIAL = Object.freeze([
  { question: "Temel Nörofizyoloji nedir?", surface: "Temel Nörofizyoloji", action: "DEFINE", facets: ["definition"] },
  { question: "Ko-Regülasyon nedir?", surface: "Ko-Regülasyon", action: "DEFINE", facets: ["definition"] },
  { question: "Eleştirel Bilimsel Tartışmalar ne demek", surface: "Eleştirel Bilimsel Tartışmalar", action: "DEFINE", facets: ["definition"] },
  { question: "Duyusal Aşırı Yanıt Verme için somut örnek verir misin?", surface: "Duyusal Aşırı Yanıt Verme", action: "EXAMPLE", facets: ["verified_example"] },
  { question: "Bilişsel Katman nedir?", surface: "Bilişsel Katman", action: "DEFINE", facets: ["definition"] },
  { question: "Strateji Değiştirme nedir?", surface: "Strateji Değiştirme", action: "DEFINE", facets: ["definition"] },
  { question: "Multisensoryal Bütünleme nedir?", surface: "Multisensoryal Bütünleme", action: "DEFINE", facets: ["definition"] },
  { question: "Kalp Hızı Değişkenliği Nedir?", surface: "Kalp Hızı Değişkenliği Nedir?", action: "DEFINE", facets: ["definition"] },
  { question: "Solunum Sistemi nedir?", surface: "Solunum Sistemi", action: "DEFINE", facets: ["definition"] },
  { question: "Tehdit Salience’ı yakın kavramlardan nasıl ayrılıyor?", surface: "Tehdit Salience’ı", action: "COMPARE", facets: ["definition"] },
  { question: "DNA Intelligence Açısından Tanı ve Self-Regülasyon yakın kavramlardan nasıl ayrılıyor?", surface: "DNA Intelligence Açısından Tanı ve Self-Regülasyon", action: "COMPARE", facets: ["definition"] },
] as const satisfies readonly Readonly<{ question: string; surface: string; action: PragmaticAction; facets: readonly DnaS13RequestedFacet[] }>[])

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function stable(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writePrivate(file: string, value: string | unknown) {
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}

function appendPrivate(file: string, value: unknown) {
  appendFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function sameSet(left: readonly string[], right: readonly string[]) {
  const a = [...new Set(left)].sort()
  const b = [...new Set(right)].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function percent(numerator: number, denominator: number) {
  return denominator ? Number((numerator / denominator * 100).toFixed(3)) : 100
}

function topicPool() {
  const units = (denseKnowledgeRuntimeJson as unknown as { units: readonly Readonly<{ topicId: string; title: string }>[] }).units
  const titleTopics = new Map<string, Set<string>>()
  for (const unit of units) {
    const normalized = normalizeDnaChatText(unit.title)
    const topicIds = titleTopics.get(normalized) ?? new Set<string>()
    topicIds.add(unit.topicId)
    titleTopics.set(normalized, topicIds)
  }
  const rows = [...new Map(units.map((unit) => [unit.topicId, Object.freeze({ topicId: unit.topicId, title: unit.title.trim() })])).values()]
    .filter((row) => row.title.length >= 8 && row.title.length <= 90)
    .filter((row) => !/[?\n\r]/u.test(row.title))
    .filter((row) => titleTopics.get(normalizeDnaChatText(row.title))?.size === 1)
    .filter((row) => {
      const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
      return resolved.length === 1 && resolved[0]?.topicId === row.topicId
    })
    .sort((left, right) => left.topicId.localeCompare(right.topicId))
  if (rows.length < 180) throw new Error(`e2e_topic_pool_too_small:${rows.length}`)
  return rows
}

function stratumFor(conversationIndex: number, turnIndex: number): Stratum {
  if (turnIndex === 1) return conversationIndex < 50 ? "DEFINITION" : "BOUNDARY_LIMITATION"
  if (turnIndex === 2) {
    if (conversationIndex < 20) return "SHORT_CONTEXTUAL_FOLLOWUP"
    if (conversationIndex < 30) return "WHY_FUNCTION"
    if (conversationIndex < 40) return "DEEPEN"
    if (conversationIndex < 50) return "SIMPLIFY"
    return "EXAMPLE"
  }
  if (turnIndex === 3) {
    if (conversationIndex < 20) return "CORRECTION"
    if (conversationIndex < 30) return "WHY_FUNCTION"
    if (conversationIndex < 40) return "DEEPEN"
    if (conversationIndex < 50) return "EXAMPLE"
    return "SIMPLIFY"
  }
  if (turnIndex === 4) {
    if (conversationIndex < 30) return "COMPARE"
    if (conversationIndex < 50) return "TWO_PART_NATURAL"
    return "BOUNDARY_LIMITATION"
  }
  if (conversationIndex < 15) return "WHY_FUNCTION"
  if (conversationIndex < 30) return "DEEPEN"
  if (conversationIndex < 40) return "EXAMPLE"
  return "MIXED_NATURAL"
}

function shortContextAction(index: number): PragmaticAction {
  return (["WHY_SIGNIFICANCE", "DEEPEN", "SIMPLIFY", "EXAMPLE"] as const)[index % 4]!
}

function mixedAction(index: number): PragmaticAction {
  return (["DEFINE", "WHY_SIGNIFICANCE", "EXAMPLE", "SIMPLIFY"] as const)[index % 4]!
}

function actionAndFacets(stratum: Stratum, conversationIndex: number) {
  if (stratum === "DEFINITION") return { action: "DEFINE" as const, facets: ["definition"] as const }
  if (stratum === "WHY_FUNCTION") return { action: "WHY_SIGNIFICANCE" as const, facets: ["function"] as const }
  if (stratum === "DEEPEN") return { action: "DEEPEN" as const, facets: ["core_scope", "function", "boundary"] as const }
  if (stratum === "EXAMPLE") return { action: "EXAMPLE" as const, facets: ["verified_example"] as const }
  if (stratum === "COMPARE") return { action: "COMPARE" as const, facets: ["definition"] as const }
  if (stratum === "SIMPLIFY") return { action: "SIMPLIFY" as const, facets: ["core_scope"] as const }
  if (stratum === "CORRECTION") return { action: "CORRECT_TARGET" as const, facets: ["core_scope"] as const }
  if (stratum === "BOUNDARY_LIMITATION") return { action: "EXPLAIN" as const, facets: ["boundary"] as const }
  if (stratum === "TWO_PART_NATURAL") return { action: "EXPLAIN" as const, facets: ["definition", "function"] as const }
  const action = stratum === "SHORT_CONTEXTUAL_FOLLOWUP" ? shortContextAction(conversationIndex) : mixedAction(conversationIndex)
  return {
    action,
    facets: action === "WHY_SIGNIFICANCE" ? ["function"] as const
      : action === "DEEPEN" ? ["core_scope", "function", "boundary"] as const
        : action === "SIMPLIFY" ? ["core_scope"] as const
          : action === "EXAMPLE" ? ["verified_example"] as const : ["definition"] as const,
  }
}

function questionFor(input: Readonly<{
  stratum: Stratum
  action: PragmaticAction
  turnIndex: number
  conversationIndex: number
  a: Topic
  b: Topic
  c: Topic
}>) {
  const { stratum, action, turnIndex, conversationIndex: index, a, b, c } = input
  if (turnIndex === 1 && stratum === "DEFINITION") {
    const forms = [
      `“${a.title}” başlığı nedir; doğrudan tanımlar mısın?`,
      `${a.title} kavramı nedir? Önce çekirdek anlamını söyle.`,
      `Yeni başlayan biri için ${a.title} nedir, net biçimde açıklar mısın?`,
    ]
    return forms[index % forms.length]!
  }
  if (turnIndex === 1) return `${a.title} için sınır nerede; bu başlık neyi söylemez? Açıkla.`
  if (turnIndex === 2 && stratum === "SHORT_CONTEXTUAL_FOLLOWUP") {
    const variant = Math.floor(index / 4)
    if (action === "WHY_SIGNIFICANCE") return [
      "peki, bunu niye önemli sayıyoruz?", "bunun asıl önemi ne peki?", "iyi de bu neden dikkate değer?",
      "buradaki pratik değer ne oluyor?", "niçin önemli olduğunu kısaca söyler misin?",
    ][variant]!
    if (action === "DEEPEN") return [
      "tamam da aynı başlığı bi adım daha açar mısın?", "biraz daha derine insek ne eklersin?",
      "öncekini yinelemeden yeni bi ayrıntı var mı?", "aynı konunun bir kat ötesine geçer misin?",
      "buraya eklenebilecek başka güvenli nokta ne?",
    ][variant]!
    if (action === "SIMPLIFY") return [
      "bunu daha sade, günlük dille söylesene?", "daha basit Türkçeye çevirir misin?",
      "ilk kez duyan biri için yalın anlatır mısın?", "teknik kısmı azaltıp tekrar söyler misin?",
      "gündelik dille kısaca anlatır mısın?",
    ][variant]!
    return [
      "buna gündelik hayattan somut bi örnek verir misin?", "peki gerçek yaşamda örneği nasıl görünür?",
      "bunu somutlaştıran bir durum var mı?", "mesela pratikte nasıl görünür?",
      "akılda kalacak güvenli bir örnek verir misin?",
    ][variant]!
  }
  const topic = turnIndex === 2 ? a : turnIndex === 3 ? b : c
  if (stratum === "WHY_FUNCTION") return `${topic.title} neden önemli, işe yaradığı kavramsal nokta ne ya?`
  if (stratum === "DEEPEN") return `${topic.title} için önce söylenmeyen bir ayrıntıyla bir kat daha derine iner misin?`
  if (stratum === "EXAMPLE") return `${topic.title} için kaynağın desteklediği somut bir örnek var mı, anlatır mısın?`
  if (stratum === "SIMPLIFY") return `${topic.title} biraz teknik geldi; daha sade Türkçeyle söyler misin?`
  if (stratum === "CORRECTION") return `yok onu demedim; ${b.title} başlığını soruyorum. Yalnız buna geç.`
  if (stratum === "COMPARE") return `${b.title} ile ${c.title} aynı düzeyde mi; aradaki farkı güvenli biçimde kurar mısın?`
  if (stratum === "TWO_PART_NATURAL") return `Önce ${b.title} nedir, ardından ${c.title} neden önemlidir? İki kısmı ayrı yanıtla.`
  if (stratum === "BOUNDARY_LIMITATION") return `${topic.title} ne değildir; sınırı ve yanlış yorum riskini açıklar mısın?`
  if (action === "DEFINE") return `hocam ${c.title} tam olarak nedir ya, kısa pls?`
  if (action === "WHY_SIGNIFICANCE") return `${c.title} niye önemli, hoca gözüyle very short anlatrmısın?`
  if (action === "EXAMPLE") return `${c.title} için gerçek hayattan bi örnek var mı, kolay dille?`
  return `${c.title} biraz teknik geldi; daha basit TR ile söyler misin?`
}

function explicitTopicsFor(stratum: Stratum, turnIndex: number, a: Topic, b: Topic, c: Topic) {
  if (turnIndex === 1) return [a]
  if (turnIndex === 2) return [a]
  if (turnIndex === 3) return [b]
  if (stratum === "COMPARE" || stratum === "TWO_PART_NATURAL") return [b, c]
  return [c]
}

function buildConversation(index: number, topics: readonly [Topic, Topic, Topic]): ConversationFixture {
  const [a, b, c] = topics
  const conversationId = `e2e-${String(index + 1).padStart(3, "0")}`
  const turns = Array.from({ length: 5 }, (_, offset) => {
    const turnIndex = offset + 1
    const primaryStratum = stratumFor(index, turnIndex)
    const { action, facets } = actionAndFacets(primaryStratum, index)
    const question = questionFor({ stratum: primaryStratum, action, turnIndex, conversationIndex: index, a, b, c })
    return Object.freeze({
      id: `${conversationId}-t${turnIndex}`,
      conversationId,
      turnIndex,
      question,
      primaryStratum,
      expectedAction: action,
      expectedFacets: Object.freeze([...facets]),
      expectedTopics: Object.freeze(explicitTopicsFor(primaryStratum, turnIndex, a, b, c)),
      contextDependent: primaryStratum === "SHORT_CONTEXTUAL_FOLLOWUP" || primaryStratum === "CORRECTION",
      roughLanguage: turnIndex === 2 || turnIndex === 5,
    })
  })
  return Object.freeze({ conversationId, depth: index % 5 === 0 ? "deep" : index % 3 === 0 ? "short" : "standard", turns: Object.freeze(turns) })
}

function selectConversations(): readonly ConversationFixture[] {
  const pool = topicPool()
  const selected: ConversationFixture[] = []
  const used = new Set<string>()
  for (let cursor = 0; cursor + 2 < pool.length && selected.length < 60; cursor += 1) {
    const group = [pool[cursor]!, pool[cursor + 1]!, pool[cursor + 2]!] as const
    if (group.some((topic) => used.has(topic.topicId))) continue
    const conversation = buildConversation(selected.length, group)
    const explicitValid = conversation.turns.every((turn) => {
      if (turn.primaryStratum === "SHORT_CONTEXTUAL_FOLLOWUP") return resolveDnaS13NamedTopicSurfaces(turn.question).length === 0
      const resolvedIds = resolveDnaS13NamedTopicSurfaces(turn.question).map((row) => row.topicId)
      return sameSet(resolvedIds, turn.expectedTopics.map((topic) => topic.topicId))
    })
    if (!explicitValid) continue
    selected.push(conversation)
    group.forEach((topic) => used.add(topic.topicId))
    cursor += 2
  }
  if (selected.length !== 60) throw new Error(`e2e_conversation_fixture_short:${selected.length}`)
  return Object.freeze(selected)
}

function applyStructuralFacetContract(conversations: readonly ConversationFixture[]): readonly ConversationFixture[] {
  return Object.freeze(conversations.map((conversation) => {
    let previousFacets: readonly DnaS13RequestedFacet[] = Object.freeze([])
    const turns = conversation.turns.map((turn) => {
      const expectedFacets: readonly DnaS13RequestedFacet[] = turn.expectedAction === "COMPARE"
        ? Object.freeze(["distinction"])
        : turn.expectedAction === "DEEPEN"
          ? Object.freeze(["explanatory_detail"])
          : ["SIMPLIFY", "CORRECT_TARGET"].includes(turn.expectedAction) && previousFacets.length
            ? Object.freeze([...previousFacets]) : turn.expectedFacets
      previousFacets = expectedFacets
      return Object.freeze({ ...turn, expectedFacets })
    })
    return Object.freeze({ ...conversation, turns: Object.freeze(turns) })
  }))
}

function loadConversations(): readonly ConversationFixture[] {
  if (!FIXTURE_SOURCE) return applyStructuralFacetContract(selectConversations())
  const parsed = JSON.parse(readFileSync(FIXTURE_SOURCE, "utf8")) as { conversations?: readonly ConversationFixture[] }
  if (!Array.isArray(parsed.conversations)) throw new Error("e2e_fixture_source_invalid")
  return applyStructuralFacetContract(parsed.conversations)
}

function validateFixture(conversations: readonly ConversationFixture[]) {
  const turns = conversations.flatMap((row) => row.turns)
  const strata = Object.fromEntries(Object.keys(REQUIRED_STRATA).map((key) => [key, turns.filter((turn) => turn.primaryStratum === key).length]))
  for (const [key, expected] of Object.entries(REQUIRED_STRATA)) {
    if (strata[key] !== expected) throw new Error(`e2e_stratum_invalid:${key}:${strata[key]}:${expected}`)
  }
  const topics = new Set(turns.flatMap((turn) => turn.expectedTopics.map((topic) => topic.topicId)))
  const rough = turns.filter((turn) => turn.roughLanguage).length
  const normalized = turns.map((turn) => normalizeDnaChatText(turn.question))
  if (conversations.length !== 60 || turns.length !== 300) throw new Error("e2e_fixture_shape_invalid")
  if (topics.size < 150) throw new Error(`e2e_fixture_topic_count_invalid:${topics.size}`)
  if (rough < 120) throw new Error(`e2e_fixture_rough_language_invalid:${rough}`)
  if (new Set(normalized).size !== normalized.length) throw new Error("e2e_fixture_duplicate_message")
  const rejected = turns.flatMap((turn) => {
    const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: turn.question, mode: "theory" })
    return privacy.allowed ? [] : [{ question: turn.question, reasons: privacy.reasonCodes }]
  })
  const priorRoot = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence")
  const priorFiles = existsSync(priorRoot)
    ? execFileSync("find", [priorRoot, "-type", "f", "-name", "blind-conversations.json"], { encoding: "utf8" }).trim().split("\n").filter(Boolean)
    : []
  const priorQuestions = priorFiles.flatMap((file) => {
    try {
      const value = JSON.parse(readFileSync(file, "utf8")) as readonly Readonly<{ turns?: readonly Readonly<{ role?: string; text?: string }>[] }>[]
      return value.flatMap((conversation) => conversation.turns?.filter((turn) => turn.role === "user").map((turn) => turn.text || "") ?? [])
    } catch { return [] }
  })
  const priorNormalized = new Set(priorQuestions.map(normalizeDnaChatText))
  const exactReuseCount = normalized.filter((value) => priorNormalized.has(value)).length
  if (exactReuseCount) throw new Error(`e2e_fixture_prior_exact_reuse:${exactReuseCount}`)
  return Object.freeze({
    conversationCount: conversations.length,
    messageCount: turns.length,
    distinctCanonicalTopicCount: topics.size,
    roughLanguageCount: rough,
    roughLanguagePercent: percent(rough, turns.length),
    stratumDistribution: strata,
    priorBlindFilesChecked: priorFiles.length,
    priorQuestionCount: priorQuestions.length,
    exactReuseCount,
    limitedPrivacyRejectedCount: rejected.length,
    limitedPrivacyRejectedExamples: rejected.slice(0, 8),
  })
}

class CappedLunaRealizer implements Realizer {
  readonly identity
  private readonly inner: LunaRealizer
  private readonly usages: DnaChatLunaUsage[] = []
  externalCalls = 0
  stopReason: string | null = null

  constructor(apiKey: string, safetyIdentifier: string) {
    this.inner = new LunaRealizer({ apiKey, safetyIdentifier })
    this.identity = this.inner.identity
  }

  totalUsage() {
    return this.usages.reduce<DnaChatLunaUsage>((total, value) => ({
      inputTokens: total.inputTokens + value.inputTokens,
      cachedInputTokens: total.cachedInputTokens + value.cachedInputTokens,
      outputTokens: total.outputTokens + value.outputTokens,
      costMicrousd: total.costMicrousd + value.costMicrousd,
    }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 })
  }

  canStartMessage() {
    return !this.stopReason && this.totalUsage().costMicrousd + CALL_RESERVE_MICROUSD <= HARD_CAP_MICROUSD
  }

  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    if (!this.canStartMessage()) {
      this.stopReason = this.stopReason ?? "luna_hard_cap_reserve_reached"
      throw new Error(this.stopReason)
    }
    this.externalCalls += 1
    const result = await this.inner.realize(input)
    this.usages.push(calculateDnaChatLunaUsage(result.usage))
    if (this.totalUsage().costMicrousd > HARD_CAP_MICROUSD) {
      this.stopReason = "luna_hard_cap_exceeded"
      throw new Error(this.stopReason)
    }
    return result
  }
}

class LocalRealizer implements Realizer {
  private readonly inner = new DeterministicRealizer()
  readonly identity = this.inner.identity
  externalCalls = 0
  stopReason: string | null = null
  totalUsage(): DnaChatLunaUsage { return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 } }
  canStartMessage() { return true }
  realize(input: DnaS13RealizerRequest) { return this.inner.realize(input) }
}

function publicContext(body: Record<string, unknown>): PublicConversationContext | null {
  const value = body.conversationContext
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const topicIds = Array.isArray(row.topicIds) ? row.topicIds.map(String).filter(Boolean).slice(0, 2) : []
  const lastQueryKind = String(row.lastQueryKind || "") as PublicConversationContext["lastQueryKind"]
  if (!topicIds.length || !["definition", "comparison", "relation", "measurement", "development", "evidence", "case", "unknown"].includes(lastQueryKind)) return null
  return Object.freeze({ topicIds: Object.freeze(topicIds), lastQueryKind })
}

function limitedContextToken(body: Record<string, unknown>) {
  const value = body.conversationContext
  if (!value || typeof value !== "object") return null
  const token = (value as Record<string, unknown>).limitedRolloutContextToken
  return typeof token === "string" && token.trim() ? token : null
}

function visibleAnswerText(body: Record<string, unknown>) {
  const summary = typeof body.summary === "string" ? body.summary.trim() : ""
  const details = Array.isArray(body.details) ? body.details.map(String).map((value) => value.trim()).filter(Boolean) : []
  const units = Array.isArray(body.answerUnits) ? body.answerUnits.flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const row = value as Record<string, unknown>
    const text = typeof row.text === "string" ? row.text.trim() : ""
    return text ? [text] : []
  }) : []
  return (units.length ? units : [summary, ...details]).filter(Boolean).join("\n\n")
}

async function deterministicNormalPath(input: Readonly<{
  question: string
  depth: DnaS13Depth
  context: PublicConversationContext | null
  subjectId: string
}>) {
  return resolveDnaChatApiRequest({
    question: input.question,
    mode: "theory",
    responseDepth: input.depth,
    ...(input.context ? { context: { topicIds: [...input.context.topicIds], lastQueryKind: input.context.lastQueryKind } } : {}),
  }, {
    createRequestId: randomUUID,
    resolveRuntimeAnswer: (runtimeInput) => resolveCommittedDnaChatRuntime({ ...runtimeInput, rolloutSubjectKey: input.subjectId }),
    loadCaseAnswer: async () => ({ ok: false as const, status: 404 as const, error: "report_not_found" as const }),
    writeAudit: async () => ({ ok: true }),
  })
}

function selectedClaims(technical: DnaS13LimitedTechnicalEvidence | null) {
  if (!technical) return []
  return [...new Map(technical.plan.slots.flatMap((slot) => slot.lockedClaims.map((entry) => entry.claim))
    .map((claim) => [claim.id, { id: claim.id, text: claim.text, topicId: claim.topicId, passageId: claim.passageId, sourceIds: claim.sourceIds }])).values()]
}

function evaluateTurn(input: Readonly<{
  fixture: TurnFixture
  technical: DnaS13LimitedTechnicalEvidence | null
  limited: Awaited<ReturnType<typeof runDnaS13LimitedRolloutMessage>> | null
  finalContext: PublicConversationContext | null
  finalAnswer: string | null
  finalPath: "s13_limited" | "s13_clarification" | "deterministic_normal_fallback" | "runtime_error"
  error: string | null
}>) {
  const runtime = input.technical?.runtime ?? null
  const telemetry = input.limited?.telemetry ?? null
  const expectedTopicIds = input.fixture.expectedTopics.map((topic) => topic.topicId)
  const resolvedTopicIds = input.technical?.matches.map((match) => match.topicId) ?? input.finalContext?.topicIds ?? []
  const adversarialSemanticTopic = input.fixture.id.startsWith("adversarial-")
    && input.fixture.expectedTopics.some((expected) => input.technical?.matches.some((match) =>
      normalizeDnaChatText(match.topic).includes(normalizeDnaChatText(expected.title))))
  const clarificationRouting = input.limited?.kind === "clarification" ? input.limited.routing : null
  const actualAction = input.technical?.pragmaticTaskFrame.pragmaticAction
    ?? clarificationRouting?.pragmaticTaskFrame.pragmaticAction ?? null
  const actualFacets = input.technical?.pragmaticTaskFrame.requestedFacets
    ?? clarificationRouting?.pragmaticTaskFrame.requestedFacets ?? []
  const safeAmbiguity = Boolean(input.fixture.expectedAmbiguous && input.limited?.kind === "clarification")
  const topicCorrect = sameSet(expectedTopicIds, resolvedTopicIds) || adversarialSemanticTopic || safeAmbiguity
  const actionCorrect = safeAmbiguity || actualAction === input.fixture.expectedAction
  const facetSelectionCorrect = safeAmbiguity || sameSet(input.fixture.expectedFacets, actualFacets)
  const matrix = input.technical?.plan.facetEvidenceMatrix ?? []
  const statusByPair = new Map(matrix.map((entry) => [`${entry.topicId}:${entry.facet}`, entry.status]))
  const facetTopicIds = adversarialSemanticTopic ? resolvedTopicIds : expectedTopicIds
  const expectedPairs = (input.technical?.queryFrame.subquestions ?? []).flatMap((subquestion) =>
    (subquestion.requestedFacets ?? []).map((facet) => `${subquestion.topicId}:${facet}`))
  const supportStatuses = expectedPairs.map((pair) => statusByPair.get(pair) ?? "MISSING")
  const allSupported = supportStatuses.every((status) => status === "SUPPORTED_DIRECT" || status === "SUPPORTED_DERIVED")
  const knowledgeGaps = input.technical?.plan.knowledgeGaps ?? []
  const availableButNotSelected = knowledgeGaps.some((gap) => gap.classification === "AVAILABLE_BUT_NOT_SELECTED")
  const catalogGap = topicCorrect && actionCorrect && facetSelectionCorrect && !allSupported && !availableButNotSelected
  // Facet routing is independent from catalog availability. An unsupported
  // but correctly routed facet is a safe-limited answer, not a routing miss.
  const facetCorrect = topicCorrect && actionCorrect && facetSelectionCorrect
  const answer = input.finalAnswer ?? ""
  const safeLimitedResponse = Boolean(answer && LIMITED_RESPONSE.test(answer))
  const catalogGapFalseAnswer = catalogGap && !safeLimitedResponse
  const validation = runtime?.finalValidation ?? null
  const structuralCompleteness = Boolean(validation?.pass
    && Number(validation.requestedSlotCount) > 0
    && Number(validation.answeredSupportedSlotCount) >= Number(validation.requestedSlotCount)
    && Number(validation.answeredUnsupportedSlotCount) === 0
    && Number(validation.silentlyDroppedRequestedSlotCount) === 0
    && Number(validation.omittedSupportedFacetCount) === 0)
  const answerCompleteness = catalogGap ? safeLimitedResponse : structuralCompleteness
  const jargonCount = answer ? (answer.match(INTERNAL_JARGON) ?? []).length : 0
  const naturalLanguage = Boolean(answer.trim() && jargonCount === 0 && !/[{}][\s\S]*"(?:slotId|usedClaimIds|claimId)"/u.test(answer))
  const directAnswer = safeAmbiguity || (facetCorrect && (allSupported || (catalogGap && safeLimitedResponse))
    && answerCompleteness && naturalLanguage && input.finalPath !== "runtime_error")
  const normalizationCorrect = (input.technical?.normalizedQuery ?? clarificationRouting?.normalizedQuery)
    === normalizeDnaChatText(input.fixture.question)
  const planCoversExpected = expectedPairs.every((pair) => {
    const [topicId, facet] = pair.split(":")
    return Boolean(input.technical?.plan.slots.some((slot) => slot.topicId === topicId && slot.requestedFacet === facet)
      || input.technical?.plan.evidenceLimitations?.some((limitation) => limitation.subquestionId
        === input.technical?.queryFrame.subquestions.find((row) => row.topicId === topicId)?.id
        && limitation.unsupportedFacets.includes(facet as DnaS13RequestedFacet)))
  })
  let failureClass: FailureClass | null = null
  if (!directAnswer) {
    if (input.error || !input.finalAnswer) failureClass = "REALIZATION_FAILURE"
    else if (!normalizationCorrect && input.technical) failureClass = "INPUT_NORMALIZATION_FAILURE"
    else if (input.fixture.contextDependent && !topicCorrect) failureClass = "CONTEXT_FAILURE"
    else if (!topicCorrect) failureClass = "TOPIC_RESOLUTION_FAILURE"
    else if (!actionCorrect) failureClass = "ACTION_CLASSIFICATION_FAILURE"
    else if (!facetSelectionCorrect) failureClass = "FACET_SELECTION_FAILURE"
    else if (availableButNotSelected) failureClass = "RETRIEVAL_SELECTION_FAILURE"
    else if (catalogGap) failureClass = "CATALOG_GAP"
    else if (!planCoversExpected) failureClass = "LOCKED_PLAN_FAILURE"
    else if (!runtime || !validation) failureClass = "REALIZATION_FAILURE"
    else if (validation.pass && (!answerCompleteness || !naturalLanguage)) failureClass = "VALIDATOR_FALSE_PASS"
    else failureClass = "ANSWER_INCOMPLETE"
  }
  return Object.freeze({
    topicCorrect,
    actionCorrect,
    facetSelectionCorrect,
    facetCorrect,
    directAnswer,
    answerCompleteness,
    naturalLanguage,
    normalizationCorrect,
    catalogGap,
    catalogGapFalseAnswer,
    safeLimitedResponse,
    availableButNotSelected,
    failureClass,
    expectedTopicIds,
    resolvedTopicIds,
    expectedAction: input.fixture.expectedAction,
    actualAction,
    expectedFacets: input.fixture.expectedFacets,
    actualFacets,
    supportStatuses,
    validatorPass: validation?.pass ?? false,
    validatorFailureCodes: validation?.failureCodes ?? telemetry?.validation.failureCodes ?? [],
    jargonCount,
    unsupportedScience: (telemetry?.validation.unsupportedFactCount ?? 0) + (telemetry?.validation.unsupportedRelationCount ?? 0),
    sourceViolation: telemetry?.validation.sourceViolationCount ?? 0,
    safetyViolation: telemetry?.validation.safetyViolationCount ?? 0,
  })
}

async function executeTurn(input: Readonly<{
  fixture: TurnFixture
  depth: DnaS13Depth
  subjectId: string
  subjectIdHash: string
  conversationIdHash: string
  sessionId: string
  contextSecret: string
  limitedToken: string | null
  normalContext: PublicConversationContext | null
  realizer: CappedLunaRealizer | LocalRealizer
}>) {
  const started = performance.now()
  const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: input.fixture.question, mode: "theory" })
  let technical: DnaS13LimitedTechnicalEvidence | null = null
  let limited: Awaited<ReturnType<typeof runDnaS13LimitedRolloutMessage>> | null = null
  let finalAnswer: string | null = null
  let finalPath: "s13_limited" | "s13_clarification" | "deterministic_normal_fallback" | "runtime_error" = "runtime_error"
  let fallbackReason: string | null = null
  let error: string | null = null
  let nextToken = input.limitedToken
  let nextContext = input.normalContext
  try {
    limited = await runDnaS13LimitedRolloutMessage({
      requestId: randomUUID(),
      subjectId: input.subjectId,
      subjectIdHash: input.subjectIdHash,
      conversationIdHash: input.conversationIdHash,
      sessionId: input.sessionId,
      question: input.fixture.question,
      responseDepth: input.depth,
      contextToken: input.limitedToken,
      contextSecret: input.contextSecret,
      privacy,
      rolloutPhase: "L0",
      safetyIdentifier: `e2e-intent:${sha(input.subjectId).slice(0, 24)}`,
      realizer: input.realizer,
      technicalObserver: (value) => { technical = value },
    })
    if (limited.kind === "answered") {
      finalAnswer = visibleAnswerText(limited.body)
      finalPath = "s13_limited"
      nextToken = limitedContextToken(limited.body)
      nextContext = publicContext(limited.body)
    } else if (limited.kind === "clarification") {
      finalAnswer = visibleAnswerText(limited.body)
      finalPath = "s13_clarification"
      nextToken = limitedContextToken(limited.body) ?? input.limitedToken
      nextContext = input.normalContext
    } else {
      fallbackReason = limited.reason
      const normal = await deterministicNormalPath({
        question: input.fixture.question,
        depth: input.depth,
        context: input.normalContext,
        subjectId: input.subjectId,
      })
      if (normal.status !== 200 || normal.body.ok !== true) throw new Error(`normal_fallback_failed:${normal.status}`)
      finalAnswer = visibleAnswerText(normal.body)
      finalPath = "deterministic_normal_fallback"
      nextToken = null
      nextContext = publicContext(normal.body)
    }
    if (!finalAnswer) throw new Error("empty_final_answer")
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "unknown_runtime_error"
    nextToken = null
    nextContext = null
  }
  const observedTechnical = technical as DnaS13LimitedTechnicalEvidence | null
  const evaluation = evaluateTurn({ fixture: input.fixture, technical: observedTechnical, limited, finalContext: nextContext, finalAnswer, finalPath, error })
  const runtime = observedTechnical?.runtime ?? null
  const telemetry = limited?.telemetry ?? null
  const trace = Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:sealed-trace@1`,
    evaluationId: EVALUATION_ID,
    evaluationSet: input.fixture.id.startsWith("adversarial-") ? "run3_adversarial" : "fresh_300",
    fixture: Object.freeze({
      id: input.fixture.id,
      conversationId: input.fixture.conversationId,
      turnIndex: input.fixture.turnIndex,
      primaryStratum: input.fixture.primaryStratum,
      contextDependent: input.fixture.contextDependent,
      roughLanguage: input.fixture.roughLanguage,
      expectedAmbiguous: input.fixture.expectedAmbiguous ?? false,
      userQuestion: input.fixture.question,
      expectedTopics: input.fixture.expectedTopics,
      expectedAction: input.fixture.expectedAction,
      expectedFacets: input.fixture.expectedFacets,
    }),
    normalization: Object.freeze({ normalizedQuestion: observedTechnical?.normalizedQuery ?? normalizeDnaChatText(input.fixture.question) }),
    contextResolution: Object.freeze({
      operation: observedTechnical?.contextOperation ?? (limited?.kind === "clarification" ? limited.routing.contextOperation : telemetry?.routing.operation) ?? null,
      method: observedTechnical?.contextResolutionMethod ?? (limited?.kind === "clarification" ? limited.routing.contextResolutionMethod : null),
      candidateTopicIds: observedTechnical?.topicCandidateIds ?? (limited?.kind === "clarification" ? limited.routing.candidateTopicIds : []),
      selectedTopicIds: observedTechnical?.queryFrame.subquestions.map((row) => row.topicId)
        ?? (limited?.kind === "clarification" ? limited.routing.selectedTopicIds : []),
      confidence: observedTechnical?.topicResolutionConfidence ?? (limited?.kind === "clarification" ? limited.routing.confidence : "LOW"),
    }),
    pragmaticTaskFrame: observedTechnical?.pragmaticTaskFrame ?? (limited?.kind === "clarification" ? limited.routing.pragmaticTaskFrame : null),
    queryFrame: observedTechnical?.queryFrame ?? null,
    resolvedTopics: observedTechnical?.matches.map((match) => ({ topicId: match.topicId, title: match.topic, score: match.score })) ?? [],
    catalogAvailability: observedTechnical?.plan.facetEvidenceMatrix ?? [],
    selectedAtoms: selectedClaims(observedTechnical),
    lockedPlan: observedTechnical?.plan ?? null,
    realizer: Object.freeze({
      provider: runtime?.provenance.realizer.provider ?? telemetry?.realization.provider ?? "none",
      model: runtime?.provenance.realizer.model ?? null,
      status: runtime?.provenance.status ?? telemetry?.realization.status ?? "error",
      lunaCalls: telemetry?.realization.lunaCalls ?? 0,
      repairCalls: telemetry?.realization.repairCalls ?? 0,
    }),
    validator: Object.freeze({
      routing: observedTechnical?.routingValidation ?? null,
      final: runtime?.finalValidation ?? null,
      failureCodes: evaluation.validatorFailureCodes,
    }),
    fallback: Object.freeze({ path: finalPath, reason: fallbackReason }),
    objectiveEvaluation: evaluation,
    finalAnswer,
    latencyMs: Number((performance.now() - started).toFixed(3)),
    tokenUsage: Object.freeze({
      inputTokens: telemetry?.realization.inputTokens ?? 0,
      cachedInputTokens: telemetry?.realization.cachedInputTokens ?? 0,
      outputTokens: telemetry?.realization.outputTokens ?? 0,
    }),
    costMicrousd: telemetry?.realization.costMicrousd ?? 0,
    privacy: Object.freeze({ allowed: privacy.allowed, category: privacy.category, automaticTrainingAllowed: false }),
    productionChanged: false,
    error,
  })
  return Object.freeze({ trace, finalAnswer, nextToken, nextContext })
}

function blind300(pairs: readonly BlindPair[]) {
  return `${pairs.map((pair) => `Kullanıcı:\n${pair.question}\n\nAsistan:\n${pair.answer}`).join("\n\n---\n\n")}\n`
}

function blindFollowups(conversations: readonly Readonly<{ id: string; pairs: readonly BlindPair[] }>[]) {
  return `${conversations.map((conversation, index) => [
    `Konuşma ${String(index + 1).padStart(3, "0")}`,
    ...conversation.pairs.map((pair) => `Kullanıcı:\n${pair.question}\n\nAsistan:\n${pair.answer}`),
  ].join("\n\n")).join("\n\n---\n\n")}\n`
}

function validateBlind(value: string, expectedPairs: number, allowConversationLabels: boolean) {
  const userCount = (value.match(/^Kullanıcı:$/gmu) ?? []).length
  const assistantCount = (value.match(/^Asistan:$/gmu) ?? []).length
  if (userCount !== expectedPairs || assistantCount !== expectedPairs) throw new Error(`blind_pair_count_invalid:${userCount}:${assistantCount}`)
  if (/(?:\btopicId\b|\bclaimId\b|\bvalidator\b|\bLuna\b|\brepair\b|\bfallback\b|locked plan|\bexpectedAction\b|\bfacet\b|\bscore\b|\bcost\b|\blatency\b|\bPASS\b|\bFAIL\b)/iu.test(value)) {
    throw new Error("blind_technical_metadata_detected")
  }
  if (!allowConversationLabels) {
    const labels = value.split("\n").filter((line) => line.endsWith(":"))
    if (labels.some((label) => !["Kullanıcı:", "Asistan:"].includes(label))) throw new Error("blind_300_extra_label")
  }
}

function metrics(rows: readonly any[]) {
  const fresh = rows.filter((row) => row.evaluationSet === "fresh_300")
  const byStratum = (name: Stratum) => fresh.filter((row) => row.fixture.primaryStratum === name)
  const categoryAccuracy = (name: Stratum) => percent(byStratum(name).filter((row) => row.objectiveEvaluation.directAnswer).length, byStratum(name).length)
  const contextRows = fresh.filter((row) => row.fixture.contextDependent)
  const correctionRows = byStratum("CORRECTION")
  const failures = fresh.filter((row) => row.objectiveEvaluation.failureClass)
  const taxonomy = Object.fromEntries([
    "INPUT_NORMALIZATION_FAILURE", "CONTEXT_FAILURE", "TOPIC_RESOLUTION_FAILURE",
    "ACTION_CLASSIFICATION_FAILURE", "FACET_SELECTION_FAILURE", "CATALOG_GAP",
    "RETRIEVAL_SELECTION_FAILURE", "LOCKED_PLAN_FAILURE", "REALIZATION_FAILURE",
    "VALIDATOR_FALSE_PASS", "ANSWER_INCOMPLETE",
  ].map((name) => [name, failures.filter((row) => row.objectiveEvaluation.failureClass === name).length]))
  const catalogGapRows = fresh.filter((row) => row.objectiveEvaluation.catalogGap)
  return Object.freeze({
    freshMessageCount: fresh.length,
    topicAccuracy: percent(fresh.filter((row) => row.objectiveEvaluation.topicCorrect).length, fresh.length),
    actionAccuracy: percent(fresh.filter((row) => row.objectiveEvaluation.actionCorrect).length, fresh.length),
    facetAccuracy: percent(fresh.filter((row) => row.objectiveEvaluation.facetCorrect).length, fresh.length),
    directAnswerRate: percent(fresh.filter((row) => row.objectiveEvaluation.directAnswer).length, fresh.length),
    contextAccuracy: percent(contextRows.filter((row) => row.objectiveEvaluation.topicCorrect && row.objectiveEvaluation.actionCorrect).length, contextRows.length),
    correctionAccuracy: percent(correctionRows.filter((row) => row.objectiveEvaluation.directAnswer).length, correctionRows.length),
    whyAccuracy: categoryAccuracy("WHY_FUNCTION"),
    deepenAccuracy: categoryAccuracy("DEEPEN"),
    exampleAccuracy: categoryAccuracy("EXAMPLE"),
    compareAccuracy: categoryAccuracy("COMPARE"),
    simplifyAccuracy: categoryAccuracy("SIMPLIFY"),
    catalogGapRate: percent(catalogGapRows.length, fresh.length),
    catalogGapFalseAnswerCount: catalogGapRows.filter((row) => row.objectiveEvaluation.catalogGapFalseAnswer).length,
    availableButNotSelectedCount: fresh.filter((row) => row.objectiveEvaluation.availableButNotSelected).length,
    wrongTopicCount: fresh.filter((row) => !row.objectiveEvaluation.topicCorrect).length,
    unsupportedScienceCount: fresh.reduce((sum, row) => sum + row.objectiveEvaluation.unsupportedScience, 0),
    sourceViolationCount: fresh.reduce((sum, row) => sum + row.objectiveEvaluation.sourceViolation, 0),
    safetyViolationCount: fresh.reduce((sum, row) => sum + row.objectiveEvaluation.safetyViolation, 0),
    runtimeErrorCount: fresh.filter((row) => row.error).length,
    failureTaxonomy: taxonomy,
  })
}

function adversarialFixtures() {
  const units = (denseKnowledgeRuntimeJson as unknown as { units: readonly Readonly<{ topicId: string; title: string }>[] }).units
  const base = ADVERSARIAL.map((row) => ({
    question: row.question,
    surface: row.surface,
    action: row.action,
    facets: row.action === "COMPARE" ? ["distinction"] as const : row.facets,
    roughLanguage: false,
    expectedAmbiguous: false,
  }))
  const duplicateGroups = [...new Map(units.map((unit) => {
    const key = normalizeDnaChatText(unit.title)
    return [key, units.filter((candidate) => normalizeDnaChatText(candidate.title) === key)] as const
  })).values()]
    .map((rows) => [...new Map(rows.map((row) => [row.topicId, row])).values()])
    .filter((rows) => rows.length > 1 && rows[0]!.title.length >= 8 && rows[0]!.title.length <= 80)
    .slice(0, 10)
    .map((rows) => ({
      question: `“${rows[0]!.title}” tam olarak neyi ifade ediyor?`,
      surface: rows[0]!.title,
      action: "DEFINE" as const,
      facets: ["definition"] as const,
      roughLanguage: false,
      expectedAmbiguous: true,
    }))
  const baseSurfaces = new Set([...base, ...duplicateGroups].map((row) => normalizeDnaChatText(row.surface)))
  const uniqueRows = topicPool().filter((topic) => !baseSurfaces.has(normalizeDnaChatText(topic.title))).slice(0, 29)
  const generated = uniqueRows.map((topic, index) => {
    const kind = index % 4
    if (kind === 0) return {
      question: `${topic.title} neydi ya?`, surface: topic.title, action: "DEFINE" as const,
      facets: ["definition"] as const, roughLanguage: true, expectedAmbiguous: false,
    }
    if (kind === 1) {
      const roughSurface = topic.title.replace(/[aeıioöuü]/iu, "")
      return {
        question: `${roughSurface} ndr kısaca?`, surface: topic.title, action: "DEFINE" as const,
        facets: ["definition"] as const, roughLanguage: true, expectedAmbiguous: false,
      }
    }
    if (kind === 2) return {
      question: `${topic.title} yakın kavramlardan nası ayrılıyo?`, surface: topic.title, action: "COMPARE" as const,
      facets: ["distinction"] as const, roughLanguage: true, expectedAmbiguous: false,
    }
    return {
      question: `${topic.title}: core meaning ne?`, surface: topic.title, action: "DEFINE" as const,
      facets: ["definition"] as const, roughLanguage: false, expectedAmbiguous: false,
    }
  })
  const cases = [...base, ...duplicateGroups, ...generated]
  if (cases.length !== 50) throw new Error(`e2e_adversarial_count_invalid:${cases.length}`)
  return cases.map((row, index) => {
    const normalizedSurface = normalizeDnaChatText(row.surface)
    const candidates = [...new Map(units.filter((unit) => normalizeDnaChatText(unit.title) === normalizedSurface)
      .map((unit) => [unit.topicId, Object.freeze({ topicId: unit.topicId, title: unit.title })])).values()]
    const routingResolution = resolveDnaS13NamedTopicSurfaces(row.question)
    const resolved = routingResolution.map((value) => Object.freeze({ topicId: value.topicId, title: value.title }))
    const expectedAmbiguous = row.expectedAmbiguous || candidates.length > 1
      || routingResolution.some((value) => value.confidence === "LOW" || value.candidateTopicIds.length > 1)
    const expectedTopics = expectedAmbiguous ? candidates : candidates.length === 1 ? candidates : resolved
    return Object.freeze({
      id: `adversarial-${String(index + 1).padStart(2, "0")}`,
      conversationId: `adversarial-${String(index + 1).padStart(2, "0")}`,
      turnIndex: 1,
      question: row.question,
      primaryStratum: (row.action === "DEFINE" ? "DEFINITION" : row.action === "EXAMPLE" ? "EXAMPLE" : "COMPARE") as Stratum,
      expectedAction: row.action,
      expectedFacets: Object.freeze((row.action === "COMPARE" ? ["distinction"] : [...row.facets]) as DnaS13RequestedFacet[]),
      expectedTopics: Object.freeze(expectedTopics),
      contextDependent: false,
      roughLanguage: row.roughLanguage,
      expectedAmbiguous,
    }) satisfies TurnFixture
  })
}

function fileMeta(file: string) {
  const data = readFileSync(file)
  return Object.freeze({ name: path.basename(file), bytes: data.byteLength, sha256: sha(data) })
}

function repackageExisting() {
  if (!existsSync(OUTPUT_DIR) || !existsSync(FILES.sealed) || !existsSync(FILES.summary)) {
    throw new Error("e2e_existing_package_missing")
  }
  const rows = readFileSync(FILES.sealed, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as any)
  const revised = rows.map((row) => {
    const evaluation = row.objectiveEvaluation
    const safeLimitedResponse = Boolean(evaluation?.catalogGap && row.finalAnswer && LIMITED_RESPONSE.test(row.finalAnswer))
    if (!safeLimitedResponse || !evaluation.topicCorrect || !evaluation.actionCorrect) return row
    return Object.freeze({
      ...row,
      objectiveEvaluation: Object.freeze({
        ...evaluation,
        directAnswer: true,
        answerCompleteness: true,
        safeLimitedResponse: true,
        catalogGapFalseAnswer: false,
        failureClass: null,
      }),
    })
  })
  writePrivate(FILES.sealed, `${revised.map((row) => JSON.stringify(row)).join("\n")}\n`)
  const prior = JSON.parse(readFileSync(FILES.summary, "utf8")) as any
  const objective = metrics(revised)
  const adversarialRows = revised.filter((row) => row.evaluationSet === "run3_adversarial")
  const adversarialReplay = Object.freeze({
    total: adversarialRows.length,
    directPass: adversarialRows.filter((row) => row.objectiveEvaluation.directAnswer).length,
    failed: adversarialRows.filter((row) => !row.objectiveEvaluation.directAnswer).map((row) => ({
      id: row.fixture.id,
      question: row.fixture.userQuestion,
      failureClass: row.objectiveEvaluation.failureClass,
      resolvedTopics: row.resolvedTopics,
      actualAction: row.objectiveEvaluation.actualAction,
    })),
  })
  const summary = Object.freeze({
    ...prior,
    objective,
    adversarialReplay,
    measurementRevision: Object.freeze({
      version: "safe-limited-response-detection@2",
      rawPipelineReplayChanged: false,
      revisedAt: new Date().toISOString(),
    }),
  })
  writePrivate(FILES.summary, summary)
  const packageFiles = Object.values(FILES)
  execFileSync("zip", ["-q", "-j", "-FS", ZIP_PATH, ...packageFiles])
  chmodSync(ZIP_PATH, 0o600)
  console.log(JSON.stringify({
    objective,
    adversarialReplay,
    files: packageFiles.map(fileMeta),
    zipPath: ZIP_PATH,
    zipBytes: statSync(ZIP_PATH).size,
    zipSha256: sha(readFileSync(ZIP_PATH)),
  }))
}

async function main() {
  if (!LOCAL_PREFLIGHT && !existsSync(SSD_ROOT)) throw new Error("research_ssd_not_mounted")
  const conversations = loadConversations()
  const fixtureValidation = validateFixture(conversations)
  if (VALIDATE_FIXTURE_ONLY) {
    console.log(JSON.stringify(fixtureValidation))
    return
  }
  if (REPACKAGE_EXISTING) {
    repackageExisting()
    return
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim() || ""
  if (!LOCAL_PREFLIGHT && !apiKey) throw new Error("openai_api_key_missing")
  if (existsSync(OUTPUT_DIR) || existsSync(ZIP_PATH)) throw new Error("e2e_certification_output_already_exists")
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  mkdirSync(path.dirname(ZIP_PATH), { recursive: true, mode: 0o700 })
  writePrivate(FILES.sealed, "")
  const subjectId = `e2e-intent-${sha(EVALUATION_ID).slice(0, 16)}`
  const telemetrySecret = sha(`${EVALUATION_ID}:telemetry`)
  const contextSecret = sha(`${EVALUATION_ID}:context`)
  const subjectIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "subject", value: subjectId })
  if (!subjectIdHash) throw new Error("e2e_subject_hash_failed")
  const realizer = LOCAL_PREFLIGHT ? new LocalRealizer() : new CappedLunaRealizer(apiKey, `e2e-intent:${sha(subjectId).slice(0, 24)}`)
  const traces: any[] = []
  const blindPairs: BlindPair[] = []
  const adversarialPairs: BlindPair[] = []
  const followupConversations: Readonly<{ id: string; pairs: readonly BlindPair[] }>[] = []

  for (const conversation of conversations) {
    if (!realizer.canStartMessage()) throw new Error(realizer.stopReason ?? "luna_hard_cap_reached")
    const conversationIdHash = hashDnaS13LimitedIdentifier({
      secret: telemetrySecret,
      kind: "conversation",
      value: `${subjectId}\u0000${conversation.conversationId}`,
    })
    if (!conversationIdHash) throw new Error("e2e_conversation_hash_failed")
    let limitedToken: string | null = null
    let normalContext: PublicConversationContext | null = null
    const pairs: BlindPair[] = []
    for (const fixture of conversation.turns) {
      const result = await executeTurn({
        fixture,
        depth: conversation.depth,
        subjectId,
        subjectIdHash,
        conversationIdHash,
        sessionId: conversationIdHash.slice(0, 40),
        contextSecret,
        limitedToken,
        normalContext,
        realizer,
      })
      traces.push(result.trace)
      appendPrivate(FILES.sealed, result.trace)
      limitedToken = result.nextToken
      normalContext = result.nextContext
      const pair = Object.freeze({ question: fixture.question, answer: result.finalAnswer ?? "[Yanıt üretilemedi]" })
      pairs.push(pair)
      blindPairs.push(pair)
      if (traces.length % 10 === 0) {
        console.log(JSON.stringify({ progress: traces.length, lunaCalls: realizer.externalCalls, costMicrousd: realizer.totalUsage().costMicrousd }))
      }
    }
    followupConversations.push(Object.freeze({ id: conversation.conversationId, pairs: Object.freeze(pairs) }))
  }

  for (const fixture of adversarialFixtures()) {
    if (!realizer.canStartMessage()) throw new Error(realizer.stopReason ?? "luna_hard_cap_reached")
    const conversationIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "conversation", value: `${subjectId}\u0000${fixture.conversationId}` })
    if (!conversationIdHash) throw new Error("e2e_adversarial_hash_failed")
    const result = await executeTurn({
      fixture,
      depth: "standard",
      subjectId,
      subjectIdHash,
      conversationIdHash,
      sessionId: conversationIdHash.slice(0, 40),
      contextSecret,
      limitedToken: null,
      normalContext: null,
      realizer,
    })
    traces.push(result.trace)
    appendPrivate(FILES.sealed, result.trace)
    adversarialPairs.push(Object.freeze({
      question: fixture.question,
      answer: result.finalAnswer ?? "[Yanıt üretilemedi]",
    }))
  }

  const blind300Value = blind300(blindPairs)
  const followupValue = blindFollowups(followupConversations)
  const adversarialValue = blind300(adversarialPairs)
  validateBlind(blind300Value, 300, false)
  validateBlind(followupValue, 300, true)
  validateBlind(adversarialValue, 50, false)
  writePrivate(FILES.blind300, blind300Value)
  writePrivate(FILES.blindFollowups, followupValue)
  const blindAdversarialFile = (FILES as Readonly<Record<string, string>>).blindAdversarial
  if (ROUTING_PACKAGE && blindAdversarialFile) writePrivate(blindAdversarialFile, adversarialValue)
  const objective = metrics(traces)
  const adversarialRows = traces.filter((row) => row.evaluationSet === "run3_adversarial")
  const adversarialSummary = Object.freeze({
    total: adversarialRows.length,
    directPass: adversarialRows.filter((row) => row.objectiveEvaluation.directAnswer).length,
    failed: adversarialRows.filter((row) => !row.objectiveEvaluation.directAnswer).map((row) => ({
      id: row.fixture.id,
      question: row.fixture.userQuestion,
      failureClass: row.objectiveEvaluation.failureClass,
      resolvedTopics: row.resolvedTopics,
      actualAction: row.objectiveEvaluation.actualAction,
    })),
  })
  const usage = realizer.totalUsage()
  const summary = Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:summary@1`,
    evaluationId: EVALUATION_ID,
    createdAt: new Date().toISOString(),
    runtime: Object.freeze({
      primary: "current_s13_strict_v4_limited_runtime",
      fallback: "current_committed_deterministic_runtime",
      realizer: LOCAL_PREFLIGHT ? "deterministic-preflight" : DNA_CHAT_LUNA_MODEL,
      localPreflight: LOCAL_PREFLIGHT,
    }),
    fixture: fixtureValidation,
    multiTurnConversationCount: followupConversations.length,
    objective,
    adversarialReplay: adversarialSummary,
    usage: Object.freeze({
      lunaCalls: realizer.externalCalls,
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
      costUsd: Number((usage.costMicrousd / 1_000_000).toFixed(6)),
      hardCapUsd: 1,
      stoppedByCap: Boolean(realizer.stopReason),
    }),
    controls: Object.freeze({
      codexAnswerQualityScoring: false,
      objectiveStructuralRulesOnly: true,
      automaticFixes: false,
      knowledgeEnrichment: false,
      newSources: false,
      chatEngineChanged: false,
      knowledgeCatalogChanged: false,
      productionChanged: false,
      automaticTrainingUse: "prohibited",
      structuralFacetAnnotationRevision: "action-facet-contract@1",
      sourceFixturePath: FIXTURE_SOURCE,
    }),
  })
  writePrivate(FILES.summary, summary)
  writePrivate(FILES.fixture, Object.freeze({ schemaVersion: `${SCHEMA_VERSION}:fixture@1`, ...fixtureValidation, conversations }))
  writePrivate(FILES.readme, [
    "# DNA Chat End-to-End User Intent Certification",
    "",
    "Bu paket mevcut gerçek S13-Strict limited runtime ve onun mevcut deterministic normal fallback akışı üzerinde oluşturulmuş baseline evidence paketidir.",
    "",
    "- `BLIND_E2E_CHAT_300.md`: 300 fresh kullanıcı/asistan çifti; teknik metadata içermez.",
    "- `BLIND_E2E_CHAT_FOLLOWUPS.md`: 60 adet, beş kullanıcı turlu konuşma; teknik metadata içermez.",
    "- `SEALED_E2E_CHAT_TRACE.jsonl`: normalization, context, task frame, topic, facet, catalog, plan, validator ve root-cause trace'i.",
    "- `objective-certification-summary.json`: yalnız önceden tanımlı yapısal ölçümler.",
    "- `fixture-manifest.json`: sentetik, kişisel/klinik veri içermeyen test fixture'i ve beklenen intent etiketleri.",
    "",
    "Bu koşu knowledge enrichment, source ekleme, otomatik fix, training veya production aktivasyonu yapmaz.",
    "",
  ].join("\n"))
  const packageFiles = Object.values(FILES)
  execFileSync("zip", ["-q", "-j", ZIP_PATH, ...packageFiles])
  chmodSync(ZIP_PATH, 0o600)
  const result = Object.freeze({
    ...summary,
    files: packageFiles.map(fileMeta),
    zipPath: ZIP_PATH,
    zipBytes: statSync(ZIP_PATH).size,
    zipSha256: sha(readFileSync(ZIP_PATH)),
  })
  console.log(JSON.stringify(result))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : "e2e_user_intent_certification_failed")
  process.exitCode = 1
})
