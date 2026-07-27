import { createHash } from "node:crypto"

export const ADAPTER_CONFIG_SCHEMA = "dna-turkish-retrieval-adapter-config@1"
export const FROZEN_ADAPTER_SCHEMA = "dna-frozen-turkish-retrieval-adapter@1"
export const LOCKED_EVALUATION_RESULT_SCHEMA = "dna-one-shot-locked-evaluation-result@2"
export const INTERNAL_VALIDATION_LABEL =
  "internal_locked_holdout_not_independent_human_validation"
export const EVALUATOR_MODULE_PREFIX = "scripts/generated/dna-retrieval-evaluators/"

export const EXTERNAL_SCIENCE_TOPIC_IDS = Object.freeze([
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

export function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8")
  return createHash("sha256").update(bytes).digest("hex")
}

export function stableSha256(value) {
  return sha256(stableJson(value))
}

export function normalizeTurkish(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function fail(code) {
  throw new Error(code)
}

export function assertExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code)
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) fail(code)
}

function assertSha256(value, code) {
  if (!/^[a-f0-9]{64}$/.test(value)) fail(code)
}

function assertIsoTimestamp(value, code) {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(code)
}

function assertIdentifier(value, code) {
  if (!/^[a-z0-9][a-z0-9._:@/-]{2,199}$/i.test(value)) fail(code)
}

function assertPhrase(value, code) {
  if (typeof value !== "string" || value !== value.trim() || value.includes("?")
    || value.includes("\n") || value.length < 2 || value.length > 80) fail(code)
  const tokens = normalizeTurkish(value).split(" ").filter(Boolean)
  if (tokens.length < 1 || tokens.length > 4) fail(code)
}

function assertPhraseList(values, code) {
  if (!Array.isArray(values) || values.length < 2 || values.length > 8) fail(code)
  const normalized = new Set()
  for (const value of values) {
    assertPhrase(value, code)
    const phrase = normalizeTurkish(value)
    if (normalized.has(phrase)) fail(code)
    normalized.add(phrase)
  }
}

function assertThresholds(thresholds) {
  assertExactKeys(thresholds, [
    "answerMinimum", "contextPhraseWeight", "marginMinimum",
    "negativePhrasePenalty", "positivePhraseWeight",
  ], "dna_adapter_thresholds_unknown_or_missing_field")
  for (const value of Object.values(thresholds)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) {
      fail("dna_adapter_threshold_invalid")
    }
  }
  if (thresholds.positivePhraseWeight <= 0 || thresholds.answerMinimum <= 0) {
    fail("dna_adapter_threshold_invalid")
  }
}

function assertTopics(topics) {
  if (!Array.isArray(topics) || topics.length !== EXTERNAL_SCIENCE_TOPIC_IDS.length) {
    fail("dna_adapter_topic_count_mismatch")
  }
  const observed = new Set()
  for (const topic of topics) {
    assertExactKeys(topic, [
      "contextPhrases", "negativePhrases", "positivePhrases", "topicId",
    ], "dna_adapter_topic_unknown_or_missing_field")
    if (!EXTERNAL_SCIENCE_TOPIC_IDS.includes(topic.topicId) || observed.has(topic.topicId)) {
      fail("dna_adapter_topic_identity_mismatch")
    }
    observed.add(topic.topicId)
    assertPhraseList(topic.positivePhrases, "dna_adapter_positive_phrase_invalid")
    assertPhraseList(topic.negativePhrases, "dna_adapter_negative_phrase_invalid")
    assertPhraseList(topic.contextPhrases, "dna_adapter_context_phrase_invalid")
  }
  if (EXTERNAL_SCIENCE_TOPIC_IDS.some((topicId) => !observed.has(topicId))) {
    fail("dna_adapter_topic_coverage_mismatch")
  }
}

export function assertAdapterConfig(config) {
  assertExactKeys(config, [
    "configSha256", "schemaVersion", "thresholds", "topics",
  ], "dna_adapter_config_unknown_or_missing_field")
  if (config.schemaVersion !== ADAPTER_CONFIG_SCHEMA) fail("dna_adapter_config_schema_mismatch")
  assertThresholds(config.thresholds)
  assertTopics(config.topics)
  const { configSha256, ...payload } = config
  assertSha256(configSha256, "dna_adapter_config_hash_invalid")
  if (configSha256 !== stableSha256(payload)) fail("dna_adapter_config_hash_mismatch")
  return config
}

function normalizePath(value) {
  return String(value).replace(/\\/g, "/").replace(/^\.\//, "")
}

function pathIsForbidden(value, forbiddenPaths) {
  const normalized = normalizePath(value).toLocaleLowerCase("en-US")
  if (normalized.includes("questions-and-answers")
    || normalized.includes("locked-holdout")
    || normalized.includes("locked_holdout")) return true
  return forbiddenPaths.some((path) => {
    const forbidden = normalizePath(path).toLocaleLowerCase("en-US")
    return normalized === forbidden || normalized.startsWith(`${forbidden}/`)
  })
}

export function assertEvaluatorModuleRelativePath(value) {
  const normalized = normalizePath(value)
  if (typeof value !== "string" || normalized !== value || value.startsWith("/")
    || value.includes("..") || !value.startsWith(EVALUATOR_MODULE_PREFIX)
    || !value.endsWith(".mjs") || /(?:^|\/)\./.test(value)) {
    fail("dna_adapter_evaluator_module_invalid")
  }
  return normalized
}

export function assertPureEvaluatorSource(source) {
  if (typeof source !== "string" || source.length < 40 || source.length > 100_000) {
    fail("dna_adapter_evaluator_source_invalid")
  }
  const forbidden = [
    /\bimport\s*(?:\(|[\s{*])/,
    /\bimport\s*\./,
    /\brequire\s*\(/,
    /\b(?:fs|child_process|https?|net|tls|dgram|worker_threads)\b/,
    /\b(?:fetch|WebSocket|XMLHttpRequest)\b/,
    /\bprocess(?:\.|\[)/,
    /\b(?:globalThis|window|document|Deno|Bun)(?:\.|\[)/,
    /\b(?:setTimeout|setInterval|queueMicrotask)\s*\(/,
    /\b(?:console|stdout|stderr)\b/,
    /\b(?:writeFile|appendFile|createWriteStream|unlink|rename|mkdir|rmdir)\b/,
    /\/Volumes(?:\/|\b)/,
    /(?:^|[^a-z])(?:locked|holdout)(?:[^a-z]|$)/i,
    /(?:^|["'`])\/(?:Users|private|tmp|var|etc)(?:\/|["'`])/,
    /\b(?:eval|Function)\s*\(/,
    /\b(?:Date|performance|crypto)\b/,
    /\bMath\.random\b/,
  ]
  if (forbidden.some((pattern) => pattern.test(source))) {
    fail("dna_adapter_evaluator_impure_or_forbidden_source")
  }
  if (!/export\s+(?:async\s+)?function\s+routeFrozenAdapter\s*\(\s*adapter\s*,\s*question\s*\)/.test(source)) {
    fail("dna_adapter_evaluator_export_missing")
  }
  return true
}

function assertTuningInputs(entries, forbiddenPaths) {
  if (!Array.isArray(entries) || entries.length < 2 || entries.length > 12) {
    fail("dna_adapter_tuning_allowlist_count_invalid")
  }
  const observedIds = new Set()
  const observedPaths = new Set()
  for (const entry of entries) {
    assertExactKeys(entry, [
      "id", "kind", "location", "relativePath", "sha256",
    ], "dna_adapter_tuning_input_unknown_or_missing_field")
    assertIdentifier(entry.id, "dna_adapter_tuning_input_id_invalid")
    if (![
      "candidate_package", "development_qa", "adapter_config",
    ].includes(entry.kind)) fail("dna_adapter_tuning_input_kind_invalid")
    if (!["repo", "research_ssd"].includes(entry.location)) {
      fail("dna_adapter_tuning_input_location_invalid")
    }
    if (typeof entry.relativePath !== "string" || !entry.relativePath
      || entry.relativePath.startsWith("/") || entry.relativePath.includes("..")) {
      fail("dna_adapter_tuning_input_path_invalid")
    }
    if (pathIsForbidden(entry.relativePath, forbiddenPaths)) {
      fail("dna_adapter_locked_tuning_input_forbidden")
    }
    assertSha256(entry.sha256, "dna_adapter_tuning_input_hash_invalid")
    const key = `${entry.location}:${normalizePath(entry.relativePath)}`
    if (observedIds.has(entry.id) || observedPaths.has(key)) {
      fail("dna_adapter_tuning_input_duplicate")
    }
    observedIds.add(entry.id)
    observedPaths.add(key)
  }
  if (!entries.some((entry) => entry.kind === "development_qa")
    || !entries.some((entry) => entry.kind === "adapter_config")) {
    fail("dna_adapter_required_tuning_input_missing")
  }
}

export function adapterConfigPayload(config) {
  assertAdapterConfig(config)
  return Object.freeze({
    topics: config.topics,
    thresholds: config.thresholds,
  })
}

export function createFrozenAdapter(input) {
  assertAdapterConfig(input.config)
  assertSha256(input.candidatePackageSha256, "dna_adapter_candidate_hash_invalid")
  assertSha256(input.developmentQaEvaluationSha256, "dna_adapter_development_hash_invalid")
  assertSha256(input.codeSha256, "dna_adapter_code_hash_invalid")
  assertIsoTimestamp(input.frozenAt, "dna_adapter_frozen_at_invalid")
  assertIdentifier(input.adapterId, "dna_adapter_id_invalid")
  assertEvaluatorModuleRelativePath(input.evaluatorModule)
  if (!Array.isArray(input.forbiddenInputPaths) || input.forbiddenInputPaths.length < 1
    || input.forbiddenInputPaths.some((path) => typeof path !== "string" || !path.trim())) {
    fail("dna_adapter_forbidden_paths_invalid")
  }
  assertTuningInputs(input.tuningInputAllowlist, input.forbiddenInputPaths)
  const payload = Object.freeze({
    schemaVersion: FROZEN_ADAPTER_SCHEMA,
    status: "frozen",
    adapterId: input.adapterId,
    frozenAt: input.frozenAt,
    candidatePackageSha256: input.candidatePackageSha256,
    developmentQaEvaluationSha256: input.developmentQaEvaluationSha256,
    evaluatorModule: input.evaluatorModule,
    codeSha256: input.codeSha256,
    configSha256: input.config.configSha256,
    builtWithoutLockedHoldout: true,
    tuningInputAllowlist: input.tuningInputAllowlist,
    forbiddenInputPaths: input.forbiddenInputPaths.map(normalizePath).sort(),
    topics: input.config.topics,
    thresholds: input.config.thresholds,
    runtimeEligible: false,
    releaseEligible: false,
  })
  return Object.freeze({ ...payload, adapterSha256: stableSha256(payload) })
}

export function assertFrozenAdapter(adapter, options = {}) {
  assertExactKeys(adapter, [
    "adapterId", "adapterSha256", "builtWithoutLockedHoldout",
    "candidatePackageSha256", "codeSha256", "configSha256",
    "developmentQaEvaluationSha256", "evaluatorModule", "forbiddenInputPaths", "frozenAt",
    "releaseEligible", "runtimeEligible", "schemaVersion", "status",
    "thresholds", "topics", "tuningInputAllowlist",
  ], "dna_adapter_unknown_or_missing_field")
  if (adapter.schemaVersion !== FROZEN_ADAPTER_SCHEMA || adapter.status !== "frozen") {
    fail("dna_adapter_not_frozen")
  }
  assertIdentifier(adapter.adapterId, "dna_adapter_id_invalid")
  assertEvaluatorModuleRelativePath(adapter.evaluatorModule)
  if (pathIsForbidden(adapter.evaluatorModule, adapter.forbiddenInputPaths)) {
    fail("dna_adapter_evaluator_module_invalid")
  }
  assertIsoTimestamp(adapter.frozenAt, "dna_adapter_frozen_at_invalid")
  for (const value of [
    adapter.adapterSha256, adapter.candidatePackageSha256,
    adapter.developmentQaEvaluationSha256, adapter.codeSha256, adapter.configSha256,
  ]) assertSha256(value, "dna_adapter_hash_invalid")
  if (adapter.builtWithoutLockedHoldout !== true || adapter.runtimeEligible !== false
    || adapter.releaseEligible !== false) fail("dna_adapter_boundary_mismatch")
  if (!Array.isArray(adapter.forbiddenInputPaths) || adapter.forbiddenInputPaths.length < 1) {
    fail("dna_adapter_forbidden_paths_invalid")
  }
  assertThresholds(adapter.thresholds)
  assertTopics(adapter.topics)
  assertTuningInputs(adapter.tuningInputAllowlist, adapter.forbiddenInputPaths)
  const configPayload = {
    schemaVersion: ADAPTER_CONFIG_SCHEMA,
    topics: adapter.topics,
    thresholds: adapter.thresholds,
  }
  if (adapter.configSha256 !== stableSha256(configPayload)) fail("dna_adapter_config_drift")
  if (options.expectedCodeSha256 && adapter.codeSha256 !== options.expectedCodeSha256) {
    fail("dna_adapter_code_drift")
  }
  const { adapterSha256, ...payload } = adapter
  if (adapterSha256 !== stableSha256(payload)) fail("dna_adapter_hash_mismatch")
  return adapter
}
