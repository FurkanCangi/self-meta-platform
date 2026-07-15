"use client"

import {
  BookOpen,
  BrainCircuit,
  ChevronDown,
  CircleAlert,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAppSurface } from "@/app/components/app-shell/useAppSurface"
import { DNA_CHAT_STARTER_QUESTIONS } from "@/lib/dna/chat/suggestions"

type DnaChatMode = "theory" | "dna" | "case"
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
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; answer: DnaAnswer }

const MODES: Array<{
  id: DnaChatMode
  label: string
  mobileLabel: string
  short: string
  description: string
  icon: typeof BookOpen
  suggestions: string[]
}> = [
  {
    id: "theory",
    label: "Teori",
    mobileLabel: "Teori",
    short: "Temel çerçeve",
    description: "Nörofizyoloji, uyarılma, toparlanma ve gelişimsel self-regülasyon.",
    icon: BookOpen,
    suggestions: [...DNA_CHAT_STARTER_QUESTIONS.theory],
  },
  {
    id: "dna",
    label: "DNA Bilgisi",
    mobileLabel: "DNA",
    short: "Kavram ve yöntem",
    description: "Altı alan, kanıt hiyerarşisi, güven düzeyi ve raporun sınırları.",
    icon: BrainCircuit,
    suggestions: [...DNA_CHAT_STARTER_QUESTIONS.dna],
  },
  {
    id: "case",
    label: "Vaka Raporu",
    mobileLabel: "Vaka",
    short: "Raporla tartış",
    description: "Seçili rapordaki güvenli bulguları, karşı kanıtı ve sınırlılıkları incele.",
    icon: FileSearch,
    suggestions: [...DNA_CHAT_STARTER_QUESTIONS.case],
  },
]

const CLASSIFICATION_META: Record<DnaChatClassification, { label: string; className: string }> = {
  dna_concept: { label: "DNA Kavramı", className: "border-blue-200 bg-blue-50 text-blue-700" },
  literature: { label: "Literatür", className: "border-violet-200 bg-violet-50 text-violet-700" },
  case_finding: { label: "Rapor Bulgusu", className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  hypothesis: { label: "Hipotez", className: "border-amber-200 bg-amber-50 text-amber-800" },
  clarification: { label: "Açıklama Gerekli", className: "border-slate-200 bg-slate-50 text-slate-700" },
  not_available: { label: "Raporda Yok", className: "border-slate-200 bg-slate-50 text-slate-700" },
  refusal: { label: "Kapsam Dışı", className: "border-rose-200 bg-rose-50 text-rose-700" },
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: "Soru biçimi doğrulanamadı. Lütfen daha kısa ve açık biçimde yeniden yazın.",
  mode_report_mismatch: "Vaka modunda bir rapor seçilmelidir.",
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

  return {
    classification,
    summary: String(row.summary || "Yanıt oluşturuldu.").trim(),
    details: normalizeStringList(row.details),
    sources: Array.isArray(row.sources) ? (row.sources as SourceRef[]) : [],
    caseEvidence: normalizeStringList(row.caseEvidence),
    limitations: normalizeStringList(row.limitations),
    safetyBoundary: String(row.safetyBoundary || "").trim(),
    suggestedQuestions: normalizeStringList(row.suggestedQuestions),
    engineVersion: String(row.engineVersion || "dna-chat-engine@1").trim(),
    topic: typeof row.topic === "string" && row.topic.trim() ? row.topic.trim() : null,
  }
}

function welcomeForMode(mode: DnaChatMode) {
  if (mode === "case") {
    return "Son DNA raporlarından birini seçin. Yalnız raporda bulunan güvenli bulgular, karşı kanıtlar, korunmuş kapasite ve sınırlılıklar üzerinden ilerlerim."
  }
  if (mode === "theory") {
    return "Self-regülasyonun nörofizyolojik ve gelişimsel çerçevesi hakkında kaynak kontrollü sorular sorabilirsiniz."
  }
  return "DNA'nın altı alanı, değerlendirme yaklaşımı, kanıt düzeyi ve rapor okuma sınırları hakkında sorular sorabilirsiniz."
}

function sourceTitle(source: SourceRef) {
  return source.title || source.labelTr || source.citation || source.id
}

export default function DnaAssistantClient({
  initialMode,
  initialReportId,
}: {
  initialMode: DnaChatMode
  initialReportId: string
}) {
  const isAppSurface = useAppSurface(false)
  const [mode, setMode] = useState<DnaChatMode>(initialMode)
  const [reports, setReports] = useState<ReportOption[]>([])
  const [selectedReportId, setSelectedReportId] = useState("")
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState("")
  const [reportSelectionNotice, setReportSelectionNotice] = useState("")
  const [question, setQuestion] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [previousTopic, setPreviousTopic] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const messageEndRef = useRef<HTMLDivElement>(null)
  const requestSequenceRef = useRef(0)
  const activeRequestRef = useRef<AbortController | null>(null)

  const activeMode = useMemo(() => MODES.find((item) => item.id === mode) || MODES[1], [mode])
  const selectedReport = reports.find((report) => report.id === selectedReportId) || null

  async function loadReports(signal?: AbortSignal) {
    setReportsLoading(true)
    setReportsError("")
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
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "dna_chat_failed")
      }
      const nextReports = Array.isArray(payload.reports) ? payload.reports.slice(0, 10) : []
      setReports(nextReports)
      const linkedReportAvailable = Boolean(
        initialReportId && nextReports.some((report) => report.id === initialReportId),
      )
      setReportSelectionNotice(
        initialReportId && !linkedReportAvailable
          ? "Bağlantıdaki rapor son 10 aktif DNA raporu içinde değil. Tartışmak için listeden bir rapor seçin."
          : "",
      )
      setSelectedReportId((current) => {
        if (current && nextReports.some((report) => report.id === current)) return current
        if (linkedReportAvailable) return initialReportId
        return initialReportId ? "" : nextReports[0]?.id || ""
      })
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return
      const code = error instanceof Error ? error.message : "dna_chat_failed"
      setReportsError(ERROR_MESSAGES[code] || ERROR_MESSAGES.dna_chat_failed)
    } finally {
      setReportsLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadReports(controller.signal)
    return () => {
      controller.abort()
      requestSequenceRef.current += 1
      activeRequestRef.current?.abort()
      activeRequestRef.current = null
    }
  }, [])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, sending])

  function cancelPendingResponse() {
    requestSequenceRef.current += 1
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setSending(false)
  }

  function changeMode(nextMode: DnaChatMode) {
    if (nextMode === mode) return
    cancelPendingResponse()
    setMode(nextMode)
    setMessages([])
    setPreviousTopic(null)
    setQuestion("")
    setSendError("")
  }

  function moveModeFocus(currentMode: DnaChatMode, key: string) {
    const currentIndex = MODES.findIndex((item) => item.id === currentMode)
    let nextIndex = currentIndex
    if (key === "ArrowRight" || key === "ArrowDown") nextIndex = (currentIndex + 1) % MODES.length
    if (key === "ArrowLeft" || key === "ArrowUp") nextIndex = (currentIndex - 1 + MODES.length) % MODES.length
    if (key === "Home") nextIndex = 0
    if (key === "End") nextIndex = MODES.length - 1
    if (nextIndex === currentIndex) return false
    const nextMode = MODES[nextIndex].id
    changeMode(nextMode)
    requestAnimationFrame(() => document.getElementById(`dna-mode-${nextMode}`)?.focus())
    return true
  }

  async function submitQuestion(event?: React.FormEvent) {
    event?.preventDefault()
    const cleanQuestion = question.trim()
    if (sending || cleanQuestion.length < 2) return
    if (mode === "case" && reportsLoading) {
      setSendError("Rapor listesi doğrulanırken bekleyin.")
      return
    }
    if (mode === "case" && !selectedReportId) {
      setSendError("Vaka sorusu için önce bir rapor seçin.")
      return
    }

    setSending(true)
    setSendError("")
    setQuestion("")
    setMessages((current) => [...current, { id: messageId("user"), role: "user", text: cleanQuestion }])

    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    const controller = new AbortController()
    activeRequestRef.current?.abort()
    activeRequestRef.current = controller
    const requestMode = mode
    const requestReportId = selectedReportId
    const requestPreviousTopic = previousTopic

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
          mode: requestMode,
          question: cleanQuestion,
          ...(requestMode === "case" ? { reportId: requestReportId } : {}),
          ...(requestPreviousTopic ? { context: { previousTopic: requestPreviousTopic } } : {}),
        }),
      })
      const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
      if (!response.ok || !payload?.ok) {
        const code = String(payload?.error || "dna_chat_failed")
        throw new Error(code)
      }
      const answer = normalizeAnswer(payload)
      if (!answer) throw new Error("dna_chat_failed")
      if (requestSequenceRef.current !== requestId) return

      setMessages((current) => [...current, { id: messageId("assistant"), role: "assistant", answer }])
      setPreviousTopic(answer.topic)
    } catch (error) {
      if ((error as Error)?.name === "AbortError" || requestSequenceRef.current !== requestId) return
      const code = error instanceof Error ? error.message : "dna_chat_failed"
      setSendError(ERROR_MESSAGES[code] || ERROR_MESSAGES.dna_chat_failed)
    } finally {
      if (requestSequenceRef.current === requestId) {
        activeRequestRef.current = null
        setSending(false)
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] pb-2">
      <header className="relative mb-4 overflow-hidden rounded-[28px] border border-cyan-100/80 bg-[var(--sm-surface)] p-5 shadow-[0_20px_54px_rgba(37,99,235,0.10)] md:mb-5 md:p-7">
        <div className="pointer-events-none absolute -left-12 -top-20 h-52 w-52 rounded-full bg-cyan-100/45 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-violet-100/45 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 text-[11px] font-black uppercase tracking-[0.14em] text-blue-700">
              <Sparkles size={15} aria-hidden="true" /> Deterministik klinik bilgi alanı
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-[#071b3a] md:text-4xl">DNA Asistanı</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600 md:text-[15px]">
              Haricî modele veri göndermez. Onaylı bilgi blokları ve yalnız seçtiğiniz rapordaki güvenli bağlamla çalışır.
            </p>
          </div>
          <div className="flex min-h-12 shrink-0 items-center gap-3 rounded-2xl border border-emerald-200 bg-white/80 px-4 text-sm font-bold text-emerald-800">
            <ShieldCheck size={20} aria-hidden="true" /> Mesajlar kaydedilmez
          </div>
        </div>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="dna-card min-w-0 p-3 lg:sticky lg:top-5" aria-label="DNA Asistanı bağlamı">
          <div className="px-2 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Çalışma modu</div>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1" role="tablist" aria-label="DNA Asistanı modu">
            {MODES.map((item) => {
              const Icon = item.icon
              const active = item.id === mode
              return (
                <button
                  key={item.id}
                  id={`dna-mode-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={item.label}
                  aria-controls="dna-chat-panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => changeMode(item.id)}
                  onKeyDown={(event) => {
                    if (moveModeFocus(item.id, event.key)) event.preventDefault()
                  }}
                  className={[
                    "flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:min-h-[68px] lg:justify-start lg:px-3",
                    active
                      ? "border-blue-200 bg-gradient-to-r from-cyan-50 via-blue-50 to-violet-50 text-[#071b3a] shadow-sm"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <span className={[
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    active ? "bg-white text-blue-700 shadow-sm" : "bg-slate-100 text-slate-500",
                  ].join(" ")}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="hidden min-w-0 lg:block">
                    <span className="block text-sm font-black">{item.label}</span>
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500">{item.short}</span>
                  </span>
                  <span className="truncate text-xs font-black lg:hidden">{item.mobileLabel}</span>
                </button>
              )
            })}
          </div>

          {mode === "case" ? (
            <div className="mt-3 border-t border-[var(--sm-border)] px-2 pt-4">
              <label htmlFor="dna-report-select" className="text-xs font-black text-[var(--sm-text)]">Son DNA raporları</label>
              {reportsLoading ? (
                <div className="mt-2 flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--sm-surface-soft)] px-3 text-xs font-semibold text-[var(--sm-text-muted)]">
                  <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> Raporlar yükleniyor
                </div>
              ) : reportsError ? (
                <div className="mt-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700">
                  {reportsError}
                  <button type="button" onClick={() => void loadReports()} className="mt-2 flex min-h-11 items-center gap-2 font-black">
                    <RefreshCw size={15} aria-hidden="true" /> Yeniden dene
                  </button>
                </div>
              ) : reports.length ? (
                <>
                  {reportSelectionNotice ? (
                    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                      {reportSelectionNotice}
                    </div>
                  ) : null}
                  <div className="relative mt-2">
                    <select
                      id="dna-report-select"
                      value={selectedReportId}
                      onChange={(event) => {
                        cancelPendingResponse()
                        setSelectedReportId(event.target.value)
                        setReportSelectionNotice("")
                        setMessages([])
                        setPreviousTopic(null)
                        setSendError("")
                      }}
                      className="min-h-12 w-full appearance-none rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] px-3 pr-10 text-sm font-bold text-[var(--sm-text)] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="" disabled>Rapor seçin</option>
                      {reports.map((report) => (
                        <option key={report.id} value={report.id}>
                          {report.clientCode || "Kod yok"} · {formatDate(report.createdAt)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
                  </div>
                  {selectedReport ? (
                    <div className="mt-2 rounded-2xl bg-[var(--sm-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
                      <div className="font-black text-[var(--sm-text)]">{selectedReport.clientCode || "Danışan kodu yok"}</div>
                      <div>{selectedReport.ageBand || "Yaş bandı yok"} · Sürüm {selectedReport.version ?? "—"}</div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-2 rounded-2xl bg-[var(--sm-surface-soft)] p-3 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
                  Bu hesapta tartışılabilecek aktif DNA raporu bulunmuyor.
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-3 border-t border-[var(--sm-border)] px-2 pt-4">
            <div className="flex items-start gap-2 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">
              <CircleAlert className="mt-0.5 shrink-0 text-blue-600" size={16} aria-hidden="true" />
              <span>Ad, T.C. kimlik, telefon, adres veya protokol numarası yazmayın. Tanı, ilaç ve tedavi planı kapsam dışıdır.</span>
            </div>
          </div>
        </aside>

        <section
          id="dna-chat-panel"
          role="tabpanel"
          aria-labelledby={`dna-mode-${mode}`}
          className="dna-card min-w-0 overflow-visible"
        >
          <div className="border-b border-[var(--sm-border)] px-4 py-4 md:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.22)]">
                <activeMode.icon size={21} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-black text-[var(--sm-text)]">{activeMode.label}</h2>
                <p className="mt-0.5 text-xs font-semibold leading-5 text-[var(--sm-text-muted)]">{activeMode.description}</p>
              </div>
            </div>
          </div>

          <div
            className={[
              "min-h-[420px] space-y-4 bg-[var(--sm-surface-soft)]/60 px-3 py-4 md:min-h-[520px] md:px-6 md:py-6",
              isAppSurface ? "pb-40 lg:pb-6" : "",
            ].join(" ")}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.length === 0 ? (
              <div className="mx-auto max-w-2xl rounded-[24px] border border-blue-100 bg-[var(--sm-surface)] p-5 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-black text-blue-700">
                  <Sparkles size={18} aria-hidden="true" /> Bu modda neler sorabilirsiniz?
                </div>
                <p className="mt-3 text-sm font-medium leading-6 text-[var(--sm-text-soft)]">{welcomeForMode(mode)}</p>
                <div className="mt-4 grid gap-2">
                  {activeMode.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setQuestion(suggestion)}
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
                <AssistantAnswer key={message.id} answer={message.answer} onSuggestion={setQuestion} />
              )
            )}

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
                ? "fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] mx-auto max-w-[406px] rounded-t-[22px] md:inset-x-8 md:max-w-[704px] lg:sticky lg:inset-x-auto lg:bottom-2 lg:mx-0 lg:max-w-none lg:rounded-none"
                : "sticky bottom-2",
            ].join(" ")}
          >
            {sendError ? (
              <div role="alert" className="mb-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                {sendError}
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <label htmlFor="dna-chat-question" className="sr-only">DNA Asistanına sorunuzu yazın</label>
              <textarea
                id="dna-chat-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value.slice(0, 600))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void submitQuestion()
                  }
                }}
                rows={2}
                maxLength={600}
                disabled={sending}
                placeholder={mode === "case" ? "Seçili rapor hakkında sorun…" : "Sorunuzu yazın…"}
                className="min-h-[52px] max-h-40 min-w-0 flex-1 resize-y rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--sm-text)] outline-none placeholder:text-[var(--sm-text-muted)] focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || question.trim().length < 2 || (mode === "case" && (reportsLoading || !selectedReportId))}
                aria-label="Soruyu gönder"
                className="dna-btn grid min-h-[52px] min-w-[52px] shrink-0 place-items-center disabled:cursor-not-allowed disabled:opacity-45"
              >
                {sending ? <LoaderCircle className="animate-spin" size={19} aria-hidden="true" /> : <Send size={19} aria-hidden="true" />}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] font-bold text-[var(--sm-text-muted)]">
              <span>Enter gönderir · Shift + Enter yeni satır</span>
              <span>{question.length}/600</span>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}

function AssistantAnswer({ answer, onSuggestion }: { answer: DnaAnswer; onSuggestion: (value: string) => void }) {
  const meta = CLASSIFICATION_META[answer.classification]

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

      {answer.caseEvidence.length ? (
        <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3">
          <div className="text-[11px] font-black uppercase tracking-[0.1em] text-cyan-800">Rapordaki dayanak</div>
          <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-cyan-950">
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
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs font-semibold leading-5 text-amber-950">
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
