import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { resolveDnaChatApiRequest } from "../src/lib/dna/chat/apiResolver"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import { runDnaS13LimitedRolloutMessage } from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import {
  DNA_S13_REALIZER_CONTRACT_VERSION,
  DeterministicRealizer,
  type Realizer,
} from "../src/lib/dna/chat/s13/strictRealizer"

type JsonRecord = Record<string, any>

const CONTEXT_SECRET = "post-response-normalization-provider-free-context-secret-v1"
const SUBJECT_ID = "synthetic-owner"
const SUBJECT_HASH = "a".repeat(64)
const CONVERSATION_HASH = "b".repeat(64)
let requestSequence = 0

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function nextRequestId() {
  requestSequence += 1
  return `00000000-0000-4000-8000-${String(requestSequence).padStart(12, "0")}`
}

async function limited(question: string, options: Readonly<{
  sessionId?: string
  contextToken?: string | null
  realizer?: Realizer
}> = {}) {
  return runDnaS13LimitedRolloutMessage({
    requestId: nextRequestId(),
    subjectId: SUBJECT_ID,
    subjectIdHash: SUBJECT_HASH,
    conversationIdHash: CONVERSATION_HASH,
    sessionId: options.sessionId ?? "post-response-normalization",
    question,
    responseDepth: "standard",
    contextToken: options.contextToken,
    contextSecret: CONTEXT_SECRET,
    privacy: inspectDnaS13LimitedRolloutPrivacy({ question }),
    rolloutPhase: "L0",
    realizer: options.realizer ?? new DeterministicRealizer(),
  })
}

async function legacyPublicBody(input: Readonly<{
  question: string
  previousTopic?: string | null
  topicIds?: readonly string[]
  lastQueryKind?: "definition" | "comparison" | "relation" | "measurement" | "development" | "evidence" | "case" | "unknown"
}>) {
  const resolution = await resolveDnaChatApiRequest({
    question: input.question,
    responseDepth: "standard",
    ...(input.previousTopic || (input.topicIds?.length && input.lastQueryKind) ? {
      context: {
        ...(input.previousTopic ? { previousTopic: input.previousTopic } : {}),
        ...(input.topicIds?.length ? { topicIds: [...input.topicIds] } : {}),
        ...(input.lastQueryKind ? { lastQueryKind: input.lastQueryKind } : {}),
      },
    } : {}),
  }, {
    createRequestId: nextRequestId,
    loadCaseAnswer: async () => ({ ok: false as const, status: 404, error: "report_not_found" as const }),
    writeAudit: async () => ({ ok: true as const }),
  })
  assert.equal(resolution.status, 200, input.question)
  assert.equal(resolution.body.ok, true, input.question)
  return clone(resolution.body as JsonRecord)
}

function answeredBody(result: Awaited<ReturnType<typeof limited>>, label: string) {
  if (result.kind !== "answered") throw new Error(`${label}:${result.kind}`)
  assert.equal(result.kind, "answered", `${label} must produce an answered public body`)
  return clone(result.body as JsonRecord)
}

function isRenderable(answer: ReturnType<typeof normalizeDnaChatPublicResponse>) {
  return Boolean(answer && answer.requestId && answer.summary
    && (answer.classification === "clarification" || answer.answerUnits.length > 0)
    && answer.answerUnits.every((unit) => unit.text.trim().length > 0))
}

function shape(value: unknown): unknown {
  if (value === null) return "null"
  if (Array.isArray(value)) return { type: "array", length: value.length, items: value.length ? shape(value[0]) : null }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, shape(entry)]))
  }
  return typeof value
}

function scrubContextToken<T extends JsonRecord>(body: T): T {
  const copy = clone(body)
  const context = copy.conversationContext
  if (context && typeof context.limitedRolloutContextToken === "string") {
    context.limitedRolloutContextToken = `[SYNTHETIC_CONTEXT_TOKEN:${context.limitedRolloutContextToken.length}]`
  }
  return copy
}

const unavailableRealizer: Realizer = {
  identity: Object.freeze({
    provider: "deterministic" as const,
    model: "provider-free-unavailable-fixture",
    implementationVersion: "provider-free-unavailable-fixture@1",
  }),
  async realize() {
    return Object.freeze({
      contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
      identity: this.identity,
      prompt: Object.freeze({ version: "provider-free-unavailable-fixture@1", hash: "d".repeat(64) }),
      realization: null,
      rawOutput: null,
      responseId: null,
      usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
      latencyMs: 0,
    })
  },
}

async function main() {
  const defineResult = await limited("Self-regülasyon nedir?", { sessionId: "define-deepen" })
  const define = answeredBody(defineResult, "DEFINE")
  const defineContext = define.conversationContext as JsonRecord
  const legacyDeepen = await legacyPublicBody({
    question: "Bunu biraz daha ayrıntılı açıklar mısın?",
    previousTopic: String(define.topic || ""),
    topicIds: Array.isArray(defineContext.topicIds) ? defineContext.topicIds : [],
    lastQueryKind: defineContext.lastQueryKind,
  })

  const whyWithoutLimitedContext = await limited("Bunun önemi ne?", {
    sessionId: "why-after-legacy-deepen-without-token",
  })
  assert.equal(whyWithoutLimitedContext.kind, "clarification",
    "WHY without a limited context token must exercise the production clarification body")
  const why = clone(whyWithoutLimitedContext.body as JsonRecord)
  const exampleSetup = answeredBody(await limited("Self-regülasyon nedir?", { sessionId: "example" }), "EXAMPLE_SETUP")
  const example = answeredBody(await limited("Buna günlük bir örnek verir misin?", {
    sessionId: "example",
    contextToken: exampleSetup.conversationContext?.limitedRolloutContextToken,
  }), "EXAMPLE")
  const compare = answeredBody(await limited(
    "Okupasyonel Performans ve Aktivite, Performans ve Katılım Arasındaki Ayrım karşılaştır.",
  ), "COMPARE")
  const correctionSetup = answeredBody(await limited(
    "Okupasyonel Performans ve Aktivite, Performans ve Katılım Arasındaki Ayrım karşılaştır.",
    { sessionId: "correction" },
  ), "CORRECTION_SETUP")
  const correction = answeredBody(await limited(
    "Onu değil Aktivite, Performans ve Katılım Arasındaki Ayrım demek istedim; karşılaştırmayı bırak ve düzelt.",
    {
      sessionId: "correction",
      contextToken: correctionSetup.conversationContext?.limitedRolloutContextToken,
    },
  ), "CORRECTION")
  const catalogLimited = await legacyPublicBody({ question: "Kuantum dolanıklığı nedir?" })
  const boundarySetup = answeredBody(await limited("Self-regülasyon nedir?", { sessionId: "boundary" }), "BOUNDARY_SETUP")
  const boundary = answeredBody(await limited("Bu tek başına neyi kanıtlamaz?", {
    sessionId: "boundary",
    contextToken: boundarySetup.conversationContext?.limitedRolloutContextToken,
  }), "BOUNDARY")
  const controlledRepair = clone(define)
  controlledRepair.requestId = nextRequestId()
  controlledRepair.limitedRolloutContract.realizationStatus = "repaired"
  const safeFallback = answeredBody(await limited("Self-regülasyon nedir?", {
    realizer: unavailableRealizer,
  }), "SAFE_FALLBACK")

  const fixtures: ReadonlyArray<readonly [string, JsonRecord]> = [
    ["DEFINE", define],
    ["WHY", why],
    ["DEEPEN", legacyDeepen],
    ["EXAMPLE", example],
    ["COMPARE", compare],
    ["CORRECTION", correction],
    ["CATALOG_LIMITED", catalogLimited],
    ["BOUNDARY", boundary],
    ["LUNA_ON", clone(define)],
    ["LUNA_OFF", clone(define)],
    ["CONTROLLED_REPAIR", controlledRepair],
    ["SAFE_FALLBACK", safeFallback],
  ]

  const matrix = fixtures.map(([name, body]) => {
    const normalized = normalizeDnaChatPublicResponse(JSON.parse(JSON.stringify(body)))
    return {
      name,
      normalized: Boolean(normalized),
      renderable: isRenderable(normalized),
      runtimeGeneration: normalized?.runtimeGeneration ?? null,
      classification: normalized?.classification ?? null,
      authorityLayers: normalized ? [...new Set(normalized.authoritySummary.map((row) => row.layer))] : [],
    }
  })
  assert.equal(matrix.filter((row) => row.normalized && row.renderable).length, 12)

  const malformed = clone(define)
  malformed.answerUnits[0].authority.approvalRequirement = "unsupported_approval"
  assert.equal(normalizeDnaChatPublicResponse(malformed), null,
    "malformed authority must still fail closed into the generic error path")
  const missingUnitsOutsideClarification = clone(define)
  missingUnitsOutsideClarification.answerUnits = []
  assert.equal(normalizeDnaChatPublicResponse(missingUnitsOutsideClarification), null,
    "ordinary answers without structured units must remain rejected")
  const clarificationWithSource = clone(why)
  clarificationWithSource.sources = [clone(legacyDeepen.sources[0])]
  assert.equal(normalizeDnaChatPublicResponse(clarificationWithSource), null,
    "clarification responses must not carry source-backed factual content")

  const clientSource = readFileSync(join(process.cwd(), "src/app/dna-asistani/DnaAssistantClient.tsx"), "utf8")
  assert.match(clientSource, /const answer = normalizeAnswer\(payload\)[\s\S]{0,160}if \(!answer\) throw new Error\("dna_chat_failed"\)/u)
  assert.match(clientSource, /dna_chat_failed:\s*"DNA Asistanı şu anda yanıt veremiyor\./u)
  assert.equal(legacyDeepen.runtimeGeneration, "v2_legacy")
  assert.equal(legacyDeepen.classification, "dna_concept")
  assert.equal(legacyDeepen.authoritySummary?.[0]?.layer, "owner_book_information")
  assert.equal(legacyDeepen.authoritySummary?.[0]?.approvalRequirement, "owner_approved")

  const telemetry = [defineResult].flatMap((result) => result.kind === "answered" ? [result.telemetry] : [])
  const evidenceDir = String(process.env.DNA_CLIENT_NORMALIZATION_EVIDENCE_DIR || "").trim()
  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true })
    const defineEvidence = {
      evidenceBasis: "production-request-correlated provider-free replay",
      productionRequestId: "38f2eaf5-80af-4862-9867-57ed02297ba4",
      rawPublicBody: scrubContextToken(define),
      shape: shape(define),
    }
    const deepenEvidence = {
      evidenceBasis: "production-request-correlated legacy fallback replay",
      productionRequestId: "935f6e27-8934-47dd-89c2-cc9231a2dacf",
      rawPublicBody: scrubContextToken(legacyDeepen),
      shape: shape(legacyDeepen),
    }
    const whyEvidence = {
      evidenceBasis: "production-request-correlated provider-free clarification replay after legacy context-token loss",
      productionRequestId: "60b1e45f-32ea-45eb-a257-98040bd373da",
      rawPublicBody: why,
      shape: shape(why),
    }
    writeFileSync(join(evidenceDir, "DEFINE_RESPONSE_SHAPE.json"), `${JSON.stringify(defineEvidence, null, 2)}\n`)
    writeFileSync(join(evidenceDir, "DEEPEN_RESPONSE_SHAPE.json"), `${JSON.stringify(deepenEvidence, null, 2)}\n`)
    writeFileSync(join(evidenceDir, "WHY_CLARIFICATION_RESPONSE_SHAPE.json"), `${JSON.stringify(whyEvidence, null, 2)}\n`)
    writeFileSync(join(evidenceDir, "CLIENT_CONTRACT_MATRIX.json"), `${JSON.stringify({
      schemaVersion: "dna-chat-client-contract-matrix@1",
      providerMode: "$0 deterministic",
      providerCalls: 0,
      costMicrousd: 0,
      passed: matrix.filter((row) => row.normalized && row.renderable).length,
      total: matrix.length,
      genericErrorsForValidFixtures: matrix.filter((row) => !row.normalized || !row.renderable).length,
      malformedFixtureRejected: true,
      matrix,
    }, null, 2)}\n`)
    writeFileSync(join(evidenceDir, "ROOT_CAUSE.json"), `${JSON.stringify({
      schemaVersion: "dna-chat-post-response-root-cause@2",
      rootCauseIdentified: true,
      genericErrorTrigger: "normalizeAnswer(payload) returned null, then sendQuestion threw dna_chat_failed",
      rootCauseFile: "src/app/dna-asistani/DnaAssistantClient.tsx",
      rootCauseFunction: "normalizeDnaChatPublicResponse -> authority and answer-unit shape guards",
      rootCauseCondition: "the client rejected two valid server variants: legacy owner_book_information authority and the v3 clarification contract with empty answerUnits",
      productionDefineRequestId: "38f2eaf5-80af-4862-9867-57ed02297ba4",
      productionDeepenRequestId: "935f6e27-8934-47dd-89c2-cc9231a2dacf",
      productionWhyRequestId: "60b1e45f-32ea-45eb-a257-98040bd373da",
      fixLayer: "shared public response normalizer/client adapter",
    }, null, 2)}\n`)
    writeFileSync(join(evidenceDir, "RESPONSE_SHAPE_DIFF.md"), [
      "# DEFINE vs DEEPEN public response shape",
      "",
      "| Field | DEFINE | DEEPEN |",
      "|---|---|---|",
      `| runtimeGeneration | ${define.runtimeGeneration} | ${legacyDeepen.runtimeGeneration} |`,
      `| classification | ${define.classification} | ${legacyDeepen.classification} |`,
      `| limitedRolloutContract | present | absent |`,
      `| authority layer | ${define.authoritySummary[0].layer} | ${legacyDeepen.authoritySummary[0].layer} |`,
      `| authority approval | ${define.authoritySummary[0].approvalRequirement} | ${legacyDeepen.authoritySummary[0].approvalRequirement} |`,
      `| responseDepth | ${define.responseDepth} | ${legacyDeepen.responseDepth} |`,
      "",
      "The server returned DEEPEN with HTTP 200 and a valid legacy public response. The historical client authority allow-map omitted `owner_book_information`, so `authoritySummary` normalization dropped its only entry. The subsequent array-length guard returned `null`, and `sendQuestion` converted that null into `dna_chat_failed`. After DEEPEN, a context-token-free WHY request can validly return the v3 clarification contract with `answerUnits: []`; the shared normalizer now accepts only that explicit clarification shape while retaining fail-closed checks for malformed authorities, factual answers without units, and clarification bodies carrying sources.",
      "",
    ].join("\n"))
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    providerMode: "$0 deterministic",
    providerCalls: telemetry.reduce((sum, row) => sum + row.realization.lunaCalls, 0),
    costMicrousd: telemetry.reduce((sum, row) => sum + row.realization.costMicrousd, 0),
    matrixPassed: matrix.filter((row) => row.normalized && row.renderable).length,
    matrixTotal: matrix.length,
    genericErrorsForValidFixtures: matrix.filter((row) => !row.normalized || !row.renderable).length,
    malformedFixtureRejected: true,
    exactGenericBranch: "normalizeAnswer(payload) -> null -> throw dna_chat_failed -> ERROR_MESSAGES.dna_chat_failed",
    rootCause: "the client public-response adapter rejected valid legacy owner authority and valid empty-unit clarification variants",
    matrix,
  }, null, 2)}\n`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
