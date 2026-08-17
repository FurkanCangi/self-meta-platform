import "server-only"

import { randomUUID } from "node:crypto"
import { resolveDnaOwnerBook, resolveDnaOwnerBookTopic, getDnaOwnerBookRuntimeStatus, type DnaOwnerBookMatch } from "../../ownerBookRuntime"
import { resolveDnaChatSocialConversation } from "../../socialConversation"
import { normalizeDnaChatText } from "../../text"
import { classifyDnaV3QueryKind, splitDnaV3Subquestions, type DnaV3QueryKind } from "../../v3RetrievalCore"
import {
  DNA_S13_QUERY_FRAME_VERSION,
  type DnaS13Claim,
  type DnaS13Depth,
  type DnaS13Focus,
  type DnaS13QueryFrame,
  type DnaS13QuestionType,
  type DnaS13Subquestion,
} from "../contracts"
import { hashDnaS13Artifact } from "../strictHash"
import {
  createDnaS13ConversationState,
  dnaS13ContextOperationHasVerifiedSupport,
  resolveDnaS13ConversationContext,
  type DnaS13ConversationState,
} from "../conversationContext"
import { LunaRealizer } from "../strictLunaRealizer.server"
import { createDnaS13StrictPlan } from "../strictPlanner"
import { DeterministicRealizer, type Realizer } from "../strictRealizer"
import { runDnaS13StrictRuntime } from "../strictRuntime"
import {
  DNA_S13_CANARY_TELEMETRY_VERSION,
  EMPTY_DNA_S13_CANARY_QUALITY,
  type DnaS13CanaryMessageRecord,
} from "./contracts"
import {
  DNA_S13_CANARY_ARCHITECTURE_HASH,
  DNA_S13_CANARY_ARCHITECTURE_VERSION,
} from "./freeze"
import type { DnaS13CanaryFlags } from "./flags"
import { parseDnaS13CanaryComparison } from "./parser"
import { inspectDnaS13CanaryPrivacy } from "./privacy"
import { appendDnaS13CanaryMessage, appendDnaS13CanaryPrivacyRejection, readDnaS13CanarySession } from "./store.server"

const NOT_AVAILABLE = "Mevcut doğrulanmış içerik bu soruyu güvenilir biçimde yanıtlamak için yeterli değil."

export class DnaS13CanaryPrivacyError extends Error {
  readonly code = "dna_s13_canary_privacy_blocked"
}

function safeId(value: string, name: string) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/u.test(value)) throw new Error(`dna_s13_canary_${name}_invalid`)
  return value
}

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
  const sentences = [match.summary, ...match.details]
  return Object.freeze(sentences.map((text, index) => Object.freeze({
    id: match.claimIds[index] ?? `owner-book-claim:${hashDnaS13Artifact({ text }).slice(0, 16)}`,
    text,
    passageId: match.passageIds[index] ?? `owner-book-passage:${hashDnaS13Artifact({ text }).slice(0, 16)}`,
    sourceIds: Object.freeze([match.sourceId]),
    topicId: match.topicId,
    focus: "general",
    title: match.topic,
    domain: "self_regulation",
    dimensions: Object.freeze(["general"]),
    authorityClass: "owner_approved_book",
    citationStatus: match.citationStatus,
    answerEligible: true,
  })))
}

function unsupportedRecord(input: Readonly<{
  sessionId: string
  messageId: string
  testerIdHash: string
  question: string
  normalizedQuestion: string
  answer: string
  privacy: ReturnType<typeof inspectDnaS13CanaryPrivacy>["classification"]
  intent: "social_product" | "unsupported"
  startedAt: number
  followUp?: boolean
  correction?: boolean
}>): DnaS13CanaryMessageRecord {
  return Object.freeze({
    schemaVersion: DNA_S13_CANARY_TELEMETRY_VERSION,
    architectureVersion: DNA_S13_CANARY_ARCHITECTURE_VERSION,
    architectureHash: DNA_S13_CANARY_ARCHITECTURE_HASH,
    sessionId: input.sessionId,
    messageId: input.messageId,
    createdAt: new Date().toISOString(),
    testerIdHash: input.testerIdHash,
    question: input.question,
    normalizedQuestion: input.normalizedQuestion,
    answer: input.answer,
    privacy: input.privacy,
    routing: Object.freeze({
      intent: Object.freeze([input.intent]),
      detectedTopicIds: Object.freeze([]),
      focus: Object.freeze(["general"]),
      questionType: Object.freeze([input.intent === "social_product" ? "product_help" : "unknown"]),
      followUp: input.followUp === true,
      correction: input.correction === true,
      subquestionCount: 1,
      answerability: Object.freeze([input.intent === "social_product" ? "supported" : "unsupported"]),
      comparisonMode: null,
      parserUncertainty: input.intent === "unsupported",
    }),
    retrieval: Object.freeze({
      candidateCount: 0,
      selectedRequiredClaimIds: Object.freeze([]),
      selectedExplanatoryClaimIds: Object.freeze([]),
      confidence: null,
      contribution: Object.freeze({ lexical: null, semantic: null, graph: null }),
      comparisonSideACovered: null,
      comparisonSideBCovered: null,
      missingRequiredSlotIds: Object.freeze(["q1"]),
    }),
    realization: Object.freeze({
      provider: "none",
      status: "not_answered",
      firstPassValidatorPassed: null,
      repairValidatorPassed: null,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      latencyMs: Math.max(0, performance.now() - input.startedAt),
      costMicrousd: 0,
      cache: "not_applicable",
      lunaCalls: 0,
      repairCalls: 0,
    }),
    validation: Object.freeze({
      pass: input.intent === "social_product",
      wrongClaimSubstitution: 0,
      claimViolation: 0,
      relationViolation: 0,
      comparisonConclusionViolation: 0,
      unsupportedAddition: 0,
      sourceViolation: 0,
      safetyViolation: 0,
      failureCodes: Object.freeze(input.intent === "social_product" ? [] : ["not_answered"]),
    }),
    quality: EMPTY_DNA_S13_CANARY_QUALITY,
    training: Object.freeze({
      training_candidate: false,
      exclude_from_training: true,
      exclusion_reason: "not_answered",
    }),
    provenanceHash: null,
    provenance: null,
  })
}

function realizerFor(flags: DnaS13CanaryFlags, safetyIdentifier: string | null): Realizer {
  return flags.lunaEnabled
    ? new LunaRealizer({ safetyIdentifier })
    : new DeterministicRealizer()
}

async function storedConversationState(input: Readonly<{
  outputRoot: string
  sessionId: string
  testerIdHash: string
}>): Promise<DnaS13ConversationState | null> {
  const session = await readDnaS13CanarySession(input.outputRoot, input.sessionId)
  const provenanceByHash = new Map(session.provenance.map((row) => [row.provenanceHash, row]))
  for (const message of [...session.messages].reverse()) {
    if (message.testerIdHash !== input.testerIdHash
      || message.sessionId !== input.sessionId
      || message.privacy.category !== "general_non_sensitive"
      || !message.validation.pass
      || !message.provenanceHash) continue
    const provenance = provenanceByHash.get(message.provenanceHash)
    if (!provenance || provenance.privacy.category !== "general_non_sensitive") continue
    const state = createDnaS13ConversationState({
      sessionId: input.sessionId,
      question: provenance.question,
      normalizedQuestion: provenance.normalizedQuestion,
      responseDepth: provenance.queryFrame.responseDepth,
      queryFrame: provenance.queryFrame,
      plan: provenance.lockedContentPlan,
      validationPassed: true,
      privacyCategory: provenance.privacy.category,
    })
    if (state) return state
  }
  return null
}

export async function runDnaS13CanaryMessage(input: Readonly<{
  flags: DnaS13CanaryFlags
  sessionId: string
  testerIdHash: string
  question: string
  responseDepth: DnaS13Depth
  conversationTopicIds?: readonly string[]
  conversationState?: DnaS13ConversationState | null
  safetyIdentifier?: string | null
  messageId?: string
}>): Promise<DnaS13CanaryMessageRecord> {
  if (!input.flags.enabled || input.flags.productionBlocked) throw new Error("dna_s13_canary_disabled")
  const startedAt = performance.now()
  const sessionId = safeId(input.sessionId, "session_id")
  const messageId = safeId(input.messageId ?? randomUUID(), "message_id")
  const question = String(input.question || "").trim().slice(0, 600)
  if (question.length < 2) throw new Error("dna_s13_canary_question_invalid")
  const normalizedQuestion = normalizeDnaChatText(question)
  const privacy = inspectDnaS13CanaryPrivacy(question)
  if (!privacy.allowed) {
    await appendDnaS13CanaryPrivacyRejection(input.flags.outputRoot, {
      sessionId,
      messageId,
      createdAt: new Date().toISOString(),
      testerIdHash: input.testerIdHash,
      questionHash: hashDnaS13Artifact({ question }),
      reasonCodes: privacy.reasonCodes,
    })
    throw new DnaS13CanaryPrivacyError("Internal canary yalnız genel, bilimsel ve kişisel olmayan soruları kabul eder.")
  }

  const social = resolveDnaChatSocialConversation(question)
  if (social) {
    const record = unsupportedRecord({
      sessionId, messageId, testerIdHash: input.testerIdHash, question, normalizedQuestion,
      answer: social.summary, privacy: privacy.classification, intent: "social_product", startedAt,
    })
    await appendDnaS13CanaryMessage(input.flags.outputRoot, record)
    return record
  }

  const comparison = parseDnaS13CanaryComparison(question)
  const conversationState = input.conversationState ?? (comparison ? null : await storedConversationState({
    outputRoot: input.flags.outputRoot,
    sessionId,
    testerIdHash: input.testerIdHash,
  }))
  const contextResolution = comparison ? null : resolveDnaS13ConversationContext({
    sessionId,
    question,
    responseDepth: input.responseDepth,
    privacyAllowed: privacy.allowed,
    state: conversationState,
  })
  if (contextResolution?.operation === "clarification_required") {
    const record = unsupportedRecord({
      sessionId, messageId, testerIdHash: input.testerIdHash, question, normalizedQuestion,
      answer: NOT_AVAILABLE, privacy: privacy.classification, intent: "unsupported", startedAt,
      followUp: contextResolution.followUp,
      correction: contextResolution.correction,
    })
    await appendDnaS13CanaryMessage(input.flags.outputRoot, record)
    return record
  }
  const split = comparison
    ? { questions: comparison, exceedsLimit: false }
    : contextResolution?.targetTopicIds.length
      ? { questions: contextResolution.retrievalQuestions, exceedsLimit: false }
      : splitDnaV3Subquestions(question)
  const questions = split.questions.slice(0, 2)
  const matches = questions.map((subquestion, index) => {
    const targetTopicId = contextResolution?.targetTopicIds[index]
    return targetTopicId
      ? resolveDnaOwnerBookTopic(targetTopicId, subquestion, contextResolution?.responseDepth ?? input.responseDepth)
      : resolveDnaOwnerBook(subquestion, input.conversationTopicIds ?? [], input.responseDepth)
  })
  if (matches.some((match) => !match)) {
    const record = unsupportedRecord({
      sessionId, messageId, testerIdHash: input.testerIdHash, question, normalizedQuestion,
      answer: NOT_AVAILABLE, privacy: privacy.classification, intent: "unsupported", startedAt,
      followUp: contextResolution?.followUp,
      correction: contextResolution?.correction,
    })
    await appendDnaS13CanaryMessage(input.flags.outputRoot, record)
    return record
  }
  const resolvedMatches = matches as DnaOwnerBookMatch[]
  if (contextResolution && resolvedMatches.some((match) =>
    !dnaS13ContextOperationHasVerifiedSupport(contextResolution.operation, match))) {
    const record = unsupportedRecord({
      sessionId, messageId, testerIdHash: input.testerIdHash, question, normalizedQuestion,
      answer: NOT_AVAILABLE, privacy: privacy.classification, intent: "unsupported", startedAt,
      followUp: contextResolution.followUp,
      correction: contextResolution.correction,
    })
    await appendDnaS13CanaryMessage(input.flags.outputRoot, record)
    return record
  }
  const comparisonTargetTopicIds = comparison
    ? Object.freeze(resolvedMatches.map((match) => match.topicId))
    : Object.freeze([])
  const followUp = contextResolution?.followUp ?? false
  const correction = contextResolution?.correction ?? false
  const subquestions: DnaS13Subquestion[] = resolvedMatches.map((match, index) => {
    const kind = comparison ? "comparison" : classifyDnaV3QueryKind(question)
    return Object.freeze({
      id: `q${index + 1}`,
      question: questions[index] ?? question,
      intent: "scientific_question" as const,
      topicId: match.topicId,
      focus: focusFor(kind),
      questionType: comparison ? "comparison" as const : followUp ? "follow_up" as const : questionTypeFor(kind),
      followUp,
      correction,
      comparisonTargetTopicIds,
      answerabilityHint: "supported" as const,
    })
  })
  const frame: DnaS13QueryFrame = Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION,
    normalizedQuestion,
    responseDepth: contextResolution?.responseDepth ?? input.responseDepth,
    uncertain: split.exceedsLimit,
    subquestions: Object.freeze(subquestions),
  })
  const requiredClaimsBySubquestion = Object.fromEntries(subquestions.map((subquestion, index) => [
    subquestion.id,
    Object.freeze(claimsForMatch(resolvedMatches[index]!).slice(0, 1)),
  ]))
  const explanatoryCandidatesBySubquestion = Object.fromEntries(subquestions.map((subquestion, index) => [
    subquestion.id,
    claimsForMatch(resolvedMatches[index]!),
  ]))
  const plan = createDnaS13StrictPlan({ frame, requiredClaimsBySubquestion, explanatoryCandidatesBySubquestion })
  const status = getDnaOwnerBookRuntimeStatus()
  const result = await runDnaS13StrictRuntime({
    question,
    normalizedQuestion,
    queryFrame: frame,
    plan,
    realizer: realizerFor(input.flags, input.safetyIdentifier ?? null),
    catalog: Object.freeze({ version: status.retrievalVersion, hash: status.sourceSha256 }),
    retrieval: Object.freeze({
      version: status.retrievalVersion,
      hash: hashDnaS13Artifact({ questions, matches: resolvedMatches }),
    }),
    privacy: privacy.classification,
    trainingCandidateRequested: false,
  })
  const firstValidation = result.rejectedValidations[0]
  const attempts = result.attempts
  const isLuna = result.provenance.realizer.provider === "luna"
  const providerStatus = result.provenance.realizer.provider === "deterministic"
    ? "deterministic_only" as const
    : result.status
  const failureCodes = [...new Set([
    ...result.validation.failureCodes,
    ...result.rejectedValidations.flatMap((validation) => validation.failureCodes),
  ])]
  const comparisonSlots = plan.slots.filter((slot) => slot.kind === "comparison_side")
  const record: DnaS13CanaryMessageRecord = Object.freeze({
    schemaVersion: DNA_S13_CANARY_TELEMETRY_VERSION,
    architectureVersion: DNA_S13_CANARY_ARCHITECTURE_VERSION,
    architectureHash: DNA_S13_CANARY_ARCHITECTURE_HASH,
    sessionId,
    messageId,
    createdAt: new Date().toISOString(),
    testerIdHash: input.testerIdHash,
    question,
    normalizedQuestion,
    answer: result.answer,
    privacy: privacy.classification,
    routing: Object.freeze({
      intent: Object.freeze(subquestions.map((row) => row.intent)),
      detectedTopicIds: Object.freeze(subquestions.map((row) => row.topicId)),
      focus: Object.freeze(subquestions.map((row) => row.focus)),
      questionType: Object.freeze(subquestions.map((row) => row.questionType)),
      followUp,
      correction: subquestions.some((row) => row.correction),
      subquestionCount: subquestions.length,
      answerability: Object.freeze(subquestions.map((row) => row.answerabilityHint)),
      comparisonMode: plan.comparisonConclusionMode ?? null,
      parserUncertainty: frame.uncertain,
    }),
    retrieval: Object.freeze({
      candidateCount: resolvedMatches.reduce((sum, match) => sum + match.claimIds.length, 0),
      selectedRequiredClaimIds: result.provenance.requiredClaimIds,
      selectedExplanatoryClaimIds: result.provenance.explanatoryClaimIds,
      confidence: resolvedMatches.length ? Math.min(1, Math.max(0, Math.min(...resolvedMatches.map((match) => match.headingCoverage))) ) : null,
      contribution: Object.freeze({ lexical: 1, semantic: 0, graph: 0 }),
      comparisonSideACovered: comparisonSlots.length ? result.validation.comparisonSideASupported : null,
      comparisonSideBCovered: comparisonSlots.length ? result.validation.comparisonSideBSupported : null,
      missingRequiredSlotIds: Object.freeze(result.validation.pass ? [] : plan.slots
        .filter((slot) => !result.realization?.slotRealizations.some((entry) => entry.slotId === slot.id))
        .map((slot) => slot.id)),
    }),
    realization: Object.freeze({
      provider: result.provenance.realizer.provider,
      status: providerStatus,
      firstPassValidatorPassed: result.status === "realized" ? true : firstValidation ? false : null,
      repairValidatorPassed: result.status === "repaired" ? true : attempts.length > 1 ? false : null,
      inputTokens: result.provenance.usage.inputTokens,
      cachedInputTokens: result.provenance.usage.cachedInputTokens,
      outputTokens: result.provenance.usage.outputTokens,
      latencyMs: Math.max(0, performance.now() - startedAt),
      costMicrousd: result.provenance.costMicrousd,
      cache: result.provenance.usage.cachedInputTokens > 0 ? "hit" : isLuna ? "miss" : "not_applicable",
      lunaCalls: isLuna ? result.providerCalls : 0,
      repairCalls: result.providerCalls > 1 ? 1 : 0,
    }),
    validation: Object.freeze({
      pass: result.validation.pass,
      wrongClaimSubstitution: result.validation.wrongClaimSubstitutionCount,
      claimViolation: failureCodes.filter((code) => ["required_claim_missing", "locked_claim_missing", "wrong_claim_substitution"].includes(code)).length,
      relationViolation: result.validation.unsupportedRelationCount,
      comparisonConclusionViolation: failureCodes.filter((code) => code.startsWith("comparison_conclusion_")).length,
      unsupportedAddition: result.validation.unsupportedAdditionCount,
      sourceViolation: result.validation.sourceViolationCount,
      safetyViolation: result.validation.safetyViolationCount,
      failureCodes: Object.freeze(failureCodes),
    }),
    quality: EMPTY_DNA_S13_CANARY_QUALITY,
    training: Object.freeze({
      training_candidate: false,
      exclude_from_training: true,
      exclusion_reason: !privacy.classification.automaticTrainingAllowed ? "privacy_sensitive"
        : !result.validation.pass ? "validator_not_passed"
          : result.status === "deterministic_fallback" ? "fallback_or_rejected" : "review_pending",
    }),
    provenanceHash: result.provenance.provenanceHash,
    provenance: result.provenance,
  })
  await appendDnaS13CanaryMessage(input.flags.outputRoot, record)
  return record
}
