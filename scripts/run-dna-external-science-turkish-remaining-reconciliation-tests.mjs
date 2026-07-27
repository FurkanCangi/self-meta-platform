#!/usr/bin/env node

import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  buildDirectivesFromSpec,
  FIDELITY_DIMENSIONS,
  loadProductionInputs,
  renderOutputs,
} from "./dna-external-science-turkish-remaining-reconciliation.mjs"
import { stableSha256 } from "./dna-external-science-turkish-full-coverage-workpacks.mjs"
import {
  assertResearchSsdPath,
  atomicWrite,
  canonicalJson,
  sha256Bytes,
} from "./lib/dna-v3-blind-holdout-io.mjs"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SCRIPT = join(REPO_ROOT, "scripts/dna-external-science-turkish-remaining-reconciliation.mjs")
const AUTHOR_SPEC = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-remaining-reconciliation/prebook-v1/neutral-review-directive-author-spec.json"

const passed = []

function assert(condition, code) {
  if (!condition) throw new Error(code)
}

function test(name, callback) {
  callback()
  passed.push(name)
}

function expectThrow(callback, code) {
  let threw = false
  try {
    callback()
  } catch {
    threw = true
  }
  assert(threw, code)
}

function reseal(value, key) {
  delete value[key]
  value[key] = stableSha256(value)
}

function run(args, expectedSuccess) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" })
  assert((result.status === 0) === expectedSuccess,
    `remaining_reconcile_cli_unexpected:${result.status}:${result.stderr}`)
}

function main() {
  const input = loadProductionInputs("/Volumes/ResearchSSD")
  let rendered

  test("20x byte-identical determinism", () => {
    const hashes = new Set()
    for (let index = 0; index < 20; index += 1) {
      const result = renderOutputs(structuredClone(input))
      hashes.add([
        sha256Bytes(result.artifactBytes),
        sha256Bytes(result.coverageBytes),
        sha256Bytes(result.manifestBytes),
        sha256Bytes(result.coverageManifestBytes),
      ].join(":"))
      rendered ??= result
    }
    assert(hashes.size === 1, "remaining_reconcile_nondeterministic")
  })

  test("178 terminal and exact decision distribution", () => {
    assert(rendered.artifact.counts.records === 178 && rendered.artifact.counts.terminal === 178
      && rendered.artifact.counts.finalized === 178 && rendered.artifact.counts.quarantined === 0,
    "remaining_reconcile_counts")
    assert(JSON.stringify(rendered.artifact.decisionCounts) === JSON.stringify({
      exact_match: 15,
      prefer_a: 8,
      prefer_b: 29,
      quarantine: 0,
      reconciled_revision: 1,
      semantically_equivalent: 125,
    }), "remaining_reconcile_decision_counts")
  })

  test("five Pass B audit revisions exact-bound and resolved", () => {
    const flagged = new Map(input.passBAudit.records
      .filter((record) => record.decision.status === "needs_revision")
      .map((record) => [record.claimId, record]))
    assert(flagged.size === 5, "remaining_reconcile_b_flag_count")
    const resolved = rendered.artifact.records.filter((record) => flagged.has(record.claimId))
    assert(resolved.length === 5, "remaining_reconcile_b_flag_coverage")
    for (const record of resolved) {
      assert(["prefer_a", "reconciled_revision", "quarantine"].includes(record.decision.terminal),
        "remaining_reconcile_b_flag_bad_terminal")
      assert(record.bindings.passBAuditRecordSha256 === flagged.get(record.claimId).recordSha256,
        "remaining_reconcile_b_flag_audit_hash")
      assert(record.bindings.passBRecordSha256 === flagged.get(record.claimId).bindings.passBRecordSha256,
        "remaining_reconcile_b_flag_record_hash")
    }
  })

  test("reconciled revision is source-bound and safe", () => {
    const revisions = rendered.artifact.records
      .filter((record) => record.decision.terminal === "reconciled_revision")
    assert(revisions.length === 1 && revisions[0].finalRenderingSha256
      && FIDELITY_DIMENSIONS.every((dimension) => revisions[0].decision.fidelity[dimension] === true),
    "remaining_reconcile_revision_gate")
    assert(!/\bDNA\b|tanı koy|tedavi öner/i.test(revisions[0].finalRendering),
      "remaining_reconcile_revision_added_inference")
  })

  test("42 immutable plus 178 equals exact 220", () => {
    assert(rendered.coverage.counts.existingImmutable === 42
      && rendered.coverage.counts.newlyReconciled === 178
      && rendered.coverage.counts.exactUnion === 220
      && rendered.coverage.counts.duplicateClaims === 0
      && rendered.coverage.counts.missingClaims === 0
      && rendered.coverage.counts.extraClaims === 0,
    "remaining_reconcile_coverage")
    assert(rendered.coverage.input.existing42ArtifactSha256 === input.existing42.artifactSha256,
      "remaining_reconcile_existing_hash_binding")
  })

  test("repository manifests contain no identity or text", () => {
    const text = `${rendered.manifestBytes}\n${rendered.coverageManifestBytes}`
    for (const key of ["claimId", "sourceId", "passageId", "workItemId", "turkishRendering",
      "finalRendering", "proposition", "passageText"]) {
      assert(!text.includes(`\"${key}\"`), `remaining_reconcile_manifest_key_leak:${key}`)
    }
    for (const record of rendered.artifact.records) {
      assert(!text.includes(record.claimId) && !text.includes(record.renderings.passA)
        && !text.includes(record.renderings.passB), "remaining_reconcile_manifest_value_leak")
    }
  })

  test("canonical candidate tamper rejected", () => {
    const tampered = structuredClone(input)
    tampered.candidate.claims[0].proposition += " tamper"
    expectThrow(() => renderOutputs(tampered), "remaining_reconcile_candidate_tamper_accepted")
  })

  test("Pass A rendering tamper rejected", () => {
    const tampered = structuredClone(input)
    tampered.passA.records[0].turkishRendering += " tamper"
    expectThrow(() => renderOutputs(tampered), "remaining_reconcile_pass_a_tamper_accepted")
  })

  test("Pass B binding tamper with rehash rejected", () => {
    const tampered = structuredClone(input)
    tampered.passB.records[0].claimId = tampered.passB.records[1].claimId
    reseal(tampered.passB.records[0], "recordSha256")
    reseal(tampered.passB, "artifactSha256")
    expectThrow(() => renderOutputs(tampered), "remaining_reconcile_pass_b_binding_tamper_accepted")
  })

  test("Pass B audit downgrade bypass rejected", () => {
    const tampered = structuredClone(input)
    const flagged = tampered.passBAudit.records.find((record) => record.decision.status === "needs_revision")
    flagged.decision.status = "pass"
    reseal(flagged, "recordSha256")
    reseal(tampered.passBAudit, "artifactSha256")
    expectThrow(() => renderOutputs(tampered), "remaining_reconcile_pass_b_audit_tamper_accepted")
  })

  test("existing 42 tamper rejected", () => {
    const tampered = structuredClone(input)
    tampered.existing42.records[0].finalRendering += " tamper"
    reseal(tampered.existing42.records[0], "recordSha256")
    reseal(tampered.existing42, "artifactSha256")
    expectThrow(() => renderOutputs(tampered), "remaining_reconcile_existing_tamper_accepted")
  })

  test("flagged B cannot become semantic-equivalent", () => {
    const tampered = structuredClone(input)
    const auditFlag = tampered.passBAudit.records.find((record) => record.decision.status === "needs_revision")
    const artifactRecord = rendered.artifact.records.find((record) => record.claimId === auditFlag.claimId)
    const directive = tampered.directives.decisions.find((entry) => entry.ordinal === artifactRecord.ordinal)
    directive.terminalDecision = "semantically_equivalent"
    directive.selectedSide = "a"
    reseal(tampered.directives, "directivesSha256")
    expectThrow(() => renderOutputs(tampered), "remaining_reconcile_flag_semantic_bypass")
  })

  test("quarantine is hidden in artifact and coverage", () => {
    const quarantinedInput = structuredClone(input)
    const auditPass = quarantinedInput.passBAudit.records.find((record) => record.decision.status === "pass")
    const baseRecord = rendered.artifact.records.find((record) => record.claimId === auditPass.claimId)
    const directive = quarantinedInput.directives.decisions.find((entry) => entry.ordinal === baseRecord.ordinal)
    directive.terminalDecision = "quarantine"
    directive.selectedSide = "none"
    directive.reason = "test_quarantine"
    directive.reconciledRevision = null
    directive.reconciledRevisionSha256 = null
    reseal(quarantinedInput.directives, "directivesSha256")
    const result = renderOutputs(quarantinedInput)
    const record = result.artifact.records.find((entry) => entry.claimId === auditPass.claimId)
    const coverage = result.coverage.records.find((entry) => entry.claimId === auditPass.claimId)
    assert(record.visibility === "hidden_quarantine" && record.finalRendering === null
      && record.finalRenderingSha256 === null && coverage.visibility === "hidden_quarantine",
    "remaining_reconcile_quarantine_visible")
  })

  const testRoot = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-remaining-reconciliation-tests/${randomUUID()}`
  mkdirSync(testRoot, { recursive: true, mode: 0o700 })
  try {
    test("0600 input mode enforced", () => {
      const loose = join(testRoot, "loose-spec.json")
      copyFileSync(AUTHOR_SPEC, loose)
      chmodSync(loose, 0o644)
      run(["--author-spec", loose, "--directives-output", join(testRoot, "loose-output.json")], false)
    })

    test("input symlink rejected", () => {
      const link = join(testRoot, "spec-link.json")
      symlinkSync(AUTHOR_SPEC, link)
      run(["--author-spec", link, "--directives-output", join(testRoot, "link-output.json")], false)
    })

    test("local fallback rejected", () => {
      run(["--ssd-root", "/tmp", "--author-spec", AUTHOR_SPEC,
        "--directives-output", join(testRoot, "fallback-output.json")], false)
    })

    test("atomic 0600 write and collision refusal", () => {
      const output = join(testRoot, "atomic-output.json")
      assertResearchSsdPath(output, "test output")
      atomicWrite(output, rendered.artifactBytes, 0o600)
      assert((statSync(output).mode & 0o777) === 0o600 && !lstatSync(output).isSymbolicLink(),
        "remaining_reconcile_output_mode")
      const before = readFileSync(output)
      expectThrow(() => atomicWrite(output, "replacement", 0o600),
        "remaining_reconcile_atomic_collision_accepted")
      assert(readFileSync(output).equals(before), "remaining_reconcile_atomic_collision_mutated")
    })

    test("output symlink rejected", () => {
      const target = join(testRoot, "target.json")
      const link = join(testRoot, "output-link.json")
      atomicWrite(target, "{}\n", 0o600)
      symlinkSync(target, link)
      expectThrow(() => assertResearchSsdPath(link, "symlink output"),
        "remaining_reconcile_output_symlink_accepted")
    })
  } finally {
    rmSync(testRoot, { recursive: true, force: true })
  }

  process.stdout.write(`${JSON.stringify({ ok: true, assertions: passed.length, tests: passed })}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
