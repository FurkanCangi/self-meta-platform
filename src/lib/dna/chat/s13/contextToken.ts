import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type { DnaS13Depth, DnaS13Focus, DnaS13QuestionType } from "./contracts"

export const DNA_S13_CONTEXT_TOKEN_VERSION = "dna-s13-context@1" as const
export const DNA_S13_CONTEXT_TTL_MS = 2 * 60 * 60 * 1_000

export type DnaS13ConversationState = Readonly<{
  version: typeof DNA_S13_CONTEXT_TOKEN_VERSION
  topicIds: readonly string[]
  focus: DnaS13Focus
  questionType: DnaS13QuestionType
  responseDepth: DnaS13Depth
  issuedAt: number
  expiresAt: number
}>

function keyFromSecret(secret: string) {
  if (secret.trim().length < 32) throw new Error("dna_s13_context_secret_too_short")
  return createHash("sha256").update(secret.trim()).digest()
}

function base64url(value: Buffer) {
  return value.toString("base64url")
}

export function sealDnaS13ConversationState(input: Readonly<{
  topicIds: readonly string[]
  focus: DnaS13Focus
  questionType: DnaS13QuestionType
  responseDepth: DnaS13Depth
  secret: string
  now?: number
}>): string {
  const now = input.now ?? Date.now()
  const topicIds = [...new Set(input.topicIds.map((value) => value.trim()).filter(Boolean))].slice(0, 2)
  const state: DnaS13ConversationState = Object.freeze({
    version: DNA_S13_CONTEXT_TOKEN_VERSION,
    topicIds: Object.freeze(topicIds),
    focus: input.focus,
    questionType: input.questionType,
    responseDepth: input.responseDepth,
    issuedAt: now,
    expiresAt: now + DNA_S13_CONTEXT_TTL_MS,
  })
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(input.secret), iv)
  cipher.setAAD(Buffer.from(DNA_S13_CONTEXT_TOKEN_VERSION))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `s13c1.${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`
}

export function openDnaS13ConversationState(input: Readonly<{
  token: string
  secret: string
  now?: number
}>): DnaS13ConversationState | null {
  const [prefix, ivValue, ciphertextValue, tagValue, extra] = input.token.split(".")
  if (prefix !== "s13c1" || !ivValue || !ciphertextValue || !tagValue || extra) return null
  try {
    const iv = Buffer.from(ivValue, "base64url")
    const ciphertext = Buffer.from(ciphertextValue, "base64url")
    const tag = Buffer.from(tagValue, "base64url")
    if (iv.length !== 12 || tag.length !== 16) return null
    const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(input.secret), iv)
    decipher.setAAD(Buffer.from(DNA_S13_CONTEXT_TOKEN_VERSION))
    decipher.setAuthTag(tag)
    const raw = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
    const state = JSON.parse(raw) as DnaS13ConversationState
    const now = input.now ?? Date.now()
    if (state.version !== DNA_S13_CONTEXT_TOKEN_VERSION || now < state.issuedAt - 60_000 || now >= state.expiresAt) return null
    if (state.expiresAt - state.issuedAt !== DNA_S13_CONTEXT_TTL_MS) return null
    if (!Array.isArray(state.topicIds) || state.topicIds.length > 2 || state.topicIds.some((value) => typeof value !== "string" || !value)) return null
    if (raw.includes("claimId") || raw.includes("requiredClaim") || raw.includes("passageId")) return null
    return Object.freeze({ ...state, topicIds: Object.freeze([...state.topicIds]) })
  } catch {
    return null
  }
}

export function tokensEqualForTest(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
