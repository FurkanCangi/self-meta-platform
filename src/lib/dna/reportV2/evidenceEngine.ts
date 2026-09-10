import { analyzeExternalClinicalTests, type ExternalTestAnalysis, type ExternalTestCategory } from "../externalTestRegistry"
import { findAgeNormBand } from "../normativeBands"
import type { DomainKey, DomainLevel, DomainResult, ReportInput } from "../reportEngine"
import type {
  CandidateFormulation,
  ClinicalDecisionState,
  ClinicalDiscrepancyCluster,
  ClinicalEvidenceMatrix,
  ClinicalEvidenceRelation,
  ClinicalEvidenceUnit,
  ConfidenceBreakdown,
  EvidenceDirection,
  EvidenceRelationType,
  EvidenceSourceType,
  FormulationId,
  StructuredExternalAssessment,
} from "./contracts"
import { extractCanonicalTherapistObservation } from "./canonicalCaseEvidence"
import { extractCanonicalAnamnesisEvidence } from "../reportJury/canonicalAnamnesisEvidence"

const DOMAIN_CANDIDATE: Record<DomainKey, FormulationId> = {
  physiological: "domain_physiological",
  sensory: "domain_sensory",
  emotional: "domain_emotional",
  cognitive: "domain_cognitive",
  executive: "domain_executive",
  interoception: "domain_interoception",
}

const DOMAIN_LABEL: Record<DomainKey, string> = {
  physiological: "fizyolojik regülasyon",
  sensory: "duyusal regülasyon",
  emotional: "duygusal regülasyon",
  cognitive: "bilişsel düzenleme",
  executive: "yürütücü işlevler",
  interoception: "interoseptif farkındalık",
}

const FUNCTIONAL_SOURCES = new Set<EvidenceSourceType>([
  "ANAMNESIS",
  "CAREGIVER_REPORT",
  "THERAPIST_OBSERVATION",
  "EXTERNAL_ASSESSMENT",
  "CONTEXTUAL_EVIDENCE",
])

const ALL_SOURCES: EvidenceSourceType[] = [
  "DNA_TOTAL_SCORE",
  "DNA_DOMAIN_SCORE",
  "DNA_ITEM_PATTERN",
  "ANAMNESIS",
  "CAREGIVER_REPORT",
  "THERAPIST_OBSERVATION",
  "EXTERNAL_ASSESSMENT",
  "PRESERVED_CAPACITY",
  "COUNTER_EVIDENCE",
  "CONTEXTUAL_EVIDENCE",
  "MISSING_INFORMATION",
]

const DOMAIN_PATTERNS: Record<DomainKey, RegExp> = {
  physiological: /uyku|yorgun|enerji|fizyolojik|toparlanma|beslenme|iştah|istah|bedensel gerilim/i,
  sensory: /duyusal|dokunsal|işitsel|isitsel|ses|gürültü|gurultu|kıyafet|kiyafet|doku|uyaran|spm|sensory profile/i,
  emotional: /duygusal|öfke|ofke|kriz|engellen|sakinleş|sakinles|toparlanma|frustrasyon/i,
  cognitive: /bilişsel|bilissel|dikkat|yönerge|yonerge|çalışma belleği|calisma bellegi|sözel|sozel/i,
  executive: /yürütücü|yurutucu|başlat|baslat|bitir|sürdür|surdur|planla|sırala|sirala|inhibisyon|brief/i,
  interoception: /interosep|açlık|aclik|susuz|tuvalet|ağrı|agri|beden sinyal|içsel sinyal|icsel sinyal/i,
}

const CONTEXT_PATTERNS: Array<[string, RegExp]> = [
  ["yapılandırılmış ve görsel destekli koşul", /görsel|gorsel|yapılandırılmış|yapilandirilmis|model olunduğunda|model olundugunda/i],
  ["geçiş ve rutin değişimi", /geçiş|gecis|rutin değiş|rutin degis|yeni ortam|bekleme/i],
  ["grup veya yoğun uyaran koşulu", /grup|kalabalık|kalabalik|gürültü|gurultu|çok uyaran|cok uyaran/i],
  ["günlük yaşam ve öz bakım", /öz bakım|oz bakim|giyinme|yemek|tuvalet|günlük yaşam|gunluk yasam/i],
  ["sözel ve çok basamaklı görev", /çok basamak|cok basamak|yönerge|yonerge|sözel|sozel/i],
]

function stableHash(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ char, 2654435761)
    h2 = Math.imul(h2 ^ char, 1597334677)
  }
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function normalizedAnamnesis(input: ReportInput): string {
  if (!input.anamnez) return ""
  if (typeof input.anamnez === "string") return input.anamnez.trim()
  return Object.entries(input.anamnez)
    .filter(([, value]) => value != null && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join("\n")
}

function normalizedExternalFindingLayout(text: string): string {
  return text
    .replace(/\s*\|\s*/g, "\n")
    .replace(/(?:Ek klinik test\s*\/\s*bulgular:\s*)?Test\s*\d+\s*:\s*(?=Test adı\s*:)/gi, "\n\n")
}

function extractLabel(text: string, patterns: RegExp[]): string {
  for (const line of text.split(/\n+/)) {
    if (patterns.some((pattern) => pattern.test(line))) {
      const value = line.includes(":") ? line.split(":").slice(1).join(":").trim() : line.trim()
      if (value) return value
    }
  }
  return ""
}

function domainsForText(text: string): DomainKey[] {
  return (Object.keys(DOMAIN_PATTERNS) as DomainKey[]).filter((domain) => DOMAIN_PATTERNS[domain].test(text))
}

function candidateTagsForDomain(domain: DomainKey): FormulationId[] {
  // A domain-level observation can support its domain formulation only. Legacy
  // compound mechanisms require construct-specific evidence (for example a
  // matched external assessment) and must not inherit generic domain points.
  return [DOMAIN_CANDIDATE[domain]]
}

function categoryCandidates(category: ExternalTestCategory): FormulationId[] {
  switch (category) {
    case "adaptive_daily_living": return ["adaptive_daily_living", "domain_executive", "domain_interoception"]
    case "executive_behavior": return ["domain_executive", "domain_cognitive", "evidence_limited_mixed"]
    case "language_communication": return ["language_communication", "domain_cognitive"]
    case "motor_praxis": return ["motor_praxis", "domain_executive"]
    case "sensory_processing": return ["domain_sensory"]
    case "social_pragmatic": return ["social_pragmatic", "language_social_pragmatic", "domain_emotional"]
    default: return []
  }
}

function externalDomains(category: ExternalTestCategory): DomainKey[] {
  switch (category) {
    case "adaptive_daily_living": return ["executive", "interoception"]
    case "executive_behavior": return ["executive", "cognitive", "emotional"]
    case "language_communication": return ["cognitive"]
    case "motor_praxis": return ["executive"]
    case "sensory_processing": return ["sensory"]
    case "social_pragmatic": return ["emotional", "cognitive"]
    default: return []
  }
}

function evidenceWeight(unit: ClinicalEvidenceUnit): number {
  return unit.strength * 2 + unit.reliability + unit.specificity
}

function sourceFamily(sourceType: EvidenceSourceType): string {
  return sourceType === "DNA_DOMAIN_SCORE" || sourceType === "DNA_ITEM_PATTERN" || sourceType === "DNA_TOTAL_SCORE"
    ? "DNA_ASSESSMENT"
    : sourceType
}

function createUnit(unit: ClinicalEvidenceUnit): ClinicalEvidenceUnit {
  return Object.freeze({ ...unit, context: Object.freeze([...unit.context]), supports: Object.freeze([...unit.supports]), contradicts: Object.freeze([...unit.contradicts]), limits: Object.freeze([...unit.limits]), provenance: Object.freeze({ ...unit.provenance }) })
}

function domainScoreUnits(domainResults: readonly DomainResult[]): ClinicalEvidenceUnit[] {
  return domainResults.map((domain) => {
    const key = domain.key as DomainKey
    const concern = domain.level !== "Tipik"
    const tags = candidateTagsForDomain(key)
    return createUnit({
      id: `evidence.domain.${key}`,
      sourceType: "DNA_DOMAIN_SCORE",
      domain: key,
      construct: key,
      finding: `${domain.label} alanı ${domain.score}/50 ve ${domain.level} olarak hesaplandı.`,
      direction: concern ? "SUPPORTS" : "LIMITS",
      strength: domain.level === "Atipik" ? 3 : 2,
      reliability: 3,
      specificity: 3,
      context: [],
      supports: concern ? tags : [],
      contradicts: [],
      limits: concern ? [] : tags,
      provenance: { sourceRef: `score.${key}`, ruleId: "dna-polarity-v2.domain-band" },
    })
  })
}

function itemPatternUnits(input: ReportInput, domainResults: readonly DomainResult[]): ClinicalEvidenceUnit[] {
  if (!Array.isArray(input.answers) || input.answers.length !== 60) return []
  return domainResults.flatMap((domain, domainIndex) => {
    const answers = input.answers!.slice(domainIndex * 10, domainIndex * 10 + 10)
    const severe = answers.filter((value) => Number(value) === 1 || Number(value) === 5).length
    if (severe < 2) return []
    const key = domain.key as DomainKey
    return [createUnit({
      id: `evidence.item-pattern.${key}`,
      sourceType: "DNA_ITEM_PATTERN",
      domain: key,
      construct: key,
      finding: `${domain.label} alanında ${severe} belirgin uç yanıt aynı alan içinde kümelenmektedir.`,
      direction: domain.level === "Tipik" ? "NEUTRAL" : "SUPPORTS",
      strength: severe >= 4 ? 3 : 2,
      reliability: 2,
      specificity: 2,
      context: [],
      supports: domain.level === "Tipik" ? [] : candidateTagsForDomain(key),
      contradicts: [],
      limits: [],
      provenance: { sourceRef: `answers.${domainIndex * 10 + 1}-${domainIndex * 10 + 10}`, ruleId: "report-v2.item-cluster" },
    })]
  })
}

function anamnesisUnits(input: ReportInput): ClinicalEvidenceUnit[] {
  const text = normalizedAnamnesis(input)
  if (!text) return []
  const domains = domainsForText(text)
  const referral = extractLabel(text, [/başvuru sebebi/i, /birincil endişeler/i, /caregiver_concerns/i, /referral_reason/i])
  const therapistObservation = extractCanonicalTherapistObservation(input)
  const therapist = therapistObservation.normalizedText
  const strengths = extractLabel(text, [/çocuğun güçlü yanları/i, /güçlü yanlar/i, /strengths/i, /preserved_areas/i])
  const contexts = CONTEXT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label)
  const canonicalFacts = extractCanonicalAnamnesisEvidence(input)
  const units: ClinicalEvidenceUnit[] = []

  const sameContextNoun = (left: string | null, right: string | null) => {
    if (!left || !right) return false
    const normalize = (value: string) => value
      .toLocaleLowerCase("tr-TR")
      .replace(/[’']/gu, "")
      .replace(/(?:[dt][ae])$/u, "")
      .trim()
    return normalize(left) === normalize(right)
  }

  const factSummary = (domain: DomainKey) => {
    const fact = canonicalFacts.find((entry) => entry.domains.includes(domain) && ["DIFFICULTY", "MIXED"].includes(entry.direction))
    if (!fact) return null
    const task = fact.functional_context.task
    const environment = fact.functional_context.environment
    const setting = [environment, task && !sameContextNoun(environment, task) ? `${task} sırasında` : null].filter(Boolean).join(" ")
    return setting
      ? `Bakım veren, ${setting} ${DOMAIN_LABEL[domain]} ile ilişkili güçlük bildirmektedir.`
      : `Bakım veren, ${DOMAIN_LABEL[domain]} ile ilişkili günlük işlev güçlüğü bildirmektedir.`
  }

  const supportedPerformance = canonicalFacts.find((entry) => ["PRESERVED", "MIXED"].includes(entry.direction)
    && (entry.functional_context.support || entry.functional_context.outcome || entry.functional_context.task))
  const contextualSummary = supportedPerformance
    ? [
        supportedPerformance.functional_context.support ? "görsel veya yapılandırılmış destek verildiğinde" : null,
        supportedPerformance.functional_context.task ? `${supportedPerformance.functional_context.task} sırasında` : null,
      ].filter(Boolean).join(" ")
    : ""

  for (const domain of domains.slice(0, 4)) {
    const tags = candidateTagsForDomain(domain)
    units.push(createUnit({
      id: `evidence.anamnesis.${domain}`,
      sourceType: "CAREGIVER_REPORT",
      domain,
      construct: domain,
      finding: factSummary(domain) ?? `${DOMAIN_LABEL[domain]} alanıyla ilişkili günlük işlev güçlüğü bakım veren anlatısında bildirilmektedir.`,
      direction: "SUPPORTS",
      strength: referral && DOMAIN_PATTERNS[domain].test(referral) ? 3 : 2,
      reliability: 2,
      specificity: referral ? 2 : 1,
      context: contexts,
      supports: tags,
      contradicts: [],
      limits: [],
      provenance: { sourceRef: "anamnesis.caregiver", ruleId: `report-v2.anamnesis-domain.${domain}`, inputHash: stableHash(referral || text) },
    }))
  }

  if (therapist) {
    const therapistDomains = domainsForText(therapist)
    const observationDomains: Array<DomainKey | null> = therapistDomains.length ? therapistDomains : domains.length ? domains.slice(0, 1) : [null]
    for (const domain of observationDomains) {
      units.push(createUnit({
        id: `evidence.observation.${domain ?? "global"}`,
        sourceType: "THERAPIST_OBSERVATION",
        domain,
        construct: domain ?? "functional_performance",
        finding: domain ? `${DOMAIN_LABEL[domain]} alanındaki performansın görev veya destek koşuluna göre değiştiği terapist gözleminde bildirilmiştir.` : "Görev performansına ilişkin doğrudan terapist gözlemi bulunmaktadır; alan eşleştirmesi için ek gözlem gerekir.",
        direction: "SUPPORTS",
        strength: 2,
        reliability: 3,
        specificity: 3,
        context: CONTEXT_PATTERNS.filter(([, pattern]) => pattern.test(therapist)).map(([label]) => label),
        supports: domain ? candidateTagsForDomain(domain) : [],
        contradicts: [],
        limits: [],
        provenance: { sourceRef: therapistObservation.sourceRef, ruleId: `report-v2.observation-domain.${domain ?? "global"}`, inputHash: stableHash(therapist) },
      }))
    }
  }

  if (strengths) {
    const preservedDomains = domainsForText(strengths)
    units.push(createUnit({
      id: "evidence.preserved-capacity.reported",
      sourceType: "PRESERVED_CAPACITY",
      domain: preservedDomains[0] ?? null,
      construct: preservedDomains[0] ?? "functional_capacity",
      finding: contextualSummary
        ? `${contextualSummary[0]!.toLocaleUpperCase("tr-TR")}${contextualSummary.slice(1)} performansın sürdürülebildiği bildirilmektedir.`
        : "Yapılandırılmış veya desteklenen koşullarda korunmuş kapasite bildirilmektedir.",
      direction: "LIMITS",
      strength: 2,
      reliability: 2,
      specificity: preservedDomains.length ? 2 : 1,
      context: CONTEXT_PATTERNS.filter(([, pattern]) => pattern.test(strengths)).map(([label]) => label),
      supports: [],
      contradicts: [],
      limits: unique(domains.flatMap(candidateTagsForDomain)),
      provenance: { sourceRef: "anamnesis.preserved_capacity", ruleId: "report-v2.preserved-capacity", inputHash: stableHash(strengths) },
    }))
  }

  if (contexts.length) {
    units.push(createUnit({
      id: "evidence.contextual.modifiers",
      sourceType: "CONTEXTUAL_EVIDENCE",
      domain: null,
      construct: "context",
      finding: contextualSummary
        ? `${contextualSummary[0]!.toLocaleUpperCase("tr-TR")}${contextualSummary.slice(1)} performans daha iyi olsa da diğer koşullarda güçlüğün belirginleşebildiği bildirilmektedir.`
        : "Performansın görev, destek veya çevre koşullarına göre değişebildiğine ilişkin bağlamsal veri bulunmaktadır.",
      direction: "LIMITS",
      strength: 2,
      reliability: therapist ? 3 : 2,
      specificity: 2,
      context: contexts,
      supports: [],
      contradicts: [],
      limits: unique(domains.flatMap(candidateTagsForDomain)),
      provenance: { sourceRef: "anamnesis.context", ruleId: "report-v2.context-modifier", inputHash: stableHash(contexts) },
    }))
  }
  return units
}

function externalUnits(input: ReportInput, analysis: ExternalTestAnalysis): ClinicalEvidenceUnit[] {
  return analysis.matches.map((match) => {
    const candidates = categoryCandidates(match.category)
    const domain = externalDomains(match.category)[0] ?? null
    const preserved = match.resultDirection === "expected_or_preserved"
    const directionKnown = match.resultDirection === "elevated_or_low" || preserved
    const comparable = match.ageCompatible === true && match.resultQuality === "interpretable" && directionKnown
    const direction: EvidenceDirection = !comparable ? "NEUTRAL" : preserved ? "LIMITS" : "SUPPORTS"
    return createUnit({
      id: `evidence.external.${match.id}`,
      sourceType: "EXTERNAL_ASSESSMENT",
      domain,
      construct: match.category,
      finding: !comparable
        ? `${match.name} yaş veya sonuç yorumlanabilirliği nedeniyle ana kararı desteklemeyen sınırlı dış kanıttır.`
        : preserved
        ? `${match.name} korunmuş/beklenen sonuç yönüyle yorumu sınırlayan dış kanıttır.`
        : `${match.name} ilgili değerlendirme alanında yorumlanabilir dış kanıt sağlamaktadır.`,
      direction,
      strength: match.externalEvidenceWeight >= 80 ? 3 : match.externalEvidenceWeight >= 45 ? 2 : 1,
      reliability: comparable ? 3 : match.resultDirection === "mixed_or_contextual" && match.ageCompatible !== false ? 2 : 1,
      specificity: match.externalEvidenceWeight >= 60 ? 3 : 2,
      context: [],
      supports: direction === "SUPPORTS" ? candidates : [],
      contradicts: [],
      limits: direction === "LIMITS" ? candidates : [],
      provenance: { sourceRef: `external.${match.id}`, ruleId: "report-v2.external-structured", inputHash: stableHash([match.id, match.reportedResult, match.reportedInterpretation]) },
    })
  })
}

function missingInformationUnits(input: ReportInput, external: ExternalTestAnalysis): ClinicalEvidenceUnit[] {
  const text = normalizedAnamnesis(input)
  const therapistObservation = extractCanonicalTherapistObservation(input)
  const missing: Array<[string, string]> = []
  if (!text) missing.push(["anamnesis", "Anamnez bulunmadığı için bağlamsal yorum sınırlıdır."])
  if (!therapistObservation.present) missing.push(["observation", "Terapist gözlemi bulunmadığı için doğal görev performansına genelleme sınırlıdır."])
  if (!external.matches.length) missing.push(["external", "Yorumlanabilir dış değerlendirme bulunmadığı için bağımsız test yakınsaması değerlendirilemez."])
  return missing.map(([key, finding]) => createUnit({
    id: `evidence.missing.${key}`,
    sourceType: "MISSING_INFORMATION",
    domain: null,
    construct: key,
    finding,
    direction: "LIMITS",
    strength: 2,
    reliability: 3,
    specificity: 2,
    context: [],
    supports: [],
    contradicts: [],
    limits: [],
    provenance: { sourceRef: `missing.${key}`, ruleId: "report-v2.missing-information" },
  }))
}

function relationFor(left: ClinicalEvidenceUnit, right: ClinicalEvidenceUnit): EvidenceRelationType {
  const externalDirectionUnknown = [left, right].some((unit) => unit.sourceType === "EXTERNAL_ASSESSMENT" && unit.direction === "NEUTRAL")
  if (externalDirectionUnknown) return "INSUFFICIENT"
  const contextualSources = new Set<EvidenceSourceType>(["CONTEXTUAL_EVIDENCE", "PRESERVED_CAPACITY"])
  const contextual = contextualSources.has(left.sourceType) ? left : contextualSources.has(right.sourceType) ? right : null
  const focal = contextual === left ? right : contextual === right ? left : null
  const contextualCandidateOverlap = Boolean(contextual && focal && contextual.limits.some((id) => focal.supports.includes(id)))
  if (contextual && focal?.direction === "SUPPORTS" && (contextualCandidateOverlap || (contextual.domain != null && contextual.domain === focal.domain))) return "CONTEXTUAL_MODULATION"
  if (left.reliability === 1 || right.reliability === 1) return "INSUFFICIENT"
  const sameConstruct = left.construct === right.construct || (left.domain != null && left.domain === right.domain)
  if (!sameConstruct) {
    const shared = left.supports.some((candidate) => right.supports.includes(candidate))
    return shared ? "COMPLEMENTARY" : "NOT_COMPARABLE"
  }
  const positive = (value: EvidenceDirection) => value === "SUPPORTS"
  const negative = (value: EvidenceDirection) => value === "LIMITS" || value === "CONTRADICTS"
  if ((positive(left.direction) && negative(right.direction)) || (negative(left.direction) && positive(right.direction))) return "DISCREPANT"
  if (left.direction === right.direction) return "CONVERGENT"
  if (left.direction === "NEUTRAL" || right.direction === "NEUTRAL") return "PARTIALLY_CONVERGENT"
  return "COMPLEMENTARY"
}

function buildRelations(units: readonly ClinicalEvidenceUnit[]): ClinicalEvidenceRelation[] {
  const relations: ClinicalEvidenceRelation[] = []
  for (let leftIndex = 0; leftIndex < units.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < units.length; rightIndex += 1) {
      const left = units[leftIndex]
      const right = units[rightIndex]
      if (left.sourceType === right.sourceType) continue
      const type = relationFor(left, right)
      if (type === "NOT_COMPARABLE" && left.domain !== right.domain) continue
      relations.push(Object.freeze({
        id: `relation.${left.id}.${right.id}`,
        leftEvidenceId: left.id,
        rightEvidenceId: right.id,
        type,
        discrepancyClusterId: null,
        rationale: type === "DISCREPANT"
          ? "Aynı construct veya alan için yeterli güvenilirlikte zıt yönlü bulgular vardır."
          : type === "CONVERGENT"
          ? "Bağımsız kaynaklar aynı construct ve yön üzerinde yakınsamaktadır."
          : type === "INSUFFICIENT"
          ? "Kaynaklardan en az biri karşılaştırma için yetersizdir."
          : type === "CONTEXTUAL_MODULATION"
          ? "Destekli veya yapılandırılmış koşuldaki daha iyi performans, güçlüğü çürütmez; örüntünün bağlama duyarlı olduğunu gösterir."
          : "Kaynaklar kısmen örtüşen veya tamamlayıcı bilgi sağlamaktadır.",
      }))
    }
  }
  return relations
}

function buildDiscrepancyClusters(units: readonly ClinicalEvidenceUnit[], relations: readonly ClinicalEvidenceRelation[]): Readonly<{
  clusters: readonly ClinicalDiscrepancyCluster[]
  relations: readonly ClinicalEvidenceRelation[]
}> {
  const discrepant = relations.filter((relation) => relation.type === "DISCREPANT")
  const adjacency = new Map<string, Set<string>>()
  for (const relation of discrepant) {
    if (!adjacency.has(relation.leftEvidenceId)) adjacency.set(relation.leftEvidenceId, new Set())
    if (!adjacency.has(relation.rightEvidenceId)) adjacency.set(relation.rightEvidenceId, new Set())
    adjacency.get(relation.leftEvidenceId)!.add(relation.rightEvidenceId)
    adjacency.get(relation.rightEvidenceId)!.add(relation.leftEvidenceId)
  }
  const visited = new Set<string>()
  const components: string[][] = []
  for (const start of [...adjacency.keys()].sort()) {
    if (visited.has(start)) continue
    const queue = [start]
    const component: string[] = []
    visited.add(start)
    while (queue.length) {
      const current = queue.shift()!
      component.push(current)
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue
        visited.add(next)
        queue.push(next)
      }
    }
    components.push(component.sort())
  }
  const unitMap = new Map(units.map((unit) => [unit.id, unit]))
  const clusters = components.map((evidenceIds, index) => {
    const evidenceSet = new Set(evidenceIds)
    const clusterRelations = discrepant.filter((relation) => evidenceSet.has(relation.leftEvidenceId) && evidenceSet.has(relation.rightEvidenceId))
    const clusterUnits = evidenceIds.map((id) => unitMap.get(id)).filter(Boolean) as ClinicalEvidenceUnit[]
    const domains = unique(clusterUnits.map((unit) => unit.domain).filter((domain): domain is DomainKey | "global" => domain != null))
    const constructs = unique(clusterUnits.map((unit) => unit.construct))
    const id = `discrepancy.${domains[0] ?? "cross-domain"}.${String(index + 1).padStart(2, "0")}`
    const hard = clusterRelations.some((relation) => {
      const left = unitMap.get(relation.leftEvidenceId)
      const right = unitMap.get(relation.rightEvidenceId)
      return Boolean(left && right && left.reliability >= 2 && right.reliability >= 2 && left.strength >= 2 && right.strength >= 2)
    })
    return Object.freeze({
      id,
      domain: domains.length === 1 ? domains[0] : null,
      construct: constructs.length === 1 ? constructs[0] : domains.length === 1 ? String(domains[0]) : "cross_source",
      evidenceIds: Object.freeze(evidenceIds),
      relationIds: Object.freeze(clusterRelations.map((relation) => relation.id)),
      sourceTypes: Object.freeze(unique(clusterUnits.map((unit) => unit.sourceType))),
      hard,
    })
  })
  const relationToCluster = new Map(clusters.flatMap((cluster) => cluster.relationIds.map((relationId) => [relationId, cluster.id] as const)))
  return Object.freeze({
    clusters: Object.freeze(clusters),
    relations: Object.freeze(relations.map((relation) => Object.freeze({ ...relation, discrepancyClusterId: relationToCluster.get(relation.id) ?? null }))),
  })
}

export function buildClinicalEvidenceMatrix(input: ReportInput, v1DomainResults: readonly DomainResult[], totalScore: number, globalLevel: DomainLevel): Readonly<{
  matrix: ClinicalEvidenceMatrix
  externalAnalysis: ExternalTestAnalysis
}> {
  const anamnesis = normalizedAnamnesis(input)
  const externalAnalysis = analyzeExternalClinicalTests(normalizedExternalFindingLayout(anamnesis), input.ageMonths)
  const totalUnit = createUnit({
    id: "evidence.total-score",
    sourceType: "DNA_TOTAL_SCORE",
    domain: "global",
    construct: "global_regulation",
    finding: `Toplam skor ${totalScore}/300 ve genel sınıflama ${globalLevel} olarak hesaplandı.`,
    direction: globalLevel === "Tipik" ? "LIMITS" : "SUPPORTS",
    strength: globalLevel === "Atipik" ? 3 : 2,
    reliability: 3,
    specificity: 2,
    context: [],
    supports: globalLevel === "Tipik" ? ["balanced"] : ["multi_domain"],
    contradicts: [],
    limits: globalLevel === "Tipik" ? ["multi_domain"] : [],
    provenance: { sourceRef: "score.total", ruleId: "dna-polarity-v2.total-band" },
  })
  const units = [
    totalUnit,
    ...domainScoreUnits(v1DomainResults),
    ...itemPatternUnits(input, v1DomainResults),
    ...anamnesisUnits(input),
    ...externalUnits(input, externalAnalysis),
    ...missingInformationUnits(input, externalAnalysis),
  ]
  const clustered = buildDiscrepancyClusters(units, buildRelations(units))
  const sourceCoverage = Object.fromEntries(ALL_SOURCES.map((source) => [source, units.filter((unit) => unit.sourceType === source).length])) as Record<EvidenceSourceType, number>
  return Object.freeze({
    matrix: Object.freeze({ version: "clinical-evidence-matrix@2.1", units: Object.freeze(units), relations: clustered.relations, discrepancyClusters: clustered.clusters, sourceCoverage: Object.freeze(sourceCoverage) }),
    externalAnalysis,
  })
}

function candidateScore(id: FormulationId, matrix: ClinicalEvidenceMatrix): CandidateFormulation {
  const supporting = id === "balanced"
    ? matrix.units.filter((unit) => (unit.sourceType === "DNA_TOTAL_SCORE" || unit.sourceType === "DNA_DOMAIN_SCORE") && unit.direction === "LIMITS")
    : matrix.units.filter((unit) => unit.supports.includes(id) && unit.direction === "SUPPORTS")
  const contradictory = matrix.units.filter((unit) => unit.contradicts.includes(id) || (unit.supports.includes(id) && unit.direction === "CONTRADICTS"))
  const limiting = matrix.units.filter((unit) => unit.limits.includes(id) || (unit.supports.includes(id) && unit.direction === "LIMITS"))
  const preserved = limiting.filter((unit) => unit.sourceType === "PRESERVED_CAPACITY" || unit.sourceType === "DNA_DOMAIN_SCORE")
  const penalizedLimitations = limiting.filter((unit) => unit.sourceType !== "PRESERVED_CAPACITY" && unit.sourceType !== "CONTEXTUAL_EVIDENCE")
  const score = supporting.reduce((sum, unit) => sum + evidenceWeight(unit), 0)
    - contradictory.reduce((sum, unit) => sum + evidenceWeight(unit), 0)
    - penalizedLimitations.reduce((sum, unit) => sum + evidenceWeight(unit) * 0.5, 0)
  const independentSourceTypes = unique(supporting.map((unit) => unit.sourceType))
  const independentSourceFamilies = unique(supporting.map((unit) => sourceFamily(unit.sourceType)))
  const functionalEvidenceIds = supporting.filter((unit) => FUNCTIONAL_SOURCES.has(unit.sourceType)).map((unit) => unit.id)
  const hasScore = supporting.some((unit) => unit.sourceType === "DNA_DOMAIN_SCORE" || unit.sourceType === "DNA_TOTAL_SCORE")
  const candidateEvidenceIds = new Set([...supporting, ...limiting, ...contradictory].map((unit) => unit.id))
  const relationContradiction = matrix.discrepancyClusters.some((cluster) => cluster.hard && cluster.evidenceIds.every((id) => candidateEvidenceIds.has(id)))
  const hardContradiction = contradictory.some((unit) => unit.strength >= 2 && unit.reliability >= 2) || relationContradiction
  const eligibleForPrimary = !hardContradiction && (independentSourceFamilies.length >= 2 || (hasScore && functionalEvidenceIds.length > 0))
  const fit = score >= 24 && eligibleForPrimary ? "HIGH" : score >= 12 ? "MODERATE" : "LOW"
  return Object.freeze({
    id,
    supportingEvidenceIds: Object.freeze(supporting.map((unit) => unit.id)),
    contradictoryEvidenceIds: Object.freeze(contradictory.map((unit) => unit.id)),
    limitingEvidenceIds: Object.freeze(limiting.map((unit) => unit.id)),
    preservedCapacityEvidenceIds: Object.freeze(preserved.map((unit) => unit.id)),
    independentSourceTypes: Object.freeze(independentSourceTypes),
    functionalEvidenceIds: Object.freeze(functionalEvidenceIds),
    overallEvidenceScore: Number(score.toFixed(2)),
    fit,
    hardContradiction,
    eligibleForPrimary,
  })
}

function combineAsMultiDomain(top: CandidateFormulation, runnerUp: CandidateFormulation): CandidateFormulation {
  const supportingEvidenceIds = unique([...top.supportingEvidenceIds, ...runnerUp.supportingEvidenceIds])
  const contradictoryEvidenceIds = unique([...top.contradictoryEvidenceIds, ...runnerUp.contradictoryEvidenceIds])
  const limitingEvidenceIds = unique([...top.limitingEvidenceIds, ...runnerUp.limitingEvidenceIds])
  const preservedCapacityEvidenceIds = unique([...top.preservedCapacityEvidenceIds, ...runnerUp.preservedCapacityEvidenceIds])
  const independentSourceTypes = unique([...top.independentSourceTypes, ...runnerUp.independentSourceTypes])
  const functionalEvidenceIds = unique([...top.functionalEvidenceIds, ...runnerUp.functionalEvidenceIds])
  const score = Number(((top.overallEvidenceScore + runnerUp.overallEvidenceScore) / 2).toFixed(2))
  return Object.freeze({
    id: "multi_domain",
    supportingEvidenceIds: Object.freeze(supportingEvidenceIds),
    contradictoryEvidenceIds: Object.freeze(contradictoryEvidenceIds),
    limitingEvidenceIds: Object.freeze(limitingEvidenceIds),
    preservedCapacityEvidenceIds: Object.freeze(preservedCapacityEvidenceIds),
    independentSourceTypes: Object.freeze(independentSourceTypes),
    functionalEvidenceIds: Object.freeze(functionalEvidenceIds),
    overallEvidenceScore: score,
    fit: score >= 24 ? "HIGH" : score >= 12 ? "MODERATE" : "LOW",
    hardContradiction: false,
    eligibleForPrimary: true,
  })
}

export function buildCandidateFormulations(matrix: ClinicalEvidenceMatrix, domainResults: readonly DomainResult[], globalLevel: DomainLevel): Readonly<{
  candidates: readonly CandidateFormulation[]
  decisionState: ClinicalDecisionState
  primary: CandidateFormulation | null
  secondary: readonly CandidateFormulation[]
  alternatives: readonly CandidateFormulation[]
}> {
  const discovered = unique(matrix.units.flatMap((unit) => [...unit.supports, ...unit.contradicts, ...unit.limits]))
    .filter((id): id is FormulationId => id !== "balanced")
  const candidateIds = unique<FormulationId>([...discovered, ...domainResults.map((domain) => DOMAIN_CANDIDATE[domain.key as DomainKey]), "balanced", "multi_domain"])
  let candidates = candidateIds.map((id) => candidateScore(id, matrix)).sort((left, right) => right.overallEvidenceScore - left.overallEvidenceScore || left.id.localeCompare(right.id))
  const allTypical = domainResults.every((domain) => domain.level === "Tipik")
  const strongExternalConcern = matrix.units.some((unit) => unit.sourceType === "EXTERNAL_ASSESSMENT" && unit.direction === "SUPPORTS" && unit.reliability >= 2)
  let primary: CandidateFormulation | null = null
  if (allTypical && !strongExternalConcern) {
    primary = candidates.find((candidate) => candidate.id === "balanced") ?? null
  } else {
    const eligible = candidates.filter((candidate) => candidate.eligibleForPrimary && candidate.id !== "balanced" && candidate.id !== "multi_domain" && candidate.overallEvidenceScore >= 12)
    const top = eligible[0]
    const runnerUp = eligible[1]
    if (top && runnerUp && top.overallEvidenceScore - runnerUp.overallEvidenceScore <= Math.max(5, Math.abs(top.overallEvidenceScore) * 0.15)) {
      primary = combineAsMultiDomain(top, runnerUp)
      candidates = [primary, ...candidates.filter((candidate) => candidate.id !== "multi_domain")].sort((left, right) => right.overallEvidenceScore - left.overallEvidenceScore || left.id.localeCompare(right.id))
    } else if (top) {
      primary = top
    }
  }
  const decisionState: ClinicalDecisionState = primary ? "FORMULATED" : "UNCERTAIN"
  const primaryScore = primary?.overallEvidenceScore ?? 0
  const secondary = primary
    ? candidates.filter((candidate) => candidate.id !== primary.id && candidate.eligibleForPrimary && candidate.id !== "balanced" && candidate.id !== "multi_domain" && candidate.overallEvidenceScore >= Math.max(8, primaryScore * 0.7)).slice(0, 2)
    : []
  const alternatives = candidates.filter((candidate) => candidate.id !== primary?.id && !secondary.some((item) => item.id === candidate.id) && candidate.id !== "multi_domain" && (candidate.hardContradiction || candidate.overallEvidenceScore > 0)).slice(0, 2)
  return Object.freeze({ candidates: Object.freeze(candidates), decisionState, primary, secondary: Object.freeze(secondary), alternatives: Object.freeze(alternatives) })
}

function confidenceLevel(score: number): ConfidenceBreakdown["level"] {
  return score >= 80 ? "HIGH" : score >= 65 ? "MODERATE_HIGH" : score >= 45 ? "MODERATE" : "LOW"
}

function confidenceDimension(score: number, positiveFactors: string[], negativeFactors: string[]) {
  const bounded = Math.max(0, Math.min(100, Math.round(score)))
  return Object.freeze({ level: confidenceLevel(bounded), score: bounded, positiveFactors: Object.freeze(positiveFactors), negativeFactors: Object.freeze(negativeFactors) })
}

export function buildConfidence(matrix: ClinicalEvidenceMatrix, primary: CandidateFormulation | null, decisionState: ClinicalDecisionState): ConfidenceBreakdown {
  const completenessPositive: string[] = []
  const completenessNegative: string[] = []
  const availableSourceFamilies = unique(matrix.units.filter((unit) => unit.sourceType !== "MISSING_INFORMATION").map((unit) => sourceFamily(unit.sourceType))).length
  const missing = matrix.sourceCoverage.MISSING_INFORMATION
  let completenessScore = 35 + Math.min(45, availableSourceFamilies * 8) - Math.min(30, missing * 10)
  if (availableSourceFamilies >= 4) completenessPositive.push("Değerlendirme birden fazla bağımsız bilgi kanalını içermektedir.")
  if (missing) completenessNegative.push(`${missing} önemli bilgi kanalı eksiktir.`)
  const evidenceCompleteness = confidenceDimension(completenessScore, completenessPositive, completenessNegative)

  const consistencyPositive: string[] = []
  const consistencyNegative: string[] = []
  const convergenceGroups = unique(matrix.relations.filter((relation) => relation.type === "CONVERGENT").map((relation) => {
    const left = matrix.units.find((unit) => unit.id === relation.leftEvidenceId)
    const right = matrix.units.find((unit) => unit.id === relation.rightEvidenceId)
    return left?.domain ?? right?.domain ?? left?.construct ?? right?.construct ?? relation.id
  })).length
  const discrepancyClusters = matrix.discrepancyClusters.length
  const contextualModulations = matrix.relations.filter((relation) => relation.type === "CONTEXTUAL_MODULATION").length
  let consistencyScore = 50 + Math.min(25, convergenceGroups * 5) - Math.min(40, discrepancyClusters * 15)
  if (convergenceGroups) consistencyPositive.push("Bağımsız kaynaklar en az bir klinik alanda aynı yönde yakınsamaktadır.")
  if (contextualModulations) consistencyPositive.push("Destekli koşullardaki daha iyi performans bağlamsal değişkenlik olarak korunmuştur.")
  if (discrepancyClusters) consistencyNegative.push(`${discrepancyClusters} bağımsız klinik ayrışma kümesi bulunmaktadır.`)
  const evidenceConsistency = confidenceDimension(consistencyScore, consistencyPositive, consistencyNegative)

  const formulationPositive: string[] = []
  const formulationNegative: string[] = []
  let formulationScore = decisionState === "UNCERTAIN" || !primary ? 25 : 40
  if (!primary) {
    formulationNegative.push("Mevcut adaylardan hiçbiri kabul eşiğini ve bağımsız kanıt koşulunu birlikte karşılamamıştır.")
  } else {
    const sourceCount = unique(primary.independentSourceTypes.map(sourceFamily)).length
    if (sourceCount >= 3) { formulationScore += 25; formulationPositive.push("En az üç bağımsız bilgi kanalı aynı klinik örüntüyü desteklemektedir.") }
    else if (sourceCount === 2) { formulationScore += 15; formulationPositive.push("İki bağımsız bilgi kanalı aynı klinik örüntüyü desteklemektedir.") }
    else { formulationScore -= 15; formulationNegative.push("Klinik örüntü tek bilgi kanalı ağırlıklıdır.") }
    if (primary.functionalEvidenceIds.length) { formulationScore += 10; formulationPositive.push("Örüntünün günlük işleve yansıyan karşılığı bulunmaktadır.") }
    else { formulationScore -= 12; formulationNegative.push("Günlük işleve özgü doğrulayıcı veri sınırlıdır.") }
    if (primary.hardContradiction) { formulationScore -= 20; formulationNegative.push("Örüntüyü doğrudan sınırlayan güçlü karşı kanıt bulunmaktadır.") }
  }
  formulationScore += Math.round((evidenceConsistency.score - 50) * 0.35)
  formulationScore += Math.round((evidenceCompleteness.score - 50) * 0.2)
  const formulationConfidence = confidenceDimension(formulationScore, formulationPositive, [...formulationNegative, ...consistencyNegative, ...completenessNegative])
  return Object.freeze({
    evidenceCompleteness,
    evidenceConsistency,
    formulationConfidence,
    level: formulationConfidence.level,
    score: formulationConfidence.score,
    positiveFactors: formulationConfidence.positiveFactors,
    negativeFactors: formulationConfidence.negativeFactors,
  })
}

function comparisonStatusForExternal(matchId: string, matrix: ClinicalEvidenceMatrix): EvidenceRelationType {
  const evidenceId = `evidence.external.${matchId}`
  const relevant = matrix.relations.filter((relation) => relation.leftEvidenceId === evidenceId || relation.rightEvidenceId === evidenceId)
  return relevant.find((relation) => relation.type === "DISCREPANT")?.type
    ?? relevant.find((relation) => relation.type === "CONVERGENT")?.type
    ?? relevant.find((relation) => relation.type === "CONTEXTUAL_MODULATION")?.type
    ?? relevant.find((relation) => relation.type === "PARTIALLY_CONVERGENT")?.type
    ?? relevant.find((relation) => relation.type === "INSUFFICIENT")?.type
    ?? "NOT_COMPARABLE"
}

export function structureExternalAssessments(analysis: ExternalTestAnalysis, matrix: ClinicalEvidenceMatrix, primary: CandidateFormulation | null): StructuredExternalAssessment[] {
  const ranked = analysis.matches.map((match) => {
    const candidates = categoryCandidates(match.category)
    const formulationBonus = primary && candidates.includes(primary.id) ? 30 : 0
    const relevanceToDna = Math.max(0, Math.min(100, match.externalEvidenceWeight + formulationBonus - (match.ageCompatible === false ? 60 : 0)))
    return { match, relevanceToDna }
  }).sort((left, right) => right.relevanceToDna - left.relevanceToDna || left.match.id.localeCompare(right.match.id))
  const selectedId = ranked.find((entry) => entry.match.ageCompatible === true && entry.match.resultQuality === "interpretable" && entry.match.resultDirection !== "unclear")?.match.id ?? null
  return ranked.map(({ match, relevanceToDna }) => Object.freeze({
    id: match.id,
    testName: match.name,
    construct: match.category,
    source: match.sourceTitle,
    result: match.resultDirection === "elevated_or_low"
      ? "Klinik dikkat gerektiren sonuç yönü"
      : match.resultDirection === "expected_or_preserved"
      ? "Beklenen veya korunmuş sonuç yönü"
      : match.resultDirection === "mixed_or_contextual"
      ? "Karma veya bağlama duyarlı sonuç yönü"
      : "Sonuç yönü belirsiz",
    interpretation: "İlgili işlev alanına ilişkin yapılandırılmış dış test kanıtı.",
    ageAppropriateness: match.ageCompatible === true ? "VALID" : match.ageCompatible === false ? "INVALID" : "UNKNOWN",
    relevanceToDna,
    relevantDomains: Object.freeze(externalDomains(match.category)),
    comparisonStatus: comparisonStatusForExternal(match.id, matrix),
    limitations: Object.freeze([
      ...(match.ageCompatible === false ? ["Yaş aralığı uyumsuz."] : []),
      ...(match.resultQuality !== "interpretable" ? ["Sonuç klinik karar ağırlığı için sınırlı."] : []),
      match.interpretationBoundaries,
    ].filter(Boolean)),
    selectedForDecision: match.id === selectedId,
  }))
}

export function buildDomainThresholdTrace(input: ReportInput, domainResults: readonly DomainResult[]): string[] {
  const band = findAgeNormBand(input.ageMonths)
  if (!band) return ["Yaş bandı bulunmadığı için fallback_fixed eşikleri kullanıldı."]
  return domainResults.map((domain) => {
    const thresholds = band.domains[domain.key as DomainKey]
    return `${domain.key}: score=${domain.score}; atypical<=${thresholds.atypicalMax}; risk<=${thresholds.riskMax}; level=${domain.level}`
  })
}

export { stableHash, normalizedAnamnesis }
