import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { buildDnaChatAuditMetadata, type DnaChatApiPayload, type DnaChatApiResolverDependencies } from "../src/lib/dna/chat/apiResolver"
import { createDnaChatSafeCaseContext } from "../src/lib/dna/chat"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import type { DnaChatCaseContextInput } from "../src/lib/dna/chat/types"
import type { StudentRequestContract } from "../src/lib/dna/chat/studentFirst/contracts"
import { executeStudentAnswer, type StudentAnswerExecutorResult } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { resolveStudentApplicationTurn, studentLocalCandidateEnabled } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import type { interpretStudentContextScope, StudentContextScopeResult } from "../src/lib/dna/chat/studentFirst/evidenceFirstInterpreter.server"
import { openStudentApplicationContext, type StudentApplicationState } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import type { DnaS13ProviderUsage } from "../src/lib/dna/chat/s13/server"
import { DNA_S13_LIMITED_ROLLOUT_ENV } from "../src/lib/dna/chat/s13/limitedRollout/config"

export const STUDENT_APPLICATION_REPLAY_VERSION = "dna-student-application-replay@2"
export const STUDENT_REPLAY_AUTHORITY = "SHARED_APPLICATION_CONTROLLER_SYNTHETIC_REPORT_AND_AUDIT_NOT_AUTHENTICATED_E2E"
export const STUDENT_REPLAY_CLOCK = "DETERMINISTIC_SEQUENCE_CLOCK_NOT_REAL_SESSION_DURATION_PROOF"
export const REPLAY_ZERO_USAGE: DnaS13ProviderUsage = Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })
export function replayHash(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex") }
export function addReplayUsage(a: DnaS13ProviderUsage, b: DnaS13ProviderUsage): DnaS13ProviderUsage {
  return { inputTokens: a.inputTokens + b.inputTokens, cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens,
    outputTokens: a.outputTokens + b.outputTokens }
}

export function studentApplicationReplaySha256(files: readonly string[]): string {
  const digest = createHash("sha256").update(STUDENT_APPLICATION_REPLAY_VERSION).update("\0")
  for (const file of [...new Set([
    "scripts/dna-student-application-replay.ts", "scripts/dna-student-replay-journal.ts",
    "scripts/dna-replay-public-api.ts", "scripts/dna-student-candidate-identity.ts", "package-lock.json", ...files,
  ])].sort()) digest.update(file).update("\0").update(readFileSync(file)).update("\0")
  return digest.digest("hex")
}

// No expected target, operation, gold answer, or reconstructed conversation
// state is accepted here. Only fields available to the application are used.
export type StudentReplayInput = Readonly<{
  question: string
  mode?: DnaChatApiPayload["mode"]
  responseDepth?: DnaChatApiPayload["responseDepth"]
  reportId?: string | null
  reportContext?: DnaChatCaseContextInput | null
}>
type StudentCapture = Readonly<{ contract: StudentRequestContract; result: StudentAnswerExecutorResult }>
export type StudentReplayTurn = Readonly<{
  version: typeof STUDENT_APPLICATION_REPLAY_VERSION
  authority: typeof STUDENT_REPLAY_AUTHORITY
  clockAuthority: typeof STUDENT_REPLAY_CLOCK
  candidateSha256: string
  replaySha256: string
  sessionId: string
  ordinal: number
  nowMs: number
  inputSha256: string
  beforeTokenSha256: string
  beforeStateSha256: string
  status: number
  body: Record<string, unknown>
  visibleAnswer: string | null
  accessedCaseReport: boolean
  student: StudentCapture | null
  usage: DnaS13ProviderUsage
  providerCalls: number
  usageComplete: boolean
  requestInterpretation?: StudentContextScopeResult
  reportLoads: number
  auditWrites: number
  receiptSha256: string
}>

export function createStudentApplicationReplaySession(options: {
  candidateSha256: string
  replaySha256: string
  sessionId: string
  secret: string
  execute?: typeof executeStudentAnswer
  interpretScope?: typeof interpretStudentContextScope
  normal?: DnaChatApiResolverDependencies
}) {
  assert.match(options.candidateSha256, /^[a-f0-9]{64}$/)
  assert.match(options.replaySha256, /^[a-f0-9]{64}$/)
  assert.ok(options.sessionId && options.secret.length >= 32, "replay_binding_missing")
  const uuid = replayHash(`${options.replaySha256}\0${options.sessionId}`)
  const conversationId = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-4${uuid.slice(13, 16)}-8${uuid.slice(17, 20)}-${uuid.slice(20, 32)}`
  let token: string | undefined
  let ordinal = 0
  let busy = false
  let stopped = false
  const binding = (nowMs: number) => ({ secret: options.secret, actorId: "synthetic-evaluation",
    conversationId, candidateSha256: options.candidateSha256, nowMs })
  const envelope = (input: StudentReplayInput) => {
    const reportId = input.reportId ?? null
    const reportContext = input.reportContext ?? null
    assert.ok(!reportContext || (reportId && reportContext.dataStatus === "synthetic"), "replay_requires_synthetic_owned_report_input")
    const payload: DnaChatApiPayload = { question: input.question,
      ...(input.mode ? { mode: input.mode } : {}), responseDepth: input.responseDepth ?? "standard",
      ...(reportId ? { reportId } : {}) }
    return { payload, reportContext, inputSha256: replayHash(JSON.stringify({ payload, reportContext })) }
  }
  const header = (inputSha256: string) => ({ version: STUDENT_APPLICATION_REPLAY_VERSION,
    authority: STUDENT_REPLAY_AUTHORITY, clockAuthority: STUDENT_REPLAY_CLOCK,
    candidateSha256: options.candidateSha256, replaySha256: options.replaySha256,
    sessionId: options.sessionId, ordinal: ordinal + 1, nowMs: 1_000_000 + (ordinal + 1) * 1_000,
    inputSha256, beforeTokenSha256: replayHash(token ?? ""),
    beforeStateSha256: replayHash(JSON.stringify(token
      ? openStudentApplicationContext(token, binding(1_000_000 + (ordinal + 1) * 1_000)) : null)) } as const)
  const accept = (record: StudentReplayTurn) => {
    if (record.status === 200) {
      const normalized = normalizeDnaChatPublicResponse(record.body)
      assert.ok(normalized && normalized.studentContextToken, "replay_public_contract_rejected")
      assert.equal(replayPublicAnswerBody(normalized), record.visibleAnswer, "replay_visible_answer_mismatch")
      assert.ok(record.visibleAnswer?.trim(), "replay_visible_answer_empty")
      assert.ok(openStudentApplicationContext(normalized.studentContextToken, binding(record.nowMs)), "replay_context_authentication_failed")
      token = normalized.studentContextToken
    } else {
      assert.equal(record.visibleAnswer, null, "replay_failure_has_success_answer")
      assert.equal(record.body.studentContextToken, undefined, "replay_failure_has_state")
      stopped = true
    }
    ordinal++
    return record
  }
  return {
    /** Diagnostic only: callers must never use this to route or advance a turn. */
    state(): StudentApplicationState | null {
      return token ? openStudentApplicationContext(token, binding(1_000_000 + ordinal * 1_000)) : null
    },
    restore(input: StudentReplayInput, record: StudentReplayTurn): StudentReplayTurn {
      assert.ok(!busy && !stopped, "replay_session_unavailable")
      const { receiptSha256, ...content } = record
      assert.equal(replayHash(JSON.stringify(content)), receiptSha256, "replay_receipt_tampered")
      const expected = header(envelope(input).inputSha256)
      for (const [key, value] of Object.entries(expected)) assert.equal(record[key as keyof StudentReplayTurn], value, `replay_receipt_binding:${key}`)
      return accept(record)
    },
    async turn(input: StudentReplayInput): Promise<StudentReplayTurn> {
      assert.ok(!busy && !stopped, "replay_session_unavailable")
      assert.ok(studentLocalCandidateEnabled(), "replay_requires_explicit_local_application_candidate")
      const request = envelope(input)
      const identity = header(request.inputSha256)
      busy = true
      let captured: StudentCapture | null = null
      let reportLoads = 0
      let auditWrites = 0
      let executeThrew = false
      const normal = options.normal ?? {
        createRequestId: () => `application-replay-${identity.ordinal}`,
        resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
        loadCaseAnswer: async (query) => {
          if (!request.reportContext || query.reportId !== request.payload.reportId) return { ok: false as const, status: 404 as const, error: "report_not_found" }
          return { ok: true as const, answer: resolveCommittedDnaChatRuntime({ ...query,
            caseContext: createDnaChatSafeCaseContext(request.reportContext) }) }
        },
        writeAudit: async (audit) => { buildDnaChatAuditMetadata(audit); return { ok: true } },
      } satisfies DnaChatApiResolverDependencies
      try {
        const result = await resolveStudentApplicationTurn({ payload: request.payload, contextToken: token,
          interpretScope: options.interpretScope,
          binding: binding(identity.nowMs),
          normal: { ...normal,
            loadCaseAnswer: async (query) => { reportLoads++; return normal.loadCaseAnswer(query) },
            writeAudit: async (audit) => { auditWrites++; return normal.writeAudit(audit) } },
          execute: async (query) => {
            try {
              const result = await (options.execute ?? executeStudentAnswer)(query)
              captured = { contract: query.contract, result }
              return result
            } catch (error) { executeThrew = true; throw error }
          },
        })
        const student = captured as StudentCapture | null
        const publicAnswer = result.status === 200 ? normalizeDnaChatPublicResponse(result.body) : null
        const content = { ...identity, status: result.status, body: result.body,
          visibleAnswer: publicAnswer ? replayPublicAnswerBody(publicAnswer) : null,
          accessedCaseReport: result.accessedCaseReport, student,
          ...(result.requestInterpretation ? { requestInterpretation: result.requestInterpretation } : {}),
          usage: addReplayUsage(student?.result.provider.usage ?? REPLAY_ZERO_USAGE,
            result.requestInterpretation?.provider.usage ?? REPLAY_ZERO_USAGE),
          providerCalls: (student?.result.provider.calls ?? 0) + (result.requestInterpretation?.provider.attempts ?? 0),
          usageComplete: !executeThrew && (student?.result.provider.usageComplete ?? true)
            && (result.requestInterpretation?.provider.usageComplete ?? true), reportLoads, auditWrites }
        return accept({ ...content, receiptSha256: replayHash(JSON.stringify(content)) })
      } finally { busy = false }
    },
  }
}

export function configuredStudentReplaySession(options: {
  candidateSha256: string; replaySha256: string; sessionId: string
}) {
  return createStudentApplicationReplaySession({ ...options,
    secret: process.env[DNA_S13_LIMITED_ROLLOUT_ENV.contextSecret]?.trim() ?? "" })
}
