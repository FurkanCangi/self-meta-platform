import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"

type SecurityEventRow = {
  event_type: string
  created_at: string
  ip_address: string | null
  user_agent: string | null
}

type RiskDecision = {
  score: number
  action: "none" | "manual_review" | "temporary_lock"
  reasons: string[]
}

const REVIEW_THRESHOLD = 40
const LOCK_THRESHOLD = 160
const TEMPORARY_LOCK_MINUTES = 30
const SECURITY_LOCK_EXEMPT_ROLES = new Set(["admin", "super_admin", "owner"])

function countDistinct(values: Array<string | null | undefined>) {
  return new Set(values.map((value) => String(value || "").trim()).filter(Boolean)).size
}

function countEvents(events: SecurityEventRow[], eventType: string) {
  return events.filter((event) => event.event_type === eventType).length
}

export function scoreAccountSecurityEvents(events: SecurityEventRow[]): RiskDecision {
  let score = 0
  const reasons: string[] = []

  const distinctIps = countDistinct(events.map((event) => event.ip_address))
  if (distinctIps >= 5) {
    score += 50
    reasons.push("24 saat içinde 5 veya daha fazla farklı IP")
  } else if (distinctIps >= 3) {
    score += 25
    reasons.push("24 saat içinde 3 veya daha fazla farklı IP")
  }

  const distinctAgents = countDistinct(events.map((event) => event.user_agent))
  if (distinctAgents >= 4) {
    score += 35
    reasons.push("24 saat içinde 4 veya daha fazla farklı tarayıcı imzası")
  } else if (distinctAgents >= 3) {
    score += 20
    reasons.push("24 saat içinde 3 veya daha fazla farklı tarayıcı imzası")
  }

  const replacements = countEvents(events, "active_session_replaced")
  if (replacements >= 20) {
    score += 55
    reasons.push("24 saat içinde çok yüksek login/session devralma sayısı")
  } else if (replacements >= 8) {
    score += 25
    reasons.push("24 saat içinde sık login/session devralma")
  }

  const newDevices = countEvents(events, "new_device_registered")
  if (newDevices >= 2) {
    score += 35
    reasons.push("24 saat içinde birden fazla yeni cihaz")
  }

  const metadataChanges = countEvents(events, "device_metadata_changed")
  if (metadataChanges >= 5) {
    score += 35
    reasons.push("24 saat içinde sık IP veya tarayıcı metadata değişimi")
  } else if (metadataChanges >= 2) {
    score += 15
    reasons.push("24 saat içinde IP veya tarayıcı metadata değişimi")
  }

  const sessionIpChanges = countEvents(events, "active_session_ip_changed")
  if (sessionIpChanges >= 6) {
    score += 45
    reasons.push("Aynı aktif oturumda sık IP değişimi")
  } else if (sessionIpChanges >= 3) {
    score += 20
    reasons.push("Aynı aktif oturumda IP değişimi")
  }

  const sessionAgentChanges = countEvents(events, "active_session_user_agent_changed")
  if (sessionAgentChanges >= 2) {
    score += 30
    reasons.push("Aynı aktif oturumda tarayıcı imzası değişimi")
  }

  const blockedDeviceAttempts = countEvents(events, "device_limit_blocked") + countEvents(events, "device_slot_blocked")
  if (blockedDeviceAttempts >= 3) {
    score += 50
    reasons.push("Cihaz limiti tekrar tekrar aşılmaya çalışıldı")
  } else if (blockedDeviceAttempts >= 1) {
    score += 25
    reasons.push("Cihaz limiti aşılmaya çalışıldı")
  }

  const apiRateLimits = countEvents(events, "api_rate_limited")
  if (apiRateLimits >= 5) {
    score += 45
    reasons.push("Kısa sürede tekrarlayan API rate limit aşımı")
  } else if (apiRateLimits >= 2) {
    score += 20
    reasons.push("API rate limit aşımı")
  }

  if (score >= LOCK_THRESHOLD) {
    return { score, action: "temporary_lock", reasons }
  }

  if (score >= REVIEW_THRESHOLD) {
    return { score, action: "manual_review", reasons }
  }

  return { score, action: "none", reasons }
}

export async function recordAccountSecurityEvent(event: {
  userId: string
  eventType: string
  deviceId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown>
}) {
  const admin = createSupabaseAdminClient()
  await admin.from("account_security_events").insert({
    user_id: event.userId,
    event_type: event.eventType,
    device_id: event.deviceId || null,
    ip_address: event.ipAddress || null,
    user_agent: event.userAgent || null,
    metadata: event.metadata || {},
  })
}

export async function isSecurityLockExemptUser(userId: string, email?: string | null) {
  if (isOwnerAuditEmail(email)) return true

  const admin = createSupabaseAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle()

  if (SECURITY_LOCK_EXEMPT_ROLES.has(String(profile?.role || "").toLowerCase())) {
    return true
  }

  if (!email) {
    const { data } = await admin.auth.admin.getUserById(userId)
    if (isOwnerAuditEmail(data.user?.email)) return true
  }

  return false
}

export async function evaluateAccountRisk(userId: string) {
  const admin = createSupabaseAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from("account_security_events")
    .select("event_type, created_at, ip_address, user_agent")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return { ok: false as const, error: error.message }
  }

  let decision = scoreAccountSecurityEvents((data || []) as SecurityEventRow[])
  const lockExempt = await isSecurityLockExemptUser(userId)
  if (lockExempt && decision.action !== "none") {
    decision = { ...decision, action: "none" }
  }
  const lockedUntil =
    decision.action === "temporary_lock"
      ? new Date(Date.now() + TEMPORARY_LOCK_MINUTES * 60 * 1000).toISOString()
      : null

  const { error: stateError } = await admin
    .from("account_security_state")
    .upsert(
      {
        user_id: userId,
        risk_score: decision.score,
        risk_reasons: decision.reasons,
        manual_review_required: decision.action !== "none",
        temporary_locked_until: lockedUntil,
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )

  if (stateError) {
    return { ok: false as const, error: stateError.message }
  }

  if (decision.action === "temporary_lock") {
    await admin
      .from("account_sessions")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "active")
  }

  return { ok: true as const, decision }
}
