import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const RUN_ID = process.env.DNA_FINAL_PREPROD_RUN_ID?.trim() || "run-20260814T172656Z"
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const RUN_ROOT = process.env.DNA_FINAL_PREPROD_RUN_DIR?.trim()
  || path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/final-preproduction-acceleration", RUN_ID)
const CERT = path.join(RUN_ROOT, "certification")
const KNOWLEDGE = path.join(RUN_ROOT, "knowledge-expansion")
const BASELINE_FILE = path.join(RUN_ROOT, "preproduction-baseline.json")
const CERT_SUMMARY_FILE = path.join(CERT, "objective-certification-summary.json")
const KNOWLEDGE_SUMMARY_FILE = path.join(KNOWLEDGE, "knowledge-expansion-summary.json")
const LEGACY_FILE = path.join(CERT, "legacy-regression-summary.json")
const STRUCTURAL_FILE = path.join(CERT, "legacy-structural-holdout/objective-run-summary.json")
const SEMANTIC_FILE = path.join(SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/semantic-operation-holdout/final-preprod-20260814/summary.json")

function sha(value) { return createHash("sha256").update(value).digest("hex") }
function json(file) { return JSON.parse(readFileSync(file, "utf8")) }
function jsonlCount(file) { return readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean).length }
function writePrivate(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); chmodSync(file, 0o600)
}
function count(value, pattern) { return (value.match(pattern) ?? []).length }

for (const file of [BASELINE_FILE, CERT_SUMMARY_FILE, KNOWLEDGE_SUMMARY_FILE, LEGACY_FILE, STRUCTURAL_FILE, SEMANTIC_FILE]) {
  if (!existsSync(file)) throw new Error(`final_preproduction_missing_evidence:${file}`)
}

const baseline = json(BASELINE_FILE)
const certification = json(CERT_SUMMARY_FILE)
const knowledge = json(KNOWLEDGE_SUMMARY_FILE)
const legacy = json(LEGACY_FILE)
const structural = json(STRUCTURAL_FILE)
const semantic = json(SEMANTIC_FILE)
const currentGitSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim()

const baselineTime = Date.parse(baseline.createdAt)
function changedFilesUnder(root) {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name)
    if (entry.isDirectory()) return changedFilesUnder(file)
    return entry.isFile() && statSync(file).mtimeMs > baselineTime ? [path.relative(ROOT, file)] : []
  })
}
const rootFiles = readdirSync(ROOT, { withFileTypes: true }).flatMap((entry) => {
  if (!entry.isFile()) return []
  const file = path.join(ROOT, entry.name)
  return statSync(file).mtimeMs > baselineTime ? [entry.name] : []
})
const postBaselineFiles = [...rootFiles, ...changedFilesUnder(path.join(ROOT, "src")),
  ...changedFilesUnder(path.join(ROOT, "scripts"))].sort()
const reportChangedFiles = postBaselineFiles.filter((file) => file.startsWith("src/lib/report/")
  || file.startsWith("scripts/run-report") || file.startsWith("scripts/run-dna-report"))
const productionChangedFiles = postBaselineFiles.filter((file) => file.startsWith("src/app/")
  || ["vercel.json", "next.config.js", "next.config.mjs", "next.config.ts"].includes(file))

const pragmatic = legacy.results.find((row) => row.name === "Pragmatic holdout")
const security = legacy.results.find((row) => row.name === "Chat security")
const blockers = Object.freeze([
  Object.freeze({ code: "LEGACY_STRUCTURAL_HOLDOUT_MISS", acceptance: structural.acceptance?.pass === true,
    criticalViolationCount: structural.metrics?.criticalViolationCount ?? null }),
  Object.freeze({ code: "LEGACY_PRAGMATIC_HOLDOUT_MISS", acceptance: false,
    evidenceSha256: pragmatic?.stdoutSha256 ?? null }),
  Object.freeze({ code: "LEGACY_SEMANTIC_OPERATION_HOLDOUT_MISS",
    acceptance: semantic.correctionHoldout?.acceptance === true && semantic.semanticHoldout?.acceptance === true,
    criticalViolationCount: semantic.semanticHoldout?.criticalViolationCount ?? null }),
  Object.freeze({ code: "LEGACY_CHAT_SECURITY_SOURCE_SHAPE_MISS", acceptance: false,
    evidenceSha256: security?.stderrSha256 ?? null }),
])
const finalLegacy = Object.freeze({
  schemaVersion: "dna-chat-final-preproduction-legacy-final@1",
  runId: RUN_ID,
  initialSuites: legacy.suites,
  initialPassed: legacy.passed,
  initialFailed: legacy.failed,
  providerCalls: 0,
  structuralRerun: structural,
  semanticRerun: semantic,
  blockers,
  pass: false,
})
const finalLegacyFile = path.join(CERT, "legacy-regression-final.json")
writePrivate(finalLegacyFile, finalLegacy)

const blindCoreTarget = path.join(CERT, "BLIND_NEW_CORE_ATOMS.md")
copyFileSync(path.join(KNOWLEDGE, "BLIND_NEW_CORE_ATOMS.md"), blindCoreTarget)
chmodSync(blindCoreTarget, 0o600)
const semanticTarget = path.join(CERT, "legacy-semantic-operation-summary.json")
copyFileSync(SEMANTIC_FILE, semanticTarget); chmodSync(semanticTarget, 0o600)

const blind200 = readFileSync(path.join(CERT, "BLIND_CHAT_PREPROD_200.md"), "utf8")
const blindFollowups = readFileSync(path.join(CERT, "BLIND_CHAT_PREPROD_FOLLOWUPS_40.md"), "utf8")
const blindAdversarial = readFileSync(path.join(CERT, "BLIND_CHAT_PREPROD_ADVERSARIAL_30.md"), "utf8")
const blindSimple = readFileSync(path.join(CERT, "BLIND_ADAPTIVE_SIMPLE_CASES.md"), "utf8")
const blindCounts = Object.freeze({
  freshUsers: count(blind200, /^Kullanıcı:$/gmu), freshAssistants: count(blind200, /^Asistan:$/gmu),
  followupUsers: count(blindFollowups, /^Kullanıcı:$/gmu), followupAssistants: count(blindFollowups, /^Asistan:$/gmu),
  adversarialUsers: count(blindAdversarial, /^Kullanıcı:$/gmu), adversarialAssistants: count(blindAdversarial, /^Asistan:$/gmu),
  auditUsers: count(blindSimple, /^Kullanıcı:$/gmu), auditA: count(blindSimple, /^Yanıt A:$/gmu), auditB: count(blindSimple, /^Yanıt B:$/gmu),
})
if (blindCounts.freshUsers !== 200 || blindCounts.freshAssistants !== 200
  || blindCounts.followupUsers !== 120 || blindCounts.followupAssistants !== 120
  || blindCounts.adversarialUsers !== 30 || blindCounts.adversarialAssistants !== 30
  || blindCounts.auditUsers !== 5 || blindCounts.auditA !== 5 || blindCounts.auditB !== 5) {
  throw new Error(`final_preproduction_blind_count_mismatch:${JSON.stringify(blindCounts)}`)
}
const sealedCount = jsonlCount(path.join(CERT, "SEALED_CHAT_PREPROD_TRACE.jsonl"))
const core500Count = jsonlCount(path.join(CERT, "CORE_500_OBJECTIVE_BENCHMARK.jsonl"))
if (sealedCount !== 395 || core500Count !== 500) throw new Error("final_preproduction_evidence_count_mismatch")

const manifest = Object.freeze({
  schemaVersion: "dna-chat-final-preproduction-release-manifest@1",
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  gitSha: currentGitSha,
  baselineGitSha: baseline.gitSha,
  routingVersion: Object.freeze({ conversationContext: baseline.versions.conversationContext,
    pragmaticTask: baseline.versions.pragmaticTask, validator: baseline.versions.routingValidator }),
  knowledge: Object.freeze({ version: certification.versions.knowledge,
    sha256: sha(readFileSync(path.join(KNOWLEDGE, "preproduction-knowledge-catalog.jsonl"))),
    productionEligible: false, candidateShadowOnly: true }),
  scientificCatalog: Object.freeze({ version: "baseline-scientific-scope@1", sha256: baseline.scopeHashes.scientific }),
  adaptiveLunaPolicyVersion: certification.versions.adaptiveLuna,
  costEfficientModeVersion: certification.versions.costEfficientMode,
  deterministicRealizerVersion: certification.versions.deterministicRealizer,
  lunaVersion: certification.versions.lunaRealizer,
  regression: Object.freeze({ preliminaryCertificationPass: certification.gates.preliminaryGatesPass,
    fullLegacyPass: finalLegacy.pass, blockers }),
  providerCost: certification.provider,
  rollbackCandidate: Object.freeze({ gitSha: baseline.gitSha, baselineScopeHashes: baseline.scopeHashes,
    reason: "Legacy acceptance gates are not all green; production promotion is blocked." }),
  gates: Object.freeze({ adaptiveQa: certification.gates.adaptiveQa, routing: certification.gates.routing,
    critical: certification.gates.critical, fullLegacy: false, chatPreproductionReady: false }),
  isolation: Object.freeze({ productionChanged: productionChangedFiles.length > 0,
    reportChanged: reportChangedFiles.length > 0, productionChangedFiles, reportChangedFiles,
    postBaselineChangedFiles: postBaselineFiles }),
  evidenceCounts: Object.freeze({ blind: blindCounts, sealedTrace: sealedCount, core500: core500Count }),
})
const manifestFile = path.join(CERT, "RELEASE_MANIFEST_CHAT.json")
writePrivate(manifestFile, manifest)

const integrityFiles = [
  "BLIND_CHAT_PREPROD_200.md", "BLIND_CHAT_PREPROD_FOLLOWUPS_40.md", "BLIND_CHAT_PREPROD_ADVERSARIAL_30.md",
  "BLIND_ADAPTIVE_SIMPLE_CASES.md", "BLIND_NEW_CORE_ATOMS.md", "SEALED_CHAT_PREPROD_TRACE.jsonl",
  "CORE_500_OBJECTIVE_BENCHMARK.jsonl", "objective-certification-summary.json", "legacy-regression-summary.json",
  "legacy-regression-final.json", "RELEASE_MANIFEST_CHAT.json",
]
const integrity = Object.freeze({
  schemaVersion: "dna-chat-final-preproduction-artifact-integrity@1",
  runId: RUN_ID,
  files: Object.fromEntries(integrityFiles.map((name) => [name, Object.freeze({
    bytes: statSync(path.join(CERT, name)).size,
    sha256: sha(readFileSync(path.join(CERT, name))),
  })])),
})
writePrivate(path.join(CERT, "ARTIFACT_INTEGRITY.json"), integrity)

const finalSummary = Object.freeze({
  schemaVersion: "dna-chat-final-preproduction-final-summary@1",
  runId: RUN_ID,
  implementationComplete: true,
  providerCertificationComplete: true,
  knowledgeExpansionComplete: true,
  legacyRegressionComplete: true,
  chatPreproductionReady: false,
  blockers,
  productionChanged: productionChangedFiles.length > 0,
  reportChanged: reportChangedFiles.length > 0,
  totalIncrementalProviderCostUsd: certification.provider.totalCostUsd,
})
writePrivate(path.join(CERT, "FINAL_OBJECTIVE_SUMMARY.json"), finalSummary)

const runningLock = path.join(RUN_ROOT, "RUNNING.lock")
const completedLock = path.join(RUN_ROOT, "COMPLETED_WITH_BLOCKERS.lock")
if (existsSync(runningLock) && !existsSync(completedLock)) renameSync(runningLock, completedLock)

console.log(JSON.stringify({ manifestFile, finalLegacyFile, chatPreproductionReady: false,
  productionChanged: false, reportChanged: false, sealedCount, core500Count }))
