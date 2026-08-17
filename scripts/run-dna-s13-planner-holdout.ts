import { createHash, randomUUID } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import denseKnowledgeRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import type { DnaS13RequestedFacet } from "../src/lib/dna/chat/s13/contracts"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import { hashDnaS13LimitedIdentifier } from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import {
  runDnaS13LimitedRolloutMessage,
  type DnaS13LimitedTechnicalEvidence,
} from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import { DeterministicRealizer } from "../src/lib/dna/chat/s13/strictRealizer"

type Topic = Readonly<{ title: string; topicId: string }>
type HoldoutCase = Readonly<{
  id: string
  category: string
  question: string
  expectedFacets: readonly DnaS13RequestedFacet[]
  expectedTopicIds: readonly string[]
}>

const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const RUN_ID = process.argv.find((value) => value.startsWith("--run-id="))?.slice(9)
  || "evidence-semantics-run-001"
if (!/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(RUN_ID)) throw new Error("planner_holdout_run_id_invalid")
const EVAL002_BLIND = path.join(SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/external-blind-evaluation/002/blind-conversations.json")
const OUTPUT_DIR = path.join(SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/planner-holdout", RUN_ID)
const JARGON = /(?:kilitli içerik|locked claim|\bclaim\b|\bfacet\w*\b|system\.facet-boundary|\bcatalog\b|\bkatalog\b|\btopicid\b|\brequiredclaim\b)/iu

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function sameSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value) => right.includes(value))
}

function eval002UserText() {
  const rows = JSON.parse(readFileSync(EVAL002_BLIND, "utf8")) as readonly Readonly<{
    turns: readonly Readonly<{ role: string; text: string }>[]
  }>[]
  return normalizeDnaChatText(rows.flatMap((row) => row.turns
    .filter((turn) => turn.role === "user").map((turn) => turn.text)).join("\n"))
}

function topics(): readonly Topic[] {
  const seenText = eval002UserText()
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ title?: string; topicId?: string }>[]
  }).units
  return Object.freeze([...new Map(units.flatMap((unit) => {
    const title = String(unit.title || "").trim()
    const topicId = String(unit.topicId || "").trim()
    if (title.length < 8 || title.length > 70 || title.includes("·")) return []
    const normalized = normalizeDnaChatText(title)
    if (seenText.includes(normalized)
      || /\b(?:klinik|vaka|olgu|danisan|hasta|tani|tedavi|otizm|dehb)\w*\b/u.test(normalized)) return []
    const resolved = resolveDnaS13NamedTopicSurfaces(title)
    if (resolved.length !== 1 || resolved[0]?.topicId !== topicId) return []
    if (!inspectDnaS13LimitedRolloutPrivacy({ question: `${title} ne demek?`, mode: "theory" }).allowed) return []
    return [[`${topicId}\u0000${title}`, Object.freeze({ title, topicId })] as const]
  })).values()].sort((left, right) => sha(`holdout:${left.topicId}`).localeCompare(sha(`holdout:${right.topicId}`))))
}

function cases(pool: readonly Topic[]): readonly HoldoutCase[] {
  const categories = Object.freeze([
    Object.freeze({ name: "core_function_boundary", facets: ["core_scope", "function", "boundary"] as const,
      question: (a: Topic) => `${a.title} için ana kapsamı, işlevi ve yorum sınırını birlikte çözümle.` }),
    Object.freeze({ name: "what_does_it_mean", facets: ["definition"] as const,
      question: (a: Topic) => `${a.title} ifadesi tam olarak ne demek?` }),
    Object.freeze({ name: "why_important", facets: ["function"] as const,
      question: (a: Topic) => `${a.title} neden önemli ve hangi işlevsel anlamı taşır?` }),
    Object.freeze({ name: "example", facets: ["verified_example"] as const,
      question: (a: Topic) => `${a.title} için kaynakla sınırlı somut bir örnek verir misin?` }),
    Object.freeze({ name: "limitation", facets: ["limitation"] as const,
      question: (a: Topic) => `${a.title} açıklamasının sınırlılığı nedir?` }),
    Object.freeze({ name: "components", facets: ["components"] as const,
      question: (a: Topic) => `${a.title} hangi bileşenlerden veya unsurlardan oluşur?` }),
    Object.freeze({ name: "multi_facet", facets: ["definition", "function", "verified_example"] as const,
      question: (a: Topic) => `${a.title} nedir, ne işe yarar ve doğrulanmış bir örneği var mı?` }),
    Object.freeze({ name: "deepen", facets: ["function", "boundary", "core_scope"] as const,
      question: (a: Topic) => `${a.title} başlığını biraz derinleştir: işlev, sınır ve temel çerçeveyi ayır.` }),
  ])
  if (pool.length < 140) throw new Error(`planner_holdout_topic_pool_too_small:${pool.length}`)
  const rows: HoldoutCase[] = []
  let cursor = 0
  let comparisonCursor = 0
  const takeSingle = (question: (topic: Topic) => string) => {
    while (cursor < pool.length) {
      const topic = pool[cursor++]!
      const text = question(topic)
      if (inspectDnaS13LimitedRolloutPrivacy({ question: text, mode: "theory" }).allowed) {
        return Object.freeze({ topic, question: text })
      }
    }
    throw new Error("planner_holdout_safe_single_topic_pool_exhausted")
  }
  const takeComparison = () => {
    while (comparisonCursor + 1 < pool.length) {
      const a = pool[comparisonCursor++]!
      const b = pool[comparisonCursor++]!
      const question = `${a.title} ile ${b.title} arasındaki fark nedir? İkisini ayrı açıkla.`
      if (inspectDnaS13LimitedRolloutPrivacy({ question, mode: "theory" }).allowed) {
        return Object.freeze({ a, b, question })
      }
    }
    throw new Error("planner_holdout_safe_comparison_topic_pool_exhausted")
  }
  for (let index = 0; index < 14; index += 1) {
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
      const category = categories[categoryIndex]!
      const selected = takeSingle(category.question)
      rows.push(Object.freeze({
        id: `holdout-${String(rows.length + 1).padStart(3, "0")}`,
        category: category.name,
        question: selected.question,
        expectedFacets: Object.freeze([...category.facets]),
        expectedTopicIds: Object.freeze([selected.topic.topicId]),
      }))
    }
    const comparison = takeComparison()
    rows.push(Object.freeze({
      id: `holdout-${String(rows.length + 1).padStart(3, "0")}`,
      category: "comparison",
      question: comparison.question,
      expectedFacets: Object.freeze(["definition"] as DnaS13RequestedFacet[]),
      expectedTopicIds: Object.freeze([comparison.a.topicId, comparison.b.topicId]),
    }))
  }
  return Object.freeze(rows)
}

async function main() {
  const pool = topics()
  const fixture = cases(pool)
  const realizer = new DeterministicRealizer()
  const telemetrySecret = "dna-s13-planner-holdout-telemetry-secret-001"
  const results: Record<string, unknown>[] = []
  for (const row of fixture) {
    const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: row.question, mode: "theory" })
    if (!privacy.allowed) throw new Error(`planner_holdout_privacy_rejected:${row.id}:${privacy.reasonCodes.join(",")}:${row.question}`)
    let technical: DnaS13LimitedTechnicalEvidence | null = null
    const result = await runDnaS13LimitedRolloutMessage({
      requestId: randomUUID(),
      subjectId: `planner-holdout-${row.id}`,
      subjectIdHash: hashDnaS13LimitedIdentifier({
        secret: telemetrySecret, kind: "subject", value: `planner-holdout-${row.id}`,
      })!,
      conversationIdHash: hashDnaS13LimitedIdentifier({
        secret: telemetrySecret, kind: "conversation", value: `planner-holdout-conversation-${row.id}`,
      })!,
      sessionId: `planner-holdout-session-${row.id}`,
      question: row.question,
      responseDepth: "standard",
      privacy,
      rolloutPhase: "L0",
      realizer,
      technicalObserver: (value) => { technical = value },
    })
    const evidence = technical as DnaS13LimitedTechnicalEvidence | null
    const actualFacets = evidence?.queryFrame.subquestions.flatMap((subquestion) => subquestion.requestedFacets ?? []) ?? []
    const actualTopicIds = evidence?.queryFrame.subquestions.map((subquestion) => subquestion.topicId) ?? []
    const answer = result.kind === "answered" ? String(result.body.summary || "") : ""
    const validation = evidence?.runtime.finalValidation ?? null
    results.push(Object.freeze({
      ...row,
      actualFacets,
      actualTopicIds,
      facetEvidenceMatrix: evidence?.plan.facetEvidenceMatrix ?? [],
      facetExtractionPass: sameSet([...new Set(actualFacets)], [...new Set(row.expectedFacets)]),
      targetTopicPass: sameSet([...new Set(actualTopicIds)], [...new Set(row.expectedTopicIds)]),
      answered: result.kind === "answered",
      syntheticEvidenceCount: evidence?.plan.lockedClaimIds.filter((id) => id.startsWith("system.facet-boundary:")).length ?? 0,
      internalJargonCount: JARGON.test(answer) ? 1 : 0,
      directSupportedFacetCount: validation?.directSupportedFacetCount ?? 0,
      derivedSupportedFacetCount: validation?.derivedSupportedFacetCount ?? 0,
      unsupportedFacetCount: validation?.unsupportedFacetCount ?? 0,
      omittedSupportedFacetCount: validation?.omittedSupportedFacetCount ?? 0,
      criticalViolationCount: result.telemetry.validation.unsupportedFactCount
        + result.telemetry.validation.unsupportedRelationCount
        + result.telemetry.validation.sourceViolationCount
        + result.telemetry.validation.safetyViolationCount
        + result.telemetry.crossAccountViolationCount,
      failureCodes: result.telemetry.validation.failureCodes,
      answerSha256: answer ? sha(answer) : null,
    }))
  }
  const count = results.length
  const facetPassed = results.filter((row) => row.facetExtractionPass).length
  const wrongTopicCount = results.filter((row) => !row.targetTopicPass).length
  const summary = Object.freeze({
    schemaVersion: "dna-s13-planner-holdout@1",
    createdAt: new Date().toISOString(),
    queryCount: count,
    freshAgainstEval002: true,
    expectedAnswerTextStored: false,
    facetExtraction: Object.freeze({ passed: facetPassed, total: count, percent: Number((facetPassed / count * 100).toFixed(3)) }),
    wrongTopic: Object.freeze({ count: wrongTopicCount, total: count, percent: Number((wrongTopicCount / count * 100).toFixed(3)) }),
    syntheticEvidenceCoverageCount: results.reduce((sum, row) => sum + Number(row.syntheticEvidenceCount), 0),
    internalJargonCount: results.reduce((sum, row) => sum + Number(row.internalJargonCount), 0),
    criticalViolationCount: results.reduce((sum, row) => sum + Number(row.criticalViolationCount), 0),
    evidence: Object.freeze({
      direct: results.reduce((sum, row) => sum + Number(row.directSupportedFacetCount), 0),
      derived: results.reduce((sum, row) => sum + Number(row.derivedSupportedFacetCount), 0),
      unsupported: results.reduce((sum, row) => sum + Number(row.unsupportedFacetCount), 0),
      omitted: results.reduce((sum, row) => sum + Number(row.omittedSupportedFacetCount), 0),
    }),
    acceptance: Object.freeze({
      facetExtractionAtLeast95: facetPassed / count >= 0.95,
      wrongTopicAtMost5: wrongTopicCount / count <= 0.05,
      noSyntheticEvidenceCoverage: results.every((row) => row.syntheticEvidenceCount === 0),
      noInternalJargon: results.every((row) => row.internalJargonCount === 0),
      noCriticalViolations: results.every((row) => row.criticalViolationCount === 0),
    }),
  })
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  const fixturePath = path.join(OUTPUT_DIR, "holdout-annotations.json")
  const resultsPath = path.join(OUTPUT_DIR, "planner-results.jsonl")
  const summaryPath = path.join(OUTPUT_DIR, "summary.json")
  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, { mode: 0o600 })
  writeFileSync(resultsPath, `${results.map((row) => JSON.stringify(row)).join("\n")}\n`, { mode: 0o600 })
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
  ;[fixturePath, resultsPath, summaryPath].forEach((file) => chmodSync(file, 0o600))
  if (!Object.values(summary.acceptance).every(Boolean)) {
    console.error(JSON.stringify({ ok: false, outputDir: OUTPUT_DIR, ...summary }))
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify({ ok: true, outputDir: OUTPUT_DIR, ...summary }))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
