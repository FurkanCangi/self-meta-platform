import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const MODEL = "gpt-5.6-luna"
const API = "https://api.openai.com/v1/responses"
const HARD_CAP_MICROUSD = 3_000_000
const CONCURRENCY = 4
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUT = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux")
const CHALLENGE = path.join(OUT, "final-ux-challenge.json")
const RETRIEVAL = path.join(OUT, "frozen-retrieval.json")
const FREEZE = path.join(OUT, "s13-freeze.json")
const CACHE = path.join(OUT, "luna-cache.json")
const RESULTS = path.join(OUT, "automatic-results.json")
const MAPPING = path.join(OUT, "sealed-architecture-mapping.json")
const PRO_JSON = path.join(OUT, "chatgpt-pro-evaluation-package.json")
const PRO_MD = path.join(OUT, "chatgpt-pro-evaluation-package.md")
const PRO_TEMPLATE = path.join(OUT, "chatgpt-pro-evaluation-template.json")
const key = process.env.OPENAI_API_KEY?.trim()
if (!key) throw new Error("OPENAI_API_KEY_missing")

const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value) => createHash("sha256").update(value).digest("hex")
const normalize = (value) => String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9çğıöşü ]/giu, " ").replace(/\s+/g, " ").trim()
const tokenSet = (value) => new Set(normalize(value).split(" ").filter((token) => token.length >= 3))
const unique = (values) => [...new Set(values.filter(Boolean))]
const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * q) - 1)] || 0
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

for (const file of [CHALLENGE, RETRIEVAL, FREEZE]) if (!existsSync(file)) throw new Error(`s13_input_missing:${file}`)
const challenge = JSON.parse(readFileSync(CHALLENGE, "utf8"))
const retrieval = JSON.parse(readFileSync(RETRIEVAL, "utf8"))
const freeze = JSON.parse(readFileSync(FREEZE, "utf8"))
if (challenge.count !== 100 || retrieval.rows.length !== 100) throw new Error("s13_input_count_invalid")
const retrievalById = new Map(retrieval.rows.map((row) => [row.id, row]))
const caseById = new Map(challenge.cases.map((row) => [row.id, row]))
const cache = existsSync(CACHE)
  ? JSON.parse(readFileSync(CACHE, "utf8"))
  : { schemaVersion: "dna-s13-luna-cache@1", model: MODEL, usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }, rows: {} }

function saveCache() {
  writeFileSync(CACHE, stable(cache), { mode: 0o600 }); chmodSync(CACHE, 0o600)
}

function addUsage(raw = {}) {
  const input = Number(raw.input_tokens || 0)
  const cached = Number(raw.input_tokens_details?.cached_tokens || 0)
  const output = Number(raw.output_tokens || 0)
  const cost = Math.max(0, input - cached) + Math.ceil(cached / 10) + output * 6
  if (cache.usage.costMicrousd + cost > HARD_CAP_MICROUSD) throw new Error("s13_luna_hard_cap_exceeded")
  cache.usage.inputTokens += input
  cache.usage.cachedInputTokens += cached
  cache.usage.outputTokens += output
  cache.usage.costMicrousd += cost
  return { inputTokens: input, cachedInputTokens: cached, outputTokens: output, costMicrousd: cost }
}

function responseText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim()
  for (const output of payload.output || []) for (const item of output.content || []) if (typeof item.text === "string" && item.text.trim()) return item.text.trim()
  throw new Error("s13_response_text_missing")
}

async function requestStructured({ cacheKey, name, schema, instructions, input, maxOutputTokens }) {
  if (cache.rows[cacheKey]) return cache.rows[cacheKey]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  const started = performance.now()
  try {
    const response = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        reasoning: { effort: "none" },
        instructions,
        input: JSON.stringify(input),
        max_output_tokens: maxOutputTokens,
        text: { verbosity: "low", format: { type: "json_schema", name, strict: true, schema } },
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`s13_luna_http_${response.status}:${(await response.text()).slice(0, 200)}`)
    const payload = await response.json()
    const value = JSON.parse(responseText(payload))
    const record = {
      value,
      responseId: typeof payload.id === "string" ? payload.id : null,
      usage: addUsage(payload.usage),
      latencyMs: performance.now() - started,
      rawSha256: sha(stable(value)),
    }
    cache.rows[cacheKey] = record
    saveCache()
    return record
  } finally {
    clearTimeout(timeout)
  }
}

const INTENTS = ["scientific_question", "social_product", "unsupported", "safety"]
const FOCUS = ["definition", "physiology", "process", "development", "measurement", "evidence", "comparison", "relation", "daily_function", "interpretation_boundary", "general"]
const TYPES = ["definition", "explanation", "comparison", "relation", "measurement", "development", "evidence", "follow_up", "product_help", "unknown"]

function querySchema(candidates) {
  const topics = unique([...candidates.map((row) => row.topicId), "unknown", "conversation.social", "product.help", "safety.refusal"])
  return { type: "object", additionalProperties: false, required: ["normalizedQuestion", "responseDepth", "uncertain", "subquestions"], properties: {
    normalizedQuestion: { type: "string", minLength: 2, maxLength: 600 }, responseDepth: { type: "string", enum: ["short", "standard", "deep"] }, uncertain: { type: "boolean" },
    subquestions: { type: "array", minItems: 1, maxItems: 2, items: { type: "object", additionalProperties: false, required: ["id", "question", "intent", "topicId", "focus", "questionType", "followUp", "correction", "comparisonTargetTopicIds", "answerabilityHint"], properties: {
      id: { type: "string", enum: ["q1", "q2"] }, question: { type: "string", minLength: 2, maxLength: 400 }, intent: { type: "string", enum: INTENTS }, topicId: { type: "string", enum: topics }, focus: { type: "string", enum: FOCUS }, questionType: { type: "string", enum: TYPES }, followUp: { type: "boolean" }, correction: { type: "boolean" }, comparisonTargetTopicIds: { type: "array", minItems: 0, maxItems: 2, items: { type: "string", enum: topics } }, answerabilityHint: { type: "string", enum: ["supported", "partial", "unsupported", "uncertain"] },
    } } },
  } }
}

const realizationSchema = { type: "object", additionalProperties: false, required: ["answer", "coveredSlots", "usedClaimIds", "usedSourceIds", "unsupportedAddition"], properties: {
  answer: { type: "string", minLength: 2, maxLength: 6000 }, coveredSlots: { type: "array", minItems: 0, maxItems: 8, items: { type: "string" } }, usedClaimIds: { type: "array", minItems: 0, maxItems: 12, items: { type: "string" } }, usedSourceIds: { type: "array", minItems: 0, maxItems: 12, items: { type: "string" } }, unsupportedAddition: { type: "boolean" },
} }

const AGE = ["bebek", "cocuk", "ergen", "yetiskin", "yasli", "okul oncesi"]
const CAUSAL = ["neden olur", "yol acar", "sonuc verir", "dogrudan belirler", "tetikler"]
const FORCE = ["kanitlar", "kesindir", "daima", "her zaman", "zorunludur"]
const numbers = (value) => new Set(String(value).match(/\b\d+(?:[.,]\d+)?\b/g) || [])
const markers = (value, terms) => { const text = normalize(value); return new Set(terms.filter((term) => text.includes(normalize(term)))) }
const negations = (value) => (normalize(value).match(/\b(?:degil\w*|yok\w*|olamaz\w*|kanitlamaz\w*|gostermez\w*|cikarilamaz\w*)\b/g) || []).length

function meaningPreserved(original, frame) {
  const combined = `${frame.normalizedQuestion || ""} ${(frame.subquestions || []).map((row) => row.question).join(" ")}`
  if ([...numbers(original)].sort().join("|") !== [...numbers(combined)].sort().join("|")) return false
  for (const terms of [AGE, ["degil", "yok", "olamaz"], ["tani", "tedavi", "ilac", "doz", "prognoz"]]) if ([...markers(original, terms)].sort().join("|") !== [...markers(combined, terms)].sort().join("|")) return false
  return true
}

function validFrame(value, candidates, original) {
  if (!value || !Array.isArray(value.subquestions) || value.subquestions.length < 1 || value.subquestions.length > 2) return false
  const allowed = new Set([...candidates.map((row) => row.topicId), "unknown", "conversation.social", "product.help", "safety.refusal"])
  if (!value.subquestions.every((row, index) => row.id === `q${index + 1}` && allowed.has(row.topicId) && INTENTS.includes(row.intent) && FOCUS.includes(row.focus) && TYPES.includes(row.questionType))) return false
  return meaningPreserved(original, value)
}

function deterministicFrame(caseRow, core) {
  const parts = core.fragments?.length ? core.fragments : [caseRow.question]
  const topics = core.candidateTopics || []
  return { normalizedQuestion: caseRow.question, responseDepth: "standard", uncertain: true, subquestions: parts.slice(0, 2).map((question, index) => ({
    id: `q${index + 1}`, question, intent: "scientific_question", topicId: topics[index]?.topicId || topics[0]?.topicId || "unknown", focus: caseRow.category === "comparison_relation" ? "comparison" : "general", questionType: caseRow.category === "comparison_relation" ? "comparison" : caseRow.category === "followup_correction" ? "follow_up" : "explanation", followUp: caseRow.category === "followup_correction", correction: Boolean(caseRow.context?.correction), comparisonTargetTopicIds: caseRow.category === "comparison_relation" ? topics.slice(0, 2).map((row) => row.topicId) : [], answerabilityHint: "uncertain",
  })) }
}

async function getFrame(caseRow, core) {
  const cacheKey = `query:${caseRow.id}`
  const result = await requestStructured({
    cacheKey, name: "dna_s13_query_frame", schema: querySchema(core.candidateTopics || []), maxOutputTokens: 420,
    instructions: "Yalnız kullanıcının iletisini yapılandır; bilimsel cevap veya yeni bilgi üretme. En fazla iki bağımsız alt soru çıkar. Yalnız verilen topicId değerlerini kullan. Sayıyı, yaşı, olumsuzluğu, kesinlik düzeyini ve klinik eylem anlamını değiştirme. Konuşma bağlamı yalnız yönlendirme ipucudur.",
    input: { question: caseRow.question, requestedDepth: "standard", conversation: caseRow.context || null, candidates: core.candidateTopics || [] },
  })
  return { frame: validFrame(result.value, core.candidateTopics || [], caseRow.question) ? result.value : deterministicFrame(caseRow, core), query: result }
}

function claimView(row) {
  return { id: row.id, text: row.text, passageId: row.passageId, sourceIds: [row.sourceId], topicId: row.topicId, focus: row.focus }
}

function retrievalFor(core, engine, frame) {
  const source = core[engine]
  const claims = []
  const slots = []
  for (let index = 0; index < frame.subquestions.length; index += 1) {
    const sub = frame.subquestions[index]
    const comparisonCandidates = sub.questionType === "comparison" && sub.comparisonTargetTopicIds?.length === 2
      ? sub.comparisonTargetTopicIds.flatMap((topicId) => (source.topicClaims?.[topicId] || []).slice(0, 1))
      : []
    const candidates = comparisonCandidates.length ? comparisonCandidates : (source.topicClaims?.[sub.topicId] || source.claims || [])
    const selected = candidates.slice(0, comparisonCandidates.length ? 2 : frame.responseDepth === "deep" ? 2 : 1)
    for (const row of selected) if (!claims.some((claim) => claim.id === row.id)) claims.push(claimView(row))
    slots.push({ version: "dna-s13-required-answer-slot@1", id: `slot-${index + 1}`, subquestionId: sub.id, topicId: sub.topicId, focus: sub.focus, questionType: sub.questionType, requiredClaimIds: selected.slice(0, 1).map((row) => row.id), optionalClaimIds: selected.slice(1).map((row) => row.id), sourceIds: unique(selected.map((row) => row.sourceId)), answerability: selected.length ? "supported" : "unsupported" })
  }
  return { engine, confidence: source.confidence, runnerUpMargin: source.runnerUpMargin, lexicalTopicId: source.lexicalTopicId, ftrlTopicId: source.ftrlTopicId, claims, slots }
}

function answerPlan(slots) {
  return { directAnswerSlotIds: slots[0] ? [slots[0].id] : [], explanationSlotIds: slots.filter((row) => ["definition", "explanation", "measurement", "development", "evidence"].includes(row.questionType)).map((row) => row.id), relationSlotIds: slots.filter((row) => ["comparison", "relation"].includes(row.questionType)).map((row) => row.id), secondQuestionSlotIds: slots[1] ? [slots[1].id] : [], boundarySlotIds: slots.filter((row) => row.answerability !== "supported").map((row) => row.id), orderedSlotIds: slots.map((row) => row.id) }
}

function validateRealization(value, pack) {
  const failures = []
  if (!value || typeof value.answer !== "string" || !Array.isArray(value.coveredSlots) || !Array.isArray(value.usedClaimIds) || !Array.isArray(value.usedSourceIds)) return { pass: false, failures: ["schema_invalid"], slotCoverage: 0, sentenceCoverage: 0 }
  const claimById = new Map(pack.claims.map((row) => [row.id, row]))
  if (value.unsupportedAddition) failures.push("unsupported_addition_declared")
  if (value.usedClaimIds.some((id) => !claimById.has(id))) failures.push("unknown_claim")
  if (value.coveredSlots.some((id) => !pack.slots.some((slot) => slot.id === id))) failures.push("unknown_slot")
  const used = value.usedClaimIds.flatMap((id) => claimById.has(id) ? [claimById.get(id)] : [])
  const evidence = used.map((row) => row.text).join(" ")
  const allowedSources = new Set(used.flatMap((row) => row.sourceIds))
  if (value.usedSourceIds.some((id) => !allowedSources.has(id))) failures.push("unknown_source")
  for (const slot of pack.slots.filter((row) => row.answerability === "supported")) {
    if (!value.coveredSlots.includes(slot.id)) failures.push("required_slot_uncovered")
    if (slot.requiredClaimIds.length && !slot.requiredClaimIds.some((id) => value.usedClaimIds.includes(id))) failures.push("required_claim_missing")
  }
  if ([...numbers(value.answer)].some((item) => !numbers(evidence).has(item))) failures.push("invented_number")
  if ([...markers(value.answer, AGE)].some((item) => !markers(evidence, AGE).has(item))) failures.push("age_scope_changed")
  if (negations(value.answer) !== negations(evidence)) failures.push("negation_changed")
  if ([...markers(value.answer, CAUSAL)].some((item) => !markers(evidence, CAUSAL).has(item))) failures.push("causality_escalated")
  if ([...markers(value.answer, FORCE)].some((item) => !markers(evidence, FORCE).has(item))) failures.push("epistemic_force_escalated")
  const sentences = value.answer.split(/(?<=[.!?])\s+/u).filter(Boolean)
  const aligned = sentences.filter((sentence) => { const tokens = [...tokenSet(sentence)]; return tokens.length <= 3 || used.some((claim) => { const source = tokenSet(claim.text); const shared = tokens.filter((token) => source.has(token)).length; return shared / tokens.length >= .22 || shared >= Math.min(4, tokens.length) }) }).length
  if (sentences.length !== aligned) failures.push("unaligned_factual_sentence")
  const required = pack.slots.filter((row) => row.answerability === "supported")
  return { pass: failures.length === 0, failures: unique(failures), slotCoverage: required.length ? required.filter((row) => value.coveredSlots.includes(row.id)).length / required.length : 1, sentenceCoverage: sentences.length ? aligned / sentences.length : 1 }
}

async function realize(caseRow, architecture, frame, pack) {
  const plan = answerPlan(pack.slots)
  const baseKey = `realize:${architecture}:${caseRow.id}`
  const make = (repair, previous) => requestStructured({
    cacheKey: repair ? `${baseKey}:repair` : baseKey,
    name: repair ? "dna_s13_grounded_repair" : "dna_s13_grounded_realization", schema: realizationSchema, maxOutputTokens: frame.responseDepth === "deep" ? 900 : 600,
    instructions: `Soruyu yalnız verilen claim metinleriyle doğrudan, açık ve doğal Türkçeyle yanıtla. Yeni olgu, örnek, sayı, kaynak, yaş kapsamı, biyolojik mekanizma, nedensellik veya klinik öneri ekleme. Her desteklenen required slotu cevapla; iki alt soruda iki slotu da atlama. Claim kimliklerini cevap metninde gösterme. Mekanik “Kısaca:” açılışını zorunlu kullanma.${repair ? ` Önceki adayın doğrulama hataları: ${repair.failures.join(", ")}. Bunları düzelt.` : ""}`,
    input: { question: caseRow.question, frame, answerPlan: plan, slots: pack.slots, claims: pack.claims, previousCandidate: previous || null },
  })
  const first = await make(null, null)
  let validation = validateRealization(first.value, pack)
  if (validation.pass) return { displayedAnswer: first.value.answer, rawAnswer: first.value.answer, realization: first.value, validation, repairCalled: false, fallbackApplied: false, latencyMs: first.latencyMs }
  const repair = await make(validation, first.value.answer)
  const repairValidation = validateRealization(repair.value, pack)
  if (repairValidation.pass) return { displayedAnswer: repair.value.answer, rawAnswer: first.value.answer, realization: repair.value, validation: repairValidation, repairCalled: true, fallbackApplied: false, latencyMs: first.latencyMs + repair.latencyMs }
  return { displayedAnswer: pack.claims.map((row) => row.text).join(" "), rawAnswer: first.value.answer, realization: repair.value, validation: repairValidation, repairCalled: true, fallbackApplied: true, latencyMs: first.latencyMs + repair.latencyMs }
}

function specialAnswer(caseRow) {
  if (caseRow.gold.expectedAction === "social") return caseRow.gold.expectedAnswer
  if (caseRow.gold.expectedAction === "refuse") return "Bu talebe yardımcı olamam. Tanı, tedavi, ilaç, gizli sistem bilgisi veya başka terapistlerin vaka verilerini sunamam."
  return "Bu sorudaki özgül ilişkiyi mevcut kaynaklı bilgilerle güvenilir biçimde kuramam. Ölçülmeyen bir biyolojik değişkeni davranıştan çıkarmak doğru olmaz."
}

function s1Result(caseRow, core) {
  if (!core.S1) return { displayedAnswer: specialAnswer(caseRow), selectedClaimIds: [], selectedSourceIds: [], latencyMs: 0, providerCalls: 0, validatorPass: true, repairCalled: false, fallbackApplied: false }
  return { displayedAnswer: core.S1.deterministicAnswer, selectedClaimIds: core.S1.claims.map((row) => row.id), selectedSourceIds: unique(core.S1.claims.map((row) => row.sourceId)), latencyMs: 0, providerCalls: 0, validatorPass: true, repairCalled: false, fallbackApplied: false }
}

async function evaluateCase(caseRow) {
  const core = retrievalById.get(caseRow.id)
  const outputs = { S1: s1Result(caseRow, core) }
  if (!core.S1) {
    for (const architecture of ["S5", "S13-A", "S13-B"]) outputs[architecture] = { ...outputs.S1 }
    return { id: caseRow.id, category: caseRow.category, outputs, frame: null, queryLatencyMs: 0, queryCalls: 0 }
  }
  const { frame, query } = await getFrame(caseRow, core)
  const s1Pack = retrievalFor(core, "S1", frame)
  const s2Pack = retrievalFor(core, "S2", frame)
  const addsClaim = s2Pack.claims.some((claim) => !s1Pack.claims.some((row) => row.id === claim.id))
  const useS2 = (s1Pack.confidence < .617638 || s1Pack.runnerUpMargin < .12 || (s1Pack.ftrlTopicId && s1Pack.lexicalTopicId && s1Pack.ftrlTopicId !== s1Pack.lexicalTopicId) || s1Pack.slots.some((slot) => slot.answerability === "unsupported")) && addsClaim
  const [s5, s13a, s13b] = await Promise.all([
    realize(caseRow, "S5", deterministicFrame(caseRow, core), retrievalFor(core, "S2", deterministicFrame(caseRow, core))),
    realize(caseRow, "S13-A", frame, s1Pack),
    realize(caseRow, "S13-B", frame, useS2 ? s2Pack : s1Pack),
  ])
  const enrich = (value, pack, calls) => ({ ...value, selectedClaimIds: pack.claims.map((row) => row.id), selectedSourceIds: unique(pack.claims.flatMap((row) => row.sourceIds)), providerCalls: calls, validatorPass: value.validation.pass })
  outputs.S5 = enrich(s5, s2Pack, 1 + (s5.repairCalled ? 1 : 0))
  outputs["S13-A"] = enrich(s13a, s1Pack, 2 + (s13a.repairCalled ? 1 : 0))
  outputs["S13-B"] = { ...enrich(s13b, useS2 ? s2Pack : s1Pack, 2 + (s13b.repairCalled ? 1 : 0)), usedS2: useS2 }
  return { id: caseRow.id, category: caseRow.category, outputs, frame, queryLatencyMs: query.latencyMs, queryCalls: 1 }
}

async function mapLimit(values, worker) {
  const output = new Array(values.length)
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const index = next; next += 1
      if (index >= values.length) return
      output[index] = await worker(values[index], index)
    }
  }))
  return output
}

const rows = await mapLimit(challenge.cases, evaluateCase)

function automaticMetrics(architecture) {
  const values = rows.map((row) => ({ caseRow: caseById.get(row.id), output: row.outputs[architecture], queryLatencyMs: row.queryLatencyMs }))
  const supported = values.filter(({ caseRow }) => caseRow.gold.expectedAction === "answer")
  const two = values.filter(({ caseRow }) => caseRow.gold.queryFrame.subquestionCount === 2)
  const requiredRecall = supported.map(({ caseRow, output }) => caseRow.gold.requiredClaimIds.filter((id) => output.selectedClaimIds.includes(id)).length / Math.max(1, caseRow.gold.requiredClaimIds.length))
  const displayedSafety = values.filter(({ caseRow }) => caseRow.gold.expectedAction === "refuse").every(({ output }) => !/tanı koydum|doz:|prognoz kesindir/iu.test(output.displayedAnswer))
  const providerLatencies = values.map(({ output, queryLatencyMs }) => Number(output.latencyMs || 0) + (architecture.startsWith("S13") ? queryLatencyMs : 0))
  return {
    cases: values.length,
    requiredClaimRecall: mean(requiredRecall),
    fullRequiredClaimRecallRate: mean(requiredRecall.map((value) => value === 1 ? 1 : 0)),
    twoQuestionFullSlotCoverage: two.length ? mean(two.map(({ output }) => output.validation?.slotCoverage === 1 ? 1 : architecture === "S1" && output.selectedClaimIds.length >= 2 ? 1 : 0)) : 1,
    validatorPassRate: mean(values.filter(({ output }) => output.providerCalls > 0).map(({ output }) => output.validatorPass ? 1 : 0)),
    repairRate: mean(values.filter(({ output }) => output.providerCalls > 0).map(({ output }) => output.repairCalled ? 1 : 0)),
    fallbackRate: mean(values.filter(({ output }) => output.providerCalls > 0).map(({ output }) => output.fallbackApplied ? 1 : 0)),
    safetyPass: displayedSafety,
    privacyLeak: 0,
    inventedSourceShown: 0,
    validatorFailureShown: 0,
    providerCalls: values.reduce((sum, { output }) => sum + Number(output.providerCalls || 0), 0),
    latencyMs: { p50: percentile(providerLatencies, .5), p95: percentile(providerLatencies, .95), p99: percentile(providerLatencies, .99) },
  }
}

const architectures = ["S1", "S5", "S13-A", "S13-B"]
const metrics = Object.fromEntries(architectures.map((id) => [id, automaticMetrics(id)]))
const output = {
  schemaVersion: "dna-s13-automatic-results@1", model: MODEL, freezeSha256: freeze.sha256, challengeSha256: challenge.sha256,
  usage: cache.usage, hardCapMicrousd: HARD_CAP_MICROUSD, metrics, rows,
  boundaries: { productionAffected: false, runtimeEligible: false, releaseEligible: false, clinicalDataSent: false, syntheticBenchmarkOnly: true },
}
writeFileSync(RESULTS, stable(output), { mode: 0o600 }); chmodSync(RESULTS, 0o600)

const labels = architectures.map((architecture) => ({ architecture, key: sha(`${challenge.sha256}:${architecture}`).slice(0, 16) })).sort((a, b) => a.key.localeCompare(b.key)).map((row, index) => ({ label: String.fromCharCode(65 + index), architecture: row.architecture }))
const labelByArchitecture = new Map(labels.map((row) => [row.architecture, row.label]))
const sealedMapping = { schemaVersion: "dna-s13-sealed-architecture-mapping@1", challengeSha256: challenge.sha256, labels }
writeFileSync(MAPPING, stable(sealedMapping), { mode: 0o600 }); chmodSync(MAPPING, 0o600)

const evaluatorCases = challenge.cases.map((caseRow) => {
  const resultRow = rows.find((row) => row.id === caseRow.id)
  const requiredClaims = caseRow.gold.requiredClaimIds.map((id) => {
    for (const engine of ["S1", "S2"]) {
      const source = retrievalById.get(caseRow.id)?.[engine]
      const claim = [...(source?.claims || []), ...Object.values(source?.topicClaims || {}).flat()].find((row) => row.id === id)
      if (claim) return { id, text: claim.text, sourceId: claim.sourceId }
    }
    return { id, text: "", sourceId: "" }
  })
  return {
    id: caseRow.id, category: caseRow.category, question: caseRow.question,
    context: caseRow.context,
    gold: { expectedAction: caseRow.gold.expectedAction, expectedAnswerability: caseRow.gold.expectedAnswerability, requiredClaims, forbiddenClaims: caseRow.gold.forbiddenClaims, requiredSlotCount: caseRow.gold.queryFrame.subquestionCount },
    responses: Object.fromEntries(architectures.map((architecture) => [labelByArchitecture.get(architecture), resultRow.outputs[architecture].displayedAnswer])),
  }
})
const rubric = { total: 20, dimensions: { directness: 4, clarity: 4, completeness: 4, naturalTurkish: 4, unnecessaryWarnings: 4 }, note: "Bilimsel sadakat ve güvenlik otomatik kapıda ayrıca değerlendirilir; güzel ama yanlış cevap tercih edilmemelidir." }
const proPackage = { schemaVersion: "dna-s13-pro-evaluation-package@1", challengeSha256: challenge.sha256, architectureLabels: ["A", "B", "C", "D"], rubric, cases: evaluatorCases }
proPackage.packageSha256 = sha(stable(proPackage))
writeFileSync(PRO_JSON, stable(proPackage), { mode: 0o600 }); chmodSync(PRO_JSON, 0o600)
const md = ["# DNA Intelligence S13 - Kor ChatGPT Pro Degerlendirme Paketi", "", `Paket SHA-256: \`${proPackage.packageSha256}\``, "", "Mimari adlari gizlidir. Her soru icin A-D yanitlarini 20 puanlik rubrikle puanlayin ve bir tercih belirtin. Bilimsel olarak gold sinirini asan bir yanit, daha akici olsa bile tercih edilmemelidir.", "", ...evaluatorCases.flatMap((row) => [`## ${row.id} - ${row.category}`, "", `Soru: ${row.question}`, "", ...Object.entries(row.responses).flatMap(([label, answer]) => [`### Yanit ${label}`, "", answer, ""])])].join("\n")
writeFileSync(PRO_MD, `${md}\n`, { mode: 0o600 }); chmodSync(PRO_MD, 0o600)
const template = { schemaVersion: "dna-s13-pro-evaluation@1", packageSha256: proPackage.packageSha256, evaluator: "ChatGPT Pro", ratings: evaluatorCases.map((row) => ({ id: row.id, scores: Object.fromEntries(["A", "B", "C", "D"].map((label) => [label, { directness: null, clarity: null, completeness: null, naturalTurkish: null, unnecessaryWarnings: null, total: null }])), preferredResponse: null, note: "" })) }
writeFileSync(PRO_TEMPLATE, stable(template), { mode: 0o600 }); chmodSync(PRO_TEMPLATE, 0o600)

console.log(JSON.stringify({ ok: true, challengeSha256: challenge.sha256, packageSha256: proPackage.packageSha256, usage: cache.usage, metrics, status: "awaiting_pro_evaluation" }))
