import type {
  ClinicalDiscrepancyCluster,
  ClinicalEvidenceMatrix,
  ClinicalEvidenceUnit,
  ReportRealization,
  ReportSectionId,
} from "./contracts"

export type ClinicalSemanticPolarity =
  | "DIFFICULTY_PRESENT"
  | "NO_DIFFICULTY_REPORTED"
  | "PRESERVED"
  | "IMPAIRED"
  | "CONVERGENT"
  | "DISCREPANT"
  | "SUPPORTED"
  | "INSUFFICIENT"
  | "TYPICAL"
  | "CLINICALLY_SIGNIFICANT_DIFFICULTY"
  | "NO_FUNCTIONAL_IMPACT"
  | "FUNCTIONAL_IMPACT_PRESENT"

type ConsistencyDomain = ClinicalDiscrepancyCluster["domain"] | "global"
type PolarityObservation = Readonly<{
  sectionId: ReportSectionId
  domain: ConsistencyDomain
  polarity: ClinicalSemanticPolarity
  sentence: string
  sentenceIndex: number
}>

export type IntraSectionSemanticConflict = Readonly<{
  sectionId: ReportSectionId
  domain: ConsistencyDomain
  clinicalMeaning: "DIFFICULTY" | "FUNCTION" | "RELATION" | "SUFFICIENCY" | "SCORE_FUNCTION"
  leftPolarity: ClinicalSemanticPolarity
  rightPolarity: ClinicalSemanticPolarity
  leftSentence: string
  rightSentence: string
}>

export type IntraSectionConsistencyAudit = Readonly<{
  intraSectionContradictionCount: number
  semanticPolarityConflictCount: number
  crossEvidenceContradictionCount: number
  reconciliationSentenceCount: number
  duplicateReconciliationCount: number
  conflictSectionIds: readonly ReportSectionId[]
  conflicts: readonly IntraSectionSemanticConflict[]
}>

const DOMAIN_PATTERNS: Readonly<Record<Exclude<ConsistencyDomain, "global" | null>, RegExp>> = Object.freeze({
  physiological: /fizyolojik regülasyon|fizyolojik düzenleme|uyku[, ]|bedensel toparlanma/iu,
  sensory: /duyusal regülasyon|duyusal işlem|işitsel|dokunsal|uyaran yoğunluğu/iu,
  emotional: /duygusal regülasyon|duygusal toparlanma|engellenme|sakinleşme/iu,
  cognitive: /bilişsel regülasyon|bilişsel düzenleme|çalışma belleği|sözel yük/iu,
  executive: /yürütücü işlev|planlama|çok basamaklı|görev(?:i|leri)? başlat/iu,
  interoception: /interosepsiyon|interoseptif|beden sinyal|açlık|susuzluk|tuvalet/iu,
})

const RECONCILIATION = /(?:olsa da|etse de|buna karşın|bununla birlikte|bir yandan|diğer yandan|aynı yönde (?:değildir|sonuç vermemektedir)|ayrış(?:ma|maktadır)|uyumsuzluk|tek başına [^.!?]{0,80}yorumlanmamalıdır|güçlüğün her koşulda aynı olmadığını)/iu
const CROSS_EVIDENCE_RECONCILIATION = /(?:aynı yönde (?:değildir|sonuç vermemektedir)|(?:puanı|test sonucu|bakım veren|terapist gözlemi)[^.!?]{0,180}(?:olsa da|etse de|buna karşın)|(?:bu )?ayrışma[^.!?]{0,100}(?:yorumu|yorumlanmasını|dayandırmayı) sınırlar)/iu

const OPPOSITES = Object.freeze([
  Object.freeze({ meaning: "DIFFICULTY" as const, left: "DIFFICULTY_PRESENT" as const, right: "NO_DIFFICULTY_REPORTED" as const }),
  Object.freeze({ meaning: "FUNCTION" as const, left: "PRESERVED" as const, right: "IMPAIRED" as const }),
  Object.freeze({ meaning: "SUFFICIENCY" as const, left: "SUPPORTED" as const, right: "INSUFFICIENT" as const }),
  Object.freeze({ meaning: "SCORE_FUNCTION" as const, left: "TYPICAL" as const, right: "CLINICALLY_SIGNIFICANT_DIFFICULTY" as const }),
  Object.freeze({ meaning: "FUNCTION" as const, left: "NO_FUNCTIONAL_IMPACT" as const, right: "FUNCTIONAL_IMPACT_PRESENT" as const }),
])

const SOURCE_LABELS: Readonly<Record<ClinicalEvidenceUnit["sourceType"], string>> = Object.freeze({
  DNA_TOTAL_SCORE: "DNA toplam puanı",
  DNA_DOMAIN_SCORE: "DNA puanı",
  DNA_ITEM_PATTERN: "madde yanıtları",
  ANAMNESIS: "anamnez bilgisi",
  CAREGIVER_REPORT: "bakım veren anlatısı",
  THERAPIST_OBSERVATION: "terapist gözlemi",
  EXTERNAL_ASSESSMENT: "dış test sonucu",
  PRESERVED_CAPACITY: "destekli koşullardaki performans",
  COUNTER_EVIDENCE: "karşıt klinik bilgi",
  CONTEXTUAL_EVIDENCE: "bağlamsal gözlem",
  MISSING_INFORMATION: "eksik bilgi",
})

const DOMAIN_LABELS: Readonly<Record<Exclude<ConsistencyDomain, "global" | null>, string>> = Object.freeze({
  physiological: "fizyolojik regülasyon",
  sensory: "duyusal regülasyon",
  emotional: "duygusal regülasyon",
  cognitive: "bilişsel regülasyon",
  executive: "yürütücü işlev",
  interoception: "interosepsiyon",
})

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function sentenceList(text: string) {
  return text.split(/(?<=[.!?])\s+|\n+/u).map((sentence) => sentence.replace(/^[-•]\s*/u, "").trim()).filter(Boolean)
}

function domainsInSentence(sentence: string): ConsistencyDomain[] {
  const lowered = sentence.toLocaleLowerCase("tr-TR")
  const domains = Object.entries(DOMAIN_PATTERNS)
    .filter(([, pattern]) => pattern.test(lowered))
    .map(([domain]) => domain as Exclude<ConsistencyDomain, "global" | null>)
  return domains.length ? domains : ["global"]
}

function polaritiesInSentence(sentence: string): ClinicalSemanticPolarity[] {
  const polarities: ClinicalSemanticPolarity[] = []
  const noDifficulty = /(?:ek|ayrı|belirgin)?\s*(?:bir\s+)?(?:günlük yaşam|günlük işlev)?\s*güçlü?ğü?\s+(?:bildirilmemiş|bildirilmiyor|gösterilmemiş|yoktur)|güçlük bulunmamaktadır/iu.test(sentence)
  const difficulty = !noDifficulty
    && !/(?:güçlük|olasılık)[^.!?]{0,100}(?:yeterli destek bulmadı|ana açıklama değildir|dışlanmadı)/iu.test(sentence)
    && /(?:güçlü(?:k|ğ)|zorlan|beklenen aralığın altında|klinik yükselme|katılım(?:ın)? azal|desteğe ihtiyaç)/iu.test(sentence)
  const discrepant = !/(?:çelişki olarak yorumlanmamıştır|çelişki anlamına gelmez|ayrışma gösterilmemiştir)/iu.test(sentence)
    && /(?:aynı yönde değildir|aynı yönde sonuç vermemektedir|ayrış|uyumsuz|çeliş|farklı yönde)/iu.test(sentence)
  const convergent = !discrepant && /(?:aynı yönde|örtüş|uyumlu|birbirini destekliyor)/iu.test(sentence)
  const preserved = /(?:performans|işlev|beceri)[^.!?]{0,80}(?:korun|yaşa uygun|daha iyi)|genel olarak yaşa uygun|tipik sınırlarda/iu.test(sentence)
  const impaired = !noDifficulty && /(?:Atipik|Riskli|güçlü(?:k|ğ)|beklenen aralığın altında|klinik yükselme|zorlan)/iu.test(sentence)
  const insufficient = /(?:kanıt|bilgi|veri|sonuç|yorum)[^.!?]{0,90}(?:sınırlı|yetersiz|belirsiz|bulunmuyor|bulunmadı|mevcut değildir)|yeterli destek bulmadı/iu.test(sentence)
  const supported = !insufficient && /(?:destekliyor|aynı yönde sonuç veriyor|birden fazla bilgi kaynağı|doğrudan destek)/iu.test(sentence)
  const typical = /(?:—\s*Tipik|\bTipik\s+(?:olarak|sınıfında|sınırlarda)|yaşa uygun)/iu.test(sentence)
  const clinicallySignificant = !noDifficulty && /(?:—\s*(?:Atipik|Riskli)|klinik(?: olarak)? (?:anlamlı|yükselme)|belirgin (?:bir )?güçlü(?:k|ğ)|güçlü(?:k|ğ)[^.!?]{0,80}(?:bildiriliyor|bildirilmiştir|olduğunu))/iu.test(sentence)
  const noFunctionalImpact = /(?:günlük yaşam|günlük işlev)[^.!?]{0,90}(?:güçlük bildirilmemiş|etki gösterilmemiş|etkilenmiyor)|ek bir günlük yaşam güçlüğü bildirilmemiş/iu.test(sentence)
  const functionalImpact = !noFunctionalImpact && /(?:günlük yaşam|günlük işlev|katılım|öz bakım|görev)[^.!?]{0,120}(?:güçlü(?:k|ğ)|zorlan|azal|etkilen|desteğe ihtiyaç)/iu.test(sentence)
  if (difficulty) polarities.push("DIFFICULTY_PRESENT")
  if (noDifficulty) polarities.push("NO_DIFFICULTY_REPORTED")
  if (preserved) polarities.push("PRESERVED")
  if (impaired) polarities.push("IMPAIRED")
  if (convergent) polarities.push("CONVERGENT")
  if (discrepant) polarities.push("DISCREPANT")
  if (supported) polarities.push("SUPPORTED")
  if (insufficient) polarities.push("INSUFFICIENT")
  if (typical) polarities.push("TYPICAL")
  if (clinicallySignificant) polarities.push("CLINICALLY_SIGNIFICANT_DIFFICULTY")
  if (noFunctionalImpact) polarities.push("NO_FUNCTIONAL_IMPACT")
  if (functionalImpact) polarities.push("FUNCTIONAL_IMPACT_PRESENT")
  return unique(polarities)
}

function observations(realization: ReportRealization) {
  return realization.sections.flatMap((section) => {
    let previousDomains: ConsistencyDomain[] = ["global"]
    return sentenceList(section.text).flatMap((sentence, sentenceIndex) => {
      const detectedDomains = domainsInSentence(sentence)
      const domains = detectedDomains.length === 1
        && detectedDomains[0] === "global"
        && /^(?:bu ayrışma|bu uyumsuzluk|bu fark|buna karşın|bununla birlikte)\b/iu.test(sentence)
        ? previousDomains
        : detectedDomains
      previousDomains = domains
      const polarities = polaritiesInSentence(sentence)
      return domains.flatMap((domain) => polarities.map((polarity) => Object.freeze({ sectionId: section.sectionId, domain, polarity, sentence, sentenceIndex })))
    })
  })
}

function pairIsReconciled(left: PolarityObservation, right: PolarityObservation) {
  if (left.sentenceIndex === right.sentenceIndex) return RECONCILIATION.test(left.sentence)
  const later = left.sentenceIndex > right.sentenceIndex ? left.sentence : right.sentence
  if (/(?:bazı önemli bilgiler|henüz mevcut değildir|günlük işleve özgü doğrulayıcı veri sınırlıdır)/iu.test(later)) return true
  if (Math.abs(left.sentenceIndex - right.sentenceIndex) > 1) return false
  return /^(?:ancak|bununla birlikte|buna karşın|öte yandan)\b/iu.test(later) || RECONCILIATION.test(later)
}

function domainMention(sentence: string, domain: ClinicalDiscrepancyCluster["domain"]) {
  if (!domain || domain === "global") return true
  return DOMAIN_PATTERNS[domain].test(sentence.toLocaleLowerCase("tr-TR"))
}

export function buildEvidenceReconciliationSentence(cluster: ClinicalDiscrepancyCluster, matrix: ClinicalEvidenceMatrix) {
  const units = cluster.evidenceIds.map((id) => matrix.units.find((unit) => unit.id === id)).filter(Boolean) as ClinicalEvidenceUnit[]
  const domain = cluster.domain && cluster.domain !== "global" ? DOMAIN_LABELS[cluster.domain] : "ilgili alan"
  const supporting = units.filter((unit) => unit.direction === "SUPPORTS" || unit.direction === "CONTRADICTS")
  const limiting = units.filter((unit) => unit.direction === "LIMITS" || unit.direction === "NEUTRAL")
  const dna = units.find((unit) => unit.sourceType === "DNA_DOMAIN_SCORE")
  const dnaTypical = Boolean(dna?.finding.match(/\bTipik\b/iu))
  const sourcePhrase = (rows: readonly ClinicalEvidenceUnit[]) => unique(rows.map((unit) => SOURCE_LABELS[unit.sourceType])).slice(0, 2).join(" ve ")
  if (dna && dnaTypical && supporting.length) {
    const other = sourcePhrase(supporting.filter((unit) => unit.id !== dna.id)) || "günlük yaşam bilgisi"
    return `DNA puanı ${domain} alanında tipik sınırlarda olsa da ${other} günlük yaşamda güçlük olduğunu gösteriyor; bu ayrışma alanın yalnız puana dayalı yorumlanmasını sınırlar.`
  }
  if (dna && !dnaTypical && limiting.length) {
    const other = sourcePhrase(limiting.filter((unit) => unit.id !== dna.id)) || "destekli koşullardaki performans"
    return `DNA puanı ${domain} alanında güçlüğe işaret etse de ${other} daha iyi bir işlev düzeyi gösteriyor; bu ayrışma alanın yalnız puana dayalı yorumlanmasını sınırlar.`
  }
  const left = sourcePhrase(supporting) || sourcePhrase(units.slice(0, 1)) || "Bir bilgi kaynağı"
  const right = sourcePhrase(limiting) || sourcePhrase(units.slice(1)) || "diğer bilgi kaynağı"
  return `${left[0]!.toLocaleUpperCase("tr-TR")}${left.slice(1)} ile ${right} ${domain} alanında aynı yönde değildir; bu ayrışma sonucu tek bir bilgi kaynağına dayandırmayı sınırlar.`
}

export function auditIntraSectionConsistency(input: Readonly<{
  matrix: ClinicalEvidenceMatrix
  realization: ReportRealization
}>): IntraSectionConsistencyAudit {
  const allObservations = observations(input.realization)
  const conflicts: IntraSectionSemanticConflict[] = []
  for (const section of input.realization.sections) {
    const sectionObservations = allObservations.filter((observation) => observation.sectionId === section.sectionId)
    const domains = unique(sectionObservations.map((observation) => observation.domain))
    for (const domain of domains) {
      const domainObservations = sectionObservations.filter((observation) => observation.domain === domain)
      for (const pair of OPPOSITES) {
        const left = domainObservations.filter((observation) => observation.polarity === pair.left)
        const right = domainObservations.filter((observation) => observation.polarity === pair.right)
        for (const first of left) for (const second of right) {
          if (first.sentence === second.sentence && first.polarity === second.polarity) continue
          if (pairIsReconciled(first, second)) continue
          conflicts.push(Object.freeze({
            sectionId: section.sectionId,
            domain,
            clinicalMeaning: pair.meaning,
            leftPolarity: first.polarity,
            rightPolarity: second.polarity,
            leftSentence: first.sentence,
            rightSentence: second.sentence,
          }))
        }
      }
    }
  }

  let crossEvidenceContradictionCount = 0
  let reconciliationSentenceCount = 0
  let duplicateReconciliationCount = 0
  const reconciliationSections = new Set<ReportSectionId>()
  for (const cluster of input.matrix.discrepancyClusters) {
    const matches = input.realization.sections.flatMap((section) => sentenceList(section.text)
      .filter((sentence) => domainMention(sentence, cluster.domain) && CROSS_EVIDENCE_RECONCILIATION.test(sentence))
      .map((sentence) => Object.freeze({ sectionId: section.sectionId, sentence })))
    const section5Matches = matches.filter((match) => match.sectionId === "section_5")
    if (section5Matches.length >= 1 && matches.length === section5Matches.length) reconciliationSentenceCount += 1
    else {
      crossEvidenceContradictionCount += 1
      matches.forEach((match) => reconciliationSections.add(match.sectionId))
      if (!matches.length) reconciliationSections.add("section_5")
    }
  }
  const conflictSectionIds = unique([...conflicts.map((conflict) => conflict.sectionId), ...reconciliationSections])
  return Object.freeze({
    intraSectionContradictionCount: conflicts.length,
    semanticPolarityConflictCount: conflicts.length,
    crossEvidenceContradictionCount,
    reconciliationSentenceCount,
    duplicateReconciliationCount,
    conflictSectionIds: Object.freeze(conflictSectionIds),
    conflicts: Object.freeze(conflicts),
  })
}
