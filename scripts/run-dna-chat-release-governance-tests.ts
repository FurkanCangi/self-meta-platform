import assert from "node:assert/strict"
import { createHash } from "node:crypto"

import {
  buildDnaOwnerBookManifest,
  canOwnerBookApprovalSupportRole,
  compileDnaOwnerBookLock,
  DNA_OWNER_BOOK_LOCK_CONTRACT_VERSION,
  type DnaOwnerBookLockState,
} from "../src/lib/dna/chat/governance/bookLock"
import { DNA_REGISTERED_OWNER_APPROVALS } from "../src/lib/dna/chat/knowledgeAuthority"
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
  createDnaV3AttributionNoticePayload,
  createDnaV3ScienceSupportProvenance,
  createDnaV3ShareAlikeNoticePayload,
  DNA_CURRENT_V3_RELEASE_CANDIDATES,
  dnaV3LicenseNoticePayloadSha256,
  dnaV3ReleaseAuthorizationDigest,
  type DnaV3ProductReleaseCandidate,
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

function licenseCompliance(
  identityRecord = identity(),
  licenseRecord = license(),
  licenseComponent = "passage" as const,
) {
  const noticePayload = createDnaV3AttributionNoticePayload({
    identity: identityRecord,
    license: licenseRecord,
    licenseComponent,
    noticeText: "Release compiler test source — Test Author (2026), CC BY 4.0.",
  })
  return {
    attribution: {
      status: "satisfied" as const,
      noticePayload,
      noticeSha256: dnaV3LicenseNoticePayloadSha256(noticePayload),
    },
    shareAlike: {
      status: "not_required" as const,
      releaseLicensePolicy: null,
      noticePayload: null,
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
  const identityRecord = identity()
  const licenseRecord = license()
  const compliance = licenseCompliance(identityRecord, licenseRecord, licenseComponent)
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
    componentSourceId: sourceId,
    passageSourceId: sourceId,
    passageComponentId: componentId,
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
    identity: identityRecord,
    license: licenseRecord,
    licenseComponent,
    licenseCompliance: compliance,
    provenance: createDnaV3ScienceSupportProvenance({
      sourceId,
      sourceSha256,
      passageId,
      passageSha256,
      componentId,
      componentSha256,
      componentSourceId: sourceId,
      claimId,
      claimSha256,
      passageSourceId: sourceId,
      passageComponentId: componentId,
      licenseComponent,
      identity: identityRecord,
      license: licenseRecord,
      licenseCompliance: compliance,
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

function productCandidate(
  overrides: Partial<DnaV3ProductReleaseCandidate> = {},
): DnaV3ProductReleaseCandidate {
  const claimId = "claim.release.compiler"
  const passageId = "passage.release.compiler"
  return {
    candidateId: "candidate.product.deferred",
    authority: "dna_product_information",
    ownerChapterId: "chapter.release.compiler",
    artifactPassageSha256: "8".repeat(64),
    claimId,
    claimSha256: contentSha256(claimId, "claim"),
    claimPayload: contentPayload(claimId, "claim"),
    passageId,
    passageSha256: contentSha256(passageId, "passage"),
    passagePayload: contentPayload(passageId, "passage"),
    coverageCellId: RELEASE_CELL.id,
    claimLifecycle: releasedLifecycle(claimId, "claim"),
    passageLifecycle: releasedLifecycle(passageId, "passage"),
    ...overrides,
  }
}

assert.equal(DNA_CURRENT_V3_RELEASE_PACKAGE.schemaVersion, DNA_V3_RELEASE_COMPILER_VERSION)
assert.equal(DNA_CURRENT_V3_RELEASE_PACKAGE.releaseCount, 0)
assert.equal(DNA_CURRENT_V3_RELEASE_PACKAGE.blockedCount, 0)
assert.deepEqual(DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates, [])
assert.equal(Object.isFrozen(DNA_CURRENT_V3_RELEASE_CANDIDATES), true)
assert.deepEqual(DNA_CURRENT_V3_RELEASE_CANDIDATES, [])

const registryBlocked = compileDnaV3ReleasePackage({
  candidates: [scienceCandidate()],
  coverageCells: [RELEASE_CELL],
})
assert.equal(registryBlocked.releaseCount, 0)
assert.deepEqual(registryBlocked.releasedCandidateIds, [])
assert.ok(registryBlocked.blocked[0].blockCodes.includes("candidate_not_in_audited_registry"))
assert.ok(registryBlocked.blocked[0].blockCodes.includes("coverage_collection_untrusted"))
assert.ok(registryBlocked.blocked[0].blockCodes.includes("claim_review_bundle_missing"))
assert.ok(registryBlocked.blocked[0].blockCodes.includes("publication_candidate_missing"))

const forgedReviewAndPublication = compileDnaV3ReleasePackage({
  candidates: [{
    ...scienceCandidate(),
    claimReviewBundle: {
      claim: {
        claimId: "claim.foreign",
        claimSha256: "f".repeat(64),
        passageIds: ["passage.foreign"],
        sourceId: "source.foreign",
      },
      passages: [],
    } as never,
    publicationCandidate: {
      subject: {
        candidateId: "candidate.foreign",
        claimId: "claim.foreign",
        claimSha256: "f".repeat(64),
        passageId: "passage.foreign",
        passageSha256: "f".repeat(64),
        sourceId: "source.foreign",
        sourceSha256: "f".repeat(64),
      },
      publicationDigest: "f".repeat(64),
    } as never,
  }],
  coverageCells: [RELEASE_CELL],
})
const forgedReviewBlocks = forgedReviewAndPublication.blocked[0].blockCodes
assert.ok(forgedReviewBlocks.includes("claim_review_denied"))
assert.ok(forgedReviewBlocks.includes("claim_review_binding_mismatch"))
assert.ok(forgedReviewBlocks.includes("publication_candidate_denied"))
assert.ok(forgedReviewBlocks.includes("publication_binding_mismatch"))
assert.ok(forgedReviewBlocks.includes("claim_review_publication_binding_mismatch"))

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
    || code === "coverage_collection_untrusted"
    || code === "claim_review_bundle_missing"
    || code === "publication_candidate_missing")),
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

const parentTamperBase = scienceCandidate()
const parentTampered = {
  ...parentTamperBase,
  passageSourceId: "source.foreign.parent",
  provenance: createDnaV3ScienceSupportProvenance({
    sourceId: parentTamperBase.sourceId,
    sourceSha256: parentTamperBase.sourceSha256,
    passageId: parentTamperBase.passageId,
    passageSha256: parentTamperBase.passageSha256,
    passageSourceId: "source.foreign.parent",
    passageComponentId: parentTamperBase.passageComponentId,
    componentId: parentTamperBase.componentId,
    componentSha256: parentTamperBase.componentSha256,
    componentSourceId: parentTamperBase.componentSourceId,
    claimId: parentTamperBase.claimId,
    claimSha256: parentTamperBase.claimSha256,
    licenseComponent: parentTamperBase.licenseComponent,
    identity: parentTamperBase.identity,
    license: parentTamperBase.license,
    licenseCompliance: parentTamperBase.licenseCompliance,
    priority: parentTamperBase.priority,
  }),
} satisfies DnaV3ScienceReleaseCandidate
const parentTamperBlocked = compileDnaV3ReleasePackage({
  candidates: [parentTampered],
  coverageCells: [RELEASE_CELL],
})
assert.ok(parentTamperBlocked.blocked[0].blockCodes.includes("support_parent_mismatch"))
assert.equal(
  parentTamperBlocked.blocked[0].blockCodes.includes("invalid_support_provenance"),
  false,
  "Parent sahteciliği yeniden hashlenmiş provenance içinde bile ayrı kapıda engellenmeli",
)

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
      attribution: { status: "pending", noticePayload: null, noticeSha256: null },
    },
  }],
  coverageCells: [RELEASE_CELL],
})
assert.ok(pendingAttributionBlocked.blocked[0].blockCodes.includes(
  "source_license_obligations_unfulfilled",
))

// A caller cannot replace the structured attribution with invented metadata,
// even if it recomputes a syntactically valid SHA-256 for the forged payload.
const forgedNoticeBase = scienceCandidate()
const authenticNotice = forgedNoticeBase.licenseCompliance.attribution.noticePayload
assert.ok(authenticNotice)
const forgedNoticePayload = {
  ...authenticNotice,
  sourceTitle: "Forged source title",
}
const forgedNoticeCompliance = {
  ...forgedNoticeBase.licenseCompliance,
  attribution: {
    status: "satisfied" as const,
    noticePayload: forgedNoticePayload,
    noticeSha256: dnaV3LicenseNoticePayloadSha256(forgedNoticePayload),
  },
}
const forgedNoticeCandidate: DnaV3ScienceReleaseCandidate = {
  ...forgedNoticeBase,
  licenseCompliance: forgedNoticeCompliance,
  provenance: createDnaV3ScienceSupportProvenance({
    sourceId: forgedNoticeBase.sourceId,
    sourceSha256: forgedNoticeBase.sourceSha256,
    passageId: forgedNoticeBase.passageId,
    passageSha256: forgedNoticeBase.passageSha256,
    passageSourceId: forgedNoticeBase.passageSourceId,
    passageComponentId: forgedNoticeBase.passageComponentId,
    componentId: forgedNoticeBase.componentId,
    componentSha256: forgedNoticeBase.componentSha256,
    componentSourceId: forgedNoticeBase.componentSourceId,
    claimId: forgedNoticeBase.claimId,
    claimSha256: forgedNoticeBase.claimSha256,
    licenseComponent: forgedNoticeBase.licenseComponent,
    identity: forgedNoticeBase.identity,
    license: forgedNoticeBase.license,
    licenseCompliance: forgedNoticeCompliance,
    priority: forgedNoticeBase.priority,
  }),
}
const forgedNoticeBlocked = compileDnaV3ReleasePackage({
  candidates: [forgedNoticeCandidate],
  coverageCells: [RELEASE_CELL],
})
assert.ok(forgedNoticeBlocked.blocked[0].blockCodes.includes(
  "source_license_obligations_unfulfilled",
))

const shareAlikeBase = scienceCandidate()
const shareAlikeLicense: DnaSourceLicenseRecord = {
  ...shareAlikeBase.license,
  declaredLicense: "CC BY-SA 4.0",
  policy: "cc_by_sa",
  obligations: {
    attributionRequired: true,
    shareAlikeRequired: true,
  },
}
const shareAlikeAttribution = createDnaV3AttributionNoticePayload({
  identity: shareAlikeBase.identity,
  license: shareAlikeLicense,
  licenseComponent: shareAlikeBase.licenseComponent,
  noticeText: "Release compiler test source — Test Author (2026), CC BY-SA 4.0.",
})
const shareAlikeNotice = createDnaV3ShareAlikeNoticePayload({
  identity: shareAlikeBase.identity,
  license: shareAlikeLicense,
  licenseComponent: shareAlikeBase.licenseComponent,
  noticeText: "Çıktı CC BY-SA 4.0 koşullarıyla paylaşılır.",
})
const shareAlikeCompliance = {
  attribution: {
    status: "satisfied" as const,
    noticePayload: shareAlikeAttribution,
    noticeSha256: dnaV3LicenseNoticePayloadSha256(shareAlikeAttribution),
  },
  shareAlike: {
    status: "satisfied" as const,
    releaseLicensePolicy: "cc_by_sa" as const,
    noticePayload: shareAlikeNotice,
    noticeSha256: dnaV3LicenseNoticePayloadSha256(shareAlikeNotice),
  },
}
const shareAlikeCandidate: DnaV3ScienceReleaseCandidate = {
  ...shareAlikeBase,
  license: shareAlikeLicense,
  licenseCompliance: shareAlikeCompliance,
  provenance: createDnaV3ScienceSupportProvenance({
    sourceId: shareAlikeBase.sourceId,
    sourceSha256: shareAlikeBase.sourceSha256,
    passageId: shareAlikeBase.passageId,
    passageSha256: shareAlikeBase.passageSha256,
    passageSourceId: shareAlikeBase.passageSourceId,
    passageComponentId: shareAlikeBase.passageComponentId,
    componentId: shareAlikeBase.componentId,
    componentSha256: shareAlikeBase.componentSha256,
    componentSourceId: shareAlikeBase.componentSourceId,
    claimId: shareAlikeBase.claimId,
    claimSha256: shareAlikeBase.claimSha256,
    licenseComponent: shareAlikeBase.licenseComponent,
    identity: shareAlikeBase.identity,
    license: shareAlikeLicense,
    licenseCompliance: shareAlikeCompliance,
    priority: shareAlikeBase.priority,
  }),
}
const shareAlikeChecked = compileDnaV3ReleasePackage({
  candidates: [shareAlikeCandidate],
  coverageCells: [RELEASE_CELL],
})
assert.equal(
  shareAlikeChecked.blocked[0].blockCodes.includes("source_license_obligations_unfulfilled"),
  false,
)

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
  candidates: [productCandidate()],
  coverageCells: [RELEASE_CELL],
})
assert.equal(productDeferred.releaseCount, 0)
assert.ok(productDeferred.blocked[0].blockCodes.includes("owner_book_deferred"))
assert.match(productDeferred.blocked[0].authorizationDigest, /^[a-f0-9]{64}$/)
assert.equal(
  productDeferred.blocked[0].authorizationDigest,
  dnaV3ReleaseAuthorizationDigest(productCandidate()),
)

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
        artifactPassageSha256: "7".repeat(64),
        canonicalPassageSha256: contentSha256("passage.release.compiler", "passage"),
      }]),
    }]),
  },
  productClaimBindings: Object.freeze([{
    claimId: "claim.release.compiler",
    chapterId: "chapter.release.compiler",
    passageId: "passage.release.compiler",
    artifactPassageSha256: "7".repeat(64),
    passageSha256: contentSha256("passage.release.compiler", "passage"),
  }]),
  releaseEligible: true,
  scientificValidationStatus: "not_established_by_book",
} satisfies DnaOwnerBookLockState

const forgedOwnerLockDifferentApproval = {
  ...forgedOwnerLock,
  approvalRecordId: "approval.forged.compiler.changed",
} satisfies DnaOwnerBookLockState
assert.notEqual(
  dnaV3ReleaseAuthorizationDigest(productCandidate(), forgedOwnerLock),
  dnaV3ReleaseAuthorizationDigest(productCandidate(), forgedOwnerLockDifferentApproval),
  "Owner lock kimliğindeki tek alan değişimi authorization digest'i değiştirmeli",
)

const forgedOwnerBlocked = compileDnaV3ReleasePackage({
  candidates: [productCandidate({ candidateId: "candidate.product.forged-owner" })],
  coverageCells: [RELEASE_CELL],
  ownerBookLock: forgedOwnerLock,
})
assert.equal(forgedOwnerBlocked.releaseCount, 0)
assert.ok(forgedOwnerBlocked.blocked[0].blockCodes.includes("owner_book_lock_invalid"))
assert.ok(forgedOwnerBlocked.blocked[0].blockCodes.includes(
  "owner_artifact_passage_hash_mismatch",
))
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
      canonicalText: "approved owner passage",
    }],
  }],
})
const ownerChapter = ownerManifest.chapters[0]
const ownerPassage = ownerChapter.passages[0]
const unregisteredOwnerCompileInput = {
  manifest: ownerManifest,
  artifactBytes: ownerArtifactBytes,
  canonicalPassageTexts: {
    [ownerPassage.passageId]: "approved owner passage",
  },
  approval: {
    approvalRecordId: "approval.release.compiler",
    approvalStatus: "owner_approved" as const,
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
      artifactPassageSha256: ownerPassage.artifactPassageSha256,
      canonicalPassageSha256: ownerPassage.canonicalPassageSha256,
    }],
  },
  liveProductClaimIds: ["claim.release.compiler"],
  claimBindings: [{
    claimId: "claim.release.compiler",
    chapterId: ownerChapter.chapterId,
    passageId: ownerPassage.passageId,
    artifactPassageSha256: ownerPassage.artifactPassageSha256,
    passageSha256: ownerPassage.canonicalPassageSha256,
  }],
}
assert.equal(DNA_REGISTERED_OWNER_APPROVALS.length, 0)
assert.throws(
  () => compileDnaOwnerBookLock(unregisteredOwnerCompileInput),
  /dna_book_lock_approval_not_registered/,
  "Owner registry boşken pozitif owner lock derlenmemeli",
)

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
  missingClaimReviewBlocked: registryBlocked.blocked[0].blockCodes.includes(
    "claim_review_bundle_missing",
  ),
  missingPublicationCandidateBlocked: registryBlocked.blocked[0].blockCodes.includes(
    "publication_candidate_missing",
  ),
  forgedClaimReviewBlocked: forgedReviewBlocks.includes("claim_review_denied")
    && forgedReviewBlocks.includes("claim_review_binding_mismatch"),
  forgedPublicationCandidateBlocked: forgedReviewBlocks.includes("publication_candidate_denied")
    && forgedReviewBlocks.includes("publication_binding_mismatch"),
  v2LegacyBlocked: legacyBlocked.releaseCount === 0,
  supportProvenanceTamperBlocked: provenanceBlocked.releaseCount === 0,
  contentHashTamperBlocked: payloadHashBlocked.releaseCount === 0,
  foreignLicenseBlocked: foreignLicenseBlocked.releaseCount === 0,
  pendingAttributionBlocked: pendingAttributionBlocked.releaseCount === 0,
  forgedAttributionMetadataBlocked: forgedNoticeBlocked.releaseCount === 0,
  structuredShareAlikeFulfillmentAcceptedByLicenseGate: !shareAlikeChecked.blocked[0]
    .blockCodes.includes("source_license_obligations_unfulfilled"),
  repeatedSourceClaimsConflictFree: repeatedSourceReleased.blocked.every((decision) =>
    !decision.blockCodes.includes("global_content_hash_conflict")),
  globalSourceConflictBlocked: sourceHashConflict.releaseCount === 0,
  sourceProfileConflictBlocked: sourceProfileConflict.releaseCount === 0,
  metadataOnlyBlocked: metadataBlocked.releaseCount === 0,
  deferredBookBlocked: productDeferred.releaseCount === 0,
  forgedOwnerLockBlocked: forgedOwnerBlocked.releaseCount === 0,
  ownerArtifactPassageHashMismatchBlocked: forgedOwnerBlocked.blocked[0].blockCodes.includes(
    "owner_artifact_passage_hash_mismatch",
  ),
  ownerRegistryEmptyBlocksCompilation: DNA_REGISTERED_OWNER_APPROVALS.length === 0,
  deterministicSha256: deterministic,
}))
