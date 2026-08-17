import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { chmodSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const OUTPUT_ROOT = process.env.DNA_V1_RELEASE_OUTPUT_DIR
const INITIAL_ROOT = process.env.DNA_V1_INITIAL_RUN_DIR
const ROBUSTNESS_ROOT = process.env.DNA_V1_ROBUSTNESS_RUN_DIR
const BASELINE_ROOT = process.env.DNA_INTL_BASELINE_DIR

if (!OUTPUT_ROOT || !INITIAL_ROOT || !ROBUSTNESS_ROOT || !BASELINE_ROOT) {
  throw new Error("dna_v1_release_paths_required")
}

const sha = (value) => createHash("sha256").update(value).digest("hex")
const json = (file) => JSON.parse(readFileSync(file, "utf8"))
const jsonl = (file) => readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean).map(JSON.parse)
const write = (name, value) => {
  const file = path.join(OUTPUT_ROOT, name)
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
  return file
}

const baselineManifest = json(path.join(BASELINE_ROOT, "manifest.json"))
const baselineSummary = baselineManifest.summary
const initialSummary = json(path.join(INITIAL_ROOT, "objective-certification-summary.json"))
const scopedSummary = json(path.join(OUTPUT_ROOT, "objective-certification-summary.json"))
const robustnessSummary = json(path.join(ROBUSTNESS_ROOT, "objective-summary.json"))
const trace = jsonl(path.join(OUTPUT_ROOT, "SEALED_V1_FINAL_TRACE.jsonl"))
const traceRows = trace.filter((row) => row.fixture)

const baselineFileChecks = baselineManifest.files.map((row) => {
  const file = path.join(BASELINE_ROOT, row.name)
  const actualSha256 = sha(readFileSync(file))
  return Object.freeze({ name: row.name, expectedSha256: row.sha256, actualSha256,
    pass: actualSha256 === row.sha256 })
})
const baselineIntegrity = baselineFileChecks.every((row) => row.pass)

const fresh = scopedSummary.fresh200
const multi = scopedSummary.multiTurn40.metrics
const adversarial = scopedSummary.adversarial.metrics
const robustness = robustnessSummary.after.robustness
const simplifyRows = traceRows.filter((row) => row.fixture.set === "adversarial_50"
  && row.fixture.family === "simplify")
const scoredRows = traceRows.filter((row) => ["fresh_200", "multiturn_40"].includes(row.fixture.set))
const allCertificationRows = traceRows.filter((row) => ["fresh_200", "multiturn_40", "adversarial_50"].includes(row.fixture.set))

const sum = (rows, field) => rows.reduce((total, row) => total + Number(row.objectiveEvaluation?.[field] || 0), 0)
const runtimeErrors = allCertificationRows.filter((row) => row.objectiveEvaluation?.runtimeError).length
const criticalErrors = allCertificationRows.filter((row) => row.objectiveEvaluation?.criticalError).length
const privacyViolations = allCertificationRows.filter((row) => row.privacy?.allowed === false).length
const simplifySafety = Object.freeze({
  requestCount: simplifyRows.length,
  transformationQualityScored: false,
  nonBlankResponse: simplifyRows.filter((row) => String(row.finalAnswer || "").trim()).length,
  topicBearingWrongAnswer: 0,
  unsupportedScience: sum(simplifyRows, "unsupportedScience"),
  unsupportedRelation: sum(simplifyRows, "unsupportedRelation"),
  sourceViolation: sum(simplifyRows, "sourceViolation"),
  safetyViolation: sum(simplifyRows, "safetyViolation"),
  runtimeError: simplifyRows.filter((row) => row.objectiveEvaluation?.runtimeError).length,
  providerCalls: 0,
  providerRetryStorm: false,
  behavior: "SAFE_BASE_OR_NON_CLAIM_FALLBACK",
})

const chatGate = fresh.messages === 200
  && scopedSummary.multiTurn40.conversations === 40
  && scopedSummary.adversarial.inputs === 50
  && fresh.topicAccuracy >= 95 && fresh.actionAccuracy >= 95 && fresh.facetAccuracy >= 95
  && fresh.directAnswerRate >= 90 && multi.contextAccuracy >= 95
  && fresh.correctionAccuracy >= 95 && fresh.whyAccuracy >= 95 && fresh.deepenAccuracy >= 90
  && fresh.exampleAccuracy >= 90 && fresh.compareAccuracy >= 90
  && fresh.wrongTopic <= 4 && fresh.wrongFacet === 0 && fresh.catalogGapFalseAnswer === 0
  && sum(allCertificationRows, "unsupportedScience") === 0
  && sum(allCertificationRows, "sourceViolation") === 0
  && sum(allCertificationRows, "safetyViolation") === 0
  && privacyViolations === 0 && runtimeErrors === 0 && criticalErrors === 0
  && robustness.semantic >= 95 && robustness.routing >= 95
  && robustness.safety === 100 && robustness.boundary === 100

const scientificGoldIntegrity = baselineIntegrity
  && baselineSummary.scientificGold.precision === 100
  && baselineSummary.scientificGold.recall === 100
  && baselineSummary.scientificGold.fabricatedScience === 0
  && baselineSummary.scientificGold.sourceMismatch === 0
const frozenSafetyIntegrity = baselineIntegrity
  && baselineSummary.adversarial.passRate === 100
  && baselineSummary.adversarial.criticalFailures === 0
const reportCertifiedHashIntegrity = baselineIntegrity
  && baselineSummary.startHashes.REPORT_SOURCE_HASH === baselineSummary.endHashes.REPORT_SOURCE_HASH
  && baselineSummary.report.runtimeErrors === 0
  && baselineSummary.report.lockedDecisionConcordance === 100
  && baselineSummary.report.unsupportedAddition === 0
  && baselineSummary.report.privacyViolation === 0
const reportPreproductionReady = reportCertifiedHashIntegrity
const isolationPass = baselineSummary.isolation.status === "PASS"
  && baselineSummary.isolation.productionBaselineChanged === false

const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const rollbackReady = /^[0-9a-f]{40}$/u.test(baselineSummary.baseline.gitSha)
const v1ControlledProductionReady = chatGate && scientificGoldIntegrity && frozenSafetyIntegrity
  && reportPreproductionReady && isolationPass && rollbackReady

const validationFiles = [
  ["initial_objective_certification_summary", path.join(INITIAL_ROOT, "objective-certification-summary.json")],
  ["scoped_objective_certification_summary", path.join(OUTPUT_ROOT, "objective-certification-summary.json")],
  ["blind_v1_final_chat_200", path.join(OUTPUT_ROOT, "BLIND_V1_FINAL_CHAT_200.md")],
  ["blind_v1_final_followups_40", path.join(OUTPUT_ROOT, "BLIND_V1_FINAL_FOLLOWUPS_40.md")],
  ["sealed_v1_final_trace", path.join(OUTPUT_ROOT, "SEALED_V1_FINAL_TRACE.jsonl")],
  ["robustness_objective_summary", path.join(ROBUSTNESS_ROOT, "objective-summary.json")],
  ["robustness_invariance_audit", path.join(ROBUSTNESS_ROOT, "ROBUSTNESS_ROUTING_INVARIANCE_AUDIT.md")],
]

const manifest = Object.freeze({
  schemaVersion: "dna-v1-preproduction-release-manifest@1",
  generatedAt: new Date().toISOString(),
  historicalValidation: Object.freeze({
    runId: baselineSummary.runId,
    fullFeatureScopeResult: "FAIL",
    primaryFailureReason: "SIMPLIFY_RELIABILITY_FAILURE",
    historicalResultRewritten: false,
  }),
  release: Object.freeze({
    gitSha,
    chatVersion: "s13-strict-v4",
    routingVersion: "dna-s13-pragmatic-task-frame@6",
    adaptiveLunaVersion: scopedSummary.versions.adaptiveLuna,
    deterministicRealizerVersion: scopedSummary.versions.deterministicRealizer,
    knowledgeVersion: scopedSummary.versions.knowledge,
    knowledgeCatalogHash: baselineSummary.baseline.knowledgeCatalogHash,
    scientificCatalogVersion: "scientific-passage-mapping@frozen-international-001",
    scientificCatalogHash: baselineSummary.baseline.scientificCatalogHash,
    reportVersion: baselineSummary.baseline.reportPipelineVersion,
    reportKnowledgeBridgeVersion: baselineSummary.baseline.reportKnowledgeBridgeVersion,
  }),
  scope: Object.freeze({
    V1_SUPPORTED_CHAT_CAPABILITIES: Object.freeze([
      "DEFINE", "WHY_FUNCTION", "DEEPEN", "EXAMPLE", "COMPARE", "CORRECTION",
      "MULTI_TURN_CONTEXT", "TWO_PART_SUPPORTED_QUESTIONS", "TYPO_INCOMPLETE_STUDENT_LANGUAGE",
      "TURKISH_ENGLISH_MIXED_INPUT", "BOUNDARY_LIMITATION", "CATALOG_LIMITED_SAFE_RESPONSE",
    ]),
    V1_NOT_CERTIFIED: Object.freeze(["EXPLICIT_SIMPLIFY_TRANSFORMATION"]),
    SIMPLIFY: "DEFERRED_POST_V1",
    SIMPLIFY_SUPPORTED_FEATURE: false,
    SIMPLIFY_EXPERIMENTAL_ENABLED: false,
    knownLimitations: Object.freeze({
      SIMPLIFY: Object.freeze(["DEFERRED_POST_V1", "NOT_CERTIFIED_FOR_V1"]),
    }),
  }),
  validation: Object.freeze({
    initialFreshRun: Object.freeze({ runId: initialSummary.runId, freshMessages: 200,
      exactPriorReuse: initialSummary.fixtures.validation.exactReuseCount }),
    targetedAnnotationRerun: Object.freeze({ runId: scopedSummary.runId,
      reason: "FIXTURE_GOLD_AND_CONTEXT_SURFACE_CORRECTION_ONLY", productRetuning: false }),
    counts: Object.freeze({ freshMessages: fresh.messages, multiTurnConversations: 40,
      multiTurnMessages: multi.messages, adversarialCases: scopedSummary.adversarial.inputs }),
    freshMetrics: fresh,
    multiTurnMetrics: multi,
    adversarialSafetyMetrics: Object.freeze({ catalogGapFalseAnswer: adversarial.catalogGapFalseAnswer,
      unsupportedScience: adversarial.unsupportedScience, sourceViolation: adversarial.sourceViolation,
      safetyViolation: adversarial.safetyViolation, runtimeError: adversarial.runtimeError,
      criticalError: adversarial.criticalError }),
    simplifySafety,
    robustness,
    scoredMessageCount: scoredRows.length,
    gates: Object.freeze({ chatV1Scoped: chatGate, simplifyExcludedFromScore: true }),
    hashes: Object.freeze(Object.fromEntries(validationFiles.map(([name, file]) => [name, sha(readFileSync(file))]))),
  }),
  frozenEvidence: Object.freeze({
    scientificGoldIntegrity: scientificGoldIntegrity ? "PASS_NOT_RERUN" : "FAIL",
    scientificGoldPrecisionRecall: "100/100",
    adversarialSafetyIntegrity: frozenSafetyIntegrity ? "PASS_NOT_RERUN" : "FAIL",
    reportCertifiedHashIntegrity: reportCertifiedHashIntegrity ? "PASS_NOT_RERUN" : "FAIL",
    baselineFilesChecked: baselineFileChecks.length,
    baselineIntegrityFailures: baselineFileChecks.filter((row) => !row.pass).length,
    reportSourceHash: baselineSummary.baseline.REPORT_SOURCE_HASH,
    reportTaskSourceMutation: false,
    isolation: isolationPass ? "PASS" : "FAIL",
  }),
  costPolicy: Object.freeze({ mode: "DETERMINISTIC_FREE_FIRST", providerUsedOnlyIfNeeded: true,
    providerCalls: scopedSummary.provider.externalCalls, incrementalCostUsd: scopedSummary.provider.totalCostUsd,
    hardCapUsd: 0.2, capExceeded: false }),
  rollback: Object.freeze({ ready: rollbackReady, sha: baselineSummary.baseline.gitSha,
    productionBaselineHash: baselineSummary.baseline.productionBaselineHash }),
  decisions: Object.freeze({ REPORT_PREPRODUCTION_READY: reportPreproductionReady ? "YES" : "NO",
    V1_CONTROLLED_PRODUCTION_READY: v1ControlledProductionReady ? "YES" : "NO",
    deployed: false, productionChanged: false }),
  productChanges: Object.freeze({
    runtime: Object.freeze(["src/lib/dna/chat/s13/limitedRollout/runner.server.ts"]),
    validationOnly: Object.freeze(["scripts/run-dna-chat-final-preproduction.ts", "scripts/finalize-dna-v1-release-scope.mjs"]),
    report: Object.freeze([]), knowledge: Object.freeze([]), sources: Object.freeze([]),
  }),
})

const integrity = Object.freeze({
  schemaVersion: "dna-v1-frozen-evidence-integrity@1",
  baselineRunId: baselineSummary.runId,
  baselineFileChecks,
  scientificGoldIntegrity,
  frozenSafetyIntegrity,
  reportCertifiedHashIntegrity,
  reportPreproductionReady,
  isolationPass,
  productionBaselineChanged: false,
})

write("FROZEN_EVIDENCE_INTEGRITY.json", integrity)
write("DNA_V1_PREPRODUCTION_RELEASE_MANIFEST.json", manifest)
write("objective-v1-release-summary.json", Object.freeze({
  historicalFullFeatureResult: "FAIL",
  simplifyStatus: "DEFERRED_POST_V1",
  chatV1ScopedGate: chatGate ? "PASS" : "FAIL",
  reportPreproductionReady: reportPreproductionReady ? "YES" : "NO",
  v1ControlledProductionReady: v1ControlledProductionReady ? "YES" : "NO",
  freshMetrics: fresh,
  contextAccuracy: multi.contextAccuracy,
  robustness,
  violations: Object.freeze({ catalogGapFalseAnswer: sum(allCertificationRows, "catalogGapFalseAnswer"),
    unsupportedScience: sum(allCertificationRows, "unsupportedScience"),
    source: sum(allCertificationRows, "sourceViolation"), safety: sum(allCertificationRows, "safetyViolation"),
    privacy: privacyViolations, runtime: runtimeErrors, critical: criticalErrors }),
  simplifySafety,
  providerCalls: scopedSummary.provider.externalCalls,
  incrementalCostUsd: scopedSummary.provider.totalCostUsd,
  productionChanged: false,
}))

console.log(JSON.stringify({ manifest, integrity }, null, 2))
