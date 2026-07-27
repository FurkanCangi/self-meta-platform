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
  assertManifestProjectionMatch,
} from "./run-dna-external-science-qa"
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

function run() {
  const root = mkdtempSync(join(tmpdir(), "dna-external-science-qa-root-"))
  const outside = mkdtempSync(join(tmpdir(), "dna-external-science-qa-outside-"))
  const linkContainer = mkdtempSync(join(tmpdir(), "dna-external-science-qa-link-"))
  try {
    const secureRoot = resolveSecureRoot(realpathSync(root))
    const target = join(secureRoot, "nested", "raw-result.json")
    const expected = `${JSON.stringify({ ok: true, sequence: [1, 2, 3] }, null, 2)}\n`
    const first = secureAtomicWriteFile(secureRoot, target, expected)
    assert.equal(first.mode, 0o600)
    assert.equal(first.bytes, Buffer.byteLength(expected))
    assert.equal(readFileSync(target, "utf8"), expected)
    assert.equal(lstatSync(target).isSymbolicLink(), false)

    const repeatHashes = Array.from({ length: 20 }, () =>
      secureAtomicWriteFile(secureRoot, target, expected).sha256)
    assert.equal(new Set(repeatHashes).size, 1)
    assert.equal(repeatHashes[0], first.sha256)
    assert.equal(
      readdirSync(join(secureRoot, "nested")).filter((name) => name.endsWith(".tmp")).length,
      0,
    )

    writeFileSync(target, "tampered", "utf8")
    assert.throws(
      () => verifySecureFile(secureRoot, target, expected),
      /secure_artifact_output_hash_mismatch/,
    )
    secureAtomicWriteFile(secureRoot, target, expected)
    chmodSync(target, 0o644)
    assert.throws(
      () => verifySecureFile(secureRoot, target, expected),
      /secure_artifact_output_mode_invalid/,
    )
    secureAtomicWriteFile(secureRoot, target, expected)

    assert.throws(
      () => assertContained(secureRoot, join(secureRoot, "..", "escaped.json")),
      /secure_artifact_path_escape/,
    )

    const outsideLeaf = join(outside, "outside-leaf.json")
    writeFileSync(outsideLeaf, "outside", { encoding: "utf8", mode: 0o600 })
    const leafLink = join(secureRoot, "leaf-link.json")
    symlinkSync(outsideLeaf, leafLink)
    assert.throws(
      () => secureAtomicWriteFile(secureRoot, leafLink, expected),
      /secure_artifact_output_symlink_rejected/,
    )

    const linkedParent = join(secureRoot, "linked-parent")
    symlinkSync(outside, linkedParent)
    assert.throws(
      () => secureAtomicWriteFile(secureRoot, join(linkedParent, "raw.json"), expected),
      /secure_artifact_parent_symlink_rejected/,
    )
    assert.equal(readFileSync(outsideLeaf, "utf8"), "outside")

    const rootLink = join(linkContainer, "root-link")
    symlinkSync(secureRoot, rootLink)
    assert.throws(
      () => resolveSecureRoot(rootLink),
      /secure_artifact_root_symlink_rejected/,
    )
    assert.throws(
      () => secureAtomicWriteFile(rootLink, join(rootLink, "should-not-write.json"), expected),
      /secure_artifact_root_symlink_rejected/,
    )

    const repoManifest = JSON.parse(readFileSync(
      join(process.cwd(), "docs/dna-intelligence/program/evidence/external-science-qa-current.json"),
      "utf8",
    ))
    const sameProjection = clone(repoManifest)
    sameProjection.recordedAt = "2099-01-01T00:00:00.000Z"
    assert.equal(assertManifestProjectionMatch(repoManifest, sameProjection), true)
    const drifted = clone(repoManifest)
    drifted.rawScores.naturalParaphraseAccuracy += 0.01
    assert.throws(
      () => assertManifestProjectionMatch(repoManifest, drifted),
      /external_science_qa_repo_manifest_drift/,
    )

    const atomicManifestPath = join(secureRoot, "manifest", "current.json")
    const manifestText = `${JSON.stringify(repoManifest, null, 2)}\n`
    const manifestWrite = secureAtomicWriteFile(secureRoot, atomicManifestPath, manifestText)
    assert.equal(readFileSync(atomicManifestPath, "utf8"), manifestText)
    assert.equal(canonicalSha256(JSON.parse(manifestText)), canonicalSha256(repoManifest))
    assert.equal(manifestWrite.bytes, Buffer.byteLength(manifestText))
    assert.equal(verifySecureFile(secureRoot, atomicManifestPath, manifestText).mode, 0o600)

    console.log(JSON.stringify({
      ok: true,
      positiveCases: 7,
      negativeCases: 8,
      atomicDeterminismRepeats: 20,
      symlinkCasesRejected: 4,
      pathEscapeRejected: true,
      tamperRejected: true,
      modeTamperRejected: true,
      manifestDriftRejected: true,
      exactReadbackVerified: true,
      outputMode: "0600",
    }, null, 2))
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
    rmSync(linkContainer, { recursive: true, force: true })
  }
}

try {
  run()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
