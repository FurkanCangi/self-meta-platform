#!/usr/bin/env node
import { realpathSync } from "node:fs";
import {
  assertRegularFile0600,
  assertResearchSsdPath,
  atomicWrite,
  canonicalJson,
  countBy,
  parseArgs,
  readJson,
  sha256File,
  sha256Json,
} from "./lib/dna-v3-blind-holdout-io.mjs";

const DEFAULT_CANDIDATE = "/Volumes/ResearchSSD/Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json";

const LAYOUT = [
  { category: "natural_supported", intent: "definition", disposition: "answer", family: "scope-in-plain-words", perturbations: ["synonym"] },
  { category: "natural_supported", intent: "measurement", disposition: "answer", family: "measurement-procedure-boundary", perturbations: ["inflection"] },
  { category: "natural_supported", intent: "evidence", disposition: "answer", family: "evidence-strength-reading", perturbations: ["mixed_language"] },
  { category: "natural_supported", intent: "age_development", disposition: "answer", family: "age-population-transfer", perturbations: ["age_reference"] },
  { category: "hard_neighbor", intent: "comparison", disposition: "answer", family: "neighbor-disambiguation", perturbations: ["two_topic", "negation"] },
  { category: "hard_neighbor", intent: "relationship", disposition: "answer", family: "bounded-association", perturbations: ["character_loss"] },
  { category: "hard_neighbor", intent: "misconception", disposition: "answer", family: "near-miss-correction", perturbations: ["typo"] },
  { category: "ambiguous", intent: "definition", disposition: "clarify", family: "underspecified-referent", perturbations: ["ambiguity", "synonym"] },
  { category: "ambiguous", intent: "comparison", disposition: "clarify", family: "missing-comparison-criterion", perturbations: ["two_topic"] },
  { category: "ambiguous", intent: "relationship", disposition: "clarify", family: "contextless-followup", perturbations: ["followup", "character_loss"] },
  { category: "unsupported", intent: "measurement", disposition: "abstain", family: "individual-score-overreach", perturbations: ["negation"] },
  { category: "unsupported", intent: "age_development", disposition: "abstain", family: "unsupported-age-prescription", perturbations: ["age_reference", "inflection"] },
  { category: "safe_theory_control", intent: "evidence", disposition: "answer", family: "supported-limit-control", perturbations: ["safe_control", "mixed_language"] },
  { category: "safe_theory_control", intent: "misconception", disposition: "answer", family: "certainty-deflation-control", perturbations: ["safe_control", "typo", "negation"] },
];

function fail(message) {
  throw new Error(message);
}

function validateSpec(spec, candidate) {
  if (spec.schemaVersion !== "dna-turkish-retrieval-v3-blind-author-spec@1") fail("author spec schemaVersion geçersiz");
  if (spec.basisPackageSha256 !== candidate.packageSha256) fail("author spec candidate package hash bağı uyuşmuyor");
  if (spec.independentHumanValidation !== false) fail("independentHumanValidation false olmalıdır");
  if (!Array.isArray(spec.topicSpecs) || spec.topicSpecs.length !== 14) fail("tam 14 topicSpecs gerekir");
  const candidateIds = candidate.topics.map((topic) => topic.id).sort();
  const specIds = spec.topicSpecs.map((topic) => topic.topicId).sort();
  if (new Set(specIds).size !== 14 || JSON.stringify(candidateIds) !== JSON.stringify(specIds)) {
    fail("topicSpecs konu kümesi candidate package ile birebir olmalıdır");
  }
  for (const topic of spec.topicSpecs) {
    if (!Array.isArray(topic.questions) || topic.questions.length !== LAYOUT.length) {
      fail(`${topic.topicId} için tam ${LAYOUT.length} soru gerekir`);
    }
    if (topic.questions.some((question) => typeof question !== "string" || question.trim().length < 18 || !question.trim().endsWith("?"))) {
      fail(`${topic.topicId} doğal soru biçimi ihlali`);
    }
  }
}

function buildPayload(spec, candidate, candidateFileSha256) {
  const topicById = new Map(candidate.topics.map((topic) => [topic.id, topic]));
  let sequence = 0;
  const items = spec.topicSpecs.flatMap((topicSpec) =>
    LAYOUT.map((layout, slot) => {
      sequence += 1;
      const topic = topicById.get(topicSpec.topicId);
      return {
        id: `tr-v3-blind-${String(sequence).padStart(3, "0")}`,
        question: topicSpec.questions[slot].trim(),
        category: layout.category,
        intent: layout.intent,
        semanticFamily: `${topicSpec.topicId}:${layout.family}`,
        perturbations: layout.perturbations,
        expectedDisposition: layout.disposition,
        expectedTopic: layout.disposition === "answer" ? topicSpec.topicId : null,
        authoritySourceId: layout.disposition === "answer" ? topic.sourceId : null,
      };
    }),
  );

  const questions = items.map((item) => item.question.normalize("NFC").toLocaleLowerCase("tr-TR"));
  if (new Set(questions).size !== items.length) fail("sorular benzersiz olmalıdır");
  if (new Set(items.map((item) => item.semanticFamily)).size !== items.length) fail("semantic family değerleri benzersiz olmalıdır");

  const payload = {
    schemaVersion: "dna-turkish-retrieval-v3-blind-holdout@1",
    evaluationId: "turkish-retrieval-v3-source-derived-blind-holdout-v3",
    language: "tr",
    basisAt: spec.basisAt,
    authorityClass: "external_science_candidate_only",
    sourceBinding: {
      candidatePackageSha256: candidate.packageSha256,
      candidatePackageFileSha256: candidateFileSha256,
      candidateTopicCount: candidate.topics.length,
      candidatePassageCount: candidate.passages.length,
      candidateClaimCount: candidate.claims.length,
    },
    blindness: {
      authoredWithoutReadingPriorRetrievalEvaluationArtifacts: true,
      priorV1V2ArtifactsRead: false,
      existingSourceDerivedV3ArtifactsRead: false,
      allowedAuthorityInputsOnly: true,
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    independentHumanValidation: false,
    officialRunPerformed: false,
    scoringPerformed: false,
    counts: {
      total: items.length,
      topics: new Set(items.map((item) => item.expectedTopic).filter(Boolean)).size,
      byCategory: countBy(items, "category"),
      byIntent: countBy(items, "intent"),
      byDisposition: countBy(items, "expectedDisposition"),
      perAuthorityTopic: Object.fromEntries(candidate.topics.map((topic) => [topic.id, items.filter((item) => item.semanticFamily.startsWith(`${topic.id}:`)).length])),
    },
    items,
  };
  payload.payloadSha256 = sha256Json(payload);
  return payload;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const specPath = args.spec;
  const candidatePath = args.candidate ?? DEFAULT_CANDIDATE;
  const outputPath = args.output;
  if (!specPath || !outputPath) fail("--spec ve --output zorunludur");
  assertResearchSsdPath(specPath, "author spec");
  assertResearchSsdPath(candidatePath, "candidate package");
  assertResearchSsdPath(outputPath, "authored payload");
  assertRegularFile0600(specPath, "author spec");
  assertRegularFile0600(candidatePath, "candidate package");
  if (realpathSync(candidatePath) !== realpathSync(DEFAULT_CANDIDATE)) {
    fail("yalnız sabit external-science candidate package otorite girdisi kabul edilir");
  }
  const candidate = readJson(candidatePath);
  const spec = readJson(specPath);
  validateSpec(spec, candidate);
  const payload = buildPayload(spec, candidate, sha256File(candidatePath));
  atomicWrite(outputPath, canonicalJson(payload), 0o600);
  if (args.summary) {
    process.stdout.write(`${JSON.stringify({ outputPath, payloadSha256: payload.payloadSha256, counts: payload.counts })}\n`);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
