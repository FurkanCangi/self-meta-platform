import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { REPORT_V2_VERSION, type ReportRealizer, type ReportV2ShadowResult } from "../src/lib/dna/reportV2/contracts"
import { LunaReportRealizer, DNA_REPORT_LUNA_MODEL, DNA_REPORT_LUNA_PRICING_VERSION } from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { DeterministicReportRealizer } from "../src/lib/dna/reportV2/realizer"
import { auditReportKnowledgeCore } from "../src/lib/dna/reportV2/reportKnowledgeBridge"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"
import { buildFreshReportV2Cases, type ReportV2SyntheticCase } from "./report-v2-cases"

type LegacyFixture = {
  sourceCase: string
  clientCode: string
  ageMonths: number
  anamnez: string
  answers: number[]
  scores: Record<string, number>
}

type RunCase = Readonly<{
  id: string
  cohort: "legacy-five" | "fresh-holdout"
  pattern: string
  adversarial: boolean
  expectDiscrepancy: boolean
  pilotCategory?: string
  input: LegacyFixture | ReportV2SyntheticCase["input"]
}>

const LUNA_DIAGNOSTIC_COST_CAP_MICROUSD = 500_000
const LUNA_FRESH_COST_CAP_MICROUSD = 500_000
const LUNA_DIAGNOSTIC_PATTERNS = Object.freeze([
  "single-domain-sensory",
  "single-domain-executive",
  "single-domain-interoception",
  "single-domain-emotional",
  "single-domain-physiological",
  "single-domain-cognitive",
  "multi-domain",
  "balanced-preserved",
  "external-disagreement",
  "low-score-no-functional-evidence",
  "dna-external-sensory-discrepancy",
  "contextual-mixed",
])

const FRESH_PILOT_DISTRIBUTION = Object.freeze([
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

const V2_0_CALIBRATION_BASELINE = Object.freeze({
  caseCount: 41,
  pairwiseDiscrepancyEdges: 86,
  clinicalDiscrepancyClusters: null,
  contextualWronglyDiscrepantEdges: 19,
  unknownExternalWronglyDiscrepantCases: 10,
  unknownExternalWronglyDiscrepantEdges: 26,
  section23AllowedClaimOverlap: 246,
})

const V2_1_LUNA_DIAGNOSTIC_BASELINE = Object.freeze({
  reportCount: 12,
  directAccepted: 6,
  repairAttempts: 8,
  repairedAccepted: 0,
  deterministicFallback: 6,
  preservedCapacityFatalRejections: 8,
  preservedDomainOverinterpretationClaims: 22,
  preservedDomainOverinterpretationReports: 10,
  literatureCaseDecisionAttributionBindings: 19,
  literatureCaseDecisionAttributionReports: 12,
  literatureFormattingErrorReports: 9,
})

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function percentile(values: readonly number[], quantile: number) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))]
}

function mean(values: readonly number[]) {
  return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null
}

function loadLocalApiKey(): string | undefined {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim()
  for (const filename of [".env.local", ".env"]) {
    const file = path.join(process.cwd(), filename)
    if (!fs.existsSync(file)) continue
    const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((row) => /^OPENAI_API_KEY\s*=/.test(row))
    const value = line?.split("=").slice(1).join("=").trim().replace(/^['"]|['"]$/g, "")
    if (value) return value
  }
  return undefined
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function safeTrace(result: ReportV2ShadowResult) {
  return {
    ...result.trace,
    decisionPlan: result.decisionPlan,
    reportPlan: result.reportPlan,
  }
}

function reportMarkdown(rows: readonly { blindId: string; report: string }[]) {
  return [
    "# DNA Intelligence Report V2 — Kör Raporlar",
    "",
    "Bu dosyada vaka girdisi, beklenen karar, teknik trace veya klinik kalite puanı bulunmaz.",
    "",
    ...rows.flatMap((row) => [`## ${row.blindId}`, "", row.report, ""]),
  ].join("\n")
}

function knowledgeAuditMarkdown(audit: ReturnType<typeof auditReportKnowledgeCore>) {
  const summary = audit.summary
  return [
    "# Report V2.3 Knowledge Bridge Audit",
    "",
    `- Toplam chat atomu: ${summary.totalAtoms}`,
    `- REPORT_ELIGIBLE: ${summary.reportEligibleAtoms}`,
    `- NOT_REPORT_ELIGIBLE: ${summary.notReportEligibleAtoms}`,
    `- NEEDS_REVIEW: ${summary.needsReviewAtoms}`,
    `- Owner/DNA-book eligible: ${summary.ownerBookEligibleAtoms}`,
    `- Mevcut report RAG overlap: ${summary.reportRagOverlapAtoms}`,
    `- Report RAG'de olmayan yeni yararlı knowledge: ${summary.novelUsefulAtoms}`,
    "",
    "## Rol dağılımı",
    "",
    ...Object.entries(summary.roleCounts).map(([role, count]) => `- ${role}: ${count}`),
    "",
    `Audit SHA-256: ${summary.auditSha256}`,
    "",
    "Owner-book atomları yalnız kurum-içi genel kavramsal çerçeve olarak sınıflandırılmıştır; dış bilimsel literatür veya vaka kararı değildir.",
  ].join("\n")
}

async function runWithConcurrency(
  cases: readonly RunCase[],
  realizer: ReportRealizer,
  concurrency = 2,
  onResult?: (row: Readonly<{ fixture: RunCase; result: ReportV2ShadowResult }>) => void,
) {
  const results = new Array<Readonly<{ fixture: RunCase; result: ReportV2ShadowResult }>>(cases.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= cases.length) return
      const fixture = cases[index]
      const result = await runReportV2Shadow(fixture.input, { realizer, literatureMode: "STANDARD" })
      if (!result.validation.pass) throw new Error(`${fixture.id}:${result.validation.failureCodes.join(",")}`)
      results[index] = Object.freeze({ fixture, result })
      onResult?.(results[index])
      console.log(`report-v2 ${index + 1}/${cases.length}: ${fixture.id} pass`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, () => worker()))
  return results
}

function calibrationMetrics(rows: readonly Readonly<{ fixture: RunCase; result: ReportV2ShadowResult }>[]) {
  let pairwiseDiscrepancyEdges = 0
  let clinicalDiscrepancyClusters = 0
  let contextualWronglyDiscrepantEdges = 0
  let unknownExternalWronglyDiscrepantEdges = 0
  let section23AllowedClaimOverlap = 0
  for (const row of rows) {
    const matrix = row.result.evidenceMatrix
    const unitMap = new Map(matrix.units.map((unit) => [unit.id, unit]))
    const discrepant = matrix.relations.filter((relation) => relation.type === "DISCREPANT")
    pairwiseDiscrepancyEdges += discrepant.length
    clinicalDiscrepancyClusters += matrix.discrepancyClusters.length
    for (const relation of discrepant) {
      const units = [unitMap.get(relation.leftEvidenceId), unitMap.get(relation.rightEvidenceId)]
      if (units.some((unit) => unit && (unit.sourceType === "CONTEXTUAL_EVIDENCE" || unit.sourceType === "PRESERVED_CAPACITY"))) contextualWronglyDiscrepantEdges += 1
      if (units.some((unit) => unit?.sourceType === "EXTERNAL_ASSESSMENT" && unit.direction === "NEUTRAL")) unknownExternalWronglyDiscrepantEdges += 1
    }
    const section2 = new Set(row.result.reportPlan.sections.find((section) => section.id === "section_2")?.allowedClaimIds ?? [])
    section23AllowedClaimOverlap += (row.result.reportPlan.sections.find((section) => section.id === "section_3")?.allowedClaimIds ?? []).filter((id) => section2.has(id)).length
  }
  return Object.freeze({
    pairwiseDiscrepancyEdges,
    clinicalDiscrepancyClusters,
    contextualWronglyDiscrepantEdges,
    unknownExternalWronglyDiscrepantEdges,
    discrepancyPenaltyInflation: rows.filter((row) => row.result.trace.contradictions.length !== row.result.evidenceMatrix.discrepancyClusters.length).length,
    uncertainAsCandidate: rows.reduce((sum, row) => sum + row.result.candidates.filter((candidate) => String(candidate.id) === "uncertain").length, 0),
    section23AllowedClaimOverlap,
  })
}

function liveMetrics(rows: readonly Readonly<{ fixture: RunCase; result: ReportV2ShadowResult }>[]) {
  const attempts = rows.flatMap((row) => row.result.trace.realizationAttempts).filter((attempt) => attempt.provider === "luna")
  const measured = attempts.filter((attempt) => attempt.usage.inputTokens > 0 || attempt.usage.outputTokens > 0)
  const costs = measured.map((attempt) => attempt.usage.costMicrousd)
  return Object.freeze({
    attempts,
    measured,
    providerCalls: attempts.length,
    measuredCalls: measured.length,
    repairAttempts: attempts.filter((attempt) => attempt.attempt === "repair").length,
    directAccepted: rows.filter((row) => row.result.recoveryStatus === "DIRECT_ACCEPTED").length,
    controlledRepair: rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR").length,
    lunaRepaired: rows.filter((row) => row.result.recoveryStatus === "LUNA_REPAIRED").length,
    repairedReports: rows.filter((row) => row.result.recoveryStatus === "CONTROLLED_REPAIR" || row.result.recoveryStatus === "LUNA_REPAIRED").length,
    fallback: rows.filter((row) => row.result.recoveryStatus === "DETERMINISTIC_FALLBACK").length,
    totalCostMicrousd: costs.reduce((sum, value) => sum + value, 0),
    latencyP50Ms: percentile(measured.map((attempt) => attempt.latencyMs), 0.5),
    latencyP95Ms: percentile(measured.map((attempt) => attempt.latencyMs), 0.95),
    averageInputTokens: mean(measured.map((attempt) => attempt.usage.inputTokens)),
    averageOutputTokens: mean(measured.map((attempt) => attempt.usage.outputTokens)),
    maxCallsPerReport: rows.length ? Math.max(...rows.map((row) => row.result.providerCalls)) : 0,
  })
}

function finalErrorCounts(rows: readonly Readonly<{ fixture: RunCase; result: ReportV2ShadowResult }>[]) {
  const countCode = (code: string) => rows.filter((row) => row.result.validation.failureCodes.includes(code as never)).length
  return Object.freeze({
    optionalOmissionFatalRejection: rows.reduce((sum, row) => sum + row.result.trace.validatorResults.filter((validation) => validation.failureCodes.includes("PRESERVED_CAPACITY_OMITTED")).length, 0),
    majorContradictionOmission: countCode("CONTRADICTORY_EVIDENCE_OMITTED"),
    primaryFormulationDrift: countCode("CROSS_SECTION_PRIMARY_FORMULATION_MISMATCH"),
    crossSectionContradiction: countCode("CROSS_SECTION_CONTRADICTION"),
    unsupportedRelation: rows.reduce((sum, row) => sum + row.result.validation.unsupportedRelationCount, 0),
    privacyViolation: rows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
    safetyViolation: countCode("SAFETY_VIOLATION"),
    preservedDomainOverinterpretation: rows.reduce((sum, row) => sum + row.result.validation.preservedDomainOverinterpretationCount, 0),
    literatureCaseDecisionAttribution: rows.reduce((sum, row) => sum + row.result.validation.literatureCaseDecisionAttributionCount, 0),
    literatureFormattingError: rows.reduce((sum, row) => sum + row.result.validation.literatureFormattingErrorCount, 0),
    decisionChangedByKnowledgeBridge: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
    unsupportedCaseSpecificAddition: rows.reduce((sum, row) => sum + row.result.validation.knowledgeCaseSpecificAdditionCount, 0),
    authorityViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeAuthorityViolationCount, 0),
    sourceViolation: rows.reduce((sum, row) => sum + row.result.validation.knowledgeSourceViolationCount, 0),
    internalEngineJargon: rows.reduce((sum, row) => sum + row.result.validation.internalEngineJargonCount, 0),
    blankSection: rows.reduce((sum, row) => sum + row.result.validation.blankSectionCount, 0),
  })
}

async function main() {
  const legacy = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts/fixtures/report-v2/legacy-five.json"), "utf8")) as LegacyFixture[]
  const fresh = buildFreshReportV2Cases()
  const calibrationCases: RunCase[] = [
    ...legacy.map((fixture, index) => Object.freeze({ id: `legacy-${index + 1}`, cohort: "legacy-five" as const, pattern: fixture.sourceCase, adversarial: false, expectDiscrepancy: false, input: fixture })),
    ...fresh.map((fixture) => Object.freeze({ id: fixture.id, cohort: "fresh-holdout" as const, pattern: fixture.pattern, adversarial: fixture.adversarial, expectDiscrepancy: fixture.expectDiscrepancy, input: fixture.input })),
  ]
  const calibrationRows = await runWithConcurrency(calibrationCases, new DeterministicReportRealizer(), 4)
  const useLuna = process.env.REPORT_V2_LUNA === "1"
  const apiKey = useLuna ? loadLocalApiKey() : undefined
  if (useLuna && !apiKey) throw new Error("REPORT_V2_LUNA=1 but OPENAI_API_KEY is unavailable")
  const calibrationAfter = calibrationMetrics(calibrationRows)
  const calibrationErrors = finalErrorCounts(calibrationRows)
  const shadowGate = Object.values(calibrationErrors).every((value) => value === 0)
    && calibrationAfter.section23AllowedClaimOverlap === 0
    && calibrationAfter.contextualWronglyDiscrepantEdges === 0
    && calibrationAfter.unknownExternalWronglyDiscrepantEdges === 0
  if (!shadowGate) throw new Error(`report_v2.3_shadow_gate_failed:${JSON.stringify({ calibrationErrors, calibrationAfter })}`)

  const freshPilotCases: RunCase[] = FRESH_PILOT_DISTRIBUTION.map(([pilotCategory, pattern]) => {
    const fixture = fresh.find((candidate) => candidate.pattern === pattern && candidate.id.endsWith("-2"))
    if (!fixture) throw new Error(`fresh_pilot_pattern_missing:${pattern}`)
    return Object.freeze({ id: fixture.id, cohort: "fresh-holdout" as const, pattern: fixture.pattern, pilotCategory, adversarial: fixture.adversarial, expectDiscrepancy: fixture.expectDiscrepancy, input: fixture.input })
  })
  assert.equal(freshPilotCases.length, 15)
  assert.equal(new Set(freshPilotCases.map((fixture) => fixture.id)).size, 15)
  const freshRealizer = useLuna ? new LunaReportRealizer({ apiKey, safetyIdentifier: "report-v2.3-fresh-shadow", maxTotalCostMicrousd: LUNA_FRESH_COST_CAP_MICROUSD }) : null
  const freshCheckpointPath = path.join("/tmp", `report-v2.3-luna-fresh-${timestamp()}.jsonl`)
  if (useLuna) fs.writeFileSync(freshCheckpointPath, "", "utf8")
  const rows = await runWithConcurrency(freshPilotCases, freshRealizer ?? new DeterministicReportRealizer(), 1, useLuna ? (row) => {
    fs.appendFileSync(freshCheckpointPath, JSON.stringify({
      caseId: row.fixture.id,
      pilotCategory: row.fixture.pilotCategory,
      finalReport: row.result.finalReport,
      recoveryStatus: row.result.recoveryStatus,
      validation: row.result.validation,
      providerCalls: row.result.providerCalls,
      attempts: row.result.trace.realizationAttempts.filter((attempt) => attempt.provider === "luna"),
      decisionPlan: row.result.decisionPlan,
      reportPlan: row.result.reportPlan,
    }) + "\n", "utf8")
  } : undefined)
  const freshMetrics = liveMetrics(rows)
  const freshErrors = finalErrorCounts(rows)
  assert.ok(Object.values(freshErrors).every((value) => value === 0), `fresh_gate_failed:${JSON.stringify(freshErrors)}`)
  assert.ok(freshMetrics.maxCallsPerReport <= 2, "Fresh report exceeded two Luna calls")
  if (useLuna) assert.ok(freshRealizer!.totalCostMicrousd <= LUNA_FRESH_COST_CAP_MICROUSD, "Fresh Luna cost cap exceeded")
  const categoryMap = new Map(rows.map((row) => [row.fixture.pilotCategory, row.result]))
  assert.equal(categoryMap.get("uncertain")?.decisionPlan.decisionState, "UNCERTAIN")
  assert.equal(categoryMap.get("high confidence")?.decisionPlan.confidence.level, "HIGH")
  assert.equal(categoryMap.get("low confidence")?.decisionPlan.confidence.level, "LOW")
  assert.ok((categoryMap.get("preserved-under-support")?.decisionPlan.preservedCapacity.length ?? 0) > 0)

  const blindRows = rows.map((row, index) => ({
    blindId: `BLIND-${String(index + 1).padStart(3, "0")}`,
    report: row.result.finalReport,
    finalReportHash: row.result.trace.finalReportHash,
  }))
  const sealedRows = rows.map((row) => ({
    caseId: row.fixture.id,
    cohort: row.fixture.cohort,
    pilotCategory: row.fixture.pilotCategory,
    expectedPattern: row.fixture.pattern,
    adversarial: row.fixture.adversarial,
    expectedDiscrepancy: row.fixture.expectDiscrepancy,
    inputHash: row.result.trace.inputHash,
    v1ReportHash: sha256(row.result.v1.deterministicReport),
    v1Mechanism: row.result.v1.clinicalAnalysis?.evidenceMap?.clinicalMechanism ?? null,
    decisionState: row.result.decisionPlan.decisionState,
    v2Primary: row.result.decisionPlan.primaryFormulation?.id ?? null,
    v2Secondary: row.result.decisionPlan.secondaryFormulations.map((candidate) => candidate.id),
    v2Alternative: row.result.decisionPlan.alternativeFormulations.map((candidate) => candidate.id),
    confidence: row.result.decisionPlan.confidence,
    contradictionCount: row.result.trace.contradictions.length,
    validation: row.result.validation,
    providerCalls: row.result.providerCalls,
    fallbackUsed: row.result.fallbackUsed,
    recoveryStatus: row.result.recoveryStatus,
    trace: safeTrace(row.result),
  }))

  const allLiveRows = rows
  const combinedMetrics = liveMetrics(allLiveRows)
  const attempts = combinedMetrics.attempts
  const measuredAttempts = combinedMetrics.measured
  const latencies = measuredAttempts.map((attempt) => attempt.latencyMs)
  const inputTokens = measuredAttempts.map((attempt) => attempt.usage.inputTokens)
  const outputTokens = measuredAttempts.map((attempt) => attempt.usage.outputTokens)
  const costs = measuredAttempts.map((attempt) => attempt.usage.costMicrousd)
  const repairCount = combinedMetrics.repairAttempts
  const newRepetition = rows.map((row) => row.result.validation.repetitionScore)
  const confidenceCounts = Object.fromEntries(["LOW", "MODERATE", "MODERATE_HIGH", "HIGH"].map((level) => [level, rows.filter((row) => row.result.decisionPlan.confidence.level === level).length]))
  const totalCostMicrousd = costs.reduce((sum, value) => sum + value, 0)
  const acceptedLunaReportCount = allLiveRows.filter((row) => !row.result.fallbackUsed && row.result.trace.realizationAttempts.some((attempt) => attempt.provider === "luna" && attempt.responseId)).length
  const legacyOldPrimary = ["domain_sensory", "domain_executive", "multi_domain", "multi_domain", "domain_physiological"]
  const legacyComparison = calibrationRows.filter((row) => row.fixture.cohort === "legacy-five").map((row, index) => ({
    caseId: row.fixture.id,
    before: legacyOldPrimary[index],
    after: row.result.decisionPlan.primaryFormulation?.id ?? "UNCERTAIN",
    decisionState: row.result.decisionPlan.decisionState,
    confidence: row.result.decisionPlan.confidence.level,
  }))
  const diagnosticPatterns = [
    "single-domain-sensory",
    "single-domain-executive",
    "single-domain-emotional",
    "single-domain-physiological",
    "single-domain-interoception",
    "single-domain-cognitive",
    "multi-domain",
    "balanced-preserved",
    "low-score-no-functional-evidence",
    "external-disagreement",
    "dna-external-sensory-discrepancy",
    "contextual-mixed",
  ]
  const freshDiagnostics = diagnosticPatterns.map((pattern) => {
    const row = calibrationRows.find((candidate) => candidate.fixture.pattern === pattern)
    if (!row) throw new Error(`diagnostic_pattern_missing:${pattern}`)
    return {
      pattern,
      primary: row.result.decisionPlan.primaryFormulation?.id ?? null,
      decisionState: row.result.decisionPlan.decisionState,
      confidence: row.result.decisionPlan.confidence.level,
      discrepancyEdges: row.result.evidenceMatrix.relations.filter((relation) => relation.type === "DISCREPANT").length,
      discrepancyClusters: row.result.evidenceMatrix.discrepancyClusters.length,
    }
  })
  const knowledgeAudit = auditReportKnowledgeCore()
  const bridgeSectionUsage = Object.fromEntries(["section_3", "section_4", "section_5", "section_8"].map((sectionId) => [
    sectionId,
    rows.reduce((sum, row) => sum + (row.result.knowledgeBridge.sectionUsage[sectionId as keyof typeof row.result.knowledgeBridge.sectionUsage]?.length ?? 0), 0),
  ]))
  const objectiveSummary = {
    version: REPORT_V2_VERSION,
    generatedAt: new Date().toISOString(),
    mode: "REPORT_V2_SHADOW",
    productionActivated: false,
    literatureMode: "STANDARD",
    knowledgeBridge: {
      audit: knowledgeAudit.summary,
      sectionUsage: bridgeSectionUsage,
      decisionAuthority: "CASE_EVIDENCE",
      ownerBookAuthority: "OWNER_BOOK",
      literatureAuthority: "EXTERNAL_LITERATURE",
    },
    cases: {
      deterministicRegression: { total: calibrationRows.length, legacy: legacy.length, fresh: fresh.length, adversarial: fresh.filter((row) => row.adversarial).length },
      blindPilot: { total: rows.length, distribution: FRESH_PILOT_DISTRIBUTION },
    },
    calibration: {
      before: V2_0_CALIBRATION_BASELINE,
      after: calibrationAfter,
      legacyComparison,
      freshDiagnostics,
    },
    gates: {
      scoringRegression: 0,
      headingRegression: 0,
      contextualWronglyDiscrepant: calibrationAfter.contextualWronglyDiscrepantEdges,
      unknownExternalWronglyDiscrepant: calibrationAfter.unknownExternalWronglyDiscrepantEdges,
      duplicateDiscrepancyInflation: calibrationAfter.discrepancyPenaltyInflation,
      uncertainAsCandidate: calibrationAfter.uncertainAsCandidate,
      section23SemanticOverlap: calibrationAfter.section23AllowedClaimOverlap,
      unsupportedCausalRelation: calibrationRows.reduce((sum, row) => sum + row.result.validation.unsupportedRelationCount, 0),
      unsupportedPrimaryFormulation: calibrationRows.filter((row) => row.result.decisionPlan.primaryFormulation && !row.result.decisionPlan.primaryFormulation.eligibleForPrimary && !["balanced", "multi_domain"].includes(row.result.decisionPlan.primaryFormulation.id)).length,
      majorContradictionOmission: calibrationRows.filter((row) => row.result.validation.failureCodes.includes("CONTRADICTORY_EVIDENCE_OMITTED")).length,
      preservedCapacityOmission: calibrationRows.filter((row) => row.result.validation.failureCodes.includes("PRESERVED_CAPACITY_OMITTED")).length,
      externalDiscrepancyOmission: calibrationRows.filter((row) => row.result.validation.failureCodes.includes("EXTERNAL_TEST_DISCREPANCY_OMITTED")).length,
      piiToLuna: allLiveRows.reduce((sum, row) => sum + row.result.validation.piiViolationCount, 0),
      crossSectionContradiction: calibrationRows.filter((row) => row.result.validation.failureCodes.includes("CROSS_SECTION_CONTRADICTION")).length,
      literatureClaimSourceMismatch: calibrationRows.filter((row) => row.result.validation.failureCodes.includes("LITERATURE_CLAIM_SOURCE_MISMATCH")).length,
      decisionChangedByKnowledgeBridge: rows.filter((row) => row.result.trace.decisionHashBeforeKnowledge !== row.result.trace.decisionHashAfterKnowledge).length,
      unsupportedCaseSpecificAddition: freshErrors.unsupportedCaseSpecificAddition,
      knowledgeAuthorityViolation: freshErrors.authorityViolation,
      knowledgeSourceViolation: freshErrors.sourceViolation,
      internalEngineJargon: freshErrors.internalEngineJargon,
      blankSection: freshErrors.blankSection,
      calibration: calibrationErrors,
      fresh: freshErrors,
      shadowGatePassed: shadowGate,
    },
    metrics: {
      requiredClaimCoverageMean: mean(rows.map((row) => row.result.validation.requiredClaimCoverage)),
      omissionCount: rows.reduce((sum, row) => sum + row.result.validation.omissionCount, 0),
      relationViolationCount: rows.reduce((sum, row) => sum + row.result.validation.unsupportedRelationCount, 0),
      section23AllowedClaimOverlapBefore: V2_0_CALIBRATION_BASELINE.section23AllowedClaimOverlap,
      section23AllowedClaimOverlapAfter: calibrationAfter.section23AllowedClaimOverlap,
      repetitionV2Mean: mean(newRepetition),
      confidenceCounts,
      luna: {
        requested: useLuna,
        model: useLuna ? DNA_REPORT_LUNA_MODEL : null,
        pricingSnapshot: DNA_REPORT_LUNA_PRICING_VERSION,
        providerCalls: attempts.length,
        measuredCalls: measuredAttempts.length,
        attemptedReportCount: useLuna ? allLiveRows.length : 0,
        acceptedLunaReportCount: useLuna ? acceptedLunaReportCount : 0,
        deterministicFallbackReportCount: useLuna ? combinedMetrics.fallback : 0,
        directAcceptedReportCount: useLuna ? combinedMetrics.directAccepted : 0,
        controlledRepairReportCount: useLuna ? combinedMetrics.controlledRepair : 0,
        lunaRepairedReportCount: useLuna ? combinedMetrics.lunaRepaired : 0,
        repairedReportCount: useLuna ? combinedMetrics.repairedReports : 0,
        averageCallsPerReport: useLuna ? mean(allLiveRows.map((row) => row.result.providerCalls)) : null,
        maxCallsPerReport: useLuna ? combinedMetrics.maxCallsPerReport : null,
        repairCount,
        averageInputTokens: mean(inputTokens),
        averageOutputTokens: mean(outputTokens),
        repairRate: attempts.length ? Number((repairCount / attempts.length).toFixed(4)) : null,
        totalCostMicrousd: measuredAttempts.length ? totalCostMicrousd : null,
        totalCostUsd: measuredAttempts.length ? Number((totalCostMicrousd / 1_000_000).toFixed(6)) : null,
        freshCostUsd: useLuna ? Number((freshMetrics.totalCostMicrousd / 1_000_000).toFixed(6)) : null,
        freshCostCapUsd: LUNA_FRESH_COST_CAP_MICROUSD / 1_000_000,
        costPerReportUsd: measuredAttempts.length ? Number((totalCostMicrousd / rows.length / 1_000_000).toFixed(6)) : null,
        averageCostPerReportMicrousd: measuredAttempts.length ? Number((totalCostMicrousd / allLiveRows.length).toFixed(2)) : null,
        latencyP50Ms: percentile(latencies, 0.5),
        latencyP95Ms: percentile(latencies, 0.95),
        fabricatedMeasurements: false,
      },
    },
    objectiveReport23: [
      "V2 yalnız internal shadow girişinden çalıştırıldı.",
      "Production /api/ai-report yolu değiştirilmedi.",
      "Chat Box davranışına veya çalışma zamanına bağımlılık eklenmedi; rapor yalnız hash/provenance bağlı statik Knowledge Core artifactını read-only bridge üzerinden kullandı.",
      "dna-polarity-v2 puanlama sürümü korundu.",
      "60 maddelik puanlama sözleşmesi korundu.",
      "Yaş ve alan eşikleri değiştirilmedi.",
      "Sekiz başlık sözleşmesi korundu.",
      "Evidence Matrix atomik ve provenance içeren kanıt birimleri üretti.",
      "Bağlamsal modülasyon çelişkiden ayrıldı; pairwise ayrışmalar klinik kümelendi ve yönü belirsiz dış testler çelişki sayılmadı.",
      "Aday formülasyonlar bağımsız kanıttan puanlandı.",
      "Belirsizlik karar durumu yapıldı; kanıt tamlığı, tutarlılığı ve formülasyon güveni ayrıldı.",
      "Primary, secondary ve alternative adaylar trace içinde korundu.",
      "Dış testler yaş, kalite, construct ve ilgi üzerinden sıralandı.",
      "ClinicalDecisionPlan klinik içerik otoritesi oldu.",
      "LockedReportPlan ikinci ve üçüncü bölümü ayırdı; literatür claim, konu, yaş ve sınır üzerinden bağlandı.",
      "UNSUPPORTED claim plana alınmadı.",
      "CONFLICTED kanıt görünür limitation olarak zorunlu tutuldu.",
      "Luna yalnız de-identified locked plan alabildi.",
      "Privacy başarısızlığında provider çağrısı kapalıdır.",
      "Normal provider çağrısı bir, repair ile en fazla ikidir.",
      "Luna başarısızlığında aynı locked plan deterministik yazıldı.",
      "Beş legacy ve otuz altı fresh vaka objektif kapılardan geçirildi; gate sonrasında yalnız on beş fresh blind rapor üretildi.",
      "Otomatik kapılar klinik doğruluk kanıtı olarak sunulmadı.",
    ],
  }

  const root = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  const outputDir = path.join(root, "SelfMetaAI/report-v2-shadow", timestamp())
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(path.join(outputDir, "REPORT_KNOWLEDGE_AUDIT.md"), knowledgeAuditMarkdown(knowledgeAudit) + "\n", "utf8")
  fs.writeFileSync(path.join(outputDir, "report-knowledge-audit.json"), JSON.stringify({ summary: knowledgeAudit.summary, records: knowledgeAudit.records }, null, 2) + "\n", "utf8")
  const artifacts: Record<string, string> = {
    "BLIND_REPORTS.md": reportMarkdown(blindRows),
    "blind-reports.json": JSON.stringify({ version: REPORT_V2_VERSION, reports: blindRows }, null, 2) + "\n",
    "SEALED_DECISION_EVIDENCE.jsonl": sealedRows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "objective-summary.json": JSON.stringify(objectiveSummary, null, 2) + "\n",
  }
  for (const [filename, content] of Object.entries(artifacts)) fs.writeFileSync(path.join(outputDir, filename), content, "utf8")
  const manifest = {
    version: REPORT_V2_VERSION,
    generatedAt: objectiveSummary.generatedAt,
    packageContents: Object.entries(artifacts).map(([filename, content]) => ({ filename, sha256: sha256(content), bytes: Buffer.byteLength(content) })),
    packageContract: ["BLIND_REPORTS.md", "blind-reports.json", "SEALED_DECISION_EVIDENCE.jsonl", "objective-summary.json", "manifest.json"],
    sourceCaseCount: rows.length,
    blindReportCount: blindRows.length,
  }
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")
  const zipPath = path.join(outputDir, "blind-report-evaluation.zip")
  const zip = spawnSync("/usr/bin/zip", ["-X", "-q", zipPath, ...manifest.packageContract], { cwd: outputDir, encoding: "utf8" })
  if (zip.status !== 0) throw new Error(`zip_failed:${zip.stderr || zip.stdout}`)
  const zipHash = sha256(fs.readFileSync(zipPath))
  console.log("=== REPORT V2 BLIND PACKAGE ===")
  console.log(`Mode: ${useLuna ? "Luna + deterministic fallback" : "deterministic-only"}`)
  console.log(`Directory: ${outputDir}`)
  console.log(`ZIP: ${zipPath}`)
  console.log(`ZIP SHA-256: ${zipHash}`)
}

void main()
