import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { REPORT_SECTION_HEADINGS, REPORT_V2_VERSION, type ReportRealizer, type ReportSectionId, type ReportV2ShadowResult } from "../src/lib/dna/reportV2/contracts"
import { LunaReportRealizer, DNA_REPORT_LUNA_MODEL, DNA_REPORT_LUNA_PRICING_VERSION } from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { crossSectionRepetitionCount, DNA_REPORT_LANGUAGE_CONTRACT_VERSION, reportLanguageDiagnostics } from "../src/lib/dna/reportV2/languageContract"
import { stableHash } from "../src/lib/dna/reportV2/evidenceEngine"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import { buildFreshReportV2Cases, type ReportV2SyntheticCase } from "./report-v2-cases"

type PilotCase = Readonly<{
  id: string
  category: string
  pattern: string
  cohort: "replay-existing-15" | "fresh-new-15"
  input: ReportV2SyntheticCase["input"]
}>

type PilotRow = Readonly<{ fixture: PilotCase; result: ReportV2ShadowResult }>

type CheckpointRow = Readonly<{
  caseId: string
  recoveryStatus: ReportV2ShadowResult["recoveryStatus"]
  providerCalls: number
  validation: ReportV2ShadowResult["validation"]
  validatorResults?: ReportV2ShadowResult["trace"]["validatorResults"]
  finalReport: string
  attempts: ReportV2ShadowResult["trace"]["realizationAttempts"]
}>

type BaselineSealedRow = Readonly<{
  caseId: string
  decisionState: string
  v2Primary: string | null
  confidence: Readonly<{ level: string }>
  fallbackUsed: boolean
  trace: Readonly<{ validatorResults: readonly Readonly<{ pass: boolean; failureCodes: readonly string[] }>[] }>
}>

const BASELINE_DIR = process.env.REPORT_V2_LANGUAGE_BASELINE_DIR
  || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260812T091836Z"
const REPLAY_COST_CAP_MICROUSD = 400_000
const FRESH_COST_CAP_MICROUSD = 600_000
const PILOT_DISTRIBUTION = Object.freeze([
  ["sensory dominant", "single-domain-sensory"],
  ["executive dominant", "single-domain-executive"],
  ["emotional dominant", "single-domain-emotional"],
  ["physiological dominant", "single-domain-physiological"],
  ["interoception dominant", "single-domain-interoception"],
  ["cognitive dominant", "single-domain-cognitive"],
  ["multi-domain", "multi-domain"],
  ["balanced", "balanced-preserved"],
  ["uncertain", "dna-external-sensory-discrepancy"],
  ["low evidence", "low-score-no-functional-evidence"],
  ["external disagreement", "external-disagreement"],
  ["preserved-under-support", "no-therapist-observation"],
  ["conflicting evidence", "anamnesis-dna-discrepancy"],
  ["high confidence", "adaptive-daily-living"],
  ["low confidence", "contextual-mixed"],
] as const)

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function loadLocalApiKey(): string | undefined {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim()
  for (const filename of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), filename)
    if (!fs.existsSync(file)) continue
    const line = fs.readFileSync(file, "utf8").split(/\r?\n/u).find((row) => /^OPENAI_API_KEY\s*=/.test(row))
    const value = line?.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/gu, "")
    if (value) return value
  }
  return undefined
}

function parseSections(report: string) {
  return REPORT_SECTION_HEADINGS.map((heading, index) => {
    const start = report.indexOf(heading)
    const end = index + 1 < REPORT_SECTION_HEADINGS.length ? report.indexOf(REPORT_SECTION_HEADINGS[index + 1]!) : report.length
    return Object.freeze({ sectionId: `section_${index + 1}` as ReportSectionId, text: start >= 0 ? report.slice(start + heading.length, end < 0 ? report.length : end).trim() : "" })
  })
}

function languageMetricsFromTexts(texts: readonly string[]) {
  const diagnostics = texts.map(reportLanguageDiagnostics)
  const internalEngineJargon = diagnostics.reduce((sum, row) => sum + row.internalEngineJargonCount, 0)
  const awkwardAcademicLanguage = diagnostics.reduce((sum, row) => sum + row.awkwardAcademicLanguageCount, 0)
  const terminologyDrift = diagnostics.reduce((sum, row) => sum + row.terminologyDriftCount, 0)
  const crossSectionRepetition = texts.reduce((sum, text) => sum + crossSectionRepetitionCount(parseSections(text)), 0)
  return Object.freeze({
    internalEngineJargon,
    awkwardAcademicLanguage,
    terminologyDrift,
    totalLanguageViolations: internalEngineJargon + awkwardAcademicLanguage + terminologyDrift,
    crossSectionRepetition,
  })
}

function measuredAttempts(rows: readonly PilotRow[]) {
  return rows.flatMap((row) => row.result.trace.realizationAttempts)
    .filter((attempt) => attempt.provider === "luna" && (attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0))
}

function cohortMetrics(rows: readonly PilotRow[]) {
  const attempts = measuredAttempts(rows)
  const totalCostMicrousd = attempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  return Object.freeze({
    reportCount: rows.length,
    direct: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length,
    controlledRepair: rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR").length,
    lunaRepaired: rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length,
    repaired: rows.filter((row) => ["CONTROLLED_REPAIR", "LUNA_REPAIRED"].includes(row.result.recoveryStatus)).length,
    fallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    providerCalls: rows.reduce((sum, row) => sum + row.result.providerCalls, 0),
    maxCallsPerReport: Math.max(...rows.map((row) => row.result.providerCalls)),
    internalEngineJargon: rows.reduce((sum, row) => sum + row.result.validation.internalEngineJargonCount, 0),
    awkwardAcademicLanguage: rows.reduce((sum, row) => sum + row.result.validation.awkwardAcademicLanguageCount, 0),
    terminologyDrift: rows.reduce((sum, row) => sum + row.result.validation.terminologyDriftCount, 0),
    ownerBookVerbatimCopy: rows.reduce((sum, row) => sum + row.result.validation.ownerBookVerbatimCopyCount, 0),
    crossSectionRepetition: rows.reduce((sum, row) => sum + row.result.validation.crossSectionRepetitionCount, 0),
    decisionDrift: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    unsupportedAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    sourceViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeSourceViolationCount, 0),
    authorityViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeAuthorityViolationCount, 0),
    privacyViolation: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    safetyViolation: rows.filter((row) => row.result.validation.failureCodes.includes("SAFETY_VIOLATION")).length,
    majorContradictionOmission: rows.filter((row) => row.result.validation.failureCodes.includes("CONTRADICTORY_EVIDENCE_OMITTED")).length,
    totalCostMicrousd,
    totalCostUsd: Number((totalCostMicrousd / 1_000_000).toFixed(6)),
    costPerReportUsd: Number((totalCostMicrousd / rows.length / 1_000_000).toFixed(6)),
  })
}

function pilotCases(fresh: readonly ReportV2SyntheticCase[], variant: 1 | 2, cohort: PilotCase["cohort"]): PilotCase[] {
  return PILOT_DISTRIBUTION.map(([category, pattern]) => {
    const fixture = fresh.find((candidate) => candidate.pattern === pattern && candidate.id.endsWith(`-${variant}`))
    if (!fixture) throw new Error(`language_pilot_pattern_missing:${pattern}:${variant}`)
    return Object.freeze({ id: fixture.id, category, pattern, cohort, input: fixture.input })
  })
}

async function runCases(cases: readonly PilotCase[], realizer: ReportRealizer, checkpoint: string) {
  const rows: PilotRow[] = []
  for (const [index, fixture] of cases.entries()) {
    const result = await runReportV2Shadow(fixture.input, { realizer, literatureMode: "STANDARD" })
    assert.equal(result.validation.pass, true, `${fixture.id}:${result.validation.failureCodes.join(",")}`)
    const row = Object.freeze({ fixture, result })
    rows.push(row)
    fs.appendFileSync(checkpoint, JSON.stringify({
      caseId: fixture.id,
      cohort: fixture.cohort,
      recoveryStatus: result.recoveryStatus,
      providerCalls: result.providerCalls,
      validation: result.validation,
      validatorResults: result.trace.validatorResults,
      finalReport: result.finalReport,
      attempts: result.trace.realizationAttempts.filter((attempt) => attempt.provider === "luna"),
    }) + "\n", "utf8")
    console.log(`report-language ${index + 1}/${cases.length}: ${fixture.cohort}:${fixture.id} ${result.recoveryStatus}`)
  }
  return Object.freeze(rows)
}

async function restoreCheckpointRows(cases: readonly PilotCase[], checkpointPath: string, selectedIds: ReadonlySet<string>) {
  const records = checkpointPath.split(",").map((entry) => entry.trim()).filter(Boolean).flatMap((entry) =>
    fs.readFileSync(entry, "utf8").trim().split(/\n/u).filter(Boolean).map((line) => JSON.parse(line) as CheckpointRow)
  )
  const recordById = new Map(records.map((row) => [row.caseId, row]))
  const restored: PilotRow[] = []
  for (const fixture of cases.filter((row) => selectedIds.has(row.id))) {
    const checkpoint = recordById.get(fixture.id)
    if (!checkpoint) throw new Error(`replay_checkpoint_case_missing:${fixture.id}`)
    if (!checkpoint.validation.pass) throw new Error(`replay_checkpoint_validation_failed:${fixture.id}`)
    const local = await runReportV2Shadow(fixture.input, { literatureMode: "STANDARD" })
    const fallbackUsed = checkpoint.recoveryStatus === "DETERMINISTIC_FALLBACK"
    const trace = Object.freeze({
      ...local.trace,
      realizationAttempts: Object.freeze([...checkpoint.attempts]),
      validatorResults: Object.freeze([...(checkpoint.validatorResults ?? [checkpoint.validation])]),
      finalReportHash: stableHash(checkpoint.finalReport),
      fallbackUsed,
      recoveryStatus: checkpoint.recoveryStatus,
    })
    const result = Object.freeze({
      ...local,
      finalReport: checkpoint.finalReport,
      validation: checkpoint.validation,
      providerCalls: checkpoint.providerCalls,
      fallbackUsed,
      recoveryStatus: checkpoint.recoveryStatus,
      trace,
    })
    restored.push(Object.freeze({ fixture, result }))
  }
  return Object.freeze(restored)
}

function totalTaskMeasuredCost() {
  const seen = new Set<string>()
  let costMicrousd = 0
  let measuredCalls = 0
  const files = fs.readdirSync("/tmp").filter((name) => /^report-v2-language-hardening-.*\.jsonl$/u.test(name))
  for (const filename of files) {
    const content = fs.readFileSync(path.join("/tmp", filename), "utf8").trim()
    if (!content) continue
    for (const line of content.split(/\n/u)) {
      const row = JSON.parse(line) as CheckpointRow
      for (const attempt of row.attempts ?? []) {
        if (!attempt.responseId || seen.has(attempt.responseId) || !(attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0)) continue
        seen.add(attempt.responseId)
        costMicrousd += attempt.usage.costMicrousd
        measuredCalls += 1
      }
    }
  }
  return Object.freeze({ measuredCalls, costMicrousd, costUsd: Number((costMicrousd / 1_000_000).toFixed(6)) })
}

function safeTrace(result: ReportV2ShadowResult) {
  return Object.freeze({ ...result.trace, decisionPlan: result.decisionPlan, reportPlan: result.reportPlan })
}

function reportMarkdown(rows: readonly PilotRow[]) {
  return [
    "# DNA Intelligence — Fresh Kör Raporlar",
    "",
    "Bu dosyada vaka girdisi, beklenen karar, teknik trace veya klinik kalite puanı bulunmaz.",
    "",
    ...rows.flatMap((row, index) => [`## BLIND-${String(index + 1).padStart(3, "0")}`, "", row.result.finalReport, ""]),
  ].join("\n")
}

async function main() {
  const apiKey = loadLocalApiKey()
  if (!apiKey) throw new Error("OPENAI_API_KEY unavailable")
  const baselineSealedPath = path.join(BASELINE_DIR, "SEALED_DECISION_EVIDENCE.jsonl")
  const baselineBlindPath = path.join(BASELINE_DIR, "blind-reports.json")
  const baselineRows = fs.readFileSync(baselineSealedPath, "utf8").trim().split(/\n/u).map((line) => JSON.parse(line) as BaselineSealedRow)
  const baselineBlind = JSON.parse(fs.readFileSync(baselineBlindPath, "utf8")) as Readonly<{ reports: readonly Readonly<{ report: string }>[] }>
  const priorFallbacks = baselineRows.filter((row) => row.fallbackUsed)
  assert.equal(priorFallbacks.length, 4, "expected four baseline fallbacks")
  const fallbackFailures = priorFallbacks.map((row) => row.trace.validatorResults.filter((validation) => !validation.pass))
  assert.ok(fallbackFailures.every((rows) => rows.length === 2 && rows.every((validation) => validation.failureCodes.length === 1 && validation.failureCodes[0] === "UNSUPPORTED_ADDITION")), "baseline fallback root cause changed")

  const fresh = buildFreshReportV2Cases()
  const replayCases = pilotCases(fresh, 2, "replay-existing-15")
  const newCases = pilotCases(fresh, 1, "fresh-new-15")
  const checkpoint = path.join("/tmp", `report-v2-language-hardening-${timestamp()}.jsonl`)
  fs.writeFileSync(checkpoint, "", "utf8")
  const diagnosticCaseId = process.env.REPORT_V2_LANGUAGE_DIAGNOSTIC_CASE?.trim()
  if (diagnosticCaseId) {
    const fixture = [...replayCases, ...newCases].find((candidate) => candidate.id === diagnosticCaseId)
    if (!fixture) throw new Error(`language_diagnostic_case_missing:${diagnosticCaseId}`)
    const diagnosticRealizer = new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2.3-language-diagnostic", maxTotalCostMicrousd: 100_000 })
    const rows = await runCases([fixture], diagnosticRealizer, checkpoint)
    console.log(JSON.stringify({
      checkpoint,
      caseId: fixture.id,
      recoveryStatus: rows[0]!.result.recoveryStatus,
      validatorResults: rows[0]!.result.trace.validatorResults,
      attempts: rows[0]!.result.trace.realizationAttempts.filter((attempt) => attempt.provider === "luna"),
    }, null, 2))
    return
  }
  const restorePath = process.env.REPORT_V2_LANGUAGE_REPLAY_CHECKPOINT?.trim()
  const restoreIds = new Set((process.env.REPORT_V2_LANGUAGE_REPLAY_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean))
  const restoredReplayRows = restorePath ? await restoreCheckpointRows(replayCases, restorePath, restoreIds) : Object.freeze([])
  const pendingReplayCases = replayCases.filter((fixture) => !restoreIds.has(fixture.id))
  const replayRealizer = new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2.3-language-replay", maxTotalCostMicrousd: REPLAY_COST_CAP_MICROUSD })
  const liveReplayRows = await runCases(pendingReplayCases, replayRealizer, checkpoint)
  const replayById = new Map([...restoredReplayRows, ...liveReplayRows].map((row) => [row.fixture.id, row]))
  const replayRows = Object.freeze(replayCases.map((fixture) => replayById.get(fixture.id)!).filter(Boolean))
  const freshRestorePath = process.env.REPORT_V2_LANGUAGE_FRESH_CHECKPOINT?.trim()
  const freshRestoreIds = new Set((process.env.REPORT_V2_LANGUAGE_FRESH_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean))
  const restoredNewRows = freshRestorePath ? await restoreCheckpointRows(newCases, freshRestorePath, freshRestoreIds) : Object.freeze([])
  const pendingNewCases = newCases.filter((fixture) => !freshRestoreIds.has(fixture.id))
  const newRealizer = new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2.3-language-fresh", maxTotalCostMicrousd: FRESH_COST_CAP_MICROUSD })
  const liveNewRows = await runCases(pendingNewCases, newRealizer, checkpoint)
  const newById = new Map([...restoredNewRows, ...liveNewRows].map((row) => [row.fixture.id, row]))
  const newRows = Object.freeze(newCases.map((fixture) => newById.get(fixture.id)!).filter(Boolean))

  const baselineById = new Map(baselineRows.map((row) => [row.caseId, row]))
  const replayDecisionDrift = replayRows.filter((row) => {
    const before = baselineById.get(row.fixture.id)
    return !before || before.decisionState !== row.result.decisionPlan.decisionState
      || before.v2Primary !== (row.result.decisionPlan.primaryFormulation?.id ?? null)
      || before.confidence.level !== row.result.decisionPlan.confidence.level
  }).length
  const baselineLanguage = languageMetricsFromTexts(baselineBlind.reports.map((row) => row.report))
  const replayMetrics = cohortMetrics(replayRows)
  const newMetrics = cohortMetrics(newRows)
  const combinedAttempts = measuredAttempts([...replayRows, ...newRows])
  const combinedCostMicrousd = combinedAttempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  const taskCost = totalTaskMeasuredCost()

  for (const metrics of [replayMetrics, newMetrics]) {
    assert.ok(metrics.direct + metrics.repaired >= 14, `direct_plus_repaired_below_target:${JSON.stringify(metrics)}`)
    assert.ok(metrics.fallback <= 1, `fallback_above_target:${JSON.stringify(metrics)}`)
    assert.equal(metrics.maxCallsPerReport <= 2, true)
    assert.equal(metrics.internalEngineJargon, 0)
    assert.equal(metrics.awkwardAcademicLanguage, 0)
    assert.equal(metrics.terminologyDrift, 0)
    assert.equal(metrics.ownerBookVerbatimCopy, 0)
    assert.equal(metrics.decisionDrift, 0)
    assert.equal(metrics.unsupportedAddition, 0)
    assert.equal(metrics.sourceViolation, 0)
    assert.equal(metrics.authorityViolation, 0)
    assert.equal(metrics.privacyViolation, 0)
    assert.equal(metrics.safetyViolation, 0)
    assert.equal(metrics.majorContradictionOmission, 0)
  }
  assert.equal(replayDecisionDrift, 0)

  const objective = {
    version: "dna-report-v2.3-final-language-hardening@1",
    reportVersion: REPORT_V2_VERSION,
    languageContractVersion: DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    productionActivated: false,
    baseline: {
      directory: BASELINE_DIR,
      reportCount: baselineRows.length,
      direct: baselineRows.filter((row) => !row.fallbackUsed).length,
      fallback: priorFallbacks.length,
      language: baselineLanguage,
    },
    rootCause: {
      fallbackCount: priorFallbacks.length,
      caseIds: priorFallbacks.map((row) => row.caseId),
      sharedFailure: "Luna self-declared unsupportedAddition=true while deterministic structural, source, authority, privacy and safety counters remained clean.",
      validatorRelaxed: false,
    },
    replay: { ...replayMetrics, decisionDriftAgainstBaseline: replayDecisionDrift },
    freshBlind: newMetrics,
    combinedCost: {
      model: DNA_REPORT_LUNA_MODEL,
      pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION,
      measuredCalls: combinedAttempts.length,
      totalCostUsd: Number((combinedCostMicrousd / 1_000_000).toFixed(6)),
      costPerReportUsd: Number((combinedCostMicrousd / 30 / 1_000_000).toFixed(6)),
      fabricatedMeasurements: false,
    },
    totalTaskMeasuredCost: taskCost,
    hardAcceptance: {
      decisionDrift: replayDecisionDrift + replayMetrics.decisionDrift + newMetrics.decisionDrift,
      unsupportedAddition: replayMetrics.unsupportedAddition + newMetrics.unsupportedAddition,
      sourceViolation: replayMetrics.sourceViolation + newMetrics.sourceViolation,
      authorityViolation: replayMetrics.authorityViolation + newMetrics.authorityViolation,
      privacyRegression: replayMetrics.privacyViolation + newMetrics.privacyViolation,
      safetyRegression: replayMetrics.safetyViolation + newMetrics.safetyViolation,
      terminologyDrift: replayMetrics.terminologyDrift + newMetrics.terminologyDrift,
      internalEngineJargon: replayMetrics.internalEngineJargon + newMetrics.internalEngineJargon,
      freshFallbackAtMostOne: newMetrics.fallback <= 1,
      passed: true,
    },
    clinicalQualitySelfScore: null,
  }

  const blindRows = newRows.map((row, index) => Object.freeze({ blindId: `BLIND-${String(index + 1).padStart(3, "0")}`, report: row.result.finalReport, finalReportHash: row.result.trace.finalReportHash }))
  const sealedRows = [...replayRows, ...newRows].map((row) => Object.freeze({
    caseId: row.fixture.id,
    cohort: row.fixture.cohort,
    pilotCategory: row.fixture.category,
    expectedPattern: row.fixture.pattern,
    decisionState: row.result.decisionPlan.decisionState,
    primary: row.result.decisionPlan.primaryFormulation?.id ?? null,
    confidence: row.result.decisionPlan.confidence.level,
    recoveryStatus: row.result.recoveryStatus,
    providerCalls: row.result.providerCalls,
    validation: row.result.validation,
    trace: safeTrace(row.result),
  }))
  const root = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  const outputDir = path.join(root, "SelfMetaAI/report-v2-shadow", timestamp())
  fs.mkdirSync(outputDir, { recursive: true })
  const artifacts: Record<string, string> = {
    "BLIND_REPORTS.md": reportMarkdown(newRows),
    "blind-reports.json": JSON.stringify({ version: objective.version, reports: blindRows }, null, 2) + "\n",
    "SEALED_DECISION_EVIDENCE.jsonl": sealedRows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "objective-summary.json": JSON.stringify(objective, null, 2) + "\n",
  }
  for (const [filename, content] of Object.entries(artifacts)) fs.writeFileSync(path.join(outputDir, filename), content, "utf8")
  const packageContract = ["BLIND_REPORTS.md", "blind-reports.json", "SEALED_DECISION_EVIDENCE.jsonl", "objective-summary.json", "manifest.json"]
  const manifest = {
    version: objective.version,
    generatedAt: objective.generatedAt,
    packageContents: Object.entries(artifacts).map(([filename, content]) => ({ filename, sha256: sha256(content), bytes: Buffer.byteLength(content) })),
    packageContract,
    replayCaseCount: replayRows.length,
    sourceCaseCount: newRows.length,
    blindReportCount: blindRows.length,
  }
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")
  const zipPath = path.join(outputDir, "blind-report-evaluation.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, ...packageContract], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  console.log("=== REPORT V2 FINAL LANGUAGE HARDENING ===")
  console.log(`Directory: ${outputDir}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${sha256(fs.readFileSync(zipPath))}`)
}

void main()
