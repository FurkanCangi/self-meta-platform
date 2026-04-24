import Link from "next/link"
import { notFound } from "next/navigation"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import {
  fetchOwnerMemberSummaries,
  isOwnerAuditConfigured,
  type OwnerMemberSummary,
} from "@/lib/owner/ownerAudit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function pickQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || ""
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

function buildExportHref(format: "csv" | "json", kind: "raw" | "dossier") {
  const params = new URLSearchParams()
  params.set("format", format)
  params.set("kind", kind)
  return `/api/owner-audit/export?${params.toString()}`
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}>{label}</div>
      <div className="mt-3 text-3xl font-semibold text-slate-900">{value}</div>
    </div>
  )
}

function MemberRow({ row }: { row: OwnerMemberSummary }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {row.plan}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {row.role}
            </span>
            {row.deleteEvents > 0 ? (
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
                {row.deleteEvents} silme olayi
              </span>
            ) : null}
          </div>

          <div className="mt-3 text-2xl font-semibold text-slate-950">{row.fullName}</div>
          <div className="mt-1 text-sm text-slate-500">{row.email}</div>
          <div className="mt-3 text-xs text-slate-400">Owner ID: {row.ownerId}</div>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <div>
              Son vaka: <span className="font-semibold text-slate-900">{row.latestClientCode || "-"}</span>
            </div>
            <div>
              Son rapor: <span className="font-semibold text-slate-900">{row.latestReportProfile || "-"}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vakalar</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">{row.totalClients}</div>
            <div className="mt-1 text-xs text-slate-500">Arsiv: {row.archivedClients}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Degerlendirme</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">{row.totalAssessments}</div>
            <div className="mt-1 text-xs text-slate-500">Aktif sayi</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rapor</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">{row.totalReports}</div>
            <div className="mt-1 text-xs text-slate-500">Olusan toplam</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Son Aktivite</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {formatDateTime(row.lastActivityAt)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {row.totalEvents} event / son rapor {formatDateTime(row.latestReportAt)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/owner-audit/${row.ownerId}`}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Uye alanina gir
        </Link>
      </div>
    </div>
  )
}

export default async function OwnerAuditPage({
  searchParams,
}: {
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

  const params = await searchParams
  const q = pickQueryValue(params.q)

  let rows: OwnerMemberSummary[] = []
  let loadError = ""

  if (isOwnerAuditConfigured()) {
    try {
      rows = await fetchOwnerMemberSummaries(q)
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Uye verileri yuklenemedi."
    }
  } else {
    loadError =
      "Owner audit altyapisi aktif gorunmuyor. Supabase service role, owner allowlist ve audit SQL katmanini tekrar kontrol etmemiz gerekiyor."
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.members += 1
      acc.clients += row.totalClients
      acc.reports += row.totalReports
      acc.deletes += row.deleteEvents
      return acc
    },
    { members: 0, clients: 0, reports: 0, deletes: 0 }
  )

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-500">
            Owner Audit
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
            Owner Uye Verileri
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Uyelere alt alta inebilecegin, her uyenin vakalarini, raporlarini ve audit izlerini gorebilecegin owner paneli.
            Ham event log ana ekran degil; detay sayfasinda duracak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={buildExportHref("csv", "dossier")}
            className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            Uye dossier CSV
          </Link>
          <Link
            href={buildExportHref("json", "dossier")}
            className="rounded-2xl border border-indigo-100 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
          >
            Uye dossier JSON
          </Link>
          <Link
            href={buildExportHref("csv", "raw")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ham audit CSV
          </Link>
          <Link
            href={buildExportHref("json", "raw")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ham audit JSON
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Toplam Uye" value={totals.members} accent="text-slate-500" />
        <StatCard label="Toplam Vaka" value={totals.clients} accent="text-emerald-600" />
        <StatCard label="Toplam Rapor" value={totals.reports} accent="text-indigo-600" />
        <StatCard label="Silme Event" value={totals.deletes} accent="text-rose-600" />
      </div>

      <form className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="grid flex-1 gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Uye ara</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Ad, e-posta, owner id, plan"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ara
            </button>
            <Link
              href="/owner-audit"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Sifirla
            </Link>
          </div>
        </div>
      </form>

      {loadError ? (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4">
        {rows.length ? (
          rows.map((row) => <MemberRow key={row.ownerId} row={row} />)
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            Gosterilecek uye bulunamadi.
          </div>
        )}
      </div>
    </div>
  )
}
