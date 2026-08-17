import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

import denseKnowledgeRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { calculateDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { getDnaOwnerBookTopicClaims, resolveDnaOwnerBookTopic } from "../src/lib/dna/chat/ownerBookRuntime"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import { hashDnaS13LimitedIdentifier, sealDnaS13LimitedContext } from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import { runDnaS13LimitedRolloutMessage, type DnaS13LimitedTechnicalEvidence } from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import { LunaRealizer } from "../src/lib/dna/chat/s13/strictLunaRealizer.server"
import { DeterministicRealizer, type DnaS13RealizerAttempt, type DnaS13RealizerRequest, type Realizer } from "../src/lib/dna/chat/s13/strictRealizer"
import { resolveDnaS13FacetEvidence } from "../src/lib/dna/chat/s13/strictPlanner"
import { claimRoleSupportsFacet, createDnaS13TopicSemanticFrame, ownerTopicClaimToDnaS13Claim } from "../src/lib/dna/chat/s13/topicSemantic"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const LOCAL_PREFLIGHT = process.argv.includes("--local-preflight")
const RUN_ID = process.argv.find((value) => value.startsWith("--run-id="))?.slice(9)
  || `chat-consolidation-${new Date().toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z")}`
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUTPUT_PARENT = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/chat-consolidation-holdout")
const OUTPUT_DIR = path.join(OUTPUT_PARENT, `run-${RUN_ID}${LOCAL_PREFLIGHT ? "-local-preflight" : ""}`)
const ZIP_PATH = path.join(OUTPUT_PARENT, `DNA_S13_CHAT_CONSOLIDATION_HOLDOUT_${RUN_ID}${LOCAL_PREFLIGHT ? "_LOCAL_PREFLIGHT" : ""}.zip`)
const CASES_PATH = path.join(OUTPUT_DIR, "holdout-cases.jsonl")
const SUMMARY_PATH = path.join(OUTPUT_DIR, "objective-summary.json")
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json")
const HARD_CAP_MICROUSD = 750_000

type Topic = Readonly<{ topicId: string; title: string; core: boolean; definition: boolean; function: boolean; strictFunction: boolean }>
type Case = Readonly<{
  id: string
  category: "correction" | "simplify" | "mixed_slots"
  question: string
  contextTopic: Topic | null
  expectedActiveTopicIds: readonly string[]
  expectedAction: "CORRECT_TARGET" | "SIMPLIFY" | "EXPLAIN"
}>

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function percent(numerator: number, denominator: number): number {
  return denominator ? Number((numerator / denominator * 100).toFixed(3)) : 100
}

function writePrivate(file: string, value: string | unknown) {
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

function topicPool(): readonly Topic[] {
  const units = (denseKnowledgeRuntimeJson as unknown as { units: readonly Readonly<{ topicId?: string; title?: string }>[] }).units
  const topics = [...new Map(units.flatMap((row) => {
    const topicId = String(row.topicId || "").trim()
    const title = String(row.title || "").trim()
    if (title.length < 7 || title.length > 68 || title.includes("·")) return []
    return [[topicId, { topicId, title }] as const]
  })).values()].flatMap((topic) => {
    const normalized = normalizeDnaChatText(topic.title)
    if (/\b(?:klinik|vaka|danisan|hasta|tani|tibbi|tedavi|terapi|mudahale|travma|otizm|dehb|bozuk\w*|sendrom|okul|cocuk)\w*\b/u.test(normalized)) return []
    const named = resolveDnaS13NamedTopicSurfaces(topic.title)
    if (named.length !== 1 || named[0]?.topicId !== topic.topicId) return []
    const spoken = topic.title.toLocaleLowerCase("tr-TR")
    const privacyProbes = [
      `Yalnız ${spoken} üzerinde durmak istiyorum.`,
      `${spoken} kısmını jargonsuz ve sade biçimde söyler misin?`,
      `İki sorum var: ${spoken} ne demek; neden önemli?`,
    ]
    if (privacyProbes.some((question) => !inspectDnaS13LimitedRolloutPrivacy({ question, mode: "theory" }).allowed)) return []
    const orderedClaims = getDnaOwnerBookTopicClaims(topic.topicId, true)
    const semantic = createDnaS13TopicSemanticFrame({
      topicId: topic.topicId,
      title: topic.title,
      orderedClaims,
    })
    const selfContained = semantic.claims.filter((claim) => claim.selfContained)
    const strictFunction = resolveDnaS13FacetEvidence({
      subquestionId: "pool",
      topicId: topic.topicId,
      requestedFacets: ["function"],
      candidates: orderedClaims.map(ownerTopicClaimToDnaS13Claim),
      strictSignificance: true,
      topicSemanticFrame: semantic,
    }).matrix.some((entry) => entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
    return [Object.freeze({
      ...topic,
      core: selfContained.some((claim) => claimRoleSupportsFacet(claim.role, "core_scope")),
      definition: selfContained.some((claim) => claimRoleSupportsFacet(claim.role, "definition")),
      function: selfContained.some((claim) => claimRoleSupportsFacet(claim.role, "function")),
      strictFunction,
    })]
  }).sort((left, right) => sha(`chat-consolidation:${left.topicId}`).localeCompare(sha(`chat-consolidation:${right.topicId}`)))
  if (topics.length < 120) throw new Error(`chat_consolidation_topic_pool_too_small:${topics.length}`)
  return Object.freeze(topics)
}

function buildCases(topics: readonly Topic[]): readonly Case[] {
  const rows: Case[] = []
  let cursor = 0
  const next = () => topics[cursor++ % topics.length]!
  const add = (category: Case["category"], question: string, contextTopic: Topic | null,
    expectedActiveTopicIds: readonly string[], expectedAction: Case["expectedAction"]) => {
    rows.push(Object.freeze({
      id: `consolidation-${String(rows.length + 1).padStart(3, "0")}`,
      category, question, contextTopic,
      expectedActiveTopicIds: Object.freeze([...expectedActiveTopicIds]), expectedAction,
    }))
  }
  const correctionForms = [
    (oldTitle: string, nextTitle: string) => `${oldTitle} yerine ${nextTitle} demek istiyordum; cevabı ona göre düzeltir misin?`,
    (oldTitle: string, nextTitle: string) => `${oldTitle} değil ${nextTitle}; yalnız ikinci başlıkta kalalım.`,
    (oldTitle: string, nextTitle: string) => `${oldTitle} demek istemedim, ${nextTitle} konusunu soruyorum.`,
    (_oldTitle: string, nextTitle: string) => `Öncekini bırakalım; ${nextTitle} tarafını anlatır mısın?`,
    (_oldTitle: string, nextTitle: string) => `Yalnız ${nextTitle} üzerinde durmak istiyorum.`,
  ] as const
  for (let index = 0; index < 100; index += 1) {
    const oldTopic = next(); const activeTopic = next()
    add("correction", correctionForms[index % correctionForms.length]!(oldTopic.title.toLocaleLowerCase("tr-TR"), activeTopic.title.toLocaleLowerCase("tr-TR")),
      oldTopic, [activeTopic.topicId], "CORRECT_TARGET")
  }
  const simplifyForms = [
    (title: string) => `${title} açıklaması çok teknik oldu; daha kolay anlatır mısın?`,
    (title: string) => `${title} konusunu gündelik dille yeniden söyler misin?`,
    (title: string) => `${title} biraz ağır geldi, insan gibi anlatır mısın?`,
    (title: string) => `${title} için daha basit bir anlatım kullanır mısın?`,
    (title: string) => `${title} kavramını bir çocuk anlayacak gibi açıklar mısın?`,
    (title: string) => `${title} kısmını jargonsuz ve sade biçimde söyler misin?`,
  ] as const
  for (let index = 0; index < 60; index += 1) {
    const topic = next()
    add("simplify", simplifyForms[index % simplifyForms.length]!(topic.title.toLocaleLowerCase("tr-TR")),
      topic, [topic.topicId], "SIMPLIFY")
  }
  const supported = topics.filter((topic) => topic.strictFunction)
  const unsupportedFunction = topics.filter((topic) => !topic.strictFunction)
  if (!supported.length || !unsupportedFunction.length) throw new Error("chat_consolidation_mixed_pool_too_small")
  let mixedIndex = 0
  let mixedAttempts = 0
  while (mixedIndex < 40 && mixedAttempts < 2_000) {
    const left = supported[mixedAttempts % supported.length]!
    const right = unsupportedFunction[(mixedAttempts * 7) % unsupportedFunction.length]!
    mixedAttempts += 1
    if (left.topicId === right.topicId) continue
    const question = `İki ayrı sorum var: ${left.title.toLocaleLowerCase("tr-TR")} ne işe yarar; ${right.title.toLocaleLowerCase("tr-TR")} ne işe yarar? İkisini de sırayla yanıtlar mısın?`
    const resolved = resolveDnaS13NamedTopicSurfaces(question, [], 8)
    if (resolved.length !== 2 || !resolved.some((topic) => topic.topicId === left.topicId)
      || !resolved.some((topic) => topic.topicId === right.topicId)) continue
    add("mixed_slots", question, null, [left.topicId, right.topicId], "EXPLAIN")
    mixedIndex += 1
  }
  if (rows.length !== 200) throw new Error(`chat_consolidation_shape_invalid:${rows.length}`)
  return Object.freeze(rows)
}

function contextClaimId(topic: Topic) {
  return resolveDnaOwnerBookTopic(topic.topicId, "temel açıklamayı ver", "standard")?.claimIds[0] ?? null
}

function tokenBigrams(value: string) {
  const tokens = normalizeDnaChatText(value).split(" ").filter(Boolean)
  return new Set(tokens.length < 2 ? tokens : tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`))
}

function similarity(left: string, right: string) {
  const a = tokenBigrams(left); const b = tokenBigrams(right); const union = new Set([...a, ...b])
  return union.size ? [...a].filter((value) => b.has(value)).length / union.size : 0
}

class CappedLunaRealizer implements Realizer {
  private readonly inner: LunaRealizer
  private usages: DnaChatLunaUsage[] = []
  private callCount = 0
  readonly identity
  constructor(apiKey: string) {
    this.inner = new LunaRealizer({ apiKey, safetyIdentifier: `chat-consolidation:${sha(RUN_ID).slice(0, 24)}` })
    this.identity = this.inner.identity
  }
  usage() {
    return this.usages.reduce<DnaChatLunaUsage>((total, value) => ({
      inputTokens: total.inputTokens + value.inputTokens,
      cachedInputTokens: total.cachedInputTokens + value.cachedInputTokens,
      outputTokens: total.outputTokens + value.outputTokens,
      costMicrousd: total.costMicrousd + value.costMicrousd,
    }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 })
  }
  calls() {
    return this.callCount
  }
  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    if (this.usage().costMicrousd + 25_000 > HARD_CAP_MICROUSD) throw new Error("chat_consolidation_luna_cap")
    this.callCount += 1
    const result = await this.inner.realize(input)
    this.usages.push(calculateDnaChatLunaUsage(result.usage))
    if (this.usage().costMicrousd > HARD_CAP_MICROUSD) throw new Error("chat_consolidation_luna_cap_exceeded")
    return result
  }
}

async function main() {
  if (!existsSync(SSD_ROOT)) throw new Error("research_ssd_not_mounted")
  const topics = topicPool()
  const cases = buildCases(topics)
  const privacyRejected = cases.filter((row) => !inspectDnaS13LimitedRolloutPrivacy({ question: row.question, mode: "theory" }).allowed)
  if (privacyRejected.length) throw new Error(`chat_consolidation_privacy_fixture_invalid:${privacyRejected.length}:${privacyRejected[0]?.question}`)
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  writePrivate(CASES_PATH, "")
  const contextSecret = sha(`${RUN_ID}:context`)
  const telemetrySecret = sha(`${RUN_ID}:telemetry`)
  const apiKey = process.env.OPENAI_API_KEY?.trim() || ""
  if (!LOCAL_PREFLIGHT && !apiKey) throw new Error("openai_api_key_missing")
  const cappedLuna = LOCAL_PREFLIGHT ? null : new CappedLunaRealizer(apiKey)
  const results: any[] = []
  for (const [index, row] of cases.entries()) {
    const subjectId = `chat-consolidation-subject-${index + 1}`
    const sessionId = `chat-consolidation-session-${index + 1}`
    const subjectIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "subject", value: subjectId })!
    const conversationIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "conversation", value: sessionId })!
    const shownClaimId = row.contextTopic ? contextClaimId(row.contextTopic) : null
    const contextToken = row.contextTopic ? sealDnaS13LimitedContext({
      masterSecret: contextSecret, subjectId, topicIds: [row.contextTopic.topicId], activeTopicId: row.contextTopic.topicId,
      focus: "definition", questionType: "definition", responseDepth: "standard",
      shownClaimIds: shownClaimId ? [shownClaimId] : [], answeredFacets: ["definition", "core_scope"], shownRelationIds: [],
    }) : null
    let technical: DnaS13LimitedTechnicalEvidence | null = null
    let response: Awaited<ReturnType<typeof runDnaS13LimitedRolloutMessage>> | null = null
    let error: string | null = null
    try {
      response = await runDnaS13LimitedRolloutMessage({
        requestId: randomUUID(), subjectId, subjectIdHash, conversationIdHash, sessionId,
        question: row.question, responseDepth: "standard", contextToken, contextSecret,
        privacy: inspectDnaS13LimitedRolloutPrivacy({ question: row.question, mode: "theory" }), rolloutPhase: "L0",
        realizer: cappedLuna ?? new DeterministicRealizer(), technicalObserver: (value) => { technical = value },
      })
    } catch (caught) { error = caught instanceof Error ? caught.message : "unknown_runtime_error" }
    const evidence = technical as DnaS13LimitedTechnicalEvidence | null
    const task = evidence?.pragmaticTaskFrame ?? null
    const active = task?.targets.filter((target) => target.polarity === "ACTIVE_TARGET").map((target) => target.topicId) ?? []
    const rejected = task?.targets.filter((target) => target.polarity === "REJECTED_TARGET").map((target) => target.topicId) ?? []
    const answer = response?.kind === "answered" ? String(response.body.summary || "").trim() : ""
    const lockedText = evidence?.plan.slots.flatMap((slot) => slot.lockedClaims.map((entry) => entry.claim.text)).join(" ") ?? ""
    const validation = evidence?.runtime.finalValidation ?? null
    const critical = response ? response.telemetry.validation.unsupportedFactCount + response.telemetry.validation.unsupportedRelationCount
      + response.telemetry.validation.sourceViolationCount + response.telemetry.validation.safetyViolationCount
      + response.telemetry.crossAccountViolationCount : 0
    const record = Object.freeze({
      schemaVersion: "dna-s13-chat-consolidation-holdout@1", id: row.id, category: row.category,
      questionHash: sha(row.question), expectedAction: row.expectedAction, expectedActiveTopicIds: row.expectedActiveTopicIds,
      actualAction: task?.pragmaticAction ?? null, activeTargetIds: active, rejectedTargetIds: rejected,
      correctionAccurate: row.category !== "correction" || (task?.pragmaticAction === "CORRECT_TARGET"
        && task.targetResolution === "REPLACED_TARGET" && active.length === 1 && active[0] === row.expectedActiveTopicIds[0]),
      rejectedTargetLeakage: validation?.correctionRejectedTargetLeakCount ?? 0,
      multiTargetFalsePositive: row.category === "correction" && active.length > 1,
      simplifyResolved: row.category !== "simplify" || task?.pragmaticAction === "SIMPLIFY",
      scientificClaimDrift: validation ? validation.unsupportedAdditionCount + validation.unsupportedRelationCount
        + validation.sourceViolationCount + validation.falseSignificanceSupportCount + validation.facetEntailmentFalsePositiveCount : 0,
      simplifyExactOrNearRepeat: row.category === "simplify" && (normalizeDnaChatText(answer) === normalizeDnaChatText(lockedText)
        || similarity(answer, lockedText) >= 0.9),
      requestedSlotCount: validation?.requestedSlotCount ?? 0,
      answeredSupportedSlotCount: validation?.answeredSupportedSlotCount ?? 0,
      answeredUnsupportedSlotCount: validation?.answeredUnsupportedSlotCount ?? 0,
      silentlyDroppedRequestedSlotCount: validation?.silentlyDroppedRequestedSlotCount ?? 0,
      mixedSupportedUnsupported: row.category !== "mixed_slots" || Boolean((evidence?.plan.facetEvidenceMatrix ?? []).some((entry) => entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
        && (evidence?.plan.facetEvidenceMatrix ?? []).some((entry) => entry.status === "UNSUPPORTED")),
      outputStatus: response?.kind ?? "runtime_error", blankResponse: !answer, wrongTopicFallback: response?.kind === "fallback",
      criticalViolationCount: critical, runtimeError: error, validatorPass: validation?.pass ?? false,
    })
    results.push(record)
    writeFileSync(CASES_PATH, `${JSON.stringify(record)}\n`, { flag: "a", mode: 0o600 })
  }
  const correction = results.filter((row) => row.category === "correction")
  const simplify = results.filter((row) => row.category === "simplify")
  const mixed = results.filter((row) => row.category === "mixed_slots")
  const usage = cappedLuna?.usage() ?? { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }
  const summary = Object.freeze({
    schemaVersion: "dna-s13-chat-consolidation-holdout@1:summary@1", runId: RUN_ID,
    localPreflight: LOCAL_PREFLIGHT, messageCount: results.length,
    distribution: Object.freeze({ correction: correction.length, simplify: simplify.length, mixedSupportedUnsupported: mixed.length }),
    correctionAccuracy: percent(correction.filter((row) => row.correctionAccurate).length, correction.length),
    rejectedTargetLeakageCount: correction.reduce((sum, row) => sum + row.rejectedTargetLeakage, 0),
    multiTargetFalsePositiveCount: correction.filter((row) => row.multiTargetFalsePositive).length,
    simplifyResolutionRate: percent(simplify.filter((row) => row.simplifyResolved).length, simplify.length),
    scientificClaimDriftCount: simplify.reduce((sum, row) => sum + row.scientificClaimDrift, 0),
    simplifyExactOrNearRepeatCount: simplify.filter((row) => row.simplifyExactOrNearRepeat).length,
    mixedSupportedUnsupportedCaseCount: mixed.filter((row) => row.mixedSupportedUnsupported).length,
    requestedSlotCount: results.reduce((sum, row) => sum + row.requestedSlotCount, 0),
    answeredSupportedSlotCount: results.reduce((sum, row) => sum + row.answeredSupportedSlotCount, 0),
    answeredUnsupportedSlotCount: results.reduce((sum, row) => sum + row.answeredUnsupportedSlotCount, 0),
    silentlyDroppedRequestedSlotCount: results.reduce((sum, row) => sum + row.silentlyDroppedRequestedSlotCount, 0),
    wrongTopicFallbackCount: results.filter((row) => row.wrongTopicFallback).length,
    blankResponseCount: results.filter((row) => row.blankResponse).length,
    criticalViolationCount: results.reduce((sum, row) => sum + row.criticalViolationCount, 0),
    runtimeErrorCount: results.filter((row) => row.runtimeError).length,
    lunaCalls: cappedLuna?.calls() ?? 0,
    tokenUsage: usage,
    totalCostUsd: Number((usage.costMicrousd / 1_000_000).toFixed(6)),
  })
  const repeatPass = LOCAL_PREFLIGHT || summary.simplifyExactOrNearRepeatCount === 0
  const gate = summary.correctionAccuracy >= 98 && summary.rejectedTargetLeakageCount === 0
    && summary.multiTargetFalsePositiveCount === 0 && summary.simplifyResolutionRate >= 95
    && summary.scientificClaimDriftCount === 0 && repeatPass
    && summary.mixedSupportedUnsupportedCaseCount === 40 && summary.silentlyDroppedRequestedSlotCount === 0
    && summary.wrongTopicFallbackCount === 0 && summary.blankResponseCount === 0
    && summary.criticalViolationCount === 0 && summary.runtimeErrorCount === 0
  const finalSummary = Object.freeze({ ...summary, acceptanceGatePass: gate, conversationEngineStatus: gate ? "STABLE_FREEZE_CANDIDATE" : "NOT_FROZEN" })
  writePrivate(SUMMARY_PATH, finalSummary)
  const files = [CASES_PATH, SUMMARY_PATH]
  writePrivate(MANIFEST_PATH, Object.freeze({
    schemaVersion: "dna-s13-chat-consolidation-holdout@1:manifest@1", runId: RUN_ID,
    productionChanged: false, goldAnswers: false, codexQualityScoring: false, hardCapUsd: HARD_CAP_MICROUSD / 1_000_000,
    files: files.map((file) => ({ name: path.basename(file), bytes: statSync(file).size, sha256: sha(readFileSync(file)) })),
  }))
  execFileSync("zip", ["-q", "-j", ZIP_PATH, ...files, MANIFEST_PATH])
  chmodSync(ZIP_PATH, 0o600)
  console.log(JSON.stringify({ ...finalSummary, zipPath: ZIP_PATH, zipSha256: sha(readFileSync(ZIP_PATH)) }))
  if (!gate) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "chat_consolidation_holdout_failed")
  process.exitCode = 1
})
