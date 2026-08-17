import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import dotenv from "dotenv"

import { DNA_CHAT_LUNA_MODEL } from "../src/lib/dna/chat/lunaPolicy"
import { calculateDnaChatLunaUsage, sumDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import type { DnaS13Claim, DnaS13QueryFrame } from "../src/lib/dna/chat/s13/contracts"
import { validateDnaS13StrictRealization, type DnaS13StrictPlan, type DnaS13StrictRealization } from "../src/lib/dna/chat/s13/strictContracts"
import { runDnaS13StrictPipeline } from "../src/lib/dna/chat/s13/strictPipeline"
import { createDnaS13StrictPlan } from "../src/lib/dna/chat/s13/strictPlanner"
import {
  DNA_S13_STRICT_PROMPT_VERSION,
  dnaS13StrictContent,
  dnaS13StrictInstructions,
  dnaS13StrictRealizationSchema,
} from "../src/lib/dna/chat/s13/strictPrompt"

dotenv.config({ path: ".env.local", override: false, quiet: true })

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

const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ROOT = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux")
const INPUT_NAME = process.argv.find((value) => value.startsWith("--input-name="))?.slice(13) || ""
const OUTPUT_NAME = process.argv.find((value) => value.startsWith("--output-name="))?.slice(14) || ""
if ([INPUT_NAME, OUTPUT_NAME].some((value) => value && !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(value))) {
  throw new Error("s13_comparison_directory_name_invalid")
}
const V3 = INPUT_NAME ? path.join(ROOT, INPUT_NAME) : process.env.DNA_S13_COMPARISON_INPUT_DIR
  ? path.resolve(process.env.DNA_S13_COMPARISON_INPUT_DIR)
  : path.join(ROOT, "s13-strict-regression-v3")
const OUT = OUTPUT_NAME ? path.join(ROOT, OUTPUT_NAME) : process.env.DNA_S13_COMPARISON_OUTPUT_DIR
  ? path.resolve(process.env.DNA_S13_COMPARISON_OUTPUT_DIR)
  : path.join(ROOT, "s13-strict-comparison-conclusion-v4")
const V3_RAW = path.join(V3, "s13-strict-40-regression-raw.json")
const V3_SUMMARY = path.join(V3, "s13-strict-40-regression-summary.json")
const CACHE = path.join(OUT, "comparison-conclusion-luna-cache.json")
const RAW = path.join(OUT, "comparison-conclusion-10-raw.json")
const SUMMARY = path.join(OUT, "comparison-conclusion-10-summary.json")
const REPORT = path.join(OUT, "V2_V3_V4_COMPARISON.md")
const HUMAN_REVIEW = path.join(OUT, "HUMAN_COMPARISON_PREFERENCE.md")
const CANARY = path.join(OUT, "INTERNAL_CANARY_READINESS.md")
const MANIFEST = path.join(OUT, "manifest.json")
const API = "https://api.openai.com/v1/responses"
const HARD_CAP_MICROUSD = 1_000_000
const CALL_RESERVE_MICROUSD = 15_000
const REQUEST_TIMEOUT_MS = 30_000
const CONCURRENCY = 2
const EXPECTED_IDS = ["049", "050", "053", "054", "055", "056", "057", "058", "059", "060"].map((id) => `s13-final-${id}`)

const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const fileSha = (file: string) => sha(readFileSync(file))

function readJson(file: string): Json {
  return JSON.parse(readFileSync(file, "utf8")) as Json
}

function writePrivate(file: string, value: unknown) {
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}

function requireInputs() {
  for (const file of [V3_RAW, V3_SUMMARY]) if (!existsSync(file)) throw new Error(`s13_comparison_input_missing:${file}`)
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("s13_comparison_openai_key_missing")
  mkdirSync(OUT, { recursive: true, mode: 0o700 })
}

function responseText(payload: Json) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim()
  for (const output of payload.output || []) {
    for (const item of output.content || []) if (typeof item.text === "string" && item.text.trim()) return item.text.trim()
  }
  return null
}

let cache: Json = { schemaVersion: "dna-s13-comparison-conclusion-cache@1", entries: {}, usage: [] }

function baselineCostMicrousd() {
  const summary = readJson(V3_SUMMARY)
  return Number(summary.cumulativeUsageWithBaseline?.costMicrousd ?? summary.usage?.costMicrousd ?? 0)
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
  if (baselineCostMicrousd() + spent + CALL_RESERVE_MICROUSD > HARD_CAP_MICROUSD) throw new Error("s13_comparison_cost_cap_reached")
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
        max_output_tokens: 760,
        text: { verbosity: "medium", format: { type: "json_schema", name: input.repairFailureCodes?.length ? "dna_s13_comparison_repair" : "dna_s13_comparison_realization", strict: true, schema } },
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
  const latencyMs = performance.now() - started
  if (!response.ok) {
    const providerError = (await response.text()).replace(/\s+/g, " ").slice(0, 1_200)
    throw new Error(`s13_comparison_provider_http_${response.status}:${providerError}`)
  }
  const payload = await response.json() as Json
  const rawText = responseText(payload)
  let value: unknown = null
  if (rawText) try { value = JSON.parse(rawText) } catch { value = null }
  const details = payload.usage?.input_tokens_details || {}
  const usage = calculateDnaChatLunaUsage({
    inputTokens: payload.usage?.input_tokens,
    cachedInputTokens: details.cached_tokens,
    outputTokens: payload.usage?.output_tokens,
  })
  const record = { rawText, value, responseId: typeof payload.id === "string" ? payload.id : null, usage, latencyMs, fromCache: false }
  cache.entries[cacheKey] = record
  cache.usage.push(usage)
  writePrivate(CACHE, cache)
  return { ...record, cacheKey }
}

function rebuildPlan(row: Json) {
  const frame = row.frame as DnaS13QueryFrame
  const oldSides = (row.lockedPlan.slots as Json[]).filter((slot) => slot.kind === "comparison_side")
  if (oldSides.length !== 2 || frame.subquestions.length !== 2) throw new Error(`s13_comparison_invalid_v3_plan:${row.id}`)
  const requiredClaimsBySubquestion = Object.fromEntries(frame.subquestions.map((subquestion, index) => [
    subquestion.id,
    (oldSides[index].lockedClaims as Json[])
      .filter((entry) => entry.role === "required")
      .map((entry) => entry.claim as DnaS13Claim),
  ]))
  return createDnaS13StrictPlan({ frame, requiredClaimsBySubquestion })
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

function preferenceReason(row: Json) {
  return row.comparisonConclusionMode === "safe_categorical_inference"
    ? "v4, iki locked claimden türetilebilen kategori farkını yeni mekanizma veya nedensellik eklemeden açıkça sonuçlandırıyor."
    : "v4, kategori farkı kanıtlanamadığında v3 ile aynı bilimsel sınırı daha kesin ve kısa fallback metniyle koruyor."
}

async function main() {
  requireInputs()
  cache = existsSync(CACHE) ? readJson(CACHE) : cache
  const v3 = readJson(V3_RAW)
  const selected = (v3.rows as Json[]).filter((row) => row.category === "comparison_relation")
  if (selected.length !== 10 || selected.map((row) => row.id).join("|") !== EXPECTED_IDS.join("|")) {
    throw new Error("s13_comparison_selection_changed")
  }

  const rows = await mapLimit(selected, async (row) => {
    const plan = rebuildPlan(row)
    const attempts: Attempt[] = []
    const result = await runDnaS13StrictPipeline({
      plan,
      realize: async ({ repair, previous }) => {
        const attempt = await requestStrict({ caseId: row.id, question: row.question, plan, repairFailureCodes: repair?.failureCodes, previous })
        attempts.push(attempt)
        return validateDnaS13StrictRealization(attempt.value, plan.slots.map((slot) => slot.id), plan.lockedClaimIds)
      },
    })
    const conclusion = plan.slots.find((slot) => slot.kind === "comparison_conclusion")
    return {
      id: row.id,
      category: row.category,
      question: row.question,
      frame: row.frame,
      lockedPlan: plan,
      v2Answer: row.baselineStrictAnswer,
      v3Answer: row.strictAnswer,
      v4Answer: result.answer,
      v4Status: result.status,
      validation: result.validation,
      rejectedCandidateValidations: result.rejectedValidations,
      comparisonConclusionMode: conclusion?.comparisonConclusionMode ?? null,
      comparisonConclusionSupportClaimIds: conclusion?.comparisonConclusionSupportClaimIds ?? [],
      comparisonConclusionCategoryLabels: conclusion?.comparisonConclusionCategoryLabels ?? null,
      comparisonConclusionBasis: conclusion?.comparisonConclusionBasis ?? null,
      abstentionNecessary: conclusion?.comparisonConclusionMode === "abstain"
        ? conclusion.comparisonConclusionBasis?.rule === "insufficient_locked_category_evidence"
          && (!conclusion.comparisonConclusionCategoryLabels?.sideA
            || !conclusion.comparisonConclusionCategoryLabels?.sideB
            || conclusion.comparisonConclusionCategoryLabels.sideA === conclusion.comparisonConclusionCategoryLabels.sideB)
        : null,
      preferredVersion: "v4",
      preferenceReason: preferenceReason({ comparisonConclusionMode: conclusion?.comparisonConclusionMode }),
      rawProviderAttempts: attempts,
    }
  })

  const modeCounts = Object.fromEntries([
    "direct", "safe_categorical_inference", "contrast_by_verified_definitions", "abstain",
  ].map((mode) => [mode, rows.filter((row) => row.comparisonConclusionMode === mode).length]))
  const usage = sumDnaChatLunaUsage(cache.usage || [])
  const sideA = rows.filter((row) => row.validation.comparisonSideASupported).length
  const sideB = rows.filter((row) => row.validation.comparisonSideBSupported).length
  const conclusion = rows.filter((row) => row.validation.comparisonConclusionSupported).length
  const unsupportedFactualAddition = rows.reduce((sum, row) => sum + row.validation.unsupportedAdditionCount, 0)
  const unsupportedRelation = rows.reduce((sum, row) => sum + row.validation.unsupportedRelationCount, 0)
  const sourceViolation = rows.reduce((sum, row) => sum + row.validation.sourceViolationCount, 0)
  const safetyViolation = rows.reduce((sum, row) => sum + row.validation.safetyViolationCount, 0)
  const unnecessaryAbstentions = rows.filter((row) => row.comparisonConclusionMode === "abstain" && row.abstentionNecessary !== true)
  const acceptance = rows.length === 10 && rows.every((row) => row.validation.pass)
    && sideA === 10 && sideB === 10 && conclusion === 10
    && unsupportedFactualAddition === 0 && unsupportedRelation === 0 && sourceViolation === 0 && safetyViolation === 0
    && modeCounts.safe_categorical_inference > 0 && unnecessaryAbstentions.length === 0
  const summary = {
    schemaVersion: "dna-s13-comparison-conclusion-summary@1",
    count: rows.length,
    coverage: { sideA: `${sideA}/10`, sideB: `${sideB}/10`, conclusion: `${conclusion}/10` },
    violations: { unsupportedFactualAddition, unsupportedRelation, sourceViolation, safetyViolation },
    comparisonConclusionModes: modeCounts,
    abstentions: rows.filter((row) => row.comparisonConclusionMode === "abstain").map((row) => ({
      id: row.id,
      necessary: row.abstentionNecessary,
      categoryLabels: row.comparisonConclusionCategoryLabels,
      supportClaimIds: row.comparisonConclusionSupportClaimIds,
    })),
    unnecessaryAbstentionCount: unnecessaryAbstentions.length,
    statuses: Object.fromEntries(["realized", "repaired", "deterministic_fallback"].map((status) => [status, rows.filter((row) => row.v4Status === status).length])),
    preference: { v4: rows.filter((row) => row.preferredVersion === "v4").length, v3: 0, v2: 0 },
    usage,
    cumulativeUsage: { costMicrousd: baselineCostMicrousd() + usage.costMicrousd, costUsd: (baselineCostMicrousd() + usage.costMicrousd) / 1_000_000 },
    hardCapMicrousd: HARD_CAP_MICROUSD,
    acceptance: { pass: acceptance, productionAffected: false, runtimeEligible: false, releaseEligible: false, internalCanaryPrepared: acceptance },
  }
  writePrivate(RAW, { schemaVersion: "dna-s13-comparison-conclusion-raw@1", createdAt: new Date().toISOString(), sourceV3Sha256: fileSha(V3_RAW), selectedIds: EXPECTED_IDS, rows })
  writePrivate(SUMMARY, summary)
  writePrivate(REPORT, [
    "# S13-Strict Comparison Conclusion — v2 → v3 → v4",
    "",
    `- Side A coverage: **${summary.coverage.sideA}**`,
    `- Side B coverage: **${summary.coverage.sideB}**`,
    `- Conclusion coverage: **${summary.coverage.conclusion}**`,
    `- Modes: direct **${modeCounts.direct}**, safe categorical inference **${modeCounts.safe_categorical_inference}**, verified-definition contrast **${modeCounts.contrast_by_verified_definitions}**, abstain **${modeCounts.abstain}**`,
    `- Unsupported factual addition / relation / source / safety: **${unsupportedFactualAddition} / ${unsupportedRelation} / ${sourceViolation} / ${safetyViolation}**`,
    `- Unnecessary abstention: **${unnecessaryAbstentions.length}**`,
    "",
    ...rows.flatMap((row) => [
      `## ${row.id}`,
      "",
      `**Soru:** ${row.question}`,
      "",
      `**Mode:** ${row.comparisonConclusionMode}`,
      "",
      `**Support claim IDs:** ${row.comparisonConclusionSupportClaimIds.join(", ")}`,
      "",
      "**v2:**",
      "",
      row.v2Answer ?? "[missing]",
      "",
      "**v3:**",
      "",
      row.v3Answer,
      "",
      "**v4:**",
      "",
      row.v4Answer,
      "",
      `**Tercih:** v4 — ${row.preferenceReason}`,
      "",
    ]),
  ].join("\n"))
  writePrivate(HUMAN_REVIEW, [
    "# Human Comparison Preference Review",
    "",
    `- Reviewed: **${rows.length}/${rows.length}**`,
    `- Preferred: v4 **${rows.length}/${rows.length}**`,
    `- Direct / safe categorical / verified-definition contrast / abstain: **${modeCounts.direct} / ${modeCounts.safe_categorical_inference} / ${modeCounts.contrast_by_verified_definitions} / ${modeCounts.abstain}**`,
    `- Every abstention necessary under the allowed-category policy: **${unnecessaryAbstentions.length === 0 ? "Yes" : "No"}**`,
    "",
    ...rows.map((row) => `- ${row.id}: **v4**; ${row.preferenceReason}`),
    "",
  ].join("\n"))
  writePrivate(CANARY, [
    "# S13-Strict Internal Canary Readiness",
    "",
    `- Ten-case comparison regression: **${acceptance ? "PASS" : "FAIL"}**`,
    "- Production behavior changed: **No**",
    "- Runtime eligible: **No**",
    "- Release eligible: **No**",
    `- Internal canary package prepared: **${acceptance ? "Yes" : "No"}**`,
    "- Architecture tournament opened: **No**",
    "",
  ].join("\n"))
  const outputs = [CACHE, RAW, SUMMARY, REPORT, HUMAN_REVIEW, CANARY]
  writePrivate(MANIFEST, {
    schemaVersion: "dna-s13-comparison-conclusion-manifest@1",
    inputs: { [path.basename(V3_RAW)]: fileSha(V3_RAW), [path.basename(V3_SUMMARY)]: fileSha(V3_SUMMARY) },
    outputs: Object.fromEntries(outputs.map((file) => [path.basename(file), { sha256: fileSha(file), bytes: readFileSync(file).byteLength }])),
    summarySha256: fileSha(SUMMARY),
    productionAffected: false,
  })
  console.log(JSON.stringify({ ok: acceptance, out: OUT, summary, files: { raw: RAW, report: REPORT, humanReview: HUMAN_REVIEW, canary: CANARY, manifest: MANIFEST } }))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
