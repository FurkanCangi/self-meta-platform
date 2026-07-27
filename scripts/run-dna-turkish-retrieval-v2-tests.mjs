#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  canonicalSha256,
  compileTurkishRetrievalV2Adapter,
  evaluateDevelopmentBank,
  validateTurkishRetrievalV2Adapter,
} from "./dna-turkish-retrieval-v2-development-core.mjs"
import {
  buildTurkishRetrievalV2Development,
  loadTurkishRetrievalV2DevelopmentInputs,
} from "./run-dna-turkish-retrieval-v2-development.mjs"
import {
  resolveSecureRoot,
  secureAtomicWriteFile,
  verifySecureFile,
} from "./lib/dna-secure-artifact-v2.mjs"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function clone(value) {
  return structuredClone(value)
}

function omit(value, key) {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function expectFailure(label, pattern, operation) {
  let thrown
  try {
    operation()
  } catch (error) {
    thrown = error
  }
  assert(thrown instanceof Error, `retrieval_v2_negative_test_missing:${label}`)
  assert(pattern.test(thrown.message),
    `retrieval_v2_negative_test_wrong_error:${label}:${thrown.message}`)
}

function securityTests() {
  const base = fs.realpathSync(".tmp")
  const root = fs.mkdtempSync(path.join(base, "dna-retrieval-v2-security-"))
  try {
    const target = path.join(root, "nested", "adapter.json")
    const content = "secure-v2-adapter-fixture\n"
    const writes = Array.from({ length: 20 }, () =>
      secureAtomicWriteFile(root, target, content))
    assert(new Set(writes.map((write) => write.sha256)).size === 1,
      "retrieval_v2_secure_write_determinism")
    verifySecureFile(root, target, content)
    assert((fs.statSync(target).mode & 0o777) === 0o600,
      "retrieval_v2_secure_mode")

    fs.writeFileSync(target, "tampered\n", { mode: 0o600 })
    expectFailure("content_tamper", /readback_mismatch/, () =>
      verifySecureFile(root, target, content))

    secureAtomicWriteFile(root, target, content)
    fs.chmodSync(target, 0o644)
    expectFailure("mode_tamper", /mode_invalid/, () =>
      verifySecureFile(root, target, content))

    expectFailure("path_escape", /path_escape/, () =>
      secureAtomicWriteFile(root, path.join(root, "..", "escape.json"), content))

    const leaf = path.join(root, "leaf.json")
    const destination = path.join(root, "destination.json")
    fs.writeFileSync(destination, "destination\n", { mode: 0o600 })
    fs.symlinkSync(destination, leaf)
    expectFailure("leaf_symlink", /output_symlink_rejected/, () =>
      secureAtomicWriteFile(root, leaf, content))

    const outside = fs.mkdtempSync(path.join(base, "dna-retrieval-v2-outside-"))
    try {
      const parentLink = path.join(root, "parent-link")
      fs.symlinkSync(outside, parentLink)
      expectFailure("parent_symlink", /parent_symlink_rejected/, () =>
        secureAtomicWriteFile(root, path.join(parentLink, "adapter.json"), content))
    } finally {
      fs.rmSync(outside, { recursive: true, force: true })
    }

    const rootLink = `${root}-link`
    fs.symlinkSync(root, rootLink)
    try {
      expectFailure("root_symlink", /root_symlink_rejected/, () =>
        resolveSecureRoot(rootLink))
    } finally {
      fs.rmSync(rootLink, { force: true })
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function main() {
  fs.mkdirSync(".tmp", { recursive: true })
  const inputs = loadTurkishRetrievalV2DevelopmentInputs()
  const { adapter, result } = buildTurkishRetrievalV2Development(inputs)
  validateTurkishRetrievalV2Adapter(adapter)

  assert(inputs.bank.counts.newDevelopmentOnly === 560
    && inputs.bank.counts.total === 708
    && inputs.bank.counts.tuning === 280
    && inputs.bank.counts.familyHoldout === 280,
  "retrieval_v2_bank_expected_counts")
  assert((fs.statSync(path.join(inputs.researchRoot,
    "Datasets/DNA-Intelligence/evaluation/development-banks/turkish-retrieval-v2/development-bank.json"))
    .mode & 0o777) === 0o600, "retrieval_v2_bank_mode")
  assert(result.counts.questions === 708 && result.counts.incorrect === 0,
    "retrieval_v2_exact_development_score")
  assert(Object.values(result.familyHoldout).every((family) => family.accuracy >= 0.95)
    && result.familyHoldout.unsupported.accuracy === 1,
  "retrieval_v2_family_gate")
  assert(Object.values(result.transformations).every((transformation) =>
    transformation.accuracy >= 0.95), "retrieval_v2_transformation_gate")
  assert(result.metamorphic.accuracy === 1 && result.gate.developmentGate === "pass",
    "retrieval_v2_metamorphic_gate")
  assert(result.performance.p95Milliseconds < 25,
    "retrieval_v2_performance_gate")
  assert(result.determinism.repeats === 20
    && result.determinism.uniqueAdapterHashes === 1
    && result.determinism.uniqueResultHashes === 1,
  "retrieval_v2_determinism_gate")
  assert(result.records.every((record) => record.actualDecision === record.expectedDecision
    && (record.expectedDecision !== "route"
      ? record.actualTopicId === null
      : record.actualTopicId === record.expectedTopicId)),
  "retrieval_v2_exact_decision_scoring")

  const evaluatorPath = path.join(inputs.repoRoot,
    "scripts/generated/dna-retrieval-evaluators/turkish-development-v2.mjs")
  const evaluatorCode = fs.readFileSync(evaluatorPath, "utf8")
  assert(!/^\s*import\b/m.test(evaluatorCode), "retrieval_v2_evaluator_import_forbidden")
  assert(!/\b(?:require|process|console|fetch|XMLHttpRequest|WebSocket)\b/.test(evaluatorCode),
    "retrieval_v2_evaluator_side_effect_surface")
  assert(!/node:|\bfs\b|https?:\/\//.test(evaluatorCode),
    "retrieval_v2_evaluator_external_surface")

  const tamperedBankInputs = clone(inputs)
  tamperedBankInputs.bank.questions[0].question += " x"
  expectFailure("bank_content_tamper", /bank_hash/, () =>
    compileTurkishRetrievalV2Adapter(tamperedBankInputs))

  const boundaryInputs = clone(inputs)
  boundaryInputs.config.boundaries.runtimeEligible = true
  expectFailure("config_boundary", /config_boundary/, () =>
    compileTurkishRetrievalV2Adapter(boundaryInputs))

  const allowlistTamper = clone(adapter)
  const firstTopic = Object.keys(allowlistTamper.tuningAllowlist)[0]
  allowlistTamper.tuningAllowlist[firstTopic].push("tampered-token")
  allowlistTamper.adapterSha256 = canonicalSha256(omit(allowlistTamper, "adapterSha256"))
  expectFailure("allowlist_hash", /allowlist_hash/, () =>
    validateTurkishRetrievalV2Adapter(allowlistTamper))

  const adapterBoundary = clone(adapter)
  adapterBoundary.runtimeEligible = true
  adapterBoundary.adapterSha256 = canonicalSha256(omit(adapterBoundary, "adapterSha256"))
  expectFailure("adapter_boundary", /adapter_boundary/, () =>
    validateTurkishRetrievalV2Adapter(adapterBoundary))

  const reboundBank = clone(inputs.bank)
  reboundBank.questions[0].question += " changed"
  reboundBank.bankSha256 = canonicalSha256(omit(reboundBank, "bankSha256"))
  expectFailure("adapter_bank_binding", /adapter_bank_binding/, () =>
    evaluateDevelopmentBank(adapter, reboundBank))

  const serializedAdapter = JSON.stringify(adapter)
  assert(inputs.bank.questions.every((question) =>
    !serializedAdapter.includes(question.question)),
  "retrieval_v2_adapter_question_text_leak")

  const manifestPath = path.join(inputs.repoRoot,
    "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-development-v2-current.json")
  if (fs.existsSync(manifestPath)) {
    const manifest = fs.readFileSync(manifestPath, "utf8")
    assert(inputs.bank.questions.every((question) => !manifest.includes(question.question)),
      "retrieval_v2_manifest_question_text_leak")
  }
  const frozenPath = path.join(inputs.researchRoot,
    "Datasets/DNA-Intelligence/evaluation/frozen-adapters/turkish-retrieval-v2/adapter.json")
  if (fs.existsSync(frozenPath)) {
    assert((fs.statSync(frozenPath).mode & 0o777) === 0o600,
      "retrieval_v2_frozen_mode")
    const frozen = JSON.parse(fs.readFileSync(frozenPath, "utf8"))
    validateTurkishRetrievalV2Adapter(frozen)
    assert(frozen.adapterSha256 === adapter.adapterSha256,
      "retrieval_v2_frozen_drift")
  }
  securityTests()

  console.log(JSON.stringify({
    ok: true,
    counts: result.counts,
    familyHoldout: result.familyHoldout,
    transformations: Object.keys(result.transformations).length,
    metamorphic: result.metamorphic,
    performance: result.performance,
    determinism: result.determinism,
    negativeTamperTests: 5,
    securityTests: 6,
    secureWriteRepeats: 20,
    adapterSha256: adapter.adapterSha256,
    resultSha256: result.resultSha256,
  }, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
