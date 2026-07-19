import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { DNA_CHAT_CATALOG_CLAIMS, DNA_CHAT_CATALOG_SOURCES } from "../src/lib/dna/chat/catalog"
import {
  DNA_COVERAGE_CELLS,
  DNA_COVERAGE_DIMENSIONS,
  DNA_COVERAGE_MAP,
  DNA_COVERAGE_STATUSES,
  DNA_SCIENCE_DOMAINS,
  isCoverageCellReleaseReady,
} from "../src/lib/dna/chat/governance/coverageMap"
import {
  DNA_GAP_PROTOCOL_CUTOFF_DATE,
  DNA_GAP_SEARCH_PROTOCOLS,
  DNA_PRISMA_REPRODUCIBILITY_BOUNDARY_TR,
  getCoverageGapCellIds,
  getUnlinkedCoverageGapCellIds,
} from "../src/lib/dna/chat/governance/gapProtocols"

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function sha256Raw(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function assertUnique(values: readonly string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label} benzersiz olmalı`)
}

const artifact = JSON.parse(readFileSync(resolve(
  process.cwd(),
  "docs/dna-intelligence/governance/v3/coverage-gap-contract.json",
), "utf8")) as Record<string, unknown>

type FrozenGapSnapshot = {
  version: string
  runId: string
  frozenForDate: string
  executionStatus:
    | "identification_and_title_abstract_screening_executed_full_text_pending"
    | "partial_api_execution_full_text_pending"
    | "failed_no_screening"
  protocolSetSha256: string
  apiDownloadCapPerProtocolPerApi: number
  apiCapBoundary: string
  publicApis: string[]
  storagePolicy: "research_ssd_required_no_local_fallback"
  rawRootRelative: string
  rawManifest: Array<{ relativePath: string; bytes: number; sha256: string }>
  rawArtifactManifestSha256: string
  protocolExecutions: Array<{
    protocolId: string
    domainId: string
    protocolDefinitionSha256: string
    executionStatus:
      | "identification_and_title_abstract_screening_executed_full_text_pending"
      | "partial_api_execution_full_text_pending"
      | "failed_no_screening"
    apiExecutions: Array<{
      api: "PubMed" | "Crossref" | "OpenAlex"
      query: string
      querySha256: string
      endpoint: string
      status: "success" | "partial" | "failed"
      http: Array<{
        method: "GET"
        url: string
        status: number | null
        ok: boolean
        attempts: Array<{ status: number | null; ok: boolean; error: string | null }>
        responseSha256: string
        responseBytes: number
        rawRelativePath: string
        error: string | null
      }>
      identifiedReported: number | null
      downloadCap: number
      downloadedMetadata: number
      truncatedByCap: boolean | null
      metadataSha256: string
      error: string | null
    }>
    counts: {
      identifiedReportedAcrossApisNonDeduplicated: number
      identifiedCountCompleteAcrossAllApis: boolean
      downloadedMetadata: number
      deduplicatedMetadata: number
      duplicatesRemoved: number
      titleAbstractScreened: number
      titleAbstractExcluded: number
      advancedToManualFullTextReview: number
      fullTextAssessed: null
      includedInEvidenceBase: null
    }
    exclusionReasons: Record<string, number>
    dedupePolicy: string[]
    screeningPolicy: string
    releaseReadyClaims: number
    evidenceBaseInclusionPerformed: boolean
    ledgerHashes: Record<string, string>
  }>
  totals: {
    identifiedReportedAcrossApisNonDeduplicated: number
    downloadedMetadata: number
    deduplicatedMetadata: number
    duplicatesRemoved: number
    titleAbstractScreened: number
    titleAbstractExcluded: number
    advancedToManualFullTextReview: number
    fullTextAssessed: null
    includedInEvidenceBase: null
    releaseReadyClaims: number
  }
  boundaries: Record<string, boolean>
  snapshotPayloadSha256: string
}

const frozenSnapshot = JSON.parse(readFileSync(resolve(
  process.cwd(),
  "docs/dna-intelligence/governance/v3/gap-search-execution-2026-07-19.json",
), "utf8")) as FrozenGapSnapshot

assert.equal(DNA_COVERAGE_MAP.version, "dna-coverage-map@1")
assert.equal(DNA_SCIENCE_DOMAINS.length, 10, "Tam on kanonik bilim alanı olmalı")
assert.equal(DNA_COVERAGE_DIMENSIONS.length, 14, "Tam on dört kapsam boyutu olmalı")
assert.equal(DNA_COVERAGE_CELLS.length, 140, "10 x 14 matris tam 140 hücre olmalı")
assertUnique(DNA_SCIENCE_DOMAINS.map((entry) => entry.id), "Alan kimlikleri")
assertUnique(DNA_COVERAGE_DIMENSIONS.map((entry) => entry.id), "Boyut kimlikleri")
assertUnique(DNA_COVERAGE_CELLS.map((entry) => entry.id), "Hücre kimlikleri")

const sourceIds = new Set(DNA_CHAT_CATALOG_SOURCES.map((entry) => entry.id))
const claimIds = new Set(DNA_CHAT_CATALOG_CLAIMS.map((entry) => entry.id))
const expectedCellIds = new Set(
  DNA_SCIENCE_DOMAINS.flatMap((domain) =>
    DNA_COVERAGE_DIMENSIONS.map((dimension) => `${domain.id}.${dimension.id}`)),
)
assert.deepEqual(new Set(DNA_COVERAGE_CELLS.map((entry) => entry.id)), expectedCellIds)

const statusCounts = Object.fromEntries(
  DNA_COVERAGE_STATUSES.map((status) => [
    status,
    DNA_COVERAGE_CELLS.filter((cell) => cell.status === status).length,
  ]),
) as Record<(typeof DNA_COVERAGE_STATUSES)[number], number>

assert.deepEqual(statusCounts, {
  release_ready: 0,
  bounded_partial: 120,
  not_available: 10,
  prohibited: 10,
})
assert.equal(Object.values(statusCounts).reduce((sum, count) => sum + count, 0), 140)

for (const cell of DNA_COVERAGE_CELLS) {
  assert.ok(DNA_COVERAGE_STATUSES.includes(cell.status), `${cell.id}: kontrollü durum`)
  assert.ok(cell.safeQuestionFamilies.length >= 2, `${cell.id}: güvenli soru aileleri`)
  assert.ok(cell.safeQuestionFamilies.every((question) => question.endsWith("?")), `${cell.id}: soru biçimi`)
  assert.ok(cell.boundaryTr.length >= 80, `${cell.id}: açık iddia sınırı`)
  assert.ok(cell.ageScope, `${cell.id}: yaş kapsamı`)
  assert.ok(cell.candidateSourceIds.length >= 2, `${cell.id}: aday kaynak görünürlüğü`)
  for (const sourceId of cell.candidateSourceIds) {
    assert.ok(sourceIds.has(sourceId), `${cell.id}: bilinmeyen aday kaynak ${sourceId}`)
  }
  assert.equal(cell.testCoverage.contractTestIds.length, 1, `${cell.id}: tek kararlı test kimliği`)
  assert.equal(cell.testCoverage.requiredOutcomes.length, 1, `${cell.id}: beklenen güvenli sonuç`)

  if (cell.status === "release_ready") {
    assert.ok(cell.releaseEvidence.claimIds.length > 0, `${cell.id}: released claim zorunlu`)
    assert.ok(cell.releaseEvidence.sourceIds.length > 0, `${cell.id}: released source zorunlu`)
    for (const claimId of cell.releaseEvidence.claimIds) assert.ok(claimIds.has(claimId))
    for (const sourceId of cell.releaseEvidence.sourceIds) assert.ok(sourceIds.has(sourceId))
    assert.equal(isCoverageCellReleaseReady(cell), true)
  } else {
    assert.equal(isCoverageCellReleaseReady(cell), false)
  }
}
assert.equal(
  DNA_COVERAGE_CELLS.some((cell) =>
    cell.status === "release_ready" &&
    (cell.releaseEvidence.claimIds.length === 0 || cell.releaseEvidence.sourceIds.length === 0)),
  false,
  "İddia ve kaynak release kanıtı olmadan release_ready olamaz",
)

assert.equal(DNA_GAP_SEARCH_PROTOCOLS.length, 10, "On isimli boşluk için protokol bulunmalı")
assertUnique(DNA_GAP_SEARCH_PROTOCOLS.map((entry) => entry.id), "Boşluk protokol kimlikleri")
assert.deepEqual(
  new Set(DNA_GAP_SEARCH_PROTOCOLS.map((entry) => entry.domainId)),
  new Set(DNA_SCIENCE_DOMAINS.map((entry) => entry.id)),
  "Her bilim alanı bir boşluk protokolüyle temsil edilmeli",
)

const requiredNamedGapTokens = [
  "ion_plasticity_glia_neuromodulators",
  "brainstem_thalamus_basal_ganglia_cerebellum",
  "central_network_baroreflex_respiration_posture",
  "hpa_sam_child_adolescent_development",
  "vestibular_proprioceptive_tactile_auditory_modulation",
  "developmental_cultural_boundaries",
  "task_impurity",
  "pediatric_circadian_development",
  "conditions_adult_neurodiversity",
  "dna_psychometrics_individual_uncertainty",
]
for (const token of requiredNamedGapTokens) {
  assert.ok(DNA_GAP_SEARCH_PROTOCOLS.some((entry) => entry.id.includes(token)), `Eksik örnek boşluk: ${token}`)
}

const gapCellIds = getCoverageGapCellIds()
const allLinkedCellIds = DNA_GAP_SEARCH_PROTOCOLS.flatMap((entry) => entry.linkedCellIds)
assert.equal(getUnlinkedCoverageGapCellIds().length, 0, "Her partial/not_available hücre protokole bağlı olmalı")
assertUnique(allLinkedCellIds, "Protokoller arası hücre bağlantıları")
assert.deepEqual(new Set(allLinkedCellIds), new Set(gapCellIds), "Boşluk hücresi bölümü eksiksiz olmalı")

for (const protocol of DNA_GAP_SEARCH_PROTOCOLS) {
  assert.ok(protocol.linkedCellIds.length > 0, `${protocol.id}: bağlantılı boşluk hücresi`)
  assert.ok(protocol.researchQuestionTr.endsWith("?"), `${protocol.id}: araştırma sorusu`)
  assert.ok(protocol.inclusionCriteriaTr.length >= 3, `${protocol.id}: dahil etme ölçütleri`)
  assert.ok(protocol.exclusionCriteriaTr.length >= 3, `${protocol.id}: dışlama ölçütleri`)
  assert.ok(protocol.ageScopeTr, `${protocol.id}: yaş grubu`)
  assert.ok(protocol.studyTypesTr.length >= 3, `${protocol.id}: çalışma türleri`)
  assert.equal(protocol.cutoffDate, DNA_GAP_PROTOCOL_CUTOFF_DATE)
  assert.ok(protocol.databases.length >= 3, `${protocol.id}: veri tabanları`)
  assert.equal(protocol.exactQueries.length, protocol.databases.length, `${protocol.id}: her veri tabanı için tam sorgu`)
  assert.deepEqual(
    new Set(protocol.exactQueries.map((entry) => entry.database)),
    new Set(protocol.databases),
    `${protocol.id}: sorgu/veri tabanı kapanışı`,
  )
  assert.ok(protocol.exactQueries.every((entry) => entry.query.length >= 50), `${protocol.id}: tam arama ifadesi`)
  assert.equal(protocol.prismaBoundaryTr, DNA_PRISMA_REPRODUCIBILITY_BOUNDARY_TR)

  for (const cellId of protocol.linkedCellIds) {
    const cell = DNA_COVERAGE_CELLS.find((entry) => entry.id === cellId)
    assert.ok(cell, `${protocol.id}: bilinmeyen hücre ${cellId}`)
    assert.equal(cell?.domainId, protocol.domainId, `${protocol.id}: alan dışı hücre`)
    assert.ok(cell?.status === "bounded_partial" || cell?.status === "not_available")
  }

  if (protocol.execution.state === "planned") {
    assert.equal(protocol.execution.run, null)
    assert.equal(protocol.execution.counts, null)
    assert.equal(protocol.execution.exclusionCounts, null)
  } else {
    assert.match(protocol.execution.run.protocolSha256, /^[a-f0-9]{64}$/)
    assert.match(protocol.execution.run.rawResultLedgerSha256, /^[a-f0-9]{64}$/)
    assert.match(protocol.execution.run.screeningLedgerSha256, /^[a-f0-9]{64}$/)
    assert.ok(protocol.execution.counts.identified >= protocol.execution.counts.deduplicated)
    assert.ok(protocol.execution.counts.screened >= protocol.execution.counts.fullTextAssessed)
    assert.ok(protocol.execution.counts.fullTextAssessed >= protocol.execution.counts.included)
  }
}

assert.ok(DNA_GAP_SEARCH_PROTOCOLS.every((entry) => entry.execution.state === "planned"))
assert.match(DNA_PRISMA_REPRODUCIBILITY_BOUNDARY_TR, /yeniden üretilebilir/)
assert.match(DNA_PRISMA_REPRODUCIBILITY_BOUNDARY_TR, /sertifikası değildir/)

assert.equal(frozenSnapshot.version, "dna-gap-search-execution@1")
assert.equal(frozenSnapshot.frozenForDate, DNA_GAP_PROTOCOL_CUTOFF_DATE)
assert.equal(
  frozenSnapshot.executionStatus,
  "identification_and_title_abstract_screening_executed_full_text_pending",
)
assert.match(frozenSnapshot.runId, /^dna-gap-search-20260719-[a-f0-9]{12}-\d{17}$/)
assert.equal(frozenSnapshot.apiDownloadCapPerProtocolPerApi, 100)
assert.match(frozenSnapshot.apiCapBoundary, /first 100 metadata records/)
assert.match(frozenSnapshot.apiCapBoundary, /only to downloaded metadata/)
assert.deepEqual(
  new Set(frozenSnapshot.publicApis),
  new Set(["NCBI PubMed E-utilities", "Crossref REST API", "OpenAlex REST API"]),
)
assert.doesNotMatch(JSON.stringify(frozenSnapshot), /PsycINFO/)
assert.equal(
  frozenSnapshot.protocolSetSha256,
  sha256Raw(JSON.stringify(DNA_GAP_SEARCH_PROTOCOLS)),
  "Çalıştırılan protokol seti mevcut kanonik protokolle aynı olmalı",
)
assert.equal(frozenSnapshot.protocolExecutions.length, 10)

const expectedProtocolsById = new Map(DNA_GAP_SEARCH_PROTOCOLS.map((entry) => [entry.id, entry]))
for (const execution of frozenSnapshot.protocolExecutions) {
  const protocol = expectedProtocolsById.get(execution.protocolId)
  assert.ok(protocol, `${execution.protocolId}: dondurulmuş koşuda bilinmeyen protokol`)
  assert.equal(execution.domainId, protocol?.domainId)
  assert.equal(execution.protocolDefinitionSha256, sha256Raw(JSON.stringify(protocol)))
  assert.equal(
    execution.executionStatus,
    "identification_and_title_abstract_screening_executed_full_text_pending",
  )
  assert.equal(execution.apiExecutions.length, 3)
  assert.deepEqual(
    new Set(execution.apiExecutions.map((entry) => entry.api)),
    new Set(["PubMed", "Crossref", "OpenAlex"]),
  )

  const exactQueries = new Map(protocol?.exactQueries.map((entry) => [entry.database, entry.query]))
  for (const apiExecution of execution.apiExecutions) {
    assert.equal(apiExecution.query, exactQueries.get(apiExecution.api), `${execution.protocolId}:${apiExecution.api}: exact query`)
    assert.equal(apiExecution.querySha256, sha256Raw(apiExecution.query))
    assert.equal(apiExecution.status, "success")
    assert.equal(apiExecution.downloadCap, 100)
    assert.ok(apiExecution.identifiedReported !== null && apiExecution.identifiedReported >= apiExecution.downloadedMetadata)
    assert.ok(apiExecution.downloadedMetadata >= 0 && apiExecution.downloadedMetadata <= 100)
    assert.equal(apiExecution.error, null)
    assert.ok(apiExecution.http.length >= 1)
    for (const http of apiExecution.http) {
      assert.equal(http.method, "GET")
      assert.equal(http.status, 200)
      assert.equal(http.ok, true)
      assert.equal(http.error, null)
      assert.match(http.url, /^https:\/\//)
      assert.match(http.responseSha256, /^[a-f0-9]{64}$/)
      assert.ok(http.responseBytes > 0)
      assert.ok(frozenSnapshot.rawManifest.some((entry) =>
        entry.relativePath === http.rawRelativePath &&
        entry.sha256 === http.responseSha256 &&
        entry.bytes === http.responseBytes))
      assert.ok(http.attempts.length >= 1)
      assert.equal(http.attempts.at(-1)?.status, 200)
      assert.equal(http.attempts.at(-1)?.ok, true)
    }
  }

  const counts = execution.counts
  assert.equal(counts.downloadedMetadata - counts.deduplicatedMetadata, counts.duplicatesRemoved)
  assert.equal(counts.titleAbstractScreened, counts.deduplicatedMetadata)
  assert.equal(counts.titleAbstractExcluded + counts.advancedToManualFullTextReview, counts.titleAbstractScreened)
  assert.equal(
    Object.values(execution.exclusionReasons).reduce((sum, count) => sum + count, 0),
    counts.titleAbstractExcluded,
  )
  assert.equal(counts.fullTextAssessed, null)
  assert.equal(counts.includedInEvidenceBase, null)
  assert.equal(execution.evidenceBaseInclusionPerformed, false)
  assert.equal(execution.releaseReadyClaims, 0)
  assert.deepEqual(execution.dedupePolicy, ["canonical DOI", "PMID", "normalized title plus year"])
  assert.equal(execution.screeningPolicy, "deterministic_title_abstract_only")
  assert.ok(Object.values(execution.ledgerHashes).every((hash) => /^[a-f0-9]{64}$/.test(hash)))
}

const summedFrozenCounts = frozenSnapshot.protocolExecutions.reduce((sum, entry) => ({
  identifiedReportedAcrossApisNonDeduplicated:
    sum.identifiedReportedAcrossApisNonDeduplicated + entry.counts.identifiedReportedAcrossApisNonDeduplicated,
  downloadedMetadata: sum.downloadedMetadata + entry.counts.downloadedMetadata,
  deduplicatedMetadata: sum.deduplicatedMetadata + entry.counts.deduplicatedMetadata,
  duplicatesRemoved: sum.duplicatesRemoved + entry.counts.duplicatesRemoved,
  titleAbstractScreened: sum.titleAbstractScreened + entry.counts.titleAbstractScreened,
  titleAbstractExcluded: sum.titleAbstractExcluded + entry.counts.titleAbstractExcluded,
  advancedToManualFullTextReview: sum.advancedToManualFullTextReview + entry.counts.advancedToManualFullTextReview,
}), {
  identifiedReportedAcrossApisNonDeduplicated: 0,
  downloadedMetadata: 0,
  deduplicatedMetadata: 0,
  duplicatesRemoved: 0,
  titleAbstractScreened: 0,
  titleAbstractExcluded: 0,
  advancedToManualFullTextReview: 0,
})
assert.deepEqual(
  frozenSnapshot.totals,
  { ...summedFrozenCounts, fullTextAssessed: null, includedInEvidenceBase: null, releaseReadyClaims: 0 },
)
assert.ok(frozenSnapshot.totals.identifiedReportedAcrossApisNonDeduplicated > frozenSnapshot.totals.downloadedMetadata)
assert.equal(frozenSnapshot.totals.fullTextAssessed, null)
assert.equal(frozenSnapshot.totals.includedInEvidenceBase, null)
assert.equal(frozenSnapshot.totals.releaseReadyClaims, 0)
assert.ok(Object.values(frozenSnapshot.boundaries).every(Boolean))

assert.equal(frozenSnapshot.storagePolicy, "research_ssd_required_no_local_fallback")
assert.match(frozenSnapshot.rawRootRelative, /^Datasets\/DNA-Intelligence\//)
assert.ok(!frozenSnapshot.rawRootRelative.startsWith("/") && !frozenSnapshot.rawRootRelative.includes(".."))
assert.doesNotMatch(JSON.stringify(frozenSnapshot), /\/Volumes\//)
assert.equal(frozenSnapshot.rawManifest.length, 100)
assertUnique(frozenSnapshot.rawManifest.map((entry) => entry.relativePath), "Ham artefakt yolları")
assert.ok(frozenSnapshot.rawManifest.every((entry) =>
  entry.bytes > 0 &&
  /^[a-f0-9]{64}$/.test(entry.sha256) &&
  !entry.relativePath.startsWith("/") &&
  !entry.relativePath.includes("..")))
const sortedRawManifest = [...frozenSnapshot.rawManifest].sort((left, right) =>
  left.relativePath.localeCompare(right.relativePath))
assert.equal(
  frozenSnapshot.rawArtifactManifestSha256,
  sha256Raw(JSON.stringify(sortedRawManifest)),
  "Ham manifest hash'i",
)
const { snapshotPayloadSha256, ...snapshotPayload } = frozenSnapshot
assert.equal(snapshotPayloadSha256, sha256Raw(JSON.stringify(snapshotPayload)), "Dondurulmuş snapshot hash'i")

let rawEvidenceVerified = false
const researchSsdRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const resolvedRawRoot = join(researchSsdRoot, frozenSnapshot.rawRootRelative)
if (existsSync(resolvedRawRoot)) {
  for (const entry of frozenSnapshot.rawManifest) {
    const raw = readFileSync(join(resolvedRawRoot, entry.relativePath))
    assert.equal(raw.byteLength, entry.bytes, `${entry.relativePath}: SSD byte sayısı`)
    assert.equal(sha256Raw(raw), entry.sha256, `${entry.relativePath}: SSD SHA-256`)
  }
  rawEvidenceVerified = true
}

const firstHash = sha256({ coverage: DNA_COVERAGE_MAP, protocols: DNA_GAP_SEARCH_PROTOCOLS })
for (let index = 0; index < 20; index += 1) {
  assert.equal(sha256({ coverage: DNA_COVERAGE_MAP, protocols: DNA_GAP_SEARCH_PROTOCOLS }), firstHash)
}

assert.deepEqual(artifact, {
  version: "dna-coverage-gap-contract@1",
  coverageMapVersion: "dna-coverage-map@1",
  gapProtocolsVersion: "dna-gap-protocols@1",
  domainCount: 10,
  dimensionCount: 14,
  cellCount: 140,
  statusCounts,
  gapProtocolCount: 10,
  linkedGapCellCount: gapCellIds.length,
  unlinkedGapCellCount: 0,
  releaseReadyRule: "released_claim_and_source_pair_required",
  executionTemplateState: "planned",
  frozenExecutionSnapshot: "gap-search-execution-2026-07-19.json",
  frozenExecutionStatus: "identification_and_title_abstract_screening_executed_full_text_pending",
  apiDownloadCapPerProtocolPerApi: 100,
  resultAndExclusionCounts: frozenSnapshot.totals,
  cutoffDate: DNA_GAP_PROTOCOL_CUTOFF_DATE,
  prismaBoundary: DNA_PRISMA_REPRODUCIBILITY_BOUNDARY_TR,
})

console.log("DNA chat coverage/gap tests passed", JSON.stringify({
  domains: DNA_SCIENCE_DOMAINS.length,
  dimensions: DNA_COVERAGE_DIMENSIONS.length,
  cells: DNA_COVERAGE_CELLS.length,
  statusCounts,
  gapProtocols: DNA_GAP_SEARCH_PROTOCOLS.length,
  linkedGapCells: gapCellIds.length,
  unlinkedGapCells: getUnlinkedCoverageGapCellIds().length,
  executedSearches: DNA_GAP_SEARCH_PROTOCOLS.filter((entry) => entry.execution.state === "executed").length,
  frozenExecutedSearches: frozenSnapshot.protocolExecutions.filter((entry) =>
    entry.executionStatus === "identification_and_title_abstract_screening_executed_full_text_pending").length,
  rawEvidenceVerified,
  frozenTotals: frozenSnapshot.totals,
  deterministicSha256: firstHash,
}))
