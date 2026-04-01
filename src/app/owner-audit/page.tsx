import Link from "next/link"
import { notFound } from "next/navigation"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import {
  fetchOwnerAuditEvents,
  getOwnerAuditPreview,
  getOwnerAuditRecordLabel,
  isOwnerAuditConfigured,
  summarizeOwnerAuditEvents,
  type OwnerAuditEventRow,
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

function buildExportHref(
  format: "csv" | "json",
  filters: Record<string, string>
) {
  const params = new URLSearchParams()
  params.set("format", format)

  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }

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

function EventRow({ row }: { row: OwnerAuditEventRow }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
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
            {row.deleted_visible ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                Silinmiş görünür kayıt
              </span>
            ) : null}
          </div>

          <div className="mt-3 text-lg font-semibold text-slate-900">
            {getOwnerAuditRecordLabel(row)}
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            {getOwnerAuditPreview(row)}
          </div>
        </div>

        <div className="grid shrink-0 gap-2 text-sm text-slate-500 md:text-right">
          <div>
            <div className="font-medium text-slate-700">Yakalanma Zamanı</div>
            <div>{formatDateTime(row.captured_at)}</div>
          </div>
          <div>
            <div className="font-medium text-slate-700">Üye Owner ID</div>
            <div>{row.member_owner_id || "-"}</div>
          </div>
          <div>
            <div className="font-medium text-slate-700">Record PK</div>
            <div className="break-all">{JSON.stringify(row.record_pk || {})}</div>
          </div>
        </div>
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
  const sourceTable = pickQueryValue(params.table)
  const operation = pickQueryValue(params.operation)
  const ownerId = pickQueryValue(params.owner_id)
  const from = pickQueryValue(params.from)
  const to = pickQueryValue(params.to)
  const limit = pickQueryValue(params.limit) || "250"

  const filters = {
    table: sourceTable,
    operation,
    owner_id: ownerId,
    from,
    to,
    limit,
  }

  let rows: OwnerAuditEventRow[] = []
  let loadError = ""

  if (isOwnerAuditConfigured()) {
    try {
      rows = await fetchOwnerAuditEvents({
        sourceTable,
        operation,
        ownerId,
        from,
        to,
        limit: Number(limit || 250),
      })
    } catch (error) {
      loadError = error instanceof Error ? error.message : "Owner audit verileri yüklenemedi."
    }
  } else {
    loadError =
      "Owner audit altyapısı henüz aktif değil. SUPABASE_SERVICE_ROLE_KEY ve OWNER_AUDIT_EMAILS tanımlandıktan sonra bu panel verileri göstermeye başlayacak."
  }

  const summary = summarizeOwnerAuditEvents(rows)
  const csvHref = buildExportHref("csv", filters)
  const jsonHref = buildExportHref("json", filters)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-500">
            Owner Audit
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
            Owner Veri Kasası
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Bu ekran yalnız owner allowlist hesabında görünür. Üyelerin oluşturduğu, güncellediği
            veya sildiği `clients`, `assessments_v2` ve `reports` kayıtlarının denetim izi burada
            toplanır.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={csvHref}
            className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            CSV / Excel Al
          </Link>
          <Link
            href={jsonHref}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            JSON Al
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Toplam Event" value={summary.total} accent="text-slate-500" />
        <StatCard label="Benzersiz Üye" value={summary.uniqueMembers} accent="text-emerald-600" />
        <StatCard label="Clients Event" value={summary.tables.clients || 0} accent="text-indigo-600" />
        <StatCard label="Delete Event" value={summary.operations.DELETE || 0} accent="text-rose-600" />
      </div>

      <form className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-6">
          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Tablo</span>
            <select
              name="table"
              defaultValue={sourceTable}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tümü</option>
              <option value="clients">clients</option>
              <option value="assessments_v2">assessments_v2</option>
              <option value="reports">reports</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">İşlem</span>
            <select
              name="operation"
              defaultValue={operation}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Tümü</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Üye Owner ID</span>
            <input
              name="owner_id"
              defaultValue={ownerId}
              placeholder="uuid"
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Başlangıç</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Bitiş</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Limit</span>
            <input
              type="number"
              min={1}
              max={50000}
              name="limit"
              defaultValue={limit}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Filtreyi Uygula
          </button>
          <Link
            href="/owner-audit"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Sıfırla
          </Link>
        </div>
      </form>

      {loadError ? (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-900">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-4">
        {rows.length ? (
          rows.map((row) => <EventRow key={row.id} row={row} />)
        ) : (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            Seçili filtrelerde gösterilecek audit event bulunamadı.
          </div>
        )}
      </div>
    </div>
  )
}
