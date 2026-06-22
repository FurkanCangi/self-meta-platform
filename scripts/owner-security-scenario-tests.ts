import {
  applyOwnerSecurityActionWithClient,
  buildOwnerSecurityDashboardFromRows,
  type OwnerSecurityActionClient,
} from "../src/lib/owner/ownerSecurityCore"

type Failure = {
  name: string
  detail: string
}

type RecordedCall = {
  table: string
  type: "update" | "upsert" | "insert"
  values: Record<string, unknown>
  filters?: Array<[string, unknown]>
}

const failures: Failure[] = []
const NOW = new Date("2026-06-19T12:00:00.000Z")
const OWNER_ID = "00000000-0000-4000-8000-000000000001"
const TARGET_ID = "00000000-0000-4000-8000-000000000002"
const OTHER_ID = "00000000-0000-4000-8000-000000000003"
const DEVICE_ID = "00000000-0000-4000-8000-000000000102"

function check(name: string, condition: unknown, detail: string) {
  if (!condition) failures.push({ name, detail })
}

function iso(minutesAgo: number) {
  return new Date(NOW.getTime() - minutesAgo * 60 * 1000).toISOString()
}

function makeRows() {
  return {
    nowMs: NOW.getTime(),
    authUsers: [
      { id: OWNER_ID, email: "owner@example.com", fullName: "Owner User" },
      { id: TARGET_ID, email: "attacker@example.com", fullName: "Riskli Kullanici" },
      { id: OTHER_ID, email: "normal@example.com", fullName: "Normal Kullanici" },
    ],
    profiles: [
      { user_id: TARGET_ID, role: "expert", plan: "professional" },
      { user_id: OTHER_ID, role: "expert", plan: "student" },
    ],
    states: [
      {
        user_id: TARGET_ID,
        risk_score: 85,
        risk_reasons: [
          "24 saat içinde 5 veya daha fazla farklı IP",
          "Cihaz limiti tekrar tekrar aşılmaya çalışıldı",
        ],
        manual_review_required: true,
        temporary_locked_until: iso(-30),
        suspended_at: null,
      },
    ],
    sessions: [
      { id: "s1", user_id: TARGET_ID, device_id: DEVICE_ID, status: "active", created_at: iso(80), last_seen_at: iso(2), ip_address: "10.0.0.1" },
      { id: "s2", user_id: TARGET_ID, device_id: DEVICE_ID, status: "active", created_at: iso(70), last_seen_at: iso(3), ip_address: "10.0.0.2" },
      { id: "s3", user_id: OTHER_ID, device_id: "d-other", status: "active", created_at: iso(50), last_seen_at: iso(5), ip_address: "10.0.1.1" },
    ],
    devices: [
      { id: DEVICE_ID, user_id: TARGET_ID, device_type: "desktop", first_seen_at: iso(1000), last_seen_at: iso(2), revoked_at: null, last_ip: "10.0.0.3" },
      { id: "00000000-0000-4000-8000-000000000103", user_id: TARGET_ID, device_type: "mobile", first_seen_at: iso(900), last_seen_at: iso(4), revoked_at: null, last_ip: "10.0.0.4" },
      { id: "00000000-0000-4000-8000-000000000104", user_id: TARGET_ID, device_type: "tablet", first_seen_at: iso(800), last_seen_at: iso(6), revoked_at: iso(7), last_ip: "10.0.0.5" },
    ],
    securityEvents: [
      { id: 1, user_id: TARGET_ID, event_type: "device_limit_blocked", created_at: iso(10), ip_address: "10.0.0.1", user_agent: "agent-a", metadata: { route: "/api/security/session/register" } },
      { id: 2, user_id: TARGET_ID, event_type: "device_slot_blocked", created_at: iso(9), ip_address: "10.0.0.2", user_agent: "agent-b", metadata: {} },
      { id: 3, user_id: TARGET_ID, event_type: "api_rate_limited", created_at: iso(8), ip_address: "10.0.0.3", user_agent: "agent-c", metadata: { route: "/api/ai-report" } },
      { id: 4, user_id: TARGET_ID, event_type: "active_session_ip_changed", created_at: iso(7), ip_address: "10.0.0.4", user_agent: "agent-d", metadata: {} },
      { id: 5, user_id: TARGET_ID, event_type: "device_metadata_changed", created_at: iso(6), ip_address: "10.0.0.5", user_agent: "agent-e", metadata: {} },
      { id: 6, user_id: TARGET_ID, event_type: "device_slot_reused", created_at: iso(5), ip_address: "10.0.0.6", user_agent: "agent-f", metadata: { device_slot: "mobile" } },
      { id: 7, user_id: TARGET_ID, event_type: "user_device_revoked_self", created_at: iso(4), ip_address: "10.0.0.7", user_agent: "agent-g", metadata: { source: "device_management" } },
      { id: 8, user_id: TARGET_ID, event_type: "frequent_device_changes", created_at: iso(3), ip_address: "10.0.0.8", user_agent: "agent-h", metadata: { device_movement_count_24h: 3 } },
    ],
    billingEvents: [
      { id: 10, target_user_id: TARGET_ID, action: "payment_amount_mismatch", provider: "stripe", provider_event_id: "evt_bad", created_at: iso(12), metadata: { expected: 50000 } },
    ],
    paymentEvents: [
      { id: 11, user_id: TARGET_ID, event_type: "payment.failed", plan_code: "professional", amount: 1, currency: "TRY", processed_at: iso(11) },
    ],
    entitlements: [
      { id: "ent1", user_id: TARGET_ID, feature: "education_video", plan_code: "professional", revoked_at: null, updated_at: iso(200) },
    ],
    creditLedger: [
      { id: "cr1", user_id: TARGET_ID, delta: 10, reason: "report_package_10", created_at: iso(100) },
      { id: "cr2", user_id: TARGET_ID, delta: -1, reason: "ai_report_consumed", created_at: iso(20) },
    ],
    videoLogs: [
      { id: 20, user_id: TARGET_ID, video_id: "video-1", event_type: "concurrent_playback_blocked", created_at: iso(15), ip_address: "10.0.0.6", metadata: { video_slug: "egitim-1" } },
    ],
    playbackSessions: [
      { id: "pb1", user_id: TARGET_ID, video_id: "video-1", player_session_id: "p1", last_heartbeat_at: iso(1), ended_at: null, ip_address: "10.0.0.7", created_at: iso(30) },
    ],
    setupIssues: [],
  }
}

function makeRowsWithHiddenTarget() {
  const rows = makeRows()
  return {
    ...rows,
    securityEvents: [
      ...rows.securityEvents,
      { id: 99, user_id: TARGET_ID, event_type: "owner_security_panel_hidden", created_at: iso(0), ip_address: null, user_agent: "owner-agent", metadata: { owner_hidden_at: iso(0) } },
    ],
  }
}

function makeRowsWithHiddenTargetAndNewEvent() {
  const rows = makeRowsWithHiddenTarget()
  return {
    ...rows,
    securityEvents: [
      ...rows.securityEvents,
      { id: 100, user_id: TARGET_ID, event_type: "api_rate_limited", created_at: iso(-1), ip_address: "10.0.0.9", user_agent: "agent-new", metadata: { route: "/api/ai-report" } },
    ],
  }
}

function makeMockAdmin() {
  const calls: RecordedCall[] = []
  const admin: OwnerSecurityActionClient = {
    from(table: string) {
      return {
        update(values: Record<string, unknown>) {
          const call: RecordedCall = { table, type: "update", values, filters: [] }
          calls.push(call)
          return {
            eq(column: string, value: unknown) {
              call.filters?.push([column, value])
              return this
            },
            then(resolve: (value: { error: null }) => void) {
              resolve({ error: null })
            },
          }
        },
        upsert(values: Record<string, unknown>) {
          calls.push({ table, type: "upsert", values })
          return Promise.resolve({ error: null })
        },
        insert(values: Record<string, unknown>) {
          calls.push({ table, type: "insert", values })
          return Promise.resolve({ error: null })
        },
      }
    },
  }
  return { admin, calls }
}

function hasCall(calls: RecordedCall[], predicate: (call: RecordedCall) => boolean) {
  return calls.some(predicate)
}

async function main() {
  const dashboard = buildOwnerSecurityDashboardFromRows(makeRows(), {})
  const target = dashboard.users.find((user) => user.userId === TARGET_ID)

  check("high risk user appears in panel payload", Boolean(target), JSON.stringify(dashboard.users))
  check("5 IP / device attack is critical", target?.riskLevel === "critical" && target.riskScore === 85, JSON.stringify(target))
  check("device limit and movement attempts are counted", target?.deviceBlocks24h === 3, JSON.stringify(target))
  check("API rate limit is counted", target?.apiRateLimits24h === 1, JSON.stringify(target))
  check("payment mismatch creates warning count", target?.paymentWarnings === 2, JSON.stringify(target))
  check("concurrent video playback creates warning count", target?.videoWarnings === 2, JSON.stringify(target))
  check("report credit ledger balance is calculated", target?.reportCreditBalance === 9, JSON.stringify(target))
  check("active sessions and devices are visible", target?.activeSessions === 2 && target.registeredDevices === 2, JSON.stringify(target))
  check("payment mismatch event is danger", dashboard.events.some((event) => event.label.includes("Paket odeme tutari") && event.severity === "danger"), JSON.stringify(dashboard.events))
  check("video concurrent event is danger", dashboard.events.some((event) => event.label.includes("eszamanli") && event.severity === "danger"), JSON.stringify(dashboard.events))
  check("frequent device changes event is warning", dashboard.events.some((event) => event.label.includes("Cihaz kaldir/ekle") && event.severity === "warning"), JSON.stringify(dashboard.events))
  check("risk filter returns target only", buildOwnerSecurityDashboardFromRows(makeRows(), { risk: "critical" }).users.length === 1, "critical filter failed")
  check("payment filter returns target only", buildOwnerSecurityDashboardFromRows(makeRows(), { category: "payment" }).users.length === 1, "payment filter failed")
  check("hidden user is removed from security panel", !buildOwnerSecurityDashboardFromRows(makeRowsWithHiddenTarget(), {}).users.some((user) => user.userId === TARGET_ID), "hidden target still visible")
  check("new security event makes hidden user visible again", buildOwnerSecurityDashboardFromRows(makeRowsWithHiddenTargetAndNewEvent(), {}).users.some((user) => user.userId === TARGET_ID), "new event should unhide target")

  const selfAction = await applyOwnerSecurityActionWithClient(makeMockAdmin().admin, {
    actorUserId: OWNER_ID,
    targetUserId: OWNER_ID,
    action: "suspend",
    reason: "self test",
    nowIso: NOW.toISOString(),
  })
  check("owner cannot target own account", !selfAction.ok && selfAction.error === "owner_self_action_blocked", JSON.stringify(selfAction))

  const selfHide = await applyOwnerSecurityActionWithClient(makeMockAdmin().admin, {
    actorUserId: OWNER_ID,
    targetUserId: OWNER_ID,
    action: "hide_from_security",
    reason: "hide own low risk row",
    nowIso: NOW.toISOString(),
  })
  check("owner can hide own row from security panel", selfHide.ok, JSON.stringify(selfHide))

  const revokeSessions = makeMockAdmin()
  await applyOwnerSecurityActionWithClient(revokeSessions.admin, {
    actorUserId: OWNER_ID,
    targetUserId: TARGET_ID,
    action: "revoke_sessions",
    reason: "parallel suspicious usage",
    nowIso: NOW.toISOString(),
  })
  check("revoke sessions updates active sessions", hasCall(revokeSessions.calls, (call) =>
    call.table === "account_sessions" &&
    call.type === "update" &&
    call.values.status === "revoked" &&
    Boolean(call.filters?.some(([column, value]) => column === "user_id" && value === TARGET_ID)) &&
    Boolean(call.filters?.some(([column, value]) => column === "status" && value === "active"))
  ), JSON.stringify(revokeSessions.calls))
  check("revoke sessions writes audit records", revokeSessions.calls.filter((call) => call.type === "insert").length === 2, JSON.stringify(revokeSessions.calls))

  const revokeDevice = makeMockAdmin()
  await applyOwnerSecurityActionWithClient(revokeDevice.admin, {
    actorUserId: OWNER_ID,
    targetUserId: TARGET_ID,
    action: "revoke_device",
    reason: "device sharing",
    deviceId: DEVICE_ID,
    nowIso: NOW.toISOString(),
  })
  check("revoke device updates selected device", hasCall(revokeDevice.calls, (call) =>
    call.table === "account_devices" &&
    call.type === "update" &&
    Boolean(call.values.revoked_at) &&
    Boolean(call.filters?.some(([column, value]) => column === "id" && value === DEVICE_ID))
  ), JSON.stringify(revokeDevice.calls))

  const temporaryLock = makeMockAdmin()
  await applyOwnerSecurityActionWithClient(temporaryLock.admin, {
    actorUserId: OWNER_ID,
    targetUserId: TARGET_ID,
    action: "temporary_lock",
    reason: "account sharing",
    lockMinutes: 30,
    nowIso: NOW.toISOString(),
  })
  check("temporary lock writes lock state", hasCall(temporaryLock.calls, (call) =>
    call.table === "account_security_state" &&
    call.type === "upsert" &&
    call.values.manual_review_required === true &&
    Boolean(call.values.temporary_locked_until)
  ), JSON.stringify(temporaryLock.calls))
  check("temporary lock revokes active sessions", hasCall(temporaryLock.calls, (call) =>
    call.table === "account_sessions" && call.type === "update" && call.values.status === "revoked"
  ), JSON.stringify(temporaryLock.calls))

  const clearRisk = makeMockAdmin()
  await applyOwnerSecurityActionWithClient(clearRisk.admin, {
    actorUserId: OWNER_ID,
    targetUserId: TARGET_ID,
    action: "clear_risk",
    reason: "test access relaxation",
    nowIso: NOW.toISOString(),
  })
  check("clear risk resets risk state and lock", hasCall(clearRisk.calls, (call) =>
    call.table === "account_security_state" &&
    call.type === "upsert" &&
    call.values.risk_score === 0 &&
    Array.isArray(call.values.risk_reasons) &&
    call.values.manual_review_required === false &&
    call.values.temporary_locked_until === null
  ), JSON.stringify(clearRisk.calls))
  check("clear risk writes owner audit", hasCall(clearRisk.calls, (call) =>
    call.table === "billing_audit_events" &&
    call.type === "insert" &&
    call.values.action === "owner_security_clear_risk"
  ), JSON.stringify(clearRisk.calls))

  const clearEventType = makeMockAdmin()
  await applyOwnerSecurityActionWithClient(clearEventType.admin, {
    actorUserId: OWNER_ID,
    targetUserId: TARGET_ID,
    action: "clear_event_type",
    reason: "student support cleanup",
    eventType: "device_limit_blocked",
    nowIso: NOW.toISOString(),
  })
  check("clear event type marks matching events resolved", hasCall(clearEventType.calls, (call) =>
    call.table === "account_security_events" &&
    call.type === "update" &&
    (call.values.metadata as Record<string, unknown>)?.owner_resolved_at === NOW.toISOString() &&
    Boolean(call.filters?.some(([column, value]) => column === "event_type" && value === "device_limit_blocked"))
  ), JSON.stringify(clearEventType.calls))
  check("clear event type writes owner audit", hasCall(clearEventType.calls, (call) =>
    call.table === "billing_audit_events" &&
    call.type === "insert" &&
    call.values.action === "owner_security_clear_event_type"
  ), JSON.stringify(clearEventType.calls))

  const suspend = makeMockAdmin()
  await applyOwnerSecurityActionWithClient(suspend.admin, {
    actorUserId: OWNER_ID,
    targetUserId: TARGET_ID,
    action: "suspend",
    reason: "payment abuse",
    nowIso: NOW.toISOString(),
  })
  check("suspend writes suspended state", hasCall(suspend.calls, (call) =>
    call.table === "account_security_state" &&
    call.type === "upsert" &&
    call.values.manual_review_required === true &&
    Boolean(call.values.suspended_at)
  ), JSON.stringify(suspend.calls))
  check("suspend writes account and billing audit", hasCall(suspend.calls, (call) =>
    call.table === "account_security_events" &&
    call.type === "insert" &&
    call.values.event_type === "owner_security_action"
  ) && hasCall(suspend.calls, (call) =>
    call.table === "billing_audit_events" &&
    call.type === "insert" &&
    call.values.action === "owner_security_suspend"
  ), JSON.stringify(suspend.calls))

  const hideFromPanel = makeMockAdmin()
  await applyOwnerSecurityActionWithClient(hideFromPanel.admin, {
    actorUserId: OWNER_ID,
    targetUserId: TARGET_ID,
    action: "hide_from_security",
    reason: "not relevant in security panel",
    nowIso: NOW.toISOString(),
  })
  check("hide from security panel writes hidden event", hasCall(hideFromPanel.calls, (call) =>
    call.table === "account_security_events" &&
    call.type === "insert" &&
    call.values.event_type === "owner_security_panel_hidden"
  ), JSON.stringify(hideFromPanel.calls))

  const securityPage = await import("node:fs").then((fs) => fs.readFileSync("src/app/owner-audit/security/page.tsx", "utf8"))
  const securityActions = await import("node:fs").then((fs) => fs.readFileSync("src/app/owner-audit/security/OwnerSecurityActions.tsx", "utf8"))
  check("owner security page has filters", securityPage.includes('name="risk"') && securityPage.includes('name="category"'), "filters missing")
  check("owner security page renders action buttons", securityPage.includes("OwnerSecurityActionButton"), "action buttons missing")
  check("owner security actions do not use browser prompts", !securityActions.includes("window.prompt") && securityActions.includes("defaultReason"), "owner action prompt should not be used")
  check("owner security page can hide rows", securityPage.includes('action="hide_from_security"') && securityPage.includes("Listeden gizle"), "hide from security action missing")
  check("owner security page can clear risk", securityPage.includes('action="clear_risk"') && securityPage.includes("Riskten çıkar"), "clear risk action missing")
  check("owner security page can clear specific situations", securityPage.includes('action="clear_event_type"') && securityPage.includes("Temizlenebilir güvenlik durumları"), "clear event type action missing")
  check("owner security events are collapsible", securityPage.includes("Son Güvenlik Olayları") && securityPage.includes("<details"), "collapsible event panel missing")
  check("owner security page links detail view", securityPage.includes("/owner-audit/${encodeURIComponent(user.userId)}?tab=audit"), "detail link missing")

  if (failures.length > 0) {
    console.error("Owner security scenario tests failed:")
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.detail}`)
    }
    process.exit(1)
  }

  console.log("Owner security scenario tests passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
