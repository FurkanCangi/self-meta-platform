/** Classify availability failures only; never retry an authorization denial. */
export function sessionReadFailure(error: unknown) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {}
  const rawCode = String(value.code ?? "")
  const code = /^[A-Z0-9_]{1,32}$/.test(rawCode) ? rawCode : "UNCLASSIFIED"
  const status = Number(value.status ?? 0)
  const message = String(value.message ?? "").toLowerCase()
  const transient = ![401, 403].includes(status) && (
    [502, 503, 504].includes(status)
    || ["PGRST000", "PGRST001", "PGRST002", "PGRST003", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN"].includes(code)
    || (code === "UNCLASSIFIED" && /^(?:typeerror: )?(?:fetch failed|failed to fetch|network request failed)$/.test(message))
  )
  return { code, transient }
}
