import { normalizeDnaChatText } from "./text"

export const DNA_V3_AGE_GROUPS = Object.freeze([
  "infant",
  "early_childhood",
  "childhood",
  "adolescence",
  "adult",
  "older_adult",
] as const)

export type DnaV3AgeGroup = (typeof DNA_V3_AGE_GROUPS)[number]
export type DnaV3CaseAgeGroup = Exclude<DnaV3AgeGroup, "adult" | "older_adult">

export function requestedDnaV3AgeGroups(question: string): ReadonlySet<DnaV3AgeGroup> {
  const normalized = normalizeDnaChatText(question)
  const groups = new Set<DnaV3AgeGroup>()
  if (/\b(?:bebek|infant|yenidogan)\w*\b/.test(normalized)) groups.add("infant")
  if (/\b(?:erken cocukluk|okul oncesi|toddler)\w*\b/.test(normalized)) {
    groups.add("early_childhood")
  }
  if (/\b(?:cocuk|okul cagi|childhood)\w*\b/.test(normalized)) groups.add("childhood")
  if (/\b(?:ergen|adolesan|adolescen)\w*\b/.test(normalized)) groups.add("adolescence")
  if (/\b(?:yetiskin|adult)\w*\b/.test(normalized)) groups.add("adult")
  if (/\b(?:yasli|ileri yas|older adult)\w*\b/.test(normalized)) groups.add("older_adult")
  return groups
}

export function dnaV3AgeGroupsForScope(value: string): ReadonlySet<DnaV3AgeGroup> {
  const scope = normalizeDnaChatText(value)
  if (/\b(?:all ages|all_ages|tum yas)\b/.test(scope)) {
    return new Set(DNA_V3_AGE_GROUPS)
  }
  const groups = new Set<DnaV3AgeGroup>()
  if (/\b(?:infant|bebek|yenidogan)\w*\b/.test(scope)) groups.add("infant")
  if (/\b(?:early childhood|early_childhood|erken cocukluk|preschool|toddler)\w*\b/.test(scope)) {
    groups.add("early_childhood")
  }
  if (/\b(?:childhood|child|cocuk|school age)\w*\b/.test(scope)) groups.add("childhood")
  if (/\b(?:adolescence|adolescent|ergen)\w*\b/.test(scope)) groups.add("adolescence")
  if (/\b(?:adult|yetiskin|adult_weighted)\w*\b/.test(scope)) groups.add("adult")
  if (/\b(?:older adult|older_adult|yasli|ileri yas)\w*\b/.test(scope)) groups.add("older_adult")
  if (/\b(?:developmental|gelisimsel)\w*\b/.test(scope)) {
    groups.add("infant")
    groups.add("early_childhood")
    groups.add("childhood")
    groups.add("adolescence")
  }
  return groups
}

export function isDnaV3AgeCompatible(
  question: string,
  ...scopes: readonly string[]
): boolean {
  const requested = requestedDnaV3AgeGroups(question)
  if (requested.size === 0) return true
  return scopes.every((scope) => {
    const available = dnaV3AgeGroupsForScope(scope)
    return [...requested].every((group) => available.has(group))
  })
}

export function isDnaV3AgeScopeCompatibleWithGroup(
  scope: string,
  group: DnaV3AgeGroup,
): boolean {
  return dnaV3AgeGroupsForScope(scope).has(group)
}

/** Report snapshots are pediatric (0-216 months); adult bands cannot be inferred. */
export function dnaV3CaseAgeGroupFromMonths(
  ageMonths: number | null | undefined,
): DnaV3CaseAgeGroup | null {
  if (!Number.isInteger(ageMonths) || ageMonths === null || ageMonths === undefined
    || ageMonths < 0 || ageMonths > 216) return null
  if (ageMonths < 24) return "infant"
  if (ageMonths < 72) return "early_childhood"
  if (ageMonths < 144) return "childhood"
  return "adolescence"
}

const CASE_AGE_QUALIFIER_TR: Readonly<Record<DnaV3CaseAgeGroup, string>> = Object.freeze({
  infant: "bebeklik",
  early_childhood: "erken çocukluk",
  childhood: "çocukluk",
  adolescence: "ergenlik",
})

export function dnaV3CaseAgeQualifierTr(ageMonths: number | null | undefined): string | null {
  const group = dnaV3CaseAgeGroupFromMonths(ageMonths)
  return group ? CASE_AGE_QUALIFIER_TR[group] : null
}

export function doesDnaV3LockedAgeBoundaryMatchCase(
  boundary: string,
  ageMonths: number | null | undefined,
): boolean {
  const group = dnaV3CaseAgeGroupFromMonths(ageMonths)
  const normalized = normalizeDnaChatText(boundary).replace(/\s+/g, "_")
  return group ? normalized === group : normalized === "not_available"
}
