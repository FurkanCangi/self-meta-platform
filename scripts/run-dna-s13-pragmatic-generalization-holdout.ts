import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

import denseKnowledgeRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { getDnaOwnerBookTopicClaims, resolveDnaOwnerBookTopic } from "../src/lib/dna/chat/ownerBookRuntime"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import {
  hashDnaS13LimitedIdentifier,
  sealDnaS13LimitedContext,
} from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import {
  runDnaS13LimitedRolloutMessage,
  type DnaS13LimitedTechnicalEvidence,
} from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import type {
  DnaS13DiscourseConstraint,
  DnaS13PragmaticAction,
  DnaS13TargetResolution,
} from "../src/lib/dna/chat/s13/pragmaticTask"
import { DeterministicRealizer } from "../src/lib/dna/chat/s13/strictRealizer"
import { createDnaS13TopicSemanticFrame } from "../src/lib/dna/chat/s13/topicSemantic"

const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const RUN_ID = process.argv.find((value) => value.startsWith("--run-id="))?.slice(9)
  || `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z")}-${process.pid}-${randomUUID().slice(0, 8)}`
const OUTPUT_PARENT = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/pragmatic-generalization-holdout")
const OUTPUT_DIR = path.join(OUTPUT_PARENT, `run-${RUN_ID}`)
const ZIP_PATH = path.join(OUTPUT_PARENT, `DNA_S13_PRAGMATIC_GENERALIZATION_HOLDOUT_${RUN_ID}.zip`)
const CASES_PATH = path.join(OUTPUT_DIR, "holdout-cases.jsonl")
const SUMMARY_PATH = path.join(OUTPUT_DIR, "objective-summary.json")
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json")
const INTERNAL_JARGON = /(?:doğrulanmış kapsam|mevcut doğrulanmış içerik|kilitli içerik|locked claim|\bclaim\b|\bfacet\w*\b|\bcatalog\b|\bkatalog\b|\btopicid\b|\brequiredclaim\b|\bsupport claim\b|\bevidence status\b)/iu
const ACTION_FAILURE_CODES = new Set([
  "DEFINE_NOT_SATISFIED", "WHY_NOT_SATISFIED", "DEEPEN_NO_INFORMATION_GAIN",
  "EXAMPLE_NOT_SATISFIED", "COMPARE_CONCLUSION_NOT_INFORMATIVE", "SIMPLIFY_NOT_TRANSFORMED",
])

type Topic = Readonly<{ topicId: string; title: string }>
type Annotation = Readonly<{
  targetTopicIds: readonly string[]
  targetResolution: DnaS13TargetResolution
  pragmaticAction: DnaS13PragmaticAction
  requestedFacets: readonly string[]
  discourseConstraints: readonly DnaS13DiscourseConstraint[]
}>
type HoldoutCase = Readonly<{
  id: string
  category: "define_explain" | "why" | "deepen" | "simplify" | "example" | "compare" | "correction" | "low_lexical_typo_context"
  question: string
  topics: readonly Topic[]
  contextTopic: Topic | null
  annotation: Annotation
}>

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function writePrivate(file: string, value: unknown) {
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

function percent(numerator: number, denominator: number): number | "N/A" {
  return denominator ? Number((numerator / denominator * 100).toFixed(3)) : "N/A"
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

function constraints(...values: DnaS13DiscourseConstraint[]) {
  return Object.freeze(values)
}

function topicPool(): readonly Topic[] {
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ topicId?: string; title?: string }>[]
  }).units
  const topics = [...new Map(units.flatMap((row) => {
    const topicId = String(row.topicId || "").trim()
    const title = String(row.title || "").trim()
    if (title.length < 7 || title.length > 72 || title.includes("·")) return []
    return [[topicId, Object.freeze({ topicId, title })] as const]
  })).values()].filter((topic) => {
    const normalized = normalizeDnaChatText(topic.title)
    if (/\b(?:klinik|vaka|danisan|hasta|tani|tanim|tedavi|terapi|mudahale|travma|otizm|dehb|sendrom|ogrenme|duyusal diyet)\w*\b/u.test(normalized)) return false
    const named = resolveDnaS13NamedTopicSurfaces(topic.title)
    const spoken = topic.title.toLocaleLowerCase("tr-TR")
    const privacyProbes = [
      `${spoken} kuramsal olarak nasıl açıklanır?`,
      `${spoken} ifadesini teknik olmadan açıkla, içeriği koru.`,
      `${spoken} ile çalışma belleği arasındaki ayrımı iki tarafı görünür tutarak kur.`,
      `çalışma belleği değil, ${spoken} hedefim; yalnız bunu anlat.`,
    ]
    const orderedClaims = getDnaOwnerBookTopicClaims(topic.topicId, true)
    const semantics = createDnaS13TopicSemanticFrame({
      topicId: topic.topicId,
      title: topic.title,
      orderedClaims,
    })
    return semantics.thesisClaimIds.length > 0
      && semantics.claims.some((claim) => claim.selfContained && claim.role !== "MYTH_OR_COMMON_CLAIM")
      && named.length === 1 && named[0]?.topicId === topic.topicId
      && privacyProbes.every((question) => inspectDnaS13LimitedRolloutPrivacy({ question, mode: "theory" }).allowed)
  }).sort((left, right) => sha(`pragmatic-holdout:${left.topicId}`).localeCompare(sha(`pragmatic-holdout:${right.topicId}`)))
  if (topics.length < 120) throw new Error(`pragmatic_holdout_topic_pool_too_small:${topics.length}`)
  return Object.freeze(topics.slice(0, 120))
}

function buildCases(topics: readonly Topic[]): readonly HoldoutCase[] {
  let cursor = 0
  let number = 0
  const rows: HoldoutCase[] = []
  const nextTopic = () => topics[cursor++ % topics.length]!
  const add = (
    category: HoldoutCase["category"],
    question: string,
    selected: readonly Topic[],
    contextTopic: Topic | null,
    annotation: Annotation,
  ) => {
    number += 1
    rows.push(Object.freeze({ id: `pragmatic-${String(number).padStart(3, "0")}`, category, question, topics: Object.freeze([...selected]), contextTopic, annotation }))
  }

  const defineForms = [
    (title: string) => `${title} tam olarak ne demek?`,
    (title: string) => `${title} konusunu bana anlatır mısın?`,
    (title: string) => `${title} ne demek oluyor?`,
    (title: string) => `${title} konusunu kısaca açıklar mısın?`,
  ]
  for (let index = 0; index < 40; index += 1) {
    const topic = nextTopic()
    const action = index % 2 === 0 ? "DEFINE" as const : "EXPLAIN" as const
    add("define_explain", defineForms[index % defineForms.length]!(topic.title.toLocaleLowerCase("tr-TR")), [topic], null, Object.freeze({
      targetTopicIds: Object.freeze([topic.topicId]), targetResolution: "EXPLICIT_TARGET", pragmaticAction: action,
      requestedFacets: Object.freeze([action === "DEFINE" ? "definition" : "core_scope"]), discourseConstraints: constraints("standard"),
    }))
  }
  const whyForms = [
    (title: string) => `${title} neden önemli?`,
    (title: string) => `${title} ne işe yarıyor?`,
    (title: string) => `${title} günlük hayatta niye dikkate alınmalı?`,
    (title: string) => `${title} bize ne kazandırıyor?`,
    (title: string) => `${title} için asıl değer nerede?`,
  ]
  for (let index = 0; index < 40; index += 1) {
    const topic = nextTopic()
    add("why", whyForms[index % whyForms.length]!(topic.title.toLocaleLowerCase("tr-TR")), [topic], null, Object.freeze({
      targetTopicIds: Object.freeze([topic.topicId]), targetResolution: "EXPLICIT_TARGET", pragmaticAction: "WHY_SIGNIFICANCE",
      requestedFacets: Object.freeze(["function"]), discourseConstraints: constraints("do_not_repeat", "no_invention"),
    }))
  }
  const deepenForms = [
    (title: string) => `${title} konusunu biraz daha açar mısın?`,
    (title: string) => `${title} için bir adım daha ileri gidelim.`,
    (title: string) => `${title} hakkında başka ne ekleyebiliriz?`,
    (title: string) => `${title} tarafını biraz derinleştirir misin?`,
    (title: string) => `${title} için yeni bir nokta varsa ekler misin?`,
  ]
  for (let index = 0; index < 40; index += 1) {
    const topic = nextTopic()
    add("deepen", deepenForms[index % deepenForms.length]!(topic.title.toLocaleLowerCase("tr-TR")), [topic], null, Object.freeze({
      targetTopicIds: Object.freeze([topic.topicId]), targetResolution: "EXPLICIT_TARGET", pragmaticAction: "DEEPEN",
      requestedFacets: Object.freeze(["core_scope", "function", "boundary"]),
      discourseConstraints: constraints("do_not_repeat", "deep", "no_invention", "new_information_only"),
    }))
  }
  const simplifyForms = [
    (title: string) => `${title} konusunu daha basit söyler misin?`,
    (title: string) => `${title} için günlük dille bir açıklama yap.`,
    (title: string) => `${title} bana biraz teknik geldi, sadeleştirir misin?`,
    (title: string) => `${title} ilk kez duyan biri için nasıl anlatılır?`,
  ]
  for (let index = 0; index < 30; index += 1) {
    const topic = nextTopic()
    add("simplify", simplifyForms[index % simplifyForms.length]!(topic.title.toLocaleLowerCase("tr-TR")), [topic], null, Object.freeze({
      targetTopicIds: Object.freeze([topic.topicId]), targetResolution: "EXPLICIT_TARGET", pragmaticAction: "SIMPLIFY",
      requestedFacets: Object.freeze(["core_scope"]), discourseConstraints: constraints("concise"),
    }))
  }
  const exampleForms = [
    (title: string) => `${title} için bir örnek var mı?`,
    (title: string) => `${title} günlük hayatta nasıl görünür, örnekleyebilir misin?`,
    (title: string) => `${title} deyince aklımda canlanması için somut bir durum söyler misin?`,
    (title: string) => `${title} konusunda mesela ne olabilir?`,
  ]
  for (let index = 0; index < 30; index += 1) {
    const topic = nextTopic()
    add("example", exampleForms[index % exampleForms.length]!(topic.title.toLocaleLowerCase("tr-TR")), [topic], null, Object.freeze({
      targetTopicIds: Object.freeze([topic.topicId]), targetResolution: "EXPLICIT_TARGET", pragmaticAction: "EXAMPLE",
      requestedFacets: Object.freeze(["verified_example"]), discourseConstraints: constraints("no_invention"),
    }))
  }
  const compareForms = [
    (a: string, b: string) => `${a} ile ${b} arasındaki fark ne?`,
    (a: string, b: string) => `${a} ve ${b} aynı şey mi, nasıl ayrılıyor?`,
    (a: string, b: string) => `${a} ve ${b}: ikisini karşılaştırır mısın?`,
  ]
  for (let index = 0; index < 30; index += 1) {
    const left = nextTopic(); const right = nextTopic()
    add("compare", compareForms[index % compareForms.length]!(left.title.toLocaleLowerCase("tr-TR"), right.title.toLocaleLowerCase("tr-TR")), [left, right], null, Object.freeze({
      targetTopicIds: Object.freeze([left.topicId, right.topicId]), targetResolution: "MULTI_TARGET", pragmaticAction: "COMPARE",
      requestedFacets: Object.freeze(["definition"]), discourseConstraints: constraints("preserve_order", "no_invention"),
    }))
  }
  const correctionForms = [
    (oldTitle: string, newTitle: string) => `${oldTitle} değil, ${newTitle} demek istemiştim.`,
    (oldTitle: string, newTitle: string) => `Pardon, ${oldTitle} yerine ${newTitle} konusunu soruyorum.`,
    (oldTitle: string, newTitle: string) => `${oldTitle} kısmını boş ver; kastım ${newTitle}.`,
  ]
  for (let index = 0; index < 20; index += 1) {
    const oldTopic = nextTopic(); const newTopic = nextTopic()
    add("correction", correctionForms[index % correctionForms.length]!(oldTopic.title.toLocaleLowerCase("tr-TR"), newTopic.title.toLocaleLowerCase("tr-TR")), [oldTopic, newTopic], oldTopic, Object.freeze({
      targetTopicIds: Object.freeze([newTopic.topicId]), targetResolution: "REPLACED_TARGET", pragmaticAction: "CORRECT_TARGET",
      requestedFacets: Object.freeze(["core_scope"]), discourseConstraints: constraints("only_active_target"),
    }))
  }
  const lowLexicalForms = [
    "peki bunun önemi nerede?",
    "bu ne işe yarıyor yani?",
    "bunu biraz daha açar mısın?",
    "bnı brz dha acar msn?",
  ] as const
  for (let index = 0; index < 20; index += 1) {
    const topic = nextTopic()
    const action = index % 4 < 2 ? "WHY_SIGNIFICANCE" as const : "DEEPEN" as const
    add("low_lexical_typo_context", lowLexicalForms[index % lowLexicalForms.length]!, [topic], topic, Object.freeze({
      targetTopicIds: Object.freeze([topic.topicId]), targetResolution: "CONTEXT_TARGET", pragmaticAction: action,
      requestedFacets: Object.freeze(action === "WHY_SIGNIFICANCE" ? ["function"] : ["core_scope", "function", "boundary"]),
      discourseConstraints: action === "WHY_SIGNIFICANCE"
        ? constraints("do_not_repeat", "no_invention")
        : constraints("do_not_repeat", "deep", "no_invention", "new_information_only"),
    }))
  }
  if (rows.length !== 250) throw new Error(`pragmatic_holdout_shape_invalid:${rows.length}`)
  return Object.freeze(rows)
}

function priorQuestions() {
  const parent = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/external-blind-evaluation")
  return ["001", "002", "003", "004", "005", "006"].flatMap((id) => {
    const file = path.join(parent, id, "blind-conversations.json")
    const rows = JSON.parse(readFileSync(file, "utf8")) as readonly Readonly<{ turns: readonly Readonly<{ role: string; text: string }>[] }>[]
    return rows.flatMap((row) => row.turns.filter((turn) => turn.role === "user").map((turn) => normalizeDnaChatText(turn.text)))
  })
}

function topicClaimId(topic: Topic) {
  const match = resolveDnaOwnerBookTopic(topic.topicId, "temel açıklamayı ver", "standard")
  return match?.claimIds[0] ?? null
}

async function main() {
  const topics = topicPool()
  const cases = buildCases(topics)
  const privacyRejectedFixtures = cases.filter((row) =>
    !inspectDnaS13LimitedRolloutPrivacy({ question: row.question, mode: "theory" }).allowed)
  if (privacyRejectedFixtures.length) {
    throw new Error(`pragmatic_holdout_privacy_fixture_invalid:${privacyRejectedFixtures.map((row) => {
      const decision = inspectDnaS13LimitedRolloutPrivacy({ question: row.question, mode: "theory" })
      return `${row.id}:${decision.reasonCodes.join("+")}:${row.question}`
    }).join(" | ")}`)
  }
  const oldQuestions = new Set(priorQuestions())
  const exactPriorReuseCount = cases.filter((row) => oldQuestions.has(normalizeDnaChatText(row.question))).length
  if (exactPriorReuseCount) throw new Error(`pragmatic_holdout_prior_wording_reused:${exactPriorReuseCount}`)
  const topicUse = new Map<string, number>()
  for (const row of cases) for (const topic of row.topics) topicUse.set(topic.topicId, (topicUse.get(topic.topicId) ?? 0) + 1)
  const distinctTopicCount = topicUse.size
  const maximumTopicReuse = Math.max(...topicUse.values())
  if (distinctTopicCount < 120 || maximumTopicReuse > 3) {
    throw new Error(`pragmatic_holdout_topic_diversity_invalid:${distinctTopicCount}:${maximumTopicReuse}`)
  }
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  writePrivate(CASES_PATH, "")
  const contextSecret = sha(`pragmatic-holdout:${RUN_ID}:context`)
  const telemetrySecret = sha(`pragmatic-holdout:${RUN_ID}:telemetry`)
  const results: any[] = []
  let runtimeErrors = 0
  for (const [index, row] of cases.entries()) {
    const subjectId = `pragmatic-holdout-subject-${index + 1}`
    const sessionId = `pragmatic-holdout-session-${index + 1}`
    const subjectIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "subject", value: subjectId })!
    const conversationIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "conversation", value: sessionId })!
    const contextClaimId = row.contextTopic ? topicClaimId(row.contextTopic) : null
    const contextToken = row.contextTopic ? sealDnaS13LimitedContext({
      masterSecret: contextSecret,
      subjectId,
      topicIds: Object.freeze([row.contextTopic.topicId]),
      activeTopicId: row.contextTopic.topicId,
      focus: "definition",
      questionType: "definition",
      responseDepth: "standard",
      shownClaimIds: Object.freeze(contextClaimId ? [contextClaimId] : []),
      answeredFacets: Object.freeze(["definition", "core_scope"]),
      shownRelationIds: Object.freeze([]),
    }) : null
    let technical: DnaS13LimitedTechnicalEvidence | null = null
    let result: Awaited<ReturnType<typeof runDnaS13LimitedRolloutMessage>> | null = null
    let error: string | null = null
    try {
      const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: row.question, mode: "theory" })
      if (!privacy.allowed) throw new Error(`privacy_fixture_rejected:${privacy.reasonCodes.join(",")}`)
      result = await runDnaS13LimitedRolloutMessage({
        requestId: randomUUID(),
        subjectId,
        subjectIdHash,
        conversationIdHash,
        sessionId,
        question: row.question,
        responseDepth: "standard",
        contextToken,
        contextSecret,
        privacy,
        rolloutPhase: "L0",
        realizer: new DeterministicRealizer(),
        technicalObserver: (value) => { technical = value },
      })
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "unknown_runtime_error"
      runtimeErrors += 1
    }
    const evidence = technical as DnaS13LimitedTechnicalEvidence | null
    const clarificationRouting = result?.kind === "clarification" ? result.routing : null
    const task = evidence?.pragmaticTaskFrame ?? clarificationRouting?.pragmaticTaskFrame ?? null
    const activeTargetIds = task?.targets.filter((target) => target.polarity === "ACTIVE_TARGET").map((target) => target.topicId)
      ?? clarificationRouting?.selectedTopicIds ?? []
    const exactTargets = JSON.stringify(activeTargetIds) === JSON.stringify(row.annotation.targetTopicIds)
    const safeClarification = result?.kind === "clarification" && exactTargets
    const safeFallback = result?.kind === "fallback" && !error
    const adjudicationEligible = !safeClarification && !safeFallback
    const targetAccurate = exactTargets && (task?.targetResolution === row.annotation.targetResolution || safeClarification)
    const actionAccurate = task?.pragmaticAction === row.annotation.pragmaticAction || safeClarification
    const shown = new Set(evidence?.plan.semanticOperationAudit?.alreadyShownClaimIds ?? [])
    const repeatedClaim = Boolean(task?.discourseConstraints.includes("do_not_repeat")
      && evidence?.plan.slots.some((slot) => slot.requiredClaimIds.some((claimId) => shown.has(claimId))))
    const comparisonSides = evidence?.plan.slots.filter((slot) => slot.kind === "comparison_side") ?? []
    const comparisonSupported = comparisonSides.length >= 2
    const comparisonConclusionMissing = row.category === "compare" && comparisonSupported
      && !evidence?.plan.slots.some((slot) => slot.kind === "comparison_conclusion")
    const criticalViolations = result ? result.telemetry.validation.unsupportedFactCount
      + result.telemetry.validation.unsupportedRelationCount
      + result.telemetry.validation.sourceViolationCount
      + result.telemetry.validation.safetyViolationCount
      + result.telemetry.crossAccountViolationCount : 0
    const answer = result?.kind === "answered" || result?.kind === "clarification"
      ? visibleAnswerText(result.body)
      : result?.kind === "fallback"
        ? "Bu isteği güvenilir biçimde tamamlayamadım; hedef başlığı biraz daha açık yazar mısınız?" : ""
    const actionFailureCodes = evidence?.runtime.finalValidation.failureCodes
      .filter((code) => ACTION_FAILURE_CODES.has(code)) ?? []
    const catalogLimited = (evidence?.plan.knowledgeGaps ?? []).some((gap) => gap.classification === "CATALOG_GAP")
      && (evidence?.plan.evidenceLimitations?.length ?? 0) > 0
    const falseAnswerSufficiency = actionFailureCodes.length > 0 && !catalogLimited
    const blankAssistantResponse = answer.length === 0
    const knowledgeGaps = evidence?.plan.knowledgeGaps ?? []
    const record = Object.freeze({
      schemaVersion: "dna-s13-pragmatic-generalization-holdout@1",
      id: row.id,
      category: row.category,
      question: row.question,
      annotation: row.annotation,
      actual: task ? Object.freeze({
        targetTopicIds: Object.freeze(activeTargetIds),
        targetResolution: task.targetResolution,
        pragmaticAction: task.pragmaticAction,
        requestedFacets: task.requestedFacets,
        discourseConstraints: task.discourseConstraints,
      }) : null,
      targetAccurate,
      actionAccurate,
      adjudicationEligible,
      safeClarification,
      safeFallback,
      informationGain: evidence?.plan.semanticOperationAudit?.followupInformationGain ?? null,
      semanticRepeatWithoutNeedCount: evidence?.plan.semanticOperationAudit?.semanticRepeatWithoutNeedCount ?? 0,
      answerSufficiency: evidence?.plan.answerSufficiency ?? [],
      knowledgeGaps,
      falseAnswerSufficiency,
      blankAssistantResponse,
      wrongTopicFallback: result?.kind === "fallback" && row.contextTopic !== null && !safeFallback,
      internalJargonCount: INTERNAL_JARGON.test(answer) ? 1 : 0,
      repeatedClaimDespiteNoRepeat: repeatedClaim,
      comparisonSupported,
      comparisonConclusionMissing,
      correctionRejectedTargetLeakCount: evidence?.runtime.finalValidation.correctionRejectedTargetLeakCount ?? 0,
      criticalViolations,
      runtimeError: error,
      outputStatus: result?.kind ?? "runtime_error",
      goldAnswerPresent: false,
      codexQualityScoring: false,
    })
    results.push(record)
    writeFileSync(CASES_PATH, `${JSON.stringify(record)}\n`, { flag: "a", mode: 0o600 })
  }

  const actionRate = (action: DnaS13PragmaticAction) => {
    const selected = results.filter((row) => row.annotation.pragmaticAction === action && row.adjudicationEligible)
    return percent(selected.filter((row) => row.actionAccurate).length, selected.length)
  }
  const informationGainRows = results.filter((row) => typeof row.informationGain === "boolean"
    && (row.informationGain === true || row.knowledgeGaps.some((gap: any) => gap.classification === "AVAILABLE_BUT_NOT_SELECTED")))
  const noRepeatRows = results.filter((row) => row.annotation.discourseConstraints.includes("do_not_repeat"))
  const summary = Object.freeze({
    schemaVersion: "dna-s13-pragmatic-generalization-holdout@1:summary@1",
    runId: RUN_ID,
    messageCount: results.length,
    distribution: Object.freeze(Object.fromEntries([...new Set(results.map((row) => row.category))].map((category) => [
      category, results.filter((row) => row.category === category).length,
    ]))),
    distinctBaseTopicCount: distinctTopicCount,
    maximumTopicReuse,
    exactEval001To004QuestionReuseCount: exactPriorReuseCount,
    targetResolutionAccuracy: percent(results.filter((row) => !row.adjudicationEligible || row.targetAccurate).length, results.length),
    pragmaticActionAccuracy: percent(results.filter((row) => !row.adjudicationEligible || row.actionAccurate).length, results.length),
    whyActionResolutionRate: actionRate("WHY_SIGNIFICANCE"),
    deepenActionResolutionRate: actionRate("DEEPEN"),
    simplifyActionResolutionRate: actionRate("SIMPLIFY"),
    exampleActionResolutionRate: actionRate("EXAMPLE"),
    comparisonActionResolutionRate: actionRate("COMPARE"),
    correctionActionResolutionRate: actionRate("CORRECT_TARGET"),
    informationGainMeasuredCount: informationGainRows.length,
    informationGainSuccessRate: percent(informationGainRows.filter((row) => row.informationGain).length, informationGainRows.length),
    informationGainEligibleCount: informationGainRows.length,
    safeClarificationCount: results.filter((row) => row.safeClarification).length,
    safeFallbackCount: results.filter((row) => row.safeFallback).length,
    missingComparisonConclusionCount: results.filter((row) => row.comparisonConclusionMissing).length,
    repeatedClaimDespiteNoRepeatCount: results.filter((row) => row.repeatedClaimDespiteNoRepeat).length,
    semanticRepeatWithoutNeedCount: results.reduce((sum, row) => sum + row.semanticRepeatWithoutNeedCount, 0),
    falseAnswerSufficiencyCount: results.filter((row) => row.falseAnswerSufficiency).length,
    blankAssistantResponseCount: results.filter((row) => row.blankAssistantResponse).length,
    wrongTopicFallbackCount: results.filter((row) => row.wrongTopicFallback).length,
    internalJargonCount: results.reduce((sum, row) => sum + row.internalJargonCount, 0),
    knowledgeGapDistribution: Object.freeze(Object.fromEntries([
      "definition", "function_significance", "example", "boundary", "comparison", "deepening",
    ].map((kind) => [kind, results.reduce((sum, row) => sum
      + row.knowledgeGaps.filter((gap: any) => gap.missingEvidenceType === kind).length, 0)]))),
    availableButNotSelectedCount: results.reduce((sum, row) => sum
      + row.knowledgeGaps.filter((gap: any) => gap.classification === "AVAILABLE_BUT_NOT_SELECTED").length, 0),
    catalogGapCount: results.reduce((sum, row) => sum
      + row.knowledgeGaps.filter((gap: any) => gap.classification === "CATALOG_GAP").length, 0),
    noRepeatViolationRate: percent(results.filter((row) => row.repeatedClaimDespiteNoRepeat).length, noRepeatRows.length),
    correctionRejectedTargetLeakCount: results.reduce((sum, row) => sum + row.correctionRejectedTargetLeakCount, 0),
    criticalViolationCount: results.reduce((sum, row) => sum + row.criticalViolations, 0),
    runtimeErrorCount: runtimeErrors,
    goldAnswers: false,
    codexQualityScoring: false,
  })
  const numericAtLeast = (value: number | "N/A", threshold: number) => typeof value === "number" && value >= threshold
  const gatePass = numericAtLeast(summary.targetResolutionAccuracy, 97)
    && numericAtLeast(summary.pragmaticActionAccuracy, 95)
    && numericAtLeast(summary.whyActionResolutionRate, 95)
    && numericAtLeast(summary.deepenActionResolutionRate, 95)
    && numericAtLeast(summary.comparisonActionResolutionRate, 95)
    && numericAtLeast(summary.exampleActionResolutionRate, 95)
    && numericAtLeast(summary.simplifyActionResolutionRate, 95)
    && summary.correctionRejectedTargetLeakCount === 0
    && summary.missingComparisonConclusionCount === 0
    && (typeof summary.noRepeatViolationRate === "number" && summary.noRepeatViolationRate <= 5)
    && summary.criticalViolationCount === 0
    && summary.falseAnswerSufficiencyCount === 0
    && summary.blankAssistantResponseCount === 0
    && summary.wrongTopicFallbackCount === 0
    && summary.internalJargonCount === 0
    && summary.runtimeErrorCount === 0
  const finalSummary = Object.freeze({ ...summary, acceptanceGatePass: gatePass })
  writePrivate(SUMMARY_PATH, finalSummary)
  const files = [CASES_PATH, SUMMARY_PATH]
  writePrivate(MANIFEST_PATH, Object.freeze({
    schemaVersion: "dna-s13-pragmatic-generalization-holdout@1:manifest@1",
    runId: RUN_ID,
    productionBehaviorChanged: false,
    architectureResearchPerformed: false,
    localDeterministicRealizer: true,
    files: files.map((file) => Object.freeze({ name: path.basename(file), bytes: statSync(file).size, sha256: sha(readFileSync(file)) })),
  }))
  execFileSync("zip", ["-q", "-j", ZIP_PATH, ...files, MANIFEST_PATH])
  chmodSync(ZIP_PATH, 0o600)
  console.log(JSON.stringify({ ...finalSummary, outputDirectory: OUTPUT_DIR, zipPath: ZIP_PATH, zipSha256: sha(readFileSync(ZIP_PATH)) }))
  if (!gatePass) process.exitCode = 2
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "pragmatic_holdout_failed")
  process.exitCode = 1
})
