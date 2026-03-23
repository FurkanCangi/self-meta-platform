export const AGE_RANGE_OPTIONS = [
  { label: "24-35 ay", min: 24, max: 35, valueMonths: 30 },
  { label: "36-47 ay", min: 36, max: 47, valueMonths: 42 },
  { label: "48-59 ay", min: 48, max: 59, valueMonths: 54 },
  { label: "60-71 ay", min: 60, max: 71, valueMonths: 66 },
] as const;

export function getAgeBandLabel(ageMonths?: number | null): string | null {
  if (typeof ageMonths !== "number" || !Number.isFinite(ageMonths)) return null;
  const band = AGE_RANGE_OPTIONS.find((b) => ageMonths >= b.min && ageMonths <= b.max);
  return band ? band.label : null;
}

export function isSupportedAgeMonths(ageMonths?: number | null): boolean {
  return getAgeBandLabel(ageMonths) !== null;
}

function parseAgeRangeLabel(txt: string): number | null {
  const normalized = txt.trim().toLowerCase();

  for (const band of AGE_RANGE_OPTIONS) {
    const bandLabel = band.label.toLowerCase();
    if (normalized === bandLabel) return band.valueMonths;
    if (normalized === `${band.min}-${band.max}`) return band.valueMonths;
    if (normalized === `${band.min} - ${band.max}`) return band.valueMonths;
    if (normalized === `${band.min}-${band.max} ay`) return band.valueMonths;
    if (normalized === `${band.min} - ${band.max} ay`) return band.valueMonths;
  }

  const ranged = normalized.match(/(\d+)\s*-\s*(\d+)\s*ay?/i);
  if (ranged) {
    const min = Number(ranged[1]);
    const max = Number(ranged[2]);
    const found = AGE_RANGE_OPTIONS.find((b) => b.min === min && b.max === max);
    return found ? found.valueMonths : null;
  }

  return null;
}

export function parseAgeMonths(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const txt = String(value).trim().toLowerCase();
  if (!txt) return null;

  // 1) Öncelik: desteklenen yaş aralığı etiketleri
  const fromRange = parseAgeRangeLabel(txt);
  if (fromRange !== null) return fromRange;

  // 2) Açık birim varsa parse et, fakat sadece desteklenen band içindeyse kabul et
  const yearMonth = txt.match(/(\d+(?:[.,]\d+)?)\s*(yaş|yas|year|years|yıl|yil)/i);
  const monthOnly = txt.match(/(\d+(?:[.,]\d+)?)\s*(ay|month|months)/i);

  let years = 0;
  let months = 0;

  if (yearMonth) {
    years = Number(yearMonth[1].replace(",", "."));
  }

  if (monthOnly) {
    months = Number(monthOnly[1].replace(",", "."));
  }

  if (years > 0 || months > 0) {
    const totalMonths = Math.round(years * 12 + months);
    return isSupportedAgeMonths(totalMonths) ? totalMonths : null;
  }

  // 3) "Yaş: 3 yaş" gibi satırlar
  const ageLine = txt.match(/yaş\s*[:\-]\s*([^\n]+)/i) || txt.match(/yas\s*[:\-]\s*([^\n]+)/i);
  if (ageLine?.[1]) {
    return parseAgeMonths(ageLine[1]);
  }

  // 4) Sadece sayı verilirse kabul ETME
  return null;
}

export function extractAgeMonthsFromAnamnez(anamnez?: string | null): number | null {
  if (!anamnez) return null;

  const patterns = [
    /yaş aralığı\s*[:\-]\s*([^\n]+)/i,
    /yaş\s*[:\-]\s*([^\n]+)/i,
    /yas\s*[:\-]\s*([^\n]+)/i,
    /age\s*[:\-]\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = anamnez.match(pattern);
    if (match?.[1]) {
      const parsed = parseAgeMonths(match[1]);
      if (parsed !== null) return parsed;
    }
  }

  return null;
}
