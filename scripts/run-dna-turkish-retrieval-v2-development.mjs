#!/usr/bin/env node

import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  canonicalSha256,
  compileTurkishRetrievalV2Adapter,
  evaluateDevelopmentBank,
  validateTurkishRetrievalV2Adapter,
} from "./dna-turkish-retrieval-v2-development-core.mjs"
import {
  assertContained,
  readSecureFile,
  resolveSecureRoot,
  secureAtomicWriteFile,
  sha256Bytes,
  verifySecureFile,
} from "./lib/dna-secure-artifact-v2.mjs"

const CANDIDATE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
const BANK_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/evaluation/development-banks/turkish-retrieval-v2/development-bank.json"
const RESULT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-adapter/development-v2/result.json"
const CONFIG_RELATIVE_PATH =
  "docs/dna-intelligence/governance/v3/development-turkish-retrieval-v2-config.json"
const EVALUATOR_RELATIVE_PATH =
  "scripts/generated/dna-retrieval-evaluators/turkish-development-v2.mjs"
const COMPILER_RELATIVE_PATH =
  "scripts/dna-turkish-retrieval-v2-development-core.mjs"
const MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-development-v2-current.json"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(root, file, require0600 = false) {
  const read = readSecureFile(root, file, require0600)
  return { value: JSON.parse(read.text), fileSha256: read.sha256 }
}

export function loadTurkishRetrievalV2DevelopmentInputs(
  requestedResearchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD",
  requestedRepoRoot = process.cwd(),
) {
  const researchRoot = resolveSecureRoot(requestedResearchRoot, true)
  const repoRoot = resolveSecureRoot(requestedRepoRoot)
  const candidateRead = readJson(researchRoot,
    path.join(researchRoot, CANDIDATE_RELATIVE_PATH))
  const bankRead = readJson(researchRoot, path.join(researchRoot, BANK_RELATIVE_PATH), true)
  const configRead = readJson(repoRoot, path.join(repoRoot, CONFIG_RELATIVE_PATH))
  const evaluatorRead = readSecureFile(repoRoot, path.join(repoRoot, EVALUATOR_RELATIVE_PATH))
  const compilerRead = readSecureFile(repoRoot, path.join(repoRoot, COMPILER_RELATIVE_PATH))
  return {
    researchRoot,
    repoRoot,
    candidate: candidateRead.value,
    bank: bankRead.value,
    config: configRead.value,
    hashes: {
      candidateFileSha256: candidateRead.fileSha256,
      bankFileSha256: bankRead.fileSha256,
      configFileSha256: configRead.fileSha256,
      evaluatorCodeSha256: evaluatorRead.sha256,
      compilerCodeSha256: compilerRead.sha256,
    },
  }
}

function deterministicProjection(result) {
  return {
    schemaVersion: result.schemaVersion,
    adapterSha256: result.adapterSha256,
    developmentBankSha256: result.developmentBankSha256,
    counts: result.counts,
    families: result.families,
    familyHoldout: result.familyHoldout,
    splits: result.splits,
    transformations: result.transformations,
    metamorphic: result.metamorphic,
    gate: result.gate,
    failures: result.failures,
    records: result.records,
    boundaries: result.boundaries,
  }
}

export function buildTurkishRetrievalV2Development(inputs) {
  const adapter = compileTurkishRetrievalV2Adapter(inputs)
  validateTurkishRetrievalV2Adapter(adapter)
  const result = evaluateDevelopmentBank(adapter, inputs.bank)
  const repeats = Array.from({ length: 20 }, () => {
    const repeatedAdapter = compileTurkishRetrievalV2Adapter(inputs)
    const repeatedResult = evaluateDevelopmentBank(repeatedAdapter, inputs.bank)
    return {
      adapterSha256: repeatedAdapter.adapterSha256,
      resultSha256: canonicalSha256(deterministicProjection(repeatedResult)),
    }
  })
  const adapterHashes = new Set(repeats.map((repeat) => repeat.adapterSha256))
  const resultHashes = new Set(repeats.map((repeat) => repeat.resultSha256))
  assert(adapterHashes.size === 1 && resultHashes.size === 1,
    "retrieval_v2_twenty_run_determinism")
  assert(result.gate.p95Below25Milliseconds === true,
    "retrieval_v2_performance_gate")
  const resultBase = {
    ...result,
    provenance: "development_only_not_locked_holdout",
    determinism: {
      repeats: repeats.length,
      uniqueAdapterHashes: adapterHashes.size,
      uniqueResultHashes: resultHashes.size,
      deterministicResultSha256: repeats[0].resultSha256,
    },
    inputHashes: {
      candidatePackageSha256: inputs.candidate.packageSha256,
      candidateFileSha256: inputs.hashes.candidateFileSha256,
      developmentBankSha256: inputs.bank.bankSha256,
      developmentBankFileSha256: inputs.hashes.bankFileSha256,
      configFileSha256: inputs.hashes.configFileSha256,
      evaluatorCodeSha256: inputs.hashes.evaluatorCodeSha256,
      compilerCodeSha256: inputs.hashes.compilerCodeSha256,
      tuningQuestionIdsSha256: adapter.tuningQuestionIdsSha256,
      familyHoldoutQuestionIdsSha256: adapter.familyHoldoutQuestionIdsSha256,
      tuningAllowlistSha256: adapter.tuningAllowlistSha256,
    },
  }
  const resultWithHash = {
    ...resultBase,
    resultSha256: canonicalSha256({
      ...deterministicProjection(result),
      provenance: resultBase.provenance,
      determinism: resultBase.determinism,
      inputHashes: resultBase.inputHashes,
      performanceGate: {
        evaluations: result.performance.evaluations,
        p95Below25Milliseconds: result.gate.p95Below25Milliseconds,
      },
    }),
  }
  return { adapter, result: resultWithHash }
}

function aggregateManifest(inputs, adapter, result, rawSha256) {
  return {
    schemaVersion: "dna-turkish-retrieval-v2-development-manifest@1",
    recordedAt: inputs.candidate.basisAt,
    version: "turkish-retrieval-v2",
    provenance: result.provenance,
    inputHashes: result.inputHashes,
    adapter: {
      adapterSha256: adapter.adapterSha256,
      topics: adapter.counts.topics,
      trainingQuestions: adapter.counts.trainingQuestions,
      familyHoldoutQuestions: adapter.counts.familyHoldoutQuestions,
      tuningAllowlistTokens: adapter.counts.tuningAllowlistTokens,
      unsupportedTokens: adapter.counts.unsupportedTokens,
    },
    result: {
      researchSsdRelativePath: RESULT_RELATIVE_PATH,
      rawSha256,
      resultSha256: result.resultSha256,
      questions: result.counts.questions,
      correct: result.counts.correct,
      incorrect: result.counts.incorrect,
      families: result.families,
      familyHoldout: result.familyHoldout,
      splits: result.splits,
      metamorphic: result.metamorphic,
      performance: result.performance,
      gate: result.gate,
      determinism: result.determinism,
    },
    boundaries: {
      developmentOnly: true,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      lockedHoldoutAccessed: false,
      officialEvaluationAuthority: false,
    },
  }
}

function assertAggregateOnly(manifest, bank) {
  const serialized = JSON.stringify(manifest)
  for (const question of bank.questions) {
    assert(!serialized.includes(question.question),
      "retrieval_v2_manifest_question_text_leak")
  }
  return true
}

export function runTurkishRetrievalV2Development() {
  const inputs = loadTurkishRetrievalV2DevelopmentInputs()
  const { adapter, result } = buildTurkishRetrievalV2Development(inputs)
  const resultText = `${JSON.stringify(result, null, 2)}\n`
  const resultRawSha256 = sha256Bytes(resultText)
  const manifest = aggregateManifest(inputs, adapter, result, resultRawSha256)
  assertAggregateOnly(manifest, inputs.bank)
  if (process.argv.includes("--write-result")) {
    const resultPath = assertContained(inputs.researchRoot,
      path.join(inputs.researchRoot, RESULT_RELATIVE_PATH))
    secureAtomicWriteFile(inputs.researchRoot, resultPath, resultText)
    verifySecureFile(inputs.researchRoot, resultPath, resultText)
  }
  if (process.argv.includes("--write-manifest")) {
    const manifestPath = assertContained(inputs.repoRoot,
      path.join(inputs.repoRoot, MANIFEST_RELATIVE_PATH))
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
    secureAtomicWriteFile(inputs.repoRoot, manifestPath, manifestText)
    verifySecureFile(inputs.repoRoot, manifestPath, manifestText)
  }
  console.log(JSON.stringify({
    ok: result.gate.developmentGate === "pass",
    version: "turkish-retrieval-v2",
    counts: result.counts,
    families: result.families,
    familyHoldout: result.familyHoldout,
    splits: result.splits,
    metamorphic: result.metamorphic,
    performance: result.performance,
    gate: result.gate,
    determinism: result.determinism,
    adapterSha256: adapter.adapterSha256,
    resultSha256: result.resultSha256,
    rawSha256: resultRawSha256,
    boundaries: result.boundaries,
  }, null, 2))
  if (result.gate.developmentGate !== "pass") process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    runTurkishRetrievalV2Development()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
