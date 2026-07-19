import assert from "node:assert/strict"
import { promises as fs } from "node:fs"
import path from "node:path"

import type {
  DnaV3StaticPackage,
  DnaV3StaticRelation,
} from "../src/lib/dna/chat/catalog/generated/v3/types"
import {
  DNA_CHAT_CATALOG_CLAIMS,
  DNA_CHAT_CATALOG_RELATIONS,
  DNA_CHAT_CATALOG_SOURCES,
  DNA_CHAT_CATALOG_TOPICS,
} from "../src/lib/dna/chat/catalog"
import {
  DNA_CURRENT_V2_CATALOG_REAUDIT,
  reauditDnaV2Catalog,
  reauditDnaV2CatalogForTest,
} from "../src/lib/dna/chat/governance/v2CatalogReaudit"
import {
  createDnaV3GraphEdgeEvidence,
  dnaV3AnswerUnitNodeSha256,
  dnaV3ArtifactNodeSha256,
  dnaV3ClaimNodeSha256,
  dnaV3ClaimPassageLinkNodeSha256,
  dnaV3PassageNodeSha256,
  dnaV3RelationNodeSha256,
  dnaV3Sha256,
  dnaV3SourceNodeSha256,
  dnaV3TopicNodeSha256,
  getDnaV3DirectOneHopRelations,
  validateDnaV3EvidenceGraph,
} from "../src/lib/dna/chat/governance/v3EvidenceGraph"
import {
  compileDnaV3StaticPackage,
  compileDnaV3StaticPackageForTest,
  validateCurrentDnaV3StaticPackage,
  validateDnaV3StaticPackage,
} from "../src/lib/dna/chat/governance/v3StaticPackage"
import { adaptDnaV3StaticPackageForRetrieval } from "../src/lib/dna/chat/v3RetrievalPackageAdapter"
import { resolveDnaV3Retrieval } from "../src/lib/dna/chat/v3RetrievalCore"
import { createDnaV3ScientificUnit } from "../src/lib/dna/chat/v3AnswerEvidence"

const ROOT = process.cwd()
const GENERATED = path.join(ROOT, "src/lib/dna/chat/catalog/generated/v3")
const SNAPSHOT = path.join(
  ROOT,
  "docs/dna-intelligence/governance/v3/v2-catalog-reaudit-snapshot.json",
)

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function emptyPackage(): DnaV3StaticPackage {
  return compileDnaV3StaticPackage({
    reaudit: DNA_CURRENT_V2_CATALOG_REAUDIT,
    sources: [],
    passages: [],
    claims: [],
    relations: [],
    claimPassageLinks: [],
    lexicalIndex: { schemaVersion: "dna-v3-lexical-index@1", entries: [] },
  })
}

function syntheticPackage(
  licensePolicy = "test_fixture_only",
  sourceOverrides: Readonly<{
    doi?: string | null
    pmid?: string | null
    pmcid?: string | null
    officialUrl?: string | null
    studyDesign?: string
    dnaRelation?: string
    claimAuthority?: "dna_product_information" | "external_scientific_information"
    releaseAuthority?: "dna_product_information" | "external_scientific_information"
  }> = {},
): DnaV3StaticPackage {
  const claimAuthority = sourceOverrides.claimAuthority ?? "external_scientific_information"
  const releaseAuthority = sourceOverrides.releaseAuthority ?? claimAuthority
  const sourceNode = {
    id: "source.synthetic",
    title: "Synthetic source",
    authors: ["Test Author"],
    year: 2026,
    venue: "Test Journal",
    doi: sourceOverrides.doi === undefined ? "10.1234/synthetic" : sourceOverrides.doi,
    pmid: sourceOverrides.pmid ?? null,
    pmcid: sourceOverrides.pmcid ?? null,
    isbn: null,
    officialUrl: sourceOverrides.officialUrl ?? null,
    studyDesign: sourceOverrides.studyDesign ?? "systematic_review_meta_analysis",
    licensePolicy,
  } as const
  const sourceSha256 = dnaV3SourceNodeSha256(sourceNode)
  const artifactNode = { id: "artifact.synthetic", format: "jats_xml" } as const
  const artifactSha256 = dnaV3ArtifactNodeSha256(artifactNode)
  const passageNode = {
    id: "passage.synthetic",
    sourceId: "source.synthetic",
    artifactId: "artifact.synthetic",
    originalLanguage: "en",
    locator: "sec.results.p1",
    text: "Synthetic approved passage.",
    approvedTurkishText: "Sentetik onaylı pasaj.",
    ageScope: "adult",
    population: "human",
    claimBoundary: "Synthetic contract fixture only.",
  } as const
  const passageSha256 = dnaV3PassageNodeSha256(passageNode)
  const claimNode = {
    id: "claim.synthetic",
    text: "Synthetic A is directly related to synthetic B.",
    detail: "Synthetic graph fixture.",
    claimType: "relation",
    evidenceLevel: "moderate",
    ageScope: "adult",
    population: "human",
    claimBoundary: "Synthetic contract fixture only.",
    dnaRelation: sourceOverrides.dnaRelation ?? "not_applicable",
    authority: claimAuthority,
    releaseStatus: claimAuthority === "dna_product_information"
      ? "owner_approved"
      : "release_eligible",
    sourceIds: ["source.synthetic"],
    passageIds: ["passage.synthetic"],
  } as const
  const claimSha256 = dnaV3ClaimNodeSha256(claimNode)
  const linkNode = {
    id: "link.synthetic",
    sourceId: "source.synthetic",
    artifactId: "artifact.synthetic",
    passageId: "passage.synthetic",
    claimId: "claim.synthetic",
  } as const
  const linkSha256 = dnaV3ClaimPassageLinkNodeSha256(linkNode)
  const relationNode = {
    id: "relation.synthetic",
    claimId: "claim.synthetic",
    fromTopicId: "topic.synthetic.a",
    toTopicId: "topic.synthetic.b",
    predicate: "directly_related_to",
    summary: "Synthetic direct one-hop relation.",
    claimBoundary: "No chained inference.",
    directEvidenceLinkIds: ["link.synthetic"],
    maxHops: 1,
  } as const
  const relationSha256 = dnaV3RelationNodeSha256(relationNode)
  const lexicalANode = {
    id: "lexical.synthetic.a",
    topicId: "topic.synthetic.a",
    answerUnitId: "answer.synthetic.a",
    title: "Synthetic A",
    aliases: ["A"],
    keywords: ["synthetic"],
    tokens: ["a", "synthetic"],
    claimIds: ["claim.synthetic"],
    relationIds: ["relation.synthetic"],
  } as const
  const lexicalBNode = {
    id: "lexical.synthetic.b",
    topicId: "topic.synthetic.b",
    answerUnitId: "answer.synthetic.b",
    title: "Synthetic B",
    aliases: ["B"],
    keywords: ["synthetic"],
    tokens: ["b", "synthetic"],
    claimIds: ["claim.synthetic"],
    relationIds: ["relation.synthetic"],
  } as const
  const topicASha256 = dnaV3TopicNodeSha256(lexicalANode)
  const topicBSha256 = dnaV3TopicNodeSha256(lexicalBNode)

  return compileDnaV3StaticPackageForTest({
    reaudit: DNA_CURRENT_V2_CATALOG_REAUDIT,
    testReleaseRegistry: [{
      candidateId: "candidate.synthetic",
      authority: releaseAuthority,
      claimId: "claim.synthetic",
      claimSha256,
      passageId: "passage.synthetic",
      passageSha256,
      publicationDigest: dnaV3Sha256({ fixture: "synthetic-publication" }),
      releaseAuthorizationDigest: dnaV3Sha256({
        fixture: "synthetic",
        claimId: "claim.synthetic",
        claimSha256,
      }),
      ...(releaseAuthority === "external_scientific_information"
        ? { sourceId: "source.synthetic", sourceSha256 }
        : {}),
    }],
    testReleasePackageInputSha256: dnaV3Sha256({ fixture: "synthetic-release-package" }),
    sources: [{
      ...sourceNode,
      sha256: sourceSha256,
      artifacts: [{
        ...artifactNode,
        sha256: artifactSha256,
        sourceToArtifactEvidence: createDnaV3GraphEdgeEvidence({
          evidenceId: "edge.source-artifact.synthetic",
          kind: "source_artifact_identity",
          supportRecordId: "source.synthetic",
          supportRecordSha256: sourceSha256,
        }),
      }],
    }],
    passages: [{
      ...passageNode,
      sha256: passageSha256,
      artifactToPassageEvidence: createDnaV3GraphEdgeEvidence({
        evidenceId: "edge.artifact-passage.synthetic",
        kind: "artifact_passage_binding",
        supportRecordId: "artifact.synthetic",
        supportRecordSha256: artifactSha256,
      }),
    }],
    claims: [{
      ...claimNode,
      sha256: claimSha256,
    }],
    claimPassageLinks: [{
      ...linkNode,
      sha256: linkSha256,
      passageToClaimEvidence: createDnaV3GraphEdgeEvidence({
        evidenceId: "edge.passage-claim.synthetic",
        kind: "claim_passage_entailment",
        supportRecordId: "passage.synthetic",
        supportRecordSha256: passageSha256,
      }),
    }],
    relations: [{
      ...relationNode,
      sha256: relationSha256,
      claimToRelationEvidence: createDnaV3GraphEdgeEvidence({
        evidenceId: "edge.claim-relation.synthetic",
        kind: "direct_relation_support",
        supportRecordId: "claim.synthetic",
        supportRecordSha256: claimSha256,
      }),
    }],
    lexicalIndex: {
      schemaVersion: "dna-v3-lexical-index@1",
      entries: [
        {
          ...lexicalANode,
          topicSha256: topicASha256,
          answerUnitSha256: dnaV3AnswerUnitNodeSha256(lexicalANode),
          relationToTopicEvidence: [createDnaV3GraphEdgeEvidence({
            evidenceId: "edge.relation-topic.synthetic.a",
            kind: "relation_topic_binding",
            supportRecordId: "relation.synthetic",
            supportRecordSha256: relationSha256,
          })],
          topicToAnswerUnitEvidence: createDnaV3GraphEdgeEvidence({
            evidenceId: "edge.topic-answer.synthetic.a",
            kind: "topic_answer_unit_composition",
            supportRecordId: "topic.synthetic.a",
            supportRecordSha256: topicASha256,
          }),
        },
        {
          ...lexicalBNode,
          topicSha256: topicBSha256,
          answerUnitSha256: dnaV3AnswerUnitNodeSha256(lexicalBNode),
          relationToTopicEvidence: [createDnaV3GraphEdgeEvidence({
            evidenceId: "edge.relation-topic.synthetic.b",
            kind: "relation_topic_binding",
            supportRecordId: "relation.synthetic",
            supportRecordSha256: relationSha256,
          })],
          topicToAnswerUnitEvidence: createDnaV3GraphEdgeEvidence({
            evidenceId: "edge.topic-answer.synthetic.b",
            kind: "topic_answer_unit_composition",
            supportRecordId: "topic.synthetic.b",
            supportRecordSha256: topicBSha256,
          }),
        },
      ],
    },
  })
}

function syntheticTwoPassagePackage(base: DnaV3StaticPackage): DnaV3StaticPackage {
  const firstClaim = base.claims[0]!
  const secondPassageNode = {
    id: "passage.synthetic.second",
    sourceId: "source.synthetic",
    artifactId: "artifact.synthetic",
    originalLanguage: "en",
    locator: "sec.results.p2",
    text: "Second synthetic approved passage.",
    approvedTurkishText: "İkinci sentetik onaylı pasaj.",
    ageScope: "adult",
    population: "human",
    claimBoundary: "Synthetic contract fixture only.",
  } as const
  const secondPassageSha256 = dnaV3PassageNodeSha256(secondPassageNode)
  const claimNode = {
    id: firstClaim.id,
    text: firstClaim.text,
    detail: firstClaim.detail,
    claimType: firstClaim.claimType,
    evidenceLevel: firstClaim.evidenceLevel,
    ageScope: firstClaim.ageScope,
    population: firstClaim.population,
    claimBoundary: firstClaim.claimBoundary,
    dnaRelation: firstClaim.dnaRelation,
    authority: firstClaim.authority,
    releaseStatus: firstClaim.releaseStatus,
    sourceIds: [...firstClaim.sourceIds],
    passageIds: [base.passages[0]!.id, secondPassageNode.id],
  } as const
  const claimSha256 = dnaV3ClaimNodeSha256(claimNode)
  const secondLinkNode = {
    id: "link.synthetic.second",
    sourceId: "source.synthetic",
    artifactId: "artifact.synthetic",
    passageId: secondPassageNode.id,
    claimId: firstClaim.id,
  } as const
  const baseRelation = base.relations[0]!
  const relationNode = {
    id: baseRelation.id,
    claimId: baseRelation.claimId,
    fromTopicId: baseRelation.fromTopicId,
    toTopicId: baseRelation.toTopicId,
    predicate: baseRelation.predicate,
    summary: baseRelation.summary,
    claimBoundary: baseRelation.claimBoundary,
    directEvidenceLinkIds: [base.claimPassageLinks[0]!.id, secondLinkNode.id],
    maxHops: 1 as const,
  }
  const relationSha256 = dnaV3RelationNodeSha256(relationNode)
  const relation = {
    ...relationNode,
    sha256: relationSha256,
    claimToRelationEvidence: createDnaV3GraphEdgeEvidence({
      evidenceId: "edge.claim-relation.synthetic",
      kind: "direct_relation_support",
      supportRecordId: firstClaim.id,
      supportRecordSha256: claimSha256,
    }),
  }
  const authorization = (candidateId: string, passageId: string, passageSha256: string) => ({
    candidateId,
    authority: "external_scientific_information" as const,
    claimId: firstClaim.id,
    claimSha256,
    passageId,
    passageSha256,
    publicationDigest: dnaV3Sha256({ candidateId, kind: "publication" }),
    releaseAuthorizationDigest: dnaV3Sha256({ candidateId, kind: "authorization" }),
    sourceId: base.sources[0]!.id,
    sourceSha256: base.sources[0]!.sha256,
  })
  return compileDnaV3StaticPackageForTest({
    reaudit: DNA_CURRENT_V2_CATALOG_REAUDIT,
    testReleaseRegistry: [
      authorization("candidate.synthetic.first", base.passages[0]!.id, base.passages[0]!.sha256),
      authorization("candidate.synthetic.second", secondPassageNode.id, secondPassageSha256),
    ],
    testReleasePackageInputSha256: dnaV3Sha256({ fixture: "synthetic-two-passage-release-package" }),
    sources: base.sources,
    passages: [
      base.passages[0]!,
      {
        ...secondPassageNode,
        sha256: secondPassageSha256,
        artifactToPassageEvidence: createDnaV3GraphEdgeEvidence({
          evidenceId: "edge.artifact-passage.synthetic.second",
          kind: "artifact_passage_binding",
          supportRecordId: "artifact.synthetic",
          supportRecordSha256: base.sources[0]!.artifacts[0]!.sha256,
        }),
      },
    ],
    claims: [{ ...claimNode, sha256: claimSha256 }],
    relations: [relation],
    claimPassageLinks: [
      base.claimPassageLinks[0]!,
      {
        ...secondLinkNode,
        sha256: dnaV3ClaimPassageLinkNodeSha256(secondLinkNode),
        passageToClaimEvidence: createDnaV3GraphEdgeEvidence({
          evidenceId: "edge.passage-claim.synthetic.second",
          kind: "claim_passage_entailment",
          supportRecordId: secondPassageNode.id,
          supportRecordSha256: secondPassageSha256,
        }),
      },
    ],
    lexicalIndex: {
      ...base.lexicalIndex,
      entries: base.lexicalIndex.entries.map((entry) => ({
        ...entry,
        relationToTopicEvidence: entry.relationToTopicEvidence.map((edge) =>
          createDnaV3GraphEdgeEvidence({
            evidenceId: edge.evidenceId,
            kind: "relation_topic_binding",
            supportRecordId: relation.id,
            supportRecordSha256: relationSha256,
          })),
      })),
    },
  })
}

async function readCheckedPackage(): Promise<DnaV3StaticPackage> {
  const read = async (name: string) => JSON.parse(
    await fs.readFile(path.join(GENERATED, name), "utf8"),
  ) as unknown
  return {
    manifest: await read("manifest.json"),
    sources: await read("sources.json"),
    passages: await read("passages.json"),
    claims: await read("claims.json"),
    relations: await read("relations.json"),
    claimPassageLinks: await read("claim-passage-links.json"),
    lexicalIndex: await read("lexical-index.json"),
  } as DnaV3StaticPackage
}

async function writePackage(packageValue: DnaV3StaticPackage): Promise<void> {
  await fs.mkdir(GENERATED, { recursive: true })
  const files: ReadonlyArray<readonly [string, unknown]> = [
    ["manifest.json", packageValue.manifest],
    ["sources.json", packageValue.sources],
    ["passages.json", packageValue.passages],
    ["claims.json", packageValue.claims],
    ["relations.json", packageValue.relations],
    ["claim-passage-links.json", packageValue.claimPassageLinks],
    ["lexical-index.json", packageValue.lexicalIndex],
  ]
  await Promise.all(files.map(([name, value]) =>
    fs.writeFile(path.join(GENERATED, name), json(value), "utf8")))
  await fs.mkdir(path.dirname(SNAPSHOT), { recursive: true })
  await fs.writeFile(SNAPSHOT, json(DNA_CURRENT_V2_CATALOG_REAUDIT), "utf8")
}

function literalModuleSpecifiers(source: string): readonly string[] {
  const specifiers = new Set<string>()
  for (const pattern of [
    /\bimport\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]!)
  }
  return Object.freeze([...specifiers])
}

function importsGeneratedV3Json(source: string): boolean {
  return literalModuleSpecifiers(source).some((specifier) =>
    /(?:^|\/)(?:claims|passages|sources|relations|claim-passage-links|lexical-index|manifest)\.json$/.test(specifier))
}

function importsGeneratedV3Server(source: string): boolean {
  return literalModuleSpecifiers(source).some((specifier) =>
    /(?:^|\/)generated\/v3\/server$/.test(specifier))
}

function violatesGeneratedV3JsonBoundary(source: string, relativePath: string): boolean {
  return relativePath !== "src/lib/dna/chat/catalog/generated/v3/server.ts"
    && importsGeneratedV3Json(source)
}

async function assertServerBoundary(): Promise<void> {
  const serverFile = await fs.readFile(path.join(GENERATED, "server.ts"), "utf8")
  assert.match(serverFile, /^import "server-only"/)
  assert.match(
    serverFile,
    /loadedPackage = validateCurrentDnaV3StaticPackage\(\{/,
    "Generated loader birleşik paketi current trust root ile doğrulamalı",
  )
  assert.match(
    serverFile,
    /export const DNA_V3_STATIC_PACKAGE = loadDnaV3StaticPackage\(\)/,
    "Generated loader doğrulamasını import anında eager çalıştırmalı",
  )
  const retrievalServerFile = await fs.readFile(
    path.join(ROOT, "src/lib/dna/chat/v3RetrievalServer.ts"),
    "utf8",
  )
  assert.match(retrievalServerFile, /^import "server-only"/)
  assert.match(retrievalServerFile, /evaluateDnaChatRuntimeRelease/)
  assert.match(
    retrievalServerFile,
    /const DNA_V3_VALIDATED_STATIC_PACKAGE = validateCurrentDnaV3StaticPackage\(\s*DNA_V3_STATIC_PACKAGE,?\s*\)/,
    "Retrieval server, loader export'unu import sınırında yeniden doğrulamalı",
  )
  assert.match(
    retrievalServerFile,
    /adaptDnaV3StaticPackageForRetrieval\(\s*DNA_V3_VALIDATED_STATIC_PACKAGE,?\s*\)/,
    "Retrieval adaptörü yalnız yeniden doğrulanmış paketi tüketmeli",
  )
  assert.doesNotMatch(
    retrievalServerFile,
    /adaptDnaV3StaticPackageForRetrieval\(\s*DNA_V3_STATIC_PACKAGE,?\s*\)/,
    "Ham loader export'u doğrudan retrieval adaptörüne bağlanmamalı",
  )
  assert.match(retrievalServerFile, /caseContext\?: DnaChatSafeCaseContext/)
  assert.doesNotMatch(retrievalServerFile, /hasVerifiedReportContext/)
  for (const barrel of [
    "src/lib/dna/chat/index.ts",
    "src/lib/dna/chat/catalog/index.ts",
  ]) {
    const source = await fs.readFile(path.join(ROOT, barrel), "utf8")
    assert.equal(importsGeneratedV3Server(source), false)
  }

  const plainClosurePath =
    '"src/lib/dna/chat/catalog/generated/v3/claims.json"'
  const forbiddenOutsideImport =
    'import forgedClaims from "./catalog/generated/v3/claims.json"'
  assert.equal(importsGeneratedV3Json(plainClosurePath), false,
    "Düz metin JSON yolu import olarak sınıflandırılmamalı")
  assert.equal(
    violatesGeneratedV3JsonBoundary(forbiddenOutsideImport, "src/lib/dna/chat/forged.ts"),
    true,
    "Server loader dışındaki gerçek JSON importu ihlal sayılmalı",
  )
  assert.equal(
    violatesGeneratedV3JsonBoundary(
      'import claims from "./claims.json"',
      "src/lib/dna/chat/catalog/generated/v3/server.ts",
    ),
    false,
    "Kanonik server loader JSON import yetkisini korumalı",
  )

  async function walk(directory: string): Promise<string[]> {
    const rows = await fs.readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(rows.map((row) => {
      const full = path.join(directory, row.name)
      return row.isDirectory() ? walk(full) : [full]
    }))
    return nested.flat()
  }
  const clientImporters: string[] = []
  const rawJsonImporters: string[] = []
  const serverRuntimeImporters: string[] = []
  for (const file of await walk(path.join(ROOT, "src"))) {
    if (!/\.(?:ts|tsx)$/.test(file)) continue
    const source = await fs.readFile(file, "utf8")
    if (/^[\s\r\n]*["']use client["']/m.test(source)
      && importsGeneratedV3Server(source)) {
      clientImporters.push(path.relative(ROOT, file))
    }
    const relative = path.relative(ROOT, file)
    if (violatesGeneratedV3JsonBoundary(source, relative)) {
      rawJsonImporters.push(relative)
    }
    if (importsGeneratedV3Server(source)) serverRuntimeImporters.push(relative)
  }
  assert.deepEqual(clientImporters, [])
  assert.deepEqual(rawJsonImporters, [], "Generated V3 JSON yalnız server loader tarafından import edilmeli")
  assert.deepEqual(serverRuntimeImporters, ["src/lib/dna/chat/v3RetrievalServer.ts"])
}

async function main(): Promise<void> {
  assert.equal(DNA_CHAT_CATALOG_CLAIMS.length, 239)
  assert.equal(DNA_CURRENT_V2_CATALOG_REAUDIT.counts.auditedClaims, 239)
  assert.equal(DNA_CURRENT_V2_CATALOG_REAUDIT.counts.releaseEligibleClaims, 0)
  assert.equal(DNA_CURRENT_V2_CATALOG_REAUDIT.counts.quarantinedClaims, 239)
  assert.equal(DNA_CURRENT_V2_CATALOG_REAUDIT.counts.missingRealPassage, 239)
  assert.equal(DNA_CURRENT_V2_CATALOG_REAUDIT.counts.legacyExpertPending, 239)
  assert.equal(DNA_CURRENT_V2_CATALOG_REAUDIT.v2MutationPerformed, false)
  assert.ok(DNA_CURRENT_V2_CATALOG_REAUDIT.claims.every((record) =>
    record.status === "quarantined"
    && !record.v3Eligible
    && record.exclusionReasons.includes("missing_real_passage")
    && record.exclusionReasons.includes("legacy_source_id_is_not_passage_evidence")
    && record.exclusionReasons.includes("legacy_expert_pending")))
  assert.doesNotMatch(JSON.stringify(DNA_CURRENT_V2_CATALOG_REAUDIT), /expert_approved/)

  const repeated = reauditDnaV2Catalog({
    claims: DNA_CHAT_CATALOG_CLAIMS,
    relations: DNA_CHAT_CATALOG_RELATIONS,
    topics: DNA_CHAT_CATALOG_TOPICS,
    sources: DNA_CHAT_CATALOG_SOURCES,
  })
  assert.equal(repeated.snapshotSha256, DNA_CURRENT_V2_CATALOG_REAUDIT.snapshotSha256)
  assert.equal(DNA_CHAT_CATALOG_CLAIMS.length, 239, "V2 catalog must remain unchanged")
  assert.throws(() => reauditDnaV2CatalogForTest({
    claims: DNA_CHAT_CATALOG_CLAIMS,
    relations: DNA_CHAT_CATALOG_RELATIONS,
    topics: DNA_CHAT_CATALOG_TOPICS,
    sources: DNA_CHAT_CATALOG_SOURCES,
    realPassageBindings: [],
  }), /dna_v2_reaudit_test_bindings_forbidden/)
  const previousReauditFixtureEnvironment = process.env.DNA_V2_REAUDIT_TEST_FIXTURE
  process.env.DNA_V2_REAUDIT_TEST_FIXTURE = "1"
  assert.equal(reauditDnaV2CatalogForTest({
    claims: DNA_CHAT_CATALOG_CLAIMS,
    relations: DNA_CHAT_CATALOG_RELATIONS,
    topics: DNA_CHAT_CATALOG_TOPICS,
    sources: DNA_CHAT_CATALOG_SOURCES,
    realPassageBindings: [],
  }).snapshotSha256, DNA_CURRENT_V2_CATALOG_REAUDIT.snapshotSha256)
  if (previousReauditFixtureEnvironment === undefined) {
    Reflect.deleteProperty(process.env, "DNA_V2_REAUDIT_TEST_FIXTURE")
  } else {
    process.env.DNA_V2_REAUDIT_TEST_FIXTURE = previousReauditFixtureEnvironment
  }

  const compiled = emptyPackage()
  assert.equal(compiled.manifest.counts.excluded.legacyV2Claims, 239)
  assert.equal(compiled.manifest.counts.excluded.missingRealPassage, 239)
  assert.equal(compiled.manifest.counts.included.claims, 0)
  assert.equal(compiled.manifest.releaseRegistryCount, 0)
  assert.equal(compiled.manifest.runtimeEligible, false)
  assert.equal(validateDnaV3EvidenceGraph(compiled).counts.edges, 0)
  for (let index = 0; index < 20; index += 1) {
    assert.equal(emptyPackage().manifest.packageSha256, compiled.manifest.packageSha256)
    assert.equal(
      emptyPackage().manifest.inputManifestSha256,
      compiled.manifest.inputManifestSha256,
    )
  }

  const previousFixtureEnvironment = process.env.DNA_V3_STATIC_PACKAGE_TEST_FIXTURE
  const previousNodeEnvironment = process.env.NODE_ENV
  process.env.DNA_V3_STATIC_PACKAGE_TEST_FIXTURE = "1"
  const synthetic = syntheticPackage()
  const permittedSynthetic = syntheticPackage("cc_by")
  const pmidSynthetic = syntheticPackage("cc_by", { doi: null, pmid: "12345678" })
  const pmcidSynthetic = syntheticPackage("cc_by", {
    doi: null,
    pmid: "12345678",
    pmcid: "PMC1234567",
  })
  const canonicalUrlSynthetic = syntheticPackage("cc_by", {
    officialUrl: "https://evidence.example.org/reviews/synthetic-source",
  })
  const productSynthetic = syntheticPackage("all_rights_reserved", {
    doi: null,
    pmid: null,
    pmcid: null,
    officialUrl: "https://dna.example.org/books/owner-approved/chapter-1",
    studyDesign: "textbook",
    dnaRelation: "product_definition",
    claimAuthority: "dna_product_information",
  })
  const externalProductSemanticSynthetic = syntheticPackage("cc_by", {
    dnaRelation: "product_definition",
  })
  const restrictedSynthetic = syntheticPackage("all_rights_reserved")
  const twoPassageSynthetic = syntheticTwoPassagePackage(permittedSynthetic)
  assert.throws(() => syntheticPackage("cc_by", { studyDesign: "not_assessed" }),
    /dna_v3_graph_source_study_design_not_audited/)
  assert.throws(() => syntheticPackage("cc_by", {
    doi: null, pmid: null, pmcid: null, officialUrl: null,
  }), /dna_v3_graph_source_public_identity_missing/)
  assert.throws(() => syntheticPackage("cc_by", {
    officialUrl: "https://evidence.example.org/source?unreviewed=1",
  }), /dna_v3_graph_source_official_url_invalid/)
  assert.throws(() => syntheticPackage("cc_by", {
    claimAuthority: "external_scientific_information",
    releaseAuthority: "dna_product_information",
  }), /dna_v3_static_claim_authority_mismatch/)
  assert.throws(() => compileDnaV3StaticPackage({
    reaudit: DNA_CURRENT_V2_CATALOG_REAUDIT,
    sources: synthetic.sources,
    passages: synthetic.passages,
    claims: synthetic.claims,
    relations: synthetic.relations,
    claimPassageLinks: synthetic.claimPassageLinks,
    lexicalIndex: synthetic.lexicalIndex,
  }), /dna_v3_static_claim_(?:set_not_exactly_authorized|not_in_audited_release_registry)/)
  Reflect.set(process.env, "NODE_ENV", "production")
  assert.throws(() => syntheticPackage(), /dna_v3_static_test_release_registry_forbidden/)
  if (previousNodeEnvironment === undefined) Reflect.deleteProperty(process.env, "NODE_ENV")
  else Reflect.set(process.env, "NODE_ENV", previousNodeEnvironment)
  if (previousFixtureEnvironment === undefined) {
    delete process.env.DNA_V3_STATIC_PACKAGE_TEST_FIXTURE
  } else {
    process.env.DNA_V3_STATIC_PACKAGE_TEST_FIXTURE = previousFixtureEnvironment
  }
  assert.equal(validateDnaV3StaticPackage(synthetic).manifest.runtimeEligible, true)
  assert.throws(() => validateDnaV3StaticPackage({
    ...synthetic,
    claims: [{ ...synthetic.claims[0], anamnesis: "forbidden-extra-field" }],
  } as unknown as DnaV3StaticPackage), /dna_v3_static_claim_unknown_field/)
  assert.equal(validateDnaV3EvidenceGraph(synthetic).counts.edges, 8)
  assert.equal(getDnaV3DirectOneHopRelations(synthetic.relations, "topic.synthetic.a").length, 1)

  validateDnaV3StaticPackage(permittedSynthetic)
  const adapted = adaptDnaV3StaticPackageForRetrieval(permittedSynthetic)
  assert.equal(adapted.claims.length, 2, "Aynı iddianın iki açık topic bağlantısı korunmalı")
  assert.deepEqual(adapted.claims.map((claim) => claim.topicId), [
    "topic.synthetic.a",
    "topic.synthetic.b",
  ])
  assert.ok(adapted.claims.every((claim) => claim.sourceClaimId === "claim.synthetic"))
  assert.ok(adapted.claims.every((claim) => claim.claimType === "relation"))
  assert.equal(adapted.sources[0]?.sourceType, "systematic_review_meta_analysis")
  assert.equal(adaptDnaV3StaticPackageForRetrieval(pmidSynthetic).sources[0]?.officialUrl,
    "https://pubmed.ncbi.nlm.nih.gov/12345678/")
  assert.equal(adaptDnaV3StaticPackageForRetrieval(pmcidSynthetic).sources[0]?.officialUrl,
    "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1234567/")
  assert.equal(adaptDnaV3StaticPackageForRetrieval(canonicalUrlSynthetic).sources[0]?.officialUrl,
    "https://evidence.example.org/reviews/synthetic-source",
    "Hash-bound kanonik URL, DOI fallback'ından önce gelmeli")
  const adaptedProduct = adaptDnaV3StaticPackageForRetrieval(productSynthetic)
  assert.equal(adaptedProduct.sources[0]?.officialUrl,
    "https://dna.example.org/books/owner-approved/chapter-1")
  assert.equal(adaptedProduct.sources[0]?.licenseStatus, "not_applicable")
  assert.equal(adaptedProduct.sources[0]?.releaseStatus, "owner_approved")
  assert.ok(adaptedProduct.claims.every((claim) =>
    claim.authority === "dna_product_information" && claim.releaseStatus === "owner_approved"))
  assert.equal(createDnaV3ScientificUnit({
    claim: adaptedProduct.claims[0]!,
    text: adaptedProduct.claims[0]!.summaryTr,
  }).authority, "dna_product")
  const productAnswer = resolveDnaV3Retrieval({
    question: "Synthetic A ile Synthetic B ilişkisi nedir?",
  }, adaptedProduct)
  assert.equal(productAnswer.status, "answer")
  assert.equal(productAnswer.sources[0]?.officialUrl,
    "https://dna.example.org/books/owner-approved/chapter-1")
  const adaptedExternalProductSemantic = adaptDnaV3StaticPackageForRetrieval(
    externalProductSemanticSynthetic,
  )
  assert.equal(createDnaV3ScientificUnit({
    claim: adaptedExternalProductSemantic.claims[0]!,
    text: adaptedExternalProductSemantic.claims[0]!.summaryTr,
  }).authority, "external_science",
  "dnaRelation=product_definition tek başına ürün otoritesi üretememeli")
  assert.equal(adapted.passages[0]?.ageScope, "adult")
  assert.equal(adapted.passages[0]?.population, "human")
  assert.deepEqual(adapted.claimPassageLinks.map((link) => link.claimId), ["claim.synthetic"])
  assert.ok(adapted.lexicalIndex.every((entry) => entry.summaryTokens.includes("synthetic")))
  const syntheticRelationQuestion = "Synthetic A ile Synthetic B ilişkisi nedir?"
  assert.equal(resolveDnaV3Retrieval({ question: syntheticRelationQuestion }, adapted).status, "answer",
    "validate → adapt → resolve zinciri çalışmalı")
  validateDnaV3StaticPackage(twoPassageSynthetic)
  assert.equal(twoPassageSynthetic.claims.length, 1)
  assert.equal(twoPassageSynthetic.manifest.releaseRegistryCount, 2)
  const twoPassageAdapted = adaptDnaV3StaticPackageForRetrieval(twoPassageSynthetic)
  assert.equal(resolveDnaV3Retrieval({ question: syntheticRelationQuestion }, twoPassageAdapted).sources.length, 2)
  validateDnaV3StaticPackage(restrictedSynthetic)
  const restricted = adaptDnaV3StaticPackageForRetrieval(restrictedSynthetic)
  assert.equal(restricted.sources.length, 0)
  assert.equal(restricted.claims.length, 0)
  assert.equal(restricted.passages.length, 0)
  assert.equal(getDnaV3DirectOneHopRelations(synthetic.relations, "topic.synthetic.unknown").length, 0)

  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    sources: [{
      ...synthetic.sources[0],
      officialUrl: "https://tampered.example.org/source",
    }],
  }), /dna_v3_graph_source_content_hash_mismatch/)
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    claims: [{
      ...synthetic.claims[0],
      authority: "dna_product_information",
    }],
  }), /dna_v3_graph_claim_content_hash_mismatch/)
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    claims: [{
      ...synthetic.claims[0],
      text: "Tampered claim text with a stale node hash.",
    }],
  }), /dna_v3_graph_claim_content_hash_mismatch/)
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    passages: [{
      ...synthetic.passages[0],
      approvedTurkishText: "Eski özet değeriyle uyuşmayan değiştirilmiş Türkçe pasaj.",
    }],
  }), /dna_v3_graph_passage_content_hash_mismatch/)
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    relations: [{
      ...synthetic.relations[0],
      summary: "Tampered relation summary with a stale node hash.",
    }],
  }), /dna_v3_graph_relation_content_hash_mismatch/)
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    lexicalIndex: {
      ...synthetic.lexicalIndex,
      entries: [{
        ...synthetic.lexicalIndex.entries[0],
        title: "Tampered lexical title",
      }, synthetic.lexicalIndex.entries[1]],
    },
  }), /dna_v3_graph_topic_content_hash_mismatch/)

  const invalidRelationWithStaleHash = {
    ...synthetic.relations[0],
    directEvidenceLinkIds: ["link.from.unrelated.endpoint"],
  } as DnaV3StaticRelation
  const invalidRelation = {
    ...invalidRelationWithStaleHash,
    sha256: dnaV3RelationNodeSha256(invalidRelationWithStaleHash),
  } as DnaV3StaticRelation
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    relations: [invalidRelation],
  }), /dna_v3_graph_relation_cannot_combine_endpoint_sources/)
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    passages: [{
      ...synthetic.passages[0],
      text: "/Volumes/ResearchSSD/raw/source.xml",
    }],
  }), /dna_v3_static_forbidden_absolute_path/)
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    passages: [{
      ...synthetic.passages[0],
      text: "<?xml version=\"1.0\"?><article>raw</article>",
    }],
  }), /dna_v3_static_forbidden_raw_pdf_or_xml/)
  const invalidHopRelationWithStaleHash = {
    ...synthetic.relations[0],
    maxHops: 2,
  } as unknown as DnaV3StaticRelation
  const invalidHopRelation = {
    ...invalidHopRelationWithStaleHash,
    sha256: dnaV3RelationNodeSha256(invalidHopRelationWithStaleHash),
  } as DnaV3StaticRelation
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    relations: [invalidHopRelation],
  }), /dna_v3_graph_relation_must_be_one_hop/)
  assert.throws(() => validateDnaV3EvidenceGraph({
    ...synthetic,
    relations: [{
      ...synthetic.relations[0],
      claimToRelationEvidence: {
        ...synthetic.relations[0].claimToRelationEvidence,
        supportRecordSha256: "f".repeat(64),
      },
    }],
  }), /dna_v3_graph_edge_evidence_parent_mismatch/)

  if (process.env.DNA_WRITE_V3_PHASE_28_30 === "1") await writePackage(compiled)
  const checked = await readCheckedPackage()
  assert.deepEqual(checked, compiled, "Generated V3 package files are stale")
  validateCurrentDnaV3StaticPackage(checked)
  const forgedLoaderExport = {
    manifest: checked.manifest,
    sources: permittedSynthetic.sources,
    passages: permittedSynthetic.passages,
    claims: permittedSynthetic.claims,
    relations: permittedSynthetic.relations,
    claimPassageLinks: permittedSynthetic.claimPassageLinks,
    lexicalIndex: permittedSynthetic.lexicalIndex,
  } as DnaV3StaticPackage
  assert.equal(
    validateDnaV3EvidenceGraph(forgedLoaderExport).counts.claims,
    permittedSynthetic.claims.length,
    "Forge içeriği kendi node/edge hash'leriyle tutarlı olmalı; ret eski manifeste dayanmalı",
  )
  assert.throws(
    () => validateCurrentDnaV3StaticPackage(forgedLoaderExport),
    /dna_v3_static_component_hash_mismatch/,
    "Eski manifest/hash ile değiştirilmiş claim ve passage sunan loader export'u reddedilmeli",
  )

  const checkedSnapshot = JSON.parse(await fs.readFile(SNAPSHOT, "utf8")) as unknown
  assert.deepEqual(
    checkedSnapshot,
    DNA_CURRENT_V2_CATALOG_REAUDIT,
    "V2 re-audit snapshot is stale",
  )
  await assertServerBoundary()

  console.log(JSON.stringify({
    ok: true,
    phases: [28, 29, 30],
    v2ClaimsAudited: DNA_CURRENT_V2_CATALOG_REAUDIT.counts.auditedClaims,
    v3ReleaseEligibleLegacyClaims:
      DNA_CURRENT_V2_CATALOG_REAUDIT.counts.releaseEligibleClaims,
    v3QuarantinedLegacyClaims:
      DNA_CURRENT_V2_CATALOG_REAUDIT.counts.quarantinedClaims,
    legacySources: DNA_CURRENT_V2_CATALOG_REAUDIT.sourceAudit,
    packageIncluded: compiled.manifest.counts.included,
    packageSha256: compiled.manifest.packageSha256,
    inputManifestSha256: compiled.manifest.inputManifestSha256,
    graphEdges: 0,
    maxRelationHops: 1,
    clientBundleImports: 0,
    rawPdfXmlInPackage: 0,
    absolutePathsInPackage: 0,
    limitation: "No real passage or claim has completed V3 release gates; package is intentionally empty.",
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
