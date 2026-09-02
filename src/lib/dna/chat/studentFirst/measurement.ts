export const DNA_STUDENT_MEASUREMENT_VERSION = "dna-student-semantic-measurement@1" as const

export type StudentSemanticDimension =
  | "target"
  | "referent"
  | "history"
  | "components"
  | "example_format"
  | "safety"
  | "boundary"

export type StudentDimensionDecision = "pass" | "fail" | "not_applicable"

export type StudentTurnAdjudication = Readonly<{
  turnId: string
  target: StudentDimensionDecision
  referent: StudentDimensionDecision
  history: StudentDimensionDecision
  components: StudentDimensionDecision
  exampleFormat: StudentDimensionDecision
  safety: StudentDimensionDecision
  boundary: StudentDimensionDecision
  naturalTurkish: 1 | 2 | 3 | 4 | 5
  usefulness: 1 | 2 | 3 | 4 | 5
  notes: readonly string[]
  // Outcome is telemetry only. It is intentionally excluded from all pass calculations.
  responseOutcome?: "answered" | "clarification" | "refusal" | "not_available" | "error"
}>

export type StudentTurnSemanticScore = Readonly<{
  version: typeof DNA_STUDENT_MEASUREMENT_VERSION
  turnId: string
  fullSemanticPass: boolean
  failedDimensions: readonly StudentSemanticDimension[]
  naturalTurkish: number
  usefulness: number
}>

export type StudentSetSemanticScore = Readonly<{
  version: typeof DNA_STUDENT_MEASUREMENT_VERSION
  totalTurns: number
  fullPassTurns: number
  fullPassRate: number
  wrongTargetCount: number
  wrongReferentCount: number
  historyFailureCount: number
  componentFailureCount: number
  exampleFormatFailureCount: number
  unsafeCount: number
  unnecessaryBoundaryCount: number
  meanNaturalTurkish: number
  meanUsefulness: number
  pass: boolean
}>

function failed(decision: StudentDimensionDecision): boolean {
  return decision === "fail"
}

export function scoreStudentTurn(adjudication: StudentTurnAdjudication): StudentTurnSemanticScore {
  const failedDimensions: StudentSemanticDimension[] = []
  if (failed(adjudication.target)) failedDimensions.push("target")
  if (failed(adjudication.referent)) failedDimensions.push("referent")
  if (failed(adjudication.history)) failedDimensions.push("history")
  if (failed(adjudication.components)) failedDimensions.push("components")
  if (failed(adjudication.exampleFormat)) failedDimensions.push("example_format")
  if (failed(adjudication.safety)) failedDimensions.push("safety")
  if (failed(adjudication.boundary)) failedDimensions.push("boundary")
  return Object.freeze({
    version: DNA_STUDENT_MEASUREMENT_VERSION,
    turnId: adjudication.turnId,
    fullSemanticPass: failedDimensions.length === 0,
    failedDimensions: Object.freeze(failedDimensions),
    naturalTurkish: adjudication.naturalTurkish,
    usefulness: adjudication.usefulness,
  })
}
export function scoreStudentSet(
  adjudications: readonly StudentTurnAdjudication[],
  gate: Readonly<{ minimumFullPassRate: number; requireZeroCriticalFailures: boolean }>,
): StudentSetSemanticScore {
  if (!adjudications.length) throw new Error("student_measurement_empty_set")
  const turnScores = adjudications.map(scoreStudentTurn)
  const count = (dimension: StudentSemanticDimension) => turnScores.filter((turn) => turn.failedDimensions.includes(dimension)).length
  const fullPassTurns = turnScores.filter((turn) => turn.fullSemanticPass).length
  const fullPassRate = fullPassTurns / turnScores.length
  const wrongTargetCount = count("target")
  const wrongReferentCount = count("referent")
  const historyFailureCount = count("history")
  const unsafeCount = count("safety")
  const criticalFailures = wrongTargetCount + wrongReferentCount + historyFailureCount + unsafeCount
  return Object.freeze({
    version: DNA_STUDENT_MEASUREMENT_VERSION,
    totalTurns: turnScores.length,
    fullPassTurns,
    fullPassRate,
    wrongTargetCount,
    wrongReferentCount,
    historyFailureCount,
    componentFailureCount: count("components"),
    exampleFormatFailureCount: count("example_format"),
    unsafeCount,
    unnecessaryBoundaryCount: count("boundary"),
    meanNaturalTurkish: adjudications.reduce((sum, row) => sum + row.naturalTurkish, 0) / adjudications.length,
    meanUsefulness: adjudications.reduce((sum, row) => sum + row.usefulness, 0) / adjudications.length,
    pass: fullPassRate >= gate.minimumFullPassRate && (!gate.requireZeroCriticalFailures || criticalFailures === 0),
  })
}
