import assert from "node:assert/strict"
import { explicitScenarioEvents, preservesScenarioEvents } from "../src/lib/dna/chat/studentFirst/scenarioFidelity"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"

const pairs = [
  ["Öğrenci yönergeyi unutuyor", "Öğrenci yönergeyi hatırlıyor"],
  ["Öğrenci görevi başaramıyor", "Öğrenci görevi başarıyor"],
  ["Öğrenci göreve dönmüyor", "Öğrenci göreve dönüyor"],
  ["Öğrenci desteksiz çalışıyor", "Öğrenci yetişkin desteğiyle çalışıyor"],
  ["The student forgets the instruction", "The student remembers the instruction"],
  ["The student fails the task", "The student succeeds at the task"],
  ["The student does not return to the task", "The student returns to the task"],
  ["The student works without support", "The student works with support"],
] as const

async function main() {
  let checks = 0, mockCalls = 0
  for (const pair of pairs) for (let i = 0; i < 2; i++) {
    const constraints = explicitScenarioEvents(pair[i]!)
    assert.equal(constraints.length, 1, pair[i])
    assert.equal(preservesScenarioEvents(constraints, pair[i]!), true)
    assert.equal(preservesScenarioEvents(constraints, pair[1 - i]!), false)
    assert.equal(preservesScenarioEvents(constraints, `“${pair[i]}” deniyor. ${pair[1 - i]}`), false)
    assert.equal(preservesScenarioEvents(constraints, `${pair[i]}. ${pair[1 - i]}`), false)
    checks += 5
  }
  for (const question of ["Öğrenci unutmuyor", "Öğrenci hatırlamıyor", "The student does not remember", "The student does not forget"]) {
    assert.equal(explicitScenarioEvents(question).length, 1)
    assert.ok(preservesScenarioEvents(explicitScenarioEvents(question), question)); checks += 2
  }
  assert.ok(preservesScenarioEvents(explicitScenarioEvents("Bir öğrenci unutuyor, diğeri hatırlıyor"),
    "Bir öğrenci unutuyor; diğeri hatırlıyor")); checks++
  assert.deepEqual(explicitScenarioEvents("Kavramları bir örnekle açıkla"), []); checks++
  assert.ok(preservesScenarioEvents(explicitScenarioEvents("Öğrenci yönergeyi unutuyor"),
    "Öğrenci ilk adımı hatırlıyor, sonraki adımı unutuyor")); checks++
  assert.equal(preservesScenarioEvents(explicitScenarioEvents("Öğrenci yönergeyi unutuyor"),
    "Öğrenci ilk adımı tamamladıktan sonra yönergenin iki adımını aklında tutar ve yönergeyi unutuyor denir"), false); checks++

  // Exercise the real executor/schema/visible renderer with a transport double,
  // not merely the text helper. No fixture IDs, gold or provider calls involved.
  for (const [negative, positive] of pairs.slice(0, 4)) for (const [wanted, other] of [[negative, positive], [positive, negative]]) {
    const question = `inhibisyon ve çalışma belleğini tek somut örnekte göster: ${wanted}.`
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "generic-example", message: question,
      state: createEmptyStudentConversationState() })
    assert.ok(resolved.ok)
    for (const [event, expected] of [[wanted, true], [other, false]] as const) {
      const answer = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "offline-not-real",
        fetchImpl: async (_url, init) => {
          mockCalls++
          const request = JSON.parse(String(init?.body)), input = JSON.parse(request.input)
          assert.deepEqual(input.scenarioFidelity.constraints, explicitScenarioEvents(question))
          assert.match(request.instructions, /İstenmeyen telafi/u)
          const blocks = Object.fromEntries(input.answerSlots.map((slot: any) => [slot.slotId,
            slot.sharedScenarioBinding ? { activity: event,
              applications: Object.fromEntries(slot.activeTargets.map((target: any) => [target.targetId, {
                eventStep: `${event} ve yönergenin ilgili adımı bu olayda ele alınır`,
                conceptLink: "Bu görev, kaynakta açıklanan sürecin nerede gerektiğini somutlaştırır",
              }])) } : `${slot.activeTargets.map((t: any) => t.visibleAliases[0]).join(" ve ")}: ${event}.`]))
          return new Response(JSON.stringify({ id: "offline-scenario", output_text: JSON.stringify({ blocks, illustrationKind: "hypothetical" }),
            usage: { input_tokens: 100, output_tokens: 100 } }), { status: 200, headers: { "Content-Type": "application/json" } })
        } })
      assert.equal(answer.ok, expected, JSON.stringify({ question, event, answer }))
      if (!answer.ok) {
        assert.equal(answer.reason, "candidate_invalid")
        if (answer.reason === "candidate_invalid") assert.ok(answer.failureCodes.includes("scenario_event_direction_mismatch"))
      }
      checks++
    }
  }
  console.log(JSON.stringify({ ok: true, version: "scenario-fidelity-local@1", checks, mockCalls,
    externalProviderCalls: 0, semanticAcceptanceCertified: false }))
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
