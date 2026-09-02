import assert from "node:assert/strict"
import dotenv from "dotenv"

import { calculateDnaChatLunaUsage, sumDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import {
  applyStudentRequestContract,
  createEmptyStudentConversationState,
  type StudentConversationState,
} from "../src/lib/dna/chat/studentFirst"
import {
  DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN,
  interpretStudentRequestWithEvidenceFirstProvider,
} from "../src/lib/dna/chat/studentFirst/evidenceFirstInterpreter.server"

dotenv.config({ path: ".env.local", override: false, quiet: true })

type SmokeExpectation = Readonly<{
  turnId: string
  message: string
  semanticTask: string
  conversationAction: string
  targetIds: readonly string[]
  rejectedTargetIds?: readonly string[]
  comparisonTargetIds?: readonly string[]
  referentTurnId?: string
  referentRole?: string
  obligationKinds: readonly string[]
  language?: "plain_student"
  sentenceCount?: number
  preserveMeaning?: boolean
  example?: "none" | "brief" | "concrete"
  summary?: Readonly<{ known: boolean; unknown: boolean; observationFocus: boolean }>
  observation?: Readonly<{ singleObservationLimit: boolean; additionalContext: boolean }>
}>

const SMOKE8: readonly SmokeExpectation[] = Object.freeze([
  {
    turnId: "B1-SMOKE8-T01",
    message: "hocam yürütücü işlevler tam ne demek öğrenci arkadaşına anlatır gibi söyler misin",
    semanticTask: "define",
    conversationAction: "start",
    targetIds: ["executive_functions"],
    obligationKinds: ["define_target"],
    language: "plain_student",
  },
  {
    turnId: "B1-SMOKE8-T02",
    message: "dürtüyü durdurmak bununla aynı şey mi yoksa içindeki parçalardan biri mi",
    semanticTask: "compare",
    conversationAction: "continue",
    targetIds: ["executive_functions", "inhibition"],
    comparisonTargetIds: ["executive_functions", "inhibition"],
    referentTurnId: "B1-SMOKE8-T01",
    referentRole: "utterance",
    obligationKinds: ["distinguish_targets", "explain_relation"],
  },
  {
    turnId: "B1-SMOKE8-T03",
    message: "inhibisyon için derste sırasını bekleyemeyen bi çocuk üzerinden minicik örnek ver",
    semanticTask: "example",
    conversationAction: "continue",
    targetIds: ["inhibition"],
    obligationKinds: ["give_concrete_example", "bind_example_to_target"],
    example: "concrete",
  },
  {
    turnId: "B1-SMOKE8-T04",
    message: "bu örnekte tek gözlemle inhibisyonu zayıf diyebilir miyim başka neye bakarım",
    semanticTask: "observe",
    conversationAction: "continue",
    targetIds: ["inhibition"],
    referentTurnId: "B1-SMOKE8-T03",
    referentRole: "case_entity",
    obligationKinds: ["state_single_observation_limit", "name_additional_context"],
    observation: { singleObservationLimit: true, additionalContext: true },
  },
  {
    turnId: "B1-SMOKE8-T05",
    message: "yok inhibisyon kısmını sormuyorum yönergeyi aklında tutamaması çalışma belleği açısından ne demek",
    semanticTask: "define",
    conversationAction: "repair",
    targetIds: ["working_memory"],
    rejectedTargetIds: ["inhibition"],
    obligationKinds: ["define_target", "honor_rejected_target"],
  },
  {
    turnId: "B1-SMOKE8-T06",
    message: "ilk anlattığın yürütücü işlevlere dönelim çok akademik olmadan yeniden söyle",
    semanticTask: "define",
    conversationAction: "return",
    targetIds: ["executive_functions"],
    referentTurnId: "B1-SMOKE8-T01",
    referentRole: "utterance",
    obligationKinds: ["define_target", "use_history_anchor", "preserve_target_while_simplifying"],
    language: "plain_student",
    preserveMeaning: true,
  },
  {
    turnId: "B1-SMOKE8-T07",
    message: "planlama ile çalışma belleğinin farkını bu sefer düz anlat",
    semanticTask: "compare",
    conversationAction: "continue",
    targetIds: ["planning", "working_memory"],
    comparisonTargetIds: ["planning", "working_memory"],
    obligationKinds: ["distinguish_targets", "explain_relation"],
    language: "plain_student",
  },
  {
    turnId: "B1-SMOKE8-T08",
    message: "şimdi konuştuklarımızı üç cümlede toparla neyi biliyoruz neyi bilmiyoruz gözlemde neye bakarım",
    semanticTask: "summarize",
    conversationAction: "summarize_session",
    targetIds: ["executive_functions", "inhibition", "working_memory", "planning"],
    obligationKinds: ["summarize_known", "summarize_unknown", "summarize_observation_focus"],
    sentenceCount: 3,
    summary: { known: true, unknown: true, observationFocus: true },
  },
])

function sorted(values: readonly string[]): string[] {
  return [...values].sort()
}

async function main() {
  assert.ok(process.env.OPENAI_API_KEY?.trim(), "existing OPENAI_API_KEY is required after provider preflight")
  let state: StudentConversationState = createEmptyStudentConversationState()
  const usageRows: DnaChatLunaUsage[] = []
  const latencies: number[] = []
  let calls = 0
  let transportRetries = 0
  let partialUsageTurns = 0
  for (const expected of SMOKE8) {
    const result = await interpretStudentRequestWithEvidenceFirstProvider({
      turnId: expected.turnId,
      message: expected.message,
      state,
    })
    if ("provider" in result) {
      calls += result.provider.attempts
      transportRetries += result.provider.transportRetries
      if (!result.provider.usageComplete) partialUsageTurns += 1
      usageRows.push(calculateDnaChatLunaUsage(result.provider.usage))
      latencies.push(result.provider.latencyMs)
    }
    if (!result.ok) throw new Error(`${expected.turnId}: ${result.reason}${"failureCode" in result ? `/${result.failureCode}` : ""}`)
    const contract = result.contract
    assert.equal(contract.semanticTask, expected.semanticTask, `${expected.turnId}: task`)
    assert.equal(contract.conversationAction, expected.conversationAction, `${expected.turnId}: action`)
    assert.deepEqual(sorted(contract.targetIds), sorted(expected.targetIds), `${expected.turnId}: targets`)
    assert.deepEqual(sorted(contract.rejectedTargetIds), sorted(expected.rejectedTargetIds ?? []), `${expected.turnId}: rejections`)
    assert.deepEqual(sorted(contract.comparisonTargetIds), sorted(expected.comparisonTargetIds ?? []), `${expected.turnId}: comparison`)
    assert.deepEqual(sorted(contract.obligations.map((row) => row.kind)), sorted(expected.obligationKinds), `${expected.turnId}: obligations`)
    if (expected.referentTurnId) {
      assert.equal(contract.referent.turnId, expected.referentTurnId, `${expected.turnId}: referent`)
      assert.equal(contract.referent.role, expected.referentRole, `${expected.turnId}: referent role`)
    }
    if (expected.language) assert.equal(contract.presentation.language, expected.language, `${expected.turnId}: language`)
    assert.equal(contract.presentation.requestedSentenceCount, expected.sentenceCount ?? null, `${expected.turnId}: sentence count`)
    assert.equal(contract.presentation.preserveMeaning, expected.preserveMeaning ?? false, `${expected.turnId}: preserve meaning`)
    assert.equal(contract.presentation.example, expected.example ?? "none", `${expected.turnId}: example`)
    assert.deepEqual(contract.summaryScope, expected.summary ?? { known: false, unknown: false, observationFocus: false }, `${expected.turnId}: summary`)
    assert.deepEqual(contract.observationScope, expected.observation ?? { singleObservationLimit: false, additionalContext: false }, `${expected.turnId}: observation`)
    state = applyStudentRequestContract(state, contract)
    assert.equal(JSON.stringify(state).includes(expected.message), false, `${expected.turnId}: raw message persisted`)
  }
  const usage = sumDnaChatLunaUsage(usageRows)
  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_B1_SMOKE8",
    turns: 8,
    semanticContractsCorrect: 8,
    rawMessagesPersisted: 0,
    provider: {
      calls,
      usage,
      averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
      transportRetries,
      partialUsageTurns,
      maxProviderCallsPerTurn: DNA_STUDENT_EVIDENCE_FIRST_MAX_PROVIDER_CALLS_PER_TURN,
    },
  }, null, 2))
}

void main().catch((error) => {
  console.error(JSON.stringify({ ok: false, gate: "STUDENT_B1_SMOKE8", failure: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 1
})
