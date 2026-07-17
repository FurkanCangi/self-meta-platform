import "server-only"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function extractSupabaseAuthSessionId(accessToken: string | null | undefined) {
  const [, payload] = String(accessToken || "").split(".")
  if (!payload) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      session_id?: unknown
    }
    const sessionId = String(claims.session_id || "")
    return UUID_PATTERN.test(sessionId) ? sessionId : null
  } catch {
    return null
  }
}
