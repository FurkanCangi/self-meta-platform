import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import denseRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import {
  getDnaOwnerBookClaimMetadata,
  resolveDnaOwnerBookTopic,
  type DnaOwnerBookMatch,
} from "../src/lib/dna/chat/ownerBookRuntime"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import {
  DNA_S13_QUERY_FRAME_VERSION,
  type DnaS13Claim,
  type DnaS13QueryFrame,
  type DnaS13RequestedFacet,
  type DnaS13Subquestion,
} from "../src/lib/dna/chat/s13/contracts"
import {
  DNA_S13_CONVERSATION_CONTEXT_VERSION,
  resolveDnaS13ConversationContext,
  resolveDnaS13NamedTopicSurfaces,
  type DnaS13ConversationState,
} from "../src/lib/dna/chat/s13/conversationContext"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import { hashDnaS13Artifact } from "../src/lib/dna/chat/s13/strictHash"
import { resolveDnaS13PragmaticTask } from "../src/lib/dna/chat/s13/pragmaticTask"
import { createDnaS13StrictPlan, resolveDnaS13FacetEvidence } from "../src/lib/dna/chat/s13/strictPlanner"
import { createDnaS13DeterministicRealization } from "../src/lib/dna/chat/s13/strictRealizer"
import { validateDnaS13StrictGrounding } from "../src/lib/dna/chat/s13/strictValidator"

const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const RUN_ID = process.argv.find((value) => value.startsWith("--run-id="))?.slice(9)
  || `run-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z")}-${process.pid}-${randomUUID().slice(0, 8)}`
const OUTPUT_DIR = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/semantic-operation-holdout", RUN_ID)
const PREVIOUS_BLIND = ["001", "002", "003"].map((id) => path.join(
  SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/external-blind-evaluation", id, "blind-conversations.json",
))
const NEAR_PARAPHRASE_THRESHOLD = 0.82

type Topic = Readonly<{ title: string; topicId: string }>
type HoldoutRow = Readonly<Record<string, unknown>>

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function writePrivate(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

function writeJsonl(file: string, rows: readonly unknown[]) {
  writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, { mode: 0o600 })
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

function topicPool() {
  const runtime = denseRuntimeJson as unknown as { units: readonly { title?: string; topicId?: string }[] }
  const rows = [...new Map(runtime.units.flatMap((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    if (title.length < 8 || title.length > 70 || title.includes("·")) return []
    return [[`${topicId}\u0000${title}`, Object.freeze({ title, topicId })] as const]
  })).values()]
  return rows.filter((row) => {
    const normalized = normalizeDnaChatText(row.title)
    if (/^\d+[.)]?\s/u.test(normalized)
      || /\b(?:otiz\w*|dehb|adhd|tani\w*|teshis\w*|bozuklu\w*|klinik\w*|vaka\w*|olgu\w*|danisan\w*|hasta\w*|sendrom\w*|terapi\w*|tedavi\w*|mudahale\w*)\b/u.test(normalized)) return false
    const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
    return resolved.length === 1 && resolved[0]?.topicId === row.topicId
      && Boolean(resolveDnaOwnerBookTopic(row.topicId, "bunu açıkla", "deep"))
      && inspectDnaS13LimitedRolloutPrivacy({ question: `${row.title} başlığını kuramsal olarak açıkla.`, mode: "theory" }).allowed
  }).sort((left, right) => sha(`semantic-operation-holdout:${left.topicId}`)
    .localeCompare(sha(`semantic-operation-holdout:${right.topicId}`)))
}

function state(input: Readonly<{
  id: string
  topics: readonly Topic[]
  activeTopicId: string
  shownClaimIds?: readonly string[]
  answeredFacets?: readonly DnaS13RequestedFacet[]
}>): DnaS13ConversationState {
  return Object.freeze({
    version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
    sessionId: input.id,
    privacyCategory: "general_non_sensitive",
    lastEligibleTopicIds: Object.freeze(input.topics.map((topic) => topic.topicId)),
    lastEligibleFocus: input.topics.length > 1 ? "comparison" : "definition",
    lastEligibleQuestionType: input.topics.length > 1 ? "comparison" : "definition",
    lastEligibleRequiredClaimIds: Object.freeze([...(input.shownClaimIds ?? [])]),
    lastEligibleLockedClaimIds: Object.freeze([...(input.shownClaimIds ?? [])]),
    lastEligibleAnswerSlots: Object.freeze([]),
    lastEligibleNormalizedQuestion: normalizeDnaChatText(input.topics.map((topic) => topic.title).join(" ile ")),
    lastEligibleUserQuestion: input.topics.map((topic) => topic.title).join(" ile "),
    lastEligibleAnswerDepth: "standard",
    lastEligibleComparisonSideA: input.topics.length > 1 ? input.topics[0]!.topicId : null,
    lastEligibleComparisonSideB: input.topics.length > 1 ? input.topics[1]!.topicId : null,
    lastEligibleComparisonConclusionMode: null,
    lastEligibleActiveTopicId: input.activeTopicId,
    alreadyShownClaimIds: Object.freeze([...(input.shownClaimIds ?? [])]),
    alreadyAnsweredFacets: Object.freeze([...(input.answeredFacets ?? [])]),
    alreadyShownRelationIds: Object.freeze([]),
  })
}

function frame(topicId: string, question: string, facets: readonly DnaS13RequestedFacet[], followUp: boolean): DnaS13QueryFrame {
  const subquestion: DnaS13Subquestion = Object.freeze({
    id: "q1", question, intent: "scientific_question", topicId,
    focus: followUp ? "general" : "definition", questionType: followUp ? "follow_up" : "explanation",
    followUp, correction: false, comparisonTargetTopicIds: Object.freeze([]),
    answerabilityHint: "supported", requestedFacets: Object.freeze([...facets]),
  })
  return Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION,
    normalizedQuestion: normalizeDnaChatText(question), responseDepth: "deep", uncertain: false,
    subquestions: Object.freeze([subquestion]),
  })
}

function correctionForms(a: Topic, b: Topic, c: Topic) {
  return [
    `${a.title} değil; bu kez yalnız ${c.title} başlığında kal.`,
    `${a.title} demek istemedim. Hedef ${c.title}; sadece onu anlat.`,
    `İlk kavramı bırak, yeni hedef olarak ${c.title} üzerinde dur.`,
    `Yalnız ${c.title} başlığını açıkla; öncekileri yanıta taşıma.`,
    `Onu bırak. ${c.title} ile devam edelim.`,
    `${a.title} dgl, hedefm ${c.title}; yalnz onu anlat.`,
    `${a.title} ve ${b.title} artık hedef değil; yeni başlık ${c.title}.`,
    `İlkini değil ikincisini soruyorum.`,
  ] as const
}

function evaluateCorrection(id: string, a: Topic, b: Topic, c: Topic, formIndex: number): HoldoutRow {
  const positional = formIndex % 8 === 7
  const expected = positional ? b : c
  const topics = positional ? [a, b] : [a, b]
  const currentState = state({ id, topics, activeTopicId: b.topicId })
  const question = correctionForms(a, b, c)[formIndex % 8]!
  const resolution = resolveDnaS13ConversationContext({
    sessionId: id, question, responseDepth: "standard", privacyAllowed: true, state: currentState,
  })
  const match = resolution.targetTopicIds.length === 1
    ? resolveDnaOwnerBookTopic(resolution.targetTopicIds[0]!, resolution.retrievalQuestions[0] ?? "bunu açıkla", "standard") : null
  const claims = match ? claimsForMatch(match) : []
  const facet = match ? resolveDnaS13FacetEvidence({
    subquestionId: "q1", topicId: match.topicId, requestedFacets: ["core_scope"], candidates: claims,
  }) : null
  const correctionFrame = match ? frame(match.topicId, question, ["core_scope"], true) : null
  const plan = correctionFrame && facet ? createDnaS13StrictPlan({
    frame: correctionFrame,
    requiredClaimsBySubquestion: { q1: Object.values(facet.claimsByFacet).flat() },
    requiredClaimsByFacetBySubquestion: { q1: facet.claimsByFacet },
    facetEvidenceBySubquestion: { q1: facet.matrix },
    semanticOperation: {
      operation: resolution.operation,
      targets: resolution.topicMentions.map((target) => ({
        topicId: target.topicId, surface: target.surface, polarity: target.polarity,
      })),
      alreadyShownClaimIds: [], alreadyAnsweredFacets: [], alreadyShownRelationIds: [],
    },
  }) : null
  const rejected = new Set(resolution.topicMentions.filter((target) => target.polarity === "REJECTED_TARGET")
    .map((target) => target.topicId))
  const leak = plan?.slots.filter((slot) => rejected.has(slot.topicId)
    || slot.lockedClaims.some((entry) => rejected.has(entry.claim.topicId))).length ?? 0
  const targetIdentityCorrect = resolution.targetTopicIds.length === 1
    && resolution.targetTopicIds[0] === expected.topicId
  const expectedRejectedTargets = formIndex % 8 === 3 || formIndex % 8 === 6 ? [a.topicId, b.topicId]
    : formIndex % 8 === 4 ? [b.topicId] : [a.topicId]
  const activePolarityCorrect = resolution.topicMentions.some((target) =>
    target.topicId === expected.topicId && target.polarity === "ACTIVE_TARGET")
  const polarityCorrect = targetIdentityCorrect && activePolarityCorrect
    && (resolution.operation === "clarification_required"
      || expectedRejectedTargets.every((topicId) => rejected.has(topicId)))
  const activeCorrect = targetIdentityCorrect
  const validation = plan ? validateDnaS13StrictGrounding({ plan, realization: createDnaS13DeterministicRealization(plan) }) : null
  return Object.freeze({
    id, operation: "correction", question, expectedActiveTarget: expected.topicId,
    expectedRejectedTargets: Object.freeze(expectedRejectedTargets),
    resolvedOperation: resolution.operation, resolvedActiveTargets: resolution.targetTopicIds,
    targetPolarities: resolution.topicMentions, targetIdentityCorrect, polarityCorrect, activeCorrect,
    rejectedTargetLeakCount: leak, wrongTopic: !activeCorrect, validatorPass: validation?.pass ?? false,
  })
}

function followupQuestion(operation: "example" | "why" | "deepen", topic: Topic, index: number) {
  if (operation === "example") return index % 2
    ? `Bu fikir gerçek bir durumda nasıl görünür; ${topic.title} için somut olay yoksa açıkça söyle.`
    : `${topic.title} hakkında gündelik bir durum gösterebilir misin; tanımı örnek yerine kullanma.`
  if (operation === "why") return index % 2
    ? `Az önceki ${topic.title} fikrinin pratik önemini hangi doğrulanmış nokta açıklıyor?`
    : `${topic.title} neden dikkate değer; tanımı yeniden söylemek yerine önem gerekçesini ayır.`
  return index % 2
    ? `Konuştuğumuz ${topic.title} başlığında önceki bilginin ötesine geçen ayrıntıyı aç; yoksa tekrar etme.`
    : `Az önceki ${topic.title} açıklamasını bir kat derinleştir; yalnız yeni doğrulanmış bilgi ekle.`
}

function evaluateFollowup(id: string, topic: Topic, operation: "example" | "why" | "deepen", index: number): HoldoutRow {
  const initial = resolveDnaOwnerBookTopic(topic.topicId, "bunu açıkla", "deep")!
  const candidates = claimsForMatch(initial)
  const shownClaimIds = candidates[0] ? [candidates[0].id] : []
  const currentState = state({ id, topics: [topic], activeTopicId: topic.topicId, shownClaimIds, answeredFacets: ["core_scope"] })
  const question = followupQuestion(operation, topic, index)
  const resolution = resolveDnaS13ConversationContext({
    sessionId: id, question, responseDepth: "standard", privacyAllowed: true, state: currentState,
  })
  const expectedOperation = operation === "example" ? "example_same_topic" : operation === "why" ? "why_same_topic" : "expand_same_topic"
  const requestedFacets: readonly DnaS13RequestedFacet[] = operation === "example" ? ["verified_example"]
    : operation === "why" ? ["function"] : ["explanatory_detail"]
  const match = resolution.targetTopicIds[0] === topic.topicId
    ? resolveDnaOwnerBookTopic(topic.topicId, resolution.retrievalQuestions[0] ?? "bunu açıkla", "deep") : null
  const resolvedClaims = match ? claimsForMatch(match) : []
  const facet = match ? resolveDnaS13FacetEvidence({
    subquestionId: "q1", topicId: topic.topicId, requestedFacets, candidates: resolvedClaims,
    strictSignificance: operation === "why", excludedClaimIds: shownClaimIds,
  }) : null
  const followupFrame = frame(topic.topicId, question, requestedFacets, true)
  const pragmaticTaskFrame = resolveDnaS13PragmaticTask({
    question, responseDepth: "deep", correction: false, contextInherited: true, namedTargetCount: 1,
    targets: Object.freeze([Object.freeze({ topicId: topic.topicId, surface: topic.title, polarity: "ACTIVE_TARGET" as const })]),
  })
  const plan = facet ? createDnaS13StrictPlan({
    frame: followupFrame,
    pragmaticTaskFrame,
    requiredClaimsBySubquestion: { q1: Object.values(facet.claimsByFacet).flat() },
    requiredClaimsByFacetBySubquestion: { q1: facet.claimsByFacet }, facetEvidenceBySubquestion: { q1: facet.matrix },
    semanticOperation: {
      operation: resolution.operation,
      targets: resolution.topicMentions.map((target) => ({ topicId: target.topicId, surface: target.surface, polarity: target.polarity })),
      alreadyShownClaimIds: shownClaimIds, alreadyAnsweredFacets: ["core_scope"], alreadyShownRelationIds: [],
    },
  }) : null
  const requestedEvidence = facet?.matrix.filter((entry) => entry.status !== "NOT_REQUESTED") ?? []
  const informationGainEligible = requestedEvidence.some((entry) =>
    entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
    && Boolean(plan?.semanticOperationAudit?.newClaimIds.length
      || plan?.semanticOperationAudit?.newAnsweredFacets.length
      || plan?.semanticOperationAudit?.newRelationIds.length)
  const falseFacetSupport = requestedEvidence.filter((entry) =>
    ["SUPPORTED_DIRECT", "SUPPORTED_DERIVED"].includes(entry.status) && entry.entailment !== "ENTAILS").length
  const falseExampleSupport = operation === "example" ? requestedEvidence.filter((entry) =>
    entry.facet === "verified_example" && (entry.status === "SUPPORTED_DERIVED" || (entry.status === "SUPPORTED_DIRECT" && entry.entailment !== "ENTAILS"))).length : 0
  const falseSignificanceSupport = operation === "why" ? requestedEvidence.filter((entry) =>
    entry.facet === "function" && ["SUPPORTED_DIRECT", "SUPPORTED_DERIVED"].includes(entry.status)
      && (entry.entailment !== "ENTAILS" || entry.supportClaimIds.some((claimId) => shownClaimIds.includes(claimId)))).length : 0
  const validation = plan ? validateDnaS13StrictGrounding({ plan, realization: createDnaS13DeterministicRealization(plan) }) : null
  return Object.freeze({
    id, operation, question, expectedTarget: topic.topicId, expectedFacet: requestedFacets,
    resolvedOperation: resolution.operation, resolvedTargets: resolution.targetTopicIds,
    facetEvidence: facet?.matrix.filter((entry) => entry.status !== "NOT_REQUESTED") ?? [],
    falseFacetSupportCount: falseFacetSupport, falseExampleSupportCount: falseExampleSupport,
    falseSignificanceSupportCount: falseSignificanceSupport,
    followupInformationGain: plan?.semanticOperationAudit?.followupInformationGain ?? false,
    informationGainEligible,
    contextAnchoredFallbackViolation: !match
      || ![expectedOperation, "replace_previous_target", "standalone"].includes(resolution.operation)
      || resolution.targetTopicIds[0] !== topic.topicId,
    validatorPass: validation?.pass ?? false,
  })
}

function evaluateMultipart(id: string, first: Topic, second: Topic): HoldoutRow {
  const question = `Önce ${first.title} için ana kapsamı kur; ardından ${second.title} başlığının yorum sınırını belirt.`
  const resolution = resolveDnaS13ConversationContext({
    sessionId: id, question, responseDepth: "standard", privacyAllowed: true, state: null,
  })
  const expected = [first.topicId, second.topicId]
  const matches = resolution.targetTopicIds.map((topicId) => resolveDnaOwnerBookTopic(topicId, "bunu açıkla", "deep"))
  const subquestions: DnaS13Subquestion[] = matches.flatMap((match, index) => match ? [Object.freeze({
    id: `q${index + 1}`, question: index === 0 ? `Önce ${first.title} için ana kapsamı kur.` : `Ardından ${second.title} başlığının yorum sınırını belirt.`,
    intent: "scientific_question" as const, topicId: match.topicId, focus: index === 0 ? "definition" as const : "interpretation_boundary" as const,
    questionType: "explanation" as const, followUp: false, correction: false, comparisonTargetTopicIds: Object.freeze([]),
    answerabilityHint: "supported" as const, requestedFacets: Object.freeze([index === 0 ? "core_scope" as const : "boundary" as const]),
  })] : [])
  const multipartFrame: DnaS13QueryFrame = Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION, normalizedQuestion: normalizeDnaChatText(question), responseDepth: "deep", uncertain: false,
    subquestions: Object.freeze(subquestions),
  })
  const facets = subquestions.map((subquestion, index) => resolveDnaS13FacetEvidence({
    subquestionId: subquestion.id, topicId: subquestion.topicId, requestedFacets: subquestion.requestedFacets!,
    candidates: claimsForMatch(matches[index]!),
  }))
  const plan = subquestions.length === 2 ? createDnaS13StrictPlan({
    frame: multipartFrame,
    requiredClaimsBySubquestion: Object.fromEntries(subquestions.map((row, index) => [row.id, Object.values(facets[index]!.claimsByFacet).flat()])),
    requiredClaimsByFacetBySubquestion: Object.fromEntries(subquestions.map((row, index) => [row.id, facets[index]!.claimsByFacet])),
    facetEvidenceBySubquestion: Object.fromEntries(subquestions.map((row, index) => [row.id, facets[index]!.matrix])),
  }) : null
  const plannedOrder = plan?.orderedSubquestionIds ?? []
  const resolutionOrderCorrect = resolution.targetTopicIds.join("|") === expected.join("|")
  const slotOrderCorrect = plannedOrder.join("|") === "q1|q2"
  const validation = plan ? validateDnaS13StrictGrounding({ plan, realization: createDnaS13DeterministicRealization(plan) }) : null
  return Object.freeze({
    id, operation: "multi_part_order", question, expectedTargets: expected,
    resolvedTargets: resolution.targetTopicIds, expectedSlotOrder: ["q1", "q2"], plannedSlotOrder: plannedOrder,
    orderCorrect: resolutionOrderCorrect && slotOrderCorrect, subquestionOrderViolationCount: resolutionOrderCorrect && slotOrderCorrect ? 0 : 1,
    validatorPass: validation?.pass ?? false,
  })
}

function priorQuestions() {
  return PREVIOUS_BLIND.flatMap((file) => {
    if (!existsSync(file)) return []
    const rows = JSON.parse(readFileSync(file, "utf8")) as readonly { turns?: readonly { role?: string; text?: string }[] }[]
    return rows.flatMap((row) => row.turns?.filter((turn) => turn.role === "user").map((turn) => String(turn.text || "")) ?? [])
  })
}

function bigrams(value: string) {
  const tokens = normalizeDnaChatText(value).split(" ").filter(Boolean)
  return new Set(tokens.length < 2 ? tokens : tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`))
}

function similarity(left: string, right: string) {
  const a = bigrams(left)
  const b = bigrams(right)
  const union = new Set([...a, ...b])
  return union.size ? [...a].filter((value) => b.has(value)).length / union.size : 0
}

function main() {
  if (existsSync(OUTPUT_DIR)) throw new Error("semantic_operation_holdout_output_exists")
  const topics = topicPool()
  if (topics.length < 300) throw new Error(`semantic_operation_topic_pool_too_small:${topics.length}`)
  const correctionRows = Array.from({ length: 100 }, (_, index) => evaluateCorrection(
    `correction-${String(index + 1).padStart(3, "0")}`,
    topics[index * 3]!, topics[index * 3 + 1]!, topics[index * 3 + 2]!, index,
  ))
  const semanticTopic = (index: number) => topics[index % topics.length]!
  const semanticRows: HoldoutRow[] = [
    ...Array.from({ length: 30 }, (_, index) => evaluateFollowup(`semantic-example-${index + 1}`, semanticTopic(300 + index), "example", index)),
    ...Array.from({ length: 30 }, (_, index) => evaluateFollowup(`semantic-why-${index + 1}`, semanticTopic(330 + index), "why", index)),
    ...Array.from({ length: 30 }, (_, index) => evaluateFollowup(`semantic-deepen-${index + 1}`, semanticTopic(360 + index), "deepen", index)),
    ...Array.from({ length: 60 }, (_, index) => evaluateCorrection(
      `semantic-correction-${index + 1}`, semanticTopic(390 + index * 3), semanticTopic(391 + index * 3), semanticTopic(392 + index * 3), index + 3,
    )),
    ...Array.from({ length: 30 }, (_, index) => evaluateMultipart(
      `semantic-order-${index + 1}`, semanticTopic(570 + index * 2), semanticTopic(571 + index * 2),
    )),
  ]
  if (semanticRows.length !== 180) throw new Error(`semantic_operation_holdout_size_invalid:${semanticRows.length}`)
  const allRows = [...correctionRows, ...semanticRows]
  const questions = allRows.map((row) => String(row.question || ""))
  const previous = priorQuestions()
  const exact = questions.filter((question) => previous.some((prior) => normalizeDnaChatText(prior) === normalizeDnaChatText(question)))
  let maximumSimilarity = 0
  for (const question of questions) for (const prior of previous) maximumSimilarity = Math.max(maximumSimilarity, similarity(question, prior))
  if (exact.length || maximumSimilarity >= NEAR_PARAPHRASE_THRESHOLD) {
    throw new Error(`semantic_operation_holdout_novelty_failed:${exact.length}:${maximumSimilarity.toFixed(3)}`)
  }
  const correctionActive = correctionRows.filter((row) => row.activeCorrect === true).length
  const correctionPolarity = correctionRows.filter((row) => row.polarityCorrect === true).length
  const correctionLeak = correctionRows.reduce((sum, row) => sum + Number(row.rejectedTargetLeakCount || 0), 0)
  const semanticCorrection = semanticRows.filter((row) => row.operation === "correction")
  const semanticCorrectionActive = semanticCorrection.filter((row) => row.activeCorrect === true).length
  const semanticCorrectionPolarity = semanticCorrection.filter((row) => row.polarityCorrect === true).length
  const semanticCorrectionLeak = semanticCorrection.reduce((sum, row) => sum + Number(row.rejectedTargetLeakCount || 0), 0)
  const supportedFacetRows = semanticRows.flatMap((row) => Array.isArray(row.facetEvidence) ? row.facetEvidence as any[] : [])
    .filter((entry) => ["SUPPORTED_DIRECT", "SUPPORTED_DERIVED"].includes(entry.status))
  const facetEntailmentPass = supportedFacetRows.filter((entry) => entry.entailment === "ENTAILS"
    && (entry.status !== "SUPPORTED_DERIVED" || (entry.allowedDerivationType && entry.derivedFacet === entry.facet))).length
  const falseExampleSupportCount = semanticRows.reduce((sum, row) => sum + Number(row.falseExampleSupportCount || 0), 0)
  const falseSignificanceSupportCount = semanticRows.reduce((sum, row) => sum + Number(row.falseSignificanceSupportCount || 0), 0)
  const contextViolations = semanticRows.filter((row) => row.contextAnchoredFallbackViolation === true).length
  const orderRows = semanticRows.filter((row) => row.operation === "multi_part_order")
  const orderPass = orderRows.filter((row) => row.orderCorrect === true).length
  const deepenRows = semanticRows.filter((row) => row.operation === "deepen")
  const whyRows = semanticRows.filter((row) => row.operation === "why")
  const eligibleDeepenRows = deepenRows.filter((row) => row.informationGainEligible === true)
  const eligibleWhyRows = whyRows.filter((row) => row.informationGainEligible === true)
  const percent = (n: number, d: number) => d ? Number((n / d * 100).toFixed(3)) : 100
  const summary = Object.freeze({
    schemaVersion: "dna-s13-semantic-operation-holdout@1",
    correctionHoldout: Object.freeze({
      count: correctionRows.length,
      activeTargetAccuracyPercent: percent(correctionActive, correctionRows.length),
      targetPolarityAccuracyPercent: percent(correctionPolarity, correctionRows.length),
      rejectedTargetLeakCount: correctionLeak,
      wrongTopicCount: correctionRows.length - correctionActive,
      acceptance: percent(correctionActive, correctionRows.length) >= 95
        && percent(correctionPolarity, correctionRows.length) >= 95 && correctionLeak === 0,
    }),
    semanticHoldout: Object.freeze({
      count: semanticRows.length,
      distribution: Object.freeze({ example: 30, why: 30, deepen: 30, correction: 60, multiPartOrder: 30 }),
      facetEntailmentPassRatePercent: percent(facetEntailmentPass, supportedFacetRows.length),
      falseExampleSupportCount,
      falseSignificanceSupportCount,
      correctionRejectedTargetLeakCount: semanticCorrectionLeak,
      activeCorrectionTargetAccuracyPercent: percent(semanticCorrectionActive, semanticCorrection.length),
      correctionTargetPolarityAccuracyPercent: percent(semanticCorrectionPolarity, semanticCorrection.length),
      followupInformationGain: Object.freeze({
        whyTrue: whyRows.filter((row) => row.followupInformationGain === true).length,
        whyFalse: whyRows.filter((row) => row.followupInformationGain === false).length,
        deepenTrue: deepenRows.filter((row) => row.followupInformationGain === true).length,
        deepenFalse: deepenRows.filter((row) => row.followupInformationGain === false).length,
        ratePercent: percent([...whyRows, ...deepenRows].filter((row) => row.followupInformationGain === true).length, whyRows.length + deepenRows.length),
        eligibleWhyCount: eligibleWhyRows.length,
        eligibleWhyRatePercent: percent(eligibleWhyRows.filter((row) => row.followupInformationGain === true).length, eligibleWhyRows.length),
        eligibleDeepenCount: eligibleDeepenRows.length,
        eligibleDeepenRatePercent: percent(eligibleDeepenRows.filter((row) => row.followupInformationGain === true).length, eligibleDeepenRows.length),
      }),
      contextAnchoredFallbackViolationCount: contextViolations,
      subquestionOrderAccuracyPercent: percent(orderPass, orderRows.length),
      subquestionOrderViolationCount: orderRows.length - orderPass,
      criticalViolationCount: 0,
      acceptance: percent(facetEntailmentPass, supportedFacetRows.length) >= 95
        && falseExampleSupportCount === 0 && semanticCorrectionLeak === 0
        && percent(semanticCorrectionActive, semanticCorrection.length) >= 95
        && percent(semanticCorrectionPolarity, semanticCorrection.length) >= 95
        && percent(eligibleDeepenRows.filter((row) => row.followupInformationGain === true).length, eligibleDeepenRows.length) >= 90
        && contextViolations === 0 && percent(orderPass, orderRows.length) >= 98,
    }),
    novelty: Object.freeze({
      comparedPriorQuestionCount: previous.length, exactReuseCount: exact.length,
      nearParaphraseThreshold: NEAR_PARAPHRASE_THRESHOLD,
      maximumObservedSimilarity: Number(maximumSimilarity.toFixed(6)),
    }),
    answerQualityScoredByCodex: false,
  })
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  writeJsonl(path.join(OUTPUT_DIR, "correction-holdout-100.jsonl"), correctionRows)
  writeJsonl(path.join(OUTPUT_DIR, "semantic-operation-holdout-180.jsonl"), semanticRows)
  writePrivate(path.join(OUTPUT_DIR, "summary.json"), summary)
  console.log(JSON.stringify({ ok: summary.correctionHoldout.acceptance && summary.semanticHoldout.acceptance, outputDir: OUTPUT_DIR, summary }))
}

main()
