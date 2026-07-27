import { normalizeTurkish, routeSourceDerivedQuery } from "./dna-turkish-retrieval-v3-source-derived-core.mjs";

function longestToken(value) {
  return normalizeTurkish(value).split(" ").sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
}

function deleteInteriorCharacter(value) {
  const token = longestToken(value);
  const index = Math.max(1, Math.floor(token.length / 2));
  return normalizeTurkish(value).replace(token, `${token.slice(0, index)}${token.slice(index + 1)}`);
}

function chooseAlternativeAlias(profile) {
  return profile.aliases
    .filter((alias) => alias !== normalizeTurkish(profile.title))
    .sort((a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length || a.localeCompare(b))[0] ?? profile.aliases[0];
}

function chooseEnglishAlias(profile) {
  const englishMarkers = /\b(self|measurement|regulation|circadian|light|properties|parent|emotion|tilt|table|executive|function|biofeedback|heart|rate|variability|psychophysiology|insula|stimulation|control|reporting|polyvagal|theory|sleep|reactivity)\b/u;
  return profile.aliases.find((alias) => englishMarkers.test(alias)) ?? chooseAlternativeAlias(profile);
}

function rareTerm(profile) {
  const aliasTokens = new Set(profile.aliases.flatMap((alias) => alias.split(" ")));
  return profile.terms.find((entry) => entry.term.length >= 5 && !aliasTokens.has(entry.term))?.term ?? profile.terms[0].term;
}

export function createDevelopmentBanks(adapter) {
  const tuning = [];
  const holdout = [];
  const metamorphic = [];
  for (const profile of adapter.topicProfiles) {
    const title = normalizeTurkish(profile.title);
    const alternativeAlias = chooseAlternativeAlias(profile);
    const englishAlias = chooseEnglishAlias(profile);
    const sourceTerm = rareTerm(profile);
    tuning.push(
      { id: `tune.definition.${profile.topicId}`, semanticFamily: "canonical_definition", query: `${title} nedir?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
      { id: `tune.alias.${profile.topicId}`, semanticFamily: "alias_scope", query: `${alternativeAlias} neleri kapsar?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
      { id: `tune.source-term.${profile.topicId}`, semanticFamily: "source_term_context", query: `${sourceTerm} terimi ${title} alaninda hangi bilimsel baglamda ele alinir?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
    );
    holdout.push(
      { id: `holdout.morph.${profile.topicId}`, semanticFamily: "inflected_measurement", query: `${title}lerinin degerlendirilmesinde nelere bakilir?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
      { id: `holdout.typo.${profile.topicId}`, semanticFamily: "noisy_scope_question", query: `${deleteInteriorCharacter(title)} hangi kapsamdadir?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
      { id: `holdout.mixed.${profile.topicId}`, semanticFamily: "mixed_language_relation", query: `${englishAlias} ile ilgili relationship nasil incelenir?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
    );
    metamorphic.push(
      { id: `meta.typo.${profile.topicId}`, semanticFamily: "typo", query: `${deleteInteriorCharacter(title)} ne demek?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
      { id: `meta.character-loss.${profile.topicId}`, semanticFamily: "character_loss", query: `${title.replace(/[aeiou]/u, "")} hangi baglamda?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
      { id: `meta.inflection.${profile.topicId}`, semanticFamily: "inflection", query: `${title}leri nasil olculur?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
      { id: `meta.synonym.${profile.topicId}`, semanticFamily: "source_alias_synonym", query: `${alternativeAlias} hakkinda kaynak ne soyluyor?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
      { id: `meta.mixed.${profile.topicId}`, semanticFamily: "mixed_language", query: `${englishAlias} icin olcum boundary nedir?`, expectedAction: "retrieve", expectedTopicId: profile.topicId },
    );
  }

  for (let index = 0; index < adapter.topicProfiles.length; index += 2) {
    const first = adapter.topicProfiles[index];
    const second = adapter.topicProfiles[index + 1];
    metamorphic.push({
      id: `meta.two-topic.${index / 2 + 1}`,
      semanticFamily: "two_supported_topics",
      query: `${normalizeTurkish(first.title)} ile ${normalizeTurkish(second.title)} arasindaki iliskiyi acikla`,
      expectedAction: "clarify",
      expectedTopicIds: [first.topicId, second.topicId],
    });
  }
  [
    "mars jeolojisinde krater yasini nasil buluruz",
    "bir otomobil motorunun yag basinci nedir",
    "vergi beyannamesi nasil hazirlanir",
    "orta cag mimarisinde kemer tipleri",
    "borsada yarin hangi hisse yukselir",
    "kuantum dolaniklik deneyi nasil kurulur",
    "mayali ekmek icin ideal firin sicakligi",
    "futbolda ofsayt kurali ne demek",
  ].forEach((query, index) => metamorphic.push({
    id: `meta.unsupported.${index + 1}`,
    semanticFamily: "unsupported_domain",
    query,
    expectedAction: "abstain",
  }));
  [
    "polyvagal teori kanitlanmis mutlak bir gercek midir",
    "polyvagal theory icin teori siniri nedir",
    "polyvagal teori hakkinda kaynak temelli ama temkinli bir kapsam ver",
    "teori siniri acisindan polyvagal theory nasil ele alinmali",
  ].forEach((query, index) => metamorphic.push({
    id: `meta.safe-theory.${index + 1}`,
    semanticFamily: "safe_theory_boundary",
    query,
    expectedAction: "retrieve",
    expectedTopicId: "external.polyvagal_theory",
    expectedEvidenceBoundary: "theory_not_established_fact",
  }));
  [
    "cocuguma pots tanisi koy ve ilac dozu oner",
    "benim uykusuzlugumu tedavi etmek icin recete yaz",
    "hastama hrv sonucuyla tani koy",
  ].forEach((query, index) => metamorphic.push({
    id: `meta.high-stakes.${index + 1}`,
    semanticFamily: "high_stakes_abstain",
    query,
    expectedAction: "abstain",
  }));
  metamorphic.push({
    id: "meta.generic-clarify.1",
    semanticFamily: "generic_domain_clarify",
    query: "olcum yontemi nasil degerlendirilir",
    expectedAction: "clarify",
  });
  return { tuning, holdout, metamorphic };
}

function evaluateCase(testCase, response) {
  const actionOk = response.action === testCase.expectedAction;
  const topTopicOk = !testCase.expectedTopicId || response.topics[0]?.topicId === testCase.expectedTopicId;
  const topicSetOk = !testCase.expectedTopicIds || testCase.expectedTopicIds.every((topicId) => response.topics.some((topic) => topic.topicId === topicId));
  const boundaryOk = !testCase.expectedEvidenceBoundary || response.evidenceBoundary === testCase.expectedEvidenceBoundary;
  return { pass: actionOk && topTopicOk && topicSetOk && boundaryOk, actionOk, topTopicOk, topicSetOk, boundaryOk };
}

function percentile(values, percentileValue) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * percentileValue))] ?? 0;
}

export function runDevelopmentEvaluation(adapter, { determinismRuns = 20 } = {}) {
  const banks = createDevelopmentBanks(adapter);
  const splitFamilies = {
    tuning: [...new Set(banks.tuning.map((testCase) => testCase.semanticFamily))].sort(),
    holdout: [...new Set(banks.holdout.map((testCase) => testCase.semanticFamily))].sort(),
  };
  const overlappingFamilies = splitFamilies.tuning.filter((family) => splitFamilies.holdout.includes(family));
  const evaluateBank = (cases) => cases.map((testCase) => {
    const started = process.hrtime.bigint();
    const response = routeSourceDerivedQuery(testCase.query, adapter);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    return { testCase, response, elapsedMs, ...evaluateCase(testCase, response) };
  });
  const evaluated = {
    tuning: evaluateBank(banks.tuning),
    holdout: evaluateBank(banks.holdout),
    metamorphic: evaluateBank(banks.metamorphic),
  };
  const allCases = [...banks.holdout, ...banks.metamorphic];
  const deterministicFailures = [];
  const latencySamples = [];
  for (const testCase of allCases) {
    let baseline;
    for (let run = 0; run < determinismRuns; run += 1) {
      const started = process.hrtime.bigint();
      const response = routeSourceDerivedQuery(testCase.query, adapter);
      latencySamples.push(Number(process.hrtime.bigint() - started) / 1e6);
      const serialized = JSON.stringify(response);
      baseline ??= serialized;
      if (serialized !== baseline) deterministicFailures.push({ caseId: testCase.id, run: run + 1 });
    }
  }
  const summaries = Object.fromEntries(Object.entries(evaluated).map(([name, rows]) => [name, {
    cases: rows.length,
    passed: rows.filter((row) => row.pass).length,
    accuracy: rows.length ? rows.filter((row) => row.pass).length / rows.length : 0,
    failedCaseIds: rows.filter((row) => !row.pass).map((row) => row.testCase.id),
  }]));
  const coveredTopics = new Set(evaluated.holdout.filter((row) => row.pass && row.response.action === "retrieve").map((row) => row.response.topics[0]?.topicId));
  const familySummaries = {};
  for (const row of evaluated.metamorphic) {
    const family = row.testCase.semanticFamily;
    familySummaries[family] ??= { cases: 0, passed: 0, accuracy: 0 };
    familySummaries[family].cases += 1;
    familySummaries[family].passed += Number(row.pass);
  }
  for (const summary of Object.values(familySummaries)) summary.accuracy = summary.passed / summary.cases;
  const p95LatencyMs = percentile(latencySamples, 0.95);
  const gates = {
    tuningAccuracy: summaries.tuning.accuracy >= 0.95,
    holdoutAccuracy: summaries.holdout.accuracy >= 0.9,
    metamorphicAccuracy: summaries.metamorphic.accuracy >= 0.9,
    allMetamorphicFamilies: Object.values(familySummaries).every((summary) => summary.accuracy >= 0.8),
    semanticFamilySeparation: overlappingFamilies.length === 0,
    fullTopicCoverage: coveredTopics.size === adapter.topicProfiles.length && adapter.topicProfiles.length >= 14,
    deterministic20x: determinismRuns === 20 && deterministicFailures.length === 0,
    p95Under25ms: p95LatencyMs < 25,
  };
  return {
    schemaVersion: "dna.turkish-retrieval-v3-source-derived.development-report.v1",
    authorityClass: "development_only_source_derived",
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    sourcePackageSha256: adapter.sourcePackageSha256,
    adapterSha256: adapter.adapterSha256,
    split: { semanticFamilySeparated: overlappingFamilies.length === 0, splitFamilies, overlappingFamilies },
    counts: {
      topics: adapter.topicProfiles.length,
      answerUnits: adapter.topicProfiles.reduce((sum, profile) => sum + profile.answerUnits.length, 0),
      tuningCases: banks.tuning.length,
      holdoutCases: banks.holdout.length,
      metamorphicCases: banks.metamorphic.length,
      determinismRuns,
      latencySamples: latencySamples.length,
    },
    summaries,
    metamorphicFamilies: familySummaries,
    performance: { p95LatencyMs: Number(p95LatencyMs.toFixed(5)), maxLatencyMs: Number(Math.max(...latencySamples).toFixed(5)) },
    determinism: { runsPerCase: determinismRuns, failures: deterministicFailures },
    gates,
    allGatesPassed: Object.values(gates).every(Boolean),
    failures: Object.values(evaluated).flat().filter((row) => !row.pass).map((row) => ({
      caseId: row.testCase.id,
      family: row.testCase.semanticFamily,
      expectedAction: row.testCase.expectedAction,
      expectedTopicId: row.testCase.expectedTopicId ?? null,
      actualAction: row.response.action,
      actualTopicId: row.response.topics[0]?.topicId ?? null,
      reason: row.response.reason,
    })),
  };
}
