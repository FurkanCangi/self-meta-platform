import { createHash } from "crypto"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { evaluateAccountRisk, isSecurityLockExemptUser } from "@/lib/security/anomalyDetection"
import {
  APP_SESSION_MAX_AGE_SECONDS,
  setAppSessionCookie,
} from "@/lib/security/appSession"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const MAX_REGISTERED_DEVICES = 2

function normalizeDeviceType(value: unknown) {
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

function getClientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headerStore.get("x-real-ip") || null
}

async function recordSecurityEvent(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  event: {
    userId: string
    eventType: string
    deviceId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    metadata?: Record<string, unknown>
  }
) {
  await admin.from("account_security_events").insert({
    user_id: event.userId,
    event_type: event.eventType,
    device_id: event.deviceId || null,
    ip_address: event.ipAddress || null,
    user_agent: event.userAgent || null,
    metadata: event.metadata || {},
  })
}

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const admin = createSupabaseAdminClient()
  const supabase = await createSupabaseServerClient()
  const serverAuth = await supabase.auth.getUser()
  let user = serverAuth.data.user
  let error = serverAuth.error

  if (error || !user?.id) {
    const bearer = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim()
    if (bearer) {
      const tokenAuth = await admin.auth.getUser(bearer)
      user = tokenAuth.data.user
      error = tokenAuth.error
    }
  }

  if (error || !user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json({ ok: false, error: "Email confirmation required" }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {}

  const rawDeviceId = String(body.deviceId || "").trim()
  if (!rawDeviceId || rawDeviceId.length < 16 || rawDeviceId.length > 200) {
    return NextResponse.json({ ok: false, error: "device_id_invalid" }, { status: 400 })
  }

  const deviceType = normalizeDeviceType(body.deviceType)
  const deviceHash = hashDeviceId(user.id, rawDeviceId)
  const headerStore = await headers()
  const userAgent = String(headerStore.get("user-agent") || "").slice(0, 500)
  const ipAddress = getClientIp(headerStore)
  const lockExemptUser = await isSecurityLockExemptUser(user.id, user.email)

  const { data: existingDevice, error: existingError } = await admin
    .from("account_devices")
    .select("id, revoked_at")
    .eq("user_id", user.id)
    .eq("device_fingerprint_hash", deviceHash)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ ok: false, error: "device_lookup_failed" }, { status: 500 })
  }

  if (existingDevice?.revoked_at) {
    return NextResponse.json({ ok: false, error: "device_revoked" }, { status: 403 })
  }

  const { data: securityState } = await admin
    .from("account_security_state")
    .select("temporary_locked_until, suspended_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (securityState?.suspended_at) {
    return NextResponse.json({ ok: false, error: "account_suspended" }, { status: 403 })
  }

  const lockedUntil = securityState?.temporary_locked_until
    ? new Date(securityState.temporary_locked_until).getTime()
    : 0
  if (!lockExemptUser && lockedUntil && lockedUntil > Date.now()) {
    return NextResponse.json({ ok: false, error: "account_temporarily_locked" }, { status: 423 })
  }

  let deviceId = existingDevice?.id as string | undefined

  if (!deviceId) {
    const { data: activeDevices, error: devicesError } = await admin
      .from("account_devices")
      .select("id, device_type")
      .eq("user_id", user.id)
      .is("revoked_at", null)

    if (devicesError) {
      return NextResponse.json({ ok: false, error: "device_count_failed" }, { status: 500 })
    }

    const registeredDevices = activeDevices || []
    if (registeredDevices.length >= MAX_REGISTERED_DEVICES) {
      await recordSecurityEvent(admin, {
        userId: user.id,
        eventType: "device_limit_blocked",
        ipAddress,
        userAgent,
        metadata: { requested_device_type: deviceType },
      })

      return NextResponse.json(
        {
          ok: false,
          error: "device_limit_exceeded",
          message: "Bu hesap için en fazla 2 cihaz kullanılabilir.",
        },
        { status: 409 }
      )
    }

    const requestedSlot = deviceSlot(deviceType)
    const sameSlotDevice = registeredDevices.find((device) => deviceSlot(String(device.device_type || "unknown")) === requestedSlot)
    const allowSlotReuse = body.allowSlotReuse === true
    if (sameSlotDevice && allowSlotReuse) {
      deviceId = sameSlotDevice.id
      await recordSecurityEvent(admin, {
        userId: user.id,
        eventType: "device_slot_reused",
        deviceId,
        ipAddress,
        userAgent,
        metadata: { requested_device_type: deviceType, requested_slot: requestedSlot },
      })
    } else if (sameSlotDevice) {
      await recordSecurityEvent(admin, {
        userId: user.id,
        eventType: "device_slot_blocked",
        ipAddress,
        userAgent,
        metadata: { requested_device_type: deviceType, requested_slot: requestedSlot },
      })

      return NextResponse.json(
        {
          ok: false,
          error: "device_slot_unavailable",
          message:
            requestedSlot === "desktop"
              ? "Bu hesapta zaten bir bilgisayar kayıtlı."
              : "Bu hesapta zaten bir telefon veya tablet kayıtlı.",
        },
        { status: 409 }
      )
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
        return NextResponse.json({ ok: false, error: "device_create_failed" }, { status: 500 })
      }

      deviceId = createdDevice.id
      await recordSecurityEvent(admin, {
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
      await recordSecurityEvent(admin, {
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

  await admin
    .from("account_sessions")
    .update({
      status: "replaced",
      revoked_at: now.toISOString(),
      replaced_by_session_id: sessionId,
    })
    .eq("user_id", user.id)
    .eq("status", "active")

  await recordSecurityEvent(admin, {
    userId: user.id,
    eventType: "active_session_replaced",
    deviceId,
    ipAddress,
    userAgent,
    metadata: { new_session_id: sessionId },
  })

  const risk = await evaluateAccountRisk(user.id)
  if (risk.ok && risk.decision.action === "temporary_lock") {
    return NextResponse.json(
      {
        ok: false,
        error: "account_temporarily_locked",
        message: "Şüpheli kullanım nedeniyle hesap geçici olarak kilitlendi.",
      },
      { status: 423 }
    )
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
    return NextResponse.json({ ok: false, error: "session_create_failed" }, { status: 500 })
  }

  const response = NextResponse.json({
    ok: true,
    sessionId,
    deviceId,
    maxDevices: MAX_REGISTERED_DEVICES,
  })
  setAppSessionCookie(response, sessionId)
  return response
}
