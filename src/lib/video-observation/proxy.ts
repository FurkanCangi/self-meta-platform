import "server-only"

const DEFAULT_BASE_URL = "http://127.0.0.1:8091"

function getVideoObservationApiBaseUrl() {
  const raw =
    process.env.VIDEO_OBS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_VIDEO_OBS_API_BASE_URL ||
    DEFAULT_BASE_URL

  return raw.replace(/\/+$/, "")
}

export async function proxyVideoObservationRequest(
  pathname: string,
  init?: RequestInit
) {
  const response = await fetch(`${getVideoObservationApiBaseUrl()}${pathname}`, {
    ...init,
    cache: "no-store",
  })

  const contentType = response.headers.get("content-type") || ""

  if (contentType.includes("application/json")) {
    const json = await response.json()
    return {
      ok: response.ok,
      status: response.status,
      contentType,
      body: json,
    }
  }

  const text = await response.text()
  return {
    ok: response.ok,
    status: response.status,
    contentType,
    body: { detail: text || `video_observation_upstream_${response.status}` },
  }
}
