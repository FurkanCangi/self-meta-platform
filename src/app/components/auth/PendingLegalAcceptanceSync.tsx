"use client"

import { useEffect } from "react"
import { normalizePlanCode } from "@/lib/legal/documents"
import {
  PENDING_LEGAL_ACCEPTANCE_STORAGE_KEY,
  type PendingLegalAcceptance,
} from "@/lib/legal/pendingAcceptance"
import { supabase } from "@/lib/supabase/client"

function parsePendingAcceptance(raw: string | null): PendingLegalAcceptance | null {
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as Partial<PendingLegalAcceptance>
    const acceptedAt = String(value.acceptedAt || "")
    const sourcePath = String(value.sourcePath || "/signup").slice(0, 500)
    const method = value.method === "google" ? "google" : "email"

    if (!acceptedAt || Number.isNaN(Date.parse(acceptedAt))) return null

    return {
      planCode: normalizePlanCode(value.planCode),
      sourcePath,
      method,
      acceptedAt,
      documentVersion: value.documentVersion,
    }
  } catch {
    return null
  }
}

export default function PendingLegalAcceptanceSync() {
  useEffect(() => {
    let cancelled = false

    async function syncPendingAcceptance() {
      const pending = parsePendingAcceptance(
        window.localStorage.getItem(PENDING_LEGAL_ACCEPTANCE_STORAGE_KEY)
      )

      if (!pending) return

      const acceptedAt = new Date(pending.acceptedAt).getTime()
      const thirtyDays = 30 * 24 * 60 * 60 * 1000
      if (Date.now() - acceptedAt > thirtyDays) {
        window.localStorage.removeItem(PENDING_LEGAL_ACCEPTANCE_STORAGE_KEY)
        return
      }

      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (cancelled || !user?.id) return

      try {
        await supabase
          .from("profiles")
          .upsert({
            user_id: user.id,
            role: "expert",
            plan: pending.planCode,
          })
          .throwOnError()
      } catch {}

      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          planCode: pending.planCode,
          sourcePath: pending.sourcePath,
        }),
      }).catch(() => null)

      if (!cancelled && response?.ok) {
        window.localStorage.removeItem(PENDING_LEGAL_ACCEPTANCE_STORAGE_KEY)
      }
    }

    syncPendingAcceptance()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
