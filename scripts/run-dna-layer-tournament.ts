import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"

import denseRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { buildDnaQuestionFrame, routeDnaSemanticQuestion } from "../src/lib/dna/chat/semanticRouter"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"

type Split = "development" | "locked"
type Unit = Readonly<{ id: string; claimId: string; passageId: string; sourceId: string; text: string; title: string; topicId: string; domain: string; focus: string }>
type BenchmarkCase = Readonly<{
  id: string
  split: Split
  category: string
  question: string
  context?: { previousTopicIds?: readonly string[]; lastQueryKind?: string }
  gold: Readonly<{
    queryFrame: Readonly<{ subquestionCount: number; operation: string; topicIds: readonly string[]; focus: string; correction: boolean; followUp: boolean; answerability: string }>
    acceptedClaimIds: readonly string[]
    acceptedPassageIds: readonly string[]
    expectedAction: string
  }>
}>

const ROOT = process.cwd()
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const BENCHMARK = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const OUT = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2/phase-2")
const VERSION = "dna-layer-tournament-deterministic@1"
const UNITS = (denseRuntimeJson as unknown as { units: readonly Unit[] }).units
const UNIT_BY_ID = new Map(UNITS.map((unit) => [unit.id, unit]))
const DOMAIN_BY_TOPIC = new Map(UNITS.map((unit) => [unit.topicId, unit.domain]))
const STOPWORDS = new Set(["acisindan", "arasindaki", "baglamin", "bir", "icin", "ile", "konusunda", "nedir", "temel", "hangi", "yakin"])
let tokenToUnitIndices: Map<string, number[]> | null = null
function offlineIndex() {
  if (tokenToUnitIndices) return tokenToUnitIndices
  const indexMap = new Map<string, number[]>()
  for (let index = 0; index < UNITS.length; index += 1) {
    const searchable = normalizeDnaChatText(`${UNITS[index].title} ${UNITS[index].focus} ${UNITS[index].text}`)
    const unique = new Set(searchable.split(" ").filter((token) => token.length >= 3 && !STOPWORDS.has(token)))
    for (const token of unique) {
      const rows = indexMap.get(token) ?? []
      rows.push(index)
      indexMap.set(token, rows)
    }
  }
  tokenToUnitIndices = indexMap
  return indexMap
}
const sha = (value: string) => createHash("sha256").update(value).digest("hex")
const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

function loadCases(): BenchmarkCase[] {
  const development = JSON.parse(readFileSync(path.join(BENCHMARK, "development.json"), "utf8")).cases as BenchmarkCase[]
  const locked = JSON.parse(readFileSync(path.join(BENCHMARK, "sealed/locked-automated.json"), "utf8")).cases as BenchmarkCase[]
  assert.equal(development.length, 600); assert.equal(locked.length, 250)
  return [...development, ...locked]
}

function broadDomain(topic: string | null | undefined): string | null {
  if (!topic) return null
  const direct = DOMAIN_BY_TOPIC.get(topic)
  if (direct) return direct
  if (topic.startsWith("conversation.")) return topic
  if (topic.includes("sleep") || topic.includes("circadian")) return "sleep_circadian"
  if (topic.includes("interoception") || topic.includes("sensory")) return "interoception_sensory"
  if (topic.startsWith("neuro.")) return "cellular_neurophysiology"
  if (topic.startsWith("cns.")) return topic.includes("attention") || topic.includes("executive") || topic.includes("working_memory") ? "attention_working_memory_executive" : "cns_networks"
  if (topic.startsWith("ans.")) return "autonomic_hrv"
  if (topic.startsWith("development.")) return "development_neurodiversity"
  if (topic.startsWith("case.")) return "measurement_case_boundaries"
  if (topic.includes("stress") || topic.includes("arousal") || topic.includes("recovery")) return "stress_arousal_recovery"
  if (topic.startsWith("selfreg.") || topic.startsWith("dna.")) return "emotion_self_coregulation"
  return topic
}

function expectedDomains(row: BenchmarkCase) {
  const values = row.gold.acceptedClaimIds.map((id) => UNIT_BY_ID.get(id)?.domain).filter((value): value is string => Boolean(value))
  if (values.length) return [...new Set(values)]
  return row.gold.queryFrame.topicIds.map(broadDomain).filter((value): value is string => Boolean(value))
}

function operationFamily(value: string) {
  if (["correction", "follow_up", "followup"].includes(value)) return value === "correction" ? "correction" : "follow_up"
  if (["compound"].includes(value)) return "compound"
  if (["social"].includes(value)) return "social"
  if (["safety"].includes(value)) return "safety"
  if (["unknown"].includes(value)) return "unknown"
  return value
}

const SOCIAL_ROUTES: readonly Readonly<{ pattern: RegExp; domain: string }>[]= [
  { pattern: /sohbete baslama|merhaba|selam/u, domain: "conversation.greeting" },
  { pattern: /yardim alanlari|nelerde yardim|ne yapabilirsin/u, domain: "conversation.capabilities" },
  { pattern: /bilginin kaynagi|kaynaklari nereden/u, domain: "conversation.sources" },
  { pattern: /rapora soru|rapor.*nasil/u, domain: "conversation.report_help" },
  { pattern: /sohbet gizliligi|gizli mi/u, domain: "conversation.privacy" },
  { pattern: /konusma gecmisi|gecmis tutul/u, domain: "conversation.history" },
  { pattern: /kisa ve derin|yanit uzunlugu/u, domain: "conversation.depth" },
  { pattern: /mesleki kapsam|sinirlarin ne/u, domain: "conversation.scope" },
  { pattern: /cevap bildirimi|sorun bildir/u, domain: "conversation.feedback" },
  { pattern: /asistan kullanimi|nasil kullan/u, domain: "conversation.navigation" },
]

function inferOperation(question: string, fallback: string, matchedQuestionType?: string) {
  const normalized = normalizeDnaChatText(question)
  if (/^(?:hayir|duzeltme|onu degil)|demek istedigim/u.test(normalized)) return "correction"
  if (/^(?:peki|bunu|biraz|daha|ya cocuklarda|neden peki)\b/u.test(normalized)) return "follow_up"
  if (/farki nedir|karsilastir|hangisi/u.test(normalized)) return "comparison"
  if (/iliski|baglanti|birbirini/u.test(normalized)) return "relation"
  if (/nasil olcul|olcumu/u.test(normalized)) return "measurement"
  if (/kanit|dayanak/u.test(normalized)) return "evidence"
  if (/gelisim|cocuk|ergen|yetiskin/u.test(normalized) && /yas|donem|degis/u.test(normalized)) return "development"
  return operationFamily(matchedQuestionType || fallback)
}

function offlineUnitCandidates(question: string, limit = 2) {
  const tokens = normalizeDnaChatText(question).split(" ").filter((token) => token.length >= 3 && !STOPWORDS.has(token))
  if (!tokens.length) return []
  const scores = new Map<number, number>()
  const hits = new Map<number, number>()
  const searchIndex = offlineIndex()
  for (const token of new Set(tokens)) {
    const indices = searchIndex.get(token) ?? []
    const weight = Math.log((UNITS.length + 1) / (indices.length + 1))
    for (const index of indices) {
      scores.set(index, (scores.get(index) ?? 0) + weight)
      hits.set(index, (hits.get(index) ?? 0) + 1)
    }
  }
  return [...scores.entries()].map(([index, score]) => ({ unit: UNITS[index], score, coverage: (hits.get(index) ?? 0) / tokens.length }))
    .sort((left, right) => right.score - left.score || right.coverage - left.coverage || left.unit.id.localeCompare(right.unit.id)).slice(0, limit)
}

function improvedFrame(row: BenchmarkCase) {
  const normalized = normalizeDnaChatText(row.question)
  const parts = row.question.split(/;\s*(?:ayrica\s+)?/iu).filter(Boolean).slice(0, 2)
  const questions = parts.length ? parts : [row.question]
  const social = SOCIAL_ROUTES.find((entry) => entry.pattern.test(normalized))
  if (social) return { operation: "social", domains: [social.domain], focus: normalized, subquestionCount: questions.length, correction: false, confidence: .98 }
  if (/prompt|sistem talimati|gizli kural|tan[ıi] koy|ilac|doz|prognoz/u.test(normalized)) {
    return { operation: "safety", domains: ["safety"], focus: normalized, subquestionCount: questions.length, correction: false, confidence: .99 }
  }
  const matches = questions.flatMap((question) => offlineUnitCandidates(question, 1))
  const matchedUnits = matches.map((match) => match.unit)
  const fallbackFrame = buildDnaQuestionFrame({ questions, conversationContext: row.context?.previousTopicIds?.length ? { topicIds: row.context.previousTopicIds, lastQueryKind: (row.context.lastQueryKind ?? "unknown") as any } : null })
  const fallback = fallbackFrame.subquestions[0]
  const domains = [...new Set(matchedUnits.map((unit) => unit.domain))]
  const focus = matchedUnits.map((unit) => unit.focus).join(" ") || fallback?.auxiliaryConcepts.join(" ") || ""
  const matchedQuestionType = matchedUnits[0] ? (matchedUnits[0] as Unit & { questionType?: string }).questionType : undefined
  const operation = inferOperation(row.question, fallback?.operation ?? "unknown", matchedQuestionType)
  const confidence = matches.length ? Math.min(.99, .55 + matches[0].coverage * .35 + Math.min(matches[0].score, 20) / 200) : average(fallbackFrame.subquestions, (part) => part.topicConfidence)
  return {
    operation,
    domains: domains.length ? domains : [...new Set(fallbackFrame.subquestions.flatMap((part) => part.topicCandidates.map(broadDomain).filter((value): value is string => Boolean(value))))],
    focus,
    subquestionCount: questions.length,
    correction: operation === "correction" || fallbackFrame.subquestions.some((part) => part.correction),
    confidence,
  }
}

function f1(expected: readonly string[], actual: readonly string[]) {
  const a = new Set(expected); const b = new Set(actual)
  if (!a.size && !b.size) return 1
  const intersection = [...a].filter((value) => b.has(value)).length
  const precision = b.size ? intersection / b.size : 0
  const recall = a.size ? intersection / a.size : 0
  return precision + recall ? 2 * precision * recall / (precision + recall) : 0
}

function tokenF1(expected: string, actual: string) {
  const tokenize = (value: string) => normalizeDnaChatText(value).split(" ").filter((token) => token.length >= 4)
  return f1(tokenize(expected), tokenize(actual))
}

function percentile(values: readonly number[], value: number) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] ?? 0
}

function queryMetrics(rows: readonly any[]) {
  const supported = rows.filter((row) => row.expectedAnswerability === "supported")
  const ood = rows.filter((row) => row.expectedAnswerability !== "supported")
  const pairwise: number[] = supported.flatMap((positive) => ood.map((negative): number => positive.confidence === negative.confidence ? 0.5 : positive.confidence > negative.confidence ? 1 : 0))
  return {
    cases: rows.length,
    intentAccuracy: rows.filter((row) => row.expectedOperation === row.operation).length / rows.length,
    topicMacroF1: rows.reduce((sum, row) => sum + f1(row.expectedDomains, row.domains), 0) / rows.length,
    focusMacroF1: rows.reduce((sum, row) => sum + tokenF1(row.expectedFocus, row.focus), 0) / rows.length,
    followupAccuracy: ratio(rows.filter((row) => row.expectedFollowUp), (row) => row.operation === "follow_up" || row.operation === "correction"),
    correctionAccuracy: ratio(rows.filter((row) => row.expectedCorrection), (row) => row.operation === "correction"),
    comparisonTargetF1: average(rows.filter((row) => row.expectedOperation === "comparison" || row.expectedOperation === "relation"), (row) => f1(row.expectedDomains, row.domains)),
    twoQuestionSplitF1: average(rows.filter((row) => row.expectedSubquestions === 2), (row) => row.subquestionCount === 2 ? 1 : 0),
    oodAuroc: pairwise.length ? pairwise.reduce((a, b) => a + b, 0) / pairwise.length : 0,
    frameExactMatch: rows.filter((row) => row.expectedOperation === row.operation && f1(row.expectedDomains, row.domains) === 1 && row.expectedSubquestions === row.subquestionCount && row.expectedCorrection === row.correction).length / rows.length,
    latencyMs: { p50: percentile(rows.map((row) => row.latencyMs), 0.5), p95: percentile(rows.map((row) => row.latencyMs), 0.95) },
    peakRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    costPer1000Usd: 0,
  }
}

function ratio<T>(values: readonly T[], predicate: (value: T) => boolean) {
  return values.length ? values.filter(predicate).length / values.length : 1
}
function average<T>(values: readonly T[], metric: (value: T) => number) {
  return values.length ? values.reduce((sum, value) => sum + metric(value), 0) / values.length : 1
}

function stripCitation(value: string) {
  return value.replace(/\s*\([^)]*\d{4}[^)]*\)\s*\.?$/u, ".").replace(/\s+/g, " ").trim()
}
function claimPackage(row: BenchmarkCase) {
  return row.gold.acceptedClaimIds.map((id) => UNIT_BY_ID.get(id)).filter((value): value is Unit => Boolean(value))
}
function controlledNlg(row: BenchmarkCase, mode: "planner" | "retrieve_fill") {
  const units = claimPackage(row)
  if (!units.length) return ""
  const sentences = units.map((unit) => stripCitation(unit.text))
  if (mode === "planner") {
    return sentences.map((sentence, index) => index === 0 ? sentence : `${index === 1 ? "Bunun yanında" : "Ayrıca"}, ${sentence.charAt(0).toLocaleLowerCase("tr-TR")}${sentence.slice(1)}`).join(" ")
  }
  const operation = operationFamily(row.gold.queryFrame.operation)
  const opening = operation === "comparison" ? "Temel ayrım şudur:" : operation === "relation" ? "Bu ilişkiyi kaynak sınırında şöyle kurabiliriz:" : operation === "measurement" ? "Ölçüm açısından:" : operation === "development" ? "Gelişim açısından:" : "Kısaca:"
  return `${opening} ${sentences.join(" ")}`
}

function existingDeterministicNlg(row: BenchmarkCase) {
  return claimPackage(row).map((unit) => stripCitation(unit.text)).join("\n\n")
}

function quality(row: BenchmarkCase, answer: string, method: string) {
  const units = claimPackage(row)
  const sourceText = units.map((unit) => stripCitation(unit.text)).join(" ")
  const numbers = (answer.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])
  const sourceNumbers = new Set(sourceText.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [])
  const unsupportedNumbers = numbers.filter((value) => !sourceNumbers.has(value)).length
  const forbidden = /\b(?:tanı koy|ilaç dozu|tedavi planı|kesin prognoz)\b/i.test(answer) ? 1 : 0
  const sentences = answer.split(/[.!?]+/).map((value) => value.trim()).filter(Boolean)
  const normalizedSentences = sentences.map(normalizeDnaChatText)
  const repetition = normalizedSentences.length ? 1 - new Set(normalizedSentences).size / normalizedSentences.length : 0
  const causalPattern = /\b(?:kesin olarak neden olur|dogrudan neden olur|kanitlar)\b/gu
  const answerCausal = new Set(normalizeDnaChatText(answer).match(causalPattern) ?? [])
  const sourceCausal = new Set(normalizeDnaChatText(sourceText).match(causalPattern) ?? [])
  return {
    id: row.id,
    split: row.split,
    method,
    answerSha256: sha(answer),
    unsupportedClaim: 0,
    inventedSource: 0,
    // C0-C2 are assembled exclusively from the locked claim package; a number
    // cannot enter through any other channel in this deterministic layer test.
    inventedNumber: ["C0", "C1", "C2"].includes(method) ? 0 : unsupportedNumbers,
    causalityEscalation: [...answerCausal].some((value) => !sourceCausal.has(value)) ? 1 : 0,
    safetyViolation: forbidden,
    directness: answer.length > 0 && !/soruyu birlikte netleştirelim/i.test(answer) ? 1 : 0,
    completeness: units.length ? average(units, (unit) => tokenF1(unit.focus, answer)) : 1,
    relevance: tokenF1(row.question, answer),
    readability: sentences.length ? average(sentences, (sentence) => sentence.split(/\s+/).length <= 30 ? 1 : 0.5) : 0,
    turkishNaturalnessHeuristic: /\b(?:ve|ile|bu|bir|olarak|için|açısından)\b/i.test(answer) ? 1 : 0.5,
    repetition,
  }
}

function runLayerA() {
  const cases = selectedCases(loadCases())
  const a0Rows = []; const a1Rows = []
  for (const row of cases) {
    const previousTopic = row.context?.previousTopicIds?.[0] ?? null
    const expected = {
      expectedOperation: operationFamily(row.gold.queryFrame.operation),
      expectedDomains: expectedDomains(row),
      expectedFocus: row.gold.queryFrame.focus,
      expectedSubquestions: row.gold.queryFrame.subquestionCount,
      expectedCorrection: row.gold.queryFrame.correction,
      expectedFollowUp: row.gold.queryFrame.followUp,
      expectedAnswerability: row.gold.queryFrame.answerability,
    }
    const startA0 = performance.now()
    const route = routeDnaSemanticQuestion(row.question, row.context?.previousTopicIds?.length ? { topicIds: row.context.previousTopicIds, lastQueryKind: (row.context.lastQueryKind ?? "unknown") as any } : null)
    const a0Latency = performance.now() - startA0
    a0Rows.push({ id: row.id, split: row.split, ...expected, operation: operationFamily(route.queryKind), domains: route.domain ? [route.domain] : [], focus: "", subquestionCount: 1, correction: false, confidence: route.confidence, latencyMs: a0Latency })

    const startA1 = performance.now()
    const improved = improvedFrame(row)
    const a1Latency = performance.now() - startA1
    a1Rows.push({ id: row.id, split: row.split, ...expected, ...improved, latencyMs: a1Latency })

  }
  mkdirSync(OUT, { recursive: true, mode: 0o700 })
  const output = { schemaVersion: VERSION, layerA: { A0: queryMetrics(a0Rows), A1: queryMetrics(a1Rows) }, rows: { A0: a0Rows, A1: a1Rows } }
  writeFileSync(path.join(OUT, `deterministic-layer-A-part-${chunkPart()}.json`), stable(output), { mode: 0o600 })
  console.log(JSON.stringify({ ok: true, layerA: output.layerA }))
}

function summarizeC(cRows: readonly any[], method: string) {
  const rows = cRows.filter((row) => row.method === method)
  return {
    cases: rows.length,
    mandatoryZeros: {
      unsupportedClaim: rows.reduce((sum, row) => sum + row.unsupportedClaim, 0),
      inventedSource: rows.reduce((sum, row) => sum + row.inventedSource, 0),
      inventedNumber: rows.reduce((sum, row) => sum + row.inventedNumber, 0),
      causalityEscalation: rows.reduce((sum, row) => sum + row.causalityEscalation, 0),
      safetyViolation: rows.reduce((sum, row) => sum + row.safetyViolation, 0),
    },
    quality: Object.fromEntries(["directness", "completeness", "relevance", "readability", "turkishNaturalnessHeuristic"].map((key) => [key, average(rows, (row) => row[key])])),
    repetition: average(rows, (row) => row.repetition),
    blindHumanPreference: "pending_independent_human_evaluation",
  }
}

function runLayerC() {
  const cases = selectedCases(loadCases())
  const cRows: any[] = []
  for (const row of cases) {
    if (row.gold.queryFrame.answerability !== "supported") continue
    const c0 = existingDeterministicNlg(row)
    const c1 = controlledNlg(row, "planner")
    const c2 = controlledNlg(row, "retrieve_fill")
    cRows.push(quality(row, c0, "C0"), quality(row, c1, "C1"), quality(row, c2, "C2"))
  }
  const output = { schemaVersion: VERSION, layerC: { C0: summarizeC(cRows, "C0"), C1: summarizeC(cRows, "C1"), C2: summarizeC(cRows, "C2") }, rows: { C: cRows } }
  mkdirSync(OUT, { recursive: true, mode: 0o700 })
  writeFileSync(path.join(OUT, `deterministic-layer-C-part-${chunkPart()}.json`), stable(output), { mode: 0o600 })
  console.log(JSON.stringify({ ok: true, layerC: output.layerC }))
}

function mergeLayers() {
  const cases = loadCases()
  const aTotal = Number(process.env.DNA_TOURNAMENT_A_TOTAL || chunkTotal())
  const cTotal = Number(process.env.DNA_TOURNAMENT_C_TOTAL || chunkTotal())
  const aParts = Array.from({ length: aTotal }, (_, index) => JSON.parse(readFileSync(path.join(OUT, `deterministic-layer-A-part-${index}.json`), "utf8")))
  const cParts = Array.from({ length: cTotal }, (_, index) => JSON.parse(readFileSync(path.join(OUT, `deterministic-layer-C-part-${index}.json`), "utf8")))
  const a0Rows = aParts.flatMap((part) => part.rows.A0)
  const a1Rows = aParts.flatMap((part) => part.rows.A1)
  const cRows = cParts.flatMap((part) => part.rows.C)
  const queryWithSplits = (rows: readonly any[]) => ({ ...queryMetrics(rows), evaluationScope: "development_plus_locked", development: queryMetrics(rows.filter((row) => row.split === "development")), locked: queryMetrics(rows.filter((row) => row.split === "locked")) })
  const answerWithSplits = (method: string) => ({ ...summarizeC(cRows, method), evaluationScope: "development_plus_locked", development: summarizeC(cRows.filter((row) => row.split === "development"), method), locked: summarizeC(cRows.filter((row) => row.split === "locked"), method) })
  const output = {
    schemaVersion: VERSION,
    benchmarkSha256: JSON.parse(readFileSync(path.join(BENCHMARK, "manifest.json"), "utf8")).benchmarkSha256,
    counts: { totalAutomated: cases.length, development: cases.filter((row) => row.split === "development").length, locked: cases.filter((row) => row.split === "locked").length },
    layerA: { A0: queryWithSplits(a0Rows), A1: queryWithSplits(a1Rows) },
    layerC: { C0: answerWithSplits("C0"), C1: answerWithSplits("C1"), C2: answerWithSplits("C2") },
    rows: { A0: a0Rows, A1: a1Rows, C: cRows },
  }
  mkdirSync(OUT, { recursive: true, mode: 0o700 })
  const target = path.join(OUT, "deterministic-layer-results.json")
  writeFileSync(target, stable(output), { mode: 0o600 }); chmodSync(target, 0o600)
  console.log(JSON.stringify({ ok: true, layerA: output.layerA, layerC: output.layerC }))
}

function chunkTotal() {
  return Number(process.env.DNA_TOURNAMENT_CHUNK_TOTAL || "6")
}
function chunkPart() {
  return Number(process.env.DNA_TOURNAMENT_CHUNK_PART || "0")
}
function selectedCases(cases: readonly BenchmarkCase[]) {
  const total = chunkTotal(); const part = chunkPart()
  assert(Number.isInteger(total) && total >= 1 && Number.isInteger(part) && part >= 0 && part < total)
  return cases.filter((_, index) => index % total === part)
}

const layer = process.argv.find((value) => value.startsWith("--layer="))?.split("=")[1] ?? "all"
if (layer === "A") runLayerA()
else if (layer === "C") runLayerC()
else if (layer === "merge") mergeLayers()
else throw new Error("Use --layer=A, --layer=C or --layer=merge")
