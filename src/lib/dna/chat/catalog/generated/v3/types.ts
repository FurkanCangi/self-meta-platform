export const DNA_V3_STATIC_PACKAGE_VERSION = "dna-v3-static-package@1" as const
export const DNA_V3_STATIC_GRAPH_VERSION = "dna-v3-claim-passage-graph@1" as const

export const DNA_V3_RELEASE_STATUSES = Object.freeze([
  "owner_approved",
  "codex_audited_multi_pass",
  "contested",
  "quarantined",
  "release_eligible",
  "withdrawn",
] as const)

export type DnaV3ReleaseStatus = (typeof DNA_V3_RELEASE_STATUSES)[number]

export const DNA_V3_GRAPH_EVIDENCE_KINDS = Object.freeze([
  "source_artifact_identity",
  "artifact_passage_binding",
  "claim_passage_entailment",
  "direct_relation_support",
  "relation_topic_binding",
  "topic_answer_unit_composition",
] as const)

export type DnaV3GraphEvidenceKind =
  (typeof DNA_V3_GRAPH_EVIDENCE_KINDS)[number]

export type DnaV3GraphEdgeEvidence = Readonly<{
  evidenceId: string
  kind: DnaV3GraphEvidenceKind
  supportRecordId: string
  supportRecordSha256: string
  evidenceSha256: string
}>

export type DnaV3StaticArtifact = Readonly<{
  id: string
  sha256: string
  format: "jats_xml" | "epub_xml" | "structural_html" | "approved_pdf_range" | "ocr"
  sourceToArtifactEvidence: DnaV3GraphEdgeEvidence
}>

export type DnaV3StaticSource = Readonly<{
  id: string
  sha256: string
  title: string
  authors: readonly string[]
  year: number
  venue: string | null
  doi: string | null
  pmid: string | null
  pmcid: string | null
  isbn: string | null
  /** Canonical, reviewed landing page. Null when DOI/PMCID/PMID is authoritative. */
  officialUrl: string | null
  /** Multi-pass appraised design; never inferred from the title or venue. */
  studyDesign: string
  licensePolicy: string
  artifacts: readonly DnaV3StaticArtifact[]
}>

export type DnaV3StaticPassage = Readonly<{
  id: string
  sha256: string
  sourceId: string
  artifactId: string
  originalLanguage: string
  locator: string
  text: string
  approvedTurkishText: string
  ageScope: string
  population: string
  claimBoundary: string
  artifactToPassageEvidence: DnaV3GraphEdgeEvidence
}>

export type DnaV3StaticClaim = Readonly<{
  id: string
  sha256: string
  text: string
  detail: string
  claimType: string
  evidenceLevel: string
  ageScope: string
  population: string
  claimBoundary: string
  dnaRelation: string
  /** Copied from and hash-bound to the canonical release authorization. */
  authority: "dna_product_information" | "external_scientific_information"
  releaseStatus: "release_eligible" | "owner_approved"
  sourceIds: readonly string[]
  passageIds: readonly string[]
}>

export type DnaV3StaticClaimPassageLink = Readonly<{
  id: string
  sha256: string
  sourceId: string
  artifactId: string
  passageId: string
  claimId: string
  passageToClaimEvidence: DnaV3GraphEdgeEvidence
}>

export type DnaV3StaticRelation = Readonly<{
  id: string
  sha256: string
  claimId: string
  fromTopicId: string
  toTopicId: string
  predicate: string
  summary: string
  claimBoundary: string
  directEvidenceLinkIds: readonly string[]
  maxHops: 1
  claimToRelationEvidence: DnaV3GraphEdgeEvidence
}>

export type DnaV3StaticLexicalEntry = Readonly<{
  id: string
  topicId: string
  topicSha256: string
  answerUnitId: string
  answerUnitSha256: string
  title: string
  aliases: readonly string[]
  keywords: readonly string[]
  tokens: readonly string[]
  claimIds: readonly string[]
  relationIds: readonly string[]
  relationToTopicEvidence: readonly DnaV3GraphEdgeEvidence[]
  topicToAnswerUnitEvidence: DnaV3GraphEdgeEvidence
}>

export type DnaV3StaticLexicalIndex = Readonly<{
  schemaVersion: "dna-v3-lexical-index@1"
  entries: readonly DnaV3StaticLexicalEntry[]
}>

export type DnaV3StaticManifestCounts = Readonly<{
  included: Readonly<{
    sources: number
    artifacts: number
    passages: number
    claims: number
    relations: number
    claimPassageLinks: number
    lexicalEntries: number
    topics: number
    answerUnits: number
  }>
  excluded: Readonly<{
    legacyV2Claims: number
    missingRealPassage: number
    legacyExpertPending: number
    orphanLegacySources: number
  }>
}>

export type DnaV3StaticManifest = Readonly<{
  schemaVersion: typeof DNA_V3_STATIC_PACKAGE_VERSION
  graphVersion: typeof DNA_V3_STATIC_GRAPH_VERSION
  generatedAt: string
  sourceCutoffDate: string
  inputManifestSha256: string
  releasePackageInputSha256: string
  releaseAuthorizationSetSha256: string
  packageSha256: string
  counts: DnaV3StaticManifestCounts
  fileSha256: Readonly<{
    sources: string
    passages: string
    claims: string
    relations: string
    claimPassageLinks: string
    lexicalIndex: string
  }>
  v2ReauditSnapshotSha256: string
  releaseRegistryCount: number
  runtimeEligible: boolean
}>

export type DnaV3StaticPackage = Readonly<{
  manifest: DnaV3StaticManifest
  sources: readonly DnaV3StaticSource[]
  passages: readonly DnaV3StaticPassage[]
  claims: readonly DnaV3StaticClaim[]
  relations: readonly DnaV3StaticRelation[]
  claimPassageLinks: readonly DnaV3StaticClaimPassageLink[]
  lexicalIndex: DnaV3StaticLexicalIndex
}>
