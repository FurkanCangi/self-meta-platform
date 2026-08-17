function cleanComparisonLabel(value: string) {
  return value.trim()
    .replace(/^["“”']+|["“”'?.!,;:]+$/gu, "")
    .replace(/\s+(?:kavramını|kavramini|başlığını|basligini)$/iu, "")
    .trim()
}

export function parseDnaS13CanaryComparison(question: string): readonly [string, string] | null {
  const source = question.trim()
  const between = source.match(/^(.{2,160}?)\s+ile\s+(.{2,160}?)\s+arasındaki\s+(?:fark(?:lar)?|ilişki|karşılaştırma)/iu)
    ?? source.match(/^(.{2,160}?)\s+ile\s+(.{2,160}?)\s+arasinda(?:ki)?\s+(?:fark(?:lar)?|iliski|karsilastirma)/iu)
  const versus = source.match(/^(.{2,160}?)\s+(?:vs\.?|versus)\s+(.{2,160}?)(?:\s+(?:karşılaştır|karsilastir|fark(?:ı|i)?\s+nedir).*)?[?.!]*$/iu)
  // Prefer the explicit Turkish comparison separator `ile`. A catalog title
  // may itself contain `ve`; that internal conjunction is not a side split.
  const comparedWithIle = source.match(/^(.{2,160}?)\s+ile\s+(.{2,160}?)\s+(?:karşılaştır|karsilastir)/iu)
  const comparedWithVe = source.match(/^(.{2,160}?)\s+ve\s+(.{2,160}?)\s+(?:karşılaştır|karsilastir)/iu)
  const compared = comparedWithIle ?? comparedWithVe
  const sameThing = source.match(/^(.{2,160}?)\s+ile\s+(.{2,160}?)\s+(?:aynı|ayni)\s+(?:şey|sey)(?:\s+mi)?/iu)
  const opposed = source.match(/^(.{2,160}?)\s+ile\s+(.{2,160}?)\s+(?:karşı\s+karşıya|karsi\s+karsiya)\s+kon\w*/iu)
  const orderedDistinction = source.match(/^(.{2,160}?)\s+ile\s+(.{2,160}?)\s+.*?\b(?:birincinin|ilkinin)\b.*?\b(?:ikincinin|digerinin)\b.*?\b(?:ayrim|fark)/iu)
  const match = between ?? versus ?? compared ?? sameThing ?? opposed ?? orderedDistinction
  if (!match?.[1] || !match[2]) return null
  const left = cleanComparisonLabel(match[1])
  const right = cleanComparisonLabel(match[2])
  return left.length >= 2 && right.length >= 2 ? Object.freeze([left, right]) : null
}
