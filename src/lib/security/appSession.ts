import "server-only"

import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import {
  evaluateAccountRisk,
  isSecurityLockExemptUser,
  recordAccountSecurityEvent,
} from "@/lib/security/anomalyDetection"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const APP_SESSION_COOKIE = "sm_active_session"
export const APP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export type AppSessionCheck =
  | { ok: true; sessionId: string }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "locked" | "suspended" | "error" }

export function setAppSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(APP_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: APP_SESSION_MAX_AGE_SECONDS,
  })
}

export function clearAppSessionCookie(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

function getClientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headerStore.get("x-real-ip") || null
}

async function auditActiveSessionFingerprint(params: {
  userId: string
  sessionId: string
  previousIp?: string | null
  previousUserAgent?: string | null
  previousLastSeenAt?: string | null
}) {
  const headerStore = await headers()
  const ipAddress = getClientIp(headerStore)
  const userAgent = String(headerStore.get("user-agent") || "").slice(0, 500)
  const now = new Date()
  const lastSeenAt = params.previousLastSeenAt ? new Date(params.previousLastSeenAt).getTime() : 0
  const shouldRefreshLastSeen = !lastSeenAt || now.getTime() - lastSeenAt > 5 * 60 * 1000
  const ipChanged = Boolean(params.previousIp && ipAddress && params.previousIp !== ipAddress)
  const userAgentChanged = Boolean(
    params.previousUserAgent &&
      userAgent &&
      params.previousUserAgent !== userAgent
  )

  if (!shouldRefreshLastSeen && !ipChanged && !userAgentChanged) return

  const admin = createSupabaseAdminClient()
  await admin
    .from("account_sessions")
    .update({
      last_seen_at: now.toISOString(),
      ip_address: ipAddress || params.previousIp || null,
      user_agent: userAgent || params.previousUserAgent || null,
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .eq("status", "active")

  if (ipChanged) {
    await recordAccountSecurityEvent({
      userId: params.userId,
      eventType: "active_session_ip_changed",
      ipAddress,
      userAgent,
      metadata: {
        session_id: params.sessionId,
        previous_ip: params.previousIp,
      },
    })
  }

  if (userAgentChanged) {
    await recordAccountSecurityEvent({
      userId: params.userId,
      eventType: "active_session_user_agent_changed",
      ipAddress,
      userAgent,
      metadata: {
        session_id: params.sessionId,
        previous_user_agent: params.previousUserAgent,
      },
    })
  }

  if (ipChanged || userAgentChanged) {
    await evaluateAccountRisk(params.userId)
  }
}

export async function verifyCurrentAppSession(userId: string): Promise<AppSessionCheck> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(APP_SESSION_COOKIE)?.value

  if (!sessionId) return { ok: false, reason: "missing" }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("account_sessions")
    .select("id, status, expires_at, ip_address, user_agent, last_seen_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) return { ok: false, reason: "error" }
  if (!data || data.status !== "active") return { ok: false, reason: "invalid" }

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (!expiresAt || expiresAt <= Date.now()) return { ok: false, reason: "expired" }

  const { data: securityState, error: stateError } = await supabase
    .from("account_security_state")
    .select("temporary_locked_until, suspended_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (stateError) return { ok: false, reason: "error" }
  if (securityState?.suspended_at) return { ok: false, reason: "suspended" }

  const lockedUntil = securityState?.temporary_locked_until
    ? new Date(securityState.temporary_locked_until).getTime()
    : 0
  if (lockedUntil && lockedUntil > Date.now()) {
    const lockExemptUser = await isSecurityLockExemptUser(userId)
    if (!lockExemptUser) return { ok: false, reason: "locked" }
  }

  await auditActiveSessionFingerprint({
    userId,
    sessionId,
    previousIp: data.ip_address,
    previousUserAgent: data.user_agent,
    previousLastSeenAt: data.last_seen_at,
  })

  return { ok: true, sessionId }
}
