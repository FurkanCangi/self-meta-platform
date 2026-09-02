import assert from "node:assert/strict"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { requestDnaS13StructuredOutputDetailed } from "../src/lib/dna/chat/s13/server"
import {
  createEmptyStudentConversationState,
  DNA_STUDENT_SEMANTIC_INTERPRETER_INSTRUCTIONS,
  studentSemanticFrameSchema,
  studentSemanticInterpreterContent,
  validateStudentSemanticFrameDetailed,
} from "../src/lib/dna/chat/studentFirst"
import { DNA_STUDENT_SEMANTIC_REQUEST_TIMEOUT_MS } from "../src/lib/dna/chat/studentFirst/semanticInterpreter.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const MAX_CALLS = 1
const MAX_COST_MICROUSD = 20_000

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  const state = createEmptyStudentConversationState()
  let calls = 0
  calls += 1
  assert.ok(calls <= MAX_CALLS)
  const attempt = await requestDnaS13StructuredOutputDetailed({
    name: "dna_student_semantic_preflight",
    schema: studentSemanticFrameSchema(state),
    instructions: DNA_STUDENT_SEMANTIC_INTERPRETER_INSTRUCTIONS,
    content: studentSemanticInterpreterContent({
      turnId: "STUDENT-PROVIDER-PREFLIGHT-T01",
      message: "yürütücü işlevler ne demek",
      state,
    }),
    maxOutputTokens: 650,
    timeoutMs: DNA_STUDENT_SEMANTIC_REQUEST_TIMEOUT_MS,
  })
  if (!attempt.ok) {
    console.error(JSON.stringify({ ok: false, gate: "STUDENT_PROVIDER_PREFLIGHT", calls, failure: attempt.failure }))
    process.exitCode = 1
    return
  }
  const validation = validateStudentSemanticFrameDetailed(attempt.result.value, state)
  if (!validation.ok) {
    console.error(JSON.stringify({
      ok: false,
      gate: "STUDENT_PROVIDER_PREFLIGHT",
      calls,
      failure: { reason: "invalid_structured_frame", failureCode: validation.failureCode },
      usage: calculateDnaChatLunaUsage(attempt.result.usage),
      latencyMs: Math.round(attempt.result.latencyMs),
    }))
    process.exitCode = 1
    return
  }
  const usage = calculateDnaChatLunaUsage(attempt.result.usage)
  assert.ok(usage.costMicrousd <= MAX_COST_MICROUSD, "provider preflight cost cap exceeded")
  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_PROVIDER_PREFLIGHT",
    calls,
    structuredFrameValid: true,
    rawOutputLogged: false,
    usage,
    latencyMs: Math.round(attempt.result.latencyMs),
    maxCostMicrousd: MAX_COST_MICROUSD,
    timeoutMs: DNA_STUDENT_SEMANTIC_REQUEST_TIMEOUT_MS,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
