async function checkExistingDnaReportLock(supabase: any, payload: any) {
  const clientCode = String(
    payload?.client_code ??
    payload?.clientCode ??
    payload?.client?.code ??
    payload?.client?.client_code ??
    payload?.client?.id ??
    payload?.client_id ??
    payload?.clientId ??
    ""
  ).trim()

  if (!clientCode) {
    return { locked: false, existing: null }
  }

  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userRes?.user?.id) {
    return { locked: false, existing: null }
  }

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_id", userRes.user.id)
    .eq("child_code", clientCode)
    .is("deleted_at", null)
    .maybeSingle()

  if (clientError || !clientRow?.id) {
    return { locked: false, existing: null }
  }

  const { data: assessments, error: assessmentsError } = await supabase
    .from("assessments_v2")
    .select("id")
    .eq("client_id", clientRow.id)
    .is("deleted_at", null)

  if (assessmentsError || !assessments || assessments.length === 0) {
    return { locked: false, existing: null }
  }

  const assessmentIds = assessments.map((row: any) => row.id).filter(Boolean)
  if (assessmentIds.length === 0) {
    return { locked: false, existing: null }
  }

  const { data, error } = await supabase
    .from("reports")
    .select("id, report_text, created_at, assessment_id")
    .in("assessment_id", assessmentIds)
    .not("report_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    return { locked: false, existing: null }
  }

  if (data && data.length > 0) {
    return { locked: true, existing: data[0] }
  }

  return { locked: false, existing: null }
}

async function assertOwnedDnaClient(supabase: any, userId: string, payload: any) {
  const clientCode = String(
    payload?.client_code ??
    payload?.clientCode ??
    payload?.client?.code ??
    payload?.client?.client_code ??
    ""
  ).trim()

  if (!clientCode) {
    return { ok: false, error: "client_code_required" }
  }

  const { data, error } = await supabase
    .from("clients")
    .select("id, child_code")
    .eq("owner_id", userId)
    .eq("child_code", clientCode)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { ok: false, error: "client_lookup_failed" }
  }

  if (!data?.id) {
    return { ok: false, error: "client_not_found" }
  }

  return { ok: true, client: data }
}

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { z } from "zod"
import { requireTrustedMutation } from "@/lib/security/apiGuards"
import { rejectServerControlledFields } from "@/lib/security/payloadGuards"
import { evaluateAccountRisk, recordAccountSecurityEvent } from "@/lib/security/anomalyDetection"
import { getPrivacyAuditContext, recordDataAccessAuditEvent } from "@/lib/security/privacyOps"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"
import { consumeReportCredit } from "@/lib/security/reportCredits"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { buildAdvancedReport } from "@/lib/dna/reportEngine"
import { extractAgeMonthsFromAnamnez, isSupportedAgeMonths } from "@/lib/dna/ageUtils"
import { buildLiteratureAlignedSection } from "@/lib/dna/literatureNote"
import { normalizeClinicalReportText } from "@/lib/dna/reportText"
import { validateAndNormalizeClinicalReport } from "@/lib/dna/clinicalSafetyValidator"

async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {}
        },
      },
    }
  )
}

function cleanRenderedReport(text: string): string {
  return validateAndNormalizeClinicalReport(normalizeClinicalReportText(text)).text
}

function appendOptionalSection(baseText: string, optionalSection?: string | null): string {
  const main = String(baseText || "").trim()
  const extra = String(optionalSection || "").trim()
  if (!extra) return main
  return [main, extra].filter(Boolean).join("\n\n")
}

const aiReportPayloadSchema = z
  .object({
    clientCode: z.string().max(120).optional(),
    client_code: z.string().max(120).optional(),
    client: z
      .object({
        code: z.string().max(120).optional(),
        client_code: z.string().max(120).optional(),
        id: z.string().max(120).optional(),
      })
      .passthrough()
      .optional(),
    clientId: z.string().max(120).optional(),
    client_id: z.string().max(120).optional(),
    assessmentId: z.string().max(120).optional(),
    ageMonths: z.coerce.number().int().min(0).max(240).optional().nullable(),
    anamnez: z.string().max(20000).optional(),
    answers: z.array(z.coerce.number()).max(80).optional(),
    scores: z.record(z.string(), z.coerce.number()).optional(),
  })
  .passthrough()

export async function POST(req: Request) {
  try {
    const originError = await requireTrustedMutation(req)
    if (originError) return originError

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 }
      )
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json(
        {
          ok: false,
          error: "Email confirmation required",
        },
        { status: 403 }
      )
    }

    const rateLimit = await checkRateLimit({
      key: `ai-report:${user.id}`,
      limit: 8,
      windowMs: 60 * 60 * 1000,
    })
    if (!rateLimit.ok) {
      await recordAccountSecurityEvent({
        userId: user.id,
        eventType: "api_rate_limited",
        metadata: { route: "/api/ai-report" },
      })
      await evaluateAccountRisk(user.id)
      return rateLimitResponse(rateLimit.resetAt)
    }

    const parsedBody = await readJsonWithSchema(req, aiReportPayloadSchema)
    if (!parsedBody.ok) return parsedBody.response
    const body = parsedBody.data
    const payloadGuard = rejectServerControlledFields(body)
    if (!payloadGuard.ok) {
      return NextResponse.json(
        { ok: false, error: "server_controlled_fields_present", fields: payloadGuard.fields },
        { status: 400 }
      )
    }

    const ownedClient = await assertOwnedDnaClient(supabase, user.id, body)
    if (!ownedClient.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Danışan kaydı doğrulanamadı.",
        },
        { status: 403 }
      )
    }

    const auditContext = await getPrivacyAuditContext()
    const admin = createSupabaseAdminClient()
    await recordDataAccessAuditEvent({
      admin,
      actorUserId: user.id,
      subjectUserId: user.id,
      action: "ai_report_generate",
      resourceType: "client",
      resourceId: String((ownedClient as any).client?.id || ""),
      legalBasis: "explicit_consent_and_service_delivery",
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { route: "/api/ai-report" },
    })

    const existingLock = await checkExistingDnaReportLock(supabase, body)
    if (existingLock.locked && existingLock.existing?.report_text) {
      const existingText = cleanRenderedReport(String(existingLock.existing.report_text))
      return NextResponse.json({
        ok: true,
        report: existingText,
        deterministic: existingText,
      })
    }


function validateInputDna(body: any) {
  const errors = []

  if (!body) errors.push("body_missing")

  const scores = body?.scores || {}

  const domains = [
    "fizyolojik",
    "duyusal",
    "duygusal",
    "bilissel",
    "yurutucu",
    "intero"
  ]

  for (const d of domains) {
    const val = scores[d]
    if (val == null) errors.push(`${d}_missing`)
    if (typeof val === "number" && (val < 10 || val > 50)) {
      errors.push(`${d}_out_of_range`)
    }
  }

  if (body?.answers != null) {
    if (!Array.isArray(body.answers) || body.answers.length !== 60) {
      errors.push("answers_invalid")
    } else if (body.answers.some((value: unknown) => !Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 5)) {
      errors.push("answers_out_of_range")
    }
  }

  return errors
}

const __validationErrors = validateInputDna(body)
if (__validationErrors.length > 0) {
  return new Response(JSON.stringify({ error: 'invalid_input', details: __validationErrors }), { status: 400 })
}

    const incomingAgeMonths =
      typeof body?.ageMonths === "number"
        ? body.ageMonths
        : extractAgeMonthsFromAnamnez(typeof body?.anamnez === "string" ? body.anamnez : "")

    if (!isSupportedAgeMonths(incomingAgeMonths)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Rapor yalnızca desteklenen yaş aralıkları için üretilebilir. Lütfen 24-35 ay, 36-47 ay, 48-59 ay veya 60-71 ay aralığını seçin.",
        },
        { status: 400 }
      )
    }

    const report = buildAdvancedReport({
      clientCode: body?.clientCode || "",
      ageMonths: incomingAgeMonths,
      anamnez: body?.anamnez || "",
      answers: Array.isArray(body?.answers) ? body.answers : undefined,
      scores: body?.scores || {},
    })

    if (!report.clinicalAnalysis) {
      return NextResponse.json(
        { ok: false, error: "clinicalAnalysis oluşturulamadı." },
        { status: 400 }
      )
    }

    const literatureSection = buildLiteratureAlignedSection(report.clinicalAnalysis)
    const finalText = cleanRenderedReport(
      appendOptionalSection(report.deterministicReport, literatureSection?.text)
    )
    const cleanDeterministic = cleanRenderedReport(
      appendOptionalSection(report.deterministicReport, literatureSection?.text)
    )

    const credit = await consumeReportCredit({
      admin,
      userId: user.id,
      assessmentId: typeof body?.assessmentId === "string" ? body.assessmentId : null,
      clientId: String((ownedClient as any).client?.id || ""),
      metadata: {
        route: "/api/ai-report",
        client_code: String(body?.clientCode || body?.client_code || ""),
        charged_after_successful_generation: true,
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

    return NextResponse.json({
      ok: true,
      report: finalText,
      deterministic: cleanDeterministic,
      remainingReportCredits: credit.remaining,
    })
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "AI rapor üretilemedi.",
      },
      { status: 500 }
    )
  }
}
