import assert from "node:assert/strict"
import { performance } from "node:perf_hooks"

import {
  buildDnaChatAuditMetadata,
  DNA_CHAT_AUDIT_METADATA_KEYS,
  readDnaChatRequestBody,
  resolveDnaChat,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
  type DnaChatCaseLoadResult,
} from "../src/lib/dna/chat"
import {
  createVerifiedTestCaseContext,
  TEST_REPORT_LINEAGE_IDS,
} from "./dna-chat-test-helpers"
import { createDnaV3RuntimeAnswerInternal } from "../src/lib/dna/chat/runtimeAnswer"
import type { DnaV3RetrievalAnswer } from "../src/lib/dna/chat/v3RetrievalCore"

function percentile(values: readonly number[], p: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0
}

const safeCaseContext = createVerifiedTestCaseContext({
  dataStatus: "deidentified",
  ageMonths: 48,
  scores: {
    physiological: 28,
    sensory: 31,
    emotional: 39,
    cognitive: 42,
    executive: 38,
    interoception: 36,
  },
  levels: {
    physiological: "Riskli",
    sensory: "Riskli",
    emotional: "Tipik",
    cognitive: "Tipik",
    executive: "Tipik",
    interoception: "Tipik",
  },
  chatContext: {
    primaryAxis: "Kimliksiz sentetik ana eksen",
    caseEvidenceLines: ["Fizyolojik alan sentetik Riskli düzeydedir."],
    counterEvidenceLines: ["Bilişsel alan sentetik Tipik düzeydedir."],
    preservedCapacityLines: ["Bilişsel regülasyon göreli korunmuştur."],
    dataLimitations: ["Doğrudan fizyolojik ölçüm bulunmamaktadır."],
  },
})

function dependencies(options: {
  loadResult?: DnaChatCaseLoadResult
  auditOk?: boolean
  requestId?: string
} = {}) {
  let loadCalls = 0
  const audits: DnaChatApiAuditInput[] = []
  return {
    state: { get loadCalls() { return loadCalls }, audits },
    value: {
      createRequestId: () => options.requestId || "request-contract-1",
      loadCaseAnswer: async ({ question, mode, previousTopic }: {
        question: string
        mode?: "theory" | "dna" | "case"
        previousTopic?: string | null
      }) => {
        loadCalls += 1
        return options.loadResult ?? {
          ok: true as const,
          answer: resolveDnaChat({ question, mode, previousTopic, caseContext: safeCaseContext }),
        }
      },
      writeAudit: async (input: DnaChatApiAuditInput) => {
        audits.push(input)
        return { ok: options.auditOk !== false }
      },
    },
  }
}

async function main() {
const auditMetadata = buildDnaChatAuditMetadata({
  requestId: "audit-contract-1",
  mode: "case",
  intentId: "selfreg.interoception",
  classification: "hypothesis",
  outcome: "answered",
  engineVersion: "dna-chat-engine@2",
  runtimeGeneration: "v2_legacy",
  catalogVersion: "dna-chat-catalog@2",
  packageVersion: "dna-chat-catalog@2",
  packageSha256: null,
  intendedUseVersion: "dna-intelligence-intended-use@1",
  sourceIds: ["source.one", "source.one", "source.two"],
  authorityContractVersion: "dna-knowledge-authority@1",
  policyVersion: "dna-intelligence-intended-use@1",
  authoritySet: ["case_information", "safety_and_product_boundaries"],
  responseDepth: "standard",
  latencyCategory: "lt_100ms",
  errorCode: null,
})
assert.deepEqual(Object.keys(auditMetadata), [...DNA_CHAT_AUDIT_METADATA_KEYS])
assert.deepEqual(auditMetadata.source_ids, ["source.one", "source.two"])
assert.equal(auditMetadata.schema_version, "dna-chat-telemetry@1")
assert.equal(auditMetadata.topic, "selfreg.interoception")
assert.equal(auditMetadata.citation_count, 2)
assert.equal(auditMetadata.http_result, 200)
assert.equal(auditMetadata.audit_status, "written")
assert.equal(auditMetadata.user_issue_category, null)
for (const forbiddenAuditField of [
  "question",
  "answer",
  "client_code",
  "client_id",
  "report_id",
  "scores",
  "case_evidence",
  "anamnesis",
  "passage_text",
  "retrieval_scores",
]) {
  assert.ok(!(forbiddenAuditField in auditMetadata), `Audit metadata yasak alan taşıyor: ${forbiddenAuditField}`)
}

const inLimitRequest = new Request("https://example.test/api/app/dna-chat", {
  method: "POST",
  body: JSON.stringify({ question: "HRV nedir?" }),
})
assert.equal(inLimitRequest.headers.get("content-length"), null)
const inLimitBody = await readDnaChatRequestBody(inLimitRequest, 8 * 1024)
assert.equal(inLimitBody.ok, true)

const chunkedOversizeRequest = new Request("https://example.test/api/app/dna-chat", {
  method: "POST",
  body: "x".repeat(8 * 1024 + 1),
})
assert.equal(chunkedOversizeRequest.headers.get("content-length"), null)
assert.deepEqual(
  await readDnaChatRequestBody(chunkedOversizeRequest, 8 * 1024),
  { ok: false, error: "payload_too_large" },
  "Content-Length olmayan gövde akış sırasında 8 KB üzerinde kesilmeli",
)

const declaredOversizeRequest = new Request("https://example.test/api/app/dna-chat", {
  method: "POST",
  headers: { "content-length": String(8 * 1024 + 1) },
  body: "{}",
})
assert.deepEqual(
  await readDnaChatRequestBody(declaredOversizeRequest, 8 * 1024),
  { ok: false, error: "payload_too_large" },
)

const theoryWithReportDeps = dependencies({ requestId: "theory-request" })
const theoryWithReport = await resolveDnaChatApiRequest({
  question: "İnsular korteks nedir?",
  reportId: "foreign-report-id",
}, theoryWithReportDeps.value)
assert.equal(theoryWithReport.status, 200)
assert.equal(theoryWithReport.accessedCaseReport, false)
assert.equal(theoryWithReportDeps.state.loadCalls, 0, "Teori sorusu seçili/yabancı reportId için DB okumamalı")
assert.equal(theoryWithReport.body.engineVersion, "dna-chat-engine@2")
assert.equal(theoryWithReport.body.runtimeGeneration, "v2_legacy")
assert.equal(theoryWithReport.body.catalogVersion, "dna-chat-catalog@2")
assert.equal(theoryWithReport.body.packageVersion, "dna-chat-catalog@2")
assert.equal(theoryWithReport.body.packageSha256, null)
assert.deepEqual(theoryWithReport.body.intendedUse, {
  version: "dna-intelligence-intended-use@1",
  productName: "DNA Intelligence",
  componentName: "DNA Asistanı",
  descriptionTr: "Terapistlerin kaynak bağlı nörofizyoloji ve düzenleme bilgisini incelemesine; yalnız kendi seçtikleri DNA raporundaki güvenli bulguları genel literatürden ayrı tartışmasına yardımcı olan deterministik bilgi asistanıdır.",
  boundaryTr: "Tanı ve ayırıcı tanı, tedavi veya seans planı, ilaç veya doz, prognoz ya da kesin nedensellik üretmez; davranıştan veya rapordan beyin bölgesi, HRV, kortizol ya da otonom durum çıkarmaz.",
  privacyTr: "Yalnız oturum sahibinin seçtiği raporun güvenli yapılandırılmış bağlamını kullanır. Sohbet metni kalıcı geçmişe kaydedilmez; güvenlik ve erişim için sınırlı işlem ve kaynak metadatası tutulabilir. Bu metadata soru veya cevap metni, danışan kodu, rapor kimliği, skor ya da vaka bulgusu içermez. Ham cevap, anamnez, trace ve gizli kuralları göstermez, raporlar arası klinik profil karşılaştırmaz ve mesajlardan kendiliğinden öğrenmez.",
  evidenceTr: "Kaynak, kanıt, yaş ve örneklem sınırı katalogda yapılandırıldığı ölçüde gösterilir; bulunmayan bilgi tahmin edilmez.",
  runtimeTr: "Çalışma zamanında haricî LLM, model API'si, embedding, vektör veritabanı veya internetten bilgi arama kullanılmaz; yanıt yalnız sürümlü yerel katalog ve izinli rapor bağlamından oluşturulur.",
})
assert.ok(Array.isArray(theoryWithReport.body.sources) && theoryWithReport.body.sources.length > 0)
assert.equal(theoryWithReport.body.responseDepth, "standard")

const shortProfileDeps = dependencies({ requestId: "short-profile" })
const shortProfile = await resolveDnaChatApiRequest({
  question: "İnsular korteks nedir?",
  responseDepth: "short",
}, shortProfileDeps.value)
assert.equal(shortProfile.status, 200)
assert.equal(shortProfile.body.responseDepth, "short")
assert.equal((shortProfile.body.details as unknown[]).length, 0)
assert.ok((shortProfile.body.sources as unknown[]).length <= 2)
assert.ok((shortProfile.body.answerUnits as unknown[]).length <= 2)
assert.ok((shortProfile.body.answerUnits as Array<{ role: string; sourceIds: string[] }>).every((unit) =>
  !["product_definition", "scientific_evidence", "dna_specific_validation"].includes(unit.role)
  || unit.sourceIds.length > 0))
assert.equal(shortProfileDeps.state.audits[0]?.responseDepth, "short")
assert.equal(shortProfileDeps.state.audits[0]?.runtimeGeneration, "v2_legacy")
assert.equal(shortProfileDeps.state.audits[0]?.catalogVersion, "dna-chat-catalog@2")
assert.equal(shortProfileDeps.state.audits[0]?.packageVersion, "dna-chat-catalog@2")
assert.equal(shortProfileDeps.state.audits[0]?.packageSha256, null)
assert.ok(["lt_100ms", "100_to_999ms", "gte_1000ms"].includes(shortProfileDeps.state.audits[0]?.latencyCategory || ""))
assert.equal(shortProfileDeps.state.audits[0]?.errorCode, null)

const naturalDeep = await resolveDnaChatApiRequest({
  question: "İnsular korteksi kanıtlarıyla açıkla.",
  responseDepth: "standard",
}, dependencies({ requestId: "natural-deep" }).value)
assert.equal(naturalDeep.body.responseDepth, "deep", "Doğal dil derin profil seçimini değiştirebilmeli")

const naturalShort = await resolveDnaChatApiRequest({
  question: "İnsular korteksi kısaca açıkla.",
  responseDepth: "deep",
}, dependencies({ requestId: "natural-short" }).value)
assert.equal(naturalShort.body.responseDepth, "short", "Doğal dil kısa profil seçimini değiştirebilmeli")

const v3NoAnswer = Object.freeze({
  retrievalVersion: "dna-v3-retrieval@1" as const,
  engineVersion: "dna-chat-engine@3" as const,
  status: "not_available" as const,
  classification: "not_available" as const,
  intent: "theory" as const,
  queryKind: "unknown" as const,
  responseDepth: "standard" as const,
  topic: null,
  summary: "Bu soru için yayıma uygun, pasajla doğrulanmış V3 bilgisi bulunmuyor.",
  details: Object.freeze(["Soruyu katalogdaki tek bir kavramla sınırlandırın."]),
  sources: Object.freeze([]),
  limitations: Object.freeze(["Yalnız yayıma uygun V3 kayıtları kullanılabilir."]),
  safetyBoundary: "Tanı, tedavi, prognoz veya bireysel biyolojik mekanizma çıkarımı yapılmaz.",
  suggestedQuestions: Object.freeze(["Soruyu tek bir kavram adıyla yeniden yazın."]),
  evidenceSummary: null,
  answerUnits: Object.freeze([]),
  sections: Object.freeze([]),
  confidenceBand: "low" as const,
})
const v3Runtime = createDnaV3RuntimeAnswerInternal({
  answer: v3NoAnswer,
  catalogVersion: "dna-v3-claim-passage-graph@1",
  packageVersion: "dna-v3-static-package@1",
  packageSha256: "a".repeat(64),
})
const v3ApiDeps = dependencies({ requestId: "v3-runtime-contract" })
const v3Api = await resolveDnaChatApiRequest({ question: "Bilinmeyen konu nedir?" }, {
  ...v3ApiDeps.value,
  resolveRuntimeAnswer: () => v3Runtime,
})
assert.equal(v3Api.status, 200)
assert.equal(v3Api.body.engineVersion, "dna-chat-engine@3")
assert.equal(v3Api.body.runtimeGeneration, "v3")
assert.equal(v3Api.body.catalogVersion, "dna-v3-claim-passage-graph@1")
assert.equal(v3Api.body.packageVersion, "dna-v3-static-package@1")
assert.equal(v3Api.body.packageSha256, "a".repeat(64))
const v3FallbackUnits = v3Api.body.answerUnits as Array<{
  kind: string
  section: string
  text: string
}>
assert.deepEqual(v3FallbackUnits.map((unit) => unit.kind), [
  "summary", "detail", "limitation", "safety_boundary",
], "Boş V3 answerUnits, yanıtın bütün görünür parçalarını doğru public türlerle korumalı")
assert.deepEqual(v3FallbackUnits.map((unit) => unit.section), [
  "definition", "function_or_relation", "counter_evidence", "boundary",
])
assert.deepEqual(v3FallbackUnits.map((unit) => unit.text), [
  v3NoAnswer.summary,
  ...v3NoAnswer.details,
  ...v3NoAnswer.limitations,
  v3NoAnswer.safetyBoundary,
])
assert.equal(v3ApiDeps.state.audits[0]?.runtimeGeneration, "v3")
assert.equal(v3ApiDeps.state.audits[0]?.packageSha256, "a".repeat(64))

const v3SharedSourceCards = Object.freeze([
  Object.freeze({
    id: "source.shared::passage.one::claim.one",
    sourceId: "source.shared",
    passageId: "passage.one",
    supportedClaimId: "claim.one",
    title: "Ortak kaynak",
    authors: "A. Yazar",
    year: 2025,
    sourceType: "systematic_review",
    doi: "10.1000/shared",
    officialUrl: "https://doi.org/10.1000/shared",
    locator: "s. 10",
    evidenceLevel: "moderate",
    ageScope: "mixed",
    supportedClaim: "Birinci sınırlı iddia.",
    knownBoundary: "Birinci iddianın sınırı.",
    supportedBoundary: "Birinci iddianın sınırı.",
  }),
  Object.freeze({
    id: "source.shared::passage.two::claim.two",
    sourceId: "source.shared",
    passageId: "passage.two",
    supportedClaimId: "claim.two",
    title: "Ortak kaynak",
    authors: "A. Yazar",
    year: 2025,
    sourceType: "systematic_review",
    doi: "10.1000/shared",
    officialUrl: "https://doi.org/10.1000/shared",
    locator: "s. 24",
    evidenceLevel: "moderate",
    ageScope: "mixed",
    supportedClaim: "İkinci sınırlı iddia.",
    knownBoundary: "İkinci iddianın sınırı.",
    supportedBoundary: "İkinci iddianın sınırı.",
  }),
])
const v3ExactAnswer = Object.freeze({
  retrievalVersion: "dna-v3-retrieval@1" as const,
  engineVersion: "dna-chat-engine@3" as const,
  status: "answer" as const,
  classification: "literature" as const,
  intent: "theory" as const,
  queryKind: "comparison" as const,
  responseDepth: "standard" as const,
  topic: "topic.shared",
  summary: "Birinci sınırlı iddia.",
  details: Object.freeze(["İkinci sınırlı iddia."]),
  sources: v3SharedSourceCards,
  limitations: Object.freeze(["İki iddia aynı yayının farklı pasajlarına dayanır."]),
  safetyBoundary: "Bireysel biyolojik çıkarım yapılmaz.",
  suggestedQuestions: Object.freeze([] as string[]),
  evidenceSummary: Object.freeze({
    level: "moderate",
    ageScope: "mixed",
    boundary: "Yalnız iki sınırlı iddia desteklenir.",
    dnaValidationStatus: "not_established" as const,
  }),
  answerUnits: Object.freeze([
    Object.freeze({
      id: "unit.one",
      section: "definition" as const,
      authority: "external_science" as const,
      text: "Birinci sınırlı iddia.",
      claimIds: Object.freeze(["claim.one"]),
      passageIds: Object.freeze(["passage.one"]),
      sourceIds: Object.freeze(["source.shared"]),
      caseFieldIds: Object.freeze([] as string[]),
    }),
    Object.freeze({
      id: "unit.two",
      section: "function_or_relation" as const,
      authority: "external_science" as const,
      text: "İkinci sınırlı iddia.",
      claimIds: Object.freeze(["claim.two"]),
      passageIds: Object.freeze(["passage.two"]),
      sourceIds: Object.freeze(["source.shared"]),
      caseFieldIds: Object.freeze([] as string[]),
    }),
  ]),
  sections: Object.freeze([]),
  confidenceBand: "high" as const,
}) satisfies DnaV3RetrievalAnswer
const v3ExactRuntime = createDnaV3RuntimeAnswerInternal({
  answer: v3ExactAnswer,
  catalogVersion: "dna-v3-claim-passage-graph@1",
  packageVersion: "dna-v3-static-package@1",
  packageSha256: "b".repeat(64),
})
const v3ExactApi = await resolveDnaChatApiRequest({ question: "İki iddiayı karşılaştır." }, {
  ...dependencies({ requestId: "v3-exact-citation" }).value,
  resolveRuntimeAnswer: () => v3ExactRuntime,
})
assert.equal(v3ExactApi.status, 200)
const exactCards = v3ExactApi.body.sources as Array<{
  id: string
  sourceId: string
  locator: string
}>
const exactUnits = v3ExactApi.body.answerUnits as Array<{
  id: string
  section: string
  sourceIds: string[]
  citationCardIds: string[]
}>
assert.deepEqual(exactUnits.map((unit) => unit.section), ["definition", "function_or_relation"],
  "Public V3 birimleri güvenli, kontrollü section enum'unu korumalı")
assert.deepEqual(exactUnits.map((unit) => unit.id), ["answer-unit-1", "answer-unit-2"],
  "Public V3 birim kimlikleri claim kimliği taşımayan opak sıra kimlikleri olmalı")
assert.equal(
  (v3ExactApi.body.evidenceSummary as { dnaValidationStatus?: string }).dnaValidationStatus,
  "not_established",
  "Kontrollü DNA ilişki durumu public kanıt özetinde korunmalı",
)
assert.equal(new Set(exactCards.map((card) => card.sourceId)).size, 1,
  "Fixture aynı yayındaki iki farklı passage kartını sınamalı")
assert.equal(new Set(exactUnits.flatMap((unit) => unit.citationCardIds)).size, 2,
  "Aynı yayının iki claim/passage kenarı tek kaynak kartına çökmemeli")
assert.equal(new Set(exactCards.map((card) => card.locator)).size, 2,
  "Kullanıcı iki farklı bölüm/sayfa kartını ayırt edebilmeli")
for (const unit of exactUnits) {
  assert.ok(unit.sourceIds.length && unit.citationCardIds.length)
  for (const cardId of unit.citationCardIds) {
    const card = exactCards.find((candidate) => candidate.id === cardId)
    assert.ok(card, `Exact citation card bulunamadı: ${cardId}`)
    assert.ok(unit.sourceIds.includes(card.sourceId))
  }
}
assert.doesNotMatch(
  JSON.stringify(v3ExactApi.body),
  /"(?:claimIds|passageIds|supportedClaimId)"/,
  "Dahili claim/passage kimlikleri public V3 yanıta açılmamalı",
)
assert.doesNotMatch(
  JSON.stringify(v3ExactApi.body),
  /(?:claim\.one|claim\.two|passage\.one|passage\.two)/,
  "Dahili claim/passage kimlikleri public V3 JSON değerlerinde de görünmemeli",
)
const v3MissingCitationRuntime = createDnaV3RuntimeAnswerInternal({
  answer: Object.freeze({ ...v3ExactAnswer, sources: Object.freeze([]) }),
  catalogVersion: "dna-v3-claim-passage-graph@1",
  packageVersion: "dna-v3-static-package@1",
  packageSha256: "c".repeat(64),
})
const v3MissingCitationDeps = dependencies({ requestId: "v3-missing-citation" })
const v3MissingCitation = await resolveDnaChatApiRequest({ question: "İki iddiayı karşılaştır." }, {
  ...v3MissingCitationDeps.value,
  resolveRuntimeAnswer: () => v3MissingCitationRuntime,
})
assert.equal(v3MissingCitation.status, 500)
assert.deepEqual(v3MissingCitation.body, { ok: false, error: "dna_chat_failed" },
  "Passage eşleşmeli kartı olmayan maddi V3 yanıtı fail-closed olmalı")
assert.equal(v3MissingCitationDeps.state.audits.length, 0,
  "Public V3 doğrulaması başarısız olduğunda başarı audit'i yazılmamalı")

const theoryOnlyDeps = dependencies({ requestId: "theory-request" })
const theoryOnly = await resolveDnaChatApiRequest({ question: "İnsular korteks nedir?" }, theoryOnlyDeps.value)
assert.deepEqual(theoryWithReport.body, theoryOnly.body, "Teori yanıtı reportId varlığından etkilenmemeli")

const clarificationDeps = dependencies()
const clarification = await resolveDnaChatApiRequest({ question: "Son raporumu özetle." }, clarificationDeps.value)
assert.equal(clarification.status, 200)
assert.equal(clarification.body.classification, "clarification")
assert.deepEqual(clarification.body.contextRequest, { type: "report", preferNewest: true })
assert.equal(clarificationDeps.state.loadCalls, 0)

const caseDeps = dependencies({ requestId: "case-request" })
const caseResult = await resolveDnaChatApiRequest({
  question: "Son raporumu özetle.",
  reportId: TEST_REPORT_LINEAGE_IDS.reportId,
}, caseDeps.value)
assert.equal(caseResult.status, 200)
assert.equal(caseResult.accessedCaseReport, true)
assert.equal(caseDeps.state.loadCalls, 1)
assert.ok(["case_finding", "hypothesis"].includes(String(caseResult.body.classification)))
assert.equal(caseDeps.state.audits.length, 1)
assert.equal(caseDeps.state.audits[0]?.mode, "case")
assert.equal(caseDeps.state.audits[0]?.intendedUseVersion, "dna-intelligence-intended-use@1")

const missingDependencies = dependencies({
  loadResult: { ok: false, status: 404, error: "report_not_found" },
})
const foreign = await resolveDnaChatApiRequest({
  question: "Son raporumu özetle.",
  reportId: "foreign-report-id",
}, missingDependencies.value)
const missing = await resolveDnaChatApiRequest({
  question: "Son raporumu özetle.",
  reportId: "missing-report-id",
}, missingDependencies.value)
assert.equal(foreign.status, 404)
assert.deepEqual(foreign.body, { ok: false, error: "report_not_found" })
assert.deepEqual(foreign.body, missing.body, "Yabancı ve bulunmayan rapor ayırt edilememeli")

const failedCaseAuditDeps = dependencies({ auditOk: false })
const failedCaseAudit = await resolveDnaChatApiRequest({
  question: "Son raporumu özetle.",
  reportId: TEST_REPORT_LINEAGE_IDS.reportId,
}, failedCaseAuditDeps.value)
assert.equal(failedCaseAudit.status, 503)
assert.deepEqual(failedCaseAudit.body, { ok: false, error: "audit_unavailable" })

const failedTheoryAuditDeps = dependencies({ auditOk: false })
const failedTheoryAudit = await resolveDnaChatApiRequest(
  { question: "HRV nedir?" },
  failedTheoryAuditDeps.value,
)
assert.equal(failedTheoryAudit.status, 200, "Vaka verisi okunmayan teori yanıtı audit kesintisinde engellenmemeli")

for (const forbidden of ["intentId", "outcome", "route", "safety", "diagnostics", "trace", "ruleId"]) {
  assert.ok(!(forbidden in caseResult.body), `API dahili alan sızdırdı: ${forbidden}`)
}

const durations: number[] = []
for (let index = 0; index < 100; index += 1) {
  const mockDependencies = dependencies({ requestId: `perf-${index}` })
  const startedAt = performance.now()
  const result = await resolveDnaChatApiRequest({
    question: "Bu rapordaki bulguyu HRV teorisiyle birlikte tartış.",
    reportId: TEST_REPORT_LINEAGE_IDS.reportId,
  }, mockDependencies.value)
  durations.push(performance.now() - startedAt)
  assert.equal(result.status, 200)
}
const mockRouteP95 = percentile(durations, 0.95)
assert.ok(mockRouteP95 < 1_000, `Mock DB API resolver p95 ${mockRouteP95.toFixed(3)} ms; hedef <1000 ms`)

console.log(JSON.stringify({
  ok: true,
  contracts: {
    theorySkipsReportLoad: true,
    reportClarification: true,
    foreignMissingIndistinguishable: true,
    caseAuditFailClosed: true,
    internalFieldsHidden: true,
    streamingBodyLimit: true,
    auditMetadataMinimized: true,
  },
  mockRouteP95Ms: Number(mockRouteP95.toFixed(3)),
}, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
