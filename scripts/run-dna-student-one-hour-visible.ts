import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import type { DnaS13ProviderUsage } from "../src/lib/dna/chat/s13/server"
import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
} from "../src/lib/dna/chat/studentFirst"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { judgeStudentVisibleAnswer } from "./dna-student-visible-judge"

dotenv.config({ path: ".env.local", override: false, quiet: true })

type Fixture = Readonly<{
  synthetic: boolean
  estimatedConversationMinutes: number
  turns: readonly Readonly<{ turnId: string; user: string }>[]
}>

const FIXTURE_PATH = "scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json"
const EXPECTED_FIXTURE_SHA256 = "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1"
const MAX_TOTAL_COST_MICROUSD = 300_000
const SAMPLE_TURNS = new Set(["ONEHOUR24-T03", "ONEHOUR24-T22", "ONEHOUR24-T23", "ONEHOUR24-T24"])
const ZERO_USAGE: DnaS13ProviderUsage = Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })

function addUsage(left: DnaS13ProviderUsage, right: DnaS13ProviderUsage): DnaS13ProviderUsage {
  return Object.freeze({
    inputTokens: left.inputTokens + right.inputTokens,
    cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  })
}

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  const bytes = readFileSync(FIXTURE_PATH)
  const fixtureSha256 = createHash("sha256").update(bytes).digest("hex")
  assert.equal(fixtureSha256, EXPECTED_FIXTURE_SHA256)
  const fixture = JSON.parse(bytes.toString("utf8")) as Fixture
  assert.equal(fixture.synthetic, true)
  assert.equal(fixture.turns.length, 24)

  let state = createEmptyStudentConversationState()
  const visibleHistory: Array<{ turnId: string; user: string; assistant: string }> = []
  const samples: Array<Record<string, unknown>> = []
  let usage = ZERO_USAGE
  let evaluatedTurns = 0
  let passTurns = 0
  let composerCalls = 0
  let judgeCalls = 0
  let oldHistoryReturns = 0
  let firstFailure: Record<string, unknown> | null = null

  for (const turn of fixture.turns) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
    if (!resolved.ok) {
      firstFailure = { turnId: turn.turnId, stage: "request_contract", reason: resolved.reason }
      break
    }
    if (resolved.contract.referent.turnId
      && !state.semanticHistory.some((row) => row.turnId === resolved.contract.referent.turnId)) oldHistoryReturns += 1
    const execution = await executeStudentAnswer({ question: turn.user, contract: resolved.contract })
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
      break
    }
    const judged = await judgeStudentVisibleAnswer({
      question: turn.user,
      answer: execution.answer,
      contract: resolved.contract,
      plan: execution.plan,
      visibleHistory,
    })
    if (!judged.ok) {
      firstFailure = { turnId: turn.turnId, stage: "secondary_judge", reason: judged.reason }
      break
    }
    judgeCalls += 1
    usage = addUsage(usage, judged.usage)
    if (judged.judgment.verdict !== "PASS") {
      firstFailure = {
        turnId: turn.turnId,
        stage: "semantic_execution",
        verdict: judged.judgment.verdict,
        failureCodes: judged.judgment.failureCodes,
        obligationAssessments: judged.judgment.obligationAssessments,
        answer: execution.answer,
      }
      break
    }
    passTurns += 1
    if (SAMPLE_TURNS.has(turn.turnId)) samples.push({
      turnId: turn.turnId,
      question: turn.user,
      answer: execution.answer,
      referentTurnId: resolved.contract.referent.turnId,
    })
    visibleHistory.push({ turnId: turn.turnId, user: turn.user, assistant: execution.answer })
    state = applyStudentRequestContract(state, resolved.contract)
    if (calculateDnaChatLunaUsage(usage).costMicrousd > MAX_TOTAL_COST_MICROUSD) {
      throw new Error("one_hour_visible_cost_cap_exceeded")
    }
  }

  const calculatedUsage = calculateDnaChatLunaUsage(usage)
  const pass = evaluatedTurns === fixture.turns.length
    && passTurns === fixture.turns.length
    && firstFailure === null
    && oldHistoryReturns >= 1
  console.log(JSON.stringify({
    ok: pass,
    gate: "STUDENT_SYNTHETIC_ONE_HOUR24_VISIBLE",
    fixtureSha256,
    synthetic: true,
    certificationEligible: false,
    estimatedConversationMinutes: fixture.estimatedConversationMinutes,
    stoppedEarly: firstFailure !== null,
    evaluatedTurns,
    passTurns,
    criticalFailures: firstFailure ? 1 : 0,
    oldHistoryReturns,
    recentDetailedTurns: state.semanticHistory.length,
    semanticLedgerTurns: state.semanticLedger.length,
    firstFailure,
    composerCalls,
    localSafetyAnswers: evaluatedTurns - composerCalls,
    judgeCalls,
    rawOutputsStored: 0,
    usage: calculatedUsage,
    maxCostMicrousd: MAX_TOTAL_COST_MICROUSD,
    samples,
  }, null, 2))
  if (!pass) process.exitCode = 1
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    gate: "STUDENT_SYNTHETIC_ONE_HOUR24_VISIBLE",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
