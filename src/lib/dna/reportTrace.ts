import type { ClinicalEvidenceMap, ClinicalMechanismType } from "./clinicalAnalysis"
import type { ClinicalReasoningResult } from "./clinicalReasoning"
import { evaluateClaimGuard, type ClaimGuardIssue } from "./clinicalClaimRegistry"
import type { ExternalTestAnalysis, ExternalTestMatch } from "./externalTestRegistry"
import type { ItemLevelAnalysis, ItemSignal } from "./itemSignals"
import type { DomainResult, ReportInput } from "./reportEngine"

export type TraceEvidenceKind =
  | "score"
  | "anamnesis"
  | "therapist_observation"
  | "external_test"
  | "micro_evidence"
  | "knowledge_base"
  | "literature_registry"
  | "safety"

export type TraceConfidence = "yüksek" | "orta" | "sınırlı"

export type ReportEvidenceSource = {
  id: string
  kind: TraceEvidenceKind
  label: string
  summary: string
  sourceRef?: string
  confidence?: TraceConfidence
}

export type ReportAtom = {
  id: string
  type: "finding" | "interpretation" | "convergence" | "limitation" | "micro_evidence" | "safety"
  label: string
  finding: string
  interpretation: string
  rationale: string
  confidence: TraceConfidence
  priority: number
  sections: Array<"decision" | "evidence_profile" | "domain_comment" | "formulation" | "anamnesis_fit" | "prioritization" | "conclusion">
  evidenceIds: string[]
  ruleIds: string[]
  safetyTags?: string[]
}

export type ReportRuleHit = {
  id: string
  description: string
  ruleType: "mechanism" | "external_test" | "micro_evidence" | "knowledge_base" | "safety" | "confidence"
  outcome: "selected" | "limited" | "suppressed"
  evidenceIds: string[]
}

export type SuppressedAtom = {
  id: string
  reason:
    | "low_confidence"
    | "age_mismatch"
    | "raw_score_only"
    | "preserved_result"
    | "safety"
    | "redundant"
    | "weak_evidence"
    | "duplicate_claim"
    | "contradiction"
    | "age_invalid_external_test"
    | "preserved_capacity_limit"
    | "unsupported_specificity"
    | "claim_guard"
  summary: string
  evidenceIds: string[]
  ruleIds: string[]
}

export type ReportAuditTrail = {
  engineVersion: string
  templateVersion: string
  knowledgeBaseVersion: string
  wordRagChunkCoverage: string
  inputHash: string
  decisionTraceHash: string
  redundancyScore: number
  unsupportedSpecificityRate: number
  triggeredRuleIds: string[]
  selectedAtomIds: string[]
  suppressedAtomIds: string[]
}

export type ReportVersionMeta = {
  engineVersion: string
  templateVersion: string
  knowledgeBaseVersion: string
  traceSchemaVersion: string
}

export type ReportTrace = {
  active: boolean
  evidenceSources: ReportEvidenceSource[]
  atoms: ReportAtom[]
  selectedAtoms: ReportAtom[]
  ruleHits: ReportRuleHit[]
  suppressedAtoms: SuppressedAtom[]
  sentenceTraces: ReportSentenceTrace[]
  claimGuardIssues: ClaimGuardIssue[]
  qualityMetrics: {
    evidenceToSentenceCoverage: number
    unsupportedSpecificityRate: number
    redundancyScore: number
    externalEvidenceWeightTotal: number
  }
  reasoning?: {
    evidenceGraphSummary?: string
    mechanismScoreBreakdown?: ClinicalReasoningResult["mechanismScoreBreakdown"]
    confidenceSubscores?: ClinicalReasoningResult["confidenceSubscores"]
    counterEvidenceLines?: string[]
    preservedCapacityLines?: string[]
    contextMatrix?: ClinicalReasoningResult["contextMatrix"]
    calibrationNotes?: string[]
  }
  validationIssues: string[]
}

export type ReportSentenceTrace = {
  sentenceId: string
  section: "decision" | "evidence_profile" | "domain_comment" | "formulation" | "anamnesis_fit" | "prioritization" | "conclusion" | "unknown"
  textHash: string
  claimType: "mechanism" | "evidence" | "context" | "limitation" | "differential" | "conclusion" | "descriptive"
  evidenceAtomIds: string[]
  ruleIds: string[]
  confidence: TraceConfidence
  safetyTags: string[]
}

export const REPORT_ENGINE_VERSION = "dna-deterministic-report-engine@1.1.0"
export const REPORT_TEMPLATE_VERSION = "professor-clinical-report@1.0.0"
export const REPORT_TRACE_SCHEMA_VERSION = "report-trace@1.0.0"
export const REPORT_KNOWLEDGE_BASE_VERSION = "word-rag-deterministic-kb@1.0.0"

export function createEvidenceSource(source: ReportEvidenceSource): ReportEvidenceSource {
  return source
}

export function createReportAtom(atom: ReportAtom): ReportAtom {
  return atom
}

export function createRuleHit(ruleHit: ReportRuleHit): ReportRuleHit {
  return ruleHit
}

export function suppressAtom(suppressedAtom: SuppressedAtom): SuppressedAtom {
  return suppressedAtom
}

function stableHash(value: unknown): string {
  const text = stableStringify(value)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

function hashInput(input: ReportInput): string {
  return stableHash({
    clientCode: input.clientCode || "",
    ageMonths: input.ageMonths ?? null,
    scores: input.scores || {},
    answers: input.answers || null,
    anamnez: typeof input.anamnez === "string" ? input.anamnez : input.anamnez ? Object.keys(input.anamnez).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = (input.anamnez as Record<string, unknown>)[key]
      return acc
    }, {}) : null,
  })
}

function normalizeIdPart(value: string): string {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "unknown"
}

function confidenceFromEvidenceMap(evidenceMap: ClinicalEvidenceMap): TraceConfidence {
  return evidenceMap.confidenceLevel || "orta"
}

function mechanismRuleId(mechanism?: ClinicalMechanismType): string {
  return `rule.mechanism.${mechanism || "default"}`
}

function addUnique<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function externalEvidenceId(match: ExternalTestMatch): string {
  return `evidence.external_test.${match.id}`
}

function externalRuleId(match: ExternalTestMatch): string {
  return `rule.external_test.${match.id}`
}

function buildExternalEvidence(matches: ExternalTestMatch[]): ReportEvidenceSource[] {
  return matches.map((match) =>
    createEvidenceSource({
      id: externalEvidenceId(match),
      kind: "external_test",
      label: match.name,
      summary: [
        match.ageCompatible === true ? "yaş uyumlu" : match.ageCompatible === false ? "yaş uyumsuz" : "yaş yorumu sınırlı",
        `sonuç kalitesi: ${match.resultQuality || "unclear"}`,
        `sonuç yönü: ${match.resultDirection || "unclear"}`,
        `kanıt ağırlığı: ${match.externalEvidenceWeight}/${match.externalEvidenceWeightLabel}`,
      ].join("; "),
      sourceRef: match.id,
      confidence: match.ageCompatible === true && match.resultQuality === "interpretable" ? "orta" : "sınırlı",
    })
  )
}

function buildExternalRuleHits(analysis: ExternalTestAnalysis): ReportRuleHit[] {
  return analysis.matches.map((match) =>
    createRuleHit({
      id: externalRuleId(match),
      description:
        analysis.decisionCompatibleIds.includes(match.id)
          ? `${match.name} karar ağırlığına alınabilir dış test kanıtı olarak sınıflandı.`
          : `${match.name} ana karar ağırlığına sınırlı/dengeleyici dış test kanıtı olarak sınıflandı.`,
      ruleType: "external_test",
      outcome: analysis.decisionCompatibleIds.includes(match.id) ? "selected" : "limited",
      evidenceIds: [externalEvidenceId(match)],
    })
  )
}

function buildExternalSuppressedAtoms(analysis: ExternalTestAnalysis): SuppressedAtom[] {
  return analysis.matches
    .filter((match) => !analysis.decisionCompatibleIds.includes(match.id))
    .map((match) => {
      const reason =
        match.ageCompatible === false
          ? "age_invalid_external_test"
          : match.resultQuality === "ham_puan_only"
          ? "raw_score_only"
          : match.resultDirection === "expected_or_preserved"
          ? "preserved_capacity_limit"
          : "weak_evidence"
      return suppressAtom({
        id: `suppressed.external_test.${match.id}`,
        reason,
        summary: `${match.name} ana klinik mekanizmayı güçlendiren kanıt olarak kullanılmadı.`,
        evidenceIds: [externalEvidenceId(match)],
        ruleIds: [externalRuleId(match)],
      })
    })
}

function microEvidenceId(item: ItemSignal): string {
  return `evidence.micro.${item.cluster}`
}

function microRuleId(item: ItemSignal): string {
  return `rule.micro.${item.cluster}`
}

function buildMicroEvidence(itemLevelAnalysis?: ItemLevelAnalysis | null): ReportEvidenceSource[] {
  if (!itemLevelAnalysis) return []
  return itemLevelAnalysis.criticalItems.map((item) =>
    createEvidenceSource({
      id: microEvidenceId(item),
      kind: "micro_evidence",
      label: item.domainLabel,
      summary: `${item.cluster} kümesi ${item.answer}/5 yanıt eşiğiyle klinik mikro-kanıt olarak seçildi.`,
      sourceRef: item.cluster,
      confidence: item.matchedContext ? "orta" : "sınırlı",
    })
  )
}

function buildMicroAtoms(itemLevelAnalysis?: ItemLevelAnalysis | null): ReportAtom[] {
  if (!itemLevelAnalysis) return []
  return itemLevelAnalysis.criticalItems.map((item, index) =>
    createReportAtom({
      id: `atom.micro.${item.cluster}`,
      type: "micro_evidence",
      label: `${item.domainLabel} mikro-kanıtı`,
      finding: `${item.domainLabel} alanında ${item.cluster} örüntüsü seçildi.`,
      interpretation: itemLevelAnalysis.criticalLines[index] || itemLevelAnalysis.domainLines[item.domainKey]?.[0] || item.cluster,
      rationale: "Mikro-kanıt yalnız 1-2 puan ve klinik ağırlık eşiği geçtiğinde rapor bağlamına alınır.",
      confidence: item.matchedContext ? "orta" : "sınırlı",
      priority: item.selectionWeight,
      sections: ["domain_comment", "formulation", "anamnesis_fit"],
      evidenceIds: [microEvidenceId(item)],
      ruleIds: [microRuleId(item)],
      safetyTags: ["no_question_text", "no_question_number"],
    })
  )
}

function buildMicroRuleHits(itemLevelAnalysis?: ItemLevelAnalysis | null): ReportRuleHit[] {
  if (!itemLevelAnalysis) return []
  return itemLevelAnalysis.criticalItems.map((item) =>
    createRuleHit({
      id: microRuleId(item),
      description: `${item.cluster} mikro-kanıt kümesi eşik ve klinik ağırlık kuralını geçti.`,
      ruleType: "micro_evidence",
      outcome: "selected",
      evidenceIds: [microEvidenceId(item)],
    })
  )
}

function reasoningEvidenceId(atom: NonNullable<ClinicalEvidenceMap["evidenceAtoms"]>[number]): string {
  if (atom.sourceType === "score" && atom.domain) return `evidence.score.${atom.domain}`
  if (atom.sourceType === "external_test" && atom.id.startsWith("reason.external.")) {
    return `evidence.external_test.${atom.id.replace("reason.external.", "")}`
  }
  if (atom.sourceType === "micro_theme" && atom.id.startsWith("reason.micro.")) {
    return `evidence.micro.${atom.id.replace("reason.micro.", "")}`
  }
  return `evidence.reason.${atom.id.replace(/^reason\./, "")}`
}

function buildReasoningEvidence(evidenceMap: ClinicalEvidenceMap): ReportEvidenceSource[] {
  return (evidenceMap.evidenceAtoms || [])
    .filter(
      (atom) =>
        atom.sourceType === "anamnesis" ||
        atom.sourceType === "preserved_capacity" ||
        atom.sourceType === "observation" ||
        atom.sourceType === "micro_theme"
    )
    .map((atom) =>
      createEvidenceSource({
        id: reasoningEvidenceId(atom),
        kind:
          atom.sourceType === "observation"
            ? "therapist_observation"
            : atom.sourceType === "micro_theme"
            ? "micro_evidence"
            : atom.sourceType === "preserved_capacity"
            ? "anamnesis"
            : "anamnesis",
        label: atom.sourceType === "preserved_capacity" ? "Korunmuş kapasite" : "Anamnez/gözlem sinyali",
        summary: atom.summary,
        sourceRef: atom.traceId || atom.id,
        confidence: atom.reliability >= 3 ? "yüksek" : atom.reliability >= 2 ? "orta" : "sınırlı",
      })
    )
}

function buildKnowledgeEvidence(wordRagChunkCoverage: string): ReportEvidenceSource {
  return createEvidenceSource({
    id: "evidence.knowledge_base.word_rag",
    kind: "knowledge_base",
    label: "Yerel Klinik Bilgi Tabanı",
    summary: `Yerel Word klinik içeriği çalışma zamanı dış servis çağrısı olmadan deterministik bilgi tabanı olarak kullanıldı (${wordRagChunkCoverage}).`,
    sourceRef: wordRagChunkCoverage,
    confidence: "orta",
  })
}

function buildMechanismEvidence(evidenceMap: ClinicalEvidenceMap): ReportEvidenceSource {
  return createEvidenceSource({
    id: "evidence.mechanism.primary",
    kind: "score",
    label: evidenceMap.primaryAxis,
    summary: evidenceMap.primaryClinicalHypothesis,
    sourceRef: evidenceMap.clinicalMechanism || "default",
    confidence: confidenceFromEvidenceMap(evidenceMap),
  })
}

function buildMechanismAtom(evidenceMap: ClinicalEvidenceMap): ReportAtom {
  const ruleId = mechanismRuleId(evidenceMap.clinicalMechanism)
  return createReportAtom({
    id: `atom.mechanism.${evidenceMap.clinicalMechanism || "default"}`,
    type: "interpretation",
    label: evidenceMap.primaryAxis,
    finding: evidenceMap.primaryClinicalHypothesis,
    interpretation: evidenceMap.mechanismSummary || evidenceMap.primaryClinicalHypothesis,
    rationale: evidenceMap.confidenceRationale,
    confidence: confidenceFromEvidenceMap(evidenceMap),
    priority: evidenceMap.primaryAxisKind === "mechanism" ? 95 : evidenceMap.primaryAxisKind === "balanced" ? 70 : 82,
    sections: ["decision", "formulation", "prioritization", "conclusion"],
    evidenceIds: ["evidence.mechanism.primary"],
    ruleIds: [ruleId],
    safetyTags: ["no_diagnosis", "no_treatment_prescription", "no_causal_certainty"],
  })
}

function buildMechanismRuleHit(evidenceMap: ClinicalEvidenceMap): ReportRuleHit {
  return createRuleHit({
    id: mechanismRuleId(evidenceMap.clinicalMechanism),
    description: `${evidenceMap.clinicalMechanism || "default"} klinik mekanizması seçildi.`,
    ruleType: "mechanism",
    outcome: evidenceMap.clinicalMechanism === "evidence_limited_mixed" ? "limited" : "selected",
    evidenceIds: ["evidence.mechanism.primary"],
  })
}

function buildDataLimitationAtoms(evidenceMap: ClinicalEvidenceMap): ReportAtom[] {
  return evidenceMap.dataLimitations.slice(0, 3).map((limitation, index) =>
    createReportAtom({
      id: `atom.limitation.${index + 1}`,
      type: "limitation",
      label: "Veri sınırlılığı",
      finding: limitation,
      interpretation: limitation,
      rationale: "Veri sınırlılıkları klinik kesinliği artırmamak ve karar dilini temkinli tutmak için izlenir.",
      confidence: "sınırlı",
      priority: 35 - index,
      sections: ["anamnesis_fit", "prioritization"],
      evidenceIds: ["evidence.mechanism.primary"],
      ruleIds: ["rule.confidence.data_limitations"],
      safetyTags: ["uncertainty_required"],
    })
  )
}

function sentenceSectionFromHeading(heading: string): ReportSentenceTrace["section"] {
  if (/klinik karar/i.test(heading)) return "decision"
  if (/kanıt profili/i.test(heading)) return "evidence_profile"
  if (/alan bazlı/i.test(heading)) return "domain_comment"
  if (/formülasyon|örüntü/i.test(heading)) return "formulation"
  if (/anamnez/i.test(heading)) return "anamnesis_fit"
  if (/önceliklendirme/i.test(heading)) return "prioritization"
  if (/sonuç/i.test(heading)) return "conclusion"
  return "unknown"
}

function splitReportIntoSectionSentences(text: string): Array<{ section: ReportSentenceTrace["section"]; sentence: string }> {
  const lines = String(text || "").split(/\n+/)
  let currentSection: ReportSentenceTrace["section"] = "unknown"
  const rows: Array<{ section: ReportSentenceTrace["section"]; sentence: string }> = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^\d+\.\s+/.test(trimmed)) {
      currentSection = sentenceSectionFromHeading(trimmed)
      continue
    }
    if (!["decision", "formulation", "prioritization", "conclusion"].includes(currentSection)) continue
    for (const sentence of trimmed.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean)) {
      if (/(klinik|karar|formülasyon|mekanizma|kanıt|bağlam|yük|profil|örüntü|sınır|güven|sonuç|korunmuş|karşı-kanıt|ayırıcı)/i.test(sentence)) {
        rows.push({ section: currentSection, sentence })
      }
    }
  }
  return rows
}

function claimTypeFromSentence(sentence: string): ReportSentenceTrace["claimType"] {
  if (/ayırıcı|yalnız|tek bir yüzeysel/i.test(sentence)) return "differential"
  if (/karşı-kanıt|sınırl|temkin|güven|korunmuş|sınır/i.test(sentence)) return "limitation"
  if (/bağlam|grup|sözel|motor|beden|günlük|sosyal-pragmatik/i.test(sentence)) return "context"
  if (/kanıt|test|anamnez|gözlem/i.test(sentence)) return "evidence"
  if (/sonuç/i.test(sentence)) return "conclusion"
  if (/mekanizma|klinik karar|formülasyon/i.test(sentence)) return "mechanism"
  return "descriptive"
}

const SPECIFICITY_PATTERNS: Array<{ tag: NonNullable<ClinicalReasoningResult["contextMatrix"]>[number]["tag"]; pattern: RegExp }> = [
  { tag: "group_crowd", pattern: /\b(?:grup|kalabalık|kalabalik|akran)\b/i },
  { tag: "verbal_load", pattern: /\b(?:sözel|sozel|yönerge|yonerge|dilsel)\b/i },
  { tag: "motor_task_load", pattern: /\b(?:motor görev|motor planlama|praksi|beden organizasyonu)\b/i },
  { tag: "body_signal_fatigue", pattern: /\b(?:beden sinyali|yorgunluk|bedensel toparlanma|fizyolojik toparlanma)\b/i },
  { tag: "daily_routine", pattern: /\b(?:günlük rutin|gunluk rutin|öz bakım|oz bakim|rutin başlatma|rutini sürdürme)\b/i },
  { tag: "social_pragmatic_demand", pattern: /\b(?:sosyal-pragmatik|karşılıklılık|karsiliklilik|pragmatik)\b/i },
]

type ContextTag = NonNullable<ClinicalReasoningResult["contextMatrix"]>[number]["tag"]

const MECHANISM_CONTEXT_SUPPORT: Record<ClinicalMechanismType, ContextTag[]> = {
  motor_praxis: ["motor_task_load"],
  adaptive_daily_living: ["daily_routine", "body_signal_fatigue"],
  social_pragmatic: ["social_pragmatic_demand", "group_crowd"],
  language_communication: ["verbal_load"],
  language_social_pragmatic: ["verbal_load", "social_pragmatic_demand", "group_crowd"],
  physiological_interoceptive: ["body_signal_fatigue", "daily_routine"],
  selective_interoception: ["body_signal_fatigue"],
  evidence_limited_mixed: [],
  default: [],
}

function hasStrongContextAssertion(sentence: string): boolean {
  return /\b(?:bağlamında|kosulda|koşulda|koşullarda|talep arttığında|yük arttığında|yükü arttığında|belirginleştiğinde|zorlanmaktadır|zorlandığı|zorlanır|etkilendiğini)\b/i.test(sentence)
}

function unsupportedSpecificitySuppression(
  sentenceTrace: ReportSentenceTrace,
  sentence: string,
  evidenceMap: ClinicalEvidenceMap
): SuppressedAtom | null {
  if (sentenceTrace.claimType !== "context") return null
  if (!hasStrongContextAssertion(sentence)) return null
  if (/izlem aralığı|genel zeka|öğrenme kapasitesi hükmü değildir/i.test(sentence)) return null
  const mechanismTags = evidenceMap.clinicalMechanism ? MECHANISM_CONTEXT_SUPPORT[evidenceMap.clinicalMechanism] || [] : []
  const stronglySupportedTags = new Set(
    (evidenceMap.contextMatrix || [])
      .filter((entry) => entry.independentEvidenceSources >= 2 || entry.evidenceCount >= 2)
      .map((entry) => entry.tag)
  )
  const supportedTags = new Set([...stronglySupportedTags, ...mechanismTags])
  const unsupported = SPECIFICITY_PATTERNS.find((item) => item.pattern.test(sentence) && !supportedTags.has(item.tag))
  if (!unsupported) return null
  return suppressAtom({
    id: `suppressed.unsupported_specificity.${sentenceTrace.sentenceId}`,
    reason: "unsupported_specificity",
    summary: `Cümledeki özgül bağlam iddiası context matrix tarafından yeterince desteklenmedi: ${unsupported.tag}`,
    evidenceIds: sentenceTrace.evidenceAtomIds,
    ruleIds: [...sentenceTrace.ruleIds, "rule.specificity.context_support"],
  })
}

function contextTagsInSentence(sentence: string): ContextTag[] {
  return SPECIFICITY_PATTERNS.filter((item) => item.pattern.test(sentence)).map((item) => item.tag)
}

function evidenceIdsForSentence(
  sentence: string,
  claimType: ReportSentenceTrace["claimType"],
  evidenceMap: ClinicalEvidenceMap
): string[] {
  const atoms = evidenceMap.evidenceAtoms || []
  const selected: string[] = ["evidence.mechanism.primary"]
  const sentenceTags = contextTagsInSentence(sentence)
  const addAtoms = (predicate: (atom: NonNullable<ClinicalEvidenceMap["evidenceAtoms"]>[number]) => boolean) => {
    for (const atom of atoms.filter(predicate)) selected.push(reasoningEvidenceId(atom))
  }

  if (/skor|puan|alan|bant|profil/i.test(sentence)) addAtoms((atom) => atom.sourceType === "score")
  if (/test|bulgu|sonuç|dış veri|BRIEF|ABAS|Vineland|PEDI|PDMS|BOT|SRS|CELF|PLS|CCC|SPM|Sensory/i.test(sentence)) {
    addAtoms((atom) => atom.sourceType === "external_test")
  }
  if (/anamnez|aile|evde|bakımveren|bilgiye göre/i.test(sentence)) addAtoms((atom) => atom.sourceType === "anamnesis")
  if (/gözlem|terapist/i.test(sentence)) addAtoms((atom) => atom.sourceType === "observation" || atom.sourceType === "anamnesis")
  if (/mikro|işitsel|dokunsal|oral|uyaran/i.test(sentence)) addAtoms((atom) => atom.sourceType === "micro_theme")
  if (claimType === "limitation" || /korunmuş|karşı-kanıt|sınırl|temkin/i.test(sentence)) {
    addAtoms((atom) => atom.direction === "limits" || atom.direction === "contradicts" || atom.sourceType === "preserved_capacity")
  }
  if (claimType === "context" || sentenceTags.length) {
    addAtoms((atom) => sentenceTags.some((tag) => atom.contextTags.includes(tag)))
  }
  if (claimType === "differential") {
    addAtoms((atom) => atom.candidateMechanism === evidenceMap.clinicalMechanism && atom.direction !== "neutral")
  }
  if (selected.length === 1 && claimType !== "descriptive") {
    const mechanismAtoms = atoms
      .filter((atom) => atom.candidateMechanism === evidenceMap.clinicalMechanism && atom.direction !== "neutral")
      .sort((a, b) => b.strength + b.reliability + b.specificity - (a.strength + a.reliability + a.specificity))
      .slice(0, 4)
    for (const atom of mechanismAtoms) selected.push(reasoningEvidenceId(atom))
  }

  return Array.from(new Set(selected)).slice(0, 8)
}

function normalizedSentenceClaim(sentence: string): string {
  return sentence
    .toLocaleLowerCase("tr-TR")
    .replace(/\d+\/\d+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(?:bu|vaka|rapor|klinik|olarak|mevcut|veriler|sonuç|karar|cümlesi)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 18)
    .join(" ")
}

function calculateRedundancyScore(rows: Array<{ sentence: string }>): number {
  if (rows.length <= 1) return 0
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = normalizedSentenceClaim(row.sentence)
    if (key.length < 48) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const duplicateCount = Array.from(counts.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0)
  return Math.round((duplicateCount / rows.length) * 100)
}

function buildSentenceTraces(params: {
  finalReportText: string
  evidenceMap: ClinicalEvidenceMap
}): {
  sentenceTraces: ReportSentenceTrace[]
  suppressedAtoms: SuppressedAtom[]
  claimGuardIssues: ClaimGuardIssue[]
  redundancyScore: number
  unsupportedSpecificityRate: number
} {
  const rows = splitReportIntoSectionSentences(params.finalReportText)
  const mechanismRule = mechanismRuleId(params.evidenceMap.clinicalMechanism)
  const differentialRuleIds = params.evidenceMap.differentialFormulation?.ruleIds || []
  const narrativeRuleIds = params.evidenceMap.compiledNarrative?.ruleIds || []
  const sentenceTraces = rows.map((row, index) => {
    const claimType = claimTypeFromSentence(row.sentence)
    const ruleIds = Array.from(
      new Set([
        mechanismRule,
        "rule.claim_registry.intended_use",
        ...narrativeRuleIds,
        ...(claimType === "differential" ? differentialRuleIds : []),
      ])
    )
    return {
      sentenceId: `sentence.${String(index + 1).padStart(3, "0")}`,
      section: row.section,
      textHash: stableHash(row.sentence),
      claimType,
      evidenceAtomIds: evidenceIdsForSentence(row.sentence, claimType, params.evidenceMap),
      ruleIds,
      confidence: confidenceFromEvidenceMap(params.evidenceMap),
      safetyTags: ["no_diagnosis", "no_treatment_prescription", "no_causal_certainty"],
    } satisfies ReportSentenceTrace
  })
  const specificitySuppressions = sentenceTraces
    .map((trace, index) => unsupportedSpecificitySuppression(trace, rows[index]?.sentence || "", params.evidenceMap))
    .filter(Boolean) as SuppressedAtom[]
  const redundancyScore = calculateRedundancyScore(rows)
  const unsupportedSpecificityRate = sentenceTraces.length
    ? Math.round((specificitySuppressions.length / sentenceTraces.length) * 100)
    : 0
  return {
    sentenceTraces,
    suppressedAtoms: specificitySuppressions,
    claimGuardIssues: evaluateClaimGuard(params.finalReportText),
    redundancyScore,
    unsupportedSpecificityRate,
  }
}

function validateReportTrace(trace: Omit<ReportTrace, "validationIssues">): string[] {
  const evidenceIds = new Set(trace.evidenceSources.map((source) => source.id))
  const ruleIds = new Set(trace.ruleHits.map((rule) => rule.id))
  const issues: string[] = []

  for (const atom of trace.atoms) {
    if (!atom.evidenceIds.length) issues.push(`${atom.id}: evidenceIds boş`)
    if (!atom.ruleIds.length) issues.push(`${atom.id}: ruleIds boş`)
    for (const evidenceId of atom.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) issues.push(`${atom.id}: bilinmeyen evidenceId ${evidenceId}`)
    }
    for (const ruleId of atom.ruleIds) {
      if (!ruleIds.has(ruleId)) issues.push(`${atom.id}: bilinmeyen ruleId ${ruleId}`)
    }
    if (atom.confidence === "sınırlı" && /kesin olarak|kesin neden|tek başına gösterir|açıkça gösterir|kanıtlamaktadır|kanıtlanmıştır/i.test(atom.interpretation)) {
      issues.push(`${atom.id}: düşük güven için fazla kesin yorum dili`)
    }
  }

  for (const suppressed of trace.suppressedAtoms) {
    if (!suppressed.evidenceIds.length) issues.push(`${suppressed.id}: suppressed evidenceIds boş`)
    if (!suppressed.ruleIds.length) issues.push(`${suppressed.id}: suppressed ruleIds boş`)
  }
  if (!trace.sentenceTraces.length) {
    issues.push("sentence_trace: ana klinik cümle trace coverage eksik")
  }
  for (const sentence of trace.sentenceTraces) {
    if (!sentence.evidenceAtomIds.length) issues.push(`${sentence.sentenceId}: sentence evidenceAtomIds boş`)
    if (!sentence.ruleIds.length) issues.push(`${sentence.sentenceId}: sentence ruleIds boş`)
    if (!sentence.safetyTags.length) issues.push(`${sentence.sentenceId}: sentence safetyTags boş`)
    for (const evidenceId of sentence.evidenceAtomIds) {
      if (!evidenceIds.has(evidenceId)) issues.push(`${sentence.sentenceId}: bilinmeyen sentence evidenceId ${evidenceId}`)
    }
  }
  for (const issue of trace.claimGuardIssues) {
    if (issue.severity === "critical") issues.push(`claim_guard: ${issue.code}`)
  }

  return issues
}

export function buildReportAuditTrail(params: {
  input: ReportInput
  trace: Omit<ReportTrace, "validationIssues"> & { validationIssues?: string[] }
  wordRagChunkCoverage: string
}): ReportAuditTrail {
  return {
    engineVersion: REPORT_ENGINE_VERSION,
    templateVersion: REPORT_TEMPLATE_VERSION,
    knowledgeBaseVersion: REPORT_KNOWLEDGE_BASE_VERSION,
    wordRagChunkCoverage: params.wordRagChunkCoverage,
    inputHash: hashInput(params.input),
    decisionTraceHash: stableHash({
      mechanism: params.trace.ruleHits.find((rule) => rule.ruleType === "mechanism")?.id || "",
      selectedAtomIds: params.trace.selectedAtoms.map((atom) => atom.id),
      suppressedAtomIds: params.trace.suppressedAtoms.map((atom) => atom.id),
      qualityMetrics: params.trace.qualityMetrics,
      sentenceClaims: params.trace.sentenceTraces.map((sentence) => ({
        id: sentence.sentenceId,
        claimType: sentence.claimType,
        confidence: sentence.confidence,
        textHash: sentence.textHash,
      })),
      reasoning: params.trace.reasoning,
    }),
    redundancyScore: params.trace.qualityMetrics.redundancyScore,
    unsupportedSpecificityRate: params.trace.qualityMetrics.unsupportedSpecificityRate,
    triggeredRuleIds: params.trace.ruleHits.map((rule) => rule.id),
    selectedAtomIds: params.trace.selectedAtoms.map((atom) => atom.id),
    suppressedAtomIds: params.trace.suppressedAtoms.map((atom) => atom.id),
  }
}

export function buildReportVersionMeta(): ReportVersionMeta {
  return {
    engineVersion: REPORT_ENGINE_VERSION,
    templateVersion: REPORT_TEMPLATE_VERSION,
    knowledgeBaseVersion: REPORT_KNOWLEDGE_BASE_VERSION,
    traceSchemaVersion: REPORT_TRACE_SCHEMA_VERSION,
  }
}

export function buildReportTrace(params: {
  input: ReportInput
  domainResults: DomainResult[]
  evidenceMap: ClinicalEvidenceMap
  externalTestAnalysis: ExternalTestAnalysis
  itemLevelAnalysis?: ItemLevelAnalysis | null
  wordRagChunkCoverage: string
  finalReportText: string
}): { trace: ReportTrace; auditTrail: ReportAuditTrail; reportVersionMeta: ReportVersionMeta } {
  const scoreEvidence = params.domainResults.map((domain) =>
    createEvidenceSource({
      id: `evidence.score.${domain.key}`,
      kind: "score",
      label: domain.label,
      summary: `${domain.score}/50, ${domain.level}`,
      sourceRef: domain.key,
      confidence: "orta",
    })
  )
  const externalEvidence = buildExternalEvidence(params.externalTestAnalysis.matches)
  const microEvidence = buildMicroEvidence(params.itemLevelAnalysis)
  const evidenceSources = addUnique([
    buildMechanismEvidence(params.evidenceMap),
    ...scoreEvidence,
    ...externalEvidence,
    ...microEvidence,
    ...buildReasoningEvidence(params.evidenceMap),
    buildKnowledgeEvidence(params.wordRagChunkCoverage),
  ])
  const ruleHits = addUnique([
    buildMechanismRuleHit(params.evidenceMap),
    ...buildExternalRuleHits(params.externalTestAnalysis),
    ...buildMicroRuleHits(params.itemLevelAnalysis),
    createRuleHit({
      id: "rule.knowledge_base.word_rag_deterministic",
      description: "Yerel Word klinik bilgisi canlı dış servis çağrısı olmadan deterministik bilgi tabanı olarak kullanıldı.",
      ruleType: "knowledge_base",
      outcome: "selected",
      evidenceIds: ["evidence.knowledge_base.word_rag"],
    }),
    createRuleHit({
      id: "rule.confidence.data_limitations",
      description: "Veri sınırlılıkları karar dilini temkinli tutmak için izlendi.",
      ruleType: "confidence",
      outcome: params.evidenceMap.dataLimitations.length ? "limited" : "selected",
      evidenceIds: ["evidence.mechanism.primary"],
    }),
    createRuleHit({
      id: "rule.claim_registry.intended_use",
      description: "Görünür rapor izinli iddia sınırı ve intended-use guard ile denetlendi.",
      ruleType: "safety",
      outcome: "selected",
      evidenceIds: ["evidence.mechanism.primary"],
    }),
    ...(params.evidenceMap.compiledNarrative?.ruleIds || []).map((ruleId) =>
      createRuleHit({
        id: ruleId,
        description: "Narrative compiler karar/formülasyon cümle mimarisini seçti.",
        ruleType: ruleId.includes("differential") ? "confidence" : "mechanism",
        outcome: "selected",
        evidenceIds: ["evidence.mechanism.primary"],
      })
    ),
  ])
  const atoms = addUnique([
    buildMechanismAtom(params.evidenceMap),
    ...buildDataLimitationAtoms(params.evidenceMap),
    ...buildMicroAtoms(params.itemLevelAnalysis),
  ])
  const selectedAtoms = atoms.filter((atom) => atom.type !== "limitation" || params.evidenceMap.dataLimitations.length > 0)
  const sentenceTraceResult = buildSentenceTraces({
    finalReportText: params.finalReportText,
    evidenceMap: params.evidenceMap,
  })
  const suppressedAtoms = addUnique([
    ...buildExternalSuppressedAtoms(params.externalTestAnalysis),
    ...sentenceTraceResult.suppressedAtoms,
    ...sentenceTraceResult.claimGuardIssues.map((issue, index) =>
      suppressAtom({
        id: `suppressed.claim_guard.${index + 1}`,
        reason: "claim_guard",
        summary: `${issue.code}: ${issue.message}`,
        evidenceIds: ["evidence.mechanism.primary"],
        ruleIds: ["rule.claim_registry.intended_use"],
      })
    ),
  ])
  const traceBase = {
    active: true,
    evidenceSources,
    atoms,
    selectedAtoms,
    ruleHits,
    suppressedAtoms,
    sentenceTraces: sentenceTraceResult.sentenceTraces,
    claimGuardIssues: sentenceTraceResult.claimGuardIssues,
    qualityMetrics: {
      evidenceToSentenceCoverage: sentenceTraceResult.sentenceTraces.length
        ? Math.round(
            (sentenceTraceResult.sentenceTraces.filter((sentence) => sentence.evidenceAtomIds.length > 0).length /
              sentenceTraceResult.sentenceTraces.length) *
              100
          )
        : 0,
      unsupportedSpecificityRate: sentenceTraceResult.unsupportedSpecificityRate,
      redundancyScore: sentenceTraceResult.redundancyScore,
      externalEvidenceWeightTotal: params.externalTestAnalysis.weightedDecisionSupport,
    },
    reasoning: {
      evidenceGraphSummary: params.evidenceMap.evidenceGraphSummary,
      mechanismScoreBreakdown: params.evidenceMap.mechanismScoreBreakdown,
      confidenceSubscores: params.evidenceMap.confidenceSubscores,
      counterEvidenceLines: params.evidenceMap.counterEvidenceLines,
      preservedCapacityLines: params.evidenceMap.preservedCapacityLines,
      contextMatrix: params.evidenceMap.contextMatrix,
      calibrationNotes: params.evidenceMap.calibrationNotes,
    },
  }
  const validationIssues = validateReportTrace(traceBase)
  const trace: ReportTrace = { ...traceBase, validationIssues }
  const auditTrail = buildReportAuditTrail({
    input: params.input,
    trace,
    wordRagChunkCoverage: params.wordRagChunkCoverage,
  })

  return {
    trace,
    auditTrail,
    reportVersionMeta: buildReportVersionMeta(),
  }
}
