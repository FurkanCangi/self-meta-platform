import assert from "node:assert/strict"
import dotenv from "dotenv"

import { DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS } from "../src/lib/dna/chat/catalog"
import { calculateDnaChatLunaUsage, sumDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  scoreStudentSet,
  type StudentConversationState,
  type StudentTurnAdjudication,
} from "../src/lib/dna/chat/studentFirst"
import { interpretStudentRequestWithProvider } from "../src/lib/dna/chat/studentFirst/semanticInterpreter.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

type SmokeExpectation = Readonly<{
  turnId: string
  message: string
  semanticTask: string
  conversationAction: string
  targetIds: readonly string[]
  rejectedTargetIds?: readonly string[]
  comparisonTargetIds?: readonly string[]
  referent?: Readonly<{ kind: string; turnId: string | null }>
  obligationKinds: readonly string[]
  plainStudent?: boolean
  requestedSentenceCount?: number
}>

const SMOKE8: readonly SmokeExpectation[] = Object.freeze([
  {
    turnId: "SMOKE8-T01",
    message: "hocam yürütücü işlevler tam ne demek öğrenci arkadaşına anlatır gibi söyler misin",
    semanticTask: "define",
    conversationAction: "start",
    targetIds: ["executive_functions"],
    obligationKinds: ["define_target"],
    plainStudent: true,
  },
  {
    turnId: "SMOKE8-T02",
    message: "dürtüyü durdurmak bununla aynı şey mi yoksa içindeki parçalardan biri mi",
    semanticTask: "compare",
    conversationAction: "continue",
    targetIds: ["executive_functions", "inhibition"],
    comparisonTargetIds: ["executive_functions", "inhibition"],
    referent: { kind: "active", turnId: "SMOKE8-T01" },
    obligationKinds: ["distinguish_targets", "explain_relation"],
  },
  {
    turnId: "SMOKE8-T03",
    message: "inhibisyon için derste sırasını bekleyemeyen bi çocuk üzerinden minicik örnek ver",
    semanticTask: "example",
    conversationAction: "continue",
    targetIds: ["inhibition"],
    obligationKinds: ["give_concrete_example", "bind_example_to_target"],
  },
  {
    turnId: "SMOKE8-T04",
    message: "bu örnekte tek gözlemle inhibisyonu zayıf diyebilir miyim başka neye bakarım",
    semanticTask: "observe",
    conversationAction: "continue",
    targetIds: ["inhibition"],
    referent: { kind: "active", turnId: "SMOKE8-T03" },
    obligationKinds: ["state_single_observation_limit", "name_additional_context"],
  },
  {
    turnId: "SMOKE8-T05",
    message: "yok inhibisyon kısmını sormuyorum yönergeyi aklında tutamaması çalışma belleği açısından ne demek",
    semanticTask: "define",
    conversationAction: "repair",
    targetIds: ["working_memory"],
    rejectedTargetIds: ["inhibition"],
    obligationKinds: ["define_target", "honor_rejected_target"],
  },
  {
    turnId: "SMOKE8-T06",
    message: "ilk anlattığın yürütücü işlevlere dönelim çok akademik olmadan yeniden söyle",
    semanticTask: "define",
    conversationAction: "return",
    targetIds: ["executive_functions"],
    referent: { kind: "history", turnId: "SMOKE8-T01" },
    obligationKinds: ["define_target", "use_history_anchor", "preserve_target_while_simplifying"],
    plainStudent: true,
  },
  {
    turnId: "SMOKE8-T07",
    message: "planlama ile çalışma belleğinin farkını bu sefer düz anlat",
    semanticTask: "compare",
    conversationAction: "continue",
    targetIds: ["planning", "working_memory"],
    comparisonTargetIds: ["planning", "working_memory"],
    obligationKinds: ["distinguish_targets", "explain_relation"],
    plainStudent: true,
  },
  {
    turnId: "SMOKE8-T08",
    message: "şimdi konuştuklarımızı üç cümlede toparla neyi biliyoruz neyi bilmiyoruz gözlemde neye bakarım",
    semanticTask: "summarize",
    conversationAction: "summarize_session",
    targetIds: ["executive_functions", "inhibition", "working_memory", "planning"],
    obligationKinds: ["summarize_known", "summarize_unknown", "summarize_observation_focus"],
    requestedSentenceCount: 3,
  },
])

function sorted(values: readonly string[]): string[] {
  return [...values].sort()
}

const MAX_PROVIDER_CALLS = 8
const MAX_COST_MICROUSD = 100_000

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required")
  let state: StudentConversationState = createEmptyStudentConversationState()
  const usageRows: DnaChatLunaUsage[] = []
  const latencies: number[] = []
  let providerCalls = 0

  for (const expected of SMOKE8) {
    assert.ok(providerCalls < MAX_PROVIDER_CALLS, "provider call cap exceeded")
    assert.ok(sumDnaChatLunaUsage(usageRows).costMicrousd <= MAX_COST_MICROUSD, "provider cost cap exceeded")
    providerCalls += 1
    const interpreted = await interpretStudentRequestWithProvider({
      turnId: expected.turnId,
      message: expected.message,
      state,
    })
    if (!interpreted.ok) throw new Error(`${expected.turnId}: ${interpreted.reason}`)
    const contract = interpreted.contract
    usageRows.push(calculateDnaChatLunaUsage(interpreted.provider.usage))
    latencies.push(interpreted.provider.latencyMs)

    assert.equal(contract.semanticTask, expected.semanticTask, `${expected.turnId}: semantic task`)
    assert.equal(contract.conversationAction, expected.conversationAction, `${expected.turnId}: conversation action`)
    assert.deepEqual(sorted(contract.targetIds), sorted(expected.targetIds), `${expected.turnId}: targets`)
    assert.deepEqual(sorted(contract.rejectedTargetIds), sorted(expected.rejectedTargetIds ?? []), `${expected.turnId}: rejected targets`)
    assert.deepEqual(sorted(contract.comparisonTargetIds), sorted(expected.comparisonTargetIds ?? []), `${expected.turnId}: comparison targets`)
    assert.equal(contract.ambiguity, "none", `${expected.turnId}: ambiguity`)
    assert.deepEqual(sorted(contract.obligations.map((item) => item.kind)), sorted(expected.obligationKinds), `${expected.turnId}: obligations`)
    if (expected.referent) {
      assert.equal(contract.referent.kind, expected.referent.kind, `${expected.turnId}: referent kind`)
      assert.equal(contract.referent.turnId, expected.referent.turnId, `${expected.turnId}: referent turn`)
    }
    if (expected.plainStudent) assert.equal(contract.presentation.language, "plain_student", `${expected.turnId}: plain language`)
    if (expected.requestedSentenceCount) {
      assert.equal(contract.presentation.requestedSentenceCount, expected.requestedSentenceCount, `${expected.turnId}: sentence count`)
    }
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

  const totalUsage = sumDnaChatLunaUsage(usageRows)
  assert.ok(totalUsage.costMicrousd <= MAX_COST_MICROUSD, "provider cost cap exceeded")
  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_SMOKE8",
    turns: SMOKE8.length,
    semanticContractsCorrect: 8,
    rawMessagesPersisted: 0,
    answeredExcludedFromQualityScore: true,
    benchmarkCatalogReconciliation: "benchmark.six-domains.s-020=>cns.reverse_inference",
    provider: {
      calls: providerCalls,
      usage: totalUsage,
      averageLatencyMs: Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length),
      maxCostMicrousd: MAX_COST_MICROUSD,
    },
    finalState: {
      activeTargetIds: state.activeTargetIds,
      rejectedTargetIds: state.rejectedTargetIds,
      compactSummaryLength: state.compactSummary.length,
    },
  }, null, 2))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
