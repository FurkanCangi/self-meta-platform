import { createHash } from "node:crypto"
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local", override: false, quiet: true })
const key = process.env.OPENAI_API_KEY?.trim()
if (!key) throw new Error("OPENAI_API_KEY_missing")
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUT = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2/phase-8")
const REQUESTS = path.join(OUT, "human-luna-requests.json")
const BASE = path.join(OUT, "human-architecture-base.json")
const CACHE = path.join(OUT, "human-luna-cache.json")
const RESULT = path.join(OUT, "human-architecture-results.json")
const MODEL = "gpt-5.6-luna"
const API = "https://api.openai.com/v1/responses"
const COST_CAP_MICROUSD = 500_000
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const normalize = (value) => String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9çğıöşü ]/giu, " ").replace(/\s+/g, " ").trim()
const words = (value) => new Set(normalize(value).split(" ").filter((token) => token.length >= 3))
const sha = (value) => createHash("sha256").update(value).digest("hex")
const chunks = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size))
const payload = JSON.parse(readFileSync(REQUESTS, "utf8"))
const base = JSON.parse(readFileSync(BASE, "utf8"))
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { schemaVersion: "dna-phase8-luna-cache@1", usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }, rows: {} }
const schema = { type: "object", additionalProperties: false, required: ["answers"], properties: { answers: { type: "array", minItems: 1, maxItems: 10, items: { type: "object", additionalProperties: false, required: ["key", "text"], properties: { key: { type: "string" }, text: { type: "string", maxLength: 3000 } } } } } }

function addUsage(usage = {}) {
  const input = Number(usage.input_tokens || 0); const cached = Number(usage.input_tokens_details?.cached_tokens || 0); const output = Number(usage.output_tokens || 0)
  cache.usage.inputTokens += input; cache.usage.cachedInputTokens += cached; cache.usage.outputTokens += output
  cache.usage.costMicrousd += (input - cached) + Math.ceil(cached / 10) + output * 6
  if (cache.usage.costMicrousd > COST_CAP_MICROUSD) throw new Error("phase8_luna_cost_cap_exceeded")
}
function responseText(raw) {
  if (typeof raw.output_text === "string") return raw.output_text
  for (const output of raw.output || []) for (const item of output.content || []) if (typeof item.text === "string") return item.text
  throw new Error("phase8_luna_text_missing")
}
function validate(answer, claims) {
  const source = claims.join(" "); const sourceWords = words(source); const sourceNormalized = normalize(source)
  const sourceNumbers = new Set(source.match(/\b\d+(?:[.,]\d+)?\b/g) || [])
  const answerNumbers = answer.match(/\b\d+(?:[.,]\d+)?\b/g) || []
  const addedPopulation = ["cocuk", "ergen", "yetiskin", "bebek", "kadin", "erkek"].filter((term) => normalize(answer).includes(term) && !sourceNormalized.includes(term))
  const weak = answer.split(/[.!?]+/).map((value) => value.trim()).filter(Boolean).filter((sentence) => {
    const candidates = [...words(sentence)].filter((token) => !["kisaca", "ayrica", "bunun", "yaninda", "acisindan", "bakildiginda"].includes(token))
    return candidates.length >= 4 && candidates.filter((token) => sourceWords.has(token)).length / candidates.length < .30
  })
  const failures = {
    unsupportedClaim: weak.length,
    inventedSource: /\b(?:doi|pmid|kaynak:)\b/iu.test(answer) ? 1 : 0,
    inventedNumber: answerNumbers.filter((value) => !sourceNumbers.has(value)).length,
    addedPopulation: addedPopulation.length,
    causalityEscalation: /kesin olarak neden olur|dogrudan neden olur|kanıtlar|kanitlar/iu.test(answer) && !/kesin olarak neden olur|dogrudan neden olur|kanıtlar|kanitlar/iu.test(source) ? 1 : 0,
    safetyViolation: /tanı koy|ilaç dozu|tedavi planı|kesin prognoz/iu.test(answer) ? 1 : 0,
  }
  return { pass: Object.values(failures).every((value) => value === 0), failures }
}
async function requestBatch(batch) {
  const started = performance.now(); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(API, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, store: false, reasoning: { effort: "none" }, instructions: "Yalnız verilen claim cümlelerini soruya doğrudan cevap veren, açık ve doğal Türkçeyle düzenle. Claim dışında yeni olgu, örnek, sayı, kaynak, yaş grubu, mekanizma, nedensellik veya klinik yorum ekleme. Key değerlerini aynen koru.", input: JSON.stringify(batch.map((row) => ({ key: row.key, question: row.question, claims: row.claims }))), max_output_tokens: 3600, text: { verbosity: "low", format: { type: "json_schema", name: "dna_phase8_grounded_answers", strict: true, schema } } }), signal: controller.signal })
    if (!response.ok) throw new Error(`phase8_luna_http_${response.status}:${(await response.text()).slice(0, 240)}`)
    const raw = await response.json(); addUsage(raw.usage)
    return { answers: JSON.parse(responseText(raw)).answers, latencyMs: performance.now() - started }
  } finally { clearTimeout(timeout) }
}

const pending = payload.requests.filter((row) => !cache.rows[row.key])
for (const batch of chunks(pending, 10)) {
  const result = await requestBatch(batch); const byKey = new Map(result.answers.map((row) => [row.key, row.text]))
  for (const input of batch) {
    const answer = byKey.get(input.key)
    if (!answer) throw new Error(`phase8_luna_answer_missing:${input.key}`)
    const validator = validate(answer, input.claims)
    cache.rows[input.key] = { rawAnswerSha256: sha(answer), displayedAnswer: validator.pass ? answer : input.fallback, displayedAnswerSha256: sha(validator.pass ? answer : input.fallback), validator, fallbackApplied: !validator.pass, latencyMs: result.latencyMs / batch.length }
  }
  writeFileSync(CACHE, stable(cache), { mode: 0o600 }); chmodSync(CACHE, 0o600)
}

const s5 = base.architectures.S2.map((row) => {
  if (!row.lunaRequestKey) return { ...row, architecture: "S5", lunaCalled: false }
  const luna = cache.rows[row.lunaRequestKey]
  return { ...row, architecture: "S5", answer: luna.displayedAnswer, lunaCalled: true, validatorPass: luna.validator.pass, fallbackApplied: luna.fallbackApplied, lunaLatencyMs: luna.latencyMs }
})
const output = { schemaVersion: "dna-phase8-human-architecture-results@1", model: MODEL, usage: cache.usage, architectures: { ...base.architectures, S5: s5 }, boundaries: { humanQuestionsUsedForTraining: false, goldLabelsUsedForGeneration: false, rawClinicalDataSent: false, productionAffected: false } }
writeFileSync(RESULT, stable(output), { mode: 0o600 }); chmodSync(RESULT, 0o600)
console.log(JSON.stringify({ ok: true, pendingCompleted: pending.length, usage: cache.usage, s5Cases: s5.length }))
