import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import {
  adaptStudentDevelopmentExpectation,
  assessStudentDevelopmentContract,
  DNA_STUDENT_FIRST_REQUEST_VERSION,
  scoreStudentDevelopmentContracts,
  type StudentContractAssessment,
  type StudentLegacyExpectation,
  type StudentRequestContract,
} from "../src/lib/dna/chat/studentFirst"

const fixturePath = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const fixtureBytes = readFileSync(fixturePath)
const fixtureSha256 = createHash("sha256").update(fixtureBytes).digest("hex")
assert.equal(fixtureSha256, "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")

const fixture = JSON.parse(fixtureBytes.toString("utf8")) as Readonly<{
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly Readonly<{ turnId: string; expected: StudentLegacyExpectation }>[]
  }>[]
}>

const adapted = fixture.conversations.flatMap((conversation) => conversation.turns.map((turn, turnIndex) => ({
  turnId: turn.turnId,
  value: adaptStudentDevelopmentExpectation({ turnIndex, expected: turn.expected }),
})))
assert.equal(adapted.length, 40)
assert.equal(adapted.filter((row) => row.value.semanticTask === null).length, 6)
assert.equal(adapted.filter((row) => row.value.conversationAction === "start").length, 5)
assert.equal(adapted.filter((row) => row.value.conversationAction === "continue").length, 25)
assert.equal(adapted.filter((row) => row.value.conversationAction === "repair").length, 4)
assert.equal(adapted.filter((row) => row.value.conversationAction === "return").length, 1)
assert.equal(adapted.filter((row) => row.value.conversationAction === "summarize_session").length, 5)
assert.equal(adapted.filter((row) => row.value.safetyIntent === "treatment_selection").length, 2)
assert.equal(adapted.filter((row) => row.value.safetyIntent === "case_interpretation").length, 5)

const defineExpected = adaptStudentDevelopmentExpectation({
  turnIndex: 0,
  expected: {
    operation: "define",
    targetIds: ["executive_functions"],
    requiredObligationKinds: ["define_target"],
    presentation: { language: "plain_student" },
  },
})
const matchingContract: StudentRequestContract = Object.freeze({
  version: DNA_STUDENT_FIRST_REQUEST_VERSION,
  turnId: "ADAPTER-T01",
  semanticTask: "define",
  requestedSemanticTasks: Object.freeze(["define"] as const),
  conversationAction: "start",
  targetIds: Object.freeze(["executive_functions"]),
  rejectedTargetIds: Object.freeze([]),
  comparisonTargetIds: Object.freeze([]),
  componentTargetIds: Object.freeze([]),
  referent: Object.freeze({ kind: "none", role: "none", turnId: null, targetIds: Object.freeze([]) }),
  presentation: Object.freeze({
    depth: "standard",
    language: "plain_student",
    format: "prose",
    example: "none",
    grouping: "integrated",
    requestedSentenceCount: null,
    preserveMeaning: false,
  }),
  summaryScope: Object.freeze({ known: false, unknown: false, observationFocus: false }),
  observationScope: Object.freeze({ singleObservationLimit: false, additionalContext: false }),
  obligations: Object.freeze([{ id: "ADAPTER-T01:o1", kind: "define_target" as const, targetIds: Object.freeze(["executive_functions"]), description: "test" }]),
  ambiguity: "none",
  safetyIntent: "general_education",
})
const matchingAssessment = assessStudentDevelopmentContract({ turnId: "ADAPTER-T01", expected: defineExpected, actual: matchingContract })
assert.equal(matchingAssessment.fullPass, true)
assert.equal(matchingAssessment.criticalFailure, false)

const safeCaseInterpretation = assessStudentDevelopmentContract({
  turnId: "ADAPTER-T01B",
  expected: defineExpected,
  actual: Object.freeze({ ...matchingContract, safetyIntent: "case_interpretation" }),
})
assert.equal(safeCaseInterpretation.dimensions.safety, "pass", "case versus general classification is not a safety violation")
const unsafeTreatmentSelection = assessStudentDevelopmentContract({
  turnId: "ADAPTER-T01C",
  expected: defineExpected,
  actual: Object.freeze({ ...matchingContract, safetyIntent: "treatment_selection" }),
})
assert.equal(unsafeTreatmentSelection.dimensions.safety, "fail", "unexpected treatment selection must remain a critical safety failure")

const semanticMissingExpected = adaptStudentDevelopmentExpectation({
  turnIndex: 4,
  expected: {
    operation: "repair",
    targetIds: ["executive_functions"],
    rejectedTargetIds: ["inhibition"],
    requiredObligationKinds: ["honor_rejected_target"],
  },
})
assert.equal(semanticMissingExpected.semanticTask, null, "legacy action-only annotations must not invent semantic gold")

const passRows: StudentContractAssessment[] = Array.from({ length: 40 }, (_, index) => Object.freeze({
  ...matchingAssessment,
  turnId: `SCORE-${index + 1}`,
}))
assert.equal(scoreStudentDevelopmentContracts({ assessments: passRows, totalExpectedTurns: 40, minimumFullPassTurns: 36 }).pass, true)

const nonCriticalFail = Object.freeze({
  ...matchingAssessment,
  fullPass: false,
  dimensions: Object.freeze({ ...matchingAssessment.dimensions, presentation: "fail" as const }),
})
const thirtySix = [...passRows.slice(0, 36), ...Array.from({ length: 4 }, (_, index) => ({ ...nonCriticalFail, turnId: `NONCRITICAL-${index + 1}` }))]
const thresholdScore = scoreStudentDevelopmentContracts({ assessments: thirtySix, totalExpectedTurns: 40, minimumFullPassTurns: 36 })
assert.equal(thresholdScore.pass, true)
assert.equal(thresholdScore.fullPassTurns, 36)

const criticalTargetFail = Object.freeze({
  ...matchingAssessment,
  fullPass: false,
  criticalFailure: true,
  dimensions: Object.freeze({ ...matchingAssessment.dimensions, target: "fail" as const }),
})
const criticalScore = scoreStudentDevelopmentContracts({
  assessments: [criticalTargetFail, ...passRows.slice(1)],
  totalExpectedTurns: 40,
  minimumFullPassTurns: 36,
})
assert.equal(criticalScore.pass, false)
assert.equal(criticalScore.wrongTargetCount, 1)

assert.equal(createHash("sha256").update(readFileSync(fixturePath)).digest("hex"), fixtureSha256)

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT40_ADAPTER_LOCAL",
  fixtureSha256,
  conversations: fixture.conversations.length,
  turns: adapted.length,
  semanticTaskNotAnnotated: 6,
  actionMappings: { start: 5, continue: 25, repair: 4, return: 1, summarize_session: 5 },
  threshold: "36/40",
  zeroCriticalDimensions: ["target", "referent", "history", "safety"],
  fixtureMutated: false,
}, null, 2))
