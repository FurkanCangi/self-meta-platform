export type SharedRateLimitDecision = Readonly<{
  ok: boolean
  remaining: number
  resetAt: number
  backendAvailable: boolean
  reason: "allowed" | "limit_exceeded" | "backend_unavailable"
}>

type SharedRateLimitRpcResult = Readonly<{
  data: unknown
  error: unknown
}>

type SharedRateLimitRpcInvoker = () => Promise<SharedRateLimitRpcResult>

function unavailableDecision(now: number, windowMs: number): SharedRateLimitDecision {
  const boundedRetryWindow = Math.min(Math.max(windowMs, 1_000), 60_000)
  return Object.freeze({
    ok: false,
    remaining: 0,
    resetAt: now + boundedRetryWindow,
    backendAvailable: false,
    reason: "backend_unavailable",
  })
}

/**
 * Normalizes the shared Postgres rate-limit RPC response. Any transport,
 * database, or payload-contract failure is denied. A process-local counter is
 * intentionally not used because serverless instances do not share memory.
 */
export async function evaluateSharedRateLimit(
  options: Readonly<{
    windowMs: number
    now?: number
  }>,
  invoke: SharedRateLimitRpcInvoker,
): Promise<SharedRateLimitDecision> {
  const now = options.now ?? Date.now()
  try {
    const { data, error } = await invoke()
    if (error) return unavailableDecision(now, options.windowMs)

    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
    const resetAt = Date.parse(String(row?.reset_at || ""))
    const remaining = typeof row?.remaining === "number" ? row.remaining : Number.NaN
    if (
      !row
      || typeof row.ok !== "boolean"
      || !Number.isSafeInteger(remaining)
      || remaining < 0
      || !Number.isFinite(resetAt)
    ) {
      return unavailableDecision(now, options.windowMs)
    }

    return Object.freeze({
      ok: row.ok,
      remaining,
      resetAt,
      backendAvailable: true,
      reason: row.ok ? "allowed" : "limit_exceeded",
    })
  } catch {
    return unavailableDecision(now, options.windowMs)
  }
}
