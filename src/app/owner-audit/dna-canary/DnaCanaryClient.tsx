"use client"

import { useMemo, useState, useTransition } from "react"
import {
  DNA_S13_CANARY_FEEDBACK_LABELS,
  DNA_S13_CANARY_LUNA_VALUE_LABELS,
  type DnaS13CanaryFeedbackLabel,
  type DnaS13CanaryLunaValueLabel,
  type DnaS13CanaryMessageRecord,
} from "@/lib/dna/chat/s13/canary/contracts"

const FEEDBACK_TR: Record<DnaS13CanaryFeedbackLabel, string> = {
  GOOD: "İyi",
  WRONG_INFORMATION: "Yanlış bilgi",
  WRONG_TOPIC: "Yanlış konu",
  INCOMPLETE: "Eksik",
  TOO_SHALLOW: "Yüzeysel",
  UNNATURAL_TURKISH: "Doğal olmayan Türkçe",
  UNNECESSARY_ABSTENTION: "Gereksiz abstention",
  UNNECESSARY_WARNING: "Gereksiz uyarı",
  FOLLOWUP_FAILURE: "Follow-up hatası",
  COMPARISON_FAILURE: "Comparison hatası",
  OTHER: "Diğer",
}

const LUNA_VALUE_TR: Record<DnaS13CanaryLunaValueLabel, string> = {
  LUNA_QUALITY_GAIN: "Luna kalite kazandırdı",
  DETERMINISTIC_ALREADY_SUFFICIENT: "Deterministic zaten yeterliydi",
  LUNA_REQUIRED: "Bu cevapta Luna gerekliydi",
  LUNA_CALL_UNNECESSARY: "Luna çağrısı gereksizdi",
}

type Summary = {
  volume?: { messages?: number; reviewedMessages?: number; trainingCandidates?: number; privacyRejections?: number }
  safety?: { validatorPassRate?: number; unsupportedAddition?: number; unsupportedRelation?: number; sourceViolation?: number; safetyViolation?: number }
  userExperience?: { goodRate?: number; fallbackRate?: number }
  operations?: { p50LatencyMs?: number; p95LatencyMs?: number; lunaCalls?: number; repairCalls?: number }
  cost?: { totalMicrousd?: number; projectedUsdPer1kMessages?: number }
}

function newSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `canary-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function percent(value: number | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`
}

export default function DnaCanaryClient() {
  const [sessionId] = useState(newSessionId)
  const [question, setQuestion] = useState("")
  const [responseDepth, setResponseDepth] = useState<"short" | "standard" | "deep">("standard")
  const [messages, setMessages] = useState<DnaS13CanaryMessageRecord[]>([])
  const [topicIds, setTopicIds] = useState<string[]>([])
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")
  const [lunaValue, setLunaValue] = useState<DnaS13CanaryLunaValueLabel | "">("")
  const [quality, setQuality] = useState<number | "">("")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const latest = messages.at(-1) ?? null
  const summaryCards = useMemo(() => [
    ["Mesaj", summary?.volume?.messages ?? messages.length],
    ["İncelenen", summary?.volume?.reviewedMessages ?? Object.keys(feedbackByMessage).length],
    ["Validator PASS", percent(summary?.safety?.validatorPassRate)],
    ["GOOD", percent(summary?.userExperience?.goodRate)],
    ["Luna çağrısı", summary?.operations?.lunaCalls ?? messages.reduce((sum, row) => sum + row.realization.lunaCalls, 0)],
    ["Maliyet µUSD", summary?.cost?.totalMicrousd ?? messages.reduce((sum, row) => sum + row.realization.costMicrousd, 0)],
  ], [feedbackByMessage, messages, summary])

  function sendQuestion() {
    const value = question.trim()
    if (value.length < 2 || pending) return
    setError("")
    startTransition(async () => {
      const response = await fetch("/api/owner-audit/dna-canary/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, question: value, responseDepth, conversationTopicIds: topicIds.slice(-2) }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setError(payload?.error === "dna_s13_canary_privacy_blocked"
          ? "Gizlilik kapısı bu mesajı engelledi. Yalnız genel ve kişisel olmayan bilimsel soru kullan."
          : String(payload?.error || "Canary mesajı çalıştırılamadı."))
        return
      }
      const message = payload.message as DnaS13CanaryMessageRecord
      setMessages((current) => [...current, message])
      setTopicIds(message.routing.detectedTopicIds.slice(-2))
      setQuestion("")
      setNote("")
      setLunaValue("")
      setQuality("")
    })
  }

  function sendFeedback(label: DnaS13CanaryFeedbackLabel) {
    if (!latest || pending) return
    setError("")
    startTransition(async () => {
      const response = await fetch("/api/owner-audit/dna-canary/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messageId: latest.messageId,
          label,
          note: note.trim() || null,
          lunaValue: lunaValue || null,
          overallQuality: quality || null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setError(payload?.error === "dna_s13_canary_feedback_note_privacy_blocked"
          ? "Feedback notunda kişisel/klinik bağlam algılandı; notu genelleştir."
          : String(payload?.error || "Feedback kaydedilemedi."))
        return
      }
      setFeedbackByMessage((current) => ({ ...current, [latest.messageId]: label }))
      setSummary(payload.summary as Summary)
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) sendQuestion()
            }}
            rows={4}
            maxLength={600}
            placeholder="Genel ve kişisel olmayan doğal bir bilimsel soru yaz…"
            className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none ring-cyan-200 focus:ring-2"
          />
          <div className="flex flex-col gap-3">
            <select
              value={responseDepth}
              onChange={(event) => setResponseDepth(event.target.value as typeof responseDepth)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
            >
              <option value="short">Kısa</option>
              <option value="standard">Standart</option>
              <option value="deep">Derin</option>
            </select>
            <button
              type="button"
              disabled={pending || question.trim().length < 2}
              onClick={sendQuestion}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Çalışıyor…" : "Canary çalıştır"}
            </button>
          </div>
        </div>
        {error ? <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm text-violet-900">{error}</div> : null}

        <div className="mt-6 grid gap-4">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Altyapı hazır; henüz bu oturumda trafik yok.
            </div>
          ) : messages.map((message) => (
            <article key={message.messageId} className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-950">{message.question}</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{message.answer}</div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{message.realization.provider}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{message.realization.status}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">{Math.round(message.realization.latencyMs)} ms</span>
                <span className={`rounded-full px-2.5 py-1 ${message.validation.pass ? "bg-cyan-50 text-cyan-800" : "bg-violet-50 text-violet-800"}`}>
                  validator {message.validation.pass ? "PASS" : "FAIL"}
                </span>
                {feedbackByMessage[message.messageId] ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{feedbackByMessage[message.messageId]}</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {latest ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">Son cevabı etiketle</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <select value={lunaValue} onChange={(event) => setLunaValue(event.target.value as DnaS13CanaryLunaValueLabel | "")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                <option value="">Luna değeri · isteğe bağlı</option>
                {DNA_S13_CANARY_LUNA_VALUE_LABELS.map((value) => <option key={value} value={value}>{LUNA_VALUE_TR[value]}</option>)}
              </select>
              <select value={quality} onChange={(event) => setQuality(event.target.value ? Number(event.target.value) : "")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                <option value="">Kalite 1–5 · isteğe bağlı</option>
                {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder="Kısa not · kişisel veri yok" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {DNA_S13_CANARY_FEEDBACK_LABELS.map((label) => (
                <button key={label} type="button" disabled={pending} onClick={() => sendFeedback(label)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-cyan-50 disabled:opacity-50">
                  {FEEDBACK_TR[label]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <aside className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {summaryCards.map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-600 shadow-sm">
          <div className="font-semibold text-slate-950">Oturum</div>
          <div className="mt-1 break-all font-mono text-[10px]">{sessionId}</div>
          <div className="mt-3">Training etiketi yalnız validator PASS + privacy PASS + GOOD sonrasında ayrı annotation olarak yazılır; export veya eğitim başlatmaz.</div>
          <div className="mt-3">1.000 mesaj projeksiyonu: ${summary?.cost?.projectedUsdPer1kMessages ?? 0}</div>
        </div>
      </aside>
    </div>
  )
}
