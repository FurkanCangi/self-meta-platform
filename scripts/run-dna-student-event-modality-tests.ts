import assert from "node:assert/strict"
import { explicitScenarioEvents, preservesScenarioEvents } from "../src/lib/dna/chat/studentFirst/scenarioFidelity"

const forget = explicitScenarioEvents("Öğrenci yönergeyi unutuyor")
const remember = explicitScenarioEvents("Öğrenci yönergeyi hatırlıyor")
const requirements = [
  "Öğrencinin yönergenin iki adımını hatırlayıp sıraya koyması gerekir",
  "Çocuğun talimatı hatırlayarak görevi tamamlaması gerekiyor",
  "Öğrencinin yönergeyi hatırlıyor olması gerekir",
  "Öğrencinin bilgiyi hatırlayıp işlemesi beklenir",
]
let checks = 0
for (const requirement of requirements) {
  for (const actual of ["fakat yönergeyi unuttuğu için adımları düzenleme süreci gösterilmez", "ancak yönergeyi hatırlayamadığı için görevi yapamaz"]) {
    const text = `${requirement}, ${actual}.`
    assert.equal(preservesScenarioEvents(forget, text), true, text)
    assert.equal(preservesScenarioEvents(remember, text), false, text)
    assert.equal(preservesScenarioEvents(remember, text, false), false, text)
    checks += 3
  }
  assert.equal(preservesScenarioEvents(remember, requirement), false, requirement); checks++
}
for (const text of [
  "Öğrenci yönergeyi unuttu. Sonra hatırlayıp sıraya koydu.",
  "Öğrenci yönergeyi unutuyor, ancak hatırlayıp görevi tamamladı; dinlenmesi gerekir.",
  "Öğrenci yönergeyi unutuyor. Hatırlayıp öğretmenin sıraya koyması gerekir.",
  "Öğrenci yönergeyi unutuyor. Hatırlayıp görevi başardı ve dinlenmesi gerekir.",
  "Öğrenci yönergeyi unutuyor, ancak hatırlayıp sıraya koydu; bunu göstermesi gerekir.",
  "Öğrenci yönergeyi unutuyor. Hatırlayıp anlatıyor ve sunması gerekir.",
  "Öğrenci yönergeyi unutuyor. Hatırlayıp Ali'nin sıraya koyması gerekir.",
]) { assert.equal(preservesScenarioEvents(forget, text), false, text); checks++ }
for (const text of [
  "Öğrenci yönergeyi hatırlayıp sıraya koydu.",
  "Öğrenci yönergeyi hatırladı; görevi tamamlaması gerekir.",
]) { assert.equal(preservesScenarioEvents(remember, text), true, text); checks++ }
// A requirement of failure cannot falsely fulfill a negative event either.
assert.equal(preservesScenarioEvents(forget, "Öğrencinin yönergeyi unutuyor olması gerekir."), false); checks++
assert.equal(preservesScenarioEvents(remember, "Öğrenci yönergeyi hatırlıyor; unutuyor olması gerekir."), true); checks++
// The same converb/requirement scope applies to other existing event axes.
const fails = explicitScenarioEvents("Öğrenci görevi başaramıyor")
assert.equal(preservesScenarioEvents(fails, "Öğrencinin görevi tamamlayıp sunması gerekir, fakat görevi başaramıyor."), true); checks++
assert.equal(preservesScenarioEvents(fails, "Öğrenci görevi başaramıyor, sonra tamamlayıp sundu."), false); checks++
assert.equal(explicitScenarioEvents("Öğrenci yönergeyi hatırlayıp sıraya koyması gerekir")[0]?.polarity, "positive"); checks++
console.log(JSON.stringify({ ok: true, version: "event-modality-local@1", checks, externalProviderCalls: 0 }))
