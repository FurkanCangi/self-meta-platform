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

type StoredCredential = {
  privateKey: CryptoKey
  publicKey: CryptoKey
  createdAt: string
}

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

function getLegacyDeviceId() {
  const existing = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (existing && existing.length >= 16 && existing.length <= 200) return existing
  const next =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(LEGACY_STORAGE_KEY, next)
  return next
}

export function detectBrowserDeviceType(): BrowserDeviceProofFields["deviceType"] {
  const ua = navigator.userAgent || ""
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet"
  if (/mobi|iphone|android/i.test(ua)) return "mobile"
  return "desktop"
}

function openCredentialDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readCredential(db: IDBDatabase) {
  return new Promise<StoredCredential | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(CREDENTIAL_KEY)
    request.onsuccess = () => resolve((request.result as StoredCredential | undefined) || null)
    request.onerror = () => reject(request.error)
  })
}

async function writeCredential(db: IDBDatabase, credential: StoredCredential) {
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(credential, CREDENTIAL_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function getOrCreateCredential() {
  const db = await openCredentialDb()
  try {
    const existing = await readCredential(db)
    if (existing?.privateKey && existing.publicKey) return existing

    const pair = (await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    )) as CryptoKeyPair
    const credential: StoredCredential = {
      privateKey: pair.privateKey,
      publicKey: pair.publicKey,
      createdAt: new Date().toISOString(),
    }
    await writeCredential(db, credential)
    return credential
  } finally {
    db.close()
  }
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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical))
  return toBase64Url(new Uint8Array(digest))
}

export async function createBrowserDeviceProof(): Promise<BrowserDeviceProofFields> {
  const legacyDeviceId = getLegacyDeviceId()
  const deviceType = detectBrowserDeviceType()
  if (!window.isSecureContext || !window.crypto?.subtle || !window.indexedDB) {
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

  let credential: StoredCredential
  try {
    credential = await getOrCreateCredential()
  } catch {
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

  const publicKey = await crypto.subtle.exportKey("jwk", credential.publicKey)
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
  if (!challengeResponse.ok || !challengePayload?.challenge || !challengePayload?.challengeToken) {
    throw new Error("device_challenge_failed")
  }
  const signature = await crypto.subtle.sign(
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
