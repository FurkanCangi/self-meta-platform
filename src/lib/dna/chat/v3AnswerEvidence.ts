import type {
  DnaV3RetrievalClaim,
  DnaV3RetrievalPackage,
  DnaV3RetrievalSourceCard,
} from "./v3RetrievalCore"

export const DNA_V3_ANSWER_AUTHORITIES = Object.freeze([
  "external_science",
  "dna_product",
  "case_report",
  "safety_policy",
] as const)

export type DnaV3AnswerAuthority = (typeof DNA_V3_ANSWER_AUTHORITIES)[number]

export const DNA_V3_ANSWER_SECTION_KINDS = Object.freeze([
  "definition",
  "function_or_relation",
  "development",
  "measurement",
  "evidence_status",
  "counter_evidence",
  "dna_boundary",
  "case_context",
  "case_finding",
  "case_missing",
  "general_literature",
  "case_non_inference",
  "preserved_capacity",
  "boundary",
] as const)

export type DnaV3AnswerSectionKind = (typeof DNA_V3_ANSWER_SECTION_KINDS)[number]

export type DnaV3AnswerUnit = Readonly<{
  id: string
  section: DnaV3AnswerSectionKind
  authority: DnaV3AnswerAuthority
  text: string
  claimIds: readonly string[]
  passageIds: readonly string[]
  sourceIds: readonly string[]
  caseFieldIds: readonly string[]
}>

export type DnaV3AnswerSection = Readonly<{
  kind: DnaV3AnswerSectionKind
  titleTr: string
  unitIds: readonly string[]
}>

const ALLOWED_CASE_FIELD_ID = /^(?:chatContext\.(?:primaryAxis|evidence|limitations|preservedCapacities|counterEvidence))(?:\[\d+\])?$/

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en"))
}

export function sectionForDnaV3ClaimType(claimType: string): DnaV3AnswerSectionKind {
  const normalized = String(claimType || "").toLocaleLowerCase("en-US")
  if (/(?:development|trajectory|age|gelisim)/.test(normalized)) return "development"
  if (/(?:measurement|psychometric|measure|olcum)/.test(normalized)) return "measurement"
  if (/(?:counter|conflict|controvers|limitation|boundary)/.test(normalized)) return "counter_evidence"
  if (/(?:evidence|review|meta|trial|study)/.test(normalized)) return "evidence_status"
  if (/(?:relation|mechanism|function|association)/.test(normalized)) return "function_or_relation"
  return "definition"
}

export function createDnaV3ScientificUnit(input: Readonly<{
  claim: DnaV3RetrievalClaim
  text: string
  section?: DnaV3AnswerSectionKind
  suffix?: string
}>): DnaV3AnswerUnit {
  return Object.freeze({
    id: [
      "science",
      input.claim.sourceClaimId,
      input.section ?? sectionForDnaV3ClaimType(input.claim.claimType),
      input.suffix ?? "0",
    ].join("::"),
    section: input.section ?? sectionForDnaV3ClaimType(input.claim.claimType),
    authority: input.claim.authority === "dna_product_information"
      ? "dna_product"
      : "external_science",
    text: String(input.text || "").trim(),
    claimIds: Object.freeze([input.claim.sourceClaimId]),
    passageIds: Object.freeze(stableUnique(input.claim.passageIds)),
    sourceIds: Object.freeze(stableUnique(input.claim.sourceIds)),
    caseFieldIds: Object.freeze([]),
  })
}

export function createDnaV3PolicyUnit(input: Readonly<{
  id: string
  text: string
  section: DnaV3AnswerSectionKind
}>): DnaV3AnswerUnit {
  return Object.freeze({
    id: `policy::${input.id}`,
    section: input.section,
    authority: "safety_policy",
    text: String(input.text || "").trim(),
    claimIds: Object.freeze([]),
    passageIds: Object.freeze([]),
    sourceIds: Object.freeze([]),
    caseFieldIds: Object.freeze([]),
  })
}

export function createDnaV3CaseUnit(input: Readonly<{
  id: string
  text: string
  section: DnaV3AnswerSectionKind
  caseFieldIds: readonly string[]
}>): DnaV3AnswerUnit {
  return Object.freeze({
    id: `case::${input.id}`,
    section: input.section,
    authority: "case_report",
    text: String(input.text || "").trim(),
    claimIds: Object.freeze([]),
    passageIds: Object.freeze([]),
    sourceIds: Object.freeze([]),
    caseFieldIds: Object.freeze(stableUnique(input.caseFieldIds)),
  })
}

/**
 * Produces one card per exact claim/passage edge. This deliberately avoids a
 * broad source-level card that could make a paper appear to support more than
 * the reviewed passage and limited claim.
 */
export function createDnaV3SourceCards(
  claims: readonly DnaV3RetrievalClaim[],
  pkg: DnaV3RetrievalPackage,
  maxCards: number,
): readonly DnaV3RetrievalSourceCard[] {
  const sources = new Map(pkg.sources.map((source) => [source.id, source]))
  const passages = new Map(pkg.passages.map((passage) => [passage.id, passage]))
  const entailed = new Set(pkg.claimPassageLinks
    .filter((link) => link.entailmentStatus === "entailed")
    .map((link) => `${link.claimId}\u0000${link.passageId}`))
  const cardsByClaim = new Map<string, DnaV3RetrievalSourceCard[]>()
  for (const claim of claims) {
    const claimCards: DnaV3RetrievalSourceCard[] = []
    for (const passageId of claim.passageIds) {
      const passage = passages.get(passageId)
      const source = passage ? sources.get(passage.sourceId) : null
      if (
        !source ||
        !passage ||
        claim.releaseStatus !== source.releaseStatus ||
        passage.releaseStatus !== claim.releaseStatus ||
        !["permitted", "not_applicable"].includes(source.licenseStatus) ||
        !claim.sourceIds.includes(source.id) ||
        !entailed.has(`${claim.sourceClaimId}\u0000${passage.id}`) ||
        (!source.doi && !source.officialUrl) ||
        !source.title.trim() ||
        !(typeof source.authors === "string" ? source.authors : source.authors.join(", ")).trim() ||
        source.year === null ||
        !source.sourceType.trim() ||
        !passage.locator.trim()
      ) continue
      claimCards.push(Object.freeze({
        id: `${source.id}::${passage.id}::${claim.sourceClaimId}`,
        sourceId: source.id,
        passageId: passage.id,
        supportedClaimId: claim.sourceClaimId,
        title: source.title,
        authors: typeof source.authors === "string" ? source.authors : source.authors.join(", "),
        year: source.year,
        sourceType: source.sourceType,
        doi: source.doi,
        officialUrl: source.officialUrl,
        locator: passage.locator,
        evidenceLevel: claim.evidenceLevel,
        ageScope: claim.ageScope,
        supportedClaim: claim.summaryTr,
        knownBoundary: claim.claimBoundary,
        supportedBoundary: claim.claimBoundary,
      }))
    }
    if (claimCards.length) {
      cardsByClaim.set(claim.sourceClaimId, claimCards
        .sort((left, right) => left.id.localeCompare(right.id, "en")))
    }
  }
  // First expose one exact edge for every displayed claim, then use remaining
  // card capacity for additional passages. This prevents one multi-passage
  // claim from hiding the citation of another displayed sentence.
  const ordered: DnaV3RetrievalSourceCard[] = []
  const claimIds = [...cardsByClaim.keys()].sort((left, right) => left.localeCompare(right, "en"))
  for (const claimId of claimIds) {
    const first = cardsByClaim.get(claimId)?.[0]
    if (first) ordered.push(first)
  }
  for (const claimId of claimIds) {
    ordered.push(...(cardsByClaim.get(claimId)?.slice(1) ?? []))
  }
  return Object.freeze(ordered.slice(0, Math.max(0, maxCards)))
}

export function validateDnaV3AnswerEvidence(input: Readonly<{
  summary: string
  details: readonly string[]
  limitations: readonly string[]
  units: readonly DnaV3AnswerUnit[]
  sources: readonly DnaV3RetrievalSourceCard[]
  pkg: DnaV3RetrievalPackage
}>): readonly string[] {
  const errors: string[] = []
  const claimBySourceId = new Map<string, DnaV3RetrievalClaim>()
  for (const claim of input.pkg.claims) {
    if (!claimBySourceId.has(claim.sourceClaimId)) claimBySourceId.set(claim.sourceClaimId, claim)
  }
  const passageById = new Map(input.pkg.passages.map((passage) => [passage.id, passage]))
  const sourceById = new Map(input.pkg.sources.map((source) => [source.id, source]))
  const entailed = new Set(input.pkg.claimPassageLinks
    .filter((link) => link.entailmentStatus === "entailed")
    .map((link) => `${link.claimId}\u0000${link.passageId}`))
  const unitIds = new Set<string>()
  const relationTextsByClaimId = new Map<string, Set<string>>()
  for (const relation of input.pkg.relations) {
    for (const claimId of relation.claimIds) {
      const texts = relationTextsByClaimId.get(claimId) ?? new Set<string>()
      texts.add(relation.summaryTr)
      relationTextsByClaimId.set(claimId, texts)
    }
  }

  for (const unit of input.units) {
    if (!unit.id || unitIds.has(unit.id)) errors.push(`unit:duplicate_or_missing_id:${unit.id}`)
    unitIds.add(unit.id)
    if (!unit.text.trim()) errors.push(`unit:missing_text:${unit.id}`)
    if (unit.authority === "external_science" || unit.authority === "dna_product") {
      if (!unit.claimIds.length || !unit.passageIds.length || !unit.sourceIds.length) {
        errors.push(`unit:scientific_binding_missing:${unit.id}`)
        continue
      }
      for (const claimId of unit.claimIds) {
        const claim = claimBySourceId.get(claimId)
        if (!claim) {
          errors.push(`unit:unknown_claim:${unit.id}:${claimId}`)
          continue
        }
        const expectedAuthority = claim.authority === "dna_product_information"
          ? "dna_product"
          : "external_science"
        if (unit.authority !== expectedAuthority) {
          errors.push(`unit:authority_not_release_bound:${unit.id}:${claimId}`)
        }
        if (unit.passageIds.some((passageId) =>
          !claim.passageIds.includes(passageId) || !entailed.has(`${claimId}\u0000${passageId}`))) {
          errors.push(`unit:passage_not_entailed:${unit.id}:${claimId}`)
        }
        if (unit.sourceIds.some((sourceId) => !claim.sourceIds.includes(sourceId))) {
          errors.push(`unit:source_not_bound:${unit.id}:${claimId}`)
        }
        const allowedTexts = new Set([
          claim.summaryTr,
          ...claim.detailsTr,
          claim.claimBoundary,
          ...(relationTextsByClaimId.get(claimId) ?? []),
        ])
        if (!allowedTexts.has(unit.text)) errors.push(`unit:text_not_claim_bound:${unit.id}:${claimId}`)
        const displayedCard = input.sources.some((card) =>
          card.supportedClaimId === claimId
          && unit.passageIds.includes(card.passageId)
          && unit.sourceIds.includes(card.sourceId))
        if (!displayedCard) errors.push(`unit:displayed_source_card_missing:${unit.id}:${claimId}`)
      }
    } else if (unit.authority === "case_report") {
      if (
        !unit.caseFieldIds.length ||
        unit.caseFieldIds.some((fieldId) => !ALLOWED_CASE_FIELD_ID.test(fieldId)) ||
        unit.claimIds.length ||
        unit.passageIds.length ||
        unit.sourceIds.length
      ) {
        errors.push(`unit:case_binding_invalid:${unit.id}`)
      }
    } else if (unit.claimIds.length || unit.passageIds.length || unit.sourceIds.length || unit.caseFieldIds.length) {
      errors.push(`unit:policy_binding_invalid:${unit.id}`)
    }
  }

  const displayed = [input.summary, ...input.details, ...input.limitations]
    .flatMap((value) => value.split("\n"))
    .map((value) => value.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean)
  for (const text of displayed) {
    if (!input.units.some((unit) => unit.text === text)) errors.push(`display:unbound_text:${text}`)
  }

  for (const card of input.sources) {
    const claim = claimBySourceId.get(card.supportedClaimId)
    const passage = passageById.get(card.passageId)
    const source = sourceById.get(card.sourceId)
    if (!claim || !passage || !source) {
      errors.push(`source_card:unknown_binding:${card.id}`)
      continue
    }
    if (
      passage.sourceId !== source.id ||
      claim.releaseStatus !== source.releaseStatus ||
      passage.releaseStatus !== claim.releaseStatus ||
      !["permitted", "not_applicable"].includes(source.licenseStatus) ||
      !claim.passageIds.includes(passage.id) ||
      !claim.sourceIds.includes(source.id) ||
      !entailed.has(`${claim.sourceClaimId}\u0000${passage.id}`)
    ) errors.push(`source_card:not_entailed:${card.id}`)
    if (
      card.supportedClaim !== claim.summaryTr ||
      card.knownBoundary !== claim.claimBoundary ||
      card.title !== source.title ||
      card.authors !== (typeof source.authors === "string" ? source.authors : source.authors.join(", ")) ||
      card.year !== source.year ||
      card.sourceType !== source.sourceType ||
      card.doi !== source.doi ||
      card.officialUrl !== source.officialUrl ||
      card.locator !== passage.locator ||
      card.evidenceLevel !== claim.evidenceLevel ||
      card.ageScope !== claim.ageScope ||
      (!card.doi && !card.officialUrl)
    ) errors.push(`source_card:presentation_mismatch:${card.id}`)
  }
  return Object.freeze(stableUnique(errors))
}
