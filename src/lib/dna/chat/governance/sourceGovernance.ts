export const DNA_SOURCE_GOVERNANCE_VERSION = "dna-source-governance@1" as const

export const DNA_SOURCE_QUESTION_TYPES = [
  "definition",
  "mechanism",
  "measurement",
  "development",
  "association",
  "intervention_evidence",
  "controversy",
  "case_interpretation",
] as const

export type DnaSourceQuestionType = (typeof DNA_SOURCE_QUESTION_TYPES)[number]

export const DNA_SOURCE_ROLES = [
  "systematic_review_meta_analysis",
  "evidence_based_guideline",
  "consensus_or_nomenclature_standard",
  "measurement_systematic_review",
  "psychometric_validation",
  "measurement_standard",
  "human_experimental",
  "human_observational",
  "animal_mechanistic",
  "in_vitro_mechanistic",
  "narrative_review",
  "theory_exposition",
  "theory_critique",
  "preprint",
  "textbook",
  "blog_or_marketing",
  "social_media",
  "metadata_only",
] as const

export type DnaSourceRole = (typeof DNA_SOURCE_ROLES)[number]
export type DnaSourcePriorityGrade = "A" | "B" | "C" | "D" | "E"
export type DnaScientificClaimMode =
  | "scientific_evidence"
  | "theory_only"
  | "contested"

export type DnaEvidencePopulation =
  | "human"
  | "animal"
  | "in_vitro"
  | "mixed_human_animal"
  | "not_applicable"
  | "not_reported"

export const DNA_SOURCE_AGE_SCOPES = [
  "all_ages",
  "pediatric",
  "adolescent",
  "adult",
  "older_adult",
  "mixed",
  "not_applicable",
  "not_reported",
] as const

export type DnaSourceAgeScope = (typeof DNA_SOURCE_AGE_SCOPES)[number]

export const DNA_SOURCE_SAMPLE_SCOPES = [
  "general_population",
  "clinical_population",
  "mixed_population",
  "measurement_validation_sample",
  "not_applicable",
  "not_reported",
] as const

export type DnaSourceSampleScope = (typeof DNA_SOURCE_SAMPLE_SCOPES)[number]

export type DnaPsychometricRole =
  | "instrument_development"
  | "reliability"
  | "validity"
  | "responsiveness"
  | "measurement_error"
  | "cross_cultural_validity"
  | "systematic_review"
  | "reporting_standard"

export type DnaSourcePriorityInput = {
  readonly sourceId: string
  readonly role: DnaSourceRole
  readonly population: DnaEvidencePopulation
  readonly ageScope: DnaSourceAgeScope
  readonly sampleScope: DnaSourceSampleScope
  readonly psychometricRole: DnaPsychometricRole | null
  readonly publicationVersion?: "version_of_record" | "preprint" | "corrected" | "unknown"
}

export type DnaSourcePriorityDecision = {
  readonly sourceId: string
  readonly questionType: DnaSourceQuestionType
  readonly grade: DnaSourcePriorityGrade
  readonly supportsScientificClaim: boolean
  readonly permittedClaimModes: readonly DnaScientificClaimMode[]
  readonly boundaryCode: string
}

const GRADE_ORDER: Readonly<Record<DnaSourcePriorityGrade, number>> = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
}

const ROLE_ORDER = new Map<DnaSourceRole, number>(
  DNA_SOURCE_ROLES.map((role, index) => [role, index]),
)

const MEASUREMENT_ROLES = new Set<DnaSourceRole>([
  "measurement_systematic_review",
  "psychometric_validation",
])

/**
 * A-E is question-specific. D is reserved for explicit theory/dispute framing;
 * E is discovery/orientation only and can never support a scientific claim.
 */
export const DNA_SOURCE_PRIORITY_MATRIX: Readonly<
  Record<DnaSourceQuestionType, Readonly<Record<DnaSourceRole, DnaSourcePriorityGrade>>>
> = Object.freeze({
  definition: Object.freeze({
    systematic_review_meta_analysis: "B",
    evidence_based_guideline: "A",
    consensus_or_nomenclature_standard: "A",
    measurement_systematic_review: "B",
    psychometric_validation: "C",
    measurement_standard: "B",
    human_experimental: "B",
    human_observational: "B",
    animal_mechanistic: "C",
    in_vitro_mechanistic: "C",
    narrative_review: "C",
    theory_exposition: "D",
    theory_critique: "D",
    preprint: "D",
    textbook: "C",
    blog_or_marketing: "E",
    social_media: "E",
    metadata_only: "E",
  }),
  mechanism: Object.freeze({
    systematic_review_meta_analysis: "A",
    evidence_based_guideline: "B",
    consensus_or_nomenclature_standard: "B",
    measurement_systematic_review: "E",
    psychometric_validation: "E",
    measurement_standard: "E",
    human_experimental: "A",
    human_observational: "B",
    animal_mechanistic: "C",
    in_vitro_mechanistic: "C",
    narrative_review: "C",
    theory_exposition: "D",
    theory_critique: "D",
    preprint: "D",
    textbook: "C",
    blog_or_marketing: "E",
    social_media: "E",
    metadata_only: "E",
  }),
  measurement: Object.freeze({
    systematic_review_meta_analysis: "E",
    evidence_based_guideline: "E",
    consensus_or_nomenclature_standard: "E",
    measurement_systematic_review: "A",
    psychometric_validation: "A",
    measurement_standard: "B",
    human_experimental: "E",
    human_observational: "E",
    animal_mechanistic: "E",
    in_vitro_mechanistic: "E",
    narrative_review: "E",
    theory_exposition: "D",
    theory_critique: "D",
    preprint: "D",
    textbook: "C",
    blog_or_marketing: "E",
    social_media: "E",
    metadata_only: "E",
  }),
  development: Object.freeze({
    systematic_review_meta_analysis: "A",
    evidence_based_guideline: "A",
    consensus_or_nomenclature_standard: "B",
    measurement_systematic_review: "B",
    psychometric_validation: "B",
    measurement_standard: "B",
    human_experimental: "B",
    human_observational: "B",
    animal_mechanistic: "C",
    in_vitro_mechanistic: "C",
    narrative_review: "C",
    theory_exposition: "D",
    theory_critique: "D",
    preprint: "D",
    textbook: "C",
    blog_or_marketing: "E",
    social_media: "E",
    metadata_only: "E",
  }),
  association: Object.freeze({
    systematic_review_meta_analysis: "A",
    evidence_based_guideline: "B",
    consensus_or_nomenclature_standard: "B",
    measurement_systematic_review: "B",
    psychometric_validation: "B",
    measurement_standard: "C",
    human_experimental: "B",
    human_observational: "A",
    animal_mechanistic: "C",
    in_vitro_mechanistic: "C",
    narrative_review: "C",
    theory_exposition: "D",
    theory_critique: "D",
    preprint: "D",
    textbook: "C",
    blog_or_marketing: "E",
    social_media: "E",
    metadata_only: "E",
  }),
  intervention_evidence: Object.freeze({
    systematic_review_meta_analysis: "A",
    evidence_based_guideline: "A",
    consensus_or_nomenclature_standard: "B",
    measurement_systematic_review: "C",
    psychometric_validation: "C",
    measurement_standard: "C",
    human_experimental: "A",
    human_observational: "C",
    animal_mechanistic: "C",
    in_vitro_mechanistic: "C",
    narrative_review: "C",
    theory_exposition: "D",
    theory_critique: "D",
    preprint: "D",
    textbook: "C",
    blog_or_marketing: "E",
    social_media: "E",
    metadata_only: "E",
  }),
  controversy: Object.freeze({
    systematic_review_meta_analysis: "A",
    evidence_based_guideline: "B",
    consensus_or_nomenclature_standard: "B",
    measurement_systematic_review: "B",
    psychometric_validation: "B",
    measurement_standard: "B",
    human_experimental: "B",
    human_observational: "B",
    animal_mechanistic: "C",
    in_vitro_mechanistic: "C",
    narrative_review: "C",
    theory_exposition: "D",
    theory_critique: "D",
    preprint: "D",
    textbook: "C",
    blog_or_marketing: "E",
    social_media: "E",
    metadata_only: "E",
  }),
  case_interpretation: Object.freeze({
    systematic_review_meta_analysis: "B",
    evidence_based_guideline: "A",
    consensus_or_nomenclature_standard: "A",
    measurement_systematic_review: "A",
    psychometric_validation: "A",
    measurement_standard: "A",
    human_experimental: "B",
    human_observational: "B",
    animal_mechanistic: "E",
    in_vitro_mechanistic: "E",
    narrative_review: "C",
    theory_exposition: "D",
    theory_critique: "D",
    preprint: "D",
    textbook: "C",
    blog_or_marketing: "E",
    social_media: "E",
    metadata_only: "E",
  }),
})

export function assessSourcePriority(
  source: DnaSourcePriorityInput,
  questionType: DnaSourceQuestionType,
): DnaSourcePriorityDecision {
  let grade = DNA_SOURCE_PRIORITY_MATRIX[questionType][source.role]
  let boundaryCode = "question_specific_priority"

  if (questionType === "measurement" && (
    !MEASUREMENT_ROLES.has(source.role) || source.psychometricRole === null
  )) {
    grade = source.role === "theory_exposition"
      || source.role === "theory_critique"
      || source.role === "preprint"
      ? "D"
      : "E"
    boundaryCode = "measurement_requires_psychometric_role"
  }

  if (source.publicationVersion === "preprint" || source.role === "preprint") {
    grade = "D"
    boundaryCode = "preprint_requires_explicit_unreviewed_label"
  }

  if (questionType === "mechanism" && source.population === "mixed_human_animal") {
    grade = "E"
    boundaryCode = "mixed_mechanism_evidence_requires_separate_records"
  }

  const permittedClaimModes: readonly DnaScientificClaimMode[] = grade === "D"
    ? ["theory_only", "contested"]
    : grade === "E"
      ? []
      : ["scientific_evidence"]

  return Object.freeze({
    sourceId: source.sourceId,
    questionType,
    grade,
    supportsScientificClaim: grade === "A" || grade === "B" || grade === "C",
    permittedClaimModes,
    boundaryCode,
  })
}

export function rankSourcesForQuestion(
  sources: readonly DnaSourcePriorityInput[],
  questionType: DnaSourceQuestionType,
): readonly DnaSourcePriorityDecision[] {
  return Object.freeze(sources
    .map((source) => assessSourcePriority(source, questionType))
    .sort((left, right) =>
      GRADE_ORDER[left.grade] - GRADE_ORDER[right.grade]
      || (ROLE_ORDER.get(sources.find((source) => source.sourceId === left.sourceId)?.role ?? "metadata_only") ?? 99)
        - (ROLE_ORDER.get(sources.find((source) => source.sourceId === right.sourceId)?.role ?? "metadata_only") ?? 99)
      || left.sourceId.localeCompare(right.sourceId)))
}

export function canSourceSupportClaim(input: {
  readonly source: DnaSourcePriorityInput
  readonly questionType: DnaSourceQuestionType
  readonly claimMode: DnaScientificClaimMode
  readonly claimPopulation?: "human" | "animal" | "in_vitro" | "not_applicable"
  readonly claimAgeScope?: Exclude<DnaSourceAgeScope, "not_reported">
  readonly claimSampleScope?: Exclude<DnaSourceSampleScope, "not_reported">
  /** @deprecated Use claimPopulation. */
  readonly mechanismPopulation?: "human" | "animal" | "in_vitro"
}): boolean {
  const decision = assessSourcePriority(input.source, input.questionType)
  if (!decision.permittedClaimModes.includes(input.claimMode)) return false
  const populationSensitive = new Set<DnaSourceQuestionType>([
    "mechanism",
    "measurement",
    "development",
    "association",
    "intervention_evidence",
    "case_interpretation",
  ])
  if (populationSensitive.has(input.questionType)) {
    const claimPopulation = input.claimPopulation ?? input.mechanismPopulation
    if (!claimPopulation || claimPopulation === "not_applicable") return false
    if (input.source.population !== claimPopulation) return false
  }

  const scopeMandatory = input.questionType === "development"
    || input.questionType === "measurement"
    || input.questionType === "case_interpretation"
  if (scopeMandatory && (!input.claimAgeScope || !input.claimSampleScope)) return false

  if (input.claimAgeScope) {
    if (input.source.ageScope === "not_reported") return false
    if (input.source.ageScope !== "all_ages" && input.source.ageScope !== input.claimAgeScope) return false
  }
  if (input.claimSampleScope) {
    if (input.source.sampleScope === "not_reported") return false
    if (input.source.sampleScope !== input.claimSampleScope) return false
  }
  return true
}

export type DnaCanonicalSourceIdentifiers = {
  readonly doi: string | null
  readonly pmid: string | null
  readonly pmcid: string | null
  readonly isbn: string | null
}

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/
const PMID_PATTERN = /^\d{1,9}$/
const PMCID_PATTERN = /^PMC\d+$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,199}$/

function stripTrailingDoiPunctuation(value: string): string {
  return value.replace(/[.,;:]+$/g, "")
}

export function canonicalizeDoi(value: string | null | undefined): string | null {
  if (!value) return null
  const canonical = stripTrailingDoiPunctuation(String(value).trim()
    .replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ""))
    .toLowerCase()
  if (!DOI_PATTERN.test(canonical) || /\s/.test(canonical)) {
    throw new Error("invalid_doi")
  }
  return canonical
}

export function canonicalizePmid(value: string | null | undefined): string | null {
  if (!value) return null
  const canonical = String(value).trim()
    .replace(/^pmid\s*:\s*/i, "")
    .replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//i, "")
    .replace(/\/$/, "")
  if (!PMID_PATTERN.test(canonical)) throw new Error("invalid_pmid")
  return canonical
}

export function canonicalizePmcid(value: string | null | undefined): string | null {
  if (!value) return null
  const canonical = String(value).trim()
    .replace(/^pmcid\s*:\s*/i, "")
    .replace(/^https?:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\//i, "")
    .replace(/\/$/, "")
    .toUpperCase()
  if (!PMCID_PATTERN.test(canonical)) throw new Error("invalid_pmcid")
  return canonical
}

function hasValidIsbnChecksum(value: string): boolean {
  if (/^\d{13}$/.test(value)) {
    const sum = value.slice(0, 12).split("").reduce(
      (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
      0,
    )
    return (10 - (sum % 10)) % 10 === Number(value[12])
  }
  if (/^\d{9}[\dX]$/.test(value)) {
    const sum = value.split("").reduce((total, digit, index) =>
      total + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0)
    return sum % 11 === 0
  }
  return false
}

export function canonicalizeIsbn(value: string | null | undefined): string | null {
  if (!value) return null
  const canonical = String(value).trim()
    .replace(/^isbn(?:-1[03])?\s*:\s*/i, "")
    .replace(/[\s-]/g, "")
    .toUpperCase()
  if (!hasValidIsbnChecksum(canonical)) throw new Error("invalid_isbn")
  return canonical
}

export function canonicalizeSourceIdentifiers(input: Partial<DnaCanonicalSourceIdentifiers>): DnaCanonicalSourceIdentifiers {
  return Object.freeze({
    doi: canonicalizeDoi(input.doi),
    pmid: canonicalizePmid(input.pmid),
    pmcid: canonicalizePmcid(input.pmcid),
    isbn: canonicalizeIsbn(input.isbn),
  })
}

export type DnaSourceCorrectionRelation = {
  readonly direction: "corrects" | "is_corrected_by"
  readonly relationType: string
  readonly targetDoi: string
  readonly targetSourceId: string | null
}

export type DnaSourceIdentityRecord = {
  readonly sourceId: string
  readonly workId: string
  readonly versionId: string
  readonly versionStatus: "preprint" | "version_of_record" | "corrected" | "superseded" | "unknown"
  readonly publicationRole: "article" | "book" | "guideline" | "correction_notice" | "erratum" | "other"
  readonly correctionOfWorkId: string | null
  readonly correctionResolution: "not_applicable" | "resolved" | "pending"
  readonly correctionRelations: readonly DnaSourceCorrectionRelation[]
  readonly cohortFamilyId: string | null
  readonly cohortResolution: "resolved" | "not_applicable" | "unknown"
  readonly bibliography: {
    readonly title: string
    readonly authors: readonly string[]
    readonly year: number
    readonly venue: string | null
  }
  readonly verifiedBibliography: {
    readonly title: string | null
    readonly authors: readonly string[]
    readonly year: number | null
    readonly venue: string | null
    readonly publisher?: string | null
    readonly version?: string | null
  }
  readonly identifiers: DnaCanonicalSourceIdentifiers
  readonly verifiedIdentifiers: DnaCanonicalSourceIdentifiers
  readonly identityVerification: {
    readonly status: "verified" | "pending" | "mismatch"
    readonly authority: string
    readonly verifiedAt: string
    readonly evidenceSha256: string
  }
}

export type DnaSourceIdentityValidation = {
  readonly ok: boolean
  readonly errors: readonly string[]
}

function canonicalBibliographicText(value: string | null | undefined): string {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

function canonicalAuthorFamily(value: string): string {
  return canonicalBibliographicText(value).split(" ").at(-1) ?? ""
}

function bibliographicTitleMatches(left: string, right: string | null): boolean {
  const a = canonicalBibliographicText(left)
  const b = canonicalBibliographicText(right)
  if (!a || !b) return false
  if (a === b) return true
  const leftTokens = new Set(a.split(" "))
  const rightTokens = new Set(b.split(" "))
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  if (intersection / Math.max(1, union) >= 0.9) return true
  const shorter = Math.min(leftTokens.size, rightTokens.size)
  const longer = Math.max(leftTokens.size, rightTokens.size)
  return intersection === shorter && shorter / Math.max(1, longer) >= 0.75
}

function requireCanonicalIdentifier(
  kind: keyof DnaCanonicalSourceIdentifiers,
  value: string | null,
): boolean {
  try {
    return canonicalizeSourceIdentifiers({ [kind]: value })[kind] === value
  } catch {
    return false
  }
}

export function validateSourceIdentityRecords(
  records: readonly DnaSourceIdentityRecord[],
): DnaSourceIdentityValidation {
  const errors: string[] = []
  const seen = {
    sourceId: new Map<string, string>(),
    versionId: new Map<string, string>(),
    doi: new Map<string, string>(),
    pmid: new Map<string, string>(),
    pmcid: new Map<string, string>(),
    isbn: new Map<string, string>(),
  }
  const workIds = new Set(records.map((record) => record.workId))
  const recordsBySourceId = new Map(records.map((record) => [record.sourceId, record]))
  const versionOfRecordByWork = new Map<string, string>()

  for (const record of records) {
    let detectedIdentityMismatch = false
    if (!STABLE_ID_PATTERN.test(record.sourceId)) errors.push(`${record.sourceId}:invalid_source_id`)
    if (!STABLE_ID_PATTERN.test(record.workId)) errors.push(`${record.sourceId}:invalid_work_id`)
    if (!STABLE_ID_PATTERN.test(record.versionId)) errors.push(`${record.sourceId}:invalid_version_id`)
    if (!record.bibliography.title.trim()) errors.push(`${record.sourceId}:missing_title`)
    if (!Number.isInteger(record.bibliography.year) || record.bibliography.year < 1800 || record.bibliography.year > 2200) {
      errors.push(`${record.sourceId}:invalid_year`)
    }
    const titleMismatch = Boolean(record.verifiedBibliography.title)
      && !bibliographicTitleMatches(record.bibliography.title, record.verifiedBibliography.title)
    if (titleMismatch) {
      detectedIdentityMismatch = true
      if (record.identityVerification.status !== "mismatch") {
        errors.push(`${record.sourceId}:bibliography_mismatch_title`)
      }
    }
    const yearMismatch = record.verifiedBibliography.year !== null
      && record.bibliography.year !== record.verifiedBibliography.year
    if (yearMismatch) {
      detectedIdentityMismatch = true
      if (record.identityVerification.status !== "mismatch") {
        errors.push(`${record.sourceId}:bibliography_mismatch_year`)
      }
    }
    if (record.bibliography.venue && record.verifiedBibliography.venue
      && canonicalBibliographicText(record.bibliography.venue)
        !== canonicalBibliographicText(record.verifiedBibliography.venue)) {
      detectedIdentityMismatch = true
      if (record.identityVerification.status !== "mismatch") {
        errors.push(`${record.sourceId}:bibliography_mismatch_venue`)
      }
    }
    if (record.bibliography.authors.length > 0 && record.verifiedBibliography.authors.length > 0) {
      const verifiedFamilies = new Set(record.verifiedBibliography.authors.map(canonicalAuthorFamily))
      const localFamilies = record.bibliography.authors.map(canonicalAuthorFamily)
      const matched = localFamilies.filter((family) => verifiedFamilies.has(family)).length
      if (matched / localFamilies.length < 0.8) {
        detectedIdentityMismatch = true
        if (record.identityVerification.status !== "mismatch") {
          errors.push(`${record.sourceId}:bibliography_mismatch_authors`)
        }
      }
    }
    if (record.identityVerification.status === "verified" && (
      !record.verifiedBibliography.title
      || record.verifiedBibliography.year === null
      || (record.bibliography.authors.length > 0 && record.verifiedBibliography.authors.length === 0)
      || (record.publicationRole === "article" && !record.verifiedBibliography.venue)
    )) errors.push(`${record.sourceId}:verified_bibliography_incomplete`)

    if (record.versionStatus === "version_of_record") {
      const previous = versionOfRecordByWork.get(record.workId)
      if (previous) errors.push(`${record.sourceId}:duplicate_version_of_record:${previous}`)
      else versionOfRecordByWork.set(record.workId, record.sourceId)
    }

    for (const field of ["sourceId", "versionId"] as const) {
      const value = record[field]
      const previous = seen[field].get(value)
      if (previous) errors.push(`${record.sourceId}:duplicate_${field}:${previous}`)
      else seen[field].set(value, record.sourceId)
    }

    for (const kind of ["doi", "pmid", "pmcid", "isbn"] as const) {
      const value = record.identifiers[kind]
      const verifiedValue = record.verifiedIdentifiers[kind]
      if (value !== null && !requireCanonicalIdentifier(kind, value)) {
        errors.push(`${record.sourceId}:noncanonical_${kind}`)
      }
      if (verifiedValue !== null && !requireCanonicalIdentifier(kind, verifiedValue)) {
        errors.push(`${record.sourceId}:noncanonical_verified_${kind}`)
      }
      const effectiveValue = verifiedValue ?? value
      if (effectiveValue !== null) {
        const previous = seen[kind].get(effectiveValue)
        if (previous) errors.push(`${record.sourceId}:duplicate_${kind}:${previous}`)
        else seen[kind].set(effectiveValue, record.sourceId)
      }
      if (verifiedValue !== null && value !== null && verifiedValue !== value) {
        detectedIdentityMismatch = true
        if (record.identityVerification.status !== "mismatch") {
          errors.push(`${record.sourceId}:identifier_mismatch_${kind}`)
        }
      }
      if (record.identityVerification.status === "verified" && value !== null && verifiedValue === null) {
        errors.push(`${record.sourceId}:identifier_unverified_${kind}`)
      }
    }
    if (record.identityVerification.status === "mismatch" && !detectedIdentityMismatch) {
      errors.push(`${record.sourceId}:mismatch_status_without_observed_mismatch`)
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(record.identityVerification.verifiedAt)
      || !SHA256_PATTERN.test(record.identityVerification.evidenceSha256)
    ) errors.push(`${record.sourceId}:invalid_identity_evidence`)

    const correctionRelations = Array.isArray(record.correctionRelations)
      ? record.correctionRelations
      : []
    if (!Array.isArray(record.correctionRelations)) {
      errors.push(`${record.sourceId}:missing_correction_relations`)
    }
    const seenCorrectionRelations = new Set<string>()
    for (const relation of correctionRelations) {
      const relationKey = `${relation.direction}:${relation.targetDoi}`
      if (seenCorrectionRelations.has(relationKey)) {
        errors.push(`${record.sourceId}:duplicate_correction_relation:${relationKey}`)
      }
      seenCorrectionRelations.add(relationKey)
      if (relation.direction !== "corrects" && relation.direction !== "is_corrected_by") {
        errors.push(`${record.sourceId}:invalid_correction_direction`)
      }
      if (!relation.relationType.trim()) errors.push(`${record.sourceId}:missing_correction_relation_type`)
      if (!requireCanonicalIdentifier("doi", relation.targetDoi)) {
        errors.push(`${record.sourceId}:noncanonical_correction_doi`)
      }
      if (relation.targetSourceId !== null) {
        const targetRecord = recordsBySourceId.get(relation.targetSourceId)
        if (!targetRecord) {
          errors.push(`${record.sourceId}:missing_correction_relation_source`)
        } else {
          const targetDoi = targetRecord.verifiedIdentifiers.doi ?? targetRecord.identifiers.doi
          if (targetDoi !== relation.targetDoi) {
            errors.push(`${record.sourceId}:correction_relation_source_doi_mismatch`)
          }
          if (relation.direction === "corrects" && record.correctionOfWorkId !== targetRecord.workId) {
            errors.push(`${record.sourceId}:correction_target_work_mismatch`)
          }
          if (relation.direction === "is_corrected_by" && (
            (targetRecord.publicationRole !== "correction_notice" && targetRecord.publicationRole !== "erratum")
            || targetRecord.correctionOfWorkId !== record.workId
          )) {
            errors.push(`${record.sourceId}:incoming_correction_target_mismatch`)
          }
        }
      }
    }
    const allCorrectionsResolved = correctionRelations.length > 0
      && correctionRelations.every((relation) => relation.targetSourceId !== null)
    if (correctionRelations.length === 0 && record.correctionResolution !== "not_applicable") {
      errors.push(`${record.sourceId}:unexpected_correction_resolution`)
    }
    if (correctionRelations.length > 0 && record.correctionResolution === "not_applicable") {
      errors.push(`${record.sourceId}:missing_correction_resolution`)
    }
    if (record.correctionResolution === "resolved" && !allCorrectionsResolved) {
      errors.push(`${record.sourceId}:unresolved_correction_relation`)
    }
    if (record.correctionResolution === "pending" && allCorrectionsResolved) {
      errors.push(`${record.sourceId}:incorrect_pending_correction_resolution`)
    }

    if (record.publicationRole === "correction_notice" || record.publicationRole === "erratum") {
      const correctedWorkRelations = correctionRelations.filter((relation) => relation.direction === "corrects")
      if (correctedWorkRelations.length === 0) errors.push(`${record.sourceId}:invalid_correction_link`)
      if (record.correctionResolution === "resolved") {
        if (!record.correctionOfWorkId || record.correctionOfWorkId === record.workId) {
          errors.push(`${record.sourceId}:invalid_correction_link`)
        } else if (!workIds.has(record.correctionOfWorkId)) {
          errors.push(`${record.sourceId}:missing_corrected_work`)
        }
      } else if (record.correctionOfWorkId !== null) {
        errors.push(`${record.sourceId}:unresolved_correction_has_work_link`)
      }
    } else if (record.correctionOfWorkId !== null) {
      errors.push(`${record.sourceId}:unexpected_correction_link`)
    }

    if (record.cohortResolution === "resolved" && !record.cohortFamilyId) {
      errors.push(`${record.sourceId}:missing_cohort_family`)
    }
    if (record.cohortResolution !== "resolved" && record.cohortFamilyId !== null) {
      errors.push(`${record.sourceId}:unexpected_cohort_family`)
    }
  }

  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

export function isSourceIdentityReleaseEligible(
  record: DnaSourceIdentityRecord,
  collection: readonly DnaSourceIdentityRecord[] = [record],
): boolean {
  return validateSourceIdentityRecords(collection).ok
    && record.identityVerification.status === "verified"
    && (record.versionStatus === "version_of_record" || record.versionStatus === "corrected")
    && record.publicationRole !== "correction_notice"
    && record.publicationRole !== "erratum"
    && record.correctionResolution !== "pending"
    && (record.correctionRelations.every((relation) => relation.direction !== "is_corrected_by")
      || record.versionStatus === "corrected")
    && record.cohortResolution !== "unknown"
    && record.verifiedBibliography.authors.length > 0
    && Boolean(record.verifiedBibliography.venue?.trim())
}

export type DnaSourceFamilyDeduplication = {
  readonly selectedSourceIds: readonly string[]
  readonly excluded: readonly {
    sourceId: string
    reason: "superseded_version" | "duplicate_work" | "duplicate_cohort" | "correction_notice"
  }[]
}

const VERSION_PREFERENCE: Readonly<Record<DnaSourceIdentityRecord["versionStatus"], number>> = {
  corrected: 0,
  version_of_record: 1,
  preprint: 2,
  unknown: 3,
  superseded: 4,
}

/**
 * Prevents preprint/VoR, correction notices and reused cohorts from being
 * counted as independent evidence. Corrections remain attached provenance and
 * are not standalone claim support.
 */
export function deduplicateSourceFamilies(
  records: readonly DnaSourceIdentityRecord[],
): DnaSourceFamilyDeduplication {
  const selected: DnaSourceIdentityRecord[] = []
  const excluded: Array<{
    sourceId: string
    reason: "superseded_version" | "duplicate_work" | "duplicate_cohort" | "correction_notice"
  }> = []
  const sorted = [...records].sort((left, right) =>
    VERSION_PREFERENCE[left.versionStatus] - VERSION_PREFERENCE[right.versionStatus]
    || left.sourceId.localeCompare(right.sourceId))
  const seenWorks = new Set<string>()
  const seenCohorts = new Set<string>()

  for (const record of sorted) {
    if (record.publicationRole === "correction_notice" || record.publicationRole === "erratum") {
      excluded.push({ sourceId: record.sourceId, reason: "correction_notice" })
      continue
    }
    if (record.versionStatus === "superseded") {
      excluded.push({ sourceId: record.sourceId, reason: "superseded_version" })
      continue
    }
    if (seenWorks.has(record.workId)) {
      excluded.push({ sourceId: record.sourceId, reason: "duplicate_work" })
      continue
    }
    if (record.cohortFamilyId && seenCohorts.has(record.cohortFamilyId)) {
      excluded.push({ sourceId: record.sourceId, reason: "duplicate_cohort" })
      continue
    }
    seenWorks.add(record.workId)
    if (record.cohortFamilyId) seenCohorts.add(record.cohortFamilyId)
    selected.push(record)
  }

  return Object.freeze({
    selectedSourceIds: Object.freeze(selected.map((record) => record.sourceId).sort()),
    excluded: Object.freeze(excluded.sort((left, right) => left.sourceId.localeCompare(right.sourceId))),
  })
}

export const DNA_LICENSE_COMPONENTS = [
  "metadata",
  "abstract",
  "full_text",
  "passage",
  "table",
  "figure",
  "scale",
  "test_items",
] as const

export type DnaLicenseComponent = (typeof DNA_LICENSE_COMPONENTS)[number]
export type DnaLicenseDecision = "cleared" | "restricted" | "unknown" | "metadata_only"
export type DnaLicenseRight = "allowed" | "prohibited" | "unknown"
export type DnaDeclaredLicensePolicy =
  | "cc0"
  | "cc_by"
  | "cc_by_sa"
  | "cc_by_with_exceptions"
  | "blocked_nc"
  | "blocked_nd"
  | "all_rights_reserved"
  | "unknown"

export type DnaLicenseEvidenceBasis =
  | "verified_in_artifact"
  | "official_license_page_verified"
  | "metadata_fact"
  | "unverified"

export type DnaComponentLicense = {
  readonly component: DnaLicenseComponent
  readonly decision: DnaLicenseDecision
  readonly commercialUse: DnaLicenseRight
  readonly adaptation: DnaLicenseRight
  readonly textAndDataMining: DnaLicenseRight
  readonly redisplay: DnaLicenseRight
  readonly thirdPartyMaterialReviewed: boolean
  readonly evidence: {
    readonly sourceId: string
    readonly url: string
    readonly checkedAt: string
    readonly sha256: string
    readonly basis: DnaLicenseEvidenceBasis
    readonly artifactRelativePath: string | null
  }
}

export type DnaSourceLicenseRecord = {
  readonly sourceId: string
  readonly declaredLicense: string
  readonly policy: DnaDeclaredLicensePolicy
  readonly obligations: {
    readonly attributionRequired: boolean
    readonly shareAlikeRequired: boolean
  }
  readonly components: readonly DnaComponentLicense[]
}

export type DnaLicenseValidation = {
  readonly ok: boolean
  readonly errors: readonly string[]
}

const DEFAULT_RESTRICTED_COMPONENTS = new Set<DnaLicenseComponent>([
  "table",
  "figure",
  "scale",
  "test_items",
])

const OFFICIAL_LICENSE_EVIDENCE_HOSTS = new Set([
  "creativecommons.org",
  "www.creativecommons.org",
  "rightsstatements.org",
  "www.rightsstatements.org",
])

function isOfficialLicenseEvidenceUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && OFFICIAL_LICENSE_EVIDENCE_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

function isSafeRelativeArtifactPath(value: string | null): boolean {
  if (!value || value.startsWith("/") || value.includes("\\")) return false
  return !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
}

export function classifyDeclaredLicense(license: string): DnaDeclaredLicensePolicy {
  const normalized = license.normalize("NFKC").trim().toUpperCase().replace(/_/g, "-")
  if (/\b(?:CC0|CC ZERO)\b/.test(normalized)) return "cc0"
  if (/\b(?:NC|NON[- ]?COMMERCIAL)\b/.test(normalized)) return "blocked_nc"
  if (/\b(?:ND|NO DERIVATIVES)\b/.test(normalized)) return "blocked_nd"
  if (/ALL RIGHTS RESERVED|FULL RIGHTS|APA COPYRIGHT|NO OPEN COMMERCIAL REUSE|^COPYRIGHT\b/.test(normalized)) {
    return "all_rights_reserved"
  }
  if (/\bCC[- ]?BY[- ]?SA\b/.test(normalized)) return "cc_by_sa"
  if (/\bCC[- ]?BY\b/.test(normalized) && /(?:EXCEPT|UNLESS) WHERE OTHERWISE NOTED/.test(normalized)) {
    return "cc_by_with_exceptions"
  }
  if (/\bCC[- ]?BY\b/.test(normalized)) return "cc_by"
  return "unknown"
}

export function validateComponentLicenseMatrix(record: DnaSourceLicenseRecord): DnaLicenseValidation {
  const errors: string[] = []
  const seen = new Set<DnaLicenseComponent>()
  if (classifyDeclaredLicense(record.declaredLicense) !== record.policy) {
    errors.push(`${record.sourceId}:declared_license_policy_mismatch`)
  }
  const expectedAttribution = record.policy === "cc_by"
    || record.policy === "cc_by_sa"
    || record.policy === "cc_by_with_exceptions"
  const expectedShareAlike = record.policy === "cc_by_sa"
  if (record.obligations.attributionRequired !== expectedAttribution) {
    errors.push(`${record.sourceId}:attribution_obligation_mismatch`)
  }
  if (record.obligations.shareAlikeRequired !== expectedShareAlike) {
    errors.push(`${record.sourceId}:share_alike_obligation_mismatch`)
  }
  for (const component of record.components) {
    if (seen.has(component.component)) errors.push(`${record.sourceId}:duplicate_component:${component.component}`)
    seen.add(component.component)
    if (component.evidence.sourceId !== record.sourceId) {
      errors.push(`${record.sourceId}:license_evidence_source_mismatch:${component.component}`)
    }
    if (!/^https:\/\//.test(component.evidence.url) || /(?:example\.invalid|placeholder)/i.test(component.evidence.url)) {
      errors.push(`${record.sourceId}:invalid_license_evidence_url:${component.component}`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(component.evidence.checkedAt)) {
      errors.push(`${record.sourceId}:invalid_license_evidence_date:${component.component}`)
    }
    if (!SHA256_PATTERN.test(component.evidence.sha256)) {
      errors.push(`${record.sourceId}:invalid_license_evidence_hash:${component.component}`)
    }
    if (component.evidence.basis === "verified_in_artifact") {
      if (!isSafeRelativeArtifactPath(component.evidence.artifactRelativePath)) {
        errors.push(`${record.sourceId}:invalid_license_artifact_path:${component.component}`)
      }
    } else if (component.evidence.artifactRelativePath !== null) {
      errors.push(`${record.sourceId}:unexpected_license_artifact_path:${component.component}`)
    }
    if (component.evidence.basis === "official_license_page_verified"
      && !isOfficialLicenseEvidenceUrl(component.evidence.url)) {
      errors.push(`${record.sourceId}:untrusted_license_evidence_authority:${component.component}`)
    }
    if (component.decision === "cleared" && component.component !== "metadata"
      && component.evidence.basis !== "verified_in_artifact"
      && component.evidence.basis !== "official_license_page_verified") {
      errors.push(`${record.sourceId}:cleared_without_verified_license_evidence:${component.component}`)
    }
    if (component.decision === "cleared" && component.component === "metadata"
      && component.evidence.basis === "unverified") {
      errors.push(`${record.sourceId}:metadata_cleared_without_evidence:${component.component}`)
    }
  }
  for (const component of DNA_LICENSE_COMPONENTS) {
    if (!seen.has(component)) errors.push(`${record.sourceId}:missing_component:${component}`)
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors.sort()) })
}

export type DnaComponentReleaseDecision = {
  readonly allowed: boolean
  readonly code:
    | "component_cleared"
    | "component_missing"
    | "component_not_cleared"
    | "component_rights_incomplete"
    | "third_party_review_required"
    | "license_blocks_runtime_full_text"
    | "unknown_declared_license"
    | "license_evidence_not_verified"
    | "invalid_license_matrix"
}

export function evaluateComponentRelease(
  record: DnaSourceLicenseRecord,
  component: DnaLicenseComponent,
): DnaComponentReleaseDecision {
  if (!validateComponentLicenseMatrix(record).ok) {
    return Object.freeze({ allowed: false, code: "invalid_license_matrix" })
  }
  const decision = record.components.find((entry) => entry.component === component)
  if (!decision) return Object.freeze({ allowed: false, code: "component_missing" })
  if (record.policy === "unknown") {
    return Object.freeze({ allowed: false, code: "unknown_declared_license" })
  }
  const copyrightSensitive = component !== "metadata"
  if (copyrightSensitive && (
    record.policy === "blocked_nc"
    || record.policy === "blocked_nd"
    || record.policy === "all_rights_reserved"
  )) {
    return Object.freeze({ allowed: false, code: "license_blocks_runtime_full_text" })
  }
  if ((component === "full_text" || component === "passage")
    && record.policy === "cc_by_with_exceptions") {
    return Object.freeze({ allowed: false, code: "license_blocks_runtime_full_text" })
  }
  if (decision.decision !== "cleared") {
    return Object.freeze({ allowed: false, code: "component_not_cleared" })
  }
  if (component !== "metadata"
    && decision.evidence.basis !== "verified_in_artifact"
    && decision.evidence.basis !== "official_license_page_verified") {
    return Object.freeze({ allowed: false, code: "license_evidence_not_verified" })
  }
  if (decision.commercialUse !== "allowed"
    || decision.adaptation !== "allowed"
    || decision.textAndDataMining !== "allowed"
    || decision.redisplay !== "allowed") {
    return Object.freeze({ allowed: false, code: "component_rights_incomplete" })
  }
  if (DEFAULT_RESTRICTED_COMPONENTS.has(component) && !decision.thirdPartyMaterialReviewed) {
    return Object.freeze({ allowed: false, code: "third_party_review_required" })
  }
  return Object.freeze({ allowed: true, code: "component_cleared" })
}

export function isSourceIdentityAndComponentLicenseEligible(input: {
  readonly identity: DnaSourceIdentityRecord
  readonly license: DnaSourceLicenseRecord
  readonly component: DnaLicenseComponent
}): boolean {
  return input.identity.sourceId === input.license.sourceId
    && isSourceIdentityReleaseEligible(input.identity)
    && evaluateComponentRelease(input.license, input.component).allowed
}
