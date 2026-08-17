import "server-only"

import { createHmac } from "node:crypto"
import {
  openDnaS13ConversationState,
  sealDnaS13ConversationState,
  type DnaS13ConversationState as DnaS13SealedConversationState,
} from "../contextToken"
import type { DnaS13ConversationState } from "../conversationContext"
import type { DnaS13RequestedFacet } from "../contracts"
import type { DnaS13PragmaticAction } from "../pragmaticTask"

function perSubjectSecret(masterSecret: string, subjectId: string) {
  if (masterSecret.trim().length < 32 || !subjectId.trim()) return null
  return createHmac("sha256", masterSecret.trim())
    .update(`dna-s13-limited-context\u0000${subjectId.trim()}`)
    .digest("hex")
}

export function hashDnaS13LimitedIdentifier(input: Readonly<{
  secret: string
  kind: "subject" | "conversation"
  value: string
}>) {
  if (input.secret.trim().length < 32 || !input.value.trim()) return null
  return createHmac("sha256", input.secret.trim())
    .update(`${input.kind}\u0000${input.value.trim()}`)
    .digest("hex")
}

export function sealDnaS13LimitedContext(input: Readonly<{
  masterSecret: string
  subjectId: string
  topicIds: readonly string[]
  focus: DnaS13SealedConversationState["focus"]
  questionType: DnaS13SealedConversationState["questionType"]
  responseDepth: DnaS13SealedConversationState["responseDepth"]
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
  now?: number
}>) {
  const secret = perSubjectSecret(input.masterSecret, input.subjectId)
  if (!secret) return null
  return sealDnaS13ConversationState({
    topicIds: input.topicIds,
    focus: input.focus,
    questionType: input.questionType,
    responseDepth: input.responseDepth,
    activeTopicId: input.activeTopicId,
    shownClaimIds: input.shownClaimIds,
    answeredFacets: input.answeredFacets,
    shownRelationIds: input.shownRelationIds,
    rejectedTopicIds: input.rejectedTopicIds,
    previousAction: input.previousAction,
    previousFacets: input.previousFacets,
    lastResponseSlots: input.lastResponseSlots,
    secret,
    now: input.now,
  })
}

export function openDnaS13LimitedContext(input: Readonly<{
  token: string
  masterSecret: string
  subjectId: string
  sessionId: string
  now?: number
}>): DnaS13ConversationState | null {
  const secret = perSubjectSecret(input.masterSecret, input.subjectId)
  if (!secret) return null
  const state = openDnaS13ConversationState({ token: input.token, secret, now: input.now })
  if (!state || !state.topicIds.length) return null
  const activeTopicId = state.activeTopicId
  return Object.freeze({
    version: "dna-s13-conversation-context@5" as const,
    sessionId: input.sessionId,
    privacyCategory: "general_non_sensitive" as const,
    lastEligibleTopicIds: Object.freeze([...state.topicIds]),
    lastEligibleFocus: state.focus,
    lastEligibleQuestionType: state.questionType,
    lastEligibleRequiredClaimIds: Object.freeze([...new Set(state.lastResponseSlots.flatMap((slot) => slot.claimIds))]),
    lastEligibleLockedClaimIds: Object.freeze([...new Set(state.lastResponseSlots.flatMap((slot) => slot.claimIds))]),
    lastEligibleAnswerSlots: Object.freeze(state.lastResponseSlots.map((slot, index) => Object.freeze({
      id: `previous-slot-${index + 1}`,
      topicId: slot.topicId,
      questionType: state.questionType,
      requiredClaimIds: Object.freeze([...slot.claimIds]),
      requestedFacet: slot.requestedFacet,
    }))),
    lastEligibleNormalizedQuestion: "",
    lastEligibleUserQuestion: "",
    lastEligibleAnswerDepth: state.responseDepth,
    lastEligibleComparisonSideA: state.topicIds.length === 2 ? state.topicIds[0]! : null,
    lastEligibleComparisonSideB: state.topicIds.length === 2 ? state.topicIds[1]! : null,
    lastEligibleComparisonConclusionMode: null,
    lastEligibleActiveTopicId: activeTopicId,
    lastEligibleRejectedTopicIds: Object.freeze([...(state.rejectedTopicIds ?? [])]),
    lastEligiblePragmaticAction: state.previousAction ?? null,
    lastEligibleRequestedFacets: Object.freeze([...(state.previousFacets ?? [])]),
    alreadyShownClaimIds: Object.freeze([...state.shownClaimIds]),
    alreadyAnsweredFacets: Object.freeze([...state.answeredFacets]),
    alreadyShownRelationIds: Object.freeze([...state.shownRelationIds]),
  })
}
