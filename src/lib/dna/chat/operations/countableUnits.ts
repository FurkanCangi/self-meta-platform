export const DNA_COUNTABLE_UNITS_VERSION = "dna-countable-units@1" as const

export const DNA_COUNTABLE_UNIT_DEFINITIONS = Object.freeze({
  uniqueSource: "Kimliği tekilleştirilmiş benzersiz kaynak kaydıdır.",
  verifiedPassage: "Kaynak artefaktındaki locator ile doğrulanmış, hash-bağlı pasajdır.",
  atomicClaim: "Tek bir sınırlandırılmış önermeyi taşıyan, en az bir doğrulanmış pasaja bağlı iddiadır.",
  explicitRelation: "Açıkça kayıtlı, dayanak iddiaları bulunan tek-adımlı ilişkidir.",
  topic: "Yönlendirme ve cevap derleme için kullanılan kanonik konu düğümüdür.",
  safetyRule: "Sürümlü ve test edilen ürün veya klinik güvenlik kuralıdır.",
  benchmarkQuestion: "Başarı ölçümünde paydası ve beklenen sonucu sabit değerlendirme sorusudur.",
  testVariation: "Bir temel sorunun sağlamlık dönüşümüdür; bağımsız bilgi birimi değildir.",
} as const)

export type DnaCountableUnitInventory = Readonly<{
  schemaVersion: typeof DNA_COUNTABLE_UNITS_VERSION
  uniqueSources: number
  verifiedPassages: number
  atomicClaims: number
  explicitRelations: number
  topics: number
  safetyRules: number
  benchmarkQuestions: number
  testVariations: number
  knowledgeUnitCount: number
  testVariationCountedAsKnowledge: false
}>

export function buildDnaCountableUnitInventory(input: Omit<
  DnaCountableUnitInventory,
  "schemaVersion" | "knowledgeUnitCount" | "testVariationCountedAsKnowledge"
>): DnaCountableUnitInventory {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`dna_countable_unit_invalid:${key}`)
    }
  }
  return Object.freeze({
    schemaVersion: DNA_COUNTABLE_UNITS_VERSION,
    ...input,
    // Passage-backed atomic claims are the advertised information-unit count.
    // Tests, sources, topics and relations remain separate denominators.
    knowledgeUnitCount: input.atomicClaims,
    testVariationCountedAsKnowledge: false,
  })
}

export const DNA_LONG_TERM_TARGET_ENVELOPE = Object.freeze({
  uniqueSources: Object.freeze({ min: 250, max: 400 }),
  passageBackedAtomicClaims: Object.freeze({ min: 8_000, max: 15_000 }),
  mainDomains: 10,
  lockedBenchmarkQuestions: 2_400,
  robustnessTransformations: 10_000,
  status: "target_not_current_inventory" as const,
})
