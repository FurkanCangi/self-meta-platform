import { responseDepthForConversation } from "../src/lib/dna/chat/apiResolver"
import { buildStudentAnswerExecutionPlan } from "../src/lib/dna/chat/studentFirst/answerExecution"
import { emptyStudentApplicationState, type StudentApplicationState } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import type { StudentReplayInput, StudentReplayTurn } from "./dna-student-application-replay"
import { replayHash } from "./dna-student-application-replay"

/** Supplies the existing development judge with a request/evidence expectation,
 * never a replacement answer. A normal-route expectation is explicitly NOT an
 * executed student plan. It cannot select the runtime, advance conversation
 * state, change gold, or manufacture a successful semantic judgment. */
export function prepareStudentVisibleEvaluation(input: {
  request: StudentReplayInput
  replay: StudentReplayTurn
  stateBefore: StudentApplicationState | null
}) {
  const { request, replay } = input
  const payload = { question: request.question, ...(request.mode ? { mode: request.mode } : {}),
    responseDepth: request.responseDepth ?? "standard", ...(request.reportId ? { reportId: request.reportId } : {}) }
  if (replay.inputSha256 !== replayHash(JSON.stringify({ payload, reportContext: request.reportContext ?? null }))) {
    return { ok: false as const, reason: "evaluation_request_does_not_match_visible_receipt" }
  }
  if (replay.beforeStateSha256 !== replayHash(JSON.stringify(input.stateBefore))) {
    return { ok: false as const, reason: "evaluation_state_does_not_match_visible_receipt" }
  }
  if (replay.status !== 200 || !replay.visibleAnswer) return { ok: false as const, reason: "application_response_not_successful" }
  if (!replay.usageComplete) return { ok: false as const, reason: "provider_usage_incomplete" }
  if (replay.student) {
    if (!replay.student.result.ok) return { ok: false as const, reason: "failed_student_execution_cannot_supply_success_expectation" }
    return { ok: true as const, authority: "OBSERVED_STUDENT_EXECUTION" as const,
      contract: replay.student.contract, plan: replay.student.result.plan }
  }
  // Student40 and OneHour24 contain educational conversation, no selected report.
  // A report expectation must be grounded in the original report fixture; do
  // not substitute this literature expectation for patient/report evidence.
  if (request.mode === "case" || request.reportId || request.reportContext || input.stateBefore?.reportId) {
    return { ok: false as const, reason: "report_expectation_requires_report_bound_evaluation" }
  }
  const state = input.stateBefore ?? emptyStudentApplicationState(null)
  const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${state.sequence + 1}`,
    message: request.question, state: state.student })
  if (!resolved.ok) return { ok: false as const, reason: `request_expectation_unresolved:${resolved.reason}` }
  const depth = responseDepthForConversation(payload)
  const contract = { ...resolved.contract, presentation: { ...resolved.contract.presentation,
    depth: depth === "short" ? "brief" as const : depth } }
  try {
    const plan = buildStudentAnswerExecutionPlan({ question: request.question, contract })
    return { ok: true as const, authority: "REQUEST_EXPECTATION_NOT_EXECUTED_BY_NORMAL_RUNTIME" as const, contract, plan }
  } catch {
    return { ok: false as const, reason: "request_expectation_evidence_unavailable" }
  }
}
