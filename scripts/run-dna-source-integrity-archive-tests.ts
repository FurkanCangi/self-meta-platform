import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import {
  evaluateDnaSourceIntegrity,
  inferDnaSourceUpdateDirection,
  normalizeDnaSourceUpdateType,
  resolveDnaAcquisitionArtifactWithinRoot,
  traverseDnaSourceIntegrityImpact,
  verifyDnaSourceAcquisitionLedger,
  type DnaSourceIntegrityInput,
  type DnaSourceIntegrityRecord,
} from "../src/lib/dna/chat/governance/sourceIntegrity"

const repoRoot = resolve(process.cwd())
const researchSsdRoot = process.env.RESEARCH_SSD_ROOT
assert.ok(researchSsdRoot, "RESEARCH_SSD_ROOT is required for the live archive test")
const sourceRoot = resolve(
  process.env.DNA_SOURCE_LIBRARY_ROOT
    || join(researchSsdRoot, "Datasets", "SelfMetaAI", "dna-knowledge", "source-library"),
)
const workRoot = join(researchSsdRoot, "Datasets", "SelfMetaAI", "dna-knowledge", "work")
const releaseRoot = join(researchSsdRoot, "Outputs", "SelfMetaAI", "dna-intelligence", "releases")
assert.ok(existsSync(sourceRoot), "source library must be mounted")
assert.ok(existsSync(workRoot), "work root must exist")
assert.ok(existsSync(releaseRoot), "release root must exist")

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"))
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const output: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name)
    if (entry.isDirectory()) output.push(...walkFiles(absolute))
    else if (entry.isFile()) output.push(absolute)
  }
  return output.sort()
}

function countBy<T>(values: readonly T[], key: (value: T) => string): Record<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(key(value), (counts.get(key(value)) || 0) + 1)
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

function baseInput(overrides: Partial<DnaSourceIntegrityInput> = {}): DnaSourceIntegrityInput {
  return {
    sourceId: "source.clean",
    checkedAt: "2026-07-19T12:00:00.000Z",
    publicationKind: "article",
    expected: {
      title: "A controlled neurophysiology study",
      doi: "10.1234/example.1",
      year: 2025,
      authors: ["Ada Example", "Bora Sample"],
      isbn: null,
      version: null,
      venue: "Clinical Neurophysiology",
      publisher: "Example Publisher",
    },
    observed: {
      title: "A controlled neurophysiology study",
      doi: "10.1234/example.1",
      year: 2025,
      authors: ["Ada Example", "Bora Sample"],
      isbn: null,
      version: null,
      venue: "Clin Neurophysiology",
      publisher: "Example Publisher Ltd",
    },
    authorityCoverage: {
      doiRegistrationAgency: "checked",
      doiMetadata: "checked",
      officialMetadata: "not_applicable",
      crossref: "checked",
      retractionWatch: "checked",
      crossmark: "checked",
      pubmed: "checked",
      europePmc: "checked",
    },
    updates: [],
    publicationTypes: ["Journal Article"],
    correctionResolution: "not_applicable",
    ...overrides,
  }
}

const updateVariants: ReadonlyArray<readonly [string, string, string]> = [
  ["Erratum in", "erratum", "updates_source"],
  ["Erratum for", "erratum", "source_updates_other"],
  ["Correction in", "correction", "updates_source"],
  ["Correction of", "correction", "source_updates_other"],
  ["Expression of concern in", "expression_of_concern", "updates_source"],
  ["Expression of concern for", "expression_of_concern", "source_updates_other"],
  ["Retraction in", "retraction", "updates_source"],
  ["Retraction of", "retraction", "source_updates_other"],
]
for (const [raw, expectedType, expectedDirection] of updateVariants) {
  assert.equal(normalizeDnaSourceUpdateType(raw), expectedType, `update type: ${raw}`)
  assert.equal(inferDnaSourceUpdateDirection(raw), expectedDirection, `update direction: ${raw}`)
}

const clean = evaluateDnaSourceIntegrity(baseInput())
assert.equal(clean.state, "verified_clean")
assert.equal(clean.runtimeEligibility, "eligible")

for (const publicationKind of ["article", "guideline"] as const) {
  const publisherNotLocallyAsserted = evaluateDnaSourceIntegrity(baseInput({
    sourceId: `source.${publicationKind}_without_asserted_publisher`,
    publicationKind,
    expected: { ...baseInput().expected, publisher: null },
  }))
  assert.equal(publisherNotLocallyAsserted.identityChecks.publisher, "not_applicable")
  assert.equal(publisherNotLocallyAsserted.state, "verified_clean")
}

const bookPublisherNotAsserted = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.book_without_asserted_publisher",
  publicationKind: "book",
  expected: { ...baseInput().expected, publisher: null },
}))
assert.equal(bookPublisherNotAsserted.identityChecks.publisher, "not_applicable")
assert.equal(bookPublisherNotAsserted.state, "verified_clean")

const publisherOnlyMismatch = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.publisher_pending",
  expected: { ...baseInput().expected, publisher: "Journal Name" },
}))
assert.equal(publisherOnlyMismatch.identityChecks.publisher, "mismatched")
assert.equal(publisherOnlyMismatch.state, "pending")
assert.ok(publisherOnlyMismatch.reasonCodes.includes("publisher_consistency_mismatch"))

const assertedPublisherMissingFromAuthority = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.asserted_publisher_missing",
  observed: { ...baseInput().observed, publisher: null },
}))
assert.equal(assertedPublisherMissingFromAuthority.identityChecks.publisher, "not_reported")
assert.equal(assertedPublisherMissingFromAuthority.state, "pending")
assert.ok(assertedPublisherMissingFromAuthority.reasonCodes.includes("bibliographic_identity_unverifiable"))

const criticalTitleMismatch = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.title_mismatch",
  observed: { ...baseInput().observed, title: "An unrelated publication" },
}))
assert.equal(criticalTitleMismatch.state, "quarantined")

const unverifiableAuthority = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.authority_pending",
  authorityCoverage: { ...baseInput().authorityCoverage, crossref: "unavailable" },
}))
assert.equal(unverifiableAuthority.state, "pending")

const retracted = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.retracted",
  updates: [{
    type: "retraction",
    authority: "crossref_retraction_watch",
    direction: "updates_source",
    noticeId: "10.1234/retraction.1",
    noticeUrl: "https://doi.org/10.1234/retraction.1",
    observedAt: "2026-07-19T00:00:00Z",
  }],
  priorHistory: [{
    state: "verified_clean",
    effectiveAt: "2026-07-18T00:00:00Z",
    reasonCodes: [],
  }],
}))
assert.equal(retracted.state, "withdrawn")
assert.equal(retracted.runtimeEligibility, "blocked_withdrawn")
assert.deepEqual(retracted.history.map((row) => row.state), ["verified_clean", "withdrawn"])

const stickyWithdrawal = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.retracted",
  priorHistory: retracted.history,
}))
assert.equal(stickyWithdrawal.state, "withdrawn")
assert.equal(stickyWithdrawal.runtimeEligibility, "blocked_withdrawn")
assert.ok(stickyWithdrawal.reasonCodes.includes("historical_withdrawal_sticky"))
const reinstated = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.retracted",
  updates: [{
    type: "reinstatement",
    authority: "crossref_publisher",
    direction: "updates_source",
    noticeId: "10.1234/reinstatement.1",
    noticeUrl: "https://doi.org/10.1234/reinstatement.1",
    observedAt: "2026-07-19T01:00:00Z",
  }],
  reinstatementReview: {
    status: "verified",
    reviewedAt: "2026-07-19T13:00:00Z",
    evidenceId: "manual-review/reinstatement.1",
  },
  priorHistory: retracted.history,
}))
assert.equal(reinstated.state, "verified_clean")
assert.equal(reinstated.runtimeEligibility, "eligible")

const pubmedRetracted = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.pubmed_retracted",
  publicationTypes: ["Journal Article", "Retracted Publication"],
}))
assert.equal(pubmedRetracted.state, "withdrawn")
const titleMarkedRetracted = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.title_marked_retracted",
  observed: { ...baseInput().observed, title: "RETRACTED: A controlled neurophysiology study" },
}))
assert.equal(titleMarkedRetracted.state, "withdrawn")

const retractionNotice = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.retraction_notice",
  updates: [{
    type: "retraction",
    authority: "crossref_publisher",
    direction: "source_updates_other",
    noticeId: "10.1234/original.1",
    noticeUrl: "https://doi.org/10.1234/original.1",
    observedAt: "2026-07-19T00:00:00Z",
  }],
}))
assert.equal(retractionNotice.state, "verified_clean", "a notice must not be mistaken for the retracted work")

const expressionOfConcern = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.concern",
  updates: [{
    type: "expression_of_concern",
    authority: "europe_pmc",
    direction: "updates_source",
    noticeId: "12345678",
    noticeUrl: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
    observedAt: null,
  }],
}))
assert.equal(expressionOfConcern.state, "quarantined")

const unresolvedCorrection = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.correction",
  updates: [{
    type: "erratum",
    authority: "crossmark",
    direction: "updates_source",
    noticeId: "10.1234/erratum.1",
    noticeUrl: "https://doi.org/10.1234/erratum.1",
    observedAt: null,
  }],
  correctionResolution: "pending",
}))
assert.equal(unresolvedCorrection.state, "pending")
const appliedCorrection = evaluateDnaSourceIntegrity({
  ...baseInput({ sourceId: "source.corrected" }),
  updates: unresolvedCorrection.updates,
  correctionResolution: "applied",
})
assert.equal(appliedCorrection.state, "corrected")

const superseded = evaluateDnaSourceIntegrity(baseInput({
  sourceId: "source.superseded",
  updates: [{
    type: "new_version",
    authority: "crossmark",
    direction: "updates_source",
    noticeId: "10.1234/version.2",
    noticeUrl: "https://doi.org/10.1234/version.2",
    observedAt: null,
  }],
}))
assert.equal(superseded.state, "superseded")

const impact = traverseDnaSourceIntegrityImpact({
  integrityRecords: [clean, retracted],
  graph: {
    passages: [
      { id: "passage.safe", sourceId: clean.sourceId },
      { id: "passage.withdrawn", sourceId: retracted.sourceId },
    ],
    claims: [
      { id: "claim.safe", passageIds: ["passage.safe"] },
      { id: "claim.withdrawn", passageIds: ["passage.withdrawn"] },
    ],
    relations: [
      { id: "relation.safe", claimIds: ["claim.safe"] },
      { id: "relation.withdrawn", claimIds: ["claim.withdrawn"] },
    ],
    answers: [
      {
        id: "answer.alternative",
        relationIds: ["relation.withdrawn", "relation.safe"],
        alternativeRelationGroups: [["relation.withdrawn", "relation.safe"]],
      },
      { id: "answer.no_alternative", relationIds: ["relation.withdrawn"] },
      { id: "answer.unaffected", relationIds: ["relation.safe"] },
    ],
  },
})
assert.equal(impact.answers.find((row) => row.answerId === "answer.alternative")?.state,
  "available_with_safe_alternative")
assert.equal(impact.answers.find((row) => row.answerId === "answer.no_alternative")?.state,
  "not_available")
assert.equal(impact.answers.find((row) => row.answerId === "answer.unaffected")?.state, "unaffected")
assert.equal(impact.valid, true)

const incompleteAlternativeImpact = traverseDnaSourceIntegrityImpact({
  integrityRecords: [clean, retracted],
  graph: {
    passages: [
      { id: "passage.safe", sourceId: clean.sourceId },
      { id: "passage.withdrawn", sourceId: retracted.sourceId },
    ],
    claims: [
      { id: "claim.safe", passageIds: ["passage.safe"] },
      { id: "claim.withdrawn", passageIds: ["passage.withdrawn"] },
    ],
    relations: [
      { id: "relation.safe", claimIds: ["claim.safe"] },
      { id: "relation.alternative_withdrawn", claimIds: ["claim.withdrawn"] },
      { id: "relation.required_withdrawn", claimIds: ["claim.withdrawn"] },
    ],
    answers: [
      {
        id: "answer.uncovered_required_relation",
        relationIds: ["relation.safe", "relation.alternative_withdrawn", "relation.required_withdrawn"],
        alternativeRelationGroups: [["relation.safe", "relation.alternative_withdrawn"]],
      },
      {
        id: "answer.affected_direct_claim",
        relationIds: ["relation.safe", "relation.alternative_withdrawn"],
        claimIds: ["claim.withdrawn"],
        alternativeRelationGroups: [["relation.safe", "relation.alternative_withdrawn"]],
      },
    ],
  },
})
assert.equal(incompleteAlternativeImpact.valid, true)
assert.ok(incompleteAlternativeImpact.answers.every((row) => row.state === "not_available"))

const forgedIntegrityRecord = {
  ...clean,
  state: "withdrawn" as const,
  runtimeEligibility: "eligible" as const,
}
const forgedIntegrityImpact = traverseDnaSourceIntegrityImpact({
  integrityRecords: [forgedIntegrityRecord],
  graph: {
    passages: [{ id: "passage.forged", sourceId: forgedIntegrityRecord.sourceId }],
    claims: [{ id: "claim.forged", passageIds: ["passage.forged"] }],
    relations: [{ id: "relation.forged", claimIds: ["claim.forged"] }],
    answers: [{ id: "answer.forged", relationIds: ["relation.forged"] }],
  },
})
assert.equal(forgedIntegrityImpact.valid, false)
assert.ok(forgedIntegrityImpact.reasonCodes.includes("integrity_record_invalid"))
assert.equal(forgedIntegrityImpact.answers[0]?.state, "not_available")

const missingIntegrityImpact = traverseDnaSourceIntegrityImpact({
  integrityRecords: [],
  graph: {
    passages: [{ id: "passage.unverified", sourceId: "source.never_audited" }],
    claims: [{ id: "claim.unverified", passageIds: ["passage.unverified"] }],
    relations: [{ id: "relation.unverified", claimIds: ["claim.unverified"] }],
    answers: [{ id: "answer.unverified", relationIds: ["relation.unverified"] }],
  },
})
assert.equal(missingIntegrityImpact.valid, false)
assert.ok(missingIntegrityImpact.reasonCodes.includes("passage_source_integrity_record_missing"))
assert.equal(missingIntegrityImpact.answers[0]?.state, "not_available")

const danglingImpact = traverseDnaSourceIntegrityImpact({
  integrityRecords: [clean],
  graph: {
    passages: [{ id: "passage.safe", sourceId: clean.sourceId }],
    claims: [{ id: "claim.safe", passageIds: ["passage.safe"] }],
    relations: [{ id: "relation.safe", claimIds: ["claim.safe"] }],
    answers: [{ id: "answer.dangling", relationIds: ["relation.missing"] }],
  },
})
assert.equal(danglingImpact.valid, false)
assert.equal(danglingImpact.answers[0]?.state, "not_available")

const duplicateIntegrityImpact = traverseDnaSourceIntegrityImpact({
  integrityRecords: [
    { ...clean, sourceId: "source.duplicate" },
    { ...retracted, sourceId: "source.duplicate" },
  ],
  graph: {
    passages: [{ id: "passage.duplicate", sourceId: "source.duplicate" }],
    claims: [{ id: "claim.duplicate", passageIds: ["passage.duplicate"] }],
    relations: [{ id: "relation.duplicate", claimIds: ["claim.duplicate"] }],
    answers: [{ id: "answer.duplicate", relationIds: ["relation.duplicate"] }],
  },
})
assert.equal(duplicateIntegrityImpact.valid, false)
assert.ok(duplicateIntegrityImpact.reasonCodes.includes("duplicate_source_id"))
assert.equal(duplicateIntegrityImpact.answers[0]?.state, "not_available")

const offlineOutput = execFileSync(process.execPath, [
  "--no-warnings",
  "--permission",
  `--allow-fs-read=${repoRoot}`,
  `--allow-fs-read=${resolve(researchSsdRoot)}`,
  `--allow-fs-read=${sourceRoot}`,
  "--allow-child-process",
  resolve(repoRoot, "scripts/audit-dna-source-integrity-online.mjs"),
  "--offline-verify",
  `--root=${sourceRoot}`,
], { encoding: "utf8" })
const offline = JSON.parse(offlineOutput)
assert.equal(offline.ok, true)
assert.equal(offline.mode, "offline_verify_no_network_no_writes")
const accidentalExecution = spawnSync(process.execPath, [
  "--no-warnings",
  resolve(repoRoot, "scripts/audit-dna-source-integrity-online.mjs"),
  `--root=${sourceRoot}`,
], { encoding: "utf8", env: process.env })
assert.notEqual(accidentalExecution.status, 0)
assert.match(accidentalExecution.stderr, /Choose exactly one mode/)

const integrityAudit = readJson(`${sourceRoot}/integrity-audit/v1/source-integrity-audit.json`)
const integritySummary = readJson(`${sourceRoot}/integrity-audit/v1/source-integrity-summary.json`)
const acquisitionLedger = readJson(`${sourceRoot}/acquisition-audit/v1/acquisition-ledger.json`)
const acquisitionVerification = readJson(`${sourceRoot}/acquisition-audit/v1/acquisition-verification.json`)
assert.equal(integrityAudit.sourceCount, 47)
assert.equal(integrityAudit.records.length, 47)
const tripodIntegrity = integrityAudit.records.find((record: any) => record.sourceId === "tripod-ai-2024")
assert.ok(tripodIntegrity)
assert.equal(tripodIntegrity.state, "corrected")
assert.equal(tripodIntegrity.auditInput.correctionResolution, "applied")
assert.equal(tripodIntegrity.correctionAttestation?.decision?.affectedScope, "author_affiliations_only")
assert.equal(tripodIntegrity.correctionAttestation?.passedCheckCount, 8)
assert.equal(tripodIntegrity.correctionAttestation?.ssdArchiveVerified, true)
assert.equal(Object.values(integritySummary.stateCounts).reduce((sum: number, value: any) => sum + value, 0), 47)
assert.equal(acquisitionLedger.entries.length, 66)
assert.ok(acquisitionLedger.entries.every((entry: any) => !entry.relativePath.startsWith("/")))
assert.ok(!JSON.stringify(acquisitionLedger).includes(resolve(researchSsdRoot)))
const repoSnapshotPath = resolve(
  repoRoot,
  "docs/dna-intelligence/governance/v3/source-integrity-archive-snapshot.json",
)
if (process.env.DNA_WRITE_SOURCE_INTEGRITY_SNAPSHOT === "1" || process.argv.includes("--write-snapshot")) {
  const historyCurrentPath = join(sourceRoot, "audit-history/v1/current.json")
  const historyCurrent = readJson(historyCurrentPath)
  const historyManifestPath = join(sourceRoot, historyCurrent.manifestRelativePath)
  const auditPaths = [
    join(sourceRoot, "integrity-audit/v1/raw-online-integrity-responses.json"),
    join(sourceRoot, "integrity-audit/v1/source-integrity-audit.json"),
    join(sourceRoot, "integrity-audit/v1/source-integrity-summary.json"),
    join(sourceRoot, "acquisition-audit/v1/acquisition-ledger.json"),
    join(sourceRoot, "acquisition-audit/v1/acquisition-verification.json"),
    historyCurrentPath,
    historyManifestPath,
  ]
  const historyRunCount = readdirSync(join(sourceRoot, "audit-history/v1"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).length
  const snapshot = {
    schemaVersion: "dna-source-integrity-archive-snapshot@1",
    auditedAt: integritySummary.checkedAt,
    storagePolicy: {
      rootAlias: "ResearchSSD:",
      repoContainsRawArtifacts: false,
      repoContainsAbsoluteStoragePaths: false,
      sourceLibraryRelativePath: relative(resolve(researchSsdRoot), sourceRoot).replaceAll("\\", "/"),
      workRelativePath: relative(resolve(researchSsdRoot), workRoot).replaceAll("\\", "/"),
      releaseRelativePath: relative(resolve(researchSsdRoot), releaseRoot).replaceAll("\\", "/"),
      workFileCount: walkFiles(workRoot).length,
      releaseFileCount: walkFiles(releaseRoot).length,
    },
    integrity: {
      sourceCount: integritySummary.sourceCount,
      stateCounts: integritySummary.stateCounts,
      integrityGateEligibleCount: integritySummary.eligibleCount,
      integrityGateBlockedCount: integritySummary.blockedCount,
      runtimeReleasedCount: 0,
      authorityUnavailableCount: integritySummary.authorityUnavailableCount,
      updateSignalCount: integritySummary.updateSignalCount,
      retractionWatchMarkerCount: integritySummary.retractionWatchMarkerCount,
      retractionOrWithdrawalCount: integritySummary.retractionOrWithdrawalCount,
      expressionOfConcernCount: integritySummary.expressionOfConcernCount,
      publisherConsistencyPendingSourceIds: integrityAudit.records
        .filter((record: any) => record.reasonCodes.includes("publisher_consistency_mismatch"))
        .map((record: any) => record.sourceId).sort(),
      authorityUnavailableSourceIds: integrityAudit.records
        .filter((record: any) => Object.values(record.authorityCoverage).includes("unavailable"))
        .map((record: any) => record.sourceId).sort(),
    },
    correctionResolutionAttestations: [{
      sourceId: "tripod-ai-2024",
      repositoryRelativePath: "docs/dna-intelligence/governance/v3/correction-resolution-attestations/tripod-ai-2024.json",
      repositorySha256: sha256File(resolve(
        repoRoot,
        "docs/dna-intelligence/governance/v3/correction-resolution-attestations/tripod-ai-2024.json",
      )),
      attestationSha256: tripodIntegrity.correctionAttestation.attestationSha256,
      decision: tripodIntegrity.state,
      scope: tripodIntegrity.correctionAttestation.decision.affectedScope,
      requiredChecks: tripodIntegrity.correctionAttestation.requiredCheckCount,
      passedChecks: tripodIntegrity.correctionAttestation.passedCheckCount,
      ssdArchiveVerified: tripodIntegrity.correctionAttestation.ssdArchiveVerified,
    }],
    acquisition: {
      rawArtifactCount: acquisitionVerification.rawArtifactCount,
      ledgerEntryCount: acquisitionLedger.entries.length,
      acceptedCount: acquisitionVerification.acceptedCount,
      rejectedCount: acquisitionVerification.rejectedCount,
      bytes: acquisitionLedger.entries.reduce((sum: number, entry: any) => sum + Number(entry.bytes || 0), 0),
      mediaTypeCounts: countBy(acquisitionLedger.entries, (entry: any) => String(entry.mediaType)),
      acquisitionMethodCounts: countBy(acquisitionLedger.entries, (entry: any) => String(entry.acquisitionMethod)),
      downloadUrlEvidenceCounts: countBy(acquisitionLedger.entries, (entry: any) => String(entry.downloadUrlEvidence)),
      sourceAndDownloadUrlDifferCount: acquisitionLedger.entries.filter((entry: any) =>
        entry.sourceUrl && entry.downloadUrl && entry.sourceUrl !== entry.downloadUrl).length,
    },
    history: {
      immutableRunCount: historyRunCount,
      currentRunId: historyCurrent.runId,
      currentBundleSha256: historyCurrent.bundleSha256,
      currentManifestRelativePath: relative(resolve(researchSsdRoot), historyManifestPath).replaceAll("\\", "/"),
    },
    ssdAuditFiles: auditPaths.map((absolute) => ({
      relativePath: relative(resolve(researchSsdRoot), absolute).replaceAll("\\", "/"),
      sha256: sha256File(absolute),
    })),
    interpretationBoundary: `${integritySummary.eligibleCount} records passed only the Phase 10 integrity gate. No source or answer is released to V3 runtime until every independent lifecycle, identity, method, passage, claim, licence and release gate also passes. Zero observed markers means no marker was returned by the checked authorities at the audit timestamp; it is not a permanent guarantee.`,
  }
  mkdirSync(dirname(repoSnapshotPath), { recursive: true })
  writeFileSync(repoSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8")
}
const repoSnapshot = readJson(repoSnapshotPath)
assert.ok(!JSON.stringify(repoSnapshot).includes(resolve(researchSsdRoot)))
assert.equal(repoSnapshot.correctionResolutionAttestations.length, 1)
assert.equal(
  repoSnapshot.correctionResolutionAttestations[0].repositorySha256,
  sha256File(resolve(
    repoRoot,
    repoSnapshot.correctionResolutionAttestations[0].repositoryRelativePath,
  )),
)
for (const auditFile of repoSnapshot.ssdAuditFiles) {
  const absolute = join(researchSsdRoot, auditFile.relativePath)
  assert.equal(sha256File(absolute), auditFile.sha256, `snapshot hash: ${auditFile.relativePath}`)
}

const actualFirst = acquisitionLedger.entries[0]
const missingArtifact = verifyDnaSourceAcquisitionLedger({
  entries: [actualFirst],
  observedArtifacts: [{
    relativePath: actualFirst.relativePath,
    exists: false,
    bytes: null,
    sha256: null,
    formatIntegrity: "failed",
    rootContainment: "passed",
  }],
})
assert.equal(missingArtifact.accepted, false)
assert.ok(missingArtifact.decisions[0]?.reasonCodes.includes("artifact_missing"))
const hashMismatch = verifyDnaSourceAcquisitionLedger({
  entries: [actualFirst],
  observedArtifacts: [{
    relativePath: actualFirst.relativePath,
    exists: true,
    bytes: actualFirst.bytes,
    sha256: "f".repeat(64),
    formatIntegrity: "passed",
    rootContainment: "passed",
  }],
})
assert.equal(hashMismatch.accepted, false)
assert.ok(hashMismatch.decisions[0]?.reasonCodes.includes("artifact_sha256_mismatch"))

const failedEpub = verifyDnaSourceAcquisitionLedger({
  entries: [{
    ...actualFirst,
    relativePath: "synthetic/book.epub",
    mediaType: "application/epub+zip",
  }],
  observedArtifacts: [{
    relativePath: "synthetic/book.epub",
    exists: true,
    bytes: actualFirst.bytes,
    sha256: actualFirst.sha256,
    formatIntegrity: "failed",
    rootContainment: "passed",
  }],
})
assert.equal(failedEpub.accepted, false)
assert.ok(failedEpub.decisions[0]?.reasonCodes.includes("pdf_xml_or_epub_integrity_failed"))

const boundaryParent = mkdtempSync(join(workRoot, "integrity-boundary-test-"))
try {
  const artifactRoot = join(boundaryParent, "source")
  mkdirSync(artifactRoot)
  const inside = join(artifactRoot, "inside.bin")
  const outside = join(boundaryParent, "outside.bin")
  writeFileSync(inside, "inside", "utf8")
  writeFileSync(outside, "outside", "utf8")
  assert.equal(resolveDnaAcquisitionArtifactWithinRoot(artifactRoot, "inside.bin"), inside)
  symlinkSync(outside, join(artifactRoot, "escape.bin"))
  assert.throws(
    () => resolveDnaAcquisitionArtifactWithinRoot(artifactRoot, "escape.bin"),
    /dna_acquisition_artifact_root_escape/,
  )
  assert.throws(
    () => resolveDnaAcquisitionArtifactWithinRoot(artifactRoot, "../outside.bin"),
    /dna_acquisition_artifact_path_unsafe/,
  )
} finally {
  rmSync(boundaryParent, { recursive: true, force: true })
}

const records = integrityAudit.records as DnaSourceIntegrityRecord[]
const output = {
  ok: true,
  syntheticIntegrityCases: 17,
  updateNormalizationVariants: updateVariants.length,
  impactAnswers: impact.answers.length + missingIntegrityImpact.answers.length
    + danglingImpact.answers.length + duplicateIntegrityImpact.answers.length
    + incompleteAlternativeImpact.answers.length + forgedIntegrityImpact.answers.length,
  sourceCount: records.length,
  stateCounts: integritySummary.stateCounts,
  authorityUnavailableCount: integritySummary.authorityUnavailableCount,
  updateSignalCount: integritySummary.updateSignalCount,
  retractionWatchMarkerCount: integritySummary.retractionWatchMarkerCount,
  acquisitionEntryCount: acquisitionLedger.entries.length,
  acquisitionAcceptedCount: offline.acquisition.acceptedCount,
  acquisitionRejectedCount: offline.acquisition.rejectedCount,
  offlineNetworkPermission: "denied_by_node_permission_model",
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`)
