import crypto from "node:crypto"

import {
  evaluateTurkishRetrievalV2,
  tokenizeTurkishQuestion,
} from "./generated/dna-retrieval-evaluators/turkish-development-v2.mjs"

export const ADAPTER_SCHEMA = "dna-turkish-retrieval-v2-frozen-adapter@1"
export const DEVELOPMENT_RESULT_SCHEMA = "dna-turkish-retrieval-v2-development-result@1"

const STOPWORDS = new Set([
  "acikla", "aciklar", "aciklarim", "aciklarimisin", "aciklar misin", "aday",
  "alan", "arasinda", "ayri", "bakim", "belli", "benzer", "bilgi", "bilim",
  "bilimsel", "bir", "bireysel", "boyle", "bu", "calisma", "calismalar",
  "cevap", "cerceve", "destek", "destekle", "diger", "direkt", "dogrudan",
  "elde", "ele", "genel", "gerek", "gibi", "hangi", "hakkinda", "icinde",
  "icin", "ilgili", "ile", "incele", "isten", "istemi", "istiyorum", "kanit",
  "kapsam", "kaynak", "konu", "konusunda", "konusundaki", "konum", "kural",
  "kuramsal", "literatur", "mi", "midir", "nasil", "ne", "neden", "nedir",
  "nelerdir", "neyi", "odak", "olarak", "olmayan", "olmadan", "ornegi",
  "ozellikle", "sinir", "soru", "soruyorum", "soyluyor", "surec", "teori",
  "uygulama", "uzerinden", "uzere", "var", "ver", "verir", "yakin", "yalniz",
  "yanit", "yap", "yapilir", "yerine", "yonelik", "yontem", "zaman",
  "research", "context", "evidence", "question",
])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([key, child]) => [key, canonicalize(child)]))
  }
  return value
}

export function canonicalSha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")
}

export function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function omit(value, key) {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function uniqueTokens(values) {
  return [...new Set(values.flatMap((value) => tokenizeTurkishQuestion(value)))]
    .sort((left, right) => left.localeCompare(right, "en"))
}

function meaningful(tokens) {
  return tokens.filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

function countBy(items, selector) {
  const result = {}
  for (const item of items) {
    const key = selector(item)
    result[key] = (result[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, "en")))
}

function percentile(values, percentileValue) {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(ordered.length - 1,
    Math.max(0, Math.ceil(percentileValue * ordered.length) - 1))]
}

function accuracy(records) {
  if (!records.length) return { total: 0, correct: 0, accuracy: 0 }
  const correct = records.filter((record) => record.correct).length
  return { total: records.length, correct, accuracy: Math.round((correct / records.length) * 1e6) / 1e6 }
}

export function validateDevelopmentInputs({ candidate, bank, config }) {
  assert(candidate.schemaVersion === "dna-external-science-candidate@1",
    "retrieval_v2_candidate_schema")
  assert(canonicalSha256(omit(candidate, "packageSha256")) === candidate.packageSha256,
    "retrieval_v2_candidate_hash")
  assert(candidate.topics.length === 14 && candidate.runtimeEligible === false
    && candidate.releaseEligible === false && candidate.activationAllowed === false,
  "retrieval_v2_candidate_boundary")
  assert(bank.schemaVersion === "dna-turkish-retrieval-v2-development-bank@1",
    "retrieval_v2_bank_schema")
  assert(canonicalSha256(omit(bank, "bankSha256")) === bank.bankSha256,
    "retrieval_v2_bank_hash")
  assert(bank.counts.newDevelopmentOnly >= 560 && bank.counts.familyHoldout > 0,
    "retrieval_v2_bank_count")
  assert(bank.questions.every((question) =>
    question.expectedDecision === "route"
      ? typeof question.expectedTopicId === "string"
      : (question.expectedDecision === "clarify" || question.expectedDecision === "abstain")
        && question.expectedTopicId === null), "retrieval_v2_exact_expected_decision")
  assert(config.schemaVersion === "dna-turkish-retrieval-v2-config@1"
    && config.topics.length === 14, "retrieval_v2_config_schema")
  assert(config.boundaries.runtimeEligible === false
    && config.boundaries.releaseEligible === false
    && config.boundaries.activationAllowed === false
    && config.boundaries.lockedHoldoutAccessed === false,
  "retrieval_v2_config_boundary")
  const candidateTopics = new Set(candidate.topics.map((topic) => topic.id))
  assert(config.topics.every((topic) => candidateTopics.has(topic.id)),
    "retrieval_v2_config_topic_binding")
  return true
}

export function compileTurkishRetrievalV2Adapter({
  candidate,
  bank,
  config,
  hashes,
}) {
  validateDevelopmentInputs({ candidate, bank, config })
  const trainingQuestions = bank.questions.filter((question) =>
    question.split !== "family_holdout")
  const familyHoldoutQuestions = bank.questions.filter((question) =>
    question.split === "family_holdout")
  const routeTraining = trainingQuestions.filter((question) => question.expectedDecision === "route")
  const supportedTokensByTopic = new Map(config.topics.map((topic) => [topic.id, new Map()]))
  for (const question of routeTraining) {
    const counts = supportedTokensByTopic.get(question.expectedTopicId)
    assert(counts, `retrieval_v2_training_topic_missing:${question.expectedTopicId}`)
    for (const token of meaningful(tokenizeTurkishQuestion(question.question))) {
      counts.set(token, (counts.get(token) ?? 0) + 1)
    }
  }

  const configTokensByTopic = new Map(config.topics.map((topic) => [topic.id,
    new Set(uniqueTokens([...topic.anchors, ...topic.contexts]))]))
  const topicDocumentFrequency = new Map()
  for (const tokens of configTokensByTopic.values()) {
    for (const token of tokens) topicDocumentFrequency.set(token,
      (topicDocumentFrequency.get(token) ?? 0) + 1)
  }
  const learnedDocumentFrequency = new Map()
  for (const counts of supportedTokensByTopic.values()) {
    for (const token of counts.keys()) learnedDocumentFrequency.set(token,
      (learnedDocumentFrequency.get(token) ?? 0) + 1)
  }

  const topics = config.topics.map((topic) => {
    const anchorTokenSets = topic.anchors.map((anchor) => meaningful(tokenizeTurkishQuestion(anchor)))
      .filter((tokens) => tokens.length > 0)
    const anchorTokens = new Set(anchorTokenSets.flat())
    const contextTokens = meaningful(uniqueTokens(topic.contexts))
    const tokenWeights = {}
    for (const token of anchorTokens) {
      const df = topicDocumentFrequency.get(token) ?? 1
      tokenWeights[token] = Math.round((2.5 + Math.log((15) / (1 + df))) * 1e6) / 1e6
    }
    for (const token of contextTokens) {
      const df = topicDocumentFrequency.get(token) ?? 1
      tokenWeights[token] = Math.max(tokenWeights[token] ?? 0,
        Math.round((1.25 + Math.log((15) / (1 + df)) * 0.65) * 1e6) / 1e6)
    }
    const learned = supportedTokensByTopic.get(topic.id)
    for (const [token, frequency] of learned.entries()) {
      const documentFrequency = learnedDocumentFrequency.get(token) ?? 1
      const exclusivity = 1 / documentFrequency
      if (frequency < 2 && exclusivity < 1) continue
      const learnedWeight = 0.55 + (1.35 * exclusivity) + Math.min(0.9, Math.log1p(frequency) * 0.3)
      tokenWeights[token] = Math.max(tokenWeights[token] ?? 0,
        Math.round(learnedWeight * 1e6) / 1e6)
    }
    const positiveTokens = new Set(Object.keys(tokenWeights))
    const negativeTokenWeights = {}
    for (const token of meaningful(uniqueTokens(topic.negativeTerms))) {
      if (positiveTokens.has(token)) continue
      negativeTokenWeights[token] = config.scoring.negativeTokenPenalty
    }
    const trainingTokenSets = routeTraining
      .filter((question) => question.expectedTopicId === topic.id)
      .map((question) => meaningful(tokenizeTurkishQuestion(question.question)))
      .filter((tokens) => tokens.length > 0)
    return {
      id: topic.id,
      tokenWeights: Object.fromEntries(Object.entries(tokenWeights)
        .sort(([a], [b]) => a.localeCompare(b, "en"))),
      anchorTokenSets,
      trainingTokenSets,
      contextTokens,
      negativeTokenWeights: Object.fromEntries(Object.entries(negativeTokenWeights)
        .sort(([a], [b]) => a.localeCompare(b, "en"))),
      rareWeightFloor: 2.6,
    }
  })

  const allPositiveTokens = new Set(topics.flatMap((topic) => Object.keys(topic.tokenWeights)))
  const unsupportedTraining = trainingQuestions.filter((question) =>
    question.expectedDecision === "abstain")
  const unsupportedFrequencies = new Map()
  for (const question of unsupportedTraining) {
    for (const token of meaningful(tokenizeTurkishQuestion(question.question))) {
      if (allPositiveTokens.has(token)) continue
      unsupportedFrequencies.set(token, (unsupportedFrequencies.get(token) ?? 0) + 1)
    }
  }
  const unsupportedTokenWeights = Object.fromEntries([...unsupportedFrequencies.entries()]
    .filter(([token]) => token.length >= 4)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([token, frequency]) => [token,
      Math.round((2.65 + Math.min(0.85, Math.log1p(frequency) * 0.25)) * 1e6) / 1e6]))
  const unsupportedTokenSets = unsupportedTraining.map((question) =>
    meaningful(tokenizeTurkishQuestion(question.question))
      .filter((token) => unsupportedTokenWeights[token] !== undefined)
      .slice(0, 8))
    .filter((tokens) => tokens.length > 0)
  const ambiguousTokenSets = trainingQuestions
    .filter((question) => question.expectedDecision === "clarify")
    .map((question) => meaningful(tokenizeTurkishQuestion(question.question)))
    .filter((tokens) => tokens.length > 0)

  const tuningAllowlist = Object.fromEntries(topics.map((topic) => [topic.id,
    Object.keys(topic.tokenWeights).sort((left, right) => left.localeCompare(right, "en"))]))
  const tuningQuestionIds = trainingQuestions.map((question) => question.id)
    .sort((left, right) => left.localeCompare(right, "en"))
  const familyHoldoutQuestionIds = familyHoldoutQuestions.map((question) => question.id)
    .sort((left, right) => left.localeCompare(right, "en"))
  const base = {
    schemaVersion: ADAPTER_SCHEMA,
    version: "turkish-retrieval-v2",
    basisAt: candidate.basisAt,
    authorityClass: "development_only_external_science_candidate",
    evaluatorCodeSha256: hashes.evaluatorCodeSha256,
    compilerCodeSha256: hashes.compilerCodeSha256,
    configFileSha256: hashes.configFileSha256,
    candidatePackageSha256: candidate.packageSha256,
    candidateFileSha256: hashes.candidateFileSha256,
    developmentBankSha256: bank.bankSha256,
    developmentBankFileSha256: hashes.bankFileSha256,
    existingExternalScienceQaFileSha256: bank.inputs.existingExternalScienceQaFileSha256,
    tuningQuestionIdsSha256: canonicalSha256(tuningQuestionIds),
    familyHoldoutQuestionIdsSha256: canonicalSha256(familyHoldoutQuestionIds),
    tuningAllowlistSha256: canonicalSha256(tuningAllowlist),
    tuningAllowlist,
    scoring: config.scoring,
    normalization: config.normalization,
    topics,
    unsupportedTokenWeights,
    unsupportedTokenSets,
    ambiguousTokenSets,
    counts: {
      topics: topics.length,
      trainingQuestions: trainingQuestions.length,
      familyHoldoutQuestions: familyHoldoutQuestions.length,
      tuningAllowlistTokens: Object.values(tuningAllowlist)
        .reduce((sum, tokens) => sum + tokens.length, 0),
      unsupportedTokens: Object.keys(unsupportedTokenWeights).length,
      unsupportedTokenSets: unsupportedTokenSets.length,
      ambiguousTokenSets: ambiguousTokenSets.length,
    },
    boundaries: {
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      ownerBookAuthority: false,
      lockedHoldoutAccessed: false,
      officialEvaluationAuthority: false,
      multiStepMechanismAllowed: false,
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    lockedHoldoutAccessed: false,
  }
  return { ...base, adapterSha256: canonicalSha256(base) }
}

export function validateTurkishRetrievalV2Adapter(adapter) {
  assert(adapter.schemaVersion === ADAPTER_SCHEMA && adapter.version === "turkish-retrieval-v2",
    "retrieval_v2_adapter_schema")
  assert(canonicalSha256(omit(adapter, "adapterSha256")) === adapter.adapterSha256,
    "retrieval_v2_adapter_hash")
  assert(adapter.topics.length === 14
    && new Set(adapter.topics.map((topic) => topic.id)).size === 14,
  "retrieval_v2_adapter_topics")
  assert(adapter.tuningAllowlistSha256 === canonicalSha256(adapter.tuningAllowlist),
    "retrieval_v2_adapter_allowlist_hash")
  assert(adapter.runtimeEligible === false && adapter.releaseEligible === false
    && adapter.activationAllowed === false && adapter.lockedHoldoutAccessed === false
    && adapter.boundaries.officialEvaluationAuthority === false,
  "retrieval_v2_adapter_boundary")
  return true
}

export function evaluateDevelopmentBank(adapter, bank) {
  validateTurkishRetrievalV2Adapter(adapter)
  assert(adapter.developmentBankSha256 === bank.bankSha256,
    "retrieval_v2_adapter_bank_binding")
  const timings = []
  const records = bank.questions.map((question) => {
    const started = performance.now()
    const actual = evaluateTurkishRetrievalV2(question.question, adapter)
    timings.push(performance.now() - started)
    const correct = actual.decision === question.expectedDecision
      && (question.expectedDecision !== "route" || actual.topicId === question.expectedTopicId)
    return {
      id: question.id,
      source: question.source,
      split: question.split,
      category: question.category,
      transformation: question.transformation,
      metamorphicGroupId: question.metamorphicGroupId,
      expectedDecision: question.expectedDecision,
      expectedTopicId: question.expectedTopicId,
      actualDecision: actual.decision,
      actualTopicId: actual.topicId,
      topScore: actual.topScore,
      secondScore: actual.secondScore,
      margin: actual.margin,
      unsupportedPenalty: actual.unsupportedPenalty,
      correct,
    }
  })
  const naturalCategories = new Set(["natural", "natural_paraphrase", "catalog_anchor"])
  const families = {
    natural: accuracy(records.filter((record) => naturalCategories.has(record.category))),
    hardNeighbor: accuracy(records.filter((record) => record.category === "hard_neighbor")),
    ambiguous: accuracy(records.filter((record) => record.category === "ambiguous")),
    unsupported: accuracy(records.filter((record) => record.category === "unsupported")),
    safeTheory: accuracy(records.filter((record) => record.category === "safe_theory")),
  }
  const familyHoldoutRecords = records.filter((record) => record.split === "family_holdout")
  const familyHoldout = {
    natural: accuracy(familyHoldoutRecords.filter((record) => naturalCategories.has(record.category))),
    hardNeighbor: accuracy(familyHoldoutRecords.filter((record) => record.category === "hard_neighbor")),
    ambiguous: accuracy(familyHoldoutRecords.filter((record) => record.category === "ambiguous")),
    unsupported: accuracy(familyHoldoutRecords.filter((record) => record.category === "unsupported")),
    safeTheory: accuracy(familyHoldoutRecords.filter((record) => record.category === "safe_theory")),
  }
  const metamorphicGroups = new Map()
  for (const record of records.filter((entry) => entry.metamorphicGroupId)) {
    const group = metamorphicGroups.get(record.metamorphicGroupId) ?? []
    group.push(record)
    metamorphicGroups.set(record.metamorphicGroupId, group)
  }
  const metamorphic = [...metamorphicGroups.entries()].map(([id, group]) => ({
    id,
    total: group.length,
    correct: group.every((record) => record.correct),
  }))
  const scores = Object.values(familyHoldout).map((value) => value.accuracy)
  const gate = scores.every((score) => score >= 0.95)
    && familyHoldout.unsupported.accuracy === 1
  return {
    schemaVersion: DEVELOPMENT_RESULT_SCHEMA,
    adapterSha256: adapter.adapterSha256,
    developmentBankSha256: bank.bankSha256,
    counts: {
      questions: records.length,
      correct: records.filter((record) => record.correct).length,
      incorrect: records.filter((record) => !record.correct).length,
      ...countBy(records, (record) => `decision:${record.expectedDecision}`),
    },
    families,
    familyHoldout,
    splits: Object.fromEntries([...new Set(records.map((record) => record.split))]
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((split) => [split, accuracy(records.filter((record) => record.split === split))])),
    transformations: Object.fromEntries([...new Set(records.map((record) => record.transformation))]
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((transformation) => [transformation,
        accuracy(records.filter((record) => record.transformation === transformation))])),
    metamorphic: {
      groups: metamorphic.length,
      passing: metamorphic.filter((group) => group.correct).length,
      accuracy: metamorphic.length
        ? Math.round((metamorphic.filter((group) => group.correct).length / metamorphic.length) * 1e6) / 1e6
        : 0,
    },
    performance: {
      evaluations: timings.length,
      p50Milliseconds: Math.round(percentile(timings, 0.5) * 1e6) / 1e6,
      p95Milliseconds: Math.round(percentile(timings, 0.95) * 1e6) / 1e6,
      maximumMilliseconds: Math.round(Math.max(...timings) * 1e6) / 1e6,
    },
    gate: {
      naturalAtLeast95: familyHoldout.natural.accuracy >= 0.95,
      hardNeighborAtLeast95: familyHoldout.hardNeighbor.accuracy >= 0.95,
      ambiguousAtLeast95: familyHoldout.ambiguous.accuracy >= 0.95,
      unsupportedExact100: familyHoldout.unsupported.accuracy === 1,
      safeTheoryAtLeast95: familyHoldout.safeTheory.accuracy >= 0.95,
      p95Below25Milliseconds: percentile(timings, 0.95) < 25,
      developmentGate: gate && percentile(timings, 0.95) < 25 ? "pass" : "fail",
    },
    failures: records.filter((record) => !record.correct),
    records,
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
