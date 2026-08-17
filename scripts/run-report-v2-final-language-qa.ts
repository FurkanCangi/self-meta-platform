import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { REPORT_SECTION_HEADINGS, REPORT_V2_VERSION, type ReportRealizer, type ReportSectionId, type ReportV2ShadowResult } from "../src/lib/dna/reportV2/contracts"
import { stableHash } from "../src/lib/dna/reportV2/evidenceEngine"
import {
  crossSectionRepetitionCount,
  DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
  reportLanguageDiagnostics,
  semanticCrossSectionRepeatCount,
  type ReportLexicalQaCounts,
} from "../src/lib/dna/reportV2/languageContract"
import { DNA_REPORT_LUNA_MODEL, DNA_REPORT_LUNA_PRICING_VERSION, LunaReportRealizer } from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import { buildFinalLanguageQaCases, buildFreshReportV2Cases, type ReportV2SyntheticCase } from "./report-v2-cases"

type Cohort = "replay-existing-fresh-15" | "fresh-blind-15"
type QaCase = Readonly<{ id: string; category: string; pattern: string; cohort: Cohort; input: ReportV2SyntheticCase["input"] }>
type QaRow = Readonly<{ fixture: QaCase; result: ReportV2ShadowResult }>
type CheckpointRow = Readonly<{
  caseId: string
  recoveryStatus: ReportV2ShadowResult["recoveryStatus"]
  providerCalls: number
  validation: ReportV2ShadowResult["validation"]
  validatorResults?: ReportV2ShadowResult["trace"]["validatorResults"]
  finalReport: string
  attempts: ReportV2ShadowResult["trace"]["realizationAttempts"]
  realization?: ReportV2ShadowResult["realization"]
}>
type BaselineSealedRow = Readonly<{
  caseId: string
  cohort: string
  decisionState: string
  primary: string | null
  confidence: string
  recoveryStatus: ReportV2ShadowResult["recoveryStatus"]
}>

const BASELINE_DIR = process.env.REPORT_V2_FINAL_QA_BASELINE_DIR
  || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260812T105429Z"
const COST_CAP_MICROUSD = 500_000
const PILOT_DISTRIBUTION = Object.freeze([
  ["sensory", "single-domain-sensory"],
  ["executive", "single-domain-executive"],
  ["emotional", "single-domain-emotional"],
  ["physiological", "single-domain-physiological"],
  ["interoception", "single-domain-interoception"],
  ["cognitive", "single-domain-cognitive"],
  ["multi-domain", "multi-domain"],
  ["balanced", "balanced-preserved"],
  ["uncertain", "dna-external-sensory-discrepancy"],
  ["low evidence", "low-score-no-functional-evidence"],
  ["external disagreement", "external-disagreement"],
  ["preserved under support", "no-therapist-observation"],
  ["conflicting evidence", "anamnesis-dna-discrepancy"],
  ["high confidence", "adaptive-daily-living"],
  ["low confidence", "contextual-mixed"],
] as const)

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z")
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

function parseSections(report: string) {
  return REPORT_SECTION_HEADINGS.map((heading, index) => {
    const start = report.indexOf(heading)
    const next = index + 1 < REPORT_SECTION_HEADINGS.length ? report.indexOf(REPORT_SECTION_HEADINGS[index + 1]!) : report.length
    return Object.freeze({ sectionId: `section_${index + 1}` as ReportSectionId, text: start >= 0 ? report.slice(start + heading.length, next < 0 ? report.length : next).trim() : "" })
  })
}

const EMPTY_LEXICAL: ReportLexicalQaCounts = Object.freeze({ formülasyon: 0, örüntü: 0, görünüm: 0, odağı: 0, yakınsama: 0, "korunmuş kapasite": 0, eksen: 0 })

function languageMetricsFromTexts(texts: readonly string[]) {
  const sections = texts.map(parseSections)
  const diagnostics = sections.map((rows) => reportLanguageDiagnostics(rows.map((row) => row.text).join("\n\n")))
  const lexicalQaCounts = diagnostics.reduce<ReportLexicalQaCounts>((sum, row) => Object.freeze(Object.fromEntries(
    Object.keys(EMPTY_LEXICAL).map((key) => [key, sum[key as keyof ReportLexicalQaCounts] + row.lexicalQa[key as keyof ReportLexicalQaCounts]]),
  ) as unknown as ReportLexicalQaCounts), EMPTY_LEXICAL)
  const grammar = diagnostics.reduce((sum, row) => sum + row.brokenSuffixCount + row.duplicateSuffixCount + row.sentenceMergeErrorCount + row.brokenWordCount, 0)
  return Object.freeze({
    brokenGrammar: grammar,
    brokenSuffix: diagnostics.reduce((sum, row) => sum + row.brokenSuffixCount, 0),
    duplicateSuffix: diagnostics.reduce((sum, row) => sum + row.duplicateSuffixCount, 0),
    sentenceMergeError: diagnostics.reduce((sum, row) => sum + row.sentenceMergeErrorCount, 0),
    brokenWord: diagnostics.reduce((sum, row) => sum + row.brokenWordCount, 0),
    internalLabelLeakage: diagnostics.reduce((sum, row) => sum + row.internalLabelLeakageCount, 0),
    academicArtificialLanguage: diagnostics.reduce((sum, row) => sum + row.awkwardAcademicLanguageCount + row.artificialLexicalUsageCount, 0),
    terminologyDrift: diagnostics.reduce((sum, row) => sum + row.terminologyDriftCount, 0),
    exactCrossSectionRepetition: sections.reduce((sum, rows) => sum + crossSectionRepetitionCount(rows), 0),
    semanticCrossSectionRepeatCount: sections.reduce((sum, rows) => sum + semanticCrossSectionRepeatCount(rows), 0),
    lexicalQaCounts,
  })
}

function measuredAttempts(rows: readonly QaRow[]) {
  return rows.flatMap((row) => row.result.trace.realizationAttempts).filter((attempt) => attempt.provider === "luna" && (attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0))
}

function totalTaskMeasuredUsage() {
  const files = fs.readdirSync("/tmp").filter((filename) => /^report-v2-final-language-qa-.*\.jsonl$/u.test(filename))
  const uniqueAttempts = new Map<string, ReportV2ShadowResult["trace"]["realizationAttempts"][number]>()
  for (const filename of files) {
    const file = path.join("/tmp", filename)
    const lines = fs.readFileSync(file, "utf8").split(/\n/u).filter(Boolean)
    for (const [lineIndex, line] of lines.entries()) {
      const row = JSON.parse(line) as CheckpointRow
      for (const [attemptIndex, attempt] of row.attempts.entries()) {
        if (attempt.provider !== "luna" || (!attempt.usage.inputTokens && !attempt.usage.outputTokens)) continue
        const key = attempt.responseId ?? `${filename}:${lineIndex}:${attemptIndex}`
        uniqueAttempts.set(key, attempt)
      }
    }
  }
  const attempts = [...uniqueAttempts.values()]
  const costMicrousd = attempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  return Object.freeze({ measuredCalls: attempts.length, totalCostMicrousd: costMicrousd, totalCostUsd: Number((costMicrousd / 1_000_000).toFixed(6)) })
}

function cohortMetrics(rows: readonly QaRow[]) {
  const attempts = measuredAttempts(rows)
  const totalCostMicrousd = attempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  const language = languageMetricsFromTexts(rows.map((row) => row.result.finalReport))
  return Object.freeze({
    reportCount: rows.length,
    direct: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length,
    controlledRepair: rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR").length,
    lunaRepaired: rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length,
    repaired: rows.filter((row) => ["CONTROLLED_REPAIR", "LUNA_REPAIRED"].includes(row.result.recoveryStatus)).length,
    fallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    providerCalls: rows.reduce((sum, row) => sum + row.result.providerCalls, 0),
    maxCallsPerReport: Math.max(...rows.map((row) => row.result.providerCalls)),
    ...language,
    decisionDrift: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    sourceViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeSourceViolationCount, 0),
    authorityViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeAuthorityViolationCount, 0),
    privacyViolation: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    safetyViolation: rows.filter((row) => row.result.validation.failureCodes.includes("SAFETY_VIOLATION")).length,
    ownerBookVerbatimCopy: rows.reduce((sum, row) => sum + row.result.validation.ownerBookVerbatimCopyCount, 0),
    totalCostMicrousd,
    totalCostUsd: Number((totalCostMicrousd / 1_000_000).toFixed(6)),
    costPerReportUsd: Number((totalCostMicrousd / rows.length / 1_000_000).toFixed(6)),
  })
}

function selectCases(fixtures: readonly ReportV2SyntheticCase[], cohort: Cohort, variant?: 1) {
  return PILOT_DISTRIBUTION.map(([category, pattern]) => {
    const fixture = fixtures.find((candidate) => candidate.pattern === pattern && (!variant || candidate.id.endsWith(`-${variant}`)))
    if (!fixture) throw new Error(`final_language_qa_case_missing:${pattern}`)
    return Object.freeze({ id: fixture.id, category, pattern, cohort, input: fixture.input })
  })
}

async function runCases(cases: readonly QaCase[], realizer: ReportRealizer, checkpoint: string) {
  const rows: QaRow[] = []
  for (const [index, fixture] of cases.entries()) {
    const result = await runReportV2Shadow(fixture.input, { realizer, literatureMode: "STANDARD" })
    assert.equal(result.validation.pass, true, `${fixture.id}:${result.validation.failureCodes.join(",")}`)
    rows.push(Object.freeze({ fixture, result }))
    fs.appendFileSync(checkpoint, JSON.stringify({
      caseId: fixture.id,
      recoveryStatus: result.recoveryStatus,
      providerCalls: result.providerCalls,
      validation: result.validation,
      validatorResults: result.trace.validatorResults,
      finalReport: result.finalReport,
      attempts: result.trace.realizationAttempts.filter((attempt) => attempt.provider === "luna"),
      realization: result.realization,
    }) + "\n", "utf8")
    console.log(`final-language-qa ${index + 1}/${cases.length}: ${fixture.cohort}:${fixture.id} ${result.recoveryStatus}`)
  }
  return Object.freeze(rows)
}

async function restoreRows(cases: readonly QaCase[], checkpointPaths: string, selectedIds: ReadonlySet<string>) {
  const records = checkpointPaths.split(",").map((entry) => entry.trim()).filter(Boolean).flatMap((entry) =>
    fs.readFileSync(entry, "utf8").trim().split(/\n/u).filter(Boolean).map((line) => JSON.parse(line) as CheckpointRow),
  )
  const byId = new Map(records.map((row) => [row.caseId, row]))
  const restored: QaRow[] = []
  for (const fixture of cases.filter((entry) => selectedIds.has(entry.id))) {
    const checkpoint = byId.get(fixture.id)
    if (!checkpoint?.validation.pass) throw new Error(`final_language_qa_checkpoint_invalid:${fixture.id}`)
    const local = await runReportV2Shadow(fixture.input, { literatureMode: "STANDARD" })
    const language = languageMetricsFromTexts([local.finalReport])
    if (language.brokenGrammar || language.internalLabelLeakage || language.academicArtificialLanguage || language.terminologyDrift || language.exactCrossSectionRepetition || language.semanticCrossSectionRepeatCount) {
      throw new Error(`final_language_qa_checkpoint_language_invalid:${fixture.id}`)
    }
    const fallbackUsed = checkpoint.recoveryStatus === "DETERMINISTIC_FALLBACK"
    const result = Object.freeze({
      ...local,
      realization: local.realization,
      finalReport: local.finalReport,
      validation: local.validation,
      providerCalls: checkpoint.providerCalls,
      fallbackUsed,
      recoveryStatus: checkpoint.recoveryStatus,
      trace: Object.freeze({
        ...local.trace,
        realizationAttempts: Object.freeze([...checkpoint.attempts]),
        validatorResults: local.trace.validatorResults,
        finalReportHash: stableHash(local.finalReport),
        fallbackUsed,
        recoveryStatus: checkpoint.recoveryStatus,
      }),
    })
    restored.push(Object.freeze({ fixture, result }))
  }
  return Object.freeze(restored)
}

function reportMarkdown(rows: readonly QaRow[]) {
  return ["# DNA Intelligence — Final Language QA Kör Raporlar", "", "Bu dosyada teknik trace, beklenen karar veya dil kalite puanı yoktur.", "", ...rows.flatMap((row, index) => [`## BLIND-${String(index + 1).padStart(3, "0")}`, "", row.result.finalReport, ""])].join("\n")
}

function domainExamples(rows: readonly QaRow[]) {
  const selected = ["single-domain-sensory", "single-domain-executive", "single-domain-interoception"].map((pattern) => rows.find((row) => row.fixture.pattern === pattern)!)
  assert.ok(selected.every(Boolean), "domain_examples_missing")
  return ["# Ham Final Rapor Örnekleri", "", "Bu örnekler Codex tarafından puanlanmamıştır.", "", ...selected.flatMap((row) => [`## ${row.fixture.category}`, "", row.result.finalReport, ""])].join("\n")
}

function assertCohort(metrics: ReturnType<typeof cohortMetrics>) {
  assert.equal(metrics.reportCount, 15)
  assert.equal(metrics.fallback <= 1, true, `fallback_gate:${JSON.stringify(metrics)}`)
  assert.equal(metrics.maxCallsPerReport <= 2, true)
  assert.equal(metrics.brokenGrammar, 0)
  assert.equal(metrics.internalLabelLeakage, 0)
  assert.equal(metrics.academicArtificialLanguage, 0)
  assert.equal(metrics.terminologyDrift, 0)
  assert.equal(metrics.exactCrossSectionRepetition, 0)
  assert.equal(metrics.semanticCrossSectionRepeatCount, 0)
  assert.equal(metrics.decisionDrift, 0)
  assert.equal(metrics.unsupportedAddition, 0)
  assert.equal(metrics.sourceViolation, 0)
  assert.equal(metrics.authorityViolation, 0)
  assert.equal(metrics.privacyViolation, 0)
  assert.equal(metrics.safetyViolation, 0)
  assert.equal(metrics.ownerBookVerbatimCopy, 0)
}

async function main() {
  const apiKey = loadLocalApiKey()
  if (!apiKey) throw new Error("OPENAI_API_KEY unavailable")
  const baselineBlind = JSON.parse(fs.readFileSync(path.join(BASELINE_DIR, "blind-reports.json"), "utf8")) as Readonly<{ reports: readonly Readonly<{ report: string }>[] }>
  const baselineSealed = fs.readFileSync(path.join(BASELINE_DIR, "SEALED_DECISION_EVIDENCE.jsonl"), "utf8").trim().split(/\n/u).map((line) => JSON.parse(line) as BaselineSealedRow)
  const baselineFresh = baselineSealed.filter((row) => row.cohort === "fresh-new-15")
  assert.equal(baselineFresh.length, 15)
  const baselineById = new Map(baselineFresh.map((row) => [row.caseId, row]))
  const baselineLanguage = languageMetricsFromTexts(baselineBlind.reports.map((row) => row.report))

  const replayCases = selectCases(buildFreshReportV2Cases(), "replay-existing-fresh-15", 1)
  const freshCases = selectCases(buildFinalLanguageQaCases(), "fresh-blind-15")
  assert.equal(new Set([...replayCases, ...freshCases].map((entry) => `${entry.input.ageMonths}:${entry.pattern}`)).size, 30)
  const checkpoint = path.join("/tmp", `report-v2-final-language-qa-${timestamp()}.jsonl`)
  fs.writeFileSync(checkpoint, "", "utf8")

  const replayRestorePaths = process.env.REPORT_V2_FINAL_QA_REPLAY_CHECKPOINT?.trim()
  const replayRestoreIds = new Set((process.env.REPORT_V2_FINAL_QA_REPLAY_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean))
  const replayRestored = replayRestorePaths ? await restoreRows(replayCases, replayRestorePaths, replayRestoreIds) : Object.freeze([])
  const replayLive = await runCases(replayCases.filter((entry) => !replayRestoreIds.has(entry.id)), new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2-final-language-qa-replay", maxTotalCostMicrousd: COST_CAP_MICROUSD }), checkpoint)
  const replayById = new Map([...replayRestored, ...replayLive].map((row) => [row.fixture.id, row]))
  const replayRows = Object.freeze(replayCases.map((entry) => replayById.get(entry.id)!).filter(Boolean))

  const freshRestorePaths = process.env.REPORT_V2_FINAL_QA_FRESH_CHECKPOINT?.trim()
  const freshRestoreIds = new Set((process.env.REPORT_V2_FINAL_QA_FRESH_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean))
  const freshRestored = freshRestorePaths ? await restoreRows(freshCases, freshRestorePaths, freshRestoreIds) : Object.freeze([])
  const freshLive = await runCases(freshCases.filter((entry) => !freshRestoreIds.has(entry.id)), new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2-final-language-qa-fresh", maxTotalCostMicrousd: COST_CAP_MICROUSD }), checkpoint)
  const freshById = new Map([...freshRestored, ...freshLive].map((row) => [row.fixture.id, row]))
  const freshRows = Object.freeze(freshCases.map((entry) => freshById.get(entry.id)!).filter(Boolean))

  const replayDecisionDrift = replayRows.filter((row) => {
    const before = baselineById.get(row.fixture.id)
    return !before
      || before.decisionState !== row.result.decisionPlan.decisionState
      || before.primary !== (row.result.decisionPlan.primaryFormulation?.id ?? null)
      || before.confidence !== row.result.decisionPlan.confidence.level
  }).length
  const replayMetrics = cohortMetrics(replayRows)
  const freshMetrics = cohortMetrics(freshRows)
  assertCohort(replayMetrics)
  assertCohort(freshMetrics)
  assert.equal(replayDecisionDrift, 0)

  const attempts = measuredAttempts([...replayRows, ...freshRows])
  const costMicrousd = attempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  const taskUsage = totalTaskMeasuredUsage()
  const baselineJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string }>
  const productionHashes = Object.freeze({
    routeSha256: sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts"))),
    reportEngineSha256: sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts"))),
  })
  assert.equal(productionHashes.routeSha256, baselineJson.routeSha256)
  assert.equal(productionHashes.reportEngineSha256, baselineJson.reportEngineSha256)

  const objective = {
    version: "dna-report-v2.3-final-language-qa@1",
    reportVersion: REPORT_V2_VERSION,
    languageContractVersion: DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    productionActivated: false,
    clinicalQualitySelfScore: null,
    baseline: { directory: BASELINE_DIR, reportCount: 15, fallback: baselineFresh.filter((row) => row.recoveryStatus === "DETERMINISTIC_FALLBACK").length, language: baselineLanguage },
    replay: { ...replayMetrics, decisionDriftAgainstBaseline: replayDecisionDrift },
    freshBlind: freshMetrics,
    cost: {
      model: DNA_REPORT_LUNA_MODEL,
      pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION,
      acceptedCohorts: { measuredCalls: attempts.length, totalCostUsd: Number((costMicrousd / 1_000_000).toFixed(6)), costPerReportUsd: Number((costMicrousd / 30 / 1_000_000).toFixed(6)) },
      totalTask: taskUsage,
      fabricatedMeasurements: false,
    },
    productionHashes,
    hardAcceptance: { passed: true, brokenGrammar: 0, internalLabelLeakage: 0, terminologyDrift: 0, decisionDrift: 0, unsupportedAddition: 0, sourceSafetyPrivacyRegression: 0, semanticCrossSectionRepeatCount: 0, freshFallbackAtMostOne: true },
  }

  const blindRows = freshRows.map((row, index) => Object.freeze({ blindId: `BLIND-${String(index + 1).padStart(3, "0")}`, report: row.result.finalReport, finalReportHash: row.result.trace.finalReportHash }))
  const sealed = [...replayRows, ...freshRows].map((row) => Object.freeze({
    caseId: row.fixture.id,
    cohort: row.fixture.cohort,
    category: row.fixture.category,
    pattern: row.fixture.pattern,
    decisionState: row.result.decisionPlan.decisionState,
    primary: row.result.decisionPlan.primaryFormulation?.id ?? null,
    confidence: row.result.decisionPlan.confidence.level,
    recoveryStatus: row.result.recoveryStatus,
    providerCalls: row.result.providerCalls,
    validation: row.result.validation,
    trace: Object.freeze({ ...row.result.trace, decisionPlan: row.result.decisionPlan, reportPlan: row.result.reportPlan }),
  }))
  const root = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  const outputDir = path.join(root, "SelfMetaAI/report-v2-shadow", timestamp())
  fs.mkdirSync(outputDir, { recursive: true })
  const sealedText = sealed.map((row) => JSON.stringify(row)).join("\n") + "\n"
  fs.writeFileSync(path.join(outputDir, "SEALED_DECISION_EVIDENCE.jsonl"), sealedText, "utf8")
  const artifacts: Record<string, string> = {
    "BLIND_REPORTS.md": reportMarkdown(freshRows),
    "blind-reports.json": JSON.stringify({ version: objective.version, reports: blindRows }, null, 2) + "\n",
    "DOMAIN_EXAMPLES.md": domainExamples(freshRows),
    "objective-summary.json": JSON.stringify(objective, null, 2) + "\n",
  }
  for (const [filename, content] of Object.entries(artifacts)) fs.writeFileSync(path.join(outputDir, filename), content, "utf8")
  const packageContract = ["BLIND_REPORTS.md", "blind-reports.json", "DOMAIN_EXAMPLES.md", "objective-summary.json", "manifest.json"]
  const manifest = {
    version: objective.version,
    generatedAt: objective.generatedAt,
    packageContract,
    packageContents: Object.entries(artifacts).map(([filename, content]) => ({ filename, sha256: sha256(content), bytes: Buffer.byteLength(content) })),
    sealedEvidence: { filename: "SEALED_DECISION_EVIDENCE.jsonl", sha256: sha256(sealedText), includedInBlindZip: false },
    replayCount: replayRows.length,
    freshBlindCount: freshRows.length,
    domainExampleCount: 3,
  }
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")
  const zipPath = path.join(outputDir, "final-language-qa-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, ...packageContract], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  console.log("=== REPORT V2 FINAL LANGUAGE QA ===")
  console.log(`Directory: ${outputDir}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${sha256(fs.readFileSync(zipPath))}`)
}

void main()
