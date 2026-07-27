#!/usr/bin/env node

import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
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
  const existingRoot = join(RESEARCH_ROOT,
    "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1")
  const existingFullTextPath = join(existingRoot, "full-text-decisions.json")
  const existingWorkpackPath = join(existingRoot, "workpack-decisions.json")
  const existingFullTextSha256 = existsSync(existingFullTextPath)
    ? rawSha256(existingFullTextPath) : null
  const existingWorkpackSha256 = existsSync(existingWorkpackPath)
    ? rawSha256(existingWorkpackPath) : null
  const first = runPrebookClosure({ repoRoot: REPO_ROOT, researchRoot: RESEARCH_ROOT })
  const indexPath = join(first.outputRoot, "index.json")
  const packagePath = join(first.outputRoot, "external-science-candidate-package.json")
  const historicalSourcePath = join(first.outputRoot, "historical-source-decisions.json")
  const initialIndexSha256 = rawSha256(indexPath)
  const initialPackageSha256 = rawSha256(packagePath)
  const initialHistoricalSourceSha256 = rawSha256(historicalSourcePath)
  assert(existingFullTextSha256 === null
    || rawSha256(existingFullTextPath) === existingFullTextSha256,
  "prebook_test_existing_full_text_ledger_regenerated")
  assert(existingWorkpackSha256 === null
    || rawSha256(existingWorkpackPath) === existingWorkpackSha256,
  "prebook_test_existing_workpack_ledger_regenerated")
  assert((statSync(historicalSourcePath).mode & 0o777) === 0o600,
    "prebook_test_historical_source_ledger_not_0600")

  for (let iteration = 0; iteration < 20; iteration += 1) {
    const verified = verifyPrebookClosure({ researchRoot: RESEARCH_ROOT })
    assert(verified.validation.ok, `prebook_test_verify_iteration_${iteration}`)
    assert(verified.index.indexSha256 === first.index.indexSha256,
      `prebook_test_index_changed_iteration_${iteration}`)
    assert(rawSha256(indexPath) === initialIndexSha256,
      `prebook_test_index_file_changed_iteration_${iteration}`)
    assert(rawSha256(packagePath) === initialPackageSha256,
      `prebook_test_package_file_changed_iteration_${iteration}`)
    assert(rawSha256(historicalSourcePath) === initialHistoricalSourceSha256,
      `prebook_test_historical_source_file_changed_iteration_${iteration}`)
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
  assert(rawSha256(historicalSourcePath) === initialHistoricalSourceSha256,
    "prebook_test_resume_rewrote_historical_source_content")

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

  const historicalTerminalTamper = clone(first.artifacts)
  historicalTerminalTamper.historicalSources.decisions[0].terminalStatus = "queued"
  assert(!validatePrebookArtifacts(historicalTerminalTamper).ok,
    "prebook_test_nonterminal_historical_source_tamper_accepted")

  const historicalEvidenceTamper = clone(first.artifacts)
  historicalEvidenceTamper.historicalSources.decisions[0]
    .evidence.sourceInventory.rawBytesSha256 = "0".repeat(64)
  assert(!validatePrebookArtifacts(historicalEvidenceTamper).ok,
    "prebook_test_historical_source_evidence_tamper_accepted")

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
      tamperCasesRejected: 6,
      historicalSourcesTerminalized: first.artifacts.historicalSources.decisions.length,
      historicalStatusCounts: first.artifacts.historicalSources.counts.byStatus,
      historicalLedgerMode: "0600",
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
