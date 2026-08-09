import { createHash } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local", override: false })

const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ARCH = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const OUT = path.join(ARCH, "phase-2")
const MODEL = "gpt-5.6-luna"
const API = "https://api.openai.com/v1/responses"
const COST_LIMIT_MICROUSD = 3_000_000
const key = process.env.OPENAI_API_KEY?.trim()
if (!key) throw new Error("OPENAI_API_KEY_missing")

const development = JSON.parse(readFileSync(path.join(ARCH, "development.json"), "utf8")).cases
const locked = JSON.parse(readFileSync(path.join(ARCH, "sealed/locked-automated.json"), "utf8")).cases
const dense = JSON.parse(readFileSync("src/lib/dna/chat/catalog/generated/dense/runtime.json", "utf8"))
const unitById = new Map(dense.units.map((unit) => [unit.id, unit]))
const domains = [...new Set([...dense.units.map((unit) => unit.domain), ...development.flatMap((row) => row.gold.queryFrame.topicIds.filter((id) => id.startsWith("conversation."))), "ood", "safety"])].sort()
const operations = ["definition", "comparison", "relation", "measurement", "development", "evidence", "case", "follow_up", "correction", "compound", "social", "safety", "unknown"]
const sha = (value) => createHash("sha256").update(value).digest("hex")
const normalize = (value) => String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9çğıöşü ]/giu, " ").replace(/\s+/g, " ").trim()
const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * q) - 1)] || 0
const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1
const tokenSet = (value) => new Set(normalize(value).split(" ").filter((token) => token.length >= 3))
const f1 = (expected, actual) => {
  const a = new Set(expected); const b = new Set(actual)
  if (!a.size && !b.size) return 1
  const overlap = [...a].filter((value) => b.has(value)).length
  const precision = b.size ? overlap / b.size : 0; const recall = a.size ? overlap / a.size : 0
  return precision + recall ? 2 * precision * recall / (precision + recall) : 0
}
const domainFor = (row) => row.gold.acceptedClaimIds.map((id) => unitById.get(id)?.domain).filter(Boolean)[0] || row.gold.queryFrame.topicIds[0] || (row.gold.expectedAction === "refuse" ? "safety" : "ood")
const operationFor = (row) => row.gold.queryFrame.operation === "followup" ? "follow_up" : row.gold.queryFrame.operation
const chunks = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size))

let usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }
function addUsage(raw = {}) {
  const input = Number(raw.input_tokens || 0); const cached = Number(raw.input_tokens_details?.cached_tokens || 0); const output = Number(raw.output_tokens || 0)
  usage.inputTokens += input; usage.cachedInputTokens += cached; usage.outputTokens += output
  usage.costMicrousd += (input - cached) + Math.ceil(cached / 10) + output * 6
  if (usage.costMicrousd > COST_LIMIT_MICROUSD) throw new Error("luna_tournament_cost_cap_exceeded")
}
function responseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text
  for (const output of payload.output || []) for (const item of output.content || []) if (typeof item.text === "string") return item.text
  throw new Error("luna_output_text_missing")
}
async function request({ name, schema, instructions, input, maxOutputTokens }) {
  const start = performance.now()
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, store: false, reasoning: { effort: "none" }, instructions, input: JSON.stringify(input), max_output_tokens: maxOutputTokens, text: { verbosity: "low", format: { type: "json_schema", name, strict: true, schema } } }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`luna_http_${response.status}:${(await response.text()).slice(0, 300)}`)
    const payload = await response.json(); addUsage(payload.usage)
    return { value: JSON.parse(responseText(payload)), latencyMs: performance.now() - start, responseId: payload.id || null }
  } finally { clearTimeout(timeout) }
}

const frameSchema = {
  type: "object", additionalProperties: false, required: ["frames"],
  properties: { frames: { type: "array", minItems: 1, maxItems: 10, items: { type: "object", additionalProperties: false, required: ["id", "operation", "domain", "focus", "followUp", "correction", "comparisonTargets", "subquestionCount", "answerability", "confidence"], properties: {
    id: { type: "string" }, operation: { type: "string", enum: operations }, domain: { type: "string", enum: domains }, focus: { type: "string", maxLength: 180 }, followUp: { type: "boolean" }, correction: { type: "boolean" }, comparisonTargets: { type: "array", maxItems: 2, items: { type: "string", enum: domains } }, subquestionCount: { type: "integer", minimum: 1, maximum: 2 }, answerability: { type: "string", enum: ["supported", "unsupported", "refuse"] }, confidence: { type: "number", minimum: 0, maximum: 1 },
  } } } },
}

const answerSchema = {
  type: "object", additionalProperties: false, required: ["answers"],
  properties: { answers: { type: "array", minItems: 1, maxItems: 5, items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string", maxLength: 3000 } } } } },
}

async function runA3() {
  const rows = []
  for (const batch of chunks(locked, 10)) {
    const result = await request({
      name: "dna_tournament_query_frames",
      schema: frameSchema,
      instructions: `Sen yalnız DNA soru yönlendirme ayrıştırıcısısın. Bilimsel cevap yazma. Her girdiyi verilen domain ve operation listelerinden biriyle yapılandır. En fazla iki bağımsız soru ayır. Düzeltme, takip, karşılaştırma ve güvenlik işaretlerini koru. Alan dışıysa ood, yasak klinik/prompt talebiyse safety seç. Girdilerin id değerlerini aynen koru.`,
      input: batch.map((row) => ({ id: row.id, question: row.question, previousTopicIds: row.context?.previousTopicIds || [] })),
      maxOutputTokens: 2400,
    })
    const byId = new Map(result.value.frames.map((frame) => [frame.id, frame]))
    for (let index = 0; index < batch.length; index += 1) {
      const row = batch[index]
      const frame = byId.get(row.id) || result.value.frames[index]
      if (!frame) throw new Error(`luna_frame_missing:${row.id}`)
      rows.push({ id: row.id, expectedOperation: operationFor(row), expectedDomain: domainFor(row), expectedFocus: row.gold.queryFrame.focus, expectedSubquestionCount: row.gold.queryFrame.subquestionCount, expectedCorrection: row.gold.queryFrame.correction, expectedFollowUp: row.gold.queryFrame.followUp, ...frame, latencyMs: result.latencyMs / batch.length })
    }
  }
  const supported = rows.filter((row) => row.answerability === "supported"); const unsupported = rows.filter((row) => row.answerability !== "supported")
  const pairs = supported.flatMap((positive) => unsupported.map((negative) => positive.confidence === negative.confidence ? .5 : positive.confidence > negative.confidence ? 1 : 0))
  return { metrics: {
    evaluationCases: rows.length, intentAccuracy: mean(rows.map((row) => row.operation === row.expectedOperation ? 1 : 0)), topicMacroF1: mean(rows.map((row) => row.domain === row.expectedDomain ? 1 : 0)), focusMacroF1: mean(rows.map((row) => f1([...tokenSet(row.expectedFocus)], [...tokenSet(row.focus)]))), followupAccuracy: mean(rows.filter((row) => row.expectedFollowUp).map((row) => row.followUp ? 1 : 0)), correctionAccuracy: mean(rows.filter((row) => row.expectedCorrection).map((row) => row.correction ? 1 : 0)), comparisonTargetF1: mean(rows.filter((row) => ["comparison", "relation"].includes(row.expectedOperation)).map((row) => f1([row.expectedDomain], row.comparisonTargets.length ? row.comparisonTargets : [row.domain]))), twoQuestionSplitF1: mean(rows.filter((row) => row.expectedSubquestionCount === 2).map((row) => row.subquestionCount === 2 ? 1 : 0)), oodAuroc: mean(pairs), frameExactMatch: mean(rows.map((row) => row.operation === row.expectedOperation && row.domain === row.expectedDomain && row.subquestionCount === row.expectedSubquestionCount && row.correction === row.expectedCorrection ? 1 : 0)), latencyMs: { p50: percentile(rows.map((row) => row.latencyMs), .5), p95: percentile(rows.map((row) => row.latencyMs), .95) }, costPer1000Usd: null,
  }, rows }
}

function sourceGuard(answer, claims) {
  const source = claims.join(" "); const sourceNumbers = new Set(source.match(/\b\d+(?:[.,]\d+)?\b/g) || []); const answerNumbers = answer.match(/\b\d+(?:[.,]\d+)?\b/g) || []
  const sourceTokens = tokenSet(source)
  const factualSentences = answer.split(/[.!?]+/).map((value) => value.trim()).filter(Boolean)
  const unsupported = factualSentences.filter((sentence) => {
    const tokens = [...tokenSet(sentence)].filter((token) => !["kisaca", "ayrica", "bunun", "yaninda", "acisindan", "bakildiginda"].includes(token))
    return tokens.length >= 4 && tokens.filter((token) => sourceTokens.has(token)).length / tokens.length < .35
  }).length
  const causal = /kesin olarak neden olur|dogrudan neden olur|kanıtlar|kanitlar/iu.test(answer) && !/kesin olarak neden olur|dogrudan neden olur|kanıtlar|kanitlar/iu.test(source)
  return { unsupportedClaim: unsupported, inventedSource: /\b(?:doi|pmid|kaynak:)\b/iu.test(answer) ? 1 : 0, inventedNumber: answerNumbers.filter((value) => !sourceNumbers.has(value)).length, causalityEscalation: causal ? 1 : 0, safetyViolation: /tanı koy|ilaç dozu|tedavi planı|kesin prognoz/iu.test(answer) ? 1 : 0 }
}

async function runC4() {
  const cases = locked.filter((row) => row.gold.queryFrame.answerability === "supported" && row.gold.acceptedClaimIds.length)
  const rows = []
  for (const batch of chunks(cases, 5)) {
    const inputs = batch.map((row) => ({ id: row.id, question: row.question, operation: operationFor(row), claims: row.gold.acceptedClaimIds.map((id) => unitById.get(id)?.text).filter(Boolean) }))
    const result = await request({
      name: "dna_tournament_grounded_answers",
      schema: answerSchema,
      instructions: `Sen yalnız verilen kilitli claim cümlelerini doğal ve açık Türkçeyle düzenleyen bir yüzey gerçekleştirme katmanısın. Claim dışında yeni bilgi, sayı, kaynak, mekanizma, nedensellik veya klinik yorum ekleme. Her claim'in kesinlik ve yaş sınırını koru. Soruyu doğrudan yanıtla; metni gereksiz teknik etiketlerle doldurma. Girdi id değerlerini aynen koru.`,
      input: inputs,
      maxOutputTokens: 2200,
    })
    const byId = new Map(result.value.answers.map((answer) => [answer.id, answer.text]))
    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index]
      const answer = byId.get(input.id) || result.value.answers[index]?.text
      if (!answer) throw new Error(`luna_answer_missing:${input.id}`)
      const guard = sourceGuard(answer, input.claims)
      rows.push({ id: input.id, answer, claims: input.claims, answerSha256: sha(answer), ...guard, directness: /soruyu birlikte netleştirelim/iu.test(answer) ? 0 : 1, readability: mean(answer.split(/[.!?]+/).filter(Boolean).map((sentence) => sentence.trim().split(/\s+/).length <= 30 ? 1 : .5)), turkishNaturalness: /\b(?:ve|ile|bu|bir|olarak|icin|için|açısından)\b/iu.test(answer) ? 1 : .5, repetition: 1 - new Set(answer.split(/[.!?]+/).map(normalize).filter(Boolean)).size / Math.max(1, answer.split(/[.!?]+/).map(normalize).filter(Boolean).length), latencyMs: result.latencyMs / batch.length })
    }
  }
  return { metrics: { cases: rows.length, mandatoryZeros: { unsupportedClaim: rows.reduce((sum, row) => sum + row.unsupportedClaim, 0), inventedSource: rows.reduce((sum, row) => sum + row.inventedSource, 0), inventedNumber: rows.reduce((sum, row) => sum + row.inventedNumber, 0), causalityEscalation: rows.reduce((sum, row) => sum + row.causalityEscalation, 0), safetyViolation: rows.reduce((sum, row) => sum + row.safetyViolation, 0) }, quality: { directness: mean(rows.map((row) => row.directness)), readability: mean(rows.map((row) => row.readability)), turkishNaturalness: mean(rows.map((row) => row.turkishNaturalness)) }, repetition: mean(rows.map((row) => row.repetition)), latencyMs: { p50: percentile(rows.map((row) => row.latencyMs), .5), p95: percentile(rows.map((row) => row.latencyMs), .95) }, blindHumanPreference: "pending_independent_human_evaluation" }, rows }
}

const stage = process.argv.find((value) => value.startsWith("--stage="))?.split("=")[1] || "all"
const existingPath = path.join(OUT, "luna-layer-results.json")
const existing = stage === "c4" ? JSON.parse(readFileSync(existingPath, "utf8")) : null
if (existing?.usage) usage = { ...existing.usage }
const a3 = existing ? { metrics: existing.layerA.A3, rows: existing.rows.A3 } : await runA3()
const c4 = await runC4()
a3.metrics.costPer1000Usd = (usage.costMicrousd / 1_000_000) / ((locked.length + c4.rows.length) / 1000)
const output = { schemaVersion: "dna-layer-tournament-luna@1", benchmarkSha256: JSON.parse(readFileSync(path.join(ARCH, "manifest.json"), "utf8")).benchmarkSha256, model: MODEL, store: false, layerA: { A3: a3.metrics }, layerC: { C4: c4.metrics }, usage, boundaries: { runtimeEligible: false, releaseEligible: false, rawQuestionsInRepository: false, humanEvaluationUsed: false }, rows: { A3: a3.rows, C4: c4.rows } }
mkdirSync(OUT, { recursive: true, mode: 0o700 })
const target = path.join(OUT, "luna-layer-results.json")
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 }); chmodSync(target, 0o600)
console.log(JSON.stringify({ ok: true, A3: output.layerA.A3, C4: output.layerC.C4, usage }))
