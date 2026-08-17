import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { DNA_S13_REQUESTED_FACETS, type DnaS13Depth, type DnaS13Focus, type DnaS13QuestionType, type DnaS13RequestedFacet } from "./contracts"
import { DNA_S13_PRAGMATIC_ACTIONS, type DnaS13PragmaticAction } from "./pragmaticTask"

export const DNA_S13_CONTEXT_TOKEN_VERSION = "dna-s13-context@3" as const
export const DNA_S13_CONTEXT_TTL_MS = 2 * 60 * 60 * 1_000

export type DnaS13ConversationState = Readonly<{
  version: typeof DNA_S13_CONTEXT_TOKEN_VERSION
  topicIds: readonly string[]
  focus: DnaS13Focus
  questionType: DnaS13QuestionType
  responseDepth: DnaS13Depth
  activeTopicId: string
  shownClaimIds: readonly string[]
  answeredFacets: readonly DnaS13RequestedFacet[]
  shownRelationIds: readonly string[]
  rejectedTopicIds?: readonly string[]
  previousAction?: DnaS13PragmaticAction | null
  previousFacets?: readonly DnaS13RequestedFacet[]
  lastResponseSlots: readonly Readonly<{
    topicId: string
    requestedFacet: DnaS13RequestedFacet | null
    claimIds: readonly string[]
  }>[]
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
  activeTopicId?: string | null
  shownClaimIds?: readonly string[]
  answeredFacets?: readonly DnaS13RequestedFacet[]
  shownRelationIds?: readonly string[]
  rejectedTopicIds?: readonly string[]
  previousAction?: DnaS13PragmaticAction | null
  previousFacets?: readonly DnaS13RequestedFacet[]
  lastResponseSlots?: readonly Readonly<{
    topicId: string
    requestedFacet: DnaS13RequestedFacet | null
    claimIds: readonly string[]
  }>[]
  secret: string
  now?: number
}>): string {
  const now = input.now ?? Date.now()
  const topicIds = [...new Set(input.topicIds.map((value) => value.trim()).filter(Boolean))].slice(0, 2)
  const safeIds = (values: readonly string[] | undefined, maximum: number) => [...new Set((values ?? [])
    .map((value) => value.trim()).filter((value) => /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/u.test(value)))].slice(0, maximum)
  const state: DnaS13ConversationState = Object.freeze({
    version: DNA_S13_CONTEXT_TOKEN_VERSION,
    topicIds: Object.freeze(topicIds),
    focus: input.focus,
    questionType: input.questionType,
    responseDepth: input.responseDepth,
    activeTopicId: input.activeTopicId && topicIds.includes(input.activeTopicId) ? input.activeTopicId : topicIds.at(-1) ?? "",
    shownClaimIds: Object.freeze(safeIds(input.shownClaimIds, 16)),
    answeredFacets: Object.freeze([...new Set(input.answeredFacets ?? [])]
      .filter((facet): facet is DnaS13RequestedFacet => DNA_S13_REQUESTED_FACETS.includes(facet)).slice(0, 9)),
    shownRelationIds: Object.freeze(safeIds(input.shownRelationIds, 12)),
    rejectedTopicIds: Object.freeze(safeIds(input.rejectedTopicIds, 2)),
    previousAction: input.previousAction && DNA_S13_PRAGMATIC_ACTIONS.includes(input.previousAction)
      ? input.previousAction : null,
    previousFacets: Object.freeze([...new Set(input.previousFacets ?? [])]
      .filter((facet): facet is DnaS13RequestedFacet => DNA_S13_REQUESTED_FACETS.includes(facet)).slice(0, 4)),
    lastResponseSlots: Object.freeze((input.lastResponseSlots ?? []).slice(0, 4).flatMap((slot) => {
      const claimIds = safeIds(slot.claimIds, 8)
      if (!topicIds.includes(slot.topicId) || !claimIds.length
        || (slot.requestedFacet !== null && !DNA_S13_REQUESTED_FACETS.includes(slot.requestedFacet))) return []
      return [Object.freeze({
        topicId: slot.topicId,
        requestedFacet: slot.requestedFacet,
        claimIds: Object.freeze(claimIds),
      })]
    })),
    issuedAt: now,
    expiresAt: now + DNA_S13_CONTEXT_TTL_MS,
  })
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(input.secret), iv)
  cipher.setAAD(Buffer.from(DNA_S13_CONTEXT_TOKEN_VERSION))
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `s13c3.${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`
}

export function openDnaS13ConversationState(input: Readonly<{
  token: string
  secret: string
  now?: number
}>): DnaS13ConversationState | null {
  const [prefix, ivValue, ciphertextValue, tagValue, extra] = input.token.split(".")
  if (prefix !== "s13c3" || !ivValue || !ciphertextValue || !tagValue || extra) return null
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
    const safeIds = (value: unknown, maximum: number) => Array.isArray(value) && value.length <= maximum
      && value.every((item) => typeof item === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/u.test(item))
    if (!state.activeTopicId || !state.topicIds.includes(state.activeTopicId)
      || !safeIds(state.shownClaimIds, 16) || !safeIds(state.shownRelationIds, 12)
      || !Array.isArray(state.answeredFacets) || state.answeredFacets.length > 9
      || state.answeredFacets.some((facet) => !DNA_S13_REQUESTED_FACETS.includes(facet))) return null
    if (state.rejectedTopicIds !== undefined && !safeIds(state.rejectedTopicIds, 2)) return null
    if (state.previousAction !== undefined && state.previousAction !== null
      && !DNA_S13_PRAGMATIC_ACTIONS.includes(state.previousAction)) return null
    if (state.previousFacets !== undefined && (!Array.isArray(state.previousFacets) || state.previousFacets.length > 4
      || state.previousFacets.some((facet) => !DNA_S13_REQUESTED_FACETS.includes(facet)))) return null
    if (!Array.isArray(state.lastResponseSlots) || state.lastResponseSlots.length > 4
      || state.lastResponseSlots.some((slot) => !slot || typeof slot !== "object"
        || !state.topicIds.includes(slot.topicId)
        || (slot.requestedFacet !== null && !DNA_S13_REQUESTED_FACETS.includes(slot.requestedFacet))
        || !safeIds(slot.claimIds, 8))) return null
    return Object.freeze({
      ...state,
      topicIds: Object.freeze([...state.topicIds]),
      shownClaimIds: Object.freeze([...state.shownClaimIds]),
      answeredFacets: Object.freeze([...state.answeredFacets]),
      shownRelationIds: Object.freeze([...state.shownRelationIds]),
      rejectedTopicIds: Object.freeze([...(state.rejectedTopicIds ?? [])]),
      previousAction: state.previousAction ?? null,
      previousFacets: Object.freeze([...(state.previousFacets ?? [])]),
      lastResponseSlots: Object.freeze(state.lastResponseSlots.map((slot) => Object.freeze({
        ...slot,
        claimIds: Object.freeze([...slot.claimIds]),
      }))),
    })
  } catch {
    return null
  }
}

export function tokensEqualForTest(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
