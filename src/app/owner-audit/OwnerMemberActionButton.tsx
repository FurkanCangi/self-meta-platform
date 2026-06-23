"use client"

import { useState, useTransition, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import type { OwnerMemberAction } from "@/lib/owner/ownerMemberActions"

type Props = {
  targetUserId: string
  action: OwnerMemberAction
  label: string
  variant?: "dark" | "light"
}

function buttonClass(variant: Props["variant"]) {
  if (variant === "dark") {
    return "rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
  }
  return "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
}

export function OwnerMemberActionButton({ targetUserId, action, label, variant = "light" }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function runAction(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    setError("")
    startTransition(async () => {
      const response = await fetch("/api/owner-audit/member/action", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({
          targetUserId,
          action,
          reason: `Owner uye paneli aksiyonu: ${label}`,
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
        {pending ? "İşleniyor..." : label}
      </button>
      {error ? <span className="max-w-[220px] text-xs font-medium text-slate-600">{error}</span> : null}
    </span>
  )
}
