import { createHash } from "node:crypto"

export const DNA_V31_MULTIPASSAGE_SCHEMA = "dna-v3.1-multipassage-candidate@1" as const

export const DNA_V31_RESPONSE_LIMITS = Object.freeze({
  short: 1,
  standard: 2,
  deep: 3,
} as const)

export type DnaV31ResponseProfile = keyof typeof DNA_V31_RESPONSE_LIMITS
export type DnaV31FamilyStatus = "candidate_success" | "not_available"

export type DnaV31CandidateUnit = Readonly<{
  id: string
  claimId: string
  passageId: string
  sourceId: string
  textTr: string
  textTrSha256: string
  sourcePassageSha256: string
  claimBoundary: string
  maximumGraphHops: 1
  multiStepMechanismAllowed: false
  sourceFaithful: true
}>

export type DnaV31Source = Readonly<{
  id: string
  title: string
  workIdentity: string
  integrityState: "verified_clean"
  passageLicenseDecision: "cleared"
  methodGate: "bounded_candidate_passed"
  sourceFidelityGate: "reconciled_passed"
}>

export type DnaV31Family = Readonly<{
  id: "neuroanatomy" | "sleep" | "interoception" | "stress_reactivity_recovery" | "sensory_modulation"
  status: DnaV31FamilyStatus
  reason: string
  unitIds: readonly string[]
  independentSourceCount: number
}>

export type DnaV31MultipassageCandidate = Readonly<{
  schemaVersion: typeof DNA_V31_MULTIPASSAGE_SCHEMA
  authorityClass: "external_science_candidate"
  runtimeEligible: false
  releaseEligible: false
  activationAllowed: false
  liveRuntime: "dna-chat-engine@2"
  sources: readonly DnaV31Source[]
  units: readonly DnaV31CandidateUnit[]
  families: readonly DnaV31Family[]
  inputHashes: Readonly<Record<string, string>>
  verification: Readonly<{
    orphanUnits: 0
    unlicensedPassages: 0
    duplicatePassagesWithinFamily: 0
    duplicateMeaningsWithinFamily: 0
    unsupportedCausalSynthesis: 0
    multiStepMechanisms: 0
  }>
  packageSha256: string
}>

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, nested]) => [key, stableValue(nested)]))
  }
  return value
}

export function stableDnaV31Json(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`
}

export function hashDnaV31Value(value: unknown): string {
  return sha256(stableDnaV31Json(value))
}

function normalizedMeaning(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü]+/giu, " ")
    .trim()
}

function assertHash(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`dna_v31_${label}_hash_invalid`)
}

export function validateDnaV31Candidate(
  candidate: DnaV31MultipassageCandidate,
): Readonly<{
  familyCount: 5
  successfulFamilies: number
  notAvailableFamilies: number
  unitCount: number
  sourceCount: number
}> {
  if (candidate.schemaVersion !== DNA_V31_MULTIPASSAGE_SCHEMA) {
    throw new Error("dna_v31_schema_invalid")
  }
  if (
    candidate.runtimeEligible !== false ||
    candidate.releaseEligible !== false ||
    candidate.activationAllowed !== false ||
    candidate.liveRuntime !== "dna-chat-engine@2"
  ) throw new Error("dna_v31_release_boundary_invalid")

  const sourceById = new Map(candidate.sources.map((source) => [source.id, source]))
  const unitById = new Map(candidate.units.map((unit) => [unit.id, unit]))
  if (sourceById.size !== candidate.sources.length) throw new Error("dna_v31_duplicate_source")
  if (unitById.size !== candidate.units.length) throw new Error("dna_v31_duplicate_unit")

  for (const source of candidate.sources) {
    if (
      !source.id || !source.title || !source.workIdentity ||
      source.integrityState !== "verified_clean" ||
      source.passageLicenseDecision !== "cleared" ||
      source.methodGate !== "bounded_candidate_passed" ||
      source.sourceFidelityGate !== "reconciled_passed"
    ) throw new Error(`dna_v31_source_gate_invalid:${source.id}`)
  }

  for (const unit of candidate.units) {
    if (
      !unit.id || !unit.claimId || !unit.passageId || !unit.sourceId ||
      !unit.textTr.trim() || !unit.claimBoundary.trim() ||
      unit.maximumGraphHops !== 1 || unit.multiStepMechanismAllowed !== false ||
      unit.sourceFaithful !== true || !sourceById.has(unit.sourceId)
    ) throw new Error(`dna_v31_unit_binding_invalid:${unit.id}`)
    assertHash(unit.textTrSha256, "unit_text")
    assertHash(unit.sourcePassageSha256, "source_passage")
    if (sha256(unit.textTr) !== unit.textTrSha256) {
      throw new Error(`dna_v31_unit_text_hash_mismatch:${unit.id}`)
    }
  }

  const expectedFamilies = new Set([
    "neuroanatomy",
    "sleep",
    "interoception",
    "stress_reactivity_recovery",
    "sensory_modulation",
  ])
  if (candidate.families.length !== 5 || new Set(candidate.families.map((row) => row.id)).size !== 5) {
    throw new Error("dna_v31_family_coverage_invalid")
  }
  for (const family of candidate.families) {
    expectedFamilies.delete(family.id)
    if (!family.reason.trim()) throw new Error(`dna_v31_family_reason_missing:${family.id}`)
    if (family.status === "not_available") {
      if (family.unitIds.length !== 0 || family.independentSourceCount !== 0) {
        throw new Error(`dna_v31_not_available_content_forbidden:${family.id}`)
      }
      continue
    }
    if (family.unitIds.length < 1 || family.unitIds.length > 3) {
      throw new Error(`dna_v31_family_unit_limit:${family.id}`)
    }
    const units = family.unitIds.map((id) => unitById.get(id))
    if (units.some((unit) => !unit)) throw new Error(`dna_v31_orphan_unit:${family.id}`)
    const exactUnits = units as DnaV31CandidateUnit[]
    if (new Set(exactUnits.map((unit) => unit.passageId)).size !== exactUnits.length) {
      throw new Error(`dna_v31_duplicate_passage:${family.id}`)
    }
    if (new Set(exactUnits.map((unit) => normalizedMeaning(unit.textTr))).size !== exactUnits.length) {
      throw new Error(`dna_v31_duplicate_meaning:${family.id}`)
    }
    if (new Set(exactUnits.map((unit) => unit.sourceId)).size !== family.independentSourceCount) {
      throw new Error(`dna_v31_source_count_mismatch:${family.id}`)
    }
  }
  if (expectedFamilies.size) throw new Error("dna_v31_family_missing")

  const verification = candidate.verification
  if (Object.values(verification).some((value) => value !== 0)) {
    throw new Error("dna_v31_verification_not_clean")
  }
  for (const value of Object.values(candidate.inputHashes)) assertHash(value, "input")
  assertHash(candidate.packageSha256, "package")
  const { packageSha256, ...payload } = candidate
  if (hashDnaV31Value(payload) !== packageSha256) throw new Error("dna_v31_package_hash_mismatch")

  return Object.freeze({
    familyCount: 5,
    successfulFamilies: candidate.families.filter((row) => row.status === "candidate_success").length,
    notAvailableFamilies: candidate.families.filter((row) => row.status === "not_available").length,
    unitCount: candidate.units.length,
    sourceCount: candidate.sources.length,
  })
}

export function renderDnaV31Candidate(
  candidate: DnaV31MultipassageCandidate,
  familyId: DnaV31Family["id"],
  profile: DnaV31ResponseProfile,
): Readonly<{
  status: DnaV31FamilyStatus
  text: string
  units: readonly DnaV31CandidateUnit[]
  independentSourceCount: number
}> {
  validateDnaV31Candidate(candidate)
  const family = candidate.families.find((row) => row.id === familyId)
  if (!family) throw new Error("dna_v31_family_unknown")
  if (family.status === "not_available") {
    return Object.freeze({ status: family.status, text: "", units: Object.freeze([]), independentSourceCount: 0 })
  }
  const byId = new Map(candidate.units.map((unit) => [unit.id, unit]))
  const units = family.unitIds
    .slice(0, DNA_V31_RESPONSE_LIMITS[profile])
    .map((id) => byId.get(id)!)
  return Object.freeze({
    status: family.status,
    text: units.map((unit) => unit.textTr.trim()).join(" "),
    units: Object.freeze(units),
    independentSourceCount: new Set(units.map((unit) => unit.sourceId)).size,
  })
}
