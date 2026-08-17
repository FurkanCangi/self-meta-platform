import type { LockedReportPlan, ReportClaim, ReportSectionId } from "./contracts"

export const DNA_REPORT_LANGUAGE_CONTRACT_VERSION = "dna-report-language-contract@2-clinical-materiality" as const

const TERMINOLOGY_DRIFT = /öz[-\s]?düzenleme/giu
const ACADEMIC_LANGUAGE = /(?:formülasyon odağı|formülasyon güveni açısından|bu görünüm|klinik eksen|klinik örünt\p{L}*|örüntü kapsamında|ayrışma kümesi|bağımsız bilgi kanalı|örüntünün kapsamı|\byakınsama(?:sı|si|su|sü)?\b|\bkorunmuş kapasite\b|işlevsel eksende|vaka bağlamında işlevsel dikkat gerektirir|en güçlü desteklenen klinik örünt\p{L}*)/giu
const INTERNAL_ENGINE_JARGON = /(?:clinical discrepancy cluster|bağımsız klinik ayrışma kümesi|independent information channel|bağımsız bilgi kanalı|candidate formulation|aday formülasyon|decision state|karar durumu|evidence node|kanıt düğümü|relation edge|ilişki kenarı|claim id|locked report plan|locked clinical decision|evidence threshold|information channel)/giu
const SYSTEM_LIKE_LANGUAGE = /(?:mevcut adaylardan hiçbiri|kabul eşiğ\p{L}*|bağımsız kanıt koşulu|ana açıklama olarak yeterli destek bulma\p{L}*|Bu bulgular,? rapordaki önceliği değiştirmek için yeterli değildir|Bu sonuca duyulan güven[^.!?]*düzeydedir|alanındaki becerilerin korunduğunu gösteren bulgular vardır|günlük yaşam açısından izlenecek ilk alanı oluşturuyor|Öncelik sırası,? işlevsel bilgiler netleştikçe yeniden değerlendirilebilir|\bcandidate\b|\bdecision state\b|\bevidence threshold\b|\binformation channel\b)/giu
const INTERNAL_LABEL = /\b(?:OWNER_BOOK_INTERPRETATION|GENERAL_SCIENTIFIC_INTERPRETATION|CASE_EVIDENCE|CLAIM|LOCKED|PRIMARY|DECISION_STATE|EVIDENCE_NODE)\b/g
const BROKEN_SUFFIX = /\b\p{L}+(?:mektedir|maktadır)\.(?:n|d)\p{L}*\b/giu
const DUPLICATE_SUFFIX = /(?:\b\p{L}+(?:(?:mektedir|maktadır)(?:dır|dir|dur|dür|tır|tir|tur|tür)|(?:dır|dir|dur|dür|tır|tir|tur|tür){2})\b|düzeydedir\s+güven düzeyiyle|güven düzeyi[^.!?]{0,30}düzeydedir)/giu
const SENTENCE_MERGE_ERROR = /\p{L}{3,}[.!?](?:n|d)[a-zçğıöşü]{2,}/giu
const BROKEN_WORD = /(?:\b(?:bilginda|bilgında|değerlendirmendedir|değerlendirmendedır|yorumlanmaktadırdır|yorumlanmaktadirdir|bulguyü|bulguyle|\p{L}+masıktadır)\b|uyarandan\s+ardından|bulgular\s+betimler|hesaplandı\s+sınıfındadır|değiştiğini\.\s+Toparlanma)/giu
const REPEATED_TEMPLATE_PHRASES = Object.freeze([
  /Bu kararın sınırları açısından/giu,
  /Günlük yaşamdaki diğer etkiler açısından/giu,
  /Bulguların ilişkisi açısından ayrıca/giu,
  /Kurum içi kaynağa göre/giu,
  /kapasite korunmuştur/giu,
  /Bulgular birlikte ele alındığında/giu,
  /Bu yoruma duyulan güven/giu,
  /Bulguların birbiriyle ilişkisi değerlendirildiğinde/giu,
  /Öncelik sırasına göre/giu,
  /Kurum içi kaynak ve dış bilimsel kaynaklar ayrı değerlendirildiğinde/giu,
])
const SECTION_2_THRESHOLD_SENTENCE = /(?:Bu sınıflama alana ve yaş bandına özgü eşik üzerinden hesaplanmıştır|Alan sınıflamaları yaşa ve ilgili alana özgü eşiklere göre hesaplanmıştır)/giu

export const REPORT_LEXICAL_QA_TERMS = Object.freeze([
  "formülasyon",
  "örüntü",
  "görünüm",
  "odağı",
  "yakınsama",
  "korunmuş kapasite",
  "eksen",
] as const)

export type ReportLexicalQaTerm = typeof REPORT_LEXICAL_QA_TERMS[number]
export type ReportLexicalQaCounts = Readonly<Record<ReportLexicalQaTerm, number>>

const FORMULATION_SENTENCES: Readonly<Record<string, string>> = Object.freeze({
  domain_physiological: "Bulgular en çok fizyolojik regülasyon alanındaki güçlüğü destekliyor.",
  domain_sensory: "Bulgular en çok duyusal regülasyon alanındaki güçlüğü destekliyor.",
  domain_emotional: "Bulgular en çok duygusal regülasyon ve toparlanma alanındaki güçlüğü destekliyor.",
  domain_cognitive: "Bulgular en çok bilişsel regülasyon alanındaki güçlüğü destekliyor.",
  domain_executive: "Bulgular en çok yürütücü işlev alanındaki güçlüğü destekliyor.",
  domain_interoception: "Bulgular en çok interosepsiyon alanındaki güçlüğü destekliyor.",
  motor_praxis: "Bulgular en çok motor planlama ve beden organizasyonu alanındaki güçlüğü destekliyor.",
  adaptive_daily_living: "Bulgular en çok günlük yaşam ve öz bakım alanındaki güçlüğü destekliyor.",
  social_pragmatic: "Bulgular en çok sosyal-pragmatik esneklik alanındaki güçlüğü destekliyor.",
  language_communication: "Bulgular en çok dilsel talep ve sözel işleme alanındaki güçlüğü destekliyor.",
  language_social_pragmatic: "Bulgular en çok dilsel ve sosyal-pragmatik taleplerle ilişkili güçlüğü destekliyor.",
  physiological_interoceptive: "Bulgular en çok fizyolojik regülasyon, toparlanma ve interosepsiyon alanlarındaki güçlüğü destekliyor.",
  selective_interoception: "Bulgular en çok belirli interosepsiyon sinyallerini fark etme alanındaki güçlüğü destekliyor.",
  evidence_limited_mixed: "Bulgular tek bir alanı öne çıkarmıyor; farklı açıklamalar için kanıt sınırlı.",
  balanced: "Bulgular self-regülasyon alanlarında genel olarak yaşa uygun bir performans gösteriyor.",
  multi_domain: "Bulgular birden fazla self-regülasyon alanında birlikte güçlük olduğunu gösteriyor.",
})

const FORMULATION_AREAS: Readonly<Record<string, string>> = Object.freeze({
  domain_physiological: "fizyolojik regülasyon alanındaki güçlük",
  domain_sensory: "duyusal regülasyon alanındaki güçlük",
  domain_emotional: "duygusal regülasyon ve toparlanma alanındaki güçlük",
  domain_cognitive: "bilişsel regülasyon alanındaki güçlük",
  domain_executive: "yürütücü işlev alanındaki güçlük",
  domain_interoception: "interosepsiyon alanındaki güçlük",
  motor_praxis: "motor planlama ve beden organizasyonu alanındaki güçlük",
  adaptive_daily_living: "günlük yaşam ve öz bakım alanındaki güçlük",
  social_pragmatic: "sosyal-pragmatik esneklik alanındaki güçlük",
  language_communication: "dilsel talep ve sözel işleme alanındaki güçlük",
  language_social_pragmatic: "dilsel ve sosyal-pragmatik taleplerle ilişkili güçlük",
  physiological_interoceptive: "fizyolojik regülasyon, toparlanma ve interosepsiyon alanlarındaki güçlük",
  selective_interoception: "belirli interosepsiyon sinyallerini fark etme alanındaki güçlük",
  evidence_limited_mixed: "birden fazla alana yayılan ve kanıtı sınırlı güçlük",
  balanced: "self-regülasyon alanlarında korunmuş performans",
  multi_domain: "birden fazla self-regülasyon alanındaki güçlük",
})

const DOMAIN_LABELS: Readonly<Record<string, string>> = Object.freeze({
  physiological: "fizyolojik regülasyon",
  sensory: "duyusal regülasyon",
  emotional: "duygusal regülasyon",
  cognitive: "bilişsel regülasyon",
  executive: "yürütücü işlev",
  interoception: "interosepsiyon",
})

function countMatches(text: string, pattern: RegExp) {
  pattern.lastIndex = 0
  return text.match(pattern)?.length ?? 0
}

function normalized(text: string) {
  return text.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").replace(/\s+/gu, " ").trim()
}

function sentenceList(text: string) {
  return text.split(/(?<=[.!?])\s+|\n{2,}|;\s+/u).map((row) => row.trim()).filter(Boolean)
}

function lexicalQaCounts(text: string): ReportLexicalQaCounts {
  return Object.freeze({
    formülasyon: countMatches(text, /formülasyon\p{L}*/giu),
    örüntü: countMatches(text, /örüntü\p{L}*/giu),
    görünüm: countMatches(text, /görünüm\p{L}*/giu),
    odağı: countMatches(text, /odağı/giu),
    yakınsama: countMatches(text, /yakınsama(?:sı|si|su|sü)?/giu),
    "korunmuş kapasite": countMatches(text, /korunmuş kapasite/giu),
    eksen: countMatches(text, /eksen\p{L}*/giu),
  })
}

export function reportLanguageDiagnostics(text: string) {
  const lexicalQa = lexicalQaCounts(text)
  return Object.freeze({
    internalEngineJargonCount: countMatches(text, INTERNAL_ENGINE_JARGON),
    systemLikeLanguageCount: countMatches(text, SYSTEM_LIKE_LANGUAGE),
    internalLabelLeakageCount: countMatches(text, INTERNAL_LABEL),
    awkwardAcademicLanguageCount: countMatches(text, ACADEMIC_LANGUAGE),
    terminologyDriftCount: countMatches(text, TERMINOLOGY_DRIFT),
    brokenSuffixCount: countMatches(text, BROKEN_SUFFIX),
    duplicateSuffixCount: countMatches(text, DUPLICATE_SUFFIX),
    sentenceMergeErrorCount: countMatches(text, SENTENCE_MERGE_ERROR),
    brokenWordCount: countMatches(text, BROKEN_WORD),
    lexicalQa,
    artificialLexicalUsageCount: Object.values(lexicalQa).reduce((sum, value) => sum + value, 0),
  })
}

export function repeatedTemplatePhraseDiagnostics(text: string) {
  const counts = REPEATED_TEMPLATE_PHRASES.map((pattern) => countMatches(text, pattern))
  return Object.freeze({ total: counts.reduce((sum, count) => sum + count, 0), repeated: counts.reduce((sum, count) => sum + Math.max(0, count - 1), 0), counts: Object.freeze(counts) })
}

export function section2ThresholdSentenceCount(text: string) {
  return countMatches(text, SECTION_2_THRESHOLD_SENTENCE)
}

export function crossSectionRepetitionCount(sections: readonly Readonly<{ sectionId: ReportSectionId; text: string }>[]) {
  const sectionIdsBySentence = new Map<string, Set<ReportSectionId>>()
  for (const section of sections) {
    for (const sentence of sentenceList(section.text)) {
      const key = normalized(sentence)
      if (key.length < 35) continue
      const ids = sectionIdsBySentence.get(key) ?? new Set<ReportSectionId>()
      ids.add(section.sectionId)
      sectionIdsBySentence.set(key, ids)
    }
  }
  return [...sectionIdsBySentence.values()].filter((ids) => ids.size > 1).length
}

const SEMANTIC_STOP_WORDS = new Set([
  "ve", "ile", "bir", "bu", "şu", "için", "olarak", "göre", "daha", "en", "da", "de", "ise", "ancak", "birlikte",
  "ele", "alındığında", "değerlendirildiğinde", "açısından", "ayrıca", "sonuç", "olarak", "mevcut", "bulgular", "alanındaki",
])

function semanticTokens(text: string) {
  return new Set(normalized(text).split(" ").filter((token) => token.length >= 3 && !SEMANTIC_STOP_WORDS.has(token)))
}

function semanticContainment(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size < 4 || right.size < 4) return 0
  let overlap = 0
  for (const token of left) if (right.has(token)) overlap += 1
  return overlap / Math.min(left.size, right.size)
}

export function semanticCrossSectionRepeatDiagnostics(sections: readonly Readonly<{ sectionId: ReportSectionId; text: string }>[]) {
  const rows = sections.flatMap((section) => sentenceList(section.text).map((sentence) => Object.freeze({
    sectionId: section.sectionId,
    sentence,
    normalized: normalized(sentence),
    tokens: semanticTokens(sentence),
  }))).filter((row) => row.normalized.length >= 35)
  const repeatedSectionIds = new Set<ReportSectionId>()
  const pairs: Array<Readonly<{ firstSectionId: ReportSectionId; repeatedSectionId: ReportSectionId; similarity: number; firstSentence: string; repeatedSentence: string }>> = []
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    const left = rows[leftIndex]!
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const right = rows[rightIndex]!
      if (left.sectionId === right.sectionId) continue
      const similarity = left.normalized === right.normalized ? 1 : semanticContainment(left.tokens, right.tokens)
      if (similarity < 0.85) continue
      repeatedSectionIds.add(right.sectionId)
      pairs.push(Object.freeze({ firstSectionId: left.sectionId, repeatedSectionId: right.sectionId, similarity: Number(similarity.toFixed(3)), firstSentence: left.sentence, repeatedSentence: right.sentence }))
    }
  }
  return Object.freeze({
    count: pairs.length,
    repeatedSectionIds: Object.freeze([...repeatedSectionIds]),
    pairs: Object.freeze(pairs),
  })
}

export function semanticCrossSectionRepeatCount(sections: readonly Readonly<{ sectionId: ReportSectionId; text: string }>[]) {
  return semanticCrossSectionRepeatDiagnostics(sections).count
}

function cleanSourceFraming(text: string) {
  return text
    .replace(/^Owner-book kaynaklı genel kavramsal çerçevede\s*/iu, "")
    .replace(/^Owner-book kaynaklı genel yorum sınırı olarak\s*/iu, "")
    .replace(/^DNA\/owner-book bilgi çekirdeğindeki genel kavramsal çerçeve şu noktayı vurgular:\s*/iu, "")
    .replace(/\s*Bu kurum-içi kaynak dış bilimsel literatür kanıtı veya vaka kararı olarak kullanılmamıştır\.?$/iu, "")
    .trim()
}

function paraphraseOwnerContent(text: string) {
  const source = normalizeDnaReportLanguage(cleanSourceFraming(text))
  let paraphrase = source
    .replace(/yalnızca bebeğin ilk tepkisinin şiddetine bakmak yeterli değildir/giu, "bebeğin ilk tepkisinin şiddeti tek başına yeterli bilgi sağlamaz")
    .replace(/yalnızca “sınıfta dikkati dağınık” ifadesi/giu, "“Sınıfta dikkati dağınık” bilgisi tek başına")
    .replace(/yalnızca/giu, "sadece")
    .replace(/tek başına/giu, "yalnız başına")
    .replace(/ifade eder/giu, "anlamına gelir")
    .replace(/sınırlı bilgi verir/giu, "yeterli açıklama sağlamaz")
    .replace(/uyarandan (?:sonra|ardından) kalp hızının, hareketliliğin ve davranışın ne kadar sürede başlangıç durumuna döndüğü de önemlidir/giu, "uyaran sonrasında kalp hızı, hareketlilik ve davranışın başlangıç düzeyine dönme süresi de değerlendirilir")
    .replace(/kullanışlıdır/giu, "yararlı olabilir")
    .replace(/giderek daha fazla kullanmaktadır/giu, "daha sık ele almaktadır")
    .replace(/anlamına gelmez/giu, "sonucunu desteklemez")
    .replace(/interosepsiyon tek boyutlu bir “güçlü–zayıf” kapasite olarak değerlendirilmemelidir/giu, "interosepsiyon birden fazla bileşen içerir ve tek bir güçlü-zayıf çizgisiyle açıklanması yetersiz kalır")
    .replace(/değerlendirilmemelidir/giu, "tek bir ölçüte indirgenmesi yeterli değildir")
    .replace(/tanımlanmalıdır/giu, "tanımlanır")
    .replace(/incelenmelidir/giu, "değerlendirmede birlikte gözden geçirilir")
    .replace(/değerlendirilmelidir/giu, "birlikte ele alınır")
    .replace(/bulunmamaktadır/giu, "yoktur")
    .replace(/etkileyebilir/giu, "değiştirebilir")
    .replace(/göstermez/giu, "kanıtlamaz")
    .replace(/vurgular/giu, "öne çıkarır")
    .replace(/aynı süreç içinde rol oynar/giu, "birlikte değerlendirilir")
    .replace(/sağlarken/giu, "desteklerken")
    .replace(/yardım eder/giu, "katkıda bulunur")
    .replace(/katkı sağlar/giu, "destekler")
    .replace(/kaynaklanabilir/giu, "birlikte görülebilir")
    .replace(/birlikte düzenlenmelidir/giu, "birlikte planlanmalıdır")
  if (normalized(paraphrase) === normalized(source)) {
    const substitutions: readonly [RegExp, string][] = [
      [/\bancak\b/iu, "bununla birlikte"],
      [/\bveya\b/iu, "ya da"],
      [/\bsonra\b/iu, "ardından"],
      [/farklı/iu, "değişik"],
      [/\bbelirli\b/iu, "belli"],
      [/\bkonusunda\b/iu, "hakkında"],
      [/\bgöre\b/iu, "kıyasla"],
      [/\bilişkili\b/iu, "bağlantılı"],
      [/\bdeğerlendirme\b/iu, "yorum"],
      [/\bperformans\b/iu, "günlük işlev"],
      [/\bkapasite\b/iu, "beceri"],
      [/\bgelişimsel\b/iu, "gelişime ilişkin"],
      [/\bolarak\b/iu, "biçiminde"],
      [/\bbir\b/iu, "tek bir"],
    ]
    for (const [pattern, replacement] of substitutions) {
      if (!pattern.test(paraphrase)) continue
      paraphrase = paraphrase.replace(pattern, replacement)
      break
    }
  }
  if (normalized(paraphrase) === normalized(source)) {
    paraphrase = paraphrase
      .replace(/\bve\b/iu, "ile")
      .replace(/\bgibi\b/iu, "örneğin")
  }
  return paraphrase
}

export function normalizeDnaReportLanguage(text: string) {
  return text
    .replace(/desteklemektedir\.ndadır/giu, "destekliyor")
    .replace(/\bbilginda\b/giu, "bilgisinde")
    .replace(/\bbilgında\b/giu, "bilgisinde")
    .replace(/\bdeğerlendirmendedir\b/giu, "değerlendirmededir")
    .replace(/\bdeğerlendirmendedır\b/giu, "değerlendirmededir")
    .replace(/\byorumlanmaktadırdır\b/giu, "yorumlanıyor")
    .replace(/\byorumlanmaktadirdir\b/giu, "yorumlanıyor")
    .replace(/Yorumlanabilir dış değerlendirme bulunmadığı için bağımsız test yakınsaması değerlendirilemez\.?/giu, "Yorumlanabilir bir dış değerlendirme bulunmadığı için test sonuçlarının diğer bulgularla uyumu değerlendirilemedi.")
    .replace(/Mevcut adaylardan hiçbiri[^.!?]*[.!?]?/giu, "Mevcut bilgiler, tek bir alanı diğerlerinden daha güçlü biçimde öne çıkarmak için yeterli değildir.")
    .replace(/Mevcut adaylardan hiçbiri kabul eşiğ\p{L}* karşılam\p{L}*\.?/giu, "Mevcut bilgiler, tek bir alanı diğerlerinden daha güçlü biçimde öne çıkarmak için yeterli değildir.")
    .replace(/\bbağımsız kanıt koşulu\b/giu, "birden fazla bilgi kaynağıyla desteklenme koşulu")
    .replace(/\b(?:candidate|decision state|evidence threshold|information channel)\b/giu, "klinik değerlendirme")
    .replace(/yakınsamaktadır/giu, "aynı yöndedir")
    .replace(/yakınsamıyor/giu, "aynı yönde değildir")
    .replace(/uyarandan ardından/giu, "uyarandan sonra")
    .replace(/örüntülerinin/giu, "bulguların")
    .replace(/örüntülerini/giu, "bulgularını")
    .replace(/örüntüleri/giu, "bulgular")
    .replace(/örüntüsüyle/giu, "bulgusuyla")
    .replace(/örüntüyle/giu, "bulguyla")
    .replace(/örüntüyü/giu, "bulguyu")
    .replace(/örüntüsünün/giu, "bulgunun")
    .replace(/örüntüsünü/giu, "bulguyu")
    .replace(/örüntüsünde/giu, "bulguda")
    .replace(/örüntüsü/giu, "bulgu")
    .replace(/örüntünün/giu, "bulgunun")
    .replace(/bulgular betimler/giu, "bulguları betimler")
    .replace(/reaktivite, bebeğin uyaran karşısında ne kadar değiştiğini;\s*toparlanma ise bu değişim sonrasında sistemin nasıl yeniden organize olduğunu anlamına gelir/giu, "Reaktivite, bebeğin uyaran karşısında ne kadar değiştiğini gösterir. Toparlanma ise sistemin bu değişimden sonra nasıl yeniden organize olduğunu açıklar")
    .replace(/görünümünü/giu, "etkisini")
    .replace(/görünümün/giu, "bulguların")
    .replace(/görünümü/giu, "bulgular")
    .replace(/görünümde/giu, "bulgularda")
    .replace(/eksenini/giu, "alanını")
    .replace(/ekseninde/giu, "alanında")
    .replace(/eksenin/giu, "alanın")
    .replace(/Bu görünüm öz[-\s]?düzenleme açısından klinik eksen içinde ele alındığında/giu, "Bulgular birlikte ele alındığında")
    .replace(/En güçlü desteklenen klinik örüntü\s+([^.!?;]+?)\s+odağı(?:\s+olarak değerlendirilmiştir|dır)?[.]?/giu, "Bulgular en çok $1 alanındaki güçlüğü desteklemektedir.")
    .replace(/En güçlü desteklenen klinik örüntü\s+([^.!?;]+?)(?:\s+olarak değerlendirilmiştir|dir|dır)[.]?/giu, "Bulgular $1 ile ilişkili bulguları desteklemektedir.")
    .replace(/En güçlü desteklenen klinik örüntü/giu, "Bulguların en çok desteklediği alan")
    .replace(/Self-regülasyon, Türkçede çoğunlukla öz[-\s]?düzenleme olarak kullanılan ve\s*/giu, "Self-regülasyon, ")
    .replace(TERMINOLOGY_DRIFT, "self-regülasyon")
    .replace(/Formülasyon güveni açısından\s*/giu, "Yorumun güven düzeyi değerlendirilirken ")
    .replace(/Formülasyon güveni\s+([^.]*)\./giu, "Bu yorumun güven düzeyi $1.")
    .replace(/Korunmuş kapasite yapılandırılmış koşullarda görülmektedir\./giu, "Yapılandırılmış destek verildiğinde performansın daha iyi olduğu görülüyor.")
    .replace(/([A-ZÇĞİÖŞÜ][^.!?;]*?) alanındaki görünüm korunmuş kapasite yönündedir\./gu, "$1 alanında ek bir günlük yaşam güçlüğü bildirilmemiştir.")
    .replace(/([A-ZÇĞİÖŞÜ][^.!?;]*?) alanındaki [^.!?;]* görünüm vaka bağlamında işlevsel dikkat gerektirir\./gu, "$1 alanındaki bulgular günlük yaşamda güçlük olabileceğini göstermektedir.")
    .replace(/Mevcut vaka kanıtında bu alana özgü bağımsız bir günlük işlev güçlüğü gösterilmemiştir\./gu, "Bu alanda günlük yaşamı etkileyen ayrı bir güçlük bildirilmemiştir.")
    .replace(/Bu alan için bağımsız günlük işlev kanıtı sınırlıdır\./gu, "Bu alanın günlük yaşama etkisini açıklayan bilgi sınırlıdır.")
    .replace(/bu tek klinik ayrışma kesinliği sınırlar/giu, "bu uyumsuzluk yorumun kesinliğini azaltır")
    .replace(/\bbu görünüm\b/giu, "bu güçlük")
    .replace(/formülasyon odağı/giu, "en çok desteklenen alan")
    .replace(/ana açıklama olarak yeterli destek bulmadı/giu, "diğer bulgular kadar güçlü desteklenmedi")
    .replace(/\bklinik eksen\b/giu, "öncelikli alan")
    .replace(/bağımsız bilgi kanalı/giu, "farklı bilgi kaynağı")
    .replace(/\b(?:bağımsız klinik )?ayrışma kümesi\b/giu, "uyumsuz bilgi grubu")
    .replace(/\bklinik örüntü kapsamında\b/giu, "bulgular birlikte değerlendirildiğinde")
    .replace(/klinik örüntü[\p{L}]*/giu, "bulgular")
    .replace(/formülasyon/giu, "yorum")
    .replace(/\bbu görünüm\b/giu, "bu güçlük")
    .replace(/görünüm/giu, "bulgular")
    .replace(/odağı/giu, "önceliği")
    .replace(/yakınsama(?:sı|si|su|sü)?/giu, "bilgilerin aynı yönde olması")
    .replace(/korunmuş kapasite/giu, "destekle daha iyi performans")
    .replace(/işlevsel eksende/giu, "günlük yaşamda")
    .replace(/eksen/giu, "alan")
    .replace(/örüntü/giu, "bulgu")
    .replace(/örüntünün kapsamı/giu, "bulguların hangi durumlarda geçerli olduğu")
    .replace(/\bişlevsel eksende belirginleşmektedir\b/giu, "günlük yaşamda belirginleşmektedir")
    .replace(/vaka bağlamında işlevsel dikkat gerektirir/giu, "günlük yaşamdaki etkisi değerlendirilmiştir")
    .replace(/\bdesteklemektedir\b/giu, "destekliyor")
    .replace(/\bgöstermektedir\b/giu, "gösteriyor")
    .replace(/\bgörülmektedir\b/giu, "görülüyor")
    .replace(/\bbelirginleşmektedir\b/giu, "belirginleşiyor")
    .replace(/\bsınırlandırmaktadır\b/giu, "sınırlıyor")
    .replace(/\bazaltmaktadır\b/giu, "azaltıyor")
    .replace(/\bartmaktadır\b/giu, "artıyor")
    .replace(/\bdeğerlendirilmektedir\b/giu, "değerlendiriliyor")
    .replace(/\bbulunmaktadır\b/giu, "bulunuyor")
    .replace(/\bişaret etmektedir\b/giu, "işaret ediyor")
    .replace(/\baçıklamaktadır\b/giu, "açıklıyor")
    .replace(/\bbildirilmektedir\b/giu, "bildiriliyor")
    .replace(/\bbakımveren\b/giu, "bakım veren")
    .replace(/aynı bulguyu destekliyor/giu, "genel olarak aynı yönde sonuç veriyor")
    .replace(/Bağlama duyarlılığını gösterir\./gu, "Bu fark, performansın bağlama duyarlı olduğunu gösterir.")
    .replace(/fark edebilir bununla birlikte/giu, "fark edebilir. Bununla birlikte")
    .replace(/\balt ıslatma\b/giu, "altını ıslatma")
    .replace(/vaka dışı uygulama gerektirmeyebilir/giu, "tek başına klinik güçlük anlamına gelmeyebilir")
    .replace(/vaka dışı öneri/giu, "uygulama önerisi")
    .replace(/Bu genel bilimsel çerçeve \(([^)]+)\) kaynağıyla sınırlı olarak desteklenmektedir\./giu, "Bu açıklama $1 kaynağına dayanmaktadır.")
    .replace(/tek başına tanı, nedensellik veya uygulama önerisi üretmez/giu, "Tek başına tanı koymaz, neden açıklaması veya uygulama önerisi sunmaz")
    .replace(/Tek bir kaynak vaka kararını tek başına belirlemez/giu, "Tek bir kaynak, vaka özelindeki sonucu tek başına belirlemez")
    .replace(/\b(Fizyolojik|Duyusal|Duygusal|Bilişsel) Regülasyon\b/gu, (_match, domain: string) => `${domain} regülasyon`)
    .replace(/\bYürütücü İşlev\b/gu, "Yürütücü işlev")
    .replace(INTERNAL_LABEL, "")
    .replace(/([.!?]\s+)([a-zçğıöşü])(?!ttps?:\/\/)/gu, (_match, boundary: string, letter: string) => `${boundary}${letter.toLocaleUpperCase("tr-TR")}`)
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/:\s*:/gu, ":")
    .replace(/[ \t]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
}

function ownerBookSentence(plan: LockedReportPlan, sectionId: ReportSectionId, claim: ReportClaim) {
  const atom = plan.knowledgeBridge.selectedAtoms.find((entry) => entry.claimId === claim.id)
  const domain = atom?.reportDomain ? DOMAIN_LABELS[atom.reportDomain] ?? null : null
  const content = paraphraseOwnerContent(claim.text)
    .replace(/^([A-ZÇĞİÖŞÜ])/u, (letter) => letter.toLocaleLowerCase("tr-TR"))
  if (sectionId === "section_3") return `${domain ? `${domain[0]!.toLocaleUpperCase("tr-TR")}${domain.slice(1)} bulgularının günlük yaşamdaki anlamı değerlendirilirken` : "Alan bulguları yorumlanırken"}, ${content}`
  if (sectionId === "section_4") return `Mevcut bulgular açıklanırken ${content}`
  if (sectionId === "section_5") return `Bilgi kaynakları birlikte değerlendirilirken ${content}`
  return `Genel kavramsal çerçevede ${content} Bu açıklama vaka sonucundan ve dış bilimsel literatürden ayrı tutulmuştur.`
}

export function naturalizeReportClaim(plan: LockedReportPlan, sectionId: ReportSectionId, claim: ReportClaim) {
  if (claim.knowledgeAuthority === "OWNER_BOOK") return normalizeDnaReportLanguage(ownerBookSentence(plan, sectionId, claim))
  if (claim.id.startsWith("claim.domain-interpretation.") && /Mevcut vaka kanıtında bu alana özgü bağımsız bir günlük işlev güçlüğü gösterilmemiştir/iu.test(claim.text)) {
    const domain = claim.id.split(".").at(-1) ?? ""
    const label = DOMAIN_LABELS[domain] ?? "bu alan"
    return `${label[0]!.toLocaleUpperCase("tr-TR")}${label.slice(1)} alanında vaka açısından ek bir günlük yaşam güçlüğü bildirilmemiştir.`
  }
  if (claim.id === "claim.overall-classification") {
    const match = claim.text.match(/Toplam skor\s+([^ ]+)\s+ve genel sınıflama\s+([^.]*)/iu)
    if (match) {
      const level = match[2]!.trim().replace(/\s+olarak hesaplandı$/iu, "")
      if (sectionId === "section_1") return `Genel sonuç ${level} sınıfındadır; toplam puan ${match[1]!.trim()} olarak hesaplandı.`
      if (sectionId === "section_2") return `Ölçümde ${match[1]!.trim()} puan elde edildi ve sonuç ${level} olarak sınıflandı.`
    }
  }
  if (claim.id === "claim.functional-implication") {
    const area = plan.primaryFormulationId ? FORMULATION_AREAS[plan.primaryFormulationId] : null
    if (area && sectionId === "section_1") return `Günlük yaşamdaki temel etki, ${area} ile ilişkili katılımın değişmesidir.`
    if (area && sectionId === "section_4") return `Bu günlük yaşam etkisi, ${area} bulgularının işlevsel anlamını açıklıyor.`
    if (area && sectionId === "section_7") return `Sonuç, ${area} ile günlük yaşamdaki etkisinin birlikte yorumlanması gerektiğini gösteriyor.`
    if (sectionId === "section_1") return "Günlük performans bağlama göre değişebildiği için sonuç temkinli yorumlanıyor."
    if (sectionId === "section_4") return "Günlük yaşam bilgisi tek bir açıklamayı desteklemediği için bağlam farklılıkları birlikte ele alınıyor."
    if (sectionId === "section_7") return "Sonuç, günlük performansın farklı koşullarda değişebileceği bilgisiyle sınırlı tutuluyor."
    return normalizeDnaReportLanguage(claim.text)
  }
  if (claim.id === "claim.confidence") {
    const rawLevel = claim.text.match(/güveni\s+([^.]*)\./iu)?.[1]?.trim() ?? "mevcut kanıtla sınırlı"
    const level = rawLevel.replace(/\s+düzeydedir$/iu, "")
    const levelPredicate = ({ düşük: "düşüktür", orta: "ortadır", "orta-yüksek": "orta-yüksektir", yüksek: "yüksektir" } as const)[level as "düşük" | "orta" | "orta-yüksek" | "yüksek"] ?? "mevcut kanıtla sınırlıdır"
    const rawDetails = normalizeDnaReportLanguage(claim.text.split(".").slice(1).join(".").trim())
    const details = /(?:aynı yönde|destekliyor)/iu.test(rawDetails)
      && /(?:sınırlı|sınırlıyor|eksik|mevcut değildir)/iu.test(rawDetails)
      && !/(?:bununla birlikte|buna karşın|ancak)/iu.test(rawDetails)
      ? rawDetails.replace(/\.\s+(?=(?:Kararı|Günlük|Farklı|Yorumlanabilir))/u, ". Bununla birlikte ")
      : rawDetails
    if (sectionId === "section_6") return `Bu öncelik ${level} güven düzeyinde ele alınıyor.`
    return details
      ? `${details} Genel güven düzeyi ${levelPredicate}`
      : `Mevcut kanıt bu yorumu ${level} düzeyde destekliyor.`
  }
  if (claim.id === plan.primaryDecisionClaimId && claim.formulationId && FORMULATION_SENTENCES[claim.formulationId]) {
    if (sectionId === "section_1") return FORMULATION_SENTENCES[claim.formulationId]!
    if (claim.formulationId === "balanced") {
      if (sectionId === "section_4") return "Ölçüm, gözlem ve bildirimler belirgin bir güçlük alanında birleşmiyor."
      if (sectionId === "section_6") return "Mevcut bulgular belirli bir self-regülasyon alanını önceliklendirmeyi gerektirmiyor."
      if (sectionId === "section_7") return "Değerlendirme self-regülasyon alanlarında genel olarak yaşa uygun bir performansa işaret ediyor."
    }
    const area = FORMULATION_AREAS[claim.formulationId]
    if (area) {
      if (sectionId === "section_4") return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)}, farklı bilgi kaynakları birlikte değerlendirildiğinde de öne çıkıyor.`
      if (sectionId === "section_6") return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} günlük yaşam açısından izlenecek ilk alanı oluşturuyor.`
      if (sectionId === "section_7") return `Değerlendirme sonucunda ${area} için desteğe ihtiyaç olduğu görülüyor.`
    }
    return FORMULATION_SENTENCES[claim.formulationId]!
  }
  if (claim.id === plan.primaryDecisionClaimId && !claim.formulationId) {
    if (sectionId === "section_1") return "Bulgular tek bir alanı yeterli kesinlikle öne çıkarmıyor."
    if (sectionId === "section_4") return "Bilgi kaynakları tek bir açıklamada birleşmediği için farklı olasılıklar açık tutuluyor."
    if (sectionId === "section_6") return "Öncelik sırası, işlevsel bilgiler netleştikçe yeniden değerlendirilebilir."
    if (sectionId === "section_7") return "Sonuç tek bir güçlük alanına indirgenmeden temkinli yorumlanıyor."
  }
  if (claim.id.startsWith("claim.secondary.") && claim.formulationId && FORMULATION_AREAS[claim.formulationId]) {
    const area = FORMULATION_AREAS[claim.formulationId]!
    if (sectionId === "section_4") return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} bulguların bir bölümünü açıklayabilir, ancak bütün bulguları tek başına açıklamaz.`
    if (sectionId === "section_6") return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} ana önceliğin ardından izlenebilir.`
    if (sectionId === "section_7") return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} değerlendirmede dikkate alındı, ancak sonucu belirleyen ana alan olmadı.`
    return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} bulguların bir bölümünü açıklayabilir; ancak ana güçlük alanı değildir.`
  }
  if (claim.id.startsWith("claim.alternative.") && claim.formulationId && FORMULATION_AREAS[claim.formulationId]) {
    const area = FORMULATION_AREAS[claim.formulationId]!
    if (sectionId === "section_4") return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} değerlendirildi, ancak diğer bulgular kadar güçlü desteklenmedi.`
    if (sectionId === "section_6") return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} ikincil bir izlem alanı olarak tutulabilir.`
    if (sectionId === "section_7") return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} olasılığı dışlanmadı, ancak mevcut sonucu belirlemedi.`
    return `${area[0]!.toLocaleUpperCase("tr-TR")}${area.slice(1)} olasılığı da göz önünde bulundurulmuştur; ancak mevcut bulgular bunu ana açıklama olarak desteklememektedir.`
  }
  if (claim.role === "PRESERVED_CAPACITY") {
    if (sectionId === "section_2") return "Yapılandırılmış veya desteklenen koşullarda performansın daha iyi olduğu bildiriliyor."
    if (sectionId === "section_3") return "Günlük yaşamda yapı ve destek sağlandığında performans daha iyi olabiliyor."
    if (sectionId === "section_4") return "Destek düzeyine göre performansın değişmesi, güçlüğün her koşulda aynı olmadığını gösteriyor."
    if (sectionId === "section_5") return "Destekle daha iyi olan performansa ilişkin bilgi, diğer kaynaklarla birlikte değerlendiriliyor."
    if (sectionId === "section_6") return "İzlemde performansın destekle daha iyi olduğu koşullar ayrıca dikkate alınıyor."
    if (sectionId === "section_7") return "Sonuç, destek verildiğinde performansın daha iyi olabildiği bilgisiyle birlikte yorumlanıyor."
  }
  return normalizeDnaReportLanguage(claim.text)
}

export function ownerBookVerbatimCopyCount(plan: LockedReportPlan, text: string) {
  const finalNormalized = normalized(text)
  return plan.knowledgeBridge.selectedAtoms.filter((atom) => {
    const source = normalized(cleanSourceFraming(atom.text))
    return source.length >= 60 && finalNormalized.includes(source)
  }).length
}
