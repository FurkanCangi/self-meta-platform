async function checkExistingSelfMetaReportLock(supabase: any, payload: any) {
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

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { rewriteClinicalReport } from "@/lib/selfmeta/aiRewrite"
import { buildAdvancedReport } from "@/lib/selfmeta/reportEngine"
import { extractAgeMonthsFromAnamnez, isSupportedAgeMonths } from "@/lib/selfmeta/ageUtils"
import { buildLiteratureAlignedSection } from "@/lib/selfmeta/literatureNote"
import {
  getClinicalReportSectionHeadings,
  hasAllCanonicalReportSections,
  mergeClinicalReportSections,
  normalizeClinicalReportText,
} from "@/lib/selfmeta/reportText"

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

function hasAllRequiredSections(text: string): boolean {
  return hasAllCanonicalReportSections(text)
}

function normalizeLevel(v: string): string {
  const x = String(v || "").toLowerCase().trim()
    .replace(/\.\s*olarak görünmektedir\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (x.includes("atipik")) return "Atipik";
  if (x.includes("riskli")) return "Riskli";
  if (x.includes("tipik")) return "Tipik";
  return "";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasLevelMismatch(
  text: string,
  domainSummary: Record<string, string> | undefined
): boolean {
  if (!text || !domainSummary) return false;

  const allLevels = ["Tipik", "Riskli", "Atipik"];
  const lines = text.split(/\n+/);

  for (const [domain, rawLevel] of Object.entries(domainSummary)) {
    const expected = normalizeLevel(rawLevel);
    if (!domain || !expected) continue;

    const domainRe = new RegExp(escapeRegex(domain), "i");
    const matchingLines = lines.filter((ln) => domainRe.test(ln));

    for (const ln of matchingLines) {
      const foundLevels = allLevels.filter((lvl) => ln.includes(lvl));

      // Sadece aynı satırda alan adı + farklı düzey varsa mismatch
      if (foundLevels.length > 0 && !foundLevels.includes(expected)) {
        return true;
      }
    }
  }

  return false;
}

function shouldFallbackToDeterministic(
  aiText: string,
  clinicalAnalysis: {
    domainSummary?: Record<string, string>;
  } | undefined
): boolean {
  if (!aiText || !aiText.trim()) return true;

  // Bölümler gerçekten eksikse fallback
  if (!hasAllRequiredSections(aiText)) return true;

  // Sadece açık düzey çelişkisi varsa fallback
  if (hasLevelMismatch(aiText, clinicalAnalysis?.domainSummary)) return true;

  return false;
}

function cleanRenderedReport(text: string): string {
  return normalizeClinicalReportText(text)
}

function appendOptionalSection(baseText: string, optionalSection?: string | null): string {
  const main = String(baseText || "").trim()
  const extra = String(optionalSection || "").trim()
  if (!extra) return main
  return [main, extra].filter(Boolean).join("\n\n")
}

export async function POST(req: Request) {
  try {
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

    const body = await req.json()

    const existingLock = await checkExistingSelfMetaReportLock(supabase, body)
    if (existingLock.locked && existingLock.existing?.report_text) {
      const existingText = cleanRenderedReport(String(existingLock.existing.report_text))
      return NextResponse.json({
        ok: true,
        report: existingText,
        deterministic: existingText,
      })
    }


function validateInputSelfMeta(body: any) {
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

  return errors
}

const __validationErrors = validateInputSelfMeta(body)
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
      scores: body?.scores || {},
    })

    if (!report.clinicalAnalysis) {
      return NextResponse.json(
        { ok: false, error: "clinicalAnalysis oluşturulamadı." },
        { status: 400 }
      )
    }

    let aiText = ""
    let aiError = null

    try {
      aiText = await rewriteClinicalReport(report.clinicalAnalysis)
    } catch (e) {
      aiError = e
      console.error("[AI-REPORT] LLM_ERROR:", e)
      aiText = ""
    }
    const mergedAiText = mergeClinicalReportSections(aiText, report.deterministicReport)
    const useFallback = shouldFallbackToDeterministic(mergedAiText, report.clinicalAnalysis)
    const literatureSection = buildLiteratureAlignedSection(report.clinicalAnalysis)
    const finalText = cleanRenderedReport(
      appendOptionalSection(useFallback ? report.deterministicReport : mergedAiText, literatureSection?.text)
    )
    const cleanDeterministic = cleanRenderedReport(
      appendOptionalSection(report.deterministicReport, literatureSection?.text)
    )

    console.log("[AI-REPORT] ai_length=", aiText?.length || 0)
    console.log("[AI-REPORT] ai_raw_headings=", JSON.stringify(getClinicalReportSectionHeadings(aiText || "")))
    console.log("[AI-REPORT] ai_merged_headings=", JSON.stringify(getClinicalReportSectionHeadings(mergedAiText || "")))
    console.log("[AI-REPORT] ai_has_all_sections=", hasAllRequiredSections(mergedAiText || ""))
    console.log("[AI-REPORT] fallback_used=", useFallback)
    console.log("[AI-REPORT] literature_sources=", JSON.stringify(literatureSection?.sourceIds || []))
    console.log("[AI-REPORT] final_starts_with=", (finalText || "").slice(0, 60))

    return NextResponse.json({
      ok: true,
      report: finalText,
      deterministic: cleanDeterministic,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "AI rapor üretilemedi.",
      },
      { status: 500 }
    )
  }
}
