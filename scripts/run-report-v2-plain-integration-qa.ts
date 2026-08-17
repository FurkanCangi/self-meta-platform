import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import {
  REPORT_SECTION_HEADINGS,
  REPORT_V2_VERSION,
  type LockedReportPlan,
  type ReportRealization,
  type ReportSectionId,
  type ReportV2ShadowResult,
} from "../src/lib/dna/reportV2/contracts"
import { reportLanguageDiagnostics } from "../src/lib/dna/reportV2/languageContract"
import {
  DNA_REPORT_LUNA_MODEL,
  DNA_REPORT_LUNA_PRICING_VERSION,
  LunaReportRealizer,
} from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import {
  auditPlainClinicalRewriteRecord,
  latestMaterialityPipelineAssertion,
  nonMaterialKnowledgeReentryCount,
  plainClinicalLanguageDiagnostics,
  PLAIN_CLINICAL_TURKISH_VERSION,
  semanticMicroRepetitionCount,
} from "../src/lib/dna/reportV2/plainClinicalTurkish"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import {
  buildPlainClinicalTurkishCases,
  buildPlainIntegrationQaCases,
  type ReportV2SyntheticCase,
} from "./report-v2-cases"

type Cohort = "replay-30" | "fresh-50"
type EvaluationRow = Readonly<{ cohort: Cohort; fixture: ReportV2SyntheticCase; result: ReportV2ShadowResult }>
type PriorRecord = Readonly<{ sectionId: ReportSectionId; before: string; after: string; ruleIds?: readonly string[] }>
type PriorRow = Readonly<{
  cohort: string
  caseId: string
  decisionState: unknown
  primary: unknown
  confidence: unknown
  plainClinicalTurkish: Readonly<{ records: readonly PriorRecord[] }>
  trace: Readonly<{ reportPlan: LockedReportPlan }>
}>

const BASELINE_DIR = process.env.REPORT_V2_PLAIN_INTEGRATION_BASELINE_DIR
  || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260812T140106Z"
const USER_COST_CAP_MICROUSD = 1_000_000
const CURRENT_RUN_COST_CAP_MICROUSD = 800_000
const PRIOR_ABORTED_MEASURED_COST_MICROUSD = Number(process.env.REPORT_V2_PRIOR_ABORTED_MEASURED_COST_MICROUSD || 0)
const PRIOR_ABORTED_UNMEASURED_CALLS = Number(process.env.REPORT_V2_PRIOR_ABORTED_UNMEASURED_CALLS || 0)

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

function baselineRows() {
  const filename = path.join(BASELINE_DIR, "SEALED_PLAIN_TURKISH_EVIDENCE.jsonl")
  const rows = fs.readFileSync(filename, "utf8").trim().split(/\n/u).filter(Boolean).map((line) => JSON.parse(line) as PriorRow)
  const fresh = rows.filter((row) => row.cohort === "fresh-30")
  assert.equal(fresh.length, 30)
  return Object.freeze(fresh)
}

function baselineReports() {
  const source = fs.readFileSync(path.join(BASELINE_DIR, "BLIND_PLAIN_TURKISH_REPORTS.md"), "utf8")
  const reports = source.split(/^## RAPOR-\d+\s*$/gmu).slice(1).map((report) => report.trim()).filter(Boolean)
  assert.equal(reports.length, 30)
  return Object.freeze(reports)
}

function baselineMetrics(rows: readonly PriorRow[], reports: readonly string[]) {
  let semanticStrengthening = 0
  let newSpecificity = 0
  let newInterventionDetail = 0
  let certaintyDrift = 0
  let meaningDrift = 0
  rows.forEach((row) => row.plainClinicalTurkish.records.forEach((record) => {
    const audit = auditPlainClinicalRewriteRecord({
      plan: row.trace.reportPlan,
      sectionId: record.sectionId,
      beforeClaimIds: Object.freeze([]),
      before: record.before,
      afterSentence: record.after,
      ruleIds: Object.freeze(record.ruleIds ?? ["BASELINE_REPLAY_AUDIT"]),
    })
    semanticStrengthening += Number(audit.semanticStrengthening)
    newSpecificity += Number(audit.newSpecificity)
    newInterventionDetail += Number(audit.newInterventionDetail)
    certaintyDrift += Number(audit.certaintyChanged)
    meaningDrift += Number(!audit.preservedMeaning)
  }))
  let nonMaterialKnowledgeReentry = 0
  let grammarError = 0
  let semanticMicroRepetition = 0
  reports.forEach((report, index) => {
    const realization = parseReport(report)
    nonMaterialKnowledgeReentry += nonMaterialKnowledgeReentryCount(rows[index]!.trace.reportPlan, realization)
    semanticMicroRepetition += semanticMicroRepetitionCount(realization)
    const plain = plainClinicalLanguageDiagnostics(realization)
    const language = reportLanguageDiagnostics(report)
    grammarError += plain.plainTurkishGrammarErrorCount
      + language.brokenSuffixCount
      + language.duplicateSuffixCount
      + language.sentenceMergeErrorCount
      + language.brokenWordCount
  })
  return Object.freeze({
    reportCount: reports.length,
    meaningDrift,
    semanticStrengthening,
    newSpecificity,
    newInterventionDetail,
    certaintyDrift,
    nonMaterialKnowledgeReentry,
    grammarError,
    semanticMicroRepetition,
  })
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

function rowsFromCheckpoint(cases: readonly Readonly<{ cohort: Cohort; fixture: ReportV2SyntheticCase }>[], checkpoint: string) {
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
  const realizer = new LunaReportRealizer({
    apiKey,
    safetyIdentifier: "report-v2-final-plain-turkish-integration-qa-80",
    maxTotalCostMicrousd: CURRENT_RUN_COST_CAP_MICROUSD,
  })
  const rows: EvaluationRow[] = []
  for (const [index, entry] of cases.entries()) {
    const result = await runReportV2Shadow(entry.fixture.input, { realizer, literatureMode: "STANDARD" })
    const row = Object.freeze({ cohort: entry.cohort, fixture: entry.fixture, result })
    rows.push(row)
    fs.appendFileSync(checkpoint, JSON.stringify({ cohort: entry.cohort, caseId: entry.fixture.id, result }) + "\n", "utf8")
    console.log(`plain-integration ${index + 1}/${cases.length}: ${entry.fixture.id} ${result.recoveryStatus} calls=${result.providerCalls}`)
  }
  return Object.freeze(rows)
}

function metrics(rows: readonly EvaluationRow[], priors: ReadonlyMap<string, PriorRow>) {
  const attempts = rows.flatMap((row) => row.result.trace.realizationAttempts).filter((attempt) => attempt.provider === "luna")
  const measuredAttempts = attempts.filter((attempt) => attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0)
  const totalCostMicrousd = measuredAttempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  const reportLatencies = rows.map((row) => row.result.trace.realizationAttempts
    .filter((attempt) => attempt.provider === "luna")
    .reduce((sum, attempt) => sum + attempt.latencyMs, 0))
  let decisionDrift = 0
  for (const row of rows) {
    const knowledgeDrift = row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge
    if (row.cohort === "fresh-50") {
      decisionDrift += Number(knowledgeDrift)
      continue
    }
    const prior = priors.get(row.fixture.id)
    assert.ok(prior, `prior_decision_missing:${row.fixture.id}`)
    decisionDrift += Number(knowledgeDrift
      || prior.decisionState !== row.result.decisionPlan.decisionState
      || prior.primary !== (row.result.decisionPlan.primaryFormulation?.id ?? null)
      || prior.confidence !== row.result.decisionPlan.confidence.level)
  }
  return Object.freeze({
    reportCount: rows.length,
    scoringRegression: rows.reduce((sum, row) => sum + scoringRegression(row.fixture, row.result), 0),
    latestMaterialityPipelineFailure: rows.filter((row) => !row.result.plainClinicalTurkish.latestMaterialityPipelineConfirmed).length,
    nonMaterialPreRewriteFailure: rows.filter((row) => !row.result.plainClinicalTurkish.nonMaterialKnowledgeRemovedBeforeRewrite).length,
    nonMaterialKnowledgeReentry: rows.reduce((sum, row) => sum + row.result.plainClinicalTurkish.nonMaterialKnowledgeReentryCount, 0),
    meaningDrift: rows.reduce((sum, row) => sum + Math.max(row.result.plainClinicalTurkish.meaningDriftCount, row.result.validation.meaningDriftCount), 0),
    semanticStrengthening: rows.reduce((sum, row) => sum + row.result.plainClinicalTurkish.semanticStrengtheningCount, 0),
    newSpecificity: rows.reduce((sum, row) => sum + row.result.plainClinicalTurkish.newSpecificityCount, 0),
    newInterventionDetail: rows.reduce((sum, row) => sum + row.result.plainClinicalTurkish.newInterventionDetailCount, 0),
    certaintyDrift: rows.reduce((sum, row) => sum + row.result.plainClinicalTurkish.certaintyDriftCount, 0),
    grammarError: rows.reduce((sum, row) => sum + row.result.validation.plainTurkishGrammarErrorCount
      + row.result.validation.brokenSuffixCount
      + row.result.validation.duplicateSuffixCount
      + row.result.validation.sentenceMergeErrorCount
      + row.result.validation.brokenWordCount, 0),
    semanticMicroRepetition: rows.reduce((sum, row) => sum + row.result.validation.semanticMicroRepetitionCount, 0),
    decisionDrift,
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
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
    inputTokens: measuredAttempts.reduce((sum, attempt) => sum + attempt.usage.inputTokens, 0),
    outputTokens: measuredAttempts.reduce((sum, attempt) => sum + attempt.usage.outputTokens, 0),
    totalCostUsd: Number((totalCostMicrousd / 1_000_000).toFixed(6)),
    costPerReportUsd: Number((totalCostMicrousd / Math.max(1, rows.length) / 1_000_000).toFixed(6)),
    p50LatencyMs: percentile(reportLatencies, 0.5),
    p95LatencyMs: percentile(reportLatencies, 0.95),
  })
}

function blindReportMarkdown(rows: readonly EvaluationRow[]) {
  return [
    "# DNA Intelligence — Final Plain Turkish Kör Raporları",
    "",
    ...rows.filter((row) => row.cohort === "fresh-50").flatMap((row, index) => [
      `## RAPOR-${String(index + 1).padStart(2, "0")}`,
      "",
      row.result.finalReport,
      "",
    ]),
  ].join("\n")
}

function beforeAfterMarkdown(rows: readonly EvaluationRow[]) {
  const samples = rows.flatMap((row) => row.result.plainClinicalTurkish.records)
    .filter((record) => record.before.trim() && record.afterSentence.trim() && record.before.trim() !== record.afterSentence.trim())
    .slice(0, 140)
  assert.ok(samples.length >= 100, `before_after_sample_shortfall:${samples.length}`)
  return [
    "# Before / After Sentences",
    "",
    ...samples.flatMap((sample, index) => [
      `## ÖRNEK-${String(index + 1).padStart(3, "0")}`,
      "",
      "BEFORE:",
      sample.before.trim(),
      "",
      "AFTER:",
      sample.afterSentence.trim(),
      "",
    ]),
  ].join("\n")
}

function candidateHash() {
  const filenames = [
    ...fs.readdirSync(path.join(process.cwd(), "src/lib/dna/reportV2")).filter((name) => name.endsWith(".ts")).map((name) => `src/lib/dna/reportV2/${name}`),
    "scripts/report-v2-cases.ts",
    "scripts/run-report-v2-tests.ts",
    "scripts/run-report-v2-plain-integration-qa.ts",
    "tsconfig.report-v2.json",
  ].sort()
  return sha256(filenames.map((filename) => `${filename}\n${sha256(fs.readFileSync(path.join(process.cwd(), filename)))}`).join("\n"))
}

async function main() {
  const replay = buildPlainClinicalTurkishCases()
  const fresh = buildPlainIntegrationQaCases()
  assert.equal(replay.length, 30)
  assert.equal(fresh.length, 50)
  assert.ok(fresh.filter((fixture) => fixture.pattern.includes("single-domain")).length >= 6)
  assert.ok(fresh.filter((fixture) => fixture.adversarial || /mixed|disagreement|uncertain|multi-domain/iu.test(fixture.pattern)).length >= 20)
  const cases = [
    ...replay.map((fixture) => Object.freeze({ cohort: "replay-30" as const, fixture })),
    ...fresh.map((fixture) => Object.freeze({ cohort: "fresh-50" as const, fixture })),
  ]
  const runTimestamp = timestamp()
  const checkpoint = path.join("/tmp", `report-v2-plain-integration-${runTimestamp}.jsonl`)
  const sourceCheckpoint = process.env.REPORT_V2_PLAIN_INTEGRATION_CHECKPOINT?.trim()
  if (!sourceCheckpoint) fs.writeFileSync(checkpoint, "", "utf8")
  const rows = sourceCheckpoint ? rowsFromCheckpoint(cases, sourceCheckpoint) : await runCases(cases, checkpoint)
  const priors = baselineRows()
  const priorMap = new Map(priors.map((row) => [row.caseId, row]))
  const before = baselineMetrics(priors, baselineReports())
  const replayMetrics = metrics(rows.filter((row) => row.cohort === "replay-30"), priorMap)
  const freshMetrics = metrics(rows.filter((row) => row.cohort === "fresh-50"), priorMap)
  const combined = metrics(rows, priorMap)
  assert.ok(combined.totalCostUsd <= CURRENT_RUN_COST_CAP_MICROUSD / 1_000_000, `cost_cap_exceeded:${combined.totalCostUsd}`)
  assert.ok((combined.totalCostUsd * 1_000_000) + PRIOR_ABORTED_MEASURED_COST_MICROUSD <= USER_COST_CAP_MICROUSD, "user_cost_cap_exceeded")
  const zeroKeys = [
    "scoringRegression",
    "latestMaterialityPipelineFailure",
    "nonMaterialPreRewriteFailure",
    "nonMaterialKnowledgeReentry",
    "meaningDrift",
    "semanticStrengthening",
    "newSpecificity",
    "newInterventionDetail",
    "certaintyDrift",
    "grammarError",
    "semanticMicroRepetition",
    "decisionDrift",
    "unsupportedAddition",
    "sourceRegression",
    "safetyRegression",
    "privacyRegression",
  ] as const
  const hardAcceptancePassed = zeroKeys.every((key) => combined[key] === 0)
  assert.equal(hardAcceptancePassed, true, `hard_acceptance_failed:${zeroKeys.filter((key) => combined[key] !== 0).join(",")}`)

  const baselineVersion = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string }>
  const routeSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts")))
  const reportEngineSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts")))
  const outputRoot = process.env.REPORT_V2_PLAIN_INTEGRATION_OUTPUT_ROOT || "/tmp/SelfMetaAI/report-v2-shadow"
  const outputDir = path.join(outputRoot, runTimestamp)
  fs.mkdirSync(outputDir, { recursive: true })
  const objective = Object.freeze({
    version: "dna-report-v2.3-final-plain-turkish-integration-qa@1",
    reportVersion: REPORT_V2_VERSION,
    plainClinicalTurkishVersion: PLAIN_CLINICAL_TURKISH_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    codexLanguageScore: null,
    assertions: Object.freeze({
      latestMaterialityPipelineConfirmed: combined.latestMaterialityPipelineFailure === 0,
      nonMaterialKnowledgeRemovedBeforeRewrite: combined.nonMaterialPreRewriteFailure === 0,
      afterSemanticSubsetOfLockedPlan: combined.semanticStrengthening + combined.newSpecificity + combined.newInterventionDetail + combined.certaintyDrift === 0,
    }),
    before,
    replay30: replayMetrics,
    fresh50: freshMetrics,
    combined80: combined,
    beforeAfter: Object.freeze({
      nonMaterialKnowledgeReentry: Object.freeze({ before: before.nonMaterialKnowledgeReentry, after: combined.nonMaterialKnowledgeReentry }),
      semanticStrengthening: Object.freeze({ before: before.semanticStrengthening, after: combined.semanticStrengthening }),
      newSpecificity: Object.freeze({ before: before.newSpecificity, after: combined.newSpecificity }),
      certaintyDrift: Object.freeze({ before: before.certaintyDrift, after: combined.certaintyDrift }),
      grammarError: Object.freeze({ before: before.grammarError, after: combined.grammarError }),
      semanticMicroRepetition: Object.freeze({ before: before.semanticMicroRepetition, after: combined.semanticMicroRepetition }),
    }),
    performance: Object.freeze({
      model: DNA_REPORT_LUNA_MODEL,
      pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION,
      userHardCostCapUsd: USER_COST_CAP_MICROUSD / 1_000_000,
      currentRunHardCostCapUsd: CURRENT_RUN_COST_CAP_MICROUSD / 1_000_000,
      priorAbortedMeasuredCostUsd: PRIOR_ABORTED_MEASURED_COST_MICROUSD / 1_000_000,
      priorAbortedUnmeasuredCalls: PRIOR_ABORTED_UNMEASURED_CALLS,
      totalMeasuredIncludingPriorUsd: Number((combined.totalCostUsd + PRIOR_ABORTED_MEASURED_COST_MICROUSD / 1_000_000).toFixed(6)),
      measuredCalls: combined.measuredCalls,
      inputTokens: combined.inputTokens,
      outputTokens: combined.outputTokens,
      totalCostUsd: combined.totalCostUsd,
      costPerReportUsd: combined.costPerReportUsd,
      p50LatencyMs: combined.p50LatencyMs,
      p95LatencyMs: combined.p95LatencyMs,
      fabricatedMeasurements: false,
    }),
    freshDistribution: Object.freeze({
      reportCount: fresh.length,
      singleDomainCount: fresh.filter((fixture) => fixture.pattern.includes("single-domain")).length,
      mixedDisagreementUncertainCount: fresh.filter((fixture) => fixture.adversarial || /mixed|disagreement|uncertain|multi-domain/iu.test(fixture.pattern)).length,
      preservedUnderSupport: fresh.some((fixture) => fixture.pattern.includes("preserved-under-support")),
      externalDisagreement: fresh.some((fixture) => fixture.expectDiscrepancy && fixture.pattern.includes("external")),
      lowEvidence: fresh.some((fixture) => fixture.pattern.includes("low-evidence")),
      multiDomain: fresh.some((fixture) => fixture.pattern.includes("multi-domain")),
    }),
    hardAcceptance: Object.freeze({ passed: hardAcceptancePassed, zeroKeys }),
    isolation: Object.freeze({
      productionChanged: routeSha256 !== baselineVersion.routeSha256 || reportEngineSha256 !== baselineVersion.reportEngineSha256,
      chatBoxChangedByThisTurn: false,
      productionActivated: false,
    }),
    hashes: Object.freeze({ routeSha256, reportEngineSha256, candidateSha256: candidateHash() }),
  })

  const blindReports = blindReportMarkdown(rows)
  const beforeAfter = beforeAfterMarkdown(rows)
  const sealed = rows.flatMap((row) => row.result.plainClinicalTurkish.records.map((record) => JSON.stringify({
    cohort: row.cohort,
    caseId: row.fixture.id,
    pattern: row.fixture.pattern,
    sectionId: record.sectionId,
    beforeClaimIds: record.beforeClaimIds,
    before: record.before,
    after: record.afterSentence,
    materiality: record.materiality,
    knowledgeClinicalMateriality: record.knowledgeClinicalMateriality,
    preservedMeaning: record.preservedMeaning,
    semanticStrengthening: record.semanticStrengthening,
    newSpecificity: record.newSpecificity,
    newInterventionDetail: record.newInterventionDetail,
    certaintyChanged: record.certaintyChanged,
    repairReason: record.repairReason,
    ruleIds: record.ruleIds,
  }))).join("\n") + "\n"
  fs.writeFileSync(path.join(outputDir, "BLIND_FINAL_PLAIN_REPORTS.md"), blindReports, "utf8")
  fs.writeFileSync(path.join(outputDir, "BLIND_BEFORE_AFTER_SENTENCES.md"), beforeAfter, "utf8")
  fs.writeFileSync(path.join(outputDir, "SEALED_LANGUAGE_PRESERVATION.jsonl"), sealed, "utf8")
  fs.writeFileSync(path.join(outputDir, "objective-summary.json"), JSON.stringify(objective, null, 2) + "\n", "utf8")
  const packageContract = ["BLIND_FINAL_PLAIN_REPORTS.md", "BLIND_BEFORE_AFTER_SENTENCES.md", "objective-summary.json", "manifest.json"]
  const manifest = Object.freeze({
    version: objective.version,
    generatedAt: objective.generatedAt,
    packageContract,
    packageContents: packageContract.filter((filename) => filename !== "manifest.json").map((filename) => Object.freeze({
      filename,
      sha256: sha256(fs.readFileSync(path.join(outputDir, filename))),
      bytes: fs.statSync(path.join(outputDir, filename)).size,
    })),
    sealedEvidence: Object.freeze({
      filename: "SEALED_LANGUAGE_PRESERVATION.jsonl",
      sha256: sha256(sealed),
      includedInBlindZip: false,
    }),
    blindReportCount: 50,
    beforeAfterSentenceCount: (beforeAfter.match(/^## ÖRNEK-/gmu) ?? []).length,
  })
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")
  const zipPath = path.join(outputDir, "final-plain-turkish-integration-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, ...packageContract], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  console.log("=== REPORT V2 FINAL PLAIN TURKISH INTEGRATION QA ===")
  console.log(`Checkpoint: ${sourceCheckpoint || checkpoint}`)
  console.log(`Directory: ${outputDir}`)
  console.log(`HARD_ACCEPTANCE: ${hardAcceptancePassed ? "PASS" : "FAIL"}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${sha256(fs.readFileSync(zipPath))}`)
}

void main()
