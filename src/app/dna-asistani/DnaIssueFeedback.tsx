"use client"

import { Flag, LoaderCircle, MessageSquareWarning, X } from "lucide-react"
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"

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
