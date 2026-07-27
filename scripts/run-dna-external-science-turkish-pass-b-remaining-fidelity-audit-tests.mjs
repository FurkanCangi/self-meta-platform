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
  PASS_B_ARTIFACT_RELATIVE_PATH,
  PASS_REASON,
  REPO_MANIFEST_RELATIVE_PATH,
  REVIEW_LEDGER_RELATIVE_PATH,
  STATUS,
  TERMINAL_STATUSES,
  assertArtifact,
  assertManifestSafe,
  buildArtifact,
  execute,
  loadInputs,
} from "./dna-external-science-turkish-pass-b-remaining-fidelity-audit.mjs"
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
  assert(error instanceof Error, `b_fidelity_negative_did_not_fail:${label}`)
  assert.match(error.message, pattern, `b_fidelity_negative_wrong_error:${label}`)
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
  pass: 173,
  needs_revision: 5,
  quarantine: 0,
})
assert.deepEqual(artifact.counts.reasonCounts, {
  ambiguous_or_unnatural_turkish: 3,
  source_faithful_no_material_issue: 173,
  terminology_mistranslated: 2,
})
assert.equal(artifact.counts.topics, 14)
assert.equal(artifact.counts.sources, 14)
assert.equal(artifact.counts.passages, 140)
assert.equal(artifact.counts.claims, 178)
assert.equal(artifact.counts.answerUnits, 178)
assert.equal(artifact.topicStatusCounts.length, 14)
assert.equal(artifact.topicStatusCounts.reduce((sum, entry) => sum + entry.records, 0), 178)
assert.deepEqual(artifact.findingFailureCounts, {
  meaningEquivalent: 0,
  numbersPreserved: 0,
  negationPreserved: 0,
  hedgePreserved: 0,
  causalStrengthPreserved: 0,
  relationshipDirectionPreserved: 0,
  ageSampleEvidenceBoundaryPreserved: 0,
  criticalBoundaryPreserved: 0,
  noAddedMechanism: 0,
  noAddedClinicalInference: 0,
  noAddedDnaProductValidity: 0,
  terminologyAccurate: 2,
  naturalTurkish: 3,
})
assert.deepEqual(Object.keys(artifact.findingFailureCounts), [...FINDING_DIMENSIONS])

const expectedRevisionBindings = [
  {
    claimId: "external.claim:b4cfe65d062d4d78d623336b",
    passBRecordSha256: "4dce884164e2d0423f2ffa83d72f29d70a6d740963ade4dba274e31ba15842c7",
    reason: "ambiguous_or_unnatural_turkish",
  },
  {
    claimId: "external.claim:d8e55b7401e6b461fe524ccd",
    passBRecordSha256: "f1d1d6364a839a223541646ce97aabdb0db5ac14f5c7303b3709128fcedf51f0",
    reason: "terminology_mistranslated",
  },
  {
    claimId: "external.claim:968608292aa9bad95747cbbb",
    passBRecordSha256: "b297e1e34a5e34faa178b61f73b8f664ff0e43b00334b4f8c16e521cbbd30299",
    reason: "terminology_mistranslated",
  },
  {
    claimId: "external.claim:3c72d1b075dd96004e287575",
    passBRecordSha256: "6cce75d86b30b18fcc472facb3826889eef58d0e2c6bd0f9ce66d3a390e56e11",
    reason: "ambiguous_or_unnatural_turkish",
  },
  {
    claimId: "external.claim:b76c8fd2383f1f4a11680e58",
    passBRecordSha256: "7cace3bd462f03470babeb823c6f564ddab53acf70bd2bdad550602dc1c52ef8",
    reason: "ambiguous_or_unnatural_turkish",
  },
]
const observedRevisions = artifact.records.filter((entry) => entry.decision.status === "needs_revision")
  .map((entry) => ({
    claimId: entry.claimId,
    passBRecordSha256: entry.bindings.passBRecordSha256,
    reason: entry.decision.reason,
  }))
assert.deepEqual(observedRevisions, expectedRevisionBindings)

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
  if (record.decision.status === "pass") {
    assert.equal(record.decision.reason, PASS_REASON)
    assert.equal(record.decision.revisionNote, null)
    assert(Object.values(record.decision.findings).every((value) => value === "pass"))
  } else {
    assert.equal(record.decision.status, "needs_revision")
    assert.equal(typeof record.decision.revisionNote, "string")
    assert(Object.values(record.decision.findings).includes("fail"))
  }
  assert.equal(record.audit.candidateClaimCompared, true)
  assert.equal(record.audit.boundSourcePassageCompared, true)
  assert.equal(record.audit.claimAndPassageBoundariesCompared, true)
  assert.equal(record.audit.renderingCompared, true)
  assert.equal(record.audit.automaticAuthoringQaUsedAsDecision, false)
  assert.equal(record.audit.blindReview, false)
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
  PASS_B_ARTIFACT_RELATIVE_PATH,
  REVIEW_LEDGER_RELATIVE_PATH,
  AUDIT_ARTIFACT_RELATIVE_PATH,
]) assert.equal(statSync(join(root, relativePath)).mode & 0o777, 0o600)

const manifestText = readFileSync(join(repoRoot, REPO_MANIFEST_RELATIVE_PATH), "utf8")
for (const field of [
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
]) assert(!manifestText.includes(field))
for (const entry of inputs.passBArtifact.records) {
  for (const value of [
    entry.workItemId,
    entry.topicId,
    entry.sourceId,
    entry.passageId,
    entry.claimId,
    entry.answerUnitId,
    entry.turkishRendering,
    entry.fidelityNote,
  ]) assert(!manifestText.includes(value))
}
for (const claim of inputs.candidate.claims) assert(!manifestText.includes(claim.proposition))
for (const passage of inputs.candidate.passages) assert(!manifestText.includes(passage.originalText))

const candidateTamper = clone(inputs)
candidateTamper.candidate.claims[0].proposition += " TAMPER"
expectFailure("candidate", /candidate_hash/, () => buildArtifact(candidateTamper))

const artifactTamper = clone(inputs)
artifactTamper.passBArtifact.records[0].turkishRendering += " TAMPER"
expectFailure("source_artifact", /artifact_hash/, () => buildArtifact(artifactTamper))

const ledgerBindingTamper = clone(inputs)
ledgerBindingTamper.reviewLedger.decisions[0].bindings.claimSha256 = "0".repeat(64)
expectFailure("ledger_binding", /ledger_hash/, () => buildArtifact(ledgerBindingTamper))

const ledgerMissing = clone(inputs)
ledgerMissing.reviewLedger.decisions.pop()
expectFailure("ledger_missing", /ledger_hash/, () => buildArtifact(ledgerMissing))

const statusTamper = clone(artifact)
statusTamper.records[0].decision.status = "pending"
expectFailure("output_status", /output_hash/, () => assertArtifact(statusTamper))

const bindingTamper = clone(artifact)
bindingTamper.records[0].bindings.sourceSha256 = "f".repeat(64)
expectFailure("output_binding", /output_hash/, () => assertArtifact(bindingTamper))

const shapeTamper = clone(artifact)
shapeTamper.records[0].extra = true
expectFailure("output_shape", /output_hash/, () => assertArtifact(shapeTamper))

const revisionTamper = clone(artifact)
revisionTamper.records.find((entry) => entry.decision.status === "needs_revision").decision.revisionNote = null
expectFailure("revision_note", /output_hash/, () => assertArtifact(revisionTamper))

const sandboxParent = join(root, "Outputs", "SelfMetaAI", "dna-intelligence", "test-sandboxes")
mkdirSync(sandboxParent, { recursive: true, mode: 0o700 })
const sandbox = mkdtempSync(join(sandboxParent, "pass-b-fidelity-audit-"))
let securePathCases = 0
try {
  const bytes = Buffer.from("pass-b-source-fidelity-audit-secure-fixture\n", "utf8")
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

  const outside = mkdtempSync(join(sandboxParent, "pass-b-fidelity-outside-"))
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

const localFallback = mkdtempSync("/tmp/dna-pass-b-fidelity-audit-")
try {
  expectFailure("local_fallback", /local_fallback_forbidden/, () => resolveSsdRoot(localFallback))
  securePathCases += 1
} finally {
  rmSync(localFallback, { recursive: true, force: true })
}

const scriptSource = readFileSync(resolve(repoRoot,
  "scripts/dna-external-science-turkish-pass-b-remaining-fidelity-audit.mjs"), "utf8")
const prohibitedPathFragments = [
  "pass-" + "a/",
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
