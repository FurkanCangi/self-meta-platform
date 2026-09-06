import type { LiteratureSource } from "../literatureNote"

// Report-only selection policy. Bibliography, source text and legacy consumers
// remain immutable. An age in the selection seed is not an eligibility check.
export function reportLiteratureSourceEligible(source: LiteratureSource, purpose: string, ageMonths?: number | null): boolean {
  const age = Number(ageMonths)
  const scope = (source.ageScope ?? "").toLowerCase()
  if (scope === "middle childhood" && (!Number.isFinite(age) || age < 72 || age >= 156)) return false
  // "Youth" alone does not establish preschool applicability.
  if (scope === "youth") return false
  const range = scope.match(/(\d+)\s*[-–]\s*(\d+)\s*(months|years)/u)
  if (range) {
    const factor = range[3] === "years" ? 12 : 1
    if (!Number.isFinite(age) || age < Number(range[1]) * factor || age > Number(range[2]) * factor) return false
  }
  // These paragraphs explain constructs/measurement, not intervention efficacy
  // or diagnosis-specific findings. Those sources are retained in the catalog.
  if (/autism|intervention|training/iu.test(source.evidenceDomain)) return false
  if (purpose === "sensory") return source.id === "SHAHBAZI_MIRZAKHANI_2021"
  if (purpose === "emotion") return ["FREITAG_ET_AL_2023", "COLE_ET_AL_2004", "THOMPSON_2019", "EISENBERG_ET_AL_2010"].includes(source.id)
  if (purpose === "physiological") return ["GRAZIANO_DEREFINKO_2013", "KAHLE_ET_AL_2018"].includes(source.id)
  if (purpose === "interoception") return source.id === "CLARK_ET_AL_2025"
  if (["executive", "executive-frame"].includes(purpose)) return ["DIAMOND_2013", "BEST_MILLER_2010", "GARON_ET_AL_2008", "SILVA_ET_AL_2022"].includes(source.id)
  return true
}
