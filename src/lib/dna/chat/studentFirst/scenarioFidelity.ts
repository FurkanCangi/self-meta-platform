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
    // Nominalized and passive events retain polarity too: unutması/unutulan
    // are losses, unutmaması/unutulmayan are not. Modally required events are
    // excluded from the assertion view below, not treated as realized facts.
    negative: /\b(?:unut(?:an|uyor|ur|tu|mus|tuk|tug(?:um|un|u|umuz|unuz|unu)|masi(?:ni|nin|na|nda|ndan)?|ul(?:an|du|mus|dugu))|hatirla(?:mayan|miyor|madi|madig(?:im|in|i|imiz|iniz|ini)|mamasi(?:ni|nin|na|nda|ndan)?|yamayan|yamiyor|yamadi|yamadig(?:im|in|i|imiz|iniz|ini)|yamamasi(?:ni|nin|na|nda|ndan)?)|aklinda tut(?:amayan|amiyor|amaz)|forgets?|forgot|does not remember|cannot remember)\b/gu,
    positive: /\b(?:hatirla(?:yan|yip|yarak|r|di|dig(?:im|in|i|imiz|iniz|ini)|masi(?:ni|nin|na|nda|ndan)?)|hatirliyor|unut(?:mayan|muyor|maz|madi|madig(?:im|in|i|imiz|iniz|ini)|mamasi(?:ni|nin|na|nda|ndan)?|ulma(?:yan|di|mis|digi))|aklinda tut(?:an|uyor|ar|arak)|remembers?|remembered|does not forget)\b/gu },
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

/** Only for checking a negative recall OUTCOME. Initial encoding followed by
 * explicit loss is not successful retention. Keep the exception clause-local:
 * no new subject, unrelated object, quotation or later recovery can supply it.
 * This transient checker view never changes the answer, prompt or saved state.
 */
function recallOutcomeView(text: string): string {
  return text.split(/([.!?;\n])/u).map(sentence => {
    const n = normalizeDnaChatText(sentence)
    const positive = EVENTS.find(e => e.axis === "recall")!.positive
    const negative = EVENTS.find(e => e.axis === "recall")!.negative
    const ranges: { start: number; end: number }[] = []
    for (const match of n.matchAll(positive)) {
      const prefix = n.slice(0, match.index)
      // An initial phase must be explicit and local, not merely an "however".
      const phase = prefix.match(/\b(?:baslangicta|basta|ilk anda|alirken|duyarken|ilk okudugunda)\b/u)
      if (!phase || prefix.length - phase.index! > 85) continue
      if (/\b(?:diger|baska|arkadas|ogretmen|yetiskin|ikinci ogrenci)\w*\b/u.test(prefix)) continue
      const end = match.index! + match[0].length
      const tail = n.slice(end)
      // No arbitrary intervening prose: the same omitted subject must lose
      // the same informational object (or a part of it) after the conjunction.
      const loss = tail.match(/^\s+(?:ancak|ama|fakat|sonra|ardindan)\s+(?:(?:daha sonra|ardindan)\s+)?((?:(?:yonergenin|talimatin|bilginin|bilgilerin|adimlarin)\s+)?(?:bir bolumunu|bir kismini|bir adimini|ikinci adimini)|yonergeyi|talimati|bilgiyi|bilgileri|bunu|bir bolumunu|bir kismini)\s+/u)
      if (!loss) continue
      const lossPredicate = tail.slice(loss[0].length)
      const lossMatch = [...lossPredicate.matchAll(negative)].find(m => m.index === 0)
      if (!lossMatch) continue
      // Avoid transporting loss of information from an unrelated object.
      const objectKind = (s: string) => /\b(?:yonerge|talimat|adim|basamak)\w*\b/u.test(s) ? "instruction"
        : /\bbilgi\w*\b/u.test(s) ? "information" : undefined
      const beforeObject = objectKind(prefix), afterObject = objectKind(loss[1]!)
      if (!beforeObject || (afterObject && afterObject !== beforeObject)) continue
      ranges.push({ start: match.index!, end })
    }
    return ranges.reverse().reduce((s, r) => s.slice(0, r.start) + " " + s.slice(r.end), n)
  }).join(" ")
}

/** A converb under an explicit requirement is not an asserted event:
 * "hatırlayıp sıralaması gerekir" describes what the task requires. Do not
 * let that either contradict a failed event or fulfill a successful one.
 * Only erase the predicate from this checker view, never from public output.
 */
function assertedEventView(text: string): string {
  return text.split(/([.!?;,:\n]|\b(?:ancak|ama|fakat|oysa)\b)/giu).map(clause => {
    if (/^(?:[.!?;,:\n]|ancak|ama|fakat|oysa)$/iu.test(clause)) return clause
    const n = normalizeDnaChatText(clause)
    const ranges: { start: number; end: number }[] = []
    for (const { negative, positive } of EVENTS) for (const pattern of [negative, positive]) {
      for (const match of n.matchAll(pattern)) {
        const end = match.index! + match[0].length, tail = n.slice(end)
        const modal = "(?:gerekir|gerekiyor|gerekmektedir|gerekli|lazim|beklenir|bekleniyor)"
        // Immediate 'olması gerekir' scopes a finite predicate too. For a
        // converb, permit a bounded object phrase and nominalized head verb;
        // a separate finite event or new subject cannot borrow that scope.
        const immediate = new RegExp(`^\\s+olmasi\\s+${modal}\\b`, "u").test(tail)
        const nominalRequirement = /(?:masi|mesi)(?:ni|nin|na|nda|ndan)?$/u.test(match[0])
          && new RegExp(`^\\s+(?:${modal}|gerek\\s+yok|sart)\\b`, "u").test(tail)
        const governed = /(?:yip|yup|ip|up|arak|erek)$/u.test(match[0])
          ? tail.match(new RegExp(`^((?:\\s+[a-z0-9]+){0,8})\\s+[a-z]+(?:masi|mesi)\\s+${modal}\\b`, "u")) : null
        const bridge = governed?.[1] ?? ""
        const hasSeparateEvent = events(bridge).some(e => !/(?:yip|yup|ip|up|arak|erek)$/u.test(e.normalizedEvidence))
          || /\b[a-z]+(?:iyor|uyor|yor|di|ti|du|tu|mis|mus|acak|ecek)\b/u.test(bridge)
        const hasNewSubject = /\b(?:ogrencinin|cocugun|kisinin|ogretmeninin|ogretmenin|yetiskinin|arkadasinin|digerinin|nin|nun|in|un)\b/u.test(bridge)
        if (immediate || nominalRequirement || (governed && !hasSeparateEvent && !hasNewSubject)) ranges.push({ start: match.index!, end })
      }
    }
    // Overlapping positive/negative phrases must not be deleted twice.
    const spans = ranges.sort((a, b) => a.start - b.start || b.end - a.end)
      .filter((r, i, all) => !all.slice(0, i).some(p => p.start <= r.start && p.end >= r.end))
    return spans.reverse().reduce((s, r) => s.slice(0, r.start) + " " + s.slice(r.end), n)
  }).join(" ")
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
  return inspectScenarioEvents(constraints, realizedEventText, rejectOpposite).passed
}

/** Finite operational evidence only. Never return input text, matched words,
 * names or excerpts. A missing matcher hit is NOT proof of a semantic omission.
 * Keep this as the single implementation used by the existing boolean guard. */
export function inspectScenarioEvents(
  constraints: readonly ScenarioEventConstraint[],
  realizedEventText: string,
  rejectOpposite = true,
) {
  const unquoted = realizedEventText.replace(/[“«][\s\S]*?[”»]|"[^"\n]*"/gu, " ")
  const asserted = assertedEventView(unquoted)
  const observed = events(asserted)
  const recallOutcome = events(recallOutcomeView(asserted))
  const checks = constraints.map(c => {
    const requested = new Set(constraints.filter(x => x.axis === c.axis).map(x => x.polarity))
    const requiredPoleFound = observed.some(x => x.axis === c.axis && x.polarity === c.polarity)
    const oppositePoleFound = rejectOpposite && requested.size <= 1
      && (c.axis === "recall" && c.polarity === "negative" ? recallOutcome : observed).some(x => x.axis === c.axis && x.polarity !== c.polarity
        && !(c.polarity === "negative" && !c.partialStep && x.partialStep))
    return { axis: c.axis, requiredPolarity: c.polarity, requiredPoleFound, oppositePoleFound,
      passed: requiredPoleFound && !oppositePoleFound }
  })
  return { passed: checks.every(c => c.passed), checks }
}

export const SCENARIO_FIDELITY_INSTRUCTIONS = `
Örnek üretirken currentUserMessage içindeki açık olay, kişi, nesne, sıra ve destek koşulu değişmez. scenarioFidelity varsa normalizedEvidence kullanıcının olay koşuludur; bilimsel kanıt veya tanı değildir. Olayı yalnız soruyu alıntılayarak değil, activity ve eventStep içinde gerçekten göster. Kullanıcı unutmayı, başaramamayı veya geri dönmemeyi anlatıyorsa kavramları göstermek için bunu hatırlama, başarı veya geri dönme öyküsüne çevirme; destekli/desteksiz koşulu da koru. İki ayrı kişi ya da önce/sonra karşılaştırması verilmişse her koşulu kendi kişisine ve zamanına bağla, birini diğerine taşıma. Başarısız bir olayda conceptLink, görevin kaynakta tanımlanan süreci nerede gerektirdiğini açıklayabilir; öğrencinin o süreci başarıyla kullandığını veya belirli bir bozukluğu olduğunu ileri sürmez. İstenmeyen telafi, öğretmen yardımı veya başarılı son ekleme. Aynı olay yönünü her uygulama adımında koru; sonraki kavram açıklaması önceki olayı geri almasın. Kaynak, güvenlik ve hedef sınırlarını değiştirme.
`.trim()
