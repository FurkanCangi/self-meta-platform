import type {
  LockedReportPlan,
  PlainClinicalRewriteRecord,
  PlainClinicalTurkishSummary,
  ReportClinicalMateriality,
  ReportMateriality,
  ReportRealization,
  ReportSectionId,
} from "./contracts"
import { normalizeDnaReportLanguage } from "./languageContract"

export const PLAIN_CLINICAL_TURKISH_VERSION = "plain-clinical-turkish@5-clinical-content-release-candidate" as const

const NOMINALIZATION = /\b(?:değişkenleşmesi|belirginleşmesi|ilişkilendirilmesi|değerlendirilmesi|destek gereksiniminin belirginleşmesi)\b/giu
const ABSTRACT_CLINICAL = /(?:işlevsel karşılık|klinik eksen|klinik örünt\p{L}*|\bgörünüm\p{L}*|korunmuş performans|vaka bağlamında|bu alanı çürütmez|diğer bulgular kadar güçlü desteklenmedi|günlük işlev güçlüğü bakım veren anlatısında|performansın bağlama duyarlı)/giu
const UNCLEAR_AGENT = /(?:bakım veren anlatısında bildiriliyor|bağlamsal veri bulunuyor|performansın[^.!?]{0,100}(?:olduğu görül|değişebildiğine ilişkin)|bulguların günlük yaşamdaki anlamı değerlendirilirken)/giu
const DAILY_LIFE_CUE = /(?:çocuk|bakım veren|terapist|günlük yaşam|etkinlik|görev|rutin|uyku|enerji|ses|dokun|uyaran|yönerge|açlık|susuzluk|tuvalet|giyin|okul|oyun|destek)/iu
const NON_MATERIAL_THEORY = /(?:prenatal|doğum öncesi|plasent\p{L}*|inflamatu\p{L}*|inflamasyon|allostaz|allostatik|gereksiz gelişimsel teori|genel nörogelişimsel teori)/giu
const PLAIN_GRAMMAR = /(?:günlük işlevını|Bununla birlikte\s+Farklı|Kurum içi kaynakta|DNA'nın kavramsal çerçevesi,|\bHttps:\/\/|\b(?:bulguyü|bulguyle|bilginda|değerlendirmendedir|yorumlanmaktadırdır)\b|[.!?]\s+[a-zçğıöşü]{3,}\s)/gu
const TRANSLATIONESE = /(?:açısından yararlı olabilir\s*[.!?]?$|işlevsel karşılığıdır|bağlamsal veri bulunuyor|performansın bağlama duyarlı)/giu
const AWKWARD_GENERIC_PHRASE = /(?:alanı ile ilgili günlük işleri sürdürmekte|bu alanla ilgili günlük işleri sürdürmekte|Diğer self-regülasyon alanlarındaki becerilerin bir bölümünün sürdüğünü|Kurum içi kaynakta)/giu
const GENERIC_CONVERGENCE = /(?:Bakım veren bildirimi, klinik gözlem ve ölçüm bulguları|İki farklı bilgi kaynağı|Bilgi kaynakları)[^.!?]{0,120}(?:genel olarak )?aynı yönde/iu
const GENERIC_DISCREPANCY = /(?:farklı bilgi kaynaklarının aynı yönde sonuç vermemesi|farklı bilgi kaynakları[^.!?]{0,120}aynı yönde değildir)/iu
const HUMAN_EDITOR_SYSTEM_PROSE = /(?:Bu bulgular,? rapordaki önceliği değiştirmek için yeterli değildir|Bu sonuca duyulan güven[^.!?]*düzeydedir|alanındaki becerilerin korunduğunu gösteren bulgular vardır|günlük yaşam açısından izlenecek ilk alanı oluşturuyor|Öncelik sırası,? işlevsel bilgiler netleştikçe yeniden değerlendirilebilir)/giu
const PROTECTED_TERMS = Object.freeze([
  "self-regülasyon", "interosepsiyon", "arousal", "reaktivite", "toparlanma", "duyusal regülasyon",
  "fizyolojik regülasyon", "bilişsel regülasyon", "yürütücü işlev", "okupasyon", "okupasyonel performans",
])

const SPECIFICITY_CONCEPTS = Object.freeze([
  ["visual_sequence", /(?:görsel sıra|resimli sıra|görsel destek|kontrol listesi)/iu],
  ["short_reminder", /(?:kısa hatırlatma|sözel ipucu|tek ipucu|sık hatırlatma)/iu],
  ["quiet_environment", /(?:sessiz ortam|düşük uyaranlı|uyaran azalt)/iu],
  ["sound", /(?:ses|işitsel|gürültü)/iu],
  ["touch", /(?:dokunma|dokunsal|temas)/iu],
  ["multi_step", /(?:çok basamaklı|çok adımlı|adımların sırası)/iu],
  ["instruction", /(?:yönerge|sözel bilgi|sözel yük|sözel talep)/iu],
  ["sleep", /(?:uyku|uykusuz)/iu],
  ["energy", /enerji/iu],
  ["hunger", /açlık/iu],
  ["thirst", /susuzluk|susama/iu],
  ["toilet", /tuvalet/iu],
  ["fatigue", /yorgunluk/iu],
  ["dressing", /giyinme/iu],
  ["meal", /(?:yemek|kahvaltı|öğün)/iu],
  ["school_bag", /(?:çanta|okul çantası)/iu],
  ["tooth_brushing", /diş fırçalama/iu],
  ["transition", /(?:geçiş|bir etkinlikten diğerine)/iu],
] as const)

const INTERVENTION_CONCEPTS: ReadonlySet<string> = new Set(["visual_sequence", "short_reminder", "quiet_environment"])

function normalized(text: string) {
  return text.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").replace(/\s+/gu, " ").trim()
}

function count(text: string, pattern: RegExp) {
  pattern.lastIndex = 0
  return text.match(pattern)?.length ?? 0
}

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+|\n{2,}/u).map((sentence) => sentence.trim()).filter(Boolean)
}

function unique<T>(values: readonly T[]) {
  return Array.from(new Set(values))
}

function confidenceSentence(level: string) {
  return `Mevcut bilgiler bu klinik yorumu ${level} güven düzeyiyle destekliyor.`
}

type RewriteRule = Readonly<{
  id: string
  pattern: RegExp
  replace: string | ((match: string, ...groups: string[]) => string)
}>

const RULES: readonly RewriteRule[] = Object.freeze([
  {
    id: "NON_MATERIAL_DEVELOPMENTAL_THEORY_EXCLUSION",
    pattern: /Doğum sonrası duyarlı bakım, sağlık koşullarının iyileştirilmesi, güvenli çevre ve erken destekleyici deneyimler gelişime ilişkin seyri değiştirebilir\.?/giu,
    replace: "",
  },
  {
    id: "NON_MATERIAL_THEORY_SENTENCE_EXCLUSION",
    pattern: /[^.!?]*(?:prenatal|doğum öncesi|plasent\p{L}*|inflamatu\p{L}*|inflamasyon|allostaz|allostatik|gereksiz gelişimsel teori|genel nörogelişimsel teori)[^.!?]*[.!?]?/giu,
    replace: "",
  },
  {
    id: "DANGLING_BOUNDARY_REPAIR",
    pattern: /Ancak yalnız başına tanısal veya açıklayıcı değildir\.?/giu,
    replace: "Tek bir öykü bilgisi yalnız başına tanısal veya açıklayıcı değildir.",
  },
  {
    id: "CONNECTOR_CAPITALIZATION_REPAIR",
    pattern: /Bununla birlikte\s+Farklı/gu,
    replace: "Bununla birlikte farklı",
  },
  {
    id: "BROKEN_SUFFIX_FUNCTION_REPAIR",
    pattern: /kendi günlük işlevını/giu,
    replace: "kendi performansını",
  },
  {
    id: "OWNER_EMOTIONAL_MONITORING_DIRECT",
    pattern: /Duygusal regülasyon bulgularının günlük yaşamdaki anlamı değerlendirilirken, çocuğun görevin talebini değerlendirmesi, kendi performansını izlemesi ve gerektiğinde strateji değiştirmesi gerekir\.?/giu,
    replace: "Çocuğun görevin gerektirdiklerini fark etmesi, kendi performansını izlemesi ve gerektiğinde farklı bir yol denemesi, duygusal regülasyonla ilgili günlük yaşam bilgileriyle birlikte değerlendirilir.",
  },
  {
    id: "FUNCTIONAL_COUNTERPART_TO_CHILD_ACTION",
    pattern: /Uyaran yoğunluğu arttığında katılımın, geçişlerin veya görevde kalmanın değişkenleşmesi olası işlevsel karşılıktır\.?/giu,
    replace: "Uyaranlar yoğunlaştığında çocuk etkinliğe katılmakta, bir etkinlikten diğerine geçmekte veya yaptığı işe devam etmekte zorlanabilir.",
  },
  {
    id: "SENSORY_ACTION",
    pattern: /Uyaran yoğunluğu arttığında katılım, geçiş veya görevde kalma değişkenleşebilir\.?/giu,
    replace: "Uyaranlar yoğunlaştığında çocuk etkinliğe katılmakta, bir etkinlikten diğerine geçmekte veya yaptığı işe devam etmekte zorlanabilir.",
  },
  {
    id: "EXECUTIVE_ACTION",
    pattern: /Çok basamaklı görevleri başlatma, sürdürme ve tamamlama sırasında destek gereksinimi belirginleşebilir\.?/giu,
    replace: "Çocuk çok basamaklı işleri başlatmak, sürdürmek ve tamamlamak için desteğe ihtiyaç duyabilir.",
  },
  {
    id: "EXECUTIVE_SUPPORT_ACTION",
    pattern: /Çok basamaklı görevleri başlatma, sürdürme ve tamamlama desteğe duyarlı olabilir\.?/giu,
    replace: "Çocuk çok basamaklı işleri destek verildiğinde daha kolay tamamlayabilir.",
  },
  {
    id: "EMOTIONAL_ACTION",
    pattern: /Engellenme (?:veya|ve) beklenmeyen değişim sonrasında yeniden dengeye dönüş(?: süresi)? uzayabilir\.?/giu,
    replace: "Çocuk engellendiğinde veya beklenmedik bir değişiklik olduğunda yeniden sakinleşmesi daha uzun sürebilir.",
  },
  {
    id: "PHYSIOLOGICAL_ACTION",
    pattern: /Uyku, enerji ve (?:bedensel )?toparlanma koşulları günlük ritim (?:ile|ve) katılımı (?:değiştirebilir|etkileyebilir)\.?/giu,
    replace: "Uyku, enerji veya toparlanmadaki değişiklikler çocuğun günlük ritmini ve katılımını etkileyebilir.",
  },
  {
    id: "INTEROCEPTION_NAMED_ACTION",
    pattern: /Açlık, susuzluk, tuvalet veya yorgunluk gibi beden sinyallerini zamanında fark edip günlük akışa katma (?:güçleşebilir|değişkenleşebilir)\.?/giu,
    replace: "Çocuk açlık, susuzluk, tuvalet veya yorgunluk sinyallerini zamanında fark etmekte ve günlük akışta kullanmakta zorlanabilir.",
  },
  {
    id: "INTEROCEPTION_GENERIC_ACTION",
    pattern: /Beden sinyallerini zamanında fark edip günlük akışa katma (?:güçleşebilir|değişkenleşebilir)\.?/giu,
    replace: "Çocuk beden sinyallerini zamanında fark etmekte ve günlük akışta kullanmakta zorlanabilir.",
  },
  {
    id: "COGNITIVE_TASK_ACTION",
    pattern: /Sözel (?:yük|talep) ve çalışma belleği talebi arttığında bilgiyi işleme ve görevde kalma zorlaşabilir\.?/giu,
    replace: "Sözel bilgi veya çalışma belleği yükü arttığında çocuk bilgiyi işlemekte ve yaptığı işe devam etmekte zorlanabilir.",
  },
  {
    id: "COGNITIVE_PROCESSING_ACTION",
    pattern: /Sözel (?:yük|talep) ve çalışma belleği talebi arttığında bilgiyi işleme zorlaşabilir\.?/giu,
    replace: "Sözel bilgi veya çalışma belleği yükü arttığında çocuk bilgiyi işlemekte zorlanabilir.",
  },
  {
    id: "SUPPORTED_PERFORMANCE_CONTEXT",
    pattern: /Destekli veya yapılandırılmış koşullardaki daha iyi performans bu alanı çürütmez\.\s*Bu fark, performansın bağlama duyarlı olduğunu gösterir\.?/giu,
    replace: "Çocuk destek verildiğinde daha iyi performans gösterebiliyor. Bu durum, performansın ortama ve verilen desteğe göre değişebildiğini gösteriyor.",
  },
  {
    id: "SUPPORTED_PERFORMANCE_SINGLE",
    pattern: /Destekli veya yapılandırılmış koşullardaki daha iyi performans bu alanı çürütmez\.?/giu,
    replace: "Çocuk destek verildiğinde daha iyi performans gösterebiliyor.",
  },
  {
    id: "CONTEXT_DEPENDENT_PERFORMANCE",
    pattern: /Bu fark, performansın bağlama duyarlı olduğunu gösterir\.?/giu,
    replace: "Çocuğun performansı ortama ve verilen desteğe göre değişebiliyor.",
  },
  {
    id: "CONTEXTUAL_DATA_TO_CHILD_ACTION",
    pattern: /Performansın görev, destek veya çevre koşullarına göre değişebildiğine ilişkin bağlamsal veri bulunuyor\.?/giu,
    replace: "Çocuk bazı görevleri destek verildiğinde daha iyi yapıyor; performansı ortama ve verilen desteğe göre değişebiliyor.",
  },
  {
    id: "CAREGIVER_AS_AGENT",
    pattern: /([^.!?]{2,70}?)(?: alanı(?:yla)? ilişkili) günlük işlev güçlüğü bakım veren anlatısında bildiriliyor\.?/giu,
    replace: (_match, domain: string) => `Bakım veren, çocuğun ${domain.trim().toLocaleLowerCase("tr-TR")} alanında günlük yaşam güçlüğü yaşadığını bildiriyor.`,
  },
  {
    id: "DOMAIN_FINDING_TO_CHILD_ACTION",
    pattern: /([^.!?]{2,80}?)(?: alanındaki) bulgular günlük yaşamda güçlük olabileceğini gösteriyor\.?/giu,
    replace: (_match, domain: string) => `${domain.trim()} alanındaki bulgular, çocuğun bu alanda günlük yaşam güçlüğü yaşayabileceğini gösteriyor.`,
  },
  {
    id: "LIMITED_DAILY_LIFE_INFORMATION",
    pattern: /Bu alanın günlük yaşama etkisini açıklayan bilgi sınırlıdır\.?/giu,
    replace: "Bu güçlüğün günlük yaşama etkisini açıklayan bilgi sınırlıdır.",
  },
  {
    id: "PRIMARY_SOURCES_DIRECT",
    pattern: /([^.!?]{2,100}? alanındaki güçlük), farklı bilgi kaynakları birlikte değerlendirildiğinde de öne çıkıyor\.?/giu,
    replace: (_match, difficulty: string) => `Farklı bilgi kaynakları, çocuğun en çok ${difficulty.toLocaleLowerCase("tr-TR").replace(/ alanındaki güçlük$/u, " alanında zorlandığını")} gösteriyor.`,
  },
  {
    id: "BALANCED_ALTERNATIVE_DIRECT",
    pattern: /Self-regülasyon alanlarında korunmuş performans değerlendirildi, ancak diğer bulgular kadar güçlü desteklenmedi\.?/giu,
    replace: "",
  },
  {
    id: "ALTERNATIVE_DIRECT",
    pattern: /([^.!?]{2,120}?)(?: olasılığı)? değerlendirildi, ancak diğer bulgular kadar güçlü desteklenmedi\.?/giu,
    replace: (_match, area: string) => `${area.trim()} olasılığı da değerlendirildi; ancak mevcut bilgiler bu olasılığı güçlü biçimde desteklemek için yeterli değildir.`,
  },
  {
    id: "EXTERNAL_TEST_MISSING_DIRECT",
    pattern: /Yorumlanabilir bir dış değerlendirme bulunmadığı için test sonuçlarının diğer bulgularla uyumu değerlendirilemedi\.?/giu,
    replace: "Yorumlanabilir bir dış değerlendirme olmadığı için test sonuçlarının diğer bilgilerle aynı yönde olup olmadığı söylenemiyor.",
  },
  {
    id: "CONFIDENCE_DIRECT",
    pattern: /Bu öncelik (düşük|orta|orta-yüksek|yüksek) güven düzeyinde ele alınıyor\.?/giu,
    replace: (_match, level: string) => confidenceSentence(level),
  },
  {
    id: "SYSTEM_CONFIDENCE_DIRECT",
    pattern: /Bu sonuca duyulan güven (düşük|orta|orta-yüksek|yüksek) düzeydedir\.?/giu,
    replace: (_match, level: string) => confidenceSentence(level),
  },
  {
    id: "CLINICAL_MONITORING_DIRECT",
    pattern: /([^.!?]{3,140}? alanındaki güçlük) günlük yaşam açısından izlenecek ilk alanı oluşturuyor\.?/giu,
    replace: (_match, area: string) => `Günlük yaşamda öncelikli klinik bulgu, ${area.trim().toLocaleLowerCase("tr-TR")}.`,
  },
  {
    id: "UNCERTAIN_MONITORING_DIRECT",
    pattern: /Öncelik sırası, işlevsel bilgiler netleştikçe yeniden değerlendirilebilir\.?/giu,
    replace: "Günlük yaşama ilişkin işlevsel bilgiler arttıkça klinik yorum yeniden değerlendirilmelidir.",
  },
  {
    id: "OWNER_OBSERVATION_FRAME_DIRECT",
    pattern: /Bilgi kaynakları birlikte değerlendirilirken özellikle ebeveyn ve öğretmen gözlemlerini çocuğun okupasyonel performansıyla ilişkilendirmek açısından yararlı olabilir\.?/giu,
    replace: "DNA'nın kavramsal çerçevesinde ebeveyn ve öğretmen gözlemleri, çocuğun okupasyonel performansıyla birlikte değerlendirilir.",
  },
  {
    id: "OWNER_NON_MATERIAL_THEORY_EXCLUSION",
    pattern: /Owner-book kaynaklı genel yorum sınırı olarak klinik açıdan prenatal öykü değerlidir; ancak tek başına tanısal veya açıklayıcı değildir\.?/giu,
    replace: "DNA'nın kavramsal çerçevesinde tek bir öykü bilgisi, tek başına tanısal veya açıklayıcı değildir.",
  },
  {
    id: "OWNER_PREFIX_DIRECT",
    pattern: /Bilgi kaynakları birlikte değerlendirilirken\s+/giu,
    replace: "DNA'nın kavramsal çerçevesinde ",
  },
  {
    id: "FINDING_PREFIX_DIRECT",
    pattern: /Mevcut bulgular açıklanırken\s+/giu,
    replace: "",
  },
  {
    id: "FIRST_REACTION_DIRECT",
    pattern: /Fizyolojik regülasyon bulgularının günlük yaşamdaki anlamı değerlendirilirken, fizyolojik düzenleme açısından bebeğin ilk tepkisinin şiddeti yalnız başına yeterli bilgi sağlamaz\.?/giu,
    replace: "Bir uyarana verilen ilk tepkinin şiddeti, fizyolojik regülasyonu anlamak için tek başına yeterli değildir.",
  },
])

function semanticConcepts(text: string) {
  return new Set(SPECIFICITY_CONCEPTS.filter(([, pattern]) => pattern.test(text)).map(([id]) => id))
}

function confidenceLevels(text: string) {
  return unique(["düşük", "orta", "orta-yüksek", "yüksek"].filter((level) => new RegExp(`(?:güven[^.!?]{0,35}${level}|${level}[^.!?]{0,35}güven)`, "iu").test(text)))
}

function certaintySignature(text: string) {
  return Object.freeze({
    definiteAbsence: /(?:belirgin .*güçlü[ğk]ü? (?:yok|saptanmadı|bildirilmedi)|güçlük yok|etkilenme yok)/iu.test(text),
    preserved: /(?:korunmuş|yaşa uygun|daha iyi performans)/iu.test(text),
    uncertainty: /(?:\p{L}+(?:abilir|ebilir)|sınırlı|yeterli değil|söylenem|temkinli|düşündürüyor)/iu.test(text),
    confidence: Object.freeze(confidenceLevels(text)),
  })
}

function planContext(plan: LockedReportPlan, sectionId: ReportSectionId, beforeClaimIds: readonly string[]) {
  const claimMap = new Map(plan.claims.map((claim) => [claim.id, claim]))
  const claims = beforeClaimIds.map((id) => claimMap.get(id)).filter(Boolean) as LockedReportPlan["claims"][number][]
  const selectedByClaim = new Map(plan.knowledgeBridge.selectedAtoms.map((atom) => [atom.claimId, atom]))
  const evidenceDomainText = claims.flatMap((claim) => claim.evidenceIds).map((id) => ({
    physiological: "fizyolojik regülasyon",
    sensory: "duyusal regülasyon",
    emotional: "duygusal regülasyon",
    cognitive: "bilişsel regülasyon",
    executive: "yürütücü işlev",
    interoception: "interosepsiyon",
  }[id.replace(/^evidence\.domain\./u, "")])).filter(Boolean).join(" ")
  return Object.freeze({
    allowedText: [claims.map((claim) => claim.text).join(" "), evidenceDomainText].filter(Boolean).join(" "),
    materiality: Object.freeze(unique(claims.map((claim) => claim.materiality)) as ReportMateriality[]),
    knowledgeClinicalMateriality: Object.freeze(unique(beforeClaimIds.map((id) => selectedByClaim.get(id)?.clinicalMateriality).filter(Boolean)) as Exclude<ReportClinicalMateriality, "NON_MATERIAL">[]),
  })
}

export function auditPlainClinicalRewriteRecord(input: Readonly<{
  plan: LockedReportPlan
  sectionId: ReportSectionId
  beforeClaimIds: readonly string[]
  before: string
  afterSentence: string
  ruleIds: readonly string[]
}>): PlainClinicalRewriteRecord {
  const context = planContext(input.plan, input.sectionId, input.beforeClaimIds)
  const allowedText = `${input.before} ${context.allowedText}`.trim()
  const beforeConcepts = semanticConcepts(allowedText)
  const afterConcepts = semanticConcepts(input.afterSentence)
  const newConcepts = [...afterConcepts].filter((concept) => !beforeConcepts.has(concept))
  const newInterventionDetail = newConcepts.some((concept) => INTERVENTION_CONCEPTS.has(concept))
  const beforeCertainty = certaintySignature(input.before)
  const afterCertainty = certaintySignature(input.afterSentence)
  const newDefiniteAbsence = afterCertainty.definiteAbsence && !beforeCertainty.definiteAbsence
  const certaintyChanged = newDefiniteAbsence
    || ((beforeCertainty.confidence.length > 0 || afterCertainty.confidence.length > 0) && !sameSet(beforeCertainty.confidence, afterCertainty.confidence))
  const semanticStrengthening = newDefiniteAbsence
    || (/desteğe duyarlı olabilir/iu.test(input.before) && /(?:görsel sıra|kısa hatırlatma|kesinlikle|mutlaka)/iu.test(input.afterSentence))
  const newSpecificity = newConcepts.length > 0
  const afterNumbers: string[] = input.afterSentence.match(/\b\d+(?:[.,]\d+)?\b/gu) ?? []
  const allowedNumbers: string[] = allowedText.match(/\b\d+(?:[.,]\d+)?\b/gu) ?? []
  const numberPreserved = afterNumbers.every((value) => allowedNumbers.includes(value))
  const afterTerms = PROTECTED_TERMS.filter((term) => input.afterSentence.toLocaleLowerCase("tr-TR").includes(term))
  const allowedTerms = PROTECTED_TERMS.filter((term) => allowedText.toLocaleLowerCase("tr-TR").includes(term))
  const termsSupported = afterTerms.every((term) => allowedTerms.includes(term))
  const preservedMeaning = numberPreserved && termsSupported && !semanticStrengthening && !newSpecificity && !certaintyChanged
  return Object.freeze({
    sectionId: input.sectionId,
    before: input.before.trim(),
    after: input.afterSentence.trim(),
    afterSentence: input.afterSentence.trim(),
    beforeClaimIds: Object.freeze([...input.beforeClaimIds]),
    materiality: context.materiality,
    knowledgeClinicalMateriality: context.knowledgeClinicalMateriality,
    preservedMeaning,
    semanticStrengthening,
    newSpecificity,
    newInterventionDetail,
    certaintyChanged,
    repairReason: input.ruleIds.join("+"),
    ruleIds: Object.freeze([...input.ruleIds]),
  })
}

function recordRewrite(plan: LockedReportPlan, sectionId: ReportSectionId, beforeClaimIds: readonly string[], before: string, after: string, ruleIds: readonly string[], records: PlainClinicalRewriteRecord[]) {
  const afterRows = sentences(after)
  if (!afterRows.length) {
    records.push(Object.freeze({
      sectionId,
      before: before.trim(),
      after: "",
      afterSentence: "",
      beforeClaimIds: Object.freeze([...beforeClaimIds]),
      materiality: planContext(plan, sectionId, beforeClaimIds).materiality,
      knowledgeClinicalMateriality: planContext(plan, sectionId, beforeClaimIds).knowledgeClinicalMateriality,
      preservedMeaning: true,
      semanticStrengthening: false,
      newSpecificity: false,
      newInterventionDetail: false,
      certaintyChanged: false,
      repairReason: ruleIds.join("+"),
      ruleIds: Object.freeze([...ruleIds]),
    }))
    return
  }
  for (const afterSentence of afterRows) records.push(auditPlainClinicalRewriteRecord({ plan, sectionId, beforeClaimIds, before, afterSentence, ruleIds }))
}

function formatTurkishList(values: readonly string[]) {
  if (values.length <= 1) return values[0] ?? ""
  if (values.length === 2) return `${values[0]} ve ${values[1]}`
  return `${values.slice(0, -1).join(", ")} ve ${values.at(-1)}`
}

function applyBalancedAlternativeClarity(plan: LockedReportPlan, text: string, sectionId: ReportSectionId, beforeClaimIds: readonly string[], records: PlainClinicalRewriteRecord[]) {
  const pattern = /Self-regülasyon alanlarında korunmuş performans değerlendirildi, ancak diğer bulgular kadar güçlü desteklenmedi\.?/giu
  if (!pattern.test(text)) return text
  pattern.lastIndex = 0
  const claimMap = new Map(plan.claims.map((claim) => [claim.id, claim]))
  const alternative = beforeClaimIds.map((id) => claimMap.get(id)).find((claim) => claim?.role === "ALTERNATIVE" && /korunmuş ve dengeli/iu.test(claim.text))
  const labels: Readonly<Record<string, string>> = Object.freeze({
    physiological: "Fizyolojik regülasyon",
    sensory: "duyusal regülasyon",
    emotional: "duygusal regülasyon",
    cognitive: "bilişsel regülasyon",
    executive: "yürütücü işlev",
    interoception: "interosepsiyon",
  })
  const domains = unique((alternative?.evidenceIds ?? []).flatMap((id) => {
    const key = id.match(/^evidence\.domain\.(.+)$/u)?.[1]
    return key && labels[key] ? [key] : []
  })).filter((key) => !beforeClaimIds
    .map((id) => claimMap.get(id))
    .some((claim) => claim?.id !== alternative?.id
      && claim?.role === "ALTERNATIVE"
      && claim.formulationId === `domain_${key}`))
    .map((key) => labels[key]!)
  return text.replace(pattern, (before) => {
    const after = domains.length
      ? `Self-regülasyon değerlendirmesinde, ${formatTurkishList(domains).toLocaleLowerCase("tr-TR")} ${domains.length === 1 ? "alanındaki becerinin" : "alanlarındaki becerilerin"} görece korunduğunu düşündüren bulgular bulunuyor. Ancak bu güçlü yönler, çocuğun self-regülasyon performansının tamamını açıklamak için yeterli değildir.`
      : ""
    recordRewrite(plan, sectionId, beforeClaimIds, before, after, ["BALANCED_ALTERNATIVE_CLARITY"], records)
    return after
  })
}

function applyRule(plan: LockedReportPlan, text: string, sectionId: ReportSectionId, beforeClaimIds: readonly string[], rule: RewriteRule, records: PlainClinicalRewriteRecord[]) {
  rule.pattern.lastIndex = 0
  return text.replace(rule.pattern, (...args: unknown[]) => {
    const match = String(args[0] ?? "")
    const groups = args.slice(1, -2).map(String)
    const after = typeof rule.replace === "function" ? rule.replace(match, ...groups) : rule.replace
    if (normalized(match) !== normalized(after)) recordRewrite(plan, sectionId, beforeClaimIds, match, after, [rule.id], records)
    return after
  })
}

function semanticDomain(text: string) {
  if (/duyusal|uyaran|işitsel|dokun/iu.test(text)) return "sensory"
  if (/yürütücü|çok basamaklı|çok adımlı/iu.test(text)) return "executive"
  if (/duygusal|sakinleş|engellen|beklenmedik/iu.test(text)) return "emotional"
  if (/fizyolojik|uyku|enerji|toparlanma/iu.test(text)) return "physiological"
  if (/bilişsel|çalışma belleği|sözel bilgi/iu.test(text)) return "cognitive"
  if (/interosep|beden sinyali|açlık|susuzluk|tuvalet/iu.test(text)) return "interoception"
  return "general"
}

function semanticRole(text: string) {
  if (/bakım veren/iu.test(text)) return "caregiver"
  if (/terapist/iu.test(text)) return "therapist"
  if (/DNA'nın kavramsal çerçevesi/iu.test(text)) return "science"
  if (/destek verildiğinde|ortama ve verilen desteğe/iu.test(text)) return "context"
  if (/sınırlı|söylenem|yeterli değil/iu.test(text)) return "limitation"
  if (!/alanındaki bulgular/iu.test(text) && /(?:etkinliğe katıl|sakinleş|bilgiyi işle|beden sinyali|günlük ritim|çok basamaklı)/iu.test(text)) return "functional"
  return "finding"
}

function semanticProposition(text: string) {
  if (/daha iyi performans|daha kolay|değişebiliyor/iu.test(text)) return "context-performance"
  if (/sınırlı|söylenem|yeterli değil/iu.test(text)) return "limitation"
  if (/zorlan|güçlük|desteğe ihtiyaç/iu.test(text)) return "difficulty"
  if (/korunmuş|yaşa uygun|beceriler[^.!?]{0,50}sürdüğ/iu.test(text)) return "preserved"
  return "explanation"
}

function semanticMicroKey(text: string) {
  return `${semanticDomain(text)}|${semanticRole(text)}|${semanticProposition(text)}`
}

function deduplicateSentences(plan: LockedReportPlan, text: string, sectionId: ReportSectionId, beforeClaimIds: readonly string[], records: PlainClinicalRewriteRecord[]) {
  const rows = sentences(text)
  const exactSeen = new Set<string>()
  const semanticSeen = new Set<string>()
  const kept: string[] = []
  for (const sentence of rows) {
    const exactKey = normalized(sentence)
    const semanticKey = sectionId === "section_3" ? semanticMicroKey(sentence) : ""
    const exactRepeat = exactKey.length >= 35 && exactSeen.has(exactKey)
    const semanticRepeat = sectionId === "section_3" && semanticDomain(sentence) !== "general" && semanticProposition(sentence) !== "explanation" && semanticSeen.has(semanticKey)
    if (exactRepeat || semanticRepeat) {
      recordRewrite(plan, sectionId, beforeClaimIds, sentence, "", [semanticRepeat ? "SEMANTIC_MICRO_REPETITION" : "EXACT_SENTENCE_ECONOMY"], records)
      continue
    }
    exactSeen.add(exactKey)
    if (sectionId === "section_3" && semanticDomain(sentence) !== "general") semanticSeen.add(semanticKey)
    kept.push(sentence)
  }
  return kept.join(" ")
}

function reconcileGenericRelationLanguage(plan: LockedReportPlan, text: string, sectionId: ReportSectionId, beforeClaimIds: readonly string[], records: PlainClinicalRewriteRecord[]) {
  const rows = sentences(text)
  const convergenceIndex = rows.findIndex((sentence) => GENERIC_CONVERGENCE.test(sentence))
  const discrepancyIndex = rows.findIndex((sentence) => GENERIC_DISCREPANCY.test(sentence))
  if (convergenceIndex < 0 || discrepancyIndex < 0) return text
  const before = `${rows[convergenceIndex]} ${rows[discrepancyIndex]}`
  const after = /Bakım veren bildirimi, klinik gözlem ve ölçüm bulguları/iu.test(rows[convergenceIndex]!)
    ? "Bakım veren bildirimi, klinik gözlem ve ölçüm sonuçları birlikte değerlendirilmiştir; ancak bu kaynakların tümü aynı yönde değildir. Bu fark yorumun kesinliğini azaltır."
    : "Bilgi kaynakları birlikte değerlendirilmiştir; ancak sonuçların tümü aynı yönde değildir. Bu fark yorumun kesinliğini azaltır."
  recordRewrite(plan, sectionId, beforeClaimIds, before, after, ["SOURCE_RELATION_CLARITY"], records)
  return rows.flatMap((sentence, index) => index === convergenceIndex ? sentences(after) : index === discrepancyIndex ? [] : [sentence]).join(" ")
}

const HUMAN_EDITOR_DOMAINS = Object.freeze([
  Object.freeze({ key: "physiological", label: "fizyolojik regülasyon", finding: /fizyolojik regülasyon alanındaki bulgular/iu, caregiver: /bakım veren[^.!?]*fizyolojik regülasyon alanında/iu }),
  Object.freeze({ key: "sensory", label: "duyusal regülasyon", finding: /duyusal regülasyon alanındaki bulgular/iu, caregiver: /bakım veren[^.!?]*duyusal regülasyon alanında/iu }),
  Object.freeze({ key: "emotional", label: "duygusal regülasyon", finding: /duygusal regülasyon alanındaki bulgular/iu, caregiver: /bakım veren[^.!?]*duygusal regülasyon alanında/iu }),
  Object.freeze({ key: "cognitive", label: "bilişsel regülasyon", finding: /bilişsel regülasyon alanındaki bulgular/iu, caregiver: /bakım veren[^.!?]*bilişsel (?:regülasyon|düzenleme) alanında/iu }),
  Object.freeze({ key: "executive", label: "yürütücü işlev", finding: /yürütücü işlev alanındaki bulgular/iu, caregiver: /bakım veren[^.!?]*yürütücü işlevler? alanında/iu }),
  Object.freeze({ key: "interoception", label: "interosepsiyon", finding: /interosepsiyon alanındaki bulgular/iu, caregiver: /bakım veren[^.!?]*(?:interosepsiyon|interoseptif farkındalık) alanında/iu }),
])

function sourceMeaningRole(sentence: string) {
  for (const domain of HUMAN_EDITOR_DOMAINS) {
    if (domain.finding.test(sentence) && /günlük yaşam güçlüğü/iu.test(sentence)) return Object.freeze({ domain, role: "finding" as const })
    if (domain.caregiver.test(sentence) && /günlük yaşam güçlüğü/iu.test(sentence)) return Object.freeze({ domain, role: "caregiver" as const })
  }
  return null
}

function mergeAdjacentSourceMeaning(plan: LockedReportPlan, text: string, sectionId: ReportSectionId, beforeClaimIds: readonly string[], records: PlainClinicalRewriteRecord[]) {
  if (sectionId !== "section_3") return text
  const rows = sentences(text)
  const output: string[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const current = sourceMeaningRole(rows[index]!)
    const next = index + 1 < rows.length ? sourceMeaningRole(rows[index + 1]!) : null
    if (current && next && current.domain.key === next.domain.key && current.role !== next.role) {
      const before = `${rows[index]} ${rows[index + 1]}`
      const after = `Bakım verenin günlük yaşamda bildirdiği güçlükler, ${current.domain.label} bulgularıyla aynı yöndedir.`
      recordRewrite(plan, sectionId, beforeClaimIds, before, after, ["HUMAN_SOURCE_FINDING_MERGE"], records)
      output.push(after)
      index += 1
      continue
    }
    output.push(rows[index]!)
  }
  return output.join(" ")
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}

function formatLiteratureForHumanEditor(plan: LockedReportPlan, text: string, sectionId: ReportSectionId, beforeClaimIds: readonly string[], records: PlainClinicalRewriteRecord[]) {
  if (sectionId !== "section_8") return text
  if (/\bKaynaklar:/iu.test(text)) {
    const [body, sourceBlock = ""] = text.split(/\bKaynaklar:/iu, 2)
    const sources = sourceBlock.split(/\s+-\s+(?=[A-ZÇĞİÖŞÜ])/u).map((source) => source.replace(/^\s*-\s*/u, "").trim()).filter(Boolean)
    return `${body.trim()}\n\nKaynaklar:\n${sources.map((source) => `- ${source}`).join("\n")}`
  }
  const claimMap = new Map(plan.claims.map((claim) => [claim.id, claim]))
  const externalClaims = beforeClaimIds.map((id) => claimMap.get(id)).filter((claim) => claim?.claimType === "GENERAL_SCIENTIFIC_INTERPRETATION") as LockedReportPlan["claims"][number][]
  const bibliography: string[] = []
  let edited = text
  let matchedSourceLanguage = false
  for (const claim of externalClaims) {
    const source = claim.text.match(/Kaynak:\s*(.+)$/su)?.[1]?.trim()
    if (source) {
      const sourceMarker = `Kaynak: ${source}`
      if (edited.includes(sourceMarker)) {
        bibliography.push(source)
        edited = edited.split(sourceMarker).join("")
        matchedSourceLanguage = true
      }
    }
    const citation = claim.text.match(/Bu genel bilimsel çerçeve \(([^)]+)\) kaynağıyla/iu)?.[1]?.trim()
    if (!citation) continue
    const escaped = escapeRegExp(citation)
    const beforeCitationEdit = edited
    edited = edited
      .replace(new RegExp(`([.!?])\\s*Bu açıklama ${escaped} kaynağına dayanmaktadır\\.?`, "giu"), ` (${citation}).`)
      .replace(new RegExp(`([.!?])\\s*Bu genel bilimsel çerçeve \\(${escaped}\\) kaynağıyla sınırlı olarak desteklenmektedir\\.?`, "giu"), ` (${citation}).`)
    if (edited !== beforeCitationEdit) matchedSourceLanguage = true
  }
  if (!matchedSourceLanguage) return text
  const sources = unique(bibliography)
  if (!sources.length) return edited
  edited = edited.replace(/[ \t]+/gu, " ").replace(/\s+([,.;:!?])/gu, "$1").trim()
  const after = `${edited}\n\nKaynaklar:\n${sources.map((source) => `- ${source}`).join("\n")}`
  if (normalized(after) !== normalized(text)) recordRewrite(plan, sectionId, beforeClaimIds, text, after, ["HUMAN_LITERATURE_CITATION_LAYOUT"], records)
  return after
}

export function humanClinicalEditorDiagnostics(realization: ReportRealization) {
  let semanticParagraphRepetitionCount = 0
  let systemLikeProseCount = 0
  for (const section of realization.sections) {
    if (section.sectionId === "section_2") continue
    systemLikeProseCount += count(section.text, HUMAN_EDITOR_SYSTEM_PROSE)
    const rows = sentences(section.text)
    for (let index = 0; index + 1 < rows.length; index += 1) {
      const current = sourceMeaningRole(rows[index]!)
      const next = sourceMeaningRole(rows[index + 1]!)
      if (current && next && current.domain.key === next.domain.key && current.role !== next.role) semanticParagraphRepetitionCount += 1
    }
  }
  return Object.freeze({ semanticParagraphRepetitionCount, systemLikeProseCount })
}

function signature(text: string) {
  const lower = text.toLocaleLowerCase("tr-TR")
  const terms = PROTECTED_TERMS.filter((term) => lower.includes(term))
  return Object.freeze({
    numbers: Object.freeze(text.match(/\b\d+(?:[.,]\d+)?\b/gu) ?? []),
    terms: Object.freeze(terms),
    difficulty: /(?:zorlan|güçlü[ğk]|desteğe ihtiyaç|sürdürem|geç fark)/iu.test(text),
    preserved: /(?:korun|yaşa uygun|daha iyi performans|beceriler[^.!?]{0,50}sürdüğ)/iu.test(text),
    uncertainty: /(?:sınırlı|yeterli (?:değil(?:dir)?|bilgi yok|bilgi sağlamaz)|temkinli|söylenem|kesinliğini azalt|farklı olasılık|değerlendirilemedi|yorumlanmasını sınırlar|daha güçlü değildi)/iu.test(text),
    discrepancy: /(?:aynı yönde değil|ayrış|uyumsuz|farklı yönde|yalnız puana dayalı)/iu.test(text),
    caregiver: /(?:bakım veren|bakımveren)/iu.test(text),
    therapist: /terapist/iu.test(text),
    confidence: Object.freeze(confidenceLevels(text)),
  })
}

function sameSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((entry) => right.includes(entry))
}

export function validatePlainClinicalMeaning(before: ReportRealization, after: ReportRealization, plan?: LockedReportPlan) {
  const afterById = new Map(after.sections.map((section) => [section.sectionId, section]))
  const driftSections: ReportSectionId[] = []
  for (const section of before.sections) {
    const rewritten = afterById.get(section.sectionId)
    if (!rewritten || !sameSet(section.usedClaimIds, rewritten.usedClaimIds)) {
      driftSections.push(section.sectionId)
      continue
    }
    const left = signature(section.text)
    const right = signature(rewritten.text)
    const allowedTerms = plan
      ? PROTECTED_TERMS.filter((term) => planContext(plan, section.sectionId, section.usedClaimIds).allowedText.toLocaleLowerCase("tr-TR").includes(term))
      : left.terms
    const protectedTermsPreserved = left.terms.every((term) => right.terms.includes(term))
      && right.terms.every((term) => left.terms.includes(term) || allowedTerms.includes(term))
    const meaningPreserved = sameSet(left.numbers, right.numbers)
      && protectedTermsPreserved
      && (!left.difficulty || right.difficulty)
      && (!left.preserved || right.preserved)
      && (!left.uncertainty || right.uncertainty)
      && (!left.discrepancy || right.discrepancy)
      && left.caregiver === right.caregiver
      && left.therapist === right.therapist
      && sameSet(left.confidence, right.confidence)
    if (!meaningPreserved) driftSections.push(section.sectionId)
  }
  return Object.freeze({ pass: driftSections.length === 0, meaningDriftCount: driftSections.length, meaningDriftSectionIds: Object.freeze(driftSections) })
}

export function plainClinicalLanguageDiagnostics(realization: ReportRealization) {
  let nominalizationOverloadCount = 0
  let abstractClinicalLanguageCount = 0
  let unclearAgentCount = 0
  let unclearDailyLifeMeaningCount = 0
  let plainTurkishGrammarErrorCount = 0
  for (const section of realization.sections) {
    if (section.sectionId !== "section_2") {
      nominalizationOverloadCount += count(section.text, NOMINALIZATION)
      abstractClinicalLanguageCount += count(section.text, ABSTRACT_CLINICAL)
      unclearAgentCount += count(section.text, UNCLEAR_AGENT)
      plainTurkishGrammarErrorCount += count(section.text, PLAIN_GRAMMAR) + count(section.text, TRANSLATIONESE)
    }
    if (section.sectionId === "section_3") {
      unclearDailyLifeMeaningCount += sentences(section.text).filter((sentence) => /(?:işlevsel|günlük işlev|bulguların günlük yaşamdaki anlamı)/iu.test(sentence) && !DAILY_LIFE_CUE.test(sentence)).length
    }
  }
  return Object.freeze({
    nominalizationOverloadCount,
    abstractClinicalLanguageCount,
    unclearAgentCount,
    unclearDailyLifeMeaningCount,
    plainTurkishGrammarErrorCount,
    total: nominalizationOverloadCount + abstractClinicalLanguageCount + unclearAgentCount + unclearDailyLifeMeaningCount + plainTurkishGrammarErrorCount,
  })
}

export function humanReadabilityDiagnostics(realization: ReportRealization) {
  let grammarFragmentCount = 0
  let semanticContradictionCount = 0
  let awkwardGenericPhraseCount = 0
  for (const section of realization.sections) {
    if (section.sectionId === "section_2") continue
    grammarFragmentCount += count(section.text, /(?:DNA'nın kavramsal çerçevesi,|\bHttps:\/\/|(?:^|[.!?]\s+)(?:Ancak|Bununla birlikte)\s*(?:[.!?]|$))/gmu)
    awkwardGenericPhraseCount += count(section.text, AWKWARD_GENERIC_PHRASE)
    semanticContradictionCount += Number(GENERIC_CONVERGENCE.test(section.text) && GENERIC_DISCREPANCY.test(section.text))
  }
  return Object.freeze({ grammarFragmentCount, semanticContradictionCount, awkwardGenericPhraseCount })
}

export function semanticMicroRepetitionCount(realization: ReportRealization) {
  const section = realization.sections.find((entry) => entry.sectionId === "section_3")
  if (!section) return 0
  const seen = new Set<string>()
  let repeats = 0
  for (const sentence of sentences(section.text)) {
    if (semanticDomain(sentence) === "general" || semanticProposition(sentence) === "explanation") continue
    const key = semanticMicroKey(sentence)
    if (seen.has(key)) repeats += 1
    seen.add(key)
  }
  return repeats
}

export function plainClinicalRepetitionCount(realization: ReportRealization) {
  let repeats = 0
  for (const section of realization.sections) {
    const keys = sentences(section.text).map(normalized).filter((value) => value.length >= 35)
    repeats += keys.filter((key, index) => keys.indexOf(key) !== index).length
  }
  return repeats
}

export function latestMaterialityPipelineAssertion(plan: LockedReportPlan) {
  const selectedIds = new Set(plan.knowledgeBridge.selectedAtoms.map((atom) => atom.claimId))
  const ownerClaimIds = plan.claims.filter((claim) => claim.knowledgeAuthority === "OWNER_BOOK").map((claim) => claim.id)
  const selectedAtomKeys = new Set(plan.knowledgeBridge.selectedAtoms.map((atom) => `${atom.atomId}:${atom.sectionId}`))
  const nonMaterialKnowledgeRemovedBeforeRewrite = ownerClaimIds.every((id) => selectedIds.has(id))
    && plan.knowledgeBridge.relevanceDecisions.every((decision) => !selectedAtomKeys.has(`${decision.atomId}:${decision.sectionId}`) || decision.clinicalMateriality !== "NON_MATERIAL")
  return Object.freeze({
    latestMaterialityPipelineConfirmed: plan.version === "locked-report-plan@2.3"
      && plan.knowledgeBridge.version === "report-knowledge-bridge@2.3"
      && nonMaterialKnowledgeRemovedBeforeRewrite,
    nonMaterialKnowledgeRemovedBeforeRewrite,
  })
}

export function nonMaterialKnowledgeReentryCount(_plan: LockedReportPlan, realization: ReportRealization) {
  const finalText = realization.sections.map((section) => section.text).join(" ")
  return (finalText.match(NON_MATERIAL_THEORY) ?? []).length
}

export function rewritePlainClinicalTurkish(plan: LockedReportPlan, realization: ReportRealization): Readonly<{ realization: ReportRealization; summary: PlainClinicalTurkishSummary }> {
  const pipeline = latestMaterialityPipelineAssertion(plan)
  if (!pipeline.latestMaterialityPipelineConfirmed) throw new Error("report_v2_latest_materiality_pipeline_stop")
  const records: PlainClinicalRewriteRecord[] = []
  const sections = realization.sections.map((section) => {
    if (section.sectionId === "section_2") return section
    let text = section.text
    for (const rule of RULES) text = applyRule(plan, text, section.sectionId, section.usedClaimIds, rule, records)
    text = normalizeDnaReportLanguage(text)
      .replace(/([.!?])(?=\p{Lu})/gu, "$1 ")
      .replace(/(^|[.!?]\s+)([a-zçğıöşü])/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("tr-TR")}`)
      .replace(/\bHttps:\/\//gu, "https://")
      .replace(/\bHttp:\/\//gu, "http://")
    text = reconcileGenericRelationLanguage(plan, text, section.sectionId, section.usedClaimIds, records)
    text = deduplicateSentences(plan, text, section.sectionId, section.usedClaimIds, records)
    text = mergeAdjacentSourceMeaning(plan, text, section.sectionId, section.usedClaimIds, records)
    text = formatLiteratureForHumanEditor(plan, text, section.sectionId, section.usedClaimIds, records)
    return Object.freeze({ ...section, text })
  })
  const rewritten = Object.freeze({ ...realization, sections: Object.freeze(sections) })
  const meaning = validatePlainClinicalMeaning(realization, rewritten, plan)
  const language = plainClinicalLanguageDiagnostics(rewritten)
  const semanticStrengtheningCount = records.filter((record) => record.semanticStrengthening).length
  const newSpecificityCount = records.filter((record) => record.newSpecificity).length
  const newInterventionDetailCount = records.filter((record) => record.newInterventionDetail).length
  const certaintyDriftCount = records.filter((record) => record.certaintyChanged).length
  return Object.freeze({
    realization: rewritten,
    summary: Object.freeze({
      version: PLAIN_CLINICAL_TURKISH_VERSION,
      latestMaterialityPipelineConfirmed: pipeline.latestMaterialityPipelineConfirmed,
      nonMaterialKnowledgeRemovedBeforeRewrite: pipeline.nonMaterialKnowledgeRemovedBeforeRewrite,
      rewriteCount: records.length,
      meaningDriftCount: meaning.meaningDriftCount + records.filter((record) => !record.preservedMeaning).length,
      meaningDriftSectionIds: Object.freeze(unique([...meaning.meaningDriftSectionIds, ...records.filter((record) => !record.preservedMeaning).map((record) => record.sectionId)])),
      semanticStrengtheningCount,
      newSpecificityCount,
      newInterventionDetailCount,
      certaintyDriftCount,
      nonMaterialKnowledgeReentryCount: nonMaterialKnowledgeReentryCount(plan, rewritten),
      semanticMicroRepetitionCount: semanticMicroRepetitionCount(rewritten),
      plainTurkishGrammarErrorCount: language.plainTurkishGrammarErrorCount,
      records: Object.freeze(records),
    }),
  })
}
