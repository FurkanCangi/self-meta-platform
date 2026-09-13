import { normalizeDnaChatText } from "../text"
import { referencesPriorScenario, type StudentScenarioContext } from "./scenarioFidelity"

// A missing support fact is unknown, not independence. This is transient
// rendering evidence, never a new persisted field or a source of case facts.
export function explicitCaseSupportQualifier(
  question: string,
  history?: StudentScenarioContext,
): string | null {
  const text = normalizeDnaChatText(question)
  if (/\b(?:bilmiyorum|bilinmiyor|belirsiz|belli degil|olup olmadigini)\b/u.test(text)) return null
  const forms: readonly [RegExp, string][] = [
    [/\bkendi kendine\b/gu, "Kendi kendine"],
    [/\bdesteksiz\b/gu, "Desteksiz"],
    [/\byardim almadan\b/gu, "Yardım almadan"],
    [/\btek basina\b/gu, "Tek başına"],
    [/\bspontan\b/gu, "Spontan"],
    [/\bbagimsiz\b/gu, "Bağımsız"],
    [/\bdestekle\b/gu, "Destekle"],
    [/\byardimla\b/gu, "Yardımla"],
    [/\byonlendirmeyle\b/gu, "Yönlendirmeyle"],
    [/\bes duzenlemeyle\b/gu, "Eş düzenlemeyle"],
    [/\b(?:ogretmen|yetiskin|birinin) destegiyle\b/gu, "Destekle"],
    [/\b(?:destek|yardim) alarak\b/gu, "Destekle"],
  ]
  const found = forms.flatMap(([pattern, label]) => [...text.matchAll(pattern)].flatMap(match => {
    const after = text.slice(match.index! + match[0].length)
    // A question, denied fact, hypothetical or quoted possibility is not an
    // observed support state. Be conservative when it cannot be resolved.
    if (/^\s*(?:mi|mu|miydi|degil|olabilir|olsaydi|olsa|oldugunu soyleyebilir)\b/u.test(after)) return []
    return [label]
  }))
  if (found.length === 1) return found[0]!
  if (found.length > 1) return null // no invented resolution of mixed contexts
  // Do not import an old support fact into a newly supplied observation.
  if (!referencesPriorScenario(question) || /\b(?:agla|toparla|don|basla|yap)\w*/u.test(text)) return null
  const support = history?.events.filter(event => event.axis === "support") ?? []
  if (support.length !== 1) return null
  return support[0]!.polarity === "positive" ? "Destekle" : "Desteksiz"
}
