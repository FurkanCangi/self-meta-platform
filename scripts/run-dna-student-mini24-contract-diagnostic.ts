import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"

import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
} from "../src/lib/dna/chat/studentFirst"

type ExpectedContract = Readonly<{
  task: string
  targetIds: readonly string[]
  exactTargets?: boolean
  rejectedTargetIds?: readonly string[]
  referentTurnId?: string
  obligationKinds?: readonly string[]
}>

type Fixture = Readonly<{
  fixtureId: string
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly Readonly<{ turnId: string; rawUserMessage: string }>[]
  }>[]
}>

type Gold = Readonly<{
  fixtureId: string
  rows: readonly Readonly<{
    turnId: string
    primaryTarget: string
    comparisonSides: readonly string[]
    multipartComponents: readonly string[]
    rejectedTargets: readonly string[]
    requiredReferent: string | null
    requiredHistoryAnchor: string | null
    evidenceMode: string
  }>[]
}>

const ROOT_CANDIDATES = [
  ".tmp/dna-chat-natural-production-20260824/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24",
  ".tmp/dna-chat-final-visible-atomic-closure-20260831/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24",
  ".tmp/dna-chat-obligation-closure-seal-20260826/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24",
] as const
const FIXTURE_SHA256 = "9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc"
const GOLD_SHA256 = "2a54904a77979b381948d7815f832013720b127a4199989087b9e3183723bc50"
const EXPECTED_CONTRACTS: Readonly<Record<string, ExpectedContract>> = Object.freeze({
  "NMINI-C01-T01": { task: "define", targetIds: ["self_regulation"], obligationKinds: ["define_target"] },
  "NMINI-C01-T02": { task: "compare", targetIds: ["self_regulation", "self_control"], obligationKinds: ["distinguish_targets", "explain_relation"] },
  "NMINI-C01-T03": { task: "example", targetIds: ["self_regulation"], exactTargets: false, obligationKinds: ["give_concrete_example", "bind_example_to_target"] },
  "NMINI-C01-T04": { task: "compare", targetIds: ["self_regulation", "attention"], obligationKinds: ["state_single_observation_limit", "name_additional_context", "name_multiple_plausible_explanations"] },
  "NMINI-C01-T05": { task: "case_reasoning", targetIds: ["self_regulation", "recovery"], rejectedTargetIds: ["attention"], obligationKinds: ["state_single_observation_limit", "name_additional_context", "honor_rejected_target"] },
  "NMINI-C01-T06": { task: "explain", targetIds: ["planning", "inhibition", "emotion_regulation"], obligationKinds: ["cover_requested_component"] },
  "NMINI-C01-T07": { task: "observe", targetIds: ["planning", "inhibition", "emotion_regulation"], referentTurnId: "NMINI-C01-T06", obligationKinds: ["state_single_observation_limit", "name_additional_context"] },
  "NMINI-C01-T08": { task: "compare", targetIds: ["self_regulation", "attention"], referentTurnId: "NMINI-C01-T01", obligationKinds: ["distinguish_targets", "explain_relation", "use_history_anchor"] },
  "NMINI-C01-T09": { task: "example", targetIds: ["self_regulation", "attention"], referentTurnId: "NMINI-C01-T08", obligationKinds: ["give_concrete_example", "bind_example_to_target"] },
  "NMINI-C01-T10": { task: "case_reasoning", targetIds: ["self_regulation", "attention"], obligationKinds: ["state_single_observation_limit", "name_additional_context", "name_multiple_plausible_explanations"] },
  "NMINI-C01-T11": { task: "case_reasoning", targetIds: ["self_regulation"], obligationKinds: ["state_single_observation_limit", "name_additional_context", "name_multiple_plausible_explanations"] },
  "NMINI-C01-T12": { task: "summarize", targetIds: ["self_regulation"], exactTargets: false, obligationKinds: ["summarize_known", "summarize_unknown", "summarize_observation_focus"] },
  "NMINI-C02-T01": { task: "define", targetIds: ["arousal"], obligationKinds: ["define_target"] },
  "NMINI-C02-T02": { task: "compare", targetIds: ["arousal", "sensory_regulation"], obligationKinds: ["distinguish_targets", "explain_relation"] },
  "NMINI-C02-T03": { task: "compare", targetIds: ["arousal", "sensory_regulation"], obligationKinds: ["state_single_observation_limit", "name_additional_context"] },
  "NMINI-C02-T04": { task: "compare", targetIds: ["arousal", "sensory_regulation"], referentTurnId: "NMINI-C02-T03", obligationKinds: ["state_single_observation_limit", "name_additional_context"] },
  "NMINI-C02-T05": { task: "explain", targetIds: ["arousal"], rejectedTargetIds: ["sensory_regulation"], obligationKinds: ["honor_rejected_target"] },
  "NMINI-C02-T06": { task: "example", targetIds: ["coregulation"], obligationKinds: ["give_concrete_example", "bind_example_to_target"] },
  "NMINI-C02-T07": { task: "case_reasoning", targetIds: ["coregulation"], referentTurnId: "NMINI-C02-T06", obligationKinds: ["avoid_context_free_judgment", "name_additional_context"] },
  "NMINI-C02-T08": { task: "compare", targetIds: ["arousal"], referentTurnId: "NMINI-C02-T01", obligationKinds: ["contrast_target_states", "use_history_anchor"] },
  "NMINI-C02-T09": { task: "compare", targetIds: ["arousal", "emotion_regulation"], obligationKinds: ["state_single_observation_limit", "name_additional_context", "name_multiple_plausible_explanations"] },
  "NMINI-C02-T10": { task: "treatment_boundary", targetIds: ["arousal", "emotion_regulation"], obligationKinds: ["refuse_treatment_selection", "offer_safe_assessment_frame"] },
  "NMINI-C02-T11": { task: "case_reasoning", targetIds: ["arousal", "sensory_regulation", "coregulation"], obligationKinds: ["state_single_observation_limit", "name_additional_context", "name_multiple_plausible_explanations"] },
  "NMINI-C02-T12": { task: "summarize", targetIds: ["arousal", "sensory_regulation", "coregulation"], obligationKinds: ["summarize_known"] },
})

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
}

function sameSet(left: readonly string[], right: readonly string[]) {
  const a = [...new Set(left)].sort()
  const b = [...new Set(right)].sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function main() {
  const root = ROOT_CANDIDATES.find((candidate) =>
    existsSync(`${candidate}/NATURAL_MINI24_FIXTURE.json`)
    && existsSync(`${candidate}/NATURAL_MINI24_GOLD.json`))
  assert.ok(root, "exact Natural Mini24 recovery source is required")
  const fixtureBytes = readFileSync(`${root}/NATURAL_MINI24_FIXTURE.json`)
  const goldBytes = readFileSync(`${root}/NATURAL_MINI24_GOLD.json`)
  assert.equal(sha256(fixtureBytes), FIXTURE_SHA256)
  assert.equal(sha256(goldBytes), GOLD_SHA256)
  const fixture = JSON.parse(fixtureBytes.toString("utf8")) as Fixture
  const gold = JSON.parse(goldBytes.toString("utf8")) as Gold
  assert.equal(fixture.fixtureId, gold.fixtureId)
  const goldByTurn = new Map(gold.rows.map((row) => [row.turnId, row]))
  const rows: Array<Record<string, unknown>> = []
  const failures: Array<Record<string, unknown>> = []
  let resolvedTurns = 0

  for (const conversation of fixture.conversations) {
    let state = createEmptyStudentConversationState()
    for (const turn of conversation.turns) {
      const expected = goldByTurn.get(turn.turnId)
      assert.ok(expected)
      const resolved = resolveStudentEvidenceFirstRequest({
        turnId: turn.turnId,
        message: turn.rawUserMessage,
        state,
      })
      if (!resolved.ok) {
        rows.push({
          turnId: turn.turnId,
          status: "UNRESOLVED",
          reason: resolved.reason,
          expectedPrimaryTarget: expected.primaryTarget,
          evidenceMode: expected.evidenceMode,
        })
        continue
      }
      resolvedTurns += 1
      const contractExpectation = EXPECTED_CONTRACTS[turn.turnId]
      assert.ok(contractExpectation, `${turn.turnId}: contract expectation missing`)
      const obligationKinds = resolved.contract.obligations.map((row) => row.kind)
      const issues: string[] = []
      if (resolved.contract.semanticTask !== contractExpectation.task) issues.push("wrong_task")
      const targetsMatch = contractExpectation.exactTargets === false
        ? contractExpectation.targetIds.every((targetId) => resolved.contract.targetIds.includes(targetId))
        : sameSet(resolved.contract.targetIds, contractExpectation.targetIds)
      if (!targetsMatch) issues.push("wrong_targets")
      if (!sameSet(resolved.contract.rejectedTargetIds, contractExpectation.rejectedTargetIds ?? [])) issues.push("wrong_rejected_targets")
      if (contractExpectation.referentTurnId && resolved.contract.referent.turnId !== contractExpectation.referentTurnId) issues.push("wrong_referent")
      if (contractExpectation.obligationKinds?.some((kind) => !obligationKinds.includes(kind as never))) issues.push("missing_obligation")
      if (resolved.contract.ambiguity !== "none") issues.push(`unresolved_ambiguity:${resolved.contract.ambiguity}`)
      if (issues.length) failures.push({
        turnId: turn.turnId,
        issues,
        expected: contractExpectation,
        actual: {
          task: resolved.contract.semanticTask,
          targetIds: resolved.contract.targetIds,
          rejectedTargetIds: resolved.contract.rejectedTargetIds,
          referentTurnId: resolved.contract.referent.turnId,
          obligationKinds,
          ambiguity: resolved.contract.ambiguity,
        },
      })
      rows.push({
        turnId: turn.turnId,
        status: "RESOLVED",
        expectedPrimaryTarget: expected.primaryTarget,
        expectedComparisonSides: expected.comparisonSides,
        expectedComponents: expected.multipartComponents,
        expectedRejectedTargets: expected.rejectedTargets,
        expectedReferent: expected.requiredReferent,
        expectedHistoryAnchor: expected.requiredHistoryAnchor,
        evidenceMode: expected.evidenceMode,
        actual: {
          taskCandidates: resolved.facts.semanticTaskCandidates,
          referenceCues: resolved.facts.referenceCues,
          observationExtras: resolved.facts.observationExtras,
          task: resolved.contract.semanticTask,
          action: resolved.contract.conversationAction,
          targetIds: resolved.contract.targetIds,
          rejectedTargetIds: resolved.contract.rejectedTargetIds,
          referentTurnId: resolved.contract.referent.turnId,
          obligationKinds,
        },
      })
      state = applyStudentRequestContract(state, resolved.contract)
    }
  }

  console.log(JSON.stringify({
    ok: failures.length === 0 && resolvedTurns === gold.rows.length,
    gate: "STUDENT_FROZEN_NATURAL_MINI24_CONTRACT_LOCAL",
    fixtureSha256: FIXTURE_SHA256,
    goldSha256: GOLD_SHA256,
    mutated: false,
    turns: gold.rows.length,
    resolvedTurns,
    unresolvedTurns: gold.rows.length - resolvedTurns,
    providerCalls: 0,
    failures,
    rows,
  }, null, 2))
  if (failures.length || resolvedTurns !== gold.rows.length) process.exitCode = 1
}

main()
