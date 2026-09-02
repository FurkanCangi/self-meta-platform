import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"

import {
  applyStudentRequestContract,
  buildStudentS13ResolvedRequestHandoff,
  createEmptyStudentConversationState,
  resolveStudentEvidenceFirstRequest,
  type StudentConversationState,
  type StudentRequestContract,
} from "../src/lib/dna/chat/studentFirst"
import {
  getDnaOwnerBookTopicTitle,
} from "../src/lib/dna/chat/ownerBookRuntime"
import {
  hashDnaS13LimitedIdentifier,
} from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import {
  runDnaS13LimitedRolloutMessage,
  type DnaS13LimitedTechnicalEvidence,
} from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import type { DnaS13PragmaticAction } from "../src/lib/dna/chat/s13/pragmaticTask"
import { DeterministicRealizer } from "../src/lib/dna/chat/s13/strictRealizer"

type Fixture = Readonly<{
  conversations: readonly Readonly<{
    conversationId: string
    turns: readonly Readonly<{ turnId: string; user: string }>[]
  }>[]
}>

const FIXTURE_PATH = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const CONTEXT_SECRET = createHash("sha256").update("dna-student-b1-visible-handoff-context").digest("hex")
const TELEMETRY_SECRET = createHash("sha256").update("dna-student-b1-visible-handoff-telemetry").digest("hex")

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

function sameSet(left: readonly string[], right: readonly string[]) {
  const a = unique(left).sort()
  const b = unique(right).sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function topicEvidence(topicIds: readonly string[]) {
  return topicIds.map((topicId) => Object.freeze({
    topicId,
    title: getDnaOwnerBookTopicTitle(topicId),
  }))
}

function expectedAction(contract: StudentRequestContract): DnaS13PragmaticAction {
  if (contract.conversationAction === "repair") return "CORRECT_TARGET"
  if (contract.semanticTask === "define") return "DEFINE"
  if (contract.semanticTask === "compare") return "COMPARE"
  if (contract.semanticTask === "example") return "EXAMPLE"
  if (contract.semanticTask === "summarize") return "SUMMARIZE"
  return "EXPLAIN"
}

function visibleAnswerText(body: Record<string, unknown> | undefined) {
  if (!body) return ""
  const summary = typeof body.summary === "string" ? body.summary.trim() : ""
  const units = Array.isArray(body.answerUnits) ? body.answerUnits.flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const text = (value as Record<string, unknown>).text
    return typeof text === "string" && text.trim() ? [text.trim()] : []
  }) : []
  return (units.length ? units : [summary]).filter(Boolean).join("\n\n")
}

function limitedContextToken(body: Record<string, unknown> | undefined) {
  if (!body) return null
  const context = body.conversationContext
  if (!context || typeof context !== "object") return null
  const token = (context as Record<string, unknown>).limitedRolloutContextToken
  return typeof token === "string" && token.trim() ? token : null
}

async function main() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Fixture
  let evaluatedTurns = 0
  let fullPassTurns = 0
  let stoppedTurnId: string | null = null
  let stopReason: string | null = null
  let firstFailure: Record<string, unknown> | null = null

  outer: for (const conversation of fixture.conversations) {
    let studentState: StudentConversationState = createEmptyStudentConversationState()
    let contextToken: string | null = null
    const subjectId = `student-b1-visible-${conversation.conversationId}`
    const sessionId = `student-b1-visible-session-${conversation.conversationId}`
    const subjectIdHash = hashDnaS13LimitedIdentifier({
      secret: TELEMETRY_SECRET,
      kind: "subject",
      value: subjectId,
    })!
    const conversationIdHash = hashDnaS13LimitedIdentifier({
      secret: TELEMETRY_SECRET,
      kind: "conversation",
      value: sessionId,
    })!

    for (const turn of conversation.turns) {
      const interpreted = resolveStudentEvidenceFirstRequest({
        turnId: turn.turnId,
        message: turn.user,
        state: studentState,
      })
      if (!interpreted.ok) throw new Error(`${turn.turnId}: B1 contract must resolve locally`)
      const contract = interpreted.contract
      studentState = applyStudentRequestContract(studentState, contract)
      const handoff = buildStudentS13ResolvedRequestHandoff({ question: turn.user, contract })

      const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: turn.user, mode: "theory" })
      let technical: DnaS13LimitedTechnicalEvidence | null = null
      let runtimeError: string | null = null
      let result: Awaited<ReturnType<typeof runDnaS13LimitedRolloutMessage>> | null = null
      try {
        result = await runDnaS13LimitedRolloutMessage({
          requestId: randomUUID(),
          subjectId,
          subjectIdHash,
          conversationIdHash,
          sessionId,
          question: turn.user,
          responseDepth: contract.presentation.depth === "brief" ? "short"
            : contract.presentation.depth === "deep" ? "deep" : "standard",
          contextToken,
          contextSecret: CONTEXT_SECRET,
          privacy,
          rolloutPhase: "L0",
          realizer: new DeterministicRealizer(),
          resolvedRequestHandoff: handoff,
          technicalObserver: (value) => { technical = value },
        })
      } catch (error) {
        runtimeError = error instanceof Error ? error.message : String(error)
      }

      const evidence = technical as DnaS13LimitedTechnicalEvidence | null
      const actualTask = evidence?.pragmaticTaskFrame
        ?? (result?.kind === "clarification" ? result.routing.pragmaticTaskFrame : null)
      const actualActiveTopics = actualTask?.targets
        .filter((target) => target.polarity === "ACTIVE_TARGET")
        .map((target) => target.topicId) ?? []
      const actualRejectedTopics = actualTask?.targets
        .filter((target) => target.polarity === "REJECTED_TARGET")
        .map((target) => target.topicId) ?? []
      const expectedTopics = handoff.crosswalk
        .filter((target) => target.polarity === "ACTIVE_TARGET")
        .map((target) => target.ownerBookTopicId)
      const expectedRejectedTopics = handoff.crosswalk
        .filter((target) => target.polarity === "REJECTED_TARGET")
        .map((target) => target.ownerBookTopicId)
      const targetParity = sameSet(actualActiveTopics, expectedTopics)
      const rejectedParity = expectedRejectedTopics.every((topicId) => actualRejectedTopics.includes(topicId))
        && actualActiveTopics.every((topicId) => !expectedRejectedTopics.includes(topicId))
      const expectedPragmaticAction = expectedAction(contract)
      const actionParity = actualTask?.pragmaticAction === expectedPragmaticAction
        || (contract.presentation.preserveMeaning
          && actualTask?.presentationModifiers?.includes("SIMPLIFY") === true)
      const validatorPass = evidence?.runtime.finalValidation.pass === true
      const outputAnswered = result?.kind === "answered"
      const answer = result && (result.kind === "answered" || result.kind === "clarification")
        ? visibleAnswerText(result.body) : ""
      const visibleNonEmpty = answer.length > 0
      const criticalViolationCount = result ? result.telemetry.validation.unsupportedFactCount
        + result.telemetry.validation.unsupportedRelationCount
        + result.telemetry.validation.sourceViolationCount
        + result.telemetry.validation.safetyViolationCount
        + result.telemetry.crossAccountViolationCount : 0
      const fullPass = !runtimeError && privacy.allowed && outputAnswered && visibleNonEmpty
        && targetParity && rejectedParity && actionParity && validatorPass && criticalViolationCount === 0

      evaluatedTurns += 1
      if (fullPass) fullPassTurns += 1
      contextToken = result?.kind === "answered" ? limitedContextToken(result.body) : contextToken

      const criticalFailure = Boolean(runtimeError)
        || !privacy.allowed
        || !targetParity
        || !rejectedParity
        || criticalViolationCount > 0
      if (criticalFailure) {
        stoppedTurnId = turn.turnId
        stopReason = runtimeError ? "runtime_error"
          : !privacy.allowed ? "privacy_rejected"
            : !targetParity ? "request_to_runtime_target_drift"
              : !rejectedParity ? "rejected_target_handoff_drift"
                : "critical_validation_violation"
        firstFailure = Object.freeze({
          turnId: turn.turnId,
          stopReason,
          contractTargetIds: contract.targetIds,
          expectedRuntimeTopics: topicEvidence(expectedTopics),
          actualActiveTopics,
          actualActiveTopicEvidence: topicEvidence(actualActiveTopics),
          contractRejectedTargetIds: contract.rejectedTargetIds,
          expectedRejectedTopicEvidence: topicEvidence(expectedRejectedTopics),
          actualRejectedTopics,
          expectedAction: expectedPragmaticAction,
          actualAction: actualTask?.pragmaticAction ?? null,
          outputKind: result?.kind ?? "runtime_error",
          runtimeReason: result?.kind === "fallback" || result?.kind === "clarification" ? result.reason : null,
          runtimeError,
          validatorPass,
          criticalViolationCount,
          rawMessagePersisted: false,
          visibleAnswerPersisted: false,
        })
        break outer
      }
    }
  }

  console.log(JSON.stringify({
    ok: stoppedTurnId === null,
    gate: "STUDENT_B1_VISIBLE_HANDOFF_PREFLIGHT",
    stoppedEarly: stoppedTurnId !== null,
    stoppedTurnId,
    stopReason,
    evaluatedTurns,
    fullPassTurns,
    firstFailure,
    providerCalls: 0,
    rawMessagesPersisted: 0,
    visibleAnswersPersisted: 0,
  }, null, 2))
  if (stoppedTurnId) process.exitCode = 1
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    gate: "STUDENT_B1_VISIBLE_HANDOFF_PREFLIGHT",
    failure: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
