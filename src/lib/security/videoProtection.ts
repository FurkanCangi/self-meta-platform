import "server-only"

import { createHash, createHmac, randomBytes } from "crypto"
import { headers } from "next/headers"
import type { SupabaseClient, User } from "@supabase/supabase-js"

export const EDUCATION_VIDEO_TOKEN_TTL_SECONDS = 5 * 60
export const EDUCATION_VIDEO_SIGNED_URL_TTL_SECONDS = 2 * 60
export const EDUCATION_WATERMARK_REFRESH_SECONDS = 45
export const EDUCATION_PLAYBACK_CONCURRENCY_WINDOW_SECONDS = 90
export const EDUCATION_VIDEO_HEARTBEAT_INTERVAL_SECONDS = 25

export type EducationVideoProvider = "supabase" | "bunny" | "mock"
export type EducationVideoPlaybackPolicy = "signed_url" | "signed_embed" | "signed_hls" | "mock"
export type EducationVideoProviderStatus = "draft" | "processing" | "ready" | "failed"

export type EducationVideoAsset = {
  id: string
  slug: string
  title: string | null
  storage_bucket: string | null
  storage_path: string | null
  hls_manifest_path: string | null
  required_plan: string | null
  is_active: boolean
  provider?: string | null
  provider_asset_id?: string | null
  provider_library_id?: string | null
  playback_policy?: string | null
  provider_status?: string | null
}

export type EducationVideoWatermark = {
  code: string
  displayText: string
  qrPayload: string
  refreshSeconds: number
  positionSeed: string
}

export type EducationVideoPlaybackAccess = {
  provider: EducationVideoProvider
  playbackToken: string | null
  playbackUrl: string | null
  embedUrl: string | null
  expiresAt: string
  playerConfig: {
    mode: "native" | "iframe"
    heartbeatIntervalSeconds: number
    watermarkRefreshSeconds: number
    playbackPolicy: EducationVideoPlaybackPolicy
    providerStatus: EducationVideoProviderStatus
    allowFullscreen: boolean
  }
  signedUrl: string | null
  signedUrlTtlSeconds: number | null
}

export function hashVideoAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function base64UrlEncode(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function normalizeProvider(value?: string | null): EducationVideoProvider | null {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "supabase" || normalized === "bunny" || normalized === "mock") {
    return normalized
  }
  return null
}

function normalizePlaybackPolicy(value?: string | null): EducationVideoPlaybackPolicy | null {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "signed_url" || normalized === "signed_embed" || normalized === "signed_hls" || normalized === "mock") {
    return normalized
  }
  return null
}

function normalizeProviderStatus(value?: string | null): EducationVideoProviderStatus {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "processing" || normalized === "ready" || normalized === "failed") {
    return normalized
  }
  return "draft"
}

function resolveEducationVideoProvider(asset: EducationVideoAsset): EducationVideoProvider {
  const envProvider = normalizeProvider(process.env.VIDEO_PROVIDER)
  if (envProvider === "mock") return "mock"
  return normalizeProvider(asset.provider) || envProvider || "supabase"
}

function shouldUseBunnyIpLock() {
  return String(process.env.BUNNY_STREAM_IP_LOCK || "")
    .trim()
    .toLowerCase() === "true"
}

export function getHeaderIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null
  return headerStore.get("x-real-ip") || null
}

export async function getRequestAuditContext() {
  const headerStore = await headers()
  return {
    ipAddress: getHeaderIp(headerStore),
    userAgent: String(headerStore.get("user-agent") || "").slice(0, 500),
  }
}

export function buildEducationVideoWatermark(params: {
  user: User
  videoId: string
  issuedAt?: Date
}): EducationVideoWatermark {
  const issuedAt = params.issuedAt || new Date()
  const email = String(params.user.email || "")
  const [localPart = "user", domain = ""] = email.split("@")
  const maskedEmail = `${localPart.slice(0, 3)}***${domain ? `@${domain}` : ""}`
  const timestamp = issuedAt.toISOString().replace(/[-:T.Z]/g, "").slice(0, 12)
  const userFragment = params.user.id.replace(/-/g, "").slice(0, 8).toUpperCase()
  const videoFragment = params.videoId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "VIDEO"
  const randomFragment = randomBytes(3).toString("hex").toUpperCase()
  const code = `SM-${userFragment}-${videoFragment}-${timestamp}-${randomFragment}`

  return {
    code,
    displayText: `${maskedEmail} | ${code}`,
    qrPayload: JSON.stringify({
      c: code,
      u: userFragment,
      v: params.videoId,
      t: issuedAt.toISOString(),
    }),
    refreshSeconds: EDUCATION_WATERMARK_REFRESH_SECONDS,
    positionSeed: createHash("sha256")
      .update(`${params.user.id}:${params.videoId}:${timestamp}:${randomFragment}`)
      .digest("hex")
      .slice(0, 16),
  }
}

export async function findEducationVideoAsset(
  admin: SupabaseClient,
  videoId: string
): Promise<{ asset: EducationVideoAsset | null; error: string | null }> {
  const normalized = String(videoId || "").trim()
  if (!normalized || normalized.length > 120) {
    return { asset: null, error: "video_id_invalid" }
  }

  let query = admin
    .from("education_video_assets")
    .select("*")
    .limit(1)

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    query = query.eq("id", normalized)
  } else {
    query = query.eq("slug", normalized)
  }

  const { data, error } = await query.maybeSingle()
  if (error) return { asset: null, error: "video_lookup_failed" }
  if (!data?.is_active) return { asset: null, error: "video_not_found" }
  return { asset: data as EducationVideoAsset, error: null }
}

export async function createEducationVideoAccessToken(params: {
  admin: SupabaseClient
  userId: string
  videoId: string
  watermarkCode: string
}) {
  const rawToken = randomBytes(32).toString("base64url")
  const tokenHash = hashVideoAccessToken(rawToken)
  const expiresAt = new Date(Date.now() + EDUCATION_VIDEO_TOKEN_TTL_SECONDS * 1000).toISOString()

  const { data, error } = await params.admin
    .from("education_video_access_tokens")
    .insert({
      user_id: params.userId,
      video_id: params.videoId,
      token_hash: tokenHash,
      watermark_code: params.watermarkCode,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single()

  if (error || !data?.id) {
    return { ok: false as const, error: "token_create_failed" }
  }

  return {
    ok: true as const,
    token: rawToken,
    tokenId: String(data.id),
    expiresAt: String(data.expires_at),
  }
}

export async function verifyEducationVideoAccessToken(params: {
  admin: SupabaseClient
  userId: string
  videoId: string
  token: string
}) {
  const tokenHash = hashVideoAccessToken(params.token)
  const { data, error } = await params.admin
    .from("education_video_access_tokens")
    .select("id, expires_at, revoked_at, watermark_code, video_id")
    .eq("user_id", params.userId)
    .eq("video_id", params.videoId)
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (error || !data?.id) return { ok: false as const, error: "token_invalid" }
  if (data.revoked_at) return { ok: false as const, error: "token_revoked" }
  if (new Date(String(data.expires_at)).getTime() <= Date.now()) {
    return { ok: false as const, error: "token_expired" }
  }

  await params.admin
    .from("education_video_access_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id)

  return {
    ok: true as const,
    tokenId: String(data.id),
    watermarkCode: String(data.watermark_code || ""),
  }
}

async function createEducationVideoSignedUrl(params: {
  admin: SupabaseClient
  asset: EducationVideoAsset
}) {
  const path = params.asset.hls_manifest_path || params.asset.storage_path
  if (!path) return { ok: true as const, signedUrl: null }

  const bucket = params.asset.storage_bucket || process.env.EDUCATION_VIDEO_BUCKET || "education-videos"
  const { data, error } = await params.admin.storage
    .from(bucket)
    .createSignedUrl(path, EDUCATION_VIDEO_SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) return { ok: false as const, error: "signed_url_failed" }
  return { ok: true as const, signedUrl: data.signedUrl }
}

function buildBunnyEmbedToken(params: {
  securityKey: string
  videoId: string
  expiresAtUnix: number
}) {
  return createHash("sha256")
    .update(`${params.securityKey}${params.videoId}${params.expiresAtUnix}`)
    .digest("hex")
}

function buildBunnyDirectoryToken(params: {
  securityKey: string
  tokenPath: string
  expiresAtUnix: number
  userIp?: string | null
}) {
  const signature = createHmac("sha256", params.securityKey)
    .update(`${params.tokenPath}${params.expiresAtUnix}${params.userIp || ""}`)
    .digest()
  return `HS256-${base64UrlEncode(signature)}`
}

function buildBunnyPathTokenUrl(params: {
  pullZone: string
  videoId: string
  expiresAtUnix: number
  userIp?: string | null
}) {
  const signingKey = process.env.BUNNY_STREAM_SIGNING_KEY
  if (!signingKey) return { ok: false as const, error: "bunny_signing_key_missing" }

  const tokenPath = `/${params.videoId}/`
  const token = buildBunnyDirectoryToken({
    securityKey: signingKey,
    tokenPath,
    expiresAtUnix: params.expiresAtUnix,
    userIp: params.userIp,
  })

  const encodedPath = encodeURIComponent(tokenPath)
  return {
    ok: true as const,
    playbackUrl: `https://${params.pullZone}.b-cdn.net/bcdn_token=${token}&expires=${params.expiresAtUnix}&token_path=${encodedPath}${tokenPath.slice(1)}playlist.m3u8`,
    token,
  }
}

export async function createEducationVideoPlaybackAccess(params: {
  admin: SupabaseClient
  asset: EducationVideoAsset
  userId: string
  ipAddress?: string | null
}) {
  const expiresAt = new Date(Date.now() + EDUCATION_VIDEO_SIGNED_URL_TTL_SECONDS * 1000)
  const expiresAtIso = expiresAt.toISOString()
  const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000)
  const provider = resolveEducationVideoProvider(params.asset)
  const providerStatus = normalizeProviderStatus(params.asset.provider_status)
  const playbackPolicy =
    normalizePlaybackPolicy(params.asset.playback_policy) ||
    (provider === "bunny" ? "signed_embed" : provider === "mock" ? "mock" : "signed_url")

  if (provider === "mock") {
    return {
      ok: true as const,
      access: {
        provider,
        playbackToken: `mock-playback-${params.asset.id}-${expiresAtUnix}`,
        playbackUrl: `https://mock.dna-intelligence.local/video/${params.asset.id}/playlist.m3u8`,
        embedUrl: null,
        expiresAt: expiresAtIso,
        playerConfig: {
          mode: "native" as const,
          heartbeatIntervalSeconds: EDUCATION_VIDEO_HEARTBEAT_INTERVAL_SECONDS,
          watermarkRefreshSeconds: EDUCATION_WATERMARK_REFRESH_SECONDS,
          playbackPolicy: "mock" as const,
          providerStatus,
          allowFullscreen: true,
        },
        signedUrl: null,
        signedUrlTtlSeconds: EDUCATION_VIDEO_SIGNED_URL_TTL_SECONDS,
      },
    }
  }

  if (provider === "bunny") {
    const libraryId =
      String(params.asset.provider_library_id || process.env.BUNNY_STREAM_LIBRARY_ID || "").trim()
    const assetId = String(params.asset.provider_asset_id || "").trim()

    if (providerStatus !== "ready") {
      return { ok: false as const, error: "video_provider_not_ready" }
    }

    if (!libraryId || !assetId) {
      return { ok: false as const, error: "bunny_provider_not_ready" }
    }

    if (playbackPolicy === "signed_hls") {
      const pullZone = String(process.env.BUNNY_STREAM_PULL_ZONE || "").trim()
      if (!pullZone) return { ok: false as const, error: "bunny_pull_zone_missing" }

      const playbackUrl = buildBunnyPathTokenUrl({
        pullZone,
        videoId: assetId,
        expiresAtUnix,
        userIp: shouldUseBunnyIpLock() ? params.ipAddress : null,
      })

      if (!playbackUrl.ok) {
        return { ok: false as const, error: playbackUrl.error }
      }

      return {
        ok: true as const,
        access: {
          provider,
          playbackToken: playbackUrl.token,
          playbackUrl: playbackUrl.playbackUrl,
          embedUrl: null,
          expiresAt: expiresAtIso,
          playerConfig: {
            mode: "native" as const,
            heartbeatIntervalSeconds: EDUCATION_VIDEO_HEARTBEAT_INTERVAL_SECONDS,
            watermarkRefreshSeconds: EDUCATION_WATERMARK_REFRESH_SECONDS,
            playbackPolicy,
            providerStatus,
            allowFullscreen: true,
          },
          signedUrl: null,
          signedUrlTtlSeconds: EDUCATION_VIDEO_SIGNED_URL_TTL_SECONDS,
        },
      }
    }

    const signingKey = process.env.BUNNY_STREAM_SIGNING_KEY
    if (!signingKey) {
      return { ok: false as const, error: "bunny_signing_key_missing" }
    }

    const embedToken = buildBunnyEmbedToken({
      securityKey: signingKey,
      videoId: assetId,
      expiresAtUnix,
    })

    const embedUrl = `https://player.mediadelivery.net/embed/${libraryId}/${assetId}?token=${embedToken}&expires=${expiresAtUnix}&autoplay=false&preload=true&playsinline=true`
    return {
      ok: true as const,
      access: {
        provider,
        playbackToken: embedToken,
        playbackUrl: null,
        embedUrl,
        expiresAt: expiresAtIso,
        playerConfig: {
          mode: "iframe" as const,
          heartbeatIntervalSeconds: EDUCATION_VIDEO_HEARTBEAT_INTERVAL_SECONDS,
          watermarkRefreshSeconds: EDUCATION_WATERMARK_REFRESH_SECONDS,
          playbackPolicy: "signed_embed" as const,
          providerStatus,
          allowFullscreen: true,
        },
        signedUrl: null,
        signedUrlTtlSeconds: null,
      },
    }
  }

  const signedUrl = await createEducationVideoSignedUrl({
    admin: params.admin,
    asset: params.asset,
  })

  if (!signedUrl.ok) return signedUrl

  return {
    ok: true as const,
    access: {
      provider: "supabase" as const,
      playbackToken: null,
      playbackUrl: signedUrl.signedUrl,
      embedUrl: null,
      expiresAt: expiresAtIso,
      playerConfig: {
        mode: "native" as const,
        heartbeatIntervalSeconds: EDUCATION_VIDEO_HEARTBEAT_INTERVAL_SECONDS,
        watermarkRefreshSeconds: EDUCATION_WATERMARK_REFRESH_SECONDS,
        playbackPolicy: "signed_url" as const,
        providerStatus,
        allowFullscreen: true,
      },
      signedUrl: signedUrl.signedUrl,
      signedUrlTtlSeconds: signedUrl.signedUrl ? EDUCATION_VIDEO_SIGNED_URL_TTL_SECONDS : null,
    },
  }
}

export async function recordEducationVideoAccessLog(params: {
  admin: SupabaseClient
  userId: string
  videoId: string
  eventType: string
  tokenId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  watermarkCode?: string | null
  metadata?: Record<string, unknown>
}) {
  await params.admin.from("education_video_access_logs").insert({
    user_id: params.userId,
    video_id: params.videoId,
    event_type: params.eventType,
    token_id: params.tokenId || null,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent || null,
    watermark_code: params.watermarkCode || null,
    metadata: params.metadata || {},
  })
}

export async function recordEducationVideoPlaybackEvent(params: {
  admin: SupabaseClient
  userId: string
  videoId: string
  tokenId: string
  playerSessionId: string
  eventType: string
  ipAddress?: string | null
  userAgent?: string | null
  watermarkCode?: string | null
}) {
  const cutoff = new Date(Date.now() - EDUCATION_PLAYBACK_CONCURRENCY_WINDOW_SECONDS * 1000).toISOString()
  const { data: activeSessions, error: activeError } = await params.admin
    .from("education_video_playback_sessions")
    .select("id, player_session_id")
    .eq("user_id", params.userId)
    .eq("video_id", params.videoId)
    .is("ended_at", null)
    .gte("last_heartbeat_at", cutoff)
    .neq("player_session_id", params.playerSessionId)
    .limit(1)

  if (activeError) return { ok: false as const, error: "playback_session_lookup_failed" }

  if ((activeSessions || []).length > 0) {
    return { ok: false as const, error: "concurrent_playback_blocked" }
  }

  const now = new Date().toISOString()
  const endedAt = params.eventType === "complete" ? now : null
  const { error } = await params.admin.from("education_video_playback_sessions").upsert(
    {
      user_id: params.userId,
      video_id: params.videoId,
      token_id: params.tokenId,
      player_session_id: params.playerSessionId,
      last_heartbeat_at: now,
      ended_at: endedAt,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
      watermark_code: params.watermarkCode || null,
      updated_at: now,
    },
    { onConflict: "user_id,video_id,player_session_id" }
  )

  if (error) return { ok: false as const, error: "playback_session_store_failed" }
  return { ok: true as const }
}
