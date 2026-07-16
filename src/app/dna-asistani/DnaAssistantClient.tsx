"use client"

import {
  ChevronDown,
  CircleAlert,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAppSurface } from "@/app/components/app-shell/useAppSurface"
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
}

type ContextRequest = {
  type: "report"
  preferNewest: boolean
}

type EvidenceSummary = {
  level: string
  ageScope: string
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

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-2">
      <header className="relative mb-4 overflow-hidden rounded-[28px] border border-cyan-100/80 bg-[var(--sm-surface)] p-5 shadow-[0_20px_54px_rgba(37,99,235,0.10)] md:mb-5 md:p-7">
        <div className="pointer-events-none absolute -left-12 -top-20 h-52 w-52 rounded-full bg-cyan-100/45 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-violet-100/45 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-3 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
              <Sparkles size={15} aria-hidden="true" /> Kaynak kontrollü klinik bilgi alanı
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#071b3a] md:text-4xl">DNA Asistanı</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600 md:text-[15px]">
              Teori, DNA kavramları ve kendi raporlarınız hakkındaki soruları tek alanda yanıtlar; gerekli bağlamı kendisi belirler.
            </p>
          </div>
          <div className="flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-4 text-sm font-bold text-[var(--sm-text-soft)]">
            <ShieldCheck size={20} aria-hidden="true" /> Mesajlar kaydedilmez
          </div>
        </div>
      </header>

      <section className="dna-card min-w-0 overflow-visible" aria-label="DNA Asistanı sohbeti">
        <div className="border-b border-[var(--sm-border)] px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.22)]">
                <Sparkles size={21} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-black text-[var(--sm-text)]">Nasıl yardımcı olabilirim?</h2>
                <p className="mt-0.5 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
                  Genel bilgi ile rapor bağlamını otomatik olarak ayırırım.
                </p>
              </div>
            </div>

            {selectedReport ? (
              <div role="status" className="flex min-h-12 items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 text-xs font-bold text-cyan-900">
                <FileSearch size={17} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate font-black">{selectedReport.clientCode || "Danışan kodu yok"}</span>
                  <span className="block text-[10px] text-cyan-700">{formatDate(selectedReport.createdAt)}</span>
                </span>
                <button
                  type="button"
                  onClick={changeReportContext}
                  className="min-h-11 rounded-xl px-2 font-black text-blue-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Değiştir
                </button>
                <button
                  type="button"
                  onClick={removeReportContext}
                  aria-label="Rapor bağlamını kaldır ve yeni sohbet başlat"
                  className="grid min-h-11 min-w-11 place-items-center rounded-xl text-slate-500 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            ) : reportsLoading && initialReportId && !reportPickerOpen ? (
              <div role="status" className="flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--sm-surface-soft)] px-3 text-xs font-bold text-[var(--sm-text-muted)]">
                <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> Rapor bağlantısı doğrulanıyor
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={[
            "min-h-[440px] space-y-4 bg-[var(--sm-surface-soft)]/60 px-3 py-4 md:min-h-[560px] md:px-6 md:py-6",
            isAppSurface ? "pb-40" : "",
          ].join(" ")}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {messages.length === 0 && !reportPickerOpen ? (
            <div className="mx-auto max-w-3xl rounded-[24px] border border-blue-100 bg-[var(--sm-surface)] p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-black text-blue-700">
                <Sparkles size={18} aria-hidden="true" /> Örnek sorular
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-[var(--sm-text-soft)]">
                Nörofizyoloji, self-regülasyon, DNA değerlendirme yaklaşımı veya bir raporunuz hakkında doğal biçimde sorabilirsiniz.
              </p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {STARTER_QUESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => moveQuestionFocus(suggestion)}
                    className="min-h-11 rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-3 py-2 text-left text-xs font-bold leading-5 text-[var(--sm-text-soft)] transition hover:border-blue-200 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="ml-auto max-w-[88%] rounded-[22px] rounded-br-md bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-3 text-sm font-semibold leading-6 text-white shadow-[0_12px_24px_rgba(37,99,235,0.18)] md:max-w-[72%]">
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
              className="max-w-3xl rounded-[24px] rounded-bl-md border border-cyan-200 bg-[var(--sm-surface)] p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:p-5"
              aria-labelledby="dna-report-picker-title"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <FileSearch size={19} aria-hidden="true" />
                </span>
                <div>
                  <h3 id="dna-report-picker-title" className="text-sm font-black text-[var(--sm-text)]">Hangi raporla devam edelim?</h3>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
                    Yalnız hesabınıza ait son 10 aktif DNA raporu gösterilir. Rapor içeriği seçimden önce açılmaz.
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
            <div className="flex max-w-[84%] items-center gap-3 rounded-[22px] rounded-bl-md border border-[var(--sm-border)] bg-[var(--sm-surface)] px-4 py-3 text-sm font-semibold text-[var(--sm-text-muted)]">
              <LoaderCircle className="animate-spin text-blue-600" size={18} aria-hidden="true" /> Kaynak kontrollü yanıt hazırlanıyor
            </div>
          ) : null}
          <div ref={messageEndRef} />
        </div>

        <form
          onSubmit={submitQuestion}
          className={[
            "z-20 border-t border-[var(--sm-border)] bg-[var(--sm-surface)]/96 p-3 shadow-[0_-16px_36px_rgba(7,27,58,0.08)] backdrop-blur-xl md:p-4",
            isAppSurface
              ? "fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] mx-auto max-w-[406px] rounded-t-[22px] md:inset-x-8 md:max-w-[704px] lg:sticky lg:inset-x-auto lg:bottom-[88px] lg:mx-0 lg:max-w-none lg:rounded-none"
              : "sticky bottom-2",
          ].join(" ")}
        >
          {sendError ? (
            <div role="alert" className="mb-2 rounded-2xl border border-rose-200 bg-[var(--sm-surface-soft)] px-3 py-2 text-xs font-bold leading-5 text-[var(--sm-text)]">
              {sendError}
              {sendErrorCode === "unauthorized" || sendErrorCode === "session_expired" ? (
                <Link href="/app-login" className="ml-2 inline-flex min-h-11 items-center font-black text-blue-700 underline-offset-4 hover:underline">
                  Yeniden giriş yap
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
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
              rows={2}
              maxLength={600}
              disabled={sending}
              placeholder={selectedReport ? "Raporla veya genel bilgiyle ilgili sorun…" : "Teori, DNA veya raporlarınız hakkında sorun…"}
              className="min-h-[52px] max-h-40 min-w-0 flex-1 resize-y rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--sm-text)] outline-none placeholder:text-[var(--sm-text-muted)] focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || question.trim().length < 2}
              aria-label="Soruyu gönder"
              className="dna-btn grid min-h-[52px] min-w-[52px] shrink-0 place-items-center disabled:cursor-not-allowed disabled:opacity-45"
            >
              {sending ? <LoaderCircle className="animate-spin" size={19} aria-hidden="true" /> : <Send size={19} aria-hidden="true" />}
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-2 px-1 text-[10px] font-bold text-[var(--sm-text-muted)] sm:flex-row sm:items-center sm:justify-between">
            <span>Enter gönderir · Shift + Enter yeni satır</span>
            <span>{question.length}/600</span>
          </div>
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-[var(--sm-surface-soft)] px-3 py-2 text-[10px] font-semibold leading-4 text-[var(--sm-text-muted)]">
            <CircleAlert className="mt-0.5 shrink-0 text-blue-600" size={14} aria-hidden="true" />
            <span>Ad, T.C. kimlik, telefon veya adres yazmayın. Tanı, ilaç ve tedavi planı kapsam dışıdır.</span>
          </div>
        </form>
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
    <article className="max-w-[94%] rounded-[24px] rounded-bl-md border border-[var(--sm-border)] bg-[var(--sm-surface)] p-4 shadow-sm md:max-w-[84%] md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-black uppercase tracking-[0.08em] ${meta.className}`}>
          {meta.label}
        </span>
        <span className="text-[10px] font-bold text-[var(--sm-text-muted)]">{answer.engineVersion}</span>
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-[var(--sm-text)]">{answer.summary}</p>

      {answer.details.length ? (
        <ul className="mt-3 space-y-2 text-sm font-medium leading-6 text-[var(--sm-text-soft)]">
          {answer.details.map((detail) => (
            <li key={detail} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span>{detail}</span>
            </li>
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
          {answer.evidenceSummary.boundary ? (
            <div className="sm:col-span-2"><span className="font-black text-[var(--sm-text)]">İddia sınırı:</span> <span className="font-semibold text-[var(--sm-text-soft)]">{answer.evidenceSummary.boundary}</span></div>
          ) : null}
        </div>
      ) : null}

      {answer.caseEvidence.length ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-[var(--sm-surface-soft)] p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-cyan-700">Rapordaki dayanak</div>
          <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-[var(--sm-text-soft)]">
            {answer.caseEvidence.map((evidence) => <li key={evidence}>• {evidence}</li>)}
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
    </article>
  )
}
