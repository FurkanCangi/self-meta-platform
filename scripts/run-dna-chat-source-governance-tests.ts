import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { dirname, resolve } from "node:path"

import {
  DNA_LICENSE_COMPONENTS,
  DNA_SOURCE_GOVERNANCE_VERSION,
  DNA_SOURCE_PRIORITY_MATRIX,
  DNA_SOURCE_QUESTION_TYPES,
  DNA_SOURCE_ROLES,
  assessSourcePriority,
  canSourceSupportClaim,
  canonicalizeDoi,
  canonicalizeIsbn,
  canonicalizePmcid,
  canonicalizePmid,
  canonicalizeSourceIdentifiers,
  classifyDeclaredLicense,
  deduplicateSourceFamilies,
  evaluateComponentRelease,
  isSourceIdentityAndComponentLicenseEligible,
  isSourceIdentityReleaseEligible,
  rankSourcesForQuestion,
  validateComponentLicenseMatrix,
  validateSourceIdentityRecords,
  type DnaCanonicalSourceIdentifiers,
  type DnaComponentLicense,
  type DnaLicenseComponent,
  type DnaLicenseDecision,
  type DnaSourceIdentityRecord,
  type DnaSourceLicenseRecord,
  type DnaSourcePriorityInput,
} from "../src/lib/dna/chat/governance/sourceGovernance"

const DEFAULT_LIBRARY_ROOT =
  "/Volumes/ResearchSSD/Datasets/SelfMetaAI/dna-knowledge/source-library"
const SNAPSHOT_PATH = resolve(
  process.cwd(),
  "docs/dna-intelligence/governance/v3/source-library-governance-snapshot.json",
)

type JsonRecord = Record<string, unknown>

function readJson(path: string): JsonRecord {
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function dateOnly(value: unknown): string {
  const match = String(value ?? "").match(/^\d{4}-\d{2}-\d{2}/)
  assert.ok(match, `invalid manifest date: ${String(value)}`)
  return match[0]
}

function asArray(value: unknown): JsonRecord[] {
  assert.ok(Array.isArray(value))
  return value as JsonRecord[]
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function sourceRecordIdentity(record: JsonRecord): {
  id: string
  title: string
  authors: string[]
  year: number
  venue: string | null
  identifiers: DnaCanonicalSourceIdentifiers
} {
  const bibliography = (record.bibliography ?? {}) as JsonRecord
  const identifiers = (record.identifiers ?? {}) as JsonRecord
  const id = String(record.id ?? record.slug ?? "")
  const title = String(record.title ?? bibliography.title ?? "")
  const authorValue = record.authors ?? bibliography.authors
  const authors = Array.isArray(authorValue) ? authorValue.map(String) : []
  const year = Number(record.year ?? bibliography.year ?? 0)
  const venue = stringOrNull(
    bibliography.venue
      ?? bibliography.journal
      ?? record.venue,
  )
  assert.ok(id && title && year)
  return {
    id,
    title,
    authors,
    year,
    venue,
    identifiers: canonicalizeSourceIdentifiers({
      doi: stringOrNull(record.doi ?? bibliography.doi ?? identifiers.doi),
      pmid: stringOrNull(record.pmid ?? bibliography.pmid ?? identifiers.pmid),
      pmcid: stringOrNull(record.pmcid ?? bibliography.pmcid ?? identifiers.pmcid),
      isbn: stringOrNull(record.isbn ?? bibliography.isbn ?? identifiers.isbn),
    }),
  }
}

function buildSnapshot(root: string): JsonRecord {
  const manifests = [
    "manifests/verification-report.json",
    "manifests/online-source-verification.json",
    "manifests/categories.json",
    "manifests/category-aliases.json",
    "manifests/category-resolution-report.json",
    "restricted-metadata/sources.json",
    "governance-audit/v1/raw-online-identity-responses.json",
    "governance-audit/v1/identity-audit.json",
    "governance-audit/v1/priority-input-audit.json",
    "governance-audit/v1/component-license-audit.json",
    "governance-audit/v1/audit-summary.json",
  ] as const
  const manifestRows = manifests.map((relativePath) => {
    const absolutePath = resolve(root, relativePath)
    const json = readJson(absolutePath)
    return {
      relativePath,
      schemaVersion: String(json.schemaVersion),
      generatedAt: typeof json.generatedAt === "string" ? json.generatedAt : null,
      sha256: sha256File(absolutePath),
    }
  })

  const verification = readJson(resolve(root, manifests[0]))
  const online = readJson(resolve(root, manifests[1]))
  const categories = readJson(resolve(root, manifests[2]))
  const categoryResolution = readJson(resolve(root, manifests[4]))
  const restrictedIndex = readJson(resolve(root, manifests[5]))
  const identityAudit = readJson(resolve(root, manifests[7]))
  const priorityAudit = readJson(resolve(root, manifests[8]))
  const licenseAudit = readJson(resolve(root, manifests[9]))
  const auditSummary = readJson(resolve(root, manifests[10]))
  const verificationCounts = verification.counts as JsonRecord
  const onlineScope = online.scope as JsonRecord
  const onlineSummary = online.summary as JsonRecord
  const categoryCounts = categoryResolution.counts as JsonRecord
  const sourceRows = asArray(verification.sources)
  const restrictedRows = asArray(restrictedIndex.sources)
  const onlineRows = asArray(online.records)
  const onlineByDoi = new Map(onlineRows.map((row) => [
    canonicalizeDoi(String(row.normalizedDoi ?? row.doi ?? "")),
    row,
  ]))

  const manifestIdentityRecords: DnaSourceIdentityRecord[] = []
  for (const source of sourceRows) {
    const recordPath = String(source.recordPath)
    const local = readJson(resolve(root, recordPath))
    const localIdentity = sourceRecordIdentity(local)
    assert.equal(localIdentity.id, source.id, `${recordPath}: source id mismatch`)
    assert.equal(localIdentity.title, source.title, `${recordPath}: title mismatch`)
    assert.equal(localIdentity.year, source.year, `${recordPath}: year mismatch`)
    const manifestIdentifiers = canonicalizeSourceIdentifiers({
      doi: stringOrNull(source.doi),
      pmid: stringOrNull(source.pmid),
      pmcid: stringOrNull(source.pmcid),
      isbn: stringOrNull(source.isbn),
    })
    assert.deepEqual(localIdentity.identifiers, manifestIdentifiers, `${recordPath}: identifier mismatch`)
    if (manifestIdentifiers.doi) {
      const onlineRecord = onlineByDoi.get(manifestIdentifiers.doi)
      assert.ok(onlineRecord, `${recordPath}: DOI has no online identity record`)
      assert.equal(onlineRecord.status, "verified_match")
      assert.equal(onlineRecord.recordId, source.id)
    }
    manifestIdentityRecords.push({
      sourceId: String(source.id),
      workId: `work:${String(source.id)}`,
      versionId: `version:${String(source.id)}:published`,
      versionStatus: "unknown",
      publicationRole: "other",
      correctionOfWorkId: null,
      correctionResolution: "not_applicable",
      correctionRelations: [],
      cohortFamilyId: null,
      cohortResolution: "unknown",
      bibliography: {
        title: localIdentity.title,
        authors: localIdentity.authors,
        year: localIdentity.year,
        venue: localIdentity.venue,
      },
      verifiedBibliography: {
        title: String(source.title),
        authors: localIdentity.authors,
        year: Number(source.year),
        venue: localIdentity.venue,
      },
      identifiers: manifestIdentifiers,
      verifiedIdentifiers: manifestIdentifiers,
      identityVerification: {
        status: "pending",
        authority: manifestIdentifiers.doi
          ? "doi_verified_but_complete_cross_identifier_audit_pending"
          : "local_manifest_only",
        verifiedAt: dateOnly(manifestIdentifiers.doi ? online.generatedAt : verification.generatedAt),
        evidenceSha256: manifestIdentifiers.doi ? manifestRows[1].sha256 : manifestRows[0].sha256,
      },
    })
  }

  for (const source of restrictedRows) {
    const identifiers = canonicalizeSourceIdentifiers({
      doi: stringOrNull(source.doi),
      pmid: stringOrNull(source.pmid),
      pmcid: stringOrNull(source.pmcid),
      isbn: stringOrNull(source.isbn),
    })
    if (identifiers.doi) {
      const onlineRecord = onlineByDoi.get(identifiers.doi)
      assert.ok(onlineRecord, `${String(source.id)}: DOI has no online identity record`)
      assert.equal(onlineRecord.status, "verified_match")
      assert.equal(onlineRecord.recordId, source.id)
    }
    manifestIdentityRecords.push({
      sourceId: String(source.id),
      workId: `work:${String(source.id)}`,
      versionId: `version:${String(source.id)}:published`,
      versionStatus: "unknown",
      publicationRole: "other",
      correctionOfWorkId: null,
      correctionResolution: "not_applicable",
      correctionRelations: [],
      cohortFamilyId: null,
      cohortResolution: "unknown",
      bibliography: {
        title: String(source.title),
        authors: Array.isArray(source.authors) ? source.authors.map(String) : [],
        year: Number(source.year),
        venue: stringOrNull(source.venue),
      },
      verifiedBibliography: {
        title: String(source.title),
        authors: Array.isArray(source.authors) ? source.authors.map(String) : [],
        year: Number(source.year),
        venue: stringOrNull(source.venue),
      },
      identifiers,
      verifiedIdentifiers: identifiers,
      identityVerification: {
        status: "pending",
        authority: identifiers.doi
          ? "doi_verified_but_complete_cross_identifier_audit_pending"
          : "restricted_metadata_local_manifest_only",
        verifiedAt: dateOnly(identifiers.doi ? online.generatedAt : restrictedIndex.retrievedAt),
        evidenceSha256: identifiers.doi ? manifestRows[1].sha256 : manifestRows[5].sha256,
      },
    })
  }

  manifestIdentityRecords.sort((left, right) => left.sourceId.localeCompare(right.sourceId))
  assert.equal(validateSourceIdentityRecords(manifestIdentityRecords).ok, true)
  const manifestBySource = new Map(manifestIdentityRecords.map((record) => [record.sourceId, record]))

  const identityRecords = asArray(identityAudit.records).map((row) => {
    const { audit: _audit, ...record } = row
    return record as DnaSourceIdentityRecord
  }).sort((left, right) => left.sourceId.localeCompare(right.sourceId))
  assert.equal(identityRecords.length, manifestIdentityRecords.length)
  for (const record of identityRecords) {
    const manifestRecord = manifestBySource.get(record.sourceId)
    assert.ok(manifestRecord, `${record.sourceId}: audited identity has no manifest source`)
    assert.deepEqual(record.identifiers, manifestRecord.identifiers, `${record.sourceId}: audit changed local identifiers`)
  }
  const identityValidation = validateSourceIdentityRecords(identityRecords)
  assert.equal(identityValidation.ok, true, identityValidation.errors.join("\n"))

  const priorityInputs = asArray(priorityAudit.records).map((row) => ({
    sourceId: String(row.sourceId),
    role: row.role as DnaSourcePriorityInput["role"],
    population: row.population as DnaSourcePriorityInput["population"],
    ageScope: row.ageScope as DnaSourcePriorityInput["ageScope"],
    sampleScope: row.sampleScope as DnaSourcePriorityInput["sampleScope"],
    psychometricRole: (row.psychometricRole ?? null) as DnaSourcePriorityInput["psychometricRole"],
    publicationVersion: row.publicationVersion as DnaSourcePriorityInput["publicationVersion"],
  })).sort((left, right) => left.sourceId.localeCompare(right.sourceId))
  assert.equal(priorityInputs.length, identityRecords.length)
  assert.deepEqual(priorityInputs.map((row) => row.sourceId), identityRecords.map((row) => row.sourceId))
  const priorityRecords = priorityInputs.map((source) => ({
    ...source,
    decisions: Object.fromEntries(DNA_SOURCE_QUESTION_TYPES.map((questionType) => {
      const decision = assessSourcePriority(source, questionType)
      return [questionType, {
        grade: decision.grade,
        supportsScientificClaim: decision.supportsScientificClaim,
        boundaryCode: decision.boundaryCode,
      }]
    })),
  }))

  const licenseRecords = asArray(licenseAudit.records).map((row) => {
    const { audit: _audit, ...record } = row
    return record as DnaSourceLicenseRecord
  }).sort((left, right) => left.sourceId.localeCompare(right.sourceId))
  assert.equal(licenseRecords.length, identityRecords.length)
  assert.deepEqual(licenseRecords.map((row) => row.sourceId), identityRecords.map((row) => row.sourceId))
  for (const record of licenseRecords) {
    const validation = validateComponentLicenseMatrix(record)
    assert.equal(validation.ok, true, validation.errors.join("\n"))
  }
  const licenseRecordSummary = licenseRecords.map((record) => ({
    sourceId: record.sourceId,
    policy: record.policy,
    obligations: record.obligations,
    matrixSha256: createHash("sha256").update(JSON.stringify(record)).digest("hex"),
    decisions: Object.fromEntries(record.components.map((component) => [
      component.component,
      component.decision,
    ])),
    evidenceBasis: Object.fromEntries(record.components.map((component) => [
      component.component,
      component.evidence.basis,
    ])),
  }))

  const ledgerSummary = auditSummary.ledgers as JsonRecord
  const expectedLedgerHashes = new Map<string, string>(
    manifestRows.map((row) => [row.relativePath, row.sha256]),
  )
  for (const ledger of Object.values(ledgerSummary) as JsonRecord[]) {
    assert.equal(expectedLedgerHashes.get(String(ledger.path)), ledger.sha256)
  }
  const auditCounts = auditSummary.counts as JsonRecord
  const identityCounts = auditCounts.identity as JsonRecord
  const identityEligible = identityRecords.filter((record) =>
    isSourceIdentityReleaseEligible(record, identityRecords)).length
  const licenseFullTextEligible = licenseRecords.filter((record) =>
    evaluateComponentRelease(record, "full_text").allowed).length
  const licensePassageEligible = licenseRecords.filter((record) =>
    evaluateComponentRelease(record, "passage").allowed).length
  const correctionPending = identityRecords.filter((record) =>
    record.correctionResolution === "pending").length
  const ageScopePending = priorityInputs.filter((record) =>
    record.ageScope === "not_reported").length
  const sampleScopePending = priorityInputs.filter((record) =>
    record.sampleScope === "not_reported").length

  return {
    schemaVersion: "dna-source-library-governance-snapshot@1",
    governanceVersion: DNA_SOURCE_GOVERNANCE_VERSION,
    snapshotBasisAt: auditSummary.auditedAt,
    rootPolicy: "ResearchSSD_only_no_runtime_absolute_path_dependency",
    manifests: manifestRows,
    counts: {
      sourceRecords: Number(verificationCounts.sourceRecords),
      restrictedMetadataSources: Number(verificationCounts.restrictedMetadataSources),
      totalMetadataRecords: sourceRows.length + restrictedRows.length,
      pdfFiles: Number(verificationCounts.pdfFiles),
      pdfPages: Number(verificationCounts.pdfPages),
      pdfBytes: Number(verificationCounts.pdfBytes),
      jatsXmlFiles: Number(verificationCounts.jatsXmlFiles),
      allXmlFiles: Number(verificationCounts.allXmlFiles),
      epubFiles: Number(verificationCounts.epubFiles),
      canonicalCategories: asArray(categories.categories).length,
      doiRecords: Number(onlineScope.doiRecords),
      uniqueDois: Number(onlineScope.uniqueDois),
      verifiedDoiMatches: Number(onlineSummary.verifiedMatch),
      duplicateDoiRecords: Number(onlineScope.duplicateDoiRecords),
      unresolvedCategories: Number(categoryCounts.unresolvedRawCategories),
    },
    sourceRecordSchemas: {
      "dna-source@1": 21,
      "dna-source-record@1": 6,
      "dna-source-audit@1": 9,
    },
    identityState: {
      canonicalMetadataRecords: identityRecords.length,
      fullyCrossIdentifierVerifiedRecords: Number(identityCounts.verified),
      pendingIdentityRecords: Number(identityCounts.pending),
      mismatchIdentityRecords: Number(identityCounts.mismatch),
      workVersionCorrectionCohortAuditedRecords: identityRecords.length,
      pendingCorrectionResolutionRecords: correctionPending,
      identityEligibleRecords: identityEligible,
      runtimeReleasedRecords: 0,
      reason: "Authority-backed metadata identity may pass while lifecycle, claim provenance and scientific audit still block runtime release.",
    },
    priorityState: {
      normalizedQuestionSpecificPriorityRecords: priorityRecords.length,
      pendingAgeScopeRecords: ageScopePending,
      pendingSampleScopeRecords: sampleScopePending,
      runtimeScienceEligibleRecords: 0,
      reason: "All sources have deterministic question-specific A-E inputs; population-unknown/mixed evidence remains fail-closed and no source has claim-level multi-pass release approval.",
    },
    licenseState: {
      componentMatricesCompleted: Number(auditCounts.componentMatricesCompleted),
      componentsAudited: Number(auditCounts.componentsAudited),
      licenseEligibleFullTextRecords: licenseFullTextEligible,
      licenseEligiblePassageRecords: licensePassageEligible,
      runtimeReleasedFullTextRecords: 0,
      runtimeReleasedPassageRecords: 0,
      defaultRestrictedComponents: ["table", "figure", "scale", "test_items"],
      restrictedMetadataRecords: restrictedRows.length,
      decisionCounts: auditCounts.licenseDecisionCounts,
      evidenceBasisCounts: Object.fromEntries(licenseRecords.flatMap((record) =>
        record.components.map((component) => component.evidence.basis))
        .sort().reduce((counts, basis) => {
          counts.set(basis, (counts.get(basis) ?? 0) + 1)
          return counts
        }, new Map<string, number>())),
      reason: "Component clearance is only a licence gate; identity, lifecycle, priority, coverage and provenance gates remain mandatory for runtime release.",
    },
    identityRecords,
    priorityRecords,
    licenseRecords: licenseRecordSummary,
    contentPolicy: {
      includesFullText: false,
      includesAbstracts: false,
      includesPassages: false,
      includesTablesOrFigures: false,
      includesScaleOrTestItems: false,
    },
  }
}

function makePrioritySource(overrides: Partial<DnaSourcePriorityInput> = {}): DnaSourcePriorityInput {
  return {
    sourceId: "source.systematic.human",
    role: "systematic_review_meta_analysis",
    population: "human",
    ageScope: "all_ages",
    sampleScope: "general_population",
    psychometricRole: null,
    ...overrides,
  }
}

function makeIdentity(overrides: Partial<DnaSourceIdentityRecord> = {}): DnaSourceIdentityRecord {
  const identifiers = canonicalizeSourceIdentifiers({
    doi: "10.1234/example.1",
    pmid: "12345678",
    pmcid: "PMC1234567",
    isbn: "9781922365521",
  })
  return {
    sourceId: "source.identity.one",
    workId: "work.identity.one",
    versionId: "version.identity.one.vor",
    versionStatus: "version_of_record",
    publicationRole: "article",
    correctionOfWorkId: null,
    correctionResolution: "not_applicable",
    correctionRelations: [],
    cohortFamilyId: null,
    cohortResolution: "not_applicable",
    bibliography: {
      title: "Canonical source title",
      authors: ["Example Author"],
      year: 2024,
      venue: "Example Journal",
    },
    verifiedBibliography: {
      title: "Canonical source title",
      authors: ["Example Author"],
      year: 2024,
      venue: "Example Journal",
    },
    identifiers,
    verifiedIdentifiers: identifiers,
    identityVerification: {
      status: "verified",
      authority: "test_authority",
      verifiedAt: "2026-07-19",
      evidenceSha256: "a".repeat(64),
    },
    ...overrides,
  }
}

function makeComponent(
  component: DnaLicenseComponent,
  decision: DnaLicenseDecision,
  overrides: Partial<DnaComponentLicense> = {},
): DnaComponentLicense {
  return {
    component,
    decision,
    commercialUse: decision === "cleared" ? "allowed" : "unknown",
    adaptation: decision === "cleared" ? "allowed" : "unknown",
    textAndDataMining: decision === "cleared" ? "allowed" : "unknown",
    redisplay: decision === "cleared" ? "allowed" : "unknown",
    thirdPartyMaterialReviewed: false,
    evidence: {
      sourceId: "source.identity.one",
      url: "https://creativecommons.org/licenses/by/4.0/",
      checkedAt: "2026-07-19",
      sha256: "b".repeat(64),
      basis: "verified_in_artifact",
      artifactRelativePath: "evidence/test/source.pdf",
    },
    ...overrides,
  }
}

function makeLicense(
  declaredLicense = "CC BY 4.0",
  overrides: Partial<Record<DnaLicenseComponent, DnaComponentLicense>> = {},
): DnaSourceLicenseRecord {
  return {
    sourceId: "source.identity.one",
    declaredLicense,
    policy: classifyDeclaredLicense(declaredLicense),
    obligations: {
      attributionRequired: ["cc_by", "cc_by_sa", "cc_by_with_exceptions"].includes(classifyDeclaredLicense(declaredLicense)),
      shareAlikeRequired: classifyDeclaredLicense(declaredLicense) === "cc_by_sa",
    },
    components: DNA_LICENSE_COMPONENTS.map((component) =>
      overrides[component] ?? makeComponent(
        component,
        component === "metadata" ? "cleared" : "unknown",
      )),
  }
}

function runPriorityTests() {
  for (const questionType of DNA_SOURCE_QUESTION_TYPES) {
    for (const role of DNA_SOURCE_ROLES) {
      const decision = assessSourcePriority(makePrioritySource({ role }), questionType)
      const matrixGrade = DNA_SOURCE_PRIORITY_MATRIX[questionType][role]
      const expectedGrade = questionType === "measurement"
        ? (["theory_exposition", "theory_critique", "preprint"].includes(role) ? "D" : "E")
        : matrixGrade
      assert.equal(decision.grade, expectedGrade)
      if (decision.grade === "D") {
        assert.equal(decision.supportsScientificClaim, false)
        assert.deepEqual(decision.permittedClaimModes, ["theory_only", "contested"])
      }
      if (decision.grade === "E") {
        assert.equal(decision.supportsScientificClaim, false)
        assert.deepEqual(decision.permittedClaimModes, [])
      }
    }
  }

  const measurementWithoutPsychometrics = assessSourcePriority(
    makePrioritySource({ role: "psychometric_validation", psychometricRole: null }),
    "measurement",
  )
  assert.equal(measurementWithoutPsychometrics.grade, "E")
  assert.equal(measurementWithoutPsychometrics.boundaryCode, "measurement_requires_psychometric_role")
  const measurementWithPsychometrics = assessSourcePriority(
    makePrioritySource({ role: "psychometric_validation", psychometricRole: "validity" }),
    "measurement",
  )
  assert.equal(measurementWithPsychometrics.grade, "A")
  assert.equal(measurementWithPsychometrics.supportsScientificClaim, true)

  const human = makePrioritySource({ sourceId: "human", role: "human_experimental", population: "human" })
  const animal = makePrioritySource({ sourceId: "animal", role: "animal_mechanistic", population: "animal" })
  const mixed = makePrioritySource({ sourceId: "mixed", role: "systematic_review_meta_analysis", population: "mixed_human_animal" })
  assert.equal(canSourceSupportClaim({ source: human, questionType: "mechanism", claimMode: "scientific_evidence", mechanismPopulation: "human" }), true)
  assert.equal(canSourceSupportClaim({ source: animal, questionType: "mechanism", claimMode: "scientific_evidence", mechanismPopulation: "human" }), false)
  assert.equal(canSourceSupportClaim({ source: animal, questionType: "mechanism", claimMode: "scientific_evidence", mechanismPopulation: "animal" }), true)
  assert.equal(assessSourcePriority(mixed, "mechanism").grade, "E")
  for (const questionType of ["association", "intervention_evidence"] as const) {
    assert.equal(canSourceSupportClaim({ source: human, questionType, claimMode: "scientific_evidence", claimPopulation: "human" }), true)
    assert.equal(canSourceSupportClaim({ source: animal, questionType, claimMode: "scientific_evidence", claimPopulation: "human" }), false)
    assert.equal(canSourceSupportClaim({ source: makePrioritySource({ population: "not_reported" }), questionType, claimMode: "scientific_evidence", claimPopulation: "human" }), false)
  }
  for (const questionType of ["development", "case_interpretation"] as const) {
    assert.equal(canSourceSupportClaim({ source: human, questionType, claimMode: "scientific_evidence", claimPopulation: "human" }), false)
    assert.equal(canSourceSupportClaim({
      source: human,
      questionType,
      claimMode: "scientific_evidence",
      claimPopulation: "human",
      claimAgeScope: "pediatric",
      claimSampleScope: "general_population",
    }), true)
  }
  const measurement = makePrioritySource({
    sourceId: "measurement",
    role: "psychometric_validation",
    psychometricRole: "validity",
    population: "human",
    ageScope: "adult",
    sampleScope: "measurement_validation_sample",
  })
  assert.equal(canSourceSupportClaim({
    source: measurement,
    questionType: "measurement",
    claimMode: "scientific_evidence",
    claimPopulation: "human",
    claimAgeScope: "adult",
    claimSampleScope: "measurement_validation_sample",
  }), true)
  assert.equal(canSourceSupportClaim({
    source: measurement,
    questionType: "measurement",
    claimMode: "scientific_evidence",
    claimPopulation: "human",
    claimAgeScope: "pediatric",
    claimSampleScope: "measurement_validation_sample",
  }), false)
  assert.equal(canSourceSupportClaim({
    source: measurement,
    questionType: "measurement",
    claimMode: "scientific_evidence",
    claimPopulation: "human",
    claimAgeScope: "adult",
    claimSampleScope: "clinical_population",
  }), false)
  assert.equal(canSourceSupportClaim({
    source: measurement,
    questionType: "measurement",
    claimMode: "scientific_evidence",
    claimPopulation: "human",
  }), false)
  assert.equal(canSourceSupportClaim({
    source: makePrioritySource({ ageScope: "not_reported" }),
    questionType: "definition",
    claimMode: "scientific_evidence",
    claimAgeScope: "adult",
  }), false)
  assert.equal(canSourceSupportClaim({
    source: makePrioritySource({ ageScope: "adult" }),
    questionType: "definition",
    claimMode: "scientific_evidence",
    claimAgeScope: "adult",
  }), true)

  const theory = makePrioritySource({ sourceId: "theory", role: "theory_exposition" })
  assert.equal(canSourceSupportClaim({ source: theory, questionType: "controversy", claimMode: "scientific_evidence" }), false)
  assert.equal(canSourceSupportClaim({ source: theory, questionType: "controversy", claimMode: "theory_only" }), true)
  const metadata = makePrioritySource({ sourceId: "metadata", role: "metadata_only" })
  assert.equal(canSourceSupportClaim({ source: metadata, questionType: "definition", claimMode: "scientific_evidence" }), false)
  assert.equal(assessSourcePriority(makePrioritySource({ role: "textbook" }), "definition").grade, "C")
  assert.equal(assessSourcePriority(makePrioritySource({ role: "narrative_review" }), "definition").grade, "C")
  assert.equal(assessSourcePriority(makePrioritySource({ role: "preprint" }), "definition").grade, "D")
  assert.equal(assessSourcePriority(makePrioritySource({ role: "human_experimental", publicationVersion: "preprint" }), "mechanism").grade, "D")
  assert.equal(assessSourcePriority(makePrioritySource({ role: "blog_or_marketing" }), "definition").grade, "E")
  assert.equal(assessSourcePriority(makePrioritySource({ role: "social_media" }), "definition").grade, "E")

  const rankedA = rankSourcesForQuestion([metadata, theory, animal, human], "mechanism")
  const rankedB = rankSourcesForQuestion([metadata, theory, animal, human], "mechanism")
  assert.deepEqual(rankedA, rankedB)
  assert.deepEqual(rankedA.map((row) => row.grade), ["A", "C", "D", "E"])
}

function runIdentityTests(snapshot: JsonRecord) {
  assert.equal(canonicalizeDoi("https://doi.org/10.1113/JP284740"), "10.1113/jp284740")
  assert.equal(canonicalizePmid("PMID: 38873876"), "38873876")
  assert.equal(canonicalizePmcid("https://pmc.ncbi.nlm.nih.gov/articles/PMC11539922/"), "PMC11539922")
  assert.equal(canonicalizeIsbn("978-1-922365-52-1"), "9781922365521")
  assert.throws(() => canonicalizeDoi("not-a-doi"), /invalid_doi/)
  assert.throws(() => canonicalizePmid("12A"), /invalid_pmid/)
  assert.throws(() => canonicalizePmcid("PMCX"), /invalid_pmcid/)
  assert.throws(() => canonicalizeIsbn("9781922365520"), /invalid_isbn/)

  const base = makeIdentity()
  assert.equal(validateSourceIdentityRecords([base]).ok, true)
  assert.equal(isSourceIdentityReleaseEligible(base), true)
  for (const kind of ["doi", "pmid", "pmcid", "isbn"] as const) {
    const duplicate = makeIdentity({
      sourceId: `source.identity.duplicate.${kind}`,
      workId: `work.identity.duplicate.${kind}`,
      versionId: `version.identity.duplicate.${kind}`,
    })
    const result = validateSourceIdentityRecords([base, duplicate])
    assert.equal(result.ok, false)
    assert.ok(result.errors.some((error) => error.includes(`duplicate_${kind}`)))
  }

  const mismatch = makeIdentity({
    verifiedIdentifiers: canonicalizeSourceIdentifiers({
      doi: "10.1234/different",
      pmid: "12345678",
      pmcid: "PMC1234567",
      isbn: "9781922365521",
    }),
  })
  assert.ok(validateSourceIdentityRecords([mismatch]).errors.some((error) => error.includes("identifier_mismatch_doi")))
  const titleMismatch = makeIdentity({
    verifiedBibliography: { title: "Different title", authors: ["Example Author"], year: 2024, venue: "Example Journal" },
  })
  assert.ok(validateSourceIdentityRecords([titleMismatch]).errors.some((error) => error.includes("bibliography_mismatch_title")))
  const yearMismatch = makeIdentity({
    verifiedBibliography: { title: "Canonical source title", authors: ["Example Author"], year: 2023, venue: "Example Journal" },
  })
  assert.ok(validateSourceIdentityRecords([yearMismatch]).errors.some((error) => error.includes("bibliography_mismatch_year")))
  const venueMismatch = makeIdentity({
    verifiedBibliography: { title: "Canonical source title", authors: ["Example Author"], year: 2024, venue: "Different Journal" },
  })
  assert.ok(validateSourceIdentityRecords([venueMismatch]).errors.some((error) => error.includes("bibliography_mismatch_venue")))
  const missingCohort = makeIdentity({ cohortResolution: "resolved", cohortFamilyId: null })
  assert.ok(validateSourceIdentityRecords([missingCohort]).errors.some((error) => error.includes("missing_cohort_family")))
  const orphanCorrection = makeIdentity({
    publicationRole: "correction_notice",
    correctionOfWorkId: "work.identity.missing",
    correctionResolution: "resolved",
    correctionRelations: [{
      direction: "corrects",
      relationType: "is-correction-of",
      targetDoi: base.identifiers.doi!,
      targetSourceId: base.sourceId,
    }],
  })
  assert.ok(validateSourceIdentityRecords([base, orphanCorrection]).errors.some((error) => error.includes("missing_corrected_work")))

  const preprint = makeIdentity({
    sourceId: "source.identity.preprint",
    workId: "work.identity.publication",
    versionId: "version.identity.preprint",
    versionStatus: "preprint",
    identifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/preprint" }),
    verifiedIdentifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/preprint" }),
  })
  const versionOfRecord = makeIdentity({
    sourceId: "source.identity.vor",
    workId: "work.identity.publication",
    versionId: "version.identity.vor",
    identifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/vor" }),
    verifiedIdentifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/vor" }),
  })
  const correction = makeIdentity({
    sourceId: "source.identity.correction",
    workId: "work.identity.correction",
    versionId: "version.identity.correction",
    publicationRole: "correction_notice",
    correctionOfWorkId: base.workId,
    correctionResolution: "resolved",
    correctionRelations: [{
      direction: "corrects",
      relationType: "is-correction-of",
      targetDoi: base.identifiers.doi!,
      targetSourceId: base.sourceId,
    }],
    identifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/correction" }),
    verifiedIdentifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/correction" }),
  })
  assert.equal(validateSourceIdentityRecords([base, correction]).ok, true)
  assert.equal(isSourceIdentityReleaseEligible(correction, [base, correction]), false)
  const unresolvedIncomingCorrection = makeIdentity({
    correctionResolution: "pending",
    correctionRelations: [{
      direction: "is_corrected_by",
      relationType: "is-corrected-by",
      targetDoi: "10.1234/external.correction",
      targetSourceId: null,
    }],
  })
  assert.equal(validateSourceIdentityRecords([unresolvedIncomingCorrection]).ok, true)
  assert.equal(isSourceIdentityReleaseEligible(unresolvedIncomingCorrection), false)
  const falselyResolvedIncomingCorrection = makeIdentity({
    correctionResolution: "resolved",
    correctionRelations: [{
      direction: "is_corrected_by",
      relationType: "is-corrected-by",
      targetDoi: "10.1234/external.correction",
      targetSourceId: null,
    }],
  })
  assert.ok(validateSourceIdentityRecords([falselyResolvedIncomingCorrection]).errors.some((error) =>
    error.includes("unresolved_correction_relation")))
  const unincorporatedIncomingCorrection = makeIdentity({
    correctionResolution: "resolved",
    correctionRelations: [{
      direction: "is_corrected_by",
      relationType: "is-corrected-by",
      targetDoi: correction.identifiers.doi!,
      targetSourceId: correction.sourceId,
    }],
  })
  assert.equal(validateSourceIdentityRecords([unincorporatedIncomingCorrection, correction]).ok, true)
  assert.equal(isSourceIdentityReleaseEligible(unincorporatedIncomingCorrection, [unincorporatedIncomingCorrection, correction]), false)
  const incorporatedIncomingCorrection = makeIdentity({
    versionStatus: "corrected",
    correctionResolution: "resolved",
    correctionRelations: [{
      direction: "is_corrected_by",
      relationType: "is-corrected-by",
      targetDoi: correction.identifiers.doi!,
      targetSourceId: correction.sourceId,
    }],
  })
  assert.equal(isSourceIdentityReleaseEligible(incorporatedIncomingCorrection, [incorporatedIncomingCorrection, correction]), true)
  const correctedArticle = makeIdentity({
    sourceId: "source.identity.corrected.article",
    workId: "work.identity.publication",
    versionId: "version.identity.corrected.article",
    versionStatus: "corrected",
    publicationRole: "article",
    identifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/corrected.article" }),
    verifiedIdentifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/corrected.article" }),
  })
  assert.equal(isSourceIdentityReleaseEligible(correctedArticle), true)
  const cohortDuplicate = makeIdentity({
    sourceId: "source.identity.cohort.duplicate",
    workId: "work.identity.cohort.duplicate",
    versionId: "version.identity.cohort.duplicate",
    identifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/cohort.duplicate" }),
    verifiedIdentifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/cohort.duplicate" }),
    cohortResolution: "resolved",
    cohortFamilyId: "cohort.shared",
  })
  const cohortOriginal = makeIdentity({
    sourceId: "source.identity.cohort.original",
    workId: "work.identity.cohort.original",
    versionId: "version.identity.cohort.original",
    identifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/cohort.original" }),
    verifiedIdentifiers: canonicalizeSourceIdentifiers({ doi: "10.1234/cohort.original" }),
    cohortResolution: "resolved",
    cohortFamilyId: "cohort.shared",
  })
  const familyResult = deduplicateSourceFamilies([
    preprint,
    versionOfRecord,
    correctedArticle,
    correction,
    base,
    cohortDuplicate,
    cohortOriginal,
  ])
  assert.ok(familyResult.selectedSourceIds.includes("source.identity.corrected.article"))
  assert.ok(!familyResult.selectedSourceIds.includes("source.identity.vor"))
  assert.ok(!familyResult.selectedSourceIds.includes("source.identity.preprint"))
  assert.ok(familyResult.excluded.some((row) => row.reason === "correction_notice"))
  assert.equal(familyResult.selectedSourceIds.filter((id) => id.includes("cohort.")).length, 1)

  const snapshotRecords = snapshot.identityRecords as DnaSourceIdentityRecord[]
  const snapshotValidation = validateSourceIdentityRecords(snapshotRecords)
  assert.equal(snapshotValidation.ok, true, snapshotValidation.errors.join("\n"))
  assert.equal(snapshotRecords.length, 47)
  assert.equal(
    snapshotRecords.filter((record) => isSourceIdentityReleaseEligible(record, snapshotRecords)).length,
    (snapshot.identityState as JsonRecord).identityEligibleRecords,
  )
}

function runLicenseTests() {
  const fullText = makeComponent("full_text", "cleared")
  const passage = makeComponent("passage", "cleared")
  const open = makeLicense("CC BY 4.0", { full_text: fullText, passage })
  assert.equal(validateComponentLicenseMatrix(open).ok, true)
  assert.deepEqual(evaluateComponentRelease(open, "full_text"), { allowed: true, code: "component_cleared" })
  assert.deepEqual(evaluateComponentRelease(open, "passage"), { allowed: true, code: "component_cleared" })

  for (const decision of ["unknown", "restricted", "metadata_only"] as const) {
    const record = makeLicense("CC BY 4.0", {
      passage: makeComponent("passage", decision),
    })
    assert.deepEqual(evaluateComponentRelease(record, "passage"), { allowed: false, code: "component_not_cleared" })
  }

  for (const licence of ["CC BY-NC 4.0", "CC BY-ND 4.0", "All rights reserved", "Full rights copyright"] as const) {
    const blocked = makeLicense(licence, { full_text: makeComponent("full_text", "cleared") })
    assert.deepEqual(evaluateComponentRelease(blocked, "full_text"), { allowed: false, code: "license_blocks_runtime_full_text" })
  }
  const shareAlike = makeLicense("CC BY-SA 4.0", { passage: makeComponent("passage", "cleared") })
  assert.equal(shareAlike.policy, "cc_by_sa")
  assert.equal(shareAlike.obligations.attributionRequired, true)
  assert.equal(shareAlike.obligations.shareAlikeRequired, true)
  assert.equal(evaluateComponentRelease(shareAlike, "passage").allowed, true)
  const exceptWhereNoted = makeLicense("CC BY 4.0 except where otherwise noted", {
    passage: makeComponent("passage", "cleared"),
  })
  assert.equal(evaluateComponentRelease(exceptWhereNoted, "passage").allowed, false)
  const unknownLicense = makeLicense("custom licence", { passage: makeComponent("passage", "cleared") })
  assert.deepEqual(evaluateComponentRelease(unknownLicense, "passage"), { allowed: false, code: "unknown_declared_license" })

  for (const component of ["table", "figure", "scale", "test_items"] as const) {
    const defaultRestricted = makeLicense()
    assert.equal(evaluateComponentRelease(defaultRestricted, component).allowed, false)
    const unreviewed = makeLicense("CC BY 4.0", { [component]: makeComponent(component, "cleared") })
    assert.deepEqual(evaluateComponentRelease(unreviewed, component), { allowed: false, code: "third_party_review_required" })
    const reviewed = makeLicense("CC BY 4.0", {
      [component]: makeComponent(component, "cleared", { thirdPartyMaterialReviewed: true }),
    })
    assert.deepEqual(evaluateComponentRelease(reviewed, component), { allowed: true, code: "component_cleared" })
  }

  const missing = { ...open, components: open.components.filter((row) => row.component !== "abstract") }
  assert.equal(validateComponentLicenseMatrix(missing).ok, false)
  assert.equal(evaluateComponentRelease(missing, "passage").code, "invalid_license_matrix")
  const invalidEvidence = makeLicense("CC BY 4.0", {
    passage: makeComponent("passage", "cleared", {
      evidence: {
        sourceId: "source.identity.one",
        url: "http://example.org",
        checkedAt: "today",
        sha256: "bad",
        basis: "verified_in_artifact",
        artifactRelativePath: "../source.pdf",
      },
    }),
  })
  assert.equal(validateComponentLicenseMatrix(invalidEvidence).ok, false)
  const arbitraryOfficialPage = makeLicense("CC BY 4.0", {
    passage: makeComponent("passage", "cleared", {
      evidence: {
        sourceId: "source.identity.one",
        url: "https://example.org/licence",
        checkedAt: "2026-07-19",
        sha256: "b".repeat(64),
        basis: "official_license_page_verified",
        artifactRelativePath: null,
      },
    }),
  })
  assert.ok(validateComponentLicenseMatrix(arbitraryOfficialPage).errors.some((error) =>
    error.includes("untrusted_license_evidence_authority")))
  const unverifiedClearance = makeLicense("CC BY 4.0", {
    passage: makeComponent("passage", "cleared", {
      evidence: {
        sourceId: "source.identity.one",
        url: "https://creativecommons.org/licenses/by/4.0/",
        checkedAt: "2026-07-19",
        sha256: "b".repeat(64),
        basis: "unverified",
        artifactRelativePath: null,
      },
    }),
  })
  assert.ok(validateComponentLicenseMatrix(unverifiedClearance).errors.some((error) =>
    error.includes("cleared_without_verified_license_evidence")))
  assert.equal(evaluateComponentRelease(unverifiedClearance, "passage").allowed, false)

  assert.equal(isSourceIdentityAndComponentLicenseEligible({ identity: makeIdentity(), license: open, component: "passage" }), true)
  assert.equal(isSourceIdentityAndComponentLicenseEligible({
    identity: makeIdentity({ sourceId: "source.identity.other" }),
    license: open,
    component: "passage",
  }), false)
  assert.equal(isSourceIdentityAndComponentLicenseEligible({
    identity: makeIdentity({ identityVerification: { ...makeIdentity().identityVerification, status: "pending" } }),
    license: open,
    component: "passage",
  }), false)
}

function main() {
  const writeSnapshot = process.env.DNA_WRITE_SOURCE_GOVERNANCE_SNAPSHOT === "1"
    || process.argv.includes("--write-snapshot")
  const verifySsd = writeSnapshot
    || process.env.DNA_VERIFY_SOURCE_LIBRARY_SSD === "1"
    || process.argv.includes("--ssd")
  let expectedSnapshot: JsonRecord | null = null
  if (verifySsd) {
    const root = resolve(process.env.DNA_SOURCE_LIBRARY_ROOT || DEFAULT_LIBRARY_ROOT)
    assert.ok(existsSync(root), `ResearchSSD source library missing: ${root}`)
    assert.ok(root.startsWith("/Volumes/ResearchSSD/"), "source library must remain on ResearchSSD")
    expectedSnapshot = buildSnapshot(root)
  }

  if (writeSnapshot) {
    assert.ok(expectedSnapshot)
    mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true })
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(expectedSnapshot, null, 2)}\n`, "utf8")
  }
  assert.ok(existsSync(SNAPSHOT_PATH), `snapshot missing: ${SNAPSHOT_PATH}`)
  const snapshot = readJson(SNAPSHOT_PATH)
  if (expectedSnapshot) {
    assert.deepEqual(snapshot, expectedSnapshot, "repo snapshot no longer matches locked SSD manifests")
  }
  assert.equal(snapshot.schemaVersion, "dna-source-library-governance-snapshot@1")
  assert.equal(snapshot.governanceVersion, DNA_SOURCE_GOVERNANCE_VERSION)
  assert.equal((snapshot.manifests as JsonRecord[]).length, 11)
  assert.ok((snapshot.manifests as JsonRecord[]).every((row) => /^[a-f0-9]{64}$/.test(String(row.sha256))))
  assert.equal((snapshot.counts as JsonRecord).totalMetadataRecords, 47)
  assert.equal((snapshot.counts as JsonRecord).duplicateDoiRecords, 0)
  assert.equal((snapshot.counts as JsonRecord).unresolvedCategories, 0)
  assert.equal((snapshot.identityState as JsonRecord).fullyCrossIdentifierVerifiedRecords, 39)
  assert.equal((snapshot.identityState as JsonRecord).pendingIdentityRecords, 8)
  assert.equal((snapshot.identityState as JsonRecord).mismatchIdentityRecords, 0)
  assert.equal((snapshot.priorityState as JsonRecord).normalizedQuestionSpecificPriorityRecords, 47)
  assert.equal((snapshot.licenseState as JsonRecord).componentMatricesCompleted, 47)
  assert.equal((snapshot.licenseState as JsonRecord).componentsAudited, 376)
  const offlinePriorityRecords = snapshot.priorityRecords as JsonRecord[]
  assert.equal(offlinePriorityRecords.length, 47)
  for (const record of offlinePriorityRecords) {
    assert.ok(record.ageScope)
    assert.ok(record.sampleScope)
    const decisions = record.decisions as JsonRecord
    assert.deepEqual(Object.keys(decisions).sort(), [...DNA_SOURCE_QUESTION_TYPES].sort())
    for (const decision of Object.values(decisions) as JsonRecord[]) {
      if (decision.grade === "D") assert.equal(decision.supportsScientificClaim, false)
      if (decision.grade === "E") assert.equal(decision.supportsScientificClaim, false)
    }
  }
  const offlineLicenseRecords = snapshot.licenseRecords as JsonRecord[]
  assert.equal(offlineLicenseRecords.length, 47)
  for (const record of offlineLicenseRecords) {
    const decisions = record.decisions as JsonRecord
    const evidenceBasis = record.evidenceBasis as JsonRecord
    assert.deepEqual(Object.keys(decisions).sort(), [...DNA_LICENSE_COMPONENTS].sort())
    assert.deepEqual(Object.keys(evidenceBasis).sort(), [...DNA_LICENSE_COMPONENTS].sort())
    for (const [component, decision] of Object.entries(decisions)) {
      if (component !== "metadata" && decision === "cleared") {
        assert.ok(["verified_in_artifact", "official_license_page_verified"].includes(String(evidenceBasis[component])))
      }
    }
    for (const component of ["table", "figure", "scale", "test_items"]) {
      assert.equal(decisions[component], "restricted")
    }
  }
  assert.equal((snapshot.contentPolicy as JsonRecord).includesFullText, false)
  assert.equal((snapshot.contentPolicy as JsonRecord).includesPassages, false)
  assert.doesNotMatch(JSON.stringify(snapshot), /abstractText|fullText|passageText|tableText|testItemText/)
  assert.doesNotMatch(JSON.stringify(snapshot), /\/Volumes\/|\/Users\//)

  runPriorityTests()
  runIdentityTests(snapshot)
  runLicenseTests()

  console.log(JSON.stringify({
    ok: true,
    governanceVersion: DNA_SOURCE_GOVERNANCE_VERSION,
    questionTypes: DNA_SOURCE_QUESTION_TYPES.length,
    priorityRoles: DNA_SOURCE_ROLES.length,
    sourceRecords: (snapshot.counts as JsonRecord).sourceRecords,
    restrictedMetadataSources: (snapshot.counts as JsonRecord).restrictedMetadataSources,
    identityRecords: (snapshot.identityRecords as unknown[]).length,
    identityEligibleRecords: (snapshot.identityState as JsonRecord).identityEligibleRecords,
    componentMatricesCompleted: (snapshot.licenseState as JsonRecord).componentMatricesCompleted,
    manifestHashesLocked: (snapshot.manifests as unknown[]).length,
    ssdVerified: verifySsd,
  }, null, 2))
}

main()
