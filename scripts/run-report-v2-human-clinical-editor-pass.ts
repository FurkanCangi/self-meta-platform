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
  type ReportRealization,
  type ReportRealizer,
  type ReportRealizerAttempt,
  type ReportRealizerRequest,
  type ReportSectionId,
  type ReportV2ShadowResult,
} from "../src/lib/dna/reportV2/contracts"
import { stableHash } from "../src/lib/dna/reportV2/evidenceEngine"
import {
  DNA_REPORT_LUNA_MODEL,
  DNA_REPORT_LUNA_PRICING_VERSION,
  LunaReportRealizer,
} from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import {
  humanClinicalEditorDiagnostics,
  PLAIN_CLINICAL_TURKISH_VERSION,
} from "../src/lib/dna/reportV2/plainClinicalTurkish"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import type { ReportInput } from "../src/lib/dna/reportEngine"
import { buildHumanReadabilityAcceptanceCases } from "./run-report-v2-human-readability-acceptance"
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
type Cohort = "replay" | "fresh"
type RunRow = Readonly<{ cohort: Cohort; fixture: ReportV2SyntheticCase; result: ReportV2ShadowResult }>

const PRIOR_TASK_COST_MICROUSD = 444_906
const GLOBAL_COST_CAP_MICROUSD = 1_000_000
const CURRENT_RUN_COST_CAP_MICROUSD = GLOBAL_COST_CAP_MICROUSD - PRIOR_TASK_COST_MICROUSD
const BASELINE_REPORTS = "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260814T093101Z/BLIND_FINAL_15_REPORTS.md"
const OUTPUT_ROOT = process.env.REPORT_V2_HUMAN_EDITOR_OUTPUT_ROOT || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow"
const REPLAY_IDS = new Set([
  "human-readability-fresh-01", "human-readability-fresh-02", "human-readability-fresh-03",
  "human-readability-fresh-05", "human-readability-fresh-06", "human-readability-fresh-08",
  "human-readability-fresh-09", "human-readability-fresh-10", "human-readability-fresh-11",
  "human-readability-fresh-12", "human-readability-fresh-13", "human-readability-fresh-14",
  "human-readability-fresh-15", "human-readability-fresh-16", "human-readability-fresh-17",
])

const FRESH_SCENARIOS: readonly Readonly<{
  pattern: string
  ageMonths: number
  totals: DomainTotals
  anamnez: string
  adversarial?: boolean
  expectDiscrepancy?: boolean
}>[] = Object.freeze([
  {
    pattern: "editor-fresh-sensory-cafeteria",
    ageMonths: 48,
    totals: [42, 18, 41, 40, 41, 40],
    anamnez: "Başvuru sebebi: Yemekhanede tabak ve sandalye sesleri arttığında yemeğini bırakıp kapıya gidiyor. Terapist yorumları: Daha sakin bir masada yemeğini tamamladı. Çocuğun güçlü yanları: Evde aile sofrasına katılıyor.",
  },
  {
    pattern: "editor-fresh-executive-schoolbag",
    ageMonths: 51,
    totals: [41, 40, 41, 38, 19, 41],
    anamnez: "Başvuru sebebi: Okul çantasını hazırlarken defter, kalem kutusu ve beslenme çantasından birini sık sık unutuyor. Terapist yorumları: Resimli sıra kartı kullanıldığında çantasını tamamladı. Ek klinik test / bulgular: Test 1: Test adı: BRIEF-P | Puan / sonuç: Planlama ve organizasyonda klinik yükselme | Klinik yorum: Çok basamaklı günlük işlerde güçlük.",
  },
  {
    pattern: "editor-fresh-emotional-game-loss",
    ageMonths: 54,
    totals: [41, 41, 18, 40, 41, 41],
    anamnez: "Başvuru sebebi: Masa oyununda kaybettiğinde masadan ayrılıyor ve oyuna dönmesi uzun sürüyor. Terapist yorumları: Sonucun önceden konuşulduğu kısa oyunda bir aradan sonra yeniden katıldı.",
  },
  {
    pattern: "editor-fresh-physiological-after-school",
    ageMonths: 57,
    totals: [18, 41, 41, 40, 41, 41],
    anamnez: "Başvuru sebebi: Okuldan yorgun geldiği günlerde üstünü değiştirme ve akşam yemeğine geçme rutinini yarıda bırakıyor. Terapist yorumları: Kısa dinlenme sonrasında iki görevi de tamamladı.",
  },
  {
    pattern: "editor-fresh-interoception-lunch",
    ageMonths: 60,
    totals: [40, 41, 41, 41, 40, 18],
    anamnez: "Başvuru sebebi: Öğle yemeği sırasında açlık ve doygunluk sinyallerini söylemeden hızlı yemeye devam ediyor. Terapist yorumları: Yemeğin ortasında bedenini kontrol etmesi istendiğinde doyduğunu bildirdi.",
  },
  {
    pattern: "editor-fresh-cognitive-recipe",
    ageMonths: 63,
    totals: [41, 40, 41, 18, 40, 41],
    anamnez: "Başvuru sebebi: Üç adımlı meyve salatası hazırlığında sözel yönergenin ikinci adımını unutuyor. Terapist yorumları: Yönerge iki kısa parçaya ayrıldığında hazırlığı tamamladı.",
  },
  {
    pattern: "editor-fresh-mixed-museum-transition",
    ageMonths: 66,
    totals: [30, 24, 39, 34, 25, 39],
    anamnez: "Başvuru sebebi: Müzedeki kalabalık bir salondan atölyeye geçerken hem sırayı takip etmekte hem yeni göreve başlamakta zorlanıyor. Terapist yorumları: Daha sakin koridordan geçip tek adım verildiğinde atölye görevine başladı.",
    adversarial: true,
  },
  {
    pattern: "editor-fresh-balanced-sports",
    ageMonths: 69,
    totals: [45, 44, 45, 44, 44, 45],
    anamnez: "Başvuru sebebi: Rutin tarama değerlendirmesi. Terapist yorumları: Isınma, sıra bekleme, takım oyunu ve etkinlik bitişinde yaşına uygun katılım gösterdi. Çocuğun güçlü yanları: Gerektiğinde yardım isteyip oyuna devam ediyor.",
  },
  {
    pattern: "editor-fresh-interoception-context-disagreement",
    ageMonths: 50,
    totals: [42, 42, 42, 42, 42, 42],
    anamnez: "Başvuru sebebi: Bakım veren, uzun park oyununda çocuğun tuvalet ihtiyacını son ana kadar söylemediğini bildiriyor. Terapist yorumları: Klinikteki kısa etkinlik boyunca beden sinyallerini zamanında söyledi. Ek klinik test / bulgular: Test 1: Test adı: Sensory Profile 2 | Puan / sonuç: Beden farkındalığı beklenen aralıkta | Klinik yorum: Ölçek belirgin güçlük göstermiyor.",
    adversarial: true,
    expectDiscrepancy: true,
  },
  {
    pattern: "editor-fresh-emotional-external-disagreement",
    ageMonths: 53,
    totals: [40, 41, 23, 41, 40, 41],
    anamnez: "Başvuru sebebi: Planlanan oyun iptal olduğunda ağlıyor ve başka bir etkinliğe geçemiyor. Terapist yorumları: Seçeneklerden biri gösterildiğinde yeni oyuna katıldı. Ek klinik test / bulgular: Test 1: Test adı: CBCL | Puan / sonuç: Duygusal tepkisellik normal aralıkta | Klinik yorum: Ölçek klinik yükselme göstermiyor.",
    adversarial: true,
    expectDiscrepancy: true,
  },
  {
    pattern: "editor-fresh-low-evidence-cognitive",
    ageMonths: 56,
    totals: [41, 41, 41, 22, 41, 41],
    anamnez: "Başvuru sebebi: Genel değerlendirme talebi. Günlük yaşam örneği, terapist gözlemi ve dış test sonucu paylaşılmadı.",
    adversarial: true,
  },
  {
    pattern: "editor-fresh-preserved-emotional-support",
    ageMonths: 59,
    totals: [41, 41, 24, 41, 41, 40],
    anamnez: "Başvuru sebebi: Etkinlik sırası değiştiğinde kısa süre oyundan ayrılıyor. Terapist yorumları: Değişiklik açıklanıp iki seçenek sunulduğunda yeniden katıldı. Çocuğun güçlü yanları: Tanıdığı rutinlerde bekleyebiliyor ve yardım isteyebiliyor.",
    adversarial: true,
  },
  {
    pattern: "editor-fresh-physiological-emotional-mixed",
    ageMonths: 62,
    totals: [25, 41, 26, 41, 40, 41],
    anamnez: "Başvuru sebebi: Uykusuz kaldığı sabahlarda evden çıkış geciktiğinde sakinleşmesi ve hazırlığa dönmesi uzun sürüyor. Terapist yorumları: İyi uyuduğu gün aynı değişiklikten sonra kısa açıklamayla hazırlığa devam etti.",
    adversarial: true,
  },
  {
    pattern: "editor-fresh-cognitive-source-disagreement",
    ageMonths: 65,
    totals: [42, 42, 42, 42, 42, 42],
    anamnez: "Başvuru sebebi: Bakım veren, alışveriş listesindeki iki sözel bilgiyi akılda tutamadığını bildiriyor. Terapist yorumları: Klinikte iki aşamalı yönergeyi bağımsız tamamladı. Ek klinik test / bulgular: Test 1: Test adı: WPPSI-IV Çalışma Belleği | Puan / sonuç: Yaşa uygun aralık | Klinik yorum: Yapılandırılmış testte güçlük saptanmadı.",
    adversarial: true,
    expectDiscrepancy: true,
  },
  {
    pattern: "editor-fresh-sensory-external-conflict",
    ageMonths: 68,
    totals: [40, 21, 41, 40, 41, 40],
    anamnez: "Başvuru sebebi: Kuaförde saç kesme makinesi çalıştığında koltuktan kalkıp işlemi yarıda bırakıyor. Terapist yorumları: Makine sesi kayıttan düşük düzeyde verildiğinde masadaki etkinliği tamamladı. Ek klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: İşitsel işlemleme tipik aralıkta | Klinik yorum: Ölçek belirgin güçlük göstermiyor.",
    adversarial: true,
    expectDiscrepancy: true,
  },
])

function scoredItemsForTotal(total: number): number[] {
  const bounded = Math.max(10, Math.min(50, Math.round(total)))
  const base = Math.floor(bounded / 10)
  const remainder = bounded - base * 10
  return Array.from({ length: 10 }, (_, index) => Math.max(1, Math.min(5, base + (index < remainder ? 1 : 0))))
}

function answersForTotals(totals: DomainTotals): number[] {
  return totals.flatMap(scoredItemsForTotal).map((value, index) => getItemScoringDirection(index + 1) === "reverse" ? 6 - value : value)
}

export function buildHumanClinicalEditorFreshCases(): readonly ReportV2SyntheticCase[] {
  return Object.freeze(FRESH_SCENARIOS.map((scenario, index) => Object.freeze({
    id: `human-editor-fresh-${String(index + 1).padStart(2, "0")}`,
    pattern: scenario.pattern,
    adversarial: Boolean(scenario.adversarial),
    expectDiscrepancy: Boolean(scenario.expectDiscrepancy),
    input: {
      clientCode: `HUMAN-EDITOR-${String(index + 1).padStart(2, "0")}`,
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
    const fullPath = path.join(process.cwd(), filename)
    if (!fs.existsSync(fullPath)) continue
    const line = fs.readFileSync(fullPath, "utf8").split(/\r?\n/u).find((row) => /^OPENAI_API_KEY\s*=/u.test(row))
    const value = line?.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/gu, "")
    if (value) return value
  }
  return undefined
}

function fixtureHash(fixture: ReportV2SyntheticCase) {
  return stableHash({ ageMonths: fixture.input.ageMonths, anamnez: fixture.input.anamnez, answers: fixture.input.answers })
}

function assertFresh(cases: readonly ReportV2SyntheticCase[]) {
  const prior = [
    ...buildFreshReportV2Cases(), ...buildFinalLanguageQaCases(), ...buildQualityConsolidationCases(),
    ...buildConsistencyNaturalLanguageCases(), ...buildProductionReadinessCases(),
    ...buildPlainClinicalTurkishCases(), ...buildPlainIntegrationQaCases(),
    ...buildHumanReadabilityAcceptanceCases(),
  ]
  const priorHashes = new Set(prior.map(fixtureHash))
  const hashes = cases.map(fixtureHash)
  assert.equal(cases.length, 15)
  assert.equal(new Set(hashes).size, 15, "fresh cohort contains duplicate inputs")
  assert.equal(hashes.filter((hash) => priorHashes.has(hash)).length, 0, "fresh cohort repeats a prior fixture")
}

function parseBlindReports(filename: string): readonly ReportRealization[] {
  const text = fs.readFileSync(filename, "utf8")
  const chunks = text.split(/^## RAPOR-\d+\s*$/gmu).slice(1).map((value) => value.trim()).filter(Boolean)
  assert.equal(chunks.length, 15, "baseline report count")
  return Object.freeze(chunks.map((report) => Object.freeze({
    version: "report-realization@2" as const,
    unsupportedAddition: false,
    unsupportedSectionIds: Object.freeze([]),
    sections: Object.freeze(REPORT_SECTION_HEADINGS.map((heading, index) => {
      const start = report.indexOf(heading)
      const end = index + 1 < REPORT_SECTION_HEADINGS.length ? report.indexOf(REPORT_SECTION_HEADINGS[index + 1]!) : report.length
      assert.ok(start >= 0 && end > start, `baseline heading missing:${heading}`)
      return Object.freeze({
        sectionId: `section_${index + 1}` as ReportSectionId,
        text: report.slice(start + heading.length, end).trim(),
        usedClaimIds: Object.freeze([]),
      })
    })),
  })))
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

function rowsFromCheckpoint(filename: string, cases: readonly Readonly<{ cohort: Cohort; fixture: ReportV2SyntheticCase }>[]) {
  if (!fs.existsSync(filename) || !fs.readFileSync(filename, "utf8").trim()) return Object.freeze([] as RunRow[])
  const byKey = new Map(cases.map((entry) => [`${entry.cohort}:${entry.fixture.id}`, entry.fixture]))
  const rows = new Map<string, RunRow>()
  fs.readFileSync(filename, "utf8").trim().split(/\n/u).filter(Boolean).forEach((line) => {
    const parsed = JSON.parse(line) as Readonly<{ cohort: Cohort; caseId: string; result: ReportV2ShadowResult }>
    const fixture = byKey.get(`${parsed.cohort}:${parsed.caseId}`)
    if (!fixture) throw new Error(`checkpoint_fixture_missing:${parsed.cohort}:${parsed.caseId}`)
    rows.set(`${parsed.cohort}:${parsed.caseId}`, Object.freeze({ cohort: parsed.cohort, fixture, result: parsed.result }))
  })
  return Object.freeze([...rows.values()])
}

function measuredCost(rows: readonly RunRow[]) {
  return rows.flatMap((row) => row.result.trace.realizationAttempts)
    .filter((attempt) => attempt.provider === "luna")
    .reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
}

async function runPending(
  entries: readonly Readonly<{ cohort: Cohort; fixture: ReportV2SyntheticCase }>[],
  checkpoint: string,
  already: readonly RunRow[],
) {
  const measuredAlready = already.filter((row) => row.result.trace.realizationAttempts.some((attempt) => attempt.provider === "luna" && (attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0)))
  let spent = measuredCost(measuredAlready)
  assert.ok(spent < CURRENT_RUN_COST_CAP_MICROUSD, "checkpoint exhausted current cost cap")
  const apiKey = loadLocalApiKey()
  if (!apiKey) throw new Error("OPENAI_API_KEY unavailable")
  const completed = new Set(measuredAlready.map((row) => `${row.cohort}:${row.fixture.id}`))
  const rows: RunRow[] = [...measuredAlready]
  const pending = entries.filter((entry) => !completed.has(`${entry.cohort}:${entry.fixture.id}`))
  for (const [index, entry] of pending.entries()) {
    const remainingCases = pending.length - index
    assert.ok(CURRENT_RUN_COST_CAP_MICROUSD - spent >= remainingCases * 10_000, "insufficient measured budget reserve")
    const base = new LunaReportRealizer({
      apiKey,
      safetyIdentifier: "report-v2-final-human-clinical-editor-pass-30",
      maxTotalCostMicrousd: 50_000,
    })
    const realizer: ReportRealizer = Object.freeze({
      identity: base.identity,
      realize: async (request: ReportRealizerRequest): Promise<ReportRealizerAttempt> => {
        if (request.attempt !== "repair") return base.realize(request)
        return Object.freeze({
          ...base.identity,
          attempt: request.attempt,
          realization: null,
          rawOutput: null,
          responseId: null,
          usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
          latencyMs: 0,
          promptHash: stableHash({ singleMeasuredCall: true, request }),
        })
      },
    })
    const result = await runReportV2Shadow(entry.fixture.input, { realizer, literatureMode: "STANDARD" })
    assertHeadingContract(result.finalReport)
    const row = Object.freeze({ cohort: entry.cohort, fixture: entry.fixture, result })
    rows.push(row)
    spent += measuredCost([row])
    assert.ok(spent <= CURRENT_RUN_COST_CAP_MICROUSD, "current hard cost cap exceeded during run")
    fs.appendFileSync(checkpoint, JSON.stringify({ cohort: entry.cohort, caseId: entry.fixture.id, result }) + "\n", "utf8")
    console.log(`human-editor ${index + 1}/${pending.length}: ${entry.cohort} ${entry.fixture.id} ${result.recoveryStatus} calls=${result.providerCalls}`)
  }
  return Object.freeze(rows)
}

function scoringRegression(row: RunRow) {
  const calculated = calculateAssessment(row.fixture.input.answers ?? [])
  const scores = new Map(row.result.v1.domainResults.map((domain) => [domain.key, domain.score]))
  return Number(
    scores.get("physiological") !== calculated.fizyolojik || scores.get("sensory") !== calculated.duyusal
    || scores.get("emotional") !== calculated.duygusal || scores.get("cognitive") !== calculated.bilissel
    || scores.get("executive") !== calculated.yurutucu || scores.get("interoception") !== calculated.intero
    || row.result.v1.totalScore !== calculated.toplam
  )
}

function metrics(rows: readonly RunRow[]) {
  const attempts = rows.flatMap((row) => row.result.trace.realizationAttempts).filter((attempt) => attempt.provider === "luna")
  const measuredReports = rows.filter((row) => row.result.trace.realizationAttempts.some((attempt) => attempt.provider === "luna" && (attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0))).length
  return Object.freeze({
    reportCount: rows.length,
    direct: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length,
    controlledRepair: rows.filter((row) => ["CONTROLLED_REPAIR", "LUNA_REPAIRED"].includes(row.result.recoveryStatus)).length,
    lunaRepaired: rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length,
    fallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    measuredReports,
    providerCalls: attempts.length,
    costMicrousd: attempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0),
    validationFailure: rows.filter((row) => !row.result.validation.pass).length,
    scoringRegression: rows.reduce((sum, row) => sum + scoringRegression(row), 0),
    semanticParagraphRepetition: rows.reduce((sum, row) => sum + row.result.validation.semanticParagraphRepetitionCount, 0),
    systemLikeProse: rows.reduce((sum, row) => sum + row.result.validation.humanEditorSystemLikeProseCount + row.result.validation.systemLikeLanguageCount, 0),
    grammarError: rows.reduce((sum, row) => sum + row.result.validation.plainTurkishGrammarErrorCount + row.result.validation.grammarFragmentCount + row.result.validation.brokenSuffixCount + row.result.validation.duplicateSuffixCount + row.result.validation.sentenceMergeErrorCount + row.result.validation.brokenWordCount, 0),
    semanticContradiction: rows.reduce((sum, row) => sum + row.result.validation.semanticContradictionCount + row.result.validation.intraSectionContradictionCount + row.result.validation.crossEvidenceContradictionCount + row.result.validation.semanticPolarityConflictCount, 0),
    nonMaterialReentry: rows.reduce((sum, row) => sum + row.result.validation.nonMaterialKnowledgeReentryCount, 0),
    decisionDrift: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    meaningDrift: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.meaningDriftCount, row.result.validation.meaningDriftCount), 0),
    certaintyDrift: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.certaintyDriftCount, row.result.validation.certaintyDriftCount), 0),
    newSpecificity: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.newSpecificityCount, row.result.validation.newSpecificityCount), 0),
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    sourceRegression: rows.reduce((sum, row) => sum + row.result.validation.knowledgeSourceViolationCount + row.result.validation.knowledgeAuthorityViolationCount + row.result.validation.knowledgeCaseSpecificAdditionCount, 0),
    safetyRegression: rows.filter((row) => row.result.validation.failureCodes.includes("SAFETY_VIOLATION")).length,
    privacyRegression: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    omission: rows.reduce((sum, row) => sum + row.result.validation.omissionCount + row.result.validation.missingImportantClaimIds.length, 0),
    headingFailure: rows.filter((row) => REPORT_SECTION_HEADINGS.some((heading) => row.result.finalReport.split(heading).length !== 2)).length,
  })
}

function blindReports(rows: readonly RunRow[]) {
  return [
    "# DNA Intelligence — İnsan Klinik Editör Geçişi Kör Raporları",
    "",
    ...rows.flatMap((row, index) => [`## RAPOR-${String(index + 1).padStart(2, "0")}`, "", row.result.finalReport, ""]),
  ].join("\n")
}

function beforeAfterParagraphs(rows: readonly RunRow[]) {
  const seen = new Set<string>()
  const pairs = rows.flatMap((row) => row.result.plainClinicalTurkish.records).flatMap((record) => {
    const before = record.before.trim()
    const after = record.after.trim()
    const key = `${before}\n---\n${after}`
    if (!before || !after || before === after || before.length < 45 || after.length < 45 || seen.has(key)) return []
    seen.add(key)
    return [Object.freeze({ before, after })]
  })
  assert.ok(pairs.length >= 50, `before_after_paragraph_shortfall:${pairs.length}`)
  return [
    "# DNA Intelligence — Kör Önce / Sonra Paragrafları",
    "",
    ...pairs.slice(0, Math.max(50, Math.min(75, pairs.length))).flatMap((pair, index) => [
      `## ÖRNEK-${String(index + 1).padStart(3, "0")}`,
      "",
      "BEFORE",
      "",
      pair.before,
      "",
      "AFTER",
      "",
      pair.after,
      "",
    ]),
  ].join("\n")
}

function recursiveSourceHash(paths: readonly string[]) {
  const files: string[] = []
  const visit = (entry: string) => {
    if (!fs.existsSync(entry)) return
    const stat = fs.statSync(entry)
    if (stat.isDirectory()) fs.readdirSync(entry).sort().forEach((child) => visit(path.join(entry, child)))
    else if (stat.isFile()) files.push(entry)
  }
  paths.forEach(visit)
  return sha256(files.sort().map((filename) => `${path.relative(process.cwd(), filename)}:${sha256(fs.readFileSync(filename))}`).join("\n"))
}

async function main() {
  const replay = buildHumanReadabilityAcceptanceCases().filter((fixture) => REPLAY_IDS.has(fixture.id))
  assert.equal(replay.length, 15, "replay cohort count")
  const fresh = buildHumanClinicalEditorFreshCases()
  assertFresh(fresh)
  const baseline = parseBlindReports(BASELINE_REPORTS)
  const beforeDiagnostics = baseline.reduce<Readonly<{ semanticParagraphRepetition: number; systemLikeProse: number }>>((sum, realization) => {
    const diagnostic = humanClinicalEditorDiagnostics(realization)
    return Object.freeze({
      semanticParagraphRepetition: sum.semanticParagraphRepetition + diagnostic.semanticParagraphRepetitionCount,
      systemLikeProse: sum.systemLikeProse + diagnostic.systemLikeProseCount,
    })
  }, Object.freeze({ semanticParagraphRepetition: 0, systemLikeProse: 0 }))

  const chatPaths = ["src/lib/dna/chat", "src/app/api/dna/chat", "src/components/dna/chat"].map((entry) => path.join(process.cwd(), entry))
  const chatHashBefore = recursiveSourceHash(chatPaths)
  const entries = Object.freeze([
    ...replay.map((fixture) => Object.freeze({ cohort: "replay" as const, fixture })),
    ...fresh.map((fixture) => Object.freeze({ cohort: "fresh" as const, fixture })),
  ])
  const suppliedCheckpoint = process.env.REPORT_V2_HUMAN_EDITOR_CHECKPOINT?.trim()
  const runTimestamp = timestamp()
  const checkpoint = suppliedCheckpoint || path.join("/tmp", `report-v2-human-editor-${runTimestamp}.jsonl`)
  if (!suppliedCheckpoint) fs.writeFileSync(checkpoint, "", "utf8")
  const priorRows = rowsFromCheckpoint(checkpoint, entries)
  const rows = await runPending(entries, checkpoint, priorRows)
  assert.equal(rows.length, 30, "combined cohort count")
  const replayRows = rows.filter((row) => row.cohort === "replay").sort((left, right) => left.fixture.id.localeCompare(right.fixture.id))
  const freshRows = rows.filter((row) => row.cohort === "fresh").sort((left, right) => left.fixture.id.localeCompare(right.fixture.id))
  assert.equal(replayRows.length, 15)
  assert.equal(freshRows.length, 15)

  const replayMetrics = metrics(replayRows)
  const freshMetrics = metrics(freshRows)
  const combinedMetrics = metrics(rows)
  const currentCostMicrousd = combinedMetrics.costMicrousd
  const cumulativeCostMicrousd = PRIOR_TASK_COST_MICROUSD + currentCostMicrousd
  assert.ok(currentCostMicrousd <= CURRENT_RUN_COST_CAP_MICROUSD, "current hard cost cap exceeded")
  assert.ok(cumulativeCostMicrousd <= GLOBAL_COST_CAP_MICROUSD, "global one-dollar cost cap exceeded")
  assert.equal(replayMetrics.measuredReports, 15, "replay real-pipeline shortfall")
  assert.equal(freshMetrics.measuredReports, 15, "fresh real-pipeline shortfall")

  const zeroKeys = [
    "validationFailure", "scoringRegression", "semanticParagraphRepetition", "systemLikeProse",
    "grammarError", "semanticContradiction", "nonMaterialReentry", "decisionDrift", "meaningDrift",
    "certaintyDrift", "newSpecificity", "unsupportedAddition", "sourceRegression", "safetyRegression",
    "privacyRegression", "omission", "headingFailure",
  ] as const
  const failedKeys = zeroKeys.filter((key) => combinedMetrics[key] !== 0)
  assert.equal(failedKeys.length, 0, `hard_gate_failed:${failedKeys.join(",")}`)

  const baselineHashes = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string }>
  const routeSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts")))
  const reportEngineSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts")))
  const productionChanged = routeSha256 !== baselineHashes.routeSha256 || reportEngineSha256 !== baselineHashes.reportEngineSha256
  assert.equal(productionChanged, false, "production baseline changed")
  const chatHashAfter = recursiveSourceHash(chatPaths)
  const chatChangedByPass = chatHashAfter !== chatHashBefore
  assert.equal(chatChangedByPass, false, "chat changed during pass")

  const outputDir = path.join(OUTPUT_ROOT, runTimestamp)
  fs.mkdirSync(outputDir, { recursive: true })
  const reportsPath = path.join(outputDir, "BLIND_HUMAN_EDITED_REPORTS.md")
  const beforeAfterPath = path.join(outputDir, "BLIND_BEFORE_AFTER_PARAGRAPHS.md")
  const sealedPath = path.join(outputDir, "SEALED_HUMAN_CLINICAL_EDITOR_EVIDENCE.jsonl")
  fs.writeFileSync(reportsPath, blindReports(freshRows), "utf8")
  fs.writeFileSync(beforeAfterPath, beforeAfterParagraphs(replayRows), "utf8")
  fs.writeFileSync(sealedPath, rows.map((row) => JSON.stringify({
    cohort: row.cohort,
    caseId: row.fixture.id,
    inputHash: row.result.trace.inputHash,
    finalReportHash: row.result.trace.finalReportHash,
    recoveryStatus: row.result.recoveryStatus,
    providerCalls: row.result.providerCalls,
    decisionHashBeforeKnowledge: row.result.trace.decisionHashBeforeKnowledge,
    decisionHashAfterKnowledge: row.result.trace.decisionHashAfterKnowledge,
    validation: row.result.validation,
    realizationAttempts: row.result.trace.realizationAttempts,
  })).join("\n") + "\n", "utf8")

  const zipPath = path.join(outputDir, "final-human-clinical-editor-pass-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, path.basename(reportsPath), path.basename(beforeAfterPath)], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  const zipSha256 = sha256(fs.readFileSync(zipPath))
  const objective = Object.freeze({
    version: "dna-report-v2-final-human-clinical-editor-pass@1",
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    reportVersion: REPORT_V2_VERSION,
    plainClinicalTurkishVersion: PLAIN_CLINICAL_TURKISH_VERSION,
    model: DNA_REPORT_LUNA_MODEL,
    pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION,
    codexLanguageScore: null,
    baselineReports: BASELINE_REPORTS,
    before: beforeDiagnostics,
    replay: replayMetrics,
    fresh: freshMetrics,
    combined: combinedMetrics,
    cost: Object.freeze({
      priorTaskUsd: PRIOR_TASK_COST_MICROUSD / 1_000_000,
      currentRunUsd: currentCostMicrousd / 1_000_000,
      cumulativeUsd: cumulativeCostMicrousd / 1_000_000,
      currentCapUsd: CURRENT_RUN_COST_CAP_MICROUSD / 1_000_000,
      globalCapUsd: GLOBAL_COST_CAP_MICROUSD / 1_000_000,
    }),
    hardGate: Object.freeze({ passed: true, zeroKeys }),
    isolation: Object.freeze({ productionChanged, productionActivated: false, chatChangedByPass }),
    artifacts: Object.freeze({ reportsPath, beforeAfterPath, sealedPath, zipPath, zipSha256 }),
  })
  const objectivePath = path.join(outputDir, "objective-summary.json")
  fs.writeFileSync(objectivePath, JSON.stringify(objective, null, 2) + "\n", "utf8")
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify({
    version: objective.version,
    generatedAt: objective.generatedAt,
    blindZipContents: [path.basename(reportsPath), path.basename(beforeAfterPath)],
    files: [reportsPath, beforeAfterPath, sealedPath, objectivePath].map((filename) => ({
      filename: path.basename(filename),
      sha256: sha256(fs.readFileSync(filename)),
      bytes: fs.statSync(filename).size,
      includedInBlindZip: filename === reportsPath || filename === beforeAfterPath,
    })),
    zip: Object.freeze({ filename: path.basename(zipPath), sha256: zipSha256, bytes: fs.statSync(zipPath).size }),
  }, null, 2) + "\n", "utf8")

  console.log("=== REPORT V2 FINAL HUMAN CLINICAL EDITOR PASS ===")
  console.log(`Checkpoint: ${checkpoint}`)
  console.log(`Directory: ${outputDir}`)
  console.log(`Replay: direct=${replayMetrics.direct} controlled=${replayMetrics.controlledRepair} fallback=${replayMetrics.fallback}`)
  console.log(`Fresh: direct=${freshMetrics.direct} controlled=${freshMetrics.controlledRepair} fallback=${freshMetrics.fallback}`)
  console.log(`Semantic paragraph repetition: ${beforeDiagnostics.semanticParagraphRepetition} -> ${combinedMetrics.semanticParagraphRepetition}`)
  console.log(`System-like prose: ${beforeDiagnostics.systemLikeProse} -> ${combinedMetrics.systemLikeProse}`)
  console.log(`Current cost USD: ${(currentCostMicrousd / 1_000_000).toFixed(6)}`)
  console.log(`Cumulative cost USD: ${(cumulativeCostMicrousd / 1_000_000).toFixed(6)}`)
  console.log(`BLIND_HUMAN_EDITED_REPORTS: ${reportsPath}`)
  console.log(`BLIND_BEFORE_AFTER_PARAGRAPHS: ${beforeAfterPath}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${zipSha256}`)
}

if (require.main === module) void main()
