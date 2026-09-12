import assert from "node:assert/strict"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"
import { applyStudentRequestContract } from "../src/lib/dna/chat/studentFirst/conversationState"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { effectiveScenarioEvents, observeStudentScenario, preservesScenarioEvents, scenarioForAnswer } from "../src/lib/dna/chat/studentFirst/scenarioFidelity"

const pairs = [
  ["Öğrenci iki basamaklı yönergeyi unutuyor", "Öğrenci iki basamaklı yönergeyi hatırlıyor"],
  ["Öğrenci görevi yapamıyor", "Öğrenci görevi başarıyor"],
  ["Çocuk etkinliğe geri dönmüyor", "Çocuk etkinliğe geri dönüyor"],
  ["Öğrenci destekle çalışıyor", "Öğrenci desteksiz çalışıyor"],
  ["Öğrenci bir adımı atlıyor", "Öğrenci tüm adımları tamamlıyor"],
] as const

async function main() {
  let checks = 0, mockCalls = 0
  for (const pair of pairs) for (const [wanted, opposite] of [[pair[0], pair[1]], [pair[1], pair[0]]]) {
    const question = `inhibisyon ve çalışma belleğini tek somut örnekte göster: ${wanted}.`
    let state = createEmptyStudentConversationState()
    const initial = resolveStudentEvidenceFirstRequest({ turnId: "generic-first", message: question, state })
    assert.ok(initial.ok)
    state = JSON.parse(JSON.stringify(applyStudentRequestContract(state, initial.contract)))
    const scenario = state.semanticHistory.at(-1)!.caseContext.scenario
    assert.deepEqual(scenario, observeStudentScenario(question))
    for (const followup of ["planlama ile çalışma belleğini aynı örnekte ayrı ayrı göster", "bu çocukta aynı örnekte inhibisyon ve çalışma belleğini ayrı ayrı göster"]) {
      const resolved = resolveStudentEvidenceFirstRequest({ turnId: `generic-follow-${checks}`, message: followup, state })
      assert.ok(resolved.ok)
      assert.deepEqual(resolved.contract.referentCaseContext?.scenario, scenario)
      const constraints = effectiveScenarioEvents(followup, resolved.contract.referentCaseContext?.scenario)
      assert.ok(preservesScenarioEvents(constraints, wanted))
      assert.equal(preservesScenarioEvents(constraints, opposite), false)
      for (const [event, expected] of [[wanted, true], [opposite, false]] as const) {
        const answer = await executeStudentAnswer({ question: followup, contract: resolved.contract, apiKey: "offline-not-real",
          fetchImpl: async (_url, init) => {
            mockCalls++
            const payload = JSON.parse(JSON.parse(String(init?.body)).input)
            assert.deepEqual(payload.historyAnchor.caseContext.scenario, scenario)
            assert.deepEqual(payload.scenarioFidelity.boundedScenario, scenario)
            assert.deepEqual(payload.scenarioFidelity.constraints, constraints)
            const blocks = Object.fromEntries(payload.answerSlots.map((slot: any) => [slot.slotId,
              slot.relationComposition ? { requestFocus: "definition_difference", scopeOrder: "not_ordered" } : slot.sharedScenarioBinding ? { activity: event, applications: Object.fromEntries(slot.activeTargets.map((target: any) => [target.targetId, {
                eventStep: `${event} ve ilgili adım bu olayda ele alınır`,
                conceptLink: "Bu görev kaynakta açıklanan sürecin nerede gerektiğini somutlaştırır",
              }])) } : `${slot.activeTargets.map((t: any) => t.visibleAliases[0]).join(" ve ")}: ${event}.`]))
            return new Response(JSON.stringify({ id: "offline-history", output_text: JSON.stringify({ blocks, illustrationKind: "hypothetical" }),
              usage: { input_tokens: 100, output_tokens: 100 } }), { status: 200, headers: { "Content-Type": "application/json" } })
          } })
        assert.equal(answer.ok, expected, JSON.stringify({ wanted, event, followup, answer }))
        if (!answer.ok && answer.reason === "candidate_invalid") assert.ok(answer.failureCodes.includes("scenario_event_direction_mismatch"))
        checks++
      }
      state = JSON.parse(JSON.stringify(applyStudentRequestContract(state, resolved.contract)))
      assert.deepEqual(state.semanticHistory.at(-1)!.caseContext.scenario, scenario)
    }
  }
  const original = observeStudentScenario("Öğrenci destekle iki basamaklı yönergeyi unutuyor")!
  const correction = scenarioForAnswer("Aynı örnekte öğrenci artık hatırlıyor", original)!
  assert.equal(correction.stepCount, 2)
  assert.equal(correction.object, "instruction")
  assert.ok(correction.events.some(e => e.axis === "recall" && e.polarity === "positive"))
  assert.ok(correction.events.some(e => e.axis === "support" && e.polarity === "positive"))
  assert.equal(scenarioForAnswer("Başka bir örnek göster", original), undefined)
  const privateInput = "ZeynepX9 adlı öğrenci iki basamaklı yönergeyi unutuyor"
  assert.equal(JSON.stringify(observeStudentScenario(privateInput)).includes("ZeynepX9"), false)
  assert.ok(observeStudentScenario(privateInput)!.events.every(e => Object.keys(e).sort().join() === "axis,partialStep,polarity"))
  console.log(JSON.stringify({ ok: true, version: "history-scenario-local@1", checks, mockCalls, externalProviderCalls: 0, semanticAcceptanceCertified: false }))
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
