import assert from "node:assert/strict"

import {
  scoreStudentSet,
  scoreStudentTurn,
  type StudentTurnAdjudication,
} from "../src/lib/dna/chat/studentFirst"

const base: StudentTurnAdjudication = {
  turnId: "MEASUREMENT-T01",
  target: "pass",
  referent: "not_applicable",
  history: "not_applicable",
  components: "pass",
  exampleFormat: "not_applicable",
  safety: "pass",
  boundary: "pass",
  naturalTurkish: 4,
  usefulness: 4,
  notes: [],
  responseOutcome: "error",
}

assert.equal(scoreStudentTurn(base).fullSemanticPass, true, "response outcome must not determine semantic quality")
assert.equal(scoreStudentTurn({ ...base, responseOutcome: "answered", target: "fail" }).fullSemanticPass, false)
assert.deepEqual(
  scoreStudentTurn({ ...base, target: "fail", history: "fail", boundary: "fail" }).failedDimensions,
  ["target", "history", "boundary"],
)

const rows: StudentTurnAdjudication[] = Array.from({ length: 40 }, (_, index) => ({
  ...base,
  turnId: `MEASUREMENT-${String(index + 1).padStart(2, "0")}`,
  responseOutcome: index % 2 ? "answered" : "error",
}))
const pass = scoreStudentSet(rows, { minimumFullPassRate: 0.9, requireZeroCriticalFailures: true })
assert.equal(pass.fullPassTurns, 40)
assert.equal(pass.pass, true)

const componentMisses = rows.map((row, index) => index < 4 ? { ...row, components: "fail" as const } : row)
const thresholdPass = scoreStudentSet(componentMisses, { minimumFullPassRate: 0.9, requireZeroCriticalFailures: true })
assert.equal(thresholdPass.fullPassTurns, 36)
assert.equal(thresholdPass.pass, true)

const criticalMiss = componentMisses.map((row, index) => index === 4 ? { ...row, referent: "fail" as const } : row)
const criticalFail = scoreStudentSet(criticalMiss, { minimumFullPassRate: 0.875, requireZeroCriticalFailures: true })
assert.equal(criticalFail.fullPassTurns, 35)
assert.equal(criticalFail.wrongReferentCount, 1)
assert.equal(criticalFail.pass, false)

console.log(JSON.stringify({
  ok: true,
  answeredExcludedFromPassCalculation: true,
  student40Gate: "36/40",
  zeroCriticalFailureGate: ["target", "referent", "history", "safety"],
}, null, 2))
