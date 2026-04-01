import { createSupabaseAdminClient } from "@/lib/supabase/admin"

export type OwnerAuditFilters = {
  sourceTable?: string
  ownerId?: string
  operation?: string
  from?: string
  to?: string
  limit?: number
}

export type OwnerAuditEventRow = {
  id: string
  captured_at: string
  source_table: string
  operation: string
  actor_owner_id: string | null
  member_owner_id: string | null
  record_pk: Record<string, unknown> | null
  payload: Record<string, unknown> | null
  changed_fields: Record<string, unknown> | null
  deleted_visible?: boolean | null
}

export function isOwnerAuditConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.OWNER_AUDIT_EMAILS
  )
}

export async function fetchOwnerAuditEvents(filters: OwnerAuditFilters = {}) {
  const admin = createSupabaseAdminClient()
  const limit = Math.max(1, Math.min(50000, Number(filters.limit || 250)))

  let query = admin
    .schema("owner_audit")
    .from("audit_events")
    .select("id, captured_at, source_table, operation, actor_owner_id, member_owner_id, record_pk, payload, changed_fields, deleted_visible")
    .order("captured_at", { ascending: false })
    .limit(limit)

  if (filters.sourceTable) query = query.eq("source_table", filters.sourceTable)
  if (filters.ownerId) query = query.eq("member_owner_id", filters.ownerId)
  if (filters.operation) query = query.eq("operation", filters.operation)
  if (filters.from) query = query.gte("captured_at", filters.from)
  if (filters.to) query = query.lte("captured_at", filters.to)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as OwnerAuditEventRow[]
}

export function summarizeOwnerAuditEvents(rows: OwnerAuditEventRow[]) {
  const uniqueMembers = new Set<string>()
  const byTable: Record<string, number> = {}
  const byOperation: Record<string, number> = {}

  for (const row of rows) {
    if (row.member_owner_id) uniqueMembers.add(String(row.member_owner_id))
    byTable[row.source_table] = (byTable[row.source_table] || 0) + 1
    byOperation[row.operation] = (byOperation[row.operation] || 0) + 1
  }

  return {
    total: rows.length,
    uniqueMembers: uniqueMembers.size,
    tables: byTable,
    operations: byOperation,
  }
}

export function getOwnerAuditRecordLabel(row: OwnerAuditEventRow): string {
  const payload = row.payload || {}
  const recordPk = row.record_pk || {}
  const candidates = [
    payload.child_code,
    payload.client_code,
    payload.code,
    payload.title,
    payload.client_name,
    payload.name,
    recordPk.id,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)

  return candidates[0] || "Kayıt"
}

export function getOwnerAuditPreview(row: OwnerAuditEventRow): string {
  const payload = row.payload || {}
  const changedFields = row.changed_fields || {}

  const previewCandidates = [
    payload.raw_summary,
    payload.therapist_notes,
    payload.external_clinical_findings,
    payload.report_text,
    payload.profile_type,
    payload.global_level,
    Object.keys(changedFields).length ? `Değişen alanlar: ${Object.keys(changedFields).slice(0, 4).join(", ")}` : "",
  ]
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const preview = previewCandidates[0] || ""
  if (!preview) return "Önizleme yok"
  return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview
}
