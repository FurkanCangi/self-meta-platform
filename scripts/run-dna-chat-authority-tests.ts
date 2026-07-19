import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import fixturesJson from "./dna-chat-fixtures/phase-02-authority-fixtures.json"
import {
  DNA_CHAT_CATALOG_CLAIMS,
  DNA_CHAT_CATALOG_RELATIONS,
  DNA_CHAT_CATALOG_SAFETY_RULES,
  DNA_CHAT_CATALOG_SOURCES,
  DNA_CHAT_CATALOG_TOPICS,
} from "../src/lib/dna/chat/catalog"
import {
  DNA_CHAT_LEGACY_PRODUCT_SOURCE_DISPOSITION,
  authorityForCatalogClaim,
  authorityForCatalogRelation,
  authorityForCatalogSource,
  authorityForCatalogTopic,
  authorityForCatalogTopicDetail,
  policyAuthorityForCatalogRule,
} from "../src/lib/dna/chat/authorityRegistry"
import {
  DNA_KNOWLEDGE_AUTHORITY_CONTRACT,
  DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
  DNA_KNOWLEDGE_AUTHORITY_LAYERS,
  DNA_PRODUCT_AUTHORITY_PENDING,
  EXTERNAL_SCIENCE_AUTHORITY_PENDING,
  canAuthoritySupportAnswerRole,
  createAuditedExternalScienceAuthority,
  createOwnerApprovedProductAuthority,
  createPolicyAuthority,
  isAuthorityGraphEdgeAllowed,
  isReleaseEligibleAuthority,
} from "../src/lib/dna/chat/knowledgeAuthority"
import {
  containsUnsupportedCaseBiologicalInference,
  createDnaChatSafeCaseContext,
  getDnaChatCaseContextAuthority,
} from "../src/lib/dna/chat/caseContext"
import {
  createCanonicalOwnedDnaCaseContext,
  DNA_OWNED_CASE_CONTEXT_VERSION,
  DNA_OWNED_CASE_LINEAGE_VERSION,
} from "../src/lib/dna/chat/ownedCaseContextCore"
import { resolveDnaChat } from "../src/lib/dna/chat/engine"
import { resolveDnaChatApiRequest } from "../src/lib/dna/chat/apiResolver"
import { resolveDnaCatalogReasoning } from "../src/lib/dna/chat/catalogReasoning"
import {
  createVerifiedTestCaseContext,
  TEST_REPORT_LINEAGE_IDS,
} from "./dna-chat-test-helpers"

type FixtureFile = {
  schemaVersion: string
  rules: Array<Record<string, unknown>>
}

const fixtures = fixturesJson as FixtureFile

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function stableAnswerHash(value: ReturnType<typeof resolveDnaChat>): string {
  const { safety, ...publicFields } = value
  return sha256({ ...publicFields, safety: { ...safety, redactedQuestion: "" } })
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"))
}

function fixture(id: string): Record<string, unknown> {
  const value = fixtures.rules.find((row) => row.id === id)
  assert.ok(value, `fixture missing: ${id}`)
  return value
}

function sourceFilesUnder(path: string): string[] {
  return readdirSync(resolve(process.cwd(), path), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map((entry) => resolve(entry.parentPath, entry.name))
}

async function main() {
  assert.equal(fixtures.schemaVersion, "dna-authority-fixtures@1")
  assert.equal(DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION, "dna-knowledge-authority@1")
  assert.deepEqual(
    readJson("docs/dna-intelligence/governance/knowledge-authority-contract.json"),
    JSON.parse(JSON.stringify(DNA_KNOWLEDGE_AUTHORITY_CONTRACT)),
    "Dokümante otorite sözleşmesi runtime kanoniğiyle aynı olmalı",
  )
  assert.deepEqual(
    [...DNA_KNOWLEDGE_AUTHORITY_LAYERS].sort(),
    [
      "case_information",
      "dna_product_information",
      "external_scientific_information",
      "safety_and_product_boundaries",
    ],
  )
  assert.equal(DNA_KNOWLEDGE_AUTHORITY_CONTRACT.authorities.length, 4)
  assert.equal(DNA_KNOWLEDGE_AUTHORITY_CONTRACT.nonSubstitutionRules.length, 5)

  assert.equal(DNA_PRODUCT_AUTHORITY_PENDING.verificationStatus, "pending")
  assert.equal(DNA_PRODUCT_AUTHORITY_PENDING.releaseEligible, false)
  assert.equal(EXTERNAL_SCIENCE_AUTHORITY_PENDING.verificationStatus, "pending")
  assert.equal(EXTERNAL_SCIENCE_AUTHORITY_PENDING.releaseEligible, false)
  assert.equal(isReleaseEligibleAuthority(DNA_PRODUCT_AUTHORITY_PENDING), false)
  assert.equal(isReleaseEligibleAuthority(EXTERNAL_SCIENCE_AUTHORITY_PENDING), false)
  assert.throws(() => createOwnerApprovedProductAuthority({
    approvalRecordId: "approval.record",
    bookVersion: "book.v1",
    bookSha256: "not-a-sha",
    sectionId: "section.1",
    passageId: "passage.1",
    artifactPassageSha256: "b".repeat(64),
    canonicalPassageSha256: "c".repeat(64),
  }), /invalid_book_sha256/)
  assert.throws(() => createAuditedExternalScienceAuthority({
    auditRunId: "audit.run",
    sourceId: "source.one",
    passageIds: ["passage.one"],
    passIds: ["pass.one"],
  }), /requires_multiple_audit_passes/)

  assert.throws(() => createOwnerApprovedProductAuthority({
    approvalRecordId: "approval.record.1",
    bookVersion: "dna-book@1",
    bookSha256: "a".repeat(64),
    sectionId: "section.1",
    passageId: "passage.1",
    artifactPassageSha256: "b".repeat(64),
    canonicalPassageSha256: "c".repeat(64),
  }), /owner_approval_not_registered/)
  assert.throws(() => createAuditedExternalScienceAuthority({
    auditRunId: "audit.run.1",
    sourceId: "source.one",
    passageIds: ["passage.one"],
    passIds: ["blind.pass.a", "blind.pass.b"],
  }), /science_audit_not_registered/)
  const policy = createPolicyAuthority({
    policyVersion: "dna-intelligence-intended-use@1",
    publicClauseIds: ["intended_use.boundary"],
  })
  assert.throws(() => createPolicyAuthority({
    policyVersion: "dna-intelligence-intended-use@1",
    publicClauseIds: ["prohibited.unregistered_clause"],
  }), /policy_clause_not_registered/)
  assert.equal(isReleaseEligibleAuthority(policy), true)
  assert.equal(canAuthoritySupportAnswerRole(DNA_PRODUCT_AUTHORITY_PENDING, "product_definition"), true)
  assert.equal(canAuthoritySupportAnswerRole(DNA_PRODUCT_AUTHORITY_PENDING, "product_definition", { requireReleaseEligible: true }), false)
  assert.equal(canAuthoritySupportAnswerRole(DNA_PRODUCT_AUTHORITY_PENDING, "scientific_evidence"), false)
  assert.equal(canAuthoritySupportAnswerRole(EXTERNAL_SCIENCE_AUTHORITY_PENDING, "product_definition"), false)
  assert.equal(canAuthoritySupportAnswerRole(EXTERNAL_SCIENCE_AUTHORITY_PENDING, "dna_specific_validation"), false)
  assert.equal(canAuthoritySupportAnswerRole(EXTERNAL_SCIENCE_AUTHORITY_PENDING, "dna_specific_validation", { dnaSpecificEvidence: true }), true)
  assert.equal(canAuthoritySupportAnswerRole(policy, "safety_boundary", { requireReleaseEligible: true }), true)

  const forgedOwner = {
    ...DNA_PRODUCT_AUTHORITY_PENDING,
    verificationStatus: "verified",
    releaseEligible: true,
    proof: {
      kind: "owner_approval",
      approvalRecordId: "approval.forged",
      bookVersion: "dna-book@forged",
      bookSha256: "not-a-hash",
      sectionId: "section.forged",
      passageId: "passage.forged",
    },
  } as never
  assert.equal(isReleaseEligibleAuthority(forgedOwner), false)
  const forgedCase = {
    ...getDnaChatCaseContextAuthority(createDnaChatSafeCaseContext({
      dataStatus: "synthetic",
      scores: { sensory: 24 },
    })),
    verificationStatus: "verified",
    releaseEligible: true,
    proof: {
      kind: "report_lineage",
      contextVersion: "dna-chat-context@1",
      lineage: "owned_structured_report_context",
      ownershipVerified: true,
    },
  } as never
  assert.equal(isReleaseEligibleAuthority(forgedCase), false)
  assert.equal(canAuthoritySupportAnswerRole(forgedCase, "case_finding"), false)

  for (const topic of DNA_CHAT_CATALOG_TOPICS) {
    const authority = authorityForCatalogTopic(topic)
    assert.ok(DNA_KNOWLEDGE_AUTHORITY_LAYERS.includes(authority.layer), `${topic.id}: topic authority`)
    for (const detail of topic.details) {
      const detailAuthority = authorityForCatalogTopicDetail(topic, detail)
      assert.ok(DNA_KNOWLEDGE_AUTHORITY_LAYERS.includes(detailAuthority.layer), `${topic.id}: detail authority`)
    }
  }
  for (const claim of DNA_CHAT_CATALOG_CLAIMS) {
    const authority = authorityForCatalogClaim(claim)
    assert.ok(DNA_KNOWLEDGE_AUTHORITY_LAYERS.includes(authority.layer), `${claim.id}: claim authority`)
  }
  const topicsById = new Map(DNA_CHAT_CATALOG_TOPICS.map((topic) => [topic.id, topic]))
  for (const relation of DNA_CHAT_CATALOG_RELATIONS) {
    const authority = authorityForCatalogRelation(relation)
    assert.ok(DNA_KNOWLEDGE_AUTHORITY_LAYERS.includes(authority.layer), `${relation.id}: relation authority`)
    const from = topicsById.get(relation.fromTopicId)
    const to = topicsById.get(relation.toTopicId)
    assert.ok(from && to, `${relation.id}: relation topic closure`)
    assert.equal(isAuthorityGraphEdgeAllowed({
      from: authorityForCatalogTopic(from!).layer,
      to: authorityForCatalogTopic(to!).layer,
      predicate: relation.predicate,
    }), true, `${relation.id}: illegal authority edge`)
  }
  for (const source of DNA_CHAT_CATALOG_SOURCES) {
    const authority = authorityForCatalogSource()
    assert.equal(authority.layer, "external_scientific_information", `${source.id}: source authority`)
    assert.equal(authority.verificationStatus, "pending", `${source.id}: no false multi-pass approval`)
  }
  for (const rule of DNA_CHAT_CATALOG_SAFETY_RULES) {
    const authority = policyAuthorityForCatalogRule(rule)
    assert.equal(authority.layer, "safety_and_product_boundaries", `${rule.id}: safety policy authority`)
    assert.equal(authority.releaseEligible, true, `${rule.id}: policy enforcement`)
  }

  assert.equal(Object.keys(DNA_CHAT_LEGACY_PRODUCT_SOURCE_DISPOSITION).length, 9)
  assert.ok(Object.values(DNA_CHAT_LEGACY_PRODUCT_SOURCE_DISPOSITION).every((value) =>
    ["pending_owner_approval", "policy_enforced", "split_required_in_phase_3"].includes(value)))

  const productQuestion = String(fixture("product_cannot_replace_science").productQuestion)
  const scienceQuestion = String(fixture("product_cannot_replace_science").scienceQuestion)
  const productAnswer = resolveDnaChat({ question: productQuestion })
  const scienceAnswer = resolveDnaChat({ question: scienceQuestion })
  assert.equal(productAnswer.outcome, "answered")
  assert.ok(productAnswer.answerUnits.filter((unit) => unit.kind === "summary" || unit.kind === "detail")
    .every((unit) => unit.authority.layer === "dna_product_information"))
  assert.ok(productAnswer.sources.every((source) => source.authority.layer === "dna_product_information"))
  assert.ok(productAnswer.sources.every((source) => source.authority.verificationStatus === "pending"))
  assert.equal(scienceAnswer.outcome, "answered")
  assert.ok(scienceAnswer.answerUnits.filter((unit) => unit.kind === "summary" || unit.kind === "detail")
    .every((unit) => unit.authority.layer === "external_scientific_information"))
  assert.ok(scienceAnswer.sources.every((source) => source.authority.layer === "external_scientific_information"))
  assert.doesNotMatch(JSON.stringify(scienceAnswer.sources), /Onaylı DNA Asistanı/)

  const hrvQuestion = "HRV tam olarak neyi ölçer?"
  const hrvDraft = resolveDnaCatalogReasoning({ question: hrvQuestion })
  const hrvAnswer = resolveDnaChat({ question: hrvQuestion })
  assert.ok(hrvDraft?.outputSourceIds)
  assert.equal(hrvAnswer.outcome, "answered")
  const hrvMaterialUnits = hrvAnswer.answerUnits.filter((unit) =>
    unit.kind === "summary" || unit.kind === "detail")
  for (const [index, unit] of hrvMaterialUnits.entries()) {
    const provenance = index === 0
      ? hrvDraft!.outputSourceIds!.summary
      : hrvDraft!.outputSourceIds!.details[index - 1] ?? []
    assert.ok(
      unit.sourceIds.every((sourceId) =>
        provenance.includes(sourceId.slice(sourceId.indexOf(":") + 1))),
      `${unit.id}: claim/relation provenance dışı kaynak bağlandı`,
    )
  }
  assert.ok(hrvMaterialUnits.some((unit) => unit.sourceIds.length > 0))

  const unsupportedDnaHrvRelation = resolveDnaChat({
    question: "DNA duygusal düzenleme alanı ile HRV arasında ilişki var mı?",
  })
  assert.equal(unsupportedDnaHrvRelation.classification, "not_available")
  assert.equal(unsupportedDnaHrvRelation.sources.length, 0)
  assert.match(unsupportedDnaHrvRelation.summary, /açık bir ilişki kaydı bulunmuyor/)
  for (const answer of [productAnswer, scienceAnswer]) {
    for (const unit of answer.answerUnits) {
      assert.equal(
        canAuthoritySupportAnswerRole(unit.authority, unit.role),
        true,
        `${unit.id}: runtime authority role`,
      )
      for (const sourceId of unit.sourceIds) {
        const source = answer.sources.find((candidate) => candidate.id === sourceId)
        assert.ok(source, `${unit.id}: source closure ${sourceId}`)
        assert.equal(source?.authority.layer, unit.authority.layer)
      }
      if (
        ["summary", "detail", "case_evidence"].includes(unit.kind) &&
        unit.sourceIds.length === 0 &&
        unit.authority.layer !== "safety_and_product_boundaries"
      ) {
        assert.equal(
          unit.authority.releaseEligible,
          false,
          `${unit.id}: only non-release transition content may lack a source link`,
        )
      }
    }
  }

  const validationFixture = fixture("general_science_cannot_validate_dna")
  const dnaEvidenceAnswer = resolveDnaChat({ question: String(validationFixture.question) })
  assert.equal(dnaEvidenceAnswer.evidenceSummary?.dnaValidationStatus, validationFixture.expectedValidationStatus)
  assert.equal(dnaEvidenceAnswer.evidenceSummary?.level, "DNA'ya özgü doğrulama yok")
  assert.equal(dnaEvidenceAnswer.evidenceSummary?.scientificEvidenceLevel, "Güçlü")
  assert.ok(dnaEvidenceAnswer.limitations.some((line) => /otomatik olarak kanıtlamaz/.test(line)))
  assert.ok(dnaEvidenceAnswer.authoritySummary.some((entry) => entry.layer === "dna_product_information"))
  assert.ok(dnaEvidenceAnswer.authoritySummary.some((entry) => entry.layer === "external_scientific_information"))

  const biologicalFixture = fixture("case_cannot_be_biological_measurement")
  const injected = String(biologicalFixture.forbiddenPayload)
  const syntheticContext = createDnaChatSafeCaseContext({
    dataStatus: "synthetic",
    ageMonths: 96,
    scores: { sensory: 24, cognitive: 39 },
    levels: { sensory: "Riskli", cognitive: "Tipik" },
    chatContext: {
      primaryAxis: "Duyusal alanda göreli zorlanma",
      mechanismLabel: "Vagus siniri yetersizliği",
      mechanismSummary: injected,
      caseEvidenceLines: ["Duyusal alan Riskli düzeydedir."],
      dataLimitations: ["Doğrudan fizyolojik ölçüm bulunmamaktadır."],
    } as never,
  })
  assert.equal(getDnaChatCaseContextAuthority(syntheticContext).verificationStatus, "test_only")
  assert.equal(isReleaseEligibleAuthority(getDnaChatCaseContextAuthority(syntheticContext)), false)
  const caseAnswer = resolveDnaChat({
    question: String(biologicalFixture.question),
    caseContext: syntheticContext,
  })
  assert.equal(caseAnswer.outcome, "answered")
  assert.equal(JSON.stringify(caseAnswer).includes(injected), false)
  assert.equal(JSON.stringify(caseAnswer).toLocaleLowerCase("tr-TR").includes("vagus siniri yetersizliği"), false)
  assert.ok(caseAnswer.answerUnits.filter((unit) => unit.kind === "case_evidence")
    .every((unit) => unit.authority.layer === "case_information"))

  const ownedContext = createVerifiedTestCaseContext({
    dataStatus: "deidentified",
    ageMonths: 96,
    scores: { sensory: 24, cognitive: 39 },
    levels: { sensory: "Riskli", cognitive: "Tipik" },
    chatContext: {
      primaryAxis: "Duyusal alanda göreli zorlanma",
      caseEvidenceLines: ["Duyusal alan Riskli düzeydedir."],
      dataLimitations: ["Doğrudan fizyolojik ölçüm bulunmamaktadır."],
    },
  })
  assert.equal(getDnaChatCaseContextAuthority(ownedContext).verificationStatus, "test_only")

  const validLineage = {
    reportId: TEST_REPORT_LINEAGE_IDS.reportId,
    loadedReportId: TEST_REPORT_LINEAGE_IDS.reportId,
    assessmentId: TEST_REPORT_LINEAGE_IDS.assessmentId,
    loadedAssessmentId: TEST_REPORT_LINEAGE_IDS.assessmentId,
    clientId: TEST_REPORT_LINEAGE_IDS.clientId,
    loadedClientId: TEST_REPORT_LINEAGE_IDS.clientId,
    ownerId: TEST_REPORT_LINEAGE_IDS.ownerId,
    sessionUserId: TEST_REPORT_LINEAGE_IDS.ownerId,
  }
  const openWordBiologyPayloads = [
    "Kalp ritmi değişkenliği azdır",
    "Kalp atış aralıkları tekdüzedir",
    "Bademcik çekirdeği aşırı aktiftir",
    "Beynin ön bölgesi zayıf çalışıyor",
    "Sakinleşme siniri çalışmıyor",
    "Kaç-savaş devresi sürekli açıktır",
    "Dinlen-sindir devresi zayıftır",
    "Beyin kimyası dengesizdir",
  ]
  const untrustedSnapshot = {
    age_months: 96,
    scores: { sensory: 24, cognitive: 39 },
    domain_levels: { sensory: "Riskli", cognitive: "Tipik" },
    chat_context: {
      version: "dna-chat-context@1",
      primaryAxis: openWordBiologyPayloads[0],
      caseEvidenceLines: openWordBiologyPayloads,
      dataLimitations: ["Serbest rapor metni"],
    },
    report_text: openWordBiologyPayloads.join(" "),
    anamnez: "Kanonik bağlama girmemeli",
    trace: { ruleId: "internal.rule" },
  }
  const canonicalOwned = createCanonicalOwnedDnaCaseContext(untrustedSnapshot, validLineage)
  const canonicalSerialized = JSON.stringify(canonicalOwned.context)
  for (const payload of openWordBiologyPayloads) {
    assert.equal(canonicalSerialized.includes(payload), false, `canonical allowlist: ${payload}`)
  }
  assert.equal(canonicalOwned.context.unsafeClaimCount, 0)
  assert.equal(canonicalOwned.context.redactionCount, 0)
  assert.equal(canonicalOwned.provenance.contextVersion, DNA_OWNED_CASE_CONTEXT_VERSION)
  assert.equal(canonicalOwned.provenance.lineageVersion, DNA_OWNED_CASE_LINEAGE_VERSION)
  for (const hash of [
    canonicalOwned.provenance.sourcePayloadSha256,
    canonicalOwned.provenance.safeContextSha256,
    canonicalOwned.provenance.lineageBindingSha256,
  ]) {
    assert.match(hash, /^[a-f0-9]{64}$/)
  }
  assert.notEqual(
    canonicalOwned.provenance.sourcePayloadSha256,
    canonicalOwned.provenance.safeContextSha256,
    "Kaynak payload ve final güvenli bağlam ayrı hashlenmeli",
  )
  assert.deepEqual(
    createCanonicalOwnedDnaCaseContext(untrustedSnapshot, validLineage),
    canonicalOwned,
    "Kanonik vaka bağlamı ve lineage hashleri deterministik olmalı",
  )
  assert.throws(() => createCanonicalOwnedDnaCaseContext(
    untrustedSnapshot,
    { ...validLineage, loadedReportId: "55555555-5555-4555-8555-555555555555" },
  ), /lineage_not_verified/)
  assert.throws(() => createCanonicalOwnedDnaCaseContext(
    untrustedSnapshot,
    { ...validLineage, sessionUserId: "55555555-5555-4555-8555-555555555555" },
  ), /lineage_not_verified/)

  const biologicalEchoPayloads = [
    "Düşük vagal ton",
    "Vagus siniri yetersizliği",
    "Sempatik baskınlık",
    "İnsula aktivitesi düşüktür",
    "Kortizol düzeyi yüksektir",
    "Dorsal vagal durum",
    "Biyolojik mekanizma: vagus siniri yetersizliği",
  ]
  for (const payload of biologicalEchoPayloads) {
    assert.equal(containsUnsupportedCaseBiologicalInference(payload), true, payload)
    const fieldPayloads: Array<{ field: string; input: Record<string, unknown> }> = [
      { field: "themes", input: { themes: [payload] } },
      { field: "observations", input: { observations: [payload] } },
      { field: "externalFindings", input: { externalFindings: [payload] } },
      { field: "primaryAxis", input: { chatContext: { primaryAxis: payload } } },
      { field: "secondaryAxes", input: { chatContext: { secondaryAxes: [payload] } } },
      { field: "caseEvidenceLines", input: { chatContext: { caseEvidenceLines: [payload] } } },
      { field: "counterEvidenceLines", input: { chatContext: { counterEvidenceLines: [payload] } } },
      { field: "preservedCapacityLines", input: { chatContext: { preservedCapacityLines: [payload] } } },
      { field: "dataLimitations", input: { chatContext: { dataLimitations: [payload] } } },
      { field: "confidenceLevel", input: { chatContext: { confidenceLevel: payload } } },
      { field: "confidenceRationale", input: { chatContext: { confidenceRationale: payload } } },
      { field: "weakDomains", input: { chatContext: { weakDomains: [payload] } } },
      { field: "strongDomains", input: { chatContext: { strongDomains: [payload] } } },
      { field: "patterns", input: { chatContext: { patterns: [payload] } } },
    ]
    for (const { field, input } of fieldPayloads) {
      const filteredContext = createVerifiedTestCaseContext({
        dataStatus: "deidentified",
        scores: { sensory: 24 },
        levels: { sensory: "Riskli" },
        ...input,
      } as never)
      const filteredAnswer = resolveDnaChat({
        question: "Son raporumu özetle.",
        caseContext: filteredContext,
      })
      assert.equal(JSON.stringify(filteredAnswer).includes(payload), false, `${field}: ${payload}`)
      assert.ok(filteredContext.unsafeClaimCount > 0, `${field}: unsafe claim counter`)
      assert.ok(filteredAnswer.limitations.some((line) => /biyolojik mekanizma ifadeleri/.test(line)))
    }
  }

  const policyFixture = fixture("policy_cannot_be_overridden")
  const refusalWithoutCase = resolveDnaChat({ question: String(policyFixture.question) })
  const refusalWithCase = resolveDnaChat({ question: String(policyFixture.question), caseContext: ownedContext })
  assert.equal(refusalWithoutCase.outcome, policyFixture.expectedOutcome)
  assert.equal(refusalWithCase.outcome, policyFixture.expectedOutcome)
  assert.equal(refusalWithoutCase.sources.length, 0)
  assert.equal(refusalWithCase.sources.length, 0)
  assert.equal(refusalWithCase.caseEvidence.length, 0)
  assert.equal(stableAnswerHash(refusalWithoutCase), stableAnswerHash(refusalWithCase))
  assert.ok(refusalWithCase.answerUnits.every((unit) =>
    unit.authority.layer === "safety_and_product_boundaries"))

  const edgeFixture = fixture("science_cannot_redefine_product")
  for (const predicate of edgeFixture.forbiddenPredicates as string[]) {
    assert.equal(isAuthorityGraphEdgeAllowed({
      from: "external_scientific_information",
      to: "dna_product_information",
      predicate,
    }), false, `external science must not ${predicate} product`)
  }
  assert.equal(isAuthorityGraphEdgeAllowed({
    from: "case_information",
    to: "external_scientific_information",
    predicate: "measures",
  }), false)
  assert.equal(isAuthorityGraphEdgeAllowed({
    from: "external_scientific_information",
    to: "safety_and_product_boundaries",
    predicate: "overrides",
  }), false)
  assert.equal(isAuthorityGraphEdgeAllowed({
    from: "external_scientific_information",
    to: "external_scientific_information",
    predicate: "invented_predicate",
  }), false, "Bilinmeyen graf predicate fail-closed olmalı")

  const mixedAnswer = resolveDnaChat({
    question: "Bu rapordaki bulguyu interosepsiyon teorisiyle birlikte tartış.",
    caseContext: ownedContext,
  })
  assert.equal(mixedAnswer.outcome, "answered")
  assert.ok(mixedAnswer.answerUnits.some((unit) => unit.authority.layer === "case_information"))
  assert.ok(mixedAnswer.answerUnits.some((unit) => unit.authority.layer === "external_scientific_information"))
  assert.ok(mixedAnswer.answerUnits.some((unit) => unit.authority.layer === "safety_and_product_boundaries"))
  assert.ok(mixedAnswer.limitations.includes("Bu vakada biyolojik mekanizma doğrudan ölçülmedi."))
  for (const unit of mixedAnswer.answerUnits) {
    assert.ok(unit.authority && !Array.isArray(unit.authority), `${unit.id}: exactly one authority`)
    for (const sourceId of unit.sourceIds) {
      const source = mixedAnswer.sources.find((candidate) => candidate.id === sourceId)
      assert.ok(source, `${unit.id}: source closure ${sourceId}`)
      assert.equal(source?.authority.layer, unit.authority.layer, `${unit.id}: source authority parity`)
    }
  }

  const apiOwned = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.",
    reportId: TEST_REPORT_LINEAGE_IDS.reportId,
  }, {
    createRequestId: () => "authority-api-owned",
    loadCaseAnswer: async ({ question, mode, previousTopic }) => ({
      ok: true,
      answer: resolveDnaChat({ question, mode, previousTopic, caseContext: ownedContext }),
    }),
    writeAudit: async (audit) => {
      assert.equal(audit.authorityContractVersion, DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION)
      assert.ok(audit.authoritySet.includes("case_information"))
      assert.equal(audit.policyVersion, "dna-intelligence-intended-use@1")
      return { ok: true }
    },
  })
  assert.equal(apiOwned.status, 200)
  assert.ok(Array.isArray(apiOwned.body.answerUnits))
  assert.ok(Array.isArray(apiOwned.body.authoritySummary))
  assert.ok((apiOwned.body.answerUnits as Array<Record<string, unknown>>).every((unit) =>
    typeof unit.role === "string" && unit.authority && typeof unit.authority === "object"))
  assert.doesNotMatch(
    JSON.stringify(apiOwned.body),
    /auditRunId|passIds|approvalRecordId|ownershipVerified|publicClauseIds|"proof"/,
    "Public API internal authority proof identifiers must stay hidden",
  )

  const apiForeign = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.",
    reportId: "55555555-5555-4555-8555-555555555555",
  }, {
    createRequestId: () => "authority-api-foreign",
    loadCaseAnswer: async () => ({ ok: false, status: 404, error: "report_not_found" }),
    writeAudit: async () => ({ ok: true }),
  })
  assert.equal(apiForeign.status, 404)
  assert.deepEqual(apiForeign.body, { ok: false, error: "report_not_found" })

  assert.doesNotMatch(
    readFileSync(resolve(process.cwd(), "src/lib/dna/chat/ownedCaseAnswer.ts"), "utf8"),
    /ownershipVerified\s*:/,
    "Üretim sınırı caller-supplied ownership boolean kabul etmemeli",
  )
  const publicBarrel = readFileSync(resolve(process.cwd(), "src/lib/dna/chat/index.ts"), "utf8")
  assert.doesNotMatch(
    publicBarrel,
    /bindOwnedDnaReportCaseContext|createOwnedDnaReportCaseContext|createVerifiedReportCaseAuthorityInternal|createPolicyAuthority/,
  )
  const ownedBoundary = readFileSync(
    resolve(process.cwd(), "src/lib/dna/chat/ownedCaseAnswer.ts"),
    "utf8",
  )
  assert.match(ownedBoundary, /import "server-only"/)
  assert.match(ownedBoundary, /createSupabaseServerClient/)
  assert.match(ownedBoundary, /\.from\("reports"\)/)
  assert.match(ownedBoundary, /\.from\("assessments_v2"\)/)
  assert.match(ownedBoundary, /\.from\("clients"\)/)
  assert.match(ownedBoundary, /\.eq\("owner_id", input\.userId\)/)
  assert.match(ownedBoundary, /createCanonicalOwnedDnaCaseContext/)
  assert.match(ownedBoundary, /createVerifiedReportCaseAuthorityInternal/)
  const issuerConsumers = sourceFilesUnder("src")
    .filter((path) => /createVerifiedReportCaseAuthorityInternal/.test(readFileSync(path, "utf8")))
    .map((path) => path.replace(`${process.cwd()}/`, ""))
    .sort()
  assert.deepEqual(issuerConsumers, [
    "src/lib/dna/chat/knowledgeAuthority.ts",
    "src/lib/dna/chat/ownedCaseAnswer.ts",
  ], "Release-capable vaka otoritesi yalnız tanım ve server-only sahiplik sınırında bulunmalı")
  const attacherConsumers = sourceFilesUnder("src")
    .filter((path) => /attachVerifiedReportCaseAuthorityInternal/.test(readFileSync(path, "utf8")))
    .map((path) => path.replace(`${process.cwd()}/`, ""))
    .sort()
  assert.deepEqual(attacherConsumers, [
    "src/lib/dna/chat/caseContext.ts",
    "src/lib/dna/chat/ownedCaseAnswer.ts",
  ], "Doğrulanmış vaka otoritesi yalnız tanım ve server-only sahiplik sınırında bağlanmalı")
  assert.match(
    readFileSync(resolve(process.cwd(), "src/app/api/app/dna-chat/route.ts"), "utf8"),
    /resolveOwnedDnaCaseAnswer/,
  )
  const assistantUi = readFileSync(
    resolve(process.cwd(), "src/app/dna-asistani/DnaAssistantClient.tsx"),
    "utf8",
  )
  for (const requiredUiContract of [
    "answer.answerUnits.map",
    "Otoritesine göre ayrılmış yanıt",
    'case_evidence: "Rapor dayanağı"',
    'limitation: "Sınırlılık"',
    'safety_boundary: "Güvenlik sınırı"',
    "Denetim bekliyor",
    "unit.authority.boundaryTr",
    "source.authority?.boundaryTr",
    "!hasStructuredUnits && answer.caseEvidence.length",
    "!hasStructuredUnits && answer.limitations.length",
    "!hasStructuredUnits && answer.safetyBoundary",
    "Yanıtta kullanılan bilgi otoriteleri",
  ]) {
    assert.ok(assistantUi.includes(requiredUiContract), `UI authority contract: ${requiredUiContract}`)
  }

  const deterministicHashes = Array.from({ length: 20 }, () => stableAnswerHash(
    resolveDnaChat({ question: String(validationFixture.question) }),
  ))
  assert.equal(new Set(deterministicHashes).size, 1)

  console.log(JSON.stringify({
    ok: true,
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    authorities: DNA_KNOWLEDGE_AUTHORITY_LAYERS.length,
    substitutionRules: DNA_KNOWLEDGE_AUTHORITY_CONTRACT.nonSubstitutionRules.length,
    catalogCoverage: {
      topics: DNA_CHAT_CATALOG_TOPICS.length,
      claims: DNA_CHAT_CATALOG_CLAIMS.length,
      relations: DNA_CHAT_CATALOG_RELATIONS.length,
      sources: DNA_CHAT_CATALOG_SOURCES.length,
      safetyRules: DNA_CHAT_CATALOG_SAFETY_RULES.length,
    },
    pendingTruthfullyRepresented: {
      product: DNA_PRODUCT_AUTHORITY_PENDING.verificationStatus,
      science: EXTERNAL_SCIENCE_AUTHORITY_PENDING.verificationStatus,
    },
    mechanismInjectionBlocked: true,
    caseLineageSpoofBlocked: true,
    mixedAnswerPartitioned: true,
    runtimeNonSubstitutionRules: "5/5",
    biologicalEchoFieldProbes: biologicalEchoPayloads.length * 14,
    canonicalFreeTextFieldsAccepted: 0,
    verifiedCaseIssuerRuntimeConsumers: 1,
    uiAuthorityPartitionVisible: true,
    deterministicRuns: deterministicHashes.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
