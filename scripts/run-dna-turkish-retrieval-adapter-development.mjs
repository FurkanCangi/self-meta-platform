#!/usr/bin/env node

import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync } from "node:fs"
import { performance } from "node:perf_hooks"
import { join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"

import {
  assertAdapterConfig,
  assertFrozenAdapter,
  assertPureEvaluatorSource,
  createFrozenAdapter,
  sha256,
  stableSha256,
} from "./lib/dna-locked-retrieval-core.mjs"
import {
  assertContained,
  resolveSecureRoot,
  secureAtomicWriteReplace,
  verifySecureFile,
} from "./lib/dna-secure-artifact.mjs"
import { routeFrozenAdapter } from "./generated/dna-retrieval-evaluators/turkish-development-v1.mjs"

export const CONFIG_RELATIVE_PATH =
  "docs/dna-intelligence/governance/v3/development-turkish-retrieval-adapter-config.json"
export const EVALUATOR_RELATIVE_PATH =
  "scripts/generated/dna-retrieval-evaluators/turkish-development-v1.mjs"
export const QA_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-qa-current.json"
export const FROZEN_ADAPTER_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/evaluation/frozen-adapters/turkish-retrieval-v1/adapter.json"
export const DEVELOPMENT_RESULT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-adapter/development-v1/result.json"
export const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-development-current.json"
export const DEFAULT_FROZEN_AT = "2026-07-24T09:00:00.000Z"
const FORBIDDEN_TUNING_ROOTS = Object.freeze(["Datasets/DNA-Intelligence/evaluation"])
const TARGETS = Object.freeze({
  catalogAnchor: 0.95,
  naturalParaphrase: 0.8,
  hardNeighbor: 0.9,
  ambiguousNonAnswer: 0.8,
  unsupportedNonAnswer: 0.8,
  knownSafeNonRefusal: 0.98,
  characterLoss: 0.95,
  inflection: 0.9,
})

const INFLECTION_VARIANTS = Object.freeze([
  ["inflection:autonomic", "Kardiyak reflekslerin değerlendirilmesi", "external.autonomic_testing"],
  ["inflection:circadian", "Sirkadiyen ışığın etkileri", "external.circadian_light"],
  ["inflection:executive", "Yürütücü işlevlerin gelişimi", "external.executive_function_development"],
  ["inflection:biofeedback", "Geri bildirim çalışmalarındaki protokoller", "external.hrv_biofeedback_methods"],
  ["inflection:hrv-context", "Kardiyak değişkenliğin koşulları", "external.hrv_context"],
  ["inflection:hrv-measurement", "HRV ölçümlerindeki artefaktlar", "external.hrv_measurement"],
  ["inflection:insula", "İnsular korteksin işlevleri", "external.insula_interoception"],
  ["inflection:cosmin", "Sağlık ölçeklerinin yapı geçerliği", "external.measurement_cosmin"],
  ["inflection:parent", "Ebeveynlerin duygu düzenlemesi", "external.parent_emotion_regulation"],
  ["inflection:pfc", "Prefrontal süreçlerin kontrolü", "external.pfc_cognitive_control"],
  ["inflection:polyvagal", "Polyvagal teorinin sınırları", "external.polyvagal_theory"],
  ["inflection:reporting", "Sistematik derlemelerin raporlanması", "external.prisma_cosmin_reporting"],
  ["inflection:selfreg", "Çocuk ölçeğinin psikometrik özellikleri", "external.selfreg_measurement"],
  ["inflection:sleep", "Uykusuzluğun duygusal yanıtları", "external.sleep_emotional_reactivity"],
])

function fail(code) {
  throw new Error(code)
}

function readJsonFile(root, requested, code) {
  const path = assertContained(root, requested)
  const delta = relative(root, path)
  let current = root
  for (const segment of delta.split(sep).filter(Boolean)) {
    current = join(current, segment)
    if (!existsSync(current)) fail(`${code}_missing`)
    const metadata = lstatSync(current)
    if (metadata.isSymbolicLink()) fail(`${code}_symlink_forbidden`)
  }
  const bytes = readFileSync(path)
  try {
    return { path, bytes, value: JSON.parse(bytes.toString("utf8")) }
  } catch {
    fail(`${code}_invalid_json`)
  }
}

function asciiTurkish(value) {
  return String(value)
    .replace(/ç/g, "c").replace(/Ç/g, "C")
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
}

function summarize(results, kind) {
  const selected = results.filter((result) => result.kind === kind)
  const correct = selected.filter((result) => result.correct).length
  return {
    total: selected.length,
    correct,
    accuracy: selected.length === 0 ? 0 : Number((correct / selected.length).toFixed(6)),
    failureIds: selected.filter((result) => !result.correct).map((result) => result.id),
  }
}

function percentile(values, quantile) {
  const ordered = [...values].sort((left, right) => left - right)
  const index = Math.min(ordered.length - 1, Math.ceil(ordered.length * quantile) - 1)
  return ordered[index] ?? 0
}

function exactRoute(adapter, question) {
  const result = routeFrozenAdapter(adapter, question)
  const keys = Object.keys(result).sort()
  if (keys.length !== 2 || keys[0] !== "decision" || keys[1] !== "topicId") {
    fail("dna_adapter_route_return_contract_mismatch")
  }
  if (!["answer", "clarify", "abstain", "refuse"].includes(result.decision)) {
    fail("dna_adapter_route_decision_invalid")
  }
  if (result.decision === "answer" && typeof result.topicId !== "string") {
    fail("dna_adapter_route_answer_topic_missing")
  }
  if (result.decision !== "answer" && result.topicId !== null) {
    fail("dna_adapter_route_nonanswer_topic_forbidden")
  }
  return result
}

export function loadDevelopmentInputs(options = {}) {
  const repositoryRoot = resolveSecureRoot(options.repositoryRoot ?? process.cwd())
  const researchRoot = resolveSecureRoot(
    options.researchRoot ?? process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
    { requiredPrefix: options.requireResearchVolume === false ? undefined : "/Volumes/ResearchSSD" },
  )
  const qaManifestRead = readJsonFile(
    repositoryRoot,
    join(repositoryRoot, QA_MANIFEST_RELATIVE_PATH),
    "dna_adapter_qa_manifest",
  )
  const configRead = readJsonFile(
    repositoryRoot,
    join(repositoryRoot, CONFIG_RELATIVE_PATH),
    "dna_adapter_config",
  )
  const config = assertAdapterConfig(configRead.value)
  const evaluatorPath = assertContained(repositoryRoot, join(repositoryRoot, EVALUATOR_RELATIVE_PATH))
  const evaluatorBytes = readFileSync(evaluatorPath)
  assertPureEvaluatorSource(evaluatorBytes.toString("utf8"))
  const qaManifest = qaManifestRead.value
  const candidateRead = readJsonFile(
    researchRoot,
    join(researchRoot, qaManifest.candidatePackage.relativePath),
    "dna_adapter_candidate",
  )
  const qaRead = readJsonFile(
    researchRoot,
    join(researchRoot, qaManifest.rawOutput.researchSsdRelativePath),
    "dna_adapter_development_qa",
  )
  if (candidateRead.value.packageSha256 !== qaManifest.candidatePackage.packageSha256) {
    fail("dna_adapter_candidate_package_hash_mismatch")
  }
  if (sha256(qaRead.bytes) !== qaManifest.rawOutput.rawSha256
    || qaRead.value.determinism.evaluationSha256 !== qaManifest.rawOutput.evaluationSha256) {
    fail("dna_adapter_development_qa_hash_mismatch")
  }
  const topicIds = new Set(candidateRead.value.lexicalIndex.map((entry) => entry.topicId))
  if (config.topics.some((topic) => !topicIds.has(topic.topicId))
    || topicIds.size !== config.topics.length) fail("dna_adapter_lexical_topic_mismatch")
  const normalizedQuestions = new Set(qaRead.value.retrieval.probes.map((probe) =>
    probe.question.toLocaleLowerCase("tr-TR").trim()))
  for (const topic of config.topics) {
    for (const phrase of [
      ...topic.positivePhrases,
      ...topic.negativePhrases,
      ...topic.contextPhrases,
    ]) {
      if (normalizedQuestions.has(phrase.toLocaleLowerCase("tr-TR").trim())) {
        fail("dna_adapter_full_development_question_copied")
      }
    }
  }
  return {
    repositoryRoot,
    researchRoot,
    qaManifest,
    candidate: candidateRead.value,
    candidateBytes: candidateRead.bytes,
    qa: qaRead.value,
    qaBytes: qaRead.bytes,
    config,
    configBytes: configRead.bytes,
    evaluatorBytes,
  }
}

export function createExpectedAdapter(inputs, frozenAt = DEFAULT_FROZEN_AT) {
  return createFrozenAdapter({
    adapterId: "external-science-turkish-retrieval-v1",
    frozenAt,
    candidatePackageSha256: inputs.candidate.packageSha256,
    developmentQaEvaluationSha256: inputs.qa.determinism.evaluationSha256,
    evaluatorModule: EVALUATOR_RELATIVE_PATH,
    codeSha256: sha256(inputs.evaluatorBytes),
    config: inputs.config,
    tuningInputAllowlist: [
      {
        id: "candidate-package",
        kind: "candidate_package",
        location: "research_ssd",
        relativePath: inputs.qaManifest.candidatePackage.relativePath,
        sha256: sha256(inputs.candidateBytes),
      },
      {
        id: "development-qa",
        kind: "development_qa",
        location: "research_ssd",
        relativePath: inputs.qaManifest.rawOutput.researchSsdRelativePath,
        sha256: sha256(inputs.qaBytes),
      },
      {
        id: "adapter-config",
        kind: "adapter_config",
        location: "repo",
        relativePath: CONFIG_RELATIVE_PATH,
        sha256: sha256(inputs.configBytes),
      },
    ],
    forbiddenInputPaths: FORBIDDEN_TUNING_ROOTS,
  })
}

export function evaluateDevelopment(adapter, inputs) {
  assertFrozenAdapter(adapter, { expectedCodeSha256: sha256(inputs.evaluatorBytes) })
  const probeResults = inputs.qa.retrieval.probes.map((probe) => {
    const actual = exactRoute(adapter, probe.question)
    return {
      id: probe.id,
      kind: probe.kind,
      expectedTopicId: probe.expectedTopicId,
      actualTopicId: actual.topicId,
      decision: actual.decision,
      correct: actual.topicId === probe.expectedTopicId,
    }
  })
  const answerable = inputs.qa.retrieval.probes.filter((probe) => probe.expectedTopicId !== null)
  const knownSafeRoutes = answerable.map((probe) => exactRoute(adapter, probe.question))
  const asciiResults = answerable.map((probe) => {
    const actual = exactRoute(adapter, asciiTurkish(probe.question))
    return { id: probe.id, correct: actual.topicId === probe.expectedTopicId }
  })
  const inflectionResults = INFLECTION_VARIANTS.map(([id, question, expectedTopicId]) => {
    const actual = exactRoute(adapter, question)
    return { id, expectedTopicId, actualTopicId: actual.topicId, correct: actual.topicId === expectedTopicId }
  })
  const routePayloadHash = () => stableSha256([
    ...inputs.qa.retrieval.probes.map((probe) => exactRoute(adapter, probe.question)),
    ...INFLECTION_VARIANTS.map(([, question]) => exactRoute(adapter, question)),
  ])
  const deterministicHashes = Array.from({ length: 20 }, routePayloadHash)
  if (new Set(deterministicHashes).size !== 1) fail("dna_adapter_development_nondeterministic")

  const timings = []
  for (let repeat = 0; repeat < 100; repeat += 1) {
    for (const probe of inputs.qa.retrieval.probes) {
      const started = performance.now()
      exactRoute(adapter, probe.question)
      timings.push(performance.now() - started)
    }
  }
  const metrics = {
    catalogAnchor: summarize(probeResults, "catalog_anchor"),
    naturalParaphrase: summarize(probeResults, "natural_paraphrase"),
    hardNeighbor: summarize(probeResults, "hard_neighbor"),
    ambiguousNonAnswer: summarize(probeResults, "ambiguous"),
    unsupportedNonAnswer: summarize(probeResults, "unsupported"),
    adapterKnownSafeNonRefusal: {
      total: knownSafeRoutes.length,
      nonRefused: knownSafeRoutes.filter((result) => result.decision !== "refuse").length,
      rate: Number((knownSafeRoutes.filter((result) => result.decision !== "refuse").length
        / knownSafeRoutes.length).toFixed(6)),
    },
    existingSafetyGateBaselineNonRefusal: inputs.qa.overRefusal.allowedRate,
    characterLoss: {
      total: asciiResults.length,
      correct: asciiResults.filter((result) => result.correct).length,
      accuracy: Number((asciiResults.filter((result) => result.correct).length / asciiResults.length).toFixed(6)),
      failureIds: asciiResults.filter((result) => !result.correct).map((result) => result.id),
    },
    inflection: {
      total: inflectionResults.length,
      correct: inflectionResults.filter((result) => result.correct).length,
      accuracy: Number((inflectionResults.filter((result) => result.correct).length
        / inflectionResults.length).toFixed(6)),
      failureIds: inflectionResults.filter((result) => !result.correct).map((result) => result.id),
    },
  }
  const acceptance = {
    catalogAnchor: metrics.catalogAnchor.accuracy >= TARGETS.catalogAnchor,
    naturalParaphrase: metrics.naturalParaphrase.accuracy >= TARGETS.naturalParaphrase,
    hardNeighbor: metrics.hardNeighbor.accuracy >= TARGETS.hardNeighbor,
    ambiguousNonAnswer: metrics.ambiguousNonAnswer.accuracy >= TARGETS.ambiguousNonAnswer,
    unsupportedNonAnswer: metrics.unsupportedNonAnswer.accuracy >= TARGETS.unsupportedNonAnswer,
    adapterKnownSafeNonRefusal:
      metrics.adapterKnownSafeNonRefusal.rate >= TARGETS.knownSafeNonRefusal,
    characterLoss: metrics.characterLoss.accuracy >= TARGETS.characterLoss,
    inflection: metrics.inflection.accuracy >= TARGETS.inflection,
    deterministic: new Set(deterministicHashes).size === 1,
    runtimeAuthority: "none",
    releaseAuthority: "none",
    v3ReleaseDecision: "no_go_unchanged",
  }
  if (Object.entries(acceptance).some(([key, value]) =>
    !["runtimeAuthority", "releaseAuthority", "v3ReleaseDecision"].includes(key) && value !== true)) {
    fail("dna_adapter_development_target_failed")
  }
  return {
    metrics,
    acceptance,
    determinism: {
      repeats: deterministicHashes.length,
      uniqueHashes: new Set(deterministicHashes).size,
      routePayloadSha256: deterministicHashes[0],
    },
    performance: {
      samples: timings.length,
      p95Milliseconds: Number(percentile(timings, 0.95).toFixed(6)),
    },
    inflectionResults,
  }
}

function stableEvaluationProjection(evaluation) {
  return {
    metrics: evaluation.metrics,
    acceptance: evaluation.acceptance,
    determinism: evaluation.determinism,
    inflectionResults: evaluation.inflectionResults,
  }
}

function buildDevelopmentResult(adapter, inputs, evaluation) {
  const stableProjection = stableEvaluationProjection(evaluation)
  return {
    schemaVersion: "dna-turkish-retrieval-adapter-development-result@1",
    evaluatedAt: adapter.frozenAt,
    adapterSha256: adapter.adapterSha256,
    candidatePackageSha256: adapter.candidatePackageSha256,
    developmentQaEvaluationSha256: adapter.developmentQaEvaluationSha256,
    evaluatorModule: adapter.evaluatorModule,
    codeSha256: adapter.codeSha256,
    configSha256: adapter.configSha256,
    developmentProbeCount: inputs.qa.retrieval.probes.length,
    metrics: evaluation.metrics,
    acceptance: evaluation.acceptance,
    determinism: evaluation.determinism,
    performance: evaluation.performance,
    inflectionResults: evaluation.inflectionResults,
    stableEvaluationSha256: stableSha256(stableProjection),
    boundaries: {
      developmentOnly: true,
      builtWithoutLockedHoldout: true,
      lockedHoldoutAccessed: false,
      externalModelUsed: false,
      networkUsed: false,
      runtimeEligible: false,
      releaseEligible: false,
      ownerBookAuthorityUsed: false,
    },
  }
}

function buildRepoManifest(adapter, developmentResult, rawSha256, adapterFileSha256) {
  const candidateInput = adapter.tuningInputAllowlist.find((entry) =>
    entry.kind === "candidate_package")
  const developmentInput = adapter.tuningInputAllowlist.find((entry) =>
    entry.kind === "development_qa")
  const requiredDevelopmentGates = [
    developmentResult.acceptance.catalogAnchor,
    developmentResult.acceptance.naturalParaphrase,
    developmentResult.acceptance.hardNeighbor,
    developmentResult.acceptance.ambiguousNonAnswer,
    developmentResult.acceptance.unsupportedNonAnswer,
    developmentResult.acceptance.adapterKnownSafeNonRefusal,
    developmentResult.acceptance.characterLoss,
    developmentResult.acceptance.inflection,
    developmentResult.acceptance.deterministic,
  ]
  return {
    schemaVersion: "dna-turkish-retrieval-adapter-development-manifest@1",
    recordedAt: adapter.frozenAt,
    adapter: {
      researchSsdRelativePath: FROZEN_ADAPTER_RELATIVE_PATH,
      adapterSha256: adapter.adapterSha256,
      fileSha256: adapterFileSha256,
      evaluatorModule: adapter.evaluatorModule,
      codeSha256: adapter.codeSha256,
      configSha256: adapter.configSha256,
      candidatePackageSha256: adapter.candidatePackageSha256,
      candidateFileSha256: candidateInput.sha256,
      developmentQaEvaluationSha256: adapter.developmentQaEvaluationSha256,
      developmentQaFileSha256: developmentInput.sha256,
      fileMode: "0600",
    },
    developmentResult: {
      researchSsdRelativePath: DEVELOPMENT_RESULT_RELATIVE_PATH,
      rawSha256,
      stableEvaluationSha256: developmentResult.stableEvaluationSha256,
      fileMode: "0600",
    },
    counts: {
      topics: adapter.topics.length,
      developmentProbes: developmentResult.developmentProbeCount,
      inflectionVariants: developmentResult.metrics.inflection.total,
      deterministicRepeats: developmentResult.determinism.repeats,
      deterministicUniqueHashes: developmentResult.determinism.uniqueHashes,
    },
    metrics: developmentResult.metrics,
    acceptance: developmentResult.acceptance,
    developmentGate: requiredDevelopmentGates.every((value) => value === true) ? "pass" : "fail",
    boundaries: developmentResult.boundaries,
  }
}

export function verifyFrozenArtifact(inputs, adapterRelativePath = FROZEN_ADAPTER_RELATIVE_PATH) {
  const path = assertContained(inputs.researchRoot, join(inputs.researchRoot, adapterRelativePath))
  if (!existsSync(path)) fail("dna_adapter_frozen_artifact_missing")
  const bytes = readFileSync(path)
  verifySecureFile(inputs.researchRoot, path, bytes)
  const adapter = JSON.parse(bytes.toString("utf8"))
  assertFrozenAdapter(adapter, { expectedCodeSha256: sha256(inputs.evaluatorBytes) })
  const expected = createExpectedAdapter(inputs, adapter.frozenAt)
  if (stableSha256(adapter) !== stableSha256(expected)) fail("dna_adapter_frozen_artifact_drift")
  return { adapter, bytes }
}

export function writeDevelopmentEvidence(inputs, adapter, adapterBytes, evaluation) {
  const repositoryRoot = inputs.repositoryRoot
  const developmentResult = buildDevelopmentResult(adapter, inputs, evaluation)
  const resultText = `${JSON.stringify(developmentResult, null, 2)}\n`
  const rawSha256 = sha256(resultText)
  const manifest = buildRepoManifest(adapter, developmentResult, rawSha256, sha256(adapterBytes))
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
  const resultPath = assertContained(
    inputs.researchRoot,
    join(inputs.researchRoot, DEVELOPMENT_RESULT_RELATIVE_PATH),
  )
  const manifestPath = assertContained(
    repositoryRoot,
    join(repositoryRoot, REPO_MANIFEST_RELATIVE_PATH),
  )
  secureAtomicWriteReplace(inputs.researchRoot, resultPath, resultText)
  secureAtomicWriteReplace(repositoryRoot, manifestPath, manifestText)
  return { developmentResult, manifest, resultPath, manifestPath }
}

function run() {
  const command = process.argv[2] ?? "evaluate"
  const inputs = loadDevelopmentInputs()
  if (command === "evaluate") {
    const adapter = createExpectedAdapter(inputs)
    const evaluation = evaluateDevelopment(adapter, inputs)
    process.stdout.write(`${JSON.stringify({
      ok: true,
      adapterSha256: adapter.adapterSha256,
      metrics: evaluation.metrics,
      acceptance: evaluation.acceptance,
      determinism: evaluation.determinism,
      performance: evaluation.performance,
    }, null, 2)}\n`)
    return
  }
  if (command === "write") {
    const { adapter, bytes } = verifyFrozenArtifact(inputs)
    const evaluation = evaluateDevelopment(adapter, inputs)
    const written = writeDevelopmentEvidence(inputs, adapter, bytes, evaluation)
    process.stdout.write(`${JSON.stringify({
      ok: true,
      adapterSha256: adapter.adapterSha256,
      resultPath: written.resultPath,
      manifestPath: written.manifestPath,
      metrics: evaluation.metrics,
      acceptance: evaluation.acceptance,
      performance: evaluation.performance,
    }, null, 2)}\n`)
    return
  }
  if (command === "verify") {
    const { adapter } = verifyFrozenArtifact(inputs)
    const evaluation = evaluateDevelopment(adapter, inputs)
    const manifestRead = readJsonFile(
      inputs.repositoryRoot,
      join(inputs.repositoryRoot, REPO_MANIFEST_RELATIVE_PATH),
      "dna_adapter_repo_manifest",
    )
    const resultRead = readJsonFile(
      inputs.researchRoot,
      join(inputs.researchRoot, DEVELOPMENT_RESULT_RELATIVE_PATH),
      "dna_adapter_development_result",
    )
    verifySecureFile(inputs.repositoryRoot, manifestRead.path, manifestRead.bytes)
    verifySecureFile(inputs.researchRoot, resultRead.path, resultRead.bytes)
    if (manifestRead.value.adapter.adapterSha256 !== adapter.adapterSha256
      || manifestRead.value.developmentResult.rawSha256 !== sha256(resultRead.bytes)
      || resultRead.value.stableEvaluationSha256
        !== stableSha256(stableEvaluationProjection(evaluation))) {
      fail("dna_adapter_evidence_drift")
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      adapterSha256: adapter.adapterSha256,
      developmentRawSha256: sha256(resultRead.bytes),
      stableEvaluationSha256: resultRead.value.stableEvaluationSha256,
      metrics: evaluation.metrics,
      performance: evaluation.performance,
    }, null, 2)}\n`)
    return
  }
  fail("dna_adapter_development_command_invalid")
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ""
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  try {
    run()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "dna_adapter_unknown_error"}\n`)
    process.exitCode = 1
  }
}
