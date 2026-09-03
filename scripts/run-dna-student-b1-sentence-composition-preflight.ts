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
const TARGET_TURN_ID = "STUDENT40-C01-T08"
const MAX_COST_MICROUSD = 25_000

function visibleSentenceCount(text: string) {
  return (text.match(/[.!?](?=\s|$)/gu) ?? []).length
}

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  const bytes = readFileSync(FIXTURE_PATH)
  assert.equal(createHash("sha256").update(bytes).digest("hex"), EXPECTED_FIXTURE_SHA256)
  const fixture = JSON.parse(bytes.toString("utf8")) as Fixture
  const conversation = fixture.conversations.find((row) => row.conversationId === "STUDENT40-C01")
  assert.ok(conversation)

  let state = createEmptyStudentConversationState()
  let target: (typeof conversation.turns)[number] | null = null
  let targetResolution: ReturnType<typeof resolveStudentEvidenceFirstRequest> | null = null
  for (const turn of conversation.turns) {
    const resolution = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
    if (!resolution.ok) throw new Error(`request_contract:${turn.turnId}:${resolution.reason}`)
    if (turn.turnId === TARGET_TURN_ID) {
      target = turn
      targetResolution = resolution
      break
    }
    state = applyStudentRequestContract(state, resolution.contract)
  }

  assert.ok(target && targetResolution?.ok)
  assert.equal(targetResolution.contract.presentation.requestedSentenceCount, 3)
  assert.deepEqual(targetResolution.contract.obligations.map((row) => row.kind), [
    "summarize_known",
    "summarize_unknown",
    "summarize_observation_focus",
  ])

  const execution = await executeStudentAnswer({ question: target.user, contract: targetResolution.contract })
  if (!execution.ok) {
    const usage = calculateDnaChatLunaUsage(execution.provider.usage)
    console.log(JSON.stringify({
      ok: false,
      gate: "STUDENT_B1_SENTENCE_COMPOSITION_PREFLIGHT",
      turnId: target.turnId,
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
  assert.equal(execution.candidate.blocks.length, 3)
  assert.equal(visibleSentenceCount(execution.answer), 3)
  for (const obligation of execution.plan.obligations) {
    assert.ok(
      execution.candidate.blocks.some((block) => block.obligationIds.includes(obligation.id)),
      `missing obligation coverage:${obligation.kind}`,
    )
  }
  const usage = calculateDnaChatLunaUsage(execution.provider.usage)
  assert.ok(usage.costMicrousd <= MAX_COST_MICROUSD)

  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_B1_SENTENCE_COMPOSITION_PREFLIGHT",
    turnId: target.turnId,
    targetIds: targetResolution.contract.targetIds,
    obligationKinds: targetResolution.contract.obligations.map((row) => row.kind),
    requestedSentenceCount: targetResolution.contract.presentation.requestedSentenceCount,
    visibleSentenceCount: visibleSentenceCount(execution.answer),
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
    gate: "STUDENT_B1_SENTENCE_COMPOSITION_PREFLIGHT",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
