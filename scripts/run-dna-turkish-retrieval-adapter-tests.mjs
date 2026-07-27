#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"

import {
  assertAdapterConfig,
  assertPureEvaluatorSource,
  stableSha256,
} from "./lib/dna-locked-retrieval-core.mjs"
import {
  assertContained,
  resolveSecureRoot,
  secureAtomicWriteNew,
  secureAtomicWriteReplace,
  verifySecureFile,
} from "./lib/dna-secure-artifact.mjs"
import {
  CONFIG_RELATIVE_PATH,
  DEFAULT_FROZEN_AT,
  EVALUATOR_RELATIVE_PATH,
  createExpectedAdapter,
  evaluateDevelopment,
  loadDevelopmentInputs,
} from "./run-dna-turkish-retrieval-adapter-development.mjs"

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function runCli(args, env = {}) {
  return spawnSync(process.execPath, ["scripts/dna-frozen-turkish-retrieval-adapter.mjs", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: "utf8",
  })
}

function expectFailure(result, pattern) {
  assert.notEqual(result.status, 0, `expected failure but received: ${result.stdout}`)
  assert.match(`${result.stdout}\n${result.stderr}`, pattern)
}

function run() {
  const inputs = loadDevelopmentInputs()
  const adapter = createExpectedAdapter(inputs)
  const evaluation = evaluateDevelopment(adapter, inputs)
  assert.equal(evaluation.metrics.naturalParaphrase.accuracy >= 0.8, true)
  assert.equal(evaluation.metrics.hardNeighbor.accuracy >= 0.9, true)
  assert.equal(evaluation.metrics.ambiguousNonAnswer.accuracy >= 0.8, true)
  assert.equal(evaluation.metrics.unsupportedNonAnswer.accuracy >= 0.8, true)
  assert.equal(evaluation.metrics.adapterKnownSafeNonRefusal.rate >= 0.98, true)
  assert.equal(evaluation.metrics.characterLoss.accuracy, 1)
  assert.equal(evaluation.metrics.inflection.accuracy, 1)
  assert.equal(evaluation.determinism.repeats, 20)
  assert.equal(evaluation.determinism.uniqueHashes, 1)

  const deterministicAdapters = Array.from({ length: 20 }, () =>
    `${JSON.stringify(createExpectedAdapter(inputs, DEFAULT_FROZEN_AT), null, 2)}\n`)
  assert.equal(new Set(deterministicAdapters).size, 1)
  assert.equal(stableSha256(createExpectedAdapter(inputs, DEFAULT_FROZEN_AT)), stableSha256(adapter))
  assert.notEqual(
    stableSha256(createExpectedAdapter(inputs, "2026-07-24T09:00:01.000Z")),
    stableSha256(adapter),
  )

  const configTamper = clone(inputs.config)
  configTamper.thresholds.answerMinimum += 0.1
  assert.throws(() => assertAdapterConfig(configTamper), /dna_adapter_config_hash_mismatch/)
  const evaluatorSource = inputs.evaluatorBytes.toString("utf8")
  assert.equal(assertPureEvaluatorSource(evaluatorSource), true)
  assert.throws(
    () => assertPureEvaluatorSource(`${evaluatorSource}\nimport "node:fs"\n`),
    /dna_adapter_evaluator_impure_or_forbidden_source/,
  )

  const researchRoot = resolveSecureRoot("/Volumes/ResearchSSD", {
    requiredPrefix: "/Volumes/ResearchSSD",
  })
  const testContainer = join(
    researchRoot,
    "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-adapter/security-tests",
  )
  mkdirSync(testContainer, { recursive: true, mode: 0o700 })
  const tempRoot = mkdtempSync(join(testContainer, "run-"))
  const outside = mkdtempSync(join(tmpdir(), "dna-adapter-outside-"))
  const rootLinkContainer = mkdtempSync(join(tmpdir(), "dna-adapter-root-link-"))
  try {
    const outputFiles = []
    for (let index = 0; index < 20; index += 1) {
      const outputPath = join(tempRoot, `adapter-${String(index).padStart(2, "0")}.json`)
      const outputRelative = relative(researchRoot, outputPath)
      const result = runCli([
        "freeze",
        "--config", CONFIG_RELATIVE_PATH,
        "--evaluator", EVALUATOR_RELATIVE_PATH,
        "--frozen-at", DEFAULT_FROZEN_AT,
        "--output", outputRelative,
      ], { RESEARCH_SSD_ROOT: researchRoot })
      assert.equal(result.status, 0, result.stderr)
      assert.equal(lstatSync(outputPath).mode & 0o777, 0o600)
      outputFiles.push(readFileSync(outputPath))
    }
    assert.equal(new Set(outputFiles.map((bytes) => bytes.toString("hex"))).size, 1)
    assert.equal(outputFiles[0].toString("utf8"), deterministicAdapters[0])

    const firstRelative = relative(researchRoot, join(tempRoot, "adapter-00.json"))
    const verify = runCli(["verify", "--adapter", firstRelative], {
      RESEARCH_SSD_ROOT: researchRoot,
    })
    assert.equal(verify.status, 0, verify.stderr)
    expectFailure(runCli([
      "freeze",
      "--config", CONFIG_RELATIVE_PATH,
      "--evaluator", EVALUATOR_RELATIVE_PATH,
      "--frozen-at", DEFAULT_FROZEN_AT,
      "--output", firstRelative,
    ], { RESEARCH_SSD_ROOT: researchRoot }), /dna_secure_output_exists/)

    const outsideLeaf = join(outside, "outside.json")
    writeFileSync(outsideLeaf, "outside", { encoding: "utf8", mode: 0o600 })
    const leafLink = join(tempRoot, "leaf-link.json")
    symlinkSync(outsideLeaf, leafLink)
    expectFailure(runCli([
      "freeze",
      "--config", CONFIG_RELATIVE_PATH,
      "--evaluator", EVALUATOR_RELATIVE_PATH,
      "--frozen-at", DEFAULT_FROZEN_AT,
      "--output", relative(researchRoot, leafLink),
    ], { RESEARCH_SSD_ROOT: researchRoot }), /dna_secure_output_symlink_forbidden/)

    const parentLink = join(tempRoot, "parent-link")
    symlinkSync(outside, parentLink)
    expectFailure(runCli([
      "freeze",
      "--config", CONFIG_RELATIVE_PATH,
      "--evaluator", EVALUATOR_RELATIVE_PATH,
      "--frozen-at", DEFAULT_FROZEN_AT,
      "--output", relative(researchRoot, join(parentLink, "adapter.json")),
    ], { RESEARCH_SSD_ROOT: researchRoot }), /dna_secure_parent_symlink_forbidden/)
    assert.equal(readFileSync(outsideLeaf, "utf8"), "outside")

    const rootLink = join(rootLinkContainer, "root-link")
    symlinkSync(researchRoot, rootLink)
    expectFailure(runCli([
      "freeze",
      "--config", CONFIG_RELATIVE_PATH,
      "--evaluator", EVALUATOR_RELATIVE_PATH,
      "--frozen-at", DEFAULT_FROZEN_AT,
      "--output", "adapter.json",
    ], { RESEARCH_SSD_ROOT: rootLink }), /dna_secure_root_symlink_forbidden/)

    const localSecureRoot = resolveSecureRoot(realpathSync(outside))
    const atomicPath = join(localSecureRoot, "atomic.json")
    const content = `${JSON.stringify({ ok: true, version: 1 })}\n`
    secureAtomicWriteNew(localSecureRoot, atomicPath, content)
    assert.throws(
      () => secureAtomicWriteNew(localSecureRoot, atomicPath, content),
      /dna_secure_output_exists/,
    )
    const replaceHashes = Array.from({ length: 20 }, () =>
      secureAtomicWriteReplace(localSecureRoot, atomicPath, content).sha256)
    assert.equal(new Set(replaceHashes).size, 1)
    writeFileSync(atomicPath, "tampered", "utf8")
    assert.throws(
      () => verifySecureFile(localSecureRoot, atomicPath, content),
      /dna_secure_output_readback_mismatch/,
    )
    secureAtomicWriteReplace(localSecureRoot, atomicPath, content)
    chmodSync(atomicPath, 0o644)
    assert.throws(
      () => verifySecureFile(localSecureRoot, atomicPath, content),
      /dna_secure_output_mode_invalid/,
    )
    assert.throws(
      () => assertContained(localSecureRoot, join(localSecureRoot, "..", "escape.json")),
      /dna_secure_path_escape/,
    )
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
    rmSync(rootLinkContainer, { recursive: true, force: true })
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    developmentProbes: inputs.qa.retrieval.probes.length,
    naturalParaphraseAccuracy: evaluation.metrics.naturalParaphrase.accuracy,
    hardNeighborAccuracy: evaluation.metrics.hardNeighbor.accuracy,
    ambiguousNonAnswer: evaluation.metrics.ambiguousNonAnswer.accuracy,
    unsupportedNonAnswer: evaluation.metrics.unsupportedNonAnswer.accuracy,
    adapterKnownSafeNonRefusal: evaluation.metrics.adapterKnownSafeNonRefusal.rate,
    characterLossAccuracy: evaluation.metrics.characterLoss.accuracy,
    inflectionAccuracy: evaluation.metrics.inflection.accuracy,
    deterministicRouteRepeats: evaluation.determinism.repeats,
    deterministicFreezeRepeats: deterministicAdapters.length,
    secureFreezeCliRepeats: 20,
    outputMode: "0600",
    p95Milliseconds: evaluation.performance.p95Milliseconds,
  }, null, 2)}\n`)
}

try {
  run()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "dna_adapter_test_unknown_error"}\n`)
  process.exitCode = 1
}
