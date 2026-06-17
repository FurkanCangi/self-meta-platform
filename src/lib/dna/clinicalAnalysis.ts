import type { ExternalTestCategory } from "./externalTestRegistry"
import type { ReportAuditTrail, ReportTrace, ReportVersionMeta } from "./reportTrace"
import type { DomainResult } from "./reportEngine"

export type ClinicalMechanismType =
  | "motor_praxis"
  | "adaptive_daily_living"
  | "social_pragmatic"
  | "language_communication"
  | "language_social_pragmatic"
  | "physiological_interoceptive"
  | "selective_interoception"
  | "evidence_limited_mixed"
  | "default"

export type ClinicalEvidenceMap = {
  globalClassificationNote: string
  primaryClinicalHypothesis: string
  primaryAxis: string
  primaryAxisKind?: "domain" | "mechanism" | "balanced"
  clinicalMechanism?: ClinicalMechanismType
  mechanismLabel?: string
  mechanismSummary?: string
  secondaryAxes: string[]
  anamnesisEvidence: string[]
  therapistObservationEvidence: string[]
  externalTestSupport: string[]
  caseEvidenceLines: string[]
  dataLimitations: string[]
  confidenceLevel: "yüksek" | "orta" | "sınırlı"
  confidenceRationale: string
}

export type ClinicalAnalysis = {
  totalScore:number
  ageBandLabel?: string | null
  profileType:string
  globalLevel:string
  priorityDomains:string[]
  domainSummary:Record<string,string>
  domainScoreSummary: Record<string, { score: number; level: string }>
  anamnezThemes:string[]
  weakDomains:string[]
  strongDomains:string[]
  matchedDomains:string[]
  patternSummary:string
  primaryWeakDomain:string
  preservedDomainSummary:string
  contrastSummary:string
  anamnezConsistency:string
  therapistInsights?: string[]
  externalClinicalFindings?: string[]
  externalClinicalWarnings?: string[]
  externalTestIds?: string[]
  externalTestCategories?: ExternalTestCategory[]
  primaryExternalTestCategory?: ExternalTestCategory | null
  criticalItemLines?: string[]
  alignedItemLines?: string[]
  itemSignalSummary?: string
  qualityFocusMode?: "balanced" | "selective" | "paired" | "widespread"
  qualityPrimaryEvidenceLines?: string[]
  qualitySupportingEvidenceLines?: string[]
  qualityRestraintLines?: string[]
  qualityCautionLines?: string[]
  evidenceMap?: ClinicalEvidenceMap
  classificationNote?: string
  primaryClinicalHypothesis?: string
  primaryClinicalAxis?: string
  secondaryClinicalAxes?: string[]
  caseEvidenceLines?: string[]
  dataLimitations?: string[]
  dataConfidenceLevel?: ClinicalEvidenceMap["confidenceLevel"]
  dataConfidenceRationale?: string
  trace?: ReportTrace
  auditTrail?: ReportAuditTrail
  reportVersionMeta?: ReportVersionMeta
}

function applyInteroPriorityBias(
  domainResults: any[],
  priorityDomains: string[],
  params?: { hasBodyContext?: boolean; primaryExternalTestCategory?: ExternalTestCategory | null }
): string[] {
  const intero = domainResults.find((d) => d.key === "interoception");
  if (!intero) return priorityDomains;
  if (!params?.hasBodyContext && params?.primaryExternalTestCategory !== "adaptive_daily_living") {
    return priorityDomains;
  }

  const interoIsRelevant = intero.level === "Riskli" || intero.level === "Atipik";
  const otherNonTypicalExists = domainResults.some(
    (d) => d.key !== "interoception" && (d.level === "Riskli" || d.level === "Atipik")
  );

  if (!interoIsRelevant || !otherNonTypicalExists) {
    return priorityDomains;
  }

  const interoLabel = intero.label || "İnterosepsiyon";

  if (priorityDomains.includes(interoLabel)) {
    return priorityDomains;
  }

  if (priorityDomains.length === 0) {
    return [interoLabel];
  }

  if (priorityDomains.length === 1) {
    return [interoLabel, priorityDomains[0]];
  }

  return [interoLabel, priorityDomains[0]];
}

function getMatchedDomainLabels(
  domainResults: DomainResult[],
  anamnezFlags: string[],
  therapistInsights: string[] = [],
  externalClinicalFindings: string[] = []
): string[] {
  const joined = [...anamnezFlags, ...therapistInsights, ...externalClinicalFindings].join(" ").toLowerCase()
  const hasExplicitSensoryCue = /duyusal|dokunsal|gürültü|gurultu|kalabalık|kalabalik|ses|çevresel uyaran|cevresel uyaran|tetikleyici çevresel|tetikleyici cevresel|sensory profile|spm|sensory processing/.test(
    joined
  )

  return domainResults
    .filter((d) => {
      if (d.key === "sensory") return hasExplicitSensoryCue
      if (d.key === "emotional") return /duygusal|toparlanma|sakinleş|uyaran sonrası|öfke|frustrasyon|kriz/.test(joined)
      if (d.key === "cognitive") return /dikkat|görev|sürdürme|çok uyaran|dilsel talep|yönerge|celf|pls/.test(joined)
      if (d.key === "executive") return /dikkat|görev|sürdürme|çok uyaran|brief|conners|inhibisyon|planlama|organizasyon|motor planlama|praksi|somatodispraks/.test(joined)
      if (d.key === "physiological" || d.key === "interoception") return /bedensel|fizyolojik|yorgun|uyku|beslenme|iştah|alerji|kolik|nöbet|açlık|aclik|susama|susuz|tuvalet/.test(joined)
      return false
    })
    .sort((a, b) => a.score - b.score)
    .map((d) => d.label)
    .slice(0, 3)
}

function buildPatternSummary(domainResults: DomainResult[], globalLevel: string, weakDomains: string[]): string {
  if (!domainResults.length) {
    return `${globalLevel} düzeyinde, ek örüntü ayrıntısı üretilemedi.`
  }

  if (weakDomains.length === 0) {
    return "Tüm alanlar tipik aralıktadır; belirgin klinik risk odağı veya anlamlı bir ayrışma izlenmemektedir."
  }

  const values = domainResults.map((d) => d.score)
  const spread = Math.max(...values) - Math.min(...values)

  if (spread <= 3) {
    return `${globalLevel} düzeyinde, alanlar arası ayrışması sınırlı ve görece homojen bir profil izlenmektedir.`
  }

  if (weakDomains.length >= 3) {
    return `${weakDomains[0]} alanı belirginleşmekte; ${weakDomains[1]} ve ${weakDomains[2]} alanları bu örüntüye eşlik etmektedir.`
  }

  if (weakDomains.length >= 2) {
    return `${weakDomains[0]} ve ${weakDomains[1]} alanları göreli olarak daha kırılgan görünmektedir.`
  }

  if (weakDomains.length === 1) {
    return `${weakDomains[0]} alanı göreli olarak daha kırılgan görünmektedir.`
  }

  return `${globalLevel} düzeyinde, çok alanlı ancak kısmen ayrışan bir profil izlenmektedir.`
}

function buildPreservedDomainSummary(strongDomains: string[]): string {
  if (strongDomains.length === 0) {
    return "Belirgin biçimde korunmuş bir alan ayrışmamaktadır."
  }

  if (strongDomains.length === 1) {
    return `${strongDomains[0]} alanı göreli olarak daha korunmuş görünmektedir.`
  }

  return `${strongDomains[0]} ve ${strongDomains[1]} alanları göreli olarak daha korunmuş görünmektedir.`
}

function buildContrastSummary(weakDomains: string[], strongDomains: string[]): string {
  if (weakDomains.length === 0 && strongDomains.length === 0) {
    return "Belirgin bir alanlar arası karşıtlık izlenmemektedir."
  }

  if (weakDomains.length === 0) {
    return "Tüm alanlar tipik aralıkta olup belirgin bir kırılganlık-karşıtlık örüntüsü izlenmemektedir."
  }

  if (weakDomains.length > 0 && strongDomains.length > 0) {
    const weakText =
      weakDomains.length >= 2 ? `${weakDomains[0]} ve ${weakDomains[1]}` : weakDomains[0]
    return `${weakText} alanlarındaki kırılganlık, ${strongDomains[0]} alanındaki göreli korunmuşlukla karşıtlık göstermektedir.`
  }

  if (weakDomains.length > 0) {
    return `${weakDomains[0]} alanı diğer alanlara göre daha kırılgan görünmektedir.`
  }

  return `${strongDomains[0]} alanı diğer alanlara göre daha korunmuş görünmektedir.`
}

function buildAnamnezConsistency(
  matchedDomains: string[],
  weakDomains: string[],
  strongDomains: string[]
): string {
  const aligned = matchedDomains.filter((domain) => weakDomains.includes(domain)).slice(0, 2)
  const partial = matchedDomains.filter((domain) => !weakDomains.includes(domain) && !strongDomains.includes(domain)).slice(0, 2)
  const mismatch = matchedDomains.filter((domain) => strongDomains.includes(domain)).slice(0, 2)

  if (aligned.length >= 1 && mismatch.length >= 1) {
    return `${aligned.join(" ve ")} alanlarında doğrudan uyum vardır; buna karşın ${mismatch.join(" ve ")} alanlarına ilişkin anamnez vurgusu ölçekte göreli korunmuş görünmektedir.`
  }

  if (aligned.length >= 2) {
    return `${aligned.join(" ve ")} alanlarında anamnez ile ölçek bulguları doğrudan örtüşmektedir.`
  }

  if (aligned.length === 1 && partial.length > 0) {
    return `${aligned[0]} alanında belirgin uyum vardır; ${partial[0]} alanında ise daha sınırlı ama anlamlı bir eşleşme izlenmektedir.`
  }

  if (aligned.length === 1) {
    return `${aligned[0]} alanında anamnez ile ölçek bulguları belirgin uyum göstermektedir.`
  }

  if (mismatch.length > 0) {
    return `${mismatch[0]} alanına ilişkin anamnez teması bulunmasına karşın ölçek bulguları bu alanda göreli korunmuş görünmektedir.`
  }

  if (partial.length > 0) {
    return `${partial[0]} alanında anamnez ile ölçek bulguları arasında kısmi bir ilişki izlenmektedir.`
  }

  return "Anamnez ile ölçek bulguları arasında sınırlı ama klinik olarak anlamlı bir ilişki izlenmektedir."
}

export function buildClinicalAnalysis(
  domainResults:DomainResult[],
  totalScore:number,
  profileType:string,
  globalLevel:string,
  anamnezFlags:string[],
  therapistInsights:string[] = [],
  ageBandLabel?: string | null,
  externalClinicalFindings:string[] = [],
  externalClinicalWarnings:string[] = [],
  externalTestIds:string[] = [],
  externalTestCategories:ExternalTestCategory[] = [],
  primaryExternalTestCategory:ExternalTestCategory | null = null,
  itemLevelAnalysis?: {
    criticalLines?: string[]
    alignedLines?: string[]
    signalSummary?: string
  }
):ClinicalAnalysis{
const sortedAsc = [...domainResults].sort((a,b)=>a.score-b.score)
const nonTypicalSorted = sortedAsc.filter(d => d.level !== "Tipik")
const weakDomains = nonTypicalSorted
  .slice(0,3)
  .map(d=>d.label)
const typicalDomains = domainResults.filter((d) => d.level === "Tipik")
const strongDomains = [...(typicalDomains.length ? typicalDomains : [])]
  .sort((a,b)=>b.score-a.score)
  .slice(0,2)
  .map(d=>d.label)
const priority = weakDomains.slice(0,2)

const domainSummary:Record<string,string> = {}
const domainScoreSummary: Record<string, { score: number; level: string }> = {}

for(const d of domainResults){
domainSummary[d.label] = d.level
domainScoreSummary[d.label] = { score: d.score, level: d.level }
}

const matchedDomains = getMatchedDomainLabels(domainResults, anamnezFlags, therapistInsights, externalClinicalFindings)

return{
totalScore,
ageBandLabel,
profileType,
globalLevel,
priorityDomains: applyInteroPriorityBias(domainResults, priority, {
  hasBodyContext: /bedensel|fizyolojik|yorgun|uyku|beslenme|iştah|açlık|aclik|susama|susuz|tuvalet/.test(
    [...anamnezFlags, ...therapistInsights, ...externalClinicalFindings].join(" ").toLowerCase()
  ),
  primaryExternalTestCategory,
}),
domainSummary,
domainScoreSummary,
anamnezThemes:anamnezFlags.slice(0,3),
weakDomains,
strongDomains,
matchedDomains,
patternSummary: buildPatternSummary(domainResults, globalLevel, weakDomains),
primaryWeakDomain: weakDomains[0] || "Tipik aralıkta belirgin birincil kırılgan alan ayrışmıyor",
preservedDomainSummary: buildPreservedDomainSummary(strongDomains),
contrastSummary: buildContrastSummary(weakDomains, strongDomains),
anamnezConsistency: buildAnamnezConsistency(matchedDomains, weakDomains, strongDomains),
therapistInsights: therapistInsights.slice(0, 3),
externalClinicalFindings: externalClinicalFindings.slice(0, 3),
externalClinicalWarnings: externalClinicalWarnings.slice(0, 3),
externalTestIds: externalTestIds.slice(0, 6),
externalTestCategories: externalTestCategories.slice(0, 4),
primaryExternalTestCategory,
criticalItemLines: itemLevelAnalysis?.criticalLines?.slice(0, 3) || [],
alignedItemLines: itemLevelAnalysis?.alignedLines?.slice(0, 3) || [],
itemSignalSummary: itemLevelAnalysis?.signalSummary || "",
}

}
