#!/usr/bin/env node

import assert from "node:assert/strict"
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  assertManifestContainsNoRawLimitations,
  assertCrosswalkManifestMatch,
  buildCrosswalk,
  buildManifest,
  loadCrosswalkInputs,
  validateCrosswalkArtifact,
  type CrosswalkArtifact,
  type CrosswalkInputs,
  type CrosswalkManifest,
} from "./dna-external-science-evidence-quality-crosswalk"
import {
  assertContained,
  canonicalSha256,
  resolveSecureRoot,
  secureAtomicWriteFile,
  verifySecureFile,
} from "./dna-secure-artifact"

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function reseal(value: Record<string, unknown>, hashKey: string): void {
  delete value[hashKey]
  value[hashKey] = canonicalSha256(value)
}

function resealCandidatePackage(inputs: CrosswalkInputs) {
  reseal(inputs.candidate as unknown as Record<string, unknown>, "packageSha256")
}

function resealCrosswalk(artifact: CrosswalkArtifact) {
  reseal(artifact as unknown as Record<string, unknown>, "crosswalkSha256")
}

function run() {
  const inputs = loadCrosswalkInputs()
  const artifact = buildCrosswalk(inputs)
  assert.equal(validateCrosswalkArtifact(artifact), true)
  assert.equal(artifact.sources.length, 14)
  assert.equal(artifact.claims.length, 220)
  assert.equal(artifact.counts.limitations, 217)
  assert.deepEqual(artifact.distributions.bodyOfEvidenceCertainty, { not_assessed: 14 })
  assert.equal(artifact.claims.every((claim) =>
    claim.sourceAppraisalIsClaimCertainty === false
      && claim.certaintyInheritance === "forbidden"), true)
  assert.deepEqual(artifact.inputs.allowedInputKinds, [
    "candidate_package",
    "registration_decision",
    "registration_result",
    "registration_receipt",
    "trusted_registry",
  ])

  const deterministicHashes = Array.from({ length: 20 }, () =>
    buildCrosswalk(inputs).crosswalkSha256)
  assert.equal(new Set(deterministicHashes).size, 1)
  assert.equal(deterministicHashes[0], artifact.crosswalkSha256)

  const sourceHashMismatch = clone(inputs)
  sourceHashMismatch.sourceChains[0].candidateSource.sourceSha256 = "0".repeat(64)
  assert.throws(
    () => buildCrosswalk(sourceHashMismatch),
    /evidence_quality_crosswalk_candidate_source_hash_mismatch/,
  )

  const sourceIdMismatch = clone(inputs)
  const changedSource = sourceIdMismatch.candidate.sources[0]
  changedSource.id = `${changedSource.id}-changed`
  reseal(changedSource as unknown as Record<string, unknown>, "sourceSha256")
  sourceIdMismatch.sourceChains[0].candidateSource = changedSource
  resealCandidatePackage(sourceIdMismatch)
  assert.throws(
    () => buildCrosswalk(sourceIdMismatch),
    /evidence_quality_crosswalk_source_id_chain_mismatch/,
  )

  const registryMismatch = clone(inputs)
  registryMismatch.trustedRegistry.appraisals[0].appraisalPayloadSha256 = "1".repeat(64)
  assert.throws(
    () => buildCrosswalk(registryMismatch),
    /evidence_quality_crosswalk_registry_appraisal_mismatch|evidence_quality_crosswalk_registry_appraisal_hash_link/,
  )

  const resultHashMismatch = clone(inputs)
  resultHashMismatch.sourceChains[0].result.decisionSha256 = "2".repeat(64)
  assert.throws(
    () => buildCrosswalk(resultHashMismatch),
    /evidence_quality_crosswalk_result_hash_mismatch/,
  )

  const receiptHashMismatch = clone(inputs)
  receiptHashMismatch.sourceChains[0].receipt.resultFileSha256 = "3".repeat(64)
  assert.throws(
    () => buildCrosswalk(receiptHashMismatch),
    /evidence_quality_crosswalk_receipt_hash_mismatch/,
  )

  const inheritedCertainty = clone(artifact)
  const claim = inheritedCertainty.claims[0] as unknown as Record<string, unknown>
  claim.sourceAppraisalIsClaimCertainty = true
  claim.certaintyInheritance = "inherited"
  reseal(claim, "claimCrosswalkSha256")
  resealCrosswalk(inheritedCertainty)
  assert.throws(
    () => validateCrosswalkArtifact(inheritedCertainty),
    /evidence_quality_crosswalk_claim_boundary_invalid/,
  )

  const manifest = buildManifest(artifact, "4".repeat(64))
  assert.equal(assertManifestContainsNoRawLimitations(manifest, artifact), true)
  const sameProjection = clone(manifest)
  sameProjection.recordedAt = "2099-01-01T00:00:00.000Z"
  assert.equal(assertCrosswalkManifestMatch(manifest, sameProjection), true)
  const driftedManifest = clone(manifest)
  driftedManifest.rawOutput.rawSha256 = "5".repeat(64)
  assert.throws(
    () => assertCrosswalkManifestMatch(manifest, driftedManifest),
    /evidence_quality_crosswalk_repo_manifest_drift/,
  )
  const leakingManifest = clone(manifest) as CrosswalkManifest & { limitations: string[] }
  leakingManifest.limitations = [artifact.sources[0].limitations[0]]
  assert.throws(
    () => assertManifestContainsNoRawLimitations(leakingManifest, artifact),
    /evidence_quality_crosswalk_repo_manifest_limitations_array_forbidden/,
  )

  const tempRootPath = mkdtempSync(join(tmpdir(), "dna-evidence-quality-crosswalk-root-"))
  const outsidePath = mkdtempSync(join(tmpdir(), "dna-evidence-quality-crosswalk-outside-"))
  try {
    const tempRoot = resolveSecureRoot(realpathSync(tempRootPath))
    const rawText = `${JSON.stringify(artifact, null, 2)}\n`
    const output = join(tempRoot, "nested", "crosswalk.json")
    const firstWrite = secureAtomicWriteFile(tempRoot, output, rawText)
    assert.equal(firstWrite.mode, 0o600)
    assert.equal(readFileSync(output, "utf8"), rawText)
    assert.equal(lstatSync(output).isSymbolicLink(), false)
    const writeHashes = Array.from({ length: 20 }, () =>
      secureAtomicWriteFile(tempRoot, output, rawText).sha256)
    assert.equal(new Set(writeHashes).size, 1)
    assert.equal(writeHashes[0], firstWrite.sha256)
    assert.equal(readdirSync(join(tempRoot, "nested")).filter((name) => name.endsWith(".tmp")).length, 0)

    writeFileSync(output, "tampered", "utf8")
    assert.throws(
      () => verifySecureFile(tempRoot, output, rawText),
      /secure_artifact_output_hash_mismatch/,
    )
    secureAtomicWriteFile(tempRoot, output, rawText)
    chmodSync(output, 0o644)
    assert.throws(
      () => verifySecureFile(tempRoot, output, rawText),
      /secure_artifact_output_mode_invalid/,
    )

    assert.throws(
      () => assertContained(tempRoot, join(tempRoot, "..", "escape.json")),
      /secure_artifact_path_escape/,
    )
    const outsideFile = join(outsidePath, "outside.json")
    writeFileSync(outsideFile, "outside", { encoding: "utf8", mode: 0o600 })
    const leafLink = join(tempRoot, "leaf-link.json")
    symlinkSync(outsideFile, leafLink)
    assert.throws(
      () => secureAtomicWriteFile(tempRoot, leafLink, rawText),
      /secure_artifact_output_symlink_rejected/,
    )
    const parentLink = join(tempRoot, "parent-link")
    symlinkSync(outsidePath, parentLink)
    assert.throws(
      () => secureAtomicWriteFile(tempRoot, join(parentLink, "crosswalk.json"), rawText),
      /secure_artifact_parent_symlink_rejected/,
    )
    assert.equal(readFileSync(outsideFile, "utf8"), "outside")
  } finally {
    rmSync(tempRootPath, { recursive: true, force: true })
    rmSync(outsidePath, { recursive: true, force: true })
  }

  console.log(JSON.stringify({
    ok: true,
    realSources: artifact.sources.length,
    realClaims: artifact.claims.length,
    rawLimitationsOnlyOnSsdArtifact: artifact.counts.limitations,
    deterministicBuildRepeats: 20,
    atomicWriteRepeats: 20,
    sourceAndRegistryNegativeTests: 5,
    claimBoundaryNegativeTests: 1,
    manifestNegativeTests: 2,
    pathSymlinkTamperNegativeTests: 5,
    outputMode: "0600",
  }, null, 2))
}

try {
  run()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
