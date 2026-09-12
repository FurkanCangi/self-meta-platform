import { explicitScenarioEvents, preservesScenarioEvents, scenarioEventConstraints } from "../src/lib/dna/chat/studentFirst/scenarioFidelity"

// Collect all controls, including unchanged axes, rather than hiding a later
// failure behind the first assertion. This is local evidence, not acceptance.
const checks: { name: string; pass: boolean; observed?: unknown }[] = []
const check = (name: string, pass: boolean, observed?: unknown) => checks.push({ name, pass, observed })
const negative = ["unutan", "unuttu", "unuttuğu", "unutuyor", "unutmuş", "hatırlayamıyor", "hatırlayamadı", "hatırlayamadığı", "hatırlamadığı"]
const positive = ["unutmuyor", "hatırlıyor", "hatırladı", "hatırladığı", "unutmadığı"]
for (const [words, polarity] of [[negative, "negative"], [positive, "positive"]] as const) {
  const constraints = scenarioEventConstraints({ actor: "student", object: "instruction", stepCount: 2,
    events: [{ axis: "recall", polarity, partialStep: false }] })
  for (const word of words) {
    const text = `Öğrenci yönergeyi ${word}.`
    const observed = explicitScenarioEvents(text).filter(e => e.axis === "recall")
    check(`recall classification: ${word}`, observed.length === 1 && observed[0]?.polarity === polarity, observed)
    check(`structured realization: ${word}`, preservesScenarioEvents(constraints, text))
    for (const other of polarity === "negative" ? positive : negative)
      check(`reject inversion: ${word} / ${other}`, !preservesScenarioEvents(explicitScenarioEvents(text), `Öğrenci yönergeyi ${other}.`))
  }
}
for (const [axis, negativeText, positiveText] of [
  ["completion", "Öğrenci görevi başaramadı.", "Öğrenci görevi başardı."],
  ["return", "Öğrenci göreve dönmedi.", "Öğrenci göreve döndü."],
  ["steps", "Öğrenci bir adımı atladı.", "Öğrenci bir adımı atlamadı."],
] as const) for (const [text, other, polarity] of [[negativeText, positiveText, "negative"], [positiveText, negativeText, "positive"]] as const) {
  const observed = explicitScenarioEvents(text).filter(e => e.axis === axis)
  check(`unchanged axis classification: ${text}`, observed.length === 1 && observed[0]?.polarity === polarity, observed)
  check(`unchanged axis inversion: ${text}`, !preservesScenarioEvents(explicitScenarioEvents(text), other))
}
for (const [omission, noOmission] of [["atlayan", "atlamayan"], ["atlıyor", "atlamıyor"],
  ["atladığı", "atlamadığı"], ["atlamış", "atlamamış"], ["atlar", "atlamaz"]]) {
  for (const [verb, opposite, polarity] of [[omission, noOmission, "negative"], [noOmission, omission, "positive"]] as const) {
    const text = `Öğrenci bir basamağı ${verb}.`
    // Use adımı below because the existing object matcher does not normalize
    // basamak -> basamağ; object morphology is outside this verb-only change.
    const eventText = text.replace("bir basamağı", "bir adımı")
    const observed = explicitScenarioEvents(eventText).filter(e => e.axis === "steps")
    check(`omission inflection: ${verb}`, observed.length === 1 && observed[0]?.polarity === polarity, observed)
    check(`omission inversion: ${verb}`, !preservesScenarioEvents(observed, `Öğrenci bir adımı ${opposite}.`))
  }
}
const failures = checks.filter(c => !c.pass)
console.log(JSON.stringify({ version: "recall-inflection-local@1", externalProviderCalls: 0,
  checks: checks.length, passed: checks.length - failures.length, failures, semanticAcceptanceCertified: false }, null, 2))
if (failures.length) process.exitCode = 1
