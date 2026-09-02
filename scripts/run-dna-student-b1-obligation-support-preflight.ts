import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
} from "../src/lib/dna/chat/studentFirst"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly Readonly<{ turnId: string; user: string }>[]
  }>[]
}>

const FIXTURE_PATH = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const EXPECTED_FIXTURE_SHA256 = "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65"
const MAX_COST_MICROUSD = 25_000

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  const bytes = readFileSync(FIXTURE_PATH)
  assert.equal(createHash("sha256").update(bytes).digest("hex"), EXPECTED_FIXTURE_SHA256)
  const fixture = JSON.parse(bytes.toString("utf8")) as Fixture
  const conversation = fixture.conversations.find((row) => row.conversationId === "STUDENT40-C01")
  assert.ok(conversation)
  const first = conversation.turns.find((row) => row.turnId === "STUDENT40-C01-T01")
  const compare = conversation.turns.find((row) => row.turnId === "STUDENT40-C01-T02")
  assert.ok(first && compare)

  let state = createEmptyStudentConversationState()
  const firstResolution = resolveStudentEvidenceFirstRequest({ turnId: first.turnId, message: first.user, state })
  if (!firstResolution.ok) throw new Error(`first_request_contract:${firstResolution.reason}`)
  state = applyStudentRequestContract(state, firstResolution.contract)

  const comparisonResolution = resolveStudentEvidenceFirstRequest({ turnId: compare.turnId, message: compare.user, state })
  if (!comparisonResolution.ok) throw new Error(`comparison_request_contract:${comparisonResolution.reason}`)
  assert.deepEqual(comparisonResolution.contract.obligations.map((row) => row.kind), [
    "distinguish_targets",
    "explain_relation",
  ])

  const execution = await executeStudentAnswer({ question: compare.user, contract: comparisonResolution.contract })
  if (!execution.ok) {
    const usage = calculateDnaChatLunaUsage(execution.provider.usage)
    console.log(JSON.stringify({
      ok: false,
      gate: "STUDENT_B1_TYPED_BLOCK_PREFLIGHT",
      turnId: compare.turnId,
      failure: execution.reason,
      detail: execution.reason === "candidate_invalid" ? execution.failureCodes : execution.failure.reason,
      providerCalls: execution.provider.calls,
      rawOutputsStored: 0,
      usage,
      maxCostMicrousd: MAX_COST_MICROUSD,
    }, null, 2))
    process.exitCode = 1
    return
  }
  assert.equal(execution.route, "provider_grounded")
  assert.equal(execution.provider.calls, 1)
  assert.equal(execution.provider.rawOutputStored, false)
  assert.deepEqual(
    [...execution.candidate.blocks.flatMap((block) => block.obligationIds)].sort(),
    [...comparisonResolution.contract.obligations.map((row) => row.id)].sort(),
  )
  assert.equal(execution.answer, execution.candidate.blocks.map((block) => block.text).join(" "))
  const usage = calculateDnaChatLunaUsage(execution.provider.usage)
  assert.ok(usage.costMicrousd <= MAX_COST_MICROUSD)

  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_B1_TYPED_BLOCK_PREFLIGHT",
    turnId: compare.turnId,
    targetIds: comparisonResolution.contract.targetIds,
    obligationKinds: comparisonResolution.contract.obligations.map((row) => row.kind),
    answer: execution.answer,
    blocks: execution.candidate.blocks,
    providerCalls: execution.provider.calls,
    rawOutputsStored: 0,
    usage,
    maxCostMicrousd: MAX_COST_MICROUSD,
  }, null, 2))
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    gate: "STUDENT_B1_TYPED_BLOCK_PREFLIGHT",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
