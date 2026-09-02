import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import {
  adaptStudentDevelopmentExpectation,
  applyStudentRequestContract,
  assessStudentDevelopmentContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
  scoreStudentDevelopmentContracts,
  type StudentContractAssessment,
  type StudentLegacyExpectation,
} from "../src/lib/dna/chat/studentFirst"

const HARNESS_VERSION = "dna-student-evidence-first-contract-student40@1" as const
const FIXTURE_PATH = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const EXPECTED_FIXTURE_SHA256 = "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65"

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly Readonly<{ turnId: string; user: string; expected: StudentLegacyExpectation }>[]
  }>[]
}>

const before = readFileSync(FIXTURE_PATH)
assert.equal(createHash("sha256").update(before).digest("hex"), EXPECTED_FIXTURE_SHA256)
const fixture = JSON.parse(before.toString("utf8")) as Fixture
const assessments: StudentContractAssessment[] = []
const failures: Array<Record<string, unknown>> = []

for (const conversation of fixture.conversations) {
  let state = createEmptyStudentConversationState()
  for (const [turnIndex, turn] of conversation.turns.entries()) {
    const result = resolveStudentEvidenceFirstRequest({
      turnId: turn.turnId,
      message: turn.user,
      state,
    })
    if (!result.ok) {
      failures.push({ turnId: turn.turnId, reason: result.reason, failureCode: "failureCode" in result ? result.failureCode : null })
      continue
    }
    const expected = adaptStudentDevelopmentExpectation({ turnIndex, expected: turn.expected })
    const assessment = assessStudentDevelopmentContract({ turnId: turn.turnId, expected, actual: result.contract })
    assessments.push(assessment)
    if (!assessment.fullPass) failures.push({
      turnId: turn.turnId,
      dimensions: assessment.dimensions,
      expectedTargets: expected.targetIds,
      actualTargets: result.contract.targetIds,
      expectedReferent: expected.referentTurnId,
      actualReferent: result.contract.referent.turnId,
      expectedTask: expected.semanticTask,
      actualTask: result.contract.semanticTask,
      expectedAction: expected.conversationAction,
      actualAction: result.contract.conversationAction,
      missingObligations: assessment.missingObligationKinds,
    })
    state = applyStudentRequestContract(state, result.contract)
    assert.equal(JSON.stringify(state).includes(turn.user), false, `${turn.turnId}: raw message persisted`)
  }
}

const score = scoreStudentDevelopmentContracts({ assessments, totalExpectedTurns: 40, minimumFullPassTurns: 36 })
const afterSha = createHash("sha256").update(readFileSync(FIXTURE_PATH)).digest("hex")
assert.equal(afterSha, EXPECTED_FIXTURE_SHA256, "Student40 fixture mutated")
const ok = failures.length === 0 && score.pass
console.log(JSON.stringify({
  ok,
  gate: "STUDENT40_EVIDENCE_FIRST_R2_CONTRACT_LOCAL",
  version: HARNESS_VERSION,
  score,
  providerCalls: 0,
  rawMessagesPersisted: 0,
  fixture: { sha256: afterSha, mutated: false },
  failures,
}, null, 2))
if (!ok) process.exitCode = 1
