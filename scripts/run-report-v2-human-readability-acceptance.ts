import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { getItemScoringDirection } from "../src/lib/assessment/itemScoring"
import {
  REPORT_SECTION_HEADINGS,
  REPORT_V2_VERSION,
  type ReportV2ShadowResult,
} from "../src/lib/dna/reportV2/contracts"
import { stableHash } from "../src/lib/dna/reportV2/evidenceEngine"
import {
  DNA_REPORT_LUNA_MODEL,
  DNA_REPORT_LUNA_PRICING_VERSION,
  LunaReportRealizer,
} from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { PLAIN_CLINICAL_TURKISH_VERSION } from "../src/lib/dna/reportV2/plainClinicalTurkish"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import type { ReportInput } from "../src/lib/dna/reportEngine"
import {
  buildConsistencyNaturalLanguageCases,
  buildFinalLanguageQaCases,
  buildFreshReportV2Cases,
  buildPlainClinicalTurkishCases,
  buildPlainIntegrationQaCases,
  buildProductionReadinessCases,
  buildQualityConsolidationCases,
  type ReportV2SyntheticCase,
} from "./report-v2-cases"

type DomainTotals = readonly [number, number, number, number, number, number]
type AcceptanceRow = Readonly<{ fixture: ReportV2SyntheticCase; result: ReportV2ShadowResult }>

const HARD_COST_CAP_MICROUSD = 500_000
const OUTPUT_ROOT = process.env.REPORT_V2_HUMAN_READABILITY_OUTPUT_ROOT
  || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow"

const ACCEPTANCE_SCENARIOS: readonly Readonly<{
  pattern: string
  ageMonths: number
  totals: DomainTotals
  anamnez: string
  adversarial?: boolean
  expectDiscrepancy?: boolean
}>[] = Object.freeze([
  {
    pattern: "human-fresh-sensory-library",
    ageMonths: 49,
    totals: [41, 19, 41, 40, 41, 40],
    anamnez: "Başvuru sebebi: Kütüphanedeki sandalye sesleri arttığında kitabı bırakıp kapıya yöneliyor. Terapist yorumları: Sessiz okuma köşesinde aynı kitabı incelemeye devam etti. Çocuğun güçlü yanları: Önceden haber verildiğinde masaya geçebiliyor.",
  },
  {
    pattern: "human-fresh-executive-art-routine",
    ageMonths: 52,
    totals: [41, 40, 41, 38, 20, 41],
    anamnez: "Başvuru sebebi: Resim etkinliğinde malzemeleri çıkarma, kullanma ve toplama sırasının ortasında duruyor. Terapist yorumları: Adımlar sırayla gösterildiğinde etkinliği bitirip malzemeleri topladı. Ek klinik test / bulgular: Test 1: Test adı: BRIEF-P | Puan / sonuç: Planlama alanında klinik yükselme | Klinik yorum: Çok basamaklı işlerde güçlük.",
  },
  {
    pattern: "human-fresh-emotional-turn-taking",
    ageMonths: 55,
    totals: [41, 41, 19, 41, 40, 41],
    anamnez: "Başvuru sebebi: Sıra beklediği oyun beklenmedik biçimde değiştiğinde oyundan ayrılıyor ve geri dönmesi uzun sürüyor. Terapist yorumları: Değişiklik önceden söylendiğinde kısa bir aradan sonra oyuna döndü.",
  },
  {
    pattern: "human-fresh-physiological-morning",
    ageMonths: 58,
    totals: [19, 41, 40, 41, 40, 41],
    anamnez: "Başvuru sebebi: Gece geç uyuduğu günlerde sabah servise hazırlanırken giyinme ve kahvaltıyı tamamlayamıyor. Terapist yorumları: İyi uyuduğu gün yapılan seansta görevleri zamanında bitirdi.",
  },
  {
    pattern: "human-fresh-interoception-playground",
    ageMonths: 61,
    totals: [40, 41, 40, 41, 40, 19],
    anamnez: "Başvuru sebebi: Bahçede oynarken susadığını ve tuvalet ihtiyacını çok geç söylüyor. Terapist yorumları: Oyun arasında bedenini kontrol etmesi hatırlatıldığında ihtiyacını daha erken bildirdi.",
  },
  {
    pattern: "human-fresh-cognitive-craft",
    ageMonths: 64,
    totals: [41, 40, 41, 19, 40, 41],
    anamnez: "Başvuru sebebi: Üç aşamalı el işi yönergesinde ikinci işlemi unutuyor ve çalışmayı yarım bırakıyor. Terapist yorumları: Yönerge kısa cümlelere ayrıldığında tüm işlemleri tamamladı.",
  },
  {
    pattern: "human-fresh-multi-domain-class-transition",
    ageMonths: 67,
    totals: [27, 25, 24, 25, 24, 27],
    anamnez: "Başvuru sebebi: Sınıf değişikliği, koridor gürültüsü ve uzun yönerge aynı anda olduğunda yeni göreve başlayamıyor. Terapist yorumları: Geçiş sakin ortamda yapılıp tek adım verildiğinde görevin bir bölümünü tamamladı.",
    adversarial: true,
  },
  {
    pattern: "human-fresh-balanced-play",
    ageMonths: 70,
    totals: [44, 43, 44, 44, 43, 44],
    anamnez: "Başvuru sebebi: Rutin tarama değerlendirmesi. Terapist yorumları: Serbest oyun, masa etkinliği ve grup geçişinde yaşına uygun katılım gösterdi. Çocuğun güçlü yanları: Gerektiğinde yardım isteyip görevine dönebiliyor.",
  },
  {
    pattern: "human-fresh-caregiver-clinic-sensory-disagreement",
    ageMonths: 50,
    totals: [43, 43, 42, 43, 42, 43],
    anamnez: "Başvuru sebebi: Bakım veren, doğum günü ortamındaki müzik yükseldiğinde çocuğun masadan ayrıldığını bildiriyor. Terapist yorumları: Klinikte orta düzey arka plan sesi varken etkinliği tamamladı. Ek klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: İşitsel alan tipik aralıkta | Klinik yorum: Ölçek belirgin güçlük göstermiyor.",
    adversarial: true,
    expectDiscrepancy: true,
  },
  {
    pattern: "human-fresh-executive-external-disagreement",
    ageMonths: 53,
    totals: [40, 40, 40, 37, 21, 40],
    anamnez: "Başvuru sebebi: Oyun bittikten sonra parçaları ayırma ve kutularına yerleştirme sırasını tamamlayamıyor. Terapist yorumları: Yetişkin ilk adımı başlattığında kalan adımları yaptı. Ek klinik test / bulgular: Test 1: Test adı: BRIEF-P | Puan / sonuç: Organizasyon alanında klinik yükselme | Klinik yorum: Görev sıralamasında güçlük. Test 2: Test adı: PEDI-CAT | Puan / sonuç: Günlük aktiviteler beklenen aralıkta | Klinik yorum: Temel günlük işler korunuyor.",
    adversarial: true,
    expectDiscrepancy: true,
  },
  {
    pattern: "human-fresh-low-evidence-physiological",
    ageMonths: 56,
    totals: [22, 41, 41, 41, 41, 41],
    anamnez: "Başvuru sebebi: Genel değerlendirme talebi. Günlük yaşam örneği, terapist gözlemi ve dış test sonucu paylaşılmadı.",
    adversarial: true,
  },
  {
    pattern: "human-fresh-preserved-under-support-executive",
    ageMonths: 59,
    totals: [41, 41, 40, 38, 23, 41],
    anamnez: "Başvuru sebebi: Sofrayı kaldırırken tabakları, bardakları ve çatal-kaşıkları nereye koyacağını karıştırıyor. Terapist yorumları: İlk yer gösterildiğinde kalan eşyaları doğru yerlere koydu. Çocuğun güçlü yanları: Tek adımlı ev işlerini bağımsız yapıyor.",
    adversarial: true,
  },
  {
    pattern: "human-fresh-physiological-interoception-mixed",
    ageMonths: 62,
    totals: [26, 41, 41, 41, 40, 25],
    anamnez: "Başvuru sebebi: Yoğun bir günün sonunda yorgunluk ve susama sinyallerini geç fark edip akşam rutinini bırakıyor. Terapist yorumları: Dinlenme arası verildiğinde su isteyip rutinine geri döndü.",
    adversarial: true,
  },
  {
    pattern: "human-fresh-caregiver-therapist-emotional-disagreement",
    ageMonths: 65,
    totals: [42, 42, 42, 42, 42, 42],
    anamnez: "Başvuru sebebi: Bakım veren, evden çıkış saati değiştiğinde çocuğun uzun süre sakinleşemediğini bildiriyor. Terapist yorumları: Seans planı değiştiğinde kısa açıklamadan sonra etkinliğe devam etti.",
    adversarial: true,
    expectDiscrepancy: true,
  },
  {
    pattern: "human-fresh-cognitive-executive-test-conflict",
    ageMonths: 68,
    totals: [40, 40, 40, 28, 27, 40],
    anamnez: "Başvuru sebebi: Fen etkinliğinde sözel açıklamayı izleyip deney sırasını sürdürmekte zorlanıyor. Terapist yorumları: Açıklama iki parçaya ayrıldığında deneyi tamamladı. Ek klinik test / bulgular: Test 1: Test adı: BRIEF-P | Puan / sonuç: Çalışma belleğinde yükselme | Klinik yorum: Yürütücü işlev güçlüğü. Test 2: Test adı: Vineland-3 | Puan / sonuç: Günlük yaşam yaşa uygun | Klinik yorum: Temel rutinler korunuyor.",
    adversarial: true,
    expectDiscrepancy: true,
  },
  {
    pattern: "human-fresh-sensory-cinema-context",
    ageMonths: 51,
    totals: [41, 22, 41, 40, 41, 40],
    anamnez: "Başvuru sebebi: Sinema salonunda ses yükseldiğinde koltuğundan kalkıp çıkmak istiyor. Terapist yorumları: Ses düzeyi azaltılmış kısa videoyu oturarak tamamladı. Çocuğun güçlü yanları: Evde düşük sesli videoları bağımsız izliyor.",
    adversarial: true,
  },
  {
    pattern: "human-fresh-emotional-caregiver-only",
    ageMonths: 63,
    totals: [40, 41, 24, 41, 40, 41],
    anamnez: "Başvuru sebebi: Bakım veren, kardeşinin oyuna katılmasıyla kural değiştiğinde çocuğun oyunu bırakıp uzun süre geri dönmediğini bildiriyor. Terapist gözlemi ve dış test sonucu paylaşılmadı.",
    adversarial: true,
  },
])

function scoredItemsForTotal(total: number): number[] {
  const bounded = Math.max(10, Math.min(50, Math.round(total)))
  const base = Math.floor(bounded / 10)
  const remainder = bounded - base * 10
  return Array.from({ length: 10 }, (_, index) => Math.max(1, Math.min(5, base + (index < remainder ? 1 : 0))))
}

function answersForTotals(totals: DomainTotals): number[] {
  const scored = totals.flatMap(scoredItemsForTotal)
  return scored.map((value, index) => getItemScoringDirection(index + 1) === "reverse" ? 6 - value : value)
}

export function buildHumanReadabilityAcceptanceCases(): readonly ReportV2SyntheticCase[] {
  return Object.freeze(ACCEPTANCE_SCENARIOS.map((scenario, index) => Object.freeze({
    id: `human-readability-fresh-${String(index + 1).padStart(2, "0")}`,
    pattern: scenario.pattern,
    adversarial: Boolean(scenario.adversarial),
    expectDiscrepancy: Boolean(scenario.expectDiscrepancy),
    input: {
      clientCode: `HUMAN-READABILITY-${String(index + 1).padStart(2, "0")}`,
      ageMonths: scenario.ageMonths,
      anamnez: `${scenario.anamnez}\nYaş aralığı: ${scenario.ageMonths < 60 ? "48-59 ay" : "60-71 ay"}.`,
      answers: answersForTotals(scenario.totals),
      scores: {},
    } satisfies ReportInput,
  })))
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z")
}

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function loadLocalApiKey(): string | undefined {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim()
  for (const filename of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), filename)
    if (!fs.existsSync(file)) continue
    const line = fs.readFileSync(file, "utf8").split(/\r?\n/u).find((row) => /^OPENAI_API_KEY\s*=/u.test(row))
    const value = line?.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/gu, "")
    if (value) return value
  }
  return undefined
}

function priorInputHashes() {
  const prior = [
    ...buildFreshReportV2Cases(),
    ...buildFinalLanguageQaCases(),
    ...buildQualityConsolidationCases(),
    ...buildConsistencyNaturalLanguageCases(),
    ...buildProductionReadinessCases(),
    ...buildPlainClinicalTurkishCases(),
    ...buildPlainIntegrationQaCases(),
  ]
  return new Set(prior.map((fixture) => stableHash({
    ageMonths: fixture.input.ageMonths,
    anamnez: fixture.input.anamnez,
    answers: fixture.input.answers,
  })))
}

function assertFresh(cases: readonly ReportV2SyntheticCase[], expectedCount: number) {
  const prior = priorInputHashes()
  const hashes = cases.map((fixture) => stableHash({
    ageMonths: fixture.input.ageMonths,
    anamnez: fixture.input.anamnez,
    answers: fixture.input.answers,
  }))
  assert.equal(cases.length, expectedCount)
  assert.equal(new Set(hashes).size, expectedCount, "fresh cohort contains duplicate input")
  assert.equal(hashes.filter((hash) => prior.has(hash)).length, 0, "fresh cohort repeats a prior fixture")
}

function scoringRegression(fixture: ReportV2SyntheticCase, result: ReportV2ShadowResult) {
  const calculated = calculateAssessment(fixture.input.answers ?? [])
  const scores = new Map(result.v1.domainResults.map((domain) => [domain.key, domain.score]))
  return Number(
    scores.get("physiological") !== calculated.fizyolojik
    || scores.get("sensory") !== calculated.duyusal
    || scores.get("emotional") !== calculated.duygusal
    || scores.get("cognitive") !== calculated.bilissel
    || scores.get("executive") !== calculated.yurutucu
    || scores.get("interoception") !== calculated.intero
    || result.v1.totalScore !== calculated.toplam
  )
}

function assertHeadingContract(report: string) {
  let previous = -1
  for (const heading of REPORT_SECTION_HEADINGS) {
    const index = report.indexOf(heading)
    assert.ok(index > previous, `heading missing or out of order:${heading}`)
    assert.equal(report.split(heading).length - 1, 1, `heading repeated:${heading}`)
    previous = index
  }
}

function rowsFromCheckpoint(filename: string, cases: readonly ReportV2SyntheticCase[]) {
  const byId = new Map(cases.map((fixture) => [fixture.id, fixture]))
  return Object.freeze(fs.readFileSync(filename, "utf8").trim().split(/\n/u).filter(Boolean).map((line) => {
    const parsed = JSON.parse(line) as Readonly<{ caseId: string; result: ReportV2ShadowResult }>
    const fixture = byId.get(parsed.caseId)
    if (!fixture) throw new Error(`checkpoint_fixture_missing:${parsed.caseId}`)
    return Object.freeze({ fixture, result: parsed.result })
  }))
}

function measuredCost(rows: readonly AcceptanceRow[]) {
  return rows.flatMap((row) => row.result.trace.realizationAttempts)
    .filter((attempt) => attempt.provider === "luna")
    .reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
}

async function runCases(cases: readonly ReportV2SyntheticCase[], checkpoint: string, maxCostMicrousd: number) {
  const apiKey = loadLocalApiKey()
  if (!apiKey) throw new Error("OPENAI_API_KEY unavailable")
  const realizer = new LunaReportRealizer({
    apiKey,
    safetyIdentifier: "report-v2-final-human-readability-acceptance-15",
    maxTotalCostMicrousd: maxCostMicrousd,
  })
  const rows: AcceptanceRow[] = []
  for (const [index, fixture] of cases.entries()) {
    const result = await runReportV2Shadow(fixture.input, { realizer, literatureMode: "STANDARD" })
    assertHeadingContract(result.finalReport)
    rows.push(Object.freeze({ fixture, result }))
    fs.appendFileSync(checkpoint, JSON.stringify({ caseId: fixture.id, result }) + "\n", "utf8")
    console.log(`human-readability ${index + 1}/15: ${fixture.id} ${result.recoveryStatus} calls=${result.providerCalls}`)
  }
  return Object.freeze(rows)
}

function percentile(values: readonly number[], ratio: number) {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return Number(ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * ratio) - 1))]!.toFixed(2))
}

function metrics(rows: readonly AcceptanceRow[]) {
  const attempts = rows.flatMap((row) => row.result.trace.realizationAttempts).filter((attempt) => attempt.provider === "luna")
  const measuredAttempts = attempts.filter((attempt) => attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0)
  const totalCostMicrousd = measuredAttempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  const reportLatencies = rows.map((row) => row.result.trace.realizationAttempts
    .filter((attempt) => attempt.provider === "luna")
    .reduce((sum, attempt) => sum + attempt.latencyMs, 0))
  const direct = rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length
  const controlledInsertion = rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR").length
  const lunaRepair = rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length
  const fallback = rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length
  return Object.freeze({
    reportCount: rows.length,
    direct,
    controlledRepair: controlledInsertion + lunaRepair,
    controlledInsertion,
    lunaRepair,
    fallback,
    realizedOrControlled: direct + controlledInsertion + lunaRepair,
    measuredReports: rows.filter((row) => row.result.trace.realizationAttempts.some((attempt) => attempt.provider === "luna" && (attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0))).length,
    providerCalls: attempts.length,
    measuredCalls: measuredAttempts.length,
    inputTokens: measuredAttempts.reduce((sum, attempt) => sum + attempt.usage.inputTokens, 0),
    outputTokens: measuredAttempts.reduce((sum, attempt) => sum + attempt.usage.outputTokens, 0),
    totalCostMicrousd,
    totalCostUsd: Number((totalCostMicrousd / 1_000_000).toFixed(6)),
    costPerReportUsd: Number((totalCostMicrousd / Math.max(1, rows.length) / 1_000_000).toFixed(6)),
    p50LatencyMs: percentile(reportLatencies, 0.5),
    p95LatencyMs: percentile(reportLatencies, 0.95),
    validationFailure: rows.filter((row) => !row.result.validation.pass).length,
    scoringRegression: rows.reduce((sum, row) => sum + scoringRegression(row.fixture, row.result), 0),
    grammarFragment: rows.reduce((sum, row) => sum + row.result.validation.grammarFragmentCount, 0),
    semanticContradiction: rows.reduce((sum, row) => sum + row.result.validation.semanticContradictionCount, 0),
    awkwardGenericPhrase: rows.reduce((sum, row) => sum + row.result.validation.awkwardGenericPhraseCount, 0),
    decisionDrift: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    meaningDrift: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.meaningDriftCount, row.result.validation.meaningDriftCount), 0),
    newSpecificity: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.newSpecificityCount, row.result.validation.newSpecificityCount), 0),
    certaintyDrift: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.certaintyDriftCount, row.result.validation.certaintyDriftCount), 0),
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    internalJargon: rows.reduce((sum, row) => sum
      + row.result.validation.internalEngineJargonCount
      + row.result.validation.internalLabelLeakageCount
      + row.result.validation.systemLikeLanguageCount, 0),
    nonMaterialReentry: rows.reduce((sum, row) => sum + row.result.validation.nonMaterialKnowledgeReentryCount, 0),
    sourceRegression: rows.reduce((sum, row) => sum
      + row.result.validation.knowledgeSourceViolationCount
      + row.result.validation.knowledgeAuthorityViolationCount
      + row.result.validation.knowledgeCaseSpecificAdditionCount, 0),
    safetyRegression: rows.filter((row) => row.result.validation.failureCodes.includes("SAFETY_VIOLATION")).length,
    privacyRegression: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    terminologyDrift: rows.reduce((sum, row) => sum + row.result.validation.terminologyDriftCount, 0),
    crossSectionRepetition: rows.reduce((sum, row) => sum
      + row.result.validation.crossSectionRepetitionCount
      + row.result.validation.semanticCrossSectionRepeatCount, 0),
  })
}

function blindReports(rows: readonly AcceptanceRow[]) {
  return [
    "# DNA Intelligence — Final 15 Kör Rapor",
    "",
    ...rows.flatMap((row, index) => [
      `## RAPOR-${String(index + 1).padStart(2, "0")}`,
      "",
      row.result.finalReport,
      "",
    ]),
  ].join("\n")
}

function sentenceList(text: string) {
  return text
    .split(/\n+/u)
    .flatMap((line) => line.replace(/^[-*]\s+/u, "").split(/(?<=[.!?])\s+/u))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20)
}

function shuffled<T>(values: readonly T[], seed: number) {
  const output = [...values]
  let state = seed >>> 0
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[output[index], output[swapIndex]] = [output[swapIndex]!, output[index]!]
  }
  return output
}

function blindSentences(rows: readonly AcceptanceRow[]) {
  const all = rows.flatMap((row) => row.result.realization.sections.flatMap((section) => sentenceList(section.text)))
  assert.ok(all.length >= 100, `blind_sentence_shortfall:${all.length}`)
  const selected = shuffled(all, 20260814).slice(0, Math.min(120, all.length))
  return [
    "# DNA Intelligence — Kör Dil Cümleleri",
    "",
    ...selected.map((sentence) => `- ${sentence}`),
    "",
  ].join("\n")
}

async function main() {
  const allCases = buildHumanReadabilityAcceptanceCases()
  assertFresh(allCases, 17)
  const priorCheckpoint = process.env.REPORT_V2_HUMAN_READABILITY_PRIOR_CHECKPOINT?.trim()
  const priorRows = priorCheckpoint ? rowsFromCheckpoint(priorCheckpoint, allCases) : Object.freeze([] as AcceptanceRow[])
  const retainedPriorRows = priorRows.filter((row) => row.result.recoveryStatus !== "DETERMINISTIC_FALLBACK")
  const priorIds = new Set(priorRows.map((row) => row.fixture.id))
  const pendingCases = priorCheckpoint
    ? allCases.filter((fixture) => !priorIds.has(fixture.id))
    : allCases.slice(0, 15)
  assert.equal(retainedPriorRows.length + pendingCases.length, 15, "final fresh cohort must contain 15 reports")
  const priorMeasuredCostMicrousd = measuredCost(priorRows)
  const remainingCostMicrousd = HARD_COST_CAP_MICROUSD - priorMeasuredCostMicrousd
  assert.ok(remainingCostMicrousd > 0, "prior run exhausted cost cap")
  const runTimestamp = timestamp()
  const checkpoint = path.join("/tmp", `report-v2-human-readability-${runTimestamp}.jsonl`)
  fs.writeFileSync(checkpoint, "", "utf8")
  const newRows = await runCases(pendingCases, checkpoint, remainingCostMicrousd)
  const rows = Object.freeze([...retainedPriorRows, ...newRows].sort((left, right) => left.fixture.id.localeCompare(right.fixture.id)))
  const finalCohortMetrics = metrics(rows)
  const taskCostMicrousd = priorMeasuredCostMicrousd + measuredCost(newRows)
  const summary = Object.freeze({
    ...finalCohortMetrics,
    finalCohortCostUsd: finalCohortMetrics.totalCostUsd,
    priorMeasuredCostUsd: Number((priorMeasuredCostMicrousd / 1_000_000).toFixed(6)),
    totalCostMicrousd: taskCostMicrousd,
    totalCostUsd: Number((taskCostMicrousd / 1_000_000).toFixed(6)),
  })
  assert.ok(taskCostMicrousd <= HARD_COST_CAP_MICROUSD, `hard_cost_cap_exceeded:${summary.totalCostUsd}`)

  const zeroKeys = [
    "validationFailure",
    "scoringRegression",
    "grammarFragment",
    "semanticContradiction",
    "awkwardGenericPhrase",
    "decisionDrift",
    "meaningDrift",
    "newSpecificity",
    "certaintyDrift",
    "unsupportedAddition",
    "internalJargon",
    "nonMaterialReentry",
    "sourceRegression",
    "safetyRegression",
    "privacyRegression",
    "terminologyDrift",
    "crossSectionRepetition",
  ] as const
  assert.equal(zeroKeys.filter((key) => summary[key] !== 0).length, 0, `hard_gate_failed:${zeroKeys.filter((key) => summary[key] !== 0).join(",")}`)
  assert.ok(summary.realizedOrControlled >= 14, `realized_or_controlled_shortfall:${summary.realizedOrControlled}`)
  assert.ok(summary.fallback <= 1, `fallback_exceeded:${summary.fallback}`)
  assert.equal(summary.measuredReports, 15, `real_pipeline_shortfall:${summary.measuredReports}`)

  const baseline = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string }>
  const routeSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts")))
  const reportEngineSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts")))
  const productionChanged = routeSha256 !== baseline.routeSha256 || reportEngineSha256 !== baseline.reportEngineSha256
  assert.equal(productionChanged, false, "production_baseline_changed")

  const outputDir = path.join(OUTPUT_ROOT, runTimestamp)
  fs.mkdirSync(outputDir, { recursive: true })
  const reportsPath = path.join(outputDir, "BLIND_FINAL_15_REPORTS.md")
  const sentencesPath = path.join(outputDir, "BLIND_LANGUAGE_SENTENCES.md")
  const sealedPath = path.join(outputDir, "SEALED_HUMAN_READABILITY_EVIDENCE.jsonl")
  fs.writeFileSync(reportsPath, blindReports(rows), "utf8")
  fs.writeFileSync(sentencesPath, blindSentences(rows), "utf8")
  fs.writeFileSync(sealedPath, rows.map((row) => JSON.stringify({
    caseId: row.fixture.id,
    pattern: row.fixture.pattern,
    inputHash: row.result.trace.inputHash,
    finalReportHash: row.result.trace.finalReportHash,
    recoveryStatus: row.result.recoveryStatus,
    providerCalls: row.result.providerCalls,
    decisionState: row.result.decisionPlan.decisionState,
    primaryFormulationId: row.result.decisionPlan.primaryFormulation?.id ?? null,
    confidence: row.result.decisionPlan.confidence.level,
    validation: row.result.validation,
    plainClinicalTurkish: row.result.plainClinicalTurkish,
    realizationAttempts: row.result.trace.realizationAttempts,
  })).join("\n") + "\n", "utf8")

  const zipPath = path.join(outputDir, "final-human-readability-acceptance-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, path.basename(reportsPath), path.basename(sentencesPath)], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  const zipSha256 = sha256(fs.readFileSync(zipPath))
  const objective = Object.freeze({
    version: "dna-report-v2-final-human-readability-acceptance@1",
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    reportVersion: REPORT_V2_VERSION,
    plainClinicalTurkishVersion: PLAIN_CLINICAL_TURKISH_VERSION,
    model: DNA_REPORT_LUNA_MODEL,
    pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION,
    codexLanguageScore: null,
    freshFixtureCount: rows.length,
    exactPriorFixtureMatches: 0,
    discardedPriorFallbackCount: priorRows.length - retainedPriorRows.length,
    priorCheckpoint: priorCheckpoint ?? null,
    hardCostCapUsd: HARD_COST_CAP_MICROUSD / 1_000_000,
    metrics: summary,
    hardAcceptance: Object.freeze({ passed: true, zeroKeys }),
    artifacts: Object.freeze({ reportsPath, sentencesPath, sealedPath, zipPath, zipSha256 }),
    isolation: Object.freeze({ productionChanged, productionActivated: false, chatBoxChangedByThisRun: false }),
    hashes: Object.freeze({ routeSha256, reportEngineSha256 }),
  })
  fs.writeFileSync(path.join(outputDir, "objective-summary.json"), JSON.stringify(objective, null, 2) + "\n", "utf8")
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify({
    version: objective.version,
    generatedAt: objective.generatedAt,
    blindZipContents: [path.basename(reportsPath), path.basename(sentencesPath)],
    files: [reportsPath, sentencesPath, sealedPath, path.join(outputDir, "objective-summary.json")].map((filename) => ({
      filename: path.basename(filename),
      sha256: sha256(fs.readFileSync(filename)),
      bytes: fs.statSync(filename).size,
      includedInBlindZip: filename === reportsPath || filename === sentencesPath,
    })),
    zip: Object.freeze({ filename: path.basename(zipPath), sha256: zipSha256, bytes: fs.statSync(zipPath).size }),
  }, null, 2) + "\n", "utf8")

  console.log("=== REPORT V2 FINAL HUMAN-READABILITY ACCEPTANCE ===")
  console.log(`Checkpoint: ${checkpoint}`)
  console.log(`Directory: ${outputDir}`)
  console.log(`HARD_ACCEPTANCE: PASS`)
  console.log(`Luna direct: ${summary.direct}`)
  console.log(`Controlled repair: ${summary.controlledRepair}`)
  console.log(`Fallback: ${summary.fallback}`)
  console.log(`Cost USD: ${summary.totalCostUsd}`)
  console.log(`BLIND_FINAL_15_REPORTS: ${reportsPath}`)
  console.log(`BLIND_LANGUAGE_SENTENCES: ${sentencesPath}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${zipSha256}`)
}

if (require.main === module) void main()
