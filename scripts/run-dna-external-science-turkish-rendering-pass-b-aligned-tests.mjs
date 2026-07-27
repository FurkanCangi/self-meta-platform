#!/usr/bin/env node

import assert from "node:assert/strict"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

import {
  ARTIFACT_PATH,
  PROVENANCE,
  REPO_MANIFEST,
  buildArtifact,
  buildManifest,
  loadInputs,
  secureAtomicWrite,
  stableSha256,
} from "./dna-external-science-turkish-rendering-pass-b-aligned.mjs"

function clone(value) {
  return structuredClone(value)
}

function omit(value, key) {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function resealAuthoring(inputs) {
  inputs.authoring.authoringSha256 = stableSha256(omit(inputs.authoring, "authoringSha256"))
  return inputs
}

function expectFailure(label, expression, operation) {
  let error
  try { operation() } catch (caught) { error = caught }
  assert(error instanceof Error, `aligned_b_negative_did_not_fail:${label}`)
  assert.match(error.message, expression, `aligned_b_negative_wrong_error:${label}`)
}

const root = realpathSync(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD")
assert(root === "/Volumes/ResearchSSD" || root.startsWith("/Volumes/ResearchSSD/"))
const inputs = loadInputs(root)
const artifact = buildArtifact(inputs)

assert.equal(artifact.schemaVersion, "dna-external-science-turkish-rendering-pass-b-aligned@1")
assert.equal(artifact.provenance, PROVENANCE)
assert.deepEqual(artifact.counts, {
  topics: 14,
  sources: 14,
  renderings: 42,
  start: 14,
  middle: 14,
  end: 14,
  fidelityPassed: 42,
})
assert.equal(artifact.runtimeEligible, false)
assert.equal(artifact.releaseEligible, false)
assert.equal(artifact.activationAllowed, false)

const deterministic = Array.from({ length: 20 }, () => buildArtifact(inputs).artifactSha256)
assert.equal(new Set(deterministic).size, 1)
assert.equal(deterministic[0], artifact.artifactSha256)

const numberTamper = clone(inputs)
const numbered = numberTamper.authoring.renderings.find((entry) => entry.turkishRendering.includes("N = 33"))
assert(numbered)
numbered.turkishRendering = numbered.turkishRendering.replace("N = 33", "N = 34")
resealAuthoring(numberTamper)
expectFailure("number", /numbers_changed/, () => buildArtifact(numberTamper))

const negationTamper = clone(inputs)
const negated = negationTamper.authoring.renderings.find((entry) =>
  entry.claimId === "external.claim:91e359b60f920ddf11b98c6c")
assert(negated)
negated.turkishRendering = negated.turkishRendering.replace("oluşturulmamıştır", "oluşturulmuştur")
resealAuthoring(negationTamper)
expectFailure("negation", /negation_lost/, () => buildArtifact(negationTamper))

const causalTamper = clone(inputs)
causalTamper.authoring.renderings[0].turkishRendering += " Bu kesin olarak kanıtlar."
resealAuthoring(causalTamper)
expectFailure("causal", /causal_upgrade/, () => buildArtifact(causalTamper))

const missingTamper = clone(inputs)
missingTamper.authoring.renderings.pop()
resealAuthoring(missingTamper)
expectFailure("missing", /authoring_invalid/, () => buildArtifact(missingTamper))

const duplicateTamper = clone(inputs)
duplicateTamper.authoring.renderings[1].claimId = duplicateTamper.authoring.renderings[0].claimId
resealAuthoring(duplicateTamper)
expectFailure("duplicate", /authoring_invalid/, () => buildArtifact(duplicateTamper))

const selectionTamper = clone(inputs)
selectionTamper.selection.selectionSetSha256 = "0".repeat(64)
expectFailure("selection", /selection_contract_(?:hash_mismatch|boundary_invalid)|selection_invalid/, () =>
  buildArtifact(selectionTamper))

const candidateTamper = clone(inputs)
candidateTamper.candidate.runtimeEligible = true
expectFailure("candidate_authority", /candidate_invalid/, () => buildArtifact(candidateTamper))

const authoringHashTamper = clone(inputs)
authoringHashTamper.authoring.authoringSha256 = "0".repeat(64)
expectFailure("authoring_hash", /authoring_invalid/, () => buildArtifact(authoringHashTamper))

const authoringAuthorityTamper = clone(inputs)
authoringAuthorityTamper.authoring.runtimeEligible = true
resealAuthoring(authoringAuthorityTamper)
expectFailure("authoring_authority", /authoring_shape_invalid/, () =>
  buildArtifact(authoringAuthorityTamper))

const recordAuthorityTamper = clone(inputs)
recordAuthorityTamper.authoring.renderings[0].ownerApproval = true
resealAuthoring(recordAuthorityTamper)
expectFailure("record_authority", /authoring_record_shape_invalid/, () =>
  buildArtifact(recordAuthorityTamper))

const decisionShapeTamper = clone(inputs)
decisionShapeTamper.authoring.renderings[0].decision = { runtimeEligible: true }
resealAuthoring(decisionShapeTamper)
expectFailure("decision_shape", /authoring_record_invalid/, () =>
  buildArtifact(decisionShapeTamper))

const outputPath = join(root, ARTIFACT_PATH)
const recordedBytes = readFileSync(outputPath)
assert.equal(statSync(outputPath).mode & 0o777, 0o600)
assert.equal(recordedBytes.toString("utf8"), `${JSON.stringify(artifact, null, 2)}\n`)

const manifestPath = join(process.cwd(), REPO_MANIFEST)
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const expectedManifest = buildManifest(artifact, {
  rawSha256: manifest.output.rawSha256,
  bytes: manifest.output.byteCount,
})
assert.equal(stableSha256(manifest), stableSha256(expectedManifest))
const serializedManifest = JSON.stringify(manifest)
for (const record of artifact.renderings) {
  assert(!serializedManifest.includes(record.originalProposition))
  assert(!serializedManifest.includes(record.turkishRendering))
  assert(!serializedManifest.includes(record.decision))
}

const sandboxParent = join(root, "Outputs", "SelfMetaAI", "dna-intelligence", "test-sandboxes")
mkdirSync(sandboxParent, { recursive: true, mode: 0o700 })
const sandbox = mkdtempSync(join(sandboxParent, "aligned-b-"))
try {
  const target = join(sandbox, "nested", "result.json")
  const content = Buffer.from("aligned-b-secure-fixture\n")
  const writes = Array.from({ length: 20 }, () => secureAtomicWrite(sandbox, target, content))
  assert.equal(new Set(writes.map((entry) => entry.rawSha256)).size, 1)
  assert.equal(statSync(target).mode & 0o777, 0o600)

  const escaped = join(sandbox, "..", "escaped.json")
  expectFailure("path_escape", /output_escape/, () => secureAtomicWrite(sandbox, escaped, content))

  const leafDestination = join(sandbox, "leaf-destination.json")
  const leaf = join(sandbox, "leaf.json")
  writeFileSync(leafDestination, "destination\n", { mode: 0o600 })
  symlinkSync(leafDestination, leaf)
  expectFailure("leaf_symlink", /output_symlink_forbidden/, () =>
    secureAtomicWrite(sandbox, leaf, content))

  const outside = mkdtempSync(join(sandboxParent, "aligned-b-outside-"))
  try {
    const parentLink = join(sandbox, "parent-link")
    symlinkSync(outside, parentLink)
    expectFailure("parent_symlink", /output_parent_invalid/, () =>
      secureAtomicWrite(sandbox, join(parentLink, "result.json"), content))
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }

  chmodSync(target, 0o644)
  assert.equal(statSync(target).mode & 0o777, 0o644)
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}

assert(readFileSync(outputPath).equals(recordedBytes), "aligned_b_test_mutated_real_artifact")

process.stdout.write(`${JSON.stringify({
  ok: true,
  counts: artifact.counts,
  deterministicRepeats: deterministic.length,
  uniqueArtifactHashes: new Set(deterministic).size,
  negativeFidelityAndBindingCases: 11,
  secureWriteRepeats: 20,
  securePathCases: 3,
  manifestTextLeakCount: 0,
  artifactSha256: artifact.artifactSha256,
}, null, 2)}\n`)
