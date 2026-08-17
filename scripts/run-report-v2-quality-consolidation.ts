import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import type { DomainKey, DomainLevel, DomainResult } from "../src/lib/dna/reportEngine"
import {
  REPORT_SECTION_HEADINGS,
  REPORT_V2_VERSION,
  type ReportRealizer,
  type ReportSectionId,
  type ReportV2ShadowResult,
} from "../src/lib/dna/reportV2/contracts"
import {
  DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
  repeatedTemplatePhraseDiagnostics,
  section2ThresholdSentenceCount,
  semanticCrossSectionRepeatCount,
} from "../src/lib/dna/reportV2/languageContract"
import {
  DNA_REPORT_LUNA_MODEL,
  DNA_REPORT_LUNA_PRICING_VERSION,
  LunaReportRealizer,
} from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { auditSelectedReportKnowledgeRelevance } from "../src/lib/dna/reportV2/reportKnowledgeBridge"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import {
  buildFinalLanguageQaCases,
  buildQualityConsolidationCases,
  type ReportV2SyntheticCase,
} from "./report-v2-cases"

type Cohort = "replay-current-fresh-15" | "fresh-blind-15"
type QualityCase = Readonly<{
  id: string
  category: string
  pattern: string
  cohort: Cohort
  input: ReportV2SyntheticCase["input"]
}>
type QualityRow = Readonly<{ fixture: QualityCase; result: ReportV2ShadowResult }>
type BaselineSealedRow = Readonly<{
  caseId: string
  cohort: string
  category: string
  pattern: string
  decisionState: string
  primary: string | null
  confidence: string
  recoveryStatus: ReportV2ShadowResult["recoveryStatus"]
  providerCalls: number
  validation: ReportV2ShadowResult["validation"]
  trace: ReportV2ShadowResult["trace"]
}>

const BASELINE_DIR = process.env.REPORT_V2_QUALITY_BASELINE_DIR
  || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260812T115239Z"
const COST_CAP_MICROUSD = 500_000
const DISTRIBUTION = Object.freeze([
  ["sensory", "single-domain-sensory"],
  ["executive", "single-domain-executive"],
  ["emotional", "single-domain-emotional"],
  ["physiological", "single-domain-physiological"],
  ["interoception", "single-domain-interoception"],
  ["cognitive", "single-domain-cognitive"],
  ["multi-domain", "multi-domain"],
  ["balanced", "balanced-preserved"],
  ["uncertain", "dna-external-sensory-discrepancy"],
  ["discrepancy", "external-disagreement"],
  ["preserved-under-support", "no-therapist-observation"],
  ["low-evidence", "low-score-no-functional-evidence"],
  ["conflicting-evidence", "anamnesis-dna-discrepancy"],
  ["high-confidence-functional", "adaptive-daily-living"],
  ["low-confidence-contextual", "contextual-mixed"],
] as const)
const DOMAIN_KEYS: readonly DomainKey[] = Object.freeze(["physiological", "sensory", "emotional", "cognitive", "executive", "interoception"])
const DOMAIN_LABELS: Readonly<Record<DomainKey, string>> = Object.freeze({
  physiological: "Fizyolojik Regülasyon",
  sensory: "Duyusal Regülasyon",
  emotional: "Duygusal Regülasyon",
  cognitive: "Bilişsel Regülasyon",
  executive: "Yürütücü İşlev",
  interoception: "İnterosepsiyon",
})

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
    return Object.freeze({
      sectionId: `section_${index + 1}` as ReportSectionId,
      text: start >= 0 ? report.slice(start + heading.length, next < 0 ? report.length : next).trim() : "",
    })
  })
}

function textMetrics(texts: readonly string[]) {
  const semanticByReport = texts.map((text) => semanticCrossSectionRepeatCount(parseSections(text)))
  const templateByReport = texts.map((text) => repeatedTemplatePhraseDiagnostics(text).total)
  const thresholdByReport = texts.map((text) => {
    const section2 = parseSections(text).find((section) => section.sectionId === "section_2")?.text ?? ""
    return section2ThresholdSentenceCount(section2)
  })
  return Object.freeze({
    semanticCrossSectionRepetition: semanticByReport.reduce((sum, value) => sum + value, 0),
    repeatedTemplatePhraseCount: templateByReport.reduce((sum, value) => sum + value, 0),
    section2ThresholdSentenceCount: thresholdByReport.reduce((sum, value) => sum + value, 0),
    maxSection2ThresholdSentenceCount: Math.max(...thresholdByReport),
  })
}

function baselineDomainResults(row: BaselineSealedRow): DomainResult[] {
  return DOMAIN_KEYS.map((key) => Object.freeze({
    key,
    name: DOMAIN_LABELS[key],
    label: DOMAIN_LABELS[key],
    score: row.trace.scores[key] ?? 0,
    level: row.trace.domainLevels[key] as DomainLevel,
    comment: "",
  }))
}

function baselineRelevance(rows: readonly BaselineSealedRow[]) {
  const decisions = rows.flatMap((row) => auditSelectedReportKnowledgeRelevance({
    decisionPlan: row.trace.decisionPlan,
    domainResults: baselineDomainResults(row),
    matrix: row.trace.evidenceMatrix,
    selectedAtoms: row.trace.reportPlan.knowledgeBridge.selectedAtoms,
  }))
  return Object.freeze({
    irrelevantKnowledgeClaimCount: decisions.filter((decision) => decision.relevance === "IRRELEVANT").length,
    secondaryDomainOverexplanationCount: decisions.filter((decision) => decision.reasons.includes("SECONDARY_PRESERVED_WITHOUT_CASE_FUNCTION")).length,
    auditedSelectedAtomCount: decisions.length,
  })
}

function selectCases(fixtures: readonly ReportV2SyntheticCase[], cohort: Cohort) {
  return DISTRIBUTION.map(([category, pattern]) => {
    const fixture = fixtures.find((candidate) => candidate.pattern === pattern)
    if (!fixture) throw new Error(`quality_consolidation_case_missing:${pattern}`)
    return Object.freeze({ id: fixture.id, category, pattern, cohort, input: fixture.input })
  })
}

async function runCases(cases: readonly QualityCase[], realizer: ReportRealizer, checkpoint: string) {
  const rows: QualityRow[] = []
  for (const [index, fixture] of cases.entries()) {
    const result = await runReportV2Shadow(fixture.input, { realizer, literatureMode: "STANDARD" })
    assert.equal(result.validation.pass, true, `${fixture.id}:${result.validation.failureCodes.join(",")}`)
    rows.push(Object.freeze({ fixture, result }))
    fs.appendFileSync(checkpoint, JSON.stringify({
      caseId: fixture.id,
      cohort: fixture.cohort,
      category: fixture.category,
      pattern: fixture.pattern,
      decisionState: result.decisionPlan.decisionState,
      primary: result.decisionPlan.primaryFormulation?.id ?? null,
      confidence: result.decisionPlan.confidence.level,
      recoveryStatus: result.recoveryStatus,
      providerCalls: result.providerCalls,
      validation: result.validation,
      finalReport: result.finalReport,
      attempts: result.trace.realizationAttempts,
      trace: result.trace,
    }) + "\n", "utf8")
    console.log(`quality-consolidation ${index + 1}/${cases.length}: ${fixture.cohort}:${fixture.id} ${result.recoveryStatus}`)
  }
  return Object.freeze(rows)
}

function measuredAttempts(rows: readonly QualityRow[]) {
  return rows.flatMap((row) => row.result.trace.realizationAttempts)
    .filter((attempt) => attempt.provider === "luna" && (attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0))
}

function cohortMetrics(rows: readonly QualityRow[]) {
  const attempts = measuredAttempts(rows)
  const costMicrousd = attempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  const text = textMetrics(rows.map((row) => row.result.finalReport))
  return Object.freeze({
    reportCount: rows.length,
    direct: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length,
    controlledRepair: rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR").length,
    lunaRepaired: rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length,
    repaired: rows.filter((row) => ["CONTROLLED_REPAIR", "LUNA_REPAIRED"].includes(row.result.recoveryStatus)).length,
    fallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    providerCalls: rows.reduce((sum, row) => sum + row.result.providerCalls, 0),
    maxCallsPerReport: Math.max(...rows.map((row) => row.result.providerCalls)),
    ...text,
    irrelevantKnowledgeClaimCount: rows.reduce((sum, row) => sum + row.result.validation.irrelevantKnowledgeClaimCount, 0),
    secondaryDomainOverexplanationCount: rows.reduce((sum, row) => sum + row.result.validation.secondaryDomainOverexplanationCount, 0),
    decisionDrift: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    sourceViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeSourceViolationCount, 0),
    authorityViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeAuthorityViolationCount, 0),
    safetyViolation: rows.filter((row) => row.result.validation.failureCodes.includes("SAFETY_VIOLATION")).length,
    privacyViolation: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    totalCostMicrousd: costMicrousd,
    totalCostUsd: Number((costMicrousd / 1_000_000).toFixed(6)),
    costPerReportUsd: Number((costMicrousd / rows.length / 1_000_000).toFixed(6)),
  })
}

function assertCohort(metrics: ReturnType<typeof cohortMetrics>) {
  assert.equal(metrics.reportCount, 15)
  assert.equal(metrics.irrelevantKnowledgeClaimCount, 0)
  assert.equal(metrics.secondaryDomainOverexplanationCount, 0)
  assert.equal(metrics.semanticCrossSectionRepetition, 0)
  assert.equal(metrics.maxSection2ThresholdSentenceCount <= 1, true)
  assert.equal(metrics.decisionDrift, 0)
  assert.equal(metrics.unsupportedAddition, 0)
  assert.equal(metrics.sourceViolation, 0)
  assert.equal(metrics.authorityViolation, 0)
  assert.equal(metrics.safetyViolation, 0)
  assert.equal(metrics.privacyViolation, 0)
  assert.equal(metrics.fallback <= 1, true)
  assert.equal(metrics.maxCallsPerReport <= 2, true)
}

function blindMarkdown(rows: readonly QualityRow[]) {
  return [
    "# DNA Intelligence — Son Kalite Konsolidasyonu Kör Raporları",
    "",
    "Bu dosyada teknik trace, beklenen karar veya Codex dil kalite puanı yoktur.",
    "",
    ...rows.flatMap((row, index) => [`## BLIND-${String(index + 1).padStart(3, "0")}`, "", row.result.finalReport, ""]),
  ].join("\n")
}

async function main() {
  const apiKey = loadLocalApiKey()
  if (!apiKey) throw new Error("OPENAI_API_KEY unavailable")

  const baselineSealed = fs.readFileSync(path.join(BASELINE_DIR, "SEALED_DECISION_EVIDENCE.jsonl"), "utf8")
    .trim().split(/\n/u).filter(Boolean).map((line) => JSON.parse(line) as BaselineSealedRow)
  const baselineRows = baselineSealed.filter((row) => row.cohort === "fresh-blind-15")
  assert.equal(baselineRows.length, 15)
  const baselineBlind = JSON.parse(fs.readFileSync(path.join(BASELINE_DIR, "blind-reports.json"), "utf8")) as Readonly<{ reports: readonly Readonly<{ report: string }>[] }>
  assert.equal(baselineBlind.reports.length, 15)
  const baselineText = textMetrics(baselineBlind.reports.map((row) => row.report))
  const baselineKnowledge = baselineRelevance(baselineRows)
  const baselineById = new Map(baselineRows.map((row) => [row.caseId, row]))

  const replayCases = selectCases(buildFinalLanguageQaCases(), "replay-current-fresh-15")
  const freshCases = selectCases(buildQualityConsolidationCases(), "fresh-blind-15")
  assert.equal(new Set([...replayCases, ...freshCases].map((fixture) => fixture.id)).size, 30)
  const checkpoint = path.join("/tmp", `report-v2-quality-consolidation-${timestamp()}.jsonl`)
  fs.writeFileSync(checkpoint, "", "utf8")

  const replayRows = await runCases(replayCases, new LunaReportRealizer({
    apiKey,
    safetyIdentifier: "report-v2-quality-consolidation-replay",
    maxTotalCostMicrousd: COST_CAP_MICROUSD,
  }), checkpoint)
  const freshRows = await runCases(freshCases, new LunaReportRealizer({
    apiKey,
    safetyIdentifier: "report-v2-quality-consolidation-fresh",
    maxTotalCostMicrousd: COST_CAP_MICROUSD,
  }), checkpoint)

  const replayMetrics = cohortMetrics(replayRows)
  const freshMetrics = cohortMetrics(freshRows)
  assertCohort(replayMetrics)
  assertCohort(freshMetrics)
  const replayDecisionDrift = replayRows.filter((row) => {
    const baseline = baselineById.get(row.fixture.id)
    return !baseline
      || baseline.decisionState !== row.result.decisionPlan.decisionState
      || baseline.primary !== (row.result.decisionPlan.primaryFormulation?.id ?? null)
      || baseline.confidence !== row.result.decisionPlan.confidence.level
  }).length
  assert.equal(replayDecisionDrift, 0)

  const baselineVersion = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string }>
  const productionHashes = Object.freeze({
    routeSha256: sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts"))),
    reportEngineSha256: sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts"))),
  })
  assert.equal(productionHashes.routeSha256, baselineVersion.routeSha256)
  assert.equal(productionHashes.reportEngineSha256, baselineVersion.reportEngineSha256)

  const acceptedAttempts = measuredAttempts([...replayRows, ...freshRows])
  const acceptedCostMicrousd = acceptedAttempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  const objective = Object.freeze({
    version: "dna-report-v2.3-quality-consolidation@1",
    reportVersion: REPORT_V2_VERSION,
    languageContractVersion: DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    productionActivated: false,
    clinicalQualitySelfScore: null,
    baseline: Object.freeze({ directory: BASELINE_DIR, reportCount: 15, ...baselineKnowledge, ...baselineText }),
    replay: Object.freeze({ ...replayMetrics, decisionDriftAgainstBaseline: replayDecisionDrift }),
    freshBlind: freshMetrics,
    beforeAfter: Object.freeze({
      irrelevantKnowledgeClaim: Object.freeze({ before: baselineKnowledge.irrelevantKnowledgeClaimCount, after: replayMetrics.irrelevantKnowledgeClaimCount }),
      secondaryDomainOverexplanation: Object.freeze({ before: baselineKnowledge.secondaryDomainOverexplanationCount, after: replayMetrics.secondaryDomainOverexplanationCount }),
      semanticCrossSectionRepetition: Object.freeze({ before: baselineText.semanticCrossSectionRepetition, after: replayMetrics.semanticCrossSectionRepetition }),
      repeatedTemplatePhrase: Object.freeze({ before: baselineText.repeatedTemplatePhraseCount, after: replayMetrics.repeatedTemplatePhraseCount }),
      section2ThresholdSentence: Object.freeze({ before: baselineText.section2ThresholdSentenceCount, after: replayMetrics.section2ThresholdSentenceCount, maxAfterPerReport: replayMetrics.maxSection2ThresholdSentenceCount }),
    }),
    cost: Object.freeze({
      model: DNA_REPORT_LUNA_MODEL,
      pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION,
      measuredCalls: acceptedAttempts.length,
      totalCostMicrousd: acceptedCostMicrousd,
      totalCostUsd: Number((acceptedCostMicrousd / 1_000_000).toFixed(6)),
      costPerReportUsd: Number((acceptedCostMicrousd / 30 / 1_000_000).toFixed(6)),
      fabricatedMeasurements: false,
    }),
    productionHashes,
    hardAcceptance: Object.freeze({
      passed: true,
      irrelevantKnowledgeClaim: 0,
      secondaryDomainOverexplanation: 0,
      decisionDrift: 0,
      unsupportedAddition: 0,
      sourceAuthorityViolation: 0,
      safetyPrivacyRegression: 0,
      freshFallbackAtMostOne: true,
    }),
  })

  const blindRows = freshRows.map((row, index) => Object.freeze({
    blindId: `BLIND-${String(index + 1).padStart(3, "0")}`,
    report: row.result.finalReport,
    finalReportHash: row.result.trace.finalReportHash,
  }))
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
    trace: row.result.trace,
  }))
  const outputDir = path.join(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD", "SelfMetaAI/report-v2-shadow", timestamp())
  fs.mkdirSync(outputDir, { recursive: true })
  const sealedText = sealed.map((row) => JSON.stringify(row)).join("\n") + "\n"
  fs.writeFileSync(path.join(outputDir, "SEALED_DECISION_EVIDENCE.jsonl"), sealedText, "utf8")
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
  const zipPath = path.join(outputDir, "quality-consolidation-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, ...packageContract], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  console.log("=== REPORT V2 QUALITY CONSOLIDATION ===")
  console.log(`Checkpoint: ${checkpoint}`)
  console.log(`Directory: ${outputDir}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${sha256(fs.readFileSync(zipPath))}`)
}

void main()
