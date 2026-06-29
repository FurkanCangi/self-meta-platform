"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DEFAULT_SUPPORT_RESOLUTION_MESSAGE } from "@/lib/support/supportMessages"

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
  { value: "closed", label: "Listeden kaldırıldı" },
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
  const [resolutionMessage, setResolutionMessage] = useState(
    initialResolutionMessage || DEFAULT_SUPPORT_RESOLUTION_MESSAGE,
  )
  const [publicReply, setPublicReply] = useState("")
  const [confirmResolved, setConfirmResolved] = useState(false)
  const [error, setError] = useState("")
  const [ok, setOk] = useState("")

  async function submitAction(nextStatus: string, options?: { removeFromList?: boolean }) {
    const response = await fetch("/api/owner-audit/support/action", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dna-request": "same-origin",
      },
      body: JSON.stringify({
        ticketId,
        status: nextStatus,
        ownerNote,
        resolutionMessage,
        publicReply: options?.removeFromList ? "" : publicReply,
        confirmResolved: nextStatus === "resolved" ? confirmResolved : false,
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.ok) {
      throw new Error(String(payload?.error || "Destek talebi güncellenemedi."))
    }
    return payload
  }

  function save() {
    setError("")
    setOk("")

    if (status === "resolved" && !confirmResolved) {
      setError("Çözüldü olarak işaretlemek için önce onay kutusunu işaretleyin.")
      return
    }

    if (status === "resolved") {
      const approved = window.confirm(
        "Bu talep kesin çözüldü mü? Evet dersen kullanıcıya 'destek talebiniz çözüldü' e-postası gönderilecek.",
      )
      if (!approved) return
    }

    startTransition(async () => {
      try {
        await submitAction(status)
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Destek talebi güncellenemedi.")
        return
      }
      setOk(status === "resolved" ? "Çözüldü olarak kaydedildi. Kullanıcıya e-posta gönderimi denendi." : "Kaydedildi.")
      setPublicReply("")
      if (status !== "resolved") setConfirmResolved(false)
      router.refresh()
    })
  }

  function removeResolvedFromList() {
    setError("")
    setOk("")
    startTransition(async () => {
      try {
        await submitAction("closed", { removeFromList: true })
      } catch (removeError) {
        setError(removeError instanceof Error ? removeError.message : "Destek talebi listeden kaldırılamadı.")
        return
      }
      setStatus("closed")
      setPublicReply("")
      setConfirmResolved(false)
      setOk("Talep destek kuyruğundan kaldırıldı. Gerekirse filtrelerden listeden kaldırılanlarda görebilirsiniz.")
      router.refresh()
    })
  }

  return (
    <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-base font-black text-slate-950">Talep işlemleri</div>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
          Durumu güncelle, iç not al veya kullanıcıya görünen çözüm mesajı bırak.
        </p>
      </div>

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
          Hızlı yanıt
          <input
            value={publicReply}
            onChange={(event) => setPublicReply(event.target.value)}
            maxLength={3000}
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800"
            placeholder="Örn: Cihaz kayıtlarınızı temizledik."
          />
        </label>
      </div>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        İç takip notu
        <textarea
          value={ownerNote}
          onChange={(event) => setOwnerNote(event.target.value)}
          maxLength={3000}
          className="min-h-[90px] rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium normal-case leading-6 tracking-normal text-slate-800"
          placeholder="Sadece destek panelinde görünen kısa takip notu"
        />
      </label>

      <label className="grid gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Kullanıcının göreceği çözüm
        <textarea
          value={resolutionMessage}
          onChange={(event) => setResolutionMessage(event.target.value)}
          maxLength={3000}
          className="min-h-[90px] rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium normal-case leading-6 tracking-normal text-slate-800"
          placeholder={DEFAULT_SUPPORT_RESOLUTION_MESSAGE}
        />
      </label>

      {status === "resolved" ? (
        <label className="flex gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold leading-6 text-cyan-900">
          <input
            type="checkbox"
            checked={confirmResolved}
            onChange={(event) => setConfirmResolved(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-cyan-300"
          />
          <span>
            Bu talebin çözüldüğünü onaylıyorum. Kaydet dediğimde kullanıcıya çözüm e-postası gönderilsin.
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </button>
        {status === "resolved" ? (
          <button
            type="button"
            onClick={removeResolvedFromList}
            disabled={pending}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            Listeden kaldır
          </button>
        ) : null}
        {ok ? <span className="text-sm font-bold text-cyan-700">{ok}</span> : null}
        {error ? <span className="text-sm font-bold text-slate-700">{error}</span> : null}
      </div>
    </div>
  )
}
