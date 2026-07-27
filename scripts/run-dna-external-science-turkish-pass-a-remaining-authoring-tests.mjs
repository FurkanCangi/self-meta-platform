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
  ARTIFACT_RELATIVE_PATH,
  AUTHORING_RELATIVE_PATH,
  REPO_MANIFEST_RELATIVE_PATH,
  STATUS,
  WORKPACK_RELATIVE_PATH,
  assertArtifact,
  assertManifestSafe,
  buildArtifact,
  execute,
  loadInputs,
} from "./dna-external-science-turkish-pass-a-remaining-authoring.mjs"
import {
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
  assert(error instanceof Error, `pass_a_remaining_negative_did_not_fail:${label}`)
  assert.match(error.message, pattern, `pass_a_remaining_negative_wrong_error:${label}`)
}

function tamperedInputs(inputs, claimId, update) {
  const mutated = clone(inputs)
  mutated.authoring[claimId] = update(mutated.authoring[claimId])
  return mutated
}

const repoRoot = process.cwd()
const root = resolveSsdRoot()
const inputs = loadInputs(root, repoRoot)
const artifact = buildArtifact(inputs)
assertArtifact(artifact)

assert.equal(artifact.status, STATUS)
assert.deepEqual(artifact.counts, {
  records: 178,
  complete: 178,
  topics: 14,
  sources: 14,
  passages: 140,
  claims: 178,
  answerUnits: 178,
})
assert(Object.values(artifact.qaFailureCounts).every((value) => value === 0))
assert.equal(artifact.runtimeEligible, false)
assert.equal(artifact.releaseEligible, false)
assert.equal(artifact.activationAllowed, false)
assert.equal(artifact.ownerAuthority, false)
assert.equal(artifact.independentHumanReview, false)
assert.equal(new Set(artifact.records.map((entry) => entry.claimId)).size, 178)
assert.equal(new Set(artifact.records.map((entry) => entry.answerUnitId)).size, 178)

for (const record of artifact.records) {
  assert.equal(record.review.status, "complete")
  assert.equal(record.review.claimReread, true)
  assert.equal(record.review.passageBoundaryReread, true)
  assert.equal(record.review.noCrossPassMaterialRead, true)
  assert.equal(record.review.independentHumanReview, false)
  assert.equal(record.checks.allPassed, true)
  assert.equal(record.authority.runtime, false)
  assert.equal(record.authority.release, false)
  assert.equal(record.authority.activation, false)
  assert.equal(record.authority.owner, false)
  assert.equal(record.runtimeEligible, false)
  assert.equal(record.releaseEligible, false)
  assert.equal(record.activationAllowed, false)
  assert.equal(record.ownerAuthority, false)
  assert.equal(record.independentHumanReview, false)
  for (const hash of Object.values(record.bindings)) {
    assert.match(hash, /^[a-f0-9]{64}$/)
  }
}

const deterministic = Array.from({ length: 20 }, () => buildArtifact(inputs).artifactSha256)
assert.equal(new Set(deterministic).size, 1)
assert.equal(deterministic[0], artifact.artifactSha256)

const verified = execute("verify", { root, repoRoot })
assert.equal(verified.artifact.artifactSha256, artifact.artifactSha256)
assert.equal(verified.artifact.counts.complete, 178)
assert.equal(new Set(verified.deterministicHashes).size, 1)
assertManifestSafe(verified.manifest, inputs, artifact)

for (const relativePath of [WORKPACK_RELATIVE_PATH, AUTHORING_RELATIVE_PATH, ARTIFACT_RELATIVE_PATH]) {
  const path = join(root, relativePath)
  assert.equal(statSync(path).mode & 0o777, 0o600)
}
const repoManifest = readFileSync(join(repoRoot, REPO_MANIFEST_RELATIVE_PATH), "utf8")
assert(!repoManifest.includes("external.claim:"))
assert(!repoManifest.includes("candidate.passage:"))
assert(!repoManifest.includes("turkishRendering"))
assert(!repoManifest.includes("proposition"))
assert(!repoManifest.includes("passageText"))
for (const item of inputs.workpack.workItems) {
  assert(!repoManifest.includes(item.original.proposition))
  assert(!repoManifest.includes(item.original.passageText))
  assert(!repoManifest.includes(inputs.authoring[item.claimId]))
}

const workpackTamper = clone(inputs)
workpackTamper.workpack.workItems[0].hashes.claimSha256 = "0".repeat(64)
expectFailure("workpack_tamper", /workpack_hash/, () => buildArtifact(workpackTamper))

const missingAuthoring = clone(inputs)
delete missingAuthoring.authoring[missingAuthoring.workpack.workItems[0].claimId]
expectFailure("missing_authoring", /authoring_count/, () => buildArtifact(missingAuthoring))

const extraAuthoring = clone(inputs)
extraAuthoring.authoring["external.claim:extra"] = "Kaynak dışı ek kayıt."
expectFailure("extra_authoring", /authoring_count/, () => buildArtifact(extraAuthoring))

const numberTamper = tamperedInputs(inputs, "external.claim:00b762232b12d0ce21c6364b", (value) =>
  value.replace("N = 39", "N = 40"))
expectFailure("number", /numbers_changed/, () => buildArtifact(numberTamper))

const negationTamper = tamperedInputs(inputs, "external.claim:c07925049339d65908747da5", (value) =>
  value.replace("uygulanmamıştır", "uygulanmıştır"))
expectFailure("negation", /negation_lost/, () => buildArtifact(negationTamper))

const hedgeTamper = tamperedInputs(inputs, "external.claim:94f698cabacdea1c9a531ff6", () =>
  "İnsan insulasının uyarımı yoluyla koku işlemenin araştırılması, üst düzey bilişsel süreçler hakkında bilgi sağlar.")
expectFailure("hedge", /hedge_lost/, () => buildArtifact(hedgeTamper))

const causalTamper = tamperedInputs(inputs, "external.claim:3643a19a3703feefbf16c980", (value) =>
  `${value} Bu kesin olarak kanıtlar.`)
expectFailure("causal", /causal_upgrade/, () => buildArtifact(causalTamper))

const clinicalTamper = tamperedInputs(inputs, "external.claim:3643a19a3703feefbf16c980", (value) =>
  `${value} Bu tanı koyar.`)
expectFailure("clinical", /clinical_addition:diagnosis/, () => buildArtifact(clinicalTamper))

const dnaTamper = tamperedInputs(inputs, "external.claim:3643a19a3703feefbf16c980", (value) =>
  `${value} Bu DNA ürün geçerliğini gösterir.`)
expectFailure("dna_product", /dna_product_addition/, () => buildArtifact(dnaTamper))

const sandboxParent = join(root, "Outputs", "SelfMetaAI", "dna-intelligence", "test-sandboxes")
mkdirSync(sandboxParent, { recursive: true, mode: 0o700 })
const sandbox = mkdtempSync(join(sandboxParent, "pass-a-remaining-"))
try {
  const bytes = Buffer.from("pass-a-remaining-secure-fixture\n", "utf8")
  const target = join(sandbox, "nested", "artifact.json")
  const writes = Array.from({ length: 20 }, () => secureAtomicWrite(sandbox, target, bytes))
  assert.equal(new Set(writes.map((entry) => entry.rawSha256)).size, 1)
  assert.equal(statSync(target).mode & 0o777, 0o600)

  expectFailure("path_escape", /output_escape/, () =>
    secureAtomicWrite(sandbox, join(sandbox, "..", "escaped.json"), bytes))

  const leafDestination = join(sandbox, "leaf-destination.json")
  const leaf = join(sandbox, "leaf.json")
  writeFileSync(leafDestination, "destination\n", { mode: 0o600 })
  symlinkSync(leafDestination, leaf)
  expectFailure("leaf_symlink", /output_leaf_invalid/, () => secureAtomicWrite(sandbox, leaf, bytes))

  const outside = mkdtempSync(join(sandboxParent, "pass-a-remaining-outside-"))
  try {
    const parentLink = join(sandbox, "parent-link")
    symlinkSync(outside, parentLink)
    expectFailure("parent_symlink", /output_parent_invalid/, () =>
      secureAtomicWrite(sandbox, join(parentLink, "artifact.json"), bytes))
  } finally {
    rmSync(outside, { recursive: true, force: true })
  }

  chmodSync(target, 0o644)
  assert.equal(statSync(target).mode & 0o777, 0o644)
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}

const localFallback = mkdtempSync("/tmp/dna-pass-a-remaining-")
try {
  expectFailure("local_fallback", /local_fallback_forbidden/, () => resolveSsdRoot(localFallback))
} finally {
  rmSync(localFallback, { recursive: true, force: true })
}

const scriptSource = readFileSync(resolve(repoRoot,
  "scripts/dna-external-science-turkish-pass-a-remaining-authoring.mjs"), "utf8")
assert(!/rendering-pass-b|pass-b\/|reconciliation-artifact|reconciliation-current/.test(scriptSource))
assert(!/from\s+["']node:(?:http|https|net|tls|child_process)["']/.test(scriptSource))
assert(!/\bfetch\s*\(/.test(scriptSource))
assert(!/openai|anthropic|gemini|ollama/i.test(scriptSource))
assert(!/one-shot|\/evaluation\/|holdout/i.test(scriptSource))

process.stdout.write(`${JSON.stringify({
  ok: true,
  status: artifact.status,
  counts: artifact.counts,
  qaFailureCounts: artifact.qaFailureCounts,
  deterministicRepeats: deterministic.length,
  deterministicUniqueHashes: new Set(deterministic).size,
  tamperCases: 9,
  secureWriteRepeats: 20,
  securePathCases: 4,
  repositoryTextLeakCount: 0,
  artifactSha256: artifact.artifactSha256,
  artifactFileSha256: verified.output.rawSha256,
  manifestSha256: verified.manifest.manifestSha256,
}, null, 2)}\n`)
