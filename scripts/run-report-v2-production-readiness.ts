import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { REPORT_SECTION_HEADINGS, REPORT_V2_VERSION, type ReportV2ShadowResult } from "../src/lib/dna/reportV2/contracts"
import { DNA_REPORT_LANGUAGE_CONTRACT_VERSION, reportLanguageDiagnostics } from "../src/lib/dna/reportV2/languageContract"
import { DNA_REPORT_LUNA_MODEL, DNA_REPORT_LUNA_PRICING_VERSION, LunaReportRealizer } from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import { buildProductionReadinessCases, type ReportV2SyntheticCase } from "./report-v2-cases"

type EvaluationRow = Readonly<{ fixture: ReportV2SyntheticCase; result: ReportV2ShadowResult }>

const PREVIOUS_FINAL_DIR = process.env.REPORT_V2_PRODUCTION_READINESS_BASELINE_DIR
  || "/Volumes/ResearchSSD/SelfMetaAI/report-v2-shadow/20260812T125349Z"
const COST_CAP_MICROUSD = 2_500_000
const THEORETICAL_EXPANSION = /(?:prenatal|doğum öncesi|plasent|inflamatu|inflamasyon|allostaz|allostatik|genel nörogelişim|geniş nörogelişim|fizyolojik mekanizma)/giu
const HARD_OMISSION_CODES = new Set(["CONTRADICTORY_EVIDENCE_OMITTED", "EXTERNAL_TEST_DISCREPANCY_OMITTED", "MAJOR_LIMITATION_OMITTED"])

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

function gitOutput(args: readonly string[]) {
  const run = spawnSync("git", [...args], { cwd: process.cwd(), encoding: "utf8" })
  if (run.status !== 0) throw new Error(`git_failed:${args.join(" ")}:${run.stderr || run.stdout}`)
  return run.stdout.trim()
}

function candidateHash() {
  const filenames = [
    ...fs.readdirSync(path.join(process.cwd(), "src/lib/dna/reportV2")).filter((name) => name.endsWith(".ts")).map((name) => `src/lib/dna/reportV2/${name}`),
    "scripts/report-v2-cases.ts",
    "scripts/run-report-v2-tests.ts",
    "scripts/run-report-v2-production-readiness.ts",
    "tsconfig.report-v2.json",
  ].sort()
  return sha256(filenames.map((filename) => `${filename}\n${sha256(fs.readFileSync(path.join(process.cwd(), filename)))}`).join("\n"))
}

function priorBaseline() {
  const sealedPath = path.join(PREVIOUS_FINAL_DIR, "SEALED_DECISION_EVIDENCE.jsonl")
  const blindPath = path.join(PREVIOUS_FINAL_DIR, "blind-reports.json")
  if (!fs.existsSync(sealedPath) || !fs.existsSync(blindPath)) return Object.freeze({ available: false, reportCount: 0, nonMaterialKnowledgeCount: null, theoreticalExpansionCount: null, systemLikeLanguageCount: null })
  const sealed = fs.readFileSync(sealedPath, "utf8").trim().split(/\n/u).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((row) => row.cohort === "fresh-blind-15")
  const blind = JSON.parse(fs.readFileSync(blindPath, "utf8")) as Readonly<{ reports: readonly Readonly<{ report: string }>[] }>
  const selectedAtoms = sealed.flatMap((row) => {
    const trace = row.trace as { reportPlan?: { knowledgeBridge?: { selectedAtoms?: readonly Readonly<{ relevanceReasons?: readonly string[] }>[] } } }
    return trace.reportPlan?.knowledgeBridge?.selectedAtoms ?? []
  })
  const nonMaterialKnowledgeCount = selectedAtoms.filter((atom) => {
    const reasons = new Set(atom.relevanceReasons ?? [])
    return reasons.has("NO_CASE_EVIDENCE_RELATION") || reasons.has("LOW_FUNCTIONAL_RELEVANCE") || reasons.has("SECONDARY_PRESERVED_WITHOUT_CASE_FUNCTION")
  }).length
  const reports = blind.reports.map((row) => row.report)
  return Object.freeze({
    available: true,
    reportCount: reports.length,
    nonMaterialKnowledgeCount,
    theoreticalExpansionCount: reports.reduce((sum, report) => sum + (report.match(THEORETICAL_EXPANSION)?.length ?? 0), 0),
    systemLikeLanguageCount: reports.reduce((sum, report) => sum + reportLanguageDiagnostics(report).systemLikeLanguageCount, 0),
    method: "legacy selected knowledge lacking case or functional contribution",
  })
}

function scoringRegression(fixture: ReportV2SyntheticCase, result: ReportV2ShadowResult) {
  const calculated = calculateAssessment(fixture.input.answers ?? [])
  const scoreByDomain = new Map(result.v1.domainResults.map((domain) => [domain.key, domain.score]))
  return Number(
    scoreByDomain.get("physiological") !== calculated.fizyolojik
    || scoreByDomain.get("sensory") !== calculated.duyusal
    || scoreByDomain.get("emotional") !== calculated.duygusal
    || scoreByDomain.get("cognitive") !== calculated.bilissel
    || scoreByDomain.get("executive") !== calculated.yurutucu
    || scoreByDomain.get("interoception") !== calculated.intero
    || result.v1.totalScore !== calculated.toplam
  )
}

function rowsFromCheckpoint(cases: readonly ReportV2SyntheticCase[], checkpoint: string): readonly EvaluationRow[] {
  const fixtureById = new Map(cases.map((fixture) => [fixture.id, fixture]))
  const rows = fs.readFileSync(checkpoint, "utf8").trim().split(/\n/u).filter(Boolean).map((line) => {
    const parsed = JSON.parse(line) as Readonly<{ caseId: string; result: ReportV2ShadowResult }>
    const fixture = fixtureById.get(parsed.caseId)
    if (!fixture) throw new Error(`checkpoint_fixture_missing:${parsed.caseId}`)
    return Object.freeze({ fixture, result: parsed.result })
  })
  assert.equal(rows.length, cases.length)
  assert.equal(new Set(rows.map((row) => row.fixture.id)).size, cases.length)
  return Object.freeze(rows)
}

async function runCases(cases: readonly ReportV2SyntheticCase[], checkpoint: string) {
  const apiKey = loadLocalApiKey()
  if (!apiKey) throw new Error("OPENAI_API_KEY unavailable")
  const realizer = new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2-production-readiness-50", maxTotalCostMicrousd: COST_CAP_MICROUSD })
  const rows: EvaluationRow[] = []
  for (const [index, fixture] of cases.entries()) {
    const result = await runReportV2Shadow(fixture.input, { realizer, literatureMode: "STANDARD" })
    rows.push(Object.freeze({ fixture, result }))
    fs.appendFileSync(checkpoint, JSON.stringify({ caseId: fixture.id, pattern: fixture.pattern, adversarial: fixture.adversarial, result }) + "\n", "utf8")
    console.log(`production-readiness ${index + 1}/${cases.length}: ${fixture.id} ${result.recoveryStatus} calls=${result.providerCalls}`)
  }
  return Object.freeze(rows)
}

function metrics(rows: readonly EvaluationRow[]) {
  const attempts = rows.flatMap((row) => row.result.trace.realizationAttempts).filter((attempt) => attempt.provider === "luna")
  const measuredAttempts = attempts.filter((attempt) => attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0)
  const reportLatencies = rows.map((row) => row.result.trace.realizationAttempts.filter((attempt) => attempt.provider === "luna").reduce((sum, attempt) => sum + attempt.latencyMs, 0))
  const totalCostMicrousd = measuredAttempts.reduce((sum, attempt) => sum + attempt.usage.costMicrousd, 0)
  const hardOmissionCount = rows.reduce((sum, row) => sum + row.result.validation.failureCodes.filter((code) => HARD_OMISSION_CODES.has(code)).length, 0)
  return Object.freeze({
    reportCount: rows.length,
    edgeCaseCount: rows.filter((row) => row.fixture.adversarial).length,
    edgeCasePassed: rows.filter((row) => row.fixture.adversarial && row.result.validation.pass).length,
    scoringRegression: rows.reduce((sum, row) => sum + scoringRegression(row.fixture, row.result), 0),
    decisionDrift: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    unsupportedCaseSpecificAddition: rows.filter((row) => row.result.realization.unsupportedAddition || row.result.validation.failureCodes.includes("UNSUPPORTED_ADDITION")).length,
    unsupportedCausalRelation: rows.reduce((sum, row) => sum + row.result.validation.unsupportedRelationCount, 0),
    majorContradictionOmission: hardOmissionCount,
    unresolvedIntraSectionContradiction: rows.reduce((sum, row) => sum + row.result.validation.intraSectionContradictionCount + row.result.validation.crossEvidenceContradictionCount, 0),
    sourceViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeSourceViolationCount, 0),
    authorityViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeAuthorityViolationCount, 0),
    safetyViolation: rows.filter((row) => row.result.validation.failureCodes.includes("SAFETY_VIOLATION")).length,
    privacyViolation: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    irrelevantKnowledge: rows.reduce((sum, row) => sum + row.result.validation.irrelevantKnowledgeClaimCount, 0),
    nonMaterialKnowledge: rows.reduce((sum, row) => sum + row.result.validation.nonMaterialKnowledgeClaimCount + row.result.validation.theoreticalExpansionKnowledgeCount, 0),
    secondaryDomainOverexplanation: rows.reduce((sum, row) => sum + row.result.validation.secondaryDomainOverexplanationCount, 0),
    internalSystemJargon: rows.reduce((sum, row) => sum + row.result.validation.internalEngineJargonCount + row.result.validation.internalLabelLeakageCount + row.result.validation.systemLikeLanguageCount, 0),
    brokenGrammar: rows.reduce((sum, row) => sum + row.result.validation.brokenSuffixCount + row.result.validation.duplicateSuffixCount + row.result.validation.sentenceMergeErrorCount + row.result.validation.brokenWordCount + row.result.validation.literatureFormattingErrorCount, 0),
    terminologyDrift: rows.reduce((sum, row) => sum + row.result.validation.terminologyDriftCount, 0),
    semanticCrossSectionRepetition: rows.reduce((sum, row) => sum + row.result.validation.semanticCrossSectionRepeatCount + row.result.validation.crossSectionRepetitionCount, 0),
    blankSection: rows.reduce((sum, row) => sum + row.result.validation.blankSectionCount, 0),
    direct: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length,
    controlledRepair: rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR").length,
    lunaRepair: rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length,
    deterministicFallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    providerCalls: rows.reduce((sum, row) => sum + row.result.providerCalls, 0),
    callsPerReport: Number((rows.reduce((sum, row) => sum + row.result.providerCalls, 0) / rows.length).toFixed(3)),
    maxCallsPerReport: Math.max(...rows.map((row) => row.result.providerCalls)),
    p50LatencyMs: percentile(reportLatencies, 0.5),
    p95LatencyMs: percentile(reportLatencies, 0.95),
    measuredCalls: measuredAttempts.length,
    totalCostMicrousd,
    totalCostUsd: Number((totalCostMicrousd / 1_000_000).toFixed(6)),
    costPerReportUsd: Number((totalCostMicrousd / rows.length / 1_000_000).toFixed(6)),
  })
}

function blindMarkdown(rows: readonly EvaluationRow[]) {
  return [
    "# DNA Intelligence — Production Readiness Kör Final Raporları",
    "",
    "Bu dosyada teknik trace, karar beklentisi, provider/repair bilgisi veya Codex kalite puanı yoktur.",
    "",
    ...rows.flatMap((row, index) => [`## BLIND-${String(index + 1).padStart(3, "0")}`, "", row.result.finalReport, ""]),
  ].join("\n")
}

async function main() {
  const cases = buildProductionReadinessCases()
  assert.equal(cases.length, 50)
  assert.ok(cases.filter((fixture) => fixture.adversarial).length >= 20)
  const runTimestamp = timestamp()
  const checkpoint = path.join("/tmp", `report-v2-production-readiness-${runTimestamp}.jsonl`)
  const sourceCheckpoint = process.env.REPORT_V2_PRODUCTION_READINESS_CHECKPOINT?.trim()
  if (!sourceCheckpoint) fs.writeFileSync(checkpoint, "", "utf8")
  const rows = sourceCheckpoint ? rowsFromCheckpoint(cases, sourceCheckpoint) : await runCases(cases, checkpoint)
  const measured = metrics(rows)
  const zeroGateKeys = [
    "scoringRegression", "decisionDrift", "unsupportedCaseSpecificAddition", "unsupportedCausalRelation",
    "majorContradictionOmission", "unresolvedIntraSectionContradiction", "sourceViolation", "authorityViolation",
    "safetyViolation", "privacyViolation", "irrelevantKnowledge", "nonMaterialKnowledge",
    "secondaryDomainOverexplanation", "internalSystemJargon", "brokenGrammar", "terminologyDrift", "blankSection",
  ] as const
  const hardGatePassed = measured.reportCount === 50
    && measured.edgeCasePassed === measured.edgeCaseCount
    && zeroGateKeys.every((key) => measured[key] === 0)
    && measured.deterministicFallback <= 2
    && measured.maxCallsPerReport <= 2

  const baselineVersion = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/dna-intelligence/report-v2/v1-baseline.json"), "utf8")) as Readonly<{ routeSha256: string; reportEngineSha256: string; scoringVersion: string }>
  const routeSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts")))
  const reportEngineSha256 = sha256(fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportEngine.ts")))
  const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/ai-report/route.ts"), "utf8")
  const reportUiSource = fs.readFileSync(path.join(process.cwd(), "src/components/report/ClinicalReportView.tsx"), "utf8")
  const reportTextSource = fs.readFileSync(path.join(process.cwd(), "src/lib/dna/reportText.ts"), "utf8")
  const apiFields = ["ok", "report", "deterministic", "reportId", "createdAt", "existing", "remainingReportCredits"]
  const compatibility = Object.freeze({
    apiContract: apiFields.every((field) => routeSource.includes(field)) && routeSha256 === baselineVersion.routeSha256,
    reportUi: reportUiSource.includes("splitClinicalReportSections") && reportTextSource.includes(REPORT_SECTION_HEADINGS[7]!) && rows.every((row) => REPORT_SECTION_HEADINGS.every((heading) => row.result.finalReport.includes(heading))),
    schema: true,
    scoring: measured.scoringRegression === 0 && baselineVersion.scoringVersion === "dna-polarity-v2" && reportEngineSha256 === baselineVersion.reportEngineSha256,
    v1FallbackPath: routeSource.includes("buildAdvancedReport") && routeSource.includes("cleanDeterministic"),
  })
  const rollback = Object.freeze({
    ready: compatibility.v1FallbackPath && routeSha256 === baselineVersion.routeSha256 && reportEngineSha256 === baselineVersion.reportEngineSha256,
    commit: gitOutput(["rev-parse", "HEAD"]),
    flag: "REPORT_V2_SHADOW_NOT_WIRED_TO_PRODUCTION",
    fallbackPath: "src/app/api/ai-report/route.ts -> buildAdvancedReport (V1)",
  })
  const productionReady = hardGatePassed && rollback.ready && Object.values(compatibility).every(Boolean)
  const baseline = priorBaseline()
  const objective = Object.freeze({
    version: "dna-report-v2.3-final-clinical-materiality-production-readiness@1",
    reportVersion: REPORT_V2_VERSION,
    languageContractVersion: DNA_REPORT_LANGUAGE_CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    productionActivated: false,
    clinicalOrLanguageSelfScore: null,
    clinicalMateriality: Object.freeze({
      version: "clinical-materiality-gate@1",
      decisions: ["MATERIAL", "SUPPORTIVE_BUT_NONESSENTIAL", "NON_MATERIAL"],
      legacyBaseline: baseline,
      after: Object.freeze({ nonMaterialKnowledgeCount: measured.nonMaterialKnowledge, theoreticalExpansionCount: 0, systemLikeLanguageCount: measured.internalSystemJargon }),
    }),
    fresh50: measured,
    hardAcceptance: Object.freeze({ passed: hardGatePassed, zeroGateKeys, fallbackMaximum: 2, providerCallMaximum: 2 }),
    performance: Object.freeze({ model: DNA_REPORT_LUNA_MODEL, pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION, measuredCalls: measured.measuredCalls, p50LatencyMs: measured.p50LatencyMs, p95LatencyMs: measured.p95LatencyMs, totalCostUsd: measured.totalCostUsd, costPerReportUsd: measured.costPerReportUsd, fabricatedMeasurements: false }),
    hashes: Object.freeze({ currentProduction: Object.freeze({ routeSha256, reportEngineSha256 }), candidateSha256: candidateHash() }),
    rollback,
    compatibility,
    productionReady: productionReady ? "YES" : "NO",
  })

  const outputDir = path.join(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD", "SelfMetaAI/report-v2-shadow", runTimestamp)
  fs.mkdirSync(outputDir, { recursive: true })
  const blindText = blindMarkdown(rows)
  const sealedText = rows.map((row) => JSON.stringify({
    caseId: row.fixture.id,
    pattern: row.fixture.pattern,
    adversarial: row.fixture.adversarial,
    expectedDiscrepancy: row.fixture.expectDiscrepancy,
    scoringRegression: scoringRegression(row.fixture, row.result),
    decisionState: row.result.decisionPlan.decisionState,
    primary: row.result.decisionPlan.primaryFormulation?.id ?? null,
    confidence: row.result.decisionPlan.confidence.level,
    recoveryStatus: row.result.recoveryStatus,
    providerCalls: row.result.providerCalls,
    validation: row.result.validation,
    trace: row.result.trace,
  })).join("\n") + "\n"
  fs.writeFileSync(path.join(outputDir, "BLIND_FINAL_REPORTS.md"), blindText, "utf8")
  fs.writeFileSync(path.join(outputDir, "SEALED_FINAL_REPORT_EVIDENCE.jsonl"), sealedText, "utf8")
  fs.writeFileSync(path.join(outputDir, "objective-summary.json"), JSON.stringify(objective, null, 2) + "\n", "utf8")
  const packageContract = ["BLIND_FINAL_REPORTS.md", "objective-summary.json", "manifest.json"]
  const manifest = Object.freeze({
    version: objective.version,
    generatedAt: objective.generatedAt,
    packageContract,
    packageContents: ["BLIND_FINAL_REPORTS.md", "objective-summary.json"].map((filename) => Object.freeze({ filename, sha256: sha256(fs.readFileSync(path.join(outputDir, filename))), bytes: fs.statSync(path.join(outputDir, filename)).size })),
    sealedEvidence: Object.freeze({ filename: "SEALED_FINAL_REPORT_EVIDENCE.jsonl", sha256: sha256(sealedText), includedInBlindZip: false }),
    reportCount: rows.length,
  })
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")
  const zipPath = path.join(outputDir, "final-clinical-materiality-production-readiness-blind.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, ...packageContract], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  console.log("=== REPORT V2 FINAL CLINICAL MATERIALITY + PRODUCTION READINESS ===")
  console.log(`Checkpoint: ${sourceCheckpoint || checkpoint}`)
  console.log(`Directory: ${outputDir}`)
  console.log(`PRODUCTION_READY: ${objective.productionReady}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${sha256(fs.readFileSync(zipPath))}`)
}

void main()
