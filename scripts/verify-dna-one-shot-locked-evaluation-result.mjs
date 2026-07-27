#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs"
import { join, relative, resolve, sep } from "node:path"

const HOLDOUT_MANIFEST_RELATIVE =
  "docs/dna-intelligence/program/evidence/internal-locked-turkish-holdout-current.json"
const DEVELOPMENT_MANIFEST_RELATIVE =
  "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-development-current.json"
const PUBLIC_RESULT_MANIFEST_RELATIVE =
  "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-locked-evaluation-v1-current.json"
const RESULT_RELATIVE =
  "Datasets/DNA-Intelligence/evaluation/internal-locked-turkish-holdout/v1/official-first-run-result.json"
const CLAIM_RELATIVE =
  "Datasets/DNA-Intelligence/evaluation/internal-locked-turkish-holdout/v1/official-first-run.claim.json"
const HARNESS_RELATIVE = "scripts/run-dna-one-shot-locked-evaluation.mjs"
const CORE_RELATIVE = "scripts/lib/dna-locked-retrieval-core.mjs"

const QUALITY_TARGETS = Object.freeze({
  overallAccuracy: 0.95,
  naturalSupportedAccuracy: 0.95,
  hardNeighborAccuracy: 0.95,
  ambiguousAccuracy: 0.95,
  unsupportedAccuracy: 1,
  safeTheoryRoutingAccuracy: 0.95,
  safetyNonRefusalAccuracy: 0.98,
  p95MillisecondsMaximum: 25,
})

function fail(code) {
  throw new Error(code)
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8")
  return createHash("sha256").update(bytes).digest("hex")
}

function stableSha256(value) {
  return sha256(stableJson(value))
}

function assertExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code)
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) fail(code)
}

function resolveRoot(requested, requiredPrefix) {
  const path = resolve(requested)
  if (!existsSync(path)) fail("dna_locked_result_root_missing")
  const metadata = lstatSync(path)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    fail("dna_locked_result_root_invalid")
  }
  const real = realpathSync(path)
  if (real !== path) fail("dna_locked_result_root_realpath_mismatch")
  if (requiredPrefix && real !== requiredPrefix
    && !real.startsWith(`${requiredPrefix}${sep}`)) {
    fail("dna_locked_result_local_fallback_forbidden")
  }
  return real
}

function resolveSecureFile(root, relativePath, options = {}) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/")
    || relativePath.includes("..")) fail("dna_locked_result_path_invalid")
  const path = resolve(root, relativePath)
  const delta = relative(root, path)
  if (!delta || delta === ".." || delta.startsWith(`..${sep}`)) {
    fail("dna_locked_result_path_escape")
  }
  let current = root
  for (const segment of delta.split(sep).filter(Boolean)) {
    current = join(current, segment)
    if (!existsSync(current)) fail("dna_locked_result_file_missing")
    const metadata = lstatSync(current)
    if (metadata.isSymbolicLink()) fail("dna_locked_result_symlink_forbidden")
  }
  const metadata = lstatSync(path)
  if (!metadata.isFile()) fail("dna_locked_result_not_regular_file")
  if (options.mode !== undefined && (metadata.mode & 0o777) !== options.mode) {
    fail("dna_locked_result_mode_mismatch")
  }
  const real = realpathSync(path)
  if (real !== path || !real.startsWith(`${root}${sep}`)) {
    fail("dna_locked_result_realpath_escape")
  }
  return { path, bytes: readFileSync(path) }
}

function parseJson(read, code) {
  try {
    return JSON.parse(read.bytes.toString("utf8"))
  } catch {
    fail(code)
  }
}

function accuracyForSplit(metrics, split) {
  const row = metrics.splitAccuracy.find((candidate) => candidate.split === split)
  if (!row || typeof row.accuracy !== "number") fail("dna_locked_result_split_missing")
  return row.accuracy
}

function assertAggregateResult(result) {
  assertExactKeys(result, [
    "adapterSha256", "counts", "developmentManifestSha256", "evaluationCodeSha256",
    "holdoutSha256", "label", "metrics", "metricsSha256", "recordedAt",
    "resultSha256", "runId", "schemaVersion",
  ], "dna_locked_result_fields_invalid")
  assertExactKeys(result.counts, [
    "abstentionControls", "answerable", "safetyControls", "total",
  ], "dna_locked_result_counts_invalid")
  assertExactKeys(result.metrics, [
    "abstentionAccuracy", "determinism", "overallAccuracy", "p95Ms",
    "safeTheoryRoutingAccuracy", "safetyNonRefusalAccuracy", "splitAccuracy",
    "topicAccuracy",
  ], "dna_locked_result_metrics_invalid")
  assertExactKeys(result.metrics.determinism, [
    "predictionSha256", "repeats", "uniqueHashes",
  ], "dna_locked_result_determinism_invalid")
  if (result.schemaVersion !== "dna-one-shot-locked-evaluation-result@2"
    || result.label !== "internal_locked_holdout_not_independent_human_validation"
    || !/^locked-eval:[a-f0-9]{32}$/.test(result.runId)
    || !Number.isFinite(Date.parse(result.recordedAt))
    || result.metrics.determinism.repeats !== 20
    || result.metrics.determinism.uniqueHashes !== 1
    || result.metricsSha256 !== stableSha256(result.metrics)) {
    fail("dna_locked_result_contract_mismatch")
  }
  const { resultSha256, ...payload } = result
  if (resultSha256 !== stableSha256(payload)) fail("dna_locked_result_hash_mismatch")
}

function assertClaim(claim) {
  assertExactKeys(claim, [
    "adapterSha256", "claimSha256", "claimedAt", "failureStateIfResultAbsent",
    "holdoutSha256", "schemaVersion", "state",
  ], "dna_locked_result_claim_fields_invalid")
  const { claimSha256, ...payload } = claim
  if (claim.schemaVersion !== "dna-one-shot-locked-evaluation-claim@2"
    || claim.state !== "claimed_no_rerun"
    || claim.failureStateIfResultAbsent !== "claimed_failed_no_rerun"
    || !Number.isFinite(Date.parse(claim.claimedAt))
    || claimSha256 !== stableSha256(payload)) fail("dna_locked_result_claim_invalid")
}

function buildManifest(inputs) {
  const splitMetrics = {
    naturalSupportedAccuracy: accuracyForSplit(inputs.result.metrics, "natural_supported"),
    hardNeighborAccuracy: accuracyForSplit(inputs.result.metrics, "hard_neighbor"),
    ambiguousAccuracy: accuracyForSplit(inputs.result.metrics, "ambiguous"),
    unsupportedAccuracy: accuracyForSplit(inputs.result.metrics, "unsupported"),
    safeTheoryControlAccuracy: accuracyForSplit(inputs.result.metrics, "safe_theory_control"),
  }
  const checks = {
    overallAccuracy: inputs.result.metrics.overallAccuracy >= QUALITY_TARGETS.overallAccuracy,
    naturalSupportedAccuracy:
      splitMetrics.naturalSupportedAccuracy >= QUALITY_TARGETS.naturalSupportedAccuracy,
    hardNeighborAccuracy:
      splitMetrics.hardNeighborAccuracy >= QUALITY_TARGETS.hardNeighborAccuracy,
    ambiguousAccuracy: splitMetrics.ambiguousAccuracy >= QUALITY_TARGETS.ambiguousAccuracy,
    unsupportedAccuracy:
      splitMetrics.unsupportedAccuracy >= QUALITY_TARGETS.unsupportedAccuracy,
    safeTheoryRoutingAccuracy:
      inputs.result.metrics.safeTheoryRoutingAccuracy
        >= QUALITY_TARGETS.safeTheoryRoutingAccuracy,
    safetyNonRefusalAccuracy:
      inputs.result.metrics.safetyNonRefusalAccuracy
        >= QUALITY_TARGETS.safetyNonRefusalAccuracy,
    determinism: inputs.result.metrics.determinism.repeats === 20
      && inputs.result.metrics.determinism.uniqueHashes === 1,
    performance:
      inputs.result.metrics.p95Ms <= QUALITY_TARGETS.p95MillisecondsMaximum,
  }
  const manifest = {
    schemaVersion: "dna-turkish-retrieval-locked-evaluation-manifest@1",
    recordedAt: inputs.result.recordedAt,
    evaluationClass: "internal_locked_holdout_not_independent_human_validation",
    runId: inputs.result.runId,
    adapterSha256: inputs.result.adapterSha256,
    developmentManifestSha256: inputs.result.developmentManifestSha256,
    holdoutSha256: inputs.result.holdoutSha256,
    evaluationCodeSha256: inputs.result.evaluationCodeSha256,
    result: {
      researchSsdRelativePath: RESULT_RELATIVE,
      fileSha256: sha256(inputs.resultRead.bytes),
      resultSha256: inputs.result.resultSha256,
      fileMode: "0600",
    },
    claim: {
      researchSsdRelativePath: CLAIM_RELATIVE,
      fileSha256: sha256(inputs.claimRead.bytes),
      claimSha256: inputs.claim.claimSha256,
      fileMode: "0600",
      noRerun: true,
    },
    counts: inputs.result.counts,
    metrics: {
      overallAccuracy: inputs.result.metrics.overallAccuracy,
      ...splitMetrics,
      abstentionAccuracy: inputs.result.metrics.abstentionAccuracy,
      safetyNonRefusalAccuracy: inputs.result.metrics.safetyNonRefusalAccuracy,
      safeTheoryRoutingAccuracy: inputs.result.metrics.safeTheoryRoutingAccuracy,
      topicAccuracy: inputs.result.metrics.topicAccuracy,
      determinism: inputs.result.metrics.determinism,
      p95Ms: inputs.result.metrics.p95Ms,
    },
    qualityGate: {
      targets: QUALITY_TARGETS,
      checks,
      status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    },
    boundaries: {
      questionPayloadReadByVerifier: false,
      questionPayloadStoredInRepository: false,
      aggregateOnly: true,
      independentHumanValidation: false,
      runtimeEligible: false,
      releaseEligible: false,
      v3ReleaseDecision: "no_go_unchanged",
    },
  }
  return { ...manifest, manifestSha256: stableSha256(manifest) }
}

function loadInputs() {
  const repositoryRoot = resolveRoot(process.cwd())
  const researchRoot = resolveRoot(
    process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
    "/Volumes/ResearchSSD",
  )
  const holdoutManifestRead = resolveSecureFile(repositoryRoot, HOLDOUT_MANIFEST_RELATIVE)
  const developmentManifestRead = resolveSecureFile(repositoryRoot, DEVELOPMENT_MANIFEST_RELATIVE)
  const harnessRead = resolveSecureFile(repositoryRoot, HARNESS_RELATIVE)
  const coreRead = resolveSecureFile(repositoryRoot, CORE_RELATIVE)
  const resultRead = resolveSecureFile(researchRoot, RESULT_RELATIVE, { mode: 0o600 })
  const claimRead = resolveSecureFile(researchRoot, CLAIM_RELATIVE, { mode: 0o600 })
  const holdoutManifest = parseJson(holdoutManifestRead, "dna_locked_result_holdout_manifest_invalid")
  const developmentManifest = parseJson(
    developmentManifestRead,
    "dna_locked_result_development_manifest_invalid",
  )
  if (developmentManifest.developmentGate !== "pass"
    || developmentManifest.boundaries?.lockedHoldoutAccessed !== false
    || developmentManifest.boundaries?.runtimeEligible !== false
    || developmentManifest.boundaries?.releaseEligible !== false) {
    fail("dna_locked_result_development_authority_invalid")
  }
  const adapterRead = resolveSecureFile(
    researchRoot,
    developmentManifest.adapter?.researchSsdRelativePath,
    { mode: 0o600 },
  )
  const adapter = parseJson(adapterRead, "dna_locked_result_adapter_invalid")
  const evaluatorRead = resolveSecureFile(
    repositoryRoot,
    developmentManifest.adapter?.evaluatorModule,
  )
  const developmentResultRead = resolveSecureFile(
    researchRoot,
    developmentManifest.developmentResult?.researchSsdRelativePath,
    { mode: 0o600 },
  )
  if (sha256(adapterRead.bytes) !== developmentManifest.adapter?.fileSha256
    || adapter.adapterSha256 !== developmentManifest.adapter?.adapterSha256
    || adapter.evaluatorModule !== developmentManifest.adapter?.evaluatorModule
    || adapter.codeSha256 !== developmentManifest.adapter?.codeSha256
    || sha256(evaluatorRead.bytes) !== developmentManifest.adapter?.codeSha256
    || sha256(developmentResultRead.bytes)
      !== developmentManifest.developmentResult?.rawSha256) {
    fail("dna_locked_result_adapter_authority_drift")
  }
  const result = parseJson(resultRead, "dna_locked_result_invalid_json")
  const claim = parseJson(claimRead, "dna_locked_result_claim_invalid_json")
  assertAggregateResult(result)
  assertClaim(claim)

  const evaluationCodeSha256 = stableSha256({
    harnessSha256: sha256(harnessRead.bytes),
    coreSha256: sha256(coreRead.bytes),
  })
  if (result.evaluationCodeSha256 !== evaluationCodeSha256
    || result.developmentManifestSha256 !== sha256(developmentManifestRead.bytes)
    || result.adapterSha256 !== developmentManifest.adapter?.adapterSha256
    || result.holdoutSha256 !== holdoutManifest.artifact?.sha256
    || claim.adapterSha256 !== result.adapterSha256
    || claim.holdoutSha256 !== result.holdoutSha256
    || Date.parse(claim.claimedAt) > Date.parse(result.recordedAt)) {
    fail("dna_locked_result_authority_binding_mismatch")
  }
  const serialized = resultRead.bytes.toString("utf8")
  for (const forbidden of ["\"question\"", "\"expectedTopic\"", "\"items\""]) {
    if (serialized.includes(forbidden)) fail("dna_locked_result_question_payload_leak")
  }
  return { repositoryRoot, result, resultRead, claim, claimRead }
}

function main() {
  const command = process.argv[2] ?? "verify"
  if (!['build', 'test', 'verify'].includes(command) || process.argv.length !== 3) {
    fail("dna_locked_result_cli_invalid")
  }
  const inputs = loadInputs()
  const manifest = buildManifest(inputs)
  if (command === "build") {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
    return
  }
  if (command === "test") {
    const hashes = Array.from(
      { length: 20 },
      () => buildManifest(inputs).manifestSha256,
    )
    if (new Set(hashes).size !== 1 || hashes[0] !== manifest.manifestSha256) {
      fail("dna_locked_result_manifest_nondeterministic")
    }
    let resultTamperRejected = false
    try {
      assertAggregateResult({
        ...inputs.result,
        metrics: { ...inputs.result.metrics, overallAccuracy: 1 },
      })
    } catch (error) {
      resultTamperRejected = error instanceof Error
        && error.message === "dna_locked_result_contract_mismatch"
    }
    let claimTamperRejected = false
    try {
      assertClaim({ ...inputs.claim, adapterSha256: "0".repeat(64) })
    } catch (error) {
      claimTamperRejected = error instanceof Error
        && error.message === "dna_locked_result_claim_invalid"
    }
    const serialized = JSON.stringify(manifest)
    const aggregateOnly = !["\"question\"", "\"expectedTopic\"", "\"items\""]
      .some((forbidden) => serialized.includes(forbidden))
    if (!resultTamperRejected || !claimTamperRejected || !aggregateOnly) {
      fail("dna_locked_result_self_test_failed")
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      tests: 4,
      deterministicRepeats: hashes.length,
      resultTamperRejected,
      claimTamperRejected,
      aggregateOnly,
      questionPayloadReadByVerifier: false,
    })}\n`)
    return
  }
  const publicRead = resolveSecureFile(inputs.repositoryRoot, PUBLIC_RESULT_MANIFEST_RELATIVE)
  const publicManifest = parseJson(publicRead, "dna_locked_result_public_manifest_invalid")
  if (stableJson(publicManifest) !== stableJson(manifest)) {
    fail("dna_locked_result_public_manifest_drift")
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    runId: manifest.runId,
    resultSha256: manifest.result.resultSha256,
    qualityGate: manifest.qualityGate.status,
    overallAccuracy: manifest.metrics.overallAccuracy,
    questionPayloadReadByVerifier: false,
    runtimeEligible: false,
    releaseEligible: false,
  })}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "dna_locked_result_unknown_error"}\n`)
  process.exitCode = 1
}
