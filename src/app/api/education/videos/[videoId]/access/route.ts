import { NextResponse } from "next/server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { evaluateAccountRisk, recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import { EDUCATION_VIDEO_FEATURE, hasActiveEntitlement } from "@/lib/security/entitlements"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import {
  buildEducationVideoWatermark,
  createEducationVideoAccessToken,
  createEducationVideoPlaybackAccess,
  findEducationVideoAsset,
  getRequestAuditContext,
  recordEducationVideoAccessLog,
} from "@/lib/security/videoProtection"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const { videoId } = await params
  const auditContext = await getRequestAuditContext()
  const rateLimit = await checkRateLimit({
    key: `education-video-access:${auth.user.id}:${videoId}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })

  const admin = createSupabaseAdminClient()

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
  })

  const token = await createEducationVideoAccessToken({
    admin,
    userId: auth.user.id,
    videoId: asset.id,
    watermarkCode: watermark.code,
  })

  if (!token.ok) {
    return NextResponse.json({ ok: false, error: token.error }, { status: 500 })
  }

  const playbackAccess = await createEducationVideoPlaybackAccess({
    admin,
    asset,
    userId: auth.user.id,
    ipAddress: auditContext.ipAddress,
  })

  if (!playbackAccess.ok) {
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
