import { strict as assert } from "node:assert"
import { explicitScenarioEvents, inspectScenarioEvents, preservesScenarioEvents } from "../src/lib/dna/chat/studentFirst/scenarioFidelity"

const constraints = explicitScenarioEvents("Öğrenci yönergeyi unutuyor.")
const cases = [
  ["Öğrencinin yönergeyi unutması bu olayda görülüyor.", true, false, true],
  ["Öğrenci yönergeyi hatırlıyor.", false, true, false],
  ["Öğrenci yönergeyi okuyor.", false, false, false],
  ["Öğrenci yönergeyi unutuyor. Sonunda hatırlıyor.", true, true, false],
  ["Öğrenci yönergeyi unutuyor. Yönergeyi hatırlaması gerekir.", true, false, true],
  ["“Öğrenci yönergeyi unutuyor” sorusuna bakalım.", false, false, false],
] as const
for (const [text, requiredPoleFound, oppositePoleFound, passed] of cases) {
  const diagnostic = inspectScenarioEvents(constraints, text)
  assert.deepEqual(diagnostic, { passed, checks: [{axis: "recall", requiredPolarity: "negative", requiredPoleFound, oppositePoleFound, passed}] })
  assert.equal(preservesScenarioEvents(constraints, text), passed)
  assert.equal(inspectScenarioEvents(constraints, text, false).passed, requiredPoleFound)
}
const privateText = "Özel İsim GizliTelefon 05551234567 yönergeyi unutuyor."
const serialized = JSON.stringify(inspectScenarioEvents(constraints, privateText))
assert(!/Özel|Gizli|0555|unut|normalizedEvidence|text/.test(serialized))
assert.deepEqual(inspectScenarioEvents([], privateText), {passed:true,checks:[]})
console.log(JSON.stringify({version:"scenario-diagnostic-local@1",cases:cases.length,privacyChecks:2,passed:true,externalProviderCalls:0}))
