import { NextResponse } from "next/server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import {
  findEducationVideoAsset,
  getRequestAuditContext,
  recordEducationVideoAccessLog,
  recordEducationVideoPlaybackEvent,
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
  "watermark_rendered",
])

function readString(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const { videoId } = await params
  const rateLimit = await checkRateLimit({
    key: `education-video-events:${auth.user.id}:${videoId}`,
    limit: 240,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit.resetAt)
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
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
  if (!playerSessionId) {
    return NextResponse.json({ ok: false, error: "player_session_id_required" }, { status: 400 })
  }

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
    return NextResponse.json({ ok: false, error: verifiedToken.error }, { status: 401 })
  }

  const auditContext = await getRequestAuditContext()
  const playback = await recordEducationVideoPlaybackEvent({
    admin,
    userId: auth.user.id,
    videoId: asset.id,
    tokenId: verifiedToken.tokenId,
    playerSessionId,
    eventType,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
    watermarkCode: verifiedToken.watermarkCode,
  })

  if (!playback.ok) {
    await recordEducationVideoAccessLog({
      admin,
      userId: auth.user.id,
      videoId: asset.id,
      eventType: playback.error,
      tokenId: verifiedToken.tokenId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      watermarkCode: verifiedToken.watermarkCode,
      metadata: { player_session_id: playerSessionId, requested_event_type: eventType },
    })

    return NextResponse.json(
      { ok: false, error: playback.error },
      { status: playback.error === "concurrent_playback_blocked" ? 409 : 500 }
    )
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
      visible_watermark_code: readString(body.visibleWatermarkCode, 120) || null,
      player_session_id: playerSessionId,
    },
  })

  return NextResponse.json({ ok: true })
}
