"use client"

import {
  ArrowUp,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAppSurface } from "@/app/components/app-shell/useAppSurface"
import { useTherapistIdentity } from "@/app/components/therapist-identity"
import {
  canBeginDnaChatReportSelection,
  createDnaChatRequestCoordinator,
  createDnaChatReportSelectionCoordinator,
  isDnaChatRetryableError,
  planDnaChatNewConversation,
  planDnaChatReportTransition,
  planDnaChatRetry,
  shouldReuseDnaChatUserMessage,
  type DnaChatRequestSnapshot,
  type DnaChatResponseDepth,
} from "@/lib/dna/chat/conversationPolicy"
import {
  DNA_INTELLIGENCE_REPORT_OWNERSHIP_NOTICE_TR,
} from "@/lib/dna/chat/intendedUse"
import {
  normalizeDnaChatPublicResponse,
  type DnaChatPublicAnswer as DnaAnswer,
  type DnaChatPublicV3AnswerSection as V3AnswerSection,
} from "@/lib/dna/chat/publicResponseNormalizer"
import type { DnaChatConversationContext } from "@/lib/dna/chat/types"
import DnaIssueFeedback, { DnaLimitedRolloutFeedback } from "./DnaIssueFeedback"

type ResponseDepth = DnaChatResponseDepth

type ReportOption = {
  id: string
  clientCode: string
  createdAt: string | null
  version: number | null
  ageBand: string | null
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: DnaAnswer }

const RESPONSE_DEPTH_OPTIONS: ReadonlyArray<{
  value: ResponseDepth
  label: string
  description: string
}> = [
  { value: "short", label: "Kısa", description: "Ana tanım ve temel sınır" },
  { value: "standard", label: "Standart", description: "Özet, ilişki ve bilgi sınırı" },
  { value: "deep", label: "Derin", description: "Daha fazla onaylı ayrıntı" },
]

const ERROR_MESSAGES: Record<string, string> = {
  request_cancelled: "Yanıt oluşturma durduruldu. Sorunuz korunuyor; hazır olduğunuzda yeniden deneyebilirsiniz.",
  invalid_payload: "Soru biçimi doğrulanamadı. Lütfen daha kısa ve açık biçimde yeniden yazın.",
  mode_report_mismatch: "Rapor sorusu için bir rapor seçilmelidir.",
  unauthorized: "Oturum doğrulanamadı. Yeniden giriş yapmanız gerekiyor.",
  session_expired: "Uygulama oturumunuz sona erdi. Yeniden giriş yapın.",
  report_not_found: "Rapor bulunamadı veya bu hesap için erişilebilir değil.",
  payload_too_large: "Soru izin verilen boyutu aşıyor.",
  too_many_requests: "Çok hızlı soru gönderildi. Kısa bir süre bekleyip yeniden deneyin.",
  audit_unavailable: "Vaka erişimi güvenli biçimde kaydedilemediği için cevap gösterilmedi.",
  dna_chat_failed: "DNA Asistanı şu anda yanıt veremiyor. Biraz sonra yeniden deneyin.",
  dna_chat_unavailable: "DNA Asistanı güvenli bakım modunda. Daha sonra yeniden deneyin.",
}

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatDate(value: string | null) {
  if (!value) return "Tarih yok"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Tarih yok"
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date)
}

const V3_ANSWER_SECTION_LABEL: Record<V3AnswerSection, string> = {
  definition: "Tanım",
  function_or_relation: "İşlev, mekanizma veya ilişki",
  development: "Gelişim",
  measurement: "Ölçüm",
  evidence_status: "Kanıt durumu",
  counter_evidence: "Karşı kanıt ve sınırlar",
  dna_boundary: "DNA ilişkisinin sınırı",
  case_context: "Vaka bağlamı",
  case_finding: "Raporda bulunan bulgu",
  case_missing: "Raporda bulunmayan veya eksik veri",
  general_literature: "Genel literatür",
  case_non_inference: "Bu vaka için çıkarılamayacak sonuç",
  preserved_capacity: "Korunmuş kapasite veya karşı kanıt",
  boundary: "Kanıt ve yorum sınırları",
}

function normalizeAnswer(value: unknown): DnaAnswer | null {
  return normalizeDnaChatPublicResponse(value)
}

export default function DnaAssistantClient({ initialReportId }: { initialReportId: string }) {
  const isAppSurface = useAppSurface(false)
  const { greetingName } = useTherapistIdentity()
  const router = useRouter()
  const [reports, setReports] = useState<ReportOption[]>([])
  const [selectedReportId, setSelectedReportId] = useState("")
  const [reportPickerOpen, setReportPickerOpen] = useState(false)
  const [pendingReportQuestion, setPendingReportQuestion] = useState<string | null>(null)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState("")
  const [reportsErrorCode, setReportsErrorCode] = useState("")
  const [reportSelectionNotice, setReportSelectionNotice] = useState("")
  const [reportSelectionInFlight, setReportSelectionInFlight] = useState(false)
  const [question, setQuestion] = useState("")
  const [responseDepth, setResponseDepth] = useState<ResponseDepth>("standard")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [previousTopic, setPreviousTopic] = useState<string | null>(null)
  const [conversationContext, setConversationContext] = useState<DnaChatConversationContext | null>(null)
  const [limitedRolloutContextToken, setLimitedRolloutContextToken] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [sendErrorCode, setSendErrorCode] = useState("")
  const [failedRequest, setFailedRequest] = useState<DnaChatRequestSnapshot | null>(null)
  const [composerHeight, setComposerHeight] = useState(224)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const composerFooterRef = useRef<HTMLElement>(null)
  const questionInputRef = useRef<HTMLTextAreaElement>(null)
  const reportPickerRef = useRef<HTMLElement>(null)
  const firstReportButtonRef = useRef<HTMLButtonElement>(null)
  const reportPickerFocusPendingRef = useRef(false)
  const reportRequestSequenceRef = useRef(0)
  const requestCoordinatorRef = useRef(createDnaChatRequestCoordinator())
  const conversationIdRef = useRef("")
  const reportSelectionCoordinatorRef = useRef(createDnaChatReportSelectionCoordinator())

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null
  const reportSelectionBlocked = !canBeginDnaChatReportSelection({
    sending,
    reportsLoading,
    selectionInFlight: reportSelectionInFlight,
  })

  const loadReports = useCallback(async (signal?: AbortSignal, linkedReportId = "") => {
    const reportRequestId = reportRequestSequenceRef.current + 1
    reportRequestSequenceRef.current = reportRequestId
    setReportsLoading(true)
    setReportsError("")
    setReportsErrorCode("")
    try {
      const response = await fetch("/api/app/dna-chat", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; reports?: ReportOption[]; error?: string }
        | null
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "dna_chat_failed")
      if (reportRequestSequenceRef.current !== reportRequestId) return null

      const nextReports = Array.isArray(payload.reports) ? payload.reports.slice(0, 10) : []
      setReports(nextReports)
      const linkedReportAvailable = Boolean(
        linkedReportId && nextReports.some((report) => report.id === linkedReportId),
      )
      setSelectedReportId((current) => {
        if (linkedReportAvailable) return linkedReportId
        if (current && nextReports.some((report) => report.id === current)) return current
        return ""
      })
      if (linkedReportId && !linkedReportAvailable) {
        reportPickerFocusPendingRef.current = true
        setReportSelectionNotice(
          "Bağlantıdaki rapor son 10 aktif DNA raporu içinde değil. Tartışmak için listeden bir rapor seçin.",
        )
        setReportPickerOpen(true)
      } else {
        setReportSelectionNotice("")
      }
      return nextReports
    } catch (error) {
      if (
        (error as Error)?.name === "AbortError"
        || reportRequestSequenceRef.current !== reportRequestId
      ) return null
      const code = error instanceof Error ? error.message : "dna_chat_failed"
      setReportsErrorCode(code)
      setReportsError(ERROR_MESSAGES[code] || ERROR_MESSAGES.dna_chat_failed)
      return null
    } finally {
      if (reportRequestSequenceRef.current === reportRequestId) setReportsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    if (initialReportId) void loadReports(controller.signal, initialReportId)
    return () => {
      controller.abort()
      reportRequestSequenceRef.current += 1
      requestCoordinatorRef.current.cancel()
    }
  }, [initialReportId, loadReports])

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    messageEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    })
  }, [composerHeight, messages, sending, reportPickerOpen])

  useEffect(() => {
    if (!reportPickerOpen || reportsLoading || !reportPickerFocusPendingRef.current) return
    const target = firstReportButtonRef.current ?? reportPickerRef.current
    requestAnimationFrame(() => target?.focus())
    reportPickerFocusPendingRef.current = false
  }, [reportPickerOpen, reports.length, reportsLoading])

  function moveQuestionFocus(nextQuestion?: string) {
    if (typeof nextQuestion === "string") setQuestion(nextQuestion)
    requestAnimationFrame(() => questionInputRef.current?.focus())
  }

  function cancelPendingResponse() {
    requestCoordinatorRef.current.cancel()
    setSending(false)
  }

  function stopPendingResponse() {
    const interruptedRequest = requestCoordinatorRef.current.cancel()
    setSending(false)
    if (!interruptedRequest) return
    const retryRequest = planDnaChatRetry(interruptedRequest)
    setFailedRequest(retryRequest)
    setQuestion(retryRequest.question)
    setSendErrorCode("request_cancelled")
    setSendError(ERROR_MESSAGES.request_cancelled)
    moveQuestionFocus(retryRequest.question)
  }

  function clearConversation() {
    cancelPendingResponse()
    setMessages([])
    setPreviousTopic(null)
    setConversationContext(null)
    setLimitedRolloutContextToken(null)
    conversationIdRef.current = ""
    setPendingReportQuestion(null)
    setQuestion("")
    setSendError("")
    setSendErrorCode("")
    setFailedRequest(null)
  }

  function startNewConversation() {
    if (reportSelectionCoordinatorRef.current.isInFlight()) return
    const plan = planDnaChatNewConversation()
    clearConversation()
    setSelectedReportId(plan.selectedReportId ?? "")
    setReportPickerOpen(plan.reportPickerOpen)
    setReportSelectionNotice("")
    if (plan.clearReportOptions) {
      reportRequestSequenceRef.current += 1
      setReports([])
      setReportsLoading(false)
      setReportsError("")
      setReportsErrorCode("")
    }
    router.replace("/dna-asistani", { scroll: false })
    moveQuestionFocus(plan.draftQuestion)
  }

  function removeReportContext() {
    if (reportSelectionCoordinatorRef.current.isInFlight()) return
    clearConversation()
    setSelectedReportId("")
    setReportPickerOpen(false)
    setReportSelectionNotice("")
    router.replace("/dna-asistani", { scroll: false })
    moveQuestionFocus()
  }

  function changeReportContext() {
    if (reportSelectionCoordinatorRef.current.isInFlight()) return
    const transition = planDnaChatReportTransition({
      action: "change_report",
      pendingReportQuestion,
    })
    if (transition.clearConversation) clearConversation()
    setSelectedReportId(transition.selectedReportId ?? "")
    reportPickerFocusPendingRef.current = true
    setReportPickerOpen(transition.reportPickerOpen)
    setReportSelectionNotice("")
    void loadReports()
  }

  async function sendQuestion(
    cleanQuestion: string,
    options: {
      reportId?: string | null
      appendUser?: boolean
      previousTopic?: string | null
      conversationContext?: DnaChatConversationContext | null
      responseDepth?: ResponseDepth
    } = {},
  ) {
    if (sending || cleanQuestion.length < 2) return

    const requestReportId = options.reportId === undefined
      ? selectedReportId
      : options.reportId ?? ""
    const requestPreviousTopic = options.previousTopic === undefined ? previousTopic : options.previousTopic
    const requestConversationContext = options.conversationContext === undefined
      ? conversationContext
      : options.conversationContext
    const request = requestCoordinatorRef.current.begin({
      question: cleanQuestion,
      reportId: requestReportId || null,
      previousTopic: requestPreviousTopic,
      conversationContext: requestConversationContext,
      responseDepth: options.responseDepth ?? responseDepth,
      appendUserMessage: options.appendUser !== false,
    })
    setSending(true)
    setSendError("")
    setSendErrorCode("")
    setFailedRequest(null)
    setQuestion("")
    if (request.snapshot.appendUserMessage) {
      setMessages((current) => [
        ...current,
        { id: messageId("user"), role: "user", text: request.snapshot.question },
      ])
    }

    try {
      if (!conversationIdRef.current) conversationIdRef.current = crypto.randomUUID()
      const response = await fetch("/api/app/dna-chat", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        signal: request.controller.signal,
        body: JSON.stringify({
          question: request.snapshot.question,
          responseDepth: request.snapshot.responseDepth,
          conversationId: conversationIdRef.current,
          ...(limitedRolloutContextToken ? { limitedRolloutContextToken } : {}),
          ...(request.snapshot.reportId ? { reportId: request.snapshot.reportId } : {}),
          ...((request.snapshot.previousTopic || request.snapshot.conversationContext)
            ? {
                context: {
                  ...(request.snapshot.previousTopic
                    ? { previousTopic: request.snapshot.previousTopic }
                    : {}),
                  ...(request.snapshot.conversationContext
                    ? {
                        topicIds: [...request.snapshot.conversationContext.topicIds],
                        lastQueryKind: request.snapshot.conversationContext.lastQueryKind,
                      }
                    : {}),
                },
              }
            : {}),
        }),
      })
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
      if (!response.ok || !payload?.ok) throw new Error(String(payload?.error || "dna_chat_failed"))
      const answer = normalizeAnswer(payload)
      if (!answer) throw new Error("dna_chat_failed")
      if (!requestCoordinatorRef.current.isCurrent(request.requestId)) return

      setMessages((current) => [...current, { id: messageId("assistant"), role: "assistant", answer }])
      setPreviousTopic(answer.topic)
      setConversationContext(answer.conversationContext ?? null)
      setLimitedRolloutContextToken(answer.limitedRolloutContextToken)
      if (answer.contextRequest?.type === "report" && !request.snapshot.reportId) {
        setPendingReportQuestion(request.snapshot.question)
        reportPickerFocusPendingRef.current = true
        setReportPickerOpen(true)
        await loadReports(request.controller.signal)
      }
    } catch (error) {
      if (
        (error as Error)?.name === "AbortError"
        || !requestCoordinatorRef.current.isCurrent(request.requestId)
      ) return
      const rawCode = error instanceof Error ? error.message : "dna_chat_failed"
      const code = ERROR_MESSAGES[rawCode] ? rawCode : "dna_chat_failed"
      const retryRequest = planDnaChatRetry(request.snapshot)
      setFailedRequest(retryRequest)
      setQuestion(retryRequest.question)
      setSendErrorCode(code)
      setSendError(ERROR_MESSAGES[code] || ERROR_MESSAGES.dna_chat_failed)
    } finally {
      if (requestCoordinatorRef.current.complete(request.requestId)) {
        setSending(false)
        if (!reportPickerFocusPendingRef.current) moveQuestionFocus()
      }
    }
  }

  async function chooseReport(reportId: string) {
    if (reportSelectionBlocked) return
    const coordinator = reportSelectionCoordinatorRef.current
    const transition = coordinator.claim({
      reportId,
      currentReportId: selectedReportId || null,
      pendingReportQuestion,
    })
    if (!transition) return
    setReportSelectionInFlight(true)
    // Clear the public pending state synchronously in the claimed path. The
    // coordinator ref is the same-tick guard until React commits this update.
    setPendingReportQuestion(null)
    try {
      if (transition.clearConversation) clearConversation()
      setSelectedReportId(transition.selectedReportId ?? "")
      reportPickerFocusPendingRef.current = false
      setReportPickerOpen(transition.reportPickerOpen)
      setReportSelectionNotice("")
      const [waitingQuestion] = transition.resubmitQuestions
      if (waitingQuestion && transition.selectedReportId) {
        await sendQuestion(waitingQuestion, {
          reportId: transition.selectedReportId,
          previousTopic: transition.clearConversation ? transition.previousTopic : previousTopic,
          conversationContext: transition.clearConversation
            ? transition.conversationContext
            : conversationContext,
          appendUser: transition.clearConversation,
        })
      } else {
        moveQuestionFocus()
      }
    } finally {
      coordinator.release()
      setReportSelectionInFlight(false)
    }
  }

  function submitQuestion(event?: React.FormEvent) {
    event?.preventDefault()
    const cleanQuestion = question.trim()
    if (sending || cleanQuestion.length < 2) return
    if (pendingReportQuestion) {
      setPendingReportQuestion(null)
      reportPickerFocusPendingRef.current = false
      setReportPickerOpen(false)
    }
    const reuseFailedMessage = shouldReuseDnaChatUserMessage(failedRequest, cleanQuestion)
    void sendQuestion(cleanQuestion, reuseFailedMessage && failedRequest
      ? {
          reportId: failedRequest.reportId,
          previousTopic: failedRequest.previousTopic,
          conversationContext: failedRequest.conversationContext,
          responseDepth,
          appendUser: false,
        }
      : {})
  }

  function retryLastQuestion() {
    if (!failedRequest || sending || !isDnaChatRetryableError(sendErrorCode)) return
    void sendQuestion(failedRequest.question, {
      reportId: failedRequest.reportId,
      previousTopic: failedRequest.previousTopic,
      conversationContext: failedRequest.conversationContext,
      responseDepth: failedRequest.responseDepth,
      appendUser: false,
    })
  }

  const hasConversation = messages.length > 0 || reportPickerOpen || sending

  useEffect(() => {
    if (!isAppSurface || !hasConversation) {
      setComposerHeight(224)
      return
    }
    const footer = composerFooterRef.current
    if (!footer) return
    const updateHeight = () => {
      const nextHeight = Math.ceil(footer.getBoundingClientRect().height)
      setComposerHeight((current) => current === nextHeight ? current : nextHeight)
    }
    updateHeight()
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateHeight)
      return () => window.removeEventListener("resize", updateHeight)
    }
    const observer = new ResizeObserver(updateHeight)
    observer.observe(footer)
    return () => observer.disconnect()
  }, [hasConversation, isAppSurface])

  useEffect(() => {
    const input = questionInputRef.current
    if (!input) return
    input.style.height = "auto"
    const nextHeight = Math.min(Math.max(input.scrollHeight, 48), 160)
    input.style.height = `${nextHeight}px`
    input.style.overflowY = input.scrollHeight > 160 ? "auto" : "hidden"
  }, [hasConversation, question])

  function renderComposer(hero: boolean) {
    return (
      <form onSubmit={submitQuestion} className="w-full">
        {sendError ? (
          <div id="dna-chat-send-error" role="alert" className="mb-3 rounded-2xl border border-rose-200 bg-[var(--sm-surface)] px-4 py-3 text-xs font-bold leading-5 text-[var(--sm-text)] shadow-sm">
            <p>{sendError}</p>
            {sendErrorCode === "unauthorized" || sendErrorCode === "session_expired" ? (
              <Link href="/app-login" className="mt-1 inline-flex min-h-11 items-center font-black text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                Yeniden giriş yap
              </Link>
            ) : failedRequest && isDnaChatRetryableError(sendErrorCode) ? (
              <button
                type="button"
                onClick={retryLastQuestion}
                disabled={sending}
                className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-black text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={15} aria-hidden="true" /> Soruyu yeniden dene
              </button>
            ) : null}
          </div>
        ) : null}

        <fieldset className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <legend className="sr-only">Yanıt ayrıntı düzeyi</legend>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--sm-text-muted)]">
            Yanıt uzunluğu
          </span>
          <div className="flex min-h-11 items-center rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] p-1" aria-label="Yanıt uzunluğu seçimi">
            {RESPONSE_DEPTH_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="relative flex min-h-11 cursor-pointer items-center rounded-full focus-within:outline-none"
                title={option.description}
              >
                <input
                  type="radio"
                  name="dna-response-depth"
                  value={option.value}
                  checked={responseDepth === option.value}
                  onChange={() => setResponseDepth(option.value)}
                  className="peer sr-only"
                />
                <span
                  className={[
                    "inline-flex min-h-11 items-center rounded-full px-3 text-[11px] font-black transition peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2",
                    responseDepth === option.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-[var(--sm-text-muted)] hover:bg-[var(--sm-surface)] hover:text-[var(--sm-text)]",
                  ].join(" ")}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div
          className={[
            "border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-[0_22px_70px_-38px_rgba(7,27,58,0.58)] transition-[border-color,box-shadow] focus-within:border-blue-400 focus-within:shadow-[0_26px_80px_-38px_rgba(37,99,235,0.48)] focus-within:ring-4 focus-within:ring-blue-100/70",
            hero ? "rounded-[30px] p-2.5 sm:p-3" : "rounded-[26px] p-2.5 sm:p-3",
          ].join(" ")}
        >
          <div className="flex items-end gap-2 sm:gap-3">
            <label htmlFor="dna-chat-question" className="sr-only">DNA Asistanına sorunuzu yazın</label>
            <textarea
              ref={questionInputRef}
              id="dna-chat-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 600))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  submitQuestion()
                }
              }}
              rows={1}
              maxLength={600}
              disabled={sending}
              aria-describedby={sendError ? "dna-chat-send-error" : undefined}
              placeholder={selectedReport ? "Bu raporla ilgili aklındaki soruyu yaz…" : "Aklındaki soruyu yaz…"}
              className={[
                "max-h-40 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 text-sm font-semibold leading-6 text-[var(--sm-text)] outline-none placeholder:font-medium placeholder:text-[var(--sm-text-muted)] disabled:opacity-60 sm:text-[15px]",
                "min-h-[48px] py-3",
              ].join(" ")}
            />
            <div className="flex shrink-0 items-center gap-2 pb-0.5">
              {question.length > 500 ? (
                <span className="hidden text-[10px] font-bold text-[var(--sm-text-muted)] sm:inline">{question.length}/600</span>
              ) : null}
              {sending ? (
                <button
                  type="button"
                  onClick={stopPendingResponse}
                  aria-label="Yanıt oluşturmayı durdur"
                  className="inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 text-xs font-black text-rose-800 shadow-sm transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                >
                  <X size={18} strokeWidth={2.6} aria-hidden="true" />
                  <span>Durdur</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={question.trim().length < 2}
                  aria-label="Soruyu gönder"
                  className="grid min-h-12 min-w-12 place-items-center rounded-full border border-blue-600 bg-blue-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_16px_30px_rgba(37,99,235,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
                >
                  <ArrowUp size={20} strokeWidth={2.6} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

      </form>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1040px] pb-2">
      <section
        className={[
          "relative flex min-h-[calc(100dvh-190px)] min-w-0 flex-col md:min-h-[calc(100dvh-150px)]",
          isAppSurface ? "min-h-[calc(100dvh-208px)] md:min-h-[calc(100dvh-190px)] lg:min-h-[calc(100dvh-154px)]" : "",
        ].join(" ")}
        aria-label="DNA Asistanı sohbeti"
      >
        <header className="flex min-h-14 flex-col gap-3 border-b border-[var(--sm-border)] px-1 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-blue-100 bg-[var(--sm-surface)] text-blue-700 shadow-sm">
              <Sparkles size={19} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-black tracking-tight text-[var(--sm-text)]">DNA Asistanı</h1>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--sm-text-muted)]">Klinik kararın yerine geçmez</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={startNewConversation}
              disabled={reportSelectionInFlight || (!hasConversation && !selectedReport && !question.trim())}
              aria-label="Yeni sohbet başlat; mevcut sohbeti ve rapor bağlamını temizle"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface)] px-3 text-xs font-black text-[var(--sm-text-soft)] shadow-sm transition hover:border-blue-200 hover:bg-[var(--sm-surface-soft)] hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={15} aria-hidden="true" /> Yeni sohbet
            </button>

            {selectedReport ? (
              <div role="status" className="flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 text-xs font-bold text-[var(--sm-text)] shadow-sm">
                <FileSearch size={17} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block max-w-28 truncate font-black">{selectedReport.clientCode || "Danışan kodu yok"}</span>
                  <span className="hidden text-[10px] text-cyan-700 sm:block">{formatDate(selectedReport.createdAt)}</span>
                </span>
                <button
                  type="button"
                  onClick={changeReportContext}
                  disabled={reportSelectionInFlight}
                  className="min-h-11 rounded-full px-2 font-black text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Değiştir
                </button>
                <button
                  type="button"
                  onClick={removeReportContext}
                  disabled={reportSelectionInFlight}
                  aria-label="Rapor bağlamını kaldır ve yeni sohbet başlat"
                  className="grid min-h-11 min-w-11 place-items-center rounded-full text-slate-500 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            ) : reportsLoading && initialReportId && !reportPickerOpen ? (
              <div role="status" className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface)] px-3 text-xs font-bold text-[var(--sm-text-muted)] shadow-sm">
                <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> Rapor bağlantısı doğrulanıyor
              </div>
            ) : null}
          </div>
        </header>

        {!hasConversation ? (
          <div
            className="flex flex-1 items-center justify-center px-1 py-8 sm:px-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            <div className="w-full max-w-[880px] text-center md:-translate-y-5">
              <Image
                src="/images/logo-icon.png"
                alt=""
                width={180}
                height={180}
                priority
                unoptimized
                className="mx-auto h-[68px] w-[68px] object-contain drop-shadow-[0_14px_24px_rgba(37,99,235,0.24)] sm:h-[76px] sm:w-[76px]"
                sizes="76px"
              />
              <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">DNA Intelligence</div>
              <h2 className="mx-auto mt-4 max-w-3xl text-[28px] font-semibold leading-tight tracking-[-0.035em] text-[var(--sm-text)] sm:text-4xl lg:text-[42px]">
                Nasıl yardımcı olabilirim{greetingName ? `, ${greetingName}` : ""}?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--sm-text-muted)] sm:text-[15px]">
                Bir kavramı açıklayabilir, iki süreci karşılaştırabilir veya seçtiğin DNA raporundaki güvenli
                bulguları birlikte inceleyebiliriz.
              </p>

              <div className="mx-auto mt-8 max-w-[840px] text-left">{renderComposer(true)}</div>

              <p className="mt-3 text-xs font-medium text-[var(--sm-text-muted)]">
                Aklındaki soruyu kendi cümlelerinle yazabilirsin.
              </p>

            </div>
          </div>
        ) : (
          <>
            <div
              className={[
                "flex-1 px-1 py-6 sm:px-4 sm:py-8",
                isAppSurface
                  ? "pb-[calc(var(--dna-composer-height)+90px+env(safe-area-inset-bottom))] lg:pb-8"
                  : "",
              ].join(" ")}
              style={isAppSurface
                ? ({ "--dna-composer-height": `${composerHeight}px` } as React.CSSProperties)
                : undefined}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              <div className="mx-auto max-w-[780px] space-y-7">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="ml-auto max-w-[88%] rounded-[24px] rounded-br-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-[var(--sm-text)] shadow-sm md:max-w-[76%]">
                      {message.text}
                    </div>
                  ) : (
                    <AssistantAnswer key={message.id} answer={message.answer} />
                  ),
                )}

                {reportPickerOpen ? (
                  <section
                    ref={reportPickerRef}
                    tabIndex={-1}
                    className="rounded-[26px] border border-cyan-200 bg-[var(--sm-surface)] p-4 shadow-[0_18px_46px_rgba(7,27,58,0.08)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:p-5"
                    aria-labelledby="dna-report-picker-title"
                  >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <FileSearch size={19} aria-hidden="true" />
                </span>
                <div>
                  <h3 id="dna-report-picker-title" className="text-sm font-black text-[var(--sm-text)]">Hangi raporla devam edelim?</h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
                    {DNA_INTELLIGENCE_REPORT_OWNERSHIP_NOTICE_TR}
                  </p>
                </div>
              </div>

              {reportSelectionNotice ? (
                <div role="status" className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                  {reportSelectionNotice}
                </div>
              ) : null}

              {reportsLoading ? (
                <div role="status" className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--sm-surface-soft)] px-3 text-xs font-semibold text-[var(--sm-text-muted)]">
                  <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> Raporlar yükleniyor
                </div>
              ) : reportsError ? (
                <div role="alert" className="mt-3 rounded-2xl border border-rose-200 bg-[var(--sm-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--sm-text)]">
                  {reportsError}
                  {reportsErrorCode === "unauthorized" || reportsErrorCode === "session_expired" ? (
                    <Link href="/app-login" className="mt-2 flex min-h-11 items-center font-black text-blue-700 underline-offset-4 hover:underline">
                      Yeniden giriş yap
                    </Link>
                  ) : (
                    <button type="button" onClick={() => void loadReports()} className="mt-2 flex min-h-11 items-center gap-2 font-black text-blue-700">
                      <RefreshCw size={15} aria-hidden="true" /> Yeniden dene
                    </button>
                  )}
                </div>
              ) : reports.length ? (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" role="list" aria-label="Son DNA raporları">
                  {reports.map((report, index) => (
                    <div key={report.id} role="listitem">
                      <button
                        ref={index === 0 ? firstReportButtonRef : undefined}
                        type="button"
                        onClick={() => void chooseReport(report.id)}
                        disabled={reportSelectionBlocked}
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-3 py-2 text-left transition hover:border-blue-200 hover:bg-[var(--sm-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-black text-[var(--sm-text)]">
                            {report.clientCode || "Danışan kodu yok"}
                            {index === 0 ? <span className="ml-2 text-[10px] uppercase tracking-wide text-blue-700">En yeni</span> : null}
                          </span>
                          <span className="mt-1 block text-[11px] font-semibold text-[var(--sm-text-muted)]">
                            {formatDate(report.createdAt)} · {report.ageBand || "Yaş bandı yok"} · Sürüm {report.version ?? "—"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-black text-blue-700">Seç</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div role="status" className="mt-3 rounded-2xl bg-[var(--sm-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
                  Bu hesapta tartışılabilecek aktif DNA raporu bulunmuyor.
                </div>
              )}
                  </section>
                ) : null}

                {sending ? (
                  <div className="flex items-center gap-3 text-sm font-semibold text-[var(--sm-text-muted)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-[var(--sm-surface)] text-blue-700 shadow-sm">
                      <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />
                    </span>
                    DNA Intelligence düşünüyor
                  </div>
                ) : null}
                <div ref={messageEndRef} />
              </div>
            </div>

            <footer
              ref={composerFooterRef}
              className={[
                "z-20 bg-[var(--sm-app-bg)]/95 px-1 pb-2 pt-3 backdrop-blur-xl sm:px-4",
                isAppSurface
                  ? "fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] mx-auto max-w-[406px] rounded-t-[24px] md:inset-x-8 md:max-w-[760px] lg:sticky lg:inset-x-auto lg:bottom-[88px] lg:max-w-none lg:rounded-none"
                  : "sticky bottom-0",
              ].join(" ")}
            >
              <div className="mx-auto max-w-[860px]">{renderComposer(false)}</div>
            </footer>
          </>
        )}
      </section>
    </div>
  )
}

function AssistantAnswer({ answer }: { answer: DnaAnswer }) {
  const isSocialConversation = answer.topic?.startsWith("conversation.") === true

  if (isSocialConversation) {
    return (
      <article className="w-full" aria-label="DNA Intelligence yanıtı">
        <div className="flex items-start gap-3 sm:gap-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-[var(--sm-surface)] text-blue-700 shadow-sm">
            <Sparkles size={17} aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1 pt-1 text-sm font-medium leading-6 text-[var(--sm-text)]">
            {answer.summary}
          </p>
        </div>
      </article>
    )
  }

  if (answer.classification === "not_available") {
    const isReportUnavailable = answer.availabilityScope === "report"
    return (
      <article className="w-full" aria-label="DNA Intelligence yanıtı">
        <div className="flex items-start gap-3 sm:gap-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-[var(--sm-surface)] text-slate-600 shadow-sm">
            {isReportUnavailable
              ? <FileSearch size={17} aria-hidden="true" />
              : <Sparkles size={17} aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-sm font-black leading-6 text-[var(--sm-text)]">
              {isReportUnavailable ? "Seçili raporda bulunamadı" : "Soruyu birlikte netleştirelim"}
            </h3>
            <p className="mt-1 text-sm font-medium leading-6 text-[var(--sm-text-soft)]">
              {answer.summary}
            </p>
            {answer.details[0] ? (
              <p className="mt-2 text-xs font-medium leading-5 text-[var(--sm-text-muted)]">
                {answer.details[0]}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  const visibleAnswerUnits = answer.answerUnits.filter((unit) =>
    unit.kind !== "safety_boundary" || unit.section === "case_non_inference")
  const hasStructuredUnits = visibleAnswerUnits.length > 0
  const boundaryText = [
    answer.summary,
    ...answer.details,
    ...answer.limitations,
    ...answer.answerUnits.map((unit) => unit.text),
    answer.evidenceSummary?.level || "",
    answer.evidenceSummary?.scientificEvidenceLevel || "",
    answer.evidenceSummary?.dnaValidationStatus || "",
    answer.evidenceSummary?.boundary || "",
  ].join(" ").toLocaleLowerCase("tr-TR")
  const answerStatusLabels = [
    answer.evidenceSummary?.dnaValidationStatus === "theory_only"
      || /(?:tartışmalı|tartismali|kuramsal|theory_only|polyvagal)/i.test(boundaryText)
      ? "Tartışmalı teori"
      : "",
    /(?:kanıt yetersiz|kanit yetersiz|very_low|very low|çok düşük|cok dusuk|sınırlı kanıt|sinirli kanit)/i.test(boundaryText)
      ? "Kanıt yetersiz"
      : "",
    answer.evidenceSummary?.dnaValidationStatus === "not_established"
      || /(?:ilişki kurulmamıştır|iliski kurulmamistir|ilişki kaydı bulunmuyor|iliski kaydi bulunmuyor|not_established)/i.test(boundaryText)
      ? "Bu ilişki kurulmamıştır"
      : "",
  ].filter(Boolean)

  return (
    <article className="w-full">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-[var(--sm-surface)] text-blue-700 shadow-sm">
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {answerStatusLabels.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Kanıt ve ilişki uyarıları">
              {answerStatusLabels.map((label) => (
                <li key={label} className="inline-flex min-h-7 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[10px] font-black text-amber-900">
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
          {hasStructuredUnits ? (
            <div className={answerStatusLabels.length ? "mt-3 space-y-3" : "space-y-3"} aria-label="DNA Intelligence yanıtı">
              {visibleAnswerUnits.map((unit, index) => {
                const sectionHeading = answer.runtimeGeneration === "v3"
                  && unit.section
                  && visibleAnswerUnits[index - 1]?.section !== unit.section
                    ? V3_ANSWER_SECTION_LABEL[unit.section]
                    : null
                return (
                  <div
                    key={unit.id}
                    className={sectionHeading ? "pt-1" : ""}
                  >
                  {sectionHeading ? (
                    <h3 className="mb-1 text-xs font-black tracking-[-0.01em] text-[var(--sm-text)]">
                      {sectionHeading}
                    </h3>
                  ) : null}
                  <p className={`text-sm leading-6 text-[var(--sm-text)] ${unit.kind === "summary" ? "font-semibold" : "font-medium"}`}>
                    {unit.text}
                  </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <>
              <p className="text-sm font-bold leading-6 text-[var(--sm-text)]">{answer.summary}</p>
              {answer.details.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-medium leading-6 text-[var(--sm-text-soft)] marker:text-blue-500">
                  {answer.details.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
              ) : null}
            </>
          )}

      {!hasStructuredUnits && answer.caseEvidence.length ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-[var(--sm-surface-soft)] p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-cyan-700">Rapordaki dayanak</div>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs font-semibold leading-5 text-[var(--sm-text-soft)]">
            {answer.caseEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {answer.limitedRolloutFeedbackEligible ? (
          <DnaLimitedRolloutFeedback requestId={answer.requestId} />
        ) : null}
        <DnaIssueFeedback scope="answer" requestId={answer.requestId} />
      </div>
        </div>
      </div>
    </article>
  )
}
