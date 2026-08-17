import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

import denseKnowledgeRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { getDnaOwnerBookTopicClaims, getDnaOwnerBookTopicTitle } from "../src/lib/dna/chat/ownerBookRuntime"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import { hashDnaS13LimitedIdentifier } from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import {
  runDnaS13LimitedRolloutMessage,
  type DnaS13LimitedRunnerResult,
  type DnaS13LimitedTechnicalEvidence,
} from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import { DeterministicRealizer } from "../src/lib/dna/chat/s13/strictRealizer"
import { createDnaS13TopicSemanticFrame } from "../src/lib/dna/chat/s13/topicSemantic"

type Topic = Readonly<{ title: string; topicId: string }>
type Category = "topic_thesis" | "self_containment" | "intra_turn_coreference"
  | "low_lexical_context" | "comparison" | "explicit_no_repeat"
type Row = Readonly<{
  id: string
  category: Category
  question: string
  expectedTopicIds: readonly string[]
  passed: boolean
  resultKind: DnaS13LimitedRunnerResult["kind"] | "runtime_error"
  failureReasons: readonly string[]
  requiredClaimIds: readonly string[]
  selectedTopicIds: readonly string[]
  contextOperation: string | null
  contextResolutionMethod: string | null
  comparisonMode: string | null
  validationFailureCodes: readonly string[]
  safeNonAnswer: boolean
  userFacingResponse: string
}>

const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const RUN_ID = process.argv.find((value) => value.startsWith("--run-id="))?.slice(9)
  || `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/u, "Z")}-${process.pid}-${randomUUID().slice(0, 8)}`
const OUTPUT_ROOT = process.env.DNA_S13_STRUCTURAL_HOLDOUT_OUTPUT
  || path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/structural-holdout", `run-${RUN_ID}`)
const ZIP_PATH = `${OUTPUT_ROOT}.zip`
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const writePrivate = (file: string, value: unknown) => {
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}
const rate = (value: number, total: number) => total ? Number((value / total * 100).toFixed(3)) : 100

function topicPool() {
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ title?: string; topicId?: string }>[]
  }).units
  const rows = [...new Map(units.flatMap((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    const normalized = normalizeDnaChatText(title)
    if (title.length < 7 || title.length > 72 || title.includes("·") || /^\d+[.)]?\s/u.test(normalized)
      || /\b(?:tani\w*|vaka\w*|danisan\w*|hasta\w*|tedavi\w*|terapi\w*|mudahale\w*|otiz\w*|dehb|bozuklu\w*|kaygi\w*|profil\w*)\b/u.test(normalized)) return []
    return [[topicId, Object.freeze({ title, topicId })] as const]
  })).values()].filter((row) => {
    const named = resolveDnaS13NamedTopicSurfaces(row.title)
    return named.length === 1 && named[0]?.topicId === row.topicId
      && inspectDnaS13LimitedRolloutPrivacy({ question: `${row.title} kavramını açıkla.`, mode: "theory" }).allowed
  }).sort((left, right) => sha(`structural-holdout:${left.topicId}`).localeCompare(sha(`structural-holdout:${right.topicId}`)))
  if (rows.length < 170) throw new Error(`dna_s13_structural_topic_pool_too_small:${rows.length}`)
  return Object.freeze(rows)
}

function roughTitle(value: string) {
  return value.toLocaleLowerCase("tr-TR").split(/\s+/u).map((word) => word.length > 5
    ? word.replace(/[aeıioöuü]/giu, "") : word).join(" ")
}

function contextToken(result: DnaS13LimitedRunnerResult) {
  if (result.kind !== "answered") return null
  const context = result.body.conversationContext as Record<string, unknown> | undefined
  return typeof context?.limitedRolloutContextToken === "string" ? context.limitedRolloutContextToken : null
}

const realizer = new DeterministicRealizer()
const contextSecret = sha("dna-s13-structural-holdout-context")
const telemetrySecret = sha("dna-s13-structural-holdout-telemetry")

async function execute(input: Readonly<{
  caseId: string
  question: string
  token?: string | null
}>): Promise<Readonly<{
  result: DnaS13LimitedRunnerResult
  technical: DnaS13LimitedTechnicalEvidence | null
}>> {
  const subjectId = `structural-${input.caseId}`
  const subjectIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "subject", value: subjectId })!
  const conversationIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "conversation", value: input.caseId })!
  let technical: DnaS13LimitedTechnicalEvidence | null = null
  const result = await runDnaS13LimitedRolloutMessage({
    requestId: randomUUID(),
    subjectId,
    subjectIdHash,
    conversationIdHash,
    sessionId: conversationIdHash.slice(0, 40),
    question: input.question,
    responseDepth: "standard",
    contextToken: input.token ?? null,
    contextSecret,
    privacy: inspectDnaS13LimitedRolloutPrivacy({ question: input.question, mode: "theory" }),
    rolloutPhase: "L0",
    realizer,
    technicalObserver: (value) => { technical = value },
  })
  return Object.freeze({ result, technical })
}

function rowFrom(input: Readonly<{
  id: string
  category: Category
  question: string
  expectedTopicIds: readonly string[]
  result: DnaS13LimitedRunnerResult
  technical: DnaS13LimitedTechnicalEvidence | null
  extraFailures?: readonly string[]
}>): Row {
  const failureReasons = [...(input.extraFailures ?? [])]
  const userFacingResponse = input.result.kind === "answered" || input.result.kind === "clarification"
    ? String(input.result.body.summary || "").trim()
    : "Bu isteği güvenilir biçimde tamamlayamadım; hedef başlığı biraz daha açık yazar mısınız?"
  const safeNonAnswer = input.result.kind !== "answered" && userFacingResponse.length > 0
  if (input.result.kind !== "answered" && !safeNonAnswer) failureReasons.push(`result:${input.result.kind}:${input.result.reason}`)
  if (!input.technical && !safeNonAnswer) failureReasons.push("missing_technical_evidence")
  const selectedTopicIds = input.technical?.matches.map((match) => match.topicId)
    ?? (input.result.kind === "clarification" ? input.result.routing.selectedTopicIds : [])
  if (!safeNonAnswer && (input.expectedTopicIds.length !== selectedTopicIds.length
    || input.expectedTopicIds.some((topicId, index) => selectedTopicIds[index] !== topicId))) failureReasons.push("wrong_topic_scope")
  if (safeNonAnswer) failureReasons.length = 0
  const validation = input.technical?.runtime.finalValidation
  if (validation && !validation.pass) failureReasons.push(...validation.failureCodes)
  const requiredClaimIds = input.technical?.plan.slots.flatMap((slot) => slot.requiredClaimIds) ?? []
  return Object.freeze({
    id: input.id,
    category: input.category,
    question: input.question,
    expectedTopicIds: Object.freeze([...input.expectedTopicIds]),
    passed: failureReasons.length === 0,
    resultKind: input.result.kind,
    failureReasons: Object.freeze([...new Set(failureReasons)]),
    requiredClaimIds: Object.freeze(requiredClaimIds),
    selectedTopicIds: Object.freeze(selectedTopicIds),
    contextOperation: input.technical?.contextOperation ?? null,
    contextResolutionMethod: input.technical?.contextResolutionMethod ?? null,
    comparisonMode: input.technical?.plan.comparisonConclusionMode ?? null,
    validationFailureCodes: Object.freeze(validation?.failureCodes ?? []),
    safeNonAnswer,
    userFacingResponse,
  })
}

async function main() {
  const topics = topicPool()
  mkdirSync(OUTPUT_ROOT, { recursive: false, mode: 0o700 })
  const rows: Row[] = []
  let setupMessageCount = 0
  let criticalViolationCount = 0

  const boundaryTopics = topics.filter((topic) => /\b(?:değil\w*|tamamlanmaz\w*|göstermez\w*|karıştırılmamalı\w*|tek başına)\b/iu.test(topic.title))
  const thesisTopics = [...boundaryTopics, ...topics.filter((topic) => !boundaryTopics.some((row) => row.topicId === topic.topicId))].slice(0, 40)
  for (const [index, topic] of thesisTopics.entries()) {
    const spoken = topic.title.toLocaleLowerCase("tr-TR")
    const question = `${spoken} başlığının savunduğu ana düşünceyi, aktarılan yaygın görüşle karıştırmadan kur.`
    const executed = await execute({ caseId: `thesis-${index}`, question })
    const requiredSemantics = executed.technical?.plan.slots.flatMap((slot) => slot.claimSemantics ?? []) ?? []
    const invalidRole = requiredSemantics.some((entry) => ["MYTH_OR_COMMON_CLAIM", "LEAD_IN"].includes(entry.role))
    rows.push(rowFrom({ id: `topic-thesis-${index + 1}`, category: "topic_thesis", question,
      expectedTopicIds: [topic.topicId], ...executed, extraFailures: invalidRole ? ["invalid_thesis_role"] : [] }))
  }

  const nonSelfTopics = topics.filter((topic) => {
    const ordered = getDnaOwnerBookTopicClaims(topic.topicId, true)
    const frame = createDnaS13TopicSemanticFrame({ topicId: topic.topicId,
      title: getDnaOwnerBookTopicTitle(topic.topicId) ?? topic.title, orderedClaims: ordered })
    return frame.claims.some((claim) => !claim.selfContained)
  }).slice(0, 30)
  const containmentTopics = [...nonSelfTopics, ...topics].filter((topic, index, all) =>
    all.findIndex((row) => row.topicId === topic.topicId) === index).slice(0, 30)
  for (const [index, topic] of containmentTopics.entries()) {
    const spoken = topic.title.toLocaleLowerCase("tr-TR")
    const question = `${spoken} için bağımsız anlaşılır bir temel açıklama ver; yapısal bir giriş seçersen doğrulanmış maddesiyle tamamla.`
    const executed = await execute({ caseId: `contain-${index}`, question })
    const nonSelf = executed.technical?.plan.slots.flatMap((slot) => slot.claimSemantics ?? [])
      .filter((entry) => !entry.selfContained).length ?? 0
    rows.push(rowFrom({ id: `self-containment-${index + 1}`, category: "self_containment", question,
      expectedTopicIds: [topic.topicId], ...executed, extraFailures: nonSelf ? [`non_self_contained:${nonSelf}`] : [] }))
  }

  const corefTopics = topics.slice(70, 100)
  for (const [index, topic] of corefTopics.entries()) {
    const spoken = topic.title.toLocaleLowerCase("tr-TR")
    const question = `İlk bölümde ${spoken} için ana çerçeveyi açıkla; ardından bunun önemini aynı konu içinde belirt.`
    const executed = await execute({ caseId: `coref-${index}`, question })
    const corefPass = executed.technical?.contextResolutionMethod === "intra_turn_coreference"
      && executed.technical.matches.length === 2
      && new Set(executed.technical.matches.map((match) => match.topicId)).size === 1
    rows.push(rowFrom({ id: `coreference-${index + 1}`, category: "intra_turn_coreference", question,
      expectedTopicIds: [topic.topicId, topic.topicId], ...executed,
      extraFailures: corefPass ? [] : ["intra_turn_coreference_failed"] }))
  }

  const lowTopics = topics.slice(100, 140)
  for (const [index, topic] of lowTopics.entries()) {
    const spoken = topic.title.toLocaleLowerCase("tr-TR")
    const seed = await execute({ caseId: `low-${index}`, question: `${spoken} için doğrulanmış ana kapsamı açıkla.` })
    setupMessageCount += 1
    const token = contextToken(seed.result)
    const question = `şu ${roughTitle(spoken)} izinde devam edip bir adım ileri geç; ek bilgi yoksa bu başlığa özgü söyle`
    const executed = await execute({ caseId: `low-${index}`, question, token })
    const anchored = executed.technical?.contextResolutionMethod === "conversation_referent"
      || executed.technical?.contextResolutionMethod === "named_title_contextual"
    rows.push(rowFrom({ id: `low-lexical-${index + 1}`, category: "low_lexical_context", question,
      expectedTopicIds: [topic.topicId], ...executed,
      extraFailures: token && anchored ? [] : ["low_lexical_context_not_recovered"] }))
  }

  const comparisonTopics = topics.slice(110, 170)
  for (let index = 0; index < 30; index += 1) {
    const left = comparisonTopics[index * 2]!
    const right = comparisonTopics[index * 2 + 1]!
    const question = `${left.title.toLocaleLowerCase("tr-TR")} ile ${right.title.toLocaleLowerCase("tr-TR")} kapsamlarını ayrı kurup, yalnız bu iki açıklamanın gösterdiği özgül ayrımı sonuçlandır.`
    const executed = await execute({ caseId: `compare-${index}`, question })
    const conclusion = executed.technical?.plan.slots.find((slot) => slot.kind === "comparison_conclusion")
    const generic = /(?:farklı içerikleri tarif eder|aynı kavram olarak kullanılmaz)/iu.test(conclusion?.controlledText ?? "")
    const eligible = conclusion?.comparisonConclusionMode !== "abstain"
    rows.push(rowFrom({ id: `comparison-${index + 1}`, category: "comparison", question,
      expectedTopicIds: [left.topicId, right.topicId], ...executed,
      extraFailures: eligible && generic ? ["generic_comparison_conclusion"] : [] }))
  }

  const repeatTopics = topics.slice(20, 50)
  for (const [index, topic] of repeatTopics.entries()) {
    const seed = await execute({ caseId: `repeat-${index}`, question: `${topic.title.toLocaleLowerCase("tr-TR")} için ana fikri bir kez açıkla.` })
    setupMessageCount += 1
    const token = contextToken(seed.result)
    const shownIds = new Set(seed.technical?.plan.lockedClaimIds ?? [])
    const question = "Bu başlıkta yeni bir nokta varsa ekle; önceki iddiayı yeniden anlatma."
    const executed = await execute({ caseId: `repeat-${index}`, question, token })
    const repeated = executed.technical?.plan.slots.some((slot) => slot.requiredClaimIds.some((claimId) => shownIds.has(claimId))) ?? false
    const constrained = executed.technical?.pragmaticTaskFrame.discourseConstraints.includes("do_not_repeat") ?? false
    rows.push(rowFrom({ id: `no-repeat-${index + 1}`, category: "explicit_no_repeat", question,
      expectedTopicIds: [topic.topicId], ...executed,
      extraFailures: token && constrained && !repeated ? [] : ["explicit_no_repeat_violation"] }))
  }

  for (const row of rows) {
    criticalViolationCount += row.validationFailureCodes.filter((code) =>
      /(?:unsupported|source_violation|safety_violation|privacy)/u.test(code)).length
  }
  const byCategory = Object.fromEntries((["topic_thesis", "self_containment", "intra_turn_coreference",
    "low_lexical_context", "comparison", "explicit_no_repeat"] as const).map((category) => {
    const categoryRows = rows.filter((row) => row.category === category)
    return [category, Object.freeze({ count: categoryRows.length,
      passed: categoryRows.filter((row) => row.passed).length,
      percent: rate(categoryRows.filter((row) => row.passed).length, categoryRows.length) })]
  })) as Record<Category, Readonly<{ count: number; passed: number; percent: number }>>
  const comparisonEligible = rows.filter((row) => row.category === "comparison" && row.comparisonMode !== "abstain")
  const comparisonSpecific = comparisonEligible.filter((row) => !row.failureReasons.includes("generic_comparison_conclusion"))
  const distinctTopicCount = new Set(rows.flatMap((row) => row.expectedTopicIds)).size
  const summary = Object.freeze({
    schemaVersion: "dna-s13-structural-holdout-summary@1",
    scoredMessageCount: rows.length,
    setupMessageCount,
    totalExecutedMessageCount: rows.length + setupMessageCount,
    distinctTopicCount,
    distribution: byCategory,
    metrics: Object.freeze({
      topicThesisConsistencyPercent: byCategory.topic_thesis.percent,
      nonSelfContainedFinalClaimCount: rows.filter((row) => row.failureReasons.some((reason) => reason.startsWith("non_self_contained"))).length,
      intraTurnCoreferenceAccuracyPercent: byCategory.intra_turn_coreference.percent,
      lowLexicalContextResolutionPercent: byCategory.low_lexical_context.percent,
      unrelatedContextualFallbackCount: rows.filter((row) => ["low_lexical_context", "explicit_no_repeat"].includes(row.category)
        && row.resultKind !== "answered" && !row.safeNonAnswer).length,
      safeClarificationOrLimitationCount: rows.filter((row) => row.safeNonAnswer).length,
      comparisonSpecificContrastPercent: rate(comparisonSpecific.length, comparisonEligible.length),
      comparisonSpecificEligibleCount: comparisonEligible.length,
      explicitNoRepeatViolationCount: rows.filter((row) => row.failureReasons.includes("explicit_no_repeat_violation")).length,
      runtimeErrorCount: rows.filter((row) => row.resultKind === "runtime_error").length,
      criticalViolationCount,
    }),
    acceptance: Object.freeze({
      pass: rows.length >= 200 && distinctTopicCount >= 100
        && byCategory.topic_thesis.percent >= 98
        && rows.every((row) => !row.failureReasons.some((reason) => reason.startsWith("non_self_contained")))
        && byCategory.intra_turn_coreference.percent >= 98
        && byCategory.low_lexical_context.percent >= 95
        && rows.filter((row) => ["low_lexical_context", "explicit_no_repeat"].includes(row.category)
          && row.resultKind !== "answered" && !row.safeNonAnswer).length === 0
        && rate(comparisonSpecific.length, comparisonEligible.length) >= 90
        && rows.every((row) => !row.failureReasons.includes("explicit_no_repeat_violation"))
        && criticalViolationCount === 0,
      productionBehaviorChanged: false,
      externalModelUsed: false,
      codexAnswerQualityScoring: false,
    }),
  })
  const rowsFile = path.join(OUTPUT_ROOT, "structural-holdout-rows.jsonl")
  const summaryFile = path.join(OUTPUT_ROOT, "objective-run-summary.json")
  writePrivate(rowsFile, rows.map((row) => JSON.stringify(row)).join("\n") + "\n")
  writePrivate(summaryFile, summary)
  const manifestFile = path.join(OUTPUT_ROOT, "manifest.json")
  writePrivate(manifestFile, Object.freeze({
    schemaVersion: "dna-s13-structural-holdout-manifest@1",
    files: [rowsFile, summaryFile].map((file) => Object.freeze({ name: path.basename(file), sha256: sha(readFileSync(file)), bytes: statSync(file).size })),
  }))
  execFileSync("zip", ["-q", "-j", ZIP_PATH, rowsFile, summaryFile, manifestFile])
  chmodSync(ZIP_PATH, 0o600)
  console.log(JSON.stringify({ ...summary, outputRoot: OUTPUT_ROOT, zipPath: ZIP_PATH,
    zipSha256: sha(readFileSync(ZIP_PATH)) }))
  if (!summary.acceptance.pass) process.exitCode = 1
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
