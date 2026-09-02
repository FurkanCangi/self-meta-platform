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
  DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN,
  interpretStudentRequestWithEvidenceFirstProvider,
} from "../src/lib/dna/chat/studentFirst/evidenceFirstInterpreter.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const FIXTURE_PATH = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const EXPECTED_FIXTURE_SHA256 = "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65"
const TOTAL_EXPECTED_TURNS = 40
const MINIMUM_FULL_PASS_TURNS = 36

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly Readonly<{ turnId: string; user: string; expected: StudentLegacyExpectation }>[]
  }>[]
}>

function safeFailure(
  assessment: StudentContractAssessment,
  expected: StudentDevelopmentExpectation,
  actual: StudentRequestContract,
) {
  return Object.freeze({
    turnId: assessment.turnId,
    failedDimensions: Object.entries(assessment.dimensions).filter(([, decision]) => decision === "fail").map(([dimension]) => dimension),
    expected: {
      semanticTask: expected.semanticTask,
      conversationAction: expected.conversationAction,
      targetIds: expected.targetIds,
      referentTurnId: expected.referentTurnId,
      requiredObligationKinds: expected.requiredObligationKinds,
    },
    actual: {
      semanticTask: actual.semanticTask,
      conversationAction: actual.conversationAction,
      targetIds: actual.targetIds,
      referentTurnId: actual.referent.turnId,
      obligationKinds: actual.obligations.map((row) => row.kind),
    },
    missingObligationKinds: assessment.missingObligationKinds,
  })
}

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required after provider preflight")
  const before = readFileSync(FIXTURE_PATH)
  const beforeSha = createHash("sha256").update(before).digest("hex")
  assert.equal(beforeSha, EXPECTED_FIXTURE_SHA256, "Student40 fixture hash mismatch")
  const fixture = JSON.parse(before.toString("utf8")) as Fixture
  const assessments: StudentContractAssessment[] = []
  const failures: ReturnType<typeof safeFailure>[] = []
  const usageRows: DnaChatLunaUsage[] = []
  const latencies: number[] = []
  let providerCalls = 0
  let transportRetries = 0
  let partialUsageTurns = 0
  let stopReason: string | null = null
  let stoppedTurnId: string | null = null

  for (const conversation of fixture.conversations) {
    let state: StudentConversationState = createEmptyStudentConversationState()
    for (const [turnIndex, turn] of conversation.turns.entries()) {
      const result = await interpretStudentRequestWithEvidenceFirstProvider({ turnId: turn.turnId, message: turn.user, state })
      if ("provider" in result) {
        providerCalls += result.provider.attempts
        transportRetries += result.provider.transportRetries
        if (!result.provider.usageComplete) partialUsageTurns += 1
        usageRows.push(calculateDnaChatLunaUsage(result.provider.usage))
        latencies.push(result.provider.latencyMs)
      }
      if (!result.ok) {
        stopReason = `${result.reason}${"failureCode" in result ? `/${result.failureCode}` : ""}`
        stoppedTurnId = turn.turnId
        break
      }
      const expected = adaptStudentDevelopmentExpectation({ turnIndex, expected: turn.expected })
      const assessment = assessStudentDevelopmentContract({ turnId: turn.turnId, expected, actual: result.contract })
      assessments.push(assessment)
      if (!assessment.fullPass) failures.push(safeFailure(assessment, expected, result.contract))
      state = applyStudentRequestContract(state, result.contract)
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
    }
    if (stopReason) break
  }

  const score = scoreStudentDevelopmentContracts({ assessments, totalExpectedTurns: TOTAL_EXPECTED_TURNS, minimumFullPassTurns: MINIMUM_FULL_PASS_TURNS })
  const usage = sumDnaChatLunaUsage(usageRows)
  const afterSha = createHash("sha256").update(readFileSync(FIXTURE_PATH)).digest("hex")
  assert.equal(afterSha, beforeSha, "Student40 fixture mutated")
  console.log(JSON.stringify({
    ok: score.pass,
    gate: "STUDENT_B1_STUDENT40_SEMANTIC_CONTRACT",
    stoppedEarly: stopReason !== null,
    stopReason,
    stoppedTurnId,
    fixture: { sha256: afterSha, mutated: false, certificationEligible: false },
    score,
    provider: {
      calls: providerCalls,
      usage,
      averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
      rawOutputLogged: false,
      transportRetries,
      partialUsageTurns,
      maxProviderCallsPerTurn: DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN,
    },
    failures,
  }, null, 2))
  if (!score.pass) process.exitCode = 1
}

void main().catch((error) => {
  console.error(JSON.stringify({ ok: false, gate: "STUDENT_B1_STUDENT40_SEMANTIC_CONTRACT", failure: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 1
})
