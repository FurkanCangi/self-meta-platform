import "server-only"

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function checkRateLimit(options: {
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
