import { normalizeDnaChatText } from "../text"

// Observable illustrative events, NOT scientific claims, diagnoses or a new
// request ontology. Keep both poles; a negative event is not a request to fix it.
export type ScenarioEventConstraint = Readonly<{
  axis: "recall" | "completion" | "return" | "support" | "steps"
  polarity: "positive" | "negative"
  normalizedEvidence: string
  partialStep: boolean
}>

const EVENTS: readonly Readonly<{
  axis: ScenarioEventConstraint["axis"]
  negative: RegExp
  positive: RegExp
}>[] = [
  { axis: "recall",
    // Whole-word, polarity-specific suffix families: past participles soften
    // -duk to -dug- before possessive endings; inability (-yama-) is not
    // affirmative recall. Do not use a stem wildcard that also eats negation.
    negative: /\b(?:unut(?:an|uyor|ur|tu|mus|tuk|tug(?:um|un|u|umuz|unuz|unu))|hatirla(?:mayan|miyor|madi|madig(?:im|in|i|imiz|iniz|ini)|yamayan|yamiyor|yamadi|yamadig(?:im|in|i|imiz|iniz|ini))|aklinda tut(?:amayan|amiyor|amaz)|forgets?|forgot|does not remember|cannot remember)\b/gu,
    positive: /\b(?:hatirla(?:yan|yip|yarak|r|di|dig(?:im|in|i|imiz|iniz|ini))|hatirliyor|unut(?:mayan|muyor|maz|madi|madig(?:im|in|i|imiz|iniz|ini))|aklinda tut(?:an|uyor|ar|arak)|remembers?|remembered|does not forget)\b/gu },
  { axis: "completion",
    negative: /\b(?:basara(?:mayan|miyor|madi|maz)|basarisiz|tamamlaya(?:mayan|miyor|madi|maz)|yapa(?:mayan|miyor|madi|maz)|fails?|failed|does not succeed)\b/gu,
    positive: /\b(?:basar(?:an|iyor|di|ir)|basarili|tamamla(?:yan|yip|yarak|di|r)|tamamliyor|dogru uygula(?:yan|yip|yarak|di|r)|dogru uyguluyor|succeeds?|succeeded|does not fail)\b/gu },
  { axis: "return",
    negative: /\b(?:don(?:meyen|muyor|medi|mez|emeyen|emiyor|emez)|geri gel(?:meyen|miyor|medi|mez)|does not return|doesn't return|cannot return)\b/gu,
    positive: /\b(?:don(?:en|uyor|du|er)|geri gel(?:en|iyor|di|ir)|returns?|returned)\b/gu },
  { axis: "support",
    negative: /\b(?:desteksiz|(?:destek|yardim) alma(?:dan|yan)|(?:yetiskin|ogretmen) destegi olma(?:dan|yan)|without (?:support|help))\b/gu,
    positive: /\b(?:(?:yetiskin|ogretmen|birinin) destegiyle|destekle|(?:destek|yardim) al(?:arak|an|iyor)|with (?:support|help))\b/gu },
  { axis: "steps",
    // A negated omission is not an omission. Bound the verb suffixes rather
    // than accepting every word beginning with atla (including atlamadi).
    negative: /\b(?:(?:bir|ikinci|sonraki)?\s*(?:adim|basamak)\w*\s+(?:atla(?:yan|di|dig(?:im|in|i|imiz|iniz|ini)|mis|r|yarak|yip)|atliyor|yapm\w*|unut\w*)|(?:omits?|skips?) (?:a |one |the )?step)\b/gu,
    positive: /\b(?:(?:bir|ikinci|sonraki)?\s*(?:adim|basamak)\w*\s+atla(?:mayan|miyor|madi|madig(?:im|in|i|imiz|iniz|ini)|mamis|maz)|(?:tum|butun|her|iki)\s+(?:adim|basamak)\w*.{0,24}(?:tamamla\w*|tamamliyor|dogru uygula\w*|dogru uyguluyor)|completes? all steps)\b/gu },
]

function events(text: string): readonly ScenarioEventConstraint[] {
  const normalized = normalizeDnaChatText(text.replace(/doesn['’]t/giu, "does not"))
  return EVENTS.flatMap(({ axis, negative, positive }) => {
    // Longest overlapping phrase wins: "does not remember" is not "remember".
    const matches = (["negative", "positive"] as const).flatMap(polarity =>
      [...normalized.matchAll(polarity === "negative" ? negative : positive)]
        .map(m => ({ start: m.index!, end: m.index! + m[0].length, polarity, text: m[0] })))
      .sort((a, b) => (b.end - b.start) - (a.end - a.start))
    const accepted: typeof matches = []
    for (const match of matches) if (!accepted.some(m => match.start < m.end && match.end > m.start)) accepted.push(match)
    return accepted.map(m => {
      const prefix = normalized.slice(Math.max(0, m.start - 65), m.start)
      // Partial success is not inversion of a failed whole: remembering the
      // first step may coexist with forgetting the next one. Explicit "both"
      // or "all" must not acquire this exemption from a nearby first step.
      const partialStep = /\b(?:ilk|birinci|first)\s+(?:adim\w*|basamak\w*|step)\b/u.test(prefix)
        && !/\b(?:iki|butun|tum|both|all)\b/u.test(prefix)
      return Object.freeze({ axis, polarity: m.polarity, normalizedEvidence: m.text, partialStep })
    })
  })
}

export function explicitScenarioEvents(question: string): readonly ScenarioEventConstraint[] {
  return Object.freeze(events(question))
}

// Persist only finite semantic values. No names, free-text excerpts or clinical
// data enter conversation state. Labels sent later are generated from enums.
export type StudentScenarioContext = Readonly<{
  actor: "student" | "child" | "adult" | "person"
  object: "instruction" | "task" | "activity" | "game" | "unspecified"
  stepCount: 1 | 2 | 3 | null
  events: readonly Readonly<Pick<ScenarioEventConstraint, "axis" | "polarity" | "partialStep">>[]
}>

const EVENT_LABELS: Record<ScenarioEventConstraint["axis"], Record<ScenarioEventConstraint["polarity"], string>> = {
  recall: { positive: "hatırlıyor", negative: "unutuyor" },
  completion: { positive: "başarıyor", negative: "başaramıyor" },
  return: { positive: "geri dönüyor", negative: "geri dönmüyor" },
  support: { positive: "destekle yapıyor", negative: "desteksiz yapıyor" },
  steps: { positive: "tüm adımları tamamlıyor", negative: "bir adımı atlıyor" },
}

export function referencesPriorScenario(message: string): boolean {
  return /\b(?:ayni\s+(?:ornek|senaryo)|burada|burda|bu\s+(?:cocuk|ogrenci|durum|ornek)|o\s+(?:cocuk|ogrenci|ornek))\w*\b/u.test(normalizeDnaChatText(message))
}

export function observeStudentScenario(message: string): StudentScenarioContext | undefined {
  const observed = explicitScenarioEvents(message)
  if (!observed.length) return undefined
  const n = normalizeDnaChatText(message)
  const actor = /\b(?:ogrenci|student)\w*\b/u.test(n) ? "student" : /\b(?:cocuk|cocug|child)\w*\b/u.test(n) ? "child"
    : /\b(?:yetiskin|adult)\w*\b/u.test(n) ? "adult" : "person"
  const object = /\b(?:yonerge|instruction)\w*\b/u.test(n) ? "instruction" : /\b(?:gorev|task)\w*\b/u.test(n) ? "task"
    : /\b(?:etkinlik|activity)\w*\b/u.test(n) ? "activity" : /\b(?:oyun|game)\w*\b/u.test(n) ? "game" : "unspecified"
  const steps = n.match(/\b(bir|iki|uc|one|two|three|1|2|3)\s+(?:basamakli|adimli|step)\b/u)?.[1]
  const stepCount = steps && ["bir", "one", "1"].includes(steps) ? 1 : steps && ["iki", "two", "2"].includes(steps) ? 2
    : steps ? 3 : null
  const finite = observed.map(({ axis, polarity, partialStep }) => ({ axis, polarity, partialStep }))
  return Object.freeze({ actor, object, stepCount,
    events: Object.freeze(finite.filter((v, i) => finite.findIndex(x => JSON.stringify(x) === JSON.stringify(v)) === i).slice(0, 10)) })
}

export function inheritStudentScenario(current: StudentScenarioContext | undefined, previous: StudentScenarioContext | undefined): StudentScenarioContext | undefined {
  if (!previous) return current
  if (!current) return previous
  // Explicit corrections replace only the stated event axis; unrelated facts survive.
  return Object.freeze({ actor: current.actor === "person" ? previous.actor : current.actor,
    object: current.object === "unspecified" ? previous.object : current.object,
    stepCount: current.stepCount ?? previous.stepCount,
    events: Object.freeze([...previous.events.filter(e => !current.events.some(c => c.axis === e.axis)), ...current.events].slice(0, 10)) })
}

export function scenarioEventConstraints(context: StudentScenarioContext): readonly ScenarioEventConstraint[] {
  return context.events.map(e => ({ ...e, normalizedEvidence: EVENT_LABELS[e.axis][e.polarity] }))
}

export function scenarioForAnswer(question: string, previous?: StudentScenarioContext): StudentScenarioContext | undefined {
  const current = observeStudentScenario(question)
  return referencesPriorScenario(question) ? inheritStudentScenario(current, previous) : current
}

export function effectiveScenarioEvents(question: string, previous?: StudentScenarioContext): readonly ScenarioEventConstraint[] {
  const current = explicitScenarioEvents(question)
  if (!previous || !referencesPriorScenario(question)) return current
  // Preserve literal current evidence while carrying other inherited axes.
  return [...scenarioEventConstraints(previous).filter(e => !current.some(c => c.axis === e.axis)), ...current]
}

/** A bounded contradiction guard, not a general semantic acceptance judge.
 * Mixed-pole requests (two actors or before/after comparisons) retain both
 * conditions for the producer; do not flatten them into one global polarity.
 * Quoting the user's predicate alone cannot count as realizing the event.
 */
export function preservesScenarioEvents(
  constraints: readonly ScenarioEventConstraint[],
  realizedEventText: string,
  rejectOpposite = true,
): boolean {
  const unquoted = realizedEventText.replace(/[“«][\s\S]*?[”»]|"[^"\n]*"/gu, " ")
  const observed = events(unquoted)
  return constraints.every(c => {
    const requested = new Set(constraints.filter(x => x.axis === c.axis).map(x => x.polarity))
    if (!observed.some(x => x.axis === c.axis && x.polarity === c.polarity)) return false
    return !rejectOpposite || requested.size > 1
      || !observed.some(x => x.axis === c.axis && x.polarity !== c.polarity
        && !(c.polarity === "negative" && !c.partialStep && x.partialStep))
  })
}

export const SCENARIO_FIDELITY_INSTRUCTIONS = `
Örnek üretirken currentUserMessage içindeki açık olay, kişi, nesne, sıra ve destek koşulu değişmez. scenarioFidelity varsa normalizedEvidence kullanıcının olay koşuludur; bilimsel kanıt veya tanı değildir. Olayı yalnız soruyu alıntılayarak değil, activity ve eventStep içinde gerçekten göster. Kullanıcı unutmayı, başaramamayı veya geri dönmemeyi anlatıyorsa kavramları göstermek için bunu hatırlama, başarı veya geri dönme öyküsüne çevirme; destekli/desteksiz koşulu da koru. İki ayrı kişi ya da önce/sonra karşılaştırması verilmişse her koşulu kendi kişisine ve zamanına bağla, birini diğerine taşıma. Başarısız bir olayda conceptLink, görevin kaynakta tanımlanan süreci nerede gerektirdiğini açıklayabilir; öğrencinin o süreci başarıyla kullandığını veya belirli bir bozukluğu olduğunu ileri sürmez. İstenmeyen telafi, öğretmen yardımı veya başarılı son ekleme. Aynı olay yönünü her uygulama adımında koru; sonraki kavram açıklaması önceki olayı geri almasın. Kaynak, güvenlik ve hedef sınırlarını değiştirme.
`.trim()
