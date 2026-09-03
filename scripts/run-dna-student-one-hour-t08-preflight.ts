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
  turns: readonly Readonly<{ turnId: string; user: string }>[]
}>

const FIXTURE_PATH = "scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json"
const EXPECTED_FIXTURE_SHA256 = "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1"
const TARGET_TURN_ID = "ONEHOUR24-T08"
const REFERENT_TURN_ID = "ONEHOUR24-T07"
const MAX_COST_MICROUSD = 25_000

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
  assert.equal(createHash("sha256").update(bytes).digest("hex"), EXPECTED_FIXTURE_SHA256)
  const fixture = JSON.parse(bytes.toString("utf8")) as Fixture
  let state = createEmptyStudentConversationState()
  const visibleHistory: Array<{ turnId: string; user: string; assistant: string }> = []
  let target: (typeof fixture.turns)[number] | null = null
  let targetContract: ReturnType<typeof resolveStudentEvidenceFirstRequest> | null = null

  for (const turn of fixture.turns) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: turn.turnId, message: turn.user, state })
    if (!resolved.ok) throw new Error(`${turn.turnId}:request_contract`)
    if (turn.turnId === REFERENT_TURN_ID) {
      const referentAnswer = await executeStudentAnswer({ question: turn.user, contract: resolved.contract })
      assert.equal(referentAnswer.ok, true)
      if (!referentAnswer.ok) throw new Error(`${turn.turnId}:referent_answer`)
      assert.equal(referentAnswer.provider.calls, 0, "referent must use local safety route")
      visibleHistory.push({ turnId: turn.turnId, user: turn.user, assistant: referentAnswer.answer })
    }
    if (turn.turnId === TARGET_TURN_ID) {
      target = turn
      targetContract = resolved
      break
    }
    state = applyStudentRequestContract(state, resolved.contract)
  }

  assert.ok(target && targetContract?.ok)
  const contract = targetContract.contract
  assert.equal(contract.referent.turnId, REFERENT_TURN_ID)
  assert.equal(contract.presentation.language, "plain_student")
  assert.equal(contract.presentation.preserveMeaning, true)
  const execution = await executeStudentAnswer({ question: target.user, contract })
  if (!execution.ok) throw new Error(`${target.turnId}:${execution.reason}`)
  assert.equal(execution.route, "provider_grounded")
  assert.equal(execution.provider.calls, 1)
  assert.equal(execution.candidate.blocks.length, 1)
  assert.deepEqual(
    [...execution.candidate.blocks[0]!.obligationIds].sort(),
    execution.plan.obligations.map((row) => row.id).sort(),
  )

  const judged = await judgeStudentVisibleAnswer({
    question: target.user,
    answer: execution.answer,
    contract,
    plan: execution.plan,
    visibleHistory,
  })
  if (!judged.ok) throw new Error(`${target.turnId}:judge:${judged.reason}`)
  const usage = addUsage(execution.provider.usage, judged.usage)
  const cost = calculateDnaChatLunaUsage(usage)
  const pass = judged.judgment.verdict === "PASS"
  assert.ok(cost.costMicrousd <= MAX_COST_MICROUSD)

  console.log(JSON.stringify({
    ok: pass,
    gate: "STUDENT_SYNTHETIC_ONE_HOUR_T08_PLAIN_PREFLIGHT",
    turnId: target.turnId,
    blockCount: execution.candidate.blocks.length,
    obligationKinds: execution.plan.obligations.map((row) => row.kind),
    answer: execution.answer,
    judgment: judged.judgment,
    providerCalls: execution.provider.calls,
    judgeCalls: 1,
    rawOutputsStored: 0,
    usage: cost,
    maxCostMicrousd: MAX_COST_MICROUSD,
  }, null, 2))
  if (!pass) process.exitCode = 1
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    gate: "STUDENT_SYNTHETIC_ONE_HOUR_T08_PLAIN_PREFLIGHT",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
