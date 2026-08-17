import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  REPORT_SECTION_HEADINGS,
  REPORT_V2_VERSION,
  type ReportRealizer,
  type ReportSectionId,
  type ReportV2ShadowResult,
} from "../src/lib/dna/reportV2/contracts"
import { auditIntraSectionConsistency } from "../src/lib/dna/reportV2/intraSectionConsistencyGate"
import {
  DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
  repeatedTemplatePhraseDiagnostics,
} from "../src/lib/dna/reportV2/languageContract"
import {
  DNA_REPORT_LUNA_MODEL,
  DNA_REPORT_LUNA_PRICING_VERSION,
  LunaReportRealizer,
} from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import {
  buildConsistencyNaturalLanguageCases,
  buildQualityConsolidationCases,
  type ReportV2SyntheticCase,
} from "./report-v2-cases"

type Cohort = "replay-existing-fresh-15" | "fresh-blind-15"
type EvaluationCase = Readonly<{
  id: string
  pattern: string
  cohort: Cohort
  input: ReportV2SyntheticCase["input"]
}>
type EvaluationRow = Readonly<{ fixture: EvaluationCase; result: ReportV2ShadowResult }>
type BaselineRow = Readonly<{
  caseId: string
  cohort: string
  pattern: string
  trace: ReportV2ShadowResult["trace"]
  decisionState: string
  primary: string | null
  confidence: string
}>

const BASELINE_DIR = process.env.REPORT_V2_CONSISTENCY_BASELINE_DIR
  || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260812T122304Z"
const COST_CAP_MICROUSD = 500_000

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

function parseReport(report: string) {
  return Object.freeze({
    version: "report-realization@2" as const,
    unsupportedAddition: false,
    unsupportedSectionIds: Object.freeze([]),
    sections: Object.freeze(REPORT_SECTION_HEADINGS.map((heading, index) => {
      const start = report.indexOf(heading)
      const next = index + 1 < REPORT_SECTION_HEADINGS.length ? report.indexOf(REPORT_SECTION_HEADINGS[index + 1]!) : report.length
      return Object.freeze({
        sectionId: `section_${index + 1}` as ReportSectionId,
        text: start >= 0 ? report.slice(start + heading.length, next < 0 ? report.length : next).trim() : "",
        usedClaimIds: Object.freeze([]),
      })
    })),
  })
}

function baselineMetrics(rows: readonly BaselineRow[], reports: readonly string[]) {
  const audits = rows.map((row, index) => auditIntraSectionConsistency({ matrix: row.trace.evidenceMatrix, realization: parseReport(reports[index] ?? "") }))
  return Object.freeze({
    reportCount: rows.length,
    intraSectionContradictionCount: audits.reduce((sum, audit) => sum + audit.intraSectionContradictionCount, 0),
    evidencePolarityConflictCount: audits.reduce((sum, audit) => sum + audit.semanticPolarityConflictCount, 0),
    unresolvedEvidenceContradictionCount: audits.reduce((sum, audit) => sum + audit.crossEvidenceContradictionCount, 0),
    reconciliationSentenceCount: audits.reduce((sum, audit) => sum + audit.reconciliationSentenceCount, 0),
    expectedReconciliationCount: rows.reduce((sum, row) => sum + row.trace.evidenceMatrix.discrepancyClusters.length, 0),
    repeatedTemplatePhraseCount: reports.reduce((sum, report) => sum + repeatedTemplatePhraseDiagnostics(report).total, 0),
  })
}

async function runCases(cases: readonly EvaluationCase[], realizer: ReportRealizer, checkpoint: string) {
  const rows: EvaluationRow[] = []
  for (const [index, fixture] of cases.entries()) {
    const result = await runReportV2Shadow(fixture.input, { realizer, literatureMode: "STANDARD" })
    assert.equal(result.validation.pass, true, `${fixture.id}:${result.validation.failureCodes.join(",")}`)
    rows.push(Object.freeze({ fixture, result }))
    fs.appendFileSync(checkpoint, JSON.stringify({
      caseId: fixture.id,
      cohort: fixture.cohort,
      pattern: fixture.pattern,
      recoveryStatus: result.recoveryStatus,
      providerCalls: result.providerCalls,
      validation: result.validation,
      finalReport: result.finalReport,
      trace: result.trace,
    }) + "\n", "utf8")
    console.log(`final-consistency ${index + 1}/${cases.length}: ${fixture.cohort}:${fixture.id} ${result.recoveryStatus}`)
  }
  return Object.freeze(rows)
}

function cohortMetrics(rows: readonly EvaluationRow[]) {
  const attempts = rows.flatMap((row) => row.result.trace.realizationAttempts)
    .filter((attempt) => attempt.provider === "luna" && (attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0))
  const costMicrousd = attempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  return Object.freeze({
    reportCount: rows.length,
    direct: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length,
    controlledRepair: rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR").length,
    lunaRepair: rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length,
    fallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    providerCalls: rows.reduce((sum, row) => sum + row.result.providerCalls, 0),
    maxCallsPerReport: Math.max(...rows.map((row) => row.result.providerCalls)),
    intraSectionContradictionCount: rows.reduce((sum, row) => sum + row.result.validation.intraSectionContradictionCount, 0),
    evidencePolarityConflictCount: rows.reduce((sum, row) => sum + row.result.validation.semanticPolarityConflictCount, 0),
    unresolvedEvidenceContradictionCount: rows.reduce((sum, row) => sum + row.result.validation.crossEvidenceContradictionCount, 0),
    reconciliationSentenceCount: rows.reduce((sum, row) => sum + row.result.validation.reconciliationSentenceCount, 0),
    expectedReconciliationCount: rows.reduce((sum, row) => sum + row.result.evidenceMatrix.discrepancyClusters.length, 0),
    repeatedTemplatePhraseCount: rows.reduce((sum, row) => sum + row.result.validation.repeatedTemplatePhraseCount, 0),
    irrelevantKnowledgeCount: rows.reduce((sum, row) => sum + row.result.validation.irrelevantKnowledgeClaimCount, 0),
    secondaryDomainOverexplanation: rows.reduce((sum, row) => sum + row.result.validation.secondaryDomainOverexplanationCount, 0),
    decisionDrift: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    sourceViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeSourceViolationCount, 0),
    authorityViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeAuthorityViolationCount, 0),
    safetyViolation: rows.filter((row) => row.result.validation.failureCodes.includes("SAFETY_VIOLATION")).length,
    privacyViolation: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    measuredCalls: attempts.length,
    totalCostMicrousd: costMicrousd,
    totalCostUsd: Number((costMicrousd / 1_000_000).toFixed(6)),
    costPerReportUsd: Number((costMicrousd / rows.length / 1_000_000).toFixed(6)),
  })
}

function assertAcceptance(metrics: ReturnType<typeof cohortMetrics>) {
  assert.equal(metrics.reportCount, 15)
  assert.equal(metrics.intraSectionContradictionCount, 0)
  assert.equal(metrics.evidencePolarityConflictCount, 0)
  assert.equal(metrics.unresolvedEvidenceContradictionCount, 0)
  assert.equal(metrics.reconciliationSentenceCount, metrics.expectedReconciliationCount)
  assert.equal(metrics.irrelevantKnowledgeCount, 0)
  assert.equal(metrics.secondaryDomainOverexplanation, 0)
  assert.equal(metrics.decisionDrift, 0)
  assert.equal(metrics.unsupportedAddition, 0)
  assert.equal(metrics.sourceViolation, 0)
  assert.equal(metrics.authorityViolation, 0)
  assert.equal(metrics.safetyViolation, 0)
  assert.equal(metrics.privacyViolation, 0)
  assert.equal(metrics.fallback <= 1, true)
  assert.equal(metrics.maxCallsPerReport <= 2, true)
}

function blindMarkdown(rows: readonly EvaluationRow[]) {
  return [
    "# DNA Intelligence — Final Consistency + Natural Language Kör Raporları",
    "",
    "Bu dosyada teknik trace, beklenen karar veya Codex kalite puanı yoktur.",
    "",
    ...rows.flatMap((row, index) => [`## BLIND-${String(index + 1).padStart(3, "0")}`, "", row.result.finalReport, ""]),
  ].join("\n")
}

async function main() {
  const sealedRows = fs.readFileSync(path.join(BASELINE_DIR, "SEALED_DECISION_EVIDENCE.jsonl"), "utf8")
    .trim().split(/\n/u).filter(Boolean).map((line) => JSON.parse(line) as BaselineRow)
  const baselineRows = sealedRows.filter((row) => row.cohort === "fresh-blind-15")
  const baselineBlind = JSON.parse(fs.readFileSync(path.join(BASELINE_DIR, "blind-reports.json"), "utf8")) as Readonly<{ reports: readonly Readonly<{ report: string }>[] }>
  assert.equal(baselineRows.length, 15)
  assert.equal(baselineBlind.reports.length, 15)
  const baseline = baselineMetrics(baselineRows, baselineBlind.reports.map((row) => row.report))

  const repackageDir = process.env.REPORT_V2_FINAL_CONSISTENCY_REPACKAGE_FROM?.trim()
  if (repackageDir) {
    const objectivePath = path.join(repackageDir, "objective-summary.json")
    const previous = JSON.parse(fs.readFileSync(objectivePath, "utf8")) as Record<string, unknown>
    const previousBeforeAfter = previous.beforeAfter as Record<string, unknown>
    const previousIntra = previousBeforeAfter.intraSectionContradiction as Record<string, unknown>
    const previousPolarity = previousBeforeAfter.evidencePolarityConflict as Record<string, unknown>
    const objective = Object.freeze({
      ...previous,
      baseline: Object.freeze({ directory: BASELINE_DIR, ...baseline }),
      beforeAfter: Object.freeze({
        ...previousBeforeAfter,
        intraSectionContradiction: Object.freeze({ ...previousIntra, before: baseline.intraSectionContradictionCount }),
        evidencePolarityConflict: Object.freeze({ ...previousPolarity, before: baseline.evidencePolarityConflictCount }),
      }),
    })
    fs.writeFileSync(objectivePath, JSON.stringify(objective, null, 2) + "\n", "utf8")
    const artifactNames = ["BLIND_REPORTS.md", "blind-reports.json", "objective-summary.json"]
    const artifacts = Object.fromEntries(artifactNames.map((filename) => [filename, fs.readFileSync(path.join(repackageDir, filename), "utf8")])) as Record<string, string>
    const sealedText = fs.readFileSync(path.join(repackageDir, "SEALED_DECISION_EVIDENCE.jsonl"), "utf8")
    const manifestPath = path.join(repackageDir, "manifest.json")
    const previousManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>
    const manifest = Object.freeze({
      ...previousManifest,
      packageContents: Object.entries(artifacts).map(([filename, content]) => Object.freeze({ filename, sha256: sha256(content), bytes: Buffer.byteLength(content) })),
      sealedEvidence: Object.freeze({ filename: "SEALED_DECISION_EVIDENCE.jsonl", sha256: sha256(sealedText), includedInBlindZip: false }),
    })
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8")
    const zipPath = path.join(repackageDir, "final-consistency-natural-language-blind.zip")
    const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, "BLIND_REPORTS.md", "blind-reports.json", "objective-summary.json", "manifest.json"], { cwd: repackageDir, encoding: "utf8" })
    if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
    console.log(`Repackaged: ${zipPath}`)
    console.log(`ZIP SHA-256: ${sha256(fs.readFileSync(zipPath))}`)
    return
  }

  const apiKey = loadLocalApiKey()
  if (!apiKey) throw new Error("OPENAI_API_KEY unavailable")

  const replayCases = buildQualityConsolidationCases().map((fixture) => Object.freeze({ id: fixture.id, pattern: fixture.pattern, cohort: "replay-existing-fresh-15" as const, input: fixture.input }))
  const freshCases = buildConsistencyNaturalLanguageCases().map((fixture) => Object.freeze({ id: fixture.id, pattern: fixture.pattern, cohort: "fresh-blind-15" as const, input: fixture.input }))
  const checkpoint = path.join("/tmp", `report-v2-final-consistency-${timestamp()}.jsonl`)
  fs.writeFileSync(checkpoint, "", "utf8")
  const replayRows = await runCases(replayCases, new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2-final-consistency-replay", maxTotalCostMicrousd: COST_CAP_MICROUSD }), checkpoint)
  const freshRows = await runCases(freshCases, new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2-final-consistency-fresh", maxTotalCostMicrousd: COST_CAP_MICROUSD }), checkpoint)
  const replay = cohortMetrics(replayRows)
  const fresh = cohortMetrics(freshRows)
  assertAcceptance(replay)
  assertAcceptance(fresh)
  const baselineById = new Map(baselineRows.map((row) => [row.caseId, row]))
  const replayDecisionDrift = replayRows.filter((row) => {
    const before = baselineById.get(row.fixture.id)
    return !before
      || before.decisionState !== row.result.decisionPlan.decisionState
      || before.primary !== (row.result.decisionPlan.primaryFormulation?.id ?? null)
      || before.confidence !== row.result.decisionPlan.confidence.level
  }).length
  assert.equal(replayDecisionDrift, 0)

  const baselineVersion = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string }>
  const productionHashes = Object.freeze({
    routeSha256: sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts"))),
    reportEngineSha256: sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts"))),
  })
  assert.equal(productionHashes.routeSha256, baselineVersion.routeSha256)
  assert.equal(productionHashes.reportEngineSha256, baselineVersion.reportEngineSha256)

  const totalCostMicrousd = replay.totalCostMicrousd + fresh.totalCostMicrousd
  const objective = Object.freeze({
    version: "dna-report-v2.3-final-consistency-natural-language@1",
    reportVersion: REPORT_V2_VERSION,
    languageContractVersion: DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    productionActivated: false,
    clinicalQualitySelfScore: null,
    baseline: Object.freeze({ directory: BASELINE_DIR, ...baseline }),
    replay: Object.freeze({ ...replay, decisionDriftAgainstBaseline: replayDecisionDrift }),
    freshBlind: fresh,
    beforeAfter: Object.freeze({
      intraSectionContradiction: Object.freeze({ before: baseline.intraSectionContradictionCount, after: replay.intraSectionContradictionCount }),
      evidencePolarityConflict: Object.freeze({ before: baseline.evidencePolarityConflictCount, after: replay.evidencePolarityConflictCount }),
      repeatedTemplatePhrase: Object.freeze({ before: baseline.repeatedTemplatePhraseCount, after: replay.repeatedTemplatePhraseCount }),
    }),
    reconciliation: Object.freeze({ replay: `${replay.reconciliationSentenceCount}/${replay.expectedReconciliationCount}`, fresh: `${fresh.reconciliationSentenceCount}/${fresh.expectedReconciliationCount}`, unresolved: 0 }),
    cost: Object.freeze({
      model: DNA_REPORT_LUNA_MODEL,
      pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION,
      measuredCalls: replay.measuredCalls + fresh.measuredCalls,
      totalCostMicrousd,
      totalCostUsd: Number((totalCostMicrousd / 1_000_000).toFixed(6)),
      costPerReportUsd: Number((totalCostMicrousd / 30 / 1_000_000).toFixed(6)),
      fabricatedMeasurements: false,
    }),
    productionHashes,
    hardAcceptance: Object.freeze({ passed: true }),
  })

  const outputDir = path.join(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD", "SelfMetaAI/report-v2-shadow", timestamp())
  fs.mkdirSync(outputDir, { recursive: true })
  const sealed = [...replayRows, ...freshRows].map((row) => Object.freeze({
    caseId: row.fixture.id,
    cohort: row.fixture.cohort,
    pattern: row.fixture.pattern,
    decisionState: row.result.decisionPlan.decisionState,
    primary: row.result.decisionPlan.primaryFormulation?.id ?? null,
    confidence: row.result.decisionPlan.confidence.level,
    recoveryStatus: row.result.recoveryStatus,
    providerCalls: row.result.providerCalls,
    validation: row.result.validation,
    trace: row.result.trace,
  }))
  const sealedText = sealed.map((row) => JSON.stringify(row)).join("\n") + "\n"
  fs.writeFileSync(path.join(outputDir, "SEALED_DECISION_EVIDENCE.jsonl"), sealedText, "utf8")
  const blindRows = freshRows.map((row, index) => Object.freeze({ blindId: `BLIND-${String(index + 1).padStart(3, "0")}`, report: row.result.finalReport, finalReportHash: row.result.trace.finalReportHash }))
  const artifacts: Record<string, string> = {
    "BLIND_REPORTS.md": blindMarkdown(freshRows),
    "blind-reports.json": JSON.stringify({ version: objective.version, reports: blindRows }, null, 2) + "\n",
    "objective-summary.json": JSON.stringify(objective, null, 2) + "\n",
  }
  for (const [filename, content] of Object.entries(artifacts)) fs.writeFileSync(path.join(outputDir, filename), content, "utf8")
  const packageContract = ["BLIND_REPORTS.md", "blind-reports.json", "objective-summary.json", "manifest.json"]
  const manifest = Object.freeze({
    version: objective.version,
    generatedAt: objective.generatedAt,
    packageContract,
    packageContents: Object.entries(artifacts).map(([filename, content]) => Object.freeze({ filename, sha256: sha256(content), bytes: Buffer.byteLength(content) })),
    sealedEvidence: Object.freeze({ filename: "SEALED_DECISION_EVIDENCE.jsonl", sha256: sha256(sealedText), includedInBlindZip: false }),
    replayCount: replayRows.length,
    freshBlindCount: freshRows.length,
  })
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")
  const zipPath = path.join(outputDir, "final-consistency-natural-language-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, ...packageContract], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  console.log("=== REPORT V2 FINAL CONSISTENCY + NATURAL LANGUAGE ===")
  console.log(`Checkpoint: ${checkpoint}`)
  console.log(`Directory: ${outputDir}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${sha256(fs.readFileSync(zipPath))}`)
}

void main()
