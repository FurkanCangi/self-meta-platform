import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { buildJuryReadyReport, type JuryReportResult } from "../src/lib/dna/reportJury"
import { LunaJuryLanguageRealizer } from "../src/lib/dna/reportJury/lunaLayers.server"
import type { ReportInput } from "../src/lib/dna/reportEngine"
import { answersForJuryTotals } from "./fixtures/dna-report-jury-cases"

type Totals = readonly [number, number, number, number, number, number]
type Scenario = Readonly<{ id: string; category: string; ageMonths: number; totals: Totals; anamnez: string }>

const OUTPUT_ROOT = process.env.REPORT_HUMAN_ACCEPTANCE_OUTPUT_ROOT || path.join(process.cwd(), "deliverables")
const LUNA_SAMPLE = Math.max(0, Math.min(3, Number(process.env.REPORT_HUMAN_LUNA_SAMPLE || 0)))
const LUNA_CAP_MICROUSD = Math.max(100_000, Number(process.env.REPORT_HUMAN_LUNA_CAP_MICROUSD || 700_000))

const variations = [
  ["sabah", "evde", "kısa"],
  ["öğleden sonra", "okulda", "iki kez"],
  ["akşam", "park dönüşünde", "çoğu gün"],
] as const

function scenarios(): Scenario[] {
  const rows: Scenario[] = []
  const add = (category: string, variant: number, ageMonths: number, totals: Totals, anamnez: string) => rows.push(Object.freeze({
    id: `HUMAN-FRESH-${String(rows.length + 1).padStart(2, "0")}`,
    category,
    ageMonths,
    totals,
    anamnez,
  }))
  for (let variant = 0; variant < 3; variant += 1) {
    const [time, setting, frequency] = variations[variant]
    add("very_short", variant, 30 + variant * 12, [42, 19 + variant, 42, 43, 42, 43], `Başvuru sebebi: ${setting} elektrik süpürgesi çalışınca kulaklarını kapatıyor. Başka bilgi yok.`)
    add("typo_turkish", variant, 33 + variant * 12, [41, 42, 40, 22 + variant, 20 + variant, 42], `basvuru sebebı ${time} canta hazirlarken 3 step olunca 2.yi ucuruyor starts but no finish bazen de hic olmuyo??? terapist yorumu tek tek resimle verildiginde isi bitiriyor dis test yok`)
    add("no_punctuation", variant, 35 + variant * 12, [22 + variant, 41, 40, 41, 42, 21 + variant], `başvuru sebebi ${time} kahvaltı gecikince huzursuzlaşıyor açlığı söylemiyor oyunu bırakıyor su ve kısa mola verilince geri dönüyor terapist gözlemi yapılmadı dış test yok`)
    add("source_conflict", variant, 38 + variant * 10, [40, 18 + variant, 40, 40, 41, 42], `Başvuru sebebi: Bakım veren ${setting} zil çaldığında ortamdan uzaklaştığını bildiriyor. Terapist yorumları: Sessiz odadaki masa görevinde on iki dakika kaldı; zil sesi denenmedi. Ek klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: işitsel alan beklenen aralıkta | Klinik yorum: bakım veren formunda belirgin güçlük görülmedi.`)
    add("close_multidomain", variant, 40 + variant * 9, [41, 26 + variant, 42, 27 + variant, 25 + variant, 41], `Başvuru sebebi: ${setting} kalabalık sırada sesleri izlerken eşyalarını toplamayı unutuyor ve görevi yarım bırakıyor. Terapist yorumları: Daha sakin köşede yazılı sıra kartıyla görevi tamamladı.`)
    add("broad_multidomain", variant, 42 + variant * 8, [22 + variant, 23 + variant, 24 + variant, 25 + variant, 26 + variant, 27 + variant], `Başvuru sebebi: ${frequency} giyinme, geçiş, kalabalık ortam ve çok basamaklı görevler aynı gün içinde zorlaşıyor. Terapist yorumları: Sakin odada kısa yönerge ve görsel sıra kartı birlikte verildi; gömleği giydi fakat düğmeleri tamamlamadan görevi bıraktı.`)
    add("preserved_contextual", variant, 44 + variant * 8, [44, 45, 43, 44, 45, 44], `Başvuru sebebi: Uzun yolculukta sıcaklık ve açlık birlikte arttığında itiraz ediyor. Mola, su ve kısa yürüyüşten sonra yolculuğa devam ediyor. Diğer günlük rutinleri çoğunlukla bağımsız sürdürüyor.`)
    add("external_mixed", variant, 46 + variant * 8, [40, 24 + variant, 41, 25 + variant, 23 + variant, 42], `Başvuru sebebi: Çok basamaklı alışveriş görevinde sırayı karıştırıp işi yarım bırakıyor. Ek klinik test / bulgular: Test 1: Test adı: BRIEF-P | Puan / sonuç: planlama ölçeği yüksek | Klinik yorum: günlük rutinlerde başlatma güçlüğü. Test 2: Test adı: BOT-2 | Puan / sonuç: formun yarısı boş, yaş normu yazılmamış | Klinik yorum: yorumlanamaz.`)
    add("no_daily_example", variant, 48 + variant * 7, [42, 41, 40, 19 + variant, 20 + variant, 42], `Başvuru sebebi: Değerlendirme istendi. Günlük görev, ortam ve davranış örneği verilmedi. Terapist gözlemi yapılmadı. Dış test yok.`)
    add("dense_scattered", variant, 50 + variant * 7, [31 + variant, 20 + variant, 32 + variant, 24 + variant, 23 + variant, 34 + variant], `Başvuru sebebi: ${time} hazırlanırken önce çorabı istemiyor sonra odadaki sese dönüyor sonra hangi giysiyi alacağını unutuyor. Bakım veren bunun ${frequency} olduğunu ancak sessiz odada iki seçenek sunulunca giyinmenin sürdüğünü söylüyor. Okulda veri yok. Terapist yorumları: Görsel iki adım verildiğinde başladı; ikinci görevde destek kaldırılınca sırayı yeniden karıştırdı. Ek klinik test / bulgular: Test 1: Test adı: Vineland-3 | Puan / sonuç: öz bakım yaşa uygun | Klinik yorum: temel beceriler yapılandırılmış görüşmede korunmuş.`)
  }
  return rows
}

function toInput(row: Scenario): ReportInput {
  const answers = answersForJuryTotals(row.totals)
  const scores = calculateAssessment(answers)
  return {
    clientCode: row.id,
    ageMonths: row.ageMonths,
    anamnez: row.anamnez,
    answers,
    scores: {
      fizyolojik: scores.fizyolojik,
      duyusal: scores.duyusal,
      duygusal: scores.duygusal,
      bilissel: scores.bilissel,
      yurutucu: scores.yurutucu,
      intero: scores.intero,
      toplam: scores.toplam,
    },
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`
  return JSON.stringify(value)
}

function decision(result: JuryReportResult) {
  return {
    overallClassification: result.overallClassification,
    primaryPriority: result.priorityProfile.primary_priority,
    profileBreadth: result.priorityProfile.profile_breadth,
    primaryFormulationId: result.lockedLanguagePlan.primaryFormulationId,
    confidence: result.confidence.category,
    affectedDomains: result.priorityProfile.affected_domains,
    preservedDomains: result.priorityProfile.preserved_domains,
  }
}

function usageCost(payload: unknown) {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const usage = body.usage && typeof body.usage === "object" ? body.usage as Record<string, unknown> : {}
  const details = usage.input_tokens_details && typeof usage.input_tokens_details === "object" ? usage.input_tokens_details as Record<string, unknown> : {}
  const input = Math.max(0, Number(usage.input_tokens || 0))
  const cached = Math.min(input, Math.max(0, Number(details.cached_tokens || 0)))
  const output = Math.max(0, Number(usage.output_tokens || 0))
  return { input, cached, output, costMicrousd: input - cached + Math.ceil(cached / 10) + output * 6 }
}

async function main() {
  const rows = scenarios()
  assert.equal(rows.length, 30)
  const runStamp = new Date().toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z")
  const outputDir = path.join(OUTPUT_ROOT, `DNA_REPORT_HUMAN_READABILITY_${runStamp}`)
  fs.mkdirSync(outputDir, { recursive: true })

  let deterministicProviderCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    deterministicProviderCalls += 1
    throw new Error("PROVIDER_CALL_FORBIDDEN_IN_DETERMINISTIC_ACCEPTANCE")
  }) as typeof fetch
  const deterministicRows: Array<{ scenario: Scenario; input: ReportInput; result: JuryReportResult; replay: JuryReportResult }> = []
  try {
    for (const scenario of rows) {
      const input = toInput(scenario)
      const result = await buildJuryReadyReport(input)
      const replay = await buildJuryReadyReport({ ...input, answers: [...(input.answers ?? [])], scores: { ...input.scores } })
      deterministicRows.push({ scenario, input, result, replay })
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  let lunaCalls = 0
  let lunaCostMicrousd = 0
  const lunaRows: Array<{ id: string; result: JuryReportResult; costMicrousd: number }> = []
  if (LUNA_SAMPLE > 0) {
    const budgetedFetch: typeof fetch = async (input, init) => {
      if (lunaCostMicrousd >= LUNA_CAP_MICROUSD) throw new Error("LUNA_INCREMENTAL_CAP_REACHED")
      lunaCalls += 1
      const response = await originalFetch(input, init)
      const cloned = response.clone()
      const payload = await cloned.json().catch(() => null)
      const measured = usageCost(payload)
      lunaCostMicrousd += measured.costMicrousd
      if (lunaCostMicrousd > LUNA_CAP_MICROUSD) throw new Error("LUNA_INCREMENTAL_CAP_EXCEEDED")
      return response
    }
    const realizer = new LunaJuryLanguageRealizer({ fetchImpl: budgetedFetch, safetyIdentifier: `report-human-acceptance-${runStamp}` })
    for (const row of deterministicRows.slice(0, LUNA_SAMPLE)) {
      const result = await buildJuryReadyReport(row.input, { languageRealizer: realizer })
      lunaRows.push({ id: row.scenario.id, result, costMicrousd: lunaCostMicrousd })
    }
  }

  const deterministicFailures = deterministicRows.flatMap(({ scenario, result, replay }) => {
    const failures = [...result.validation.failureCodes]
    if (!result.validation.pass || result.reportStatus !== "ready_for_therapist_review") failures.push("REPORT_NOT_READY")
    if (stable(decision(result)) !== stable(decision(replay))) failures.push("DECISION_DRIFT")
    if (result.finalReport !== replay.finalReport) failures.push("NON_DETERMINISTIC_REPORT")
    return failures.length ? [{ id: scenario.id, failures: Array.from(new Set(failures)) }] : []
  })
  const lunaDecisionDrift = lunaRows.filter((row) => {
    const baseline = deterministicRows.find((entry) => entry.scenario.id === row.id)!
    return stable(decision(row.result)) !== stable(decision(baseline.result))
  }).length
  const sumMetric = (key: keyof JuryReportResult["validation"]) => deterministicRows.reduce((sum, row) => sum + Number(row.result.validation[key] || 0), 0)
  const summary = {
    schemaVersion: "dna-report-human-readability-acceptance-v1",
    generatedAt: new Date().toISOString(),
    cases: rows.length,
    categoryCounts: Object.fromEntries(Array.from(new Set(rows.map((row) => row.category))).map((category) => [category, rows.filter((row) => row.category === category).length])),
    deterministic: {
      providerCalls: deterministicProviderCalls,
      validationPass: deterministicRows.filter((row) => row.result.validation.pass).length,
      readyForReview: deterministicRows.filter((row) => row.result.reportStatus === "ready_for_therapist_review").length,
      failures: deterministicFailures,
      decisionDrift: deterministicRows.filter((row) => stable(decision(row.result)) !== stable(decision(row.replay))).length,
      unsupportedAddition: sumMetric("unsupportedVisibleClauseCount") + sumMetric("unsupportedVisibleCaseClaimCount"),
      sourceViolation: sumMetric("wrongSourceAttributionCount") + sumMetric("wrongDomainAttributionCount") + sumMetric("unsupportedSourceCount"),
      meaningOrCertaintyDrift: sumMetric("visibleFactualContradictionCount") + sumMetric("confidenceCertaintyMismatchCount"),
      grammarFragments: sumMetric("grammarFragmentCount"),
      rawNoisyAnamnesisLeaks: sumMetric("rawNoisyAnamnesisLeakCount"),
      profileLanguageContradictions: sumMetric("profileLanguageContradictionCount") + sumMetric("closePriorityOverstatementCount"),
      semanticDecisionRepetitions: sumMetric("semanticDecisionRepetitionCount"),
      systemLikeProse: sumMetric("systemLikeProseCount"),
      awkwardGenericPhrases: sumMetric("awkwardGenericPhraseCount"),
      terminologyDrift: sumMetric("terminologyDriftCount"),
      boldDecisionContractPass: deterministicRows.filter((row) => row.result.validation.boldDecisionContentPass).length,
    },
    luna: {
      requestedSample: LUNA_SAMPLE,
      completed: lunaRows.length,
      calls: lunaCalls,
      direct: lunaRows.filter((row) => !row.result.languageFallbackUsed).length,
      fallback: lunaRows.filter((row) => row.result.languageFallbackUsed).length,
      fallbackReasons: Object.fromEntries(["NO_REALIZATION", "LANGUAGE_MAPPING_VALIDATION", "REPORT_VALIDATION"].map((reason) => [reason, lunaRows.filter((row) => row.result.languageFallbackReason === reason).length])),
      validatorPass: lunaRows.filter((row) => row.result.validation.pass).length,
      decisionDrift: lunaDecisionDrift,
      incrementalCostMicrousd: lunaCostMicrousd,
      hardCapMicrousd: LUNA_CAP_MICROUSD,
    },
    hardPass: deterministicFailures.length === 0 && deterministicProviderCalls === 0 && lunaDecisionDrift === 0 && lunaCostMicrousd <= LUNA_CAP_MICROUSD,
  }

  const blind = deterministicRows.map((row, index) => `# Rapor ${index + 1}\n\n${row.result.finalReport}`).join("\n\n---\n\n")
  const sealed = deterministicRows.map((row) => JSON.stringify({
    id: row.scenario.id,
    category: row.scenario.category,
    input: row.input,
    decision: decision(row.result),
    validation: row.result.validation,
    reportStatus: row.result.reportStatus,
    finalReportSha256: crypto.createHash("sha256").update(row.result.finalReport).digest("hex"),
  })).join("\n") + "\n"
  fs.writeFileSync(path.join(outputDir, "BLIND_FRESH_30_REPORTS.md"), blind, "utf8")
  fs.writeFileSync(path.join(outputDir, "SEALED_FRESH_30_RESULTS.jsonl"), sealed, "utf8")
  fs.writeFileSync(path.join(outputDir, "OBJECTIVE_SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")
  console.log(JSON.stringify({ outputDir, summary }, null, 2))
  assert.equal(summary.hardPass, true, JSON.stringify(deterministicFailures.slice(0, 5)))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
