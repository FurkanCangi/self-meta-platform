import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { mapDirectoryRow, type TherapistDirectoryProfile } from "@/lib/therapists/directory"

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
  hasAuthAccount: boolean
  accountCreatedAt: string | null
  lastSignInAt: string | null
  accountDeletedAt: string | null
  directoryStatus: string
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

export type OwnerMemberSummaryGroups = {
  visible: OwnerMemberSummary[]
  hidden: OwnerMemberSummary[]
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
  account: OwnerMemberAccountDetail
  appProfile: OwnerMemberAppProfile | null
  directoryProfile: TherapistDirectoryProfile | null
  clients: OwnerClientSnapshot[]
  reports: OwnerReportSnapshot[]
  recentEvents: OwnerAuditEventRow[]
}

export type OwnerMemberAccountDetail = {
  userId: string
  email: string
  fullName: string
  phone: string
  createdAt: string | null
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  provider: string
  hasAuthAccount: boolean
}

export type OwnerMemberAppProfile = {
  userId: string
  role: string
  plan: string
  createdAt: string | null
  updatedAt: string | null
  fullName: string
  raw: Record<string, unknown>
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

  const { data, error } = await admin.rpc("owner_audit_read_events", {
    p_source_table: filters.sourceTable || null,
    p_owner_id: filters.ownerId || null,
    p_operation: filters.operation || null,
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_limit: limit,
  })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as OwnerAuditEventRow[]
}

type AuthUserRow = {
  id: string
  email: string
  fullName: string
  phone: string
  createdAt: string | null
  lastSignInAt: string | null
  emailConfirmedAt: string | null
  provider: string
}

type ProfileRow = Record<string, unknown> & {
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

type AccountSecurityEventRow = {
  id: string
  user_id: string | null
  event_type: string | null
  created_at: string | null
  metadata: Record<string, unknown> | null
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
        phone: String(user.phone || "").trim(),
        createdAt: user.created_at || null,
        lastSignInAt: user.last_sign_in_at || null,
        emailConfirmedAt: user.email_confirmed_at || null,
        provider: String(
          user.app_metadata?.provider ||
            (Array.isArray(user.identities) ? user.identities[0]?.provider : "") ||
            "email"
        ),
      })
    }

    if (users.length < 1000) break
    page += 1
  }

  return authUsers
}

async function fetchProfiles() {
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.from("profiles").select("*")

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as ProfileRow[]
}

async function fetchOwnerProductionRows() {
  const admin = createSupabaseAdminClient()

  const [
    { data: clients, error: clientsError },
    { data: assessments, error: assessmentsError },
    { data: reports, error: reportsError },
    { data: directoryProfiles, error: directoryProfilesError },
    { data: securityEvents, error: securityEventsError },
  ] =
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
      admin
        .from("therapist_directory_profiles")
        .select(
          "user_id, first_name, last_name, profession, title, workplace, city, district, public_phone, public_email, short_address, specialties, education_completed_at, public_listing_enabled, publication_status, updated_at"
        ),
      admin
        .from("account_security_events")
        .select("id, user_id, event_type, created_at, metadata")
        .in("event_type", ["owner_member_deleted", "owner_member_panel_hidden", "owner_member_panel_restored"])
        .order("created_at", { ascending: false })
        .limit(5000),
    ])

  if (clientsError) throw new Error(clientsError.message)
  if (assessmentsError) throw new Error(assessmentsError.message)
  if (reportsError) throw new Error(reportsError.message)
  if (directoryProfilesError) throw new Error(directoryProfilesError.message)
  if (securityEventsError) throw new Error(securityEventsError.message)

  return {
    clients: (clients || []) as ClientRow[],
    assessments: (assessments || []) as AssessmentRow[],
    reports: (reports || []) as ReportRow[],
    directoryProfiles: (directoryProfiles || []).map(mapDirectoryRow),
    securityEvents: (securityEvents || []) as AccountSecurityEventRow[],
  }
}

function buildOwnerIndex(
  authUsers: AuthUserRow[],
  profiles: ProfileRow[],
  directoryProfiles: TherapistDirectoryProfile[],
  clients: ClientRow[],
  assessments: AssessmentRow[],
  reports: ReportRow[],
  auditRows: OwnerAuditEventRow[],
  securityEvents: AccountSecurityEventRow[]
) {
  const authById = new Map(authUsers.map((row) => [row.id, row]))
  const profileByUserId = new Map(profiles.map((row) => [row.user_id, row]))
  const directoryByUserId = new Map(directoryProfiles.map((row) => [row.userId, row]))
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
  for (const directoryProfile of directoryProfiles) candidateOwnerIds.add(directoryProfile.userId)
  for (const client of clients) if (client.owner_id) candidateOwnerIds.add(client.owner_id)
  for (const row of auditRows) if (row.member_owner_id) candidateOwnerIds.add(row.member_owner_id)

  const deletedMemberByUserId = new Map<string, AccountSecurityEventRow>()
  for (const row of securityEvents) {
    if (!row.user_id || row.event_type !== "owner_member_deleted") continue
    const existing = deletedMemberByUserId.get(row.user_id)
    if (!existing || String(row.created_at || "") > String(existing.created_at || "")) {
      deletedMemberByUserId.set(row.user_id, row)
    }
  }

  const memberSummaries: OwnerMemberSummary[] = []

  for (const ownerId of candidateOwnerIds) {
    const authUser = authById.get(ownerId)
    const profile = profileByUserId.get(ownerId)
    const directoryProfile = directoryByUserId.get(ownerId)
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

    if (!authUser && !profile && !directoryProfile) {
      continue
    }

    memberSummaries.push({
      ownerId,
      email: authUser?.email || directoryProfile?.publicEmail || "E-posta yok",
      fullName:
        authUser?.fullName ||
        [directoryProfile?.firstName, directoryProfile?.lastName].filter(Boolean).join(" ").trim() ||
        "İsimsiz üye",
      role: String(profile?.role || "expert"),
      plan: String(profile?.plan || "none"),
      hasAuthAccount: Boolean(authUser),
      accountCreatedAt: authUser?.createdAt || null,
      lastSignInAt: authUser?.lastSignInAt || null,
      accountDeletedAt: deletedMemberByUserId.get(ownerId)?.created_at || null,
      directoryStatus: directoryProfile?.publicationStatus || "not_created",
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
    directoryByUserId,
    clientById,
    assessmentsByClientId,
    reportsByAssessmentId,
    memberSummaries,
  }
}

function latestEventTime(events: AccountSecurityEventRow[], userId: string, eventType: string) {
  return events
    .filter((row) => row.user_id === userId && row.event_type === eventType)
    .reduce((latest, row) => Math.max(latest, new Date(row.created_at || "").getTime() || 0), 0)
}

function filterOwnerMemberSummaries(rows: OwnerMemberSummary[], search = "") {
  const q = String(search || "").trim().toLowerCase()
  if (!q) return rows

  return rows.filter((row) =>
    [row.fullName, row.email, row.ownerId, row.plan, row.role]
      .map((value) => String(value || "").toLowerCase())
      .some((value) => value.includes(q))
  )
}

export async function fetchOwnerMemberSummaryGroups(search = ""): Promise<OwnerMemberSummaryGroups> {
  const [authUsers, profiles, productionRows, auditRows] = await Promise.all([
    fetchAuthUsers(),
    fetchProfiles(),
    fetchOwnerProductionRows(),
    fetchOwnerAuditEvents({ limit: 50000 }),
  ])

  const { memberSummaries } = buildOwnerIndex(
    authUsers,
    profiles,
    productionRows.directoryProfiles,
    productionRows.clients,
    productionRows.assessments,
    productionRows.reports,
    auditRows,
    productionRows.securityEvents
  )

  const hiddenUserIds = new Set<string>()
  for (const row of memberSummaries) {
    const latestHiddenAt = latestEventTime(productionRows.securityEvents, row.ownerId, "owner_member_panel_hidden")
    const latestRestoredAt = latestEventTime(productionRows.securityEvents, row.ownerId, "owner_member_panel_restored")
    if (latestHiddenAt > 0 && latestHiddenAt > latestRestoredAt) {
      hiddenUserIds.add(row.ownerId)
    }
  }

  return {
    visible: filterOwnerMemberSummaries(memberSummaries.filter((row) => !hiddenUserIds.has(row.ownerId)), search),
    hidden: filterOwnerMemberSummaries(memberSummaries.filter((row) => hiddenUserIds.has(row.ownerId)), search),
  }
}

export async function fetchOwnerMemberSummaries(search = "") {
  const groups = await fetchOwnerMemberSummaryGroups(search)
  return groups.visible
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
    productionRows.directoryProfiles,
    productionRows.clients,
    productionRows.assessments,
    productionRows.reports,
    auditRows,
    productionRows.securityEvents
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
  const authUser = ownerIndex.authById.get(ownerId)
  const profile = ownerIndex.profileByUserId.get(ownerId)
  const directoryProfile = ownerIndex.directoryByUserId.get(ownerId) || null

  const account: OwnerMemberAccountDetail = {
    userId: ownerId,
    email: authUser?.email || summary.email,
    fullName: authUser?.fullName || summary.fullName,
    phone: authUser?.phone || "",
    createdAt: authUser?.createdAt || null,
    lastSignInAt: authUser?.lastSignInAt || null,
    emailConfirmedAt: authUser?.emailConfirmedAt || null,
    provider: authUser?.provider || "Hesap bulunamadı",
    hasAuthAccount: Boolean(authUser),
  }

  const appProfile: OwnerMemberAppProfile | null = profile
    ? {
        userId: ownerId,
        role: String(profile.role || ""),
        plan: String(profile.plan || ""),
        createdAt: typeof profile.created_at === "string" ? profile.created_at : null,
        updatedAt: typeof profile.updated_at === "string" ? profile.updated_at : null,
        fullName: String(profile.full_name || profile.name || "").trim(),
        raw: profile,
      }
    : null

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
    account,
    appProfile,
    directoryProfile,
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
