#!/usr/bin/env node

import assert from "node:assert/strict"
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

import {
  buildRenderingArtifact,
  loadPilotInputs,
  runRenderingPassA,
  selectRepresentativeClaims,
  validateRenderingArtifact,
} from "./dna-external-science-turkish-rendering-pass-a"
import {
  assertContained,
  resolveSecureRoot,
  secureAtomicWriteFile,
  verifySecureFile,
} from "./dna-secure-artifact"

const RAW_OUTPUT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-a/feasibility-v1/pass-a-artifact.json"
const DECISIONS_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-a/feasibility-v1/pass-a-decisions.json"
const MANIFEST_PATH =
  "docs/dna-intelligence/program/evidence/external-science-turkish-rendering-pass-a-current.json"

function expectFailure(action: () => unknown, label: string): void {
  let failed = false
  try {
    action()
  } catch {
    failed = true
  }
  assert.equal(failed, true, label)
}

function main(): void {
  const researchRoot = resolveSecureRoot(
    process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
    true,
  )
  const inputs = loadPilotInputs(researchRoot)
  const originalCandidateFileSha256 = inputs.candidateFileSha256

  const selected = selectRepresentativeClaims(inputs.candidate)
  assert.equal(selected.length, 42)
  const topicIds = new Set(selected.map((entry) => entry.topicId))
  assert.equal(topicIds.size, 14)
  for (const topicId of topicIds) {
    const topic = selected.filter((entry) => entry.topicId === topicId)
    assert.deepEqual(topic.map((entry) => entry.slot), ["start", "middle", "end"])
    assert.equal(new Set(topic.map((entry) => entry.claim.passageId)).size, 3)
  }

  const artifacts = Array.from({ length: 20 }, () => buildRenderingArtifact(inputs))
  const baselineBytes = JSON.stringify(artifacts[0])
  for (const artifact of artifacts) {
    validateRenderingArtifact(artifact)
    assert.equal(artifact.artifactSha256, artifacts[0].artifactSha256)
    assert.equal(JSON.stringify(artifact), baselineBytes)
  }

  const claimHashTamper = structuredClone(inputs) as typeof inputs
  claimHashTamper.candidate.claims[0].claimSha256 = "0".repeat(64)
  expectFailure(() => buildRenderingArtifact(claimHashTamper), "claim hash tamper must fail")

  const passageHashTamper = structuredClone(inputs) as typeof inputs
  passageHashTamper.candidate.passages[0].passageSha256 = "0".repeat(64)
  expectFailure(() => buildRenderingArtifact(passageHashTamper), "passage hash tamper must fail")

  const sourceHashTamper = structuredClone(inputs) as typeof inputs
  sourceHashTamper.candidate.sources[0].sourceSha256 = "0".repeat(64)
  expectFailure(() => buildRenderingArtifact(sourceHashTamper), "source hash tamper must fail")

  const decisionsHashTamper = structuredClone(inputs) as typeof inputs
  decisionsHashTamper.decisions.decisionsSha256 = "0".repeat(64)
  expectFailure(() => buildRenderingArtifact(decisionsHashTamper), "decisions hash tamper must fail")

  const artifactTamper = structuredClone(artifacts[0])
  artifactTamper.records[0].renderingSha256 = "0".repeat(64)
  expectFailure(() => validateRenderingArtifact(artifactTamper), "artifact tamper must fail")

  expectFailure(() => resolveSecureRoot("/tmp", true), "local fallback must fail")
  expectFailure(
    () => assertContained(researchRoot, join(researchRoot, "..", "escape")),
    "path escape must fail",
  )

  const tempRoot = mkdtempSync(join(
    researchRoot,
    "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-a/feasibility-v1/.qa-",
  ))
  try {
    const atomicPath = join(tempRoot, "atomic.json")
    const atomicBytes = Buffer.from(JSON.stringify({ fixture: true }), "utf8")
    const atomic = secureAtomicWriteFile(researchRoot, atomicPath, atomicBytes)
    assert.equal(atomic.mode, 0o600)
    assert.equal(verifySecureFile(researchRoot, atomicPath, atomicBytes).sha256, atomic.sha256)

    const permissivePath = join(tempRoot, "permissive.json")
    writeFileSync(permissivePath, atomicBytes, { mode: 0o644 })
    chmodSync(permissivePath, 0o644)
    expectFailure(
      () => verifySecureFile(researchRoot, permissivePath, atomicBytes),
      "permissive mode must fail",
    )

    const outputSymlink = join(tempRoot, "output-link.json")
    symlinkSync(atomicPath, outputSymlink)
    expectFailure(
      () => verifySecureFile(researchRoot, outputSymlink, atomicBytes),
      "output symlink must fail",
    )

    const realDirectory = join(tempRoot, "real-directory")
    secureAtomicWriteFile(researchRoot, join(realDirectory, "seed.json"), atomicBytes)
    const parentSymlink = join(tempRoot, "parent-link")
    symlinkSync(realDirectory, parentSymlink)
    expectFailure(
      () => secureAtomicWriteFile(researchRoot, join(parentSymlink, "blocked.json"), atomicBytes),
      "parent symlink must fail",
    )
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }

  const run = runRenderingPassA({ researchRoot, writeManifest: false })
  assert.equal(run.artifact.qaFailureCounts.totalFailures, 0)
  assert.equal(run.artifact.runtimeEligible, false)
  assert.equal(run.artifact.releaseEligible, false)
  assert.equal(run.artifact.passBPerformed, false)
  assert.equal(run.artifact.reconciliationPerformed, false)

  const rawPath = join(researchRoot, RAW_OUTPUT_RELATIVE_PATH)
  assert.equal(lstatSync(rawPath).isSymbolicLink(), false)
  assert.equal(verifySecureFile(researchRoot, rawPath, readFileSync(rawPath)).mode, 0o600)
  const decisionsPath = join(researchRoot, DECISIONS_RELATIVE_PATH)
  assert.equal(lstatSync(decisionsPath).isSymbolicLink(), false)
  assert.equal(lstatSync(decisionsPath).isFile(), true)
  assert.equal((lstatSync(decisionsPath).mode & 0o777), 0o600)

  const manifestText = readFileSync(MANIFEST_PATH, "utf8")
  assert(!manifestText.includes("\"renderingTr\""))
  assert(!manifestText.includes("\"proposition\""))
  assert(!manifestText.includes("\"originalText\""))
  for (const claim of inputs.candidate.claims) assert(!manifestText.includes(claim.proposition))
  for (const passage of inputs.candidate.passages) assert(!manifestText.includes(passage.originalText))
  for (const decision of inputs.decisions.decisions) assert(!manifestText.includes(decision.renderingTr))

  const reloaded = loadPilotInputs(researchRoot)
  assert.equal(reloaded.candidateFileSha256, originalCandidateFileSha256)

  process.stdout.write(`${JSON.stringify({
    ok: true,
    tests: {
      deterministicRuns: 20,
      topicCoverage: 14,
      selectedRecords: 42,
      sourceHashTamper: "passed",
      artifactTamper: "passed",
      pathEscape: "passed",
      symlink: "passed",
      mode0600: "passed",
      readback: "passed",
      publicTextLeak: "passed",
    },
    artifactSha256: run.artifact.artifactSha256,
    qaFailureCounts: run.artifact.qaFailureCounts,
    boundary: {
      runtimeEligible: false,
      releaseEligible: false,
      passBPerformed: false,
      reconciliationPerformed: false,
    },
  })}\n`)
}

main()
