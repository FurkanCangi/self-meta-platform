import { createHash } from "crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import {
  DEVICE_MANAGEMENT_COOKIE,
  PENDING_DEVICE_COOKIE,
  readDeviceManagementToken,
  readPendingDeviceToken,
} from "@/lib/security/deviceManagementAccess"
import { verifyCurrentAppSession } from "@/lib/security/appSession"
import { verifyDevicePossessionForRequest } from "@/lib/security/deviceProof"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, getNetworkRateLimitKey, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import {
  DEVICE_REPLACEMENT_LIMIT,
  DEVICE_REPLACEMENT_WINDOW_DAYS,
  getDeviceReplacementUsage,
  hashDeviceApprovalCode,
  MAX_REGISTERED_DEVICES,
} from "@/lib/security/sessionRegistration"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const deviceActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    deviceId: z.string().uuid(),
    displayName: z.string().trim().min(1).max(80),
  }),
  z.object({
    action: z.literal("revoke"),
    deviceId: z.string().uuid(),
    reason: z.enum(["removed", "not_mine"]).default("removed"),
  }),
  z.object({
    action: z.literal("approve"),
    challengeId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
  }),
  z.object({ action: z.literal("reject"), challengeId: z.string().uuid() }),
])

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headers.get("x-real-ip") || null
}

async function requireDeviceAccess() {
  const cookieStore = await cookies()
  const managementToken = readDeviceManagementToken(
    cookieStore.get(DEVICE_MANAGEMENT_COOKIE)?.value
  )
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  const appSession = !error && user?.id ? await verifyCurrentAppSession(user.id) : null
  if (user?.id && appSession?.ok) {
    return {
      ok: true as const,
      user,
      mode: "active_session" as const,
      sessionId: appSession.sessionId,
      currentDeviceId: appSession.deviceId,
      managementNonce: null,
    }
  }

  const pendingToken = managementToken
    ? readPendingDeviceToken(
        cookieStore.get(PENDING_DEVICE_COOKIE)?.value,
        managementToken.userId
      )
    : null
  if (managementToken) {
    return {
      ok: true as const,
      user: { id: managementToken.userId },
      mode: "device_management" as const,
      sessionId: null,
      currentDeviceId: null,
      pendingToken,
      managementNonce: managementToken.nonce,
    }
  }

  return {
    ok: false as const,
    response: NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 }),
  }
}

function scopedDeviceReadRateLimitKey(access: {
  user: { id: string }
  mode: "active_session" | "device_management"
  sessionId: string | null
  currentDeviceId: string | null
  managementNonce: string | null
  pendingToken?: { challengeId: string; deviceId: string } | null
}) {
  const identity =
    access.mode === "active_session"
      ? [access.user.id, access.sessionId, access.currentDeviceId].join(":")
      : [
          access.user.id,
          access.managementNonce,
          access.pendingToken?.challengeId || "recovery",
          access.pendingToken?.deviceId || "none",
        ].join(":")
  const digest = createHash("sha256").update(identity).digest("base64url")
  return `security-devices-read:${access.mode}:${digest}`
}

function verificationStatus(device: {
  revoked_at?: string | null
  verification_required?: boolean | null
  verified_at?: string | null
}) {
  if (device.revoked_at) return "revoked"
  if (device.verification_required || !device.verified_at) return "pending"
  return "trusted"
}

export async function GET(request: Request) {
  const broadRateLimit = await checkRateLimit({
    key: getNetworkRateLimitKey(request, "security-devices-read-broad"),
    // This is only a coarse abuse ceiling. Each authenticated app session has
    // its own tighter bucket below, so a clinic's shared network cannot make a
    // few approval screens starve one another.
    limit: 1_200,
    windowMs: 10 * 60 * 1000,
  })
  if (!broadRateLimit.ok) return rateLimitResponse(broadRateLimit.resetAt)

  const access = await requireDeviceAccess()
  if (!access.ok) {
    const anonymousRateLimit = await checkRateLimit({
      key: getNetworkRateLimitKey(request, "security-devices-read-anonymous"),
      limit: 60,
      windowMs: 10 * 60 * 1000,
    })
    if (!anonymousRateLimit.ok) return rateLimitResponse(anonymousRateLimit.resetAt)
    return access.response
  }
  const scopedRateLimit = await checkRateLimit({
    key: scopedDeviceReadRateLimitKey(access),
    limit: 120,
    windowMs: 10 * 60 * 1000,
  })
  if (!scopedRateLimit.ok) return rateLimitResponse(scopedRateLimit.resetAt)
  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data: expiredChallenges, error: expireError } = await admin
    .from("account_device_verification_challenges")
    .update({ status: "expired" })
    .eq("user_id", access.user.id)
    .eq("status", "pending")
    .lt("expires_at", now)
    .select("pending_device_id")
  if (expireError) {
    return NextResponse.json({ ok: false, error: "device_challenge_cleanup_failed" }, { status: 500 })
  }
  const expiredDeviceIds = [
    ...new Set((expiredChallenges || []).map((challenge) => challenge.pending_device_id)),
  ]
  if (expiredDeviceIds.length) {
    const { error: staleDeviceError } = await admin
      .from("account_devices")
      .update({ revoked_at: now, verification_required: true, verified_at: null })
      .eq("user_id", access.user.id)
      .in("id", expiredDeviceIds)
      .is("ever_verified_at", null)
    if (staleDeviceError) {
      return NextResponse.json({ ok: false, error: "device_challenge_cleanup_failed" }, { status: 500 })
    }
  }

  const [{ data: deviceRows, error: deviceError }, { data: challengeRows, error: challengeError }, replacement] =
    await Promise.all([
      admin
        .from("account_devices")
        .select(
          "id, display_name, device_type, first_seen_at, last_seen_at, revoked_at, last_user_agent, last_city, last_country, verification_required, verified_at, verification_method"
        )
        .eq("user_id", access.user.id)
        .order("revoked_at", { ascending: true, nullsFirst: true })
        .order("last_seen_at", { ascending: false })
        .limit(30),
      admin
        .from("account_device_verification_challenges")
        .select("id, pending_device_id, status, requested_at, expires_at, attempts, max_attempts")
        .eq("user_id", access.user.id)
        .in("status", access.mode === "active_session" ? ["pending"] : ["pending", "approved", "rejected", "expired", "attempts_exhausted", "device_limit", "replacement_limit"])
        .order("requested_at", { ascending: false })
        .limit(20),
      getDeviceReplacementUsage(admin, access.user.id),
    ])

  if (deviceError || challengeError || replacement.error) {
    return NextResponse.json({ ok: false, error: "devices_unavailable" }, { status: 500 })
  }

  const visibleDeviceRows =
    access.mode === "device_management"
      ? (deviceRows || []).filter((device) => device.id === access.pendingToken?.deviceId)
      : deviceRows || []
  const devices = visibleDeviceRows
  const byId = new Map(devices.map((device) => [device.id, device]))
  const visibleChallenges =
    access.mode === "device_management"
      ? (challengeRows || []).filter((challenge) => challenge.id === access.pendingToken?.challengeId)
      : challengeRows || []
  const pendingApprovals = visibleChallenges.map((challenge) => {
    const device = byId.get(challenge.pending_device_id)
    const pendingToken = access.mode === "device_management" ? access.pendingToken : null
    const isPendingDevice =
      access.mode === "device_management" &&
      pendingToken?.challengeId === challenge.id &&
      pendingToken?.deviceId === challenge.pending_device_id
    return {
      id: challenge.id,
      challengeId: challenge.id,
      deviceId: challenge.pending_device_id,
      displayName: device?.display_name || "Yeni cihaz",
      deviceType: device?.device_type || "unknown",
      requestedAt: challenge.requested_at,
      expiresAt: challenge.expires_at,
      status: challenge.status,
      attemptsRemaining: Math.max(0, Number(challenge.max_attempts || 5) - Number(challenge.attempts || 0)),
      isCurrent: isPendingDevice,
      ...(isPendingDevice && challenge.status === "pending"
        ? { verificationCode: pendingToken?.verificationCode }
        : {}),
    }
  })

  return NextResponse.json({
    ok: true,
    mode: access.mode,
    currentDeviceId: access.currentDeviceId,
    maxDevices: MAX_REGISTERED_DEVICES,
    replacementPolicy: {
      used: replacement.used,
      limit: DEVICE_REPLACEMENT_LIMIT,
      remaining: Math.max(0, DEVICE_REPLACEMENT_LIMIT - replacement.used),
      windowDays: DEVICE_REPLACEMENT_WINDOW_DAYS,
    },
    devices: devices.map((device) => ({
      id: device.id,
      displayName: device.display_name || "Cihaz",
      deviceType: device.device_type || "unknown",
      firstSeenAt: device.first_seen_at,
      lastSeenAt: device.last_seen_at,
      revokedAt: device.revoked_at,
      userAgent: device.last_user_agent,
      location:
        device.last_city || device.last_country
          ? { city: device.last_city || undefined, country: device.last_country || undefined }
          : undefined,
      isCurrent: access.currentDeviceId === device.id,
      isVerified: verificationStatus(device) === "trusted",
      verificationStatus: verificationStatus(device),
      verificationMethod: device.verification_method,
    })),
    pendingApprovals,
  })
}

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError
  const broadRateLimit = await checkRateLimit({
    key: getNetworkRateLimitKey(request, "security-devices-action-broad"),
    limit: 600,
    windowMs: 10 * 60 * 1000,
  })
  if (!broadRateLimit.ok) return rateLimitResponse(broadRateLimit.resetAt)

  const access = await requireDeviceAccess()
  if (!access.ok) return access.response
  if (access.mode !== "active_session") {
    return NextResponse.json({ ok: false, error: "trusted_device_required" }, { status: 403 })
  }
  const scopedRateLimit = await checkRateLimit({
    key: `security-devices-action:${access.user.id}:${access.sessionId}`,
    limit: 90,
    windowMs: 10 * 60 * 1000,
  })
  if (!scopedRateLimit.ok) return rateLimitResponse(scopedRateLimit.resetAt)

  const possession = await verifyDevicePossessionForRequest({
    request,
    userId: access.user.id,
    sessionId: access.sessionId,
    deviceId: access.currentDeviceId,
  })
  if (!possession.ok) {
    return NextResponse.json(
      { ok: false, error: possession.error },
      { status: possession.status }
    )
  }

  const parsed = await readJsonWithSchema(request, deviceActionSchema)
  if (!parsed.ok) return parsed.response
  const payloadGuard = rejectServerControlledFields(parsed.data)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()
  const body = parsed.data
  if (body.action === "rename") {
    const { data, error } = await admin
      .from("account_devices")
      .update({ display_name: body.displayName.trim() })
      .eq("id", body.deviceId)
      .eq("user_id", access.user.id)
      .select("id")
      .maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: "device_rename_failed" }, { status: 500 })
    if (!data) return NextResponse.json({ ok: false, error: "device_not_found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "approve") {
    const codeHash = hashDeviceApprovalCode(access.user.id, body.challengeId, body.code)
    const { data, error } = await admin.rpc("approve_account_device_challenge", {
      p_user_id: access.user.id,
      p_challenge_id: body.challengeId,
      p_code_hash: codeHash,
      p_approver_device_id: access.currentDeviceId,
    })
    if (error) {
      return NextResponse.json({ ok: false, error: "device_approval_failed" }, { status: 500 })
    }
    const outcome = Array.isArray(data) ? data[0]?.result : (data as { result?: string } | null)?.result
    if (outcome !== "approved") {
      const status = outcome === "invalid_code" ? 400 : outcome === "challenge_not_found" ? 404 : 409
      return NextResponse.json({ ok: false, error: outcome || "device_approval_failed" }, { status })
    }
    await recordAccountSecurityEvent({
      userId: access.user.id,
      eventType: "device_approval_completed",
      deviceId: Array.isArray(data) ? data[0]?.approved_device_id : null,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      metadata: { challenge_id: body.challengeId, approver_device_id: access.currentDeviceId },
    })
    return NextResponse.json({ ok: true, status: "approved" })
  }

  if (body.action === "reject") {
    const { data, error } = await admin.rpc("reject_account_device_challenge", {
      p_user_id: access.user.id,
      p_challenge_id: body.challengeId,
      p_approver_device_id: access.currentDeviceId,
    })
    if (error) {
      return NextResponse.json({ ok: false, error: "device_rejection_failed" }, { status: 500 })
    }
    const outcome = Array.isArray(data) ? data[0]?.result : (data as { result?: string } | null)?.result
    const rejectedDeviceId = Array.isArray(data)
      ? data[0]?.rejected_device_id
      : (data as { rejected_device_id?: string } | null)?.rejected_device_id
    if (outcome !== "rejected") {
      const status = outcome === "challenge_not_found" ? 404 : outcome === "invalid_input" ? 400 : 409
      return NextResponse.json({ ok: false, error: outcome || "device_rejection_failed" }, { status })
    }
    await recordAccountSecurityEvent({
      userId: access.user.id,
      eventType: "device_approval_rejected",
      deviceId: rejectedDeviceId || null,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      metadata: { challenge_id: body.challengeId, approver_device_id: access.currentDeviceId },
    })
    return NextResponse.json({ ok: true, status: "rejected" })
  }

  const { data: device, error: lookupError } = await admin
    .from("account_devices")
    .select("id, revoked_at")
    .eq("id", body.deviceId)
    .eq("user_id", access.user.id)
    .maybeSingle()
  if (lookupError) return NextResponse.json({ ok: false, error: "device_lookup_failed" }, { status: 500 })
  if (!device) return NextResponse.json({ ok: false, error: "device_not_found" }, { status: 404 })
  if (device.revoked_at && body.reason !== "not_mine") {
    return NextResponse.json({ ok: true, alreadyRevoked: true })
  }

  const suspendAccount = body.reason === "not_mine"
  const { data: revokeData, error: revokeError } = await admin.rpc(
    "revoke_account_device_security",
    {
      p_user_id: access.user.id,
      p_device_id: body.deviceId,
      p_reason: suspendAccount ? "unknown_device_account_lock" : "device_removed",
      p_suspend_account: suspendAccount,
    }
  )
  const revokeResult = revokeData && typeof revokeData === "object"
    ? (revokeData as Record<string, unknown>)
    : null
  if (revokeError || revokeResult?.ok !== true) {
    return NextResponse.json(
      { ok: false, error: suspendAccount ? "account_security_lock_failed" : "device_revoke_failed" },
      { status: 500 }
    )
  }

  if (suspendAccount) {
    await recordAccountSecurityEvent({
      userId: access.user.id,
      eventType: "user_reported_unknown_device",
      deviceId: body.deviceId,
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      metadata: { source: access.mode, reason: body.reason, account_locked: true },
    })
    return NextResponse.json({
      ok: true,
      currentDeviceRevoked: body.deviceId === access.currentDeviceId,
      accountLocked: true,
    })
  }
  await recordAccountSecurityEvent({
    userId: access.user.id,
    eventType: "user_device_revoked_self",
    deviceId: body.deviceId,
    ipAddress: getClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: { source: access.mode, reason: body.reason },
  })
  return NextResponse.json({ ok: true, currentDeviceRevoked: body.deviceId === access.currentDeviceId })
}
