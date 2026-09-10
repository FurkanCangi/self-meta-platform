import "server-only"

import { resolveDnaChatApiRequest, responseDepthForConversation, type DnaChatApiAuditInput, type DnaChatApiPayload,
  type DnaChatApiResolution, type DnaChatApiResolverDependencies } from "../apiResolver"
import { normalizeDnaChatPublicResponse } from "../publicResponseNormalizer"
import { detectDnaConversationFollowUpKind } from "../engine"
import { inspectDnaChatSafety } from "../safety"
import { normalizeDnaChatText } from "../text"
import { isDnaChatRuntimeAnswerAuthentic } from "../runtimeAnswer"
import { DNA_INTELLIGENCE_INTENDED_USE_VERSION } from "../intendedUse"
import { inspectDnaS13LimitedRolloutPrivacy } from "../s13/limitedRollout/privacy"
import { applyStudentRequestContract, resolveStudentObligations } from "./conversationState"
import { resolveStudentEvidenceFirstRequest } from "./evidenceFirstRequest"
import { interpretStudentContextScope, type StudentContextScopeResult } from "./evidenceFirstInterpreter.server"
import { buildStudentAnswerExecutionPlan } from "./answerExecution"
import { executeStudentAnswer } from "./answerExecutor.server"
import { studentApplicationAnswer, studentApplicationTreatmentRefusal } from "./applicationAnswer.server"
import { emptyStudentApplicationState, openStudentApplicationContext, sealStudentApplicationContext,
  type StudentApplicationState, type StudentContextBinding } from "./applicationContext.server"
import { STUDENT_APPLICATION_RUNTIME } from "./applicationPublicContract"
import { rememberStudentConversationEvidence } from "./conversationEvidence"

export function studentLocalCandidateEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return studentReleaseIdentity(env) !== null || (env.NODE_ENV === "development" || env.NODE_ENV === "test")
    && !env.VERCEL_ENV && env.DNA_CHAT_STUDENT_LOCAL_CANDIDATE === "1"
}

// Promotion is a separate operator decision after acceptance. Never enable
// through a client header/token or infer release from NODE_ENV alone. The
// deployment manifest must attest this configured source hash against its SHA.
export function studentReleaseIdentity(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const identity = env.DNA_CHAT_STUDENT_RELEASE_SOURCE_SHA256?.trim() ?? ""
  return env.DNA_CHAT_STUDENT_RELEASE_ENABLED === "1" && /^[a-f0-9]{64}$/.test(identity)
    ? identity : null
}

/** Shared by the real authenticated POST and candidate replay. The normal
 * product/report boundary retains its own runtime identity and authorization.
 * Student results never borrow V2/V3/S13 release approval. */
export async function resolveStudentApplicationTurn(input: {
  payload: DnaChatApiPayload
  contextToken?: string
  binding: StudentContextBinding
  normal: DnaChatApiResolverDependencies
  execute?: typeof executeStudentAnswer
  interpretScope?: typeof interpretStudentContextScope
  safetyIdentifier?: string | null
}): Promise<DnaChatApiResolution & { requestInterpretation?: StudentContextScopeResult }> {
  let requestInterpretation: StudentContextScopeResult | undefined
  const interpretationTrace = () => requestInterpretation ? { requestInterpretation } : {}
  const fail = (error = "dna_chat_failed") => ({
    status: 503, body: { ok: false, error }, accessedCaseReport: false,
    ...interpretationTrace(),
  } as DnaChatApiResolution & { requestInterpretation?: StudentContextScopeResult })
  try {
    if (!studentLocalCandidateEnabled() || input.binding.secret.length < 32
      || !input.binding.actorId || !input.binding.conversationId
      || !/^[a-f0-9]{64}$/.test(input.binding.candidateSha256)) return fail("dna_chat_unavailable")
    const reportId = input.payload.reportId ?? null
    let state = input.contextToken ? openStudentApplicationContext(input.contextToken, input.binding)
      : emptyStudentApplicationState(reportId)
    if (!state) return fail("student_context_invalid")
    // Changing the selected case invalidates every old referent, including
    // student case-event summaries. This is not an ownership check.
    if (state.reportId !== reportId) state = state.reportId
      ? emptyStudentApplicationState(reportId) : { ...state, reportId }
    let capturedAudit: DnaChatApiAuditInput | null = null
    if (!input.normal.resolveRuntimeAnswer) return fail()
    const normalPayload: DnaChatApiPayload = { ...input.payload,
      // Client-supplied topic IDs are never authoritative once this path owns
      // the context. The authenticated token carries both state representations.
      context: { ...(state.previousTopic ? { previousTopic: state.previousTopic } : {}),
        ...(state.normalContext ? { topicIds: [...state.normalContext.topicIds], lastQueryKind: state.normalContext.lastQueryKind } : {}) } }
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `turn-${state.sequence + 1}`,
      message: input.payload.question, state: state.student })
    // An observed and resolved student referent establishes ownership even when
    // the older follow-up vocabulary misses it. A default active target alone
    // is not a reference (for example, "thanks"). Keep existing presentation
    // follow-ups; report, refusal and normal-reply ownership remain protected.
    // A resolved observation-method request also has explicit task evidence:
    // its uncertainty/context obligations do not require an owned case report.
    const educationalObservation = resolved.ok && resolved.contract.semanticTask === "observe"
      && (resolved.facts.observationExtras.singleObservationLimit || resolved.facts.observationExtras.additionalContext)
    // A safe summary with explicitly named scientific targets establishes its
    // own ownership after a normal reply (including a treatment refusal).
    // Keep the refusal's state honest; do not infer this from a stale active
    // target or silently redirect an ambiguous normal/report conversation.
    const explicitScientificSummary = resolved.ok && resolved.contract.semanticTask === "summarize"
      && resolved.contract.conversationAction === "summarize_session"
      && resolved.contract.safetyIntent === "general_education"
      && resolved.facts.explicitTargetIds.length > 0
      && resolved.contract.targetIds.every((targetId) => resolved.facts.explicitTargetIds.includes(targetId))
    const studentOwnsScientificRequest = explicitScientificSummary || (state.student.semanticLedger.length > 0 && resolved.ok
      && (resolved.contract.referent.kind === "history" || (state.lastRoute === "student"
        && (((resolved.facts.referenceCues.active || educationalObservation) && resolved.contract.referent.kind === "active")
          || Boolean(detectDnaConversationFollowUpKind(input.payload.question))
          || resolved.contract.conversationAction === "summarize_session"))))
    const normalizedQuestion = normalizeDnaChatText(input.payload.question)
    // Explicit report references keep the existing report authorization path;
    // a scientific summary's generic "observation" wording is not report authority.
    const explicitReport = input.payload.mode === "case" || /\brapor\w*\b/u.test(normalizedQuestion)
      || Boolean(reportId && /\bvaka\w*\b/u.test(normalizedQuestion))
    const safety = inspectDnaChatSafety(input.payload.question)
    const responseDepth = responseDepthForConversation(input.payload)
    const requestId = input.normal.createRequestId()
    const runtime = await input.normal.resolveRuntimeAnswer({ question: input.payload.question, mode: input.payload.mode,
      previousTopic: state.previousTopic, conversationContext: state.normalContext, responseDepth })
    if (!isDnaChatRuntimeAnswerAuthentic(runtime)) return fail()
    const protectedNormalRequest = safety.blocked || runtime.answer.classification === "refusal" || explicitReport
    // Local policy ownership comes from this request's bound targets/events and
    // its existing execution plan, not from a primary-task whitelist or merely
    // having an old active topic. A case question can contain an observation
    // task without having `observe` as its primary task. Report/safety authority
    // is settled first, and this rule never grants a provider-grounded route.
    const localPolicyOwnsRequest = !protectedNormalRequest && resolved.ok
      && resolved.contract.safetyIntent === "case_interpretation"
      && resolved.contract.targetIds.length > 0
      && (resolved.facts.caseContext.eventIds.length > 0
        || resolved.facts.observationExtras.singleObservationLimit
        || resolved.facts.observationExtras.additionalContext)
      && (resolved.contract.targetIds.every((targetId) => resolved.facts.explicitTargetIds.includes(targetId))
        || (state.lastRoute === "student" && state.student.semanticLedger.length > 0
          && (resolved.contract.referent.kind === "active" || resolved.contract.referent.kind === "history")))
      && buildStudentAnswerExecutionPlan({ question: input.payload.question,
        contract: resolved.contract }).executionRoute === "local_safety_boundary"
    // A single explicitly resolved educational topic with real source evidence
    // belongs to the student route even when the legacy vocabulary says unknown
    // or mistakes several requested facets for unrelated questions. This is not
    // authority for reports, cases, ambiguous references or unsupported targets.
    const explicitSupportedEducation = !protectedNormalRequest && !reportId && resolved.ok
      && resolved.facts.taskEvidence === "observed_request"
      && resolved.contract.safetyIntent === "general_education" && resolved.contract.ambiguity === "none"
      && resolved.contract.targetIds.length === 1 && resolved.facts.explicitTargetIds.length === 1
      && resolved.contract.targetIds[0] === resolved.facts.explicitTargetIds[0]
      && ["not_available", "clarification"].includes(runtime.answer.classification)
      && (() => {
        const plan = buildStudentAnswerExecutionPlan({ question: input.payload.question, contract: resolved.contract })
        return plan.executionRoute === "provider_grounded" && plan.targetEvidence.length === 1
          && plan.targetEvidence[0]!.claims.some((claim) => claim.role !== "contrast")
      })()
    let normalOwnsRequest = protectedNormalRequest || (!(studentOwnsScientificRequest || localPolicyOwnsRequest || explicitSupportedEducation)
      && (runtime.generation === "v2_legacy"
        ? runtime.answer.route !== "theory" || Boolean(runtime.answer.contextRequest) || runtime.answer.topic?.startsWith("conversation.")
        : runtime.answer.intent !== "theory" || Boolean(runtime.answer.contextRequest)))
    // Resolve the ownership conflict semantically, before any answer is made.
    // An observed task is required but is not itself proof of topic continuity.
    // The provider can only accept/reject this bound context, never invent targets.
    if (normalOwnsRequest && !protectedNormalRequest && state.lastRoute === "student" && resolved.ok
      && resolved.facts.taskEvidence === "observed_request" && !resolved.facts.explicitTargetIds.length
      && resolved.contract.safetyIntent === "general_education" && resolved.contract.ambiguity === "none"
      && resolved.contract.referent.kind === "active" && resolved.contract.targetIds.length > 0
      && resolved.contract.targetIds.every((id) => resolved.contract.referent.targetIds.includes(id))
      && inspectDnaS13LimitedRolloutPrivacy({ question: input.payload.question }).allowed) {
      const prior = state.student.semanticLedger.find((turn) => turn.turnId === resolved.contract.referent.turnId)
      if (prior) {
        const plan = buildStudentAnswerExecutionPlan({ question: input.payload.question, contract: resolved.contract })
        try {
          requestInterpretation = await (input.interpretScope ?? interpretStudentContextScope)({
            message: input.payload.question, proposedTargetIds: resolved.contract.targetIds,
            proposedTargetLabels: plan.targetEvidence.map((target) => target.visibleAliases[0] ?? target.ownerBookTopicTitle),
            requestedTask: resolved.contract.semanticTask, priorTargetIds: prior.targetIds, priorTask: prior.semanticTask,
          })
        } catch {
          requestInterpretation = { version: "dna-student-context-scope@1", ok: false, scope: null,
            reason: "scope_unexpected_failure", provider: { attempts: 1, transportRetries: 0, usageComplete: false,
              responseId: null, usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }, latencyMs: 0 } }
        }
        if (!requestInterpretation.ok) return fail("student_scope_resolution_failed")
        if (requestInterpretation.scope === "unresolved") return fail("student_scope_unresolved")
        normalOwnsRequest = requestInterpretation.scope !== "continue_context"
      }
    }
    let normal: DnaChatApiResolution = { status: 200, body: {}, accessedCaseReport: false }
    let body: Record<string, unknown>
    let nextState: StudentApplicationState
    let finalAudit: DnaChatApiAuditInput
    if (normalOwnsRequest) {
      normal = await resolveDnaChatApiRequest(normalPayload, { ...input.normal,
        resolveRuntimeAnswer: () => runtime,
        // Commit exactly one final audit after public projection succeeds.
        writeAudit: async (audit) => { capturedAudit = audit; return { ok: true } },
      })
      if (normal.status !== 200 || !capturedAudit) return { ...normal, ...interpretationTrace() }
      const publicNormal = normalizeDnaChatPublicResponse(normal.body)
      if (!publicNormal) return fail()
      body = normal.body
      nextState = { ...state, sequence: state.sequence + 1, previousTopic: publicNormal.topic,
        normalContext: publicNormal.conversationContext ?? null, lastRoute: "normal" }
      finalAudit = capturedAudit
      // Preserve the authenticated safety decision and normal state ownership.
      // Only the local assessment prerequisite and generic frame may be added;
      // no report, private content, student composer, or scientific claim enters.
      if (safety.blocked && safety.category === "treatment" && publicNormal.classification === "refusal"
        && !explicitReport && !reportId && !normal.accessedCaseReport
        // Provider permission stays false for clinical questions. This is a
        // fixed, local policy completion, not permission to transmit the case.
        && safety.redactedQuestion === input.payload.question.trim().slice(0, 600)
        && inspectDnaS13LimitedRolloutPrivacy({ question: input.payload.question }).category !== "personal_data") {
        body = studentApplicationTreatmentRefusal({ normal: publicNormal, candidateSha256: input.binding.candidateSha256 })
        finalAudit = { ...finalAudit, runtimeGeneration: STUDENT_APPLICATION_RUNTIME,
          engineVersion: String(body.engineVersion), packageVersion: String(body.packageVersion),
          packageSha256: input.binding.candidateSha256, classification: "refusal", outcome: "refused",
          intentId: null, sourceIds: [], authoritySet: ["safety_and_product_boundaries"], citationCount: 0,
          routedTopicIds: [], subquestionCount: 0, resolutionMode: "refusal",
          assuranceStatus: "not_recorded", assuranceVersion: "not_recorded", sourceBindingCoveragePercent: 0 }
      }
    } else {
      // No success-shaped fallback after interpreter/provider failure. Preserve
      // normal product responses only by the explicit routing decision above.
      if (!resolved.ok || !resolved.contract.targetIds.length) return fail("student_interpretation_unresolved")
      const contract = { ...resolved.contract, presentation: { ...resolved.contract.presentation,
        depth: responseDepth === "short" ? "brief" as const : responseDepth } }
      const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: input.payload.question })
      if (!privacy.allowed) {
        // Transmission permission and local response authority are independent.
        // Reuse the request-bound local policy authority established above:
        // actual observation duties/events plus explicit or authenticated targets,
        // never just a privacy label or the existence of a local plan. Personal
        // data, redacted/blocked requests and protected report routes stay out.
        const localResponseAuthorized = localPolicyOwnsRequest
          && privacy.category !== "personal_data" && safety.category === "none"
          && safety.redactedQuestion === input.payload.question.trim().slice(0, 600)
        if (!localResponseAuthorized) return fail("student_provider_privacy_boundary")
      }
      const result = await (input.execute ?? executeStudentAnswer)({ question: input.payload.question,
        contract, historyEvidence: state.scientificEvidence ?? [],
        safetyIdentifier: input.safetyIdentifier, externalProviderAllowed: privacy.allowed })
      if (!result.ok) return fail(result.reason === "candidate_invalid" ? "student_answer_contract_rejected"
        : result.reason === "provider_permission_denied" ? "student_provider_privacy_boundary" : "dna_chat_failed")
      body = studentApplicationAnswer({ result, candidateSha256: input.binding.candidateSha256,
        requestId, responseDepth })
      nextState = { ...state, sequence: state.sequence + 1, lastRoute: "student",
        previousTopic: null, normalContext: null,
        scientificEvidence: rememberStudentConversationEvidence(state.scientificEvidence ?? [], result.plan, result.candidate.usedClaimIds),
        student: resolveStudentObligations(applyStudentRequestContract(state.student, contract), result.candidate.addressedObligationIds) }
      const sourceIds = [...new Set(result.plan.targetEvidence.flatMap((target) => target.claims
        .filter((claim) => result.candidate.usedClaimIds.includes(claim.claimId)).map((claim) => claim.sourceId)))]
      finalAudit = { requestId, mode: "theory", responseDepth,
        intendedUseVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION, authorityContractVersion: "dna-knowledge-authority@1",
        policyVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION, latencyCategory: result.provider.latencyMs < 100 ? "lt_100ms"
          : result.provider.latencyMs < 1_000 ? "100_to_999ms" : "gte_1000ms", errorCode: null,
        engineVersion: String(body.engineVersion), runtimeGeneration: STUDENT_APPLICATION_RUNTIME,
        packageVersion: String(body.packageVersion), packageSha256: input.binding.candidateSha256,
        catalogVersion: String(body.catalogVersion), classification: result.route === "local_safety_boundary" ? "refusal" : "literature",
        outcome: result.route === "local_safety_boundary" ? "refused" : "answered", intentId: null,
        sourceIds,
        authoritySet: [...new Set((body.authoritySummary as Array<{ layer: string }>).map((authority) => authority.layer))],
        // Existing audit semantics count distinct sources, not passage cards.
        citationCount: sourceIds.length, routedTopicIds: [], subquestionCount: 0,
        resolutionMode: result.route === "local_safety_boundary" ? "refusal" : "direct",
        // The new candidate has not passed the old runtime's assurance system.
        assuranceStatus: "not_recorded", assuranceVersion: "not_recorded", sourceBindingCoveragePercent: 0 }
    }
    const token = sealStudentApplicationContext(nextState, input.binding)
    body = { ...body, studentContextToken: token }
    if (!normalizeDnaChatPublicResponse(body)) return fail()
    if (!(await input.normal.writeAudit(finalAudit)).ok) return fail("audit_unavailable")
    return { ...normal, body, ...interpretationTrace() }
  } catch { return fail() }
}
