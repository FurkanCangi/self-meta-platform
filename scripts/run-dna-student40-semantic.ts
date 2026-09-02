import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage, sumDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import {
  adaptStudentDevelopmentExpectation,
  applyStudentRequestContract,
  assessStudentDevelopmentContract,
  createEmptyStudentConversationState,
  scoreStudentDevelopmentContracts,
  type StudentContractAssessment,
  type StudentConversationState,
  type StudentDevelopmentExpectation,
  type StudentLegacyExpectation,
  type StudentRequestContract,
} from "../src/lib/dna/chat/studentFirst"
import {
  DNA_STUDENT_MAX_PROVIDER_ATTEMPTS,
  interpretStudentRequestWithProvider,
} from "../src/lib/dna/chat/studentFirst/semanticInterpreter.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const FIXTURE_PATH = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const EXPECTED_FIXTURE_SHA256 = "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65"
const TOTAL_EXPECTED_TURNS = 40
const MINIMUM_FULL_PASS_TURNS = 36
const MAX_PROVIDER_CALLS = TOTAL_EXPECTED_TURNS * DNA_STUDENT_MAX_PROVIDER_ATTEMPTS
const MAX_COST_MICROUSD = 200_000

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly Readonly<{
      turnId: string
      user: string
      expected: StudentLegacyExpectation
    }>[]
  }>[]
}>

type SafeFailureRow = Readonly<{
  turnId: string
  failedDimensions: readonly string[]
  expected: Readonly<{
    semanticTask: string | null
    conversationAction: string
    targetIds: readonly string[]
    referentTurnId: string | null
    requiredObligationKinds: readonly string[]
  }>
  actual: Readonly<{
    semanticTask: string
    conversationAction: string
    targetIds: readonly string[]
    referentTurnId: string | null
    obligationKinds: readonly string[]
  }>
  missingObligationKinds: readonly string[]
}>

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function safeFailure(
  assessment: StudentContractAssessment,
  expected: StudentDevelopmentExpectation,
  actual: StudentRequestContract,
): SafeFailureRow {
  return Object.freeze({
    turnId: assessment.turnId,
    failedDimensions: Object.entries(assessment.dimensions).filter(([, decision]) => decision === "fail").map(([dimension]) => dimension),
    expected: Object.freeze({
      semanticTask: expected.semanticTask,
      conversationAction: expected.conversationAction,
      targetIds: expected.targetIds,
      referentTurnId: expected.referentTurnId,
      requiredObligationKinds: expected.requiredObligationKinds,
    }),
    actual: Object.freeze({
      semanticTask: actual.semanticTask,
      conversationAction: actual.conversationAction,
      targetIds: actual.targetIds,
      referentTurnId: actual.referent.turnId,
      obligationKinds: actual.obligations.map((row) => row.kind),
    }),
    missingObligationKinds: assessment.missingObligationKinds,
  })
}

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  const beforeBytes = readFileSync(FIXTURE_PATH)
  const beforeSha = sha256(beforeBytes)
  assert.equal(beforeSha, EXPECTED_FIXTURE_SHA256, "Student40 fixture hash mismatch")
  const fixture = JSON.parse(beforeBytes.toString("utf8")) as Fixture
  assert.equal(fixture.conversations.length, 5)
  assert.equal(fixture.conversations.reduce((total, conversation) => total + conversation.turns.length, 0), TOTAL_EXPECTED_TURNS)

  const assessments: StudentContractAssessment[] = []
  const failures: SafeFailureRow[] = []
  const usageRows: DnaChatLunaUsage[] = []
  const latencies: number[] = []
  let providerCalls = 0
  let repairedTurns = 0
  let stopReason: string | null = null
  let stoppedTurnId: string | null = null

  for (const conversation of fixture.conversations) {
    let state: StudentConversationState = createEmptyStudentConversationState()
    for (let turnIndex = 0; turnIndex < conversation.turns.length; turnIndex += 1) {
      const turn = conversation.turns[turnIndex]!
      assert.ok(providerCalls < MAX_PROVIDER_CALLS, "provider call cap exceeded")
      assert.ok(sumDnaChatLunaUsage(usageRows).costMicrousd <= MAX_COST_MICROUSD, "provider cost cap exceeded")
      const interpreted = await interpretStudentRequestWithProvider({ turnId: turn.turnId, message: turn.user, state })
      if ("provider" in interpreted) {
        providerCalls += interpreted.provider.attempts
        if (interpreted.provider.repairAttempted) repairedTurns += 1
        usageRows.push(calculateDnaChatLunaUsage(interpreted.provider.usage))
        latencies.push(interpreted.provider.latencyMs)
        assert.ok(providerCalls <= MAX_PROVIDER_CALLS, "provider call cap exceeded")
      }
      if (!interpreted.ok) {
        if (interpreted.reason === "invalid_structured_output") {
          stopReason = `invalid_structured_output/${interpreted.failureCode}`
        } else if (interpreted.reason === "provider_failure") {
          stopReason = `provider_failure/${interpreted.failure.reason}/${interpreted.failure.httpStatus ?? "no_status"}/${interpreted.failure.apiErrorCode ?? interpreted.failure.apiErrorType ?? "no_code"}`
        } else {
          stopReason = interpreted.reason
        }
        stoppedTurnId = turn.turnId
        break
      }

      const expected = adaptStudentDevelopmentExpectation({ turnIndex, expected: turn.expected })
      const assessment = assessStudentDevelopmentContract({ turnId: turn.turnId, expected, actual: interpreted.contract })
      assessments.push(assessment)
      if (!assessment.fullPass) failures.push(safeFailure(assessment, expected, interpreted.contract))

      state = applyStudentRequestContract(state, interpreted.contract)
      assert.equal(JSON.stringify(state).includes(turn.user), false, `${turn.turnId}: raw message persisted`)

      if (assessment.criticalFailure) {
        stopReason = "critical_semantic_failure"
        stoppedTurnId = turn.turnId
        break
      }
      if (failures.length > TOTAL_EXPECTED_TURNS - MINIMUM_FULL_PASS_TURNS) {
        stopReason = "minimum_full_pass_unreachable"
        stoppedTurnId = turn.turnId
        break
      }
      if (sumDnaChatLunaUsage(usageRows).costMicrousd > MAX_COST_MICROUSD) {
        stopReason = "provider_cost_cap_exceeded"
        stoppedTurnId = turn.turnId
        break
      }
    }
    if (stopReason) break
  }

  const score = scoreStudentDevelopmentContracts({ assessments, totalExpectedTurns: TOTAL_EXPECTED_TURNS, minimumFullPassTurns: MINIMUM_FULL_PASS_TURNS })
  const totalUsage = sumDnaChatLunaUsage(usageRows)
  const afterSha = sha256(readFileSync(FIXTURE_PATH))
  assert.equal(afterSha, beforeSha, "Student40 fixture mutated during evaluation")
  const output = {
    ok: score.pass,
    gate: "STUDENT40_SEMANTIC_CONTRACT",
    stoppedEarly: stopReason !== null,
    stopReason,
    stoppedTurnId,
    fixture: { sha256: afterSha, mutated: false, certificationEligible: false },
    score,
    provider: {
      calls: providerCalls,
      usage: totalUsage,
      averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      maxCalls: MAX_PROVIDER_CALLS,
      maxCostMicrousd: MAX_COST_MICROUSD,
      rawOutputLogged: false,
      repairedTurns,
      maxAttemptsPerTurn: DNA_STUDENT_MAX_PROVIDER_ATTEMPTS,
    },
    failures,
  }
  console.log(JSON.stringify(output, null, 2))
  if (!score.pass) process.exitCode = 1
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    gate: "STUDENT40_SEMANTIC_CONTRACT",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
