import { NextResponse } from "next/server"
import { z } from "zod"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { verifyCurrentAppSession } from "@/lib/security/appSession"
import { verifyDevicePossessionForRequest } from "@/lib/security/deviceProof"
import { evaluateAccountRisk, recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import {
  claimEducationPlaybackLease,
  releaseEducationPlaybackLease,
  touchEducationPlaybackLease,
} from "@/lib/security/educationPlaybackLease"
import { evaluateEducationNetworkPolicy } from "@/lib/security/educationNetworkPolicy"
import { EDUCATION_VIDEO_FEATURE, hasActiveEntitlement } from "@/lib/security/entitlements"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import {
  buildEducationVideoWatermark,
  createEducationVideoAccessToken,
  createEducationVideoPlaybackAccess,
  findEducationVideoAsset,
  getRequestAuditContext,
  recordEducationVideoAccessLog,
  revokeEducationVideoAccessToken,
} from "@/lib/security/videoProtection"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const videoAccessPayloadSchema = z
  .object({
    playerSessionId: z.string().trim().min(1).max(120),
    takeover: z.boolean().optional().default(false),
  })
  .passthrough()

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

  const currentSession = await verifyCurrentAppSession(auth.user.id)
  if (!currentSession.ok) {
    return NextResponse.json({ ok: false, error: "Session expired" }, { status: 401 })
  }
  const possession = await verifyDevicePossessionForRequest({
    request,
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

  const parsedBody = await readJsonWithSchema(request, videoAccessPayloadSchema)
  if (!parsedBody.ok) return parsedBody.response

  const payloadGuard = rejectServerControlledFields(parsedBody.data)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 }
    )
  }

  const { videoId } = await params
  const { playerSessionId, takeover } = parsedBody.data
  const auditContext = await getRequestAuditContext()
  const network = evaluateEducationNetworkPolicy(request.headers)
  const rateLimit = await checkRateLimit({
    key: `education-video-access:${auth.user.id}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateLimit.ok) {
    await recordAccountSecurityEvent({
      userId: auth.user.id,
      eventType: "api_rate_limited",
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { route: "education_video_access", video_id: videoId },
    })
    await evaluateAccountRisk(auth.user.id)
    return rateLimitResponse(rateLimit.resetAt)
  }

  if (network.shouldAudit) {
    await recordAccountSecurityEvent({
      userId: auth.user.id,
      eventType: network.action === "block" ? "education_network_blocked" : "education_network_observed",
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { route: "education_video_access", video_id: videoId, ...networkMetadata(network) },
    })
  }

  if (network.action === "block") {
    return NextResponse.json({ ok: false, error: "education_network_blocked" }, { status: 403 })
  }

  const admin = createSupabaseAdminClient()
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

  const appSessionId = String(sessionRow.id)
  const deviceId = String(sessionRow.device_id)
  const { asset, error: assetError } = await findEducationVideoAsset(admin, videoId)
  if (assetError || !asset) {
    return NextResponse.json({ ok: false, error: assetError || "video_not_found" }, { status: 404 })
  }

  const entitlement = await hasActiveEntitlement({
    admin,
    userId: auth.user.id,
    feature: EDUCATION_VIDEO_FEATURE,
  })

  if (!entitlement.ok) {
    await recordEducationVideoAccessLog({
      admin,
      userId: auth.user.id,
      videoId: asset.id,
      eventType: "access_denied_entitlement",
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        video_slug: asset.slug,
        required_plan: asset.required_plan,
        error: entitlement.error,
      },
    })

    return NextResponse.json({ ok: false, error: entitlement.error }, { status: 403 })
  }

  const watermark = buildEducationVideoWatermark({
    user: auth.user,
    videoId: asset.id,
    playerSessionId,
  })

  const token = await createEducationVideoAccessToken({
    admin,
    userId: auth.user.id,
    videoId: asset.id,
    watermarkCode: watermark.code,
    appSessionId,
    deviceId,
    playerSessionId,
  })

  if (!token.ok) {
    return NextResponse.json({ ok: false, error: token.error }, { status: 500 })
  }

  const playbackContext = {
    admin,
    userId: auth.user.id,
    videoId: asset.id,
    tokenId: token.tokenId,
    appSessionId,
    deviceId,
    playerSessionId,
  }
  const claim = await claimEducationPlaybackLease({
    ...playbackContext,
    force: takeover,
    watermarkCode: watermark.code,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  })

  if (!claim.ok) {
    await revokeEducationVideoAccessToken({ admin, userId: auth.user.id, tokenId: token.tokenId })

    let activeVideoTitle: string | null = null
    if (claim.activePlayback?.videoId) {
      const { data: activeVideo } = await admin
        .from("education_video_assets")
        .select("title")
        .eq("id", claim.activePlayback.videoId)
        .maybeSingle()
      activeVideoTitle = activeVideo?.title ? String(activeVideo.title) : null
    }

    await recordEducationVideoAccessLog({
      admin,
      userId: auth.user.id,
      videoId: asset.id,
      eventType: claim.error,
      tokenId: token.tokenId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      watermarkCode: watermark.code,
      metadata: {
        player_session_id: playerSessionId,
        takeover,
        active_video_id: claim.activePlayback?.videoId || null,
        active_device_type: claim.activePlayback?.deviceType || null,
      },
    })

    if (claim.error === "active_playback_exists") {
      return NextResponse.json(
        {
          ok: false,
          error: "active_playback_exists",
          activePlayback: claim.activePlayback
            ? {
                videoId: claim.activePlayback.videoId,
                videoTitle: activeVideoTitle,
                deviceType: claim.activePlayback.deviceType,
                lastHeartbeatAt: claim.activePlayback.lastHeartbeatAt,
              }
            : null,
        },
        { status: 409 }
      )
    }

    const status = claim.error === "app_session_invalid" ? 401 : claim.error === "device_not_verified" ? 403 : 500
    return NextResponse.json({ ok: false, error: claim.error }, { status })
  }

  const playbackAccess = await createEducationVideoPlaybackAccess({
    admin,
    asset,
    userId: auth.user.id,
    ipAddress: auditContext.ipAddress,
  })

  if (!playbackAccess.ok) {
    await releaseEducationPlaybackLease({
      ...playbackContext,
      leaseId: claim.leaseId,
      reason: "provider_access_failed",
    })
    await revokeEducationVideoAccessToken({ admin, userId: auth.user.id, tokenId: token.tokenId })

    await recordEducationVideoAccessLog({
      admin,
      userId: auth.user.id,
      videoId: asset.id,
      eventType: playbackAccess.error,
      tokenId: token.tokenId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      watermarkCode: watermark.code,
      metadata: { video_slug: asset.slug, provider: asset.provider || process.env.VIDEO_PROVIDER || "supabase" },
    })
    return NextResponse.json({ ok: false, error: playbackAccess.error }, { status: 500 })
  }

  // The provider call happens after the atomic claim. Re-check before returning
  // the URL so a takeover racing with URL generation cannot leak a usable link.
  const confirmedLease = await touchEducationPlaybackLease({
    ...playbackContext,
    leaseId: claim.leaseId,
  })
  if (!confirmedLease.ok) {
    await revokeEducationVideoAccessToken({ admin, userId: auth.user.id, tokenId: token.tokenId })
    await recordEducationVideoAccessLog({
      admin,
      userId: auth.user.id,
      videoId: asset.id,
      eventType: confirmedLease.error,
      tokenId: token.tokenId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      watermarkCode: watermark.code,
      metadata: { player_session_id: playerSessionId, lease_id: claim.leaseId, phase: "provider_access_confirm" },
    })
    return NextResponse.json(
      { ok: false, error: confirmedLease.error },
      { status: confirmedLease.error === "playback_lease_lost" ? 409 : 500 }
    )
  }

  await recordEducationVideoAccessLog({
    admin,
    userId: auth.user.id,
    videoId: asset.id,
    eventType: "access_token_issued",
    tokenId: token.tokenId,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
    watermarkCode: watermark.code,
    metadata: {
      video_slug: asset.slug,
      entitlement_plan: entitlement.planCode,
      provider: playbackAccess.access.provider,
      playback_policy: playbackAccess.access.playerConfig.playbackPolicy,
      provider_status: playbackAccess.access.playerConfig.providerStatus,
      signed_url_issued: Boolean(playbackAccess.access.signedUrl),
      player_session_id: playerSessionId,
      device_id: deviceId,
      lease_id: claim.leaseId,
      lease_status: claim.status,
      takeover,
      ...networkMetadata(network),
    },
  })

  return NextResponse.json({
    ok: true,
    video: {
      id: asset.id,
      slug: asset.slug,
      title: asset.title,
    },
    access: {
      token: token.token,
      tokenExpiresAt: token.expiresAt,
      leaseId: claim.leaseId,
      leaseExpiresAt: claim.expiresAt,
      playerSessionId,
      provider: playbackAccess.access.provider,
      playbackToken: playbackAccess.access.playbackToken,
      playbackUrl: playbackAccess.access.playbackUrl,
      embedUrl: playbackAccess.access.embedUrl,
      expiresAt: playbackAccess.access.expiresAt,
      playerConfig: playbackAccess.access.playerConfig,
      signedUrl: playbackAccess.access.signedUrl,
      signedUrlTtlSeconds: playbackAccess.access.signedUrlTtlSeconds,
    },
    watermark,
  })
}
