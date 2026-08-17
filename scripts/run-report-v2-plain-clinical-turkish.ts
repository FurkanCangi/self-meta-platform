import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { REPORT_SECTION_HEADINGS, REPORT_V2_VERSION, type ReportRealization, type ReportSectionId, type ReportV2ShadowResult } from "../src/lib/dna/reportV2/contracts"
import { DNA_REPORT_LANGUAGE_CONTRACT_VERSION, reportLanguageDiagnostics } from "../src/lib/dna/reportV2/languageContract"
import { DNA_REPORT_LUNA_MODEL, DNA_REPORT_LUNA_PRICING_VERSION, LunaReportRealizer } from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { plainClinicalLanguageDiagnostics, plainClinicalRepetitionCount, PLAIN_CLINICAL_TURKISH_VERSION } from "../src/lib/dna/reportV2/plainClinicalTurkish"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import { buildPlainClinicalTurkishCases, buildProductionReadinessCases, type ReportV2SyntheticCase } from "./report-v2-cases"

type Cohort = "replay-50" | "fresh-30"
type EvaluationRow = Readonly<{ cohort: Cohort; fixture: ReportV2SyntheticCase; result: ReportV2ShadowResult }>
type PriorDecision = Readonly<{ decisionState: unknown; primary: unknown; confidence: unknown }>

const BASELINE_DIR = process.env.REPORT_V2_PLAIN_TURKISH_BASELINE_DIR
  || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260812T132522Z"
const COST_CAP_MICROUSD = 4_000_000

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z")
}

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function percentile(values: readonly number[], ratio: number) {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return Number(ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * ratio) - 1))]!.toFixed(2))
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

function priorDecisions() {
  const filename = path.join(BASELINE_DIR, "SEALED_FINAL_REPORT_EVIDENCE.jsonl")
  const result = new Map<string, PriorDecision>()
  for (const line of fs.readFileSync(filename, "utf8").trim().split(/\n/u).filter(Boolean)) {
    const row = JSON.parse(line) as Readonly<{ caseId: string; decisionState: unknown; primary: unknown; confidence: unknown }>
    result.set(row.caseId, Object.freeze({ decisionState: row.decisionState, primary: row.primary, confidence: row.confidence }))
  }
  return result
}

function parseReport(report: string): ReportRealization {
  const offsets = REPORT_SECTION_HEADINGS.map((heading) => report.indexOf(heading))
  assert.ok(offsets.every((offset, index) => offset >= 0 && (index === 0 || offset > offsets[index - 1]!)), "baseline heading contract")
  return Object.freeze({
    version: "report-realization@2",
    unsupportedAddition: false,
    unsupportedSectionIds: Object.freeze([]),
    sections: Object.freeze(REPORT_SECTION_HEADINGS.map((heading, index) => Object.freeze({
      sectionId: `section_${index + 1}` as ReportSectionId,
      text: report.slice(offsets[index]! + heading.length, index + 1 < offsets.length ? offsets[index + 1]! : report.length).trim(),
      usedClaimIds: Object.freeze([]),
    }))),
  })
}

function baselineReports() {
  const source = fs.readFileSync(path.join(BASELINE_DIR, "BLIND_FINAL_REPORTS.md"), "utf8")
  return source.split(/^## BLIND-\d+\s*$/gmu).slice(1).map((report) => report.trim()).filter(Boolean)
}

function baselineLanguageMetrics() {
  const reports = baselineReports()
  assert.equal(reports.length, 50)
  const realizations = reports.map(parseReport)
  return Object.freeze({
    reportCount: reports.length,
    nominalizationOverload: realizations.reduce((sum, realization) => sum + plainClinicalLanguageDiagnostics(realization).nominalizationOverloadCount, 0),
    abstractLanguageTrigger: realizations.reduce((sum, realization) => sum + plainClinicalLanguageDiagnostics(realization).abstractClinicalLanguageCount + plainClinicalLanguageDiagnostics(realization).unclearAgentCount + plainClinicalLanguageDiagnostics(realization).unclearDailyLifeMeaningCount, 0),
    grammarError: reports.reduce((sum, report) => {
      const item = reportLanguageDiagnostics(report)
      return sum + item.brokenSuffixCount + item.duplicateSuffixCount + item.sentenceMergeErrorCount + item.brokenWordCount
    }, 0),
    terminologyDrift: reports.reduce((sum, report) => sum + reportLanguageDiagnostics(report).terminologyDriftCount, 0),
    repetition: realizations.reduce((sum, realization) => sum + plainClinicalRepetitionCount(realization), 0),
  })
}

function rowsFromCheckpoint(cases: readonly Readonly<{ cohort: Cohort; fixture: ReportV2SyntheticCase }>[], checkpoint: string): readonly EvaluationRow[] {
  const byId = new Map(cases.map((entry) => [entry.fixture.id, entry]))
  const rows = fs.readFileSync(checkpoint, "utf8").trim().split(/\n/u).filter(Boolean).map((line) => {
    const parsed = JSON.parse(line) as Readonly<{ caseId: string; result: ReportV2ShadowResult }>
    const entry = byId.get(parsed.caseId)
    if (!entry) throw new Error(`checkpoint_fixture_missing:${parsed.caseId}`)
    return Object.freeze({ cohort: entry.cohort, fixture: entry.fixture, result: parsed.result })
  })
  assert.equal(rows.length, cases.length)
  assert.equal(new Set(rows.map((row) => row.fixture.id)).size, cases.length)
  return Object.freeze(rows)
}

async function runCases(cases: readonly Readonly<{ cohort: Cohort; fixture: ReportV2SyntheticCase }>[], checkpoint: string) {
  const apiKey = loadLocalApiKey()
  if (!apiKey) throw new Error("OPENAI_API_KEY unavailable")
  const realizer = new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2-plain-clinical-turkish-80", maxTotalCostMicrousd: COST_CAP_MICROUSD })
  const rows: EvaluationRow[] = []
  for (const [index, entry] of cases.entries()) {
    const result = await runReportV2Shadow(entry.fixture.input, { realizer, literatureMode: "STANDARD" })
    const row = Object.freeze({ cohort: entry.cohort, fixture: entry.fixture, result })
    rows.push(row)
    fs.appendFileSync(checkpoint, JSON.stringify({ cohort: entry.cohort, caseId: entry.fixture.id, result }) + "\n", "utf8")
    console.log(`plain-clinical ${index + 1}/${cases.length}: ${entry.fixture.id} ${result.recoveryStatus} calls=${result.providerCalls}`)
  }
  return Object.freeze(rows)
}

function decisionDrift(rows: readonly EvaluationRow[], baseline: ReadonlyMap<string, PriorDecision>) {
  return rows.reduce((sum, row) => {
    const knowledgeDrift = row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge
    if (row.cohort === "fresh-30") return sum + Number(knowledgeDrift)
    const prior = baseline.get(row.fixture.id)
    assert.ok(prior, `prior decision missing: ${row.fixture.id}`)
    const replayDrift = prior.decisionState !== row.result.decisionPlan.decisionState
      || prior.primary !== (row.result.decisionPlan.primaryFormulation?.id ?? null)
      || prior.confidence !== row.result.decisionPlan.confidence.level
    return sum + Number(knowledgeDrift || replayDrift)
  }, 0)
}

function metrics(rows: readonly EvaluationRow[], baseline: ReadonlyMap<string, PriorDecision>) {
  const attempts = rows.flatMap((row) => row.result.trace.realizationAttempts).filter((attempt) => attempt.provider === "luna")
  const measuredAttempts = attempts.filter((attempt) => attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0)
  const reportLatencies = rows.map((row) => row.result.trace.realizationAttempts.filter((attempt) => attempt.provider === "luna").reduce((sum, attempt) => sum + attempt.latencyMs, 0))
  const totalCostMicrousd = measuredAttempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  return Object.freeze({
    reportCount: rows.length,
    scoringRegression: rows.reduce((sum, row) => sum + scoringRegression(row.fixture, row.result), 0),
    meaningDrift: rows.reduce((sum, row) => sum + row.result.plainClinicalTurkish.meaningDriftCount + row.result.validation.meaningDriftCount, 0),
    decisionDrift: decisionDrift(rows, baseline),
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    grammarError: rows.reduce((sum, row) => sum + row.result.validation.brokenSuffixCount + row.result.validation.duplicateSuffixCount + row.result.validation.sentenceMergeErrorCount + row.result.validation.brokenWordCount + row.result.validation.literatureFormattingErrorCount, 0),
    terminologyDrift: rows.reduce((sum, row) => sum + row.result.validation.terminologyDriftCount, 0),
    repetition: rows.reduce((sum, row) => sum + row.result.validation.crossSectionRepetitionCount + row.result.validation.semanticCrossSectionRepeatCount + plainClinicalRepetitionCount(row.result.realization), 0),
    nominalizationOverload: rows.reduce((sum, row) => sum + row.result.validation.nominalizationOverloadCount, 0),
    abstractLanguageTrigger: rows.reduce((sum, row) => sum + row.result.validation.abstractClinicalLanguageCount + row.result.validation.unclearAgentCount + row.result.validation.unclearDailyLifeMeaningCount, 0),
    internalJargon: rows.reduce((sum, row) => sum + row.result.validation.internalEngineJargonCount + row.result.validation.internalLabelLeakageCount + row.result.validation.systemLikeLanguageCount, 0),
    sourceRegression: rows.reduce((sum, row) => sum + row.result.validation.knowledgeSourceViolationCount + row.result.validation.knowledgeAuthorityViolationCount, 0),
    safetyRegression: rows.filter((row) => row.result.validation.failureCodes.includes("SAFETY_VIOLATION")).length,
    privacyRegression: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    direct: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length,
    controlledRepair: rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR").length,
    lunaRepaired: rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length,
    fallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    rewriteCount: rows.reduce((sum, row) => sum + row.result.plainClinicalTurkish.rewriteCount, 0),
    providerCalls: rows.reduce((sum, row) => sum + row.result.providerCalls, 0),
    measuredCalls: measuredAttempts.length,
    p50LatencyMs: percentile(reportLatencies, 0.5),
    p95LatencyMs: percentile(reportLatencies, 0.95),
    totalCostUsd: Number((totalCostMicrousd / 1_000_000).toFixed(6)),
    costPerReportUsd: Number((totalCostMicrousd / Math.max(1, rows.length) / 1_000_000).toFixed(6)),
  })
}

function blindMarkdown(rows: readonly EvaluationRow[]) {
  const fresh = rows.filter((row) => row.cohort === "fresh-30")
  return [
    "# DNA Intelligence — Plain Clinical Turkish Kör Raporları",
    "",
    ...fresh.flatMap((row, index) => [`## RAPOR-${String(index + 1).padStart(2, "0")}`, "", row.result.finalReport, ""]),
  ].join("\n")
}

function beforeAfterMarkdown(rows: readonly EvaluationRow[]) {
  const unique = new Map<string, Readonly<{ before: string; after: string }>>()
  for (const record of rows.flatMap((row) => row.result.plainClinicalTurkish.records)) {
    if (!record.before.trim() || !record.after.trim() || record.before.trim() === record.after.trim()) continue
    const key = `${record.before.trim()}\n${record.after.trim()}`
    if (!unique.has(key)) unique.set(key, Object.freeze({ before: record.before.trim(), after: record.after.trim() }))
  }
  const samples = [...unique.values()].slice(0, 60)
  assert.ok(samples.length >= 30, `before_after_sample_shortfall:${samples.length}`)
  return [
    "# Before / After Language Samples",
    "",
    ...samples.flatMap((sample, index) => [`## ÖRNEK-${String(index + 1).padStart(2, "0")}`, "", "BEFORE:", sample.before, "", "AFTER:", sample.after, ""]),
  ].join("\n")
}

function candidateHash() {
  const filenames = [
    ...fs.readdirSync(path.join(process.cwd(), "src/lib/dna/reportV2")).filter((name) => name.endsWith(".ts")).map((name) => `src/lib/dna/reportV2/${name}`),
    "scripts/report-v2-cases.ts",
    "scripts/run-report-v2-tests.ts",
    "scripts/run-report-v2-plain-clinical-turkish.ts",
    "tsconfig.report-v2.json",
  ].sort()
  return sha256(filenames.map((filename) => `${filename}\n${sha256(fs.readFileSync(path.join(process.cwd(), filename)))}`).join("\n"))
}

async function main() {
  const replay = buildProductionReadinessCases()
  const fresh = buildPlainClinicalTurkishCases()
  assert.equal(replay.length, 50)
  assert.equal(fresh.length, 30)
  const cases = [
    ...replay.map((fixture) => Object.freeze({ cohort: "replay-50" as const, fixture })),
    ...fresh.map((fixture) => Object.freeze({ cohort: "fresh-30" as const, fixture })),
  ]
  const runTimestamp = timestamp()
  const checkpoint = path.join("/tmp", `report-v2-plain-clinical-turkish-${runTimestamp}.jsonl`)
  const sourceCheckpoint = process.env.REPORT_V2_PLAIN_TURKISH_CHECKPOINT?.trim()
  if (!sourceCheckpoint) fs.writeFileSync(checkpoint, "", "utf8")
  const rows = sourceCheckpoint ? rowsFromCheckpoint(cases, sourceCheckpoint) : await runCases(cases, checkpoint)
  const baseline = priorDecisions()
  const before = baselineLanguageMetrics()
  const replayMetrics = metrics(rows.filter((row) => row.cohort === "replay-50"), baseline)
  const freshMetrics = metrics(rows.filter((row) => row.cohort === "fresh-30"), baseline)
  const allMetrics = metrics(rows, baseline)
  const zeroKeys = ["scoringRegression", "meaningDrift", "decisionDrift", "unsupportedAddition", "grammarError", "terminologyDrift", "repetition", "nominalizationOverload", "abstractLanguageTrigger", "internalJargon", "sourceRegression", "safetyRegression", "privacyRegression"] as const
  const hardAcceptancePassed = zeroKeys.every((key) => allMetrics[key] === 0)
  const baselineVersion = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string }>
  const routeSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts")))
  const reportEngineSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts")))
  const objective = Object.freeze({
    version: "dna-report-v2.3-final-plain-clinical-turkish@1",
    reportVersion: REPORT_V2_VERSION,
    languageContractVersion: DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
    plainClinicalTurkishVersion: PLAIN_CLINICAL_TURKISH_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    productionActivated: false,
    codexLanguageScore: null,
    before,
    replay50: replayMetrics,
    fresh30: freshMetrics,
    combined80: allMetrics,
    beforeAfter: Object.freeze({
      nominalizationOverload: Object.freeze({ before: before.nominalizationOverload, after: allMetrics.nominalizationOverload }),
      abstractLanguageTrigger: Object.freeze({ before: before.abstractLanguageTrigger, after: allMetrics.abstractLanguageTrigger }),
      repetition: Object.freeze({ before: before.repetition, after: allMetrics.repetition }),
    }),
    performance: Object.freeze({ model: DNA_REPORT_LUNA_MODEL, pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION, measuredCalls: allMetrics.measuredCalls, p50LatencyMs: allMetrics.p50LatencyMs, p95LatencyMs: allMetrics.p95LatencyMs, totalCostUsd: allMetrics.totalCostUsd, costPerReportUsd: allMetrics.costPerReportUsd, fabricatedMeasurements: false }),
    hardAcceptance: Object.freeze({ passed: hardAcceptancePassed, zeroKeys }),
    isolation: Object.freeze({ productionChanged: routeSha256 !== baselineVersion.routeSha256 || reportEngineSha256 !== baselineVersion.reportEngineSha256, chatBoxChangedByThisTurn: false }),
    hashes: Object.freeze({ routeSha256, reportEngineSha256, candidateSha256: candidateHash() }),
  })

  const outputDir = path.join(process.env.REPORT_V2_PLAIN_TURKISH_OUTPUT_ROOT || "/tmp", "SelfMetaAI/report-v2-shadow", runTimestamp)
  fs.mkdirSync(outputDir, { recursive: true })
  const blind = blindMarkdown(rows)
  const samples = beforeAfterMarkdown(rows)
  const sealed = rows.map((row) => JSON.stringify({
    cohort: row.cohort,
    caseId: row.fixture.id,
    pattern: row.fixture.pattern,
    scoringRegression: scoringRegression(row.fixture, row.result),
    decisionState: row.result.decisionPlan.decisionState,
    primary: row.result.decisionPlan.primaryFormulation?.id ?? null,
    confidence: row.result.decisionPlan.confidence.level,
    plainClinicalTurkish: row.result.plainClinicalTurkish,
    recoveryStatus: row.result.recoveryStatus,
    providerCalls: row.result.providerCalls,
    validation: row.result.validation,
    trace: row.result.trace,
  })).join("\n") + "\n"
  fs.writeFileSync(path.join(outputDir, "BLIND_PLAIN_TURKISH_REPORTS.md"), blind, "utf8")
  fs.writeFileSync(path.join(outputDir, "BEFORE_AFTER_LANGUAGE_SAMPLES.md"), samples, "utf8")
  fs.writeFileSync(path.join(outputDir, "SEALED_PLAIN_TURKISH_EVIDENCE.jsonl"), sealed, "utf8")
  fs.writeFileSync(path.join(outputDir, "objective-summary.json"), JSON.stringify(objective, null, 2) + "\n", "utf8")
  const packageContract = ["BLIND_PLAIN_TURKISH_REPORTS.md", "BEFORE_AFTER_LANGUAGE_SAMPLES.md", "objective-summary.json", "manifest.json"]
  const manifest = Object.freeze({
    version: objective.version,
    generatedAt: objective.generatedAt,
    packageContract,
    packageContents: ["BLIND_PLAIN_TURKISH_REPORTS.md", "BEFORE_AFTER_LANGUAGE_SAMPLES.md", "objective-summary.json"].map((filename) => Object.freeze({ filename, sha256: sha256(fs.readFileSync(path.join(outputDir, filename))), bytes: fs.statSync(path.join(outputDir, filename)).size })),
    sealedEvidence: Object.freeze({ filename: "SEALED_PLAIN_TURKISH_EVIDENCE.jsonl", sha256: sha256(sealed), includedInBlindZip: false }),
    blindReportCount: 30,
  })
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")
  const zipPath = path.join(outputDir, "plain-clinical-turkish-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, ...packageContract], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  console.log("=== REPORT V2 FINAL PLAIN CLINICAL TURKISH ===")
  console.log(`Checkpoint: ${sourceCheckpoint || checkpoint}`)
  console.log(`Directory: ${outputDir}`)
  console.log(`HARD_ACCEPTANCE: ${hardAcceptancePassed ? "PASS" : "FAIL"}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${sha256(fs.readFileSync(zipPath))}`)
}

void main()
