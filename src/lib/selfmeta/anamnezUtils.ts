export type AnamnezRecord = Record<string, unknown>;

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
  "yaş": "age",
  "yas": "age",
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
};

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

function collectClinicalContext(record: AnamnezRecord) {
  const merged = mergeStructured(record);

  const rawSummary = cleanMeaningfulText(record?.raw_summary);
  const referral = cleanMeaningfulText(merged.referral_reason);
  const concerns = cleanMeaningfulText(merged.parent_concerns_goals);
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

  const allNarrative = [rawSummary, referral, concerns, strengths, medical]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

  return {
    merged,
    rawSummary,
    referral,
    concerns,
    strengths,
    diagnosis,
    medical,
    allNarrative,
  };
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
  const { referral, concerns, strengths, medical, allNarrative } = collectClinicalContext(record);
  const lines: string[] = [];

  if (
    hasAny(allNarrative, [
      /gürültü|ses|kalabalık|dokun|dokunsal|saç kes|tırnak|yüz yık|etiket|banyo/i,
    ])
  ) {
    lines.push(
      "Anamnezde çevresel ve dokunsal uyaranlara duyarlılık tarif edilmektedir; bu bağlam duyusal regülasyon bulgularını klinik olarak anlamlandıran bir zemin sunmaktadır."
    );
  }

  if (
    hasAny(allNarrative, [
      /ağla|öfke|sinir|kriz|sakinleş|sakinles|duygu değiş|ani duygu|taşma|tasma/i,
    ])
  ) {
    lines.push(
      "Anamnezde yoğun uyaran veya zorlayıcı durumlar sonrası duygusal toparlanmanın uzayabildiği bildirilmektedir; bu durum duygusal regülasyon alanıyla ilişkili olabilir."
    );
  }

  if (
    hasAny(allNarrative, [
      /dikkat|oyunda kal|oyunu bırak|dagil|dağıl|yönerge|yonerge|görev|gorev|odak/i,
    ])
  ) {
    lines.push(
      "Çok uyaranlı bağlamlarda dikkat sürdürme ve görevde kalma güçlüğü tarif edilmektedir; bu örüntü bilişsel ve yürütücü alanlarla birlikte ele alınmalıdır."
    );
  }

  if (
    hasAny(allNarrative, [
      /uyku|iştah|istah|beslen|açlık|aclik|yorgun|tuvalet|kabız|kabiz|ishal|kolik|nöbet|nobet|epilepsi|alerji/i,
    ])
  ) {
    lines.push(
      "Bedensel/fizyolojik bağlama ilişkin anamnez verileri mevcuttur; bu bilgiler fizyolojik regülasyon ve interosepsiyon yorumuna destekleyici bağlam sağlayabilir."
    );
  }

  if (strengths) {
    lines.push(
      "Anamnezde korunmuş veya destekleyici olabilecek güçlü yönler tarif edilmektedir; bunlar test sonuçlarıyla birlikte yorumlandığında profile denge kazandırabilir."
    );
  }

  if (referral || concerns) {
    lines.push(
      "Başvuru nedeni ve birincil ebeveyn endişeleri, testte öne çıkan alanların günlük yaşam karşılığını anlamlandırmak açısından yüksek değerli klinik veri sunmaktadır."
    );
  }

  if (medical && lines.length < 4) {
    lines.push(
      "Gelişimsel ve medikal öykü, regülasyon görünümünü bağlamsallaştıran ek bilgi sağlamaktadır; ancak bu veriler doğrudan neden-sonuç ilişkisi olarak ele alınmamalıdır."
    );
  }

  return lines.slice(0, 4);
}

export function extractAnamnezFlags(record: AnamnezRecord): string[] {
  const { referral, concerns, strengths, medical, allNarrative } = collectClinicalContext(record);
  const flags: string[] = [];

  if (
    hasAny(allNarrative, [
      /gürültü|ses|kalabalık|dokun|dokunsal|saç kes|tırnak|yüz yık|etiket|banyo/i,
    ])
  ) {
    flags.push("Duyusal yüklenme ve tetikleyici çevresel uyaran teması bildirilmektedir.");
  }

  if (
    hasAny(allNarrative, [
      /ağla|öfke|sinir|kriz|sakinleş|sakinles|duygu değiş|ani duygu|taşma|tasma/i,
    ])
  ) {
    flags.push("Yoğun uyaran sonrası duygusal toparlanma güçlüğü tarif edilmektedir.");
  }

  if (
    hasAny(allNarrative, [
      /dikkat|oyunda kal|oyunu bırak|dagil|dağıl|yönerge|yonerge|görev|gorev|odak/i,
    ])
  ) {
    flags.push("Çok uyaranlı bağlamlarda dikkat ve görev sürdürme güçlüğü bildirilmektedir.");
  }

  if (
    hasAny(allNarrative, [
      /uyku|iştah|istah|beslen|açlık|aclik|yorgun|tuvalet|kabız|kabiz|ishal|kolik|nöbet|nobet|epilepsi|alerji/i,
    ])
  ) {
    flags.push("Bedensel/fizyolojik bağlamın regülasyon görünümünü etkileyebileceği düşünülmektedir.");
  }

  if (strengths) {
    flags.push("Anamnezde korunmuş/güçlü işlev alanları tarif edilmektedir.");
  }

  if (referral || concerns) {
    flags.push("Başvuru nedeni ve ebeveyn öncelikleri klinik yorum için yüksek değerli bağlam sunmaktadır.");
  }

  if (medical) {
    flags.push("Gelişimsel/medikal öykü bağlamsal yorumda dikkate alınmalıdır.");
  }

  return flags.slice(0, 5);
}
