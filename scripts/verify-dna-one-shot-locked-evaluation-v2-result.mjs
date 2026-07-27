#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

import {
  EXPECTED_COUNTS,
  QUALITY_TARGETS,
  TOPIC_IDS,
  assertAggregateResult,
  assertClaim,
  assertExactKeys,
  fail,
  qualityGate,
  sha256,
  stableJson,
  stableSha256,
  withoutKey,
} from "./lib/dna-locked-retrieval-v2-core.mjs"
import {
  PATHS,
  loadOfficialAuthority,
} from "./run-dna-one-shot-locked-evaluation-v2.mjs"
import {
  secureAtomicWriteFile,
  verifySecureFile,
} from "./lib/dna-secure-artifact-v2.mjs"

const PUBLIC_MANIFEST_PATH =
  "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-locked-evaluation-v2-current.json"

function resolveRoot(requested, requireResearchSsd = false) {
  const root = resolve(requested)
  if (!existsSync(root)) fail("dna_locked_v2_result_root_missing")
  const metadata = lstatSync(root)
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    fail("dna_locked_v2_result_root_invalid")
  }
  const real = realpathSync(root)
  if (real !== root) fail("dna_locked_v2_result_root_realpath_mismatch")
  if (requireResearchSsd && real !== "/Volumes/ResearchSSD"
    && !real.startsWith(`/Volumes/ResearchSSD${sep}`)) {
    fail("dna_locked_v2_result_local_fallback_forbidden")
  }
  return real
}

function secureRead(root, relativePath, mode) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/")
    || relativePath.includes("..")) fail("dna_locked_v2_result_path_invalid")
  const path = resolve(root, relativePath)
  const delta = relative(root, path)
  if (!delta || delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) {
    fail("dna_locked_v2_result_path_escape")
  }
  let current = root
  for (const segment of delta.split(sep).filter(Boolean)) {
    current = join(current, segment)
    if (!existsSync(current)) fail("dna_locked_v2_result_file_missing")
    const metadata = lstatSync(current)
    if (metadata.isSymbolicLink()) fail("dna_locked_v2_result_symlink_forbidden")
  }
  const metadata = lstatSync(path)
  if (!metadata.isFile()) fail("dna_locked_v2_result_not_regular_file")
  if (mode !== undefined && (metadata.mode & 0o777) !== mode) {
    fail("dna_locked_v2_result_mode_mismatch")
  }
  const real = realpathSync(path)
  if (real !== path || !real.startsWith(`${root}${sep}`)) {
    fail("dna_locked_v2_result_realpath_escape")
  }
  const bytes = readFileSync(path)
  let value
  try {
    value = JSON.parse(bytes.toString("utf8"))
  } catch {
    fail("dna_locked_v2_result_json_invalid")
  }
  return { path, bytes, fileSha256: sha256(bytes), value }
}

export function buildAggregateManifest(input) {
  const { authority, result, claim } = input
  assertAggregateResult(result)
  assertClaim(claim)
  if (result.adapterSha256 !== authority.adapter.adapterSha256
    || result.holdoutSha256 !== authority.holdoutManifest.artifact.sha256
    || result.holdoutManifestSha256 !== authority.holdoutManifestSha256
    || result.developmentManifestSha256 !== authority.developmentManifestSha256
    || result.frozenManifestSha256 !== authority.frozenManifestSha256
    || result.evaluationCodeSha256 !== authority.evaluationCodeSha256
    || result.authoritySha256 !== authority.authoritySha256
    || claim.adapterSha256 !== result.adapterSha256
    || claim.holdoutSha256 !== result.holdoutSha256
    || claim.authoritySha256 !== result.authoritySha256
    || Date.parse(claim.claimedAt) > Date.parse(result.recordedAt)) {
    fail("dna_locked_v2_result_authority_binding_mismatch")
  }
  if (result.counts.total !== EXPECTED_COUNTS.total
    || result.counts.answerable !== EXPECTED_COUNTS.answerable
    || result.counts.abstentionControls !== EXPECTED_COUNTS.clarification
      + EXPECTED_COUNTS.unsupported
    || result.counts.safetyControls !== 14) {
    fail("dna_locked_v2_result_count_mismatch")
  }
  const gate = qualityGate(result.metrics)
  const manifestBase = {
    schemaVersion: "dna-turkish-retrieval-locked-evaluation-v2-manifest@1",
    recordedAt: result.recordedAt,
    evaluationClass: "internal_locked_holdout_v2_not_independent_human_validation",
    runId: result.runId,
    authority: {
      ...authority.authority,
      authoritySha256: authority.authoritySha256,
    },
    result: {
      researchSsdRelativePath: `${dirname(PATHS.holdoutArtifact)}/${PATHS.resultFilename}`,
      fileSha256: input.resultFileSha256,
      resultSha256: result.resultSha256,
      fileMode: "0600",
    },
    claim: {
      researchSsdRelativePath: `${dirname(PATHS.holdoutArtifact)}/${PATHS.claimFilename}`,
      fileSha256: input.claimFileSha256,
      claimSha256: claim.claimSha256,
      fileMode: "0600",
      noRerun: true,
      failureStateIfResultAbsent: "claimed_failed_no_rerun",
    },
    counts: result.counts,
    metrics: result.metrics,
    qualityGate: gate,
    boundaries: {
      questionPayloadReadByVerifier: false,
      questionPayloadStoredInRepository: false,
      failureQuestionOrItemIdsStored: false,
      aggregateOnly: true,
      independentHumanValidation: false,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      v3ReleaseDecision: "no_go_unchanged",
    },
  }
  for (const hash of [input.resultFileSha256, input.claimFileSha256]) {
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) {
      fail("dna_locked_v2_result_file_hash_invalid")
    }
  }
  return { ...manifestBase, manifestSha256: stableSha256(manifestBase) }
}

function assertPublicManifest(manifest) {
  assertExactKeys(manifest, [
    "schemaVersion", "recordedAt", "evaluationClass", "runId", "authority",
    "result", "claim", "counts", "metrics", "qualityGate", "boundaries",
    "manifestSha256",
  ], "dna_locked_v2_public_manifest_fields_invalid")
  if (manifest.schemaVersion !== "dna-turkish-retrieval-locked-evaluation-v2-manifest@1"
    || stableSha256(withoutKey(manifest, "manifestSha256")) !== manifest.manifestSha256
    || stableJson(manifest.qualityGate.targets) !== stableJson(QUALITY_TARGETS)
    || manifest.boundaries?.questionPayloadReadByVerifier !== false
    || manifest.boundaries?.questionPayloadStoredInRepository !== false
    || manifest.boundaries?.failureQuestionOrItemIdsStored !== false
    || manifest.boundaries?.aggregateOnly !== true
    || manifest.boundaries?.runtimeEligible !== false
    || manifest.boundaries?.releaseEligible !== false
    || manifest.boundaries?.activationAllowed !== false) {
    fail("dna_locked_v2_public_manifest_invalid")
  }
  return manifest
}

export function loadAggregateInputs(options = {}) {
  const repositoryRoot = resolveRoot(options.repositoryRoot || process.cwd())
  const researchRoot = resolveRoot(options.researchRoot
    || process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD", true)
  const authority = loadOfficialAuthority(repositoryRoot, researchRoot)
  const result = secureRead(researchRoot,
    `${dirname(PATHS.holdoutArtifact)}/${PATHS.resultFilename}`, 0o600)
  const claim = secureRead(researchRoot,
    `${dirname(PATHS.holdoutArtifact)}/${PATHS.claimFilename}`, 0o600)
  return {
    repositoryRoot,
    researchRoot,
    authority,
    result: result.value,
    claim: claim.value,
    resultFileSha256: result.fileSha256,
    claimFileSha256: claim.fileSha256,
  }
}

function writeManifest(repositoryRoot, manifest) {
  const target = resolve(repositoryRoot, PUBLIC_MANIFEST_PATH)
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  secureAtomicWriteFile(repositoryRoot, target, serialized)
  verifySecureFile(repositoryRoot, target, serialized)
  return target
}

function build() {
  const input = loadAggregateInputs()
  const manifest = assertPublicManifest(buildAggregateManifest(input))
  const path = writeManifest(input.repositoryRoot, manifest)
  return {
    ok: true,
    written: true,
    path,
    manifestSha256: manifest.manifestSha256,
    qualityGate: manifest.qualityGate,
    boundaries: manifest.boundaries,
  }
}

function verify() {
  const input = loadAggregateInputs()
  const expected = assertPublicManifest(buildAggregateManifest(input))
  const recorded = secureRead(input.repositoryRoot, PUBLIC_MANIFEST_PATH).value
  assertPublicManifest(recorded)
  if (stableJson(recorded) !== stableJson(expected)) {
    fail("dna_locked_v2_public_manifest_drift")
  }
  return {
    ok: true,
    written: false,
    path: resolve(input.repositoryRoot, PUBLIC_MANIFEST_PATH),
    manifestSha256: expected.manifestSha256,
    qualityGate: expected.qualityGate,
    boundaries: expected.boundaries,
  }
}

function syntheticMetrics(overrides = {}) {
  const splitAccuracy = [
    ["ambiguous", 28], ["hard_neighbor", 28], ["natural_supported", 98],
    ["safe_theory_control", 14], ["unsupported", 28],
  ].map(([split, count]) => ({ split, count, correct: count, accuracy: 1 }))
  return {
    overallAccuracy: 1,
    splitAccuracy,
    topicAccuracy: TOPIC_IDS.map((topicId) => ({
      topicId, count: 10, correct: 10, accuracy: 1,
    })),
    abstentionAccuracy: 1,
    safeTheoryRoutingAccuracy: 1,
    safetyNonRefusalAccuracy: 1,
    determinism: { repeats: 20, uniqueHashes: 1, predictionSha256: "1".repeat(64) },
    p95Milliseconds: 1,
    ...overrides,
  }
}

function syntheticAuthority() {
  const authorityPayload = {
    adapterSha256: "a".repeat(64),
    adapterFileSha256: "b".repeat(64),
    candidatePackageSha256: "c".repeat(64),
    candidateFileSha256: "d".repeat(64),
    developmentBankSha256: "e".repeat(64),
    developmentBankFileSha256: "f".repeat(64),
    developmentResultFileSha256: "1".repeat(64),
    developmentResultSha256: "2".repeat(64),
    configFileSha256: "3".repeat(64),
    evaluatorCodeSha256: "4".repeat(64),
    compilerCodeSha256: "5".repeat(64),
    developmentManifestSha256: "6".repeat(64),
    frozenManifestSha256: "7".repeat(64),
    holdoutManifestSha256: "8".repeat(64),
    preopenManifestSha256: "a".repeat(64),
    preopenReceiptFileSha256: "b".repeat(64),
    preopenReceiptSha256: "c".repeat(64),
    holdoutSha256: "9".repeat(64),
    evaluationCodeSha256: "0".repeat(64),
  }
  return {
    adapter: { adapterSha256: authorityPayload.adapterSha256 },
    holdoutManifest: { artifact: { sha256: authorityPayload.holdoutSha256 } },
    holdoutManifestSha256: authorityPayload.holdoutManifestSha256,
    developmentManifestSha256: authorityPayload.developmentManifestSha256,
    frozenManifestSha256: authorityPayload.frozenManifestSha256,
    evaluationCodeSha256: authorityPayload.evaluationCodeSha256,
    authority: authorityPayload,
    authoritySha256: stableSha256(authorityPayload),
  }
}

function syntheticResult(authority, metricOverrides = {}) {
  const metrics = syntheticMetrics(metricOverrides)
  const payload = {
    schemaVersion: "dna-one-shot-locked-evaluation-v2-result@1",
    label: "internal_locked_holdout_v2_not_independent_human_validation",
    runId: `locked-eval-v2:${"a".repeat(32)}`,
    recordedAt: "2026-07-24T00:00:01.000Z",
    adapterSha256: authority.adapter.adapterSha256,
    holdoutSha256: authority.holdoutManifest.artifact.sha256,
    holdoutManifestSha256: authority.holdoutManifestSha256,
    developmentManifestSha256: authority.developmentManifestSha256,
    frozenManifestSha256: authority.frozenManifestSha256,
    evaluationCodeSha256: authority.evaluationCodeSha256,
    authoritySha256: authority.authoritySha256,
    counts: { total: 196, answerable: 140, abstentionControls: 56, safetyControls: 14 },
    metrics,
    metricsSha256: stableSha256(metrics),
    boundaries: {
      questionTextStored: false,
      failureItemIdsStored: false,
      aggregateOnly: true,
      independentHumanValidation: false,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
    },
  }
  return { ...payload, resultSha256: stableSha256(payload) }
}

function syntheticClaim(authority) {
  const payload = {
    schemaVersion: "dna-one-shot-locked-evaluation-v2-claim@1",
    state: "claimed_no_rerun",
    failureStateIfResultAbsent: "claimed_failed_no_rerun",
    claimedAt: "2026-07-24T00:00:00.000Z",
    adapterSha256: authority.adapter.adapterSha256,
    holdoutSha256: authority.holdoutManifest.artifact.sha256,
    authoritySha256: authority.authoritySha256,
  }
  return { ...payload, claimSha256: stableSha256(payload) }
}

function expectFailure(action) {
  let failed = false
  try {
    action()
  } catch {
    failed = true
  }
  if (!failed) fail("dna_locked_v2_verifier_expected_failure_missing")
}

function test() {
  const authority = syntheticAuthority()
  const result = syntheticResult(authority)
  const claim = syntheticClaim(authority)
  const input = {
    authority,
    result,
    claim,
    resultFileSha256: "a".repeat(64),
    claimFileSha256: "b".repeat(64),
  }
  const tests = []
  const check = (name, action) => {
    action()
    tests.push(name)
  }

  check("aggregate_manifest_success", () => {
    const manifest = assertPublicManifest(buildAggregateManifest(input))
    if (manifest.qualityGate.status !== "pass" || !manifest.boundaries.aggregateOnly) {
      fail("dna_locked_v2_verifier_success_failed")
    }
  })
  check("result_tamper_fail_closed", () => {
    const tampered = structuredClone(result)
    tampered.metrics.overallAccuracy = 0
    expectFailure(() => buildAggregateManifest({ ...input, result: tampered }))
  })
  check("nested_metric_extra_field_leak_fail_closed", () => {
    const tampered = structuredClone(result)
    tampered.metrics.splitAccuracy[0].question = "forbidden"
    tampered.metricsSha256 = stableSha256(tampered.metrics)
    tampered.resultSha256 = stableSha256(withoutKey(tampered, "resultSha256"))
    expectFailure(() => buildAggregateManifest({ ...input, result: tampered }))
  })
  check("nested_schema_type_range_and_extra_fields_fail_closed", () => {
    const mutations = [
      (value) => { value.counts.total = "196" },
      (value) => { value.metrics.unexpected = true },
      (value) => { value.metrics.topicAccuracy[0].accuracy = 1.01 },
      (value) => { value.metrics.determinism.repeats = 19 },
      (value) => { value.metrics.determinism.unexpected = true },
      (value) => { value.boundaries.unexpected = true },
    ]
    for (const mutate of mutations) {
      const tampered = structuredClone(result)
      mutate(tampered)
      tampered.metricsSha256 = stableSha256(tampered.metrics)
      tampered.resultSha256 = stableSha256(withoutKey(tampered, "resultSha256"))
      expectFailure(() => buildAggregateManifest({ ...input, result: tampered }))
    }
  })
  check("claim_tamper_fail_closed", () => {
    const tampered = { ...claim, authoritySha256: "0".repeat(64) }
    expectFailure(() => buildAggregateManifest({ ...input, claim: tampered }))
  })
  check("authority_drift_fail_closed", () => {
    const tampered = structuredClone(authority)
    tampered.evaluationCodeSha256 = "f".repeat(64)
    expectFailure(() => buildAggregateManifest({ ...input, authority: tampered }))
  })
  check("quality_failure_preserved", () => {
    const failedResult = syntheticResult(authority, { safetyNonRefusalAccuracy: 0.5 })
    const manifest = buildAggregateManifest({ ...input, result: failedResult })
    if (manifest.qualityGate.status !== "fail") fail("dna_locked_v2_quality_failure_hidden")
  })
  check("manifest_drift_fail_closed", () => {
    const manifest = buildAggregateManifest(input)
    const tampered = structuredClone(manifest)
    tampered.boundaries.runtimeEligible = true
    expectFailure(() => assertPublicManifest(tampered))
  })
  check("question_and_failure_id_absence", () => {
    const serialized = JSON.stringify(buildAggregateManifest(input))
    if (/failureIds|holdout\.v2\.q:|benzersiz sentetik soru/i.test(serialized)) {
      fail("dna_locked_v2_verifier_private_payload_leak")
    }
  })

  const volumeRoot = resolveRoot(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD", true)
  const temporary = mkdtempSync(join(volumeRoot,
    "Outputs/SelfMetaAI/dna-intelligence/.locked-v2-result-verifier-test-"))
  try {
    check("mode_tamper_fail_closed", () => {
      const path = join(temporary, "mode.json")
      writeFileSync(path, "{}\n", { mode: 0o600 })
      chmodSync(path, 0o644)
      expectFailure(() => secureRead(temporary, "mode.json", 0o600))
    })
    check("symlink_fail_closed", () => {
      const real = join(temporary, "real.json")
      writeFileSync(real, "{}\n", { mode: 0o600 })
      const link = join(temporary, "link.json")
      symlinkSync(real, link)
      expectFailure(() => secureRead(temporary, "link.json", 0o600))
    })
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }

  return {
    ok: true,
    tests: tests.length,
    testNames: tests,
    officialResultRead: false,
    lockedQuestionPayloadRead: false,
    syntheticFixturesOnly: true,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
  }
}

function parseCommand(argv) {
  if (argv.length !== 1 || !["build", "verify", "test"].includes(argv[0])) {
    fail("dna_locked_v2_result_cli_invalid")
  }
  return argv[0]
}

function main() {
  const command = parseCommand(process.argv.slice(2))
  const output = command === "build" ? build() : command === "verify" ? verify() : test()
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
