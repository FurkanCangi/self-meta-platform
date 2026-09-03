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
  let state = createEmptyStudentConversationState()
  let target: (typeof conversation.turns)[number] | null = null
  let targetResolution: ReturnType<typeof resolveStudentEvidenceFirstRequest> | null = null
  for (const turn of conversation.turns) {
    const resolution = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
    if (!resolution.ok) throw new Error(`request_contract:${turn.turnId}:${resolution.reason}`)
    if (turn.turnId === "STUDENT40-C01-T03") {
      target = turn
      targetResolution = resolution
      break
    }
    state = applyStudentRequestContract(state, resolution.contract)
  }
  assert.ok(target && targetResolution?.ok)
  assert.deepEqual([...targetResolution.contract.targetIds].sort(), ["self_control", "self_regulation"])
  assert.deepEqual(targetResolution.contract.obligations.map((row) => row.kind), [
    "give_concrete_example",
    "bind_example_to_target",
  ])
  assert.equal(targetResolution.contract.presentation.example, "concrete")
  assert.equal(targetResolution.contract.presentation.depth, "brief")

  const execution = await executeStudentAnswer({ question: target.user, contract: targetResolution.contract })
  if (!execution.ok) {
    const usage = calculateDnaChatLunaUsage(execution.provider.usage)
    console.log(JSON.stringify({
      ok: false,
      gate: "STUDENT_B1_TYPED_EXAMPLE_COMPOSITION_PREFLIGHT",
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
  assert.match(execution.answer, /^(?:öz düzenleme ve öz denetim|öz denetim ve öz düzenleme) açısından:/iu)
  const exampleObligation = execution.plan.obligations.find((row) => row.kind === "give_concrete_example")!
  const exampleBlock = execution.candidate.blocks.find((block) => block.obligationIds.includes(exampleObligation.id))
  assert.ok(exampleBlock)
  assert.equal(exampleBlock.blockKind, "example")
  assert.match(exampleBlock.text, /Örnek:/u)
  assert.equal((exampleBlock.text.match(/Örnek:/gu) ?? []).length, 1)
  const usage = calculateDnaChatLunaUsage(execution.provider.usage)
  assert.ok(usage.costMicrousd <= MAX_COST_MICROUSD)

  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_B1_TYPED_EXAMPLE_COMPOSITION_PREFLIGHT",
    turnId: target.turnId,
    targetIds: targetResolution.contract.targetIds,
    obligationKinds: targetResolution.contract.obligations.map((row) => row.kind),
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
    gate: "STUDENT_B1_TYPED_EXAMPLE_COMPOSITION_PREFLIGHT",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
