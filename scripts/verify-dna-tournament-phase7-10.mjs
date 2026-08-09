import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const sha = (value) => createHash("sha256").update(value).digest("hex")
const manifests = Object.fromEntries([7, 8, 9, 10].map((phase) => [phase, JSON.parse(readFileSync(path.join(ROOT, `docs/dna-intelligence/architecture-tournament/v2/phase-${phase}/manifest.json`), "utf8"))]))
assert.ok(manifests[7].measurement.sample.iterations >= 20)
assert.equal(manifests[7].measurement.sample.failureRate, 0)
assert.equal(manifests[7].scenarios.length, 4)
assert.deepEqual(manifests[7].scenarios.map((row) => row.monthlyRequests), [60_000, 150_000, 300_000, 300_000])
assert.ok(manifests[7].costPer1000Messages.s5LunaValidatedProviderUsd > 0)
assert.ok(manifests[7].costPer1000Messages.localQwenAlwaysOnServerUsdMonthly > 0)
assert.equal(manifests[8].cases, 150)
assert.equal(manifests[8].answers, 600)
assert.equal(manifests[8].boundaries.codexIsNotHumanEvaluator, true)
assert.equal(manifests[8].boundaries.finalWinnerAllowed, false)
assert.equal(manifests[9].finalists.length, 3)
assert.deepEqual(manifests[9].finalists.map((row) => row.architecture), ["S1", "S2", "S5"])
assert.equal(manifests[9].qwenDecision.finalist, false)
if (!manifests[9].boundaries.independentHumanEvaluationComplete) {
  assert.equal(manifests[9].productionWinner, null)
  assert.equal(manifests[10].activation.internalOrPercentRolloutAllowed, false)
}
assert.equal(manifests[10].legacyFallback.guaranteed, true)
assert.equal(Object.keys(manifests[10].independentFlags).length, 8)
assert.deepEqual(manifests[10].sequence, ["local_shadow", "production_shadow", "internal", "10", "50", "100"])
for (const phase of [7, 8, 9, 10]) {
  const root = path.join(ROOT, `docs/dna-intelligence/architecture-tournament/v2/phase-${phase}`)
  for (const line of readFileSync(path.join(root, "SHA256SUMS"), "utf8").trim().split("\n")) {
    const [expected, name] = line.split(/\s{2}/)
    assert.equal(sha(readFileSync(path.join(root, name))), expected)
  }
}
console.log(JSON.stringify({ ok: true, assertions: 36, phase9: manifests[9].status, phase10: manifests[10].status }))
