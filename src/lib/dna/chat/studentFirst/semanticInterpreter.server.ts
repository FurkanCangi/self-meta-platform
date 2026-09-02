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
  validateStudentSemanticFrameDetailed,
  type StudentFrameFailureCode,
} from "./semanticInterpreter"

type StudentSemanticProviderEvidence = Readonly<{
  responseId: string | null
  usage: DnaS13ProviderUsage
  latencyMs: number
}>

export type StudentSemanticInterpreterResult =
  | Readonly<{
      ok: true
      contract: StudentRequestContract
      provider: StudentSemanticProviderEvidence
    }>
  | Readonly<{ ok: false; reason: "safety_blocked" }>
  | Readonly<{
      ok: false
      reason: "invalid_structured_output"
      failureCode: StudentFrameFailureCode
      provider: StudentSemanticProviderEvidence
    }>
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
  const providerEvidence = Object.freeze({
    responseId: provider.responseId,
    usage: provider.usage,
    latencyMs: provider.latencyMs,
  })
  const validation = validateStudentSemanticFrameDetailed(provider.value, input.state)
  if (!validation.ok) return Object.freeze({
    ok: false,
    reason: "invalid_structured_output",
    failureCode: validation.failureCode,
    provider: providerEvidence,
  })
  return Object.freeze({
    ok: true,
    contract: compileStudentRequestContract(input.turnId, validation.frame),
    provider: providerEvidence,
  })
}
