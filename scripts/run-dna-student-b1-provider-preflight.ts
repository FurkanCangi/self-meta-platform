import assert from "node:assert/strict"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
  type StudentConversationState,
} from "../src/lib/dna/chat/studentFirst"
import { interpretStudentRequestWithEvidenceFirstProvider } from "../src/lib/dna/chat/studentFirst/evidenceFirstInterpreter.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const MAX_COST_MICROUSD = 20_000

function append(state: StudentConversationState, turnId: string, message: string): StudentConversationState {
  const result = resolveStudentEvidenceFirstRequest({ turnId, message, state })
  if (!result.ok) throw new Error(`${turnId}: ${result.reason}`)
  return applyStudentRequestContract(state, result.contract)
}

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  let state = createEmptyStudentConversationState()
  state = append(state, "B1-PREFLIGHT-T01", "öz düzenleme ne demek")
  state = append(state, "B1-PREFLIGHT-T02", "dikkat ne demek")
  const result = await interpretStudentRequestWithEvidenceFirstProvider({
    turnId: "B1-PREFLIGHT-T03",
    message: "konulardan birine geri dönelim",
    state,
  })
  if (!result.ok) {
    const detail = result.reason === "provider_failure"
      ? `/${result.failure.reason}/${result.failure.httpStatus ?? "no_status"}/${result.failure.apiErrorCode ?? result.failure.apiErrorType ?? "no_code"}`
      : result.reason === "closed_slot_failure" ? `/${result.failureCode}` : ""
    throw new Error(`${result.reason}${detail}`)
  }
  assert.equal(result.provider.attempts, 1, "preflight must exercise one real closed-choice provider call")
  const usage = calculateDnaChatLunaUsage(result.provider.usage)
  assert.ok(usage.costMicrousd <= MAX_COST_MICROUSD, "provider preflight cost cap exceeded")
  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_B1_PROVIDER_PREFLIGHT",
    calls: result.provider.attempts,
    closedChoiceValid: true,
    providerOwnsConversationAction: false,
    providerOwnsSafetyIntent: false,
    rawOutputLogged: false,
    usage,
    latencyMs: Math.round(result.provider.latencyMs),
    maxCostMicrousd: MAX_COST_MICROUSD,
  }, null, 2))
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    gate: "STUDENT_B1_PROVIDER_PREFLIGHT",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
