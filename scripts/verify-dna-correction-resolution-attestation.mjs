#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  REQUIRED_CORRECTION_CHECKS,
  buildDnaCorrectionResolutionAttestation,
  sha256,
  validateDnaCorrectionResolutionAttestation,
} from "./dna-correction-resolution-lib.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const contractPath = resolve(
  repositoryRoot,
  "docs/dna-intelligence/governance/v3/correction-resolution-contract.json",
)
const snapshotPath = resolve(
  repositoryRoot,
  "docs/dna-intelligence/governance/v3/correction-resolution-attestations/tripod-ai-2024.json",
)
const contract = JSON.parse(readFileSync(contractPath, "utf8"))
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"))

assert.equal(contract.schemaVersion, "dna-correction-resolution-contract@1")
assert.deepEqual([...contract.requiredChecks].sort(), [...REQUIRED_CORRECTION_CHECKS].sort())
const validation = validateDnaCorrectionResolutionAttestation(snapshot)
assert.deepEqual(validation, { ok: true, errors: [] })
assert.equal(snapshot.decision.status, "verified_applied")
assert.equal(snapshot.decision.sourceIntegrityResolution, "applied")
assert.equal(snapshot.decision.affectedScope, "author_affiliations_only")
assert.equal(snapshot.decision.scientificClaimImpact, "not_indicated_by_official_notice")

function rebuildInput(attestation) {
  return {
    attestationId: attestation.attestationId,
    checkedAt: attestation.checkedAt,
    source: {
      ...attestation.source,
      manifestArtifactHashesMatch: true,
    },
    correctionNotice: { ...attestation.correctionNotice },
    artifacts: structuredClone(attestation.artifacts),
  }
}

const rebuilt = buildDnaCorrectionResolutionAttestation(rebuildInput(snapshot))
assert.equal(rebuilt.attestationSha256, snapshot.attestationSha256)
assert.deepEqual(rebuilt, snapshot)

const ambiguousScopeInput = rebuildInput(snapshot)
ambiguousScopeInput.correctionNotice.scope = "unresolved"
ambiguousScopeInput.correctionNotice.otherAffectedFieldsIndicated = true
const ambiguousScope = buildDnaCorrectionResolutionAttestation(ambiguousScopeInput)
assert.equal(ambiguousScope.decision.status, "pending")
assert.equal(ambiguousScope.decision.sourceIntegrityResolution, "pending")
assert.ok(ambiguousScope.reasonCodes.includes(
  "correction_scope_is_not_explicitly_limited_to_author_affiliations",
))

const staleJatsInput = rebuildInput(snapshot)
staleJatsInput.artifacts.jats.remoteSha256 = "0".repeat(64)
const staleJats = buildDnaCorrectionResolutionAttestation(staleJatsInput)
assert.equal(staleJats.decision.status, "pending")
assert.ok(staleJats.reasonCodes.includes(
  "local_jats_is_not_the_hash_identical_current_authority_snapshot",
))

const stalePdfInput = rebuildInput(snapshot)
stalePdfInput.artifacts.pdf.remoteBytes += 1
const stalePdf = buildDnaCorrectionResolutionAttestation(stalePdfInput)
assert.equal(stalePdf.decision.status, "pending")
assert.ok(stalePdf.reasonCodes.includes(
  "local_pdf_is_not_hash_identical_to_the_bound_repository_snapshot",
))

const tampered = structuredClone(snapshot)
tampered.source.doi = "10.0000/tampered"
assert.ok(validateDnaCorrectionResolutionAttestation(tampered).errors.includes(
  "attestation_hash_mismatch",
))

const fakeApplied = structuredClone(ambiguousScope)
fakeApplied.decision.sourceIntegrityResolution = "applied"
const { attestationSha256: _oldHash, ...fakeAppliedBody } = fakeApplied
fakeApplied.attestationSha256 = sha256(fakeAppliedBody)
assert.ok(validateDnaCorrectionResolutionAttestation(fakeApplied).errors.includes(
  "pending_attestation_not_mapped_to_pending",
))

if (process.argv.includes("--ssd")) {
  const researchSsdRoot = process.env.RESEARCH_SSD_ROOT
  assert.ok(researchSsdRoot, "RESEARCH_SSD_ROOT is required with --ssd")
  const result = spawnSync(
    process.execPath,
    [resolve(repositoryRoot, "scripts/audit-dna-correction-resolution-online.mjs"), "--offline-verify"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, RESEARCH_SSD_ROOT: researchSsdRoot },
      timeout: 60_000,
    },
  )
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const ssdResult = JSON.parse(result.stdout)
  assert.equal(ssdResult.ok, true)
  assert.equal(ssdResult.attestationSha256, snapshot.attestationSha256)
}

console.log(JSON.stringify({
  ok: true,
  schemaVersion: snapshot.schemaVersion,
  status: snapshot.decision.status,
  requiredChecks: REQUIRED_CORRECTION_CHECKS.length,
  passedChecks: snapshot.checks.filter((item) => item.status === "passed").length,
  failClosedMutationTests: 5,
  attestationSha256: snapshot.attestationSha256,
  ssdArchiveVerified: process.argv.includes("--ssd"),
}, null, 2))
