import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"

import {
  DNA_V3_RETRIEVAL_ENGINE_VERSION,
  DNA_V3_RETRIEVAL_THRESHOLDS,
  classifyDnaV3QueryKind,
  classifyDnaV3RetrievalIntent,
  rankDnaV3RetrievalCandidates,
  resolveDnaV3Retrieval,
  splitDnaV3Subquestions,
  type DnaV3RetrievalClaim,
  type DnaV3RetrievalPackage,
  type DnaV3RetrievalPassage,
  type DnaV3RetrievalSource,
} from "../src/lib/dna/chat/v3RetrievalCore"
import { tokenizeDnaChatText } from "../src/lib/dna/chat/text"
import { createDnaChatSafeCaseContext } from "../src/lib/dna/chat/caseContext"

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex")
}

const source = (
  id: string,
  overrides: Partial<DnaV3RetrievalSource> = {},
): DnaV3RetrievalSource => Object.freeze({
  id,
  title: `${id} bilimsel kaynağı`,
  authors: Object.freeze(["A. Yazar", "B. Yazar"]),
  year: 2025,
  sourceType: "systematic_review",
  doi: `10.1000/${id}`,
  officialUrl: `https://doi.org/10.1000/${id}`,
  evidenceLevel: "moderate",
  ageScope: "mixed",
  licenseStatus: "permitted",
  releaseStatus: "release_eligible",
  ...overrides,
})

const passage = (
  id: string,
  sourceId: string,
  approvedTurkishText: string,
  overrides: Partial<DnaV3RetrievalPassage> = {},
): DnaV3RetrievalPassage => Object.freeze({
  id,
  sourceId,
  locator: `Bulgular/${id}`,
  originalText: `Original source passage for ${id}.`,
  approvedTurkishText,
  ageScope: "mixed",
  population: "human",
  releaseStatus: "release_eligible",
  ...overrides,
})

const claim = (input: {
  id: string
  topicId: string
  title: string
  aliases: readonly string[]
  keywords: readonly string[]
  summaryTr: string
  passageId: string
  sourceId: string
  ageScope?: string
  claimType?: string
  dnaRelationship?: DnaV3RetrievalClaim["dnaRelationship"]
}): DnaV3RetrievalClaim => Object.freeze({
  id: input.id,
  sourceClaimId: input.id,
  topicId: input.topicId,
  title: input.title,
  aliases: Object.freeze([...input.aliases]),
  keywords: Object.freeze([...input.keywords]),
  summaryTr: input.summaryTr,
  detailsTr: Object.freeze([`${input.title} için yalnız kaynakta desteklenen sınırlı açıklama gösterilir.`]),
  claimType: input.claimType ?? "definition",
  passageIds: Object.freeze([input.passageId]),
  sourceIds: Object.freeze([input.sourceId]),
  evidenceLevel: "moderate",
  ageScope: input.ageScope ?? "mixed",
  claimBoundary: "Grup düzeyi bulgu bireysel biyolojik çıkarıma dönüştürülemez.",
  dnaRelationship: input.dnaRelationship ?? "not_applicable",
  releaseStatus: "release_eligible",
})

const CLAIMS = Object.freeze([
  claim({
    id: "claim.insula",
    topicId: "cns.insula",
    title: "İnsular korteks",
    aliases: ["insula", "insular korteks"],
    keywords: ["interosepsiyon", "beden sinyalleri", "kanıt"],
    summaryTr: "İnsular korteks, içsel beden sinyallerinin temsiliyle ilişkili çok işlevli bir kortikal bölgedir.",
    passageId: "passage.insula",
    sourceId: "source.insula",
  }),
  claim({
    id: "claim.interoception",
    topicId: "ans.interoception",
    title: "İnterosepsiyon",
    aliases: ["interoseptif farkındalık", "beden sinyallerini algılama"],
    keywords: ["beden sinyalleri", "farkındalık", "doğruluk"],
    summaryTr: "İnterosepsiyon, organizmanın içsel beden sinyallerini algılama ve yorumlama süreçlerini kapsar.",
    passageId: "passage.interoception",
    sourceId: "source.interoception",
    dnaRelationship: "conceptual_proximity",
  }),
  claim({
    id: "claim.prefrontal",
    topicId: "cns.prefrontal",
    title: "Prefrontal korteks",
    aliases: ["prefrontal süreçler", "pfc"],
    keywords: ["yürütücü işlev", "kontrol", "kanıt"],
    summaryTr: "Prefrontal korteks, tek bir işleve indirgenemeyen ve çok sayıda kontrol sürecine katılan heterojen bir bölgedir.",
    passageId: "passage.prefrontal",
    sourceId: "source.prefrontal",
    ageScope: "adult",
  }),
])

function packageFrom(input: {
  claims?: readonly DnaV3RetrievalClaim[]
  sources?: readonly DnaV3RetrievalSource[]
  passages?: readonly DnaV3RetrievalPassage[]
  omitLinkForClaim?: string
} = {}): DnaV3RetrievalPackage {
  const claims = input.claims ?? CLAIMS
  const sources = input.sources ?? [
    source("source.insula"),
    source("source.interoception"),
    source("source.prefrontal", { ageScope: "adult" }),
  ]
  const passages = input.passages ?? [
    passage("passage.insula", "source.insula", "İnsula içsel beden sinyallerinin temsiliyle ilişkilidir."),
    passage("passage.interoception", "source.interoception", "İnterosepsiyon içsel sinyallerin algılanmasını kapsar."),
    passage("passage.prefrontal", "source.prefrontal", "Prefrontal korteks heterojen kontrol süreçlerine katılır."),
  ]
  return Object.freeze({
    manifest: Object.freeze({
      packageVersion: "synthetic-v3-package@1",
      packageSha256: "a".repeat(64),
      includedClaimCount: claims.length,
    }),
    sources: Object.freeze([...sources]),
    passages: Object.freeze([...passages]),
    claims: Object.freeze([...claims]),
    relations: Object.freeze([Object.freeze({
      id: "relation.insula.interoception",
      fromTopicId: "cns.insula",
      toTopicId: "ans.interoception",
      predicate: "associated_with",
      summaryTr: "İnsula ile interoseptif süreçler arasında kaynakla desteklenen tek adımlı bir ilişki kurulabilir.",
      claimIds: Object.freeze(["claim.insula"]),
      sourceIds: Object.freeze(["source.insula"]),
      maxHops: 1 as const,
      releaseStatus: "release_eligible" as const,
    })]),
    claimPassageLinks: Object.freeze(claims
      .filter((candidate) => candidate.id !== input.omitLinkForClaim)
      .flatMap((candidate) => candidate.passageIds.map((passageId) => Object.freeze({
        claimId: candidate.sourceClaimId,
        passageId,
        entailmentStatus: "entailed" as const,
      })))),
    lexicalIndex: Object.freeze([]),
  })
}

const pkg = packageFrom()

assert.equal(classifyDnaV3RetrievalIntent("İnsular korteks nedir?"), "theory")
assert.equal(classifyDnaV3RetrievalIntent("Bu rapordaki insula bulgusu literatürle uyumlu mu?"), "case_theory")
assert.equal(classifyDnaV3QueryKind("İnsular korteks nedir?"), "definition")
assert.equal(classifyDnaV3QueryKind("HRV nasıl ölçülür?"), "measurement")
assert.deepEqual(tokenizeDnaChatText("İnterosepsiyonun düzenlenmesi"), ["interosepsiyon", "duzenlenmesi"])
assert.deepEqual(tokenizeDnaChatText("çocuklarda korteksin regulasyonu"), ["cocuk", "korteks", "regulasyon"])
assert.deepEqual(splitDnaV3Subquestions("İnsula nedir? İnterosepsiyon nedir?"), {
  questions: ["İnsula nedir", "İnterosepsiyon nedir"],
  exceedsLimit: false,
})

const exact = resolveDnaV3Retrieval({ question: "İnsular korteks nedir?" }, pkg)
assert.equal(exact.status, "answer")
assert.equal(exact.engineVersion, DNA_V3_RETRIEVAL_ENGINE_VERSION)
assert.equal(exact.topic, "cns.insula")
assert.equal(exact.sources.length, 1)
assert.equal(exact.sources[0].locator, "Bulgular/passage.insula")
assert.equal(exact.evidenceSummary?.boundary, CLAIMS[0].claimBoundary)
assert.equal(exact.confidenceBand, "high")
assert.ok(!JSON.stringify(exact).match(/(?:reasoningTrace|internalRuleId|artifactSha256)/))

const typo = resolveDnaV3Retrieval({ question: "İnsuler korteks nedir?" }, pkg)
assert.equal(typo.status, "answer", "3-5 karakter n-gram yazım hatasını güvenle eşleştirmeli")
assert.equal(typo.topic, "cns.insula")

const relationship = resolveDnaV3Retrieval({ question: "İnsular korteks ile interosepsiyon ilişkisi nedir?" }, pkg)
assert.equal(relationship.status, "answer")
assert.ok(relationship.details.some((detail) => detail.includes("tek adımlı")))

const ambiguous = resolveDnaV3Retrieval({
  question: "İnsular korteks ile prefrontal korteks arasındaki fark nedir?",
}, pkg)
assert.equal(ambiguous.status, "not_available")

const unknown = resolveDnaV3Retrieval({ question: "Kuantum dolanıklığı nedir?" }, pkg)
assert.equal(unknown.status, "not_available")
assert.equal(unknown.sources.length, 0)

const emptyPackage = packageFrom({ claims: [], sources: [], passages: [] })
assert.equal(resolveDnaV3Retrieval({ question: "İnsula nedir?" }, emptyPackage).status, "not_available")

const reportPrompt = resolveDnaV3Retrieval({
  question: "Bu rapordaki insular korteks bulgusu literatürle uyumlu mu?",
}, pkg)
assert.equal(reportPrompt.status, "clarification")
assert.deepEqual(reportPrompt.contextRequest, { type: "report", preferNewest: true })

const reportTheory = resolveDnaV3Retrieval({
  question: "Bu rapordaki insular korteks bulgusu literatürle uyumlu mu?",
  caseContext: {
    dataStatus: "deidentified",
    reportId: "forged.report",
  } as never,
}, pkg)
assert.equal(reportTheory.status, "clarification", "Caller tarafından uydurulan vaka nesnesi yetki vermemeli")

const syntheticCaseContext = createDnaChatSafeCaseContext({
  dataStatus: "synthetic",
  caseId: "synthetic-case",
  observations: ["Göreve dönüş farklı koşullarda değişiyor."],
})
const boundedCaseTheory = resolveDnaV3Retrieval({
  question: "Bu rapordaki insular korteks bulgusu literatürle uyumlu mu?",
  caseContext: syntheticCaseContext,
}, pkg)
assert.equal(boundedCaseTheory.status, "clarification",
  "Sentetik vaka context'i üretim rapor yetkisi sayılmamalı")

const diagnosis = resolveDnaV3Retrieval({
  question: "Bu rapordaki davranış otizm tanısını kesin gösteriyor mu?",
}, pkg)
assert.equal(diagnosis.status, "refusal")
assert.equal(diagnosis.sources.length, 0)

const treatment = resolveDnaV3Retrieval({
  question: "Bu vaka için tedavi ve seans planı yaz.",
}, pkg)
assert.equal(treatment.status, "refusal")

const contextCannotAuthorize = resolveDnaV3Retrieval({
  question: "Son raporu özetle.",
  previousTopic: "cns.insula",
}, pkg)
assert.equal(contextCannotAuthorize.status, "clarification")
assert.deepEqual(contextCannotAuthorize.contextRequest, { type: "report", preferNewest: true })

const publicFollowup = resolveDnaV3Retrieval({
  question: "Peki kanıt sınırı nedir?",
  previousTopic: "cns.insula",
}, pkg)
assert.equal(publicFollowup.status, "answer")
assert.equal(publicFollowup.topic, "cns.insula")

const twoQuestions = resolveDnaV3Retrieval({
  question: "İnsular korteks nedir? İnterosepsiyon nedir?",
}, pkg)
assert.equal(twoQuestions.status, "answer")
assert.equal(twoQuestions.sources.length, 2)

const twoQuestionsWithConjunction = resolveDnaV3Retrieval({
  question: "İnsula nedir ve İnterosepsiyon nedir?",
}, pkg)
assert.equal(twoQuestionsWithConjunction.status, "answer")
assert.equal(twoQuestionsWithConjunction.sources.length, 2)

const tooMany = resolveDnaV3Retrieval({
  question: "İnsula nedir? İnterosepsiyon nedir? Prefrontal korteks nedir?",
}, pkg)
assert.equal(tooMany.status, "clarification")
assert.match(tooMany.summary, /en fazla iki/i)

const adultOnly = packageFrom({ claims: [CLAIMS[2]], sources: [source("source.prefrontal", { ageScope: "adult" })], passages: [
  passage("passage.prefrontal", "source.prefrontal", "Prefrontal korteks yetişkin örnekleminde incelenmiştir.", {
    ageScope: "adult",
  }),
] })
assert.equal(resolveDnaV3Retrieval({ question: "Çocuklarda prefrontal korteks nedir?" }, adultOnly).status, "not_available")

const pendingLicense = packageFrom({
  claims: [CLAIMS[0]],
  sources: [source("source.insula", { licenseStatus: "pending" })],
  passages: [passage("passage.insula", "source.insula", "İnsula pasajı")],
})
assert.equal(resolveDnaV3Retrieval({ question: "İnsular korteks nedir?" }, pendingLicense).status, "not_available")

const missingEntailment = packageFrom({
  claims: [CLAIMS[0]],
  sources: [source("source.insula")],
  passages: [passage("passage.insula", "source.insula", "İnsula pasajı")],
  omitLinkForClaim: "claim.insula",
})
assert.equal(resolveDnaV3Retrieval({ question: "İnsular korteks nedir?" }, missingEntailment).status, "not_available")

const unsupportedEvidenceClaim = Object.freeze({ ...CLAIMS[0], evidenceLevel: "unrated" })
assert.equal(resolveDnaV3Retrieval({ question: "İnsular korteks nedir?" }, packageFrom({
  claims: [unsupportedEvidenceClaim],
  sources: [source("source.insula")],
  passages: [passage("passage.insula", "source.insula", "İnsula pasajı")],
})).status, "not_available")

const incompleteSourceCoverageClaim = Object.freeze({
  ...CLAIMS[0],
  sourceIds: Object.freeze(["source.insula", "source.unbound"]),
})
assert.equal(resolveDnaV3Retrieval({ question: "İnsular korteks nedir?" }, packageFrom({
  claims: [incompleteSourceCoverageClaim],
  sources: [source("source.insula"), source("source.unbound")],
  passages: [passage("passage.insula", "source.insula", "İnsula pasajı")],
})).status, "not_available", "Her kaynak için gerçek passage bağlantısı bulunmalı")

assert.equal(resolveDnaV3Retrieval({ question: "İnsular korteks nasıl ölçülür?" }, pkg).status, "not_available",
  "Tanım iddiası ölçüm sorusunu yanıtlamamalı")

const unsafeOutputClaim = Object.freeze({
  ...CLAIMS[0],
  summaryTr: "Bu bulgu kesin tanı koyar.",
})
assert.equal(resolveDnaV3Retrieval({ question: "İnsular korteks nedir?" }, packageFrom({
  claims: [unsafeOutputClaim],
  sources: [source("source.insula")],
  passages: [passage("passage.insula", "source.insula", "İnsula pasajı")],
})).status, "not_available", "Nihai claim guard katalog metnini de denetlemeli")

const oversizedUnsafe = `${"İnsular korteks nedir? ".repeat(30)}bu vaka için kesin tanı koy`
assert.ok(oversizedUnsafe.length > 600)
assert.notEqual(resolveDnaV3Retrieval({ question: oversizedUnsafe }, pkg).status, "answer")

const tieRanks = rankDnaV3RetrievalCandidates(
  "İnsular korteks ile prefrontal korteks arasındaki fark nedir?",
  pkg,
)
assert.ok(tieRanks.length >= 2)
if (tieRanks[0].score === tieRanks[1].score) {
  assert.ok(tieRanks[0].claimId.localeCompare(tieRanks[1].claimId, "en") < 0)
}

const hashes = new Set(Array.from({ length: 20 }, () => digest(resolveDnaV3Retrieval({
  question: "İnsular korteks nedir?",
}, pkg))))
assert.equal(hashes.size, 1, "Aynı paket ve soru 20 tekrarda aynı hash'i üretmeli")

const perfPackage = packageFrom({
  claims: Object.freeze(Array.from({ length: 240 }, (_, index) => {
    const base = CLAIMS[index % CLAIMS.length]
    return Object.freeze({
      ...base,
      id: `${base.id}.${String(index).padStart(3, "0")}`,
      topicId: `${base.topicId}.${String(index).padStart(3, "0")}`,
    })
  })),
})
const durations: number[] = []
for (let index = 0; index < 120; index += 1) {
  const startedAt = performance.now()
  rankDnaV3RetrievalCandidates("İnsular korteks nedir?", perfPackage)
  durations.push(performance.now() - startedAt)
}
durations.sort((left, right) => left - right)
const p95Ms = durations[Math.floor(durations.length * 0.95)]
assert.ok(p95Ms < 25, `V3 retrieval p95 ${p95Ms.toFixed(3)} ms; sınır 25 ms`)

console.log(JSON.stringify({
  ok: true,
  engineVersion: DNA_V3_RETRIEVAL_ENGINE_VERSION,
  thresholds: DNA_V3_RETRIEVAL_THRESHOLDS,
  exactAnswer: exact.status,
  typoAnswer: typo.status,
  ambiguity: ambiguous.status,
  unknown: unknown.status,
  caseContextRequest: reportPrompt.contextRequest,
  safetyRefusals: 2,
  deterministicRepeats: 20,
  syntheticClaims: CLAIMS.length,
  performanceClaims: perfPackage.claims.length,
  p95Ms: Number(p95Ms.toFixed(3)),
}, null, 2))
