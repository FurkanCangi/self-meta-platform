import "server-only"

const DEFAULT_BASE_URL = "http://127.0.0.1:8091"

export type VideoObservationBundle = {
  baseUrl: string
  serviceInfo: { title?: string; version?: string } | null
  summary: any | null
  domains: any[]
  timeline: any[]
  evidence: any | null
  report: any | null
  fusion: any[]
  errors: string[]
}

export type VideoObservationSessionListItem = {
  session_id: string
  child_label: string
  child_external_ref?: string | null
  age_months: number
  support_age_band: string
  status: string
  overall_confidence?: number | null
  quality_label?: string | null
  created_at: string
  updated_at: string
  segment_count: number
  completed_segment_types: string[]
  has_report: boolean
}

function getBaseUrl() {
  const raw =
    process.env.VIDEO_OBS_API_BASE_URL ||
    process.env.NEXT_PUBLIC_VIDEO_OBS_API_BASE_URL ||
    DEFAULT_BASE_URL

  return raw.replace(/\/+$/, "")
}

async function fetchJson(pathname: string) {
  const response = await fetch(`${getBaseUrl()}${pathname}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`${pathname} -> ${response.status}`)
  }

  return response.json()
}

export async function fetchVideoObservationSessions(
  options?: {
    limit?: number
    query?: string
  }
): Promise<{
  baseUrl: string
  sessions: VideoObservationSessionListItem[]
  error: string | null
}> {
  const params = new URLSearchParams()
  if (options?.limit) params.set("limit", String(options.limit))
  if (options?.query?.trim()) params.set("q", options.query.trim())

  const pathname = `/sessions${params.toString() ? `?${params.toString()}` : ""}`

  try {
    const sessions = await fetchJson(pathname)
    return {
      baseUrl: getBaseUrl(),
      sessions: Array.isArray(sessions) ? sessions : [],
      error: null,
    }
  } catch (error) {
    return {
      baseUrl: getBaseUrl(),
      sessions: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchVideoObservationBundle(
  sessionId: string
): Promise<VideoObservationBundle> {
  const errors: string[] = []

  const [serviceInfoResult, summaryResult, domainsResult, timelineResult, evidenceResult, reportResult, fusionResult] =
    await Promise.allSettled([
      fetchJson("/"),
      fetchJson(`/sessions/${sessionId}/summary`),
      fetchJson(`/sessions/${sessionId}/domains`),
      fetchJson(`/sessions/${sessionId}/timeline`),
      fetchJson(`/sessions/${sessionId}/evidence`),
      fetchJson(`/sessions/${sessionId}/report`),
      fetchJson(`/sessions/${sessionId}/fusion`),
    ])

  function pickResult<T>(result: PromiseSettledResult<T>, label: string, fallback: T): T {
    if (result.status === "fulfilled") return result.value
    errors.push(`${label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`)
    return fallback
  }

  return {
    baseUrl: getBaseUrl(),
    serviceInfo: pickResult(serviceInfoResult, "service", null),
    summary: pickResult(summaryResult, "summary", null),
    domains: pickResult(domainsResult, "domains", []),
    timeline: pickResult(timelineResult, "timeline", []),
    evidence: pickResult(evidenceResult, "evidence", null),
    report: pickResult(reportResult, "report", null),
    fusion: pickResult(fusionResult, "fusion", []),
    errors,
  }
}
