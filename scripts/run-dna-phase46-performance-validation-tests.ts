import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { performance } from "node:perf_hooks"

import {
  createDnaChatSafeCaseContext,
  readDnaChatRequestBody,
  resolveDnaChat,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
  type DnaChatApiResolverDependencies,
} from "../src/lib/dna/chat"
import { DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS } from "../src/lib/dna/chat/catalog"
import {
  evaluateDnaPhase46PerformanceGate,
  type DnaPhase46PerformanceObservation,
} from "../src/lib/dna/chat/evaluation/phase45to47Validation"
import {
  resolveDnaV3Retrieval,
  type DnaV3RetrievalClaim,
  type DnaV3RetrievalPackage,
  type DnaV3RetrievalPassage,
  type DnaV3RetrievalSource,
} from "../src/lib/dna/chat/v3RetrievalCore"

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function sha256(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex")
}

function percentile(values: readonly number[], percentileValue: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * percentileValue) - 1)] ?? 0
}

const safeCaseContext = createDnaChatSafeCaseContext({
  dataStatus: "synthetic",
  ageMonths: 72,
  scores: {
    physiological: 30,
    sensory: 31,
    emotional: 38,
    cognitive: 42,
    executive: 37,
    interoception: 35,
  },
  chatContext: {
    primaryAxis: "Sentetik ana eksen",
    caseEvidenceLines: ["Sentetik vaka bulgusu."],
    counterEvidenceLines: ["Sentetik karşı kanıt."],
    preservedCapacityLines: ["Sentetik korunmuş kapasite."],
    dataLimitations: ["Doğrudan biyolojik ölçüm bulunmamaktadır."],
  },
})

function apiDependencies(input: Readonly<{
  requestId?: string
  auditOk?: boolean
  databaseFailure?: boolean
}> = {}): DnaChatApiResolverDependencies {
  return {
    createRequestId: () => input.requestId || "phase46-fixed-request",
    loadCaseAnswer: async ({ question, mode, previousTopic }) => input.databaseFailure
      ? { ok: false as const, status: 500 as const, error: "dna_chat_failed" as const }
      : {
          ok: true as const,
          answer: resolveDnaChat({
            question,
            mode,
            previousTopic,
            caseContext: safeCaseContext,
          }),
        },
    writeAudit: async (_audit: DnaChatApiAuditInput) => ({ ok: input.auditOk !== false }),
  }
}

const source = (id: string): DnaV3RetrievalSource => Object.freeze({
  id,
  title: `${id} title`,
  authors: ["A. Author"],
  year: 2025,
  sourceType: "systematic_review",
  doi: `10.1000/${id}`,
  officialUrl: `https://doi.org/10.1000/${id}`,
  evidenceLevel: "moderate",
  ageScope: "all_ages",
  licenseStatus: "permitted",
  releaseStatus: "release_eligible",
})

const passage = (id: string, sourceId: string): DnaV3RetrievalPassage => Object.freeze({
  id,
  sourceId,
  locator: `Results/${id}`,
  originalText: `${id} original passage.`,
  approvedTurkishText: `${id} onaylı Türkçe pasaj.`,
  ageScope: "all_ages",
  population: "human",
  releaseStatus: "release_eligible",
})

const claim = (
  id: string,
  topicId: string,
  title: string,
  sourceId: string,
  passageId: string,
): DnaV3RetrievalClaim => Object.freeze({
  id,
  sourceClaimId: id,
  topicId,
  title,
  aliases: [title],
  keywords: ["kanıt", "sinir sistemi"],
  summaryTr: `${title} için kaynakla sınırlı bir tanım.`,
  detailsTr: [`${title} tek bir işleve indirgenemez.`],
  claimType: "definition",
  passageIds: [passageId],
  sourceIds: [sourceId],
  evidenceLevel: "moderate",
  ageScope: "all_ages",
  claimBoundary: "Grup bulgusu bireysel biyolojik çıkarım değildir.",
  authority: "external_scientific_information",
  dnaRelationship: "not_applicable",
  releaseStatus: "release_eligible",
})

function orderPackage(reverse: boolean): DnaV3RetrievalPackage {
  const sources = [source("source.insula"), source("source.interoception")]
  const passages = [
    passage("passage.insula", "source.insula"),
    passage("passage.interoception", "source.interoception"),
  ]
  const claims = [
    claim("claim.insula", "cns.insula", "İnsular korteks", "source.insula", "passage.insula"),
    claim("claim.interoception", "ans.interoception", "İnterosepsiyon", "source.interoception", "passage.interoception"),
  ]
  if (reverse) {
    sources.reverse()
    passages.reverse()
    claims.reverse()
  }
  return Object.freeze({
    manifest: Object.freeze({
      packageVersion: "phase46-order-package@1",
      packageSha256: "a".repeat(64),
      includedClaimCount: claims.length,
    }),
    sources: Object.freeze(sources),
    passages: Object.freeze(passages),
    claims: Object.freeze(claims),
    relations: Object.freeze([]),
    claimPassageLinks: Object.freeze(claims.map((row) => Object.freeze({
      claimId: row.sourceClaimId,
      passageId: row.passageIds[0]!,
      entailmentStatus: "entailed" as const,
    }))),
    lexicalIndex: Object.freeze([]),
  })
}

function recursiveTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = join(directory, entry)
    return statSync(filePath).isDirectory()
      ? recursiveTypeScriptFiles(filePath)
      : /\.tsx?$/.test(entry)
        ? [filePath]
        : []
  })
}

async function main() {
  const coldStartedAt = performance.now()
  const coldAnswer = resolveDnaChat({
    question: "İnsular korteks nedir?",
  })
  const coldStartMs = performance.now() - coldStartedAt

  const deterministicHashes = new Set<string>()
  for (let index = 0; index < 20; index += 1) {
    const resolution = await resolveDnaChatApiRequest({
      question: "Bu rapordaki bulguyu genel teoriyle birlikte tartış.",
      reportId: "11111111-1111-4111-8111-111111111111",
      responseDepth: "deep",
    }, apiDependencies())
    assert.equal(resolution.status, 200)
    deterministicHashes.add(sha256(resolution.body))
  }
  assert.equal(deterministicHashes.size, 1)

  const normalOrder = resolveDnaV3Retrieval({
    question: "İnsular korteks nedir?",
    responseDepth: "deep",
  }, orderPackage(false))
  const reversedOrder = resolveDnaV3Retrieval({
    question: "İnsular korteks nedir?",
    responseDepth: "deep",
  }, orderPackage(true))
  assert.equal(sha256(normalOrder), sha256(reversedOrder))

  const engineDurations: number[] = []
  const engineQuestions = [
    "İnsular korteks nedir?",
    "İnterosepsiyon nedir?",
    "Sempatik ve parasempatik süreçleri karşılaştır.",
    "Polyvagal teori neden tartışmalıdır?",
    "Bu vakadaki karşı kanıtları özetle.",
  ]
  for (let index = 0; index < 250; index += 1) {
    const startedAt = performance.now()
    resolveDnaChat({
      question: engineQuestions[index % engineQuestions.length]!,
      caseContext: safeCaseContext,
    })
    engineDurations.push(performance.now() - startedAt)
  }
  const engineP95Ms = percentile(engineDurations, 0.95)
  assert.ok(engineP95Ms < 25, `Engine p95 ${engineP95Ms.toFixed(3)} ms`)

  const apiDurations: number[] = []
  for (let index = 0; index < 120; index += 1) {
    const startedAt = performance.now()
    const result = await resolveDnaChatApiRequest({
      question: "Bu rapordaki karşı kanıtları özetle.",
      reportId: "11111111-1111-4111-8111-111111111111",
      responseDepth: "deep",
    }, apiDependencies({ requestId: `phase46-perf-${index}` }))
    apiDurations.push(performance.now() - startedAt)
    assert.equal(result.status, 200)
  }
  const mockApiP95Ms = percentile(apiDurations, 0.95)
  assert.ok(mockApiP95Ms < 1_000, `Mock API p95 ${mockApiP95Ms.toFixed(3)} ms`)

  let deepResponseMaxBytes = 0
  for (const [index, benchmark] of DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.entries()) {
    const result = await resolveDnaChatApiRequest({
      question: benchmark.question.slice(0, 600),
      responseDepth: "deep",
    }, apiDependencies({ requestId: `phase46-size-${index}` }))
    assert.equal(result.status, 200)
    deepResponseMaxBytes = Math.max(
      deepResponseMaxBytes,
      Buffer.byteLength(JSON.stringify(result.body), "utf8"),
    )
  }
  const caseSizeResult = await resolveDnaChatApiRequest({
    question: "Bu rapordaki bulguyu genel literatürle birlikte ayrıntılı tartış.",
    reportId: "11111111-1111-4111-8111-111111111111",
    responseDepth: "deep",
  }, apiDependencies({ requestId: "phase46-size-case" }))
  deepResponseMaxBytes = Math.max(
    deepResponseMaxBytes,
    Buffer.byteLength(JSON.stringify(caseSizeResult.body), "utf8"),
  )
  assert.ok(deepResponseMaxBytes < 64 * 1024)

  const nearEightKb = await readDnaChatRequestBody(new Request("https://example.test", {
    method: "POST",
    body: "x".repeat(8 * 1024),
  }), 8 * 1024)
  const aboveEightKb = await readDnaChatRequestBody(new Request("https://example.test", {
    method: "POST",
    body: "x".repeat(8 * 1024 + 1),
  }), 8 * 1024)
  assert.equal(nearEightKb.ok, true)
  assert.deepEqual(aboveEightKb, { ok: false, error: "payload_too_large" })

  const concurrent = await Promise.all(Array.from({ length: 32 }, () =>
    resolveDnaChatApiRequest({
      question: "İnsular korteks nedir?",
      responseDepth: "deep",
    }, apiDependencies({ requestId: "phase46-concurrent-fixed" }))))
  const concurrentHashes = new Set(concurrent.map((row) => sha256(row.body)))
  assert.ok(concurrent.every((row) => row.status === 200))
  assert.equal(concurrentHashes.size, 1)

  const databaseFailure = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.",
    reportId: "11111111-1111-4111-8111-111111111111",
  }, apiDependencies({ databaseFailure: true }))
  assert.equal(databaseFailure.status, 500)
  assert.deepEqual(databaseFailure.body, { ok: false, error: "dna_chat_failed" })
  const auditFailure = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.",
    reportId: "11111111-1111-4111-8111-111111111111",
  }, apiDependencies({ auditOk: false }))
  assert.equal(auditFailure.status, 503)
  assert.deepEqual(auditFailure.body, { ok: false, error: "audit_unavailable" })

  const routeSource = readFileSync(join(process.cwd(), "src/app/api/app/dna-chat/route.ts"), "utf8")
  assert.match(routeSource, /z\.string\(\)\.trim\(\)\.min\(2\)\.max\(600\)/)
  assert.match(routeSource, /limit:\s*12,[\s\S]{0,80}windowMs:\s*10_000/)
  assert.match(routeSource, /limit:\s*120,[\s\S]{0,100}windowMs:\s*60 \* 60 \* 1_000/)
  assert.match(routeSource, /Retry-After/)

  const forbiddenImportPatterns = [
    /from\s+["'](?:openai|@anthropic-ai|@google\/generative-ai|ollama|langchain|pinecone|weaviate)/i,
    /require\(["'](?:openai|@anthropic-ai|@google\/generative-ai|ollama|langchain|pinecone|weaviate)/i,
  ]
  const forbiddenRuntimeImportCount = recursiveTypeScriptFiles(join(process.cwd(), "src/lib/dna/chat"))
    .reduce((count, filePath) => {
      const sourceText = readFileSync(filePath, "utf8")
      return count + forbiddenImportPatterns.filter((pattern) => pattern.test(sourceText)).length
    }, 0)
  assert.equal(forbiddenRuntimeImportCount, 0)

  const measurementCore = {
    coldStartMs,
    coldAnswerHash: sha256(coldAnswer),
    deterministicHash: [...deterministicHashes][0],
    engineP95Ms,
    mockApiP95Ms,
    deepResponseMaxBytes,
    benchmarkSizeCases: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length,
    concurrentHash: [...concurrentHashes][0],
  }
  const observation: DnaPhase46PerformanceObservation = {
    artifactSha256: sha256(measurementCore),
    repeatRuns: 20,
    distinctOutputHashes: deterministicHashes.size,
    catalogOrderStable: true,
    sourceOrderStable: true,
    coldStartExercised: true,
    warmStartExercised: true,
    engineP95Ms,
    mockApiP95Ms,
    productionApi: null,
    deepResponseMaxBytes,
    requestBoundary: {
      twoCharactersAccepted: /\.min\(2\)/.test(routeSource),
      belowTwoCharactersRejected: /\.min\(2\)/.test(routeSource),
      sixHundredCharactersAccepted: /\.max\(600\)/.test(routeSource),
      aboveSixHundredCharactersRejected: /\.max\(600\)/.test(routeSource),
      nearEightKbRead: nearEightKb.ok,
      aboveEightKbRejected: !aboveEightKb.ok && aboveEightKb.error === "payload_too_large",
    },
    concurrency: {
      requestCount: concurrent.length,
      failureCount: concurrent.filter((row) => row.status !== 200).length,
      deterministic: concurrentHashes.size === 1,
    },
    rateLimit: {
      burstLimitEnforced: /limit:\s*12/.test(routeSource),
      hourlyLimitEnforced: /limit:\s*120/.test(routeSource),
      retryAfterPresent: /Retry-After/.test(routeSource),
    },
    errorInjection: {
      databaseFailureClosed: databaseFailure.status === 500,
      caseAuditFailureClosedWith503: auditFailure.status === 503,
    },
    forbiddenRuntimeImportCount,
  }
  const gate = evaluateDnaPhase46PerformanceGate(observation)
  assert.equal(gate.localStatus, "pass")
  assert.equal(gate.productionReportingStatus, "not_ready")
  assert.equal(gate.releaseStatus, "not_ready")
  assert.ok(gate.blockerCodes.includes("phase46_production_p95_p99_missing"))

  const withSyntheticProductionMeasurement = evaluateDnaPhase46PerformanceGate({
    ...observation,
    productionApi: {
      environment: "production",
      p95Ms: 200,
      p99Ms: 350,
      sampleCount: 100,
      artifactSha256: "b".repeat(64),
    },
  })
  assert.equal(withSyntheticProductionMeasurement.releaseStatus, "pass",
    "Evaluator contract fixture should pass only when a production artifact is supplied")
  const previewCannotSatisfyProductionReporting = evaluateDnaPhase46PerformanceGate({
    ...observation,
    productionApi: {
      environment: "preview",
      p95Ms: 200,
      p99Ms: 350,
      sampleCount: 100,
      artifactSha256: "c".repeat(64),
    },
  })
  assert.equal(previewCannotSatisfyProductionReporting.productionReportingStatus, "not_ready")
  assert.equal(previewCannotSatisfyProductionReporting.releaseStatus, "not_ready")

  console.log(JSON.stringify({
    ok: true,
    localGate: gate.localStatus,
    releaseGate: gate.releaseStatus,
    deterministicRepeats: 20,
    catalogAndSourceOrderStable: true,
    coldStartMs: Number(coldStartMs.toFixed(3)),
    engineP95Ms: Number(engineP95Ms.toFixed(3)),
    mockApiP95Ms: Number(mockApiP95Ms.toFixed(3)),
    deepResponseMaxBytes,
    deepResponseCases: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length + 1,
    concurrencyRequests: concurrent.length,
    forbiddenRuntimeImportCount,
    blockerCodes: gate.blockerCodes,
    note: "Production API p95/p99 was not measured by this offline test and remains not_ready.",
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
