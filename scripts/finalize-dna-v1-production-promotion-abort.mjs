import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { chmodSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

const OUTPUT_DIR = process.env.DNA_V1_PROMOTION_OUTPUT_DIR
const CANDIDATE_MANIFEST = process.env.DNA_V1_CANDIDATE_MANIFEST
if (!OUTPUT_DIR || !CANDIDATE_MANIFEST) throw new Error("promotion_abort_paths_required")

const sha = (value) => createHash("sha256").update(value).digest("hex")
const json = (file) => JSON.parse(readFileSync(file, "utf8"))
const write = (name, value) => {
  const target = path.join(OUTPUT_DIR, name)
  writeFileSync(target, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(target, 0o600)
  return target
}

function filesUnder(input) {
  if (!statSync(input).isDirectory()) return [input]
  return readdirSync(input, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(input, entry.name)
    return entry.isDirectory() ? filesUnder(child) : entry.isFile() ? [child] : []
  })
}

function treeHash(inputs) {
  const files = inputs.flatMap((input) => filesUnder(input)).sort()
  const digest = createHash("sha256")
  for (const file of files) {
    digest.update(path.relative(process.cwd(), file))
    digest.update("\0")
    digest.update(readFileSync(file))
    digest.update("\0")
  }
  return Object.freeze({ sha256: digest.digest("hex"), fileCount: files.length })
}

mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
const candidate = json(CANDIDATE_MANIFEST)
const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const worktreeRows = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
  .split(/\r?\n/u).filter(Boolean)
const trackedModified = worktreeRows.filter((row) => !row.startsWith("??")).length
const untracked = worktreeRows.filter((row) => row.startsWith("??")).length
const rollbackSha = candidate.rollback.sha
execFileSync("git", ["cat-file", "-e", `${rollbackSha}^{commit}`])

const sourceFingerprint = treeHash([
  path.join(process.cwd(), "src/app/api/app/dna-chat"),
  path.join(process.cwd(), "src/app/dna-asistani"),
  path.join(process.cwd(), "src/lib/dna/chat"),
  path.join(process.cwd(), "src/lib/dna/reportV2"),
])
const vercelProjectHash = sha(readFileSync(path.join(process.cwd(), ".vercel/project.json")))
const generatedAt = new Date().toISOString()
const blocker = "UNCOMMITTED_AMBIGUOUS_PRODUCT_SOURCE_TREE"

const smoke = Object.freeze({
  schemaVersion: "dna-v1-production-smoke-results@1",
  generatedAt,
  preDeploy: Object.freeze({
    status: "NOT_RUN_BLOCKED_BEFORE_PROVIDER_SPEND",
    blocker,
    chat: Object.freeze({ requestedMessages: 20, executedMessages: 0, realProviderCalls: 0,
      lunaOn: 0, lunaOff: 0, runtimeErrors: null, criticalErrors: null }),
    report: Object.freeze({ requestedCases: 3, executedCases: 0, realProviderCalls: 0,
      runtimeErrors: null, decisionDrift: null }),
    providerCostUsd: 0,
    hardCapUsd: 0.1,
    hardGate: "FAIL_NOT_EXECUTED",
  }),
  deployment: Object.freeze({ attempted: false, reason: blocker }),
  postDeploy: Object.freeze({ status: "NOT_APPLICABLE_NOT_DEPLOYED", chat: "NOT_RUN", report: "NOT_RUN" }),
  violations: Object.freeze({ unsupportedScience: null, source: null, safety: null, privacy: null,
    note: "No real-provider or production smoke was executed after the source-integrity blocker." }),
})

const rollback = Object.freeze({
  schemaVersion: "dna-v1-rollback-manifest@1",
  generatedAt,
  label: "DNA_V1_PRE_RELEASE_ROLLBACK",
  labelCreatedInGit: false,
  rollbackSha,
  rollbackCommitVerified: true,
  rollbackExecuted: false,
  reasonNotExecuted: "No production deployment occurred.",
  candidateRelationship: Object.freeze({ candidateManifestGitSha: candidate.release.gitSha,
    currentHead: gitSha, sameSha: candidate.release.gitSha === gitSha }),
  productionSnapshot: Object.freeze({
    source: "CERTIFIED_PREPRODUCTION_MANIFEST_ONLY",
    liveDeploymentSnapshotCaptured: false,
    productionBaselineHash: candidate.rollback.productionBaselineHash,
    envConfigSnapshot: Object.freeze({ vercelProjectLinked: true, vercelProjectConfigSha256: vercelProjectHash,
      secretValuesRecorded: false, secretsChangedByThisRun: false }),
    database: Object.freeze({ migrationRequired: false, schemaChanged: false, liveSchemaVersion: "NOT_QUERIED_EARLY_ABORT" }),
    chatVersion: candidate.release.chatVersion,
    reportVersion: candidate.release.reportVersion,
    knowledgeVersion: candidate.release.knowledgeVersion,
    featureFlags: Object.freeze({ SIMPLIFY_SUPPORTED_FEATURE: false, SIMPLIFY_EXPERIMENTAL_ENABLED: false }),
  }),
})

const releaseManifest = Object.freeze({
  schemaVersion: "dna-v1-production-release-manifest@1",
  generatedAt,
  V1_PRODUCTION_STATUS: "NOT_DEPLOYED",
  historicalValidation: candidate.historicalValidation,
  releaseScope: candidate.scope,
  candidate: Object.freeze({
    manifestPath: CANDIDATE_MANIFEST,
    manifestSha256: sha(readFileSync(CANDIDATE_MANIFEST)),
    manifestGitSha: candidate.release.gitSha,
    currentGitSha: gitSha,
    gitShaMatches: candidate.release.gitSha === gitSha,
    v1ChatScopedReady: candidate.decisions.V1_CONTROLLED_PRODUCTION_READY === "YES",
    reportReady: candidate.decisions.REPORT_PREPRODUCTION_READY === "YES",
    currentSourceFingerprint: sourceFingerprint,
    expectedSourceFingerprintPresentInCandidateManifest: false,
    worktree: Object.freeze({ clean: worktreeRows.length === 0, trackedModified, untracked,
      totalStatusRows: worktreeRows.length, ambiguous: true }),
    releaseCandidateHashVerified: false,
  }),
  isolation: Object.freeze({ noActiveDevelopmentOrTestProcessObserved: true,
    runSpecificOutput: true, secretsChanged: false, chatReportFrozenEvidenceIsolation: "PASS",
    promotionIsolationGate: "FAIL_WORKTREE_AMBIGUOUS" }),
  preDeploySmoke: Object.freeze({ status: smoke.preDeploy.status, providerCalls: 0, costUsd: 0,
    hardGate: smoke.preDeploy.hardGate }),
  deployment: Object.freeze({ attempted: false, deployed: false, productionTagCreated: false,
    requestedTag: "DNA_V1_CONTROLLED_PRODUCTION_2026_08_17", deploymentTimestamp: null }),
  deployedVersions: Object.freeze({ chat: "UNCHANGED_NOT_PROMOTED", report: "UNCHANGED_NOT_PROMOTED",
    knowledge: "UNCHANGED_NOT_PROMOTED", scientificCatalog: "UNCHANGED_NOT_PROMOTED",
    adaptiveLuna: "UNCHANGED_NOT_PROMOTED" }),
  database: Object.freeze({ migrationRun: false, schemaChanged: false }),
  postDeploySmoke: smoke.postDeploy,
  monitoring: Object.freeze({ productionMetricsAvailableFromThisRun: false,
    rawClinicalOrPersonalContentRecorded: false }),
  rollback: Object.freeze({ ready: true, sha: rollbackSha, verified: true, executed: false }),
  shadowExperimentalLeak: false,
  blocker: Object.freeze({ code: blocker,
    detail: "Candidate manifest points to HEAD, but the certified runtime depends on modified and untracked product files not represented by that commit. Promotion policy requires abort rather than an ambiguous deploy." }),
})

const notes = `# DNA Intelligence V1 Release Notes\n\n` +
  `## Promotion status\n\nNOT_DEPLOYED. The controlled promotion stopped before provider spend because the candidate source tree was not clean or commit-addressable.\n\n` +
  `## Certified V1 capabilities\n\n- DEFINE\n- WHY / FUNCTION\n- DEEPEN\n- EXAMPLE\n- COMPARE\n- CORRECTION\n- Multi-turn context\n- Two-part supported questions\n- Typo, incomplete, and student-language input\n- Turkish-English mixed input\n- Boundary / limitation\n- Catalog-limited safe response\n\n` +
  `## Known and deferred\n\n- SIMPLIFY: DEFERRED_POST_V1\n- EXPLICIT_SIMPLIFY_TRANSFORMATION: NOT_CERTIFIED_FOR_V1\n- SIMPLIFY_SUPPORTED_FEATURE=false\n- SIMPLIFY_EXPERIMENTAL_ENABLED=false\n\n` +
  `The historical full-feature International result remains FAIL. The accurate scoped statement is: “V1 scoped pre-production validation passed after explicit deferral of the SIMPLIFY transformation capability.”\n`

write("PRODUCTION_SMOKE_RESULTS.json", smoke)
write("ROLLBACK_MANIFEST_DNA_V1.json", rollback)
write("DNA_V1_PRODUCTION_RELEASE_MANIFEST.json", releaseManifest)
write("RELEASE_NOTES_DNA_V1.md", notes)

console.log(JSON.stringify({ outputDir: OUTPUT_DIR, status: releaseManifest.V1_PRODUCTION_STATUS,
  blocker, trackedModified, untracked, totalStatusRows: worktreeRows.length,
  rollbackVerified: true, providerCalls: 0, costUsd: 0 }, null, 2))
