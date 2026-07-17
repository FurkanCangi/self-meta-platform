import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { EDUCATION_PLAYBACK_CONCURRENCY_WINDOW_SECONDS } from "@/lib/security/videoProtection"

type RpcJson = Record<string, unknown>

export type EducationPlaybackContext = {
  userId: string
  videoId: string
  tokenId: string
  appSessionId: string
  deviceId: string
  playerSessionId: string
}

export type ActiveEducationPlayback = {
  videoId: string | null
  deviceId: string | null
  deviceType: string
  lastHeartbeatAt: string | null
  expiresAt: string | null
}

export type EducationPlaybackClaimStatus =
  | "claimed"
  | "renewed"
  | "same_device_switched"
  | "taken_over"
  | "expired_reclaimed"

export type EducationPlaybackClaimResult =
  | {
      ok: true
      status: EducationPlaybackClaimStatus
      leaseId: string
      leaseVersion: number
      expiresAt: string
    }
  | {
      ok: false
      error: string
      activePlayback?: ActiveEducationPlayback
    }

function asObject(value: unknown): RpcJson {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RpcJson)
    : {}
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null
}

function parseActivePlayback(value: unknown): ActiveEducationPlayback | undefined {
  const row = asObject(value)
  if (Object.keys(row).length === 0) return undefined
  return {
    videoId: readString(row.videoId),
    deviceId: readString(row.deviceId),
    deviceType: readString(row.deviceType) || "unknown",
    lastHeartbeatAt: readString(row.lastHeartbeatAt),
    expiresAt: readString(row.expiresAt),
  }
}

export async function claimEducationPlaybackLease(params: EducationPlaybackContext & {
  admin: SupabaseClient
  force?: boolean
  watermarkCode?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}): Promise<EducationPlaybackClaimResult> {
  const { data, error } = await params.admin.rpc("claim_education_video_playback", {
    p_user_id: params.userId,
    p_video_id: params.videoId,
    p_token_id: params.tokenId,
    p_app_session_id: params.appSessionId,
    p_device_id: params.deviceId,
    p_player_session_id: params.playerSessionId,
    p_force: Boolean(params.force),
    p_ttl_seconds: EDUCATION_PLAYBACK_CONCURRENCY_WINDOW_SECONDS,
    p_watermark_code: params.watermarkCode || null,
    p_ip_address: params.ipAddress || null,
    p_user_agent: params.userAgent || null,
  })

  if (error) {
    return { ok: false, error: "playback_claim_failed" }
  }

  const result = asObject(data)
  if (result.ok !== true) {
    return {
      ok: false,
      error: readString(result.error) || "playback_claim_failed",
      activePlayback: parseActivePlayback(result.activePlayback),
    }
  }

  const leaseId = readString(result.leaseId)
  const expiresAt = readString(result.expiresAt)
  const status = readString(result.status)
  const leaseVersion = Number(result.leaseVersion)
  const allowedStatuses = new Set([
    "claimed",
    "renewed",
    "same_device_switched",
    "taken_over",
    "expired_reclaimed",
  ])

  if (!leaseId || !expiresAt || !status || !allowedStatuses.has(status) || !Number.isFinite(leaseVersion)) {
    return { ok: false, error: "playback_claim_invalid_response" }
  }

  return {
    ok: true,
    status: status as EducationPlaybackClaimStatus,
    leaseId,
    leaseVersion,
    expiresAt,
  }
}

export async function touchEducationPlaybackLease(params: EducationPlaybackContext & {
  admin: SupabaseClient
  leaseId: string
}) {
  const { data, error } = await params.admin.rpc("touch_education_video_playback", {
    p_user_id: params.userId,
    p_video_id: params.videoId,
    p_token_id: params.tokenId,
    p_lease_id: params.leaseId,
    p_app_session_id: params.appSessionId,
    p_device_id: params.deviceId,
    p_player_session_id: params.playerSessionId,
    p_ttl_seconds: EDUCATION_PLAYBACK_CONCURRENCY_WINDOW_SECONDS,
  })

  if (error) return { ok: false as const, error: "playback_touch_failed" }
  const result = asObject(data)
  if (result.ok !== true) {
    return {
      ok: false as const,
      error: readString(result.error) || "playback_lease_lost",
    }
  }

  return {
    ok: true as const,
    leaseVersion: Number(result.leaseVersion) || 0,
    expiresAt: readString(result.expiresAt),
  }
}

export async function releaseEducationPlaybackLease(params: EducationPlaybackContext & {
  admin: SupabaseClient
  leaseId: string
  reason: string
}) {
  const { data, error } = await params.admin.rpc("release_education_video_playback", {
    p_user_id: params.userId,
    p_token_id: params.tokenId,
    p_lease_id: params.leaseId,
    p_app_session_id: params.appSessionId,
    p_device_id: params.deviceId,
    p_player_session_id: params.playerSessionId,
    p_reason: params.reason.slice(0, 80),
  })

  if (error) return { ok: false as const, error: "playback_release_failed" }
  const result = asObject(data)
  return { ok: result.ok === true, released: result.released === true }
}

export async function releaseEducationPlaybackForDevice(params: {
  admin: SupabaseClient
  userId: string
  deviceId: string
  reason?: string
}) {
  const { data, error } = await params.admin.rpc("release_education_playback_for_device", {
    p_user_id: params.userId,
    p_device_id: params.deviceId,
    p_reason: (params.reason || "device_revoked").slice(0, 80),
  })

  if (error) return { ok: false as const, error: "device_playback_release_failed" }
  const result = asObject(data)
  return { ok: result.ok === true, released: result.released === true }
}
