import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const STUDENT40_PATH = "scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json"
const EXPECTED_STUDENT40_SHA256 = "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65"

type CandidateEvidence = Readonly<{
  candidate: number
  reportPath: string
  failureTurns: readonly string[]
  criticalSignals: readonly ("target" | "referent" | "history_action" | "provider_frame" | "obligation")[]
  costMicrousd: number
  requiredSnippets: readonly string[]
}>

const EVIDENCE: readonly CandidateEvidence[] = Object.freeze([
  {
    candidate: 11,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE11_HARD_STOP.md",
    failureTurns: ["STUDENT40-C01-T04", "STUDENT40-C01-T06", "STUDENT40-C02-T03"],
    criticalSignals: ["referent"],
    costMicrousd: 30_133,
    requiredSnippets: ["Evaluated turns: 11/40", "Wrong referent: 1", "30,133 micro-USD"],
  },
  {
    candidate: 12,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE12_HARD_STOP.md",
    failureTurns: ["STUDENT40-C02-T03", "STUDENT40-C02-T04"],
    criticalSignals: ["referent"],
    costMicrousd: 37_883,
    requiredSnippets: ["Evaluated turns: 12/40", "Wrong referent: 1", "37,883 micro-USD"],
  },
  {
    candidate: 13,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE13_HARD_STOP.md",
    failureTurns: ["STUDENT40-C01-T05"],
    criticalSignals: ["target"],
    costMicrousd: 23_740,
    requiredSnippets: ["Evaluated: 5/40", "Wrong target: 1", "23,740 micro-USD"],
  },
  {
    candidate: 14,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE14_HARD_STOP.md",
    failureTurns: ["STUDENT40-C02-T02"],
    criticalSignals: ["referent"],
    costMicrousd: 33_245,
    requiredSnippets: ["Evaluated: 10/40", "Wrong referent: 1", "33,245 micro-USD"],
  },
  {
    candidate: 15,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE15_HARD_STOP.md",
    failureTurns: ["STUDENT40-C02-T04", "STUDENT40-C02-T05"],
    criticalSignals: ["target"],
    costMicrousd: 39_819,
    requiredSnippets: ["Evaluated: 13/40", "Wrong target: 1", "39,819 micro-USD"],
  },
  {
    candidate: 16,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE16_HARD_STOP.md",
    failureTurns: ["STUDENT40-C01-T06", "STUDENT40-C02-T04", "STUDENT40-C02-T06"],
    criticalSignals: ["provider_frame"],
    costMicrousd: 41_757,
    requiredSnippets: ["invalid_structured_output/invalid_semantic_acts", "41,757 micro-USD"],
  },
  {
    candidate: 17,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE17_HARD_STOP.md",
    failureTurns: ["STUDENT40-C02-T04", "STUDENT40-C02-T05"],
    criticalSignals: ["referent"],
    costMicrousd: 28_556,
    requiredSnippets: ["Evaluated: 13/40", "Wrong referent: 1", "28,556 micro-USD"],
  },
  {
    candidate: 18,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE18_HARD_STOP.md",
    failureTurns: ["STUDENT40-C01-T06", "STUDENT40-C02-T03", "STUDENT40-C02-T04", "STUDENT40-C02-T05"],
    criticalSignals: ["target", "history_action"],
    costMicrousd: 65_782,
    requiredSnippets: ["Wrong referent: 0", "Wrong history/action: 1", "65,782 micro-USD"],
  },
  {
    candidate: 19,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE19_HARD_STOP.md",
    failureTurns: ["STUDENT40-C01-T07", "STUDENT40-C02-T04", "STUDENT40-C02-T06"],
    criticalSignals: ["provider_frame"],
    costMicrousd: 47_503,
    requiredSnippets: ["invalid_structured_output/invalid_semantic_acts", "47,503 micro-USD"],
  },
  {
    candidate: 20,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE20_HARD_STOP.md",
    failureTurns: ["STUDENT40-C01-T06", "STUDENT40-C01-T07", "STUDENT40-C02-T03", "STUDENT40-C02-T04", "STUDENT40-C02-T06"],
    criticalSignals: ["history_action"],
    costMicrousd: 66_817,
    requiredSnippets: ["Exact Smoke8 — PASS", "Wrong history/action: 1", "66,817 micro-USD"],
  },
  {
    candidate: 21,
    reportPath: "docs/dna-intelligence/student-first/PHASE2_CANDIDATE21_HARD_STOP.md",
    failureTurns: ["SMOKE8-T04"],
    criticalSignals: ["obligation"],
    costMicrousd: 7_239,
    requiredSnippets: ["Correct contracts before stop: 3/8", "Unexpected extra obligation: `give_concrete_example`", "7,239 micro-USD"],
  },
])

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function countBy(values: readonly string[]): Readonly<Record<string, number>> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.freeze(Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))))
}

const fixtureBytes = readFileSync(STUDENT40_PATH)
assert.equal(sha256(fixtureBytes), EXPECTED_STUDENT40_SHA256, "Student40 fixture changed")
const fixture = JSON.parse(fixtureBytes.toString("utf8")) as Readonly<{
  conversations: readonly Readonly<{ turns: readonly Readonly<{ turnId: string }>[] }>[]
}>
const fixtureTurnIds = fixture.conversations.flatMap((conversation) => conversation.turns.map((turn) => turn.turnId))
assert.equal(fixture.conversations.length, 5)
assert.equal(fixtureTurnIds.length, 40)
assert.equal(new Set(fixtureTurnIds).size, 40)

for (const row of EVIDENCE) {
  const report = readFileSync(row.reportPath, "utf8")
  for (const snippet of row.requiredSnippets) {
    assert.ok(report.includes(snippet), `candidate ${row.candidate} evidence drift: ${snippet}`)
  }
  for (const turnId of row.failureTurns.filter((turn) => turn.startsWith("STUDENT40-"))) {
    assert.ok(fixtureTurnIds.includes(turnId), `candidate ${row.candidate} references unknown Student40 turn ${turnId}`)
    assert.ok(report.includes(turnId), `candidate ${row.candidate} report omits ${turnId}`)
  }
}

const obligationCompiler = readFileSync("src/lib/dna/chat/studentFirst/obligationCompiler.ts", "utf8")
const contracts = readFileSync("src/lib/dna/chat/studentFirst/contracts.ts", "utf8")
assert.ok(obligationCompiler.includes('input.presentation.example !== "none"'), "expected presentation-owned example obligation not found")
assert.ok(obligationCompiler.includes("semanticTask: StudentSemanticTask"), "expected singular semantic task compiler input not found")
assert.ok(!contracts.includes("requestedSemanticTasks"), "batch diagnosis must be updated: requested semantic tasks already persist")

const student40FailureTurns = EVIDENCE.flatMap((row) => row.failureTurns).filter((turn) => turn.startsWith("STUDENT40-"))
const failureTurnCounts = countBy(student40FailureTurns)
const recurringTurns = Object.entries(failureTurnCounts).filter(([, count]) => count >= 2)
const recurringFailureObservations = recurringTurns.reduce((sum, [, count]) => sum + count, 0)
const criticalSignalCounts = countBy(EVIDENCE.flatMap((row) => row.criticalSignals))
const totalEvidenceCostMicrousd = EVIDENCE.reduce((sum, row) => sum + row.costMicrousd, 0)

assert.equal(student40FailureTurns.length, 26)
assert.equal(recurringTurns.length, 6)
assert.equal(recurringFailureObservations, 23)
assert.equal(totalEvidenceCostMicrousd, 422_474)
assert.deepEqual(criticalSignalCounts, {
  referent: 4,
  target: 3,
  provider_frame: 2,
  history_action: 2,
  obligation: 1,
})

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_BATCH_FAILURE_MAP_LOCAL",
  sources: {
    phase2CandidateReports: EVIDENCE.length,
    student40: {
      conversations: fixture.conversations.length,
      turns: fixtureTurnIds.length,
      sha256: EXPECTED_STUDENT40_SHA256,
    },
    freshStudent60Read: false,
  },
  pattern: {
    student40FailureObservations: student40FailureTurns.length,
    distinctStudent40FailureTurns: Object.keys(failureTurnCounts).length,
    recurringTurns: failureTurnCounts,
    observationsInSixRecurringTurns: recurringFailureObservations,
    recurringConcentrationPercent: Number((recurringFailureObservations / student40FailureTurns.length * 100).toFixed(1)),
    criticalSignals: criticalSignalCounts,
    reportedEvidenceCostMicrousd: totalEvidenceCostMicrousd,
  },
  verifiedArchitectureGap: {
    semanticActsCollapsedBeforeObligationCompilation: true,
    presentationExampleCanCreateContentObligation: true,
    requestedSemanticTasksPersistedInContract: false,
    unchangedSmokePassedCandidate20ButFailedCandidate21BeforeTargetedTurn: true,
  },
  selectedStructuralBoundary: {
    name: "semantic-acts-own-content-obligations",
    rule: "Content obligations come from all explicit semantic acts; presentation fields only shape delivery.",
    preserveAllExplicitActs: true,
    presentationMayCreateContentObligation: false,
    primaryTaskRemainsRoutingLabelOnly: true,
  },
}, null, 2))
