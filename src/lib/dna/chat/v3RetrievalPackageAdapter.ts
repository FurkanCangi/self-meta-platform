import type {
  DnaV3StaticClaim,
  DnaV3StaticLexicalEntry,
  DnaV3StaticPackage,
} from "./catalog/generated/v3/types"
import { tokenizeDnaChatText } from "./text"
import type {
  DnaV3RetrievalClaim,
  DnaV3RetrievalPackage,
} from "./v3RetrievalCore"

const DNA_RELATIONSHIPS = new Set<DnaV3RetrievalClaim["dnaRelationship"]>([
  "product_definition",
  "supported_relation",
  "conceptual_proximity",
  "theory_only",
  "not_established",
  "contradicted",
  "not_applicable",
])

const PERMITTED_LICENSE_POLICIES = new Set([
  "cc0",
  "cc_by",
  "cc_by_sa",
  "cc_by_with_exceptions",
])

function isDnaRelationship(value: string): value is DnaV3RetrievalClaim["dnaRelationship"] {
  return DNA_RELATIONSHIPS.has(value as DnaV3RetrievalClaim["dnaRelationship"])
}

function licenseIsPermitted(policy: string): boolean {
  const normalized = policy.trim().toLocaleLowerCase("en-US")
  return PERMITTED_LICENSE_POLICIES.has(normalized)
}

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en"))
}

function lexicalEntriesByClaimId(
  pkg: DnaV3StaticPackage,
): Map<string, readonly DnaV3StaticLexicalEntry[]> {
  const collected = new Map<string, DnaV3StaticLexicalEntry[]>()
  for (const entry of pkg.lexicalIndex.entries) {
    for (const claimId of entry.claimIds) {
      const existing = collected.get(claimId) ?? []
      if (!existing.some((candidate) => candidate.id === entry.id)) {
        existing.push(entry)
        collected.set(claimId, existing)
      }
    }
  }
  return new Map([...collected].map(([claimId, entries]) => [
    claimId,
    Object.freeze([...entries].sort((left, right) =>
      left.topicId.localeCompare(right.topicId, "en") ||
      left.id.localeCompare(right.id, "en"))),
  ]))
}

function adaptClaim(
  claim: DnaV3StaticClaim,
  entry: DnaV3StaticLexicalEntry | undefined,
): DnaV3RetrievalClaim | null {
  if (!entry || !isDnaRelationship(claim.dnaRelation)) return null
  return Object.freeze({
    id: `${claim.id}::${entry.topicId}`,
    sourceClaimId: claim.id,
    topicId: entry.topicId,
    title: entry.title,
    aliases: Object.freeze([...entry.aliases]),
    keywords: Object.freeze([...entry.keywords]),
    summaryTr: claim.text,
    detailsTr: Object.freeze([claim.detail].filter(Boolean)),
    claimType: claim.claimType,
    passageIds: Object.freeze([...claim.passageIds]),
    sourceIds: Object.freeze([...claim.sourceIds]),
    evidenceLevel: claim.evidenceLevel,
    ageScope: claim.ageScope,
    claimBoundary: claim.claimBoundary,
    dnaRelationship: claim.dnaRelation,
    releaseStatus: "release_eligible",
  })
}

/**
 * Converts the immutable server-only static graph into the retrieval view.
 * Missing lexical bindings, uncertain licenses and malformed DNA relation
 * classes are excluded rather than guessed.
 */
export function adaptDnaV3StaticPackageForRetrieval(
  pkg: DnaV3StaticPackage,
): DnaV3RetrievalPackage {
  const lexicalByClaim = lexicalEntriesByClaimId(pkg)
  const sources = pkg.sources
    .filter((source) => licenseIsPermitted(source.licensePolicy))
    .map((source) => Object.freeze({
      id: source.id,
      title: source.title,
      authors: Object.freeze([...source.authors]),
      year: source.year,
      sourceType: "scientific_source",
      doi: source.doi,
      officialUrl: source.doi ? `https://doi.org/${source.doi}` : null,
      evidenceLevel: "bound_at_claim_level",
      ageScope: "bound_at_claim_level",
      licenseStatus: "permitted" as const,
      releaseStatus: "release_eligible" as const,
    }))
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
  const permittedSourceIds = new Set(sources.map((source) => source.id))
  const passages = pkg.passages
    .filter((passage) => permittedSourceIds.has(passage.sourceId))
    .map((passage) => Object.freeze({
      id: passage.id,
      sourceId: passage.sourceId,
      locator: passage.locator,
      originalText: passage.text,
      approvedTurkishText: passage.approvedTurkishText,
      ageScope: passage.ageScope,
      population: passage.population,
      releaseStatus: "release_eligible" as const,
    }))
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
  const permittedPassageIds = new Set(passages.map((passage) => passage.id))
  const sourceClaims = pkg.claims.filter((claim) =>
    claim.sourceIds.length > 0 &&
    claim.passageIds.length > 0 &&
    claim.sourceIds.every((sourceId) => permittedSourceIds.has(sourceId)) &&
    claim.passageIds.every((passageId) => permittedPassageIds.has(passageId)))
  const claims = sourceClaims
    .flatMap((claim) => (lexicalByClaim.get(claim.id) ?? [])
      .map((entry) => adaptClaim(claim, entry)))
    .filter((claim): claim is DnaV3RetrievalClaim => claim !== null)
    .sort((left, right) => left.id.localeCompare(right.id, "en"))
  const acceptedSourceClaimIds = new Set(claims.map((claim) => claim.sourceClaimId))
  const staticClaimById = new Map(pkg.claims.map((claim) => [claim.id, claim]))
  const lexicalEntryByRetrievalClaimId = new Map<string, DnaV3StaticLexicalEntry>(
    sourceClaims.flatMap((claim) => (lexicalByClaim.get(claim.id) ?? [])
      .map((entry) => [`${claim.id}::${entry.topicId}`, entry] as const)),
  )

  return Object.freeze({
    manifest: Object.freeze({
      packageVersion: pkg.manifest.schemaVersion,
      packageSha256: pkg.manifest.packageSha256,
      includedClaimCount: pkg.manifest.counts.included.claims,
    }),
    sources: Object.freeze(sources),
    passages: Object.freeze(passages),
    claims: Object.freeze(claims),
    relations: Object.freeze(pkg.relations
      .filter((relation) => acceptedSourceClaimIds.has(relation.claimId))
      .map((relation) => {
        const claim = staticClaimById.get(relation.claimId)
        return Object.freeze({
          id: relation.id,
          fromTopicId: relation.fromTopicId,
          toTopicId: relation.toTopicId,
          predicate: relation.predicate,
          summaryTr: relation.summary,
          claimIds: Object.freeze([relation.claimId]),
          sourceIds: Object.freeze([...(claim?.sourceIds ?? [])]),
          maxHops: 1 as const,
          releaseStatus: "release_eligible" as const,
        })
      })
      .sort((left, right) => left.id.localeCompare(right.id, "en"))),
    claimPassageLinks: Object.freeze(pkg.claimPassageLinks
      .filter((link) =>
        acceptedSourceClaimIds.has(link.claimId) &&
        permittedPassageIds.has(link.passageId) &&
        link.passageToClaimEvidence.kind === "claim_passage_entailment")
      .map((link) => Object.freeze({
        claimId: link.claimId,
        passageId: link.passageId,
        entailmentStatus: "entailed" as const,
      }))
      .sort((left, right) =>
        left.claimId.localeCompare(right.claimId, "en") ||
        left.passageId.localeCompare(right.passageId, "en"))),
    lexicalIndex: Object.freeze(claims.map((claim) => {
      const entry = lexicalEntryByRetrievalClaimId.get(claim.id)
      const staticClaim = staticClaimById.get(claim.sourceClaimId)
      return Object.freeze({
        claimId: claim.id,
        titleTokens: Object.freeze(tokenizeDnaChatText(entry?.title ?? claim.title)),
        aliasTokens: Object.freeze(stableUnique(
          (entry?.aliases ?? claim.aliases).flatMap(tokenizeDnaChatText),
        )),
        keywordTokens: Object.freeze(stableUnique([
          ...(entry?.keywords ?? claim.keywords).flatMap(tokenizeDnaChatText),
          ...(entry?.tokens ?? []),
        ])),
        summaryTokens: Object.freeze(tokenizeDnaChatText(staticClaim?.text ?? claim.summaryTr)),
        detailTokens: Object.freeze(tokenizeDnaChatText(staticClaim?.detail ?? claim.detailsTr.join(" "))),
      })
    })),
  })
}
