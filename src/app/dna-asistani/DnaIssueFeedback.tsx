"use client"

import { Flag, LoaderCircle, MessageSquareWarning, X } from "lucide-react"
import { useState } from "react"

import {
  DNA_CHAT_ISSUE_CATEGORY_LABELS_TR,
} from "@/lib/dna/chat/operations/userFeedback"
import type { DnaChatIssueCategory } from "@/lib/dna/chat/operations/telemetry"

const ANSWER_CATEGORIES: readonly DnaChatIssueCategory[] = [
  "wrong_topic",
  "insufficient_answer",
  "source_mismatch",
  "age_scope_wrong",
  "overconfident_language",
  "report_mismatch",
  "safety_boundary_issue",
  "technical_error",
]

const SOURCE_CATEGORIES: readonly DnaChatIssueCategory[] = [
  "source_mismatch",
  "age_scope_wrong",
]

export default function DnaIssueFeedback({
  scope,
  requestId,
  sourceId,
  sourceIndex,
}: {
  scope: "answer" | "source"
  requestId: string
  sourceId?: string
  sourceIndex?: number
}) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState<DnaChatIssueCategory | null>(null)
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle")
  const categories = scope === "source" ? SOURCE_CATEGORIES : ANSWER_CATEGORIES

  async function submit(category: DnaChatIssueCategory) {
    setSending(category)
    setStatus("idle")
    try {
      const response = await fetch("/api/app/dna-chat/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({
          requestId,
          category,
          ...(scope === "source" && sourceId ? { sourceId } : {}),
        }),
      })
      if (!response.ok) throw new Error("feedback_not_saved")
      setStatus("saved")
      setOpen(false)
    } catch {
      setStatus("error")
    } finally {
      setSending(null)
    }
  }

  const label = scope === "source" ? "Kaynak hatası bildir" : "Cevapla ilgili sorun bildir"
  const Icon = scope === "source" ? Flag : MessageSquareWarning

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          setStatus("idle")
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black text-[var(--sm-text-muted)] hover:bg-[var(--sm-surface-soft)] hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-expanded={open}
        aria-label={scope === "source" && sourceIndex
          ? `Kaynak ${sourceIndex} için kategorik hata bildir`
          : label}
      >
        <Icon size={15} aria-hidden="true" /> {label}
      </button>

      {open ? (
        <div
          className="absolute bottom-full right-0 z-30 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-3 shadow-xl"
          role="dialog"
          aria-label="Sorun kategorisi seçin"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-black text-[var(--sm-text)]">Sorun kategorisi</p>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-[var(--sm-text-muted)]">
                Soru, cevap, rapor veya danışan metni gönderilmez. Bildirim otomatik eğitim verisi olmaz.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--sm-text-muted)] hover:bg-[var(--sm-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Bildirim menüsünü kapat"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 grid gap-1" role="group" aria-label="Sorun kategorileri">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                disabled={Boolean(sending)}
                onClick={() => void submit(category)}
                className="flex min-h-11 items-center justify-between rounded-xl border border-[var(--sm-border)] px-3 text-left text-xs font-bold text-[var(--sm-text)] hover:border-blue-200 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {DNA_CHAT_ISSUE_CATEGORY_LABELS_TR[category]}
                {sending === category ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {status === "saved"
          ? "Kategorik geri bildirim kaydedildi."
          : status === "error"
            ? "Geri bildirim kaydedilemedi."
            : ""}
      </span>
      {status === "saved" ? (
        <span className="ml-2 text-[10px] font-bold text-emerald-700">Kaydedildi</span>
      ) : status === "error" ? (
        <span className="ml-2 text-[10px] font-bold text-red-700">Kaydedilemedi</span>
      ) : null}
    </div>
  )
}
