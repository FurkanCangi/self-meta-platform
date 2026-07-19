export const DNA_CHAT_CONVERSATION_POLICY_VERSION =
  "dna-chat-conversation-policy@1" as const

export type DnaChatReportTransition = Readonly<{
  clearConversation: true
  selectedReportId: string | null
  reportPickerOpen: boolean
  previousTopic: null
  pendingReportQuestion: null
  resubmitQuestions: readonly string[]
}>

/**
 * One pure policy is shared by the production client and offline release
 * evaluation. A report switch always creates an isolated conversation; a
 * pending report question can be consumed once, only when a concrete report
 * is selected.
 */
export function planDnaChatReportTransition(input: Readonly<
  | { action: "change_report"; pendingReportQuestion: string | null }
  | { action: "select_report"; reportId: string; pendingReportQuestion: string | null }
>): DnaChatReportTransition {
  if (input.action === "change_report") {
    return Object.freeze({
      clearConversation: true,
      selectedReportId: null,
      reportPickerOpen: true,
      previousTopic: null,
      pendingReportQuestion: null,
      resubmitQuestions: Object.freeze([]),
    })
  }
  const reportId = String(input.reportId || "").trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/.test(reportId)) {
    throw new Error("dna_chat_conversation_policy_invalid_report_id")
  }
  const pending = String(input.pendingReportQuestion || "").trim()
  return Object.freeze({
    clearConversation: true,
    selectedReportId: reportId,
    reportPickerOpen: false,
    previousTopic: null,
    pendingReportQuestion: null,
    resubmitQuestions: Object.freeze(pending ? [pending] : []),
  })
}

export type DnaChatReportSelectionCoordinator = Readonly<{
  claim: (input: Readonly<{
    reportId: string
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
