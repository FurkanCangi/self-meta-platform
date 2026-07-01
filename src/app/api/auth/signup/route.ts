import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isCustomSignupEmailConfigured, sendSignupConfirmationEmail } from "@/lib/auth/confirmationEmail"
import { getAcceptedDocumentsSnapshot, LEGAL_DOCUMENT_VERSION } from "@/lib/legal/documents"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, getClientRateLimitKey } from "@/lib/security/rateLimit"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type CookieToSet = {
  name: string
  value: string
  options: Parameters<NextResponse["cookies"]["set"]>[2]
}

const PLAN_CODE = "none"
const LEGAL_ERROR = "legal_required"

export const runtime = "nodejs"

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http"
  return host ? `${protocol}://${host}` : request.nextUrl.origin
}

function signupUrl(request: NextRequest, params?: Record<string, string>) {
  const url = new URL("/signup", requestOrigin(request))
  for (const [key, value] of Object.entries(params || {})) {
    if (value) url.searchParams.set(key, value)
  }
  return url
}

function successUrl(request: NextRequest, email: string) {
  const url = new URL("/auth-signup-success", requestOrigin(request))
  url.searchParams.set("email", email)
  return url
}

function normalizeSignupEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\u0131/g, "i")
    .replace(/\u0130/g, "i")
}

function sanitizeName(value: FormDataEntryValue | null) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
}

function hasChecked(value: FormDataEntryValue | null) {
  const normalized = String(value || "").toLowerCase()
  return normalized === "on" || normalized === "true" || normalized === "1" || normalized === "yes"
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  )
}

function isAlreadyRegisteredResult(user: { identities?: unknown[] } | null | undefined) {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0)
}

function mapSignupError(message?: string | null) {
  const normalized = String(message || "").toLowerCase()
  if (normalized.includes("already registered") || normalized.includes("already exists")) return "already_registered"
  if (normalized.includes("email") && normalized.includes("invalid")) return "invalid_email"
  if (normalized.includes("password")) return "password_short"
  if (normalized.includes("rate")) return "rate_limited"
  return "signup_failed"
}

function confirmationUrl(request: NextRequest, tokenHash: string, type = "signup") {
  const url = new URL("/auth/confirm", requestOrigin(request))
  url.searchParams.set("token_hash", tokenHash)
  url.searchParams.set("type", type)
  return url.toString()
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const fullName = sanitizeName(formData.get("fullName"))
  const email = normalizeSignupEmail(formData.get("email"))
  const password = String(formData.get("password") || "")
  const confirmPassword = String(formData.get("confirmPassword") || "")
  const legalAccepted =
    hasChecked(formData.get("terms")) &&
    hasChecked(formData.get("kvkk")) &&
    hasChecked(formData.get("consent")) &&
    hasChecked(formData.get("authority"))

  if (!fullName) {
    return NextResponse.redirect(signupUrl(request, { error: "missing_name" }), 303)
  }
  if (!email) {
    return NextResponse.redirect(signupUrl(request, { error: "missing_email" }), 303)
  }
  if (!isValidEmail(email)) {
    return NextResponse.redirect(signupUrl(request, { error: "invalid_email" }), 303)
  }
  if (password.length < 8) {
    return NextResponse.redirect(signupUrl(request, { error: "password_short" }), 303)
  }
  if (password !== confirmPassword) {
    return NextResponse.redirect(signupUrl(request, { error: "password_mismatch" }), 303)
  }
  if (!legalAccepted) {
    return NextResponse.redirect(signupUrl(request, { error: LEGAL_ERROR }), 303)
  }

  const originError = await requireTrustedMutation(request)
  if (originError) {
    return NextResponse.redirect(signupUrl(request, { error: "origin" }), 303)
  }

  const rateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, "auth-signup"),
    limit: 5,
    windowMs: 15 * 60 * 1000,
  })
  if (!rateLimit.ok) {
    return NextResponse.redirect(signupUrl(request, { error: "rate_limited" }), 303)
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

  const emailRedirectTo = `${requestOrigin(request)}/auth/confirm?next=/login?confirmed=1`
  const userMetadata = {
    full_name: fullName,
    selected_plan: PLAN_CODE,
    legal_documents_version: LEGAL_DOCUMENT_VERSION,
    legal_signup_checked_at: new Date().toISOString(),
  }

  let userId: string | null = null
  let adminClient: ReturnType<typeof createSupabaseAdminClient> | null = null

  if (isCustomSignupEmailConfigured()) {
    adminClient = createSupabaseAdminClient()
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        redirectTo: emailRedirectTo,
        data: userMetadata,
      },
    })

    if (error) {
      return NextResponse.redirect(signupUrl(request, { error: mapSignupError(error.message) }), 303)
    }

    const tokenHash = data.properties?.hashed_token
    if (!data.user?.id || !tokenHash) {
      return NextResponse.redirect(signupUrl(request, { error: "signup_failed" }), 303)
    }

    userId = data.user.id

    try {
      await sendSignupConfirmationEmail({
        to: email,
        fullName,
        confirmationUrl: confirmationUrl(request, tokenHash, data.properties.verification_type || "signup"),
      })
    } catch (error) {
      console.error("[auth-signup] custom confirmation email failed", error)
      await adminClient.auth.admin.deleteUser(userId).catch(() => null)
      return NextResponse.redirect(signupUrl(request, { error: "email_failed" }), 303)
    }
  } else {
    let signUpResult: Awaited<ReturnType<typeof supabase.auth.signUp>>
    try {
      signUpResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
          data: userMetadata,
        },
      })
    } catch {
      return NextResponse.redirect(signupUrl(request, { error: "network" }), 303)
    }

    const { data, error } = signUpResult
    if (error) {
      return NextResponse.redirect(signupUrl(request, { error: mapSignupError(error.message) }), 303)
    }

    if (!data.user?.id) {
      return NextResponse.redirect(signupUrl(request, { error: "signup_failed" }), 303)
    }

    if (isAlreadyRegisteredResult(data.user)) {
      return NextResponse.redirect(signupUrl(request, { error: "already_registered" }), 303)
    }

    if (data.session) {
      await supabase.auth.signOut().catch(() => null)
    }

    userId = data.user.id
  }

  const now = new Date().toISOString()
  const admin = adminClient ?? createSupabaseAdminClient()
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      role: "expert",
      plan: PLAN_CODE,
      full_name: fullName,
      updated_at: now,
    },
    { onConflict: "user_id" }
  )

  if (profileError) {
    return NextResponse.redirect(signupUrl(request, { error: "profile_failed" }), 303)
  }

  const { error: legalError } = await admin.from("legal_acceptances").insert({
    user_id: userId,
    email,
    plan_code: PLAN_CODE,
    accepted_documents: getAcceptedDocumentsSnapshot(),
    ip_address: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
    source_path: "/signup",
  })

  if (legalError) {
    return NextResponse.redirect(signupUrl(request, { error: "legal_failed" }), 303)
  }

  const response = NextResponse.redirect(successUrl(request, email), 303)
  authCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
}
