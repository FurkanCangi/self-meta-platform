function normalize(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

const CONNECTORS = new Set([
  "acisindan", "alaninda", "bir", "bu", "icin", "ile", "nasil", "ve",
])

function tokens(value) {
  return normalize(value).split(" ").filter((token) => token && !CONNECTORS.has(token))
}

function consonantFold(value) {
  return value.replace(/g/g, "k").replace(/b/g, "p").replace(/d/g, "t")
}

function tokenMatches(patternToken, questionToken) {
  if (patternToken === questionToken) return true
  if (patternToken.length < 4 || questionToken.length < 4) return false
  const pattern = consonantFold(patternToken)
  const question = consonantFold(questionToken)
  if (pattern === question) return true
  const shortest = Math.min(pattern.length, question.length)
  let shared = 0
  while (shared < shortest && pattern[shared] === question[shared]) shared += 1
  const required = Math.max(4, Math.ceil(shortest * 0.7))
  return shared >= required && Math.abs(pattern.length - question.length) <= 10
}

function phraseMatch(questionTokens, phrase) {
  const phraseTokens = tokens(phrase)
  if (phraseTokens.length === 0 || phraseTokens.length > questionTokens.length) return false
  for (let start = 0; start <= questionTokens.length - phraseTokens.length; start += 1) {
    let matched = true
    for (let offset = 0; offset < phraseTokens.length; offset += 1) {
      if (!tokenMatches(phraseTokens[offset], questionTokens[start + offset])) {
        matched = false
        break
      }
    }
    if (matched) return true
  }
  return false
}

function phraseStrength(phrase) {
  return 1 + Math.max(0, tokens(phrase).length - 1) * 0.2
}

function matchedStrength(questionTokens, phrases) {
  return phrases.reduce((total, phrase) =>
    total + (phraseMatch(questionTokens, phrase) ? phraseStrength(phrase) : 0), 0)
}

export function routeFrozenAdapter(adapter, question) {
  const questionTokens = tokens(question)
  const rankings = adapter.topics.map((topic) => {
    const positive = matchedStrength(questionTokens, topic.positivePhrases)
    const context = matchedStrength(questionTokens, topic.contextPhrases)
    const negative = matchedStrength(questionTokens, topic.negativePhrases)
    const score = positive === 0 ? 0
      : positive * adapter.thresholds.positivePhraseWeight
        + context * adapter.thresholds.contextPhraseWeight
        - negative * adapter.thresholds.negativePhrasePenalty
    return { topicId: topic.topicId, score: Number(score.toFixed(6)) }
  }).sort((left, right) =>
    right.score - left.score || left.topicId.localeCompare(right.topicId, "en"))
  const top = rankings[0]
  const second = rankings[1]
  const margin = Number((top.score - second.score).toFixed(6))
  if (top.score < adapter.thresholds.answerMinimum) {
    return { decision: "abstain", topicId: null }
  }
  if (margin < adapter.thresholds.marginMinimum) {
    return { decision: "clarify", topicId: null }
  }
  return { decision: "answer", topicId: top.topicId }
}
