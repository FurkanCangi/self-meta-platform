import Link from "next/link"
import { notFound } from "next/navigation"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import {
  fetchOwnerMemberDetail,
  getOwnerAuditPreview,
  getOwnerAuditRecordLabel,
  type OwnerAuditEventRow,
} from "@/lib/owner/ownerAudit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type Params = Promise<{ memberOwnerId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

type DetailTab = "clients" | "reports" | "audit"

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || ""
}

function resolveTab(value: string): DetailTab {
  if (value === "reports") return "reports"
  if (value === "audit") return "audit"
  return "clients"
}

function getTabHref(memberOwnerId: string, tab: DetailTab) {
  return `/owner-audit/${encodeURIComponent(memberOwnerId)}?tab=${tab}`
}

function getExportHref(
  memberOwnerId: string,
  kind: "raw" | "dossier",
  format: "csv" | "json"
) {
  const params = new URLSearchParams()
  params.set("kind", kind)
  params.set("format", format)
  params.set("owner_id", memberOwnerId)
  return `/api/owner-audit/export?${params.toString()}`
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function InfoCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function AuditEventCard({ row }: { row: OwnerAuditEventRow }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {row.source_table}
        </span>
        <span
          className={[
            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
            row.operation === "DELETE"
              ? "bg-rose-50 text-rose-700"
              : row.operation === "UPDATE"
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          {row.operation}
        </span>
      </div>

      <div className="mt-3 text-lg font-semibold text-slate-900">{getOwnerAuditRecordLabel(row)}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{getOwnerAuditPreview(row)}</div>
      <div className="mt-3 text-xs text-slate-400">{formatDateTime(row.captured_at)}</div>
    </div>
  )
}

export default async function OwnerMemberDetailPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    assertOwnerAuditAccess(user?.email)
  } catch {
    notFound()
  }

  const resolvedParams = await params
  const memberOwnerId = decodeURIComponent(resolvedParams.memberOwnerId || "")
  const resolvedSearchParams = await searchParams
  const activeTab = resolveTab(pickQueryValue(resolvedSearchParams.tab))

  let detail
  try {
    detail = await fetchOwnerMemberDetail(memberOwnerId)
  } catch {
    notFound()
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/owner-audit" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Owner uyeleri
          </Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            {detail.summary.fullName}
          </h1>
          <div className="mt-2 text-sm text-slate-500">{detail.summary.email}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold uppercase tracking-wide text-slate-600">
              {detail.summary.plan}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold uppercase tracking-wide text-emerald-700">
              {detail.summary.role}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold tracking-wide text-slate-500">
              Owner ID: {detail.summary.ownerId}
            </span>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          Son aktivite: <span className="font-semibold text-slate-900">{formatDateTime(detail.summary.lastActivityAt)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <Link
          href={getExportHref(memberOwnerId, "dossier", "csv")}
          className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
        >
          Bu uyeyi CSV al
        </Link>
        <Link
          href={getExportHref(memberOwnerId, "dossier", "json")}
          className="rounded-2xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
        >
          Bu uyeyi JSON al
        </Link>
        <Link
          href={getExportHref(memberOwnerId, "raw", "csv")}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Ham audit CSV
        </Link>
        <Link
          href={getExportHref(memberOwnerId, "raw", "json")}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Ham audit JSON
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <InfoCard label="Aktif Vaka" value={detail.summary.totalClients} />
        <InfoCard label="Arsiv Vaka" value={detail.summary.archivedClients} />
        <InfoCard label="Degerlendirme" value={detail.summary.totalAssessments} />
        <InfoCard label="Rapor" value={detail.summary.totalReports} />
        <InfoCard label="Delete Event" value={detail.summary.deleteEvents} />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
        <Link
          href={getTabHref(memberOwnerId, "clients")}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            activeTab === "clients"
              ? "bg-slate-950 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          ].join(" ")}
        >
          Vakalar ({detail.clients.length})
        </Link>
        <Link
          href={getTabHref(memberOwnerId, "reports")}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            activeTab === "reports"
              ? "bg-slate-950 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          ].join(" ")}
        >
          Raporlar ({detail.reports.length})
        </Link>
        <Link
          href={getTabHref(memberOwnerId, "audit")}
          className={[
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            activeTab === "audit"
              ? "bg-slate-950 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
          ].join(" ")}
        >
          Audit Izleri ({detail.recentEvents.length})
        </Link>
      </div>

      {activeTab === "clients" ? (
        <section id="vakalar" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Vakalar</h2>
              <p className="mt-2 text-sm text-slate-500">
                Uyenin kaydettigi tum vakalar, anamnez ozetleri ve uretim sayilari.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {detail.clients.length ? (
              detail.clients.map((client) => (
                <div key={client.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {client.childCode}
                        </span>
                        {client.deletedAt ? (
                          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
                            Arsivlenmis / silinmis
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 text-sm leading-7 text-slate-600">{client.anamnezPreview}</div>

                      <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                          Vakanin tum anamnez bilgilerini ac
                        </summary>
                        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                          {client.anamnezFull}
                        </div>
                      </details>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Son rapor ozeti
                        </div>
                        <div className="mt-2 text-base font-semibold text-slate-900">
                          {client.latestReportProfile}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">
                          {client.latestReportPreview}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-500 lg:text-right">
                      <div>Olusturma: {formatDateTime(client.createdAt)}</div>
                      <div>Degerlendirme: {client.assessmentsCount}</div>
                      <div>Son degerlendirme: {formatDateTime(client.lastAssessmentAt)}</div>
                      <div>Rapor: {client.reportsCount}</div>
                      <div>Son rapor: {formatDateTime(client.lastReportAt)}</div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Bu vakaya ait raporlar
                    </div>

                    <div className="mt-4 grid gap-3">
                      {client.linkedReports.length ? (
                        client.linkedReports.map((report) => (
                          <div key={report.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    v{report.version ?? "?"}
                                  </span>
                                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                                    {report.globalLevel}
                                  </span>
                                </div>
                                <div className="mt-3 text-base font-semibold text-slate-900">
                                  {report.profileType}
                                </div>
                                <div className="mt-2 text-sm leading-6 text-slate-600">
                                  {report.preview}
                                </div>
                              </div>

                              <div className="text-sm text-slate-500 lg:text-right">
                                <div>Rapor tarihi: {formatDateTime(report.createdAt)}</div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                          Bu vakaya ait rapor bulunmadi.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Bu uye icin gosterilecek vaka bulunmadi.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "reports" ? (
        <section id="raporlar" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">Raporlar</h2>
          <p className="mt-2 text-sm text-slate-500">
            Uyenin urettigi raporlar, profil tipi ve onizleme metniyle birlikte.
          </p>

          <div className="mt-6 grid gap-4">
            {detail.reports.length ? (
              detail.reports.map((report) => (
                <div key={report.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {report.clientCode}
                        </span>
                        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                          {report.globalLevel}
                        </span>
                      </div>
                      <div className="mt-3 text-lg font-semibold text-slate-900">{report.profileType}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{report.preview}</div>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-500 lg:text-right">
                      <div>Rapor tarihi: {formatDateTime(report.createdAt)}</div>
                      <div>Versiyon: {report.version ?? "-"}</div>
                      <div>Assessment ID: {report.assessmentId || "-"}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Bu uye icin gosterilecek rapor bulunmadi.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "audit" ? (
        <section id="audit" className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-950">Son Audit Izleri</h2>
          <p className="mt-2 text-sm text-slate-500">
            Ham event listesi artik burada. Ana owner ekrani uye merkezli; teknik audit izi ise bu alt sekmede duruyor.
          </p>

          <div className="mt-6 grid gap-4">
            {detail.recentEvents.length ? (
              detail.recentEvents.map((row) => <AuditEventCard key={row.id} row={row} />)
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
                Bu uye icin audit izi bulunmadi.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
