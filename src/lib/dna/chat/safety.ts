import { redactReportTextForPrivacy } from "../reportPrivacy"
import { VERIFIED_LITERATURE_SOURCES } from "../literatureNote"
import { DNA_INTELLIGENCE_PUBLIC_INTENDED_USE } from "./intendedUse"
import {
  DNA_CHAT_CATALOG_SAFETY_RULES,
  classifyCatalogQueryKind,
} from "./catalog"
import { normalizeDnaChatText } from "./text"
import type { DnaChatSafetyCategory, DnaChatSafetyResult } from "./types"

const NATIONAL_ID_PATTERN = /\b[1-9][0-9]{10}\b/g
const BIRTH_DATE_PATTERN = /\b\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}\b/g
const LABELED_NAME_PATTERN = /\b(?:ad(?:\s+soyad)?|soyad|isim|hasta(?:\s+ad(?:ı|i))?|danışan(?:\s+ad(?:ı|i))?|danisan(?:\s+ad(?:i|ı))?|çocuk(?:\s+ad(?:ı|i))?|cocuk(?:\s+ad(?:i|ı))?)\s*[:=-]\s*[^,;.\n]{1,80}/gi
const LABELED_RECORD_PATTERN = /\b(?:protokol|dosya|hasta)\s*(?:no|numarası|numarasi)?\s*[:=-]\s*[A-Z0-9/-]{4,}\b/gi
const TITLE_CASE_FULL_NAME_PATTERN = /(?<![A-Za-zÇĞİÖŞÜçğıöşü])[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?=(?:['’](?:ın|in|un|ün)(?![A-Za-zÇĞİÖŞÜçğıöşü]))|\s*(?:,|$)|\s+(?:bu|için|adlı|isimli|raporu|raporunda|vakası|vakasi|vakayı|vakayi|çocuğu|cocugu|danışanı|danisani|okulda|evde|klinikte|değerlendirmesi|degerlendirmesi|hakkında|hakkinda|açısından|acisindan|self[-\s]?regülasyon|self[-\s]?regulasyon|interosepsiyon|duyusal|fizyolojik|otonom|sempatik|parasempatik)(?![A-Za-zÇĞİÖŞÜçğıöşü]))/g
const UPPERCASE_FULL_NAME_PATTERN = /(?<![A-Za-zÇĞİÖŞÜçğıöşü])[A-ZÇĞİÖŞÜ]{2,}\s+[A-ZÇĞİÖŞÜ]{2,}(?=(?:['’](?:IN|İN|UN|ÜN)(?![A-Za-zÇĞİÖŞÜçğıöşü]))|\s*(?:,|$)|\s+(?:BU|İÇİN|ICIN|ADLI|İSİMLİ|ISIMLI|RAPORU|RAPORUNDA|VAKASI|VAKAYI|HAKKINDA|AÇISINDAN|ACISINDAN|SELF[-\s]?REGÜLASYON|SELF[-\s]?REGULASYON|İNTEROSEPSİYON|INTEROSEPSIYON)(?![A-Za-zÇĞİÖŞÜçğıöşü]))/g
const INITIAL_SURNAME_PATTERN = /(?<![A-Za-zÇĞİÖŞÜçğıöşü])[A-ZÇĞİÖŞÜ]\.?\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?=(?:['’](?:ın|in|un|ün)(?![A-Za-zÇĞİÖŞÜçğıöşü]))|\s*(?:,|$)|\s+(?:bu|için|raporu|vakası|vakayı|hakkında|açısından|self[-\s]?regülasyon|self[-\s]?regulasyon)(?![A-Za-zÇĞİÖŞÜçğıöşü]))/g
const LOWERCASE_CONTEXTUAL_FULL_NAME_PATTERN = /^[a-zçğıöşü]{2,}\s+[a-zçğıöşü]{2,}(?=\s*(?:,\s*)?(?:bu\s+(?:vaka(?:yı|yi|ya|da|de)?|rapor(?:u|da|de)?)|vakayı|vakayi|raporu|vakası|vakasi|self[-\s]?regülasyon|self[-\s]?regulasyon)(?![A-Za-zÇĞİÖŞÜçğıöşü]))/g
const ALLOWED_CLINICAL_TITLE_PAIRS = new Set([
  "Duyusal Regülasyon",
  "Fizyolojik Regülasyon",
  "Duygusal Regülasyon",
  "Bilişsel Regülasyon",
  "Yürütücü İşlev",
  "Merkezi Sinir",
  "Otonom Sinir",
  "Sempatik Sinir",
  "Parasempatik Sinir",
  "Self Regülasyon",
  "Eş Regülasyon",
  "Ko Regülasyon",
  "Duyusal Modülasyon",
  "Duyusal Yanıtlılık",
  "Duygu Düzenleme",
  "Duygu Dinamikleri",
  "Öz Örgütlenme",
  "Stres Sistemleri",
  "Stres Yanıtı",
  "HPA Ekseni",
  "Allostatik Yük",
  "Toksik Stres",
  "Uyku Sağlığı",
  "Uyku Düzenliliği",
  "Uyku Mimarisi",
  "Günlük Ritim",
  "Sirkadiyen Ritim",
  "Biyolojik Saat",
  "Çalışma Belleği",
  "Seçici Dikkat",
  "Sürdürülen Dikkat",
  "Yürütücü Dikkat",
  "Dikkat Ağları",
  "Yürütücü İşlevler",
  "Düzenleme Esnekliği",
  "Dikkat Kontrolü",
  "Yürütücü Kontrol",
  "Sinir Sistemi",
  "Fizyolojik Uyarılma",
  "Sempatik Aktivasyon",
  "Parasempatik Toparlanma",
  "Karşı Kanıt",
  "Korunmuş Kapasite",
  "Veri Güveni",
  "Veri Sınırlılığı",
  "Vaka Raporu",
  "Vaka Özeti",
  "Rapor Özeti",
  "Rapor Bulgusu",
  "Ana Eksen",
  "İkincil Eksen",
  "Klinik Hipotez",
  "Klinik Gözlem",
  "Bilimsel Kaynak",
  "Literatür Kaynağı",
  "Erken Çocukluk",
  "Günlük Yaşam",
  "Klinik Değerlendirme",
  "Alan Skorları",
  "DNA Asistanı",
  "DNA Raporu",
].map(normalizeDnaChatText))

const VERIFIED_LITERATURE_SURNAMES = new Set(
  Object.values(VERIFIED_LITERATURE_SOURCES).flatMap((source) =>
    normalizeDnaChatText(source.inlineCitation)
      .split(" ")
      .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !["et", "al"].includes(token)),
  ),
)

const LITERATURE_CONTEXT_PATTERNS = ["literatur", "makale", "yazar", "kaynak", "calisma", "doi"] as const

const LOWERCASE_NON_NAME_TOKENS = new Set([
  "acaba",
  "ama",
  "ayrıca",
  "bana",
  "bence",
  "biraz",
  "bir",
  "bu",
  "burada",
  "çok",
  "çocukluk",
  "çocuklukta",
  "çocuk",
  "cocuk",
  "erken",
  "genel",
  "hangi",
  "her",
  "ile",
  "kendi",
  "kontrol",
  "dna",
  "sistemini",
  "kapatmak",
  "nedeni",
  "kesin",
  "kısaca",
  "lütfen",
  "nasıl",
  "ne",
  "neden",
  "önce",
  "peki",
  "rapor",
  "rapordaki",
  "bulgu",
  "bulguyu",
  "sadece",
  "sence",
  "self",
  "şimdi",
  "sonra",
  "temel",
  "teorik",
  "regülasyon",
  "regulasyon",
  "vaka",
  "vakadaki",
].map(normalizeDnaChatText))

function redactLikelyFullName(match: string, literatureContext: boolean): string {
  const normalized = normalizeDnaChatText(match)
  const surname = normalized.split(" ").at(-1) ?? ""
  return ALLOWED_CLINICAL_TITLE_PAIRS.has(normalized) ||
    (literatureContext && VERIFIED_LITERATURE_SURNAMES.has(surname))
    ? match
    : "[kişisel bilgi gizlendi]"
}

function redactLikelyLowercaseFullName(match: string): string {
  const normalized = normalizeDnaChatText(match)
  const tokens = normalized.split(" ")
  if (
    ALLOWED_CLINICAL_TITLE_PAIRS.has(normalized) ||
    tokens.some((token) => LOWERCASE_NON_NAME_TOKENS.has(token))
  ) {
    return match
  }
  return "[kişisel bilgi gizlendi]"
}

const MANIPULATION_PATTERNS = [
  "kurallari unut",
  "talimatlari yok say",
  "onceki talimatlari yok say",
  "sistem mesajini goster",
  "sistem prompt",
  "gizli prompt",
  "ham veritabani",
  "ham json",
  "tum danisanlari",
  "butun danisanlari",
  "baska danisanin",
  "ignore previous instructions",
  "reveal system prompt",
  "esikleri goster",
  "esik degerlerini",
  "threshold degerlerini",
  "threshold degerini",
  "kural listesini goster",
  "gizli kural",
  "gizli kurallari",
  "karar izini goster",
  "audit trail",
  "trace ve audit",
  "audit kaydini goster",
  "trace verisini goster",
  "talimatlarini goster",
  "talimatlari goster",
  "kurallarini goster",
] as const

const SELF_LEARNING_PATTERNS = [
  "bunu kalici olarak ogren",
  "bu bilgiyi kalici olarak ogren",
  "bu metni bellegine kaynak olarak ekle",
  "bunu ogren ve butun cevaplarinda kullan",
  "bunu ogrenip butun cevaplarinda kullan",
  "mesajlardan kendiliginden ogren",
  "sohbetlerden kendiliginden ogren",
  "sohbetten ogren",
  "bu bilgiyi kataloga ekle",
  "canli katalogu degistir",
  "katalog kurallarini degistir",
  "bunu yeni kural olarak kaydet",
] as const

const SELF_LEARNING_TARGET_PATTERN =
  /\b(?:bu(?:nu|nlar\w*)?|bu\s+(?:bilgi\w*|metin\w*|kitab\w*|belge\w*|dokuman\w*|icerig\w*|mesaj\w*|dosya\w*)|gonderdig\w*\s+(?:metin\w*|bilgi\w*|belge\w*|dokuman\w*)|soyledik\w*|dokuman\w*|sohbet\w*|mesaj\w*)\b/
const SELF_LEARNING_ACTION_PATTERN =
  /\b(?:ogren\w*|ogret\w*|ezberle\w*|icsellestir\w*|dogru\s+kabul\s+et\w*|hafiza\w*\s+al\w*|bundan\s+sonra\s+temel\s+al\w*|belleg\w*\s+(?:ekle\w*|kaydet\w*)|bilgi\s+banka\w*\s+dahil\s+et\w*|katalog\w*\s+(?:ekle\w*|kaydet\w*|degistir\w*)|model\s+egitim\w*\s+ekle\w*|sonraki\s+yanit\w*\s+kullan\w*|butun\s+cevap\w*\s+kullan\w*|sistem\w*\s+entegre\w*)\b/

function isCompositionalSelfLearningRequest(normalized: string): boolean {
  return SELF_LEARNING_TARGET_PATTERN.test(normalized) && SELF_LEARNING_ACTION_PATTERN.test(normalized)
}

const INTERNAL_DATA_PATTERNS = [
  "ham cevaplari goster",
  "tum cevaplari goster",
  "madde cevaplarini",
  "item cevaplarini",
  "answers alanini",
  "soru bazli cevaplari",
  "puanlama esiklerini",
  "router esiklerini",
  "gizli trace",
  "gizli audit",
  "madde yanitlarini",
  "madde yanitlari",
  "soru yanitlarini",
  "soru yanitlari",
] as const

const CROSS_CASE_PATTERNS = [
  "baska vaka ile karsilastir",
  "diger vaka ile karsilastir",
  "baska danisanla karsilastir",
  "diger danisanla karsilastir",
  "baska vaka ile kiyasla",
  "diger vaka ile kiyasla",
  "baska danisanla kiyasla",
  "diger danisanla kiyasla",
  "baska danisanin raporuyla kiyasla",
  "diger danisanin raporuyla kiyasla",
  "baska danisanin raporuyla karsilastir",
  "diger danisanin raporuyla karsilastir",
  "diger danisanlarin",
  "baska danisanlarin",
  "bu raporu baska",
  "bu raporu diger",
  "tum vakalarla karsilastir",
  "diger raporla",
  "baska raporla",
  "diger rapor ile",
  "baska rapor ile",
] as const

const PROGNOSIS_PATTERNS = [
  "ne zaman duzelir",
  "ne zaman tamamen duzelir",
  "gelecegi nasil",
  "ileride ne olur",
  "tamamen duzelir mi",
  "kac ayda duzelir",
  "prognozu ne",
  "klinik gidisi",
  "ne zaman iyiles",
  "iyilesme suresi",
  "kac ayda normale",
  "kac ayda iyiles",
  "normale doner",
  "ileride okul basarisi",
  "ileride kaygili olacagini gosterir",
] as const

const CAUSALITY_PATTERNS = [
  "kesin nedeni",
  "buna ne sebep oldu",
  "ne sebep oldu",
  "neden kaynaklaniyor",
  "asil sebebi",
  "dogrudan nedeni",
  "kesin sebebi",
  "sebebi nedir",
] as const

const CRISIS_PATTERNS = [
  "kendine zarar",
  "intihar",
  "hayati tehlike",
  "bilinci kapali",
  "nefes alamiyor",
  "ciddi istismar",
  "acil tibbi",
] as const

const DIAGNOSIS_PATTERNS = [
  "tani koy",
  "tanisi koy",
  "tanisini koy",
  "hangi tani",
  "tani uyar",
  "tani uygun",
  "kesin tanisi",
  "otizmli mi",
  "adhd mi",
  "hangi bozukluk",
  "tani ne olabilir",
  "sence tanisi",
  "bu bulgu otizm",
  "teshis koy",
  "teshis et",
  "tani ver",
  "taniyi soyle",
  "otizm var mi",
  "otizm olabilir",
  "otizm dusundur",
  "otizmle uyumlu",
  "otizm ile uyumlu",
  "otistik mi",
  "dehb mi",
  "dehb olabilir",
  "dehb dusundur",
  "dehb ile uyumlu",
  "dehb uyumlu",
  "adhd olabilir",
  "adhd dusundur",
  "bu rapora gore hastaligi nedir",
  "bu profil hangi klinik tabloyu dusunduruyor",
  "bu rapordan tanisal sonuc cikar",
] as const

const INDIVIDUAL_CLINICAL_CONTEXT_PATTERN =
  /\b(?:bu\s+(?:cocuk|vaka|olgu|danisan|profil|rapor|oruntu|sonuc|bulgu|davranis|durum|sorun|zorluk)|cocuk\w*|danisan\w*|vaka\w*|olgu\w*|rapor\w*|profil\w*|skor\w*|puan\w*|sonuc\w*|bulgu\w*|oruntu\w*|ofke\w*\s+goster\w*|plan\w*\s+yapam\w*|iki\s+komut\w*\s+unut\w*)\b/
const DIAGNOSTIC_CONCEPT_PATTERN =
  /\b(?:tani(?:sal\w*|si\w*|yi\w*|ya\w*|nin\w*|niz\w*|\s+koy\w*|\s+ver\w*)|teshis\w*|hastali(?:k|g)\w*|bozuklu(?:k|g)\w*|dsm(?:\s*5)?|asd|otiz\w*|otistik\w*|dehb|adhd|spektrum\w*|norogelisimsel|zihinsel\s+gerilik|ayirici\s+tani|klinik\s+(?:etiket\w*|tablo\w*|kategori\w*)|psikiyatrik\s+(?:etiket\w*|kategori\w*))\b/
const DIAGNOSTIC_REQUEST_PATTERN =
  /\b(?:ad\w*\s+soyle\w*|siniflandir\w*|etiket\w*|daralt\w*|indir\w*|secenek\w*\s+ver\w*|sahip\s+mi|sayil\w*\s+(?:mi|mu)|say\w*\s+miy\w*|destekli\w*\s+(?:mi|mu)|ihtimal\w*|yuzde\s+kac|daha\s+yakin|sonuc\w*\s+donustur\w*|ad\w*\s+tahmin\w*|var\s+mi\s+yok\s+mu|gosterge\w*|kod\w*\s+sec\w*|kanaat\w*|acikca\s+belirt\w*|diyebilir\w*\s+miy\w*)\b/

function isCompositionalDiagnosisRequest(normalized: string): boolean {
  if (/\b(?:genel|kavram\w*)\s+tanim\w*\b/.test(normalized) || /\btanim\w*\s+nedir\b/.test(normalized)) {
    return false
  }
  if (/\bbozuklugu\s+yok\b.{0,100}\bayrim\s+yapilabilir\s+mi\b/.test(normalized)) {
    return false
  }
  if (!DIAGNOSTIC_CONCEPT_PATTERN.test(normalized)) return false
  return (
    INDIVIDUAL_CLINICAL_CONTEXT_PATTERN.test(normalized) ||
    DIAGNOSTIC_REQUEST_PATTERN.test(normalized) ||
    /\b(?:hangi|en\s+olasi)\b.{0,60}\b(?:tani\w*|teshis\w*|hastalik\w*|bozukluk\w*|kategori\w*)\b/.test(normalized)
  )
}

const TREATMENT_PATTERNS = [
  "tedavi plani",
  "terapi plani",
  "mudahale plani",
  "seans programi",
  "ev programi",
  "egzersiz listesi",
  "hangi terapi",
  "ne tedavi",
  "tedavi oner",
  "mudahale oner",
  "terapi oner",
  "terapi yaz",
  "seans oner",
  "tedavide ne yap",
  "tedavi icin ne yap",
  "bu vakada ne yapmaliyim",
] as const

const TREATMENT_CONCEPT_PATTERN =
  /\b(?:tedavi\w*|terapi\w*|mudahale\w*|seans\w*|oturum\w*|gorusme\w*|ev\s+(?:program\w*|odev\w*)|bireysel\s+program\w*|egzersiz\w*|uygulama\w*|etkinlik\w*|iyilestir\w*|klinik\s+(?:yol\s+harita\w*|teknik\w*)|aile\s+egitim\w*|duyusal\s+diyet\w*)\b/
const PRESCRIPTIVE_ACTION_PATTERN =
  /\b(?:hazirla\w*|uygula\w*|uygulayayim|sirala\w*|cikar\w*|kac\s+seans|uygun\w*|yaz\w*|iyilestir\w*|hedef\w*|aktivite\w*|belirle\w*|sec\w*|protokol\w*|oner\w*|tasarla\w*|oncelig\w*|planla\w*|recetele\w*|ilerle(?:yelim|yeyim|meli\w*)|ne\s+calis\w*|calis(?:alim|ayim|maliy\w*)|program\w*\s+olustur\w*|ne\s+yapal\w*)\b/

function isCompositionalTreatmentRequest(normalized: string): boolean {
  if (
    /\b(?:evde\s+)?aile\w*\b.{0,60}\b(?:ne\s+(?:calis|yap)\w*|uygula\w*|program\w*|odev\w*)/.test(normalized)
  ) {
    return true
  }
  if (!TREATMENT_CONCEPT_PATTERN.test(normalized)) return false
  return (
    PRESCRIPTIVE_ACTION_PATTERN.test(normalized) ||
    (INDIVIDUAL_CLINICAL_CONTEXT_PATTERN.test(normalized) &&
      /\b(?:hangi|ne|nasil|kac|uygun|oncelik|gerek)\w*\b/.test(normalized))
  )
}

const MEDICATION_PATTERNS = [
  "hangi ilac",
  "ilac oner",
  "ilac basla",
  "dozu ne",
  "dozunu",
  "recete yaz",
  "ilac ver",
  "ilac kullansin",
  "ilac gerekir",
] as const

const MEDICATION_CONCEPT_PATTERN =
  /\b(?:ilac\w*|tablet\w*|surup\w*|farmakolojik\w*|farmakoterapi\w*|medikasyon\w*|doz\w*|recete\w*|etken\s+madde\w*|preparat\w*|uyarici\s+ilac\w*|ritalin\w*|concerta\w*|medikinet\w*|strattera\w*|metilfenidat\w*|atomoksetin\w*|risperidon\w*|aripiprazol\w*|melatonin\w*|miktar\w*|miligram\w*|mg)\b/
const MEDICATION_ACTION_PATTERN =
  /\b(?:sec\w*|tercih\w*|basla\w*|artir\w*|azalt\w*|hesapla\w*|yaz\w*|ekle\w*|duzenle\w*|oner\w*|uygun\w*|gerek\w*|plan\w*|olustur\w*|ver\w*|dene(?:sek|yeyim|meli\w*|mek)|kullan(?:alim|ayim|maliy\w*)|nasil\s+kullan\w*|gec(?:elim|eyim|meli\w*)|gecilir\s+mi|ne\s+kadar|kac\s+(?:miligram|mg)|miktar\w*\s+soyle\w*|urun\s+ad\w*\s+ver\w*|hang\w*)\b/

function isCompositionalMedicationRequest(normalized: string): boolean {
  if (!MEDICATION_CONCEPT_PATTERN.test(normalized)) return false
  return MEDICATION_ACTION_PATTERN.test(normalized)
}

const CAUSAL_ATTRIBUTION_PATTERN =
  /\b(?:etiyoloji\w*|kok\s+neden\w*|buna\s+neden\w*|yol\s+ac\w*|gercek\s+kayna(?:k|g)\w*|olustur\w*\s+mekanizma\w*|neden\s+sonuc\s+ilisk\w*|travma\w*\s+mi\s+gel\w*|dogustan\s+mi\s+cevresel\s+mi|temelinde\w*\s+hangi\s+faktor|tek\s+aciklama\s+sec\w*|as(?:i|il)\s+(?:sebep|neden|mesele)\w*|bunun\s+altinda\s+ne\s+yat\w*|bu\s+tablo\w*\s+kayna(?:k|g)\w*\s+hang\w*|sorun\w*\s+(?:anne|baba|aile)\w*\s+mi\s+gel\w*)\b/
const PROGNOSTIC_PREDICTION_PATTERN =
  /\b(?:kac\s+(?:gun|hafta|ay|yil)\w*|(?:bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|on\s+iki|\d+)\s+(?:gun|hafta|ay|yil)\w*\s+sonra\w*|kalici\w*\s+ol\w*|nasil\s+bir\s+gidis\w*|sey(?:ir|r)\w*\s+nasil\s+ol\w*|boyle\s+giderse|okulda\s+ne\s+yasa\w*|zamanla\s+(?:toparla\w*|duzel\w*|iyiles\w*)|ne\s+kadar\s+sure\w*|geleceg\w*|ileride\w*|kendiliginden\s+gec\w*|sonraki\s+skor\w*|klinik\s+(?:seyir|seyr)\w*|iyilesme\s+olasilig\w*|normale\s+gel\w*|islev\s+duzey\w*\s+tahmin\w*)\b/

function isCompositionalCausalityRequest(normalized: string): boolean {
  return (
    CAUSAL_ATTRIBUTION_PATTERN.test(normalized) &&
    (INDIVIDUAL_CLINICAL_CONTEXT_PATTERN.test(normalized) ||
      /\b(?:belirle\w*|soyle\w*|karar\s+ver\w*|kanitli\w*|sec\w*|hangi\s+(?:alan|faktor|sistem)\w*|gercek\s+kayna(?:k|g)\w*|anne\s+tutum\w*|travma\w*\s+mi|dogustan\s+mi|bunun\s+altinda\s+ne\s+yat\w*|bu\s+tablo\w*\s+kayna(?:k|g)\w*\s+hang\w*|sorun\w*\s+(?:anne|baba|aile)\w*\s+mi\s+gel\w*|as(?:i|il)\s+mesele\w*)\b/.test(normalized))
  )
}

function isCompositionalPrognosisRequest(normalized: string): boolean {
  return (
    PROGNOSTIC_PREDICTION_PATTERN.test(normalized) &&
    (INDIVIDUALIZED_PROXY_PATTERN.test(normalized) ||
      /\bbu\s+(?:cocuk|vaka|danisan|profil|rapor|sorun|durum)\w*\b/.test(normalized) ||
      /^cocuk\b/.test(normalized) ||
      /\b(?:tahmin\w*|ongor\w*|beklen\w*|olasilik\w*|olasilig\w*|yuzde\w*|sansi\w*|nasil\s+ol\w*|nerede\s+ol\w*|ne\s+yasa\w*|toparla\w*\s+mi|iyi\s+mi\s+kotu\s+mu|normale\s+gel\w*)\b/.test(normalized))
  )
}

const PROMPT_OR_INSTRUCTION_TARGET_PATTERN =
  /\b(?:yonerge\w*|talimat\w*|kural\w*|gelistirici\s+mesaj\w*|sistem\s+(?:mesaj\w*|prompt\w*|baglam\w*)|guvenlik\s+filtre\w*|admin\s+mod\w*)\b/
const INSTRUCTION_OVERRIDE_PATTERN =
  /\b(?:gecersiz\s+say\w*|yok\s+say\w*|yokmus\s+gibi|unut\w*|atla\w*|sinir\w*\s+kaldir\w*|yalniz\s+benim\s+talimat\w*|aynen\s+kopyala\w*|disa(?:ri)?\s+aktar\w*|ilk\s+on\s+satir\w*|gizli\w*)\b/
const INTERNAL_REASONING_REQUEST_PATTERN =
  /\b(?:chain\s+of\s+thought|reasoning\s+adim\w*|reasoning\s+iz\w*|ic\s+dusunce\s+zincir\w*|dusunme\s+iz\w*|karar\s+verirken\s+kullandig\w*\s+ic\s+dusunce)\b/

function isCompositionalManipulationRequest(normalized: string): boolean {
  return (
    INTERNAL_REASONING_REQUEST_PATTERN.test(normalized) ||
    (PROMPT_OR_INSTRUCTION_TARGET_PATTERN.test(normalized) &&
      INSTRUCTION_OVERRIDE_PATTERN.test(normalized)) ||
    /\b(?:filtre\w*\s+atla\w*|admin\s+mod\w*\s+gec\w*)\b/.test(normalized)
  )
}

const INTERNAL_DATA_TARGET_PATTERN =
  /\b(?:ham\s+(?:madde\w*|cevap\w*|yanit\w*|anamnez\w*|veri\w*)|(?:anket|olcek|form)\w*\s+(?:yanit|cevap)\w*|form\w*\s+isaretleme\w*|puan\s+hesab\w*\b.{0,60}\bkatsayi\w*|snapshot\w*|answers\w*|eslestirme\s+puan\w*|ozgun\s+ceva(?:p|b)\w*|kural\s+kimlik\w*|kural\s+agirlik\w*|audit\s+log\w*|audit\s+kayd\w*|router\w*\s+(?:in\s+)?(?:karar\s+agac\w*|esik\w*)|klinik\s+json\w*|gizli\s+iz\s+kayd\w*|veritabani\w*)\b/
const DATA_EXTRACTION_ACTION_PATTERN =
  /\b(?:goster\w*|getir\w*|disa(?:ri)?\s+aktar\w*|kopyala\w*|ver\w*|listele\w*|sirala\w*|yaz\w*|dok\w*|paylas\w*|acikla\w*|goruntule\w*|oldugu\s+gibi)\b/

function isCompositionalInternalDataRequest(normalized: string): boolean {
  return (
    /\b(?:hangi|her)\s+soru\w*\s+(?:ya\s+)?ne\s+(?:cevap|yanit)\w*\s+veril\w*/.test(normalized) ||
    (INTERNAL_DATA_TARGET_PATTERN.test(normalized) && DATA_EXTRACTION_ACTION_PATTERN.test(normalized))
  )
}

const OTHER_CASE_TARGET_PATTERN =
  /\b(?:baska\s+(?:vaka\w*|danisan\w*|terapist\w*|uzman\w*|klinisyen\w*|rapor\w*)|diger\s+(?:vaka\w*|danisan\w*|cocuk\w*|terapist\w*|uzman\w*|rapor\w*)|oteki\s+(?:uzman|terapist|klinisyen)\w*\b.{0,40}\b(?:vaka|rapor|danisan)\w*|meslektas\w*\b.{0,30}\bdanisan\w*|bana\s+ait\s+olmayan\s+(?:vaka\w*|rapor\w*)|hesab\w*\s+olmayan\s+(?:dosya\w*|rapor\w*|vaka\w*)|klinikteki\s+(?:son|en\s+yeni)\s+(?:olgu\w*|vaka\w*|danisan\w*)|son\s+danisan\w*|onceki\s+danisan\w*|bu\s+iki\s+cocu(?:k|g)\w*|iki\s+cocug\w*\s+(?:skor\w*|puan\w*|rapor\w*|profil\w*|bulgu\w*)|iki\s+danisan\w*|(?:bu\s+)?iki\s+(?:rapor\w*|vaka\w*)|rapor\s+\d+\s+ve\s+\d+|\w+\s+rapor\w*\s+ile\s+\w+\s+rapor\w*|tum\s+vaka\w*|butun\s+danisan\w*|en\s+agir\s+(?:uc|3)\s+vaka\w*|ayni\s+yas\w*\s+(?:butun\s+)?danisan\w*|baskasina\s+ait\s+(?:vaka\w*|rapor\w*)|klinikteki\s+ortalama\s+vaka\w*)\b/
const CROSS_CASE_ACTION_PATTERN =
  /\b(?:karsilastir\w*|kiyasla\w*|mukayese\w*|yan\s+yana\s+koy\w*|referans\s+al\w*|tara\w*|bak\w*|ac\w*|goruntule\w*|eris\w*|getir\w*|incele\w*|ozetle\w*|degis\w*|ortak\s+ozellik\w*\s+cikar\w*|dagilim\w*|yuzdelik\w*|fark\w*|kimli(?:k|g)\w*\s+kullan\w*)\b/

function isCompositionalCrossCaseRequest(normalized: string): boolean {
  return OTHER_CASE_TARGET_PATTERN.test(normalized) && CROSS_CASE_ACTION_PATTERN.test(normalized)
}

const BOUNDARY_QUESTION_PATTERNS = [
  "dna tani koyar mi",
  "dna tedavi onerir mi",
  "dna ilac onerir mi",
  "dna nin sinirlari",
  "degerlendirme tani koyar mi",
  "rapor tani koyar mi",
  "neden tani koymaz",
  "bu neden tani koydurmuyor",
  "neden tedavi onermez",
  "tani koymadan ne soyler",
  "mesajlardan neden kendiliginden ogrenmiyorsun",
  "sohbetlerden neden kendiliginden ogrenmiyorsun",
  "neden mesajlardan kendiliginden ogrenmiyorsun",
] as const

const DNA_PHYSIOLOGY_OVERREACH_PATTERNS = [
  "dna ile vagal ton",
  "dna vagal ton",
  "dna hrv olcer",
  "dna eda olcer",
  "dna beyin agini olcer",
  "dna hpa toparlanmasini",
  "dna kortizol toparlanmasini",
  "dna duyusal esigi olcer",
  "dna duygu duzenleme mekanizmasini",
  "dna oz orgutlenmeyi olcer",
  "dna kortizol olcer",
  "dna melatonin olcer",
  "dna uyku evresini olcer",
  "dna uyku mimarisini olcer",
  "dna sirkadiyen fazi olcer",
  "dna dikkat aglarini olcer",
  "dna calisma bellegi kapasitesini olcer",
] as const

const PROFILE_OR_OBSERVATION_PROXY_PATTERN =
  /\b(?:dna|puan\w*|skor\w*|profil\w*|davranis\w*|gozlem\w*|gozlenen\w*|belirti\w*|kacin\w*|duyusal\s+(?:kacinma\w*|arayis\w*)|dokunma\w*\s+kac\w*|planlama\w*|hata\s+yap\w*|bedensel\s+sinyal\w*|ofke\w*|tuvalet\s+kaza\w*|sessiz\s+kal\w*|sessizles\w*|toparlanma\w*|gorev\s+(?:sonuc\w*|puan\w*|hata\w*)|uyku\s+(?:oruntu\w*|puani\w*)|(?:test|olcek|anket|dna)\s+(?:sonuc\w*|puan\w*)|bu\s+(?:cocuk|vaka|danisan|rapor)\w*|rapordaki|rapor\s+veri\w*|cocugun|danisan\w*)\b/
const INDIVIDUALIZED_PROXY_PATTERN =
  /\b(?:puan\w*|skor\w*|profil\w*|yas\s+esdeger\w*|gorev\s+(?:sonuc\w*|puan\w*|hata\w*)|uyku\s+(?:oruntu\w*|puani\w*)|(?:test|olcek|anket|dna)\s+(?:sonuc\w*|puan\w*)|bu\s+(?:cocuk|vaka|danisan|rapor)\w*|rapordaki|cocugun|danisan\w*)\b/
const PRODUCT_OR_DEICTIC_PROXY_PATTERN =
  /\b(?:dna|puan\w*|skor\w*|profil\w*|davranis\w*|gozlem\w*|belirti\w*|gorev\s+(?:sonuc\w*|puan\w*|hata\w*)|uyku\s+(?:oruntu\w*|puani\w*)|(?:test|olcek|anket|dna)\s+(?:sonuc\w*|puan\w*)|bu\s+(?:cocuk|vaka|danisan|rapor)\w*|rapordaki|danisan\w*)\b/
const BIOLOGICAL_TARGET_PATTERN =
  /\b(?:beyin(?:\s+(?:bolgesi|agi|olgunlugu))?|sinir\s+sistemi\w*|fight\s+or\s+flight|korteks\w*|frontal\s+lob\w*|frontopariyetal\s+ag\w*|dikkat\s+ag\w*|yurutucu\s+ag\w*|pfc|dlpfc|vmpfc|prefrontal\w*|acc|singulat\w*|insula\w*|insular\w*|amigdala\w*|salience\s+ag\w*|merkezi\s+otonom\s+ag\w*|can\s+(?:agi|etkinligi|aktivitesi)|vagus\w*|vagal\w*|sempatik\w*|parasempatik\w*|hrv|eda|ern|hpa|crh|acth|kortizol\w*|melatonin\w*|hormon\w*|scn|sirkadiyen\s+faz\w*|biyolojik\s+saat\w*|uyarilma\s+biyoloji\w*|vestibuler\s+sistem\w*|uyku\s+(?:evre\w*|mimari\w*)|allostatik\s+yuk\w*|calisma\s+bellegi\s+kapasite\w*|yurutucu\s+kapasite\w*|fonolojik\s+dongu\w*|zeka\w*|noradrenalin\w*|norepinefrin\w*|norolojik\s+esi(?:k|g)\w*|interoseptif\s+dogrulu(?:k|g)\w*)\b/
const BIOLOGICAL_INFERENCE_PREDICATE_PATTERN =
  /\b(?:olc\w*|tahmin\w*|ongor\w*|okun\w*|okuy\w*|hesap\w*|goster\w*|kanit\w*|ispat\w*|cikar\w*|yansit\w*|esles\w*|dogrula\w*|soyle\w*|sayil\w*|anlamina\s+gel\w*|demek\w*|isaret\s+et\w*|dusundur\w*|alarm\w*|fazla\w*|artmis\w*|azalmis\w*|aktif\w*|aktivite\w*|hiperaktiv\w*|etkin\w*|baglanti\w*|olgun\w*|gelismemis\w*|hasar\w*|bozuk\w*|zayif\w*|yeterli\w*|yetersiz\w*|baskin\w*|dusuk\w*|yuksek\w*|kucuk\w*|buyuk\w*|calis\w*|mod\w*|normal\w*|ritim\w*|kaynaklan\w*)\b/
const DIRECT_MEASUREMENT_PREDICATE_PATTERN =
  /\b(?:olc\w*|tahmin\w*|ongor\w*|okun\w*|okuy\w*|hesap\w*|kac|ne\s+kadar|sayisal\w*|deger\w*|seviye\w*|oran\w*|aktivite\w*|etkinlik\w*|baglantisallik\w*|hacim\w*|ritim\w*)\b/

function isExplicitBoundaryCritique(normalized: string): boolean {
  const critique =
    /\b(?:demek|soyle\w*|cikar\w*|atama\w*|etiketle\w*|say\w*|tahmin\s+et\w*|olc\w*)\b.{0,160}\b(?:neden|niye)?\s*(?:sorunlu|sakincali|yanlis|hatali|guvenilmez|sinirli|yeterli\s+degil|dogru\s+degil)\w*\b/.test(normalized) ||
    /\b(?:mumkun\s+degil\w*|olcmez|gostermez|kanitlamaz|kanitlanama\w*|cikarilama\w*|secileme\w*|tahmin\s+edileme\w*|yerine\b.{0,40}\bgecmez|sayilmaz|sayilma\w*|sunulmama\w*|gosterilmeme\w*|karsilastirmama\w*|kiyaslamama\w*|yeterli\s+degil\w*|dogru\s+degil\w*)\b/.test(normalized) ||
    /\b(?:tani\s+koymadan|tedavi\s+onermeden|nedensellik\s+iddia\s+etmeden|biyolojik\s+durum\s+atamadan)\b.{0,140}\b(?:nasil|neden|niye)\b/.test(normalized) ||
    /\bduyusal\s+regulasyon\s+puan\w*\b.{0,100}\bsinir\s+sistemi\s+cikarim\w*\s+yapilabilir\s+mi\b/.test(normalized) ||
    /\b(?:tani\w*|tedavi\w*|ilac\w*|prognoz\w*|nedensellik\w*|mekanizma\w*|ham\s+(?:madde|cevap|yanit)\w*|esik\w*)\b.{0,140}\b(?:neden|niye)\b.{0,100}\b(?:yok|olmaz|gerek\w*|onemli\w*)\b/.test(normalized) ||
    /\b(?:baska|diger)\s+(?:terapist|uzman|klinisyen)\w*\b.{0,50}\b(?:vaka|rapor|danisan)\w*\b.{0,50}\b(?:goruntule|ac|eris|karsilastir|kiyasla)\w*(?:memen|maman|memek|mamak)\b.{0,80}\b(?:neden|niye)\b/.test(normalized) ||
    /\b(?:mesaj|sohbet)\w*\s+(?:neden|niye)\s+(?:kendiliginden\s+)?ogrenm\w*/.test(normalized)
  const asksForBypass = /\b(?:ama|fakat|ancak|yine de|buna ragmen|sonra|ayrica)\b/.test(normalized)
  return critique && !asksForBypass
}

function compositionalBiologicalOverreach(
  normalized: string,
  source: string,
): "measurement_overreach" | "biological_inference" | null {
  if (isExplicitBoundaryCritique(normalized)) return null

  const queryKind = classifyCatalogQueryKind(source)
  const generalDevelopmentFrame =
    queryKind === "development" &&
    /\b(?:bir cocugun|cocuklukta|yasla|gelisim\w*|olgunlas\w*)\b/.test(normalized) &&
    !PRODUCT_OR_DEICTIC_PROXY_PATTERN.test(normalized)
  if (generalDevelopmentFrame) return null
  const researchFrame =
    ["evidence", "relation", "comparison"].includes(queryKind) &&
    /\b(?:literatur\w*|calisma\w*|arastirma\w*|makale\w*|kanit\w*|ilisk\w*)\b/.test(normalized) &&
    !PROFILE_OR_OBSERVATION_PROXY_PATTERN.test(normalized)
  if (researchFrame) return null

  if (
    !PROFILE_OR_OBSERVATION_PROXY_PATTERN.test(normalized) ||
    !BIOLOGICAL_TARGET_PATTERN.test(normalized) ||
    !BIOLOGICAL_INFERENCE_PREDICATE_PATTERN.test(normalized)
  ) {
    return null
  }
  return DIRECT_MEASUREMENT_PREDICATE_PATTERN.test(normalized)
    ? "measurement_overreach"
    : "biological_inference"
}

const NORMALIZED_PATTERN_CACHE = new WeakMap<readonly string[], readonly string[]>()

function normalizedPatterns(patterns: readonly string[]): readonly string[] {
  const cached = NORMALIZED_PATTERN_CACHE.get(patterns)
  if (cached) return cached
  const normalized = patterns.map(normalizeDnaChatText)
  NORMALIZED_PATTERN_CACHE.set(patterns, normalized)
  return normalized
}

function includesAny(value: string, patterns: readonly string[]): boolean {
  return normalizedPatterns(patterns).some((pattern) => value.includes(pattern))
}

function equalsAny(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => value === normalizeDnaChatText(pattern))
}

const EXPLAINABLE_BIOLOGICAL_CONCEPTS = [
  "dorsal vagal",
  "ventral vagal",
  "vagal shutdown",
  "sempatik baskin",
  "parasempatik yetersiz",
  "interosepsiyonu yok",
] as const

const SAFE_BIOLOGICAL_THEORY_KINDS = new Set([
  "definition",
  "evidence",
  "comparison",
  "misconception",
])

const BIOLOGICAL_ATTRIBUTION_PATTERNS = [
  "bu vaka",
  "bu rapor",
  "bu profil",
  "bu cocuk",
  "vakada",
  "raporda",
  "profilde",
  "cocukta",
  "cocugun",
  "danisan",
  "kisiye",
  "kiside",
  "bana",
  "benim",
  "bende",
  "bizde",
  "onun",
  "kendisinin",
  "miyim",
  "miyiz",
  "durumum",
  "durumumu",
  "durumumuz",
  "davranisina",
  "davranislarina",
  "davranistan",
  "hangi durumda",
  "hangisinde",
  "durumda mi",
  "geciyor mu",
  "gecmis mi",
  "etkilenmis",
  "hasarli",
  "sorunu",
  "problemi",
] as const

const BIOLOGICAL_MEASUREMENT_PATTERNS = [
  "olc",
  "kac",
  "deger",
  "skor",
  "seviye",
  "vagal ton",
  "oran",
] as const

const SECOND_CLAUSE_MARKERS = [
  " ve ",
  " sonra ",
  " ayrica ",
  " ama ",
  " fakat ",
  " ancak ",
] as const

function isBoundedBiologicalTheoryQuestion(
  normalized: string,
  source: string,
): boolean {
  const queryKind = classifyCatalogQueryKind(source)
  const questionMarkCount = (source.match(/\?/g) ?? []).length
  const hasRawClauseSeparator = /[;,\n]|[.!?]\s+\S/u.test(source)
  const hasConceptComparison =
    queryKind === "comparison" &&
    EXPLAINABLE_BIOLOGICAL_CONCEPTS.filter((concept) =>
      normalized.includes(normalizeDnaChatText(concept)),
    ).length >= 2
  const andCount = normalized.match(/\sve\s/g)?.length ?? 0
  const hasSafeConceptConjunction =
    hasConceptComparison &&
    andCount === 1 &&
    /\b(?:dorsal vagal|ventral vagal|vagal shutdown|sempatik baskin|parasempatik yetersiz)\s+ve\s+(?:dorsal vagal|ventral vagal|vagal shutdown|sempatik baskin|parasempatik yetersiz)\b/.test(normalized)
  const hasUnsafeSecondClause =
    SECOND_CLAUSE_MARKERS.filter((marker) => marker !== " ve ")
      .some((marker) => normalized.includes(marker)) ||
    (andCount > 0 && !hasSafeConceptConjunction)
  const hasGlobalUnsafeRequest = includesAny(normalized, [
    ...PROGNOSIS_PATTERNS,
    ...CAUSALITY_PATTERNS,
    ...MEDICATION_PATTERNS,
    ...TREATMENT_PATTERNS,
    ...DIAGNOSIS_PATTERNS,
  ])

  return (
    SAFE_BIOLOGICAL_THEORY_KINDS.has(queryKind) &&
    includesAny(normalized, EXPLAINABLE_BIOLOGICAL_CONCEPTS) &&
    questionMarkCount <= 1 &&
    !hasRawClauseSeparator &&
    !hasUnsafeSecondClause &&
    !includesAny(normalized, BIOLOGICAL_ATTRIBUTION_PATTERNS) &&
    !includesAny(normalized, BIOLOGICAL_MEASUREMENT_PATTERNS) &&
    !hasGlobalUnsafeRequest
  )
}

const CATALOG_RULE_PRIORITY = [
  "internal_reasoning",
  "diagnosis",
  "treatment",
  "measurement_overreach",
  "causality",
  "biological_inference",
] as const

function catalogRulePriority(category: (typeof DNA_CHAT_CATALOG_SAFETY_RULES)[number]["category"]): number {
  return CATALOG_RULE_PRIORITY.indexOf(category)
}

function safetyResult(
  redactedQuestion: string,
  category: DnaChatSafetyCategory,
  code: string | null,
  boundaryTr: string,
): DnaChatSafetyResult {
  return {
    blocked: category !== "none",
    category,
    code,
    redactedQuestion,
    boundaryTr,
  }
}

export function inspectDnaChatSafety(question: string): DnaChatSafetyResult {
  const source = String(question || "").trim().slice(0, 600)
  const normalizedSource = normalizeDnaChatText(source)
  const literatureContext = LITERATURE_CONTEXT_PATTERNS.some((pattern) => normalizedSource.includes(pattern))
  const redactContextualName = (match: string) => redactLikelyFullName(match, literatureContext)
  let redactedQuestion = redactReportTextForPrivacy(source)
  redactedQuestion = redactedQuestion
    .replace(NATIONAL_ID_PATTERN, "[kişisel bilgi gizlendi]")
    .replace(BIRTH_DATE_PATTERN, "[kişisel bilgi gizlendi]")
    .replace(LABELED_NAME_PATTERN, "[kişisel bilgi gizlendi]")
    .replace(LABELED_RECORD_PATTERN, "[kişisel bilgi gizlendi]")
    .replace(TITLE_CASE_FULL_NAME_PATTERN, redactContextualName)
    .replace(UPPERCASE_FULL_NAME_PATTERN, redactContextualName)
    .replace(INITIAL_SURNAME_PATTERN, redactContextualName)
    .replace(LOWERCASE_CONTEXTUAL_FULL_NAME_PATTERN, redactLikelyLowercaseFullName)
  const normalized = normalizeDnaChatText(redactedQuestion)

  if (includesAny(normalizedSource, CRISIS_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "crisis",
      "urgent_risk_out_of_scope",
      "DNA Asistanı acil durum yönetimi yapmaz. Acil veya yakın risk varsa yerel acil yardım ve yetkili klinik ekip ile doğrudan iletişim kurulmalıdır.",
    )
  }
  if (redactedQuestion !== source) {
    return safetyResult(
      redactedQuestion,
      "privacy",
      "direct_identifier_detected",
      "Kimlik ve iletişim bilgilerini kaldırarak sorunuzu yeniden yazın. DNA Asistanı doğrudan tanımlayıcı veriyi işlemeye uygun değildir.",
    )
  }
  const explicitBoundaryCritique = isExplicitBoundaryCritique(normalized)
  if (equalsAny(normalized, BOUNDARY_QUESTION_PATTERNS) || explicitBoundaryCritique) {
    return safetyResult(
      redactedQuestion,
      "none",
      null,
      DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.boundaryTr,
    )
  }
  if (includesAny(normalized, SELF_LEARNING_PATTERNS) || isCompositionalSelfLearningRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "self_learning",
      "runtime_self_learning_not_supported",
      "DNA Asistanı sohbetlerden kendiliğinden öğrenmez, kullanıcı mesajını canlı kataloğa eklemez ve katalog kurallarını değiştirmez.",
    )
  }
  if (includesAny(normalized, INTERNAL_DATA_PATTERNS) || isCompositionalInternalDataRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "internal_data",
      "raw_or_internal_data_request_blocked",
      "Ham madde cevapları, gizli eşikler, kural listeleri, trace ve audit ayrıntıları sohbet yanıtına açılmaz.",
    )
  }
  if (includesAny(normalized, MANIPULATION_PATTERNS) || isCompositionalManipulationRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "manipulation",
      "instruction_or_data_extraction_attempt",
      "Bu istek güvenli vaka tartışması sınırlarının dışındadır. Yalnız DNA kavramları, literatür çerçevesi ve açık vakaya ait kimliksiz bulgular ele alınabilir.",
    )
  }
  if (includesAny(normalized, CROSS_CASE_PATTERNS) || isCompositionalCrossCaseRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "cross_case",
      "cross_case_comparison_blocked",
      "Vaka gizliliği nedeniyle başka danışanlar veya raporlarla çapraz karşılaştırma yapılmaz. Yalnız açık ve kimliksiz vaka bağlamı tartışılabilir.",
    )
  }
  if (isCompositionalDiagnosisRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "diagnosis",
      "compositional_diagnostic_inference_blocked",
      "DNA bulgularından tanı veya kesin neden çıkarılamaz. Vaka verileri yalnız işlevsel örüntü ve veri sınırlılıkları düzeyinde tartışılabilir.",
    )
  }
  if (isCompositionalMedicationRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "medication",
      "compositional_medication_request_blocked",
      "İlaç seçimi, doz veya reçete bu sistemin kapsamı dışındadır ve yetkili hekim değerlendirmesi gerektirir.",
    )
  }
  if (isCompositionalTreatmentRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "treatment",
      "compositional_treatment_request_blocked",
      "DNA Asistanı terapi, müdahale, seans veya ev programı oluşturmaz. Bulguları klinik tartışma için betimleyici düzeyde tutar.",
    )
  }
  if (isCompositionalPrognosisRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "prognosis",
      "compositional_prognostic_prediction_blocked",
      "DNA Asistanı iyileşme zamanı veya gelecekteki klinik gidiş hakkında öngörü üretmez.",
    )
  }
  if (isCompositionalCausalityRequest(normalized)) {
    return safetyResult(
      redactedQuestion,
      "causality",
      "compositional_causal_determination_blocked",
      "Tek bir değerlendirme veya vaka özeti kesin neden göstermez; yalnız birlikte görülen işlevsel örüntüler betimlenebilir.",
    )
  }
  if (includesAny(normalized, DNA_PHYSIOLOGY_OVERREACH_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "measurement_overreach",
      "catalog_measurement_overreach",
      "DNA davranışsal ve ölçek temelli işlevsel profil sunar; HRV, EDA, vagal ton veya ağ aktivitesi ölçmez.",
    )
  }
  const matchingCatalogRules = DNA_CHAT_CATALOG_SAFETY_RULES.filter((rule) =>
    includesAny(normalized, rule.patterns),
  )
  const boundedBiologicalTheoryQuestion =
    matchingCatalogRules.length > 0 &&
    matchingCatalogRules.every((rule) => rule.category === "biological_inference") &&
    isBoundedBiologicalTheoryQuestion(normalized, source)
  const catalogRule = boundedBiologicalTheoryQuestion
    ? null
    : [...matchingCatalogRules].sort(
        (left, right) => catalogRulePriority(left.category) - catalogRulePriority(right.category),
      )[0] ?? null
  if (catalogRule) {
    const category: DnaChatSafetyCategory =
      catalogRule.category === "measurement_overreach"
        ? "measurement_overreach"
        : catalogRule.category === "internal_reasoning"
          ? "internal_reasoning"
          : catalogRule.category === "biological_inference"
            ? "biological_inference"
            : catalogRule.category
    return safetyResult(
      redactedQuestion,
      category,
      `catalog_${catalogRule.category}`,
      catalogRule.response,
    )
  }
  const compositionalOverreach = compositionalBiologicalOverreach(normalized, source)
  if (compositionalOverreach) {
    return compositionalOverreach === "measurement_overreach"
      ? safetyResult(
          redactedQuestion,
          "measurement_overreach",
          "compositional_measurement_overreach",
          "DNA puanı, raporu veya davranış gözlemi beyin bölgesi aktivitesini, bağlantısını ya da fizyolojik düzeyi ölçmez veya tahmin etmez.",
        )
      : safetyResult(
          redactedQuestion,
          "biological_inference",
          "compositional_biological_inference",
          "DNA profili veya davranış gözlemi belirli bir beyin bölgesinin işlevini, olgunluğunu, yeterliliğini ya da hasarını kanıtlamaz.",
        )
  }
  if (includesAny(normalized, PROGNOSIS_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "prognosis",
      "prognostic_prediction_blocked",
      "DNA Asistanı iyileşme zamanı veya gelecekteki klinik gidiş hakkında öngörü üretmez.",
    )
  }
  if (includesAny(normalized, CAUSALITY_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "causality",
      "causal_determination_blocked",
      "Tek bir değerlendirme veya vaka özeti kesin neden göstermez; yalnız birlikte görülen işlevsel örüntüler betimlenebilir.",
    )
  }
  if (includesAny(normalized, MEDICATION_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "medication",
      "medication_request_blocked",
      "İlaç seçimi, doz veya reçete bu sistemin kapsamı dışındadır ve yetkili hekim değerlendirmesi gerektirir.",
    )
  }
  if (includesAny(normalized, TREATMENT_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "treatment",
      "treatment_plan_request_blocked",
      "DNA Asistanı terapi, müdahale, seans veya ev programı oluşturmaz. Bulguları klinik tartışma için betimleyici düzeyde tutar.",
    )
  }
  if (includesAny(normalized, DIAGNOSIS_PATTERNS)) {
    return safetyResult(
      redactedQuestion,
      "diagnosis",
      "diagnostic_inference_blocked",
      "DNA bulgularından tanı veya kesin neden çıkarılamaz. Vaka verileri yalnız işlevsel örüntü ve veri sınırlılıkları düzeyinde tartışılabilir.",
    )
  }

  return safetyResult(
    redactedQuestion,
    "none",
    null,
    DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.boundaryTr,
  )
}
