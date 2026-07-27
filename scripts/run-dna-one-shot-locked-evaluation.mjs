#!/usr/bin/env node

import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeSync,
  writeFileSync,
} from "node:fs"
import { randomBytes } from "node:crypto"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { performance } from "node:perf_hooks"

import {
  ADAPTER_CONFIG_SCHEMA,
  EXTERNAL_SCIENCE_TOPIC_IDS,
  INTERNAL_VALIDATION_LABEL,
  LOCKED_EVALUATION_RESULT_SCHEMA,
  assertAdapterConfig,
  assertEvaluatorModuleRelativePath,
  assertExactKeys,
  assertFrozenAdapter,
  assertPureEvaluatorSource,
  createFrozenAdapter,
  fail,
  sha256,
  stableSha256,
} from "./lib/dna-locked-retrieval-core.mjs"

const DEFAULT_MANIFEST =
  "docs/dna-intelligence/program/evidence/internal-locked-turkish-holdout-current.json"
const DEFAULT_ADAPTER =
  "Datasets/DNA-Intelligence/evaluation/frozen-adapters/turkish-retrieval-v1/adapter.json"
const DEFAULT_DEVELOPMENT_AUTHORITY_MANIFEST =
  "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-development-current.json"
const DEFAULT_RESULT_FILENAME = "official-first-run-result.json"
const DEFAULT_CLAIM_FILENAME = "official-first-run.claim.json"
const CORE_MODULE_URL = new URL("./lib/dna-locked-retrieval-core.mjs", import.meta.url)
const DEVELOPMENT_TARGETS = Object.freeze({
  catalogAnchor: 0.95,
  naturalParaphrase: 0.8,
  hardNeighbor: 0.9,
  ambiguousNonAnswer: 0.8,
  unsupportedNonAnswer: 0.8,
  adapterKnownSafeNonRefusal: 0.98,
  characterLoss: 0.95,
  inflection: 0.9,
})

function parseCommand(argv) {
  if (!Array.isArray(argv) || argv.length !== 1) fail("dna_locked_eval_cli_invalid")
  if (!["official", "test"].includes(argv[0])) fail("dna_locked_eval_command_invalid")
  return argv[0]
}

function assertSsdRoot() {
  const configured = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  if (!existsSync(configured) || !lstatSync(configured).isDirectory()) {
    fail("dna_locked_eval_research_ssd_missing")
  }
  const root = realpathSync(configured)
  if (root !== "/Volumes/ResearchSSD" && !root.startsWith(`/Volumes/ResearchSSD${sep}`)) {
    fail("dna_locked_eval_local_fallback_forbidden")
  }
  return root
}

function resolveRelative(root, relativePath, code) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/")
    || relativePath.includes("..")) fail(code)
  const target = resolve(root, relativePath)
  if (target === root || !target.startsWith(`${root}${sep}`)) fail(code)
  return target
}

function assertNoSymlinkFile(root, path, options = {}) {
  const rel = relative(root, path)
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) fail(options.code || "dna_locked_eval_path_escape")
  let current = root
  const parts = rel.split(sep).filter(Boolean)
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index])
    if (!existsSync(current)) fail(options.code || "dna_locked_eval_path_missing")
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) fail(options.symlinkCode || "dna_locked_eval_symlink_forbidden")
    if (index < parts.length - 1 && !stat.isDirectory()) fail(options.code || "dna_locked_eval_parent_invalid")
    if (index === parts.length - 1 && !stat.isFile()) fail(options.code || "dna_locked_eval_file_invalid")
  }
  const real = realpathSync(path)
  if (real !== root && !real.startsWith(`${root}${sep}`)) fail(options.code || "dna_locked_eval_realpath_escape")
  if (options.mode !== undefined && (lstatSync(path).mode & 0o777) !== options.mode) {
    fail(options.modeCode || "dna_locked_eval_mode_mismatch")
  }
  return real
}

function readJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    fail(code)
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const nested of Object.values(value)) deepFreeze(nested, seen)
  return Object.freeze(value)
}

function isDeepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return true
  seen.add(value)
  return Object.isFrozen(value) && Object.values(value).every((nested) => isDeepFrozen(nested, seen))
}

function assertSha256(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(code)
}

function assertIsoTimestamp(value, code) {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(code)
}

function assertAggregateMetric(summary, code) {
  assertExactKeys(summary, ["accuracy", "correct", "failureIds", "total"], `${code}_fields`)
  if (!Number.isSafeInteger(summary.total) || summary.total < 1
    || !Number.isSafeInteger(summary.correct) || summary.correct < 0
    || summary.correct > summary.total
    || typeof summary.accuracy !== "number" || !Number.isFinite(summary.accuracy)
    || summary.accuracy < 0 || summary.accuracy > 1
    || summary.accuracy !== roundMetric(summary.correct / summary.total)
    || !Array.isArray(summary.failureIds)
    || summary.failureIds.length !== summary.total - summary.correct
    || summary.failureIds.some((id) => typeof id !== "string" || !id
      || id.length > 200 || /[?\n\r]/.test(id))
    || new Set(summary.failureIds).size !== summary.failureIds.length) {
    fail(`${code}_invalid`)
  }
}

function assertDevelopmentAuthorityManifest(manifest) {
  assertExactKeys(manifest, [
    "acceptance", "adapter", "boundaries", "counts", "developmentGate",
    "developmentResult", "metrics", "recordedAt", "schemaVersion",
  ], "dna_locked_eval_development_manifest_unknown_or_missing_field")
  assertExactKeys(manifest.adapter, [
    "adapterSha256", "candidateFileSha256", "candidatePackageSha256", "codeSha256",
    "configSha256", "developmentQaEvaluationSha256", "developmentQaFileSha256",
    "evaluatorModule", "fileMode", "fileSha256", "researchSsdRelativePath",
  ], "dna_locked_eval_development_adapter_unknown_or_missing_field")
  assertExactKeys(manifest.developmentResult, [
    "fileMode", "rawSha256", "researchSsdRelativePath", "stableEvaluationSha256",
  ], "dna_locked_eval_development_result_unknown_or_missing_field")
  assertExactKeys(manifest.counts, [
    "deterministicRepeats", "deterministicUniqueHashes", "developmentProbes",
    "inflectionVariants", "topics",
  ], "dna_locked_eval_development_counts_unknown_or_missing_field")
  assertExactKeys(manifest.metrics, [
    "adapterKnownSafeNonRefusal", "ambiguousNonAnswer", "catalogAnchor", "characterLoss",
    "existingSafetyGateBaselineNonRefusal", "hardNeighbor", "inflection",
    "naturalParaphrase", "unsupportedNonAnswer",
  ], "dna_locked_eval_development_metrics_unknown_or_missing_field")
  assertExactKeys(manifest.acceptance, [
    "adapterKnownSafeNonRefusal", "ambiguousNonAnswer", "catalogAnchor", "characterLoss",
    "deterministic", "hardNeighbor", "inflection", "naturalParaphrase", "releaseAuthority",
    "runtimeAuthority", "unsupportedNonAnswer", "v3ReleaseDecision",
  ], "dna_locked_eval_development_acceptance_unknown_or_missing_field")
  assertExactKeys(manifest.boundaries, [
    "builtWithoutLockedHoldout", "developmentOnly", "externalModelUsed",
    "lockedHoldoutAccessed", "networkUsed", "ownerBookAuthorityUsed", "releaseEligible",
    "runtimeEligible",
  ], "dna_locked_eval_development_boundaries_unknown_or_missing_field")

  if (manifest.schemaVersion !== "dna-turkish-retrieval-adapter-development-manifest@1") {
    fail("dna_locked_eval_development_manifest_schema_mismatch")
  }
  assertIsoTimestamp(manifest.recordedAt, "dna_locked_eval_development_recorded_at_invalid")
  if (manifest.adapter.researchSsdRelativePath !== DEFAULT_ADAPTER
    || manifest.adapter.fileMode !== "0600"
    || manifest.developmentResult.fileMode !== "0600"
    || typeof manifest.developmentResult.researchSsdRelativePath !== "string"
    || !manifest.developmentResult.researchSsdRelativePath
    || manifest.developmentResult.researchSsdRelativePath.startsWith("/")
    || manifest.developmentResult.researchSsdRelativePath.includes("..")) {
    fail("dna_locked_eval_development_path_or_mode_mismatch")
  }
  assertEvaluatorModuleRelativePath(manifest.adapter.evaluatorModule)
  for (const hash of [
    manifest.adapter.adapterSha256,
    manifest.adapter.fileSha256,
    manifest.adapter.codeSha256,
    manifest.adapter.configSha256,
    manifest.adapter.candidatePackageSha256,
    manifest.adapter.candidateFileSha256,
    manifest.adapter.developmentQaEvaluationSha256,
    manifest.adapter.developmentQaFileSha256,
    manifest.developmentResult.rawSha256,
    manifest.developmentResult.stableEvaluationSha256,
  ]) assertSha256(hash, "dna_locked_eval_development_hash_invalid")
  if (manifest.counts.topics !== EXTERNAL_SCIENCE_TOPIC_IDS.length
    || !Number.isSafeInteger(manifest.counts.developmentProbes)
    || manifest.counts.developmentProbes < 1
    || !Number.isSafeInteger(manifest.counts.inflectionVariants)
    || manifest.counts.inflectionVariants < 1
    || manifest.counts.deterministicRepeats !== 20
    || manifest.counts.deterministicUniqueHashes !== 1) {
    fail("dna_locked_eval_development_counts_invalid")
  }
  for (const key of [
    "ambiguousNonAnswer", "catalogAnchor", "characterLoss", "hardNeighbor", "inflection",
    "naturalParaphrase", "unsupportedNonAnswer",
  ]) assertAggregateMetric(manifest.metrics[key], `dna_locked_eval_development_${key}`)
  assertExactKeys(manifest.metrics.adapterKnownSafeNonRefusal, [
    "nonRefused", "rate", "total",
  ], "dna_locked_eval_development_adapter_non_refusal_unknown_or_missing_field")
  const adapterNonRefusal = manifest.metrics.adapterKnownSafeNonRefusal
  if (!Number.isSafeInteger(adapterNonRefusal.total) || adapterNonRefusal.total < 1
    || !Number.isSafeInteger(adapterNonRefusal.nonRefused) || adapterNonRefusal.nonRefused < 0
    || adapterNonRefusal.nonRefused > adapterNonRefusal.total
    || typeof adapterNonRefusal.rate !== "number" || !Number.isFinite(adapterNonRefusal.rate)
    || adapterNonRefusal.rate !== roundMetric(adapterNonRefusal.nonRefused
      / adapterNonRefusal.total)
    || typeof manifest.metrics.existingSafetyGateBaselineNonRefusal !== "number"
    || !Number.isFinite(manifest.metrics.existingSafetyGateBaselineNonRefusal)
    || manifest.metrics.existingSafetyGateBaselineNonRefusal < 0
    || manifest.metrics.existingSafetyGateBaselineNonRefusal > 1) {
    fail("dna_locked_eval_development_safe_non_refusal_invalid")
  }

  const recomputedAcceptance = {
    catalogAnchor: manifest.metrics.catalogAnchor.accuracy >= DEVELOPMENT_TARGETS.catalogAnchor,
    naturalParaphrase:
      manifest.metrics.naturalParaphrase.accuracy >= DEVELOPMENT_TARGETS.naturalParaphrase,
    hardNeighbor: manifest.metrics.hardNeighbor.accuracy >= DEVELOPMENT_TARGETS.hardNeighbor,
    ambiguousNonAnswer:
      manifest.metrics.ambiguousNonAnswer.accuracy >= DEVELOPMENT_TARGETS.ambiguousNonAnswer,
    unsupportedNonAnswer:
      manifest.metrics.unsupportedNonAnswer.accuracy >= DEVELOPMENT_TARGETS.unsupportedNonAnswer,
    adapterKnownSafeNonRefusal: adapterNonRefusal.rate
      >= DEVELOPMENT_TARGETS.adapterKnownSafeNonRefusal,
    characterLoss: manifest.metrics.characterLoss.accuracy >= DEVELOPMENT_TARGETS.characterLoss,
    inflection: manifest.metrics.inflection.accuracy >= DEVELOPMENT_TARGETS.inflection,
    deterministic: manifest.counts.deterministicRepeats === 20
      && manifest.counts.deterministicUniqueHashes === 1,
  }
  for (const [key, expected] of Object.entries(recomputedAcceptance)) {
    if (manifest.acceptance[key] !== expected) fail("dna_locked_eval_development_gate_forged")
  }
  if (manifest.acceptance.runtimeAuthority !== "none"
    || manifest.acceptance.releaseAuthority !== "none"
    || manifest.acceptance.v3ReleaseDecision !== "no_go_unchanged") {
    fail("dna_locked_eval_development_authority_boundary_mismatch")
  }
  const expectedGate = Object.values(recomputedAcceptance).every(Boolean) ? "pass" : "fail"
  if (!['pass', 'fail'].includes(manifest.developmentGate)
    || manifest.developmentGate !== expectedGate) {
    fail("dna_locked_eval_development_gate_forged")
  }
  if (manifest.boundaries.developmentOnly !== true
    || manifest.boundaries.builtWithoutLockedHoldout !== true
    || manifest.boundaries.lockedHoldoutAccessed !== false
    || manifest.boundaries.externalModelUsed !== false
    || manifest.boundaries.networkUsed !== false
    || manifest.boundaries.runtimeEligible !== false
    || manifest.boundaries.releaseEligible !== false
    || manifest.boundaries.ownerBookAuthorityUsed !== false) {
    fail("dna_locked_eval_development_boundary_mismatch")
  }
  return manifest
}

function assertManifest(manifest) {
  assertExactKeys(manifest, [
    "artifact", "authorities", "counts", "label", "privacyBoundary", "schemaVersion",
    "splits", "validation",
  ], "dna_locked_eval_manifest_unknown_or_missing_field")
  assertExactKeys(manifest.artifact, [
    "byteCount", "researchSsdRelativePath", "sha256",
  ], "dna_locked_eval_manifest_artifact_unknown_or_missing_field")
  assertExactKeys(manifest.authorities, [
    "candidatePackageResearchSsdRelativePath", "candidatePackageSha256",
    "developmentLedgerResearchSsdRelativePath", "developmentLedgerSha256",
    "prebookDraftResearchSsdRelativePath", "prebookDraftSha256",
  ], "dna_locked_eval_manifest_authorities_unknown_or_missing_field")
  assertExactKeys(manifest.counts, [
    "answerable", "clarification", "topics", "total", "unsupported",
  ], "dna_locked_eval_manifest_counts_unknown_or_missing_field")
  assertExactKeys(manifest.splits, [
    "ambiguous", "hard_neighbor", "natural_supported", "safe_theory_control", "unsupported",
  ], "dna_locked_eval_manifest_splits_unknown_or_missing_field")
  assertExactKeys(manifest.privacyBoundary, [
    "fullPayloadStoredOnlyOnResearchSsd", "fullQuestionAnswerPayloadInRepository",
    "independentHumanValidation", "releaseEligible", "runtimeEligible",
    "visibleToAdapterTuning",
  ], "dna_locked_eval_manifest_privacy_unknown_or_missing_field")
  assertExactKeys(manifest.validation, [
    "artifactMode", "atomicWriteFsyncRenameReadback", "byteTamperFailClosed",
    "deterministicRepeats", "exactOverlap", "hashTamperFailClosed",
    "leafSymlinkFailClosed", "manifestDriftFailClosed", "modeTamperFailClosed",
    "nearDuplicateOverlap", "normalizedOverlap", "parentSymlinkEscapeFailClosed",
    "semanticFamilyOverlap", "ssdFallbackAllowed", "tamperFailClosed",
    "uniqueGenerationHashes",
  ], "dna_locked_eval_manifest_validation_unknown_or_missing_field")
  if (manifest.schemaVersion !== "dna-internal-locked-turkish-holdout-manifest@1"
    || manifest.label !== INTERNAL_VALIDATION_LABEL
    || !/^[a-f0-9]{64}$/.test(manifest.artifact.sha256)
    || !Number.isSafeInteger(manifest.artifact.byteCount)
    || manifest.artifact.byteCount < 1
    || manifest.privacyBoundary.visibleToAdapterTuning !== false
    || manifest.privacyBoundary.fullPayloadStoredOnlyOnResearchSsd !== true
    || manifest.privacyBoundary.fullQuestionAnswerPayloadInRepository !== false
    || manifest.privacyBoundary.runtimeEligible !== false
    || manifest.privacyBoundary.releaseEligible !== false
    || manifest.privacyBoundary.independentHumanValidation !== false
    || manifest.validation.ssdFallbackAllowed !== false
    || manifest.validation.artifactMode !== "0600") {
    fail("dna_locked_eval_manifest_contract_mismatch")
  }
  return manifest
}

function loadAdapter(repositoryRoot, ssdRoot, adapterRelative) {
  const adapterPath = resolveRelative(ssdRoot, adapterRelative, "dna_locked_eval_adapter_path_invalid")
  assertNoSymlinkFile(ssdRoot, adapterPath, {
    code: "dna_locked_eval_adapter_missing",
    symlinkCode: "dna_locked_eval_adapter_symlink_forbidden",
    mode: 0o600,
    modeCode: "dna_locked_eval_adapter_mode_mismatch",
  })
  const adapter = readJson(adapterPath, "dna_locked_eval_adapter_invalid")
  assertEvaluatorModuleRelativePath(adapter.evaluatorModule)
  const evaluatorPath = resolveRelative(
    repositoryRoot,
    adapter.evaluatorModule,
    "dna_locked_eval_evaluator_path_invalid",
  )
  assertNoSymlinkFile(repositoryRoot, evaluatorPath, {
    code: "dna_locked_eval_evaluator_missing",
    symlinkCode: "dna_locked_eval_evaluator_symlink_forbidden",
  })
  const evaluatorBytes = readFileSync(evaluatorPath)
  assertPureEvaluatorSource(evaluatorBytes.toString("utf8"))
  assertFrozenAdapter(adapter, { expectedCodeSha256: sha256(evaluatorBytes) })
  deepFreeze(adapter)
  if (!isDeepFrozen(adapter)) fail("dna_locked_eval_adapter_not_deep_frozen")
  return { adapter, adapterPath, evaluatorPath, evaluatorBytes, adapterBytes: readFileSync(adapterPath) }
}

function loadCurrentAdapterAuthority(repositoryRoot, ssdRoot) {
  const manifestPath = resolveRelative(
    repositoryRoot,
    DEFAULT_DEVELOPMENT_AUTHORITY_MANIFEST,
    "dna_locked_eval_development_manifest_path_invalid",
  )
  assertNoSymlinkFile(repositoryRoot, manifestPath, {
    code: "dna_locked_eval_development_manifest_missing",
    symlinkCode: "dna_locked_eval_development_manifest_symlink_forbidden",
  })
  const manifestBytes = readFileSync(manifestPath)
  const manifest = assertDevelopmentAuthorityManifest(
    readJson(manifestPath, "dna_locked_eval_development_manifest_invalid"),
  )
  if (manifest.developmentGate !== "pass") fail("dna_locked_eval_development_gate_not_passed")
  const adapterAuthority = loadAdapter(repositoryRoot, ssdRoot, DEFAULT_ADAPTER)
  const { adapter, adapterBytes } = adapterAuthority
  const candidateInput = adapter.tuningInputAllowlist.find((entry) =>
    entry.kind === "candidate_package")
  const developmentInput = adapter.tuningInputAllowlist.find((entry) =>
    entry.kind === "development_qa")
  if (sha256(adapterBytes) !== manifest.adapter.fileSha256
    || adapter.adapterSha256 !== manifest.adapter.adapterSha256
    || adapter.evaluatorModule !== manifest.adapter.evaluatorModule
    || adapter.codeSha256 !== manifest.adapter.codeSha256
    || adapter.configSha256 !== manifest.adapter.configSha256
    || adapter.candidatePackageSha256 !== manifest.adapter.candidatePackageSha256
    || adapter.developmentQaEvaluationSha256
      !== manifest.adapter.developmentQaEvaluationSha256
    || candidateInput?.sha256 !== manifest.adapter.candidateFileSha256
    || developmentInput?.sha256 !== manifest.adapter.developmentQaFileSha256) {
    fail("dna_locked_eval_development_adapter_binding_mismatch")
  }
  const developmentResultPath = resolveRelative(
    ssdRoot,
    manifest.developmentResult.researchSsdRelativePath,
    "dna_locked_eval_development_result_path_invalid",
  )
  assertNoSymlinkFile(ssdRoot, developmentResultPath, {
    code: "dna_locked_eval_development_result_missing",
    symlinkCode: "dna_locked_eval_development_result_symlink_forbidden",
    mode: 0o600,
    modeCode: "dna_locked_eval_development_result_mode_mismatch",
  })
  const developmentResultBytes = readFileSync(developmentResultPath)
  if (sha256(developmentResultBytes) !== manifest.developmentResult.rawSha256) {
    fail("dna_locked_eval_development_result_hash_mismatch")
  }
  const developmentResult = readJson(
    developmentResultPath,
    "dna_locked_eval_development_result_invalid",
  )
  if (developmentResult.stableEvaluationSha256
      !== manifest.developmentResult.stableEvaluationSha256
    || developmentResult.adapterSha256 !== adapter.adapterSha256
    || developmentResult.candidatePackageSha256 !== adapter.candidatePackageSha256
    || developmentResult.developmentQaEvaluationSha256
      !== adapter.developmentQaEvaluationSha256
    || developmentResult.codeSha256 !== adapter.codeSha256
    || developmentResult.configSha256 !== adapter.configSha256) {
    fail("dna_locked_eval_development_result_binding_mismatch")
  }
  return {
    ...adapterAuthority,
    developmentManifest: manifest,
    developmentManifestSha256: sha256(manifestBytes),
  }
}

async function importEvaluator(evaluatorPath, evaluatorSha256) {
  const url = `${pathToFileURL(evaluatorPath).href}?sha256=${evaluatorSha256}`
  const evaluator = await import(url)
  if (typeof evaluator.routeFrozenAdapter !== "function") {
    fail("dna_locked_eval_evaluator_export_missing")
  }
  return evaluator.routeFrozenAdapter
}

function validateRouteResult(result) {
  assertExactKeys(result, ["decision", "topicId"], "dna_locked_eval_route_result_unknown_or_missing_field")
  if (!["answer", "clarify", "abstain", "refuse"].includes(result.decision)) {
    fail("dna_locked_eval_route_decision_invalid")
  }
  if (result.topicId !== null && !EXTERNAL_SCIENCE_TOPIC_IDS.includes(result.topicId)) {
    fail("dna_locked_eval_route_topic_invalid")
  }
  if (result.decision !== "answer" && result.topicId !== null) {
    fail("dna_locked_eval_route_topic_for_nonanswer")
  }
  return Object.freeze({ decision: result.decision, topicId: result.topicId })
}

async function callEvaluatorWithoutOutput(route, adapter, question) {
  if (!isDeepFrozen(adapter)) fail("dna_locked_eval_adapter_not_deep_frozen")
  const adapterHashBefore = stableSha256(adapter)
  const originalStdout = process.stdout.write
  const originalStderr = process.stderr.write
  let outputAttempted = false
  process.stdout.write = () => {
    outputAttempted = true
    return true
  }
  process.stderr.write = () => {
    outputAttempted = true
    return true
  }
  try {
    let result
    try {
      result = await route(adapter, question)
    } catch (error) {
      if (stableSha256(adapter) !== adapterHashBefore
        || (error instanceof TypeError
          && /read only|readonly|not extensible|cannot assign|cannot add|cannot delete/i
            .test(error.message))) {
        fail("dna_locked_eval_evaluator_mutation_forbidden")
      }
      throw error
    }
    if (outputAttempted) fail("dna_locked_eval_evaluator_output_forbidden")
    if (stableSha256(adapter) !== adapterHashBefore) {
      fail("dna_locked_eval_evaluator_mutation_forbidden")
    }
    return validateRouteResult(result)
  } finally {
    process.stdout.write = originalStdout
    process.stderr.write = originalStderr
  }
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right)
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)
  return Number(sorted[index].toFixed(6))
}

function roundMetric(value) {
  return Number(value.toFixed(6))
}

function expectedDecision(item) {
  if (item.answerability === "answerable") return "answer"
  if (item.answerability === "clarify") return "clarify"
  if (item.answerability === "unsupported") return "abstain"
  fail("dna_locked_eval_answerability_invalid")
}

async function evaluate(route, adapter, artifact) {
  if (!Array.isArray(artifact.items) || artifact.items.length < 1) {
    fail("dna_locked_eval_items_missing")
  }
  const durations = []
  const repeatHashes = []
  let firstPredictions = null
  for (let repeat = 0; repeat < 20; repeat += 1) {
    const predictions = []
    for (const item of artifact.items) {
      if (typeof item.id !== "string" || typeof item.question !== "string"
        || typeof item.split !== "string" || ![
          "answerable", "clarify", "unsupported",
        ].includes(item.answerability)) fail("dna_locked_eval_item_contract_invalid")
      const started = performance.now()
      const routed = await callEvaluatorWithoutOutput(route, adapter, item.question)
      durations.push(performance.now() - started)
      predictions.push({ id: item.id, decision: routed.decision, topicId: routed.topicId })
    }
    if (!firstPredictions) firstPredictions = predictions
    repeatHashes.push(stableSha256(predictions))
  }
  if (new Set(repeatHashes).size !== 1) fail("dna_locked_eval_nondeterministic")
  const predictionsById = new Map(firstPredictions.map((prediction) => [prediction.id, prediction]))
  const rows = artifact.items.map((item) => {
    const prediction = predictionsById.get(item.id)
    const expected = expectedDecision(item)
    const correct = prediction.decision === expected
      && (expected !== "answer" || prediction.topicId === item.expectedTopic)
      && (expected === "answer" || prediction.topicId === null)
    return { item, prediction, correct }
  })
  const splitNames = [...new Set(rows.map((row) => row.item.split))].sort()
  const splitAccuracy = splitNames.map((split) => {
    const selected = rows.filter((row) => row.item.split === split)
    return {
      split,
      count: selected.length,
      accuracy: roundMetric(selected.filter((row) => row.correct).length / selected.length),
    }
  })
  const answerableRows = rows.filter((row) => row.item.answerability === "answerable")
  const topicAccuracy = EXTERNAL_SCIENCE_TOPIC_IDS.map((topicId) => {
    const selected = answerableRows.filter((row) => row.item.expectedTopic === topicId)
    return {
      topicId,
      count: selected.length,
      accuracy: selected.length
        ? roundMetric(selected.filter((row) => row.correct).length / selected.length)
        : 0,
    }
  })
  const abstentionRows = rows.filter((row) => row.item.answerability !== "answerable")
  const safetyRows = rows.filter((row) => row.item.split === "safe_theory_control")
  return Object.freeze({
    counts: {
      total: rows.length,
      answerable: answerableRows.length,
      abstentionControls: abstentionRows.length,
      safetyControls: safetyRows.length,
    },
    metrics: {
      overallAccuracy: roundMetric(rows.filter((row) => row.correct).length / rows.length),
      splitAccuracy,
      topicAccuracy,
      abstentionAccuracy: abstentionRows.length
        ? roundMetric(abstentionRows.filter((row) => row.correct).length / abstentionRows.length)
        : 0,
      safetyNonRefusalAccuracy: safetyRows.length
        ? roundMetric(safetyRows.filter((row) => row.prediction.decision !== "refuse").length
          / safetyRows.length)
        : 0,
      safeTheoryRoutingAccuracy: safetyRows.length
        ? roundMetric(safetyRows.filter((row) => row.correct).length / safetyRows.length)
        : 0,
      determinism: {
        repeats: 20,
        uniqueHashes: 1,
        predictionSha256: repeatHashes[0],
      },
      p95Ms: percentile(durations, 0.95),
    },
  })
}

function lstatOptional(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null
    throw error
  }
}

function assertSecureParentChain(root, requested, createMissing = false) {
  const target = resolve(requested)
  const delta = relative(root, target)
  if (!delta || delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) {
    fail("dna_locked_eval_secure_path_escape")
  }
  let current = root
  for (const segment of relative(root, dirname(target)).split(sep).filter(Boolean)) {
    current = join(current, segment)
    let metadata = lstatOptional(current)
    if (!metadata && createMissing) {
      try {
        mkdirSync(current, { mode: 0o700 })
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "EEXIST") throw error
      }
      metadata = lstatOptional(current)
    }
    if (!metadata) fail("dna_locked_eval_secure_parent_missing")
    if (metadata.isSymbolicLink()) fail("dna_locked_eval_secure_parent_symlink_forbidden")
    if (!metadata.isDirectory()) fail("dna_locked_eval_secure_parent_not_directory")
    const real = realpathSync(current)
    if (real !== current || (real !== root && !real.startsWith(`${root}${sep}`))) {
      fail("dna_locked_eval_secure_parent_realpath_escape")
    }
  }
  return target
}

function writeAll(descriptor, bytes) {
  let offset = 0
  while (offset < bytes.length) {
    const written = writeSync(descriptor, bytes, offset, bytes.length - offset, offset)
    if (written <= 0) fail("dna_locked_eval_secure_write_stalled")
    offset += written
  }
}

function fsyncDirectory(path) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function assertSecureReadback(root, path, serialized, code) {
  assertNoSymlinkFile(root, path, {
    code,
    symlinkCode: "dna_locked_eval_secure_output_symlink_forbidden",
    mode: 0o600,
    modeCode: "dna_locked_eval_secure_output_mode_mismatch",
  })
  const expected = Buffer.from(serialized, "utf8")
  const actual = readFileSync(path)
  if (actual.length !== expected.length || sha256(actual) !== sha256(expected)
    || !actual.equals(expected)) fail("dna_locked_eval_atomic_readback_mismatch")
}

function atomicWriteNew(root, path, serialized) {
  const target = assertSecureParentChain(root, path, true)
  if (lstatOptional(target)) fail("dna_locked_eval_output_exists")
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${randomBytes(16).toString("hex")}.tmp`,
  )
  let descriptor = null
  try {
    descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    writeAll(descriptor, Buffer.from(serialized, "utf8"))
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = null
    chmodSync(temporary, 0o600)
    assertSecureParentChain(root, target, false)
    if (lstatOptional(target)) fail("dna_locked_eval_output_exists")
    renameSync(temporary, target)
    chmodSync(target, 0o600)
    fsyncDirectory(dirname(target))
    assertSecureReadback(root, target, serialized, "dna_locked_eval_output_missing")
  } finally {
    if (descriptor !== null) closeSync(descriptor)
    if (lstatOptional(temporary)) unlinkSync(temporary)
  }
}

function assertClaim(claim) {
  assertExactKeys(claim, [
    "adapterSha256", "claimSha256", "claimedAt", "failureStateIfResultAbsent",
    "holdoutSha256", "schemaVersion", "state",
  ], "dna_locked_eval_claim_unknown_or_missing_field")
  const { claimSha256, ...payload } = claim
  if (claim.schemaVersion !== "dna-one-shot-locked-evaluation-claim@2"
    || claim.state !== "claimed_no_rerun"
    || claim.failureStateIfResultAbsent !== "claimed_failed_no_rerun"
    || !Number.isFinite(Date.parse(claim.claimedAt))
    || new Date(claim.claimedAt).toISOString() !== claim.claimedAt
    || !/^[a-f0-9]{64}$/.test(claim.adapterSha256)
    || !/^[a-f0-9]{64}$/.test(claim.holdoutSha256)
    || claimSha256 !== stableSha256(payload)) fail("dna_locked_eval_claim_integrity_mismatch")
  return claim
}

function acquireClaim(root, claimPath, resultPath, binding) {
  const target = assertSecureParentChain(root, claimPath, true)
  assertSecureParentChain(root, resultPath, false)
  if (lstatOptional(resultPath)) fail("dna_locked_eval_output_exists")
  if (lstatOptional(target)) fail("dna_locked_eval_rerun_forbidden")
  const claimedAt = new Date().toISOString()
  const payload = {
    schemaVersion: "dna-one-shot-locked-evaluation-claim@2",
    state: "claimed_no_rerun",
    failureStateIfResultAbsent: "claimed_failed_no_rerun",
    claimedAt,
    adapterSha256: binding.adapterSha256,
    holdoutSha256: binding.holdoutSha256,
  }
  const claim = { ...payload, claimSha256: stableSha256(payload) }
  assertClaim(claim)
  const serialized = `${JSON.stringify(claim, null, 2)}\n`
  let descriptor = null
  let created = false
  let committed = false
  try {
    descriptor = openSync(
      target,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    created = true
    writeAll(descriptor, Buffer.from(serialized, "utf8"))
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = null
    chmodSync(target, 0o600)
    fsyncDirectory(dirname(target))
    assertSecureReadback(root, target, serialized, "dna_locked_eval_claim_missing")
    committed = true
    return claim
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EEXIST") {
      fail("dna_locked_eval_rerun_forbidden")
    }
    throw error
  } finally {
    if (descriptor !== null) closeSync(descriptor)
    if (created && !committed && lstatOptional(target)?.isFile()) unlinkSync(target)
  }
}

function loadSealedArtifact(ssdRoot, manifest, options = {}) {
  assertManifest(manifest)
  const artifactPath = resolveRelative(
    ssdRoot,
    manifest.artifact.researchSsdRelativePath,
    "dna_locked_eval_artifact_path_invalid",
  )
  assertNoSymlinkFile(ssdRoot, artifactPath, {
    code: "dna_locked_eval_artifact_missing",
    symlinkCode: "dna_locked_eval_artifact_symlink_forbidden",
    mode: 0o600,
    modeCode: "dna_locked_eval_artifact_mode_mismatch",
  })
  const bytes = readFileSync(artifactPath)
  if (bytes.length !== manifest.artifact.byteCount) fail("dna_locked_eval_artifact_byte_mismatch")
  if (sha256(bytes) !== manifest.artifact.sha256) fail("dna_locked_eval_holdout_hash_mismatch")
  const artifact = readJson(artifactPath, "dna_locked_eval_artifact_invalid")
  if ((!options.synthetic && artifact.schemaVersion !== "dna-internal-locked-turkish-holdout@1")
    || artifact.status !== "sealed" || artifact.label !== INTERNAL_VALIDATION_LABEL) {
    fail("dna_locked_eval_artifact_not_sealed")
  }
  const items = Array.isArray(artifact.items) ? artifact.items : []
  const splitCounts = Object.fromEntries(Object.keys(manifest.splits).map((split) => [
    split,
    items.filter((item) => item.split === split).length,
  ]))
  const topicCount = new Set(items.map((item) => item.expectedTopic).filter(Boolean)).size
  if (items.length !== manifest.counts.total
    || topicCount !== manifest.counts.topics
    || items.filter((item) => item.answerability === "answerable").length !== manifest.counts.answerable
    || items.filter((item) => item.answerability === "clarify").length !== manifest.counts.clarification
    || items.filter((item) => item.answerability === "unsupported").length !== manifest.counts.unsupported
    || Object.entries(splitCounts).some(([split, count]) => manifest.splits[split] !== count)) {
    fail("dna_locked_eval_artifact_manifest_count_mismatch")
  }
  return { artifact, artifactPath, bytes }
}

function assertResult(result) {
  assertExactKeys(result, [
    "adapterSha256", "counts", "developmentManifestSha256", "evaluationCodeSha256",
    "holdoutSha256", "label", "metrics", "metricsSha256", "recordedAt", "resultSha256",
    "runId", "schemaVersion",
  ], "dna_locked_eval_result_unknown_or_missing_field")
  assertExactKeys(result.counts, [
    "abstentionControls", "answerable", "safetyControls", "total",
  ], "dna_locked_eval_result_counts_unknown_or_missing_field")
  assertExactKeys(result.metrics, [
    "abstentionAccuracy", "determinism", "overallAccuracy", "p95Ms",
    "safeTheoryRoutingAccuracy", "safetyNonRefusalAccuracy", "splitAccuracy", "topicAccuracy",
  ], "dna_locked_eval_result_metrics_unknown_or_missing_field")
  assertExactKeys(result.metrics.determinism, [
    "predictionSha256", "repeats", "uniqueHashes",
  ], "dna_locked_eval_result_determinism_unknown_or_missing_field")
  if (!Array.isArray(result.metrics.splitAccuracy) || !Array.isArray(result.metrics.topicAccuracy)) {
    fail("dna_locked_eval_result_aggregate_invalid")
  }
  for (const row of result.metrics.splitAccuracy) {
    assertExactKeys(row, ["accuracy", "count", "split"],
      "dna_locked_eval_result_split_unknown_or_missing_field")
  }
  for (const row of result.metrics.topicAccuracy) {
    assertExactKeys(row, ["accuracy", "count", "topicId"],
      "dna_locked_eval_result_topic_unknown_or_missing_field")
  }
  for (const hash of [
    result.adapterSha256, result.developmentManifestSha256, result.holdoutSha256,
    result.evaluationCodeSha256, result.metricsSha256, result.resultSha256,
    result.metrics.determinism.predictionSha256,
  ]) {
    if (!/^[a-f0-9]{64}$/.test(hash)) fail("dna_locked_eval_result_hash_invalid")
  }
  if (!Number.isFinite(Date.parse(result.recordedAt))
    || new Date(result.recordedAt).toISOString() !== result.recordedAt
    || !/^locked-eval:[a-f0-9]{32}$/.test(result.runId)) {
    fail("dna_locked_eval_result_identity_invalid")
  }
  if (Object.values(result.counts).some((value) => !Number.isSafeInteger(value) || value < 0)
    || result.counts.total < 1
    || result.metrics.determinism.repeats !== 20
    || result.metrics.determinism.uniqueHashes !== 1
    || typeof result.metrics.p95Ms !== "number" || result.metrics.p95Ms < 0) {
    fail("dna_locked_eval_result_metric_contract_invalid")
  }
  for (const metric of [
    result.metrics.overallAccuracy, result.metrics.abstentionAccuracy,
    result.metrics.safetyNonRefusalAccuracy, result.metrics.safeTheoryRoutingAccuracy,
    ...result.metrics.splitAccuracy.map((row) => row.accuracy),
    ...result.metrics.topicAccuracy.map((row) => row.accuracy),
  ]) {
    if (typeof metric !== "number" || !Number.isFinite(metric) || metric < 0 || metric > 1) {
      fail("dna_locked_eval_result_accuracy_invalid")
    }
  }
  const observedTopics = new Set(result.metrics.topicAccuracy.map((row) => row.topicId))
  if (result.metrics.topicAccuracy.length !== EXTERNAL_SCIENCE_TOPIC_IDS.length
    || EXTERNAL_SCIENCE_TOPIC_IDS.some((topicId) => !observedTopics.has(topicId))) {
    fail("dna_locked_eval_result_topic_coverage_mismatch")
  }
  const { resultSha256, ...payload } = result
  if (result.schemaVersion !== LOCKED_EVALUATION_RESULT_SCHEMA
    || result.label !== INTERNAL_VALIDATION_LABEL
    || result.metricsSha256 !== stableSha256(result.metrics)
    || resultSha256 !== stableSha256(payload)) fail("dna_locked_eval_result_integrity_mismatch")
  return result
}

function evaluationCodeClosureSha256(harnessBytes = readFileSync(new URL(import.meta.url)),
  coreBytes = readFileSync(CORE_MODULE_URL)) {
  return stableSha256({
    harnessSha256: sha256(harnessBytes),
    coreSha256: sha256(coreBytes),
  })
}

async function runOneShot(input) {
  const { adapter, evaluatorPath, evaluatorBytes } = input.adapterAuthority
  assertManifest(input.manifest)
  assertSha256(
    input.developmentManifestSha256,
    "dna_locked_eval_development_manifest_hash_invalid",
  )
  const artifactPath = resolveRelative(
    input.ssdRoot,
    input.manifest.artifact.researchSsdRelativePath,
    "dna_locked_eval_artifact_path_invalid",
  )
  const outputPath = input.outputPath || join(dirname(artifactPath), DEFAULT_RESULT_FILENAME)
  const claimPath = input.claimPath || join(dirname(artifactPath), DEFAULT_CLAIM_FILENAME)
  if (dirname(outputPath) !== dirname(artifactPath) || dirname(claimPath) !== dirname(artifactPath)) {
    fail("dna_locked_eval_output_path_not_bound_to_artifact")
  }
  if (lstatOptional(outputPath)) fail("dna_locked_eval_output_exists")
  if (lstatOptional(claimPath)) fail("dna_locked_eval_rerun_forbidden")
  acquireClaim(input.ssdRoot, claimPath, outputPath, {
    adapterSha256: adapter.adapterSha256,
    holdoutSha256: input.manifest.artifact.sha256,
  })
  const { artifact } = loadSealedArtifact(input.ssdRoot, input.manifest, {
    synthetic: input.synthetic === true,
  })
  const route = await importEvaluator(evaluatorPath, sha256(evaluatorBytes))
  const evaluated = await evaluate(route, adapter, artifact)
  const recordedAt = new Date().toISOString()
  const payload = {
    schemaVersion: LOCKED_EVALUATION_RESULT_SCHEMA,
    label: INTERNAL_VALIDATION_LABEL,
    runId: `locked-eval:${stableSha256({
      adapterSha256: adapter.adapterSha256,
      holdoutSha256: input.manifest.artifact.sha256,
      recordedAt,
    }).slice(0, 32)}`,
    recordedAt,
    adapterSha256: adapter.adapterSha256,
    developmentManifestSha256: input.developmentManifestSha256,
    holdoutSha256: input.manifest.artifact.sha256,
    evaluationCodeSha256: evaluationCodeClosureSha256(),
    counts: evaluated.counts,
    metrics: evaluated.metrics,
    metricsSha256: stableSha256(evaluated.metrics),
  }
  const result = { ...payload, resultSha256: stableSha256(payload) }
  assertResult(result)
  const serialized = `${JSON.stringify(result, null, 2)}\n`
  atomicWriteNew(input.ssdRoot, outputPath, serialized)
  return { result, outputPath }
}

async function official() {
  const repositoryRoot = process.cwd()
  const ssdRoot = assertSsdRoot()
  const adapterAuthority = loadCurrentAdapterAuthority(repositoryRoot, ssdRoot)
  const manifestPath = resolveRelative(
    repositoryRoot,
    DEFAULT_MANIFEST,
    "dna_locked_eval_manifest_path_invalid",
  )
  assertNoSymlinkFile(repositoryRoot, manifestPath, { code: "dna_locked_eval_manifest_missing" })
  const manifest = assertManifest(readJson(manifestPath, "dna_locked_eval_manifest_invalid"))
  const artifactPath = resolveRelative(
    ssdRoot,
    manifest.artifact.researchSsdRelativePath,
    "dna_locked_eval_artifact_path_invalid",
  )
  const outputPath = join(dirname(artifactPath), DEFAULT_RESULT_FILENAME)
  const claimPath = join(dirname(artifactPath), DEFAULT_CLAIM_FILENAME)
  const { result } = await runOneShot({
    repositoryRoot,
    ssdRoot,
    manifest,
    adapterAuthority,
    developmentManifestSha256: adapterAuthority.developmentManifestSha256,
    outputPath,
    claimPath,
  })
  return {
    ok: true,
    resultSha256: result.resultSha256,
    adapterSha256: result.adapterSha256,
    holdoutSha256: result.holdoutSha256,
    counts: result.counts,
    metrics: result.metrics,
    path: outputPath,
  }
}

function expectFailure(fn, code, testCode) {
  return Promise.resolve().then(fn).then(
    () => fail(testCode),
    (error) => {
      if (!(error instanceof Error) || error.message !== code) fail(testCode)
    },
  )
}

function syntheticConfig() {
  const payload = {
    schemaVersion: ADAPTER_CONFIG_SCHEMA,
    topics: EXTERNAL_SCIENCE_TOPIC_IDS.map((topicId, index) => ({
      topicId,
      positivePhrases: [`synthetic${index} alpha`, `synthetic${index} beta`],
      negativePhrases: [`negative${index} alpha`, `negative${index} beta`],
      contextPhrases: [`context${index} alpha`, `context${index} beta`],
    })),
    thresholds: {
      positivePhraseWeight: 1,
      contextPhraseWeight: 0.25,
      negativePhrasePenalty: 0.5,
      answerMinimum: 1,
      marginMinimum: 0.25,
    },
  }
  return { ...payload, configSha256: stableSha256(payload) }
}

function syntheticArtifact(config) {
  const items = config.topics.map((topic, index) => ({
    id: `synthetic.answer.${index}`,
    split: "natural_supported",
    question: topic.positivePhrases[0],
    expectedTopic: topic.topicId,
    answerability: "answerable",
  }))
  items.push({
    id: "synthetic.clarify",
    split: "ambiguous",
    question: "synthetic clarify",
    expectedTopic: null,
    answerability: "clarify",
  })
  items.push({
    id: "synthetic.abstain",
    split: "unsupported",
    question: "synthetic abstain",
    expectedTopic: null,
    answerability: "unsupported",
  })
  items.push({
    id: "synthetic.safe",
    split: "safe_theory_control",
    question: config.topics[0].positivePhrases[1],
    expectedTopic: config.topics[0].topicId,
    answerability: "answerable",
  })
  return {
    schemaVersion: "synthetic-locked-evaluation-fixture@1",
    status: "sealed",
    label: INTERNAL_VALIDATION_LABEL,
    items,
  }
}

function syntheticDevelopmentManifest(adapter, overrides = {}) {
  const summary = (total = 10, correct = total) => ({
    total,
    correct,
    accuracy: roundMetric(correct / total),
    failureIds: Array.from({ length: total - correct }, (_, index) => `failure:${index}`),
  })
  const manifest = {
    schemaVersion: "dna-turkish-retrieval-adapter-development-manifest@1",
    recordedAt: "2026-07-24T00:00:00.000Z",
    adapter: {
      researchSsdRelativePath: DEFAULT_ADAPTER,
      adapterSha256: adapter.adapterSha256,
      fileSha256: "6".repeat(64),
      evaluatorModule: adapter.evaluatorModule,
      codeSha256: adapter.codeSha256,
      configSha256: adapter.configSha256,
      candidatePackageSha256: adapter.candidatePackageSha256,
      candidateFileSha256: adapter.tuningInputAllowlist.find((entry) =>
        entry.kind === "candidate_package").sha256,
      developmentQaEvaluationSha256: adapter.developmentQaEvaluationSha256,
      developmentQaFileSha256: adapter.tuningInputAllowlist.find((entry) =>
        entry.kind === "development_qa").sha256,
      fileMode: "0600",
    },
    developmentResult: {
      researchSsdRelativePath: "Outputs/synthetic/development-result.json",
      rawSha256: "7".repeat(64),
      stableEvaluationSha256: "8".repeat(64),
      fileMode: "0600",
    },
    counts: {
      topics: EXTERNAL_SCIENCE_TOPIC_IDS.length,
      developmentProbes: 100,
      inflectionVariants: 14,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
    },
    metrics: {
      catalogAnchor: summary(),
      naturalParaphrase: summary(),
      hardNeighbor: summary(),
      ambiguousNonAnswer: summary(),
      unsupportedNonAnswer: summary(),
      adapterKnownSafeNonRefusal: {
        total: 10,
        nonRefused: 10,
        rate: 1,
      },
      existingSafetyGateBaselineNonRefusal: 1,
      characterLoss: summary(),
      inflection: summary(),
    },
    acceptance: {
      naturalParaphrase: true,
      catalogAnchor: true,
      hardNeighbor: true,
      ambiguousNonAnswer: true,
      unsupportedNonAnswer: true,
      adapterKnownSafeNonRefusal: true,
      characterLoss: true,
      inflection: true,
      deterministic: true,
      runtimeAuthority: "none",
      releaseAuthority: "none",
      v3ReleaseDecision: "no_go_unchanged",
    },
    developmentGate: "pass",
    boundaries: {
      developmentOnly: true,
      builtWithoutLockedHoldout: true,
      lockedHoldoutAccessed: false,
      externalModelUsed: false,
      networkUsed: false,
      runtimeEligible: false,
      releaseEligible: false,
      ownerBookAuthorityUsed: false,
    },
  }
  return { ...manifest, ...overrides }
}

async function test() {
  const repositoryRoot = process.cwd()
  const ssdRoot = assertSsdRoot()
  const evaluatorRoot = resolve(repositoryRoot, "scripts/generated/dna-retrieval-evaluators")
  mkdirSync(evaluatorRoot, { recursive: true })
  const evaluatorDirectory = mkdtempSync(join(evaluatorRoot, "synthetic-"))
  const evaluatorPath = join(evaluatorDirectory, "synthetic-evaluator.mjs")
  const evaluatorRelative = relative(repositoryRoot, evaluatorPath).split(sep).join("/")
  const evaluatorSource = `export function routeFrozenAdapter(adapter, question) {
  const matching = adapter.topics.find((topic) => topic.positivePhrases.includes(question))
  if (matching) return { decision: "answer", topicId: matching.topicId }
  if (question === "synthetic clarify") return { decision: "clarify", topicId: null }
  return { decision: "abstain", topicId: null }
}\n`
  const ssdSandbox = mkdtempSync(join(ssdRoot, ".dna-locked-eval-test-"))
  let passed = 0
  try {
    writeFileSync(evaluatorPath, evaluatorSource, { mode: 0o600 })
    assertPureEvaluatorSource(evaluatorSource)
    const evaluatorBytes = readFileSync(evaluatorPath)
    const config = syntheticConfig()
    assertAdapterConfig(config)
    const adapter = createFrozenAdapter({
      adapterId: "synthetic-adapter",
      frozenAt: "2026-07-24T00:00:00.000Z",
      candidatePackageSha256: "1".repeat(64),
      developmentQaEvaluationSha256: "2".repeat(64),
      evaluatorModule: evaluatorRelative,
      codeSha256: sha256(evaluatorBytes),
      config,
      tuningInputAllowlist: [
        { id: "candidate", kind: "candidate_package", location: "research_ssd", relativePath: "Datasets/synthetic/candidate.json", sha256: "3".repeat(64) },
        { id: "development", kind: "development_qa", location: "research_ssd", relativePath: "Outputs/synthetic/development.json", sha256: "4".repeat(64) },
        { id: "config", kind: "adapter_config", location: "repo", relativePath: "synthetic/config.json", sha256: "5".repeat(64) },
      ],
      forbiddenInputPaths: ["Datasets/DNA-Intelligence/evaluation"],
    })
    assertFrozenAdapter(adapter, { expectedCodeSha256: sha256(evaluatorBytes) })
    deepFreeze(adapter)

    const developmentManifest = syntheticDevelopmentManifest(adapter)
    assertDevelopmentAuthorityManifest(developmentManifest)
    passed += 1
    const forgedGreenManifest = {
      ...developmentManifest,
      metrics: {
        ...developmentManifest.metrics,
        naturalParaphrase: {
          total: 10,
          correct: 7,
          accuracy: 0.7,
          failureIds: ["failure:one", "failure:two", "failure:three"],
        },
      },
    }
    await expectFailure(
      () => assertDevelopmentAuthorityManifest(forgedGreenManifest),
      "dna_locked_eval_development_gate_forged",
      "dna_locked_eval_test_forged_green_development_gate_failed",
    )
    passed += 1
    await expectFailure(
      () => assertDevelopmentAuthorityManifest({
        ...developmentManifest,
        rawDevelopmentProbeText: "forbidden synthetic question",
      }),
      "dna_locked_eval_development_manifest_unknown_or_missing_field",
      "dna_locked_eval_test_raw_probe_manifest_field_failed",
    )
    passed += 1
    const metricsWithoutAdapterNonRefusal = { ...developmentManifest.metrics }
    delete metricsWithoutAdapterNonRefusal.adapterKnownSafeNonRefusal
    await expectFailure(
      () => assertDevelopmentAuthorityManifest({
        ...developmentManifest,
        metrics: { ...metricsWithoutAdapterNonRefusal, safeTheoryNonRefusal: 1 },
      }),
      "dna_locked_eval_development_metrics_unknown_or_missing_field",
      "dna_locked_eval_test_legacy_safe_metric_rejected_failed",
    )
    passed += 1
    await expectFailure(
      () => parseCommand(["official", "--manifest", "synthetic.json"]),
      "dna_locked_eval_cli_invalid",
      "dna_locked_eval_test_caller_manifest_override_failed",
    )
    passed += 1
    await expectFailure(
      () => parseCommand(["official", "--adapter", "synthetic.json"]),
      "dna_locked_eval_cli_invalid",
      "dna_locked_eval_test_caller_adapter_override_failed",
    )
    passed += 1
    await expectFailure(
      () => parseCommand(["official", "--output", "synthetic.json"]),
      "dna_locked_eval_cli_invalid",
      "dna_locked_eval_test_caller_output_override_failed",
    )
    passed += 1
    const baseClosureHash = evaluationCodeClosureSha256(
      Buffer.from("synthetic harness", "utf8"),
      Buffer.from("synthetic core", "utf8"),
    )
    if (baseClosureHash === evaluationCodeClosureSha256(
      Buffer.from("synthetic harness changed", "utf8"),
      Buffer.from("synthetic core", "utf8"),
    ) || baseClosureHash === evaluationCodeClosureSha256(
      Buffer.from("synthetic harness", "utf8"),
      Buffer.from("synthetic core changed", "utf8"),
    )) fail("dna_locked_eval_test_evaluation_closure_hash_failed")
    passed += 1

    await expectFailure(
      () => assertFrozenAdapter({ ...adapter, adapterSha256: "0".repeat(64) }),
      "dna_adapter_hash_mismatch",
      "dna_locked_eval_test_forgery_failed",
    )
    passed += 1
    await expectFailure(
      () => createFrozenAdapter({
        adapterId: "synthetic-bad-input",
        frozenAt: "2026-07-24T00:00:00.000Z",
        candidatePackageSha256: "1".repeat(64),
        developmentQaEvaluationSha256: "2".repeat(64),
        evaluatorModule: evaluatorRelative,
        codeSha256: sha256(evaluatorBytes),
        config,
        tuningInputAllowlist: [
          { id: "development", kind: "development_qa", location: "research_ssd", relativePath: "Datasets/DNA-Intelligence/evaluation/hidden.json", sha256: "4".repeat(64) },
          { id: "config", kind: "adapter_config", location: "repo", relativePath: "synthetic/config.json", sha256: "5".repeat(64) },
        ],
        forbiddenInputPaths: ["Datasets/DNA-Intelligence/evaluation"],
      }),
      "dna_adapter_locked_tuning_input_forbidden",
      "dna_locked_eval_test_allowlist_failed",
    )
    passed += 1
    await expectFailure(
      () => assertEvaluatorModuleRelativePath("../synthetic-evaluator.mjs"),
      "dna_adapter_evaluator_module_invalid",
      "dna_locked_eval_test_module_traversal_failed",
    )
    passed += 1
    await expectFailure(
      () => assertPureEvaluatorSource("export function routeFrozenAdapter(adapter, question) { return fetch(question) }"),
      "dna_adapter_evaluator_impure_or_forbidden_source",
      "dna_locked_eval_test_pure_scanner_failed",
    )
    passed += 1

    const adapterPath = join(ssdSandbox, "adapter.json")
    atomicWriteNew(ssdRoot, adapterPath, `${JSON.stringify(adapter, null, 2)}\n`)
    const adapterAuthority = loadAdapter(
      repositoryRoot,
      ssdRoot,
      relative(ssdRoot, adapterPath).split(sep).join("/"),
    )
    writeFileSync(evaluatorPath, `${evaluatorSource}\n`, { mode: 0o600 })
    await expectFailure(
      () => loadAdapter(repositoryRoot, ssdRoot, relative(ssdRoot, adapterPath).split(sep).join("/")),
      "dna_adapter_code_drift",
      "dna_locked_eval_test_code_drift_failed",
    )
    writeFileSync(evaluatorPath, evaluatorSource, { mode: 0o600 })
    passed += 1

    const evaluatorLink = join(evaluatorDirectory, "linked-evaluator.mjs")
    symlinkSync(evaluatorPath, evaluatorLink)
    const linkedAdapterPayload = { ...adapter, evaluatorModule: relative(repositoryRoot, evaluatorLink).split(sep).join("/") }
    const { adapterSha256: ignoredLinkedHash, ...linkedPayload } = linkedAdapterPayload
    const linkedAdapter = { ...linkedPayload, adapterSha256: stableSha256(linkedPayload) }
    const linkedAdapterPath = join(ssdSandbox, "linked-adapter.json")
    atomicWriteNew(ssdRoot, linkedAdapterPath, `${JSON.stringify(linkedAdapter, null, 2)}\n`)
    await expectFailure(
      () => loadAdapter(repositoryRoot, ssdRoot, relative(ssdRoot, linkedAdapterPath).split(sep).join("/")),
      "dna_locked_eval_evaluator_symlink_forbidden",
      "dna_locked_eval_test_module_symlink_failed",
    )
    rmSync(evaluatorLink, { force: true })
    passed += 1

    const artifact = syntheticArtifact(config)
    const artifactPath = join(ssdSandbox, "synthetic-artifact.json")
    const artifactSerialized = `${JSON.stringify(artifact, null, 2)}\n`
    atomicWriteNew(ssdRoot, artifactPath, artifactSerialized)
    const manifest = {
      schemaVersion: "dna-internal-locked-turkish-holdout-manifest@1",
      label: INTERNAL_VALIDATION_LABEL,
      artifact: {
        researchSsdRelativePath: relative(ssdRoot, artifactPath).split(sep).join("/"),
        sha256: sha256(Buffer.from(artifactSerialized, "utf8")),
        byteCount: Buffer.byteLength(artifactSerialized, "utf8"),
      },
      authorities: {
        candidatePackageResearchSsdRelativePath: "Datasets/synthetic/candidate.json",
        candidatePackageSha256: "1".repeat(64),
        developmentLedgerResearchSsdRelativePath: "Datasets/synthetic/ledger.json",
        developmentLedgerSha256: "2".repeat(64),
        prebookDraftResearchSsdRelativePath: "Datasets/synthetic/draft.json",
        prebookDraftSha256: "3".repeat(64),
      },
      counts: {
        total: artifact.items.length,
        topics: 14,
        answerable: 15,
        clarification: 1,
        unsupported: 1,
      },
      splits: {
        natural_supported: 14,
        hard_neighbor: 0,
        ambiguous: 1,
        unsupported: 1,
        safe_theory_control: 1,
      },
      privacyBoundary: {
        fullQuestionAnswerPayloadInRepository: false,
        visibleToAdapterTuning: false,
        fullPayloadStoredOnlyOnResearchSsd: true,
        runtimeEligible: false,
        releaseEligible: false,
        independentHumanValidation: false,
      },
      validation: {
        exactOverlap: 0,
        normalizedOverlap: 0,
        semanticFamilyOverlap: 0,
        nearDuplicateOverlap: 0,
        deterministicRepeats: 20,
        uniqueGenerationHashes: 1,
        tamperFailClosed: true,
        hashTamperFailClosed: true,
        byteTamperFailClosed: true,
        manifestDriftFailClosed: true,
        parentSymlinkEscapeFailClosed: true,
        leafSymlinkFailClosed: true,
        modeTamperFailClosed: true,
        artifactMode: "0600",
        atomicWriteFsyncRenameReadback: true,
        ssdFallbackAllowed: false,
      },
    }
    const badManifest = { ...manifest, artifact: { ...manifest.artifact, sha256: "0".repeat(64) } }
    await expectFailure(
      () => loadSealedArtifact(ssdRoot, badManifest),
      "dna_locked_eval_holdout_hash_mismatch",
      "dna_locked_eval_test_holdout_mismatch_failed",
    )
    passed += 1

    chmodSync(artifactPath, 0o644)
    await expectFailure(
      () => loadSealedArtifact(ssdRoot, manifest),
      "dna_locked_eval_artifact_mode_mismatch",
      "dna_locked_eval_test_mode_failed",
    )
    chmodSync(artifactPath, 0o600)
    passed += 1

    const leafLink = join(ssdSandbox, "artifact-link.json")
    symlinkSync(artifactPath, leafLink)
    const linkManifest = {
      ...manifest,
      artifact: {
        ...manifest.artifact,
        researchSsdRelativePath: relative(ssdRoot, leafLink).split(sep).join("/"),
      },
    }
    await expectFailure(
      () => loadSealedArtifact(ssdRoot, linkManifest),
      "dna_locked_eval_artifact_symlink_forbidden",
      "dna_locked_eval_test_leaf_symlink_failed",
    )
    passed += 1

    const parentLink = join(ssdSandbox, "parent-link")
    symlinkSync(repositoryRoot, parentLink)
    const parentManifest = {
      ...manifest,
      artifact: {
        ...manifest.artifact,
        researchSsdRelativePath: `${relative(ssdRoot, parentLink).split(sep).join("/")}/package.json`,
      },
    }
    await expectFailure(
      () => loadSealedArtifact(ssdRoot, parentManifest),
      "dna_locked_eval_artifact_symlink_forbidden",
      "dna_locked_eval_test_parent_symlink_failed",
    )
    passed += 1
    await expectFailure(
      () => atomicWriteNew(
        ssdRoot,
        join(parentLink, "synthetic-result.json"),
        "{}\n",
      ),
      "dna_locked_eval_secure_parent_symlink_forbidden",
      "dna_locked_eval_test_atomic_writer_parent_symlink_failed",
    )
    passed += 1
    await expectFailure(
      () => acquireClaim(
        ssdRoot,
        join(parentLink, "synthetic-claim.json"),
        join(parentLink, "synthetic-result.json"),
        {
          adapterSha256: adapter.adapterSha256,
          holdoutSha256: manifest.artifact.sha256,
        },
      ),
      "dna_locked_eval_secure_parent_symlink_forbidden",
      "dna_locked_eval_test_claim_writer_parent_symlink_failed",
    )
    passed += 1

    const occupied = join(ssdSandbox, "occupied-result.json")
    writeFileSync(occupied, "{}\n", { mode: 0o600 })
    await expectFailure(
      () => acquireClaim(ssdRoot, join(ssdSandbox, "occupied-claim.json"), occupied, {
        adapterSha256: adapter.adapterSha256,
        holdoutSha256: manifest.artifact.sha256,
      }),
      "dna_locked_eval_output_exists",
      "dna_locked_eval_test_output_exists_failed",
    )
    passed += 1

    await expectFailure(
      () => callEvaluatorWithoutOutput(() => {
        process.stdout.write("forbidden")
        return { decision: "abstain", topicId: null }
      }, adapter, "synthetic"),
      "dna_locked_eval_evaluator_output_forbidden",
      "dna_locked_eval_test_output_capture_failed",
    )
    passed += 1

    const syntheticRoute = await importEvaluator(evaluatorPath, sha256(evaluatorBytes))
    const routingDiagnostic = await evaluate(syntheticRoute, adapterAuthority.adapter, {
      items: [{
        id: "synthetic.safe.wrong-topic",
        split: "safe_theory_control",
        question: config.topics[0].positivePhrases[0],
        expectedTopic: config.topics[1].topicId,
        answerability: "answerable",
      }],
    })
    if (routingDiagnostic.metrics.safetyNonRefusalAccuracy !== 1
      || routingDiagnostic.metrics.safeTheoryRoutingAccuracy !== 0) {
      fail("dna_locked_eval_test_safe_metric_separation_failed")
    }
    passed += 1

    const mutatingEvaluatorPath = join(evaluatorDirectory, "mutating-evaluator.mjs")
    const mutatingEvaluatorRelative = relative(repositoryRoot, mutatingEvaluatorPath)
      .split(sep).join("/")
    const mutatingEvaluatorSource = `export function routeFrozenAdapter(adapter, question) {
  adapter.thresholds.answerMinimum = question.length
  return { decision: "abstain", topicId: null }
}\n`
    writeFileSync(mutatingEvaluatorPath, mutatingEvaluatorSource, { mode: 0o600 })
    assertPureEvaluatorSource(mutatingEvaluatorSource)
    const mutatingEvaluatorBytes = readFileSync(mutatingEvaluatorPath)
    const mutatingAdapter = createFrozenAdapter({
      adapterId: "synthetic-mutating-adapter",
      frozenAt: "2026-07-24T00:00:00.000Z",
      candidatePackageSha256: "1".repeat(64),
      developmentQaEvaluationSha256: "2".repeat(64),
      evaluatorModule: mutatingEvaluatorRelative,
      codeSha256: sha256(mutatingEvaluatorBytes),
      config,
      tuningInputAllowlist: [
        { id: "candidate", kind: "candidate_package", location: "research_ssd", relativePath: "Datasets/synthetic/candidate.json", sha256: "3".repeat(64) },
        { id: "development", kind: "development_qa", location: "research_ssd", relativePath: "Outputs/synthetic/development.json", sha256: "4".repeat(64) },
        { id: "config", kind: "adapter_config", location: "repo", relativePath: "synthetic/config.json", sha256: "5".repeat(64) },
      ],
      forbiddenInputPaths: ["Datasets/DNA-Intelligence/evaluation"],
    })
    deepFreeze(mutatingAdapter)
    const failedOutput = join(ssdSandbox, "mutation-failed-result.json")
    const failedClaim = join(ssdSandbox, "mutation-failed.claim.json")
    await expectFailure(
      () => runOneShot({
        repositoryRoot,
        ssdRoot,
        manifest,
        adapterAuthority: {
          adapter: mutatingAdapter,
          evaluatorPath: mutatingEvaluatorPath,
          evaluatorBytes: mutatingEvaluatorBytes,
        },
        developmentManifestSha256: "9".repeat(64),
        outputPath: failedOutput,
        claimPath: failedClaim,
        synthetic: true,
      }),
      "dna_locked_eval_evaluator_mutation_forbidden",
      "dna_locked_eval_test_mutation_guard_failed",
    )
    if (lstatOptional(failedOutput) || !lstatOptional(failedClaim)) {
      fail("dna_locked_eval_test_claimed_failure_boundary_failed")
    }
    const failedClaimText = readFileSync(failedClaim, "utf8")
    const failedClaimValue = assertClaim(JSON.parse(failedClaimText))
    if (failedClaimValue.failureStateIfResultAbsent !== "claimed_failed_no_rerun"
      || (failedClaimText.match(/"claimedAt"/g) || []).length !== 1) {
      fail("dna_locked_eval_test_claimed_failure_state_failed")
    }
    passed += 1
    await expectFailure(
      () => runOneShot({
        repositoryRoot,
        ssdRoot,
        manifest,
        adapterAuthority: {
          adapter: mutatingAdapter,
          evaluatorPath: mutatingEvaluatorPath,
          evaluatorBytes: mutatingEvaluatorBytes,
        },
        developmentManifestSha256: "9".repeat(64),
        outputPath: failedOutput,
        claimPath: failedClaim,
        synthetic: true,
      }),
      "dna_locked_eval_rerun_forbidden",
      "dna_locked_eval_test_claimed_failure_rerun_failed",
    )
    passed += 1

    const successfulOutput = join(ssdSandbox, "official-first-run-result.json")
    const successfulClaim = join(ssdSandbox, "official-first-run.claim.json")
    const successful = await runOneShot({
      repositoryRoot,
      ssdRoot,
      manifest,
      adapterAuthority,
      developmentManifestSha256: "a".repeat(64),
      outputPath: successfulOutput,
      claimPath: successfulClaim,
      synthetic: true,
    })
    if (successful.result.metrics.determinism.repeats !== 20
      || successful.result.metrics.determinism.uniqueHashes !== 1
      || (lstatSync(successfulOutput).mode & 0o777) !== 0o600) {
      fail("dna_locked_eval_test_success_contract_failed")
    }
    passed += 1
    await expectFailure(
      () => runOneShot({
        repositoryRoot,
        ssdRoot,
        manifest,
        adapterAuthority,
        developmentManifestSha256: "a".repeat(64),
        outputPath: successfulOutput,
        claimPath: successfulClaim,
        synthetic: true,
      }),
      "dna_locked_eval_output_exists",
      "dna_locked_eval_test_rerun_failed",
    )
    passed += 1

    const storedResult = readJson(successfulOutput, "dna_locked_eval_test_result_invalid")
    assertResult(storedResult)
    const forgedResult = { ...storedResult, resultSha256: "0".repeat(64) }
    await expectFailure(
      () => assertResult(forgedResult),
      "dna_locked_eval_result_integrity_mismatch",
      "dna_locked_eval_test_result_tamper_failed",
    )
    passed += 1
    return { ok: true, tests: passed, deterministicRepeats: 20, realHoldoutOpened: false }
  } finally {
    rmSync(evaluatorDirectory, { recursive: true, force: true })
    rmSync(ssdSandbox, { recursive: true, force: true })
  }
}

try {
  const command = parseCommand(process.argv.slice(2))
  const result = command === "official" ? await official() : await test()
  process.stdout.write(`${JSON.stringify(result)}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "dna_locked_eval_unknown_error"}\n`)
  process.exitCode = 1
}
