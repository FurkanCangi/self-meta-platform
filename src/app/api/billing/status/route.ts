import { NextResponse } from "next/server"
import { requireConfirmedUser } from "@/lib/security/apiGuards"
import { EDUCATION_VIDEO_FEATURE } from "@/lib/security/entitlements"
import { getReportCreditSummary } from "@/lib/security/reportCredits"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

function isActiveEntitlement(row: any) {
  if (!row || row.revoked_at) return false
  if (row.starts_at && new Date(String(row.starts_at)).getTime() > Date.now()) return false
  if (row.expires_at && new Date(String(row.expires_at)).getTime() <= Date.now()) return false
  return true
}

export async function GET() {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const admin = createSupabaseAdminClient()
  const userId = auth.user.id

  const { data: entitlements, error: entitlementError } = await admin
    .from("user_entitlements")
    .select("feature, plan_code, source, provider, starts_at, expires_at, revoked_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20)

  if (entitlementError) {
    return NextResponse.json({ ok: false, error: "entitlement_status_failed" }, { status: 500 })
  }

  const educationEntitlement =
    (entitlements || []).find((row: any) => row.feature === EDUCATION_VIDEO_FEATURE && isActiveEntitlement(row)) ||
    null

  const { data: clients, error: clientsError } = await admin
    .from("clients")
    .select("id")
    .eq("owner_id", userId)
    .is("deleted_at", null)

  if (clientsError) {
    return NextResponse.json({ ok: false, error: "client_usage_lookup_failed" }, { status: 500 })
  }

  const clientIds = (clients || []).map((row: any) => row.id).filter(Boolean)
  let reportCount = 0

  if (clientIds.length > 0) {
    const { data: assessments, error: assessmentsError } = await admin
      .from("assessments_v2")
      .select("id")
      .in("client_id", clientIds)
      .is("deleted_at", null)

    if (assessmentsError) {
      return NextResponse.json({ ok: false, error: "assessment_usage_lookup_failed" }, { status: 500 })
    }

    const assessmentIds = (assessments || []).map((row: any) => row.id).filter(Boolean)
    if (assessmentIds.length > 0) {
      const { count, error: reportsError } = await admin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .in("assessment_id", assessmentIds)

      if (reportsError) {
        return NextResponse.json({ ok: false, error: "report_usage_lookup_failed" }, { status: 500 })
      }

      reportCount = count || 0
    }
  }

  const { data: billingEvents } = await admin
    .from("billing_audit_events")
    .select("action, provider, created_at, metadata")
    .eq("target_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5)

  const creditSummary = await getReportCreditSummary({ admin, userId })

  return NextResponse.json({
    ok: true,
    education: {
      active: Boolean(educationEntitlement),
      planCode: educationEntitlement?.plan_code || null,
      source: educationEntitlement?.source || null,
      provider: educationEntitlement?.provider || null,
      startsAt: educationEntitlement?.starts_at || null,
      expiresAt: educationEntitlement?.expires_at || null,
    },
    reports: {
      used: creditSummary.ok ? creditSummary.consumed : reportCount,
      included: creditSummary.ok ? creditSummary.granted : 0,
      remaining: creditSummary.ok ? creditSummary.balance : 0,
      creditLedgerAvailable: creditSummary.ok,
    },
    recentBillingEvents: (billingEvents || []).map((row: any) => ({
      action: String(row.action || ""),
      provider: row.provider ? String(row.provider) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      metadata: row.metadata || {},
    })),
  })
}
