"use client"

import { useState, useTransition, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import type { OwnerSecurityAction } from "@/lib/owner/ownerSecurity"

type ActionButtonProps = {
  targetUserId: string
  action: OwnerSecurityAction
  label: string
  variant?: "dark" | "light" | "danger"
  deviceId?: string | null
  eventType?: string | null
  lockMinutes?: number
}

function buttonClass(variant: ActionButtonProps["variant"]) {
  if (variant === "danger") {
    return "rounded-2xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
  }
  if (variant === "dark") {
    return "rounded-2xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
  }
  return "rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
}

function defaultReason(label: string) {
  return `Owner panel aksiyonu: ${label}`
}

export function OwnerSecurityActionButton({
  targetUserId,
  action,
  label,
  variant = "light",
  deviceId,
  eventType,
  lockMinutes,
}: ActionButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function runAction(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault()
    event?.stopPropagation()

    setError("")
    startTransition(async () => {
      const response = await fetch("/api/owner-audit/security/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          action,
          reason: defaultReason(label),
          deviceId,
          eventType,
          lockMinutes,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "İşlem yapılamadı."))
        return
      }
      router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={runAction} disabled={pending} className={buttonClass(variant)}>
        {pending ? "İşleniyor" : label}
      </button>
      {error ? <span className="max-w-[180px] text-[11px] font-medium text-rose-600">{error}</span> : null}
    </span>
  )
}
