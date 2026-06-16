import "server-only"

import { getVideoObservationApiBaseUrl } from "./config"

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
