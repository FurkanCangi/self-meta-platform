import "server-only"

import { createHash, createHmac, randomInt } from "crypto"
import type { User } from "@supabase/supabase-js"
import { isSecurityLockExemptUser, recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import { APP_SESSION_MAX_AGE_SECONDS } from "@/lib/security/appSession"
import {
  type SubmittedDeviceProof,
  type VerifiedDeviceProof,
  verifySubmittedDeviceProof,
} from "@/lib/security/deviceProof"
import { isDeviceApprovalExemptEmail } from "@/lib/owner/ownerAccess"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export const MAX_REGISTERED_DEVICES = 3
export const DEVICE_REPLACEMENT_LIMIT = 2
export const DEVICE_REPLACEMENT_WINDOW_DAYS = 30
export const DEVICE_APPROVAL_MAX_AGE_SECONDS = 10 * 60
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AppSessionDeviceType = "desktop" | "mobile" | "tablet" | "unknown"

export type RegisterAppSessionResult =
  | {
      ok: true
      status: "active"
      sessionId: string
      deviceId: string
      maxDevices: number
    }
  | {
      ok: true
      status: "approval_required"
      deviceId: string
      challengeId: string
      approvalCode: string
      expiresAt: string
      maxDevices: number
    }
  | {
      ok: false
      status: "device_limit" | "replacement_limit" | "error"
      error: string
      httpStatus: number
      message?: string
    }

export type RegisterAppSessionInput = SubmittedDeviceProof & {
  user: User
  requestHeaders: Headers
  authSessionId: string
  authorizedLegacyDeviceRecordId?: string | null
  deviceId: string
  deviceType?: string
}

type AccountDeviceRow = {
  id: string
  device_fingerprint_hash: string
  device_type: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  revoked_at: string | null
  verification_required: boolean | null
  verified_at: string | null
  verification_method: string | null
  legacy_transition_until: string | null
  public_key_fingerprint: string | null
  ever_verified_at: string | null
  last_user_agent: string | null
  last_ip: string | null
}

export function normalizeDeviceType(value: unknown): AppSessionDeviceType {
  const raw = String(value || "").toLowerCase().trim()
  if (raw === "desktop" || raw === "mobile" || raw === "tablet") return raw
  return "unknown"
}

export function hashDeviceId(userId: string, deviceId: string) {
  return createHash("sha256").update(`${userId}:${deviceId}`).digest("hex")
}

function approvalSecret() {
  const configured =
    process.env.DEVICE_APPROVAL_SECRET ||
    process.env.AUTH_STATE_SECRET ||
    process.env.SUPABASE_JWT_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV !== "production") return "dna-local-device-approval-secret"
  throw new Error("DEVICE_APPROVAL_SECRET is required in production")
}

export function hashDeviceApprovalCode(userId: string, challengeId: string, code: string) {
  return createHmac("sha256", approvalSecret())
    .update(`${userId}:${challengeId}:${code}`)
    .digest("hex")
}

function clientMetadata(headers: Headers) {
  const trustedVercelRequest = Boolean(headers.get("x-vercel-id"))
  const forwardedFor = headers.get("x-vercel-forwarded-for") || headers.get("x-forwarded-for")
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || headers.get("x-real-ip") || null
  return {
    ipAddress,
    userAgent: String(headers.get("user-agent") || "").slice(0, 500),
    city: trustedVercelRequest
      ? String(headers.get("x-vercel-ip-city") || "").slice(0, 120) || null
      : null,
    country: trustedVercelRequest
      ? String(headers.get("x-vercel-ip-country") || "").slice(0, 8) || null
      : null,
  }
}

function defaultDeviceName(deviceType: AppSessionDeviceType, userAgent: string) {
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /Firefox\//i.test(userAgent)
      ? "Firefox"
      : /CriOS|Chrome\//i.test(userAgent)
        ? "Chrome"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : "Tarayıcı"
  const device =
    deviceType === "mobile" ? "Telefon" : deviceType === "tablet" ? "Tablet" : "Bilgisayar"
  return `${device} · ${browser}`
}

function isTrustedDevice(device: AccountDeviceRow | null | undefined) {
  return Boolean(
    device &&
      !device.revoked_at &&
      device.verification_required === false &&
      device.verified_at
  )
}

function deviceLastUsedAt(device: AccountDeviceRow) {
  const value = device.last_seen_at || device.first_seen_at
  return value ? new Date(value).getTime() : 0
}

async function rotateOldestApprovalExemptDevice(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  devices: AccountDeviceRow[],
  keepDeviceId?: string
) {
  const activeOtherDevices = devices
    .filter((device) => !device.revoked_at && device.id !== keepDeviceId)
    .sort((left, right) => deviceLastUsedAt(left) - deviceLastUsedAt(right))

  if (activeOtherDevices.length < MAX_REGISTERED_DEVICES) return null

  const oldestDevice = activeOtherDevices[0]
  const { data, error } = await admin.rpc("revoke_account_device_security", {
    p_user_id: userId,
    p_device_id: oldestDevice.id,
    p_reason: "approval_exempt_device_rotation",
    p_suspend_account: false,
  })
  const result = data as { ok?: boolean } | null
  if (error || !result?.ok) return "approval_exempt_device_rotation_failed"
  return null
}

async function consumeProofNonce(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  proof: VerifiedDeviceProof
) {
  const { error: cleanupError } = await admin
    .from("account_device_proof_nonces")
    .delete()
    .lt("expires_at", new Date().toISOString())
  if (cleanupError) return "device_proof_cleanup_failed"

  const { error } = await admin.from("account_device_proof_nonces").insert({
    nonce_hash: proof.nonceHash,
    user_id: userId,
    device_fingerprint: proof.publicKeyFingerprint,
    expires_at: proof.nonceExpiresAt,
  })
  if (!error) return null
  return String((error as { code?: string }).code || "") === "23505"
    ? "device_proof_replayed"
    : "device_proof_store_failed"
}

export async function getDeviceReplacementUsage(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const since = new Date(Date.now() - DEVICE_REPLACEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from("account_device_changes")
    .select("action, created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) return { used: 0, error: true }
  const rows = data || []
  const lastReset = rows.find((row) =>
    row.action === "owner_replacement_reset" || row.action === "owner_all_lost_reset"
  )
  const lastResetTime = lastReset?.created_at ? new Date(lastReset.created_at).getTime() : 0
  return {
    used: rows.filter(
      (row) =>
        row.action === "replacement_approved" &&
        (!lastResetTime || new Date(row.created_at).getTime() > lastResetTime)
    ).length,
    error: false,
  }
}

async function createApprovalChallenge({
  admin,
  userId,
  deviceId,
  countsAsReplacement,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>
  userId: string
  deviceId: string
  countsAsReplacement: boolean
}): Promise<RegisterAppSessionResult> {
  const challengeId = crypto.randomUUID()
  const approvalCode = String(randomInt(0, 1_000_000)).padStart(6, "0")
  const expiresAt = new Date(Date.now() + DEVICE_APPROVAL_MAX_AGE_SECONDS * 1000).toISOString()

  const { error: supersedeError } = await admin
    .from("account_device_verification_challenges")
    .update({ status: "rejected", rejected_at: new Date().toISOString() })
    .eq("pending_device_id", deviceId)
    .eq("status", "pending")
  if (supersedeError) {
    return { ok: false, status: "error", error: "device_approval_supersede_failed", httpStatus: 500 }
  }

  const { error } = await admin.from("account_device_verification_challenges").insert({
    id: challengeId,
    user_id: userId,
    pending_device_id: deviceId,
    code_hash: hashDeviceApprovalCode(userId, challengeId, approvalCode),
    counts_as_replacement: countsAsReplacement,
    expires_at: expiresAt,
  })
  if (error) {
    return { ok: false, status: "error", error: "device_approval_create_failed", httpStatus: 500 }
  }
  return {
    ok: true,
    status: "approval_required",
    deviceId,
    challengeId,
    approvalCode,
    expiresAt,
    maxDevices: MAX_REGISTERED_DEVICES,
  }
}

export async function registerAppSessionForUser(
  input: RegisterAppSessionInput
): Promise<RegisterAppSessionResult> {
  const { user, requestHeaders } = input
  if (!user.id) return { ok: false, status: "error", error: "Unauthorized", httpStatus: 401 }
  if (!user.email_confirmed_at) {
    return { ok: false, status: "error", error: "Email confirmation required", httpStatus: 403 }
  }

  const authSessionId = String(input.authSessionId || "")
  if (!UUID_PATTERN.test(authSessionId)) {
    return { ok: false, status: "error", error: "auth_session_binding_required", httpStatus: 401 }
  }

  const rawDeviceId = String(input.deviceId || "").trim()
  if (!rawDeviceId || rawDeviceId.length < 16 || rawDeviceId.length > 200) {
    return { ok: false, status: "error", error: "device_id_invalid", httpStatus: 400 }
  }

  const p256Submitted = input.identityVersion === "p256-v1"
  const approvalExemptUser = isDeviceApprovalExemptEmail(user.email)
  const proofResult = await verifySubmittedDeviceProof(rawDeviceId, input)
  if (p256Submitted && !proofResult.ok && !approvalExemptUser) {
    return { ok: false, status: "error", error: proofResult.error, httpStatus: 403 }
  }
  const proof = proofResult.ok ? proofResult.proof : null
  const admin = createSupabaseAdminClient()
  if (proof) {
    const nonceError = await consumeProofNonce(admin, user.id, proof)
    if (nonceError) return { ok: false, status: "error", error: nonceError, httpStatus: 409 }
  }

  const metadata = clientMetadata(requestHeaders)
  const deviceType = normalizeDeviceType(input.deviceType)
  const deviceHash = hashDeviceId(user.id, rawDeviceId)
  // Existing staff accounts keep normal password/session security, but device
  // approval, replacement quota and device-proof friction stay invisible.
  const lockExemptUser = await isSecurityLockExemptUser(user.id, user.email)

  const { data: securityState, error: securityStateError } = await admin
    .from("account_security_state")
    .select("temporary_locked_until, suspended_at")
    .eq("user_id", user.id)
    .maybeSingle()
  if (securityStateError) {
    return { ok: false, status: "error", error: "account_security_state_unavailable", httpStatus: 500 }
  }
  if (!lockExemptUser && securityState?.suspended_at) {
    return { ok: false, status: "error", error: "account_suspended", httpStatus: 403 }
  }
  const lockedUntil = securityState?.temporary_locked_until
    ? new Date(securityState.temporary_locked_until).getTime()
    : 0
  if (!lockExemptUser && lockedUntil > Date.now()) {
    return { ok: false, status: "error", error: "account_temporarily_locked", httpStatus: 423 }
  }

  const deviceSelect =
    "id, device_fingerprint_hash, device_type, first_seen_at, last_seen_at, revoked_at, verification_required, verified_at, ever_verified_at, verification_method, legacy_transition_until, public_key_fingerprint, last_user_agent, last_ip"
  let { data: existingDevice, error: lookupError } = await admin
    .from("account_devices")
    .select(deviceSelect)
    .eq("user_id", user.id)
    .eq("device_fingerprint_hash", deviceHash)
    .maybeSingle()
  if (lookupError) {
    return { ok: false, status: "error", error: "device_lookup_failed", httpStatus: 500 }
  }

  if (approvalExemptUser) {
    const approvalCleanupAt = new Date().toISOString()
    const { error: approvalCleanupError } = await admin
      .from("account_device_verification_challenges")
      .update({ status: "approved", approved_at: approvalCleanupAt, consumed_at: approvalCleanupAt })
      .eq("user_id", user.id)
      .eq("status", "pending")
    if (approvalCleanupError) {
      return { ok: false, status: "error", error: "device_approval_cleanup_failed", httpStatus: 500 }
    }
  }

  const staleNow = new Date().toISOString()
  const { data: staleChallenges, error: staleChallengeError } = await admin
    .from("account_device_verification_challenges")
    .select("id, pending_device_id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .lte("expires_at", staleNow)
  if (staleChallengeError) {
    return { ok: false, status: "error", error: "device_challenge_cleanup_failed", httpStatus: 500 }
  }
  if (staleChallenges?.length) {
    const staleChallengeIds = staleChallenges.map((challenge) => challenge.id)
    const staleDeviceIds = [...new Set(staleChallenges.map((challenge) => challenge.pending_device_id))]
    const [{ error: challengeExpireError }, { error: staleDeviceError }] = await Promise.all([
      admin
        .from("account_device_verification_challenges")
        .update({ status: "expired" })
        .in("id", staleChallengeIds)
        .eq("status", "pending"),
      admin
        .from("account_devices")
        .update({ revoked_at: staleNow, verification_required: true, verified_at: null })
        .eq("user_id", user.id)
        .in("id", staleDeviceIds)
        .is("ever_verified_at", null),
    ])
    if (challengeExpireError || staleDeviceError) {
      return { ok: false, status: "error", error: "device_challenge_cleanup_failed", httpStatus: 500 }
    }
  }

  // During the 30-day transition, bind the legacy localStorage identifier to
  // the new non-extractable browser key without consuming another device slot.
  if (
    !existingDevice &&
    proof?.legacyDeviceId &&
    input.authorizedLegacyDeviceRecordId
  ) {
    const legacyHash = hashDeviceId(user.id, proof.legacyDeviceId)
    const legacyLookup = await admin
      .from("account_devices")
      .select(deviceSelect)
      .eq("user_id", user.id)
      .eq("device_fingerprint_hash", legacyHash)
      .maybeSingle()
    if (legacyLookup.error) {
      return { ok: false, status: "error", error: "device_lookup_failed", httpStatus: 500 }
    }
    const legacy = legacyLookup.data as AccountDeviceRow | null
    const transitionDeadline = legacy?.legacy_transition_until
      ? new Date(legacy.legacy_transition_until).getTime()
      : 0
    if (
      legacy &&
      legacy.id === input.authorizedLegacyDeviceRecordId &&
      transitionDeadline > Date.now()
    ) {
      const { error: upgradeError } = await admin
        .from("account_devices")
        .update({
          device_fingerprint_hash: deviceHash,
          public_key_jwk: proof.publicKeyJwk,
          public_key_fingerprint: proof.publicKeyFingerprint,
          verification_method: "p256_v1",
          legacy_transition_until: null,
        })
        .eq("id", legacy.id)
        .eq("user_id", user.id)
      if (upgradeError) {
        return { ok: false, status: "error", error: "device_upgrade_failed", httpStatus: 500 }
      }
      existingDevice = {
        ...legacy,
        device_fingerprint_hash: deviceHash,
        public_key_fingerprint: proof.publicKeyFingerprint,
        verification_method: "p256_v1",
        legacy_transition_until: null,
      }
      await recordAccountSecurityEvent({
        userId: user.id,
        eventType: "device_cryptographic_identity_upgraded",
        deviceId: legacy.id,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      })
    }
  }

  const { data: allDevices, error: devicesError } = await admin
    .from("account_devices")
    .select(deviceSelect)
    .eq("user_id", user.id)
  if (devicesError) {
    return { ok: false, status: "error", error: "device_count_failed", httpStatus: 500 }
  }
  const devices = (allDevices || []) as AccountDeviceRow[]
  const trustedDevices = devices.filter(isTrustedDevice)
  const occupiedDeviceSlots = devices.filter((device) => !device.revoked_at).length
  const historyCount = devices.length
  const verifiedHistoryCount = devices.filter((device) => Boolean(device.ever_verified_at)).length
  const isFirstDevice = historyCount === 0
  if (isFirstDevice && !proof && !approvalExemptUser) {
    return {
      ok: false,
      status: "error",
      error: "device_proof_required",
      message: "İlk güvenilir cihaz için güncel ve güvenli bir tarayıcı gerekir.",
      httpStatus: 403,
    }
  }
  const legacyTransitionValid = Boolean(
    existingDevice?.verification_method === "legacy_transition" &&
      existingDevice.legacy_transition_until &&
      new Date(existingDevice.legacy_transition_until).getTime() > Date.now()
  )
  if (
    !approvalExemptUser &&
    !proof &&
    existingDevice?.verification_method === "legacy_transition" &&
    !legacyTransitionValid
  ) {
    const otherTrustedDevices = trustedDevices.filter((trusted) => trusted.id !== existingDevice?.id)
    if (otherTrustedDevices.length === 0) {
      return {
        ok: false,
        status: "error",
        error: "trusted_device_required",
        message: "Eski tarayıcıyı onaylayacak başka bir güvenilir cihaz bulunamadı.",
        httpStatus: 403,
      }
    }
    await admin
      .from("account_devices")
      .update({
        verification_method: "legacy_session",
        verification_required: true,
        verified_at: null,
        legacy_transition_until: null,
      })
      .eq("id", existingDevice.id)
      .eq("user_id", user.id)
    return createApprovalChallenge({
      admin,
      userId: user.id,
      deviceId: existingDevice.id,
      countsAsReplacement: false,
    })
  }

  let freshLegacyApprovalId: string | null = null
  if (existingDevice?.verification_method === "legacy_session") {
    const { data: freshApproval, error: freshApprovalError } = await admin
      .from("account_device_verification_challenges")
      .select("id")
      .eq("user_id", user.id)
      .eq("pending_device_id", existingDevice.id)
      .eq("status", "approved")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (freshApprovalError) {
      return { ok: false, status: "error", error: "device_approval_lookup_failed", httpStatus: 500 }
    }
    freshLegacyApprovalId = freshApproval?.id || null
  }

  let device = existingDevice as AccountDeviceRow | null
  if (!device) {
    const countsAsReplacement = verifiedHistoryCount >= MAX_REGISTERED_DEVICES
    if (countsAsReplacement && !approvalExemptUser) {
      const usage = await getDeviceReplacementUsage(admin, user.id)
      if (usage.error) {
        return { ok: false, status: "error", error: "replacement_count_failed", httpStatus: 500 }
      }
      if (usage.used >= DEVICE_REPLACEMENT_LIMIT) {
        return {
          ok: false,
          status: "replacement_limit",
          error: "replacement_limit_exceeded",
          message: "30 gün içinde en fazla 2 yeni cihaz eklenebilir.",
          httpStatus: 409,
        }
      }
    }

    if (approvalExemptUser && occupiedDeviceSlots >= MAX_REGISTERED_DEVICES) {
      const rotationError = await rotateOldestApprovalExemptDevice(admin, user.id, devices)
      if (rotationError) {
        return { ok: false, status: "error", error: rotationError, httpStatus: 500 }
      }
    } else if (occupiedDeviceSlots >= MAX_REGISTERED_DEVICES) {
      await recordAccountSecurityEvent({
        userId: user.id,
        eventType: "device_limit_blocked",
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: { max_devices: MAX_REGISTERED_DEVICES },
      })
      return {
        ok: false,
        status: "device_limit",
        error: "device_limit_exceeded",
        message: "Bu hesap için en fazla 3 güvenilir cihaz kullanılabilir.",
        httpStatus: 409,
      }
    }

    if (!approvalExemptUser && !isFirstDevice && trustedDevices.length === 0) {
      return {
        ok: false,
        status: "error",
        error: "trusted_device_required",
        message: "Tüm güvenilir cihazlar kayıp. Destek üzerinden güvenli cihaz sıfırlaması gerekir.",
        httpStatus: 403,
      }
    }

    let autoTrust = approvalExemptUser || (isFirstDevice && Boolean(proof))
    const verifiedNow = new Date().toISOString()
    const deviceInsert = {
      user_id: user.id,
      device_fingerprint_hash: deviceHash,
      device_type: deviceType,
      display_name: defaultDeviceName(deviceType, metadata.userAgent),
      first_user_agent: metadata.userAgent,
      last_user_agent: metadata.userAgent,
      first_ip: metadata.ipAddress,
      last_ip: metadata.ipAddress,
      last_city: metadata.city,
      last_country: metadata.country,
      public_key_jwk: proof?.publicKeyJwk || null,
      public_key_fingerprint: proof?.publicKeyFingerprint || null,
      verification_method: proof ? "p256_v1" : "legacy_session",
      verification_required: !autoTrust,
      verified_at: autoTrust ? verifiedNow : null,
      ever_verified_at: autoTrust ? verifiedNow : null,
    }
    let createResult = await admin
      .from("account_devices")
      .insert(deviceInsert)
      .select(deviceSelect)
      .single()
    if (String(createResult.error?.message || "").includes("additional_device_requires_approval")) {
      autoTrust = false
      createResult = await admin
        .from("account_devices")
        .insert({
          ...deviceInsert,
          verification_required: true,
          verified_at: null,
          ever_verified_at: null,
        })
        .select(deviceSelect)
        .single()
    }
    const { data: created, error: createError } = createResult
    if (createError || !created) {
      if (String(createError?.message || "").includes("device_limit_exceeded")) {
        return {
          ok: false,
          status: "device_limit",
          error: "device_limit_exceeded",
          httpStatus: 409,
        }
      }
      return { ok: false, status: "error", error: "device_create_failed", httpStatus: 500 }
    }
    device = created as AccountDeviceRow
    if (approvalExemptUser && !autoTrust) {
      const { data: trustedDevice, error: trustError } = await admin
        .from("account_devices")
        .update({
          verification_required: false,
          verified_at: verifiedNow,
          ever_verified_at: verifiedNow,
        })
        .eq("id", device.id)
        .eq("user_id", user.id)
        .select(deviceSelect)
        .single()
      if (trustError || !trustedDevice) {
        return { ok: false, status: "error", error: "device_auto_trust_failed", httpStatus: 500 }
      }
      device = trustedDevice as AccountDeviceRow
      autoTrust = true
    }
    await recordAccountSecurityEvent({
      userId: user.id,
      eventType: approvalExemptUser
        ? "approval_exempt_device_trusted"
        : autoTrust
          ? "first_device_trusted"
          : "new_device_approval_requested",
      deviceId: device.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: { device_type: deviceType, counts_as_replacement: countsAsReplacement },
    })
    if (!autoTrust) {
      return createApprovalChallenge({
        admin,
        userId: user.id,
        deviceId: device.id,
        countsAsReplacement,
      })
    }
  } else {
    const legacySessionNeedsApproval =
      device.verification_method === "legacy_session" && !freshLegacyApprovalId
    if (device.revoked_at || device.verification_required || !device.verified_at || legacySessionNeedsApproval) {
      // Once three devices have ever been verified, every newly approved
      // untrusted device consumes replacement quota. This includes retrying a
      // previously rejected, never-verified fingerprint; otherwise repeatedly
      // rejecting and recreating the same request could defer the quota check
      // until the final approval RPC.
      const countsAsReplacement = verifiedHistoryCount >= MAX_REGISTERED_DEVICES
      if (countsAsReplacement && !approvalExemptUser) {
        const usage = await getDeviceReplacementUsage(admin, user.id)
        if (usage.error || usage.used >= DEVICE_REPLACEMENT_LIMIT) {
          return {
            ok: false,
            status: usage.error ? "error" : "replacement_limit",
            error: usage.error ? "replacement_count_failed" : "replacement_limit_exceeded",
            httpStatus: usage.error ? 500 : 409,
          }
        }
      }
      if (
        !approvalExemptUser &&
        occupiedDeviceSlots >= MAX_REGISTERED_DEVICES &&
        Boolean(device.revoked_at) &&
        !isTrustedDevice(device)
      ) {
        return {
          ok: false,
          status: "device_limit",
          error: "device_limit_exceeded",
          httpStatus: 409,
        }
      }
      if (
        approvalExemptUser &&
        Boolean(device.revoked_at) &&
        occupiedDeviceSlots >= MAX_REGISTERED_DEVICES
      ) {
        const rotationError = await rotateOldestApprovalExemptDevice(
          admin,
          user.id,
          devices,
          device.id
        )
        if (rotationError) {
          return { ok: false, status: "error", error: rotationError, httpStatus: 500 }
        }
      }
      const availableApprovers = trustedDevices.filter((trusted) => trusted.id !== device?.id)
      if (!approvalExemptUser && availableApprovers.length === 0) {
        return {
          ok: false,
          status: "error",
          error: "trusted_device_required",
          message: "Tüm güvenilir cihazlar kayıp. Destek üzerinden güvenli cihaz sıfırlaması gerekir.",
          httpStatus: 403,
        }
      }
      const verifiedNow = new Date().toISOString()
      const { error: pendingUpdateError } = await admin
        .from("account_devices")
        .update({
          revoked_at: null,
          verification_required: approvalExemptUser ? false : true,
          verified_at: approvalExemptUser ? verifiedNow : null,
          ever_verified_at: approvalExemptUser
            ? device.ever_verified_at || verifiedNow
            : device.ever_verified_at,
          public_key_jwk: proof?.publicKeyJwk || null,
          public_key_fingerprint: proof?.publicKeyFingerprint || null,
          verification_method: proof ? "p256_v1" : "legacy_session",
          last_user_agent: metadata.userAgent,
          last_ip: metadata.ipAddress,
          last_city: metadata.city,
          last_country: metadata.country,
        })
        .eq("id", device.id)
        .eq("user_id", user.id)
      if (pendingUpdateError) {
        return { ok: false, status: "error", error: "device_update_failed", httpStatus: 500 }
      }
      if (approvalExemptUser) {
        const { error: challengeCleanupError } = await admin
          .from("account_device_verification_challenges")
          .update({ status: "approved", approved_at: verifiedNow, consumed_at: verifiedNow })
          .eq("user_id", user.id)
          .eq("pending_device_id", device.id)
          .eq("status", "pending")
        if (challengeCleanupError) {
          return { ok: false, status: "error", error: "device_approval_cleanup_failed", httpStatus: 500 }
        }
        device = {
          ...device,
          revoked_at: null,
          verification_required: false,
          verified_at: verifiedNow,
          ever_verified_at: device.ever_verified_at || verifiedNow,
          public_key_fingerprint: proof?.publicKeyFingerprint || null,
          verification_method: proof ? "p256_v1" : "legacy_session",
          last_user_agent: metadata.userAgent,
          last_ip: metadata.ipAddress,
        }
        await recordAccountSecurityEvent({
          userId: user.id,
          eventType: "approval_exempt_device_trusted",
          deviceId: device.id,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          metadata: { device_type: deviceType, counts_as_replacement: countsAsReplacement },
        })
      } else {
        return createApprovalChallenge({
          admin,
          userId: user.id,
          deviceId: device.id,
          countsAsReplacement,
        })
      }
    }

    if (
      !approvalExemptUser &&
      device.verification_method === "p256_v1" &&
      (!proof || device.public_key_fingerprint !== proof.publicKeyFingerprint)
    ) {
      return { ok: false, status: "error", error: "device_proof_invalid", httpStatus: 403 }
    }
  }

  if (!device || !isTrustedDevice(device)) {
    return { ok: false, status: "error", error: "device_not_trusted", httpStatus: 403 }
  }

  const { error: deviceRefreshError } = await admin
    .from("account_devices")
    .update({
      device_type: deviceType,
      last_seen_at: new Date().toISOString(),
      last_user_agent: metadata.userAgent,
      last_ip: metadata.ipAddress,
      last_city: metadata.city,
      last_country: metadata.country,
    })
    .eq("id", device.id)
    .eq("user_id", user.id)
  if (deviceRefreshError) {
    return { ok: false, status: "error", error: "device_update_failed", httpStatus: 500 }
  }

  if (
    (device.last_ip && metadata.ipAddress && device.last_ip !== metadata.ipAddress) ||
    (device.last_user_agent && device.last_user_agent !== metadata.userAgent)
  ) {
    await recordAccountSecurityEvent({
      userId: user.id,
      eventType: "device_metadata_changed",
      deviceId: device.id,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadata: {
        previous_ip: device.last_ip,
        previous_user_agent: device.last_user_agent,
      },
    })
  }

  const sessionId = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + APP_SESSION_MAX_AGE_SECONDS * 1000).toISOString()
  const { error: replaceSessionError } = await admin
    .from("account_sessions")
    .update({ status: "replaced", revoked_at: now.toISOString(), replaced_by_session_id: sessionId })
    .eq("user_id", user.id)
    .eq("device_id", device.id)
    .eq("status", "active")
  if (replaceSessionError) {
    return { ok: false, status: "error", error: "session_replace_failed", httpStatus: 500 }
  }

  const { error: sessionError } = await admin.from("account_sessions").insert({
    id: sessionId,
    user_id: user.id,
    device_id: device.id,
    auth_session_id: authSessionId,
    status: "active",
    ip_address: metadata.ipAddress,
    user_agent: metadata.userAgent,
    expires_at: expiresAt,
  })
  if (sessionError) {
    return { ok: false, status: "error", error: "session_create_failed", httpStatus: 500 }
  }

  if (freshLegacyApprovalId) {
    const { data: consumedApproval, error: consumeApprovalError } = await admin
      .from("account_device_verification_challenges")
      .update({ consumed_at: now.toISOString() })
      .eq("id", freshLegacyApprovalId)
      .eq("user_id", user.id)
      .is("consumed_at", null)
      .select("id")
      .maybeSingle()
    if (consumeApprovalError || !consumedApproval) {
      await admin
        .from("account_sessions")
        .update({ status: "revoked", revoked_at: now.toISOString() })
        .eq("id", sessionId)
        .eq("user_id", user.id)
      return { ok: false, status: "error", error: "device_approval_consume_failed", httpStatus: 500 }
    }
  }

  await recordAccountSecurityEvent({
    userId: user.id,
    eventType: "device_session_started",
    deviceId: device.id,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    metadata: { session_id: sessionId },
  })

  return {
    ok: true,
    status: "active",
    sessionId,
    deviceId: device.id,
    maxDevices: MAX_REGISTERED_DEVICES,
  }
}
