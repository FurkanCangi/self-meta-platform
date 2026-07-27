#!/usr/bin/env node

import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  validateTurkishRetrievalV2Adapter,
} from "./dna-turkish-retrieval-v2-development-core.mjs"
import {
  buildTurkishRetrievalV2Development,
  loadTurkishRetrievalV2DevelopmentInputs,
} from "./run-dna-turkish-retrieval-v2-development.mjs"
import {
  assertContained,
  secureAtomicWriteFile,
  sha256Bytes,
  verifySecureFile,
} from "./lib/dna-secure-artifact-v2.mjs"

const ADAPTER_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/evaluation/frozen-adapters/turkish-retrieval-v2/adapter.json"
const MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-v2-frozen-current.json"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function buildFrozenTurkishRetrievalV2(inputs) {
  const { adapter, result } = buildTurkishRetrievalV2Development(inputs)
  validateTurkishRetrievalV2Adapter(adapter)
  assert(result.gate.developmentGate === "pass",
    "retrieval_v2_freeze_development_gate_failed")
  assert(result.counts.incorrect === 0
    && result.familyHoldout.unsupported.accuracy === 1,
  "retrieval_v2_freeze_accuracy_gate_failed")
  assert(adapter.runtimeEligible === false && adapter.releaseEligible === false
    && adapter.activationAllowed === false && adapter.lockedHoldoutAccessed === false,
  "retrieval_v2_freeze_boundary_failed")
  const adapterText = `${JSON.stringify(adapter, null, 2)}\n`
  const adapterFileSha256 = sha256Bytes(adapterText)
  const manifest = {
    schemaVersion: "dna-turkish-retrieval-v2-frozen-manifest@1",
    recordedAt: inputs.candidate.basisAt,
    version: "turkish-retrieval-v2",
    adapter: {
      researchSsdRelativePath: ADAPTER_RELATIVE_PATH,
      adapterSha256: adapter.adapterSha256,
      adapterFileSha256,
      fileMode: "0600",
      topics: adapter.counts.topics,
      trainingQuestions: adapter.counts.trainingQuestions,
      familyHoldoutQuestions: adapter.counts.familyHoldoutQuestions,
      tuningQuestionIdsSha256: adapter.tuningQuestionIdsSha256,
      familyHoldoutQuestionIdsSha256: adapter.familyHoldoutQuestionIdsSha256,
      tuningAllowlistSha256: adapter.tuningAllowlistSha256,
      evaluatorCodeSha256: adapter.evaluatorCodeSha256,
      compilerCodeSha256: adapter.compilerCodeSha256,
      configFileSha256: adapter.configFileSha256,
      developmentBankSha256: adapter.developmentBankSha256,
      developmentBankFileSha256: adapter.developmentBankFileSha256,
    },
    developmentGate: {
      status: result.gate.developmentGate,
      questions: result.counts.questions,
      correct: result.counts.correct,
      incorrect: result.counts.incorrect,
      familyHoldout: result.familyHoldout,
      metamorphic: result.metamorphic,
      p95Milliseconds: result.performance.p95Milliseconds,
      deterministicRepeats: result.determinism.repeats,
      uniqueAdapterHashes: result.determinism.uniqueAdapterHashes,
      uniqueResultHashes: result.determinism.uniqueResultHashes,
    },
    boundaries: {
      developmentOnly: true,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      ownerBookAuthority: false,
      lockedHoldoutAccessed: false,
      officialEvaluationAuthority: false,
    },
  }
  return { adapter, adapterText, adapterFileSha256, manifest, result }
}

export function freezeTurkishRetrievalV2() {
  const inputs = loadTurkishRetrievalV2DevelopmentInputs()
  const frozen = buildFrozenTurkishRetrievalV2(inputs)
  const write = process.argv.includes("--write")
  if (write) {
    const adapterPath = assertContained(inputs.researchRoot,
      path.join(inputs.researchRoot, ADAPTER_RELATIVE_PATH))
    secureAtomicWriteFile(inputs.researchRoot, adapterPath, frozen.adapterText)
    verifySecureFile(inputs.researchRoot, adapterPath, frozen.adapterText)
    const manifestPath = assertContained(inputs.repoRoot,
      path.join(inputs.repoRoot, MANIFEST_RELATIVE_PATH))
    const manifestText = `${JSON.stringify(frozen.manifest, null, 2)}\n`
    secureAtomicWriteFile(inputs.repoRoot, manifestPath, manifestText)
    verifySecureFile(inputs.repoRoot, manifestPath, manifestText)
  }
  console.log(JSON.stringify({
    ok: true,
    written: write,
    version: "turkish-retrieval-v2",
    adapterSha256: frozen.adapter.adapterSha256,
    adapterFileSha256: frozen.adapterFileSha256,
    counts: frozen.adapter.counts,
    developmentGate: frozen.result.gate,
    familyHoldout: frozen.result.familyHoldout,
    determinism: frozen.result.determinism,
    boundaries: frozen.manifest.boundaries,
  }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    freezeTurkishRetrievalV2()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
