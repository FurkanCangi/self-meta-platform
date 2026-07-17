import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import {
  evaluateAccountRisk,
  isSecurityLockExemptUser,
  recordAccountSecurityEvent,
} from "@/lib/security/anomalyDetection"
import { extractSupabaseAuthSessionId } from "@/lib/security/authSessionBinding"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const APP_SESSION_COOKIE = "sm_active_session"
export const APP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const APP_SESSION_COOKIE_VERSION = "v1"
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AppSessionCheck =
  | { ok: true; sessionId: string; deviceId: string }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "locked" | "suspended" | "error" }

function appSessionSecret() {
  const configured =
    process.env.APP_SESSION_SECRET ||
    process.env.AUTH_STATE_SECRET ||
    process.env.DEVICE_PROOF_SECRET ||
    process.env.SUPABASE_JWT_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV !== "production") return "dna-local-app-session-secret"
  throw new Error("APP_SESSION_SECRET is required in production")
}

function signAppSessionId(sessionId: string) {
  return createHmac("sha256", appSessionSecret())
    .update(`${APP_SESSION_COOKIE_VERSION}:${sessionId}`)
    .digest("base64url")
}

function safeSignatureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createAppSessionCookieValue(sessionId: string) {
  if (!UUID_PATTERN.test(sessionId)) throw new Error("invalid_app_session_id")
  return `${APP_SESSION_COOKIE_VERSION}.${sessionId}.${signAppSessionId(sessionId)}`
}

export function verifyAppSessionCookieValue(value: string | null | undefined) {
  const [version, sessionId, signature, extra] = String(value || "").split(".")
  if (
    extra ||
    version !== APP_SESSION_COOKIE_VERSION ||
    !UUID_PATTERN.test(sessionId || "") ||
    !signature
  ) {
    return null
  }
  return safeSignatureEqual(signature, signAppSessionId(sessionId)) ? sessionId : null
}

export function setAppSessionCookie(response: NextResponse, sessionId: string) {
  response.cookies.set(APP_SESSION_COOKIE, createAppSessionCookieValue(sessionId), {
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
  deviceId: string
  previousIp?: string | null
  previousUserAgent?: string | null
  previousLastSeenAt?: string | null
}) {
  const headerStore = await headers()
  const ipAddress = getClientIp(headerStore)
  const userAgent = String(headerStore.get("user-agent") || "").slice(0, 500)
  const trustedVercelRequest = Boolean(headerStore.get("x-vercel-id"))
  const city = trustedVercelRequest
    ? String(headerStore.get("x-vercel-ip-city") || "").slice(0, 120) || null
    : null
  const country = trustedVercelRequest
    ? String(headerStore.get("x-vercel-ip-country") || "").slice(0, 8) || null
    : null
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

  await admin
    .from("account_devices")
    .update({
      last_seen_at: now.toISOString(),
      last_ip: ipAddress || params.previousIp || null,
      last_user_agent: userAgent || params.previousUserAgent || null,
      ...(city ? { last_city: city } : {}),
      ...(country ? { last_country: country } : {}),
    })
    .eq("id", params.deviceId)
    .eq("user_id", params.userId)
    .is("revoked_at", null)

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
  const cookieValue = cookieStore.get(APP_SESSION_COOKIE)?.value

  if (!cookieValue) return { ok: false, reason: "missing" }
  const sessionId = verifyAppSessionCookieValue(cookieValue)
  if (!sessionId) return { ok: false, reason: "invalid" }

  const supabase = await createSupabaseServerClient()
  const { data: authSessionData, error: authSessionError } = await supabase.auth.getSession()
  const authSessionId = extractSupabaseAuthSessionId(authSessionData.session?.access_token)
  if (authSessionError || !authSessionId) return { ok: false, reason: "invalid" }

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("account_sessions")
    .select("id, device_id, auth_session_id, status, expires_at, ip_address, user_agent, last_seen_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) return { ok: false, reason: "error" }
  if (!data || data.status !== "active") return { ok: false, reason: "invalid" }

  if (data.auth_session_id && data.auth_session_id !== authSessionId) {
    return { ok: false, reason: "invalid" }
  }
  if (!data.auth_session_id) {
    const { data: boundSession, error: bindingError } = await admin
      .from("account_sessions")
      .update({ auth_session_id: authSessionId })
      .eq("id", sessionId)
      .eq("user_id", userId)
      .eq("status", "active")
      .is("auth_session_id", null)
      .select("id")
      .maybeSingle()
    if (bindingError || !boundSession) return { ok: false, reason: "invalid" }
  }

  const { data: device, error: deviceError } = await admin
    .from("account_devices")
    .select("id, revoked_at, verification_required, verified_at")
    .eq("id", data.device_id)
    .eq("user_id", userId)
    .maybeSingle()
  if (deviceError) return { ok: false, reason: "error" }
  if (
    !device ||
    device.revoked_at ||
    device.verification_required !== false ||
    !device.verified_at
  ) {
    return { ok: false, reason: "invalid" }
  }

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0
  if (!expiresAt || expiresAt <= Date.now()) return { ok: false, reason: "expired" }

  const { data: securityState, error: stateError } = await admin
    .from("account_security_state")
    .select("temporary_locked_until, suspended_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (stateError) return { ok: false, reason: "error" }
  const lockExemptUser = await isSecurityLockExemptUser(userId)
  if (!lockExemptUser && securityState?.suspended_at) return { ok: false, reason: "suspended" }

  const lockedUntil = securityState?.temporary_locked_until
    ? new Date(securityState.temporary_locked_until).getTime()
    : 0
  if (!lockExemptUser && lockedUntil && lockedUntil > Date.now()) return { ok: false, reason: "locked" }

  await auditActiveSessionFingerprint({
    userId,
    sessionId,
    deviceId: data.device_id,
    previousIp: data.ip_address,
    previousUserAgent: data.user_agent,
    previousLastSeenAt: data.last_seen_at,
  })

  return { ok: true, sessionId, deviceId: data.device_id }
}
