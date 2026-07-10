import type { AnamnezThemeSignals } from "./anamnezUtils"
import type { ClinicalMechanismType } from "./clinicalAnalysis"
import type { ExternalTestAnalysis, ExternalTestCategory, ExternalTestMatch } from "./externalTestRegistry"
import type { ItemLevelAnalysis } from "./itemSignals"
import type { DomainResult } from "./reportEngine"

export type EvidenceDirection = "supports" | "limits" | "contradicts" | "neutral"
export type EvidenceSourceType = "score" | "anamnesis" | "observation" | "external_test" | "micro_theme" | "preserved_capacity"
export type EvidenceAgeFit = "valid" | "borderline" | "invalid" | "unknown"
export type ContextTag =
  | "low_demand_one_to_one"
  | "group_crowd"
  | "transition"
  | "verbal_load"
  | "motor_task_load"
  | "body_signal_fatigue"
  | "social_pragmatic_demand"
  | "daily_routine"

export type ClinicalReasoningAtom = {
  id: string
  sourceType: EvidenceSourceType
  domain?: string
  candidateMechanism: ClinicalMechanismType
  direction: EvidenceDirection
  strength: number
  reliability: number
  specificity: number
  contextTags: ContextTag[]
  ageFit: EvidenceAgeFit
  scoreInterpretability?: "interpretable" | "limited" | "not_applicable"
  traceId?: string
  safety: "visible_allowed" | "internal_only" | "suppress"
  summary: string
}

export type MechanismScoreBreakdown = {
  mechanism: ClinicalMechanismType
  supportScore: number
  limitationScore: number
  contradictionScore: number
  preservedCapacityScore: number
  finalMechanismScore: number
}

export type ConfidenceSubscores = {
  scoreConfidence: number
  anamnesisConfidence: number
  observationConfidence: number
  externalTestConfidence: number
  microEvidenceConfidence: number
  crossSourceAgreement: number
  naturalContextUncertainty: number
}

export type ContextMatrixEntry = {
  tag: ContextTag
  label: string
  evidenceCount: number
  independentEvidenceSources: number
  valence: "organizes" | "loads" | "mixed"
  summary: string
}

export type ClinicalReasoningResult = {
  atoms: ClinicalReasoningAtom[]
  evidenceGraphSummary: string
  counterEvidenceLines: string[]
  preservedCapacityLines: string[]
  contextMatrix: ContextMatrixEntry[]
  confidenceSubscores: ConfidenceSubscores
  calibrationNotes: string[]
  mechanismScoreBreakdown: MechanismScoreBreakdown[]
}

const MECHANISMS: ClinicalMechanismType[] = [
  "motor_praxis",
  "adaptive_daily_living",
  "social_pragmatic",
  "language_communication",
  "language_social_pragmatic",
  "physiological_interoceptive",
  "selective_interoception",
  "evidence_limited_mixed",
  "default",
]

const DOMAIN_MECHANISM_MAP: Record<string, ClinicalMechanismType[]> = {
  physiological: ["physiological_interoceptive"],
  sensory: ["default"],
  emotional: ["social_pragmatic", "language_social_pragmatic", "evidence_limited_mixed"],
  cognitive: ["language_communication", "language_social_pragmatic", "evidence_limited_mixed"],
  executive: ["motor_praxis", "adaptive_daily_living", "evidence_limited_mixed"],
  interoception: ["physiological_interoceptive", "selective_interoception", "adaptive_daily_living"],
}

const CATEGORY_MECHANISM_MAP: Record<ExternalTestCategory, ClinicalMechanismType> = {
  adaptive_daily_living: "adaptive_daily_living",
  development_general: "default",
  executive_behavior: "evidence_limited_mixed",
  general: "default",
  language_communication: "language_communication",
  motor_praxis: "motor_praxis",
  sensory_processing: "default",
  social_pragmatic: "social_pragmatic",
}

const CONTEXT_LABELS: Record<ContextTag, string> = {
  low_demand_one_to_one: "bire bir, görsel destekli ve yapılandırılmış ortam",
  group_crowd: "grup, kalabalık ve yoğun uyaran",
  transition: "geçiş ve rutin değişimi",
  verbal_load: "sözel yük ve yönerge karmaşıklığı",
  motor_task_load: "motor görev ve beden organizasyonu",
  body_signal_fatigue: "beden sinyali, yorgunluk ve toparlanma",
  social_pragmatic_demand: "sosyal-pragmatik talep",
  daily_routine: "günlük yaşam ve öz bakım rutini",
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text))
}

function contextTagsFromText(text: string): ContextTag[] {
  const value = String(text || "")
  const tags: ContextTag[] = []
  if (
    hasAny(value, [
      /bire bir|yapılandırılmış|yapilandirilmis|düşük uyaran|dusuk uyaran|yetişkinle|yetiskinle/i,
      /görsel plan|gorsel plan|görsel model|gorsel model|adımları ayır|adimlari ayir|anlık geri bildirim|anlik geri bildirim/i,
    ])
  ) tags.push("low_demand_one_to_one")
  if (hasAny(value, [/grup|akran|kalabalık|kalabalik|sınıf|sinif|gürültü|gurultu|çok uyaran|cok uyaran/i])) tags.push("group_crowd")
  if (hasAny(value, [/geçiş|gecis|rutin değiş|rutin degis|bekleme|sıra|sira|aktivite sonlandır/i])) tags.push("transition")
  if (hasAny(value, [/sözel|sozel|yönerge|yonerge|komut|dilsel|anlama|cümle|cumle/i])) tags.push("verbal_load")
  if (hasAny(value, [/motor|praksi|koordinasyon|sekans|beden organizasyonu|giyinme|ince motor|kaba motor/i])) tags.push("motor_task_load")
  if (hasAny(value, [/yorgun|uyku|açlık|aclik|susuz|tuvalet|ağrı|agri|bedensel|toparlan/i])) tags.push("body_signal_fatigue")
  if (hasAny(value, [/sosyal|pragmatik|karşılıklılık|karsiliklilik|oyun|akran|esneklik/i])) tags.push("social_pragmatic_demand")
  if (hasAny(value, [/öz bakım|oz bakim|günlük yaşam|gunluk yasam|yemek|beslenme|banyo|tuvalet|giyinme|rutin/i])) tags.push("daily_routine")
  return unique(tags)
}

function mechanismForSignal(signal: keyof AnamnezThemeSignals): ClinicalMechanismType {
  switch (signal) {
    case "motorPraxis":
      return "motor_praxis"
    case "adaptiveDailyLiving":
      return "adaptive_daily_living"
    case "socialPragmatic":
      return "social_pragmatic"
    case "languageLoad":
      return "language_communication"
    case "bodyIntero":
      return "physiological_interoceptive"
    case "transitionCoregulation":
    case "cognitiveExecutive":
    case "emotional":
      return "evidence_limited_mixed"
    default:
      return "default"
  }
}

function ageFitForMatch(match: ExternalTestMatch): EvidenceAgeFit {
  if (match.ageCompatible === true) return "valid"
  if (match.ageCompatible === false) return "invalid"
  return "unknown"
}

function atomWeight(atom: ClinicalReasoningAtom): number {
  return atom.strength * 2 + atom.reliability + atom.specificity
}

function buildScoreAtoms(domainResults: DomainResult[], selectedMechanism: ClinicalMechanismType): ClinicalReasoningAtom[] {
  return domainResults.flatMap((domain) => {
    const mappedMechanisms = DOMAIN_MECHANISM_MAP[domain.key] || ["default"]
    const nonTypical = domain.level !== "Tipik"
    const candidateMechanism = mappedMechanisms.includes(selectedMechanism) ? selectedMechanism : mappedMechanisms[0]
    const concernDistance = Math.max(0, 50 - domain.score)
    const strength = nonTypical ? Math.min(3, Math.max(1, Math.ceil(concernDistance / 10))) : 1
    return [
      {
        id: `reason.score.${domain.key}`,
        sourceType: "score",
        domain: domain.key,
        candidateMechanism,
        direction: nonTypical ? "supports" : "limits",
        strength,
        reliability: 3,
        specificity: nonTypical ? 2 : 1,
        contextTags: [],
        ageFit: "valid",
        scoreInterpretability: "interpretable",
        traceId: `score.${domain.key}`,
        safety: "internal_only",
        summary: nonTypical
          ? `${domain.label} alanı ${domain.level} düzeyde mekanizma ağırlığını artırır.`
          : `${domain.label} alanının korunmuş görünmesi, yorumun yaygın bir sorun gibi genellenmemesi gerektiğini gösterir.`,
      } satisfies ClinicalReasoningAtom,
    ]
  })
}

function buildAnamnesisAtoms(params: {
  anamnezSignals: AnamnezThemeSignals
  anamnezFlags: string[]
  therapistInsights: string[]
  loadingContextTexts?: string[]
  preservedContextTexts?: string[]
  selectedMechanism: ClinicalMechanismType
}): ClinicalReasoningAtom[] {
  const loadingText = [
    ...params.anamnezFlags,
    ...params.therapistInsights,
    ...(params.loadingContextTexts || []),
  ].join(" ")
  const preservedText = (params.preservedContextTexts || []).join(" ")
  const preservedTags = contextTagsFromText(preservedText)
  const tags = contextTagsFromText(loadingText).filter((tag) => !preservedTags.includes(tag))
  const signalKeys: Array<keyof AnamnezThemeSignals> = [
    "motorPraxis",
    "adaptiveDailyLiving",
    "socialPragmatic",
    "languageLoad",
    "bodyIntero",
    "transitionCoregulation",
    "cognitiveExecutive",
    "emotional",
    "sensory",
  ]
  const atoms: ClinicalReasoningAtom[] = signalKeys
    .filter((key) => Boolean(params.anamnezSignals[key]))
    .map((key) => {
      const mechanism = mechanismForSignal(key)
      return {
        id: `reason.anamnesis.${key}`,
        sourceType: "anamnesis",
        candidateMechanism: mechanism === "default" ? params.selectedMechanism : mechanism,
        direction: "supports",
        strength: tags.length ? 3 : 2,
        reliability: params.anamnezFlags.length ? 2 : 1,
        specificity: tags.length ? 3 : 1,
        contextTags: tags,
        ageFit: "unknown",
        scoreInterpretability: "not_applicable",
        traceId: `anamnesis.${key}`,
        safety: "internal_only",
        summary: `Anamnez ${CONTEXT_LABELS[tags[0]] || "vaka bağlamı"} hattında klinik zorlanma bildirir.`,
      } satisfies ClinicalReasoningAtom
    })
  if (params.anamnezSignals.strengths) {
    atoms.push({
      id: "reason.anamnesis.strengths",
      sourceType: "preserved_capacity",
      candidateMechanism: params.selectedMechanism,
      direction: "limits",
      strength: 2,
      reliability: 2,
      specificity: 2,
      contextTags: preservedTags,
      ageFit: "unknown",
      scoreInterpretability: "not_applicable",
      traceId: "anamnesis.strengths",
      safety: "internal_only",
      summary: "Korunmuş ya da sınırlayıcı veri, yorumun her bağlama genellenmemesi gerektiğini gösterir.",
    })
  }
  return atoms
}

function buildExternalAtoms(analysis: ExternalTestAnalysis | undefined, selectedMechanism: ClinicalMechanismType): ClinicalReasoningAtom[] {
  if (!analysis) return []
  return analysis.matches.map((match) => {
    const isDecisionWeighted = analysis.decisionCompatibleIds.includes(match.id)
    const candidateMechanism = CATEGORY_MECHANISM_MAP[match.category] || selectedMechanism
    const preserved = match.resultDirection === "expected_or_preserved"
    const invalidOrRaw =
      match.ageCompatible === false ||
      match.resultQuality === "ham_puan_only" ||
      match.resultQuality === "missing_result" ||
      match.resultQuality === "qualitative_only"
    const direction: EvidenceDirection = preserved
      ? "limits"
      : invalidOrRaw
      ? "contradicts"
      : isDecisionWeighted
      ? "supports"
      : "neutral"
    const weight = match.externalEvidenceWeight || 0
    return {
      id: `reason.external.${match.id}`,
      sourceType: "external_test",
      candidateMechanism,
      direction,
      strength: weight >= 80 ? 3 : weight >= 45 ? 2 : 1,
      reliability: match.externalEvidenceWeightLabel === "strong" ? 3 : match.externalEvidenceWeightLabel === "moderate" ? 2 : 1,
      specificity: isDecisionWeighted && weight >= 60 ? 3 : isDecisionWeighted ? 2 : 1,
      contextTags: contextTagsFromText(`${match.domainsMeasured.join(" ")} ${match.reportedInterpretation || ""} ${match.reportedNotes || ""}`),
      ageFit: ageFitForMatch(match),
      scoreInterpretability: match.resultQuality === "interpretable" ? "interpretable" : match.resultQuality ? "limited" : "not_applicable",
      traceId: `external.${match.id}.${match.externalEvidenceWeightLabel}`,
      safety: "internal_only",
      summary: preserved
        ? `${match.name} korunmuş sonuç yönüyle yorumu dengeleyen veri sağlar.`
        : invalidOrRaw
        ? `${match.name} yaş/yorum/puan sınırlılığı nedeniyle ana karar ağırlığını artırmaz.`
        : `${match.name} ${match.category} hattında destekleyici dış test kanıtı sağlar.`,
    }
  })
}

function buildMicroAtoms(itemLevelAnalysis: ItemLevelAnalysis | null | undefined, selectedMechanism: ClinicalMechanismType): ClinicalReasoningAtom[] {
  if (!itemLevelAnalysis) return []
  return itemLevelAnalysis.criticalItems.map((item) => ({
    id: `reason.micro.${item.cluster}`,
    sourceType: "micro_theme",
    domain: item.domainKey,
    candidateMechanism: selectedMechanism,
    direction: item.matchedContext || item.answer === 1 ? "supports" : "neutral",
    strength: item.answer === 1 ? 2 : 1,
    reliability: 1,
    specificity: item.matchedContext ? 3 : 1,
    contextTags: contextTagsFromText(`${item.clinicalSignal} ${item.cluster}`),
    ageFit: "unknown",
    scoreInterpretability: "not_applicable",
    traceId: `micro.${item.cluster}`,
    safety: "internal_only",
    summary: `${item.cluster} mikro-kanıtı karar dilini destekler ancak tek başına ana mekanizma kurmaz.`,
  }))
}

function buildContextMatrix(atoms: ClinicalReasoningAtom[]): ContextMatrixEntry[] {
  const entries: ContextMatrixEntry[] = []
  for (const tag of Object.keys(CONTEXT_LABELS) as ContextTag[]) {
    const tagged = atoms.filter((atom) => atom.contextTags.includes(tag))
    if (!tagged.length) continue
    const support = tagged.filter((atom) => atom.direction === "supports").length
    const limits = tagged.filter((atom) => atom.direction === "limits" || atom.direction === "contradicts").length
    const independentEvidenceSources = unique(tagged.map((atom) => atom.sourceType)).length
    const valence =
      tag === "low_demand_one_to_one"
        ? "organizes"
        : support > 0 && limits > 0
        ? "mixed"
        : limits > support
        ? "organizes"
        : "loads"
    entries.push({
      tag,
      label: CONTEXT_LABELS[tag],
      evidenceCount: tagged.length,
      independentEvidenceSources,
      valence,
      summary:
        valence === "mixed"
          ? `${CONTEXT_LABELS[tag]} bağlamında hem zorlanma hem de korunmuş kapasite bilgisi vardır.`
          : valence === "organizes"
          ? `${CONTEXT_LABELS[tag]} yorumun her bağlama genellenmemesi gerektiğini gösterir.`
          : `${CONTEXT_LABELS[tag]} klinik zorlanmanın belirginleştiği bağlamı açıklar.`,
    })
  }
  return entries.slice(0, 4)
}

function buildMechanismScoreBreakdown(atoms: ClinicalReasoningAtom[]): MechanismScoreBreakdown[] {
  return MECHANISMS.map((mechanism) => {
    const relevant = atoms.filter((atom) => atom.candidateMechanism === mechanism || mechanism === "default")
    const supportScore = relevant.filter((atom) => atom.direction === "supports").reduce((sum, atom) => sum + atomWeight(atom), 0)
    const limitationScore = relevant.filter((atom) => atom.direction === "limits").reduce((sum, atom) => sum + atomWeight(atom), 0)
    const contradictionScore = relevant.filter((atom) => atom.direction === "contradicts").reduce((sum, atom) => sum + atomWeight(atom), 0)
    const preservedCapacityScore = relevant.filter((atom) => atom.sourceType === "preserved_capacity" || atom.direction === "limits").reduce((sum, atom) => sum + Math.max(1, atom.strength), 0)
    return {
      mechanism,
      supportScore,
      limitationScore,
      contradictionScore,
      preservedCapacityScore,
      finalMechanismScore: supportScore - limitationScore - contradictionScore + Math.round(preservedCapacityScore / 2),
    }
  }).sort((a, b) => b.finalMechanismScore - a.finalMechanismScore)
}

function buildConfidenceSubscores(params: {
  atoms: ClinicalReasoningAtom[]
  domainResults: DomainResult[]
  anamnezFlags: string[]
  therapistInsights: string[]
  externalTestAnalysis?: ExternalTestAnalysis
  itemLevelAnalysis?: ItemLevelAnalysis | null
}): ConfidenceSubscores {
  const nonTypical = params.domainResults.filter((domain) => domain.level !== "Tipik")
  const scoreSpread = params.domainResults.length
    ? Math.max(...params.domainResults.map((domain) => domain.score)) - Math.min(...params.domainResults.map((domain) => domain.score))
    : 0
  const supportMechanisms = unique(params.atoms.filter((atom) => atom.direction === "supports").map((atom) => atom.candidateMechanism))
  const limitingCount = params.atoms.filter((atom) => atom.direction === "limits" || atom.direction === "contradicts").length
  const external = params.externalTestAnalysis
  const validExternal = external?.decisionCompatible.length || 0
  const limitedExternal = external?.matches.filter((match) => !external.decisionCompatibleIds.includes(match.id)).length || 0
  return {
    scoreConfidence: clampScore(55 + nonTypical.length * 8 + Math.min(scoreSpread, 20)),
    anamnesisConfidence: clampScore(params.anamnezFlags.length ? 50 + Math.min(params.anamnezFlags.length, 4) * 12 : 25),
    observationConfidence: clampScore(params.therapistInsights.length ? 55 + Math.min(params.therapistInsights.length, 3) * 12 : 25),
    externalTestConfidence: clampScore(validExternal ? 55 + validExternal * 15 - limitedExternal * 8 : external?.matches.length ? 35 - limitedExternal * 5 : 30),
    microEvidenceConfidence: clampScore(params.itemLevelAnalysis?.criticalItems.length ? 45 + Math.min(params.itemLevelAnalysis.criticalItems.length, 3) * 12 : 30),
    crossSourceAgreement: clampScore(75 - Math.max(0, supportMechanisms.length - 2) * 12 - limitingCount * 5 + (validExternal ? 8 : 0)),
    naturalContextUncertainty: clampScore(70 - Math.min(params.anamnezFlags.length + params.therapistInsights.length, 5) * 8 + limitingCount * 6),
  }
}

export function buildClinicalReasoning(params: {
  selectedMechanism: ClinicalMechanismType
  primaryAxis: string
  domainResults: DomainResult[]
  anamnezSignals: AnamnezThemeSignals
  anamnezFlags: string[]
  therapistInsights: string[]
  loadingContextTexts?: string[]
  preservedContextTexts?: string[]
  externalTestAnalysis?: ExternalTestAnalysis
  itemLevelAnalysis?: ItemLevelAnalysis | null
}): ClinicalReasoningResult {
  const atoms = [
    ...buildScoreAtoms(params.domainResults, params.selectedMechanism),
    ...buildAnamnesisAtoms(params),
    ...buildExternalAtoms(params.externalTestAnalysis, params.selectedMechanism),
    ...buildMicroAtoms(params.itemLevelAnalysis, params.selectedMechanism),
  ]
  const contextMatrix = buildContextMatrix(atoms)
  const mechanismScoreBreakdown = buildMechanismScoreBreakdown(atoms)
  const confidenceSubscores = buildConfidenceSubscores({ ...params, atoms })
  const counterEvidenceLines = atoms
    .filter((atom) => atom.direction === "limits" || atom.direction === "contradicts")
    .sort((a, b) => atomWeight(b) - atomWeight(a))
    .slice(0, 3)
    .map((atom) => atom.summary)
  const preservedCapacityLines = atoms
    .filter((atom) => atom.sourceType === "preserved_capacity" || atom.direction === "limits")
    .sort((a, b) => atomWeight(b) - atomWeight(a))
    .slice(0, 3)
    .map((atom) => atom.summary)
  const calibrationNotes = [
    counterEvidenceLines.length ? "Sınırlayıcı veya çelişkili kanıt karar tonunu yumuşatır." : "",
    preservedCapacityLines.length ? "Korunmuş kapasite, yorumun her bağlama genellenmemesi gerektiğini gösterir." : "",
    contextMatrix.length ? `Bağlam matrisi ${contextMatrix.map((entry) => entry.label).join(", ")} üzerinden karar dilini destekler.` : "",
    confidenceSubscores.crossSourceAgreement < 55 ? "Kaynaklar arası uyum sınırlı olduğu için kesinlik dili azaltılır." : "",
  ].filter(Boolean)

  return {
    atoms,
    evidenceGraphSummary: `${atoms.length} kanıt atomu içinde ${atoms.filter((atom) => atom.direction === "supports").length} destekleyici, ${atoms.filter((atom) => atom.direction === "limits").length} sınırlayıcı ve ${atoms.filter((atom) => atom.direction === "contradicts").length} çelişkili yön izlenmiştir.`,
    counterEvidenceLines,
    preservedCapacityLines,
    contextMatrix,
    confidenceSubscores,
    calibrationNotes,
    mechanismScoreBreakdown,
  }
}
