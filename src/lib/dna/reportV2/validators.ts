import { validateAndNormalizeClinicalReport } from "../clinicalSafetyValidator"
import type {
  ClinicalSubstanceStatus,
  ClinicalDecisionPlan,
  ClinicalEvidenceMatrix,
  LockedReportPlan,
  ReportRealization,
  PlainClinicalTurkishSummary,
  ReportV2ValidationFailureCode,
  ReportV2ValidationResult,
} from "./contracts"
import { REPORT_SECTION_HEADINGS } from "./contracts"
import { auditLiteratureDirectSupport, validateLiteratureBindings } from "./knowledge"
import { crossSectionRepetitionCount, ownerBookVerbatimCopyCount, repeatedTemplatePhraseDiagnostics, reportLanguageDiagnostics, section2ThresholdSentenceCount, semanticCrossSectionRepeatCount } from "./languageContract"
import { renderReportRealization } from "./realizer"
import { auditIntraSectionConsistency } from "./intraSectionConsistencyGate"
import { humanClinicalEditorDiagnostics, humanReadabilityDiagnostics, plainClinicalLanguageDiagnostics } from "./plainClinicalTurkish"
import { auditEvidenceRelationConsistency, auditFinalTurkishSurface, auditSection5GenericSpecificDuplication, auditTurkishMorphology } from "./surfaceQa"

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
const CLIENT_CODE = /\b(?:KURGU|DANISAN|DANIŞAN|CLIENT)[-_ ]?\d{3,}\b/gi
const RAW_PII_LABEL = /(?:adı.?soyadı|danışan kodu|danisan kodu|e-?posta|telefon|adres|kayıt id|kayit id|client.?id|assessment.?id)/gi
const RAW_INPUT_KEY = /"(?:anamnez|answers|rawAnamnesis|clientCode|clientId|assessmentId|email|phone|address)"\s*:/gi
const CAUSAL = /\b(?:neden olur|nedenidir|yol açar|yol acar|sonucudur|sonucudur|mekanizmasıdır|mekanizmasidir|ikincil olarak zorlanır|ikincil olarak zorlanir)\b/gi
// Match implementation language, not legitimate publication phrases such as
// "primary school children" in an APA source title.
const INTERNAL_LANGUAGE = /(?:\bLOW\b|\bMODERATE_HIGH\b|\bprimary formulation\b|\bconstruct\b|\bcandidate formulation\b|\bevidence node\b|\brelation edge\b|\bclaim id\b|\blocked plan\b)/i
const CASE_SPECIFIC_OWNER_LANGUAGE = /(?:bu vaka|bu olgu|bu danışan|bu çocuk|değerlendirilen çocuk|mevcut vakada|mevcut olguda|bu değerlendirmede saptan)/i
const PRESCRIPTIVE_RECOMMENDATION = /\b(?:planlanmalıdır|planlanmalı|uygulanmalıdır|uygulanmalı|kullanılmalıdır|kullanılmalı|önerilir|önerilmektedir|yapılmalıdır|yapılmalı)\b/giu
const OTHER_CHILD_EXAMPLE = /\b(?:başka bir çocuk|diğer çocuk(?:lar)?|genel olarak çocuklar|çocuklar genellikle|örneğin bir çocuk)\b/giu
const GENERIC_THEORY_OUTSIDE_LITERATURE = /(?:DNA'nın kavramsal çerçevesi(?:nde)?|genel bilimsel çerçeve|genel olarak çocuklar|araştırmalar çocuklarda|literatür çocuklarda)/giu
const GENERIC_PRESERVED_TEMPLATE = /(?:becerilerin görece korunduğunu düşündüren bulgular bulunuyor[^.!?]*[.!?]\s*Ancak bu güçlü yönler|diğer alanlar(?:ın)? görece korunduğunu[^.!?]*ancak)/giu
const VAGUE_MISSING_INFORMATION = /(?:bazı önemli bilgiler|önemli bilgiler)\s+(?:henüz\s+)?(?:eksik|mevcut değildir|bulunmamaktadır)/giu
const NAMED_INFORMATION_SOURCE = /(?:anamnez|bakım veren|öğretmen|terapist gözlemi|klinik gözlem|dış değerlendirme|dış test|günlük yaşam örneği)/iu
const EMPTY_LEXICAL_QA_COUNTS = Object.freeze({ formülasyon: 0, örüntü: 0, görünüm: 0, odağı: 0, yakınsama: 0, "korunmuş kapasite": 0, eksen: 0 })

export function clinicalContentEditorTextDiagnostics(realization: ReportRealization) {
  const sections1To7 = realization.sections.filter((section) => section.sectionId !== "section_8")
  const sections1To7Text = sections1To7.map((section) => section.text).join("\n\n")
  const finalBodyText = realization.sections.map((section) => section.text).join("\n\n")
  const section1Text = realization.sections.find((section) => section.sectionId === "section_1")?.text ?? ""
  const vagueMissingCount = section1Text.match(VAGUE_MISSING_INFORMATION)?.length ?? 0
  return Object.freeze({
    prescriptiveRecommendationLeakCount: finalBodyText.match(PRESCRIPTIVE_RECOMMENDATION)?.length ?? 0,
    wrongSectionGenericKnowledgeTextCount: sections1To7Text.match(GENERIC_THEORY_OUTSIDE_LITERATURE)?.length ?? 0,
    otherChildExampleCount: sections1To7Text.match(OTHER_CHILD_EXAMPLE)?.length ?? 0,
    genericTemplateInjectionCount: finalBodyText.match(GENERIC_PRESERVED_TEMPLATE)?.length ?? 0,
    unexplainedConfidenceConflictCount: vagueMissingCount && !NAMED_INFORMATION_SOURCE.test(section1Text) ? vagueMissingCount : 0,
  })
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function substanceSourceFamily(sourceType: ClinicalEvidenceMatrix["units"][number]["sourceType"]): string | null {
  if (["DNA_TOTAL_SCORE", "DNA_DOMAIN_SCORE", "DNA_ITEM_PATTERN"].includes(sourceType)) return "DNA_PROFILE"
  if (["ANAMNESIS", "CAREGIVER_REPORT", "THERAPIST_OBSERVATION", "EXTERNAL_ASSESSMENT", "PRESERVED_CAPACITY", "CONTEXTUAL_EVIDENCE"].includes(sourceType)) return sourceType
  return null
}

function clinicalSubstanceAudit(input: Readonly<{
  plan: LockedReportPlan
  matrix: ClinicalEvidenceMatrix
  realization: ReportRealization
}>): Readonly<{
  section4Status: ClinicalSubstanceStatus
  section5Status: ClinicalSubstanceStatus
  insufficientCount: number
  limitedCount: number
  sourcePairSynthesisCount: number
}> {
  const section4 = input.realization.sections.find((section) => section.sectionId === "section_4")
  const section5 = input.realization.sections.find((section) => section.sectionId === "section_5")
  const section4BoundaryAvailable = input.plan.claims.some((claim) => claim.id === "claim.section4-boundary")
  const section4HasSynthesis = Boolean(section4?.usedClaimIds.includes("claim.section4-synthesis"))
  const section4HasBoundary = Boolean(section4?.usedClaimIds.includes("claim.section4-boundary"))
  const section4Status: ClinicalSubstanceStatus = !section4HasSynthesis || (section4BoundaryAvailable && !section4HasBoundary)
    ? "INSUFFICIENT"
    : section4BoundaryAvailable ? "SUBSTANTIVE" : "LIMITED_BY_AVAILABLE_EVIDENCE"

  const sourceComparisonClaims = (section5?.usedClaimIds ?? [])
    .filter((id) => id.startsWith("claim.source-comparison."))
    .map((id) => input.plan.claims.find((claim) => claim.id === id))
    .filter(Boolean) as LockedReportPlan["claims"][number][]
  const sourcePairSynthesisCount = sourceComparisonClaims.length
    ? input.plan.caseEvidenceSourceMatrix.canonicalRelations.filter((relation) => relation.relation !== "MISSING" && sourceComparisonClaims.some((claim) => relation.evidenceIds.some((id) => claim.evidenceIds.includes(id)))).length
    : 0
  const availableSources = input.plan.caseEvidenceSourceMatrix.availableSources
  const hasExplicitUnavailableComparison = sourceComparisonClaims.some((claim) => claim.evidenceIds.some((id) => input.matrix.units.find((unit) => unit.id === id)?.sourceType === "MISSING_INFORMATION"))
  const section5Status: ClinicalSubstanceStatus = availableSources.length >= 2
    ? sourcePairSynthesisCount > 0 ? "SUBSTANTIVE" : "INSUFFICIENT"
    : sourceComparisonClaims.length > 0 && hasExplicitUnavailableComparison ? "LIMITED_BY_AVAILABLE_EVIDENCE" : "INSUFFICIENT"
  const statuses = [section4Status, section5Status]
  return Object.freeze({
    section4Status,
    section5Status,
    insufficientCount: statuses.filter((status) => status === "INSUFFICIENT").length,
    limitedCount: statuses.filter((status) => status === "LIMITED_BY_AVAILABLE_EVIDENCE").length,
    sourcePairSynthesisCount,
  })
}

function numbers(value: string): Set<string> {
  return new Set(value.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])
}

function sentenceList(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n{2,}/u).map((item) => item.trim()).filter(Boolean)
}

function normalizedSentence(text: string): string {
  return text.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").replace(/\s+/g, " ").trim()
}

function result(failureCodes: readonly ReportV2ValidationFailureCode[], input?: Partial<Omit<ReportV2ValidationResult, "pass" | "failureCodes">>): ReportV2ValidationResult {
  const codes = unique(failureCodes)
  const repairable = unique(input?.repairableFailureCodes ?? [])
  return Object.freeze({
    pass: codes.length === 0,
    failureCodes: Object.freeze(codes),
    repairableFailureCodes: Object.freeze(repairable),
    missingImportantClaimIds: Object.freeze(unique(input?.missingImportantClaimIds ?? [])),
    controlledInsertionCount: input?.controlledInsertionCount ?? 0,
    requiredClaimCoverage: input?.requiredClaimCoverage ?? 0,
    unsupportedRelationCount: input?.unsupportedRelationCount ?? 0,
    omissionCount: input?.omissionCount ?? 0,
    repetitionScore: input?.repetitionScore ?? 0,
    section23ClaimOverlapCount: input?.section23ClaimOverlapCount ?? 0,
    piiViolationCount: input?.piiViolationCount ?? 0,
    preservedDomainOverinterpretationCount: input?.preservedDomainOverinterpretationCount ?? 0,
    literatureCaseDecisionAttributionCount: input?.literatureCaseDecisionAttributionCount ?? 0,
    literatureFormattingErrorCount: input?.literatureFormattingErrorCount ?? 0,
    citationBackedClaimCount: input?.citationBackedClaimCount ?? 0,
    exactPassageMissingCount: input?.exactPassageMissingCount ?? 0,
    claimSourceMismatchCount: input?.claimSourceMismatchCount ?? 0,
    claimPassageOverreachCount: input?.claimPassageOverreachCount ?? 0,
    topicOnlyCitationCount: input?.topicOnlyCitationCount ?? 0,
    wrongConstructCitationCount: input?.wrongConstructCitationCount ?? 0,
    internalEngineJargonCount: input?.internalEngineJargonCount ?? 0,
    internalLabelLeakageCount: input?.internalLabelLeakageCount ?? 0,
    awkwardAcademicLanguageCount: input?.awkwardAcademicLanguageCount ?? 0,
    terminologyDriftCount: input?.terminologyDriftCount ?? 0,
    brokenSuffixCount: input?.brokenSuffixCount ?? 0,
    duplicateSuffixCount: input?.duplicateSuffixCount ?? 0,
    sentenceMergeErrorCount: input?.sentenceMergeErrorCount ?? 0,
    brokenWordCount: input?.brokenWordCount ?? 0,
    irrelevantKnowledgeClaimCount: input?.irrelevantKnowledgeClaimCount ?? 0,
    nonMaterialKnowledgeClaimCount: input?.nonMaterialKnowledgeClaimCount ?? 0,
    theoreticalExpansionKnowledgeCount: input?.theoreticalExpansionKnowledgeCount ?? 0,
    secondaryDomainOverexplanationCount: input?.secondaryDomainOverexplanationCount ?? 0,
    systemLikeLanguageCount: input?.systemLikeLanguageCount ?? 0,
    nominalizationOverloadCount: input?.nominalizationOverloadCount ?? 0,
    abstractClinicalLanguageCount: input?.abstractClinicalLanguageCount ?? 0,
    unclearAgentCount: input?.unclearAgentCount ?? 0,
    unclearDailyLifeMeaningCount: input?.unclearDailyLifeMeaningCount ?? 0,
    meaningDriftCount: input?.meaningDriftCount ?? 0,
    semanticStrengtheningCount: input?.semanticStrengtheningCount ?? 0,
    newSpecificityCount: input?.newSpecificityCount ?? 0,
    newInterventionDetailCount: input?.newInterventionDetailCount ?? 0,
    certaintyDriftCount: input?.certaintyDriftCount ?? 0,
    nonMaterialKnowledgeReentryCount: input?.nonMaterialKnowledgeReentryCount ?? 0,
    semanticMicroRepetitionCount: input?.semanticMicroRepetitionCount ?? 0,
    plainTurkishGrammarErrorCount: input?.plainTurkishGrammarErrorCount ?? 0,
    grammarFragmentCount: input?.grammarFragmentCount ?? 0,
    semanticContradictionCount: input?.semanticContradictionCount ?? 0,
    awkwardGenericPhraseCount: input?.awkwardGenericPhraseCount ?? 0,
    semanticParagraphRepetitionCount: input?.semanticParagraphRepetitionCount ?? 0,
    humanEditorSystemLikeProseCount: input?.humanEditorSystemLikeProseCount ?? 0,
    prescriptiveRecommendationLeakCount: input?.prescriptiveRecommendationLeakCount ?? 0,
    wrongSectionGenericKnowledgeCount: input?.wrongSectionGenericKnowledgeCount ?? 0,
    otherChildExampleCount: input?.otherChildExampleCount ?? 0,
    genericTemplateInjectionCount: input?.genericTemplateInjectionCount ?? 0,
    unexplainedConfidenceConflictCount: input?.unexplainedConfidenceConflictCount ?? 0,
    repeatedTemplatePhraseCount: input?.repeatedTemplatePhraseCount ?? 0,
    section2RepeatedThresholdSentenceCount: input?.section2RepeatedThresholdSentenceCount ?? 0,
    intraSectionContradictionCount: input?.intraSectionContradictionCount ?? 0,
    crossEvidenceContradictionCount: input?.crossEvidenceContradictionCount ?? 0,
    semanticPolarityConflictCount: input?.semanticPolarityConflictCount ?? 0,
    reconciliationSentenceCount: input?.reconciliationSentenceCount ?? 0,
    duplicateReconciliationCount: input?.duplicateReconciliationCount ?? 0,
    consistencyConflictSectionIds: Object.freeze(unique(input?.consistencyConflictSectionIds ?? [])),
    ownerBookVerbatimCopyCount: input?.ownerBookVerbatimCopyCount ?? 0,
    crossSectionRepetitionCount: input?.crossSectionRepetitionCount ?? 0,
    semanticCrossSectionRepeatCount: input?.semanticCrossSectionRepeatCount ?? 0,
    lexicalQaCounts: Object.freeze({ ...(input?.lexicalQaCounts ?? EMPTY_LEXICAL_QA_COUNTS) }),
    knowledgeAuthorityViolationCount: input?.knowledgeAuthorityViolationCount ?? 0,
    knowledgeSourceViolationCount: input?.knowledgeSourceViolationCount ?? 0,
    knowledgeCaseSpecificAdditionCount: input?.knowledgeCaseSpecificAdditionCount ?? 0,
    blankSectionCount: input?.blankSectionCount ?? 0,
    section4ClinicalSubstanceStatus: input?.section4ClinicalSubstanceStatus ?? "SUBSTANTIVE",
    section5ClinicalSubstanceStatus: input?.section5ClinicalSubstanceStatus ?? "SUBSTANTIVE",
    insufficientClinicalSubstanceCount: input?.insufficientClinicalSubstanceCount ?? 0,
    limitedByAvailableEvidenceSectionCount: input?.limitedByAvailableEvidenceSectionCount ?? 0,
    sourcePairSynthesisCount: input?.sourcePairSynthesisCount ?? 0,
    sourcePairRelationContradictionCount: input?.sourcePairRelationContradictionCount ?? 0,
    crossSectionRelationDriftCount: input?.crossSectionRelationDriftCount ?? 0,
    sameDirectionFalseAssertionCount: input?.sameDirectionFalseAssertionCount ?? 0,
    turkishMorphologyErrorCount: input?.turkishMorphologyErrorCount ?? 0,
    subjectObjectAgreementErrorCount: input?.subjectObjectAgreementErrorCount ?? 0,
    brokenNounPhraseCount: input?.brokenNounPhraseCount ?? 0,
    turkishSurfaceErrorCount: input?.turkishSurfaceErrorCount ?? 0,
    morphologyErrorCount: input?.morphologyErrorCount ?? 0,
    punctuationErrorCount: input?.punctuationErrorCount ?? 0,
    sentenceBoundaryErrorCount: input?.sentenceBoundaryErrorCount ?? 0,
    section5GenericSpecificDuplicationCount: input?.section5GenericSpecificDuplicationCount ?? 0,
  })
}

export function validateReportV2Privacy(payload: unknown): ReportV2ValidationResult {
  const text = JSON.stringify(payload)
  const violations = [EMAIL, UUID, CLIENT_CODE, RAW_PII_LABEL, RAW_INPUT_KEY].reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0)
  return result(violations ? ["PRIVACY_VIOLATION"] : [], { piiViolationCount: violations, requiredClaimCoverage: 100 })
}

export function validateLockedReportPlan(plan: LockedReportPlan): ReportV2ValidationResult {
  const failures: ReportV2ValidationFailureCode[] = []
  const claimIds = new Set(plan.claims.map((claim) => claim.id))
  if (plan.sections.length !== 8 || plan.sections.some((section, index) => section.heading !== REPORT_SECTION_HEADINGS[index])) failures.push("PLAN_INCOMPLETE")
  if (plan.caseEvidenceSourceMatrix?.version !== "case-evidence-source-matrix@2" || !plan.caseEvidenceSourceMatrix.entries.length || !Array.isArray(plan.caseEvidenceSourceMatrix.canonicalRelations)) failures.push("PLAN_INCOMPLETE")
  const canonicalKeys = plan.caseEvidenceSourceMatrix.canonicalRelations.map((relation) => `${[relation.sourceA, relation.sourceB].sort().join("|")}|${relation.domain ?? "none"}|${relation.construct}`)
  if (new Set(canonicalKeys).size !== canonicalKeys.length) failures.push("PLAN_INCOMPLETE")
  if (plan.claims.some((claim) => claim.sufficiency === "UNSUPPORTED")) failures.push("PLAN_INCOMPLETE")
  for (const section of plan.sections) {
    if (section.requiredClaimIds.some((id) => !claimIds.has(id) || !section.allowedClaimIds.includes(id))) failures.push("PLAN_INCOMPLETE")
    if (section.importantClaimIds.some((id) => !claimIds.has(id) || !section.allowedClaimIds.includes(id))) failures.push("PLAN_INCOMPLETE")
    if ([...section.requiredClaimIds, ...section.importantClaimIds, ...section.optionalClaimIds].some((id) => !section.allowedClaimIds.includes(id))) failures.push("PLAN_INCOMPLETE")
  }
  const section2 = plan.sections.find((section) => section.id === "section_2")
  const section3 = plan.sections.find((section) => section.id === "section_3")
  if (section2 && section3 && section2.allowedClaimIds.some((id) => section3.allowedClaimIds.includes(id))) failures.push("SECTION_2_3_SEMANTIC_OVERLAP")
  const literature = validateLiteratureBindings({ bindings: plan.literatureBindings, claims: plan.claims, decisionState: plan.decisionState, primaryFormulationId: plan.primaryFormulationId, ageMonths: plan.subjectAgeMonths })
  if (literature.caseDecisionAttributionCount) failures.push("LITERATURE_CASE_DECISION_ATTRIBUTION")
  if (literature.issues.some((issue) => !issue.endsWith(":case-decision-attribution"))) failures.push("LITERATURE_CLAIM_SOURCE_MISMATCH")
  const selectedByClaim = new Map(plan.knowledgeBridge.selectedAtoms.map((atom) => [atom.claimId, atom]))
  const irrelevantKnowledgeClaimCount = plan.knowledgeBridge.selectedAtoms.filter((atom) => atom.relevance !== "RELEVANT").length
  const selectedAtomKeys = new Set(plan.knowledgeBridge.selectedAtoms.map((atom) => `${atom.atomId}:${atom.sectionId}`))
  const nonMaterialKnowledgeClaimCount = plan.knowledgeBridge.relevanceDecisions.filter((entry) => selectedAtomKeys.has(`${entry.atomId}:${entry.sectionId}`) && entry.clinicalMateriality === "NON_MATERIAL").length
  const theoreticalExpansionKnowledgeCount = plan.knowledgeBridge.selectedAtoms.filter((atom) => atom.clinicalMateriality !== "MATERIAL" && atom.materialityReasons.includes("THEORETICAL_EXPANSION_RISK")).length
  const secondaryDomainOverexplanationCount = plan.knowledgeBridge.selectedAtoms.filter((atom) => atom.relevanceReasons.includes("SECONDARY_PRESERVED_WITHOUT_CASE_FUNCTION")).length
  if (irrelevantKnowledgeClaimCount) failures.push("IRRELEVANT_KNOWLEDGE_CLAIM")
  if (nonMaterialKnowledgeClaimCount) failures.push("NON_MATERIAL_KNOWLEDGE_CLAIM")
  if (secondaryDomainOverexplanationCount) failures.push("SECONDARY_DOMAIN_OVEREXPLANATION")
  let knowledgeAuthorityViolationCount = 0
  let knowledgeSourceViolationCount = 0
  let knowledgeCaseSpecificAdditionCount = 0
  for (const claim of plan.claims) {
    if (claim.knowledgeAuthority === "OWNER_BOOK") {
      const selected = selectedByClaim.get(claim.id)
      if (claim.claimType !== "OWNER_BOOK_INTERPRETATION" || claim.evidenceIds.length || claim.formulationId !== null) knowledgeAuthorityViolationCount += 1
      if (!selected || selected.sourceId !== claim.sourceIds[0] || !claim.knowledgeChunkIds.includes(selected.atomId) || !claim.knowledgeChunkIds.includes(selected.passageId)) knowledgeSourceViolationCount += 1
      if (CASE_SPECIFIC_OWNER_LANGUAGE.test(claim.text)) knowledgeCaseSpecificAdditionCount += 1
    } else if (claim.knowledgeAuthority === "EXTERNAL_LITERATURE") {
      if (claim.claimType !== "GENERAL_SCIENTIFIC_INTERPRETATION" || !plan.literatureBindings.some((binding) => binding.reportClaimId === claim.id && binding.sourceId === claim.sourceIds[0])) knowledgeAuthorityViolationCount += 1
    } else if (claim.sourceIds.includes("book.self-regulation.owner-current")) knowledgeSourceViolationCount += 1
  }
  for (const section of plan.sections.filter((entry) => ["section_1", "section_2", "section_6", "section_7"].includes(entry.id))) {
    knowledgeAuthorityViolationCount += section.allowedClaimIds.filter((id) => plan.claims.find((claim) => claim.id === id)?.knowledgeAuthority === "OWNER_BOOK").length
  }
  if (knowledgeAuthorityViolationCount) failures.push("KNOWLEDGE_AUTHORITY_VIOLATION")
  if (knowledgeSourceViolationCount) failures.push("KNOWLEDGE_SOURCE_VIOLATION")
  if (knowledgeCaseSpecificAdditionCount) failures.push("KNOWLEDGE_CASE_SPECIFIC_ADDITION")
  const privacy = validateReportV2Privacy(plan)
  failures.push(...privacy.failureCodes)
  return result(failures, {
    piiViolationCount: privacy.piiViolationCount,
    requiredClaimCoverage: failures.includes("PLAN_INCOMPLETE") ? 0 : 100,
    literatureCaseDecisionAttributionCount: literature.caseDecisionAttributionCount,
    irrelevantKnowledgeClaimCount,
    nonMaterialKnowledgeClaimCount,
    theoreticalExpansionKnowledgeCount,
    secondaryDomainOverexplanationCount,
    knowledgeAuthorityViolationCount,
    knowledgeSourceViolationCount,
    knowledgeCaseSpecificAdditionCount,
  })
}

function omissionFailures(input: Readonly<{
  plan: LockedReportPlan
  decisionPlan: ClinicalDecisionPlan
  matrix: ClinicalEvidenceMatrix
  usedClaimIds: ReadonlySet<string>
}>): Readonly<{ fatal: readonly ReportV2ValidationFailureCode[]; repairable: readonly ReportV2ValidationFailureCode[]; missingImportantClaimIds: readonly string[] }> {
  const failures: ReportV2ValidationFailureCode[] = []
  const repairable: ReportV2ValidationFailureCode[] = []
  const plannedClaimIds = new Set(input.plan.sections.flatMap((section) => section.allowedClaimIds))
  const omitted = (predicate: (claim: LockedReportPlan["claims"][number]) => boolean) => input.plan.claims.some((claim) => plannedClaimIds.has(claim.id) && predicate(claim) && !input.usedClaimIds.has(claim.id))
  const missingImportantClaimIds = input.plan.claims.filter((claim) => plannedClaimIds.has(claim.id) && claim.materiality === "IMPORTANT" && !input.usedClaimIds.has(claim.id)).map((claim) => claim.id)
  if (missingImportantClaimIds.length) repairable.push("IMPORTANT_CLAIM_OMITTED")
  if (omitted((claim) => claim.materiality === "REQUIRED" && claim.evidenceIds.length > 0 && claim.sufficiency === "SUPPORTED_MULTI_SOURCE")) failures.push("SUPPORTED_EVIDENCE_OMITTED")
  if (input.decisionPlan.contradictoryEvidence.length > 0 && omitted((claim) => claim.materiality === "REQUIRED" && claim.sufficiency === "CONFLICTED")) failures.push("CONTRADICTORY_EVIDENCE_OMITTED")
  if (input.decisionPlan.preservedCapacity.length > 0 && omitted((claim) => claim.materiality === "REQUIRED" && claim.role === "PRESERVED_CAPACITY")) failures.push("PRESERVED_CAPACITY_OMITTED")
  const externalDiscrepancy = input.matrix.discrepancyClusters.some((cluster) => cluster.evidenceIds.some((id) => id.startsWith("evidence.external.")))
  if (externalDiscrepancy && omitted((claim) => claim.materiality === "REQUIRED" && claim.sufficiency === "CONFLICTED" && (claim.id.startsWith("claim.external.") || claim.evidenceIds.some((id) => id.startsWith("evidence.external."))))) failures.push("EXTERNAL_TEST_DISCREPANCY_OMITTED")
  if (input.decisionPlan.limitations.length > 0 && omitted((claim) => claim.materiality === "REQUIRED" && claim.role === "LIMITATION" && (claim.sufficiency === "LIMITED" || claim.sufficiency === "CONFLICTED"))) failures.push("MAJOR_LIMITATION_OMITTED")
  return Object.freeze({ fatal: Object.freeze(unique(failures)), repairable: Object.freeze(unique(repairable)), missingImportantClaimIds: Object.freeze(unique(missingImportantClaimIds)) })
}

export function validateReportV2Realization(input: Readonly<{
  plan: LockedReportPlan
  decisionPlan: ClinicalDecisionPlan
  matrix: ClinicalEvidenceMatrix
  realization: ReportRealization
  plainClinicalTurkish?: PlainClinicalTurkishSummary
}>): ReportV2ValidationResult {
  const failures: ReportV2ValidationFailureCode[] = []
  if (input.realization.unsupportedAddition) failures.push("UNSUPPORTED_ADDITION")
  const sectionMap = new Map(input.realization.sections.map((section) => [section.sectionId, section]))
  if (input.realization.sections.length !== 8 || input.plan.sections.some((section) => !sectionMap.has(section.id))) failures.push("HEADING_CONTRACT_VIOLATION")
  const blankSectionCount = input.plan.sections.filter((section) => !(sectionMap.get(section.id)?.text.trim())).length
  if (blankSectionCount) failures.push("BLANK_SECTION")
  const claimMap = new Map(input.plan.claims.map((claim) => [claim.id, claim]))
  let required = 0
  let covered = 0
  let unsupportedRelationCount = 0
  let invalidUsedClaimIdCount = 0
  let unknownUsedClaimIdCount = 0
  let misplacedKnownClaimIdCount = 0
  for (const sectionPlan of input.plan.sections) {
    const realized = sectionMap.get(sectionPlan.id)
    if (!realized) continue
    required += sectionPlan.requiredClaimIds.length
    covered += sectionPlan.requiredClaimIds.filter((id) => realized.usedClaimIds.includes(id)).length
    if (sectionPlan.requiredClaimIds.some((id) => !realized.usedClaimIds.includes(id))) failures.push("REQUIRED_CLAIM_OMITTED")
    const unknownUsedIds = realized.usedClaimIds.filter((id) => !claimMap.has(id))
    const misplacedKnownIds = realized.usedClaimIds.filter((id) => claimMap.has(id) && !sectionPlan.allowedClaimIds.includes(id))
    const invalidUsedIds = [...unknownUsedIds, ...misplacedKnownIds]
    invalidUsedClaimIdCount += invalidUsedIds.length
    unknownUsedClaimIdCount += unknownUsedIds.length
    misplacedKnownClaimIdCount += misplacedKnownIds.length
    if (invalidUsedIds.length) failures.push("UNSUPPORTED_ADDITION")
    const allowedClaims = realized.usedClaimIds.map((id) => claimMap.get(id)).filter(Boolean) as LockedReportPlan["claims"][number][]
    const allowedText = allowedClaims.map((claim) => claim.text).join(" ")
    const allowedNumbers = numbers(allowedText)
    if ([...numbers(realized.text)].some((value) => !allowedNumbers.has(value))) failures.push("INVENTED_NUMBER")
    const causalMarkers = realized.text.match(CAUSAL)?.length ?? 0
    if (causalMarkers) {
      unsupportedRelationCount += causalMarkers
      failures.push("UNSUPPORTED_RELATION")
    }
  }
  const usedClaimIds = new Set(input.realization.sections.flatMap((section) => section.usedClaimIds))
  const omissions = omissionFailures({ ...input, usedClaimIds })
  failures.push(...omissions.fatal)
  const substance = clinicalSubstanceAudit(input)
  if (substance.insufficientCount) failures.push("INSUFFICIENT_CLINICAL_SUBSTANCE")
  for (const sectionId of ["section_1", "section_4", "section_6", "section_7"] as const) {
    if (!sectionMap.get(sectionId)?.usedClaimIds.includes(input.plan.primaryDecisionClaimId)) failures.push("CROSS_SECTION_PRIMARY_FORMULATION_MISMATCH")
  }
  for (const sectionId of ["section_1", "section_6"] as const) {
    if (!sectionMap.get(sectionId)?.usedClaimIds.includes("claim.confidence")) failures.push("CROSS_SECTION_CONFIDENCE_MISMATCH")
  }
  const primaryAnchor = input.plan.claims.find((claim) => claim.id === input.plan.primaryDecisionClaimId)
  if (input.plan.decisionState === "FORMULATED" && (!primaryAnchor?.formulationId || primaryAnchor.formulationId !== input.plan.primaryFormulationId)) failures.push("CROSS_SECTION_CONTRADICTION")
  const finalText = renderReportRealization(input.plan, input.realization)
  const finalBodyText = input.realization.sections.map((section) => section.text).join("\n\n")
  const sections1To7 = input.realization.sections.filter((section) => section.sectionId !== "section_8")
  const contentText = clinicalContentEditorTextDiagnostics(input.realization)
  const prescriptiveRecommendationLeakCount = contentText.prescriptiveRecommendationLeakCount
  const wrongSectionGenericClaimCount = sections1To7.reduce((sum, section) => sum + section.usedClaimIds.filter((id) => {
    const authority = claimMap.get(id)?.knowledgeAuthority
    return authority === "OWNER_BOOK" || authority === "EXTERNAL_LITERATURE"
  }).length, 0)
  const wrongSectionGenericKnowledgeCount = wrongSectionGenericClaimCount + contentText.wrongSectionGenericKnowledgeTextCount
  const otherChildExampleCount = contentText.otherChildExampleCount
  const genericTemplateInjectionCount = contentText.genericTemplateInjectionCount
  const unexplainedConfidenceConflictCount = contentText.unexplainedConfidenceConflictCount
  if (prescriptiveRecommendationLeakCount) failures.push("PRESCRIPTIVE_RECOMMENDATION_LEAK")
  if (wrongSectionGenericKnowledgeCount) failures.push("WRONG_SECTION_GENERIC_KNOWLEDGE")
  if (otherChildExampleCount) failures.push("OTHER_CHILD_EXAMPLE")
  if (genericTemplateInjectionCount) failures.push("GENERIC_TEMPLATE_INJECTION")
  if (unexplainedConfidenceConflictCount) failures.push("UNEXPLAINED_CONFIDENCE_CONFLICT")
  const section2Claims = new Set(sectionMap.get("section_2")?.usedClaimIds ?? [])
  const section23ClaimOverlapCount = (sectionMap.get("section_3")?.usedClaimIds ?? []).filter((id) => section2Claims.has(id)).length
  if (section23ClaimOverlapCount) failures.push("SECTION_2_3_SEMANTIC_OVERLAP")
  const preservedDomainOverinterpretationCount = input.plan.claims.filter((claim) => {
    if (!claim.id.startsWith("claim.domain-interpretation.")) return false
    const scoreEvidence = claim.evidenceIds.map((id) => input.matrix.units.find((unit) => unit.id === id)).find((unit) => unit?.sourceType === "DNA_DOMAIN_SCORE")
    if (!scoreEvidence?.finding.includes("Tipik")) return false
    const hasCaseSpecificDifficulty = claim.evidenceIds.map((id) => input.matrix.units.find((unit) => unit.id === id)).some((unit) => unit?.direction === "SUPPORTS" && ["CAREGIVER_REPORT", "THERAPIST_OBSERVATION", "EXTERNAL_ASSESSMENT"].includes(unit.sourceType))
    return !hasCaseSpecificDifficulty && /(?:değişebilir|zorlaşabilir|uzayabilir|desteğe duyarlı olabilir|güçleşebilir)/i.test(claim.text)
  }).length
  if (preservedDomainOverinterpretationCount) failures.push("PRESERVED_DOMAIN_OVERINTERPRETATION")
  const literatureBindingAudit = validateLiteratureBindings({ bindings: input.plan.literatureBindings, claims: input.plan.claims, decisionState: input.plan.decisionState, primaryFormulationId: input.plan.primaryFormulationId, ageMonths: input.plan.subjectAgeMonths })
  const section8 = sectionMap.get("section_8")
  const literatureDirectSupport = auditLiteratureDirectSupport({ bindings: input.plan.literatureBindings, realization: input.realization })
  if (literatureDirectSupport.exactPassageMissingCount) failures.push("EXACT_PASSAGE_MISSING")
  if (literatureDirectSupport.claimSourceMismatchCount) failures.push("CLAIM_SOURCE_MISMATCH")
  if (literatureDirectSupport.claimPassageOverreachCount) failures.push("CLAIM_PASSAGE_OVERREACH")
  if (literatureDirectSupport.topicOnlyCitationCount) failures.push("TOPIC_ONLY_CITATION")
  if (literatureDirectSupport.wrongConstructCitationCount) failures.push("WRONG_CONSTRUCT_CITATION")
  const literatureCaseDecisionAttributionCount = literatureBindingAudit.caseDecisionAttributionCount + (section8?.usedClaimIds.filter((id) => !["GENERAL_SCIENTIFIC_INTERPRETATION", "OWNER_BOOK_INTERPRETATION"].includes(claimMap.get(id)?.claimType ?? "")).length ?? 0)
  if (literatureCaseDecisionAttributionCount) failures.push("LITERATURE_CASE_DECISION_ATTRIBUTION")
  const literatureFormattingFailures: ReportV2ValidationFailureCode[] = []
  const literatureText = section8?.text.trim() ?? ""
  const quoteCount = (literatureText.match(/[“”"]/g) ?? []).length
  if (quoteCount % 2 !== 0 || /[“”][^“”]{0,20}[.!?]?$/u.test(literatureText)) literatureFormattingFailures.push("ORPHAN_QUOTE")
  const literatureParagraphs = literatureText.split(/\n{2,}/u).map((paragraph) => paragraph.trim()).filter(Boolean)
  if (literatureParagraphs.some((paragraph) => normalizedSentence(paragraph).length < 25)) literatureFormattingFailures.push("LITERATURE_FRAGMENT")
  if (!literatureParagraphs.length || literatureParagraphs.some((paragraph) => !/[.!?)]$/u.test(paragraph))) literatureFormattingFailures.push("INCOMPLETE_SENTENCE")
  const normalized = sentenceList(finalText).map(normalizedSentence).filter((sentence) => sentence.length >= 35)
  const repeated = normalized.filter((sentence, index) => normalized.indexOf(sentence) !== index)
  const repetitionScore = normalized.length ? Number((unique(repeated).length / normalized.length * 100).toFixed(2)) : 0
  if (repetitionScore > 12) failures.push("EXCESSIVE_REPETITION")
  if (INTERNAL_LANGUAGE.test(finalBodyText)) failures.push("INTERNAL_LANGUAGE_LEAK")
  const language = reportLanguageDiagnostics(finalBodyText)
  const plainLanguage = plainClinicalLanguageDiagnostics(input.realization)
  const readability = humanReadabilityDiagnostics(input.realization)
  const humanEditor = humanClinicalEditorDiagnostics(input.realization)
  const consistency = auditIntraSectionConsistency({ matrix: input.matrix, realization: input.realization })
  const relationConsistency = auditEvidenceRelationConsistency({ plan: input.plan, realization: input.realization })
  const morphology = auditTurkishMorphology(input.realization)
  const finalSurface = auditFinalTurkishSurface(input.realization)
  const section5Deduplication = auditSection5GenericSpecificDuplication(input.realization)
  const repeatedTemplatePhrases = repeatedTemplatePhraseDiagnostics(finalBodyText)
  const section2ThresholdSentences = section2ThresholdSentenceCount(sectionMap.get("section_2")?.text ?? "")
  const internalEngineJargonCount = language.internalEngineJargonCount
  const systemLikeLanguageCount = language.systemLikeLanguageCount
  const awkwardAcademicLanguageCount = language.awkwardAcademicLanguageCount + language.artificialLexicalUsageCount
  if (internalEngineJargonCount) failures.push("INTERNAL_ENGINE_JARGON")
  if (systemLikeLanguageCount) failures.push("SYSTEM_LIKE_LANGUAGE")
  if (plainLanguage.nominalizationOverloadCount) failures.push("NOMINALIZATION_OVERLOAD")
  if (plainLanguage.abstractClinicalLanguageCount) failures.push("ABSTRACT_CLINICAL_LANGUAGE")
  if (plainLanguage.unclearAgentCount) failures.push("UNCLEAR_AGENT")
  if (plainLanguage.unclearDailyLifeMeaningCount) failures.push("UNCLEAR_DAILY_LIFE_MEANING")
  const meaningDriftCount = input.plainClinicalTurkish?.meaningDriftCount ?? 0
  if (meaningDriftCount) failures.push("MEANING_DRIFT")
  const semanticStrengtheningCount = input.plainClinicalTurkish?.semanticStrengtheningCount ?? 0
  const newSpecificityCount = input.plainClinicalTurkish?.newSpecificityCount ?? 0
  const newInterventionDetailCount = input.plainClinicalTurkish?.newInterventionDetailCount ?? 0
  const certaintyDriftCount = input.plainClinicalTurkish?.certaintyDriftCount ?? 0
  const nonMaterialKnowledgeReentryCount = input.plainClinicalTurkish?.nonMaterialKnowledgeReentryCount ?? 0
  const semanticMicroRepetitionCount = input.plainClinicalTurkish?.semanticMicroRepetitionCount ?? 0
  const plainTurkishGrammarErrorCount = Math.max(plainLanguage.plainTurkishGrammarErrorCount, input.plainClinicalTurkish?.plainTurkishGrammarErrorCount ?? 0)
  if (semanticStrengtheningCount) failures.push("SEMANTIC_STRENGTHENING")
  if (newSpecificityCount) failures.push("NEW_SPECIFICITY")
  if (newInterventionDetailCount) failures.push("NEW_INTERVENTION_DETAIL")
  if (certaintyDriftCount) failures.push("CERTAINTY_DRIFT")
  if (nonMaterialKnowledgeReentryCount) failures.push("NON_MATERIAL_KNOWLEDGE_REENTRY")
  if (semanticMicroRepetitionCount) failures.push("SEMANTIC_MICRO_REPETITION")
  if (plainTurkishGrammarErrorCount) failures.push("PLAIN_TURKISH_GRAMMAR_ERROR")
  if (readability.grammarFragmentCount) failures.push("GRAMMAR_FRAGMENT")
  if (readability.semanticContradictionCount) failures.push("SEMANTIC_CONTRADICTION")
  if (readability.awkwardGenericPhraseCount) failures.push("AWKWARD_GENERIC_PHRASE")
  if (humanEditor.semanticParagraphRepetitionCount) failures.push("SEMANTIC_PARAGRAPH_REPETITION")
  if (humanEditor.systemLikeProseCount) failures.push("HUMAN_EDITOR_SYSTEM_PROSE")
  if (language.internalLabelLeakageCount) failures.push("INTERNAL_LABEL_LEAKAGE")
  if (awkwardAcademicLanguageCount) failures.push("AWKWARD_ACADEMIC_LANGUAGE")
  if (language.terminologyDriftCount) failures.push("TERMINOLOGY_DRIFT")
  if (language.brokenSuffixCount) failures.push("BROKEN_SUFFIX")
  if (language.duplicateSuffixCount) failures.push("DUPLICATE_SUFFIX")
  if (language.sentenceMergeErrorCount) failures.push("SENTENCE_MERGE_ERROR")
  if (language.brokenWordCount) failures.push("BROKEN_WORD")
  if (repeatedTemplatePhrases.repeated > 0) failures.push("REPEATED_TEMPLATE_PHRASE")
  if (section2ThresholdSentences > 1) failures.push("SECTION_2_THRESHOLD_REPETITION")
  if (consistency.intraSectionContradictionCount) failures.push("INTRA_SECTION_CONTRADICTION")
  if (consistency.crossEvidenceContradictionCount) failures.push("UNRESOLVED_EVIDENCE_CONTRADICTION")
  if (relationConsistency.sourcePairRelationContradictionCount) failures.push("SOURCE_PAIR_RELATION_CONTRADICTION")
  if (relationConsistency.crossSectionRelationDriftCount) failures.push("CROSS_SECTION_RELATION_DRIFT")
  if (relationConsistency.sameDirectionFalseAssertionCount) failures.push("SAME_DIRECTION_FALSE_ASSERTION")
  if (morphology.turkishMorphologyErrorCount) failures.push("TURKISH_MORPHOLOGY_ERROR")
  if (morphology.subjectObjectAgreementErrorCount) failures.push("SUBJECT_OBJECT_AGREEMENT_ERROR")
  if (morphology.brokenNounPhraseCount) failures.push("BROKEN_NOUN_PHRASE")
  if (finalSurface.turkishSurfaceErrorCount) failures.push("TURKISH_SURFACE_ERROR")
  if (finalSurface.morphologyErrorCount) failures.push("MORPHOLOGY_ERROR")
  if (finalSurface.punctuationErrorCount) failures.push("PUNCTUATION_ERROR")
  if (finalSurface.sentenceBoundaryErrorCount) failures.push("SENTENCE_BOUNDARY_ERROR")
  if (section5Deduplication.section5GenericSpecificDuplicationCount) failures.push("SECTION5_GENERIC_SPECIFIC_DUPLICATION")
  const ownerCopyCount = ownerBookVerbatimCopyCount(input.plan, finalText)
  if (ownerCopyCount) failures.push("OWNER_BOOK_VERBATIM_COPY")
  const crossSectionRepetitions = crossSectionRepetitionCount(input.realization.sections)
  const semanticCrossSectionRepeats = semanticCrossSectionRepeatCount(input.realization.sections)
  if (crossSectionRepetitions || semanticCrossSectionRepeats) failures.push("EXCESSIVE_REPETITION")
  const usedOwnerClaims = [...usedClaimIds].map((id) => claimMap.get(id)).filter((claim) => claim?.knowledgeAuthority === "OWNER_BOOK")
  const knowledgeAuthorityViolationCount = usedOwnerClaims.filter((claim) => claim?.claimType !== "OWNER_BOOK_INTERPRETATION").length
  const knowledgeSourceViolationCount = usedOwnerClaims.filter((claim) => !claim?.sourceIds.includes("book.self-regulation.owner-current")).length
  const knowledgeCaseSpecificAdditionCount = usedOwnerClaims.filter((claim) => CASE_SPECIFIC_OWNER_LANGUAGE.test(claim?.text ?? "")).length
  if (knowledgeAuthorityViolationCount) failures.push("KNOWLEDGE_AUTHORITY_VIOLATION")
  if (knowledgeSourceViolationCount) failures.push("KNOWLEDGE_SOURCE_VIOLATION")
  if (knowledgeCaseSpecificAdditionCount) failures.push("KNOWLEDGE_CASE_SPECIFIC_ADDITION")
  const safety = validateAndNormalizeClinicalReport(finalText)
  if (safety.criticalIssues.length) failures.push("SAFETY_VIOLATION")
  const privacy = validateReportV2Privacy(input.realization)
  failures.push(...privacy.failureCodes)
  const omissionCodes = failures.filter((code) => code.includes("OMITTED"))
  return result(failures, {
    repairableFailureCodes: unique([
      ...omissions.repairable,
      ...literatureFormattingFailures,
      ...(internalEngineJargonCount ? ["INTERNAL_ENGINE_JARGON" as const] : []),
      ...(systemLikeLanguageCount ? ["SYSTEM_LIKE_LANGUAGE" as const] : []),
      ...(plainLanguage.nominalizationOverloadCount ? ["NOMINALIZATION_OVERLOAD" as const] : []),
      ...(plainLanguage.abstractClinicalLanguageCount ? ["ABSTRACT_CLINICAL_LANGUAGE" as const] : []),
      ...(plainLanguage.unclearAgentCount ? ["UNCLEAR_AGENT" as const] : []),
      ...(plainLanguage.unclearDailyLifeMeaningCount ? ["UNCLEAR_DAILY_LIFE_MEANING" as const] : []),
      ...(semanticMicroRepetitionCount ? ["SEMANTIC_MICRO_REPETITION" as const] : []),
      ...(plainTurkishGrammarErrorCount ? ["PLAIN_TURKISH_GRAMMAR_ERROR" as const] : []),
      ...(readability.grammarFragmentCount ? ["GRAMMAR_FRAGMENT" as const] : []),
      ...(readability.semanticContradictionCount ? ["SEMANTIC_CONTRADICTION" as const] : []),
      ...(readability.awkwardGenericPhraseCount ? ["AWKWARD_GENERIC_PHRASE" as const] : []),
      ...(humanEditor.semanticParagraphRepetitionCount ? ["SEMANTIC_PARAGRAPH_REPETITION" as const] : []),
      ...(humanEditor.systemLikeProseCount ? ["HUMAN_EDITOR_SYSTEM_PROSE" as const] : []),
      ...(prescriptiveRecommendationLeakCount ? ["PRESCRIPTIVE_RECOMMENDATION_LEAK" as const] : []),
      ...(wrongSectionGenericKnowledgeCount ? ["WRONG_SECTION_GENERIC_KNOWLEDGE" as const] : []),
      ...(otherChildExampleCount ? ["OTHER_CHILD_EXAMPLE" as const] : []),
      ...(genericTemplateInjectionCount ? ["GENERIC_TEMPLATE_INJECTION" as const] : []),
      ...(unexplainedConfidenceConflictCount ? ["UNEXPLAINED_CONFIDENCE_CONFLICT" as const] : []),
      ...(language.internalLabelLeakageCount ? ["INTERNAL_LABEL_LEAKAGE" as const] : []),
      ...(awkwardAcademicLanguageCount ? ["AWKWARD_ACADEMIC_LANGUAGE" as const] : []),
      ...(language.terminologyDriftCount ? ["TERMINOLOGY_DRIFT" as const] : []),
      ...(language.brokenSuffixCount ? ["BROKEN_SUFFIX" as const] : []),
      ...(language.duplicateSuffixCount ? ["DUPLICATE_SUFFIX" as const] : []),
      ...(language.sentenceMergeErrorCount ? ["SENTENCE_MERGE_ERROR" as const] : []),
      ...(language.brokenWordCount ? ["BROKEN_WORD" as const] : []),
      ...(repeatedTemplatePhrases.repeated > 0 ? ["REPEATED_TEMPLATE_PHRASE" as const] : []),
      ...(section2ThresholdSentences > 1 ? ["SECTION_2_THRESHOLD_REPETITION" as const] : []),
      ...(consistency.intraSectionContradictionCount ? ["INTRA_SECTION_CONTRADICTION" as const] : []),
      ...(consistency.crossEvidenceContradictionCount ? ["UNRESOLVED_EVIDENCE_CONTRADICTION" as const] : []),
      ...(relationConsistency.sourcePairRelationContradictionCount ? ["SOURCE_PAIR_RELATION_CONTRADICTION" as const] : []),
      ...(relationConsistency.crossSectionRelationDriftCount ? ["CROSS_SECTION_RELATION_DRIFT" as const] : []),
      ...(relationConsistency.sameDirectionFalseAssertionCount ? ["SAME_DIRECTION_FALSE_ASSERTION" as const] : []),
      ...(morphology.turkishMorphologyErrorCount ? ["TURKISH_MORPHOLOGY_ERROR" as const] : []),
      ...(morphology.subjectObjectAgreementErrorCount ? ["SUBJECT_OBJECT_AGREEMENT_ERROR" as const] : []),
      ...(morphology.brokenNounPhraseCount ? ["BROKEN_NOUN_PHRASE" as const] : []),
      ...(finalSurface.turkishSurfaceErrorCount ? ["TURKISH_SURFACE_ERROR" as const] : []),
      ...(finalSurface.morphologyErrorCount ? ["MORPHOLOGY_ERROR" as const] : []),
      ...(finalSurface.punctuationErrorCount ? ["PUNCTUATION_ERROR" as const] : []),
      ...(finalSurface.sentenceBoundaryErrorCount ? ["SENTENCE_BOUNDARY_ERROR" as const] : []),
      ...(section5Deduplication.section5GenericSpecificDuplicationCount ? ["SECTION5_GENERIC_SPECIFIC_DUPLICATION" as const] : []),
      ...(literatureDirectSupport.exactPassageMissingCount ? ["EXACT_PASSAGE_MISSING" as const] : []),
      ...(literatureDirectSupport.claimSourceMismatchCount ? ["CLAIM_SOURCE_MISMATCH" as const] : []),
      ...(literatureDirectSupport.claimPassageOverreachCount ? ["CLAIM_PASSAGE_OVERREACH" as const] : []),
      ...(literatureDirectSupport.topicOnlyCitationCount ? ["TOPIC_ONLY_CITATION" as const] : []),
      ...(literatureDirectSupport.wrongConstructCitationCount ? ["WRONG_CONSTRUCT_CITATION" as const] : []),
      ...(ownerCopyCount ? ["OWNER_BOOK_VERBATIM_COPY" as const] : []),
      ...(crossSectionRepetitions > 0 || semanticCrossSectionRepeats > 0 ? ["EXCESSIVE_REPETITION" as const] : []),
      ...(
        unknownUsedClaimIdCount === 0
        && (
          misplacedKnownClaimIdCount > 0
          || (input.realization.unsupportedAddition && (input.realization.unsupportedSectionIds?.length ?? 0) > 0 && invalidUsedClaimIdCount === 0)
        )
          ? ["UNSUPPORTED_ADDITION" as const]
          : []
      ),
    ]),
    missingImportantClaimIds: omissions.missingImportantClaimIds,
    requiredClaimCoverage: required ? Number((covered / required * 100).toFixed(2)) : 100,
    unsupportedRelationCount,
    omissionCount: omissionCodes.length + omissions.missingImportantClaimIds.length,
    repetitionScore,
    section23ClaimOverlapCount,
    piiViolationCount: privacy.piiViolationCount,
    preservedDomainOverinterpretationCount,
    literatureCaseDecisionAttributionCount,
    literatureFormattingErrorCount: literatureFormattingFailures.length,
    citationBackedClaimCount: literatureDirectSupport.citationBackedClaimCount,
    exactPassageMissingCount: literatureDirectSupport.exactPassageMissingCount,
    claimSourceMismatchCount: literatureDirectSupport.claimSourceMismatchCount,
    claimPassageOverreachCount: literatureDirectSupport.claimPassageOverreachCount,
    topicOnlyCitationCount: literatureDirectSupport.topicOnlyCitationCount,
    wrongConstructCitationCount: literatureDirectSupport.wrongConstructCitationCount,
    internalEngineJargonCount,
    systemLikeLanguageCount,
    nominalizationOverloadCount: plainLanguage.nominalizationOverloadCount,
    abstractClinicalLanguageCount: plainLanguage.abstractClinicalLanguageCount,
    unclearAgentCount: plainLanguage.unclearAgentCount,
    unclearDailyLifeMeaningCount: plainLanguage.unclearDailyLifeMeaningCount,
    meaningDriftCount,
    semanticStrengtheningCount,
    newSpecificityCount,
    newInterventionDetailCount,
    certaintyDriftCount,
    nonMaterialKnowledgeReentryCount,
    semanticMicroRepetitionCount,
    plainTurkishGrammarErrorCount,
    grammarFragmentCount: readability.grammarFragmentCount,
    semanticContradictionCount: readability.semanticContradictionCount,
    awkwardGenericPhraseCount: readability.awkwardGenericPhraseCount,
    semanticParagraphRepetitionCount: humanEditor.semanticParagraphRepetitionCount,
    humanEditorSystemLikeProseCount: humanEditor.systemLikeProseCount,
    prescriptiveRecommendationLeakCount,
    wrongSectionGenericKnowledgeCount,
    otherChildExampleCount,
    genericTemplateInjectionCount,
    unexplainedConfidenceConflictCount,
    internalLabelLeakageCount: language.internalLabelLeakageCount,
    awkwardAcademicLanguageCount,
    terminologyDriftCount: language.terminologyDriftCount,
    brokenSuffixCount: language.brokenSuffixCount,
    duplicateSuffixCount: language.duplicateSuffixCount,
    sentenceMergeErrorCount: language.sentenceMergeErrorCount,
    brokenWordCount: language.brokenWordCount,
    irrelevantKnowledgeClaimCount: input.plan.knowledgeBridge.selectedAtoms.filter((atom) => atom.relevance !== "RELEVANT").length,
    nonMaterialKnowledgeClaimCount: input.plan.knowledgeBridge.relevanceDecisions.filter((entry) => input.plan.knowledgeBridge.selectedAtoms.some((atom) => atom.atomId === entry.atomId && atom.sectionId === entry.sectionId) && entry.clinicalMateriality === "NON_MATERIAL").length,
    theoreticalExpansionKnowledgeCount: input.plan.knowledgeBridge.selectedAtoms.filter((atom) => atom.clinicalMateriality !== "MATERIAL" && atom.materialityReasons.includes("THEORETICAL_EXPANSION_RISK")).length,
    secondaryDomainOverexplanationCount: input.plan.knowledgeBridge.selectedAtoms.filter((atom) => atom.relevanceReasons.includes("SECONDARY_PRESERVED_WITHOUT_CASE_FUNCTION")).length,
    repeatedTemplatePhraseCount: repeatedTemplatePhrases.total,
    section2RepeatedThresholdSentenceCount: section2ThresholdSentences,
    intraSectionContradictionCount: consistency.intraSectionContradictionCount,
    crossEvidenceContradictionCount: consistency.crossEvidenceContradictionCount,
    semanticPolarityConflictCount: consistency.semanticPolarityConflictCount,
    reconciliationSentenceCount: consistency.reconciliationSentenceCount,
    duplicateReconciliationCount: consistency.duplicateReconciliationCount,
    consistencyConflictSectionIds: unique([...consistency.conflictSectionIds, ...relationConsistency.conflictSectionIds, ...morphology.conflictSectionIds, ...finalSurface.conflictSectionIds, ...section5Deduplication.conflictSectionIds, ...(literatureDirectSupport.exactPassageMissingCount + literatureDirectSupport.claimSourceMismatchCount + literatureDirectSupport.claimPassageOverreachCount + literatureDirectSupport.topicOnlyCitationCount + literatureDirectSupport.wrongConstructCitationCount > 0 ? ["section_8" as const] : [])]),
    ownerBookVerbatimCopyCount: ownerCopyCount,
    crossSectionRepetitionCount: crossSectionRepetitions,
    semanticCrossSectionRepeatCount: semanticCrossSectionRepeats,
    lexicalQaCounts: language.lexicalQa,
    knowledgeAuthorityViolationCount,
    knowledgeSourceViolationCount,
    knowledgeCaseSpecificAdditionCount,
    blankSectionCount,
    section4ClinicalSubstanceStatus: substance.section4Status,
    section5ClinicalSubstanceStatus: substance.section5Status,
    insufficientClinicalSubstanceCount: substance.insufficientCount,
    limitedByAvailableEvidenceSectionCount: substance.limitedCount,
    sourcePairSynthesisCount: substance.sourcePairSynthesisCount,
    sourcePairRelationContradictionCount: relationConsistency.sourcePairRelationContradictionCount,
    crossSectionRelationDriftCount: relationConsistency.crossSectionRelationDriftCount,
    sameDirectionFalseAssertionCount: relationConsistency.sameDirectionFalseAssertionCount,
    turkishMorphologyErrorCount: morphology.turkishMorphologyErrorCount,
    subjectObjectAgreementErrorCount: morphology.subjectObjectAgreementErrorCount,
    brokenNounPhraseCount: morphology.brokenNounPhraseCount,
    turkishSurfaceErrorCount: finalSurface.turkishSurfaceErrorCount,
    morphologyErrorCount: finalSurface.morphologyErrorCount,
    punctuationErrorCount: finalSurface.punctuationErrorCount,
    sentenceBoundaryErrorCount: finalSurface.sentenceBoundaryErrorCount,
    section5GenericSpecificDuplicationCount: section5Deduplication.section5GenericSpecificDuplicationCount,
  })
}
