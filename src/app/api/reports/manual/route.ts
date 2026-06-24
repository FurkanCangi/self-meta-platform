import { NextResponse } from "next/server"
import { z } from "zod"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { consumeReportCredit, grantReportCredits } from "@/lib/security/reportCredits"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

const manualReportSchema = z
  .object({
    assessmentId: z.string().uuid(),
    clientId: z.string().uuid(),
    clientCode: z.string().max(120).optional().nullable(),
    scores: z.object({
      s1: z.coerce.number().min(0).max(50),
      s2: z.coerce.number().min(0).max(50),
      s3: z.coerce.number().min(0).max(50),
      s4: z.coerce.number().min(0).max(50),
    }),
  })
  .passthrough()

function calcRisk(total: number) {
  if (total >= 12) return "Yüksek"
  if (total >= 8) return "Orta"
  if (total >= 4) return "Düşük"
  return "İzlem"
}

function buildManualReportText(params: {
  clientCode?: string | null
  scores: { s1: number; s2: number; s3: number; s4: number }
  total: number
  risk: string
}) {
  return [
    `Danışan: ${params.clientCode || "—"}`,
    "",
    "Alt Boyutlar",
    `1: ${params.scores.s1}`,
    `2: ${params.scores.s2}`,
    `3: ${params.scores.s3}`,
    `4: ${params.scores.s4}`,
    "",
    `Toplam Skor: ${params.total}`,
    `Risk Seviyesi: ${params.risk}`,
  ].join("\n")
}

export async function POST(request: Request) {
  const originError = await requireTrustedMutation(request)
  if (originError) return originError

  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response

  const rateLimit = await checkRateLimit({
    key: `manual-report:${auth.user.id}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsedBody = await readJsonWithSchema(request, manualReportSchema)
  if (!parsedBody.ok) return parsedBody.response
  const body = parsedBody.data

  const payloadGuard = rejectServerControlledFields(body)
  if (!payloadGuard.ok) {
    return NextResponse.json(
      { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
      { status: 400 }
    )
  }

  const admin = createSupabaseAdminClient()
  const { data: assessment, error: assessmentError } = await admin
    .from("assessments_v2")
    .select("id, client_id")
    .eq("id", body.assessmentId)
    .eq("client_id", body.clientId)
    .is("deleted_at", null)
    .maybeSingle()

  if (assessmentError || !assessment?.id) {
    return NextResponse.json({ ok: false, error: "assessment_not_found" }, { status: 404 })
  }

  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("id, child_code")
    .eq("id", body.clientId)
    .eq("owner_id", auth.user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (clientError || !client?.id) {
    return NextResponse.json({ ok: false, error: "client_not_found" }, { status: 403 })
  }

  const { data: existingReport, error: existingError } = await admin
    .from("reports")
    .select("id, report_text, created_at")
    .eq("assessment_id", body.assessmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ ok: false, error: "report_lookup_failed" }, { status: 500 })
  }

  if (existingReport?.id) {
    return NextResponse.json({
      ok: true,
      existing: true,
      report: existingReport,
    })
  }

  const scores = body.scores
  const total = scores.s1 + scores.s2 + scores.s3 + scores.s4
  const risk = calcRisk(total)
  const reportText = buildManualReportText({
    clientCode: body.clientCode || client.child_code,
    scores,
    total,
    risk,
  })

  const credit = await consumeReportCredit({
    admin,
    userId: auth.user.id,
    userEmail: auth.user.email,
    assessmentId: body.assessmentId,
    clientId: body.clientId,
    metadata: {
      route: "/api/reports/manual",
      client_code: String(body.clientCode || client.child_code || ""),
      charged_on_report_create: true,
    },
  })

  if (!credit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: credit.error === "report_credit_required" ? "report_credit_required" : "Rapor hakkı doğrulanamadı.",
        remaining: credit.remaining,
      },
      { status: credit.error === "report_credit_required" ? 402 : 500 }
    )
  }

  const { data: insertedReport, error: insertError } = await admin
    .from("reports")
    .insert({
      assessment_id: body.assessmentId,
      version: 1,
      report_text: reportText,
      immutable: true,
      snapshot_json: {
        scores,
        total,
        risk,
      },
    })
    .select("id, report_text, created_at")
    .single()

  if (insertError) {
    await grantReportCredits({
      admin,
      userId: auth.user.id,
      delta: 1,
      reason: "adjustment",
      source: "system",
      metadata: {
        route: "/api/reports/manual",
        rollback_reason: "manual_report_insert_failed",
        assessment_id: body.assessmentId,
      },
    })
    return NextResponse.json({ ok: false, error: "manual_report_create_failed" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    existing: false,
    report: insertedReport,
    remainingReportCredits: credit.remaining,
  })
}
