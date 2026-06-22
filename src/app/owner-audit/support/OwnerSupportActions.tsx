"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

type OwnerSupportActionsProps = {
  ticketId: string
  currentStatus: string
  initialOwnerNote?: string | null
  initialResolutionMessage?: string | null
}

const statusOptions = [
  { value: "open", label: "Yeni" },
  { value: "in_progress", label: "İnceleniyor" },
  { value: "waiting_user", label: "Kullanıcıdan bilgi bekleniyor" },
  { value: "resolved", label: "Çözüldü" },
  { value: "closed", label: "Kapandı" },
]

export default function OwnerSupportActions({
  ticketId,
  currentStatus,
  initialOwnerNote,
  initialResolutionMessage,
}: OwnerSupportActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState(currentStatus)
  const [ownerNote, setOwnerNote] = useState(initialOwnerNote || "")
  const [resolutionMessage, setResolutionMessage] = useState(initialResolutionMessage || "")
  const [publicReply, setPublicReply] = useState("")
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")

  function save() {
    setError("")
    setOk("")

    startTransition(async () => {
      const response = await fetch("/api/owner-audit/support/action", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({
          ticketId,
          status,
          ownerNote,
          resolutionMessage,
          publicReply,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Destek talebi güncellenemedi."))
        return
      }
      setOk("Kaydedildi.")
      setPublicReply("")
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          Durum
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-800"
          >
            {statusOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
          Kullanıcıya kısa yanıt
          <input
            value={publicReply}
            onChange={(event) => setPublicReply(event.target.value)}
            maxLength={3000}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800"
            placeholder="Örn: Cihaz kayıtlarınız temizlendi."
          />
        </label>
      </div>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        İç not
        <textarea
          value={ownerNote}
          onChange={(event) => setOwnerNote(event.target.value)}
          maxLength={3000}
          className="min-h-[90px] rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium normal-case leading-6 tracking-normal text-slate-800"
          placeholder="Sadece owner tarafında görünen not"
        />
      </label>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Çözüm notu
        <textarea
          value={resolutionMessage}
          onChange={(event) => setResolutionMessage(event.target.value)}
          maxLength={3000}
          className="min-h-[90px] rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium normal-case leading-6 tracking-normal text-slate-800"
          placeholder="Kullanıcının destek ekranında göreceği net çözüm açıklaması"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Kaydediliyor..." : "Kaydet ve Bildir"}
        </button>
        {ok ? <span className="text-sm font-bold text-emerald-600">{ok}</span> : null}
        {error ? <span className="text-sm font-bold text-rose-600">{error}</span> : null}
      </div>
    </div>
  )
}
