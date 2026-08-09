import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const manifestPath = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-2/layer-tournament-manifest.json")
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const sha = (value) => createHash("sha256").update(value).digest("hex")

assert.equal(manifest.status, "automated_layer_tournament_complete_blind_human_preference_pending")
assert.equal(manifest.postSealSelectionRevision.sealedFirstResultPreserved, true)
assert.deepEqual(manifest.layerA.automatedFinalists, ["A1_improved_deterministic", "A2_e5_linear_parser"])
assert.ok(manifest.layerA.A1.topicMacroF1 > manifest.layerA.A0.topicMacroF1)
assert.equal(manifest.layerA.A1.twoQuestionSplitF1, 1)
assert.ok(manifest.layerB.B0.recallAt5 >= .97)
assert.ok(manifest.layerB.B1.recallAt5 >= .97)
assert.equal(manifest.layerB.B2.fullLockedCoverage, false)
assert.equal(manifest.layerB.B2.decision, "eliminated_if_no_material_gain")
assert.deepEqual(manifest.layerC.automatedFinalists, ["C0_existing_deterministic", "C2_retrieve_and_fill"])
for (const method of ["C0", "C1", "C2"]) for (const value of Object.values(manifest.layerC[method].mandatoryZeros)) assert.equal(value, 0)
assert.equal(manifest.layerC.C4.disqualifiedByMandatoryZero, true)
assert.equal(manifest.layerC.C4.sourceFidelityAdjudication.confirmedUnsupportedAdditions, 2)
assert.equal(manifest.boundaries.productionAffected, false)
assert.equal(manifest.boundaries.runtimeEligible, false)
assert.equal(manifest.boundaries.releaseEligible, false)
assert.equal(manifest.boundaries.engineDefault, "legacy")
assert.equal(manifest.boundaries.rawQuestionsInRepository, false)
assert.equal(manifest.boundaries.rawModelAnswersInRepository, false)
assert.equal(manifest.boundaries.independentHumanEvaluationComplete, false)

const sums = readFileSync(path.join(path.dirname(manifestPath), "SHA256SUMS"), "utf8").trim().split("\n")
for (const line of sums) {
  const [expected, name] = line.split(/\s{2}/)
  if (name === "SHA256SUMS") continue
  assert.equal(sha(readFileSync(path.join(path.dirname(manifestPath), name))), expected)
}
console.log(JSON.stringify({ ok: true, status: manifest.status, assertions: 24 }))
