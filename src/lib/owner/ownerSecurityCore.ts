import type {
  OwnerSecurityAction,
  OwnerSecurityDashboard,
  OwnerSecurityFilters,
  OwnerSecurityUser,
  OwnerSecurityEvent,
} from "@/lib/owner/ownerSecurity"

export type OwnerSecurityRows = {
  authUsers: Array<{ id: string; email: string; fullName: string }>
  profiles: Array<Record<string, unknown>>
  states: Array<Record<string, unknown>>
  sessions: Array<Record<string, unknown>>
  devices: Array<Record<string, unknown>>
  securityEvents: Array<Record<string, unknown>>
  billingEvents: Array<Record<string, unknown>>
  paymentEvents: Array<Record<string, unknown>>
  entitlements: Array<Record<string, unknown>>
  creditLedger: Array<Record<string, unknown>>
  videoLogs: Array<Record<string, unknown>>
  playbackSessions: Array<Record<string, unknown>>
  setupIssues?: string[]
  nowMs?: number
}

export type OwnerSecurityActionClient = {
  from(table: string): {
    update(values: Record<string, unknown>): {
      eq(column: string, value: unknown): any
    }
    upsert(values: Record<string, unknown>, options?: Record<string, unknown>): PromiseLike<{ error: unknown }>
    insert(values: Record<string, unknown>): PromiseLike<{ error: unknown }>
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function safeText(value: unknown, fallback = "") {
  return String(value || "").trim() || fallback
}

function parseJsonArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
}

function normalizeRisk(score: number): OwnerSecurityUser["riskLevel"] {
  if (score >= 70) return "critical"
  if (score >= 40) return "high"
  if (score >= 20) return "medium"
  return "low"
}

function within24h(value: string | null | undefined, nowMs: number) {
  if (!value) return false
  return nowMs - new Date(value).getTime() <= ONE_DAY_MS
}

function eventLabel(category: OwnerSecurityEvent["category"], raw: string) {
  const labels: Record<string, string> = {
    active_session_replaced: "Aktif oturum devralindi",
    active_session_ip_changed: "Aktif oturumda IP degisti",
    active_session_user_agent_changed: "Tarayici imzasi degisti",
    new_device_registered: "Yeni cihaz kaydedildi",
    device_limit_blocked: "Cihaz limiti zorlandi",
    device_slot_blocked: "Cihaz turu limiti zorlandi",
    device_slot_reused: "Cihaz turu yeniden kullanildi",
    user_device_revoked_self: "Kullanici cihaz kaldirdi",
    frequent_device_changes: "Cihaz kaldir/ekle hareketi artti",
    device_metadata_changed: "Cihaz IP/tarayici bilgisi degisti",
    api_rate_limited: "API rate limit asildi",
    concurrent_playback_blocked: "Ayni video eszamanli izlenmeye calisildi",
    payment_amount_mismatch: "Paket odeme tutari uyusmadi",
    owner_security_action: "Owner guvenlik aksiyonu",
  }

  if (labels[raw]) return labels[raw]
  if (category === "payment") return `Odeme olayi: ${raw || "bilinmiyor"}`
  if (category === "video") return `Egitim video olayi: ${raw || "bilinmiyor"}`
  if (category === "entitlement") return `Paket/erisim olayi: ${raw || "bilinmiyor"}`
  if (category === "report_credit") return `Rapor hakki olayi: ${raw || "bilinmiyor"}`
  return raw || "Guvenlik olayi"
}

function eventSeverity(category: OwnerSecurityEvent["category"], raw: string): OwnerSecurityEvent["severity"] {
  if (
    raw.includes("blocked") ||
    raw.includes("mismatch") ||
    raw.includes("failed") ||
    raw.includes("suspend") ||
    raw.includes("temporary_lock") ||
    raw === "api_rate_limited"
  ) {
    return "danger"
  }
  if (
    raw === "frequent_device_changes" ||
    raw === "device_slot_reused" ||
    raw === "user_device_revoked_self" ||
    category === "payment" ||
    raw.includes("changed") ||
    raw.includes("replaced")
  ) return "warning"
  return "info"
}

function isResolvedSecurityRow(row: Record<string, unknown>) {
  const metadata = row.metadata as Record<string, unknown> | null
  return Boolean(metadata?.owner_resolved_at)
}

function rowTime(row: Record<string, unknown>) {
  const value = safeText(row.created_at || row.updated_at || row.last_seen_at || row.processed_at)
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function isPanelHiddenRow(row: Record<string, unknown>) {
  return row.event_type === "owner_security_panel_hidden"
}

function latestVisibleSecurityEventTime(rows: Record<string, unknown>[]) {
  return rows
    .filter((row) => !isPanelHiddenRow(row) && row.event_type !== "owner_security_action")
    .reduce((latest, row) => Math.max(latest, rowTime(row)), 0)
}

function applyFilters(users: OwnerSecurityUser[], filters: OwnerSecurityFilters) {
  const q = safeText(filters.q).toLowerCase()
  const category = safeText(filters.category)
  const risk = safeText(filters.risk)

  return users.filter((user) => {
    if (
      q &&
      ![user.email, user.fullName, user.userId, user.plan, user.role]
        .map((value) => value.toLowerCase())
        .some((value) => value.includes(q))
    ) {
      return false
    }

    if (risk && risk !== "all" && user.riskLevel !== risk) return false
    if (category === "payment" && user.paymentWarnings < 1) return false
    if (category === "video" && user.videoWarnings < 1) return false
    if (category === "device" && user.deviceBlocks24h < 1 && user.registeredDevices < 2) return false
    if (category === "api" && user.apiRateLimits24h < 1) return false
    if (category === "review" && !user.manualReviewRequired) return false
    return true
  })
}

export function buildOwnerSecurityDashboardFromRows(
  rows: OwnerSecurityRows,
  filters: OwnerSecurityFilters = {}
): OwnerSecurityDashboard {
  const nowMs = rows.nowMs ?? Date.now()
  const authById = new Map(rows.authUsers.map((row) => [row.id, row]))
  const profilesByUser = new Map(rows.profiles.map((row) => [String(row.user_id || ""), row]))
  const statesByUser = new Map(rows.states.map((row) => [String(row.user_id || ""), row]))
  const users = new Set<string>()

  for (const user of rows.authUsers) users.add(user.id)
  for (const group of [
    rows.profiles,
    rows.states,
    rows.sessions,
    rows.devices,
    rows.securityEvents,
    rows.paymentEvents,
    rows.entitlements,
    rows.creditLedger,
    rows.videoLogs,
    rows.playbackSessions,
  ]) {
    for (const row of group) if (row.user_id) users.add(String(row.user_id))
  }
  for (const row of rows.billingEvents) if (row.target_user_id) users.add(String(row.target_user_id))

  const hiddenUsers = new Set<string>()
  for (const userId of users) {
    const userEvents = rows.securityEvents.filter((row) => String(row.user_id || "") === userId)
    const latestHiddenAt = userEvents.filter(isPanelHiddenRow).reduce((latest, row) => Math.max(latest, rowTime(row)), 0)
    if (latestHiddenAt > 0 && latestHiddenAt >= latestVisibleSecurityEventTime(userEvents)) {
      hiddenUsers.add(userId)
    }
  }

  const securityUsers: OwnerSecurityUser[] = Array.from(users).filter((userId) => !hiddenUsers.has(userId)).map((userId) => {
    const auth = authById.get(userId)
    const profile = profilesByUser.get(userId)
    const state = statesByUser.get(userId)
    const sessions = rows.sessions.filter((row) => String(row.user_id || "") === userId)
    const devices = rows.devices.filter((row) => String(row.user_id || "") === userId)
    const events = rows.securityEvents.filter((row) => String(row.user_id || "") === userId && !isResolvedSecurityRow(row))
    const billingEvents = rows.billingEvents.filter((row) => String(row.target_user_id || "") === userId)
    const paymentEvents = rows.paymentEvents.filter((row) => String(row.user_id || "") === userId)
    const entitlements = rows.entitlements.filter((row) => String(row.user_id || "") === userId)
    const credits = rows.creditLedger.filter((row) => String(row.user_id || "") === userId)
    const videoLogs = rows.videoLogs.filter((row) => String(row.user_id || "") === userId)
    const playbackSessions = rows.playbackSessions.filter((row) => String(row.user_id || "") === userId)
    const activeSessions = sessions.filter((row) => row.status === "active").length
    const activeDevices = devices.filter((row) => !row.revoked_at).length
    const deviceMovementEvents = events.filter((row) =>
      ["new_device_registered", "device_slot_reused", "user_device_revoked_self", "frequent_device_changes"].includes(String(row.event_type || "")) &&
      within24h(String(row.created_at || ""), nowMs)
    ).length
    const riskScore = Math.max(0, Number(state?.risk_score || 0))
    const recentIps = Array.from(
      new Set(
        [...sessions.map((row) => row.ip_address), ...devices.map((row) => row.last_ip), ...events.map((row) => row.ip_address)]
          .map((value) => safeText(value))
          .filter(Boolean)
      )
    ).slice(0, 5)
    const paymentWarnings =
      billingEvents.filter((row) => String(row.action || "").includes("mismatch") || String(row.action || "").includes("failed")).length +
      paymentEvents.filter((row) => String(row.event_type || "").includes("failed") || String(row.event_type || "").includes("refunded")).length
    const videoWarnings =
      videoLogs.filter((row) => String(row.event_type || "").includes("blocked") || String(row.event_type || "").includes("denied")).length +
      playbackSessions.filter((row) => !row.ended_at && row.last_heartbeat_at && within24h(String(row.last_heartbeat_at), nowMs)).length
    const activeEntitlements = entitlements
      .filter((row) => !row.revoked_at)
      .map((row) => `${safeText(row.feature, "feature")}:${safeText(row.plan_code, "plan")}`)
      .slice(0, 4)
    const reportCreditBalance = credits.reduce((sum, row) => sum + Number(row.delta || 0), 0)
    const riskFindings = Array.from(
      events
        .filter((row) => within24h(String(row.created_at || ""), nowMs))
        .reduce((map, row) => {
          const eventType = safeText(row.event_type)
          if (!eventType) return map
          const current = map.get(eventType) || {
            eventType,
            label: eventLabel("account", eventType),
            count: 0,
            severity: eventSeverity("account", eventType),
          }
          current.count += 1
          map.set(eventType, current)
          return map
        }, new Map<string, { eventType: string; label: string; count: number; severity: "info" | "warning" | "danger" }>())
        .values()
    ).sort((a, b) => b.count - a.count)
    const lastSeenAt =
      sessions.map((row) => safeText(row.last_seen_at || row.created_at)).filter(Boolean).sort().at(-1) ||
      devices.map((row) => safeText(row.last_seen_at || row.first_seen_at)).filter(Boolean).sort().at(-1) ||
      null

    return {
      userId,
      email: auth?.email || "E-posta yok",
      fullName: auth?.fullName || "Isimsiz uye",
      role: safeText(profile?.role, "expert"),
      plan: safeText(profile?.plan, "none"),
      riskScore,
      riskLevel: normalizeRisk(riskScore),
      riskReasons: parseJsonArray(state?.risk_reasons),
      manualReviewRequired: Boolean(state?.manual_review_required),
      temporaryLockedUntil: state?.temporary_locked_until ? String(state.temporary_locked_until) : null,
      suspendedAt: state?.suspended_at ? String(state.suspended_at) : null,
      activeSessions,
      registeredDevices: activeDevices,
      revokedDevices: devices.filter((row) => Boolean(row.revoked_at)).length,
      devices: devices.slice(0, 6).map((row) => ({
        id: String(row.id || ""),
        type: safeText(row.device_type, "unknown"),
        lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
        lastIp: row.last_ip ? String(row.last_ip) : null,
        revokedAt: row.revoked_at ? String(row.revoked_at) : null,
      })),
      lastSeenAt,
      recentIps,
      securityEvents24h: events.filter((row) => within24h(String(row.created_at || ""), nowMs)).length,
      apiRateLimits24h: events.filter((row) => row.event_type === "api_rate_limited" && within24h(String(row.created_at || ""), nowMs)).length,
      deviceBlocks24h:
        events.filter((row) => String(row.event_type || "").includes("device_") && String(row.event_type || "").includes("blocked") && within24h(String(row.created_at || ""), nowMs)).length +
        (deviceMovementEvents >= 3 ? 1 : 0),
      paymentWarnings,
      videoWarnings,
      activeEntitlements,
      reportCreditBalance,
      riskFindings,
    }
  })

  const authEmail = (userId: unknown) => authById.get(String(userId || ""))?.email || "E-posta yok"
  const eventRows: OwnerSecurityEvent[] = [
    ...rows.securityEvents.filter((row) => !isResolvedSecurityRow(row) && !isPanelHiddenRow(row) && !hiddenUsers.has(String(row.user_id || ""))).map((row) => ({
      id: `security:${row.id}`,
      userId: row.user_id ? String(row.user_id) : null,
      email: authEmail(row.user_id),
      category: "account" as const,
      severity: eventSeverity("account", String(row.event_type || "")),
      label: eventLabel("account", String(row.event_type || "")),
      eventType: row.event_type ? String(row.event_type) : undefined,
      detail: safeText((row.metadata as Record<string, unknown> | null)?.route || (row.metadata as Record<string, unknown> | null)?.reason, "Hesap guvenlik olayi"),
      createdAt: row.created_at ? String(row.created_at) : null,
      ipAddress: row.ip_address ? String(row.ip_address) : null,
    })),
    ...rows.billingEvents.map((row) => ({
      id: `billing:${row.id}`,
      userId: row.target_user_id ? String(row.target_user_id) : null,
      email: authEmail(row.target_user_id),
      category: "payment" as const,
      severity: eventSeverity("payment", String(row.action || "")),
      label: eventLabel("payment", String(row.action || "")),
      detail: safeText(row.provider || row.provider_event_id, "Odeme/paket audit olayi"),
      createdAt: row.created_at ? String(row.created_at) : null,
    })),
    ...rows.paymentEvents.map((row) => ({
      id: `payment:${row.id}`,
      userId: row.user_id ? String(row.user_id) : null,
      email: authEmail(row.user_id),
      category: "payment" as const,
      severity: eventSeverity("payment", String(row.event_type || "")),
      label: eventLabel("payment", String(row.event_type || "")),
      detail: `${safeText(row.plan_code, "plan yok")} / ${safeText(row.amount, "-")} ${safeText(row.currency, "")}`,
      createdAt: row.processed_at ? String(row.processed_at) : null,
    })),
    ...rows.videoLogs.map((row) => ({
      id: `video:${row.id}`,
      userId: row.user_id ? String(row.user_id) : null,
      email: authEmail(row.user_id),
      category: "video" as const,
      severity: eventSeverity("video", String(row.event_type || "")),
      label: eventLabel("video", String(row.event_type || "")),
      detail: safeText((row.metadata as Record<string, unknown> | null)?.video_slug || row.video_id, "Video olayi"),
      createdAt: row.created_at ? String(row.created_at) : null,
      ipAddress: row.ip_address ? String(row.ip_address) : null,
    })),
    ...rows.creditLedger.slice(0, 300).map((row) => ({
      id: `credit:${row.id}`,
      userId: row.user_id ? String(row.user_id) : null,
      email: authEmail(row.user_id),
      category: "report_credit" as const,
      severity: Number(row.delta || 0) < 0 ? "warning" as const : "info" as const,
      label: eventLabel("report_credit", String(row.reason || "")),
      detail: `Delta: ${Number(row.delta || 0)}`,
      createdAt: row.created_at ? String(row.created_at) : null,
    })),
  ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 250)

  const filteredUsers = applyFilters(
    securityUsers.sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore
      return String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || ""))
    }),
    filters
  )

  return {
    summary: {
      highRiskUsers: securityUsers.filter((user) => user.riskScore >= 40).length,
      manualReviews: securityUsers.filter((user) => user.manualReviewRequired).length,
      lockedUsers: securityUsers.filter((user) => user.temporaryLockedUntil && new Date(user.temporaryLockedUntil).getTime() > nowMs).length,
      suspendedUsers: securityUsers.filter((user) => Boolean(user.suspendedAt)).length,
      activeSessions: securityUsers.reduce((sum, user) => sum + user.activeSessions, 0),
      activeDevices: securityUsers.reduce((sum, user) => sum + user.registeredDevices, 0),
      paymentWarnings: securityUsers.reduce((sum, user) => sum + user.paymentWarnings, 0),
      videoWarnings: securityUsers.reduce((sum, user) => sum + user.videoWarnings, 0),
      apiRateLimits24h: securityUsers.reduce((sum, user) => sum + user.apiRateLimits24h, 0),
    },
    users: filteredUsers,
    events: eventRows,
    setupIssues: Array.from(new Set(rows.setupIssues || [])),
  }
}

async function runEqChain(chain: any, filters: Array<[string, unknown]>) {
  let query = chain
  for (const [column, value] of filters) {
    query = query.eq(column, value)
  }
  return query as PromiseLike<{ error: unknown }>
}

export async function applyOwnerSecurityActionWithClient(
  admin: OwnerSecurityActionClient,
  params: {
    actorUserId: string
    targetUserId: string
    action: OwnerSecurityAction
    reason: string
    deviceId?: string | null
    eventType?: string | null
    lockMinutes?: number | null
    nowIso?: string
  }
) {
  if (params.actorUserId === params.targetUserId && params.action !== "hide_from_security") {
    return { ok: false as const, error: "owner_self_action_blocked" }
  }

  const timestamp = params.nowIso || new Date().toISOString()
  const metadata = {
    owner_action: params.action,
    actor_user_id: params.actorUserId,
    reason: params.reason,
    device_id: params.deviceId || null,
    event_type: params.eventType || null,
    lock_minutes: params.lockMinutes || null,
  }

  if (params.action === "revoke_sessions") {
    const { error } = await runEqChain(
      admin.from("account_sessions").update({ status: "revoked", revoked_at: timestamp }),
      [["user_id", params.targetUserId], ["status", "active"]]
    )
    if (error) return { ok: false as const, error: "session_revoke_failed" }
  } else if (params.action === "revoke_device") {
    if (!params.deviceId) return { ok: false as const, error: "device_id_required" }
    const { error } = await runEqChain(
      admin.from("account_devices").update({ revoked_at: timestamp }),
      [["id", params.deviceId], ["user_id", params.targetUserId]]
    )
    if (error) return { ok: false as const, error: "device_revoke_failed" }
  } else if (params.action === "mark_review" || params.action === "clear_review") {
    const { error } = await admin.from("account_security_state").upsert(
      {
        user_id: params.targetUserId,
        manual_review_required: params.action === "mark_review",
        updated_at: timestamp,
      },
      { onConflict: "user_id" }
    )
    if (error) return { ok: false as const, error: "review_update_failed" }
  } else if (params.action === "clear_risk") {
    const { error } = await admin.from("account_security_state").upsert(
      {
        user_id: params.targetUserId,
        risk_score: 0,
        risk_reasons: [],
        manual_review_required: false,
        temporary_locked_until: null,
        last_evaluated_at: timestamp,
        updated_at: timestamp,
      },
      { onConflict: "user_id" }
    )
    if (error) return { ok: false as const, error: "risk_clear_failed" }
  } else if (params.action === "clear_event_type") {
    if (!params.eventType) return { ok: false as const, error: "event_type_required" }
    const { error } = await runEqChain(
      admin.from("account_security_events").update({
        metadata: {
          owner_resolved_at: timestamp,
          owner_resolved_by: params.actorUserId,
          owner_resolved_reason: params.reason,
          resolved_event_type: params.eventType,
        },
      }),
      [["user_id", params.targetUserId], ["event_type", params.eventType]]
    )
    if (error) return { ok: false as const, error: "event_type_clear_failed" }

    const { error: stateError } = await admin.from("account_security_state").upsert(
      {
        user_id: params.targetUserId,
        risk_score: 0,
        risk_reasons: [],
        manual_review_required: false,
        temporary_locked_until: null,
        last_evaluated_at: timestamp,
        updated_at: timestamp,
      },
      { onConflict: "user_id" }
    )
    if (stateError) return { ok: false as const, error: "risk_clear_failed" }
  } else if (params.action === "hide_from_security") {
    const { error } = await admin.from("account_security_events").insert({
      user_id: params.targetUserId,
      event_type: "owner_security_panel_hidden",
      metadata: {
        ...metadata,
        owner_hidden_at: timestamp,
      },
    })
    if (error) return { ok: false as const, error: "security_hide_failed" }
  } else if (params.action === "temporary_lock") {
    const lockMinutes = Math.max(5, Math.min(1440, Number(params.lockMinutes || 30)))
    const { error } = await admin.from("account_security_state").upsert(
      {
        user_id: params.targetUserId,
        manual_review_required: true,
        temporary_locked_until: new Date(new Date(timestamp).getTime() + lockMinutes * 60 * 1000).toISOString(),
        updated_at: timestamp,
      },
      { onConflict: "user_id" }
    )
    if (error) return { ok: false as const, error: "temporary_lock_failed" }
  } else if (params.action === "clear_lock") {
    const { error } = await admin.from("account_security_state").upsert(
      {
        user_id: params.targetUserId,
        temporary_locked_until: null,
        updated_at: timestamp,
      },
      { onConflict: "user_id" }
    )
    if (error) return { ok: false as const, error: "clear_lock_failed" }
  } else if (params.action === "suspend" || params.action === "unsuspend") {
    const { error } = await admin.from("account_security_state").upsert(
      {
        user_id: params.targetUserId,
        manual_review_required: params.action === "suspend",
        suspended_at: params.action === "suspend" ? timestamp : null,
        updated_at: timestamp,
      },
      { onConflict: "user_id" }
    )
    if (error) return { ok: false as const, error: "suspension_update_failed" }
  } else {
    return { ok: false as const, error: "action_invalid" }
  }

  if (params.action === "temporary_lock" || params.action === "suspend" || params.action === "revoke_sessions") {
    await runEqChain(
      admin.from("account_sessions").update({ status: "revoked", revoked_at: timestamp }),
      [["user_id", params.targetUserId], ["status", "active"]]
    )
  }

  await admin.from("account_security_events").insert({
    user_id: params.targetUserId,
    event_type: "owner_security_action",
    metadata,
  })

  await admin.from("billing_audit_events").insert({
    actor_user_id: params.actorUserId,
    target_user_id: params.targetUserId,
    action: `owner_security_${params.action}`,
    provider: "owner_panel",
    metadata,
  })

  return { ok: true as const }
}
