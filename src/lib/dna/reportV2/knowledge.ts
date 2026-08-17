import { CLINICAL_KNOWLEDGE_CHUNKS, type ClinicalKnowledgeChunk } from "../clinicalKnowledgeBase"
import { VERIFIED_LITERATURE_SOURCES, type LiteratureSource } from "../literatureNote"
import type { DomainKey, DomainResult } from "../reportEngine"
import type { ClinicalDecisionState, FormulationId, LiteratureClaimBinding, LiteratureMode, ReportClaim, ReportClaimType, ReportRealization } from "./contracts"

export type KnowledgeChunkMetadata = Readonly<{
  chunkId: string
  sourceIds: readonly string[]
  evidenceGrade: "CONTROLLED_CLINICAL_GUIDANCE" | "UNMIGRATED_LIMITED"
  claimBoundary: string
  ageScope: string
  lastReviewed: string | null
}>

export type ClaimLinkedLiterature = Readonly<{
  claimId: string
  claimType: ReportClaimType
  formulationId: FormulationId | null
  sourceId: string
  inlineCitation: string
  apaReference: string
  supportedClaim: string
  claimBoundary: string
  verifiedClaimId: string
  verifiedClaim: string
  exactPassageId: string
  exactPassageSha256: string
  supportDecision: "DIRECT_SUPPORT"
}>

export type DirectLiteratureEvidence = Readonly<{
  reportClaimId: string
  reportClaim: string
  verifiedClaimId: string
  verifiedClaim: string
  exactPassageId: string
  exactPassageSha256: string
  sourceId: string
  supportDecision: "DIRECT_SUPPORT"
}>

const DIRECT_LITERATURE_EVIDENCE: readonly DirectLiteratureEvidence[] = Object.freeze([
  Object.freeze({
    reportClaimId: "claim.general-science.measurement-boundary",
    reportClaim: "Çocuklarda kullanılan self-regülasyon ölçümlerinin çoğunun psikometrik özellikleri yeterince incelenmemiştir",
    verifiedClaimId: "report-v2.verified-claim.chen-self-regulation-measures@1",
    verifiedClaim: "Çocuklarda kullanılan self-regülasyon ölçümlerinin çoğunun psikometrik özellikleri yeterince incelenmemiştir",
    exactPassageId: "source-library:chen-et-al-2024-self-regulation-measures:p0030:e388e8b6c3a6",
    exactPassageSha256: "e388e8b6c3a643ad591eaccf4b77c96990653bc66838f64608c1b5e03b535239",
    sourceId: "CHEN_ET_AL_2024",
    supportDecision: "DIRECT_SUPPORT",
  }),
])

export const DIRECT_LITERATURE_EVIDENCE_REGISTRY = Object.freeze([...DIRECT_LITERATURE_EVIDENCE])

const MIGRATED_PURPOSES = new Set(["construct", "level_comment"])

export function metadataForKnowledgeChunk(chunk: ClinicalKnowledgeChunk): KnowledgeChunkMetadata {
  const migrated = MIGRATED_PURPOSES.has(chunk.purpose)
  return Object.freeze({
    chunkId: chunk.id,
    sourceIds: Object.freeze(migrated ? ["RAG/Pro RAG.docx", "RAG/Derin Araştırma RAG.docx"] : []),
    evidenceGrade: migrated ? "CONTROLLED_CLINICAL_GUIDANCE" : "UNMIGRATED_LIMITED",
    claimBoundary: migrated
      ? "Yalnız betimleyici construct ve düzey açıklaması; tanı, nedensellik veya tedavi çıkarımı üretmez."
      : "Yalnız mevcut kontrollü metin sınırında ve LIMITED statüsüyle kullanılabilir.",
    ageScope: migrated ? "24-71 months" : "unspecified",
    lastReviewed: migrated ? "2026-08-11" : null,
  })
}

function levelPurpose(level: string) {
  return level === "Atipik" ? "relative_weakness" : level === "Riskli" ? "watch_range" : "relative_strength"
}

export function selectReportV2Knowledge(domainResults: readonly DomainResult[]): Readonly<{
  chunks: readonly ClinicalKnowledgeChunk[]
  metadata: readonly KnowledgeChunkMetadata[]
}> {
  const selected = domainResults.flatMap((domain) => {
    const construct = CLINICAL_KNOWLEDGE_CHUNKS.find((chunk) => chunk.domain === domain.key && chunk.purpose === "construct")
    const level = CLINICAL_KNOWLEDGE_CHUNKS.find((chunk) => chunk.domain === domain.key && chunk.purpose === "level_comment" && chunk.level === levelPurpose(domain.level))
    return [construct, level].filter(Boolean) as ClinicalKnowledgeChunk[]
  })
  const unique = Array.from(new Map(selected.map((chunk) => [chunk.id, chunk])).values())
  return Object.freeze({ chunks: Object.freeze(unique), metadata: Object.freeze(unique.map(metadataForKnowledgeChunk)) })
}

const FORMULATION_TAGS: Partial<Record<FormulationId, readonly string[]>> = {
  domain_physiological: ["self_regulation", "context"],
  domain_sensory: ["sensory_processing", "participation"],
  domain_emotional: ["emotion_regulation", "self_regulation"],
  domain_cognitive: ["executive_function", "measurement"],
  domain_executive: ["executive_function", "adaptive_function"],
  domain_interoception: ["interoception", "measurement"],
  physiological_interoceptive: ["interoception", "self_regulation"],
  selective_interoception: ["interoception", "measurement"],
  motor_praxis: ["motor", "executive_function"],
  adaptive_daily_living: ["adaptive_function", "participation"],
  social_pragmatic: ["social", "emotion_regulation"],
  language_communication: ["language", "executive_function"],
  language_social_pragmatic: ["language", "social"],
  evidence_limited_mixed: ["measurement", "multi_informant", "context"],
  multi_domain: ["self_regulation", "measurement"],
  balanced: ["measurement", "self_regulation"],
}

const DOMAIN_TAGS: Record<DomainKey, readonly string[]> = {
  physiological: ["self_regulation", "context"],
  sensory: ["sensory_processing", "participation"],
  emotional: ["emotion_regulation", "self_regulation"],
  cognitive: ["executive_function", "measurement"],
  executive: ["executive_function", "adaptive_function"],
  interoception: ["interoception", "measurement"],
}

function ageCompatible(source: LiteratureSource, ageMonths: number | null | undefined): boolean {
  if (!source.ageScope || !Number.isFinite(ageMonths)) return true
  const scope = source.ageScope.toLowerCase()
  if (/children|childhood|preschool|toddler|youth|0-21/.test(scope)) return true
  const numbers = scope.match(/\d+/g)?.map(Number) ?? []
  if (numbers.length < 2) return true
  const ageYears = Number(ageMonths) / 12
  const likelyMonths = numbers[1] > 24 && /month/.test(scope)
  return likelyMonths
    ? Number(ageMonths) >= numbers[0] && Number(ageMonths) <= numbers[1]
    : ageYears >= numbers[0] && ageYears <= numbers[1]
}

function sourceTags(source: LiteratureSource): string[] {
  return Array.from(new Set([...(source.relevanceTags ?? []), ...source.evidenceDomain.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)]))
}

function tagMatches(source: LiteratureSource, tag: string): boolean {
  return sourceTags(source).some((sourceTag) => sourceTag === tag || sourceTag.includes(tag) || tag.includes(sourceTag))
}

function sourceEligible(source: LiteratureSource, requiredTagGroups: readonly (readonly string[])[], ageMonths: number | null | undefined): boolean {
  if (!source.claimBoundary.trim() || !source.verifiedAt.trim()) return false
  if (!ageCompatible(source, ageMonths)) return false
  if (/intervention|müdahale/i.test(source.evidenceDomain)) return false
  return requiredTagGroups.length > 0 && requiredTagGroups.every((group) => group.some((tag) => tagMatches(source, tag)))
}

function claimRequiredTagGroups(claim: ReportClaim, decisionState: ClinicalDecisionState, primaryFormulationId: FormulationId | null): string[][] {
  const genericEvidenceTags = ["measurement", "multi_informant", "evidence_boundary", "psychometrics"]
  if (claim.claimType !== "GENERAL_SCIENTIFIC_INTERPRETATION") return []
  if (claim.id.includes("measurement-boundary") || /tek bir kaynak|ölçek sonuçları/i.test(claim.text)) return [genericEvidenceTags]
  if (claim.id.includes("context") || /bağlamsal farklılıklar/i.test(claim.text)) return [["context", "co_regulation", "multi_informant"]]
  const domainMatch = claim.id.match(/^claim\.general-science\.domain\.([a-z_]+)$/)
  if (domainMatch && domainMatch[1] in DOMAIN_TAGS) return [[...DOMAIN_TAGS[domainMatch[1] as DomainKey]]]
  if (claim.formulationId && FORMULATION_TAGS[claim.formulationId]) return [[...FORMULATION_TAGS[claim.formulationId]!]]
  if (primaryFormulationId && FORMULATION_TAGS[primaryFormulationId]) return [[...FORMULATION_TAGS[primaryFormulationId]!]]
  if (decisionState === "UNCERTAIN") return [["measurement", "evidence_boundary"]]
  return []
}

export function linkLiteratureToClaims(input: Readonly<{
  claims: readonly ReportClaim[]
  decisionState: ClinicalDecisionState
  primaryFormulationId: FormulationId | null
  ageMonths?: number | null
  mode: LiteratureMode
}>): ClaimLinkedLiterature[] {
  const limit = input.mode === "DETAILED" ? 6 : 3
  const targetClaims = input.claims
    .filter((claim) => claim.claimType === "GENERAL_SCIENTIFIC_INTERPRETATION")
    .sort((left, right) => {
      const priority = (claim: ReportClaim) => claim.id.includes("domain") ? 0 : claim.id.includes("measurement") ? 1 : 2
      return priority(left) - priority(right) || left.id.localeCompare(right.id)
    })
  const links: ClaimLinkedLiterature[] = []
  for (const reportClaim of targetClaims) {
    if (links.length >= limit) break
    const evidence = DIRECT_LITERATURE_EVIDENCE.find((candidate) => candidate.reportClaimId === reportClaim.id && candidate.reportClaim === reportClaim.text.replace(/[.\s]+$/u, ""))
    if (!evidence) continue
    const source = VERIFIED_LITERATURE_SOURCES[evidence.sourceId]
    if (!source || !ageCompatible(source, input.ageMonths)) continue
    links.push(Object.freeze({
      claimId: reportClaim.id,
      claimType: reportClaim.claimType,
      formulationId: reportClaim.formulationId,
      sourceId: source.id,
      inlineCitation: source.inlineCitation,
      apaReference: source.apaReference,
      supportedClaim: evidence.reportClaim,
      claimBoundary: source.claimBoundary,
      verifiedClaimId: evidence.verifiedClaimId,
      verifiedClaim: evidence.verifiedClaim,
      exactPassageId: evidence.exactPassageId,
      exactPassageSha256: evidence.exactPassageSha256,
      supportDecision: evidence.supportDecision,
    }))
  }
  return links
}

function normalizedEvidenceText(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").replace(/\s+/gu, " ").trim()
}

function expectedConstructs(claim: string): readonly string[] {
  if (/fizyolojik|uyku|enerji|toparlanma/iu.test(claim)) return ["physiological", "measurement"]
  if (/duyusal/iu.test(claim)) return ["sensory", "measurement"]
  if (/duygusal|engellenme/iu.test(claim)) return ["emotion", "measurement"]
  if (/bilişsel|çalışma belleği/iu.test(claim)) return ["cognitive", "measurement"]
  if (/yürütücü/iu.test(claim)) return ["executive", "measurement"]
  if (/interosep/iu.test(claim)) return ["interoception", "measurement"]
  if (/bağlam|görev, çevre|koşullar/iu.test(claim)) return ["context"]
  if (/ölçüm|ölçek|psikometrik/iu.test(claim)) return ["measurement"]
  return []
}

function sourceConstructText(source: LiteratureSource | undefined) {
  if (!source) return ""
  return [...sourceTags(source), source.evidenceDomain].join(" ").toLocaleLowerCase("en-US")
}

function constructTokenMatches(sourceText: string, construct: string) {
  if (construct === "measurement") return /measurement|measure|psychometric|assessment/iu.test(sourceText)
  if (construct === "physiological") return /physiolog|sleep|energy|recovery|arousal|autonomic/iu.test(sourceText)
  if (construct === "sensory") return /sensory/iu.test(sourceText)
  if (construct === "emotion") return /emotion/iu.test(sourceText)
  if (construct === "cognitive") return /cogniti|working_memory/iu.test(sourceText)
  if (construct === "executive") return /executive/iu.test(sourceText)
  if (construct === "interoception") return /interoception/iu.test(sourceText)
  if (construct === "context") return /context|co_regulation|coregulation|parent_child/iu.test(sourceText)
  return false
}

export type LiteratureSupportAuditRecord = Readonly<{
  reportClaimId: string
  finalReportClaim: string
  verifiedClaimId: string | null
  exactPassageId: string | null
  sourceId: string
  supportDecision: "DIRECT_SUPPORT" | "PARTIAL_SUPPORT" | "NO_SUPPORT"
  exactPassageMissing: boolean
  claimSourceMismatch: boolean
  claimPassageOverreach: boolean
  topicOnlyCitation: boolean
  wrongConstructCitation: boolean
}>

function citationParagraph(sectionText: string | null, inlineCitation: string | undefined) {
  if (!sectionText || !inlineCitation) return null
  return sectionText.split(/\n{2,}/u).map((paragraph) => paragraph.trim()).find((paragraph) => paragraph.includes(inlineCitation)) ?? null
}

function claimNearCitation(paragraph: string | null, inlineCitation: string | undefined) {
  if (!paragraph || !inlineCitation) return ""
  const citationOffset = paragraph.indexOf(inlineCitation)
  if (citationOffset < 0) return ""
  const prefix = paragraph.slice(0, citationOffset).trim()
  const boundary = Math.max(prefix.lastIndexOf(". "), prefix.lastIndexOf("! "), prefix.lastIndexOf("? "))
  return prefix.slice(boundary < 0 ? 0 : boundary + 2).trim().replace(/[.\s]+$/u, "")
}

export function auditLiteratureDirectSupport(input: Readonly<{
  bindings: readonly LiteratureClaimBinding[]
  realization?: ReportRealization | null
}>): Readonly<{
  citationBackedClaimCount: number
  exactPassageMissingCount: number
  claimSourceMismatchCount: number
  claimPassageOverreachCount: number
  topicOnlyCitationCount: number
  wrongConstructCitationCount: number
  records: readonly LiteratureSupportAuditRecord[]
}> {
  const section8Text = input.realization?.sections.find((section) => section.sectionId === "section_8")?.text ?? null
  const boundSourceIds = new Set(input.bindings.map((binding) => binding.sourceId))
  const boundRecords = input.bindings.map((binding) => {
    const candidate = binding as LiteratureClaimBinding & Partial<LiteratureClaimBinding>
    const source = VERIFIED_LITERATURE_SOURCES[binding.sourceId]
    const registeredByVerifiedId = DIRECT_LITERATURE_EVIDENCE.find((entry) => entry.verifiedClaimId === candidate.verifiedClaimId)
    const registeredBySource = DIRECT_LITERATURE_EVIDENCE.find((entry) => entry.sourceId === binding.sourceId)
    const paragraph = citationParagraph(section8Text, source?.inlineCitation)
    const realizedClaim = claimNearCitation(paragraph, source?.inlineCitation)
    const exactPassageMissing = !candidate.exactPassageId || !candidate.verifiedClaimId || !registeredByVerifiedId
      || candidate.exactPassageId !== registeredByVerifiedId.exactPassageId
      || candidate.exactPassageSha256 !== registeredByVerifiedId.exactPassageSha256
    const claimSourceMismatch = !registeredByVerifiedId
      || registeredByVerifiedId.sourceId !== binding.sourceId
      || registeredByVerifiedId.reportClaim !== binding.supportedClaim
      || candidate.verifiedClaim !== registeredByVerifiedId.verifiedClaim
    const finalClaimMissing = section8Text != null && (!paragraph || !normalizedEvidenceText(paragraph).includes(normalizedEvidenceText(binding.supportedClaim)))
    const claimPassageOverreach = Boolean((registeredBySource && registeredBySource.reportClaim !== binding.supportedClaim) || finalClaimMissing)
    const expected = expectedConstructs(realizedClaim || binding.supportedClaim)
    const sourceText = sourceConstructText(source)
    const matchedConstructs = expected.filter((construct) => constructTokenMatches(sourceText, construct))
    const wrongConstructCitation = expected.length > 0 && matchedConstructs.length !== expected.length
    const topicOnlyCitation = !registeredByVerifiedId && matchedConstructs.length > 0
    const direct = !exactPassageMissing && !claimSourceMismatch && !claimPassageOverreach && !wrongConstructCitation && candidate.supportDecision === "DIRECT_SUPPORT"
    const supportDecision = direct ? "DIRECT_SUPPORT" : registeredBySource && !wrongConstructCitation ? "PARTIAL_SUPPORT" : "NO_SUPPORT"
    return Object.freeze({
      reportClaimId: binding.reportClaimId,
      finalReportClaim: realizedClaim || binding.supportedClaim,
      verifiedClaimId: candidate.verifiedClaimId ?? null,
      exactPassageId: candidate.exactPassageId ?? null,
      sourceId: binding.sourceId,
      supportDecision,
      exactPassageMissing,
      claimSourceMismatch,
      claimPassageOverreach,
      topicOnlyCitation,
      wrongConstructCitation,
    })
  })
  const unboundCitationRecords = section8Text == null ? [] : Object.values(VERIFIED_LITERATURE_SOURCES)
    .filter((source) => source.inlineCitation && section8Text.includes(source.inlineCitation) && !boundSourceIds.has(source.id))
    .map((source) => {
      const paragraph = citationParagraph(section8Text, source.inlineCitation)
      const finalReportClaim = claimNearCitation(paragraph, source.inlineCitation)
      const expected = expectedConstructs(finalReportClaim)
      const sourceText = sourceConstructText(source)
      const wrongConstructCitation = expected.length > 0 && expected.some((construct) => !constructTokenMatches(sourceText, construct))
      return Object.freeze({
        reportClaimId: "UNBOUND_FINAL_REPORT_CLAIM",
        finalReportClaim,
        verifiedClaimId: null,
        exactPassageId: null,
        sourceId: source.id,
        supportDecision: "NO_SUPPORT" as const,
        exactPassageMissing: true,
        claimSourceMismatch: true,
        claimPassageOverreach: true,
        topicOnlyCitation: true,
        wrongConstructCitation,
      })
    })
  const records = [...boundRecords, ...unboundCitationRecords]
  return Object.freeze({
    citationBackedClaimCount: records.length,
    exactPassageMissingCount: records.filter((record) => record.exactPassageMissing).length,
    claimSourceMismatchCount: records.filter((record) => record.claimSourceMismatch).length,
    claimPassageOverreachCount: records.filter((record) => record.claimPassageOverreach).length,
    topicOnlyCitationCount: records.filter((record) => record.topicOnlyCitation).length,
    wrongConstructCitationCount: records.filter((record) => record.wrongConstructCitation).length,
    records: Object.freeze(records),
  })
}

export function validateLiteratureBindings(input: Readonly<{
  bindings: readonly LiteratureClaimBinding[]
  claims: readonly ReportClaim[]
  decisionState: ClinicalDecisionState
  primaryFormulationId: FormulationId | null
  ageMonths?: number | null
}>): Readonly<{ pass: boolean; issues: readonly string[]; caseDecisionAttributionCount: number }> {
  const claimMap = new Map(input.claims.map((claim) => [claim.id, claim]))
  const issues: string[] = []
  let caseDecisionAttributionCount = 0
  for (const binding of input.bindings) {
    const reportClaim = claimMap.get(binding.reportClaimId)
    const source = VERIFIED_LITERATURE_SOURCES[binding.sourceId]
    if (!reportClaim || !source) { issues.push(`${binding.reportClaimId}:${binding.sourceId}:missing`); continue }
    if (binding.claimType !== "GENERAL_SCIENTIFIC_INTERPRETATION" || reportClaim.claimType !== "GENERAL_SCIENTIFIC_INTERPRETATION" || /(?:primary-formulation|decision-state|confidence|secondary|alternative)/.test(binding.reportClaimId)) {
      caseDecisionAttributionCount += 1
      issues.push(`${binding.reportClaimId}:${binding.sourceId}:case-decision-attribution`)
      continue
    }
    if (!reportClaim.text.includes(binding.supportedClaim) || binding.claimBoundary !== source.claimBoundary || !ageCompatible(source, input.ageMonths)) issues.push(`${binding.reportClaimId}:${binding.sourceId}:mismatch`)
  }
  const directSupport = auditLiteratureDirectSupport({ bindings: input.bindings })
  if (directSupport.exactPassageMissingCount || directSupport.claimSourceMismatchCount || directSupport.claimPassageOverreachCount || directSupport.topicOnlyCitationCount || directSupport.wrongConstructCitationCount) issues.push("direct-support-chain:mismatch")
  return Object.freeze({ pass: issues.length === 0, issues: Object.freeze(issues), caseDecisionAttributionCount })
}

export function buildLiteratureClaims(links: readonly ClaimLinkedLiterature[]): ReportClaim[] {
  return links.map((link, index) => Object.freeze({
    id: `claim.literature.${index + 1}`,
    role: "INTERPRETATION" as const,
    materiality: "IMPORTANT" as const,
    claimType: "GENERAL_SCIENTIFIC_INTERPRETATION" as const,
    knowledgeAuthority: "EXTERNAL_LITERATURE" as const,
    text: `${link.supportedClaim.replace(/[.\s]+$/u, "")} ${link.inlineCitation}. Kaynak: ${link.apaReference.trim().replace(/[.\s]+$/u, "")}.`,
    evidenceIds: Object.freeze([]),
    relationIds: Object.freeze([]),
    sufficiency: "SUPPORTED_DERIVED" as const,
    formulationId: link.formulationId,
    sourceIds: Object.freeze([link.sourceId]),
    knowledgeChunkIds: Object.freeze([]),
  }))
}

const DOMAIN_GENERAL_TEXT: Record<DomainKey, string> = {
  physiological: "Fizyolojik düzenleme ölçümleri uyku, enerji ve toparlanma örüntülerini betimler; tek başına belirli bir vakadaki işlevsel değişimin nedenini göstermez.",
  sensory: "Duyusal işlemleme ölçümleri uyaranlara verilen yanıt örüntülerini betimler; tek başına belirli bir vakadaki işlevsel güçlüğün nedenini göstermez.",
  emotional: "Duygusal düzenleme ölçümleri engellenme ve değişim sonrasındaki toparlanma örüntülerini betimler; tek başına tanısal çıkarım sağlamaz.",
  cognitive: "Bilişsel düzenleme ölçümleri bilgi işleme ve çalışma belleği talepleriyle ilişkili örüntüleri betimler; tek başına nedensel açıklama sağlamaz.",
  executive: "Yürütücü işlev ölçümleri görev başlatma, sürdürme ve tamamlama örüntülerini betimler; sonuçlar bağlam ve gözlemci bilgisiyle birlikte yorumlanır.",
  interoception: "İnteroseptif ölçümler beden sinyallerini fark etme ve kullanma örüntülerini betimler; tek bir ölçek sonucu günlük işlevin tümünü açıklamaz.",
}

export function buildGeneralScientificClaims(input: Readonly<{
  domainResults: readonly DomainResult[]
  primaryFormulationId: FormulationId | null
  decisionState: ClinicalDecisionState
  hasContext: boolean
}>): ReportClaim[] {
  const primaryDomain = input.primaryFormulationId?.startsWith("domain_") ? input.primaryFormulationId.slice("domain_".length) as DomainKey : null
  const prioritized = [...input.domainResults].sort((left, right) => Number(right.key === primaryDomain) - Number(left.key === primaryDomain) || left.score - right.score || left.key.localeCompare(right.key))
  const domain = prioritized[0]?.key as DomainKey | undefined
  const claims: ReportClaim[] = []
  if (domain) claims.push(Object.freeze({
    id: `claim.general-science.domain.${domain}`,
    role: "INTERPRETATION" as const,
    materiality: "IMPORTANT" as const,
    claimType: "GENERAL_SCIENTIFIC_INTERPRETATION" as const,
    knowledgeAuthority: "EXTERNAL_LITERATURE" as const,
    text: DOMAIN_GENERAL_TEXT[domain],
    evidenceIds: Object.freeze([]),
    relationIds: Object.freeze([]),
    sufficiency: "SUPPORTED_DERIVED" as const,
    formulationId: `domain_${domain}` as FormulationId,
    sourceIds: Object.freeze([]),
    knowledgeChunkIds: Object.freeze([]),
  }))
  claims.push(Object.freeze({
    id: "claim.general-science.measurement-boundary",
    role: "LIMITATION" as const,
    materiality: "IMPORTANT" as const,
    claimType: "GENERAL_SCIENTIFIC_INTERPRETATION" as const,
    knowledgeAuthority: "EXTERNAL_LITERATURE" as const,
    text: "Çocuklarda kullanılan self-regülasyon ölçümlerinin çoğunun psikometrik özellikleri yeterince incelenmemiştir.",
    evidenceIds: Object.freeze([]), relationIds: Object.freeze([]), sufficiency: "SUPPORTED_DERIVED" as const, formulationId: null, sourceIds: Object.freeze([]), knowledgeChunkIds: Object.freeze([]),
  }))
  if (input.hasContext) claims.push(Object.freeze({
    id: "claim.general-science.context",
    role: "INTERPRETATION" as const,
    materiality: "IMPORTANT" as const,
    claimType: "GENERAL_SCIENTIFIC_INTERPRETATION" as const,
    knowledgeAuthority: "EXTERNAL_LITERATURE" as const,
    text: "Gelişimsel performans görev, çevre ve destek koşullarına göre değişebilir; bağlamsal farklılıklar doğrudan klinik çelişki anlamına gelmez.",
    evidenceIds: Object.freeze([]), relationIds: Object.freeze([]), sufficiency: "SUPPORTED_DERIVED" as const, formulationId: null, sourceIds: Object.freeze([]), knowledgeChunkIds: Object.freeze([]),
  }))
  return claims
}
