import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import {
  applyOwnerSecurityActionWithClient,
  buildOwnerSecurityDashboardFromRows,
} from "@/lib/owner/ownerSecurityCore"

export type OwnerSecurityFilters = {
  q?: string
  category?: string
  risk?: string
  from?: string
  to?: string
}

export type OwnerSecurityAction =
  | "revoke_sessions"
  | "revoke_device"
  | "reset_device_replacements"
  | "recover_device_trust"
  | "mark_review"
  | "clear_review"
  | "clear_risk"
  | "clear_event_type"
  | "hide_from_security"
  | "restore_to_security"
  | "temporary_lock"
  | "clear_lock"
  | "suspend"
  | "unsuspend"

export type OwnerSecurityUser = {
  userId: string
  email: string
  fullName: string
  role: string
  plan: string
  riskScore: number
  riskLevel: "low" | "medium" | "high" | "critical"
  riskReasons: string[]
  manualReviewRequired: boolean
  temporaryLockedUntil: string | null
  suspendedAt: string | null
  activeSessions: number
  registeredDevices: number
  revokedDevices: number
  devices: Array<{
    id: string
    type: string
    lastSeenAt: string | null
    lastIp: string | null
    revokedAt: string | null
  }>
  lastSeenAt: string | null
  recentIps: string[]
  securityEvents24h: number
  apiRateLimits24h: number
  deviceBlocks24h: number
  paymentWarnings: number
  videoWarnings: number
  activeEntitlements: string[]
  reportCreditBalance: number
  riskFindings: Array<{
    eventType: string
    label: string
    count: number
    severity: "info" | "warning" | "danger"
  }>
}

export type OwnerSecurityEvent = {
  id: string
  userId: string | null
  email: string
  category: "account" | "payment" | "video" | "entitlement" | "report_credit"
  severity: "info" | "warning" | "danger"
  label: string
  eventType?: string
  detail: string
  createdAt: string | null
  ipAddress?: string | null
}

export type OwnerSecurityDashboard = {
  summary: {
    highRiskUsers: number
    manualReviews: number
    lockedUsers: number
    suspendedUsers: number
    activeSessions: number
    activeDevices: number
    paymentWarnings: number
    videoWarnings: number
    apiRateLimits24h: number
  }
  users: OwnerSecurityUser[]
  hiddenUsers: OwnerSecurityUser[]
  events: OwnerSecurityEvent[]
  setupIssues: string[]
}

type AuthUserRow = {
  id: string
  email: string
  fullName: string
}

type QueryResult<T> = {
  rows: T[]
  issue?: string
}

function safeText(value: unknown, fallback = "") {
  return String(value || "").trim() || fallback
}

function tableIssue(table: string, error: unknown) {
  const message = String((error as { message?: unknown })?.message || error || "")
  if (message.toLowerCase().includes("does not exist") || message.toLowerCase().includes("could not find")) {
    return `${table} tablosu hazir degil`
  }
  return `${table} okunamadi`
}

async function safeSelect<T>(
  table: string,
  queryFactory: (admin: SupabaseClient) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<QueryResult<T>> {
  const admin = createSupabaseAdminClient()
  const { data, error } = await queryFactory(admin)
  if (error) return { rows: [], issue: tableIssue(table, error) }
  return { rows: (data || []) as T[] }
}

async function fetchAuthUsers() {
  const admin = createSupabaseAdminClient()
  const authUsers: AuthUserRow[] = []
  let page = 1

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break

    const users = data?.users || []
    for (const user of users) {
      authUsers.push({
        id: user.id,
        email: user.email || "",
        fullName: safeText(user.user_metadata?.full_name || user.user_metadata?.name, "Isimsiz uye"),
      })
    }

    if (users.length < 1000) break
    page += 1
  }

  return authUsers
}

export async function fetchOwnerSecurityDashboard(filters: OwnerSecurityFilters = {}): Promise<OwnerSecurityDashboard> {
  const [
    authUsers,
    profilesResult,
    statesResult,
    sessionsResult,
    devicesResult,
    securityEventsResult,
    billingEventsResult,
    paymentEventsResult,
    entitlementsResult,
    creditLedgerResult,
    videoLogsResult,
    playbackSessionsResult,
  ] = await Promise.all([
    fetchAuthUsers(),
    safeSelect<Record<string, unknown>>("profiles", (admin) => admin.from("profiles").select("user_id, role, plan")),
    safeSelect<Record<string, unknown>>("account_security_state", (admin) =>
      admin
        .from("account_security_state")
        .select("user_id, risk_score, risk_reasons, manual_review_required, temporary_locked_until, suspended_at, updated_at")
        .limit(5000)
    ),
    safeSelect<Record<string, unknown>>("account_sessions", (admin) =>
      admin
        .from("account_sessions")
        .select("id, user_id, device_id, status, created_at, last_seen_at, expires_at, revoked_at, ip_address, user_agent")
        .order("created_at", { ascending: false })
        .limit(10000)
    ),
    safeSelect<Record<string, unknown>>("account_devices", (admin) =>
      admin
        .from("account_devices")
        .select("id, user_id, device_type, first_seen_at, last_seen_at, revoked_at, last_ip, last_user_agent")
        .order("last_seen_at", { ascending: false })
        .limit(10000)
    ),
    safeSelect<Record<string, unknown>>("account_security_events", (admin) =>
      admin
        .from("account_security_events")
        .select("id, user_id, device_id, event_type, created_at, ip_address, user_agent, metadata")
        .order("created_at", { ascending: false })
        .limit(1000)
    ),
    safeSelect<Record<string, unknown>>("billing_audit_events", (admin) =>
      admin
        .from("billing_audit_events")
        .select("id, actor_user_id, target_user_id, action, provider, provider_event_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(1000)
    ),
    safeSelect<Record<string, unknown>>("payment_webhook_events", (admin) =>
      admin
        .from("payment_webhook_events")
        .select("id, provider, provider_event_id, event_type, user_id, plan_code, amount, currency, processed_at")
        .order("processed_at", { ascending: false })
        .limit(1000)
    ),
    safeSelect<Record<string, unknown>>("user_entitlements", (admin) =>
      admin
        .from("user_entitlements")
        .select("id, user_id, feature, plan_code, source, provider, starts_at, expires_at, revoked_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(5000)
    ),
    safeSelect<Record<string, unknown>>("report_credit_ledger", (admin) =>
      admin
        .from("report_credit_ledger")
        .select("id, user_id, delta, reason, source, provider, provider_event_id, created_at")
        .order("created_at", { ascending: false })
        .limit(10000)
    ),
    safeSelect<Record<string, unknown>>("education_video_access_logs", (admin) =>
      admin
        .from("education_video_access_logs")
        .select("id, user_id, video_id, event_type, created_at, ip_address, user_agent, watermark_code, metadata")
        .order("created_at", { ascending: false })
        .limit(1000)
    ),
    safeSelect<Record<string, unknown>>("education_video_playback_sessions", (admin) =>
      admin
        .from("education_video_playback_sessions")
        .select("id, user_id, video_id, player_session_id, last_heartbeat_at, ended_at, ip_address, user_agent, created_at")
        .order("created_at", { ascending: false })
        .limit(1000)
    ),
  ])

  const setupIssues = [
    profilesResult.issue,
    statesResult.issue,
    sessionsResult.issue,
    devicesResult.issue,
    securityEventsResult.issue,
    billingEventsResult.issue,
    paymentEventsResult.issue,
    entitlementsResult.issue,
    videoLogsResult.issue,
    playbackSessionsResult.issue,
  ].filter(Boolean) as string[]

  return buildOwnerSecurityDashboardFromRows(
    {
      authUsers,
      profiles: profilesResult.rows,
      states: statesResult.rows,
      sessions: sessionsResult.rows,
      devices: devicesResult.rows,
      securityEvents: securityEventsResult.rows,
      billingEvents: billingEventsResult.rows,
      paymentEvents: paymentEventsResult.rows,
      entitlements: entitlementsResult.rows,
      creditLedger: creditLedgerResult.rows,
      videoLogs: videoLogsResult.rows,
      playbackSessions: playbackSessionsResult.rows,
      setupIssues,
    },
    filters
  )
}

export async function applyOwnerSecurityAction(params: {
  actorUserId: string
  targetUserId: string
  action: OwnerSecurityAction
  reason: string
  deviceId?: string | null
  eventType?: string | null
  lockMinutes?: number | null
}) {
  const admin = createSupabaseAdminClient()
  const result = await applyOwnerSecurityActionWithClient(admin as any, params)
  if (result.ok && params.action === "revoke_device" && params.deviceId) {
    const { data, error } = await admin.rpc("revoke_account_device_security", {
      p_user_id: params.targetUserId,
      p_device_id: params.deviceId,
      p_reason: "owner_device_revoked",
      p_suspend_account: false,
    })
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      return { ok: false as const, error: "device_security_cleanup_failed" }
    }
  }
  if (
    result.ok &&
    (params.action === "revoke_sessions" ||
      params.action === "temporary_lock" ||
      params.action === "suspend")
  ) {
    const { data, error } = await admin.rpc("logout_account_security", {
      p_user_id: params.targetUserId,
      p_app_session_id: null,
      p_global: true,
      p_reason: `owner_${params.action}`,
    })
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      return { ok: false as const, error: "account_security_cleanup_failed" }
    }
  }
  return result
}
