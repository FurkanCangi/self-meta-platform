import { normalizeDnaChatText } from "../text"

// Observable illustrative events, NOT scientific claims, diagnoses or a new
// request ontology. Keep both poles; a negative event is not a request to fix it.
export type ScenarioEventConstraint = Readonly<{
  axis: "recall" | "completion" | "return" | "support"
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
    negative: /\b(?:unut(?:an|uyor|ur|tu|mus)|hatirla(?:mayan|miyor|yamayan|yamiyor)|aklinda tut(?:amayan|amiyor|amaz)|forgets?|forgot|does not remember|cannot remember)\b/gu,
    positive: /\b(?:hatirla(?:yan|yip|yarak|r|di)|hatirliyor|unut(?:mayan|muyor|maz)|aklinda tut(?:an|uyor|ar|arak)|remembers?|remembered|does not forget)\b/gu },
  { axis: "completion",
    negative: /\b(?:basara(?:mayan|miyor|madi|maz)|basarisiz|tamamlaya(?:mayan|miyor|madi|maz)|yapa(?:mayan|miyor|madi|maz)|fails?|failed|does not succeed)\b/gu,
    positive: /\b(?:basar(?:an|iyor|di|ir)|basarili|tamamla(?:yan|yip|yarak|di|r)|tamamliyor|dogru uygula(?:yan|yip|yarak|di|r)|dogru uyguluyor|succeeds?|succeeded|does not fail)\b/gu },
  { axis: "return",
    negative: /\b(?:don(?:meyen|muyor|medi|mez|emeyen|emiyor|emez)|geri gel(?:meyen|miyor|medi|mez)|does not return|doesn't return|cannot return)\b/gu,
    positive: /\b(?:don(?:en|uyor|du|er)|geri gel(?:en|iyor|di|ir)|returns?|returned)\b/gu },
  { axis: "support",
    negative: /\b(?:desteksiz|(?:destek|yardim) alma(?:dan|yan)|(?:yetiskin|ogretmen) destegi olma(?:dan|yan)|without (?:support|help))\b/gu,
    positive: /\b(?:(?:yetiskin|ogretmen|birinin) destegiyle|(?:destek|yardim) al(?:arak|an|iyor)|with (?:support|help))\b/gu },
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
