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
  record_pk: string | null
  payload: Record<string, unknown> | null
  changed_fields: Record<string, unknown> | null
  deleted_visible?: boolean | null
}

export type OwnerMemberSummary = {
  ownerId: string
  email: string
  fullName: string
  role: string
  plan: string
  totalClients: number
  archivedClients: number
  totalAssessments: number
  totalReports: number
  totalEvents: number
  deleteEvents: number
  lastActivityAt: string | null
  latestClientCode: string
  latestReportProfile: string
  latestReportAt: string | null
}

export type OwnerClientSnapshot = {
  id: string
  childCode: string
  anamnezPreview: string
  anamnezFull: string
  createdAt: string | null
  deletedAt: string | null
  assessmentsCount: number
  reportsCount: number
  lastAssessmentAt: string | null
  lastReportAt: string | null
  latestReportProfile: string
  latestReportPreview: string
  linkedReports: OwnerClientLinkedReport[]
}

export type OwnerClientLinkedReport = {
  id: string
  createdAt: string | null
  version: number | null
  profileType: string
  globalLevel: string
  preview: string
}

export type OwnerReportSnapshot = {
  id: string
  createdAt: string | null
  version: number | null
  assessmentId: string | null
  clientId: string | null
  clientCode: string
  profileType: string
  globalLevel: string
  preview: string
}

export type OwnerMemberDetail = {
  summary: OwnerMemberSummary
  clients: OwnerClientSnapshot[]
  reports: OwnerReportSnapshot[]
  recentEvents: OwnerAuditEventRow[]
}

export type OwnerDossierRow = {
  owner_id: string
  owner_email: string
  owner_full_name: string
  owner_role: string
  owner_plan: string
  owner_last_activity_at: string | null
  total_clients: number
  total_reports: number
  client_id: string
  client_code: string
  client_created_at: string | null
  client_deleted_at: string | null
  client_assessments_count: number
  client_reports_count: number
  client_last_assessment_at: string | null
  client_last_report_at: string | null
  anamnez_full: string
  latest_report_profile: string
  latest_report_preview: string
  report_id: string | null
  report_created_at: string | null
  report_version: number | null
  report_profile_type: string
  report_global_level: string
  report_preview: string
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

type AuthUserRow = {
  id: string
  email: string
  fullName: string
}

type ProfileRow = {
  user_id: string
  role: string | null
  plan: string | null
}

type ClientRow = {
  id: string
  owner_id: string | null
  child_code: string | null
  anamnez: string | null
  created_at: string | null
  deleted_at: string | null
}

type AssessmentRow = {
  id: string
  client_id: string | null
  created_at: string | null
  deleted_at: string | null
}

type ReportRow = {
  id: string
  assessment_id: string | null
  created_at: string | null
  version: number | null
  report_text: string | null
  snapshot_json: Record<string, unknown> | null
}

function cleanPreview(value: string | null | undefined, maxLength = 220) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim()
  if (!cleaned) return "—"
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned
}

function pickSnapshotString(snapshot: Record<string, unknown> | null | undefined, key: string) {
  const direct = snapshot?.[key]
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  return ""
}

async function fetchAuthUsers() {
  const admin = createSupabaseAdminClient()
  const authUsers: AuthUserRow[] = []
  let page = 1

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error) {
      throw new Error(error.message)
    }

    const users = data?.users || []
    for (const user of users) {
      authUsers.push({
        id: user.id,
        email: user.email || "",
        fullName: String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim(),
      })
    }

    if (users.length < 1000) break
    page += 1
  }

  return authUsers
}

async function fetchProfiles() {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.from("profiles").select("user_id, role, plan")

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as ProfileRow[]
}

async function fetchOwnerProductionRows() {
  const admin = createSupabaseAdminClient()

  const [{ data: clients, error: clientsError }, { data: assessments, error: assessmentsError }, { data: reports, error: reportsError }] =
    await Promise.all([
      admin
        .from("clients")
        .select("id, owner_id, child_code, anamnez, created_at, deleted_at"),
      admin
        .from("assessments_v2")
        .select("id, client_id, created_at, deleted_at"),
      admin
        .from("reports")
        .select("id, assessment_id, created_at, version, report_text, snapshot_json"),
    ])

  if (clientsError) throw new Error(clientsError.message)
  if (assessmentsError) throw new Error(assessmentsError.message)
  if (reportsError) throw new Error(reportsError.message)

  return {
    clients: (clients || []) as ClientRow[],
    assessments: (assessments || []) as AssessmentRow[],
    reports: (reports || []) as ReportRow[],
  }
}

function buildOwnerIndex(
  authUsers: AuthUserRow[],
  profiles: ProfileRow[],
  clients: ClientRow[],
  assessments: AssessmentRow[],
  reports: ReportRow[],
  auditRows: OwnerAuditEventRow[]
) {
  const authById = new Map(authUsers.map((row) => [row.id, row]))
  const profileByUserId = new Map(profiles.map((row) => [row.user_id, row]))
  const clientById = new Map(clients.map((row) => [row.id, row]))
  const assessmentsByClientId = new Map<string, AssessmentRow[]>()
  const reportsByAssessmentId = new Map<string, ReportRow[]>()

  for (const assessment of assessments) {
    if (!assessment.client_id) continue
    const list = assessmentsByClientId.get(assessment.client_id) || []
    list.push(assessment)
    assessmentsByClientId.set(assessment.client_id, list)
  }

  for (const report of reports) {
    if (!report.assessment_id) continue
    const list = reportsByAssessmentId.get(report.assessment_id) || []
    list.push(report)
    reportsByAssessmentId.set(report.assessment_id, list)
  }

  const candidateOwnerIds = new Set<string>()
  for (const user of authUsers) candidateOwnerIds.add(user.id)
  for (const profile of profiles) candidateOwnerIds.add(profile.user_id)
  for (const client of clients) if (client.owner_id) candidateOwnerIds.add(client.owner_id)
  for (const row of auditRows) if (row.member_owner_id) candidateOwnerIds.add(row.member_owner_id)

  const memberSummaries: OwnerMemberSummary[] = []

  for (const ownerId of candidateOwnerIds) {
    const authUser = authById.get(ownerId)
    const profile = profileByUserId.get(ownerId)
    const ownerClients = clients.filter((row) => row.owner_id === ownerId)
    const ownerClientIds = new Set(ownerClients.map((row) => row.id))
    const ownerAssessments = assessments.filter((row) => row.client_id && ownerClientIds.has(row.client_id))
    const ownerAssessmentIds = new Set(ownerAssessments.map((row) => row.id))
    const ownerReports = reports.filter((row) => row.assessment_id && ownerAssessmentIds.has(row.assessment_id))
    const ownerEvents = auditRows.filter((row) => row.member_owner_id === ownerId)
    const lastActivityAt = ownerEvents
      .map((row) => row.captured_at || "")
      .filter(Boolean)
      .sort()
      .at(-1) || null

    if (
      ownerClients.length === 0 &&
      ownerAssessments.length === 0 &&
      ownerReports.length === 0 &&
      ownerEvents.length === 0 &&
      !authUser &&
      !profile
    ) {
      continue
    }

    memberSummaries.push({
      ownerId,
      email: authUser?.email || "E-posta yok",
      fullName: authUser?.fullName || "İsimsiz Üye",
      role: profile?.role || "expert",
      plan: profile?.plan || "none",
      totalClients: ownerClients.filter((row) => !row.deleted_at).length,
      archivedClients: ownerClients.filter((row) => Boolean(row.deleted_at)).length,
      totalAssessments: ownerAssessments.filter((row) => !row.deleted_at).length,
      totalReports: ownerReports.length,
      totalEvents: ownerEvents.length,
      deleteEvents: ownerEvents.filter((row) => row.operation === "DELETE" || row.deleted_visible).length,
      lastActivityAt,
      latestClientCode:
        String(
          ownerClients
            .slice()
            .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0]?.child_code || ""
        ).trim() || "-",
      latestReportProfile:
        cleanPreview(
          String(
            ownerReports
              .slice()
              .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0]?.snapshot_json?.profile_type ||
              ownerReports
                .slice()
                .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0]?.report_text ||
              ""
          ),
          80
        ) || "-",
      latestReportAt:
        ownerReports
          .map((row) => row.created_at || "")
          .filter(Boolean)
          .sort()
          .at(-1) || null,
    })
  }

  memberSummaries.sort((a, b) => {
    const activityCompare = String(b.lastActivityAt || "").localeCompare(String(a.lastActivityAt || ""))
    if (activityCompare !== 0) return activityCompare
    return a.fullName.localeCompare(b.fullName, "tr")
  })

  return {
    authById,
    profileByUserId,
    clientById,
    assessmentsByClientId,
    reportsByAssessmentId,
    memberSummaries,
  }
}

export async function fetchOwnerMemberSummaries(search = "") {
  const [authUsers, profiles, productionRows, auditRows] = await Promise.all([
    fetchAuthUsers(),
    fetchProfiles(),
    fetchOwnerProductionRows(),
    fetchOwnerAuditEvents({ limit: 50000 }),
  ])

  const { memberSummaries } = buildOwnerIndex(
    authUsers,
    profiles,
    productionRows.clients,
    productionRows.assessments,
    productionRows.reports,
    auditRows
  )

  const q = String(search || "").trim().toLowerCase()
  if (!q) return memberSummaries

  return memberSummaries.filter((row) =>
    [row.fullName, row.email, row.ownerId, row.plan, row.role]
      .map((value) => String(value || "").toLowerCase())
      .some((value) => value.includes(q))
  )
}

async function fetchOwnerDataBundle(auditFilters: OwnerAuditFilters = { limit: 50000 }) {
  const [authUsers, profiles, productionRows, auditRows] = await Promise.all([
    fetchAuthUsers(),
    fetchProfiles(),
    fetchOwnerProductionRows(),
    fetchOwnerAuditEvents(auditFilters),
  ])

  const ownerIndex = buildOwnerIndex(
    authUsers,
    profiles,
    productionRows.clients,
    productionRows.assessments,
    productionRows.reports,
    auditRows
  )

  return {
    authUsers,
    profiles,
    productionRows,
    auditRows,
    ownerIndex,
  }
}

function buildOwnerMemberDetailFromBundle(
  ownerId: string,
  bundle: Awaited<ReturnType<typeof fetchOwnerDataBundle>>
) {
  const { productionRows, auditRows, ownerIndex } = bundle
  const summary = ownerIndex.memberSummaries.find((row) => row.ownerId === ownerId)
  if (!summary) {
    throw new Error("Üye kaydı bulunamadı.")
  }

  const ownerClients = productionRows.clients
    .filter((row) => row.owner_id === ownerId)
    .map((client) => {
      const clientAssessments = ownerIndex.assessmentsByClientId.get(client.id) || []
      const clientReports = clientAssessments.flatMap((assessment) => ownerIndex.reportsByAssessmentId.get(assessment.id) || [])
      const lastAssessmentAt = clientAssessments
        .map((row) => row.created_at || "")
        .filter(Boolean)
        .sort()
        .at(-1) || null
      const lastReportAt = clientReports
        .map((row) => row.created_at || "")
        .filter(Boolean)
        .sort()
        .at(-1) || null

      return {
        id: client.id,
        childCode: String(client.child_code || "Kodsuz vaka").trim() || "Kodsuz vaka",
        anamnezPreview: cleanPreview(client.anamnez, 280),
        anamnezFull: String(client.anamnez || "").trim() || "Anamnez bulunmuyor.",
        createdAt: client.created_at,
        deletedAt: client.deleted_at,
        assessmentsCount: clientAssessments.filter((row) => !row.deleted_at).length,
        reportsCount: clientReports.length,
        lastAssessmentAt,
        lastReportAt,
        latestReportProfile:
          cleanPreview(
            String(
              clientReports
                .slice()
                .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0]?.snapshot_json?.profile_type || ""
            ),
            90
          ) || "Belirtilmedi",
        latestReportPreview:
          cleanPreview(
            String(
              clientReports
                .slice()
                .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0]?.report_text || ""
            ),
            220
          ) || "Rapor önizlemesi bulunmuyor.",
        linkedReports: clientReports
          .slice()
          .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
          .map((report) => ({
            id: report.id,
            createdAt: report.created_at,
            version: report.version,
            profileType:
              cleanPreview(
                String(report.snapshot_json?.profile_type || report.snapshot_json?.global_level || "Belirtilmedi"),
                90
              ) || "Belirtilmedi",
            globalLevel: String(report.snapshot_json?.global_level || "Belirtilmedi"),
            preview:
              cleanPreview(
                String(report.report_text || report.snapshot_json?.report_text || report.snapshot_json?.clinical_summary || ""),
                180
              ) || "Rapor önizlemesi bulunmuyor.",
          })),
      } satisfies OwnerClientSnapshot
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))

  const assessmentToClient = new Map(
    productionRows.assessments.map((assessment) => [assessment.id, assessment.client_id || ""])
  )

  const ownerReports = productionRows.reports
    .filter((report) => {
      const clientId = report.assessment_id ? assessmentToClient.get(report.assessment_id) : ""
      const client = clientId ? ownerIndex.clientById.get(clientId) : null
      return client?.owner_id === ownerId
    })
    .map((report) => {
      const clientId = report.assessment_id ? assessmentToClient.get(report.assessment_id) || null : null
      const client = clientId ? ownerIndex.clientById.get(clientId) : null
      const snapshot = report.snapshot_json || {}
      const previewSource =
        pickSnapshotString(snapshot, "report_text") ||
        pickSnapshotString(snapshot, "clinical_summary") ||
        report.report_text ||
        pickSnapshotString(snapshot, "profile_type")

      return {
        id: report.id,
        createdAt: report.created_at,
        version: report.version,
        assessmentId: report.assessment_id,
        clientId,
        clientCode: String(client?.child_code || pickSnapshotString(snapshot, "client_code") || "Kodsuz vaka"),
        profileType: pickSnapshotString(snapshot, "profile_type") || "Belirtilmedi",
        globalLevel: pickSnapshotString(snapshot, "global_level") || "Belirtilmedi",
        preview: cleanPreview(previewSource, 260),
      } satisfies OwnerReportSnapshot
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))

  const recentEvents = auditRows
    .filter((row) => row.member_owner_id === ownerId)
    .sort((a, b) => String(b.captured_at || "").localeCompare(String(a.captured_at || "")))
    .slice(0, 50)

  return {
    summary,
    clients: ownerClients,
    reports: ownerReports,
    recentEvents,
  } satisfies OwnerMemberDetail
}

export async function fetchOwnerMemberDetail(memberOwnerId: string) {
  const ownerId = String(memberOwnerId || "").trim()
  if (!ownerId) {
    throw new Error("Üye owner id bulunamadı.")
  }

  const bundle = await fetchOwnerDataBundle({
    ownerId,
    limit: 5000,
  })

  return buildOwnerMemberDetailFromBundle(ownerId, bundle)
}

export async function fetchOwnerDossierRows(ownerId?: string) {
  const normalizedOwnerId = String(ownerId || "").trim()

  if (normalizedOwnerId) {
    const detail = await fetchOwnerMemberDetail(normalizedOwnerId)
    return buildOwnerDossierRowsFromDetail(detail)
  }

  const bundle = await fetchOwnerDataBundle({ limit: 50000 })
  const rows: OwnerDossierRow[] = []

  for (const member of bundle.ownerIndex.memberSummaries) {
    const detail = buildOwnerMemberDetailFromBundle(member.ownerId, bundle)
    rows.push(...buildOwnerDossierRowsFromDetail(detail))
  }

  return rows
}

function buildOwnerDossierRowsFromDetail(detail: OwnerMemberDetail) {
  const rows: OwnerDossierRow[] = []

  for (const client of detail.clients) {
    if (!client.linkedReports.length) {
      rows.push({
        owner_id: detail.summary.ownerId,
        owner_email: detail.summary.email,
        owner_full_name: detail.summary.fullName,
        owner_role: detail.summary.role,
        owner_plan: detail.summary.plan,
        owner_last_activity_at: detail.summary.lastActivityAt,
        total_clients: detail.summary.totalClients,
        total_reports: detail.summary.totalReports,
        client_id: client.id,
        client_code: client.childCode,
        client_created_at: client.createdAt,
        client_deleted_at: client.deletedAt,
        client_assessments_count: client.assessmentsCount,
        client_reports_count: client.reportsCount,
        client_last_assessment_at: client.lastAssessmentAt,
        client_last_report_at: client.lastReportAt,
        anamnez_full: client.anamnezFull,
        latest_report_profile: client.latestReportProfile,
        latest_report_preview: client.latestReportPreview,
        report_id: null,
        report_created_at: null,
        report_version: null,
        report_profile_type: "",
        report_global_level: "",
        report_preview: "",
      })
      continue
    }

    for (const report of client.linkedReports) {
      rows.push({
        owner_id: detail.summary.ownerId,
        owner_email: detail.summary.email,
        owner_full_name: detail.summary.fullName,
        owner_role: detail.summary.role,
        owner_plan: detail.summary.plan,
        owner_last_activity_at: detail.summary.lastActivityAt,
        total_clients: detail.summary.totalClients,
        total_reports: detail.summary.totalReports,
        client_id: client.id,
        client_code: client.childCode,
        client_created_at: client.createdAt,
        client_deleted_at: client.deletedAt,
        client_assessments_count: client.assessmentsCount,
        client_reports_count: client.reportsCount,
        client_last_assessment_at: client.lastAssessmentAt,
        client_last_report_at: client.lastReportAt,
        anamnez_full: client.anamnezFull,
        latest_report_profile: client.latestReportProfile,
        latest_report_preview: client.latestReportPreview,
        report_id: report.id,
        report_created_at: report.createdAt,
        report_version: report.version,
        report_profile_type: report.profileType,
        report_global_level: report.globalLevel,
        report_preview: report.preview,
      })
    }
  }

  return rows
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
  const candidates = [
    payload.child_code,
    payload.client_code,
    payload.code,
    payload.title,
    payload.client_name,
    payload.name,
    row.record_pk,
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
