import assert from "node:assert/strict"
import { explicitCaseSupportQualifier } from "../src/lib/dna/chat/studentFirst/caseSupportContext"
import { createEmptyStudentConversationState, resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst"
import { executeStudentAnswer } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"
import type { StudentScenarioContext } from "../src/lib/dna/chat/studentFirst/scenarioFidelity"

async function main() {
  let externalCalls = 0
  globalThis.fetch = async () => { externalCalls++; throw Error("no_network_in_local_regression") }
  const qualifiers = ["kendi kendine", "desteksiz", "yardım almadan", "tek başına", "spontan", "bağımsız", "destekle", "yardımla", "yönlendirmeyle", "eş düzenlemeyle"]
  let checks = 0
  for (const qualifier of qualifiers) {
    const q = `Çocuk ${qualifier} toparlanıp etkinliğe döndü, öz düzenlemesi iyi diyebilir miyiz?`
    assert.ok(explicitCaseSupportQualifier(q)); checks++
    for (const unknown of [`Çocuk ${qualifier} mi toparlandı bilmiyorum`, `Çocuk ${qualifier} olabilir mi?`, `Çocuk ${qualifier} değil.`]) {
      assert.equal(explicitCaseSupportQualifier(unknown), null); checks++
    }
  }
  const prior: StudentScenarioContext = { actor: "child", object: "activity", stepCount: null, events: [{ axis: "support", polarity: "positive", partialStep: false }] }
  assert.equal(explicitCaseSupportQualifier("Aynı örnekte bu nasıl açıklanır?", prior), "Destekle"); checks++
  assert.equal(explicitCaseSupportQualifier("Bir çocuk toparlanıp etkinliğe döndü", prior), null); checks++
  assert.equal(explicitCaseSupportQualifier("Burada çocuk toparlanıp etkinliğe döndü", prior), null); checks++
  assert.equal(explicitCaseSupportQualifier("Aynı örnekte destek olup olmadığını bilmiyorum", prior), null); checks++
  // Full local executor: no support inference, no capacity conclusion, no
  // provider needed for the existing single-observation boundary route.
  for (const qualifier of ["", ...qualifiers]) {
    const question = `Çocuk ağladı sonra ${qualifier} toparlanıp etkinliğe döndü, öz düzenlemesi iyi diyebilir miyiz?`
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: "support-observation", message: question, state: createEmptyStudentConversationState() })
    assert.ok(resolved.ok)
    const answer = await executeStudentAnswer({ question, contract: resolved.contract })
    assert.ok(answer.ok)
    assert.equal(answer.provider.calls, 0)
    assert.match(answer.answer, /toparlanıp etkinliğe dönmesi/iu)
    assert.match(answer.answer, /Tek bir davranış veya gözlem/u)
    assert.match(answer.answer, /farklı zaman, ortam ve görevlerdeki tekrarlar/u)
    if (qualifier) assert.ok(answer.answer.toLocaleLowerCase("tr-TR").includes(qualifier))
    else assert.ok(qualifiers.every(q => !answer.answer.toLocaleLowerCase("tr-TR").startsWith(q)))
    checks++
  }
  assert.equal(externalCalls, 0)
  console.log(JSON.stringify({ ok: true, checks, externalCalls, scope: "support-context local rendering; not a new benchmark or provider acceptance" }))
}
void main().catch(e => { console.error(e); process.exitCode = 1 })
