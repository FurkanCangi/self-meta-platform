import type { ClinicalEvidenceMap, ClinicalMechanismType } from "./clinicalAnalysis"
import type { DifferentialFormulation } from "./clinicalDifferentialFormulation"

export type CompiledClinicalNarrative = {
  decisionSentence: string
  formulationSentence: string
  conclusionSentence: string
  functionalImpactSentence: string
  contextContrastSentence: string
  decisionBoundarySentence: string
  verificationSentence: string
  differential?: DifferentialFormulation | null
  ruleIds: string[]
}

type MechanismNarrativeParts = {
  mechanism: string
  context: string
  spread: string
  limit: string
  functionalImpact: string
  verification: string
}

const MECHANISM_PARTS: Record<ClinicalMechanismType | "balanced", MechanismNarrativeParts> = {
  motor_praxis: {
    mechanism: "motor planlama ve beden organizasyonunu kurma ve sürdürme güçlüğü",
    context: "yeni veya çok basamaklı motor görevlerde",
    spread: "yürütücü organizasyon, görev sürdürme ve duygusal toparlanma süreçlerine yayılır",
    limit: "yapılandırılmış bağlamdaki korunmuş kapasite varsa genellenmiş bir kapasite düşüklüğü gibi okunmaz",
    functionalImpact: "yeni hareket dizilerini başlatma, giyinme ve araç-gereç kullanımında adımları organize etme ve motor görevi tamamlamaya kadar sürdürme",
    verification: "yeni ve çok basamaklı bir motor görevde, model desteği azaltılarak başlatma süresi, adım sırası ve toparlanma gereksiniminin karşılaştırılması",
  },
  adaptive_daily_living: {
    mechanism: "öz bakım ve günlük yaşam akışını başlatma-sürdürme süreçlerinde belirginleşen self-regülasyon zorluğu",
    context: "rutin, sıra ve sorumluluk talebi arttığında",
    spread: "yürütücü organizasyon, beden farkındalığı ve duygusal toparlanmaya yayılır",
    limit: "korunmuş test veya gözlem verisi varsa yorum doğal ortam bağlamıyla sınırlı tutulur",
    functionalImpact: "öz bakım rutinini başlatma, adımları sıraya koyma, tamamlanana kadar sürdürme ve günlük sorumluluklara geçiş yapma",
    verification: "bir doğal yaşam rutininin farklı gün ve ortamlarda başlatma, ipucu gereksinimi ve tamamlama süresi açısından izlenmesi",
  },
  social_pragmatic: {
    mechanism: "sosyal karşılıklılık ve pragmatik esneklik taleplerinde belirginleşen self-regülasyon zorluğu",
    context: "sosyal talep, grup akışı veya bağlama uyum beklentisi arttığında",
    spread: "bilişsel düzenleme, duygusal toparlanma ve davranış ayarlama süreçlerine yansır",
    limit: "bire bir iş birliği korunuyorsa genellenmiş sosyal kapasite düşüklüğü gibi genişletilmez",
    functionalImpact: "akran oyununa girme, karşılıklılığı sürdürme, sıra ve konu değişimine uyum sağlama ve grup etkinliğinde kalma",
    verification: "bire bir etkileşim ile akran grubu bağlamının karşılıklılık, esneklik ve etkinlikte kalma ölçütleriyle karşılaştırılması",
  },
  language_communication: {
    mechanism: "sözel talep ve yönerge karmaşıklığı arttığında belirginleşen self-regülasyon zorluğu",
    context: "anlama, zihinde tutma ve çok adımlı görev talebi arttığında",
    spread: "bilgiyi işleme, görevde kalma ve engellenmeye dayanma kapasitesine yansır",
    limit: "yorum genel öğrenme kapasitesi hükmüne genişletilmez",
    functionalImpact: "çok adımlı yönergeyi zihinde tutma, görevi başlatma, sözel bilgi yükü altında görevde kalma ve işi tamamlama",
    verification: "aynı görevin kısa-görsel yönerge ve uzun-sözel yönerge koşullarında doğruluk, bağımsızlık ve görevde kalma açısından karşılaştırılması",
  },
  language_social_pragmatic: {
    mechanism: "dilsel talep ile sosyal-pragmatik beklentinin birlikte zorladığı self-regülasyon zorluğu",
    context: "anlama, karşılıklılığı sürdürme ve bağlama uyum aynı anda beklendiğinde",
    spread: "bilişsel organizasyon, etkileşim sürekliliği ve duygusal toparlanmaya yayılır",
    limit: "dilsel ya da sosyal tek başlıkla daraltılmadan bağlam içinde yorumlanır",
    functionalImpact: "grup konuşmasını izleme, bağlama uygun yanıt üretme, karşılıklı etkileşimi sürdürme ve sosyal görev değişikliklerine uyum sağlama",
    verification: "yapısal dil talebi ile sosyal-pragmatik talebin ayrı ve birlikte sunulduğu koşullarda katılımın karşılaştırılması",
  },
  physiological_interoceptive: {
    mechanism: "bedensel toparlanma ve içsel sinyalleri düzenlemeye katma süreçlerinde belirginleşen self-regülasyon zorluğu",
    context: "yorgunluk, beden sinyali veya toparlanma talebi arttığında",
    spread: "dikkat, günlük işlev akışı ve duygusal toparlanmaya yayılır",
    limit: "medikal nedensellik ya da tek kaynaklı açıklama üretmeden yorumlanır",
    functionalImpact: "yorgunluk, açlık, uyku ve diğer beden sinyalleri değiştiğinde günlük ritmi sürdürme, dikkati koruma ve toparlanma",
    verification: "beden sinyali ve yorgunluk düzeyi değişen zaman dilimlerinde görev katılımı, sinyali fark etme ve toparlanma süresinin izlenmesi",
  },
  selective_interoception: {
    mechanism: "içsel bedensel sinyal farkındalığında seçici self-regülasyon zorluğu",
    context: "bedensel ihtiyaçların düzenleme sürecine zamanında katılması gerektiğinde",
    spread: "toparlanma, günlük ritim ve işlevsel dalgalanmaya seçici biçimde yansır",
    limit: "yaygın bir düzenleme yetersizliği gibi genişletilmez",
    functionalImpact: "açlık, susama, tuvalet ve yorgunluk sinyallerini zamanında fark edip günlük davranışı buna göre ayarlama",
    verification: "farklı beden sinyallerinde fark etme zamanı, sözel bildirim, uygun yanıt ve dış hatırlatıcı gereksiniminin ayrı ayrı izlenmesi",
  },
  evidence_limited_mixed: {
    mechanism: "bağlama göre değişen self-regülasyon güçlüğü",
    context: "dış test, anamnez ve gözlem tam örtüşmediğinde",
    spread: "görevi başlatma, zihinsel organizasyonu sürdürme ve duygusal toparlanmada değişken görünür",
    limit: "yorum yalnız ortaklaşan görev ve bağlamlarla sınırlandırılır",
    functionalImpact: "görevi başlatma, sürdürme, geçiş yapma ve talep arttığında farklı ortamlarda tutarlı performans gösterme",
    verification: "aynı işlevsel görevin ev, klinik ve eğitim ortamlarında ortak ölçütlerle tekrarlanarak kaynaklar arası ayrışmanın sınanması",
  },
  default: {
    mechanism: "öncelikli alanda belirginleşen regülasyon güçlüğü",
    context: "görev ve bağlam talebi arttığında",
    spread: "görevi başlatma, sürdürme ve geçiş yapma performansını etkiler",
    limit: "tek puan ya da tek veri kaynağı üzerinden genişletilmez",
    functionalImpact: "görevi başlatma, katılımı sürdürme, geçiş yapma ve talep sonrasında yeniden organize olma",
    verification: "zorlanmanın bildirildiği doğal görevde başlatma, bağımsızlık, görevde kalma ve toparlanma ölçütlerinin tekrarlı gözlenmesi",
  },
  balanced: {
    mechanism: "korunmuş ve dengeli düzenleme zemini",
    context: "bağlamsal hassasiyetler görünse bile",
    spread: "günlük işlevde geniş bir risk iddiasına dönüşmez",
    limit: "yorum korunmuş kapasite sınırında kalır",
    functionalImpact: "temel günlük rutinleri ve yapılandırılmış görevleri yaşa uygun katılım düzeyinde sürdürebilme",
    verification: "yalnız bildirilen hassasiyetin görüldüğü doğal bağlamda hedefli gözlem yapılarak korunmuş performans ile güçlük arasındaki ayrımın doğrulanması",
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

function hasExternalConcernEvidence(evidenceMap: ClinicalEvidenceMap): boolean {
  return Boolean(
    evidenceMap.evidenceAtoms?.some(
      (atom) => atom.sourceType === "external_test" && atom.direction === "supports"
    )
  )
}

function hasNonScoreConcernEvidence(evidenceMap: ClinicalEvidenceMap): boolean {
  return Boolean(
    evidenceMap.evidenceAtoms?.some(
      (atom) => atom.sourceType !== "score" && atom.direction === "supports"
    )
  )
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
  const hasDirectContradiction = Boolean(
    evidenceMap.primaryAxisKind !== "balanced" &&
      evidenceMap.evidenceAtoms?.some(
        (atom) => atom.direction === "contradicts" && atom.sourceType === "preserved_capacity"
      )
  )
  const hasPreservedCapacity = Boolean(
    evidenceMap.preservedCapacityLines?.length ||
      evidenceMap.evidenceAtoms?.some(
        (atom) => atom.direction === "limits" && atom.sourceType === "preserved_capacity"
      )
  )

  if (hasDirectContradiction) return "korunmuş veya çelişkili bulgular nedeniyle sonuç tüm görev ve ortamlara genellenmez"
  if (hasPreservedCapacity) return "korunmuş kapasite ya da destekle daha düzenli performans görülen koşullar ayrıca dikkate alınır"
  if (evidenceMap.counterEvidenceLines?.length) return "sınırlayıcı bulgular nedeniyle sonuç tüm görev ve ortamlara genellenmez"
  if (evidenceMap.confidenceLevel === "sınırlı") return "vaka içi kanıt az olduğu için sonuç yalnız değerlendirilen koşullarla sınırlıdır"
  return fallback
}

function sentenceCase(value: string): string {
  if (!value) return value
  return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1)
}

function buildContextContrastSentence(evidenceMap: ClinicalEvidenceMap): string {
  const contexts = evidenceMap.contextMatrix || []
  const loading = contexts.find((entry) => entry.valence === "loads") || contexts.find((entry) => entry.valence === "mixed")
  const organizing = contexts.find((entry) => entry.valence === "organizes")

  if (loading && organizing) {
    return `${sentenceCase(loading.label)} koşullarında performans düşerken ${organizing.label} koşullarında performans daha düzenlidir. Bu fark, sabit bir kapasite kaybından çok görev talebine duyarlı bir değişkenliği gösterir.`
  }
  if (loading) {
    return `${sentenceCase(loading.label)} zorlanmanın belirginleştiği bağlamdır; başka bir koşulda korunmuş performansı gösteren karşılaştırmalı veri sınırlı olduğu için bağlam etkisi genellenemez.`
  }
  if (organizing) {
    return `${sentenceCase(organizing.label)} korunmuş kapasiteyi göstermektedir. Zorlanmayı artıran karşılaştırmalı koşul yeterince örneklenmediği için bu bulgu tek başına genellenmez.`
  }
  return "Zorlanmayı artıran ve performansı organize eden koşullar karşılaştırmalı olarak belgelenmediği için bağlamsal ayrım henüz sınırlıdır."
}

function buildDecisionBoundarySentence(evidenceMap: ClinicalEvidenceMap): string {
  const hasExternalConcern = hasExternalConcernEvidence(evidenceMap)
  const hasContextualConcern = hasNonScoreConcernEvidence(evidenceMap)
  const hasSourceConflict =
    evidenceMap.clinicalMechanism === "evidence_limited_mixed" ||
    Boolean(evidenceMap.evidenceAtoms?.some((atom) => atom.direction === "contradicts"))
  const hasRichTriangulation =
    hasExternalConcern &&
    evidenceMap.therapistObservationEvidence.length > 0 &&
    evidenceMap.anamnesisEvidence.length > 0 &&
    Boolean(evidenceMap.contextMatrix?.length)
  if (evidenceMap.primaryAxisKind === "balanced" && hasExternalConcern) {
    return "DNA Intelligence puanlarının korunmuş olması, dış test veya doğal bağlamda bildirilen seçici güçlüğü dışlamaz; kaynaklar arasındaki ayrışma hedefli işlevsel gözlem yapılmadan genel kapasite ya da tanı hükmüne dönüştürülemez."
  }
  if (evidenceMap.primaryAxisKind === "balanced" && hasContextualConcern) {
    return "DNA Intelligence puanları genel düzenleme zeminini korunmuş gösterirken anamnez veya gözlem seçici bir günlük yaşam güçlüğüne işaret etmektedir. Bu bulgu yaygın bir kapasite kaybına genellenmez; yalnız bildirildiği görev ve bağlamlarda hedefli olarak doğrulanır."
  }
  if (evidenceMap.primaryAxisKind === "balanced") {
    return "Skorlar, anamnez ve gözlem genel olarak korunmuş işleyişte yakınsamaktadır. Bu bulgu her görev ve ortamda değişmez performans garantisi oluşturmaz; varsa seçici dalgalanmalar yalnız görüldükleri bağlam içinde değerlendirilir."
  }
  if (hasSourceConflict) {
    return "Skorlar, anamnez, terapist gözlemi ve dış testler aynı klinik yoruma tam olarak yakınsamamaktadır. Bu nedenle karar yalnız ortaklaşan görev ve bağlamlarla sınırlandırılır; güçlük her görev ve ortama genellenmez."
  }
  if (hasRichTriangulation) {
    return "Skor örüntüsü, anamnez, terapist gözlemi, dış test ve bağlam karşılaştırması aynı klinik yorumu desteklemektedir; yine de korunmuş koşullar nedeniyle güçlük her görev ve ortama genellenemez."
  }
  if (evidenceMap.confidenceLevel === "sınırlı") {
    return "Skor örüntüsü klinik önem taşımakla birlikte vaka içi bağlamsal kanıt sınırlıdır; bu nedenle hipotezin genellenebilirliği düşüktür ve profil tanı ya da sabit kapasite kaybı olarak yorumlanamaz."
  }
  if (evidenceMap.counterEvidenceLines?.length || evidenceMap.preservedCapacityLines?.length) {
    return "Korunmuş ve sınırlayıcı bulgular, güçlüğün her görev ve ortamda aynı biçimde ortaya çıktığı sonucuna izin vermez; karar bağlam, görev talebi ve bağımsızlık düzeyiyle sınırlandırılır."
  }
  return "Bu klinik hipotez mevcut skor, anamnez ve gözlem örüntüsünü açıklar; ancak tek başına tanı, nedensellik veya değişmez kapasite hükmü oluşturmaz."
}

function defaultFunctionalImpact(evidenceMap: ClinicalEvidenceMap, fallback: string): string {
  const axis = evidenceMap.primaryAxis.toLocaleLowerCase("tr-TR")
  if (/(?:yaygın|birlikte öncelikli) çoklu alan/.test(axis)) {
    return "günlük görevleri başlatma, katılımı sürdürme, geçiş yapma, beden ve duygu sinyallerini düzenlemeye katma ve talep sonrasında yeniden organize olma"
  }
  if (/duyusal/.test(axis)) {
    return "çevresel uyaranları filtrelerken göreve başlama, katılımı sürdürme, kaçınma gereksinimini düzenleme ve yüklenme sonrasında yeniden organize olma"
  }
  if (/yürütücü|bilişsel/.test(axis)) {
    return "çok adımlı yönergeyi zihinde tutma, görevi başlatma, adımları sıraya koyma, tamamlanana kadar sürdürme ve geçiş yapma"
  }
  if (/duygusal/.test(axis)) {
    return "engellenme ve beklenmeyen değişiklik sırasında etkinlikte kalma, yardım kullanma ve duygusal yükselme sonrasında yeniden katılım gösterme"
  }
  if (/fizyolojik|interosep/.test(axis)) {
    return "beden sinyalleri ve yorgunluk değiştiğinde günlük ritmi sürdürme, dikkati koruma ve uygun toparlanma davranışını başlatma"
  }
  return fallback
}

function defaultVerification(evidenceMap: ClinicalEvidenceMap, fallback: string): string {
  const axis = evidenceMap.primaryAxis.toLocaleLowerCase("tr-TR")
  if (/(?:yaygın|birlikte öncelikli) çoklu alan/.test(axis)) {
    return "aynı doğal görevlerin iki farklı ortamda başlatma, bağımsızlık, görevde kalma, geçiş ve toparlanma ölçütleriyle tekrarlı olarak karşılaştırılması"
  }
  if (/duyusal/.test(axis)) {
    return "aynı görevin düşük uyaranlı ve yoğun uyaranlı koşullarda katılım, kaçınma, ipucu gereksinimi ve toparlanma süresi açısından karşılaştırılması"
  }
  if (/yürütücü|bilişsel/.test(axis)) {
    return "aynı görevin kısa-görsel ve uzun-sözel yönerge koşullarında başlatma süresi, çalışma belleği yükü, doğruluk ve bağımsızlık açısından karşılaştırılması"
  }
  return fallback
}

export function compileClinicalNarrative(
  evidenceMap: ClinicalEvidenceMap,
  differential?: DifferentialFormulation | null
): CompiledClinicalNarrative {
  const key = mechanismKey(evidenceMap)
  const parts = MECHANISM_PARTS[key]
  const mechanism =
    key === "default" && /(?:yaygın|birlikte öncelikli) çoklu alan/i.test(evidenceMap.primaryAxis)
      ? "birden fazla regülasyon alanına yayılan güçlük"
      : key === "default" && evidenceMap.primaryAxis
      ? `${evidenceMap.primaryAxis.toLocaleLowerCase("tr-TR")} alanında belirginleşen güçlük`
      : parts.mechanism
  const context = key === "default" || key === "balanced" ? parts.context : contextTrigger(evidenceMap, key, parts.context)
  const limit = limitOverride(evidenceMap, parts.limit)
  const hasDirectContradiction = Boolean(
    evidenceMap.primaryAxisKind !== "balanced" &&
      evidenceMap.evidenceAtoms?.some(
        (atom) => atom.direction === "contradicts" && atom.sourceType === "preserved_capacity"
      )
  )
  const balancedContextualConcern = key === "balanced" && hasNonScoreConcernEvidence(evidenceMap)
  const primaryLoadingContext =
    evidenceMap.contextMatrix?.find((entry) => entry.valence === "loads") ||
    evidenceMap.contextMatrix?.find((entry) => entry.valence === "mixed")
  const balancedConcernLocation = primaryLoadingContext
    ? `${primaryLoadingContext.label} koşullarında`
    : "anamnez, gözlem veya dış testte"
  const mechanismWithContext =
    key === "language_communication"
      ? mechanism
      : `${context} ${mechanism}`
  const isEvidenceLimitedMixed = key === "evidence_limited_mixed"
  const decisionSentence =
    hasDirectContradiction
      ? `Alan puanı ${evidenceMap.primaryAxis} alanında seçici bir güçlük olasılığı göstermektedir; ancak anamnez ve gözlem bu bulgunun günlük işlevsel karşılığını doğrulamamaktadır. Bu nedenle skor bulgusu doğrulanması gereken klinik hipotez olarak tutulur ve günlük yaşama genellenmez.`
      : balancedContextualConcern
      ? `DNA Intelligence alan puanları korunmuş bir düzenleme zemini göstermektedir. Bununla birlikte ${balancedConcernLocation} bildirilen seçici işlevsel zorlanma, genel profil içinde bağlama duyarlı bir hassasiyet olarak ele alınır ve yaygın risk olarak genellenmez.`
      : key === "balanced"
      ? `Bulgular ${mechanism} göstermektedir. ${sentenceCase(context)} ${parts.spread}; ${limit}.`
      : isEvidenceLimitedMixed
      ? `Dış test, anamnez ve gözlem tam örtüşmediği için ${parts.spread}. ${sentenceCase(limit)}.`
      : `${sentenceCase(mechanismWithContext)}, ${parts.spread}. ${sentenceCase(limit)}.`
  const formulationSentence =
    hasDirectContradiction
      ? `Skor bulgusu ile doğal ve yapılandırılmış bağlamdaki korunmuş performans arasında ayrışma öne çıkar. ${sentenceCase(limit)}.`
      : balancedContextualConcern
      ? `Korunmuş skor örüntüsü ile ${balancedConcernLocation} bildirilen zorlanma birlikte değerlendirildiğinde, genel kapasite kaybından çok bağlama duyarlı performans değişkenliği öne çıkar. ${sentenceCase(limit)}.`
      : key === "balanced"
      ? `${sentenceCase(mechanism)}, ${context} ${parts.spread}; ${limit}.`
      : isEvidenceLimitedMixed
      ? `Bağlama göre değişen self-regülasyon güçlüğü öne çıkar. ${sentenceCase(limit)}.`
      : `${sentenceCase(mechanismWithContext)} öne çıkar. Bu güçlük ${parts.spread}; ${limit}.`
  const conclusionSentence =
    hasDirectContradiction
      ? `Sonuç olarak klinik karar, ${evidenceMap.primaryAxis} alanındaki skor bulgusu ile günlük yaşamda bildirilen korunmuş performans arasındaki ayrışmanın hedefli görev karşılaştırmasıyla doğrulanmasına dayanır.`
      : balancedContextualConcern
      ? `Sonuç olarak genel düzenleme zemini korunmuştur; klinik izlem ${balancedConcernLocation} görülen seçici işlevsel zorlanmanın görev ve ortamlar arasında tekrarlanıp tekrarlanmadığına odaklanır.`
      : key === "balanced"
      ? `Sonuç olarak profil, ${mechanism} ile açıklanır; ${limit}.`
      : isEvidenceLimitedMixed
      ? "Sonuç olarak klinik odak, bağlama göre değişen self-regülasyon güçlüğü üzerinden açıklanır."
      : `Sonuç olarak klinik odak, ${mechanism} ile bunun günlük işlevdeki sonuçlarının birlikte değerlendirilmesidir.`
  const functionalImpact = key === "default" ? defaultFunctionalImpact(evidenceMap, parts.functionalImpact) : parts.functionalImpact
  const balancedWithoutLoadingContext =
    key === "balanced" &&
    !evidenceMap.contextMatrix?.some((entry) => entry.valence === "loads" || entry.valence === "mixed")
  const verification = balancedWithoutLoadingContext
    ? "korunmuş performansın farklı doğal görevlerde sürüp sürmediğinin rutin izlem içinde gözlenmesi"
    : key === "default"
    ? defaultVerification(evidenceMap, parts.verification)
    : parts.verification
  const functionalImpactSentence =
    hasDirectContradiction
      ? `Mevcut anamnez ve gözlem, ${functionalImpact} sırasında beklenen güçlüğü doğrulamamaktadır; bu nedenle günlük işlevsel etki henüz gösterilmiş kabul edilmez.`
      : balancedContextualConcern
      ? `Bildirilen işlevsel değişkenlik ${balancedConcernLocation} görünürken, yapılandırılmış veya destekleyici koşullarda performans daha düzenlidir.`
      : key === "balanced"
      ? `Korunmuş kapasite, ${functionalImpact} üzerinden görünür.`
      : `Zorlanmanın günlük işlevdeki başlıca karşılığı, ${functionalImpact} sırasında performansın değişkenleşmesidir.`
  const contextContrastSentence = buildContextContrastSentence(evidenceMap)
  const decisionBoundarySentence = buildDecisionBoundarySentence(evidenceMap)
  const verificationSentence = `${sentenceCase(verification)}.`

  return {
    decisionSentence,
    formulationSentence,
    conclusionSentence,
    functionalImpactSentence,
    contextContrastSentence,
    decisionBoundarySentence,
    verificationSentence,
    differential,
    ruleIds: [
      `rule.narrative_compiler.${key}`,
      ...(hasDirectContradiction ? ["rule.narrative_compiler.direct_contradiction"] : []),
      "rule.narrative_compiler.functional_impact",
      "rule.narrative_compiler.context_contrast",
      "rule.narrative_compiler.decision_boundary",
      "rule.narrative_compiler.verification",
      ...(differential?.ruleIds || []),
    ],
  }
}
