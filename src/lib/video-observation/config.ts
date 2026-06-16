import "server-only"

const DEFAULT_BASE_URL = "http://127.0.0.1:8091"

export function getVideoObservationApiBaseUrl() {
  const raw = process.env.VIDEO_OBS_API_BASE_URL || DEFAULT_BASE_URL
  const parsed = new URL(raw)

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("VIDEO_OBS_API_BASE_URL protocol invalid")
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "")
  parsed.search = ""
  parsed.hash = ""
  return parsed.toString().replace(/\/+$/, "")
}

export function videoObservationPathSegment(value: string) {
  const normalized = String(value || "").trim()
  if (!normalized || normalized.length > 160) {
    throw new Error("video_observation_path_segment_invalid")
  }
  return encodeURIComponent(normalized)
}
