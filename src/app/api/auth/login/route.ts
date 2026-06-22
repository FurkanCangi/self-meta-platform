import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { setAppSessionCookie } from "@/lib/security/appSession"
import {
  clearDeviceManagementCookie,
  setDeviceManagementCookie,
} from "@/lib/security/deviceManagementAccess"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { ensurePaymentExemptAccess, resolveEffectivePlan } from "@/lib/security/paymentExemptions"
import { checkRateLimit, getClientRateLimitKey } from "@/lib/security/rateLimit"

type CookieToSet = {
  name: string
  value: string
  options: Parameters<NextResponse["cookies"]["set"]>[2]
}

function normalizeLoginEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, "i")
    .replace(/\u0130/g, "i")
}

function sanitizeNextPath(value: FormDataEntryValue | null) {
  const raw = String(value || "")
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/legal/accept")) {
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
  return nextPath
}

function loginUrl(request: NextRequest, params?: Record<string, string>) {
  const url = new URL("/login", requestOrigin(request))
  for (const [key, value] of Object.entries(params || {})) {
    if (value) url.searchParams.set(key, value)
  }
  return url
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

  const rateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, "auth-login"),
    limit: 8,
    windowMs: 10 * 60 * 1000,
  })
  if (!rateLimit.ok) {
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
  const registerResponse = await fetch(new URL("/api/security/session/register", request.nextUrl.origin), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "x-dna-request": "same-origin",
      "user-agent": request.headers.get("user-agent") || "",
      "x-forwarded-for": request.headers.get("x-forwarded-for") || "",
      "x-real-ip": request.headers.get("x-real-ip") || "",
    },
    body: JSON.stringify({
      deviceId: String(formData.get("deviceId") || `server-${userId}-${request.headers.get("user-agent") || "unknown"}`).slice(0, 200),
      deviceType: String(formData.get("deviceType") || "desktop"),
      allowSlotReuse: true,
    }),
  })
  const registerPayload = await registerResponse.json().catch(() => null)
  if (!registerResponse.ok || !registerPayload?.ok || !registerPayload?.sessionId) {
    const code = String(registerPayload?.error || "session_failed")
    if (code === "device_limit_exceeded") {
      const target = new URL("/profile-setting", origin)
      target.searchParams.set("tab", "devices")
      target.searchParams.set("deviceLimit", "1")
      const response = NextResponse.redirect(target, 303)
      authCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
      })
      setDeviceManagementCookie(response, userId)
      return response
    }

    await supabase.auth.signOut()
    return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: code }), 303)
  }

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle()

  const exemption = await ensurePaymentExemptAccess({ admin, userId, email: data.user?.email })
  if (!exemption.ok) {
    await supabase.auth.signOut()
    return NextResponse.redirect(loginUrl(request, { ...fallbackParams, error: exemption.error }), 303)
  }

  const effectivePlan = resolveEffectivePlan(profile?.plan, data.user?.email)
  const target = new URL(resolvePostLoginPath(effectivePlan, nextPath, appSurface), origin)
  const response = NextResponse.redirect(target, 303)
  authCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  setAppSessionCookie(response, registerPayload.sessionId)
  clearDeviceManagementCookie(response)
  return response
}
