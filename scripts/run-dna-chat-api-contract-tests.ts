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
  intendedUseVersion: "dna-intelligence-intended-use@1",
  sourceIds: ["source.one", "source.one", "source.two"],
  authorityContractVersion: "dna-knowledge-authority@1",
  policyVersion: "dna-intelligence-intended-use@1",
  authoritySet: ["case_information", "safety_and_product_boundaries"],
})
assert.deepEqual(Object.keys(auditMetadata), [...DNA_CHAT_AUDIT_METADATA_KEYS])
assert.deepEqual(auditMetadata.source_ids, ["source.one", "source.two"])
for (const forbiddenAuditField of [
  "question",
  "answer",
  "client_code",
  "client_id",
  "report_id",
  "scores",
  "case_evidence",
  "anamnesis",
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
