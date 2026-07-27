import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"

export const HOLDOUT_SCHEMA = "dna-internal-locked-turkish-holdout@2"
export const HOLDOUT_LABEL = "internal_locked_holdout_not_independent_human_validation"
export const RESULT_SCHEMA = "dna-one-shot-locked-evaluation-v2-result@1"
export const CLAIM_SCHEMA = "dna-one-shot-locked-evaluation-v2-claim@1"
export const RESULT_LABEL = "internal_locked_holdout_v2_not_independent_human_validation"

export const TOPIC_IDS = Object.freeze([
  "external.autonomic_testing",
  "external.circadian_light",
  "external.executive_function_development",
  "external.hrv_biofeedback_methods",
  "external.hrv_context",
  "external.hrv_measurement",
  "external.insula_interoception",
  "external.measurement_cosmin",
  "external.parent_emotion_regulation",
  "external.pfc_cognitive_control",
  "external.polyvagal_theory",
  "external.prisma_cosmin_reporting",
  "external.selfreg_measurement",
  "external.sleep_emotional_reactivity",
])

export const EXPECTED_COUNTS = Object.freeze({
  total: 196,
  topics: 14,
  answerable: 140,
  clarification: 28,
  unsupported: 28,
})

export const EXPECTED_SPLITS = Object.freeze({
  natural_supported: 98,
  hard_neighbor: 28,
  ambiguous: 28,
  unsupported: 28,
  safe_theory_control: 14,
})

export const QUALITY_TARGETS = Object.freeze({
  overallAccuracy: 0.95,
  naturalSupportedAccuracy: 0.95,
  hardNeighborAccuracy: 0.95,
  ambiguousAccuracy: 0.95,
  unsupportedAccuracy: 1,
  safeTheoryRoutingAccuracy: 0.95,
  safetyNonRefusalAccuracy: 0.98,
  p95MillisecondsMaximum: 25,
})

export function fail(code) {
  throw new Error(code)
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, child]) => [key, canonicalize(child)]))
  }
  return value
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value))
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8")
  return createHash("sha256").update(bytes).digest("hex")
}

export function stableSha256(value) {
  return sha256(stableJson(value))
}

export function withoutKey(value, key) {
  return Object.fromEntries(Object.entries(value).filter(([candidate]) => candidate !== key))
}

export function assertExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code)
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) fail(code)
}

export function assertSha256(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(code)
}

export function assertIsoTimestamp(value, code) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value) fail(code)
}

export function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const child of Object.values(value)) deepFreeze(child, seen)
  return Object.freeze(value)
}

function round(value) {
  return Math.round(value * 1e6) / 1e6
}

function percentile(values, fraction) {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.max(0, Math.min(ordered.length - 1,
    Math.ceil(ordered.length * fraction) - 1))]
}

function metric(rows) {
  const correct = rows.filter((row) => row.correct).length
  return Object.freeze({
    count: rows.length,
    correct,
    accuracy: rows.length ? round(correct / rows.length) : 0,
  })
}

function normalizeQuestion(value) {
  return String(value).normalize("NFKC").toLocaleLowerCase("tr-TR")
    .replace(/[?!.,;:()\[\]{}'"“”‘’`´]/g, " ")
    .replace(/\s+/g, " ").trim()
}

export function assertPureV2EvaluatorSource(source) {
  if (typeof source !== "string" || source.length < 100 || source.length > 150_000) {
    fail("dna_locked_v2_evaluator_source_invalid")
  }
  const forbidden = [
    /\bimport\s*(?:\(|[\s{*])/, /\brequire\s*\(/,
    /\b(?:fs|child_process|https?|net|tls|dgram|worker_threads)\b/,
    /\b(?:fetch|WebSocket|XMLHttpRequest)\b/, /\bprocess(?:\.|\[)/,
    /\b(?:globalThis|window|document|Deno|Bun)(?:\.|\[)/,
    /\b(?:console|stdout|stderr)\b/,
    /\b(?:writeFile|appendFile|createWriteStream|unlink|rename|mkdir|rmdir)\b/,
    /\/(?:Volumes|Users|private|tmp|var|etc)(?:\/|\b)/,
    /(?:^|[^a-z])(?:locked|holdout)(?:[^a-z]|$)/i,
    /\b(?:eval|Function)\s*\(/, /\bMath\.random\b/,
  ]
  if (forbidden.some((pattern) => pattern.test(source))) {
    fail("dna_locked_v2_evaluator_impure_or_forbidden_source")
  }
  if (!/export\s+function\s+evaluateTurkishRetrievalV2\s*\(\s*question\s*,\s*adapter\s*\)/.test(source)) {
    fail("dna_locked_v2_evaluator_export_missing")
  }
  return true
}

export function assertFrozenAdapter(adapter) {
  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
    fail("dna_locked_v2_adapter_invalid")
  }
  if (adapter.schemaVersion !== "dna-turkish-retrieval-v2-frozen-adapter@1"
    || adapter.version !== "turkish-retrieval-v2"
    || stableSha256(withoutKey(adapter, "adapterSha256")) !== adapter.adapterSha256
    || adapter.topics?.length !== TOPIC_IDS.length
    || new Set(adapter.topics.map((topic) => topic.id)).size !== TOPIC_IDS.length
    || TOPIC_IDS.some((topicId) => !adapter.topics.some((topic) => topic.id === topicId))) {
    fail("dna_locked_v2_adapter_contract_mismatch")
  }
  for (const hash of [
    adapter.adapterSha256, adapter.evaluatorCodeSha256, adapter.compilerCodeSha256,
    adapter.configFileSha256, adapter.candidatePackageSha256, adapter.candidateFileSha256,
    adapter.developmentBankSha256, adapter.developmentBankFileSha256,
    adapter.tuningQuestionIdsSha256, adapter.familyHoldoutQuestionIdsSha256,
    adapter.tuningAllowlistSha256,
  ]) assertSha256(hash, "dna_locked_v2_adapter_hash_invalid")
  if (adapter.runtimeEligible !== false || adapter.releaseEligible !== false
    || adapter.activationAllowed !== false || adapter.lockedHoldoutAccessed !== false
    || adapter.boundaries?.runtimeEligible !== false
    || adapter.boundaries?.releaseEligible !== false
    || adapter.boundaries?.activationAllowed !== false
    || adapter.boundaries?.lockedHoldoutAccessed !== false
    || adapter.boundaries?.officialEvaluationAuthority !== false) {
    fail("dna_locked_v2_adapter_boundary_mismatch")
  }
  return adapter
}

export function assertSealedHoldoutArtifact(artifact, expectedFileSha256) {
  assertExactKeys(artifact, [
    "schemaVersion", "label", "status", "sealedAt", "candidatePackageSha256",
    "candidateFileSha256", "authoringProcessSha256", "contractSealProcessSha256",
    "counts", "splits", "items", "bindings", "variantAssignments",
    "visibleToAdapterTuning", "runtimeEligible", "releaseEligible",
    "independentHumanValidation", "limitations", "artifactSha256",
  ], "dna_locked_v2_holdout_fields_invalid")
  if (artifact.schemaVersion !== HOLDOUT_SCHEMA || artifact.label !== HOLDOUT_LABEL
    || artifact.status !== "sealed") fail("dna_locked_v2_holdout_not_sealed")
  assertIsoTimestamp(artifact.sealedAt, "dna_locked_v2_holdout_timestamp_invalid")
  for (const hash of [
    artifact.candidatePackageSha256, artifact.candidateFileSha256,
    artifact.authoringProcessSha256, artifact.contractSealProcessSha256,
    artifact.artifactSha256,
  ]) assertSha256(hash, "dna_locked_v2_holdout_hash_invalid")
  if (stableSha256(withoutKey(artifact, "artifactSha256")) !== artifact.artifactSha256
    || expectedFileSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expectedFileSha256)) {
    fail("dna_locked_v2_holdout_integrity_mismatch")
  }
  if (stableJson(artifact.counts) !== stableJson(EXPECTED_COUNTS)
    || stableJson(artifact.splits) !== stableJson(EXPECTED_SPLITS)
    || artifact.visibleToAdapterTuning !== false || artifact.runtimeEligible !== false
    || artifact.releaseEligible !== false || artifact.independentHumanValidation !== false) {
    fail("dna_locked_v2_holdout_boundary_or_count_mismatch")
  }
  if (!Array.isArray(artifact.items) || artifact.items.length !== EXPECTED_COUNTS.total) {
    fail("dna_locked_v2_holdout_item_count_mismatch")
  }
  const ids = new Set()
  const normalized = new Set()
  const splitCounts = Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, 0]))
  const answerabilityCounts = { answerable: 0, clarification: 0, unsupported: 0 }
  for (const item of artifact.items) {
    assertExactKeys(item, ["id", "question", "split", "answerability", "expectedTopic"],
      "dna_locked_v2_holdout_item_fields_invalid")
    if (typeof item.id !== "string" || !/^holdout\.v2\.q:[a-f0-9]{24}$/.test(item.id)
      || ids.has(item.id) || typeof item.question !== "string"
      || item.question.trim().length < 12 || item.question.length > 320
      || item.question.includes("\n")) fail("dna_locked_v2_holdout_item_invalid")
    ids.add(item.id)
    const normalizedQuestion = normalizeQuestion(item.question)
    if (!normalizedQuestion || normalized.has(normalizedQuestion)) {
      fail("dna_locked_v2_holdout_question_duplicate")
    }
    normalized.add(normalizedQuestion)
    if (!(item.split in splitCounts) || !(item.answerability in answerabilityCounts)) {
      fail("dna_locked_v2_holdout_taxonomy_invalid")
    }
    splitCounts[item.split] += 1
    answerabilityCounts[item.answerability] += 1
    if (["natural_supported", "hard_neighbor", "safe_theory_control"].includes(item.split)) {
      if (item.answerability !== "answerable" || !TOPIC_IDS.includes(item.expectedTopic)) {
        fail("dna_locked_v2_holdout_answerable_mismatch")
      }
    } else if (item.split === "ambiguous") {
      if (item.answerability !== "clarification" || item.expectedTopic !== null) {
        fail("dna_locked_v2_holdout_clarification_mismatch")
      }
    } else if (item.answerability !== "unsupported" || item.expectedTopic !== null) {
      fail("dna_locked_v2_holdout_unsupported_mismatch")
    }
  }
  if (stableJson(splitCounts) !== stableJson(EXPECTED_SPLITS)
    || answerabilityCounts.answerable !== EXPECTED_COUNTS.answerable
    || answerabilityCounts.clarification !== EXPECTED_COUNTS.clarification
    || answerabilityCounts.unsupported !== EXPECTED_COUNTS.unsupported) {
    fail("dna_locked_v2_holdout_distribution_mismatch")
  }
  return artifact
}

function callWithoutOutput(route, question, adapter) {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    stdoutWrite: process.stdout.write,
    stderrWrite: process.stderr.write,
  }
  const blocked = () => fail("dna_locked_v2_evaluator_output_forbidden")
  console.log = blocked
  console.warn = blocked
  console.error = blocked
  console.info = blocked
  process.stdout.write = blocked
  process.stderr.write = blocked
  try {
    const result = route(question, adapter)
    if (result && typeof result.then === "function") {
      fail("dna_locked_v2_async_evaluator_forbidden")
    }
    return result
  } finally {
    console.log = original.log
    console.warn = original.warn
    console.error = original.error
    console.info = original.info
    process.stdout.write = original.stdoutWrite
    process.stderr.write = original.stderrWrite
  }
}

function assertPrediction(prediction) {
  if (!prediction || typeof prediction !== "object" || Array.isArray(prediction)
    || !["route", "clarify", "abstain"].includes(prediction.decision)
    || (prediction.decision === "route"
      ? !TOPIC_IDS.includes(prediction.topicId)
      : prediction.topicId !== null)) fail("dna_locked_v2_prediction_invalid")
}

function evaluateOnce(route, adapter, items, measure) {
  const rows = []
  const durations = []
  for (const item of items) {
    const before = stableSha256(adapter)
    const started = measure ? performance.now() : 0
    const prediction = callWithoutOutput(route, item.question, adapter)
    if (measure) durations.push(performance.now() - started)
    if (stableSha256(adapter) !== before) fail("dna_locked_v2_adapter_mutation_detected")
    assertPrediction(prediction)
    const correct = item.answerability === "answerable"
      ? prediction.decision === "route" && prediction.topicId === item.expectedTopic
      : item.answerability === "clarification"
        ? prediction.decision === "clarify"
        : prediction.decision === "abstain"
    rows.push(Object.freeze({
      split: item.split,
      answerability: item.answerability,
      expectedTopic: item.expectedTopic,
      prediction: Object.freeze({ decision: prediction.decision, topicId: prediction.topicId }),
      correct,
    }))
  }
  return { rows: Object.freeze(rows), durations: Object.freeze(durations) }
}

export function evaluateLockedHoldout(route, adapterInput, artifactInput) {
  const adapter = deepFreeze(adapterInput)
  const artifact = deepFreeze(artifactInput)
  const frozenHash = stableSha256({ adapter, artifact })
  const first = evaluateOnce(route, adapter, artifact.items, true)
  const repeatHashes = []
  for (let index = 0; index < 20; index += 1) {
    const current = evaluateOnce(route, adapter, artifact.items, false)
    repeatHashes.push(stableSha256(current.rows.map((row) => row.prediction)))
  }
  if (new Set(repeatHashes).size !== 1) fail("dna_locked_v2_determinism_failed")
  if (stableSha256({ adapter, artifact }) !== frozenHash) {
    fail("dna_locked_v2_evaluation_input_mutation_detected")
  }
  const splitAccuracy = Object.keys(EXPECTED_SPLITS).sort((left, right) => left.localeCompare(right, "en"))
    .map((split) => Object.freeze({ split, ...metric(first.rows.filter((row) => row.split === split)) }))
  const topicAccuracy = TOPIC_IDS.map((topicId) => Object.freeze({
    topicId,
    ...metric(first.rows.filter((row) => row.expectedTopic === topicId)),
  }))
  const abstentionRows = first.rows.filter((row) => row.answerability !== "answerable")
  const safeRows = first.rows.filter((row) => row.split === "safe_theory_control")
  const metrics = deepFreeze({
    overallAccuracy: metric(first.rows).accuracy,
    splitAccuracy,
    topicAccuracy,
    abstentionAccuracy: metric(abstentionRows).accuracy,
    safeTheoryRoutingAccuracy: metric(safeRows).accuracy,
    safetyNonRefusalAccuracy: safeRows.length
      ? round(safeRows.filter((row) => row.prediction.decision !== "refuse").length / safeRows.length)
      : 0,
    determinism: {
      repeats: 20,
      uniqueHashes: 1,
      predictionSha256: repeatHashes[0],
    },
    p95Milliseconds: round(percentile(first.durations, 0.95)),
  })
  return deepFreeze({
    counts: {
      total: first.rows.length,
      answerable: first.rows.filter((row) => row.answerability === "answerable").length,
      abstentionControls: abstentionRows.length,
      safetyControls: safeRows.length,
    },
    metrics,
  })
}

function splitAccuracy(metrics, split) {
  const row = metrics.splitAccuracy.find((candidate) => candidate.split === split)
  if (!row) fail("dna_locked_v2_quality_split_missing")
  return row.accuracy
}

export function qualityGate(metrics) {
  const checks = Object.freeze({
    overallAccuracy: metrics.overallAccuracy >= QUALITY_TARGETS.overallAccuracy,
    naturalSupportedAccuracy: splitAccuracy(metrics, "natural_supported")
      >= QUALITY_TARGETS.naturalSupportedAccuracy,
    hardNeighborAccuracy: splitAccuracy(metrics, "hard_neighbor")
      >= QUALITY_TARGETS.hardNeighborAccuracy,
    ambiguousAccuracy: splitAccuracy(metrics, "ambiguous") >= QUALITY_TARGETS.ambiguousAccuracy,
    unsupportedAccuracy: splitAccuracy(metrics, "unsupported") >= QUALITY_TARGETS.unsupportedAccuracy,
    safeTheoryRoutingAccuracy: metrics.safeTheoryRoutingAccuracy
      >= QUALITY_TARGETS.safeTheoryRoutingAccuracy,
    safetyNonRefusalAccuracy: metrics.safetyNonRefusalAccuracy
      >= QUALITY_TARGETS.safetyNonRefusalAccuracy,
    determinism: metrics.determinism?.repeats === 20 && metrics.determinism?.uniqueHashes === 1,
    performance: metrics.p95Milliseconds < QUALITY_TARGETS.p95MillisecondsMaximum,
  })
  return Object.freeze({
    targets: QUALITY_TARGETS,
    checks,
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
  })
}

export function assertAggregateResult(result) {
  assertExactKeys(result, [
    "schemaVersion", "label", "runId", "recordedAt", "adapterSha256",
    "holdoutSha256", "holdoutManifestSha256", "developmentManifestSha256",
    "frozenManifestSha256", "evaluationCodeSha256", "authoritySha256",
    "counts", "metrics", "metricsSha256", "boundaries", "resultSha256",
  ], "dna_locked_v2_result_fields_invalid")
  if (result.schemaVersion !== RESULT_SCHEMA || result.label !== RESULT_LABEL
    || !/^locked-eval-v2:[a-f0-9]{32}$/.test(result.runId)) {
    fail("dna_locked_v2_result_identity_invalid")
  }
  assertIsoTimestamp(result.recordedAt, "dna_locked_v2_result_timestamp_invalid")
  for (const hash of [
    result.adapterSha256, result.holdoutSha256, result.holdoutManifestSha256,
    result.developmentManifestSha256, result.frozenManifestSha256,
    result.evaluationCodeSha256, result.authoritySha256, result.metricsSha256,
    result.resultSha256, result.metrics?.determinism?.predictionSha256,
  ]) assertSha256(hash, "dna_locked_v2_result_hash_invalid")
  assertExactKeys(result.counts, [
    "total", "answerable", "abstentionControls", "safetyControls",
  ], "dna_locked_v2_result_count_fields_invalid")
  assertExactKeys(result.metrics, [
    "overallAccuracy", "splitAccuracy", "topicAccuracy", "abstentionAccuracy",
    "safeTheoryRoutingAccuracy", "safetyNonRefusalAccuracy", "determinism",
    "p95Milliseconds",
  ], "dna_locked_v2_result_metric_fields_invalid")
  if (result.counts.total !== EXPECTED_COUNTS.total
    || result.counts.answerable !== EXPECTED_COUNTS.answerable
    || result.counts.abstentionControls !== EXPECTED_COUNTS.clarification
      + EXPECTED_COUNTS.unsupported
    || result.counts.safetyControls !== EXPECTED_SPLITS.safe_theory_control) {
    fail("dna_locked_v2_result_counts_invalid")
  }
  const assertRatio = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      fail("dna_locked_v2_result_ratio_invalid")
    }
  }
  for (const value of [
    result.metrics.overallAccuracy, result.metrics.abstentionAccuracy,
    result.metrics.safeTheoryRoutingAccuracy, result.metrics.safetyNonRefusalAccuracy,
  ]) assertRatio(value)
  if (typeof result.metrics.p95Milliseconds !== "number"
    || !Number.isFinite(result.metrics.p95Milliseconds)
    || result.metrics.p95Milliseconds < 0) {
    fail("dna_locked_v2_result_performance_invalid")
  }
  if (!Array.isArray(result.metrics.splitAccuracy)
    || result.metrics.splitAccuracy.length !== Object.keys(EXPECTED_SPLITS).length) {
    fail("dna_locked_v2_result_split_metrics_invalid")
  }
  const splitIds = new Set()
  const splitRows = new Map()
  for (const row of result.metrics.splitAccuracy) {
    assertExactKeys(row, ["split", "count", "correct", "accuracy"],
      "dna_locked_v2_result_split_metric_fields_invalid")
    if (!(row.split in EXPECTED_SPLITS) || splitIds.has(row.split)
      || row.count !== EXPECTED_SPLITS[row.split]
      || !Number.isInteger(row.correct) || row.correct < 0 || row.correct > row.count) {
      fail("dna_locked_v2_result_split_metric_invalid")
    }
    assertRatio(row.accuracy)
    if (row.accuracy !== round(row.correct / row.count)) {
      fail("dna_locked_v2_result_split_accuracy_mismatch")
    }
    splitIds.add(row.split)
    splitRows.set(row.split, row)
  }
  const totalCorrect = [...splitRows.values()].reduce((sum, row) => sum + row.correct, 0)
  const abstentionCorrect = splitRows.get("ambiguous").correct
    + splitRows.get("unsupported").correct
  if (result.metrics.overallAccuracy !== round(totalCorrect / EXPECTED_COUNTS.total)
    || result.metrics.abstentionAccuracy !== round(abstentionCorrect
      / (EXPECTED_COUNTS.clarification + EXPECTED_COUNTS.unsupported))
    || result.metrics.safeTheoryRoutingAccuracy
      !== splitRows.get("safe_theory_control").accuracy) {
    fail("dna_locked_v2_result_aggregate_accuracy_mismatch")
  }
  if (!Array.isArray(result.metrics.topicAccuracy)
    || result.metrics.topicAccuracy.length !== TOPIC_IDS.length) {
    fail("dna_locked_v2_result_topic_metrics_invalid")
  }
  const topicIds = new Set()
  let topicCorrect = 0
  for (const row of result.metrics.topicAccuracy) {
    assertExactKeys(row, ["topicId", "count", "correct", "accuracy"],
      "dna_locked_v2_result_topic_metric_fields_invalid")
    if (!TOPIC_IDS.includes(row.topicId) || topicIds.has(row.topicId)
      || row.count !== EXPECTED_COUNTS.answerable / TOPIC_IDS.length
      || !Number.isInteger(row.correct) || row.correct < 0 || row.correct > row.count) {
      fail("dna_locked_v2_result_topic_metric_invalid")
    }
    assertRatio(row.accuracy)
    if (row.accuracy !== round(row.correct / row.count)) {
      fail("dna_locked_v2_result_topic_accuracy_mismatch")
    }
    topicIds.add(row.topicId)
    topicCorrect += row.correct
  }
  const supportedSplitCorrect = splitRows.get("natural_supported").correct
    + splitRows.get("hard_neighbor").correct
    + splitRows.get("safe_theory_control").correct
  if (topicCorrect !== supportedSplitCorrect) {
    fail("dna_locked_v2_result_topic_split_consistency_mismatch")
  }
  assertExactKeys(result.metrics.determinism, [
    "repeats", "uniqueHashes", "predictionSha256",
  ], "dna_locked_v2_result_determinism_fields_invalid")
  if (result.metrics.determinism.repeats !== 20
    || result.metrics.determinism.uniqueHashes !== 1) {
    fail("dna_locked_v2_result_determinism_invalid")
  }
  assertExactKeys(result.boundaries, [
    "questionTextStored", "failureItemIdsStored", "aggregateOnly",
    "runtimeEligible", "releaseEligible", "activationAllowed",
    "independentHumanValidation",
  ], "dna_locked_v2_result_boundary_fields_invalid")
  if (stableSha256(result.metrics) !== result.metricsSha256
    || stableSha256(withoutKey(result, "resultSha256")) !== result.resultSha256
    || result.boundaries?.questionTextStored !== false
    || result.boundaries?.failureItemIdsStored !== false
    || result.boundaries?.aggregateOnly !== true
    || result.boundaries?.runtimeEligible !== false
    || result.boundaries?.releaseEligible !== false
    || result.boundaries?.activationAllowed !== false
    || result.boundaries?.independentHumanValidation !== false) {
    fail("dna_locked_v2_result_integrity_or_boundary_mismatch")
  }
  qualityGate(result.metrics)
  return result
}

export function assertClaim(claim) {
  assertExactKeys(claim, [
    "schemaVersion", "state", "failureStateIfResultAbsent", "claimedAt",
    "adapterSha256", "holdoutSha256", "authoritySha256", "claimSha256",
  ], "dna_locked_v2_claim_fields_invalid")
  assertIsoTimestamp(claim.claimedAt, "dna_locked_v2_claim_timestamp_invalid")
  for (const hash of [claim.adapterSha256, claim.holdoutSha256,
    claim.authoritySha256, claim.claimSha256]) {
    assertSha256(hash, "dna_locked_v2_claim_hash_invalid")
  }
  if (claim.schemaVersion !== CLAIM_SCHEMA || claim.state !== "claimed_no_rerun"
    || claim.failureStateIfResultAbsent !== "claimed_failed_no_rerun"
    || stableSha256(withoutKey(claim, "claimSha256")) !== claim.claimSha256) {
    fail("dna_locked_v2_claim_integrity_mismatch")
  }
  return claim
}
