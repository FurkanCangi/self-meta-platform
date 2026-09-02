import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import {
  adaptStudentDevelopmentExpectation,
  applyStudentRequestContract,
  buildStudentStateCandidateEnvelope,
  compileStudentRequestContract,
  createEmptyStudentConversationState,
  observeStudentRequestFacts,
  type StudentConversationState,
  type StudentDevelopmentExpectation,
  type StudentLegacyExpectation,
  type StudentPresentationRequest,
  type StudentSemanticFrame,
  type StudentSemanticTask,
} from "../src/lib/dna/chat/studentFirst"

const HARNESS_VERSION = "dna-student-evidence-first-student40@1" as const
const FIXTURE_PATH = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const EXPECTED_FIXTURE_SHA256 = "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65"
const TASKS: readonly StudentSemanticTask[] = Object.freeze([
  "define", "explain", "compare", "example", "case_reasoning", "summarize",
  "observe", "evidence", "treatment_boundary",
])

type FixtureTurn = Readonly<{ turnId: string; user: string; expected: StudentLegacyExpectation }>
type Fixture = Readonly<{
  conversations: readonly Readonly<{ conversationId: string; turns: readonly FixtureTurn[] }>[]
}>

type Failure = Readonly<{
  turnId: string
  dimensions: readonly string[]
  expectedTargets: readonly string[]
  allowedTargets: readonly string[]
  expectedReferent: string | null
  allowedReferents: readonly string[]
  expectedTask: StudentSemanticTask | null
  taskCandidates: readonly StudentSemanticTask[]
  expectedAction: string
  actualAction: string
  expectedRejectedTargets: readonly string[]
  actualRejectedTargets: readonly string[]
}>

const DEFAULT_PRESENTATION: StudentPresentationRequest = Object.freeze({
  depth: "standard",
  language: "standard",
  format: "prose",
  example: "none",
  grouping: "integrated",
  requestedSentenceCount: null,
  preserveMeaning: false,
})

function hash(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left)].sort()
  const b = [...new Set(right)].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function acts(enabled: ReadonlySet<StudentSemanticTask>): StudentSemanticFrame["semanticActs"] {
  return Object.freeze(Object.fromEntries(TASKS.map((task) => [task, enabled.has(task)])) as Record<StudentSemanticTask, boolean>)
}

function oracleFrame(input: Readonly<{
  turn: FixtureTurn
  expected: StudentDevelopmentExpectation
  state: StudentConversationState
}>): StudentSemanticFrame {
  const enabled = new Set<StudentSemanticTask>()
  if (input.expected.semanticTask) enabled.add(input.expected.semanticTask)
  if (input.turn.expected.requiredObligationKinds.includes("give_concrete_example")) enabled.add("example")
  if (input.turn.expected.requiredObligationKinds.includes("distinguish_targets")) enabled.add("compare")
  if (!enabled.size && input.turn.expected.operation !== "simplify") enabled.add("explain")
  const referentSnapshot = input.expected.referentTurnId
    ? input.state.semanticHistory.find((turn) => turn.turnId === input.expected.referentTurnId) ?? null
    : null
  const automaticObservation = input.expected.semanticTask === "observe" || input.expected.semanticTask === "case_reasoning"
  return Object.freeze({
    semanticActs: acts(enabled),
    conversationAction: input.expected.conversationAction,
    focusTargetIds: Object.freeze([...input.expected.targetIds]),
    contextTargetIds: Object.freeze([]),
    rejectedTargetIds: Object.freeze([...input.expected.rejectedTargetIds]),
    referentTurnId: input.expected.referentTurnId,
    referentRole: input.expected.referentTurnId
      ? referentSnapshot?.semanticTask === "example" ? "case_entity" : "utterance"
      : "none",
    presentation: Object.freeze({
      ...DEFAULT_PRESENTATION,
      ...(input.expected.presentation ?? {}),
      example: input.expected.presentation?.example ??
        (input.turn.expected.requiredObligationKinds.includes("give_concrete_example") ? "brief" : "none"),
      grouping: input.expected.componentTargetIds.length ? "separate_each" : "integrated",
      preserveMeaning: input.turn.expected.operation === "simplify",
    }),
    summaryExtras: Object.freeze({
      unknown: input.turn.expected.requiredObligationKinds.includes("summarize_unknown"),
      observationFocus: input.turn.expected.requiredObligationKinds.includes("summarize_observation_focus"),
    }),
    observationExtras: Object.freeze({
      singleObservationLimit: !automaticObservation && input.turn.expected.requiredObligationKinds.includes("state_single_observation_limit"),
      additionalContext: !automaticObservation && input.turn.expected.requiredObligationKinds.includes("name_additional_context"),
    }),
  })
}

const before = readFileSync(FIXTURE_PATH)
assert.equal(hash(before), EXPECTED_FIXTURE_SHA256, "Student40 fixture hash mismatch")
const fixture = JSON.parse(before.toString("utf8")) as Fixture
const failures: Failure[] = []
let evaluated = 0

for (const conversation of fixture.conversations) {
  let state = createEmptyStudentConversationState()
  for (const [turnIndex, turn] of conversation.turns.entries()) {
    const expected = adaptStudentDevelopmentExpectation({ turnIndex, expected: turn.expected })
    const facts = observeStudentRequestFacts({ turnId: turn.turnId, message: turn.user, state })
    const envelope = buildStudentStateCandidateEnvelope({ facts, state })
    const dimensions: string[] = []
    if (!sameSet(envelope.allowedFocusTargetIds, expected.targetIds)) dimensions.push("target")
    if (expected.referentTurnId && !envelope.allowedReferentTurnIds.includes(expected.referentTurnId)) dimensions.push("referent")
    if (facts.conversationAction !== expected.conversationAction) dimensions.push("history")
    if (expected.semanticTask && !facts.semanticTaskCandidates.includes(expected.semanticTask)) dimensions.push("semanticTask")
    if (!sameSet(facts.rejectedTargetIds, expected.rejectedTargetIds)) dimensions.push("rejection")
    const expectedSafety = expected.safetyIntent === "treatment_selection" ? "treatment_selection" :
      expected.safetyIntent === "case_interpretation" ? "case_interpretation" : "general_education"
    if (facts.safetyIntent !== expectedSafety) dimensions.push("safety")
    if (JSON.stringify({ facts, envelope }).includes(turn.user)) dimensions.push("raw_message_retention")
    if (dimensions.length) failures.push(Object.freeze({
      turnId: turn.turnId,
      dimensions: Object.freeze(dimensions),
      expectedTargets: expected.targetIds,
      allowedTargets: envelope.allowedFocusTargetIds,
      expectedReferent: expected.referentTurnId,
      allowedReferents: envelope.allowedReferentTurnIds,
      expectedTask: expected.semanticTask,
      taskCandidates: facts.semanticTaskCandidates,
      expectedAction: expected.conversationAction,
      actualAction: facts.conversationAction,
      expectedRejectedTargets: expected.rejectedTargetIds,
      actualRejectedTargets: facts.rejectedTargetIds,
    }))
    const contract = compileStudentRequestContract(turn.turnId, oracleFrame({ turn, expected, state }), state)
    state = applyStudentRequestContract(state, contract)
    evaluated += 1
  }
}

const afterSha = hash(readFileSync(FIXTURE_PATH))
assert.equal(afterSha, EXPECTED_FIXTURE_SHA256, "Student40 fixture mutated")
const ok = evaluated === 40 && failures.length === 0
console.log(JSON.stringify({
  ok,
  gate: "STUDENT40_EVIDENCE_FIRST_R1_LOCAL",
  version: HARNESS_VERSION,
  evaluated,
  passed: evaluated - failures.length,
  failed: failures.length,
  providerCalls: 0,
  rawMessagesPersisted: failures.filter((row) => row.dimensions.includes("raw_message_retention")).length,
  fixture: { sha256: afterSha, mutated: false },
  failures,
}, null, 2))
if (!ok) process.exitCode = 1
