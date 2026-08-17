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
import { sumDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { DNA_CHAT_LUNA_MODEL } from "../src/lib/dna/chat/lunaPolicy"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import type { DnaS13Depth } from "../src/lib/dna/chat/s13/contracts"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import { hashDnaS13LimitedIdentifier } from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import {
  runDnaS13LimitedRolloutMessage,
  type DnaS13LimitedTechnicalEvidence,
} from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import { hashDnaS13Artifact } from "../src/lib/dna/chat/s13/strictHash"
import { LunaRealizer } from "../src/lib/dna/chat/s13/strictLunaRealizer.server"
import {
  createDnaS13DeterministicRealization,
  DeterministicRealizer,
  DNA_S13_REALIZER_CONTRACT_VERSION,
  type DnaS13RealizerAttempt,
  type DnaS13RealizerRequest,
  type Realizer,
} from "../src/lib/dna/chat/s13/strictRealizer"
import { runDnaS13StrictRuntime, type DnaS13StrictRuntimeResult } from "../src/lib/dna/chat/s13/strictRuntime"
import type { DnaS13StrictPlan } from "../src/lib/dna/chat/s13/strictContracts"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const SCHEMA_VERSION = "dna-chat-paired-luna-value-test@1"
const EVALUATION_ID = process.env.DNA_PAIRED_LUNA_EVALUATION_ID?.trim()
  || "DNA_CHAT_PAIRED_LUNA_VALUE_TEST_001"
const LOCAL_PREFLIGHT = process.argv.includes("--local-preflight")
const VALIDATE_FIXTURE_ONLY = process.argv.includes("--validate-fixture-only")
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUTPUT_DIR = process.env.DNA_PAIRED_LUNA_OUTPUT_DIR?.trim() || (LOCAL_PREFLIGHT
  ? "/tmp/dna-paired-luna-value-test-preflight"
  : path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/paired-luna-value-test/run-001"))
const ZIP_PATH = process.env.DNA_PAIRED_LUNA_ZIP_PATH?.trim() || (LOCAL_PREFLIGHT
  ? "/tmp/DNA_CHAT_PAIRED_LUNA_VALUE_TEST_PREFLIGHT.zip"
  : path.join(SSD_ROOT, "Deliverables/SelfMetaAI/dna-intelligence/DNA_CHAT_PAIRED_LUNA_VALUE_TEST_001.zip"))
const HARD_CAP_MICROUSD = 400_000
const CALL_RESERVE_MICROUSD = 20_000

const FILES = Object.freeze({
  blind100: path.join(OUTPUT_DIR, "BLIND_LUNA_AB_100.md"),
  blindMultiturn: path.join(OUTPUT_DIR, "BLIND_LUNA_AB_MULTITURN_20.md"),
  sealed: path.join(OUTPUT_DIR, "SEALED_LUNA_AB_TRACE.jsonl"),
  summary: path.join(OUTPUT_DIR, "objective-run-summary.json"),
  fixture: path.join(OUTPUT_DIR, "fixture-manifest.json"),
  scorecard: path.join(OUTPUT_DIR, "BLIND_REVIEW_SCORECARD.json"),
  calculationContract: path.join(OUTPUT_DIR, "blind-review-calculation-contract.json"),
  readme: path.join(OUTPUT_DIR, "README.md"),
  manifest: path.join(OUTPUT_DIR, "manifest.json"),
})

type FixtureSet = "single_100" | "multiturn_20"
type TestStratum = "definition" | "why_function" | "deepen" | "example" | "compare" | "simplify" | "context_correction_followup"
type Topic = Readonly<{ topicId: string; title: string }>
type Fixture = Readonly<{
  pairId: string
  set: FixtureSet
  conversationId: string
  turnIndex: number
  question: string
  intendedStratum: TestStratum
  responseDepth: DnaS13Depth
  roughLanguage: boolean
  multiTurnComplex: boolean
}>
type Conversation = Readonly<{ conversationId: string; turns: readonly Fixture[] }>
type PairResult = Readonly<{
  fixture: Fixture
  supportStratum: "SUPPORTED" | "CATALOG_LIMITED"
  lunaLabel: "A" | "B"
  answerA: string
  answerB: string
  nextContextToken: string | null
  trace: Record<string, unknown>
  lunaRuntime: DnaS13StrictRuntimeResult
  deterministicRuntime: DnaS13StrictRuntimeResult
  proxy: ReturnType<typeof objectiveProxyPair>
  adaptiveLunaOn: boolean
}>

const MAIN_DISTRIBUTION: Readonly<Record<TestStratum, number>> = Object.freeze({
  definition: 20,
  why_function: 15,
  deepen: 15,
  example: 15,
  compare: 15,
  simplify: 10,
  context_correction_followup: 10,
})

const INTERNAL_JARGON = /(?:locked plan|locked claim|kilitli içerik|\bclaim(?:id|s)?\b|\bfacet\w*\b|\btopicid\b|\bvalidator\b|system\.facet-boundary)/giu
const MECHANICAL_START = /^(?:temelde|ayrica),/iu
const ARCHITECTURE_LEAK = /(?:gpt-5\.6-luna|dna-deterministic-realizer|architecture identity|provider calls?|locked content plan|claimid|topicid|validator result)/iu

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function percent(numerator: number, denominator: number) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(3)) : 0
}

function mean(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function upstreamInvariantsPass(value: unknown) {
  const invariants = (value ?? {}) as Record<string, unknown>
  return invariants.upstreamExecutionCount === 1
    && invariants.lockedPlanRebuiltForSecondBranch === false
    && invariants.sameTopic === true
    && invariants.sameAction === true
    && invariants.sameFacet === true
    && invariants.sameQueryFrameHash === true
    && invariants.sameLockedPlanHash === true
    && invariants.sameEvidenceIds === true
    && invariants.sameClaimSet === true
    && invariants.sameAnswerability === true
    && invariants.deterministicExternalProviderCalls === 0
}

function writePrivate(file: string, value: string | unknown) {
  const text = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`
  writeFileSync(file, text, { mode: 0o600 })
}

function appendPrivate(file: string, value: unknown) {
  appendFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 })
}

function topicPool(): readonly Topic[] {
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ topicId: string; title: string; dimensions?: readonly string[] }>[]
  }).units
  const topicIdsByTitle = new Map<string, Set<string>>()
  const evidenceProfileByTopic = new Map<string, { count: number; dimensions: Set<string> }>()
  for (const unit of units) {
    const key = normalizeDnaChatText(unit.title)
    const ids = topicIdsByTitle.get(key) ?? new Set<string>()
    ids.add(unit.topicId)
    topicIdsByTitle.set(key, ids)
    const profile = evidenceProfileByTopic.get(unit.topicId) ?? { count: 0, dimensions: new Set<string>() }
    profile.count += 1
    for (const dimension of unit.dimensions ?? []) profile.dimensions.add(dimension)
    evidenceProfileByTopic.set(unit.topicId, profile)
  }
  const rows = [...new Map(units.map((unit) => [unit.topicId, Object.freeze({
    topicId: unit.topicId,
    title: unit.title.trim(),
  })])).values()]
    .filter((row) => row.title.length >= 10 && row.title.length <= 72)
    .filter((row) => !/[?\n\r]/u.test(row.title))
    .filter((row) => topicIdsByTitle.get(normalizeDnaChatText(row.title))?.size === 1)
    .filter((row) => {
      const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
      return resolved.length === 1 && resolved[0]?.topicId === row.topicId
        && resolved[0].confidence !== "LOW" && resolved[0].candidateTopicIds.length === 1
    })
    .sort((left, right) => {
      const leftProfile = evidenceProfileByTopic.get(left.topicId)!
      const rightProfile = evidenceProfileByTopic.get(right.topicId)!
      const leftScore = leftProfile.count + (leftProfile.dimensions.size * 5)
      const rightScore = rightProfile.count + (rightProfile.dimensions.size * 5)
      return rightScore - leftScore || left.topicId.localeCompare(right.topicId)
    })
  if (rows.length < 175) throw new Error(`paired_luna_topic_pool_too_small:${rows.length}`)
  return Object.freeze(rows)
}

function mainQuestion(stratum: TestStratum, topics: readonly Topic[], rough: boolean, index: number) {
  const a = topics[0]!
  const b = topics[1]
  if (stratum === "definition") return rough
    ? `${a.title} ndr ya; core meaning ne, kısa pls?`
    : `${a.title} kavramını doğrudan tanımlar mısın; tam olarak neyi ifade eder?`
  if (stratum === "why_function") return rough
    ? `${a.title} niye önemli ya, işlev ne kısaca?`
    : `${a.title} neden önemlidir; işlevsel anlamını doğrudan açıklar mısın?`
  if (stratum === "deepen") return rough
    ? `${a.title} için önce söylenmeyen yeni bi ayrıntıyı aç pls.`
    : `${a.title} başlığında ana açıklamayı yinelemeden bir kat daha derine iner misin?`
  if (stratum === "example") return rough
    ? `${a.title} için günlük hayattan somut bi örnek var mı?`
    : `${a.title} için doğrulanmış içeriğin desteklediği somut bir örnek verir misin?`
  if (stratum === "compare") return rough
    ? `${a.title} vs ${b!.title}; aynı şey mi, fark ne?`
    : `${a.title} ile ${b!.title} nasıl ayrılır; ikisini aynı düzeyde mi değerlendirmeliyiz?`
  if (stratum === "simplify") return rough
    ? `${a.title} çok teknik; simple TR ile öğrenciye anlatır gibi söylesene.`
    : `${a.title} açıklamasını jargon kullanmadan daha sade ve anlaşılır biçimde anlatır mısın?`
  return rough
    ? `yok ${a.title} değil; ${b!.title} hedefim, onu anlat pls.`
    : `${a.title} değil, ${b!.title} başlığını soruyorum; yalnız doğru hedefi açıklar mısın?`
}

function buildFixtures() {
  const topics = topicPool()
  const multiTurnTopicReserve = 40
  let cursor = multiTurnTopicReserve
  const next = () => {
    const topic = topics[cursor]
    cursor += 1
    if (!topic) throw new Error("paired_luna_topic_pool_exhausted")
    return topic
  }
  const main: Fixture[] = []
  let mainIndex = 0
  for (const [stratum, count] of Object.entries(MAIN_DISTRIBUTION) as [TestStratum, number][]) {
    for (let offset = 0; offset < count; offset += 1) {
      const a = next()
      const b = ["compare", "context_correction_followup"].includes(stratum) ? next() : null
      const roughLanguage = mainIndex < 40
      const pairId = `single-${String(mainIndex + 1).padStart(3, "0")}`
      main.push(Object.freeze({
        pairId,
        set: "single_100" as const,
        conversationId: pairId,
        turnIndex: 1,
        question: mainQuestion(stratum, b ? [a, b] : [a], roughLanguage, offset),
        intendedStratum: stratum,
        responseDepth: stratum === "definition" || (stratum === "why_function" && offset < 8) || stratum === "simplify"
          ? "short" : stratum === "deepen" ? "deep" : "standard",
        roughLanguage,
        multiTurnComplex: false,
      }))
      mainIndex += 1
    }
  }

  const conversations: Conversation[] = []
  let conversationCursor = 0
  const nextConversationTopic = () => {
    const topic = topics[conversationCursor]
    conversationCursor += 1
    if (!topic || conversationCursor > multiTurnTopicReserve) {
      throw new Error("paired_luna_multiturn_topic_pool_exhausted")
    }
    return topic
  }
  for (let conversationIndex = 0; conversationIndex < 20; conversationIndex += 1) {
    const a = nextConversationTopic()
    const b = nextConversationTopic()
    const conversationId = `multiturn-${String(conversationIndex + 1).padStart(2, "0")}`
    const mode = conversationIndex % 5
    const continuityCue = [
      "önceki hedefi koruyarak",
      "başka başlığa geçmeden",
      "aynı kavramda kalarak",
      "ilk sorudaki odağı sürdürerek",
    ][Math.floor(conversationIndex / 5)]!
    const questions: readonly Readonly<{ question: string; stratum: TestStratum; depth: DnaS13Depth }>[] = mode === 0
      ? Object.freeze([
          { question: `${a.title} tam olarak nedir?`, stratum: "definition", depth: "short" },
          { question: `peki ${continuityCue} bunu neden önemli sayıyoruz?`, stratum: "context_correction_followup", depth: "short" },
          { question: `${continuityCue} önce söylenmeyen ayrıntıyı biraz daha açar mısın?`, stratum: "deepen", depth: "deep" },
        ])
      : mode === 1
        ? Object.freeze([
            { question: `${a.title} neyi ifade eder?`, stratum: "definition", depth: "short" },
            { question: `${continuityCue} günlük hayattan somut bir örnek verir misin?`, stratum: "context_correction_followup", depth: "standard" },
            { question: `şimdi ${continuityCue} aynı içeriği daha sade, öğrenci diliyle anlatır mısın?`, stratum: "simplify", depth: "short" },
          ])
        : mode === 2
          ? Object.freeze([
              { question: `başlangıç için ${a.title} başlığının temel anlamı nedir?`, stratum: "definition", depth: "short" },
              { question: `hayır onu değil, ${b.title} başlığını soruyorum; yalnız buna geç.`, stratum: "context_correction_followup", depth: "standard" },
              { question: `peki ${continuityCue} bu neden önemli?`, stratum: "context_correction_followup", depth: "short" },
            ])
          : mode === 3
            ? Object.freeze([
                { question: `${a.title} nedir?`, stratum: "definition", depth: "short" },
                { question: `peki ${a.title} ile ${b.title} arasındaki fark nedir?`, stratum: "compare", depth: "deep" },
                { question: `şimdi yalnız ${b.title} başlığını daha sade anlatır mısın?`, stratum: "simplify", depth: "short" },
              ])
            : Object.freeze([
                { question: `${a.title} kavramını kısaca tanımlar mısın?`, stratum: "definition", depth: "short" },
                { question: `hayır, şimdi yalnız ${b.title} başlığına geç; temel anlamını açıklar mısın?`, stratum: "context_correction_followup", depth: "standard" },
                { question: `son olarak ${a.title} ile ${b.title} arasındaki ayrımı kurar mısın?`, stratum: "compare", depth: "deep" },
              ])
    conversations.push(Object.freeze({
      conversationId,
      turns: Object.freeze(questions.map((row, turnOffset) => Object.freeze({
        pairId: `${conversationId}-t${turnOffset + 1}`,
        set: "multiturn_20" as const,
        conversationId,
        turnIndex: turnOffset + 1,
        question: row.question,
        intendedStratum: row.stratum,
        responseDepth: row.depth,
        roughLanguage: conversationIndex < 8 && turnOffset > 0,
        multiTurnComplex: turnOffset > 0,
      }))),
    }))
  }
  return Object.freeze({ main: Object.freeze(main), conversations: Object.freeze(conversations) })
}

function questionsFromBlindMarkdown(value: string) {
  return [...value.matchAll(/(?:\*\*)?(?:Kullanıcı|User):(?:\*\*)?\s*\n?([^\n]+)/giu)]
    .map((match) => String(match[1] || "").trim()).filter(Boolean)
}

function priorQuestions() {
  const roots = [path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence"), "artifacts/dna-intelligence"]
  const files = roots.flatMap((root) => {
    if (!existsSync(root)) return []
    try {
      return execFileSync("find", [root, "-type", "f", "-name", "BLIND*.md"], { encoding: "utf8" })
        .trim().split("\n").filter(Boolean)
    } catch { return [] }
  })
  const questions = files.flatMap((file) => {
    try { return questionsFromBlindMarkdown(readFileSync(file, "utf8")) } catch { return [] }
  })
  return Object.freeze({ files: unique(files), questions: unique(questions.map(normalizeDnaChatText).filter(Boolean)) })
}

function validateFixture(fixtures: ReturnType<typeof buildFixtures>) {
  const main = fixtures.main
  const multiturn = fixtures.conversations.flatMap((conversation) => conversation.turns)
  const all = [...main, ...multiturn]
  const distribution = Object.fromEntries(Object.keys(MAIN_DISTRIBUTION).map((stratum) => [
    stratum,
    main.filter((fixture) => fixture.intendedStratum === stratum).length,
  ]))
  const prior = priorQuestions()
  const priorSet = new Set(prior.questions)
  const exactReuse = all.filter((fixture) => priorSet.has(normalizeDnaChatText(fixture.question)))
  const privacyRejected = all.flatMap((fixture) => {
    const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: fixture.question, mode: "theory" })
    return privacy.allowed ? [] : [{ pairId: fixture.pairId, reasonCodes: privacy.reasonCodes }]
  })
  if (main.length !== 100 || fixtures.conversations.length !== 20 || multiturn.length !== 60) {
    throw new Error("paired_luna_fixture_shape_invalid")
  }
  if (Object.entries(MAIN_DISTRIBUTION).some(([key, count]) => distribution[key] !== count)) {
    throw new Error("paired_luna_fixture_distribution_invalid")
  }
  if (main.filter((fixture) => fixture.roughLanguage).length < 40) throw new Error("paired_luna_fixture_rough_language_invalid")
  if (new Set(all.map((fixture) => normalizeDnaChatText(fixture.question))).size !== all.length) {
    throw new Error("paired_luna_fixture_duplicate_question")
  }
  if (exactReuse.length) {
    throw new Error(`paired_luna_fixture_prior_exact_reuse:${exactReuse.map((row) => row.pairId).join(",")}`)
  }
  if (privacyRejected.length) throw new Error(`paired_luna_fixture_privacy_rejection:${privacyRejected.length}`)
  return Object.freeze({
    singleMessageCount: main.length,
    multiTurnConversationCount: fixtures.conversations.length,
    multiTurnMessageCount: multiturn.length,
    totalPairCount: all.length,
    mainDistribution: distribution,
    mainRoughLanguageCount: main.filter((fixture) => fixture.roughLanguage).length,
    mainRoughLanguagePercent: percent(main.filter((fixture) => fixture.roughLanguage).length, main.length),
    priorBlindFilesChecked: prior.files.length,
    priorQuestionCount: prior.questions.length,
    exactReuseCount: exactReuse.length,
    privacyRejectedCount: privacyRejected.length,
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

  totalUsage() { return sumDnaChatLunaUsage(this.usages) }
  canStartPair() { return !this.stopReason && this.totalUsage().costMicrousd <= HARD_CAP_MICROUSD - CALL_RESERVE_MICROUSD }

  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    if (!this.canStartPair()) {
      this.stopReason = this.stopReason ?? "luna_hard_cap_reserve_reached"
      throw new Error(this.stopReason)
    }
    const attempt = await this.inner.realize(input)
    this.externalCalls += 1
    this.usages.push(attempt.usage)
    if (this.totalUsage().costMicrousd > HARD_CAP_MICROUSD) {
      this.stopReason = "luna_hard_cap_exceeded"
      throw new Error(this.stopReason)
    }
    return attempt
  }
}

class LocalLunaStub implements Realizer {
  readonly identity = Object.freeze({
    provider: "luna" as const,
    model: "local-preflight-luna-stub",
    implementationVersion: "local-preflight-luna-stub@1",
  })
  externalCalls = 0
  stopReason: string | null = null
  totalUsage(): DnaChatLunaUsage { return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 } }
  canStartPair() { return true }
  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    const realization = createDnaS13DeterministicRealization(input.plan)
    return Object.freeze({
      contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
      identity: this.identity,
      prompt: Object.freeze({ version: "local-preflight-luna-stub@1", hash: hashDnaS13Artifact({ plan: input.plan, attempt: input.attempt }) }),
      realization,
      rawOutput: JSON.stringify(realization),
      responseId: null,
      usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
      latencyMs: 0,
    })
  }
}

function contextToken(body: Record<string, unknown>) {
  const context = body.conversationContext
  if (!context || typeof context !== "object") return null
  const token = (context as Record<string, unknown>).limitedRolloutContextToken
  return typeof token === "string" && token.trim() ? token : null
}

function sentences(value: string) {
  return value.split(/(?<=[.!?])\s+|\n+/u).map((sentence) => sentence.trim()).filter(Boolean)
}

function tokenSet(value: string) {
  return new Set(normalizeDnaChatText(value).split(/\s+/u)
    .map((token) => token.replace(/[^a-z0-9]/gu, ""))
    .filter((token) => token.length >= 4 && !["bunu", "icin", "olarak", "nedir", "nasil", "neden", "daha"].includes(token)))
}

function overlap(left: string, right: string) {
  const a = tokenSet(left)
  const b = tokenSet(right)
  return a.size ? percent([...a].filter((token) => b.has(token)).length, a.size) : 100
}

function answerProxy(input: Readonly<{
  answer: string
  question: string
  runtime: DnaS13StrictRuntimeResult
  plan: DnaS13StrictPlan
  previousAnswer: string | null
  followUp: boolean
}>) {
  const rows = sentences(input.answer)
  const wordCounts = rows.map((row) => row.split(/\s+/u).filter(Boolean).length)
  const comfortable = wordCounts.filter((count) => count >= 5 && count <= 32).length
  const exactClaims = new Set(input.plan.slots.flatMap((slot) => slot.lockedClaims.map((entry) => entry.claim.text.trim())))
  const copied = rows.filter((row) => exactClaims.has(row)).length
  const mechanical = rows.filter((row) => MECHANICAL_START.test(row)).length
  const duplicate = rows.length - new Set(rows.map(normalizeDnaChatText)).size
  let legacyNaturalnessProxy = 40
  const deterministic = createDnaS13DeterministicRealization(input.plan).slotRealizations.map((slot) => slot.text).join("\n\n")
  if (input.answer.trim() !== deterministic.trim()) legacyNaturalnessProxy += 15
  if (rows.length >= Math.min(2, input.plan.lockedClaimIds.length)) legacyNaturalnessProxy += 15
  if (rows.length && comfortable === rows.length) legacyNaturalnessProxy += 10
  if (input.plan.slots.length > 1 && input.answer.split(/\n\s*\n/u).filter((row) => row.trim()).length >= input.plan.slots.length) legacyNaturalnessProxy += 10
  if (copied === 0) legacyNaturalnessProxy += 10
  if (INTERNAL_JARGON.test(input.answer)) legacyNaturalnessProxy -= 20
  INTERNAL_JARGON.lastIndex = 0
  const validation = input.runtime.finalValidation
  const completeness = validation.requestedSlotCount
    ? percent(validation.answeredSupportedSlotCount, validation.requestedSlotCount) : validation.pass ? 100 : 0
  return Object.freeze({
    boundary: "automatic_proxy_not_blind_human_judgment",
    legacyNaturalnessProxy: Math.max(0, Math.min(100, legacyNaturalnessProxy)),
    completenessProxy: completeness,
    directnessProxy: input.answer.trim() && !/yanıt üretilemedi|birlikte netleştirelim/iu.test(input.answer) ? 100 : 0,
    clarityProxy: percent(comfortable, Math.max(1, rows.length)),
    coherenceProxy: percent(Math.max(0, rows.length - duplicate), Math.max(1, rows.length)),
    unnecessaryRepetitionRate: percent(duplicate, Math.max(1, rows.length)),
    mechanicalTemplateRate: percent(mechanical, Math.max(1, rows.length)),
    followUpContinuityProxy: input.followUp
      ? input.previousAnswer && normalizeDnaChatText(input.previousAnswer) !== normalizeDnaChatText(input.answer)
        && validation.followupInformationGain !== false ? 100 : 0
      : null,
    questionSpecificityProxy: overlap(input.question, input.answer),
    semanticFidelityProxy: validation.pass && validation.unsupportedAdditionCount === 0
      && validation.unsupportedRelationCount === 0 && validation.sourceViolationCount === 0 ? 100 : 0,
  })
}

function objectiveProxyPair(input: Readonly<{
  question: string
  plan: DnaS13StrictPlan
  luna: DnaS13StrictRuntimeResult
  deterministic: DnaS13StrictRuntimeResult
  previousLuna: string | null
  previousDeterministic: string | null
  followUp: boolean
}>) {
  const luna = answerProxy({ answer: input.luna.answer, question: input.question, runtime: input.luna,
    plan: input.plan, previousAnswer: input.previousLuna, followUp: input.followUp })
  const deterministic = answerProxy({ answer: input.deterministic.answer, question: input.question, runtime: input.deterministic,
    plan: input.plan, previousAnswer: input.previousDeterministic, followUp: input.followUp })
  return Object.freeze({
    luna,
    deterministic,
    deltasLunaMinusDeterministic: Object.freeze({
      legacyNaturalnessProxy: Number((luna.legacyNaturalnessProxy - deterministic.legacyNaturalnessProxy).toFixed(3)),
      completenessProxy: Number((luna.completenessProxy - deterministic.completenessProxy).toFixed(3)),
      directnessProxy: Number((luna.directnessProxy - deterministic.directnessProxy).toFixed(3)),
      clarityProxy: Number((luna.clarityProxy - deterministic.clarityProxy).toFixed(3)),
      coherenceProxy: Number((luna.coherenceProxy - deterministic.coherenceProxy).toFixed(3)),
      followUpContinuityProxy: luna.followUpContinuityProxy === null || deterministic.followUpContinuityProxy === null
        ? null : Number((luna.followUpContinuityProxy - deterministic.followUpContinuityProxy).toFixed(3)),
      questionSpecificityProxy: Number((luna.questionSpecificityProxy - deterministic.questionSpecificityProxy).toFixed(3)),
      semanticFidelityProxy: Number((luna.semanticFidelityProxy - deterministic.semanticFidelityProxy).toFixed(3)),
      mechanicalLanguageImprovement: Number((deterministic.mechanicalTemplateRate - luna.mechanicalTemplateRate).toFixed(3)),
      repetitionImprovement: Number((deterministic.unnecessaryRepetitionRate - luna.unnecessaryRepetitionRate).toFixed(3)),
    }),
  })
}

function supportStratum(plan: DnaS13StrictPlan): "SUPPORTED" | "CATALOG_LIMITED" {
  const requested = (plan.facetEvidenceMatrix ?? []).filter((entry) => entry.status !== "NOT_REQUESTED")
  const supported = requested.length > 0 && requested.every((entry) =>
    entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
  return supported && !(plan.evidenceLimitations?.length) ? "SUPPORTED" : "CATALOG_LIMITED"
}

function limitedStatusFailures(runtime: DnaS13StrictRuntimeResult) {
  const final = runtime.finalValidation
  const driftCodes = new Set([
    "wrong_claim_substitution", "invented_number", "age_scope_changed", "negation_changed",
    "causality_escalated", "epistemic_force_escalated", "unaligned_factual_sentence",
    "unsupported_relation_addition",
  ])
  return Object.freeze({
    unsupportedAddition: final.unsupportedAdditionCount,
    scienceDrift: final.failureCodes.filter((code) => driftCodes.has(code)).length,
    certaintyDrift: final.failureCodes.filter((code) => code === "causality_escalated" || code === "epistemic_force_escalated").length,
    wrongFacet: final.failureCodes.filter((code) => code === "facet_entailment_invalid" || code === "INVALID_CLAIM_ROLE_FOR_FACET").length,
    wrongTopic: final.failureCodes.filter((code) => code === "rejected_target_in_plan" || code === "TOPIC_THESIS_CONTRADICTION").length,
    validatorRejectedAttempts: runtime.rejectedAttemptValidations.length,
    finalValidatorPass: final.pass,
    fallback: runtime.status === "deterministic_fallback",
  })
}

function adaptiveEligible(input: Readonly<{
  fixture: Fixture
  technical: DnaS13LimitedTechnicalEvidence
  deterministic: DnaS13StrictRuntimeResult
  stratum: "SUPPORTED" | "CATALOG_LIMITED"
}>) {
  if (input.stratum === "CATALOG_LIMITED") return false
  const action = input.technical.pragmaticTaskFrame.pragmaticAction
  if (action === "DEEPEN" || action === "COMPARE") return true
  if (input.fixture.multiTurnComplex && action !== "DEFINE") return true
  if (input.technical.queryFrame.subquestions.length > 1) return true
  const deterministicWords = input.deterministic.answer.split(/\s+/u).filter(Boolean).length
  return input.fixture.responseDepth === "deep" || input.technical.plan.slots.length > 1 || deterministicWords >= 70
}

function randomizedLunaLabel(pairId: string): "A" | "B" {
  return Number.parseInt(sha(`${EVALUATION_ID}\u0000${pairId}`).slice(0, 2), 16) % 2 === 0 ? "A" : "B"
}

async function executePair(input: Readonly<{
  fixture: Fixture
  subjectId: string
  subjectIdHash: string
  conversationIdHash: string
  sessionId: string
  contextSecret: string
  contextToken: string | null
  lunaRealizer: CappedLunaRealizer | LocalLunaStub
  previousLuna: string | null
  previousDeterministic: string | null
}>): Promise<PairResult> {
  const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: input.fixture.question, mode: "theory" })
  if (!privacy.allowed) throw new Error(`paired_luna_privacy_blocked:${input.fixture.pairId}`)
  let technical: DnaS13LimitedTechnicalEvidence | null = null
  const limited = await runDnaS13LimitedRolloutMessage({
    requestId: randomUUID(),
    subjectId: input.subjectId,
    subjectIdHash: input.subjectIdHash,
    conversationIdHash: input.conversationIdHash,
    sessionId: input.sessionId,
    question: input.fixture.question,
    responseDepth: input.fixture.responseDepth,
    contextToken: input.contextToken,
    contextSecret: input.contextSecret,
    privacy,
    rolloutPhase: "L0",
    realizer: new DeterministicRealizer(),
    technicalObserver: (value) => { technical = value },
  })
  const observed = technical as DnaS13LimitedTechnicalEvidence | null
  if (limited.kind !== "answered" || !observed) {
    const reason = limited.kind === "answered" ? "technical_evidence_missing" : limited.reason
    throw new Error(`paired_luna_upstream_not_pairable:${input.fixture.pairId}:${limited.kind}:${reason}`)
  }
  const deterministicRuntime = observed.runtime
  const lunaRuntime = await runDnaS13StrictRuntime({
    question: input.fixture.question,
    normalizedQuestion: observed.normalizedQuery,
    queryFrame: observed.queryFrame,
    plan: observed.plan,
    realizer: input.lunaRealizer,
    catalog: observed.runtime.provenance.catalog,
    retrieval: observed.runtime.provenance.retrieval,
    privacy: observed.runtime.provenance.privacy,
    trainingCandidateRequested: false,
  })
  const planHash = hashDnaS13Artifact(observed.plan)
  const queryFrameHash = hashDnaS13Artifact(observed.queryFrame)
  const evidenceIds = unique(observed.plan.slots.flatMap((slot) => slot.lockedClaimIds)).sort()
  const stratum = supportStratum(observed.plan)
  const proxy = objectiveProxyPair({
    question: input.fixture.question,
    plan: observed.plan,
    luna: lunaRuntime,
    deterministic: deterministicRuntime,
    previousLuna: input.previousLuna,
    previousDeterministic: input.previousDeterministic,
    followUp: input.fixture.turnIndex > 1,
  })
  const lunaLabel = randomizedLunaLabel(input.fixture.pairId)
  const answerA = lunaLabel === "A" ? lunaRuntime.answer : deterministicRuntime.answer
  const answerB = lunaLabel === "B" ? lunaRuntime.answer : deterministicRuntime.answer
  const nextContextToken = contextToken(limited.body)
  const adaptiveLunaOn = adaptiveEligible({ fixture: input.fixture, technical: observed,
    deterministic: deterministicRuntime, stratum })
  const invariants = Object.freeze({
    upstreamExecutionCount: 1,
    lockedPlanRebuiltForSecondBranch: false,
    sameTopic: true,
    sameAction: true,
    sameFacet: true,
    sameQueryFrameHash: true,
    sameLockedPlanHash: true,
    sameEvidenceIds: true,
    sameClaimSet: true,
    sameAnswerability: true,
    deterministicExternalProviderCalls: 0,
  })
  const trace = Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:sealed-trace@1`,
    evaluationId: EVALUATION_ID,
    pairId: input.fixture.pairId,
    fixture: input.fixture,
    supportStratum: stratum,
    normalizedInput: observed.normalizedQuery,
    routing: Object.freeze({
      topicIds: observed.queryFrame.subquestions.map((row) => row.topicId),
      action: observed.pragmaticTaskFrame.pragmaticAction,
      facets: observed.pragmaticTaskFrame.requestedFacets,
      contextOperation: observed.contextOperation,
      confidence: observed.topicResolutionConfidence,
    }),
    queryFrameHash,
    lockedPlanHash: planHash,
    evidenceIds,
    passageIds: unique(observed.plan.slots.flatMap((slot) => slot.lockedClaims.map((entry) => entry.claim.passageId))).sort(),
    invariants,
    architectureByBlindLabel: Object.freeze({
      A: lunaLabel === "A" ? "LUNA_ON" : "LUNA_OFF_DETERMINISTIC",
      B: lunaLabel === "B" ? "LUNA_ON" : "LUNA_OFF_DETERMINISTIC",
    }),
    branches: Object.freeze({
      lunaOn: Object.freeze({
        provider: lunaRuntime.provenance.realizer.provider,
        model: lunaRuntime.provenance.realizer.model,
        status: lunaRuntime.status,
        finalAnswer: lunaRuntime.answer,
        finalAnswerHash: sha(lunaRuntime.answer),
        validator: lunaRuntime.finalValidation,
        rejectedAttemptValidations: lunaRuntime.rejectedAttemptValidations,
        prompt: lunaRuntime.provenance.prompt,
        usage: lunaRuntime.provenance.usage,
        latencyMs: lunaRuntime.provenance.latencyMs,
        costMicrousd: lunaRuntime.provenance.costMicrousd,
        providerCalls: lunaRuntime.attempts.length,
        failures: limitedStatusFailures(lunaRuntime),
      }),
      lunaOff: Object.freeze({
        provider: deterministicRuntime.provenance.realizer.provider,
        model: deterministicRuntime.provenance.realizer.model,
        status: deterministicRuntime.status,
        finalAnswer: deterministicRuntime.answer,
        finalAnswerHash: sha(deterministicRuntime.answer),
        validator: deterministicRuntime.finalValidation,
        rejectedAttemptValidations: deterministicRuntime.rejectedAttemptValidations,
        prompt: deterministicRuntime.provenance.prompt,
        usage: deterministicRuntime.provenance.usage,
        latencyMs: deterministicRuntime.provenance.latencyMs,
        costMicrousd: 0,
        providerCalls: 0,
        failures: limitedStatusFailures(deterministicRuntime),
      }),
    }),
    objectiveProxy: proxy,
    adaptiveLunaSimulation: Object.freeze({ lunaOn: adaptiveLunaOn }),
    blindHumanReview: Object.freeze({ status: "PENDING_BLIND_REVIEW", preferred: null }),
  })
  return Object.freeze({ fixture: input.fixture, supportStratum: stratum, lunaLabel, answerA, answerB,
    nextContextToken, trace, lunaRuntime, deterministicRuntime, proxy, adaptiveLunaOn })
}

function blindSingle(rows: readonly PairResult[]) {
  return [
    "# Blind Luna A/B — 100",
    "",
    ...rows.flatMap((row, index) => [
      `## Pair ${String(index + 1).padStart(3, "0")}`,
      "",
      "Kullanıcı:",
      row.fixture.question,
      "",
      "Yanıt A:",
      row.answerA,
      "",
      "Yanıt B:",
      row.answerB,
      "",
    ]),
  ].join("\n")
}

function blindMultiturn(conversations: readonly Conversation[], byPairId: ReadonlyMap<string, PairResult>) {
  return [
    "# Blind Luna A/B — Multi-turn 20",
    "",
    ...conversations.flatMap((conversation, index) => [
      `## Konuşma ${String(index + 1).padStart(2, "0")}`,
      "",
      ...conversation.turns.flatMap((fixture) => {
        const row = byPairId.get(fixture.pairId)
        if (!row) return []
        return [
          `### Tur ${fixture.turnIndex}`,
          "",
          "Kullanıcı:",
          fixture.question,
          "",
          "Yanıt A:",
          row.answerA,
          "",
          "Yanıt B:",
          row.answerB,
          "",
        ]
      }),
    ]),
  ].join("\n")
}

function proxySummary(rows: readonly PairResult[]) {
  const supported = rows.filter((row) => row.supportStratum === "SUPPORTED")
  const delta = (key: keyof PairResult["proxy"]["deltasLunaMinusDeterministic"]) => {
    const values = supported.map((row) => row.proxy.deltasLunaMinusDeterministic[key])
      .filter((value): value is number => typeof value === "number")
    return Number(mean(values).toFixed(3))
  }
  return Object.freeze({
    boundary: "automatic_objective_proxies_not_used_for_win_rate_or_quality_delta",
    supportedPairCount: supported.length,
    naturalTurkishDelta: delta("legacyNaturalnessProxy"),
    completenessDelta: delta("completenessProxy"),
    directnessDelta: delta("directnessProxy"),
    clarityDelta: delta("clarityProxy"),
    coherenceDelta: delta("coherenceProxy"),
    followUpDelta: delta("followUpContinuityProxy"),
    questionSpecificityDelta: delta("questionSpecificityProxy"),
    semanticFidelityDelta: delta("semanticFidelityProxy"),
    mechanicalLanguageImprovement: delta("mechanicalLanguageImprovement"),
    repetitionImprovement: delta("repetitionImprovement"),
  })
}

function branchFailureTotals(rows: readonly PairResult[], branch: "lunaRuntime" | "deterministicRuntime") {
  const runtimes = rows.map((row) => row[branch])
  return Object.freeze({
    unsupportedAddition: runtimes.reduce((sum, runtime) => sum + runtime.finalValidation.unsupportedAdditionCount, 0),
    scienceDrift: runtimes.reduce((sum, runtime) => sum + limitedStatusFailures(runtime).scienceDrift, 0),
    certaintyDrift: runtimes.reduce((sum, runtime) => sum + limitedStatusFailures(runtime).certaintyDrift, 0),
    wrongFacet: runtimes.reduce((sum, runtime) => sum + limitedStatusFailures(runtime).wrongFacet, 0),
    wrongTopic: runtimes.reduce((sum, runtime) => sum + limitedStatusFailures(runtime).wrongTopic, 0),
    validatorRejectedAttempts: runtimes.reduce((sum, runtime) => sum + runtime.rejectedAttemptValidations.length, 0),
    validatorRejectedPairs: runtimes.filter((runtime) => runtime.rejectedAttemptValidations.length > 0).length,
    finalValidatorFailures: runtimes.filter((runtime) => !runtime.finalValidation.pass).length,
    fallbacks: runtimes.filter((runtime) => runtime.status === "deterministic_fallback").length,
  })
}

function reviewerScorecard(rows: readonly PairResult[]) {
  const dimensions = Object.freeze([
    "directness", "completeness", "natural_turkish", "clarity", "coherence",
    "unnecessary_repetition", "mechanical_template_language", "followup_continuity",
    "question_specificity", "semantic_fidelity_to_locked_plan",
  ])
  return Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:blind-scorecard@1`,
    evaluationId: EVALUATION_ID,
    status: "PENDING_BLIND_REVIEW",
    allowedPreferenceValues: Object.freeze(["A", "B", "TIE"]),
    dimensions,
    pairs: Object.freeze(rows.map((row) => Object.freeze({
      pairId: row.fixture.pairId,
      dimensionPreferences: Object.freeze(Object.fromEntries(dimensions.map((dimension) => [dimension, null]))),
      overallPreference: null,
      note: "",
    }))),
  })
}

function calculationContract() {
  return Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:blind-calculation-contract@1`,
    primaryPopulation: "SUPPORTED pairs with completed blind overallPreference",
    lunaWinRate: "LUNA-preferred supported pairs / reviewed supported pairs",
    deterministicWinRate: "DETERMINISTIC-preferred supported pairs / reviewed supported pairs",
    tieRate: "TIE supported pairs / reviewed supported pairs",
    estimatedUserFacingQualityDeltaPercent: "LUNA win rate minus DETERMINISTIC win rate; no dimension weighting",
    dimensionDelta: "LUNA preference rate minus DETERMINISTIC preference rate for that dimension",
    catalogLimitedRule: "reported separately and excluded from primary quality delta",
    adaptiveQualityLoss: "within policy-OFF supported pairs, LUNA preference rate minus DETERMINISTIC preference rate, normalized to reviewed supported pairs",
    decisionBands: Object.freeze(["<5%", "5–10%", "10–20%", ">20%"]),
    currentStatus: "PENDING_BLIND_REVIEW",
  })
}

function fileMeta(file: string) {
  const data = readFileSync(file)
  return Object.freeze({ name: path.basename(file), bytes: data.byteLength, sha256: sha(data) })
}

async function main() {
  if (!LOCAL_PREFLIGHT && !existsSync(SSD_ROOT)) throw new Error("research_ssd_not_mounted")
  const fixtures = buildFixtures()
  const fixtureValidation = validateFixture(fixtures)
  if (VALIDATE_FIXTURE_ONLY) {
    console.log(JSON.stringify(fixtureValidation))
    return
  }
  if (existsSync(OUTPUT_DIR) || existsSync(ZIP_PATH)) throw new Error("paired_luna_output_already_exists")
  const apiKey = process.env.OPENAI_API_KEY?.trim() || ""
  if (!LOCAL_PREFLIGHT && !apiKey) throw new Error("openai_api_key_missing")
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  mkdirSync(path.dirname(ZIP_PATH), { recursive: true, mode: 0o700 })
  writePrivate(FILES.sealed, "")

  const subjectId = `paired-luna-${sha(EVALUATION_ID).slice(0, 16)}`
  const telemetrySecret = sha(`${EVALUATION_ID}:telemetry`)
  const contextSecret = sha(`${EVALUATION_ID}:context`)
  const subjectIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "subject", value: subjectId })
  if (!subjectIdHash) throw new Error("paired_luna_subject_hash_failed")
  const lunaRealizer = LOCAL_PREFLIGHT ? new LocalLunaStub()
    : new CappedLunaRealizer(apiKey, `paired-luna:${sha(subjectId).slice(0, 24)}`)
  const results: PairResult[] = []

  const runConversation = async (conversation: Conversation) => {
    const conversationIdHash = hashDnaS13LimitedIdentifier({
      secret: telemetrySecret,
      kind: "conversation",
      value: `${subjectId}\u0000${conversation.conversationId}`,
    })
    if (!conversationIdHash) throw new Error("paired_luna_conversation_hash_failed")
    let token: string | null = null
    let previousLuna: string | null = null
    let previousDeterministic: string | null = null
    for (const fixture of conversation.turns) {
      if (!lunaRealizer.canStartPair()) throw new Error(lunaRealizer.stopReason ?? "luna_hard_cap_reserve_reached")
      const row = await executePair({
        fixture,
        subjectId,
        subjectIdHash,
        conversationIdHash,
        sessionId: conversationIdHash.slice(0, 40),
        contextSecret,
        contextToken: token,
        lunaRealizer,
        previousLuna,
        previousDeterministic,
      })
      results.push(row)
      appendPrivate(FILES.sealed, row.trace)
      token = row.nextContextToken
      previousLuna = row.lunaRuntime.answer
      previousDeterministic = row.deterministicRuntime.answer
      if (results.length % 10 === 0) {
        console.log(JSON.stringify({ progress: results.length, total: fixtureValidation.totalPairCount,
          lunaCalls: lunaRealizer.externalCalls, costMicrousd: lunaRealizer.totalUsage().costMicrousd }))
      }
    }
  }

  for (const fixture of fixtures.main) {
    await runConversation(Object.freeze({ conversationId: fixture.conversationId, turns: Object.freeze([fixture]) }))
  }
  for (const conversation of fixtures.conversations) await runConversation(conversation)

  const byPairId = new Map(results.map((row) => [row.fixture.pairId, row]))
  const mainRows = results.filter((row) => row.fixture.set === "single_100")
  const multiRows = results.filter((row) => row.fixture.set === "multiturn_20")
  const blind100 = blindSingle(mainRows)
  const blindMulti = blindMultiturn(fixtures.conversations, byPairId)
  if (mainRows.length !== 100 || multiRows.length !== 60 || results.length !== 160) throw new Error("paired_luna_run_incomplete")
  if (ARCHITECTURE_LEAK.test(blind100) || ARCHITECTURE_LEAK.test(blindMulti)) throw new Error("paired_luna_blind_metadata_leak")
  writePrivate(FILES.blind100, blind100)
  writePrivate(FILES.blindMultiturn, blindMulti)
  writePrivate(FILES.fixture, Object.freeze({ schemaVersion: `${SCHEMA_VERSION}:fixture@1`, ...fixtureValidation, fixtures }))
  writePrivate(FILES.scorecard, reviewerScorecard(results))
  writePrivate(FILES.calculationContract, calculationContract())

  const supported = results.filter((row) => row.supportStratum === "SUPPORTED")
  const limited = results.filter((row) => row.supportStratum === "CATALOG_LIMITED")
  const usage = lunaRealizer.totalUsage()
  const adaptiveOn = results.filter((row) => row.adaptiveLunaOn)
  const adaptiveCalls = adaptiveOn.reduce((sum, row) => sum + row.lunaRuntime.attempts.length, 0)
  const adaptiveCost = adaptiveOn.reduce((sum, row) => sum + row.lunaRuntime.provenance.costMicrousd, 0)
  const baselineLunaCalls = results.reduce((sum, row) => sum + row.lunaRuntime.attempts.length, 0)
  const upstreamInvariantFailures = results.filter((row) => !upstreamInvariantsPass(row.trace.invariants)).length
  if (upstreamInvariantFailures) throw new Error(`paired_luna_upstream_invariant_failure:${upstreamInvariantFailures}`)
  const summary = Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:summary@1`,
    evaluationId: EVALUATION_ID,
    createdAt: new Date().toISOString(),
    fixture: fixtureValidation,
    pairCount: results.length,
    supportedPairCount: supported.length,
    catalogLimitedPairCount: limited.length,
    upstreamInvariantFailures,
    blindHumanReview: Object.freeze({
      status: "PENDING_BLIND_REVIEW",
      lunaWinRate: null,
      deterministicWinRate: null,
      tieRate: null,
      estimatedUserFacingQualityDeltaPercent: null,
      decisionBand: null,
      reason: "Codex does not score user-facing answer quality; blind scorecard has not been completed.",
    }),
    objectiveProxy: proxySummary(results),
    finalFailures: Object.freeze({
      lunaOn: branchFailureTotals(results, "lunaRuntime"),
      lunaOff: branchFailureTotals(results, "deterministicRuntime"),
    }),
    usage: Object.freeze({
      lunaCalls: lunaRealizer.externalCalls,
      lunaOffProviderCalls: 0,
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
      totalIncrementalCostUsd: Number((usage.costMicrousd / 1_000_000).toFixed(6)),
      costPerPairUsd: Number((usage.costMicrousd / 1_000_000 / results.length).toFixed(8)),
      hardCapUsd: HARD_CAP_MICROUSD / 1_000_000,
      stoppedByCap: Boolean(lunaRealizer.stopReason),
    }),
    adaptiveLunaSimulation: Object.freeze({
      policyOnPairCount: adaptiveOn.length,
      policyOffPairCount: results.length - adaptiveOn.length,
      simulatedLunaCalls: adaptiveCalls,
      simulatedCostUsd: Number((adaptiveCost / 1_000_000).toFixed(6)),
      callReductionPercent: Number((100 - percent(adaptiveCalls, Math.max(1, baselineLunaCalls))).toFixed(3)),
      costReductionPercent: Number((100 - percent(adaptiveCost, Math.max(1, usage.costMicrousd))).toFixed(3)),
      simulatedQualityLossPercent: null,
      qualityStatus: "PENDING_BLIND_REVIEW",
      deployed: false,
    }),
    controls: Object.freeze({
      pairedUpstreamOnce: true,
      sameLockedPlanAndEvidence: true,
      codexQualityScoring: false,
      automaticFixes: false,
      chatEngineChanged: false,
      knowledgeCatalogChanged: false,
      sourcesChanged: false,
      productionChanged: false,
      adaptiveRuntimeLogicWritten: false,
      trainingUse: "prohibited",
    }),
  })
  writePrivate(FILES.summary, summary)
  writePrivate(FILES.readme, [
    "# DNA Chat Paired Luna Value Test",
    "",
    "Her pair için routing, retrieval ve Locked Content Plan yalnız bir kez oluşturuldu; aynı immutable plan Luna ON ve deterministic Luna OFF realizasyonlarına verildi.",
    "",
    "- `BLIND_LUNA_AB_100.md`: 100 single-message blind A/B karşılaştırması.",
    "- `BLIND_LUNA_AB_MULTITURN_20.md`: 20 konuşma ve 60 tur için blind A/B karşılaştırması.",
    "- `SEALED_LUNA_AB_TRACE.jsonl`: A/B kimliği, plan/evidence hashleri, validator ve kullanım kanıtları.",
    "- `BLIND_REVIEW_SCORECARD.json`: bağımsız değerlendiricinin dolduracağı boş scorecard.",
    "- `blind-review-calculation-contract.json`: win-rate, quality delta ve decision-band hesap sözleşmesi.",
    "",
    "Win-rate, user-facing quality delta, decision band ve adaptive quality loss bağımsız blind review tamamlanmadan hesaplanmaz. Otomatik proxy'ler bu alanların yerine kullanılmaz.",
    "Chat engine, knowledge catalog, source ve production değiştirilmemiştir.",
    "",
  ].join("\n"))

  const packageFiles = Object.values(FILES).filter((file) => file !== FILES.manifest)
  const manifest = Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:manifest@1`,
    evaluationId: EVALUATION_ID,
    files: Object.freeze(packageFiles.map(fileMeta)),
  })
  writePrivate(FILES.manifest, manifest)
  execFileSync("zip", ["-q", "-j", ZIP_PATH, ...Object.values(FILES)])
  chmodSync(ZIP_PATH, 0o600)
  console.log(JSON.stringify({
    summary,
    files: Object.values(FILES).map(fileMeta),
    zipPath: ZIP_PATH,
    zipBytes: statSync(ZIP_PATH).size,
    zipSha256: sha(readFileSync(ZIP_PATH)),
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
