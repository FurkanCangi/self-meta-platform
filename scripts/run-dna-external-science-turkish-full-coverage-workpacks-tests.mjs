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
  INDEX_RELATIVE_PATH,
  PASS_A_RELATIVE_PATH,
  PASS_B_RELATIVE_PATH,
  REPO_MANIFEST_RELATIVE_PATH,
  assertManifestSafe,
  buildIndex,
  buildWorkpack,
  bytesSha256,
  execute,
  loadInputs,
  resolveSsdRoot,
  secureAtomicWrite,
  stableSha256,
} from "./dna-external-science-turkish-full-coverage-workpacks.mjs"

function expectFailure(label, pattern, operation) {
  let error
  try {
    operation()
  } catch (caught) {
    error = caught
  }
  assert(error instanceof Error, `full_coverage_negative_did_not_fail:${label}`)
  assert.match(error.message, pattern, `full_coverage_negative_wrong_error:${label}`)
}

function fileSha(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function clone(value) {
  return structuredClone(value)
}

const repoRoot = process.cwd()
const root = resolveSsdRoot()
const protectedArtifacts = [
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-neutral-selection/feasibility-v1/selection-contract.json",
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-a/feasibility-v1/pass-a-artifact.json",
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b-aligned/feasibility-v1/rendering-artifact.json",
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-reconciliation/feasibility-v1/reconciliation-artifact.json",
]
const protectedBefore = Object.fromEntries(protectedArtifacts.map((relativePath) => {
  const path = join(root, relativePath)
  assert.equal(statSync(path).mode & 0o777, 0o600)
  return [relativePath, fileSha(path)]
}))

const inputs = loadInputs(root, repoRoot)
const passA = buildWorkpack(inputs, "A")
const passB = buildWorkpack(inputs, "B")

assert.equal(passA.workItems.length, 178)
assert.equal(passB.workItems.length, 178)
assert.equal(passA.counts.candidateClaims, 220)
assert.equal(passA.counts.preservedReconciledClaims, 42)
assert.equal(passA.counts.remainingClaims, 178)
assert.equal(passA.counts.topics, 14)
assert.equal(passA.counts.sources, 14)
assert.equal(passA.runtimeEligible, false)
assert.equal(passA.releaseEligible, false)
assert.equal(passA.activationAllowed, false)
assert.equal(passA.ownerAuthority, false)
assert.equal(passB.runtimeEligible, false)
assert.equal(passB.releaseEligible, false)
assert.equal(passB.activationAllowed, false)
assert.equal(passB.ownerAuthority, false)

const preserved = new Set(inputs.selection.selections.map((entry) => entry.claimId))
const candidateIds = new Set(inputs.candidate.claims.map((entry) => entry.id))
const passAClaims = new Set(passA.workItems.map((entry) => entry.claimId))
const passBClaims = new Set(passB.workItems.map((entry) => entry.claimId))
const passAItemIds = new Set(passA.workItems.map((entry) => entry.id))
assert.equal(preserved.size, 42)
assert.equal(passAClaims.size, 178)
assert.equal(passBClaims.size, 178)
assert.deepEqual([...passAClaims].sort(), [...passBClaims].sort())
assert([...passAClaims].every((id) => !preserved.has(id)))
assert.equal(new Set([...preserved, ...passAClaims]).size, 220)
assert([...candidateIds].every((id) => preserved.has(id) || passAClaims.has(id)))
assert(passB.workItems.every((entry) => !passAItemIds.has(entry.id)))
assert.notEqual(passA.workItems.map((entry) => entry.claimId).join("\n"),
  passB.workItems.map((entry) => entry.claimId).join("\n"))

for (const workpack of [passA, passB]) {
  const roundTopics = new Set()
  for (const [index, item] of workpack.workItems.entries()) {
    assert.equal(item.scheduleOrdinal, index + 1)
    assert(!roundTopics.has(`${item.scheduleRound}:${item.topicId}`))
    roundTopics.add(`${item.scheduleRound}:${item.topicId}`)
    assert.equal(item.authoringOutputContract.turkishRenderingPresent, false)
    assert.equal(item.authoringOutputContract.otherPassRenderingVisible, false)
    assert.equal(item.runtimeEligible, false)
    assert.equal(item.releaseEligible, false)
    assert.equal(item.activationAllowed, false)
    assert.equal(item.hashes.candidatePackageSha256, inputs.candidate.packageSha256)
    assert.equal(item.hashes.candidateFileSha256, inputs.candidateRawSha256)
    assert.equal(bytesSha256(item.original.proposition), item.hashes.propositionSha256)
    assert.equal(bytesSha256(item.original.passageText), item.hashes.passageContentSha256)
    const sealed = { ...item }
    delete sealed.workItemSha256
    assert.equal(stableSha256(sealed), item.workItemSha256)
  }
  assert.equal(workpack.workItems.filter((entry) => entry.scheduleRound === 1).length, 14)
  assert.equal(workpack.blindContract.turkishRenderingsIncluded, false)
  assert.equal(workpack.blindContract.reconciliationDecisionsIncluded, false)
  assert.equal(workpack.blindContract.otherPassArtifactPathIncluded, false)
  assert.equal(workpack.blindContract.otherPassArtifactHashIncluded, false)
  assert.equal(workpack.blindContract.otherPassRenderingAccessAllowed, false)
  assert.equal(workpack.blindContract.externalModelUsed, false)
  assert.equal(workpack.blindContract.networkUsed, false)
  const serialized = JSON.stringify(workpack)
  assert(!serialized.includes("finalRendering"))
  assert(!serialized.includes("renderingA"))
  assert(!serialized.includes("renderingB"))
}

const deterministicA = Array.from({ length: 20 }, () => buildWorkpack(inputs, "A").workpackSha256)
const deterministicB = Array.from({ length: 20 }, () => buildWorkpack(inputs, "B").workpackSha256)
assert.equal(new Set(deterministicA).size, 1)
assert.equal(new Set(deterministicB).size, 1)
assert.equal(deterministicA[0], passA.workpackSha256)
assert.equal(deterministicB[0], passB.workpackSha256)

const verified = execute("verify", { root, repoRoot })
assert.equal(verified.passA.workpackSha256, passA.workpackSha256)
assert.equal(verified.passB.workpackSha256, passB.workpackSha256)
assert.equal(verified.index.counts.exactUnionClaims, 220)
assert.equal(verified.index.counts.duplicateClaimsPerPass, 0)
assert.equal(verified.index.counts.overlapWithPreserved, 0)
assert.equal(verified.manifest.runtimeEligible, false)
assert.equal(verified.manifest.releaseEligible, false)
assert.equal(verified.manifest.activationAllowed, false)
assert.equal(verified.manifest.ownerAuthority, false)
assertManifestSafe(verified.manifest, inputs, passA, passB)

for (const relativePath of [PASS_A_RELATIVE_PATH, PASS_B_RELATIVE_PATH, INDEX_RELATIVE_PATH]) {
  const path = join(root, relativePath)
  assert.equal(lstatSync(path).isSymbolicLink(), false)
  assert.equal(statSync(path).mode & 0o777, 0o600)
}
const repoManifestText = readFileSync(join(repoRoot, REPO_MANIFEST_RELATIVE_PATH), "utf8")
assert(!repoManifestText.includes("external.claim:"))
assert(!repoManifestText.includes("candidate.passage:"))
assert(!repoManifestText.includes("proposition"))
assert(!repoManifestText.includes("passageText"))
assert(!repoManifestText.includes("turkishRendering"))
for (const claim of inputs.candidate.claims) assert(!repoManifestText.includes(claim.proposition))
for (const passage of inputs.candidate.passages) assert(!repoManifestText.includes(passage.originalText))

const candidateTamper = clone(inputs)
candidateTamper.candidate.claims[0].proposition += " tamper"
expectFailure("candidate_tamper", /candidate_hash/, () => buildWorkpack(candidateTamper, "A"))

const sourceTamper = clone(inputs)
sourceTamper.candidate.sources[0].sourceSha256 = "0".repeat(64)
expectFailure("source_tamper", /candidate_hash|source_hash/, () => buildWorkpack(sourceTamper, "A"))

const selectionTamper = clone(inputs)
selectionTamper.selection.selections[1].claimId = selectionTamper.selection.selections[0].claimId
expectFailure("selection_duplicate", /selection_hash|selection_duplicate/, () => buildWorkpack(selectionTamper, "A"))

const fakeOutput = {
  passA: { rawSha256: "1".repeat(64), bytes: 1 },
  passB: { rawSha256: "2".repeat(64), bytes: 1 },
}
const missingPass = clone(passB)
missingPass.workItems.pop()
expectFailure("coverage_missing", /workpack_duplicate|coverage_mismatch/, () =>
  buildIndex(inputs, passA, missingPass, fakeOutput))

const duplicatePass = clone(passB)
duplicatePass.workItems[1].claimId = duplicatePass.workItems[0].claimId
expectFailure("coverage_duplicate", /workpack_duplicate/, () =>
  buildIndex(inputs, passA, duplicatePass, fakeOutput))

const preservedOverlapPass = clone(passB)
preservedOverlapPass.workItems[0].claimId = inputs.selection.selections[0].claimId
expectFailure("preserved_overlap", /coverage_mismatch|preserved_overlap|union_mismatch/, () =>
  buildIndex(inputs, passA, preservedOverlapPass, fakeOutput))

const sandboxParent = join(root, "Outputs", "SelfMetaAI", "dna-intelligence", "test-sandboxes")
mkdirSync(sandboxParent, { recursive: true, mode: 0o700 })
const sandbox = mkdtempSync(join(sandboxParent, "full-coverage-"))
try {
  const content = Buffer.from("full-coverage-secure-fixture\n", "utf8")
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

  const outside = mkdtempSync(join(sandboxParent, "full-coverage-outside-"))
  try {
    const parentLink = join(sandbox, "parent-link")
    symlinkSync(outside, parentLink)
    expectFailure("parent_symlink", /output_parent_invalid/, () =>
      secureAtomicWrite(sandbox, join(parentLink, "artifact.json"), content))
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }

  chmodSync(target, 0o644)
  assert.equal(statSync(target).mode & 0o777, 0o644)
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}

const localFallback = mkdtempSync("/tmp/dna-full-coverage-")
try {
  expectFailure("local_fallback", /local_fallback_forbidden/, () => resolveSsdRoot(localFallback))
} finally {
  rmSync(localFallback, { recursive: true, force: true })
}

const scriptSource = readFileSync(resolve(repoRoot,
  "scripts/dna-external-science-turkish-full-coverage-workpacks.mjs"), "utf8")
assert(!/from\s+["']node:(?:http|https|net|tls|child_process)["']/.test(scriptSource))
assert(!/\bfetch\s*\(/.test(scriptSource))
assert(!/openai|anthropic|gemini|ollama/i.test(scriptSource))
assert(!/one-shot|\/evaluation\/|holdout/i.test(scriptSource))

for (const relativePath of protectedArtifacts) {
  assert.equal(fileSha(join(root, relativePath)), protectedBefore[relativePath],
    `existing_42_artifact_mutated:${relativePath}`)
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  counts: verified.index.counts,
  topicCounts: passA.counts.topicCounts,
  deterministicRepeatsPerPass: 20,
  uniquePassAHashes: new Set(deterministicA).size,
  uniquePassBHashes: new Set(deterministicB).size,
  tamperCases: 6,
  secureWriteRepeats: 20,
  securePathCases: 4,
  protectedExistingArtifacts: protectedArtifacts.length,
  repositoryTextLeakCount: 0,
  passAWorkpackSha256: passA.workpackSha256,
  passAFileSha256: verified.output.passA.rawSha256,
  passBWorkpackSha256: passB.workpackSha256,
  passBFileSha256: verified.output.passB.rawSha256,
  indexSha256: verified.index.indexSha256,
  indexFileSha256: verified.output.index.rawSha256,
  manifestSha256: verified.manifest.manifestSha256,
}, null, 2)}\n`)
