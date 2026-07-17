import "server-only"

import { createHmac, timingSafeEqual } from "crypto"

export const GOOGLE_OAUTH_STATE_COOKIE = "dna_google_oauth_state"
export const GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60

export type GoogleOAuthMode = "signup" | "login"

export type GoogleOAuthState = {
  mode: GoogleOAuthMode
  nextPath: string
  surface: "web" | "app"
  deviceId: string
  deviceType: "desktop" | "mobile" | "tablet" | "unknown"
  identityVersion: "p256-v1" | "legacy-session"
  publicKeyJwk: string
  publicKeyFingerprint: string
  proofChallengeToken: string
  proofSignature: string
  legacyDeviceId: string
  legalAccepted: boolean
  createdAt: number
  nonce: string
}

function stateSecret() {
  if (process.env.AUTH_STATE_SECRET) return process.env.AUTH_STATE_SECRET
  if (process.env.NODE_ENV !== "production") return "dna-google-oauth-dev-secret"
  throw new Error("AUTH_STATE_SECRET is required in production")
}

function sign(payload: string) {
  return createHmac("sha256", stateSecret()).update(payload).digest("base64url")
}

export function encodeGoogleOAuthState(state: GoogleOAuthState) {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function decodeGoogleOAuthState(value?: string | null): GoogleOAuthState | null {
  if (!value) return null

  const [payload, signature] = value.split(".")
  if (!payload || !signature) return null

  const expected = sign(payload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleOAuthState
    if (parsed.mode !== "signup" && parsed.mode !== "login") return null
    if (parsed.surface !== "web" && parsed.surface !== "app") return null
    if (!parsed.deviceId || parsed.deviceId.length < 16 || parsed.deviceId.length > 200) return null
    if (parsed.identityVersion !== "p256-v1" && parsed.identityVersion !== "legacy-session") return null
    if (String(parsed.publicKeyJwk || "").length > 2000) return null
    if (String(parsed.proofChallengeToken || "").length > 3000) return null
    if (String(parsed.proofSignature || "").length > 1000) return null
    if (!parsed.createdAt || Date.now() - parsed.createdAt > GOOGLE_OAUTH_STATE_MAX_AGE_SECONDS * 1000) return null
    return parsed
  } catch {
    return null
  }
}
