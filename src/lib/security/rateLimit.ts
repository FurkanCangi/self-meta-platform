import "server-only"

import { createHmac } from "node:crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const RATE_LIMIT_CLEANUP_BATCH_SIZE = 100
let nextExpiredRateLimitCleanupAt = 0

function rateLimitHashSecret() {
  const configured =
    process.env.RATE_LIMIT_HASH_SECRET ||
    process.env.AUTH_STATE_SECRET ||
    process.env.DEVICE_PROOF_SECRET ||
    process.env.APP_SESSION_SECRET ||
    process.env.SUPABASE_JWT_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV !== "production") return "local-rate-limit-hash-secret"
  throw new Error("A server-side rate-limit hashing secret is required in production")
}

export function getTrustedClientNetworkIdentity(request: Request) {
  const trustedVercelRequest = Boolean(request.headers.get("x-vercel-id"))
  const forwardedFor = trustedVercelRequest
    ? request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for")
    : request.headers.get("x-forwarded-for")
  return forwardedFor?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown-network"
}

export function getPseudonymousRateLimitKey(scope: string, parts: string[]) {
  const digest = createHmac("sha256", rateLimitHashSecret())
    .update(JSON.stringify(parts))
    .digest("base64url")
  return `${scope}:${digest}`
}

export function getNetworkRateLimitKey(request: Request, scope: string) {
  return getPseudonymousRateLimitKey(scope, [getTrustedClientNetworkIdentity(request)])
}

async function cleanupExpiredRateLimits(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  now: number
) {
  if (now < nextExpiredRateLimitCleanupAt) return
  nextExpiredRateLimitCleanupAt = now + RATE_LIMIT_CLEANUP_INTERVAL_MS

  try {
    const expiredBefore = new Date(now).toISOString()
    const { data, error } = await admin
      .from("api_rate_limits")
      .select("key")
      .lte("reset_at", expiredBefore)
      .order("reset_at", { ascending: true })
      .limit(RATE_LIMIT_CLEANUP_BATCH_SIZE)
    if (error || !data?.length) return
    const cleanup = await admin
      .from("api_rate_limits")
      .delete()
      .in(
        "key",
        data.map((row) => String(row.key))
      )
      .lte("reset_at", expiredBefore)
    if (cleanup.error) throw cleanup.error
  } catch (error) {
    console.warn("[rate-limit] Expired counter cleanup skipped", error)
  }
}

function memoryRateLimit(options: {
  key: string
  limit: number
  windowMs: number
  now?: number
}) {
  const now = options.now ?? Date.now()
  const existing = buckets.get(options.key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return { ok: true, remaining: Math.max(0, options.limit - 1), resetAt: now + options.windowMs }
  }

  if (existing.count >= options.limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return { ok: true, remaining: Math.max(0, options.limit - existing.count), resetAt: existing.resetAt }
}

export async function checkRateLimit(options: {
  key: string
  limit: number
  windowMs: number
  now?: number
}) {
  try {
    const admin = createSupabaseAdminClient()
    await cleanupExpiredRateLimits(admin, options.now ?? Date.now())
    const { data, error } = await admin.rpc("check_api_rate_limit", {
      p_key: options.key,
      p_limit: options.limit,
      p_window_ms: options.windowMs,
    })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row.ok !== "boolean") throw new Error("rate_limit_rpc_invalid")

    return {
      ok: Boolean(row.ok),
      remaining: Math.max(0, Number(row.remaining || 0)),
      resetAt: new Date(row.reset_at).getTime(),
    }
  } catch (error) {
    console.warn("[rate-limit] Falling back to in-memory rate limit", error)
    return memoryRateLimit(options)
  }
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
