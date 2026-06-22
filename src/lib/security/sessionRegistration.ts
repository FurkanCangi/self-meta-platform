import "server-only"

import { createHash } from "crypto"
import type { User } from "@supabase/supabase-js"
import {
  evaluateAccountRisk,
  isSecurityLockExemptUser,
  recordAccountSecurityEvent,
} from "@/lib/security/anomalyDetection"
import { APP_SESSION_MAX_AGE_SECONDS } from "@/lib/security/appSession"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const MAX_REGISTERED_DEVICES = 2

export type AppSessionDeviceType = "desktop" | "mobile" | "tablet" | "unknown"

export type RegisterAppSessionResult =
  | { ok: true; sessionId: string; deviceId: string; maxDevices: number }
  | { ok: false; error: string; status: number; message?: string }

export function normalizeDeviceType(value: unknown): AppSessionDeviceType {
  const raw = String(value || "").toLowerCase().trim()
  if (raw === "desktop" || raw === "mobile" || raw === "tablet") return raw
  return "unknown"
}

function hashDeviceId(userId: string, deviceId: string) {
  return createHash("sha256").update(`${userId}:${deviceId}`).digest("hex")
}

function deviceSlot(deviceType: string) {
  return deviceType === "desktop" ? "desktop" : "handheld"
}

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headers.get("x-real-ip") || null
}

export async function registerAppSessionForUser({
  user,
  requestHeaders,
  deviceId: rawDeviceIdInput,
  deviceType: deviceTypeInput,
  allowSlotReuse = false,
}: {
  user: User
  requestHeaders: Headers
  deviceId: string
  deviceType?: string
  allowSlotReuse?: boolean
}): Promise<RegisterAppSessionResult> {
  if (!user.id) {
    return { ok: false, error: "Unauthorized", status: 401 }
  }

  if (!user.email_confirmed_at) {
    return { ok: false, error: "Email confirmation required", status: 403 }
  }

  const rawDeviceId = String(rawDeviceIdInput || "").trim()
  if (!rawDeviceId || rawDeviceId.length < 16 || rawDeviceId.length > 200) {
    return { ok: false, error: "device_id_invalid", status: 400 }
  }

  const admin = createSupabaseAdminClient()
  const deviceType = normalizeDeviceType(deviceTypeInput)
  const deviceHash = hashDeviceId(user.id, rawDeviceId)
  const userAgent = String(requestHeaders.get("user-agent") || "").slice(0, 500)
  const ipAddress = getClientIp(requestHeaders)
  const lockExemptUser = await isSecurityLockExemptUser(user.id, user.email)

  const { data: existingDevice, error: existingError } = await admin
    .from("account_devices")
    .select("id, revoked_at")
    .eq("user_id", user.id)
    .eq("device_fingerprint_hash", deviceHash)
    .maybeSingle()

  if (existingError) {
    return { ok: false, error: "device_lookup_failed", status: 500 }
  }

  if (!lockExemptUser && existingDevice?.revoked_at) {
    return { ok: false, error: "device_revoked", status: 403 }
  }

  const { data: securityState } = await admin
    .from("account_security_state")
    .select("temporary_locked_until, suspended_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!lockExemptUser && securityState?.suspended_at) {
    return { ok: false, error: "account_suspended", status: 403 }
  }

  const lockedUntil = securityState?.temporary_locked_until
    ? new Date(securityState.temporary_locked_until).getTime()
    : 0
  if (!lockExemptUser && lockedUntil && lockedUntil > Date.now()) {
    return { ok: false, error: "account_temporarily_locked", status: 423 }
  }

  let deviceId = existingDevice?.id as string | undefined

  if (!deviceId) {
    const { data: activeDevices, error: devicesError } = await admin
      .from("account_devices")
      .select("id, device_type")
      .eq("user_id", user.id)
      .is("revoked_at", null)

    if (devicesError) {
      return { ok: false, error: "device_count_failed", status: 500 }
    }

    const registeredDevices = activeDevices || []
    if (!lockExemptUser && registeredDevices.length >= MAX_REGISTERED_DEVICES) {
      await recordAccountSecurityEvent({
        userId: user.id,
        eventType: "device_limit_blocked",
        ipAddress,
        userAgent,
        metadata: { requested_device_type: deviceType },
      })

      return {
        ok: false,
        error: "device_limit_exceeded",
        message: "Bu hesap için en fazla 2 cihaz kullanılabilir.",
        status: 409,
      }
    }

    const requestedSlot = deviceSlot(deviceType)
    const sameSlotDevice = registeredDevices.find(
      (device) => deviceSlot(String(device.device_type || "unknown")) === requestedSlot
    )
    const canReuseSlot = allowSlotReuse || lockExemptUser
    if (sameSlotDevice && canReuseSlot) {
      deviceId = sameSlotDevice.id
      await admin
        .from("account_devices")
        .update({
          device_type: deviceType,
          last_seen_at: new Date().toISOString(),
          last_user_agent: userAgent,
          last_ip: ipAddress,
        })
        .eq("id", deviceId)
        .eq("user_id", user.id)
      await recordAccountSecurityEvent({
        userId: user.id,
        eventType: "device_slot_reused",
        deviceId,
        ipAddress,
        userAgent,
        metadata: { requested_device_type: deviceType, requested_slot: requestedSlot },
      })
    }

    if (!deviceId) {
      const { data: createdDevice, error: createDeviceError } = await admin
        .from("account_devices")
        .insert({
          user_id: user.id,
          device_fingerprint_hash: deviceHash,
          device_type: deviceType,
          first_user_agent: userAgent,
          last_user_agent: userAgent,
          first_ip: ipAddress,
          last_ip: ipAddress,
        })
        .select("id")
        .single()

      if (createDeviceError || !createdDevice?.id) {
        return { ok: false, error: "device_create_failed", status: 500 }
      }

      deviceId = createdDevice.id
      await recordAccountSecurityEvent({
        userId: user.id,
        eventType: "new_device_registered",
        deviceId,
        ipAddress,
        userAgent,
        metadata: { device_type: deviceType },
      })
    }
  } else {
    const { data: previousDevice } = await admin
      .from("account_devices")
      .select("last_user_agent, last_ip")
      .eq("id", deviceId)
      .eq("user_id", user.id)
      .maybeSingle()

    await admin
      .from("account_devices")
      .update({
        device_type: deviceType,
        last_seen_at: new Date().toISOString(),
        last_user_agent: userAgent,
        last_ip: ipAddress,
      })
      .eq("id", deviceId)
      .eq("user_id", user.id)

    if (
      previousDevice &&
      ((previousDevice.last_ip && previousDevice.last_ip !== ipAddress) ||
        (previousDevice.last_user_agent && previousDevice.last_user_agent !== userAgent))
    ) {
      await recordAccountSecurityEvent({
        userId: user.id,
        eventType: "device_metadata_changed",
        deviceId,
        ipAddress,
        userAgent,
        metadata: {
          previous_ip: previousDevice.last_ip,
          previous_user_agent: previousDevice.last_user_agent,
        },
      })
    }
  }

  const sessionId = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + APP_SESSION_MAX_AGE_SECONDS * 1000).toISOString()

  if (!lockExemptUser) {
    await admin
      .from("account_sessions")
      .update({
        status: "replaced",
        revoked_at: now.toISOString(),
        replaced_by_session_id: sessionId,
      })
      .eq("user_id", user.id)
      .eq("status", "active")

    await recordAccountSecurityEvent({
      userId: user.id,
      eventType: "active_session_replaced",
      deviceId,
      ipAddress,
      userAgent,
      metadata: { new_session_id: sessionId },
    })

    const risk = await evaluateAccountRisk(user.id)
    if (risk.ok && risk.decision.action === "temporary_lock") {
      return {
        ok: false,
        error: "account_temporarily_locked",
        message: "Şüpheli kullanım nedeniyle hesap geçici olarak kilitlendi.",
        status: 423,
      }
    }
  }

  if (!deviceId) {
    return { ok: false, error: "device_create_failed", status: 500 }
  }

  const { error: sessionError } = await admin.from("account_sessions").insert({
    id: sessionId,
    user_id: user.id,
    device_id: deviceId,
    status: "active",
    ip_address: ipAddress,
    user_agent: userAgent,
    expires_at: expiresAt,
  })

  if (sessionError) {
    return { ok: false, error: "session_create_failed", status: 500 }
  }

  return {
    ok: true,
    sessionId,
    deviceId,
    maxDevices: MAX_REGISTERED_DEVICES,
  }
}
