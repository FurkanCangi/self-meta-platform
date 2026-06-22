import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

export const DEVICE_MANAGEMENT_COOKIE = "sm_device_management"
const DEVICE_MANAGEMENT_MAX_AGE_SECONDS = 15 * 60

function signingSecret() {
  return (
    process.env.AUTH_STATE_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "dna-device-management-dev-secret"
  )
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

export function verifyDeviceManagementToken(token: string | undefined | null, userId: string) {
  if (!token) return false
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return false

  const expected = signPayload(payload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return false
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return false

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string
      expiresAt?: number
    }
    return decoded.userId === userId && Number(decoded.expiresAt || 0) > Date.now()
  } catch {
    return false
  }
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
