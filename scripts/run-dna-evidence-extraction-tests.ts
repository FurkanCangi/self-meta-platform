import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  DNA_BLIND_EXTRACTION_PROTOCOLS,
  DNA_CURRENT_ACCEPTED_ATOMIC_CLAIM_REGISTRY,
  DNA_EVIDENCE_EXTRACTION_CONTRACT,
  DNA_PARSER_PREFERENCE,
  applyDnaClaimRereview,
  commitDnaEvidenceSubject,
  createDnaBlindExtractionRun,
  createDnaCandidateBlindExtractionRun,
  createDnaCandidateSourcePassage,
  createDnaEvidenceTrustRegistry,
  createDnaSourcePassage,
  isDnaParsedArtifactCurrent,
  isDnaSourcePassageCurrent,
  parseDnaEvidenceArtifact,
  reconcileDnaBlindClaims,
  selectDnaPreferredArtifact,
  validateDnaPassageSet,
  type DnaAtomicClaimDraft,
  type DnaEvidenceArtifactInput,
  type DnaEvidenceTrustRecord,
  type DnaSourcePassage,
} from "../src/lib/dna/chat/governance/evidenceExtraction"

process.env.DNA_EVIDENCE_TEST_FIXTURE_MODE = "1"

function hash(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

function trustRecord(input: Omit<DnaEvidenceTrustRecord, "subjectSha256"> & {
  subject: unknown
}): DnaEvidenceTrustRecord {
  return {
    kind: input.kind,
    recordId: input.recordId,
    sourceId: input.sourceId,
    artifactSha256: input.artifactSha256,
    subjectSha256: commitDnaEvidenceSubject(input.subject),
  }
}

function expectError(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) =>
    error instanceof Error && error.message === code, `Beklenen hata: ${code}`)
}

const INTEGRITY_AUDIT_SNAPSHOT_PATH =
  "Datasets/SelfMetaAI/dna-knowledge/source-library/integrity-audit/v1/source-integrity-audit.json"
const COMPONENT_LICENSE_AUDIT_MANIFEST_PATH =
  "governance-audit/v1/component-license-audit.json"

type IntegrityAuditRecord = Readonly<{
  sourceId: string
  state: string
  runtimeEligibility?: string
  auditSha256?: string
  [key: string]: unknown
}>

type ComponentLicense = Readonly<{
  component: string
  decision: string
  evidence?: Readonly<{
    sha256?: string
    artifactRelativePath?: string | null
    [key: string]: unknown
  }>
  [key: string]: unknown
}>

type ComponentLicenseAuditRecord = Readonly<{
  sourceId: string
  policy: string
  obligations: Readonly<Record<string, unknown>>
  components: readonly ComponentLicense[]
  [key: string]: unknown
}>

type SnapshotLicenseRecord = Readonly<{
  sourceId: string
  policy: string
  obligations: Readonly<Record<string, unknown>>
  matrixSha256: string
  decisions: Readonly<Record<string, string>>
  evidenceBasis: Readonly<Record<string, string>>
}>

type CandidateSourceTrustDecision = Readonly<{
  sourceId: string
  integrityState: string
  integrityAuditRecordSha256: string
  integrityDecisionSha256: string
  passageLicenseDecision: string
  componentLicenseAuditRecordSha256: string
  sourceGovernanceLicenseRecordSha256: string
  passageLicenseDecisionSha256: string
}>

type CandidateGovernanceInputBindings = Readonly<{
  sourceIntegritySnapshotSha256: string
  sourceIntegritySnapshotExpectedAuditSha256: string
  integrityAuditSha256: string
  integrityAuditCheckedAt: string
  sourceGovernanceSnapshotSha256: string
  sourceGovernanceSnapshotExpectedComponentLicenseAuditSha256: string
  componentLicenseAuditSha256: string
  componentLicenseAuditAt: string
  componentLicenseAuditorVersion: string
  componentLicenseAuditorScriptSha256: string
}>

function parseJsonObject(bytes: Uint8Array, errorCode: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"))
  } catch {
    throw new Error(errorCode)
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(errorCode)
  return value as Record<string, unknown>
}

function uniqueSourceRecordMap<T extends { readonly sourceId: string }>(
  records: readonly T[],
  namespace: string,
): ReadonlyMap<string, T> {
  const result = new Map<string, T>()
  for (const record of records) {
    const sourceId = String(record.sourceId || "").trim()
    if (!sourceId) throw new Error(`dna_candidate_${namespace}_source_id_missing`)
    const previous = result.get(sourceId)
    if (previous) {
      const kind = JSON.stringify(previous) === JSON.stringify(record) ? "duplicate" : "conflicting"
      throw new Error(`dna_candidate_${namespace}_${kind}_source_id`)
    }
    result.set(sourceId, record)
  }
  return result
}

function singleHashBinding(
  records: readonly { readonly relativePath: string; readonly sha256: string }[],
  relativePath: string,
  errorPrefix: string,
): string {
  const matches = records.filter((record) => record.relativePath === relativePath)
  if (matches.length !== 1) throw new Error(`${errorPrefix}_binding_missing_or_duplicate`)
  const value = matches[0]!.sha256
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`${errorPrefix}_binding_invalid`)
  return value
}

function establishCandidateGovernanceTrustRoots(input: Readonly<{
  integrityAuditBytes: Uint8Array
  componentLicenseAuditBytes: Uint8Array
  sourceIntegritySnapshotBytes: Uint8Array
  sourceGovernanceSnapshotBytes: Uint8Array
}>): Readonly<{
  governanceInputBindings: CandidateGovernanceInputBindings
  decisionsBySource: ReadonlyMap<string, CandidateSourceTrustDecision>
}> {
  const integrityAudit = parseJsonObject(
    input.integrityAuditBytes,
    "dna_candidate_integrity_audit_invalid",
  ) as {
    schemaVersion?: string
    checkedAt?: string
    records?: IntegrityAuditRecord[]
  }
  const componentLicenseAudit = parseJsonObject(
    input.componentLicenseAuditBytes,
    "dna_candidate_component_license_audit_invalid",
  ) as {
    schemaVersion?: string
    auditedAt?: string
    auditorImplementation?: { version?: string; scriptSha256?: string }
    records?: ComponentLicenseAuditRecord[]
  }
  const sourceIntegritySnapshot = parseJsonObject(
    input.sourceIntegritySnapshotBytes,
    "dna_candidate_source_integrity_snapshot_invalid",
  ) as {
    schemaVersion?: string
    auditedAt?: string
    ssdAuditFiles?: Array<{ relativePath: string; sha256: string }>
  }
  const sourceGovernanceSnapshot = parseJsonObject(
    input.sourceGovernanceSnapshotBytes,
    "dna_candidate_source_governance_snapshot_invalid",
  ) as {
    schemaVersion?: string
    manifests?: Array<{ relativePath: string; sha256: string }>
    licenseRecords?: SnapshotLicenseRecord[]
  }
  if (integrityAudit.schemaVersion !== "dna-source-integrity-audit@2"
    || !Array.isArray(integrityAudit.records)
    || typeof integrityAudit.checkedAt !== "string") {
    throw new Error("dna_candidate_integrity_audit_invalid")
  }
  if (componentLicenseAudit.schemaVersion !== "dna-component-license-audit@2"
    || !Array.isArray(componentLicenseAudit.records)
    || typeof componentLicenseAudit.auditedAt !== "string"
    || typeof componentLicenseAudit.auditorImplementation?.version !== "string"
    || !/^[a-f0-9]{64}$/.test(componentLicenseAudit.auditorImplementation.scriptSha256 || "")) {
    throw new Error("dna_candidate_component_license_audit_invalid")
  }
  const componentLicenseAuditorVersion = componentLicenseAudit.auditorImplementation.version!
  const componentLicenseAuditorScriptSha256 =
    componentLicenseAudit.auditorImplementation.scriptSha256!
  if (sourceIntegritySnapshot.schemaVersion !== "dna-source-integrity-archive-snapshot@1"
    || !Array.isArray(sourceIntegritySnapshot.ssdAuditFiles)) {
    throw new Error("dna_candidate_source_integrity_snapshot_invalid")
  }
  if (sourceGovernanceSnapshot.schemaVersion !== "dna-source-library-governance-snapshot@1"
    || !Array.isArray(sourceGovernanceSnapshot.manifests)
    || !Array.isArray(sourceGovernanceSnapshot.licenseRecords)) {
    throw new Error("dna_candidate_source_governance_snapshot_invalid")
  }

  const integrityAuditSha256 = hash(input.integrityAuditBytes)
  const expectedIntegrityAuditSha256 = singleHashBinding(
    sourceIntegritySnapshot.ssdAuditFiles,
    INTEGRITY_AUDIT_SNAPSHOT_PATH,
    "dna_candidate_integrity_audit_snapshot",
  )
  if (integrityAuditSha256 !== expectedIntegrityAuditSha256) {
    throw new Error("dna_candidate_integrity_audit_snapshot_hash_mismatch")
  }
  if (sourceIntegritySnapshot.auditedAt !== integrityAudit.checkedAt) {
    throw new Error("dna_candidate_integrity_audit_snapshot_time_mismatch")
  }

  const componentLicenseAuditSha256 = hash(input.componentLicenseAuditBytes)
  const expectedComponentLicenseAuditSha256 = singleHashBinding(
    sourceGovernanceSnapshot.manifests,
    COMPONENT_LICENSE_AUDIT_MANIFEST_PATH,
    "dna_candidate_component_license_audit_snapshot",
  )
  if (componentLicenseAuditSha256 !== expectedComponentLicenseAuditSha256) {
    throw new Error("dna_candidate_component_license_audit_snapshot_hash_mismatch")
  }

  const integrityRecords = uniqueSourceRecordMap(
    integrityAudit.records,
    "integrity_audit",
  )
  const componentLicenseRecords = uniqueSourceRecordMap(
    componentLicenseAudit.records,
    "component_license_audit",
  )
  const snapshotLicenseRecords = uniqueSourceRecordMap(
    sourceGovernanceSnapshot.licenseRecords,
    "source_governance_snapshot",
  )
  const integrityIds = [...integrityRecords.keys()].sort()
  const componentIds = [...componentLicenseRecords.keys()].sort()
  const snapshotIds = [...snapshotLicenseRecords.keys()].sort()
  if (JSON.stringify(integrityIds) !== JSON.stringify(componentIds)
    || JSON.stringify(componentIds) !== JSON.stringify(snapshotIds)) {
    throw new Error("dna_candidate_governance_source_set_mismatch")
  }

  const decisionsBySource = new Map<string, CandidateSourceTrustDecision>()
  for (const sourceId of integrityIds) {
    const integrityRecord = integrityRecords.get(sourceId)!
    const componentRecord = componentLicenseRecords.get(sourceId)!
    const snapshotRecord = snapshotLicenseRecords.get(sourceId)!
    const componentsByName = new Map<string, ComponentLicense>()
    for (const component of componentRecord.components) {
      if (componentsByName.has(component.component)) {
        throw new Error("dna_candidate_component_license_duplicate_component")
      }
      componentsByName.set(component.component, component)
    }
    const passageComponent = componentsByName.get("passage")
    if (!passageComponent) throw new Error("dna_candidate_passage_license_decision_missing")
    const componentRecordCore = Object.fromEntries(
      Object.entries(componentRecord).filter(([key]) => key !== "audit"),
    )
    const componentDecisions = Object.fromEntries(
      componentRecord.components.map((component) => [component.component, component.decision]),
    )
    const componentEvidenceBasis = Object.fromEntries(
      componentRecord.components.map((component) => [
        component.component,
        String((component.evidence as Record<string, unknown> | undefined)?.basis || ""),
      ]),
    )
    const expectedMatrixSha256 = hash(JSON.stringify(componentRecordCore))
    if (snapshotRecord.policy !== componentRecord.policy
      || JSON.stringify(snapshotRecord.obligations) !== JSON.stringify(componentRecord.obligations)
      || JSON.stringify(snapshotRecord.decisions) !== JSON.stringify(componentDecisions)
      || JSON.stringify(snapshotRecord.evidenceBasis) !== JSON.stringify(componentEvidenceBasis)
      || snapshotRecord.matrixSha256 !== expectedMatrixSha256) {
      throw new Error("dna_candidate_component_license_snapshot_audit_mismatch")
    }
    const integrityDecisionSha256 = hash(JSON.stringify({
      sourceId,
      state: integrityRecord.state,
      runtimeEligibility: integrityRecord.runtimeEligibility || null,
      auditSha256: integrityRecord.auditSha256 || null,
    }))
    const passageLicenseDecisionSha256 = hash(JSON.stringify({
      sourceId,
      component: "passage",
      decision: passageComponent.decision,
      evidence: passageComponent.evidence || null,
      snapshotMatrixSha256: snapshotRecord.matrixSha256,
      auditorVersion: componentLicenseAuditorVersion,
      auditorScriptSha256: componentLicenseAuditorScriptSha256,
    }))
    decisionsBySource.set(sourceId, Object.freeze({
      sourceId,
      integrityState: integrityRecord.state,
      integrityAuditRecordSha256: hash(JSON.stringify(integrityRecord)),
      integrityDecisionSha256,
      passageLicenseDecision: passageComponent.decision,
      componentLicenseAuditRecordSha256: hash(JSON.stringify(componentRecord)),
      sourceGovernanceLicenseRecordSha256: hash(JSON.stringify(snapshotRecord)),
      passageLicenseDecisionSha256,
    }))
  }

  return Object.freeze({
    governanceInputBindings: Object.freeze({
      sourceIntegritySnapshotSha256: hash(input.sourceIntegritySnapshotBytes),
      sourceIntegritySnapshotExpectedAuditSha256: expectedIntegrityAuditSha256,
      integrityAuditSha256,
      integrityAuditCheckedAt: integrityAudit.checkedAt,
      sourceGovernanceSnapshotSha256: hash(input.sourceGovernanceSnapshotBytes),
      sourceGovernanceSnapshotExpectedComponentLicenseAuditSha256:
        expectedComponentLicenseAuditSha256,
      componentLicenseAuditSha256,
      componentLicenseAuditAt: componentLicenseAudit.auditedAt,
      componentLicenseAuditorVersion,
      componentLicenseAuditorScriptSha256,
    }),
    decisionsBySource,
  })
}

function jsonBytes(value: unknown): Uint8Array {
  return Buffer.from(JSON.stringify(value), "utf8")
}

const syntheticTrustSourceId = "synthetic.trust-root.source"
const syntheticIntegrityRecord: IntegrityAuditRecord = {
  schemaVersion: "dna-source-integrity@2",
  sourceId: syntheticTrustSourceId,
  state: "verified_clean",
  runtimeEligibility: "eligible",
  auditSha256: hash("synthetic-integrity-record"),
}
const syntheticComponentRecord: ComponentLicenseAuditRecord = {
  sourceId: syntheticTrustSourceId,
  policy: "cc_by",
  obligations: { attributionRequired: true, shareAlikeRequired: false },
  components: [{
    component: "passage",
    decision: "cleared",
    evidence: {
      basis: "verified_in_artifact",
      sha256: hash("synthetic-license-evidence"),
      artifactRelativePath: "evidence/synthetic/raw/article.jats.xml",
    },
  }],
  audit: { sourceRecordPath: "evidence/synthetic/source.json" },
}
const syntheticComponentRecordCore = Object.fromEntries(
  Object.entries(syntheticComponentRecord).filter(([key]) => key !== "audit"),
)
const syntheticSnapshotLicenseRecord: SnapshotLicenseRecord = {
  sourceId: syntheticTrustSourceId,
  policy: "cc_by",
  obligations: { attributionRequired: true, shareAlikeRequired: false },
  matrixSha256: hash(JSON.stringify(syntheticComponentRecordCore)),
  decisions: { passage: "cleared" },
  evidenceBasis: { passage: "verified_in_artifact" },
}

function syntheticTrustRootInputs(overrides: Partial<{
  integrityRecords: IntegrityAuditRecord[]
  componentRecords: ComponentLicenseAuditRecord[]
  snapshotLicenseRecords: SnapshotLicenseRecord[]
}> = {}) {
  const integrityAudit = {
      schemaVersion: "dna-source-integrity-audit@2",
    checkedAt: "2026-07-20T00:00:00.000Z",
    records: overrides.integrityRecords || [syntheticIntegrityRecord],
  }
  const componentLicenseAudit = {
    schemaVersion: "dna-component-license-audit@2",
    auditedAt: "2026-07-20T00:00:01.000Z",
    auditorImplementation: {
      version: "dna-source-governance-auditor@2",
      scriptSha256: hash("synthetic-auditor-script"),
    },
    records: overrides.componentRecords || [syntheticComponentRecord],
  }
  const integrityAuditBytes = jsonBytes(integrityAudit)
  const componentLicenseAuditBytes = jsonBytes(componentLicenseAudit)
  return {
    integrityAuditBytes,
    componentLicenseAuditBytes,
    sourceIntegritySnapshotBytes: jsonBytes({
      schemaVersion: "dna-source-integrity-archive-snapshot@1",
      auditedAt: integrityAudit.checkedAt,
      ssdAuditFiles: [{
        relativePath: INTEGRITY_AUDIT_SNAPSHOT_PATH,
        sha256: hash(integrityAuditBytes),
      }],
    }),
    sourceGovernanceSnapshotBytes: jsonBytes({
      schemaVersion: "dna-source-library-governance-snapshot@1",
      manifests: [{
        relativePath: COMPONENT_LICENSE_AUDIT_MANIFEST_PATH,
        sha256: hash(componentLicenseAuditBytes),
      }],
      licenseRecords: overrides.snapshotLicenseRecords || [syntheticSnapshotLicenseRecord],
    }),
  }
}

const syntheticTrustRoots = establishCandidateGovernanceTrustRoots(syntheticTrustRootInputs())
assert.equal(
  syntheticTrustRoots.decisionsBySource.get(syntheticTrustSourceId)?.integrityState,
  "verified_clean",
)
assert.equal(
  syntheticTrustRoots.decisionsBySource.get(syntheticTrustSourceId)?.passageLicenseDecision,
  "cleared",
)

const tamperedIntegrityInputs = syntheticTrustRootInputs()
const tamperedIntegrityAuditBytes = jsonBytes({
  schemaVersion: "dna-source-integrity-audit@2",
  checkedAt: "2026-07-20T00:00:00.000Z",
  records: [{ ...syntheticIntegrityRecord, state: "quarantined", runtimeEligibility: "blocked" }],
})
expectError(() => establishCandidateGovernanceTrustRoots({
  ...tamperedIntegrityInputs,
  integrityAuditBytes: tamperedIntegrityAuditBytes,
}), "dna_candidate_integrity_audit_snapshot_hash_mismatch")

const tamperedLicenseInputs = syntheticTrustRootInputs()
const tamperedLicenseAuditBytes = jsonBytes({
  schemaVersion: "dna-component-license-audit@2",
  auditedAt: "2026-07-20T00:00:01.000Z",
  auditorImplementation: {
    version: "dna-source-governance-auditor@2",
    scriptSha256: hash("synthetic-auditor-script"),
  },
  records: [{
    ...syntheticComponentRecord,
    components: [{ ...syntheticComponentRecord.components[0]!, decision: "restricted" }],
  }],
})
expectError(() => establishCandidateGovernanceTrustRoots({
  ...tamperedLicenseInputs,
  componentLicenseAuditBytes: tamperedLicenseAuditBytes,
}), "dna_candidate_component_license_audit_snapshot_hash_mismatch")

expectError(() => establishCandidateGovernanceTrustRoots(syntheticTrustRootInputs({
  snapshotLicenseRecords: [{
    ...syntheticSnapshotLicenseRecord,
    decisions: { passage: "restricted" },
  }],
})), "dna_candidate_component_license_snapshot_audit_mismatch")

expectError(() => establishCandidateGovernanceTrustRoots(syntheticTrustRootInputs({
  integrityRecords: [syntheticIntegrityRecord, syntheticIntegrityRecord],
})), "dna_candidate_integrity_audit_duplicate_source_id")

expectError(() => establishCandidateGovernanceTrustRoots(syntheticTrustRootInputs({
  componentRecords: [
    syntheticComponentRecord,
    {
      ...syntheticComponentRecord,
      components: [{ ...syntheticComponentRecord.components[0]!, decision: "restricted" }],
    },
  ],
})), "dna_candidate_component_license_audit_conflicting_source_id")

expectError(() => uniqueSourceRecordMap([
  { sourceId: "synthetic.manifest", sourceRecordSha256: hash("same") },
  { sourceId: "synthetic.manifest", sourceRecordSha256: hash("same") },
], "source_manifest"), "dna_candidate_source_manifest_duplicate_source_id")

expectError(() => uniqueSourceRecordMap([
  { sourceId: "synthetic.manifest", sourceRecordSha256: hash("one") },
  { sourceId: "synthetic.manifest", sourceRecordSha256: hash("two") },
], "source_manifest"), "dna_candidate_source_manifest_conflicting_source_id")

const BOUNDARY = "This synthetic group-level association does not support individual or causal inference."
const PROPOSITION = "Higher vagally mediated heart rate variability was associated with better performance in this synthetic sample."
const CAUSAL_PROPOSITION = "The intervention causes improved regulation in this synthetic sample."
const COMPOUND_PROPOSITION = "The insula participates in interoceptive processing and directly determines emotional awareness."
const CAUSAL_COMPOUND_PROPOSITION = "The intervention improves regulation and reduces distress."

const syntheticJats = `<?xml version="1.0" encoding="UTF-8"?>
<article xml:lang="en">
  <front><article-meta><author-notes><fn><p>FORBIDDEN FRONT MATTER</p></fn></author-notes></article-meta></front>
  <abstract id="ABS1">
    <title>Abstract</title>
    <p id="A1">This synthetic abstract describes an observational association without individual inference.</p>
  </abstract>
  <body>
    <sec id="S1">
      <title>Results</title>
      <p id="P1">${PROPOSITION}</p>
      <p id="P2">The association was estimated in children and adolescents using a predefined laboratory task.</p>
      <p id="P3">Uncertainty remained because the synthetic design was observational and the sample was limited.</p>
      <p id="P4">${CAUSAL_PROPOSITION}</p>
      <p id="P5">${COMPOUND_PROPOSITION}</p>
      <p id="P7">${CAUSAL_COMPOUND_PROPOSITION}</p>
      <table-wrap id="T1"><caption><p>FORBIDDEN TABLE AND CAPTION CONTENT</p></caption><table><tr><td>42</td></tr></table></table-wrap>
      <fig id="F1"><caption><p>FORBIDDEN FIGURE CAPTION CONTENT</p></caption></fig>
      <supplementary-material><p>FORBIDDEN SUPPLEMENT CONTENT</p></supplementary-material>
      <sec id="S1SI"><title>Supplementary Information</title><p>FORBIDDEN SUPPLEMENTARY INFORMATION CONTENT</p></sec>
      <sec id="S1ES"><title>Electronic supplementary material</title><p>FORBIDDEN ELECTRONIC SUPPLEMENT CONTENT</p></sec>
      <sec id="S1Q"><title>Questionnaire items</title><p>FORBIDDEN SCALE ITEM CONTENT</p></sec>
      <sec id="S1T"><title>Test items</title><p>FORBIDDEN TEST ITEM CONTENT</p></sec>
      <sec id="S1X" specific-use="third-party"><title>Licensed material</title><p>FORBIDDEN THIRD PARTY CONTENT</p></sec>
    </sec>
    <sec id="S2"><title>Discussion</title><p id="P6">The synthetic result requires replication in independent samples before broader generalization.</p></sec>
    <ref-list><ref><mixed-citation><p>FORBIDDEN REFERENCE CONTENT</p></mixed-citation></ref></ref-list>
  </body>
</article>`

const jatsArtifact: DnaEvidenceArtifactInput = {
  sourceId: "synthetic.hrv.study",
  artifactId: "synthetic.hrv.study.jats",
  format: "jats_xml",
  originalLanguage: "en",
  bytes: syntheticJats,
  declaredSha256: hash(syntheticJats),
}

const parsed = parseDnaEvidenceArtifact(jatsArtifact)
const parsedAgain = parseDnaEvidenceArtifact(jatsArtifact)
assert.deepEqual(parsed, parsedAgain, "Ayrıştırma deterministik olmalı")
assert.equal(parsed.status, "candidate_only")
assert.equal(parsed.runtimeEligible, false)
assert.equal(parsed.parserRank, 1)
assert.ok(Object.isFrozen(parsed) && Object.isFrozen(parsed.paragraphs))
assert.equal(isDnaParsedArtifactCurrent(parsed, syntheticJats), true)
assert.equal(isDnaParsedArtifactCurrent(parsed, syntheticJats.replace("observational", "cross-sectional")), false)
assert.ok(parsed.paragraphs.some((paragraph) => paragraph.xmlId === "P1"))
assert.ok(parsed.paragraphs.every((paragraph) => !paragraph.text.includes("FORBIDDEN")))
for (const requiredReason of [
  "table",
  "figure",
  "supplement",
  "scale_or_questionnaire",
  "test_items",
  "third_party_component",
  "references",
]) {
  assert.ok(parsed.exclusions.some((entry) => entry.reason === requiredReason && entry.count > 0),
    `Eksik dışlama sayacı: ${requiredReason}`)
}

expectError(() => parseDnaEvidenceArtifact({
  ...jatsArtifact,
  declaredSha256: "0".repeat(64),
}), "dna_evidence_artifact_hash_mismatch")

const html = `<!doctype html><html><body>
  <h1>Overview</h1><p>This structural HTML paragraph contains eligible scientific narrative text.</p>
  <h2>References</h2><p>FORBIDDEN HTML REFERENCE</p>
  <h2>Conclusion</h2><p>This conclusion paragraph remains eligible after the reference section ends.</p>
  <figure><figcaption><p>FORBIDDEN HTML FIGURE</p></figcaption></figure>
</body></html>`
const parsedHtml = parseDnaEvidenceArtifact({
  sourceId: "synthetic.html.source",
  artifactId: "synthetic.html.source.article",
  format: "structural_html",
  originalLanguage: "en",
  bytes: html,
})
assert.equal(parsedHtml.paragraphs.length, 2)
assert.ok(parsedHtml.paragraphs.every((paragraph) => !paragraph.text.includes("FORBIDDEN")))

const manualBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55])
const manualApproval = {
  approvalId: "manual.approval.001",
  approvedAt: "2026-07-19T12:00:00.000Z",
  evidenceSha256: hash("manual-approval"),
  artifactSha256: hash(manualBytes),
  approved: true as const,
  columnOrderVerified: true as const,
  restrictedComponentsExcluded: true as const,
}
const manualApprovedRanges = [{
  rangeId: "range.10-11",
  pageStart: 10,
  pageEnd: 11,
  paragraphs: [{
    paragraphNumber: 1,
    pageStart: 10,
    pageEnd: 10,
    sectionPath: ["Methods"],
    text: "This manually approved PDF paragraph has a verified reading order and an exact page location.",
  }],
}]
const manualTrustRegistry = createDnaEvidenceTrustRegistry({
  registryId: "trust.synthetic.manual",
  authority: "test_fixture",
  records: [trustRecord({
    kind: "manual_artifact_approval",
    recordId: manualApproval.approvalId,
    sourceId: "synthetic.manual.source",
    artifactSha256: hash(manualBytes),
    subject: {
      format: "approved_pdf_range",
      approval: manualApproval,
      approvedRanges: manualApprovedRanges,
      ocrQuality: null,
    },
  })],
})
const callerAssertedGovernanceRegistry = createDnaEvidenceTrustRegistry({
  registryId: "trust.fabricated.governance",
  authority: "governance_audit",
  records: manualTrustRegistry.records,
})
const manualBase = {
  sourceId: "synthetic.manual.source",
  artifactId: "synthetic.manual.source.pdf",
  originalLanguage: "en",
  bytes: manualBytes,
  approvedRanges: manualApprovedRanges,
  manualApproval,
  trustRegistry: manualTrustRegistry,
}
const parsedPdf = parseDnaEvidenceArtifact({
  ...manualBase,
  format: "approved_pdf_range",
})
assert.equal(parsedPdf.paragraphs[0]?.pageStart, 10)
expectError(() => parseDnaEvidenceArtifact({
  ...manualBase,
  format: "approved_pdf_range",
  trustRegistry: callerAssertedGovernanceRegistry,
}), "dna_evidence_trust_registry_not_authorized")
const mutableProcessEnv = process.env as Record<string, string | undefined>
const previousNodeEnv = mutableProcessEnv.NODE_ENV
mutableProcessEnv.NODE_ENV = "production"
expectError(() => parseDnaEvidenceArtifact({
  ...manualBase,
  format: "approved_pdf_range",
}), "dna_evidence_trust_registry_not_authorized")
if (previousNodeEnv === undefined) delete mutableProcessEnv.NODE_ENV
else mutableProcessEnv.NODE_ENV = previousNodeEnv
expectError(() => parseDnaEvidenceArtifact({
  ...manualBase,
  format: "approved_pdf_range",
  trustRegistry: undefined,
}), "dna_evidence_trust_registry_required")
expectError(() => parseDnaEvidenceArtifact({
  ...manualBase,
  format: "approved_pdf_range",
  approvedRanges: [{
    ...manualApprovedRanges[0]!,
    paragraphs: [{
      ...manualApprovedRanges[0]!.paragraphs[0]!,
      text: "A substituted paragraph cannot reuse the approval commitment for the original extracted text.",
    }],
  }],
}), "dna_evidence_untrusted_manual_artifact_approval")
expectError(() => parseDnaEvidenceArtifact({
  ...manualBase,
  format: "approved_pdf_range",
  manualApproval: { ...manualBase.manualApproval, columnOrderVerified: false },
} as unknown as DnaEvidenceArtifactInput), "dna_evidence_manual_range_not_approved")
expectError(() => parseDnaEvidenceArtifact({
  ...manualBase,
  format: "approved_pdf_range",
  manualApproval: { ...manualBase.manualApproval, artifactSha256: "0".repeat(64) },
}), "dna_evidence_manual_approval_artifact_mismatch")

expectError(() => parseDnaEvidenceArtifact({
  ...manualBase,
  artifactId: "synthetic.manual.source.ocr",
  format: "ocr",
  ocrQuality: {
    engineId: "ocr.engine.001",
    meanCharacterConfidence: 0.95,
    replacementCharacterRate: 0,
    humanRangeApproved: true,
    columnOrderVerified: true,
  },
}), "dna_evidence_invalid_ocr")

const preferred = selectDnaPreferredArtifact([
  {
    ...manualBase,
    sourceId: jatsArtifact.sourceId,
    artifactId: "synthetic.hrv.study.pdf",
    format: "approved_pdf_range",
  },
  { ...jatsArtifact },
  {
    sourceId: jatsArtifact.sourceId,
    artifactId: "synthetic.hrv.study.html",
    format: "structural_html",
    originalLanguage: "en",
    bytes: html,
  },
] as readonly DnaEvidenceArtifactInput[])
assert.equal(preferred.format, "jats_xml")
assert.deepEqual([...DNA_PARSER_PREFERENCE], [
  "jats_xml",
  "epub_xml",
  "structural_html",
  "approved_pdf_range",
  "ocr",
])

function paragraphId(xmlId: string): string {
  const paragraph = parsed.paragraphs.find((entry) => entry.xmlId === xmlId)
  assert.ok(paragraph, `Paragraf bulunamadı: ${xmlId}`)
  return paragraph.paragraphId
}

const licenseApproval = {
  status: "approved" as const,
  sourceId: parsed.sourceId,
  artifactSha256: parsed.artifactSha256,
  component: "passage" as const,
  licenseRecordId: "license.synthetic.hrv.passage",
  evidenceSha256: hash("license-evidence"),
  extractionAllowed: true as const,
  thirdPartyMaterialExcluded: true as const,
}
const metadataApproval = {
  reviewId: "passage.review.synthetic.001",
  reviewedAt: "2026-07-19T12:10:00.000Z",
  evidenceSha256: hash("passage-metadata-evidence"),
  ageScopeApproved: true as const,
  evidenceTypeApproved: true as const,
  claimBoundaryApproved: true as const,
}
const moderateAppraisalEvidence = {
  kind: "method_appraisal" as const,
  appraisalId: "appraisal.synthetic.hrv.moderate",
  appraisalSha256: hash("synthetic-hrv-method-appraisal-moderate"),
  assessedLevel: "moderate" as const,
}
const lowAppraisalEvidence = {
  kind: "method_appraisal" as const,
  appraisalId: "appraisal.synthetic.hrv.low",
  appraisalSha256: hash("synthetic-hrv-method-appraisal-low"),
  assessedLevel: "low" as const,
}
const approvalTrustRecords: DnaEvidenceTrustRecord[] = [
  trustRecord({
    kind: "passage_license_approval",
    recordId: licenseApproval.licenseRecordId,
    sourceId: parsed.sourceId,
    artifactSha256: parsed.artifactSha256,
    subject: licenseApproval,
  }),
  trustRecord({
    kind: "passage_metadata_approval",
    recordId: metadataApproval.reviewId,
    sourceId: parsed.sourceId,
    artifactSha256: parsed.artifactSha256,
    subject: metadataApproval,
  }),
  trustRecord({
    kind: "method_appraisal",
    recordId: moderateAppraisalEvidence.appraisalId,
    sourceId: parsed.sourceId,
    artifactSha256: parsed.artifactSha256,
    subject: moderateAppraisalEvidence,
  }),
  trustRecord({
    kind: "method_appraisal",
    recordId: lowAppraisalEvidence.appraisalId,
    sourceId: parsed.sourceId,
    artifactSha256: parsed.artifactSha256,
    subject: lowAppraisalEvidence,
  }),
]
const approvalTrustRegistry = createDnaEvidenceTrustRegistry({
  registryId: "trust.synthetic.passage-approvals",
  authority: "test_fixture",
  records: approvalTrustRecords,
})
const candidateApprovalTrustRegistry = createDnaEvidenceTrustRegistry({
  registryId: "trust.candidate.passage-approvals",
  authority: "candidate_audit",
  records: approvalTrustRecords,
})

function createPassage(id: string, ids: readonly string[]): DnaSourcePassage {
  return createDnaSourcePassage({
    id,
    parsedArtifact: parsed,
    paragraphIds: ids,
    ageScope: "pediatric",
    evidenceType: "observational",
    claimBoundary: BOUNDARY,
    licenseApproval,
    metadataApproval,
    trustRegistry: approvalTrustRegistry,
  })
}

const passage = createPassage("passage.synthetic.hrv.results.001", [paragraphId("P1"), paragraphId("P2")])
const passageP1 = createPassage("passage.synthetic.hrv.results.p1", [paragraphId("P1")])
const passageP2 = createPassage("passage.synthetic.hrv.results.p2", [paragraphId("P2")])
const passageP4 = createPassage("passage.synthetic.hrv.results.p4", [paragraphId("P4")])
const passageP5 = createPassage("passage.synthetic.hrv.results.p5", [paragraphId("P5")])
const passageP7 = createPassage("passage.synthetic.hrv.results.p7", [paragraphId("P7")])
expectError(() => createDnaSourcePassage({
  id: "passage.synthetic.candidate.regular-path-rejected",
  parsedArtifact: parsed,
  paragraphIds: [paragraphId("P1")],
  ageScope: "pediatric",
  evidenceType: "observational",
  claimBoundary: BOUNDARY,
  licenseApproval,
  metadataApproval,
  trustRegistry: candidateApprovalTrustRegistry,
}), "dna_evidence_trust_registry_not_authorized")
const candidatePassage = createDnaCandidateSourcePassage({
  id: "passage.synthetic.candidate.explicit-path",
  parsedArtifact: parsed,
  paragraphIds: [paragraphId("P1")],
  ageScope: "pediatric",
  evidenceType: "observational",
  claimBoundary: BOUNDARY,
  licenseApproval,
  metadataApproval,
  trustRegistry: candidateApprovalTrustRegistry,
})
assert.equal(candidatePassage.runtimeEligible, false)
const trustedPassages = [passage, passageP1, passageP2, passageP4, passageP5, passageP7]
const downstreamTrustRegistry = createDnaEvidenceTrustRegistry({
  registryId: "trust.synthetic.downstream",
  authority: "test_fixture",
  records: [
    ...approvalTrustRecords,
    ...trustedPassages.map((entry) => trustRecord({
      kind: "passage",
      recordId: entry.id,
      sourceId: entry.sourceId,
      artifactSha256: entry.artifactSha256,
      subject: (() => {
        const { provenanceSha256: _provenanceSha256, ...core } = entry
        return core
      })(),
    })),
  ],
})
const candidateDownstreamTrustRegistry = createDnaEvidenceTrustRegistry({
  registryId: "trust.candidate.downstream",
  authority: "candidate_audit",
  records: [
    ...approvalTrustRecords,
    trustRecord({
      kind: "passage",
      recordId: candidatePassage.id,
      sourceId: candidatePassage.sourceId,
      artifactSha256: candidatePassage.artifactSha256,
      subject: (() => {
        const { provenanceSha256: _provenanceSha256, ...core } = candidatePassage
        return core
      })(),
    }),
  ],
})
assert.equal(passage.paragraphStart, 1)
assert.equal(passage.paragraphEnd, 2)
assert.equal(passage.licenseStatus, "approved")
assert.equal(passage.runtimeEligible, false)
assert.equal(isDnaSourcePassageCurrent(passage, parsed), true)
const changedParsed = parseDnaEvidenceArtifact({
  ...jatsArtifact,
  declaredSha256: undefined,
  bytes: syntheticJats.replace("sample was limited", "sample size was limited"),
})
assert.equal(isDnaSourcePassageCurrent(passage, changedParsed), false,
  "Artefakt değişikliği eski pasaj bağını kapatmalı")

expectError(() => createDnaSourcePassage({
  id: "passage.synthetic.fake-license",
  parsedArtifact: parsed,
  paragraphIds: [paragraphId("P1")],
  ageScope: "pediatric",
  evidenceType: "observational",
  claimBoundary: BOUNDARY,
  licenseApproval: {
    ...licenseApproval,
    licenseRecordId: "license.fabricated.not-audited",
    evidenceSha256: "a".repeat(64),
  },
  metadataApproval,
  trustRegistry: approvalTrustRegistry,
}), "dna_evidence_untrusted_passage_license_approval")

expectError(() => createPassage("passage.synthetic.nonadjacent", [paragraphId("P1"), paragraphId("P3")]),
  "dna_evidence_passage_not_adjacent")
expectError(() => createPassage("passage.synthetic.crosssection", [paragraphId("P5"), paragraphId("P6")]),
  "dna_evidence_passage_crosses_section")

const repeatedTitleParsed = parseDnaEvidenceArtifact({
  sourceId: "synthetic.repeated-sections",
  artifactId: "synthetic.repeated-sections.jats",
  format: "jats_xml",
  originalLanguage: "en",
  bytes: `<article><body>
    <sec id="R1"><title>Results</title><p id="R1P">First separate result section contains enough eligible narrative text.</p></sec>
    <sec id="R2"><title>Results</title><p id="R2P">Second separate result section contains enough eligible narrative text.</p></sec>
  </body></article>`,
})
expectError(() => createDnaSourcePassage({
  id: "passage.synthetic.repeated-title-crossing",
  parsedArtifact: repeatedTitleParsed,
  paragraphIds: repeatedTitleParsed.paragraphs.map((entry) => entry.paragraphId),
  ageScope: "adult",
  evidenceType: "observational",
  claimBoundary: BOUNDARY,
  licenseApproval: licenseApproval as never,
  metadataApproval,
  trustRegistry: approvalTrustRegistry,
}), "dna_evidence_passage_crosses_section")
expectError(() => createPassage("passage.synthetic.too-long", [
  paragraphId("P1"), paragraphId("P2"), paragraphId("P3"), paragraphId("P4"),
]), "dna_evidence_passage_paragraph_count")
const overlapping = validateDnaPassageSet([passage, passageP1])
assert.equal(overlapping.ok, false)
assert.deepEqual(overlapping.overlappingPassageIds, [
  "passage.synthetic.hrv.results.001",
  "passage.synthetic.hrv.results.p1",
])

function claimDraft(claimId: string, overrides: Partial<DnaAtomicClaimDraft> = {}): DnaAtomicClaimDraft {
  return {
    claimId,
    claimType: "association",
    proposition: PROPOSITION,
    population: "human",
    ageScope: "pediatric",
    setting: "laboratory",
    measure: "synthetic task performance",
    comparator: null,
    outcome: "task performance",
    direction: "positive",
    effectMagnitude: {
      kind: "not_reported",
      metric: null,
      value: null,
      qualifier: "not_reported",
    },
    effectEvidence: null,
    uncertainty: {
      level: "high",
      text: "The observational synthetic design does not establish causality.",
    },
    studyDesign: "cross_sectional_observational",
    evidenceLevel: "moderate",
    evidenceLevelEvidence: moderateAppraisalEvidence,
    passageIds: [passageP1.id],
    causalStatus: "associational",
    claimBoundary: BOUNDARY,
    dnaRelationship: "none",
    conflictSetId: null,
    ...overrides,
  }
}

const candidateDraft = claimDraft("claim.synthetic.candidate.explicit", {
  passageIds: [candidatePassage.id],
})
const candidateRationaleCore = {
  claimId: candidateDraft.claimId,
  passageIds: [candidatePassage.id],
  rationale: "Candidate pipeline records an explicit source-bound rationale without runtime authority.",
  uncertaintyEvidence: candidateDraft.uncertainty.text,
}
const candidatePassageManifestSha256 = commitDnaEvidenceSubject([{
  id: candidatePassage.id,
  provenanceSha256: candidatePassage.provenanceSha256,
}])
const candidateRunInput = {
  lane: "A" as const,
  protocolId: DNA_BLIND_EXTRACTION_PROTOCOLS.A.protocolId,
  runId: "blind.run.candidate.a.001",
  createdAt: "2026-07-19T12:59:59.000Z",
  sourceId: parsed.sourceId,
  artifactSha256: parsed.artifactSha256,
  parsedArtifact: parsed,
  passages: [candidatePassage],
  trustRegistry: candidateDownstreamTrustRegistry,
  contextCommitment: {
    contextId: "context.synthetic.candidate.a.001",
    instructionSha256: hash("candidate-a-instructions"),
    governanceMetadataSha256: hash("candidate-governance-metadata"),
    sourceArtifactSha256: parsed.artifactSha256,
    passageManifestSha256: candidatePassageManifestSha256,
    peerOutputExcluded: true as const,
  },
  claimDrafts: [candidateDraft],
  rationales: [{
    ...candidateRationaleCore,
    rationaleSha256: commitDnaEvidenceSubject(candidateRationaleCore),
  }],
}
expectError(() => createDnaBlindExtractionRun(candidateRunInput),
  "dna_evidence_trust_registry_not_authorized")
const candidateRun = createDnaCandidateBlindExtractionRun(candidateRunInput)
assert.equal(candidateRun.runtimeEligible, false)
assert.equal(candidateRun.claims[0]?.runtimeEligible, false)
const candidateDraftB = claimDraft("claim.synthetic.candidate.explicit.b", {
  passageIds: [candidatePassage.id],
  outcome: "independently normalized task-performance outcome",
})
const candidateRationaleBCore = {
  claimId: candidateDraftB.claimId,
  passageIds: [candidatePassage.id],
  rationale: "Candidate lane B independently records the same verbatim proposition with a different normalized outcome label.",
  uncertaintyEvidence: candidateDraftB.uncertainty.text,
}
const candidateRunB = createDnaCandidateBlindExtractionRun({
  ...candidateRunInput,
  lane: "B",
  protocolId: DNA_BLIND_EXTRACTION_PROTOCOLS.B.protocolId,
  runId: "blind.run.candidate.b.001",
  createdAt: "2026-07-19T13:00:00.000Z",
  contextCommitment: {
    ...candidateRunInput.contextCommitment,
    contextId: "context.synthetic.candidate.b.001",
    instructionSha256: hash("candidate-b-instructions"),
  },
  claimDrafts: [candidateDraftB],
  rationales: [{
    ...candidateRationaleBCore,
    rationaleSha256: commitDnaEvidenceSubject(candidateRationaleBCore),
  }],
})
const candidateStructuralQuarantine = reconcileDnaBlindClaims({
  reconciliationId: "reconciliation.synthetic.candidate.structural-quarantine",
  runA: candidateRun,
  claimAId: candidateDraft.claimId,
  runB: candidateRunB,
  claimBId: candidateDraftB.claimId,
})
assert.equal(candidateStructuralQuarantine.status, "quarantined")
const candidateRereviewCore = {
  protocolId: "dna-claim-rereview@1" as const,
  reviewId: "rereview.synthetic.candidate.001",
  reviewedAt: "2026-07-19T14:01:00.000Z",
  sourceId: parsed.sourceId,
  artifactSha256: parsed.artifactSha256,
  reconciliationSha256: candidateStructuralQuarantine.reconciliationSha256,
  decision: "consensus" as const,
  rereadPassageIds: [candidatePassage.id],
  resolved: {
    passageIds: [candidatePassage.id],
    proposition: PROPOSITION,
    ageScope: "pediatric" as const,
    causalStatus: "associational" as const,
    evidenceLevel: "moderate" as const,
    evidenceLevelEvidence: moderateAppraisalEvidence,
    claimBoundary: BOUNDARY,
  },
  rationaleCode: "source_reread_exact" as const,
}
const candidateRereviewed = applyDnaClaimRereview({
  reconciliation: candidateStructuralQuarantine,
  resolution: {
    ...candidateRereviewCore,
    evidenceSha256: commitDnaEvidenceSubject(candidateRereviewCore),
  },
  passages: [candidatePassage],
  parsedArtifact: parsed,
  trustRegistry: candidateDownstreamTrustRegistry,
})
assert.equal(candidateRereviewed.status, "rereview_consensus_candidate")
assert.equal(candidateRereviewed.runtimeEligible, false)

function blindRun(
  lane: "A" | "B",
  runId: string,
  draft: DnaAtomicClaimDraft,
  passages: readonly DnaSourcePassage[] = [passageP1],
  trustRegistry = downstreamTrustRegistry,
  instructionSha256 = hash(`distinct-${lane}-extraction-instructions`),
) {
  const rationaleCore = {
    claimId: draft.claimId,
    passageIds: [...draft.passageIds].sort(),
    rationale: `Lane ${lane} recorded a source-bound rationale for this synthetic claim.`,
    uncertaintyEvidence: draft.uncertainty.text,
  }
  const passageManifestSha256 = commitDnaEvidenceSubject(passages
    .map((entry) => ({ id: entry.id, provenanceSha256: entry.provenanceSha256 }))
    .sort((left, right) => left.id.localeCompare(right.id)))
  return createDnaBlindExtractionRun({
    lane,
    protocolId: DNA_BLIND_EXTRACTION_PROTOCOLS[lane].protocolId,
    runId,
    createdAt: lane === "A" ? "2026-07-19T13:00:00.000Z" : "2026-07-19T13:00:01.000Z",
    sourceId: parsed.sourceId,
    artifactSha256: parsed.artifactSha256,
    parsedArtifact: parsed,
    passages,
    trustRegistry,
    contextCommitment: {
      contextId: `context.synthetic.${lane.toLowerCase()}.${runId}`,
      instructionSha256,
      governanceMetadataSha256: hash("synthetic-source-governance-metadata"),
      sourceArtifactSha256: parsed.artifactSha256,
      passageManifestSha256,
      peerOutputExcluded: true,
    },
    claimDrafts: [draft],
    rationales: [{ ...rationaleCore, rationaleSha256: commitDnaEvidenceSubject(rationaleCore) }],
  })
}

const runA = blindRun("A", "blind.run.a.001", claimDraft("claim.synthetic.hrv.a"))
const runB = blindRun("B", "blind.run.b.001", claimDraft("claim.synthetic.hrv.b"))
assert.notEqual(runA.protocolId, runB.protocolId)
assert.notEqual(runA.runId, runB.runId)
assert.notEqual(runA.blindContextSha256, runB.blindContextSha256)
assert.equal(runA.dnaLinkingAllowed, false)
assert.equal(runB.dnaLinkingAllowed, false)
assert.equal(runA.claims[0]?.dnaRelationship, "none")
assert.ok(Object.isFrozen(runA) && Object.isFrozen(runA.claims) && Object.isFrozen(runA.claims[0]!))
assert.notEqual(runA.instructionSha256, runB.instructionSha256)
assert.notEqual(runA.contextCommitmentSha256, runB.contextCommitmentSha256)
assert.equal(runA.rationales[0]?.claimId, runA.claims[0]?.claimId)

expectError(() => blindRun(
  "A",
  "blind.run.a.untrusted-passage",
  claimDraft("claim.synthetic.untrusted-passage"),
  [passageP1],
  approvalTrustRegistry,
), "dna_evidence_untrusted_passage")

expectError(() => blindRun(
  "A",
  "blind.run.a.overlap",
  claimDraft("claim.synthetic.overlap"),
  [passage, passageP1],
), "dna_evidence_blind_passage_overlap")

const ageGroupNounPhraseRun = blindRun("A", "blind.run.a.age-groups", claimDraft("claim.synthetic.age-groups", {
  proposition: "The association was estimated in children and adolescents using a predefined laboratory task.",
  passageIds: [passageP2.id],
  outcome: "association estimate",
}), [passageP2])
assert.equal(ageGroupNounPhraseRun.claims[0]?.status, "candidate_only",
  "Tek isim grubundaki children and adolescents bileşik önerme sayılmamalı")

expectError(() => createDnaBlindExtractionRun({
  lane: "A",
  protocolId: DNA_BLIND_EXTRACTION_PROTOCOLS.A.protocolId,
  runId: "blind.run.a.leak",
  createdAt: "2026-07-19T13:00:00.000Z",
  sourceId: parsed.sourceId,
  artifactSha256: parsed.artifactSha256,
  passages: [passageP1],
  claimDrafts: [claimDraft("claim.synthetic.leak")],
  peerRun: runB,
} as unknown as Parameters<typeof createDnaBlindExtractionRun>[0]),
"dna_evidence_blind_input_leak_or_shape_invalid")

expectError(() => blindRun("A", "blind.run.a.dna-link", claimDraft("claim.synthetic.dna-link", {
  dnaRelationship: "conceptual_proximity" as never,
})), "dna_evidence_blind_extraction_cannot_create_dna_relationship")

expectError(() => blindRun("A", "blind.run.a.compound", claimDraft("claim.synthetic.compound", {
  proposition: COMPOUND_PROPOSITION,
  passageIds: [passageP5.id],
  outcome: "interoceptive processing and emotional awareness",
  causalStatus: "source_causal_claim_unverified",
}), [passageP5]), "dna_evidence_claim_not_atomic")

expectError(() => blindRun("A", "blind.run.a.causal-compound", claimDraft("claim.synthetic.causal-compound", {
  proposition: CAUSAL_COMPOUND_PROPOSITION,
  passageIds: [passageP7.id],
  outcome: "regulation and distress",
  causalStatus: "associational",
}), [passageP7]), "dna_evidence_claim_not_atomic")

expectError(() => blindRun("A", "blind.run.a.unbound-effect", claimDraft("claim.synthetic.unbound-effect", {
  effectMagnitude: {
    kind: "standardized",
    metric: "Hedges g",
    value: 999,
    qualifier: "large",
  },
  effectEvidence: {
    kind: "passage_locator",
    passageId: passageP1.id,
    locatorText: PROPOSITION,
    locatorSha256: hash(PROPOSITION),
  },
})), "dna_evidence_effect_not_passage_bound")

expectError(() => blindRun("A", "blind.run.a.unbound-level", claimDraft("claim.synthetic.unbound-level", {
  evidenceLevel: "high",
  evidenceLevelEvidence: null,
})), "dna_evidence_level_requires_method_appraisal")

expectError(() => blindRun("A", "blind.run.a.causal", claimDraft("claim.synthetic.causal", {
  proposition: CAUSAL_PROPOSITION,
  passageIds: [passageP4.id],
  outcome: "regulation",
  causalStatus: "associational",
}), [passageP4]), "dna_evidence_unsupported_causal_language")

const quarantinedCausalRun = blindRun("A", "blind.run.a.causal-source", claimDraft("claim.synthetic.causal-source", {
  proposition: CAUSAL_PROPOSITION,
  passageIds: [passageP4.id],
  outcome: "regulation",
  causalStatus: "source_causal_claim_unverified",
}), [passageP4])
assert.equal(quarantinedCausalRun.claims[0]?.status, "quarantined")
assert.equal(quarantinedCausalRun.claims[0]?.runtimeEligible, false)

const exact = reconcileDnaBlindClaims({
  reconciliationId: "reconciliation.synthetic.exact",
  runA,
  claimAId: "claim.synthetic.hrv.a",
  runB,
  claimBId: "claim.synthetic.hrv.b",
})
assert.equal(exact.status, "exact_consensus_candidate")
assert.equal(exact.consensusEligible, true)
assert.equal(exact.runtimeEligible, false)
assert.equal(exact.registryStatus, "not_registered")
assert.equal(exact.majorityVoteUsed, false)
assert.deepEqual(exact.disagreements, [])

const runBWithCopiedInstruction = blindRun(
  "B",
  "blind.run.b.copied-context",
  claimDraft("claim.synthetic.hrv.b-copied-context"),
  [passageP1],
  downstreamTrustRegistry,
  runA.instructionSha256,
)
expectError(() => reconcileDnaBlindClaims({
  reconciliationId: "reconciliation.synthetic.copied-context",
  runA,
  claimAId: "claim.synthetic.hrv.a",
  runB: runBWithCopiedInstruction,
  claimBId: "claim.synthetic.hrv.b-copied-context",
}), "dna_evidence_blind_independence_or_integrity_invalid")

const runBDisagrees = blindRun("B", "blind.run.b.002", claimDraft("claim.synthetic.hrv.b-low", {
  evidenceLevel: "low",
  evidenceLevelEvidence: lowAppraisalEvidence,
}))
const contested = reconcileDnaBlindClaims({
  reconciliationId: "reconciliation.synthetic.contested",
  runA,
  claimAId: "claim.synthetic.hrv.a",
  runB: runBDisagrees,
  claimBId: "claim.synthetic.hrv.b-low",
})
assert.equal(contested.status, "contested")
assert.equal(contested.consensusEligible, false)
assert.deepEqual(contested.disagreements, ["evidence_level"])
assert.equal(contested.rereviewRequired, true)

const rereviewResolutionCore = {
  protocolId: "dna-claim-rereview@1" as const,
  reviewId: "rereview.synthetic.001",
  reviewedAt: "2026-07-19T14:00:00.000Z",
  sourceId: parsed.sourceId,
  artifactSha256: parsed.artifactSha256,
  reconciliationSha256: contested.reconciliationSha256,
  decision: "consensus" as const,
  rereadPassageIds: [passageP1.id],
  resolved: {
    passageIds: [passageP1.id],
    proposition: PROPOSITION,
    ageScope: "pediatric" as const,
    causalStatus: "associational" as const,
    evidenceLevel: "low" as const,
    evidenceLevelEvidence: lowAppraisalEvidence,
    claimBoundary: BOUNDARY,
  },
  rationaleCode: "source_reread_exact" as const,
}
expectError(() => applyDnaClaimRereview({
  reconciliation: contested,
  resolution: {
    ...rereviewResolutionCore,
    evidenceSha256: "c".repeat(64),
  },
  passages: [passageP1],
  parsedArtifact: parsed,
  trustRegistry: downstreamTrustRegistry,
}), "dna_evidence_rereview_evidence_commitment_invalid")
const rereviewed = applyDnaClaimRereview({
  reconciliation: contested,
  resolution: {
    ...rereviewResolutionCore,
    evidenceSha256: commitDnaEvidenceSubject(rereviewResolutionCore),
  },
  passages: [passageP1],
  parsedArtifact: parsed,
  trustRegistry: downstreamTrustRegistry,
})
assert.equal(rereviewed.status, "rereview_consensus_candidate")
assert.equal(rereviewed.consensusEligible, true)
assert.equal(rereviewed.runtimeEligible, false)

assert.equal(DNA_CURRENT_ACCEPTED_ATOMIC_CLAIM_REGISTRY.length, 0)
assert.equal(DNA_EVIDENCE_EXTRACTION_CONTRACT.acceptedRegistryCount, 0)
assert.equal(DNA_EVIDENCE_EXTRACTION_CONTRACT.majorityVotingAllowed, false)
assert.equal(DNA_EVIDENCE_EXTRACTION_CONTRACT.runtimeLlmAllowed, false)
assert.equal(DNA_EVIDENCE_EXTRACTION_CONTRACT.runtimeNetworkAllowed, false)
assert.equal(DNA_EVIDENCE_EXTRACTION_CONTRACT.autonomousExtractionImplemented, false)
assert.equal(DNA_EVIDENCE_EXTRACTION_CONTRACT.registeredEvidenceTrustRegistryCount, 0)
assert.equal(DNA_EVIDENCE_EXTRACTION_CONTRACT.callerAssertedGovernanceTrustAllowed, false)
assert.equal(DNA_EVIDENCE_EXTRACTION_CONTRACT.testFixtureTrustAllowedInProduction, false)

let actualJatsPilot: null | {
  sourceId: string
  artifactSha256: string
  paragraphCount: number
  exclusionCount: number
  forbiddenSectionCount: 0
  manifestHashBound: true
  status: "candidate_only"
  runtimeEligible: false
} = null

type ActualJatsCorpusRecord = Readonly<{
  sourceId: string
  sourceRecordSha256: string
  artifactId: string
  artifactRelativePath: string
  artifactSha256: string
  parsedContentSha256: string
  paragraphCount: number
  exclusionCount: number
  integrityState: string
  integrityAuditRecordSha256: string
  integrityDecisionSha256: string
  passageLicenseDecision: string
  componentLicenseAuditRecordSha256: string
  sourceGovernanceLicenseRecordSha256: string
  passageLicenseDecisionSha256: string
  status: "candidate_only"
  runtimeEligible: false
  releaseEligible: false
  blockerCodes: readonly string[]
}>

let actualJatsCorpus: null | {
  schemaVersion: "dna-v3-candidate-jats-corpus@3"
  sourceLibraryAuditAt: string
  governanceInputBindings: CandidateGovernanceInputBindings
  artifactCount: number
  sourceCount: number
  paragraphCount: number
  exclusionCount: number
  integrityClearedCount: number
  passageLicenseClearedCount: number
  crossGateEligibleCount: number
  methodReviewWorkpackCount: number
  methodReviewWorkpackSourceIds: readonly string[]
  methodReviewWorkpackIndexSha256: string
  excludedUncommittedArtifactCount: number
  excludedUncommittedArtifacts: readonly string[]
  releaseEligibleCount: 0
  records: readonly ActualJatsCorpusRecord[]
  manifestSha256: string
  outputPath: string | null
} = null

if (process.env.DNA_EVIDENCE_EXTRACTION_SSD === "1") {
  const repoRoot = process.cwd()
  const snapshotPath = path.join(repoRoot, "docs/dna-intelligence/governance/v3/source-library-governance-snapshot.json")
  const sourceIntegritySnapshotPath = path.join(
    repoRoot,
    "docs/dna-intelligence/governance/v3/source-integrity-archive-snapshot.json",
  )
  const snapshotBytes = fs.readFileSync(snapshotPath)
  const sourceIntegritySnapshotBytes = fs.readFileSync(sourceIntegritySnapshotPath)
  const snapshot = JSON.parse(snapshotBytes.toString("utf8")) as {
    licenseRecords: Array<{
      sourceId: string
      decisions: { passage: string }
      evidenceBasis: { passage: string }
    }>
  }
  const actualSourceId = "cosmin-prom-systematic-reviews-v2-2024"
  const licence = snapshot.licenseRecords.find((record) => record.sourceId === actualSourceId)
  assert.deepEqual({ decision: licence?.decisions.passage, basis: licence?.evidenceBasis.passage }, {
    decision: "cleared",
    basis: "verified_in_artifact",
  }, "Gerçek JATS pilotu yalnız passage-cleared artefaktla çalışmalı")
  const researchSsdRoot = process.env.RESEARCH_SSD_ROOT
  assert.ok(researchSsdRoot, "DNA_EVIDENCE_EXTRACTION_SSD için RESEARCH_SSD_ROOT zorunludur")
  const sourceRoot = process.env.DNA_SOURCE_LIBRARY_ROOT
    || path.join(researchSsdRoot, "Datasets/SelfMetaAI/dna-knowledge/source-library")
  const actualPath = path.join(
    sourceRoot,
    "evidence/cognition-development/cosmin-prom-systematic-reviews-v2-2024/raw/mokkink-2024.jats.xml",
  )
  assert.equal(fs.existsSync(actualPath), true, "Gerçek JATS source-library içinde bulunamadı")
  const sourceManifestPath = path.join(path.dirname(path.dirname(actualPath)), "source.json")
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8")) as {
    structuredTextArtifact: {
      path: string
      bytes: number
      sha256: string
    }
  }
  assert.equal(sourceManifest.structuredTextArtifact.path, "raw/mokkink-2024.jats.xml")
  const bytes = fs.readFileSync(actualPath)
  assert.equal(bytes.byteLength, sourceManifest.structuredTextArtifact.bytes,
    "Gerçek JATS boyutu source manifest ile aynı olmalı")
  assert.equal(hash(bytes), sourceManifest.structuredTextArtifact.sha256,
    "Gerçek JATS hash'i source manifest ile aynı olmalı")
  const actualParsed = parseDnaEvidenceArtifact({
    sourceId: actualSourceId,
    artifactId: "cosmin-prom-systematic-reviews-v2-2024.jats",
    format: "jats_xml",
    originalLanguage: "en",
    bytes,
    declaredSha256: sourceManifest.structuredTextArtifact.sha256,
  })
  assert.ok(actualParsed.paragraphs.length > 0)
  assert.equal(actualParsed.status, "candidate_only")
  assert.equal(actualParsed.runtimeEligible, false)
  const forbiddenSectionPattern = /^(?:supplement(?:ary)?(?: information)?|supporting information|appendix|references|reference list|bibliography|questionnaire(?: items)?|scale items|test items)(?:\b|$)/i
  const forbiddenSectionCount = actualParsed.paragraphs.filter((paragraph) =>
    paragraph.sectionPath.some((section) => forbiddenSectionPattern.test(section))).length
  assert.equal(forbiddenSectionCount, 0,
    "Gerçek JATS pilotunda yasak bölümden uygun paragraf kalmamalı")
  actualJatsPilot = {
    sourceId: actualSourceId,
    artifactSha256: actualParsed.artifactSha256,
    paragraphCount: actualParsed.paragraphs.length,
    exclusionCount: actualParsed.exclusions.reduce((sum, entry) => sum + entry.count, 0),
    forbiddenSectionCount: 0,
    manifestHashBound: true,
    status: actualParsed.status,
    runtimeEligible: actualParsed.runtimeEligible,
  }

  const integrityAuditPath = path.join(
    sourceRoot,
    "integrity-audit/v1/source-integrity-audit.json",
  )
  const componentLicenseAuditPath = path.join(
    sourceRoot,
    "governance-audit/v1/component-license-audit.json",
  )
  assert.equal(fs.existsSync(integrityAuditPath), true, "Kaynak bütünlük denetimi bulunamadı")
  assert.equal(fs.existsSync(componentLicenseAuditPath), true, "Bileşen lisans denetimi bulunamadı")
  const integrityAuditBytes = fs.readFileSync(integrityAuditPath)
  const componentLicenseAuditBytes = fs.readFileSync(componentLicenseAuditPath)
  const integrityAudit = JSON.parse(integrityAuditBytes.toString("utf8")) as {
    schemaVersion: string
    checkedAt: string
  }
  const componentLicenseAudit = JSON.parse(componentLicenseAuditBytes.toString("utf8")) as {
    schemaVersion: string
    auditedAt: string
  }
  assert.equal(integrityAudit.schemaVersion, "dna-source-integrity-audit@2")
  assert.equal(componentLicenseAudit.schemaVersion, "dna-component-license-audit@2")
  assert.match(integrityAudit.checkedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.match(componentLicenseAudit.auditedAt, /^\d{4}-\d{2}-\d{2}T/)
  const candidateTrustRoots = establishCandidateGovernanceTrustRoots({
    integrityAuditBytes,
    componentLicenseAuditBytes,
    sourceIntegritySnapshotBytes,
    sourceGovernanceSnapshotBytes: snapshotBytes,
  })
  const governanceInputBindings = candidateTrustRoots.governanceInputBindings
  const sourceTrustDecisionBySource = candidateTrustRoots.decisionsBySource

  const sourceManifestPaths: string[] = []
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (entry.isFile() && entry.name === "source.json") sourceManifestPaths.push(absolute)
    }
  }
  visit(path.join(sourceRoot, "evidence"))
  sourceManifestPaths.sort()

  type ArtifactCandidate = Readonly<{
    sourceId: string
    recordPath: string
    sourceRecordSha256: string
    baseDirectory: string
    relativePath: string
    artifactSha256: string
    declaredBytes: number
  }>
  const artifactCandidates: ArtifactCandidate[] = []
  const sourceManifestIdentities: Array<{
    sourceId: string
    sourceRecordSha256: string
    recordPath: string
  }> = []
  for (const recordPath of sourceManifestPaths) {
    const sourceRecordBytes = fs.readFileSync(recordPath)
    const record = JSON.parse(sourceRecordBytes.toString("utf8")) as {
      id?: string
      slug?: string
      structuredTextArtifact?: {
        path: string
        bytes: number
        sha256: string
        format?: string
        role?: string
      }
      artifacts?: Array<{
        path?: string
        relativePath?: string
        bytes?: number
        sha256?: string
        format?: string
        role?: string
      }>
      files?: Array<{
        path?: string
        bytes?: number
        sha256?: string
        format?: string
        role?: string
      }>
    }
    const sourceId = String(record.id || record.slug || "").trim()
    assert.ok(sourceId, `Kaynak kimliği yok: ${recordPath}`)
    const sourceRecordSha256 = hash(sourceRecordBytes)
    sourceManifestIdentities.push({ sourceId, sourceRecordSha256, recordPath })
    const recordDirectory = path.dirname(recordPath)
    const sourceDirectory = path.basename(recordDirectory) === "audit"
      ? path.dirname(recordDirectory)
      : recordDirectory
    const declaredArtifacts: Array<{
      baseDirectory: string
      path?: string
      relativePath?: string
      bytes?: number
      sha256?: string
      format?: string
      role?: string
    }> = [
      ...(record.structuredTextArtifact
        ? [{ ...record.structuredTextArtifact, baseDirectory: recordDirectory }] : []),
      ...(record.artifacts || []).map((artifact) => ({
        ...artifact,
        baseDirectory: recordDirectory,
      })),
      ...(record.files || []).map((artifact) => ({
        ...artifact,
        baseDirectory: sourceDirectory,
      })),
    ]
    for (const artifact of declaredArtifacts) {
      const relativePath = String(artifact.path || artifact.relativePath || "")
      const descriptor = `${relativePath} ${artifact.format || ""} ${artifact.role || ""}`
      if (!/(?:jats|preferred_passage_rag_source_candidate)/i.test(descriptor)) continue
      assert.match(relativePath, /\.xml$/i, `${sourceId}: JATS artefaktı XML olmalı`)
      assert.match(String(artifact.sha256 || ""), /^[a-f0-9]{64}$/, `${sourceId}: JATS hash eksik`)
      assert.ok(Number.isInteger(artifact.bytes) && Number(artifact.bytes) > 0,
        `${sourceId}: JATS byte sayısı eksik`)
      artifactCandidates.push({
        sourceId,
        recordPath,
        sourceRecordSha256,
        baseDirectory: artifact.baseDirectory,
        relativePath,
        artifactSha256: String(artifact.sha256),
        declaredBytes: Number(artifact.bytes),
      })
    }
  }
  uniqueSourceRecordMap(sourceManifestIdentities, "source_manifest")
  artifactCandidates.sort((left, right) => left.sourceId.localeCompare(right.sourceId))
  assert.equal(artifactCandidates.length, 26,
    "JATS korpus büyüklüğü değişti; yeni snapshot bilinçli olarak gözden geçirilmeli")
  assert.equal(new Set(artifactCandidates.map((artifact) => artifact.sourceId)).size, 26,
    "Her kaynak için tek tercih edilen JATS artefaktı olmalı")
  const committedArtifactPaths = new Set(artifactCandidates.map((artifact) =>
    path.resolve(artifact.baseDirectory, artifact.relativePath)))
  const physicalJatsPaths: string[] = []
  const visitJats = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visitJats(absolute)
      else if (entry.isFile() && entry.name.endsWith(".jats.xml")) physicalJatsPaths.push(absolute)
    }
  }
  visitJats(path.join(sourceRoot, "evidence"))
  physicalJatsPaths.sort()
  const excludedUncommittedArtifacts = physicalJatsPaths
    .filter((absolute) => !committedArtifactPaths.has(path.resolve(absolute)))
    .map((absolute) => path.relative(sourceRoot, absolute))
  assert.equal(physicalJatsPaths.length, 26,
    "Fiziksel JATS envanteri değişti; source manifest bağları yeniden gözden geçirilmeli")
  assert.equal(excludedUncommittedArtifacts.length, 0,
    "Manifest hash bağı olmayan JATS sayısı bilinçli olarak gözden geçirilmeli")

  const parsedArtifactsForWorkpack = new Map<string, ReturnType<typeof parseDnaEvidenceArtifact>>()
  const corpusRecords: ActualJatsCorpusRecord[] = artifactCandidates.map((artifact) => {
    const absolutePath = path.resolve(artifact.baseDirectory, artifact.relativePath)
    const containedPrefix = `${path.resolve(sourceRoot)}${path.sep}`
    assert.ok(absolutePath.startsWith(containedPrefix), `${artifact.sourceId}: source root dışına çıkılamaz`)
    assert.equal(fs.existsSync(absolutePath), true, `${artifact.sourceId}: JATS dosyası yok`)
    const bytes = fs.readFileSync(absolutePath)
    assert.equal(bytes.byteLength, artifact.declaredBytes, `${artifact.sourceId}: byte sayısı uyuşmuyor`)
    assert.equal(hash(bytes), artifact.artifactSha256, `${artifact.sourceId}: artefakt hash'i uyuşmuyor`)
    const parsedArtifact = parseDnaEvidenceArtifact({
      sourceId: artifact.sourceId,
      artifactId: `${artifact.sourceId}.jats`,
      format: "jats_xml",
      originalLanguage: "en",
      bytes,
      declaredSha256: artifact.artifactSha256,
    })
    assert.ok(parsedArtifact.paragraphs.length > 0, `${artifact.sourceId}: uygun paragraf yok`)
    assert.equal(parsedArtifact.status, "candidate_only")
    assert.equal(parsedArtifact.runtimeEligible, false)
    parsedArtifactsForWorkpack.set(artifact.sourceId, parsedArtifact)
    const forbiddenCount = parsedArtifact.paragraphs.filter((paragraph) =>
      paragraph.sectionPath.some((section) => forbiddenSectionPattern.test(section))).length
    assert.equal(forbiddenCount, 0, `${artifact.sourceId}: yasak bölüm paragrafı kaldı`)
    const sourceTrustDecision = sourceTrustDecisionBySource.get(artifact.sourceId)
    assert.ok(sourceTrustDecision, `${artifact.sourceId}: kaynak yönetişim kararı bulunamadı`)
    const integrityState = sourceTrustDecision.integrityState
    const passageLicenseDecision = sourceTrustDecision.passageLicenseDecision
    const blockerCodes = [
      ...(["verified_clean", "corrected"].includes(integrityState)
        ? [] : ["source_integrity_not_cleared"]),
      ...(passageLicenseDecision === "cleared" ? [] : ["passage_license_not_cleared"]),
      "method_appraisal_missing",
      "passage_metadata_approval_missing",
      "production_trust_registration_missing",
    ].sort()
    return Object.freeze({
      sourceId: artifact.sourceId,
      sourceRecordSha256: artifact.sourceRecordSha256,
      artifactId: parsedArtifact.artifactId,
      artifactRelativePath: path.relative(sourceRoot, absolutePath),
      artifactSha256: parsedArtifact.artifactSha256,
      parsedContentSha256: parsedArtifact.parsedContentSha256,
      paragraphCount: parsedArtifact.paragraphs.length,
      exclusionCount: parsedArtifact.exclusions.reduce((sum, entry) => sum + entry.count, 0),
      integrityState,
      integrityAuditRecordSha256: sourceTrustDecision.integrityAuditRecordSha256,
      integrityDecisionSha256: sourceTrustDecision.integrityDecisionSha256,
      passageLicenseDecision,
      componentLicenseAuditRecordSha256:
        sourceTrustDecision.componentLicenseAuditRecordSha256,
      sourceGovernanceLicenseRecordSha256:
        sourceTrustDecision.sourceGovernanceLicenseRecordSha256,
      passageLicenseDecisionSha256: sourceTrustDecision.passageLicenseDecisionSha256,
      status: "candidate_only" as const,
      runtimeEligible: false as const,
      releaseEligible: false as const,
      blockerCodes: Object.freeze(blockerCodes),
    })
  })
  const crossGateEligibleCount = corpusRecords.filter((record) =>
    ["verified_clean", "corrected"].includes(record.integrityState)
      && record.passageLicenseDecision === "cleared").length
  const methodReviewWorkpacks = corpusRecords.filter((record) =>
    ["verified_clean", "corrected"].includes(record.integrityState)
      && record.passageLicenseDecision === "cleared").map((record) => {
    const artifact = artifactCandidates.find((candidate) => candidate.sourceId === record.sourceId)
    const parsedArtifact = parsedArtifactsForWorkpack.get(record.sourceId)
    assert.ok(artifact && parsedArtifact, `${record.sourceId}: review workpack girdisi eksik`)
    const sourceRecord = JSON.parse(fs.readFileSync(artifact.recordPath, "utf8")) as {
      title?: string
      studyDesign?: string
      evidenceType?: string
      sourceRole?: string
      scopeBoundary?: string
      claimBoundary?: string
      bibliography?: {
        title?: string
        evidenceType?: string
      }
      dnaUse?: {
        claimBoundary?: string
      }
    }
    const declaredTitle = sourceRecord.title || sourceRecord.bibliography?.title || ""
    const declaredStudyDesign = sourceRecord.studyDesign || sourceRecord.evidenceType
      || sourceRecord.bibliography?.evidenceType || sourceRecord.sourceRole || "not_assessed"
    const declaredScopeBoundary = sourceRecord.scopeBoundary || sourceRecord.claimBoundary
      || sourceRecord.dnaUse?.claimBoundary || "not_assessed"
    assert.ok(declaredTitle.trim(), `${record.sourceId}: source manifest title workpack'e taşınamadı`)
    const workpackCore = {
      schemaVersion: "dna-v3-method-review-workpack@2" as const,
      status: "candidate_only" as const,
      runtimeEligible: false as const,
      releaseEligible: false as const,
      sourceId: record.sourceId,
      sourceRecordRelativePath: path.relative(sourceRoot, artifact.recordPath),
      sourceRecordSha256: record.sourceRecordSha256,
      title: String(declaredTitle),
      declaredStudyDesign: String(declaredStudyDesign),
      declaredScopeBoundary: String(declaredScopeBoundary),
      artifactId: record.artifactId,
      artifactRelativePath: record.artifactRelativePath,
      artifactSha256: record.artifactSha256,
      parsedContentSha256: record.parsedContentSha256,
      integrityState: record.integrityState,
      integrityAuditRecordSha256: record.integrityAuditRecordSha256,
      integrityDecisionSha256: record.integrityDecisionSha256,
      passageLicenseDecision: record.passageLicenseDecision,
      componentLicenseAuditRecordSha256: record.componentLicenseAuditRecordSha256,
      sourceGovernanceLicenseRecordSha256: record.sourceGovernanceLicenseRecordSha256,
      passageLicenseDecisionSha256: record.passageLicenseDecisionSha256,
      paragraphCount: parsedArtifact.paragraphs.length,
      exclusionCount: record.exclusionCount,
      paragraphs: parsedArtifact.paragraphs,
      exclusions: parsedArtifact.exclusions,
      reviewBoundary: Object.freeze([
        "This is reviewer input, not an appraisal or released evidence record.",
        "Every asserted method field must cite one or more paragraphId values from this workpack.",
        "Missing information must remain not_reported or not_assessed.",
        "DNA product validity and individual clinical inference are outside this workpack.",
      ]),
    }
    return Object.freeze({
      sourceId: record.sourceId,
      workpackSha256: hash(JSON.stringify(workpackCore)),
      workpack: Object.freeze(workpackCore),
    })
  }).sort((left, right) => left.sourceId.localeCompare(right.sourceId))
  assert.equal(methodReviewWorkpacks.length, crossGateEligibleCount)
  const methodReviewWorkpackSourceIds = Object.freeze(methodReviewWorkpacks.map((entry) =>
    entry.sourceId))
  const methodReviewWorkpackIndexRecords = methodReviewWorkpacks.map((entry) => ({
    sourceId: entry.sourceId,
    relativePath: `method-review-workpacks/${entry.sourceId}.json`,
    workpackSha256: entry.workpackSha256,
    sourceRecordSha256: entry.workpack.sourceRecordSha256,
    integrityState: entry.workpack.integrityState,
    integrityAuditRecordSha256: entry.workpack.integrityAuditRecordSha256,
    integrityDecisionSha256: entry.workpack.integrityDecisionSha256,
    passageLicenseDecision: entry.workpack.passageLicenseDecision,
    componentLicenseAuditRecordSha256: entry.workpack.componentLicenseAuditRecordSha256,
    sourceGovernanceLicenseRecordSha256:
      entry.workpack.sourceGovernanceLicenseRecordSha256,
    passageLicenseDecisionSha256: entry.workpack.passageLicenseDecisionSha256,
  }))
  const methodReviewWorkpackIndexCore = {
    schemaVersion: "dna-v3-method-review-workpack-index@3" as const,
    sourceLibraryAuditAt: integrityAudit.checkedAt,
    governanceInputBindings,
    records: methodReviewWorkpackIndexRecords,
  }
  const methodReviewWorkpackIndexSha256 = hash(JSON.stringify(methodReviewWorkpackIndexCore))
  const manifestCore = {
    schemaVersion: "dna-v3-candidate-jats-corpus@3" as const,
    sourceLibraryAuditAt: integrityAudit.checkedAt,
    governanceInputBindings,
    artifactCount: corpusRecords.length,
    sourceCount: new Set(corpusRecords.map((record) => record.sourceId)).size,
    paragraphCount: corpusRecords.reduce((sum, record) => sum + record.paragraphCount, 0),
    exclusionCount: corpusRecords.reduce((sum, record) => sum + record.exclusionCount, 0),
    integrityClearedCount: corpusRecords.filter((record) =>
      ["verified_clean", "corrected"].includes(record.integrityState)).length,
    passageLicenseClearedCount: corpusRecords.filter((record) =>
      record.passageLicenseDecision === "cleared").length,
    crossGateEligibleCount,
    methodReviewWorkpackCount: methodReviewWorkpacks.length,
    methodReviewWorkpackSourceIds,
    methodReviewWorkpackIndexSha256,
    excludedUncommittedArtifactCount: excludedUncommittedArtifacts.length,
    excludedUncommittedArtifacts: Object.freeze(excludedUncommittedArtifacts),
    releaseEligibleCount: 0 as const,
    records: Object.freeze(corpusRecords),
  }
  const manifestSha256 = hash(JSON.stringify(manifestCore))
  let outputPath: string | null = null
  if (process.env.DNA_WRITE_EVIDENCE_CANDIDATE_MANIFEST === "1") {
    const outputRoot = path.join(
      researchSsdRoot,
      "Datasets/DNA-Intelligence/work/v3/candidate-corpus",
    )
    fs.mkdirSync(outputRoot, { recursive: true })
    outputPath = path.join(outputRoot, "candidate-jats-corpus.json")
    fs.writeFileSync(outputPath, `${JSON.stringify({ ...manifestCore, manifestSha256 }, null, 2)}\n`, "utf8")
    const workpackRoot = path.join(outputRoot, "method-review-workpacks")
    fs.mkdirSync(workpackRoot, { recursive: true })
    for (const entry of methodReviewWorkpacks) {
      fs.writeFileSync(
        path.join(workpackRoot, `${entry.sourceId}.json`),
        `${JSON.stringify({ ...entry.workpack, workpackSha256: entry.workpackSha256 }, null, 2)}\n`,
        "utf8",
      )
    }
    const workpackIndex = {
      ...methodReviewWorkpackIndexCore,
      indexSha256: methodReviewWorkpackIndexSha256,
    }
    fs.writeFileSync(
      path.join(outputRoot, "method-review-workpack-index.json"),
      `${JSON.stringify(workpackIndex, null, 2)}\n`,
      "utf8",
    )
  }
  actualJatsCorpus = {
    ...manifestCore,
    manifestSha256,
    outputPath,
  }
}

console.log(JSON.stringify({
  ok: true,
  phases: DNA_EVIDENCE_EXTRACTION_CONTRACT.phases,
  synthetic: {
    eligibleParagraphs: parsed.paragraphs.length,
    exclusionReasons: parsed.exclusions,
    artifactInvalidationVerified: true,
    callerAssertedTrustAndProductionTestFixtureRejected: true,
    approvalTrustAndManualTextBindingVerified: true,
    explicitCandidateAuditPathVerifiedWithoutRuntimeAuthority: true,
    passageAdjacencyIdentityOverlapAndTrustVerified: true,
    atomicCompoundCausalEffectAndAppraisalGuardsVerified: true,
    blindRunsImmutableContextCommittedAndDistinct: true,
    forgedPassageAndCopiedContextRejected: true,
    exactConsensusCandidateOnly: true,
    disagreementContested: true,
    rereviewSourceBoundAndConsensusCandidateOnly: true,
    committedAuditTrustRootsVerified: true,
    auditDecisionRehashTamperingRejected: true,
    snapshotAuditDivergenceRejected: true,
    duplicateAndConflictingSourceIdsRejected: true,
    acceptedRegistryCount: 0,
  },
  actualJatsPilot,
  actualJatsCorpus,
}, null, 2))
