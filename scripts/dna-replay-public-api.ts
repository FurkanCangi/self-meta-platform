import assert from "node:assert/strict"
import { createDnaChatSafeCaseContext, resolveDnaChatApiRequest } from "../src/lib/dna/chat"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"
import type { DnaChatRuntimeAnswer } from "../src/lib/dna/chat/runtimeAnswer"
import { normalizeDnaChatPublicResponse, type DnaChatPublicAnswer } from "../src/lib/dna/chat/publicResponseNormalizer"
import type { DnaChatCaseContextInput, DnaChatConversationContext, DnaChatResponse } from "../src/lib/dna/chat/types"

// Mirrors only the client's answer-body branches, not rendered DOM or source
// cards. No internal answerTr fallback is allowed after public rejection.
export function replayPublicAnswerBody(answer: DnaChatPublicAnswer): string {
  if (answer.runtimeGeneration === "student_first_candidate") return answer.studentVisibleAnswer ?? ""
  if (answer.topic?.startsWith("conversation.")) return answer.summary
  if (answer.classification === "not_available") return [answer.summary, answer.details[0]].filter(Boolean).join("\n\n")
  const units = answer.answerUnits.filter((unit) => unit.kind !== "safety_boundary" || unit.section === "case_non_inference")
  return units.length ? units.map((unit) => unit.text).join("\n\n")
    : [answer.summary, ...answer.details, ...answer.caseEvidence].filter(Boolean).join("\n\n")
}

export async function replayCurrentPublicApi(input: Readonly<{
  question: string
  previousTopic: string | null
  conversationContext?: DnaChatConversationContext | null
  reportContext: DnaChatCaseContextInput | null
  responseDepth?: "short" | "standard" | "deep"
}>) {
  let response: DnaChatResponse | null = null
  let reportLoads = 0
  let auditWrites = 0
  const capture = (runtime: DnaChatRuntimeAnswer) => {
    // This replay's downstream adapters require V2 shape. Do not silently
    // bypass the selector or treat a V3 answer as a legacy engine response.
    assert.equal(runtime.generation, "v2_legacy", "local_legacy_replay_runtime_generation_mismatch")
    if (runtime.generation !== "v2_legacy") throw new Error("local_legacy_replay_runtime_generation_mismatch")
    response = runtime.answer
    return runtime
  }
  const result = await resolveDnaChatApiRequest({
    question: input.question,
    responseDepth: input.responseDepth ?? "standard",
    ...(input.reportContext ? { reportId: "11111111-1111-4111-8111-111111111111" } : {}),
    ...(input.previousTopic || input.conversationContext ? { context: {
      ...(input.previousTopic ? { previousTopic: input.previousTopic } : {}),
      ...(input.conversationContext ? {
        topicIds: [...input.conversationContext.topicIds], lastQueryKind: input.conversationContext.lastQueryKind,
      } : {}),
    } } : {}),
  }, {
    createRequestId: () => "local-public-replay",
    // Use the same committed selector as the real normal API branch. This
    // still does not execute authentication, S13 selection or real storage.
    resolveRuntimeAnswer: (request) => capture(resolveCommittedDnaChatRuntime(request)),
    loadCaseAnswer: async (request) => {
      assert.equal(input.reportContext?.dataStatus, "synthetic", "replay_requires_synthetic_case")
      reportLoads += 1
      const answer = capture(resolveCommittedDnaChatRuntime({ ...request,
        caseContext: createDnaChatSafeCaseContext(input.reportContext!),
      }))
      return { ok: true, answer }
    },
    writeAudit: async () => { auditWrites += 1; return { ok: true } },
  })
  const publicAnswer = result.status === 200 && result.body.ok ? normalizeDnaChatPublicResponse(result.body) : null
  assert.ok(response, "replay_runtime_response_missing")
  return {
    status: result.status, response: response as DnaChatResponse, publicAnswer,
    answer: publicAnswer ? replayPublicAnswerBody(publicAnswer) : null,
    reportLoads, auditWrites,
    authority: "LOCAL_NORMAL_API_SYNTHETIC_STUBS_NOT_AUTHENTICATED_E2E" as const,
  }
}

export function isPreservedProductResponse(response: DnaChatResponse): boolean {
  return response.route !== "theory" || response.outcome === "refused"
    || Boolean(response.contextRequest)
    || response.topic?.startsWith("conversation.") === true
    || response.intentId?.startsWith("conversation_") === true
}
