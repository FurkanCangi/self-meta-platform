#!/usr/bin/env node

import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join, resolve } from "node:path"

import {
  ARTIFACT_RELATIVE_PATH,
  AUTHORING_INPUT_RELATIVE_PATH,
  REPO_MANIFEST_RELATIVE_PATH,
  WORKPACK_RELATIVE_PATH,
  assertManifestSafe,
  assertSecurePath,
  buildArtifact,
  bytesSha256,
  execute,
  loadInputs,
  resolveSsdRoot,
  secureAtomicWrite,
  stableSha256,
} from "./dna-external-science-turkish-pass-b-remaining-authoring.mjs"

function expectFailure(label, pattern, operation) {
  let error
  try {
    operation()
  } catch (caught) {
    error = caught
  }
  assert(error instanceof Error, `pass_b_remaining_negative_did_not_fail:${label}`)
  assert.match(error.message, pattern, `pass_b_remaining_negative_wrong_error:${label}`)
}

function fileSha(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function clone(value) {
  return structuredClone(value)
}

const repoRoot = process.cwd()
const root = resolveSsdRoot()
const protectedPaths = [WORKPACK_RELATIVE_PATH, AUTHORING_INPUT_RELATIVE_PATH]
const protectedBefore = Object.fromEntries(protectedPaths.map((relativePath) => {
  const path = join(root, relativePath)
  assert.equal(lstatSync(path).isSymbolicLink(), false)
  assert.equal(statSync(path).mode & 0o777, 0o600)
  return [relativePath, fileSha(path)]
}))

const inputs = loadInputs(root)
const artifact = buildArtifact(inputs)
assert.equal(artifact.status, "pass_b_remaining_178_candidate_only")
assert.equal(artifact.records.length, 178)
assert.equal(artifact.counts.workItems, 178)
assert.equal(artifact.counts.renderings, 178)
assert.equal(artifact.counts.fidelityPassed, 178)
assert.equal(artifact.counts.uniqueWorkItems, 178)
assert.equal(artifact.counts.uniqueClaims, 178)
assert.equal(artifact.counts.topics, 14)
assert.equal(artifact.counts.sources, 14)
assert.equal(artifact.counts.passages, 140)
assert.equal(artifact.counts.duplicateWorkItems, 0)
assert.equal(artifact.counts.missingWorkItems, 0)
assert.equal(artifact.counts.extraWorkItems, 0)
assert.equal(artifact.runtimeEligible, false)
assert.equal(artifact.releaseEligible, false)
assert.equal(artifact.activationAllowed, false)
assert.equal(artifact.ownerAuthority, false)
assert.equal(artifact.independentHuman, false)
assert.equal(artifact.independentHumanReview, false)
assert.equal(artifact.boundaries.candidateOnly, true)
assert.equal(artifact.boundaries.translationPerformed, true)
assert.equal(artifact.boundaries.reconciliationPerformed, false)
assert.equal(artifact.blindContract.passBWorkpackOnly, true)
assert.equal(artifact.blindContract.passAAccessed, false)
assert.equal(artifact.blindContract.alignedPassBAccessed, false)
assert.equal(artifact.blindContract.reconciliationAccessed, false)
assert.equal(artifact.blindContract.lockedHoldoutOrResultAccessed, false)

const expectedRecordKeys = [
  "activationAllowed", "answerUnitId", "bindings", "claimId", "fidelityBoundary", "fidelityNote",
  "independentHuman", "independentHumanReview", "ownerAuthority", "passageId", "recordSha256", "releaseEligible",
  "runtimeEligible", "sourceId", "status", "topicId", "turkishRendering", "workItemId",
].sort()
const expectedBindingKeys = [
  "answerUnitSha256", "candidateFileSha256", "candidatePackageSha256", "claimSha256",
  "passageContentSha256", "passageSha256", "propositionSha256", "sourceArtifactSha256",
  "sourceSha256", "topicSha256", "turkishRenderingSha256", "workItemSha256", "workpackSha256",
].sort()
const expectedBoundaryKeys = [
  "ageScope", "causalStatus", "dnaProductRelation", "evidenceLevel", "evidenceType",
  "maximumGraphHops", "multiStepMechanismAllowed", "passageAgeScope", "publicationStatus",
  "relationClass",
].sort()
const workById = new Map(inputs.workpack.workItems.map((item) => [item.id, item]))
for (const record of artifact.records) {
  assert.deepEqual(Object.keys(record).sort(), expectedRecordKeys)
  assert.deepEqual(Object.keys(record.bindings).sort(), expectedBindingKeys)
  assert.deepEqual(Object.keys(record.fidelityBoundary).sort(), expectedBoundaryKeys)
  const item = workById.get(record.workItemId)
  assert(item)
  assert.equal(record.claimId, item.claimId)
  assert.equal(record.topicId, item.topicId)
  assert.equal(record.sourceId, item.sourceId)
  assert.equal(record.passageId, item.passageId)
  assert.equal(record.answerUnitId, item.answerUnitId)
  assert.equal(record.bindings.workpackSha256, inputs.workpack.workpackSha256)
  assert.equal(record.bindings.workItemSha256, item.workItemSha256)
  assert.equal(record.bindings.candidatePackageSha256, item.hashes.candidatePackageSha256)
  assert.equal(record.bindings.candidateFileSha256, item.hashes.candidateFileSha256)
  assert.equal(record.bindings.topicSha256, item.hashes.topicSha256)
  assert.equal(record.bindings.sourceSha256, item.hashes.sourceSha256)
  assert.equal(record.bindings.sourceArtifactSha256, item.hashes.sourceArtifactSha256)
  assert.equal(record.bindings.passageSha256, item.hashes.passageSha256)
  assert.equal(record.bindings.passageContentSha256, item.hashes.passageContentSha256)
  assert.equal(record.bindings.claimSha256, item.hashes.claimSha256)
  assert.equal(record.bindings.propositionSha256, item.hashes.propositionSha256)
  assert.equal(record.bindings.answerUnitSha256, item.hashes.answerUnitSha256)
  assert.equal(record.bindings.turkishRenderingSha256, bytesSha256(record.turkishRendering))
  assert.equal(record.fidelityBoundary.ageScope, item.boundaries.ageScope)
  assert.equal(record.fidelityBoundary.passageAgeScope, item.boundaries.passageAgeScope)
  assert.equal(record.fidelityBoundary.causalStatus, item.boundaries.causalStatus)
  assert.equal(record.fidelityBoundary.evidenceLevel, item.boundaries.evidenceLevel)
  assert.equal(record.fidelityBoundary.evidenceType, item.boundaries.evidenceType)
  assert.equal(record.fidelityBoundary.dnaProductRelation, "not_established")
  assert.equal(record.fidelityBoundary.maximumGraphHops, 1)
  assert.equal(record.fidelityBoundary.multiStepMechanismAllowed, false)
  assert.equal(record.independentHuman, false)
  assert.equal(record.independentHumanReview, false)
  const sealed = { ...record }
  delete sealed.recordSha256
  assert.equal(stableSha256(sealed), record.recordSha256)
}

const deterministicHashes = Array.from({ length: 20 }, () => buildArtifact(inputs).artifactSha256)
assert.equal(new Set(deterministicHashes).size, 1)
assert.equal(deterministicHashes[0], artifact.artifactSha256)

const verified = execute("verify", { root, repoRoot })
assert.equal(verified.artifact.artifactSha256, artifact.artifactSha256)
assert.equal(verified.manifest.counts.renderings, 178)
assert.equal(verified.manifest.counts.fidelityPassed, 178)
assert.equal(verified.manifest.runtimeEligible, false)
assert.equal(verified.manifest.releaseEligible, false)
assert.equal(verified.manifest.activationAllowed, false)
assert.equal(verified.manifest.ownerAuthority, false)
assert.equal(verified.manifest.independentHuman, false)
assert.equal(verified.manifest.independentHumanReview, false)
assertManifestSafe(verified.manifest, inputs, artifact)

const artifactPath = join(root, ARTIFACT_RELATIVE_PATH)
assert.equal(lstatSync(artifactPath).isSymbolicLink(), false)
assert.equal(statSync(artifactPath).mode & 0o777, 0o600)
const artifactBytes = readFileSync(artifactPath)
assert.equal(bytesSha256(artifactBytes), verified.output.rawSha256)
const recordedArtifact = JSON.parse(artifactBytes.toString("utf8"))
assert.equal(stableSha256(recordedArtifact), stableSha256(artifact))

const manifestPath = join(repoRoot, REPO_MANIFEST_RELATIVE_PATH)
const manifestText = readFileSync(manifestPath, "utf8")
assert(!/turkishRendering|fidelityNote|proposition|passageText|workItemId|claimId|sourceId|passageId/.test(manifestText))
for (const item of inputs.workpack.workItems) {
  assert(!manifestText.includes(item.id))
  assert(!manifestText.includes(item.claimId))
  assert(!manifestText.includes(item.original.proposition))
  assert(!manifestText.includes(item.original.passageText))
}
for (const record of artifact.records) assert(!manifestText.includes(record.turkishRendering))

const workpackTamper = clone(inputs)
workpackTamper.workpack.workItems[0].original.proposition += " tamper"
expectFailure("workpack_text_tamper", /workpack_hash|work_item_hash|text_hash/, () =>
  buildArtifact(workpackTamper))

const workItemHashTamper = clone(inputs)
workItemHashTamper.workpack.workItems[0].workItemSha256 = "0".repeat(64)
expectFailure("work_item_hash_tamper", /workpack_hash|work_item_hash/, () =>
  buildArtifact(workItemHashTamper))

const missing = clone(inputs)
missing.authoring.renderings.pop()
expectFailure("authoring_missing", /authoring_count|authoring_missing/, () => buildArtifact(missing))

const duplicate = clone(inputs)
duplicate.authoring.renderings[1].workItemId = duplicate.authoring.renderings[0].workItemId
expectFailure("authoring_duplicate", /authoring_duplicate|authoring_missing/, () => buildArtifact(duplicate))

const numericDrift = clone(inputs)
numericDrift.authoring.renderings[0].turkishRendering =
  numericDrift.authoring.renderings[0].turkishRendering.replace("%60", "%61")
expectFailure("numeric_drift", /numeric_drift/, () => buildArtifact(numericDrift))

const hedgeLoss = clone(inputs)
const hedgeRecord = hedgeLoss.authoring.renderings.find((entry) =>
  entry.workItemId === "blind-b:7fc052da0fe58e630c86f0e0769a857b")
hedgeRecord.turkishRendering = hedgeRecord.turkishRendering.replace("mümkündür", "kesindir")
expectFailure("hedge_loss", /hedge_lost/, () => buildArtifact(hedgeLoss))

const negationLoss = clone(inputs)
const negationRecord = negationLoss.authoring.renderings.find((entry) =>
  entry.workItemId === "blind-b:40507de143fb4b730f7088802ccf3ddb")
negationRecord.turkishRendering = negationRecord.turkishRendering.replace("kabul edilemez", "kabul edilir")
expectFailure("negation_loss", /negation_lost/, () => buildArtifact(negationLoss))

const personalExpansion = clone(inputs)
personalExpansion.authoring.renderings[0].turkishRendering += " Sizin DNA profiliniz için geçerlidir."
expectFailure("personal_product_expansion", /personal_or_product_expansion/, () =>
  buildArtifact(personalExpansion))

const sandboxParent = join(root, "Outputs", "SelfMetaAI", "dna-intelligence", "test-sandboxes")
mkdirSync(sandboxParent, { recursive: true, mode: 0o700 })
const sandbox = mkdtempSync(join(sandboxParent, "pass-b-remaining-"))
try {
  const content = Buffer.from("pass-b-remaining-secure-fixture\n", "utf8")
  const target = join(sandbox, "nested", "artifact.json")
  const writes = Array.from({ length: 20 }, () => secureAtomicWrite(sandbox, target, content))
  assert.equal(new Set(writes.map((entry) => entry.rawSha256)).size, 1)
  assert.equal(statSync(target).mode & 0o777, 0o600)

  expectFailure("path_escape", /output_escape/, () =>
    secureAtomicWrite(sandbox, join(sandbox, "..", "escaped.json"), content))

  const leafDestination = join(sandbox, "leaf-destination.json")
  const leafLink = join(sandbox, "leaf-link.json")
  writeFileSync(leafDestination, "destination\n", { mode: 0o600 })
  symlinkSync(leafDestination, leafLink)
  expectFailure("leaf_symlink", /output_leaf_invalid/, () => secureAtomicWrite(sandbox, leafLink, content))
  expectFailure("input_symlink", /symlink_forbidden/, () => assertSecurePath(sandbox, leafLink))

  const outside = mkdtempSync(join(sandboxParent, "pass-b-remaining-outside-"))
  try {
    const parentLink = join(sandbox, "parent-link")
    symlinkSync(outside, parentLink)
    expectFailure("parent_symlink", /output_parent_invalid/, () =>
      secureAtomicWrite(sandbox, join(parentLink, "artifact.json"), content))
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }

  chmodSync(target, 0o644)
  expectFailure("mode", /mode_invalid/, () => assertSecurePath(sandbox, target, { mode0600: true }))
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}

const localFallback = mkdtempSync("/tmp/dna-pass-b-remaining-")
try {
  expectFailure("local_fallback", /local_fallback_forbidden/, () => resolveSsdRoot(localFallback))
} finally {
  rmSync(localFallback, { recursive: true, force: true })
}

const newRepoFiles = [
  "scripts/dna-external-science-turkish-pass-b-remaining-authoring.mjs",
  "scripts/run-dna-external-science-turkish-pass-b-remaining-authoring-tests.mjs",
  "docs/dna-intelligence/governance/v3/external-science-turkish-pass-b-remaining-authoring.md",
  REPO_MANIFEST_RELATIVE_PATH,
]
const repoAggregate = newRepoFiles.map((relativePath) => readFileSync(join(repoRoot, relativePath), "utf8")).join("\n")
for (const record of artifact.records) assert(!repoAggregate.includes(record.turkishRendering))
for (const item of inputs.workpack.workItems) {
  assert(!repoAggregate.includes(item.original.proposition))
  assert(!repoAggregate.includes(item.original.passageText))
}
const producerSource = readFileSync(resolve(repoRoot,
  "scripts/dna-external-science-turkish-pass-b-remaining-authoring.mjs"), "utf8")
assert(!/from\s+["']node:(?:http|https|net|tls|child_process)["']/.test(producerSource))
assert(!/\bfetch\s*\(/.test(producerSource))
assert(!/openai|anthropic|gemini|ollama/i.test(producerSource))

for (const relativePath of protectedPaths) {
  assert.equal(fileSha(join(root, relativePath)), protectedBefore[relativePath],
    `protected_input_mutated:${relativePath}`)
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  status: artifact.status,
  counts: artifact.counts,
  deterministicRepeats: 20,
  uniqueDeterministicHashes: new Set(deterministicHashes).size,
  tamperCases: 8,
  secureWriteRepeats: 20,
  securePathCases: 6,
  repositoryTextLeakCount: 0,
  workpackRawSha256: inputs.workpackRawSha256,
  workpackSha256: inputs.workpack.workpackSha256,
  authoringInputRawSha256: inputs.authoringRawSha256,
  artifactSha256: artifact.artifactSha256,
  artifactRawSha256: verified.output.rawSha256,
  recordsSha256: verified.manifest.outputHashes.recordsSha256,
  manifestSha256: verified.manifest.manifestSha256,
  runtimeEligible: false,
  releaseEligible: false,
  activationAllowed: false,
  ownerAuthority: false,
  independentHuman: false,
  independentHumanReview: false,
}, null, 2)}\n`)
