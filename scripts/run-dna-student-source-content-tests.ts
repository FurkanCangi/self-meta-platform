import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"
import { configuredStudentReplaySession, type StudentReplayTurn } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { replayPublicAnswerBody } from "./dna-replay-public-api"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { resolveStudentApplicationTurn } from "../src/lib/dna/chat/studentFirst/applicationTurn.server"
import { openStudentApplicationContext, sealStudentApplicationContext } from "../src/lib/dna/chat/studentFirst/applicationContext.server"
import { normalizeDnaChatPublicResponse } from "../src/lib/dna/chat/publicResponseNormalizer"
import { buildDnaChatAuditMetadata, type DnaChatApiResolverDependencies } from "../src/lib/dna/chat/apiResolver"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"

// New regression controls, not replacement fixtures, gold, or a semantic judge.
// Authenticate the old paid prefix; rebind it only in memory for mock execution.
dotenv.config({ path: ".env.local", override: false, quiet: true })
const baselineCandidate = "9128fa86dbfe009fbe554d961673923258db4bb1eade2d47a82f5b0d7639d991"
const baselineReplay = "347258d570471987026addba4c770542c1869f46aa3f161dbf494ab22d29166b"
const journalPath = `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/${baselineCandidate}/${baselineReplay}/one-hour24.jsonl`
const journalHash = "9c3fb321978fb99fa10bbaa6c5125b7ba25d4b3909234a9603b4cd21b109040c"
const digest = (value: Buffer | string) => createHash("sha256").update(value).digest("hex")
const contentKind: string = "explain_source_evidence"
type Slot = { slotId: string; obligations: Array<{ kind: string; id: string }>;
  activeTargets: Array<{ targetId: string; lockedClaims: Array<{ claimId: string; text: string; role: string }> }>;
  policyUnits: Array<{ text: string }> }

async function main() {
  globalThis.fetch = async () => { throw new Error("external_network_forbidden") }
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2",
    DNA_CHAT_V3_KILL_SWITCH: "0", DNA_CHAT_V3_ROLLOUT_PERCENT: "0" })
  delete process.env.VERCEL_ENV
  const bytes = readFileSync(journalPath)
  assert.equal(digest(bytes), journalHash)
  const rows = bytes.toString().trim().split("\n").map((line) => JSON.parse(line)) as Array<{
    key: string; stage: string; value: StudentReplayTurn; valueSha256: string
  }>
  const fixtureBytes = readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json")
  assert.equal(digest(fixtureBytes), "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1")
  const fixture = JSON.parse(fixtureBytes.toString()) as { turns: Array<{ turnId: string; user: string }> }
  const session = configuredStudentReplaySession({ candidateSha256: baselineCandidate, replaySha256: baselineReplay,
    sessionId: "synthetic-one-hour24" })
  for (const turn of fixture.turns.slice(0, 18)) {
    const row = rows.find((row) => row.stage === "completed" && row.key === turn.turnId)
    assert.ok(row)
    assert.equal(digest(JSON.stringify(row.value)), row.valueSha256)
    session.restore({ question: turn.user }, row.value)
  }
  const restored = session.state()
  assert.ok(restored)
  assert.equal(restored.sequence, 18)
  const beforeStateHash = digest(JSON.stringify(restored))
  const question = fixture.turns[18]!.user
  assert.equal(question, "öz kontrol için kaynakların ne söylediğini kısa anlat")
  const exact = resolveStudentEvidenceFirstRequest({ turnId: "turn-19", message: question, state: restored.student })
  assert.ok(exact.ok)
  assert.equal(exact.contract.semanticTask, "evidence")
  assert.ok(exact.contract.obligations.some((row) => row.kind === contentKind),
    "source_content_task_lost_before_composition")

  let mockCalls = 0
  let audits = 0
  let providerAssertion: unknown = null
  const normal: DnaChatApiResolverDependencies = {
    createRequestId: () => "source-content-regression",
    resolveRuntimeAnswer: resolveCommittedDnaChatRuntime,
    loadCaseAnswer: async () => { throw new Error("source_question_must_not_load_report") },
    writeAudit: async (audit) => { buildDnaChatAuditMetadata(audit); audits++; return { ok: true } },
  }
  const binding = { secret: "synthetic-source-content-test-secret-not-a-real-key", actorId: "synthetic-source-content-owner",
    conversationId: "11111111-1111-4111-8111-111111111111", candidateSha256: studentCandidateSha256(), nowMs: 1_019_000 }
  let positiveControls = 0
  for (const currentQuestion of [question, "öz kontrol için kaynaklar ne söylüyor", "öz kontrolün kanıtlarını anlat",
    "çalışma belleği için kaynakların ne söylediğini anlat", "öz kontrol ve planlama için kaynaklar ne söylüyor"]) {
    for (const responseDepth of ["short", "standard", "deep"] as const) {
      let expectedContent = ""
      let expectedLimit = ""
      const result = await resolveStudentApplicationTurn({ payload: { question: currentQuestion, responseDepth }, binding,
        contextToken: sealStudentApplicationContext(restored, binding), normal, execute: async (input) => {
          const kinds = input.contract.obligations.map((row) => row.kind as string)
          assert.ok(kinds.includes(contentKind), currentQuestion)
          assert.ok(kinds.includes("state_evidence_limit"), currentQuestion)
          const suppliedClaimIds = new Set<string>()
          const execution = await executeStudentAnswer({ ...input, apiKey: "synthetic-not-a-real-key", fetchImpl: async (_url, init) => {
            try {
              mockCalls++
              const content = JSON.parse(JSON.parse(String(init?.body)).input) as { answerSlots: Slot[] }
              const sourceSlots = content.answerSlots.filter((slot) => slot.obligations.some((row) => row.kind === contentKind))
              const limitSlots = content.answerSlots.filter((slot) => slot.obligations.some((row) => row.kind === "state_evidence_limit"))
              assert.equal(sourceSlots.length, 1)
              assert.equal(limitSlots.length, 1)
              assert.notEqual(sourceSlots[0]!.slotId, limitSlots[0]!.slotId, "limit_must_not_replace_content")
              const sourceClaims = sourceSlots[0]!.activeTargets.flatMap((target) => target.lockedClaims)
              assert.ok(sourceClaims.length >= 2)
              assert.ok(sourceClaims.every((claim) => claim.role !== "contrast"))
              for (const claim of sourceClaims) suppliedClaimIds.add(claim.claimId)
              expectedContent = sourceClaims.map((claim) => claim.text).join(" ")
              expectedLimit = limitSlots[0]!.policyUnits.map((unit) => unit.text).join(" ")
              assert.ok(expectedLimit)
              const blocks = Object.fromEntries(content.answerSlots.map((slot) => [slot.slotId,
                slot.obligations.some((row) => row.kind === contentKind) ? expectedContent : "Sınır uyarısını atlayalım."]))
              return new Response(JSON.stringify({ id: "mock-source-content", output_text: JSON.stringify({ blocks, illustrationKind: "none" }),
                usage: { input_tokens: 80, output_tokens: 50 } }), { status: 200 })
            } catch (error) { providerAssertion = error; throw error }
          } })
          if (providerAssertion) throw providerAssertion
          assert.ok(execution.ok)
          for (const claimId of suppliedClaimIds) assert.ok(execution.candidate.usedClaimIds.includes(claimId), "source_ids_must_survive_projection")
          assert.ok(execution.answer.includes(expectedContent), "source_content_must_survive_postprocessing")
          assert.ok(execution.answer.includes(expectedLimit), "provider_cannot_erase_required_limit")
          return execution
        } })
      if (providerAssertion) throw providerAssertion
      assert.equal(result.status, 200, currentQuestion)
      const publicAnswer = normalizeDnaChatPublicResponse(result.body)
      assert.ok(publicAnswer)
      const visible = replayPublicAnswerBody(publicAnswer)
      assert.ok(visible.includes(expectedContent))
      assert.ok(visible.includes(expectedLimit))
      assert.equal(visible.includes("Sınır uyarısını atlayalım"), false)
      const after = openStudentApplicationContext(publicAnswer.studentContextToken!, binding)
      assert.ok(after)
      assert.equal(after.sequence, 19)
      assert.deepEqual(after.student.semanticLedger.slice(0, 18), restored.student.semanticLedger)
      assert.equal(after.student.unresolvedObligations.length, 0)
      positiveControls++
    }
  }
  const controls = [
    ["öz kontrol nedir", "define_target"],
    ["öz kontrolü açıkla", "explain_target"],
    ["öz kontrol için yalnızca kanıtın sınırını belirt", "state_evidence_limit"],
    ["öz kontrol için kanıtın sınırını ve kavramı açıkla", "explain_target"],
    ["öz kontrolün kanıtlarını özetle", "summarize_known"],
    ["öz kontrol için hangi terapiyi kaynaklara göre seçeyim", "refuse_treatment_selection"],
  ]
  for (const [text, requiredKind] of controls) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "source-negative-control", message: text!,
      state: createEmptyStudentConversationState() })
    assert.ok(resolved.ok, text)
    assert.ok(resolved.contract.obligations.some((row) => row.kind === requiredKind), text)
    assert.equal(resolved.contract.obligations.some((row) => row.kind === contentKind), false, text)
  }
  const mixed = resolveStudentEvidenceFirstRequest({ turnId: "mixed-source-comparison",
    message: "öz kontrol ve planlamayı karşılaştır, kaynaklar ne söylüyor", state: createEmptyStudentConversationState() })
  assert.ok(mixed.ok)
  assert.ok(mixed.contract.obligations.some((row) => row.kind === contentKind))
  assert.ok(mixed.contract.obligations.some((row) => row.kind === "distinguish_targets"))
  assert.equal(digest(JSON.stringify(restored)), beforeStateHash)
  assert.equal(digest(readFileSync(journalPath)), journalHash)
  console.log(JSON.stringify({ ok: true, gate: "STUDENT_SOURCE_CONTENT_LIMIT_SEPARATION", authenticatedHistoricalReceipts: 18,
    originalFailedQuestionPreserved: true, positiveControls, preservedTaskControls: controls.length, mixedComparisonPreserved: true,
    mockCalls, audits, priorStateUnchanged: true, historicalJournalUnchanged: true, externalProviderCalls: 0,
    semanticQualityCertified: false, liveAuthenticatedProof: false }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
