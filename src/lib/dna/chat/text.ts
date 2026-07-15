export type DnaTextMatch = {
  score: number
  method: "exact" | "phrase" | "weighted" | "none"
  tokenScore: number
  ngramScore: number
  pattern: string | null
}

const STOP_TOKENS = new Set([
  "acaba",
  "ama",
  "bana",
  "bir",
  "bu",
  "cocuk",
  "cocugun",
  "da",
  "de",
  "dna",
  "gibi",
  "hakkinda",
  "hangi",
  "ile",
  "icin",
  "kadar",
  "mi",
  "mu",
  "mı",
  "mü",
  "nasil",
  "ne",
  "nedir",
  "olarak",
  "olan",
  "peki",
  "sence",
  "ve",
  "veya",
  "vaka",
])

const TURKISH_SUFFIXES = [
  "larinizdan",
  "lerinizden",
  "larindan",
  "lerinden",
  "larinin",
  "lerinin",
  "larinda",
  "lerinde",
  "larina",
  "lerine",
  "lardan",
  "lerden",
  "siniz",
  "sunuz",
  "iyorlar",
  "uyorlar",
  "digini",
  "ligini",
  "iyor",
  "uyor",
  "mis",
  "mus",
  "lar",
  "ler",
  "inda",
  "inde",
  "undan",
  "inden",
  "dan",
  "den",
  "nin",
  "nun",
  "sini",
  "lari",
  "leri",
  "yi",
  "yu",
] as const

export function normalizeDnaChatText(value: string): string {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenRoot(token: string): string {
  for (const suffix of TURKISH_SUFFIXES) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 4) {
      return token.slice(0, -suffix.length)
    }
  }
  return token
}

export function tokenizeDnaChatText(value: string): string[] {
  return normalizeDnaChatText(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !STOP_TOKENS.has(token))
    .map(tokenRoot)
}

function tokenWeight(token: string): number {
  if (/^\d+$/.test(token)) return 1.7
  if (token.length >= 10) return 2
  if (token.length >= 7) return 1.65
  if (token.length >= 5) return 1.35
  return 1
}

function oneEditApart(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false
  let leftIndex = 0
  let rightIndex = 0
  let edits = 0
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1
      rightIndex += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (left.length > right.length) leftIndex += 1
    else if (right.length > left.length) rightIndex += 1
    else {
      leftIndex += 1
      rightIndex += 1
    }
  }
  return edits + Number(leftIndex < left.length || rightIndex < right.length) <= 1
}

function tokensEquivalent(left: string, right: string): boolean {
  if (left === right) return true
  const shortest = Math.min(left.length, right.length)
  if (shortest >= 5 && (left.startsWith(right) || right.startsWith(left))) return true
  return shortest >= 6 && oneEditApart(left, right)
}

export function weightedTokenSimilarity(question: string, pattern: string): number {
  const questionTokens = tokenizeDnaChatText(question)
  const patternTokens = tokenizeDnaChatText(pattern)
  if (!questionTokens.length || !patternTokens.length) return 0

  let matchedPatternWeight = 0
  let totalPatternWeight = 0
  for (const patternToken of patternTokens) {
    const weight = tokenWeight(patternToken)
    totalPatternWeight += weight
    if (questionTokens.some((questionToken) => tokensEquivalent(patternToken, questionToken))) {
      matchedPatternWeight += weight
    }
  }

  let matchedQuestionWeight = 0
  let totalQuestionWeight = 0
  for (const questionToken of questionTokens) {
    const weight = tokenWeight(questionToken)
    totalQuestionWeight += weight
    if (patternTokens.some((patternToken) => tokensEquivalent(patternToken, questionToken))) {
      matchedQuestionWeight += weight
    }
  }

  const recall = totalPatternWeight ? matchedPatternWeight / totalPatternWeight : 0
  const precision = totalQuestionWeight ? matchedQuestionWeight / totalQuestionWeight : 0
  return Number((recall * 0.72 + precision * 0.28).toFixed(6))
}

export function dnaCharacterNgrams(value: string, min = 3, max = 5): Set<string> {
  const normalized = `^${normalizeDnaChatText(value).replace(/\s/g, "_")}$`
  const grams = new Set<string>()
  for (let size = min; size <= max; size += 1) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      grams.add(`${size}:${normalized.slice(index, index + size)}`)
    }
  }
  return grams
}

export function ngramDiceSimilarity(question: string, pattern: string): number {
  const left = dnaCharacterNgrams(question)
  const right = dnaCharacterNgrams(pattern)
  if (!left.size || !right.size) return 0
  let intersection = 0
  for (const gram of left) if (right.has(gram)) intersection += 1
  return Number(((2 * intersection) / (left.size + right.size)).toFixed(6))
}

export function scoreDnaTextMatch(question: string, patterns: readonly string[]): DnaTextMatch {
  const normalizedQuestion = normalizeDnaChatText(question)
  let best: DnaTextMatch = {
    score: 0,
    method: "none",
    tokenScore: 0,
    ngramScore: 0,
    pattern: null,
  }

  for (const pattern of patterns) {
    const normalizedPattern = normalizeDnaChatText(pattern)
    if (!normalizedPattern) continue
    if (normalizedQuestion === normalizedPattern) {
      return { score: 1, method: "exact", tokenScore: 1, ngramScore: 1, pattern }
    }
    if (
      normalizedPattern.length >= 5 &&
      ` ${normalizedQuestion} `.includes(` ${normalizedPattern} `)
    ) {
      const candidate = {
        score: 0.96,
        method: "phrase" as const,
        tokenScore: 1,
        ngramScore: ngramDiceSimilarity(normalizedQuestion, normalizedPattern),
        pattern,
      }
      if (candidate.score > best.score) best = candidate
      continue
    }
    const tokenScore = weightedTokenSimilarity(normalizedQuestion, normalizedPattern)
    const ngramScore = ngramDiceSimilarity(normalizedQuestion, normalizedPattern)
    const score = Number((tokenScore * 0.7 + ngramScore * 0.3).toFixed(6))
    if (score > best.score) {
      best = { score, method: score > 0 ? "weighted" : "none", tokenScore, ngramScore, pattern }
    }
  }
  return best
}

export function stableUnique(values: readonly string[], limit = Number.POSITIVE_INFINITY): string[] {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, limit)
}
