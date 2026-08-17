import type { ClinicalMechanismType } from "../clinicalAnalysis"
import type { DomainKey, DomainLevel, DeterministicReport, ReportInput } from "../reportEngine"

export const REPORT_V2_VERSION = "dna-report-v2.3-shadow@1" as const
export const REPORT_V2_TRACE_VERSION = "dna-report-v2.3-trace@1" as const

export const REPORT_SECTION_HEADINGS = [
  "1. Klinik Karar Özeti",
  "2. Klinik Kanıt Profili",
  "3. Alan Bazlı Klinik Yorum",
  "4. Klinik Örüntü ve Formülasyon",
  "5. Anamnez, Gözlem ve Test Uyumunun Değerlendirilmesi",
  "6. Klinik Önceliklendirme Notu",
  "7. Klinik Sonuç",
  "8. Literatürle Uyumlu Klinik Dayanak",
] as const

export type ReportSectionId = "section_1" | "section_2" | "section_3" | "section_4" | "section_5" | "section_6" | "section_7" | "section_8"
export type EvidenceSourceType =
  | "DNA_TOTAL_SCORE"
  | "DNA_DOMAIN_SCORE"
  | "DNA_ITEM_PATTERN"
  | "ANAMNESIS"
  | "CAREGIVER_REPORT"
  | "THERAPIST_OBSERVATION"
  | "EXTERNAL_ASSESSMENT"
  | "PRESERVED_CAPACITY"
  | "COUNTER_EVIDENCE"
  | "CONTEXTUAL_EVIDENCE"
  | "MISSING_INFORMATION"

export type EvidenceDirection = "SUPPORTS" | "LIMITS" | "CONTRADICTS" | "NEUTRAL"
export type EvidenceReliability = 1 | 2 | 3
export type EvidenceStrength = 1 | 2 | 3
export type EvidenceRelationType =
  | "CONVERGENT"
  | "PARTIALLY_CONVERGENT"
  | "COMPLEMENTARY"
  | "CONTEXTUAL_MODULATION"
  | "DISCREPANT"
  | "NOT_COMPARABLE"
  | "INSUFFICIENT"

export type FormulationId =
  | Exclude<ClinicalMechanismType, "default">
  | `domain_${DomainKey}`
  | "balanced"
  | "multi_domain"

export type ClinicalDecisionState = "FORMULATED" | "UNCERTAIN"

export type ClinicalEvidenceUnit = Readonly<{
  id: string
  sourceType: EvidenceSourceType
  domain: DomainKey | "global" | null
  construct: string
  finding: string
  direction: EvidenceDirection
  strength: EvidenceStrength
  reliability: EvidenceReliability
  specificity: EvidenceReliability
  context: readonly string[]
  supports: readonly FormulationId[]
  contradicts: readonly FormulationId[]
  limits: readonly FormulationId[]
  provenance: Readonly<{
    sourceRef: string
    ruleId: string
    inputHash?: string
  }>
}>

export type ClinicalEvidenceRelation = Readonly<{
  id: string
  leftEvidenceId: string
  rightEvidenceId: string
  type: EvidenceRelationType
  rationale: string
  discrepancyClusterId: string | null
}>

export type ClinicalDiscrepancyCluster = Readonly<{
  id: string
  domain: DomainKey | "global" | null
  construct: string
  evidenceIds: readonly string[]
  relationIds: readonly string[]
  sourceTypes: readonly EvidenceSourceType[]
  hard: boolean
}>

export type ClinicalEvidenceMatrix = Readonly<{
  version: "clinical-evidence-matrix@2.1"
  units: readonly ClinicalEvidenceUnit[]
  relations: readonly ClinicalEvidenceRelation[]
  discrepancyClusters: readonly ClinicalDiscrepancyCluster[]
  sourceCoverage: Readonly<Record<EvidenceSourceType, number>>
}>

export type FormulationFit = "LOW" | "MODERATE" | "HIGH"
export type EvidenceConfidence = "LOW" | "MODERATE" | "MODERATE_HIGH" | "HIGH"

export type CandidateFormulation = Readonly<{
  id: FormulationId
  supportingEvidenceIds: readonly string[]
  contradictoryEvidenceIds: readonly string[]
  limitingEvidenceIds: readonly string[]
  preservedCapacityEvidenceIds: readonly string[]
  independentSourceTypes: readonly EvidenceSourceType[]
  functionalEvidenceIds: readonly string[]
  overallEvidenceScore: number
  fit: FormulationFit
  hardContradiction: boolean
  eligibleForPrimary: boolean
}>

export type ConfidenceBreakdown = Readonly<{
  evidenceCompleteness: ConfidenceDimension
  evidenceConsistency: ConfidenceDimension
  formulationConfidence: ConfidenceDimension
  level: EvidenceConfidence
  score: number
  positiveFactors: readonly string[]
  negativeFactors: readonly string[]
}>

export type ConfidenceDimension = Readonly<{
  level: EvidenceConfidence
  score: number
  positiveFactors: readonly string[]
  negativeFactors: readonly string[]
}>

export type EvidenceSufficiency =
  | "SUPPORTED_DIRECT"
  | "SUPPORTED_MULTI_SOURCE"
  | "SUPPORTED_DERIVED"
  | "LIMITED"
  | "CONFLICTED"
  | "UNSUPPORTED"

export type ClaimRole =
  | "FINDING"
  | "INTERPRETATION"
  | "RELATION"
  | "FUNCTIONAL_IMPLICATION"
  | "LIMITATION"
  | "ALTERNATIVE"
  | "PRESERVED_CAPACITY"

export type ReportMateriality = "REQUIRED" | "IMPORTANT" | "OPTIONAL"

export type ReportClaimType =
  | "CASE_FINDING"
  | "CASE_INTERPRETATION"
  | "CASE_DECISION"
  | "CONFIDENCE_DECISION"
  | "FORMULATION_SELECTION"
  | "OWNER_BOOK_INTERPRETATION"
  | "GENERAL_SCIENTIFIC_INTERPRETATION"
  | "SAFETY_BOUNDARY"

export type ReportKnowledgeAuthority = "CASE_EVIDENCE" | "OWNER_BOOK" | "EXTERNAL_LITERATURE"

export type ReportKnowledgeEligibility = "REPORT_ELIGIBLE" | "NOT_REPORT_ELIGIBLE" | "NEEDS_REVIEW"

export type ReportKnowledgeRelevance = "RELEVANT" | "OPTIONAL_LOW_VALUE" | "IRRELEVANT"

export type ReportClinicalMateriality = "MATERIAL" | "SUPPORTIVE_BUT_NONESSENTIAL" | "NON_MATERIAL"

export type ReportKnowledgeRole =
  | "DOMAIN_INTERPRETATION"
  | "CORE_DEFINITION"
  | "FUNCTIONAL_MEANING"
  | "FORMULATION_CONTEXT"
  | "BOUNDARY"
  | "LIMITATION"
  | "RELATION"
  | "GENERAL_SCIENTIFIC_CONTEXT"

export type ReportKnowledgeAuditRecord = Readonly<{
  atomId: string
  status: ReportKnowledgeEligibility
  roles: readonly ReportKnowledgeRole[]
  reportDomain: DomainKey | null
  authority: "OWNER_BOOK"
  sourceId: string
  passageId: string
  textSha256: string
  reasons: readonly string[]
  reportRagOverlapChunkIds: readonly string[]
}>

export type ReportKnowledgeAuditSummary = Readonly<{
  version: "report-knowledge-audit@2.3"
  totalAtoms: number
  reportEligibleAtoms: number
  notReportEligibleAtoms: number
  needsReviewAtoms: number
  ownerBookEligibleAtoms: number
  reportRagOverlapAtoms: number
  novelUsefulAtoms: number
  overlapMethod: "normalized_token_containment_gte_0.35"
  statusCounts: Readonly<Record<ReportKnowledgeEligibility, number>>
  roleCounts: Readonly<Record<ReportKnowledgeRole, number>>
  sourceSha256: string
  auditSha256: string
}>

export type SelectedReportKnowledgeAtom = Readonly<{
  atomId: string
  claimId: string
  sectionId: Extract<ReportSectionId, "section_3" | "section_4" | "section_5" | "section_8">
  role: ReportKnowledgeRole
  reportDomain: DomainKey | null
  authority: "OWNER_BOOK"
  sourceId: string
  passageId: string
  text: string
  claimBoundary: string
  reportRagOverlap: boolean
  relevance: "RELEVANT"
  relevanceScore: number
  relevanceReasons: readonly string[]
  clinicalMateriality: Exclude<ReportClinicalMateriality, "NON_MATERIAL">
  materialityScore: number
  materialityReasons: readonly string[]
}>

export type ReportKnowledgeRelevanceDecision = Readonly<{
  atomId: string
  sectionId: Extract<ReportSectionId, "section_3" | "section_4" | "section_5" | "section_8">
  reportDomain: DomainKey | null
  relevance: ReportKnowledgeRelevance
  score: number
  primaryOrImportantDomainRelation: boolean
  sectionPurposeFit: boolean
  caseEvidenceRelation: boolean
  functionalRelevance: boolean
  informationGain: boolean
  repetitionRisk: number
  decisionOrConfidenceContribution: boolean
  theoreticalExpansionRisk: boolean
  clinicalMateriality: ReportClinicalMateriality
  materialityScore: number
  sectionNeed: boolean
  reasons: readonly string[]
  materialityReasons: readonly string[]
}>

export type ReportKnowledgeBridgeSelection = Readonly<{
  version: "report-knowledge-bridge@2.3"
  audit: ReportKnowledgeAuditSummary
  selectedAtoms: readonly SelectedReportKnowledgeAtom[]
  selectedAtomIds: readonly string[]
  sectionUsage: Readonly<Partial<Record<ReportSectionId, readonly string[]>>>
  relevanceDecisions: readonly ReportKnowledgeRelevanceDecision[]
  relevanceSummary: Readonly<{
    evaluatedCandidateCount: number
    relevantCandidateCount: number
    optionalLowValueCandidateCount: number
    irrelevantCandidateCount: number
    selectedRelevantCount: number
    materialCandidateCount: number
    supportiveCandidateCount: number
    nonMaterialCandidateCount: number
    selectedMaterialCount: number
    selectedSupportiveCount: number
  }>
}>

export type ReportClaim = Readonly<{
  id: string
  role: ClaimRole
  materiality: ReportMateriality
  claimType: ReportClaimType
  knowledgeAuthority: ReportKnowledgeAuthority
  text: string
  evidenceIds: readonly string[]
  relationIds: readonly string[]
  sufficiency: EvidenceSufficiency
  formulationId: FormulationId | null
  sourceIds: readonly string[]
  knowledgeChunkIds: readonly string[]
}>

export type StructuredExternalAssessment = Readonly<{
  id: string
  testName: string
  construct: string
  source: string
  result: string
  interpretation: string
  ageAppropriateness: "VALID" | "INVALID" | "UNKNOWN"
  relevanceToDna: number
  relevantDomains: readonly DomainKey[]
  comparisonStatus: EvidenceRelationType
  limitations: readonly string[]
  selectedForDecision: boolean
}>

export type ClinicalDecisionPlan = Readonly<{
  version: "clinical-decision-plan@2.2"
  decisionState: ClinicalDecisionState
  overallClassification: DomainLevel
  primaryFormulation: CandidateFormulation | null
  secondaryFormulations: readonly CandidateFormulation[]
  alternativeFormulations: readonly CandidateFormulation[]
  supportingEvidence: readonly string[]
  contradictoryEvidence: readonly string[]
  preservedCapacity: readonly string[]
  contextualModifiers: readonly string[]
  functionalImplications: readonly string[]
  externalTestSynthesis: readonly StructuredExternalAssessment[]
  discrepancyClusters: readonly ClinicalDiscrepancyCluster[]
  confidence: ConfidenceBreakdown
  limitations: readonly string[]
  validationPriorities: readonly string[]
  prohibitedInferences: readonly string[]
  claims: readonly ReportClaim[]
}>

export type LockedReportSectionPlan = Readonly<{
  id: ReportSectionId
  heading: typeof REPORT_SECTION_HEADINGS[number]
  allowedClaimIds: readonly string[]
  requiredClaimIds: readonly string[]
  importantClaimIds: readonly string[]
  optionalClaimIds: readonly string[]
  limitations: readonly string[]
}>

export type CaseEvidenceSource =
  | "ANAMNESIS"
  | "CAREGIVER_REPORT"
  | "TEACHER_REPORT"
  | "THERAPIST_OBSERVATION"
  | "DNA_PROFILE"
  | "EXTERNAL_ASSESSMENT"
  | "PRESERVED_CAPACITY"
  | "CONTEXTUAL_EVIDENCE"

export type CaseEvidenceSourceRelation = "SUPPORTS" | "DISAGREES" | "PARTIALLY_SUPPORTS" | "NOT_COMPARABLE" | "MISSING"

export type CanonicalEvidenceRelation = Readonly<{
  id: string
  sourceA: CaseEvidenceSource
  sourceB: CaseEvidenceSource
  domain: DomainKey | "global" | null
  construct: string
  relation: CaseEvidenceSourceRelation
  evidenceIds: readonly string[]
  relationIds: readonly string[]
}>

export type CaseEvidenceSourceMatrixEntry = Readonly<{
  id: string
  source: CaseEvidenceSource
  domain: DomainKey | "global" | null
  construct: string
  direction: EvidenceDirection
  availability: "AVAILABLE" | "MISSING"
  comparability: "COMPARABLE" | "PARTIALLY_COMPARABLE" | "NOT_COMPARABLE"
  relationToPrimaryFinding: CaseEvidenceSourceRelation
  evidenceIds: readonly string[]
  relationIds: readonly string[]
}>

export type CaseEvidenceSourceMatrix = Readonly<{
  version: "case-evidence-source-matrix@2"
  entries: readonly CaseEvidenceSourceMatrixEntry[]
  canonicalRelations: readonly CanonicalEvidenceRelation[]
  availableSources: readonly CaseEvidenceSource[]
  missingSources: readonly CaseEvidenceSource[]
}>

export type ClinicalSubstanceStatus = "SUBSTANTIVE" | "LIMITED_BY_AVAILABLE_EVIDENCE" | "INSUFFICIENT"

export type LiteratureMode = "STANDARD" | "DETAILED"

export type LockedReportPlan = Readonly<{
  version: "locked-report-plan@2.3"
  subjectAgeMonths: number | null
  decisionState: ClinicalDecisionState
  primaryFormulationId: FormulationId | null
  primaryDecisionClaimId: string
  confidence: EvidenceConfidence
  literatureMode: LiteratureMode
  claims: readonly ReportClaim[]
  sections: readonly LockedReportSectionPlan[]
  caseEvidenceSourceMatrix: CaseEvidenceSourceMatrix
  literatureBindings: readonly LiteratureClaimBinding[]
  knowledgeBridge: ReportKnowledgeBridgeSelection
  prohibitedInferences: readonly string[]
}>

export type LiteratureClaimBinding = Readonly<{
  reportClaimId: string
  claimType: ReportClaimType
  sourceId: string
  supportedClaim: string
  claimBoundary: string
  verifiedClaimId: string
  verifiedClaim: string
  exactPassageId: string
  exactPassageSha256: string
  supportDecision: "DIRECT_SUPPORT"
}>

export type ReportRealizationSection = Readonly<{
  sectionId: ReportSectionId
  text: string
  usedClaimIds: readonly string[]
}>

export type ReportRealization = Readonly<{
  version: "report-realization@2"
  unsupportedAddition: boolean
  unsupportedSectionIds?: readonly ReportSectionId[]
  sections: readonly ReportRealizationSection[]
}>

export type PlainClinicalRewriteRecord = Readonly<{
  sectionId: ReportSectionId
  before: string
  after: string
  afterSentence: string
  beforeClaimIds: readonly string[]
  materiality: readonly ReportMateriality[]
  knowledgeClinicalMateriality: readonly Exclude<ReportClinicalMateriality, "NON_MATERIAL">[]
  preservedMeaning: boolean
  semanticStrengthening: boolean
  newSpecificity: boolean
  newInterventionDetail: boolean
  certaintyChanged: boolean
  repairReason: string
  ruleIds: readonly string[]
}>

export type PlainClinicalTurkishSummary = Readonly<{
  version: "plain-clinical-turkish@5-clinical-content-release-candidate"
  latestMaterialityPipelineConfirmed: boolean
  nonMaterialKnowledgeRemovedBeforeRewrite: boolean
  rewriteCount: number
  meaningDriftCount: number
  meaningDriftSectionIds: readonly ReportSectionId[]
  semanticStrengtheningCount: number
  newSpecificityCount: number
  newInterventionDetailCount: number
  certaintyDriftCount: number
  nonMaterialKnowledgeReentryCount: number
  semanticMicroRepetitionCount: number
  plainTurkishGrammarErrorCount: number
  records: readonly PlainClinicalRewriteRecord[]
}>

export type ReportRealizerUsage = Readonly<{
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  costMicrousd: number
}>

export type ReportRealizerAttempt = Readonly<{
  provider: "luna" | "deterministic"
  model: string
  implementationVersion: string
  attempt: "initial" | "repair" | "fallback"
  realization: ReportRealization | null
  rawOutput: string | null
  responseId: string | null
  usage: ReportRealizerUsage
  latencyMs: number
  promptHash: string
}>

export type ReportRealizerRequest = Readonly<{
  plan: LockedReportPlan
  attempt: "initial" | "repair" | "fallback"
  validationFailureCodes: readonly string[]
  previousCandidate: ReportRealization | null
}>

export interface ReportRealizer {
  readonly identity: Readonly<{ provider: "luna" | "deterministic"; model: string; implementationVersion: string }>
  realize(request: ReportRealizerRequest): Promise<ReportRealizerAttempt>
}

export type ReportV2ValidationFailureCode =
  | "PRIVACY_VIOLATION"
  | "PLAN_INCOMPLETE"
  | "UNSUPPORTED_RELATION"
  | "UNSUPPORTED_ADDITION"
  | "INVENTED_NUMBER"
  | "REQUIRED_CLAIM_OMITTED"
  | "SUPPORTED_EVIDENCE_OMITTED"
  | "CONTRADICTORY_EVIDENCE_OMITTED"
  | "PRESERVED_CAPACITY_OMITTED"
  | "EXTERNAL_TEST_DISCREPANCY_OMITTED"
  | "MAJOR_LIMITATION_OMITTED"
  | "CROSS_SECTION_PRIMARY_FORMULATION_MISMATCH"
  | "CROSS_SECTION_CONFIDENCE_MISMATCH"
  | "CROSS_SECTION_CONTRADICTION"
  | "SECTION_2_3_SEMANTIC_OVERLAP"
  | "LITERATURE_CLAIM_SOURCE_MISMATCH"
  | "EXACT_PASSAGE_MISSING"
  | "CLAIM_SOURCE_MISMATCH"
  | "CLAIM_PASSAGE_OVERREACH"
  | "TOPIC_ONLY_CITATION"
  | "WRONG_CONSTRUCT_CITATION"
  | "LITERATURE_CASE_DECISION_ATTRIBUTION"
  | "LITERATURE_FRAGMENT"
  | "ORPHAN_QUOTE"
  | "INCOMPLETE_SENTENCE"
  | "PRESERVED_DOMAIN_OVERINTERPRETATION"
  | "INSUFFICIENT_CLINICAL_SUBSTANCE"
  | "IMPORTANT_CLAIM_OMITTED"
  | "INTERNAL_LANGUAGE_LEAK"
  | "INTERNAL_ENGINE_JARGON"
  | "AWKWARD_ACADEMIC_LANGUAGE"
  | "TERMINOLOGY_DRIFT"
  | "BROKEN_SUFFIX"
  | "DUPLICATE_SUFFIX"
  | "SENTENCE_MERGE_ERROR"
  | "BROKEN_WORD"
  | "INTERNAL_LABEL_LEAKAGE"
  | "IRRELEVANT_KNOWLEDGE_CLAIM"
  | "NON_MATERIAL_KNOWLEDGE_CLAIM"
  | "SECONDARY_DOMAIN_OVEREXPLANATION"
  | "SYSTEM_LIKE_LANGUAGE"
  | "NOMINALIZATION_OVERLOAD"
  | "ABSTRACT_CLINICAL_LANGUAGE"
  | "UNCLEAR_AGENT"
  | "UNCLEAR_DAILY_LIFE_MEANING"
  | "MEANING_DRIFT"
  | "SEMANTIC_STRENGTHENING"
  | "NEW_SPECIFICITY"
  | "NEW_INTERVENTION_DETAIL"
  | "CERTAINTY_DRIFT"
  | "NON_MATERIAL_KNOWLEDGE_REENTRY"
  | "SEMANTIC_MICRO_REPETITION"
  | "PLAIN_TURKISH_GRAMMAR_ERROR"
  | "GRAMMAR_FRAGMENT"
  | "SEMANTIC_CONTRADICTION"
  | "AWKWARD_GENERIC_PHRASE"
  | "SEMANTIC_PARAGRAPH_REPETITION"
  | "HUMAN_EDITOR_SYSTEM_PROSE"
  | "PRESCRIPTIVE_RECOMMENDATION_LEAK"
  | "WRONG_SECTION_GENERIC_KNOWLEDGE"
  | "OTHER_CHILD_EXAMPLE"
  | "GENERIC_TEMPLATE_INJECTION"
  | "UNEXPLAINED_CONFIDENCE_CONFLICT"
  | "REPEATED_TEMPLATE_PHRASE"
  | "SECTION_2_THRESHOLD_REPETITION"
  | "INTRA_SECTION_CONTRADICTION"
  | "UNRESOLVED_EVIDENCE_CONTRADICTION"
  | "SOURCE_PAIR_RELATION_CONTRADICTION"
  | "CROSS_SECTION_RELATION_DRIFT"
  | "SAME_DIRECTION_FALSE_ASSERTION"
  | "TURKISH_MORPHOLOGY_ERROR"
  | "SUBJECT_OBJECT_AGREEMENT_ERROR"
  | "BROKEN_NOUN_PHRASE"
  | "TURKISH_SURFACE_ERROR"
  | "MORPHOLOGY_ERROR"
  | "PUNCTUATION_ERROR"
  | "SENTENCE_BOUNDARY_ERROR"
  | "SECTION5_GENERIC_SPECIFIC_DUPLICATION"
  | "OWNER_BOOK_VERBATIM_COPY"
  | "KNOWLEDGE_AUTHORITY_VIOLATION"
  | "KNOWLEDGE_SOURCE_VIOLATION"
  | "KNOWLEDGE_CASE_SPECIFIC_ADDITION"
  | "BLANK_SECTION"
  | "EXCESSIVE_REPETITION"
  | "SAFETY_VIOLATION"
  | "HEADING_CONTRACT_VIOLATION"

export type ReportV2ValidationResult = Readonly<{
  pass: boolean
  failureCodes: readonly ReportV2ValidationFailureCode[]
  repairableFailureCodes: readonly ReportV2ValidationFailureCode[]
  missingImportantClaimIds: readonly string[]
  controlledInsertionCount: number
  requiredClaimCoverage: number
  unsupportedRelationCount: number
  omissionCount: number
  repetitionScore: number
  section23ClaimOverlapCount: number
  piiViolationCount: number
  preservedDomainOverinterpretationCount: number
  literatureCaseDecisionAttributionCount: number
  literatureFormattingErrorCount: number
  citationBackedClaimCount: number
  exactPassageMissingCount: number
  claimSourceMismatchCount: number
  claimPassageOverreachCount: number
  topicOnlyCitationCount: number
  wrongConstructCitationCount: number
  internalEngineJargonCount: number
  internalLabelLeakageCount: number
  awkwardAcademicLanguageCount: number
  terminologyDriftCount: number
  brokenSuffixCount: number
  duplicateSuffixCount: number
  sentenceMergeErrorCount: number
  brokenWordCount: number
  irrelevantKnowledgeClaimCount: number
  nonMaterialKnowledgeClaimCount: number
  theoreticalExpansionKnowledgeCount: number
  secondaryDomainOverexplanationCount: number
  systemLikeLanguageCount: number
  nominalizationOverloadCount: number
  abstractClinicalLanguageCount: number
  unclearAgentCount: number
  unclearDailyLifeMeaningCount: number
  meaningDriftCount: number
  semanticStrengtheningCount: number
  newSpecificityCount: number
  newInterventionDetailCount: number
  certaintyDriftCount: number
  nonMaterialKnowledgeReentryCount: number
  semanticMicroRepetitionCount: number
  plainTurkishGrammarErrorCount: number
  grammarFragmentCount: number
  semanticContradictionCount: number
  awkwardGenericPhraseCount: number
  semanticParagraphRepetitionCount: number
  humanEditorSystemLikeProseCount: number
  prescriptiveRecommendationLeakCount: number
  wrongSectionGenericKnowledgeCount: number
  otherChildExampleCount: number
  genericTemplateInjectionCount: number
  unexplainedConfidenceConflictCount: number
  repeatedTemplatePhraseCount: number
  section2RepeatedThresholdSentenceCount: number
  intraSectionContradictionCount: number
  crossEvidenceContradictionCount: number
  semanticPolarityConflictCount: number
  reconciliationSentenceCount: number
  duplicateReconciliationCount: number
  consistencyConflictSectionIds: readonly ReportSectionId[]
  ownerBookVerbatimCopyCount: number
  crossSectionRepetitionCount: number
  semanticCrossSectionRepeatCount: number
  lexicalQaCounts: Readonly<Record<"formülasyon" | "örüntü" | "görünüm" | "odağı" | "yakınsama" | "korunmuş kapasite" | "eksen", number>>
  knowledgeAuthorityViolationCount: number
  knowledgeSourceViolationCount: number
  knowledgeCaseSpecificAdditionCount: number
  blankSectionCount: number
  section4ClinicalSubstanceStatus: ClinicalSubstanceStatus
  section5ClinicalSubstanceStatus: ClinicalSubstanceStatus
  insufficientClinicalSubstanceCount: number
  limitedByAvailableEvidenceSectionCount: number
  sourcePairSynthesisCount: number
  sourcePairRelationContradictionCount: number
  crossSectionRelationDriftCount: number
  sameDirectionFalseAssertionCount: number
  turkishMorphologyErrorCount: number
  subjectObjectAgreementErrorCount: number
  brokenNounPhraseCount: number
  turkishSurfaceErrorCount: number
  morphologyErrorCount: number
  punctuationErrorCount: number
  sentenceBoundaryErrorCount: number
  section5GenericSpecificDuplicationCount: number
}>

export type ReportRecoveryStatus = "DIRECT_ACCEPTED" | "CONTROLLED_REPAIR" | "LUNA_REPAIRED" | "DETERMINISTIC_FALLBACK"

export type ReportTraceV2 = Readonly<{
  version: typeof REPORT_V2_TRACE_VERSION
  inputHash: string
  answersHash: string
  scoringVersion: string
  scores: Readonly<Record<string, number>>
  domainLevels: Readonly<Record<string, DomainLevel>>
  domainThresholdTrace: readonly string[]
  evidenceMatrix: ClinicalEvidenceMatrix
  candidates: readonly CandidateFormulation[]
  decisionState: ClinicalDecisionState
  selectedFormulationId: FormulationId | null
  alternativeFormulationIds: readonly FormulationId[]
  contradictions: readonly string[]
  discrepancyRelationIds: readonly string[]
  confidence: ConfidenceBreakdown
  decisionPlan: ClinicalDecisionPlan
  reportPlan: LockedReportPlan
  knowledgeBridge: ReportKnowledgeBridgeSelection
  decisionHashBeforeKnowledge: string
  decisionHashAfterKnowledge: string
  knowledgeChunkIds: readonly string[]
  literatureSourceIds: readonly string[]
  realizationAttempts: readonly Omit<ReportRealizerAttempt, "rawOutput" | "realization">[]
  validatorResults: readonly ReportV2ValidationResult[]
  finalReportHash: string
  fallbackUsed: boolean
  recoveryStatus: ReportRecoveryStatus
  plainClinicalTurkish: PlainClinicalTurkishSummary
}>

export type ReportV2ShadowResult = Readonly<{
  mode: "REPORT_V2_SHADOW"
  v1: DeterministicReport
  evidenceMatrix: ClinicalEvidenceMatrix
  candidates: readonly CandidateFormulation[]
  decisionPlan: ClinicalDecisionPlan
  reportPlan: LockedReportPlan
  knowledgeBridge: ReportKnowledgeBridgeSelection
  realization: ReportRealization
  finalReport: string
  validation: ReportV2ValidationResult
  providerCalls: number
  fallbackUsed: boolean
  recoveryStatus: ReportRecoveryStatus
  plainClinicalTurkish: PlainClinicalTurkishSummary
  trace: ReportTraceV2
}>

export type ReportV2ShadowInput = ReportInput
