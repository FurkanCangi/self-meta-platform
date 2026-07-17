"use client"

import { supabase } from "@/lib/supabase/client"

export type LogoutScope = "local" | "global"

export async function logoutAppSession(scope: LogoutScope = "local") {
  let serverError: Error | null = null
  try {
    const response = await fetch("/api/security/session/logout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dna-request": "same-origin",
      },
      body: JSON.stringify({ scope }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.ok) {
      serverError = new Error(String(payload?.error || "session_logout_failed"))
    }
  } finally {
    const { error } = await supabase.auth.signOut({ scope: serverError ? "local" : scope })
    if (!serverError && error) serverError = error
  }
  if (serverError) throw serverError
}
