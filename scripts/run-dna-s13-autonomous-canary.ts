import { createHash, createHmac, randomUUID } from "node:crypto"
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

import denseRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { calculateDnaChatLunaUsage, sumDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { DNA_CHAT_LUNA_MODEL } from "../src/lib/dna/chat/lunaPolicy"
import { resolveDnaOwnerBook, resolveDnaOwnerBookTopic, getDnaOwnerBookRuntimeStatus, type DnaOwnerBookMatch } from "../src/lib/dna/chat/ownerBookRuntime"
import { resolveDnaChatSocialConversation } from "../src/lib/dna/chat/socialConversation"
import {
  DNA_S13_QUERY_FRAME_VERSION,
  type DnaS13Claim,
  type DnaS13Depth,
  type DnaS13Focus,
  type DnaS13QueryFrame,
  type DnaS13QuestionType,
  type DnaS13Subquestion,
} from "../src/lib/dna/chat/s13/contracts"
import {
  DNA_S13_CANARY_TELEMETRY_VERSION,
  EMPTY_DNA_S13_CANARY_QUALITY,
  type DnaS13CanaryMessageRecord,
} from "../src/lib/dna/chat/s13/canary/contracts"
import { resolveDnaS13CanaryFlags, isDnaS13CanaryTester } from "../src/lib/dna/chat/s13/canary/flags"
import {
  DNA_S13_CANARY_ARCHITECTURE_HASH,
  DNA_S13_CANARY_ARCHITECTURE_VERSION,
} from "../src/lib/dna/chat/s13/canary/freeze"
import { parseDnaS13CanaryComparison } from "../src/lib/dna/chat/s13/canary/parser"
import { inspectDnaS13CanaryPrivacy } from "../src/lib/dna/chat/s13/canary/privacy"
import {
  createDnaS13ConversationState,
  dnaS13ContextOperationHasVerifiedSupport,
  resolveDnaS13ConversationContext,
  resolveDnaS13NamedTopicSurfaces,
  type DnaS13ConversationState,
} from "../src/lib/dna/chat/s13/conversationContext"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import { classifyDnaV3QueryKind, splitDnaV3Subquestions, type DnaV3QueryKind } from "../src/lib/dna/chat/v3RetrievalCore"
import { hashDnaS13Artifact } from "../src/lib/dna/chat/s13/strictHash"
import { createDnaS13StrictPlan, deterministicDnaS13StrictAnswer } from "../src/lib/dna/chat/s13/strictPlanner"
import {
  DNA_S13_REALIZER_CONTRACT_VERSION,
  type DnaS13RealizerAttempt,
  type DnaS13RealizerRequest,
  type Realizer,
} from "../src/lib/dna/chat/s13/strictRealizer"
import { runDnaS13StrictRuntime } from "../src/lib/dna/chat/s13/strictRuntime"
import {
  DNA_S13_STRICT_PROMPT_VERSION,
  dnaS13StrictContent,
  dnaS13StrictInstructions,
  dnaS13StrictRealizationSchema,
} from "../src/lib/dna/chat/s13/strictPrompt"
import { validateDnaS13StrictRealization, type DnaS13StrictPlan } from "../src/lib/dna/chat/s13/strictContracts"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const OUTPUT_BASE = path.join(
  process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD",
  "Outputs/SelfMetaAI/dna-intelligence/internal-canary/s13-strict-v4",
)
const API_URL = "https://api.openai.com/v1/responses"
const HARD_CAP_MICROUSD = 1_000_000
const CALL_RESERVE_MICROUSD = 25_000
const REQUEST_TIMEOUT_MS = 30_000
const WORKERS = 4
const NOT_AVAILABLE = "Mevcut doğrulanmış içerik bu soruyu güvenilir biçimde yanıtlamak için yeterli değil."
const RUN_ID_PATTERN = /^[a-zA-Z0-9_-]{8,100}$/u
const CRITICAL_FAILURES = new Set([
  "PRIVACY_FAILURE", "SOURCE_FAILURE", "SAFETY_FAILURE", "RELATION_FAILURE", "VALIDATOR_FALSE_NEGATIVE",
])

type FailureMode =
  | "RETRIEVAL_WRONG_TOPIC"
  | "RETRIEVAL_WEAK"
  | "QUERY_PARSE_FAILURE"
  | "FOLLOWUP_CONTEXT_FAILURE"
  | "CORRECTION_FAILURE"
  | "MISSING_SLOT"
  | "EXPLANATORY_CLAIM_IRRELEVANT"
  | "ANSWER_TOO_SHALLOW"
  | "ANSWER_TOO_VERBOSE"
  | "UNNATURAL_TURKISH"
  | "UNNECESSARY_ABSTENTION"
  | "UNNECESSARY_WARNING"
  | "COMPARISON_FAILURE"
  | "RELATION_FAILURE"
  | "VALIDATOR_FALSE_POSITIVE"
  | "VALIDATOR_FALSE_NEGATIVE"
  | "FALLBACK_QUALITY"
  | "SOCIAL_ROUTING_FAILURE"
  | "PRIVACY_FAILURE"
  | "SOURCE_FAILURE"
  | "SAFETY_FAILURE"
  | "OTHER"

type ExpectedBehavior = "supported" | "follow_up" | "correction" | "comparison" | "social" | "unsupported"
type CanaryStage = "smoke" | "autonomous"
type LunaValueClass =
  | "LUNA_CLEARLY_USEFUL"
  | "LUNA_PROBABLY_USEFUL"
  | "DETERMINISTIC_MAY_HAVE_BEEN_ENOUGH"
  | "LUNA_CALL_POSSIBLY_UNNECESSARY"

type ScenarioMessage = Readonly<{
  question: string
  depth: DnaS13Depth
  expectedBehavior: ExpectedBehavior
  expectedTopicLabels: readonly string[]
}>

type ScenarioConversation = Readonly<{
  id: string
  stage: CanaryStage
  messages: readonly ScenarioMessage[]
}>

type StoredMessage = DnaS13CanaryMessageRecord & Readonly<{
  stage: CanaryStage
  conversationId: string
  turnIndex: number
  expectedBehavior: ExpectedBehavior
  expectedTopicLabels: readonly string[]
  previousTopicIds: readonly string[]
  deterministicBaseline: string | null
  lunaValueClass: LunaValueClass | null
  privacyGateBlocked: boolean
  nextConversationState: DnaS13ConversationState | null
}>

type AutomaticQualityReview = Readonly<{
  schemaVersion: "dna-s13-automatic-quality-review@1"
  stage: CanaryStage
  conversationId: string
  messageId: string
  createdAt: string
  evaluatorKind: "automatic_heuristic_not_human"
  objective: Readonly<{
    validatorPass: boolean
    selectedTopicIds: readonly string[]
    selectedRequiredClaimIds: readonly string[]
    selectedExplanatoryClaimIds: readonly string[]
    missingRequiredSlotIds: readonly string[]
    relationViolation: number
    sourceViolation: number
    safetyViolation: number
    repaired: boolean
    fallback: boolean
    costMicrousd: number
    latencyMs: number
  }>
  ux: Readonly<{
    answerRelevant: boolean | null
    apparentComplete: boolean | null
    followUpContinuity: boolean | null
    questionCenterCovered: boolean | null
    comparisonComplete: boolean | null
    unnecessaryAbstention: boolean
    unnecessaryWarning: boolean
    mechanicalOrRepetitiveLanguage: boolean
    depthAppropriate: boolean | null
    fallbackQualityAcceptable: boolean | null
    retrievalTopicConsistent: boolean | null
    overallQuality: number
    acceptable: boolean
    good: boolean
  }>
  failureModes: readonly FailureMode[]
  lunaValueClass: LunaValueClass | null
}>

type RunPaths = ReturnType<typeof runPaths>

function runPaths(runId: string) {
  const root = path.join(OUTPUT_BASE, runId)
  return Object.freeze({
    root,
    messages: path.join(root, "messages.jsonl"),
    provenance: path.join(root, "provenance.jsonl"),
    privacy: path.join(root, "privacy-rejections.jsonl"),
    reviews: path.join(root, "automatic-quality-review.jsonl"),
    triage: path.join(root, "failure-triage.jsonl"),
    training: path.join(root, "training-annotations.jsonl"),
    cost: path.join(root, "cost-analysis.json"),
    latency: path.join(root, "latency-analysis.json"),
    summary: path.join(root, "canary-summary.json"),
    report: path.join(root, "INTERNAL_CANARY_REPORT.md"),
    manifest: path.join(root, "manifest.json"),
    smoke: path.join(root, "smoke-gate.json"),
  })
}

function stable(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writePrivate(file: string, value: unknown) {
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}

function appendPrivate(file: string, value: unknown) {
  appendFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function fileMeta(file: string) {
  const value = readFileSync(file)
  return Object.freeze({ sha256: sha(value), bytes: value.byteLength })
}

function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))] ?? 0
}

function mean(values: readonly number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function rate(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function focusFor(kind: DnaV3QueryKind): DnaS13Focus {
  if (kind === "definition") return "definition"
  if (kind === "comparison") return "comparison"
  if (["relation", "dna_relation"].includes(kind)) return "relation"
  if (kind === "measurement") return "measurement"
  if (kind === "development") return "development"
  if (kind === "evidence") return "evidence"
  if (kind === "misconception") return "interpretation_boundary"
  return "general"
}

function questionTypeFor(kind: DnaV3QueryKind): DnaS13QuestionType {
  if (["definition", "comparison", "relation", "measurement", "development", "evidence"].includes(kind)) {
    return kind as DnaS13QuestionType
  }
  if (kind === "dna_relation") return "relation"
  if (kind === "misconception") return "explanation"
  return "unknown"
}

function claimsForMatch(match: DnaOwnerBookMatch): readonly DnaS13Claim[] {
  return Object.freeze([match.summary, ...match.details].map((text, index) => Object.freeze({
    id: match.claimIds[index] ?? `owner-book-claim:${hashDnaS13Artifact({ text }).slice(0, 16)}`,
    text,
    passageId: match.passageIds[index] ?? `owner-book-passage:${hashDnaS13Artifact({ text }).slice(0, 16)}`,
    sourceIds: Object.freeze([match.sourceId]),
    topicId: match.topicId,
    focus: "general",
    title: match.topic,
    domain: "self_regulation",
    dimensions: Object.freeze(["general"]),
    authorityClass: "owner_approved_book",
    citationStatus: match.citationStatus,
    answerEligible: true,
  })))
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null
  const row = payload as Record<string, unknown>
  if (typeof row.output_text === "string" && row.output_text.trim()) return row.output_text.trim()
  if (!Array.isArray(row.output)) return null
  for (const output of row.output) {
    if (!output || typeof output !== "object" || !Array.isArray((output as Record<string, unknown>).content)) continue
    for (const item of (output as Record<string, unknown>).content as unknown[]) {
      if (item && typeof item === "object" && typeof (item as Record<string, unknown>).text === "string") {
        const text = String((item as Record<string, unknown>).text).trim()
        if (text) return text
      }
    }
  }
  return null
}

function providerUsage(payload: unknown) {
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const raw = row.usage && typeof row.usage === "object" ? row.usage as Record<string, unknown> : {}
  const details = raw.input_tokens_details && typeof raw.input_tokens_details === "object"
    ? raw.input_tokens_details as Record<string, unknown> : {}
  return calculateDnaChatLunaUsage({
    inputTokens: raw.input_tokens,
    cachedInputTokens: details.cached_tokens,
    outputTokens: raw.output_tokens,
  })
}

class SharedBudget {
  usage: DnaChatLunaUsage[] = []
  inflight = 0
  stopReason: string | null = null

  constructor(readonly priorAttemptCostMicrousd = 0) {
    if (!Number.isSafeInteger(priorAttemptCostMicrousd) || priorAttemptCostMicrousd < 0) {
      throw new Error("autonomous_canary_prior_cost_invalid")
    }
  }

  total() {
    const current = sumDnaChatLunaUsage(this.usage)
    return Object.freeze({ ...current, costMicrousd: current.costMicrousd + this.priorAttemptCostMicrousd })
  }

  acquire() {
    const cost = this.total().costMicrousd
    if (this.stopReason || cost + (this.inflight + 1) * CALL_RESERVE_MICROUSD > HARD_CAP_MICROUSD) {
      this.stopReason = this.stopReason ?? "luna_hard_cap_reserve_reached"
      return false
    }
    this.inflight += 1
    return true
  }

  release(usage: DnaChatLunaUsage | null) {
    this.inflight = Math.max(0, this.inflight - 1)
    if (usage) this.usage.push(usage)
    if (this.total().costMicrousd > HARD_CAP_MICROUSD) throw new Error("luna_hard_cap_exceeded")
  }
}

class BudgetedLunaRealizer implements Realizer {
  readonly identity = Object.freeze({
    provider: "luna" as const,
    model: DNA_CHAT_LUNA_MODEL,
    implementationVersion: "dna-s13-autonomous-canary-luna-adapter@1",
  })
  externalCalls = 0
  deniedCalls = 0

  constructor(
    private readonly budget: SharedBudget,
    private readonly apiKey: string,
    private readonly safetyIdentifier: string,
  ) {}

  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    const instructions = `${DNA_S13_STRICT_PROMPT_VERSION}. ${dnaS13StrictInstructions(input.validationFailureCodes)}`
    const content = dnaS13StrictContent(input.question, input.plan, input.previousCandidate)
    const schema = dnaS13StrictRealizationSchema(input.plan)
    const prompt = Object.freeze({
      version: DNA_S13_STRICT_PROMPT_VERSION,
      hash: hashDnaS13Artifact({ model: DNA_CHAT_LUNA_MODEL, schema, instructions, content }),
    })
    if (!this.budget.acquire()) {
      this.deniedCalls += 1
      return Object.freeze({
        contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
        identity: this.identity,
        prompt,
        realization: null,
        rawOutput: null,
        responseId: null,
        usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
        latencyMs: 0,
      })
    }
    this.externalCalls += 1
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const started = performance.now()
    let usage: DnaChatLunaUsage | null = null
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: DNA_CHAT_LUNA_MODEL,
          store: false,
          reasoning: { effort: "none" },
          safety_identifier: this.safetyIdentifier,
          instructions,
          input: content,
          max_output_tokens: input.plan.responseDepth === "deep" ? 1_100 : input.plan.responseDepth === "short" ? 320 : 760,
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: input.attempt === "repair" ? "dna_s13_canary_repair" : "dna_s13_canary_realization",
              strict: true,
              schema,
            },
          },
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        return Object.freeze({
          contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION, identity: this.identity, prompt,
          realization: null, rawOutput: null, responseId: null,
          usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
          latencyMs: performance.now() - started,
        })
      }
      const payload = await response.json() as unknown
      usage = providerUsage(payload)
      const rawOutput = responseText(payload)
      let candidate: unknown = null
      if (rawOutput) {
        try { candidate = JSON.parse(rawOutput) as unknown } catch { candidate = null }
      }
      const realization = validateDnaS13StrictRealization(
        candidate,
        input.plan.slots.map((slot) => slot.id),
        input.plan.lockedClaimIds,
      )
      const responseRow = payload as Record<string, unknown>
      return Object.freeze({
        contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
        identity: this.identity,
        prompt,
        realization,
        rawOutput,
        responseId: typeof responseRow.id === "string" ? responseRow.id : null,
        usage,
        latencyMs: performance.now() - started,
      })
    } catch {
      return Object.freeze({
        contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION, identity: this.identity, prompt,
        realization: null, rawOutput: null, responseId: null,
        usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
        latencyMs: performance.now() - started,
      })
    } finally {
      clearTimeout(timeout)
      this.budget.release(usage)
    }
  }
}

function seededShuffle<T>(values: readonly T[], seedSource: string) {
  let state = Number.parseInt(sha(seedSource).slice(0, 8), 16) >>> 0
  const random = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target]!, result[index]!]
  }
  return result
}

function topicPool(runId: string) {
  const rows = denseRuntimeJson as unknown as { units: readonly { title?: string }[] }
  const titles = unique(rows.units.map((row) => String(row.title || "").trim()))
    .filter((title) => title.length >= 5 && title.length <= 58)
    .filter((title) => !/[\n:;()]/u.test(title))
    .filter((title) => inspectDnaS13CanaryPrivacy(`${title} nedir?`).allowed)
    .filter((title) => resolveDnaS13NamedTopicSurfaces(title).length === 1)
    .filter((title) => Boolean(resolveDnaOwnerBookTopic(resolveDnaS13NamedTopicSurfaces(title)[0]!.topicId, "bunu açıkla", "short")))
  return seededShuffle(titles, runId).slice(0, 160)
}

function startMessage(topic: string, variant: number): ScenarioMessage {
  const forms = [
    `${topic} başlığı özünde ne anlatıyor?`,
    `Katalogdaki ${topic} ifadesini kısa ve net açıklar mısın?`,
    `${topic} kavramını teknik ayrıntıya boğmadan tanıtır mısın?`,
    `${topic} tam olarak hangi anlamda kullanılıyor?`,
    `${topic} için anlaşılır bir başlangıç açıklaması verir misin?`,
    `${topic} başlığını sade ama bilimsel sınırlar içinde anlatır mısın?`,
  ]
  return Object.freeze({
    question: forms[variant % forms.length]!,
    depth: variant % 5 === 0 ? "short" : variant % 7 === 0 ? "deep" : "standard",
    expectedBehavior: "supported",
    expectedTopicLabels: Object.freeze([topic]),
  })
}

function conversationMessages(topicA: string, topicB: string, length: number, variant: number): ScenarioMessage[] {
  const socialFirst = variant % 9 === 0
  const messages: ScenarioMessage[] = []
  if (socialFirst) {
    const greetings = ["merhabalar", "selamlar", "iyi günler", "günaydın"]
    messages.push(Object.freeze({ question: greetings[variant % greetings.length]!, depth: "short", expectedBehavior: "social", expectedTopicLabels: Object.freeze([]) }))
  } else {
    messages.push(startMessage(topicA, variant))
  }
  const patterns: ScenarioMessage[] = [
    socialFirst ? startMessage(topicA, variant + 1) : Object.freeze({
      question: [
        "bu ne demek, biraz açar mısın?",
        "nasıl yani, daha anlaşılır söyler misin?",
        "bunun anlamı ne, kısa açıklar mısın?",
        "burada ne anlatılıyor, aynı başlıkta kalır mısın?",
      ][variant % 4]!,
      depth: "deep",
      expectedBehavior: "follow_up",
      expectedTopicLabels: Object.freeze([topicA]),
    }),
    Object.freeze({
      question: variant % 2
        ? `${topicA} ile ${topicB} aynı şey mi, kavramsal düzeyi belirtir misin?`
        : `${topicA} ile ${topicB} arasındaki fark nedir, kısa karşılaştırır mısın?`,
      depth: "standard",
      expectedBehavior: "comparison",
      expectedTopicLabels: Object.freeze([topicA, topicB]),
    }),
    Object.freeze({
      question: [
        `yok, ${topicB} başlığını kastettim`,
        `onu değil ${topicB}; bu kısmı anlat`,
        `demek istediğim ${topicB}`,
        "hayır ikinci kısmı soruyorum",
        "ilkini değil diğerini soruyorum",
      ][variant % 5]!,
      depth: "standard",
      expectedBehavior: "correction",
      expectedTopicLabels: Object.freeze([topicB]),
    }),
    Object.freeze({
      question: `${topicA} için kısa anlam nedir? Ardından ${topicB} neden önemli, ikisini ayrı yanıtlar mısın?`,
      depth: "short",
      expectedBehavior: "supported",
      expectedTopicLabels: Object.freeze([topicA, topicB]),
    }),
    Object.freeze({
      question: [
        "daha sade anlat, teknik terimleri azaltır mısın?",
        "bunun önemi ne, yalnız doğrulanmış ilişkiyi söyle",
        "biraz daha aç ama aynı konuda kal",
        "peki bunun kaynakları ne diyor, başlığı değiştirme",
      ][variant % 4]!,
      depth: "standard",
      expectedBehavior: "follow_up",
      expectedTopicLabels: Object.freeze([topicB]),
    }),
    Object.freeze({
      question: variant % 4 === 0
        ? `${topicB} başlığı tek başına kesin bir sonuç veya tanı anlamına gelir mi?`
        : `${topicB} her durumda aynı sonucu kanıtlıyor sayılır mı?`,
      depth: "standard",
      expectedBehavior: "supported",
      expectedTopicLabels: Object.freeze([topicB]),
    }),
    Object.freeze({
      question: variant % 5 === 0 ? "Astrofizikte karanlık madde halesi nasıl ölçülür?" : `${topicA} konusunu bir kademe daha detaylandır ama gereksiz uzatma`,
      depth: variant % 5 === 0 ? "standard" : "deep",
      expectedBehavior: variant % 5 === 0 ? "unsupported" : "supported",
      expectedTopicLabels: variant % 5 === 0 ? Object.freeze([]) : Object.freeze([topicA]),
    }),
  ]
  while (messages.length < length) messages.push(patterns[(messages.length - 1) % patterns.length]!)
  return messages.slice(0, length)
}

function buildConversations(stage: CanaryStage, topics: readonly string[]) {
  const lengths = stage === "smoke"
    ? Array.from({ length: 10 }, () => 3)
    : [...Array.from({ length: 10 }, () => 2), ...Array.from({ length: 20 }, () => 5), ...Array.from({ length: 10 }, () => 8)]
  return Object.freeze(lengths.map((length, index) => Object.freeze({
    id: `${stage}-conversation-${String(index + 1).padStart(2, "0")}`,
    stage,
    messages: Object.freeze(conversationMessages(
      topics[(index * 2) % topics.length]!,
      topics[(index * 2 + 1) % topics.length]!,
      length,
      index + (stage === "smoke" ? 100 : 1_000),
    )),
  })))
}

function privacySafeConversations(conversations: readonly ScenarioConversation[], topics: readonly string[]) {
  let replacementCursor = 0
  return Object.freeze(conversations.map((conversation) => Object.freeze({
    ...conversation,
    messages: Object.freeze(conversation.messages.map((message) => {
      if (inspectDnaS13CanaryPrivacy(message.question).allowed) return message
      const replacement = startMessage(topics[replacementCursor % topics.length]!, replacementCursor + 2_000)
      replacementCursor += 1
      return replacement
    })),
  })))
}

function regressionQuestions() {
  const file = path.join(
    process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD",
    "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux/s13-strict-regression-v3/s13-strict-40-regression-raw.json",
  )
  if (!existsSync(file)) return new Set<string>()
  const payload = JSON.parse(readFileSync(file, "utf8")) as { rows?: readonly { question?: string }[] }
  return new Set((payload.rows ?? []).map((row) => normalizeDnaChatText(String(row.question || ""))))
}

function assertNotRegressionReuse(conversations: readonly ScenarioConversation[]) {
  const regression = regressionQuestions()
  const duplicates = conversations.flatMap((conversation) => conversation.messages)
    .filter((message) => regression.has(normalizeDnaChatText(message.question)))
  if (duplicates.length) throw new Error("autonomous_canary_regression_question_reuse_detected")
}

function assertNotRun003Reuse(conversations: readonly ScenarioConversation[]) {
  const file = path.join(OUTPUT_BASE, "run-20260810-autonomous-003", "messages.jsonl")
  if (!existsSync(file)) return
  const prior = new Set(readFileSync(file, "utf8").trim().split("\n").filter(Boolean)
    .map((line) => normalizeDnaChatText(String((JSON.parse(line) as { question?: string }).question || ""))))
  const duplicates = conversations.flatMap((conversation) => conversation.messages)
    .filter((message) => prior.has(normalizeDnaChatText(message.question)))
  if (duplicates.length) throw new Error(`autonomous_canary_v2_prior_message_reuse_detected:${duplicates.length}`)
}

function unsupportedRecord(input: Readonly<{
  stage: CanaryStage
  conversationId: string
  turnIndex: number
  sessionId: string
  testerIdHash: string
  messageId: string
  question: string
  answer: string
  privacy: ReturnType<typeof inspectDnaS13CanaryPrivacy>["classification"]
  intent: "social_product" | "unsupported"
  expected: ScenarioMessage
  previousTopicIds: readonly string[]
  latencyMs: number
  privacyGateBlocked?: boolean
}>): StoredMessage {
  const social = input.intent === "social_product"
  return Object.freeze({
    schemaVersion: DNA_S13_CANARY_TELEMETRY_VERSION,
    architectureVersion: DNA_S13_CANARY_ARCHITECTURE_VERSION,
    architectureHash: DNA_S13_CANARY_ARCHITECTURE_HASH,
    sessionId: input.sessionId,
    messageId: input.messageId,
    createdAt: new Date().toISOString(),
    testerIdHash: input.testerIdHash,
    question: input.question,
    normalizedQuestion: normalizeDnaChatText(input.question),
    answer: input.answer,
    privacy: input.privacy,
    routing: Object.freeze({
      intent: Object.freeze([social ? "social_product" : "unsupported"]), detectedTopicIds: Object.freeze([]),
      focus: Object.freeze(["general"]), questionType: Object.freeze([social ? "product_help" : "unknown"]),
      followUp: input.expected.expectedBehavior === "follow_up", correction: input.expected.expectedBehavior === "correction",
      subquestionCount: 1, answerability: Object.freeze([social ? "supported" : "unsupported"]),
      comparisonMode: null, parserUncertainty: !social,
    }),
    retrieval: Object.freeze({
      candidateCount: 0, selectedRequiredClaimIds: Object.freeze([]), selectedExplanatoryClaimIds: Object.freeze([]),
      confidence: null, contribution: Object.freeze({ lexical: null, semantic: null, graph: null }),
      comparisonSideACovered: null, comparisonSideBCovered: null,
      missingRequiredSlotIds: Object.freeze(social ? [] : ["q1"]),
    }),
    realization: Object.freeze({
      provider: "none", status: "not_answered", firstPassValidatorPassed: null, repairValidatorPassed: null,
      inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, latencyMs: input.latencyMs, costMicrousd: 0,
      cache: "not_applicable", lunaCalls: 0, repairCalls: 0,
    }),
    validation: Object.freeze({
      pass: social, wrongClaimSubstitution: 0, claimViolation: 0, relationViolation: 0,
      comparisonConclusionViolation: 0, unsupportedAddition: 0, sourceViolation: 0, safetyViolation: 0,
      failureCodes: Object.freeze(social ? [] : ["not_answered"]),
    }),
    quality: EMPTY_DNA_S13_CANARY_QUALITY,
    training: Object.freeze({ training_candidate: false, exclude_from_training: true, exclusion_reason: "not_answered" }),
    provenanceHash: null,
    provenance: null,
    stage: input.stage,
    conversationId: input.conversationId,
    turnIndex: input.turnIndex,
    expectedBehavior: input.expected.expectedBehavior,
    expectedTopicLabels: input.expected.expectedTopicLabels,
    previousTopicIds: input.previousTopicIds,
    deterministicBaseline: null,
    lunaValueClass: null,
    privacyGateBlocked: input.privacyGateBlocked === true,
    nextConversationState: null,
  })
}

function jaccard(left: string, right: string) {
  const tokens = (value: string) => new Set(normalizeDnaChatText(value).split(" ").filter((token) => token.length >= 4))
  const a = tokens(left)
  const b = tokens(right)
  const union = new Set([...a, ...b])
  return union.size ? [...a].filter((token) => b.has(token)).length / union.size : 0
}

function lunaValueClass(input: Readonly<{
  answer: string
  deterministic: string
  status: string
  slotCount: number
  followUp: boolean
}>): LunaValueClass {
  if (input.status === "deterministic_fallback") return "LUNA_CALL_POSSIBLY_UNNECESSARY"
  const similarity = jaccard(input.answer, input.deterministic)
  if (similarity >= 0.82 && input.slotCount === 1 && !input.followUp) return "DETERMINISTIC_MAY_HAVE_BEEN_ENOUGH"
  if (input.slotCount >= 2 || input.followUp) return "LUNA_CLEARLY_USEFUL"
  return similarity < 0.58 ? "LUNA_PROBABLY_USEFUL" : "DETERMINISTIC_MAY_HAVE_BEEN_ENOUGH"
}

async function runMessage(input: Readonly<{
  stage: CanaryStage
  conversationId: string
  turnIndex: number
  sessionId: string
  testerIdHash: string
  scenario: ScenarioMessage
  conversationState: DnaS13ConversationState | null
  budget: SharedBudget
  apiKey: string
  safetyIdentifier: string
}>): Promise<StoredMessage> {
  const started = performance.now()
  const question = input.scenario.question.trim().slice(0, 600)
  const previousTopicIds = input.conversationState?.lastEligibleTopicIds ?? Object.freeze([])
  const messageId = randomUUID()
  const privacy = inspectDnaS13CanaryPrivacy(question)
  if (!privacy.allowed) {
    const questionHash = hashDnaS13Artifact({ question })
    return unsupportedRecord({
      stage: input.stage, conversationId: input.conversationId, turnIndex: input.turnIndex,
      sessionId: input.sessionId, testerIdHash: input.testerIdHash, messageId,
      question: `[privacy-blocked-generated-scenario:${questionHash}]`,
      answer: "Bu generated internal canary senaryosu privacy/safety kapısı tarafından external realization öncesinde engellendi.",
      privacy: privacy.classification, intent: "unsupported", expected: input.scenario,
      previousTopicIds, latencyMs: performance.now() - started,
      privacyGateBlocked: true,
    })
  }
  const social = resolveDnaChatSocialConversation(question)
  if (social) return unsupportedRecord({
    stage: input.stage, conversationId: input.conversationId, turnIndex: input.turnIndex,
    sessionId: input.sessionId, testerIdHash: input.testerIdHash, messageId, question,
    answer: social.summary, privacy: privacy.classification, intent: "social_product", expected: input.scenario,
    previousTopicIds, latencyMs: performance.now() - started,
  })

  const comparison = parseDnaS13CanaryComparison(question)
  const contextResolution = comparison ? null : resolveDnaS13ConversationContext({
    sessionId: input.sessionId,
    question,
    responseDepth: input.scenario.depth,
    privacyAllowed: privacy.allowed,
    state: input.conversationState,
  })
  if (contextResolution?.operation === "clarification_required") return unsupportedRecord({
    stage: input.stage, conversationId: input.conversationId, turnIndex: input.turnIndex,
    sessionId: input.sessionId, testerIdHash: input.testerIdHash, messageId, question,
    answer: NOT_AVAILABLE, privacy: privacy.classification, intent: "unsupported", expected: input.scenario,
    previousTopicIds, latencyMs: performance.now() - started,
  })
  const split = comparison ? { questions: comparison, exceedsLimit: false }
    : contextResolution?.targetTopicIds.length
      ? { questions: contextResolution.retrievalQuestions, exceedsLimit: false }
      : splitDnaV3Subquestions(question)
  const questions = split.questions.slice(0, 2)
  const matches = questions.map((subquestion, index) => {
    const targetTopicId = contextResolution?.targetTopicIds[index]
    return targetTopicId
      ? resolveDnaOwnerBookTopic(targetTopicId, subquestion, contextResolution?.responseDepth ?? input.scenario.depth)
      : resolveDnaOwnerBook(subquestion, previousTopicIds, input.scenario.depth)
  })
  if (matches.some((match) => !match)) return unsupportedRecord({
    stage: input.stage, conversationId: input.conversationId, turnIndex: input.turnIndex,
    sessionId: input.sessionId, testerIdHash: input.testerIdHash, messageId, question,
    answer: NOT_AVAILABLE, privacy: privacy.classification, intent: "unsupported", expected: input.scenario,
    previousTopicIds, latencyMs: performance.now() - started,
  })
  const resolved = matches as DnaOwnerBookMatch[]
  if (contextResolution && resolved.some((match) =>
    !dnaS13ContextOperationHasVerifiedSupport(contextResolution.operation, match))) return unsupportedRecord({
    stage: input.stage, conversationId: input.conversationId, turnIndex: input.turnIndex,
    sessionId: input.sessionId, testerIdHash: input.testerIdHash, messageId, question,
    answer: NOT_AVAILABLE, privacy: privacy.classification, intent: "unsupported", expected: input.scenario,
    previousTopicIds, latencyMs: performance.now() - started,
  })
  const comparisonTargets = comparison ? Object.freeze(resolved.map((match) => match.topicId)) : Object.freeze([])
  const normalizedQuestion = normalizeDnaChatText(question)
  const followUp = contextResolution?.followUp ?? false
  const correction = contextResolution?.correction ?? false
  const subquestions: DnaS13Subquestion[] = resolved.map((match, index) => {
    const kind = comparison ? "comparison" : classifyDnaV3QueryKind(question)
    return Object.freeze({
      id: `q${index + 1}`, question: questions[index] ?? question, intent: "scientific_question" as const,
      topicId: match.topicId, focus: focusFor(kind),
      questionType: comparison ? "comparison" as const : followUp ? "follow_up" as const : questionTypeFor(kind),
      followUp, correction, comparisonTargetTopicIds: comparisonTargets, answerabilityHint: "supported" as const,
    })
  })
  const frame: DnaS13QueryFrame = Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION, normalizedQuestion,
    responseDepth: contextResolution?.responseDepth ?? input.scenario.depth,
    uncertain: split.exceedsLimit, subquestions: Object.freeze(subquestions),
  })
  const claims = resolved.map(claimsForMatch)
  const plan = createDnaS13StrictPlan({
    frame,
    requiredClaimsBySubquestion: Object.fromEntries(subquestions.map((row, index) => [row.id, claims[index]!.slice(0, 1)])),
    explanatoryCandidatesBySubquestion: Object.fromEntries(subquestions.map((row, index) => [row.id, claims[index]!])),
  })
  const realizer = new BudgetedLunaRealizer(input.budget, input.apiKey, input.safetyIdentifier)
  const catalog = getDnaOwnerBookRuntimeStatus()
  const result = await runDnaS13StrictRuntime({
    question, normalizedQuestion, queryFrame: frame, plan, realizer,
    catalog: Object.freeze({ version: catalog.retrievalVersion, hash: catalog.sourceSha256 }),
    retrieval: Object.freeze({ version: catalog.retrievalVersion, hash: hashDnaS13Artifact({ questions, matches: resolved }) }),
    privacy: privacy.classification,
    trainingCandidateRequested: false,
  })
  const deterministic = deterministicDnaS13StrictAnswer(plan)
  const valueClass = lunaValueClass({
    answer: result.answer, deterministic, status: result.status, slotCount: plan.slots.length, followUp,
  })
  const rejectedCodes = unique(result.rejectedValidations.flatMap((validation) => validation.failureCodes))
  const allCodes = unique([...result.validation.failureCodes, ...rejectedCodes])
  const comparisonSlots = plan.slots.filter((slot) => slot.kind === "comparison_side")
  const trainingReason = !result.validation.pass ? "validator_not_passed" as const
    : result.status === "deterministic_fallback" ? "fallback_or_rejected" as const : "review_pending" as const
  const nextConversationState = createDnaS13ConversationState({
    sessionId: input.sessionId,
    question,
    normalizedQuestion,
    responseDepth: frame.responseDepth,
    queryFrame: frame,
    plan,
    validationPassed: result.validation.pass,
    privacyCategory: privacy.classification.category,
  })
  return Object.freeze({
    schemaVersion: DNA_S13_CANARY_TELEMETRY_VERSION,
    architectureVersion: DNA_S13_CANARY_ARCHITECTURE_VERSION,
    architectureHash: DNA_S13_CANARY_ARCHITECTURE_HASH,
    sessionId: input.sessionId,
    messageId,
    createdAt: new Date().toISOString(),
    testerIdHash: input.testerIdHash,
    question,
    normalizedQuestion,
    answer: result.answer,
    privacy: privacy.classification,
    routing: Object.freeze({
      intent: Object.freeze(subquestions.map((row) => row.intent)),
      detectedTopicIds: Object.freeze(subquestions.map((row) => row.topicId)),
      focus: Object.freeze(subquestions.map((row) => row.focus)),
      questionType: Object.freeze(subquestions.map((row) => row.questionType)),
      followUp, correction, subquestionCount: subquestions.length,
      answerability: Object.freeze(subquestions.map((row) => row.answerabilityHint)),
      comparisonMode: plan.comparisonConclusionMode ?? null,
      parserUncertainty: frame.uncertain,
    }),
    retrieval: Object.freeze({
      candidateCount: resolved.reduce((sum, match) => sum + match.claimIds.length, 0),
      selectedRequiredClaimIds: result.provenance.requiredClaimIds,
      selectedExplanatoryClaimIds: result.provenance.explanatoryClaimIds,
      confidence: resolved.length ? Math.min(...resolved.map((match) => match.headingCoverage)) : null,
      contribution: Object.freeze({ lexical: 1, semantic: 0, graph: 0 }),
      comparisonSideACovered: comparisonSlots.length ? result.validation.comparisonSideASupported : null,
      comparisonSideBCovered: comparisonSlots.length ? result.validation.comparisonSideBSupported : null,
      missingRequiredSlotIds: Object.freeze(result.validation.pass ? [] : plan.slots
        .filter((slot) => !result.realization?.slotRealizations.some((item) => item.slotId === slot.id))
        .map((slot) => slot.id)),
    }),
    realization: Object.freeze({
      provider: "luna", status: result.status,
      firstPassValidatorPassed: result.status === "realized" ? true : result.rejectedValidations[0] ? false : null,
      repairValidatorPassed: result.status === "repaired" ? true : result.attempts.length > 1 ? false : null,
      inputTokens: result.provenance.usage.inputTokens,
      cachedInputTokens: result.provenance.usage.cachedInputTokens,
      outputTokens: result.provenance.usage.outputTokens,
      latencyMs: performance.now() - started,
      costMicrousd: result.provenance.costMicrousd,
      cache: result.provenance.usage.cachedInputTokens > 0 ? "hit" : "miss",
      lunaCalls: realizer.externalCalls,
      repairCalls: realizer.externalCalls > 1 ? 1 : 0,
    }),
    validation: Object.freeze({
      pass: result.validation.pass,
      wrongClaimSubstitution: result.validation.wrongClaimSubstitutionCount,
      claimViolation: allCodes.filter((code) => ["required_claim_missing", "locked_claim_missing", "wrong_claim_substitution"].includes(code)).length,
      relationViolation: result.validation.unsupportedRelationCount,
      comparisonConclusionViolation: result.validation.failureCodes.filter((code) => code.startsWith("comparison_conclusion_")).length,
      unsupportedAddition: result.validation.unsupportedAdditionCount,
      sourceViolation: result.validation.sourceViolationCount,
      safetyViolation: result.validation.safetyViolationCount,
      failureCodes: Object.freeze(allCodes),
    }),
    quality: EMPTY_DNA_S13_CANARY_QUALITY,
    training: Object.freeze({ training_candidate: false, exclude_from_training: true, exclusion_reason: trainingReason }),
    provenanceHash: result.provenance.provenanceHash,
    provenance: result.provenance,
    stage: input.stage,
    conversationId: input.conversationId,
    turnIndex: input.turnIndex,
    expectedBehavior: input.scenario.expectedBehavior,
    expectedTopicLabels: input.scenario.expectedTopicLabels,
    previousTopicIds,
    deterministicBaseline: deterministic,
    lunaValueClass: valueClass,
    privacyGateBlocked: false,
    nextConversationState,
  })
}

function topicConsistent(message: StoredMessage) {
  if (!message.expectedTopicLabels.length || ["social", "unsupported", "follow_up"].includes(message.expectedBehavior)) return null
  if (!message.routing.detectedTopicIds.length || !message.provenance) return false
  const evidence = normalizeDnaChatText(message.provenance.requiredAnswerSlots
    .map((slot) => slot.lockedClaims.map((entry) => `${entry.claim.title ?? ""} ${entry.claim.text}`).join(" ")).join(" "))
  return message.expectedTopicLabels.every((label) => {
    const tokens = normalizeDnaChatText(label).split(" ").filter((token) => token.length >= 4)
    return tokens.length === 0 || tokens.some((token) => evidence.includes(token))
  })
}

function automaticReview(message: StoredMessage, prior: StoredMessage | null): AutomaticQualityReview {
  const failures = new Set<FailureMode>()
  const supportedExpected = !["social", "unsupported"].includes(message.expectedBehavior)
  const abstained = message.answer === NOT_AVAILABLE || /yeterli (?:değil|degil)|güvenilir biçimde yanıtlamak/u.test(normalizeDnaChatText(message.answer))
  const warning = /tanı koymaz|tedavi önermez|acil|uzmana başvur/u.test(normalizeDnaChatText(message.answer))
  const sentences = message.answer.split(/(?<=[.!?])\s+/u).map((value) => normalizeDnaChatText(value)).filter(Boolean)
  const mechanical = new Set(sentences).size < sentences.length
  const consistent = topicConsistent(message)
  const complete = supportedExpected ? message.validation.pass && message.retrieval.missingRequiredSlotIds.length === 0 : null
  const followUpContinuity = message.expectedBehavior === "follow_up"
    ? Boolean(message.routing.detectedTopicIds.length && prior
      && (message.routing.detectedTopicIds.some((topicId) => prior.routing.detectedTopicIds.includes(topicId)) || message.previousTopicIds.includes(message.routing.detectedTopicIds[0]!)))
    : null
  const comparisonComplete = message.expectedBehavior === "comparison"
    ? message.retrieval.comparisonSideACovered === true && message.retrieval.comparisonSideBCovered === true
      && message.validation.comparisonConclusionViolation === 0
    : null
  const length = message.answer.length
  const depthAppropriate = message.realization.status === "not_answered" ? null
    : message.provenance?.lockedContentPlan.responseDepth === "short" ? length <= 850
      : message.provenance?.lockedContentPlan.responseDepth === "deep" ? length >= 120
        : length >= 45 && length <= 2_400
  const fallbackQuality = message.realization.status === "deterministic_fallback"
    ? message.validation.pass && !mechanical && length >= 30 : null

  if (supportedExpected && message.realization.status === "not_answered") failures.add(message.expectedBehavior === "follow_up" ? "FOLLOWUP_CONTEXT_FAILURE" : "RETRIEVAL_WEAK")
  if (message.routing.parserUncertainty && supportedExpected) failures.add("QUERY_PARSE_FAILURE")
  if (message.expectedBehavior === "correction" && (message.realization.status === "not_answered" || consistent === false)) failures.add("CORRECTION_FAILURE")
  if (message.retrieval.missingRequiredSlotIds.length) failures.add("MISSING_SLOT")
  if (consistent === false) failures.add("RETRIEVAL_WRONG_TOPIC")
  if (message.retrieval.confidence !== null && message.retrieval.confidence < 0.5) failures.add("RETRIEVAL_WEAK")
  if (message.provenance?.lockedContentPlan.responseDepth === "deep" && length < 120 && !abstained) failures.add("ANSWER_TOO_SHALLOW")
  if (message.provenance?.lockedContentPlan.responseDepth === "short" && length > 850) failures.add("ANSWER_TOO_VERBOSE")
  if (mechanical) failures.add("UNNATURAL_TURKISH")
  if (abstained && supportedExpected && message.routing.comparisonMode !== "abstain") failures.add("UNNECESSARY_ABSTENTION")
  if (warning && message.privacy.category === "general_non_sensitive" && !/tanı|tedavi/u.test(message.normalizedQuestion)) failures.add("UNNECESSARY_WARNING")
  if (comparisonComplete === false) failures.add("COMPARISON_FAILURE")
  if (message.validation.relationViolation > 0) failures.add("RELATION_FAILURE")
  if (message.validation.sourceViolation > 0) failures.add("SOURCE_FAILURE")
  if (message.validation.safetyViolation > 0) failures.add("SAFETY_FAILURE")
  if (message.realization.status === "deterministic_fallback" && fallbackQuality === false) failures.add("FALLBACK_QUALITY")
  if (message.expectedBehavior === "social" && message.routing.intent[0] !== "social_product") failures.add("SOCIAL_ROUTING_FAILURE")
  if (message.expectedBehavior === "unsupported" && message.realization.status !== "not_answered") failures.add("VALIDATOR_FALSE_NEGATIVE")
  if (message.privacyGateBlocked) failures.add("OTHER")

  const serious = [...failures].filter((failure) => [
    "RETRIEVAL_WRONG_TOPIC", "FOLLOWUP_CONTEXT_FAILURE", "CORRECTION_FAILURE", "MISSING_SLOT",
    "COMPARISON_FAILURE", "RELATION_FAILURE", "VALIDATOR_FALSE_NEGATIVE", "PRIVACY_FAILURE", "SOURCE_FAILURE", "SAFETY_FAILURE",
  ].includes(failure))
  const score = Math.max(1, 5 - serious.length * 2 - ([...failures].length - serious.length) * 0.5)
  const acceptable = serious.length === 0 && score >= 3.5
  const good = failures.size === 0 && score >= 4.5
  return Object.freeze({
    schemaVersion: "dna-s13-automatic-quality-review@1",
    stage: message.stage,
    conversationId: message.conversationId,
    messageId: message.messageId,
    createdAt: new Date().toISOString(),
    evaluatorKind: "automatic_heuristic_not_human",
    objective: Object.freeze({
      validatorPass: message.validation.pass,
      selectedTopicIds: message.routing.detectedTopicIds,
      selectedRequiredClaimIds: message.retrieval.selectedRequiredClaimIds,
      selectedExplanatoryClaimIds: message.retrieval.selectedExplanatoryClaimIds,
      missingRequiredSlotIds: message.retrieval.missingRequiredSlotIds,
      relationViolation: message.validation.relationViolation,
      sourceViolation: message.validation.sourceViolation,
      safetyViolation: message.validation.safetyViolation,
      repaired: message.realization.status === "repaired",
      fallback: message.realization.status === "deterministic_fallback",
      costMicrousd: message.realization.costMicrousd,
      latencyMs: message.realization.latencyMs,
    }),
    ux: Object.freeze({
      answerRelevant: supportedExpected ? message.validation.pass && message.realization.status !== "not_answered" && consistent !== false : null,
      apparentComplete: complete,
      followUpContinuity,
      questionCenterCovered: supportedExpected ? message.validation.pass && consistent !== false : null,
      comparisonComplete,
      unnecessaryAbstention: failures.has("UNNECESSARY_ABSTENTION"),
      unnecessaryWarning: failures.has("UNNECESSARY_WARNING"),
      mechanicalOrRepetitiveLanguage: mechanical,
      depthAppropriate,
      fallbackQualityAcceptable: fallbackQuality,
      retrievalTopicConsistent: consistent,
      overallQuality: Number(score.toFixed(2)),
      acceptable,
      good,
    }),
    failureModes: Object.freeze([...failures]),
    lunaValueClass: message.lunaValueClass,
  })
}

function trainingAnnotation(message: StoredMessage, review: AutomaticQualityReview) {
  const accepted = ["realized", "repaired"].includes(message.realization.status)
  const candidate = message.privacy.automaticTrainingAllowed && message.validation.pass && accepted
    && Boolean(message.provenanceHash) && review.ux.acceptable
    && !review.failureModes.some((failure) => CRITICAL_FAILURES.has(failure))
  const high = candidate && message.realization.status === "realized" && review.failureModes.length === 0
    && review.ux.apparentComplete !== false && !review.ux.mechanicalOrRepetitiveLanguage
    && (message.retrieval.confidence ?? 0) >= 0.65
  return Object.freeze({
    schemaVersion: "dna-s13-autonomous-training-annotation@1",
    createdAt: new Date().toISOString(),
    stage: message.stage,
    conversationId: message.conversationId,
    messageId: message.messageId,
    provenanceHash: message.provenanceHash,
    selectionPolicy: "latest_annotation_per_message",
    training_candidate: candidate,
    exclude_from_training: !candidate,
    exclusion_reason: candidate ? null
      : !message.privacy.automaticTrainingAllowed ? "privacy_sensitive"
        : !message.validation.pass ? "validator_not_passed"
          : !accepted ? "fallback_rejected_or_not_answered"
            : !message.provenanceHash ? "provenance_incomplete" : "automatic_quality_problem",
    training_quality_tier: high ? "HIGH" : candidate ? "STANDARD" : null,
    automaticAuditNotHumanReview: true,
  })
}

function privacyChallenges() {
  return Object.freeze([
    "Danışan adı: Ayşe Yılmaz, bu vakayı açıkla.",
    "8 yaşındaki danışanım son haftalarda çok zorlanıyor, ne düşünürsün?",
    "Seans notu: çocuk bugün 20 dakika ağladı ve annesinin adı Elif.",
    "Anamnez bilgisinde doğum tarihi 12.04.2018 yazıyor, yorumlar mısın?",
    "Rapor metni: hasta no AB-4582, duyusal puanı yüksek.",
    "Bu çocuk Mehmet Kaya, okulda neden böyle davranıyor?",
    "Özel Güneş Kliniği'ndeki Zeynep Demir vakasını karşılaştır.",
    "Hasta adı: ALİ VURAL, protokol no: XY-9931.",
    "Çocuğum Ece için seans planı çıkarır mısın?",
    "Kurumumuzda kayıtlı danışan İpek Çelik'in anamnezini özetle.",
  ])
}

function runPrivacyChallenge(paths: RunPaths, testerIdHash: string) {
  let blocked = 0
  for (const question of privacyChallenges()) {
    const decision = inspectDnaS13CanaryPrivacy(question)
    if (!decision.allowed) blocked += 1
    appendPrivate(paths.privacy, {
      schemaVersion: "dna-s13-privacy-challenge-rejection@1",
      createdAt: new Date().toISOString(),
      testerIdHash,
      questionHash: hashDnaS13Artifact({ question }),
      reasonCodes: decision.reasonCodes,
      blockedBeforeRetrieval: !decision.allowed,
      blockedBeforeExternalRealization: !decision.allowed,
      rawQuestionPersisted: false,
      training_candidate: false,
    })
  }
  return Object.freeze({ total: privacyChallenges().length, blocked, pass: blocked === privacyChallenges().length, rawPrivateTextPersisted: 0 })
}

async function runConversations(input: Readonly<{
  conversations: readonly ScenarioConversation[]
  paths: RunPaths
  testerIdHash: string
  budget: SharedBudget
  apiKey: string
  safetyIdentifier: string
}>) {
  const messages: StoredMessage[] = []
  const reviews: AutomaticQualityReview[] = []
  let conversationCursor = 0
  let completedConversations = 0
  let skippedByBudget = 0

  const worker = async () => {
    while (true) {
      const index = conversationCursor
      conversationCursor += 1
      const conversation = input.conversations[index]
      if (!conversation) return
      let conversationState: DnaS13ConversationState | null = null
      let prior: StoredMessage | null = null
      let complete = true
      for (let turnIndex = 0; turnIndex < conversation.messages.length; turnIndex += 1) {
        const scenario = conversation.messages[turnIndex]!
        if (input.budget.stopReason && !["social", "unsupported"].includes(scenario.expectedBehavior)) {
          skippedByBudget += conversation.messages.length - turnIndex
          complete = false
          break
        }
        const message = await runMessage({
          stage: conversation.stage, conversationId: conversation.id, turnIndex: turnIndex + 1,
          sessionId: conversation.id, testerIdHash: input.testerIdHash, scenario, conversationState,
          budget: input.budget, apiKey: input.apiKey, safetyIdentifier: input.safetyIdentifier,
        })
        const review = automaticReview(message, prior)
        const annotation = trainingAnnotation(message, review)
        const { nextConversationState, ...persistableMessage } = message
        const stored = { ...persistableMessage, provenance: null }
        appendPrivate(input.paths.messages, stored)
        if (message.privacyGateBlocked) {
          appendPrivate(input.paths.privacy, {
            schemaVersion: "dna-s13-generated-scenario-privacy-rejection@1",
            createdAt: new Date().toISOString(),
            testerIdHash: input.testerIdHash,
            questionHash: message.question.match(/[a-f0-9]{64}/u)?.[0] ?? hashDnaS13Artifact({ messageId: message.messageId }),
            reasonCodes: message.privacy.reasons,
            blockedBeforeRetrieval: true,
            blockedBeforeExternalRealization: true,
            rawQuestionPersisted: false,
            training_candidate: false,
          })
        }
        if (message.provenance) appendPrivate(input.paths.provenance, message.provenance)
        appendPrivate(input.paths.reviews, review)
        appendPrivate(input.paths.training, annotation)
        for (const failureMode of review.failureModes) {
          appendPrivate(input.paths.triage, {
            schemaVersion: "dna-s13-failure-triage@1",
            createdAt: new Date().toISOString(),
            stage: conversation.stage,
            conversationId: conversation.id,
            messageId: message.messageId,
            failureMode,
            severity: CRITICAL_FAILURES.has(failureMode) ? "critical" : "non_critical",
            automaticAuditNotHumanReview: true,
          })
        }
        messages.push(message)
        reviews.push(review)
        if (nextConversationState) conversationState = nextConversationState
        prior = message
        if (messages.length % 10 === 0) {
          console.log(JSON.stringify({ progress: messages.length, stage: conversation.stage, costMicrousd: input.budget.total().costMicrousd }))
        }
      }
      if (complete) completedConversations += 1
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker))
  return Object.freeze({ messages, reviews, completedConversations, skippedByBudget })
}

function stageMetrics(messages: readonly StoredMessage[], reviews: readonly AutomaticQualityReview[]) {
  const supported = messages.filter((message) => !["social", "unsupported"].includes(message.expectedBehavior))
  const comparisons = messages.filter((message) => message.expectedBehavior === "comparison")
  const followUps = messages.filter((message) => message.expectedBehavior === "follow_up")
  const corrections = messages.filter((message) => message.expectedBehavior === "correction")
  const costs = messages.map((message) => message.realization.costMicrousd / 1_000_000)
  const failures = reviews.flatMap((review) => review.failureModes)
  const failureCounts = Object.fromEntries(unique(failures).map((failure) => [failure, failures.filter((value) => value === failure).length]))
  const usage = sumDnaChatLunaUsage(messages.map((message) => ({
    inputTokens: message.realization.inputTokens,
    cachedInputTokens: message.realization.cachedInputTokens,
    outputTokens: message.realization.outputTokens,
    costMicrousd: message.realization.costMicrousd,
  })))
  return Object.freeze({
    messages: messages.length,
    supportedMessages: supported.length,
    lunaCalls: messages.reduce((sum, message) => sum + message.realization.lunaCalls, 0),
    firstRealizationCalls: messages.filter((message) => message.realization.lunaCalls > 0).length,
    repairCalls: messages.reduce((sum, message) => sum + message.realization.repairCalls, 0),
    deterministicOnlyOrFallback: messages.filter((message) => ["deterministic_fallback", "deterministic_only"].includes(message.realization.status)).length,
    usage,
    uncachedInputTokens: usage.inputTokens - usage.cachedInputTokens,
    meanCostUsdPerMessage: mean(costs),
    p50CostUsdPerMessage: percentile(costs, 0.5),
    p95CostUsdPerMessage: percentile(costs, 0.95),
    projectedUsdPer1k: mean(costs) * 1_000,
    projectedUsdPer10k: mean(costs) * 10_000,
    projectedUsdPer100k: mean(costs) * 100_000,
    p50LatencyMs: percentile(messages.map((message) => message.realization.latencyMs), 0.5),
    p95LatencyMs: percentile(messages.map((message) => message.realization.latencyMs), 0.95),
    lunaCallRate: rate(messages.reduce((sum, message) => sum + message.realization.lunaCalls, 0), messages.length),
    repairRate: rate(messages.filter((message) => message.realization.status === "repaired").length, supported.length),
    fallbackRate: rate(messages.filter((message) => message.realization.status === "deterministic_fallback").length, supported.length),
    acceptableRate: rate(reviews.filter((review) => review.ux.acceptable).length, reviews.length),
    goodRate: rate(reviews.filter((review) => review.ux.good).length, reviews.length),
    followUpSuccessRate: rate(followUps.filter((message) => {
      const review = reviews.find((row) => row.messageId === message.messageId)
      return review?.ux.followUpContinuity === true && review.ux.acceptable
    }).length, followUps.length),
    correctionSuccessRate: rate(corrections.filter((message) => {
      const review = reviews.find((row) => row.messageId === message.messageId)
      return Boolean(review?.ux.acceptable && !review.failureModes.includes("CORRECTION_FAILURE")
        && review.ux.retrievalTopicConsistent !== false)
    }).length, corrections.length),
    comparisonSuccessRate: rate(comparisons.filter((message) => {
      const review = reviews.find((row) => row.messageId === message.messageId)
      return review?.ux.comparisonComplete === true && review.ux.acceptable
    }).length, comparisons.length),
    unnecessaryAbstentionRate: rate(reviews.filter((review) => review.ux.unnecessaryAbstention).length, reviews.length),
    missingSlotRate: rate(reviews.filter((review) => review.failureModes.includes("MISSING_SLOT")).length, reviews.length),
    queryParseFailureRate: rate(reviews.filter((review) => review.failureModes.includes("QUERY_PARSE_FAILURE")).length, reviews.length),
    wrongTopicRate: rate(reviews.filter((review) => review.failureModes.includes("RETRIEVAL_WRONG_TOPIC")).length, reviews.length),
    criticalFailures: failures.filter((failure) => CRITICAL_FAILURES.has(failure)).length,
    failureCounts,
    lunaValueClasses: Object.fromEntries([
      "LUNA_CLEARLY_USEFUL", "LUNA_PROBABLY_USEFUL", "DETERMINISTIC_MAY_HAVE_BEEN_ENOUGH", "LUNA_CALL_POSSIBLY_UNNECESSARY",
    ].map((value) => [value, messages.filter((message) => message.lunaValueClass === value).length])),
  })
}

function smokeGate(input: Readonly<{
  metrics: ReturnType<typeof stageMetrics>
  privacy: ReturnType<typeof runPrivacyChallenge>
  messages: readonly StoredMessage[]
  paths: RunPaths
}>) {
  const telemetryComplete = input.messages.every((message) => Boolean(message.schemaVersion && message.createdAt && message.routing && message.retrieval && message.validation))
  const supported = input.messages.filter((message) => message.realization.provider === "luna")
  const externallyRealized = input.messages.filter((message) => message.realization.provider === "luna")
  const provenanceComplete = externallyRealized.every((message) => Boolean(message.provenanceHash && message.provenance))
  const violations = Object.freeze({
    privacy: input.privacy.pass ? 0 : input.privacy.total - input.privacy.blocked,
    crossAccount: 0,
    source: supported.reduce((sum, message) => sum + message.validation.sourceViolation, 0),
    unsupportedFactualAddition: supported.reduce((sum, message) => sum + message.validation.unsupportedAddition, 0),
    unsupportedRelation: supported.reduce((sum, message) => sum + message.validation.relationViolation, 0),
    safety: supported.reduce((sum, message) => sum + message.validation.safetyViolation, 0),
    telemetryLoss: telemetryComplete ? 0 : 1,
    provenanceLoss: provenanceComplete ? 0 : 1,
    isolation: 0,
  })
  return Object.freeze({
    schemaVersion: "dna-s13-smoke-gate@1",
    pass: Object.values(violations).every((value) => value === 0),
    violations,
    routingOperational: input.messages.some((message) => message.routing.detectedTopicIds.length > 0),
    lunaOperational: input.metrics.lunaCalls > 0,
    feedbackAnnotationPipelineOperational: existsSync(input.paths.training)
      && readFileSync(input.paths.training, "utf8").trim().split("\n").filter(Boolean).length === input.messages.length,
    costRecorded: input.metrics.usage.costMicrousd > 0,
    privacyChallenge: input.privacy,
  })
}

function finalDecision(input: Readonly<{
  autonomousPlanned: number
  autonomousExecuted: number
  metrics: ReturnType<typeof stageMetrics>
  privacy: ReturnType<typeof runPrivacyChallenge>
  highCandidates: number
}>) {
  const critical = input.metrics.criticalFailures > 0 || !input.privacy.pass
  if (critical) return "NOT_READY" as const
  if (input.autonomousExecuted < input.autonomousPlanned) return "NOT_READY" as const
  const systematicFollowUp = input.metrics.followUpSuccessRate < 0.85
  const systematicCorrection = input.metrics.correctionSuccessRate < 0.85
  const systematicComparison = input.metrics.comparisonSuccessRate < 0.95
  if (input.metrics.wrongTopicRate > 0.05 || systematicFollowUp || systematicCorrection || systematicComparison
    || input.metrics.acceptableRate < 0.85 || input.metrics.goodRate < 0.60
    || input.metrics.unnecessaryAbstentionRate > 0.10 || input.metrics.missingSlotRate > 0.10
    || input.metrics.queryParseFailureRate > 0.10 || input.metrics.fallbackRate > 0.05
    || input.metrics.p95LatencyMs > 30_000 || input.highCandidates === 0) {
    return "READY_AFTER_TARGETED_FIXES" as const
  }
  return "READY_FOR_LIMITED_ROLLOUT" as const
}

function topFailures(reviews: readonly AutomaticQualityReview[]) {
  const all = reviews.flatMap((review) => review.failureModes)
  return unique(all).map((failureMode) => ({ failureMode, count: all.filter((value) => value === failureMode).length }))
    .sort((left, right) => right.count - left.count || left.failureMode.localeCompare(right.failureMode))
    .slice(0, 5)
}

function createReport(input: Readonly<{
  runId: string
  smokeConversations: number
  smokeMessages: number
  autonomousConversations: number
  autonomousPlanned: number
  autonomousExecuted: number
  privacy: ReturnType<typeof runPrivacyChallenge>
  metrics: ReturnType<typeof stageMetrics>
  reviews: readonly AutomaticQualityReview[]
  decision: ReturnType<typeof finalDecision>
  highCandidates: number
  budgetStopReason: string | null
  totalSpendMicrousd: number
  priorAttemptCostMicrousd: number
}>) {
  const failures = topFailures(input.reviews)
  return [
    "# DNA Intelligence S13-Strict v4 — Autonomous Internal Canary v2",
    "",
    `- Run ID: \`${input.runId}\``,
    "- Environment: internal non-production",
    "- Production affected: **No**",
    "- Automatic quality audit: heuristic system audit; **not independent human evaluation**",
    "",
    "## Decision",
    "",
    `**${input.decision}**`,
    "",
    "## Run",
    "",
    `- Smoke: ${input.smokeConversations} conversations / ${input.smokeMessages} messages`,
    `- Autonomous: ${input.autonomousConversations} conversations / ${input.autonomousExecuted}/${input.autonomousPlanned} messages`,
    `- Privacy challenge: ${input.privacy.blocked}/${input.privacy.total} blocked before retrieval/Luna; raw private text persisted: ${input.privacy.rawPrivateTextPersisted}`,
    `- Critical failures: ${input.metrics.criticalFailures}`,
    `- Automatic GOOD / acceptable: ${(input.metrics.goodRate * 100).toFixed(1)}% / ${(input.metrics.acceptableRate * 100).toFixed(1)}%`,
    `- Follow-up success: ${(input.metrics.followUpSuccessRate * 100).toFixed(1)}%`,
    `- Correction success: ${(input.metrics.correctionSuccessRate * 100).toFixed(1)}%`,
    `- Comparison success: ${(input.metrics.comparisonSuccessRate * 100).toFixed(1)}%`,
    `- Unnecessary abstention: ${(input.metrics.unnecessaryAbstentionRate * 100).toFixed(1)}%`,
    `- Missing slot / query parse failure / wrong topic: ${(input.metrics.missingSlotRate * 100).toFixed(1)}% / ${(input.metrics.queryParseFailureRate * 100).toFixed(1)}% / ${(input.metrics.wrongTopicRate * 100).toFixed(1)}%`,
    `- Repair / fallback: ${(input.metrics.repairRate * 100).toFixed(1)}% / ${(input.metrics.fallbackRate * 100).toFixed(1)}%`,
    `- p50 / p95 latency: ${Math.round(input.metrics.p50LatencyMs)} / ${Math.round(input.metrics.p95LatencyMs)} ms`,
    "",
    "## Luna cost",
    "",
    `- Calls / repair calls: ${input.metrics.lunaCalls} / ${input.metrics.repairCalls}`,
    `- Input / cached / uncached / output tokens: ${input.metrics.usage.inputTokens} / ${input.metrics.usage.cachedInputTokens} / ${input.metrics.uncachedInputTokens} / ${input.metrics.usage.outputTokens}`,
    `- Completed-run messages: $${(input.metrics.usage.costMicrousd / 1_000_000).toFixed(6)}`,
    `- Prior aborted smoke attempt: $${(input.priorAttemptCostMicrousd / 1_000_000).toFixed(6)}`,
    `- Total autonomous-canary spend: $${(input.totalSpendMicrousd / 1_000_000).toFixed(6)}`,
    `- Mean / p50 / p95 per message: $${input.metrics.meanCostUsdPerMessage.toFixed(6)} / $${input.metrics.p50CostUsdPerMessage.toFixed(6)} / $${input.metrics.p95CostUsdPerMessage.toFixed(6)}`,
    `- Projected 1k / 10k / 100k: $${input.metrics.projectedUsdPer1k.toFixed(2)} / $${input.metrics.projectedUsdPer10k.toFixed(2)} / $${input.metrics.projectedUsdPer100k.toFixed(2)}`,
    `- Hard-cap stop reason: ${input.budgetStopReason ?? "none"}`,
    "",
    "## Luna value classes",
    "",
    ...Object.entries(input.metrics.lunaValueClasses).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Top failure modes",
    "",
    ...(failures.length ? failures.map((row) => `- ${row.failureMode}: ${row.count}`) : ["- None"]),
    "",
    `- HIGH-quality future training candidates: ${input.highCandidates}`,
    "- Dataset export/training/distillation performed: **No**",
    "- Limited rollout performed: **No**",
    "",
  ].join("\n")
}

async function main() {
  if (process.env.VERCEL_ENV?.toLowerCase() === "production" || process.env.DNA_RUNTIME_ENV?.toLowerCase() === "production") {
    throw new Error("autonomous_canary_production_hard_block")
  }
  const ownerEmail = String(process.env.OWNER_AUDIT_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).find(Boolean)
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!ownerEmail) throw new Error("autonomous_canary_owner_not_configured")
  if (!apiKey) throw new Error("autonomous_canary_luna_key_not_configured")
  const runIdArg = process.argv.find((value) => value.startsWith("--run-id="))?.slice("--run-id=".length)
  const runId = runIdArg || `run-${new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z")}`
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("autonomous_canary_run_id_invalid")
  const paths = runPaths(runId)
  if (existsSync(paths.root)) throw new Error("autonomous_canary_run_id_already_exists")
  mkdirSync(paths.root, { recursive: true, mode: 0o700 })
  chmodSync(paths.root, 0o700)

  const canaryEnv = {
    ...process.env,
    DNA_S13_INTERNAL_CANARY_ENABLED: "1",
    DNA_S13_INTERNAL_CANARY_UI_ENABLED: "1",
    DNA_S13_INTERNAL_CANARY_LUNA_ENABLED: "1",
    DNA_S13_INTERNAL_CANARY_TESTER_EMAILS: ownerEmail,
    DNA_S13_INTERNAL_CANARY_OUTPUT_ROOT: paths.root,
  }
  const flags = resolveDnaS13CanaryFlags(canaryEnv)
  if (!flags.enabled || !flags.uiEnabled || !flags.lunaEnabled || !isDnaS13CanaryTester(ownerEmail, flags)) {
    throw new Error("autonomous_canary_flags_or_tester_invalid")
  }
  const testerIdHash = hashDnaS13Artifact({ scope: "dna-s13-autonomous-canary-tester", ownerEmail })
  const safetyIdentifier = `dna_canary_${createHmac("sha256", sha(runId)).update(ownerEmail).digest("hex").slice(0, 48)}`
  const topics = topicPool(runId)
  if (topics.length < 80) throw new Error("autonomous_canary_topic_pool_too_small")
  const smoke = privacySafeConversations(buildConversations("smoke", topics.slice(0, 40)), topics)
  const autonomous = privacySafeConversations(buildConversations("autonomous", topics.slice(40)), topics)
  assertNotRegressionReuse([...smoke, ...autonomous])
  assertNotRun003Reuse([...smoke, ...autonomous])
  const priorAttemptCostMicrousd = Number(process.env.DNA_S13_CANARY_PRIOR_ATTEMPT_COST_MICROUSD || 0)
  const budget = new SharedBudget(priorAttemptCostMicrousd)
  const privacy = runPrivacyChallenge(paths, testerIdHash)

  console.log(JSON.stringify({ stage: "smoke_start", runId, conversations: smoke.length, messages: smoke.flatMap((row) => row.messages).length }))
  const smokeResult = await runConversations({
    conversations: smoke, paths, testerIdHash, budget, apiKey, safetyIdentifier,
  })
  const smokeMetrics = stageMetrics(smokeResult.messages, smokeResult.reviews)
  const gate = smokeGate({ metrics: smokeMetrics, privacy, messages: smokeResult.messages, paths })
  writePrivate(paths.smoke, gate)
  console.log(JSON.stringify({ stage: "smoke_complete", pass: gate.pass, metrics: smokeMetrics }))

  let autonomousResult: Readonly<{
    messages: StoredMessage[]
    reviews: AutomaticQualityReview[]
    completedConversations: number
    skippedByBudget: number
  }> = Object.freeze({ messages: [], reviews: [], completedConversations: 0, skippedByBudget: 0 })
  if (gate.pass) {
    console.log(JSON.stringify({ stage: "autonomous_start", conversations: autonomous.length, messages: autonomous.flatMap((row) => row.messages).length }))
    autonomousResult = await runConversations({
      conversations: autonomous, paths, testerIdHash, budget, apiKey, safetyIdentifier,
    })
  }
  const combinedMessages = [...smokeResult.messages, ...autonomousResult.messages]
  const combinedReviews = [...smokeResult.reviews, ...autonomousResult.reviews]
  const autonomousMetrics = stageMetrics(autonomousResult.messages, autonomousResult.reviews)
  const combinedMetrics = stageMetrics(combinedMessages, combinedReviews)
  const baselineFile = path.join(OUTPUT_BASE, "run-20260810-autonomous-003", "canary-summary.json")
  const baselineRun003Metrics = existsSync(baselineFile)
    ? (JSON.parse(readFileSync(baselineFile, "utf8")) as { autonomous?: { metrics?: unknown } }).autonomous?.metrics ?? null
    : null
  const trainingRows = readFileSync(paths.training, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as { stage: CanaryStage; training_quality_tier: string | null })
  const highCandidates = trainingRows.filter((row) => row.stage === "autonomous" && row.training_quality_tier === "HIGH").length
  const autonomousPlanned = autonomous.flatMap((row) => row.messages).length
  const decision = gate.pass ? finalDecision({
    autonomousPlanned,
    autonomousExecuted: autonomousResult.messages.length,
    metrics: autonomousMetrics,
    privacy,
    highCandidates,
  }) : "NOT_READY"
  const costAnalysis = Object.freeze({
    schemaVersion: "dna-s13-canary-cost-analysis@1",
    hardCapUsd: HARD_CAP_MICROUSD / 1_000_000,
    priorAttemptCostMicrousd,
    totalAutonomousCanarySpendMicrousd: budget.total().costMicrousd,
    hardCapRespected: budget.total().costMicrousd <= HARD_CAP_MICROUSD,
    stopReason: budget.stopReason,
    smoke: smokeMetrics,
    autonomous: autonomousMetrics,
    combined: combinedMetrics,
  })
  const latencyAnalysis = Object.freeze({
    schemaVersion: "dna-s13-canary-latency-analysis@1",
    smoke: { p50Ms: smokeMetrics.p50LatencyMs, p95Ms: smokeMetrics.p95LatencyMs },
    autonomous: { p50Ms: autonomousMetrics.p50LatencyMs, p95Ms: autonomousMetrics.p95LatencyMs },
    combined: { p50Ms: combinedMetrics.p50LatencyMs, p95Ms: combinedMetrics.p95LatencyMs },
  })
  const summary = Object.freeze({
    schemaVersion: "dna-s13-autonomous-canary-summary@2",
    canaryVersion: "fresh-autonomous-canary-v2",
    runId,
    createdAt: new Date().toISOString(),
    architectureVersion: DNA_S13_CANARY_ARCHITECTURE_VERSION,
    architectureHash: DNA_S13_CANARY_ARCHITECTURE_HASH,
    environment: "internal_non_production",
    productionAffected: false,
    runtimeEligible: false,
    releaseEligible: false,
    architectureTournamentOpened: false,
    datasetExported: false,
    modelTrainingStarted: false,
    smoke: { conversations: smokeResult.completedConversations, messages: smokeResult.messages.length, gate },
    autonomous: {
      conversationsPlanned: autonomous.length,
      conversationsCompleted: autonomousResult.completedConversations,
      messagesPlanned: autonomousPlanned,
      messagesExecuted: autonomousResult.messages.length,
      skippedByBudget: autonomousResult.skippedByBudget,
      metrics: autonomousMetrics,
    },
    baselineRun003Metrics,
    privacyChallenge: privacy,
    highQualityTrainingCandidates: highCandidates,
    topFailureModes: topFailures(autonomousResult.reviews),
    decision,
  })
  writePrivate(paths.cost, costAnalysis)
  writePrivate(paths.latency, latencyAnalysis)
  writePrivate(paths.summary, summary)
  writePrivate(paths.report, createReport({
    runId,
    smokeConversations: smokeResult.completedConversations,
    smokeMessages: smokeResult.messages.length,
    autonomousConversations: autonomousResult.completedConversations,
    autonomousPlanned,
    autonomousExecuted: autonomousResult.messages.length,
    privacy,
    metrics: autonomousMetrics,
    reviews: autonomousResult.reviews,
    decision,
    highCandidates,
    budgetStopReason: budget.stopReason,
    totalSpendMicrousd: budget.total().costMicrousd,
    priorAttemptCostMicrousd,
  }))
  const outputFiles = [
    paths.messages, paths.provenance, paths.privacy, paths.reviews, paths.triage, paths.training,
    paths.cost, paths.latency, paths.summary, paths.report, paths.smoke,
  ].filter(existsSync)
  writePrivate(paths.manifest, {
    schemaVersion: "dna-s13-autonomous-canary-manifest@1",
    runId,
    architectureVersion: DNA_S13_CANARY_ARCHITECTURE_VERSION,
    architectureHash: DNA_S13_CANARY_ARCHITECTURE_HASH,
    catalog: getDnaOwnerBookRuntimeStatus(),
    outputs: Object.fromEntries(outputFiles.map((file) => [path.basename(file), fileMeta(file)])),
    privacyRawTextPersisted: false,
    priorAttemptCostMicrousd,
    totalAutonomousCanarySpendMicrousd: budget.total().costMicrousd,
    hardCapRespected: budget.total().costMicrousd <= HARD_CAP_MICROUSD,
    productionAffected: false,
  })
  console.log(JSON.stringify({
    ok: gate.pass && decision !== "NOT_READY",
    runId,
    out: paths.root,
    smokePass: gate.pass,
    autonomousExecuted: autonomousResult.messages.length,
    autonomousPlanned,
    costMicrousd: budget.total().costMicrousd,
    decision,
  }))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
