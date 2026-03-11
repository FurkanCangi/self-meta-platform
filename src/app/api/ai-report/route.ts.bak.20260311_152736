import { NextResponse } from "next/server"
import { rewriteClinicalReport } from "@/lib/selfmeta/aiRewrite"
import { buildAdvancedReport } from "@/lib/selfmeta/reportEngine"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const report = buildAdvancedReport({
      clientCode: body?.clientCode || "",
      ageMonths: typeof body?.ageMonths === "number" ? body.ageMonths : null,
      anamnez: body?.anamnez || "",
      scores: body?.scores || {},
    })

    if (!report.clinicalAnalysis) {
      return NextResponse.json(
        { ok: false, error: "clinicalAnalysis oluşturulamadı." },
        { status: 400 }
      )
    }

    const aiText = await rewriteClinicalReport(report.clinicalAnalysis)

    return NextResponse.json({
      ok: true,
      report: aiText,
      deterministic: report.deterministicReport,
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
