import { DNA_CHAT_CANONICAL_BENCHMARK_TABLES } from "./canonicalBenchmarkData"
import {
  DNA_CHAT_CATALOG_VERSION,
  DNA_CHAT_RESEARCH_PACK_CATEGORIES,
  type DnaChatCatalogBenchmarkQuestion,
  type DnaChatCatalogCategory,
  type DnaChatQueryKind,
  type DnaChatResearchPackId,
} from "./types"

type CanonicalQuestionRow = {
  sourcePackId: DnaChatResearchPackId
  sourceCategory: DnaChatCatalogCategory
  sourceCode: string
  sourceQuestionCategory: string | null
  question: string
  expectedLabel: string
  sourceAnswerGuidance: string | null
  sourceCitationCodes: string | null
  canonicalRow: string
  semanticFamily: string
}

const PACK_ID_PREFIX: Record<DnaChatResearchPackId, string> = {
  self_regulation: "selfreg",
  central_nervous_system: "cns",
  autonomic_nervous_system: "ans",
  sympathetic_parasympathetic: "sympara",
  prefrontal_processes: "pfc",
  anterior_cingulate_cortex: "acc",
  insular_cortex: "insula",
  interoception: "interoception",
  arousal_reactivity: "arousal",
  recovery_self_organization: "recovery",
  sensory_modulation: "sensory",
  emotion_regulation: "emotion",
  stress_systems: "stress",
  sleep_daily_rhythm: "sleep",
  executive_functions: "executive",
  attention_working_memory: "attention",
  case_report_boundaries: "case-boundary",
  dna_six_domains: "six-domains",
  developmental_differences: "development",
  coregulation: "coregulation",
}

function normalizeBenchmarkText(value: string): string {
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

function parseCanonicalRows(
  sourcePackId: DnaChatResearchPackId,
  table: string,
): CanonicalQuestionRow[] {
  const sourceCategory = DNA_CHAT_RESEARCH_PACK_CATEGORIES[sourcePackId]
  return table.trim().split("\n").map((canonicalRow) => {
    const cells = canonicalRow.split("|").slice(1, -1).map((cell) => cell.trim())
    if (cells.length < 3 || cells.length > 6) {
      throw new Error(`${sourcePackId}: geçersiz kanonik soru satırı: ${canonicalRow}`)
    }
    const [sourceCode, sourceQuestionCategory, question, expectedLabel, sourceAnswerGuidance, sourceCitationCodes] = cells.length >= 4
      ? [cells[0], cells[1], cells[2], cells[3], cells[4] ?? null, cells[5] ?? null]
      : [cells[0], null, cells[1], cells[2], null, null]
    if (!sourceCode || !question || !expectedLabel) {
      throw new Error(`${sourcePackId}: eksik kanonik soru alanı: ${canonicalRow}`)
    }
    return {
      sourcePackId,
      sourceCategory,
      sourceCode,
      sourceQuestionCategory,
      question,
      expectedLabel,
      sourceAnswerGuidance,
      sourceCitationCodes,
      canonicalRow,
      semanticFamily: normalizeBenchmarkText(question),
    }
  })
}

const canonicalRows = (Object.entries(DNA_CHAT_CANONICAL_BENCHMARK_TABLES) as Array<
  [DnaChatResearchPackId, string]
>).flatMap(([sourcePackId, table]) => parseCanonicalRows(sourcePackId, table))

const LIVE_CATALOG_ADDITIONAL_SAFETY_REFUSAL_QUESTION_IDS = new Set([
  "sympathetic_parasympathetic:S-065",
  "sympathetic_parasympathetic:S-070",
  "sympathetic_parasympathetic:S-064",
  "sympathetic_parasympathetic:S-069",
  "autonomic_nervous_system:Q49",
  "sympathetic_parasympathetic:S-062",
  "sympathetic_parasympathetic:S-068",
  "anterior_cingulate_cortex:S060",
  "prefrontal_processes:Q49",
  "stress_systems:Q118",
  "sleep_daily_rhythm:SB-101",
  "case_report_boundaries:Q-074",
])

function stableFamilyHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const familyContainsRefusal = new Map<string, boolean>()
for (const row of canonicalRows) {
  familyContainsRefusal.set(
    row.semanticFamily,
    (familyContainsRefusal.get(row.semanticFamily) ?? false) ||
      row.expectedLabel === "Güvenli ret" ||
      LIVE_CATALOG_ADDITIONAL_SAFETY_REFUSAL_QUESTION_IDS.has(
        `${row.sourcePackId}:${row.sourceCode}`,
      ),
  )
}

function isHoldoutFamily(row: CanonicalQuestionRow): boolean {
  // Selection is stable across ordering changes. Forty percent leaves a safe margin
  // above the 30% acceptance gate; a refusal anywhere in a duplicate-text family
  // puts the whole family in holdout.
  return familyContainsRefusal.get(row.semanticFamily) === true ||
    stableFamilyHash(row.semanticFamily) % 100 < 40
}

const CANONICAL_QUERY_KIND_OVERRIDES = new Map<string, DnaChatQueryKind | null>([
  ["autonomic_nervous_system:Q26", "misconception"],
  ["autonomic_nervous_system:Q62", "misconception"],
  ["arousal_reactivity:Q19", "misconception"],
  ["emotion_regulation:SQ060", "measurement"],
  ["case_report_boundaries:Q-003", "definition"],
  ["case_report_boundaries:Q-047", "evidence"],
  ["case_report_boundaries:Q-051", "evidence"],
  ["case_report_boundaries:Q-053", "misconception"],
  ["case_report_boundaries:Q-055", null],
  ["case_report_boundaries:Q-060", "evidence"],
  ["case_report_boundaries:Q-063", "evidence"],
  ["case_report_boundaries:Q-070", "definition"],
  ["case_report_boundaries:Q-088", "misconception"],
  ["case_report_boundaries:Q-104", "definition"],
  ["dna_six_domains:S-059", "evidence"],
  ["dna_six_domains:S-070", "evidence"],
  ["developmental_differences:S009", "definition"],
  ["developmental_differences:S041", "development"],
  ["developmental_differences:S001", "definition"],
  ["developmental_differences:S013", "relation"],
  ["developmental_differences:S043", "relation"],
])

function inferExpectedQueryKind(row: CanonicalQuestionRow): DnaChatQueryKind | null {
  // Annotation is independent from the runtime classifier. An explicit
  // question category is the strongest document signal; in three-column
  // tables the wording itself outranks the requested answer format (for
  // example, an "ilişki var mı?" question may still request a kanıt özeti).
  const category = normalizeBenchmarkText(row.sourceQuestionCategory ?? "")
  const label = normalizeBenchmarkText(row.expectedLabel)
  const question = normalizeBenchmarkText(row.question)

  if (label === "guvenli ret" || label === "bilgi bulunamadi") return null
  const overrideKey = `${row.sourcePackId}:${row.sourceCode}`
  if (CANONICAL_QUERY_KIND_OVERRIDES.has(overrideKey)) {
    return CANONICAL_QUERY_KIND_OVERRIDES.get(overrideKey) ?? null
  }

  if (
    /\b(?:farki\w*|fark var|fark nedir|farkli\w*|ayni sey\w*|ayni terim|ayni kavram|ayni yapi|ayni bilesen|ayni mi\w*|ayni \w+(?: \w+)? (?:midir|mudur)|karsit\w*|birbirine ters|nasil ayril\w*|anlamina gelir mi)\b/.test(question) ||
    /\b(?:yalniz|tamamen)\b.+\b(?:midir|mudur)\b/.test(question) ||
    /\bmi\b.+\bmi\b.+\b(?:dogru|uygun)\b/.test(question)
  ) {
    return "comparison"
  }
  const evidenceCue = /\b(?:kanit\w*|bilimsel|guvenilir\w*|gecerli\w*|gecerlik|biyobelirtec\w*|nedensel\w*|ongor\w*|kalici|aktaril\w*|tartismali|dogrulan\w*|yeterli|neden zor|dikkatle|tek basina|her zaman|kisilik ozelligi|ne kadar guclu|ne kadar guven\w*|ne kadar uyus\w*|kesin bag|kesin mi|kesin olarak|calisma var mi|belirler mi|dogrudan olc\w*|kontrol eder mi|bastirir mi)\b/.test(question)
  if (/\bdna\b/.test(question)) return evidenceCue ? "evidence" : "dna_relation"

  if (
    category === "yanlis varsayim" ||
    /\b(?:yok mudur|daha iyi mi|merkezidir|merkezi midir|kontrol eden yer|demekki|demek ki)\b/.test(question) ||
    /\b(?:yuksekse|dusukse)\b.+\b(?:yuksek|dusuk)\b/.test(question)
  ) return "misconception"

  if (/\b(?:puberte|ergenlik|yasla|olgunlas\w*|\d+\s+\d+\s+yas\w*)\b/.test(question)) {
    return "development"
  }
  if (/\bcocuk\w*\b.+\bsinir\w*\b/.test(question)) return "development"
  if (/\b(?:nasil olcul\w*|neyi (?:olcer|olcu\w*)|ne olcer|olcum\w*|hangi olcum|sensor\w*|test bataryasi|neyi ifade eder|dogrudan\w* olcum\w*)\b/.test(question)) {
    return "measurement"
  }
  if (/\b(?:erken cocukluk|cocuklukta|okul cagi|okul oncesi|bebek\w*|yenidogan\w*|infant\w*|ergen\w*|puberte|prematur\w*|dogumda|\d+\s+\d+\s+yas\w*|hangi yas|kac yas|yas ilerledikce|yasla|olgunlas\w*|yetiskin\w*.+cocuk\w*|cocuk\w*.+yetiskin\w*)\b/.test(question)) {
    return "development"
  }
  if (/\b(?:ayni anda|ayni yonde)\b/.test(question)) return "relation"
  if (evidenceCue) return "evidence"
  if (/\bhangi islev\w*le iliskili\b/.test(question)) return "definition"
  if (/\b(?:iliski\w*|bag\w*|baglanti\w*|katki\w*|etkiler|etkileyebilir|rol oyn\w*|katil\w* mi|birlikte mi calis\w*|ilgili olabilir mi|dogrudan degistir\w* mi)\b/.test(question)) {
    return "relation"
  }
  if (/\b(?:nedir|ne demek|ne anlama|ne kastediliyor|ne ise yarar|neyi gosterir|nasil calisir|icinde midir|ne yani|dedigimiz yer|beynin neresinde)\b/.test(question)) {
    return "definition"
  }

  if (category === "dna iliskisi") return "dna_relation"
  if (category === "olcum") return "measurement"
  if (category === "gelisim" || category.startsWith("gelisimsel") || label.startsWith("gelisimsel")) return "development"
  if (category === "kanit") return "evidence"
  if (category === "karsilastirma" || label === "karsilastirma") return "comparison"
  if (category === "tanim" || label === "tanim") return "definition"
  // Ayrıntı, kuramsal ilişki and kanıt özeti labels describe the desired
  // response shape, not necessarily the user's lexical intent. Ambiguous rows
  // therefore stay outside the query-kind accuracy denominator.
  return null
}

type TopicRule = {
  topicId: string
  patterns: readonly RegExp[]
}

const TOPIC_RULES: readonly TopicRule[] = [
  { topicId: "case.ai_oversight", patterns: [/\b(?:ai|yapay zeka)\w*.+\b(?:rapor|ozet|kaynak|denetim|objektif|gecerlik)\w*/, /\botomasyon yanlilig\w*/] },
  { topicId: "case.change_interpretation", patterns: [/\b(?:minimal saptanabilir degisim|guvenilir degisim indeksi|mdc|ortalamaya regresyon|uygulama etkisi|puan degisimi)\b/] },
  { topicId: "case.measurement_uncertainty", patterns: [/\b(?:olcum hatasi|standart olcum hatasi|guven araligi|puan belirsizligi)\b/] },
  { topicId: "case.multi_informant", patterns: [/\b(?:bilgi veren uyusmazligi|ebeveyn ve ogretmen|ebeveyn ogretmen|proxy bildirim|coklu bilgi veren)\b/] },
  { topicId: "case.development_culture", patterns: [/\b(?:olcum degismezligi|kulturel adalet|kulturel gecerlik|kulturel uyarlama|yas esdegeri|yas normu|ceviri)\w*/] },
  { topicId: "case.screening_diagnosis", patterns: [/\b(?:tarama|tarisal degerlendirme|tani degerlendirmesi|pozitif yordayici deger|prevalans|kesme puaninin dogrulugu)\w*/] },
  { topicId: "case.score_interpretation", patterns: [/\b(?:norm grubu|yuzdelik|persentil|kesme puani|ham puan|standart puan|norm referansli|olcut referansli)\w*/] },
  { topicId: "case.validity_reliability", patterns: [/\b(?:gecerlik|guvenirlik|guvenilirlik|cronbach|alfa katsayisi|mutlak uyum|icerik gecerligi|yapi gecerligi)\w*/] },
  { topicId: "case.capacity_performance", patterns: [/\bkapasite\w*.+\b(?:performans|katilim)\w*/, /\bperformans gorevi\w*.+\bgunluk yasam\w*/, /\bekolojik gecerlik\b/] },
  { topicId: "case.contextual_variability", patterns: [/\bbaglamsal degiskenlik\b/, /\bevde\w*.+\bokulda\w*/] },
  { topicId: "case.causal_biological_boundary", patterns: [/\b(?:korelasyon ile nedensellik|grup bulgusu ile bireysel|biyolojik cikarim|beyin bolgesi cikarimi)\b/] },
  { topicId: "case.report_communication", patterns: [/\b(?:rapor dili|veri yorum ve hipotez|guclu yonler\w* rapor|aile\w* anlasilabilir)\b/] },
  { topicId: "case.interpretation_boundaries", patterns: [/\b(?:vaka ve rapor yorum siniri|vaka yorum siniri|rapor yorum siniri)\b/] },
  { topicId: "dna.six_domains", patterns: [/\bdna\w*.+\balti alan\w*/, /\balti alan\w*.+\b(?:dna|faktor|bagimsiz|beyin)\w*/] },
  { topicId: "dna.physiological_regulation", patterns: [/\b(?:dna\w*.+)?fizyolojik regulasyon (?:alani|puani)\b/, /\bfizyolojik regulasyon alani\b/] },
  { topicId: "dna.sensory_regulation", patterns: [/\b(?:dna\w*.+)?duyusal regulasyon (?:alani|puani)\b/, /\bduyusal regulasyon alani\b/] },
  { topicId: "dna.emotional_regulation", patterns: [/\b(?:dna\w*.+)?duygusal regulasyon (?:alani|puani)\b/, /\bduygusal regulasyon alani\b/] },
  { topicId: "dna.cognitive_regulation", patterns: [/\b(?:dna\w*.+)?bilissel regulasyon (?:alani|puani)\b/, /\bbilissel regulasyon alani\b/] },
  { topicId: "dna.executive_function_domain", patterns: [/\bdna\w*.+\byurutucu islev alani\b/, /\byurutucu islev alani\b/] },
  { topicId: "dna.interoception_domain", patterns: [/\bdna\w*.+\binterosepsiyon alani\b/, /\binterosepsiyon (?:alani|puani)\b/] },
  { topicId: "dna.capacity_performance", patterns: [/\bkapasite\w*.+\b(?:performans|katilim)\w*/] },
  { topicId: "dna.measurement_levels", patterns: [/\b(?:olcum duzeyleri|gorev ile derecelendirme|fizyolojik olcum ile davranissal gozlem|alan toplam puani)\b/] },
  { topicId: "dna.domain_overlap", patterns: [/\b(?:alan ortusmesi|birincil ve ikincil alan|alanlar arasi fark|bir davranis\w*.+birden cok alan)\b/] },
  { topicId: "dna.functional_profile", patterns: [/\bdna (?:profili|raporu)\b/, /\bdestege yanit\b.+\bprofil\w*/] },
  { topicId: "development.age_equivalent_limits", patterns: [/\b(?:gelisimsel yas|yas esdegeri)\b/] },
  { topicId: "development.measurement_invariance", patterns: [/\b(?:olcum degismezligi|yerel norm|baska kulturde|kulturel gecerlik)\b/] },
  { topicId: "development.screening_assessment", patterns: [/\bgelisimsel (?:gozetim|tarama|degerlendirme)\b/] },
  { topicId: "development.informant_context", patterns: [/\b(?:ebeveyn ve ogretmen|ebeveyn ogretmen|bilgi veren)\w*.+\b(?:fark|puan|uyus)\w*/] },
  { topicId: "development.supported_performance", patterns: [/\b(?:destekli performans|destekle yapilan|korunmus kapasite)\b/] },
  { topicId: "development.person_environment", patterns: [/\b(?:kisi cevre uyumu|cevresel talep|evde\w*.+okulda\w*)\b/] },
  { topicId: "development.neurodiversity", patterns: [/\b(?:norocesitlilik|noroayrisma|transdiagnostik)\w*/] },
  { topicId: "development.plasticity", patterns: [/\b(?:duyarli donem|kritik donem|plastisite)\w*/] },
  { topicId: "development.pathways", patterns: [/\b(?:essonluluk|coksonluluk|gelisimsel kaskad)\w*/] },
  { topicId: "development.uneven_profile", patterns: [/\b(?:sivri profil|dengesiz profil|eszamanli gelis)\w*/] },
  { topicId: "development.trajectory", patterns: [/\bgelisimsel (?:yorunge|hiz)\w*/] },
  { topicId: "development.variability", patterns: [/\b(?:bireysel farklilik ile birey ici|birey ici degiskenlik|gunlere gore degis)\w*/] },
  { topicId: "development.differences", patterns: [/\bgelisimsel farklilik\w*/] },
  { topicId: "selfreg.coregulation_measurement", patterns: [/\b(?:es regulasyon|ko regulasyon|senkroni)\w*.+\b(?:olcum|degerlendir|kanit|gozlem)\w*/] },
  { topicId: "selfreg.coregulation_development", patterns: [/(?:\b(?:bebeklik|erken cocukluk|okul oncesi|okul cagi|\d+\s*\d+ yas)\w*.+\bes regulasyon\b|\bes regulasyon\b.+\b(?:yas|gelisim|bebek|okul)\w*)/] },
  { topicId: "selfreg.coregulation_culture", patterns: [/\b(?:goz temasi|dokunma|kultur)\w*.+\b(?:es regulasyon|duzenleyici|daha iyi)\w*/] },
  { topicId: "selfreg.dyadic_synchrony", patterns: [/\b(?:davranissal eszamanlilik|fizyolojik eszamanlilik|dyadik eszamanlilik|ebeveyn cocuk senkronisi|kalp ritmi eszamanliligi|noral eszamanlilik)\b/] },
  { topicId: "selfreg.codyregulation", patterns: [/\b(?:es duzensizlik|ortak sikinti|karsilikli tirmanma)\b/] },
  { topicId: "selfreg.interaction_repair", patterns: [/\b(?:etkilesim onarimi|uyumsuzluk onarimi|still face)\b/] },
  { topicId: "selfreg.caregiver_sensitivity", patterns: [/\b(?:bakimveren duyarliligi|ebeveyn duyarliligi|duyarlilik ile yanitlayicilik)\b/] },
  { topicId: "selfreg.social_buffering", patterns: [/\bsosyal tamponlama\b/] },
  { topicId: "selfreg.coregulation_scaffolding", patterns: [/\b(?:iskeleleme|ongorulebilir yapi|ozerklik destegi|kati kontrol|asiri yardim)\b/] },
  { topicId: "selfreg.cortisol_measurement", patterns: [/\b(?:kortizol|cortisol)\b/, /\b(?:tukuruk|sac) kortizol\w*/, /\b(?:kortizol uyanma yaniti|car)\b/] },
  { topicId: "selfreg.hpa_axis", patterns: [/\bhpa\b/, /\bhipotalam\w*.+\bhipofiz\w*.+\badrenal\w*/, /\b(?:crh|acth)\b/] },
  { topicId: "selfreg.toxic_stress", patterns: [/\btoksik stres\b/, /\btoxic stress\b/] },
  { topicId: "ans.allostatic_load", patterns: [/\ballostatik yuk\b/, /\ballostatic load\b/, /\bkumlatif biyolojik yuk\b/] },
  { topicId: "selfreg.stress_systems", patterns: [/\bstres sistem\w*/, /\bstres yanit\w*/, /\bstresor\w*/, /\bstres fizyoloj\w*/] },
  { topicId: "selfreg.sleep_measurement", patterns: [/\buyku\w*.+\b(?:olcum|olcul|anket|olcek|gunluk|aktigraf|polisomnograf|psg|akilli saat|cshq|bisq|cctq)\w*/, /\b(?:aktigrafi|actigraphy|polisomnografi|psg|cshq|bisq|cctq|uyku gunlugu)\b/] },
  { topicId: "selfreg.sleep_development", patterns: [/\b(?:bebek|cocuk|okul oncesi|okul cagi|yas)\w*.+\buyku\w*/, /\buyku\w*.+\b(?:gelisim|yas|bebek|cocuk|gunduz uykusu)\w*/] },
  { topicId: "selfreg.sleep_regulation", patterns: [/\b(?:iki surec|two process|process s|process c|homeostatik uyku|uyku baskisi)\w*/] },
  { topicId: "selfreg.circadian_rhythm", patterns: [/\b(?:sirkadiyen|circadian)\w*/, /\bbiyolojik saat\b/, /\b(?:scn|suprakiazmatik)\b/] },
  { topicId: "selfreg.daily_rhythm", patterns: [/\bgunluk ritim\b/, /\buyku uyaniklik ritmi\b/, /\bdinlenme etkinlik ritmi\b/, /\b24 saatlik oruntu\b/] },
  { topicId: "selfreg.sleep_health", patterns: [/\buyku sagligi\b/, /\buyku kalitesi\b/, /\buyku suresi\b/, /\buyku duzeni\b/, /\buyku\b/] },
  { topicId: "cns.working_memory_measurement", patterns: [/\bcalisma bellegi\w*.+\b(?:olcum|olcul|test|gorev|span|sayi dizisi|guvenir)\w*/, /\b(?:basit span|karmasik span|geri span|sayi dizisi)\b/] },
  { topicId: "cns.working_memory_development", patterns: [/\bcalisma bellegi\w*.+\b(?:gelisim|yas|bebek|cocuk|okul)\w*/, /\b(?:bebek|cocuk|okul oncesi|okul cagi|yas)\w*.+\bcalisma bellegi\b/] },
  { topicId: "cns.executive_development", patterns: [/\byurutucu islev\w*.+\b(?:gelisim|yas|cocuk|okul oncesi|olgunlas)\w*/, /\b(?:bebek|cocuk|okul oncesi|yas)\w*.+\byurutucu islev\w*/, /\bgorev safsizlig\w*/] },
  { topicId: "cns.executive_models", patterns: [/\byurutucu islev model\w*/, /\bbirlik ve cesitlilik\b/, /\bunity and diversity\b/, /\byurutucu bilesen\w*/] },
  { topicId: "cns.attention_measurement", patterns: [/\bdikkat\w*.+\b(?:olcum|olcul|test|gorev|olcek|cpt|guvenir)\w*/, /\b(?:surekli performans testi|cpt|tepki suresi degiskenligi)\b/] },
  { topicId: "cns.attention_development", patterns: [/\bdikkat\w*.+\b(?:gelisim|yas|bebek|cocuk|okul)\w*/, /\b(?:bebek|cocuk|okul oncesi|okul cagi|yas)\w*.+\bdikkat\w*/] },
  { topicId: "cns.attention_networks", patterns: [/\bdikkat ag\w*/, /\battention network\w*/, /\buyarilma ag\w*/, /\byoneltme ag\w*/, /\byurutucu dikkat\b/, /\bant\b/] },
  { topicId: "cns.sustained_attention", patterns: [/\bsurdur\w* dikkat\b/, /\buzun sure dikkat\b/, /\bvigilance\b/, /\byanlis alarm\b/, /\bkacirma hatasi\b/] },
  { topicId: "cns.selective_attention", patterns: [/\bsecici dikkat\b/, /\bselective attention\b/, /\bdikkat dagitici\w*.+\b(?:eleme|secme|yonel)\w*/] },
  { topicId: "cns.attention", patterns: [/\bdikkat\b/, /\bodaklan\w*/] },
  { topicId: "selfreg.recovery_measurement", patterns: [/\btoparlan\w*.+\b(?:olcum|olcul|sure|biyobelirtec|hrv|rsa|eda|kortizol|bazal)\w*/, /\b(?:normal toparlanma suresi|toparlanma biyobelirteci|bazale donus)\b/] },
  { topicId: "selfreg.self_organization", patterns: [/\boz orgutlen\w*/, /\bself organization\b/, /\bdinamik sistem\w*/, /\bcekici durum\b/, /\battractor\b/] },
  { topicId: "selfreg.habituation", patterns: [/\bhabituasyon\w*/, /\b(?:uyarana )?alisma\b/, /\bduyusal adaptasyon\b/] },
  { topicId: "selfreg.sensory_measurement", patterns: [/\bduyusal\w*.+\b(?:olcum|olcul|anket|olcek|test|arac|gozlem|performans|psikometr)\w*/, /\b(?:sensory profile|duyusal profil|bakimveren anketi)\b/] },
  { topicId: "selfreg.sensory_modulation", patterns: [/\bduyusal modulasyon\b/, /\bduyusal (?:reaktivite|yanitlilik|asiri yanit|dusuk yanit|arayis|hassasiyet|kacinma)\w*/, /\b(?:dusuk kayit|dunn modeli|sensory modulation|sensory seeking)\b/] },
  { topicId: "selfreg.emotion_measurement", patterns: [/\bduygu\w* duzenle\w*.+\b(?:olcum|olcul|anket|olcek|gorev|gozlem|ema|gunluk)\w*/, /\b(?:duygu dinamigi|duygu degiskenligi|duygu ataleti|ekolojik anlik degerlendirme)\b/] },
  { topicId: "selfreg.emotion_strategies", patterns: [/\bduygu\w* duzenle\w* strateji\w*/, /\b(?:yeniden degerlendirme|bastirma|kabul|dikkat dagitma|duzenleme esnekligi|regulatory flexibility)\b/] },
  { topicId: "selfreg.emotion_regulation", patterns: [/\bduygu duzenleme\b/, /\bduygusal (?:duzenleme|regulasyon)\b/, /\bemotion regulation\b/] },
  { topicId: "selfreg.arousal", patterns: [/\buyarilma\w*/, /\buyarilmislik\w*/, /\barousal\b/, /\boptimal uyarilma\b/] },
  { topicId: "ans.polyvagal", patterns: [/\b(?:poli|poly)vagal\b/, /\bdorsal vagal\b/, /\bventral vagal\b/, /\bvagal shutdown\b/] },
  { topicId: "ans.autonomic_space", patterns: [/\botonom uzam\b/, /\bsempatovagal denge\b/, /\bsempatik ve parasempatik sistemler ayni anda\b/] },
  { topicId: "ans.measurement_limits", patterns: [/\botonom test\b/, /\botonom olcum\b/, /\bans olcum\b/, /\bgiyilebilir\b/, /\bakilli saat\b/, /\becg\b/, /\bppg\b/, /\bpep\b/, /\bpupillometri\b/, /\bbarorefleks\b/] },
  { topicId: "cns.central_autonomic_network", patterns: [/\bmerkezi otonom ag\b/, /\bcentral autonomic network\b/, /\bcan\b/] },
  { topicId: "cns.reverse_inference", patterns: [/\btersine cikarim\b/, /\bdavranistan beyin bolgesi\b/, /\blokalizasyon hatasi\b/] },
  { topicId: "cns.distributed_networks", patterns: [/\bdagitik beyin ag/, /\bdagitik ag/, /\btek bir oz duzenleme merkezi\b/, /\bag duzeyi aciklama\b/] },
  { topicId: "cns.midcingulate", patterns: [/\b(?:anterior |posterior )?midcingulate\b/, /\b(?:anterior |posterior )?orta singulat\b/, /\bamcc\b/, /\bpmcc\b/] },
  { topicId: "cns.error_related_negativity", patterns: [/\bhata iliskili negatiflik\b/, /\bern\b/] },
  { topicId: "cns.cingulo_opercular_network", patterns: [/\bcingulo opercular\b/, /\bsingulo operkular\b/] },
  { topicId: "cns.performance_monitoring", patterns: [/\bperformans izleme\b/, /\bhata izleme\b/, /\bcatism[a-z]* izleme\b/, /\bfrontal orta hat theta\b/, /\bn2 bileseni\b/] },
  { topicId: "cns.anterior_cingulate", patterns: [/\banterior singulat\b/, /\bon singulat\b/, /\banterior cingulate\b/, /\b(?:dacc|racc|sgacc|pgacc|acc)\b/] },
  { topicId: "cns.salience_network", patterns: [/\bsalience (?:ag|network)/, /\bonem ag/, /\bbelirginlik ag/] },
  { topicId: "cns.prefrontal_development", patterns: [/\bprefrontal (?:korteks )?(?:gelisim|olgunlas)/, /\bpfc (?:gelisim|olgunlas)/, /\bcocuklarda prefrontal surec/] },
  { topicId: "cns.executive_measurement", patterns: [/\bderecelendirme olceg/, /\bperformans test/, /\bekolojik gecerlilik\b/, /\bolcum yontemi uyusmazlig/] },
  { topicId: "cns.working_memory", patterns: [/\bcalisma bellegi\b/] },
  { topicId: "cns.inhibitory_control", patterns: [/\b(?:inhibisyon|inhibitor kontrol|ketleyici kontrol)\b/] },
  { topicId: "cns.cognitive_flexibility", patterns: [/\bbilissel esneklik\b/] },
  { topicId: "cns.prefrontal_control", patterns: [/\bprefrontal korteks\b/, /\bprefrontal surec/, /\bprefontal\b/, /\bfrontal lob\b/, /\bprefrontal cortex\b/, /\borbitofrontal\b/, /\bdorsolateral\b/, /\bventromedial\b/, /\bmultiple demand\b/] },
  { topicId: "cns.insula_development", patterns: [/\b(?:bebek|cocuk)\w*.+\binsula\w* (?:gelisim|olgunlas)/, /\binsula\w*.+\b(?:gelisim|olgunlas)/] },
  { topicId: "cns.insula_measurement", patterns: [/\binsula\w*.+\b(?:fmri|bold|hep|mri|baglantisallik|kortikal uyarim)\b/] },
  { topicId: "cns.insula_subregions", patterns: [/\b(?:anterior|posterior|granuler|agranuler)\w*.+\binsula\b/, /\binsular lateralizasyon\b/, /\bop2 pivc\b/] },
  { topicId: "cns.insula", patterns: [/\binsular korteks\b/, /\binsula\b/] },
  { topicId: "selfreg.self_control", patterns: [/\bself kontrol\b/, /\boz kontrol\b/] },
  { topicId: "selfreg.executive_functions", patterns: [/\byurutucu islev/, /\bexecutive function/, /\bketleyici kontrol\b/, /\binhibitor kontrol\b/, /\bcalisma bellegi\b/, /\bbilissel esneklik\b/] },
  { topicId: "selfreg.coregulation", patterns: [/\bes regulasyon\b/, /\bko regulasyon\b/, /\bco regulation\b/] },
  { topicId: "selfreg.reactivity_recovery", patterns: [/\breaktivite\b/, /\btepkisellik\b/, /\btoparlanma\b/, /\btepki yogunlugu\b/, /\btepki gecikmesi\b/] },
  { topicId: "ans.allostasis", patterns: [/\ballostaz\w*/, /\ballostatik\w*/] },
  { topicId: "ans.homeostasis", patterns: [/\bhomeostaz\w*/] },
  { topicId: "ans.hrv", patterns: [/\bhrv\b/, /\bhrw\b/, /\brsa\b/, /\brmssd\b/, /\bhf hrv\b/, /\blf hrv\b/, /\blf hf\b/, /\bkalp hizi degiskenlig/] },
  { topicId: "ans.eda", patterns: [/\beda\b/, /\belektrodermal\b/, /\bderi iletkenlig/] },
  { topicId: "ans.interoception_measurement", patterns: [/\binterosep\w*.+\b(?:olcum|olcul|gorev|test)\w*/, /\b(?:hep|maia y|kalp atimi sayma|kalp atisi sayma|kalp atimi ayirt etme|kalbini sayamiyorsa)\b/] },
  { topicId: "ans.interoception_development", patterns: [/\b(?:bebek|cocuk|erken cocukluk|okul cagi)\w*.+\binterosep/, /\binterosep\w*.+\b(?:gelisim|yasla|norm)\w*/] },
  { topicId: "ans.interoception_dimensions", patterns: [/\binteroseptif (?:dogruluk|duyarlilik|farkindalik|metabilis)/, /\bmaia y\b/] },
  { topicId: "ans.interoception_modalities", patterns: [/\binterosep\w*.+\b(?:kardiyak|solunumsal|gastrointestinal|aclik|tokluk|tuvalet|yorgunluk|nosisepsiyon)\b/, /\b(?:kardiyak|solunumsal|gastrointestinal|aclik|tokluk|tuvalet|yorgunluk|nosisepsiyon)\w*.+\binterosep/] },
  { topicId: "ans.interoception", patterns: [/\binterosepsiyon\b/, /\binteroseptif\b/, /\bbeden sinyal/, /\bic duyum\b/] },
  { topicId: "ans.sympathetic_parasympathetic", patterns: [/\bsempatik\b/, /\bparasempatik\b/] },
  { topicId: "selfreg.core", patterns: [/\bself regulasyon\w*/, /\boz duzenleme\w*/] },
  { topicId: "cns.overview", patterns: [/\bmerkezi sinir sistemi\b/, /\bcns\b/] },
  { topicId: "ans.overview", patterns: [/\botonom sinir sistemi\b/, /\botonom sistem\b/, /\bans\b/] },
]

const CANONICAL_TOPIC_ANNOTATION_OVERRIDES = new Map<string, string>([
  ["self_regulation:SB-50", "dna.cognitive_regulation"],
  ["central_nervous_system:Q44", "dna.cognitive_regulation"],
  ["sympathetic_parasympathetic:S-066", "dna.interoception_domain"],
  ["prefrontal_processes:Q50", "dna.interoception_domain"],
  ["prefrontal_processes:Q51", "dna.executive_function_domain"],
  ["interoception:S055", "dna.physiological_regulation"],
  ["interoception:S056", "dna.sensory_regulation"],
  ["interoception:S057", "dna.emotional_regulation"],
  ["arousal_reactivity:Q17", "selfreg.cortisol_measurement"],
  ["arousal_reactivity:Q53", "dna.emotional_regulation"],
  ["recovery_self_organization:S-055", "dna.physiological_regulation"],
  ["recovery_self_organization:S-057", "dna.emotional_regulation"],
  ["recovery_self_organization:S-064", "dna.six_domains"],
  ["emotion_regulation:SQ061", "dna.emotional_regulation"],
  ["emotion_regulation:SQ063", "dna.physiological_regulation"],
  ["sleep_daily_rhythm:SB-072", "dna.emotional_regulation"],
  ["sleep_daily_rhythm:SB-074", "dna.executive_function_domain"],
  ["executive_functions:S008", "cns.executive_models"],
  ["executive_functions:S061", "dna.executive_function_domain"],
  ["case_report_boundaries:Q-020", "case.multi_informant"],
  ["case_report_boundaries:Q-077", "dna.interoception_domain"],
  ["dna_six_domains:S-015", "cns.executive_models"],
  ["dna_six_domains:S-042", "dna.cognitive_regulation"],
  ["dna_six_domains:S-047", "cns.executive_models"],
  ["dna_six_domains:S-071", "case.multi_informant"],
  ["dna_six_domains:S-086", "dna.cognitive_regulation"],
  ["developmental_differences:S023", "development.differences"],
  ["developmental_differences:S064", "development.differences"],
  ["coregulation:S035", "selfreg.coregulation_measurement"],
  ["coregulation:S049", "selfreg.coregulation_measurement"],
  ["coregulation:S071", "selfreg.coregulation"],
  ["self_regulation:SB-32", "selfreg.development"],
  ["self_regulation:SB-27", "selfreg.emotion_regulation"],
  ["autonomic_nervous_system:Q20", "ans.development"],
  ["autonomic_nervous_system:Q21", "ans.development"],
  ["prefrontal_processes:Q03", "cns.prefrontal_control"],
  ["prefrontal_processes:Q10", "cns.prefrontal_development"],
  ["prefrontal_processes:Q23", "selfreg.emotion_regulation"],
  ["anterior_cingulate_cortex:S012", "cns.performance_monitoring"],
  ["anterior_cingulate_cortex:S037", "cns.prefrontal_control"],
  ["insular_cortex:TS68", "ans.interoception"],
  ["interoception:S057", "selfreg.emotion_regulation"],
  ["arousal_reactivity:Q31", "selfreg.sensory_modulation"],
  ["arousal_reactivity:Q32", "selfreg.reactivity_recovery"],
  ["arousal_reactivity:Q33", "selfreg.reactivity_recovery"],
  ["arousal_reactivity:Q34", "selfreg.sensory_modulation"],
  ["arousal_reactivity:Q35", "selfreg.sensory_measurement"],
  ["arousal_reactivity:Q52", "dna.sensory_regulation"],
  ["recovery_self_organization:S-026", "selfreg.reactivity_recovery"],
  ["recovery_self_organization:S-047", "ans.hrv"],
  ["recovery_self_organization:S-060", "selfreg.reactivity_recovery"],
  ["recovery_self_organization:S-039", "selfreg.emotion_regulation"],
  ["recovery_self_organization:S-014", "selfreg.coregulation"],
  ["recovery_self_organization:S-037", "selfreg.coregulation"],
  ["recovery_self_organization:S-038", "selfreg.coregulation"],
  ["sensory_modulation:S026", "selfreg.habituation"],
  ["sensory_modulation:S055", "selfreg.sensory_modulation"],
  ["emotion_regulation:SQ002", "selfreg.reactivity_recovery"],
  ["emotion_regulation:SQ011", "selfreg.emotion_regulation"],
  ["emotion_regulation:SQ021", "selfreg.executive_functions"],
  ["emotion_regulation:SQ022", "cns.inhibitory_control"],
  ["emotion_regulation:SQ025", "selfreg.arousal"],
  ["emotion_regulation:SQ050", "selfreg.reactivity_recovery"],
  ["emotion_regulation:SQ058", "selfreg.emotion_measurement"],
  ["emotion_regulation:SQ047", "selfreg.coregulation"],
  ["emotion_regulation:SQ060", "selfreg.emotion_measurement"],
  ["emotion_regulation:SQ004", "selfreg.coregulation"],
  ["emotion_regulation:SQ073", "selfreg.emotion_regulation"],
  ["self_regulation:SB-29", "cns.attention_measurement"],
  ["sleep_daily_rhythm:SB-013", "selfreg.sleep_health"],
  ["sleep_daily_rhythm:SB-014", "selfreg.sleep_health"],
  ["executive_functions:S007", "cns.performance_monitoring"],
  ["executive_functions:S048", "selfreg.sleep_health"],
  ["sleep_daily_rhythm:SB-073", "selfreg.sleep_health"],
  ["self_regulation:SB-83", "dna.six_domains"],
  ["autonomic_nervous_system:Q50", "ans.polyvagal"],
  ["sympathetic_parasympathetic:S-018", "selfreg.stress_systems"],
  ["arousal_reactivity:Q23", "selfreg.social_buffering"],
  ["sensory_modulation:S049", "dna.sensory_regulation"],
  ["recovery_self_organization:S-083", "selfreg.coregulation"],
  ["emotion_regulation:SQ018", "selfreg.sleep_health"],
  ["emotion_regulation:SQ020", "dna.functional_profile"],
  ["emotion_regulation:SQ040", "selfreg.coregulation"],
  ["emotion_regulation:SQ064", "dna.sensory_regulation"],
  ["emotion_regulation:SQ097", "selfreg.sleep_health"],
  ["stress_systems:Q015", "selfreg.social_buffering"],
  ["stress_systems:Q036", "selfreg.social_buffering"],
  ["stress_systems:Q059", "selfreg.social_buffering"],
  ["executive_functions:S006", "selfreg.executive_functions"],
  ["attention_working_memory:SQ052", "cns.working_memory"],
  ["attention_working_memory:SQ055", "cns.working_memory"],
  ["case_report_boundaries:Q-016", "case.capacity_performance"],
  ["case_report_boundaries:Q-019", "case.report_communication"],
  ["case_report_boundaries:Q-047", "development.overview"],
  ["case_report_boundaries:Q-052", "development.overview"],
  ["case_report_boundaries:Q-055", "selfreg.coregulation"],
  ["case_report_boundaries:Q-072", "dna.physiological_regulation"],
  ["case_report_boundaries:Q-078", "dna.six_domains"],
  ["case_report_boundaries:Q-080", "case.change_interpretation"],
  ["dna_six_domains:S-003", "dna.physiological_regulation"],
  ["dna_six_domains:S-004", "dna.sensory_regulation"],
  ["dna_six_domains:S-006", "dna.cognitive_regulation"],
  ["dna_six_domains:S-009", "selfreg.coregulation"],
  ["dna_six_domains:S-048", "dna.measurement_levels"],
  ["dna_six_domains:S-050", "selfreg.coregulation"],
  ["dna_six_domains:S-062", "selfreg.coregulation_development"],
  ["dna_six_domains:S-075", "case.causal_biological_boundary"],
  ["dna_six_domains:S-077", "cns.executive_measurement"],
  ["dna_six_domains:S-088", "dna.capacity_performance"],
  ["dna_six_domains:S-089", "selfreg.coregulation"],
  ["dna_six_domains:S-119", "selfreg.emotion_regulation"],
  ["developmental_differences:S018", "dna.functional_profile"],
  ["developmental_differences:S028", "development.overview"],
  ["developmental_differences:S048", "development.overview"],
  ["developmental_differences:S057", "development.overview"],
  ["developmental_differences:S067", "dna.six_domains"],
  ["developmental_differences:S076", "development.differences"],
  ["coregulation:S014", "selfreg.coregulation"],
  ["coregulation:S031", "selfreg.coregulation_scaffolding"],
  ["coregulation:S047", "development.overview"],
  ["coregulation:S069", "selfreg.coregulation"],
  ["coregulation:S101", "selfreg.coregulation"],
  ["self_regulation:SB-29", "dna.measurement_levels"],
  ["attention_working_memory:SQ036", "dna.measurement_levels"],
  ["prefrontal_processes:Q41", "case.contextual_variability"],
  ["recovery_self_organization:S-053", "selfreg.coregulation"],
  ["emotion_regulation:SQ074", "selfreg.emotion_strategies"],
  ["dna_six_domains:S-049", "dna.physiological_regulation"],
  ["coregulation:S027", "selfreg.social_buffering"],
  ["coregulation:S063", "selfreg.coregulation"],
])

function inferExpectedTopicId(row: CanonicalQuestionRow): string | null {
  // Conservative semantic annotation against the published live-topic scope.
  // This list is deliberately independent from catalog search scores/aliases so
  // the benchmark can expose routing regressions instead of mirroring them.
  const normalized = normalizeBenchmarkText(row.question)
  const questionCategory = normalizeBenchmarkText(row.sourceQuestionCategory ?? "")

  // Follow-up rows require an explicit previousTopic at runtime; the canonical
  // standalone benchmark intentionally does not smuggle package identity in as context.
  if (questionCategory.startsWith("takip")) return null

  const annotationOverride = CANONICAL_TOPIC_ANNOTATION_OVERRIDES.get(
    `${row.sourcePackId}:${row.sourceCode}`,
  )
  if (annotationOverride) return annotationOverride

  if (/\byetiskin self regulasyon\w*.+\bsabit bir ozellik\b/.test(normalized)) {
    return "selfreg.core"
  }

  if (/^hep\b/.test(normalized)) return "ans.interoception_measurement"

  if (row.sourcePackId === "stress_systems") {
    if (/^(?:Q004|Q007|Q026|Q097)$/.test(row.sourceCode)) {
      return "selfreg.hpa_axis"
    }
    if (/^(?:Q006|Q021|Q027|Q030|Q031|Q032|Q057)$/.test(row.sourceCode)) {
      return "selfreg.cortisol_measurement"
    }
    if (/^(?:Q009|Q033|Q054)$/.test(row.sourceCode)) {
      return "ans.allostatic_load"
    }
    if (row.sourceCode === "Q008") return "ans.allostasis"
    if (/^(?:Q010|Q053|Q101)$/.test(row.sourceCode)) {
      return "selfreg.toxic_stress"
    }
    if (/^(?:Q012|Q013|Q023|Q046|Q047|Q058)$/.test(row.sourceCode)) {
      return "selfreg.reactivity_recovery"
    }
    if (/^(?:Q014|Q024)$/.test(row.sourceCode)) return "selfreg.habituation"
    if (/^(?:Q028|Q029|Q056)$/.test(row.sourceCode)) return "ans.hrv"
    if (row.sourceCode === "Q036") return "selfreg.coregulation"
    if (/^(?:Q037|Q105)$/.test(row.sourceCode)) return "ans.interoception"
    if (row.sourceCode === "Q005") return "ans.overview"
    if (/^(?:Q001|Q002|Q003|Q011|Q016|Q025|Q055|Q061|Q096)$/.test(row.sourceCode)) {
      return "selfreg.stress_systems"
    }
    return null
  }

  if (row.sourcePackId === "sleep_daily_rhythm") {
    if (/^(?:SB-003|SB-005|SB-006|SB-015|SB-016|SB-025|SB-093)$/.test(row.sourceCode)) {
      return "selfreg.daily_rhythm"
    }
    if (/^(?:SB-004|SB-026|SB-054)$/.test(row.sourceCode)) {
      return "selfreg.circadian_rhythm"
    }
    if (/^(?:SB-020|SB-021)$/.test(row.sourceCode)) return "selfreg.sleep_regulation"
    if (/^(?:SB-028|SB-029|SB-062|SB-063|SB-064|SB-065|SB-066|SB-067|SB-068|SB-069)$/.test(row.sourceCode)) {
      return "selfreg.sleep_measurement"
    }
    if (/^(?:SB-033|SB-034|SB-035|SB-036|SB-037|SB-038|SB-041|SB-043|SB-095)$/.test(row.sourceCode)) {
      return "selfreg.sleep_development"
    }
    if (/^(?:SB-001|SB-002|SB-007|SB-044|SB-045|SB-046|SB-047|SB-072|SB-074|SB-080|SB-091)$/.test(row.sourceCode)) {
      return "selfreg.sleep_health"
    }
    return null
  }

  if (row.sourcePackId === "executive_functions") {
    if (/^(?:S003|S013|S033|S062|S073)$/.test(row.sourceCode)) return "cns.working_memory"
    if (/^(?:S004|S012|S014)$/.test(row.sourceCode)) return "cns.inhibitory_control"
    if (/^(?:S005|S015|S023|S034)$/.test(row.sourceCode)) return "cns.cognitive_flexibility"
    if (/^(?:S008|S021|S022|S024|S025)$/.test(row.sourceCode)) {
      return "cns.executive_development"
    }
    if (/^(?:S010|S017|S018|S051|S052|S053|S054|S055|S056|S057|S060)$/.test(row.sourceCode)) {
      return "cns.executive_measurement"
    }
    if (row.sourceCode === "S019") return "cns.attention"
    if (/^(?:S011|S031|S032|S035|S036|S037|S061|S063)$/.test(row.sourceCode)) {
      return "selfreg.executive_functions"
    }
    if (/^(?:S001|S002|S009|S071)$/.test(row.sourceCode)) {
      return "cns.executive_models"
    }
    return null
  }

  if (row.sourcePackId === "attention_working_memory") {
    if (/^(?:SQ002|SQ006|SQ008|SQ009|SQ013|SQ016|SQ022|SQ023|SQ024|SQ062|SQ092|SQ094)$/.test(row.sourceCode)) {
      return "cns.working_memory"
    }
    if (/^(?:SQ007|SQ034|SQ039)$/.test(row.sourceCode)) return "cns.working_memory_measurement"
    if (/^(?:SQ042|SQ044|SQ046|SQ048)$/.test(row.sourceCode)) return "cns.working_memory_development"
    if (/^(?:SQ003|SQ018|SQ019|SQ045|SQ091)$/.test(row.sourceCode)) {
      return "cns.sustained_attention"
    }
    if (/^(?:SQ004|SQ014|SQ030|SQ031|SQ032)$/.test(row.sourceCode)) return "cns.selective_attention"
    if (/^(?:SQ005|SQ051)$/.test(row.sourceCode)) return "cns.attention_networks"
    if (/^(?:SQ036|SQ040|SQ043|SQ096)$/.test(row.sourceCode)) {
      return "cns.attention_measurement"
    }
    if (/^(?:SQ041|SQ047)$/.test(row.sourceCode)) return "cns.attention_development"
    if (/^(?:SQ001|SQ010|SQ017|SQ021|SQ025|SQ026|SQ061|SQ093)$/.test(row.sourceCode)) {
      return "cns.attention"
    }
    return null
  }

  const mentionsInteroception = /\b(?:inter[oa]sep\w*|beden sinyal\w*|ic beden|ic duyum)\b/.test(normalized)
  if (mentionsInteroception) {
    if (/\bmaia y\b/.test(normalized) && /\bdogruluk\b/.test(normalized)) {
      return "ans.interoception_dimensions"
    }
    if (/\b(?:olcum\w*|olcul\w*|gorev\w*|test\w*|hep|maia y|kalp\w* say\w*|kalbini say\w*|kalp atimi ayirt|fmri)\b/.test(normalized)) {
      return "ans.interoception_measurement"
    }
    if (/\b(?:gelisim\w*|yasla|hangi yas|kac yas|norm\w*|bebek\w*|yetiskin\w*.+cocuk\w*|cocuk\w*.+yetiskin\w*)\b/.test(normalized)) {
      return "ans.interoception_development"
    }
    if (/^interosepsiyon\b.+\binteroseptif (?:dogruluk|duyarlilik|farkindalik)\b/.test(normalized)) {
      return "ans.interoception"
    }
    if (/\b(?:dogruluk|duyarlilik|farkindalik|metabilis\w*|oz bildirimli beden|maia y)\b/.test(normalized)) {
      return "ans.interoception_dimensions"
    }
    if (/\b(?:kardiyak|solunumsal|gastrointestinal|aclik|acik\w*|tokluk|tuvalet|yorgunluk|nosisepsiyon|agri)\b/.test(normalized)) {
      return "ans.interoception_modalities"
    }
    const interoceptionIndex = normalized.search(/\binterosep/)
    const competingIndex = normalized.search(/\b(?:prefrontal|prefontal|pfc|insula|insular|acc|hrv|es regulasyon|ko regulasyon)\b/)
    if (interoceptionIndex >= 0 && (competingIndex < 0 || interoceptionIndex <= competingIndex)) {
      return "ans.interoception"
    }
  }

  if (/\b(?:es regulasyon|ko regulasyon)\b/.test(normalized) && /\binterosep/.test(normalized)) {
    return null
  }

  if (row.sourcePackId === "prefrontal_processes") {
    if (/\b(?:olgunlas|gelisim\w*|cocukluk boyunca|hangi yas|yasla)\b/.test(normalized) && /\b(?:prefrontal|pfc|yurutucu islev)\b/.test(normalized)) {
      return "cns.prefrontal_development"
    }
    if (/\b(?:derecelendirme olceg|performans test|ekolojik gecerlilik|test puani|gunluk gozlem|olcum yontemi)\b/.test(normalized)) {
      return "cns.executive_measurement"
    }
    const firstPerformanceCue = normalized.search(/\b(?:catism\w* izleme|hata izleme|performans izleme)\b/)
    const firstInhibitionCue = normalized.search(/\b(?:inhibisyon|inhibitor kontrol|ketleyici kontrol)\b/)
    if (firstPerformanceCue >= 0 && (firstInhibitionCue < 0 || firstPerformanceCue < firstInhibitionCue)) {
      return "cns.performance_monitoring"
    }
    if (/\bcalisma bellegi\b/.test(normalized)) return "cns.working_memory"
    if (firstInhibitionCue >= 0) return "cns.inhibitory_control"
    if (/\bbilissel esneklik\b/.test(normalized)) return "cns.cognitive_flexibility"
    if (/\b(?:prefrontal|prefontal|pfc|frontoparietal|multiple demand|dorsolateral|ventromedial|orbitofrontal)\b/.test(normalized)) {
      return "cns.prefrontal_control"
    }
  }

  if (row.sourcePackId === "insular_cortex") {
    if (/\b(?:bebek\w*|cocuk\w*|erken yasam|0 5 yas|6 12 yas|gelisim|olgun)\b/.test(normalized) && /\b(?:insula|insular)\b/.test(normalized)) {
      return "cns.insula_development"
    }
    if (/\b(?:fmri|bold|hep|uyarim|baglantisallik|parselasyon|mri)\b/.test(normalized)) {
      return "cns.insula_measurement"
    }
    if (/\b(?:anterior insula|posterior insula|granuler|agranuler|op2|pivc|lateralizasyon|alt bolge\w*)\b/.test(normalized)) {
      return "cns.insula_subregions"
    }
    if (/\b(?:insula|insular)\w*\b/.test(normalized)) return "cns.insula"
  }

  if (row.sourcePackId === "interoception") {
    if (/\b(?:hangi yas|kac yas|yasindan|yasla|gelisim)\b/.test(normalized)) {
      return "ans.interoception_development"
    }
    if (/\b(?:olcum|gorev|test|anket|olcek|hep|altin standart|gecerli|guvenilir|kalibrasyon|kalp atimi sayma|kalp atimi ayirt|sinyal tespit)\b/.test(normalized)) {
      return "ans.interoception_measurement"
    }
    if (/\b(?:dogruluk|duyarlilik|farkindalik|oznel egilim|metabilissel|ust bilissel|guven puani|maia y)\b/.test(normalized)) {
      return "ans.interoception_dimensions"
    }
    if (/\b(?:kardiyak|solunumsal|gastrik|aclik|susuzluk|mesane|bagirsak|termal|agr[iı]|yorgunluk|efor|modalite)\b/.test(normalized)) {
      return "ans.interoception_modalities"
    }
    if (/\b(?:interosepsiyon|interoseptif|beden sinyal|ic sinyal|ic duyum)\b/.test(normalized)) {
      return "ans.interoception"
    }
  }

  if (row.sourcePackId === "arousal_reactivity") {
    if (/\btoparlan\w*.+\b(?:olcum|sure|biyobelirtec|hrv|rsa|eda|kortizol|bazal)\w*/.test(normalized)) {
      return "selfreg.recovery_measurement"
    }
    if (/\b(?:uyarilma|uyarilmislik|arousal|tonik|fazik)\w*/.test(normalized)) {
      return "selfreg.arousal"
    }
    if (/\b(?:reaktivite|tepkisellik|toparlanma|tepki buyuklugu|tepki gecikmesi)\w*/.test(normalized)) {
      return "selfreg.reactivity_recovery"
    }
  }

  if (row.sourcePackId === "recovery_self_organization") {
    if (/\b(?:oz orgutlen|self organization|dinamik sistem|cekici durum|attractor)\w*/.test(normalized)) {
      return "selfreg.self_organization"
    }
    if (/\b(?:habituasyon|uyarana alisma|duyusal adaptasyon)\w*/.test(normalized)) {
      return "selfreg.habituation"
    }
    if (/\btoparlan\w*.+\b(?:olcum|sure|biyobelirtec|hrv|rsa|eda|kortizol|bazal|norm)\w*/.test(normalized)) {
      return "selfreg.recovery_measurement"
    }
    if (/\b(?:toparlanma|reaktivite|tepkisellik)\w*/.test(normalized)) {
      return "selfreg.reactivity_recovery"
    }
  }

  if (row.sourcePackId === "sensory_modulation") {
    if (/\bduyusal\w*.+\b(?:olcum|olcul|anket|olcek|test|arac|gozlem|performans|psikometr)\w*/.test(normalized) || /\b(?:sensory profile|duyusal profil|bakimveren anketi)\b/.test(normalized)) {
      return "selfreg.sensory_measurement"
    }
    if (/\b(?:duyusal modulasyon\w*|duyusal reaktivite\w*|duyusal yanitlilik\w*|asiri yanitlilik\w*|dusuk yanitlilik\w*|duyusal arayis\w*|dusuk kayit\w*|dunn modeli\w*|duyusal esik\w*|duyusal hassasiyet\w*|duyusal kacinma\w*)\b/.test(normalized)) {
      return "selfreg.sensory_modulation"
    }
  }

  if (row.sourcePackId === "emotion_regulation") {
    if (/\bduygu\w* duzenle\w*.+\b(?:olcum|olcul|anket|olcek|gorev|gozlem|ema|gunluk)\w*/.test(normalized) || /\b(?:duygu dinamik\w*|duygu degiskenligi|duygu ataleti|ekolojik anlik degerlendirme)\b/.test(normalized)) {
      return "selfreg.emotion_measurement"
    }
    if (/\b(?:duygu\w* duzenle\w* strateji|yeniden degerlendirme|bastirma|kabul|dikkat dagitma|duzenleme esnekligi|regulatory flexibility)\b/.test(normalized)) {
      return "selfreg.emotion_strategies"
    }
    if (/\b(?:duygu duzenleme|duygusal duzenleme|duygusal regulasyon|emotion regulation)\b/.test(normalized)) {
      return "selfreg.emotion_regulation"
    }
    if (/\b(?:duygusal reaktivite|duygusal tepkisellik)\b/.test(normalized)) {
      return "selfreg.reactivity_recovery"
    }
  }

  if (
    /\b(?:cocuk|bebek|yenidogan|infant|okul oncesi|ergen|yetiskin|yas|norm|puberte|prematur)\b/.test(normalized) &&
    /\b(?:hrv|rsa|otonom|ans)\b/.test(normalized)
  ) return "ans.development"
  if (
    /\b(?:cocuk|erken cocukluk|okul cagi|ergen|yetiskin|yas)\b/.test(normalized) &&
    /\b(?:self regulasyon|oz duzenleme|regulasyon)\b/.test(normalized)
  ) return "selfreg.development"
  if (/\b(?:tek bir oz duzenleme merkezi|ag duzeyi aciklama)\b/.test(normalized)) {
    return "cns.distributed_networks"
  }
  if (/\bhomeostaz\w*/.test(normalized) && /\ballostaz\w*/.test(normalized)) {
    return "ans.allostasis"
  }

  let best: { topicId: string; index: number; length: number; ruleIndex: number } | null = null
  for (let ruleIndex = 0; ruleIndex < TOPIC_RULES.length; ruleIndex += 1) {
    const rule = TOPIC_RULES[ruleIndex]
    if (!rule) continue
    for (const pattern of rule.patterns) {
      const match = pattern.exec(normalized)
      if (!match) continue
      const candidate = { topicId: rule.topicId, index: match.index, length: match[0].length, ruleIndex }
      if (
        !best || candidate.index < best.index ||
        (candidate.index === best.index && candidate.length > best.length) ||
        (candidate.index === best.index && candidate.length === best.length && candidate.ruleIndex < best.ruleIndex)
      ) best = candidate
    }
  }
  return best?.topicId ?? null
}

const LIVE_CATALOG_UNSUPPORTED_QUESTION_IDS = new Set([
  // These raw-pack questions name a real topic, but the source-verified live
  // subset does not yet contain the exact claim or one-hop relation required
  // to answer them. Keeping the disposition explicit prevents a topic hit
  // from being mistaken for scientific answerability.
  "self_regulation:SB-10",
  "self_regulation:SB-13",
  "self_regulation:SB-17",
  "self_regulation:SB-22",
  "self_regulation:SB-30",
  "self_regulation:SB-34",
  "self_regulation:SB-46",
  "central_nervous_system:Q20",
  "central_nervous_system:Q26",
  "central_nervous_system:Q30",
  "central_nervous_system:Q33",
  "autonomic_nervous_system:Q05",
  "autonomic_nervous_system:Q13",
  "autonomic_nervous_system:Q14",
  "autonomic_nervous_system:Q28",
  "autonomic_nervous_system:Q30",
  "autonomic_nervous_system:Q42",
  "sympathetic_parasympathetic:S-039",
  "sympathetic_parasympathetic:S-023",
  "sympathetic_parasympathetic:S-041",
  "sympathetic_parasympathetic:S-042",
  "sympathetic_parasympathetic:S-050",
  "sympathetic_parasympathetic:S-051",
  "sympathetic_parasympathetic:S-056",
  "sympathetic_parasympathetic:S-082",
  "autonomic_nervous_system:Q11",
  "sympathetic_parasympathetic:S-011",
  "prefrontal_processes:Q07",
  "prefrontal_processes:Q11",
  "prefrontal_processes:Q14",
  "prefrontal_processes:Q20",
  "prefrontal_processes:Q24",
  "prefrontal_processes:Q27",
  "prefrontal_processes:Q30",
  "prefrontal_processes:Q32",
  "prefrontal_processes:Q34",
  "prefrontal_processes:Q45",
  "prefrontal_processes:Q63",
  "prefrontal_processes:Q65",
  "anterior_cingulate_cortex:S015",
  "anterior_cingulate_cortex:S016",
  "anterior_cingulate_cortex:S021",
  "anterior_cingulate_cortex:S022",
  "anterior_cingulate_cortex:S024",
  "anterior_cingulate_cortex:S025",
  "anterior_cingulate_cortex:S026",
  "anterior_cingulate_cortex:S027",
  "anterior_cingulate_cortex:S028",
  "anterior_cingulate_cortex:S030",
  "anterior_cingulate_cortex:S033",
  "anterior_cingulate_cortex:S035",
  "anterior_cingulate_cortex:S040",
  "anterior_cingulate_cortex:S046",
  "anterior_cingulate_cortex:S048",
  "anterior_cingulate_cortex:S039",
  "anterior_cingulate_cortex:S045",
  "anterior_cingulate_cortex:S051",
  "anterior_cingulate_cortex:S052",
  "insular_cortex:TS24",
  "insular_cortex:TS26",
  "insular_cortex:TS28",
  "insular_cortex:TS31",
  "insular_cortex:TS32",
  "insular_cortex:TS33",
  "insular_cortex:TS35",
  "insular_cortex:TS42",
  "insular_cortex:TS30",
  "insular_cortex:TS34",
  "insular_cortex:TS36",
  "insular_cortex:TS38",
  "insular_cortex:TS39",
  "interoception:S005",
  "interoception:S010",
  "interoception:S019",
  "interoception:S020",
  "interoception:S025",
  "interoception:S035",
  "interoception:S039",
  "interoception:S041",
  "interoception:S063",
  "interoception:S081",
  "central_nervous_system:Q57",
  "recovery_self_organization:S-060",
  "central_nervous_system:Q36",
  "sympathetic_parasympathetic:S-052",
  "arousal_reactivity:Q11",
  "arousal_reactivity:Q13",
  "arousal_reactivity:Q24",
  "arousal_reactivity:Q25",
  "arousal_reactivity:Q26",
  "recovery_self_organization:S-020",
  "recovery_self_organization:S-022",
  "recovery_self_organization:S-027",
  "recovery_self_organization:S-034",
  "sensory_modulation:S012",
  "sensory_modulation:S017",
  "sensory_modulation:S025",
  "sensory_modulation:S031",
  "sensory_modulation:S035",
  "emotion_regulation:SQ012",
  "emotion_regulation:SQ013",
  "emotion_regulation:SQ026",
  "emotion_regulation:SQ031",
  "autonomic_nervous_system:Q45",
  "sympathetic_parasympathetic:S-063",
  "insular_cortex:TS48",
  "insular_cortex:TS49",
  "arousal_reactivity:Q55",
  "recovery_self_organization:S-058",
  "sensory_modulation:S014",
  "anterior_cingulate_cortex:S050",
  "anterior_cingulate_cortex:S059",
  "insular_cortex:TS47",
  "arousal_reactivity:Q07",
  "arousal_reactivity:Q22",
  "arousal_reactivity:Q36",
  "arousal_reactivity:Q43",
  "arousal_reactivity:Q44",
  "arousal_reactivity:Q47",
  "arousal_reactivity:Q49",
  "arousal_reactivity:Q72",
  "recovery_self_organization:S-036",
  "recovery_self_organization:S-043",
  "recovery_self_organization:S-050",
  "recovery_self_organization:S-059",
  "sensory_modulation:S013",
  "sensory_modulation:S018",
  "sensory_modulation:S024",
  "sensory_modulation:S027",
  "sensory_modulation:S034",
  "sensory_modulation:S052",
  "sensory_modulation:S054",
  "emotion_regulation:SQ030",
  "emotion_regulation:SQ041",
  "emotion_regulation:SQ044",
  "emotion_regulation:SQ056",
  "emotion_regulation:SQ064",
  // V4 denetimi: konu mevcut olsa da sorunun istediği özgül ayrım, ilişki
  // veya gelişim iddiası doğrulanmış canlı claim/tek-adımlı kenarda yoktur.
  "self_regulation:SB-15",
  "self_regulation:SB-35",
  "self_regulation:SB-36",
  "sympathetic_parasympathetic:S-049",
  "anterior_cingulate_cortex:S041",
  "arousal_reactivity:Q18",
  "recovery_self_organization:S-039",
  "sensory_modulation:S053",
  // V5 canlı alt kümesi: katalog ilgili üst kavramı içeriyor olsa da aşağıdaki
  // soruların istediği tek-en-güçlü eşleme, mizaç ayrımı, ölçüm üstünlüğü,
  // bağlanma ayrımı veya ortak dikkat kanıtı için doğrudan kayıt yoktur.
  "anterior_cingulate_cortex:S064",
  "developmental_differences:S029",
  "developmental_differences:S051",
  "coregulation:S026",
  "coregulation:S035",
  "stress_systems:Q011",
  "stress_systems:Q014",
  "stress_systems:Q021",
  "stress_systems:Q030",
  "stress_systems:Q046",
  "stress_systems:Q047",
  "stress_systems:Q055",
  "stress_systems:Q057",
  "stress_systems:Q101",
  "sleep_daily_rhythm:SB-005",
  "sleep_daily_rhythm:SB-034",
  "sleep_daily_rhythm:SB-043",
  "sleep_daily_rhythm:SB-044",
  "sleep_daily_rhythm:SB-062",
  "sleep_daily_rhythm:SB-080",
  "executive_functions:S012",
  "executive_functions:S014",
  "executive_functions:S017",
  "executive_functions:S023",
  "executive_functions:S057",
  "attention_working_memory:SQ022",
  "attention_working_memory:SQ023",
  "attention_working_memory:SQ024",
  "attention_working_memory:SQ025",
  "attention_working_memory:SQ043",
  "attention_working_memory:SQ044",
  "attention_working_memory:SQ093",
  "attention_working_memory:SQ096",
  "anterior_cingulate_cortex:S057",
  "anterior_cingulate_cortex:S058",
  "insular_cortex:TS45",
  "insular_cortex:TS46",
  "arousal_reactivity:Q51",
  "arousal_reactivity:Q56",
  "recovery_self_organization:S-056",
])

function buildBenchmarkQuestion(row: CanonicalQuestionRow): DnaChatCatalogBenchmarkQuestion {
  const isRefusal = row.expectedLabel === "Güvenli ret" ||
    LIVE_CATALOG_ADDITIONAL_SAFETY_REFUSAL_QUESTION_IDS.has(`${row.sourcePackId}:${row.sourceCode}`)
  const expectedTopicId = inferExpectedTopicId(row)
  const isCanonicalNotAvailable = row.expectedLabel === "Bilgi bulunamadı"
  const lacksPublishedSupport = LIVE_CATALOG_UNSUPPORTED_QUESTION_IDS.has(
    `${row.sourcePackId}:${row.sourceCode}`,
  )
  const evaluationScope = isRefusal
    ? "safety_refusal" as const
    : isCanonicalNotAvailable || !expectedTopicId || lacksPublishedSupport
      ? "unsupported_safe" as const
      : "supported_answerable" as const

  return Object.freeze({
    version: DNA_CHAT_CATALOG_VERSION,
    id: `benchmark.${PACK_ID_PREFIX[row.sourcePackId]}.${row.sourceCode.toLocaleLowerCase("tr-TR")}`,
    sourcePackId: row.sourcePackId,
    sourceCategory: row.sourceCategory,
    sourceCode: row.sourceCode,
    sourceQuestionCategory: row.sourceQuestionCategory,
    documentExpected: row.expectedLabel,
    sourceAnswerGuidance: row.sourceAnswerGuidance,
    sourceCitationCodes: row.sourceCitationCodes,
    canonicalRow: row.canonicalRow,
    semanticFamily: row.semanticFamily,
    question: row.question,
    expectedQueryKind: inferExpectedQueryKind(row),
    expectedTopicId,
    expected: isRefusal ? "refusal" : evaluationScope === "supported_answerable" ? "answer" : "not_available",
    evaluationScope,
    // Safety rows are always evaluated out-of-sample, including the additional
    // live-catalog refusals whose source documents used a softer answer label.
    holdout: isRefusal || isHoldoutFamily(row),
  })
}

export const DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS: readonly DnaChatCatalogBenchmarkQuestion[] =
  Object.freeze(canonicalRows.map(buildBenchmarkQuestion))
