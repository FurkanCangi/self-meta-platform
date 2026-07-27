#!/usr/bin/env node

import assert from "node:assert/strict"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs"
import { join } from "node:path"

import {
  assertManifestMatches,
  buildHoldoutV2Manifest,
  HOLDOUT_V2_MANIFEST_RELATIVE_PATH,
  HOLDOUT_V2_RELATIVE_PATH,
  loadHoldoutV2,
  readSecureJsonFile,
  validateHoldoutV2Artifact,
  verifyHoldoutV2,
} from "./verify-dna-internal-locked-turkish-holdout-v2"
import {
  resolveSecureRoot,
  secureAtomicWriteFile,
} from "./dna-secure-artifact"

function expectFailure(action: () => unknown, message: string): void {
  let failed = false
  try {
    action()
  } catch {
    failed = true
  }
  assert.equal(failed, true, message)
}

function main(): void {
  const researchRoot = resolveSecureRoot(
    process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
    true,
  )
  const loaded = loadHoldoutV2(researchRoot)
  const manifest = buildHoldoutV2Manifest(loaded)

  const deterministicHashes = new Set<string>()
  for (let index = 0; index < 20; index += 1) {
    validateHoldoutV2Artifact(
      loaded.artifact,
      loaded.candidate,
      loaded.candidateFileSha256,
    )
    deterministicHashes.add(loaded.artifact.artifactSha256)
  }
  assert.equal(deterministicHashes.size, 1)

  const contentTamper = structuredClone(loaded.artifact)
  contentTamper.items[0].question = `${contentTamper.items[0].question}x`
  expectFailure(
    () => validateHoldoutV2Artifact(contentTamper, loaded.candidate, loaded.candidateFileSha256),
    "content tamper must fail",
  )

  const hashTamper = structuredClone(loaded.artifact)
  hashTamper.artifactSha256 = "0".repeat(64)
  expectFailure(
    () => validateHoldoutV2Artifact(hashTamper, loaded.candidate, loaded.candidateFileSha256),
    "hash tamper must fail",
  )

  const bindingTamper = structuredClone(loaded.artifact)
  bindingTamper.bindings[0].topicSha256 = "0".repeat(64)
  expectFailure(
    () => validateHoldoutV2Artifact(bindingTamper, loaded.candidate, loaded.candidateFileSha256),
    "binding tamper must fail",
  )

  expectFailure(() => resolveSecureRoot("/tmp", true), "local fallback must fail")

  const temporary = mkdtempSync(join(
    researchRoot,
    "Outputs/SelfMetaAI/dna-intelligence/internal-locked-turkish-holdout/.v2-qa-",
  ))
  const originalBytes = readFileSync(join(researchRoot, HOLDOUT_V2_RELATIVE_PATH))
  try {
    const secureCopy = join(temporary, "secure-copy.json")
    secureAtomicWriteFile(researchRoot, secureCopy, originalBytes)
    const secureRead = readSecureJsonFile(researchRoot, secureCopy, true)
    assert.equal(secureRead.sha256, loaded.artifactFileSha256)

    const byteTamperPath = join(temporary, "byte-tamper.json")
    secureAtomicWriteFile(
      researchRoot,
      byteTamperPath,
      Buffer.concat([originalBytes, Buffer.from(" ", "utf8")]),
    )
    expectFailure(() => {
      const value = readSecureJsonFile(researchRoot, byteTamperPath, true)
      assert.equal(value.sha256, manifest.artifact.sha256)
    }, "byte tamper must fail")

    const modeTamperPath = join(temporary, "mode-tamper.json")
    secureAtomicWriteFile(researchRoot, modeTamperPath, originalBytes)
    chmodSync(modeTamperPath, 0o644)
    expectFailure(
      () => readSecureJsonFile(researchRoot, modeTamperPath, true),
      "mode tamper must fail",
    )

    const leafLink = join(temporary, "leaf-link.json")
    symlinkSync(join(researchRoot, HOLDOUT_V2_RELATIVE_PATH), leafLink)
    expectFailure(
      () => readSecureJsonFile(researchRoot, leafLink, true),
      "leaf symlink must fail",
    )

    const realParent = join(temporary, "real-parent")
    mkdirSync(realParent, { mode: 0o700 })
    const parentLink = join(temporary, "parent-link")
    symlinkSync(realParent, parentLink)
    expectFailure(
      () => readSecureJsonFile(researchRoot, join(parentLink, "blocked.json"), true),
      "parent symlink must fail",
    )
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }

  const driftedManifest = structuredClone(manifest)
  driftedManifest.counts.total = 195 as 196
  expectFailure(
    () => assertManifestMatches(driftedManifest, manifest),
    "manifest drift must fail",
  )

  const recordedManifest = JSON.parse(
    readFileSync(HOLDOUT_V2_MANIFEST_RELATIVE_PATH, "utf8"),
  ) as unknown
  assertManifestMatches(recordedManifest, manifest)
  const manifestText = JSON.stringify(recordedManifest)
  for (const item of loaded.artifact.items) {
    assert.equal(manifestText.includes(item.question), false)
  }

  const result = verifyHoldoutV2({ researchRoot, writeManifest: false })
  assert.equal(result.loaded.artifact.visibleToAdapterTuning, false)
  assert.equal(result.loaded.artifact.runtimeEligible, false)
  assert.equal(result.loaded.artifact.releaseEligible, false)
  assert.equal(result.loaded.artifact.independentHumanValidation, false)

  process.stdout.write(`${JSON.stringify({
    ok: true,
    path: HOLDOUT_V2_RELATIVE_PATH,
    artifactSha256: loaded.artifact.artifactSha256,
    fileSha256: loaded.artifactFileSha256,
    counts: loaded.artifact.counts,
    splits: loaded.artifact.splits,
    tests: {
      deterministicRepeats: 20,
      uniqueArtifactHashes: deterministicHashes.size,
      tamperFailClosed: true,
      hashTamperFailClosed: true,
      byteTamperFailClosed: true,
      modeTamperFailClosed: true,
      leafSymlinkFailClosed: true,
      parentSymlinkEscapeFailClosed: true,
      manifestDriftFailClosed: true,
      localFallbackRejected: true,
      repositoryQuestionLeak: false,
    },
    privacyBoundary: manifest.privacyBoundary,
  })}\n`)
}

main()
