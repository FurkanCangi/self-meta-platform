import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

type CookieToSet = {
  name: string
  value: string
  options: Parameters<NextResponse["cookies"]["set"]>[2]
}

const OTP_TYPES = new Set(["signup", "email", "invite", "magiclink", "recovery", "email_change"])

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  const protocol = request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "") || "http"
  return host ? `${protocol}://${host}` : request.nextUrl.origin
}

function loginUrl(request: NextRequest, params?: Record<string, string>) {
  const url = new URL("/login", requestOrigin(request))
  for (const [key, value] of Object.entries(params || {})) {
    if (value) url.searchParams.set(key, value)
  }
  return url
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash")
  const type = request.nextUrl.searchParams.get("type")

  if (!tokenHash || !type || !OTP_TYPES.has(type)) {
    return NextResponse.redirect(loginUrl(request, { error: "confirm_invalid" }), 303)
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

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  })

  if (error) {
    return NextResponse.redirect(loginUrl(request, { error: "confirm_failed" }), 303)
  }

  await supabase.auth.signOut().catch(() => null)

  const response = NextResponse.redirect(loginUrl(request, { confirmed: "1" }), 303)
  authCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options)
  })
  return response
}
