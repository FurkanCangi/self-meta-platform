"use client"

import {
  ArrowUp,
  ChevronDown,
  CircleAlert,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAppSurface } from "@/app/components/app-shell/useAppSurface"
import {
  DNA_INTELLIGENCE_AUDIT_NOTICE_TR,
  DNA_INTELLIGENCE_COMPOSER_NOTICE_TR,
  DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
  DNA_INTELLIGENCE_REPORT_OWNERSHIP_NOTICE_TR,
  DNA_INTELLIGENCE_TAGLINE_TR,
  type DnaIntelligencePublicIntendedUse,
} from "@/lib/dna/chat/intendedUse"
import { DNA_CHAT_STARTER_QUESTIONS } from "@/lib/dna/chat/suggestions"

type DnaChatClassification =
  | "dna_concept"
  | "literature"
  | "case_finding"
  | "hypothesis"
  | "clarification"
  | "not_available"
  | "refusal"

type ReportOption = {
  id: string
  clientCode: string
  createdAt: string | null
  version: number | null
  ageBand: string | null
}

type SourceRef = {
  id: string
  type?: string
  title?: string
  labelTr?: string
  excerpt?: string
  excerptTr?: string
  citation?: string
  publicationYear?: number
  year?: number
  doi?: string | null
  url?: string
  claimBoundary?: string
  ageScope?: string
  studyType?: string
  sampleScope?: string
}

type ContextRequest = {
  type: "report"
  preferNewest: boolean
}

type EvidenceSummary = {
  level: string
  ageScope: string
  sampleScope: string
  boundary: string
}

type DnaAnswer = {
  classification: DnaChatClassification
  summary: string
  details: string[]
  sources: SourceRef[]
  caseEvidence: string[]
  limitations: string[]
  safetyBoundary: string
  intendedUse: DnaIntelligencePublicIntendedUse
  suggestedQuestions: string[]
  engineVersion: string
  topic: string | null
  contextRequest?: ContextRequest
  evidenceSummary?: EvidenceSummary
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: DnaAnswer }

const STARTER_QUESTIONS = [
  DNA_CHAT_STARTER_QUESTIONS.theory[0],
  DNA_CHAT_STARTER_QUESTIONS.dna[0],
  DNA_CHAT_STARTER_QUESTIONS.theory[1],
  DNA_CHAT_STARTER_QUESTIONS.dna[1],
  DNA_CHAT_STARTER_QUESTIONS.case[0],
  DNA_CHAT_STARTER_QUESTIONS.case[1],
].filter((question): question is string => Boolean(question))

const CLASSIFICATION_META: Record<DnaChatClassification, { label: string; className: string }> = {
  dna_concept: { label: "DNA Kavramı", className: "border-blue-200 bg-blue-50 text-blue-700" },
  literature: { label: "Literatür", className: "border-violet-200 bg-violet-50 text-violet-700" },
  case_finding: { label: "Rapor Bulgusu", className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  hypothesis: { label: "Hipotez", className: "border-amber-200 bg-amber-50 text-amber-800" },
  clarification: { label: "Açıklama Gerekli", className: "border-slate-200 bg-slate-50 text-slate-700" },
  not_available: { label: "Bilgi Bulunamadı", className: "border-slate-200 bg-slate-50 text-slate-700" },
  refusal: { label: "Kapsam Dışı", className: "border-rose-200 bg-rose-50 text-rose-700" },
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: "Soru biçimi doğrulanamadı. Lütfen daha kısa ve açık biçimde yeniden yazın.",
  mode_report_mismatch: "Rapor sorusu için bir rapor seçilmelidir.",
  unauthorized: "Oturum doğrulanamadı. Yeniden giriş yapmanız gerekiyor.",
  session_expired: "Uygulama oturumunuz sona erdi. Yeniden giriş yapın.",
  report_not_found: "Rapor bulunamadı veya bu hesap için erişilebilir değil.",
  payload_too_large: "Soru izin verilen boyutu aşıyor.",
  too_many_requests: "Çok hızlı soru gönderildi. Kısa bir süre bekleyip yeniden deneyin.",
  audit_unavailable: "Vaka erişimi güvenli biçimde kaydedilemediği için cevap gösterilmedi.",
  dna_chat_failed: "DNA Asistanı şu anda yanıt veremiyor. Biraz sonra yeniden deneyin.",
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

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : []
}

function normalizeAnswer(value: unknown): DnaAnswer | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const classification = String(row.classification || "") as DnaChatClassification
  if (!(classification in CLASSIFICATION_META)) return null

  const rawContextRequest = row.contextRequest
  const contextRequest =
    rawContextRequest &&
    typeof rawContextRequest === "object" &&
    (rawContextRequest as Record<string, unknown>).type === "report"
      ? {
          type: "report" as const,
          preferNewest: (rawContextRequest as Record<string, unknown>).preferNewest !== false,
        }
      : undefined
  const rawEvidenceSummary = row.evidenceSummary
  const evidenceSummary =
    rawEvidenceSummary && typeof rawEvidenceSummary === "object"
      ? {
          level: String((rawEvidenceSummary as Record<string, unknown>).level || "").trim(),
          ageScope: String((rawEvidenceSummary as Record<string, unknown>).ageScope || "").trim(),
          sampleScope: String((rawEvidenceSummary as Record<string, unknown>).sampleScope || "").trim(),
          boundary: String((rawEvidenceSummary as Record<string, unknown>).boundary || "").trim(),
        }
      : undefined

  return {
    classification,
    summary: String(row.summary || "Yanıt oluşturuldu.").trim(),
    details: normalizeStringList(row.details),
    sources: Array.isArray(row.sources) ? (row.sources as SourceRef[]) : [],
    caseEvidence: normalizeStringList(row.caseEvidence),
    limitations: normalizeStringList(row.limitations),
    safetyBoundary: String(row.safetyBoundary || "").trim(),
    intendedUse:
      row.intendedUse && typeof row.intendedUse === "object"
        ? (row.intendedUse as DnaIntelligencePublicIntendedUse)
        : DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    suggestedQuestions: normalizeStringList(row.suggestedQuestions),
    engineVersion: String(row.engineVersion || "dna-chat-engine@2").trim(),
    topic: typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : null,
    ...(contextRequest ? { contextRequest } : {}),
    ...(evidenceSummary && Object.values(evidenceSummary).some(Boolean) ? { evidenceSummary } : {}),
  }
}

function sourceTitle(source: SourceRef) {
  return source.title || source.labelTr || source.citation || source.id
}

export default function DnaAssistantClient({ initialReportId }: { initialReportId: string }) {
  const isAppSurface = useAppSurface(false)
  const [reports, setReports] = useState<ReportOption[]>([])
  const [selectedReportId, setSelectedReportId] = useState("")
  const [reportPickerOpen, setReportPickerOpen] = useState(false)
  const [pendingReportQuestion, setPendingReportQuestion] = useState<string | null>(null)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState("")
  const [reportsErrorCode, setReportsErrorCode] = useState("")
  const [reportSelectionNotice, setReportSelectionNotice] = useState("")
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [previousTopic, setPreviousTopic] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [sendErrorCode, setSendErrorCode] = useState("")
  const messageEndRef = useRef<HTMLDivElement>(null)
  const questionInputRef = useRef<HTMLTextAreaElement>(null)
  const reportPickerRef = useRef<HTMLElement>(null)
  const firstReportButtonRef = useRef<HTMLButtonElement>(null)
  const reportPickerFocusPendingRef = useRef(false)
  const requestSequenceRef = useRef(0)
  const activeRequestRef = useRef<AbortController | null>(null)

  const selectedReport = reports.find((report) => report.id === selectedReportId) || null

  const loadReports = useCallback(async (signal?: AbortSignal, linkedReportId = "") => {
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
      if ((error as Error)?.name === "AbortError") return null
      const code = error instanceof Error ? error.message : "dna_chat_failed"
      setReportsErrorCode(code)
      setReportsError(ERROR_MESSAGES[code] || ERROR_MESSAGES.dna_chat_failed)
      return null
    } finally {
      setReportsLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    if (initialReportId) void loadReports(controller.signal, initialReportId)
    return () => {
      controller.abort()
      requestSequenceRef.current += 1
      activeRequestRef.current?.abort()
      activeRequestRef.current = null
    }
  }, [initialReportId, loadReports])

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    messageEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    })
  }, [messages, sending, reportPickerOpen])

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
    requestSequenceRef.current += 1
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setSending(false)
  }

  function clearConversation() {
    cancelPendingResponse()
    setMessages([])
    setPreviousTopic(null)
    setPendingReportQuestion(null)
    setQuestion("")
    setSendError("")
    setSendErrorCode("")
  }

  function removeReportContext() {
    clearConversation()
    setSelectedReportId("")
    setReportPickerOpen(false)
    setReportSelectionNotice("")
    moveQuestionFocus()
  }

  function changeReportContext() {
    clearConversation()
    setSelectedReportId("")
    reportPickerFocusPendingRef.current = true
    setReportPickerOpen(true)
    setReportSelectionNotice("")
    void loadReports()
  }

  async function sendQuestion(
    cleanQuestion: string,
    options: { reportId?: string; appendUser?: boolean; previousTopic?: string | null } = {},
  ) {
    if (sending || cleanQuestion.length < 2) return

    setSending(true)
    setSendError("")
    setSendErrorCode("")
    setQuestion("")
    if (options.appendUser !== false) {
      setMessages((current) => [...current, { id: messageId("user"), role: "user", text: cleanQuestion }])
    }

    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    const controller = new AbortController()
    activeRequestRef.current?.abort()
    activeRequestRef.current = controller
    const requestReportId = options.reportId ?? selectedReportId
    const requestPreviousTopic = options.previousTopic === undefined ? previousTopic : options.previousTopic

    try {
      const response = await fetch("/api/app/dna-chat", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        signal: controller.signal,
        body: JSON.stringify({
          question: cleanQuestion,
          ...(requestReportId ? { reportId: requestReportId } : {}),
          ...(requestPreviousTopic ? { context: { previousTopic: requestPreviousTopic } } : {}),
        }),
      })
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
      if (!response.ok || !payload?.ok) throw new Error(String(payload?.error || "dna_chat_failed"))
      const answer = normalizeAnswer(payload)
      if (!answer) throw new Error("dna_chat_failed")
      if (requestSequenceRef.current !== requestId) return

      setMessages((current) => [...current, { id: messageId("assistant"), role: "assistant", answer }])
      setPreviousTopic(answer.topic)
      if (answer.contextRequest?.type === "report" && !requestReportId) {
        setPendingReportQuestion(cleanQuestion)
        reportPickerFocusPendingRef.current = true
        setReportPickerOpen(true)
        await loadReports(controller.signal)
      }
    } catch (error) {
      if ((error as Error)?.name === "AbortError" || requestSequenceRef.current !== requestId) return
      const code = error instanceof Error ? error.message : "dna_chat_failed"
      setSendErrorCode(code)
      setSendError(ERROR_MESSAGES[code] || ERROR_MESSAGES.dna_chat_failed)
    } finally {
      if (requestSequenceRef.current === requestId) {
        activeRequestRef.current = null
        setSending(false)
        if (!reportPickerFocusPendingRef.current) moveQuestionFocus()
      }
    }
  }

  async function chooseReport(reportId: string) {
    const waitingQuestion = pendingReportQuestion
    clearConversation()
    setSelectedReportId(reportId)
    reportPickerFocusPendingRef.current = false
    setReportPickerOpen(false)
    setReportSelectionNotice("")
    if (waitingQuestion) {
      await sendQuestion(waitingQuestion, { reportId, previousTopic: null })
    } else {
      moveQuestionFocus()
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
    void sendQuestion(cleanQuestion)
  }

  const hasConversation = messages.length > 0 || reportPickerOpen || sending

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
          <div role="alert" className="mb-3 rounded-2xl border border-rose-200 bg-[var(--sm-surface)] px-4 py-3 text-xs font-bold leading-5 text-[var(--sm-text)] shadow-sm">
            {sendError}
            {sendErrorCode === "unauthorized" || sendErrorCode === "session_expired" ? (
              <Link href="/app-login" className="ml-2 inline-flex min-h-11 items-center font-black text-blue-700 underline-offset-4 hover:underline">
                Yeniden giriş yap
              </Link>
            ) : null}
          </div>
        ) : null}

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
              placeholder={selectedReport ? "Bu raporun güvenli bulgularını veya genel bilgiyi sorun…" : "DNA Asistanına sorun…"}
              className={[
                "max-h-40 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 text-sm font-semibold leading-6 text-[var(--sm-text)] outline-none placeholder:font-medium placeholder:text-[var(--sm-text-muted)] disabled:opacity-60 sm:text-[15px]",
                "min-h-[48px] py-3",
              ].join(" ")}
            />
            <div className="flex shrink-0 items-center gap-2 pb-0.5">
              {question.length > 500 ? (
                <span className="hidden text-[10px] font-bold text-[var(--sm-text-muted)] sm:inline">{question.length}/600</span>
              ) : null}
              <button
                type="submit"
                disabled={sending || question.trim().length < 2}
                aria-label="Soruyu gönder"
                className="grid min-h-12 min-w-12 place-items-center rounded-full border border-blue-600 bg-blue-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_16px_30px_rgba(37,99,235,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:shadow-none disabled:hover:translate-y-0"
              >
                {sending ? <LoaderCircle className="animate-spin" size={19} aria-hidden="true" /> : <ArrowUp size={20} strokeWidth={2.6} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col items-center justify-center gap-1.5 px-2 text-center text-[10px] font-semibold leading-4 text-[var(--sm-text-muted)] sm:flex-row sm:gap-3 sm:text-[11px]">
          <span className="hidden sm:inline">Enter gönderir · Shift + Enter yeni satır</span>
          <span className="inline-flex items-center justify-center gap-1.5">
            <CircleAlert className="shrink-0 text-blue-600" size={13} aria-hidden="true" />
            {DNA_INTELLIGENCE_COMPOSER_NOTICE_TR}
          </span>
        </div>
        <details className="group mx-auto mt-2 max-w-3xl text-left text-[10px] font-semibold leading-4 text-[var(--sm-text-muted)] sm:text-[11px]">
          <summary className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Kullanım ve veri sınırları
            <ChevronDown className="transition group-open:rotate-180" size={14} aria-hidden="true" />
          </summary>
          <div className="mt-1 space-y-2 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] p-3">
            <p>{DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.boundaryTr}</p>
            <p>{DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.privacyTr}</p>
            <p>{DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.evidenceTr}</p>
            <p>{DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.runtimeTr}</p>
          </div>
        </details>
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
              <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--sm-text-muted)]">{DNA_INTELLIGENCE_TAGLINE_TR}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:justify-end">
            <div className="hidden min-h-10 items-center gap-2 rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface)] px-3 text-[11px] font-bold text-[var(--sm-text-muted)] shadow-sm md:flex">
              <ShieldCheck size={16} className="text-blue-600" aria-hidden="true" />
              <span title={DNA_INTELLIGENCE_AUDIT_NOTICE_TR}>Sohbet geçmişi tutulmaz · Sınırlı audit</span>
            </div>

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
                  className="min-h-11 rounded-full px-2 font-black text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Değiştir
                </button>
                <button
                  type="button"
                  onClick={removeReportContext}
                  aria-label="Rapor bağlamını kaldır ve yeni sohbet başlat"
                  className="grid min-h-11 min-w-11 place-items-center rounded-full text-slate-500 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                Bugün neyi birlikte inceleyelim?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--sm-text-muted)] sm:text-[15px]">
                {DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.descriptionTr}
              </p>

              <div className="mx-auto mt-8 max-w-[840px] text-left">{renderComposer(true)}</div>

              <div className="mx-auto mt-6 grid max-w-[760px] gap-2 sm:grid-cols-2">
                {STARTER_QUESTIONS.slice(0, 4).map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => moveQuestionFocus(suggestion)}
                    className={[
                      "min-h-12 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] px-4 py-2.5 text-left text-xs font-bold leading-5 text-[var(--sm-text-soft)] shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      index > 1 ? "hidden sm:block" : "",
                    ].join(" ")}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className={[
                "flex-1 px-1 py-6 sm:px-4 sm:py-8",
                isAppSurface ? "pb-40" : "",
              ].join(" ")}
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
                    <AssistantAnswer key={message.id} answer={message.answer} onSuggestion={moveQuestionFocus} />
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
                        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-3 py-2 text-left transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
                    Kaynak kontrollü yanıt hazırlanıyor
                  </div>
                ) : null}
                <div ref={messageEndRef} />
              </div>
            </div>

            <footer
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

function AssistantAnswer({ answer, onSuggestion }: { answer: DnaAnswer; onSuggestion: (value: string) => void }) {
  const baseMeta = CLASSIFICATION_META[answer.classification]
  const reportScopedNotAvailable =
    answer.classification === "not_available" &&
    (answer.caseEvidence.length > 0 || answer.limitations.some((item) => /\b(?:rapor|vaka)\b/i.test(item)))
  const meta = reportScopedNotAvailable ? { ...baseMeta, label: "Raporda Yok" } : baseMeta

  return (
    <article className="w-full">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-[var(--sm-surface)] text-blue-700 shadow-sm">
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-black uppercase tracking-[0.08em] ${meta.className}`}>
              {meta.label}
            </span>
            <span className="text-[10px] font-bold text-[var(--sm-text-muted)]">{answer.engineVersion}</span>
          </div>
          <p className="mt-3 text-sm font-bold leading-6 text-[var(--sm-text)]">{answer.summary}</p>

      {answer.details.length ? (
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm font-medium leading-6 text-[var(--sm-text-soft)] marker:text-blue-500">
          {answer.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}

      {answer.evidenceSummary ? (
        <div className="mt-4 grid gap-2 rounded-2xl border border-violet-200 bg-[var(--sm-surface-soft)] p-3 text-xs leading-5 sm:grid-cols-2">
          {answer.evidenceSummary.level ? (
            <div><span className="font-black text-[var(--sm-text)]">Kanıt düzeyi:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.level}</span></div>
          ) : null}
          {answer.evidenceSummary.ageScope ? (
            <div><span className="font-black text-[var(--sm-text)]">Yaş kapsamı:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.ageScope}</span></div>
          ) : null}
          {answer.evidenceSummary.sampleScope ? (
            <div className="sm:col-span-2"><span className="font-black text-[var(--sm-text)]">Örneklem sınırı:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.sampleScope}</span></div>
          ) : null}
          {answer.evidenceSummary.boundary ? (
            <div className="sm:col-span-2"><span className="font-black text-[var(--sm-text)]">İddia sınırı:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.boundary}</span></div>
          ) : null}
        </div>
      ) : null}

      {answer.caseEvidence.length ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-[var(--sm-surface-soft)] p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-cyan-700">Rapordaki dayanak</div>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs font-semibold leading-5 text-[var(--sm-text-soft)]">
            {answer.caseEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
          </ul>
        </div>
      ) : null}

      {answer.sources.length ? (
        <details className="group mt-4 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-black text-[var(--sm-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            Kaynaklar ({answer.sources.length})
            <ChevronDown className="transition group-open:rotate-180" size={17} aria-hidden="true" />
          </summary>
          <div className="space-y-2 border-t border-[var(--sm-border)] p-3">
            {answer.sources.map((source) => (
              <div key={source.id} className="rounded-xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-3">
                <div className="text-xs font-black leading-5 text-[var(--sm-text)]">{sourceTitle(source)}</div>
                {source.publicationYear || source.year || source.doi ? (
                  <div className="mt-1 text-[11px] font-bold text-[var(--sm-text-muted)]">
                    {[source.publicationYear || source.year, source.doi ? `DOI: ${source.doi}` : ""].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
                {source.excerptTr || source.excerpt ? (
                  <p className="mt-2 text-xs font-medium leading-5 text-[var(--sm-text-soft)]">{source.excerptTr || source.excerpt}</p>
                ) : null}
                {source.claimBoundary ? (
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[var(--sm-text-muted)]"><strong>İddia sınırı:</strong> {source.claimBoundary}</p>
                ) : null}
                {source.ageScope || source.studyType ? (
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[var(--sm-text-muted)]">
                    <strong>Çalışma kapsamı:</strong> {[source.ageScope, source.studyType].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {source.sampleScope ? (
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[var(--sm-text-muted)]"><strong>Örneklem sınırı:</strong> {source.sampleScope}</p>
                ) : null}
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-xs font-black text-blue-700 underline-offset-4 hover:underline">
                    Kaynağı aç
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {answer.limitations.length ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-[var(--sm-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--sm-text-soft)]">
          <div className="font-black">Sınırlılıklar</div>
          {answer.limitations.map((limitation) => <p key={limitation} className="mt-1">{limitation}</p>)}
        </div>
      ) : null}

      {answer.safetyBoundary ? (
        <div className="mt-3 flex items-start gap-2 text-[11px] font-semibold leading-5 text-[var(--sm-text-muted)]">
          <ShieldCheck className="mt-0.5 shrink-0 text-blue-600" size={15} aria-hidden="true" />
          <span>{answer.safetyBoundary}</span>
        </div>
      ) : null}

      {answer.suggestedQuestions.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {answer.suggestedQuestions.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="min-h-11 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-left text-[11px] font-black leading-4 text-blue-700 transition hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
        </div>
      </div>
    </article>
  )
}
