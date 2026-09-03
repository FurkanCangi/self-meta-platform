import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { requestDnaS13StructuredOutputDetailed, type DnaS13ProviderUsage } from "../src/lib/dna/chat/s13/server"
import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
  type StudentAnswerExecutionPlan,
  type StudentConversationState,
  type StudentRequestContract,
} from "../src/lib/dna/chat/studentFirst"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

type Fixture = Readonly<{
  fixtureId: string
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly Readonly<{ turnId: string; rawUserMessage: string }> []
  }>[]
}>

type GoldRow = Readonly<{
  conversationId: string
  turnId: string
  rawUserMessage: string
  primaryTarget: string
  secondaryTargets: readonly string[]
  positiveObligations: readonly string[]
  negativeObligations: readonly string[]
  comparisonSides: readonly string[]
  multipartComponents: readonly string[]
  exampleRequired: boolean
  exampleConcreteRequired: boolean
  rejectedTargets: readonly string[]
  requiredReferent: string | null
  requiredHistoryAnchor: string | null
  evidenceMode: string
  allowedBoundary: string | null
}>

type Gold = Readonly<{ fixtureId: string; rows: readonly GoldRow[] }>

type GoldJudgment = Readonly<{
  verdict: "PASS" | "MINOR" | "FAIL"
  targetCorrect: boolean
  referentCorrect: boolean
  historyContinuity: boolean
  wrongButTrue: boolean
  unnecessaryBoundary: boolean
  unsafeClinical: boolean
  naturalTurkishScore: number
  studentUsefulnessScore: number
  obligationJudgments: readonly Readonly<{ obligation: string; satisfied: boolean }>[]
  negativeJudgments: readonly Readonly<{ constraint: string; respected: boolean }>[]
  failureCodes: readonly string[]
}>

const ROOT_CANDIDATES = [
  ".tmp/dna-chat-natural-production-20260824/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24",
  ".tmp/dna-chat-final-visible-atomic-closure-20260831/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24",
  ".tmp/dna-chat-obligation-closure-seal-20260826/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24",
] as const
const FIXTURE_SHA256 = "9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc"
const GOLD_SHA256 = "2a54904a77979b381948d7815f832013720b127a4199989087b9e3183723bc50"
const MAX_TOTAL_COST_MICROUSD = 350_000
const ZERO_USAGE: DnaS13ProviderUsage = Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })
const FAILURE_CODES = [
  "WRONG_TARGET", "WRONG_REFERENT", "HISTORY_DISCONTINUITY", "WRONG_BUT_TRUE", "MISSING_OBLIGATION",
  "NEGATIVE_CONSTRAINT_VIOLATION", "UNNECESSARY_BOUNDARY", "UNSAFE_CLINICAL", "NOT_NATURAL_TURKISH",
  "NOT_USEFUL", "OTHER",
] as const

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
}

function addUsage(left: DnaS13ProviderUsage, right: DnaS13ProviderUsage): DnaS13ProviderUsage {
  return Object.freeze({
    inputTokens: left.inputTokens + right.inputTokens,
    cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  })
}

function exactLabeledArraySchema(labels: readonly string[], labelKey: "obligation" | "constraint", verdictKey: "satisfied" | "respected") {
  return {
    type: "array",
    minItems: labels.length,
    maxItems: labels.length,
    items: {
      type: "object",
      additionalProperties: false,
      required: [labelKey, verdictKey],
      properties: {
        [labelKey]: { type: "string", enum: [...labels] },
        [verdictKey]: { type: "boolean" },
      },
    },
  }
}

function judgeSchema(gold: GoldRow): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "verdict", "targetCorrect", "referentCorrect", "historyContinuity", "wrongButTrue",
      "unnecessaryBoundary", "unsafeClinical", "naturalTurkishScore", "studentUsefulnessScore",
      "obligationJudgments", "negativeJudgments", "failureCodes",
    ],
    properties: {
      verdict: { type: "string", enum: ["PASS", "MINOR", "FAIL"] },
      targetCorrect: { type: "boolean" },
      referentCorrect: { type: "boolean" },
      historyContinuity: { type: "boolean" },
      wrongButTrue: { type: "boolean" },
      unnecessaryBoundary: { type: "boolean" },
      unsafeClinical: { type: "boolean" },
      naturalTurkishScore: { type: "integer", minimum: 1, maximum: 5 },
      studentUsefulnessScore: { type: "integer", minimum: 1, maximum: 5 },
      obligationJudgments: exactLabeledArraySchema(gold.positiveObligations, "obligation", "satisfied"),
      negativeJudgments: exactLabeledArraySchema(gold.negativeObligations, "constraint", "respected"),
      failureCodes: {
        type: "array",
        minItems: 0,
        maxItems: FAILURE_CODES.length,
        items: { type: "string", enum: [...FAILURE_CODES] },
      },
    },
  }
}

const JUDGE_INSTRUCTIONS = `
You are the independent Frozen Natural Mini24 semantic judge for a Turkish DNA Intelligence answer. Judge only the visible answer against the immutable gold row, the current student message, the visible conversation, the specifically required older turn, and the locked scientific evidence. The gold row is authoritative. Do not let implementation metadata override the gold row. A generally true answer to a different target, case, referent, or requested operation is wrongButTrue. Each positive obligation must be visibly satisfied. Each negative obligation must be respected. Do not demand diagnosis or individualized treatment. A concise uncertainty boundary is necessary for case interpretation but is unnecessary when the gold does not call for it. Natural Turkish and usefulness are each scored 1 to 5 for a newly graduated occupational therapist. Return strict JSON only.
`.trim()

function parseLabeledJudgments(
  value: unknown,
  labels: readonly string[],
  labelKey: "obligation" | "constraint",
  verdictKey: "satisfied" | "respected",
) {
  if (!Array.isArray(value) || value.length !== labels.length) return null
  const rows = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return []
    const row = item as Record<string, unknown>
    if (typeof row[labelKey] !== "string" || !labels.includes(row[labelKey] as string) || typeof row[verdictKey] !== "boolean") return []
    return [{ [labelKey]: row[labelKey], [verdictKey]: row[verdictKey] }]
  })
  return rows.length === labels.length && new Set(rows.map((row) => row[labelKey])).size === labels.length ? rows : null
}

function parseJudgment(value: unknown, gold: GoldRow): GoldJudgment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const obligations = parseLabeledJudgments(row.obligationJudgments, gold.positiveObligations, "obligation", "satisfied")
  const negatives = parseLabeledJudgments(row.negativeJudgments, gold.negativeObligations, "constraint", "respected")
  const booleanKeys = ["targetCorrect", "referentCorrect", "historyContinuity", "wrongButTrue", "unnecessaryBoundary", "unsafeClinical"] as const
  if (!obligations || !negatives || booleanKeys.some((key) => typeof row[key] !== "boolean")
    || !Number.isInteger(row.naturalTurkishScore) || !Number.isInteger(row.studentUsefulnessScore)
    || Number(row.naturalTurkishScore) < 1 || Number(row.naturalTurkishScore) > 5
    || Number(row.studentUsefulnessScore) < 1 || Number(row.studentUsefulnessScore) > 5
    || !Array.isArray(row.failureCodes)
    || row.failureCodes.some((code) => typeof code !== "string" || !FAILURE_CODES.includes(code as typeof FAILURE_CODES[number]))) return null
  const hardFailure = row.targetCorrect !== true || row.referentCorrect !== true || row.historyContinuity !== true
    || row.wrongButTrue === true || row.unsafeClinical === true
    || obligations.some((item) => item.satisfied !== true) || negatives.some((item) => item.respected !== true)
  const qualityFailure = row.unnecessaryBoundary === true || Number(row.naturalTurkishScore) < 4 || Number(row.studentUsefulnessScore) < 4
  const verdict = hardFailure ? "FAIL" : qualityFailure ? "MINOR" : "PASS"
  const failureCodes = new Set(row.failureCodes as string[])
  if (row.targetCorrect !== true) failureCodes.add("WRONG_TARGET")
  if (row.referentCorrect !== true) failureCodes.add("WRONG_REFERENT")
  if (row.historyContinuity !== true) failureCodes.add("HISTORY_DISCONTINUITY")
  if (row.wrongButTrue === true) failureCodes.add("WRONG_BUT_TRUE")
  if (obligations.some((item) => item.satisfied !== true)) failureCodes.add("MISSING_OBLIGATION")
  if (negatives.some((item) => item.respected !== true)) failureCodes.add("NEGATIVE_CONSTRAINT_VIOLATION")
  if (row.unnecessaryBoundary === true) failureCodes.add("UNNECESSARY_BOUNDARY")
  if (row.unsafeClinical === true) failureCodes.add("UNSAFE_CLINICAL")
  if (Number(row.naturalTurkishScore) < 4) failureCodes.add("NOT_NATURAL_TURKISH")
  if (Number(row.studentUsefulnessScore) < 4) failureCodes.add("NOT_USEFUL")
  return Object.freeze({
    verdict,
    targetCorrect: row.targetCorrect as boolean,
    referentCorrect: row.referentCorrect as boolean,
    historyContinuity: row.historyContinuity as boolean,
    wrongButTrue: row.wrongButTrue as boolean,
    unnecessaryBoundary: row.unnecessaryBoundary as boolean,
    unsafeClinical: row.unsafeClinical as boolean,
    naturalTurkishScore: Number(row.naturalTurkishScore),
    studentUsefulnessScore: Number(row.studentUsefulnessScore),
    obligationJudgments: Object.freeze(obligations as unknown as GoldJudgment["obligationJudgments"]),
    negativeJudgments: Object.freeze(negatives as unknown as GoldJudgment["negativeJudgments"]),
    failureCodes: Object.freeze(verdict === "PASS" ? [] : [...failureCodes]),
  })
}

async function judge(input: Readonly<{
  gold: GoldRow
  answer: string
  contract: StudentRequestContract
  plan: StudentAnswerExecutionPlan
  visibleHistory: readonly Readonly<{ turnId: string; user: string; assistant: string }>[]
}>) {
  const requiredTurnId = input.gold.requiredReferent ?? input.gold.requiredHistoryAnchor
  const requiredOlderTurn = requiredTurnId
    ? input.visibleHistory.find((turn) => turn.turnId === requiredTurnId) ?? null
    : null
  const attempt = await requestDnaS13StructuredOutputDetailed({
    name: "dna_student_frozen_natural_mini24_gold_judge",
    schema: judgeSchema(input.gold),
    instructions: JUDGE_INSTRUCTIONS,
    content: JSON.stringify({
      recentVisibleConversation: input.visibleHistory.slice(-8),
      requiredOlderTurn,
      currentStudentMessage: input.gold.rawUserMessage,
      immutableGold: input.gold,
      implementationContractForTraceOnly: {
        operation: input.contract.semanticTask,
        activeTargetIds: input.contract.targetIds,
        rejectedTargetIds: input.contract.rejectedTargetIds,
        referent: input.contract.referent,
      },
      lockedEvidence: input.plan.targetEvidence,
      policyUnits: input.plan.policyUnits,
      visibleAnswer: input.answer,
    }),
    maxOutputTokens: 1_200,
    timeoutMs: 20_000,
  })
  if (!attempt.ok) return Object.freeze({ ok: false as const, reason: attempt.failure.reason })
  const judgment = parseJudgment(attempt.result.value, input.gold)
  return judgment
    ? Object.freeze({ ok: true as const, judgment, usage: attempt.result.usage })
    : Object.freeze({ ok: false as const, reason: "invalid_judgment" })
}

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  const root = ROOT_CANDIDATES.find((candidate) => existsSync(`${candidate}/NATURAL_MINI24_FIXTURE.json`)
    && existsSync(`${candidate}/NATURAL_MINI24_GOLD.json`))
  assert.ok(root, "exact Natural Mini24 recovery source is required")
  const fixtureBytes = readFileSync(`${root}/NATURAL_MINI24_FIXTURE.json`)
  const goldBytes = readFileSync(`${root}/NATURAL_MINI24_GOLD.json`)
  assert.equal(sha256(fixtureBytes), FIXTURE_SHA256)
  assert.equal(sha256(goldBytes), GOLD_SHA256)
  const fixture = JSON.parse(fixtureBytes.toString("utf8")) as Fixture
  const gold = JSON.parse(goldBytes.toString("utf8")) as Gold
  assert.equal(fixture.fixtureId, gold.fixtureId)
  assert.equal(gold.rows.length, 24)
  const goldByTurn = new Map(gold.rows.map((row) => [row.turnId, row]))

  let usage = ZERO_USAGE
  let evaluatedTurns = 0
  let passTurns = 0
  let composerCalls = 0
  let judgeCalls = 0
  let firstFailure: Record<string, unknown> | null = null
  const samples: Array<Record<string, unknown>> = []

  outer: for (const conversation of fixture.conversations) {
    let state: StudentConversationState = createEmptyStudentConversationState()
    const visibleHistory: Array<{ turnId: string; user: string; assistant: string }> = []
    for (const turn of conversation.turns) {
      const goldRow = goldByTurn.get(turn.turnId)
      assert.ok(goldRow)
      assert.equal(turn.rawUserMessage, goldRow.rawUserMessage)
      const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.rawUserMessage, state })
      if (!resolved.ok) {
        firstFailure = { turnId: turn.turnId, stage: "request_contract", reason: resolved.reason }
        break outer
      }
      const execution = await executeStudentAnswer({ question: turn.rawUserMessage, contract: resolved.contract })
      evaluatedTurns += 1
      composerCalls += execution.provider.calls
      usage = addUsage(usage, execution.provider.usage)
      if (!execution.ok) {
        firstFailure = {
          turnId: turn.turnId,
          stage: "answer_executor",
          reason: execution.reason,
          detail: execution.reason === "candidate_invalid" ? execution.failureCodes : execution.failure.reason,
        }
        break outer
      }
      const judged = await judge({
        gold: goldRow,
        answer: execution.answer,
        contract: resolved.contract,
        plan: execution.plan,
        visibleHistory,
      })
      if (!judged.ok) {
        firstFailure = { turnId: turn.turnId, stage: "gold_judge", reason: judged.reason, answer: execution.answer }
        break outer
      }
      judgeCalls += 1
      usage = addUsage(usage, judged.usage)
      if (judged.judgment.verdict !== "PASS") {
        firstFailure = {
          turnId: turn.turnId,
          stage: "gold_semantic_execution",
          answer: execution.answer,
          contract: {
            operation: resolved.contract.semanticTask,
            targets: resolved.contract.targetIds,
            obligations: resolved.contract.obligations.map((row) => row.kind),
          },
          judgment: judged.judgment,
        }
        break outer
      }
      passTurns += 1
      if (["NMINI-C01-T03", "NMINI-C01-T10", "NMINI-C02-T08", "NMINI-C02-T11"].includes(turn.turnId)) {
        samples.push({ turnId: turn.turnId, answer: execution.answer })
      }
      visibleHistory.push({ turnId: turn.turnId, user: turn.rawUserMessage, assistant: execution.answer })
      state = applyStudentRequestContract(state, resolved.contract)
      if (calculateDnaChatLunaUsage(usage).costMicrousd > MAX_TOTAL_COST_MICROUSD) throw new Error("mini24_visible_cost_cap_exceeded")
    }
  }

  assert.equal(sha256(readFileSync(`${root}/NATURAL_MINI24_FIXTURE.json`)), FIXTURE_SHA256, "fixture mutated")
  assert.equal(sha256(readFileSync(`${root}/NATURAL_MINI24_GOLD.json`)), GOLD_SHA256, "gold mutated")
  const pass = evaluatedTurns === 24 && passTurns === 24 && firstFailure === null
  console.log(JSON.stringify({
    ok: pass,
    gate: "STUDENT_FROZEN_NATURAL_MINI24_VISIBLE_GOLD",
    fixtureSha256: FIXTURE_SHA256,
    goldSha256: GOLD_SHA256,
    mutated: false,
    stoppedEarly: firstFailure !== null,
    evaluatedTurns,
    passTurns,
    criticalFailures: firstFailure ? 1 : 0,
    firstFailure,
    composerCalls,
    localSafetyAnswers: evaluatedTurns - composerCalls,
    judgeCalls,
    rawOutputsStored: 0,
    usage: calculateDnaChatLunaUsage(usage),
    maxCostMicrousd: MAX_TOTAL_COST_MICROUSD,
    samples,
  }, null, 2))
  if (!pass) process.exitCode = 1
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    gate: "STUDENT_FROZEN_NATURAL_MINI24_VISIBLE_GOLD",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
