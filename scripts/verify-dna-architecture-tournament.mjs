import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const phase3Root = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-3")
const phase4Root = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-4")
const phase3 = JSON.parse(readFileSync(path.join(phase3Root, "manifest.json"), "utf8"))
const phase4 = JSON.parse(readFileSync(path.join(phase4Root, "manifest.json"), "utf8"))
const sha = (value) => createHash("sha256").update(value).digest("hex")

assert.equal(phase3.evaluationStatus, "architecture_decision_set_reused_after_phase2_not_independent_generalization")
assert.deepEqual(phase3.shortlist, ["S1", "S2", "S5"])
assert.ok(phase3.architectures.S1.locked.endToEndAccuracy >= phase3.architectures.S2.locked.endToEndAccuracy)
assert.equal(phase3.architectures.S9.decision, "collapsed_to_S1_no_measured_Luna_benefit")
assert.equal(phase3.architectures.S10.decision, "collapsed_to_S1_neural_and_Luna_paths_added_no_value")
assert.equal(phase3.architectures.S4.status, "not_opened")
assert.equal(phase3.architectures.S7.status, "not_opened")
assert.equal(phase3.architectures.S8.status, "not_opened")
assert.equal(phase3.architectures.S11.status, "not_opened")
assert.equal(phase3.architectures.S12.status, "not_opened")
assert.equal(phase3.boundaries.productionAffected, false)
assert.equal(phase3.boundaries.runtimeEligible, false)
assert.equal(phase3.boundaries.releaseEligible, false)
assert.equal(phase3.boundaries.rawQuestionsInRepository, false)
assert.equal(phase3.boundaries.independentBlindHumanEvaluationComplete, false)
for (const id of ["S0", "S1", "S2", "S3", "S5", "S6", "S9", "S10"]) {
  assert.equal(phase4.results[id].decision, "PASS")
  for (const value of Object.values(phase4.results[id].checks)) assert.equal(value, 0)
}
for (const id of ["S4", "S7", "S8", "S11", "S12"]) assert.equal(phase4.results[id].decision, "NOT_OPENED")
assert.deepEqual(phase4.passingShortlist, ["S1", "S2", "S5"])
assert.equal(phase4.validatorInterceptions.displayedAfterFailure, 0)
assert.ok(phase4.validatorInterceptions.intercepted > 0)
for (const root of [phase3Root, phase4Root]) {
  for (const line of readFileSync(path.join(root, "SHA256SUMS"), "utf8").trim().split("\n")) {
    const [expected, name] = line.split(/\s{2}/)
    assert.equal(sha(readFileSync(path.join(root, name))), expected)
  }
}
console.log(JSON.stringify({ ok: true, shortlist: phase3.shortlist, assertions: 68 }))
