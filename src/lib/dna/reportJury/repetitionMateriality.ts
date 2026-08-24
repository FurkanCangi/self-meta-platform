export type RepetitionMateriality = "NONE" | "QUALITY_ONLY_P2" | "MATERIAL_P1"

export type RepetitionMaterialityResult = Readonly<{
  repeatedSentenceRate: number
  repeatedPhraseCount: number
  maximumSentenceReuse: number
  materialRepetitionFailureCount: number
  repetitionMateriality: RepetitionMateriality
}>

const WATCHED_PHRASES = Object.freeze([
  "mevcut veri sınırları içinde",
  "görev ve bağlam talebi arttığında",
  "klinik yorum bu eksende yoğunlaşmaktadır",
  "diğer alanlardaki güçlükleri dışlamaz",
  "birincil öncelik klinik ağırlık sırasını gösterir",
  "kendi ölçüm kapsamları içinde",
  "yorumun günlük yaşamdaki kapsamını daraltmaktadır",
  "bu bilgi desteklemediği bir klinik alana bağlanmamıştır",
])

function countMatches(text: string, expression: RegExp): number {
  return text.match(expression)?.length ?? 0
}

export function classifyRepetitionMateriality(report: string): RepetitionMaterialityResult {
  const clinicalBody = report.split(/Kaynaklar \(APA 7\):/u)[0]
  const sentences = clinicalBody
    .replace(/^\d+\..+$/gmu, "")
    .split(/(?<=[.!?])\s+/u)
    .map((item) => item.trim())
    .filter((item) => item.split(/\s+/u).length >= 5)
  const normalizedSentences = sentences.map((item) => item.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim())
  const repeated = normalizedSentences.length - new Set(normalizedSentences).size
  const repeatedSentenceRate = normalizedSentences.length ? repeated / normalizedSentences.length : 0
  const repeatedPhraseCount = WATCHED_PHRASES.reduce((sum, phrase) => sum + Math.max(0, countMatches(report.toLocaleLowerCase("tr-TR"), new RegExp(phrase, "gu")) - 1), 0)
  const normalizedSentenceCounts = normalizedSentences.reduce((counts, sentence) => counts.set(sentence, (counts.get(sentence) ?? 0) + 1), new Map<string, number>())
  const maximumSentenceReuse = Math.max(0, ...normalizedSentenceCounts.values())
  const materialRepetitionFailureCount = Number(repeatedSentenceRate > 0.2 || repeatedPhraseCount >= 4)
  const repetitionMateriality: RepetitionMateriality = materialRepetitionFailureCount > 0
    ? "MATERIAL_P1"
    : repeatedSentenceRate > 0.08 || repeatedPhraseCount > 0
    ? "QUALITY_ONLY_P2"
    : "NONE"
  return Object.freeze({ repeatedSentenceRate, repeatedPhraseCount, maximumSentenceReuse, materialRepetitionFailureCount, repetitionMateriality })
}
