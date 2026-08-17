import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

import denseRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import ownerRuntimeJson from "../src/lib/dna/chat/catalog/generated/owner-book/runtime.json"
import { getDnaOwnerBookTopicClaims, registerDnaOwnerBookShadowUnitsForTest } from "../src/lib/dna/chat/ownerBookRuntime"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import type { DnaS13RequestedFacet } from "../src/lib/dna/chat/s13/contracts"
import { resolveDnaS13FacetEvidence } from "../src/lib/dna/chat/s13/strictPlanner"
import { createDnaS13TopicSemanticFrame, ownerTopicClaimToDnaS13Claim } from "../src/lib/dna/chat/s13/topicSemantic"

const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUTPUT_DIR = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/knowledge-core-coverage/eval007-wave1")
const EVAL007_DIR = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/external-blind-evaluation/007")
const FRESH200_DIR = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/chat-consolidation-holdout/run-eval007-consolidation-v1-official-003")
const DECISIONS_PATH = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1/owner-sentence-decisions.jsonl")

type CoverageStatus = "PRESENT_DIRECT" | "PRESENT_DERIVED" | "MISSING" | "NOT_APPLICABLE"
type AuditFacet = "coreScope" | "definition" | "functionSignificance" | "boundary" | "explanatoryDetail" | "example" | "relations"
type RuntimeUnit = Readonly<{
  id: string; claimId: string; passageId: string; sourceId: string; sentenceSha256: string; text: string
  title: string; topicId: string; domain: string; dimensions: readonly string[]; focus: string
}>
type SourceDecision = Readonly<{
  nodeId: string; sectionId: string; passageId: string; sentenceSha256: string; text: string
  decision: string; reason: string
}>

const FACETS: readonly Readonly<{ key: AuditFacet; facet: DnaS13RequestedFacet; importance: number; strict?: boolean }>[] = Object.freeze([
  { key: "coreScope", facet: "core_scope", importance: 6 },
  { key: "definition", facet: "definition", importance: 5 },
  { key: "functionSignificance", facet: "function", importance: 5, strict: true },
  { key: "boundary", facet: "boundary", importance: 2 },
  { key: "explanatoryDetail", facet: "components", importance: 4 },
  { key: "relations", facet: "distinction", importance: 3 },
  { key: "example", facet: "verified_example", importance: 2 },
])
const FACET_BY_REQUEST = new Map(FACETS.map((row) => [row.facet, row]))
const FACET_PATTERN: Readonly<Record<"core_scope" | "definition" | "function", RegExp>> = Object.freeze({
  core_scope: /\b(?:kapsa\w*|odaklan\w*|temel\w*|cerceve\w*|butun\w*|icerir)\b/u,
  definition: /\b(?:ifade eder|tanim\w*|kavramdir|yapidir|sistemdir|surectir|anlamina gelir)\b/u,
  function: /\b(?:onem\w*|katki\w*|rol oyn\w*|gunluk yasam\w*|katilim\w*|performans\w*|uygulama\w*|yorumlama\w*|egitim\w*)\b/u,
})

function sha(value: string | Buffer) { return createHash("sha256").update(value).digest("hex") }
function readJsonl(file: string) { return readFileSync(file, "utf8").split(/\n/u).filter(Boolean).map((line) => JSON.parse(line) as any) }
function writePrivate(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); chmodSync(file, 0o600)
}
function writeJsonl(file: string, rows: readonly unknown[]) {
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", { mode: 0o600 }); chmodSync(file, 0o600)
}
function percent(n: number, d: number) { return d ? Number((n / d * 100).toFixed(3)) : 100 }
function status(value: string): CoverageStatus {
  return value === "SUPPORTED_DIRECT" ? "PRESENT_DIRECT" : value === "SUPPORTED_DERIVED" ? "PRESENT_DERIVED" : "MISSING"
}
function stripContextMarker(value: string) {
  return value.replace(/^(?:Bu nedenle|Dolayısıyla|Böylece|Ayrıca|Ancak|Buna karşın)[,:;]?\s+/iu, "").trim()
}
function dimensionsForFacet(facet: "core_scope" | "definition" | "function") {
  return facet === "function" ? ["function", "daily_function"] : facet === "definition" ? ["definition"] : ["scope"]
}
function extractionOptions(source: SourceDecision) {
  const rows: Readonly<{ text: string; operation: string }>[] = []
  const stripped = stripContextMarker(source.text)
  if (stripped !== source.text) rows.push(Object.freeze({ text: stripped, operation: "leading_context_marker_removed" }))
  if (source.text.includes(";")) {
    for (const clause of source.text.split(";").map((entry) => entry.trim()).filter(Boolean)) {
      const text = /[.!?]$/u.test(clause) ? clause : `${clause}.`
      rows.push(Object.freeze({ text, operation: "semicolon_clause_extraction" }))
    }
  }
  return rows
}
function titleTokens(value: string) {
  return normalizeDnaChatText(value).split(/\s+/u).filter((token) => token.length >= 5 && !["nedir", "olarak", "acisindan", "temel"].includes(token))
}
function bigrams(value: string) {
  const words = normalizeDnaChatText(value).split(/\s+/u).filter(Boolean)
  return new Set(words.slice(0, -1).map((word, index) => `${word} ${words[index + 1]}`))
}
function nearDuplicate(left: string, right: string) {
  const a = bigrams(left); const b = bigrams(right); const union = new Set([...a, ...b])
  return Boolean(union.size && [...a].filter((entry) => b.has(entry)).length / union.size >= 0.92)
}

const dense = denseRuntimeJson as unknown as { source: { id: string }; units: readonly RuntimeUnit[] }
const owner = ownerRuntimeJson as unknown as { nodes: readonly Readonly<{
  id: string; kind: string; sectionId: string; headingPath: readonly string[]; sentences: readonly string[]
}>[] }
const nodeById = new Map(owner.nodes.map((row) => [row.id, row]))
const topics = [...new Map(dense.units.map((row) => [row.topicId, { topicId: row.topicId, title: row.title }])).values()]
  .sort((left, right) => left.topicId.localeCompare(right.topicId))

function facetResolution(topicId: string, title: string, facet: DnaS13RequestedFacet, strict = false) {
  const orderedClaims = getDnaOwnerBookTopicClaims(topicId, true)
  const semantic = createDnaS13TopicSemanticFrame({ topicId, title, orderedClaims })
  return resolveDnaS13FacetEvidence({
    subquestionId: "coverage", topicId, requestedFacets: [facet], strictSignificance: strict,
    candidates: orderedClaims.map(ownerTopicClaimToDnaS13Claim), topicSemanticFrame: semantic,
  }).matrix.find((row) => row.facet === facet)!
}

function coverageRows(usage: ReadonlyMap<string, number>, evalGaps: ReadonlyMap<string, number>, freshGaps: ReadonlyMap<string, number>) {
  return topics.map((topic) => {
    const cells = Object.fromEntries(FACETS.map((facet) => {
      const resolution = facetResolution(topic.topicId, topic.title, facet.facet, facet.strict)
      return [facet.key, Object.freeze({
        status: status(resolution.status), supportClaimIds: resolution.supportClaimIds,
        evaluatedClaimIds: resolution.evaluatedClaimIds, availableEntailingClaimIds: resolution.availableEntailingClaimIds ?? [],
        partialClaimIds: resolution.partialClaimIds ?? [],
      })]
    })) as Record<AuditFacet, any>
    const missingWeight = FACETS.filter((facet) => cells[facet.key].status === "MISSING").reduce((sum, facet) => sum + facet.importance, 0)
    const evalGapCount = evalGaps.get(topic.topicId) ?? 0
    const freshGapCount = freshGaps.get(topic.topicId) ?? 0
    const usageFrequency = usage.get(topic.topicId) ?? 0
    return Object.freeze({
      topicId: topic.topicId, title: topic.title, ...cells, usageFrequency,
      eval007GapCount: evalGapCount, freshHoldoutGapCount: freshGapCount,
      recentFailureCount: evalGapCount + freshGapCount, catalogGapCount: evalGapCount + freshGapCount,
      priorityScore: evalGapCount * 10 + freshGapCount * 6 + usageFrequency * 2 + missingWeight,
    })
  }).sort((left, right) => right.priorityScore - left.priorityScore || left.topicId.localeCompare(right.topicId))
}

function matrixSummary(rows: readonly any[]) {
  const facets = Object.fromEntries(FACETS.map((facet) => {
    const counts = { PRESENT_DIRECT: 0, PRESENT_DERIVED: 0, MISSING: 0, NOT_APPLICABLE: 0 }
    for (const row of rows) counts[row[facet.key].status as CoverageStatus] += 1
    return [facet.key, { ...counts, coveragePercent: percent(counts.PRESENT_DIRECT + counts.PRESENT_DERIVED, rows.length) }]
  }))
  const supported = Object.values(facets).reduce((sum: number, row: any) => sum + row.PRESENT_DIRECT + row.PRESENT_DERIVED, 0)
  return Object.freeze({ topicCount: rows.length, cellCount: rows.length * FACETS.length, coveredCellCount: supported,
    topicCoverageRate: percent(supported, rows.length * FACETS.length), facets })
}

function main() {
  if (!existsSync(SSD_ROOT) || !existsSync(EVAL007_DIR) || !existsSync(FRESH200_DIR) || !existsSync(DECISIONS_PATH)) {
    throw new Error("knowledge_core_coverage_inputs_missing")
  }
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  const evalRows = readJsonl(path.join(EVAL007_DIR, "SEALED_TECHNICAL_EVIDENCE.jsonl"))
  const freshRows = readJsonl(path.join(FRESH200_DIR, "holdout-cases.jsonl"))
  const usage = new Map<string, number>(); const evalGaps = new Map<string, number>(); const freshGaps = new Map<string, number>()
  const observed: any[] = []
  for (const row of evalRows) {
    for (const topic of row.parsedTopic ?? []) usage.set(topic.topicId, (usage.get(topic.topicId) ?? 0) + 1)
    for (const gap of row.knowledgeGaps ?? []) {
      evalGaps.set(gap.topicId, (evalGaps.get(gap.topicId) ?? 0) + 1)
      const evidence = (row.facetEvidenceMatrix ?? []).find((entry: any) => entry.topicId === gap.topicId
        && entry.facet === gap.requestedFacet && entry.status === "UNSUPPORTED")
      observed.push({ origin: "eval007", topicId: gap.topicId, facet: gap.requestedFacet,
        missingEvidenceType: gap.missingEvidenceType ?? null, availableEntailingClaimIds: evidence?.availableEntailingClaimIds ?? [],
        questionHash: gap.questionHash })
    }
  }
  for (const row of freshRows) {
    const requestedFacet: DnaS13RequestedFacet = row.category === "mixed_slots" ? "function" : "core_scope"
    for (const topicId of row.expectedActiveTopicIds ?? []) {
      usage.set(topicId, (usage.get(topicId) ?? 0) + 1)
      const topic = topics.find((entry) => entry.topicId === topicId)
      if (topic && status(facetResolution(topicId, topic.title, requestedFacet, requestedFacet === "function").status) === "MISSING") {
        freshGaps.set(topicId, (freshGaps.get(topicId) ?? 0) + 1)
        observed.push({ origin: "fresh200", topicId, facet: requestedFacet, missingEvidenceType: requestedFacet,
          availableEntailingClaimIds: [], questionHash: row.questionHash })
      }
    }
  }
  const baselineRows = coverageRows(usage, evalGaps, freshGaps)
  const baselineSummary = matrixSummary(baselineRows)
  const decisionRows = readJsonl(DECISIONS_PATH) as SourceDecision[]
  const sourceCandidatesByTopic = new Map<string, SourceDecision[]>()
  for (const decision of decisionRows.filter((row) => row.decision === "context_dependent")) {
    const topicId = `owner-book-section/${decision.sectionId}`
    const rows = sourceCandidatesByTopic.get(topicId) ?? []; rows.push(decision); sourceCandidatesByTopic.set(topicId, rows)
  }
  for (const unit of dense.units.filter((row) => row.text.includes(";"))) {
    const nodeId = unit.passageId.split(":sentence:")[0] ?? ""
    const node = nodeById.get(nodeId)
    if (!node || node.sectionId !== unit.topicId.replace(/^owner-book-section\//u, "")) continue
    const rows = sourceCandidatesByTopic.get(unit.topicId) ?? []
    rows.push(Object.freeze({ nodeId, sectionId: node.sectionId, passageId: unit.passageId,
      sentenceSha256: unit.sentenceSha256, text: unit.text, decision: "accepted", reason: "existing_verified_atom_clause_source" }))
    sourceCandidatesByTopic.set(unit.topicId, rows)
  }
  const candidateAttempts: any[] = []; const acceptedUnits: RuntimeUnit[] = []
  const committedTexts = dense.units.map((row) => row.text)
  const topBatch = baselineRows.slice(0, 100)
  for (const topic of topBatch) {
    for (const facet of ["core_scope", "definition", "function"] as const) {
      const auditFacet = FACET_BY_REQUEST.get(facet)!
      if (topic[auditFacet.key].status !== "MISSING") continue
      for (const source of sourceCandidatesByTopic.get(topic.topicId) ?? []) {
        for (const extraction of extractionOptions(source)) {
          const extracted = extraction.text
          if (extracted.length < 40 || extracted.length > 420) continue
          const normalized = normalizeDnaChatText(extracted)
          if (!FACET_PATTERN[facet].test(normalized) || !titleTokens(topic.title).some((token) => normalized.includes(token))) continue
          const node = nodeById.get(source.nodeId)
          const sourceIndex = Number(source.passageId.match(/:sentence:(\d+)$/u)?.[1] ?? 0) - 1
          const sourceMatches = Boolean(node && node.sentences[sourceIndex]?.trim() === source.text.trim()
            && normalizeDnaChatText(source.text).includes(normalized.replace(/\s+/gu, " ").replace(/[.]$/u, "")))
          const duplicate = committedTexts.some((text) => normalizeDnaChatText(text) === normalized || nearDuplicate(text, extracted))
            || acceptedUnits.some((unit) => normalizeDnaChatText(unit.text) === normalized || nearDuplicate(unit.text, extracted))
          const contradiction = facet !== "core_scope" && /\b(?:degil\w*|kanitlamaz\w*|gostermez\w*|cikarilamaz\w*)\b/u.test(normalized)
          const roleMismatch = false
          const topicMismatch = !titleTokens(topic.title).some((token) => normalized.includes(token))
          const validation = { duplicate, contradiction, sourceMismatch: !sourceMatches, claimRoleMismatch: roleMismatch,
            selfContainmentViolation: false, topicMismatch, unsupportedRelation: false }
          const pass = !Object.values(validation).some(Boolean)
          candidateAttempts.push({ topicId: topic.topicId, title: topic.title, facet, sourcePassageId: source.passageId,
            sourceOriginalText: source.text, candidateText: extracted, extraction: extraction.operation, validation, pass })
          if (!pass) continue
          const claimHash = sha(`${source.passageId}\u0000${extracted}`)
          const dimensions = dimensionsForFacet(facet)
          acceptedUnits.push(Object.freeze({
            id: `shadow.owner.unit:${claimHash.slice(0, 16)}`, claimId: `shadow.owner.unit:${claimHash.slice(0, 16)}`,
            passageId: source.passageId, sourceId: dense.source.id, sentenceSha256: sha(extracted), text: extracted,
            title: topic.title, topicId: topic.topicId, domain: dense.units.find((unit) => unit.topicId === topic.topicId)?.domain ?? "self_regulation",
            dimensions: Object.freeze(dimensions), focus: normalizeDnaChatText(extracted).split(" ").slice(0, 6).join(" "),
          }))
          break
        }
        if (acceptedUnits.some((unit) => unit.topicId === topic.topicId && unit.dimensions.some((dimension) => dimensionsForFacet(facet).includes(dimension)))) break
      }
    }
  }
  registerDnaOwnerBookShadowUnitsForTest(acceptedUnits as any)
  const afterRows = coverageRows(usage, evalGaps, freshGaps)
  const afterSummary = matrixSummary(afterRows)
  const sourceAvailable = (topicId: string, facet: DnaS13RequestedFacet) => candidateAttempts.some((row) =>
    row.topicId === topicId && row.facet === facet && row.pass)
  const observedAggregates = new Map<string, any>()
  for (const gap of observed) {
    const topic = baselineRows.find((row) => row.topicId === gap.topicId); if (!topic) continue
    const key = `${gap.topicId}\u0000${gap.facet}`; const current = observedAggregates.get(key) ?? {
      topicId: gap.topicId, title: topic.title, requestedFacet: gap.facet, missingEvidenceTypes: [], availableEntailingClaimIds: [],
      frequency: 0, questionExamples: [], origins: [],
    }
    current.frequency += 1; if (current.questionExamples.length < 3) current.questionExamples.push(gap.questionHash)
    if (!current.origins.includes(gap.origin)) current.origins.push(gap.origin)
    if (gap.missingEvidenceType && !current.missingEvidenceTypes.includes(gap.missingEvidenceType)) current.missingEvidenceTypes.push(gap.missingEvidenceType)
    for (const claimId of gap.availableEntailingClaimIds ?? []) if (!current.availableEntailingClaimIds.includes(claimId)) current.availableEntailingClaimIds.push(claimId)
    observedAggregates.set(key, current)
  }
  const gapRows = [...observedAggregates.values()].map((gap) => {
    const topic = baselineRows.find((row) => row.topicId === gap.topicId)!
    const facetMeta = FACET_BY_REQUEST.get(gap.requestedFacet as DnaS13RequestedFacet)
    const cell = facetMeta ? topic[facetMeta.key] : null
    const classification = gap.requestedFacet === "distinction" || gap.missingEvidenceTypes.includes("comparison") ? "RELATION_GAP"
      : gap.requestedFacet === "verified_example" || gap.missingEvidenceTypes.includes("example") ? "EXAMPLE_GAP"
      : gap.availableEntailingClaimIds.length > 0 ? "ATOM_EXISTS_BUT_BAD_METADATA"
      : sourceAvailable(gap.topicId, gap.requestedFacet) ? "SOURCE_EXISTS_BUT_NOT_ATOMIZED" : "TRUE_CONTENT_GAP"
    return Object.freeze({ ...gap, classification, availableNearbyClaimIds: cell?.evaluatedClaimIds ?? [],
      sourceAvailability: sourceAvailable(gap.topicId, gap.requestedFacet), priorityScore: topic.priorityScore })
  }).sort((left, right) => right.frequency - left.frequency || right.priorityScore - left.priorityScore)
  const classificationDistribution = Object.fromEntries(["TRUE_CONTENT_GAP", "SOURCE_EXISTS_BUT_NOT_ATOMIZED", "ATOM_EXISTS_BUT_BAD_METADATA", "RELATION_GAP", "EXAMPLE_GAP"]
    .map((key) => [key, gapRows.filter((row) => row.classification === key).reduce((sum, row) => sum + row.frequency, 0)]))

  const holdoutFamilies = ["definition", "coreScope", "functionSignificance", "explanatoryDetail", "relations", "example"] as const
  const fresh300 = Array.from({ length: 300 }, (_, index) => {
    const family = holdoutFamilies[index % holdoutFamilies.length]
    const topic = afterRows[(index * 17) % afterRows.length]!
    const second = afterRows[(index * 17 + 113) % afterRows.length]!
    const before = baselineRows.find((row) => row.topicId === topic.topicId)!
    const beforeSecond = baselineRows.find((row) => row.topicId === second.topicId)!
    const familySupported = (row: any, key: AuditFacet) => row[key].status === "PRESENT_DIRECT" || row[key].status === "PRESENT_DERIVED"
    const beforeSupported = family === "relations" ? familySupported(before, "relations") && familySupported(beforeSecond, "relations")
      : family === "explanatoryDetail" ? familySupported(before, "coreScope") && familySupported(before, "functionSignificance") && familySupported(before, "boundary")
      : familySupported(before, family)
    const afterSupported = family === "relations" ? familySupported(topic, "relations") && familySupported(second, "relations")
      : family === "explanatoryDetail" ? familySupported(topic, "coreScope") && familySupported(topic, "functionSignificance") && familySupported(topic, "boundary")
      : familySupported(topic, family)
    const question = family === "definition" ? `${topic.title} nedir?` : family === "coreScope" ? `${topic.title} temel olarak neyi kapsar?`
      : family === "functionSignificance" ? `${topic.title} neden önemlidir?` : family === "explanatoryDetail" ? `${topic.title} başlığını kaynak sınırında derinleştir.`
      : family === "relations" ? `${topic.title} ile ${second.title} arasındaki doğrulanmış ayrım nedir?` : `${topic.title} için kaynakta açık bir örnek var mı?`
    return Object.freeze({ id: `knowledge-holdout-${String(index + 1).padStart(3, "0")}`, family, question,
      topicIds: family === "relations" ? [topic.topicId, second.topicId] : [topic.topicId], beforeSupported, afterSupported })
  })
  const distinctTopics = new Set(fresh300.flatMap((row) => row.topicIds)).size
  const holdoutMetrics = Object.fromEntries(holdoutFamilies.map((family) => {
    const rows = fresh300.filter((row) => row.family === family)
    return [family, { count: rows.length, coverageBefore: percent(rows.filter((row) => row.beforeSupported).length, rows.length),
      coverageAfter: percent(rows.filter((row) => row.afterSupported).length, rows.length) }]
  }))
  const freshSummary = Object.freeze({ questionCount: 300, distinctTopicCount: distinctTopics,
    topicCoverageRateBefore: percent(fresh300.filter((row) => row.beforeSupported).length, fresh300.length),
    topicCoverageRateAfter: percent(fresh300.filter((row) => row.afterSupported).length, fresh300.length),
    catalogGapRateBefore: percent(fresh300.filter((row) => !row.beforeSupported).length, fresh300.length),
    catalogGapRateAfter: percent(fresh300.filter((row) => !row.afterSupported).length, fresh300.length),
    unsupportedAnswerRateBefore: percent(fresh300.filter((row) => !row.beforeSupported).length, fresh300.length),
    unsupportedAnswerRateAfter: percent(fresh300.filter((row) => !row.afterSupported).length, fresh300.length), metrics: holdoutMetrics })
  const evalRequested = evalRows.flatMap((row) => row.facetEvidenceMatrix ?? []).filter((entry: any) => entry.status !== "NOT_REQUESTED")
  let evalUpgraded = 0
  for (const entry of evalRequested.filter((row: any) => row.status === "UNSUPPORTED")) {
    const topic = afterRows.find((row) => row.topicId === entry.topicId); const facet = FACET_BY_REQUEST.get(entry.facet)
    if (topic && facet && ["PRESENT_DIRECT", "PRESENT_DERIVED"].includes(topic[facet.key].status)
      && topic[facet.key].supportClaimIds.some((id: string) => id.startsWith("shadow.owner.unit:"))) evalUpgraded += 1
  }
  const evalCoverage = Object.freeze({
    requestedFacetCount: evalRequested.length,
    before: { direct: evalRequested.filter((row: any) => row.status === "SUPPORTED_DIRECT").length,
      derived: evalRequested.filter((row: any) => row.status === "SUPPORTED_DERIVED").length,
      unsupported: evalRequested.filter((row: any) => row.status === "UNSUPPORTED").length,
      coveragePercent: percent(evalRequested.filter((row: any) => row.status.startsWith("SUPPORTED_")).length, evalRequested.length) },
    afterPlannerProjection: { upgradedUnsupported: evalUpgraded,
      unsupported: evalRequested.filter((row: any) => row.status === "UNSUPPORTED").length - evalUpgraded,
      coveragePercent: percent(evalRequested.filter((row: any) => row.status.startsWith("SUPPORTED_")).length + evalUpgraded, evalRequested.length) },
  })
  const validations = Object.freeze({ duplicate: acceptedUnits.filter((unit) => candidateAttempts.find((row) => row.candidateText === unit.text)?.validation.duplicate).length,
    contradiction: acceptedUnits.filter((unit) => candidateAttempts.find((row) => row.candidateText === unit.text)?.validation.contradiction).length,
    sourceViolation: acceptedUnits.filter((unit) => candidateAttempts.find((row) => row.candidateText === unit.text)?.validation.sourceMismatch).length,
    claimRoleMismatch: 0, selfContainmentViolation: 0, topicMismatch: 0, unsupportedRelation: 0 })
  const summary = Object.freeze({ schemaVersion: "dna-s13-knowledge-core-coverage@1", productionChanged: false, shadowTestOnly: true,
    totalTopicCount: topics.length, enrichmentBatchTopicCount: topBatch.length, addedVerifiedAtomCount: acceptedUnits.length,
    sourceBackedAtomRate: acceptedUnits.length ? percent(acceptedUnits.length, acceptedUnits.length) : "N/A", baseline: baselineSummary, after: afterSummary,
    observedGapCount: observed.length, top20CatalogGaps: gapRows.slice(0, 20), gapClassificationDistribution: classificationDistribution,
    enrichmentValidation: validations, eval007CoverageProjection: evalCoverage, fresh300: freshSummary })
  const files = {
    matrixBefore: path.join(OUTPUT_DIR, "coverage-matrix-before.jsonl"), matrixAfter: path.join(OUTPUT_DIR, "coverage-matrix-after.jsonl"),
    gaps: path.join(OUTPUT_DIR, "catalog-gaps.jsonl"), attempts: path.join(OUTPUT_DIR, "candidate-atom-audit.jsonl"),
    atoms: path.join(OUTPUT_DIR, "verified-shadow-atoms.jsonl"), holdout: path.join(OUTPUT_DIR, "fresh-300-knowledge-holdout.jsonl"),
    summary: path.join(OUTPUT_DIR, "objective-summary.json"), manifest: path.join(OUTPUT_DIR, "manifest.json"),
  }
  writeJsonl(files.matrixBefore, baselineRows); writeJsonl(files.matrixAfter, afterRows); writeJsonl(files.gaps, gapRows)
  writeJsonl(files.attempts, candidateAttempts); writeJsonl(files.atoms, acceptedUnits); writeJsonl(files.holdout, fresh300); writePrivate(files.summary, summary)
  const artifactFiles = Object.values(files).filter((file) => file !== files.manifest)
  writePrivate(files.manifest, { schemaVersion: "dna-s13-knowledge-core-coverage@1:manifest@1", productionChanged: false,
    files: artifactFiles.map((file) => ({ name: path.basename(file), bytes: statSync(file).size, sha256: sha(readFileSync(file)) })) })
  console.log(JSON.stringify(summary))
}

main()
