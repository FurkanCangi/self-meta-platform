import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ARCH = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const OUT = path.join(ARCH, "phase-5-6")
const REPO = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-6")
const PHASE5 = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-5/manifest.json")
const PHASE4 = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-4/manifest.json")
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value) => createHash("sha256").update(value).digest("hex")
const fileSha = (file) => sha(readFileSync(file))
const round = (value, digits = 6) => Number(value.toFixed(digits))

for (const file of [PHASE5, PHASE4]) if (!existsSync(file)) throw new Error(`Missing prerequisite: ${file}`)
const phase5 = readJson(PHASE5)
const phase4 = readJson(PHASE4)
const all = Object.values(phase5.architectures)
const canonical = all.filter((entry) => !entry.equivalentTo)

const minimumQualityPolicy = {
  totalScoreAtLeast: 80,
  endToEndAccuracyAtLeast: 0.95,
  hardSafetyDecision: "PASS",
  claimFidelityPointsRequired: 8,
  displayedHardFailuresRequired: 0,
}

function minimumQuality(entry) {
  const hardChecks = Object.values(phase4.results[entry.architecture].checks || {})
  const reasons = []
  if (entry.score < minimumQualityPolicy.totalScoreAtLeast) reasons.push("total_score_below_80")
  if (entry.observed.endToEndAccuracy < minimumQualityPolicy.endToEndAccuracyAtLeast) reasons.push("end_to_end_accuracy_below_95pct")
  if (entry.hardSafetyDecision !== "PASS") reasons.push("hard_safety_not_pass")
  if (entry.sections.response.dimensions.claimFidelity.score !== minimumQualityPolicy.claimFidelityPointsRequired) reasons.push("claim_fidelity_not_full")
  if (hardChecks.some((value) => value !== 0)) reasons.push("displayed_hard_failure")
  return { pass: reasons.length === 0, reasons }
}

const eligibility = Object.fromEntries(all.map((entry) => [entry.architecture, { ...minimumQuality(entry), equivalentTo: entry.equivalentTo }]))
const eligible = canonical.filter((entry) => eligibility[entry.architecture].pass)
if (!eligible.length) throw new Error("No architecture passed the preliminary minimum quality policy")

const qualityWinner = [...canonical].sort((left, right) => right.qualityCoreScore - left.qualityCoreScore || right.score - left.score || left.architecture.localeCompare(right.architecture))[0]
const qualityWindow = eligible.filter((entry) => qualityWinner.qualityCoreScore - entry.qualityCoreScore <= 2)
const monthlyQueryReference = 100_000

function costOrder(left, right) {
  return left.observed.providerCostAt100kQueriesUsd - right.observed.providerCostAt100kQueriesUsd
    || left.observed.peakRssMb - right.observed.peakRssMb
    || left.observed.operationalComplexity - right.observed.operationalComplexity
    || left.architecture.localeCompare(right.architecture)
}

function productionOrder(left, right) {
  return left.observed.providerCostAt100kQueriesUsd - right.observed.providerCostAt100kQueriesUsd
    || left.observed.operationalComplexity - right.observed.operationalComplexity
    || left.observed.externalProviders - right.observed.externalProviders
    || left.observed.p95LatencyMs - right.observed.p95LatencyMs
    || left.observed.failureSurface - right.observed.failureSurface
    || right.qualityCoreScore - left.qualityCoreScore
    || left.architecture.localeCompare(right.architecture)
}

const costWinner = [...eligible].sort(costOrder)[0]
const productionWinnerCandidate = [...qualityWindow].sort(productionOrder)[0]

function dominates(left, right) {
  const noWorse = left.qualityCoreScore >= right.qualityCoreScore
    && left.observed.providerCostAt100kQueriesUsd <= right.observed.providerCostAt100kQueriesUsd
    && left.observed.operationalComplexity <= right.observed.operationalComplexity
    && left.observed.externalProviders <= right.observed.externalProviders
    && left.observed.p95LatencyMs <= right.observed.p95LatencyMs
    && left.observed.failureSurface <= right.observed.failureSurface
  const strictlyBetter = left.qualityCoreScore > right.qualityCoreScore
    || left.observed.providerCostAt100kQueriesUsd < right.observed.providerCostAt100kQueriesUsd
    || left.observed.operationalComplexity < right.observed.operationalComplexity
    || left.observed.externalProviders < right.observed.externalProviders
    || left.observed.p95LatencyMs < right.observed.p95LatencyMs
    || left.observed.failureSurface < right.observed.failureSurface
  return noWorse && strictlyBetter
}

const paretoFrontier = eligible.filter((candidate) => !eligible.some((other) => other.architecture !== candidate.architecture && dominates(other, candidate))).map((entry) => entry.architecture)
const comparison = Object.fromEntries(canonical.map((entry) => [entry.architecture, {
  minimumQuality: eligibility[entry.architecture],
  totalScore: entry.score,
  qualityCoreScore: entry.qualityCoreScore,
  withinTwoPointsOfQualityWinner: qualityWinner.qualityCoreScore - entry.qualityCoreScore <= 2,
  providerCostAt100kQueriesUsd: entry.observed.providerCostAt100kQueriesUsd,
  localHostingCost: "not_measured",
  peakRssMb: entry.observed.peakRssMb,
  p95LatencyMs: entry.observed.p95LatencyMs,
  operationalComplexity: entry.observed.operationalComplexity,
  externalProviders: entry.observed.externalProviders,
  failureSurface: entry.observed.failureSurface,
}]))

const winner = (entry, rationale) => ({ architecture: entry.architecture, totalScore: entry.score, qualityCoreScore: entry.qualityCoreScore, rationale })
const phase6 = {
  schemaVersion: "dna-architecture-preliminary-pareto-phase6@1",
  generatedAt: phase5.generatedAt,
  benchmarkSha256: phase5.benchmarkSha256,
  status: "preliminary_selection_pending_real_cost_and_blind_human_evaluation",
  minimumQualityPolicy,
  eligibility,
  equivalentArchitecturesExcludedFromIndependentSelection: { S9: "S1", S10: "S1" },
  qualityWindowRule: "Architectures within two points of the highest 90-point quality-core score enter the production balance comparison, if they also pass minimum quality.",
  monthlyCostReference: { queries: monthlyQueryReference, scope: "provider API only", localHostingCost: "not_measured", warning: "This is not a full production monthly cost estimate." },
  categories: {
    qualityWinner: winner(qualityWinner, "Highest measured Understanding + Knowledge Selection + Response score."),
    costWinner: winner(costWinner, "Lowest provider cost among minimum-quality systems; ties resolved by lower RAM and operational complexity."),
    productionWinnerCandidate: winner(productionWinnerCandidate, "Within two quality points, then lowest provider cost, operational load, external dependency, latency and failure surface."),
  },
  qualityWindow: qualityWindow.map((entry) => entry.architecture),
  paretoFrontier,
  comparison,
  decision: `${productionWinnerCandidate.architecture} is the preliminary production candidate; Phase 9 may change this after blind human preference, independent generalization and real hosting-cost measurement.`,
  sourceArtifacts: { phase5ManifestSha256: fileSha(PHASE5), phase4ManifestSha256: fileSha(PHASE4) },
  boundaries: { productionAffected: false, runtimeEligible: false, releaseEligible: false, finalArchitectureDecision: false, independentBlindHumanEvaluationComplete: false, realMonthlyHostingCostMeasured: false },
}

mkdirSync(OUT, { recursive: true, mode: 0o700 })
mkdirSync(REPO, { recursive: true })
const fullPath = path.join(OUT, "phase-6-preliminary-pareto.json")
writeFileSync(fullPath, stable(phase6), { mode: 0o600 })
chmodSync(fullPath, 0o600)
writeFileSync(path.join(REPO, "manifest.json"), stable(phase6))
writeFileSync(path.join(REPO, "README.md"), `# DNA Architecture Tournament — Faz 6\n\nÖn Pareto seçimi tamamlandı. Quality Winner: ${qualityWinner.architecture}; Cost Winner: ${costWinner.architecture}; Production Winner adayı: ${productionWinnerCandidate.architecture}. Bu karar kör insan değerlendirmesi, bağımsız genelleme ve gerçek aylık altyapı maliyeti tamamlanmadan nihai değildir. Production etkilenmemiştir.\n`)
const paretoRows = Object.entries(comparison).map(([id, entry]) => `| ${id} | ${entry.minimumQuality.pass ? "PASS" : "FAIL"} | ${entry.totalScore.toFixed(2)} | ${entry.qualityCoreScore.toFixed(2)} | $${entry.providerCostAt100kQueriesUsd.toFixed(2)} | ${entry.peakRssMb} | ${entry.p95LatencyMs.toFixed(1)} | ${entry.operationalComplexity} |`)
writeFileSync(path.join(REPO, "PARETO.md"), `# Faz 6 Ön Pareto Seçimi\n\n| Mimari | Minimum kalite | Toplam | Kalite çekirdeği /90 | 100 bin sorgu API | RAM MB | p95 ms | Operasyon |\n|---|---|---:|---:|---:|---:|---:|---:|\n${paretoRows.join("\n")}\n\n- Quality Winner: **${qualityWinner.architecture}**\n- Cost Winner: **${costWinner.architecture}**\n- Production Winner adayı: **${productionWinnerCandidate.architecture}**\n- Pareto sınırı: **${paretoFrontier.join(", ")}**\n\nYerel hosting maliyeti henüz ölçülmedi; API karşılaştırması 100.000 aylık sorgu için yalnız sağlayıcı maliyetidir. Karar Faz 9 öncesinde nihai değildir.\n`)
writeFileSync(path.join(REPO, "SHA256SUMS"), `${["PARETO.md", "README.md", "manifest.json"].map((name) => `${sha(readFileSync(path.join(REPO, name)))}  ${name}`).join("\n")}\n`)

const sealed = path.join(ARCH, "sealed/phase-6-pareto-first-result.json")
const sealValue = stable({ schemaVersion: "dna-phase6-pareto-first-result@1", benchmarkSha256: phase6.benchmarkSha256, phase6Sha256: sha(stable(phase6)), categories: phase6.categories, paretoFrontier })
if (!existsSync(sealed)) {
  writeFileSync(sealed, sealValue, { flag: "wx", mode: 0o444 })
  chmodSync(sealed, 0o444)
} else if (readFileSync(sealed, "utf8") !== sealValue) {
  throw new Error("Phase 6 sealed first result differs; silent overwrite is forbidden")
}

console.log(JSON.stringify({ ok: true, categories: phase6.categories, qualityWindow: phase6.qualityWindow, paretoFrontier }))
