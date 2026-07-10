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

async function checkExistingDnaReportLockByClientId(admin: any, clientId: string) {
  const normalizedClientId = String(clientId || "").trim()
  if (!normalizedClientId) return { locked: false, existing: null }

  const { data: assessments, error: assessmentsError } = await admin
    .from("assessments_v2")
    .select("id")
    .eq("client_id", normalizedClientId)
    .is("deleted_at", null)

  if (assessmentsError || !assessments || assessments.length === 0) {
    return { locked: false, existing: null }
  }

  const assessmentIds = assessments.map((row: any) => row.id).filter(Boolean)
  if (assessmentIds.length === 0) return { locked: false, existing: null }

  const { data, error } = await admin
    .from("reports")
    .select("id, report_text, created_at, assessment_id")
    .in("assessment_id", assessmentIds)
    .not("report_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error || !data?.length) return { locked: false, existing: null }

  return { locked: true, existing: data[0] }
}

async function assertOwnedDnaClient(supabase: any, admin: any, userId: string, userEmail: string | null | undefined, payload: any) {
  const clientCode = String(
    payload?.client_code ??
    payload?.clientCode ??
    payload?.client?.code ??
    payload?.client?.client_code ??
    ""
  ).trim()
  const clientId = String(payload?.clientId ?? payload?.client_id ?? payload?.client?.id ?? "").trim()

  if (!clientCode && !clientId) {
    return { ok: false, error: "client_code_required" }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle()

  const elevated = isOwnerAuditEmail(userEmail) || isAdminRole(profile?.role)
  let query = (elevated ? admin : supabase)
    .from("clients")
    .select("id, child_code")
    .is("deleted_at", null)
    .limit(1)

  query = clientId ? query.eq("id", clientId) : query.eq("child_code", clientCode)
  if (!elevated) query = query.eq("owner_id", userId)

  const { data, error } = await query

  if (error) {
    return { ok: false, error: "client_lookup_failed" }
  }

  const row = Array.isArray(data) ? data[0] : data

  if (!row?.id) {
    return { ok: false, error: "client_not_found" }
  }

  return { ok: true, client: row, elevated }
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
import { consumeReportCredit, grantReportCredits } from "@/lib/security/reportCredits"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
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

function validateInputDna(body: any) {
  const errors = []

  if (!body) errors.push("body_missing")

  const scores = body?.scores || {}
  const domains = ["fizyolojik", "duyusal", "duygusal", "bilissel", "yurutucu", "intero"]

  for (const domain of domains) {
    const value = scores[domain]
    if (value == null) errors.push(`${domain}_missing`)
    if (typeof value === "number" && (value < 10 || value > 50)) {
      errors.push(`${domain}_out_of_range`)
    }
  }

  if (body?.answers != null) {
    if (!Array.isArray(body.answers) || body.answers.length !== 60) {
      errors.push("answers_invalid")
    } else if (
      body.answers.some(
        (value: unknown) => !Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 5
      )
    ) {
      errors.push("answers_out_of_range")
    }
  }

  return errors
}

function normalizeDnaScores(scores: Record<string, unknown> | undefined | null) {
  const source = scores || {}
  return {
    fizyolojik: Number(source.fizyolojik),
    duyusal: Number(source.duyusal),
    duygusal: Number(source.duygusal),
    bilissel: Number(source.bilissel),
    yurutucu: Number(source.yurutucu),
    intero: Number(source.intero),
    toplam: Number(source.toplam),
    age_months: Number(source.age_months),
    ageMonths: Number(source.ageMonths),
  }
}

function isAdminRole(role?: string | null) {
  return ["admin", "owner", "super_admin", "yonetici", "yönetici"].includes(String(role || "").toLowerCase())
}

const deterministicReportPayloadSchema = z
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
    age_months: z.coerce.number().int().min(0).max(240).optional().nullable(),
    ageMonths: z.coerce.number().int().min(0).max(240).optional().nullable(),
    anamnez: z.string().max(20000).optional(),
    answers: z.array(z.coerce.number()).max(80).optional(),
    scores: z.record(z.string(), z.unknown()).optional(),
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

    const parsedBody = await readJsonWithSchema(req, deterministicReportPayloadSchema)
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
    const ownedClient = await assertOwnedDnaClient(supabase, admin, user.id, user.email, body)
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
    const ownedClientId = String((ownedClient as any).client?.id || "")
    const assessmentId = typeof body?.assessmentId === "string" ? body.assessmentId.trim() : ""

    if (!assessmentId) {
      return NextResponse.json(
        { ok: false, error: "Değerlendirme kaydı doğrulanamadı." },
        { status: 400 }
      )
    }

    if (!ownedClientId) {
      return NextResponse.json(
        { ok: false, error: "Danışan kaydı doğrulanamadı." },
        { status: 403 }
      )
    }

    const incomingClientId = String(body?.clientId || body?.client_id || "").trim()
    if (incomingClientId && incomingClientId !== ownedClientId) {
      return NextResponse.json(
        { ok: false, error: "Danışan kaydı doğrulanamadı." },
        { status: 403 }
      )
    }

    const { data: assessmentRow, error: assessmentLookupError } = await admin
      .from("assessments_v2")
      .select("id, client_id")
      .eq("id", assessmentId)
      .eq("client_id", ownedClientId)
      .is("deleted_at", null)
      .maybeSingle()

    if (assessmentLookupError) {
      return NextResponse.json(
        { ok: false, error: "Değerlendirme kaydı doğrulanamadı." },
        { status: 500 }
      )
    }

    if (!assessmentRow?.id) {
      return NextResponse.json(
        { ok: false, error: "Değerlendirme kaydı bulunamadı." },
        { status: 404 }
      )
    }

    await recordDataAccessAuditEvent({
      admin,
      actorUserId: user.id,
      subjectUserId: user.id,
      action: "ai_report_generate",
      resourceType: "client",
      resourceId: ownedClientId,
      legalBasis: "explicit_consent_and_service_delivery",
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { route: "/api/ai-report" },
    })

    const existingLock =
      (await checkExistingDnaReportLockByClientId(admin, ownedClientId)) ||
      (await checkExistingDnaReportLock(supabase, body))
    if (existingLock.locked && existingLock.existing?.report_text) {
      const existingText = cleanRenderedReport(String(existingLock.existing.report_text))
      return NextResponse.json({
        ok: true,
        report: existingText,
        deterministic: existingText,
        reportId: existingLock.existing.id,
        createdAt: existingLock.existing.created_at,
        existing: true,
      })
    }

const __validationErrors = validateInputDna(body)
if (__validationErrors.length > 0) {
  return new Response(JSON.stringify({ error: 'invalid_input', details: __validationErrors }), { status: 400 })
}

    const numericScores = normalizeDnaScores(body?.scores)
    const scoreAgeMonths = Number(numericScores.age_months ?? numericScores.ageMonths)
    const incomingAgeMonths =
      typeof body?.ageMonths === "number"
        ? body.ageMonths
        : typeof body?.age_months === "number"
          ? body.age_months
        : Number.isFinite(scoreAgeMonths)
          ? scoreAgeMonths
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
      scores: numericScores,
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
      userEmail: user.email,
      assessmentId,
      clientId: ownedClientId,
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

    const snapshotJson = {
      client_code: String(body?.clientCode || body?.client_code || ""),
      answers: Array.isArray(body?.answers) ? body.answers : [],
      scores: numericScores,
      age_months: incomingAgeMonths,
      norm_source: report.normSource,
      age_band_label: report.ageBandLabel,
      domain_levels: report.domainLevels ?? report.domains,
      weak_domains: report.weakDomains,
      strong_domains: report.strongDomains,
      patterns: report.patterns,
      anamnez_flags: report.anamnezFlags,
      ai_report_text: finalText,
      saved_by: "api/ai-report",
    }

    const { data: createdReport, error: reportInsertError } = await admin
      .from("reports")
      .insert({
        assessment_id: assessmentId,
        version: 1,
        report_text: finalText,
        immutable: true,
        snapshot_json: snapshotJson,
      })
      .select("id, created_at")
      .single()

    if (reportInsertError) {
      await grantReportCredits({
        admin,
        userId: user.id,
        delta: 1,
        reason: "adjustment",
        source: "system",
        metadata: {
          route: "/api/ai-report",
          rollback_reason: "ai_report_insert_failed",
          assessment_id: assessmentId,
        },
      })

      return NextResponse.json(
        { ok: false, error: "Rapor kaydı oluşturulamadı. Rapor hakkınız iade edildi; lütfen tekrar deneyin." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      report: finalText,
      deterministic: cleanDeterministic,
      remainingReportCredits: credit.remaining,
      reportId: createdReport?.id || null,
      createdAt: createdReport?.created_at || null,
      existing: false,
    })
  } catch (error) {
    console.error("[report] deterministic report generation failed", error)
    return NextResponse.json(
      {
        ok: false,
        error: "Rapor oluşturulamadı.",
      },
      { status: 500 }
    )
  }
}
