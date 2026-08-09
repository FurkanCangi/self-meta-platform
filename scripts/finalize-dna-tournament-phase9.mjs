import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ARCH = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const PHASE8_RAW = path.join(ARCH, "phase-8")
const REPO = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-9")
const PHASE5 = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-5/manifest.json")
const PHASE7 = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-7/manifest.json")
const PHASE8 = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-8/manifest.json")
const RATINGS = path.join(PHASE8_RAW, "human-ratings-completed.json")
const PACKAGE = path.join(PHASE8_RAW, "blind-human-evaluation-package.json")
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value) => createHash("sha256").update(value).digest("hex")
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))
for (const file of [PHASE5, PHASE7, PHASE8, PACKAGE]) if (!existsSync(file)) throw new Error(`Missing Phase 9 input: ${file}`)
const phase5 = readJson(PHASE5); const phase7 = readJson(PHASE7); const phase8 = readJson(PHASE8)
const MAPPING = path.join(PHASE8_RAW, phase8.sealedMappingFile)
if (!existsSync(MAPPING)) throw new Error(`Missing Phase 9 mapping: ${MAPPING}`)
const finalists = [
  { id: "A", category: "Local / Near-Zero Cost", architecture: "S1", composition: "Improved deterministic parser + lexical retrieval + controlled deterministic answer", monthlyCostEvidence: "phase7 deterministic" },
  { id: "B", category: "Balanced", architecture: "S2", composition: "Improved deterministic parser + hybrid retrieval + deterministic answer", monthlyCostEvidence: "phase7 local hybrid; no provider API" },
  { id: "C", category: "Quality Ceiling", architecture: "S5", composition: "Hybrid retrieval + Luna realization + deterministic validator", monthlyCostEvidence: "phase7 S5 Luna validated" },
]

function validateHumanRatings() {
  if (!existsSync(RATINGS)) return { complete: false, reason: "independent_human_ratings_missing", scores: null }
  const ratings = readJson(RATINGS); const mapping = readJson(MAPPING); const pkg = readJson(PACKAGE)
  if (ratings.packageSha256 !== sha(stable(pkg))) throw new Error("Human rating package hash mismatch")
  if (ratings.evaluator?.independentHuman !== true || ratings.evaluator?.consented !== true || !ratings.evaluator?.completedAt) throw new Error("Independent human attestation incomplete")
  if (!ratings.evaluator?.evaluatorId || ratings.evaluator.evaluatorId === "REPLACE_WITH_NON_IDENTIFYING_ID") throw new Error("Evaluator ID missing")
  const dimensions = pkg.dimensions
  if (ratings.ratings.length !== pkg.cases.length * 4 || ratings.pairwise.length !== pkg.cases.length) throw new Error("Human ratings incomplete")
  const mapByKey = new Map(mapping.mapping.map((row) => [`${row.caseId}:${row.label}`, row]))
  const totals = Object.fromEntries(finalists.map((row) => [row.architecture, { values: [], eligibleRatings: 0, ineligibleRatings: 0, pairwiseWins: 0 }]))
  for (const rating of ratings.ratings) {
    const map = mapByKey.get(`${rating.caseId}:${rating.label}`)
    if (!map || !(map.architecture in totals)) continue
    for (const dimension of dimensions) if (!Number.isInteger(rating[dimension]) || rating[dimension] < 1 || rating[dimension] > 5) throw new Error(`Invalid human score: ${rating.caseId}:${rating.label}:${dimension}`)
    if (map.eligibility.eligibleToWin) {
      totals[map.architecture].values.push(dimensions.reduce((sum, dimension) => sum + rating[dimension], 0) / dimensions.length)
      totals[map.architecture].eligibleRatings += 1
    } else totals[map.architecture].ineligibleRatings += 1
  }
  for (const pair of ratings.pairwise) {
    if (!["A", "B", "tie"].includes(pair.preferred)) throw new Error(`Invalid pairwise preference: ${pair.caseId}`)
    if (pair.preferred === "tie") continue
    const map = mapByKey.get(`${pair.caseId}:${pair.preferred}`)
    if (map?.eligibility.eligibleToWin && map.architecture in totals) totals[map.architecture].pairwiseWins += 1
  }
  const scores = Object.fromEntries(Object.entries(totals).map(([id, value]) => [id, { mean: value.values.length ? value.values.reduce((a, b) => a + b, 0) / value.values.length : 0, eligibleRatings: value.eligibleRatings, ineligibleRatings: value.ineligibleRatings, pairwiseWins: value.pairwiseWins }]))
  return { complete: true, reason: null, scores, evaluatorIdHash: sha(ratings.evaluator.evaluatorId).slice(0, 16) }
}

const human = validateHumanRatings()
let productionWinner = null
if (human.complete) {
  const candidates = finalists.map((row) => ({ ...row, humanMean: human.scores[row.architecture].mean, automatedScore: phase5.architectures[row.architecture].score }))
  const qualityCeiling = Math.max(...candidates.map((row) => row.humanMean))
  productionWinner = candidates.filter((row) => qualityCeiling - row.humanMean <= .20).sort((left, right) => {
    const leftExternal = left.architecture === "S5" ? 1 : 0; const rightExternal = right.architecture === "S5" ? 1 : 0
    return leftExternal - rightExternal || phase5.architectures[left.architecture].observed.operationalComplexity - phase5.architectures[right.architecture].observed.operationalComplexity || right.automatedScore - left.automatedScore
  })[0]
}
const manifest = {
  schemaVersion: "dna-architecture-production-finalists-phase9@1",
  generatedAt: new Date().toISOString(),
  status: human.complete ? "production_winner_selected_pending_canary" : "blocked_independent_human_evaluation_pending",
  finalists,
  qwenDecision: { finalist: false, reason: "Did not beat the finalists on measured latency/resource gate; Linux server latency remains unverified." },
  paretoRerun: human.complete ? { humanScores: human.scores, productionWinner } : { blocked: true, reason: human.reason },
  productionWinner,
  phase7CostEvidence: { deterministicCostPer1000Usd: phase7.costPer1000Messages.deterministicProviderUsd, s5CostPer1000Usd: phase7.costPer1000Messages.s5LunaValidatedProviderUsd, localQwenAlwaysOnMonthlyUsd: phase7.costPer1000Messages.localQwenAlwaysOnServerUsdMonthly },
  boundaries: { exactlyThreeProductionFinalists: true, finalWinnerSelected: Boolean(productionWinner), independentHumanEvaluationComplete: human.complete, productionAffected: false, runtimeEligible: Boolean(productionWinner), releaseEligible: false },
  sourceHashes: { phase5: sha(readFileSync(PHASE5)), phase7: sha(readFileSync(PHASE7)), phase8: sha(readFileSync(PHASE8)) },
}
mkdirSync(REPO, { recursive: true })
writeFileSync(path.join(REPO, "manifest.json"), stable(manifest))
writeFileSync(path.join(REPO, "README.md"), `# DNA Architecture Tournament — Faz 9\n\nÜç production finalisti tanımlandı: **S1 (yerel/sıfıra yakın maliyet)**, **S2 (dengeli hibrit retrieval)** ve **S5 (Luna kalite tavanı)**. ${human.complete ? `Kör insan puanları içe aktarıldı; production winner: **${productionWinner.architecture}**.` : "Gerçek insan puanı bulunmadığı için Production Winner seçimi dürüstçe beklemededir."} Qwen, ölçülen gecikme ve kaynak kapısını geçmediği için finalist değildir.\n`)
writeFileSync(path.join(REPO, "SHA256SUMS"), `${["README.md", "manifest.json"].map((name) => `${sha(readFileSync(path.join(REPO, name)))}  ${name}`).join("\n")}\n`)
console.log(JSON.stringify({ ok: true, status: manifest.status, finalists: finalists.map((row) => row.architecture), productionWinner }))
