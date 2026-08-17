import type {
  LockedReportPlan,
  ReportClaim,
  ReportRealization,
  ReportRealizer,
  ReportRealizerAttempt,
  ReportRealizerRequest,
  ReportSectionId,
  ReportV2ValidationResult,
} from "./contracts"
import { stableHash } from "./evidenceEngine"
import { naturalizeReportClaim, normalizeDnaReportLanguage, reportLanguageDiagnostics } from "./languageContract"

export const DETERMINISTIC_REPORT_REALIZER_VERSION = "dna-report-v2.3-deterministic-realizer@3-preprod-source-surface" as const

function compactSection2Text(plan: LockedReportPlan, claims: readonly ReportClaim[]) {
  const overall = claims.find((claim) => claim.id === "claim.overall-classification")
  const threshold = claims.find((claim) => claim.id === "claim.domain-threshold-method")
  const domains = claims.flatMap((claim) => {
    if (!claim.id.startsWith("claim.domain.")) return []
    const match = claim.text.match(/^([^:]+):\s*(\d+)\/50\s*[—,-]\s*([^.]+)\.?$/u)
    return match ? [Object.freeze({ id: claim.id, label: match[1]!.trim(), score: Number(match[2]), level: match[3]!.trim() })] : []
  })
  const overallMatch = overall?.text.match(/Toplam skor\s+([^ ]+)\s+ve genel sınıflama\s+([^.]*)/iu)
  const level = overallMatch?.[2]?.trim().replace(/\s+olarak hesaplandı$/iu, "")
  const summary = domains.length && Math.max(...domains.map((domain) => domain.score)) - Math.min(...domains.map((domain) => domain.score)) <= 3
    ? "Alan puanları birbirine yakın bir dağılım göstermektedir."
    : domains.length
      ? `En düşük alan puanı ${domains.slice().sort((left, right) => left.score - right.score)[0]!.label.toLocaleLowerCase("tr-TR")} alanındadır.`
      : ""
  return [
    threshold?.text ?? "Alan sınıflamaları yaşa ve ilgili alana özgü eşiklere göre hesaplanmıştır.",
    overallMatch ? `Toplam puan: ${overallMatch[1]}; genel sınıflama: ${level}.` : "",
    ...domains.map((domain) => `- ${domain.label}: ${domain.score}/50 — ${domain.level}`),
    summary,
  ].filter(Boolean).join("\n")
}

function upperInitial(text: string) {
  return text.replace(/^([a-zçğıöşü])/u, (letter) => letter.toLocaleUpperCase("tr-TR"))
}

function lowerInitial(text: string) {
  return text.replace(/^([A-ZÇĞİÖŞÜ])/u, (letter) => letter.toLocaleLowerCase("tr-TR"))
}

function withFinalPunctuation(text: string) {
  const trimmed = text.trim()
  return !trimmed || /[.!?)]$/u.test(trimmed) ? trimmed : `${trimmed}.`
}

function reconciledSection1Text(plan: LockedReportPlan, claims: readonly ReportClaim[]) {
  const overall = claims.find((claim) => claim.id === "claim.overall-classification")
  const primary = claims.find((claim) => claim.id === plan.primaryDecisionClaimId)
  if (!overall || !primary || !plan.primaryFormulationId || plan.primaryFormulationId === "balanced") return null
  const overallMatch = overall.text.match(/Toplam skor\s+([^ ]+)\s+ve genel sınıflama\s+Tipik/iu)
  if (!overallMatch) return null
  const primaryText = withFinalPunctuation(normalizeDnaReportLanguage(naturalizeReportClaim(plan, "section_1", primary)))
  const confidence = claims.find((claim) => claim.id === "claim.confidence")
  const confidenceText = confidence ? withFinalPunctuation(upperInitial(normalizeDnaReportLanguage(naturalizeReportClaim(plan, "section_1", confidence)))) : ""
  return [
    `Toplam puan ${overallMatch[1]} ve genel sonuç Tipik olarak sınıflanmış olsa da ${lowerInitial(primaryText)}`,
    confidenceText,
  ].filter(Boolean).join("\n\n")
}

function deterministicSectionText(plan: LockedReportPlan, sectionId: ReportSectionId, claims: readonly ReportClaim[]) {
  if (!claims.length) return "Mevcut plan bu bölüm için ek bir yorum içermemektedir."
  if (sectionId === "section_2") return compactSection2Text(plan, claims)
  if (sectionId === "section_1") {
    const reconciled = reconciledSection1Text(plan, claims)
    if (reconciled) return reconciled
  }
  const discrepancyRelationIds = new Set(claims.filter((claim) => claim.id.startsWith("claim.discrepancy.")).flatMap((claim) => claim.relationIds))
  let claimsForText = sectionId === "section_5"
    ? claims.filter((claim) => !(claim.id.startsWith("claim.external.") && claim.sufficiency === "CONFLICTED" && claim.relationIds.some((id) => discrepancyRelationIds.has(id))))
    : claims
  if (sectionId === "section_4" && claimsForText.some((claim) => claim.id === "claim.section4-synthesis")) {
    claimsForText = claimsForText.filter((claim) => claim.id !== plan.primaryDecisionClaimId)
  }
  if (sectionId === "section_5" && claimsForText.some((claim) => claim.id.startsWith("claim.source-comparison."))) {
    claimsForText = claimsForText.filter((claim) => claim.id.startsWith("claim.source-comparison."))
  }
  const paragraphs: string[] = []
  const usedNaturalizedText = new Set<string>()
  for (let index = 0; index < claimsForText.length; index += 2) {
    const pair = claimsForText.slice(index, index + 2).map((claim) => {
      const naturalized = claim.id.startsWith("claim.literature.")
        ? claim.text
        : normalizeDnaReportLanguage(naturalizeReportClaim(plan, sectionId, claim))
      const text = upperInitial((claim.id.startsWith("claim.discrepancy.")
        ? naturalized
        : naturalized.replace(/;\s+(\p{L})/gu, (_match, letter: string) => `. ${letter.toLocaleUpperCase("tr-TR")}`))
        .trim())
      const key = text.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim()
      if (!text || usedNaturalizedText.has(key)) return ""
      usedNaturalizedText.add(key)
      return /[.!?)]$/u.test(text) ? text : `${text}.`
    }).filter(Boolean)
    if (!pair.length) continue
    const text = pair.join(" ")
    paragraphs.push(normalizeDnaReportLanguage(text))
  }
  return paragraphs.join("\n\n")
}

export function createDeterministicReportRealization(plan: LockedReportPlan): ReportRealization {
  const claimMap = new Map(plan.claims.map((claim) => [claim.id, claim]))
  const usedAcrossSections = new Set<string>()
  return Object.freeze({
    version: "report-realization@2",
    unsupportedAddition: false,
    unsupportedSectionIds: Object.freeze([]),
    sections: Object.freeze(plan.sections.map((section) => {
      const usedClaimIds = Array.from(new Set([
        ...section.requiredClaimIds,
        ...section.importantClaimIds.filter((id) => !usedAcrossSections.has(id)),
        ...section.optionalClaimIds.filter((id) => !usedAcrossSections.has(id)),
      ]))
      usedClaimIds.forEach((id) => usedAcrossSections.add(id))
      const claims = usedClaimIds.map((id) => claimMap.get(id)).filter(Boolean) as ReportClaim[]
      return Object.freeze({
        sectionId: section.id,
        text: deterministicSectionText(plan, section.id, claims),
        usedClaimIds: Object.freeze(usedClaimIds),
      })
    })),
  })
}

export function createControlledReportRepair(
  plan: LockedReportPlan,
  realization: ReportRealization,
  validation: ReportV2ValidationResult,
): Readonly<{ realization: ReportRealization; insertionCount: number }> {
  const claimMap = new Map(plan.claims.map((entry) => [entry.id, entry]))
  const missing = new Set(validation.missingImportantClaimIds)
  const repairLiteratureFormatting = validation.repairableFailureCodes.some((code) => [
    "LITERATURE_FRAGMENT", "ORPHAN_QUOTE", "INCOMPLETE_SENTENCE",
    "EXACT_PASSAGE_MISSING", "CLAIM_SOURCE_MISMATCH", "CLAIM_PASSAGE_OVERREACH", "TOPIC_ONLY_CITATION", "WRONG_CONSTRUCT_CITATION",
  ].includes(code))
  const repairLanguage = validation.repairableFailureCodes.some((code) => [
    "AWKWARD_ACADEMIC_LANGUAGE", "TERMINOLOGY_DRIFT", "INTERNAL_ENGINE_JARGON", "SYSTEM_LIKE_LANGUAGE",
    "NOMINALIZATION_OVERLOAD", "ABSTRACT_CLINICAL_LANGUAGE", "UNCLEAR_AGENT", "UNCLEAR_DAILY_LIFE_MEANING",
    "PLAIN_TURKISH_GRAMMAR_ERROR",
    "GRAMMAR_FRAGMENT", "SEMANTIC_CONTRADICTION", "AWKWARD_GENERIC_PHRASE",
    "SEMANTIC_PARAGRAPH_REPETITION", "HUMAN_EDITOR_SYSTEM_PROSE",
    "PRESCRIPTIVE_RECOMMENDATION_LEAK", "WRONG_SECTION_GENERIC_KNOWLEDGE", "OTHER_CHILD_EXAMPLE",
    "GENERIC_TEMPLATE_INJECTION", "UNEXPLAINED_CONFIDENCE_CONFLICT",
  ].includes(code))
  const repairOwnerCopy = validation.repairableFailureCodes.includes("OWNER_BOOK_VERBATIM_COPY")
  const repairRepetition = validation.repairableFailureCodes.includes("EXCESSIVE_REPETITION") || validation.repairableFailureCodes.includes("SEMANTIC_MICRO_REPETITION")
  const repairSectionStructure = validation.repairableFailureCodes.some((code) => ["REPEATED_TEMPLATE_PHRASE", "SECTION_2_THRESHOLD_REPETITION"].includes(code))
  const repairHardGrammar = validation.repairableFailureCodes.some((code) => ["BROKEN_SUFFIX", "DUPLICATE_SUFFIX", "SENTENCE_MERGE_ERROR", "BROKEN_WORD", "INTERNAL_LABEL_LEAKAGE"].includes(code))
  const repairConsistency = validation.repairableFailureCodes.some((code) => [
    "INTRA_SECTION_CONTRADICTION", "UNRESOLVED_EVIDENCE_CONTRADICTION",
    "SOURCE_PAIR_RELATION_CONTRADICTION", "CROSS_SECTION_RELATION_DRIFT", "SAME_DIRECTION_FALSE_ASSERTION",
    "TURKISH_MORPHOLOGY_ERROR", "SUBJECT_OBJECT_AGREEMENT_ERROR", "BROKEN_NOUN_PHRASE",
    "TURKISH_SURFACE_ERROR", "MORPHOLOGY_ERROR", "PUNCTUATION_ERROR", "SENTENCE_BOUNDARY_ERROR",
    "SECTION5_GENERIC_SPECIFIC_DUPLICATION",
  ].includes(code))
  if (repairConsistency && !repairRepetition && !repairSectionStructure) {
    const deterministic = createDeterministicReportRealization(plan)
    const replacements = new Map(deterministic.sections.filter((section) => validation.consistencyConflictSectionIds.includes(section.sectionId)).map((section) => [section.sectionId, section]))
    const sections = realization.sections.map((section) => replacements.get(section.sectionId) ?? section)
    return Object.freeze({
      realization: Object.freeze({ ...realization, unsupportedAddition: false, unsupportedSectionIds: Object.freeze([]), sections: Object.freeze(sections) }),
      insertionCount: Math.max(1, replacements.size),
    })
  }
  if (repairRepetition || repairSectionStructure) {
    const realization = createDeterministicReportRealization(plan)
    const insertionCount = Math.max(1, validation.crossSectionRepetitionCount + validation.semanticCrossSectionRepeatCount)
    return Object.freeze({ realization, insertionCount })
  }
  const repairUnsupportedSections = new Set(realization.unsupportedSectionIds ?? [])
  if (validation.repairableFailureCodes.includes("UNSUPPORTED_ADDITION")) {
    for (const realized of realization.sections) {
      const sectionPlan = plan.sections.find((entry) => entry.id === realized.sectionId)
      if (!sectionPlan) continue
      const hasMisplacedKnownClaim = realized.usedClaimIds.some((id) => claimMap.has(id) && !sectionPlan.allowedClaimIds.includes(id))
      if (hasMisplacedKnownClaim) repairUnsupportedSections.add(realized.sectionId)
    }
  }
  const repeatedSectionIds = new Set<ReportSectionId>()
  const hardGrammarSectionIds = new Set(realization.sections.filter((section) => {
    const diagnostics = reportLanguageDiagnostics(section.text)
    return diagnostics.internalLabelLeakageCount + diagnostics.brokenSuffixCount + diagnostics.duplicateSuffixCount + diagnostics.sentenceMergeErrorCount + diagnostics.brokenWordCount > 0
  }).map((section) => section.sectionId))
  let insertionCount = 0
  const sections = realization.sections.map((realized) => {
    const sectionPlan = plan.sections.find((entry) => entry.id === realized.sectionId)
    if (!sectionPlan) return realized
    const insertHere = sectionPlan.importantClaimIds.filter((id) => missing.has(id))
    const earlierUsedClaimIds = new Set(realization.sections.slice(0, realization.sections.findIndex((entry) => entry.sectionId === realized.sectionId)).flatMap((entry) => entry.usedClaimIds))
    insertHere.forEach((id) => missing.delete(id))
    if ((repairLiteratureFormatting && realized.sectionId === "section_8") || (repairOwnerCopy && ["section_3", "section_4", "section_5", "section_8"].includes(realized.sectionId)) || repeatedSectionIds.has(realized.sectionId) || repairUnsupportedSections.has(realized.sectionId) || (repairHardGrammar && hardGrammarSectionIds.has(realized.sectionId))) {
      const sourceClaimIds = repeatedSectionIds.has(realized.sectionId) && !repairUnsupportedSections.has(realized.sectionId) && !hardGrammarSectionIds.has(realized.sectionId)
        ? realized.usedClaimIds
        : [...sectionPlan.requiredClaimIds, ...sectionPlan.importantClaimIds]
      const usedClaimIds = Array.from(new Set(sourceClaimIds.filter((id) => sectionPlan.requiredClaimIds.includes(id) || !earlierUsedClaimIds.has(id))))
      const claims = usedClaimIds.map((id) => claimMap.get(id)).filter(Boolean) as ReportClaim[]
      insertionCount += Math.max(1, insertHere.length)
      return Object.freeze({ sectionId: realized.sectionId, text: deterministicSectionText(plan, realized.sectionId, claims), usedClaimIds: Object.freeze(usedClaimIds) })
    }
    if (!insertHere.length) return repairLanguage
      ? Object.freeze({ ...realized, text: normalizeDnaReportLanguage(realized.text) })
      : realized
    const claims = insertHere.map((id) => claimMap.get(id)).filter(Boolean) as ReportClaim[]
    insertionCount += claims.length
    return Object.freeze({
      sectionId: realized.sectionId,
      text: normalizeDnaReportLanguage(`${realized.text.trim()}\n\n${deterministicSectionText(plan, realized.sectionId, claims)}`.trim()),
      usedClaimIds: Object.freeze(Array.from(new Set([...realized.usedClaimIds, ...claims.map((entry) => entry.id)]))),
    })
  })
  return Object.freeze({ realization: Object.freeze({ ...realization, unsupportedAddition: false, unsupportedSectionIds: Object.freeze([]), sections: Object.freeze(sections) }), insertionCount })
}

export class DeterministicReportRealizer implements ReportRealizer {
  readonly identity = Object.freeze({
    provider: "deterministic" as const,
    model: "dna-report-v2-deterministic",
    implementationVersion: DETERMINISTIC_REPORT_REALIZER_VERSION,
  })

  async realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt> {
    const realization = createDeterministicReportRealization(request.plan)
    return Object.freeze({
      ...this.identity,
      attempt: request.attempt === "fallback" ? "fallback" : request.attempt,
      realization,
      rawOutput: JSON.stringify(realization),
      responseId: null,
      usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
      latencyMs: 0,
      promptHash: stableHash({ version: DETERMINISTIC_REPORT_REALIZER_VERSION, plan: request.plan, attempt: request.attempt }),
    })
  }
}

export function renderReportRealization(plan: LockedReportPlan, realization: ReportRealization): string {
  const byId = new Map(realization.sections.map((section) => [section.sectionId, section]))
  return plan.sections.map((section) => `${section.heading}\n${byId.get(section.id)?.text.trim() ?? ""}`.trim()).join("\n\n")
}
