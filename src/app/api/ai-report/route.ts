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

  const { data, error } = await supabase
    .from("reports")
    .select("id, report_text, client_code, created_at")
    .eq("client_code", clientCode)
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
import { rewriteClinicalReport } from "@/lib/selfmeta/aiRewrite"
import { buildAdvancedReport } from "@/lib/selfmeta/reportEngine"
import { extractAgeMonthsFromAnamnez, isSupportedAgeMonths } from "@/lib/selfmeta/ageUtils"

function hasAllRequiredSections(text: string): boolean {
  const required = [
    "1. Genel Klinik Değerlendirme",
    "2. Öncelikli Self-Regülasyon Alanları",
    "3. Alanlar Arası Klinik Örüntü",
    "4. Anamnez ve Ölçek Bulgularının Uyum Düzeyi",
    "5. Sonuç Düzeyinde Klinik Özet",
  ];
  return required.every((h) => text.includes(h));
}

function normalizeLevel(v: string): string {
  const x = String(v || "").toLowerCase().trim();
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

  // Sadece gerçekten eksikse fallback
  if (!aiText.includes("5. Sonuç Düzeyinde Klinik Özet")) return true;

  // Sadece açık düzey çelişkisi varsa fallback
  if (hasLevelMismatch(aiText, clinicalAnalysis?.domainSummary)) return true;

  return false;
}

function cleanRenderedReport(text: string): string {
  if (!text) return "";

  return text
    .replace(/\[\[END_OF_REPORT\]\]/g, "")
    .replace(/age_band_heuristic/g, "")
    .replace(/fallback_fixed/g, "")
    .replace(/^##\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json()


function validateInputSelfMeta(body) {
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
    const useFallback = shouldFallbackToDeterministic(aiText, report.clinicalAnalysis)
    const finalText = cleanRenderedReport(useFallback ? report.deterministicReport : aiText)
    const cleanDeterministic = cleanRenderedReport(report.deterministicReport)

    console.log("[AI-REPORT] ai_length=", aiText?.length || 0)
    console.log("[AI-REPORT] ai_has_section_5=", aiText?.includes("5. Sonuç Düzeyinde Klinik Özet"))
    console.log("[AI-REPORT] fallback_used=", useFallback)
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
