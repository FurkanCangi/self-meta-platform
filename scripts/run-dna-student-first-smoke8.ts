import assert from "node:assert/strict"

import { DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS } from "../src/lib/dna/chat/catalog"
import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  interpretStudentRequest,
  scoreStudentSet,
  type StudentConversationState,
  type StudentTurnAdjudication,
} from "../src/lib/dna/chat/studentFirst"

type SmokeExpectation = Readonly<{
  turnId: string
  message: string
  operation: string
  targetIds: readonly string[]
  rejectedTargetIds?: readonly string[]
  comparisonTargetIds?: readonly string[]
  referent?: Readonly<{ kind: string; turnId: string | null }>
  obligationKinds: readonly string[]
  plainStudent?: boolean
}>

const SMOKE8: readonly SmokeExpectation[] = Object.freeze([
  {
    turnId: "SMOKE8-T01",
    message: "hocam yürütücü işlevler tam ne demek öğrenci arkadaşına anlatır gibi söyler misin",
    operation: "define",
    targetIds: ["executive_functions"],
    obligationKinds: ["define_target"],
    plainStudent: true,
  },
  {
    turnId: "SMOKE8-T02",
    message: "dürtüyü durdurmak bununla aynı şey mi yoksa içindeki parçalardan biri mi",
    operation: "compare",
    targetIds: ["executive_functions", "inhibition"],
    comparisonTargetIds: ["executive_functions", "inhibition"],
    referent: { kind: "active", turnId: "SMOKE8-T01" },
    obligationKinds: ["distinguish_targets", "explain_relation"],
  },
  {
    turnId: "SMOKE8-T03",
    message: "inhibisyon için derste sırasını bekleyemeyen bi çocuk üzerinden minicik örnek ver",
    operation: "example",
    targetIds: ["inhibition"],
    obligationKinds: ["give_concrete_example", "bind_example_to_target"],
  },
  {
    turnId: "SMOKE8-T04",
    message: "bu örnekte tek gözlemle inhibisyonu zayıf diyebilir miyim başka neye bakarım",
    operation: "observe",
    targetIds: ["inhibition"],
    referent: { kind: "active", turnId: "SMOKE8-T03" },
    obligationKinds: ["state_single_observation_limit", "name_additional_context"],
  },
  {
    turnId: "SMOKE8-T05",
    message: "yok inhibisyon kısmını sormuyorum yönergeyi aklında tutamaması çalışma belleği açısından ne demek",
    operation: "repair",
    targetIds: ["working_memory"],
    rejectedTargetIds: ["inhibition"],
    obligationKinds: ["honor_rejected_target"],
  },
  {
    turnId: "SMOKE8-T06",
    message: "ilk anlattığın yürütücü işlevlere dönelim çok akademik olmadan yeniden söyle",
    operation: "return",
    targetIds: ["executive_functions"],
    referent: { kind: "history", turnId: "SMOKE8-T01" },
    obligationKinds: ["use_history_anchor"],
    plainStudent: true,
  },
  {
    turnId: "SMOKE8-T07",
    message: "planlama ile çalışma belleğinin farkını bu sefer düz anlat",
    operation: "compare",
    targetIds: ["planning", "working_memory"],
    comparisonTargetIds: ["planning", "working_memory"],
    obligationKinds: ["distinguish_targets", "explain_relation"],
    plainStudent: true,
  },
  {
    turnId: "SMOKE8-T08",
    message: "şimdi konuştuklarımızı üç cümlede toparla neyi biliyoruz neyi bilmiyoruz gözlemde neye bakarım",
    operation: "summarize",
    targetIds: ["executive_functions", "inhibition", "working_memory", "planning"],
    obligationKinds: ["summarize_known", "summarize_unknown", "summarize_observation_focus"],
  },
])

function sorted(values: readonly string[]): string[] {
  return [...values].sort()
}

let state: StudentConversationState = createEmptyStudentConversationState()
for (const expected of SMOKE8) {
  const contract = interpretStudentRequest({ turnId: expected.turnId, message: expected.message, state })
  assert.equal(contract.operation, expected.operation, `${expected.turnId}: operation`)
  assert.deepEqual(sorted(contract.targetIds), sorted(expected.targetIds), `${expected.turnId}: targets`)
  assert.deepEqual(sorted(contract.rejectedTargetIds), sorted(expected.rejectedTargetIds ?? []), `${expected.turnId}: rejected targets`)
  assert.deepEqual(sorted(contract.comparisonTargetIds), sorted(expected.comparisonTargetIds ?? []), `${expected.turnId}: comparison targets`)
  assert.equal(contract.ambiguity, "none", `${expected.turnId}: ambiguity`)
  assert.deepEqual(contract.obligations.map((item) => item.kind), expected.obligationKinds, `${expected.turnId}: obligations`)
  if (expected.referent) {
    assert.equal(contract.referent.kind, expected.referent.kind, `${expected.turnId}: referent kind`)
    assert.equal(contract.referent.turnId, expected.referent.turnId, `${expected.turnId}: referent turn`)
  }
  if (expected.plainStudent) assert.equal(contract.presentation.language, "plain_student", `${expected.turnId}: plain language`)
  state = applyStudentRequestContract(state, contract)
  assert.equal(state.unresolvedObligations.length, contract.obligations.length, `${expected.turnId}: unresolved obligations`)
  assert.doesNotMatch(JSON.stringify(state), new RegExp(expected.message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"), `${expected.turnId}: raw message must not persist`)
}

assert.equal(state.semanticHistory.length, 8)
assert.ok(state.compactSummary.length > 0 && state.compactSummary.length <= 480)
assert.deepEqual(state.rejectedTargetIds, ["inhibition"])
assert.deepEqual(sorted(state.activeTargetIds), sorted(["executive_functions", "inhibition", "working_memory", "planning"]))

const allPass: readonly StudentTurnAdjudication[] = SMOKE8.map((row) => ({
  turnId: row.turnId,
  target: "pass",
  referent: "pass",
  history: "pass",
  components: "pass",
  exampleFormat: "pass",
  safety: "pass",
  boundary: "pass",
  naturalTurkish: 5,
  usefulness: 5,
  notes: [],
  // This deliberately proves that response outcome is not used as a quality proxy.
  responseOutcome: "error",
}))
const perfectScore = scoreStudentSet(allPass, { minimumFullPassRate: 1, requireZeroCriticalFailures: true })
assert.equal(perfectScore.pass, true)
assert.equal(perfectScore.fullPassTurns, 8)

const wrongTargetScore = scoreStudentSet([
  { ...allPass[0], target: "fail", responseOutcome: "answered" },
  ...allPass.slice(1),
], { minimumFullPassRate: 0.875, requireZeroCriticalFailures: true })
assert.equal(wrongTargetScore.fullPassTurns, 7)
assert.equal(wrongTargetScore.wrongTargetCount, 1)
assert.equal(wrongTargetScore.pass, false, "answered telemetry must not hide a wrong target")

const reverseInference = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.find((row) => row.id === "benchmark.six-domains.s-020")
assert.ok(reverseInference)
assert.equal(reverseInference.expectedTopicId, "cns.reverse_inference")
assert.equal(reverseInference.evaluationScope, "supported_answerable")

console.log(JSON.stringify({
  ok: true,
  gate: "STUDENT_SMOKE8",
  turns: SMOKE8.length,
  semanticContractsCorrect: 8,
  rawMessagesPersisted: 0,
  answeredExcludedFromQualityScore: true,
  benchmarkCatalogReconciliation: "benchmark.six-domains.s-020=>cns.reverse_inference",
  finalState: {
    activeTargetIds: state.activeTargetIds,
    rejectedTargetIds: state.rejectedTargetIds,
    compactSummaryLength: state.compactSummary.length,
  },
}, null, 2))
