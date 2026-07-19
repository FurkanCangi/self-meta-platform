import { createHash } from "node:crypto"

import {
  DNA_V3_GRAPH_EVIDENCE_KINDS,
  type DnaV3GraphEdgeEvidence,
  type DnaV3GraphEvidenceKind,
  type DnaV3StaticArtifact,
  type DnaV3StaticClaim,
  type DnaV3StaticClaimPassageLink,
  type DnaV3StaticLexicalEntry,
  type DnaV3StaticPackage,
  type DnaV3StaticPassage,
  type DnaV3StaticRelation,
  type DnaV3StaticSource,
} from "../catalog/generated/v3/types"

export const DNA_V3_EVIDENCE_GRAPH_VALIDATOR_VERSION =
  "dna-v3-evidence-graph-validator@1" as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,159}$/

export function stableDnaV3Json(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableDnaV3Json).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableDnaV3Json(object[key])}`).join(",")}}`
}

export function dnaV3Sha256(value: unknown): string {
  return createHash("sha256").update(stableDnaV3Json(value), "utf8").digest("hex")
}

function sortedIds(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "en"))
}

function sortedTurkishTerms(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "tr"))
}

/** Hashes only the source node's bibliographic identity; artifact edges stay outside it. */
export function dnaV3SourceNodeSha256(
  source: Pick<
    DnaV3StaticSource,
    | "id"
    | "title"
    | "authors"
    | "year"
    | "venue"
    | "doi"
    | "pmid"
    | "pmcid"
    | "isbn"
    | "licensePolicy"
  >,
): string {
  return dnaV3Sha256({
    nodeType: "source",
    id: source.id,
    title: source.title,
    authors: [...source.authors],
    year: source.year,
    venue: source.venue,
    doi: source.doi,
    pmid: source.pmid,
    pmcid: source.pmcid,
    isbn: source.isbn,
    licensePolicy: source.licensePolicy,
  })
}

/** Artifact bytes are audited upstream; this graph node binds its stable ID and format. */
export function dnaV3ArtifactNodeSha256(
  artifact: Pick<DnaV3StaticArtifact, "id" | "format">,
): string {
  return dnaV3Sha256({
    nodeType: "artifact",
    id: artifact.id,
    format: artifact.format,
  })
}

/** Hashes all passage content and metadata while excluding its outgoing edge record. */
export function dnaV3PassageNodeSha256(
  passage: Omit<DnaV3StaticPassage, "sha256" | "artifactToPassageEvidence">,
): string {
  return dnaV3Sha256({
    nodeType: "passage",
    id: passage.id,
    sourceId: passage.sourceId,
    artifactId: passage.artifactId,
    originalLanguage: passage.originalLanguage,
    locator: passage.locator,
    text: passage.text,
    approvedTurkishText: passage.approvedTurkishText,
    ageScope: passage.ageScope,
    population: passage.population,
    claimBoundary: passage.claimBoundary,
  })
}

/** Hashes the complete claim node, excluding only the hash field itself. */
export function dnaV3ClaimNodeSha256(
  claim: Omit<DnaV3StaticClaim, "sha256">,
): string {
  return dnaV3Sha256({
    nodeType: "claim",
    id: claim.id,
    text: claim.text,
    detail: claim.detail,
    claimType: claim.claimType,
    evidenceLevel: claim.evidenceLevel,
    ageScope: claim.ageScope,
    population: claim.population,
    claimBoundary: claim.claimBoundary,
    dnaRelation: claim.dnaRelation,
    releaseStatus: claim.releaseStatus,
    sourceIds: sortedIds(claim.sourceIds),
    passageIds: sortedIds(claim.passageIds),
  })
}

/** Hashes the claim-passage identity without recursively including its edge evidence. */
export function dnaV3ClaimPassageLinkNodeSha256(
  link: Omit<DnaV3StaticClaimPassageLink, "sha256" | "passageToClaimEvidence">,
): string {
  return dnaV3Sha256({
    nodeType: "claim_passage_link",
    id: link.id,
    sourceId: link.sourceId,
    artifactId: link.artifactId,
    passageId: link.passageId,
    claimId: link.claimId,
  })
}

/** Hashes direct one-hop relation content without its claim edge evidence. */
export function dnaV3RelationNodeSha256(
  relation: Omit<DnaV3StaticRelation, "sha256" | "claimToRelationEvidence">,
): string {
  return dnaV3Sha256({
    nodeType: "relation",
    id: relation.id,
    claimId: relation.claimId,
    fromTopicId: relation.fromTopicId,
    toTopicId: relation.toTopicId,
    predicate: relation.predicate,
    summary: relation.summary,
    claimBoundary: relation.claimBoundary,
    directEvidenceLinkIds: sortedIds(relation.directEvidenceLinkIds),
    maxHops: relation.maxHops,
  })
}

/** Builds the topic-node hash from the lexical entry's canonical topic fields. */
export function dnaV3TopicNodeSha256(
  entry: Pick<
    DnaV3StaticLexicalEntry,
    "topicId" | "title" | "aliases" | "keywords" | "tokens"
  >,
): string {
  return dnaV3Sha256({
    nodeType: "topic",
    id: entry.topicId,
    title: entry.title,
    aliases: sortedTurkishTerms(entry.aliases),
    keywords: sortedTurkishTerms(entry.keywords),
    tokens: sortedTurkishTerms(entry.tokens),
  })
}

/** Builds the answer-unit-node hash from its canonical claim/relation composition. */
export function dnaV3AnswerUnitNodeSha256(
  entry: Pick<DnaV3StaticLexicalEntry, "answerUnitId" | "claimIds" | "relationIds">,
): string {
  return dnaV3Sha256({
    nodeType: "answer_unit",
    id: entry.answerUnitId,
    claimIds: sortedIds(entry.claimIds),
    relationIds: sortedIds(entry.relationIds),
  })
}

function requireId(value: string, code: string): string {
  const normalized = String(value || "").trim()
  if (!STABLE_ID_PATTERN.test(normalized)) throw new Error(code)
  return normalized
}

function requireHash(value: string, code: string): string {
  const normalized = String(value || "").trim().toLowerCase()
  if (!SHA256_PATTERN.test(normalized)) throw new Error(code)
  return normalized
}

function assertUnique<T>(
  values: readonly T[],
  select: (value: T) => string,
  code: string,
): void {
  const ids = values.map(select)
  if (new Set(ids).size !== ids.length) throw new Error(code)
}

function assertSorted<T>(
  values: readonly T[],
  select: (value: T) => string,
  code: string,
): void {
  const keys = values.map(select)
  const sorted = [...keys].sort((left, right) => left.localeCompare(right, "en"))
  if (keys.some((key, index) => key !== sorted[index])) throw new Error(code)
}

function edgeCore(evidence: DnaV3GraphEdgeEvidence) {
  return {
    evidenceId: evidence.evidenceId,
    kind: evidence.kind,
    supportRecordId: evidence.supportRecordId,
    supportRecordSha256: evidence.supportRecordSha256,
  }
}

export function createDnaV3GraphEdgeEvidence(input: Readonly<{
  evidenceId: string
  kind: DnaV3GraphEvidenceKind
  supportRecordId: string
  supportRecordSha256: string
}>): DnaV3GraphEdgeEvidence {
  const core = {
    evidenceId: requireId(input.evidenceId, "dna_v3_graph_invalid_evidence_id"),
    kind: input.kind,
    supportRecordId: requireId(
      input.supportRecordId,
      "dna_v3_graph_invalid_evidence_support_id",
    ),
    supportRecordSha256: requireHash(
      input.supportRecordSha256,
      "dna_v3_graph_invalid_evidence_support_sha256",
    ),
  }
  if (!DNA_V3_GRAPH_EVIDENCE_KINDS.includes(core.kind)) {
    throw new Error("dna_v3_graph_invalid_evidence_kind")
  }
  return Object.freeze({ ...core, evidenceSha256: dnaV3Sha256(core) })
}

function assertEvidence(
  evidence: DnaV3GraphEdgeEvidence,
  kind: DnaV3GraphEvidenceKind,
  supportRecordId: string,
  supportRecordSha256: string,
): void {
  requireId(evidence.evidenceId, "dna_v3_graph_invalid_evidence_id")
  requireHash(evidence.supportRecordSha256, "dna_v3_graph_invalid_evidence_support_sha256")
  requireHash(evidence.evidenceSha256, "dna_v3_graph_invalid_evidence_sha256")
  if (evidence.kind !== kind) throw new Error("dna_v3_graph_wrong_edge_evidence_kind")
  if (evidence.supportRecordId !== supportRecordId
    || evidence.supportRecordSha256 !== supportRecordSha256) {
    throw new Error("dna_v3_graph_edge_evidence_parent_mismatch")
  }
  if (evidence.evidenceSha256 !== dnaV3Sha256(edgeCore(evidence))) {
    throw new Error("dna_v3_graph_edge_evidence_hash_mismatch")
  }
}

function forbiddenStaticString(value: string): string | null {
  if (/^(?:\/(?:Users|Volumes|home|private|var|tmp)\/|[A-Za-z]:\\)/.test(value)) {
    return "absolute_path"
  }
  if (/file:\/\//i.test(value)) return "file_uri"
  if (/(?:%PDF-|<\?xml\b|<!DOCTYPE\s+(?:article|book)|<jats:|<article(?:\s|>))/i.test(value)) {
    return "raw_pdf_or_xml"
  }
  return null
}

export function assertDnaV3StaticPackageHasNoForbiddenPayload(
  value: unknown,
  path = "package",
): void {
  if (typeof value === "string") {
    const reason = forbiddenStaticString(value)
    if (reason) throw new Error(`dna_v3_static_forbidden_${reason}:${path}`)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      assertDnaV3StaticPackageHasNoForbiddenPayload(child, `${path}[${index}]`))
    return
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      assertDnaV3StaticPackageHasNoForbiddenPayload(child, `${path}.${key}`)
    }
  }
}

export type DnaV3EvidenceGraphValidation = Readonly<{
  schemaVersion: typeof DNA_V3_EVIDENCE_GRAPH_VALIDATOR_VERSION
  valid: true
  counts: Readonly<{
    sources: number
    artifacts: number
    passages: number
    claims: number
    relations: number
    topics: number
    answerUnits: number
    edges: number
  }>
  maxRelationHops: 1
}>

export function validateDnaV3EvidenceGraph(
  packageValue: Pick<
    DnaV3StaticPackage,
    "sources" | "passages" | "claims" | "relations" | "claimPassageLinks" | "lexicalIndex"
  >,
): DnaV3EvidenceGraphValidation {
  assertDnaV3StaticPackageHasNoForbiddenPayload(packageValue)
  assertUnique(packageValue.sources, (value) => value.id, "dna_v3_graph_duplicate_source")
  assertUnique(packageValue.passages, (value) => value.id, "dna_v3_graph_duplicate_passage")
  assertUnique(packageValue.claims, (value) => value.id, "dna_v3_graph_duplicate_claim")
  assertUnique(packageValue.relations, (value) => value.id, "dna_v3_graph_duplicate_relation")
  assertUnique(
    packageValue.claimPassageLinks,
    (value) => value.id,
    "dna_v3_graph_duplicate_claim_passage_link",
  )
  assertUnique(
    packageValue.lexicalIndex.entries,
    (value) => value.id,
    "dna_v3_graph_duplicate_lexical_entry",
  )
  assertUnique(
    packageValue.lexicalIndex.entries,
    (value) => value.topicId,
    "dna_v3_graph_duplicate_topic",
  )
  assertUnique(
    packageValue.lexicalIndex.entries,
    (value) => value.answerUnitId,
    "dna_v3_graph_duplicate_answer_unit",
  )

  assertSorted(packageValue.sources, (value) => value.id, "dna_v3_graph_sources_not_sorted")
  assertSorted(packageValue.passages, (value) => value.id, "dna_v3_graph_passages_not_sorted")
  assertSorted(packageValue.claims, (value) => value.id, "dna_v3_graph_claims_not_sorted")
  assertSorted(packageValue.relations, (value) => value.id, "dna_v3_graph_relations_not_sorted")
  assertSorted(
    packageValue.claimPassageLinks,
    (value) => value.id,
    "dna_v3_graph_claim_passage_links_not_sorted",
  )
  assertSorted(
    packageValue.lexicalIndex.entries,
    (value) => value.id,
    "dna_v3_graph_lexical_entries_not_sorted",
  )

  const sources = new Map(packageValue.sources.map((value) => [value.id, value]))
  const artifacts = new Map(packageValue.sources.flatMap((source) =>
    source.artifacts.map((artifact) => [artifact.id, { source, artifact }] as const)))
  const artifactList = packageValue.sources.flatMap((source) => source.artifacts)
  assertUnique(artifactList, (value) => value.id, "dna_v3_graph_duplicate_artifact")

  for (const source of packageValue.sources) {
    requireId(source.id, "dna_v3_graph_invalid_source_id")
    requireHash(source.sha256, "dna_v3_graph_invalid_source_sha256")
    if (source.sha256 !== dnaV3SourceNodeSha256(source)) {
      throw new Error("dna_v3_graph_source_content_hash_mismatch")
    }
    if (source.artifacts.length === 0) throw new Error("dna_v3_graph_source_without_artifact")
    assertSorted(source.artifacts, (value) => value.id, "dna_v3_graph_artifacts_not_sorted")
    for (const artifact of source.artifacts) {
      requireId(artifact.id, "dna_v3_graph_invalid_artifact_id")
      requireHash(artifact.sha256, "dna_v3_graph_invalid_artifact_sha256")
      if (artifact.sha256 !== dnaV3ArtifactNodeSha256(artifact)) {
        throw new Error("dna_v3_graph_artifact_content_hash_mismatch")
      }
      assertEvidence(
        artifact.sourceToArtifactEvidence,
        "source_artifact_identity",
        source.id,
        source.sha256,
      )
    }
  }

  const passages = new Map(packageValue.passages.map((value) => [value.id, value]))
  for (const passage of packageValue.passages) {
    requireId(passage.id, "dna_v3_graph_invalid_passage_id")
    requireHash(passage.sha256, "dna_v3_graph_invalid_passage_sha256")
    if (passage.sha256 !== dnaV3PassageNodeSha256(passage)) {
      throw new Error("dna_v3_graph_passage_content_hash_mismatch")
    }
    const artifactRecord = artifacts.get(passage.artifactId)
    if (!artifactRecord || artifactRecord.source.id !== passage.sourceId) {
      throw new Error("dna_v3_graph_passage_artifact_source_mismatch")
    }
    assertEvidence(
      passage.artifactToPassageEvidence,
      "artifact_passage_binding",
      artifactRecord.artifact.id,
      artifactRecord.artifact.sha256,
    )
  }

  const claims = new Map(packageValue.claims.map((value) => [value.id, value]))
  const links = new Map(packageValue.claimPassageLinks.map((value) => [value.id, value]))
  const linksByClaim = new Map<string, DnaV3StaticClaimPassageLink[]>()
  for (const link of packageValue.claimPassageLinks) {
    requireId(link.id, "dna_v3_graph_invalid_claim_passage_link_id")
    requireHash(link.sha256, "dna_v3_graph_invalid_claim_passage_link_sha256")
    if (link.sha256 !== dnaV3ClaimPassageLinkNodeSha256(link)) {
      throw new Error("dna_v3_graph_claim_passage_link_content_hash_mismatch")
    }
    const passage = passages.get(link.passageId)
    const claim = claims.get(link.claimId)
    if (!passage || !claim) throw new Error("dna_v3_graph_link_node_missing")
    if (passage.sourceId !== link.sourceId || passage.artifactId !== link.artifactId) {
      throw new Error("dna_v3_graph_link_provenance_mismatch")
    }
    if (!claim.sourceIds.includes(link.sourceId) || !claim.passageIds.includes(link.passageId)) {
      throw new Error("dna_v3_graph_link_claim_binding_mismatch")
    }
    assertEvidence(
      link.passageToClaimEvidence,
      "claim_passage_entailment",
      passage.id,
      passage.sha256,
    )
    const current = linksByClaim.get(claim.id) ?? []
    current.push(link)
    linksByClaim.set(claim.id, current)
  }

  for (const claim of packageValue.claims) {
    requireId(claim.id, "dna_v3_graph_invalid_claim_id")
    requireHash(claim.sha256, "dna_v3_graph_invalid_claim_sha256")
    if (claim.sha256 !== dnaV3ClaimNodeSha256(claim)) {
      throw new Error("dna_v3_graph_claim_content_hash_mismatch")
    }
    if (claim.releaseStatus !== "release_eligible") {
      throw new Error("dna_v3_graph_claim_not_release_eligible")
    }
    if (claim.sourceIds.length === 0 || claim.passageIds.length === 0) {
      throw new Error("dna_v3_graph_claim_without_direct_passage")
    }
    if (new Set(claim.sourceIds).size !== claim.sourceIds.length
      || new Set(claim.passageIds).size !== claim.passageIds.length) {
      throw new Error("dna_v3_graph_claim_duplicate_provenance")
    }
    const claimLinks = linksByClaim.get(claim.id) ?? []
    if (claimLinks.length === 0
      || claim.passageIds.some((passageId) =>
        !claimLinks.some((link) => link.passageId === passageId))
      || claim.sourceIds.some((sourceId) =>
        !claimLinks.some((link) => link.sourceId === sourceId))) {
      throw new Error("dna_v3_graph_claim_passage_edge_missing")
    }
  }

  const relations = new Map(packageValue.relations.map((value) => [value.id, value]))
  const relationsByClaim = new Map<string, DnaV3StaticRelation[]>()
  for (const relation of packageValue.relations) {
    requireId(relation.id, "dna_v3_graph_invalid_relation_id")
    requireHash(relation.sha256, "dna_v3_graph_invalid_relation_sha256")
    if (relation.sha256 !== dnaV3RelationNodeSha256(relation)) {
      throw new Error("dna_v3_graph_relation_content_hash_mismatch")
    }
    if (relation.maxHops !== 1) throw new Error("dna_v3_graph_relation_must_be_one_hop")
    const claim = claims.get(relation.claimId)
    if (!claim) throw new Error("dna_v3_graph_relation_claim_missing")
    if (relation.directEvidenceLinkIds.length === 0) {
      throw new Error("dna_v3_graph_relation_direct_evidence_required")
    }
    for (const linkId of relation.directEvidenceLinkIds) {
      const link = links.get(linkId)
      if (!link || link.claimId !== relation.claimId) {
        throw new Error("dna_v3_graph_relation_cannot_combine_endpoint_sources")
      }
    }
    assertEvidence(
      relation.claimToRelationEvidence,
      "direct_relation_support",
      claim.id,
      claim.sha256,
    )
    const current = relationsByClaim.get(claim.id) ?? []
    current.push(relation)
    relationsByClaim.set(claim.id, current)
  }
  for (const claim of packageValue.claims) {
    if ((relationsByClaim.get(claim.id) ?? []).length === 0) {
      throw new Error("dna_v3_graph_claim_relation_edge_missing")
    }
  }

  const directlyUsedLinkIds = new Set(packageValue.relations
    .flatMap((relation) => relation.directEvidenceLinkIds))
  if (packageValue.claimPassageLinks.some((link) => !directlyUsedLinkIds.has(link.id))) {
    throw new Error("dna_v3_graph_orphan_claim_passage_link")
  }

  const referencedRelationIds = new Set<string>()
  const referencedClaimIds = new Set<string>()
  const topicIds = new Set(packageValue.lexicalIndex.entries.map((entry) => entry.topicId))
  if (packageValue.relations.some((relation) =>
    !topicIds.has(relation.fromTopicId) || !topicIds.has(relation.toTopicId))) {
    throw new Error("dna_v3_graph_relation_endpoint_topic_missing")
  }
  for (const entry of packageValue.lexicalIndex.entries) {
    requireId(entry.id, "dna_v3_graph_invalid_lexical_entry_id")
    requireId(entry.topicId, "dna_v3_graph_invalid_topic_id")
    requireId(entry.answerUnitId, "dna_v3_graph_invalid_answer_unit_id")
    requireHash(entry.topicSha256, "dna_v3_graph_invalid_topic_sha256")
    requireHash(entry.answerUnitSha256, "dna_v3_graph_invalid_answer_unit_sha256")
    if (entry.topicSha256 !== dnaV3TopicNodeSha256(entry)) {
      throw new Error("dna_v3_graph_topic_content_hash_mismatch")
    }
    if (entry.answerUnitSha256 !== dnaV3AnswerUnitNodeSha256(entry)) {
      throw new Error("dna_v3_graph_answer_unit_content_hash_mismatch")
    }
    if (entry.claimIds.length === 0 || entry.relationIds.length === 0) {
      throw new Error("dna_v3_graph_answer_unit_chain_incomplete")
    }
    if (entry.relationToTopicEvidence.length !== entry.relationIds.length) {
      throw new Error("dna_v3_graph_relation_topic_evidence_count_mismatch")
    }
    for (const claimId of entry.claimIds) {
      if (!claims.has(claimId)) throw new Error("dna_v3_graph_answer_unit_claim_missing")
      referencedClaimIds.add(claimId)
    }
    for (const relationId of entry.relationIds) {
      const relation = relations.get(relationId)
      if (!relation) throw new Error("dna_v3_graph_answer_unit_relation_missing")
      if (relation.fromTopicId !== entry.topicId && relation.toTopicId !== entry.topicId) {
        throw new Error("dna_v3_graph_relation_topic_mismatch")
      }
      if (!entry.claimIds.includes(relation.claimId)) {
        throw new Error("dna_v3_graph_answer_unit_relation_claim_mismatch")
      }
      const evidence = entry.relationToTopicEvidence.find((row) =>
        row.supportRecordId === relation.id)
      if (!evidence) throw new Error("dna_v3_graph_relation_topic_edge_missing")
      assertEvidence(evidence, "relation_topic_binding", relation.id, relation.sha256)
      referencedRelationIds.add(relationId)
    }
    assertEvidence(
      entry.topicToAnswerUnitEvidence,
      "topic_answer_unit_composition",
      entry.topicId,
      entry.topicSha256,
    )
    if (entry.claimIds.some((claimId) =>
      !entry.relationIds.some((relationId) => relations.get(relationId)?.claimId === claimId))) {
      throw new Error("dna_v3_graph_answer_unit_claim_has_no_relation")
    }
  }
  if (packageValue.relations.some((relation) => !referencedRelationIds.has(relation.id))) {
    throw new Error("dna_v3_graph_orphan_relation")
  }
  if (packageValue.claims.some((claim) => !referencedClaimIds.has(claim.id))) {
    throw new Error("dna_v3_graph_orphan_claim")
  }
  if (packageValue.passages.some((passage) =>
    !packageValue.claimPassageLinks.some((link) => link.passageId === passage.id))) {
    throw new Error("dna_v3_graph_orphan_passage")
  }
  if (packageValue.sources.some((source) =>
    !packageValue.passages.some((passage) => passage.sourceId === source.id))) {
    throw new Error("dna_v3_graph_orphan_source")
  }
  if (artifactList.some((artifact) =>
    !packageValue.passages.some((passage) => passage.artifactId === artifact.id))) {
    throw new Error("dna_v3_graph_orphan_artifact")
  }

  const edges = artifactList.length
    + packageValue.passages.length
    + packageValue.claimPassageLinks.length
    + packageValue.relations.length
    + packageValue.lexicalIndex.entries.reduce(
      (total, entry) => total + entry.relationToTopicEvidence.length + 1,
      0,
    )
  return Object.freeze({
    schemaVersion: DNA_V3_EVIDENCE_GRAPH_VALIDATOR_VERSION,
    valid: true as const,
    counts: Object.freeze({
      sources: packageValue.sources.length,
      artifacts: artifactList.length,
      passages: packageValue.passages.length,
      claims: packageValue.claims.length,
      relations: packageValue.relations.length,
      topics: packageValue.lexicalIndex.entries.length,
      answerUnits: packageValue.lexicalIndex.entries.length,
      edges,
    }),
    maxRelationHops: 1 as const,
  })
}

/** Returns only explicit relations incident to the requested topic; never traverses onward. */
export function getDnaV3DirectOneHopRelations(
  relations: readonly DnaV3StaticRelation[],
  topicId: string,
): readonly DnaV3StaticRelation[] {
  requireId(topicId, "dna_v3_graph_invalid_query_topic_id")
  return Object.freeze(relations
    .filter((relation) => relation.fromTopicId === topicId || relation.toTopicId === topicId)
    .sort((left, right) => left.id.localeCompare(right.id, "en")))
}
