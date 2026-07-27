import type { DnaChatConversationContext } from "./types"

export const DNA_CHAT_CONVERSATION_POLICY_VERSION =
  "dna-chat-conversation-policy@2" as const

export type DnaChatResponseDepth = "short" | "standard" | "deep"

export type DnaChatRequestSnapshot = Readonly<{
  question: string
  reportId: string | null
  previousTopic: string | null
  conversationContext?: DnaChatConversationContext | null
  responseDepth: DnaChatResponseDepth
  appendUserMessage: boolean
}>

export type DnaChatActiveRequest = Readonly<{
  requestId: number
  controller: AbortController
  snapshot: DnaChatRequestSnapshot
}>

export type DnaChatRequestCoordinator = Readonly<{
  begin: (input: DnaChatRequestSnapshot) => DnaChatActiveRequest
  cancel: () => DnaChatRequestSnapshot | null
  complete: (requestId: number) => boolean
  isCurrent: (requestId: number) => boolean
}>

const RETRYABLE_DNA_CHAT_ERRORS = new Set([
  "request_cancelled",
  "too_many_requests",
  "audit_unavailable",
  "dna_chat_failed",
  "dna_chat_unavailable",
])

function normalizeOptionalContextValue(value: string | null) {
  const normalized = String(value || "").trim()
  return normalized || null
}

function normalizeConversationContext(
  value: DnaChatConversationContext | null | undefined,
): DnaChatConversationContext | null {
  if (!value) return null
  const topicIds = Array.from(new Set(value.topicIds
    .map((topicId) => String(topicId || "").trim())
    .filter(Boolean))).slice(0, 2)
  return topicIds.length
    ? Object.freeze({ topicIds: Object.freeze(topicIds), lastQueryKind: value.lastQueryKind })
    : null
}

export function createDnaChatRequestSnapshot(
  input: DnaChatRequestSnapshot,
): DnaChatRequestSnapshot {
  const question = String(input.question || "").trim()
  if (question.length < 2 || question.length > 600) {
    throw new Error("dna_chat_conversation_policy_invalid_question")
  }
  if (!(["short", "standard", "deep"] as const).includes(input.responseDepth)) {
    throw new Error("dna_chat_conversation_policy_invalid_response_depth")
  }
  return Object.freeze({
    question,
    reportId: normalizeOptionalContextValue(input.reportId),
    previousTopic: normalizeOptionalContextValue(input.previousTopic),
    conversationContext: normalizeConversationContext(input.conversationContext),
    responseDepth: input.responseDepth,
    appendUserMessage: input.appendUserMessage === true,
  })
}

/**
 * Owns the browser-only request lifecycle. Cancelling or starting a newer
 * request invalidates the older request before its promise can update React
 * state. The snapshot contains only the already-visible conversation context
 * and is never persisted by this coordinator.
 */
export function createDnaChatRequestCoordinator(): DnaChatRequestCoordinator {
  let sequence = 0
  let active: DnaChatActiveRequest | null = null
  return Object.freeze({
    begin(input) {
      const snapshot = createDnaChatRequestSnapshot(input)
      active?.controller.abort()
      const next = Object.freeze({
        requestId: sequence + 1,
        controller: new AbortController(),
        snapshot,
      })
      sequence = next.requestId
      active = next
      return next
    },
    cancel() {
      const cancelled = active
      sequence += 1
      active = null
      cancelled?.controller.abort()
      return cancelled?.snapshot ?? null
    },
    complete(requestId) {
      if (active?.requestId !== requestId) return false
      active = null
      return true
    },
    isCurrent(requestId) {
      return active?.requestId === requestId
    },
  })
}

export function planDnaChatRetry(
  snapshot: DnaChatRequestSnapshot,
): DnaChatRequestSnapshot {
  return createDnaChatRequestSnapshot({
    ...snapshot,
    appendUserMessage: false,
  })
}

export function shouldReuseDnaChatUserMessage(
  failedRequest: DnaChatRequestSnapshot | null,
  nextQuestion: string,
): boolean {
  return Boolean(
    failedRequest
      && failedRequest.question === String(nextQuestion || "").trim(),
  )
}

export function isDnaChatRetryableError(code: string): boolean {
  return RETRYABLE_DNA_CHAT_ERRORS.has(String(code || "").trim())
}

export type DnaChatNewConversationPlan = Readonly<{
  selectedReportId: null
  reportPickerOpen: false
  pendingReportQuestion: null
  previousTopic: null
  conversationContext: null
  draftQuestion: ""
  clearMessages: true
  clearReportOptions: true
  clearErrors: true
  preserveResponseDepth: true
}>

/** A new chat removes every browser-only clinical context but keeps the user's
 * preferred answer depth. No conversation payload is written to storage. */
export function planDnaChatNewConversation(): DnaChatNewConversationPlan {
  return Object.freeze({
    selectedReportId: null,
    reportPickerOpen: false,
    pendingReportQuestion: null,
    previousTopic: null,
    conversationContext: null,
    draftQuestion: "",
    clearMessages: true,
    clearReportOptions: true,
    clearErrors: true,
    preserveResponseDepth: true,
  })
}

export type DnaChatReportTransition = Readonly<{
  clearConversation: boolean
  selectedReportId: string | null
  reportPickerOpen: boolean
  previousTopic: null
  conversationContext: null
  pendingReportQuestion: null
  resubmitQuestions: readonly string[]
}>

/**
 * One pure policy is shared by the production client and offline release
 * evaluation. Binding the first report preserves the visible conversation.
 * Switching away from an already selected report creates an isolated
 * conversation so findings from two clients cannot be mixed. A pending report
 * question can be consumed once, only when a concrete report is selected.
 */
export function planDnaChatReportTransition(input: Readonly<
  | { action: "change_report"; pendingReportQuestion: string | null }
  | {
      action: "select_report"
      reportId: string
      currentReportId?: string | null
      pendingReportQuestion: string | null
    }
>): DnaChatReportTransition {
  if (input.action === "change_report") {
    return Object.freeze({
      clearConversation: true,
      selectedReportId: null,
      reportPickerOpen: true,
      previousTopic: null,
      conversationContext: null,
      pendingReportQuestion: null,
      resubmitQuestions: Object.freeze([]),
    })
  }
  const reportId = String(input.reportId || "").trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/.test(reportId)) {
    throw new Error("dna_chat_conversation_policy_invalid_report_id")
  }
  const currentReportId = normalizeOptionalContextValue(input.currentReportId ?? null)
  const pending = String(input.pendingReportQuestion || "").trim()
  return Object.freeze({
    clearConversation: Boolean(currentReportId && currentReportId !== reportId),
    selectedReportId: reportId,
    reportPickerOpen: false,
    previousTopic: null,
    conversationContext: null,
    pendingReportQuestion: null,
    resubmitQuestions: Object.freeze(pending ? [pending] : []),
  })
}

export type DnaChatReportSelectionCoordinator = Readonly<{
  claim: (input: Readonly<{
    reportId: string
    currentReportId?: string | null
    pendingReportQuestion: string | null
  }>) => DnaChatReportTransition | null
  release: () => void
  isInFlight: () => boolean
}>

export function canBeginDnaChatReportSelection(input: Readonly<{
  sending: boolean
  reportsLoading: boolean
  selectionInFlight: boolean
}>): boolean {
  return !input.sending && !input.reportsLoading && !input.selectionInFlight
}

/**
 * Synchronously claims one report-selection transition before React state or
 * network awaits can yield. A rapid second click therefore cannot consume and
 * resubmit the same pending question. The production client releases the lock
 * only after its single resubmission path settles.
 */
export function createDnaChatReportSelectionCoordinator(): DnaChatReportSelectionCoordinator {
  let inFlight = false
  return Object.freeze({
    claim(input) {
      if (inFlight) return null
      const transition = planDnaChatReportTransition({
        action: "select_report",
        reportId: input.reportId,
        currentReportId: input.currentReportId,
        pendingReportQuestion: input.pendingReportQuestion,
      })
      inFlight = true
      return transition
    },
    release() {
      inFlight = false
    },
    isInFlight() {
      return inFlight
    },
  })
}
