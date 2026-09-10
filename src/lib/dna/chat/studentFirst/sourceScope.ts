import { normalizeDnaChatText } from "../text"

export type DefinitionScopeSource = Readonly<{
  targetId: string; claimId: string; definitionText: string; aliases: readonly string[]
}>
export type SourceScope = Readonly<{
  narrowerTargetId: string; broaderTargetId: string; claimIds: readonly string[]; sharedDomain: string
}>

// A deliberately bounded reading of affirmative definition scope, not a
// hierarchy inferred from co-mention, word count, target IDs or model ordering.
// The broad definition must explicitly call itself broad; the other definition
// must describe a capacity/process within a domain named in that definition.
const GENERIC = new Set(["olarak", "ifade", "kavram", "cerceve", "surec", "kapasite", "cogunlukla",
  "kullanilan", "turkcede", "icinde", "belirli", "genis", "durum", "kosul", "cocuk", "birey", "ogrenci"])
const SUFFIX = /^(?:|i|u|in|un|ini|unu|nin|nun|ni|nu|lar|ler|lari|leri|larini|lerini|si|su|sini|sunu|yi|yu)$/u
function sharedDomain(a: string, b: string): string | null {
  for (const x of a.split(/[^a-z]+/u)) for (const y of b.split(/[^a-z]+/u)) {
    let length = 0
    while (length < Math.min(x.length, y.length) && x[length] === y[length]) length++
    for (let n = length; n >= 5; n--) {
      const root = x.slice(0, n)
      if (!GENERIC.has(root) && SUFFIX.test(x.slice(n)) && SUFFIX.test(y.slice(n))) return root
    }
  }
  return null
}

export function sourceBoundDefinitionScope(sources: readonly DefinitionScopeSource[]): SourceScope | null {
  if (sources.length !== 2 || sources[0]!.targetId === sources[1]!.targetId) return null
  const candidates = sources.flatMap(broad => {
    const narrow = sources.find(s => s.targetId !== broad.targetId)!
    const b = normalizeDnaChatText(broad.definitionText), n = normalizeDnaChatText(narrow.definitionText)
    if (!/\bgenis bir (?:kavram|cerceve)\w*\b/u.test(b)
      || /\b(?:degil\w*|olmayan|olmayabilir|varsay\w*)\b/u.test(b)
      || /\bgenis bir (?:kavram|cerceve)\w*\b/u.test(n)
      || !/\b(?:kapasite\w*|sureci\w*)\b/u.test(n)) return []
    // Exclude subject names from overlap: shared naming is not a shared domain.
    const withoutNames = (s: string) => sources.flatMap(t => t.aliases).reduce((text, alias) =>
      text.replaceAll(normalizeDnaChatText(alias), " "), s)
    const domain = sharedDomain(withoutNames(b), withoutNames(n))
      // A named target itself may be an explicitly listed domain in a broad
      // definition, but never just the broad subject at the start of a sentence.
      ?? narrow.aliases.map(normalizeDnaChatText).find(alias => alias.length >= 5
        && b.slice(b.indexOf(",") + 1).split(/[^a-z]+/u).some(word =>
          word.startsWith(alias) && SUFFIX.test(word.slice(alias.length))))
    return domain ? [Object.freeze({ narrowerTargetId: narrow.targetId, broaderTargetId: broad.targetId,
      claimIds: Object.freeze([narrow.claimId, broad.claimId]), sharedDomain: domain })] : []
  })
  return candidates.length === 1 ? candidates[0]! : null
}

/** Comparative science belongs to the source-bound comparison slot. The
 * example slot owns the concrete event, not a second hierarchy declaration.
 * Keep ordinary scenario sentences and their target links; do not copy a gold
 * answer or replace the user's event with a successful event. */
export function withoutExampleScopeDeclarations(text: string, aliases: readonly string[]): string {
  return [...new Intl.Segmenter("tr", { granularity: "sentence" }).segment(text)]
    .map(p => p.segment.trim()).filter(sentence => {
      const s = normalizeDnaChatText(sentence)
      const namesTarget = aliases.some(alias => s.includes(normalizeDnaChatText(alias)))
      const scopeAssertion = /\b(?:daha (?:dar|genis|kapsamli)|genis bir (?:kavram|cerceve)|alt kume|altinda yer|icindeki alan|icindedir|kapsaminda|kapsamina|kapsar|icerir|parcasidir|bilesenidir)\b/u.test(s)
      return !(namesTarget && scopeAssertion)
    }).join(" ")
}
