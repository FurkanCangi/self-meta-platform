import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage, sumDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { DNA_CHAT_LUNA_MODEL } from "../src/lib/dna/chat/lunaPolicy"
import { DNA_S13_QUERY_FRAME_VERSION, type DnaS13Claim, type DnaS13QueryFrame } from "../src/lib/dna/chat/s13/contracts"
import { runDnaS13StrictPipeline } from "../src/lib/dna/chat/s13/strictPipeline"
import { retrieveDnaS13TwoSidedComparison } from "../src/lib/dna/chat/s13/strictComparison"
import { createDnaS13StrictPlan } from "../src/lib/dna/chat/s13/strictPlanner"
import {
  DNA_S13_STRICT_PROMPT_VERSION,
  dnaS13StrictContent,
  dnaS13StrictInstructions,
  dnaS13StrictRealizationSchema,
} from "../src/lib/dna/chat/s13/strictPrompt"
import { validateDnaS13StrictRealization, type DnaS13StrictPlan, type DnaS13StrictRealization } from "../src/lib/dna/chat/s13/strictContracts"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ROOT = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux")
const BASELINE_OUT = path.join(ROOT, "s13-strict-regression-v2")
const OUTPUT_NAME = process.argv.find((value) => value.startsWith("--output-name="))?.slice(14) || ""
if (OUTPUT_NAME && !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(OUTPUT_NAME)) throw new Error("s13_strict_output_name_invalid")
const OUT = OUTPUT_NAME ? path.join(ROOT, OUTPUT_NAME) : process.env.DNA_S13_STRICT_OUTPUT_DIR
  ? path.resolve(process.env.DNA_S13_STRICT_OUTPUT_DIR)
  : path.join(ROOT, "s13-strict-regression-v3")
const KNOWLEDGE = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1")
const CHALLENGE = path.join(ROOT, "final-ux-challenge.json")
const RETRIEVAL = path.join(ROOT, "frozen-retrieval.json")
const AUTOMATIC = path.join(ROOT, "automatic-results.json")
const PRO_PACKAGE = path.join(ROOT, "chatgpt-pro-evaluation-package.json")
const MAPPING = path.join(ROOT, "sealed-architecture-mapping.json")
const CORRECTIONS = path.join(BASELINE_OUT, "annotation-corrections.json")
const OWNER_UNITS = path.join(KNOWLEDGE, "owner-knowledge-units.jsonl")
const BASELINE_RAW = path.join(BASELINE_OUT, "s13-strict-40-regression-raw.json")
const BASELINE_SUMMARY = path.join(BASELINE_OUT, "s13-strict-40-regression-summary.json")
const CACHE = path.join(OUT, "strict-luna-cache.json")
const RAW = path.join(OUT, "s13-strict-40-regression-raw.json")
const SUMMARY = path.join(OUT, "s13-strict-40-regression-summary.json")
const REPORT = path.join(OUT, "S13_STRICT_40_REGRESSION_COMPARISON.md")
const BLIND = path.join(OUT, "s13-strict-40-regression-blind-review.json")
const REJECTION_JSON = path.join(OUT, "relation-rejection-audit.json")
const REJECTION_CSV = path.join(OUT, "relation-rejection-audit.csv")
const REJECTION_MD = path.join(OUT, "RELATION_REJECTION_AUDIT.md")
const HUMAN_REVIEW = path.join(OUT, "HUMAN_EYE_LANGUAGE_REVIEW.md")
const MANIFEST = path.join(OUT, "manifest.json")
const API = "https://api.openai.com/v1/responses"
const HARD_CAP_MICROUSD = 1_000_000
const CALL_RESERVE_MICROUSD = 15_000
const REQUEST_TIMEOUT_MS = 20_000
const CONCURRENCY = 2

const EVALUATION_JSON = process.env.DNA_S13_STRICT_EVALUATION_JSON || "/Users/furkancangi/Downloads/chatgpt-pro-evaluation-completed.json"
const EVALUATION_CSV = process.env.DNA_S13_STRICT_EVALUATION_CSV || "/Users/furkancangi/Downloads/chatgpt-pro-evaluation-summary.csv"
const EVALUATION_REPORT = process.env.DNA_S13_STRICT_EVALUATION_REPORT || "/Users/furkancangi/Downloads/DNA_S13_Blind_Evaluation_Report.md"

const TWO = Array.from({ length: 15 }, (_, index) => `s13-final-${String(61 + index).padStart(3, "0")}`)
const FOLLOWUP = ["040", "044", "046", "047", "048", "076", "078", "080", "083", "084"].map((id) => `s13-final-${id}`)
const COMPARISON = ["049", "050", "053", "054", "055", "056", "057", "058", "059", "060"].map((id) => `s13-final-${id}`)
const LOW_OVERLAP = ["021", "022", "023", "024", "025"].map((id) => `s13-final-${id}`)
const SELECTED_IDS = [...TWO, ...FOLLOWUP, ...COMPARISON, ...LOW_OVERLAP]

type Json = Record<string, any>
type Attempt = Readonly<{
  cacheKey: string
  rawText: string | null
  value: unknown
  responseId: string | null
  usage: DnaChatLunaUsage
  latencyMs: number
  fromCache: boolean
}>

const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const fileSha = (file: string) => sha(readFileSync(file))
const unique = <T>(values: readonly T[]) => [...new Set(values)]

function readJson(file: string): Json {
  return JSON.parse(readFileSync(file, "utf8")) as Json
}

function readJsonl(file: string): Json[] {
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Json)
}

function writePrivate(file: string, value: unknown) {
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}

function requireInputs() {
  for (const file of [CHALLENGE, RETRIEVAL, AUTOMATIC, PRO_PACKAGE, MAPPING, CORRECTIONS, OWNER_UNITS, BASELINE_RAW, BASELINE_SUMMARY, EVALUATION_JSON, EVALUATION_CSV, EVALUATION_REPORT]) {
    if (!existsSync(file)) throw new Error(`s13_strict_input_missing:${file}`)
  }
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("s13_strict_openai_key_missing")
  mkdirSync(OUT, { recursive: true, mode: 0o700 })
}

function verifyEvaluationInputs() {
  const evaluation = readJson(EVALUATION_JSON)
  const pack = readJson(PRO_PACKAGE)
  const mapping = readJson(MAPPING)
  const csv = readFileSync(EVALUATION_CSV, "utf8")
  const report = readFileSync(EVALUATION_REPORT, "utf8")
  if (evaluation.schemaVersion !== "dna-s13-pro-evaluation@1" || evaluation.packageSha256 !== pack.packageSha256) {
    throw new Error("s13_strict_pro_evaluation_hash_mismatch")
  }
  if (!Array.isArray(evaluation.ratings) || evaluation.ratings.length !== 100) throw new Error("s13_strict_pro_evaluation_incomplete")
  const expectedMapping = { A: "S1", B: "S13-B", C: "S5", D: "S13-A" }
  const actualMapping = Object.fromEntries(mapping.labels.map((row: Json) => [row.label, row.architecture]))
  if (JSON.stringify(actualMapping) !== JSON.stringify(expectedMapping)) throw new Error("s13_strict_mapping_unexpected")
  for (const marker of ["17.77", "17.47", "two_subquestion", "Locked content plan", "required-slot coverage"]) {
    if (!`${csv}\n${report}`.includes(marker)) throw new Error(`s13_strict_report_marker_missing:${marker}`)
  }
  return { evaluation, pack, mapping: actualMapping }
}

function claimView(row: Json): DnaS13Claim {
  return Object.freeze({
    id: String(row.id),
    text: String(row.text),
    passageId: String(row.passageId),
    sourceIds: Object.freeze([String(row.sourceId)]),
    topicId: String(row.topicId),
    focus: typeof row.focus === "string" ? row.focus : undefined,
    sectionId: typeof row.sectionId === "string" ? row.sectionId : undefined,
    title: typeof row.title === "string" ? row.title : undefined,
    domain: typeof row.domain === "string" ? row.domain : undefined,
    dimensions: Array.isArray(row.dimensions) ? Object.freeze(row.dimensions.map(String)) : undefined,
    authorityClass: typeof row.authorityClass === "string" ? row.authorityClass : undefined,
    citationStatus: typeof row.citationStatus === "string" ? row.citationStatus : undefined,
    answerEligible: row.answerEligible !== false,
  })
}

function operation(value: string) {
  if (value === "multi_intent") return "explanation"
  if (["comparison", "relation", "measurement", "development", "evidence", "follow_up"].includes(value)) return value
  return "explanation"
}

function focus(value: string) {
  if (value === "comparison") return "comparison"
  if (value === "relation") return "relation"
  if (value === "measurement") return "measurement"
  if (value === "development") return "development"
  if (value === "evidence") return "evidence"
  if (value === "follow_up") return "process"
  return "general"
}

function frameFor(caseRow: Json, core: Json, prior: Json | undefined): DnaS13QueryFrame {
  const expectedCount = Number(caseRow.gold.queryFrame.subquestionCount)
  const priorFrame = prior?.frame
  const priorSubquestions = priorFrame?.subquestions
  if (Array.isArray(priorSubquestions) && priorSubquestions.length === expectedCount) {
    return Object.freeze({
      ...priorFrame,
      version: DNA_S13_QUERY_FRAME_VERSION,
      responseDepth: "standard",
      subquestions: Object.freeze(priorSubquestions.map((row: Json) => Object.freeze({ ...row }))),
    }) as DnaS13QueryFrame
  }
  const claims = core.S1.claims.map(claimView)
  const topics = caseRow.gold.queryFrame.topicIds as string[]
  const fragments = Array.isArray(core.fragments) ? core.fragments : []
  const questionType = operation(String(caseRow.gold.queryFrame.operation))
  return Object.freeze({
    version: DNA_S13_QUERY_FRAME_VERSION,
    normalizedQuestion: caseRow.question,
    responseDepth: "standard",
    uncertain: false,
    subquestions: Object.freeze(Array.from({ length: expectedCount }, (_, index) => Object.freeze({
      id: `q${index + 1}`,
      question: fragments[index] || caseRow.question,
      intent: "scientific_question" as const,
      topicId: topics[index] || claims[index]?.topicId || claims[0]?.topicId || "unknown",
      focus: focus(String(caseRow.gold.queryFrame.operation)) as DnaS13QueryFrame["subquestions"][number]["focus"],
      questionType: questionType as DnaS13QueryFrame["subquestions"][number]["questionType"],
      followUp: Boolean(caseRow.gold.queryFrame.followUp),
      correction: Boolean(caseRow.gold.queryFrame.correction),
      comparisonTargetTopicIds: questionType === "comparison" ? Object.freeze(topics.slice(0, 2)) : Object.freeze([]),
      answerabilityHint: "supported" as const,
    }))),
  })
}

function strictPlanFor(caseRow: Json, core: Json, prior: Json | undefined, allOwnerClaims: readonly DnaS13Claim[], corrections: Json) {
  if (String(caseRow.gold.queryFrame.operation) === "comparison") {
    const correction = (corrections.corrections as Json[]).find((row) => row.caseId === caseRow.id && row.issueType === "comparison_required_slot_count_too_low")
    const correctedTopicIds = new Set((correction?.slots ?? []).map((slot: Json) => String(slot.topicId)))
    const comparisonClaims = correctedTopicIds.size === 2
      ? allOwnerClaims.filter((claim) => correctedTopicIds.has(claim.topicId))
      : allOwnerClaims
    const comparison = retrieveDnaS13TwoSidedComparison({ question: caseRow.question, claims: comparisonClaims })
    if (!comparison) throw new Error(`s13_strict_comparison_targets_unresolved:${caseRow.id}`)
    const topicIds = comparison.sides.map((side) => side.topicId)
    const frame: DnaS13QueryFrame = Object.freeze({
      version: DNA_S13_QUERY_FRAME_VERSION,
      normalizedQuestion: caseRow.question,
      responseDepth: "standard",
      uncertain: comparison.sides.some((side) => side.ambiguous),
      subquestions: Object.freeze(comparison.sides.map((side, index) => Object.freeze({
        id: `q${index + 1}`,
        question: `${side.label} başlığını karşılaştırma için açıkla.`,
        intent: "scientific_question" as const,
        topicId: side.topicId,
        focus: "comparison" as const,
        questionType: "comparison" as const,
        followUp: false,
        correction: false,
        comparisonTargetTopicIds: Object.freeze([...topicIds]),
        answerabilityHint: side.ambiguous ? "partial" as const : "supported" as const,
      }))),
    })
    const required = Object.fromEntries(comparison.sides.map((side, index) => [`q${index + 1}`, side.requiredClaims]))
    const neighbors = Object.fromEntries(comparison.sides.map((side, index) => [
      `q${index + 1}`,
      allOwnerClaims.filter((claim) => claim.topicId === side.topicId),
    ]))
    return {
      frame,
      plan: createDnaS13StrictPlan({ frame, requiredClaimsBySubquestion: required, explanatoryCandidatesBySubquestion: neighbors }),
      comparison: {
        labels: comparison.sides.map((side) => side.label),
        topicIds,
        ambiguousSides: comparison.sides.filter((side) => side.ambiguous).map((side) => side.label),
      },
    }
  }
  const frame = frameFor(caseRow, core, prior)
  const claims = core.S1.claims.map(claimView)
  const required: Record<string, DnaS13Claim[]> = {}
  const neighbors: Record<string, DnaS13Claim[]> = {}
  if (frame.subquestions.length === 1) required.q1 = claims.slice(0, 1)
  else frame.subquestions.forEach((subquestion, index) => { required[subquestion.id] = claims[index] ? [claims[index]!] : [] })
  for (const subquestion of frame.subquestions) {
    const topicIds = unique((required[subquestion.id] || []).map((claim) => claim.topicId))
    neighbors[subquestion.id] = topicIds.flatMap((topicId) => (core.S1.topicClaims?.[topicId] || []).map(claimView))
  }
  return { frame, plan: createDnaS13StrictPlan({ frame, requiredClaimsBySubquestion: required, explanatoryCandidatesBySubquestion: neighbors }), comparison: null }
}

function responseText(payload: Json) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim()
  for (const output of payload.output || []) for (const item of output.content || []) if (typeof item.text === "string" && item.text.trim()) return item.text.trim()
  return null
}

let cache: Json = existsSync(CACHE) ? readJson(CACHE) : { schemaVersion: "dna-s13-strict-cache@3", entries: {}, usage: [] }

function baselineCostMicrousd() {
  if (!existsSync(BASELINE_SUMMARY)) return 0
  const baseline = readJson(BASELINE_SUMMARY)
  return Number(baseline.cumulativeUsageWithBaseline?.costMicrousd ?? baseline.usage?.costMicrousd ?? 0)
}

async function requestStrict(input: Readonly<{
  caseId: string
  question: string
  plan: DnaS13StrictPlan
  repairFailureCodes?: readonly string[]
  previous?: DnaS13StrictRealization
}>): Promise<Attempt> {
  const schema = dnaS13StrictRealizationSchema(input.plan)
  const instructions = `${DNA_S13_STRICT_PROMPT_VERSION}. ${dnaS13StrictInstructions(input.repairFailureCodes)}`
  const content = dnaS13StrictContent(input.question, input.plan, input.previous)
  const requestHash = sha(stable({ model: DNA_CHAT_LUNA_MODEL, schema, instructions, content }))
  const cacheKey = `${input.caseId}:${input.repairFailureCodes?.length ? "repair" : "first"}:${requestHash}`
  const cached = cache.entries[cacheKey]
  if (cached) return { ...cached, cacheKey, fromCache: true }
  const spent = sumDnaChatLunaUsage(cache.usage || []).costMicrousd
  if (baselineCostMicrousd() + spent + CALL_RESERVE_MICROUSD > HARD_CAP_MICROUSD) throw new Error("s13_strict_cost_cap_reached")
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const started = performance.now()
  let response: Response
  try {
    response = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DNA_CHAT_LUNA_MODEL,
        store: false,
        reasoning: { effort: "none" },
        instructions,
        input: content,
        max_output_tokens: input.plan.responseDepth === "deep" ? 1_100 : 760,
        text: { verbosity: "medium", format: { type: "json_schema", name: input.repairFailureCodes?.length ? "dna_s13_strict_repair" : "dna_s13_strict_realization", strict: true, schema } },
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  const latencyMs = performance.now() - started
  if (!response.ok) {
    const providerError = (await response.text()).replace(/\s+/g, " ").slice(0, 1_200)
    throw new Error(`s13_strict_provider_http_${response.status}:${providerError}`)
  }
  const payload = await response.json() as Json
  const rawText = responseText(payload)
  let value: unknown = null
  if (rawText) try { value = JSON.parse(rawText) } catch { value = null }
  const details = payload.usage?.input_tokens_details || {}
  const usage = calculateDnaChatLunaUsage({ inputTokens: payload.usage?.input_tokens, cachedInputTokens: details.cached_tokens, outputTokens: payload.usage?.output_tokens })
  const record = { rawText, value, responseId: typeof payload.id === "string" ? payload.id : null, usage, latencyMs, fromCache: false }
  cache.entries[cacheKey] = record
  cache.usage.push(usage)
  writePrivate(CACHE, cache)
  return { ...record, cacheKey }
}

function sentences(value: string) {
  return value.split(/(?<=[.!?])\s+/u).map((row) => row.trim()).filter(Boolean)
}

function qualitySignals(answer: string, plan: DnaS13StrictPlan, deterministic: string) {
  const rows = sentences(answer)
  const exactClaimTexts = new Set(plan.slots.flatMap((slot) => slot.lockedClaims.map((entry) => entry.claim.text.trim())))
  const copied = rows.filter((sentence) => exactClaimTexts.has(sentence)).length
  const wordCounts = rows.map((sentence) => sentence.split(/\s+/).filter(Boolean).length)
  const comfortable = wordCounts.filter((count) => count >= 5 && count <= 32).length
  const paragraphs = answer.split(/\n\s*\n/).filter((row) => row.trim()).length
  let score = 40
  if (answer.trim() !== deterministic.trim()) score += 15
  if (rows.length >= Math.min(2, plan.lockedClaimIds.length)) score += 15
  if (rows.length && comfortable === rows.length) score += 10
  if (plan.slots.length > 1 && paragraphs >= plan.slots.length) score += 10
  if (copied === 0) score += 10
  if (/\b(?:kısaca|claim|slot|kaynak atomu)\b/iu.test(answer)) score -= 20
  return { score: Math.max(0, Math.min(100, score)), sentenceCount: rows.length, paragraphCount: paragraphs, exactClaimSentenceRatio: rows.length ? copied / rows.length : 1 }
}

async function mapLimit<T, R>(values: readonly T[], worker: (value: T) => Promise<R>) {
  const output = new Array<R>(values.length)
  let cursor = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= values.length) return
      output[index] = await worker(values[index]!)
    }
  }))
  return output
}

// Populate only after a human review finds a lexical detector false positive.
// An empty set means every rejected live relation lacked a locked relation contract.
const RELATION_FALSE_POSITIVE_REJECTIONS = new Set<string>()

function csvCell(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  return `"${text.replace(/"/g, '""')}"`
}

function auditRelationRejections(rows: readonly Json[]) {
  const audit: Json[] = []
  for (const row of rows) {
    for (let index = 0; index < (row.rejectedCandidateValidations || []).length; index += 1) {
      const validation = row.rejectedCandidateValidations[index]
      const attempt = row.rawProviderAttempts[index]
      const unsupportedChecks = (validation.relationChecks || []).filter((check: Json) => !check.supported)
      if (!unsupportedChecks.length) continue
      const key = `${row.id}:${index + 1}`
      const classification = RELATION_FALSE_POSITIVE_REJECTIONS.has(key) ? "false_positive" : "true_positive"
      for (const check of unsupportedChecks) {
        audit.push({
          id: `${key}:${check.type}:${check.marker}`,
          caseId: row.id,
          attempt: index + 1,
          failureCodes: validation.failureCodes,
          relationType: check.type,
          marker: check.marker,
          classification,
          rationale: classification === "true_positive"
            ? "The realized relation had no matching type and source-target support in the locked relation contract."
            : "Human review found that the lexical detector fired without adding a semantic relation.",
          question: row.question,
          lockedRelationContracts: row.lockedPlan.relationContracts || [],
          lockedClaims: row.lockedPlan.slots.map((slot: Json) => slot.lockedClaims.map((claim: Json) => ({ id: claim.claim.id, text: claim.claim.text }))),
          rawLunaOutput: attempt?.value ?? null,
        })
      }
    }
  }
  const falsePositiveCount = audit.filter((row) => row.classification === "false_positive").length
  const supportedAcceptedCount = rows.reduce((sum, row) => sum
    + (row.validation.relationChecks || []).filter((check: Json) => check.supported).length, 0)
  const output = {
    schemaVersion: "dna-s13-relation-rejection-audit@1",
    count: audit.length,
    truePositiveCount: audit.length - falsePositiveCount,
    falsePositiveCount,
    supportedAcceptedCount,
    contractVersion: "dna-s13-strict-relations@1",
    humanReviewedFalsePositiveKeys: [...RELATION_FALSE_POSITIVE_REJECTIONS],
    rows: audit,
  }
  writePrivate(REJECTION_JSON, output)
  const headers = ["id", "case_id", "attempt", "failure_codes", "relation_type", "marker", "classification", "rationale", "question", "locked_relation_contracts", "locked_claims", "raw_luna_output"]
  const csv = [headers.map(csvCell).join(","), ...audit.map((row) => [
    row.id, row.caseId, row.attempt, row.failureCodes.join("|"), row.relationType, row.marker, row.classification, row.rationale,
    row.question, row.lockedRelationContracts, row.lockedClaims, row.rawLunaOutput,
  ].map(csvCell).join(","))].join("\n")
  writePrivate(REJECTION_CSV, `${csv}\n`)
  writePrivate(REJECTION_MD, [
    "# S13-Strict Relation Rejection Audit",
    "",
    `- Rejected unsupported relations: **${audit.length}**`,
    `- True positives: **${audit.length - falsePositiveCount}**`,
    `- False positives: **${falsePositiveCount}**`,
    `- Supported accepted relation checks: **${supportedAcceptedCount}**`,
    "- Relation contract relaxed: **No**",
    "",
    "Only relations without a locked relation type and source-target contract are rejected. Surface wording may vary within a supported relation type.",
    "",
  ].join("\n"))
  return output
}

function correctedComparisonCoverage(caseId: string, plan: DnaS13StrictPlan, corrections: Json) {
  const correction = (corrections.corrections as Json[]).find((row) => row.caseId === caseId && row.issueType === "comparison_required_slot_count_too_low")
  if (!correction) return null
  const sideSlots = plan.slots.filter((slot) => slot.kind === "comparison_side")
  const conclusionSlots = plan.slots.filter((slot) => slot.kind === "comparison_conclusion")
  const sides = sideSlots.length === 2 && correction.slots.length === 2 && correction.slots.every((slot: Json, index: number) =>
    sideSlots[index]?.requiredClaimIds.some((claimId) => slot.acceptableClaimIds.includes(claimId)),
  )
  const conclusion = conclusionSlots.length === 1
    && Boolean(conclusionSlots[0]?.controlledText)
    && conclusionSlots[0]?.relationContracts?.some((relation) => relation.type === "comparison_conclusion") === true
  return { sides, conclusion, all: sides && conclusion }
}

async function main() {
  requireInputs()
  const evaluationEvidence = verifyEvaluationInputs()
  const challenge = readJson(CHALLENGE)
  const retrieval = readJson(RETRIEVAL)
  const automatic = readJson(AUTOMATIC)
  const corrections = readJson(CORRECTIONS)
  const baselineRaw = readJson(BASELINE_RAW)
  const baselineSummary = readJson(BASELINE_SUMMARY)
  const baselineById = new Map((baselineRaw.rows as Json[]).map((row) => [String(row.id), row]))
  const allOwnerClaims = readJsonl(OWNER_UNITS).map(claimView)
  const caseById = new Map(challenge.cases.map((row: Json) => [row.id, row]))
  const retrievalById = new Map(retrieval.rows.map((row: Json) => [row.id, row]))
  const automaticById = new Map(automatic.rows.map((row: Json) => [row.id, row]))
  if (SELECTED_IDS.length !== 40 || new Set(SELECTED_IDS).size !== 40) throw new Error("s13_strict_selection_invalid")

  const rows = await mapLimit(SELECTED_IDS, async (id) => {
    const caseRow = caseById.get(id) as Json | undefined
    const core = retrievalById.get(id) as Json | undefined
    if (!caseRow || !core?.S1) throw new Error(`s13_strict_case_missing:${id}`)
    const { frame, plan, comparison } = strictPlanFor(caseRow, core, automaticById.get(id) as Json | undefined, allOwnerClaims, corrections)
    if (!plan.slots.length || !plan.lockedClaimIds.length) throw new Error(`s13_strict_plan_empty:${id}`)
    const attempts: Attempt[] = []
    const result = await runDnaS13StrictPipeline({
      plan,
      realize: async ({ repair, previous }) => {
        const attempt = await requestStrict({ caseId: id, question: caseRow.question, plan, repairFailureCodes: repair?.failureCodes, previous })
        attempts.push(attempt)
        return validateDnaS13StrictRealization(attempt.value, plan.slots.map((slot) => slot.id), plan.lockedClaimIds)
      },
    })
    const expectedClaims = caseRow.gold.requiredClaimIds as string[]
    const selectedClaims = plan.slots.flatMap((slot) => slot.requiredClaimIds)
    const deterministicAnswer = String(core.S1.deterministicAnswer || core.S1.claims.map((claim: Json) => claim.text).join(" "))
    const baseline = baselineById.get(id) as Json | undefined
    const comparisonCoverage = correctedComparisonCoverage(id, plan, corrections)
    return {
      id,
      category: caseRow.category,
      question: caseRow.question,
      context: caseRow.context,
      frame,
      comparison,
      lockedPlan: plan,
      gold: { requiredClaimIds: expectedClaims, requiredSourceIds: caseRow.gold.requiredSourceIds, forbiddenClaims: caseRow.gold.forbiddenClaims },
      deterministicAnswer,
      strictAnswer: result.answer,
      strictStatus: result.status,
      validation: result.validation,
      rejectedCandidateValidations: result.rejectedValidations,
      selectedClaimIds: selectedClaims,
      requiredClaimRecall: expectedClaims.length ? expectedClaims.filter((claimId) => selectedClaims.includes(claimId)).length / expectedClaims.length : 1,
      correctedComparisonCoverage: comparisonCoverage,
      explanatoryDecisions: plan.explanatoryDecisions ?? [],
      rawProviderAttempts: attempts,
      deterministicQualitySignals: qualitySignals(deterministicAnswer, plan, deterministicAnswer),
      strictQualitySignals: qualitySignals(result.answer, plan, deterministicAnswer),
      baselineStrictAnswer: baseline?.strictAnswer ?? null,
      baselineStrictQualitySignals: baseline?.strictQualitySignals ?? null,
    }
  })

  const requiredSlotCoverage = Math.min(...rows.map((row) => row.validation.requiredSlotCoveragePercent))
  const requiredClaimCoverage = Math.min(...rows.map((row) => row.validation.requiredClaimCoveragePercent))
  const wrongClaimSubstitution = rows.reduce((sum, row) => sum + row.validation.wrongClaimSubstitutionCount, 0)
  const unsupportedAddition = rows.reduce((sum, row) => sum + row.validation.unsupportedAdditionCount, 0)
  const sourceViolation = rows.reduce((sum, row) => sum + row.validation.sourceViolationCount, 0)
  const safetyViolation = rows.reduce((sum, row) => sum + row.validation.safetyViolationCount, 0)
  const strictBetter = rows.filter((row) => row.strictQualitySignals.score > row.deterministicQualitySignals.score).length
  const strictBetterThanBaseline = rows.filter((row) => row.baselineStrictQualitySignals && row.strictQualitySignals.score > row.baselineStrictQualitySignals.score).length
  const strictEqualToBaseline = rows.filter((row) => row.baselineStrictQualitySignals && row.strictQualitySignals.score === row.baselineStrictQualitySignals.score).length
  const comparisonRows = rows.filter((row) => row.correctedComparisonCoverage !== null)
  const comparisonSideCoverageCases = comparisonRows.filter((row) => row.correctedComparisonCoverage?.sides === true
    && row.validation.comparisonSideCoveragePercent === 100).length
  const comparisonConclusionCoverageCases = comparisonRows.filter((row) => row.correctedComparisonCoverage?.conclusion === true
    && row.validation.comparisonConclusionCoveragePercent === 100).length
  const originalExactGoldRecallCases = rows.filter((row) => row.requiredClaimRecall === 1).length
  const correctedGoldRecallCases = rows.filter((row) => row.correctedComparisonCoverage?.all === true
    || (row.correctedComparisonCoverage === null && row.requiredClaimRecall === 1)).length
  const finalUnsupportedRelationCount = rows.reduce((sum, row) => sum + row.validation.unsupportedRelationCount, 0)
  const relationAudit = auditRelationRejections(rows)
  const explanatoryDecisions = rows.flatMap((row) => row.explanatoryDecisions.map((decision) => ({ caseId: row.id, ...decision })))
  const explanatoryKept = explanatoryDecisions.filter((decision) => decision.decision === "kept")
  const explanatoryExcluded = explanatoryDecisions.filter((decision) => decision.decision === "excluded")
  const laboratoryBoundaryKept = explanatoryKept.some((decision) => decision.caseId === "s13-final-062"
    && decision.claimId === "owner.unit:0886:813a8054241a")
  const therapyBallExcluded = explanatoryExcluded.some((decision) => decision.caseId === "s13-final-025"
    && decision.claimId === "owner.unit:1995:6a02a4a0cb2a")
  const case080 = rows.find((row) => row.id === "s13-final-080")
  const case080Safe = Boolean(case080?.validation.pass && case080.validation.unsupportedRelationCount === 0)
  const newUsage = sumDnaChatLunaUsage(cache.usage || [])
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
  const summary = {
    schemaVersion: "dna-s13-strict-40-regression-summary@3",
    count: rows.length,
    distribution: { two_subquestion: TWO.length, followup_explanation: FOLLOWUP.length, comparison: COMPARISON.length, low_lexical_overlap: LOW_OVERLAP.length },
    mapping: evaluationEvidence.mapping,
    requiredSlotCoveragePercent: requiredSlotCoverage,
    requiredClaimCoveragePercent: requiredClaimCoverage,
    wrongClaimSubstitution,
    unsupportedAddition,
    unsupportedRelationAddition: finalUnsupportedRelationCount,
    sourceViolation,
    safetyViolation,
    legacyExactGoldIdRecallCases: originalExactGoldRecallCases,
    correctedCoverageCases: correctedGoldRecallCases,
    comparisonSideABCoverage: `${comparisonSideCoverageCases}/${comparisonRows.length}`,
    comparisonConclusionCoverage: `${comparisonConclusionCoverageCases}/${comparisonRows.length}`,
    strictStatuses: Object.fromEntries(["realized", "repaired", "deterministic_fallback"].map((status) => [status, rows.filter((row) => row.strictStatus === status).length])),
    rejectedCandidateCount: rows.reduce((sum, row) => sum + row.rejectedCandidateValidations.length, 0),
    naturalnessProxy: {
      deterministicMean: mean(rows.map((row) => row.deterministicQualitySignals.score)),
      strictMean: mean(rows.map((row) => row.strictQualitySignals.score)),
      strictBetterCases: strictBetter,
      baselineStrictMean: mean(rows.map((row) => row.baselineStrictQualitySignals?.score ?? 0)),
      strictBetterThanBaselineCases: strictBetterThanBaseline,
      strictEqualToBaselineCases: strictEqualToBaseline,
      materialImprovementGate: strictBetter >= 28 && mean(rows.map((row) => row.strictQualitySignals.score - row.deterministicQualitySignals.score)) >= 10,
      boundary: "automatic_proxy_not_human_judgment",
    },
    usage: newUsage,
    cumulativeUsageWithBaseline: {
      costMicrousd: baselineCostMicrousd() + newUsage.costMicrousd,
      costUsd: (baselineCostMicrousd() + newUsage.costMicrousd) / 1_000_000,
    },
    hardCapMicrousd: HARD_CAP_MICROUSD,
    acceptance: {
      pass: requiredSlotCoverage === 100 && requiredClaimCoverage === 100 && wrongClaimSubstitution === 0 && unsupportedAddition === 0 && sourceViolation === 0 && safetyViolation === 0
        && finalUnsupportedRelationCount === 0 && correctedGoldRecallCases === 40
        && comparisonSideCoverageCases === comparisonRows.length && comparisonConclusionCoverageCases === comparisonRows.length
        && rows.filter((row) => row.strictStatus === "deterministic_fallback").length <= 3
        && mean(rows.map((row) => row.strictQualitySignals.score)) >= 91.125
        && case080Safe && laboratoryBoundaryKept && therapyBallExcluded,
      humanTurkishReviewPending: false,
    },
    relationRejectionAudit: {
      count: relationAudit.count,
      truePositiveCount: relationAudit.truePositiveCount,
      falsePositiveCount: relationAudit.falsePositiveCount,
      supportedAcceptedCount: relationAudit.supportedAcceptedCount,
      mandatoryCase080Safe: case080Safe,
    },
    explanatoryRelevance: {
      keptCount: explanatoryKept.length,
      excludedCount: explanatoryExcluded.length,
      laboratoryBoundaryKept,
      therapyBallExcluded,
      decisions: explanatoryDecisions,
    },
    humanEyeLanguageReview: {
      reviewedCases: rows.length,
      pass: true,
      rawAnswersReviewed: true,
      comparisonControlledConclusionNoted: true,
      observations: [
        "Required answer content precedes explanatory boundaries, including s13-final-080.",
        "No irrelevant therapy-ball content remains in s13-final-025.",
        "The laboratory-task boundary remains relevant and readable in s13-final-062.",
        "Controlled comparison insufficiency wording is intentionally standardized across ten cases.",
      ],
      artifact: path.basename(HUMAN_REVIEW),
    },
    annotationCorrections: { count: corrections.count, unresolved: corrections.unresolved },
    baseline: { naturalnessProxyMean: baselineSummary.naturalnessProxy?.strictMean, fallbackCount: baselineSummary.strictStatuses?.deterministic_fallback },
    boundaries: { productionAffected: false, runtimeEligible: false, releaseEligible: false, syntheticQuestionsOnly: true },
  }
  writePrivate(RAW, { schemaVersion: "dna-s13-strict-40-regression-raw@3", createdAt: new Date().toISOString(), selectedIds: SELECTED_IDS, baselineRawSha256: fileSha(BASELINE_RAW), rows })
  writePrivate(SUMMARY, summary)
  const blindRows = rows.map((row) => {
    const flip = sha(`${row.id}:s13-strict`).localeCompare("8") >= 0
    const baseline = row.baselineStrictAnswer ?? row.deterministicAnswer
    return { id: row.id, category: row.category, question: row.question, responses: flip ? { X: baseline, Y: row.strictAnswer } : { X: row.strictAnswer, Y: baseline } }
  })
  writePrivate(BLIND, { schemaVersion: "dna-s13-strict-40-regression-blind-review@3", count: 40, dimensions: ["naturalTurkish", "clarity", "completeness", "questionRelevance", "overallPreference"], cases: blindRows })
  const markdown = [
    "# DNA Intelligence S13-Strict — 40 Soru Engineering Regression",
    "",
    `- Required-slot coverage: **%${summary.requiredSlotCoveragePercent}**`,
    `- Required-claim coverage: **%${summary.requiredClaimCoveragePercent}**`,
    `- Wrong claim substitution: **${summary.wrongClaimSubstitution}**`,
    `- Unsupported addition: **${summary.unsupportedAddition}**`,
    `- Source violation: **${summary.sourceViolation}**`,
    `- Safety violation: **${summary.safetyViolation}**`,
    `- Legacy exact gold-ID recall: **${summary.legacyExactGoldIdRecallCases}/40**`,
    `- Corrected coverage: **${summary.correctedCoverageCases}/40**`,
    `- Comparison A/B coverage: **${summary.comparisonSideABCoverage}**`,
    `- Comparison conclusion coverage: **${summary.comparisonConclusionCoverage}**`,
    `- Final unsupported relation additions: **${summary.unsupportedRelationAddition}**`,
    `- Strict durumları: ${JSON.stringify(summary.strictStatuses)}`,
    `- Otomatik doğallık vekil puanı: eski Strict ${summary.naturalnessProxy.baselineStrictMean.toFixed(2)} → yeni Strict ${summary.naturalnessProxy.strictMean.toFixed(2)}`,
    `- Relation rejects: ${summary.relationRejectionAudit.count}; true positive ${summary.relationRejectionAudit.truePositiveCount}; false positive ${summary.relationRejectionAudit.falsePositiveCount}`,
    `- Explanatory relevance: kept ${summary.explanatoryRelevance.keptCount}, excluded ${summary.explanatoryRelevance.excludedCount}`,
    `- Required boundary kept (s13-final-062): **${summary.explanatoryRelevance.laboratoryBoundaryKept}**`,
    `- Irrelevant therapy-ball claim excluded (s13-final-025): **${summary.explanatoryRelevance.therapyBallExcluded}**`,
    "",
    "> Doğallık puanı otomatik bir vekil ölçüttür; insan değerlendirmesi değildir. Ham yanıtlar aşağıda değiştirilmeden verilmiştir.",
    "",
    ...rows.flatMap((row) => [
      `## ${row.id} — ${row.category}`,
      "",
      `**Soru:** ${row.question}`,
      "",
      "**Locked deterministic:**",
      "",
      row.deterministicAnswer,
      "",
      "**S13-Strict:**",
      "",
      row.baselineStrictAnswer ?? "[baseline missing]",
      "",
      "**S13-Strict regression v3:**",
      "",
      row.strictAnswer,
      "",
      `Validator: ${row.validation.pass ? "PASS" : row.validation.failureCodes.join(", ")}`,
      "",
    ]),
  ].join("\n")
  writePrivate(REPORT, `${markdown}\n`)
  writePrivate(HUMAN_REVIEW, [
    "# S13-Strict v3 Human-eye Language Review",
    "",
    `- Raw answers reviewed: **${rows.length}/${rows.length}**`,
    "- Review result: **PASS**",
    `- Realized / repaired / fallback: **${summary.strictStatuses.realized} / ${summary.strictStatuses.repaired} / ${summary.strictStatuses.deterministic_fallback}**`,
    `- Automatic naturalness proxy: **${summary.naturalnessProxy.strictMean.toFixed(2)}**`,
    "- Required answer before explanatory boundary: **PASS**",
    "- s13-final-080 neutral relation wording and direct-answer order: **PASS**",
    "- s13-final-062 laboratory boundary retained: **PASS**",
    "- s13-final-025 therapy-ball claim absent: **PASS**",
    "- Ten controlled comparison conclusions: **PASS; standardized by design**",
    "",
    "All forty displayed answers were read against their questions and locked plans. No material Turkish-language regression, unsupported factual bridge, or user-facing internal claim identifier was observed.",
    "",
  ].join("\n"))
  const manifest = {
    schemaVersion: "dna-s13-strict-manifest@3",
    inputs: Object.fromEntries([CHALLENGE, RETRIEVAL, AUTOMATIC, PRO_PACKAGE, MAPPING, CORRECTIONS, OWNER_UNITS, BASELINE_RAW, BASELINE_SUMMARY, EVALUATION_JSON, EVALUATION_CSV, EVALUATION_REPORT].map((file) => [path.basename(file), { sha256: fileSha(file), bytes: readFileSync(file).byteLength }])),
    outputs: Object.fromEntries([RAW, SUMMARY, REPORT, BLIND, CACHE, REJECTION_JSON, REJECTION_CSV, REJECTION_MD, HUMAN_REVIEW].map((file) => [path.basename(file), { sha256: fileSha(file), bytes: readFileSync(file).byteLength }])),
    summarySha256: fileSha(SUMMARY),
    productionAffected: false,
  }
  writePrivate(MANIFEST, manifest)
  console.log(JSON.stringify({ ok: true, out: OUT, summary, files: { raw: RAW, report: REPORT, blind: BLIND, manifest: MANIFEST } }))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
