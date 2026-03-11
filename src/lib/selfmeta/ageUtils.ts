export function parseAgeMonths(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const txt = String(value).trim().toLowerCase();
  if (!txt) return null;

  const directNumber = Number(txt.replace(",", "."));
  if (Number.isFinite(directNumber)) {
    return directNumber <= 10 ? Math.round(directNumber * 12) : Math.round(directNumber);
  }

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

  if (years === 0 && months === 0) {
    const ageLine = txt.match(/yaş\s*[:\-]\s*([^\n]+)/i) || txt.match(/yas\s*[:\-]\s*([^\n]+)/i);
    if (ageLine) return parseAgeMonths(ageLine[1]);
    return null;
  }

  return Math.round(years * 12 + months);
}

export function extractAgeMonthsFromAnamnez(anamnez?: string | null): number | null {
  if (!anamnez) return null;

  const patterns = [
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
