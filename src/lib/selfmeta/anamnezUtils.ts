import { findSupportedExternalTestByName } from "./externalTestRegistry";

export type AnamnezRecord = Record<string, unknown>;
export type AnamnezFieldDefinition = { key: string; label: string }
export type AnamnezThemeSignals = {
  sensory: boolean
  emotional: boolean
  cognitiveExecutive: boolean
  bodyIntero: boolean
  transitionCoregulation: boolean
  adaptiveDailyLiving: boolean
  socialPragmatic: boolean
  languageLoad: boolean
  motorPraxis: boolean
  strengths: boolean
  referralOrConcerns: boolean
  therapistComments: boolean
  medical: boolean
}

const PLACEHOLDER_VALUES = new Set([
  "",
  "-",
  "--",
  "---",
  "*",
  "**",
  "***",
  ".",
  "..",
  "...",
  "yok",
  "yok.",
  "bilinmiyor",
  "bilmiyorum",
  "belirsiz",
  "none",
  "null",
  "undefined",
  "na",
  "n/a",
  "x",
  "xx",
  "xxx",
  "z",
  "zz",
  "zzz",
]);

const LABEL_TO_KEY: Record<string, string> = {
  "adısoyadı": "ad_soyad",
  "adi-soyadi": "ad_soyad",
  "adisoyadi": "ad_soyad",
  "adı-soyadı": "ad_soyad",
  "danışankodu": "client_code",
  "danisankodu": "client_code",
  "kayittarihi": "record_date",
  "kayıttarihi": "record_date",
  "yaş": "age",
  "yas": "age",
  "yaşaralığı": "age_range",
  "yasaraligi": "age_range",
  "cinsiyet": "gender",
  "tanı": "diagnosis",
  "tani": "diagnosis",
  "tıbbigeçmiş": "medical_history",
  "tibbigeçmis": "medical_history",
  "alerjiepilepsikabızlıkishalkoliknöbet": "allergy_epilepsy_gi_colic_seizure",
  "alerjiepilepsikabizlikishalkoliknobet": "allergy_epilepsy_gi_colic_seizure",
  "şuanaldığıtedaviveterapiler": "current_therapies",
  "suanaldigitedaviveterapiler": "current_therapies",
  "dahaöncealdığıamabıraktığıtedaviler": "past_therapies",
  "dahaoncealdigiamabiraktigitedaviler": "past_therapies",
  "medikaltedavilerilaçlarvesaatleri": "medications",
  "medikaltedavilerilaclarvesaatleri": "medications",
  "doğumöncesihikâye": "prenatal_story",
  "dogumoncesihikaye": "prenatal_story",
  "doğumhikayesi": "birth_story",
  "dogumhikayesi": "birth_story",
  "doğumsonrasıhikâye": "postnatal_story",
  "dogumsonrasihikaye": "postnatal_story",
  "düşükdoğumhikayesivarmı": "low_birth_history",
  "dusukdogumhikayesivarmi": "low_birth_history",
  "beslenmeşekli": "feeding_type",
  "beslenmesekli": "feeding_type",
  "sevdiğiyemekler": "liked_foods",
  "sevdigiyemekler": "liked_foods",
  "reddettiğiyemekler": "rejected_foods",
  "reddettigiyemekler": "rejected_foods",
  "sevdiğioyuncaklar": "liked_toys",
  "sevdigioyuncaklar": "liked_toys",
  "çocuğungüçlüyanları": "strengths",
  "cocugungucluyanlari": "strengths",
  "birincilendişelerhedefler": "parent_concerns_goals",
  "birincilendiselerhedefler": "parent_concerns_goals",
  "ebeveyniletişimbilgileri": "parent_contact",
  "ebeveyniletisimbilgileri": "parent_contact",
  "başvurusebebi": "referral_reason",
  "basvurusebebi": "referral_reason",
  "terapistyorumlari": "therapist_comments",
  "terapistyorumu": "therapist_comments",
  "ekkliniktestbulgular": "external_clinical_findings",
  "ekkliniktestbulgusu": "external_clinical_findings",
  "ekklinikbulgular": "external_clinical_findings",
};

export const REPORT_INCLUDED_ANAMNEZ_FIELDS: AnamnezFieldDefinition[] = [
  { key: "age_range", label: "Yaş aralığı" },
  { key: "diagnosis", label: "Tanı" },
  { key: "referral_reason", label: "Başvuru sebebi" },
  { key: "parent_concerns_goals", label: "Birincil endişeler/hedefler" },
  { key: "therapist_comments", label: "Terapist yorumları" },
  { key: "strengths", label: "Çocuğun güçlü yanları" },
  { key: "medical_history", label: "Tıbbi geçmiş" },
  { key: "allergy_epilepsy_gi_colic_seizure", label: "Alerji/epilepsi/kabızlık-ishal/kolik/nöbet" },
  { key: "current_therapies", label: "Şu an aldığı tedavi ve terapiler" },
  { key: "past_therapies", label: "Daha önce aldığı ama bıraktığı tedaviler" },
  { key: "medications", label: "Medikal tedaviler (ilaçlar ve saatleri)" },
  { key: "prenatal_story", label: "Doğum öncesi hikâye" },
  { key: "birth_story", label: "Doğum hikayesi" },
  { key: "postnatal_story", label: "Doğum sonrası hikâye" },
  { key: "low_birth_history", label: "Düşük doğum hikayesi var mı" },
  { key: "feeding_type", label: "Beslenme şekli" },
  { key: "liked_foods", label: "Sevdiği yemekler" },
  { key: "rejected_foods", label: "Reddettiği yemekler" },
  { key: "external_clinical_findings", label: "Ek klinik test / bulgular" },
]

export const REPORT_EXCLUDED_ANAMNEZ_FIELDS: AnamnezFieldDefinition[] = [
  { key: "ad_soyad", label: "Adı-soyadı" },
  { key: "client_code", label: "Danışan Kodu" },
  { key: "record_date", label: "Kayıt Tarihi" },
  { key: "gender", label: "Cinsiyet" },
  { key: "sibling_count", label: "Kardeş sayısı" },
  { key: "birth_order", label: "Kaçıncı çocuk" },
  { key: "household_count", label: "Evde kaç kişi kalıyor" },
  { key: "mother_age_at_birth", label: "Çocuk doğduğunda annenin yaşı" },
  { key: "mother_education", label: "Annenin eğitim düzeyi" },
  { key: "mother_job_working", label: "Annenin mesleği / çalışıyor mu?" },
  { key: "mother_work_hours", label: "Annenin çalışma saatleri" },
  { key: "caregiver_if_working", label: "Çalışıyorsa, çocuğa kim bakıyor" },
  { key: "father_education", label: "Babanın eğitim düzeyi" },
  { key: "father_job", label: "Babanın mesleği" },
  { key: "father_work_hours", label: "Babanın çalışma saatleri" },
  { key: "liked_toys", label: "Sevdiği oyuncaklar" },
  { key: "parent_contact", label: "Ebeveyn iletişim bilgileri" },
]

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ç]/g, "c")
    .replace(/[ğ]/g, "g")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ş]/g, "s")
    .replace(/[ü]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

export function cleanMeaningfulText(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = String(value)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return "";

  const normalized = normalizeLabel(text);

  if (PLACEHOLDER_VALUES.has(text.toLowerCase())) return "";
  if (PLACEHOLDER_VALUES.has(normalized)) return "";
  if (normalized.length <= 1) return "";

  return text;
}

export function buildReportRelevantAnamnezSection(record: Record<string, unknown>): string {
  const lines = REPORT_INCLUDED_ANAMNEZ_FIELDS
    .map(({ key, label }) => {
      const clean = cleanMeaningfulText(record?.[key]);
      return clean ? `${label}: ${clean}` : "";
    })
    .filter(Boolean)

  if (!lines.length) return ""

  return [
    "Rapor Yorumu İçin Klinik Anamnez",
    ...lines,
  ].join("\n")
}

function mergeStructured(record: AnamnezRecord): AnamnezRecord {
  const out: AnamnezRecord = {};

  for (const [key, value] of Object.entries(record || {})) {
    if (key === "raw_summary") continue;
    const cleaned = cleanMeaningfulText(value);
    if (cleaned) out[key] = cleaned;
  }

  const raw = cleanMeaningfulText(record?.raw_summary);
  if (!raw) return out;

  for (const line of raw.split("\n")) {
    const cleanedLine = cleanMeaningfulText(line);
    if (!cleanedLine) continue;

    const parts = cleanedLine.split(":");
    if (parts.length < 2) continue;

    const label = cleanMeaningfulText(parts.shift());
    const value = cleanMeaningfulText(parts.join(":"));

    if (!label || !value) continue;

    const mappedKey = LABEL_TO_KEY[normalizeLabel(label)];
    if (mappedKey && !out[mappedKey]) {
      out[mappedKey] = value;
    }
  }

  return out;
}

function getField(record: AnamnezRecord, key: string): string {
  const merged = mergeStructured(record);
  return cleanMeaningfulText(merged[key]);
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0)
}

function collectClinicalContext(record: AnamnezRecord) {
  const merged = mergeStructured(record);

  const rawSummary = cleanMeaningfulText(record?.raw_summary);
  const referral = cleanMeaningfulText(merged.referral_reason);
  const concerns = cleanMeaningfulText(merged.parent_concerns_goals);
  const therapistComments = cleanMeaningfulText(merged.therapist_comments);
  const strengths = cleanMeaningfulText(merged.strengths);
  const diagnosis = cleanMeaningfulText(merged.diagnosis);
  const medical = [
    cleanMeaningfulText(merged.medical_history),
    cleanMeaningfulText(merged.allergy_epilepsy_gi_colic_seizure),
    cleanMeaningfulText(merged.medications),
    cleanMeaningfulText(merged.current_therapies),
    cleanMeaningfulText(merged.past_therapies),
    cleanMeaningfulText(merged.prenatal_story),
    cleanMeaningfulText(merged.birth_story),
    cleanMeaningfulText(merged.postnatal_story),
    cleanMeaningfulText(merged.low_birth_history),
    cleanMeaningfulText(merged.feeding_type),
    cleanMeaningfulText(merged.liked_foods),
    cleanMeaningfulText(merged.rejected_foods),
  ]
    .filter(Boolean)
    .join(" | ");

  const reportRelevantNarrative = REPORT_INCLUDED_ANAMNEZ_FIELDS
    .map(({ key }) => cleanMeaningfulText(merged[key]))
    .filter(Boolean)
    .join(" | ");

  const themeNarrative = [referral, concerns, therapistComments]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

  const bodyNarrative = [medical, referral, therapistComments]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

  const allNarrative = [reportRelevantNarrative, referral, concerns, therapistComments, strengths, medical]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

  return {
    merged,
    rawSummary,
    referral,
    concerns,
    therapistComments,
    strengths,
    diagnosis,
    medical,
    themeNarrative,
    bodyNarrative,
    allNarrative,
  };
}

type ExternalFindingEntry = {
  testName: string
  result: string
  interpretation: string
  notes: string
}

function parseExternalFindingEntries(rawValue: unknown): ExternalFindingEntry[] {
  const raw = cleanMeaningfulText(rawValue)
  if (!raw) return []

  const blocks = raw
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks
    .map((block) => {
      const entry: ExternalFindingEntry = {
        testName: "",
        result: "",
        interpretation: "",
        notes: "",
      }

      for (const line of block.split("\n")) {
        const cleanLine = cleanMeaningfulText(line)
        if (!cleanLine.includes(":")) continue
        const [rawLabel, ...rest] = cleanLine.split(":")
        const label = normalizeLabel(rawLabel)
        const value = cleanMeaningfulText(rest.join(":"))
        if (!value) continue

        if (/testadi|testadı/.test(label)) entry.testName = value
        else if (/puansonuc|puan|sonuc/.test(label)) entry.result = value
        else if (/klinikyorumresmibulguozeti|klinikyorum|resmibulguozeti/.test(label)) entry.interpretation = value
        else if (/eknotlar|notlar|eknot/.test(label)) entry.notes = value
      }

      return entry
    })
    .filter((entry) => entry.testName || entry.interpretation || entry.result || entry.notes)
}

export function getAnamnezThemeSignals(record: AnamnezRecord): AnamnezThemeSignals {
  const { themeNarrative, bodyNarrative, allNarrative, strengths, referral, concerns, therapistComments, medical } =
    collectClinicalContext(record)

  const executiveCueCount = countMatches(themeNarrative, [
    /dikkat|odak/i,
    /görev|gorev/i,
    /başlat|baslat/i,
    /sürdür|surdur|bitir/i,
    /yönerge|yonerge/i,
    /oyunda kal|oyunu bırak|oyunu birak/i,
    /dağıl|dagil|kop/i,
  ])

  const sensoryCueCount = countMatches(allNarrative, [
    /gürültü|gurultu|ses/i,
    /kalabalık|kalabalik/i,
    /dokun|dokunsal|etiket/i,
    /saç kes|sac kes|tırnak|tirnak|banyo/i,
    /duyusal arayış|duyusal arayis|sıçrama|zipla|koşuştur/i,
  ])

  const transitionCueCount = countMatches(allNarrative, [
    /geçiş|gecis|bir etkinlikten diğerine/i,
    /ayrıl|ayril|vedalaş/i,
    /bekleme|sıra alma|sira alma/i,
    /bitirirken|oyunu bırak|oyunu birak/i,
  ])

  const coregCueCount = countMatches(allNarrative, [
    /anne|baba|ebeveyn|bakımveren|bakimveren/i,
    /sarıl|saril|teselli|eşlik|eslik/i,
    /yanına gel|yanina gel|yakın destek|yakin destek/i,
    /birlikte sakin|ko-?reg/i,
  ])

  const adaptiveCueCount = countMatches(allNarrative, [
    /öz bakım|oz bakim|özbakım|ozbakim/i,
    /giyin|fermuar|düğme|dugme|ayakkabı|ayakkabi/i,
    /tuvalet|diş fırça|dis firca|kaşık|kasik|çatal|catal/i,
    /masa düzeni|masa duzeni|kendi kendine yemek|kendi kendine yeme/i,
  ])

  const languageCueCount = countMatches(allNarrative, [
    /yönerge|yonerge/i,
    /anlama|sözel yük|sozel yuk|dilsel talep/i,
    /ifad[ea]|konuş|konus/i,
    /soru sorulduğunda|soru soruldugunda|anlatmakta/i,
  ])

  const socialCueCount = countMatches(allNarrative, [
    /akran|arkadaş|arkadas/i,
    /sıra alma|sira alma|karşılıklılık|karsiliklilik/i,
    /ortak dikkat|sosyal ipucu|pragmatik/i,
    /sohbete katıl|oyuna katıl|oyuna katil|esneklik/i,
  ])

  const praxisCueCount = countMatches(allNarrative, [
    /praksi|somatodispraks|somatodysprax/i,
    /motor plan|sekans|sırala|sirala/i,
    /iki taraflı|iki tarafli koordinasyon/i,
    /beden organizasyon|araç gereç|arac gerec/i,
  ])

  const sensory =
    sensoryCueCount >= 1 ||
    hasAny(String(referral).toLowerCase(), [/duyusal yük|duyusal hassas|duyusal arayış|duyusal arayis/i])

  const emotional =
    hasAny(themeNarrative, [
      /ağla|agla|öfke|ofke|sinir|kriz|sakinleş|sakinles|toparlan|taşma|tasma|duygusal/i,
    ])

  const cognitiveExecutive =
    executiveCueCount >= 2 ||
    hasAny(themeNarrative, [/çok uyaran|cok uyaran/i]) &&
      hasAny(themeNarrative, [/kop|dağıl|dagil|zorlan|takip|başlat|baslat|sürdür|surdur/i])

  const bodyIntero =
    hasAny(bodyNarrative, [
      /uyku|iştah|istah|beslen|açlık|aclik|susama|yorgun|tuvalet|kabız|kabiz|ishal|kolik|nöbet|nobet|epilepsi|alerji/i,
    ])

  const transitionCoregulation = transitionCueCount >= 1 && coregCueCount >= 1
  const adaptiveDailyLiving =
    adaptiveCueCount >= 2 ||
    hasAny(allNarrative, [
      /öz bakım|oz bakim|özbakım|ozbakim/i,
      /giyinme|tuvalet rutini|bagimsiz baslatma|bağımsız başlatma/i,
    ])
  const socialPragmatic = socialCueCount >= 1
  const languageLoad = languageCueCount >= 1
  const motorPraxis = praxisCueCount >= 1

  return {
    sensory,
    emotional,
    cognitiveExecutive,
    bodyIntero,
    transitionCoregulation,
    adaptiveDailyLiving,
    socialPragmatic,
    languageLoad,
    motorPraxis,
    strengths: Boolean(strengths),
    referralOrConcerns: Boolean(referral || concerns),
    therapistComments: Boolean(therapistComments),
    medical: Boolean(medical),
  }
}

export function extractTherapistInsights(record: AnamnezRecord): string[] {
  const { therapistComments } = collectClinicalContext(record);
  const clean = cleanMeaningfulText(therapistComments);
  if (!clean) return [];

  const lowered = clean.toLowerCase();
  const lines = [`Terapist gözlemi: ${truncateClinicalSupport(clean, 240)}`];

  if (/praksi|praxi|somatodispraks|somatodysprax|motor plan|sekans|siralama|iki tarafli koordinasyon|beden organizasyon/i.test(lowered)) {
    lines.push("Terapist gözleminde praksi, motor planlama veya beden organizasyonu alanına ilişkin klinik ipucu bulunmaktadır.");
  }

  if (/dikkat|gorev|görev|odak|surdur|sürdür|durdur|inhibisyon|esnek/i.test(lowered)) {
    lines.push("Terapist gözleminde dikkat, görev sürdürme veya yürütücü kontrol eksenini destekleyen bulgular tarif edilmektedir.");
  }

  if (/duyusal|uyaran|kalabalik|kalabalık|ses|dokun|tetikleyici/i.test(lowered)) {
    lines.push("Terapist gözleminde çevresel uyaran yükünün performans üzerindeki etkisine ilişkin klinik not bulunmaktadır.");
  }

  if (/duygu|ofke|öfke|sakinles|sakinleş|toparlan|cekilme|taşma|tasma/i.test(lowered)) {
    lines.push("Terapist gözleminde duygusal toparlanma veya yüklenme sonrası davranışsal dalgalanmaya ilişkin ipucu bulunmaktadır.");
  }

  if (/yorgun|uyku|aclik|açlık|beden|fizyolojik|tuvalet|huzursuz/i.test(lowered)) {
    lines.push("Terapist gözleminde beden-temelli düzenleme veya içsel durum değişimlerinin performansı etkilediği düşünülmektedir.");
  }

  return lines.slice(0, 3);
}

export function extractVisibleCaseInfo(
  record: AnamnezRecord,
  ctx?: { clientCode?: string; ageMonths?: number | null }
) {
  const { merged, diagnosis } = collectClinicalContext(record);

  const adSoyad = cleanMeaningfulText(merged.ad_soyad);
  const clientCode = cleanMeaningfulText(ctx?.clientCode) || cleanMeaningfulText(merged.client_code);
  const ageField = cleanMeaningfulText(merged.age);
  const ageText =
    typeof ctx?.ageMonths === "number" && Number.isFinite(ctx.ageMonths)
      ? `${ctx.ageMonths} ay`
      : ageField || "";

  return {
    adSoyad,
    clientCode,
    ageText,
    diagnosis,
  };
}

export function summarizeAnamnezThemes(record: AnamnezRecord): string[] {
  const { strengths, medical, therapistComments } = collectClinicalContext(record);
  const lines: string[] = [];
  const externalClinicalFindings = extractExternalClinicalFindings(record)
  const therapistInsights = extractTherapistInsights(record)
  const themeSignals = getAnamnezThemeSignals(record)

  if (themeSignals.transitionCoregulation) {
    lines.push(
      "Geçişler, ayrılma anları veya bakımveren desteği gerektiren bağlamlarda regülasyon kırılganlığının belirginleştiği tarif edilmektedir."
    );
  }

  if (themeSignals.adaptiveDailyLiving) {
    lines.push(
      "Öz bakım, günlük rutinleri başlatma veya sıralı günlük yaşam görevlerini sürdürme alanında işlevsel sürtünme tarif edilmektedir."
    );
  }

  if (themeSignals.languageLoad) {
    lines.push(
      "Sözel yük ve yönerge karmaşıklığı arttığında performansın, görevde kalmanın veya frustrasyon toleransının bozulabildiği bildirilmektedir."
    );
  }

  if (themeSignals.socialPragmatic) {
    lines.push(
      "Sosyal karşılıklılık, akran etkileşimi veya bağlama göre esneme talepleri arttığında düzenleyici yükün belirginleştiği tarif edilmektedir."
    );
  }

  if (themeSignals.motorPraxis) {
    lines.push(
      "Motor planlama, sekanslama veya beden organizasyonu yükünün günlük performansı zorlayabildiğine ilişkin klinik ipuçları bulunmaktadır."
    );
  }

  if (themeSignals.sensory) {
    lines.push(
      "Anamnezde çevresel veya dokunsal uyaran altında belirgin duyusal hassasiyet/arayış örüntüsü tarif edilmektedir."
    );
  }

  if (themeSignals.emotional) {
    lines.push(
      "Anamnezde yoğun uyaran veya zorlayıcı durumlar sonrası duygusal toparlanmanın uzayabildiği bildirilmektedir; bu durum duygusal regülasyon alanıyla ilişkili olabilir."
    );
  }

  if (themeSignals.cognitiveExecutive) {
    lines.push(
      "Görevi başlatma, sürdürme veya çok basamaklı talepleri organize etme ekseninde yürütücü yük tarif edilmektedir."
    );
  }

  if (themeSignals.bodyIntero) {
    lines.push(
      "Bedensel/fizyolojik bağlama ilişkin anamnez verileri mevcuttur; bu bilgiler fizyolojik regülasyon ve interosepsiyon yorumuna destekleyici bağlam sağlayabilir."
    );
  }

  if (themeSignals.strengths) {
    lines.push(
      "Anamnezde korunmuş veya destekleyici olabilecek güçlü yönler tarif edilmektedir; bunlar test sonuçlarıyla birlikte yorumlandığında profile denge kazandırabilir."
    );
  }

  if (themeSignals.referralOrConcerns) {
    lines.push(
      "Başvuru nedeni ve birincil ebeveyn endişeleri, testte öne çıkan alanların günlük yaşam karşılığını anlamlandırmak açısından yüksek değerli klinik veri sunmaktadır."
    );
  }

  if (themeSignals.therapistComments && therapistInsights.length > 0 && lines.length < 5) {
    lines.push(
      "Terapist gözlemleri, sorun örüntüsünün hangi bağlamda belirginleştiğini ve hangi alanların günlük performansta daha çok yük taşıdığını görünür kılmaktadır."
    );
  }

  if (themeSignals.medical && lines.length < 4) {
    lines.push(
      "Gelişimsel ve medikal öykü, regülasyon görünümünü bağlamsallaştıran ek bilgi sağlamaktadır; ancak bu veriler doğrudan neden-sonuç ilişkisi olarak ele alınmamalıdır."
    );
  }

  if (externalClinicalFindings.length > 0 && lines.length < 4) {
    lines.push(
      "Ek klinik değerlendirme bulguları da bildirilmiştir; bu veriler ana skor tablosunu değiştirmeden alt alan yorumlarına destekleyici bağlam sağlayabilir."
    );
  }

  return lines.slice(0, 4);
}

function truncatePreviewValue(value: string, maxLength: number): string {
  const clean = cleanMeaningfulText(value);
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function buildAnamnezPreview(
  value: AnamnezRecord | string | null | undefined,
  options?: { maxLength?: number }
): string {
  const record =
    typeof value === "string"
      ? { raw_summary: value }
      : value && typeof value === "object"
      ? value
      : {};

  const merged = mergeStructured(record);
  const maxLength = options?.maxLength ?? 260;

  const segments = [
    ["Adı-soyadı", merged.ad_soyad],
    ["Danışan Kodu", merged.client_code],
    ["Kayıt Tarihi", merged.record_date],
    ["Yaş aralığı", merged.age_range || merged.age],
    ["Tanı", merged.diagnosis],
    ["Başvuru sebebi", merged.referral_reason],
    ["Birincil endişeler/hedefler", merged.parent_concerns_goals],
    ["Ek klinik test / bulgular", merged.external_clinical_findings],
    ["Çocuğun güçlü yanları", merged.strengths],
    ["Tıbbi geçmiş", merged.medical_history],
  ]
    .map(([label, fieldValue]) => {
      const clean = truncatePreviewValue(String(fieldValue || ""), 80);
      return clean ? `${label}: ${clean}` : "";
    })
    .filter(Boolean);

  const preview = segments.join(" | ");
  if (preview && preview.length <= maxLength) return preview;
  if (preview) return `${preview.slice(0, Math.max(0, maxLength - 1)).trim()}…`;

  const rawFallback = truncatePreviewValue(String(record?.raw_summary || ""), maxLength);
  return rawFallback || "Anamnez bilgisi bulunmuyor.";
}

function truncateClinicalSupport(value: string, maxLength = 360): string {
  const clean = cleanMeaningfulText(value)
  if (!clean) return ""
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

export function extractExternalClinicalFindings(record: AnamnezRecord): string[] {
  const merged = mergeStructured(record)
  const raw = truncateClinicalSupport(String(merged.external_clinical_findings || ""))
  if (!raw) return []

  const entries = parseExternalFindingEntries(merged.external_clinical_findings)
  if (entries.length > 0) {
    return entries
      .map((entry) => {
        const test = findSupportedExternalTestByName(entry.testName)
        const lead = test ? test.name : entry.testName || "Ek test"
        const body = entry.interpretation || entry.result || entry.notes
        return body ? `${lead}: ${truncateClinicalSupport(body, 220)}` : ""
      })
      .filter(Boolean)
      .slice(0, 3)
  }

  return [`Ek klinik değerlendirme bildirimi: ${truncateClinicalSupport(raw, 220)}`]
}

export function extractAnamnezFlags(record: AnamnezRecord): string[] {
  const { strengths, medical, therapistComments } = collectClinicalContext(record);
  const flags: string[] = [];
  const externalClinicalFindings = extractExternalClinicalFindings(record)
  const themeSignals = getAnamnezThemeSignals(record)

  if (themeSignals.transitionCoregulation) {
    flags.push("Geçiş, ayrılma ve ko-regülasyon gerektiren anlarda kırılganlık tarif edilmektedir.");
  }

  if (themeSignals.adaptiveDailyLiving) {
    flags.push("Öz bakım ve günlük rutinleri sürdürme alanında işlevsel sürtünme bildirilmektedir.");
  }

  if (themeSignals.languageLoad) {
    flags.push("Sözel yük ve yönerge karmaşıklığı arttığında performansın bozulabildiği bildirilmektedir.");
  }

  if (themeSignals.socialPragmatic) {
    flags.push("Sosyal karşılıklılık ve esneklik taleplerinde zorlanma bildirilmektedir.");
  }

  if (themeSignals.motorPraxis) {
    flags.push("Motor planlama, sekanslama veya beden organizasyonu yükü tarif edilmektedir.");
  }

  if (themeSignals.sensory) {
    flags.push("Duyusal yüklenme ve tetikleyici çevresel uyaran teması bildirilmektedir.");
  }

  if (themeSignals.emotional) {
    flags.push("Yoğun uyaran sonrası duygusal toparlanma güçlüğü tarif edilmektedir.");
  }

  if (themeSignals.cognitiveExecutive) {
    flags.push("Çok uyaranlı bağlamlarda dikkat ve görev sürdürme güçlüğü bildirilmektedir.");
  }

  if (themeSignals.bodyIntero) {
    flags.push("Bedensel/fizyolojik bağlamın regülasyon görünümünü etkileyebileceği düşünülmektedir.");
  }

  if (themeSignals.strengths) {
    flags.push("Anamnezde korunmuş/güçlü işlev alanları tarif edilmektedir.");
  }

  if (themeSignals.referralOrConcerns) {
    flags.push("Başvuru nedeni ve ebeveyn öncelikleri klinik yorum için yüksek değerli bağlam sunmaktadır.");
  }

  if (themeSignals.therapistComments) {
    flags.push("Terapist gözlem notları, günlük performansta hangi alt sistemlerin yük taşıdığını netleştiren ek klinik bağlam sunmaktadır.");
  }

  if (themeSignals.medical) {
    flags.push("Gelişimsel/medikal öykü bağlamsal yorumda dikkate alınmalıdır.");
  }

  if (externalClinicalFindings.length > 0 && flags.length < 5) {
    flags.push("Ek klinik değerlendirme bulguları klinik yorumu derinleştiren destekleyici bağlam sunmaktadır.");
  }

  return flags.slice(0, 5);
}
