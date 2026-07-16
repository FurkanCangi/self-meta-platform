import { DNA_CHAT_CATALOG_CLAIMS } from "./claims"
import { DNA_CHAT_CATALOG_RELATIONS } from "./relations"
import { DNA_CHAT_CATALOG_SOURCE_BY_ID } from "./sources"
import {
  DNA_CHAT_CATALOG_TOPIC_BY_ID,
  DNA_CHAT_CATALOG_TOPICS,
} from "./topics"
import type {
  DnaChatCatalogClaim,
  DnaChatCatalogRelation,
  DnaChatCatalogSource,
  DnaChatCatalogTopic,
  DnaChatQueryKind,
} from "./types"

function normalizeCatalogText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function stripCatalogInstructionPrefix(value: string): string {
  return value.replace(
    /^(?:Kısaca yanıtla|Terapist diliyle açıkla|Bilimsel sınırlarıyla anlat|Biraz daha açık söyler misin|Kaynaklı biçimde yanıtla)\s*:\s*/i,
    "",
  )
}

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(normalizeCatalogText(needle)))
}

const TOPIC_SEARCH_INDEX = new Map(
  DNA_CHAT_CATALOG_TOPICS.map((topic) => {
    const title = normalizeCatalogText(topic.title)
    return [
      topic.id,
      {
        title,
        aliases: [...new Set(topic.aliases.map(normalizeCatalogText).filter(
          (alias) => Boolean(alias) && alias !== title,
        ))],
        keywords: [...new Set(topic.keywords.map(normalizeCatalogText).filter(Boolean))],
      },
    ] as const
  }),
)

export function classifyCatalogQueryKind(question: string): DnaChatQueryKind {
  const strippedQuestion = stripCatalogInstructionPrefix(question)
  const normalized = normalizeCatalogText(strippedQuestion)

  // A generic mention of a child, profile or session is not enough to open a
  // private report. Case routing is reserved for explicit report/vaka deixis;
  // clinical safety gates run before this classifier in the engine.
  const hasCase = /\b(?:son rapor\w*|raporum\w*|rapordaki|bu rapor\w*|secili rapor\w*|son degerlendirme\w*|bu vaka\w*|vakadaki|vaka raporu\w*|vaka skor\w*)\b/.test(
    normalized,
  )
  const hasTheory = containsAny(normalized, [
    "teori",
    "literatür",
    "neden",
    "ilişki",
    "mekanizma",
    "hrv",
    "insula",
    "otonom",
    "sempatik",
    "parasempatik",
    "vagal",
    "polivagal",
    "beyin",
    "cns",
    "self regülasyon",
  ])

  if (hasCase && hasTheory) return "case_theory"
  if (hasCase) return "case_finding"

  // Comparison cues are intentionally evaluated before DNA/evidence cues.
  // This keeps questions such as "DNA alanı X ile aynı yapı mı?" as an
  // explicit comparison rather than turning every DNA mention into one kind.
  if (
    /\b(?:fark\w*|ayni (?:sey|terim|kavram|yapi)|ayni mi|karsilastir\w*|karsit\w*|birbirine ters|nasil ayril\w*|anlamina gelir mi)\b/.test(normalized) ||
    /\bdemek\b.+\bdemek mi\b/.test(normalized) ||
    /\byalniz\b.+\b(?:midir|mudur)\b/.test(normalized)
  ) {
    return "comparison"
  }

  const hasExplicitEvidenceCue = /\b(?:kanit\w*|bilimsel|guvenilir\w*|biyobelirtec\w*|nedensel\w*|nedensellik|ongor\w*|tahmin\w*|kalici|aktaril\w*|tartismali|yerlesik|dogrulan\w*|taniyabilir|yeterli|kisilik ozelligi|dikkatle kullan\w*|tek basina|tek bir|kesin bag|her zaman|hep|riskli\w*|iyi midir|kotu mu|sorun mudur)\b/.test(
    normalized,
  ) ||
    /\bnormal\b.+\baralik\w*\b/.test(normalized) ||
    /\b(?:rsa|hrv|eda)\b.+\bdogrudan\b/.test(normalized) ||
    /\b(?:dusukse|yuksekse)\b.+\b(?:dusuk|yuksek|kaygi|kotu|iyi)\b/.test(normalized) ||
    /\b(?:dusuk hrv|dusus\w* hrv)\b.+\bcikar\w*\b/.test(normalized) ||
    /\bgorev\w*\b.+\bayni\b.+\byanit\w*\b/.test(normalized) ||
    /\beda\b.+\bkaygi\b/.test(normalized) ||
    /\bakilli saat\b/.test(normalized)

  // "DNA" is a product-contract cue. Only an explicit evidence question
  // outranks it; comparisons were already handled above.
  if (/\bdna\b/.test(normalized)) {
    if (/\b(?:kanit\w*|bilimsel temel|dogrulan\w*|gecerli\w*)\b/.test(normalized)) {
      return "evidence"
    }
    return "dna_relation"
  }

  // These phrases ask about co-activation/covariation, not whether a single
  // proposition is a misconception.
  if (/\b(?:ayni anda|ayni yonde)\b/.test(normalized)) {
    return "relation"
  }

  // When a paediatric measurement question explicitly asks for its limits,
  // the age/developmental scope is the governing intent.
  if (/\bcocuk\w*\b.+\b(?:sinir\w*|yas kapsam\w*)\b/.test(normalized)) {
    return "development"
  }

  // Measurement actions and named physiological metrics are stronger than a
  // broad age word. Reliability/validity questions remain evidence questions.
  if (
    !hasExplicitEvidenceCue &&
    (/\b(?:nasil olcul\w*|neyi olcer|ne olcer|sensor\w*|test bataryasi|hangi islevler degerlendirilir|neyi ifade eder|olcum\w* neden zor\w*|hangi olcum\w* gosterir)\b/.test(normalized) ||
      /\b(?:pep|rmssd|hf hrv|lf hrv|lf hf|pupillometri)\b/.test(normalized))
  ) {
    return "measurement"
  }

  const hasDevelopmentCue = /\b(?:erken cocukluk|uc yas|okul cagi\w*|okul oncesi|ergen\w*|yenidogan\w*|bebek\w*|infant\w*|puberte|prematur\w*|dogumda|hangi yas\w*|kac yas\w*|yas ilerledikce|olgunlas\w*|yetiskin\w*.+cocuk\w*|cocuk\w*.+yetiskin\w*)\b/.test(
    normalized,
  )
  const hasDominantDevelopmentCue = /\b(?:yas ilerledikce|tek normal deger|cocuk\w*.+sinir\w*)\b/.test(normalized)
  if (hasDevelopmentCue && (!hasExplicitEvidenceCue || hasDominantDevelopmentCue)) {
    return "development"
  }

  if (hasExplicitEvidenceCue) {
    return "evidence"
  }

  if (containsAny(normalized, ["ilişk", "ilisk", "bağ", "bag", "etkiler", "etkileyebilir", "katkı", "katki", "bağlantı", "baglanti"])) {
    return "relation"
  }

  if (containsAny(normalized, ["çocuk", "cocuk", "yaşa göre", "yasa gore", "geliş", "gelis", "ergen"])) {
    return "development"
  }

  if (containsAny(normalized, [
    "nedir",
    "nelerdir",
    "ne demek",
    "ne anlama",
    "ne kastediliyor",
    "ne işe yarar",
    "ne ise yarar",
    "ne ise yari",
    "neyi gösterir",
    "neyi gosterir",
    "tanımla",
    "tanimla",
    "açıkla",
    "acikla",
    "nasıl çalışır",
    "nasil calisir",
    "içinde midir",
    "icinde midir",
    "mi oluyor",
    "ne yani",
  ])) {
    return "definition"
  }

  if (containsAny(normalized, ["aynı mı", "ayni mi", "aynı mıdır", "ayni midir"])) {
    return "comparison"
  }
  if (containsAny(normalized, [
    "kesin belirler",
    "tek bir öz düzenleme merkezi",
    "tek bir oz duzenleme merkezi",
    "alarm düğmesi",
    "alarm dugmesi",
    "lf hf oranı",
    "lf hf orani",
    "eda belirli bir duyguyu",
    "tek bir giyilebilir sensör",
    "tek bir giyilebilir sensor",
  ])) {
    return "misconception"
  }
  return "unknown"
}

function termIndex(normalizedQuestion: string, normalizedTerm: string): number {
  if (normalizedTerm.length <= 3) {
    const paddedIndex = ` ${normalizedQuestion} `.indexOf(` ${normalizedTerm} `)
    return paddedIndex < 0 ? -1 : Math.max(0, paddedIndex - 1)
  }
  return normalizedQuestion.indexOf(normalizedTerm)
}

function scoreTopic(
  normalizedQuestion: string,
  topic: DnaChatCatalogTopic,
): { score: number; firstIndex: number } {
  const index = TOPIC_SEARCH_INDEX.get(topic.id)
  if (!index) return { score: 0, firstIndex: -1 }
  const { title } = index
  const questionTokens = new Set(normalizedQuestion.split(" ").filter(Boolean))
  const titleIndex = termIndex(normalizedQuestion, title)
  let firstIndex = titleIndex
  let score = normalizedQuestion === title ? 50 : titleIndex >= 0 ? 18 : 0
  if (titleIndex === 0) score += 6
  let bestAliasScore = 0

  for (const normalizedAlias of index.aliases) {
    if (!normalizedAlias) continue
    const aliasIndex = termIndex(normalizedQuestion, normalizedAlias)
    if (aliasIndex >= 0 && (firstIndex < 0 || aliasIndex < firstIndex)) firstIndex = aliasIndex
    if (normalizedQuestion === normalizedAlias) bestAliasScore = Math.max(bestAliasScore, 50)
    else if (normalizedAlias.length <= 3 && questionTokens.has(normalizedAlias)) {
      bestAliasScore = Math.max(bestAliasScore, 9)
    }
    else if (normalizedAlias.length > 3 && aliasIndex >= 0) {
      const aliasWordCount = normalizedAlias.split(" ").length
      bestAliasScore = Math.max(
        bestAliasScore,
        aliasWordCount >= 3 ? 36 : normalizedAlias.includes(" ") ? 14 : 8,
      )
    }
  }
  score = Math.max(score, bestAliasScore)

  let keywordScore = 0
  for (const normalizedKeyword of index.keywords) {
    if (normalizedKeyword && normalizedQuestion.includes(normalizedKeyword)) {
      keywordScore += normalizedKeyword.includes(" ") ? 4 : 2
    }
  }
  score += Math.min(keywordScore, 8)

  return { score, firstIndex }
}

export function findCatalogTopic(
  question: string,
  previousTopic?: string | null,
): DnaChatCatalogTopic | null {
  const normalized = normalizeCatalogText(stripCatalogInstructionPrefix(question))
  if (!normalized) return null

  const scored = DNA_CHAT_CATALOG_TOPICS
    .map((topic) => ({ topic, ...scoreTopic(normalized, topic) }))
  const firstMention = Math.min(
    ...scored.filter((entry) => entry.firstIndex >= 0).map((entry) => entry.firstIndex),
  )
  const ranked = scored
    .map((entry) => ({
      ...entry,
      score: entry.score + (entry.firstIndex >= 0 && entry.firstIndex === firstMention ? 10 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.topic.id.localeCompare(b.topic.id))

  if ((ranked[0]?.score ?? 0) >= 5) return ranked[0].topic

  if (
    previousTopic &&
    containsAny(normalized, ["bu", "bunun", "peki", "biraz daha", "ilişkisi", "iliskisi"])
  ) {
    const byId = DNA_CHAT_CATALOG_TOPIC_BY_ID.get(previousTopic)
    if (byId) return byId

    const normalizedPreviousTopic = normalizeCatalogText(previousTopic)
    return DNA_CHAT_CATALOG_TOPICS.find((topic) =>
      normalizeCatalogText(topic.id) === normalizedPreviousTopic ||
      normalizeCatalogText(topic.title) === normalizedPreviousTopic ||
      topic.aliases.some((alias) => normalizeCatalogText(alias) === normalizedPreviousTopic)
    ) ?? null
  }

  return null
}

export function getCatalogTopicById(id: string): DnaChatCatalogTopic | null {
  return DNA_CHAT_CATALOG_TOPIC_BY_ID.get(id) ?? null
}

export function getClaimsForTopic(topicId: string): readonly DnaChatCatalogClaim[] {
  return DNA_CHAT_CATALOG_CLAIMS.filter((claim) => claim.topicId === topicId)
}

export function getSourcesForClaim(claimId: string): readonly DnaChatCatalogSource[] {
  const claim = DNA_CHAT_CATALOG_CLAIMS.find((entry) => entry.id === claimId)
  if (!claim) return []
  return claim.sourceIds.flatMap((sourceId) => {
    const source = DNA_CHAT_CATALOG_SOURCE_BY_ID.get(sourceId)
    return source ? [source] : []
  })
}

export function getRelationsForTopic(topicId: string): readonly DnaChatCatalogRelation[] {
  return DNA_CHAT_CATALOG_RELATIONS.filter(
    (relation) => relation.fromTopicId === topicId || relation.toTopicId === topicId,
  )
}

export { normalizeCatalogText }
