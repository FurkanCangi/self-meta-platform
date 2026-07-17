import "server-only"

import { createHash, createHmac, timingSafeEqual, webcrypto } from "crypto"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const DEVICE_PROOF_VERSION = "p256-v1" as const
export const DEVICE_PROOF_MAX_AGE_SECONDS = 10 * 60
export const DEVICE_POSSESSION_VERSION = "p256-request-v1" as const
export const DEVICE_POSSESSION_MAX_AGE_SECONDS = 45
export const DEVICE_POSSESSION_TOKEN_HEADER = "x-dna-device-proof-token"
export const DEVICE_POSSESSION_SIGNATURE_HEADER = "x-dna-device-proof-signature"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EDUCATION_REQUEST_PATH_PATTERN =
  /^\/api\/education\/videos\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(access|events)$/i

type DeviceProofChallenge = {
  version: typeof DEVICE_PROOF_VERSION
  deviceId: string
  challenge: string
  expiresAt: number
}

type DevicePossessionChallenge = {
  version: typeof DEVICE_POSSESSION_VERSION
  userId: string
  sessionId: string
  deviceId: string
  publicKeyFingerprint: string
  method: "POST"
  path: string
  bodyHash: string
  nonce: string
  issuedAt: number
  expiresAt: number
}

export type SubmittedDeviceProof = {
  identityVersion?: string | null
  publicKeyJwk?: string | null
  publicKeyFingerprint?: string | null
  proofChallengeToken?: string | null
  proofSignature?: string | null
  legacyDeviceId?: string | null
}

export type VerifiedDeviceProof = {
  version: typeof DEVICE_PROOF_VERSION
  publicKeyJwk: JsonWebKey
  publicKeyFingerprint: string
  nonceHash: string
  nonceExpiresAt: string
  legacyDeviceId: string | null
}

function proofSecret() {
  const configured =
    process.env.DEVICE_PROOF_SECRET ||
    process.env.AUTH_STATE_SECRET ||
    process.env.SUPABASE_JWT_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV !== "production") return "dna-local-device-proof-secret"
  throw new Error("DEVICE_PROOF_SECRET is required in production")
}

function sign(payload: string) {
  return createHmac("sha256", proofSecret()).update(payload).digest("base64url")
}

function safeSignatureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function parsePublicKey(value: string): JsonWebKey | null {
  try {
    const parsed = (typeof value === "string" ? JSON.parse(value) : value) as JsonWebKey
    if (
      parsed.kty !== "EC" ||
      parsed.crv !== "P-256" ||
      !parsed.x ||
      !parsed.y ||
      parsed.d ||
      (parsed.key_ops && !parsed.key_ops.includes("verify"))
    ) {
      return null
    }
    return {
      kty: "EC",
      crv: "P-256",
      x: parsed.x,
      y: parsed.y,
      ext: true,
      key_ops: ["verify"],
    }
  } catch {
    return null
  }
}

function parseStoredPublicKey(value: unknown): JsonWebKey | null {
  if (!value) return null
  try {
    return parsePublicKey(typeof value === "string" ? value : JSON.stringify(value))
  } catch {
    return null
  }
}

export function fingerprintPublicKey(publicKey: JsonWebKey) {
  const canonical = JSON.stringify({
    crv: publicKey.crv,
    kty: publicKey.kty,
    x: publicKey.x,
    y: publicKey.y,
  })
  return createHash("sha256").update(canonical).digest("base64url")
}

export function createDeviceProofChallenge(deviceId: string, now = Date.now()) {
  const challenge: DeviceProofChallenge = {
    version: DEVICE_PROOF_VERSION,
    deviceId,
    challenge: crypto.randomUUID(),
    expiresAt: now + DEVICE_PROOF_MAX_AGE_SECONDS * 1000,
  }
  const payload = Buffer.from(JSON.stringify(challenge), "utf8").toString("base64url")
  return {
    challenge: challenge.challenge,
    challengeToken: `${payload}.${sign(payload)}`,
    expiresAt: new Date(challenge.expiresAt).toISOString(),
  }
}

export function normalizeDevicePossessionTarget(method: string, path: string) {
  const normalizedMethod = String(method || "").trim().toUpperCase()
  const normalizedPath = String(path || "").trim()
  if (normalizedMethod !== "POST") return null
  if (
    normalizedPath !== "/api/security/devices" &&
    !EDUCATION_REQUEST_PATH_PATTERN.test(normalizedPath)
  ) {
    return null
  }
  return { method: "POST" as const, path: normalizedPath }
}

function buildDevicePossessionMessage(challenge: DevicePossessionChallenge) {
  return [
    challenge.version,
    challenge.userId,
    challenge.sessionId,
    challenge.deviceId,
    challenge.publicKeyFingerprint,
    challenge.method,
    challenge.path,
    challenge.bodyHash,
    challenge.nonce,
    String(challenge.issuedAt),
    String(challenge.expiresAt),
  ].join("\n")
}

export function createDevicePossessionChallenge(params: {
  userId: string
  sessionId: string
  deviceId: string
  publicKeyFingerprint: string
  method: string
  path: string
  bodyHash: string
  now?: number
}) {
  const target = normalizeDevicePossessionTarget(params.method, params.path)
  if (!target) return null
  if (
    !UUID_PATTERN.test(params.userId) ||
    !UUID_PATTERN.test(params.sessionId) ||
    !UUID_PATTERN.test(params.deviceId) ||
    !params.publicKeyFingerprint ||
    !/^[a-f0-9]{64}$/.test(params.bodyHash)
  ) {
    return null
  }

  const issuedAt = params.now ?? Date.now()
  const challenge: DevicePossessionChallenge = {
    version: DEVICE_POSSESSION_VERSION,
    userId: params.userId,
    sessionId: params.sessionId,
    deviceId: params.deviceId,
    publicKeyFingerprint: params.publicKeyFingerprint,
    method: target.method,
    path: target.path,
    bodyHash: params.bodyHash,
    nonce: crypto.randomUUID(),
    issuedAt,
    expiresAt: issuedAt + DEVICE_POSSESSION_MAX_AGE_SECONDS * 1000,
  }
  const payload = Buffer.from(JSON.stringify(challenge), "utf8").toString("base64url")
  return {
    challenge: buildDevicePossessionMessage(challenge),
    challengeToken: `${payload}.${sign(payload)}`,
    expiresAt: new Date(challenge.expiresAt).toISOString(),
  }
}

function decodeDevicePossessionChallenge(token: string) {
  const [payload, signature, extra] = String(token || "").split(".")
  if (extra || !payload || !signature || !safeSignatureEqual(signature, sign(payload))) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as DevicePossessionChallenge
    const target = normalizeDevicePossessionTarget(parsed.method, parsed.path)
    const now = Date.now()
    if (
      parsed.version !== DEVICE_POSSESSION_VERSION ||
      !UUID_PATTERN.test(parsed.userId || "") ||
      !UUID_PATTERN.test(parsed.sessionId || "") ||
      !UUID_PATTERN.test(parsed.deviceId || "") ||
      !parsed.publicKeyFingerprint ||
      !/^[a-f0-9]{64}$/.test(parsed.bodyHash || "") ||
      !UUID_PATTERN.test(parsed.nonce || "") ||
      !target ||
      parsed.issuedAt > now + 5_000 ||
      parsed.expiresAt <= now ||
      parsed.expiresAt - parsed.issuedAt > DEVICE_POSSESSION_MAX_AGE_SECONDS * 1000
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export type DevicePossessionVerification =
  | { ok: true; mode: "p256" | "legacy" }
  | { ok: false; error: string; status: number }

export async function verifyDevicePossessionForRequest(params: {
  request: Request
  userId: string
  sessionId: string
  deviceId: string
}): Promise<DevicePossessionVerification> {
  const target = normalizeDevicePossessionTarget(
    params.request.method,
    new URL(params.request.url).pathname
  )
  if (!target) return { ok: false, error: "device_possession_target_invalid", status: 400 }

  const admin = createSupabaseAdminClient()
  const { data: device, error: deviceError } = await admin
    .from("account_devices")
    .select(
      "id, verification_method, public_key_jwk, public_key_fingerprint, revoked_at, verification_required, verified_at"
    )
    .eq("id", params.deviceId)
    .eq("user_id", params.userId)
    .maybeSingle()
  if (deviceError) return { ok: false, error: "device_possession_lookup_failed", status: 500 }
  if (
    !device ||
    device.revoked_at ||
    device.verification_required !== false ||
    !device.verified_at
  ) {
    return { ok: false, error: "device_not_trusted", status: 403 }
  }

  if (device.verification_method !== "p256_v1") return { ok: true, mode: "legacy" }

  const token = String(params.request.headers.get(DEVICE_POSSESSION_TOKEN_HEADER) || "")
  const signature = String(params.request.headers.get(DEVICE_POSSESSION_SIGNATURE_HEADER) || "")
  if (!token || !signature) {
    return { ok: false, error: "device_possession_proof_required", status: 403 }
  }

  const challenge = decodeDevicePossessionChallenge(token)
  if (!challenge) {
    return { ok: false, error: "device_possession_challenge_invalid", status: 403 }
  }
  if (
    challenge.userId !== params.userId ||
    challenge.sessionId !== params.sessionId ||
    challenge.deviceId !== params.deviceId ||
    challenge.method !== target.method ||
    challenge.path !== target.path ||
    challenge.publicKeyFingerprint !== device.public_key_fingerprint
  ) {
    return { ok: false, error: "device_possession_binding_mismatch", status: 403 }
  }

  const requestBodyHash = createHash("sha256")
    .update(await params.request.clone().text())
    .digest("hex")
  if (challenge.bodyHash !== requestBodyHash) {
    return { ok: false, error: "device_possession_body_mismatch", status: 403 }
  }

  const publicKey = parseStoredPublicKey(device.public_key_jwk)
  if (
    !publicKey ||
    !device.public_key_fingerprint ||
    fingerprintPublicKey(publicKey) !== device.public_key_fingerprint
  ) {
    return { ok: false, error: "device_possession_key_invalid", status: 403 }
  }

  try {
    const key = await webcrypto.subtle.importKey(
      "jwk",
      publicKey as globalThis.JsonWebKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    )
    const verified = await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      Buffer.from(signature, "base64url"),
      Buffer.from(buildDevicePossessionMessage(challenge), "utf8")
    )
    if (!verified) return { ok: false, error: "device_possession_proof_invalid", status: 403 }
  } catch {
    return { ok: false, error: "device_possession_proof_invalid", status: 403 }
  }

  const nonceHash = createHash("sha256")
    .update(`device-possession:${challenge.nonce}`)
    .digest("hex")
  const { error: cleanupError } = await admin
    .from("account_device_proof_nonces")
    .delete()
    .eq("user_id", params.userId)
    .lt("expires_at", new Date().toISOString())
  if (cleanupError) {
    return { ok: false, error: "device_possession_proof_cleanup_failed", status: 500 }
  }
  const { error: nonceError } = await admin.from("account_device_proof_nonces").insert({
    nonce_hash: nonceHash,
    user_id: params.userId,
    device_fingerprint: device.public_key_fingerprint,
    expires_at: new Date(challenge.expiresAt).toISOString(),
  })
  if (nonceError) {
    return String((nonceError as { code?: string }).code || "") === "23505"
      ? { ok: false, error: "device_possession_proof_replayed", status: 409 }
      : { ok: false, error: "device_possession_proof_store_failed", status: 500 }
  }

  return { ok: true, mode: "p256" }
}

function decodeChallenge(token: string, expectedDeviceId: string): DeviceProofChallenge | null {
  const [payload, signature] = token.split(".")
  if (!payload || !signature || !safeSignatureEqual(signature, sign(payload))) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DeviceProofChallenge
    if (
      parsed.version !== DEVICE_PROOF_VERSION ||
      parsed.deviceId !== expectedDeviceId ||
      !parsed.challenge ||
      !parsed.expiresAt ||
      parsed.expiresAt <= Date.now()
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function verifySubmittedDeviceProof(
  deviceId: string,
  submitted: SubmittedDeviceProof
): Promise<{ ok: true; proof: VerifiedDeviceProof } | { ok: false; error: string }> {
  if (submitted.identityVersion !== DEVICE_PROOF_VERSION) {
    return { ok: false, error: "device_proof_required" }
  }

  const publicKey = parsePublicKey(String(submitted.publicKeyJwk || ""))
  const fingerprint = String(submitted.publicKeyFingerprint || "")
  const signature = String(submitted.proofSignature || "")
  const challengeToken = String(submitted.proofChallengeToken || "")
  if (!publicKey || !fingerprint || !signature || !challengeToken) {
    return { ok: false, error: "device_proof_invalid" }
  }

  const expectedFingerprint = fingerprintPublicKey(publicKey)
  if (fingerprint !== expectedFingerprint || deviceId !== `p256-${fingerprint}`) {
    return { ok: false, error: "device_proof_fingerprint_mismatch" }
  }

  const challenge = decodeChallenge(challengeToken, deviceId)
  if (!challenge) return { ok: false, error: "device_proof_challenge_expired" }

  try {
    const key = await webcrypto.subtle.importKey(
      "jwk",
      publicKey as globalThis.JsonWebKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    )
    const verified = await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      Buffer.from(signature, "base64url"),
      Buffer.from(challenge.challenge, "utf8")
    )
    if (!verified) return { ok: false, error: "device_proof_invalid" }
  } catch {
    return { ok: false, error: "device_proof_invalid" }
  }

  const legacyDeviceId = String(submitted.legacyDeviceId || "").trim()
  return {
    ok: true,
    proof: {
      version: DEVICE_PROOF_VERSION,
      publicKeyJwk: publicKey,
      publicKeyFingerprint: fingerprint,
      nonceHash: createHash("sha256").update(challenge.challenge).digest("hex"),
      nonceExpiresAt: new Date(challenge.expiresAt).toISOString(),
      legacyDeviceId:
        legacyDeviceId.length >= 16 && legacyDeviceId.length <= 200 ? legacyDeviceId : null,
    },
  }
}
