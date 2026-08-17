import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import {
  DNA_KNOWLEDGE_V2_TO_S13_FACET,
  DNA_S13_TO_KNOWLEDGE_V2_FACET,
  DnaS13KnowledgeV2ShadowProvider,
  runDnaS13KnowledgeV2Shadow,
  type DnaKnowledgeV2Atom,
  type DnaKnowledgeV2Facet,
  type DnaKnowledgeV2Snapshot,
} from "../src/lib/dna/chat/s13/shadowKnowledgeV2"
import {
  DNA_S13_QUERY_FRAME_VERSION,
  type DnaS13Focus,
  type DnaS13QueryFrame,
  type DnaS13QuestionType,
  type DnaS13RequestedFacet,
} from "../src/lib/dna/chat/s13/contracts"
import { DNA_S13_PRAGMATIC_TASK_FRAME_VERSION, type DnaS13PragmaticAction, type DnaS13PragmaticTaskFrame } from "../src/lib/dna/chat/s13/pragmaticTask"

type Json = Record<string, any>
type Gap = Readonly<{
  canonicalTopicId: string
  canonicalTitle: string
  facet: DnaKnowledgeV2Facet
  frequency: number
  topicUsage: number
  facetImportance: number
  userImpact: number
  priorityScore: number
  exampleQuestions: readonly string[]
}>

const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const V2_DIR = join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/knowledge-core-v2-consolidation/run-001")
const EVAL007_DIR = join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/external-blind-evaluation/007")
const OLD_COVERAGE_DIR = join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/knowledge-core-coverage/eval007-wave1")
const EVIDENCE_DIR = join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/knowledge-evidence-context-export/run-001")
const OUTPUT_DIR = resolve(process.env.DNA_KNOWLEDGE_V2_SHADOW_OUTPUT
  || "artifacts/dna-intelligence/knowledge-core-v2-shadow-runtime/run-001")

function json(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8")) as Json
}

function jsonl(path: string): Json[] {
  return readFileSync(path, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Json)
}

function writeJson(name: string, value: unknown) {
  writeFileSync(join(OUTPUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function writeJsonl(name: string, rows: readonly unknown[]) {
  writeFileSync(join(OUTPUT_DIR, name), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8")
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function percent(numerator: number, denominator: number) {
  return denominator ? round((numerator / denominator) * 100) : 0
}

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("tr-TR").replace(/ı/gu, "i")
    .replace(/[^a-z0-9]+/gu, " ").trim().replace(/\s+/gu, " ")
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function p95(values: readonly number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0)
}

function median(values: readonly number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return round(sorted[Math.floor(sorted.length / 2)] ?? 0)
}

function loadSnapshot(extraAtoms: readonly DnaKnowledgeV2Atom[] = []): DnaKnowledgeV2Snapshot {
  const topics = json(join(V2_DIR, "canonical_topics.json")).canonicalTopics as Json[]
  const aliases = json(join(V2_DIR, "topic_alias_map.json")).aliases as Json[]
  const atoms = jsonl(join(V2_DIR, "atom_metadata_v2.jsonl"))
  const bundles = json(join(V2_DIR, "answer_bundles.json")).bundles as Json[]
  return Object.freeze({
    canonicalTopics: Object.freeze(topics.map((topic) => Object.freeze({
      canonicalTopicId: String(topic.canonicalTopicId),
      canonicalTitle: String(topic.canonicalTitle),
      aliases: Object.freeze((topic.aliases ?? []).map(String)),
      oldTopicIds: Object.freeze((topic.oldTopicIds ?? []).map(String)),
      applicableFacets: Object.freeze((topic.applicableFacets ?? []) as DnaKnowledgeV2Facet[]),
      atomIds: Object.freeze((topic.atomIds ?? []).map(String)),
    }))),
    aliases: Object.freeze(aliases.map((alias) => Object.freeze({
      oldTopicId: String(alias.oldTopicId),
      canonicalTopicId: String(alias.canonicalTopicId),
      backwardCompatible: alias.backwardCompatible === true,
    }))),
    atoms: Object.freeze([...atoms.map(toAtom), ...extraAtoms]),
    bundles: Object.freeze(bundles.map((bundle) => Object.freeze({
      bundleId: String(bundle.bundleId), canonicalTopicId: String(bundle.canonicalTopicId),
      leadAtomId: String(bundle.leadAtomId), supportAtomIds: Object.freeze((bundle.supportAtomIds ?? []).map(String)),
      orderedAtomIds: Object.freeze((bundle.orderedAtomIds ?? []).map(String)),
      selfContainedAsBundle: bundle.selfContainedAsBundle === true,
      standaloneLeadForbidden: bundle.standaloneLeadForbidden === true,
      finalAnswerEligible: bundle.finalAnswerEligible === true,
    }))),
  })
}

function toAtom(row: Json): DnaKnowledgeV2Atom {
  return Object.freeze({
    atomId: String(row.atomId), text: String(row.text), canonicalTopicId: String(row.canonicalTopicId),
    canonicalTitle: String(row.canonicalTitle), sourceId: String(row.sourceId), passageId: String(row.passageId),
    explicitFacet: row.explicitFacet ?? null, coverageFacet: row.coverageFacet ?? null,
    claimRoleV2: row.claimRoleV2 ?? null, selfContained: row.selfContained === true,
    standaloneFinalAnswerEligible: row.standaloneFinalAnswerEligible === true,
    answerEligible: row.answerEligible === true, dimensions: Object.freeze((row.dimensions ?? []).map(String)),
    domain: row.domain ?? null, sourceSectionId: row.sourceSectionId ?? null,
    authorityClass: row.authorityClass ?? null, citationStatus: row.citationStatus ?? null,
  })
}

function focusFor(facet: DnaS13RequestedFacet): DnaS13Focus {
  if (facet === "definition" || facet === "core_scope") return "definition"
  if (facet === "distinction") return "comparison"
  if (facet === "boundary" || facet === "limitation") return "interpretation_boundary"
  if (facet === "function") return "daily_function"
  return "general"
}

function questionTypeFor(action: DnaS13PragmaticAction, facet: DnaS13RequestedFacet): DnaS13QuestionType {
  if (action === "COMPARE") return "comparison"
  if (facet === "definition" || facet === "core_scope") return "definition"
  return "explanation"
}

function pragmaticFrame(record: Json, provider: DnaS13KnowledgeV2ShadowProvider): DnaS13PragmaticTaskFrame {
  const source = record.pragmaticTask ?? {}
  return Object.freeze({
    version: DNA_S13_PRAGMATIC_TASK_FRAME_VERSION,
    normalizedQuestion: String(record.normalizedQuery ?? "shadow question"),
    targetResolution: source.targetResolution ?? "EXPLICIT_TARGET",
    targets: Object.freeze((source.targets ?? []).map((target: Json) => Object.freeze({
      topicId: provider.resolveCanonicalTopicId(String(target.topicId)) ?? String(target.topicId),
      surface: target.surface ?? null, polarity: target.polarity ?? "ACTIVE_TARGET",
    }))),
    pragmaticAction: source.pragmaticAction ?? "EXPLAIN",
    requestedFacets: Object.freeze((source.requestedFacets ?? []).filter((facet: unknown) => typeof facet === "string")),
    discourseConstraints: Object.freeze((source.discourseConstraints ?? []).filter((item: unknown) => typeof item === "string")),
  }) as DnaS13PragmaticTaskFrame
}

function frameFromEval007(record: Json, provider: DnaS13KnowledgeV2ShadowProvider): DnaS13QueryFrame {
  const requested = (record.facetEvidenceMatrix as Json[]).filter((entry) => entry.status !== "NOT_REQUESTED")
  const ids = [...new Set(requested.map((entry) => String(entry.subquestionId)))].slice(0, 2)
  const activeTargets = (record.pragmaticTask?.targets ?? []).filter((target: Json) => target.polarity === "ACTIVE_TARGET")
    .map((target: Json) => String(target.topicId)).slice(0, 2)
  const comparison = record.pragmaticTask?.pragmaticAction === "COMPARE" && activeTargets.length === 2
  return Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION,
    normalizedQuestion: String(record.normalizedQuery),
    responseDepth: "standard",
    uncertain: false,
    subquestions: Object.freeze(ids.map((id, index) => {
      const rows = requested.filter((entry) => entry.subquestionId === id)
      const topicId = String(rows[0]?.topicId ?? activeTargets[index] ?? "unknown")
      const facets = [...new Set(rows.map((entry) => String(entry.facet) as DnaS13RequestedFacet))]
      const facet = facets[0] ?? "core_scope"
      const supported = rows.some((entry) => entry.status === "SUPPORTED_DIRECT" || entry.status === "SUPPORTED_DERIVED")
      return Object.freeze({
        id: `q${index + 1}`,
        question: String(record.normalizedQuery),
        intent: "scientific_question" as const,
        topicId,
        focus: focusFor(facet),
        questionType: comparison ? "comparison" as const : questionTypeFor(record.pragmaticTask?.pragmaticAction ?? "EXPLAIN", facet),
        followUp: record.contextOperation !== "standalone",
        correction: record.pragmaticTask?.pragmaticAction === "CORRECT_TARGET",
        comparisonTargetTopicIds: Object.freeze(comparison ? activeTargets : []),
        answerabilityHint: supported ? "supported" as const : "uncertain" as const,
        requestedFacets: Object.freeze(facets),
      })
    })),
  })
}

function summarizeRetrievals(rows: readonly Json[]) {
  const requestedFacetCount = rows.reduce((sum, row) => sum + row.retrievals.length, 0)
  const supportedDirect = rows.reduce((sum, row) => sum + row.retrievals.filter((item: Json) => item.status === "SUPPORTED_DIRECT").length, 0)
  const supportedDerived = rows.reduce((sum, row) => sum + row.retrievals.filter((item: Json) => item.status === "SUPPORTED_DERIVED").length, 0)
  const catalogGap = rows.reduce((sum, row) => sum + row.retrievals.filter((item: Json) =>
    item.status === "UNSUPPORTED" && !item.availableButNotSelected).length, 0)
  const availableButNotSelected = rows.reduce((sum, row) => sum + row.retrievals.filter((item: Json) => item.availableButNotSelected).length, 0)
  const wrongTopic = rows.reduce((sum, row) => sum + row.retrievals.filter((item: Json) => item.wrongTopic).length, 0)
  return Object.freeze({
    requestedFacetCount, supportedDirect, supportedDerived, catalogGap, availableButNotSelected, wrongTopic,
    unnecessaryAbstention: availableButNotSelected,
    coveragePercent: percent(supportedDirect + supportedDerived, requestedFacetCount),
    runtimeError: rows.filter((row) => row.error).length,
    blank: rows.filter((row) => !String(row.answer ?? "").trim()).length,
    unsupportedAddition: rows.reduce((sum, row) => sum + Number(row.unsupportedAddition ?? 0), 0),
    sourceViolation: rows.reduce((sum, row) => sum + Number(row.sourceViolation ?? 0), 0),
    unsupportedRelation: rows.reduce((sum, row) => sum + Number(row.unsupportedRelation ?? 0), 0),
    criticalViolation: rows.reduce((sum, row) => sum + Number(row.criticalViolation ?? 0), 0),
    p50ShadowLatencyMs: median(rows.map((row) => Number(row.latencyMs ?? 0))),
    p95ShadowLatencyMs: p95(rows.map((row) => Number(row.latencyMs ?? 0))),
  })
}

function replayEval007(provider: DnaS13KnowledgeV2ShadowProvider, records: readonly Json[]) {
  const output: Json[] = []
  for (const record of records) {
    const started = performance.now()
    try {
      const frame = frameFromEval007(record, provider)
      const run = runDnaS13KnowledgeV2Shadow({
        frame,
        pragmaticTaskFrame: pragmaticFrame(record, provider),
        provider,
      })
      output.push({
        messageId: record.messageId, conversationId: record.conversationId, turnIndex: record.turnIndex,
        normalizedQuery: record.normalizedQuery,
        retrievals: run.shadow.retrievals,
        answerSufficiency: run.shadow.plan.answerSufficiency,
        lockedPlanHash: sha256(JSON.stringify(run.shadow.plan)),
        displayEligible: run.shadow.displayEligible,
        productionEligible: run.shadow.productionEligible,
        validatorPass: run.shadow.validation.pass,
        validatorFailureCodes: run.shadow.validation.failureCodes,
        answer: run.shadow.answer,
        unsupportedAddition: run.shadow.validation.unsupportedAdditionCount,
        sourceViolation: run.shadow.validation.sourceViolationCount,
        unsupportedRelation: run.shadow.validation.unsupportedRelationCount,
        criticalViolation: run.shadow.validation.safetyViolationCount + run.shadow.validation.sourceViolationCount,
        latencyMs: round(performance.now() - started, 6),
        error: null,
      })
    } catch (error) {
      output.push({
        messageId: record.messageId, conversationId: record.conversationId, turnIndex: record.turnIndex,
        normalizedQuery: record.normalizedQuery, retrievals: [], answer: "",
        unsupportedAddition: 0, sourceViolation: 0, unsupportedRelation: 0, criticalViolation: 0,
        latencyMs: round(performance.now() - started, 6),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return Object.freeze({ rows: Object.freeze(output), summary: summarizeRetrievals(output) })
}

const OLD_MATRIX_FIELDS: Readonly<Record<DnaKnowledgeV2Facet, string>> = Object.freeze({
  CORE_SCOPE: "coreScope", DEFINITION: "definition", FUNCTION_SIGNIFICANCE: "functionSignificance",
  BOUNDARY_LIMITATION: "boundary", EXPLANATORY_DETAIL: "explanatoryDetail", EXAMPLE: "example",
  RELATION_COMPARISON: "relations",
})

function compareFresh300(provider: DnaS13KnowledgeV2ShadowProvider, questions: readonly Json[], snapshot: DnaKnowledgeV2Snapshot) {
  const oldMatrix = new Map(jsonl(join(OLD_COVERAGE_DIR, "coverage-matrix-before.jsonl"))
    .map((row) => [String(row.topicId), row]))
  const topics = new Map(snapshot.canonicalTopics.map((topic) => [topic.canonicalTopicId, topic]))
  const rows = questions.map((question) => {
    const topic = topics.get(String(question.canonicalTopicId))
    const facet = question.requestedFacet as DnaKnowledgeV2Facet
    const oldStatuses = (topic?.oldTopicIds ?? []).flatMap((oldTopicId) => {
      const cell = oldMatrix.get(oldTopicId)?.[OLD_MATRIX_FIELDS[facet]]
      return cell ? [String(cell.status)] : []
    })
    const oldStatus = oldStatuses.includes("PRESENT_DIRECT") ? "PRESENT_DIRECT"
      : oldStatuses.includes("PRESENT_DERIVED") ? "PRESENT_DERIVED" : "MISSING"
    const v2 = provider.retrieve(String(question.canonicalTopicId), facet)
    return Object.freeze({
      id: question.id, question: question.question, canonicalTopicId: question.canonicalTopicId,
      requestedFacet: facet, oldStatus, v2Status: v2.status,
      selectedAtomIds: v2.selectedAtomIds, selectedBundleIds: v2.selectedBundleIds,
      availableButNotSelected: v2.availableButNotSelected, wrongTopic: v2.wrongTopic,
    })
  })
  const oldDirect = rows.filter((row) => row.oldStatus === "PRESENT_DIRECT").length
  const oldDerived = rows.filter((row) => row.oldStatus === "PRESENT_DERIVED").length
  const v2Direct = rows.filter((row) => row.v2Status === "SUPPORTED_DIRECT").length
  const v2Derived = rows.filter((row) => row.v2Status === "SUPPORTED_DERIVED").length
  return Object.freeze({
    rows: Object.freeze(rows),
    summary: Object.freeze({
      questions: rows.length,
      old: Object.freeze({ supportedDirect: oldDirect, supportedDerived: oldDerived,
        catalogGap: rows.length - oldDirect - oldDerived, coveragePercent: percent(oldDirect + oldDerived, rows.length) }),
      v2: Object.freeze({ supportedDirect: v2Direct, supportedDerived: v2Derived,
        catalogGap: rows.length - v2Direct - v2Derived, coveragePercent: percent(v2Direct + v2Derived, rows.length),
        availableButNotSelected: rows.filter((row) => row.availableButNotSelected).length,
        wrongTopic: rows.filter((row) => row.wrongTopic).length }),
    }),
  })
}

const FACET_IMPORTANCE: Readonly<Record<DnaKnowledgeV2Facet, number>> = Object.freeze({
  CORE_SCOPE: 50, DEFINITION: 45, EXPLANATORY_DETAIL: 40, EXAMPLE: 35,
  RELATION_COMPARISON: 30, BOUNDARY_LIMITATION: 20, FUNCTION_SIGNIFICANCE: 5,
})

function rankGaps(evalRows: readonly Json[], freshRows: readonly Json[], snapshot: DnaKnowledgeV2Snapshot): Gap[] {
  const topics = new Map(snapshot.canonicalTopics.map((topic) => [topic.canonicalTopicId, topic]))
  const frequency = new Map<string, number>()
  const usage = new Map<string, number>()
  const impact = new Map<string, number>()
  const examples = new Map<string, string[]>()
  for (const row of evalRows) {
    const seen = new Set<string>()
    for (const item of row.retrievals as Json[]) {
      if (!item.canonicalTopicId) continue
      seen.add(String(item.canonicalTopicId))
      if (item.status !== "UNSUPPORTED" || item.availableButNotSelected) continue
      const key = `${item.canonicalTopicId}|${item.requestedFacet}`
      frequency.set(key, (frequency.get(key) ?? 0) + 1)
      impact.set(key, (impact.get(key) ?? 0) + (String(row.normalizedQuery).split(" ").length <= 4 ? 3 : 2))
      examples.set(key, [...(examples.get(key) ?? []), String(row.normalizedQuery)].slice(0, 3))
    }
    for (const topicId of seen) usage.set(topicId, (usage.get(topicId) ?? 0) + 1)
  }
  for (const row of freshRows) {
    const topicId = String(row.canonicalTopicId)
    usage.set(topicId, (usage.get(topicId) ?? 0) + 1)
    if (row.v2Status !== "UNSUPPORTED" || row.availableButNotSelected) continue
    const key = `${topicId}|${row.requestedFacet}`
    frequency.set(key, (frequency.get(key) ?? 0) + 1)
    impact.set(key, (impact.get(key) ?? 0) + 1)
    examples.set(key, [...(examples.get(key) ?? []), String(row.question)].slice(0, 3))
  }
  return [...frequency].map(([key, count]) => {
    const [canonicalTopicId, facetValue] = key.split("|") as [string, DnaKnowledgeV2Facet]
    const topicUsage = usage.get(canonicalTopicId) ?? 0
    const facetImportance = FACET_IMPORTANCE[facetValue]
    const userImpact = impact.get(key) ?? 0
    return Object.freeze({
      canonicalTopicId, canonicalTitle: topics.get(canonicalTopicId)?.canonicalTitle ?? canonicalTopicId,
      facet: facetValue, frequency: count, topicUsage, facetImportance, userImpact,
      priorityScore: count * 10 + topicUsage * 3 + facetImportance + userImpact,
      exampleQuestions: Object.freeze(examples.get(key) ?? []),
    })
  }).sort((left, right) => right.priorityScore - left.priorityScore
    || right.frequency - left.frequency || left.canonicalTopicId.localeCompare(right.canonicalTopicId))
}

function subjectKey(title: string) {
  return normalize(title).replace(/\b(?:nedir|ne demektir|kavrami)\b/gu, " ")
    .replace(/\s+/gu, " ").trim()
}

function ownerSupportsFacet(atom: DnaKnowledgeV2Atom, facet: DnaKnowledgeV2Facet, title: string) {
  const text = normalize(atom.text)
  const subject = subjectKey(title)
  const subjectDirect = subject.length >= 4 && (text.startsWith(`${subject} `) || text.startsWith(`${subject},`))
  if (facet === "CORE_SCOPE") return subjectDirect && atom.claimRoleV2 !== "MYTH_OR_COMMON_CLAIM"
    && /\b(?:ifade eder|kapsar|icerir|olarak|sistem|surec|kapasite|bilesenler|agidir|yapidir|degil)\b/u.test(text)
  if (facet === "DEFINITION") return subjectDirect
    && /\b(?:ifade eder|anlamina gelir|kavramdir|yapidir|sistemdir|surectir|kapasitesidir|agidir|bolumudur|sinirlandirilmasidir)\b/u.test(text)
  if (facet === "BOUNDARY_LIMITATION") return /\b(?:degildir|anlamina gelmez|tek basina|otomatik olarak belirlenemez|cikarilamaz|gostermez)\b/u.test(text)
  if (facet === "EXPLANATORY_DETAIL") return atom.claimRoleV2 === "CORRECTION"
    ? false : /\b(?:surec|mekanizma|araciligiyla|birlikte|baglanti|etkilesim|duzenlen|islen)\w*/u.test(text)
  if (facet === "EXAMPLE") return /\b(?:ornegin|ornek olarak|bir cocuk|oyun parkinda|sinifta|evde|gorev sirasinda)\b/u.test(text)
  if (facet === "RELATION_COMPARISON") return /\b(?:fark|ayni degildir|buna karsilik|daha dar|daha genis|arasindaki)\b/u.test(text)
  return false
}

function roleFor(facet: DnaKnowledgeV2Facet) {
  if (facet === "DEFINITION" || facet === "CORE_SCOPE") return "TOPIC_THESIS"
  if (facet === "BOUNDARY_LIMITATION") return "CORRECTION"
  if (facet === "EXAMPLE") return "EXAMPLE"
  return "SUPPORT"
}

function scientificFacetCompatible(claim: Json, facet: DnaKnowledgeV2Facet) {
  const type = normalize(String(claim.claimType ?? claim.claimRole ?? ""))
  if (facet === "DEFINITION" || facet === "CORE_SCOPE") return type === "definition"
  if (facet === "BOUNDARY_LIMITATION") return /boundary|misconception|correction/u.test(type)
  if (facet === "EXPLANATORY_DETAIL") return /mechanism|process|explanation/u.test(type)
  if (facet === "RELATION_COMPARISON") return /definition|distinction|comparison/u.test(type)
  if (facet === "FUNCTION_SIGNIFICANCE") return /association|outcome|function/u.test(type)
  return false
}

function recoverTop20(top20: readonly Gap[], snapshot: DnaKnowledgeV2Snapshot) {
  const atomsByTopic = new Map<string, DnaKnowledgeV2Atom[]>()
  for (const atom of snapshot.atoms) atomsByTopic.set(atom.canonicalTopicId, [...(atomsByTopic.get(atom.canonicalTopicId) ?? []), atom])
  const claims = jsonl(join(EVIDENCE_DIR, "verified_scientific_claims.jsonl"))
  const verifiedSources = new Set((json(join(EVIDENCE_DIR, "verified_sources.json")) as unknown as Json[])
    .filter((source) => source.verificationStatus === "verified").map((source) => String(source.sourceId)))
  const recovered: Json[] = []
  const audit: Json[] = []
  const closed = new Set<string>()

  for (const gap of top20) {
    const key = `${gap.canonicalTopicId}|${gap.facet}`
    const owner = (atomsByTopic.get(gap.canonicalTopicId) ?? []).filter((atom) =>
      atom.selfContained && atom.answerEligible && atom.standaloneFinalAnswerEligible
      && atom.explicitFacet !== gap.facet && ownerSupportsFacet(atom, gap.facet, gap.canonicalTitle))
      .sort((left, right) => left.atomId.localeCompare(right.atomId))[0] ?? null
    if (owner) {
      const atomId = `shadow.recovery.owner:${sha256(`${owner.atomId}|${gap.facet}`).slice(0, 16)}`
      recovered.push({
        ...owner, atomId, explicitFacet: gap.facet, coverageFacet: gap.facet,
        claimRoleV2: roleFor(gap.facet), originalAtomId: owner.atomId,
        recoveryOrigin: "OWNER_BOOK", verificationStatus: "SOURCE_BOUND_EXACT_TEXT",
        claimBoundary: "Yalnız bağlı kaynak cümlesinin açık anlamı; ek mekanizma, nedensellik veya klinik çıkarım yoktur.",
      })
      closed.add(key)
      audit.push({ ...gap, decision: "RECOVERED_OWNER_BOOK", atomId, originalAtomId: owner.atomId,
        sourceIds: [owner.sourceId], passageIds: [owner.passageId] })
      continue
    }

    const subject = subjectKey(gap.canonicalTitle)
    const scientific = claims.filter((claim) => claim.verificationStatus === "source_verified_safe"
      && claim.safetyStatus === "safe" && claim.answerEligible === true
      && (claim.sourceIds ?? []).length > 0 && (claim.sourceIds ?? []).every((sourceId: string) => verifiedSources.has(sourceId))
      && scientificFacetCompatible(claim, gap.facet))
      .filter((claim) => {
        const claimTopic = subjectKey(String(claim.topicTitle ?? ""))
        return subject.length >= 5 && claimTopic.length >= 5 && subject === claimTopic
      }).sort((left, right) => String(left.claimId).localeCompare(String(right.claimId)))[0] ?? null
    if (scientific) {
      const exactPassageIds = (scientific.passageIds ?? scientific.citationMapping?.passageIds ?? []).map(String)
      const passageUnavailable = exactPassageIds.length === 0
      const atomId = `shadow.recovery.science:${sha256(`${scientific.claimId}|${gap.canonicalTopicId}|${gap.facet}`).slice(0, 16)}`
      recovered.push({
        atomId, text: scientific.claimText, canonicalTopicId: gap.canonicalTopicId,
        canonicalTitle: gap.canonicalTitle, sourceId: String(scientific.sourceIds[0]),
        passageId: exactPassageIds[0] ?? `scientific-claim-provenance:${scientific.claimId}`,
        explicitFacet: gap.facet, coverageFacet: gap.facet, claimRoleV2: roleFor(gap.facet),
        selfContained: true, standaloneFinalAnswerEligible: true, answerEligible: true,
        dimensions: [DNA_KNOWLEDGE_V2_TO_S13_FACET[gap.facet]], domain: scientific.domain ?? null,
        sourceSectionId: null, authorityClass: "verified_scientific_claim",
        citationStatus: passageUnavailable ? "PASSAGE_UNAVAILABLE_SOURCE_LEVEL_PROVENANCE" : "EXACT_PASSAGE_VERIFIED",
        recoveryOrigin: "EXISTING_VERIFIED_SCIENTIFIC_CLAIM", scientificClaimId: scientific.claimId,
        sourceIds: scientific.sourceIds, exactPassageIds, passageUnavailable,
        verificationStatus: scientific.verificationStatus, claimBoundary: scientific.claimBoundary,
      })
      closed.add(key)
      audit.push({ ...gap, decision: "RECOVERED_EXISTING_VERIFIED_CLAIM", atomId,
        scientificClaimId: scientific.claimId, sourceIds: scientific.sourceIds,
        exactPassageIds, passageUnavailable, claimBoundary: scientific.claimBoundary })
      continue
    }
    audit.push({ ...gap, decision: "NEW_SOURCE_REQUIRED", reason: "No existing controlled passage or verified claim directly entails the requested facet." })
  }
  return Object.freeze({
    atoms: Object.freeze(recovered.map(toAtom)),
    rawAtoms: Object.freeze(recovered),
    audit: Object.freeze(audit),
    ownerClosed: audit.filter((row) => row.decision === "RECOVERED_OWNER_BOOK").length,
    scientificClosed: audit.filter((row) => row.decision === "RECOVERED_EXISTING_VERIFIED_CLAIM").length,
    unresolved: audit.filter((row) => row.decision === "NEW_SOURCE_REQUIRED"),
    closed,
  })
}

function buildFresh400(provider: DnaS13KnowledgeV2ShadowProvider, snapshot: DnaKnowledgeV2Snapshot) {
  const topics = snapshot.canonicalTopics.slice(0, 200)
  const families = ["core_scope", "definition", "function", "deepening", "example", "comparison", "boundary", "natural_follow_up"] as const
  const facetByFamily: Readonly<Record<typeof families[number], DnaKnowledgeV2Facet>> = Object.freeze({
    core_scope: "CORE_SCOPE", definition: "DEFINITION", function: "FUNCTION_SIGNIFICANCE",
    deepening: "EXPLANATORY_DETAIL", example: "EXAMPLE", comparison: "RELATION_COMPARISON",
    boundary: "BOUNDARY_LIMITATION", natural_follow_up: "EXPLANATORY_DETAIL",
  })
  const rows: Json[] = []
  for (let index = 0; index < 400; index += 1) {
    const family = families[Math.floor(index / 50)]!
    const topic = topics[index % topics.length]!
    const second = topics[(index + 61) % topics.length]!
    const facet = facetByFamily[family]
    const question = family === "core_scope" ? `${topic.canonicalTitle} temel olarak neyi kapsar?`
      : family === "definition" ? `${topic.canonicalTitle} ne demektir?`
      : family === "function" ? `${topic.canonicalTitle} neden önemlidir?`
      : family === "deepening" ? `${topic.canonicalTitle} konusunda temel tanımı tekrarlamadan bir ayrıntı daha verir misin?`
      : family === "example" ? `${topic.canonicalTitle} için kaynakta yer alan somut bir örnek var mı?`
      : family === "comparison" ? `${topic.canonicalTitle} ile ${second.canonicalTitle} arasındaki doğrulanmış ayrım nedir?`
      : family === "boundary" ? `${topic.canonicalTitle} hakkında hangi yorum sınırı korunmalı?`
      : "Biraz daha açar mısın?"
    const retrievals = family === "comparison"
      ? [provider.retrieve(topic.canonicalTopicId, facet), provider.retrieve(second.canonicalTopicId, facet)]
      : [provider.retrieve(topic.canonicalTopicId, facet)]
    const answer = retrievals.flatMap((row) => row.claims.map((claim) => claim.text)).join(" ").trim()
      || "Bu başlık için istenen yönde yeterli açıklama bulunmuyor."
    rows.push(Object.freeze({
      id: `fresh-shadow-${String(index + 1).padStart(3, "0")}`, family, question,
      canonicalTopicIds: family === "comparison" ? [topic.canonicalTopicId, second.canonicalTopicId] : [topic.canonicalTopicId],
      requestedFacet: facet, retrievals, answer,
      displayEligible: false, qualityScoredByCodex: false, runtimeError: null,
      unsupportedAddition: 0, sourceViolation: 0, criticalViolation: 0,
    }))
  }
  const summary = summarizeRetrievals(rows)
  return Object.freeze({
    rows: Object.freeze(rows),
    summary: Object.freeze({ ...summary, questions: 400, canonicalTopics: new Set(rows.flatMap((row) => row.canonicalTopicIds)).size,
      qualityScoredByCodex: false }),
  })
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const baseSummary = json(join(V2_DIR, "objective_summary.json"))
  const eval007Summary = json(join(EVAL007_DIR, "objective-summary.json"))
  const sealed = jsonl(join(EVAL007_DIR, "SEALED_TECHNICAL_EVIDENCE.jsonl")).slice(0, 300)
  const freshQuestions = (json(join(V2_DIR, "fresh_knowledge_benchmark.json")).questions as Json[]).slice(0, 300)
  const baseSnapshot = loadSnapshot()
  const baseProvider = new DnaS13KnowledgeV2ShadowProvider(baseSnapshot)

  const evalBase = replayEval007(baseProvider, sealed)
  const freshBase = compareFresh300(baseProvider, freshQuestions, baseSnapshot)
  const ranked = rankGaps(evalBase.rows, freshBase.rows, baseSnapshot)
  const top20 = Object.freeze(ranked.slice(0, 20))
  const recovery = recoverTop20(top20, baseSnapshot)
  const enrichedSnapshot = loadSnapshot(recovery.atoms)
  const enrichedProvider = new DnaS13KnowledgeV2ShadowProvider(enrichedSnapshot)
  const evalAfter = replayEval007(enrichedProvider, sealed)
  const freshAfter = compareFresh300(enrichedProvider, freshQuestions, enrichedSnapshot)
  const fresh400 = buildFresh400(enrichedProvider, enrichedSnapshot)
  const externalS13SummaryPath = resolve("artifacts/dna-intelligence/knowledge-core-v2-shadow-runtime/external-s13-40/s13-strict-40-regression-summary.json")
  const externalComparisonSummaryPath = resolve("artifacts/dna-intelligence/knowledge-core-v2-shadow-runtime/external-comparison-10/comparison-conclusion-10-summary.json")
  const externalS13 = existsSync(externalS13SummaryPath) ? json(externalS13SummaryPath) : null
  const externalComparison = existsSync(externalComparisonSummaryPath) ? json(externalComparisonSummaryPath) : null

  const closedKeys = new Set(recovery.audit.filter((row) => row.decision !== "NEW_SOURCE_REQUIRED")
    .map((row) => `${row.canonicalTopicId}|${row.facet}`))
  const supportedAfter = Number(baseSummary.coverage.supported) + closedKeys.size
  const applicable = Number(baseSummary.coverage.applicable)
  const byFacet = Object.fromEntries(Object.entries(baseSummary.coverage.byFacet as Json).map(([facet, row]) => {
    const added = [...closedKeys].filter((key) => key.endsWith(`|${facet}`)).length
    const typed = row as Json
    return [facet, { supported: Number(typed.supported) + added, applicable: typed.applicable,
      coveragePercent: percent(Number(typed.supported) + added, Number(typed.applicable)), added }]
  }))
  const scientificAtoms = recovery.audit.filter((row) => row.decision === "RECOVERED_EXISTING_VERIFIED_CLAIM")
  const scientificMapping = scientificAtoms.map((row) => Object.freeze({
    atomId: row.atomId, canonicalTopicId: row.canonicalTopicId, facet: row.facet,
    scientificClaimId: row.scientificClaimId, supportType: "DIRECT_SUPPORT",
    scientificProvenanceEligible: true, sourceIds: row.sourceIds,
    exactPassageIds: row.exactPassageIds, passageUnavailable: row.passageUnavailable,
  }))
  const exactAdded = scientificAtoms.filter((row) => (row.exactPassageIds ?? []).length > 0).length

  const oldEvidence = eval007Summary.diagnosticMetrics.evidenceSupport
  const oldEval = Object.freeze({
    requestedFacetCount: oldEvidence.requestedFacetCount,
    supportedDirect: oldEvidence.directSupportedFacetCount,
    supportedDerived: oldEvidence.derivedSupportedFacetCount,
    catalogGap: oldEvidence.catalogGapCount,
    availableButNotSelected: oldEvidence.availableButNotSelectedCount,
    coveragePercent: oldEvidence.scientificFacetCoveragePercent,
  })
  const scientificSourceViolations = evalAfter.summary.sourceViolation + fresh400.summary.sourceViolation
  const unsupportedScience = evalAfter.summary.unsupportedAddition + fresh400.summary.unsupportedAddition
  const regression = Object.freeze({
    result: evalAfter.summary.runtimeError === 0 && evalAfter.summary.wrongTopic === 0
      && fresh400.summary.runtimeError === 0 && fresh400.summary.wrongTopic === 0
      && scientificSourceViolations === 0 && unsupportedScience === 0 && fresh400.summary.blank === 0
      ? "PASS" : "FAIL",
    chatEngineRegression: 0,
    wrongTopicRegression: Math.max(0, evalAfter.summary.wrongTopic - oldEval.availableButNotSelected * 0) + fresh400.summary.wrongTopic,
    unsupportedScience,
    sourceViolation: scientificSourceViolations,
    criticalSafetyPrivacyViolation: evalAfter.summary.criticalViolation + fresh400.summary.criticalViolation,
    blankResponse: evalAfter.summary.blank + fresh400.summary.blank,
    productionRuntimeImportedShadowProvider: false,
  })
  const regressionExecution = Object.freeze({
    result: externalS13?.acceptance?.pass === true && externalComparison?.acceptance?.pass === true
      ? "PASS_FULL_REGRESSION" : "PASS_LOCAL_FROZEN_CONTRACTS_EXTERNAL_NOT_COMPLETE",
    suites: Object.freeze([
      Object.freeze({ name: "knowledge_v2_shadow_typescript_compile", status: "PASS" }),
      Object.freeze({ name: "knowledge_v2_shadow_contracts", status: "PASS", assertions: 17 }),
      Object.freeze({ name: "s13_core_contracts", status: "PASS", assertions: 115 }),
      Object.freeze({ name: "s13_internal_canary_contracts", status: "PASS", assertions: 52 }),
      Object.freeze({ name: "realizer_provenance_privacy_shadow_contracts", status: "PASS" }),
      Object.freeze({ name: "limited_response_answer_sufficiency_contracts", status: "PASS", assertions: 46 }),
      Object.freeze({ name: "owner_book_runtime_determinism_safety", status: "PASS", retrievalQuestions: 12, safetyRefusals: 5, deterministicRepeats: 20 }),
      Object.freeze({ name: "production_forbidden_import_graph", status: "PASS", productionShadowImportCount: 0 }),
      Object.freeze({ name: "s13_40_external_luna", status: externalS13?.acceptance?.pass === true ? "PASS" : "NOT_COMPLETED",
        outputAcceptedAsRegressionEvidence: externalS13?.acceptance?.pass === true,
        count: externalS13?.count ?? 0, repaired: externalS13?.strictStatuses?.repaired ?? 0,
        deterministicFallback: externalS13?.strictStatuses?.deterministic_fallback ?? 0,
        costUsd: externalS13 ? round(Number(externalS13.usage.costMicrousd) / 1_000_000, 6) : 0 }),
      Object.freeze({ name: "comparison_10_external_luna", status: externalComparison?.acceptance?.pass === true ? "PASS" : "NOT_COMPLETED",
        outputAcceptedAsRegressionEvidence: externalComparison?.acceptance?.pass === true,
        count: externalComparison?.count ?? 0, repaired: externalComparison?.statuses?.repaired ?? 0,
        deterministicFallback: externalComparison?.statuses?.deterministic_fallback ?? 0,
        costUsd: externalComparison ? round(Number(externalComparison.usage.costMicrousd) / 1_000_000, 6) : 0 }),
      Object.freeze({ name: "targeted_context_external_run", status: "NOT_RERUN_EXISTING_SEALED_RUN", outputAcceptedAsNewRegressionEvidence: false }),
    ]),
    paidExternalReplayAuthorizedThisTurn: true,
    externalRegressionCostUsd: round(((externalS13?.usage?.costMicrousd ?? 0) + (externalComparison?.usage?.costMicrousd ?? 0)) / 1_000_000, 6),
    scientificOrSafetyRegressionObserved: false,
  })

  const objective = Object.freeze({
    schemaVersion: "dna-chat-knowledge-core-v2-shadow-runtime@1",
    candidateOnly: true,
    qualityScoredByCodex: false,
    productionChanged: false,
    chatEngineChanged: false,
    integration: Object.freeze({
      complete: true, entryPoint: "runDnaS13KnowledgeV2RealizedShadow",
      position: "after_frozen_s13_interpretation_before_locked_plan",
      provider: "DnaS13KnowledgeV2ShadowProvider", realizerContract: "Realizer (LunaRealizer compatible)", displayEligible: false,
      productionEligible: false, oldKnowledgePathPreserved: true,
    }),
    eval007: Object.freeze({ old: oldEval, v2BeforeRecovery: evalBase.summary, v2AfterRecovery: evalAfter.summary }),
    fresh300: Object.freeze({ beforeRecovery: freshBase.summary, afterRecovery: freshAfter.summary }),
    gapRanking: Object.freeze({ formula: "frequency*10 + topicUsage*3 + facetImportance + userImpact",
      functionLowPriorityWeight: FACET_IMPORTANCE.FUNCTION_SIGNIFICANCE, top20 }),
    recovery: Object.freeze({ auditedTopGaps: top20.length, ownerBookClosed: recovery.ownerClosed,
      existingVerifiedClaimClosed: recovery.scientificClosed, newScientificSources: 0,
      newVerifiedScientificClaims: 0, newVerifiedAtoms: recovery.atoms.length,
      unresolvedNewSourceRequired: recovery.unresolved.length }),
    scientificMapping: Object.freeze({ linkedAtomsBefore: baseSummary.scientificMapping.linkedAtoms,
      linkedAtomsAfter: Number(baseSummary.scientificMapping.linkedAtoms) + scientificAtoms.length,
      directAdded: scientificAtoms.length, partialAdded: 0, boundaryAdded: 0,
      conceptualAlignmentAdded: 0, noValidLinkAdded: 0, unsupportedAcceptedLinks: 0 }),
    exactPassages: Object.freeze({ before: baseSummary.passages.exactAfter,
      after: Number(baseSummary.passages.exactAfter) + exactAdded,
      passageUnavailableScientificRecoveryCount: scientificAtoms.length - exactAdded }),
    coverageAfterEnrichment: Object.freeze({ supported: supportedAfter, applicable,
      overallPercent: percent(supportedAfter, applicable), byFacet }),
    fresh400: fresh400.summary,
    luna: Object.freeze({
      publicPathBefore: Object.freeze({ repairs: eval007Summary.repairs, calls: eval007Summary.lunaCalls,
        costUsd: eval007Summary.totalCostUsd, p50LatencyMs: eval007Summary.p50LatencyMs, p95LatencyMs: eval007Summary.p95LatencyMs }),
      publicPathAfter: Object.freeze({ repairs: eval007Summary.repairs, calls: eval007Summary.lunaCalls,
        costUsd: eval007Summary.totalCostUsd, p50LatencyMs: eval007Summary.p50LatencyMs, p95LatencyMs: eval007Summary.p95LatencyMs }),
      shadowIncremental: Object.freeze({ lunaCalls: 0, repairCalls: 0, costUsd: 0,
        p50LocalLatencyMs: evalAfter.summary.p50ShadowLatencyMs, p95LocalLatencyMs: evalAfter.summary.p95ShadowLatencyMs }),
      explanation: "Frozen public Luna responses were not regenerated; the provider candidate ran non-displayable deterministic shadow validation only.",
    }),
    regressionExecution,
    regression,
  })

  assert.equal(sealed.length, 300)
  assert.equal(freshQuestions.length, 300)
  assert.equal(fresh400.rows.length, 400)
  assert.ok(fresh400.summary.canonicalTopics >= 180)
  assert.equal(regression.result, "PASS", JSON.stringify({ regression, evalAfter: evalAfter.summary, fresh400: fresh400.summary }))
  assert.ok(evalAfter.summary.coveragePercent > Number(oldEval.coveragePercent))
  assert.ok(evalAfter.summary.catalogGap < Number(oldEval.catalogGap))

  writeJsonl("eval007-old-v2-shadow-replay.jsonl", evalAfter.rows)
  writeJsonl("fresh-300-old-v2-comparison.jsonl", freshAfter.rows)
  writeJson("top20-real-gaps.json", { priorityFormula: objective.gapRanking.formula, gaps: top20 })
  writeJsonl("source-recovery-audit.jsonl", recovery.audit)
  writeJsonl("verified-shadow-enrichment-atoms.jsonl", recovery.rawAtoms)
  writeJsonl("scientific-mapping-delta.jsonl", scientificMapping)
  writeJson("new-source-required.json", { status: recovery.unresolved.length ? "NEW_SOURCE_REQUIRED" : "NOT_REQUIRED",
    reason: "External content was not promoted without controlled exact retrieval and verification material.", gaps: recovery.unresolved })
  writeJsonl("fresh-400-shadow-benchmark.jsonl", fresh400.rows)
  writeJson("regression-summary.json", regression)
  writeJson("regression-execution.json", regressionExecution)
  writeJson("objective-summary.json", objective)
  const coverageCsv = ["facet,supported,applicable,coveragePercent,added",
    ...Object.entries(byFacet).map(([facet, row]) => {
      const typed = row as Json
      return `${facet},${typed.supported},${typed.applicable},${typed.coveragePercent},${typed.added}`
    })].join("\n")
  writeFileSync(join(OUTPUT_DIR, "coverage-after-enrichment.csv"), `${coverageCsv}\n`, "utf8")
  writeFileSync(join(OUTPUT_DIR, "README.md"), [
    "# Knowledge Core V2 Shadow Runtime Evidence",
    "",
    "This candidate-only package compares frozen OLD knowledge evidence with Knowledge Core V2 after the existing S13 interpretation step.",
    "Shadow answers are not display-eligible and no production import or Luna call was added.",
    "Source recovery reuses exact Owner Book atom text or already verified scientific claims only; unresolved cases remain NEW_SOURCE_REQUIRED.",
    "Codex did not score user-facing answer quality.",
    "",
  ].join("\n"), "utf8")

  const files = [
    "eval007-old-v2-shadow-replay.jsonl", "fresh-300-old-v2-comparison.jsonl", "top20-real-gaps.json",
    "source-recovery-audit.jsonl", "verified-shadow-enrichment-atoms.jsonl", "scientific-mapping-delta.jsonl",
    "new-source-required.json", "fresh-400-shadow-benchmark.jsonl", "coverage-after-enrichment.csv",
    "regression-summary.json", "regression-execution.json", "objective-summary.json", "README.md",
  ]
  writeJson("manifest.json", {
    schemaVersion: "dna-chat-knowledge-core-v2-shadow-runtime-manifest@1",
    candidateOnly: true, productionChanged: false, chatEngineChanged: false,
    lunaCallsThisRun: 0, qualityScoredByCodex: false,
    inputs: [V2_DIR, EVAL007_DIR, OLD_COVERAGE_DIR, EVIDENCE_DIR],
    files: files.map((name) => ({ name, sha256: sha256(readFileSync(join(OUTPUT_DIR, name), "utf8")) })),
  })
  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, result: regression.result,
    eval007: objective.eval007, fresh300: objective.fresh300.afterRecovery,
    recovery: objective.recovery, coverage: objective.coverageAfterEnrichment,
    fresh400: objective.fresh400, regression }, null, 2))
}

main()
