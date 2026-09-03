import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
} from "../src/lib/dna/chat/studentFirst"

type Expected = Readonly<{
  semanticTask: string
  conversationAction: string
  targetIds: readonly string[]
  rejectedTargetIds?: readonly string[]
  referentTurnId?: string
  requestedSentenceCount?: number
  obligationKinds: readonly string[]
}>

type Fixture = Readonly<{
  synthetic: boolean
  estimatedConversationMinutes: number
  turns: readonly Readonly<{ turnId: string; user: string; expected: Expected }>[]
}>

const FIXTURE_PATH = "scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json"

function sorted(values: readonly string[]) {
  return [...values].sort()
}

function equalSets(left: readonly string[], right: readonly string[]) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right))
}

function main() {
  const bytes = readFileSync(FIXTURE_PATH)
  const fixtureSha256 = createHash("sha256").update(bytes).digest("hex")
  const fixture = JSON.parse(bytes.toString("utf8")) as Fixture
  assert.equal(fixture.synthetic, true)
  assert.equal(fixture.estimatedConversationMinutes, 60)
  assert.equal(fixture.turns.length, 24)

  let state = createEmptyStudentConversationState()
  let oldHistoryReturnCount = 0
  let maximumTargetCount = 0
  const failures: Array<Record<string, unknown>> = []
  for (const turn of fixture.turns) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
    if (!resolved.ok) throw new Error(`${turn.turnId}:request_contract`)
    const contract = resolved.contract
    const dimensions = {
      semanticTask: contract.semanticTask === turn.expected.semanticTask,
      conversationAction: contract.conversationAction === turn.expected.conversationAction,
      targets: equalSets(contract.targetIds, turn.expected.targetIds),
      rejectedTargets: equalSets(contract.rejectedTargetIds, turn.expected.rejectedTargetIds ?? []),
      obligations: turn.expected.obligationKinds.every((kind) => contract.obligations.some((row) => row.kind === kind)),
      referent: turn.expected.referentTurnId === undefined || contract.referent.turnId === turn.expected.referentTurnId,
      sentenceCount: turn.expected.requestedSentenceCount === undefined
        || contract.presentation.requestedSentenceCount === turn.expected.requestedSentenceCount,
    }
    if (Object.values(dimensions).some((passed) => !passed)) failures.push({
      turnId: turn.turnId,
      failedDimensions: Object.entries(dimensions).filter(([, passed]) => !passed).map(([name]) => name),
      expected: turn.expected,
      actual: {
        semanticTask: contract.semanticTask,
        conversationAction: contract.conversationAction,
        targetIds: contract.targetIds,
        rejectedTargetIds: contract.rejectedTargetIds,
        referentTurnId: contract.referent.turnId,
        requestedSentenceCount: contract.presentation.requestedSentenceCount,
        obligationKinds: contract.obligations.map((row) => row.kind),
      },
    })
    if (turn.expected.referentTurnId) {
      const recent = state.semanticHistory.some((row) => row.turnId === turn.expected.referentTurnId)
      if (!recent) oldHistoryReturnCount += 1
    }
    maximumTargetCount = Math.max(maximumTargetCount, contract.targetIds.length)
    state = applyStudentRequestContract(state, contract)
  }

  assert.ok(oldHistoryReturnCount >= 1, "one-hour set must exercise a referent outside recent detailed history")
  assert.equal(state.semanticHistory.length, 8)
  assert.equal(state.semanticLedger.length, 24)
  assert.equal(JSON.stringify(state).includes(fixture.turns[0]!.user), false)

  console.log(JSON.stringify({
    ok: failures.length === 0,
    gate: "STUDENT_SYNTHETIC_ONE_HOUR24_CONTRACT_LOCAL",
    fixtureSha256,
    synthetic: true,
    certificationEligible: false,
    estimatedConversationMinutes: fixture.estimatedConversationMinutes,
    turns: fixture.turns.length,
    oldHistoryReturns: oldHistoryReturnCount,
    recentDetailedTurns: state.semanticHistory.length,
    semanticLedgerTurns: state.semanticLedger.length,
    maximumTargetCount,
    providerCalls: 0,
    rawMessagesPersisted: 0,
    failures,
  }, null, 2))
  if (failures.length) process.exitCode = 1
}

main()
