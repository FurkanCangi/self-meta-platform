import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import {
  DEVICE_MANAGEMENT_COOKIE,
  verifyDeviceManagementToken,
} from "@/lib/security/deviceManagementAccess"
import { verifyCurrentAppSession } from "@/lib/security/appSession"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, getClientRateLimitKey, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { evaluateAccountRisk, recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const deviceActionSchema = z
  .object({
    action: z.literal("revoke"),
    deviceId: z.string().uuid(),
  })
  .passthrough()

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headers.get("x-real-ip") || null
}

async function requireDeviceAccess() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    }
  }

  const appSession = await verifyCurrentAppSession(user.id)
  if (appSession.ok) return { ok: true as const, user, mode: "active_session" as const }

  const cookieStore = await cookies()
  const deviceManagementToken = cookieStore.get(DEVICE_MANAGEMENT_COOKIE)?.value
  if (verifyDeviceManagementToken(deviceManagementToken, user.id)) {
    return { ok: true as const, user, mode: "device_management" as const }
  }

  return {
    ok: false as const,
    response: NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 }),
  }
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, "security-devices-read"),
    limit: 60,
    windowMs: 10 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const access = await requireDeviceAccess()
  if (!access.ok) return access.response

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin
    .from("account_devices")
    .select("id, device_type, first_seen_at, last_seen_at, revoked_at, last_ip, last_user_agent")
    .eq("user_id", access.user.id)
    .order("revoked_at", { ascending: true, nullsFirst: true })
    .order("last_seen_at", { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ ok: false, error: "devices_unavailable" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    mode: access.mode,
    devices: (data || []).map((device) => ({
      id: device.id,
      deviceType: device.device_type || "unknown",
      firstSeenAt: device.first_seen_at,
      lastSeenAt: device.last_seen_at,
      revokedAt: device.revoked_at,
      lastIp: device.last_ip,
      userAgent: device.last_user_agent,
    })),
  })
}

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const rateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, "security-devices-action"),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const access = await requireDeviceAccess()
  if (!access.ok) return access.response

  const parsedBody = await readJsonWithSchema(request, deviceActionSchema)
  if (!parsedBody.ok) return parsedBody.response

  const payloadGuard = rejectServerControlledFields(parsedBody.data)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data: device, error: lookupError } = await admin
    .from("account_devices")
    .select("id, revoked_at")
    .eq("id", parsedBody.data.deviceId)
    .eq("user_id", access.user.id)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ ok: false, error: "device_lookup_failed" }, { status: 500 })
  }
  if (!device) {
    return NextResponse.json({ ok: false, error: "device_not_found" }, { status: 404 })
  }
  if (device.revoked_at) {
    return NextResponse.json({ ok: true, alreadyRevoked: true })
  }

  const { error: updateError } = await admin
    .from("account_devices")
    .update({ revoked_at: now })
    .eq("id", parsedBody.data.deviceId)
    .eq("user_id", access.user.id)

  if (updateError) {
    return NextResponse.json({ ok: false, error: "device_revoke_failed" }, { status: 500 })
  }

  await admin
    .from("account_sessions")
    .update({ status: "revoked", revoked_at: now })
    .eq("user_id", access.user.id)
    .eq("device_id", parsedBody.data.deviceId)
    .eq("status", "active")

  await recordAccountSecurityEvent({
    userId: access.user.id,
    eventType: "user_device_revoked_self",
    deviceId: parsedBody.data.deviceId,
    ipAddress: getClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: { source: access.mode },
  })
  await evaluateAccountRisk(access.user.id)

  return NextResponse.json({ ok: true })
}
