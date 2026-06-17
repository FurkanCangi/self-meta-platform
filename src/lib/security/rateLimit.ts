import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

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
    if (process.env.NODE_ENV === "production") {
      throw error
    }

    return memoryRateLimit(options)
  }
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
