import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

import {
  adaptStudentDevelopmentExpectation,
  applyStudentRequestContract,
  assessStudentDevelopmentContract,
  compileStudentRequestContract,
  createEmptyStudentConversationState,
  detectContextStudentTargetIds,
  detectExplicitStudentTargetIds,
  groundStudentExplicitTargets,
  groundStudentRequestIntent,
  groundStudentTargetRoles,
  resolveStudentConversationAction,
  validateStudentSemanticFrameDetailed,
  type StudentContractAssessment,
  type StudentConversationState,
  type StudentDevelopmentExpectation,
  type StudentLegacyExpectation,
  type StudentPresentationRequest,
  type StudentRequestContract,
  type StudentSemanticFrame,
  type StudentSemanticTask,
} from "../src/lib/dna/chat/studentFirst"

const HARNESS_VERSION = "dna-student-provider-frame-mutations@1" as const
const FIXTURE_PATH = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const EXPECTED_FIXTURE_SHA256 = "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65"

const TASKS: readonly StudentSemanticTask[] = Object.freeze([
  "define", "explain", "compare", "example", "case_reasoning", "summarize",
  "observe", "evidence", "treatment_boundary",
])

type FixtureTurn = Readonly<{
  turnId: string
  user: string
  expected: StudentLegacyExpectation
}>

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly FixtureTurn[]
  }>[]
}>

type MutationFamily =
  | "target_order"
  | "duplicate_target"
  | "omit_explicit_target"
  | "promote_context_behavior"
  | "omit_referent"
  | "copy_historical_rejection"
  | "wrong_explicit_action"
  | "single_act_only"
  | "omit_grouping"
  | "omit_example_presentation"
  | "summary_focus_noise"

type Mutation = Readonly<{
  family: MutationFamily
  frame: StudentSemanticFrame
  detail: string
}>

type FamilyStats = {
  total: number
  passed: number
  typedFailClosed: number
  failed: number
}

type FailureRow = Readonly<{
  turnId: string
  family: "baseline" | MutationFamily
  detail: string
  failureCode: string | null
  failedDimensions: readonly string[]
  expectedTargets: readonly string[]
  actualTargets: readonly string[]
  expectedReferent: string | null
  actualReferent: string | null
  expectedAction: string
  actualAction: string | null
  missingObligations: readonly string[]
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

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function semanticActs(enabled: ReadonlySet<StudentSemanticTask>): StudentSemanticFrame["semanticActs"] {
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

  const presentation: StudentPresentationRequest = Object.freeze({
    ...DEFAULT_PRESENTATION,
    ...(input.expected.presentation ?? {}),
    example: input.expected.presentation?.example
      ?? (input.turn.expected.requiredObligationKinds.includes("give_concrete_example") ? "brief" : "none"),
    grouping: input.expected.componentTargetIds.length ? "separate_each" : "integrated",
    preserveMeaning: input.turn.expected.operation === "simplify",
  })
  const referentSnapshot = input.expected.referentTurnId
    ? input.state.semanticHistory.find((turn) => turn.turnId === input.expected.referentTurnId) ?? null
    : null
  const referentRole: StudentSemanticFrame["referentRole"] = !input.expected.referentTurnId
    ? "none"
    : referentSnapshot?.semanticTask === "example"
      ? "case_entity"
      : "utterance"
  const summaryExtras = Object.freeze({
    unknown: input.turn.expected.requiredObligationKinds.includes("summarize_unknown"),
    observationFocus: input.turn.expected.requiredObligationKinds.includes("summarize_observation_focus"),
  })
  const automaticObservation = input.expected.semanticTask === "observe" || input.expected.semanticTask === "case_reasoning"
  const observationExtras = Object.freeze({
    singleObservationLimit: !automaticObservation && input.turn.expected.requiredObligationKinds.includes("state_single_observation_limit"),
    additionalContext: !automaticObservation && input.turn.expected.requiredObligationKinds.includes("name_additional_context"),
  })
  return Object.freeze({
    semanticActs: semanticActs(enabled),
    conversationAction: input.expected.conversationAction,
    focusTargetIds: Object.freeze([...input.expected.targetIds]),
    contextTargetIds: Object.freeze([]),
    rejectedTargetIds: Object.freeze([...input.expected.rejectedTargetIds]),
    referentTurnId: input.expected.referentTurnId,
    referentRole,
    presentation,
    summaryExtras,
    observationExtras,
  })
}

function withFrame(frame: StudentSemanticFrame, patch: Partial<StudentSemanticFrame>): StudentSemanticFrame {
  return Object.freeze({
    ...frame,
    ...patch,
    semanticActs: patch.semanticActs ?? frame.semanticActs,
    focusTargetIds: Object.freeze([...(patch.focusTargetIds ?? frame.focusTargetIds)]),
    contextTargetIds: Object.freeze([...(patch.contextTargetIds ?? frame.contextTargetIds)]),
    rejectedTargetIds: Object.freeze([...(patch.rejectedTargetIds ?? frame.rejectedTargetIds)]),
    presentation: Object.freeze({ ...frame.presentation, ...(patch.presentation ?? {}) }),
    summaryExtras: Object.freeze({ ...frame.summaryExtras, ...(patch.summaryExtras ?? {}) }),
    observationExtras: Object.freeze({ ...frame.observationExtras, ...(patch.observationExtras ?? {}) }),
  })
}

function groundAndCompile(input: Readonly<{
  turn: FixtureTurn
  frame: StudentSemanticFrame
  state: StudentConversationState
}>): Readonly<
  | { ok: true; contract: StudentRequestContract }
  | { ok: false; failureCode: string }
> {
  const actionResolved = Object.freeze({
    ...input.frame,
    conversationAction: resolveStudentConversationAction({
      message: input.turn.user,
      providerAction: input.frame.conversationAction,
      hasHistory: input.state.semanticHistory.length > 0,
      preserveMeaning: input.frame.presentation.preserveMeaning,
    }),
  })
  const explicitGrounded = groundStudentExplicitTargets({ message: input.turn.user, candidate: actionResolved })
  const intentGrounded = groundStudentRequestIntent({ message: input.turn.user, state: input.state, candidate: explicitGrounded })
  const roleGrounded = groundStudentTargetRoles({ message: input.turn.user, state: input.state, candidate: intentGrounded })
  const validation = validateStudentSemanticFrameDetailed(roleGrounded, input.state)
  if (!validation.ok) return Object.freeze({ ok: false, failureCode: validation.failureCode })
  return Object.freeze({
    ok: true,
    contract: compileStudentRequestContract(input.turn.turnId, validation.frame, input.state),
  })
}

function failedDimensions(assessment: StudentContractAssessment): readonly string[] {
  return Object.freeze(Object.entries(assessment.dimensions)
    .filter(([, decision]) => decision === "fail")
    .map(([dimension]) => dimension))
}

function failureRow(input: Readonly<{
  turnId: string
  family: "baseline" | MutationFamily
  detail: string
  expected: StudentDevelopmentExpectation
  failureCode?: string
  contract?: StudentRequestContract
  assessment?: StudentContractAssessment
}>): FailureRow {
  return Object.freeze({
    turnId: input.turnId,
    family: input.family,
    detail: input.detail,
    failureCode: input.failureCode ?? null,
    failedDimensions: input.assessment ? failedDimensions(input.assessment) : Object.freeze([]),
    expectedTargets: input.expected.targetIds,
    actualTargets: input.contract?.targetIds ?? Object.freeze([]),
    expectedReferent: input.expected.referentTurnId,
    actualReferent: input.contract?.referent.turnId ?? null,
    expectedAction: input.expected.conversationAction,
    actualAction: input.contract?.conversationAction ?? null,
    missingObligations: input.assessment?.missingObligationKinds ?? Object.freeze([]),
  })
}

function mutationsFor(input: Readonly<{
  turn: FixtureTurn
  expected: StudentDevelopmentExpectation
  frame: StudentSemanticFrame
  state: StudentConversationState
}>): readonly Mutation[] {
  const rows: Mutation[] = []
  if (input.frame.focusTargetIds.length > 1) {
    rows.push(Object.freeze({
      family: "target_order",
      detail: "reverse_focus_order",
      frame: withFrame(input.frame, { focusTargetIds: [...input.frame.focusTargetIds].reverse() }),
    }))
  }
  if (input.frame.focusTargetIds.length) {
    rows.push(Object.freeze({
      family: "duplicate_target",
      detail: "duplicate_first_focus",
      frame: withFrame(input.frame, { focusTargetIds: [...input.frame.focusTargetIds, input.frame.focusTargetIds[0]!] }),
    }))
  }
  const explicitTargets = detectExplicitStudentTargetIds(input.turn.user)
    .filter((targetId) => input.frame.focusTargetIds.includes(targetId) && !input.frame.rejectedTargetIds.includes(targetId))
  for (const targetId of explicitTargets) {
    rows.push(Object.freeze({
      family: "omit_explicit_target",
      detail: `omit:${targetId}`,
      frame: withFrame(input.frame, { focusTargetIds: input.frame.focusTargetIds.filter((item) => item !== targetId) }),
    }))
  }
  for (const targetId of detectContextStudentTargetIds(input.turn.user).filter((item) => !input.expected.targetIds.includes(item))) {
    rows.push(Object.freeze({
      family: "promote_context_behavior",
      detail: `promote:${targetId}`,
      frame: withFrame(input.frame, { focusTargetIds: [...input.frame.focusTargetIds, targetId] }),
    }))
  }
  if (input.expected.referentTurnId) {
    rows.push(Object.freeze({
      family: "omit_referent",
      detail: `omit:${input.expected.referentTurnId}`,
      frame: withFrame(input.frame, { referentTurnId: null, referentRole: "none" }),
    }))
  }
  if (input.state.rejectedTargetIds.length && input.frame.conversationAction !== "repair") {
    rows.push(Object.freeze({
      family: "copy_historical_rejection",
      detail: "copy_state_rejections",
      frame: withFrame(input.frame, { rejectedTargetIds: input.state.rejectedTargetIds }),
    }))
  }
  if (["start", "repair", "return", "summarize_session"].includes(input.frame.conversationAction)) {
    rows.push(Object.freeze({
      family: "wrong_explicit_action",
      detail: `${input.frame.conversationAction}->continue`,
      frame: withFrame(input.frame, { conversationAction: "continue" }),
    }))
  }
  const enabledActs = TASKS.filter((task) => input.frame.semanticActs[task])
  if (enabledActs.length > 1) {
    const retained = input.expected.semanticTask && enabledActs.includes(input.expected.semanticTask)
      ? input.expected.semanticTask
      : enabledActs[0]!
    rows.push(Object.freeze({
      family: "single_act_only",
      detail: `retain:${retained}`,
      frame: withFrame(input.frame, { semanticActs: semanticActs(new Set([retained])) }),
    }))
  }
  if (input.frame.presentation.grouping === "separate_each") {
    rows.push(Object.freeze({
      family: "omit_grouping",
      detail: "separate_each->integrated",
      frame: withFrame(input.frame, { presentation: { ...input.frame.presentation, grouping: "integrated" } }),
    }))
  }
  if (input.frame.presentation.example !== "none") {
    rows.push(Object.freeze({
      family: "omit_example_presentation",
      detail: `${input.frame.presentation.example}->none`,
      frame: withFrame(input.frame, { presentation: { ...input.frame.presentation, example: "none" } }),
    }))
  }
  if (input.frame.conversationAction === "summarize_session" && input.state.activeTargetIds.length) {
    rows.push(Object.freeze({
      family: "summary_focus_noise",
      detail: "copy_latest_active_targets",
      frame: withFrame(input.frame, { focusTargetIds: input.state.activeTargetIds }),
    }))
  }
  return Object.freeze(rows)
}

function main() {
  const beforeBytes = readFileSync(FIXTURE_PATH)
  const beforeSha = sha256(beforeBytes)
  assert.equal(beforeSha, EXPECTED_FIXTURE_SHA256, "Student40 fixture hash mismatch")
  const fixture = JSON.parse(beforeBytes.toString("utf8")) as Fixture
  assert.equal(fixture.conversations.length, 5)
  assert.equal(fixture.conversations.reduce((total, conversation) => total + conversation.turns.length, 0), 40)

  const baselineStats = { total: 0, passed: 0, failed: 0 }
  const familyStats = Object.fromEntries([
    "target_order", "duplicate_target", "omit_explicit_target", "promote_context_behavior",
    "omit_referent", "copy_historical_rejection", "wrong_explicit_action", "single_act_only",
    "omit_grouping", "omit_example_presentation",
    "summary_focus_noise",
  ].map((family) => [family, { total: 0, passed: 0, typedFailClosed: 0, failed: 0 } satisfies FamilyStats])) as Record<MutationFamily, FamilyStats>
  const failures: FailureRow[] = []

  for (const conversation of fixture.conversations) {
    let state = createEmptyStudentConversationState()
    for (let turnIndex = 0; turnIndex < conversation.turns.length; turnIndex += 1) {
      const turn = conversation.turns[turnIndex]!
      const expected = adaptStudentDevelopmentExpectation({ turnIndex, expected: turn.expected })
      const frame = oracleFrame({ turn, expected, state })
      const baseline = groundAndCompile({ turn, frame, state })
      baselineStats.total += 1
      if (!baseline.ok) {
        baselineStats.failed += 1
        failures.push(failureRow({
          turnId: turn.turnId,
          family: "baseline",
          detail: "oracle_frame_invalid",
          expected,
          failureCode: baseline.failureCode,
        }))
        continue
      }
      const baselineAssessment = assessStudentDevelopmentContract({ turnId: turn.turnId, expected, actual: baseline.contract })
      if (baselineAssessment.fullPass) baselineStats.passed += 1
      else {
        baselineStats.failed += 1
        failures.push(failureRow({
          turnId: turn.turnId,
          family: "baseline",
          detail: "oracle_contract_mismatch",
          expected,
          contract: baseline.contract,
          assessment: baselineAssessment,
        }))
      }

      for (const mutation of mutationsFor({ turn, expected, frame, state })) {
        const stats = familyStats[mutation.family]
        stats.total += 1
        const result = groundAndCompile({ turn, frame: mutation.frame, state })
        if (!result.ok) {
          if (mutation.family === "duplicate_target" && result.failureCode === "invalid_focus_targets") {
            stats.typedFailClosed += 1
            stats.passed += 1
          } else {
            stats.failed += 1
            failures.push(failureRow({
              turnId: turn.turnId,
              family: mutation.family,
              detail: mutation.detail,
              expected,
              failureCode: result.failureCode,
            }))
          }
          continue
        }
        const assessment = assessStudentDevelopmentContract({ turnId: turn.turnId, expected, actual: result.contract })
        if (assessment.fullPass) stats.passed += 1
        else {
          stats.failed += 1
          failures.push(failureRow({
            turnId: turn.turnId,
            family: mutation.family,
            detail: mutation.detail,
            expected,
            contract: result.contract,
            assessment,
          }))
        }
      }

      state = applyStudentRequestContract(state, baseline.contract)
      assert.equal(JSON.stringify(state).includes(turn.user), false, `${turn.turnId}: raw message persisted`)
    }
  }

  const afterSha = sha256(readFileSync(FIXTURE_PATH))
  assert.equal(afterSha, beforeSha, "Student40 fixture mutated")
  const mutationTotals = Object.values(familyStats).reduce((sum, row) => sum + row.total, 0)
  const mutationPassed = Object.values(familyStats).reduce((sum, row) => sum + row.passed, 0)
  const ok = baselineStats.failed === 0 && mutationPassed === mutationTotals
  console.log(JSON.stringify({
    ok,
    gate: "STUDENT40_PROVIDER_FRAME_MUTATION_LOCAL",
    version: HARNESS_VERSION,
    fixture: {
      sha256: afterSha,
      mutated: false,
      conversations: 5,
      turns: 40,
    },
    baseline: baselineStats,
    mutations: {
      total: mutationTotals,
      passed: mutationPassed,
      failed: mutationTotals - mutationPassed,
      byFamily: familyStats,
    },
    criticalExitGate: {
      targetReferentHistorySafetyFailures: failures.filter((row) => row.failedDimensions.some((dimension) =>
        ["target", "referent", "history", "safety"].includes(dimension))).length,
      behaviorContextPromotionFailures: familyStats.promote_context_behavior.failed,
      rejectedTargetReentryFailures: familyStats.copy_historical_rejection.failed,
    },
    rawMessagesLogged: false,
    providerCalls: 0,
    failures: failures.slice(0, 80),
    failureRowsTruncated: failures.length > 80,
  }, null, 2))
  if (!ok) process.exitCode = 1
}

main()
