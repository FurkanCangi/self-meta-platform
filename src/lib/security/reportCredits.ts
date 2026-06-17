import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { INITIAL_PROGRAM_REPORT_CREDITS, REPORT_PACKAGE_CREDITS } from "@/lib/legal/documents"

export type ReportCreditReason =
  | "initial_program_grant"
  | keyof typeof REPORT_PACKAGE_CREDITS
  | "manual_admin_grant"
  | "ai_report_consumed"
  | "adjustment"

export async function getReportCreditBalance(params: {
  admin: SupabaseClient
  userId: string
}) {
  const { data, error } = await params.admin
    .from("report_credit_ledger")
    .select("delta")
    .eq("user_id", params.userId)

  if (error) return { ok: false as const, error: "report_credit_lookup_failed", balance: 0 }

  const balance = (data || []).reduce((total: number, row: any) => total + Number(row.delta || 0), 0)
  return { ok: true as const, balance }
}

export async function getReportCreditSummary(params: {
  admin: SupabaseClient
  userId: string
}) {
  const { data, error } = await params.admin
    .from("report_credit_ledger")
    .select("delta")
    .eq("user_id", params.userId)

  if (error) {
    return {
      ok: false as const,
      error: "report_credit_lookup_failed",
      granted: 0,
      consumed: 0,
      balance: 0,
    }
  }

  const rows = data || []
  const granted = rows.reduce((total: number, row: any) => {
    const delta = Number(row.delta || 0)
    return delta > 0 ? total + delta : total
  }, 0)
  const consumed = rows.reduce((total: number, row: any) => {
    const delta = Number(row.delta || 0)
    return delta < 0 ? total + Math.abs(delta) : total
  }, 0)

  return { ok: true as const, granted, consumed, balance: granted - consumed }
}

export async function grantReportCredits(params: {
  admin: SupabaseClient
  userId: string
  delta: number
  reason: ReportCreditReason
  source?: "payment_webhook" | "manual_admin" | "system"
  provider?: string | null
  providerEventId?: string | null
  metadata?: Record<string, unknown>
}) {
  if (!params.userId || !Number.isFinite(params.delta) || params.delta <= 0) {
    return { ok: false as const, error: "report_credit_grant_invalid" }
  }

  const { error } = await params.admin.from("report_credit_ledger").insert({
    user_id: params.userId,
    delta: Math.floor(params.delta),
    reason: params.reason,
    source: params.source || "system",
    provider: params.provider || null,
    provider_event_id: params.providerEventId || null,
    metadata: params.metadata || {},
  })

  if (error) {
    const duplicate = String(error.message || "").toLowerCase().includes("duplicate")
    if (duplicate) return { ok: true as const, duplicate: true }
    return { ok: false as const, error: "report_credit_grant_failed" }
  }

  return { ok: true as const }
}

export async function grantInitialProgramCredits(params: {
  admin: SupabaseClient
  userId: string
  provider?: string | null
  providerEventId?: string | null
  metadata?: Record<string, unknown>
}) {
  return grantReportCredits({
    admin: params.admin,
    userId: params.userId,
    delta: INITIAL_PROGRAM_REPORT_CREDITS,
    reason: "initial_program_grant",
    source: "payment_webhook",
    provider: params.provider,
    providerEventId: params.providerEventId,
    metadata: params.metadata,
  })
}

export async function consumeReportCredit(params: {
  admin: SupabaseClient
  userId: string
  assessmentId?: string | null
  clientId?: string | null
  metadata?: Record<string, unknown>
}) {
  const { data, error } = await params.admin.rpc("consume_report_credit", {
    target_user_id: params.userId,
    target_assessment_id: params.assessmentId || null,
    target_client_id: params.clientId || null,
    consume_metadata: params.metadata || {},
  })

  if (error) return { ok: false as const, error: "report_credit_consume_failed", remaining: 0 }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.ok) {
    return {
      ok: false as const,
      error: String(row?.error || "report_credit_required"),
      remaining: Number(row?.remaining || 0),
    }
  }

  return { ok: true as const, remaining: Number(row.remaining || 0) }
}
