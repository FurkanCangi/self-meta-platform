#!/usr/bin/env node

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  canonicalSha256,
  runPrebookClosure,
  validatePrebookArtifacts,
  verifyPrebookClosure,
} from "./dna-prebook-closure.mjs"

const MODULE_PATH = fileURLToPath(import.meta.url)
const REPO_ROOT = resolve(dirname(MODULE_PATH), "..")
const RESEARCH_ROOT = process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function rawSha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function run() {
  const first = runPrebookClosure({ repoRoot: REPO_ROOT, researchRoot: RESEARCH_ROOT })
  const indexPath = join(first.outputRoot, "index.json")
  const packagePath = join(first.outputRoot, "external-science-candidate-package.json")
  const initialIndexSha256 = rawSha256(indexPath)
  const initialPackageSha256 = rawSha256(packagePath)

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const verified = verifyPrebookClosure({ researchRoot: RESEARCH_ROOT })
    assert(verified.validation.ok, `prebook_test_verify_iteration_${iteration}`)
    assert(verified.index.indexSha256 === first.index.indexSha256,
      `prebook_test_index_changed_iteration_${iteration}`)
    assert(rawSha256(indexPath) === initialIndexSha256,
      `prebook_test_index_file_changed_iteration_${iteration}`)
    assert(rawSha256(packagePath) === initialPackageSha256,
      `prebook_test_package_file_changed_iteration_${iteration}`)
    assert(canonicalSha256(verified.validation.counts)
      === canonicalSha256(first.index.validation.counts),
    `prebook_test_counts_changed_iteration_${iteration}`)
  }

  const second = runPrebookClosure({ repoRoot: REPO_ROOT, researchRoot: RESEARCH_ROOT })
  assert(second.index.indexSha256 === first.index.indexSha256,
    "prebook_test_resume_changed_index")
  assert(rawSha256(indexPath) === initialIndexSha256,
    "prebook_test_resume_rewrote_index_content")
  assert(rawSha256(packagePath) === initialPackageSha256,
    "prebook_test_resume_rewrote_package_content")

  const terminalTamper = clone(first.artifacts)
  terminalTamper.fullText.decisions[0].terminalStatus = "queued"
  assert(!validatePrebookArtifacts(terminalTamper).ok,
    "prebook_test_nonterminal_full_text_tamper_accepted")

  const passageTamper = clone(first.artifacts)
  passageTamper.candidatePackage.claims[0].passageId = null
  assert(!validatePrebookArtifacts(passageTamper).ok,
    "prebook_test_orphan_claim_tamper_accepted")

  const releaseTamper = clone(first.artifacts)
  releaseTamper.candidatePackage.runtimeEligible = true
  assert(!validatePrebookArtifacts(releaseTamper).ok,
    "prebook_test_runtime_activation_tamper_accepted")

  const approvalTamper = clone(first.artifacts)
  approvalTamper.variations.approvals.pop()
  assert(!validatePrebookArtifacts(approvalTamper).ok,
    "prebook_test_missing_variation_approval_accepted")

  const runtimeSelectionSource = readFileSync(
    join(REPO_ROOT, "src/lib/dna/chat/runtimeSelection.ts"), "utf8")
  const runtimeModeSource = readFileSync(
    join(REPO_ROOT, "src/lib/dna/chat/release/runtimeReleaseMode.ts"), "utf8")
  assert(runtimeSelectionSource.includes('return result("v2_legacy", allZero(input.loadedCounts)'),
    "prebook_test_v2_safe_selection_missing")
  assert(runtimeModeSource.includes('modeSource === "safe_default"\n    ? "v2"'),
    "prebook_test_v2_safe_default_missing")
  assert(runtimeModeSource.includes('execution, "v2_legacy", "kill_switch_v2_rollback"')
    || runtimeModeSource.includes('configuration, "v2_legacy", "kill_switch_v2_rollback"'),
  "prebook_test_v2_kill_switch_missing")

  assert(first.index.readiness.prebook_actionable_blockers === 0,
    "prebook_test_actionable_blockers_not_zero")
  assert(first.index.runtime.activeGeneration === "v2_legacy"
    && first.index.runtime.v3CandidateActivated === false,
  "prebook_test_v3_candidate_was_activated")

  console.log(JSON.stringify({
    ok: true,
    tests: {
      deterministicVerifications: 20,
      resumableRun: true,
      tamperCasesRejected: 4,
      v2SafeDefault: true,
      v2KillSwitch: true,
    },
    counts: first.index.counts,
    readiness: first.index.readiness,
  }, null, 2))
}

try {
  run()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
