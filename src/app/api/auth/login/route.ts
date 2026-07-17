import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { clearAppSessionCookie, setAppSessionCookie } from "@/lib/security/appSession"
import {
  clearDeviceManagementCookie,
  clearPendingDeviceCookie,
  setPendingDeviceCookie,
  setDeviceManagementCookie,
} from "@/lib/security/deviceManagementAccess"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { ensurePaymentExemptAccess, resolveEffectivePlan } from "@/lib/security/paymentExemptions"
import {
  checkRateLimit,
  getPseudonymousRateLimitKey,
  getTrustedClientNetworkIdentity,
} from "@/lib/security/rateLimit"

const LOGIN_USER_ATTEMPT_LIMIT = 10
const LOGIN_NETWORK_ATTEMPT_LIMIT = 80
const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

type CookieToSet = {
  name: string
  value: string
  options: Parameters<NextResponse["cookies"]["set"]>[2]
}

function applyLatestAuthCookies(response: NextResponse, authCookies: CookieToSet[]) {
  const latest = new Map<string, CookieToSet>()
  for (const cookie of authCookies) latest.set(cookie.name, cookie)
  for (const { name, value, options } of latest.values()) {
    response.cookies.set(name, value, options)
  }
}

async function clearLocalAuthSession(
  supabase: ReturnType<typeof createServerClient>,
  authCookies: CookieToSet[],
  response: NextResponse
) {
  await supabase.auth.signOut({ scope: "local" }).catch(() => null)
  applyLatestAuthCookies(response, authCookies)
  clearAppSessionCookie(response)
  return response
}

function normalizeLoginEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, "i")
    .replace(/\u0130/g, "i")
}

function getLoginRateLimitKeys(request: NextRequest, normalizedEmail: string) {
  const networkIdentity = getTrustedClientNetworkIdentity(request)
  return {
    userNetworkKey: getPseudonymousRateLimitKey("auth-login-user", [
      normalizedEmail,
      networkIdentity,
    ]),
    networkAbuseKey: getPseudonymousRateLimitKey("auth-login-network", [networkIdentity]),
  }
}

function sanitizeNextPath(value: FormDataEntryValue | null) {
  const raw = String(value || "")
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(raw) ||
    raw.startsWith("/legal/accept")
  ) {
    return "/starter"
  }
  return raw
}

function resolvePostLoginPath(plan: string, nextPath: string, appSurface: boolean) {
  if (plan === "none") return appSurface ? "/report-packages?surface=app" : "/fiyatlandirma"
  if (appSurface && !nextPath.includes("surface=app")) {
    const glue = nextPath.includes("?") ? "&" : "?"
    return `${nextPath}${glue}surface=app`
  }
  if (!appSurface && !nextPath.includes("surface=")) {
    const glue = nextPath.includes("?") ? "&" : "?"
    return `${nextPath}${glue}surface=web`
  }
  return nextPath
}

function loginUrl(request: NextRequest, params?: Record<string, string>) {
  const appSurface = params?.surface === "app" || String(params?.next || "").includes("surface=app")
  const url = new URL(appSurface ? "/app-login" : "/login", requestOrigin(request))
  for (const [key, value] of Object.entries(params || {})) {
    if (value && !(appSurface && key === "surface")) url.searchParams.set(key, value)
  }
  return url
}

function appendDeviceRecoveryContext(target: URL, nextPath: string, appSurface: boolean) {
  target.searchParams.set("surface", appSurface ? "app" : "web")
  if (nextPath !== "/starter") target.searchParams.set("next", nextPath)
}

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http"
  return host ? `${protocol}://${host}` : request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email = normalizeLoginEmail(formData.get("email"))
  const password = String(formData.get("password") || "")
  const nextPath = sanitizeNextPath(formData.get("next"))
  const appSurface = String(formData.get("surface") || "") === "app" || nextPath.includes("surface=app")

  const fallbackParams = {
    ...(appSurface ? { surface: "app" } : {}),
    ...(nextPath !== "/starter" ? { next: nextPath } : {}),
  }

  if (!email || !password) {
    return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "missing" }), 303)
  }

  const originError = await requireTrustedMutation(request)
  if (originError) {
    return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "origin" }), 303)
  }

  const loginRateLimitKeys = getLoginRateLimitKeys(request, email)
  const networkAbuseRateLimit = await checkRateLimit({
    key: loginRateLimitKeys.networkAbuseKey,
    limit: LOGIN_NETWORK_ATTEMPT_LIMIT,
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  })
  if (!networkAbuseRateLimit.ok) {
    return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "rate_limited" }), 303)
  }
  const userNetworkRateLimit = await checkRateLimit({
    key: loginRateLimitKeys.userNetworkKey,
    limit: LOGIN_USER_ATTEMPT_LIMIT,
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  })
  if (!userNetworkRateLimit.ok) {
    return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "rate_limited" }), 303)
  }

  const authCookies: CookieToSet[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            authCookies.push({ name, value, options })
          })
        },
      },
    }
  )

  let signInResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
  try {
    signInResult = await supabase.auth.signInWithPassword({ email, password })
  } catch {
    return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "network" }), 303)
  }

  const { data, error } = signInResult
  const userId = data.user?.id
  const accessToken = data.session?.access_token
  if (error || !userId || !accessToken) {
    if (String(error?.message || "").toLowerCase().includes("email not confirmed")) {
      return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "email_not_confirmed" }), 303)
    }
    return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "invalid" }), 303)
  }

  const origin = requestOrigin(request)
  let registerResponse: Response
  try {
    registerResponse = await fetch(new URL("/api/security/session/register", request.nextUrl.origin), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
        "x-dna-request": "same-origin",
        "user-agent": request.headers.get("user-agent") || "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
        "x-vercel-forwarded-for": request.headers.get("x-vercel-forwarded-for") || "",
        "x-vercel-ip-city": request.headers.get("x-vercel-ip-city") || "",
        "x-vercel-ip-country": request.headers.get("x-vercel-ip-country") || "",
        "x-vercel-id": request.headers.get("x-vercel-id") || "",
        "x-real-ip": request.headers.get("x-real-ip") || "",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        deviceId: String(formData.get("deviceId") || `server-${userId}-${request.headers.get("user-agent") || "unknown"}`).slice(0, 200),
        deviceType: String(formData.get("deviceType") || "desktop"),
        identityVersion: String(formData.get("identityVersion") || "legacy-session"),
        publicKeyJwk: String(formData.get("publicKeyJwk") || ""),
        publicKeyFingerprint: String(formData.get("publicKeyFingerprint") || ""),
        proofChallengeToken: String(formData.get("proofChallengeToken") || ""),
        proofSignature: String(formData.get("proofSignature") || ""),
        legacyDeviceId: String(formData.get("legacyDeviceId") || ""),
      }),
    })
  } catch {
    return clearLocalAuthSession(
      supabase,
      authCookies,
      NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "session_failed" }), 303)
    )
  }
  const registerPayload = await registerResponse.json().catch(() => null)
  if (!registerResponse.ok || !registerPayload?.ok) {
    const code =
      registerResponse.status === 429
        ? "rate_limited"
        : String(registerPayload?.error || "session_failed")
    if (
      code === "device_limit_exceeded" ||
      code === "replacement_limit_exceeded" ||
      code === "trusted_device_required"
    ) {
      const target = new URL("/profile-setting", origin)
      target.searchParams.set("tab", "devices")
      target.searchParams.set("error", code)
      appendDeviceRecoveryContext(target, nextPath, appSurface)
      const response = NextResponse.redirect(target, 303)
      await clearLocalAuthSession(supabase, authCookies, response)
      setDeviceManagementCookie(response, userId)
      clearPendingDeviceCookie(response)
      return response
    }

    return clearLocalAuthSession(
      supabase,
      authCookies,
      NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: code }), 303)
    )
  }

  if (registerPayload.status === "approval_required") {
    const target = new URL("/profile-setting", origin)
    target.searchParams.set("tab", "devices")
    target.searchParams.set("approval", "required")
    appendDeviceRecoveryContext(target, nextPath, appSurface)
    const response = NextResponse.redirect(target, 303)
    await clearLocalAuthSession(supabase, authCookies, response)
    setDeviceManagementCookie(response, userId)
    setPendingDeviceCookie(response, {
      userId,
      challengeId: String(registerPayload.challengeId),
      deviceId: String(registerPayload.deviceId),
      verificationCode: String(registerPayload.verificationCode),
    })
    return response
  }

  if (!registerPayload.sessionId) {
    return clearLocalAuthSession(
      supabase,
      authCookies,
      NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: "session_failed" }), 303)
    )
  }

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle()

  const exemption = await ensurePaymentExemptAccess({ admin, userId, email: data.user?.email })
  if (!exemption.ok) {
    return clearLocalAuthSession(
      supabase,
      authCookies,
      NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: exemption.error }), 303)
    )
  }

  const effectivePlan = resolveEffectivePlan(profile?.plan, data.user?.email)
  const target = new URL(resolvePostLoginPath(effectivePlan, nextPath, appSurface), origin)
  const response = NextResponse.redirect(target, 303)
  applyLatestAuthCookies(response, authCookies)
  setAppSessionCookie(response, registerPayload.sessionId)
  clearDeviceManagementCookie(response)
  clearPendingDeviceCookie(response)
  return response
}
