import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import {
  decodeGoogleOAuthState,
  GOOGLE_OAUTH_STATE_COOKIE,
  type GoogleOAuthState,
} from "@/lib/auth/googleOAuthState"
import { getAcceptedDocumentsSnapshot, hasAcceptedActiveDocuments } from "@/lib/legal/documents"
import {
  clearAppSessionCookie,
  setAppSessionCookie,
  verifyCurrentAppSession,
} from "@/lib/security/appSession"
import { extractSupabaseAuthSessionId } from "@/lib/security/authSessionBinding"
import {
  clearDeviceManagementCookie,
  clearPendingDeviceCookie,
  setPendingDeviceCookie,
  setDeviceManagementCookie,
} from "@/lib/security/deviceManagementAccess"
import { ensurePaymentExemptAccess, resolveEffectivePlan } from "@/lib/security/paymentExemptions"
import { registerAppSessionForUser } from "@/lib/security/sessionRegistration"
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/admin"

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

type LegalAcceptanceRow = {
  accepted_documents: unknown
}

type ProfileRow = {
  plan: string | null
  role: string | null
  full_name: string | null
}

export const runtime = "nodejs"

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http"
  return host ? `${protocol}://${host}` : request.nextUrl.origin
}

function authUrl(request: NextRequest, path: "/login" | "/signup", params?: Record<string, string>) {
  const appSurface = params?.surface === "app" || String(params?.next || "").includes("surface=app")
  const targetPath = appSurface && path === "/login" ? "/app-login" : path
  const url = new URL(targetPath, requestOrigin(request))
  for (const [key, value] of Object.entries(params || {})) {
    if (value && !(appSurface && key === "surface" && targetPath === "/app-login")) url.searchParams.set(key, value)
  }
  return url
}

function authEntryPath(state: GoogleOAuthState | null): "/login" | "/signup" {
  return state?.mode === "signup" ? "/signup" : "/login"
}

function hasGoogleIdentity(user: User) {
  const identities = Array.isArray(user.identities) ? user.identities : []
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers
    : []
  return (
    identities.some((identity) => identity.provider === "google") ||
    providers.some((provider) => provider === "google")
  )
}

function sanitizeNextPath(value?: string | null) {
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

function appendDeviceRecoveryContext(target: URL, nextPath: string, appSurface: boolean) {
  target.searchParams.set("surface", appSurface ? "app" : "web")
  if (nextPath !== "/starter") target.searchParams.set("next", nextPath)
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

function clearGoogleState(response: NextResponse) {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

function userDisplayName(userMetadata: Record<string, unknown> | undefined | null, fallbackEmail?: string | null) {
  const fullName = String(userMetadata?.full_name || userMetadata?.name || "").replace(/\s+/g, " ").trim()
  if (fullName) return fullName.slice(0, 160)
  return String(fallbackEmail || "").split("@")[0]?.slice(0, 160) || "DNA Intelligence Kullanıcısı"
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  )
}

async function hasCurrentLegalAcceptance(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await admin
    .from("legal_acceptances")
    .select("accepted_documents")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false })
    .limit(10)

  if (error) return false
  return ((data || []) as LegalAcceptanceRow[]).some((row) => hasAcceptedActiveDocuments(row.accepted_documents))
}

async function redirectWithSignOut({
  request,
  supabase,
  authCookies,
  target,
}: {
  request: NextRequest
  supabase: ReturnType<typeof createServerClient>
  authCookies: CookieToSet[]
  target: URL
}) {
  await supabase.auth.signOut({ scope: "local" }).catch(() => null)
  const response = NextResponse.redirect(target, 303)
  applyLatestAuthCookies(response, authCookies)
  clearAppSessionCookie(response)
  clearGoogleState(response)
  return response
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = decodeGoogleOAuthState(request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value)
  const entryPath = authEntryPath(state)
  const nextPath = sanitizeNextPath(state?.nextPath)
  const appSurface = state?.surface === "app" || nextPath.includes("surface=app")
  const fallbackParams = {
    ...(appSurface ? { surface: "app" } : {}),
    ...(nextPath !== "/starter" ? { next: nextPath } : {}),
  }

  if (!state) {
    return NextResponse.redirect(authUrl(request, "/login", { error: "google_failed" }), 303)
  }

  if (!code) {
    const oauthError = request.nextUrl.searchParams.get("error")
    const response = NextResponse.redirect(
      authUrl(request, entryPath, {
        ...fallbackParams,
        error: oauthError === "access_denied" ? "google_cancelled" : "google_failed",
      }),
      303
    )
    clearGoogleState(response)
    return response
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const response = NextResponse.redirect(
      authUrl(request, entryPath, { ...fallbackParams, error: "google_unavailable" }),
      303
    )
    clearGoogleState(response)
    return response
  }

  const authCookies: CookieToSet[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  const user = data.user
  if (error || !user?.id || !data.session) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, entryPath, { ...fallbackParams, error: "google_failed" }),
    })
  }

  if (!hasGoogleIdentity(user)) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, entryPath, { ...fallbackParams, error: "google_failed" }),
    })
  }

  if (!user.email_confirmed_at) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, entryPath, { ...fallbackParams, error: "email_not_confirmed" }),
    })
  }

  if (!hasSupabaseAdminConfig()) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, entryPath, { ...fallbackParams, error: "google_unavailable" }),
    })
  }

  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const [{ data: initialProfile, error: profileLookupError }, acceptedLegal] = await Promise.all([
    admin
      .from("profiles")
      .select("plan, role, full_name")
      .eq("user_id", user.id)
      .maybeSingle(),
    hasCurrentLegalAcceptance(admin, user.id),
  ])
  if (profileLookupError) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, entryPath, {
        ...fallbackParams,
        error: state.mode === "signup" ? "profile_failed" : "google_failed",
      }),
    })
  }
  let profile = initialProfile as ProfileRow | null

  if (state.mode === "signup") {
    if (!state.legalAccepted) {
      return redirectWithSignOut({
        request,
        supabase,
        authCookies,
        target: authUrl(request, "/signup", { ...fallbackParams, error: "legal_required" }),
      })
    }

    if (!profile) {
      const newProfile: ProfileRow & { user_id: string; updated_at: string } = {
        user_id: user.id,
        role: "expert",
        plan: "none",
        full_name: userDisplayName(user.user_metadata, user.email),
        updated_at: now,
      }
      const { error: profileError } = await admin.from("profiles").insert(newProfile)
      if (profileError) {
        return redirectWithSignOut({
          request,
          supabase,
          authCookies,
          target: authUrl(request, "/signup", { ...fallbackParams, error: "profile_failed" }),
        })
      }
      profile = newProfile
    } else if (!profile.full_name) {
      const fullName = userDisplayName(user.user_metadata, user.email)
      const { error: nameError } = await admin
        .from("profiles")
        .update({ full_name: fullName, updated_at: now })
        .eq("user_id", user.id)
      if (nameError) {
        return redirectWithSignOut({
          request,
          supabase,
          authCookies,
          target: authUrl(request, "/signup", { ...fallbackParams, error: "profile_failed" }),
        })
      }
      profile = { ...profile, full_name: fullName }
    }

    if (!acceptedLegal) {
      const { error: legalError } = await admin.from("legal_acceptances").insert({
        user_id: user.id,
        email: user.email,
        plan_code: profile.plan || "none",
        accepted_documents: getAcceptedDocumentsSnapshot(),
        ip_address: getClientIp(request),
        user_agent: request.headers.get("user-agent"),
        source_path: "/signup-google",
      })

      if (legalError) {
        return redirectWithSignOut({
          request,
          supabase,
          authCookies,
          target: authUrl(request, "/signup", { ...fallbackParams, error: "legal_failed" }),
        })
      }
    }
  } else if (!profile || !acceptedLegal) {
      return redirectWithSignOut({
        request,
        supabase,
        authCookies,
        target: authUrl(request, "/signup", { ...fallbackParams, error: "google_legal_required" }),
      })
  }

  const previousAppSession = state.legacyDeviceId
    ? await verifyCurrentAppSession(user.id)
    : null
  const sessionResult = await registerAppSessionForUser({
    user,
    requestHeaders: request.headers,
    authSessionId: extractSupabaseAuthSessionId(data.session.access_token) || "",
    authorizedLegacyDeviceRecordId:
      previousAppSession?.ok ? previousAppSession.deviceId : null,
    deviceId: state.deviceId,
    deviceType: state.deviceType,
    identityVersion: state.identityVersion,
    publicKeyJwk: state.publicKeyJwk,
    publicKeyFingerprint: state.publicKeyFingerprint,
    proofChallengeToken: state.proofChallengeToken,
    proofSignature: state.proofSignature,
    legacyDeviceId: state.legacyDeviceId,
  })

  if (!sessionResult.ok) {
    if (
      sessionResult.error === "device_limit_exceeded" ||
      sessionResult.error === "replacement_limit_exceeded" ||
      sessionResult.error === "trusted_device_required"
    ) {
      const target = new URL("/profile-setting", requestOrigin(request))
      target.searchParams.set("tab", "devices")
      target.searchParams.set("error", sessionResult.error)
      appendDeviceRecoveryContext(target, nextPath, appSurface)
      const response = await redirectWithSignOut({
        request,
        supabase,
        authCookies,
        target,
      })
      setDeviceManagementCookie(response, user.id)
      clearPendingDeviceCookie(response)
      clearGoogleState(response)
      return response
    }

    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, "/login", { ...fallbackParams, error: sessionResult.error || "session_failed" }),
    })
  }

  if (sessionResult.status === "approval_required") {
    const target = new URL("/profile-setting", requestOrigin(request))
    target.searchParams.set("tab", "devices")
    target.searchParams.set("approval", "required")
    appendDeviceRecoveryContext(target, nextPath, appSurface)
    const response = await redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target,
    })
    setDeviceManagementCookie(response, user.id)
    setPendingDeviceCookie(response, {
      userId: user.id,
      challengeId: sessionResult.challengeId,
      deviceId: sessionResult.deviceId,
      verificationCode: sessionResult.approvalCode,
    })
    clearGoogleState(response)
    return response
  }

  const exemption = await ensurePaymentExemptAccess({ admin, userId: user.id, email: user.email })
  if (!exemption.ok) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, "/login", { ...fallbackParams, error: exemption.error }),
    })
  }

  const target = new URL(
    resolvePostLoginPath(resolveEffectivePlan(profile?.plan, user.email), nextPath, appSurface),
    requestOrigin(request)
  )
  const response = NextResponse.redirect(target, 303)
  applyLatestAuthCookies(response, authCookies)
  setAppSessionCookie(response, sessionResult.sessionId)
  clearDeviceManagementCookie(response)
  clearPendingDeviceCookie(response)
  clearGoogleState(response)
  return response
}
