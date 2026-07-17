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

type ExplicitTopicRule = Readonly<{
  topicId: string
  pattern: RegExp
}>

// Broad aliases such as "uyku", "dikkat" and "yürütücü işlev" are useful
// fallbacks, fakat alt başlık sorularında özgül kavramı gölgeleyebilir. Bu
// sıralı kurallar yalnız kaynak kataloğunda açıkça adlandırılmış tek bir
// başlığa yönlendirir; yeni bir klinik veya biyolojik çıkarım üretmez.
const EXPLICIT_TOPIC_RULES: readonly ExplicitTopicRule[] = [
  { topicId: "selfreg.sleep_health", pattern: /\buyku\b.+\bdna\w*\b.+\bbilissel regulasyon alani\w*/ },
  { topicId: "case.ai_oversight", pattern: /\b(?:otomasyon yanlilig\w*|(?:ai|yapay zeka)\w*.+\b(?:rapor|ozet|kaynak|denetim|objektif|gecerlik)\w*)/ },
  { topicId: "case.change_interpretation", pattern: /\b(?:minimal saptanabilir degisim|guvenilir degisim indeksi|mdc|ortalamaya regresyon|uygulama etkisi|puan degisimi)\b/ },
  { topicId: "case.change_interpretation", pattern: /\btekrar olcumde hangi hata kaynaklari\b/ },
  { topicId: "case.measurement_uncertainty", pattern: /\b(?:olcum hatasi|standart olcum hatasi|guven araligi|puan belirsizligi)\b/ },
  { topicId: "case.multi_informant", pattern: /\b(?:bilgi veren uyusmazligi|ebeveyn ve ogretmen|ebeveyn ogretmen|proxy bildirim|coklu bilgi veren)\b/ },
  { topicId: "case.development_culture", pattern: /\b(?:olcum degismezligi|kulturel adalet|kulturel gecerlik|kulturel uyarlama|yas esdegeri|yas normu|ceviri)\w*/ },
  { topicId: "case.screening_diagnosis", pattern: /\b(?:tarama|tanisal degerlendirme|pozitif yordayici deger|prevalans|kesme puaninin dogrulugu)\w*/ },
  { topicId: "case.score_interpretation", pattern: /\b(?:norm grubu|yuzdelik|persentil|kesme puani|ham puan|standart puan|norm referansli|olcut referansli)\w*/ },
  { topicId: "case.validity_reliability", pattern: /\b(?:gecerlik|guvenirlik|guvenilirlik|cronbach|alfa katsayisi|mutlak uyum|icerik gecerligi|yapi gecerligi)\w*/ },
  { topicId: "case.capacity_performance", pattern: /(?:\bkapasite\w*.+\b(?:performans|katilim)\w*|\bperformans gorevi\w*.+\bgunluk yasam\w*|\bekolojik gecerlik\b)/ },
  { topicId: "case.contextual_variability", pattern: /(?:\bbaglamsal degiskenlik\b|\bevde\w*.+\bokulda\w*|\bokulda\w*.+\bevde\w*)/ },
  { topicId: "case.causal_biological_boundary", pattern: /\b(?:korelasyon ile nedensellik|grup bulgusu ile bireysel|biyolojik cikarim|beyin bolgesi cikarimi)\b/ },
  { topicId: "case.report_communication", pattern: /\b(?:rapor dili|veri yorum ve hipotez|guclu yonler\w* rapor|aile\w* anlasilabilir)\b/ },
  { topicId: "case.interpretation_boundaries", pattern: /\b(?:vaka ve rapor yorum siniri|vaka yorum siniri|rapor yorum siniri)\b/ },

  { topicId: "dna.capacity_performance", pattern: /\bdna alan\w*\b.+\bgunluk katilim\b/ },
  { topicId: "dna.physiological_regulation", pattern: /\bfizyolojik regulasyon\b.+\byani parasempatik\b/ },
  { topicId: "dna.six_domains", pattern: /(?:\bdna\w*.+\balti alan\w*|\balti alan\w*.+\b(?:dna|faktor|bagimsiz|beyin)\w*)/ },
  { topicId: "dna.physiological_regulation", pattern: /^fizyolojik regulasyon nedir$/ },
  { topicId: "dna.sensory_regulation", pattern: /^duyusal regulasyon nedir$/ },
  { topicId: "dna.sensory_regulation", pattern: /\bduyusal regulasyon\b.+\bduyusal modulasyon\b/ },
  { topicId: "dna.physiological_regulation", pattern: /\b(?:dna\w*.+)?fizyolojik regulasyon (?:alani|puani)\b/ },
  { topicId: "dna.sensory_regulation", pattern: /\b(?:dna\w*.+)?duyusal regulasyon (?:alani|puani)\b/ },
  { topicId: "dna.emotional_regulation", pattern: /\b(?:dna\w*.+)?duygusal regulasyon (?:alani|puani)\b/ },
  { topicId: "dna.cognitive_regulation", pattern: /\b(?:dna\w*.+)?bilissel regulasyon (?:alani|puani)\b/ },
  { topicId: "dna.executive_function_domain", pattern: /(?:\bdna\w*.+\byurutucu islev alani\b|\byurutucu islev alani\b)/ },
  { topicId: "dna.interoception_domain", pattern: /(?:\bdna\w*.+\binterosepsiyon alani\b|\binterosepsiyon (?:alani|puani)\b)/ },
  { topicId: "dna.capacity_performance", pattern: /\b(?:dna\w*.+)?kapasite\w*.+\b(?:performans|katilim)\w*/ },
  { topicId: "dna.capacity_performance", pattern: /\bdna alan\w*\b.+\bgunluk katilim\b/ },
  { topicId: "dna.measurement_levels", pattern: /\b(?:olcum duzeyleri|gorev ile derecelendirme|fizyolojik olcum ile davranissal gozlem|alan toplam puani)\b/ },
  { topicId: "dna.measurement_levels", pattern: /\bperformans gorevi\b.+\bebeveyn olcegi\b/ },
  { topicId: "dna.domain_overlap", pattern: /\b(?:alan ortusmesi|birincil ve ikincil alan|alanlar arasi fark|bir davranis\w*.+birden cok alan)\b/ },
  { topicId: "dna.functional_profile", pattern: /(?:\bdna (?:profili|raporu)\b|\bdestege yanit\b.+\bprofil\w*)/ },

  { topicId: "development.age_equivalent_limits", pattern: /\b(?:gelisimsel yas|yas esdegeri)\b/ },
  { topicId: "development.measurement_invariance", pattern: /\b(?:olcum degismezligi|yerel norm|baska kulturde|kulturel gecerlik)\b/ },
  { topicId: "development.screening_assessment", pattern: /\bgelisimsel (?:gozetim|tarama|degerlendirme)\b/ },
  { topicId: "development.informant_context", pattern: /\b(?:ebeveyn ve ogretmen|ebeveyn ogretmen|bilgi veren)\w*.+\b(?:fark|puan|uyus)\w*/ },
  { topicId: "development.supported_performance", pattern: /\b(?:destekli performans|destekle yapilan|korunmus kapasite)\b/ },
  { topicId: "development.person_environment", pattern: /\b(?:kisi cevre uyumu|cevresel talep|evde\w*.+okulda\w*)\b/ },
  { topicId: "development.person_environment", pattern: /\b(?:gurultulu sinifta performans|duyusal ortam performansi|uyku ve yorgunluk gelisimsel performansi)\b/ },
  { topicId: "development.neurodiversity", pattern: /\b(?:norocesitlilik|noroayrisma|transdiagnostik)\w*/ },
  { topicId: "development.plasticity", pattern: /\b(?:duyarli donem|kritik donem|plastisite)\w*/ },
  { topicId: "development.pathways", pattern: /\b(?:essonluluk|coksonluluk|gelisimsel kaskad)\w*/ },
  { topicId: "development.uneven_profile", pattern: /\b(?:sivri profil|dengesiz profil|eszamanli gelis)\w*/ },
  { topicId: "development.trajectory", pattern: /\bgelisimsel (?:yorunge|hiz)\w*/ },
  { topicId: "development.variability", pattern: /\b(?:bireysel farklilik ile birey ici|birey ici degiskenlik|gunlere gore degis)\w*/ },
  { topicId: "development.differences", pattern: /\bgelisimsel farklilik\w*/ },

  { topicId: "selfreg.coregulation_measurement", pattern: /\b(?:es regulasyon|ko regulasyon|senkroni)\w*.+\b(?:olcum|degerlendir|kanit|gozlem)\w*/ },
  { topicId: "selfreg.coregulation_development", pattern: /(?:\b(?:bebeklik|erken cocukluk|okul oncesi|okul cagi|\d+\s*\d+ yas)\w*.+\bes (?:regulasyon|duzenleme)\b|\bes (?:regulasyon|duzenleme)\b.+\b(?:yas|gelisim|bebek|okul|biter)\w*)/ },
  { topicId: "selfreg.coregulation_culture", pattern: /\b(?:goz temasi|dokunma|kultur)\w*.+\b(?:es regulasyon|duzenleyici|daha iyi)\w*/ },
  { topicId: "selfreg.dyadic_synchrony", pattern: /\b(?:davranissal eszamanlilik|fizyolojik eszamanlilik|dyadik eszamanlilik|ebeveyn cocuk senkronisi|kalp ritmi eszamanliligi|noral eszamanlilik)\b/ },
  { topicId: "selfreg.codyregulation", pattern: /\b(?:es duzensizlik|ortak sikinti|karsilikli tirmanma)\b/ },
  { topicId: "selfreg.interaction_repair", pattern: /\b(?:etkilesim onarimi|uyumsuzluk onarimi|still face)\b/ },
  { topicId: "selfreg.caregiver_sensitivity", pattern: /\b(?:bakimveren duyarliligi|ebeveyn duyarliligi|duyarlilik ile yanitlayicilik)\b/ },
  { topicId: "selfreg.social_buffering", pattern: /\bsosyal tamponlama\b/ },
  { topicId: "selfreg.coregulation_scaffolding", pattern: /\b(?:iskeleleme|ongorulebilir yapi|ozerklik destegi|kati kontrol|asiri yardim)\b/ },
  { topicId: "selfreg.coregulation_scaffolding", pattern: /\bduygu koclugu\b/ },

  { topicId: "ans.interoception", pattern: /\bstres sistem\w*\b.+\binterosepsiyon\b/ },
  { topicId: "selfreg.stress_systems", pattern: /\bhpa\b.+\botonom\b|\botonom\b.+\bhpa\b/ },
  { topicId: "selfreg.reactivity_recovery", pattern: /\bstres yaniti\b.+\bzaman icinde\b/ },
  { topicId: "selfreg.habituation", pattern: /\btekrarlanan\b.+\byanit\w*\b.+\bazal\w*\b/ },
  { topicId: "selfreg.cortisol_measurement", pattern: /\b(?:kortizol|cortisol)\w*\b/ },
  { topicId: "selfreg.hpa_axis", pattern: /\b(?:hpa\s+(?:aksi|ekseni)|crh|acth)\b/ },
  { topicId: "selfreg.stress_systems", pattern: /\b(?:akut stres|kronik stres|stres sistem\w*|farkli stres tepk\w*)\b/ },

  { topicId: "selfreg.sleep_measurement", pattern: /\buyku ve aclik\b/ },
  { topicId: "selfreg.daily_rhythm", pattern: /\bsirkadyen ritim\w*\b.+\bgunluk duzen\b/ },
  { topicId: "selfreg.sleep_regulation", pattern: /\b(?:homeostatik uyku|uyku baskisi|iki surecli uyku|iki surec modeli)\b/ },
  {
    topicId: "selfreg.sleep_development",
    pattern: /(?:\b(?:0\s*3 aylik|ilk uc ay|\d+\s*\d+\s+aylik|\d+\s*\d+\s+yasta|okul cagina gecis)\b.+\buyku\b|\buyku\b.+\b(?:0\s*3 aylik|ilk uc ay|\d+\s*\d+\s+aylik|\d+\s*\d+\s+yasta|okul cagina gecis)\b|\bwho\b.+\bilk uc ayi\b|\b(?:ogle uykusu|gunduz uykusu|onerilen toplam uyku|onerilen uyku suresi)\b)/,
  },
  { topicId: "selfreg.sleep_measurement", pattern: /\b(?:ebeveyn uyku raporu|uyku olcegi|uyku anketi|aktigrafi|polisomnografi|psg)\b/ },
  { topicId: "selfreg.daily_rhythm", pattern: /\b(?:uyku zamanlamasi|uyku duzenliligi|gunluk ritim|gunluk duzen)\b/ },
  { topicId: "selfreg.circadian_rhythm", pattern: /\b(?:sirkadiyen|sirkadyen|biyolojik saat|scn)\w*\b/ },

  { topicId: "selfreg.reactivity_recovery", pattern: /\bduygusal tepkisellik\b.+\bduygusal duzenleme\b/ },
  { topicId: "cns.inhibitory_control", pattern: /\boz kontrol\b.+\binhibisyon\b/ },
  { topicId: "cns.cognitive_flexibility", pattern: /\b(?:uc yas\w*|3 yas\w*)\b.+\besneklik\b/ },

  { topicId: "cns.attention_networks", pattern: /\b(?:yurutucu dikkat|dikkat aglari?\w*)\b/ },
  { topicId: "cns.selective_attention", pattern: /\bsecici dikkat\b.+\bsurdur\w* dikkat\b/ },
  { topicId: "cns.sustained_attention", pattern: /\b(?:surdur\w* dikkat|yanit degiskenligi|\d+\s*(?:dk|dakika)\s+sonra|dikkati\w*\s+sur(?:dur|er))\b/ },
  { topicId: "cns.selective_attention", pattern: /\b(?:gurultulu sinif|duyusal dikkat dagitici\w*|endojen ve ekzojen dikkat|ekzojen ve endojen dikkat)\b/ },
  { topicId: "cns.attention_measurement", pattern: /\b(?:performans gorevi\b.+\bebeveyn olcegi|otantik degerlendirme|standart test|testte\b.+\bevde|dikkat olcmenin temel guclukleri)\b/ },
  { topicId: "cns.attention_development", pattern: /\b(?:dikkat bebeklikte|bebeklikteki bakis suresi|dikkat gelisim\w*)\b/ },

  { topicId: "cns.working_memory_development", pattern: /(?:\bcalisma bellegi\b.+\b(?:gelis\w*|yas\w*|ayris\w*|okul cagi|sozel ve gorsel uzamsal)\b|\b(?:bebek\w*|cocuk\w*|okul cagi\w*|okul oncesi\w*|\d+\s*\d+\s+yasta)\b.+\bcalisma bellegi\b)/ },
  { topicId: "cns.working_memory_measurement", pattern: /\b(?:kodlama hatasi|geri getirme hatasi|calisma bellegi\b.+\b(?:olc\w*|test|span|gorev))\b/ },
  { topicId: "cns.working_memory", pattern: /\b(?:cok adimli yonerge\w*|iki asamali yonerge\w*|iki komut\w*|gorsel ipucu\w*)\b/ },
  { topicId: "cns.working_memory", pattern: /\bcalisma bellegi\b/ },

  { topicId: "cns.executive_measurement", pattern: /\b(?:ekolojik gecerlik|performans testi\b.+\bebeveyn formu|metabilis\w*\b.+\byurutucu islev|brief\b|test sonucu\b.+\bogretmen raporu|test tekrar test|dil guclugu\b.+\byurutucu test|test gununde\b.+\bpuani yorumlanir)\b/ },
  { topicId: "cns.executive_development", pattern: /\b(?:yurutucu islev egitim\w*\b.+\baktar\w*|yurutucu islev\w*\b.+\b(?:hangi yas|kac yas|yetiskin duzeyi|erken cocukluk|okul oncesi|ilkokul|olgunlas\w*|gelis\w*)|(?:erken cocukluk|okul oncesi|ilkokul)\w*\b.+\byurutucu islev\w*|\d+\s*\d+\s+yasta\b.+\b(?:sicak|soguk)\s+ef)\b/ },
  { topicId: "cns.executive_development", pattern: /\byurutucu islevler\w* 6 yasinda tamamlan\w*/ },
  { topicId: "cns.executive_development", pattern: /\b(?:0\s*2 yasta yurutucu islev|beynin olgunlasmasi\b.+\byurutucu islev)\b/ },
  { topicId: "selfreg.executive_functions", pattern: /\b(?:evde zorlan\w*.+terapide iyi|odevini baslat\w*|daginiklik organizasyon|destekle yapabiliyor|korunmus yurutucu|es regulasyon\b.+\byurutucu|duygusal regulasyon\b.+\bsicak ef|interosepsiyon\b.+\byurutucu islev)\b/ },
  { topicId: "cns.executive_models", pattern: /\b(?:gorev safsizligi|latent yurutucu|yurutucu islev ne|yurutucu islevler nedir|cekirdek yurutucu islev\w*)\b/ },

  { topicId: "cns.attention_measurement", pattern: /\bdikkat\w*\b.+\b(?:olc\w*|olcek|test|gorev|degerlendirme)\b/ },
  { topicId: "cns.attention_development", pattern: /(?:\b(?:bebek\w*|cocukluk\w*|okul oncesi\w*)\b.+\bdikkat\w*\b|\bdikkat\w*\b.+\b(?:bebek\w*|cocukluk\w*|gelis\w*))\b/ },
  { topicId: "selfreg.development", pattern: /\b(?:0\s*3 yasta oz duzenleme|6\s*8 yasta self regulasyon)\b/ },
  { topicId: "ans.interoception_development", pattern: /\bokul oncesi cocuk\w*.+\bbeden sinyal\w*\b/ },
]

function explicitTopicForQuestion(normalizedQuestion: string): DnaChatCatalogTopic | null {
  const match = EXPLICIT_TOPIC_RULES.find((rule) => rule.pattern.test(normalizedQuestion))
  return match ? DNA_CHAT_CATALOG_TOPIC_BY_ID.get(match.topicId) ?? null : null
}

function topicFromPreviousContext(previousTopic?: string | null): DnaChatCatalogTopic | null {
  if (!previousTopic) return null
  const byId = DNA_CHAT_CATALOG_TOPIC_BY_ID.get(previousTopic)
  if (byId) return byId

  const normalizedPreviousTopic = normalizeCatalogText(previousTopic)
  return DNA_CHAT_CATALOG_TOPICS.find((topic) =>
    normalizeCatalogText(topic.id) === normalizedPreviousTopic ||
    normalizeCatalogText(topic.title) === normalizedPreviousTopic ||
    topic.aliases.some((alias) => normalizeCatalogText(alias) === normalizedPreviousTopic)
  ) ?? null
}

export function classifyCatalogQueryKind(question: string): DnaChatQueryKind {
  const strippedQuestion = stripCatalogInstructionPrefix(question)
  const normalized = normalizeCatalogText(strippedQuestion)

  // A generic mention of a child, profile or session is not enough to open a
  // private report. Case routing is reserved for explicit report/vaka deixis;
  // clinical safety gates run before this classifier in the engine.
  const asksGeneralReportBoundary =
    /\b(?:vaka ve rapor yorum siniri|vaka yorum siniri|rapor yorum siniri|vaka raporu)\b/.test(normalized) &&
    /\b(?:nedir|ne demek|gecerlik|guvenirlik|puan|yorum|sinir|kaynak|gozlem|raporlama)\w*\b/.test(normalized) &&
    !/\b(?:bu rapor|son rapor|raporum|rapordaki|secili rapor|bu vaka|vakadaki)\b/.test(normalized)
  const hasCase = !asksGeneralReportBoundary && /\b(?:son rapor\w*|raporum\w*|rapordaki|bu rapor\w*|secili rapor\w*|son degerlendirme\w*|bu vaka\w*|vakadaki|vaka raporu\w*|vaka skor\w*)\b/.test(
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
    "uyarılma",
    "reaktivite",
    "toparlanma",
    "öz örgütlenme",
    "habituasyon",
    "duyusal modülasyon",
    "duygu düzenleme",
    "stres sistemleri",
    "stres yanıtı",
    "hpa",
    "kortizol",
    "allostatik yük",
    "toksik stres",
    "uyku",
    "günlük ritim",
    "sirkadiyen",
    "melatonin",
    "dikkat",
    "çalışma belleği",
    "yürütücü işlev",
    "geçerlik",
    "güvenirlik",
    "ölçüm hatası",
    "norm grubu",
    "tarama",
    "gelişimsel farklılık",
    "ölçüm değişmezliği",
    "nöroçeşitlilik",
    "kapasite",
    "performans",
    "eşsonluluk",
    "çoksonluluk",
    "dyadik",
    "eşzamanlılık",
    "bakımveren duyarlılığı",
    "sosyal tamponlama",
  ])

  if (hasCase && hasTheory) return "case_theory"
  if (hasCase) return "case_finding"

  if (/\bbaglamsal degiskenlik ne (?:demektir|demek)\b/.test(normalized)) {
    return "definition"
  }

  if (/^gelisimsel farklilik nedir$/.test(normalized)) {
    return "definition"
  }

  if (
    /\b(?:gelisimsel farklilik\w*.+\b(?:gunluk rutin\w*|okula baslama)\w*|okula baslama\w*.+\bgelisimsel farklilik)\b/.test(normalized)
  ) {
    return "relation"
  }

  if (/\b(?:evde\w*.+okulda\w*|evde yap\w*.+okulda\w*)\b/.test(normalized)) {
    return "unknown"
  }

  if (/\byorgunluk hissi\b.+\binteroseptif bir surec\b/.test(normalized)) {
    return "definition"
  }

  if (/\bcocuk neden iki asamali yonergede\b/.test(normalized)) {
    return "unknown"
  }

  if (/\byas normu guncel degilse\b/.test(normalized)) {
    return "evidence"
  }

  if (/\byas esdegeri\b.+\bgelisim yasi\b/.test(normalized)) {
    return "misconception"
  }

  if (/\bbastirma zararliysa\b.+\bduygu\w* her yerde gostermeli\b/.test(normalized)) {
    return "misconception"
  }

  if (
    /\b(?:sorun sadece okulda|sendrom gosterir|daha objektif|kontrol etmeye gerek yok|otomatik gecerli|rol mu yapiyor|gerilemis midir|basarisiz mi olmustur|duzenlenmis oldugu kesin|mutlaka sakinlesir|daha iyi es regulasyon|her cocukta duzenleyici|iyi iliskiyi kanitlar|bagimli yapar|kendi kendine duzenlenmek zorunda|tek basina yeterli|baglanma bozuklugunu gosterir|sakin cocuklar\w*.+her zaman iyi)\b/.test(normalized) ||
    /\b(?:ebeveyn puani|yuzdelik\w* 5|guven araligi\w* en dusuk)\b.+\b(?:kesin|gercek)\b/.test(normalized)
  ) {
    return "misconception"
  }

  if (
    /\b(?:cocuklarda hrv guvenilir|norm grubunun temsil edici|kesme puaninin dogrulugu|bilgi veren uyusmazligi\w* ne kadar yaygin|olcum degismezligi neden onemli|alan toplam puani neden biyolojik belirtec|altin standart var mi|evrensel tani siniflamasi|ne kadar bilinmektedir|etki ne buyuklugundedir|hangi bilgi bosluklari|gelisimsel tarama testleri kesin sonuc|grup ortalamasi bireysel cocuk|korelasyon gelisimsel neden|norogoruntu\w* davranis\w* neden|test tekrar test guvenirligi neden onemli)\b/.test(normalized)
  ) {
    return "evidence"
  }

  if (
    /\b(?:gelisimsel yorunge|gelisimsel gecikme|atipik gelisim|gelisimsel kaskad)\b.+\b(?:nedir|ne demektir|ne anlama gelir)\b/.test(normalized) ||
    /\bpersentil\b.+\bmi demek\b/.test(normalized) ||
    /\bduygu regulasyonu demek\b/.test(normalized)
  ) {
    return "definition"
  }

  if (
    /\bperformans gorevi\b.+\bgunluk yasam olcegi\b.+\bneden ayris\w*|\bhangisi dogru\b|\btoparlanma ile bastirma\b.+\bayni gorun\w*|\byani parasempatik mi\b/.test(normalized)
  ) {
    return "comparison"
  }

  if (
    /\b(?:duyusal regulasyon puani|bilissel regulasyon puani|yurutucu islev alani|interosepsiyon alani)\b.+\b(?:cikarim|zeka|prefrontal|insula|olcer|gosterir)\w*/.test(normalized)
  ) {
    return "dna_relation"
  }

  if (
    /\b(?:tekrar olcumde hangi hata kaynaklari|fizyolojik olcum ile davranissal gozlem|alanlar arasi tutarsizlik olcum hatasi)\b/.test(normalized)
  ) {
    return "measurement"
  }

  if (
    /\b(?:yurutucu islevler 6 yasinda tamamlan|duyarli donem gecince|yas arttikca|erken cocuklukta oyun|okul oncesi\w* cocuklarda baglam bilgisi)\b/.test(normalized)
  ) {
    return "development"
  }

  // Yaş dönemi sorununun ana çerçevesiyse, karşılaştırma/ölçüm gibi ikincil
  // sözcükler gelişim niyetini gölgelememeli. Bu kapı yalnız açık dönem veya
  // yaş karşılaştırması taşıyan kalıpları kapsar; "çocukluk adversitesi"
  // gibi kanıt soruları aşağıdaki evidence kapısında kalır.
  if (
    /\b(?:ergenlerde\s+self regulasyon|yetiskin\s+self regulasyonu|erken cocuklukta\s+daha guclu|cocuklukta\s+yuksek reaktivite|bebeklerde\s+psikolojik stresor|cocugun\s+stres yaniti\s+zaman icinde|beynin\s+olgunlasmasi\s+yurutucu islev|0\s*3\s+aylik|yasamin ilk uc ayi|okul oncesi(?:\w*\s+)?acc|okul oncesi\w*\s+(?:gunduz uykusu|yurutucu islev|dikkat olcmenin|duygu dili|oyun)|bebeklikteki\s+bakis suresi|yas normu|\d+\s*\d+ yasta)\b/.test(normalized) ||
    /\b\d+\s+yasindaki cocuk\b.+\b\d+\s+yasindaki cocugun\b/.test(normalized) ||
    /\bcocuklarda\s+interosepsiyon\b.+\bsinirlar\w*\b/.test(normalized)
  ) {
    return "development"
  }

  if (
    /\b(?:hpa aksi mi ekseni mi ne o|planlama yurutucu islev midir|yurutucu islev ne oluyo|cekirdek yurutucu islevler hangileridir)\b/.test(normalized)
  ) {
    return "definition"
  }

  // Bu iki soru ürün sözleşmesindeki kavramsal DNA eşlemesini sorar; yapıları
  // biyolojik olarak özdeşleştirmez.
  if (
    /\bduyusal modulasyon\b.+\b(?:yurutucu islev|interosepsiyon)\b.+\b(?:midir|mudur)\b/.test(normalized)
  ) {
    return "dna_relation"
  }

  if (
    /\bcocuk\w*\b.+\byetiskin\w*\b/.test(normalized) &&
    /\b(?:ayni|farkli)\w*\b/.test(normalized) &&
    /\b(?:prefrontal|pfc|insula|interosep\w*|hrv)\b/.test(normalized)
  ) {
    return "development"
  }

  // Comparison cues are intentionally evaluated before DNA/evidence cues.
  // This keeps questions such as "DNA alanı X ile aynı yapı mı?" as an
  // explicit comparison rather than turning every DNA mention into one kind.
  if (
    /\b(?:farki\w*|fark var|fark nedir|farkli\w*|ayni (?:sey\w*|terim|kavram|yapi|bilesen)|ayni mi|ayni \w+(?: \w+)? (?:midir|mudur)|karsilastir\w*|karsit\w*|birbirine ters|nasil ayril\w*|anlamina gelir mi)\b/.test(normalized) ||
    /\bdemek\b.+\bdemek mi\b/.test(normalized) ||
    /\bdenen sey\b.+\bmi\b/.test(normalized) ||
    /\b(?:yalniz|tamamen)\b.+\b(?:midir|mudur)\b/.test(normalized) ||
    /\bmi\b.+\bmi\b.+\b(?:dogru|uygun)\b/.test(normalized) ||
    /\bbirbirinin yerine\b/.test(normalized) ||
    /\b(?:ile|ve)\b.+\b(?:ayni (?:sonuc|stres sureci|yapi)\w*|ayni olmayabilir)\b/.test(normalized) ||
    /\bayni\b.+\b(?:olcer|olcum)\w*\b/.test(normalized) ||
    /\byatma saati\b.+\buyku baslangici\b/.test(normalized) ||
    /\bcalisma bellegi\b.+\bunutkanlik mi\b/.test(normalized) ||
    /\btestte\b.+\bevde\b.+\bnormal mi\b/.test(normalized)
  ) {
    return "comparison"
  }

  if (
    /\b(?:bedensel duyum\w*.+interosepsiyonu dusuk|her zaman (?:iyi|kotu)|eksikligi midir|duzensizlik demek mi|fiziksel olarak depolanir mi|uyku sorunu olamaz|her cocuk kotu uyur|normal cocuk davranisi sayilabilir|tamamen kapanir mi)\b/.test(normalized) ||
    /\b(?:dusuktur|yuksektir)\s+diyebilir miyiz\b/.test(normalized)
  ) {
    return "misconception"
  }

  if (
    /\b(?:olcumunde|olcumu mudur|ozellik olcumu|aktigrafi|polisomnografi|test tekrar test|en iyi yurutucu islev testi|test sonucu ile ogretmen raporu|test gununde\b.+\bpuani yorumlanir)\b/.test(normalized) ||
    /\b(?:hrv|rsa|hep)\b.+\b(?:olcum|olcer|olcumu|guvenilir)\w*\b/.test(normalized)
  ) {
    return "measurement"
  }

  const hasExposureOutcomeEvidenceFrame =
    /\b(?:cocukluk adversitesi|cocukluk kotu muamelesi|sosyal tamponlama|fiziksel aktivite|ekran suresi|uyku suresi|ebeveyn destegi|calisma bellegi egitim\w*|duyusal esik|duygu dinamikleri|allostatik yuk|dikkat aglari modeli|hrv)\b/.test(normalized) &&
    /\b(?:yukselt\w*|azalt\w*|gelistir\w*|boz\w*|acikla\w*|artir\w*|calis\w*|olculebilir|olcmek mumkun|aktarim|desteklen\w*|ortak esik|ne kadar iyi)\b/.test(normalized)
  if (hasExposureOutcomeEvidenceFrame) return "evidence"

  if (
    /\btek bir\b.+\b(?:merkez|dugme)\w*\b/.test(normalized) ||
    /\bsabit bir ozellik\b/.test(normalized) ||
    /\bdemek\b.+\b(?:neden|niye)\b.+\b(?:sorunlu|sakincali|yanlis)\w*\b/.test(normalized) ||
    /\bayrim\s+yapilabilir\s+mi\b/.test(normalized)
  ) {
    return "misconception"
  }

  if (/\bhangi tek olcum\b/.test(normalized)) return "measurement"

  const hasExplicitEvidenceCue = /\b(?:kanit\w*|bilimsel|guvenilir\w*|gecerli\w*|gecerlik|biyobelirtec\w*|nedensel\w*|nedensellik|ongor\w*|tahmin\w*|kalici|aktaril\w*|tartismali|yerlesik|dogrulan\w*|taniyabilir|yeterli|kisilik ozelligi|dikkatle kullan\w*|tek basina|tek bir|kesin bag|kesin mi|kesin olarak|her zaman|riskli\w*|iyi midir|kotu mu|sorun mudur|ne kadar guclu|ne kadar guven\w*|ne kadar uyus\w*|calisma var mi|belirler mi|dogrudan belirler|dogrudan olc\w*|kontrol eder mi|bastirir mi)\b/.test(
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
    if (hasExplicitEvidenceCue) {
      return "evidence"
    }
    return "dna_relation"
  }

  if (
    /\b(?:yok mudur|daha iyi mi|merkezidir|merkezi midir|kontrol eden yer|demekki|demek ki)\b/.test(normalized) ||
    /\b(?:yuksekse|dusukse)\b.+\b(?:yuksek|dusuk)\b/.test(normalized)
  ) {
    return "misconception"
  }

  if (!hasExplicitEvidenceCue && /\b(?:iliski\w*|bag\w*|alaka\w*|katki\w*|rol oyn\w*|katil\w* mi|birlikte mi calis\w*|ilgili olabilir mi|dogrudan degistir\w* mi)\b/.test(normalized)) {
    if (/\bhangi islev\w*le iliskili\b/.test(normalized)) return "definition"
    return "relation"
  }

  // These phrases ask about co-activation/covariation, not whether a single
  // proposition is a misconception.
  if (/\b(?:ayni anda|ayni yonde)\b/.test(normalized)) {
    return "relation"
  }

  // When a paediatric measurement question explicitly asks for its limits,
  // the age/developmental scope is the governing intent.
  if (/\bcocuk\w*\b.+\b(?:gelisimsel sinir\w*|yas kapsam\w*)\b/.test(normalized)) {
    return "development"
  }

  // Measurement actions and named physiological metrics are stronger than a
  // broad age word. Reliability/validity questions remain evidence questions.
  if (
    !hasExplicitEvidenceCue &&
    (/\b(?:nasil olcul\w*|neyi (?:olcer|olcu\w*)|ne olcer|olcmek mumkun\w*|sensor\w*|test bataryasi|hangi islevler degerlendirilir|neyi ifade eder|olcum\w* neden zor\w*|hangi olcum\w* gosterir|dogrudan\w* olcum\w*)\b/.test(normalized) ||
      /\bhangi tek olcum\b/.test(normalized) ||
      /\b(?:pep|rmssd|hf hrv|lf hrv|lf hf|pupillometri)\b/.test(normalized))
  ) {
    return "measurement"
  }

  const hasDevelopmentCue = /\b(?:erken cocukluk|cocuklukta|uc yas|\d+\s+\d+\s+yas\w*|okul cagi\w*|okul oncesi|ergen\w*|yenidogan\w*|bebek\w*|infant\w*|puberte|prematur\w*|dogumda|hangi yas\w*|kac yas\w*|yas ilerledikce|yasla|olgunlas\w*|yetiskin\w*.+cocuk\w*|cocuk\w*.+yetiskin\w*)\b/.test(
    normalized,
  )
  const hasDominantDevelopmentCue = /\b(?:yas ilerledikce|tek normal deger|cocuk\w*.+sinir\w*)\b/.test(normalized)
  if (hasDevelopmentCue && (!hasExplicitEvidenceCue || hasDominantDevelopmentCue)) {
    return "development"
  }

  if (hasExplicitEvidenceCue) {
    return "evidence"
  }

  if (
    containsAny(normalized, ["ilişk", "ilisk", "bağ", "bag", "alaka", "etkiler", "etkileyebilir", "katkı", "katki", "bağlantı", "baglanti"]) ||
    /\b(?:rol oyn\w*|katil\w* mi|birlikte mi calis\w*|ilgili olabilir mi)\b/.test(normalized)
  ) {
    return "relation"
  }

  if (containsAny(normalized, ["çocuk", "cocuk", "yaşa göre", "yasa gore", "geliş", "gelis", "ergen"])) {
    return "development"
  }

  if (containsAny(normalized, [
    "nedir",
    "nelerdir",
    "ne demek",
    "neyin kısaltması",
    "neyin kisaltmasi",
    "ne anlama",
    "ne kastediliyor",
    "ne işe yarar",
    "ne ise yarar",
    "ne ise yari",
    "ne yapar",
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
    "dediğimiz yer",
    "dedigimiz yer",
    "beynin neresinde",
    "hangisi doğru",
    "hangisi dogru",
    "hangi süreçleri kapsar",
    "hangi surecleri kapsar",
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
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = new RegExp(`(?:^|\\s)${escaped}`).exec(normalizedQuestion)
  if (!match) return -1
  return match.index + (match[0].startsWith(" ") ? 1 : 0)
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
    if (normalizedQuestion === normalizedAlias) bestAliasScore = Math.max(bestAliasScore, 60)
    else if (normalizedAlias.length <= 3 && questionTokens.has(normalizedAlias)) {
      bestAliasScore = Math.max(bestAliasScore, 9)
    }
    else if (normalizedAlias.length > 3 && aliasIndex >= 0) {
      const aliasWordCount = normalizedAlias.split(" ").length
      bestAliasScore = Math.max(
        bestAliasScore,
        aliasWordCount >= 3 ? 48 : normalizedAlias.includes(" ") ? 14 : 8,
      )
    }
  }
  score = Math.max(score, bestAliasScore)

  let keywordScore = 0
  for (const normalizedKeyword of index.keywords) {
    if (normalizedKeyword && termIndex(normalizedQuestion, normalizedKeyword) >= 0) {
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
  if (/^(?:peki\s+)?erken cocuklukta (?:nasil|nasil degisir|ne degisir)$/.test(normalized)) {
    return topicFromPreviousContext(previousTopic)
  }
  const explicitTopic = explicitTopicForQuestion(normalized)
  if (explicitTopic) return explicitTopic
  const queryKind = classifyCatalogQueryKind(question)
  const hasMeasurementCue = /\b(?:olcum\w*|olcul\w*|gorev\w*|test\w*|anket\w*|olcek\w*|fmri|mri|bold|hep|maia y|baglantisallik|uyarim)\b/.test(normalized)
  const hasDevelopmentCue = /\b(?:gelisim\w*|olgunlas\w*|bebek\w*|erken cocukluk|okul cagi|hangi yas\w*|kac yas\w*|yasla)\b/.test(normalized)

  const scored = DNA_CHAT_CATALOG_TOPICS
    .map((topic) => ({ topic, ...scoreTopic(normalized, topic) }))
  const firstMention = Math.min(
    ...scored.filter((entry) => entry.firstIndex >= 0).map((entry) => entry.firstIndex),
  )
  const ranked = scored
    .map((entry) => ({
      ...entry,
      score: entry.score +
        (entry.firstIndex >= 0 && entry.firstIndex === firstMention ? 30 : 0) +
        (entry.score > 0 && entry.firstIndex >= 0 && entry.topic.id.includes("measurement") && (queryKind === "measurement" || hasMeasurementCue) ? 45 : 0) +
        (entry.score > 0 && entry.firstIndex >= 0 && entry.topic.id.includes("development") && (queryKind === "development" || hasDevelopmentCue) ? 35 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.topic.id.localeCompare(b.topic.id))

  if ((ranked[0]?.score ?? 0) >= 5) return ranked[0].topic

  if (
    previousTopic &&
    containsAny(normalized, ["bu", "bunun", "peki", "biraz daha", "ilişkisi", "iliskisi"])
  ) {
    return topicFromPreviousContext(previousTopic)
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
