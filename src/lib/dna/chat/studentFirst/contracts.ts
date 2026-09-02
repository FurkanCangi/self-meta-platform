export const DNA_STUDENT_FIRST_CONVERSATION_VERSION = "dna-student-conversation-state@5" as const
export const DNA_STUDENT_FIRST_REQUEST_VERSION = "dna-student-request-contract@15" as const

export type StudentSemanticTask =
  | "define"
  | "explain"
  | "compare"
  | "example"
  | "case_reasoning"
  | "summarize"
  | "observe"
  | "evidence"
  | "treatment_boundary"

export type StudentConversationAction =
  | "start"
  | "continue"
  | "repair"
  | "return"
  | "summarize_session"

export type StudentPresentationRequest = Readonly<{
  depth: "brief" | "standard" | "deep"
  language: "plain_student" | "standard"
  format: "prose" | "bullets" | "table"
  example: "none" | "brief" | "concrete"
  grouping: "integrated" | "separate_each"
  requestedSentenceCount: number | null
  preserveMeaning: boolean
}>

export type StudentSummaryScope = Readonly<{
  known: boolean
  unknown: boolean
  observationFocus: boolean
}>

export type StudentObservationScope = Readonly<{
  singleObservationLimit: boolean
  additionalContext: boolean
}>

export type StudentReferent = Readonly<{
  kind: "none" | "active" | "history"
  role: "none" | "utterance" | "case_entity"
  turnId: string | null
  targetIds: readonly string[]
}>

export type StudentAnswerObligationKind =
  | "define_target"
  | "distinguish_targets"
  | "explain_relation"
  | "give_concrete_example"
  | "bind_example_to_target"
  | "honor_rejected_target"
  | "use_history_anchor"
  | "preserve_target_while_simplifying"
  | "cover_requested_component"
  | "state_single_observation_limit"
  | "name_additional_context"
  | "summarize_known"
  | "summarize_unknown"
  | "summarize_observation_focus"
  | "refuse_treatment_selection"
  | "offer_safe_assessment_frame"

export type StudentAnswerObligation = Readonly<{
  id: string
  kind: StudentAnswerObligationKind
  targetIds: readonly string[]
  description: string
}>

export type StudentRequestContract = Readonly<{
  version: typeof DNA_STUDENT_FIRST_REQUEST_VERSION
  turnId: string
  semanticTask: StudentSemanticTask
  requestedSemanticTasks: readonly StudentSemanticTask[]
  conversationAction: StudentConversationAction
  targetIds: readonly string[]
  contextTargetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  comparisonTargetIds: readonly string[]
  componentTargetIds: readonly string[]
  referent: StudentReferent
  presentation: StudentPresentationRequest
  summaryScope: StudentSummaryScope
  observationScope: StudentObservationScope
  obligations: readonly StudentAnswerObligation[]
  ambiguity: "none" | "target_missing" | "comparison_side_missing" | "history_anchor_missing"
  safetyIntent: "general_education" | "case_interpretation" | "treatment_selection"
}>

export type StudentConversationTurnSnapshot = Readonly<{
  turnId: string
  semanticTask: StudentSemanticTask
  requestedSemanticTasks: readonly StudentSemanticTask[]
  conversationAction: StudentConversationAction
  targetIds: readonly string[]
  contextTargetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  comparisonTargetIds: readonly string[]
  referent: StudentReferent
  presentation: StudentPresentationRequest
  summaryScope: StudentSummaryScope
  observationScope: StudentObservationScope
  semanticSummary: string
}>

export type StudentConversationState = Readonly<{
  version: typeof DNA_STUDENT_FIRST_CONVERSATION_VERSION
  activeTargetIds: readonly string[]
  explicitReferent: StudentReferent
  rejectedTargetIds: readonly string[]
  comparisonTargetIds: readonly string[]
  requestedPresentation: StudentPresentationRequest
  unresolvedObligations: readonly StudentAnswerObligation[]
  compactSummary: string
  semanticHistory: readonly StudentConversationTurnSnapshot[]
}>
