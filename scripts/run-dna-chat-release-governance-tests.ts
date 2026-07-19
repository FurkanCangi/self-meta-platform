import assert from "node:assert/strict"
import { createHash } from "node:crypto"

import {
  buildDnaOwnerBookManifest,
  canOwnerBookApprovalSupportRole,
  compileDnaOwnerBookLock,
  DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION,
  type DnaOwnerBookLockState,
} from "../src/lib/dna/chat/governance/bookLock"
import {
  DNA_COVERAGE_MAP_VERSION,
  type DnaCoverageCell,
} from "../src/lib/dna/chat/governance/coverageMap"
import {
  DNA_REQUIRED_RELEASE_PATH,
  appendDnaLifecycleTransition,
  createDnaContentLifecycleRecord,
  createV2LegacyLifecycleRecord,
  type DnaContentLifecycleRecord,
} from "../src/lib/dna/chat/governance/lifecycle"
import {
  DNA_CURRENT_V3_RELEASE_PACKAGE,
  DNA_V3_RELEASE_COMPILER_VERSION,
  compileDnaV3ReleasePackage,
  createDnaV3ScienceSupportProvenance,
  type DnaV3ScienceReleaseCandidate,
} from "../src/lib/dna/chat/governance/releaseCompiler"
import {
  DNA_LICENSE_COMPONENTS,
  canonicalizeSourceIdentifiers,
  type DnaSourceIdentityRecord,
  type DnaSourceLicenseRecord,
} from "../src/lib/dna/chat/governance/sourceGovernance"

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function contentSha256(
  contentId: string,
  contentKind: DnaContentLifecycleRecord["contentKind"],
): string {
  return sha256({ contentId, contentKind })
}

function contentPayload(
  contentId: string,
  contentKind: DnaContentLifecycleRecord["contentKind"],
) {
  return { contentId, contentKind } as const
}

function releasedLifecycle(
  contentId: string,
  contentKind: DnaContentLifecycleRecord["contentKind"],
  explicitContentSha256 = contentSha256(contentId, contentKind),
): DnaContentLifecycleRecord {
  let record = createDnaContentLifecycleRecord({
    contentId,
    contentKind,
    contentSha256: explicitContentSha256,
    eventId: `${contentId}.event.00`,
    occurredAt: "2026-07-19T00:00:00.000Z",
    actorId: "test.release.compiler",
    evidenceSha256: "a".repeat(64),
  })
  for (const [index, status] of DNA_REQUIRED_RELEASE_PATH.slice(1).entries()) {
    record = appendDnaLifecycleTransition(record, {
      toStatus: status,
      eventId: `${contentId}.event.${String(index + 1).padStart(2, "0")}`,
      occurredAt: new Date(Date.UTC(2026, 6, 19, 0, index + 1)).toISOString(),
      actorId: "test.release.compiler",
      reasonCode: `test.${status}`,
      evidenceSha256: String(index + 1).padStart(64, "b").slice(-64),
    })
  }
  return record
}

function identity(): DnaSourceIdentityRecord {
  const identifiers = canonicalizeSourceIdentifiers({
    doi: "10.1234/release.compiler",
    pmid: "12345678",
    pmcid: "PMC1234567",
    isbn: null,
  })
  return {
    sourceId: "source.release.compiler",
    workId: "work.release.compiler",
    versionId: "version.release.compiler.vor",
    versionStatus: "version_of_record",
    publicationRole: "article",
    correctionOfWorkId: null,
    correctionResolution: "not_applicable",
    correctionRelations: [],
    cohortFamilyId: null,
    cohortResolution: "not_applicable",
    bibliography: {
      title: "Release compiler test source",
      authors: ["Test Author"],
      year: 2026,
      venue: "Test Journal",
    },
    verifiedBibliography: {
      title: "Release compiler test source",
      authors: ["Test Author"],
      year: 2026,
      venue: "Test Journal",
    },
    identifiers,
    verifiedIdentifiers: identifiers,
    identityVerification: {
      status: "verified",
      authority: "test.crossref.pubmed",
      verifiedAt: "2026-07-19",
      evidenceSha256: "c".repeat(64),
    },
  }
}

function license(): DnaSourceLicenseRecord {
  return {
    sourceId: "source.release.compiler",
    declaredLicense: "CC BY 4.0",
    policy: "cc_by",
    obligations: {
      attributionRequired: true,
      shareAlikeRequired: false,
    },
    components: DNA_LICENSE_COMPONENTS.map((component) => ({
      component,
      decision: "cleared" as const,
      commercialUse: "allowed" as const,
      adaptation: "allowed" as const,
      textAndDataMining: "allowed" as const,
      redisplay: "allowed" as const,
      thirdPartyMaterialReviewed: true,
      evidence: {
        sourceId: "source.release.compiler",
        url: "https://creativecommons.org/licenses/by/4.0/",
        checkedAt: "2026-07-19",
        sha256: "d".repeat(64),
        basis: "official_license_page_verified" as const,
        artifactRelativePath: null,
      },
    })),
  }
}

function licenseCompliance() {
  return {
    attribution: {
      status: "satisfied" as const,
      noticeSha256: "9".repeat(64),
    },
    shareAlike: {
      status: "not_required" as const,
      releaseLicensePolicy: null,
      noticeSha256: null,
    },
  }
}

const RELEASE_CELL = Object.freeze({
  version: DNA_COVERAGE_MAP_VERSION,
  id: "cellular_neurophysiology.definition",
  domainId: "cellular_neurophysiology",
  dimensionId: "definition",
  status: "release_ready",
  safeQuestionFamilies: Object.freeze(["Test kavramı nasıl tanımlanır?"]),
  boundaryTr: "Yalnız testteki released claim-source-passage-component zinciriyle yanıtlanabilir.",
  ageScope: "all_ages",
  candidateSourceIds: Object.freeze(["source.release.compiler"]),
  releaseEvidence: Object.freeze({
    claimIds: Object.freeze(["claim.release.compiler"]),
    sourceIds: Object.freeze(["source.release.compiler"]),
  }),
  testCoverage: Object.freeze({
    contractTestIds: Object.freeze(["coverage.release.compiler"]),
    requiredOutcomes: Object.freeze(["bounded_answer"] as const),
  }),
}) satisfies DnaCoverageCell

function scienceCandidate(): DnaV3ScienceReleaseCandidate {
  const claimId = "claim.release.compiler"
  const sourceId = "source.release.compiler"
  const passageId = "passage.release.compiler"
  const componentId = "component.release.compiler"
  const claimSha256 = contentSha256(claimId, "claim")
  const sourceSha256 = contentSha256(sourceId, "source")
  const passageSha256 = contentSha256(passageId, "passage")
  const componentSha256 = contentSha256(componentId, "component")
  const licenseComponent = "passage" as const
  return {
    candidateId: "candidate.release.compiler",
    authority: "external_scientific_information",
    claimId,
    claimSha256,
    claimPayload: contentPayload(claimId, "claim"),
    sourceId,
    sourceSha256,
    sourcePayload: contentPayload(sourceId, "source"),
    passageId,
    passageSha256,
    passagePayload: contentPayload(passageId, "passage"),
    componentId,
    componentSha256,
    componentPayload: contentPayload(componentId, "component"),
    coverageCellId: RELEASE_CELL.id,
    claimLifecycle: releasedLifecycle("claim.release.compiler", "claim"),
    sourceLifecycle: releasedLifecycle("source.release.compiler", "source"),
    passageLifecycle: releasedLifecycle("passage.release.compiler", "passage"),
    componentLifecycle: releasedLifecycle("component.release.compiler", "component"),
    priority: {
      sourceId: "source.release.compiler",
      role: "systematic_review_meta_analysis",
      population: "human",
      ageScope: "all_ages",
      sampleScope: "general_population",
      psychometricRole: null,
      publicationVersion: "version_of_record",
    },
    questionType: "definition",
    claimMode: "scientific_evidence",
    claimPopulation: "human",
    claimAgeScope: "all_ages",
    claimSampleScope: "general_population",
    identity: identity(),
    license: license(),
    licenseComponent,
    licenseCompliance: licenseCompliance(),
    provenance: createDnaV3ScienceSupportProvenance({
      sourceId,
      sourceSha256,
      passageId,
      passageSha256,
      componentId,
      componentSha256,
      claimId,
      claimSha256,
      licenseComponent,
      identity: identity(),
      license: license(),
      licenseCompliance: licenseCompliance(),
      priority: {
        sourceId: "source.release.compiler",
        role: "systematic_review_meta_analysis",
        population: "human",
        ageScope: "all_ages",
        sampleScope: "general_population",
        psychometricRole: null,
        publicationVersion: "version_of_record",
      },
    }),
  }
}

assert.equal(DNA_CURRENT_V3_RELEASE_PACKAGE.schemaVersion, DNA_V3_RELEASE_COMPILER_VERSION)
assert.equal(DNA_CURRENT_V3_RELEASE_PACKAGE.releaseCount, 0)
assert.equal(DNA_CURRENT_V3_RELEASE_PACKAGE.blockedCount, 0)

const registryBlocked = compileDnaV3ReleasePackage({
  candidates: [scienceCandidate()],
  coverageCells: [RELEASE_CELL],
})
assert.equal(registryBlocked.releaseCount, 0)
assert.deepEqual(registryBlocked.releasedCandidateIds, [])
assert.ok(registryBlocked.blocked[0].blockCodes.includes("candidate_not_in_audited_registry"))
assert.ok(registryBlocked.blocked[0].blockCodes.includes("coverage_collection_untrusted"))

const secondClaimSameSource = {
  ...scienceCandidate(),
  candidateId: "candidate.release.compiler.second",
}
const repeatedSourceReleased = compileDnaV3ReleasePackage({
  candidates: [scienceCandidate(), secondClaimSameSource],
  coverageCells: [RELEASE_CELL],
})
assert.equal(repeatedSourceReleased.releaseCount, 0)
assert.ok(repeatedSourceReleased.blocked.every((decision) =>
  decision.blockCodes.every((code) =>
    code === "candidate_not_in_audited_registry"
    || code === "coverage_collection_untrusted")),
"Aynı kaynak aynı payload ile tekrarlandığında sahte içerik çatışması doğmamalı")

const provenanceTampered = scienceCandidate()
const provenanceBlocked = compileDnaV3ReleasePackage({
  candidates: [{
    ...provenanceTampered,
    provenance: {
      ...provenanceTampered.provenance,
      provenanceSha256: "f".repeat(64),
    },
  }],
  coverageCells: [RELEASE_CELL],
})
assert.ok(provenanceBlocked.blocked[0].blockCodes.includes("invalid_support_provenance"))

const payloadHashBlocked = compileDnaV3ReleasePackage({
  candidates: [{ ...scienceCandidate(), passageSha256: "e".repeat(64) }],
  coverageCells: [RELEASE_CELL],
})
assert.ok(payloadHashBlocked.blocked[0].blockCodes.includes("lifecycle_content_hash_mismatch"))
assert.ok(payloadHashBlocked.blocked[0].blockCodes.includes("payload_hash_mismatch"))
assert.ok(payloadHashBlocked.blocked[0].blockCodes.includes("invalid_support_provenance"))

const actualPayloadTamperBlocked = compileDnaV3ReleasePackage({
  candidates: [{
    ...scienceCandidate(),
    passagePayload: { contentId: "passage.release.compiler", contentKind: "tampered" },
  }],
  coverageCells: [RELEASE_CELL],
})
assert.ok(actualPayloadTamperBlocked.blocked[0].blockCodes.includes("payload_hash_mismatch"))

const sourceHashConflict = compileDnaV3ReleasePackage({
  candidates: [scienceCandidate(), {
    ...scienceCandidate(),
    candidateId: "candidate.release.compiler.conflicting-source",
    sourceSha256: "e".repeat(64),
  }],
  coverageCells: [RELEASE_CELL],
})
assert.equal(sourceHashConflict.releaseCount, 0)
assert.ok(sourceHashConflict.blocked.every((decision) =>
  decision.blockCodes.includes("global_content_hash_conflict")))

const conflictingLicense = license()
const sourceProfileConflict = compileDnaV3ReleasePackage({
  candidates: [scienceCandidate(), {
    ...scienceCandidate(),
    candidateId: "candidate.release.compiler.conflicting-profile",
    license: {
      ...conflictingLicense,
      declaredLicense: "CC BY 4.0 - conflicting profile",
    },
  }],
  coverageCells: [RELEASE_CELL],
})
assert.equal(sourceProfileConflict.releaseCount, 0)
assert.ok(sourceProfileConflict.blocked.every((decision) =>
  decision.blockCodes.includes("source_governance_profile_conflict")))

const foreignLicense = license()
const foreignLicenseBlocked = compileDnaV3ReleasePackage({
  candidates: [{
    ...scienceCandidate(),
    license: { ...foreignLicense, sourceId: "source.foreign.license" },
  }],
  coverageCells: [RELEASE_CELL],
})
assert.ok(foreignLicenseBlocked.blocked[0].blockCodes.includes("source_identity_not_release_eligible"))
assert.ok(foreignLicenseBlocked.blocked[0].blockCodes.includes("source_license_component_denied"))

const pendingAttributionBlocked = compileDnaV3ReleasePackage({
  candidates: [{
    ...scienceCandidate(),
    licenseCompliance: {
      ...licenseCompliance(),
      attribution: { status: "pending", noticeSha256: null },
    },
  }],
  coverageCells: [RELEASE_CELL],
})
assert.ok(pendingAttributionBlocked.blocked[0].blockCodes.includes(
  "source_license_obligations_unfulfilled",
))

const notReleasedCell = compileDnaV3ReleasePackage({
  candidates: [scienceCandidate()],
})
assert.equal(notReleasedCell.releaseCount, 0)
assert.ok(notReleasedCell.blocked[0].blockCodes.includes("coverage_cell_not_release_ready"))

const legacyCandidate = scienceCandidate()
const legacyBlocked = compileDnaV3ReleasePackage({
  candidates: [{
    ...legacyCandidate,
    claimLifecycle: createV2LegacyLifecycleRecord({
      contentId: legacyCandidate.claimId,
      legacyStatus: "approved",
    }),
  }],
  coverageCells: [RELEASE_CELL],
})
assert.equal(legacyBlocked.releaseCount, 0)
assert.ok(legacyBlocked.blocked[0].blockCodes.includes("claim_lifecycle_not_released"))

const metadataBlocked = compileDnaV3ReleasePackage({
  candidates: [{
    ...scienceCandidate(),
    priority: {
      sourceId: "source.release.compiler",
      role: "metadata_only",
      population: "not_reported",
      ageScope: "not_reported",
      sampleScope: "not_reported",
      psychometricRole: null,
    },
  }],
  coverageCells: [RELEASE_CELL],
})
assert.equal(metadataBlocked.releaseCount, 0)
assert.ok(metadataBlocked.blocked[0].blockCodes.includes("source_priority_denied"))

const productDeferred = compileDnaV3ReleasePackage({
  candidates: [{
    candidateId: "candidate.product.deferred",
    authority: "dna_product_information",
    claimId: "claim.release.compiler",
    claimSha256: contentSha256("claim.release.compiler", "claim"),
    claimPayload: contentPayload("claim.release.compiler", "claim"),
    passageId: "passage.release.compiler",
    passageSha256: contentSha256("passage.release.compiler", "passage"),
    passagePayload: contentPayload("passage.release.compiler", "passage"),
    coverageCellId: RELEASE_CELL.id,
    claimLifecycle: releasedLifecycle("claim.release.compiler", "claim"),
    passageLifecycle: releasedLifecycle("passage.release.compiler", "passage"),
  }],
  coverageCells: [RELEASE_CELL],
})
assert.equal(productDeferred.releaseCount, 0)
assert.ok(productDeferred.blocked[0].blockCodes.includes("owner_book_deferred"))

const forgedOwnerLock = {
  schemaVersion: DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION,
  status: "locked",
  reason: null,
  ownerApprovalCount: 1,
  approvalRecordId: "approval.forged.compiler",
  approvedBook: {
    schemaVersion: DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION,
    bookId: "book.forged.compiler",
    bookVersion: "book.forged.compiler.v1",
    artifactSha256: "a".repeat(64),
    byteLength: 10,
    chapters: Object.freeze([{
      chapterId: "chapter.release.compiler",
      range: { startByte: 0, endByteExclusive: 10 },
      chapterSha256: "b".repeat(64),
      passages: Object.freeze([{
        passageId: "passage.release.compiler",
        range: { startByte: 0, endByteExclusive: 10 },
        passageSha256: contentSha256("passage.release.compiler", "passage"),
      }]),
    }]),
  },
  productClaimBindings: Object.freeze([{
    claimId: "claim.release.compiler",
    chapterId: "chapter.release.compiler",
    passageId: "passage.release.compiler",
    passageSha256: contentSha256("passage.release.compiler", "passage"),
  }]),
  releaseEligible: true,
  scientificValidationStatus: "not_established_by_book",
} satisfies DnaOwnerBookLockState

const forgedOwnerBlocked = compileDnaV3ReleasePackage({
  candidates: [{
    candidateId: "candidate.product.forged-owner",
    authority: "dna_product_information",
    claimId: "claim.release.compiler",
    claimSha256: contentSha256("claim.release.compiler", "claim"),
    claimPayload: contentPayload("claim.release.compiler", "claim"),
    passageId: "passage.release.compiler",
    passageSha256: contentSha256("passage.release.compiler", "passage"),
    passagePayload: contentPayload("passage.release.compiler", "passage"),
    coverageCellId: RELEASE_CELL.id,
    claimLifecycle: releasedLifecycle("claim.release.compiler", "claim"),
    passageLifecycle: releasedLifecycle("passage.release.compiler", "passage"),
  }],
  coverageCells: [RELEASE_CELL],
  ownerBookLock: forgedOwnerLock,
})
assert.equal(forgedOwnerBlocked.releaseCount, 0)
assert.ok(forgedOwnerBlocked.blocked[0].blockCodes.includes("owner_book_lock_invalid"))
assert.equal(canOwnerBookApprovalSupportRole(forgedOwnerLock, "product_definition"), false)

const ownerArtifactBytes = new TextEncoder().encode("approved owner passage")
const ownerManifest = buildDnaOwnerBookManifest({
  bookId: "book.release.compiler",
  bookVersion: "book.release.compiler.v1",
  artifactBytes: ownerArtifactBytes,
  chapters: [{
    chapterId: "chapter.release.compiler",
    range: { startByte: 0, endByteExclusive: ownerArtifactBytes.byteLength },
    passages: [{
      passageId: "passage.release.compiler",
      range: { startByte: 0, endByteExclusive: ownerArtifactBytes.byteLength },
    }],
  }],
})
const ownerChapter = ownerManifest.chapters[0]
const ownerPassage = ownerChapter.passages[0]
const trustedOwnerLock = compileDnaOwnerBookLock({
  manifest: ownerManifest,
  artifactBytes: ownerArtifactBytes,
  approval: {
    approvalRecordId: "approval.release.compiler",
    approvalStatus: "owner_approved",
    declarationVersion: "owner.declaration.v1",
    bookId: ownerManifest.bookId,
    bookVersion: ownerManifest.bookVersion,
    artifactSha256: ownerManifest.artifactSha256,
    byteLength: ownerManifest.byteLength,
    approvedChapterRanges: [{
      chapterId: ownerChapter.chapterId,
      range: ownerChapter.range,
      chapterSha256: ownerChapter.chapterSha256,
    }],
    approvedPassageRanges: [{
      chapterId: ownerChapter.chapterId,
      passageId: ownerPassage.passageId,
      range: ownerPassage.range,
      passageSha256: ownerPassage.passageSha256,
    }],
  },
  liveProductClaimIds: ["claim.release.compiler"],
  claimBindings: [{
    claimId: "claim.release.compiler",
    chapterId: ownerChapter.chapterId,
    passageId: ownerPassage.passageId,
    passageSha256: ownerPassage.passageSha256,
  }],
})

const productHashMismatch = compileDnaV3ReleasePackage({
  candidates: [{
    candidateId: "candidate.product.hash-mismatch",
    authority: "dna_product_information",
    claimId: "claim.release.compiler",
    claimSha256: contentSha256("claim.release.compiler", "claim"),
    claimPayload: contentPayload("claim.release.compiler", "claim"),
    passageId: "passage.release.compiler",
    passageSha256: contentSha256("passage.release.compiler", "passage"),
    passagePayload: contentPayload("passage.release.compiler", "passage"),
    coverageCellId: RELEASE_CELL.id,
    claimLifecycle: releasedLifecycle("claim.release.compiler", "claim"),
    passageLifecycle: releasedLifecycle("passage.release.compiler", "passage"),
  }],
  coverageCells: [RELEASE_CELL],
  ownerBookLock: trustedOwnerLock,
})
assert.ok(productHashMismatch.blocked[0].blockCodes.includes("owner_passage_hash_mismatch"))

const deterministic = sha256(registryBlocked)
for (let index = 0; index < 20; index += 1) {
  assert.equal(sha256(compileDnaV3ReleasePackage({
    candidates: [scienceCandidate()],
    coverageCells: [RELEASE_CELL],
  })), deterministic)
}

console.log("DNA V3 release governance tests: PASS", JSON.stringify({
  currentReleased: DNA_CURRENT_V3_RELEASE_PACKAGE.releaseCount,
  auditedRegistryCount: DNA_CURRENT_V3_RELEASE_PACKAGE.auditedRegistryCount,
  syntheticFixtureBlocked: registryBlocked.releaseCount === 0,
  v2LegacyBlocked: legacyBlocked.releaseCount === 0,
  supportProvenanceTamperBlocked: provenanceBlocked.releaseCount === 0,
  contentHashTamperBlocked: payloadHashBlocked.releaseCount === 0,
  foreignLicenseBlocked: foreignLicenseBlocked.releaseCount === 0,
  pendingAttributionBlocked: pendingAttributionBlocked.releaseCount === 0,
  repeatedSourceClaimsConflictFree: repeatedSourceReleased.blocked.every((decision) =>
    !decision.blockCodes.includes("global_content_hash_conflict")),
  globalSourceConflictBlocked: sourceHashConflict.releaseCount === 0,
  sourceProfileConflictBlocked: sourceProfileConflict.releaseCount === 0,
  metadataOnlyBlocked: metadataBlocked.releaseCount === 0,
  deferredBookBlocked: productDeferred.releaseCount === 0,
  forgedOwnerLockBlocked: forgedOwnerBlocked.releaseCount === 0,
  ownerPassageHashMismatchBlocked: productHashMismatch.releaseCount === 0,
  deterministicSha256: deterministic,
}))
