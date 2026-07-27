const TURKISH_SUFFIXES = [
  "larindan", "lerinden", "larinda", "lerinde", "lariyla", "leriyle",
  "larinin", "lerinin", "larina", "lerine", "lardan", "lerden",
  "larin", "lerin", "daki", "deki", "taki", "teki", "sinin", "sunun",
  "unun", "inin", "lar", "ler", "lik", "lik", "luk", "luk", "sel",
  "sal", "dan", "den", "tan", "ten", "dir", "dir", "dur", "dur",
  "nin", "nun", "in", "un", "na", "ne", "da", "de", "ta", "te",
  "yi", "yu", "i", "u",
]

function round(value) {
  return Math.round(value * 1e6) / 1e6
}

export function normalizeTurkishQuestion(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function stemToken(token) {
  if (token.length < 5) return token
  for (const suffix of TURKISH_SUFFIXES) {
    if (token.length - suffix.length >= 4 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length)
    }
  }
  return token
}

export function tokenizeTurkishQuestion(value) {
  const normalized = normalizeTurkishQuestion(value)
  if (!normalized) return []
  return [...new Set(normalized.split(" ").filter(Boolean).map(stemToken))]
}

function editDistanceAtMostOne(left, right) {
  if (left === right) return true
  if (Math.abs(left.length - right.length) > 1) return false
  if (left.length === right.length) {
    const mismatches = []
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) mismatches.push(index)
    }
    if (mismatches.length === 1) return true
    return mismatches.length === 2
      && mismatches[1] === mismatches[0] + 1
      && left[mismatches[0]] === right[mismatches[1]]
      && left[mismatches[1]] === right[mismatches[0]]
  }
  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left
  let shortIndex = 0
  let longIndex = 0
  let skipped = false
  while (shortIndex < shorter.length && longIndex < longer.length) {
    if (shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1
      longIndex += 1
    } else if (!skipped) {
      skipped = true
      longIndex += 1
    } else return false
  }
  return true
}

function tokenMatch(queryToken, profileToken, adapter) {
  if (queryToken === profileToken) return adapter.scoring.exactTokenFactor
  if (queryToken.length < adapter.normalization.minimumFuzzyTokenLength
    || profileToken.length < adapter.normalization.minimumFuzzyTokenLength) return 0
  return editDistanceAtMostOne(queryToken, profileToken)
    ? adapter.scoring.fuzzyTokenFactor
    : 0
}

function bestTokenFactor(queryTokens, profileToken, adapter) {
  let best = 0
  for (const queryToken of queryTokens) {
    const factor = tokenMatch(queryToken, profileToken, adapter)
    if (factor > best) best = factor
  }
  return best
}

function setCoverage(queryTokens, tokenSet, adapter) {
  if (!tokenSet.length) return { coverage: 0, matched: 0 }
  let matched = 0
  for (const token of tokenSet) {
    if (bestTokenFactor(queryTokens, token, adapter) > 0) matched += 1
  }
  return { coverage: matched / tokenSet.length, matched }
}

function scoreTopic(queryTokens, topic, adapter) {
  let tokenScore = 0
  let rareMatches = 0
  let contextMatches = 0
  for (const [token, weight] of Object.entries(topic.tokenWeights)) {
    const factor = bestTokenFactor(queryTokens, token, adapter)
    if (!factor) continue
    tokenScore += weight * factor
    if (weight >= topic.rareWeightFloor) rareMatches += 1
  }
  for (const token of topic.contextTokens) {
    if (bestTokenFactor(queryTokens, token, adapter) > 0) contextMatches += 1
  }
  let bestAnchorCoverage = 0
  let bestAnchorMatched = 0
  for (const anchorTokens of topic.anchorTokenSets) {
    const anchor = setCoverage(queryTokens, anchorTokens, adapter)
    if (anchor.coverage > bestAnchorCoverage
      || (anchor.coverage === bestAnchorCoverage && anchor.matched > bestAnchorMatched)) {
      bestAnchorCoverage = anchor.coverage
      bestAnchorMatched = anchor.matched
    }
  }
  let bestTrainingCoverage = 0
  for (const trainingTokens of topic.trainingTokenSets) {
    const training = setCoverage(queryTokens, trainingTokens, adapter)
    if (training.coverage > bestTrainingCoverage) bestTrainingCoverage = training.coverage
  }
  let negativePenalty = 0
  for (const [token, weight] of Object.entries(topic.negativeTokenWeights)) {
    const factor = bestTokenFactor(queryTokens, token, adapter)
    if (factor) negativePenalty += weight * factor
  }
  const anchorBonus = bestAnchorCoverage >= 0.5
    ? adapter.scoring.anchorContextBonus * bestAnchorCoverage
      * (contextMatches > 0 ? 1.25 : 1)
    : 0
  const rarityBonus = Math.min(rareMatches, 3) * adapter.scoring.rareTokenBonus
  const trainingBonus = bestTrainingCoverage >= 0.75
    ? adapter.scoring.trainingCoverageBonus * bestTrainingCoverage
    : 0
  const score = Math.max(0,
    tokenScore + anchorBonus + rarityBonus + trainingBonus - negativePenalty)
  return {
    topicId: topic.id,
    score: round(score),
    bestAnchorCoverage: round(bestAnchorCoverage),
    bestAnchorMatched,
    bestTrainingCoverage: round(bestTrainingCoverage),
    contextMatches,
    rareMatches,
    negativePenalty: round(negativePenalty),
  }
}

function unsupportedPenalty(queryTokens, adapter) {
  let tokenPenalty = 0
  for (const [token, weight] of Object.entries(adapter.unsupportedTokenWeights)) {
    const factor = bestTokenFactor(queryTokens, token, adapter)
    if (factor) tokenPenalty += weight * factor
  }
  let setPenalty = 0
  for (const tokenSet of adapter.unsupportedTokenSets) {
    const coverage = setCoverage(queryTokens, tokenSet, adapter)
    if (coverage.matched >= 1 && coverage.coverage >= 0.5) {
      setPenalty = Math.max(setPenalty, adapter.scoring.unsupportedPenaltyThreshold)
    }
  }
  return round(Math.max(tokenPenalty, setPenalty))
}

export function evaluateTurkishRetrievalV2(question, adapter) {
  const queryTokens = tokenizeTurkishQuestion(question)
  if (!queryTokens.length) {
    return {
      decision: "abstain",
      topicId: null,
      topScore: 0,
      secondScore: 0,
      margin: 0,
      unsupportedPenalty: 0,
      reason: "empty_or_unusable_question",
    }
  }
  const ranking = adapter.topics.map((topic) => scoreTopic(queryTokens, topic, adapter))
    .sort((left, right) => right.score - left.score || left.topicId.localeCompare(right.topicId, "en"))
  const top = ranking[0]
  const second = ranking[1]
  const margin = round(top.score - second.score)
  const unsupported = unsupportedPenalty(queryTokens, adapter)
  let bestAmbiguityPatternCoverage = 0
  for (const tokenSet of adapter.ambiguousTokenSets) {
    const pattern = setCoverage(queryTokens, tokenSet, adapter)
    if (pattern.coverage > bestAmbiguityPatternCoverage) {
      bestAmbiguityPatternCoverage = pattern.coverage
    }
  }
  const normalizedQuestion = normalizeTurkishQuestion(question)
  const explicitAmbiguityCue = /\bmi yoksa\b|hangisini|birlikte yaz|ayrim yapmadan|netlestir|\/\s*/
    .test(normalizedQuestion)
  const strongAnchorTopics = ranking.filter((entry) =>
    entry.bestAnchorCoverage >= 0.75 && entry.bestAnchorMatched >= 1)
  const unsupportedRatio = unsupported / Math.max(top.score, 0.001)
  const unsupportedDominates = unsupportedRatio >= adapter.scoring.unsupportedDominanceRatio
    || (unsupportedRatio >= adapter.scoring.unsupportedWeakAnchorRatio
      && top.bestAnchorCoverage < 0.75)
  const exactTrainingDisambiguation = top.bestTrainingCoverage === 1
    && second.bestTrainingCoverage < 1
  const exactAmbiguityPattern = bestAmbiguityPatternCoverage === 1
    && top.bestTrainingCoverage < 1
    && top.bestAnchorCoverage < 0.75
  const learnedAmbiguityPattern = bestAmbiguityPatternCoverage
      >= adapter.scoring.ambiguityPatternCoverage
    && top.score >= adapter.scoring.minimumClarifyScore
    && top.bestAnchorCoverage < 0.75
    && margin < 6
  const explicitDualTopicAmbiguity = explicitAmbiguityCue
    && second.score >= adapter.scoring.minimumClarifyScore
  const scoreAmbiguity = !exactTrainingDisambiguation
    && (top.score < adapter.scoring.minimumRouteScore
      || margin < adapter.scoring.ambiguityMargin
      || (strongAnchorTopics.length >= 2 && margin < adapter.scoring.dualAnchorMargin))
  const shouldClarify = exactAmbiguityPattern || learnedAmbiguityPattern
    || explicitDualTopicAmbiguity || scoreAmbiguity
  let decision = "route"
  let topicId = top.topicId
  let reason = "route_supported_topic"
  if (unsupported >= adapter.scoring.unsupportedPenaltyThreshold
    && unsupportedDominates) {
    decision = "abstain"
    topicId = null
    reason = "unsupported_development_pattern"
  } else if (top.score < adapter.scoring.minimumClarifyScore) {
    decision = "abstain"
    topicId = null
    reason = "insufficient_supported_evidence"
  } else if (shouldClarify) {
    decision = "clarify"
    topicId = null
    reason = "ambiguous_supported_topics"
  }
  return {
    decision,
    topicId,
    topScore: top.score,
    secondScore: second.score,
    margin,
    unsupportedPenalty: unsupported,
    bestAmbiguityPatternCoverage: round(bestAmbiguityPatternCoverage),
    reason,
    ranking: ranking.slice(0, 3),
  }
}
