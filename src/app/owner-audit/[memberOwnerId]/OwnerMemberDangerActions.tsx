"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

function actionErrorMessage(error: string) {
  switch (error) {
    case "owner_self_delete_blocked":
      return "Kendi owner hesabını bu panelden silemezsin."
    case "owner_account_delete_blocked":
      return "Owner/yönetici hesabı bu panelden silinemez."
    case "member_auth_user_missing":
      return "Bu satırın aktif giriş hesabı bulunamadı. Eski kayıt olabilir."
    case "member_auth_delete_failed":
      return "Üye hesabı silinemedi. Tekrar denemeden önce Supabase durumunu kontrol etmek gerekir."
    case "Trusted mutation check failed":
      return "Güvenlik kontrolü nedeniyle işlem durdu. Sayfayı yenileyip tekrar deneyin."
    default:
      return "İşlem tamamlanamadı. Lütfen tekrar deneyin."
  }
}

export function OwnerMemberDangerActions({
  targetUserId,
  memberName,
  memberEmail,
  canDelete,
}: {
  targetUserId: string
  memberName: string
  memberEmail: string
  canDelete: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("Owner panelinden üyelik kaldırma")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const handleDelete = async () => {
    setBusy(true)
    setError("")
    setDone(false)

    try {
      const response = await fetch("/api/owner-audit/member/action", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          targetUserId,
          action: "delete_member_account",
          reason,
        }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || payload?.ok === false) {
        throw new Error(String(payload?.error || "owner_member_action_failed"))
      }

      setDone(true)
      setOpen(false)
      router.refresh()
      router.push("/owner-audit")
    } catch (err) {
      setError(actionErrorMessage(err instanceof Error ? err.message : "owner_member_action_failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[2rem] border border-slate-300 bg-slate-50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Üye hesabı yönetimi</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Bu işlem üyenin sisteme giriş hesabını kaldırır. Danışan, skor, rapor ve denetim kayıtları silinmez; sonradan kontrol edebilmek için saklanır.
          </p>
          <div className="mt-3 text-sm font-semibold text-slate-950">
            {memberName} / {memberEmail}
          </div>
        </div>

        {canDelete ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
          >
            {open ? "Silme panelini kapat" : "Üyeyi sil"}
          </button>
        ) : (
          <div className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            Bu hesap silmeye uygun değil
          </div>
        )}
      </div>

      {open ? (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-950">Silme sebebi</div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || reason.trim().length < 3}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Siliniyor..." : "Evet, hesabı sil"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
          {error}
        </div>
      ) : null}

      {done ? (
        <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
          Üye hesabı silindi ve işlem kayda alındı.
        </div>
      ) : null}
    </div>
  )
}
