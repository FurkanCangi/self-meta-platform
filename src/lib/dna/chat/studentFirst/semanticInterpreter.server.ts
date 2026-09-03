import "server-only"

import { inspectDnaChatSafety } from "../safety"
import {
  requestDnaS13StructuredOutputDetailed,
  type DnaS13ProviderFailure,
  type DnaS13ProviderUsage,
} from "../s13/server"
import type { StudentConversationState, StudentRequestContract } from "./contracts"
import { observeStudentCaseContext } from "./caseContext"
import {
  compileStudentRequestContract,
  DNA_STUDENT_CONVERSATION_ACTIONS,
  DNA_STUDENT_SEMANTIC_INTERPRETER_INSTRUCTIONS,
  studentSemanticFrameSchema,
  studentSemanticInterpreterContent,
  groundStudentExplicitTargets,
  groundStudentRequestIntent,
  groundStudentTargetRoles,
  resolveStudentConversationAction,
  validateStudentSemanticFrameDetailed,
  type StudentFrameFailureCode,
} from "./semanticInterpreter"

export const DNA_STUDENT_SEMANTIC_REQUEST_TIMEOUT_MS = 15_000
export const DNA_STUDENT_MAX_PROVIDER_ATTEMPTS = 2
export const DNA_STUDENT_MAX_TRANSPORT_RETRIES_PER_TURN = 1
export const DNA_STUDENT_MAX_PROVIDER_CALLS_PER_TURN = 3

export type StudentSemanticProviderEvidence = Readonly<{
  attempts: number
  semanticAttempts: number
  transportRetries: number
  repairAttempted: boolean
  usageComplete: boolean
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
  | Readonly<{
      ok: false
      reason: "provider_failure"
      failure: DnaS13ProviderFailure
      provider: StudentSemanticProviderEvidence
    }>

function aggregateProviderEvidence(
  input: Readonly<{
    providerCalls: number
    semanticAttempts: number
    transportRetries: number
    usageComplete: boolean
  }>,
  rows: readonly Readonly<{ responseId: string | null; usage: DnaS13ProviderUsage; latencyMs: number }>[],
): StudentSemanticProviderEvidence {
  return Object.freeze({
    attempts: input.providerCalls,
    semanticAttempts: input.semanticAttempts,
    transportRetries: input.transportRetries,
    repairAttempted: input.semanticAttempts > 1,
    usageComplete: input.usageComplete,
    responseId: rows.at(-1)?.responseId ?? null,
    usage: Object.freeze({
      inputTokens: rows.reduce((sum, row) => sum + row.usage.inputTokens, 0),
      cachedInputTokens: rows.reduce((sum, row) => sum + row.usage.cachedInputTokens, 0),
      outputTokens: rows.reduce((sum, row) => sum + row.usage.outputTokens, 0),
    }),
    latencyMs: rows.reduce((sum, row) => sum + row.latencyMs, 0),
  })
}

function retryableStudentTransportFailure(failure: DnaS13ProviderFailure): boolean {
  return failure.reason === "timeout" || failure.reason === "network_error"
}

export async function interpretStudentRequestWithProvider(input: Readonly<{
  turnId: string
  message: string
  state: StudentConversationState
  apiKey?: string
  fetchImpl?: typeof fetch
}>): Promise<StudentSemanticInterpreterResult> {
  const safety = inspectDnaChatSafety(input.message)
  if (safety.blocked && safety.category === "privacy") return Object.freeze({ ok: false, reason: "safety_blocked" })

  const evidenceRows: Array<Readonly<{ responseId: string | null; usage: DnaS13ProviderUsage; latencyMs: number }>> = []
  let lastFailureCode: StudentFrameFailureCode | null = null
  let providerCalls = 0
  let semanticAttempts = 0
  let transportRetries = 0
  let usageComplete = true
  while (semanticAttempts < DNA_STUDENT_MAX_PROVIDER_ATTEMPTS && providerCalls < DNA_STUDENT_MAX_PROVIDER_CALLS_PER_TURN) {
    semanticAttempts += 1
    const repairSuffix = semanticAttempts === 1
      ? ""
      : `\n\nÖnceki yapı yerel doğrulamada ${lastFailureCode} koduyla reddedildi. Önceki çıktıyı görmeden, aynı kullanıcı isteğini yeniden yapılandır. En az bir semanticActs alanı true olmalı ve bütün alanlar talimatla tutarlı olmalı.`
    let attempt
    while (true) {
      providerCalls += 1
      attempt = await requestDnaS13StructuredOutputDetailed({
        name: "dna_student_semantic_frame",
        schema: studentSemanticFrameSchema(input.state),
        instructions: `${DNA_STUDENT_SEMANTIC_INTERPRETER_INSTRUCTIONS}${repairSuffix}`,
        content: studentSemanticInterpreterContent(input),
        maxOutputTokens: 650,
        timeoutMs: DNA_STUDENT_SEMANTIC_REQUEST_TIMEOUT_MS,
        apiKey: input.apiKey,
        fetchImpl: input.fetchImpl,
      })
      if (!attempt.ok && retryableStudentTransportFailure(attempt.failure)) usageComplete = false
      const canRetryTransport = !attempt.ok &&
        retryableStudentTransportFailure(attempt.failure) &&
        transportRetries < DNA_STUDENT_MAX_TRANSPORT_RETRIES_PER_TURN &&
        providerCalls < DNA_STUDENT_MAX_PROVIDER_CALLS_PER_TURN
      if (!canRetryTransport) break
      transportRetries += 1
    }
    if (!attempt.ok) return Object.freeze({
      ok: false,
      reason: "provider_failure",
      failure: attempt.failure,
      provider: aggregateProviderEvidence({ providerCalls, semanticAttempts, transportRetries, usageComplete }, evidenceRows),
    })
    evidenceRows.push(Object.freeze({
      responseId: attempt.result.responseId,
      usage: attempt.result.usage,
      latencyMs: attempt.result.latencyMs,
    }))
    const providerValue = attempt.result.value
    const providerRow = providerValue && typeof providerValue === "object" ? providerValue as Record<string, unknown> : null
    const providerAction = providerRow && DNA_STUDENT_CONVERSATION_ACTIONS.includes(providerRow.conversationAction as never)
      ? providerRow.conversationAction as StudentRequestContract["conversationAction"]
      : null
    const providerPresentation = providerRow?.presentation && typeof providerRow.presentation === "object"
      ? providerRow.presentation as Record<string, unknown>
      : null
    const actionResolvedValue = providerRow && providerAction
      ? Object.freeze({
          ...providerRow,
          conversationAction: resolveStudentConversationAction({
            message: input.message,
            providerAction,
            hasHistory: input.state.semanticLedger.length > 0,
            preserveMeaning: providerPresentation?.preserveMeaning === true,
          }),
        })
      : providerValue
    const explicitGroundedValue = groundStudentExplicitTargets({
      message: input.message,
      candidate: actionResolvedValue,
    })
    const intentGroundedValue = groundStudentRequestIntent({
      message: input.message,
      state: input.state,
      candidate: explicitGroundedValue,
    })
    const resolvedValue = groundStudentTargetRoles({
      message: input.message,
      state: input.state,
      candidate: intentGroundedValue,
    })
    const validation = validateStudentSemanticFrameDetailed(resolvedValue, input.state)
    if (validation.ok) return Object.freeze({
      ok: true,
      contract: compileStudentRequestContract(
        input.turnId,
        validation.frame,
        input.state,
        observeStudentCaseContext(input.message),
      ),
      provider: aggregateProviderEvidence({ providerCalls, semanticAttempts, transportRetries, usageComplete }, evidenceRows),
    })
    lastFailureCode = validation.failureCode
  }
  return Object.freeze({
    ok: false,
    reason: "invalid_structured_output",
    failureCode: lastFailureCode ?? "invalid_object",
    provider: aggregateProviderEvidence({ providerCalls, semanticAttempts, transportRetries, usageComplete }, evidenceRows),
  })
}
