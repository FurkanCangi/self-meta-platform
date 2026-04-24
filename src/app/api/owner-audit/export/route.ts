import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { fetchOwnerDossierRows } from "@/lib/owner/ownerAudit"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function flattenObject(
  input: Record<string, unknown>,
  prefix = "",
  out: Record<string, string> = {}
): Record<string, string> {
  for (const [rawKey, value] of Object.entries(input || {})) {
    const key = prefix ? `${prefix}.${rawKey}` : rawKey

    if (value == null) {
      out[key] = ""
      continue
    }

    if (Array.isArray(value)) {
      out[key] = JSON.stringify(value)
      continue
    }

    if (typeof value === "object") {
      flattenObject(value as Record<string, unknown>, key, out)
      continue
    }

    out[key] = String(value)
  }

  return out
}

function escapeCsv(value: string) {
  const safe = String(value ?? "")
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, "\"\"")}"`
  }
  return safe
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return ""

  const flattened = rows.map((row) => flattenObject(row as Record<string, unknown>))
  const headers = Array.from(
    new Set(flattened.flatMap((row) => Object.keys(row)))
  ).sort((a, b) => a.localeCompare(b, "tr"))

  const lines = [
    headers.join(","),
    ...flattened.map((row) => headers.map((header) => escapeCsv(row[header] || "")).join(",")),
  ]

  return lines.join("\n")
}

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user?.email) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    assertOwnerAuditAccess(user.email)

    const url = new URL(req.url)
    const sourceTable = String(url.searchParams.get("table") || "").trim()
    const operation = String(url.searchParams.get("operation") || "").trim()
    const format = String(url.searchParams.get("format") || "csv").trim().toLowerCase()
    const kind = String(url.searchParams.get("kind") || "raw").trim().toLowerCase()
    const ownerId = String(url.searchParams.get("owner_id") || "").trim()
    const from = String(url.searchParams.get("from") || "").trim()
    const to = String(url.searchParams.get("to") || "").trim()
    const limit = Math.max(1, Math.min(50000, Number(url.searchParams.get("limit") || 5000)))

    if (kind === "dossier") {
      const rows = await fetchOwnerDossierRows(ownerId)

      if (format === "json") {
        return NextResponse.json({
          ok: true,
          kind: "dossier",
          count: rows.length,
          rows,
        })
      }

      const csv = toCsv(rows)
      const filenameParts = ["owner-dossier", ownerId || "all-members", new Date().toISOString().slice(0, 10)]
      const filename = `${filenameParts.join("-")}.csv`

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    const admin = createSupabaseAdminClient()
    let query = admin
      .schema("owner_audit")
      .from("audit_events")
      .select("id, captured_at, source_table, operation, actor_owner_id, member_owner_id, record_pk, payload, changed_fields")
      .order("captured_at", { ascending: false })
      .limit(limit)

    if (sourceTable) query = query.eq("source_table", sourceTable)
    if (operation) query = query.eq("operation", operation)
    if (ownerId) query = query.eq("member_owner_id", ownerId)
    if (from) query = query.gte("captured_at", from)
    if (to) query = query.lte("captured_at", to)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const rows = data || []

    if (format === "json") {
      return NextResponse.json({
        ok: true,
        kind: "raw",
        count: rows.length,
        rows,
      })
    }

    const csv = toCsv(rows)
    const filenameParts = ["owner-audit-raw", sourceTable || "all", new Date().toISOString().slice(0, 10)]
    const filename = `${filenameParts.join("-")}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Owner audit export başarısız oldu."
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
}
