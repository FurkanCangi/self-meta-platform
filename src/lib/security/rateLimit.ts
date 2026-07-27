import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { evaluateSharedRateLimit } from "@/lib/security/rateLimitPolicy"

export async function checkRateLimit(options: {
  key: string
  limit: number
  windowMs: number
  now?: number
}) {
  const decision = await evaluateSharedRateLimit(
    { windowMs: options.windowMs, now: options.now },
    async () => {
      const admin = createSupabaseAdminClient()
      return admin.rpc("check_api_rate_limit", {
        p_key: options.key,
        p_limit: options.limit,
        p_window_ms: options.windowMs,
      })
    },
  )
  if (!decision.backendAvailable) {
    console.error("[rate-limit] Shared rate-limit backend unavailable; request denied")
  }
  return decision
}

export function getClientRateLimitKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown-ip"
  const userAgent = String(request.headers.get("user-agent") || "unknown-agent").slice(0, 120)
  return `${scope}:${ipAddress}:${userAgent}`
}

export function rateLimitResponse(resetAt: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return Response.json(
    { ok: false, error: "Too many requests" },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfterSeconds),
      },
    }
  )
}
