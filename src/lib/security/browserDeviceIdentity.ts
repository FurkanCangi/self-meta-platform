const DB_NAME = "dna-device-security"
const STORE_NAME = "device-credentials"
const CREDENTIAL_KEY = "primary-p256-v1"
const LEGACY_STORAGE_KEY = "dna_device_id"

export type BrowserDeviceProofFields = {
  deviceId: string
  deviceType: "desktop" | "mobile" | "tablet" | "unknown"
  identityVersion: "p256-v1" | "legacy-session"
  publicKeyJwk: string
  publicKeyFingerprint: string
  proofChallengeToken: string
  proofSignature: string
  legacyDeviceId: string
}

export type BrowserDeviceIdentityFallbackReason =
  | "webcrypto_unavailable"
  | "secure_key_storage_unavailable"
  | "legacy_storage_unavailable"

export type BrowserDeviceIdentityReadiness = {
  identityVersion: BrowserDeviceProofFields["identityVersion"]
  canSubmit: boolean
  fallbackReason: BrowserDeviceIdentityFallbackReason | null
  legacyPersistence: "local" | "session" | "memory"
}

type StoredCredential = {
  privateKey: CryptoKey
  publicKey: CryptoKey
  createdAt: string
}

type PreparedBrowserDeviceIdentity = BrowserDeviceIdentityReadiness & {
  credential: StoredCredential | null
  deviceType: BrowserDeviceProofFields["deviceType"]
  legacyDeviceId: string
}

let memoryLegacyDeviceId: string | null = null
let credentialPromise: Promise<StoredCredential> | null = null
let identityPreparationPromise: Promise<PreparedBrowserDeviceIdentity> | null = null

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function createLegacyDeviceId() {
  return typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function readOrCreateStoredLegacyDeviceId(storageName: "localStorage" | "sessionStorage") {
  try {
    const storage = window[storageName]
    const existing = storage.getItem(LEGACY_STORAGE_KEY)
    if (existing && existing.length >= 16 && existing.length <= 200) return existing
    const next = createLegacyDeviceId()
    storage.setItem(LEGACY_STORAGE_KEY, next)
    return storage.getItem(LEGACY_STORAGE_KEY) === next ? next : null
  } catch {
    return null
  }
}

function getLegacyDeviceIdentity() {
  const localId = readOrCreateStoredLegacyDeviceId("localStorage")
  if (localId) return { deviceId: localId, persistence: "local" as const }

  const sessionId = readOrCreateStoredLegacyDeviceId("sessionStorage")
  if (sessionId) return { deviceId: sessionId, persistence: "session" as const }

  memoryLegacyDeviceId ||= createLegacyDeviceId()
  return { deviceId: memoryLegacyDeviceId, persistence: "memory" as const }
}

export function detectBrowserDeviceType(): BrowserDeviceProofFields["deviceType"] {
  const ua = navigator.userAgent || ""
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet"
  if (/mobi|iphone|android/i.test(ua)) return "mobile"
  return "desktop"
}

function openCredentialDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("device_credential_database_blocked"))
  })
}

async function readCredential(db: IDBDatabase) {
  return new Promise<StoredCredential | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(CREDENTIAL_KEY)
    request.onsuccess = () => resolve((request.result as StoredCredential | undefined) || null)
    request.onerror = () => reject(request.error)
  })
}

async function persistCredentialIfMissing(db: IDBDatabase, candidate: StoredCredential) {
  return new Promise<StoredCredential>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(CREDENTIAL_KEY)
    let selected: StoredCredential | null = null

    request.onsuccess = () => {
      const existing = (request.result as StoredCredential | undefined) || null
      if (existing?.privateKey && existing.publicKey) {
        selected = existing
        return
      }
      selected = candidate
      store.put(candidate, CREDENTIAL_KEY)
    }
    transaction.oncomplete = () => {
      if (selected) resolve(selected)
      else reject(new Error("device_credential_transaction_empty"))
    }
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error("device_credential_transaction_aborted"))
  })
}

async function loadOrCreateCredential() {
  const db = await openCredentialDb()
  try {
    const existing = await readCredential(db)
    if (existing?.privateKey && existing.publicKey) return existing

    const pair = (await window.crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    )) as CryptoKeyPair
    const credential: StoredCredential = {
      privateKey: pair.privateKey,
      publicKey: pair.publicKey,
      createdAt: new Date().toISOString(),
    }
    // A second tab can reach this point at the same time. IndexedDB serializes
    // read-write transactions, so rechecking inside this transaction makes
    // every tab use the same winning key instead of overwriting one another.
    return await persistCredentialIfMissing(db, credential)
  } finally {
    db.close()
  }
}

function getOrCreateCredential() {
  if (!credentialPromise) {
    credentialPromise = loadOrCreateCredential().catch((error) => {
      credentialPromise = null
      throw error
    })
  }
  return credentialPromise
}

async function getStoredCredential() {
  const db = await openCredentialDb()
  try {
    return await readCredential(db)
  } finally {
    db.close()
  }
}

async function fingerprintPublicKey(publicKey: JsonWebKey) {
  const canonical = JSON.stringify({
    crv: publicKey.crv,
    kty: publicKey.kty,
    x: publicKey.x,
    y: publicKey.y,
  })
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))
  return toBase64Url(new Uint8Array(digest))
}

function hasModernDeviceIdentitySupport() {
  try {
    return Boolean(window.isSecureContext && window.crypto?.subtle && window.indexedDB)
  } catch {
    return false
  }
}

async function prepareBrowserDeviceIdentityInternal(): Promise<PreparedBrowserDeviceIdentity> {
  const legacyIdentity = getLegacyDeviceIdentity()
  const deviceType = detectBrowserDeviceType()
  if (!hasModernDeviceIdentitySupport()) {
    const canSubmit = legacyIdentity.persistence !== "memory"
    return {
      credential: null,
      deviceType,
      legacyDeviceId: legacyIdentity.deviceId,
      identityVersion: "legacy-session",
      canSubmit,
      fallbackReason: canSubmit ? "webcrypto_unavailable" : "legacy_storage_unavailable",
      legacyPersistence: legacyIdentity.persistence,
    }
  }

  try {
    const credential = await getOrCreateCredential()
    return {
      credential,
      deviceType,
      legacyDeviceId: legacyIdentity.deviceId,
      identityVersion: "p256-v1",
      canSubmit: true,
      fallbackReason: null,
      legacyPersistence: legacyIdentity.persistence,
    }
  } catch {
    const canSubmit = legacyIdentity.persistence !== "memory"
    return {
      credential: null,
      deviceType,
      legacyDeviceId: legacyIdentity.deviceId,
      identityVersion: "legacy-session",
      canSubmit,
      fallbackReason: canSubmit ? "secure_key_storage_unavailable" : "legacy_storage_unavailable",
      legacyPersistence: legacyIdentity.persistence,
    }
  }
}

function getPreparedBrowserDeviceIdentity() {
  if (!identityPreparationPromise) {
    identityPreparationPromise = prepareBrowserDeviceIdentityInternal().catch((error) => {
      identityPreparationPromise = null
      throw error
    })
  }
  return identityPreparationPromise
}

export async function prepareBrowserDeviceIdentity(): Promise<BrowserDeviceIdentityReadiness> {
  const prepared = await getPreparedBrowserDeviceIdentity()
  return {
    identityVersion: prepared.identityVersion,
    canSubmit: prepared.canSubmit,
    fallbackReason: prepared.fallbackReason,
    legacyPersistence: prepared.legacyPersistence,
  }
}

export function isBrowserDeviceProofComplete(proof: BrowserDeviceProofFields) {
  if (!proof.deviceId || proof.deviceId.length < 16 || proof.deviceId.length > 200) return false
  if (!proof.legacyDeviceId || proof.legacyDeviceId.length < 16 || proof.legacyDeviceId.length > 200) {
    return false
  }
  if (proof.identityVersion === "legacy-session") {
    return Boolean(proof.deviceType)
  }
  return Boolean(
    proof.deviceId.startsWith("p256-") &&
      proof.publicKeyJwk &&
      proof.publicKeyFingerprint &&
      proof.proofChallengeToken &&
      proof.proofSignature
  )
}

export async function createBrowserDeviceProof(): Promise<BrowserDeviceProofFields> {
  const prepared = await getPreparedBrowserDeviceIdentity()
  if (!prepared.canSubmit) {
    throw new Error("device_identity_storage_unavailable")
  }
  const { credential, deviceType, legacyDeviceId } = prepared
  if (!credential) {
    return {
      deviceId: legacyDeviceId,
      deviceType,
      identityVersion: "legacy-session",
      publicKeyJwk: "",
      publicKeyFingerprint: "",
      proofChallengeToken: "",
      proofSignature: "",
      legacyDeviceId,
    }
  }

  const publicKey = await window.crypto.subtle.exportKey("jwk", credential.publicKey)
  const publicKeyFingerprint = await fingerprintPublicKey(publicKey)
  const deviceId = `p256-${publicKeyFingerprint}`
  const challengeResponse = await fetch("/api/security/device-proof/challenge", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dna-request": "same-origin" },
    body: JSON.stringify({ deviceId }),
    credentials: "same-origin",
    cache: "no-store",
  })
  const challengePayload = await challengeResponse.json().catch(() => null)
  if (challengeResponse.status === 429) {
    const retryAfter = Math.max(1, Number(challengeResponse.headers.get("retry-after") || 60) || 60)
    throw new Error(`device_challenge_rate_limited:${retryAfter}`)
  }
  if (!challengeResponse.ok || !challengePayload?.challenge || !challengePayload?.challengeToken) {
    throw new Error("device_challenge_failed")
  }
  const signature = await window.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    credential.privateKey,
    new TextEncoder().encode(String(challengePayload.challenge))
  )
  return {
    deviceId,
    deviceType,
    identityVersion: "p256-v1",
    publicKeyJwk: JSON.stringify(publicKey),
    publicKeyFingerprint,
    proofChallengeToken: String(challengePayload.challengeToken),
    proofSignature: toBase64Url(new Uint8Array(signature)),
    legacyDeviceId,
  }
}

export async function createDevicePossessionHeaders(params: {
  path: string
  body: string
  signal?: AbortSignal
}): Promise<Record<string, string>> {
  const bodyHash = window.crypto?.subtle
    ? toHex(
        new Uint8Array(
          await window.crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(params.body)
          )
        )
      )
    : "0".repeat(64)
  const challengeResponse = await fetch("/api/security/device-proof/challenge", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dna-request": "same-origin" },
    body: JSON.stringify({
      method: "POST",
      path: params.path,
      bodyHash,
    }),
    credentials: "same-origin",
    cache: "no-store",
    signal: params.signal,
  })
  const challengePayload = await challengeResponse.json().catch(() => null)
  if (!challengeResponse.ok || !challengePayload?.ok) {
    throw new Error(String(challengePayload?.error || "device_possession_challenge_failed"))
  }
  if (challengePayload.required === false) return {}
  if (!challengePayload.challenge || !challengePayload.challengeToken) {
    throw new Error("device_possession_challenge_invalid")
  }

  if (!window.isSecureContext || !window.crypto?.subtle || !window.indexedDB) {
    throw new Error("device_possession_key_unavailable")
  }
  const credential = await getStoredCredential().catch(() => null)
  if (!credential?.privateKey) throw new Error("device_possession_key_unavailable")

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    credential.privateKey,
    new TextEncoder().encode(String(challengePayload.challenge))
  )
  return {
    "x-dna-device-proof-token": String(challengePayload.challengeToken),
    "x-dna-device-proof-signature": toBase64Url(new Uint8Array(signature)),
  }
}
