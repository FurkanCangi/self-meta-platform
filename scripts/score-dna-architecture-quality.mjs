import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ARCH = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const RAW = path.join(ARCH, "phase-3-4")
const OUT = path.join(ARCH, "phase-5-6")
const REPO = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-5")

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value) => createHash("sha256").update(value).digest("hex")
const fileSha = (file) => sha(readFileSync(file))
const round = (value, digits = 6) => Number(value.toFixed(digits))
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

const phase2Path = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-2/layer-tournament-manifest.json")
const phase3Path = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-3/manifest.json")
const phase4Path = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-4/manifest.json")
const basePath = path.join(RAW, "architecture-base-results.json")
const lunaPath = path.join(RAW, "architecture-luna-results.json")
const phase3SummaryPath = path.join(RAW, "phase-3-summary.json")
const lockedPath = path.join(ARCH, "sealed/locked-automated.json")

for (const file of [phase2Path, phase3Path, phase4Path, basePath, lunaPath, phase3SummaryPath, lockedPath]) {
  if (!existsSync(file)) throw new Error(`Missing tournament evidence: ${file}`)
}

const phase2 = readJson(phase2Path)
const phase3 = readJson(phase3Path)
const phase4 = readJson(phase4Path)
const base = readJson(basePath)
const luna = readJson(lunaPath)
const phase3Summary = readJson(phase3SummaryPath)
const lockedCases = readJson(lockedPath).cases
const lockedById = new Map(lockedCases.map((entry) => [entry.id, entry]))

const architectureSpecs = {
  S0: { parser: "A0", retrieval: "B0", realizer: "C0", composition: "legacy deterministic", localModels: 0, externalProviders: 0, operationalComplexity: 1, failureSurface: 1 },
  S1: { parser: "A1", retrieval: "B0", realizer: "C0", composition: "maximum deterministic", localModels: 0, externalProviders: 0, operationalComplexity: 1, failureSurface: 1 },
  S2: { parser: "A1", retrieval: "B1", realizer: "C0", composition: "hybrid retrieval + deterministic answer", localModels: 1, externalProviders: 0, operationalComplexity: 2, failureSurface: 2 },
  S3: { parser: "A2", retrieval: "B1", realizer: "C0", composition: "neural parser + hybrid retrieval + deterministic answer", localModels: 2, externalProviders: 0, operationalComplexity: 3, failureSurface: 3 },
  S5: { parser: "A1", retrieval: "B1", realizer: "C4V", composition: "hybrid retrieval + Luna + validator", localModels: 1, externalProviders: 1, operationalComplexity: 4, failureSurface: 4 },
  S6: { parser: "A2", retrieval: "B1", realizer: "C4V", composition: "neural parser + retrieval + Luna", localModels: 2, externalProviders: 1, operationalComplexity: 5, failureSurface: 5 },
  S9: { parser: "A1", retrieval: "B0", realizer: "C0", composition: "adaptive cascade collapsed to S1", localModels: 0, externalProviders: 0, operationalComplexity: 1, failureSurface: 1, equivalentTo: "S1" },
  S10: { parser: "A1", retrieval: "B0", realizer: "C0", composition: "three-stage cascade collapsed to S1", localModels: 0, externalProviders: 0, operationalComplexity: 1, failureSurface: 1, equivalentTo: "S1" },
}

const rowsByArchitecture = {
  S0: base.rows.S0,
  S1: base.rows.S1,
  S2: base.rows.S2,
  S3: base.rows.S3,
  S5: luna.rows.S5,
  S6: luna.rows.S6,
  S9: phase3Summary.rows.S9,
  S10: phase3Summary.rows.S10,
}

const evidenceArchitecture = { S5: "S2", S6: "S3", S9: "S1", S10: "S1" }

function parserMetrics(id) {
  const parser = architectureSpecs[id].parser
  if (parser === "A2") return phase2.layerA.A2
  return phase2.layerA[parser].locked
}

function retrievalMetrics(id) {
  return phase2.layerB[architectureSpecs[id].retrieval]
}

function architectureLocked(id) {
  const entry = phase3.architectures[id]
  if (id === "S9") return entry.adaptive.locked
  if (id === "S10") return entry.selected.locked
  return entry.locked
}

function evidenceLocked(id) {
  return architectureLocked(evidenceArchitecture[id] || id)
}

function latencyP95(id) {
  const metrics = architectureLocked(id)
  return metrics.totalLatencyMs?.p95 ?? metrics.latencyMs?.p95
}

function peakRssMb(id) {
  return evidenceLocked(id).peakRssMb ?? retrievalMetrics(id).peakRssMb ?? phase2.layerA[architectureSpecs[id].parser]?.peakRssMb ?? null
}

function providerCostPer1000(id) {
  const metrics = architectureLocked(id)
  return metrics.costPer1000QueriesUsd ?? metrics.costPer1000Usd ?? metrics.providerCostUsd ?? 0
}

function responseMetrics(id) {
  const deterministic = phase2.layerC.C0.locked
  if (architectureSpecs[id].realizer !== "C4V") {
    return {
      directness: deterministic.quality.directness,
      completeness: deterministic.quality.completeness,
      claimFidelity: 1,
      naturalness: deterministic.quality.turkishNaturalnessHeuristic,
      consistencyAndRepetition: mean([deterministic.quality.readability, 1 - deterministic.repetition]),
      evidence: "C0 locked automated heuristics",
      naturalnessStatus: "automated_proxy_pending_blind_human",
    }
  }
  const lunaRealizer = phase2.layerC.C4
  const live = architectureLocked(id)
  const validatorPass = live.validatorPassRate ?? 1
  const fallback = live.deterministicFallbackRate ?? 0
  return {
    directness: lunaRealizer.quality.directness,
    completeness: deterministic.quality.completeness,
    claimFidelity: 1,
    naturalness: lunaRealizer.quality.turkishNaturalness * validatorPass + deterministic.quality.turkishNaturalnessHeuristic * fallback,
    consistencyAndRepetition: mean([lunaRealizer.quality.readability, 1 - lunaRealizer.repetition]),
    evidence: "C4 Luna realization after validator, with deterministic fallback",
    naturalnessStatus: "automated_proxy_pending_blind_human",
  }
}

function latencyRate(p95) {
  if (p95 <= 250) return 1
  return clamp(1 - Math.log2(p95 / 250) / 4)
}

function term(key, max, rate, n, evidence, options = {}) {
  return { key, max, rate: round(clamp(rate)), score: round(max * clamp(rate)), n, evidence, fixed: Boolean(options.fixed), status: options.status || "measured" }
}

function section(terms) {
  const score = terms.reduce((sum, entry) => sum + entry.score, 0)
  const maximum = terms.reduce((sum, entry) => sum + entry.max, 0)
  let variance = 0
  for (const entry of terms) {
    if (entry.fixed || !entry.n) continue
    const adjusted = (entry.rate * entry.n + 0.5) / (entry.n + 1)
    variance += entry.max ** 2 * adjusted * (1 - adjusted) / (entry.n + 1)
  }
  const delta = 1.96 * Math.sqrt(variance)
  return {
    score: round(score),
    maximum,
    confidenceInterval95: { lower: round(Math.max(0, score - delta)), upper: round(Math.min(maximum, score + delta)) },
    dimensions: Object.fromEntries(terms.map((entry) => [entry.key, entry])),
    _variance: variance,
  }
}

function failureFamilies(rows) {
  const lockedRows = rows.filter((row) => row.split === "locked")
  const totals = {}
  for (const entry of lockedCases) totals[entry.category] = (totals[entry.category] || 0) + 1
  const failures = {}
  for (const row of lockedRows.filter((entry) => !entry.correct)) {
    const family = lockedById.get(row.id)?.category || "unknown"
    const target = failures[family] ||= { failures: 0, supportedIncorrect: 0, unsupportedWrongAnswer: 0, safetyMiss: 0, other: 0 }
    target.failures += 1
    if (row.expectedKind === "supported") target.supportedIncorrect += 1
    else if (row.expectedKind === "unsupported" && row.action === "answer") target.unsupportedWrongAnswer += 1
    else if (row.expectedKind === "safety") target.safetyMiss += 1
    else target.other += 1
  }
  return Object.fromEntries(Object.entries(failures).sort(([left], [right]) => left.localeCompare(right)).map(([family, values]) => [family, { ...values, cases: totals[family] || 0, failureRate: round(values.failures / (totals[family] || 1)) }]))
}

function scoreArchitecture(id) {
  if (phase4.results[id]?.decision !== "PASS") throw new Error(`${id} did not pass hard safety gate`)
  const spec = architectureSpecs[id]
  const parser = parserMetrics(id)
  const retrieval = retrievalMetrics(id)
  const observed = evidenceLocked(id)
  const operational = architectureLocked(id)
  const response = responseMetrics(id)
  const lockedRows = rowsByArchitecture[id].filter((row) => row.split === "locked")
  const supportedN = retrieval.supportedCases || lockedRows.filter((row) => row.expectedKind === "supported").length
  const followCorrectionN = lockedCases.filter((entry) => entry.category === "followup_correction_focus").length
  const unsupportedN = retrieval.unsupportedCases || lockedRows.filter((row) => row.expectedKind === "unsupported").length
  const intent = parser.intentAccuracy ?? 0
  const topicFocus = mean([parser.topicMacroF1 ?? 0, parser.focusMacroF1 ?? 0])
  const followCorrection = mean([parser.followupAccuracy ?? 0, parser.correctionAccuracy ?? 0])
  const multiIntent = parser.twoQuestionSplitF1 ?? 0
  const ood = parser.oodAuroc ?? 0
  const retrievalComposite = .35 * retrieval.recallAt1 + .20 * retrieval.recallAt3 + .15 * retrieval.recallAt5 + .15 * retrieval.mrr + .15 * retrieval.ndcgAt5
  const unsupportedAbstention = observed.unsupportedAbstention ?? 1
  const answerability = mean([retrieval.unsupportedDiscrimination, unsupportedAbstention])
  const claimSelection = observed.supportedClaimAccuracy ?? 0
  const validatorFailureNeverShown = phase4.results[id].checks.validatorFailureShown === 0 ? 1 : 0
  const gracefulFailure = mean([observed.safetyRefusal ?? 1, unsupportedAbstention, validatorFailureNeverShown])
  const usesExternalRealizer = spec.realizer === "C4V"
  const repeatability = usesExternalRealizer ? 0.5 : 1

  const understanding = section([
    term("intent", 7, intent, 250, `${spec.parser} locked intent accuracy`),
    term("topicFocus", 8, topicFocus, 250, `${spec.parser} locked topic/focus macro-F1; missing focus is scored as zero`),
    term("followupCorrection", 8, followCorrection, followCorrectionN, `${spec.parser} follow-up/correction accuracy`),
    term("multiIntent", 4, multiIntent, lockedCases.filter((entry) => entry.category === "compound_two_question").length, `${spec.parser} two-question split F1`),
    term("ood", 3, ood, 250, `${spec.parser} OOD AUROC`),
  ])
  const knowledgeSelection = section([
    term("retrieval", 10, retrievalComposite, supportedN, `${spec.retrieval} weighted Recall@1/3/5, MRR and nDCG@5`),
    term("answerability", 5, answerability, unsupportedN, `${spec.retrieval} unsupported discrimination plus end-to-end abstention`),
    term("claimSelection", 10, claimSelection, supportedN, `${id} supported-claim accuracy`),
  ])
  const responseSection = section([
    term("directness", 7, response.directness, supportedN, response.evidence),
    term("completeness", 7, response.completeness, supportedN, response.evidence),
    term("claimFidelity", 8, response.claimFidelity, supportedN, `${id} displayed-answer hard gate`),
    term("naturalTurkish", 8, response.naturalness, supportedN, response.evidence, { status: response.naturalnessStatus }),
    term("consistencyRepetition", 5, response.consistencyAndRepetition, supportedN, response.evidence),
  ])
  const operationalUx = section([
    term("latency", 5, latencyRate(latencyP95(id)), null, `${round(latencyP95(id), 3)} ms locked p95`, { fixed: true }),
    term("gracefulFailure", 3, gracefulFailure, Math.max(unsupportedN, 1), "safety refusal, unsupported abstention and validator fail-closed"),
    term("consistency", 2, repeatability, usesExternalRealizer ? null : 20, usesExternalRealizer ? "live 20x Luna replay pending; conservative provisional half-credit" : "deterministic 20x contract", { fixed: usesExternalRealizer, status: usesExternalRealizer ? "provisional_pending_20x_live_replay" : "measured" }),
  ])

  const sections = { understanding, knowledgeSelection, response: responseSection, operationalUx }
  const total = Object.values(sections).reduce((sum, entry) => sum + entry.score, 0)
  const totalVariance = Object.values(sections).reduce((sum, entry) => sum + entry._variance, 0)
  const totalDelta = 1.96 * Math.sqrt(totalVariance)
  for (const value of Object.values(sections)) delete value._variance
  const failures = failureFamilies(lockedRows)
  return {
    architecture: id,
    composition: spec.composition,
    equivalentTo: spec.equivalentTo || null,
    hardSafetyDecision: "PASS",
    score: round(total),
    maximum: 100,
    confidenceInterval95: { lower: round(Math.max(0, total - totalDelta)), upper: round(Math.min(100, total + totalDelta)) },
    qualityCoreScore: round(understanding.score + knowledgeSelection.score + responseSection.score),
    qualityCoreMaximum: 90,
    sections,
    observed: {
      lockedCases: lockedRows.length,
      endToEndAccuracy: operational.endToEndAccuracy,
      supportedClaimAccuracy: claimSelection,
      unsupportedAbstention,
      p95LatencyMs: round(latencyP95(id), 3),
      peakRssMb: peakRssMb(id),
      providerCostPer1000QueriesUsd: round(providerCostPer1000(id)),
      providerCostAt100kQueriesUsd: round(providerCostPer1000(id) * 100),
      localModels: spec.localModels,
      externalProviders: spec.externalProviders,
      operationalComplexity: spec.operationalComplexity,
      failureSurface: spec.failureSurface,
    },
    failedQuestionFamilies: failures,
    failedLockedCases: Object.values(failures).reduce((sum, entry) => sum + entry.failures, 0),
    limitations: [
      "Architecture Decision Set was reused after Phase 2 and is not an independent generalization estimate.",
      "Natural Turkish is an automated proxy until the sealed blind human evaluation is completed.",
      ...(usesExternalRealizer ? ["Luna repeatability has not yet been measured with an independent 20x live replay."] : []),
    ],
  }
}

const evaluatedIds = Object.entries(phase4.results).filter(([, value]) => value.decision === "PASS").map(([id]) => id)
const scores = Object.fromEntries(evaluatedIds.map((id) => [id, scoreArchitecture(id)]))
const ranking = Object.values(scores).sort((left, right) => right.score - left.score || left.architecture.localeCompare(right.architecture)).map((entry, index) => ({ rank: index + 1, architecture: entry.architecture, score: entry.score, confidenceInterval95: entry.confidenceInterval95 }))

const phase5 = {
  schemaVersion: "dna-architecture-quality-score-phase5@1",
  generatedAt: phase3.generatedAt,
  benchmarkSha256: phase3.benchmarkSha256,
  status: "provisional_automated_score_blind_human_evaluation_pending",
  scoringPolicy: {
    maximum: 100,
    weights: {
      understanding: { maximum: 30, dimensions: { intent: 7, topicFocus: 8, followupCorrection: 8, multiIntent: 4, ood: 3 } },
      knowledgeSelection: { maximum: 25, dimensions: { retrieval: 10, answerability: 5, claimSelection: 10 } },
      response: { maximum: 35, dimensions: { directness: 7, completeness: 7, claimFidelity: 8, naturalTurkish: 8, consistencyRepetition: 5 } },
      operationalUx: { maximum: 10, dimensions: { latency: 5, gracefulFailure: 3, consistency: 2 } },
    },
    retrievalComposite: "0.35*Recall@1 + 0.20*Recall@3 + 0.15*Recall@5 + 0.15*MRR + 0.15*nDCG@5",
    latency: "5 points at <=250 ms p95, then logarithmic decay to zero at 4000 ms",
    confidenceInterval: "95% Jeffreys-adjusted delta approximation over automated proportions; fixed operational proxies excluded from sampling variance",
    confidenceBoundary: "Intervals do not include blind-human judgment or dataset-reuse uncertainty.",
  },
  ranking,
  architectures: scores,
  sourceArtifacts: {
    phase2ManifestSha256: fileSha(phase2Path),
    phase3ManifestSha256: fileSha(phase3Path),
    phase4ManifestSha256: fileSha(phase4Path),
    architectureBaseResultsSha256: fileSha(basePath),
    architectureLunaResultsSha256: fileSha(lunaPath),
    lockedAutomatedSha256: fileSha(lockedPath),
  },
  boundaries: { productionAffected: false, runtimeEligible: false, releaseEligible: false, rawQuestionsInRepository: false, independentBlindHumanEvaluationComplete: false },
}

mkdirSync(OUT, { recursive: true, mode: 0o700 })
mkdirSync(REPO, { recursive: true })
const fullPath = path.join(OUT, "phase-5-quality-score.json")
writeFileSync(fullPath, stable(phase5), { mode: 0o600 })
chmodSync(fullPath, 0o600)
writeFileSync(path.join(REPO, "manifest.json"), stable(phase5))
writeFileSync(path.join(REPO, "README.md"), "# DNA Architecture Tournament — Faz 5\n\nGüvenlik kapısını geçen mimariler 100 puanlık sabit rubrikle ölçülmüştür. Puanlar otomatik ve ön niteliktedir; 150 soruluk kör insan değerlendirmesi tamamlanmadan doğal Türkçe ve genel kalite için nihai ürün iddiası kurulamaz. Production etkilenmemiştir.\n")
const scorecardRows = ranking.map(({ architecture }) => {
  const entry = scores[architecture]
  const failed = Object.entries(entry.failedQuestionFamilies).map(([family, value]) => `${family}:${value.failures}`).join(", ") || "yok"
  return `| ${architecture} | ${entry.score.toFixed(2)} | ${entry.confidenceInterval95.lower.toFixed(2)}–${entry.confidenceInterval95.upper.toFixed(2)} | ${entry.sections.understanding.score.toFixed(2)} | ${entry.sections.knowledgeSelection.score.toFixed(2)} | ${entry.sections.response.score.toFixed(2)} | ${entry.sections.operationalUx.score.toFixed(2)} | ${failed} |`
})
writeFileSync(path.join(REPO, "SCORECARD.md"), `# Faz 5 Otomatik Kalite Kartı\n\n| Mimari | Toplam | %95 GA | Anlama /30 | Bilgi /25 | Yanıt /35 | UX /10 | Başarısız soru aileleri |\n|---|---:|---:|---:|---:|---:|---:|---|\n${scorecardRows.join("\n")}\n\nDoğal Türkçe puanı otomatik bir vekil ölçümdür. Güven aralıkları kör insan değerlendirmesi veya veri setinin yeniden kullanılması kaynaklı belirsizliği kapsamaz.\n`)
writeFileSync(path.join(REPO, "SHA256SUMS"), `${["README.md", "SCORECARD.md", "manifest.json"].map((name) => `${sha(readFileSync(path.join(REPO, name)))}  ${name}`).join("\n")}\n`)

const sealed = path.join(ARCH, "sealed/phase-5-quality-first-result.json")
const sealValue = stable({ schemaVersion: "dna-phase5-quality-first-result@1", benchmarkSha256: phase5.benchmarkSha256, phase5Sha256: sha(stable(phase5)), ranking: phase5.ranking })
if (!existsSync(sealed)) {
  writeFileSync(sealed, sealValue, { flag: "wx", mode: 0o444 })
  chmodSync(sealed, 0o444)
} else if (readFileSync(sealed, "utf8") !== sealValue) {
  throw new Error("Phase 5 sealed first result differs; silent overwrite is forbidden")
}

console.log(JSON.stringify({ ok: true, status: phase5.status, ranking: phase5.ranking }))
