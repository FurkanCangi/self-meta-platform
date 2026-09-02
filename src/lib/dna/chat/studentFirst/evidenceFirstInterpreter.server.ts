import "server-only"

import { inspectDnaChatSafety } from "../safety"
import {
  requestDnaS13StructuredOutputDetailed,
  type DnaS13ProviderFailure,
  type DnaS13ProviderUsage,
} from "../s13/server"
import type { StudentConversationState, StudentRequestContract } from "./contracts"
import {
  resolveStudentEvidenceFirstRequest,
  studentClosedSlotChoiceSchema,
  type StudentClosedSlotFailureCode,
  type StudentObservedRequestFacts,
  type StudentStateCandidateEnvelope,
} from "./evidenceFirstRequest"

export const DNA_STUDENT_EVIDENCE_FIRST_PROVIDER_TIMEOUT_MS = 15_000
export const DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN = 2
export const DNA_STUDENT_EVIDENCE_FIRST_MAX_TRANSPORT_RETRIES_PER_TURN = 1

export type StudentEvidenceFirstProviderEvidence = Readonly<{
  attempts: number
  transportRetries: number
  usageComplete: boolean
  responseId: string | null
  usage: DnaS13ProviderUsage
  latencyMs: number
}>

export type StudentEvidenceFirstInterpreterResult =
  | Readonly<{
      ok: true
      contract: StudentRequestContract
      provider: StudentEvidenceFirstProviderEvidence
    }>
  | Readonly<{ ok: false; reason: "safety_blocked" }>
  | Readonly<{
      ok: false
      reason: "diagnosis_contract_pending"
      provider: StudentEvidenceFirstProviderEvidence
    }>
  | Readonly<{
      ok: false
      reason: "closed_slot_failure"
      failureCode: StudentClosedSlotFailureCode
      provider: StudentEvidenceFirstProviderEvidence
    }>
  | Readonly<{
      ok: false
      reason: "provider_failure"
      failure: DnaS13ProviderFailure
      provider: StudentEvidenceFirstProviderEvidence
    }>

const ZERO_USAGE: DnaS13ProviderUsage = Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })

function evidence(input?: Readonly<{
  attempts: number
  transportRetries: number
  usageComplete: boolean
  responseId: string | null
  usage: DnaS13ProviderUsage
  latencyMs: number
}>): StudentEvidenceFirstProviderEvidence {
  return Object.freeze(input ?? {
    attempts: 0,
    transportRetries: 0,
    usageComplete: true,
    responseId: null,
    usage: ZERO_USAGE,
    latencyMs: 0,
  })
}

function retryable(failure: DnaS13ProviderFailure): boolean {
  return failure.reason === "timeout" || failure.reason === "network_error"
}

function closedChoiceContent(input: Readonly<{
  message: string
  facts: StudentObservedRequestFacts
  envelope: StudentStateCandidateEnvelope
}>): string {
  return JSON.stringify({
    currentUserMessage: input.message,
    fixed: {
      primaryTask: input.facts.semanticTaskCandidates,
      focusTargetIds: input.envelope.allowedFocusTargetIds,
      conversationAction: input.envelope.conversationAction,
      safetyIntent: input.envelope.safetyIntent,
    },
    referentCandidates: input.envelope.referentCandidates.map((candidate) => ({
      turnId: candidate.turnId,
      role: candidate.role,
      targetIds: candidate.targetIds,
      reason: candidate.eligibilityReason,
    })),
  })
}

const CLOSED_CHOICE_INSTRUCTIONS = `
Yalnız verilen kapalı adaylar arasında referans seçimi yap. Bilimsel cevap yazma. Yeni hedef, görev, referans, konuşma hareketi veya güvenlik etiketi üretme. focusTargetIds seçtiğin referansın targetIds alanıyla tutarlı olmalı. primaryTask şemadaki tek izinli değeri kullanmalı.
`.trim()

export async function interpretStudentRequestWithEvidenceFirstProvider(input: Readonly<{
  turnId: string
  message: string
  state: StudentConversationState
  apiKey?: string
  fetchImpl?: typeof fetch
}>): Promise<StudentEvidenceFirstInterpreterResult> {
  const safety = inspectDnaChatSafety(input.message)
  if (safety.blocked && safety.category === "privacy") return Object.freeze({ ok: false, reason: "safety_blocked" })

  const local = resolveStudentEvidenceFirstRequest(input)
  if (local.ok) return Object.freeze({ ok: true, contract: local.contract, provider: evidence() })
  if (local.reason === "diagnosis_contract_pending") return Object.freeze({
    ok: false,
    reason: "diagnosis_contract_pending",
    provider: evidence(),
  })
  if (local.failureCode !== "referent_choice_required") return Object.freeze({
    ok: false,
    reason: "closed_slot_failure",
    failureCode: local.failureCode,
    provider: evidence(),
  })

  let attempts = 0
  let transportRetries = 0
  let usageComplete = true
  while (attempts < DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN) {
    attempts += 1
    const attempt = await requestDnaS13StructuredOutputDetailed({
      name: "dna_student_evidence_first_closed_choice",
      schema: studentClosedSlotChoiceSchema(local.facts, local.envelope),
      instructions: CLOSED_CHOICE_INSTRUCTIONS,
      content: closedChoiceContent({ message: input.message, facts: local.facts, envelope: local.envelope }),
      maxOutputTokens: 180,
      timeoutMs: DNA_STUDENT_EVIDENCE_FIRST_PROVIDER_TIMEOUT_MS,
      apiKey: input.apiKey,
      fetchImpl: input.fetchImpl,
    })
    if (!attempt.ok) {
      if (retryable(attempt.failure)) usageComplete = false
      const canRetry = retryable(attempt.failure) && transportRetries < DNA_STUDENT_EVIDENCE_FIRST_MAX_TRANSPORT_RETRIES_PER_TURN
      if (canRetry) {
        transportRetries += 1
        continue
      }
      return Object.freeze({
        ok: false,
        reason: "provider_failure",
        failure: attempt.failure,
        provider: evidence({
          attempts,
          transportRetries,
          usageComplete,
          responseId: null,
          usage: ZERO_USAGE,
          latencyMs: 0,
        }),
      })
    }
    const resolved = resolveStudentEvidenceFirstRequest({ ...input, choice: attempt.result.value })
    const provider = evidence({
      attempts,
      transportRetries,
      usageComplete,
      responseId: attempt.result.responseId,
      usage: attempt.result.usage,
      latencyMs: attempt.result.latencyMs,
    })
    if (resolved.ok) return Object.freeze({ ok: true, contract: resolved.contract, provider })
    if (resolved.reason === "diagnosis_contract_pending") return Object.freeze({ ok: false, reason: resolved.reason, provider })
    return Object.freeze({
      ok: false,
      reason: "closed_slot_failure",
      failureCode: resolved.failureCode,
      provider,
    })
  }
  return Object.freeze({
    ok: false,
    reason: "closed_slot_failure",
    failureCode: "referent_choice_required",
    provider: evidence({ attempts, transportRetries, usageComplete, responseId: null, usage: ZERO_USAGE, latencyMs: 0 }),
  })
}
