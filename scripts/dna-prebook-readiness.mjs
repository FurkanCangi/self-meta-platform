import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const PREBOOK_READINESS_VERSION = "dna-intelligence-prebook-readiness@5"
export const PROGRAM_STATE_VERSION = "dna-intelligence-program-state@5"
export const PROGRAM_VERSION = "dna-intelligence-v3-program@1"

const MODULE_PATH = fileURLToPath(import.meta.url)
const DEFAULT_REPO_ROOT = resolve(dirname(MODULE_PATH), "..")
const CURRENT_EVIDENCE_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/prebook-readiness-current.json"
const PROGRAM_STATE_RELATIVE_PATH = "docs/dna-intelligence/program/program-state.json"
const SHA256_PATTERN = /^[a-f0-9]{64}$/

const CHECKPOINT_COMPLETED_PHASES = Object.freeze([
  0, 1, 2,
  ...Array.from({ length: 34 }, (_, index) => index + 4),
])
const ALL_PROGRAM_PHASES = Object.freeze(Array.from({ length: 61 }, (_, index) => index))
const REAL_OUTPUT_INFRASTRUCTURE_PHASES = Object.freeze([
  0, 1, 2,
  ...Array.from({ length: 8 }, (_, index) => index + 4),
  13, 28,
  ...Array.from({ length: 6 }, (_, index) => index + 32),
])
const SCIENTIFIC_REVIEW_PHASES = Object.freeze([
  12,
  ...Array.from({ length: 14 }, (_, index) => index + 14),
])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  assert(existsSync(path), `prebook_readiness_required_file_missing:${path}`)
  return JSON.parse(readFileSync(path, "utf8"))
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function rawFileSha256(path) {
  return sha256Bytes(readFileSync(path))
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    )
  }
  return value
}

function canonicalSha256(value) {
  return sha256Bytes(Buffer.from(JSON.stringify(canonicalize(value)), "utf8"))
}

function runGit(repoRoot, args, fallback) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return fallback
  }
}

function countJsonArray(path) {
  if (!existsSync(path)) return 0
  const payload = readJson(path)
  return Array.isArray(payload) ? payload.length : 0
}

function resolveResearchRoot(requestedRoot) {
  const root = resolve(requestedRoot)
  assert(existsSync(root), `prebook_readiness_research_ssd_missing:${root}`)
  assert(!lstatSync(root).isSymbolicLink(), "prebook_readiness_research_root_symlink_rejected")
  const real = realpathSync(root)
  assert(real === root, "prebook_readiness_research_root_realpath_mismatch")
  assert(real.startsWith(`/Volumes${sep}`), "prebook_readiness_local_fallback_rejected")
  return real
}

function assertContained(root, path) {
  const absolute = resolve(path)
  const delta = relative(root, absolute)
  assert(delta !== "" && !delta.startsWith(`..${sep}`) && delta !== ".." && !delta.startsWith(sep),
    `prebook_readiness_path_escape:${absolute}`)
  return absolute
}

function evidenceHistory(repoRoot) {
  const evidenceRoot = join(repoRoot, "docs/dna-intelligence/program/evidence")
  return readdirSync(evidenceRoot)
    .filter((name) => name.endsWith(".json") && name !== "prebook-readiness-current.json")
    .sort()
    .map((name) => {
      const path = join(evidenceRoot, name)
      const payload = readJson(path)
      return {
        path: `docs/dna-intelligence/program/evidence/${name}`,
        recordedAt: payload.generatedAt ?? payload.testedAt ?? null,
        schemaVersion: payload.schemaVersion ?? "unknown",
        rawBytesSha256: rawFileSha256(path),
        authority: "historical_snapshot_non_authoritative_for_current_counts",
      }
    })
}

function countMethodAppraisalCandidateChains(methodRoot) {
  if (!existsSync(methodRoot)) return 0
  return readdirSync(methodRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      const root = join(methodRoot, entry.name)
      return existsSync(join(root, "pass-a.json"))
        && existsSync(join(root, "pass-b.json"))
        && existsSync(join(root, "reconciliation.json"))
    }).length
}

function countPreparedPassagePackets(packetRoot) {
  if (!existsSync(packetRoot)) return 0
  return readdirSync(packetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(join(packetRoot, entry.name, "r000001.json"))).length
}

function countPreparedClaimPackets(packetRoot) {
  if (!existsSync(packetRoot)) return 0
  return readdirSync(packetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .reduce((total, source) => total + readdirSync(join(packetRoot, source.name), {
      withFileTypes: true,
    }).filter((lane) => lane.isDirectory()
      && existsSync(join(packetRoot, source.name, lane.name, "r000001.json"))).length, 0)
}

function checkpointStatus(repoRoot, phase) {
  const prefix = `phase-${String(phase).padStart(2, "0")}-`
  const root = join(repoRoot, "docs/dna-intelligence/program/checkpoints")
  const matches = readdirSync(root).filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
  assert(matches.length === 1, `prebook_readiness_checkpoint_resolution_failed:phase_${phase}`)
  return readJson(join(root, matches[0]))
}

function assertEngineeringEvidence(repoRoot) {
  for (const phase of CHECKPOINT_COMPLETED_PHASES) {
    assert(checkpointStatus(repoRoot, phase).status === "completed",
      `prebook_readiness_completed_checkpoint_drift:phase_${phase}`)
  }
  const phase3 = checkpointStatus(repoRoot, 3)
  assert(phase3.status === "deferred_owner_book",
    "prebook_readiness_owner_book_checkpoint_not_deferred")
  const phase38 = checkpointStatus(repoRoot, 38)
  assert(phase38.status === "blocked_missing_real_payload",
    "prebook_readiness_phase_38_checkpoint_not_blocked")

  const phase32To44 = readJson(join(
    repoRoot,
    "docs/dna-intelligence/program/evidence/phase-32-44-engineering-and-readiness.json",
  ))
  const phase45To60 = readJson(join(
    repoRoot,
    "docs/dna-intelligence/program/evidence/phase-45-60-engineering-and-readiness.json",
  ))
  assert(phase32To44.phaseDisposition?.phases40To44
    === "engineering_gates_ready_not_executed_due_phase_order",
  "prebook_readiness_phase_40_44_engineering_evidence_missing")
  assert(Array.isArray(phase45To60.phaseDisposition?.engineeringContractsReady)
    && phase45To60.phaseDisposition.engineeringContractsReady.length === 16,
  "prebook_readiness_phase_45_60_engineering_evidence_missing")
}

export function collectPrebookFacts(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? DEFAULT_REPO_ROOT)
  const researchRoot = resolveResearchRoot(
    options.researchRoot ?? process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
  )
  assertEngineeringEvidence(repoRoot)

  const paths = {
    ownerBook: join(repoRoot, "docs/dna-intelligence/governance/v3/dna-book-lock-contract.json"),
    sourceIntegrity: join(repoRoot, "docs/dna-intelligence/governance/v3/source-integrity-archive-snapshot.json"),
    sourceGovernance: join(repoRoot, "docs/dna-intelligence/governance/v3/source-library-governance-snapshot.json"),
    sourceAppraisal: join(repoRoot, "docs/dna-intelligence/governance/v3/source-appraisal-normalization-snapshot.json"),
    evaluationReadiness: join(repoRoot, "docs/dna-intelligence/governance/v3/evaluation-readiness.json"),
    marketingEvidence: join(repoRoot, "docs/dna-intelligence/governance/v3/marketing-evidence-manifest.json"),
    phase32To44Evidence: join(
      repoRoot,
      "docs/dna-intelligence/program/evidence/phase-32-44-engineering-and-readiness.json",
    ),
    phase45To60Evidence: join(
      repoRoot,
      "docs/dna-intelligence/program/evidence/phase-45-60-engineering-and-readiness.json",
    ),
    runtimeModeSource: join(repoRoot, "src/lib/dna/chat/release/runtimeReleaseMode.ts"),
    v3Package: join(repoRoot, "src/lib/dna/chat/catalog/generated/v3/manifest.json"),
    candidateCorpus: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/candidate-corpus/candidate-jats-corpus.json",
    )),
    workpackIndex: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/candidate-corpus/method-review-workpack-index.json",
    )),
    methodAppraisals: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/method-appraisals",
    )),
    methodAppraisalBatchIndex: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/method-appraisals/batch-v1/run-index.json",
    )),
    methodAppraisalRegistrationIndex: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1/index.json",
    )),
    candidatePassageRegistrationRoot: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/candidate-passage-registrations/v1",
    )),
    candidateClaimExtractionRoot: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/candidate-claim-extractions/v1",
    )),
    candidateClaimReconciliationRoot: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/candidate-claim-reconciliations/v1",
    )),
    candidateClaimRereviewRoot: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/candidate-claim-rereviews/v1",
    )),
    prebookClosureRoot: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1",
    )),
    lockedQuestions: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/evaluation/v3/locked-benchmark/questions.json",
    )),
    variations: assertContained(researchRoot, join(
      researchRoot,
      "Datasets/DNA-Intelligence/evaluation/v3/variation-bank/variations.json",
    )),
  }

  const ownerBook = readJson(paths.ownerBook)
  const integrity = readJson(paths.sourceIntegrity)
  const governance = readJson(paths.sourceGovernance)
  const appraisal = readJson(paths.sourceAppraisal)
  const evaluation = readJson(paths.evaluationReadiness)
  const marketing = readJson(paths.marketingEvidence)
  const phase32To44Evidence = readJson(paths.phase32To44Evidence)
  const phase45To60Evidence = readJson(paths.phase45To60Evidence)
  const runtimeModeSource = readFileSync(paths.runtimeModeSource, "utf8")
  const v3Package = readJson(paths.v3Package)
  const candidate = readJson(paths.candidateCorpus)
  const workpackIndex = readJson(paths.workpackIndex)
  const methodAppraisalBatchIndex = readJson(paths.methodAppraisalBatchIndex)
  const methodAppraisalRegistrationIndex = readJson(paths.methodAppraisalRegistrationIndex)
  const candidatePassageIndexPath = join(paths.candidatePassageRegistrationRoot, "index.json")
  const candidatePassageRegistrationIndex = existsSync(candidatePassageIndexPath)
    ? readJson(candidatePassageIndexPath)
    : {
        schemaVersion: "dna-candidate-passage-registration-index@1",
        authority: "candidate_audit",
        records: [],
        counts: {
          candidatePassageSources: 0,
          candidatePassages: 0,
          runtimeEligible: 0,
          releaseEligible: 0,
        },
        canonicalPayloadSha256: null,
      }
  const candidateClaimIndexPath = join(paths.candidateClaimExtractionRoot, "index.json")
  const candidateClaimExtractionIndex = existsSync(candidateClaimIndexPath)
    ? readJson(candidateClaimIndexPath)
    : {
        schemaVersion: "dna-candidate-claim-extraction-index@1",
        authority: "candidate_audit",
        records: [],
        counts: {
          sources: 0,
          passAComplete: 0,
          passBComplete: 0,
          awaitingReconciliation: 0,
          candidateRuns: 0,
          candidateClaims: 0,
          runtimeEligible: 0,
          releaseEligible: 0,
        },
        canonicalPayloadSha256: null,
      }
  const candidateClaimReconciliationIndexPath = join(
    paths.candidateClaimReconciliationRoot,
    "index.json",
  )
  const candidateClaimReconciliationIndex = existsSync(candidateClaimReconciliationIndexPath)
    ? readJson(candidateClaimReconciliationIndexPath)
    : {
        schemaVersion: "dna-candidate-claim-reconciliation-index@1",
        authority: "candidate_audit",
        records: [],
        counts: {
          sources: 0,
          reconciliations: 0,
          exactConsensus: 0,
          contested: 0,
          quarantined: 0,
          unmatchedA: 0,
          unmatchedB: 0,
          runtimeEligible: 0,
          releaseEligible: 0,
        },
        canonicalPayloadSha256: null,
      }
  const candidateClaimRereviewIndexPath = join(paths.candidateClaimRereviewRoot, "index.json")
  const candidateClaimRereviewIndex = existsSync(candidateClaimRereviewIndexPath)
    ? readJson(candidateClaimRereviewIndexPath)
    : {
        schemaVersion: "dna-candidate-claim-rereview-index@1",
        authority: "candidate_audit",
        records: [],
        counts: {
          sources: 0,
          rereviews: 0,
          consensus: 0,
          contested: 0,
          quarantined: 0,
          runtimeEligible: 0,
          releaseEligible: 0,
        },
        canonicalPayloadSha256: null,
      }
  const prebookClosureIndexPath = join(paths.prebookClosureRoot, "index.json")
  const prebookClosureIndex = readJson(prebookClosureIndexPath)
  const prebookFullText = readJson(join(paths.prebookClosureRoot, "full-text-decisions.json"))
  const prebookWorkpacks = readJson(join(paths.prebookClosureRoot, "workpack-decisions.json"))
  const prebookClaims = readJson(join(paths.prebookClosureRoot, "claim-decisions.json"))
  const prebookCandidatePackage = readJson(join(
    paths.prebookClosureRoot,
    "external-science-candidate-package.json",
  ))
  const prebookBenchmark = readJson(join(
    paths.prebookClosureRoot,
    "evaluation-draft/questions-and-approvals.json",
  ))
  const prebookVariations = readJson(join(
    paths.prebookClosureRoot,
    "evaluation-draft/variations-and-approvals.json",
  ))
  const prebookHumanEvaluation = readJson(join(
    paths.prebookClosureRoot,
    "human-evaluation/study-pack.json",
  ))

  assert(ownerBook.currentStatus === "deferred_owner_book" && ownerBook.currentOwnerApprovals === 0,
    "prebook_readiness_owner_book_state_unexpected")
  assert(runtimeModeSource.includes('modeSource === "safe_default"')
    && runtimeModeSource.includes('? "v2"'),
  "prebook_readiness_v2_safe_default_not_verified")
  assert(marketing.releaseStatus === "no_go" && marketing.v3ReleaseReady === false,
    "prebook_readiness_v3_marketing_no_go_not_verified")
  assert(phase32To44Evidence.phaseDisposition.currentRuntimeGeneration === "v2_legacy",
    "prebook_readiness_last_verified_live_generation_not_v2")
  assert(phase45To60Evidence.releaseEngineering.currentV3Activation === "no_go",
    "prebook_readiness_release_engineering_v3_not_no_go")
  assert(v3Package.runtimeEligible === false,
    "prebook_readiness_v3_package_unexpectedly_runtime_eligible")
  assert(candidate.methodReviewWorkpackCount === workpackIndex.records.length,
    "prebook_readiness_workpack_count_drift")
  assert(candidate.methodReviewWorkpackIndexSha256 === workpackIndex.indexSha256,
    "prebook_readiness_workpack_index_hash_drift")
  assert(methodAppraisalBatchIndex.inputBindings?.workpackIndexFileSha256
    === rawFileSha256(paths.workpackIndex),
  "prebook_readiness_method_appraisal_batch_workpack_file_hash_drift")
  assert(methodAppraisalBatchIndex.inputBindings?.workpackIndexDeclaredSha256
    === workpackIndex.indexSha256,
  "prebook_readiness_method_appraisal_batch_workpack_payload_hash_drift")
  assert(methodAppraisalBatchIndex.counts?.totalWorkpacks === workpackIndex.records.length,
    "prebook_readiness_method_appraisal_batch_count_drift")
  assert(methodAppraisalBatchIndex.counts?.runtimeEligible === 0
    && methodAppraisalBatchIndex.counts?.releaseEligible === 0,
  "prebook_readiness_method_appraisal_batch_must_not_authorize_runtime")
  const {
    canonicalPayloadSha256: registrationIndexDeclaredSha256,
    ...registrationIndexPayload
  } = methodAppraisalRegistrationIndex
  assert(methodAppraisalRegistrationIndex.schemaVersion
    === "dna-method-appraisal-registration-index@1"
    && methodAppraisalRegistrationIndex.registryKind === "production_compiled"
    && canonicalSha256(registrationIndexPayload) === registrationIndexDeclaredSha256,
  "prebook_readiness_method_registration_index_invalid")
  assert(methodAppraisalRegistrationIndex.counts?.registeredForMethodPipeline
    === methodAppraisalRegistrationIndex.records?.length,
  "prebook_readiness_method_registration_count_drift")
  assert(methodAppraisalRegistrationIndex.counts?.runtimeEligible === 0
    && methodAppraisalRegistrationIndex.counts?.releaseEligible === 0
    && methodAppraisalRegistrationIndex.records.every((record) =>
      record.runtimeEligible === false && record.releaseEligible === false),
  "prebook_readiness_method_registration_must_not_authorize_runtime")
  const batchSourceIds = new Set(methodAppraisalBatchIndex.records.map((record) => record.sourceId))
  assert(methodAppraisalRegistrationIndex.records.every((record) => batchSourceIds.has(record.sourceId)),
    "prebook_readiness_method_registration_source_not_in_batch")
  if (existsSync(candidatePassageIndexPath)) {
    const {
      canonicalPayloadSha256: candidatePassageIndexDeclaredSha256,
      ...candidatePassageIndexPayload
    } = candidatePassageRegistrationIndex
    assert(candidatePassageRegistrationIndex.schemaVersion
      === "dna-candidate-passage-registration-index@1"
      && candidatePassageRegistrationIndex.authority === "candidate_audit"
      && canonicalSha256(candidatePassageIndexPayload) === candidatePassageIndexDeclaredSha256,
    "prebook_readiness_candidate_passage_index_invalid")
  }
  assert(candidatePassageRegistrationIndex.counts?.candidatePassageSources
    === candidatePassageRegistrationIndex.records?.length
    && candidatePassageRegistrationIndex.counts?.runtimeEligible === 0
    && candidatePassageRegistrationIndex.counts?.releaseEligible === 0
    && candidatePassageRegistrationIndex.records.every((record) =>
      record.runtimeEligible === false && record.releaseEligible === false),
  "prebook_readiness_candidate_passage_registration_must_not_authorize_runtime")
  const registeredMethodSourceIds = new Set(
    methodAppraisalRegistrationIndex.records.map((record) => record.sourceId),
  )
  assert(candidatePassageRegistrationIndex.records.every((record) =>
    registeredMethodSourceIds.has(record.sourceId)),
  "prebook_readiness_candidate_passage_source_without_registered_method")
  if (existsSync(candidateClaimIndexPath)) {
    const {
      canonicalPayloadSha256: candidateClaimIndexDeclaredSha256,
      ...candidateClaimIndexPayload
    } = candidateClaimExtractionIndex
    assert(candidateClaimExtractionIndex.schemaVersion
      === "dna-candidate-claim-extraction-index@1"
      && candidateClaimExtractionIndex.authority === "candidate_audit"
      && canonicalSha256(candidateClaimIndexPayload) === candidateClaimIndexDeclaredSha256,
    "prebook_readiness_candidate_claim_index_invalid")
  }
  assert(candidateClaimExtractionIndex.counts?.sources
    === candidateClaimExtractionIndex.records?.length
    && candidateClaimExtractionIndex.counts?.runtimeEligible === 0
    && candidateClaimExtractionIndex.counts?.releaseEligible === 0
    && candidateClaimExtractionIndex.records.every((record) =>
      record.runtimeEligible === false && record.releaseEligible === false),
  "prebook_readiness_candidate_claim_extraction_must_not_authorize_runtime")
  const registeredPassageSourceIds = new Set(
    candidatePassageRegistrationIndex.records.map((record) => record.sourceId),
  )
  assert(candidateClaimExtractionIndex.records.every((record) =>
    registeredPassageSourceIds.has(record.sourceId)),
  "prebook_readiness_candidate_claim_source_without_registered_passage")
  if (existsSync(candidateClaimReconciliationIndexPath)) {
    const {
      canonicalPayloadSha256: reconciliationIndexDeclaredSha256,
      ...reconciliationIndexPayload
    } = candidateClaimReconciliationIndex
    assert(candidateClaimReconciliationIndex.schemaVersion
      === "dna-candidate-claim-reconciliation-index@1"
      && candidateClaimReconciliationIndex.authority === "candidate_audit"
      && canonicalSha256(reconciliationIndexPayload) === reconciliationIndexDeclaredSha256,
    "prebook_readiness_candidate_claim_reconciliation_index_invalid")
  }
  assert(candidateClaimReconciliationIndex.counts?.sources
    === candidateClaimReconciliationIndex.records?.length
    && candidateClaimReconciliationIndex.counts?.runtimeEligible === 0
    && candidateClaimReconciliationIndex.counts?.releaseEligible === 0
    && candidateClaimReconciliationIndex.records.every((record) =>
      record.runtimeEligible === false && record.releaseEligible === false),
  "prebook_readiness_candidate_claim_reconciliation_must_not_authorize_runtime")
  const extractedClaimSourceIds = new Set(
    candidateClaimExtractionIndex.records.map((record) => record.sourceId),
  )
  assert(candidateClaimReconciliationIndex.records.every((record) =>
    extractedClaimSourceIds.has(record.sourceId)),
  "prebook_readiness_reconciled_source_without_blind_claim_pair")
  if (existsSync(candidateClaimRereviewIndexPath)) {
    const {
      canonicalPayloadSha256: rereviewIndexDeclaredSha256,
      ...rereviewIndexPayload
    } = candidateClaimRereviewIndex
    assert(candidateClaimRereviewIndex.schemaVersion
      === "dna-candidate-claim-rereview-index@1"
      && candidateClaimRereviewIndex.authority === "candidate_audit"
      && canonicalSha256(rereviewIndexPayload) === rereviewIndexDeclaredSha256,
    "prebook_readiness_candidate_claim_rereview_index_invalid")
  }
  assert(candidateClaimRereviewIndex.counts?.sources
    === candidateClaimRereviewIndex.records?.length
    && candidateClaimRereviewIndex.counts?.runtimeEligible === 0
    && candidateClaimRereviewIndex.counts?.releaseEligible === 0
    && candidateClaimRereviewIndex.records.every((record) =>
      record.runtimeEligible === false && record.releaseEligible === false),
  "prebook_readiness_candidate_claim_rereview_must_not_authorize_runtime")
  const reconciledSourceIds = new Set(
    candidateClaimReconciliationIndex.records.map((record) => record.sourceId),
  )
  assert(candidateClaimRereviewIndex.records.every((record) =>
    reconciledSourceIds.has(record.sourceId)),
  "prebook_readiness_rereviewed_source_without_reconciliation")

  const { indexSha256: prebookIndexDeclaredSha256, ...prebookIndexPayload } = prebookClosureIndex
  assert(prebookClosureIndex.schemaVersion === "dna-intelligence-prebook-closure@1"
    && canonicalSha256(prebookIndexPayload) === prebookIndexDeclaredSha256,
  "prebook_readiness_closure_index_invalid")
  for (const artifact of prebookClosureIndex.artifacts) {
    const artifactPath = assertContained(paths.prebookClosureRoot, join(
      paths.prebookClosureRoot,
      artifact.relativePath,
    ))
    assert(rawFileSha256(artifactPath) === artifact.sha256,
      `prebook_readiness_closure_artifact_hash_mismatch:${artifact.relativePath}`)
  }
  assert(prebookClosureIndex.status === "prebook_actionable_work_closed"
    && prebookClosureIndex.readiness?.prebook_actionable_blockers === 0
    && prebookClosureIndex.runtime?.activeGeneration === "v2_legacy"
    && prebookClosureIndex.runtime?.v3CandidateActivated === false,
  "prebook_readiness_closure_state_invalid")
  assert(prebookFullText.counts?.total === 1645 && prebookFullText.counts?.open === 0
    && prebookFullText.decisions.every((decision) => decision.reasonCode),
  "prebook_readiness_full_text_terminal_coverage_invalid")
  assert(prebookWorkpacks.counts?.total === 24 && prebookWorkpacks.counts?.open === 0,
    "prebook_readiness_workpack_terminal_coverage_invalid")
  assert(prebookClaims.counts?.coveredBlindClaims === 746 && prebookClaims.counts?.open === 0
    && prebookClaims.counts?.byStatus?.bounded_candidate === 220
    && prebookClaims.counts?.byStatus?.contested_excluded === 23,
  "prebook_readiness_claim_terminal_coverage_invalid")
  assert(prebookCandidatePackage.runtimeEligible === false
    && prebookCandidatePackage.releaseEligible === false
    && prebookCandidatePackage.activationAllowed === false
    && prebookCandidatePackage.counts?.claims === 220
    && prebookCandidatePackage.counts?.dnaProductClaims === 0,
  "prebook_readiness_external_candidate_boundary_invalid")
  assert(prebookBenchmark.status === "draft_unsealed"
    && prebookBenchmark.counts?.total === 2400
    && prebookBenchmark.counts?.approvals === 2400
    && prebookVariations.status === "draft_unsealed"
    && prebookVariations.counts?.total === 10000
    && prebookVariations.counts?.approvals === 10000,
  "prebook_readiness_evaluation_draft_invalid")
  assert(prebookHumanEvaluation.executionAllowedNow === false
    && prebookHumanEvaluation.status === "protocol_locked_execution_deferred",
  "prebook_readiness_human_evaluation_boundary_invalid")

  const head = runGit(repoRoot, ["rev-parse", "HEAD"], "unknown")
  const branch = runGit(repoRoot, ["branch", "--show-current"], "unknown")
  const status = runGit(repoRoot, ["status", "--porcelain"], "unknown")

  return {
    repoRoot,
    researchRoot,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    repository: {
      branch,
      headGitSha: head,
      workingTreeClean: status === "",
    },
    ownerBook: {
      status: ownerBook.currentStatus,
      approvalCount: ownerBook.currentOwnerApprovals,
      productClaimBindings: 0,
      releaseBlocking: true,
      contractRawBytesSha256: rawFileSha256(paths.ownerBook),
    },
    sourceIntegrity: {
      sourceCount: integrity.integrity.sourceCount,
      ...integrity.integrity.stateCounts,
      integrityGateEligible: integrity.integrity.integrityGateEligibleCount,
      integrityGateBlocked: integrity.integrity.integrityGateBlockedCount,
      authorityUnavailable: integrity.integrity.authorityUnavailableCount,
      updateSignals: integrity.integrity.updateSignalCount,
      immutableAuditRuns: integrity.history.immutableRunCount,
      runtimeReleased: integrity.integrity.runtimeReleasedCount,
      auditedAt: integrity.auditedAt,
      snapshotRawBytesSha256: rawFileSha256(paths.sourceIntegrity),
    },
    sourceGovernance: {
      sourceCount: governance.counts.totalMetadataRecords,
      identityVerified: governance.identityState.fullyCrossIdentifierVerifiedRecords,
      identityEligible: governance.identityState.identityEligibleRecords,
      identityPending: governance.identityState.pendingIdentityRecords,
      identityMismatch: governance.identityState.mismatchIdentityRecords,
      componentMatrices: governance.licenseState.componentMatricesCompleted,
      componentsAudited: governance.licenseState.componentsAudited,
      passageLicenseCleared: governance.licenseState.licenseEligiblePassageRecords,
      runtimeReleasedPassages: governance.licenseState.runtimeReleasedPassageRecords,
      snapshotBasisAt: governance.snapshotBasisAt,
      snapshotRawBytesSha256: rawFileSha256(paths.sourceGovernance),
    },
    candidateCorpus: {
      artifactCount: candidate.artifactCount,
      paragraphCount: candidate.paragraphCount,
      exclusionCount: candidate.exclusionCount,
      integrityClearedArtifacts: candidate.integrityClearedCount,
      passageLicenseClearedArtifacts: candidate.passageLicenseClearedCount,
      crossGateEligibleArtifacts: candidate.crossGateEligibleCount,
      methodReviewWorkpacks: candidate.methodReviewWorkpackCount,
      releaseEligible: candidate.releaseEligibleCount,
      manifestSha256: candidate.manifestSha256,
      manifestRawBytesSha256: rawFileSha256(paths.candidateCorpus),
      workpackIndexSha256: workpackIndex.indexSha256,
      workpackIndexRawBytesSha256: rawFileSha256(paths.workpackIndex),
    },
    methodAppraisal: {
      sourceCount: appraisal.counts.sourceRecords,
      pending: appraisal.counts.pendingMethodAppraisals,
      registered: methodAppraisalRegistrationIndex.counts.registeredForMethodPipeline,
      normalizedSnapshotRegistered:
        appraisal.counts.sourceRecords - appraisal.counts.pendingMethodAppraisals,
      candidateChainsOnDisk: countMethodAppraisalCandidateChains(paths.methodAppraisals),
      reviewWorkpacks: methodAppraisalBatchIndex.counts.totalWorkpacks,
      queuedWorkpacks: methodAppraisalBatchIndex.counts.queued,
      batchInProgress: methodAppraisalBatchIndex.counts.inProgress,
      batchCandidateCompleteUnregistered:
        methodAppraisalBatchIndex.counts.candidateCompleteUnregistered,
      batchContestedOrQuarantined: methodAppraisalBatchIndex.counts.contestedOrQuarantined,
      batchRunIndexRawBytesSha256: rawFileSha256(paths.methodAppraisalBatchIndex),
      batchRunIndexPayloadSha256: methodAppraisalBatchIndex.canonicalPayloadSha256,
      registrationIndexRawBytesSha256: rawFileSha256(paths.methodAppraisalRegistrationIndex),
      registrationIndexPayloadSha256: registrationIndexDeclaredSha256,
      compiledTrustRegistrySha256:
        methodAppraisalRegistrationIndex.compiledTrustRegistrySha256,
      registeredAppraisalCollectionSha256:
        methodAppraisalRegistrationIndex.appraisalCollectionSha256,
      runtimeEligible: methodAppraisalRegistrationIndex.counts.runtimeEligible,
      releaseEligible: methodAppraisalRegistrationIndex.counts.releaseEligible,
      snapshotRawBytesSha256: rawFileSha256(paths.sourceAppraisal),
    },
    candidatePassages: {
      preparedReviewPackets: countPreparedPassagePackets(join(
        paths.candidatePassageRegistrationRoot,
        "packets",
      )),
      registeredSources:
        candidatePassageRegistrationIndex.counts.candidatePassageSources,
      candidatePassages: candidatePassageRegistrationIndex.counts.candidatePassages,
      indexState: existsSync(candidatePassageIndexPath) ? "present" : "absent",
      indexRawBytesSha256: existsSync(candidatePassageIndexPath)
        ? rawFileSha256(candidatePassageIndexPath) : null,
      indexPayloadSha256: candidatePassageRegistrationIndex.canonicalPayloadSha256,
      runtimeEligible: candidatePassageRegistrationIndex.counts.runtimeEligible,
      releaseEligible: candidatePassageRegistrationIndex.counts.releaseEligible,
    },
    candidateClaims: {
      preparedBlindPackets: countPreparedClaimPackets(join(
        paths.candidateClaimExtractionRoot,
        "packets",
      )),
      sources: candidateClaimExtractionIndex.counts.sources,
      passAComplete: candidateClaimExtractionIndex.counts.passAComplete,
      passBComplete: candidateClaimExtractionIndex.counts.passBComplete,
      awaitingReconciliation:
        candidateClaimExtractionIndex.counts.awaitingReconciliation,
      candidateRuns: candidateClaimExtractionIndex.counts.candidateRuns,
      candidateClaims: candidateClaimExtractionIndex.counts.candidateClaims,
      indexState: existsSync(candidateClaimIndexPath) ? "present" : "absent",
      indexRawBytesSha256: existsSync(candidateClaimIndexPath)
        ? rawFileSha256(candidateClaimIndexPath) : null,
      indexPayloadSha256: candidateClaimExtractionIndex.canonicalPayloadSha256,
      runtimeEligible: candidateClaimExtractionIndex.counts.runtimeEligible,
      releaseEligible: candidateClaimExtractionIndex.counts.releaseEligible,
    },
    candidateClaimReconciliations: {
      preparedPackets: countPreparedPassagePackets(join(
        paths.candidateClaimReconciliationRoot,
        "packets",
      )),
      sources: candidateClaimReconciliationIndex.counts.sources,
      reconciliations: candidateClaimReconciliationIndex.counts.reconciliations,
      exactConsensus: candidateClaimReconciliationIndex.counts.exactConsensus,
      contested: candidateClaimReconciliationIndex.counts.contested,
      quarantined: candidateClaimReconciliationIndex.counts.quarantined,
      unmatchedA: candidateClaimReconciliationIndex.counts.unmatchedA,
      unmatchedB: candidateClaimReconciliationIndex.counts.unmatchedB,
      indexState: existsSync(candidateClaimReconciliationIndexPath) ? "present" : "absent",
      indexRawBytesSha256: existsSync(candidateClaimReconciliationIndexPath)
        ? rawFileSha256(candidateClaimReconciliationIndexPath) : null,
      indexPayloadSha256: candidateClaimReconciliationIndex.canonicalPayloadSha256,
      runtimeEligible: candidateClaimReconciliationIndex.counts.runtimeEligible,
      releaseEligible: candidateClaimReconciliationIndex.counts.releaseEligible,
    },
    candidateClaimRereviews: {
      preparedPackets: countPreparedPassagePackets(join(
        paths.candidateClaimRereviewRoot,
        "packets",
      )),
      sources: candidateClaimRereviewIndex.counts.sources,
      rereviews: candidateClaimRereviewIndex.counts.rereviews,
      consensus: candidateClaimRereviewIndex.counts.consensus,
      contested: candidateClaimRereviewIndex.counts.contested,
      quarantined: candidateClaimRereviewIndex.counts.quarantined,
      indexState: existsSync(candidateClaimRereviewIndexPath) ? "present" : "absent",
      indexRawBytesSha256: existsSync(candidateClaimRereviewIndexPath)
        ? rawFileSha256(candidateClaimRereviewIndexPath) : null,
      indexPayloadSha256: candidateClaimRereviewIndex.canonicalPayloadSha256,
      runtimeEligible: candidateClaimRereviewIndex.counts.runtimeEligible,
      releaseEligible: candidateClaimRereviewIndex.counts.releaseEligible,
    },
    prebookClosure: {
      status: prebookClosureIndex.status,
      indexSha256: prebookClosureIndex.indexSha256,
      indexRawBytesSha256: rawFileSha256(prebookClosureIndexPath),
      rootInputSha256: prebookClosureIndex.rootInputSha256,
      fullTextRecords: prebookFullText.counts.total,
      fullTextTerminal: prebookFullText.counts.terminal,
      fullTextOpen: prebookFullText.counts.open,
      fullTextStatusCounts: prebookFullText.counts.byStatus,
      workpacks: prebookWorkpacks.counts.total,
      workpacksTerminal: prebookWorkpacks.counts.terminal,
      workpacksOpen: prebookWorkpacks.counts.open,
      workpackStatusCounts: prebookWorkpacks.counts.byStatus,
      blindClaimsCovered: prebookClaims.counts.coveredBlindClaims,
      claimDecisionUnits: prebookClaims.counts.terminalDecisionUnits,
      claimsOpen: prebookClaims.counts.open,
      claimStatusCounts: prebookClaims.counts.byStatus,
      candidateTopics: prebookCandidatePackage.counts.topics,
      candidateSources: prebookCandidatePackage.counts.sources,
      candidatePassages: prebookCandidatePackage.counts.passages,
      candidateClaims: prebookCandidatePackage.counts.claims,
      candidateAnswerUnits: prebookCandidatePackage.counts.answerUnits,
      candidatePackageSha256: prebookCandidatePackage.packageSha256,
      draftBenchmarkItems: prebookBenchmark.counts.total,
      draftBenchmarkApprovals: prebookBenchmark.counts.approvals,
      draftVariations: prebookVariations.counts.total,
      draftVariationApprovals: prebookVariations.counts.approvals,
      humanProtocolStatus: prebookHumanEvaluation.status,
      prebookActionableBlockers: prebookClosureIndex.readiness.prebook_actionable_blockers,
      ownerBookDependent: prebookClosureIndex.readiness.owner_book_dependent,
      exactCandidateOrExternalHumanDependent:
        prebookClosureIndex.readiness.exact_candidate_or_external_human_dependent,
      runtimeEligible: prebookCandidatePackage.runtimeEligible,
      releaseEligible: prebookCandidatePackage.releaseEligible,
    },
    publicationPipeline: {
      acceptedRealPassages: v3Package.counts.included.passages,
      releasedClaims: v3Package.counts.included.claims,
      releasedRelations: v3Package.counts.included.relations,
      releasedSources: v3Package.counts.included.sources,
      releaseRegistryRecords: v3Package.releaseRegistryCount,
      packageRuntimeEligible: v3Package.runtimeEligible,
      packageSha256: v3Package.packageSha256,
      packageManifestRawBytesSha256: rawFileSha256(paths.v3Package),
    },
    evaluation: {
      developmentItems: evaluation.developmentRegression.itemCount,
      developmentFamilies: evaluation.developmentRegression.familyCount,
      lockedBenchmarkItems: countJsonArray(paths.lockedQuestions),
      lockedBenchmarkTarget: evaluation.lockedInternalBenchmark.targetItemCount,
      variationItems: countJsonArray(paths.variations),
      variationMinimum: evaluation.variationBank.minimumItemCount,
      independentEvaluation: evaluation.independentEvaluation.state,
      currentReadinessRawBytesSha256: rawFileSha256(paths.evaluationReadiness),
    },
    runtime: {
      safeDefaultGeneration: "v2_legacy",
      activeGenerationLastVerified: phase32To44Evidence.phaseDisposition.currentRuntimeGeneration,
      liveObservationRecordedAt: phase45To60Evidence.generatedAt,
      liveObservationBoundary: "point_in_time_historical_observation_not_continuous_monitoring",
      v3ReleaseDecision: "no_go",
      v3DeploymentPerformed: false,
      v3PromotionPerformed: false,
      marketingReleaseStatus: marketing.releaseStatus,
      marketingEvidenceRawBytesSha256: rawFileSha256(paths.marketingEvidence),
    },
    history: evidenceHistory(repoRoot),
  }
}

export function buildReadinessProjection(facts) {
  return {
    ownerBook: facts.ownerBook,
    sourceIntegrity: facts.sourceIntegrity,
    sourceGovernance: facts.sourceGovernance,
    candidateCorpus: facts.candidateCorpus,
    methodAppraisal: facts.methodAppraisal,
    candidatePassages: facts.candidatePassages,
    candidateClaims: facts.candidateClaims,
    candidateClaimReconciliations: facts.candidateClaimReconciliations,
    candidateClaimRereviews: facts.candidateClaimRereviews,
    prebookClosure: facts.prebookClosure,
    publicationPipeline: facts.publicationPipeline,
    evaluation: facts.evaluation,
    runtime: facts.runtime,
  }
}

function blockerScope(facts) {
  const sourceLocal = []
  if (facts.sourceIntegrity.pending > 0) {
    sourceLocal.push(`source_integrity_pending_${facts.sourceIntegrity.pending}`)
  }
  if (facts.sourceIntegrity.quarantined > 0) {
    sourceLocal.push(`source_integrity_quarantined_${facts.sourceIntegrity.quarantined}`)
  }
  if (facts.sourceGovernance.identityPending > 0) {
    sourceLocal.push(`source_identity_pending_${facts.sourceGovernance.identityPending}`)
  }
  if (facts.sourceGovernance.identityMismatch > 0) {
    sourceLocal.push(`source_identity_mismatch_${facts.sourceGovernance.identityMismatch}`)
  }
  if (facts.methodAppraisal.pending > 0) {
    sourceLocal.push(`source_method_appraisals_pending_${facts.methodAppraisal.pending}`)
  }
  if (facts.methodAppraisal.queuedWorkpacks > 0) {
    sourceLocal.push(`method_appraisal_workpacks_queued_${facts.methodAppraisal.queuedWorkpacks}`)
  }
  if (facts.methodAppraisal.registered < facts.methodAppraisal.sourceCount) {
    sourceLocal.push(
      `method_appraisal_candidate_chains_${facts.methodAppraisal.candidateChainsOnDisk}_registered_${facts.methodAppraisal.registered}`,
    )
  }
  if (facts.candidatePassages.registeredSources < facts.methodAppraisal.registered) {
    sourceLocal.push(
      `candidate_passage_sources_${facts.candidatePassages.registeredSources}_of_${facts.methodAppraisal.registered}_registered_methods`,
    )
  }
  if (facts.candidatePassages.candidatePassages === 0) {
    sourceLocal.push("candidate_passages_registered_0")
  }
  if (facts.candidateClaims.candidateRuns === 0) {
    sourceLocal.push("blind_candidate_claim_runs_0")
  }
  if (facts.candidateClaims.candidateClaims === 0) {
    sourceLocal.push("blind_candidate_claims_0")
  }
  if (facts.candidateClaimReconciliations.sources === 0) {
    sourceLocal.push("candidate_claim_reconciliations_0")
  }
  if ((facts.candidateClaimReconciliations.contested
    + facts.candidateClaimReconciliations.quarantined) > 0
    && facts.candidateClaimRereviews.sources === 0) {
    sourceLocal.push("candidate_claim_rereviews_0")
  }
  if (facts.publicationPipeline.acceptedRealPassages === 0) {
    sourceLocal.push("accepted_real_passages_0")
  }
  if (facts.publicationPipeline.releasedClaims === 0) {
    sourceLocal.push("released_real_claims_0")
  }
  if (facts.publicationPipeline.releasedRelations === 0) {
    sourceLocal.push("released_real_relations_0")
  }

  return {
    prebookActionable: facts.prebookClosure.prebookActionableBlockers === 0
      ? []
      : sourceLocal,
    ownerBook: [
      "owner_book_not_supplied",
      "owner_approved_product_claim_bindings_missing",
    ],
    sourceLocal: facts.prebookClosure.prebookActionableBlockers === 0 ? [] : sourceLocal,
    terminalizedPrebookCohort: [
      `full_text_${facts.prebookClosure.fullTextTerminal}_of_${facts.prebookClosure.fullTextRecords}_terminal`,
      `workpacks_${facts.prebookClosure.workpacksTerminal}_of_${facts.prebookClosure.workpacks}_terminal`,
      `blind_claims_${facts.prebookClosure.blindClaimsCovered}_covered`,
      `bounded_external_claims_${facts.prebookClosure.candidateClaims}_candidate_only`,
      `benchmark_${facts.prebookClosure.draftBenchmarkItems}_draft_unsealed`,
      `variations_${facts.prebookClosure.draftVariations}_draft_unsealed`,
    ],
    exactCandidateOrExternalHuman:
      facts.prebookClosure.exactCandidateOrExternalHumanDependent,
    evaluationAndExternalHuman: [
      `locked_benchmark_${facts.evaluation.lockedBenchmarkItems}_of_${facts.evaluation.lockedBenchmarkTarget}`,
      `variation_bank_${facts.evaluation.variationItems}_of_${facts.evaluation.variationMinimum}`,
      "phase41_44_release_observations_absent",
      "independent_human_evaluation_not_commissioned",
      "phase47_real_therapist_study_absent",
    ],
    liveDeployment: [
      "v3_release_evidence_bundle_absent",
      "preview_verification_manifest_absent",
      "production_verification_manifest_absent",
      "external_live_observation_trust_root_not_provisioned",
      "production_runtime_promotion_receipt_absent",
      "staged_rollout_authority_absent",
    ],
    globalRelease: [
      "v3_static_package_empty",
      "v3_release_attestation_absent",
      "v3_release_no_go",
    ],
  }
}

export function buildPrebookReadiness(facts) {
  const projection = buildReadinessProjection(facts)
  return {
    schemaVersion: PREBOOK_READINESS_VERSION,
    programVersion: PROGRAM_VERSION,
    generatedAt: facts.generatedAt,
    evidenceClass: "current_generated_readiness_not_phase_completion_or_release_evidence",
    repository: {
      ...facts.repository,
      identityBoundary: "HEAD and exact artifact hashes identify the measured in-progress state. A dirty worktree is not immutable release evidence.",
    },
    readinessProjectionSha256: canonicalSha256(projection),
    projection,
    corpusExecutionTruth: {
      state: "prebook_candidate_closed_not_released",
      firstIncompleteScientificReviewPhase: null,
      phase12: `${facts.prebookClosure.workpacksTerminal}_of_${facts.prebookClosure.workpacks}_prebook_workpacks_terminal_${facts.methodAppraisal.registered}_registered_preserved`,
      phase14: "candidate_jats_extraction_executed_not_released",
      phases15To27: `${facts.prebookClosure.blindClaimsCovered}_blind_claims_terminally_covered_${facts.prebookClosure.candidateClaims}_bounded_external_candidates_not_published`,
      phases29To31: `${facts.prebookClosure.candidateAnswerUnits}_single_claim_passage_answer_units_external_candidate_runtime_ineligible`,
    },
    orderedProgramTruth: {
      programComplete: false,
      ownerBookPhase3: "deferred_release_blocking",
      engineeringSequenceCursor: 38,
      scientificCorpusExecutionCursor: 27,
      releaseDecision: "no_go",
    },
    blockerScope: blockerScope(facts),
    historicalEvidence: facts.history,
    interpretationBoundary: "The frozen prebook cohort is terminally decided and the external-science candidate is compiled. This is not released knowledge, an official sealed evaluation, independent validation, or a V3 runtime deployment.",
  }
}

export function buildProgramState(facts, readiness) {
  const projection = buildReadinessProjection(facts)
  return {
    schemaVersion: PROGRAM_STATE_VERSION,
    programVersion: PROGRAM_VERSION,
    objective: "DNA Intelligence V3 planını Faz 0'dan Faz 60'a kanıt kapılı biçimde tamamlamak",
    truthModel: {
      engineeringStatus: "Sözleşme, doğrulayıcı ve fail-closed kapının varlığını gösterir; bilimsel korpusun incelendiğini veya ürünün canlıya alındığını göstermez.",
      corpusExecutionStatus: "Gerçek kaynak, pasaj, iddia ve review kayıtlarının fiilî ilerlemesini gösterir.",
      releaseStatus: "Yalnız exact release ve deployment kanıtlarıyla değişebilir.",
    },
    engineeringStatus: {
      state: "contracts_implemented_not_product_complete",
      contractInfrastructureImplementedPhases: ALL_PROGRAM_PHASES,
      legacyCompletedCheckpointLabels: CHECKPOINT_COMPLETED_PHASES,
      realOutputInfrastructureOrGovernancePhases: REAL_OUTPUT_INFRASTRUCTURE_PHASES,
      scientificCorpusExecutionIncompletePhases: [],
      scientificReleaseIncompletePhases: [20, 21, 22, 23, 24, 25, 26, 27, 29, 30, 31],
      implementedAgainstEmptyOrCandidateOnlyV3PackagePhases: [
        ...Array.from({ length: 9 }, (_, index) => index + 29),
      ],
      evaluationReleaseAndDeploymentExecutionIncompletePhases: [
        ...Array.from({ length: 23 }, (_, index) => index + 38),
      ],
      ownerBookContractImplementedButOwnerApprovalPendingPhase: 3,
      warning: "legacyCompletedCheckpointLabels yalnız checkpoint dosyalarındaki eski mühendislik etiketlerini kaydeder; bilimsel veya sıralı program tamamlanması değildir.",
    },
    corpusExecutionStatus: {
      state: "prebook_candidate_closed_not_released",
      firstIncompleteScientificReviewPhase: null,
      sourceInventory: {
        total: facts.sourceIntegrity.sourceCount,
        integrityEligible: facts.sourceIntegrity.integrityGateEligible,
        integrityCorrected: facts.sourceIntegrity.corrected,
        integrityPending: facts.sourceIntegrity.pending,
        integrityQuarantined: facts.sourceIntegrity.quarantined,
        identityPending: facts.sourceGovernance.identityPending,
        identityMismatch: facts.sourceGovernance.identityMismatch,
      },
      candidateExtraction: facts.candidateCorpus,
      methodAppraisal: facts.methodAppraisal,
      candidatePassages: facts.candidatePassages,
      candidateClaims: facts.candidateClaims,
      candidateClaimReconciliations: facts.candidateClaimReconciliations,
      candidateClaimRereviews: facts.candidateClaimRereviews,
      prebookClosure: facts.prebookClosure,
      publicationPipeline: facts.publicationPipeline,
      phaseDisposition: [
        {
          phases: REAL_OUTPUT_INFRASTRUCTURE_PHASES,
          status: "real_output_infrastructure_or_governance_verified",
        },
        {
          phases: [12],
          status: "prebook_workpack_cohort_terminal_registered_sources_preserved",
        },
        {
          phases: [14],
          status: "candidate_extraction_executed_not_scientifically_released",
        },
        {
          phases: [...Array.from({ length: 13 }, (_, index) => index + 15)],
          status: "prebook_claim_cohort_terminal_bounded_candidates_not_published",
        },
        {
          phases: [29, 30, 31],
          status: "external_science_candidate_compiled_runtime_and_release_ineligible",
        },
      ],
    },
    ownerBookStatus: {
      phase: 3,
      status: facts.ownerBook.status,
      ownerApprovalCount: facts.ownerBook.approvalCount,
      productClaimBindings: facts.ownerBook.productClaimBindings,
      releaseBlocking: true,
      boundary: "DNA kitabı yalnız DNA ürün bilgisini owner_approved yapabilir; dış bilimsel kanıtın yerine geçmez.",
    },
    orderedProgramStatus: {
      complete: false,
      engineeringSequenceCursor: 38,
      scientificCorpusExecutionCursor: 27,
      firstReleaseBlockingDeferredPhase: 3,
      phase38: `official_locked_0_of_${facts.evaluation.lockedBenchmarkTarget}_draft_${facts.prebookClosure.draftBenchmarkItems}_prepared_unsealed`,
      phases39To60: "engineering_contracts_exist_ordered_release_execution_not_complete",
    },
    releaseStatus: {
      decision: "no_go",
      activeGeneration: facts.runtime.activeGenerationLastVerified,
      activeSafeDefault: facts.runtime.safeDefaultGeneration,
      v3RuntimeEligible: facts.publicationPipeline.packageRuntimeEligible,
      v3DeploymentPerformed: facts.runtime.v3DeploymentPerformed,
      v3PromotionPerformed: facts.runtime.v3PromotionPerformed,
      rollbackTarget: "dna-chat-v2-baseline-20260719",
      boundary: "V2 güvenli varsayılan olarak kalır; V3 kitap, korpus, değerlendirme ve deployment kapıları geçmeden etkinleştirilemez.",
    },
    blockerScope: blockerScope(facts),
    currentEvidence: {
      path: CURRENT_EVIDENCE_RELATIVE_PATH,
      schemaVersion: PREBOOK_READINESS_VERSION,
      generatedAt: readiness.generatedAt,
      readinessProjectionSha256: readiness.readinessProjectionSha256,
      authority: "current_generated_readiness",
    },
    historicalEvidence: facts.history,
    updatedAt: facts.generatedAt,
    readinessProjectionSha256: canonicalSha256(projection),
  }
}

function assertProjectionIntegrity(readiness) {
  assert(readiness.schemaVersion === PREBOOK_READINESS_VERSION,
    "prebook_readiness_schema_version_invalid")
  assert(readiness.programVersion === PROGRAM_VERSION,
    "prebook_readiness_program_version_invalid")
  assert(SHA256_PATTERN.test(readiness.readinessProjectionSha256),
    "prebook_readiness_projection_hash_invalid")
  assert(canonicalSha256(readiness.projection) === readiness.readinessProjectionSha256,
    "prebook_readiness_projection_hash_mismatch")
  assert(readiness.orderedProgramTruth?.programComplete === false,
    "prebook_readiness_program_must_remain_incomplete")
  assert(readiness.orderedProgramTruth?.ownerBookPhase3 === "deferred_release_blocking",
    "prebook_readiness_owner_book_truth_drift")
  assert(readiness.orderedProgramTruth?.releaseDecision === "no_go",
    "prebook_readiness_release_decision_must_be_no_go")
  assert(Array.isArray(readiness.historicalEvidence)
    && readiness.historicalEvidence.every((entry) =>
      entry.authority === "historical_snapshot_non_authoritative_for_current_counts"),
  "prebook_readiness_historical_evidence_mislabeled")
}

export function validatePrebookReadiness(readiness, facts) {
  assertProjectionIntegrity(readiness)
  const expected = buildReadinessProjection(facts)
  assert(JSON.stringify(canonicalize(readiness.projection)) === JSON.stringify(canonicalize(expected)),
    "prebook_readiness_current_artifact_drift")
  assert(JSON.stringify(readiness.blockerScope) === JSON.stringify(blockerScope(facts)),
    "prebook_readiness_blocker_scope_drift")
  assert(JSON.stringify(readiness.historicalEvidence) === JSON.stringify(facts.history),
    "prebook_readiness_historical_evidence_drift")
  const expectedReadiness = buildPrebookReadiness(facts)
  assert(JSON.stringify(canonicalize(readiness)) === JSON.stringify(canonicalize(expectedReadiness)),
    "prebook_readiness_generated_document_drift")
  return true
}

export function validateProgramState(programState, readiness, facts) {
  assert(programState.schemaVersion === PROGRAM_STATE_VERSION,
    "prebook_program_state_schema_version_invalid")
  assert(!Object.hasOwn(programState, "completedPhases"),
    "prebook_program_state_legacy_completed_phases_forbidden")
  assert(programState.engineeringStatus?.state === "contracts_implemented_not_product_complete",
    "prebook_program_state_engineering_truth_invalid")
  assert(programState.corpusExecutionStatus?.state === "prebook_candidate_closed_not_released",
    "prebook_program_state_corpus_execution_truth_invalid")
  assert(programState.corpusExecutionStatus?.firstIncompleteScientificReviewPhase === null
    && programState.corpusExecutionStatus?.prebookClosure?.prebookActionableBlockers === 0,
    "prebook_program_state_scientific_cursor_invalid")
  assert(programState.ownerBookStatus?.phase === 3
    && programState.ownerBookStatus.status === "deferred_owner_book"
    && programState.ownerBookStatus.releaseBlocking === true,
  "prebook_program_state_owner_book_truth_invalid")
  assert(programState.releaseStatus?.decision === "no_go"
    && programState.releaseStatus.activeSafeDefault === "v2_legacy"
    && programState.releaseStatus.v3RuntimeEligible === false,
  "prebook_program_state_release_truth_invalid")
  assert(programState.currentEvidence?.path === CURRENT_EVIDENCE_RELATIVE_PATH
    && programState.currentEvidence.readinessProjectionSha256
      === readiness.readinessProjectionSha256,
  "prebook_program_state_current_evidence_binding_invalid")
  assert(programState.readinessProjectionSha256 === readiness.readinessProjectionSha256,
    "prebook_program_state_projection_binding_invalid")
  assert(JSON.stringify(programState.blockerScope) === JSON.stringify(blockerScope(facts)),
    "prebook_program_state_blocker_scope_drift")
  assert(Array.isArray(programState.historicalEvidence)
    && JSON.stringify(programState.historicalEvidence) === JSON.stringify(facts.history),
  "prebook_program_state_historical_evidence_drift")
  const expectedState = buildProgramState(facts, readiness)
  assert(JSON.stringify(canonicalize(programState)) === JSON.stringify(canonicalize(expectedState)),
    "prebook_program_state_generated_document_drift")
  return true
}

export function verifyCurrentPrebookReadiness(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? DEFAULT_REPO_ROOT)
  const evidencePath = join(repoRoot, CURRENT_EVIDENCE_RELATIVE_PATH)
  const programStatePath = join(repoRoot, PROGRAM_STATE_RELATIVE_PATH)
  const readiness = readJson(evidencePath)
  const facts = collectPrebookFacts({
    ...options,
    repoRoot,
    generatedAt: readiness.generatedAt,
  })
  const programState = readJson(programStatePath)
  validatePrebookReadiness(readiness, facts)
  validateProgramState(programState, readiness, facts)
  return { facts, readiness, programState }
}

export function writeCurrentPrebookReadiness(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? DEFAULT_REPO_ROOT)
  const facts = collectPrebookFacts({ ...options, repoRoot })
  const readiness = buildPrebookReadiness(facts)
  const programState = buildProgramState(facts, readiness)
  const evidencePath = join(repoRoot, CURRENT_EVIDENCE_RELATIVE_PATH)
  const programStatePath = join(repoRoot, PROGRAM_STATE_RELATIVE_PATH)
  writeFileSync(evidencePath, `${JSON.stringify(readiness, null, 2)}\n`, "utf8")
  writeFileSync(programStatePath, `${JSON.stringify(programState, null, 2)}\n`, "utf8")
  validatePrebookReadiness(readiness, facts)
  validateProgramState(programState, readiness, facts)
  return { facts, readiness, programState, evidencePath, programStatePath }
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === MODULE_PATH
}

if (isDirectExecution()) {
  const write = process.argv.includes("--write")
  const result = write
    ? writeCurrentPrebookReadiness()
    : verifyCurrentPrebookReadiness()
  console.log(JSON.stringify({
    ok: true,
    mode: write ? "write_and_verify" : "verify",
    evidence: CURRENT_EVIDENCE_RELATIVE_PATH,
    programState: PROGRAM_STATE_RELATIVE_PATH,
    sourceIntegrity: {
      clean: result.facts.sourceIntegrity.verified_clean,
      pending: result.facts.sourceIntegrity.pending,
    },
    candidateWorkpacks: result.facts.candidateCorpus.methodReviewWorkpacks,
    registeredMethodAppraisals: result.facts.methodAppraisal.registered,
    candidatePassages: result.facts.candidatePassages.candidatePassages,
    candidateClaims: result.facts.candidateClaims.candidateClaims,
    prebookActionableBlockers: result.facts.prebookClosure.prebookActionableBlockers,
    prebookFullTextTerminal:
      `${result.facts.prebookClosure.fullTextTerminal}/${result.facts.prebookClosure.fullTextRecords}`,
    prebookWorkpacksTerminal:
      `${result.facts.prebookClosure.workpacksTerminal}/${result.facts.prebookClosure.workpacks}`,
    externalScienceCandidateClaims: result.facts.prebookClosure.candidateClaims,
    draftBenchmark: result.facts.prebookClosure.draftBenchmarkItems,
    draftVariations: result.facts.prebookClosure.draftVariations,
    releasedClaims: result.facts.publicationPipeline.releasedClaims,
    lockedBenchmark: `${result.facts.evaluation.lockedBenchmarkItems}/${result.facts.evaluation.lockedBenchmarkTarget}`,
    variationBank: `${result.facts.evaluation.variationItems}/${result.facts.evaluation.variationMinimum}`,
    runtime: result.facts.runtime.safeDefaultGeneration,
    v3: result.facts.runtime.v3ReleaseDecision,
  }, null, 2))
}
