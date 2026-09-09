import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { deflateRawSync, inflateRawSync } from "node:zlib"
import type { DnaChatConversationContext } from "../types"
import { DNA_STUDENT_FIRST_CONVERSATION_VERSION, type StudentConversationState } from "./contracts"
import { createEmptyStudentConversationState } from "./conversationState"
import { isStudentConversationEvidence, type StudentConversationEvidenceRef } from "./conversationEvidence"

export const STUDENT_APPLICATION_CONTEXT_VERSION = "dna-student-application-context@1"
export const STUDENT_APPLICATION_TOKEN_MAX_LENGTH = 6_000
const MAX_PLAIN_BYTES = 128 * 1024
const TTL_MS = 60 * 60 * 1_000

export type StudentApplicationState = Readonly<{
  student: StudentConversationState
  previousTopic: string | null
  normalContext: DnaChatConversationContext | null
  reportId: string | null
  lastRoute: "student" | "normal" | null
  sequence: number
  scientificEvidence?: readonly StudentConversationEvidenceRef[]
}>

export type StudentContextBinding = Readonly<{
  secret: string
  actorId: string
  conversationId: string
  candidateSha256: string
  nowMs?: number
}>

export function emptyStudentApplicationState(reportId: string | null): StudentApplicationState {
  return Object.freeze({ student: createEmptyStudentConversationState(), previousTopic: null,
    normalContext: null, reportId, lastRoute: null, sequence: 0 })
}

function key(binding: StudentContextBinding) {
  if (binding.secret.length < 32 || !binding.actorId || !binding.conversationId
    || !/^[a-f0-9]{64}$/.test(binding.candidateSha256)) throw new Error("student_context_configuration_invalid")
  // Domain-separated from the existing S13 token key. Tokens confer no report
  // ownership: the normal owned-report loader must reauthorize every report read.
  return createHash("sha256").update(STUDENT_APPLICATION_CONTEXT_VERSION).update("\0").update(binding.secret).digest()
}

function aad(binding: StudentContextBinding) {
  return Buffer.from(JSON.stringify([STUDENT_APPLICATION_CONTEXT_VERSION, binding.actorId,
    binding.conversationId, binding.candidateSha256]))
}

export function sealStudentApplicationContext(state: StudentApplicationState, binding: StudentContextBinding): string {
  if (state.scientificEvidence !== undefined && !isStudentConversationEvidence(state.scientificEvidence)) {
    throw new Error("student_history_evidence_invalid")
  }
  const plain = Buffer.from(JSON.stringify({ version: STUDENT_APPLICATION_CONTEXT_VERSION,
    issuedAt: binding.nowMs ?? Date.now(), state }))
  if (plain.length > MAX_PLAIN_BYTES) throw new Error("student_context_too_large")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(binding), iv)
  cipher.setAAD(aad(binding))
  const encrypted = Buffer.concat([cipher.update(deflateRawSync(plain)), cipher.final()])
  const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url")
  if (token.length > STUDENT_APPLICATION_TOKEN_MAX_LENGTH) throw new Error("student_context_too_large")
  return token
}

export function openStudentApplicationContext(token: string, binding: StudentContextBinding): StudentApplicationState | null {
  try {
    if (token.length < 40 || token.length > STUDENT_APPLICATION_TOKEN_MAX_LENGTH
      || !/^[A-Za-z0-9_-]+$/.test(token)) return null
    const bytes = Buffer.from(token, "base64url")
    if (bytes.toString("base64url") !== token) return null
    const decipher = createDecipheriv("aes-256-gcm", key(binding), bytes.subarray(0, 12))
    decipher.setAAD(aad(binding))
    decipher.setAuthTag(bytes.subarray(12, 28))
    // Authenticate before decompression; bound decompressed size as well.
    const compressed = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()])
    const payload = JSON.parse(inflateRawSync(compressed, { maxOutputLength: MAX_PLAIN_BYTES }).toString("utf8"))
    const age = (binding.nowMs ?? Date.now()) - payload.issuedAt
    if (payload.version !== STUDENT_APPLICATION_CONTEXT_VERSION || !Number.isSafeInteger(payload.issuedAt)
      || age < 0 || age >= TTL_MS || payload.state?.student?.version !== DNA_STUDENT_FIRST_CONVERSATION_VERSION
      || !Number.isSafeInteger(payload.state.sequence) || payload.state.sequence < 0
      || payload.state.student.semanticHistory.length > 8 || payload.state.student.semanticLedger.length > 64
      || (payload.state.scientificEvidence !== undefined && !isStudentConversationEvidence(payload.state.scientificEvidence))) return null
    return payload.state as StudentApplicationState
  } catch { return null }
}
