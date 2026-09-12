import assert from "node:assert/strict"
import { containsUnrequestedExampleBoundary, executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { buildStudentAnswerExecutionPlan } from "../src/lib/dna/chat/studentFirst/answerExecution"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"

async function main() {
  let checks = 0, mockCalls = 0
  for (const target of ["planlama", "inhibisyon", "dikkat"]) {
    const question = `${target} ve çalışma belleğini yönergeyi unutan öğrenciyle tek örnekte göster`
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "generic-limitation", message: question, state: createEmptyStudentConversationState() })
    assert.ok(resolved.ok)
    const plan = buildStudentAnswerExecutionPlan({ question, contract: resolved.contract })
    assert.equal(containsUnrequestedExampleBoundary("Bu kavramsal tanımı tekrarlar", plan), false)
    const allowed = [
      `Bu olay ${target} sürecinin başarıyla kullanıldığını göstermez`,
      `Bu örnekte ${target} doğrudan gösterilemiyor`,
      `Bu olayda ${target} sürecinin başarıyla kullanıldığı söylenemez`,
      `Bu davranış tek başına ${target} kapasitesinin güçlü olduğunu göstermez`,
    ]
    const denied = [
      "Bu örnek tek başına kesin bir tanı göstermez",
      "Bu durum bilimsel kanıt için yeterli değildir",
      `Bu olay ${target} kapasitesinin zayıf olduğunu gösterir`,
      "Bu çocukta bir bozukluk vardır ve tedavi gerekir",
      "Bu örnekten tanı konulabilir",
    ]
    for (const text of allowed) { assert.equal(containsUnrequestedExampleBoundary(text, plan), false, text); checks++ }
    for (const bad of denied) for (const combined of [bad, `${allowed[0]}. ${bad}`, `${allowed[0]}; ancak ${bad}`]) {
      assert.equal(containsUnrequestedExampleBoundary(combined, plan), true, combined); checks++
    }
    for (const link of allowed) {
      const result = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "offline-not-real", fetchImpl: async (_url, init) => {
        mockCalls++
        const payload = JSON.parse(JSON.parse(String(init?.body)).input)
        const blocks = Object.fromEntries(payload.answerSlots.map((slot: any) => [slot.slotId, {
          activity: "Öğrenci yönergeyi unutur",
          applications: Object.fromEntries(slot.activeTargets.map((t: any) => [t.targetId, {
            eventStep: "Öğrenci yönergede söylenenleri unutur",
            conceptLink: t.visibleAliases.includes(target) ? link : "Çalışma belleği bu görevde bilginin korunmasını gerektirir",
          }])),
        }]))
        return Response.json({ id: "offline-limitation", output_text: JSON.stringify({ blocks, illustrationKind: "hypothetical" }), usage: { input_tokens: 100, output_tokens: 100 } })
      } })
      assert.ok(result.ok, JSON.stringify(result)); assert.ok(result.answer.includes(link), result.answer); checks++
    }
  }
  // Existing scenario and safety tests separately cover invented opposite events
  // and clinical/privacy routing. This group certifies only its listed controls.
  console.log(JSON.stringify({ ok: true, version: "validator-limitation-local@1", checks, mockCalls,
    falsePositives: 0, missedListedClinicalOrBoundaryControls: 0, externalProviderCalls: 0, universalSemanticProof: false }))
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
