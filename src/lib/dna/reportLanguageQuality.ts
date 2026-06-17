export type ReportLanguageIssueSeverity = "high" | "medium" | "low";

export type ReportLanguageIssue = {
  code: string;
  severity: ReportLanguageIssueSeverity;
  message: string;
  evidence?: string;
};

export type ReportLanguageQualityResult = {
  score: number;
  classification: "strong" | "needs_review" | "problem";
  issues: ReportLanguageIssue[];
  metrics: {
    sentenceCount: number;
    averageSentenceWords: number;
    longSentenceCount: number;
    repeatedSentenceCount: number;
  };
};

type TextReplacement = string | ((substring: string, ...args: any[]) => string);

const TURKISH_ASCII_REPLACEMENTS: Array<[RegExp, TextReplacement]> = [
  [/\bTanilanmis bozukluk bildirilmiyor\b/gi, "Klinik izlem ve işlevsel değerlendirme"],
  [/\btanilanmis bozukluk bildirilmiyor\b/gi, "klinik izlem ve işlevsel değerlendirme"],
  [/\bTanilanmis gelisimsel bozukluk bildirilmedi\b/gi, "Klinik izlem ve işlevsel değerlendirme"],
  [/\bOtizm spektrum bozuklugu izlemi\b/gi, "Klinik izlem ve işlevsel değerlendirme"],
  [/\bOtizm spektrum bozuklugu\b/gi, "Klinik izlem ve işlevsel değerlendirme"],
  [/\bOrnek\b/g, "Örnek"],
  [/\bGelisimsel\b/g, "Gelişimsel"],
  [/\bgelisimsel\b/g, "gelişimsel"],
  [/\bsuphe\b/gi, "şüphe"],
  [/\bcocukluk\b/gi, "çocukluk"],
  [/\bdavranis\b/gi, "davranış"],
  [/\bdavranissal\b/gi, "davranışsal"],
  [/\bTani yok\b/g, "Tanı yok"],
  [/\btani yok\b/gi, "tanı yok"],
  [/\bagir\b/gi, "ağır"],
  [/\bayni\b/gi, "aynı"],
  [/\bbazi\b/gi, "bazı"],
  [/\bhic\b/gi, "hiç"],
  [/\bgorusme\b/gi, "görüşme"],
  [/\bgorev\b/gi, "görev"],
  [/\bgorev\b/gi, "görev"],
  [/\bgozleminde\b/gi, "gözleminde"],
  [/\bsure\b/gi, "süre"],
  [/\buzamasi\b/gi, "uzaması"],
  [/\bgorundu\b/gi, "göründü"],
  [/\besdeger\b/gi, "eşdeğer"],
  [/\baralikta\b/gi, "aralıkta"],
  [/\bkarsiliklilik\b/gi, "karşılıklılık"],
  [/\bragmen\b/gi, "rağmen"],
  [/\bsoyluyor\b/gi, "söylüyor"],
  [/\banlatiyor\b/gi, "anlatıyor"],
  [/\banlatiliyor\b/gi, "anlatılıyor"],
  [/\bolmadigini\b/gi, "olmadığını"],
  [/\boldugunu\b/gi, "olduğunu"],
  [/\bduygu\b/gi, "duygu"],
  [/\biliski\b/gi, "ilişki"],
  [/\balinca\b/gi, "alınca"],
  [/\btanidik\b/gi, "tanıdık"],
  [/\byapilandirmada\b/gi, "yapılandırmada"],
  [/\bis birligi\b/gi, "iş birliği"],
  [/\bsevdigi\b/gi, "sevdiği"],
  [/\bbelirtiyor\b/gi, "belirtiyor"],
  [/\bdogrudan\b/gi, "doğrudan"],
  [/\btibbi\b/gi, "tıbbi"],
  [/\baclik\b/gi, "açlık"],
  [/\bsusuzluk\b/gi, "susuzluk"],
  [/\bcekinme\b/gi, "çekinme"],
  [/\bgiriste\b/gi, "girişte"],
  [/\bzorlanmayi\b/gi, "zorlanmayı"],
  [/\btetiklemeyecegi\b/gi, "tetiklemeyeceği"],
  [/\byaklasmak\b/gi, "yaklaşmak"],
  [/\bzorlugu\b/gi, "zorluğu"],
  [/\barttiginda\b/gi, "arttığında"],
  [/\bkalis\b/gi, "kalış"],
  [/\bbasaramadigini\b/gi, "başaramadığını"],
  [/\bhissettigi\b/gi, "hissettiği"],
  [/\besik\b/gi, "eşik"],
  [/\bdusebiliyor\b/gi, "düşebiliyor"],
  [/\bhizla\b/gi, "hızla"],
  [/\banliyor\b/gi, "anlıyor"],
  [/\bgosterdigin\b/gi, "gösterdiğin"],
  [/\bacik\b/gi, "açık"],
  [/\byakinlik\b/gi, "yakınlık"],
  [/\bbasardigi\b/gi, "başardığı"],
  [/\bGoz-el\b/g, "Göz-el"],
  [/\bgoz-el\b/gi, "göz-el"],
  [/\baltinda\b/gi, "altında"],
  [/\bBakimveren\b/g, "Bakımveren"],
  [/\bbakimveren\b/gi, "bakımveren"],
  [/\bkurallari\b/gi, "kuralları"],
  [/\bsurdurme\b/gi, "sürdürme"],
  [/\byorgun\b/gi, "yorgun"],
  [/\bkalabalik\b/gi, "kalabalık"],
  [/\bgunlerde\b/gi, "günlerde"],
  [/\btoparlanmanin\b/gi, "toparlanmanın"],
  [/\bYapilandirilmis\b/g, "Yapılandırılmış"],
  [/\byapilandirilmis\b/gi, "yapılandırılmış"],
  [/\betkilesimde\b/gi, "etkileşimde"],
  [/\bcok\b/gi, "çok"],
  [/\bbasamakli\b/gi, "basamaklı"],
  [/\bgorevlerde\b/gi, "görevlerde"],
  [/\bverilmediginde\b/gi, "verilmediğinde"],
  [/\bdagilma\b/gi, "dağılma"],
  [/\bkisa\b/gi, "kısa"],
  [/\bsaglanabiliyor\b/gi, "sağlanabiliyor"],
  [/\bGrup\b/g, "Grup"],
  [/\bgrup\b/gi, "grup"],
  [/\bicinde\b/gi, "içinde"],
  [/\bkacirmama\b/gi, "kaçırmama"],
  [/\bkuralli\b/gi, "kurallı"],
  [/\bdagilmadan\b/gi, "dağılmadan"],
  [/\byapida\b/gi, "yapıda"],
  [/\bust uste\b/gi, "üst üste"],
  [/\bgeldiginde\b/gi, "geldiğinde"],
  [/\byavasliyor\b/gi, "yavaşlıyor"],
  [/\byanit\b/gi, "yanıt"],
  [/\bdaginligi\b/gi, "dağınıklığı"],
  [/\bbaglam\b/gi, "bağlam"],
  [/\balanlarinda\b/gi, "alanlarında"],
  [/\bSozlu\b/g, "Sözlü"],
  [/\bsozlu\b/gi, "sözlü"],
  [/\byonerge\b/gi, "yönerge"],
  [/\bisleme\b/gi, "işleme"],
  [/\bicerikli\b/gi, "içerikli"],
  [/\bbaglamsal\b/gi, "bağlamsal"],
  [/\bfarkindalik\b/gi, "farkındalık"],
  [/\bkarsilikli\b/gi, "karşılıklı"],
  [/\byukseklik\b/gi, "yükseklik"],
  [/\bzorlanmasi\b/gi, "zorlanması"],
  [/\bdavranisi\b/gi, "davranışı"],
  [/\bnoktasinda\b/gi, "noktasında"],
  [/\balaninda\b/gi, "alanında"],
  [/\bortalamanin\b/gi, "ortalamanın"],
  [/\byas\b/gi, "yaş"],
  [/\bguclugunun\b/gi, "güçlüğünün"],
  [/\bguclugu\b/gi, "güçlüğü"],
  [/\barttigini\b/gi, "arttığını"],
  [/\buzadigini\b/gi, "uzadığını"],
  [/\bartiyor\b/gi, "artıyor"],
  [/\bbelirginlesiyor\b/gi, "belirginleşiyor"],
  [/\bislevsel\b/gi, "işlevsel"],
  [/\bguclugu\b/gi, "güçlüğü"],
  [/\bbutunleme\b/gi, "bütünleme"],
  [/\bacilma\b/gi, "açılma"],
  [/\bihtiyaci\b/gi, "ihtiyacı"],
  [/\bipuclarini\b/gi, "ipuçlarını"],
  [/\bbuyumeden\b/gi, "büyümeden"],
  [/\byardim\b/gi, "yardım"],
  [/\bgun icinde\b/gi, "gün içinde"],
  [/\bduzenli\b/gi, "düzenli"],
  [/\bfarkindaligi\b/gi, "farkındalığı"],
  [/\bGozlemde\b/g, "Gözlemde"],
  [/\bgozlemde\b/gi, "gözlemde"],
  [/\bbasi\b/gi, "başı"],
  [/\bkatilim\b/gi, "katılım"],
  [/\bbelirginlestiginde\b/gi, "belirginleştiğinde"],
  [/\bonce\b/gi, "önce"],
  [/\bdagiliyor\b/gi, "dağılıyor"],
  [/\bcekilme\b/gi, "çekilme"],
  [/\bhizli\b/gi, "hızlı"],
  [/\btoparlaniyor\b/gi, "toparlanıyor"],
  [/\bgorevde\b/gi, "görevde"],
  [/\byasa\b/gi, "yaşa"],
  [/\bgecisleri\b/gi, "geçişleri"],
  [/\bIletisim\b/g, "İletişim"],
  [/\biletisim\b/gi, "iletişim"],
  [/\bgoreli\b/gi, "göreli"],
  [/\bdusukluk\b/gi, "düşüklük"],
  [/\bdusuk\b/gi, "düşük"],
  [/\bgunluk\b/gi, "günlük"],
  [/\byasam\b/gi, "yaşam"],
  [/\bgecis(?:ler(?:de)?)?\b/gi, (match) => match.toLocaleLowerCase("tr-TR").includes("lerde") ? "geçişlerde" : "geçiş"],
  [/\besya\b/gi, "eşya"],
  [/\bhatirlatma\b/gi, "hatırlatma"],
  [/\bkorunmus\b/gi, "korunmuş"],
  [/\bgorunuyor\b/gi, "görünüyor"],
  [/\bbaslatma\b/gi, "başlatma"],
  [/\byetiskin\b/gi, "yetişkin"],
  [/\byukselme\b/gi, "yükselme"],
  [/\byuk\b/gi, "yük"],
  [/\bduzenleme\b/gi, "düzenleme"],
  [/\bduyarli\b/gi, "duyarlı"],
  [/\bsiniri\b/gi, "sınırı"],
  [/\balt sinirinda\b/gi, "alt sınırında"],
  [/\bsonuc\b/gi, "sonuç"],
  [/\boz bakim\b/gi, "öz bakım"],
];

const INTERNAL_INSTRUCTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /Yürütücü işlev dili, davranış organizasyonunun görev akışı içinde nasıl çözüldüğünü göstermeli; sorunu yalnız uyumsuzluk veya itaat eksikliği gibi sunmamalıdır\./g,
    "Yürütücü işlev yükü, davranış organizasyonunun görev akışı içinde nasıl zorlandığını görünür kılar; bu durum uyumsuzluk ya da itaat eksikliği gibi dar bir çerçeveye indirgenmemelidir.",
  ],
  [
    /İnterosepsiyon öne çıktığında rapor, iç beden sinyallerinin günlük öz bakım ve toparlanma akışına nasıl katılamadığını anlatmalı; tek başına medikal açıklama üretmemelidir\./g,
    "İnteroseptif yük, iç beden sinyallerinin günlük öz bakım ve toparlanma akışına zamanında katılamaması üzerinden klinik anlam kazanır; tek başına medikal açıklama olarak yorumlanmamalıdır.",
  ],
  [
    /Fizyolojik regülasyon öne çıktığında rapor, bedensel toparlanma zemininin günlük akışta ne zaman kırılganlaştığını anlatmalı; tıbbi nedensellik veya otonom bozukluk dili kurmamalıdır\./g,
    "Fizyolojik regülasyon yükü, bedensel toparlanma zemininin günlük akışta hangi koşullarda kırılganlaştığını açıklar; tıbbi nedensellik ya da otonom bozukluk hükmü olarak kullanılmamalıdır.",
  ],
  [
    /Duyusal regülasyon öne çıktığında rapor, çevresel uyaran yükünün işlevsel performansı nasıl dalgalandırdığını açıklamalı; sorunu yalnız davranış etiketiyle tanımlamamalıdır\./g,
    "Duyusal regülasyon yükü, çevresel uyaranların işlevsel performansı hangi koşullarda dalgalandırdığını açıklar; davranışı tek başına etiketleyen bir yorum değildir.",
  ],
  [
    /Duygusal regülasyon dili, yoğunluğun ne zaman yükseldiğini ve toparlanmanın hangi bağlamlarda zorlandığını anlatmalı; psikiyatrik etiket ya da kişilik çıkarımı yapmamalıdır\./g,
    "Duygusal regülasyon yükü, yoğunluğun hangi bağlamlarda yükseldiği ve toparlanmanın ne zaman zorlandığı üzerinden yorumlanır; psikiyatrik etiket ya da kişilik çıkarımı üretmez.",
  ],
  [
    /Bilişsel regülasyon öne çıktığında rapor, sözel talep veya eşzamanlı görev yükü altında zihinsel organizasyonun nasıl zorlandığını anlatmalı; genel zeka veya öğrenme kapasitesi hükmüne gitmemelidir\./g,
    "Bilişsel regülasyon yükü, sözel talep veya eşzamanlı görev arttığında zihinsel organizasyonun nasıl zorlandığını açıklar; genel zeka ya da öğrenme kapasitesi hükmü değildir.",
  ],
];

const FORBIDDEN_LANGUAGE_PATTERNS: Array<{ code: string; severity: ReportLanguageIssueSeverity; pattern: RegExp; message: string }> = [
  { code: "kb_instruction_leak", severity: "high", pattern: /\b(?:rapor[^.]{0,120})?(?:anlatmalı|göstermeli|yazılmalı|yazılmalıdır|açıklamalı|kurmamalıdır|üretmemelidir)\b/i, message: "KB yönerge dili final rapora sızmış." },
  { code: "technical_item_language", severity: "high", pattern: /\b(?:madde düzeyi|anket maddesi|yanıt dizisi|soru numarası)\b/i, message: "Teknik ölçek/madde dili final raporda görünüyor." },
  { code: "pathology_language", severity: "high", pattern: /\bpatolojik\b/i, message: "Patoloji dili final raporda görünmemeli." },
  { code: "raw_diagnosis_placeholder", severity: "high", pattern: /tan[ıi]lanm[ıi]s bozukluk bildirilmiyor/i, message: "Tanı placeholder metni final rapora taşınmış." },
  { code: "treatment_focused_vocabulary", severity: "high", pattern: /\b(?:tedavi|müdahale|terapi|seans|ilaç|danışmanlık|destek planı|uygulama yönergesi)\b/i, message: "Tedavi/terapi odaklı kelime final raporda görünmemeli." },
  { code: "legacy_watch_range", severity: "medium", pattern: /watch range/i, message: "İngilizce watch range ifadesi görünmemeli." },
  { code: "awkward_clinical_reading", severity: "medium", pattern: /klinik okuma|klinik açıdan en güçlü okuma/i, message: "Mekanik klinik okuma kalıbı görünüyor." },
];

const ASCII_TURKISH_PATTERNS = [
  /\bgunluk\b/i,
  /\byasam\b/i,
  /\bgecis/i,
  /\besya\b/i,
  /\bhatirlatma\b/i,
  /\bkorunmus\b/i,
  /\bgorunuyor\b/i,
  /\bbaslatma\b/i,
  /\byetiskin\b/i,
  /\bIletisim\b/,
  /\bdusuk/i,
];

function applyReplacements(text: string, replacements: Array<[RegExp, TextReplacement]>) {
  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement as any), text);
}

export function normalizeTurkishClinicalText(text: unknown): string {
  const value = String(text || "");
  if (!value) return "";
  return applyReplacements(value, TURKISH_ASCII_REPLACEMENTS)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function normalizeRepeatedMechanismLabels(text: string): string {
  return text
    .replace(/Ek bulgu hattı \(([^)]+)\) bu formülasyonu destekleyen bağlamsal kanıt olarak kalır\./g, "$1; bu bulgu formülasyonu destekleyen ek klinik kanıtlar arasında yer alır.")
    .replace(/Ek bulgu hattı \(([^)]+)\) bu formülasyonu büyüten değil, yorum sınırını ve korunmuş işlev alanlarını görünür kılan dengeleyici bağlam olarak kalır\./g, "$1; bu bulgu ana formülasyonu büyütmek yerine yorum sınırını ve korunmuş işlev alanlarını görünür kılar.")
    .replace(/Bu nedenle anamnez ile ölçek arasında doğrudan patolojik uyumdan çok,/g, "Bu nedenle anamnez ile ölçek arasında doğrudan risk eşleşmesinden çok,")
    .replace(/Madde düzeyi yanıt dizisi bulunmadığı için/g, "Ölçek içi ayrıntılı yanıt örüntüsü bulunmadığı için")
    .replace(/madde düzeyi yanıt dizisi bulunmadığı için/g, "ölçek içi ayrıntılı yanıt örüntüsü bulunmadığı için")
    .replace(/mekanizma-temelli bir regülasyon profili olarak okunmalıdır\./g, "klinik izlemde mekanizma temelli olarak ele alınmalıdır.")
    .replace(/Bu alan belirli koşullarda, özellikle ([^.]+) olarak yazılmalıdır\./g, "Bu alan belirli koşullarda, özellikle $1 olarak klinik anlam kazanır.")
    .replace(/Bu alandaki kırılganlık, ([^.]+) üzerinden yazılmalıdır/g, "Bu alandaki kırılganlık, $1 üzerinden klinik anlam kazanır")
    .replace(/anlamlı birliktelik olarak yazılmalıdır/g, "anlamlı birliktelik olarak ele alınır")
    .replace(/ayrıştırılarak yazılmalıdır/g, "ayrıştırılarak ele alınır")
    .replace(/birlikte gösterilmelidir/g, "birlikte görünür kılınır")
    .replace(/biçimde anlatmalıdır/g, "biçimde ele alınır")
    .replace(/üretmemelidir/g, "üretmez");
}

function replaceInternalMechanismIds(text: string): string {
  return text
    .replace(/\blanguage_social_pragmatic\b/g, "dilsel ve sosyal-pragmatik talep")
    .replace(/\blanguage_communication\b/g, "dilsel iletişim")
    .replace(/\bsocial_pragmatic\b/g, "sosyal-pragmatik talep")
    .replace(/\badaptive_daily_living\b/g, "günlük yaşam ve öz bakım")
    .replace(/\bmotor_praxis\b/g, "motor planlama ve praksi")
    .replace(/\bphysiological_interoceptive\b/g, "beden-temelli toparlanma ve interoseptif düzenleme")
    .replace(/\bevidence_limited_mixed\b/g, "kanıt-sınırlı karma profil")
    .replace(/\bexecutive_behavior\b/g, "yürütücü davranış düzenleme")
    .replace(/\bsensory_processing\b/g, "duyusal işlemleme")
    .replace(/\bdevelopment_general\b/g, "genel gelişim")
    .replace(/sensory-emotional/g, "duyusal-duygusal")
    .replace(/social-pragmatic/g, "sosyal-pragmatik")
    .replace(/\bve dilsel ve sosyal-pragmatik talep\b/g, "ve dilsel-sosyal pragmatik talep")
    .replace(/bakımveren anlatısı/gi, "aileden gelen bilgi")
    .replace(/Bakımveren anlatısına/g, "Aileden gelen bilgiye")
    .replace(/aileden gelen bilgina/gi, "aileden gelen bilgiye")
    .replace(/(^|\n)aileden gelen bilgiye\s+terapist/gi, "$1Aileden gelen bilgiye, terapist")
    .replace(/Aile tarafından Bakımveren,\s*/g, "Aile tarafından ")
    .replace(/İlişki:\s*dilsel iletişim ve dilsel-sosyal pragmatik talep mekanizmalarını destekler\./g, "İlişki: Dilsel ve sosyal-pragmatik talebin birlikte arttığı durumları destekler.")
    .replace(/İlişki:\s*sosyal-pragmatik talep ve dilsel-sosyal pragmatik talep mekanizmalarını destekler\./g, "İlişki: Sosyal-pragmatik talep ile dilsel yükün birlikte ele alınmasını destekler.")
    .replace(/İlişki:\s*günlük yaşam ve öz bakım mekanizmasını ve korunmuş profil varsa işlevsel denge yorumunu destekler\./g, "İlişki: Günlük yaşam ve öz bakım akışındaki işlevsel dengeyi yorumlamaya katkı sağlar.")
    .replace(/İlişki:\s*günlük yaşam ve öz bakım, sosyal-pragmatik ve korunmuş profil yorumunu destekler\./g, "İlişki: Günlük yaşam becerileri ve korunmuş işlev alanlarını birlikte yorumlamaya katkı sağlar.")
    .replace(/İlişki:\s*motor planlama ve praksi mekanizmasını ve yürütücü\/bilişsel yayılımı destekler\./g, "İlişki: Motor planlama yükünün yürütücü ve bilişsel organizasyona yayılımını destekler.")
    .replace(/İlişki:\s*motor planlama ve praksi mekanizması için yüksek değerli destekleyici testtir\./g, "İlişki: Motor planlama ve praksi eksenini güçlü biçimde destekler.");
}

function splitOverloadedClinicalSentences(text: string): string {
  return text
    .replace(
      /,\s*regülasyon örüntüsünün yalnız bireysel performans değil etkileşimsel talep altında da değerlendirilmesi gerektiğini/gi,
      ". Bu bulgular, regülasyon örüntüsünün yalnız bireysel performans değil etkileşimsel talep altında da değerlendirilmesi gerektiğini"
    )
    .replace(
      /bulguları,\s*zorlanmanın yalnız dikkat ya da genel davranış kontrolünde değil;/gi,
      "bulguları klinik açıdan önemlidir. Zorlanma yalnız dikkat ya da genel davranış kontrolünde değil;"
    )
    .replace(
      /gibi kaynaklardan gelen işlevsel veri,\s*regülasyon yükünün yalnız kapasite düzeyinde değil/gi,
      "gibi kaynaklardan gelen işlevsel veri klinik açıdan tamamlayıcıdır. Regülasyon yükü yalnız kapasite düzeyinde değil"
    )
    .replace(/;\s*bu tür\s+/gi, ". Bu tür ")
    .replace(/;\s*bu durum\s+/gi, ". Bu durum ")
    .replace(/;\s*bu bulgu\s+/gi, ". Bu bulgu ")
    .replace(/;\s*bu ilişki\s+/gi, ". Bu ilişki ")
    .replace(/;\s*erken çocuklukta\s+/gi, ". Erken çocuklukta ")
    .replace(/;\s*duygu ilişkili\s+/gi, ". Duygu ilişkili ")
    .replace(/;\s*vagal kontrol\s+/gi, ". Vagal kontrol ")
    .replace(/;\s*dış test kanıtı\s+/gi, ". Dış test kanıtı ")
    .replace(/;\s*bu nedenle\s+/gi, ". Bu nedenle ");
}

function removeRepeatedLongSentences(text: string): string {
  const seen = new Set<string>();
  const cleaned = text.replace(/[^.!?\n]+[.!?]/g, (sentence) => {
    const normalized = normalizeSentence(sentence);
    if (normalized.length < 80) return sentence;
    if (seen.has(normalized)) return "";
    seen.add(normalized);
    return sentence;
  });

  return cleaned
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .filter((line) => !/^-\s*$/.test(line.trim()))
    .join("\n");
}

function removeTreatmentFocusedVocabulary(text: string): string {
  return text
    .replace(/tedavi gerekliliği göstermez/gi, "klinik gereklilik göstermez")
    .replace(/tedavi hükmü değildir/gi, "vaka dışı karar niteliği taşımaz")
    .replace(/tedavi protokolü çıkarımı sağlamaz/gi, "vaka dışı protokol çıkarımı sağlamaz")
    .replace(/tedavi protokolü/gi, "vaka dışı protokol")
    .replace(/tedavi reçetesi değildir/gi, "vaka dışı karar değildir")
    .replace(/tedavi reçetesi/gi, "vaka dışı karar")
    .replace(/tedavi kararı üretmez/gi, "vaka dışı karar üretmez")
    .replace(/tedavi önerisi üretmez/gi, "vaka dışı öneri üretmez")
    .replace(/tedavi çıkarımı sağlamaz/gi, "vaka dışı çıkarım sağlamaz")
    .replace(/\btedavi\b/gi, "klinik uygulama")
    .replace(/müdahale reçetesi olarak kullanılmaz/gi, "vaka dışı karar olarak kullanılmaz")
    .replace(/müdahale reçetesi üretmez/gi, "vaka dışı karar üretmez")
    .replace(/müdahale reçetesi/gi, "vaka dışı karar")
    .replace(/müdahale protokolü üretmez/gi, "vaka dışı protokol üretmez")
    .replace(/müdahale kararı üretmez/gi, "vaka dışı karar üretmez")
    .replace(/müdahale önerisi veya protokol çıkarımı sağlamaz/gi, "vaka dışı öneri veya protokol çıkarımı sağlamaz")
    .replace(/müdahale öneren dil/gi, "vaka dışı öneri dili")
    .replace(/müdahale önermeyen/gi, "vaka dışı öneri üretmeyen")
    .replace(/\bmüdahale\b/gi, "vaka dışı uygulama")
    .replace(/\bterapi planı\b/gi, "vaka dışı plan")
    .replace(/\bterapi bağlamıyla\b/gi, "klinik bağlamla")
    .replace(/\bterapi\b/gi, "klinik uygulama")
    .replace(/\bergoterapi\b/gi, "pediatrik klinik")
    .replace(/\bseans sıklığı\b/gi, "oturum sıklığı")
    .replace(/\bseans\b/gi, "oturum")
    .replace(/\bilaç\/medikal yorum\b/gi, "medikal karar")
    .replace(/\bilaç\b/gi, "medikal karar")
    .replace(/\bdanışmanlık\b/gi, "klinik görüşme")
    .replace(/\bdestek planı\b/gi, "vaka dışı plan")
    .replace(/\buygulama yönergesi\b/gi, "vaka dışı yönlendirme")
    .replace(/Görünür rapor tanı önerisi, vaka dışı plan, oturum sıklığı, medikal karar, aileye direkt tavsiye listesi veya kesin neden-sonuç açıklaması üretmez\./gi, "Görünür rapor yalnız değerlendirme ve klinik hipotez düzeyinde kalır.")
    .replace(/Bu rapor tanısal hüküm veya vaka dışı yönlendirme üretmez;/gi, "Bu rapor tanısal hüküm üretmez;")
    .replace(/Bu rapor tanısal hüküm veya vaka dışı yönlendirme üretmez\./gi, "Bu rapor tanısal hüküm üretmez.");
}

export function sanitizeFinalReportLanguage(text: string): string {
  let sanitized = String(text || "");
  sanitized = applyReplacements(sanitized, INTERNAL_INSTRUCTION_REPLACEMENTS);
  sanitized = normalizeRepeatedMechanismLabels(sanitized);
  sanitized = replaceInternalMechanismIds(sanitized);
  sanitized = normalizeTurkishClinicalText(sanitized);
  sanitized = splitOverloadedClinicalSentences(sanitized);
  sanitized = removeRepeatedLongSentences(sanitized);
  sanitized = removeTreatmentFocusedVocabulary(sanitized);
  sanitized = sanitized
    .replace(/Aile tarafından\s+evde\b/gi, "Aileden gelen bilgiye göre evde")
    .replace(/Aile tarafından\s+Evde\b/g, "Aileden gelen bilgiye göre evde")
    .replace(/Aile tarafından\s+bakımveren,\s*/gi, "Aile tarafından ")
    .replace(/Aile tarafından\s+Aile\b/g, "Aile")
    .replace(/\bBakımveren ve gözlem verileri\b/g, "Aile ve gözlem verileri")
    .replace(/Terapist gözleminde\s+Terapist gözleminde\b/gi, "Terapist gözleminde")
    .replace(/Terapist gözleminde\s+Terapist,\s*/gi, "Terapist gözleminde ")
    .replace(/Bu nedenle ana klinik yorum skor örüntüsü ve anamnez üzerine kurulmuştur\. Bu bulgu formülasyonu destekleyen ek klinik kanıtlar arasında yer alır\./gi, "Bu nedenle ana klinik yorum skor örüntüsü, anamnez ve terapist gözlemiyle sınırlı tutulmuştur.")
    .replace(/Bildirilen dış testlerin tümü yaş aralığıyla uyumsuz görünmektedir\. Bu nedenle ana klinik yorum skor örüntüsü ve anamnez üzerine kurulmuştur\./gi, "Bildirilen dış testlerin tümü yaş aralığıyla uyumsuz görünmektedir. Bu nedenle ana klinik yorum skor örüntüsü, anamnez ve terapist gözlemiyle sınırlı tutulmuştur.")
    .replace(/Başvuru \/ izlem gerekçesi:\s*Klinik izlem ve işlevsel değerlendirme/gi, "Başvuru / izlem gerekçesi: Klinik izlem ve işlevsel değerlendirme")
    .replace(/Başvuru \/ izlem gerekçesi:[^\n]*(?:bozukluk|bozukluğu|otizm|tanı|tanılanmış)[^\n]*/gi, "Başvuru / izlem gerekçesi: Klinik izlem ve işlevsel değerlendirme")
    .replace(/tanı ya da destek planı yerine geçmez/gi, "tanısal sonuç olarak kullanılmaz")
    .replace(/tanı veya müdahale reçetesi olarak kullanılmaz/gi, "tanısal sonuç olarak kullanılmaz")
    .replace(/Dikkat bozukluğu veya yürütücü işlev hakkında tanısal hüküm üretmez/gi, "Dikkat alanı veya yürütücü işlev hakkında tanısal hüküm üretmez")
    .replace(/madde, norm tablosu veya manuel içeriği/gi, "test içeriği, norm tablosu veya manuel bilgisi")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return sanitized;
}

function splitSentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function normalizeSentence(sentence: string): string {
  return sentence
    .toLocaleLowerCase("tr-TR")
    .replace(/[“”"()]/g, "")
    .replace(/\d+\/\d+/g, "SCORE")
    .replace(/\s+/g, " ")
    .trim();
}

function findRepeatedSentences(sentences: string[]): string[] {
  const seen = new Map<string, number>();
  const repeated: string[] = [];
  for (const sentence of sentences) {
    const normalized = normalizeSentence(sentence);
    if (normalized.length < 70) continue;
    const count = seen.get(normalized) || 0;
    seen.set(normalized, count + 1);
    if (count === 1) repeated.push(sentence);
  }
  return repeated;
}

export function analyzeReportLanguageQuality(text: string): ReportLanguageQualityResult {
  const value = String(text || "");
  const issues: ReportLanguageIssue[] = [];

  for (const rule of FORBIDDEN_LANGUAGE_PATTERNS) {
    const match = value.match(rule.pattern);
    if (match) {
      issues.push({ code: rule.code, severity: rule.severity, message: rule.message, evidence: match[0] });
    }
  }

  const asciiMatches = ASCII_TURKISH_PATTERNS.filter((pattern) => pattern.test(value));
  if (asciiMatches.length > 0) {
    issues.push({
      code: "ascii_turkish_leak",
      severity: "medium",
      message: "Türkçe karakteri bozuk klinik metin final raporda görünüyor.",
      evidence: String(asciiMatches.length),
    });
  }

  const sentences = splitSentences(value);
  const sentenceWordCounts = sentences.map((sentence) => sentence.split(/\s+/).filter(Boolean).length);
  const averageSentenceWords = sentenceWordCounts.length
    ? Math.round((sentenceWordCounts.reduce((sum, count) => sum + count, 0) / sentenceWordCounts.length) * 10) / 10
    : 0;
  const longSentences = sentences.filter((sentence) => sentence.split(/\s+/).length > 42);
  if (longSentences.length > 0) {
    issues.push({
      code: "long_sentence",
      severity: "low",
      message: "Bazı cümleler lisans düzeyi okuyucu için gereğinden uzun.",
      evidence: longSentences[0],
    });
  }

  const repeated = findRepeatedSentences(sentences);
  if (repeated.length > 0) {
    issues.push({
      code: "repeated_sentence",
      severity: "medium",
      message: "Aynı veya çok benzer uzun cümle tekrar ediyor.",
      evidence: repeated[0],
    });
  }

  let score = 100;
  for (const issue of issues) {
    score -= issue.severity === "high" ? 18 : issue.severity === "medium" ? 8 : 3;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    classification: score >= 92 && !issues.some((issue) => issue.severity === "high") ? "strong" : score >= 80 ? "needs_review" : "problem",
    issues,
    metrics: {
      sentenceCount: sentences.length,
      averageSentenceWords,
      longSentenceCount: longSentences.length,
      repeatedSentenceCount: repeated.length,
    },
  };
}
