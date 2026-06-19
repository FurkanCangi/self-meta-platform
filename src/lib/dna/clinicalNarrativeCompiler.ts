import type { ClinicalEvidenceMap, ClinicalMechanismType } from "./clinicalAnalysis"
import type { DifferentialFormulation } from "./clinicalDifferentialFormulation"

export type CompiledClinicalNarrative = {
  decisionSentence: string
  formulationSentence: string
  conclusionSentence: string
  differential?: DifferentialFormulation | null
  ruleIds: string[]
}

type MechanismNarrativeParts = {
  mechanism: string
  context: string
  spread: string
  limit: string
}

const MECHANISM_PARTS: Record<ClinicalMechanismType | "balanced", MechanismNarrativeParts> = {
  motor_praxis: {
    mechanism: "motor planlama ve beden organizasyonu gerektiren durumlarda belirginleşen self-regülasyon zorluğu",
    context: "yeni veya çok basamaklı motor görevlerde",
    spread: "yürütücü organizasyon, görev sürdürme ve duygusal toparlanma süreçlerine yayılır",
    limit: "yapılandırılmış bağlamdaki korunmuş kapasite varsa genellenmiş bir kapasite düşüklüğü gibi okunmaz",
  },
  adaptive_daily_living: {
    mechanism: "öz bakım ve günlük yaşam akışını başlatma-sürdürme süreçlerinde belirginleşen self-regülasyon zorluğu",
    context: "rutin, sıra ve sorumluluk talebi arttığında",
    spread: "yürütücü organizasyon, beden farkındalığı ve duygusal toparlanmaya yayılır",
    limit: "korunmuş test veya gözlem verisi varsa yorum doğal ortam bağlamıyla sınırlı tutulur",
  },
  social_pragmatic: {
    mechanism: "sosyal karşılıklılık ve pragmatik esneklik taleplerinde belirginleşen self-regülasyon zorluğu",
    context: "sosyal talep, grup akışı veya bağlama uyum beklentisi arttığında",
    spread: "bilişsel düzenleme, duygusal toparlanma ve davranış ayarlama süreçlerine yansır",
    limit: "bire bir iş birliği korunuyorsa genellenmiş sosyal kapasite düşüklüğü gibi genişletilmez",
  },
  language_communication: {
    mechanism: "sözel talep ve yönerge karmaşıklığı arttığında belirginleşen self-regülasyon zorluğu",
    context: "anlama, zihinde tutma ve çok adımlı görev talebi arttığında",
    spread: "bilgiyi işleme, görevde kalma ve frustrasyon toleransına yansır",
    limit: "yorum genel öğrenme kapasitesi hükmüne genişletilmez",
  },
  language_social_pragmatic: {
    mechanism: "dilsel talep ile sosyal-pragmatik beklentinin birlikte zorladığı self-regülasyon zorluğu",
    context: "anlama, karşılıklılığı sürdürme ve bağlama uyum aynı anda beklendiğinde",
    spread: "bilişsel organizasyon, etkileşim sürekliliği ve duygusal toparlanmaya yayılır",
    limit: "dilsel ya da sosyal tek başlıkla daraltılmadan bağlam içinde yorumlanır",
  },
  physiological_interoceptive: {
    mechanism: "bedensel toparlanma ve içsel sinyalleri düzenlemeye katma süreçlerinde belirginleşen self-regülasyon zorluğu",
    context: "yorgunluk, beden sinyali veya toparlanma talebi arttığında",
    spread: "dikkat, günlük işlev akışı ve duygusal toparlanmaya yayılır",
    limit: "medikal nedensellik ya da tek kaynaklı açıklama üretmeden yorumlanır",
  },
  selective_interoception: {
    mechanism: "içsel bedensel sinyal farkındalığında seçici self-regülasyon zorluğu",
    context: "bedensel ihtiyaçların düzenleme sürecine zamanında katılması gerektiğinde",
    spread: "toparlanma, günlük ritim ve işlevsel dalgalanmaya seçici biçimde yansır",
    limit: "yaygın bir düzenleme yetersizliği gibi genişletilmez",
  },
  evidence_limited_mixed: {
    mechanism: "kanıt sınırlı ve bağlama duyarlı self-regülasyon dalgalanması",
    context: "dış test, anamnez ve gözlem aynı yönde güçlü biçimde yakınsamadığında",
    spread: "yürütücü organizasyon, bilişsel düzenleme ve duygusal toparlanma alanlarında değişken görünür",
    limit: "dış test kanıtı ana kararı tek başına büyütmez",
  },
  default: {
    mechanism: "birincil klinik eksende toplanan self-regülasyon zorluğu",
    context: "görev ve bağlam talebi arttığında",
    spread: "yakın düzenleyici alanlara işlevsel olarak yansır",
    limit: "tek puan ya da tek veri kaynağı üzerinden genişletilmez",
  },
  balanced: {
    mechanism: "korunmuş ve dengeli düzenleme zemini",
    context: "bağlamsal hassasiyetler görünse bile",
    spread: "günlük işlevde geniş bir risk iddiasına dönüşmez",
    limit: "yorum korunmuş kapasite sınırında kalır",
  },
}

const MECHANISM_CONTEXT_TAGS: Record<ClinicalMechanismType | "balanced", Array<NonNullable<ClinicalEvidenceMap["contextMatrix"]>[number]["tag"]>> = {
  motor_praxis: ["motor_task_load"],
  adaptive_daily_living: ["daily_routine", "body_signal_fatigue"],
  social_pragmatic: ["social_pragmatic_demand", "group_crowd"],
  language_communication: ["verbal_load"],
  language_social_pragmatic: ["verbal_load", "social_pragmatic_demand", "group_crowd"],
  physiological_interoceptive: ["body_signal_fatigue", "daily_routine"],
  selective_interoception: ["body_signal_fatigue"],
  evidence_limited_mixed: [],
  default: [],
  balanced: [],
}

function mechanismKey(evidenceMap: ClinicalEvidenceMap): ClinicalMechanismType | "balanced" {
  return evidenceMap.primaryAxisKind === "balanced" ? "balanced" : evidenceMap.clinicalMechanism || "default"
}

function contextTrigger(evidenceMap: ClinicalEvidenceMap, key: ClinicalMechanismType | "balanced", fallback: string): string {
  const supportedTags = new Set(MECHANISM_CONTEXT_TAGS[key] || [])
  const primaryLoad = evidenceMap.contextMatrix?.find(
    (entry) => entry.valence === "loads" && supportedTags.has(entry.tag)
  )
  if (!primaryLoad) return fallback
  switch (primaryLoad.tag) {
    case "group_crowd":
      return "grup, kalabalık veya uyaran yoğunluğu arttığında"
    case "transition":
      return "geçiş ve rutin değişimi zorlaştığında"
    case "verbal_load":
      return "sözel talep ve yönerge karmaşıklığı arttığında"
    case "motor_task_load":
      return "motor görev ve beden organizasyonu talebi arttığında"
    case "body_signal_fatigue":
      return "yorgunluk ve bedensel toparlanma ihtiyacı arttığında"
    case "social_pragmatic_demand":
      return "sosyal-pragmatik talep arttığında"
    case "daily_routine":
      return "günlük yaşam rutini ve öz bakım akışı zorlaştığında"
    case "low_demand_one_to_one":
    default:
      return fallback
  }
}

function limitOverride(evidenceMap: ClinicalEvidenceMap, fallback: string): string {
  if (evidenceMap.counterEvidenceLines?.length) return "bu nedenle yorum bağlamla sınırlı ve temkinli tutulur"
  if (evidenceMap.preservedCapacityLines?.length) return "korunmuş kapasite verisi, yorumun her bağlama genellenmemesi gerektiğini gösterir"
  if (evidenceMap.confidenceLevel === "sınırlı") return "veri güveni sınırlı olduğu için yorum temkinli kurulur"
  return fallback
}

function sentenceCase(value: string): string {
  if (!value) return value
  return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1)
}

export function compileClinicalNarrative(
  evidenceMap: ClinicalEvidenceMap,
  differential?: DifferentialFormulation | null
): CompiledClinicalNarrative {
  const key = mechanismKey(evidenceMap)
  const parts = MECHANISM_PARTS[key]
  const context = key === "default" || key === "balanced" ? parts.context : contextTrigger(evidenceMap, key, parts.context)
  const limit = limitOverride(evidenceMap, parts.limit)
  const mechanismWithContext =
    key === "language_communication"
      ? parts.mechanism
      : `${context} ${parts.mechanism}`
  const decisionSentence =
    key === "balanced"
      ? `Bu vaka, ${parts.mechanism} gösterir; ${context} ${parts.spread} ve ${limit}.`
      : `Bu vaka, ${mechanismWithContext} ile açıklanır. Bu zorlanma ${parts.spread}; ${limit}.`
  const formulationSentence =
    key === "balanced"
      ? `${sentenceCase(parts.mechanism)}, ${context} ${parts.spread}; ${limit}.`
      : `${sentenceCase(mechanismWithContext)} öne çıkar. Bu zorlanma ${parts.spread}; ${limit}.`
  const conclusionSentence =
    key === "balanced"
      ? `Sonuç olarak profil, ${parts.mechanism} ile açıklanır; ${limit}.`
      : `Sonuç olarak klinik odak, ${parts.mechanism} ve bunun günlük işlevdeki yansımaları üzerinden açıklanır.`

  return {
    decisionSentence,
    formulationSentence,
    conclusionSentence,
    differential,
    ruleIds: [`rule.narrative_compiler.${key}`, ...(differential?.ruleIds || [])],
  }
}
