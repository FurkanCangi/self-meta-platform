import { createHash } from "node:crypto"
import denseRuntimeJson from "../chat/catalog/generated/dense/runtime.json"
import { CLINICAL_KNOWLEDGE_CHUNKS } from "../clinicalKnowledgeBase"
import type { DomainKey, DomainResult } from "../reportEngine"
import type {
  ClinicalDecisionPlan,
  ClinicalEvidenceMatrix,
  FormulationId,
  ReportKnowledgeAuditRecord,
  ReportKnowledgeAuditSummary,
  ReportKnowledgeBridgeSelection,
  ReportKnowledgeEligibility,
  ReportKnowledgeRelevanceDecision,
  ReportKnowledgeRole,
  SelectedReportKnowledgeAtom,
} from "./contracts"

type DenseKnowledgeUnit = Readonly<{
  id: string
  claimId: string
  passageId: string
  sourceId: string
  sentenceSha256: string
  text: string
  title: string
  topicId: string
  domain: string
  dimensions: readonly string[]
}>

type DenseKnowledgeRuntime = Readonly<{
  schemaVersion: string
  pipelineVersion: string
  counts: Readonly<{ ownerUnits: number }>
  source: Readonly<{ id: string; sha256: string; citationStatus: string; scientificValidationStatus: string }>
  units: readonly DenseKnowledgeUnit[]
}>

const DENSE_RUNTIME = denseRuntimeJson as DenseKnowledgeRuntime
const OWNER_BOOK_SOURCE_ID = "book.self-regulation.owner-current"
const STOP_WORDS = new Set(["acaba", "ancak", "bile", "bir", "bunu", "bu", "çok", "daha", "da", "de", "gibi", "hem", "her", "ile", "için", "ise", "mi", "mu", "ne", "olarak", "olan", "olduğu", "ve", "veya", "ya"])
const REFERENTIAL_START = /^(?:bu|buna|bunun|bununla|böylece|burada|aynı zamanda|ayrıca|ancak|öte yandan|dolayısıyla|sonuç olarak)\b/i
const NON_SELF_CONTAINED = /(?:yukarıda|aşağıda|bu bölümde|bu kitapta|ilerleyen bölüm|şekil\s*\d+|tablo\s*\d+|bkz\.?)/i
const DIRECTIVE_OR_TREATMENT = /(?:tedavi edil|ilaç|doz|uygulanmalıdır|önerilmelidir|reçete|terapi protokol)/i
const ABSOLUTE_CAUSAL = /(?:kesin olarak|doğrudan neden olur|kaçınılmaz olarak|mutlaka yol açar)/i
const APPARENT_CASE_REFERENCE = /\bbu (?:vaka|olgu|danışan|çocuk)\b/i
const BIOLOGICAL_DETAIL_DOMAINS = new Set(["autonomic_hrv", "cellular_neurophysiology", "cns_networks"])
const HIGH_THEORETICAL_EXPANSION = /(?:prenatal|doğum öncesi|plasent|inflamatu|inflamasyon|allostaz|allostatik|genel nörogelişim|geniş nörogelişim|fizyolojik mekanizma|hücresel|mitokondri|nörotransmitter|vagal|kortizol)/iu

const ROLE_VALUES: readonly ReportKnowledgeRole[] = Object.freeze([
  "DOMAIN_INTERPRETATION",
  "CORE_DEFINITION",
  "FUNCTIONAL_MEANING",
  "FORMULATION_CONTEXT",
  "BOUNDARY",
  "LIMITATION",
  "RELATION",
  "GENERAL_SCIENTIFIC_CONTEXT",
])

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function normalizedTokens(text: string): Set<string> {
  return new Set(text.toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9çğıöşü]+/gu, " ")
    .split(/\s+/u)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)))
}

const REPORT_RAG_TOKEN_SETS = CLINICAL_KNOWLEDGE_CHUNKS.map((chunk) => Object.freeze({ id: chunk.id, tokens: normalizedTokens(chunk.text) }))

function containment(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (!left.size || !right.size) return 0
  let intersection = 0
  for (const token of left) if (right.has(token)) intersection += 1
  return intersection / Math.min(left.size, right.size)
}

function reportRagOverlapIds(text: string): string[] {
  const atomTokens = normalizedTokens(text)
  return REPORT_RAG_TOKEN_SETS
    .filter((chunk) => containment(atomTokens, chunk.tokens) >= 0.35)
    .map((chunk) => chunk.id)
}

function reportDomain(unit: DenseKnowledgeUnit): DomainKey | null {
  const text = unit.text.toLocaleLowerCase("tr-TR")
  if (unit.domain === "emotion_self_coregulation") return "emotional"
  if (unit.domain === "sleep_circadian") return "physiological"
  if (unit.domain === "stress_arousal_recovery") return /duygu|engellen|sakinleş|toparlanma süresi/u.test(text) ? "emotional" : "physiological"
  if (unit.domain === "interoception_sensory") return /interosep|beden sinyal|açlık|susuzluk|tuvalet|içsel/u.test(text) ? "interoception" : "sensory"
  if (unit.domain === "attention_working_memory_executive") return /başlat|durdur|esneklik|planla|sıra|yürütücü|inhib/u.test(text) ? "executive" : "cognitive"
  return null
}

function rolesFor(unit: DenseKnowledgeUnit, domain: DomainKey | null): ReportKnowledgeRole[] {
  const dimensions = new Set(unit.dimensions)
  const roles: ReportKnowledgeRole[] = []
  if (domain) roles.push("DOMAIN_INTERPRETATION")
  if (dimensions.has("misconception_boundary")) roles.push("BOUNDARY")
  if (dimensions.has("measurement")) roles.push("LIMITATION")
  if (dimensions.has("definition")) roles.push("CORE_DEFINITION")
  if (dimensions.has("daily_function")) roles.push("FUNCTIONAL_MEANING")
  if (dimensions.has("relation") || dimensions.has("comparison")) roles.push("RELATION")
  if (dimensions.has("process") || dimensions.has("theory")) roles.push("FORMULATION_CONTEXT")
  if (dimensions.has("development")) roles.push("GENERAL_SCIENTIFIC_CONTEXT")
  return unique(roles)
}

function auditUnit(unit: DenseKnowledgeUnit): ReportKnowledgeAuditRecord {
  const domain = reportDomain(unit)
  const roles = rolesFor(unit, domain)
  const reasons: string[] = []
  const provenanceComplete = Boolean(unit.id && unit.claimId && unit.passageId && unit.sourceId === OWNER_BOOK_SOURCE_ID && /^[a-f0-9]{64}$/u.test(unit.sentenceSha256))
  const selfContained = unit.text.length >= 55
    && unit.text.length <= 420
    && /[.!?)]$/u.test(unit.text.trim())
    && !REFERENTIAL_START.test(unit.text.trim())
    && !NON_SELF_CONTAINED.test(unit.text)
  const reportSafe = !BIOLOGICAL_DETAIL_DOMAINS.has(unit.domain)
    && !DIRECTIVE_OR_TREATMENT.test(unit.text)
    && !ABSOLUTE_CAUSAL.test(unit.text)
    && !APPARENT_CASE_REFERENCE.test(unit.text)
  if (!provenanceComplete) reasons.push("PROVENANCE_INCOMPLETE")
  if (!roles.length) reasons.push("NO_REPORT_ROLE")
  if (!selfContained) reasons.push("NOT_SELF_CONTAINED")
  if (!reportSafe) reasons.push("REPORT_CONTEXT_UNSAFE")
  let status: ReportKnowledgeEligibility
  if (!provenanceComplete || !roles.length || !reportSafe) status = "NOT_REPORT_ELIGIBLE"
  else if (!selfContained) status = "NEEDS_REVIEW"
  else status = "REPORT_ELIGIBLE"
  if (status === "REPORT_ELIGIBLE") reasons.push("SELF_CONTAINED_SOURCE_BOUND_REPORT_SAFE")
  const overlapIds = reportRagOverlapIds(unit.text)
  return Object.freeze({
    atomId: unit.id,
    status,
    roles: Object.freeze(roles),
    reportDomain: domain,
    authority: "OWNER_BOOK",
    sourceId: unit.sourceId,
    passageId: unit.passageId,
    textSha256: unit.sentenceSha256,
    reasons: Object.freeze(reasons),
    reportRagOverlapChunkIds: Object.freeze(overlapIds),
  })
}

let cachedAudit: Readonly<{ summary: ReportKnowledgeAuditSummary; records: readonly ReportKnowledgeAuditRecord[] }> | null = null

export function auditReportKnowledgeCore(): Readonly<{ summary: ReportKnowledgeAuditSummary; records: readonly ReportKnowledgeAuditRecord[] }> {
  if (cachedAudit) return cachedAudit
  const records = Object.freeze(DENSE_RUNTIME.units.map(auditUnit))
  const countStatus = (status: ReportKnowledgeEligibility) => records.filter((record) => record.status === status).length
  const statusCounts = Object.freeze(Object.fromEntries(["REPORT_ELIGIBLE", "NOT_REPORT_ELIGIBLE", "NEEDS_REVIEW"].map((status) => [status, countStatus(status as ReportKnowledgeEligibility)])) as Record<ReportKnowledgeEligibility, number>)
  const roleCounts = Object.freeze(Object.fromEntries(ROLE_VALUES.map((role) => [role, records.filter((record) => record.status === "REPORT_ELIGIBLE" && record.roles.includes(role)).length])) as Record<ReportKnowledgeRole, number>)
  const reportEligibleAtoms = statusCounts.REPORT_ELIGIBLE
  const reportRagOverlapAtoms = records.filter((record) => record.status === "REPORT_ELIGIBLE" && record.reportRagOverlapChunkIds.length > 0).length
  const summaryWithoutHash = {
    version: "report-knowledge-audit@2.3" as const,
    totalAtoms: records.length,
    reportEligibleAtoms,
    notReportEligibleAtoms: statusCounts.NOT_REPORT_ELIGIBLE,
    needsReviewAtoms: statusCounts.NEEDS_REVIEW,
    ownerBookEligibleAtoms: records.filter((record) => record.status === "REPORT_ELIGIBLE" && record.sourceId === OWNER_BOOK_SOURCE_ID).length,
    reportRagOverlapAtoms,
    novelUsefulAtoms: reportEligibleAtoms - reportRagOverlapAtoms,
    overlapMethod: "normalized_token_containment_gte_0.35" as const,
    statusCounts,
    roleCounts,
    sourceSha256: DENSE_RUNTIME.source.sha256,
  }
  const auditSha256 = createHash("sha256")
    .update(JSON.stringify({ summary: summaryWithoutHash, records }))
    .digest("hex")
  const summary: ReportKnowledgeAuditSummary = Object.freeze({ ...summaryWithoutHash, auditSha256 })
  cachedAudit = Object.freeze({ summary, records })
  return cachedAudit
}

function domainsForFormulation(id: FormulationId | null, domainResults: readonly DomainResult[]): DomainKey[] {
  if (id?.startsWith("domain_")) return [id.slice("domain_".length) as DomainKey]
  if (id === "physiological_interoceptive") return ["physiological", "interoception"]
  if (id === "selective_interoception") return ["interoception"]
  if (id === "motor_praxis") return ["executive", "cognitive"]
  if (id === "adaptive_daily_living") return ["executive", "interoception", "physiological"]
  if (id === "social_pragmatic") return ["emotional", "cognitive", "executive"]
  if (id === "language_communication") return ["cognitive", "executive"]
  if (id === "language_social_pragmatic") return ["cognitive", "executive", "emotional"]
  return domainResults.filter((domain) => domain.level !== "Tipik").map((domain) => domain.key as DomainKey)
}

function claimId(sectionId: SelectedReportKnowledgeAtom["sectionId"], atomId: string) {
  return `claim.owner-book.${sectionId.replace("section_", "s")}.${atomId.split(":").slice(-1)[0]}`
}

function claimBoundary(sectionId: SelectedReportKnowledgeAtom["sectionId"]): string {
  if (sectionId === "section_8") return "Owner/DNA kitabından kurum-içi genel kavramsal çerçeve; dış literatür kanıtı, vaka bulgusu veya karar desteği değildir."
  return "Yalnız genel kavramsal açıklama ve sınırlandırma; skor, vaka bulgusu, formülasyon seçimi, güven veya çelişki kararı üretemez."
}

function selectedText(atom: DenseKnowledgeUnit, sectionId: SelectedReportKnowledgeAtom["sectionId"]): string {
  const text = atom.text.trim()
    .replace(/\s*\([^)]*(?:19|20)\d{2}[^)]*\)\s*[.]?$/u, ".")
    .replace(/\s+/gu, " ")
  if (sectionId === "section_8") return `DNA/owner-book bilgi çekirdeğindeki genel kavramsal çerçeve şu noktayı vurgular: ${text} Bu kurum-içi kaynak dış bilimsel literatür kanıtı veya vaka kararı olarak kullanılmamıştır.`
  if (sectionId === "section_5") return `Owner-book kaynaklı genel yorum sınırı olarak ${text.replace(/^./u, (letter) => letter.toLocaleLowerCase("tr-TR"))}`
  return `Owner-book kaynaklı genel kavramsal çerçevede ${text.replace(/^./u, (letter) => letter.toLocaleLowerCase("tr-TR"))}`
}

const CASE_FUNCTIONAL_SOURCES = new Set(["CAREGIVER_REPORT", "THERAPIST_OBSERVATION", "EXTERNAL_ASSESSMENT"])

function knowledgeRelevanceDecision(input: Readonly<{
  atomId: string
  text: string
  roles: readonly ReportKnowledgeRole[]
  reportDomain: DomainKey | null
  sectionId: SelectedReportKnowledgeAtom["sectionId"]
  decisionPlan: ClinicalDecisionPlan
  domainResults: readonly DomainResult[]
  matrix: ClinicalEvidenceMatrix
  selectedTexts: readonly string[]
}>): ReportKnowledgeRelevanceDecision {
  const primaryDomains = domainsForFormulation(input.decisionPlan.primaryFormulation?.id ?? null, input.domainResults)
  const caseFunctionalDomains = new Set(input.matrix.units
    .filter((unit) => unit.domain && unit.domain !== "global" && unit.direction === "SUPPORTS" && CASE_FUNCTIONAL_SOURCES.has(unit.sourceType))
    .map((unit) => unit.domain as DomainKey))
  const importantDomains = new Set<DomainKey>([
    ...primaryDomains,
    ...input.domainResults.filter((domain) => domain.level !== "Tipik").map((domain) => domain.key as DomainKey),
    ...caseFunctionalDomains,
  ])
  const needsSourceBoundary = input.matrix.discrepancyClusters.length > 0
    || input.decisionPlan.externalTestSynthesis.length > 0
    || input.decisionPlan.limitations.length > 0
  const roleFitsSection = input.sectionId === "section_3"
    ? input.roles.some((role) => ["DOMAIN_INTERPRETATION", "FUNCTIONAL_MEANING", "BOUNDARY"].includes(role))
    : input.sectionId === "section_4"
      ? input.roles.some((role) => ["FORMULATION_CONTEXT", "RELATION", "BOUNDARY"].includes(role))
      : input.sectionId === "section_5"
        ? needsSourceBoundary && input.roles.some((role) => ["BOUNDARY", "LIMITATION", "RELATION"].includes(role))
        : input.roles.some((role) => ["GENERAL_SCIENTIFIC_CONTEXT", "CORE_DEFINITION", "BOUNDARY", "LIMITATION"].includes(role))
  const primaryOrImportantDomainRelation = input.reportDomain
    ? importantDomains.has(input.reportDomain)
    : input.sectionId === "section_5" ? needsSourceBoundary : ["section_4", "section_8"].includes(input.sectionId)
  const caseEvidenceRelation = input.reportDomain
    ? caseFunctionalDomains.has(input.reportDomain) || primaryDomains.includes(input.reportDomain)
    : input.sectionId === "section_5" ? needsSourceBoundary : input.decisionPlan.supportingEvidence.length > 0 || input.decisionPlan.decisionState !== "FORMULATED"
  const functionalRelevance = input.roles.includes("FUNCTIONAL_MEANING")
    || Boolean(input.reportDomain && (caseFunctionalDomains.has(input.reportDomain) || primaryDomains.includes(input.reportDomain)))
    || (input.sectionId === "section_5" && needsSourceBoundary)
    || (input.sectionId === "section_8" && input.roles.some((role) => ["GENERAL_SCIENTIFIC_CONTEXT", "BOUNDARY", "LIMITATION"].includes(role)))
    || (input.sectionId === "section_4" && input.roles.some((role) => ["FORMULATION_CONTEXT", "RELATION"].includes(role)))
  const atomTokens = normalizedTokens(input.text)
  const repetitionRisk = input.selectedTexts.reduce((highest, selected) => Math.max(highest, containment(atomTokens, normalizedTokens(selected))), 0)
  const informationGain = atomTokens.size >= 7 && repetitionRisk < 0.68
  const domainResult = input.reportDomain ? input.domainResults.find((domain) => domain.key === input.reportDomain) : null
  const secondaryPreservedWithoutFunction = Boolean(
    input.reportDomain
    && !primaryDomains.includes(input.reportDomain)
    && domainResult?.level === "Tipik"
    && !caseFunctionalDomains.has(input.reportDomain),
  )
  const decisionOrConfidenceContribution = Boolean(
    (input.reportDomain && primaryDomains.includes(input.reportDomain))
    || (input.sectionId === "section_5" && needsSourceBoundary)
    || (input.decisionPlan.decisionState === "UNCERTAIN" && input.roles.some((role) => ["BOUNDARY", "LIMITATION", "RELATION"].includes(role)))
  )
  const theoreticalExpansionRisk = HIGH_THEORETICAL_EXPANSION.test(input.text)
  const sectionNeed = input.sectionId === "section_3"
    ? Boolean(input.reportDomain && importantDomains.has(input.reportDomain) && caseFunctionalDomains.has(input.reportDomain))
    : input.sectionId === "section_4"
      ? Boolean(input.reportDomain && primaryDomains.includes(input.reportDomain))
      : input.sectionId === "section_5"
        ? needsSourceBoundary
        : Boolean((input.reportDomain && primaryDomains.includes(input.reportDomain)) || input.decisionPlan.decisionState === "UNCERTAIN")
  const score = Number(primaryOrImportantDomainRelation) * 3
    + Number(roleFitsSection) * 3
    + Number(caseEvidenceRelation) * 2
    + Number(functionalRelevance) * 2
    + Number(informationGain) * 2
    - Math.round(repetitionRisk * 4)
  let relevance: ReportKnowledgeRelevanceDecision["relevance"] = "IRRELEVANT"
  if (!secondaryPreservedWithoutFunction && roleFitsSection && primaryOrImportantDomainRelation && informationGain && score >= 8) relevance = "RELEVANT"
  else if (!secondaryPreservedWithoutFunction && roleFitsSection && score >= 5) relevance = "OPTIONAL_LOW_VALUE"
  const materialityScore = Number(primaryOrImportantDomainRelation) * 3
    + Number(caseEvidenceRelation) * 3
    + Number(functionalRelevance) * 2
    + Number(roleFitsSection) * 2
    + Number(decisionOrConfidenceContribution) * 2
    + Number(informationGain) * 2
    + Number(sectionNeed)
    - Math.round(repetitionRisk * 4)
    - Number(theoreticalExpansionRisk) * 3
  let clinicalMateriality: ReportKnowledgeRelevanceDecision["clinicalMateriality"] = "NON_MATERIAL"
  if (
    !secondaryPreservedWithoutFunction
    && roleFitsSection
    && informationGain
    && primaryOrImportantDomainRelation
    && caseEvidenceRelation
    && functionalRelevance
    && decisionOrConfidenceContribution
    && (!theoreticalExpansionRisk || (caseEvidenceRelation && sectionNeed))
    && materialityScore >= 12
  ) clinicalMateriality = "MATERIAL"
  else if (
    !secondaryPreservedWithoutFunction
    && !theoreticalExpansionRisk
    && roleFitsSection
    && informationGain
    && sectionNeed
    && (caseEvidenceRelation || decisionOrConfidenceContribution)
    && materialityScore >= 8
  ) clinicalMateriality = "SUPPORTIVE_BUT_NONESSENTIAL"
  const reasons = [
    primaryOrImportantDomainRelation ? "PRIMARY_OR_IMPORTANT_DOMAIN" : "NO_IMPORTANT_DOMAIN_RELATION",
    roleFitsSection ? "SECTION_PURPOSE_FIT" : "SECTION_PURPOSE_MISMATCH",
    caseEvidenceRelation ? "CASE_EVIDENCE_RELATED" : "NO_CASE_EVIDENCE_RELATION",
    functionalRelevance ? "FUNCTIONALLY_RELEVANT" : "LOW_FUNCTIONAL_RELEVANCE",
    informationGain ? "ADDS_INFORMATION" : "LOW_INFORMATION_GAIN",
    repetitionRisk >= 0.68 ? "REPETITION_RISK" : "LOW_REPETITION_RISK",
    ...(secondaryPreservedWithoutFunction ? ["SECONDARY_PRESERVED_WITHOUT_CASE_FUNCTION"] : []),
  ]
  const materialityReasons = [
    primaryOrImportantDomainRelation ? "DIRECT_PRIMARY_OR_IMPORTANT_DOMAIN_RELATION" : "NO_DIRECT_PRIMARY_DOMAIN_RELATION",
    caseEvidenceRelation ? "LINKED_TO_CASE_EVIDENCE" : "NO_CASE_EVIDENCE_LINK",
    functionalRelevance ? "LINKED_TO_DAILY_FUNCTION" : "NO_DAILY_FUNCTION_LINK",
    roleFitsSection ? "SECTION_PURPOSE_CONTRIBUTION" : "NO_SECTION_PURPOSE_CONTRIBUTION",
    decisionOrConfidenceContribution ? "DECISION_CONFIDENCE_DISCREPANCY_CONTRIBUTION" : "NO_DECISION_CONFIDENCE_CONTRIBUTION",
    informationGain ? "POSITIVE_INFORMATION_GAIN" : "NO_INFORMATION_GAIN",
    repetitionRisk >= 0.68 ? "HIGH_REPETITION_RISK" : "LOW_REPETITION_RISK",
    theoreticalExpansionRisk ? "THEORETICAL_EXPANSION_RISK" : "LOW_THEORETICAL_EXPANSION_RISK",
    sectionNeed ? "SECTION_HAS_CLINICAL_NEED" : "SECTION_HAS_NO_CLINICAL_NEED",
    ...(secondaryPreservedWithoutFunction ? ["HARD_RULE_SECONDARY_PRESERVED_NO_CASE_EVIDENCE"] : []),
  ]
  return Object.freeze({
    atomId: input.atomId,
    sectionId: input.sectionId,
    reportDomain: input.reportDomain,
    relevance,
    score,
    primaryOrImportantDomainRelation,
    sectionPurposeFit: roleFitsSection,
    caseEvidenceRelation,
    functionalRelevance,
    informationGain,
    repetitionRisk: Number(repetitionRisk.toFixed(3)),
    decisionOrConfidenceContribution,
    theoreticalExpansionRisk,
    clinicalMateriality,
    materialityScore,
    sectionNeed,
    reasons: Object.freeze(reasons),
    materialityReasons: Object.freeze(materialityReasons),
  })
}

export function auditSelectedReportKnowledgeRelevance(input: Readonly<{
  decisionPlan: ClinicalDecisionPlan
  domainResults: readonly DomainResult[]
  matrix: ClinicalEvidenceMatrix
  selectedAtoms: readonly Omit<SelectedReportKnowledgeAtom, "relevance" | "relevanceScore" | "relevanceReasons" | "clinicalMateriality" | "materialityScore" | "materialityReasons">[]
}>) {
  const selectedTexts: string[] = []
  return Object.freeze(input.selectedAtoms.map((atom) => {
    const decision = knowledgeRelevanceDecision({
      atomId: atom.atomId,
      text: atom.text,
      roles: [atom.role],
      reportDomain: atom.reportDomain,
      sectionId: atom.sectionId,
      decisionPlan: input.decisionPlan,
      domainResults: input.domainResults,
      matrix: input.matrix,
      selectedTexts,
    })
    selectedTexts.push(atom.text)
    return decision
  }))
}

export function selectReportKnowledgeBridge(input: Readonly<{
  decisionPlan: ClinicalDecisionPlan
  domainResults: readonly DomainResult[]
  matrix: ClinicalEvidenceMatrix
}>): ReportKnowledgeBridgeSelection {
  const audit = auditReportKnowledgeCore()
  const recordMap = new Map(audit.records.map((record) => [record.atomId, record]))
  const units = DENSE_RUNTIME.units.filter((unit) => recordMap.get(unit.id)?.status === "REPORT_ELIGIBLE")
  const primaryDomains = domainsForFormulation(input.decisionPlan.primaryFormulation?.id ?? null, input.domainResults)
  const orderedDomains = unique([
    ...primaryDomains,
    ...input.domainResults.filter((domain) => domain.level !== "Tipik").sort((left, right) => left.score - right.score).map((domain) => domain.key as DomainKey),
    ...input.domainResults.map((domain) => domain.key as DomainKey),
  ])
  const selectedIds = new Set<string>()
  const selected: SelectedReportKnowledgeAtom[] = []
  const relevanceDecisions: ReportKnowledgeRelevanceDecision[] = []
  const selectedTexts: string[] = []

  const pick = (sectionId: SelectedReportKnowledgeAtom["sectionId"], roles: readonly ReportKnowledgeRole[], domains: readonly (DomainKey | null)[], limit: number) => {
    const candidates = units
      .filter((unit) => !selectedIds.has(unit.id))
      .map((unit) => ({ unit, record: recordMap.get(unit.id)! }))
      .filter(({ record }) => record.roles.some((role) => roles.includes(role)) && (domains.includes(null) || (record.reportDomain && domains.includes(record.reportDomain))))
      .sort((left, right) => {
        const score = (entry: typeof left) => Number(entry.record.reportDomain && domains.includes(entry.record.reportDomain)) * 100
          + entry.record.roles.filter((role) => roles.includes(role)).length * 25
          + Number(entry.record.reportRagOverlapChunkIds.length === 0) * 10
          + Number(entry.unit.text.length >= 90 && entry.unit.text.length <= 260) * 5
        return score(right) - score(left) || left.unit.id.localeCompare(right.unit.id)
      })
      .slice(0, Math.max(12, limit * 4))
    for (const { unit, record } of candidates) {
      const decision = knowledgeRelevanceDecision({
        atomId: unit.id,
        text: unit.text,
        roles: record.roles,
        reportDomain: record.reportDomain,
        sectionId,
        decisionPlan: input.decisionPlan,
        domainResults: input.domainResults,
        matrix: input.matrix,
        selectedTexts,
      })
      relevanceDecisions.push(decision)
      if (
        decision.relevance !== "RELEVANT"
        || decision.clinicalMateriality === "NON_MATERIAL"
        || (decision.clinicalMateriality === "SUPPORTIVE_BUT_NONESSENTIAL" && !decision.sectionNeed)
        || selected.filter((atom) => atom.sectionId === sectionId).length >= limit
      ) continue
      selectedIds.add(unit.id)
      selectedTexts.push(unit.text)
      const role = roles.find((candidate) => record.roles.includes(candidate)) ?? record.roles[0]
      selected.push(Object.freeze({
        atomId: unit.id,
        claimId: claimId(sectionId, unit.id),
        sectionId,
        role,
        reportDomain: record.reportDomain,
        authority: "OWNER_BOOK",
        sourceId: unit.sourceId,
        passageId: unit.passageId,
        text: selectedText(unit, sectionId),
        claimBoundary: claimBoundary(sectionId),
        reportRagOverlap: record.reportRagOverlapChunkIds.length > 0,
        relevance: "RELEVANT",
        relevanceScore: decision.score,
        relevanceReasons: decision.reasons,
        clinicalMateriality: decision.clinicalMateriality,
        materialityScore: decision.materialityScore,
        materialityReasons: decision.materialityReasons,
      }))
    }
  }

  pick("section_3", ["DOMAIN_INTERPRETATION", "FUNCTIONAL_MEANING", "BOUNDARY"], orderedDomains, orderedDomains.length ? 1 : 0)
  pick("section_4", ["FORMULATION_CONTEXT", "RELATION", "BOUNDARY"], primaryDomains.length ? primaryDomains : [null], 1)
  const needsSourceBoundary = input.matrix.discrepancyClusters.length > 0 || input.decisionPlan.externalTestSynthesis.length > 0 || input.decisionPlan.limitations.length > 0
  if (needsSourceBoundary) pick("section_5", ["BOUNDARY", "LIMITATION", "RELATION"], [null, ...primaryDomains], 1)
  pick("section_8", ["GENERAL_SCIENTIFIC_CONTEXT", "CORE_DEFINITION", "BOUNDARY", "LIMITATION"], [null, ...primaryDomains], 1)

  const sectionUsage = Object.freeze(Object.fromEntries(["section_3", "section_4", "section_5", "section_8"].map((sectionId) => [sectionId, Object.freeze(selected.filter((atom) => atom.sectionId === sectionId).map((atom) => atom.atomId))])) as Partial<Record<SelectedReportKnowledgeAtom["sectionId"], readonly string[]>>)
  return Object.freeze({
    version: "report-knowledge-bridge@2.3",
    audit: audit.summary,
    selectedAtoms: Object.freeze(selected),
    selectedAtomIds: Object.freeze(selected.map((atom) => atom.atomId)),
    sectionUsage,
    relevanceDecisions: Object.freeze(relevanceDecisions),
    relevanceSummary: Object.freeze({
      evaluatedCandidateCount: relevanceDecisions.length,
      relevantCandidateCount: relevanceDecisions.filter((entry) => entry.relevance === "RELEVANT").length,
      optionalLowValueCandidateCount: relevanceDecisions.filter((entry) => entry.relevance === "OPTIONAL_LOW_VALUE").length,
      irrelevantCandidateCount: relevanceDecisions.filter((entry) => entry.relevance === "IRRELEVANT").length,
      selectedRelevantCount: selected.length,
      materialCandidateCount: relevanceDecisions.filter((entry) => entry.clinicalMateriality === "MATERIAL").length,
      supportiveCandidateCount: relevanceDecisions.filter((entry) => entry.clinicalMateriality === "SUPPORTIVE_BUT_NONESSENTIAL").length,
      nonMaterialCandidateCount: relevanceDecisions.filter((entry) => entry.clinicalMateriality === "NON_MATERIAL").length,
      selectedMaterialCount: selected.filter((entry) => entry.clinicalMateriality === "MATERIAL").length,
      selectedSupportiveCount: selected.filter((entry) => entry.clinicalMateriality === "SUPPORTIVE_BUT_NONESSENTIAL").length,
    }),
  })
}
