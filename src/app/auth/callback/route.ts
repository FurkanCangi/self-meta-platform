import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import {
  decodeGoogleOAuthState,
  GOOGLE_OAUTH_STATE_COOKIE,
  type GoogleOAuthState,
} from "@/lib/auth/googleOAuthState"
import { getAcceptedDocumentsSnapshot, hasAcceptedActiveDocuments } from "@/lib/legal/documents"
import { setAppSessionCookie } from "@/lib/security/appSession"
import { ensurePaymentExemptAccess, resolveEffectivePlan } from "@/lib/security/paymentExemptions"
import { registerAppSessionForUser } from "@/lib/security/sessionRegistration"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type CookieToSet = {
  name: string
  value: string
  options: Parameters<NextResponse["cookies"]["set"]>[2]
}

type LegalAcceptanceRow = {
  accepted_documents: unknown
}

export const runtime = "nodejs"

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http"
  return host ? `${protocol}://${host}` : request.nextUrl.origin
}

function authUrl(request: NextRequest, path: "/login" | "/signup", params?: Record<string, string>) {
  const url = new URL(path, requestOrigin(request))
  for (const [key, value] of Object.entries(params || {})) {
    if (value) url.searchParams.set(key, value)
  }
  return url
}

function resolvePostLoginPath(plan: string, nextPath: string, appSurface: boolean) {
  if (plan === "none") return appSurface ? "/report-packages?surface=app" : "/fiyatlandirma"
  if (appSurface && !nextPath.includes("surface=app")) {
    const glue = nextPath.includes("?") ? "&" : "?"
    return `${nextPath}${glue}surface=app`
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
  await supabase.auth.signOut().catch(() => null)
  const response = NextResponse.redirect(target, 303)
  authCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  clearGoogleState(response)
  return response
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = decodeGoogleOAuthState(request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value)
  const fallbackParams = {
    ...(state?.surface === "app" ? { surface: "app" } : {}),
    ...(state?.nextPath && state.nextPath !== "/starter" ? { next: state.nextPath } : {}),
  }

  if (!code || !state) {
    return NextResponse.redirect(authUrl(request, "/login", { ...fallbackParams, error: "google_failed" }), 303)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.redirect(authUrl(request, "/login", { ...fallbackParams, error: "google_unavailable" }), 303)
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
      target: authUrl(request, "/login", { ...fallbackParams, error: "google_failed" }),
    })
  }

  if (!user.email_confirmed_at) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, "/login", { ...fallbackParams, error: "email_not_confirmed" }),
    })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, "/login", { ...fallbackParams, error: "google_unavailable" }),
    })
  }

  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()

  if (state.mode === "signup") {
    if (!state.legalAccepted) {
      return redirectWithSignOut({
        request,
        supabase,
        authCookies,
        target: authUrl(request, "/signup", { ...fallbackParams, error: "legal_required" }),
      })
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        user_id: user.id,
        role: "expert",
        plan: "none",
        full_name: userDisplayName(user.user_metadata, user.email),
        updated_at: now,
      },
      { onConflict: "user_id" }
    )

    if (profileError) {
      return redirectWithSignOut({
        request,
        supabase,
        authCookies,
        target: authUrl(request, "/signup", { ...fallbackParams, error: "profile_failed" }),
      })
    }

    const { error: legalError } = await admin.from("legal_acceptances").insert({
      user_id: user.id,
      email: user.email,
      plan_code: "none",
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
  } else {
    const [{ data: profile, error: profileError }, acceptedLegal] = await Promise.all([
      admin.from("profiles").select("plan").eq("user_id", user.id).maybeSingle(),
      hasCurrentLegalAcceptance(admin, user.id),
    ])

    if (profileError || !profile || !acceptedLegal) {
      return redirectWithSignOut({
        request,
        supabase,
        authCookies,
        target: authUrl(request, "/signup", { ...fallbackParams, error: "google_legal_required" }),
      })
    }
  }

  const sessionResult = await registerAppSessionForUser({
    user,
    requestHeaders: request.headers,
    deviceId: state.deviceId,
    deviceType: state.deviceType,
    allowSlotReuse: true,
  })

  if (!sessionResult.ok) {
    return redirectWithSignOut({
      request,
      supabase,
      authCookies,
      target: authUrl(request, "/login", { ...fallbackParams, error: sessionResult.error || "session_failed" }),
    })
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("user_id", user.id)
    .maybeSingle()

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
    resolvePostLoginPath(resolveEffectivePlan(profile?.plan, user.email), state.nextPath, state.surface === "app"),
    requestOrigin(request)
  )
  const response = NextResponse.redirect(target, 303)
  authCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  setAppSessionCookie(response, sessionResult.sessionId)
  clearGoogleState(response)
  return response
}
