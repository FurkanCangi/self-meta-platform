export const CANONICAL_REPORT_HEADINGS = [
  "1. Klinik Karar Özeti",
  "2. Kanıt Temelli Profil Özeti",
  "3. Alan Bazlı Klinik Yorum",
  "4. Klinik Örüntü ve Formülasyon",
  "5. Anamnez, Gözlem ve Test Uyumunun Değerlendirilmesi",
  "6. Klinik Önceliklendirme Notu",
  "7. Klinik Sonuç",
] as const

export const OPTIONAL_REPORT_HEADINGS = [
  "8. Literatürle Uyumlu Klinik Dayanak",
] as const

const LEGACY_OR_VARIANT_HEADINGS: Array<[RegExp, string]> = [
  [/^\s*(?:1\.\s*)?Klinik Karar Özeti\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[0]],
  [/^\s*(?:1\.\s*)?Genel Sonuç\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[0]],
  [/^\s*(?:1\.\s*)?Genel Klinik Değerlendirme\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[0]],
  [/^\s*(?:2\.\s*)?Kanıt Temelli Profil Özeti\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[1]],
  [/^\s*(?:2\.\s*)?Sayısal Sonuç Özeti\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[1]],
  [/^\s*(?:2\.\s*)?Öncelikli Self-Regülasyon Alanları\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[1]],
  [/^\s*(?:3\.\s*)?Alan Bazlı Klinik Yorum\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[2]],
  [/^\s*(?:4\.\s*)?Klinik Örüntü ve Formülasyon\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[3]],
  [/^\s*(?:3\.\s*)?Alanlar Arası Klinik Örüntü\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[3]],
  [/^\s*(?:4\.\s*)?Örüntü Analizi\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[3]],
  [/^\s*(?:5\.\s*)?Anamnez,\s*Gözlem ve Test Uyumunun Değerlendirilmesi\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[4]],
  [/^\s*(?:4\.\s*)?Anamnez ve Ölçek Bulgularının Uyum Düzeyi\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[4]],
  [/^\s*(?:5\.\s*)?Anamnez\s*[-–]\s*Test Uyum Değerlendirmesi\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[4]],
  [/^\s*(?:6\.\s*)?Klinik Önceliklendirme Notu\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[5]],
  [/^\s*(?:7\.\s*)?Klinik Önceliklendirme ve Karar Notu\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[5]],
  [/^\s*(?:7\.\s*)?Klinik Sonuç\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[6]],
  [/^\s*(?:5\.\s*)?Sonuç Düzeyinde Klinik Özet\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[6]],
  [/^\s*(?:6\.\s*)?Kısa Sonuç\s*:?\s*$/gim, CANONICAL_REPORT_HEADINGS[6]],
  [/^\s*(?:7\.\s*)?Literatürle Uyumlu Klinik Not\s*:?\s*$/gim, OPTIONAL_REPORT_HEADINGS[0]],
  [/^\s*(?:8\.\s*)?Literatürle Uyumlu Klinik(?: Not| Dayanak)?\s*:?\s*$/gim, OPTIONAL_REPORT_HEADINGS[0]],
]

const HEADING_ALIASES: Array<[RegExp, string]> = [
  [/1\.\s*Klinik Karar Özeti/gi, CANONICAL_REPORT_HEADINGS[0]],
  [/1\.\s*Genel Sonuç/gi, CANONICAL_REPORT_HEADINGS[0]],
  [/1\.\s*Genel Klinik Değerlendirme/gi, CANONICAL_REPORT_HEADINGS[0]],
  [/2\.\s*Kanıt Temelli Profil Özeti/gi, CANONICAL_REPORT_HEADINGS[1]],
  [/2\.\s*Sayısal Sonuç Özeti/gi, CANONICAL_REPORT_HEADINGS[1]],
  [/2\.\s*Öncelikli Self-Regülasyon Alanları/gi, CANONICAL_REPORT_HEADINGS[1]],
  [/3\.\s*Alan Bazlı Klinik Yorum/gi, CANONICAL_REPORT_HEADINGS[2]],
  [/4\.\s*Klinik Örüntü ve Formülasyon/gi, CANONICAL_REPORT_HEADINGS[3]],
  [/3\.\s*Alanlar Arası Klinik Örüntü/gi, CANONICAL_REPORT_HEADINGS[3]],
  [/4\.\s*Örüntü Analizi/gi, CANONICAL_REPORT_HEADINGS[3]],
  [/5\.\s*Anamnez,\s*Gözlem ve Test Uyumunun Değerlendirilmesi/gi, CANONICAL_REPORT_HEADINGS[4]],
  [/4\.\s*Anamnez ve Ölçek Bulgularının Uyum Düzeyi/gi, CANONICAL_REPORT_HEADINGS[4]],
  [/5\.\s*Anamnez\s*[-–]\s*Test Uyum Değerlendirmesi/gi, CANONICAL_REPORT_HEADINGS[4]],
  [/6\.\s*Klinik Önceliklendirme Notu/gi, CANONICAL_REPORT_HEADINGS[5]],
  [/7\.\s*Klinik Önceliklendirme ve Karar Notu/gi, CANONICAL_REPORT_HEADINGS[5]],
  [/7\.\s*Klinik Sonuç/gi, CANONICAL_REPORT_HEADINGS[6]],
  [/5\.\s*Sonuç Düzeyinde Klinik Özet/gi, CANONICAL_REPORT_HEADINGS[6]],
  [/6\.\s*Kısa Sonuç/gi, CANONICAL_REPORT_HEADINGS[6]],
  [/7\.\s*Literatürle Uyumlu Klinik Not/gi, OPTIONAL_REPORT_HEADINGS[0]],
  [/8\.\s*Literatürle Uyumlu Klinik(?: Not| Dayanak)?/gi, OPTIONAL_REPORT_HEADINGS[0]],
]

const HEADING_PATTERN =
  /(1\.\s*Klinik Karar Özeti|1\.\s*Genel Klinik Değerlendirme|1\.\s*Genel Sonuç|2\.\s*Kanıt Temelli Profil Özeti|2\.\s*Sayısal Sonuç Özeti|2\.\s*Öncelikli Self-Regülasyon Alanları|3\.\s*Alan Bazlı Klinik Yorum|3\.\s*Alanlar Arası Klinik Örüntü|4\.\s*Klinik Örüntü ve Formülasyon|4\.\s*Örüntü Analizi|4\.\s*Anamnez ve Ölçek Bulgularının Uyum Düzeyi|5\.\s*Anamnez,\s*Gözlem ve Test Uyumunun Değerlendirilmesi|5\.\s*Anamnez\s*[-–]\s*Test Uyum Değerlendirmesi|5\.\s*Sonuç Düzeyinde Klinik Özet|6\.\s*Klinik Önceliklendirme Notu|6\.\s*Kısa Sonuç|7\.\s*Klinik Sonuç|7\.\s*Klinik Önceliklendirme ve Karar Notu|7\.\s*Literatürle Uyumlu Klinik Not|8\.\s*Literatürle Uyumlu Klinik(?: Not| Dayanak)?|Klinik Karar Özeti|Kanıt Temelli Profil Özeti|Alan Bazlı Klinik Yorum|Klinik Örüntü ve Formülasyon|Anamnez,\s*Gözlem ve Test Uyumunun Değerlendirilmesi|Klinik Önceliklendirme Notu|Klinik Sonuç|Genel Klinik Değerlendirme|Sayısal Sonuç Özeti|Örüntü Analizi|Anamnez\s*[-–]\s*Test Uyum Değerlendirmesi|Kısa Sonuç|Klinik Önceliklendirme ve Karar Notu|Literatürle Uyumlu Klinik(?: Not| Dayanak)?)/g

function applyHeadingLineNormalization(text: string): string {
  let normalized = text

  for (const [pattern, replacement] of LEGACY_OR_VARIANT_HEADINGS) {
    normalized = normalized.replace(pattern, replacement)
  }

  return normalized
}

export function normalizeClinicalReportText(text: string): string {
  if (!text) return ""

  let normalized = String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\[\[END_OF_REPORT\]\]/g, "")
    .replace(/age_band_heuristic/g, "")
    .replace(/fallback_fixed/g, "")
    .replace(/^##\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/Kullanılan norm \/ referans kaynağı:\s*\.?/g, "")
    .replace(/\.\s*olarak görünmektedir\./g, ".")
    .replace(/Mimari\s+([a-zçğıöşü\s-]+),\s*şiddet\s+ise\s+([a-zçğıöşü-]+)\s+düzeydedir\./gi, "Örüntü yapısı $1 ve klinik yük $2 düzeydedir.")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()

  normalized = applyHeadingLineNormalization(normalized)

  for (const [pattern, replacement] of HEADING_ALIASES) {
    normalized = normalized.replace(pattern, replacement)
  }

  normalized = normalized
    .replace(/([^\n])\s+(?=(?:1\.|2\.|3\.|4\.|5\.|6\.|7\.|8\.)\s)/g, "$1\n\n")
    .replace(HEADING_PATTERN, (match) => `\n${match}`)
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return normalized
}

export function hasAllCanonicalReportSections(text: string): boolean {
  const sections = splitClinicalReportSections(text)
  return CANONICAL_REPORT_HEADINGS.every((heading) =>
    sections.some((section) => section.heading === heading)
  )
}

export function splitClinicalReportSections(text: string): Array<{ heading: string; body: string }> {
  const normalized = normalizeClinicalReportText(text)
  if (!normalized) return []

  const blocks = normalized
    .split(/\n(?=\d+\.\s)/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
    const heading = lines[0] || ""
    const body = lines.slice(1).join("\n").trim()

    return { heading, body }
  })
}

export function getClinicalReportSectionHeadings(text: string): string[] {
  return splitClinicalReportSections(text).map((section) => section.heading)
}

function shouldUseFallbackClinicalSection(heading: string, primaryBody: string): boolean {
  const body = String(primaryBody || "").trim()
  if (!body) return true

  if (heading === "1. Klinik Karar Özeti") {
    return !/(Klinik karar cümlesi|öncelikli klinik hipotez|en güçlü klinik hipotez|temel klinik eksen|ana klinik eksen)/i.test(body)
  }

  if (heading === "2. Kanıt Temelli Profil Özeti") {
    const hasScoreEvidence = /(\/50|\/300|toplam skor|genel düzey|global|Tipik|Riskli|Atipik)/i.test(body)
    const hasSynthesis = /(karar\/sentez|karar|sentez|klinik izlem önceliği|öncelikli klinik|kanıt profili)/i.test(body)
    return !hasScoreEvidence || !hasSynthesis
  }

  if (heading === "6. Klinik Önceliklendirme Notu") {
    const hasDecisionStructure =
      /Klinik karar cümlesi:/i.test(body) &&
      /Klinik formülasyon:/i.test(body) &&
      /Klinik öncelik sırası:/i.test(body) &&
      /Veri güven(?: düzeyi)?:/i.test(body)
    const hasClinicalHypothesis =
      /(öncelikli klinik hipotez|en güçlü klinik hipotez|mevcut verilerle en güçlü klinik eksen|veri güven)/i.test(
        body
      )
    return !hasDecisionStructure || !hasClinicalHypothesis
  }

  return false
}

export function mergeClinicalReportSections(primaryText: string, fallbackText: string): string {
  const primarySections = new Map(
    splitClinicalReportSections(primaryText).map((section) => [section.heading, section.body])
  )
  const fallbackSections = new Map(
    splitClinicalReportSections(fallbackText).map((section) => [section.heading, section.body])
  )

  return CANONICAL_REPORT_HEADINGS.map((heading) => {
    const primaryBody = String(primarySections.get(heading) || "").trim()
    const fallbackBody = String(fallbackSections.get(heading) || "").trim()
    const body = shouldUseFallbackClinicalSection(heading, primaryBody) ? fallbackBody : primaryBody
    return [heading, body].filter(Boolean).join("\n")
  })
    .filter(Boolean)
    .join("\n\n")
    .trim()
}
