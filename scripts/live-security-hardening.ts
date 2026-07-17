import fs from "node:fs"
import path from "node:path"
import { createHash, randomBytes, webcrypto } from "node:crypto"
import { createServerClient } from "@supabase/ssr"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

type JsonObject = Record<string, unknown>

type StepResult = {
  name: string
  ok: boolean
  detail?: string
  ms: number
}

type Config = {
  targetUrl: string
  supabaseUrl: string
  anonKey: string
  serviceKey: string
  httpTimeoutMs: number
}

type AuthContext = {
  client: SupabaseClient
  cookies: Map<string, string>
  accessToken: string
  label: string
  credential?: DeviceCredential
}

type DeviceCredential = {
  deviceId: string
  publicKeyJwk: string
  publicKeyFingerprint: string
  privateKey: CryptoKey
  legacyDeviceId: string
  label: string
}

type DeviceRegistration = {
  statusCode: number
  payload: JsonObject
}

type ActiveDeviceRegistration = {
  sessionId: string
  deviceId: string
}

type ApprovalRegistration = {
  challengeId: string
  verificationCode: string
  deviceId: string
}

type PlaybackContext = {
  tokenId: string
  appSessionId: string
  deviceId: string
  playerSessionId: string
  watermarkCode: string
}

type HttpPlaybackAccess = {
  token: string
  leaseId: string
  playerSessionId: string
  signedUrl: string | null
}

const root = process.cwd()
const runId = `live-security-${Date.now()}-${randomBytes(4).toString("hex")}`
const confirmationPhrase = "RUN_AUTO_CLEAN_SECURITY_E2E"
const educationBucket = "education-videos"
// Deterministic 2-second, 160x90, silent black H.264 MP4 generated once with
// ffmpeg. The live runner has no ffmpeg dependency.
const twoSecondCanaryMp4Base64 =
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAANlbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAApB0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAABaAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAABAAAABAAAAAAIIbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAoABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABs21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAXNzdGJsAAAAw3N0c2QAAAAAAAAAAQAAALNhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAWgBIAAAASAAAAAAAAAABFUxhdmM2Mi4xMS4xMDAgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAAOWF2Y0MBZAAM/+EAG2dkAAyscgRCjfkwEQAAAwABAAADAAQPFCmEYAEAB2joQ4OSyLD9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAADCgAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAAQAACAAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAAAoY3R0cwAAAAAAAAADAAAAAQAAQAAAAAABAACAAAAAAAIAACAAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAEAAAAAQAAACRzdHN6AAAAAAAAAAAAAAAEAAAC4QAAAA8AAAANAAAADQAAABRzdGNvAAAAAAAAAAEAAAOVAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2Mi4zLjEwMAAAAAhmcmVlAAADEm1kYXQAAAKvBgX//6vcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIyIGIzNTYwNWEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MTYgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDEzMyBtZT11bWggc3VibWU9MTAgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0yNCBjaHJvbWFfbWU9MSB0cmVsbGlzPTIgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0zIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9OCBiX3B5cmFtaWQ9MiBiX2FkYXB0PTIgYl9iaWFzPTAgZGlyZWN0PTMgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NjAgcmM9Y3JmIG1idHJlZT0xIGNyZj00MC4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAKmWIgQACv/7x3PApmuW9kx2SEijtYRhhLEgd5XYyVpfSZwDICvAA1Ajt6QAAAAtBmghtiCX/AACbgAAAAAlBnhAnEE//B/UAAAAJAZ4YTUgl/wl4"
const steps: StepResult[] = []
const cleanupErrors: string[] = []
const createdUserIds = new Set<string>()

let config: Config | null = null
let admin: SupabaseClient | null = null
let signupEmail: string | null = null
let assetId: string | null = null
let storagePath: string | null = null

function loadDotEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const separator = line.indexOf("=")
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function loadConfig(): Config {
  loadDotEnvFile(path.join(root, ".env.local"))
  loadDotEnvFile(path.join(root, ".env"))

  if (process.env.LIVE_SECURITY_CONFIRM !== confirmationPhrase) {
    throw new Error(
      `Refusing to run. Set LIVE_SECURITY_CONFIRM=${confirmationPhrase} after reviewing the target.`
    )
  }

  const rawTarget = String(process.env.LIVE_SECURITY_TARGET_URL || "").trim()
  if (!rawTarget) throw new Error("LIVE_SECURITY_TARGET_URL is required; there is no production default.")

  let parsedTarget: URL
  try {
    parsedTarget = new URL(rawTarget)
  } catch {
    throw new Error("LIVE_SECURITY_TARGET_URL must be an absolute URL.")
  }
  const isLocalTarget = parsedTarget.hostname === "localhost" || parsedTarget.hostname === "127.0.0.1"
  if (parsedTarget.protocol !== "https:" && !(isLocalTarget && parsedTarget.protocol === "http:")) {
    throw new Error("LIVE_SECURITY_TARGET_URL must use HTTPS, except for localhost.")
  }
  if (parsedTarget.username || parsedTarget.password) {
    throw new Error("Credentials must not be embedded in LIVE_SECURITY_TARGET_URL.")
  }

  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  const anonKey = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()
  if (!supabaseUrl || !anonKey || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required."
    )
  }

  return {
    targetUrl: parsedTarget.toString().replace(/\/+$/, ""),
    supabaseUrl,
    anonKey,
    serviceKey,
    httpTimeoutMs: 45_000,
  }
}

function redact(message: string) {
  let sanitized = message
  for (const secret of [config?.serviceKey, config?.anonKey]) {
    if (secret && secret.length >= 8) sanitized = sanitized.split(secret).join("[redacted]")
  }
  return sanitized
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
}

function errorMessage(error: unknown) {
  const value = error instanceof Error ? error.message : String(error)
  return redact(value).slice(0, 800)
}

function failIfError(label: string, error: unknown) {
  if (!error) return
  const row = error as { message?: string; code?: string }
  const detail = row.message || String(error)
  throw new Error(`${label}${row.code ? ` (${row.code})` : ""}: ${detail}`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function asString(value: unknown) {
  return typeof value === "string" && value ? value : ""
}

async function step<T>(name: string, fn: () => Promise<{ value: T; detail?: string }>): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await fn()
    steps.push({ name, ok: true, ...(result.detail ? { detail: result.detail } : {}), ms: Date.now() - startedAt })
    return result.value
  } catch (error) {
    steps.push({ name, ok: false, detail: errorMessage(error), ms: Date.now() - startedAt })
    throw error
  }
}

async function fetchTarget(relativePath: string, init: RequestInit = {}) {
  assert(config, "configuration missing")
  return fetch(`${config.targetUrl}${relativePath}`, {
    ...init,
    signal: init.signal || AbortSignal.timeout(config.httpTimeoutMs),
  })
}

async function readJson(response: Response) {
  return asObject(await response.json().catch(() => null))
}

function cookieHeader(cookies: Map<string, string>) {
  return [...cookies.entries()]
    .filter(([, value]) => value !== "")
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}

function splitSetCookieHeader(value: string) {
  return value.split(/,(?=[^;,=\s]+=[^;,]*)/g)
}

function captureResponseCookies(response: Response, jar: Map<string, string>) {
  const cookieHeaders = response.headers as Headers & { getSetCookie?: () => string[] }
  let values = typeof cookieHeaders.getSetCookie === "function" ? cookieHeaders.getSetCookie() : []
  if (values.length === 0) {
    const combined = response.headers.get("set-cookie")
    if (combined) values = splitSetCookieHeader(combined)
  }
  for (const rawCookie of values) {
    const pair = rawCookie.split(";", 1)[0] || ""
    const separator = pair.indexOf("=")
    if (separator <= 0) continue
    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1)
    if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(rawCookie)) jar.delete(name)
    else jar.set(name, value)
  }
}

function requestHeaders(context: AuthContext, suffix: string, contentType = true) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${context.accessToken}`,
    cookie: cookieHeader(context.cookies),
    "x-dna-request": "same-origin",
    "user-agent": `SelfMetaSecurityCanary/${runId}/${context.label}/${suffix}`,
  }
  if (contentType) headers["content-type"] = "application/json"
  return headers
}

async function createConfirmedUser(label: string) {
  assert(admin, "admin client missing")
  const email = `${runId}-${label}@example.invalid`
  const password = `T-${randomBytes(24).toString("base64url")}aA1!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { test_automation: runId, purpose: "security_hardening_e2e" },
  })
  failIfError("confirmed auth user creation failed", error)
  assert(data.user?.id, "confirmed auth user id missing")
  createdUserIds.add(data.user.id)
  const profile = await admin.from("profiles").upsert(
    {
      user_id: data.user.id,
      role: "expert",
      plan: "none",
      full_name: `TEST AUTOMATION ${label}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  failIfError("temporary profile creation failed", profile.error)
  return { userId: data.user.id, email, password }
}

async function createAuthContext(email: string, password: string, label: string): Promise<AuthContext> {
  assert(config, "configuration missing")
  const jar = new Map<string, string>()
  const client = createServerClient(config.supabaseUrl, config.anonKey, {
    cookies: {
      getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          if (cookie.value) jar.set(cookie.name, cookie.value)
          else jar.delete(cookie.name)
        }
      },
    },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  failIfError("temporary user sign-in failed", error)
  assert(data.session?.access_token, "temporary user access token missing")
  return { client, cookies: jar, accessToken: data.session.access_token, label }
}

async function createDeviceCredential(label: string): Promise<DeviceCredential> {
  const pair = (await webcrypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  )) as CryptoKeyPair
  const publicKey = await webcrypto.subtle.exportKey("jwk", pair.publicKey)
  const canonical = JSON.stringify({
    crv: publicKey.crv,
    kty: publicKey.kty,
    x: publicKey.x,
    y: publicKey.y,
  })
  const fingerprint = createHash("sha256").update(canonical).digest("base64url")
  return {
    deviceId: `p256-${fingerprint}`,
    publicKeyJwk: JSON.stringify(publicKey),
    publicKeyFingerprint: fingerprint,
    privateKey: pair.privateKey,
    legacyDeviceId: `live-security-legacy-${runId}-${label}`,
    label,
  }
}

async function createDeviceProof(credential: DeviceCredential, context: AuthContext) {
  const challengeResponse = await fetchTarget("/api/security/device-proof/challenge", {
    method: "POST",
    headers: requestHeaders(context, `${credential.label}-challenge`),
    body: JSON.stringify({ deviceId: credential.deviceId }),
  })
  const challengePayload = await readJson(challengeResponse)
  assert(
    challengeResponse.status === 200 && challengePayload.ok === true,
    `device proof challenge failed with HTTP ${challengeResponse.status}: ${asString(challengePayload.error) || "invalid_response"}`
  )
  const challenge = asString(challengePayload.challenge)
  const challengeToken = asString(challengePayload.challengeToken)
  assert(challenge && challengeToken, "device proof challenge fields missing")
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    credential.privateKey,
    Buffer.from(challenge, "utf8")
  )
  return {
    deviceId: credential.deviceId,
    deviceType: "desktop",
    identityVersion: "p256-v1",
    publicKeyJwk: credential.publicKeyJwk,
    publicKeyFingerprint: credential.publicKeyFingerprint,
    proofChallengeToken: challengeToken,
    proofSignature: Buffer.from(signature).toString("base64url"),
    legacyDeviceId: credential.legacyDeviceId,
  }
}

async function createRequestPossessionHeaders(
  context: AuthContext,
  requestPath: string,
  serializedBody: string
): Promise<Record<string, string>> {
  const challengeResponse = await fetchTarget("/api/security/device-proof/challenge", {
    method: "POST",
    headers: requestHeaders(context, "request-possession-challenge"),
    body: JSON.stringify({
      method: "POST",
      path: requestPath,
      bodyHash: createHash("sha256").update(serializedBody).digest("hex"),
    }),
  })
  const challengePayload = await readJson(challengeResponse)
  assert(
    challengeResponse.status === 200 && challengePayload.ok === true,
    `request possession challenge failed with HTTP ${challengeResponse.status}: ${asString(challengePayload.error) || "invalid_response"}`
  )
  if (challengePayload.required === false) return {}

  const credential = context.credential
  assert(credential?.privateKey, `request possession key missing for ${context.label}`)
  const challenge = asString(challengePayload.challenge)
  const challengeToken = asString(challengePayload.challengeToken)
  assert(challenge && challengeToken, "request possession challenge fields missing")
  const signature = await webcrypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    credential.privateKey,
    Buffer.from(challenge, "utf8")
  )
  return {
    "x-dna-device-proof-token": challengeToken,
    "x-dna-device-proof-signature": Buffer.from(signature).toString("base64url"),
  }
}

async function registerDevice(context: AuthContext, credential: DeviceCredential): Promise<DeviceRegistration> {
  const proof = await createDeviceProof(credential, context)
  const response = await fetchTarget("/api/security/session/register", {
    method: "POST",
    headers: requestHeaders(context, `${credential.label}-register`),
    body: JSON.stringify(proof),
  })
  captureResponseCookies(response, context.cookies)
  const payload = await readJson(response)
  if (payload.ok === true && (payload.status === "active" || payload.status === "approval_required")) {
    context.credential = credential
  }
  return { statusCode: response.status, payload }
}

function expectActiveRegistration(result: DeviceRegistration): ActiveDeviceRegistration {
  const sessionId = asString(result.payload.sessionId)
  const deviceId = asString(result.payload.deviceId)
  assert(
    result.statusCode === 200 && result.payload.ok === true && result.payload.status === "active" && sessionId && deviceId,
    `expected active device registration, got HTTP ${result.statusCode}: ${asString(result.payload.error) || "invalid_response"}`
  )
  return { sessionId, deviceId }
}

function expectApprovalRegistration(result: DeviceRegistration): ApprovalRegistration {
  const challengeId = asString(result.payload.challengeId)
  const verificationCode = asString(result.payload.verificationCode)
  const deviceId = asString(result.payload.deviceId)
  assert(
    result.statusCode === 202 &&
      result.payload.ok === true &&
      result.payload.status === "approval_required" &&
      challengeId &&
      /^\d{6}$/.test(verificationCode) &&
      deviceId,
    `expected approval_required, got HTTP ${result.statusCode}: ${asString(result.payload.error) || "invalid_response"}`
  )
  return { challengeId, verificationCode, deviceId }
}

function rpcRow(data: unknown) {
  return Array.isArray(data) ? asObject(data[0]) : asObject(data)
}

async function approveDevice(
  pending: ApprovalRegistration,
  approverContext: AuthContext,
  verifyWrongCode = false
) {
  if (verifyWrongCode) {
    const wrongCode = pending.verificationCode === "000000" ? "000001" : "000000"
    const wrong = await postDeviceAction(approverContext, {
      action: "approve",
      challengeId: pending.challengeId,
      code: wrongCode,
    })
    assert(
      wrong.statusCode === 400 && wrong.payload.error === "invalid_code",
      `wrong approval code was not rejected by the device API: HTTP ${wrong.statusCode}`
    )
  }

  const approved = await postDeviceAction(approverContext, {
    action: "approve",
    challengeId: pending.challengeId,
    code: pending.verificationCode,
  })
  assert(
    approved.statusCode === 200 && approved.payload.ok === true && approved.payload.status === "approved",
    `device approval API returned HTTP ${approved.statusCode}: ${asString(approved.payload.error) || "invalid_response"}`
  )
}

async function registerApprovedDevice(params: {
  context: AuthContext
  credential: DeviceCredential
  approverContext: AuthContext
  verifyWrongCode?: boolean
}) {
  const pending = expectApprovalRegistration(await registerDevice(params.context, params.credential))
  const [pendingSessionRead, pendingDeviceRead] = await Promise.all([
    params.context.client.from("account_sessions").select("id").limit(1),
    params.context.client.from("account_devices").select("id").limit(1),
  ])
  assertDirectReadDenied(pendingSessionRead, "pending context read account_sessions")
  assertDirectReadDenied(pendingDeviceRead, "pending context read account_devices")
  const pendingGlobalLogout = await postSessionLogout(params.context, "global")
  assert(
    pendingGlobalLogout.statusCode === 401,
    `pending context global logout returned HTTP ${pendingGlobalLogout.statusCode}`
  )
  await approveDevice(pending, params.approverContext, params.verifyWrongCode)
  return expectActiveRegistration(await registerDevice(params.context, params.credential))
}

async function postDeviceAction(context: AuthContext, body: JsonObject) {
  const path = "/api/security/devices"
  const serializedBody = JSON.stringify(body)
  const possessionHeaders = await createRequestPossessionHeaders(context, path, serializedBody)
  const response = await fetchTarget(path, {
    method: "POST",
    headers: {
      ...requestHeaders(context, "device-action"),
      ...possessionHeaders,
    },
    body: serializedBody,
  })
  return { statusCode: response.status, payload: await readJson(response) }
}

function assertDirectReadDenied(
  result: { data: unknown[] | null; error: unknown },
  label: string
) {
  assert(Boolean(result.error) || (result.data || []).length === 0, `${label} unexpectedly returned rows`)
}

async function postSessionLogout(context: AuthContext, scope: "local" | "global") {
  const response = await fetchTarget("/api/security/session/logout", {
    method: "POST",
    headers: requestHeaders(context, `session-logout-${scope}`),
    body: JSON.stringify({ scope }),
  })
  return { statusCode: response.status, payload: await readJson(response) }
}

async function getDevices(context: AuthContext) {
  const response = await fetchTarget("/api/security/devices", {
    method: "GET",
    headers: requestHeaders(context, "device-list", false),
  })
  const payload = await readJson(response)
  assert(response.status === 200 && payload.ok === true, `device list failed with HTTP ${response.status}`)
  return payload
}

async function insertPlaybackToken(
  userId: string,
  videoId: string,
  context: Omit<PlaybackContext, "tokenId">
): Promise<PlaybackContext> {
  assert(admin, "admin client missing")
  const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex")
  const { data, error } = await admin
    .from("education_video_access_tokens")
    .insert({
      user_id: userId,
      video_id: videoId,
      token_hash: tokenHash,
      watermark_code: context.watermarkCode,
      app_session_id: context.appSessionId,
      device_id: context.deviceId,
      player_session_id: context.playerSessionId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single()
  failIfError("playback token insertion failed", error)
  assert(data?.id, "playback token id missing")
  return { ...context, tokenId: String(data.id) }
}

function claimParams(userId: string, videoId: string, playback: PlaybackContext, force: boolean) {
  return {
    p_user_id: userId,
    p_video_id: videoId,
    p_token_id: playback.tokenId,
    p_app_session_id: playback.appSessionId,
    p_device_id: playback.deviceId,
    p_player_session_id: playback.playerSessionId,
    p_force: force,
    p_ttl_seconds: 90,
    p_watermark_code: playback.watermarkCode,
    p_ip_address: null,
    p_user_agent: `SelfMetaSecurityCanary/${runId}/rpc`,
  }
}

async function claimPlayback(userId: string, videoId: string, playback: PlaybackContext, force = false) {
  assert(admin, "admin client missing")
  const result = await admin.rpc(
    "claim_education_video_playback",
    claimParams(userId, videoId, playback, force)
  )
  failIfError("playback claim RPC failed", result.error)
  return asObject(result.data)
}

async function touchPlayback(userId: string, videoId: string, playback: PlaybackContext, leaseId: string) {
  assert(admin, "admin client missing")
  const result = await admin.rpc("touch_education_video_playback", {
    p_user_id: userId,
    p_video_id: videoId,
    p_token_id: playback.tokenId,
    p_lease_id: leaseId,
    p_app_session_id: playback.appSessionId,
    p_device_id: playback.deviceId,
    p_player_session_id: playback.playerSessionId,
    p_ttl_seconds: 90,
  })
  failIfError("playback touch RPC failed", result.error)
  return asObject(result.data)
}

async function releasePlayback(userId: string, playback: PlaybackContext, leaseId: string) {
  assert(admin, "admin client missing")
  const result = await admin.rpc("release_education_video_playback", {
    p_user_id: userId,
    p_token_id: playback.tokenId,
    p_lease_id: leaseId,
    p_app_session_id: playback.appSessionId,
    p_device_id: playback.deviceId,
    p_player_session_id: playback.playerSessionId,
    p_reason: "live_security_canary_complete",
  })
  failIfError("playback release RPC failed", result.error)
  return asObject(result.data)
}

async function requestVideoAccess(
  context: AuthContext,
  videoId: string,
  playerSessionId: string,
  takeover: boolean
) {
  const path = `/api/education/videos/${encodeURIComponent(videoId)}/access`
  const serializedBody = JSON.stringify({ playerSessionId, takeover })
  const possessionHeaders = await createRequestPossessionHeaders(context, path, serializedBody)
  const response = await fetchTarget(path, {
    method: "POST",
    headers: {
      ...requestHeaders(context, `video-access-${takeover ? "takeover" : "normal"}`),
      ...possessionHeaders,
    },
    body: serializedBody,
  })
  return { statusCode: response.status, payload: await readJson(response) }
}

function expectHttpPlayback(result: { statusCode: number; payload: JsonObject }): HttpPlaybackAccess {
  const access = asObject(result.payload.access)
  const token = asString(access.token)
  const leaseId = asString(access.leaseId)
  const playerSessionId = asString(access.playerSessionId)
  const signedUrl = asString(access.signedUrl) || null
  assert(
    result.statusCode === 200 && result.payload.ok === true && token && leaseId && playerSessionId,
    `video access failed with HTTP ${result.statusCode}: ${asString(result.payload.error) || "invalid_response"}`
  )
  return { token, leaseId, playerSessionId, signedUrl }
}

async function postVideoEvent(
  context: AuthContext,
  videoId: string,
  playback: HttpPlaybackAccess,
  eventType: "heartbeat" | "release",
  options: { skipPossessionProof?: boolean } = {}
) {
  const path = `/api/education/videos/${encodeURIComponent(videoId)}/events`
  const serializedBody = JSON.stringify({
    eventType,
    accessToken: playback.token,
    leaseId: playback.leaseId,
    playerSessionId: playback.playerSessionId,
    playbackSeconds: 1,
    durationSeconds: 2,
  })
  const possessionHeaders = eventType === "release" || options.skipPossessionProof
    ? {}
    : await createRequestPossessionHeaders(context, path, serializedBody)
  const response = await fetchTarget(path, {
    method: "POST",
    headers: {
      ...requestHeaders(context, `video-event-${eventType}`),
      ...possessionHeaders,
    },
    body: serializedBody,
  })
  return { statusCode: response.status, payload: await readJson(response) }
}

async function findAuthUserIdByEmail(email: string) {
  assert(admin, "admin client missing")
  const perPage = 200
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    failIfError("temporary signup user lookup failed", error)
    const found = data.users.find((user) => String(user.email || "").toLowerCase() === email.toLowerCase())
    if (found?.id) return found.id
    if (data.users.length < perPage) break
  }
  return null
}

async function findSignupUserId(email: string) {
  assert(admin, "admin client missing")
  const legalAcceptance = await admin
    .from("legal_acceptances")
    .select("user_id")
    .eq("email", email)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!legalAcceptance.error && legalAcceptance.data?.user_id) {
    return String(legalAcceptance.data.user_id)
  }
  return findAuthUserIdByEmail(email)
}

async function safeCleanup(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (error) {
    cleanupErrors.push(`${label}: ${errorMessage(error)}`)
  }
}

async function cleanup() {
  if (!admin) return

  if (signupEmail) {
    await safeCleanup("signup user lookup", async () => {
      const signupUserId = await findSignupUserId(signupEmail!)
      if (signupUserId) createdUserIds.add(signupUserId)
    })
  }

  const userIds = [...createdUserIds]
  const deleteUsersFromTable = async (table: string, column = "user_id") => {
    if (userIds.length === 0) return
    const { error } = await admin!.from(table).delete().in(column, userIds)
    failIfError(`${table} cleanup failed`, error)
  }

  await safeCleanup("clients", () => deleteUsersFromTable("clients", "owner_id"))

  for (const table of [
    "education_video_access_logs",
    "education_video_playback_sessions",
    "education_video_playback_leases",
    "education_video_access_tokens",
    "user_entitlements",
    "account_device_verification_challenges",
    "account_device_changes",
    "account_device_proof_nonces",
    "account_security_events",
    "account_sessions",
    "account_devices",
    "account_security_state",
    "legal_acceptances",
    "profiles",
  ]) {
    await safeCleanup(table, () => deleteUsersFromTable(table))
  }

  if (assetId) {
    await safeCleanup("education video asset", async () => {
      const { error } = await admin!.from("education_video_assets").delete().eq("id", assetId!)
      failIfError("education video asset cleanup failed", error)
    })
  }
  if (storagePath) {
    await safeCleanup("education video object", async () => {
      const { error } = await admin!.storage.from(educationBucket).remove([storagePath!])
      failIfError("education video object cleanup failed", error)
    })
  }

  if (userIds.length > 0) {
    await safeCleanup("api rate limits", async () => {
      const exactKeys = userIds.flatMap((userId) => [
        `education-video-access:${userId}`,
        `education-video-events:${userId}`,
      ])
      const { error } = await admin!.from("api_rate_limits").delete().in("key", exactKeys)
      failIfError("user api rate-limit cleanup failed", error)
      const runResult = await admin!.from("api_rate_limits").delete().ilike("key", `%${runId}%`)
      failIfError("canary api rate-limit cleanup failed", runResult.error)
    })
  }

  for (const userId of userIds) {
    await safeCleanup("temporary auth user", async () => {
      const { error } = await admin!.auth.admin.deleteUser(userId)
      failIfError("temporary auth user cleanup failed", error)
    })
  }

  for (const table of [
    "education_video_access_logs",
    "education_video_playback_sessions",
    "education_video_playback_leases",
    "education_video_access_tokens",
    "account_device_verification_challenges",
    "account_device_changes",
    "account_device_proof_nonces",
    "account_security_events",
    "account_sessions",
    "account_devices",
    "account_security_state",
    "legal_acceptances",
    "profiles",
  ]) {
    await safeCleanup(`${table} zero verification`, async () => {
      const { count, error } = await admin!
        .from(table)
        .select("*", { count: "exact", head: true })
        .in("user_id", userIds)
      failIfError(`${table} zero verification failed`, error)
      assert(count === 0, `${table} cleanup left ${count} canary rows`)
    })
  }
  await safeCleanup("clients zero verification", async () => {
    const { count, error } = await admin!
      .from("clients")
      .select("*", { count: "exact", head: true })
      .in("owner_id", userIds)
    failIfError("clients zero verification failed", error)
    assert(count === 0, `clients cleanup left ${count} canary rows`)
  })
}

async function run() {
  config = loadConfig()
  admin = createClient(config.supabaseUrl, config.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await step("target and security schema preflight", async () => {
    const response = await fetchTarget("/", { method: "GET", redirect: "manual" })
    assert(response.status >= 200 && response.status < 500, `target returned HTTP ${response.status}`)

    const requiredTables = [
      "account_devices",
      "account_sessions",
      "account_device_verification_challenges",
      "account_device_changes",
      "account_device_proof_nonces",
      "education_video_assets",
      "education_video_access_tokens",
      "education_video_playback_sessions",
      "education_video_playback_leases",
      "user_entitlements",
    ]
    for (const table of requiredTables) {
      const { error } = await admin!.from(table).select("*").limit(1)
      failIfError(`${table} preflight failed`, error)
    }

    const { data: buckets, error: bucketError } = await admin!.storage.listBuckets()
    failIfError("storage bucket preflight failed", bucketError)
    assert(buckets?.some((bucket) => bucket.name === educationBucket), `${educationBucket} bucket missing`)

    const zero = "00000000-0000-4000-8000-000000000000"
    const claim = await admin!.rpc("claim_education_video_playback", {
      p_user_id: zero,
      p_video_id: zero,
      p_token_id: zero,
      p_app_session_id: zero,
      p_device_id: zero,
      p_player_session_id: "preflight",
      p_force: false,
      p_ttl_seconds: 90,
      p_watermark_code: null,
      p_ip_address: null,
      p_user_agent: null,
    })
    failIfError("playback claim RPC preflight failed", claim.error)
    assert(asObject(claim.data).ok === false, "playback claim RPC returned an invalid preflight response")

    const approval = await admin!.rpc("approve_account_device_challenge", {
      p_user_id: zero,
      p_challenge_id: zero,
      p_code_hash: createHash("sha256").update(runId).digest("hex"),
      p_approver_device_id: zero,
    })
    failIfError("device approval RPC preflight failed", approval.error)
    assert(rpcRow(approval.data).result === "approver_not_trusted", "device approval RPC preflight response invalid")
    return { value: undefined, detail: `${requiredTables.length} tables, 2 RPCs, private bucket` }
  })

  await step("public signup form reaches the live backend", async () => {
    signupEmail = `${runId}-public-signup@example.invalid`
    const signupPassword = `S-${randomBytes(24).toString("base64url")}aA1!`
    const form = new FormData()
    form.set("fullName", "TEST AUTOMATION Security Canary")
    form.set("email", signupEmail)
    form.set("password", signupPassword)
    form.set("confirmPassword", signupPassword)
    form.set("terms", "on")
    form.set("kvkk", "on")
    form.set("consent", "on")
    form.set("authority", "on")
    const response = await fetchTarget("/api/auth/signup", {
      method: "POST",
      headers: {
        "x-dna-request": "same-origin",
        "user-agent": `SelfMetaSecurityCanary/${runId}/public-signup`,
      },
      body: form,
      redirect: "manual",
    })
    assert(response.status === 303, `signup form returned HTTP ${response.status}`)
    const location = response.headers.get("location")
    assert(location, "signup form did not return a redirect location")
    const redirect = new URL(location, config!.targetUrl)
    const error = redirect.searchParams.get("error")
    const acceptedWithoutDelivery =
      error === "email_failed" ||
      error === "invalid_email" ||
      error === "rate_limited"
    assert(
      redirect.pathname === "/auth-signup-success" ||
        (redirect.pathname === "/signup" && acceptedWithoutDelivery),
      `signup backend returned ${redirect.pathname}${error ? ` error=${error}` : ""}`
    )
    const userId = await findSignupUserId(signupEmail)
    if (userId) createdUserIds.add(userId)
    return {
      value: undefined,
      detail:
        redirect.pathname === "/auth-signup-success"
          ? "request accepted"
          : error === "rate_limited"
            ? "request reached backend; signup rate limit active"
            : "request accepted; delivery not required",
    }
  })

  const primary = await step("create two confirmed disposable users", async () => {
    const first = await createConfirmedUser("primary")
    const second = await createConfirmedUser("secondary")
    return { value: { first, second }, detail: "2 users" }
  })

  const primaryContexts = await step("sign in three independent browser sessions", async () => {
    const [first, second, third] = await Promise.all([
      createAuthContext(primary.first.email, primary.first.password, "primary-device-1"),
      createAuthContext(primary.first.email, primary.first.password, "primary-device-2"),
      createAuthContext(primary.first.email, primary.first.password, "primary-device-3"),
    ])
    return { value: [first, second, third] as const, detail: "3 auth cookie jars" }
  })

  const credentials = await Promise.all([
    createDeviceCredential("device-1"),
    createDeviceCredential("device-2"),
    createDeviceCredential("device-3"),
    createDeviceCredential("device-4"),
  ])

  const devices = await step("P-256 device 1 active; devices 2 and 3 approved", async () => {
    const first = expectActiveRegistration(await registerDevice(primaryContexts[0], credentials[0]))
    const second = await registerApprovedDevice({
      context: primaryContexts[1],
      credential: credentials[1],
      approverContext: primaryContexts[0],
      verifyWrongCode: true,
    })
    const third = await registerApprovedDevice({
      context: primaryContexts[2],
      credential: credentials[2],
      approverContext: primaryContexts[0],
    })
    return { value: [first, second, third] as const, detail: "3 trusted P-256 devices" }
  })

  await step("three trusted devices and sessions are simultaneously active", async () => {
    const [deviceRows, sessionRows, httpList] = await Promise.all([
      admin!
        .from("account_devices")
        .select("id, revoked_at, verification_required, verified_at")
        .eq("user_id", primary.first.userId),
      admin!
        .from("account_sessions")
        .select("id, device_id, status, expires_at")
        .eq("user_id", primary.first.userId)
        .eq("status", "active"),
      getDevices(primaryContexts[0]),
    ])
    failIfError("device count query failed", deviceRows.error)
    failIfError("session count query failed", sessionRows.error)
    const trustedDevices = (deviceRows.data || []).filter(
      (row) => !row.revoked_at && row.verification_required === false && Boolean(row.verified_at)
    )
    assert(trustedDevices.length === 3, `expected 3 trusted devices, found ${trustedDevices.length}`)
    assert((sessionRows.data || []).length === 3, `expected 3 active sessions, found ${(sessionRows.data || []).length}`)
    assert(
      new Set((sessionRows.data || []).map((row) => row.device_id)).size === 3,
      "active sessions are not bound to three distinct devices"
    )
    const listedDevices = Array.isArray(httpList.devices) ? httpList.devices : []
    assert(listedDevices.filter((row) => asObject(row).verificationStatus === "trusted").length === 3, "HTTP device list did not return three trusted devices")
    assert(httpList.currentDeviceId === devices[0].deviceId, "HTTP device list marked the wrong current device")
    return { value: undefined, detail: "3 devices, 3 sessions" }
  })

  await step("copied cookies cannot mutate without a body-bound device proof", async () => {
    const path = "/api/security/devices"
    const originalBody = JSON.stringify({
      action: "rename",
      deviceId: devices[0].deviceId,
      displayName: `TEST-AUTOMATION-PROOF-${runId.slice(-8)}`,
    })
    const changedBody = JSON.stringify({
      action: "rename",
      deviceId: devices[0].deviceId,
      displayName: "CHANGED_BODY_MUST_NOT_APPLY",
    })
    const copiedCookieContext: AuthContext = {
      client: primaryContexts[0].client,
      cookies: new Map(primaryContexts[0].cookies),
      accessToken: primaryContexts[0].accessToken,
      label: "copied-cookie-without-device-key",
    }

    const noProof = await fetchTarget(path, {
      method: "POST",
      headers: requestHeaders(copiedCookieContext, "no-possession-proof"),
      body: originalBody,
    })
    const noProofPayload = await readJson(noProof)
    assert(
      noProof.status === 403 && noProofPayload.error === "device_possession_proof_required",
      `copied cookie without proof returned HTTP ${noProof.status}: ${asString(noProofPayload.error)}`
    )

    const proofHeaders = await createRequestPossessionHeaders(
      primaryContexts[0],
      path,
      originalBody
    )
    const changed = await fetchTarget(path, {
      method: "POST",
      headers: {
        ...requestHeaders(primaryContexts[0], "changed-proof-body"),
        ...proofHeaders,
      },
      body: changedBody,
    })
    const changedPayload = await readJson(changed)
    assert(
      changed.status === 403 && changedPayload.error === "device_possession_body_mismatch",
      `proof with changed body returned HTTP ${changed.status}: ${asString(changedPayload.error)}`
    )

    const accepted = await fetchTarget(path, {
      method: "POST",
      headers: {
        ...requestHeaders(primaryContexts[0], "valid-proof-body"),
        ...proofHeaders,
      },
      body: originalBody,
    })
    const acceptedPayload = await readJson(accepted)
    assert(accepted.status === 200 && acceptedPayload.ok === true, "body-bound proof was not accepted")

    const replayed = await fetchTarget(path, {
      method: "POST",
      headers: {
        ...requestHeaders(primaryContexts[0], "replayed-proof-body"),
        ...proofHeaders,
      },
      body: originalBody,
    })
    const replayedPayload = await readJson(replayed)
    assert(
      replayed.status === 409 && replayedPayload.error === "device_possession_proof_replayed",
      `replayed proof returned HTTP ${replayed.status}: ${asString(replayedPayload.error)}`
    )
    return { value: undefined, detail: "no key denied; changed body denied; one-time proof replay denied" }
  })

  await step("trusted auth binding can CRUD its own core row", async () => {
    const inserted = await primaryContexts[0].client
      .from("clients")
      .insert({
        owner_id: primary.first.userId,
        child_code: `TEST-${runId.slice(-12)}`,
        anamnez: "TEST AUTOMATION temporary core RLS canary",
      })
      .select("id")
      .single()
    failIfError("trusted core insert failed", inserted.error)
    assert(inserted.data?.id, "trusted core insert returned no id")

    const updated = await primaryContexts[0].client
      .from("clients")
      .update({ anamnez: "TEST AUTOMATION updated core RLS canary" })
      .eq("id", inserted.data.id)
      .select("id")
      .single()
    failIfError("trusted core update failed", updated.error)

    const removed = await primaryContexts[0].client
      .from("clients")
      .delete()
      .eq("id", inserted.data.id)
      .select("id")
      .single()
    failIfError("trusted core delete failed", removed.error)
    return { value: undefined, detail: "client insert + update + delete via bound JWT" }
  })

  const fourthContext = await createAuthContext(primary.first.email, primary.first.password, "primary-device-4")
  await step("fourth device is blocked at the three-device cap", async () => {
    const result = await registerDevice(fourthContext, credentials[3])
    assert(
      result.statusCode === 409 && result.payload.error === "device_limit_exceeded",
      `fourth device was not blocked correctly: HTTP ${result.statusCode} ${asString(result.payload.error)}`
    )
    const { count, error } = await admin!
      .from("account_devices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", primary.first.userId)
    failIfError("fourth device persistence check failed", error)
    assert(count === 3, `fourth device attempt changed device history count to ${count}`)
    return { value: undefined, detail: "HTTP 409 device_limit_exceeded" }
  })

  await step("untrusted browser cannot read session rows or forge an app-session cookie", async () => {
    const [sessionRead, deviceRead, cappedCoreInsert] = await Promise.all([
      fourthContext.client.from("account_sessions").select("id").limit(1),
      fourthContext.client.from("account_devices").select("id").limit(1),
      fourthContext.client
        .from("clients")
        .insert({
          owner_id: primary.first.userId,
          child_code: `BLOCKED-${runId.slice(-10)}`,
          anamnez: "THIS ROW MUST NEVER EXIST",
        })
        .select("id"),
    ])
    assertDirectReadDenied(sessionRead, "fourth context read account_sessions")
    assertDirectReadDenied(deviceRead, "fourth context read account_devices")
    assertDirectReadDenied(cappedCoreInsert, "fourth context insert clients")

    fourthContext.cookies.set("sm_active_session", devices[0].sessionId)
    try {
      const forgedResponse = await fetchTarget("/api/security/devices", {
        method: "GET",
        headers: requestHeaders(fourthContext, "forged-app-session", false),
      })
      const forgedPayload = await readJson(forgedResponse)
      assert(
        forgedResponse.status === 401 && forgedPayload.ok === false,
        `raw session UUID cookie was not rejected: HTTP ${forgedResponse.status}`
      )
    } finally {
      fourthContext.cookies.delete("sm_active_session")
    }
    return { value: undefined, detail: "table reads denied + forged UUID cookie HTTP 401" }
  })

  const secondaryContext = await createAuthContext(primary.second.email, primary.second.password, "secondary-device-1")
  const secondaryCredential = await createDeviceCredential("secondary-device-1")
  const secondaryDevice = await step("second account receives its own first trusted device", async () => {
    const active = expectActiveRegistration(await registerDevice(secondaryContext, secondaryCredential))
    return { value: active, detail: "isolated account ready" }
  })

  await step("device rename works and cross-account access is denied", async () => {
    const displayName = `Canary ${runId.slice(-8)}`
    const rename = await postDeviceAction(primaryContexts[0], {
      action: "rename",
      deviceId: devices[0].deviceId,
      displayName,
    })
    assert(rename.statusCode === 200 && rename.payload.ok === true, `own-device rename failed with HTTP ${rename.statusCode}`)

    const crossApi = await postDeviceAction(secondaryContext, {
      action: "rename",
      deviceId: devices[0].deviceId,
      displayName: "CROSS_ACCOUNT_SHOULD_NEVER_APPLY",
    })
    assert(
      crossApi.statusCode === 404 && crossApi.payload.error === "device_not_found",
      `cross-account device API was not denied: HTTP ${crossApi.statusCode}`
    )

    const [secondaryReadsPrimary, primaryReadsSecondary, persistedName] = await Promise.all([
      secondaryContext.client.from("account_devices").select("id").eq("user_id", primary.first.userId),
      primaryContexts[0].client.from("account_devices").select("id").eq("user_id", primary.second.userId),
      admin!
        .from("account_devices")
        .select("display_name")
        .eq("id", devices[0].deviceId)
        .eq("user_id", primary.first.userId)
        .single(),
    ])
    failIfError("device rename verification failed", persistedName.error)
    assertDirectReadDenied(secondaryReadsPrimary, "secondary account read primary devices")
    assertDirectReadDenied(primaryReadsSecondary, "primary account read secondary devices")
    assert(persistedName.data?.display_name === displayName, "cross-account rename changed the primary device")

    const directUpdate = await secondaryContext.client
      .from("account_devices")
      .update({ display_name: "CROSS_ACCOUNT_DIRECT_UPDATE" })
      .eq("id", devices[0].deviceId)
      .select("id")
    assert(
      Boolean(directUpdate.error) || (directUpdate.data || []).length === 0,
      "secondary account directly updated a primary device"
    )
    return { value: undefined, detail: "HTTP 404 + bidirectional RLS isolation" }
  })

  await step("suspended account JWT loses core and app access immediately", async () => {
    const suspendedAt = new Date().toISOString()
    const state = await admin!.from("account_security_state").upsert(
      {
        user_id: primary.second.userId,
        manual_review_required: true,
        suspended_at: suspendedAt,
        updated_at: suspendedAt,
      },
      { onConflict: "user_id" }
    )
    failIfError("secondary suspension setup failed", state.error)

    const directProfile = await secondaryContext.client
      .from("profiles")
      .select("user_id")
      .eq("user_id", primary.second.userId)
    assertDirectReadDenied(directProfile, "suspended context read profiles")

    const appResponse = await fetchTarget("/api/security/devices", {
      method: "GET",
      headers: requestHeaders(secondaryContext, "suspended-app-access", false),
    })
    assert(appResponse.status === 401, `suspended app access returned HTTP ${appResponse.status}`)
    return { value: undefined, detail: "restrictive RLS + app guard denied" }
  })

  await step("private temporary video asset and entitlement are created", async () => {
    storagePath = `live-security/${runId}/canary.mp4`
    const canaryObject = Buffer.from(twoSecondCanaryMp4Base64, "base64")
    assert(canaryObject.length > 1_000, "embedded 2-second MP4 fixture is unexpectedly empty")
    const upload = await admin!.storage.from(educationBucket).upload(storagePath, canaryObject, {
      contentType: "video/mp4",
      upsert: false,
    })
    failIfError("private canary video upload failed", upload.error)

    const insertedAsset = await admin!
      .from("education_video_assets")
      .insert({
        slug: runId,
        title: "TEST AUTOMATION Security Canary",
        provider: "supabase",
        playback_policy: "signed_url",
        provider_status: "ready",
        storage_bucket: educationBucket,
        storage_path: storagePath,
        required_plan: null,
        is_active: true,
      })
      .select("id")
      .single()
    failIfError("temporary video asset insert failed", insertedAsset.error)
    assert(insertedAsset.data?.id, "temporary video asset id missing")
    assetId = String(insertedAsset.data.id)

    const entitlement = await admin!.from("user_entitlements").insert({
      user_id: primary.first.userId,
      feature: "education_video",
      plan_code: "professional",
      source: "manual_admin",
      manual_reason: `TEST_AUTOMATION ${runId}`,
      created_by: null,
    })
    failIfError("temporary video entitlement insert failed", entitlement.error)
    return { value: undefined, detail: "private object + asset + entitlement" }
  })

  await step("concurrent playback RPCs produce exactly one winner", async () => {
    assert(assetId, "temporary video asset missing")
    const playbackA = await insertPlaybackToken(primary.first.userId, assetId, {
      appSessionId: devices[0].sessionId,
      deviceId: devices[0].deviceId,
      playerSessionId: `rpc-a-${runId}`,
      watermarkCode: `WM-A-${runId}`,
    })
    const playbackB = await insertPlaybackToken(primary.first.userId, assetId, {
      appSessionId: devices[1].sessionId,
      deviceId: devices[1].deviceId,
      playerSessionId: `rpc-b-${runId}`,
      watermarkCode: `WM-B-${runId}`,
    })

    const [claimA, claimB] = await Promise.all([
      claimPlayback(primary.first.userId, assetId, playbackA),
      claimPlayback(primary.first.userId, assetId, playbackB),
    ])
    const candidates = [
      { claim: claimA, playback: playbackA },
      { claim: claimB, playback: playbackB },
    ]
    const winners = candidates.filter((candidate) => candidate.claim.ok === true)
    const losers = candidates.filter((candidate) => candidate.claim.ok !== true)
    assert(winners.length === 1 && losers.length === 1, `expected exactly one winner, got ${winners.length}`)
    assert(losers[0].claim.error === "active_playback_exists", "losing RPC did not report active_playback_exists")

    const winnerLeaseId = asString(winners[0].claim.leaseId)
    assert(winnerLeaseId, "winning RPC lease id missing")
    const takeover = await claimPlayback(primary.first.userId, assetId, losers[0].playback, true)
    assert(takeover.ok === true && takeover.status === "taken_over", "forced RPC takeover did not succeed")
    const takeoverLeaseId = asString(takeover.leaseId)
    assert(takeoverLeaseId, "takeover lease id missing")

    const oldTouch = await touchPlayback(
      primary.first.userId,
      assetId,
      winners[0].playback,
      winnerLeaseId
    )
    assert(oldTouch.ok === false && oldTouch.error === "playback_lease_lost", "old RPC lease did not lose ownership")

    const released = await releasePlayback(primary.first.userId, losers[0].playback, takeoverLeaseId)
    assert(released.ok === true && released.released === true, "takeover RPC lease was not released")
    const activeLease = await admin!
      .from("education_video_playback_leases")
      .select("lease_id")
      .eq("user_id", primary.first.userId)
      .maybeSingle()
    failIfError("RPC lease cleanup verification failed", activeLease.error)
    assert(!activeLease.data, "RPC playback lease remained active after release")
    return { value: undefined, detail: "1 winner, takeover, old touch lost, release" }
  })

  await step("HTTP playback returns 409, takeover succeeds, old heartbeat loses", async () => {
    assert(assetId, "temporary video asset missing")
    const firstAccess = expectHttpPlayback(
      await requestVideoAccess(primaryContexts[0], assetId, `http-a-${runId}`, false)
    )
    if (firstAccess.signedUrl) {
      const mediaResponse = await fetch(firstAccess.signedUrl, {
        method: "GET",
        headers: { range: "bytes=0-2047" },
        signal: AbortSignal.timeout(config!.httpTimeoutMs),
      })
      assert(
        mediaResponse.status === 200 || mediaResponse.status === 206,
        `signed video URL returned HTTP ${mediaResponse.status}`
      )
      const contentType = String(mediaResponse.headers.get("content-type") || "").toLowerCase()
      assert(contentType.startsWith("video/mp4"), `signed video URL returned ${contentType || "no content type"}`)
      const mediaBytes = await mediaResponse.arrayBuffer()
      assert(mediaBytes.byteLength > 0, "signed video URL returned an empty object")
    }
    const conflict = await requestVideoAccess(primaryContexts[1], assetId, `http-b-${runId}`, false)
    assert(
      conflict.statusCode === 409 && conflict.payload.error === "active_playback_exists",
      `second HTTP playback did not return 409 active_playback_exists: HTTP ${conflict.statusCode}`
    )

    const secondAccess = expectHttpPlayback(
      await requestVideoAccess(primaryContexts[1], assetId, `http-b-${runId}`, true)
    )
    const oldHeartbeat = await postVideoEvent(
      primaryContexts[0],
      assetId,
      firstAccess,
      "heartbeat"
    )
    assert(
      oldHeartbeat.statusCode === 409 && oldHeartbeat.payload.error === "playback_lease_lost",
      `old HTTP playback did not lose its lease: HTTP ${oldHeartbeat.statusCode}`
    )
    const release = await postVideoEvent(primaryContexts[1], assetId, secondAccess, "release")
    assert(
      release.statusCode === 200 && release.payload.ok === true && release.payload.released === true,
      `HTTP playback release failed with HTTP ${release.statusCode}`
    )
    const lease = await admin!
      .from("education_video_playback_leases")
      .select("lease_id")
      .eq("user_id", primary.first.userId)
      .maybeSingle()
    failIfError("HTTP lease cleanup verification failed", lease.error)
    assert(!lease.data, "HTTP playback lease remained after release")
    return { value: undefined, detail: "HTTP 409 + takeover + playback_lease_lost + release" }
  })

  await step("all three trusted devices can play the private video sequentially", async () => {
    assert(assetId, "temporary video asset missing")
    for (let index = 0; index < 3; index += 1) {
      const playback = expectHttpPlayback(
        await requestVideoAccess(
          primaryContexts[index],
          assetId,
          `sequential-device-${index + 1}-${runId}`,
          false
        )
      )
      const heartbeat = await postVideoEvent(
        primaryContexts[index],
        assetId,
        playback,
        "heartbeat"
      )
      assert(
        heartbeat.statusCode === 200 && heartbeat.payload.ok === true,
        `device ${index + 1} could not keep its sequential playback lease`
      )
      const release = await postVideoEvent(primaryContexts[index], assetId, playback, "release")
      assert(
        release.statusCode === 200 && release.payload.ok === true && release.payload.released === true,
        `device ${index + 1} could not release its sequential playback lease`
      )
    }
    const lease = await admin!
      .from("education_video_playback_leases")
      .select("lease_id")
      .eq("user_id", primary.first.userId)
      .maybeSingle()
    failIfError("sequential playback cleanup verification failed", lease.error)
    assert(!lease.data, "sequential playback left an active lease")
    return { value: undefined, detail: "device 1 -> device 2 -> device 3" }
  })

  await step("device removal releases its session and permits two replacements", async () => {
    assert(assetId, "temporary video asset missing")
    const removedDevicePlayback = expectHttpPlayback(
      await requestVideoAccess(
        primaryContexts[1],
        assetId,
        `remove-active-device-${runId}`,
        false
      )
    )
    const removeSecond = await postDeviceAction(primaryContexts[0], {
      action: "revoke",
      deviceId: devices[1].deviceId,
      reason: "removed",
    })
    assert(removeSecond.statusCode === 200 && removeSecond.payload.ok === true, "second device removal failed")

    const removedTokenHash = createHash("sha256")
      .update(removedDevicePlayback.token)
      .digest("hex")
    const [removedLease, removedToken, removedPlaybackSession] = await Promise.all([
      admin!
        .from("education_video_playback_leases")
        .select("lease_id")
        .eq("user_id", primary.first.userId)
        .maybeSingle(),
      admin!
        .from("education_video_access_tokens")
        .select("revoked_at")
        .eq("user_id", primary.first.userId)
        .eq("token_hash", removedTokenHash)
        .single(),
      admin!
        .from("education_video_playback_sessions")
        .select("ended_at, ended_reason")
        .eq("user_id", primary.first.userId)
        .eq("lease_id", removedDevicePlayback.leaseId)
        .single(),
    ])
    failIfError("removed-device lease verification failed", removedLease.error)
    failIfError("removed-device token verification failed", removedToken.error)
    failIfError("removed-device playback session verification failed", removedPlaybackSession.error)
    assert(!removedLease.data, "device removal left its playback lease active")
    assert(Boolean(removedToken.data?.revoked_at), "device removal did not revoke its video access token")
    assert(Boolean(removedPlaybackSession.data?.ended_at), "device removal did not end its playback session")

    const removedHeartbeat = await postVideoEvent(
      primaryContexts[1],
      assetId,
      removedDevicePlayback,
      "heartbeat",
      { skipPossessionProof: true }
    )
    assert(
      removedHeartbeat.statusCode === 401 ||
        (removedHeartbeat.statusCode === 409 && removedHeartbeat.payload.error === "playback_lease_lost"),
      `removed device playback was not rejected: HTTP ${removedHeartbeat.statusCode}`
    )

    const replacementOne = await registerApprovedDevice({
      context: fourthContext,
      credential: credentials[3],
      approverContext: primaryContexts[0],
    })

    const removeThird = await postDeviceAction(primaryContexts[0], {
      action: "revoke",
      deviceId: devices[2].deviceId,
      reason: "removed",
    })
    assert(removeThird.statusCode === 200 && removeThird.payload.ok === true, "third device removal failed")

    const fifthContext = await createAuthContext(primary.first.email, primary.first.password, "primary-device-5")
    const fifthCredential = await createDeviceCredential("device-5")
    const replacementTwo = await registerApprovedDevice({
      context: fifthContext,
      credential: fifthCredential,
      approverContext: primaryContexts[0],
    })

    const removeReplacement = await postDeviceAction(primaryContexts[0], {
      action: "revoke",
      deviceId: replacementOne.deviceId,
      reason: "removed",
    })
    assert(
      removeReplacement.statusCode === 200 && removeReplacement.payload.ok === true,
      "first replacement removal failed"
    )

    const sixthContext = await createAuthContext(primary.first.email, primary.first.password, "primary-device-6")
    const sixthCredential = await createDeviceCredential("device-6")
    const thirdReplacement = await registerDevice(sixthContext, sixthCredential)
    assert(
      thirdReplacement.statusCode === 409 && thirdReplacement.payload.error === "replacement_limit_exceeded",
      `third replacement was not blocked: HTTP ${thirdReplacement.statusCode} ${asString(thirdReplacement.payload.error)}`
    )

    const changes = await admin!
      .from("account_device_changes")
      .select("id")
      .eq("user_id", primary.first.userId)
      .eq("action", "replacement_approved")
    failIfError("replacement history query failed", changes.error)
    assert((changes.data || []).length === 2, `expected 2 replacement records, found ${(changes.data || []).length}`)

    const quota = await getDevices(primaryContexts[0])
    const replacementPolicy = asObject(quota.replacementPolicy)
    assert(replacementPolicy.used === 2 && replacementPolicy.remaining === 0, "HTTP replacement quota is incorrect")

    const revokedSession = await admin!
      .from("account_sessions")
      .select("status")
      .eq("id", devices[1].sessionId)
      .single()
    failIfError("removed device session verification failed", revokedSession.error)
    assert(revokedSession.data?.status === "revoked", "removed device session remained active")
    assert(replacementTwo.sessionId, "second replacement session missing")
    return { value: undefined, detail: "remove + 2 replacements; third blocked" }
  })

  assert(secondaryDevice.sessionId, "secondary canary session unexpectedly missing")
}

async function main() {
  let fatal: unknown = null
  try {
    await run()
  } catch (error) {
    fatal = error
  } finally {
    await cleanup()
  }

  const failedSteps = steps.filter((item) => !item.ok)
  const report = {
    ok: !fatal && failedSteps.length === 0 && cleanupErrors.length === 0,
    runId,
    targetUrl: config?.targetUrl || null,
    steps,
    cleanup: {
      ok: cleanupErrors.length === 0,
      errorCount: cleanupErrors.length,
      errors: cleanupErrors,
    },
    ...(fatal ? { fatal: errorMessage(fatal) } : {}),
  }
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

void main()
