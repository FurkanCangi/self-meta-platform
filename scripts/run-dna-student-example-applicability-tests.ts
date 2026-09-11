import assert from "node:assert/strict"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"

// Projection/contract regression, not an automated semantic judge. The negative
// conceptual link must survive; generic diagnostic disclaimers remain separate.
async function main() {
  let checks = 0
  for (const target of ["inhibisyon", "planlama", "dikkat"]) {
    const question = `${target} ve çalışma belleğini tek bir günlük örnekte anlat`
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "example-control", message: question,
      state: createEmptyStudentConversationState() })
    assert.ok(resolved.ok)
    const negative = `Bu olay ${target} sürecini göstermez çünkü ilgili eylem bu durumda anlatılmıyor`
    const answer = await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "offline-not-real",
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(String(init?.body)), input = JSON.parse(request.input)
        assert.match(request.instructions, /Her kavramın başarılı kullanıldığını göstermek zorunda değilsin/u)
        const blocks = Object.fromEntries(input.answerSlots.map((slot: any) => {
          assert.equal(slot.exampleRealization.definitionOnlyIsNotAnExample, true)
          assert.ok(slot.exampleRealization.permittedRelations.includes("not_demonstrated_by_this_event"))
          return [slot.slotId, { activity: "Öğrenci defterini açtıktan sonra ikinci adımın ne olduğunu sorar",
            applications: Object.fromEntries(slot.activeTargets.map((t: any) => [t.targetId, {
              eventStep: "Öğrenci ikinci adımda yapacağı işi yeniden sorar",
              conceptLink: t.visibleAliases.includes(target) ? negative
                : "Çalışma belleği açısından ikinci adımın bilgisini akılda tutmak bu görevde gereklidir",
            }])) }]
        }))
        return Response.json({ id: "offline-example", output_text: JSON.stringify({ blocks, illustrationKind: "hypothetical" }),
          usage: { input_tokens: 100, output_tokens: 100 } })
      } })
    assert.ok(answer.ok, JSON.stringify(answer))
    assert.ok(answer.answer.includes(negative), answer.answer)
    checks += 4
  }
  // Independent examples also receive the concrete-event contract. It does not
  // turn an ordinary definition request into an example or alter locked duties.
  for (const [question, required] of [["dikkati günlük hayattan minicik örnekle anlat", true], ["dikkat nedir", false]] as const) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "slot-control", message: question,
      state: createEmptyStudentConversationState() })
    assert.ok(resolved.ok)
    await executeStudentAnswer({ question, contract: resolved.contract, apiKey: "offline-not-real",
      fetchImpl: async (_url, init) => {
        const request = JSON.parse(String(init?.body)), input = JSON.parse(request.input)
        assert.equal(input.answerSlots.some((s: any) => !!s.exampleRealization), required)
        const blocks = Object.fromEntries(input.answerSlots.map((s: any) => [s.slotId,
          s.slotKind === "example" ? "Bir öğrenci çevredeki konuşmalar arasından öğretmenin söylediği kelimeye odaklanır; dikkat burada belirli bilgiye yönelmeyi anlatır"
            : "Dikkat, çevresel veya içsel bilgiler arasından belirli bir bölüme işlem kaynağı ayırma sürecidir"]))
        return Response.json({ id: "offline-slot", output_text: JSON.stringify({ blocks, illustrationKind: required ? "hypothetical" : "none" }),
          usage: { input_tokens: 100, output_tokens: 100 } })
      } })
    checks++
  }
  console.log(JSON.stringify({ ok: true, checks, externalProviderCalls: 0, semanticAcceptanceCertified: false }))
}
void main().catch(error => { console.error(error); process.exitCode = 1 })
