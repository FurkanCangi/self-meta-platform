import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { prepareStudentVisibleEvaluation } from "./dna-student-visible-evaluation-input"
import { createStudentApplicationReplaySession, replayHash } from "./dna-student-application-replay"
import { studentCandidateSha256 } from "./dna-student-candidate-identity"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { emptyStudentApplicationState } from "../src/lib/dna/chat/studentFirst/applicationContext.server"

const previousEnv = { ...process.env }
async function main() {
  globalThis.fetch = async () => { throw new Error("external_network_forbidden") }
  Object.assign(process.env, { NODE_ENV: "test", DNA_CHAT_STUDENT_LOCAL_CANDIDATE: "1", DNA_CHAT_RUNTIME_RELEASE: "v2",
    DNA_CHAT_V3_KILL_SWITCH: "0", DNA_CHAT_V3_ROLLOUT_PERCENT: "0" })
  delete process.env.VERCEL_ENV
  let mockCalls = 0
  const execute: typeof executeStudentAnswer = (request) => executeStudentAnswer({ ...request, apiKey: "synthetic-not-real",
    fetchImpl: async (_url, init) => {
      mockCalls++
      const input = JSON.parse(JSON.parse(String(init?.body)).input) as {
        answerSlots: Array<{ slotId: string; activeTargets: Array<{ title: string }> }> }
      return new Response(JSON.stringify({ id: "synthetic-expectation-control", output_text: JSON.stringify({
        blocks: Object.fromEntries(input.answerSlots.map((slot) => [slot.slotId,
          `${slot.activeTargets.map((target) => target.title).join(" ve ")} için kaynak bilgisine dayalı bir açıklama veriyorum.`])),
        illustrationKind: "none" }), usage: { input_tokens: 10, output_tokens: 10 } }),
      { status: 200, headers: { "Content-Type": "application/json" } })
    } })
  const candidate = studentCandidateSha256()
  const options = { candidateSha256: candidate, replaySha256: replayHash("visible-expectation-local-controls"),
    sessionId: "visible-expectation-controls", secret: "synthetic-local-expectation-secret-at-least-32", execute }
  const session = createStudentApplicationReplaySession(options)
  const request = { question: "duyusal regülasyon nedir" }
  const student = await session.turn(request)
  assert.equal(student.status, 200)
  const observed = prepareStudentVisibleEvaluation({ request, replay: student, stateBefore: null })
  assert.ok(observed.ok)
  assert.equal(observed.authority, "OBSERVED_STUDENT_EXECUTION")
  assert.equal(observed.contract, student.student?.contract)
  assert.equal(observed.plan, student.student?.result.plan)
  const oneHourBytes = readFileSync("scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json")
  assert.equal(replayHash(oneHourBytes), "8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1")
  const oneHour = JSON.parse(oneHourBytes.toString()) as { turns: Array<{ turnId: string; user: string }> }
  const treatment = oneHour.turns.find((turn) => turn.turnId === "ONEHOUR24-T21")!
  assert.ok(treatment)
  const treatmentRequest = { question: treatment.user }
  const before = session.state()
  const normal = await session.turn(treatmentRequest)
  assert.equal(normal.status, 200)
  assert.equal(normal.body.classification, "refusal")
  assert.equal(normal.body.runtimeGeneration, "student_first_candidate")
  assert.equal(normal.body.engineVersion, "dna-student-application-refusal@2")
  assert.equal(normal.student, null)
  const after = JSON.stringify(session.state())
  const beforeJudgeInputCalls = mockCalls
  const normalExpectation = prepareStudentVisibleEvaluation({ request: treatmentRequest, replay: normal, stateBefore: before })
  assert.ok(normalExpectation.ok, JSON.stringify(normalExpectation))
  assert.equal(normalExpectation.authority, "REQUEST_EXPECTATION_NOT_EXECUTED_BY_NORMAL_RUNTIME")
  assert.equal(normalExpectation.contract.semanticTask, "treatment_boundary")
  assert.equal(normalExpectation.plan.executionRoute, "local_safety_boundary")
  assert.ok(normalExpectation.plan.policyUnits.length > 0)
  assert.equal(normal.student, null, "evaluation must not forge an executed student plan")
  assert.equal(JSON.stringify(session.state()), after, "evaluation must not advance runtime state")
  assert.equal(mockCalls, beforeJudgeInputCalls, "evaluation preparation must not call a provider")
  assert.equal(prepareStudentVisibleEvaluation({ request: { question: "farklı soru" }, replay: normal, stateBefore: before }).ok, false)
  assert.equal(prepareStudentVisibleEvaluation({ request: treatmentRequest, replay: normal, stateBefore: emptyStudentApplicationState(null) }).ok, false)
  const reportRequest = { question: "Bu raporu özetle", reportId: "22222222-2222-4222-8222-222222222222",
    reportContext: { dataStatus: "synthetic" as const, ageMonths: 48, scores: { sensory: 31 } } }
  const reportBefore = session.state()
  const report = await session.turn(reportRequest)
  assert.equal(report.status, 200)
  const reportEvaluation = prepareStudentVisibleEvaluation({ request: reportRequest, replay: report, stateBefore: reportBefore })
  assert.deepEqual(reportEvaluation, { ok: false, reason: "report_expectation_requires_report_bound_evaluation" })
  const unsupported = createStudentApplicationReplaySession({ ...options, sessionId: "generic-conversation" })
  const greetingRequest = { question: "merhaba" }
  const greeting = await unsupported.turn(greetingRequest)
  assert.equal(greeting.status, 200)
  const greetingEvaluation = prepareStudentVisibleEvaluation({ request: greetingRequest, replay: greeting, stateBefore: null })
  assert.equal(greetingEvaluation.ok, false, "no artificial student contract for unsupported expectation")

  for (const file of ["scripts/run-dna-student-one-hour-visible.ts", "scripts/run-dna-student-b1-visible-student40.ts"]) {
    const code = readFileSync(file, "utf8")
    assert.ok(code.includes("prepareStudentVisibleEvaluation({ request, replay, stateBefore })"))
    assert.ok(code.includes("journalApplicationTurn(journal"))
    assert.equal(code.includes("executeStudentAnswer("), false)
  }
  const student40Bytes = readFileSync("scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json")
  assert.equal(replayHash(student40Bytes), "e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65")
  console.log(JSON.stringify({ ok: true, candidateSha256: candidate, observedStudentExpectation: true,
    normalTreatmentReplyEvaluableWithoutForgedExecution: true, requestAndPriorStateBoundToReceipt: true,
    reportAndUnresolvedExpectationsNotAutoPassed: true, stateMutationDuringEvaluation: false,
    mockProviderCalls: mockCalls, externalProviderCalls: 0, semanticQualityCertified: false,
    limitation: "ONEHOUR24-T21 is a local boundary control after one scientific turn, not a complete 24-turn replay" }, null, 2))
}
main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => {
  for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key]
  Object.assign(process.env, previousEnv)
})
