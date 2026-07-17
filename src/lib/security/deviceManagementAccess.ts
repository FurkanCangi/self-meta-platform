import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

export const DEVICE_MANAGEMENT_COOKIE = "sm_device_management"
export const PENDING_DEVICE_COOKIE = "sm_pending_device"
const DEVICE_MANAGEMENT_MAX_AGE_SECONDS = 15 * 60
const PENDING_DEVICE_MAX_AGE_SECONDS = 10 * 60

type DeviceManagementPayload = {
  userId: string
  expiresAt: number
  nonce: string
}

function signingSecret() {
  const configured = process.env.AUTH_STATE_SECRET || process.env.SUPABASE_JWT_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV !== "production") return "dna-device-management-dev-secret"
  throw new Error("AUTH_STATE_SECRET is required in production")
}

function signPayload(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url")
}

export function createDeviceManagementToken(userId: string, now = Date.now()) {
  const expiresAt = now + DEVICE_MANAGEMENT_MAX_AGE_SECONDS * 1000
  const nonce = crypto.randomUUID()
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt, nonce })).toString("base64url")
  return `${payload}.${signPayload(payload)}`
}

export function readDeviceManagementToken(token: string | undefined | null): DeviceManagementPayload | null {
  if (!token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null

  const expected = signPayload(payload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DeviceManagementPayload
    if (!decoded.userId || !decoded.nonce || Number(decoded.expiresAt || 0) <= Date.now()) return null
    return decoded
  } catch {
    return null
  }
}

export function verifyDeviceManagementToken(token: string | undefined | null, userId: string) {
  return readDeviceManagementToken(token)?.userId === userId
}

export function setDeviceManagementCookie(response: NextResponse, userId: string) {
  response.cookies.set(DEVICE_MANAGEMENT_COOKIE, createDeviceManagementToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEVICE_MANAGEMENT_MAX_AGE_SECONDS,
  })
}

export function clearDeviceManagementCookie(response: NextResponse) {
  response.cookies.set(DEVICE_MANAGEMENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

type PendingDevicePayload = {
  userId: string
  challengeId: string
  deviceId: string
  verificationCode: string
  expiresAt: number
}

export function createPendingDeviceToken(payload: Omit<PendingDevicePayload, "expiresAt">, now = Date.now()) {
  const completePayload: PendingDevicePayload = {
    ...payload,
    expiresAt: now + PENDING_DEVICE_MAX_AGE_SECONDS * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(completePayload), "utf8").toString("base64url")
  return `${encoded}.${signPayload(encoded)}`
}

export function readPendingDeviceToken(
  token: string | undefined | null,
  userId: string
): PendingDevicePayload | null {
  if (!token) return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null
  const expected = signPayload(payload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PendingDevicePayload
    if (
      decoded.userId !== userId ||
      !decoded.challengeId ||
      !decoded.deviceId ||
      !/^\d{6}$/.test(decoded.verificationCode) ||
      decoded.expiresAt <= Date.now()
    ) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

export function setPendingDeviceCookie(
  response: NextResponse,
  payload: Omit<PendingDevicePayload, "expiresAt">
) {
  response.cookies.set(PENDING_DEVICE_COOKIE, createPendingDeviceToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_DEVICE_MAX_AGE_SECONDS,
  })
}

export function clearPendingDeviceCookie(response: NextResponse) {
  response.cookies.set(PENDING_DEVICE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
