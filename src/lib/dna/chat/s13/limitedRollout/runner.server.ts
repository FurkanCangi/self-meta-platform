import "server-only"

import {
  getDnaOwnerBookClaimMetadata,
  getDnaOwnerBookRuntimeStatus,
  getDnaOwnerBookTopicClaims,
  getDnaOwnerBookTopicTitle,
  resolveDnaOwnerBook,
  resolveDnaOwnerBookTopic,
  type DnaOwnerBookMatch,
} from "../../ownerBookRuntime"
import { resolveDnaChatSocialConversation } from "../../socialConversation"
import { normalizeDnaChatText } from "../../text"
import { classifyDnaV3QueryKind, splitDnaV3Subquestions, type DnaV3QueryKind } from "../../v3RetrievalCore"
import { DNA_INTELLIGENCE_PUBLIC_INTENDED_USE } from "../../intendedUse"
import {
  DNA_S13_QUERY_FRAME_VERSION,
  DNA_S13_REQUESTED_FACETS,
  type DnaS13Claim,
  type DnaS13Depth,
  type DnaS13Focus,
  type DnaS13QueryFrame,
  type DnaS13QuestionType,
  type DnaS13RequestedFacet,
  type DnaS13Subquestion,
} from "../contracts"
import {
  resolveDnaS13ConversationContext,
  resolveDnaS13NamedTopicSurfaces,
  type DnaS13ResolvedUserQuery,
} from "../conversationContext"
import {
  dnaS13HasPresentationModifier,
  resolveDnaS13PragmaticTask,
  type DnaS13PragmaticTaskFrame,
  type DnaS13PragmaticTarget,
} from "../pragmaticTask"
import {
  resolveDnaS13RealizationDecision,
  type DnaS13RealizationDecision,
} from "../adaptiveRealization"
import { LunaRealizer } from "../strictLunaRealizer.server"
import { hashDnaS13Artifact } from "../strictHash"
import { createDnaS13StrictPlan, resolveDnaS13FacetEvidence } from "../strictPlanner"
import { DeterministicRealizer, type Realizer } from "../strictRealizer"
import {
  DNA_S13_SIMPLIFY_QUALITY_LIMITATION,
  runDnaS13SelectiveSimplifyRuntime,
  runDnaS13StrictRuntime,
} from "../strictRuntime"
import type { DnaS13StrictRuntimeResult } from "../strictRuntime"
import { validateDnaS13Routing, type DnaS13RoutingValidation } from "../routingValidator"
import type { DnaS13StrictPlan } from "../strictContracts"
import {
  createDnaS13TopicSemanticFrame,
  ownerTopicClaimToDnaS13Claim,
} from "../topicSemantic"
import { parseDnaS13CanaryComparison } from "../canary/parser"
import { openDnaS13LimitedContext, sealDnaS13LimitedContext } from "./context.server"
import type { DnaS13LimitedPrivacyDecision } from "./privacy"
import { getDnaS13LimitedRolloutReleaseCandidate } from "./release"
import {
  DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY,
  DNA_S13_LIMITED_OWNER_BOOK_SOURCE_ID,
  createDnaS13LimitedResponseContract,
  isDnaS13LimitedResponseDisplayEligible,
  validateDnaS13LimitedPublicResponse,
  type DnaS13LimitedResponseContract,
} from "./responseContract"
import {
  DNA_S13_LIMITED_TELEMETRY_VERSION,
  type DnaS13LimitedTelemetryRecord,
  validateDnaS13LimitedTelemetryRecord,
} from "./telemetry"

export type DnaS13LimitedRunnerResult = Readonly<
  | {
      kind: "answered"
      body: Record<string, unknown>
      telemetry: DnaS13LimitedTelemetryRecord
    }
  | {
      kind: "fallback"
      reason: string
      telemetry: DnaS13LimitedTelemetryRecord
    }
  | {
      kind: "clarification"
      reason: string
      body: Record<string, unknown>
      telemetry: DnaS13LimitedTelemetryRecord
      routing: Readonly<{
        normalizedQuery: string
        contextOperation: string
        contextResolutionMethod: string
        candidateTopicIds: readonly string[]
        selectedTopicIds: readonly string[]
        confidence: "HIGH" | "MEDIUM" | "LOW"
        pragmaticTaskFrame: DnaS13PragmaticTaskFrame
      }>
    }
>

/**
 * Evaluation-only observation surface. Production callers do not provide this
 * callback and the observed values are never added to the public response.
 */
export type DnaS13LimitedTechnicalEvidence = Readonly<{
  normalizedQuery: string
  contextOperation: string
  contextResolutionMethod: string
  topicCandidateIds: readonly string[]
  topicResolutionConfidence: "HIGH" | "MEDIUM" | "LOW"
  pragmaticTaskFrame: DnaS13PragmaticTaskFrame
  queryFrame: DnaS13QueryFrame
  matches: readonly DnaOwnerBookMatch[]
  plan: DnaS13StrictPlan
  routingValidation: DnaS13RoutingValidation
  realizationDecision: DnaS13RealizationDecision
  runtime: DnaS13StrictRuntimeResult
}>

function focusFor(kind: DnaV3QueryKind): DnaS13Focus {
  if (kind === "definition") return "definition"
  if (kind === "comparison") return "comparison"
  if (["relation", "dna_relation"].includes(kind)) return "relation"
  if (kind === "measurement") return "measurement"
  if (kind === "development") return "development"
  if (kind === "evidence") return "evidence"
  if (kind === "misconception") return "interpretation_boundary"
  return "general"
}

function questionTypeFor(kind: DnaV3QueryKind): DnaS13QuestionType {
  if (["definition", "comparison", "relation", "measurement", "development", "evidence"].includes(kind)) {
    return kind as DnaS13QuestionType
  }
  if (kind === "dna_relation") return "relation"
  if (kind === "misconception") return "explanation"
  return "unknown"
}

function claimsForMatch(match: DnaOwnerBookMatch): readonly DnaS13Claim[] {
  return Object.freeze([match.summary, ...match.details].map((text, index) => {
    const id = match.claimIds[index] ?? `owner-book-claim:${hashDnaS13Artifact({ text }).slice(0, 16)}`
    const metadata = getDnaOwnerBookClaimMetadata(id)
    return Object.freeze({
      id,
      text,
      passageId: match.passageIds[index] ?? metadata?.passageId
        ?? `owner-book-passage:${hashDnaS13Artifact({ text }).slice(0, 16)}`,
      sourceIds: Object.freeze([match.sourceId]),
      topicId: metadata?.topicId ?? match.topicId,
      focus: metadata?.focus ?? "general",
      title: metadata?.title ?? match.topic,
      domain: metadata?.domain ?? "self_regulation",
      dimensions: Object.freeze([...(metadata?.dimensions ?? ["general"])]),
      authorityClass: "owner_approved_book",
      citationStatus: match.citationStatus,
      answerEligible: true,
    })
  }))
}

function statusTelemetry(input: Readonly<{
  requestId: string
  createdAt: string
  releaseVersion: string
  releaseHash: string
  subjectIdHash: string
  conversationIdHash: string
  rolloutPhase: "L0" | "L1" | "L2" | "L3"
  privacy: DnaS13LimitedPrivacyDecision
  status: "fallback" | "privacy_blocked" | "cost_guardrail"
  reason: string
  totalMs: number
}>): DnaS13LimitedTelemetryRecord {
  const candidate = {
    schemaVersion: DNA_S13_LIMITED_TELEMETRY_VERSION,
    releaseVersion: input.releaseVersion,
    releaseHash: input.releaseHash,
    requestId: input.requestId,
    createdAt: input.createdAt,
    subjectIdHash: input.subjectIdHash,
    conversationIdHash: input.conversationIdHash,
    rolloutPhase: input.rolloutPhase,
    routing: {
      intents: ["unsupported"], topicIds: [], questionTypes: ["unknown"], operation: input.reason,
      followUp: false, correction: false, contextInherited: false, parserUncertainty: true,
    },
    retrieval: {
      candidateCount: 0, requiredSlotCount: 0, missingRequiredSlotCount: 0,
      requestedSlotCount: 0, answeredSupportedSlotCount: 0,
      answeredUnsupportedSlotCount: 0, silentlyDroppedRequestedSlotCount: 0,
      requiredClaimCount: 0, explanatoryClaimCount: 0,
      comparisonSideASupported: null, comparisonSideBSupported: null,
    },
    realization: {
      provider: "none", status: input.status, lunaCalls: 0, repairCalls: 0,
      inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0,
      abstained: input.status === "fallback",
    },
    validation: {
      pass: false, failureCodes: [input.reason], unsupportedFactCount: 0,
      unsupportedRelationCount: 0, sourceViolationCount: 0, safetyViolationCount: 0,
      comparisonConclusionViolationCount: 0,
    },
    latency: { totalMs: input.totalMs, retrievalMs: 0, lunaMs: 0, validatorMs: 0 },
    privacy: {
      allowed: input.privacy.allowed,
      category: input.privacy.category,
      reasonCodes: input.privacy.reasonCodes,
      questionHash: input.privacy.questionHash,
      rawPromptStored: false,
      maySourceConversationContext: input.privacy.maySourceConversationContext,
    },
    knowledgeGaps: [],
    crossAccountViolationCount: 0,
    automaticTrainingUse: "prohibited",
    trainingCandidate: false,
  }
  const validated = validateDnaS13LimitedTelemetryRecord(candidate)
  if (!validated) throw new Error("dna_s13_limited_status_telemetry_invalid")
  return validated
}

export function createDnaS13LimitedFallbackTelemetry(input: Parameters<typeof statusTelemetry>[0]) {
  return statusTelemetry(input)
}

function routingClarificationBody(input: Readonly<{
  requestId: string
  responseDepth: DnaS13Depth
  contextToken?: string | null
}>) {
  const summary = "Bu ifade birden fazla bilimsel başlıkla eşleşiyor. Kastettiğiniz kavramı üst başlığıyla birlikte biraz daha açık yazar mısınız?"
  return Object.freeze({
    ok: true,
    requestId: input.requestId,
    responseDepth: input.responseDepth,
    runtimeGeneration: "v3",
    classification: "clarification",
    outcome: "clarification",
    summary,
    details: [],
    sources: [],
    answerUnits: [],
    authoritySummary: [],
    caseEvidence: [],
    limitations: [],
    safetyBoundary: "Yanıt tanı, tedavi, seans planı veya kişiye özgü klinik çıkarım değildir.",
    intendedUse: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    suggestedQuestions: [],
    engineVersion: "dna-s13-strict-v4",
    topic: null,
    conversationContext: Object.freeze({
      topicIds: Object.freeze([]),
      lastQueryKind: "unknown",
      ...(input.contextToken ? { limitedRolloutContextToken: input.contextToken } : {}),
    }),
    limitedRolloutFeedbackEligible: false,
  })
}

function publicAuthority() {
  return DNA_S13_LIMITED_OWNER_BOOK_AUTHORITY
}

function queryKind(questionType: DnaS13QuestionType) {
  if (["definition", "comparison", "relation", "measurement", "development", "evidence"].includes(questionType)) {
    return questionType
  }
  return "unknown"
}

function publicBody(input: Readonly<{
  requestId: string
  responseDepth: DnaS13Depth
  answer: string
  realization: NonNullable<Awaited<ReturnType<typeof runDnaS13StrictRuntime>>["realization"]>
  plan: ReturnType<typeof createDnaS13StrictPlan>
  frame: DnaS13QueryFrame
  matches: readonly DnaOwnerBookMatch[]
  contextToken: string | null
  releaseVersion: string
  releaseHash: string
  responseContract: DnaS13LimitedResponseContract
}>) {
  const authority = publicAuthority()
  const firstMatch = input.matches[0]!
  const sourceId = firstMatch.sourceId
  const citationCardId = "citation-card-1"
  const slotById = new Map(input.plan.slots.map((slot) => [slot.id, slot]))
  const answerUnits = input.realization.slotRealizations.map((entry, index) => {
    const slot = slotById.get(entry.slotId)!
    const claims = slot.lockedClaims.map((row) => row.claim)
    return Object.freeze({
      id: `answer-unit-${index + 1}`,
      section: slot.kind === "comparison_conclusion" ? "function_or_relation"
        : slot.kind === "evidence_limitation" ? "boundary" : "definition",
      kind: slot.kind === "evidence_limitation" ? "limitation" : index === 0 ? "summary" : "detail",
      role: "owner_book_information",
      text: entry.text,
      authority,
      claimIds: entry.usedClaimIds,
      passageIds: claims.map((claim) => claim.passageId),
      sourceIds: [sourceId],
      citationCardIds: [citationCardId],
    })
  })
  const firstSubquestion = input.frame.subquestions[0]!
  if (sourceId !== DNA_S13_LIMITED_OWNER_BOOK_SOURCE_ID) {
    throw new Error("dna_s13_limited_owner_book_source_mismatch")
  }
  const body = Object.freeze({
    ok: true,
    requestId: input.requestId,
    responseDepth: input.responseDepth,
    runtimeGeneration: "v3",
    classification: "literature",
    summary: input.answer,
    details: [],
    sources: [Object.freeze({
      id: citationCardId,
      sourceId,
      type: "owner_approved_book",
      title: firstMatch.sourceTitle,
      authors: firstMatch.sourceAuthor,
      year: firstMatch.sourceYear,
      sourceType: "Sahip onaylı kaynak kitap",
      locator: input.matches.map((match) => match.topic).join(" · "),
      evidenceLevel: "Kaynak kitaptaki ilgili açıklama",
      supportedClaim: firstMatch.summary,
      knownBoundary: "Bağımsız bilimsel doğrulama iddiası taşımaz.",
      authority,
    })],
    answerUnits,
    authoritySummary: [authority],
    caseEvidence: [],
    limitations: [],
    safetyBoundary: "Yanıt tanı, tedavi, seans planı veya kişiye özgü klinik çıkarım değildir.",
    intendedUse: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    suggestedQuestions: [],
    engineVersion: "dna-s13-strict-v4",
    catalogVersion: getDnaOwnerBookRuntimeStatus().retrievalVersion,
    packageVersion: input.releaseVersion,
    packageSha256: input.releaseHash,
    topic: firstMatch.topic,
    conversationContext: {
      topicIds: input.frame.subquestions.map((row) => row.topicId).slice(0, 2),
      lastQueryKind: queryKind(firstSubquestion.questionType),
      ...(input.contextToken ? { limitedRolloutContextToken: input.contextToken } : {}),
    },
    limitedRolloutFeedbackEligible: true,
    limitedRolloutContract: input.responseContract,
  })
  if (!validateDnaS13LimitedPublicResponse(body)) {
    throw new Error("dna_s13_limited_public_response_contract_invalid")
  }
  return body
}

export async function runDnaS13LimitedRolloutMessage(input: Readonly<{
  requestId: string
  subjectId: string
  subjectIdHash: string
  conversationIdHash: string
  sessionId: string
  question: string
  responseDepth: DnaS13Depth
  contextToken?: string | null
  contextSecret?: string | null
  privacy: DnaS13LimitedPrivacyDecision
  rolloutPhase: "L0" | "L1" | "L2" | "L3"
  safetyIdentifier?: string | null
  realizer?: Realizer
  /** Candidate-only release switch. Omitted means the existing behavior stays enabled. */
  simplifyExperimentalEnabled?: boolean
  /** Candidate-only typed handoff. Omitted keeps the existing production routing path. */
  resolvedRequestHandoff?: Readonly<{
    contextResolution: DnaS13ResolvedUserQuery
    pragmaticTaskFrame: DnaS13PragmaticTaskFrame
  }>
  technicalObserver?: (evidence: DnaS13LimitedTechnicalEvidence) => void
}>): Promise<DnaS13LimitedRunnerResult> {
  const startedAt = performance.now()
  const createdAt = new Date().toISOString()
  const release = getDnaS13LimitedRolloutReleaseCandidate()
  const fallback = (reason: string, retrievalMs = 0): DnaS13LimitedRunnerResult => ({
    kind: "fallback",
    reason,
    telemetry: statusTelemetry({
      requestId: input.requestId,
      createdAt,
      releaseVersion: release.releaseVersion,
      releaseHash: release.releaseHash,
      subjectIdHash: input.subjectIdHash,
      conversationIdHash: input.conversationIdHash,
      rolloutPhase: input.rolloutPhase,
      privacy: input.privacy,
      status: "fallback",
      reason,
      totalMs: Math.max(retrievalMs, performance.now() - startedAt),
    }),
  })
  const clarification = (reason: string, routing: Extract<DnaS13LimitedRunnerResult, { kind: "clarification" }>["routing"], retrievalMs = 0): DnaS13LimitedRunnerResult => Object.freeze({
    kind: "clarification" as const,
    reason,
    body: routingClarificationBody({
      requestId: input.requestId,
      responseDepth: input.responseDepth,
      contextToken: input.contextToken,
    }),
    telemetry: statusTelemetry({
      requestId: input.requestId,
      createdAt,
      releaseVersion: release.releaseVersion,
      releaseHash: release.releaseHash,
      subjectIdHash: input.subjectIdHash,
      conversationIdHash: input.conversationIdHash,
      rolloutPhase: input.rolloutPhase,
      privacy: input.privacy,
      status: "fallback",
      reason,
      totalMs: Math.max(retrievalMs, performance.now() - startedAt),
    }),
    routing,
  })
  if (!input.privacy.allowed) return fallback("privacy_blocked")
  if (resolveDnaChatSocialConversation(input.question)) return fallback("social_or_product_message")

  const retrievalStartedAt = performance.now()
  const state = input.contextToken && input.contextSecret
    ? openDnaS13LimitedContext({
        token: input.contextToken,
        masterSecret: input.contextSecret,
        subjectId: input.subjectId,
        sessionId: input.sessionId,
      })
    : null
  const preliminaryContextResolution = resolveDnaS13ConversationContext({
    sessionId: input.sessionId,
    question: input.question,
    responseDepth: input.responseDepth,
    privacyAllowed: true,
    state,
  })
  const contextResolution = input.resolvedRequestHandoff?.contextResolution ?? preliminaryContextResolution
  const namedTargets = input.resolvedRequestHandoff ? Object.freeze([]) : resolveDnaS13NamedTopicSurfaces(
    input.question,
    state?.lastEligibleTopicIds ?? [],
    8,
  )
  const initialPragmaticTargets: readonly DnaS13PragmaticTarget[] = Object.freeze(
    contextResolution.topicMentions.map((target) => Object.freeze({
      topicId: target.topicId,
      surface: target.surface,
      polarity: target.polarity,
    })),
  )
  const initialPragmaticTask = input.resolvedRequestHandoff?.pragmaticTaskFrame ?? resolveDnaS13PragmaticTask({
    question: input.question,
    responseDepth: contextResolution.responseDepth,
    correction: contextResolution.correction,
    contextInherited: contextResolution.contextInherited,
    namedTargetCount: namedTargets.length,
    targets: initialPragmaticTargets,
    previousAction: contextResolution.previousAction,
    previousFacets: contextResolution.previousFacets,
  })
  const comparisonRequested = initialPragmaticTask.pragmaticAction === "COMPARE"
  const parsedComparison = comparisonRequested ? parseDnaS13CanaryComparison(input.question) : null
  if (contextResolution.operation === "clarification_required") {
    return clarification("context_clarification_required", Object.freeze({
      normalizedQuery: contextResolution.normalizedQuestion,
      contextOperation: contextResolution.operation,
      contextResolutionMethod: contextResolution.resolutionMethod,
      candidateTopicIds: Object.freeze([...(contextResolution.candidateTopicIds ?? [])]),
      selectedTopicIds: Object.freeze([]),
      confidence: contextResolution.topicResolutionConfidence ?? "LOW",
      pragmaticTaskFrame: initialPragmaticTask,
    }), performance.now() - retrievalStartedAt)
  }
  const split = input.resolvedRequestHandoff
    ? { questions: contextResolution.retrievalQuestions, exceedsLimit: false }
    : comparisonRequested && contextResolution.targetTopicIds.length >= 2
    ? { questions: contextResolution.retrievalQuestions, exceedsLimit: false }
    : parsedComparison
      ? { questions: parsedComparison, exceedsLimit: false }
      : contextResolution.targetTopicIds.length
      ? { questions: contextResolution.retrievalQuestions, exceedsLimit: false }
      : splitDnaV3Subquestions(input.question)
  const questions = split.questions.slice(0, input.resolvedRequestHandoff ? 8 : 2)
  const matches = questions.map((subquestion, index) => {
    const targetTopicId = contextResolution.targetTopicIds[index]
    return targetTopicId
      ? resolveDnaOwnerBookTopic(targetTopicId, subquestion, contextResolution.responseDepth)
      : resolveDnaOwnerBook(subquestion, [], input.responseDepth)
  })
  if (matches.some((match) => !match)) return fallback("retrieval_not_supported", performance.now() - retrievalStartedAt)
  const resolvedMatches = matches as DnaOwnerBookMatch[]
  const comparisonTargetTopicIds = comparisonRequested
    ? Object.freeze(resolvedMatches.map((match) => match.topicId))
    : Object.freeze([])
  const pragmaticTargets: readonly DnaS13PragmaticTarget[] = Object.freeze([
    ...initialPragmaticTargets,
    ...resolvedMatches.filter((match) => !initialPragmaticTargets.some((target) => target.topicId === match.topicId))
      .map((match) => Object.freeze({ topicId: match.topicId, surface: match.topic, polarity: "ACTIVE_TARGET" as const })),
  ])
  const resolvedPragmaticTaskFrame = input.resolvedRequestHandoff?.pragmaticTaskFrame ?? resolveDnaS13PragmaticTask({
    question: input.question,
    responseDepth: contextResolution.responseDepth,
    correction: contextResolution.correction,
    contextInherited: contextResolution.contextInherited,
    namedTargetCount: Math.max(namedTargets.length, resolvedMatches.length > 1 ? resolvedMatches.length : 0),
    targets: pragmaticTargets,
    previousAction: contextResolution.previousAction,
    previousFacets: contextResolution.previousFacets,
  })
  const pragmaticTaskFrame: DnaS13PragmaticTaskFrame = input.simplifyExperimentalEnabled === false
    && dnaS13HasPresentationModifier(resolvedPragmaticTaskFrame, "SIMPLIFY")
    ? Object.freeze({
        ...resolvedPragmaticTaskFrame,
        presentationModifiers: Object.freeze([]),
      })
    : resolvedPragmaticTaskFrame
  const simplifyPresentation = dnaS13HasPresentationModifier(pragmaticTaskFrame, "SIMPLIFY")
  const followUp = contextResolution.followUp
  const correction = contextResolution.correction
  const semanticOperation = contextResolution.operation
  const contextTargetContinues = Boolean(state
    && contextResolution.targetTopicIds.length === 1
    && state.lastEligibleActiveTopicId === contextResolution.targetTopicIds[0])
  const informationGainOperation = !simplifyPresentation
    && ["DEEPEN", "WHY_SIGNIFICANCE", "EXAMPLE"].includes(pragmaticTaskFrame.pragmaticAction)
    || pragmaticTaskFrame.discourseConstraints.includes("do_not_repeat")
  const alreadyShownClaimIds = contextTargetContinues ? state?.alreadyShownClaimIds ?? [] : []
  const alreadyAnsweredFacets = contextTargetContinues
    ? (state?.alreadyAnsweredFacets ?? []).filter((facet): facet is DnaS13RequestedFacet =>
        ["definition", "function", "boundary", "supported_meaning", "limitation", "components", "core_scope", "explanatory_detail", "distinction", "verified_example"].includes(facet))
    : []
  const alreadyShownRelationIds = contextTargetContinues ? state?.alreadyShownRelationIds ?? [] : []
  const pragmaticFollowUp = followUp || Boolean(contextTargetContinues
    && (simplifyPresentation
      || ["DEEPEN", "WHY_SIGNIFICANCE", "EXAMPLE", "SUMMARIZE"].includes(pragmaticTaskFrame.pragmaticAction)))
  const responseDepth: DnaS13Depth = simplifyPresentation ? "short"
    : ["DEEPEN", "WHY_SIGNIFICANCE", "EXAMPLE"].includes(pragmaticTaskFrame.pragmaticAction) ? "deep"
      : contextResolution.responseDepth
  const subquestions: DnaS13Subquestion[] = resolvedMatches.map((match, index) => {
    const kind = comparisonRequested ? "comparison" : classifyDnaV3QueryKind(input.question)
    const subquestionTask = resolveDnaS13PragmaticTask({
      question: questions[index] ?? input.question,
      responseDepth,
      correction: false,
      contextInherited: false,
      namedTargetCount: 1,
      targets: Object.freeze([Object.freeze({
        topicId: match.topicId,
        surface: match.topic,
        polarity: "ACTIVE_TARGET" as const,
      })]),
      previousAction: contextResolution.previousAction,
      previousFacets: contextResolution.previousFacets,
    })
    return Object.freeze({
      id: `q${index + 1}`,
      question: questions[index] ?? input.question,
      intent: "scientific_question" as const,
      topicId: match.topicId,
      focus: focusFor(kind),
      questionType: comparisonRequested ? "comparison" as const : pragmaticFollowUp ? "follow_up" as const : questionTypeFor(kind),
      followUp: pragmaticFollowUp,
      correction,
      comparisonTargetTopicIds,
      answerabilityHint: "supported" as const,
      requestedFacets: input.resolvedRequestHandoff
        ? pragmaticTaskFrame.requestedFacets
        : comparisonRequested
        ? pragmaticTaskFrame.requestedFacets
        : resolvedMatches.length > 1 || contextResolution.intraTurnCoreferenceCount
          ? subquestionTask.requestedFacets : pragmaticTaskFrame.requestedFacets,
    })
  })
  const frame: DnaS13QueryFrame = Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION,
    normalizedQuestion: normalizeDnaChatText(input.question),
    responseDepth,
    uncertain: split.exceedsLimit,
    subquestions: Object.freeze(subquestions),
  })
  const topicClaimsBySubquestion = Object.fromEntries(subquestions.map((subquestion, index) => {
    const matchClaims = claimsForMatch(resolvedMatches[index]!)
    const orderedOwnerClaims = getDnaOwnerBookTopicClaims(subquestion.topicId, true)
    const allClaims = [...matchClaims, ...orderedOwnerClaims.map(ownerTopicClaimToDnaS13Claim)]
      .filter((claim, claimIndex, rows) => rows.findIndex((entry) => entry.id === claim.id) === claimIndex)
    const semanticFrame = createDnaS13TopicSemanticFrame({
      topicId: subquestion.topicId,
      title: getDnaOwnerBookTopicTitle(subquestion.topicId) ?? resolvedMatches[index]!.topic,
      orderedClaims: orderedOwnerClaims,
    })
    return [subquestion.id, Object.freeze({
      matchClaims,
      allClaims: Object.freeze(allClaims),
      semanticFrame,
    })]
  }))
  const intraTurnSelectedClaimIds = new Set<string>()
  const facetResolutionBySubquestion = Object.fromEntries(subquestions.map((subquestion) => {
    const contextualSimplifySlots = simplifyPresentation
      && contextResolution.operation === "simplify_same_topic"
      ? (state?.lastEligibleAnswerSlots ?? []).filter((slot) => slot.topicId === subquestion.topicId)
      : []
    if (contextualSimplifySlots.length) {
      const claimById = new Map(topicClaimsBySubquestion[subquestion.id]!.allClaims.map((claim) => [claim.id, claim]))
      const claimsByFacet: Partial<Record<DnaS13RequestedFacet, readonly DnaS13Claim[]>> = Object.fromEntries(
        (subquestion.requestedFacets ?? []).map((facet) => {
        const matchingSlots = contextualSimplifySlots.filter((slot) => slot.requestedFacet === facet)
        const sourceSlots = matchingSlots.length ? matchingSlots : contextualSimplifySlots.length === 1 ? contextualSimplifySlots : []
        const claims = sourceSlots.flatMap((slot) => slot.requiredClaimIds)
          .flatMap((claimId) => claimById.get(claimId) ? [claimById.get(claimId)!] : [])
          .filter((claim, index, rows) => rows.findIndex((row) => row.id === claim.id) === index)
          return [facet, Object.freeze(claims)]
        }))
      const requested = new Set(subquestion.requestedFacets ?? [])
      const matrix = DNA_S13_REQUESTED_FACETS.map((facet) => {
        const claims = claimsByFacet[facet] ?? []
        const supported = requested.has(facet) && claims.length > 0
        return Object.freeze({
          subquestionId: subquestion.id,
          topicId: subquestion.topicId,
          facet,
          status: !requested.has(facet) ? "NOT_REQUESTED" as const
            : supported ? "SUPPORTED_DIRECT" as const : "UNSUPPORTED" as const,
          supportClaimIds: Object.freeze(claims.map((claim) => claim.id)),
          supportRelationIds: Object.freeze([]),
          entailment: supported ? "ENTAILS" as const : "DOES_NOT_ENTAIL" as const,
          allowedDerivationType: null,
          derivedFacet: null,
          evaluatedClaimIds: Object.freeze(claims.map((claim) => claim.id)),
          confidence: supported ? 1 : requested.has(facet) ? 0 : 1,
        })
      })
      return [subquestion.id, Object.freeze({ claimsByFacet: Object.freeze(claimsByFacet), matrix: Object.freeze(matrix) })]
    }
    const resolution = resolveDnaS13FacetEvidence({
      subquestionId: subquestion.id,
      topicId: subquestion.topicId,
      requestedFacets: subquestion.requestedFacets ?? ["core_scope"],
      candidates: topicClaimsBySubquestion[subquestion.id]!.allClaims,
      strictSignificance: pragmaticTaskFrame.pragmaticAction === "WHY_SIGNIFICANCE",
      excludedClaimIds: Object.freeze([
        ...(informationGainOperation ? alreadyShownClaimIds : []),
        ...intraTurnSelectedClaimIds,
      ]),
      excludedClaims: informationGainOperation
        ? Object.freeze(topicClaimsBySubquestion[subquestion.id]!.allClaims
            .filter((claim) => alreadyShownClaimIds.includes(claim.id)))
        : Object.freeze([]),
      topicSemanticFrame: topicClaimsBySubquestion[subquestion.id]!.semanticFrame,
    })
    Object.values(resolution.claimsByFacet).flat().forEach((claim) => intraTurnSelectedClaimIds.add(claim.id))
    return [subquestion.id, resolution]
  }))
  const requiredClaimsByFacetBySubquestion: Record<string, Partial<Record<DnaS13RequestedFacet, readonly DnaS13Claim[]>>> = Object.fromEntries(subquestions.map((subquestion) => [
    subquestion.id,
    facetResolutionBySubquestion[subquestion.id]!.claimsByFacet,
  ]))
  const facetEvidenceBySubquestion = Object.fromEntries(subquestions.map((subquestion) => [
    subquestion.id,
    facetResolutionBySubquestion[subquestion.id]!.matrix,
  ]))
  const requiredClaimsBySubquestion: Record<string, readonly DnaS13Claim[]> = Object.fromEntries(subquestions.map((subquestion) => [
    subquestion.id,
    Object.freeze(Object.values(requiredClaimsByFacetBySubquestion[subquestion.id] ?? {}).flat()),
  ]))
  const explanatoryCandidatesBySubquestion = Object.fromEntries(subquestions.map((subquestion) => [
    subquestion.id,
    topicClaimsBySubquestion[subquestion.id]!.matchClaims,
  ]))
  const topicSemanticFramesBySubquestion = Object.fromEntries(subquestions.map((subquestion) => [
    subquestion.id,
    topicClaimsBySubquestion[subquestion.id]!.semanticFrame,
  ]))
  const simplifyPayloadAudit = simplifyPresentation ? Object.freeze(subquestions.map((subquestion) => {
    const contextualSlots = contextResolution.operation === "simplify_same_topic"
      ? (state?.lastEligibleAnswerSlots ?? []).filter((slot) => slot.topicId === subquestion.topicId)
      : []
    const supportClaimIds = Object.freeze([...new Set(
      Object.values(requiredClaimsByFacetBySubquestion[subquestion.id] ?? {}).flat().map((claim) => claim.id),
    )])
    const previousClaimIds = Object.freeze([...new Set(contextualSlots.flatMap((slot) => slot.requiredClaimIds))])
    const previousFacets = Object.freeze([...new Set(contextualSlots.flatMap((slot) =>
      slot.requestedFacet ? [slot.requestedFacet] : []))])
    const sameSet = (left: readonly string[], right: readonly string[]) => left.length === right.length
      && left.every((value) => right.includes(value))
    return Object.freeze({
      subquestionId: subquestion.id,
      topicId: subquestion.topicId,
      mode: contextualSlots.length ? "CONTEXTUAL_SIMPLIFY" as const : "EXPLICIT_TOPIC_SIMPLIFY" as const,
      sourceFacet: (subquestion.requestedFacets ?? []).join(",") || null,
      supportClaimIds,
      previousClaimIds,
      previousFacets,
      mainMeaningEntailed: contextualSlots.length ? null : supportClaimIds.length > 0,
      contextualClaimSetPreserved: contextualSlots.length ? sameSet(supportClaimIds, previousClaimIds) : null,
      contextualFacetSetPreserved: contextualSlots.length
        ? sameSet(subquestion.requestedFacets ?? [], previousFacets) : null,
      selectionReason: contextualSlots.length ? "previous_locked_content_plan"
        : "base_action_standard_retrieval",
    })
  })) : Object.freeze([])
  const plan = createDnaS13StrictPlan({
    frame,
    pragmaticTaskFrame,
    requiredClaimsBySubquestion,
    requiredClaimsByFacetBySubquestion,
    facetEvidenceBySubquestion,
    explanatoryCandidatesBySubquestion,
    topicSemanticFramesBySubquestion,
    simplifyPayloadAudit,
    semanticOperation: Object.freeze({
      operation: semanticOperation,
      targets: Object.freeze((contextResolution.topicMentions.length ? contextResolution.topicMentions : subquestions.map((subquestion) => Object.freeze({
        topicId: subquestion.topicId,
        surface: null,
        polarity: "ACTIVE_TARGET" as const,
      }))).map((target) => Object.freeze({
        topicId: target.topicId,
        surface: target.surface,
        polarity: target.polarity,
      }))),
      alreadyShownClaimIds: Object.freeze([...alreadyShownClaimIds]),
      alreadyAnsweredFacets: Object.freeze([...alreadyAnsweredFacets]),
      alreadyShownRelationIds: Object.freeze([...alreadyShownRelationIds]),
    }),
    questionHash: input.privacy.questionHash,
  })
  const rejectedTargetIds = new Set(plan.semanticOperationAudit?.targets
    .filter((target) => target.polarity === "REJECTED_TARGET").map((target) => target.topicId) ?? [])
  if (plan.slots.some((slot) => rejectedTargetIds.has(slot.topicId)
    || slot.lockedClaims.some((entry) => rejectedTargetIds.has(entry.claim.topicId)))) {
    throw new Error("dna_s13_limited_rejected_target_in_final_plan")
  }
  const lockedPlanTopicIds = [...new Set([
    ...plan.slots.filter((slot) => slot.kind !== "comparison_conclusion").map((slot) => slot.topicId),
    ...(plan.facetEvidenceMatrix ?? []).filter((entry) => entry.status !== "NOT_REQUESTED").map((entry) => entry.topicId),
  ])]
  const finalTopicIds = [...new Set(frame.subquestions.map((row) => row.topicId))]
  if (!finalTopicIds.every((topicId) => lockedPlanTopicIds.includes(topicId))) {
    throw new Error("dna_s13_limited_final_topic_outside_locked_plan")
  }
  const routingValidation = validateDnaS13Routing({
    context: contextResolution,
    task: pragmaticTaskFrame,
    frame,
    plan,
  })
  if (!routingValidation.pass) {
    return clarification(`routing_validation_${routingValidation.failureCodes.join("_").toLowerCase()}`, Object.freeze({
      normalizedQuery: contextResolution.normalizedQuestion,
      contextOperation: contextResolution.operation,
      contextResolutionMethod: contextResolution.resolutionMethod,
      candidateTopicIds: Object.freeze([...new Set([
        ...(contextResolution.candidateTopicIds ?? []),
        ...namedTargets.flatMap((target) => target.candidateTopicIds),
      ])]),
      selectedTopicIds: Object.freeze(frame.subquestions.map((row) => row.topicId)),
      confidence: contextResolution.topicResolutionConfidence ?? "LOW",
      pragmaticTaskFrame,
    }), performance.now() - retrievalStartedAt)
  }
  const retrievalMs = performance.now() - retrievalStartedAt
  const catalog = getDnaOwnerBookRuntimeStatus()
  const policyDecision = resolveDnaS13RealizationDecision({
    frame,
    plan,
    action: pragmaticTaskFrame.pragmaticAction,
    multiTurn: contextResolution.contextInherited || contextResolution.operation !== "standalone",
    routingConfidence: contextResolution.topicResolutionConfidence ?? "LOW",
  })
  const selectedRealizer = input.realizer ?? (policyDecision.useLuna
    ? new LunaRealizer({ safetyIdentifier: input.safetyIdentifier ?? null })
    : new DeterministicRealizer())
  const realizationDecision: DnaS13RealizationDecision = input.realizer
    ? Object.freeze({
        ...policyDecision,
        useLuna: input.realizer.identity.provider === "luna",
        reason: policyDecision.reason,
      })
    : policyDecision
  const runtimeStartedAt = performance.now()
  let result: DnaS13StrictRuntimeResult
  try {
    const runtimeInput = {
      question: input.question,
      normalizedQuestion: frame.normalizedQuestion,
      queryFrame: frame,
      plan,
      catalog: Object.freeze({ version: catalog.retrievalVersion, hash: catalog.sourceSha256 }),
      retrieval: Object.freeze({
        version: catalog.retrievalVersion,
        hash: hashDnaS13Artifact({ questions, matches: resolvedMatches }),
      }),
      privacy: Object.freeze({
        category: "general_non_sensitive",
        containsClinicalOrCaseData: false,
        containsPersonalData: false,
        automaticTrainingAllowed: false,
        reasons: Object.freeze(["production_training_prohibited"]),
      }),
      trainingCandidateRequested: false,
    }
    result = simplifyPresentation && !input.realizer
      ? await runDnaS13SelectiveSimplifyRuntime({
          ...runtimeInput,
          lunaRealizer: new LunaRealizer({ safetyIdentifier: input.safetyIdentifier ?? null }),
        })
      : await runDnaS13StrictRuntime({ ...runtimeInput, realizer: selectedRealizer })
  } catch (caught) {
    // Fail closed into the existing same-topic deterministic path. A strict
    // planner/validator/realizer exception must never terminate the user turn.
    const message = caught instanceof Error ? caught.message : "unknown"
    const diagnostic = message.startsWith("dna_s13_strict_fallback_invalid:")
      ? `strict_fallback_invalid_${message.slice(message.indexOf(":") + 1).replace(/[^a-zA-Z0-9_]+/gu, "_").slice(0, 120)}`
      : message.includes("luna_hard_cap") ? "luna_hard_cap" : "strict_runtime_safe_fallback"
    return fallback(diagnostic, retrievalMs)
  }
  input.technicalObserver?.(Object.freeze({
    normalizedQuery: frame.normalizedQuestion,
    contextOperation: contextResolution.operation,
    contextResolutionMethod: contextResolution.resolutionMethod,
    topicCandidateIds: Object.freeze([...(contextResolution.candidateTopicIds ?? contextResolution.targetTopicIds)]),
    topicResolutionConfidence: contextResolution.topicResolutionConfidence ?? "LOW",
    pragmaticTaskFrame,
    queryFrame: frame,
    matches: Object.freeze([...resolvedMatches]),
    plan,
    routingValidation,
    realizationDecision,
    runtime: result,
  }))
  const runtimeMs = performance.now() - runtimeStartedAt
  const simplifyResolution = (result as DnaS13StrictRuntimeResult & Readonly<{
    simplifyResolution?: Readonly<{ finalQualityStatus?: string }>
  }>).simplifyResolution
  const simplifyQualityLimited = simplifyResolution?.finalQualityStatus === DNA_S13_SIMPLIFY_QUALITY_LIMITATION
  const failureCodes = [
    ...result.finalValidation.failureCodes,
    ...(simplifyQualityLimited ? [DNA_S13_SIMPLIFY_QUALITY_LIMITATION] : []),
  ]
  const comparisonSlots = plan.slots.filter((slot) => slot.kind === "comparison_side")
  const missingRequiredSlotCount = result.finalValidation.pass ? 0 : plan.slots.filter((slot) =>
    !result.realization.slotRealizations.some((entry) => entry.slotId === slot.id)).length
  const isLuna = result.provenance.realizer.provider === "luna"
  const lunaMs = result.provenance.latencyMs
  const telemetryCandidate = {
    schemaVersion: DNA_S13_LIMITED_TELEMETRY_VERSION,
    releaseVersion: release.releaseVersion,
    releaseHash: release.releaseHash,
    requestId: input.requestId,
    createdAt,
    subjectIdHash: input.subjectIdHash,
    conversationIdHash: input.conversationIdHash,
    rolloutPhase: input.rolloutPhase,
    routing: {
      intents: subquestions.map((row) => row.intent),
      topicIds: subquestions.map((row) => row.topicId),
      questionTypes: subquestions.map((row) => row.questionType),
      operation: contextResolution.operation,
      followUp,
      correction,
      contextInherited: contextResolution.contextInherited,
      parserUncertainty: frame.uncertain,
    },
    retrieval: {
      candidateCount: resolvedMatches.reduce((sum, match) => sum + match.claimIds.length, 0),
      requiredSlotCount: plan.slots.length,
      missingRequiredSlotCount,
      requestedSlotCount: result.finalValidation.requestedSlotCount,
      answeredSupportedSlotCount: result.finalValidation.answeredSupportedSlotCount,
      answeredUnsupportedSlotCount: result.finalValidation.answeredUnsupportedSlotCount,
      silentlyDroppedRequestedSlotCount: result.finalValidation.silentlyDroppedRequestedSlotCount,
      requiredClaimCount: result.provenance.requiredClaimIds.length,
      explanatoryClaimCount: result.provenance.explanatoryClaimIds.length,
      comparisonSideASupported: comparisonSlots.length ? result.validation.comparisonSideASupported : null,
      comparisonSideBSupported: comparisonSlots.length ? result.validation.comparisonSideBSupported : null,
    },
    realization: {
      provider: result.provenance.realizer.provider,
      status: result.status === "realized" ? "accepted" : result.status === "repaired" ? "repaired" : "fallback",
      lunaCalls: isLuna ? result.providerCalls : 0,
      repairCalls: result.providerCalls > 1 ? 1 : 0,
      inputTokens: result.provenance.usage.inputTokens,
      cachedInputTokens: result.provenance.usage.cachedInputTokens,
      outputTokens: result.provenance.usage.outputTokens,
      costMicrousd: result.provenance.costMicrousd,
      abstained: plan.comparisonConclusionMode === "abstain"
        || (plan.answerSufficiency ?? []).some((entry) => entry.status !== "SUFFICIENT"),
    },
    validation: {
      pass: result.finalValidation.pass,
      failureCodes,
      unsupportedFactCount: result.finalValidation.unsupportedAdditionCount,
      unsupportedRelationCount: result.finalValidation.unsupportedRelationCount,
      sourceViolationCount: result.finalValidation.sourceViolationCount,
      safetyViolationCount: result.finalValidation.safetyViolationCount,
      comparisonConclusionViolationCount: failureCodes.filter((code) => code.startsWith("comparison_conclusion_")).length,
    },
    latency: {
      totalMs: performance.now() - startedAt,
      retrievalMs,
      lunaMs,
      validatorMs: Math.max(0, runtimeMs - lunaMs),
    },
    privacy: {
      allowed: true,
      category: input.privacy.category,
      reasonCodes: input.privacy.reasonCodes,
      questionHash: input.privacy.questionHash,
      rawPromptStored: false,
      maySourceConversationContext: true,
    },
    knowledgeGaps: plan.knowledgeGaps ?? [],
    crossAccountViolationCount: 0,
    automaticTrainingUse: "prohibited",
    trainingCandidate: false,
  }
  const telemetry = validateDnaS13LimitedTelemetryRecord(telemetryCandidate)
  if (!telemetry) throw new Error("dna_s13_limited_telemetry_invalid")
  if (!result.finalValidation.pass) {
    return Object.freeze({ kind: "fallback", reason: "strict_validation_not_passed", telemetry })
  }
  const responseContract = createDnaS13LimitedResponseContract({
    releaseHash: release.releaseHash,
    limitedRolloutEligible: true,
    validatorPass: result.finalValidation.pass,
    displayEligible: result.provenance.finalAcceptedOutput === result.answer
      && ["accepted", "repaired", "fallback"].includes(result.provenance.status),
    privacyPass: input.privacy.allowed
      && result.provenance.privacy.containsClinicalOrCaseData === false
      && result.provenance.privacy.containsPersonalData === false,
    privacyCategory: input.privacy.category,
    realizationStatus: result.provenance.status,
    lockedPlanFallback: result.status === "deterministic_fallback",
    lockedPlanTopicIds,
    validatorFailureCodes: failureCodes,
    unsupportedFactualAdditionCount: result.finalValidation.unsupportedAdditionCount,
    unsupportedRelationCount: result.finalValidation.unsupportedRelationCount,
    sourceViolationCount: result.finalValidation.sourceViolationCount,
    safetyViolationCount: result.finalValidation.safetyViolationCount,
  })
  if (!isDnaS13LimitedResponseDisplayEligible(responseContract)) {
    return Object.freeze({ kind: "fallback", reason: "limited_response_not_display_eligible", telemetry })
  }
  const first = subquestions[0]!
  const contextToken = input.contextSecret
    ? (() => {
        const activeTopicId = subquestions.at(-1)!.topicId
        const continueSameTarget = state?.lastEligibleActiveTopicId === activeTopicId
        const currentClaimIds = plan.lockedClaimIds.filter((claimId) => !claimId.startsWith("system."))
        const currentFacets = (plan.facetEvidenceMatrix ?? []).filter((entry) =>
          entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED").map((entry) => entry.facet)
        const currentRelationIds = (plan.relationContracts ?? []).map((relation) => relation.id)
        return sealDnaS13LimitedContext({
        masterSecret: input.contextSecret,
        subjectId: input.subjectId,
        topicIds: subquestions.map((row) => row.topicId),
        focus: first.focus,
        questionType: first.questionType,
        responseDepth: frame.responseDepth,
        activeTopicId,
        shownClaimIds: Object.freeze([...(continueSameTarget ? state?.alreadyShownClaimIds ?? [] : []), ...currentClaimIds]),
        answeredFacets: Object.freeze([...(continueSameTarget ? alreadyAnsweredFacets : []), ...currentFacets]),
        shownRelationIds: Object.freeze([...(continueSameTarget ? state?.alreadyShownRelationIds ?? [] : []), ...currentRelationIds]),
        rejectedTopicIds: contextResolution.topicMentions.filter((target) => target.polarity === "REJECTED_TARGET")
          .map((target) => target.topicId),
        previousAction: pragmaticTaskFrame.pragmaticAction,
        previousFacets: pragmaticTaskFrame.requestedFacets,
        lastResponseSlots: plan.slots.filter((slot) => slot.kind === "answer" && slot.lockedClaimIds.length > 0)
          .map((slot) => Object.freeze({
            topicId: slot.topicId,
            requestedFacet: slot.requestedFacet ?? null,
            claimIds: Object.freeze([...slot.lockedClaimIds]),
          })),
      })
      })()
    : null
  return Object.freeze({
    kind: "answered",
    body: publicBody({
      requestId: input.requestId,
      responseDepth: frame.responseDepth,
      answer: result.answer,
      realization: result.realization,
      plan,
      frame,
      matches: resolvedMatches,
      contextToken,
      releaseVersion: release.releaseVersion,
      releaseHash: release.releaseHash,
      responseContract,
    }),
    telemetry,
  })
}
