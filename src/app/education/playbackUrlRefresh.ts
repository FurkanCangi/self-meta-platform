export const PLAYBACK_URL_REFRESH_MIN_LEAD_SECONDS = 15
export const PLAYBACK_URL_REFRESH_MAX_LEAD_SECONDS = 30

export function playbackUrlRefreshDelayMs(params: {
  expiresAt: string | null | undefined
  ttlSeconds: number | null | undefined
  nowMs?: number
}) {
  const expiresAtMs = new Date(String(params.expiresAt || "")).getTime()
  const ttlSeconds = Number(params.ttlSeconds)
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return null
  }

  const leadSeconds = Math.min(
    PLAYBACK_URL_REFRESH_MAX_LEAD_SECONDS,
    Math.max(PLAYBACK_URL_REFRESH_MIN_LEAD_SECONDS, ttlSeconds / 4)
  )
  return Math.max(0, expiresAtMs - (params.nowMs ?? Date.now()) - leadSeconds * 1000)
}

export function clampPlaybackResumeTime(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || currentTime <= 0) return 0
  if (!Number.isFinite(duration) || duration <= 0) return currentTime
  return Math.min(currentTime, Math.max(0, duration - 0.25))
}

export function retryAfterDelayMs(value: string | null, nowMs = Date.now()) {
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds * 1000)

  const retryAt = value ? new Date(value).getTime() : Number.NaN
  if (Number.isFinite(retryAt) && retryAt > nowMs) return Math.ceil(retryAt - nowMs)
  return 5_000
}
