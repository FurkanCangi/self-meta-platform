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
  type ReportSectionId,
  type ReportV2ShadowResult,
} from "../src/lib/dna/reportV2/contracts"
import { stableHash } from "../src/lib/dna/reportV2/evidenceEngine"
import { PLAIN_CLINICAL_TURKISH_VERSION } from "../src/lib/dna/reportV2/plainClinicalTurkish"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import { clinicalContentEditorTextDiagnostics } from "../src/lib/dna/reportV2/validators"
import type { ReportInput } from "../src/lib/dna/reportEngine"
import { buildHumanClinicalEditorFreshCases } from "./run-report-v2-human-clinical-editor-pass"
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

const PRIOR_CUMULATIVE_COST_MICROUSD = 988_559
const GLOBAL_COST_CAP_MICROUSD = 1_000_000
const BASELINE_REPORTS = "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260814T100249Z/BLIND_HUMAN_EDITED_REPORTS.md"
const OUTPUT_ROOT = process.env.REPORT_V2_RELEASE_CANDIDATE_OUTPUT_ROOT || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow"

const SCENARIOS: readonly Readonly<{
  pattern: string
  totals: DomainTotals
  anamnez: string
  adversarial?: boolean
  expectDiscrepancy?: boolean
}>[] = Object.freeze([
  { pattern: "rc-single-physiological", totals: [18, 43, 43, 42, 43, 42], anamnez: "Başvuru sebebi: Gece uykusu bölündüğünde sabah yüz yıkama, giyinme ve kahvaltıya geçme sırasını yarıda bırakıyor. Terapist yorumları: Dinlenmiş olduğu seansta aynı sırayı zamanında tamamladı." },
  { pattern: "rc-single-sensory", totals: [43, 18, 43, 42, 43, 42], anamnez: "Başvuru sebebi: Okul töreninde mikrofon sesi yükseldiğinde sıradan ayrılıp koridora çıkıyor. Terapist yorumları: Daha düşük sesli prova sırasında törende kalabildi." },
  { pattern: "rc-single-emotional", totals: [43, 43, 18, 42, 43, 42], anamnez: "Başvuru sebebi: Arkadaşı oyunun kuralını değiştirdiğinde oyunu bırakıyor ve geri dönmesi uzun sürüyor. Terapist yorumları: Değişiklik önceden açıklandığında kısa bir aradan sonra oyuna katıldı." },
  { pattern: "rc-single-cognitive", totals: [43, 42, 43, 18, 43, 42], anamnez: "Başvuru sebebi: Üç parçalı sınıf yönergesinde ikinci bilgiyi unutuyor ve çalışmayı yarım bırakıyor. Terapist yorumları: Yönerge iki kısa parçaya ayrıldığında çalışmayı tamamladı." },
  { pattern: "rc-single-executive", totals: [43, 42, 43, 39, 18, 43], anamnez: "Başvuru sebebi: Spor çantasını hazırlarken malzemeleri hangi sırayla koyacağını karıştırıyor. Terapist yorumları: İlk adım gösterildiğinde kalan malzemeleri doğru sırayla yerleştirdi." },
  { pattern: "rc-single-interoception", totals: [42, 43, 42, 43, 42, 18], anamnez: "Başvuru sebebi: Uzun yolculukta susama ve tuvalet ihtiyacını son ana kadar söylemiyor. Terapist yorumları: Yolculuk molasında bedenini kontrol etmesi istendiğinde ihtiyacını daha erken bildirdi." },
  { pattern: "rc-multi-domain-class-project", totals: [29, 24, 30, 26, 24, 31], anamnez: "Başvuru sebebi: Kalabalık sınıfta proje sırası değişip uzun yönerge verildiğinde işe başlayamıyor. Terapist yorumları: Sakin masada yönerge tek adım verildiğinde projenin bir bölümünü tamamladı.", adversarial: true },
  { pattern: "rc-balanced-complete", totals: [45, 44, 45, 44, 45, 44], anamnez: "Başvuru sebebi: Rutin tarama değerlendirmesi. Terapist yorumları: Grup oyunu, masa görevi, sıra bekleme ve etkinlik geçişinde yaşına uygun katılım gösterdi. Çocuğun güçlü yanları: Yardım isteyip görevine dönebiliyor.", adversarial: true },
  { pattern: "rc-uncertain-caregiver-only", totals: [37, 36, 35, 36, 35, 37], anamnez: "Başvuru sebebi: Bakım veren bazı günlerde evden çıkış ve oyun geçişlerinin uzadığını bildiriyor. Terapist gözlemi, ayrıntılı günlük yaşam örneği ve dış değerlendirme bulunmuyor.", adversarial: true },
  { pattern: "rc-caregiver-observation-disagreement", totals: [43, 43, 43, 43, 43, 43], anamnez: "Başvuru sebebi: Bakım veren markette rota değiştiğinde çocuğun alışveriş görevini bıraktığını bildiriyor. Terapist yorumları: Klinikte görev sırası değiştiğinde kısa açıklamadan sonra devam etti.", adversarial: true, expectDiscrepancy: true },
  { pattern: "rc-preserved-under-support", totals: [42, 42, 42, 38, 23, 42], anamnez: "Başvuru sebebi: Mutfak masasını toplarken tabak, bardak ve peçetelerin sırasını tamamlayamıyor. Terapist yorumları: İlk eşyanın yeri gösterildiğinde kalanlarını doğru yerlere koydu. Çocuğun güçlü yanları: Tek adımlı ev işlerini bağımsız yapıyor.", adversarial: true },
  { pattern: "rc-low-evidence", totals: [23, 42, 42, 42, 42, 42], anamnez: "Başvuru sebebi: Tarama amaçlı değerlendirme. Puan dışında günlük yaşam örneği, terapist gözlemi ve dış değerlendirme paylaşılmadı.", adversarial: true },
  { pattern: "rc-external-discrepancy", totals: [42, 23, 42, 42, 41, 42], anamnez: "Başvuru sebebi: Kapalı spor salonunda düdük sesiyle etkinliği bırakıyor. Terapist yorumları: Sessiz salonda aynı parkuru tamamladı. Ek klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: İşitsel alan tipik aralıkta | Klinik yorum: Ölçek belirgin güçlük göstermiyor.", adversarial: true, expectDiscrepancy: true },
  { pattern: "rc-mixed-caregiver-observation", totals: [41, 41, 27, 40, 27, 41], anamnez: "Başvuru sebebi: Bakım veren ev ödevinde küçük bir değişiklik olduğunda çocuğun işi bırakıp uzun süre dönmediğini bildiriyor. Terapist yorumları: Seans görevi değiştiğinde yetişkin desteğiyle yeni görevi tamamladı.", adversarial: true, expectDiscrepancy: true },
  { pattern: "rc-multi-external-discrepancy", totals: [31, 29, 30, 28, 26, 31], anamnez: "Başvuru sebebi: Sabah rutini, sınıf geçişi ve uzun görevlerde farklı düzeylerde destek gerekiyor. Terapist yorumları: Yapılandırılmış seansta katılım arttı. Ek klinik test / bulgular: Test 1: Test adı: BRIEF-P | Puan / sonuç: Planlamada klinik yükselme | Klinik yorum: Çok basamaklı görev güçlüğü. Test 2: Test adı: Vineland-3 | Puan / sonuç: Günlük yaşam yaşa uygun | Klinik yorum: Temel rutinler korunuyor.", adversarial: true, expectDiscrepancy: true },
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

export function buildClinicalContentReleaseCandidateCases(): readonly ReportV2SyntheticCase[] {
  return Object.freeze(SCENARIOS.flatMap((scenario, scenarioIndex) => [0, 1].map((variant) => {
    const ageMonths = variant === 0 ? 48 + (scenarioIndex % 12) : 60 + (scenarioIndex % 12)
    const setting = variant === 0 ? "İlk değerlendirme okul dönemi içinde yapıldı." : "İkinci yaş grubu varyantı ev ve okul bilgileri birlikte ele alınarak oluşturuldu."
    return Object.freeze({
      id: `clinical-content-rc-${String(scenarioIndex + 1).padStart(2, "0")}-${variant + 1}`,
      pattern: scenario.pattern,
      adversarial: Boolean(scenario.adversarial),
      expectDiscrepancy: Boolean(scenario.expectDiscrepancy),
      input: {
        clientCode: `CLINICAL-CONTENT-RC-${String(scenarioIndex + 1).padStart(2, "0")}-${variant + 1}`,
        ageMonths,
        anamnez: `${scenario.anamnez} ${setting}\nYaş aralığı: ${ageMonths < 60 ? "48-59 ay" : "60-71 ay"}.`,
        answers: answersForTotals(scenario.totals),
        scores: {},
      } satisfies ReportInput,
    })
  })))
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z")
}

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function fixtureHash(fixture: ReportV2SyntheticCase) {
  return stableHash({ ageMonths: fixture.input.ageMonths, anamnez: fixture.input.anamnez, answers: fixture.input.answers })
}

function assertFresh(cases: readonly ReportV2SyntheticCase[]) {
  const prior = [
    ...buildFreshReportV2Cases(), ...buildFinalLanguageQaCases(), ...buildQualityConsolidationCases(),
    ...buildConsistencyNaturalLanguageCases(), ...buildProductionReadinessCases(),
    ...buildPlainClinicalTurkishCases(), ...buildPlainIntegrationQaCases(),
    ...buildHumanReadabilityAcceptanceCases(), ...buildHumanClinicalEditorFreshCases(),
  ]
  const priorHashes = new Set(prior.map(fixtureHash))
  const hashes = cases.map(fixtureHash)
  assert.equal(cases.length, 30)
  assert.equal(new Set(hashes).size, 30, "fresh cohort contains duplicate inputs")
  assert.equal(hashes.filter((hash) => priorHashes.has(hash)).length, 0, "fresh cohort repeats a prior fixture")
  assert.ok(cases.filter((fixture) => fixture.pattern.startsWith("rc-single-")).length >= 6)
  assert.ok(cases.filter((fixture) => fixture.adversarial).length >= 15)
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
      return Object.freeze({ sectionId: `section_${index + 1}` as ReportSectionId, text: report.slice(start + heading.length, end).trim(), usedClaimIds: Object.freeze([]) })
    })),
  })))
}

function baselineMetrics(realizations: readonly ReportRealization[]) {
  return realizations.reduce<Readonly<{
    prescriptiveLeak: number
    wrongSectionGenericKnowledge: number
    otherChildExamples: number
    repeatedGenericTemplate: number
    confidenceClarityFailure: number
  }>>((sum, realization) => {
    const row = clinicalContentEditorTextDiagnostics(realization)
    return Object.freeze({
      prescriptiveLeak: sum.prescriptiveLeak + row.prescriptiveRecommendationLeakCount,
      wrongSectionGenericKnowledge: sum.wrongSectionGenericKnowledge + row.wrongSectionGenericKnowledgeTextCount,
      otherChildExamples: sum.otherChildExamples + row.otherChildExampleCount,
      repeatedGenericTemplate: sum.repeatedGenericTemplate + row.genericTemplateInjectionCount,
      confidenceClarityFailure: sum.confidenceClarityFailure + row.unexplainedConfidenceConflictCount,
    })
  }, Object.freeze({ prescriptiveLeak: 0, wrongSectionGenericKnowledge: 0, otherChildExamples: 0, repeatedGenericTemplate: 0, confidenceClarityFailure: 0 }))
}

function scoringRegression(row: RunRow) {
  const calculated = calculateAssessment(row.fixture.input.answers ?? [])
  const scores = new Map(row.result.v1.domainResults.map((domain) => [domain.key, domain.score]))
  return Number(scores.get("physiological") !== calculated.fizyolojik || scores.get("sensory") !== calculated.duyusal
    || scores.get("emotional") !== calculated.duygusal || scores.get("cognitive") !== calculated.bilissel
    || scores.get("executive") !== calculated.yurutucu || scores.get("interoception") !== calculated.intero
    || row.result.v1.totalScore !== calculated.toplam)
}

async function runCases(cohort: Cohort, cases: readonly ReportV2SyntheticCase[]) {
  const rows: RunRow[] = []
  for (const [index, fixture] of cases.entries()) {
    const result = await runReportV2Shadow(fixture.input, { literatureMode: "STANDARD" })
    assert.equal(result.providerCalls, 0)
    assert.equal(result.validation.pass, true, `${fixture.id}:${result.validation.failureCodes.join(",")}`)
    rows.push(Object.freeze({ cohort, fixture, result }))
    console.log(`clinical-content ${cohort} ${index + 1}/${cases.length}: ${fixture.id} ${result.decisionPlan.decisionState}`)
  }
  return Object.freeze(rows)
}

function metrics(rows: readonly RunRow[]) {
  const v = rows.map((row) => row.result.validation)
  return Object.freeze({
    reportCount: rows.length,
    deterministicDirect: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED" && row.result.providerCalls === 0).length,
    fallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    formulated: rows.filter((row) => row.result.decisionPlan.decisionState === "FORMULATED").length,
    uncertain: rows.filter((row) => row.result.decisionPlan.decisionState === "UNCERTAIN").length,
    discrepancy: rows.filter((row) => row.result.evidenceMatrix.discrepancyClusters.length > 0).length,
    balanced: rows.filter((row) => row.result.decisionPlan.primaryFormulation?.id === "balanced").length,
    validationFailure: v.filter((row) => !row.pass).length,
    scoringRegression: rows.reduce((sum, row) => sum + scoringRegression(row), 0),
    prescriptiveLeak: v.reduce((sum, row) => sum + row.prescriptiveRecommendationLeakCount, 0),
    wrongSectionGenericKnowledge: v.reduce((sum, row) => sum + row.wrongSectionGenericKnowledgeCount, 0),
    otherChildExamples: v.reduce((sum, row) => sum + row.otherChildExampleCount, 0),
    repeatedGenericTemplate: v.reduce((sum, row) => sum + row.genericTemplateInjectionCount, 0),
    confidenceClarityFailure: v.reduce((sum, row) => sum + row.unexplainedConfidenceConflictCount, 0),
    meaningDrift: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.meaningDriftCount, row.result.validation.meaningDriftCount), 0),
    decisionDrift: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    certaintyDrift: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.certaintyDriftCount, row.result.validation.certaintyDriftCount), 0),
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    unsupportedCausality: v.reduce((sum, row) => sum + row.unsupportedRelationCount, 0),
    semanticContradiction: v.reduce((sum, row) => sum + row.semanticContradictionCount + row.intraSectionContradictionCount + row.crossEvidenceContradictionCount + row.semanticPolarityConflictCount, 0),
    sourceRegression: v.reduce((sum, row) => sum + row.knowledgeSourceViolationCount + row.knowledgeAuthorityViolationCount + row.knowledgeCaseSpecificAdditionCount, 0),
    safetyRegression: v.filter((row) => row.failureCodes.includes("SAFETY_VIOLATION")).length,
    privacyRegression: v.reduce((sum, row) => sum + row.piiViolationCount, 0),
    omission: v.reduce((sum, row) => sum + row.omissionCount, 0),
  })
}

function blindReports(rows: readonly RunRow[]) {
  return ["# DNA Intelligence — Release Candidate Kör Raporları", "", ...rows.flatMap((row, index) => [`## RAPOR-${String(index + 1).padStart(2, "0")}`, "", row.result.finalReport, ""])].join("\n")
}

function blindSectionQa(rows: readonly RunRow[]) {
  return [
    "# DNA Intelligence — Kör Bölüm QA",
    "",
    ...rows.flatMap((row, index) => {
      const byId = new Map(row.result.realization.sections.map((section) => [section.sectionId, section.text]))
      return [
        `## RAPOR-${String(index + 1).padStart(2, "0")}`,
        "",
        REPORT_SECTION_HEADINGS[2],
        byId.get("section_3") ?? "",
        "",
        REPORT_SECTION_HEADINGS[3],
        byId.get("section_4") ?? "",
        "",
        REPORT_SECTION_HEADINGS[4],
        byId.get("section_5") ?? "",
        "",
      ]
    }),
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
  const baseline = parseBlindReports(BASELINE_REPORTS)
  const before = baselineMetrics(baseline)
  const replayCases = buildHumanClinicalEditorFreshCases()
  assert.equal(replayCases.length, 15)
  const freshCases = buildClinicalContentReleaseCandidateCases()
  assertFresh(freshCases)
  const chatPaths = ["src/lib/dna/chat", "src/app/api/dna/chat", "src/components/dna/chat"].map((entry) => path.join(process.cwd(), entry))
  const chatHashBefore = recursiveSourceHash(chatPaths)
  const replayRows = await runCases("replay", replayCases)
  const freshRows = await runCases("fresh", freshCases)
  const rows = Object.freeze([...replayRows, ...freshRows])
  const replay = metrics(replayRows)
  const fresh = metrics(freshRows)
  const combined = metrics(rows)
  assert.equal(fresh.reportCount, 30)
  assert.ok(fresh.uncertain >= 2, `uncertain_case_shortfall:${fresh.uncertain}`)
  assert.ok(fresh.balanced >= 2, `balanced_case_shortfall:${fresh.balanced}`)
  assert.ok(fresh.discrepancy >= 2, `detected_discrepancy_shortfall:${fresh.discrepancy}`)
  const zeroKeys = [
    "validationFailure", "scoringRegression", "prescriptiveLeak", "wrongSectionGenericKnowledge",
    "otherChildExamples", "repeatedGenericTemplate", "confidenceClarityFailure", "meaningDrift",
    "decisionDrift", "certaintyDrift", "unsupportedAddition", "unsupportedCausality",
    "semanticContradiction", "sourceRegression", "safetyRegression", "privacyRegression", "omission",
  ] as const
  const failed = zeroKeys.filter((key) => combined[key] !== 0)
  assert.equal(failed.length, 0, `hard_gate_failed:${failed.join(",")}`)
  const currentCostMicrousd = rows.flatMap((row) => row.result.trace.realizationAttempts).reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  assert.equal(currentCostMicrousd, 0)
  assert.ok(PRIOR_CUMULATIVE_COST_MICROUSD + currentCostMicrousd <= GLOBAL_COST_CAP_MICROUSD)

  const baselineHashes = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string }>
  const routeSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts")))
  const reportEngineSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts")))
  const productionChanged = routeSha256 !== baselineHashes.routeSha256 || reportEngineSha256 !== baselineHashes.reportEngineSha256
  assert.equal(productionChanged, false)
  const chatChangedByPass = recursiveSourceHash(chatPaths) !== chatHashBefore
  assert.equal(chatChangedByPass, false)

  const runTimestamp = timestamp()
  const outputDir = path.join(OUTPUT_ROOT, runTimestamp)
  fs.mkdirSync(outputDir, { recursive: true })
  const reportsPath = path.join(outputDir, "BLIND_RELEASE_CANDIDATE_REPORTS.md")
  const sectionQaPath = path.join(outputDir, "BLIND_SECTION_QA.md")
  const sealedPath = path.join(outputDir, "SEALED_RELEASE_CANDIDATE_EVIDENCE.jsonl")
  fs.writeFileSync(reportsPath, blindReports(freshRows), "utf8")
  fs.writeFileSync(sectionQaPath, blindSectionQa(freshRows), "utf8")
  fs.writeFileSync(sealedPath, rows.map((row) => JSON.stringify({
    cohort: row.cohort, caseId: row.fixture.id, pattern: row.fixture.pattern, inputHash: row.result.trace.inputHash,
    finalReportHash: row.result.trace.finalReportHash, decisionState: row.result.decisionPlan.decisionState,
    primaryFormulationId: row.result.decisionPlan.primaryFormulation?.id ?? null, recoveryStatus: row.result.recoveryStatus,
    validation: row.result.validation, providerCalls: row.result.providerCalls,
  })).join("\n") + "\n", "utf8")
  const zipPath = path.join(outputDir, "final-clinical-content-release-candidate-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, path.basename(reportsPath), path.basename(sectionQaPath)], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  const zipSha256 = sha256(fs.readFileSync(zipPath))
  const objective = Object.freeze({
    version: "dna-report-v2-final-clinical-content-release-candidate@1", generatedAt: new Date().toISOString(), mode: "REPORT_V2_SHADOW",
    reportVersion: REPORT_V2_VERSION, plainClinicalTurkishVersion: PLAIN_CLINICAL_TURKISH_VERSION, codexQualityScore: null,
    baselineReports: BASELINE_REPORTS, before, replay, fresh, combined,
    cost: Object.freeze({ currentRunUsd: currentCostMicrousd / 1_000_000, cumulativeUsd: (PRIOR_CUMULATIVE_COST_MICROUSD + currentCostMicrousd) / 1_000_000, globalCapUsd: 1 }),
    hardGate: Object.freeze({ passed: true, zeroKeys }), isolation: Object.freeze({ productionChanged, productionActivated: false, chatChangedByPass }),
    artifacts: Object.freeze({ reportsPath, sectionQaPath, sealedPath, zipPath, zipSha256 }),
  })
  const objectivePath = path.join(outputDir, "objective-summary.json")
  fs.writeFileSync(objectivePath, JSON.stringify(objective, null, 2) + "\n", "utf8")
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify({
    version: objective.version, generatedAt: objective.generatedAt, blindZipContents: [path.basename(reportsPath), path.basename(sectionQaPath)],
    files: [reportsPath, sectionQaPath, sealedPath, objectivePath].map((filename) => ({ filename: path.basename(filename), sha256: sha256(fs.readFileSync(filename)), bytes: fs.statSync(filename).size, includedInBlindZip: filename === reportsPath || filename === sectionQaPath })),
    zip: Object.freeze({ filename: path.basename(zipPath), sha256: zipSha256, bytes: fs.statSync(zipPath).size }),
  }, null, 2) + "\n", "utf8")
  console.log("=== REPORT V2 FINAL CLINICAL CONTENT RELEASE CANDIDATE ===")
  console.log(`Directory: ${outputDir}`)
  console.log(`Replay: ${replay.reportCount}/15 PASS`)
  console.log(`Fresh: ${fresh.reportCount}/30 PASS; uncertain=${fresh.uncertain}; balanced=${fresh.balanced}; discrepancy=${fresh.discrepancy}`)
  console.log(`Prescriptive leak: ${before.prescriptiveLeak} -> ${combined.prescriptiveLeak}`)
  console.log(`Wrong-section generic knowledge: ${before.wrongSectionGenericKnowledge} -> ${combined.wrongSectionGenericKnowledge}`)
  console.log(`Other-child examples: ${before.otherChildExamples} -> ${combined.otherChildExamples}`)
  console.log(`Repeated generic template: ${before.repeatedGenericTemplate} -> ${combined.repeatedGenericTemplate}`)
  console.log(`Confidence clarity failure: ${before.confidenceClarityFailure} -> ${combined.confidenceClarityFailure}`)
  console.log(`Fallback: replay=${replay.fallback}; fresh=${fresh.fallback}`)
  console.log(`Cost USD: ${(currentCostMicrousd / 1_000_000).toFixed(6)}; cumulative=${((PRIOR_CUMULATIVE_COST_MICROUSD + currentCostMicrousd) / 1_000_000).toFixed(6)}`)
  console.log(`BLIND_RELEASE_CANDIDATE_REPORTS: ${reportsPath}`)
  console.log(`BLIND_SECTION_QA: ${sectionQaPath}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${zipSha256}`)
}

if (require.main === module) void main()
