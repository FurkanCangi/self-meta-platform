#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

import {
  assertManifestHasNoText,
  buildPassBArtifact,
  loadPassBInputs,
  validatePassBArtifact,
} from "./dna-external-science-turkish-rendering-pass-b"
import {
  canonicalSha256,
  resolveSecureRoot,
  secureAtomicWriteFile,
  verifySecureFile,
} from "./dna-secure-artifact"

type UnknownRecord = Record<string, unknown>

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function omit(value: UnknownRecord, key: string): UnknownRecord {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function expectFailure(label: string, expected: RegExp, operation: () => unknown) {
  let thrown: unknown
  try {
    operation()
  } catch (error) {
    thrown = error
  }
  assert(thrown instanceof Error, `pass_b_negative_test_did_not_fail:${label}`)
  assert(expected.test(thrown.message),
    `pass_b_negative_test_wrong_error:${label}:${thrown.message}`)
}

function resealAuthoring<T extends ReturnType<typeof loadPassBInputs>>(inputs: T): T {
  inputs.authoring.authoringSha256 = canonicalSha256(omit(
    inputs.authoring as unknown as UnknownRecord,
    "authoringSha256",
  ))
  return inputs
}

function resealRenderingRecord<T extends ReturnType<typeof buildPassBArtifact>["renderings"][number]>(
  record: T,
): T {
  record.renderingRecordSha256 = canonicalSha256(omit(
    record as unknown as UnknownRecord,
    "renderingRecordSha256",
  ))
  return record
}

function resealArtifact<T extends ReturnType<typeof buildPassBArtifact>>(artifact: T): T {
  artifact.artifactSha256 = canonicalSha256(omit(
    artifact as unknown as UnknownRecord,
    "artifactSha256",
  ))
  return artifact
}

function runSecurityTests() {
  const tmpBase = realpathSync(".tmp")
  const root = mkdtempSync(join(tmpBase, "dna-turkish-rendering-b-security-"))
  try {
    const target = join(root, "nested", "artifact.json")
    const content = "secure-pass-b-fixture\n"
    const writes = Array.from({ length: 20 }, () =>
      secureAtomicWriteFile(root, target, content))
    assert(writes.every((entry) => entry.sha256 === writes[0].sha256),
      "pass_b_secure_write_not_deterministic")
    assert((statSync(target).mode & 0o777) === 0o600,
      "pass_b_secure_write_mode")
    verifySecureFile(root, target, content)

    writeFileSync(target, "tampered\n", { mode: 0o600 })
    chmodSync(target, 0o600)
    expectFailure("content_tamper", /hash_mismatch|readback_mismatch/, () =>
      verifySecureFile(root, target, content))

    secureAtomicWriteFile(root, target, content)
    chmodSync(target, 0o644)
    expectFailure("mode_tamper", /mode_invalid/, () =>
      verifySecureFile(root, target, content))

    expectFailure("path_escape", /path_escape/, () =>
      secureAtomicWriteFile(root, join(root, "..", "escaped.json"), content))

    const leafTarget = join(root, "leaf.json")
    const leafDestination = join(root, "leaf-destination.json")
    writeFileSync(leafDestination, "destination\n", { mode: 0o600 })
    symlinkSync(leafDestination, leafTarget)
    expectFailure("leaf_symlink", /output_symlink_rejected/, () =>
      secureAtomicWriteFile(root, leafTarget, content))

    const outside = mkdtempSync(join(tmpBase, "dna-turkish-rendering-b-outside-"))
    try {
      const parentLink = join(root, "parent-link")
      symlinkSync(outside, parentLink)
      expectFailure("parent_symlink", /parent_symlink_rejected/, () =>
        secureAtomicWriteFile(root, join(parentLink, "artifact.json"), content))
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }

    const rootLink = `${root}-link`
    symlinkSync(root, rootLink)
    try {
      expectFailure("root_symlink", /root_symlink_rejected/, () =>
        resolveSecureRoot(rootLink))
    } finally {
      rmSync(rootLink, { force: true })
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function main() {
  mkdirSync(".tmp", { recursive: true })
  const inputs = loadPassBInputs()
  const artifact = buildPassBArtifact(inputs)
  validatePassBArtifact(artifact)

  assert(artifact.counts.topics === 14 && artifact.renderings.length === 42,
    "pass_b_expected_coverage")
  assert(artifact.counts.first === 14 && artifact.counts.middle === 14
    && artifact.counts.last === 14, "pass_b_selection_distribution")
  const perTopic = new Map<string, typeof artifact.renderings>()
  for (const record of artifact.renderings) {
    const records = perTopic.get(record.topicId) ?? []
    records.push(record)
    perTopic.set(record.topicId, records)
  }
  assert(perTopic.size === 14, "pass_b_topic_coverage")
  for (const records of perTopic.values()) {
    assert(records.length === 3, "pass_b_per_topic_count")
    const bySelection = new Map(records.map((record) => [record.selection, record]))
    assert(bySelection.get("first")?.passageIndex === 0, "pass_b_first_index")
    const middle = bySelection.get("middle")
    const last = bySelection.get("last")
    assert(middle?.passageIndex === Math.floor(((middle?.topicPassageCount ?? 0) - 1) / 2),
      "pass_b_middle_index")
    assert(last?.passageIndex === (last?.topicPassageCount ?? 0) - 1,
      "pass_b_last_index")
    assert(new Set(records.map((record) => record.passageId)).size === 3,
      "pass_b_non_distinct_passages")
  }

  const deterministic = Array.from({ length: 20 }, () =>
    buildPassBArtifact(inputs).artifactSha256)
  assert(new Set(deterministic).size === 1 && deterministic[0] === artifact.artifactSha256,
    "pass_b_twenty_run_determinism")

  const numericInputs = clone(inputs)
  const numericRecord = artifact.renderings.find((record) => /\d/.test(record.turkishRendering))
  assert(numericRecord, "pass_b_numeric_fixture_missing")
  const numericAuthoring = numericInputs.authoring.renderings.find((entry) =>
    entry.claimId === numericRecord.claimId)
  assert(numericAuthoring, "pass_b_numeric_authoring_missing")
  numericAuthoring.turkishRendering = numericAuthoring.turkishRendering.replace(/\d/, (digit) =>
    digit === "9" ? "8" : "9")
  resealAuthoring(numericInputs)
  expectFailure("numeric_change", /numbers_changed/, () => buildPassBArtifact(numericInputs))

  const negationInputs = clone(inputs)
  const negationRecord = artifact.renderings.find((record) =>
    record.turkishRendering.includes("değil"))
  assert(negationRecord, "pass_b_negation_fixture_missing")
  const negationAuthoring = negationInputs.authoring.renderings.find((entry) =>
    entry.claimId === negationRecord.claimId)
  assert(negationAuthoring, "pass_b_negation_authoring_missing")
  negationAuthoring.turkishRendering = negationAuthoring.turkishRendering.replace("değil", "ayrıca")
  resealAuthoring(negationInputs)
  expectFailure("negation_loss", /negation_lost/, () => buildPassBArtifact(negationInputs))

  const causalInputs = clone(inputs)
  causalInputs.authoring.renderings[0].turkishRendering += " Bu kesin olarak kanıtlar."
  resealAuthoring(causalInputs)
  expectFailure("causal_upgrade", /causal_upgrade/, () => buildPassBArtifact(causalInputs))

  const missingInputs = clone(inputs)
  missingInputs.authoring.renderings.pop()
  resealAuthoring(missingInputs)
  expectFailure("missing_selection", /authoring_count/, () => buildPassBArtifact(missingInputs))

  const duplicateInputs = clone(inputs)
  duplicateInputs.authoring.renderings[1].claimId =
    duplicateInputs.authoring.renderings[0].claimId
  resealAuthoring(duplicateInputs)
  expectFailure("duplicate_selection", /duplicate_authoring_claim/, () =>
    buildPassBArtifact(duplicateInputs))

  const bindingTamper = clone(artifact)
  bindingTamper.renderings[0].bindings.ageScope += "_tampered"
  resealRenderingRecord(bindingTamper.renderings[0])
  resealArtifact(bindingTamper)
  expectFailure("age_binding_tamper", /record_invalid/, () =>
    validatePassBArtifact(bindingTamper))

  const boundaryTamper = clone(artifact)
  boundaryTamper.renderings[0].bindings.claimBoundarySha256 = "0".repeat(64)
  resealRenderingRecord(boundaryTamper.renderings[0])
  resealArtifact(boundaryTamper)
  expectFailure("boundary_binding_tamper", /record_invalid/, () =>
    validatePassBArtifact(boundaryTamper))

  const manifestPath = join(process.cwd(),
    "docs/dna-intelligence/program/evidence/external-science-turkish-rendering-pass-b-current.json")
  assert(existsSync(manifestPath) && !lstatSync(manifestPath).isSymbolicLink(),
    "pass_b_manifest_missing_or_symlink")
  const recordedManifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  assertManifestHasNoText(recordedManifest, artifact)
  const leakingManifest = { injected: artifact.renderings[0].turkishRendering }
  expectFailure("manifest_text_leak", /manifest_rendering_leak/, () =>
    assertManifestHasNoText(leakingManifest as never, artifact))

  const authoringPath = join(inputs.researchRoot,
    "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b/feasibility-v1/authored-renderings.json")
  assert((statSync(authoringPath).mode & 0o777) === 0o600,
    "pass_b_authoring_mode")
  runSecurityTests()

  console.log(JSON.stringify({
    ok: true,
    counts: artifact.counts,
    deterministicRepeats: deterministic.length,
    uniqueArtifactHashes: new Set(deterministic).size,
    negativeTamperTests: 8,
    secureWriteRepeats: 20,
    securityTests: 6,
    artifactSha256: artifact.artifactSha256,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
