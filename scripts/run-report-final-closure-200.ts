import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { buildJuryReadyReport, type JuryReportResult } from "../src/lib/dna/reportJury"
import type { DomainKey, ReportInput } from "../src/lib/dna/reportEngine"
import { applyFullBoldClinicalReportParagraphs } from "../src/lib/dna/reportText"
import { answersForJuryTotals } from "./fixtures/dna-report-jury-cases"

type Totals = readonly [number, number, number, number, number, number]
type Scenario = Readonly<{ id: string; category: string; ageMonths: number; totals: Totals; anamnez: string }>
type BaselineRow = Readonly<{
  caseId: string
  category: string
  totalScore: number
  overallClassification: string
  primaryPriority: DomainKey | null
  profileBreadth: string
  confidence: string
  input: ReportInput
}>

const BASELINE_ROOT = process.env.REPORT_MEGA100_BASELINE_ROOT
  || "/Users/furkancangi/Desktop/Self Metacognition Institute/Projects/Self Meta AI/bitti/python/selfmeta-web/deliverables/DNA_REPORT_MEGA100_HARDENING_FINAL_20260902T130100Z"
const OUTPUT_ROOT = process.env.REPORT_FINAL_CLOSURE_OUTPUT_ROOT || path.join(process.cwd(), "deliverables")
const DOMAIN_ORDER = Object.freeze<DomainKey[]>(["physiological", "sensory", "emotional", "cognitive", "executive", "interoception"])
const TIMES = Object.freeze(["sabah", "öğleye doğru", "okul çıkışında", "akşam", "hafta sonunda", "uykusuz kaldığı gün", "kalabalıkta", "evden çıkarken", "oyun bittikten sonra", "uzun yolculukta"])
const SETTINGS = Object.freeze(["evde", "sınıfta", "serviste", "kantinde", "parkta", "markette", "soyunma odasında", "klinikte", "yemekhanede", "doğum gününde"])

const DOMAIN_EXAMPLES: Readonly<Record<DomainKey, readonly string[]>> = Object.freeze({
  physiological: Object.freeze([
    "gece birkaç kez uyanıyor; sabah hazırlanırken başını masaya koyup işleri yarım bırakıyor",
    "öğleden sonra yorulduğunda giyinmeye başlayamıyor, kısa dinlenmeden sonra devam ediyor",
  ]),
  sensory: Object.freeze([
    "elektrik süpürgesi çalışınca kulaklarını kapatıp odadan çıkıyor",
    "metal tepsi düştüğünde sıradan ayrılıyor, daha sakin yere geçince etkinliğe dönüyor",
  ]),
  emotional: Object.freeze([
    "oyun beklenmeden bitince bağırıp yere oturuyor, önceden haber verilince geçişi tamamlıyor",
    "kural değiştiğinde oyundan ayrılıyor, iki seçenek sunulunca birkaç dakika sonra geri dönüyor",
  ]),
  cognitive: Object.freeze([
    "üç basamaklı yönergede ortadaki adımı unutuyor, resimli listeyle sırayı tamamlıyor",
    "iki bilgi peş peşe verildiğinde yalnız ilkini yapıyor, tek tek söylendiğinde görevi bitiriyor",
  ]),
  executive: Object.freeze([
    "çantasını hazırlarken malzemeleri sıraya koyamıyor ve işi yarım bırakıyor",
    "çok basamaklı sanat çalışmasına başlıyor ama araçları toplama bölümünü tamamlamıyor",
  ]),
  interoception: Object.freeze([
    "tuvalet ihtiyacını son anda söylüyor ve oyunu aniden bırakıyor",
    "acıkınca huzursuzlaşıyor fakat açlığını söylemiyor; su ve ara öğünden sonra oyuna dönüyor",
  ]),
})

function singleDomainTotals(domain: DomainKey, variant: number): Totals {
  const values = DOMAIN_ORDER.map((item, index) => item === domain ? 18 + (variant % 6) : 40 + ((variant + index) % 6))
  return values as unknown as Totals
}

function makeFreshScenarios(): Scenario[] {
  const rows: Scenario[] = []
  const add = (category: string, variant: number, totals: Totals, anamnez: string) => rows.push(Object.freeze({
    id: `CLOSURE-FRESH-${String(rows.length + 1).padStart(3, "0")}`,
    category,
    ageMonths: 30 + ((rows.length * 11 + variant * 7) % 108),
    totals,
    anamnez,
  }))
  for (let variant = 0; variant < 10; variant += 1) {
    const domain = DOMAIN_ORDER[variant % DOMAIN_ORDER.length]
    const example = DOMAIN_EXAMPLES[domain][variant % 2]
    const time = TIMES[variant]
    const setting = SETTINGS[variant]
    add("short_concrete", variant, singleDomainTotals(domain, variant), `${setting} ${example}.`)
    add("typo_conversational", variant, singleDomainTotals(domain, variant + 1), `başvuru sebebı ${time} ${example.replace(/ğ/gu, "g").replace(/ş/gu, "s").replace(/ı/gu, "i")} bazen oluyo bazen olmuyo?? terapist gözlemi yok dis test yok`)
    add("insufficient_noise", variant, singleDomainTotals(domain, variant + 2), `genel bakılsın ${variant} formda ${domain} yazmışlar ama neden belli değil örnek yok sonra anlatırız xx qqq`)
    add("caregiver_observation_difference", variant, singleDomainTotals(domain, variant + 3), `Başvuru sebebi: Bakım veren ${setting} ${example}. Terapist yorumları: Klinik ortamda iki basamaklı ayrı bir görevi yaşına uygun tamamladı; bakım verenin bildirdiği koşul denenmedi.`)
    add("external_dna_difference", variant, singleDomainTotals("sensory", variant), `Başvuru sebebi: ${setting} yüksek seste kulaklarını kapatıp etkinlikten ayrılıyor. Ek klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: işitsel alan beklenen aralıkta | Klinik yorum: bakım veren formunda belirgin duyusal güçlük görülmedi.`)
    add("close_multidomain", variant, [41, 24 + (variant % 3), 40, 25 + (variant % 3), 23 + (variant % 3), 42], `Başvuru sebebi: ${setting} kalabalık sırada sesi izlerken eşyalarını toplamayı unutuyor ve işi yarım bırakıyor. Terapist yorumları: Daha sakin bir köşede yazılı üç adımla alışveriş görevini tamamladı.`)
    add("broad_multidomain", variant, [20 + (variant % 4), 21 + (variant % 4), 22 + (variant % 4), 23 + (variant % 4), 24 + (variant % 4), 25 + (variant % 4)], `Başvuru sebebi: ${time} giyinme, yemek, geçiş ve çok basamaklı görevler aynı gün içinde zorlaşıyor. Bakım veren ses arttığında sırayı daha çabuk kaybettiğini söylüyor. Terapist yorumları: Sakin odada kısa yönerge ve görsel sıra kartı birlikte verildi; gömleği giydi fakat düğmeleri tamamlamadan bıraktı.`)
    add("preserved_contextual", variant, [44, 45, 43, 44, 45, 44], `Başvuru sebebi: ${time} sıcaklık ve açlık birlikte arttığında itiraz edip oyunu bırakıyor. Mola, su ve kısa yürüyüşten sonra geri dönüyor. Evde giyinme, yemek, tuvalet ve okul hazırlığını çoğunlukla bağımsız sürdürüyor.`)
    add("difficulty_with_preserved_capacity", variant, singleDomainTotals(domain, variant + 4), `Başvuru sebebi: ${setting} ${example}. Bakım veren görsel sıra kartı ve kısa bekleme verildiğinde aynı görevin kalan bölümünü tamamladığını bildiriyor. Güçlü yanı: tek basamaklı işleri bağımsız sürdürüyor.`)
    add("dense_mixed_sources", variant, [32 + (variant % 3), 21 + (variant % 4), 33 + (variant % 3), 24 + (variant % 4), 23 + (variant % 4), 34 + (variant % 3)], `Başvuru sebebi: ${time} hazırlanırken önce çorabı istemiyor sonra ${setting} sesten dönüyor sonra hangi giysiyi alacağını unutuyor; bakım veren sakin odada iki seçenek sunulunca giyinmeyi sürdürdüğünü söylüyor ama okul bilgisi yok. Terapist yorumları: Görsel iki adım verildiğinde başladı; destek kaldırılınca sırayı yeniden karıştırdı. Ek klinik test / bulgular: Test 1: Test adı: Vineland-3 | Puan / sonuç: öz bakım yaşa uygun | Klinik yorum: temel beceriler yapılandırılmış görüşmede korunmuş. Test 2: Test adı: BRIEF-P | Puan / sonuç: formun yarısı boş | Klinik yorum: yorumlanamaz.`)
  }
  assert.equal(rows.length, 100)
  return rows
}

function toInput(row: Scenario): ReportInput {
  const answers = answersForJuryTotals(row.totals)
  const scores = calculateAssessment(answers)
  return Object.freeze({
    clientCode: row.id,
    ageMonths: row.ageMonths,
    anamnez: row.anamnez,
    answers: [...answers],
    scores: Object.freeze({
      fizyolojik: scores.fizyolojik,
      duyusal: scores.duyusal,
      duygusal: scores.duygusal,
      bilissel: scores.bilissel,
      yurutucu: scores.yurutucu,
      intero: scores.intero,
      toplam: scores.toplam,
    }),
  })
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`
  return JSON.stringify(value)
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function decision(result: JuryReportResult) {
  return Object.freeze({
    overallClassification: result.overallClassification,
    primaryPriority: result.priorityProfile.primary_priority,
    profileBreadth: result.priorityProfile.profile_breadth,
    confidence: result.confidence.category,
  })
}

function baselineDecision(row: BaselineRow) {
  return Object.freeze({
    overallClassification: row.overallClassification,
    primaryPriority: row.primaryPriority,
    profileBreadth: row.profileBreadth,
    confidence: row.confidence,
  })
}

function productReport(result: JuryReportResult): string {
  const emphasized = result.lockedLanguagePlan.sections.flatMap((section) => section.paragraphs).filter((paragraph) => paragraph.emphasis === "full_bold").map((paragraph) => paragraph.text)
  return applyFullBoldClinicalReportParagraphs(result.finalReport, emphasized)
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

async function main() {
  const megaRows = fs.readFileSync(path.join(BASELINE_ROOT, "SEALED_CASES_AND_RESULTS.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as BaselineRow)
  const freshScenarios = makeFreshScenarios()
  assert.equal(megaRows.length, 100)

  let providerCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    providerCalls += 1
    throw new Error("PROVIDER_CALL_FORBIDDEN_IN_FINAL_CLOSURE_200")
  }) as typeof fetch
  const megaResults: Array<{ baseline: BaselineRow; result: JuryReportResult }> = []
  const freshResults: Array<{ scenario: Scenario; input: ReportInput; result: JuryReportResult; replay: JuryReportResult }> = []
  try {
    for (const [index, baseline] of megaRows.entries()) {
      megaResults.push({ baseline, result: await buildJuryReadyReport(baseline.input) })
      if ((index + 1) % 25 === 0) console.log(`MEGA100 ${index + 1}/100`)
    }
    for (const [index, scenario] of freshScenarios.entries()) {
      const input = toInput(scenario)
      const result = await buildJuryReadyReport(input)
      const replay = await buildJuryReadyReport(input)
      freshResults.push({ scenario, input, result, replay })
      if ((index + 1) % 25 === 0) console.log(`FRESH100 ${index + 1}/100`)
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  const allResults = [...megaResults.map((row) => ({ id: row.baseline.caseId, category: `mega:${row.baseline.category}`, input: row.baseline.input, result: row.result })), ...freshResults.map((row) => ({ id: row.scenario.id, category: `fresh:${row.scenario.category}`, input: row.input, result: row.result }))]
  const sumMetric = (key: keyof JuryReportResult["validation"]) => allResults.reduce((sum, row) => sum + Number(row.result.validation[key] || 0), 0)
  const validationFailures = allResults.filter((row) => !row.result.validation.pass || row.result.reportStatus !== "ready_for_therapist_review")
  const megaDecisionDrift = megaResults.filter((row) => stable(baselineDecision(row.baseline)) !== stable(decision(row.result))).length
  const megaScoreDrift = megaResults.filter((row) => row.baseline.totalScore !== row.result.base.v1.totalScore || row.baseline.overallClassification !== row.result.overallClassification).length
  const freshDecisionDrift = freshResults.filter((row) => stable(decision(row.result)) !== stable(decision(row.replay))).length
  const freshOutputDrift = freshResults.filter((row) => row.result.finalReport !== row.replay.finalReport).length
  const summary = Object.freeze({
    schemaVersion: "dna-report-final-closure-200-v1",
    generatedAt: new Date().toISOString(),
    cases: allResults.length,
    megaCases: megaResults.length,
    freshCases: freshResults.length,
    freshCategoryCounts: Object.fromEntries(Array.from(new Set(freshScenarios.map((row) => row.category))).map((category) => [category, freshScenarios.filter((row) => row.category === category).length])),
    providerCalls,
    llmCostUsd: 0,
    validationPass: allResults.filter((row) => row.result.validation.pass).length,
    readyForReview: allResults.filter((row) => row.result.reportStatus === "ready_for_therapist_review").length,
    megaDecisionDrift,
    megaScoreDrift,
    freshDecisionDrift,
    freshOutputDrift,
    visibleFactualContradiction: sumMetric("visibleFactualContradictionCount"),
    unsupportedAddition: sumMetric("unsupportedVisibleClauseCount") + sumMetric("unsupportedVisibleCaseClaimCount"),
    unsupportedCausality: sumMetric("unsupportedCausalityCount"),
    sourceViolation: sumMetric("wrongSourceAttributionCount") + sumMetric("wrongDomainAttributionCount") + sumMetric("unsupportedSourceCount"),
    privacyOrCrossCaseViolation: sumMetric("crossCaseContaminationCount") + sumMetric("unsupportedCaseFactCount"),
    grammarFragments: sumMetric("grammarFragmentCount"),
    rawNoisyAnamnesisLeaks: sumMetric("rawNoisyAnamnesisLeakCount"),
    semanticDecisionRepetitions: sumMetric("semanticDecisionRepetitionCount"),
    profileLanguageContradictions: sumMetric("profileLanguageContradictionCount") + sumMetric("closePriorityOverstatementCount"),
    naturalEvidenceRelationErrors: sumMetric("naturalEvidenceRelationErrorCount"),
    systemLikeProse: sumMetric("systemLikeProseCount"),
    awkwardGenericPhrases: sumMetric("awkwardGenericPhraseCount"),
    terminologyDrift: sumMetric("terminologyDriftCount"),
    boldDecisionContractPass: allResults.filter((row) => row.result.validation.boldDecisionContentPass).length,
    productSurfaceBoldPass: allResults.filter((row) => count(productReport(row.result), /^\*\*[^\n]+\*\*$/gmu) === 3).length,
    failures: validationFailures.map((row) => Object.freeze({ id: row.id, category: row.category, failureCodes: row.result.validation.failureCodes, critic: row.result.critic })),
  })

  const runStamp = new Date().toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z")
  const outputDir = path.join(OUTPUT_ROOT, `DNA_REPORT_FINAL_CLOSURE_200_${runStamp}`)
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, "FRESH100_INPUTS.jsonl"), `${freshResults.map((row) => JSON.stringify({ scenario: row.scenario, input: row.input, inputSha256: sha256(stable(row.input)) })).join("\n")}\n`, "utf8")
  fs.writeFileSync(path.join(outputDir, "BLIND_MEGA100_REPORTS.md"), megaResults.map((row, index) => `# Rapor ${index + 1}\n\n${row.result.finalReport}`).join("\n\n---\n\n"), "utf8")
  fs.writeFileSync(path.join(outputDir, "BLIND_FRESH100_REPORTS.md"), freshResults.map((row, index) => `# Rapor ${index + 1}\n\n${row.result.finalReport}`).join("\n\n---\n\n"), "utf8")
  fs.writeFileSync(path.join(outputDir, "PRODUCT_SURFACE_200_REPORTS.md"), allResults.map((row, index) => `# Rapor ${index + 1}\n\n${productReport(row.result)}`).join("\n\n---\n\n"), "utf8")
  fs.writeFileSync(path.join(outputDir, "SEALED_200_RESULTS.jsonl"), `${allResults.map((row) => JSON.stringify({ id: row.id, category: row.category, input: row.input, inputSha256: sha256(stable(row.input)), decision: decision(row.result), validation: row.result.validation, critic: row.result.critic, reportStatus: row.result.reportStatus, finalReportSha256: sha256(row.result.finalReport) })).join("\n")}\n`, "utf8")
  const selectedPerCategory = new Map<string, number>()
  const riskReviewRows = freshResults.filter((row) => {
    const selected = selectedPerCategory.get(row.scenario.category) ?? 0
    if (selected >= 3) return false
    selectedPerCategory.set(row.scenario.category, selected + 1)
    return true
  })
  fs.writeFileSync(path.join(outputDir, "RISK_REVIEW_INDEX.json"), `${JSON.stringify(riskReviewRows.map((row) => ({ id: row.scenario.id, category: row.scenario.category })), null, 2)}\n`, "utf8")
  fs.writeFileSync(path.join(outputDir, "OBJECTIVE_SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")
  console.log(JSON.stringify({ outputDir, summary }, null, 2))

  assert.equal(summary.cases, 200)
  assert.equal(summary.providerCalls, 0)
  assert.equal(summary.validationPass, 200)
  assert.equal(summary.readyForReview, 200)
  assert.equal(summary.megaDecisionDrift, 0)
  assert.equal(summary.megaScoreDrift, 0)
  assert.equal(summary.freshDecisionDrift, 0)
  assert.equal(summary.freshOutputDrift, 0)
  assert.equal(summary.visibleFactualContradiction, 0)
  assert.equal(summary.unsupportedAddition, 0)
  assert.equal(summary.unsupportedCausality, 0)
  assert.equal(summary.sourceViolation, 0)
  assert.equal(summary.privacyOrCrossCaseViolation, 0)
  assert.equal(summary.grammarFragments, 0)
  assert.equal(summary.rawNoisyAnamnesisLeaks, 0)
  assert.equal(summary.semanticDecisionRepetitions, 0)
  assert.equal(summary.profileLanguageContradictions, 0)
  assert.equal(summary.naturalEvidenceRelationErrors, 0)
  assert.equal(summary.systemLikeProse, 0)
  assert.equal(summary.awkwardGenericPhrases, 0)
  assert.equal(summary.terminologyDrift, 0)
  assert.equal(summary.boldDecisionContractPass, 200)
  assert.equal(summary.productSurfaceBoldPass, 200)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
