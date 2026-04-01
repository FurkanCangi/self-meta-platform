type QualityDomain = {
  key: string
  label: string
  score: number
  level: string
}

export type QualityGuidance = {
  focusMode: "balanced" | "selective" | "paired" | "widespread"
  primaryEvidenceLines: string[]
  supportingEvidenceLines: string[]
  restraintLines: string[]
  cautionLines: string[]
}

export type NarrativeGuardViolation = {
  code: string
  severity: "high" | "medium"
  message: string
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/\s+/g, " ")
    .trim()
}

function getFocusMode(domainResults: QualityDomain[], globalLevel: string): QualityGuidance["focusMode"] {
  const nonTypical = domainResults.filter((domain) => domain.level !== "Tipik")

  if (nonTypical.length === 0 || globalLevel === "Tipik" && nonTypical.length <= 1) {
    return nonTypical.length === 1 ? "selective" : "balanced"
  }

  if (nonTypical.length === 1) return "selective"
  if (nonTypical.length === 2) return "paired"
  return "widespread"
}

export function buildQualityGuidance(params: {
  domainResults: QualityDomain[]
  globalLevel: string
  profileType: string
  anamnezThemes?: string[]
  matchedDomains?: string[]
  therapistInsights?: string[]
  externalClinicalFindings?: string[]
  externalClinicalWarnings?: string[]
  criticalItemLines?: string[]
  alignedItemLines?: string[]
}): QualityGuidance {
  const sortedWeak = [...params.domainResults]
    .filter((domain) => domain.level !== "Tipik")
    .sort((a, b) => a.score - b.score)

  const sortedStrong = [...params.domainResults]
    .filter((domain) => domain.level === "Tipik")
    .sort((a, b) => b.score - a.score)

  const focusMode = getFocusMode(params.domainResults, params.globalLevel)
  const primaryEvidenceLines: string[] = []
  const supportingEvidenceLines: string[] = []
  const restraintLines: string[] = []
  const cautionLines: string[] = []

  if (sortedWeak[0]) {
    primaryEvidenceLines.push(
      `${sortedWeak[0].label} ${sortedWeak[0].score}/50 ile en düşük alan görünümünü vermektedir.`
    )
  }

  if (sortedWeak[1] && focusMode !== "selective") {
    primaryEvidenceLines.push(
      `${sortedWeak[1].label} ${sortedWeak[1].score}/50 ile birincil örüntüye eşlik eden ikinci zorlanma alanıdır.`
    )
  }

  if (Array.isArray(params.alignedItemLines) && params.alignedItemLines.length > 0) {
    supportingEvidenceLines.push(...params.alignedItemLines.slice(0, 2))
  }

  if (Array.isArray(params.criticalItemLines) && params.criticalItemLines.length > 0) {
    primaryEvidenceLines.push(...params.criticalItemLines.slice(0, 2))
  }

  if (Array.isArray(params.therapistInsights) && params.therapistInsights.length > 0) {
    supportingEvidenceLines.push(`Terapist gözlemi: ${params.therapistInsights[0]}`)
  }

  if (Array.isArray(params.externalClinicalFindings) && params.externalClinicalFindings.length > 0) {
    supportingEvidenceLines.push(`Ek klinik bulgu: ${params.externalClinicalFindings[0]}`)
  }

  if (sortedStrong[0]) {
    supportingEvidenceLines.push(
      `${sortedStrong[0].label} ${sortedStrong[0].score}/50 ile göreli korunmuş görünmektedir.`
    )
  }

  if (focusMode === "balanced") {
    restraintLines.push("Tüm alanlar tipikse risk kümesi, yaygın klinik yük veya birincil kırılgan eksen üretme.")
  }

  if (focusMode === "selective") {
    restraintLines.push("Yalnız tek tipik dışı alan varsa metni seçici kırılganlık çerçevesinde tut; yaygın örüntü gibi yazma.")
  }

  if (focusMode === "paired") {
    restraintLines.push("İki alan birlikte öne çıkıyorsa örüntüyü çift eksenli kur; bunu tek alanlı seçici profil gibi yazma.")
  }

  if (focusMode === "widespread") {
    restraintLines.push("Yaygın örüntü varsa önce merkez alanı, sonra eşlik eden alanları ve korunmuş alanları ayrı göster.")
  }

  if (params.globalLevel === "Tipik") {
    restraintLines.push("Genel düzey tipikse dili temkinli tut; belirgin destek ihtiyacı, yüksek klinik yük veya yaygın güçlük dili kurma.")
  }

  if (Array.isArray(params.externalClinicalWarnings) && params.externalClinicalWarnings.length > 0) {
    cautionLines.push(...params.externalClinicalWarnings.slice(0, 2))
    restraintLines.push("Yaş uyumsuz veya temkin gerektiren dış testleri ana karar eksenine taşıma.")
  }

  if ((!params.matchedDomains || params.matchedDomains.length === 0) && (!params.alignedItemLines || params.alignedItemLines.length === 0)) {
    restraintLines.push("Anamnezle yüksek uyum iddiasını abartma; veri sınırlıysa kısmi uyum veya sınırlı eşleşme dili kullan.")
  }

  if (
    params.globalLevel === "Tipik" &&
    Array.isArray(params.anamnezThemes) &&
    params.anamnezThemes.length > 0 &&
    sortedWeak.length === 0
  ) {
    cautionLines.push("Anamnez temaları korunmuş skorlarla birlikte ele alınmalı; bağlama duyarlı hassasiyet varsa sınırlı ve temkinli yazılmalı.")
  }

  return {
    focusMode,
    primaryEvidenceLines: primaryEvidenceLines.slice(0, 4),
    supportingEvidenceLines: supportingEvidenceLines.slice(0, 4),
    restraintLines: restraintLines.slice(0, 5),
    cautionLines: cautionLines.slice(0, 3),
  }
}

export function getNarrativeGuardViolations(params: {
  text: string
  domainResults: QualityDomain[]
  globalLevel: string
  profileType: string
}): NarrativeGuardViolation[] {
  const text = normalizeText(params.text)
  const nonTypical = params.domainResults.filter((domain) => domain.level !== "Tipik")
  const violations: NarrativeGuardViolation[] = []

  const hasAny = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text))

  if (nonTypical.length === 0) {
    if (hasAny([/birincil kırılgan/, /risk ekseni/, /yaygın regülasyon yük/, /çok alanlı güçlük/, /yüksek klinik yük/])) {
      violations.push({
        code: "all_typical_overpathologized",
        severity: "high",
        message: "Tüm alanlar tipik olmasına rağmen metin gereksiz risk veya yaygın yük dili kuruyor.",
      })
    }
  }

  if (params.globalLevel === "Tipik") {
    if (hasAny([/yüksek klinik yük/, /belirgin destek ihtiyacı/, /çoklu alanda belirgin/, /yaygın güçlük/])) {
      violations.push({
        code: "typical_global_tone_too_heavy",
        severity: "high",
        message: "Genel düzey tipik olmasına rağmen anlatı tonu gereğinden ağır.",
      })
    }
  }

  if (nonTypical.length === 1) {
    if (hasAny([/çok alanlı/, /yaygın regülasyon yük/, /yaygın güçlük/, /birden fazla alan/, /çoklu alan/, /genişleyen/])) {
      violations.push({
        code: "selective_profile_written_as_widespread",
        severity: "high",
        message: "Tek alanlı kırılganlık çok alanlı veya yaygın örüntü gibi yazılmış.",
      })
    }
  }

  if (nonTypical.length >= 3 || params.profileType.includes("Yaygın")) {
    if (hasAny([/seçici bir kırılganlık/, /alanında seçici kırılganlık/, /temel olarak .* seçici bir kırılganlık/])) {
      violations.push({
        code: "widespread_profile_written_as_selective",
        severity: "high",
        message: "Yaygın örüntü, anlatıda yanlış biçimde seçici kırılganlık gibi yazılmış.",
      })
    }
  }

  if (params.profileType.includes("Seçici")) {
    if (hasAny([/yaygın regülasyon yük/, /çok alanlı güçlük/, /genişleyen örüntü/])) {
      violations.push({
        code: "selective_name_conflicts_with_body",
        severity: "high",
        message: "Seçici profil adı ile metin gövdesi arasında yaygınlık çelişkisi var.",
      })
    }
  }

  if (params.profileType === "Dengeli / Korunmuş Profil") {
    if (hasAny([/birincil kırılgan alan/, /görece en kırılgan alan/, /risk odağı/])) {
      violations.push({
        code: "balanced_profile_has_primary_weak_focus",
        severity: "high",
        message: "Dengeli/korunmuş profilde gereksiz kırılgan eksen kurulmuş.",
      })
    }
  }

  if (params.profileType.includes("Duyusal-Duygusal") && !text.includes("duygusal") && !text.includes("duyusal")) {
    violations.push({
      code: "paired_profile_not_explained",
      severity: "medium",
      message: "İki alanlı profil adı anlatıda yeterince açıklanmıyor.",
    })
  }

  return violations
}

export function hasCriticalNarrativeGuardViolation(params: {
  text: string
  domainResults: QualityDomain[]
  globalLevel: string
  profileType: string
}): boolean {
  return getNarrativeGuardViolations(params).some((issue) => issue.severity === "high")
}
