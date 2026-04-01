import { splitClinicalReportSections } from "./reportText"
import { PRO_RAG_CHUNKS, type ProRagChunk } from "./proRag"

type Analysis = {
  globalLevel: string
  weakDomains?: string[]
  strongDomains?: string[]
  matchedDomains?: string[]
  therapistInsights?: string[]
  externalClinicalFindings?: string[]
}

type RagGroups = {
  general: ProRagChunk[]
  domain: ProRagChunk[]
  pattern: ProRagChunk[]
  anamnesis: ProRagChunk[]
  summary: ProRagChunk[]
}

export type SelectedProRagContext = {
  chunks: ProRagChunk[]
  grouped: RagGroups
  ids: string[]
}

const DOMAIN_TO_KEY: Record<string, string> = {
  "Fizyolojik Regülasyon": "physiological",
  "Duyusal Regülasyon": "sensory",
  "Duygusal Regülasyon": "emotional",
  "Bilişsel Regülasyon": "cognitive",
  "Yürütücü İşlev": "executive",
  "İnterosepsiyon": "interoception",
}

const SECTION_BY_GROUP: Record<keyof RagGroups, string[]> = {
  general: ["1. Genel Klinik Değerlendirme"],
  domain: ["3. Alan Bazlı Klinik Yorum"],
  pattern: ["4. Örüntü Analizi"],
  anamnesis: ["5. Anamnez – Test Uyum Değerlendirmesi"],
  summary: ["6. Kısa Sonuç"],
}

function mapDomain(domain: string): string {
  return DOMAIN_TO_KEY[String(domain || "").trim()] || ""
}

function addChunk(selected: string[], id: string) {
  if (!selected.includes(id)) selected.push(id)
}

function chooseRiskChunk(weakCount: number): string {
  if (weakCount >= 3) return "RISK_PROFILE_MULTI_DOMAIN"
  if (weakCount === 2) return "RISK_PROFILE_DUAL_DOMAIN"
  return "RISK_PROFILE_SINGLE_DOMAIN"
}

function findChunk(id: string): ProRagChunk | null {
  return PRO_RAG_CHUNKS.find((chunk) => chunk.id === id) || null
}

function buildGroups(chunks: ProRagChunk[]): RagGroups {
  return {
    general: chunks.filter((chunk) => chunk.tags.includes("base")),
    domain: chunks.filter((chunk) => chunk.tags.includes("domain")),
    pattern: chunks.filter((chunk) => chunk.tags.includes("pattern") || chunk.tags.includes("risk")),
    anamnesis: chunks.filter((chunk) => chunk.tags.includes("anamnesis")),
    summary: chunks.filter((chunk) => chunk.tags.includes("style")),
  }
}

function chunkSignals(chunk: ProRagChunk): string[] {
  const signals = new Set<string>()

  if (chunk.tags.includes("physiological")) {
    ;["fizyolojik", "uyku", "bedensel", "ritim"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("sensory")) {
    ;["duyusal", "uyaran", "hassas", "tetikleyici"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("emotional")) {
    ;["duygusal", "toparlanma", "yüklenme", "yatışma"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("cognitive")) {
    ;["bilişsel", "dikkat", "görev", "organizasyon"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("executive")) {
    ;["yürütücü", "dürtü", "kural", "yönerge"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("interoception")) {
    ;["interosepsiyon", "içsel", "beden sinyali", "tuvalet"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("pattern")) {
    ;["örüntü", "eksen", "birlikte", "karşıtlık", "korunmuş"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("therapist")) {
    ;["terapist", "gözlem", "performans", "bağlam", "model alma"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("external")) {
    ;["test", "bulgu", "destekleyici", "ek klinik", "yorum"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("risk")) {
    ;["yaygın", "çoklu", "seçici", "koruyucu", "yük"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("anamnesis")) {
    ;["anamnez", "bağlam", "uyum", "rutin", "tetikleyici"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("style")) {
    ;["sonuç", "profil", "klinik yük"].forEach((x) => signals.add(x))
  }
  if (chunk.tags.includes("base")) {
    ;["regülasyon", "bağlam", "örüntü"].forEach((x) => signals.add(x))
  }

  return Array.from(signals)
}

function estimateGroupCoverage(sectionText: string, chunks: ProRagChunk[]): number {
  if (!chunks.length) return 0
  const normalized = sectionText.toLowerCase()

  let used = 0
  for (const chunk of chunks) {
    const signals = chunkSignals(chunk)
    const hits = signals.filter((signal) => normalized.includes(signal.toLowerCase())).length
    if (hits >= 2) {
      used += 1
    }
  }

  return Math.round((used / chunks.length) * 100)
}

export function selectProRagContext(analysis: Analysis): SelectedProRagContext {
  const selectedIds: string[] = []

  const weakKeys = (analysis.weakDomains || []).map(mapDomain).filter(Boolean)
  const strongKeys = (analysis.strongDomains || []).map(mapDomain).filter(Boolean)
  const matchedKeys = (analysis.matchedDomains || []).map(mapDomain).filter(Boolean)

  addChunk(selectedIds, "REGULATION_OVERVIEW")
  addChunk(selectedIds, "REGULATION_INTERPRETATION_BOUNDARY")
  addChunk(selectedIds, chooseRiskChunk(weakKeys.length))

  const primaryWeak = weakKeys[0]
  const primaryStrong = strongKeys[0]

  if (primaryWeak) {
    const weakChunk = `${primaryWeak.toUpperCase()}_REGULATION_RELATIVE_WEAKNESS`
      .replace("EXECUTIVE_REGULATION", "EXECUTIVE_FUNCTION")
      .replace("INTEROCEPTION_REGULATION", "INTEROCEPTION")
    addChunk(selectedIds, weakChunk)
  }

  if (primaryStrong) {
    const strongChunk = `${primaryStrong.toUpperCase()}_REGULATION_RELATIVE_STRENGTH`
      .replace("EXECUTIVE_REGULATION", "EXECUTIVE_FUNCTION")
      .replace("INTEROCEPTION_REGULATION", "INTEROCEPTION")
    addChunk(selectedIds, strongChunk)
    addChunk(selectedIds, "RISK_PROFILE_PROTECTIVE_FACTORS")
  }

  const weakSet = new Set(weakKeys)
  const extraContext = [
    ...(analysis.therapistInsights || []),
    ...(analysis.externalClinicalFindings || []),
  ]
    .join(" \n ")
    .toLowerCase()

  if (weakSet.has("sensory") && weakSet.has("emotional")) addChunk(selectedIds, "CROSS_SCALE_SENSORY_EMOTIONAL")
  if (weakSet.has("physiological") && weakSet.has("emotional")) addChunk(selectedIds, "CROSS_SCALE_PHYSIOLOGICAL_EMOTIONAL")
  if (weakSet.has("interoception") && weakSet.has("physiological")) addChunk(selectedIds, "CROSS_SCALE_INTEROCEPTION_PHYSIOLOGICAL")
  if (weakSet.has("interoception") && weakSet.has("emotional")) addChunk(selectedIds, "CROSS_SCALE_INTEROCEPTION_EMOTIONAL")
  if (weakSet.has("cognitive") && weakSet.has("executive")) addChunk(selectedIds, "CROSS_SCALE_COGNITIVE_EXECUTIVE")
  if (weakSet.has("emotional") && weakSet.has("executive")) addChunk(selectedIds, "CROSS_SCALE_EMOTIONAL_EXECUTIVE")
  if (weakKeys.length >= 3 || analysis.globalLevel === "Atipik") addChunk(selectedIds, "CROSS_SCALE_WIDESPREAD_PATTERN")
  if (primaryWeak && primaryStrong) addChunk(selectedIds, "CROSS_SCALE_ASYMMETRICAL_PROFILE")

  const matchedSet = new Set(matchedKeys)
  if (matchedSet.has("sensory")) addChunk(selectedIds, "ANAMNESIS_SENSORY_CONTEXT")
  if (matchedSet.has("emotional")) addChunk(selectedIds, "ANAMNESIS_EMOTIONAL_CONTEXT")
  if (matchedSet.has("cognitive") || matchedSet.has("executive")) addChunk(selectedIds, "ANAMNESIS_ATTENTION_AND_TASK_BEHAVIOR")
  if (matchedSet.has("physiological")) addChunk(selectedIds, "ANAMNESIS_SLEEP_AND_ROUTINE")
  if (matchedSet.has("interoception")) addChunk(selectedIds, "ANAMNESIS_INTEROCEPTIVE_CONTEXT")
  if (matchedKeys.some((key) => strongKeys.includes(key))) addChunk(selectedIds, "ANAMNESIS_CONTRADICTION_RULE")
  if (analysis.therapistInsights && analysis.therapistInsights.length > 0) {
    addChunk(selectedIds, "THERAPIST_OBSERVATION_CONTEXT")
  }
  if (/model alma|performans|baglam|bağlam|surdur|sürdür|sekans|dagil|dağıl/.test(extraContext)) {
    addChunk(selectedIds, "THERAPIST_PERFORMANCE_VARIABILITY")
  }
  if (/sipt|somatodispraks|somatodysprax|praksi|motor plan|mabc|beery vmi|gorsel-motor|görsel-motor/.test(extraContext)) {
    addChunk(selectedIds, "EXTERNAL_TEST_PRAXIS_MOTOR_PLANNING")
  }
  if (/brief|conners|basc|inhibisyon|calisma bellegi|çalışma belleği|dürt|durtu/.test(extraContext)) {
    addChunk(selectedIds, "EXTERNAL_TEST_EXECUTIVE_RATINGS")
  }
  if (/sensory profile|spm|duyusal işlem|duyusal islem|hassasiyet|arayis|arayış/.test(extraContext)) {
    addChunk(selectedIds, "EXTERNAL_TEST_SENSORY_PROCESSING")
  }
  if (/abas|vineland|pedi-cat|uyumsal|gunluk yasam|günlük yaşam|katilim|katılım/.test(extraContext)) {
    addChunk(selectedIds, "EXTERNAL_TEST_ADAPTIVE_FUNCTIONING")
  }
  if (/srs-?2|ccc-?2|sosyal iletisim|sosyal iletişim|pragmatik/.test(extraContext)) {
    addChunk(selectedIds, "EXTERNAL_TEST_SOCIAL_COMMUNICATION")
  }
  if (/celf|pls-?5|alici|ifade edici|ifade edici|yönerge|yonerge|dil/.test(extraContext)) {
    addChunk(selectedIds, "EXTERNAL_TEST_LANGUAGE_CONTEXT")
  }

  addChunk(selectedIds, "REPORT_FINAL_SUMMARY_TEMPLATE")

  const chunks = selectedIds
    .map(findChunk)
    .filter(Boolean)
    .slice(0, 8) as ProRagChunk[]

  return {
    chunks,
    grouped: buildGroups(chunks),
    ids: chunks.map((chunk) => chunk.id),
  }
}

export function estimateRagCoverage(
  reportText: string,
  selected: SelectedProRagContext
): {
  overall: number
  byGroup: Record<keyof RagGroups, number>
} {
  const sections = splitClinicalReportSections(reportText)
  const byGroup = {
    general: 0,
    domain: 0,
    pattern: 0,
    anamnesis: 0,
    summary: 0,
  } satisfies Record<keyof RagGroups, number>

  ;(Object.keys(SECTION_BY_GROUP) as Array<keyof RagGroups>).forEach((groupName) => {
    const headings = SECTION_BY_GROUP[groupName]
    const sectionText = sections
      .filter((section) => headings.includes(section.heading))
      .map((section) => section.body)
      .join("\n")

    byGroup[groupName] = estimateGroupCoverage(sectionText, selected.grouped[groupName])
  })

  const values = Object.values(byGroup)
  const overall = values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0

  return { overall, byGroup }
}
