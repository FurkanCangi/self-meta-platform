import type { ClinicalEvidenceMap, ClinicalMechanismType } from "./clinicalAnalysis"
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
  reason: "low_confidence" | "age_mismatch" | "raw_score_only" | "preserved_result" | "safety" | "redundant"
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
  validationIssues: string[]
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
          ? "age_mismatch"
          : match.resultQuality === "ham_puan_only"
          ? "raw_score_only"
          : match.resultDirection === "expected_or_preserved"
          ? "preserved_result"
          : "low_confidence"
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

function buildKnowledgeEvidence(wordRagChunkCoverage: string): ReportEvidenceSource {
  return createEvidenceSource({
    id: "evidence.knowledge_base.word_rag",
    kind: "knowledge_base",
    label: "Deterministic Knowledge Base",
    summary: `Word RAG içeriği runtime retrieval olmadan deterministic bilgi tabanı olarak kullanıldı (${wordRagChunkCoverage}).`,
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
    if (atom.confidence === "sınırlı" && /kesin|kanıtlar|gösterir$/i.test(atom.interpretation)) {
      issues.push(`${atom.id}: düşük güven için fazla kesin yorum dili`)
    }
  }

  for (const suppressed of trace.suppressedAtoms) {
    if (!suppressed.evidenceIds.length) issues.push(`${suppressed.id}: suppressed evidenceIds boş`)
    if (!suppressed.ruleIds.length) issues.push(`${suppressed.id}: suppressed ruleIds boş`)
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
    buildKnowledgeEvidence(params.wordRagChunkCoverage),
  ])
  const ruleHits = addUnique([
    buildMechanismRuleHit(params.evidenceMap),
    ...buildExternalRuleHits(params.externalTestAnalysis),
    ...buildMicroRuleHits(params.itemLevelAnalysis),
    createRuleHit({
      id: "rule.knowledge_base.word_rag_deterministic",
      description: "Word RAG bilgisi canlı retrieval olmadan deterministic knowledge base olarak kullanıldı.",
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
  ])
  const atoms = addUnique([
    buildMechanismAtom(params.evidenceMap),
    ...buildDataLimitationAtoms(params.evidenceMap),
    ...buildMicroAtoms(params.itemLevelAnalysis),
  ])
  const selectedAtoms = atoms.filter((atom) => atom.type !== "limitation" || params.evidenceMap.dataLimitations.length > 0)
  const suppressedAtoms = addUnique(buildExternalSuppressedAtoms(params.externalTestAnalysis))
  const traceBase = {
    active: true,
    evidenceSources,
    atoms,
    selectedAtoms,
    ruleHits,
    suppressedAtoms,
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
