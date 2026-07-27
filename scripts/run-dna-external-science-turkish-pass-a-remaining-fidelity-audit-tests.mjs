#!/usr/bin/env node

import assert from "node:assert/strict"
import {
  chmodSync,
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
  AUDIT_ARTIFACT_RELATIVE_PATH,
  CANDIDATE_RELATIVE_PATH,
  FINDING_DIMENSIONS,
  PASS_A_ARTIFACT_RELATIVE_PATH,
  PASS_REASON,
  REPO_MANIFEST_RELATIVE_PATH,
  REVIEW_LEDGER_RELATIVE_PATH,
  STATUS,
  TERMINAL_STATUSES,
  WORKPACK_RELATIVE_PATH,
  assertArtifact,
  assertManifestSafe,
  buildArtifact,
  execute,
  loadInputs,
} from "./dna-external-science-turkish-pass-a-remaining-fidelity-audit.mjs"
import {
  assertSecurePath,
  resolveSsdRoot,
  secureAtomicWrite,
} from "./dna-external-science-turkish-full-coverage-workpacks.mjs"

function clone(value) {
  return structuredClone(value)
}

function expectFailure(label, pattern, operation) {
  let error
  try {
    operation()
  } catch (caught) {
    error = caught
  }
  assert(error instanceof Error, `fidelity_negative_did_not_fail:${label}`)
  assert.match(error.message, pattern, `fidelity_negative_wrong_error:${label}`)
}

const repoRoot = process.cwd()
const root = resolveSsdRoot()
const inputs = loadInputs(root, repoRoot)
const artifact = buildArtifact(inputs)
assertArtifact(artifact)

assert.equal(artifact.status, STATUS)
assert.equal(artifact.records.length, 178)
assert.equal(new Set(artifact.records.map((entry) => entry.claimId)).size, 178)
assert.equal(new Set(artifact.records.map((entry) => entry.answerUnitId)).size, 178)
assert.equal(artifact.counts.records, 178)
assert.equal(artifact.counts.terminal, 178)
assert.deepEqual(artifact.counts.statusCounts, {
  pass: 178,
  needs_revision: 0,
  quarantine: 0,
})
assert.deepEqual(artifact.counts.reasonCounts, { [PASS_REASON]: 178 })
assert.equal(artifact.counts.topics, 14)
assert.equal(artifact.counts.sources, 14)
assert.equal(artifact.counts.passages, 140)
assert.equal(artifact.counts.claims, 178)
assert.equal(artifact.counts.answerUnits, 178)
assert.equal(artifact.topicStatusCounts.length, 14)
assert.equal(artifact.topicStatusCounts.reduce((sum, entry) => sum + entry.records, 0), 178)
assert(Object.values(artifact.findingFailureCounts).every((value) => value === 0))
assert.deepEqual(Object.keys(artifact.findingFailureCounts), [...FINDING_DIMENSIONS])

const expectedRecordKeys = [
  "activationAllowed",
  "answerUnitId",
  "audit",
  "authority",
  "bindings",
  "claimId",
  "decision",
  "id",
  "independentHumanReview",
  "ownerAuthority",
  "passageId",
  "provenance",
  "recordSha256",
  "releaseEligible",
  "runtimeEligible",
  "scheduleOrdinal",
  "sourceId",
  "topicId",
]
for (const [index, record] of artifact.records.entries()) {
  assert.deepEqual(Object.keys(record).sort((left, right) => left.localeCompare(right, "en")),
    expectedRecordKeys)
  assert.equal(record.scheduleOrdinal, index + 1)
  assert(TERMINAL_STATUSES.includes(record.decision.status))
  assert.equal(record.decision.status, "pass")
  assert.equal(record.decision.reason, PASS_REASON)
  assert.equal(record.decision.revisionNote, null)
  assert(Object.values(record.decision.findings).every((value) => value === "pass"))
  assert.equal(record.audit.canonicalClaimCompared, true)
  assert.equal(record.audit.boundSourcePassageCompared, true)
  assert.equal(record.audit.claimAndPassageBoundariesCompared, true)
  assert.equal(record.audit.automaticAuthoringQaUsedAsDecision, false)
  assert.equal(record.audit.otherTranslationPassMaterialRead, false)
  assert.equal(record.audit.reconciliationMaterialRead, false)
  assert.equal(record.audit.lockedEvaluationMaterialRead, false)
  assert.equal(record.audit.independentHumanReview, false)
  assert.equal(record.runtimeEligible, false)
  assert.equal(record.releaseEligible, false)
  assert.equal(record.activationAllowed, false)
  assert.equal(record.ownerAuthority, false)
  assert.equal(record.independentHumanReview, false)
  for (const hash of Object.values(record.bindings)) assert.match(hash, /^[a-f0-9]{64}$/)
}

const deterministicHashes = Array.from({ length: 20 }, () => buildArtifact(inputs).artifactSha256)
assert.equal(new Set(deterministicHashes).size, 1)
assert.equal(deterministicHashes[0], artifact.artifactSha256)

const verified = execute("verify", { root, repoRoot })
assert.equal(verified.artifact.artifactSha256, artifact.artifactSha256)
assert.equal(new Set(verified.deterministicHashes).size, 1)
assertManifestSafe(verified.manifest, inputs, artifact)

for (const relativePath of [
  CANDIDATE_RELATIVE_PATH,
  WORKPACK_RELATIVE_PATH,
  PASS_A_ARTIFACT_RELATIVE_PATH,
  REVIEW_LEDGER_RELATIVE_PATH,
  AUDIT_ARTIFACT_RELATIVE_PATH,
]) {
  assert.equal(statSync(join(root, relativePath)).mode & 0o777, 0o600)
}

const manifestText = readFileSync(join(repoRoot, REPO_MANIFEST_RELATIVE_PATH), "utf8")
for (const forbiddenField of [
  "claimId",
  "sourceId",
  "passageId",
  "answerUnitId",
  "workItemId",
  "turkishRendering",
  "proposition",
  "passageText",
  "originalText",
  "revisionNote",
]) assert(!manifestText.includes(forbiddenField))
for (const item of inputs.workpack.workItems) {
  for (const forbidden of [
    item.id,
    item.topicId,
    item.sourceId,
    item.passageId,
    item.claimId,
    item.answerUnitId,
    item.original.proposition,
    item.original.passageText,
  ]) assert(!manifestText.includes(forbidden))
}
for (const record of inputs.passAArtifact.records) {
  assert(!manifestText.includes(record.turkishRendering))
}

const candidateTamper = clone(inputs)
candidateTamper.candidate.claims[0].proposition += " TAMPER"
expectFailure("candidate", /candidate_hash/, () => buildArtifact(candidateTamper))

const workpackTamper = clone(inputs)
workpackTamper.workpack.workItems[0].original.proposition += " TAMPER"
expectFailure("workpack", /workpack_hash/, () => buildArtifact(workpackTamper))

const renderingTamper = clone(inputs)
renderingTamper.passAArtifact.records[0].turkishRendering += " TAMPER"
expectFailure("rendering", /pass_a_hash/, () => buildArtifact(renderingTamper))

const decisionBindingTamper = clone(inputs)
decisionBindingTamper.reviewLedger.decisions[0].bindings.claimSha256 = "0".repeat(64)
expectFailure("decision_binding", /review_ledger_hash/, () => buildArtifact(decisionBindingTamper))

const decisionMissing = clone(inputs)
decisionMissing.reviewLedger.decisions.pop()
expectFailure("decision_missing", /review_ledger_hash/, () => buildArtifact(decisionMissing))

const decisionStatusTamper = clone(artifact)
decisionStatusTamper.records[0].decision.status = "pending"
expectFailure("decision_status", /artifact_hash/, () => assertArtifact(decisionStatusTamper))

const finalBindingTamper = clone(artifact)
finalBindingTamper.records[0].bindings.sourceSha256 = "f".repeat(64)
expectFailure("final_binding", /artifact_hash/, () => assertArtifact(finalBindingTamper))

const finalShapeTamper = clone(artifact)
finalShapeTamper.records[0].extra = true
expectFailure("final_shape", /artifact_hash/, () => assertArtifact(finalShapeTamper))

const sandboxParent = join(root, "Outputs", "SelfMetaAI", "dna-intelligence", "test-sandboxes")
mkdirSync(sandboxParent, { recursive: true, mode: 0o700 })
const sandbox = mkdtempSync(join(sandboxParent, "pass-a-fidelity-audit-"))
let securePathCases = 0
try {
  const bytes = Buffer.from("pass-a-independent-fidelity-audit-secure-fixture\n", "utf8")
  const output = join(sandbox, "nested", "artifact.json")
  const writes = Array.from({ length: 20 }, () => secureAtomicWrite(sandbox, output, bytes))
  assert.equal(new Set(writes.map((entry) => entry.rawSha256)).size, 1)
  assert.equal(statSync(output).mode & 0o777, 0o600)

  expectFailure("path_escape", /output_escape/, () =>
    secureAtomicWrite(sandbox, join(sandbox, "..", "escaped.json"), bytes))
  securePathCases += 1

  const modeFixture = join(sandbox, "mode-invalid.json")
  writeFileSync(modeFixture, "{}\n", { mode: 0o600 })
  chmodSync(modeFixture, 0o644)
  expectFailure("mode", /mode_invalid/, () =>
    assertSecurePath(sandbox, modeFixture, { mode0600: true }))
  securePathCases += 1

  const leafDestination = join(sandbox, "leaf-destination.json")
  const leaf = join(sandbox, "leaf.json")
  writeFileSync(leafDestination, "destination\n", { mode: 0o600 })
  symlinkSync(leafDestination, leaf)
  expectFailure("leaf_symlink", /symlink_forbidden/, () =>
    assertSecurePath(sandbox, leaf, { mode0600: true }))
  securePathCases += 1

  const outside = mkdtempSync(join(sandboxParent, "pass-a-fidelity-outside-"))
  try {
    const parentLink = join(sandbox, "parent-link")
    symlinkSync(outside, parentLink)
    expectFailure("parent_symlink", /output_parent_invalid/, () =>
      secureAtomicWrite(sandbox, join(parentLink, "artifact.json"), bytes))
    securePathCases += 1
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}

const localFallback = mkdtempSync("/tmp/dna-pass-a-fidelity-audit-")
try {
  expectFailure("local_fallback", /local_fallback_forbidden/, () => resolveSsdRoot(localFallback))
  securePathCases += 1
} finally {
  rmSync(localFallback, { recursive: true, force: true })
}

const scriptSource = readFileSync(resolve(repoRoot,
  "scripts/dna-external-science-turkish-pass-a-remaining-fidelity-audit.mjs"), "utf8")
const prohibitedPathFragments = [
  "rendering-" + "pass-b",
  "aligned-" + "pass-b",
  "reconciliation-" + "artifact",
  "internal-" + "locked",
  "one-shot-" + "locked",
  "hold" + "out.json",
]
for (const fragment of prohibitedPathFragments) assert(!scriptSource.includes(fragment))
assert(!/from\s+["']node:(?:http|https|net|tls|child_process)["']/.test(scriptSource))
assert(!/\bfetch\s*\(/.test(scriptSource))
assert(!/openai|anthropic|gemini|ollama/i.test(scriptSource))

process.stdout.write(`${JSON.stringify({
  ok: true,
  status: artifact.status,
  counts: artifact.counts,
  findingFailureCounts: artifact.findingFailureCounts,
  deterministicRepeats: deterministicHashes.length,
  deterministicUniqueHashes: new Set(deterministicHashes).size,
  tamperCases: 8,
  secureWriteRepeats: 20,
  securePathCases,
  repositoryTextOrIdentityLeakCount: 0,
  artifactSha256: artifact.artifactSha256,
  artifactFileSha256: verified.output.rawSha256,
  recordsSha256: verified.manifest.outputHashes.recordsSha256,
  manifestSha256: verified.manifest.manifestSha256,
}, null, 2)}\n`)
