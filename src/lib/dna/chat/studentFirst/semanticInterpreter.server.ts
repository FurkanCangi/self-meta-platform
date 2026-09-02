import "server-only"

import { inspectDnaChatSafety } from "../safety"
import {
  requestDnaS13StructuredOutputDetailed,
  type DnaS13ProviderFailure,
  type DnaS13ProviderUsage,
} from "../s13/server"
import type { StudentConversationState, StudentRequestContract } from "./contracts"
import {
  compileStudentRequestContract,
  DNA_STUDENT_SEMANTIC_INTERPRETER_INSTRUCTIONS,
  studentSemanticFrameSchema,
  studentSemanticInterpreterContent,
  validateStudentSemanticFrame,
} from "./semanticInterpreter"

export type StudentSemanticInterpreterResult =
  | Readonly<{
      ok: true
      contract: StudentRequestContract
      provider: Readonly<{
        responseId: string | null
        usage: DnaS13ProviderUsage
        latencyMs: number
      }>
    }>
  | Readonly<{ ok: false; reason: "safety_blocked" | "invalid_structured_output" }>
  | Readonly<{ ok: false; reason: "provider_failure"; failure: DnaS13ProviderFailure }>

export async function interpretStudentRequestWithProvider(input: Readonly<{
  turnId: string
  message: string
  state: StudentConversationState
  apiKey?: string
}>): Promise<StudentSemanticInterpreterResult> {
  const safety = inspectDnaChatSafety(input.message)
  if (safety.blocked && safety.category === "privacy") return Object.freeze({ ok: false, reason: "safety_blocked" })

  const attempt = await requestDnaS13StructuredOutputDetailed({
    name: "dna_student_semantic_frame",
    schema: studentSemanticFrameSchema(input.state),
    instructions: DNA_STUDENT_SEMANTIC_INTERPRETER_INSTRUCTIONS,
    content: studentSemanticInterpreterContent(input),
    maxOutputTokens: 650,
    apiKey: input.apiKey,
  })
  if (!attempt.ok) return Object.freeze({ ok: false, reason: "provider_failure", failure: attempt.failure })
  const provider = attempt.result
  const frame = validateStudentSemanticFrame(provider.value, input.state)
  if (!frame) return Object.freeze({ ok: false, reason: "invalid_structured_output" })
  return Object.freeze({
    ok: true,
    contract: compileStudentRequestContract(input.turnId, frame),
    provider: Object.freeze({
      responseId: provider.responseId,
      usage: provider.usage,
      latencyMs: provider.latencyMs,
    }),
  })
}
