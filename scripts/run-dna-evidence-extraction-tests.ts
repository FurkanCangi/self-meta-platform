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

if (process.env.DNA_EVIDENCE_EXTRACTION_SSD === "1") {
  const repoRoot = process.cwd()
  const snapshotPath = path.join(repoRoot, "docs/dna-intelligence/governance/v3/source-library-governance-snapshot.json")
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as {
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
  const forbiddenSectionPattern = /\b(?:supplement(?:ary)?|supporting information|appendix|references?|bibliography|questionnaire|scale items|test items)\b/i
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
    passageAdjacencyIdentityOverlapAndTrustVerified: true,
    atomicCompoundCausalEffectAndAppraisalGuardsVerified: true,
    blindRunsImmutableContextCommittedAndDistinct: true,
    forgedPassageAndCopiedContextRejected: true,
    exactConsensusCandidateOnly: true,
    disagreementContested: true,
    rereviewSourceBoundAndConsensusCandidateOnly: true,
    acceptedRegistryCount: 0,
  },
  actualJatsPilot,
}, null, 2))
