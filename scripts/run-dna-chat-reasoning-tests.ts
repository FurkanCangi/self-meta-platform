import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"

import {
  createDnaChatSafeCaseContext,
  DNA_CHAT_ENGINE_VERSION,
  resolveDnaChat,
} from "../src/lib/dna/chat"
import {
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS,
} from "../src/lib/dna/chat/catalog"

const caseContext = createDnaChatSafeCaseContext({
  dataStatus: "synthetic",
  ageMonths: 54,
  scores: {
    physiological: 28,
    sensory: 21,
    emotional: 25,
    cognitive: 37,
    executive: 31,
    interoception: 27,
  },
  levels: {
    physiological: "Riskli",
    sensory: "Atipik",
    emotional: "Riskli",
    cognitive: "Tipik",
    executive: "Riskli",
    interoception: "Riskli",
  },
  chatContext: {
    primaryAxis: "Duyusal yükle artan regülasyon kırılganlığı",
    caseEvidenceLines: ["Duyusal alan Atipik, fizyolojik alan Riskli düzeydedir."],
    counterEvidenceLines: ["Yapılandırılmış bire bir görevde katılım korunmaktadır."],
    preservedCapacityLines: ["Bilişsel regülasyon alanı Tipik düzeydedir."],
    dataLimitations: ["Doğrudan fizyolojik veya nörogörüntüleme ölçümü yoktur."],
    confidenceLevel: "orta",
  },
})

assert.equal(DNA_CHAT_ENGINE_VERSION, "dna-chat-engine@2")
assert.equal(DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length, 314)
const holdout = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((entry) => entry.holdout)
assert.ok(holdout.length >= Math.ceil(314 * 0.3), "Holdout oranı en az %30 olmalı")
const canonicalRefusals = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter(
  (entry) => entry.documentExpected === "Güvenli ret",
)
assert.equal(canonicalRefusals.length, 43, "Kanonik dört soru bankası 43 güvenli-ret satırı içermeli")
assert.ok(canonicalRefusals.every((entry) => entry.holdout), "43 güvenli-ret satırının tamamı holdout olmalı")

const supportedHoldout = holdout.filter((entry) => entry.evaluationScope === "supported_answerable")
const refusalHoldout = holdout.filter((entry) => entry.evaluationScope === "safety_refusal")
const unsupportedHoldout = holdout.filter((entry) => entry.evaluationScope === "unsupported_safe")

let supportedCorrect = 0
let refusalCorrect = 0
let unsupportedCorrect = 0
const supportedFailures: string[] = []
const refusalFailures: string[] = []
const unsupportedFailures: string[] = []

for (const entry of supportedHoldout) {
  const response = resolveDnaChat({ question: entry.question })
  const outcomeCorrect = response.outcome === "answered" &&
    !["refusal", "not_available", "clarification"].includes(response.classification)
  const topicCorrect = response.intentId?.includes(entry.expectedTopicId ?? "") === true
  if (outcomeCorrect && topicCorrect) {
    supportedCorrect += 1
  } else {
    supportedFailures.push(
      `${entry.id}: response=${response.classification}/${response.intentId ?? "none"}; ` +
      `topic=${entry.expectedTopicId ?? "none"}`,
    )
  }
}

for (const entry of refusalHoldout) {
  const response = resolveDnaChat({ question: entry.question })
  if (response.classification === "refusal") refusalCorrect += 1
  else refusalFailures.push(`${entry.id}: response=${response.classification}/${response.intentId ?? "none"}`)
}

for (const entry of unsupportedHoldout) {
  const response = resolveDnaChat({ question: entry.question })
  if (response.classification === "not_available") unsupportedCorrect += 1
  else unsupportedFailures.push(`${entry.id}: response=${response.classification}/${response.intentId ?? "none"}`)
}

const supportedAccuracy = supportedCorrect / supportedHoldout.length
const refusalAccuracy = refusalCorrect / refusalHoldout.length
const unsupportedAccuracy = unsupportedCorrect / unsupportedHoldout.length
assert.ok(
  supportedAccuracy >= 0.95 && refusalAccuracy === 1,
  `Kanonik holdout kapısı: desteklenen %${(supportedAccuracy * 100).toFixed(1)}, ` +
  `güvenli-ret %${(refusalAccuracy * 100).toFixed(1)}, desteklenmeyen %${(unsupportedAccuracy * 100).toFixed(1)}. ` +
  `Desteklenen: ${supportedFailures.slice(0, 8).join(" | ")}; ` +
  `Ret: ${refusalFailures.slice(0, 8).join(" | ")}; ` +
  `Desteklenmeyen: ${unsupportedFailures.slice(0, 8).join(" | ")}`,
)

const insula = resolveDnaChat({ question: "İnsular korteks nedir?" })
assert.equal(insula.classification, "dna_concept")
assert.equal(insula.outcome, "answered")
assert.ok(insula.sources.length > 0, "İnsula yanıtı doğrulanmış kaynak taşımalı")
assert.ok(insula.evidenceSummary?.boundary, "İnsula yanıtı iddia sınırı taşımalı")

const typoInsula = resolveDnaChat({ question: "İnsluar korteks nedir?" })
assert.equal(typoInsula.outcome, "answered")
assert.equal(typoInsula.topic, "İnsular korteks")

const hrvMeasurement = resolveDnaChat({ question: "HRV tam olarak neyi ölçer?" })
assert.equal(hrvMeasurement.outcome, "answered")
assert.ok(hrvMeasurement.sources.length > 0)

const theoryWithLegacyCaseMode = resolveDnaChat({
  mode: "case",
  question: "İnsular korteks nedir?",
})
assert.equal(theoryWithLegacyCaseMode.route, "theory")
assert.equal(theoryWithLegacyCaseMode.outcome, "answered")
assert.equal(theoryWithLegacyCaseMode.contextRequest, undefined)

const missingReport = resolveDnaChat({ question: "Son raporumu özetle." })
assert.equal(missingReport.classification, "clarification")
assert.deepEqual(missingReport.contextRequest, { type: "report", preferNewest: true })

const caseTheory = resolveDnaChat({
  question: "Bu rapordaki duyusal bulguyu insular korteks teorisiyle birlikte tartış.",
  caseContext,
})
assert.equal(caseTheory.route, "case")
assert.equal(caseTheory.classification, "hypothesis")
assert.ok(caseTheory.caseEvidence.length > 0)
assert.ok(caseTheory.sources.some((source) => source.type === "catalog"))
assert.ok(caseTheory.sources.some((source) => source.type === "case"))
assert.ok(
  caseTheory.limitations.some((line) => line === "Bu vakada biyolojik mekanizma doğrudan ölçülmedi."),
  "Vaka + teori yanıtı zorunlu biyolojik ölçüm sınırını taşımalı",
)
assert.ok(
  caseTheory.limitations.some((line) => /yetişkin örneklemleri ağırlıklıdır.*54 aylık vakaya doğrudan genellenemez/i.test(line)),
  "Çocuk vakada yetişkin ağırlıklı beyin kanıtı yaş sınırı taşımalı",
)

const caseGraphRelation = resolveDnaChat({
  question: "Bu rapordaki bulguyu insula ile salience ağı ilişkisiyle birlikte tartış.",
  caseContext,
})
assert.equal(caseGraphRelation.classification, "hypothesis")
assert.ok(
  caseGraphRelation.limitations.some((line) => /yetişkin örneklemleri ağırlıklıdır.*54 aylık vakaya doğrudan genellenemez/i.test(line)),
  "Tek-adımlı graf ilişkisi de yaş filtresinden geçmeli",
)

const twoQuestions = resolveDnaChat({
  question: "İnsular korteks nedir? HRV nedir?",
})
assert.equal(twoQuestions.outcome, "answered")
assert.ok(twoQuestions.sources.length > 0)

const conjunctionQuestions = resolveDnaChat({
  question: "İnsula nedir ve HRV nedir?",
})
assert.equal(conjunctionQuestions.outcome, "answered")
const insulaSourceIds = new Set(insula.sources.map((source) => source.id))
const hrvSourceIds = new Set(resolveDnaChat({ question: "HRV nedir?" }).sources.map((source) => source.id))
assert.ok(conjunctionQuestions.sources.some((source) => insulaSourceIds.has(source.id)))
assert.ok(conjunctionQuestions.sources.some((source) => hrvSourceIds.has(source.id)))

const splitCaseTheory = resolveDnaChat({
  question: "Son raporumu özetle? İnsula nedir?",
  caseContext,
})
assert.equal(splitCaseTheory.classification, "hypothesis")
assert.ok(splitCaseTheory.sources.some((source) => source.type === "case"))
assert.ok(splitCaseTheory.sources.some((source) => source.type === "catalog"))
assert.ok(splitCaseTheory.limitations.includes("Bu vakada biyolojik mekanizma doğrudan ölçülmedi."))

const boundedPolyvagalTheory = resolveDnaChat({ question: "Dorsal vagal kavramı nedir?" })
assert.equal(boundedPolyvagalTheory.outcome, "answered")
assert.notEqual(boundedPolyvagalTheory.classification, "refusal")

const unknownRelation = resolveDnaChat({ question: "İnsula serotoninle nasıl ilişkilidir?" })
assert.equal(unknownRelation.classification, "not_available")

const unknownCaseRelation = resolveDnaChat({
  question: "Bu rapordaki duyusal bulguyu insula ile muz rengi ilişkisiyle tartış.",
  caseContext,
})
assert.equal(unknownCaseRelation.classification, "not_available")
assert.notEqual(unknownCaseRelation.classification, "hypothesis")

const incompatibleAgeCase = resolveDnaChat({
  question: "Bu rapordaki bulguyu erken çocuklukta self-regülasyon gelişimiyle birlikte tartış.",
  caseContext: {
    dataStatus: "synthetic",
    ageMonths: 180,
    scores: { cognitive: 34 },
    levels: { cognitive: "Tipik" },
  },
})
assert.equal(incompatibleAgeCase.classification, "not_available")
assert.ok(incompatibleAgeCase.limitations.some((line) => /yaş|yas|aylık/i.test(line)))

const threeQuestions = resolveDnaChat({
  question: "İnsular korteks nedir? HRV nedir? Allostaz nedir?",
})
assert.equal(threeQuestions.classification, "clarification")

const deterministicRequest = {
  question: "Homeostaz ile allostaz arasındaki fark nedir?",
} as const
const hashes = new Set<string>()
const timings: number[] = []
for (let iteration = 0; iteration < 20; iteration += 1) {
  const startedAt = performance.now()
  const response = resolveDnaChat(deterministicRequest)
  timings.push(performance.now() - startedAt)
  hashes.add(createHash("sha256").update(JSON.stringify(response)).digest("hex"))
}
assert.equal(hashes.size, 1, "Catalog V2 reasoning deterministik olmalı")
const sorted = timings.sort((left, right) => left - right)
const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
assert.ok(p95 < 25, `Catalog V2 p95 ${p95.toFixed(3)} ms; hedef <25 ms`)

console.log(JSON.stringify({
  ok: true,
  engineVersion: DNA_CHAT_ENGINE_VERSION,
  catalogQuestions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length,
  holdout: {
    total: holdout.length,
    supported: {
      total: supportedHoldout.length,
      correct: supportedCorrect,
      accuracy: Number((supportedAccuracy * 100).toFixed(2)),
    },
    refusals: {
      total: refusalHoldout.length,
      correct: refusalCorrect,
      accuracy: Number((refusalAccuracy * 100).toFixed(2)),
    },
    unsupported: {
      total: unsupportedHoldout.length,
      correct: unsupportedCorrect,
      accuracy: Number((unsupportedAccuracy * 100).toFixed(2)),
    },
  },
  oneHopGraph: true,
  maxSubquestions: 2,
  p95Ms: Number(p95.toFixed(3)),
}, null, 2))
