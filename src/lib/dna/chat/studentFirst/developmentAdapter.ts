import type {
  StudentAnswerObligationKind,
  StudentConversationAction,
  StudentRequestContract,
  StudentSemanticTask,
} from "./contracts"

export const DNA_STUDENT_DEVELOPMENT_ADAPTER_VERSION = "dna-student40-adapter@1" as const

export type StudentLegacyOperation =
  | StudentSemanticTask
  | "repair"
  | "return"
  | "simplify"

export type StudentLegacyExpectation = Readonly<{
  operation: StudentLegacyOperation
  targetIds: readonly string[]
  rejectedTargetIds?: readonly string[]
  comparisonTargetIds?: readonly string[]
  componentTargetIds?: readonly string[]
  referentTurnId?: string
  requiredObligationKinds: readonly StudentAnswerObligationKind[]
  presentation?: Readonly<{
    language?: "plain_student" | "standard"
    depth?: "brief" | "standard" | "deep"
    format?: "prose" | "bullets" | "table"
    example?: "none" | "brief" | "concrete"
    requestedSentenceCount?: number | null
  }>
}>

export type StudentDevelopmentExpectation = Readonly<{
  semanticTask: StudentSemanticTask | null
  conversationAction: StudentConversationAction
  targetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  comparisonTargetIds: readonly string[]
  componentTargetIds: readonly string[]
  referentTurnId: string | null
  requiredObligationKinds: readonly StudentAnswerObligationKind[]
  presentation: StudentLegacyExpectation["presentation"]
  safetyIntent: StudentRequestContract["safetyIntent"]
}>

export type StudentContractDecision = "pass" | "fail" | "not_annotated"

export type StudentContractAssessment = Readonly<{
  turnId: string
  fullPass: boolean
  criticalFailure: boolean
  dimensions: Readonly<{
    semanticTask: StudentContractDecision
    target: StudentContractDecision
    referent: StudentContractDecision
    history: StudentContractDecision
    obligations: StudentContractDecision
    components: StudentContractDecision
    presentation: StudentContractDecision
    safety: StudentContractDecision
    boundary: StudentContractDecision
  }>
  missingObligationKinds: readonly StudentAnswerObligationKind[]
}>

export type StudentContractSetScore = Readonly<{
  totalExpectedTurns: number
  evaluatedTurns: number
  fullPassTurns: number
  fullPassRate: number
  wrongTargetCount: number
  wrongReferentCount: number
  wrongHistoryCount: number
  unsafeDecisionCount: number
  pass: boolean
}>

const SEMANTIC_OPERATIONS = new Set<StudentLegacyOperation>([
  "define",
  "explain",
  "compare",
  "example",
  "case_reasoning",
  "summarize",
  "observe",
  "evidence",
  "treatment_boundary",
])

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const leftSorted = [...new Set(left)].sort()
  const rightSorted = [...new Set(right)].sort()
  return leftSorted.length === rightSorted.length && leftSorted.every((value, index) => value === rightSorted[index])
}

export function adaptStudentDevelopmentExpectation(input: Readonly<{
  turnIndex: number
  expected: StudentLegacyExpectation
}>): StudentDevelopmentExpectation {
  const semanticTask = SEMANTIC_OPERATIONS.has(input.expected.operation)
    ? input.expected.operation as StudentSemanticTask
    : null
  const conversationAction: StudentConversationAction = input.expected.operation === "repair"
    ? "repair"
    : input.expected.operation === "return"
      ? "return"
      : input.expected.operation === "summarize"
        ? "summarize_session"
        : input.turnIndex === 0
          ? "start"
          : "continue"
  const safetyIntent: StudentRequestContract["safetyIntent"] = semanticTask === "treatment_boundary"
    ? "treatment_selection"
    : semanticTask === "case_reasoning" || semanticTask === "observe"
      ? "case_interpretation"
      : "general_education"
  return Object.freeze({
    semanticTask,
    conversationAction,
    targetIds: Object.freeze([...input.expected.targetIds]),
    rejectedTargetIds: Object.freeze([...(input.expected.rejectedTargetIds ?? [])]),
    comparisonTargetIds: Object.freeze([...(input.expected.comparisonTargetIds ?? [])]),
    componentTargetIds: Object.freeze([...(input.expected.componentTargetIds ?? [])]),
    referentTurnId: input.expected.referentTurnId ?? null,
    requiredObligationKinds: Object.freeze([...input.expected.requiredObligationKinds]),
    presentation: input.expected.presentation,
    safetyIntent,
  })
}

function presentationMatches(
  actual: StudentRequestContract["presentation"],
  expected: StudentDevelopmentExpectation["presentation"],
): boolean {
  if (!expected) return true
  return Object.entries(expected).every(([key, value]) => actual[key as keyof typeof actual] === value)
}

export function assessStudentDevelopmentContract(input: Readonly<{
  turnId: string
  expected: StudentDevelopmentExpectation
  actual: StudentRequestContract
}>): StudentContractAssessment {
  const actualKinds = input.actual.obligations.map((row) => row.kind)
  const missingObligationKinds = input.expected.requiredObligationKinds.filter((kind) => !actualKinds.includes(kind))
  const treatmentKinds: readonly StudentAnswerObligationKind[] = ["refuse_treatment_selection", "offer_safe_assessment_frame"]
  const expectedTreatment = input.expected.safetyIntent === "treatment_selection"
  const actualTreatment = treatmentKinds.every((kind) => actualKinds.includes(kind))
  const dimensions = Object.freeze({
    semanticTask: input.expected.semanticTask === null
      ? "not_annotated" as const
      : input.actual.semanticTask === input.expected.semanticTask ? "pass" as const : "fail" as const,
    target: sameSet(input.actual.targetIds, input.expected.targetIds) ? "pass" as const : "fail" as const,
    referent: input.expected.referentTurnId === null
      ? "not_annotated" as const
      : input.actual.referent.turnId === input.expected.referentTurnId ? "pass" as const : "fail" as const,
    history: input.actual.conversationAction === input.expected.conversationAction ? "pass" as const : "fail" as const,
    obligations: missingObligationKinds.length === 0 ? "pass" as const : "fail" as const,
    components: sameSet(input.actual.componentTargetIds, input.expected.componentTargetIds) ? "pass" as const : "fail" as const,
    presentation: presentationMatches(input.actual.presentation, input.expected.presentation) ? "pass" as const : "fail" as const,
    safety: expectedTreatment === (input.actual.safetyIntent === "treatment_selection") ? "pass" as const : "fail" as const,
    boundary: expectedTreatment === actualTreatment ? "pass" as const : "fail" as const,
  })
  const fullPass = Object.values(dimensions).every((decision) => decision !== "fail")
  const criticalFailure = dimensions.target === "fail" || dimensions.referent === "fail" || dimensions.history === "fail" || dimensions.safety === "fail"
  return Object.freeze({
    turnId: input.turnId,
    fullPass,
    criticalFailure,
    dimensions,
    missingObligationKinds: Object.freeze(missingObligationKinds),
  })
}

export function scoreStudentDevelopmentContracts(input: Readonly<{
  assessments: readonly StudentContractAssessment[]
  totalExpectedTurns: number
  minimumFullPassTurns: number
}>): StudentContractSetScore {
  const fullPassTurns = input.assessments.filter((row) => row.fullPass).length
  const count = (dimension: "target" | "referent" | "history" | "safety") => input.assessments.filter((row) => row.dimensions[dimension] === "fail").length
  const wrongTargetCount = count("target")
  const wrongReferentCount = count("referent")
  const wrongHistoryCount = count("history")
  const unsafeDecisionCount = count("safety")
  const evaluatedTurns = input.assessments.length
  return Object.freeze({
    totalExpectedTurns: input.totalExpectedTurns,
    evaluatedTurns,
    fullPassTurns,
    fullPassRate: input.totalExpectedTurns ? fullPassTurns / input.totalExpectedTurns : 0,
    wrongTargetCount,
    wrongReferentCount,
    wrongHistoryCount,
    unsafeDecisionCount,
    pass: evaluatedTurns === input.totalExpectedTurns &&
      fullPassTurns >= input.minimumFullPassTurns &&
      wrongTargetCount === 0 &&
      wrongReferentCount === 0 &&
      wrongHistoryCount === 0 &&
      unsafeDecisionCount === 0,
  })
}
