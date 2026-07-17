import { NextResponse } from "next/server"
import { z } from "zod"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { verifyCurrentAppSession } from "@/lib/security/appSession"
import { verifyDevicePossessionForRequest } from "@/lib/security/deviceProof"
import { recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import {
  releaseEducationPlaybackLease,
  touchEducationPlaybackLease,
} from "@/lib/security/educationPlaybackLease"
import { evaluateEducationNetworkPolicy } from "@/lib/security/educationNetworkPolicy"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import {
  findEducationVideoAsset,
  getRequestAuditContext,
  recordEducationVideoAccessLog,
  verifyEducationVideoAccessToken,
} from "@/lib/security/videoProtection"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const ALLOWED_VIDEO_EVENTS = new Set([
  "player_loaded",
  "play",
  "pause",
  "heartbeat",
  "seek",
  "complete",
  "error",
  "release",
  "watermark_rendered",
])

const RELEASE_EVENTS = new Set(["complete", "error", "release"])

const videoEventPayloadSchema = z
  .object({
    eventType: z.string().max(64),
    accessToken: z.string().max(300),
    leaseId: z.string().uuid(),
    playerSessionId: z.string().trim().min(1).max(120),
    playbackSeconds: z.union([z.number(), z.string()]).optional().nullable(),
    durationSeconds: z.union([z.number(), z.string()]).optional().nullable(),
    visibleWatermarkCode: z.string().max(180).optional().nullable(),
  })
  .passthrough()

function readString(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength)
}

function networkMetadata(network: ReturnType<typeof evaluateEducationNetworkPolicy>) {
  return {
    policy_mode: network.mode,
    policy_reason: network.reason,
    matched_source: network.matchedSource || null,
    list_age_days: network.listAgeDays,
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response
  const possessionRequest = request.clone()

  const { videoId } = await params
  const rateLimit = await checkRateLimit({
    key: `education-video-events:${auth.user.id}`,
    limit: 240,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsedBody = await readJsonWithSchema(request, videoEventPayloadSchema)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.data

  const payloadGuard = rejectServerControlledFields(body)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 }
    )
  }

  const eventType = readString(body.eventType, 64)
  if (!ALLOWED_VIDEO_EVENTS.has(eventType)) {
    return NextResponse.json({ ok: false, error: "event_type_invalid" }, { status: 400 })
  }

  const accessToken = readString(body.accessToken, 300)
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "access_token_required" }, { status: 400 })
  }

  const playerSessionId = readString(body.playerSessionId, 120)
  const leaseId = readString(body.leaseId, 80)
  const admin = createSupabaseAdminClient()
  const { asset, error: assetError } = await findEducationVideoAsset(admin, videoId)
  if (assetError || !asset) {
    return NextResponse.json({ ok: false, error: assetError || "video_not_found" }, { status: 404 })
  }

  const verifiedToken = await verifyEducationVideoAccessToken({
    admin,
    userId: auth.user.id,
    videoId: asset.id,
    token: accessToken,
  })

  if (!verifiedToken.ok) {
    if (verifiedToken.error === "token_revoked") {
      return NextResponse.json({ ok: false, error: "playback_lease_lost" }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: verifiedToken.error }, { status: 401 })
  }

  const currentSession = await verifyCurrentAppSession(auth.user.id)
  if (!currentSession.ok) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 })
  }

  if (eventType !== "release") {
    const possession = await verifyDevicePossessionForRequest({
      request: possessionRequest,
      userId: auth.user.id,
      sessionId: currentSession.sessionId,
      deviceId: currentSession.deviceId,
    })
    if (!possession.ok) {
      return NextResponse.json(
        { ok: false, error: possession.error },
        { status: possession.status }
      )
    }
  }

  const { data: sessionRow, error: sessionError } = await admin
    .from("account_sessions")
    .select("id, device_id")
    .eq("id", currentSession.sessionId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle()

  if (sessionError || !sessionRow?.device_id) {
    return NextResponse.json({ ok: false, error: "app_session_invalid" }, { status: 401 })
  }

  const auditContext = await getRequestAuditContext()
  const network = evaluateEducationNetworkPolicy(request.headers)
  const playbackContext = {
    admin,
    userId: auth.user.id,
    videoId: asset.id,
    tokenId: verifiedToken.tokenId,
    appSessionId: String(sessionRow.id),
    deviceId: String(sessionRow.device_id),
    playerSessionId,
  }

  // Access issuance already records the observe decision. Avoid creating a
  // duplicate account-security row every 25 seconds while still logging an
  // actual enforcement block immediately.
  if (network.shouldAudit && (network.action === "block" || eventType !== "heartbeat")) {
    await recordAccountSecurityEvent({
      userId: auth.user.id,
      eventType: network.action === "block" ? "education_network_blocked" : "education_network_observed",
      deviceId: playbackContext.deviceId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { route: "education_video_event", video_id: asset.id, event_type: eventType, ...networkMetadata(network) },
    })
  }

  if (network.action === "block") {
    await releaseEducationPlaybackLease({
      ...playbackContext,
      leaseId,
      reason: "education_network_blocked",
    })
    await recordEducationVideoAccessLog({
      admin,
      userId: auth.user.id,
      videoId: asset.id,
      eventType: "education_network_blocked",
      tokenId: verifiedToken.tokenId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      watermarkCode: verifiedToken.watermarkCode,
      metadata: { lease_id: leaseId, player_session_id: playerSessionId, ...networkMetadata(network) },
    })
    return NextResponse.json({ ok: false, error: "education_network_blocked" }, { status: 403 })
  }

  const playback = RELEASE_EVENTS.has(eventType)
    ? await releaseEducationPlaybackLease({
        ...playbackContext,
        leaseId,
        reason: eventType === "complete" ? "completed" : eventType === "error" ? "player_error" : "client_released",
      })
    : await touchEducationPlaybackLease({ ...playbackContext, leaseId })

  if (!playback.ok) {
    const error = "error" in playback && playback.error ? playback.error : "playback_event_failed"
    await recordEducationVideoAccessLog({
      admin,
      userId: auth.user.id,
      videoId: asset.id,
      eventType: error,
      tokenId: verifiedToken.tokenId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      watermarkCode: verifiedToken.watermarkCode,
      metadata: { player_session_id: playerSessionId, lease_id: leaseId, requested_event_type: eventType },
    })

    const status = error === "playback_lease_lost" ? 409 : 500
    return NextResponse.json({ ok: false, error }, { status })
  }

  await recordEducationVideoAccessLog({
    admin,
    userId: auth.user.id,
    videoId: asset.id,
    eventType,
    tokenId: verifiedToken.tokenId,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
    watermarkCode: verifiedToken.watermarkCode,
    metadata: {
      playback_seconds: Number.isFinite(Number(body.playbackSeconds)) ? Number(body.playbackSeconds) : null,
      duration_seconds: Number.isFinite(Number(body.durationSeconds)) ? Number(body.durationSeconds) : null,
      visible_watermark_code: readString(body.visibleWatermarkCode, 180) || null,
      player_session_id: playerSessionId,
      lease_id: leaseId,
      ...networkMetadata(network),
    },
  })

  return NextResponse.json({ ok: true, released: RELEASE_EVENTS.has(eventType) })
}
