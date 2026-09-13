import assert from "node:assert/strict"
import { explicitScenarioEvents, observeStudentScenario, preservesScenarioEvents } from "../src/lib/dna/chat/studentFirst/scenarioFidelity"

const negative = explicitScenarioEvents("Öğrenci yönergeyi unutuyor")
const positive = explicitScenarioEvents("Öğrenci yönergeyi hatırlıyor")
const accepted = [
  "Öğrenci yönergeyi alırken iki adımı aklında tutuyor, ancak yönergenin bir bölümünü unutuyor",
  "Çocuk başlangıçta talimatı hatırlıyor, sonra talimatın bir kısmını unutuyor.",
  "Kişi bilgiyi ilk okuduğunda aklında tutuyor, fakat bilgiyi hatırlayamıyor.",
  "Öğrenci başta yönergeyi hatırlıyor, ardından ikinci adımını hatırlayamadı.",
  "Öğrenci yönergeyi unutuyor.",
  "Öğrenci ilk adımı hatırlıyor, sonraki adımı unutuyor.",
]
const rejected = [
  "Öğrenci yönergeyi hatırlıyor, ancak yönergenin bir bölümünü unutuyor.",
  "Öğrenci başlangıçta yönergeyi hatırlıyor, ancak arkadaşı yönergeyi unutuyor.",
  "Öğrenci başlangıçta yönergeyi hatırlıyor, ancak bilgiyi unutuyor.",
  "Öğrenci başlangıçta yönergeyi hatırlıyor. Ancak yönergenin bir bölümünü unutuyor.",
  "Öğrenci başlangıçta yönergeyi hatırlıyor, ancak yönergenin bir bölümünü unutmuyor.",
  "Öğrenci başlangıçta yönergeyi hatırlıyor, ancak yönergenin bir bölümünü unutuyor. Sonunda yönergeyi hatırlıyor.",
  "Öğrenci yönergeyi unutuyor, ama sonra iki adımı aklında tutuyor.",
  "Öğrenci yönergeyi alırken iki adımı aklında tutuyor, ancak öğretmen yönergenin bir bölümünü unutuyor.",
  "Öğrenci başta yönergeyi hatırlıyor, ancak yönergenin bir bölümünü “unutuyor”.",
  "Başlangıçta öğretmen yönergeyi hatırlıyor, ancak yönergenin bir bölümünü öğrenci unutuyor.",
]
let checks = 0
for (const text of accepted) { assert.equal(preservesScenarioEvents(negative, text), true, text); checks++ }
for (const text of rejected) { assert.equal(preservesScenarioEvents(negative, text), false, text); checks++ }
for (const text of accepted) { assert.equal(preservesScenarioEvents(positive, text), false, text); checks++ }
// No new state fields, no input-polarity erasure; positive requests stay positive.
assert.equal(preservesScenarioEvents(positive, "Öğrenci yönergeyi hatırlıyor."), true); checks++
assert.deepEqual(observeStudentScenario("Öğrenci yönergeyi unutuyor")?.events,
  [{ axis: "recall", polarity: "negative", partialStep: false }]); checks++
assert.equal(explicitScenarioEvents(accepted[0]!).filter(e => e.axis === "recall").length, 2); checks++
console.log(JSON.stringify({ ok: true, version: "recall-phase-local@1", checks, externalProviderCalls: 0 }))
