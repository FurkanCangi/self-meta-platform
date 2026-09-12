import "server-only"

import { headers } from "next/headers"
import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { verifyCurrentAppSession } from "@/lib/security/appSession"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AuthGuardResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }

export async function requireConfirmedUser(options: { recoverSessionRead?: boolean } = {}): Promise<AuthGuardResult> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!user.email_confirmed_at) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Email confirmation required" }, { status: 403 }),
    }
  }

  let appSession = await verifyCurrentAppSession(user.id)
  // Opt-in for Chat only. No model request or cached authorization is replayed.
  // Retry availability failures only, re-running all session validity checks once.
  if (options.recoverSessionRead && !appSession.ok && appSession.reason === "error") {
    console.warn("[auth-session] read failure", { stage: appSession.stage, code: appSession.code,
      retry: appSession.transient === true })
    if (appSession.transient === true) appSession = await verifyCurrentAppSession(user.id)
  }
  if (!appSession.ok) {
    if (options.recoverSessionRead) {
      console.warn("[auth-session] denied", { reason: appSession.reason, stage: appSession.stage, code: appSession.code })
      if (appSession.reason === "error") {
        return { ok: false, response: NextResponse.json(
          { ok: false, error: "auth_service_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }) }
      }
    }
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 }),
    }
  }

  return { ok: true, user }
}

export async function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return null

  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host")
  if (!host) {
    return NextResponse.json({ ok: false, error: "Origin check failed" }, { status: 403 })
  }

  const expectedProtocol = headerStore.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")
  const expectedOrigin = `${expectedProtocol}://${host}`

  if (origin !== expectedOrigin) {
    return NextResponse.json({ ok: false, error: "Origin check failed" }, { status: 403 })
  }

  return null
}

const TRUSTED_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

export async function requireTrustedMutation(request: Request) {
  if (!TRUSTED_MUTATION_METHODS.has(request.method.toUpperCase())) return null

  const origin = request.headers.get("origin")
  if (origin) return requireSameOrigin(request)

  if (request.headers.get("x-dna-request") === "same-origin") {
    return null
  }

  return NextResponse.json({ ok: false, error: "Trusted mutation check failed" }, { status: 403 })
}
