import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"

export const HOLDOUT_SCHEMA = "dna-turkish-retrieval-v3-blind-sealed-holdout@1"
export const HOLDOUT_PAYLOAD_SCHEMA = "dna-turkish-retrieval-v3-blind-holdout@1"
export const RESULT_SCHEMA = "dna-one-shot-locked-evaluation-v3-result@1"
export const CLAIM_SCHEMA = "dna-one-shot-locked-evaluation-v3-claim@1"
export const RESULT_LABEL = "internal_locked_holdout_v3_not_independent_human_validation"

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
  answer: 126,
  clarify: 42,
  abstain: 28,
})

export const EXPECTED_SPLITS = Object.freeze({
  natural_supported: 56,
  hard_neighbor: 42,
  ambiguous: 42,
  unsupported: 28,
  safe_theory_control: 28,
})

export const EXPECTED_INTENTS = Object.freeze({
  age_development: 28,
  comparison: 28,
  definition: 28,
  evidence: 28,
  measurement: 28,
  misconception: 28,
  relationship: 28,
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

export function assertPureV3EvaluatorSource(source) {
  if (typeof source !== "string" || source.length < 100 || source.length > 200_000) {
    fail("dna_locked_v3_evaluator_source_invalid")
  }
  const start = source.indexOf("export function routeSourceDerivedQuery")
  const end = source.indexOf("export function loadAdapter", start)
  if (start < 0 || end <= start) fail("dna_locked_v3_evaluator_export_missing")
  const routeSource = source.slice(start, end)
  const forbidden = [
    /\b(?:fs|child_process|https?|net|tls|dgram|worker_threads)\b/,
    /\b(?:fetch|WebSocket|XMLHttpRequest)\b/, /\bprocess(?:\.|\[)/,
    /\b(?:globalThis|window|document|Deno|Bun)(?:\.|\[)/,
    /\b(?:console|stdout|stderr)\b/,
    /\b(?:writeFile|appendFile|createWriteStream|unlink|rename|mkdir|rmdir)\b/,
    /\/(?:Volumes|Users|private|tmp|var|etc)(?:\/|\b)/,
    /\b(?:eval|Function)\s*\(/, /\bMath\.random\b/,
  ]
  if (forbidden.some((pattern) => pattern.test(routeSource))) {
    fail("dna_locked_v3_evaluator_impure_or_forbidden_source")
  }
  if (!/export\s+function\s+routeSourceDerivedQuery\s*\(\s*query\s*,\s*adapter\s*\)/.test(routeSource)) {
    fail("dna_locked_v3_evaluator_export_missing")
  }
  return true
}

export function assertFrozenAdapter(adapter) {
  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) {
    fail("dna_locked_v3_adapter_invalid")
  }
  if (adapter.schemaVersion !== "dna.turkish-retrieval-v3-source-derived.adapter.v1"
    || stableSha256(withoutKey(adapter, "adapterSha256")) !== adapter.adapterSha256
    || adapter.topicProfiles?.length !== TOPIC_IDS.length
    || new Set(adapter.topicProfiles.map((topic) => topic.topicId)).size !== TOPIC_IDS.length
    || TOPIC_IDS.some((topicId) => !adapter.topicProfiles
      .some((topic) => topic.topicId === topicId))) {
    fail("dna_locked_v3_adapter_contract_mismatch")
  }
  for (const hash of [adapter.adapterSha256, adapter.sourcePackageSha256,
    adapter.sourcePackageContentSha256]) assertSha256(hash, "dna_locked_v3_adapter_hash_invalid")
  if (adapter.runtimeEligible !== false || adapter.releaseEligible !== false
    || adapter.activationAllowed !== false || adapter.ownerAuthority !== false
    || adapter.inputs?.lockedPayloads !== false || adapter.inputs?.officialMetrics !== false
    || adapter.inputs?.priorAdapterResults !== false) {
    fail("dna_locked_v3_adapter_boundary_mismatch")
  }
  return adapter
}

function sealedJsonSha256(value) {
  return sha256(`${JSON.stringify(canonicalize(value), null, 2)}\n`)
}

export function assertSealedHoldoutArtifact(artifact, expected = {}) {
  assertExactKeys(artifact, [
    "activationAllowed", "authoredPayloadSha256", "candidatePackageFileSha256",
    "candidatePackageSha256", "independentHumanValidation", "officialRunPerformed",
    "payload", "releaseEligible", "runtimeEligible", "schemaVersion", "scoringPerformed",
    "sealPolicy", "sealedPayloadSha256",
  ], "dna_locked_v3_holdout_fields_invalid")
  if (artifact.schemaVersion !== HOLDOUT_SCHEMA
    || artifact.sealPolicy !== "atomic_hash_bound_ssd_0600_no_local_fallback@1") {
    fail("dna_locked_v3_holdout_not_sealed")
  }
  for (const hash of [artifact.authoredPayloadSha256, artifact.candidatePackageFileSha256,
    artifact.candidatePackageSha256, artifact.sealedPayloadSha256]) {
    assertSha256(hash, "dna_locked_v3_holdout_hash_invalid")
  }
  if (sealedJsonSha256(withoutKey(artifact, "sealedPayloadSha256"))
      !== artifact.sealedPayloadSha256
    || expected.fileSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expected.fileSha256)
    || expected.sealedPayloadSha256 !== undefined
      && expected.sealedPayloadSha256 !== artifact.sealedPayloadSha256
    || expected.candidatePackageSha256 !== undefined
      && expected.candidatePackageSha256 !== artifact.candidatePackageSha256
    || expected.candidatePackageFileSha256 !== undefined
      && expected.candidatePackageFileSha256 !== artifact.candidatePackageFileSha256) {
    fail("dna_locked_v3_holdout_integrity_mismatch")
  }
  const payload = artifact.payload
  assertExactKeys(payload, [
    "activationAllowed", "authorityClass", "basisAt", "blindness", "counts",
    "evaluationId", "independentHumanValidation", "items", "language",
    "officialRunPerformed", "payloadSha256", "releaseEligible", "runtimeEligible",
    "schemaVersion", "scoringPerformed", "sourceBinding",
  ], "dna_locked_v3_holdout_payload_fields_invalid")
  if (payload.schemaVersion !== HOLDOUT_PAYLOAD_SCHEMA
    || sealedJsonSha256(withoutKey(payload, "payloadSha256")) !== payload.payloadSha256
    || payload.payloadSha256 !== artifact.authoredPayloadSha256
    || payload.counts?.total !== EXPECTED_COUNTS.total
    || stableJson(payload.counts?.byCategory) !== stableJson(EXPECTED_SPLITS)
    || stableJson(payload.counts?.byIntent) !== stableJson(EXPECTED_INTENTS)
    || payload.counts?.byDisposition?.answer !== EXPECTED_COUNTS.answer
    || payload.counts?.byDisposition?.clarify !== EXPECTED_COUNTS.clarify
    || payload.counts?.byDisposition?.abstain !== EXPECTED_COUNTS.abstain
    || [artifact, payload].some((value) => value.runtimeEligible !== false
      || value.releaseEligible !== false || value.activationAllowed !== false
      || value.independentHumanValidation !== false || value.officialRunPerformed !== false
      || value.scoringPerformed !== false)) {
    fail("dna_locked_v3_holdout_boundary_or_count_mismatch")
  }
  if (!Array.isArray(payload.items) || payload.items.length !== EXPECTED_COUNTS.total) {
    fail("dna_locked_v3_holdout_item_count_mismatch")
  }
  const ids = new Set()
  const normalized = new Set()
  const families = new Set()
  const splitCounts = Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [split, 0]))
  const intentCounts = Object.fromEntries(Object.keys(EXPECTED_INTENTS).map((intent) => [intent, 0]))
  const dispositionCounts = { answer: 0, clarify: 0, abstain: 0 }
  for (const item of payload.items) {
    assertExactKeys(item, [
      "authoritySourceId", "category", "expectedDisposition", "expectedTopic", "id",
      "intent", "perturbations", "question", "semanticFamily",
    ], "dna_locked_v3_holdout_item_fields_invalid")
    if (typeof item.id !== "string" || !/^tr-v3-blind-\d{3}$/.test(item.id)
      || ids.has(item.id) || typeof item.question !== "string"
      || item.question.trim().length < 8 || item.question.length > 500
      || item.question.includes("\n") || typeof item.semanticFamily !== "string"
      || !item.semanticFamily || families.has(item.semanticFamily)
      || !Array.isArray(item.perturbations)) fail("dna_locked_v3_holdout_item_invalid")
    ids.add(item.id)
    families.add(item.semanticFamily)
    const normalizedQuestion = normalizeQuestion(item.question)
    if (!normalizedQuestion || normalized.has(normalizedQuestion)) {
      fail("dna_locked_v3_holdout_question_duplicate")
    }
    normalized.add(normalizedQuestion)
    if (!(item.category in splitCounts) || !(item.intent in intentCounts)
      || !(item.expectedDisposition in dispositionCounts)) {
      fail("dna_locked_v3_holdout_taxonomy_invalid")
    }
    splitCounts[item.category] += 1
    intentCounts[item.intent] += 1
    dispositionCounts[item.expectedDisposition] += 1
    if (item.expectedDisposition === "answer") {
      if (!TOPIC_IDS.includes(item.expectedTopic) || typeof item.authoritySourceId !== "string") {
        fail("dna_locked_v3_holdout_answerable_mismatch")
      }
    } else if (item.expectedTopic !== null || item.authoritySourceId !== null) {
      fail("dna_locked_v3_holdout_nonanswer_mismatch")
    }
  }
  if (stableJson(splitCounts) !== stableJson(EXPECTED_SPLITS)
    || stableJson(intentCounts) !== stableJson(EXPECTED_INTENTS)
    || stableJson(dispositionCounts) !== stableJson({
      answer: EXPECTED_COUNTS.answer, clarify: EXPECTED_COUNTS.clarify,
      abstain: EXPECTED_COUNTS.abstain,
    })) fail("dna_locked_v3_holdout_distribution_mismatch")
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
  const blocked = () => fail("dna_locked_v3_evaluator_output_forbidden")
  console.log = blocked
  console.warn = blocked
  console.error = blocked
  console.info = blocked
  process.stdout.write = blocked
  process.stderr.write = blocked
  try {
    const result = route(question, adapter)
    if (result && typeof result.then === "function") {
      fail("dna_locked_v3_async_evaluator_forbidden")
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
    || !["retrieve", "clarify", "abstain"].includes(prediction.action)
    || !Array.isArray(prediction.topics) || !Array.isArray(prediction.answerUnits)
    || (prediction.action === "retrieve"
      ? !TOPIC_IDS.includes(prediction.topics[0]?.topicId)
      : prediction.action === "abstain" && prediction.topics.length !== 0)
    || prediction.runtimeEligible !== false || prediction.releaseEligible !== false
    || prediction.activationAllowed !== false || prediction.ownerAuthority !== false) {
    fail("dna_locked_v3_prediction_invalid")
  }
}

function evaluateOnce(route, adapter, items, measure) {
  const rows = []
  const durations = []
  for (const item of items) {
    const before = stableSha256(adapter)
    const started = measure ? performance.now() : 0
    const prediction = callWithoutOutput(route, item.question, adapter)
    if (measure) durations.push(performance.now() - started)
    if (stableSha256(adapter) !== before) fail("dna_locked_v3_adapter_mutation_detected")
    assertPrediction(prediction)
    const topicId = prediction.topics[0]?.topicId ?? null
    const correct = item.expectedDisposition === "answer"
      ? prediction.action === "retrieve" && topicId === item.expectedTopic
      : item.expectedDisposition === "clarify"
        ? prediction.action === "clarify"
        : prediction.action === "abstain"
    rows.push(Object.freeze({
      split: item.category,
      intent: item.intent,
      disposition: item.expectedDisposition,
      expectedTopic: item.expectedTopic,
      prediction: Object.freeze({ action: prediction.action, topicId }),
      correct,
    }))
  }
  return { rows: Object.freeze(rows), durations: Object.freeze(durations) }
}

export function evaluateLockedHoldout(route, adapterInput, artifactInput) {
  const adapter = deepFreeze(adapterInput)
  const artifact = deepFreeze(artifactInput)
  const frozenHash = stableSha256({ adapter, artifact })
  const first = evaluateOnce(route, adapter, artifact.payload.items, true)
  const repeatHashes = []
  for (let index = 0; index < 20; index += 1) {
    const current = evaluateOnce(route, adapter, artifact.payload.items, false)
    repeatHashes.push(stableSha256(current.rows.map((row) => row.prediction)))
  }
  if (new Set(repeatHashes).size !== 1) fail("dna_locked_v3_determinism_failed")
  if (stableSha256({ adapter, artifact }) !== frozenHash) {
    fail("dna_locked_v3_evaluation_input_mutation_detected")
  }
  const splitAccuracy = Object.keys(EXPECTED_SPLITS).sort((left, right) => left.localeCompare(right, "en"))
    .map((split) => Object.freeze({ split, ...metric(first.rows.filter((row) => row.split === split)) }))
  const topicAccuracy = TOPIC_IDS.map((topicId) => Object.freeze({
    topicId,
    ...metric(first.rows.filter((row) => row.expectedTopic === topicId)),
  }))
  const intentAccuracy = Object.keys(EXPECTED_INTENTS)
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((intent) => Object.freeze({
      intent,
      ...metric(first.rows.filter((row) => row.intent === intent)),
    }))
  const clarificationRows = first.rows.filter((row) => row.disposition === "clarify")
  const abstentionRows = first.rows.filter((row) => row.disposition === "abstain")
  const safeRows = first.rows.filter((row) => row.split === "safe_theory_control")
  const metrics = deepFreeze({
    overallAccuracy: metric(first.rows).accuracy,
    splitAccuracy,
    intentAccuracy,
    topicAccuracy,
    clarificationAccuracy: metric(clarificationRows).accuracy,
    abstentionAccuracy: metric(abstentionRows).accuracy,
    safeTheoryRoutingAccuracy: metric(safeRows).accuracy,
    safetyNonRefusalAccuracy: safeRows.length
      ? round(safeRows.filter((row) => row.prediction.action !== "abstain").length / safeRows.length)
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
      answerControls: first.rows.filter((row) => row.disposition === "answer").length,
      clarificationControls: clarificationRows.length,
      abstentionControls: abstentionRows.length,
      safetyControls: safeRows.length,
    },
    metrics,
  })
}

function splitAccuracy(metrics, split) {
  const row = metrics.splitAccuracy.find((candidate) => candidate.split === split)
  if (!row) fail("dna_locked_v3_quality_split_missing")
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
  ], "dna_locked_v3_result_fields_invalid")
  if (result.schemaVersion !== RESULT_SCHEMA || result.label !== RESULT_LABEL
    || !/^locked-eval-v3:[a-f0-9]{32}$/.test(result.runId)) {
    fail("dna_locked_v3_result_identity_invalid")
  }
  assertIsoTimestamp(result.recordedAt, "dna_locked_v3_result_timestamp_invalid")
  for (const hash of [
    result.adapterSha256, result.holdoutSha256, result.holdoutManifestSha256,
    result.developmentManifestSha256, result.frozenManifestSha256,
    result.evaluationCodeSha256, result.authoritySha256, result.metricsSha256,
    result.resultSha256, result.metrics?.determinism?.predictionSha256,
  ]) assertSha256(hash, "dna_locked_v3_result_hash_invalid")
  assertExactKeys(result.counts, [
    "total", "answerControls", "clarificationControls", "abstentionControls",
    "safetyControls",
  ], "dna_locked_v3_result_count_fields_invalid")
  assertExactKeys(result.metrics, [
    "overallAccuracy", "splitAccuracy", "intentAccuracy", "topicAccuracy",
    "clarificationAccuracy", "abstentionAccuracy", "safeTheoryRoutingAccuracy",
    "safetyNonRefusalAccuracy", "determinism", "p95Milliseconds",
  ], "dna_locked_v3_result_metric_fields_invalid")
  if (result.counts.total !== EXPECTED_COUNTS.total
    || result.counts.answerControls !== EXPECTED_COUNTS.answer
    || result.counts.clarificationControls !== EXPECTED_COUNTS.clarify
    || result.counts.abstentionControls !== EXPECTED_COUNTS.abstain
    || result.counts.safetyControls !== EXPECTED_SPLITS.safe_theory_control) {
    fail("dna_locked_v3_result_counts_invalid")
  }
  const assertRatio = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      fail("dna_locked_v3_result_ratio_invalid")
    }
  }
  for (const value of [
    result.metrics.overallAccuracy, result.metrics.clarificationAccuracy,
    result.metrics.abstentionAccuracy,
    result.metrics.safeTheoryRoutingAccuracy, result.metrics.safetyNonRefusalAccuracy,
  ]) assertRatio(value)
  if (typeof result.metrics.p95Milliseconds !== "number"
    || !Number.isFinite(result.metrics.p95Milliseconds)
    || result.metrics.p95Milliseconds < 0) {
    fail("dna_locked_v3_result_performance_invalid")
  }
  if (!Array.isArray(result.metrics.splitAccuracy)
    || result.metrics.splitAccuracy.length !== Object.keys(EXPECTED_SPLITS).length) {
    fail("dna_locked_v3_result_split_metrics_invalid")
  }
  const splitIds = new Set()
  const splitRows = new Map()
  for (const row of result.metrics.splitAccuracy) {
    assertExactKeys(row, ["split", "count", "correct", "accuracy"],
      "dna_locked_v3_result_split_metric_fields_invalid")
    if (!(row.split in EXPECTED_SPLITS) || splitIds.has(row.split)
      || row.count !== EXPECTED_SPLITS[row.split]
      || !Number.isInteger(row.correct) || row.correct < 0 || row.correct > row.count) {
      fail("dna_locked_v3_result_split_metric_invalid")
    }
    assertRatio(row.accuracy)
    if (row.accuracy !== round(row.correct / row.count)) {
      fail("dna_locked_v3_result_split_accuracy_mismatch")
    }
    splitIds.add(row.split)
    splitRows.set(row.split, row)
  }
  const totalCorrect = [...splitRows.values()].reduce((sum, row) => sum + row.correct, 0)
  if (result.metrics.overallAccuracy !== round(totalCorrect / EXPECTED_COUNTS.total)
    || result.metrics.clarificationAccuracy !== splitRows.get("ambiguous").accuracy
    || result.metrics.abstentionAccuracy !== splitRows.get("unsupported").accuracy
    || result.metrics.safeTheoryRoutingAccuracy
      !== splitRows.get("safe_theory_control").accuracy) {
    fail("dna_locked_v3_result_aggregate_accuracy_mismatch")
  }
  if (!Array.isArray(result.metrics.intentAccuracy)
    || result.metrics.intentAccuracy.length !== Object.keys(EXPECTED_INTENTS).length) {
    fail("dna_locked_v3_result_intent_metrics_invalid")
  }
  const intentIds = new Set()
  let intentCorrect = 0
  for (const row of result.metrics.intentAccuracy) {
    assertExactKeys(row, ["intent", "count", "correct", "accuracy"],
      "dna_locked_v3_result_intent_metric_fields_invalid")
    if (!(row.intent in EXPECTED_INTENTS) || intentIds.has(row.intent)
      || row.count !== EXPECTED_INTENTS[row.intent]
      || !Number.isInteger(row.correct) || row.correct < 0 || row.correct > row.count) {
      fail("dna_locked_v3_result_intent_metric_invalid")
    }
    assertRatio(row.accuracy)
    if (row.accuracy !== round(row.correct / row.count)) {
      fail("dna_locked_v3_result_intent_accuracy_mismatch")
    }
    intentIds.add(row.intent)
    intentCorrect += row.correct
  }
  if (intentCorrect !== totalCorrect) fail("dna_locked_v3_result_intent_consistency_mismatch")
  if (!Array.isArray(result.metrics.topicAccuracy)
    || result.metrics.topicAccuracy.length !== TOPIC_IDS.length) {
    fail("dna_locked_v3_result_topic_metrics_invalid")
  }
  const topicIds = new Set()
  let topicCorrect = 0
  for (const row of result.metrics.topicAccuracy) {
    assertExactKeys(row, ["topicId", "count", "correct", "accuracy"],
      "dna_locked_v3_result_topic_metric_fields_invalid")
    if (!TOPIC_IDS.includes(row.topicId) || topicIds.has(row.topicId)
      || row.count !== EXPECTED_COUNTS.answer / TOPIC_IDS.length
      || !Number.isInteger(row.correct) || row.correct < 0 || row.correct > row.count) {
      fail("dna_locked_v3_result_topic_metric_invalid")
    }
    assertRatio(row.accuracy)
    if (row.accuracy !== round(row.correct / row.count)) {
      fail("dna_locked_v3_result_topic_accuracy_mismatch")
    }
    topicIds.add(row.topicId)
    topicCorrect += row.correct
  }
  const supportedSplitCorrect = splitRows.get("natural_supported").correct
    + splitRows.get("hard_neighbor").correct
    + splitRows.get("safe_theory_control").correct
  if (topicCorrect !== supportedSplitCorrect) {
    fail("dna_locked_v3_result_topic_split_consistency_mismatch")
  }
  assertExactKeys(result.metrics.determinism, [
    "repeats", "uniqueHashes", "predictionSha256",
  ], "dna_locked_v3_result_determinism_fields_invalid")
  if (result.metrics.determinism.repeats !== 20
    || result.metrics.determinism.uniqueHashes !== 1) {
    fail("dna_locked_v3_result_determinism_invalid")
  }
  assertExactKeys(result.boundaries, [
    "questionTextStored", "failureItemIdsStored", "aggregateOnly",
    "runtimeEligible", "releaseEligible", "activationAllowed",
    "independentHumanValidation",
  ], "dna_locked_v3_result_boundary_fields_invalid")
  if (stableSha256(result.metrics) !== result.metricsSha256
    || stableSha256(withoutKey(result, "resultSha256")) !== result.resultSha256
    || result.boundaries?.questionTextStored !== false
    || result.boundaries?.failureItemIdsStored !== false
    || result.boundaries?.aggregateOnly !== true
    || result.boundaries?.runtimeEligible !== false
    || result.boundaries?.releaseEligible !== false
    || result.boundaries?.activationAllowed !== false
    || result.boundaries?.independentHumanValidation !== false) {
    fail("dna_locked_v3_result_integrity_or_boundary_mismatch")
  }
  qualityGate(result.metrics)
  return result
}

export function assertClaim(claim) {
  assertExactKeys(claim, [
    "schemaVersion", "state", "failureStateIfResultAbsent", "claimedAt",
    "adapterSha256", "holdoutSha256", "authoritySha256", "claimSha256",
  ], "dna_locked_v3_claim_fields_invalid")
  assertIsoTimestamp(claim.claimedAt, "dna_locked_v3_claim_timestamp_invalid")
  for (const hash of [claim.adapterSha256, claim.holdoutSha256,
    claim.authoritySha256, claim.claimSha256]) {
    assertSha256(hash, "dna_locked_v3_claim_hash_invalid")
  }
  if (claim.schemaVersion !== CLAIM_SCHEMA || claim.state !== "claimed_no_rerun"
    || claim.failureStateIfResultAbsent !== "claimed_failed_no_rerun"
    || stableSha256(withoutKey(claim, "claimSha256")) !== claim.claimSha256) {
    fail("dna_locked_v3_claim_integrity_mismatch")
  }
  return claim
}
