import { createHash } from "node:crypto"

import {
  DNA_V3_STATIC_GRAPH_VERSION,
  DNA_V3_STATIC_PACKAGE_VERSION,
  type DnaV3StaticClaim,
  type DnaV3StaticClaimPassageLink,
  type DnaV3StaticLexicalIndex,
  type DnaV3StaticManifest,
  type DnaV3StaticPackage,
  type DnaV3StaticPassage,
  type DnaV3StaticRelation,
  type DnaV3StaticSource,
} from "../catalog/generated/v3/types"
import type { DnaV2CatalogReaudit } from "./v2CatalogReaudit"
import { DNA_CURRENT_V2_CATALOG_REAUDIT } from "./v2CatalogReaudit"
import {
  DNA_CURRENT_V3_RELEASE_PACKAGE,
  type DnaV3ReleasedCandidateAuthorization,
} from "./releaseCompiler"
import {
  assertDnaV3StaticPackageHasNoForbiddenPayload,
  dnaV3Sha256,
  validateDnaV3EvidenceGraph,
} from "./v3EvidenceGraph"

export const DNA_V3_STATIC_PACKAGE_COMPILER_VERSION =
  "dna-v3-static-package-compiler@1" as const
export const DNA_V3_STATIC_PACKAGE_GENERATED_AT = "2026-07-19T00:00:00.000Z" as const
export const DNA_V3_STATIC_PACKAGE_SOURCE_CUTOFF = "2026-07-19" as const
export const DNA_V3_STATIC_RELEASE_REGISTRY_VERSION =
  "dna-v3-static-claim-release-registry@1" as const

export type DnaV3StaticClaimAuthorization = Readonly<{
  candidateId: string
  authority: "dna_product_information" | "external_scientific_information"
  claimId: string
  claimSha256: string
  passageId: string
  passageSha256: string
  publicationDigest: string
  releaseAuthorizationDigest: string
}> & Readonly<{
  sourceId?: string
  sourceSha256?: string
}>

/**
 * Production authorization is committed governance state, never request input.
 * It remains empty until real claims complete every V3 release gate.
 */
function staticAuthorizationFromRelease(
  released: DnaV3ReleasedCandidateAuthorization,
): DnaV3StaticClaimAuthorization {
  return Object.freeze({
    candidateId: released.candidateId,
    authority: released.authority,
    claimId: released.claimId,
    claimSha256: released.claimSha256,
    passageId: released.passageId,
    passageSha256: released.passageSha256,
    publicationDigest: released.publicationDigest,
    releaseAuthorizationDigest: released.authorizationDigest,
    ...(released.authority === "external_scientific_information"
      ? { sourceId: released.sourceId, sourceSha256: released.sourceSha256 }
      : {}),
  })
}

/** Derived from the canonical Phase-27 release package; no second authority registry exists. */
export const DNA_CURRENT_V3_STATIC_CLAIM_AUTHORIZATIONS = Object.freeze(
  DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates.map(staticAuthorizationFromRelease),
)

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function serializedJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function dnaV3StaticFileSha256(value: unknown): string {
  return createHash("sha256").update(serializedJson(value), "utf8").digest("hex")
}

function cloneSortedById<T extends { readonly id: string }>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]
    .map((value) => deepFreeze({ ...value }))
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
}

function normalizeSources(values: readonly DnaV3StaticSource[]): readonly DnaV3StaticSource[] {
  return Object.freeze([...values]
    .map((source) => deepFreeze({
      ...source,
      authors: [...source.authors],
      artifacts: [...source.artifacts]
        .map((artifact) => ({ ...artifact }))
        .sort((left, right) => left.id.localeCompare(right.id, "en")),
    }))
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
}

function normalizeClaims(values: readonly DnaV3StaticClaim[]): readonly DnaV3StaticClaim[] {
  return Object.freeze([...values]
    .map((claim) => deepFreeze({
      ...claim,
      sourceIds: [...claim.sourceIds].sort((left, right) => left.localeCompare(right, "en")),
      passageIds: [...claim.passageIds].sort((left, right) => left.localeCompare(right, "en")),
    }))
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
}

function normalizeRelations(
  values: readonly DnaV3StaticRelation[],
): readonly DnaV3StaticRelation[] {
  return Object.freeze([...values]
    .map((relation) => deepFreeze({
      ...relation,
      directEvidenceLinkIds: [...relation.directEvidenceLinkIds]
        .sort((left, right) => left.localeCompare(right, "en")),
    }))
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
}

function normalizeLexicalIndex(value: DnaV3StaticLexicalIndex): DnaV3StaticLexicalIndex {
  return deepFreeze({
    schemaVersion: "dna-v3-lexical-index@1" as const,
    entries: [...value.entries]
      .map((entry) => ({
        ...entry,
        aliases: [...entry.aliases].sort((left, right) => left.localeCompare(right, "tr")),
        keywords: [...entry.keywords].sort((left, right) => left.localeCompare(right, "tr")),
        tokens: [...entry.tokens].sort((left, right) => left.localeCompare(right, "tr")),
        claimIds: [...entry.claimIds].sort((left, right) => left.localeCompare(right, "en")),
        relationIds: [...entry.relationIds].sort((left, right) => left.localeCompare(right, "en")),
        relationToTopicEvidence: [...entry.relationToTopicEvidence]
          .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId, "en")),
      }))
      .sort((left, right) => left.id.localeCompare(right.id, "en")),
  })
}

function inputManifestHash(input: Readonly<{
  reauditSnapshotSha256: string
  releaseRegistry: readonly DnaV3StaticClaimAuthorization[]
  releasePackageInputSha256: string
  sourceCutoffDate: string
}>): string {
  return dnaV3Sha256({
    compilerVersion: DNA_V3_STATIC_PACKAGE_COMPILER_VERSION,
    releaseRegistryVersion: DNA_V3_STATIC_RELEASE_REGISTRY_VERSION,
    reauditSnapshotSha256: input.reauditSnapshotSha256,
    releasePackageInputSha256: input.releasePackageInputSha256,
    releaseRegistry: [...input.releaseRegistry]
      .sort((left, right) => left.candidateId.localeCompare(right.candidateId, "en")),
    sourceCutoffDate: input.sourceCutoffDate,
  })
}

function packageHash(fileSha256: DnaV3StaticManifest["fileSha256"]): string {
  return dnaV3Sha256({
    schemaVersion: DNA_V3_STATIC_PACKAGE_VERSION,
    graphVersion: DNA_V3_STATIC_GRAPH_VERSION,
    fileSha256,
  })
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left)].sort((x, y) => x.localeCompare(y, "en"))
  const b = [...new Set(right)].sort((x, y) => x.localeCompare(y, "en"))
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function assertStaticPackageReleaseBindings(
  packageValue: Pick<DnaV3StaticPackage,
    "sources" | "passages" | "claims" | "claimPassageLinks">,
  authorizations: readonly DnaV3StaticClaimAuthorization[],
): void {
  const sourceById = new Map(packageValue.sources.map((source) => [source.id, source]))
  const passageById = new Map(packageValue.passages.map((passage) => [passage.id, passage]))
  const authorizationClaimIds = [...new Set(authorizations.map((record) => record.claimId))]
  if (!sameStringSet(packageValue.claims.map((claim) => claim.id), authorizationClaimIds)) {
    throw new Error("dna_v3_static_claim_set_not_exactly_authorized")
  }

  for (const claim of packageValue.claims) {
    const records = authorizations.filter((record) => record.claimId === claim.id)
    if (!records.length || records.some((record) => record.claimSha256 !== claim.sha256)) {
      throw new Error("dna_v3_static_claim_not_in_audited_release_registry")
    }
    if (new Set(records.map((record) => record.authority)).size !== 1) {
      throw new Error("dna_v3_static_claim_mixed_authorities")
    }
    const authorizedPassageIds = records.map((record) => record.passageId)
    if (!sameStringSet(claim.passageIds, authorizedPassageIds)) {
      throw new Error("dna_v3_static_claim_passage_set_mismatch")
    }
    for (const record of records) {
      const passage = passageById.get(record.passageId)
      if (!passage || passage.sha256 !== record.passageSha256) {
        throw new Error("dna_v3_static_authorized_passage_hash_mismatch")
      }
      if (record.authority === "external_scientific_information") {
        const source = record.sourceId ? sourceById.get(record.sourceId) : null
        if (!source || source.sha256 !== record.sourceSha256
          || passage.sourceId !== record.sourceId) {
          throw new Error("dna_v3_static_authorized_source_hash_mismatch")
        }
      }
    }

    if (records.every((record) => record.authority === "external_scientific_information")) {
      const authorizedSourceIds = records.flatMap((record) => record.sourceId ? [record.sourceId] : [])
      if (!sameStringSet(claim.sourceIds, authorizedSourceIds)) {
        throw new Error("dna_v3_static_claim_source_set_mismatch")
      }
    }

    const links = packageValue.claimPassageLinks.filter((link) => link.claimId === claim.id)
    const authorizedLinkKeys = records.map((record) =>
      `${record.claimId}\u0000${record.passageId}\u0000${record.sourceId ?? "*"}`)
    const actualLinkKeys = links.map((link) =>
      `${link.claimId}\u0000${link.passageId}\u0000${records[0]?.authority === "external_scientific_information" ? link.sourceId : "*"}`)
    if (!sameStringSet(actualLinkKeys, authorizedLinkKeys)) {
      throw new Error("dna_v3_static_claim_passage_link_authorization_mismatch")
    }
  }
}

function assertExactKeys(
  value: unknown,
  allowed: readonly string[],
  code: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !sameStringSet(Object.keys(value), allowed)) {
    throw new Error(code)
  }
}

function assertStaticPackageExactSchema(packageValue: DnaV3StaticPackage): void {
  const edgeKeys = ["evidenceId", "kind", "supportRecordId", "supportRecordSha256", "evidenceSha256"]
  const assertEdge = (edge: unknown) => assertExactKeys(edge, edgeKeys, "dna_v3_static_edge_unknown_field")
  assertExactKeys(packageValue,
    ["manifest", "sources", "passages", "claims", "relations", "claimPassageLinks", "lexicalIndex"],
    "dna_v3_static_package_unknown_field")
  assertExactKeys(packageValue.manifest, [
    "schemaVersion", "graphVersion", "generatedAt", "sourceCutoffDate", "inputManifestSha256",
    "releasePackageInputSha256", "releaseAuthorizationSetSha256", "packageSha256", "counts",
    "fileSha256", "v2ReauditSnapshotSha256", "releaseRegistryCount", "runtimeEligible",
  ], "dna_v3_static_manifest_unknown_field")
  assertExactKeys(packageValue.manifest.counts, ["included", "excluded"], "dna_v3_static_counts_unknown_field")
  assertExactKeys(packageValue.manifest.counts.included, [
    "sources", "artifacts", "passages", "claims", "relations", "claimPassageLinks",
    "lexicalEntries", "topics", "answerUnits",
  ], "dna_v3_static_included_counts_unknown_field")
  assertExactKeys(packageValue.manifest.counts.excluded, [
    "legacyV2Claims", "missingRealPassage", "legacyExpertPending", "orphanLegacySources",
  ], "dna_v3_static_excluded_counts_unknown_field")
  assertExactKeys(packageValue.manifest.fileSha256, [
    "sources", "passages", "claims", "relations", "claimPassageLinks", "lexicalIndex",
  ], "dna_v3_static_file_hashes_unknown_field")
  for (const source of packageValue.sources) {
    assertExactKeys(source, [
      "id", "sha256", "title", "authors", "year", "venue", "doi", "pmid", "pmcid", "isbn",
      "licensePolicy", "artifacts",
    ], "dna_v3_static_source_unknown_field")
    for (const artifact of source.artifacts) {
      assertExactKeys(artifact, ["id", "sha256", "format", "sourceToArtifactEvidence"],
        "dna_v3_static_artifact_unknown_field")
      assertEdge(artifact.sourceToArtifactEvidence)
    }
  }
  for (const passage of packageValue.passages) {
    assertExactKeys(passage, [
      "id", "sha256", "sourceId", "artifactId", "originalLanguage", "locator", "text",
      "approvedTurkishText", "ageScope", "population", "claimBoundary", "artifactToPassageEvidence",
    ], "dna_v3_static_passage_unknown_field")
    assertEdge(passage.artifactToPassageEvidence)
  }
  for (const claim of packageValue.claims) {
    assertExactKeys(claim, [
      "id", "sha256", "text", "detail", "claimType", "evidenceLevel", "ageScope", "population",
      "claimBoundary", "dnaRelation", "releaseStatus", "sourceIds", "passageIds",
    ], "dna_v3_static_claim_unknown_field")
  }
  for (const relation of packageValue.relations) {
    assertExactKeys(relation, [
      "id", "sha256", "claimId", "fromTopicId", "toTopicId", "predicate", "summary",
      "claimBoundary", "directEvidenceLinkIds", "maxHops", "claimToRelationEvidence",
    ], "dna_v3_static_relation_unknown_field")
    assertEdge(relation.claimToRelationEvidence)
  }
  for (const link of packageValue.claimPassageLinks) {
    assertExactKeys(link, [
      "id", "sha256", "sourceId", "artifactId", "passageId", "claimId", "passageToClaimEvidence",
    ], "dna_v3_static_claim_passage_link_unknown_field")
    assertEdge(link.passageToClaimEvidence)
  }
  assertExactKeys(packageValue.lexicalIndex, ["schemaVersion", "entries"],
    "dna_v3_static_lexical_index_unknown_field")
  for (const entry of packageValue.lexicalIndex.entries) {
    assertExactKeys(entry, [
      "id", "topicId", "topicSha256", "answerUnitId", "answerUnitSha256", "title", "aliases",
      "keywords", "tokens", "claimIds", "relationIds", "relationToTopicEvidence",
      "topicToAnswerUnitEvidence",
    ], "dna_v3_static_lexical_entry_unknown_field")
    entry.relationToTopicEvidence.forEach(assertEdge)
    assertEdge(entry.topicToAnswerUnitEvidence)
  }
}

type DnaV3StaticPackageCompileInput = Readonly<{
  reaudit: DnaV2CatalogReaudit
  sources: readonly DnaV3StaticSource[]
  passages: readonly DnaV3StaticPassage[]
  claims: readonly DnaV3StaticClaim[]
  relations: readonly DnaV3StaticRelation[]
  claimPassageLinks: readonly DnaV3StaticClaimPassageLink[]
  lexicalIndex: DnaV3StaticLexicalIndex
  generatedAt?: string
  sourceCutoffDate?: string
}>

function compileWithRegistry(
  input: DnaV3StaticPackageCompileInput,
  releaseRegistryInput: readonly DnaV3StaticClaimAuthorization[],
  releasePackageInputSha256: string,
): DnaV3StaticPackage {
  const generatedAt = input.generatedAt ?? DNA_V3_STATIC_PACKAGE_GENERATED_AT
  const sourceCutoffDate = input.sourceCutoffDate ?? DNA_V3_STATIC_PACKAGE_SOURCE_CUTOFF
  const generatedTimestamp = Date.parse(generatedAt)
  if (!Number.isFinite(generatedTimestamp)
    || new Date(generatedTimestamp).toISOString() !== generatedAt) {
    throw new Error("dna_v3_static_invalid_generated_at")
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceCutoffDate)
    || Number.isNaN(Date.parse(`${sourceCutoffDate}T00:00:00.000Z`))) {
    throw new Error("dna_v3_static_invalid_source_cutoff_date")
  }
  if (!/^[a-f0-9]{64}$/.test(releasePackageInputSha256)) {
    throw new Error("dna_v3_static_release_package_input_hash_invalid")
  }
  const releaseRegistry = [...releaseRegistryInput]
    .map((record) => ({ ...record }))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId, "en"))
  if (new Set(releaseRegistry.map((record) => record.candidateId)).size !== releaseRegistry.length) {
    throw new Error("dna_v3_static_duplicate_release_registry_candidate")
  }
  if (releaseRegistry.some((record) =>
    !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,159}$/.test(record.candidateId)
    || !["dna_product_information", "external_scientific_information"].includes(record.authority)
    || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,159}$/.test(record.claimId)
    || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,159}$/.test(record.passageId)
    || !/^[a-f0-9]{64}$/.test(record.claimSha256)
    || !/^[a-f0-9]{64}$/.test(record.passageSha256)
    || !/^[a-f0-9]{64}$/.test(record.publicationDigest)
    || !/^[a-f0-9]{64}$/.test(record.releaseAuthorizationDigest))) {
    throw new Error("dna_v3_static_release_registry_record_invalid")
  }
  for (const record of releaseRegistry) {
    if (record.authority === "external_scientific_information") {
      if (!record.sourceId || !record.sourceSha256
        || !/^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,159}$/.test(record.sourceId)
        || !/^[a-f0-9]{64}$/.test(record.sourceSha256)) {
        throw new Error("dna_v3_static_release_registry_source_invalid")
      }
    } else if (record.sourceId !== undefined || record.sourceSha256 !== undefined) {
      throw new Error("dna_v3_static_product_release_registry_source_forbidden")
    }
  }

  const sources = normalizeSources(input.sources)
  const passages = cloneSortedById(input.passages)
  const claims = normalizeClaims(input.claims)
  const relations = normalizeRelations(input.relations)
  const claimPassageLinks = cloneSortedById(input.claimPassageLinks)
  const lexicalIndex = normalizeLexicalIndex(input.lexicalIndex)
  const graph = validateDnaV3EvidenceGraph({
    sources,
    passages,
    claims,
    relations,
    claimPassageLinks,
    lexicalIndex,
  })
  assertStaticPackageReleaseBindings({
    sources,
    passages,
    claims,
    claimPassageLinks,
  }, releaseRegistry)

  const fileSha256 = deepFreeze({
    sources: dnaV3StaticFileSha256(sources),
    passages: dnaV3StaticFileSha256(passages),
    claims: dnaV3StaticFileSha256(claims),
    relations: dnaV3StaticFileSha256(relations),
    claimPassageLinks: dnaV3StaticFileSha256(claimPassageLinks),
    lexicalIndex: dnaV3StaticFileSha256(lexicalIndex),
  })
  const manifest: DnaV3StaticManifest = deepFreeze({
    schemaVersion: DNA_V3_STATIC_PACKAGE_VERSION,
    graphVersion: DNA_V3_STATIC_GRAPH_VERSION,
    generatedAt,
    sourceCutoffDate,
    inputManifestSha256: inputManifestHash({
      reauditSnapshotSha256: input.reaudit.snapshotSha256,
      releaseRegistry,
      releasePackageInputSha256,
      sourceCutoffDate,
    }),
    releasePackageInputSha256,
    releaseAuthorizationSetSha256: dnaV3Sha256(releaseRegistry),
    packageSha256: packageHash(fileSha256),
    counts: {
      included: {
        sources: graph.counts.sources,
        artifacts: graph.counts.artifacts,
        passages: graph.counts.passages,
        claims: graph.counts.claims,
        relations: graph.counts.relations,
        claimPassageLinks: claimPassageLinks.length,
        lexicalEntries: lexicalIndex.entries.length,
        topics: graph.counts.topics,
        answerUnits: graph.counts.answerUnits,
      },
      excluded: {
        legacyV2Claims: input.reaudit.counts.quarantinedClaims,
        missingRealPassage: input.reaudit.counts.missingRealPassage,
        legacyExpertPending: input.reaudit.counts.legacyExpertPending,
        orphanLegacySources: input.reaudit.sourceAudit.orphanSourceIds.length,
      },
    },
    fileSha256,
    v2ReauditSnapshotSha256: input.reaudit.snapshotSha256,
    releaseRegistryCount: releaseRegistry.length,
    runtimeEligible: claims.length > 0,
  })
  const compiled = deepFreeze({
    manifest,
    sources,
    passages,
    claims,
    relations,
    claimPassageLinks,
    lexicalIndex,
  })
  assertStaticPackageExactSchema(compiled)
  assertDnaV3StaticPackageHasNoForbiddenPayload(compiled)
  return compiled
}

/** Production compiler: release authority comes only from the immutable registry above. */
export function compileDnaV3StaticPackage(
  input: DnaV3StaticPackageCompileInput,
): DnaV3StaticPackage {
  return compileWithRegistry(
    input,
    DNA_CURRENT_V3_STATIC_CLAIM_AUTHORIZATIONS,
    DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
  )
}

/**
 * Synthetic positive-path seam. Both an explicit fixture environment and a
 * non-production process are required, so callers cannot self-authorize
 * production claims.
 */
export function compileDnaV3StaticPackageForTest(
  input: DnaV3StaticPackageCompileInput & Readonly<{
    testReleaseRegistry: readonly DnaV3StaticClaimAuthorization[]
    testReleasePackageInputSha256: string
  }>,
): DnaV3StaticPackage {
  if (process.env.NODE_ENV === "production"
    || process.env.DNA_V3_STATIC_PACKAGE_TEST_FIXTURE !== "1") {
    throw new Error("dna_v3_static_test_release_registry_forbidden")
  }
  const { testReleaseRegistry, testReleasePackageInputSha256, ...compileInput } = input
  return compileWithRegistry(compileInput, testReleaseRegistry, testReleasePackageInputSha256)
}

export function validateDnaV3StaticPackage(
  packageValue: DnaV3StaticPackage,
): DnaV3StaticPackage {
  assertStaticPackageExactSchema(packageValue)
  assertDnaV3StaticPackageHasNoForbiddenPayload(packageValue)
  if (packageValue.manifest.schemaVersion !== DNA_V3_STATIC_PACKAGE_VERSION
    || packageValue.manifest.graphVersion !== DNA_V3_STATIC_GRAPH_VERSION) {
    throw new Error("dna_v3_static_manifest_version_mismatch")
  }
  const generatedTimestamp = Date.parse(packageValue.manifest.generatedAt)
  if (!Number.isFinite(generatedTimestamp)
    || new Date(generatedTimestamp).toISOString() !== packageValue.manifest.generatedAt
    || !/^\d{4}-\d{2}-\d{2}$/.test(packageValue.manifest.sourceCutoffDate)
    || Number.isNaN(Date.parse(`${packageValue.manifest.sourceCutoffDate}T00:00:00.000Z`))) {
    throw new Error("dna_v3_static_manifest_date_invalid")
  }
  for (const hash of [
    packageValue.manifest.inputManifestSha256,
    packageValue.manifest.releasePackageInputSha256,
    packageValue.manifest.releaseAuthorizationSetSha256,
    packageValue.manifest.packageSha256,
    packageValue.manifest.v2ReauditSnapshotSha256,
    ...Object.values(packageValue.manifest.fileSha256),
  ]) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("dna_v3_static_manifest_hash_invalid")
  }
  const numericCounts = [
    ...Object.values(packageValue.manifest.counts.included),
    ...Object.values(packageValue.manifest.counts.excluded),
    packageValue.manifest.releaseRegistryCount,
  ]
  if (numericCounts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error("dna_v3_static_manifest_count_invalid")
  }
  const graph = validateDnaV3EvidenceGraph(packageValue)
  const actualFileHashes = {
    sources: dnaV3StaticFileSha256(packageValue.sources),
    passages: dnaV3StaticFileSha256(packageValue.passages),
    claims: dnaV3StaticFileSha256(packageValue.claims),
    relations: dnaV3StaticFileSha256(packageValue.relations),
    claimPassageLinks: dnaV3StaticFileSha256(packageValue.claimPassageLinks),
    lexicalIndex: dnaV3StaticFileSha256(packageValue.lexicalIndex),
  }
  if (dnaV3Sha256(actualFileHashes) !== dnaV3Sha256(packageValue.manifest.fileSha256)) {
    throw new Error("dna_v3_static_component_hash_mismatch")
  }
  if (packageValue.manifest.packageSha256 !== packageHash(actualFileHashes)) {
    throw new Error("dna_v3_static_package_hash_mismatch")
  }
  const counts = packageValue.manifest.counts.included
  if (counts.sources !== graph.counts.sources
    || counts.artifacts !== graph.counts.artifacts
    || counts.passages !== graph.counts.passages
    || counts.claims !== graph.counts.claims
    || counts.relations !== graph.counts.relations
    || counts.claimPassageLinks !== packageValue.claimPassageLinks.length
    || counts.lexicalEntries !== packageValue.lexicalIndex.entries.length
    || counts.topics !== graph.counts.topics
    || counts.answerUnits !== graph.counts.answerUnits) {
    throw new Error("dna_v3_static_manifest_count_mismatch")
  }
  if (packageValue.manifest.runtimeEligible !== (packageValue.claims.length > 0)) {
    throw new Error("dna_v3_static_runtime_eligibility_mismatch")
  }
  if (packageValue.manifest.releaseRegistryCount < packageValue.claims.length) {
    throw new Error("dna_v3_static_release_registry_count_invalid")
  }
  return deepFreeze(packageValue)
}

/** Adds production registry binding to structural package validation. */
export function validateCurrentDnaV3StaticPackage(
  packageValue: DnaV3StaticPackage,
): DnaV3StaticPackage {
  const validated = validateDnaV3StaticPackage(packageValue)
  if (validated.manifest.v2ReauditSnapshotSha256
      !== DNA_CURRENT_V2_CATALOG_REAUDIT.snapshotSha256) {
    throw new Error("dna_v3_static_current_v2_reaudit_snapshot_mismatch")
  }
  if (validated.manifest.releasePackageInputSha256
      !== DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256) {
    throw new Error("dna_v3_static_current_release_package_mismatch")
  }
  if (validated.manifest.releaseAuthorizationSetSha256
      !== dnaV3Sha256(DNA_CURRENT_V3_STATIC_CLAIM_AUTHORIZATIONS)) {
    throw new Error("dna_v3_static_current_release_authorization_set_mismatch")
  }
  if (validated.manifest.releaseRegistryCount
      !== DNA_CURRENT_V3_STATIC_CLAIM_AUTHORIZATIONS.length) {
    throw new Error("dna_v3_static_production_registry_count_mismatch")
  }
  const expectedInputManifestSha256 = inputManifestHash({
    reauditSnapshotSha256: DNA_CURRENT_V2_CATALOG_REAUDIT.snapshotSha256,
    releaseRegistry: DNA_CURRENT_V3_STATIC_CLAIM_AUTHORIZATIONS,
    releasePackageInputSha256: DNA_CURRENT_V3_RELEASE_PACKAGE.inputSha256,
    sourceCutoffDate: validated.manifest.sourceCutoffDate,
  })
  if (validated.manifest.inputManifestSha256 !== expectedInputManifestSha256) {
    throw new Error("dna_v3_static_production_input_manifest_mismatch")
  }
  assertStaticPackageReleaseBindings(validated, DNA_CURRENT_V3_STATIC_CLAIM_AUTHORIZATIONS)
  return validated
}
