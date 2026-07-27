#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_CANDIDATE_PACKAGE,
  buildSourceDerivedAdapter,
  normalizeTurkish,
  routeSourceDerivedQuery,
  tokenize,
} from "./dna-turkish-retrieval-v3-source-derived-core.mjs";
import {
  createDevelopmentBanks,
  runDevelopmentEvaluation,
} from "./dna-turkish-retrieval-v3-source-derived-development.mjs";

const candidatePackage = JSON.parse(fs.readFileSync(DEFAULT_CANDIDATE_PACKAGE, "utf8"));
const adapter = buildSourceDerivedAdapter(candidatePackage);

assert.equal(adapter.topicProfiles.length, 14);
assert.equal(adapter.topicProfiles.reduce((sum, profile) => sum + profile.answerUnits.length, 0), 220);
assert.equal(adapter.runtimeEligible, false);
assert.equal(adapter.releaseEligible, false);
assert.equal(adapter.activationAllowed, false);
assert.equal(adapter.ownerAuthority, false);
assert.deepEqual(adapter.inputs, {
  candidatePackage: true,
  answerUnitCount: 220,
  sourcePassageCount: 166,
  lockedPayloads: false,
  officialMetrics: false,
  priorAdapterResults: false,
});

const serializedAdapter = JSON.stringify(adapter);
assert.equal(serializedAdapter.includes("originalText"), false);
assert.equal(serializedAdapter.includes("proposition"), false);
assert.equal(serializedAdapter.includes("publicationStatus"), false);

const sourceVocabulary = new Set(tokenize([
  ...candidatePackage.topics.flatMap((topic) => [topic.title, ...(topic.aliases ?? [])]),
  ...candidatePackage.lexicalIndex.flatMap((entry) => [entry.title, ...(entry.aliases ?? []), ...(entry.keywords ?? [])]),
  ...candidatePackage.claims.map((claim) => claim.proposition),
  ...candidatePackage.passages.map((passage) => passage.originalText),
].join(" ")));
for (const profile of adapter.topicProfiles) {
  for (const entry of profile.terms) assert.equal(sourceVocabulary.has(entry.term), true, `Non-source term: ${entry.term}`);
  for (const unit of profile.answerUnits) {
    for (const entry of unit.terms) assert.equal(sourceVocabulary.has(entry.term), true, `Non-source answer-unit term: ${entry.term}`);
  }
}

const banks = createDevelopmentBanks(adapter);
const tuningFamilies = new Set(banks.tuning.map((testCase) => testCase.semanticFamily));
const holdoutFamilies = new Set(banks.holdout.map((testCase) => testCase.semanticFamily));
assert.equal([...tuningFamilies].some((family) => holdoutFamilies.has(family)), false);
assert.equal(new Set(banks.holdout.map((testCase) => testCase.expectedTopicId)).size, 14);
for (const family of ["typo", "character_loss", "inflection", "source_alias_synonym", "mixed_language", "two_supported_topics", "unsupported_domain", "safe_theory_boundary"]) {
  assert.equal(banks.metamorphic.some((testCase) => testCase.semanticFamily === family), true, `Missing metamorphic family: ${family}`);
}

const unsupported = routeSourceDerivedQuery("antik roma su kemerlerinin mimarisi", adapter);
assert.equal(unsupported.action, "abstain");
assert.equal(unsupported.reason, "unsupported_topic");
const generic = routeSourceDerivedQuery("olcum yontemi nasil degerlendirilir", adapter);
assert.equal(generic.action, "clarify");
const highStakes = routeSourceDerivedQuery("cocuguma tani koy ve ilac dozu oner", adapter);
assert.equal(highStakes.action, "abstain");
assert.equal(highStakes.reason, "high_stakes_out_of_scope");
const safeTheory = routeSourceDerivedQuery("polyvagal teori mutlak gercek midir", adapter);
assert.equal(safeTheory.action, "retrieve");
assert.equal(safeTheory.topics[0].topicId, "external.polyvagal_theory");
assert.equal(safeTheory.evidenceBoundary, "theory_not_established_fact");

const firstTopic = adapter.topicProfiles[0];
const secondTopic = adapter.topicProfiles[1];
const twoTopic = routeSourceDerivedQuery(`${firstTopic.aliases[0]} ve ${secondTopic.aliases[0]} arasindaki iliski`, adapter);
assert.equal(twoTopic.action, "clarify");
assert.equal(twoTopic.reason, "multiple_supported_topics");

const tampered = structuredClone(adapter);
tampered.topicProfiles[0].terms[0].weight += 1;
assert.throws(() => routeSourceDerivedQuery("hrv nedir", tampered), /integrity verification failed/u);

assert.equal(normalizeTurkish("Öz-düzenleme / ÖLÇÜMÜ"), "oz duzenleme olcumu");
const report = runDevelopmentEvaluation(adapter, { determinismRuns: 20 });
assert.equal(report.split.semanticFamilySeparated, true);
assert.equal(report.counts.topics, 14);
assert.equal(report.counts.answerUnits, 220);
assert.equal(report.determinism.runsPerCase, 20);
assert.equal(report.allGatesPassed, true, JSON.stringify({ gates: report.gates, failures: report.failures }, null, 2));

console.log(JSON.stringify({
  ok: true,
  adapterSha256: adapter.adapterSha256,
  counts: report.counts,
  summaries: report.summaries,
  metamorphicFamilies: report.metamorphicFamilies,
  performance: report.performance,
  gates: report.gates,
}, null, 2));
