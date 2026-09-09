import { normalizeDnaChatText } from "../text"

export type StudentComparisonRelationFocus = "definition_scope" | "source_connection"

// Request evidence, not scientific evidence. These concept-independent forms
// preserve a requested dimension; they never decide a subset, cause or link.
export function studentRequestedComparisonRelationFocus(message: string): StudentComparisonRelationFocus | null {
  const unquoted = message.replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|`[^`\n]*`|‘[^’\n]*’/gu, ";")
    .replace(/(^|[\s(])'[^'\n]*'/gu, "$1;")
  const clauses = unquoted.split(/[.!?;\n]+/u).flatMap(clause =>
    normalizeDnaChatText(clause).split(/\b(?:ama|fakat|ancak)\b/u))
    .filter(clause => !/\b(?:sormadim|sormuyorum|istemiyorum|sorma|aciklama|anlatma)\b/u.test(clause))
  const scope = clauses.some(clause =>
    /\b(?:daha\s+)?(?:dar|genis)(?:\s+(?:bir|bi))?(?:\s+(?:sey|alan|cerceve|kapsam|kavram))?\s+m[iu](?:dir)?\b/u.test(clause)
    || /\bhangisi\s+(?:daha\s+)?(?:dar|genis|kapsamli)\b/u.test(clause))
  if (scope) return "definition_scope"
  const membership = clauses.some(clause =>
    /\b(?:bunun|onun|digerinin)\s+icinde\s+(?:degil\s+)?m[iu](?:dir)?\b/u.test(clause)
    || /\b(?:parcasi|bileseni|alt\s+basligi)\s+(?:degil\s+)?m[iu](?:dir)?\b/u.test(clause))
  const pairedChange = clauses.some(clause =>
    /\b(?:ayni\s+(?:sey\s+)?m[iu]|fark\w*|ayir\w*|karsilastir\w*)\b/u.test(clause)
    && /\b(?:ikisi|her\s+ikisi)(?:\s+de)?\s+(?:(?:birlikte|ayni\s+anda)\s+)?(?:degis|art|azal|yuksel|dus)\w*\b/u.test(clause))
  return membership || pairedChange ? "source_connection" : null
}
