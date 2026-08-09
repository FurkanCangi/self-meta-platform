import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const roots = [5, 6].map((phase) => path.join(ROOT, `docs/dna-intelligence/architecture-tournament/v2/phase-${phase}`))
const [phase5, phase6] = roots.map((root) => JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")))
const phase4 = JSON.parse(readFileSync(path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-4/manifest.json"), "utf8"))
const sha = (value) => createHash("sha256").update(value).digest("hex")

const weights = phase5.scoringPolicy.weights
assert.equal(Object.values(weights).reduce((sum, entry) => sum + entry.maximum, 0), 100)
for (const entry of Object.values(weights)) assert.equal(Object.values(entry.dimensions).reduce((sum, value) => sum + value, 0), entry.maximum)
assert.equal(phase5.status, "provisional_automated_score_blind_human_evaluation_pending")
assert.equal(phase5.boundaries.productionAffected, false)
assert.equal(phase5.boundaries.runtimeEligible, false)
assert.equal(phase5.boundaries.releaseEligible, false)
assert.equal(phase5.boundaries.independentBlindHumanEvaluationComplete, false)
assert.equal(JSON.stringify(phase5).includes('"question"'), false)

for (const [id, entry] of Object.entries(phase5.architectures)) {
  assert.equal(phase4.results[id].decision, "PASS")
  assert.ok(entry.score >= 0 && entry.score <= 100)
  assert.equal(Object.values(entry.sections).reduce((sum, section) => sum + section.maximum, 0), 100)
  assert.ok(entry.confidenceInterval95.lower <= entry.score)
  assert.ok(entry.confidenceInterval95.upper >= entry.score)
  assert.equal(Object.values(entry.failedQuestionFamilies).reduce((sum, family) => sum + family.failures, 0), entry.failedLockedCases)
  assert.equal(entry.sections.response.dimensions.naturalTurkish.status, "automated_proxy_pending_blind_human")
}

const independent = Object.values(phase5.architectures).filter((entry) => !entry.equivalentTo)
const qualityWinner = independent.sort((left, right) => right.qualityCoreScore - left.qualityCoreScore || right.score - left.score)[0]
assert.equal(phase6.categories.qualityWinner.architecture, qualityWinner.architecture)
assert.equal(phase6.categories.qualityWinner.architecture, "S1")
assert.equal(phase6.categories.costWinner.architecture, "S1")
assert.equal(phase6.categories.productionWinnerCandidate.architecture, "S1")
assert.deepEqual(phase6.qualityWindow, ["S1", "S2", "S5"])
assert.deepEqual(phase6.paretoFrontier, ["S1"])
assert.equal(phase6.eligibility.S1.pass, true)
assert.equal(phase6.eligibility.S2.pass, true)
assert.equal(phase6.eligibility.S5.pass, true)
for (const id of ["S0", "S3", "S6"]) assert.equal(phase6.eligibility[id].pass, false)
assert.equal(phase6.eligibility.S9.equivalentTo, "S1")
assert.equal(phase6.eligibility.S10.equivalentTo, "S1")
assert.equal(phase6.boundaries.productionAffected, false)
assert.equal(phase6.boundaries.finalArchitectureDecision, false)
assert.equal(phase6.boundaries.realMonthlyHostingCostMeasured, false)
assert.equal(phase6.boundaries.independentBlindHumanEvaluationComplete, false)

for (const root of roots) {
  for (const line of readFileSync(path.join(root, "SHA256SUMS"), "utf8").trim().split("\n")) {
    const [expected, name] = line.split(/\s{2}/)
    assert.equal(sha(readFileSync(path.join(root, name))), expected)
  }
}

console.log(JSON.stringify({ ok: true, assertions: 92, categories: phase6.categories, paretoFrontier: phase6.paretoFrontier }))
