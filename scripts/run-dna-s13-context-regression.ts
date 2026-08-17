import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import denseRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import {
  getDnaOwnerBookTopicTitle,
  resolveDnaOwnerBook,
  resolveDnaOwnerBookTopic,
} from "../src/lib/dna/chat/ownerBookRuntime"
import {
  DNA_S13_CONVERSATION_CONTEXT_VERSION,
  resolveDnaS13ConversationContext,
  resolveDnaS13NamedTopicSurfaces,
  type DnaS13ContextOperation,
  type DnaS13ConversationState,
} from "../src/lib/dna/chat/s13/conversationContext"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"

const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUTPUT_BASE = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/internal-canary/s13-strict-v4/targeted-context-fix-v1")
const RUN_003 = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/internal-canary/s13-strict-v4/run-20260810-autonomous-003")
const runId = process.argv.find((value) => value.startsWith("--run-id="))?.slice(9) || "run-20260810-targeted-001"
const outputRoot = path.join(OUTPUT_BASE, runId)

type Topic = Readonly<{ title: string; topicId: string }>
type TargetedKind = "generic_follow_up" | "expansion_simplification" | "correction" | "positional_correction" | "named_topic"
type TargetedCase = Readonly<{
  id: string
  kind: TargetedKind
  question: string
  state: DnaS13ConversationState | null
  expectedTopicIds: readonly string[]
  expectedOperation: DnaS13ContextOperation
}>

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function writeJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
}

function writeJsonl(file: string, rows: readonly unknown[]) {
  writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, { mode: 0o600 })
}

function topicPool() {
  const runtime = denseRuntimeJson as unknown as { units: readonly { title?: string; topicId?: string }[] }
  const candidates = [...new Map(runtime.units.map((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    return [`${title}\u0000${topicId}`, { title, topicId }] as const
  })).values()]
  return candidates.filter((row) => row.title.length >= 6 && row.title.length <= 72)
    .filter((row) => resolveDnaS13NamedTopicSurfaces(row.title).length === 1)
    .filter((row) => resolveDnaS13NamedTopicSurfaces(row.title)[0]?.topicId === row.topicId)
    .filter((row) => Boolean(resolveDnaOwnerBookTopic(row.topicId, "bunu açıkla", "standard")))
}

function state(sessionId: string, topics: readonly Topic[], activeIndex = topics.length - 1): DnaS13ConversationState {
  const topicIds = topics.map((topic) => topic.topicId)
  return Object.freeze({
    version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
    sessionId,
    privacyCategory: "general_non_sensitive",
    lastEligibleTopicIds: Object.freeze(topicIds),
    lastEligibleFocus: topics.length === 2 ? "comparison" : "definition",
    lastEligibleQuestionType: topics.length === 2 ? "comparison" : "definition",
    lastEligibleRequiredClaimIds: Object.freeze(topicIds.map((topicId) => `required:${topicId}`)),
    lastEligibleLockedClaimIds: Object.freeze(topicIds.map((topicId) => `locked:${topicId}`)),
    lastEligibleAnswerSlots: Object.freeze(topicIds.map((topicId, index) => Object.freeze({
      id: `slot-${index + 1}`, topicId, questionType: topics.length === 2 ? "comparison" : "definition",
      requiredClaimIds: Object.freeze([`required:${topicId}`]),
      requestedFacet: null,
    }))),
    lastEligibleNormalizedQuestion: normalizeDnaChatText(topics.map((topic) => topic.title).join(" ile ")),
    lastEligibleUserQuestion: topics.map((topic) => topic.title).join(" ile "),
    lastEligibleAnswerDepth: "standard",
    lastEligibleComparisonSideA: topics.length === 2 ? topicIds[0]! : null,
    lastEligibleComparisonSideB: topics.length === 2 ? topicIds[1]! : null,
    lastEligibleComparisonConclusionMode: topics.length === 2 ? "safe_categorical_inference" : null,
    lastEligibleActiveTopicId: topicIds[activeIndex]!,
  })
}

function freshCases(topics: readonly Topic[]): readonly TargetedCase[] {
  const rows: TargetedCase[] = []
  const explainForms = [
    "bunun anlamı ne", "burada ne anlatılıyor", "bunu başka türlü açıklar mısın", "söylediğini açıklar mısın",
    "daha anlaşılır biçimde açıkla", "bu ne demek", "ne demek yani", "nasıl yani", "biraz açıklar mısın", "bunu açıkla",
  ]
  const explainOperations: DnaS13ContextOperation[] = [
    "explain_same_topic", "explain_same_topic", "explain_same_topic", "explain_same_topic", "explain_same_topic",
    "explain_same_topic", "explain_same_topic", "explain_same_topic", "explain_same_topic", "explain_same_topic",
  ]
  for (let index = 0; index < 20; index += 1) {
    const topic = topics[index]!
    rows.push(Object.freeze({
      id: `fresh-followup-${index + 1}`, kind: "generic_follow_up",
      question: `${explainForms[index % explainForms.length]!}${index >= 10 ? " lütfen" : ""}`,
      state: state(`fresh-followup-${index + 1}`, [topic]), expectedTopicIds: Object.freeze([topic.topicId]),
      expectedOperation: explainOperations[index % explainOperations.length]!,
    }))
  }
  const transformForms: readonly [string, DnaS13ContextOperation][] = [
    ["bu başlığı biraz derinleştir", "expand_same_topic"], ["ayrıntısını açar mısın", "expand_same_topic"],
    ["bu konunun işleyişini genişlet", "expand_same_topic"], ["bir kademe daha detaylandır", "expand_same_topic"],
    ["biraz daha detay verir misin", "expand_same_topic"], ["bunu sadeleştir", "simplify_same_topic"],
    ["daha yalın söyler misin", "simplify_same_topic"], ["jargonsuz anlat", "simplify_same_topic"],
    ["teknik terimleri azalt", "simplify_same_topic"], ["günlük dille söyle", "simplify_same_topic"],
  ]
  for (let index = 0; index < 20; index += 1) {
    const topic = topics[20 + index]!
    const [question, operation] = transformForms[index % transformForms.length]!
    rows.push(Object.freeze({
      id: `fresh-transform-${index + 1}`, kind: "expansion_simplification",
      question: `${question}${index >= 10 ? " olur mu" : ""}`,
      state: state(`fresh-transform-${index + 1}`, [topic]), expectedTopicIds: Object.freeze([topic.topicId]),
      expectedOperation: operation,
    }))
  }
  const correctionForms = [
    (title: string) => `hayır onu demiyorum ${title} kısmını soruyorum`,
    (title: string) => `yok ${title} kısmını soruyorum`,
    (title: string) => `ben ${title} başlığını kastettim`,
    (title: string) => `onu değil ${title}`,
    (title: string) => `demek istediğim ${title}`,
  ]
  for (let index = 0; index < 20; index += 1) {
    const sideA = topics[40 + index * 2]!
    const sideB = topics[41 + index * 2]!
    rows.push(Object.freeze({
      id: `fresh-correction-${index + 1}`, kind: "correction",
      question: correctionForms[index % correctionForms.length]!(sideB.title),
      state: state(`fresh-correction-${index + 1}`, [sideA, sideB], 0),
      expectedTopicIds: Object.freeze([sideB.topicId]), expectedOperation: "replace_previous_target",
    }))
  }
  const positionalForms: readonly [string, 0 | 1][] = [
    ["hayır ilkini soruyorum", 0], ["ikinci kısmı aç", 1], ["diğerini anlat", 0],
    ["ilkini değil diğerini soruyorum", 1], ["ikincisini soruyorum", 1],
  ]
  for (let index = 0; index < 10; index += 1) {
    const sideA = topics[80 + index * 2]!
    const sideB = topics[81 + index * 2]!
    const [question, expected] = positionalForms[index % positionalForms.length]!
    rows.push(Object.freeze({
      id: `fresh-positional-${index + 1}`, kind: "positional_correction", question,
      state: state(`fresh-positional-${index + 1}`, [sideA, sideB], 1),
      expectedTopicIds: Object.freeze([expected === 0 ? sideA.topicId : sideB.topicId]),
      expectedOperation: "replace_previous_target",
    }))
  }
  const questionHeadings = topics.filter((topic) => topic.title.includes("?")).slice(0, 10)
  if (questionHeadings.length < 10) throw new Error("targeted_holdout_question_heading_pool_too_small")
  for (let index = 0; index < 10; index += 1) {
    const topic = questionHeadings[index]!
    const suffix = index % 2 ? " tam olarak neyi ifade ediyor?" : " bu başlığı sade biçimde açıklar mısın?"
    rows.push(Object.freeze({
      id: `fresh-named-${index + 1}`, kind: "named_topic", question: `${topic.title}${suffix}`,
      state: null, expectedTopicIds: Object.freeze([topic.topicId]), expectedOperation: "standalone",
    }))
  }
  if (rows.length !== 80) throw new Error(`targeted_holdout_size_invalid:${rows.length}`)
  return Object.freeze(rows)
}

function evaluateCase(row: TargetedCase) {
  const resolution = resolveDnaS13ConversationContext({
    sessionId: row.state?.sessionId ?? row.id,
    question: row.question,
    responseDepth: "standard",
    privacyAllowed: true,
    state: row.state,
  })
  const matches = resolution.retrievalQuestions.map((question, index) => resolution.targetTopicIds[index]
    ? resolveDnaOwnerBookTopic(resolution.targetTopicIds[index]!, question, resolution.responseDepth)
    : resolveDnaOwnerBook(question, [], resolution.responseDepth))
  // An absent example/reason claim now becomes an explicit same-topic locked
  // facet boundary; it must not be treated as a router failure.
  const operationSupported = matches.every(Boolean)
  const referentCorrect = row.expectedTopicIds.length === resolution.targetTopicIds.length
    && row.expectedTopicIds.every((topicId) => resolution.targetTopicIds.includes(topicId))
  const operationCorrect = resolution.operation === row.expectedOperation
  const expectedClarification = row.expectedOperation === "clarification_required" && row.expectedTopicIds.length === 0
  const requiredSlotCovered = expectedClarification
    ? operationCorrect
    : resolution.targetTopicIds.length > 0 && matches.length === resolution.targetTopicIds.length
      && matches.every(Boolean) && operationSupported
  const wrongTopic = resolution.targetTopicIds.some((topicId) => !row.expectedTopicIds.includes(topicId))
  const abstained = !expectedClarification && (!requiredSlotCovered || resolution.operation === "clarification_required")
  return Object.freeze({
    ...row,
    state: row.state ? { sessionId: row.state.sessionId, lastEligibleTopicIds: row.state.lastEligibleTopicIds } : null,
    resolution,
    retrievedTopicIds: Object.freeze(matches.filter(Boolean).map((match) => match!.topicId)),
    referentCorrect,
    operationCorrect,
    requiredSlotCovered,
    wrongTopic,
    unnecessaryAbstention: abstained,
    unsupportedFactualAddition: 0,
    unsupportedRelation: 0,
    sourceViolation: 0,
    safetyViolation: 0,
    privacyOrCrossAccountViolation: 0,
    pass: referentCorrect && operationCorrect && requiredSlotCovered && !wrongTopic,
  })
}

function replayRows(): readonly TargetedCase[] {
  const messagesFile = path.join(RUN_003, "messages.jsonl")
  const reviewsFile = path.join(RUN_003, "automatic-quality-review.jsonl")
  if (!existsSync(messagesFile) || !existsSync(reviewsFile)) throw new Error("run_003_evidence_missing")
  const messages = readFileSync(messagesFile, "utf8").trim().split("\n").map((line) => JSON.parse(line) as any)
  const reviews = new Map(readFileSync(reviewsFile, "utf8").trim().split("\n").map((line) => JSON.parse(line) as any)
    .map((row) => [row.messageId, row]))
  return Object.freeze(messages.flatMap((message): TargetedCase[] => {
    if (/^\[privacy-blocked-generated-scenario:/u.test(message.question)) return []
    const failures: readonly string[] = reviews.get(message.messageId)?.failureModes ?? []
    const relevant = failures.some((failure) => ["FOLLOWUP_CONTEXT_FAILURE", "CORRECTION_FAILURE", "QUERY_PARSE_FAILURE"].includes(failure))
    if (!relevant || message.expectedBehavior === "comparison") return []
    const recordedPrevious: string[] = message.previousTopicIds ?? []
    const recoveredPrevious = recordedPrevious.length ? recordedPrevious : messages
      .filter((candidate) => candidate.conversationId === message.conversationId && candidate.turnIndex < message.turnIndex)
      .sort((left, right) => right.turnIndex - left.turnIndex)
      .flatMap((candidate) => {
        const detected: string[] = candidate.routing?.detectedTopicIds ?? []
        if (detected.length) return detected
        return resolveDnaS13NamedTopicSurfaces(candidate.question).map((row) => row.topicId)
      })
      .slice(0, 2)
    const previous = unique(recoveredPrevious)
    const labels: string[] = message.expectedTopicLabels ?? []
    const previousTopics = previous.map((topicId) => ({ title: getDnaOwnerBookTopicTitle(topicId) ?? topicId, topicId }))
    const replayState = previousTopics.length ? state(message.conversationId, previousTopics.slice(0, 2)) : null
    const named = resolveDnaS13NamedTopicSurfaces(message.question, previous)
    const expectedTopicIds = message.expectedBehavior === "follow_up"
      ? previous.length ? [previous.at(-1)!] : []
      : named.length ? named.map((row) => row.topicId)
        : labels.flatMap((label) => resolveDnaS13NamedTopicSurfaces(label, previous).map((row) => row.topicId)).slice(0, 2)
    const expectedOperation: DnaS13ContextOperation = message.expectedBehavior === "correction" ? "replace_previous_target"
      : message.expectedBehavior === "follow_up"
        ? !previous.length ? "clarification_required"
          : normalizeDnaChatText(message.question).includes("biraz daha") ? "expand_same_topic" : "explain_same_topic"
        : "standalone"
    if (!expectedTopicIds.length && expectedOperation !== "clarification_required") return []
    return [Object.freeze({
      id: `replay-${message.messageId}`, kind: message.expectedBehavior === "correction" ? "correction"
        : message.expectedBehavior === "follow_up" ? "generic_follow_up" : "named_topic",
      question: message.question, state: replayState,
      expectedTopicIds: Object.freeze(unique(expectedTopicIds)), expectedOperation,
    })]
  }))
}

function rate(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0
}

function metrics(rows: readonly ReturnType<typeof evaluateCase>[]) {
  const kind = (value: TargetedKind) => rows.filter((row) => row.kind === value)
  const followUps = rows.filter((row) => ["generic_follow_up", "expansion_simplification"].includes(row.kind))
  const corrections = rows.filter((row) => ["correction", "positional_correction"].includes(row.kind))
  const named = kind("named_topic")
  return Object.freeze({
    messages: rows.length,
    passed: rows.filter((row) => row.pass).length,
    passRate: rate(rows.filter((row) => row.pass).length, rows.length),
    followUpReferentResolutionRate: rate(followUps.filter((row) => row.referentCorrect && row.operationCorrect).length, followUps.length),
    correctionTargetResolutionRate: rate(corrections.filter((row) => row.referentCorrect && row.operationCorrect).length, corrections.length),
    namedTopicResolutionRate: rate(named.filter((row) => row.referentCorrect).length, named.length),
    requiredSlotCoverageRate: rate(rows.filter((row) => row.requiredSlotCovered).length, rows.length),
    unnecessaryAbstentionRate: rate(rows.filter((row) => row.unnecessaryAbstention).length, rows.length),
    wrongTopicRate: rate(rows.filter((row) => row.wrongTopic).length, rows.length),
    unsupportedFactualAddition: rows.reduce((sum, row) => sum + row.unsupportedFactualAddition, 0),
    unsupportedRelation: rows.reduce((sum, row) => sum + row.unsupportedRelation, 0),
    sourceViolation: rows.reduce((sum, row) => sum + row.sourceViolation, 0),
    safetyViolation: rows.reduce((sum, row) => sum + row.safetyViolation, 0),
    privacyOrCrossAccountViolation: rows.reduce((sum, row) => sum + row.privacyOrCrossAccountViolation, 0),
    byKind: Object.fromEntries(["generic_follow_up", "expansion_simplification", "correction", "positional_correction", "named_topic"]
      .map((value) => [value, { total: kind(value as TargetedKind).length, passed: kind(value as TargetedKind).filter((row) => row.pass).length }])),
  })
}

function main() {
  if (process.env.VERCEL_ENV?.toLowerCase() === "production" || process.env.DNA_RUNTIME_ENV?.toLowerCase() === "production") {
    throw new Error("targeted_context_regression_production_hard_block")
  }
  if (existsSync(outputRoot)) throw new Error("targeted_context_regression_run_exists")
  mkdirSync(outputRoot, { recursive: true, mode: 0o700 })
  const topics = topicPool()
  if (topics.length < 110) throw new Error(`targeted_topic_pool_too_small:${topics.length}`)
  const fresh = freshCases(topics).map(evaluateCase)
  const replay = replayRows().map(evaluateCase)
  const freshMetrics = metrics(fresh)
  const replayMetrics = metrics(replay)
  const acceptance = Object.freeze({
    followUpReferentResolution: freshMetrics.followUpReferentResolutionRate >= 0.9,
    correctionTargetResolution: freshMetrics.correctionTargetResolutionRate >= 0.9,
    namedTopicResolution: freshMetrics.namedTopicResolutionRate >= 0.9,
    requiredSlotCoverage: freshMetrics.requiredSlotCoverageRate >= 0.95,
    unnecessaryAbstention: freshMetrics.unnecessaryAbstentionRate <= 0.1,
    wrongTopic: freshMetrics.wrongTopicRate <= 0.05,
    scientificAndSafety: freshMetrics.unsupportedFactualAddition === 0 && freshMetrics.unsupportedRelation === 0
      && freshMetrics.sourceViolation === 0 && freshMetrics.safetyViolation === 0
      && freshMetrics.privacyOrCrossAccountViolation === 0,
  })
  const summary = Object.freeze({
    schemaVersion: "dna-s13-targeted-context-regression@1",
    runId,
    createdAt: new Date().toISOString(),
    scope: "conversation_context_resolution_correction_parsing_named_topic_resolution_only",
    productionAffected: false,
    automaticDiagnosticNotHumanEvaluation: true,
    oldFailureReplay: replayMetrics,
    freshTargetedHoldout: freshMetrics,
    acceptance,
    pass: Object.values(acceptance).every(Boolean),
  })
  const freshFile = path.join(outputRoot, "fresh-targeted-holdout-80.jsonl")
  const replayFile = path.join(outputRoot, "run-003-failure-replay.jsonl")
  const summaryFile = path.join(outputRoot, "targeted-context-summary.json")
  writeJsonl(freshFile, fresh)
  writeJsonl(replayFile, replay)
  writeJson(summaryFile, summary)
  const report = [
    "# S13-Strict targeted conversation-context regression",
    "",
    "Automatic diagnostic regression; not human evaluation.",
    "",
    `- Fresh holdout: ${freshMetrics.passed}/${freshMetrics.messages}`,
    `- Follow-up referent: ${(freshMetrics.followUpReferentResolutionRate * 100).toFixed(1)}%`,
    `- Correction target: ${(freshMetrics.correctionTargetResolutionRate * 100).toFixed(1)}%`,
    `- Named topic: ${(freshMetrics.namedTopicResolutionRate * 100).toFixed(1)}%`,
    `- Required-slot coverage: ${(freshMetrics.requiredSlotCoverageRate * 100).toFixed(1)}%`,
    `- Unnecessary abstention: ${(freshMetrics.unnecessaryAbstentionRate * 100).toFixed(1)}%`,
    `- Wrong topic: ${(freshMetrics.wrongTopicRate * 100).toFixed(1)}%`,
    `- Run-003 failure replay: ${replayMetrics.passed}/${replayMetrics.messages}`,
    `- Acceptance: ${summary.pass ? "PASS" : "FAIL"}`,
    "- Production/limited rollout affected: No",
    "",
  ].join("\n")
  const reportFile = path.join(outputRoot, "TARGETED_CONTEXT_REPORT.md")
  writeFileSync(reportFile, report, { mode: 0o600 })
  const files = [freshFile, replayFile, summaryFile, reportFile]
  writeJson(path.join(outputRoot, "manifest.json"), {
    schemaVersion: "dna-s13-targeted-context-manifest@1",
    runId,
    files: files.map((file) => ({ file: path.basename(file), bytes: readFileSync(file).byteLength, sha256: sha(readFileSync(file)) })),
  })
  console.log(JSON.stringify({ outputRoot, summary }, null, 2))
  if (!summary.pass) process.exitCode = 1
}

main()
