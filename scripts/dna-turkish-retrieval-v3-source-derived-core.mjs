import crypto from "node:crypto";
import fs from "node:fs";

export const SCHEMA_VERSION = "dna.turkish-retrieval-v3-source-derived.adapter.v1";
export const DEFAULT_CANDIDATE_PACKAGE =
  "/Volumes/ResearchSSD/Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json";
export const DEFAULT_ARTIFACT_DIR =
  "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-v3-source-derived/development-v1";

const STOP_WORDS = new Set([
  "acaba", "ama", "and", "ara", "are", "as", "at", "bu", "da", "de", "daha", "do", "does", "for",
  "gibi", "hangi", "hakkinda", "hakkındaki", "how", "ile", "icin", "in", "is", "it", "mi", "midir", "mu",
  "mudur", "nasil", "ne", "nedir", "neden", "of", "olarak", "olan", "the", "to", "ve", "veya", "what",
  "which", "with", "yaklasim", "yontem", "source", "sources", "kaynak", "kaynaklar",
]);

const INTENT_PATTERNS = Object.freeze({
  measurement: ["olc", "degerlendir", "measure", "instrument", "raporla", "test", "metrik"],
  definition: ["nedir", "ne demek", "tanim", "define", "what is", "kavram"],
  relation: ["iliski", "baglanti", "etki", "relationship", "relate", "association", "birlikte"],
  scope: ["kapsam", "sinir", "hangi baglam", "scope", "boundary", "neleri kapsar"],
});

const HIGH_STAKES_PATTERNS = [
  /\b(tani|teşhis|tedavi|recete|ila[çc]|doz|acil|hastalik|hastalig)\b/u,
  /\b(diagnos|treat|prescri|medication|dose|emergency)\w*/u,
  /\b(benim|cocugum|çocuğum|hastam)\b.*\b(ne yap|tani|tedavi|ila[çc])\b/u,
];

const GENERIC_DOMAIN_TERMS = new Set([
  "olcum", "degerlendirme", "iliski", "baglanti", "duzenleme", "test", "yontem", "teori", "uyku", "beyin",
]);

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function normalizeTurkish(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ç]/gu, "c")
    .replace(/[ğ]/gu, "g")
    .replace(/[ı]/gu, "i")
    .replace(/[ö]/gu, "o")
    .replace(/[ş]/gu, "s")
    .replace(/[ü]/gu, "u")
    .replace(/[’']/gu, "")
    .replace(/[^a-z0-9\s-]/gu, " ")
    .replace(/[-_/]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const TURKISH_SUFFIXES = [
  "lerindeki", "larindaki", "lerimiz", "larimiz", "lerinin", "larinin", "lerden", "lardan", "leri", "lari",
  "indeki", "indaki", "undaki", "deki", "daki", "imiz", "umuz", "iniz", "unuz", "inin", "unun", "den", "dan",
  "dir", "dur", "tir", "tur", "lik", "luk", "sel", "sal", "nin", "nun", "yla", "yle", "ler", "lar",
  "i", "u", "e", "a",
];

export function stemToken(token) {
  let result = token;
  for (const suffix of TURKISH_SUFFIXES) {
    if (result.length - suffix.length >= 4 && result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  return result;
}

export function tokenize(value) {
  return normalizeTurkish(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function levenshteinWithin(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const value = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

function tokenSimilarity(queryToken, sourceToken) {
  if (queryToken === sourceToken) return 1;
  if (stemToken(queryToken) === stemToken(sourceToken)) return 0.93;
  const shortest = Math.min(queryToken.length, sourceToken.length);
  const limit = shortest >= 8 ? 2 : shortest >= 5 ? 1 : 0;
  if (!limit) return 0;
  const distance = levenshteinWithin(queryToken, sourceToken, limit);
  if (distance > limit) return 0;
  return distance === 1 ? 0.84 : 0.7;
}

function deriveIntent(normalizedQuery) {
  let best = "scope";
  let bestCount = 0;
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    const count = patterns.filter((pattern) => normalizedQuery.includes(normalizeTurkish(pattern))).length;
    if (count > bestCount) {
      best = intent;
      bestCount = count;
    }
  }
  return best;
}

function buildTokenCounts(value) {
  const counts = new Map();
  for (const token of tokenize(value)) {
    if (token.length < 3 || /^\d+$/u.test(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function validateCandidatePackage(candidatePackage) {
  if (!candidatePackage || candidatePackage.counts?.topics !== 14 || candidatePackage.counts?.answerUnits !== 220) {
    throw new Error("Candidate package must contain exactly 14 topics and 220 answer units.");
  }
  if (candidatePackage.topics.length !== 14 || candidatePackage.answerUnits.length !== 220) {
    throw new Error("Candidate package arrays do not match declared counts.");
  }
  if (candidatePackage.runtimeEligible || candidatePackage.releaseEligible || candidatePackage.activationAllowed) {
    throw new Error("Candidate package authority boundary is not development-only.");
  }
}

export function buildSourceDerivedAdapter(candidatePackage) {
  validateCandidatePackage(candidatePackage);
  const passages = new Map(candidatePackage.passages.map((passage) => [passage.id, passage]));
  const claims = new Map(candidatePackage.claims.map((claim) => [claim.id, claim]));
  const lexical = new Map(candidatePackage.lexicalIndex.map((entry) => [entry.topicId, entry]));
  const documentFrequency = new Map();
  const rawProfiles = candidatePackage.topics.map((topic) => {
    const lex = lexical.get(topic.id) ?? {};
    const aliases = [...new Set([topic.title, ...(topic.aliases ?? []), ...(lex.aliases ?? [])])];
    const topicClaims = candidatePackage.claims.filter((claim) => claim.topicId === topic.id);
    const sourceText = topicClaims.map((claim) => `${claim.proposition} ${passages.get(claim.passageId)?.originalText ?? ""}`).join(" ");
    const counts = buildTokenCounts(`${aliases.join(" ")} ${(lex.keywords ?? []).join(" ")} ${sourceText}`);
    for (const token of counts.keys()) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    return { topic, lex, aliases, topicClaims, counts };
  });

  const topicProfiles = rawProfiles.map(({ topic, lex, aliases, topicClaims, counts }) => {
    const aliasTokens = new Set(tokenize(`${aliases.join(" ")} ${(lex.keywords ?? []).join(" ")}`));
    const terms = [...counts.entries()]
      .map(([term, count]) => {
        const idf = Math.log((rawProfiles.length + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
        const sourceBoost = aliasTokens.has(term) ? 5 : 1;
        return { term, weight: Number((idf * (sourceBoost + Math.log1p(count))).toFixed(5)) };
      })
      .filter((entry) => entry.weight >= 1.2)
      .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
      .slice(0, 96);

    const answerUnits = candidatePackage.answerUnits
      .filter((unit) => unit.topicId === topic.id)
      .map((unit) => {
        const claim = claims.get(unit.claimId);
        const passage = passages.get(unit.passageId);
        const localCounts = buildTokenCounts(`${claim?.proposition ?? ""} ${passage?.originalText ?? ""}`);
        const localTerms = [...localCounts.entries()]
          .map(([term, count]) => ({ term, weight: count }))
          .sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term))
          .slice(0, 24);
        return {
          answerUnitId: unit.id,
          claimId: unit.claimId,
          passageId: unit.passageId,
          sourceId: unit.sourceId,
          terms: localTerms,
        };
      })
      .sort((a, b) => a.answerUnitId.localeCompare(b.answerUnitId));

    return {
      topicId: topic.id,
      title: topic.title,
      aliases: aliases.map(normalizeTurkish).sort(),
      terms,
      answerUnits,
      theoryBoundary: topic.id === "external.polyvagal_theory",
    };
  }).sort((a, b) => a.topicId.localeCompare(b.topicId));

  const adapter = {
    schemaVersion: SCHEMA_VERSION,
    sourcePackageSha256: candidatePackage.packageSha256,
    sourcePackageContentSha256: sha256(stableStringify(candidatePackage)),
    authorityClass: "development_only_source_derived",
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    inputs: {
      candidatePackage: true,
      answerUnitCount: candidatePackage.answerUnits.length,
      sourcePassageCount: candidatePackage.passages.length,
      lockedPayloads: false,
      officialMetrics: false,
      priorAdapterResults: false,
    },
    thresholds: {
      retrievalScore: 8.5,
      ambiguityScore: 6.5,
      ambiguityRatio: 0.84,
      answerUnitLimit: 5,
    },
    topicProfiles,
  };
  return { ...adapter, adapterSha256: sha256(stableStringify(adapter)) };
}

function scoreProfile(queryTokens, normalizedQuery, profile) {
  let score = 0;
  let matchedTokenCount = 0;
  let exactAlias = false;
  let exactAliasTokenCount = 0;
  for (const alias of profile.aliases) {
    const aliasTokenCount = tokenize(alias).length;
    if (aliasTokenCount >= 2 && alias.length >= 5 && normalizedQuery.includes(alias)) {
      exactAlias = true;
      exactAliasTokenCount = Math.max(exactAliasTokenCount, aliasTokenCount);
      score = Math.max(score, 13 + aliasTokenCount * 2.5);
    }
  }
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const entry of profile.terms) {
      const similarity = tokenSimilarity(queryToken, entry.term);
      if (similarity > 0) best = Math.max(best, similarity * Math.min(entry.weight, 8));
    }
    if (best >= 1) {
      matchedTokenCount += 1;
      score += best;
    }
  }
  return { score: Number(score.toFixed(5)), matchedTokenCount, exactAlias, exactAliasTokenCount };
}

function rankAnswerUnits(queryTokens, profile, limit) {
  return profile.answerUnits
    .map((unit) => {
      let score = 0;
      for (const queryToken of queryTokens) {
        for (const entry of unit.terms) score += tokenSimilarity(queryToken, entry.term) * entry.weight;
      }
      return { ...unit, score: Number(score.toFixed(5)) };
    })
    .sort((a, b) => b.score - a.score || a.answerUnitId.localeCompare(b.answerUnitId))
    .slice(0, limit)
    .map(({ terms: _terms, ...unit }) => unit);
}

export function routeSourceDerivedQuery(query, adapter) {
  if (!adapter || adapter.schemaVersion !== SCHEMA_VERSION || adapter.adapterSha256 !== sha256(stableStringify(Object.fromEntries(Object.entries(adapter).filter(([key]) => key !== "adapterSha256"))))) {
    throw new Error("Adapter integrity verification failed.");
  }
  const normalizedQuery = normalizeTurkish(query);
  const queryTokens = tokenize(normalizedQuery);
  const intent = deriveIntent(normalizedQuery);
  const base = {
    schemaVersion: "dna.turkish-retrieval-v3-source-derived.route.v1",
    authorityClass: adapter.authorityClass,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    intent,
  };
  if (!normalizedQuery || HIGH_STAKES_PATTERNS.some((pattern) => pattern.test(normalizedQuery))) {
    return { ...base, action: "abstain", reason: normalizedQuery ? "high_stakes_out_of_scope" : "empty_query", topics: [], answerUnits: [] };
  }

  const ranked = adapter.topicProfiles
    .map((profile) => ({ profile, ...scoreProfile(queryTokens, normalizedQuery, profile) }))
    .sort((a, b) => b.score - a.score || a.profile.topicId.localeCompare(b.profile.topicId));
  const longestExplicitAlias = Math.max(0, ...ranked.map((entry) => entry.exactAliasTokenCount));
  const explicitTopics = ranked.filter((entry) => entry.exactAlias && entry.exactAliasTokenCount >= Math.max(2, longestExplicitAlias - 1) && entry.score >= adapter.thresholds.ambiguityScore);
  if (explicitTopics.length >= 2) {
    return {
      ...base,
      action: "clarify",
      reason: "multiple_supported_topics",
      topics: explicitTopics.slice(0, 3).map((entry) => ({ topicId: entry.profile.topicId, score: entry.score })),
      answerUnits: [],
    };
  }
  const [top, second] = ranked;
  if (top && second && !top.exactAlias && top.score >= adapter.thresholds.ambiguityScore && second.score >= adapter.thresholds.ambiguityScore && second.score / top.score >= adapter.thresholds.ambiguityRatio) {
    return {
      ...base,
      action: "clarify",
      reason: "semantically_ambiguous_topics",
      topics: [top, second].map((entry) => ({ topicId: entry.profile.topicId, score: entry.score })),
      answerUnits: [],
    };
  }
  if (!top || top.score < adapter.thresholds.retrievalScore || top.matchedTokenCount === 0) {
    const domainHint = queryTokens.some((token) => GENERIC_DOMAIN_TERMS.has(token) || GENERIC_DOMAIN_TERMS.has(stemToken(token)));
    return { ...base, action: domainHint ? "clarify" : "abstain", reason: domainHint ? "topic_required" : "unsupported_topic", topics: [], answerUnits: [] };
  }
  return {
    ...base,
    action: "retrieve",
    reason: top.profile.theoryBoundary ? "supported_theory_with_boundary" : "supported_source_derived_topic",
    topics: [{ topicId: top.profile.topicId, score: top.score }],
    answerUnits: rankAnswerUnits(queryTokens, top.profile, adapter.thresholds.answerUnitLimit),
    evidenceBoundary: top.profile.theoryBoundary ? "theory_not_established_fact" : "external_science_candidate_only",
  };
}

export function loadAdapter(path = `${DEFAULT_ARTIFACT_DIR}/frozen-source-derived-adapter.json`) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}
