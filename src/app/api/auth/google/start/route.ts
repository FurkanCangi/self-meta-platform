import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import {
  encodeGoogleOAuthState,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
  type GoogleOAuthMode,
} from "@/lib/auth/googleOAuthState"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, getClientRateLimitKey } from "@/lib/security/rateLimit"
import { normalizeDeviceType } from "@/lib/security/sessionRegistration"

type CookieToSet = {
  name: string
  value: string
  options: Parameters<NextResponse["cookies"]["set"]>[2]
}

export const runtime = "nodejs"

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http"
  return host ? `${protocol}://${host}` : request.nextUrl.origin
}

function hasChecked(value: FormDataEntryValue | null) {
  const normalized = String(value || "").toLowerCase()
  return normalized === "on" || normalized === "true" || normalized === "1" || normalized === "yes"
}

function sanitizeNextPath(value: FormDataEntryValue | null) {
  const raw = String(value || "")
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/legal/accept")) {
    return "/starter"
  }
  return raw
}

function surfaceFromForm(value: FormDataEntryValue | null, nextPath: string) {
  return String(value || "") === "app" || nextPath.includes("surface=app") ? "app" : "web"
}

function redirectUrl(request: NextRequest, path: string, params?: Record<string, string>) {
  const url = new URL(path, requestOrigin(request))
  for (const [key, value] of Object.entries(params || {})) {
    if (value) url.searchParams.set(key, value)
  }
  return url
}

function fallbackDeviceId(request: NextRequest) {
  const ua = String(request.headers.get("user-agent") || "unknown")
  return `server-google-${crypto.randomUUID()}-${ua}`.slice(0, 200)
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const mode = String(formData.get("mode") || "login") as GoogleOAuthMode
  const nextPath = sanitizeNextPath(formData.get("next"))
  const surface = surfaceFromForm(formData.get("surface"), nextPath)
  const sourcePath = mode === "signup" ? "/signup" : "/login"
  const fallbackParams = {
    ...(surface === "app" ? { surface: "app" } : {}),
    ...(nextPath !== "/starter" ? { next: nextPath } : {}),
  }

  if (mode !== "signup" && mode !== "login") {
    return NextResponse.redirect(redirectUrl(request, "/login", { ...fallbackParams, error: "google_failed" }), 303)
  }

  const legalAccepted =
    hasChecked(formData.get("terms")) &&
    hasChecked(formData.get("kvkk")) &&
    hasChecked(formData.get("consent")) &&
    hasChecked(formData.get("authority"))

  if (mode === "signup" && !legalAccepted) {
    return NextResponse.redirect(redirectUrl(request, "/signup", { ...fallbackParams, error: "legal_required" }), 303)
  }

  const originError = await requireTrustedMutation(request)
  if (originError) {
    return NextResponse.redirect(redirectUrl(request, sourcePath, { ...fallbackParams, error: "origin" }), 303)
  }

  const rateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, `auth-google-${mode}`),
    limit: mode === "signup" ? 5 : 10,
    windowMs: 10 * 60 * 1000,
  })
  if (!rateLimit.ok) {
    return NextResponse.redirect(redirectUrl(request, sourcePath, { ...fallbackParams, error: "rate_limited" }), 303)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.redirect(redirectUrl(request, sourcePath, { ...fallbackParams, error: "google_unavailable" }), 303)
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

  const origin = requestOrigin(request)
  const redirectTo = `${origin}/auth/callback?provider=google`
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "openid email profile",
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(redirectUrl(request, sourcePath, { ...fallbackParams, error: "google_failed" }), 303)
  }

  const deviceId = String(formData.get("deviceId") || fallbackDeviceId(request)).slice(0, 200)
  const response = NextResponse.redirect(data.url, 303)
  authCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  response.cookies.set(
    GOOGLE_OAUTH_STATE_COOKIE,
    encodeGoogleOAuthState({
      mode,
      nextPath,
      surface,
      deviceId,
      deviceType: normalizeDeviceType(formData.get("deviceType")),
      legalAccepted,
      createdAt: Date.now(),
      nonce: crypto.randomUUID(),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS,
    }
  )
  return response
}
