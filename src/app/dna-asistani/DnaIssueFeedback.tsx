"use client"

import { Flag, LoaderCircle, MessageSquareWarning, ThumbsDown, ThumbsUp, X } from "lucide-react"
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

import {
  DNA_CHAT_ISSUE_CATEGORY_LABELS_TR,
} from "@/lib/dna/chat/operations/userFeedback"
import type { DnaChatIssueCategory } from "@/lib/dna/chat/operations/telemetry"
import {
  DNA_S13_LIMITED_FEEDBACK_REASONS,
  type DnaS13LimitedFeedbackReason,
  type DnaS13LimitedFeedbackVote,
} from "@/lib/dna/chat/s13/limitedRollout/feedback"

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

const LIMITED_REASON_LABELS: Readonly<Record<DnaS13LimitedFeedbackReason, string>> = Object.freeze({
  wrong_information: "Yanlış bilgi",
  misunderstood: "Sorumu anlamadı",
  incomplete: "Eksik cevap",
  too_short: "Gereksiz kısa",
  too_long: "Gereksiz uzun",
  unnatural: "Doğal değil",
  other: "Diğer",
})

export function DnaLimitedRolloutFeedback({ requestId }: { requestId: string }) {
  const [sending, setSending] = useState(false)
  const [showReasons, setShowReasons] = useState(false)
  const [savedVote, setSavedVote] = useState<DnaS13LimitedFeedbackVote | null>(null)
  const [error, setError] = useState(false)

  async function submit(vote: DnaS13LimitedFeedbackVote, reason?: DnaS13LimitedFeedbackReason) {
    setSending(true)
    setError(false)
    try {
      const response = await fetch("/api/app/dna-chat/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-dna-request": "same-origin" },
        body: JSON.stringify({ requestId, vote, ...(reason ? { reason } : {}) }),
      })
      if (!response.ok) throw new Error("feedback_not_saved")
      setSavedVote(vote)
      setShowReasons(false)
    } catch {
      setError(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative flex flex-wrap items-center justify-end gap-1" aria-label="Cevabı değerlendir">
      <span className="mr-1 text-[10px] font-bold text-[var(--sm-text-muted)]">Bu cevap yararlı mı?</span>
      <button
        type="button"
        disabled={sending || savedVote !== null}
        onClick={() => void submit("up")}
        className="inline-flex size-11 items-center justify-center rounded-xl text-[var(--sm-text-muted)] hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label="Cevap yararlı"
        aria-pressed={savedVote === "up"}
      >
        <ThumbsUp size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        disabled={sending || savedVote !== null}
        onClick={() => setShowReasons((current) => !current)}
        className="inline-flex size-11 items-center justify-center rounded-xl text-[var(--sm-text-muted)] hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
        aria-label="Cevap yararlı değil"
        aria-expanded={showReasons}
        aria-pressed={savedVote === "down"}
      >
        <ThumbsDown size={16} aria-hidden="true" />
      </button>
      {showReasons ? (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-2 shadow-xl">
          <p className="px-2 py-1 text-[10px] font-bold text-[var(--sm-text-muted)]">İsterseniz bir neden seçin.</p>
          <div className="grid gap-1">
            <button
              type="button"
              disabled={sending}
              onClick={() => void submit("down")}
              className="min-h-11 rounded-xl px-3 text-left text-xs font-bold text-[var(--sm-text)] hover:bg-[var(--sm-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Neden belirtmeden gönder
            </button>
            {DNA_S13_LIMITED_FEEDBACK_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                disabled={sending}
                onClick={() => void submit("down", reason)}
                className="min-h-11 rounded-xl px-3 text-left text-xs font-bold text-[var(--sm-text)] hover:bg-[var(--sm-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {LIMITED_REASON_LABELS[reason]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {savedVote ? "Geri bildiriminiz kaydedildi." : error ? "Geri bildirim kaydedilemedi." : ""}
      </span>
    </div>
  )
}

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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  const dialogTitleId = useId()
  const categories = scope === "source" ? SOURCE_CATEGORIES : ANSWER_CATEGORIES

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  function closeDialog() {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      closeDialog()
      return
    }
    if (event.key !== "Tab") return

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") || [],
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

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
      closeDialog()
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
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) closeDialog()
          else setOpen(true)
          setStatus("idle")
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black text-[var(--sm-text-muted)] hover:bg-[var(--sm-surface-soft)] hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={dialogId}
        aria-label={scope === "source" && sourceIndex
          ? `Kaynak ${sourceIndex} için kategorik hata bildir`
          : label}
      >
        <Icon size={15} aria-hidden="true" /> {label}
      </button>

      {open ? (
        <div
          ref={dialogRef}
          id={dialogId}
          className="absolute bottom-full right-0 z-30 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[var(--sm-border)] bg-[var(--sm-surface)] p-3 shadow-xl"
          role="dialog"
          aria-labelledby={dialogTitleId}
          onKeyDown={handleDialogKeyDown}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p id={dialogTitleId} className="text-xs font-black text-[var(--sm-text)]">Sorun kategorisi</p>
              <p className="mt-1 text-[10px] font-semibold leading-4 text-[var(--sm-text-muted)]">
                Soru, cevap, rapor veya danışan metni gönderilmez. Bildirim otomatik eğitim verisi olmaz.
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeDialog}
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
