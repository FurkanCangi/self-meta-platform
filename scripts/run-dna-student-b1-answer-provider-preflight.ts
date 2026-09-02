import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
  type StudentConversationState,
} from "../src/lib/dna/chat/studentFirst"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    turns: readonly Readonly<{ turnId: string; user: string }>[]
  }>[]
}>

const SELECTED_TURNS = new Set([
  "STUDENT40-C01-T01",
  "STUDENT40-C01-T08",
  "STUDENT40-C02-T03",
])
const MAX_COST_MICROUSD = 50_000

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  const fixture = JSON.parse(readFileSync(
    "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json",
    "utf8",
  )) as Fixture
  const results: Array<Record<string, unknown>> = []
  let inputTokens = 0
  let cachedInputTokens = 0
  let outputTokens = 0
  for (const conversation of fixture.conversations) {
    let state: StudentConversationState = createEmptyStudentConversationState()
    for (const turn of conversation.turns) {
      const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
      assert.equal(resolved.ok, true, `${turn.turnId}: request contract`)
      if (!resolved.ok) throw new Error(`${turn.turnId}: request contract missing`)
      if (SELECTED_TURNS.has(turn.turnId)) {
        const answer = await executeStudentAnswer({ question: turn.user, contract: resolved.contract })
        if (!answer.ok) {
          const detail = answer.reason === "provider_failure" ? answer.failure.reason : answer.failureCodes.join(",")
          throw new Error(`${turn.turnId}:${answer.reason}:${detail}`)
        }
        assert.equal(answer.route, "provider_grounded", `${turn.turnId}: preflight must exercise provider route`)
        assert.equal(answer.provider.calls, 1, `${turn.turnId}: exactly one provider call`)
        assert.equal(answer.provider.rawOutputStored, false, `${turn.turnId}: raw output storage`)
        inputTokens += answer.provider.usage.inputTokens
        cachedInputTokens += answer.provider.usage.cachedInputTokens
        outputTokens += answer.provider.usage.outputTokens
        results.push({
          turnId: turn.turnId,
          operation: resolved.contract.semanticTask,
          targetIds: resolved.contract.targetIds,
          obligationKinds: resolved.contract.obligations.map((row) => row.kind),
          answer: answer.answer,
          usedClaimCount: answer.candidate.usedClaimIds.length,
          illustrationKind: answer.candidate.illustrationKind,
          latencyMs: Math.round(answer.provider.latencyMs),
        })
      }
      state = applyStudentRequestContract(state, resolved.contract)
    }
  }
  assert.equal(results.length, SELECTED_TURNS.size)
  const usage = calculateDnaChatLunaUsage({ inputTokens, cachedInputTokens, outputTokens })
  assert.ok(usage.costMicrousd <= MAX_COST_MICROUSD, "visible answer preflight cost cap exceeded")
  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_B1_ANSWER_PROVIDER_PREFLIGHT",
    calls: results.length,
    maximumCallsPerTurn: 1,
    rawOutputsStored: 0,
    usage,
    maxCostMicrousd: MAX_COST_MICROUSD,
    results,
  }, null, 2))
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    gate: "STUDENT_B1_ANSWER_PROVIDER_PREFLIGHT",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
