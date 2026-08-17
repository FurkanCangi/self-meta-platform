import type { DomainKey, DomainResult } from "../reportEngine"
import type {
  CaseEvidenceSource,
  CaseEvidenceSourceMatrix,
  CaseEvidenceSourceMatrixEntry,
  CaseEvidenceSourceRelation,
  CanonicalEvidenceRelation,
  CandidateFormulation,
  ClinicalDecisionState,
  ClinicalDecisionPlan,
  ClinicalEvidenceMatrix,
  ConfidenceBreakdown,
  EvidenceSufficiency,
  FormulationId,
  LiteratureMode,
  LockedReportPlan,
  LockedReportSectionPlan,
  ReportClaim,
  ReportClaimType,
  ReportMateriality,
  ReportSectionId,
  StructuredExternalAssessment,
} from "./contracts"
import { REPORT_SECTION_HEADINGS } from "./contracts"
import { buildGeneralScientificClaims, buildLiteratureClaims, linkLiteratureToClaims, selectReportV2Knowledge } from "./knowledge"
import { selectReportKnowledgeBridge } from "./reportKnowledgeBridge"
import { buildEvidenceReconciliationSentence } from "./intraSectionConsistencyGate"

const FORMULATION_LABELS: Record<FormulationId, string> = {
  domain_physiological: "fizyolojik regülasyon odağı",
  domain_sensory: "duyusal regülasyon odağı",
  domain_emotional: "duygusal toparlanma odağı",
  domain_cognitive: "bilişsel düzenleme odağı",
  domain_executive: "yürütücü işlev odağı",
  domain_interoception: "interoseptif farkındalık odağı",
  motor_praxis: "motor planlama ve beden organizasyonu ekseni",
  adaptive_daily_living: "günlük yaşam ve öz bakım ekseni",
  social_pragmatic: "sosyal-pragmatik esneklik ekseni",
  language_communication: "dilsel talep ve sözel işleme ekseni",
  language_social_pragmatic: "dilsel ve sosyal-pragmatik talep ekseni",
  physiological_interoceptive: "bedensel toparlanma ve interoseptif düzenleme ekseni",
  selective_interoception: "seçici interoseptif düzenleme ekseni",
  evidence_limited_mixed: "kaynaklar arası kanıtı sınırlı karma örüntü",
  balanced: "korunmuş ve dengeli düzenleme örüntüsü",
  multi_domain: "birlikte öncelikli çoklu alan örüntüsü",
}

const SECTION_4_FOCUS_LABELS: Record<FormulationId, string> = {
  domain_physiological: "fizyolojik regülasyon alanındaki güçlük",
  domain_sensory: "duyusal regülasyon alanındaki güçlük",
  domain_emotional: "duygusal regülasyon ve toparlanma alanındaki güçlük",
  domain_cognitive: "bilişsel regülasyon alanındaki güçlük",
  domain_executive: "yürütücü işlev alanındaki güçlük",
  domain_interoception: "interosepsiyon alanındaki güçlük",
  motor_praxis: "motor planlama ve beden organizasyonundaki güçlük",
  adaptive_daily_living: "günlük yaşam ve öz bakım görevlerindeki güçlük",
  social_pragmatic: "sosyal katılım ve esneklikteki güçlük",
  language_communication: "sözel bilgiyi işleme ve kullanmadaki güçlük",
  language_social_pragmatic: "sözel bilgi ile sosyal talebi birlikte yönetmedeki güçlük",
  physiological_interoceptive: "fizyolojik regülasyon ile interosepsiyon alanındaki birlikte güçlük",
  selective_interoception: "interosepsiyon alanındaki seçici güçlük",
  evidence_limited_mixed: "birden fazla alana yayılan ancak kanıtı sınırlı güçlük",
  balanced: "self-regülasyon alanlarındaki dengeli görünüm",
  multi_domain: "birden fazla self-regülasyon alanında birlikte görülen güçlük",
}

const SECTION_4_FOCUS_OBJECTS: Record<FormulationId, string> = {
  domain_physiological: "fizyolojik regülasyon alanındaki güçlüğü",
  domain_sensory: "duyusal regülasyon alanındaki güçlüğü",
  domain_emotional: "duygusal regülasyon ve toparlanma alanındaki güçlüğü",
  domain_cognitive: "bilişsel regülasyon alanındaki güçlüğü",
  domain_executive: "yürütücü işlev alanındaki güçlüğü",
  domain_interoception: "interosepsiyon alanındaki güçlüğü",
  motor_praxis: "motor planlama ve beden organizasyonundaki güçlüğü",
  adaptive_daily_living: "günlük yaşam ve öz bakım görevlerindeki güçlüğü",
  social_pragmatic: "sosyal katılım ve esneklikteki güçlüğü",
  language_communication: "sözel bilgiyi işleme ve kullanmadaki güçlüğü",
  language_social_pragmatic: "sözel bilgi ile sosyal talebi birlikte yönetmedeki güçlüğü",
  physiological_interoceptive: "fizyolojik regülasyon ile interosepsiyon alanındaki birlikte güçlüğü",
  selective_interoception: "interosepsiyon alanındaki seçici güçlüğü",
  evidence_limited_mixed: "birden fazla alana yayılan ancak kanıtı sınırlı güçlüğü",
  balanced: "self-regülasyon alanlarında belirgin bir güçlük olmadığını",
  multi_domain: "birden fazla self-regülasyon alanında birlikte görülen güçlüğü",
}

const CASE_SOURCE_LABELS: Record<CaseEvidenceSource, string> = {
  ANAMNESIS: "anamnez",
  CAREGIVER_REPORT: "bakım veren anlatısı",
  TEACHER_REPORT: "öğretmen bildirimi",
  THERAPIST_OBSERVATION: "terapist gözlemi",
  DNA_PROFILE: "DNA alan bulguları",
  EXTERNAL_ASSESSMENT: "dış değerlendirme",
  PRESERVED_CAPACITY: "korunmuş işlev bilgisi",
  CONTEXTUAL_EVIDENCE: "bağlamsal performans bilgisi",
}

const CASE_SOURCE_ORDER: readonly CaseEvidenceSource[] = [
  "ANAMNESIS", "CAREGIVER_REPORT", "TEACHER_REPORT", "THERAPIST_OBSERVATION", "DNA_PROFILE",
  "EXTERNAL_ASSESSMENT", "PRESERVED_CAPACITY", "CONTEXTUAL_EVIDENCE",
]

const RELATION_DOMAIN_LABELS: Record<DomainKey, string> = {
  physiological: "fizyolojik regülasyon alanında",
  sensory: "duyusal regülasyon alanında",
  emotional: "duygusal regülasyon alanında",
  cognitive: "bilişsel regülasyon alanında",
  executive: "yürütücü işlev alanında",
  interoception: "interosepsiyon alanında",
}

function sourcePair(left: CaseEvidenceSource, right: CaseEvidenceSource): readonly [CaseEvidenceSource, CaseEvidenceSource] {
  return CASE_SOURCE_ORDER.indexOf(left) <= CASE_SOURCE_ORDER.indexOf(right) ? [left, right] : [right, left]
}

function canonicalRelation(types: readonly CaseEvidenceSourceRelation[]): CaseEvidenceSourceRelation {
  const present = new Set(types)
  if (present.has("MISSING")) return "MISSING"
  if (present.has("DISAGREES")) return "DISAGREES"
  if (present.has("PARTIALLY_SUPPORTS")) return "PARTIALLY_SUPPORTS"
  if (present.has("SUPPORTS")) return "SUPPORTS"
  return "NOT_COMPARABLE"
}

function relationFromEvidenceType(type: ClinicalEvidenceMatrix["relations"][number]["type"]): CaseEvidenceSourceRelation {
  if (type === "DISCREPANT") return "DISAGREES"
  if (type === "CONVERGENT") return "SUPPORTS"
  if (["PARTIALLY_CONVERGENT", "COMPLEMENTARY", "CONTEXTUAL_MODULATION"].includes(type)) return "PARTIALLY_SUPPORTS"
  return "NOT_COMPARABLE"
}

function buildCanonicalEvidenceRelations(matrix: ClinicalEvidenceMatrix, entries: readonly CaseEvidenceSourceMatrixEntry[]): CanonicalEvidenceRelation[] {
  const grouped = new Map<string, { sourceA: CaseEvidenceSource; sourceB: CaseEvidenceSource; domain: DomainKey | "global" | null; construct: string; relations: CaseEvidenceSourceRelation[]; evidenceIds: string[]; relationIds: string[] }>()
  for (const relation of matrix.relations) {
    const left = matrix.units.find((unit) => unit.id === relation.leftEvidenceId)
    const right = matrix.units.find((unit) => unit.id === relation.rightEvidenceId)
    const leftSource = left ? caseSourceForEvidence(left.sourceType) : null
    const rightSource = right ? caseSourceForEvidence(right.sourceType) : null
    if (!left || !right || !leftSource || !rightSource || leftSource === rightSource) continue
    const [sourceA, sourceB] = sourcePair(leftSource, rightSource)
    const domain = left.domain === right.domain ? left.domain : left.domain && left.domain !== "global" ? left.domain : right.domain
    const construct = left.construct === right.construct ? left.construct : domain && domain !== "global" ? domain : "global"
    const key = `${sourceA}|${sourceB}|${domain ?? "none"}|${construct}`
    const row = grouped.get(key) ?? { sourceA, sourceB, domain, construct, relations: [], evidenceIds: [], relationIds: [] }
    row.relations.push(relationFromEvidenceType(relation.type))
    row.evidenceIds.push(left.id, right.id)
    row.relationIds.push(relation.id)
    grouped.set(key, row)
  }
  const availableEntries = entries.filter((entry) => entry.availability === "AVAILABLE")
  for (let leftIndex = 0; leftIndex < availableEntries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < availableEntries.length; rightIndex += 1) {
      const left = availableEntries[leftIndex]!
      const right = availableEntries[rightIndex]!
      if (left.source === right.source) continue
      const sameDomain = left.domain === right.domain || left.domain == null || left.domain === "global" || right.domain == null || right.domain === "global"
      if (!sameDomain) continue
      const [sourceA, sourceB] = sourcePair(left.source, right.source)
      const domain = left.domain && left.domain !== "global" ? left.domain : right.domain
      const construct = left.construct === right.construct ? left.construct : domain && domain !== "global" ? domain : "global"
      const key = `${sourceA}|${sourceB}|${domain ?? "none"}|${construct}`
      if (grouped.has(key)) continue
      const relation = left.relationToPrimaryFinding === "DISAGREES" || right.relationToPrimaryFinding === "DISAGREES"
        ? "DISAGREES"
        : left.relationToPrimaryFinding === "SUPPORTS" && right.relationToPrimaryFinding === "SUPPORTS"
          ? "SUPPORTS"
          : left.relationToPrimaryFinding === "PARTIALLY_SUPPORTS" || right.relationToPrimaryFinding === "PARTIALLY_SUPPORTS"
            ? "PARTIALLY_SUPPORTS"
            : "NOT_COMPARABLE"
      grouped.set(key, { sourceA, sourceB, domain, construct, relations: [relation], evidenceIds: [...left.evidenceIds, ...right.evidenceIds], relationIds: [...left.relationIds, ...right.relationIds] })
    }
  }
  const missingEntries = entries.filter((entry) => entry.availability === "MISSING")
  for (const missing of missingEntries) {
    const [sourceA, sourceB] = sourcePair("DNA_PROFILE", missing.source)
    const key = `${sourceA}|${sourceB}|${missing.domain ?? "none"}|${missing.construct}`
    if (grouped.has(key)) continue
    grouped.set(key, { sourceA, sourceB, domain: missing.domain, construct: missing.construct, relations: ["MISSING"], evidenceIds: [...missing.evidenceIds], relationIds: [] })
  }
  return [...grouped.values()].map((row, index) => Object.freeze({
    id: `canonical-relation.${String(index + 1).padStart(2, "0")}`,
    sourceA: row.sourceA,
    sourceB: row.sourceB,
    domain: row.domain,
    construct: row.construct,
    relation: canonicalRelation(row.relations),
    evidenceIds: Object.freeze(unique(row.evidenceIds)),
    relationIds: Object.freeze(unique(row.relationIds)),
  })).sort((left, right) => `${left.sourceA}|${left.sourceB}|${left.domain ?? ""}|${left.construct}`.localeCompare(`${right.sourceA}|${right.sourceB}|${right.domain ?? ""}|${right.construct}`, "tr"))
}

function caseSourceForEvidence(sourceType: ClinicalEvidenceMatrix["units"][number]["sourceType"]): CaseEvidenceSource | null {
  if (["DNA_TOTAL_SCORE", "DNA_DOMAIN_SCORE", "DNA_ITEM_PATTERN"].includes(sourceType)) return "DNA_PROFILE"
  if (sourceType === "ANAMNESIS") return "ANAMNESIS"
  if (sourceType === "CAREGIVER_REPORT") return "CAREGIVER_REPORT"
  if (sourceType === "THERAPIST_OBSERVATION") return "THERAPIST_OBSERVATION"
  if (sourceType === "EXTERNAL_ASSESSMENT") return "EXTERNAL_ASSESSMENT"
  if (sourceType === "PRESERVED_CAPACITY") return "PRESERVED_CAPACITY"
  if (sourceType === "CONTEXTUAL_EVIDENCE") return "CONTEXTUAL_EVIDENCE"
  return null
}

function missingSourceForConstruct(construct: string): CaseEvidenceSource | null {
  if (construct === "anamnesis") return "ANAMNESIS"
  if (construct === "observation") return "THERAPIST_OBSERVATION"
  if (construct === "external") return "EXTERNAL_ASSESSMENT"
  return null
}

function strongestRelation(types: readonly ClinicalEvidenceMatrix["relations"][number]["type"][]): CaseEvidenceSourceRelation | null {
  if (types.includes("DISCREPANT")) return "DISAGREES"
  if (types.includes("CONVERGENT")) return "SUPPORTS"
  if (types.some((type) => ["PARTIALLY_CONVERGENT", "COMPLEMENTARY", "CONTEXTUAL_MODULATION"].includes(type))) return "PARTIALLY_SUPPORTS"
  if (types.some((type) => ["NOT_COMPARABLE", "INSUFFICIENT"].includes(type))) return "NOT_COMPARABLE"
  return null
}

function buildCaseEvidenceSourceMatrix(input: Readonly<{
  matrix: ClinicalEvidenceMatrix
  primary: CandidateFormulation | null
  domainResults: readonly DomainResult[]
}>): CaseEvidenceSourceMatrix {
  const focalDomains = new Set(formulationDomains(input.primary?.id ?? null, input.domainResults))
  const focalEvidenceIds = new Set(input.primary?.supportingEvidenceIds.length
    ? input.primary.supportingEvidenceIds
    : input.matrix.units.filter((unit) => unit.sourceType === "DNA_DOMAIN_SCORE" && (focalDomains.size === 0 || (unit.domain != null && focalDomains.has(unit.domain as DomainKey)))).map((unit) => unit.id))
  const entries: CaseEvidenceSourceMatrixEntry[] = []
  for (const unit of input.matrix.units) {
    if (unit.sourceType === "MISSING_INFORMATION") {
      const source = missingSourceForConstruct(unit.construct)
      if (!source) continue
      entries.push(Object.freeze({
        id: `source-matrix.missing.${unit.construct}`,
        source,
        domain: unit.domain,
        construct: unit.construct,
        direction: unit.direction,
        availability: "MISSING",
        comparability: "NOT_COMPARABLE",
        relationToPrimaryFinding: "MISSING",
        evidenceIds: Object.freeze([unit.id]),
        relationIds: Object.freeze([]),
      }))
      continue
    }
    const source = caseSourceForEvidence(unit.sourceType)
    if (!source) continue
    const related = input.matrix.relations.filter((relation) => {
      if (relation.leftEvidenceId === unit.id) return focalEvidenceIds.has(relation.rightEvidenceId)
      if (relation.rightEvidenceId === unit.id) return focalEvidenceIds.has(relation.leftEvidenceId)
      return false
    })
    const relationTypes = related.map((relation) => relation.type)
    const inferred = strongestRelation(relationTypes)
      ?? (focalEvidenceIds.has(unit.id) || (unit.direction === "SUPPORTS" && unit.domain != null && focalDomains.has(unit.domain as DomainKey)) ? "SUPPORTS"
        : unit.direction === "LIMITS" && ["PRESERVED_CAPACITY", "CONTEXTUAL_EVIDENCE"].includes(unit.sourceType) ? "PARTIALLY_SUPPORTS"
        : "NOT_COMPARABLE")
    entries.push(Object.freeze({
      id: `source-matrix.${unit.id}`,
      source,
      domain: unit.domain,
      construct: unit.construct,
      direction: unit.direction,
      availability: "AVAILABLE",
      comparability: inferred === "SUPPORTS" || inferred === "DISAGREES" ? "COMPARABLE" : inferred === "PARTIALLY_SUPPORTS" ? "PARTIALLY_COMPARABLE" : "NOT_COMPARABLE",
      relationToPrimaryFinding: inferred,
      evidenceIds: Object.freeze([unit.id]),
      relationIds: Object.freeze(related.map((relation) => relation.id)),
    }))
  }
  const canonicalRelations = buildCanonicalEvidenceRelations(input.matrix, entries)
  return Object.freeze({
    version: "case-evidence-source-matrix@2",
    entries: Object.freeze(entries),
    canonicalRelations: Object.freeze(canonicalRelations),
    availableSources: Object.freeze(unique(entries.filter((entry) => entry.availability === "AVAILABLE").map((entry) => entry.source))),
    missingSources: Object.freeze(unique(entries.filter((entry) => entry.availability === "MISSING").map((entry) => entry.source))),
  })
}

function joinTurkish(values: readonly string[]): string {
  const uniqueValues = unique(values)
  if (uniqueValues.length <= 1) return uniqueValues[0] ?? "mevcut vaka bilgileri"
  return `${uniqueValues.slice(0, -1).join(", ")} ve ${uniqueValues.at(-1)}`
}

function additiveConjunctionFor(phrase: string): "da" | "de" {
  const lastVowel = [...phrase.toLocaleLowerCase("tr-TR")].reverse().find((character) => "aeıioöuü".includes(character))
  return lastVowel && "eiöü".includes(lastVowel) ? "de" : "da"
}

function section4SynthesisClaim(input: Readonly<{
  matrix: ClinicalEvidenceMatrix
  sourceMatrix: CaseEvidenceSourceMatrix
  primary: CandidateFormulation | null
}>): ReportClaim {
  const supportingEvidenceIds = input.primary?.supportingEvidenceIds.length
    ? input.primary.supportingEvidenceIds
    : input.sourceMatrix.entries.filter((entry) => entry.availability === "AVAILABLE" && entry.relationToPrimaryFinding !== "MISSING").flatMap((entry) => entry.evidenceIds)
  const sourceLabels = input.sourceMatrix.entries
    .filter((entry) => entry.availability === "AVAILABLE" && entry.evidenceIds.some((id) => supportingEvidenceIds.includes(id)))
    .map((entry) => CASE_SOURCE_LABELS[entry.source])
  const evidenceIds = unique(supportingEvidenceIds.length ? supportingEvidenceIds : ["evidence.total-score"])
  const text = input.primary
    ? `${joinTurkish(sourceLabels)} ${SECTION_4_FOCUS_OBJECTS[input.primary.id]} desteklemektedir.`
    : `${joinTurkish(sourceLabels)} tek bir alanda baskın güçlük göstermemektedir.`
  return claim({
    id: "claim.section4-synthesis",
    role: "INTERPRETATION",
    materiality: "REQUIRED",
    text,
    evidenceIds,
    relationIds: unique(input.sourceMatrix.entries.filter((entry) => entry.evidenceIds.some((id) => evidenceIds.includes(id))).flatMap((entry) => entry.relationIds)),
    sufficiency: input.primary ? sufficiencyFor(evidenceIds, input.matrix) : input.matrix.discrepancyClusters.length ? "CONFLICTED" : "LIMITED",
    formulationId: input.primary?.id ?? null,
  })
}

function section4BoundaryClaim(input: Readonly<{
  matrix: ClinicalEvidenceMatrix
  sourceMatrix: CaseEvidenceSourceMatrix
  primary: CandidateFormulation | null
  alternatives: readonly CandidateFormulation[]
}>): ReportClaim | null {
  const discrepancy = input.matrix.discrepancyClusters[0]
  if (discrepancy) {
    const canonical = input.sourceMatrix.canonicalRelations.find((relation) => relation.domain === discrepancy.domain
      && relation.relationIds.some((id) => discrepancy.relationIds.includes(id))
      && (relation.relation === "DISAGREES" || relation.relation === "PARTIALLY_SUPPORTS"))
    const subject = canonical
      ? `${CASE_SOURCE_LABELS[canonical.sourceA]} ile ${CASE_SOURCE_LABELS[canonical.sourceB]}`
      : "Vaka bilgileri"
    const domain = discrepancy.domain && discrepancy.domain !== "global" ? RELATION_DOMAIN_LABELS[discrepancy.domain] : "ilgili konuda"
    const relationText = canonical?.relation === "PARTIALLY_SUPPORTS" ? "kısmen örtüştüğü" : "farklı sonuçlar verdiği"
    return claim({
      id: "claim.section4-boundary",
      role: "LIMITATION",
      materiality: "REQUIRED",
      text: `${subject[0]!.toLocaleUpperCase("tr-TR")}${subject.slice(1)} ${domain} ${relationText} için güçlüğün şiddeti ve günlük yaşamdaki yayılımı temkinli yorumlanmalıdır.`,
      evidenceIds: discrepancy.evidenceIds,
      relationIds: discrepancy.relationIds,
      sufficiency: "CONFLICTED",
      formulationId: input.primary?.id ?? null,
    })
  }
  const contextual = input.matrix.units.find((unit) => unit.sourceType === "CONTEXTUAL_EVIDENCE")
  const preserved = input.matrix.units.find((unit) => unit.sourceType === "PRESERVED_CAPACITY")
  const capacity = contextual ?? preserved
  if (capacity) return claim({
    id: "claim.section4-boundary",
    role: capacity.sourceType === "PRESERVED_CAPACITY" ? "PRESERVED_CAPACITY" : "RELATION",
    materiality: "REQUIRED",
    text: "Yapılandırılmış veya desteklenen koşullarda performansın daha iyi olması, güçlüğün her koşulda aynı olmadığını ve bağlama duyarlı olduğunu göstermektedir.",
    evidenceIds: [capacity.id],
    relationIds: input.matrix.relations.filter((relation) => relation.leftEvidenceId === capacity.id || relation.rightEvidenceId === capacity.id).map((relation) => relation.id),
    sufficiency: "LIMITED",
    formulationId: input.primary?.id ?? null,
  })
  const alternative = input.alternatives.find((candidate) => candidate.id !== "balanced")
  if (alternative && input.primary) return claim({
    id: "claim.section4-boundary",
    role: "ALTERNATIVE",
    materiality: "REQUIRED",
    text: `${SECTION_4_FOCUS_LABELS[alternative.id]} ${additiveConjunctionFor(SECTION_4_FOCUS_LABELS[alternative.id])} değerlendirilmiştir; ancak mevcut vaka kanıtı bu açıklamayı ${SECTION_4_FOCUS_LABELS[input.primary.id]} kadar güçlü desteklememektedir.`,
    evidenceIds: unique([...alternative.supportingEvidenceIds, ...alternative.contradictoryEvidenceIds]),
    relationIds: [],
    sufficiency: alternative.hardContradiction ? "CONFLICTED" : "LIMITED",
    formulationId: alternative.id,
  })
  const missing = input.matrix.units.find((unit) => unit.sourceType === "MISSING_INFORMATION" && unit.construct !== "external")
    ?? input.matrix.units.find((unit) => unit.sourceType === "MISSING_INFORMATION")
  if (!missing) return null
  return claim({
    id: "claim.section4-boundary",
    role: "LIMITATION",
    materiality: "REQUIRED",
    text: missing.finding,
    evidenceIds: [missing.id],
    relationIds: [],
    sufficiency: "LIMITED",
    formulationId: input.primary?.id ?? null,
  })
}

function sourcePairSentence(relation: CanonicalEvidenceRelation): string {
  const leftLabel = CASE_SOURCE_LABELS[relation.sourceA]
  const rightLabel = CASE_SOURCE_LABELS[relation.sourceB]
  const subject = `${leftLabel[0]!.toLocaleUpperCase("tr-TR")}${leftLabel.slice(1)} ile ${rightLabel}`
  const domain = relation.domain && relation.domain !== "global" ? RELATION_DOMAIN_LABELS[relation.domain] : "ilgili konuda"
  if (relation.relation === "DISAGREES") return `${subject} ${domain} aynı yönde değildir; bu fark yorumun kesinliğini sınırlandırmaktadır.`
  if (relation.relation === "SUPPORTS") return `${subject} ${domain} aynı yöndedir.`
  if (relation.relation === "PARTIALLY_SUPPORTS") return `${subject} ${domain} kısmen örtüşmektedir.`
  if (relation.relation === "MISSING") return `${rightLabel[0]!.toLocaleUpperCase("tr-TR")}${rightLabel.slice(1)} bulunmadığı için bu kaynakla karşılaştırma yapılamamıştır.`
  return `${subject} ${domain} doğrudan karşılaştırılamaz.`
}

function sourceComparisonClaim(input: Readonly<{
  matrix: ClinicalEvidenceMatrix
  sourceMatrix: CaseEvidenceSourceMatrix
  primary: CandidateFormulation | null
  domainResults: readonly DomainResult[]
}>): ReportClaim {
  const focalDomains = new Set(formulationDomains(input.primary?.id ?? null, input.domainResults))
  const relationPriority: Record<CaseEvidenceSourceRelation, number> = { DISAGREES: 0, PARTIALLY_SUPPORTS: 1, SUPPORTS: 2, NOT_COMPARABLE: 3, MISSING: 4 }
  const candidateRelations = input.sourceMatrix.canonicalRelations
    .filter((relation) => relation.relation !== "MISSING" && (focalDomains.size === 0 || relation.domain === "global" || relation.domain == null || focalDomains.has(relation.domain as DomainKey) || relation.relation === "DISAGREES"))
  const relevant = candidateRelations
    .filter((relation) => !(relation.domain == null || relation.domain === "global") || !candidateRelations.some((specific) => {
      if (specific.domain == null || specific.domain === "global" || specific.relation !== relation.relation) return false
      const relationPair = sourcePair(relation.sourceA, relation.sourceB).join("|")
      const specificPair = sourcePair(specific.sourceA, specific.sourceB).join("|")
      return relationPair === specificPair
    }))
    .sort((left, right) => relationPriority[left.relation] - relationPriority[right.relation]
      || Number(right.relationIds.length) - Number(left.relationIds.length))
    .slice(0, 4)
  const sentences = relevant.map(sourcePairSentence)
  const relationIds = relevant.flatMap((relation) => relation.relationIds)
  const comparedSources = new Set(relevant.flatMap((relation) => [relation.sourceA, relation.sourceB]))
  const hasDiscrepancy = relevant.some((relation) => relation.relation === "DISAGREES")
  const missingEntries = input.sourceMatrix.entries.filter((entry) => entry.availability === "MISSING")
  const missingLabels = unique(missingEntries.map((entry) => CASE_SOURCE_LABELS[entry.source]))
  if (!sentences.length) {
    const availableLabels = unique(input.sourceMatrix.availableSources.map((source) => CASE_SOURCE_LABELS[source]))
    sentences.push(availableLabels.length === 1
      ? `${availableLabels[0]![0]!.toLocaleUpperCase("tr-TR")}${availableLabels[0]!.slice(1)} kullanılabilir tek vaka kaynağıdır; diğer kaynaklarla karşılaştırma yapılamamaktadır.`
      : `${joinTurkish(availableLabels)} arasındaki ilişkiyi karşılaştırmak için mevcut bilgi yeterli değildir.`)
  }
  if (missingLabels.length) sentences.push(`${joinTurkish(missingLabels)} bulunmadığı için bu ${missingLabels.length === 1 ? "kaynakla" : "kaynaklarla"} karşılaştırma yapılamamıştır.`)
  const evidenceIds = unique(relevant.flatMap((relation) => relation.evidenceIds)
    .concat(input.sourceMatrix.entries.filter((entry) => entry.availability === "AVAILABLE").flatMap((entry) => entry.evidenceIds))
    .concat(missingEntries.flatMap((entry) => entry.evidenceIds)))
  return claim({
    id: "claim.source-comparison.1",
    role: hasDiscrepancy ? "LIMITATION" : "RELATION",
    materiality: "REQUIRED",
    text: sentences.join(" "),
    evidenceIds,
    relationIds: unique(relationIds),
    sufficiency: hasDiscrepancy ? "CONFLICTED" : comparedSources.size >= 2 ? "SUPPORTED_MULTI_SOURCE" : "LIMITED",
    formulationId: input.primary?.id ?? null,
  })
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function sufficiencyFor(evidenceIds: readonly string[], matrix: ClinicalEvidenceMatrix): EvidenceSufficiency {
  if (!evidenceIds.length) return "UNSUPPORTED"
  const evidence = matrix.units.filter((unit) => evidenceIds.includes(unit.id))
  const conflicted = matrix.relations.some((relation) => relation.type === "DISCREPANT" && (evidenceIds.includes(relation.leftEvidenceId) || evidenceIds.includes(relation.rightEvidenceId)))
  if (conflicted) return "CONFLICTED"
  const sources = unique(evidence.map((unit) => unit.sourceType))
  if (sources.length >= 2) return "SUPPORTED_MULTI_SOURCE"
  if (evidence.some((unit) => unit.reliability >= 2 && unit.specificity >= 2)) return "SUPPORTED_DIRECT"
  return "LIMITED"
}

function claimMateriality(input: Readonly<{
  id: string
  role: ReportClaim["role"]
  sufficiency: EvidenceSufficiency
}>): ReportMateriality {
  if (["claim.overall-classification", "claim.primary-formulation", "claim.decision-state", "claim.functional-implication", "claim.confidence", "claim.safety-boundary"].includes(input.id)) return "REQUIRED"
  if (input.id.startsWith("claim.domain.")) return "REQUIRED"
  if (input.id.startsWith("claim.domain-interpretation.")) return "REQUIRED"
  if (input.id.startsWith("claim.discrepancy.") && input.sufficiency === "CONFLICTED") return "REQUIRED"
  if (input.id.startsWith("claim.external.") && input.sufficiency === "CONFLICTED") return "REQUIRED"
  if (input.role === "PRESERVED_CAPACITY") return "OPTIONAL"
  if (input.id.startsWith("claim.context.") || input.id.startsWith("claim.secondary.") || input.id.startsWith("claim.alternative.") || input.id.startsWith("claim.missing.")) return "IMPORTANT"
  return "OPTIONAL"
}

function claimType(input: Readonly<{ id: string; role: ReportClaim["role"] }>): ReportClaimType {
  if (input.id === "claim.primary-formulation") return "FORMULATION_SELECTION"
  if (input.id === "claim.decision-state") return "CASE_DECISION"
  if (input.id === "claim.confidence") return "CONFIDENCE_DECISION"
  if (input.id === "claim.safety-boundary") return "SAFETY_BOUNDARY"
  if (input.role === "FINDING" || input.role === "PRESERVED_CAPACITY" || input.id.startsWith("claim.external.")) return "CASE_FINDING"
  return "CASE_INTERPRETATION"
}

function claim(input: Omit<ReportClaim, "sourceIds" | "knowledgeChunkIds" | "materiality" | "claimType" | "knowledgeAuthority"> & Partial<Pick<ReportClaim, "sourceIds" | "knowledgeChunkIds" | "materiality" | "claimType" | "knowledgeAuthority">>): ReportClaim {
  return Object.freeze({
    ...input,
    materiality: input.materiality ?? claimMateriality(input),
    claimType: input.claimType ?? claimType(input),
    knowledgeAuthority: input.knowledgeAuthority ?? "CASE_EVIDENCE",
    evidenceIds: Object.freeze([...input.evidenceIds]),
    relationIds: Object.freeze([...input.relationIds]),
    sourceIds: Object.freeze([...(input.sourceIds ?? [])]),
    knowledgeChunkIds: Object.freeze([...(input.knowledgeChunkIds ?? [])]),
  })
}

function functionalImplication(id: FormulationId | null): string {
  switch (id) {
    case "domain_sensory": return "Uyaran yoğunluğu arttığında katılımın, geçişlerin veya görevde kalmanın değişkenleşmesi olası işlevsel karşılıktır."
    case "domain_executive": return "Çok basamaklı görevleri başlatma, sürdürme ve tamamlama sırasında destek gereksinimi belirginleşebilir."
    case "domain_cognitive": return "Sözel yük ve çalışma belleği talebi arttığında bilgiyi işleme ve görevde kalma zorlaşabilir."
    case "domain_emotional": return "Engellenme veya beklenmeyen değişim sonrasında yeniden dengeye dönüş süresi uzayabilir."
    case "domain_interoception":
    case "selective_interoception": return "Açlık, susuzluk, tuvalet veya yorgunluk gibi beden sinyallerini zamanında fark edip günlük akışa katma güçleşebilir."
    case "domain_physiological":
    case "physiological_interoceptive": return "Uyku, enerji ve bedensel toparlanma koşulları günlük ritim ve katılımı etkileyebilir."
    case "motor_praxis": return "Motor sıralama ve beden organizasyonu talebi arttığında görev akışını sürdürmek zorlaşabilir."
    case "adaptive_daily_living": return "Öz bakım ve günlük rutinlerin başlatılması ile sürdürülmesinde destek ihtiyacı artabilir."
    case "social_pragmatic": return "Karşılıklılık ve esneklik talebi arttığında sosyal katılım ile toparlanma değişkenleşebilir."
    case "language_communication":
    case "language_social_pragmatic": return "Dilsel ve sosyal talep arttığında anlama, karşılıklılık ve görev organizasyonu birlikte zorlanabilir."
    case "multi_domain": return "Birden fazla düzenleme alanı aynı anda yüklendiğinde günlük performans tek bir alana indirgenemeyen biçimde değişebilir."
    case "balanced": return "Genel düzenleme zemini korunmuştur; yalnız belirli görev veya bağlamlardaki hassasiyetler ayrıca izlenmelidir."
    default: return "Mevcut veri baskın bir işlevsel açıklamayı desteklemediği için günlük performans bağlam içinde ve temkinli yorumlanmalıdır."
  }
}

function formulationDomains(id: FormulationId | null, domainResults: readonly DomainResult[]): DomainKey[] {
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

const CONFIDENCE_LABELS: Record<ConfidenceBreakdown["level"], string> = {
  LOW: "düşük",
  MODERATE: "orta",
  MODERATE_HIGH: "orta-yüksek",
  HIGH: "yüksek",
}

function confidenceText(confidence: ConfidenceBreakdown, matrix: ClinicalEvidenceMatrix): string {
  const naturalize = (text: string) => text
    .replace(/En az üç bağımsız bilgi kanalı aynı klinik örüntüyü desteklemektedir\./u, "Bakımveren bildirimi, klinik gözlem ve ölçüm bulguları aynı örüntüyü desteklemektedir.")
    .replace(/İki bağımsız bilgi kanalı aynı klinik örüntüyü desteklemektedir\./u, "İki farklı bilgi kaynağı aynı örüntüyü desteklemektedir.")
    .replace(/Değerlendirme birden fazla bağımsız bilgi kanalını içermektedir\./u, "Değerlendirmede birden fazla bilgi kaynağı birlikte ele alınmıştır.")
    .replace(/(\d+) bağımsız klinik ayrışma kümesi bulunmaktadır\./u, "Farklı bilgi kaynaklarının aynı yönde sonuç vermemesi yorumun kesinliğini sınırlandırmaktadır.")
    .replace(/(\d+) önemli bilgi kanalı eksiktir\./u, "")
  const positive = confidence.formulationConfidence.positiveFactors[0] ? naturalize(confidence.formulationConfidence.positiveFactors[0]) : undefined
  const negatives = confidence.formulationConfidence.negativeFactors.slice(0, 2).map(naturalize).filter(Boolean)
  const missingLabels = matrix.units.filter((unit) => unit.sourceType === "MISSING_INFORMATION").flatMap((unit) => {
    if (unit.construct === "anamnesis") return ["anamnez"]
    if (unit.construct === "observation") return ["terapist gözlemi"]
    if (unit.construct === "external") return ["dış değerlendirme"]
    return []
  })
  const missing = missingLabels.length
    ? `${missingLabels.length === 1 ? missingLabels[0] : `${missingLabels.slice(0, -1).join(", ")} ve ${missingLabels.at(-1)}`} bulunmadığından sonuç bu bilgi ${missingLabels.length === 1 ? "kanalıyla" : "kanallarıyla"} desteklenmemiştir.`
    : ""
  const details = [positive, ...negatives, missing].filter(Boolean).join(" ")
  return `Formülasyon güveni ${CONFIDENCE_LABELS[confidence.level]} düzeydedir.${details ? ` ${details}` : ""}`
}

function domainFunctionalMeaning(domain: DomainKey): string {
  switch (domain) {
    case "physiological": return "Uyku, enerji ve toparlanma koşulları günlük ritim ile katılımı değiştirebilir."
    case "sensory": return "Uyaran yoğunluğu arttığında katılım, geçiş veya görevde kalma değişkenleşebilir."
    case "emotional": return "Engellenme ve beklenmeyen değişim sonrasında yeniden dengeye dönüş uzayabilir."
    case "cognitive": return "Sözel yük ve çalışma belleği talebi arttığında bilgiyi işleme zorlaşabilir."
    case "executive": return "Çok basamaklı görevleri başlatma, sürdürme ve tamamlama desteğe duyarlı olabilir."
    case "interoception": return "Beden sinyallerini zamanında fark edip günlük akışa katma değişkenleşebilir."
  }
}

function domainInterpretationClaims(domainResults: readonly DomainResult[], matrix: ClinicalEvidenceMatrix): ReportClaim[] {
  return domainResults.map((domain) => {
    const key = domain.key as DomainKey
    const evidence = matrix.units.filter((unit) => unit.domain === key && !["DNA_DOMAIN_SCORE", "DNA_TOTAL_SCORE"].includes(unit.sourceType))
    const caseEvidence = evidence.find((unit) => ["CAREGIVER_REPORT", "THERAPIST_OBSERVATION", "EXTERNAL_ASSESSMENT"].includes(unit.sourceType))
    const caseSpecificDifficulty = evidence.find((unit) => unit.direction === "SUPPORTS" && ["CAREGIVER_REPORT", "THERAPIST_OBSERVATION", "EXTERNAL_ASSESSMENT"].includes(unit.sourceType))
    const preserved = evidence.find((unit) => unit.sourceType === "PRESERVED_CAPACITY")
    const contextual = matrix.units.find((unit) => unit.sourceType === "CONTEXTUAL_EVIDENCE" && unit.limits.includes(`domain_${key}`))
    const evidenceIds = unique([`evidence.domain.${key}`, caseEvidence?.id, preserved?.id, contextual?.id].filter(Boolean) as string[])
    const statusMeaning = domain.level === "Tipik"
      ? `${domain.label} alanındaki görünüm korunmuş kapasite yönündedir.`
      : `${domain.label} alanındaki ${domain.level.toLocaleLowerCase("tr-TR")} görünüm vaka bağlamında işlevsel dikkat gerektirir.`
    const contextualText = preserved || contextual ? " Destekli veya yapılandırılmış koşullardaki daha iyi performans bu alanı çürütmez; bağlama duyarlılığını gösterir." : ""
    const interpretation = domain.level === "Tipik" && caseSpecificDifficulty
      ? `${caseSpecificDifficulty.finding} ${domainFunctionalMeaning(key)}${contextualText}`
      : domain.level === "Tipik" && !caseSpecificDifficulty
      ? `${statusMeaning} Mevcut vaka kanıtında bu alana özgü bağımsız bir günlük işlev güçlüğü gösterilmemiştir.`
      : `${statusMeaning} ${caseSpecificDifficulty?.finding ?? caseEvidence?.finding ?? "Bu alan için bağımsız günlük işlev kanıtı sınırlıdır."} ${domainFunctionalMeaning(key)}${contextualText}`
    return claim({
      id: `claim.domain-interpretation.${key}`,
      role: "INTERPRETATION",
      materiality: domain.level !== "Tipik" || Boolean(caseSpecificDifficulty) ? "REQUIRED" : "OPTIONAL",
      text: interpretation.replace(/\s+/g, " ").trim(),
      evidenceIds,
      relationIds: matrix.relations.filter((relation) => evidenceIds.includes(relation.leftEvidenceId) || evidenceIds.includes(relation.rightEvidenceId)).map((relation) => relation.id),
      sufficiency: sufficiencyFor(evidenceIds, matrix),
      formulationId: `domain_${key}`,
    })
  })
}

function contextClaims(matrix: ClinicalEvidenceMatrix): ReportClaim[] {
  return matrix.units
    .filter((unit) => unit.sourceType === "CONTEXTUAL_EVIDENCE")
    .map((unit, index) => claim({
      id: `claim.context.${index + 1}`,
      role: "RELATION",
      text: unit.finding,
      evidenceIds: [unit.id],
      relationIds: [],
      sufficiency: "LIMITED",
      formulationId: null,
    }))
}

function discrepancyClaims(matrix: ClinicalEvidenceMatrix): ReportClaim[] {
  return matrix.discrepancyClusters
    .map((cluster, index) => {
      return claim({
        id: `claim.discrepancy.${index + 1}`,
        role: "LIMITATION",
        text: buildEvidenceReconciliationSentence(cluster, matrix),
        evidenceIds: cluster.evidenceIds,
        relationIds: cluster.relationIds,
        sufficiency: "CONFLICTED",
        formulationId: cluster.domain && cluster.domain !== "global" ? `domain_${cluster.domain}` : null,
      })
    })
}

function preservedClaims(matrix: ClinicalEvidenceMatrix): ReportClaim[] {
  return matrix.units
    .filter((unit) => unit.sourceType === "PRESERVED_CAPACITY" || (unit.sourceType === "DNA_DOMAIN_SCORE" && unit.direction === "LIMITS"))
    .slice(0, 3)
    .map((unit, index) => claim({
      id: `claim.preserved.${index + 1}`,
      role: "PRESERVED_CAPACITY",
      text: unit.finding,
      evidenceIds: [unit.id],
      relationIds: [],
      sufficiency: "SUPPORTED_DIRECT",
      formulationId: null,
    }))
}

function externalClaims(external: readonly StructuredExternalAssessment[], matrix: ClinicalEvidenceMatrix): ReportClaim[] {
  return external.map((assessment, index) => {
    const evidenceId = `evidence.external.${assessment.id}`
    const status = assessment.comparisonStatus
    const text = status === "DISCREPANT"
      ? `${assessment.testName} bulgusu DNA alan örüntüsüyle ayrışmaktadır ve ana kararın kesinliğini sınırlar.`
      : status === "CONVERGENT"
      ? `${assessment.testName} bulgusu ilgili DNA alan örüntüsüyle yakınsamaktadır.`
      : status === "PARTIALLY_CONVERGENT"
      ? `${assessment.testName} bulgusu DNA örüntüsüyle kısmen örtüşmektedir.`
      : status === "CONTEXTUAL_MODULATION"
      ? `${assessment.testName} bulgusu performansın bağlama göre değişebildiğini göstermektedir.`
      : status === "INSUFFICIENT"
      ? `${assessment.testName} sonucunun yönü belirsiz veya karşılaştırma için yetersizdir; DNA alan puanıyla çelişki olarak yorumlanmamıştır.`
      : `${assessment.testName} bulgusu farklı bir değerlendirme alanı sağladığı için DNA alan puanıyla doğrudan karşılaştırılamaz.`
    return claim({
      id: `claim.external.${index + 1}`,
      role: "RELATION",
      text,
      evidenceIds: [evidenceId].filter((id) => matrix.units.some((unit) => unit.id === id)),
      relationIds: matrix.relations.filter((relation) => relation.leftEvidenceId === evidenceId || relation.rightEvidenceId === evidenceId).map((relation) => relation.id),
      sufficiency: status === "DISCREPANT" ? "CONFLICTED" : status === "CONVERGENT" ? "SUPPORTED_MULTI_SOURCE" : "LIMITED",
      formulationId: null,
      sourceIds: [assessment.id],
    })
  })
}

function section(id: ReportSectionId, allowed: readonly string[], claims: readonly ReportClaim[], limitations: readonly string[] = []): LockedReportSectionPlan {
  const index = Number(id.split("_")[1]) - 1
  const allowedClaims = unique(allowed).map((id) => claims.find((entry) => entry.id === id)).filter(Boolean) as ReportClaim[]
  return Object.freeze({
    id,
    heading: REPORT_SECTION_HEADINGS[index],
    allowedClaimIds: Object.freeze(allowedClaims.map((entry) => entry.id)),
    requiredClaimIds: Object.freeze(allowedClaims.filter((entry) => entry.materiality === "REQUIRED").map((entry) => entry.id)),
    importantClaimIds: Object.freeze(allowedClaims.filter((entry) => entry.materiality === "IMPORTANT").map((entry) => entry.id)),
    optionalClaimIds: Object.freeze(allowedClaims.filter((entry) => entry.materiality === "OPTIONAL").map((entry) => entry.id)),
    limitations: Object.freeze([...limitations]),
  })
}

export function buildDecisionAndReportPlans(input: Readonly<{
  domainResults: readonly DomainResult[]
  globalLevel: DomainResult["level"]
  matrix: ClinicalEvidenceMatrix
  decisionState: ClinicalDecisionState
  primary: CandidateFormulation | null
  secondary: readonly CandidateFormulation[]
  alternatives: readonly CandidateFormulation[]
  confidence: ConfidenceBreakdown
  externalAssessments: readonly StructuredExternalAssessment[]
  ageMonths?: number | null
  literatureMode: LiteratureMode
}>): Readonly<{ decisionPlan: ClinicalDecisionPlan; reportPlan: LockedReportPlan }> {
  const knowledge = selectReportV2Knowledge(input.domainResults)
  const primaryEvidence = input.primary?.supportingEvidenceIds ?? []
  const caseEvidenceSourceMatrix = buildCaseEvidenceSourceMatrix({ matrix: input.matrix, primary: input.primary, domainResults: input.domainResults })
  const section4Synthesis = section4SynthesisClaim({ matrix: input.matrix, sourceMatrix: caseEvidenceSourceMatrix, primary: input.primary })
  const section4Boundary = section4BoundaryClaim({ matrix: input.matrix, sourceMatrix: caseEvidenceSourceMatrix, primary: input.primary, alternatives: input.alternatives })
  const section5SourceComparison = sourceComparisonClaim({ matrix: input.matrix, sourceMatrix: caseEvidenceSourceMatrix, primary: input.primary, domainResults: input.domainResults })
  const primaryDecisionClaimId = input.decisionState === "UNCERTAIN" ? "claim.decision-state" : "claim.primary-formulation"
  const primaryClaim = input.primary
    ? claim({
      id: primaryDecisionClaimId,
      role: "INTERPRETATION",
      text: `En güçlü desteklenen klinik örüntü ${FORMULATION_LABELS[input.primary.id]} olarak değerlendirilmiştir.`,
      evidenceIds: primaryEvidence,
      relationIds: [],
      sufficiency: sufficiencyFor(primaryEvidence, input.matrix),
      formulationId: input.primary.id,
      knowledgeChunkIds: knowledge.chunks.map((chunk) => chunk.id),
    })
    : claim({
      id: primaryDecisionClaimId,
      role: "LIMITATION",
      text: "Mevcut kanıtlar baskın bir klinik örüntüyü yeterli kesinlikle ayırmaya yetmemektedir; yorum temkinli ve açık uçlu tutulmuştur.",
      evidenceIds: unique(["evidence.total-score", ...input.matrix.units.filter((unit) => unit.sourceType === "MISSING_INFORMATION").map((unit) => unit.id), ...input.matrix.discrepancyClusters.flatMap((cluster) => cluster.evidenceIds)]),
      relationIds: input.matrix.discrepancyClusters.flatMap((cluster) => cluster.relationIds),
      sufficiency: input.matrix.discrepancyClusters.length ? "CONFLICTED" : "LIMITED",
      formulationId: null,
    })
  const baseClaims: ReportClaim[] = [
    claim({
      id: "claim.overall-classification",
      role: "FINDING",
      text: input.matrix.units.find((unit) => unit.id === "evidence.total-score")?.finding ?? `Genel sınıflama ${input.globalLevel} olarak hesaplandı.`,
      evidenceIds: ["evidence.total-score"],
      relationIds: [],
      sufficiency: "SUPPORTED_DIRECT",
      formulationId: null,
    }),
    primaryClaim,
    section4Synthesis,
    ...(section4Boundary ? [section4Boundary] : []),
    section5SourceComparison,
    claim({
      id: "claim.functional-implication",
      role: "FUNCTIONAL_IMPLICATION",
      text: functionalImplication(input.primary?.id ?? null),
      evidenceIds: primaryEvidence.length ? primaryEvidence : ["evidence.total-score"],
      relationIds: [],
      sufficiency: input.primary ? sufficiencyFor(primaryEvidence, input.matrix) : "LIMITED",
      formulationId: input.primary?.id ?? null,
    }),
    claim({
      id: "claim.confidence",
      role: "LIMITATION",
      text: confidenceText(input.confidence, input.matrix),
      evidenceIds: unique([...(input.primary?.supportingEvidenceIds ?? []), ...(input.primary?.contradictoryEvidenceIds ?? []), ...input.matrix.discrepancyClusters.flatMap((cluster) => cluster.evidenceIds)]),
      relationIds: input.matrix.relations.filter((relation) => relation.type === "CONVERGENT" || relation.type === "DISCREPANT").map((relation) => relation.id),
      sufficiency: input.confidence.level === "LOW" ? "LIMITED" : input.matrix.relations.some((relation) => relation.type === "DISCREPANT") ? "CONFLICTED" : "SUPPORTED_DERIVED",
      formulationId: input.primary?.id ?? null,
    }),
    ...input.domainResults.map((domain) => {
      const evidenceId = `evidence.domain.${domain.key}`
      const chunkIds = knowledge.chunks.filter((chunk) => chunk.domain === domain.key).map((chunk) => chunk.id)
      return claim({
        id: `claim.domain.${domain.key}`,
        role: "FINDING",
        text: `${domain.label}: ${domain.score}/50 — ${domain.level}.`,
        evidenceIds: [evidenceId],
        relationIds: [],
        sufficiency: "SUPPORTED_DIRECT",
        formulationId: `domain_${domain.key as DomainKey}`,
        knowledgeChunkIds: chunkIds,
      })
    }),
    claim({
      id: "claim.domain-threshold-method",
      role: "INTERPRETATION",
      materiality: "REQUIRED",
      text: "Alan sınıflamaları yaşa ve ilgili alana özgü eşiklere göre hesaplanmıştır.",
      evidenceIds: input.domainResults.map((domain) => `evidence.domain.${domain.key}`),
      relationIds: [],
      sufficiency: "SUPPORTED_DERIVED",
      formulationId: null,
    }),
    ...domainInterpretationClaims(input.domainResults, input.matrix),
    ...contextClaims(input.matrix),
    ...discrepancyClaims(input.matrix),
    ...preservedClaims(input.matrix),
    ...externalClaims(input.externalAssessments, input.matrix),
    ...input.secondary.map((candidate, index) => claim({
      id: `claim.secondary.${index + 1}`,
      role: "INTERPRETATION",
      text: `${FORMULATION_LABELS[candidate.id]} ikincil katkı sağlayan örüntü olarak değerlendirilmiştir.`,
      evidenceIds: candidate.supportingEvidenceIds,
      relationIds: [],
      sufficiency: sufficiencyFor(candidate.supportingEvidenceIds, input.matrix),
      formulationId: candidate.id,
    })),
    ...input.alternatives.map((candidate, index) => claim({
      id: `claim.alternative.${index + 1}`,
      role: "ALTERNATIVE",
      text: `${FORMULATION_LABELS[candidate.id]} alternatif açıklama olarak korunmuş, ancak mevcut kanıtla birincil klinik örüntü olarak seçilmemiştir.`,
      evidenceIds: unique([...candidate.supportingEvidenceIds, ...candidate.contradictoryEvidenceIds]),
      relationIds: [],
      sufficiency: candidate.hardContradiction ? "CONFLICTED" : "LIMITED",
      formulationId: candidate.id,
    })),
    ...input.matrix.units.filter((unit) => unit.sourceType === "MISSING_INFORMATION").map((unit, index) => claim({
      id: `claim.missing.${index + 1}`,
      role: "LIMITATION",
      text: unit.finding,
      evidenceIds: [unit.id],
      relationIds: [],
      sufficiency: "LIMITED",
      formulationId: null,
    })),
    claim({
      id: "claim.safety-boundary",
      role: "LIMITATION",
      text: "Bu rapor klinik karar desteği sağlar; tek başına tanı, nedensellik veya tedavi önerisi üretmez.",
      evidenceIds: [],
      relationIds: [],
      sufficiency: "SUPPORTED_DERIVED",
      formulationId: null,
    }),
  ].filter((entry) => entry.sufficiency !== "UNSUPPORTED")

  const baseIdsByPrefix = (prefix: string) => baseClaims.filter((entry) => entry.id.startsWith(prefix)).map((entry) => entry.id)
  const discrepancyIds = baseIdsByPrefix("claim.discrepancy.")
  const preservedIds = baseIdsByPrefix("claim.preserved.")
  const externalIds = baseIdsByPrefix("claim.external.")
  const secondaryIds = baseIdsByPrefix("claim.secondary.")
  const missingIds = baseIdsByPrefix("claim.missing.")
  const section4SynthesisIds = baseIdsByPrefix("claim.section4-synthesis")
  const section4BoundaryIds = baseIdsByPrefix("claim.section4-boundary")
  const sourceComparisonIds = baseIdsByPrefix("claim.source-comparison.")
  const domainIds = baseIdsByPrefix("claim.domain.")
  const domainInterpretationIds = baseIdsByPrefix("claim.domain-interpretation.")
  const primaryDomains = formulationDomains(input.primary?.id ?? null, input.domainResults)
  const caseFunctionalDomains = new Set(input.matrix.units
    .filter((unit) => unit.domain && unit.domain !== "global" && unit.direction === "SUPPORTS" && ["CAREGIVER_REPORT", "THERAPIST_OBSERVATION", "EXTERNAL_ASSESSMENT"].includes(unit.sourceType))
    .map((unit) => unit.domain as DomainKey))
  const clinicallyImportantDomains = new Set<DomainKey>([
    ...primaryDomains,
    ...input.domainResults.filter((domain) => domain.level !== "Tipik").map((domain) => domain.key as DomainKey),
    ...caseFunctionalDomains,
  ])
  const clinicallyImportantDomainInterpretationIds = domainInterpretationIds.filter((id) => clinicallyImportantDomains.has(id.split(".").at(-1) as DomainKey))

  const supportingEvidence = input.primary?.supportingEvidenceIds ?? []
  const contradictoryEvidence = unique([...(input.primary?.contradictoryEvidenceIds ?? []), ...input.matrix.discrepancyClusters.flatMap((cluster) => cluster.evidenceIds)])
  const preservedCapacity = input.matrix.units.filter((unit) => unit.sourceType === "PRESERVED_CAPACITY" || (unit.sourceType === "DNA_DOMAIN_SCORE" && unit.direction === "LIMITS")).map((unit) => unit.id)
  const limitations = unique([...input.confidence.negativeFactors, ...input.matrix.units.filter((unit) => unit.sourceType === "MISSING_INFORMATION").map((unit) => unit.finding), ...input.matrix.discrepancyClusters.map(() => "Kaynaklar arasında klinik bir ayrışma bulunmaktadır.")])
  const prohibitedInferences = Object.freeze(["diagnosis", "causality", "treatment_recommendation", "protocol", "unbounded_mechanism"])
  const decisionPlan: ClinicalDecisionPlan = Object.freeze({
    version: "clinical-decision-plan@2.2",
    decisionState: input.decisionState,
    overallClassification: input.globalLevel,
    primaryFormulation: input.primary,
    secondaryFormulations: Object.freeze([...input.secondary]),
    alternativeFormulations: Object.freeze([...input.alternatives]),
    supportingEvidence: Object.freeze(supportingEvidence),
    contradictoryEvidence: Object.freeze(contradictoryEvidence),
    preservedCapacity: Object.freeze(preservedCapacity),
    contextualModifiers: Object.freeze(input.matrix.units.filter((unit) => unit.sourceType === "CONTEXTUAL_EVIDENCE").map((unit) => unit.id)),
    functionalImplications: Object.freeze([functionalImplication(input.primary?.id ?? null)]),
    externalTestSynthesis: Object.freeze([...input.externalAssessments]),
    discrepancyClusters: input.matrix.discrepancyClusters,
    confidence: input.confidence,
    limitations: Object.freeze(limitations),
    validationPriorities: Object.freeze(unique([
      ...(discrepancyIds.length ? ["Kaynaklar-arası ayrışmayı farklı bağlam ve zamanlarda doğrula."] : []),
      ...(missingIds.length ? ["Eksik bilgi kanallarını tamamla."] : []),
      "Formülasyonu gerçek klinisyen kararıyla gözden geçir.",
    ])),
    prohibitedInferences,
    claims: Object.freeze(baseClaims.filter((claim) => !["claim.section4-synthesis", "claim.section4-boundary", "claim.source-comparison.1"].includes(claim.id))),
  })

  // The decision plan is locked before read-only report knowledge is selected.
  // The bridge can explain that decision, but cannot mutate its scores,
  // candidates, state, confidence, evidence or contradictions.
  const knowledgeBridge = selectReportKnowledgeBridge({ decisionPlan, domainResults: input.domainResults, matrix: input.matrix })
  const ownerBookClaims = knowledgeBridge.selectedAtoms.map((atom) => claim({
    id: atom.claimId,
    role: atom.role === "BOUNDARY" || atom.role === "LIMITATION" ? "LIMITATION" : atom.role === "RELATION" ? "RELATION" : "INTERPRETATION",
    materiality: atom.clinicalMateriality === "MATERIAL" ? "IMPORTANT" : "OPTIONAL",
    claimType: "OWNER_BOOK_INTERPRETATION",
    knowledgeAuthority: "OWNER_BOOK",
    text: atom.text,
    evidenceIds: [],
    relationIds: [],
    sufficiency: "SUPPORTED_DERIVED",
    formulationId: null,
    sourceIds: [atom.sourceId],
    knowledgeChunkIds: [atom.atomId, atom.passageId],
  }))
  const generalScientificClaims = buildGeneralScientificClaims({
    domainResults: input.domainResults,
    primaryFormulationId: input.primary?.id ?? null,
    decisionState: input.decisionState,
    hasContext: input.matrix.units.some((unit) => unit.sourceType === "CONTEXTUAL_EVIDENCE"),
  })
  const literatureLinks = linkLiteratureToClaims({ claims: generalScientificClaims, decisionState: input.decisionState, primaryFormulationId: input.primary?.id ?? null, ageMonths: input.ageMonths, mode: input.literatureMode })
  const literatureClaims = buildLiteratureClaims(literatureLinks)
  const claims = Object.freeze([...baseClaims, ...ownerBookClaims, ...literatureClaims])
  const literatureIds = claims.filter((entry) => entry.id.startsWith("claim.literature.")).map((entry) => entry.id)
  const prescriptiveKnowledge = /\b(?:planlanmalıdır|planlanmalı|uygulanmalıdır|uygulanmalı|kullanılmalıdır|kullanılmalı|önerilir|önerilmektedir|yapılmalıdır|yapılmalı)\b/iu
  const ownerIds = (sectionId: "section_3" | "section_4" | "section_5" | "section_8") => knowledgeBridge.selectedAtoms
    .filter((atom) => atom.sectionId === sectionId && !prescriptiveKnowledge.test(atom.text))
    .map((atom) => atom.claimId)

  const sections: LockedReportSectionPlan[] = [
    section("section_1", ["claim.overall-classification", primaryDecisionClaimId, "claim.confidence"], claims, ["Yalnız ana sonuç, en önemli destek, varsa kritik ayrışma ve güven gerekçesini yaz; eksik bilgi türünü adlandır."]),
    section("section_2", ["claim.overall-classification", "claim.domain-threshold-method", ...domainIds], claims, ["Eşik yöntemini yalnız bir kez belirt; yorum veya günlük yaşam açıklaması ekleme."]),
    section("section_3", ["claim.functional-implication", ...clinicallyImportantDomainInterpretationIds], claims, ["Puan listesini ve genel teoriyi tekrar etme; yalnız bu vakada önemli alanların günlük yaşam anlamını yaz."]),
    section("section_4", [primaryDecisionClaimId, ...section4SynthesisIds, ...section4BoundaryIds], claims, ["Bulguların birlikte ne anlattığını açıkla; varsa bağlamsal sınırı veya alternatif açıklamayı görünür tut; otomatik korunmuş-güçlü-yön şablonu kullanma."]),
    section("section_5", [...sourceComparisonIds, ...externalIds, ...discrepancyIds, ...missingIds], claims, ["Yalnız bu vakadaki anamnez, bildirim, gözlem, DNA sonucu ve dış değerlendirme arasındaki uyum veya ayrışmayı yaz; dış test eksikliğini tek başına bölüm içeriği olarak kullanma; genel teori ve başka çocuk örneği ekleme."]),
    section("section_6", [primaryDecisionClaimId, "claim.confidence", ...secondaryIds.slice(0, 1), ...missingIds.slice(0, 1)], claims, ["Önceliğin nedenini kısa ve doğrudan belirt; uygulama veya tedavi önerisi verme."]),
    section("section_7", [primaryDecisionClaimId, "claim.safety-boundary"], claims, ["Kısa klinik sentez yaz; yeni ayrıntı veya öneri ekleme."]),
    section("section_8", [...ownerIds("section_8"), ...literatureIds], claims),
  ]
  const reportPlan: LockedReportPlan = Object.freeze({
    version: "locked-report-plan@2.3",
    subjectAgeMonths: Number.isFinite(input.ageMonths) ? Number(input.ageMonths) : null,
    decisionState: input.decisionState,
    primaryFormulationId: input.primary?.id ?? null,
    primaryDecisionClaimId,
    confidence: input.confidence.level,
    literatureMode: input.literatureMode,
    claims,
    sections: Object.freeze(sections),
    caseEvidenceSourceMatrix,
    literatureBindings: Object.freeze(literatureLinks.map((link, index) => Object.freeze({
      reportClaimId: `claim.literature.${index + 1}`,
      claimType: "GENERAL_SCIENTIFIC_INTERPRETATION" as const,
      sourceId: link.sourceId,
      supportedClaim: link.supportedClaim,
      claimBoundary: link.claimBoundary,
      verifiedClaimId: link.verifiedClaimId,
      verifiedClaim: link.verifiedClaim,
      exactPassageId: link.exactPassageId,
      exactPassageSha256: link.exactPassageSha256,
      supportDecision: link.supportDecision,
    }))),
    knowledgeBridge,
    prohibitedInferences,
  })
  return Object.freeze({ decisionPlan, reportPlan })
}

export { FORMULATION_LABELS }
