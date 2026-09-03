import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"

import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
} from "../src/lib/dna/chat/studentFirst"

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

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex")
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
          obligationKinds: resolved.contract.obligations.map((row) => row.kind),
        },
      })
      state = applyStudentRequestContract(state, resolved.contract)
    }
  }

  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_FROZEN_NATURAL_MINI24_CONTRACT_DIAGNOSTIC",
    fixtureSha256: FIXTURE_SHA256,
    goldSha256: GOLD_SHA256,
    mutated: false,
    turns: gold.rows.length,
    resolvedTurns,
    unresolvedTurns: gold.rows.length - resolvedTurns,
    providerCalls: 0,
    rows,
  }, null, 2))
}

main()
