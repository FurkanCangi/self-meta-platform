import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

import denseKnowledgeRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { sumDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import type { DnaS13Depth, DnaS13RequestedFacet } from "../src/lib/dna/chat/s13/contracts"
import {
  DNA_S13_ADAPTIVE_REALIZATION_POLICY_VERSION,
  resolveDnaS13RealizationDecision,
  type DnaS13RealizationDecision,
} from "../src/lib/dna/chat/s13/adaptiveRealization"
import { DNA_CHAT_COST_EFFICIENT_MODE_VERSION } from "../src/lib/dna/chat/s13/costEfficientMode"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import { hashDnaS13LimitedIdentifier } from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import {
  runDnaS13LimitedRolloutMessage,
  type DnaS13LimitedTechnicalEvidence,
} from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import {
  resolveDnaS13PragmaticTask,
  type DnaS13PragmaticAction,
} from "../src/lib/dna/chat/s13/pragmaticTask"
import {
  DnaS13KnowledgeV2ShadowProvider,
  runDnaS13KnowledgeV2Shadow,
  type DnaKnowledgeV2Atom,
  type DnaKnowledgeV2Facet,
  type DnaKnowledgeV2Snapshot,
} from "../src/lib/dna/chat/s13/shadowKnowledgeV2"
import { hashDnaS13Artifact } from "../src/lib/dna/chat/s13/strictHash"
import { LunaRealizer } from "../src/lib/dna/chat/s13/strictLunaRealizer.server"
import {
  createDnaS13DeterministicRealization,
  DeterministicRealizer,
  DNA_S13_REALIZER_CONTRACT_VERSION,
  type DnaS13RealizerAttempt,
  type DnaS13RealizerRequest,
  type Realizer,
} from "../src/lib/dna/chat/s13/strictRealizer"
import { runDnaS13StrictRuntime, type DnaS13StrictRuntimeResult } from "../src/lib/dna/chat/s13/strictRuntime"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const V1_RELEASE_SCOPE = process.argv.includes("--v1-release-scope")
const SCHEMA_VERSION = V1_RELEASE_SCOPE
  ? "dna-v1-targeted-final-preproduction-certification@1"
  : "dna-chat-final-preproduction-certification@1"
const RUN_ID = process.env.DNA_FINAL_PREPROD_RUN_ID?.trim() || "run-20260814T172656Z"
const LOCAL_PREFLIGHT = process.argv.includes("--local-preflight")
const VALIDATE_FIXTURE_ONLY = process.argv.includes("--validate-fixture-only")
const REPLAY_EXISTING_FIXTURE = process.argv.includes("--replay-existing-fixture")
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const DNA_OUTPUT_ROOT = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence")
const RUN_ROOT = process.env.DNA_FINAL_PREPROD_RUN_DIR?.trim()
  || path.join(DNA_OUTPUT_ROOT, "final-preproduction-acceleration", RUN_ID)
const OUTPUT_DIR = process.env.DNA_FINAL_PREPROD_OUTPUT_DIR?.trim()
  || (LOCAL_PREFLIGHT ? `/tmp/dna-final-preproduction-preflight-${process.pid}-${randomUUID().slice(0, 8)}` : path.join(RUN_ROOT, "certification"))
const V2_DIR = path.join(DNA_OUTPUT_ROOT, "knowledge-core-v2-consolidation/run-001")
const RUN3_DIR = path.join(DNA_OUTPUT_ROOT, "core-knowledge-completion-run3/run-001")
const PREPROD_CATALOG = process.env.DNA_FINAL_PREPROD_CATALOG?.trim()
  || path.join(RUN_ROOT, "knowledge-expansion/preproduction-knowledge-catalog.jsonl")
const TOTAL_CAP_MICROUSD = V1_RELEASE_SCOPE ? 200_000 : 350_000
const QA_CAP_MICROUSD = 100_000
const CALL_RESERVE_MICROUSD = 8_000

const FILES = Object.freeze({
  blind200: path.join(OUTPUT_DIR, V1_RELEASE_SCOPE ? "BLIND_V1_FINAL_CHAT_200.md" : "BLIND_CHAT_PREPROD_200.md"),
  blindFollowups: path.join(OUTPUT_DIR, V1_RELEASE_SCOPE ? "BLIND_V1_FINAL_FOLLOWUPS_40.md" : "BLIND_CHAT_PREPROD_FOLLOWUPS_40.md"),
  blindAdversarial: path.join(OUTPUT_DIR, V1_RELEASE_SCOPE ? "BLIND_V1_FINAL_ADVERSARIAL_50.md" : "BLIND_CHAT_PREPROD_ADVERSARIAL_30.md"),
  blindSimple: path.join(OUTPUT_DIR, "BLIND_ADAPTIVE_SIMPLE_CASES.md"),
  sealed: path.join(OUTPUT_DIR, V1_RELEASE_SCOPE ? "SEALED_V1_FINAL_TRACE.jsonl" : "SEALED_CHAT_PREPROD_TRACE.jsonl"),
  fixtures: path.join(OUTPUT_DIR, "fixture-manifest.json"),
  core500: path.join(OUTPUT_DIR, "CORE_500_OBJECTIVE_BENCHMARK.jsonl"),
  summary: path.join(OUTPUT_DIR, "objective-certification-summary.json"),
  readme: path.join(OUTPUT_DIR, "README.md"),
})

type Json = Record<string, any>
type SetName = "adaptive_qa" | "fresh_200" | "multiturn_40" | "adversarial_30" | "adversarial_50"
type Family = "definition" | "why" | "deepen" | "example" | "compare" | "simplify"
  | "correction" | "two_subquestion" | "boundary" | "catalog_gap" | "ambiguous"
type Topic = Readonly<{ topicId: string; canonicalTopicId: string; title: string }>
type Fixture = Readonly<{
  id: string
  set: SetName
  family: Family
  conversationId: string
  turnIndex: number
  question: string
  responseDepth: DnaS13Depth
  expectedAction: DnaS13PragmaticAction | null
  expectedFacets: readonly DnaS13RequestedFacet[]
  expectedTopics: readonly Topic[]
  roughLanguage: boolean
  contextDependent: boolean
  expectedAmbiguous: boolean
}>
type Conversation = Readonly<{ id: string; turns: readonly Fixture[] }>
type ContextState = Readonly<{ token: string | null }>
type ObjectiveEvaluation = Readonly<{
  topicCorrect: boolean
  actionCorrect: boolean
  facetCorrect: boolean
  directAnswer: boolean
  contextCorrect: boolean
  catalogGap: boolean
  catalogGapFalseAnswer: boolean
  availableButNotSelected: boolean
  unsupportedScience: number
  unsupportedRelation: number
  sourceViolation: number
  safetyViolation: number
  certaintyDrift: number
  runtimeError: boolean
  criticalError: boolean
  validatorPass: boolean
}>
type Execution = Readonly<{
  fixture: Fixture
  answer: string
  nextContext: ContextState
  technical: DnaS13LimitedTechnicalEvidence | null
  decision: DnaS13RealizationDecision | null
  runtime: DnaS13StrictRuntimeResult | null
  retrievals: readonly Json[]
  evaluation: ObjectiveEvaluation
  trace: Json
  error: string | null
}>

const FACET_TO_REQUESTED: Readonly<Record<DnaKnowledgeV2Facet, DnaS13RequestedFacet>> = Object.freeze({
  CORE_SCOPE: "core_scope", DEFINITION: "definition", FUNCTION_SIGNIFICANCE: "function",
  BOUNDARY_LIMITATION: "boundary", EXPLANATORY_DETAIL: "explanatory_detail",
  EXAMPLE: "verified_example", RELATION_COMPARISON: "distinction",
})
const REQUESTED_TO_FACET: Readonly<Record<DnaS13RequestedFacet, DnaKnowledgeV2Facet>> = Object.freeze({
  definition: "DEFINITION", function: "FUNCTION_SIGNIFICANCE", boundary: "BOUNDARY_LIMITATION",
  supported_meaning: "CORE_SCOPE", limitation: "BOUNDARY_LIMITATION", components: "EXPLANATORY_DETAIL",
  core_scope: "CORE_SCOPE", explanatory_detail: "EXPLANATORY_DETAIL",
  distinction: "RELATION_COMPARISON", verified_example: "EXAMPLE",
})

function sha(value: string | Buffer) { return createHash("sha256").update(value).digest("hex") }
function percent(numerator: number, denominator: number) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(3)) : 100
}
function round(value: number, digits = 6) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
function unique<T>(values: readonly T[]) { return [...new Set(values)] }
function sameSet(left: readonly string[], right: readonly string[]) {
  const a = unique(left).sort(); const b = unique(right).sort()
  return a.length === b.length && a.every((value, index) => value === b[index])
}
function json(file: string) { return JSON.parse(readFileSync(file, "utf8")) as Json }
function jsonl(file: string) {
  return readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Json)
}
function writePrivate(file: string, value: string | unknown) {
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}
function appendPrivate(file: string, value: unknown) {
  appendFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 }); chmodSync(file, 0o600)
}
function limitedContextToken(body: Record<string, unknown>) {
  const value = body.conversationContext
  if (!value || typeof value !== "object") return null
  const token = (value as Record<string, unknown>).limitedRolloutContextToken
  return typeof token === "string" && token.trim() ? token : null
}
function visibleAnswerText(body: Record<string, unknown>) {
  const summary = typeof body.summary === "string" ? body.summary.trim() : ""
  const details = Array.isArray(body.details) ? body.details.map(String).map((value) => value.trim()).filter(Boolean) : []
  const units = Array.isArray(body.answerUnits) ? body.answerUnits.flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const text = typeof (value as Record<string, unknown>).text === "string"
      ? String((value as Record<string, unknown>).text).trim() : ""
    return text ? [text] : []
  }) : []
  return (units.length ? units : [summary, ...details]).filter(Boolean).join("\n\n")
}

function toAtom(row: Json): DnaKnowledgeV2Atom {
  return Object.freeze({
    atomId: String(row.atomId), text: String(row.text), canonicalTopicId: String(row.canonicalTopicId),
    canonicalTitle: String(row.canonicalTitle), sourceId: String(row.sourceId), passageId: String(row.passageId),
    explicitFacet: row.explicitFacet ?? null, coverageFacet: row.coverageFacet ?? null,
    supportedFacets: Object.freeze((row.supportedFacets ?? []).map(String)
      .filter((facet: string) => Object.prototype.hasOwnProperty.call(FACET_TO_REQUESTED, facet)) as DnaKnowledgeV2Facet[]),
    claimRoleV2: row.claimRoleV2 ?? null, selfContained: row.selfContained === true,
    standaloneFinalAnswerEligible: row.standaloneFinalAnswerEligible === true,
    answerEligible: row.answerEligible === true, dimensions: Object.freeze((row.dimensions ?? []).map(String)),
    domain: row.domain ?? null, sourceSectionId: row.sourceSectionId ?? null,
    authorityClass: row.authorityClass ?? null, citationStatus: row.citationStatus ?? null,
  })
}

function loadSnapshot(): DnaKnowledgeV2Snapshot {
  const topics = json(path.join(V2_DIR, "canonical_topics.json")).canonicalTopics as Json[]
  const aliases = json(path.join(V2_DIR, "topic_alias_map.json")).aliases as Json[]
  const atoms = jsonl(PREPROD_CATALOG)
  const bundles = json(path.join(V2_DIR, "answer_bundles.json")).bundles as Json[]
  return Object.freeze({
    canonicalTopics: Object.freeze(topics.map((topic) => Object.freeze({
      canonicalTopicId: String(topic.canonicalTopicId), canonicalTitle: String(topic.canonicalTitle),
      aliases: Object.freeze((topic.aliases ?? []).map(String)), oldTopicIds: Object.freeze((topic.oldTopicIds ?? []).map(String)),
      applicableFacets: Object.freeze((topic.applicableFacets ?? []) as DnaKnowledgeV2Facet[]),
      atomIds: Object.freeze((topic.atomIds ?? []).map(String)),
    }))),
    aliases: Object.freeze(aliases.map((alias) => Object.freeze({
      oldTopicId: String(alias.oldTopicId), canonicalTopicId: String(alias.canonicalTopicId),
      backwardCompatible: alias.backwardCompatible === true,
    }))),
    atoms: Object.freeze(atoms.map(toAtom)),
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

class BudgetedLunaRealizer implements Realizer {
  readonly identity
  private readonly inner: LunaRealizer | null
  private readonly rows: { phase: "adaptive_qa" | "simple_audit" | "certification"; usage: DnaChatLunaUsage }[] = []
  private readonly calls: ("adaptive_qa" | "simple_audit" | "certification")[] = []
  phase: "adaptive_qa" | "simple_audit" | "certification" = "adaptive_qa"
  externalCalls = 0
  stopReason: string | null = null

  constructor(apiKey: string, safetyIdentifier: string, private readonly local: boolean) {
    this.inner = local ? null : new LunaRealizer({ apiKey, safetyIdentifier })
    this.identity = this.inner?.identity ?? Object.freeze({
      provider: "luna" as const, model: "local-preflight-luna-stub",
      implementationVersion: "local-preflight-luna-stub@1",
    })
  }

  totalUsage() { return sumDnaChatLunaUsage(this.rows.map((row) => row.usage)) }
  phaseUsage(phase: "adaptive_qa" | "simple_audit" | "certification") {
    return sumDnaChatLunaUsage(this.rows.filter((row) => row.phase === phase).map((row) => row.usage))
  }
  phaseCalls(phase: "adaptive_qa" | "simple_audit" | "certification") {
    return this.calls.filter((value) => value === phase).length
  }
  qaBudgetUsage() {
    return sumDnaChatLunaUsage(this.rows.filter((row) => row.phase !== "certification").map((row) => row.usage))
  }
  canCall() {
    if (this.local) return true
    const total = this.totalUsage().costMicrousd
    const qa = this.qaBudgetUsage().costMicrousd
    if (total > TOTAL_CAP_MICROUSD - CALL_RESERVE_MICROUSD) return false
    if (this.phase !== "certification" && qa > QA_CAP_MICROUSD - CALL_RESERVE_MICROUSD) return false
    return !this.stopReason
  }
  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    if (!this.canCall()) {
      this.stopReason = this.phase !== "certification" ? "adaptive_qa_hard_cap_reserve_reached" : "total_hard_cap_reserve_reached"
      throw new Error(this.stopReason)
    }
    if (this.local) {
      const realization = createDnaS13DeterministicRealization(input.plan, { question: input.question })
      return Object.freeze({
        contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION, identity: this.identity,
        prompt: Object.freeze({ version: "local-preflight-luna-stub@1", hash: hashDnaS13Artifact({ plan: input.plan, attempt: input.attempt }) }),
        realization, rawOutput: JSON.stringify(realization), responseId: null,
        usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }), latencyMs: 0,
      })
    }
    const attempt = await this.inner!.realize(input)
    this.externalCalls += 1
    this.calls.push(this.phase)
    this.rows.push({ phase: this.phase, usage: attempt.usage })
    if (this.totalUsage().costMicrousd > TOTAL_CAP_MICROUSD
      || this.qaBudgetUsage().costMicrousd > QA_CAP_MICROUSD) {
      this.stopReason = "provider_hard_cap_exceeded"
      throw new Error(this.stopReason)
    }
    return attempt
  }
}

function topicPool(provider: DnaS13KnowledgeV2ShadowProvider) {
  const units = (denseKnowledgeRuntimeJson as unknown as { units: readonly { topicId: string; title: string }[] }).units
  const titleIds = new Map<string, Set<string>>()
  for (const unit of units) {
    const key = normalizeDnaChatText(unit.title); const ids = titleIds.get(key) ?? new Set<string>()
    ids.add(unit.topicId); titleIds.set(key, ids)
  }
  const rows = [...new Map(units.map((unit) => [unit.topicId, unit])).values()].flatMap((unit) => {
    const canonicalTopicId = provider.resolveCanonicalTopicId(unit.topicId)
    if (!canonicalTopicId || unit.title.length < 8 || unit.title.length > 84 || /[?\n\r]/u.test(unit.title)) return []
    if (titleIds.get(normalizeDnaChatText(unit.title))?.size !== 1) return []
    const resolved = resolveDnaS13NamedTopicSurfaces(unit.title)
    if (resolved.length !== 1 || resolved[0]?.topicId !== unit.topicId || resolved[0].confidence === "LOW") return []
    return [Object.freeze({ topicId: unit.topicId, canonicalTopicId, title: unit.title.trim() })]
  }).sort((left, right) => sha(`preprod-pool|${left.topicId}`).localeCompare(sha(`preprod-pool|${right.topicId}`)))
  if (rows.length < 300) throw new Error(`preprod_topic_pool_too_small:${rows.length}`)
  return Object.freeze(rows)
}

function supported(provider: DnaS13KnowledgeV2ShadowProvider, topic: Topic, facets: readonly DnaKnowledgeV2Facet[]) {
  return facets.every((facet) => provider.retrieve(topic.topicId, facet).status !== "UNSUPPORTED")
}

function singleTopicTask(question: string, topic: Topic, responseDepth: DnaS13Depth) {
  return resolveDnaS13PragmaticTask({
    question, responseDepth, correction: false, contextInherited: false, namedTargetCount: 1,
    targets: Object.freeze([Object.freeze({ topicId: topic.topicId, surface: topic.title, polarity: "ACTIVE_TARGET" as const })]),
  })
}

function pools(provider: DnaS13KnowledgeV2ShadowProvider) {
  const all = topicPool(provider)
  const byFacet = Object.fromEntries((Object.keys(FACET_TO_REQUESTED) as DnaKnowledgeV2Facet[]).map((facet) => [
    facet, all.filter((topic) => supported(provider, topic, [facet])),
  ])) as unknown as Record<DnaKnowledgeV2Facet, readonly Topic[]>
  const definitionFunction = all.filter((topic) => supported(provider, topic, ["DEFINITION", "FUNCTION_SIGNIFICANCE"]))
  const multi = all.filter((topic) => supported(provider, topic, ["DEFINITION", "FUNCTION_SIGNIFICANCE", "EXPLANATORY_DETAIL"]))
  const catalogGapExample = all.filter((topic) => supported(provider, topic, ["DEFINITION"])
    && provider.retrieve(topic.topicId, "EXAMPLE").status === "UNSUPPORTED")
  const boundarySafe = byFacet.BOUNDARY_LIMITATION.filter((topic) => {
    const question = `${topic.title} ne değildir; yorum sınırını açık biçimde söyler misin?`
    const task = singleTopicTask(question, topic, "standard")
    return inspectDnaS13LimitedRolloutPrivacy({ question, mode: "theory" }).allowed
      && task.pragmaticAction === "OTHER" && sameSet(task.requestedFacets, ["boundary"])
  })
  for (const [facet, rows] of Object.entries(byFacet)) if (rows.length < 40) throw new Error(`preprod_pool_short:${facet}:${rows.length}`)
  if (definitionFunction.length < 50 || multi.length < 40 || catalogGapExample.length < 30
    || (!V1_RELEASE_SCOPE && boundarySafe.length < 40)) {
    throw new Error(`preprod_compound_pool_short:${JSON.stringify({ definitionFunction: definitionFunction.length,
      multi: multi.length, catalogGapExample: catalogGapExample.length, boundarySafe: boundarySafe.length })}`)
  }
  return Object.freeze({ all, byFacet, definitionFunction: Object.freeze(definitionFunction),
    multi: Object.freeze(multi), catalogGapExample: Object.freeze(catalogGapExample),
    boundarySafe: Object.freeze(boundarySafe) })
}

function pick(rows: readonly Topic[], index: number, _salt: string) {
  return rows[index % rows.length]!
}

function fixture(input: Omit<Fixture, "id"> & { id: string }): Fixture { return Object.freeze(input) }

function buildAdaptiveQa(input: ReturnType<typeof pools>) {
  const distribution: readonly [Family, number][] = V1_RELEASE_SCOPE
    ? [["definition", 15], ["why", 7], ["example", 5], ["deepen", 5], ["compare", 5], ["two_subquestion", 3]]
    : [["definition", 10], ["why", 7], ["simplify", 5], ["example", 5], ["deepen", 5], ["compare", 5], ["two_subquestion", 3]]
  const rows: Fixture[] = []; let global = 0
  for (const [family, count] of distribution) for (let index = 0; index < count; index += 1) {
    const id = `adaptive-qa-${String(global + 1).padStart(2, "0")}`
    const a = family === "definition" ? pick(input.byFacet.DEFINITION, index, id)
      : family === "why" ? pick(input.byFacet.FUNCTION_SIGNIFICANCE, index, id)
        : family === "simplify" ? pick(input.byFacet.CORE_SCOPE, index, id)
          : family === "example" ? pick(input.byFacet.EXAMPLE, index, id)
            : family === "deepen" ? pick(input.byFacet.EXPLANATORY_DETAIL, index, id)
              : family === "compare" ? pick(input.byFacet.RELATION_COMPARISON, index * 2, id)
                : pick(input.definitionFunction, index * 2, id)
    const b = family === "compare" ? pick(input.byFacet.RELATION_COMPARISON, index * 2 + 1, id)
      : family === "two_subquestion" ? pick(input.definitionFunction, index * 2 + 1, id) : null
    const question = family === "definition" ? `${a.title} kavramını bu kez tek cümlede doğrudan tanımlar mısın?`
      : family === "why" ? `${a.title} neden önemlidir; işlevsel anlamını kısa söyler misin?`
        : family === "simplify" ? `${a.title} açıklamasını teknik ifadeleri azaltarak daha sade anlatır mısın?`
          : family === "example" ? `${a.title} için kontrollü içeriğin desteklediği somut bir örnek verir misin?`
            : family === "deepen" ? `${a.title} için ana açıklamayı yinelemeden yeni bir ayrıntı verir misin?`
              : family === "compare" ? `${a.title} ile ${b!.title} nasıl ayrılır; aynı düzeyde mi ele alınırlar?`
                : `Önce ${a.title} nedir, sonra ${b!.title} neden önemlidir? İki kısmı ayrı yanıtla.`
    const expectedAction: DnaS13PragmaticAction = family === "definition" ? "DEFINE"
      : family === "why" ? "WHY_SIGNIFICANCE" : family === "simplify" ? "SIMPLIFY"
        : family === "example" ? "EXAMPLE" : family === "deepen" ? "DEEPEN"
          : family === "compare" ? "COMPARE" : "EXPLAIN"
    const expectedFacets: readonly DnaS13RequestedFacet[] = family === "definition" ? ["definition"]
      : family === "why" ? ["function"] : family === "simplify" ? ["core_scope"]
        : family === "example" ? ["verified_example"] : family === "deepen" ? ["explanatory_detail"]
          : family === "compare" ? ["distinction"] : ["definition", "function"]
    rows.push(fixture({ id, set: "adaptive_qa", family, conversationId: id, turnIndex: 1,
      question, responseDepth: ["definition", "why", "simplify"].includes(family) ? "short"
        : family === "deepen" ? "deep" : "standard",
      expectedAction, expectedFacets: Object.freeze([...expectedFacets]), expectedTopics: Object.freeze(b ? [a, b] : [a]),
      roughLanguage: false, contextDependent: false, expectedAmbiguous: false }))
    global += 1
  }
  if (rows.length !== 40) throw new Error("adaptive_qa_fixture_count")
  return Object.freeze(rows)
}

const FRESH_DISTRIBUTION: readonly [Family, number][] = V1_RELEASE_SCOPE
  ? [["definition", 30], ["why", 30], ["deepen", 25], ["example", 20], ["compare", 25],
      ["correction", 20], ["two_subquestion", 20], ["boundary", 15], ["catalog_gap", 15]]
  : [["definition", 25], ["why", 25], ["deepen", 20], ["example", 15], ["compare", 20],
      ["simplify", 20], ["correction", 15], ["two_subquestion", 15], ["boundary", 20], ["catalog_gap", 25]]

function buildFresh200(input: ReturnType<typeof pools>) {
  const rows: Fixture[] = []; let global = 0
  for (const [family, count] of FRESH_DISTRIBUTION) for (let index = 0; index < count; index += 1) {
    const id = `fresh-${String(global + 1).padStart(3, "0")}`; const rough = global < 80
    const a = family === "definition" ? pick(input.byFacet.DEFINITION, index, id)
      : family === "why" ? pick(input.byFacet.FUNCTION_SIGNIFICANCE, index, id)
        : family === "deepen" ? pick(input.byFacet.EXPLANATORY_DETAIL, index, id)
          : family === "example" ? pick(input.byFacet.EXAMPLE, index, id)
            : family === "compare" ? pick(input.byFacet.RELATION_COMPARISON, index * 2, id)
              : family === "simplify" || family === "correction" ? pick(input.byFacet.CORE_SCOPE, index * 2, id)
                : family === "two_subquestion" ? pick(input.definitionFunction, index * 2, id)
                  : family === "boundary" ? pick(V1_RELEASE_SCOPE ? input.byFacet.BOUNDARY_LIMITATION : input.boundarySafe, index, id)
                    : pick(input.catalogGapExample, index, id)
    const b = family === "compare" ? pick(input.byFacet.RELATION_COMPARISON, index * 2 + 1, id)
      : family === "correction" ? pick(input.byFacet.CORE_SCOPE, index * 2 + 1, id)
        : family === "two_subquestion" ? pick(input.definitionFunction, index * 2 + 1, id) : null
    const question = V1_RELEASE_SCOPE
      ? family === "definition" ? (rough ? `${a.title} ndr ya; temel definition neyi ifade ediyor?` : `${a.title} neyi ifade eder; çekirdek tanımını ilk kez öğrenene açıklar mısın?`)
        : family === "why" ? (rough ? `${a.title} pratikte niye dikkate alınıyo; function ne?` : `${a.title} neden dikkate alınır; işlevsel değeri nedir?`)
          : family === "deepen" ? (rough ? `${a.title} için öncekini tekrarlamadan bi ek ayrıntı açar mısın?` : `${a.title} hakkında önceki ana açıklamayı yinelemeden yeni bir ayrıntı ekler misin?`)
            : family === "example" ? (rough ? `${a.title} gündelikte nasıl görünür; destekli somut bi örnek?` : `${a.title} için kontrollü içerikle desteklenen somut bir örnek verir misin?`)
              : family === "compare" ? `${a.title} ve ${b!.title} yan yana düşünülünce güvenli ayrımları nedir?`
                : family === "correction" ? `İlk söylediğim ${a.title} değil; asıl hedef ${b!.title}, sadece onu açıkla.`
                  : family === "two_subquestion" ? `${a.title} nedir; sonra ${b!.title} niçin önem taşır? İki yanıtı sırayla ver.`
                    : family === "boundary" ? `${a.title} konusunda kanıtın kesin söyleyemediği güvenli bilimsel sınır nedir?`
                      : `${a.title} için kaynakça destekli gündelik bir örnek bulunuyor mu?`
      : family === "definition" ? (rough ? `${a.title} ndr ya; net core meaning ne?` : `“${a.title}” nedir; çekirdek tanımını doğrudan verir misin?`)
        : family === "why" ? (rough ? `${a.title} niye önemli, işlev ne kısaca?` : `${a.title} neden önemlidir; işlevsel değerini açıklar mısın?`)
          : family === "deepen" ? (rough ? `${a.title} için tekrar etmeden yeni bir ayrıntı açar mısın?` : `${a.title} konusunda önce söylenmeyen yeni bir ayrıntı verir misin?`)
            : family === "example" ? (rough ? `${a.title} için gerçek hayattan somut bi örnek var mı?` : `${a.title} için kaynakla desteklenen somut bir örnek verir misin?`)
              : family === "compare" ? `${a.title} vs ${b!.title}; güvenli fark ne, aynı düzey mi?`
                : family === "simplify" ? `${a.title} çok teknik geldi; simple TR ile kısa anlatır mısın?`
                  : family === "correction" ? `${a.title} değil; ${b!.title} hedefim, yalnız onu açıkla.`
                    : family === "two_subquestion" ? `Önce ${a.title} nedir, ardından ${b!.title} neden önemlidir?`
                      : family === "boundary" ? `${a.title} ne değildir; yorum sınırını açık biçimde söyler misin?`
                        : `${a.title} için doğrulanmış somut bir örnek var mı?`
    const expectedAction: DnaS13PragmaticAction = family === "definition" ? "DEFINE" : family === "why" ? "WHY_SIGNIFICANCE"
      : family === "deepen" ? "DEEPEN" : ["example", "catalog_gap"].includes(family) ? "EXAMPLE"
        : family === "compare" ? "COMPARE" : family === "simplify" ? "SIMPLIFY"
          : family === "correction" ? "CORRECT_TARGET" : family === "two_subquestion" ? "EXPLAIN"
            : family === "boundary" && V1_RELEASE_SCOPE ? "EXPLAIN" : "OTHER"
    const expectedFacets: readonly DnaS13RequestedFacet[] = family === "definition" ? ["definition"]
      : family === "why" ? ["function"] : family === "deepen" ? ["explanatory_detail"]
        : ["example", "catalog_gap"].includes(family) ? ["verified_example"]
          : family === "compare" ? ["distinction"] : ["simplify", "correction"].includes(family) ? ["core_scope"]
            : family === "two_subquestion" ? ["definition", "function"] : ["boundary"]
    const expectedTopics = family === "correction" ? [b!] : b ? [a, b] : [a]
    rows.push(fixture({ id, set: "fresh_200", family, conversationId: id, turnIndex: 1, question,
      responseDepth: family === "deepen" ? "deep" : ["definition", "why", "simplify"].includes(family) ? "short" : "standard",
      expectedAction, expectedFacets: Object.freeze([...expectedFacets]), expectedTopics: Object.freeze(expectedTopics),
      roughLanguage: rough, contextDependent: false, expectedAmbiguous: false }))
    global += 1
  }
  if (rows.length !== 200 || rows.filter((row) => row.roughLanguage).length !== 80) throw new Error("fresh_200_fixture_shape")
  return Object.freeze(rows)
}

function buildMultiTurn40(input: ReturnType<typeof pools>) {
  const conversations: Conversation[] = []
  for (let index = 0; index < 40; index += 1) {
    const topic = pick(input.multi, index, `multiturn-${index}`)
    const id = `multiturn-${String(index + 1).padStart(2, "0")}`; const complex = index >= 30
    const turns: Fixture[] = [fixture({ id: `${id}-t1`, set: "multiturn_40", family: "definition", conversationId: id,
      turnIndex: 1, question: `${topic.title} başlığını doğrudan ve kısa tanımlar mısın?`, responseDepth: "short",
      expectedAction: "DEFINE", expectedFacets: Object.freeze(["definition"]), expectedTopics: Object.freeze([topic]),
      roughLanguage: false, contextDependent: false, expectedAmbiguous: false })]
    if (V1_RELEASE_SCOPE) {
      turns.push(fixture({ id: `${id}-t2`, set: "multiturn_40", family: "why", conversationId: id, turnIndex: 2,
        question: "bu kavramı pratikte neden dikkate alıyoruz; işlevi ne?", responseDepth: "short", expectedAction: "WHY_SIGNIFICANCE",
        expectedFacets: Object.freeze(["function"]), expectedTopics: Object.freeze([topic]), roughLanguage: index % 2 === 0,
        contextDependent: true, expectedAmbiguous: false }))
      turns.push(fixture({ id: `${id}-t3`, set: "multiturn_40", family: "deepen", conversationId: id, turnIndex: 3,
        question: "önceki yanıtı yinelemeden bu konuda yeni bir ayrıntı verir misin?", responseDepth: "deep", expectedAction: "DEEPEN",
        expectedFacets: Object.freeze(["explanatory_detail"]), expectedTopics: Object.freeze([topic]), roughLanguage: index % 2 === 1,
        contextDependent: true, expectedAmbiguous: false }))
    } else if (complex) {
      turns.push(fixture({ id: `${id}-t2`, set: "multiturn_40", family: "why", conversationId: id, turnIndex: 2,
        question: "peki bunu niye önemli sayıyoruz; işlevi ne?", responseDepth: "short", expectedAction: "WHY_SIGNIFICANCE",
        expectedFacets: Object.freeze(["function"]), expectedTopics: Object.freeze([topic]), roughLanguage: true,
        contextDependent: true, expectedAmbiguous: false }))
      turns.push(fixture({ id: `${id}-t3`, set: "multiturn_40", family: "deepen", conversationId: id, turnIndex: 3,
        question: "öncekini yinelemeden yeni bir ayrıntı verir misin?", responseDepth: "deep", expectedAction: "DEEPEN",
        expectedFacets: Object.freeze(["explanatory_detail"]), expectedTopics: Object.freeze([topic]), roughLanguage: true,
        contextDependent: true, expectedAmbiguous: false }))
    } else {
      turns.push(fixture({ id: `${id}-t2`, set: "multiturn_40", family: "simplify", conversationId: id, turnIndex: 2,
        question: "bunu daha sade ve günlük Türkçeyle söyler misin?", responseDepth: "short", expectedAction: "SIMPLIFY",
        expectedFacets: Object.freeze(["definition"]), expectedTopics: Object.freeze([topic]), roughLanguage: false,
        contextDependent: true, expectedAmbiguous: false }))
      turns.push(fixture({ id: `${id}-t3`, set: "multiturn_40", family: "simplify", conversationId: id, turnIndex: 3,
        question: "aynı anlamı koruyup bir cümleyle daha yalın söylesene.", responseDepth: "short", expectedAction: "SIMPLIFY",
        expectedFacets: Object.freeze(["definition"]), expectedTopics: Object.freeze([topic]), roughLanguage: true,
        contextDependent: true, expectedAmbiguous: false }))
    }
    conversations.push(Object.freeze({ id, turns: Object.freeze(turns) }))
  }
  return Object.freeze(conversations)
}

function buildAdversarial30(input: ReturnType<typeof pools>) {
  const units = (denseKnowledgeRuntimeJson as unknown as { units: readonly { topicId: string; title: string }[] }).units
  const duplicateGroups = [...new Map(units.map((unit) => {
    const key = normalizeDnaChatText(unit.title)
    return [key, units.filter((candidate) => normalizeDnaChatText(candidate.title) === key)] as const
  })).values()].map((rows) => [...new Map(rows.map((row) => [row.topicId, row])).values()])
    .filter((rows) => rows.length > 1 && rows[0]!.title.length >= 8).slice(0, 10)
  const rows: Fixture[] = duplicateGroups.map((group, index) => fixture({
    id: `adversarial-${String(index + 1).padStart(2, "0")}`, set: "adversarial_30", family: "ambiguous",
    conversationId: `adversarial-${index + 1}`, turnIndex: 1,
    question: `“${group[0]!.title}” derken hangi başlık kastediliyor; gerekirse netleştir.`, responseDepth: "short",
    expectedAction: null, expectedFacets: Object.freeze([]), expectedTopics: Object.freeze([]), roughLanguage: false,
    contextDependent: false, expectedAmbiguous: true,
  }))
  const vague = [
    "bunu biraz açar mısın, hangi konu olduğunu da söyle", "şu önceki şey neden önemliydi ya", "o mekanizma neydi tam",
    "ikisini kıyasla ama hangileri olduğunu net hatırlamıyorum", "bunu daha sade söyle ama hedefi önce kontrol et",
    "orada ne demek istedin, konu belli değilse sor", "aynı başlığa dönelim ama hangi başlık emin değilim",
    "bunun örneği var mı ya, önce neyi kastettiğimi netleştir", "o sistem mi süreç mi, hedef belirsiz",
    "önceki değil öbürü; hangisi olduğunu sorabilirsin",
  ]
  for (let index = 0; index < vague.length; index += 1) rows.push(fixture({
    id: `adversarial-${String(rows.length + 1).padStart(2, "0")}`, set: "adversarial_30", family: "ambiguous",
    conversationId: `adversarial-${rows.length + 1}`, turnIndex: 1, question: vague[index]!, responseDepth: "short",
    expectedAction: null, expectedFacets: Object.freeze([]), expectedTopics: Object.freeze([]), roughLanguage: true,
    contextDependent: false, expectedAmbiguous: true,
  }))
  for (let index = 0; rows.length < 30; index += 1) {
    const topic = pick(input.byFacet.DEFINITION, index, `adversarial-typo-${index}`)
    const roughSurface = topic.title.replace(/[aeıioöuü]/iu, "")
    rows.push(fixture({ id: `adversarial-${String(rows.length + 1).padStart(2, "0")}`, set: "adversarial_30", family: "ambiguous",
      conversationId: `adversarial-${rows.length + 1}`, turnIndex: 1,
      question: `${roughSurface} mi başka bi kavram mı; emin değilsen netleştir?`, responseDepth: "short",
      expectedAction: null, expectedFacets: Object.freeze([]), expectedTopics: Object.freeze([topic]), roughLanguage: true,
      contextDependent: false, expectedAmbiguous: true }))
  }
  if (V1_RELEASE_SCOPE) {
    for (let index = 0; rows.length < 45; index += 1) {
      const topic = pick(input.byFacet.DEFINITION, index + 17, `v1-adversarial-definition-${index}`)
      const variants = [
        `${topic.title} ndr, çok kısa temel tanım?`,
        `What is ${topic.title}; Türkçe çekirdek anlamı ne?`,
        `${topic.title} hakkında temel şey neydi ya...`,
      ]
      const coreScopeVariant = index % variants.length === 2
      const mixedDefinitionVariant = index % variants.length === 1
      rows.push(fixture({ id: `adversarial-${String(rows.length + 1).padStart(2, "0")}`, set: "adversarial_50", family: "definition",
        conversationId: `adversarial-${rows.length + 1}`, turnIndex: 1, question: variants[index % variants.length]!, responseDepth: "short",
        expectedAction: coreScopeVariant ? "EXPLAIN" : "DEFINE",
        expectedFacets: Object.freeze(coreScopeVariant ? ["core_scope"] : mixedDefinitionVariant ? ["definition", "core_scope"] : ["definition"]),
        expectedTopics: Object.freeze([topic]), roughLanguage: true,
        contextDependent: false, expectedAmbiguous: false }))
    }
    for (let index = 0; rows.length < 50; index += 1) {
      const topic = pick(input.multi, index + 29, `v1-adversarial-simplify-${index}`)
      rows.push(fixture({ id: `adversarial-${String(rows.length + 1).padStart(2, "0")}`, set: "adversarial_50", family: "simplify",
        conversationId: `adversarial-${rows.length + 1}`, turnIndex: 1,
        question: `${topic.title} temel olarak ne anlatır; teknik geldiği için daha sade günlük dille açıklar mısın?`, responseDepth: "short",
        expectedAction: "EXPLAIN", expectedFacets: Object.freeze(["core_scope"]), expectedTopics: Object.freeze([topic]), roughLanguage: false,
        contextDependent: false, expectedAmbiguous: false }))
    }
    return Object.freeze(rows.map((row) => row.set === "adversarial_30" ? Object.freeze({ ...row, set: "adversarial_50" as const }) : row))
  }
  return Object.freeze(rows)
}

function questionsFromBlindMarkdown(value: string) {
  const lines = value.split(/\r?\n/u); const questions: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trim() !== "Kullanıcı:") continue
    const collected: string[] = []
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor] ?? ""
      if (/^(?:Asistan:|Yanıt [AB]:|Kullanıcı:|---|## )/u.test(line.trim())) break
      if (line.trim()) collected.push(line.trim())
    }
    if (collected.length) questions.push(collected.join(" "))
  }
  return questions
}

function validateFixtures(all: readonly Fixture[]) {
  const freshnessScoped = all.filter((row) => row.set !== "multiturn_40")
  if (new Set(freshnessScoped.map((row) => normalizeDnaChatText(row.question))).size !== freshnessScoped.length) {
    const grouped = new Map<string, string[]>()
    for (const row of freshnessScoped) {
      const key = normalizeDnaChatText(row.question)
      grouped.set(key, [...(grouped.get(key) ?? []), row.id])
    }
    const duplicates = [...grouped].filter(([, ids]) => ids.length > 1).map(([question, ids]) => ({ question, ids }))
    throw new Error(`preprod_duplicate_fresh_fixture_question:${JSON.stringify(duplicates)}`)
  }
  for (const conversationId of unique(all.filter((row) => row.set === "multiturn_40").map((row) => row.conversationId))) {
    const turns = all.filter((row) => row.conversationId === conversationId)
    if (new Set(turns.map((row) => normalizeDnaChatText(row.question))).size !== turns.length) {
      throw new Error(`preprod_duplicate_turn_within_conversation:${conversationId}`)
    }
  }
  const privacyRejected = all.filter((row) => !inspectDnaS13LimitedRolloutPrivacy({ question: row.question, mode: "theory" }).allowed)
  if (privacyRejected.length) throw new Error(`preprod_fixture_privacy_rejected:${JSON.stringify(privacyRejected.map((row) => ({ id: row.id, question: row.question })))}`)
  const priorRoot = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence")
  const files = existsSync(priorRoot) ? execFileSync("find", [priorRoot, "-type", "f", "-name", "BLIND*.md"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean).filter((file) => !file.startsWith(OUTPUT_DIR)) : []
  const prior = new Set(files.flatMap((file) => {
    try { return questionsFromBlindMarkdown(readFileSync(file, "utf8")) } catch { return [] }
  }).map(normalizeDnaChatText))
  const exactReuse = all.filter((row) => row.set === "fresh_200" && prior.has(normalizeDnaChatText(row.question)))
  if (exactReuse.length && !REPLAY_EXISTING_FIXTURE) {
    throw new Error(`preprod_prior_exact_reuse:${exactReuse.map((row) => row.id).join(",")}`)
  }
  return Object.freeze({ totalMessages: all.length, privacyRejected: 0, priorBlindFilesChecked: files.length,
    priorQuestionCount: prior.size, exactReuseCount: exactReuse.length,
    replayExistingFixture: REPLAY_EXISTING_FIXTURE })
}

function evaluate(input: Readonly<{
  fixture: Fixture
  technical: DnaS13LimitedTechnicalEvidence | null
  runtime: DnaS13StrictRuntimeResult | null
  retrievals: readonly Json[]
  answer: string
  limitedKind: string
  error: string | null
}>) : ObjectiveEvaluation {
  if (input.fixture.expectedAmbiguous) {
    const safe = input.limitedKind === "clarification" || input.limitedKind === "fallback"
      || Boolean(input.runtime?.finalValidation.pass && input.answer.trim())
    return Object.freeze({ topicCorrect: safe, actionCorrect: safe, facetCorrect: safe, directAnswer: safe,
      contextCorrect: safe, catalogGap: false, catalogGapFalseAnswer: false, availableButNotSelected: false,
      unsupportedScience: input.runtime?.finalValidation.unsupportedAdditionCount ?? 0,
      unsupportedRelation: input.runtime?.finalValidation.unsupportedRelationCount ?? 0,
      sourceViolation: input.runtime?.finalValidation.sourceViolationCount ?? 0,
      safetyViolation: input.runtime?.finalValidation.safetyViolationCount ?? 0,
      certaintyDrift: input.runtime?.finalValidation.failureCodes.filter((code) =>
        code === "causality_escalated" || code === "epistemic_force_escalated").length ?? 0,
      runtimeError: Boolean(input.error), criticalError: Boolean(input.error),
      validatorPass: safe })
  }
  const expectedTopicIds = input.fixture.expectedTopics.map((topic) => topic.topicId)
  const actualTopicIds = input.technical?.queryFrame.subquestions.map((row) => row.topicId) ?? []
  const topicCorrect = sameSet(expectedTopicIds, actualTopicIds)
  const actualAction = input.technical?.pragmaticTaskFrame.pragmaticAction ?? null
  const actualFacets = input.technical?.pragmaticTaskFrame.requestedFacets ?? []
  const actionCorrect = actualAction === input.fixture.expectedAction
  const facetCorrect = sameSet(input.fixture.expectedFacets, actualFacets)
  const catalogGap = input.retrievals.some((row) => row.status === "UNSUPPORTED")
  const availableButNotSelected = input.retrievals.some((row) => row.availableButNotSelected === true)
  const validation = input.runtime?.finalValidation ?? null
  const unsupportedScience = (validation?.unsupportedAdditionCount ?? 0) + (validation?.unsupportedRelationCount ?? 0)
  // answeredUnsupportedSlotCount records a controlled evidence-limitation slot,
  // not a fabricated answer. A catalog-gap false answer requires a grounding
  // violation or a claim-bearing answer outside the supported locked plan.
  const catalogGapFalseAnswer = catalogGap && (unsupportedScience > 0
    || (validation?.sourceViolationCount ?? 0) > 0
    || (validation?.safetyViolationCount ?? 0) > 0
    || !validation?.pass)
  const validatorPass = Boolean(validation?.pass)
  const directAnswer = topicCorrect && actionCorrect && facetCorrect && validatorPass
    && Boolean(input.answer.trim()) && !catalogGapFalseAnswer && !availableButNotSelected && !input.error
  const contextCorrect = !input.fixture.contextDependent || topicCorrect
  const sourceViolation = validation?.sourceViolationCount ?? 0
  const safetyViolation = validation?.safetyViolationCount ?? 0
  return Object.freeze({ topicCorrect, actionCorrect, facetCorrect, directAnswer, contextCorrect,
    catalogGap, catalogGapFalseAnswer, availableButNotSelected, unsupportedScience,
    unsupportedRelation: validation?.unsupportedRelationCount ?? 0, sourceViolation, safetyViolation,
    certaintyDrift: validation?.failureCodes.filter((code) => code === "causality_escalated" || code === "epistemic_force_escalated").length ?? 0,
    runtimeError: Boolean(input.error), criticalError: Boolean(input.error) || safetyViolation > 0 || sourceViolation > 0,
    validatorPass })
}

async function execute(input: Readonly<{
  fixture: Fixture
  context: ContextState
  subjectId: string
  subjectIdHash: string
  conversationIdHash: string
  contextSecret: string
  provider: DnaS13KnowledgeV2ShadowProvider
  luna: BudgetedLunaRealizer
  catalogFingerprint: Readonly<{ version: string; hash: string }>
  retrievalFingerprint: Readonly<{ version: string; hash: string }>
}>) : Promise<Execution> {
  const started = performance.now()
  const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: input.fixture.question, mode: "theory" })
  let technical: DnaS13LimitedTechnicalEvidence | null = null
  let limitedKind = "runtime_error"; let answer = ""; let runtime: DnaS13StrictRuntimeResult | null = null
  let decision: DnaS13RealizationDecision | null = null; let retrievals: readonly Json[] = []
  let nextContext: ContextState = input.context; let error: string | null = null
  let planHash: string | null = null
  try {
    const limited = await runDnaS13LimitedRolloutMessage({
      requestId: randomUUID(), subjectId: input.subjectId, subjectIdHash: input.subjectIdHash,
      conversationIdHash: input.conversationIdHash, sessionId: input.conversationIdHash.slice(0, 40),
      question: input.fixture.question, responseDepth: input.fixture.responseDepth,
      contextToken: input.context.token, contextSecret: input.contextSecret, privacy,
      rolloutPhase: "L0", realizer: new DeterministicRealizer(),
      simplifyExperimentalEnabled: V1_RELEASE_SCOPE ? false : undefined,
      technicalObserver: (value) => { technical = value },
    })
    limitedKind = limited.kind
    if (limited.kind === "answered") {
      const observed = technical as DnaS13LimitedTechnicalEvidence | null
      if (!observed) throw new Error("preprod_technical_evidence_missing")
      const prepared = runDnaS13KnowledgeV2Shadow({ frame: observed.queryFrame,
        pragmaticTaskFrame: observed.pragmaticTaskFrame, provider: input.provider, publicPlan: observed.plan })
      retrievals = prepared.shadow.retrievals as readonly Json[]
      planHash = hashDnaS13Artifact(prepared.shadow.plan)
      decision = resolveDnaS13RealizationDecision({ frame: observed.queryFrame, plan: prepared.shadow.plan,
        action: observed.pragmaticTaskFrame.pragmaticAction,
        multiTurn: input.fixture.contextDependent || input.fixture.turnIndex > 1,
        routingConfidence: observed.topicResolutionConfidence })
      const realizer: Realizer = decision.useLuna ? input.luna : new DeterministicRealizer()
      if (decision.useLuna && !input.luna.canCall()) throw new Error(input.luna.stopReason ?? "provider_budget_unavailable")
      runtime = await runDnaS13StrictRuntime({ question: input.fixture.question,
        normalizedQuestion: observed.normalizedQuery, queryFrame: observed.queryFrame,
        plan: prepared.shadow.plan, realizer, catalog: input.catalogFingerprint,
        retrieval: input.retrievalFingerprint, privacy: observed.runtime.provenance.privacy,
        trainingCandidateRequested: false })
      answer = runtime.answer
      nextContext = Object.freeze({ token: limitedContextToken(limited.body) })
    } else if (limited.kind === "clarification") {
      answer = visibleAnswerText(limited.body)
      nextContext = input.context
    } else {
      answer = "Hedef kavramı güvenilir biçimde belirleyemedim; lütfen hangi başlığı kastettiğini biraz daha açık yazar mısın?"
      nextContext = input.context
    }
    if (!answer.trim()) throw new Error("preprod_empty_answer")
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }
  const observed = technical as DnaS13LimitedTechnicalEvidence | null
  const evaluation = evaluate({ fixture: input.fixture, technical: observed, runtime, retrievals,
    answer, limitedKind, error })
  const trace = Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:sealed-trace@1`, runId: RUN_ID, set: input.fixture.set,
    fixture: input.fixture, normalizedQuestion: observed?.normalizedQuery ?? normalizeDnaChatText(input.fixture.question),
    context: Object.freeze({ operation: observed?.contextOperation ?? null, method: observed?.contextResolutionMethod ?? null,
      confidence: observed?.topicResolutionConfidence ?? "LOW" }),
    routing: Object.freeze({ queryFrame: observed?.queryFrame ?? null, pragmaticTaskFrame: observed?.pragmaticTaskFrame ?? null,
      routingValidation: observed?.routingValidation ?? null }),
    upstreamExecutionCount: 1, preproductionLockedPlanHash: planHash,
    retrievals, realizationDecision: decision,
    realizer: runtime ? Object.freeze({ provider: runtime.provenance.realizer.provider, model: runtime.provenance.realizer.model,
      version: runtime.provenance.realizer.implementationVersion, status: runtime.status,
      calls: decision?.useLuna ? runtime.attempts.length : 0 }) : null,
    validator: runtime?.finalValidation ?? null, rejectedAttemptValidations: runtime?.rejectedAttemptValidations ?? [],
    usage: runtime?.provenance.usage ?? null, costMicrousd: runtime?.provenance.costMicrousd ?? 0,
    latencyMs: round(performance.now() - started, 3), objectiveEvaluation: evaluation,
    finalAnswer: answer, privacy: Object.freeze({ allowed: privacy.allowed, category: privacy.category,
      automaticTrainingAllowed: false }), displayEligible: false, productionEligible: false,
    releaseScope: V1_RELEASE_SCOPE ? Object.freeze({ simplifySupportedFeature: false,
      simplifyExperimentalEnabled: false, simplifyScored: false }) : null,
    error,
  })
  return Object.freeze({ fixture: input.fixture, answer, nextContext, technical: observed,
    decision, runtime, retrievals, evaluation, trace, error })
}

function summaryMetrics(rows: readonly Execution[]) {
  const category = (family: Family) => rows.filter((row) => row.fixture.family === family)
  const accuracy = (family: Family) => percent(category(family).filter((row) => row.evaluation.directAnswer).length, category(family).length)
  const context = rows.filter((row) => row.fixture.contextDependent)
  return Object.freeze({
    messages: rows.length,
    topicAccuracy: percent(rows.filter((row) => row.evaluation.topicCorrect).length, rows.length),
    actionAccuracy: percent(rows.filter((row) => row.evaluation.actionCorrect).length, rows.length),
    facetAccuracy: percent(rows.filter((row) => row.evaluation.facetCorrect).length, rows.length),
    directAnswerRate: percent(rows.filter((row) => row.evaluation.directAnswer).length, rows.length),
    contextAccuracy: percent(context.filter((row) => row.evaluation.contextCorrect).length, context.length),
    correctionAccuracy: accuracy("correction"), whyAccuracy: accuracy("why"), deepenAccuracy: accuracy("deepen"),
    exampleAccuracy: accuracy("example"), compareAccuracy: accuracy("compare"), simplifyAccuracy: accuracy("simplify"),
    wrongTopic: rows.filter((row) => !row.evaluation.topicCorrect).length,
    wrongAction: rows.filter((row) => !row.evaluation.actionCorrect).length,
    wrongFacet: rows.filter((row) => !row.evaluation.facetCorrect).length,
    catalogGap: rows.filter((row) => row.evaluation.catalogGap).length,
    catalogGapRate: percent(rows.filter((row) => row.evaluation.catalogGap).length, rows.length),
    catalogGapFalseAnswer: rows.filter((row) => row.evaluation.catalogGapFalseAnswer).length,
    availableButNotSelected: rows.filter((row) => row.evaluation.availableButNotSelected).length,
    unsupportedScience: rows.reduce((sum, row) => sum + row.evaluation.unsupportedScience, 0),
    unsupportedRelation: rows.reduce((sum, row) => sum + row.evaluation.unsupportedRelation, 0),
    sourceViolation: rows.reduce((sum, row) => sum + row.evaluation.sourceViolation, 0),
    safetyViolation: rows.reduce((sum, row) => sum + row.evaluation.safetyViolation, 0),
    certaintyDrift: rows.reduce((sum, row) => sum + row.evaluation.certaintyDrift, 0),
    runtimeError: rows.filter((row) => row.evaluation.runtimeError).length,
    criticalError: rows.filter((row) => row.evaluation.criticalError).length,
    validatorFailure: rows.filter((row) => !row.evaluation.validatorPass).length,
    lunaOn: rows.filter((row) => row.decision?.useLuna).length,
    lunaOff: rows.filter((row) => row.decision && !row.decision.useLuna).length,
    deterministicProviderCalls: 0,
  })
}

function blindPairs(rows: readonly Execution[]) {
  return `${rows.map((row) => `Kullanıcı:\n${row.fixture.question}\n\nAsistan:\n${row.answer}`).join("\n\n---\n\n")}\n`
}
function blindConversations(conversations: readonly Conversation[], byId: ReadonlyMap<string, Execution>) {
  return `${conversations.map((conversation, index) => [
    `Konuşma ${String(index + 1).padStart(2, "0")}`,
    ...conversation.turns.flatMap((turn) => {
      const row = byId.get(turn.id); return row ? [`Kullanıcı:\n${turn.question}\n\nAsistan:\n${row.answer}`] : []
    }),
  ].join("\n\n")).join("\n\n---\n\n")}\n`
}
function blindSimple(rows: readonly Readonly<{ adaptive: Execution; lunaAudit: DnaS13StrictRuntimeResult }>[]) {
  return `${rows.map((row, index) => `## ${index + 1}\n\nKullanıcı:\n${row.adaptive.fixture.question}\n\nYanıt A:\n${row.adaptive.answer}\n\nYanıt B:\n${row.lunaAudit.answer}`).join("\n\n---\n\n")}\n`
}
function validateBlind(value: string, userCount: number, assistantCount: number, allowAB = false) {
  if ((value.match(/^Kullanıcı:$/gmu) ?? []).length !== userCount) throw new Error("preprod_blind_user_count")
  if (!allowAB && (value.match(/^Asistan:$/gmu) ?? []).length !== assistantCount) throw new Error("preprod_blind_assistant_count")
  const forbidden = /(?:\btopicId\b|\bclaimId\b|\bvalidator\b|\bLuna\b|\brepair\b|\bfallback\b|locked plan|expectedAction|\bfacet\b|\bscore\b|\bcost\b|\blatency\b|\bPASS\b|\bFAIL\b)/iu
  if (forbidden.test(value)) throw new Error("preprod_blind_technical_metadata")
}

function core500(provider: DnaS13KnowledgeV2ShadowProvider, snapshot: DnaKnowledgeV2Snapshot) {
  const tier1 = new Set(jsonl(path.join(RUN3_DIR, "CORE_TOPIC_READINESS.jsonl")).map((row) => String(row.canonicalTopicId)))
  const tier2Scores = new Map<string, number>()
  for (const row of jsonl(path.join(RUN3_DIR, "run3-priority-gap-adjudication.jsonl"))) {
    if (row.priorityTier !== "TIER_2_RELEVANT") continue
    tier2Scores.set(String(row.canonicalTopic.id), Math.max(tier2Scores.get(String(row.canonicalTopic.id)) ?? 0,
      Number(row.evidenceNeed?.gapScore ?? 0)))
  }
  const tier2 = [...tier2Scores].sort((a, b) => b[1] - a[1]).slice(0, 100).map(([id]) => id)
  const topicIds = [...tier1, ...tier2].filter((id) => snapshot.canonicalTopics.some((topic) => topic.canonicalTopicId === id))
  const topicMap = new Map(snapshot.canonicalTopics.map((topic) => [topic.canonicalTopicId, topic]))
  const facets = Object.keys(FACET_TO_REQUESTED) as DnaKnowledgeV2Facet[]
  const rows = Array.from({ length: 500 }, (_, index) => {
    const canonicalTopicId = topicIds[index % topicIds.length]!
    const facet = facets[(index * 5 + Math.floor(index / topicIds.length)) % facets.length]!
    const retrieval = provider.retrieve(canonicalTopicId, facet)
    return Object.freeze({ id: `core500-${String(index + 1).padStart(3, "0")}`, canonicalTopicId,
      canonicalTitle: topicMap.get(canonicalTopicId)?.canonicalTitle ?? canonicalTopicId,
      tier: tier1.has(canonicalTopicId) ? "TIER_1_CORE" : "HIGH_PRIORITY_TIER_2",
      requestedFacet: facet, question: `${topicMap.get(canonicalTopicId)?.canonicalTitle} için ${FACET_TO_REQUESTED[facet]} bilgisini açıklar mısın?`,
      status: retrieval.status, selectedAtomIds: retrieval.selectedAtomIds,
      catalogGap: retrieval.status === "UNSUPPORTED", availableButNotSelected: retrieval.availableButNotSelected,
      providerCalls: 0, qualityScoredByCodex: false })
  })
  const supportedCount = rows.filter((row) => row.status !== "UNSUPPORTED").length
  return Object.freeze({ rows: Object.freeze(rows), summary: Object.freeze({ messages: 500,
    tier1Topics: tier1.size, highPriorityTier2Topics: tier2.length, supported: supportedCount,
    supportedRate: percent(supportedCount, rows.length), catalogGap: rows.length - supportedCount,
    catalogGapRate: percent(rows.length - supportedCount, rows.length), availableButNotSelected: 0,
    providerCalls: 0 }) })
}

async function main() {
  if (!LOCAL_PREFLIGHT && !existsSync(SSD_ROOT)) throw new Error("research_ssd_not_mounted")
  if (!existsSync(PREPROD_CATALOG)) throw new Error("preproduction_catalog_missing")
  const snapshot = loadSnapshot(); const provider = new DnaS13KnowledgeV2ShadowProvider(snapshot)
  const pool = pools(provider)
  const adaptiveQaFixtures = buildAdaptiveQa(pool)
  const freshFixtures = buildFresh200(pool)
  const multiConversations = buildMultiTurn40(pool)
  const adversarialFixtures = buildAdversarial30(pool)
  const allFixtures = [...adaptiveQaFixtures, ...freshFixtures, ...multiConversations.flatMap((row) => row.turns), ...adversarialFixtures]
  const fixtureValidation = validateFixtures(allFixtures)
  if (VALIDATE_FIXTURE_ONLY) { console.log(JSON.stringify({ fixtureValidation })); return }
  if (existsSync(OUTPUT_DIR)) throw new Error(`preproduction_output_already_exists:${OUTPUT_DIR}`)
  const apiKey = process.env.OPENAI_API_KEY?.trim() || ""
  if (!LOCAL_PREFLIGHT && !apiKey) throw new Error("openai_api_key_missing")
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 }); writePrivate(FILES.sealed, "")

  const subjectId = `final-preprod-${sha(RUN_ID).slice(0, 18)}`
  const secret = sha(`${RUN_ID}:telemetry`); const contextSecret = sha(`${RUN_ID}:context`)
  const subjectIdHash = hashDnaS13LimitedIdentifier({ secret, kind: "subject", value: subjectId })
  if (!subjectIdHash) throw new Error("preprod_subject_hash_failed")
  const luna = new BudgetedLunaRealizer(apiKey, `final-preprod:${sha(subjectId).slice(0, 24)}`, LOCAL_PREFLIGHT)
  const catalogFingerprint = Object.freeze({ version: "dna-chat-preproduction-knowledge@1", hash: sha(readFileSync(PREPROD_CATALOG)) })
  const retrievalFingerprint = Object.freeze({ version: "dna-s13-knowledge-v2-shadow@1", hash: sha(`${catalogFingerprint.hash}|retrieval`) })
  const results: Execution[] = []

  const executeConversation = async (conversation: Conversation, phase: "adaptive_qa" | "certification") => {
    luna.phase = phase
    const conversationIdHash = hashDnaS13LimitedIdentifier({ secret, kind: "conversation", value: `${subjectId}\u0000${conversation.id}` })
    if (!conversationIdHash) throw new Error("preprod_conversation_hash_failed")
    let context: ContextState = Object.freeze({ token: null })
    for (const turn of conversation.turns) {
      const row = await execute({ fixture: turn, context, subjectId, subjectIdHash,
        conversationIdHash, contextSecret, provider, luna, catalogFingerprint, retrievalFingerprint })
      results.push(row); appendPrivate(FILES.sealed, row.trace); context = row.nextContext
      if (row.error && !["adversarial_30", "adversarial_50"].includes(turn.set)) throw new Error(`preprod_execution_error:${turn.id}:${row.error}`)
    }
  }

  for (const row of adaptiveQaFixtures) await executeConversation(Object.freeze({ id: row.conversationId, turns: Object.freeze([row]) }), "adaptive_qa")
  const qaRows = results.filter((row) => row.fixture.set === "adaptive_qa")
  if (qaRows.length !== 40 || qaRows.some((row) => row.evaluation.runtimeError
    || row.evaluation.criticalError || row.evaluation.catalogGapFalseAnswer)) {
    throw new Error("adaptive_qa_not_40_behaviorally_valid")
  }
  const auditCandidates = qaRows.filter((row) => row.decision && !row.decision.useLuna).slice(0, 5)
  if (auditCandidates.length !== 5) throw new Error("adaptive_simple_audit_subset_short")
  const auditRows: { adaptive: Execution; lunaAudit: DnaS13StrictRuntimeResult }[] = []
  for (const row of auditCandidates) {
    luna.phase = "simple_audit"
    const prepared = runDnaS13KnowledgeV2Shadow({ frame: row.technical!.queryFrame,
      pragmaticTaskFrame: row.technical!.pragmaticTaskFrame, provider })
    const lunaAudit = await runDnaS13StrictRuntime({ question: row.fixture.question,
      normalizedQuestion: row.technical!.normalizedQuery, queryFrame: row.technical!.queryFrame,
      plan: prepared.shadow.plan, realizer: luna, catalog: catalogFingerprint, retrieval: retrievalFingerprint,
      privacy: row.runtime!.provenance.privacy, trainingCandidateRequested: false })
    auditRows.push({ adaptive: row, lunaAudit })
    appendPrivate(FILES.sealed, { schemaVersion: `${SCHEMA_VERSION}:simple-audit@1`, set: "adaptive_simple_audit",
      fixtureId: row.fixture.id, lockedPlanHash: hashDnaS13Artifact(prepared.shadow.plan),
      adaptiveAnswerHash: sha(row.answer), lunaAuditAnswerHash: sha(lunaAudit.answer),
      lunaAuditRuntime: lunaAudit, displayedToUser: false, qualityScoredByCodex: false })
  }
  const qaUsage = luna.phaseUsage("adaptive_qa")
  const qaAuditUsage = luna.phaseUsage("simple_audit")
  const qaBudgetUsage = luna.qaBudgetUsage()
  const qaMetrics = summaryMetrics(qaRows)
  const qaHardGate = qaMetrics.messages === 40 && qaMetrics.catalogGapFalseAnswer === 0 && qaMetrics.wrongTopic === 0
    && qaMetrics.wrongAction === 0 && qaMetrics.wrongFacet === 0 && qaMetrics.unsupportedScience === 0
    && qaMetrics.sourceViolation === 0 && qaMetrics.safetyViolation === 0 && qaMetrics.certaintyDrift === 0
    && qaMetrics.runtimeError === 0 && qaBudgetUsage.costMicrousd <= QA_CAP_MICROUSD
  if (!qaHardGate) throw new Error(`adaptive_qa_gate_failed:${JSON.stringify(qaMetrics)}`)

  for (const row of freshFixtures) await executeConversation(Object.freeze({ id: row.conversationId, turns: Object.freeze([row]) }), "certification")
  for (const conversation of multiConversations) await executeConversation(conversation, "certification")
  for (const row of adversarialFixtures) await executeConversation(Object.freeze({ id: row.conversationId, turns: Object.freeze([row]) }), "certification")

  const freshRows = results.filter((row) => row.fixture.set === "fresh_200")
  const multiRows = results.filter((row) => row.fixture.set === "multiturn_40")
  const adversarialSet: SetName = V1_RELEASE_SCOPE ? "adversarial_50" : "adversarial_30"
  const expectedAdversarialCount = V1_RELEASE_SCOPE ? 50 : 30
  const adversarialRows = results.filter((row) => row.fixture.set === adversarialSet)
  if (freshRows.length !== 200 || multiRows.length !== 120 || adversarialRows.length !== expectedAdversarialCount) throw new Error("preprod_result_shape_invalid")
  const freshMetrics = summaryMetrics(freshRows); const multiMetrics = summaryMetrics(multiRows)
  const adversarialMetrics = summaryMetrics(adversarialRows)
  const core = core500(provider, snapshot)

  const blind200 = blindPairs(freshRows); const byId = new Map(multiRows.map((row) => [row.fixture.id, row]))
  const blindFollowups = blindConversations(multiConversations, byId)
  const blindAdversarial = blindPairs(adversarialRows); const blindAudit = blindSimple(auditRows)
  validateBlind(blind200, 200, 200); validateBlind(blindFollowups, 120, 120)
  validateBlind(blindAdversarial, expectedAdversarialCount, expectedAdversarialCount); validateBlind(blindAudit, 5, 0, true)
  writePrivate(FILES.blind200, blind200); writePrivate(FILES.blindFollowups, blindFollowups)
  writePrivate(FILES.blindAdversarial, blindAdversarial); writePrivate(FILES.blindSimple, blindAudit)
  writePrivate(FILES.core500, core.rows.map((row) => JSON.stringify(row)).join("\n") + "\n")

  const totalUsage = luna.totalUsage(); const certUsage = luna.phaseUsage("certification")
  const finalAnswerCount = freshRows.length + multiRows.length + adversarialRows.length
  const costPerAnswerUsd = certUsage.costMicrousd / 1_000_000 / finalAnswerCount
  const certificationRows = [...freshRows, ...multiRows, ...adversarialRows]
  const certificationLunaOn = certificationRows.filter((row) => row.decision?.useLuna).length
  const costModel = Object.freeze({
    finalCertificationAnswers: finalAnswerCount,
    lunaOnPercent: percent(certificationLunaOn, finalAnswerCount),
    lunaOffPercent: percent(finalAnswerCount - certificationLunaOn, finalAnswerCount),
    callsPerAnswer: round(luna.phaseCalls("certification") / finalAnswerCount, 6),
    costPerAnswerUsd: round(costPerAnswerUsd, 8), costPer100AnswersUsd: round(costPerAnswerUsd * 100, 6),
    costPer1000AnswersUsd: round(costPerAnswerUsd * 1000, 6),
    thirtyDayProjectionUsd: Object.freeze({ answersPerDay50: round(costPerAnswerUsd * 50 * 30, 6),
      answersPerDay100: round(costPerAnswerUsd * 100 * 30, 6), answersPerDay250: round(costPerAnswerUsd * 250 * 30, 6) }),
    basis: Object.freeze({ measuredCertificationCostMicrousd: certUsage.costMicrousd,
      measuredCertificationAnswers: finalAnswerCount, measuredProviderCalls: luna.phaseCalls("certification"),
      noInventedPrice: true }),
  })
  const adaptiveOn = qaRows.filter((row) => row.decision?.useLuna).length
  const measuredLunaSamples = qaRows.filter((row) => row.decision?.useLuna).map((row) => row.runtime?.provenance.costMicrousd ?? 0)
    .concat(auditRows.map((row) => row.lunaAudit.provenance.costMicrousd)).filter((value) => value > 0)
  const meanMeasuredLunaCost = measuredLunaSamples.length
    ? measuredLunaSamples.reduce((sum, value) => sum + value, 0) / measuredLunaSamples.length : 0
  const projectedAlwaysLunaQaCost = meanMeasuredLunaCost * 40
  const adaptiveQa = Object.freeze({ metrics: qaMetrics, supported: 40,
    lunaOn: adaptiveOn, lunaOff: 40 - adaptiveOn, lunaOnPercent: percent(adaptiveOn, 40),
    lunaOffPercent: percent(40 - adaptiveOn, 40), providerCallReductionPercent: percent(40 - adaptiveOn, 40),
    estimatedCostReductionPercent: projectedAlwaysLunaQaCost
      ? round((1 - qaUsage.costMicrousd / projectedAlwaysLunaQaCost) * 100, 3) : 0,
    deterministicValidatorPass: qaRows.filter((row) => !row.decision?.useLuna && row.runtime?.finalValidation.pass).length,
    semanticFidelityFailures: qaRows.filter((row) => (row.runtime?.finalValidation.unsupportedAdditionCount ?? 0) > 0).length,
    validatorFailures: qaRows.filter((row) => !row.runtime?.finalValidation.pass).length,
    simpleAuditComparisons: auditRows.length, qualityScoredByCodex: false,
    usage: qaUsage, costUsd: round(qaUsage.costMicrousd / 1_000_000, 6),
    auditUsage: qaAuditUsage, auditCostUsd: round(qaAuditUsage.costMicrousd / 1_000_000, 6),
    qaBudgetCostUsd: round(qaBudgetUsage.costMicrousd / 1_000_000, 6), hardCapUsd: 0.1 })

  const routingGate = freshMetrics.topicAccuracy >= 95 && freshMetrics.actionAccuracy >= 95
    && freshMetrics.facetAccuracy >= 95 && freshMetrics.directAnswerRate >= 90 && multiMetrics.contextAccuracy >= 95
    && freshMetrics.correctionAccuracy >= 95 && freshMetrics.whyAccuracy >= 95 && freshMetrics.deepenAccuracy >= 90
    && freshMetrics.exampleAccuracy >= 90 && freshMetrics.compareAccuracy >= 90
    && (!V1_RELEASE_SCOPE || freshMetrics.wrongFacet === 0)
    && (!V1_RELEASE_SCOPE || freshMetrics.wrongTopic <= 4)
    && (V1_RELEASE_SCOPE || freshMetrics.simplifyAccuracy >= 95)
  const criticalGate = [...qaRows, ...freshRows, ...multiRows, ...adversarialRows].every((row) =>
    row.evaluation.unsupportedScience === 0 && row.evaluation.sourceViolation === 0
      && row.evaluation.safetyViolation === 0 && !row.evaluation.runtimeError)
    && totalUsage.costMicrousd <= TOTAL_CAP_MICROUSD
  const preliminaryGatesPass = qaHardGate && routingGate && criticalGate

  const summary = Object.freeze({ schemaVersion: `${SCHEMA_VERSION}:summary@1`, runId: RUN_ID,
    generatedAt: new Date().toISOString(), localPreflight: LOCAL_PREFLIGHT,
    versions: Object.freeze({ adaptiveLuna: DNA_S13_ADAPTIVE_REALIZATION_POLICY_VERSION,
      costEfficientMode: DNA_CHAT_COST_EFFICIENT_MODE_VERSION,
      deterministicRealizer: new DeterministicRealizer().identity.implementationVersion,
      lunaRealizer: luna.identity.implementationVersion, knowledge: catalogFingerprint.version }),
    fixtures: Object.freeze({ validation: fixtureValidation, adaptiveQa: 40, fresh: 200,
      freshRough: 80, multiTurnConversations: 40, multiTurnMessages: 120, adversarial: expectedAdversarialCount }),
    adaptiveQa, fresh200: freshMetrics,
    multiTurn40: Object.freeze({ conversations: 40, completeConversations: multiConversations.filter((conversation) =>
      conversation.turns.every((turn) => byId.get(turn.id)?.evaluation.directAnswer)).length, metrics: multiMetrics }),
    adversarial: Object.freeze({ inputs: expectedAdversarialCount, safelyHandled: adversarialRows.filter((row) => row.evaluation.directAnswer).length,
      metrics: adversarialMetrics }), core500: core.summary, costModel,
    provider: Object.freeze({ externalCalls: luna.externalCalls, inputTokens: totalUsage.inputTokens,
      cachedInputTokens: totalUsage.cachedInputTokens, outputTokens: totalUsage.outputTokens,
      totalCostUsd: round(totalUsage.costMicrousd / 1_000_000, 6), hardCapUsd: V1_RELEASE_SCOPE ? 0.2 : 0.35,
      stoppedByCap: Boolean(luna.stopReason), stopReason: luna.stopReason }),
    gates: Object.freeze({ adaptiveQa: qaHardGate, routing: routingGate, critical: criticalGate,
      preliminaryGatesPass, legacyRegressionPending: true, chatPreproductionReady: false }),
    controls: Object.freeze({ routingImplementationChanged: false, productionChanged: false,
      reportChanged: false, qualityScoredByCodex: false, displayEligible: false,
      candidateShadowOnly: true, deterministicProviderCalls: 0,
      simplifySupportedFeature: V1_RELEASE_SCOPE ? false : true,
      simplifyExperimentalEnabled: V1_RELEASE_SCOPE ? false : true,
      simplifyIncludedInReleaseScore: V1_RELEASE_SCOPE ? false : true }),
  })
  writePrivate(FILES.fixtures, { schemaVersion: `${SCHEMA_VERSION}:fixtures@1`, adaptiveQaFixtures,
    freshFixtures, multiConversations, adversarialFixtures, validation: fixtureValidation })
  writePrivate(FILES.summary, summary)
  writePrivate(FILES.readme, ["# DNA CHAT Final Pre-production Certification", "",
    "Blind dosyalar yalnız kullanıcı mesajı ve cevap içerir. Teknik routing, knowledge, realizer, validator, cost ve privacy kanıtı sealed JSONL dosyasındadır.",
    "Bu çalışma candidate-only shadow’dur; production ve Report değiştirilmemiştir. Codex kullanıcı-facing kalite puanı vermemiştir.",
  ].join("\n") + "\n")
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
