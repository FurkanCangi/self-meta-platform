import type { DomainKey, DomainLevel, ReportInput } from "../reportEngine"
import type { EvidenceConfidence, FormulationId, ReportV2ShadowResult } from "../reportV2/contracts"
import type { CanonicalTherapistObservation } from "../reportV2/canonicalCaseEvidence"
import type { ExternalTestCategory } from "../externalTestRegistry"

export const DNA_REPORT_JURY_VERSION = "dna-report-final-evidence-semantics@1" as const

export const JURY_REPORT_HEADINGS = [
  "1. Klinik Özet",
  "2. Bulgular ve Klinik Kanıt Profili",
  "3. Klinik Örüntü",
  "4. Klinik Karar",
  "5. Bilimsel Literatür",
] as const

export type JuryReportSectionId = "summary" | "evidence" | "formulation" | "decision_support" | "limits_science"
export type ExternalValidityStatus = "valid" | "partially_interpretable" | "invalid" | "insufficient_information"
export type ExternalEvidenceDirection = "supports_difficulty" | "supports_preserved_function" | "mixed" | "neutral" | "unusable"
export type ReportDataQualityStatus = "adequate" | "limited" | "insufficient" | "contradictory"
export type JuryConfidence = "Yüksek" | "Orta" | "Sınırlı" | "Yetersiz"
export type ProfileBreadth = "preserved" | "selective_single_domain" | "focused_multidomain" | "broad_multidomain" | "insufficient"

export type JuryPriorityProfile = Readonly<{
  profile_breadth: ProfileBreadth
  affected_domains: readonly DomainKey[]
  primary_priority: DomainKey | null
  secondary_priorities: readonly DomainKey[]
  preserved_domains: readonly DomainKey[]
  display_label: string
}>

export type RawExternalTestMention = Readonly<{
  ordinal: number
  test_name: string
  reported_result: string
  reported_interpretation: string
  notes: string
  recognized_registry_id: string | null
  clearly_unparseable_noise: boolean
}>

export type JuryExternalEvidence = Readonly<{
  id: string
  test_name: string
  category: ExternalTestCategory | "unrecognized"
  reported_result: string
  interpretability: string
  validity_status: ExternalValidityStatus
  supported_domain: readonly DomainKey[]
  evidence_direction: ExternalEvidenceDirection
  functional_scope: string
  limitations: readonly string[]
  source_text: string
  decision_relevant: boolean
}>

export type ExternalEvidenceUsageRole =
  | "METADATA_ONLY"
  | "EXCLUSION_RATIONALE"
  | "DIRECT_CLINICAL_EVIDENCE"
  | "PRESERVED_CAPACITY_EVIDENCE"
  | "PROFILE_EVIDENCE"
  | "RELATION_EVIDENCE"
  | "GENERAL_DESCRIPTION"

export type ExternalEvidenceUsageRecord = Readonly<{
  evidence_id: string
  test_name: string
  fact_id: string | null
  validity_status: ExternalValidityStatus
  decision_relevant: boolean
  section_id: JuryReportSectionId
  paragraph_id: string
  sentence_ids: readonly string[]
  usage_role: ExternalEvidenceUsageRole
  allowed: boolean
  text_proximity_hint_fired: boolean
  rationale: string
}>

export type ExternalEvidenceUsageAudit = Readonly<{
  pass: boolean
  records: readonly ExternalEvidenceUsageRecord[]
  genuine_misuse_evidence_ids: readonly string[]
  safe_mention_evidence_ids: readonly string[]
  safe_exclusion_evidence_ids: readonly string[]
  proximity_hint_evidence_ids: readonly string[]
  validator_false_positive_evidence_ids: readonly string[]
}>

export type ReportDataQuality = Readonly<{
  status: ReportDataQualityStatus
  dnaProfileInterpretable: boolean
  requiredAssessmentComplete: boolean
  anamnesisMeaningful: boolean
  concreteFunctionalExample: boolean
  shortConcreteAnamnesisOnly: boolean
  therapistObservationAvailable: boolean
  shortTherapistObservation: boolean
  interpretableExternalTestCount: number
  fullyValidExternalTestCount: number
  partiallyInterpretableExternalTestCount: number
  independentInterpretableSourceCount: number
  contextualComparisonAvailable: boolean
  discrepancyCount: number
  missingCriticalInformation: readonly string[]
  reasons: readonly string[]
}>

export type JuryConfidenceResult = Readonly<{
  category: JuryConfidence
  legacyV2Category: EvidenceConfidence
  positiveFactors: readonly string[]
  limitingFactors: readonly string[]
  reason: string
}>

export type DecisionExplanation = Readonly<{
  overall_classification: DomainLevel
  profile_breadth: ProfileBreadth
  primary_priority: string
  secondary_priorities: readonly string[]
  preserved_domains: readonly string[]
  supporting_evidence: readonly string[]
  preserved_evidence: readonly string[]
  contradictory_evidence: readonly string[]
  external_tests_extracted: readonly string[]
  external_tests_used: readonly string[]
  external_tests_excluded: readonly string[]
  therapist_observation_present: boolean
  limitations: readonly string[]
  alternative_explanations: readonly string[]
  confidence: JuryConfidence
  confidence_reason: string
  verification_priority: string
  primary_focus: string
  profile_pattern: string
  excluded_evidence: readonly string[]
}>

export type JuryLiteratureSelection = Readonly<{
  sourceIds: readonly string[]
  referenceCount: number
  paragraphCount: number
  domainSpecific: boolean
  missingSourceIds: readonly string[]
  duplicateSourceIds: readonly string[]
  doiReferenceMismatchCount: number
  citationDomainMismatchCount: number
}>

export type CaseFactSourceType = "DNA_SCORE" | "ANAMNESIS" | "CAREGIVER_REPORT" | "CAREGIVER_ANAMNESIS" | "THERAPIST_OBSERVATION" | "EXTERNAL_TEST"
export type JuryStatementType = "case_fact" | "synthesis" | "literature_link" | "boundary"

export type EvidenceDirection = "DIFFICULTY" | "PRESERVED" | "MIXED" | "NEUTRAL" | "UNKNOWN" | "NOT_APPLICABLE"
export type EvidenceEpistemicStatus = "OBSERVED_OR_REPORTED" | "ABSENT_INFORMATION" | "UNKNOWN" | "NOT_ASSESSED" | "NOT_APPLICABLE" | "INVALID_OR_UNINTERPRETABLE"
export type EvidenceSemanticValidity = "USABLE" | "PARTIALLY_INTERPRETABLE" | "INVALID" | "INSUFFICIENT_INFORMATION"
export type SourceEvidenceRelationType =
  | "CONVERGENT_DIFFICULTY"
  | "CONVERGENT_PRESERVED"
  | "DISCREPANT"
  | "CONTEXTUAL_DISCREPANCY"
  | "PARTIALLY_CONVERGENT"
  | "INCOMPARABLE"
  | "INSUFFICIENT_RELATION_EVIDENCE"

export type EvidenceSemanticContext = Readonly<{
  settings: readonly string[]
  triggers: readonly string[]
  tasks: readonly string[]
}>

export type EvidenceSemanticSegment = Readonly<{
  id: string
  text: string
  semantic_direction: EvidenceDirection
  epistemic_status: EvidenceEpistemicStatus
  semantic_context: EvidenceSemanticContext
  observed_performance: boolean
  context_conditioned: boolean
}>

export type SourceEvidenceRelation = Readonly<{
  id: string
  case_id: string
  domain: DomainKey
  left_fact_id: string
  right_fact_id: string
  left_source_type: CaseFactSourceType
  right_source_type: CaseFactSourceType
  left_direction: EvidenceDirection
  right_direction: EvidenceDirection
  relation: SourceEvidenceRelationType
  shared_contexts: readonly string[]
  differing_contexts: readonly string[]
  reason: string
}>

export type CaseSemanticEvidenceMatrix = Readonly<{
  case_id: string
  facts: readonly CaseScopedEvidenceFact[]
  relations: readonly SourceEvidenceRelation[]
  difficulty_fact_ids: readonly string[]
  preserved_fact_ids: readonly string[]
  absence_unknown_fact_ids: readonly string[]
}>

export type ClauseEntailmentLevel = "DIRECT" | "COMPOSITIONAL" | "PROFILE_DERIVED" | "UNSUPPORTED"
export type ClauseClaimType = "CASE_DETAIL" | "SYNTHESIS" | "PROFILE_INTERPRETATION" | "BOUNDARY" | "LITERATURE"
export type ClauseEntailmentError =
  | "UNSUPPORTED_VISIBLE_CLAUSE"
  | "PARTIALLY_SUPPORTED_SENTENCE"
  | "FACT_ID_PRESENT_BUT_NOT_ENTAILING"
  | "TEMPLATE_DETAIL_WITHOUT_EVIDENCE"
  | "PROFILE_TO_FUNCTION_OVERREACH"
  | "UNSUPPORTED_CONTEXT_DETAIL"
  | "UNSUPPORTED_SUPPORT_DETAIL"
  | "UNSUPPORTED_OUTCOME_DETAIL"
  | "UNSUPPORTED_TEMPORAL_DETAIL"
  | "DIFFICULTY_AS_PRESERVED_CAPACITY"
  | "ABSENCE_AS_PRESERVED_CAPACITY"
  | "FALSE_SOURCE_CONVERGENCE"
  | "EVIDENCE_DIRECTION_MISMATCH"
  | "EPISTEMIC_STATUS_MISMATCH"
  | "SOURCE_RELATION_MISMATCH"
  | "EXTERNAL_TEST_DIRECTION_MISMATCH"
  | "UNASSESSED_CONTEXT_AS_OBSERVED"

export type JuryClauseProvenance = Readonly<{
  clause_id: string
  case_id: string
  section_id: JuryReportSectionId
  paragraph_id: string
  sentence_id: string
  clause: string
  claim_type: ClauseClaimType
  entailment_level: ClauseEntailmentLevel
  required_semantics: readonly string[]
  supported_semantics: readonly string[]
  missing_semantics: readonly string[]
  supporting_case_fact_ids: readonly string[]
  supporting_decision_ids: readonly string[]
  supporting_literature_ids: readonly string[]
  claim_direction: EvidenceDirection
  supporting_sources: readonly CaseFactSourceType[]
  supporting_directions: readonly EvidenceDirection[]
  relation_state: readonly SourceEvidenceRelationType[]
  specificity_level: "HIGH" | "BOUNDED" | "PROFILE_ONLY"
  render_eligible: boolean
  backoff_reason: string | null
  content_entailment: "PASS" | "FAIL"
  direction_match: "PASS" | "FAIL" | "NOT_APPLICABLE"
  epistemic_status_match: "PASS" | "FAIL" | "NOT_APPLICABLE"
  source_relation_match: "PASS" | "FAIL" | "NOT_APPLICABLE"
  final_support: "PASS" | "FAIL"
  error_types: readonly ClauseEntailmentError[]
}>

export type AnamnesisEvidenceStatus = "USABLE" | "LIMITED" | "UNUSABLE"
export type AnamnesisEvidenceDirection = "DIFFICULTY" | "PRESERVED" | "ABSENCE" | "MIXED" | "CONTEXTUAL" | "VAGUE"
export type AnamnesisDomainSupportLevel = "DIRECT" | "CONTEXTUAL"

export type AnamnesisDomainSupport = Readonly<{
  domain: DomainKey
  support_level: AnamnesisDomainSupportLevel
}>

export type AnamnesisFunctionalContext = Readonly<{
  task: string | null
  environment: string | null
  trigger: string | null
  behavior: string | null
  support: string | null
  outcome: string | null
  variability: string | null
}>

export type CaseScopedEvidenceFact = Readonly<{
  id: string
  case_id: string
  source_type: CaseFactSourceType
  statement: string
  source_excerpt: string
  domains: readonly DomainKey[]
  semantic_direction: EvidenceDirection
  epistemic_status: EvidenceEpistemicStatus
  semantic_validity: EvidenceSemanticValidity
  semantic_context: EvidenceSemanticContext
  semantic_segments?: readonly EvidenceSemanticSegment[]
  preserved_subcomponent: string | null
}>

export type CanonicalAnamnesisEvidenceFact = CaseScopedEvidenceFact & Readonly<{
  source_type: "CAREGIVER_ANAMNESIS"
  source_field: "anamnez"
  raw_span: string
  normalized_fact: string
  domain_support: readonly AnamnesisDomainSupport[]
  functional_context: AnamnesisFunctionalContext
  evidence_status: AnamnesisEvidenceStatus
  direction: AnamnesisEvidenceDirection
  functional_roles: readonly string[]
}>

export type FunctionalEvidenceProfile = Readonly<{
  has_concrete_daily_life_example: boolean
  has_context_specific_performance_example: boolean
  has_task_specific_performance_example: boolean
  has_caregiver_functional_report: boolean
  has_therapist_observation: boolean
  has_preserved_capacity_in_action: boolean
  has_performance_variability_evidence: boolean
  has_caregiver_functional_example: boolean
  has_caregiver_context_example: boolean
  has_caregiver_preserved_capacity_example: boolean
  has_caregiver_task_example: boolean
  has_caregiver_difficulty_example: boolean
  has_caregiver_directional_complaint: boolean
  has_caregiver_functional_evidence: boolean
}>

export type CaseScopedEvidenceEnvelope = Readonly<{
  case_id: string
  assessment_id: string
  dna_scores: readonly CaseScopedEvidenceFact[]
  anamnesis_evidence: readonly CanonicalAnamnesisEvidenceFact[]
  therapist_observations: readonly CaseScopedEvidenceFact[]
  external_tests: readonly CaseScopedEvidenceFact[]
  semantic_evidence_matrix: CaseSemanticEvidenceMatrix
  functional_evidence_profile: FunctionalEvidenceProfile
  derived_locked_decisions: readonly string[]
  allowed_case_fact_ids: readonly string[]
  literature_ids: readonly string[]
}>

export type JurySentenceProvenance = Readonly<{
  sentence_id: string
  case_id: string
  section_id: JuryReportSectionId
  paragraph_id: string
  sentence: string
  statement_type: JuryStatementType
  supporting_case_fact_ids: readonly string[]
  supporting_decision_ids: readonly string[]
  supporting_literature_ids: readonly string[]
  clauses: readonly JuryClauseProvenance[]
}>

export type DeepClinicalInsightPlan = Readonly<{
  clinically_distinguishing_pattern: string
  visible_problem: string
  deeper_pattern: string
  preserved_capacity_that_changes_interpretation: string
  context_or_time_effect: string
  cross_domain_interaction: string
  most_important_clinical_conclusion: string
  central_clinical_pattern: string
  clinically_distinguishing_feature: string
  preserved_capacity: string
  performance_breakdown_condition: string | null
  time_or_context_pattern: string | null
  cross_domain_relationship: string | null
  what_a_superficial_reading_would_miss: string
  highest_value_clinical_conclusion: string
  candidate_bold_paragraphs: readonly string[]
  bold_paragraph_case_fact_ids: readonly (readonly string[])[]
  bold_paragraph_decision_ids: readonly (readonly string[])[]
}>

export type ClinicalInsightPlan = DeepClinicalInsightPlan

export type JuryLockedParagraph = Readonly<{
  id: string
  text: string
  evidenceIds: readonly string[]
  claimIds: readonly string[]
  emphasis: "normal" | "full_bold"
  sentenceProvenance: readonly JurySentenceProvenance[]
}>

export type JuryLockedSection = Readonly<{
  id: JuryReportSectionId
  heading: typeof JURY_REPORT_HEADINGS[number]
  paragraphs: readonly JuryLockedParagraph[]
}>

export type JuryLockedLanguagePlan = Readonly<{
  version: typeof DNA_REPORT_JURY_VERSION
  overallClassification: DomainLevel
  primaryFormulationId: FormulationId | null
  profile: JuryPriorityProfile
  clinicalInsightPlan: ClinicalInsightPlan
  caseScopedEvidenceEnvelope: CaseScopedEvidenceEnvelope
  sections: readonly JuryLockedSection[]
  literatureSourceIds: readonly string[]
  forbiddenClaims: readonly string[]
}>

export type JuryLanguageRealization = Readonly<{
  sections: readonly Readonly<{
    id: JuryReportSectionId
    text: string
    usedParagraphIds: readonly string[]
  }>[]
}>

export type JuryLanguageRealizer = Readonly<{
  identity: Readonly<{ provider: "deterministic" | "luna"; model: string; version: string }>
  realize(plan: JuryLockedLanguagePlan): Promise<JuryLanguageRealization | null>
}>

export type ClinicalCriticFindingType =
  | "CLASSIFICATION_INCONSISTENCY"
  | "EXTERNAL_EVIDENCE_OMISSION"
  | "INVALID_EXTERNAL_EVIDENCE_USE"
  | "UNSUPPORTED_FUNCTIONAL_INFERENCE"
  | "PRESERVED_CAPACITY_OMISSION"
  | "MAJOR_LIMITATION_OMISSION"
  | "UNSUPPORTED_CAUSALITY"
  | "OVERSTATEMENT"
  | "INTERNAL_INCONSISTENCY"

export type ClinicalCriticFinding = Readonly<{
  type: ClinicalCriticFindingType
  severity: "low" | "medium" | "high" | "critical"
  message: string
}>

export type ClinicalCriticResult = Readonly<{
  status: "pass" | "review_required"
  findings: readonly ClinicalCriticFinding[]
}>

export type AIClinicalCritic = Readonly<{
  identity: Readonly<{ provider: "deterministic" | "luna"; model: string; version: string }>
  review(input: Readonly<{
    lockedPlan: JuryLockedLanguagePlan
    decisionExplanation: DecisionExplanation
    externalEvidence: readonly JuryExternalEvidence[]
    dataQuality: ReportDataQuality
    finalReport: string
  }>): Promise<ClinicalCriticResult | null>
}>

export type JuryReportValidation = Readonly<{
  pass: boolean
  classificationConsistent: boolean
  profileBreadthConsistent: boolean
  therapistObservationConsistent: boolean
  externalTestExtractionRecall: number
  missingExtractedExternalTestNames: readonly string[]
  criticalInternalContradictionCount: number
  missingValidExternalEvidenceIds: readonly string[]
  invalidExternalEvidenceUsedIds: readonly string[]
  unsupportedDiagnosisCount: number
  unsupportedCausalityCount: number
  unsupportedBiologicalMechanismCount: number
  unsupportedSourceCount: number
  sparseFunctionalOverreachCount: number
  headingErrorCount: number
  repeatedSentenceRate: number
  repeatedPhraseCount: number
  materialRepetitionFailureCount: number
  repetitionMateriality: "NONE" | "QUALITY_ONLY_P2" | "MATERIAL_P1"
  averageSentenceWords: number
  longSentenceCount: number
  visibleFormulationCount: number
  visibleConfidenceCount: number
  standaloneRegulationTranslationCount: number
  negativeContrastCount: number
  clinicalInterventionCount: number
  treatmentRecommendationCount: number
  defaultFurtherAssessmentCount: number
  fullBoldParagraphCount: number
  boldParagraphContractPass: boolean
  boldDecisionParagraphCount: number
  boldDecisionContentPass: boolean
  rawNoisyAnamnesisLeakCount: number
  grammarFragmentCount: number
  domainListGrammarErrorCount: number
  affectedDomainCountMismatchCount: number
  semanticDecisionRepetitionCount: number
  profileLanguageContradictionCount: number
  closePriorityOverstatementCount: number
  confidenceCertaintyMismatchCount: number
  naturalEvidenceRelationErrorCount: number
  systemLikeProseCount: number
  awkwardGenericPhraseCount: number
  terminologyDriftCount: number
  falseMissingFunctionalExampleCount: number
  typicalTotalDomainClarificationOmissionCount: number
  internalReasoningLanguageCount: number
  familyFacingJargonCount: number
  functionalPriorityOmissionCount: number
  lowConfidenceBoldCalibrationFailureCount: number
  sectionThreeFourRepeatedSentenceCount: number
  literatureBoilerplateCount: number
  crossCaseContaminationCount: number
  unsupportedCaseFactCount: number
  unknownCaseFactProvenanceCount: number
  unsupportedVisibleCaseClaimCount: number
  visibleClaimFailureDetails: readonly Readonly<{
    sentence: string
    errorType: string
    supportingFactIds: readonly string[]
  }>[]
  unknownVisibleClaimProvenanceCount: number
  wrongSourceAttributionCount: number
  wrongDomainAttributionCount: number
  visibleClaimCount: number
  supportedVisibleClaimCount: number
  visibleFactualContradictionCount: number
  templateSemanticLeakageCount: number
  visibleClauseCount: number
  supportedVisibleClauseCount: number
  unsupportedVisibleClauseCount: number
  partiallySupportedSentenceCount: number
  factIdPresentButNotEntailingCount: number
  profileToFunctionOverreachCount: number
  directionMismatchCount: number
  epistemicStatusMismatchCount: number
  sourceRelationMismatchCount: number
  difficultyAsPreservedCount: number
  absenceAsPreservedCount: number
  falseSourceConvergenceCount: number
  externalTestDirectionErrorCount: number
  unassessedContextAsObservedCount: number
  clauseEntailmentPrecision: number
  clauseEntailmentRecall: number
  caseSpecificDeepInsightBoldCount: number
  genericTemplateFailureCount: number
  majorHeadingCount: number
  wordCount: number
  emptyParagraphCount: number
  failureCodes: readonly string[]
}>

export type TemplateSemanticLeakageCode =
  | "FUNCTIONAL_PATTERN_WITHOUT_FUNCTIONAL_EVIDENCE"
  | "CONTEXT_EFFECT_WITHOUT_CONTEXT_EVIDENCE"
  | "PERFORMANCE_VARIABILITY_WITHOUT_VARIABILITY_EVIDENCE"
  | "CAREGIVER_FUNCTION_WITHOUT_CAREGIVER_EVIDENCE"
  | "OBSERVATION_LANGUAGE_WITHOUT_OBSERVATION"
  | "PRESERVED_CAPACITY_IN_ACTION_WITHOUT_ACTION_EVIDENCE"

export type TemplateSemanticLeakageFinding = Readonly<{
  code: TemplateSemanticLeakageCode
  sentence: string
}>

export type TemplateSemanticLeakageAudit = Readonly<{
  pass: boolean
  case_id: string
  finding_count: number
  findings: readonly TemplateSemanticLeakageFinding[]
}>

export type JuryReportResult = Readonly<{
  version: typeof DNA_REPORT_JURY_VERSION
  input: ReportInput
  base: ReportV2ShadowResult
  overallClassification: DomainLevel
  profilePattern: string
  priorityProfile: JuryPriorityProfile
  therapistObservation: CanonicalTherapistObservation
  rawExternalTests: readonly RawExternalTestMention[]
  externalEvidence: readonly JuryExternalEvidence[]
  dataQuality: ReportDataQuality
  confidence: JuryConfidenceResult
  decision_explanation: DecisionExplanation
  clinicalInsightPlan: ClinicalInsightPlan
  caseScopedEvidenceEnvelope: CaseScopedEvidenceEnvelope
  sentenceProvenance: readonly JurySentenceProvenance[]
  clauseProvenance: readonly JuryClauseProvenance[]
  semanticEvidenceMatrix: CaseSemanticEvidenceMatrix
  literature: JuryLiteratureSelection
  lockedLanguagePlan: JuryLockedLanguagePlan
  critic: ClinicalCriticResult
  reportStatus: "ready_for_therapist_review" | "draft_needs_review"
  languageProvider: "deterministic" | "luna"
  languageFallbackUsed: boolean
  languageFallbackReason: "NO_REALIZATION" | "LANGUAGE_MAPPING_VALIDATION" | "REPORT_VALIDATION" | null
  finalReport: string
  validation: JuryReportValidation
  templateSemanticLeakage: TemplateSemanticLeakageAudit
  externalEvidenceUsageAudit: ExternalEvidenceUsageAudit
}>
