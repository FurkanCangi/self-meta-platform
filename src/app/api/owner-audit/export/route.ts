import { NextResponse } from "next/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { fetchOwnerAuditEvents, fetchOwnerDossierRows } from "@/lib/owner/ownerAudit"
import { evaluateAccountRisk, recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import { getPrivacyAuditContext, recordDataAccessAuditEvent } from "@/lib/security/privacyOps"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
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
  const raw = String(value ?? "")
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
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

    const rateLimit = await checkRateLimit({
      key: `owner-audit-export:${user.id}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.ok) {
      await recordAccountSecurityEvent({
        userId: user.id,
        eventType: "api_rate_limited",
        metadata: { route: "/api/owner-audit/export" },
      })
      await evaluateAccountRisk(user.id)
      return rateLimitResponse(rateLimit.resetAt)
    }

    const url = new URL(req.url)
    const sourceTable = String(url.searchParams.get("table") || "").trim()
    const operation = String(url.searchParams.get("operation") || "").trim()
    const format = String(url.searchParams.get("format") || "csv").trim().toLowerCase()
    const kind = String(url.searchParams.get("kind") || "raw").trim().toLowerCase()
    const ownerId = String(url.searchParams.get("owner_id") || "").trim()
    const from = String(url.searchParams.get("from") || "").trim()
    const to = String(url.searchParams.get("to") || "").trim()
    const limit = Math.max(1, Math.min(50000, Number(url.searchParams.get("limit") || 5000)))
    const admin = createSupabaseAdminClient()
    const auditContext = await getPrivacyAuditContext()

    if (kind === "dossier") {
      const rows = await fetchOwnerDossierRows(ownerId)
      await recordDataAccessAuditEvent({
        admin,
        actorUserId: user.id,
        subjectUserId: ownerId || null,
        action: "owner_audit_export",
        resourceType: "owner_dossier",
        resourceId: ownerId || "all-members",
        legalBasis: "security_audit_and_legal_obligation",
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: { format, count: rows.length },
      })

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

    const rows = await fetchOwnerAuditEvents({
      sourceTable,
      ownerId,
      operation,
      from,
      to,
      limit,
    })
    await recordDataAccessAuditEvent({
      admin,
      actorUserId: user.id,
      subjectUserId: ownerId || null,
      action: "owner_audit_export",
      resourceType: "owner_audit_raw",
      resourceId: sourceTable || "all",
      legalBasis: "security_audit_and_legal_obligation",
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { format, source_table: sourceTable || null, operation: operation || null, count: rows.length },
    })

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
  } catch {
    return NextResponse.json({ ok: false, error: "owner_audit_export_failed" }, { status: 403 })
  }
}
