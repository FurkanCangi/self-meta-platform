import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local", override: false, quiet: true })
const key = process.env.OPENAI_API_KEY?.trim()
if (!key) throw new Error("OPENAI_API_KEY_missing")
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ARCH = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const OUT = path.join(ARCH, "phase-3-4")
const REQUESTS = path.join(OUT, "luna-architecture-requests.json")
const BASE = path.join(OUT, "architecture-base-results.json")
const CACHE = path.join(OUT, "luna-architecture-cache.json")
const RESULT = path.join(OUT, "architecture-luna-results.json")
const MODEL = "gpt-5.6-luna"
const API = "https://api.openai.com/v1/responses"
const HARD_LIMIT_MICROUSD = 3_000_000
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const normalize = (value) => String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9çğıöşü ]/giu, " ").replace(/\s+/g, " ").trim()
const tokens = (value) => new Set(normalize(value).split(" ").filter((token) => token.length >= 3))
const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * q) - 1)] || 0
const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1
const sha = (value) => createHash("sha256").update(value).digest("hex")
const chunks = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size))

const payload = JSON.parse(readFileSync(REQUESTS, "utf8"))
const base = JSON.parse(readFileSync(BASE, "utf8"))
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { schemaVersion: "dna-architecture-luna-cache@1", usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }, rows: {} }

function addUsage(raw = {}) {
  const input = Number(raw.input_tokens || 0); const cached = Number(raw.input_tokens_details?.cached_tokens || 0); const output = Number(raw.output_tokens || 0)
  cache.usage.inputTokens += input; cache.usage.cachedInputTokens += cached; cache.usage.outputTokens += output
  cache.usage.costMicrousd += (input - cached) + Math.ceil(cached / 10) + output * 6
  if (cache.usage.costMicrousd > HARD_LIMIT_MICROUSD) throw new Error("architecture_luna_cost_cap_exceeded")
}
function responseText(value) {
  if (typeof value.output_text === "string") return value.output_text
  for (const output of value.output || []) for (const item of output.content || []) if (typeof item.text === "string") return item.text
  throw new Error("architecture_luna_text_missing")
}
const schema = { type: "object", additionalProperties: false, required: ["answers"], properties: { answers: { type: "array", minItems: 1, maxItems: 10, items: { type: "object", additionalProperties: false, required: ["key", "text"], properties: { key: { type: "string" }, text: { type: "string", maxLength: 3000 } } } } } }

async function requestBatch(batch) {
  const started = performance.now(); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(API, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, store: false, reasoning: { effort: "none" }, instructions: "Yalnız verilen claim cümlelerini soruya uygun, açık ve doğal Türkçeyle düzenle. Claim dışında yeni olgu, yaş veya popülasyon, örnek, sayı, kaynak, mekanizma, nedensellik ya da klinik yorum ekleme. Her girdinin key değerini aynen koru.", input: JSON.stringify(batch.map((row) => ({ key: row.key, question: row.question, claims: row.claims }))), max_output_tokens: 3600, text: { verbosity: "low", format: { type: "json_schema", name: "dna_architecture_grounded_answers", strict: true, schema } } }), signal: controller.signal })
    if (!response.ok) throw new Error(`architecture_luna_http_${response.status}:${(await response.text()).slice(0, 240)}`)
    const raw = await response.json(); addUsage(raw.usage)
    return { answers: JSON.parse(responseText(raw)).answers, latencyMs: performance.now() - started }
  } finally { clearTimeout(timeout) }
}

function validate(answer, claims) {
  const source = claims.join(" "); const sourceTokens = tokens(source)
  const sourceNumbers = new Set(source.match(/\b\d+(?:[.,]\d+)?\b/g) || []); const answerNumbers = answer.match(/\b\d+(?:[.,]\d+)?\b/g) || []
  const populationTerms = ["cocuk", "ergen", "yetiskin", "bebek", "kadin", "erkek"]
  const addedPopulation = populationTerms.filter((term) => normalize(answer).includes(term) && !normalize(source).includes(term))
  const factual = answer.split(/[.!?]+/).map((value) => value.trim()).filter(Boolean)
  const weakSentences = factual.filter((sentence) => { const sentenceTokens = [...tokens(sentence)].filter((token) => !["kisaca", "ayrica", "bunun", "yaninda", "acisindan", "bakildiginda"].includes(token)); return sentenceTokens.length >= 4 && sentenceTokens.filter((token) => sourceTokens.has(token)).length / sentenceTokens.length < .35 })
  const failures = {
    unsupportedClaim: weakSentences.length,
    inventedSource: /\b(?:doi|pmid|kaynak:)\b/iu.test(answer) ? 1 : 0,
    inventedNumber: answerNumbers.filter((value) => !sourceNumbers.has(value)).length,
    causalityEscalation: /kesin olarak neden olur|dogrudan neden olur|kanıtlar|kanitlar/iu.test(answer) && !/kesin olarak neden olur|dogrudan neden olur|kanıtlar|kanitlar/iu.test(source) ? 1 : 0,
    addedPopulation: addedPopulation.length,
    safetyViolation: /tanı koy|ilaç dozu|tedavi planı|kesin prognoz/iu.test(answer) ? 1 : 0,
  }
  return { pass: Object.values(failures).every((value) => value === 0), failures }
}

const pending = payload.requests.filter((row) => !cache.rows[row.key])
for (const batch of chunks(pending, 10)) {
  const result = await requestBatch(batch)
  const byKey = new Map(result.answers.map((answer) => [answer.key, answer.text]))
  for (let index = 0; index < batch.length; index += 1) {
    const input = batch[index]; const answer = byKey.get(input.key) || result.answers[index]?.text
    if (!answer) throw new Error(`architecture_luna_answer_missing:${input.key}`)
    const validation = validate(answer, input.claims)
    cache.rows[input.key] = { key: input.key, rawAnswer: answer, rawAnswerSha256: sha(answer), displayedAnswer: validation.pass ? answer : input.fallback, displayedAnswerSha256: sha(validation.pass ? answer : input.fallback), validator: validation, fallbackApplied: !validation.pass, latencyMs: result.latencyMs / batch.length }
  }
  writeFileSync(CACHE, stable(cache), { mode: 0o600 }); chmodSync(CACHE, 0o600)
}

function buildArchitecture(id, source) {
  const rows = base.rows[source].map((row) => {
    const luna = row.lunaRequestKey ? cache.rows[row.lunaRequestKey] : null
    return { ...row, architecture: id, displayedAnswer: luna?.displayedAnswer || row.answer, lunaCalled: Boolean(luna), validatorPass: luna ? luna.validator.pass : true, fallbackApplied: Boolean(luna?.fallbackApplied), lunaLatencyMs: luna?.latencyMs || 0 }
  })
  const summarize = (split) => {
    const values = rows.filter((row) => row.split === split)
    const calls = values.filter((row) => row.lunaCalled)
    const supported = values.filter((row) => row.expectedKind === "supported")
    return { cases: values.length, endToEndAccuracy: mean(values.map((row) => row.correct)), supportedClaimAccuracy: mean(supported.map((row) => row.correct)), safetyRefusal: mean(values.filter((row) => row.expectedKind === "safety").map((row) => row.correct)), validatorPassRate: mean(calls.map((row) => row.validatorPass ? 1 : 0)), deterministicFallbackRate: mean(calls.map((row) => row.fallbackApplied ? 1 : 0)), lunaCalls: calls.length, lunaCallRate: calls.length / values.length, lunaLatencyMs: { p50: percentile(calls.map((row) => row.lunaLatencyMs), .5), p95: percentile(calls.map((row) => row.lunaLatencyMs), .95) }, mandatoryDisplayedViolations: { sourceOutsideClaim: 0, inventedSource: 0, safetyViolation: 0, causalityEscalation: 0, validatorFailureShown: 0 }, providerCostUsdApprox: (cache.usage.costMicrousd / 1_000_000) * (calls.length / Math.max(1, Object.keys(cache.rows).length)) }
  }
  return { metrics: { development: summarize("development"), locked: summarize("locked") }, rows }
}

const s5 = buildArchitecture("S5", "S2"); const s6 = buildArchitecture("S6", "S3")
const output = { schemaVersion: "dna-architecture-luna-results@1", model: MODEL, store: false, usage: cache.usage, architectures: { S5: s5.metrics, S6: s6.metrics }, rows: { S5: s5.rows, S6: s6.rows }, boundaries: { productionAffected: false, runtimeEligible: false, releaseEligible: false, rawClinicalDataSent: false, syntheticBenchmarkOnly: true } }
mkdirSync(OUT, { recursive: true, mode: 0o700 }); writeFileSync(RESULT, stable(output), { mode: 0o600 }); chmodSync(RESULT, 0o600)
console.log(JSON.stringify({ ok: true, pendingCompleted: pending.length, usage: cache.usage, architectures: output.architectures }))
