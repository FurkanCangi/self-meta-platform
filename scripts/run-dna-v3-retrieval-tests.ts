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
import {
  attachVerifiedReportCaseAuthorityInternal,
  createDnaChatSafeCaseContext,
} from "../src/lib/dna/chat/caseContext"
import { createVerifiedReportCaseAuthorityInternal } from "../src/lib/dna/chat/knowledgeAuthority"
import {
  createCanonicalOwnedDnaCaseContext,
  DNA_OWNED_CASE_CONTEXT_VERSION,
} from "../src/lib/dna/chat/ownedCaseContextCore"
import {
  DNA_V3_CASE_THEORY_BOUNDARY_TR,
  doesDnaV3CaseAnswerMatchContext,
} from "../src/lib/dna/chat/v3CaseTheoryAssembler"
import {
  createDnaV3ScientificUnit,
  createDnaV3SourceCards,
  validateDnaV3AnswerEvidence,
} from "../src/lib/dna/chat/v3AnswerEvidence"
import {
  resolveDnaV3ResponseDepth,
} from "../src/lib/dna/chat/v3ResponseProfiles"
import {
  dnaV3CaseAgeGroupFromMonths,
  doesDnaV3LockedAgeBoundaryMatchCase,
} from "../src/lib/dna/chat/v3AgePolicy"

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
  ageScope: "all_ages",
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
  ageScope: "all_ages",
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
  authority?: DnaV3RetrievalClaim["authority"]
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
  ageScope: input.ageScope ?? "all_ages",
  claimBoundary: "Grup düzeyi bulgu bireysel biyolojik çıkarıma dönüştürülemez.",
  authority: input.authority ?? "external_scientific_information",
  dnaRelationship: input.dnaRelationship ?? "not_applicable",
  releaseStatus: input.authority === "dna_product_information"
    ? "owner_approved"
    : "release_eligible",
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
assert.equal(classifyDnaV3RetrievalIntent("Bu rapordaki karşı kanıtları özetle."), "case")
assert.equal(classifyDnaV3QueryKind("İnsular korteks nedir?"), "definition")
assert.equal(classifyDnaV3QueryKind("HRV nasıl ölçülür?"), "measurement")
assert.equal(classifyDnaV3QueryKind("Çocukluk yaş grubunda insular korteks nedir?"), "definition")
assert.equal(classifyDnaV3QueryKind("İnsular korteks gelişimi nasıldır?"), "development")
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
assert.equal(exact.responseDepth, "standard")
assert.equal(validateDnaV3AnswerEvidence({
  summary: exact.summary,
  details: exact.details,
  limitations: exact.limitations,
  units: exact.answerUnits,
  sources: exact.sources,
  pkg,
}).length, 0)
assert.ok(exact.answerUnits
  .filter((unit) => ["external_science", "dna_product"].includes(unit.authority))
  .every((unit) => unit.claimIds.length > 0 && unit.passageIds.length > 0 && unit.sourceIds.length > 0))
assert.equal(exact.sources[0].supportedClaimId, "claim.insula")
assert.equal(exact.sources[0].supportedClaim, CLAIMS[0].summaryTr)
assert.equal(exact.sources[0].knownBoundary, CLAIMS[0].claimBoundary)
assert.ok(Boolean(exact.sources[0].doi || exact.sources[0].officialUrl))

assert.equal(resolveDnaV3ResponseDepth("Kısaca söyle", "deep"), "short")
assert.equal(resolveDnaV3ResponseDepth("Kanıtlarıyla detaylı anlat", "short"), "deep")
assert.equal(resolveDnaV3ResponseDepth("Kısaca ama ayrıntılı anlat", "deep"), "standard")
assert.equal(resolveDnaV3ResponseDepth("Normal biçimde açıkla", "short"), "short")

const shortAnswer = resolveDnaV3Retrieval({
  question: "İnsular korteks hakkında kısaca açıkla.",
  responseDepth: "deep",
}, pkg)
assert.equal(shortAnswer.status, "answer")
assert.equal(shortAnswer.responseDepth, "short", "Doğal kısa sinyali seçili profili değiştirebilmeli")
assert.equal(shortAnswer.details.length, 0)
assert.equal(shortAnswer.limitations.length, 1)
assert.ok(shortAnswer.sources.length <= 2)

const deepAnswer = resolveDnaV3Retrieval({
  question: "İnsular korteks hakkında kanıtlarıyla detaylı anlat.",
  responseDepth: "short",
}, pkg)
assert.equal(deepAnswer.status, "answer")
assert.equal(deepAnswer.responseDepth, "deep", "Doğal derinlik sinyali seçili profili değiştirebilmeli")
assert.ok(deepAnswer.sources.length <= 8)
for (const requiredSection of [
  "definition",
  "function_or_relation",
  "development",
  "measurement",
  "evidence_status",
  "counter_evidence",
  "dna_boundary",
] as const) {
  assert.ok(deepAnswer.sections.some((section) => section.kind === requiredSection))
}
assert.ok(deepAnswer.limitations.some((limitation) => /içerik üretilmeden bırakıldı/.test(limitation)))
assert.ok(!JSON.stringify(deepAnswer).match(/(?:chain.of.thought|reasoningTrace|retrievalScore|internalThreshold)/i))

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

const canonicalOwned = createCanonicalOwnedDnaCaseContext({
  age_months: 96,
  scores: {
    physiological: 35,
    sensory: 18,
    emotional: 31,
    cognitive: 33,
    executive: 34,
    interoception: 36,
  },
  domain_levels: {
    physiological: "Tipik",
    sensory: "Atipik",
    emotional: "Tipik",
    cognitive: "Tipik",
    executive: "Tipik",
    interoception: "Tipik",
  },
  anamnesis: "Bu alan V3 vaka bağlamına girmemelidir.",
  answers: [{ secret: "ham yanıt" }],
  trace: { ruleId: "internal.rule" },
}, {
  reportId: "11111111-1111-4111-8111-111111111111",
  loadedReportId: "11111111-1111-4111-8111-111111111111",
  assessmentId: "22222222-2222-4222-8222-222222222222",
  loadedAssessmentId: "22222222-2222-4222-8222-222222222222",
  clientId: "33333333-3333-4333-8333-333333333333",
  loadedClientId: "33333333-3333-4333-8333-333333333333",
  ownerId: "44444444-4444-4444-8444-444444444444",
  sessionUserId: "44444444-4444-4444-8444-444444444444",
})
attachVerifiedReportCaseAuthorityInternal(
  canonicalOwned.context,
  createVerifiedReportCaseAuthorityInternal(DNA_OWNED_CASE_CONTEXT_VERSION),
)
const verifiedMixed = resolveDnaV3Retrieval({
  question: "Bu rapordaki insular korteks bulgusu literatürle uyumlu mu?",
  caseContext: canonicalOwned.context,
  responseDepth: "standard",
}, pkg)
assert.equal(verifiedMixed.status, "answer")
assert.equal(verifiedMixed.intent, "case_theory")
assert.equal(verifiedMixed.classification, "case_finding")
assert.equal(verifiedMixed.safetyBoundary, DNA_V3_CASE_THEORY_BOUNDARY_TR)
assert.ok(verifiedMixed.details.includes(DNA_V3_CASE_THEORY_BOUNDARY_TR))
const requiredMixedSections = [
  "case_finding",
  "case_missing",
  "general_literature",
  "case_non_inference",
  "preserved_capacity",
] as const
for (const requiredSection of requiredMixedSections) {
  assert.ok(verifiedMixed.sections.some((section) =>
    section.kind === requiredSection && section.unitIds.length > 0))
}
assert.deepEqual(verifiedMixed.sections.map((section) => section.kind), [
  ...requiredMixedSections,
  "boundary",
], "Karma vaka-teori cevabı altı zorunlu bölümü sabit sırada taşımalı")
assert.deepEqual(
  [...new Set(verifiedMixed.answerUnits.map((unit) => unit.section))],
  [...requiredMixedSections, "boundary"],
  "Sunuma açılan birimler zorunlu bölüm sırasını korumalı",
)
assert.equal(
  verifiedMixed.answerUnits.filter((unit) => unit.text === DNA_V3_CASE_THEORY_BOUNDARY_TR).length,
  1,
  "Vaka için biyolojik çıkarım sınırı yalnız bir kez gösterilmeli",
)
assert.equal(validateDnaV3AnswerEvidence({
  summary: verifiedMixed.summary,
  details: verifiedMixed.details,
  limitations: verifiedMixed.limitations,
  units: verifiedMixed.answerUnits,
  sources: verifiedMixed.sources,
  pkg,
}).length, 0)
assert.ok(verifiedMixed.answerUnits.some((unit) =>
  unit.authority === "case_report" && unit.caseFieldIds.length > 0))
assert.ok(verifiedMixed.answerUnits.some((unit) =>
  unit.authority === "external_science" && unit.claimIds.length > 0 && unit.passageIds.length > 0))
assert.match(verifiedMixed.summary, /eşleşen bir vaka bulgusu kayıtlı değildir/i,
  "İnsula sorusu ilişkisiz rapor ana eksenini vaka bulgusu gibi göstermemeli")
assert.ok(!JSON.stringify(verifiedMixed).match(/(?:anamnesis|ham yanıt|internal\.rule|trace|ruleId)/i))

const verifiedMixedBuVakada = resolveDnaV3Retrieval({
  question: "Bu vakada insular korteks bulgusu literatürle uyumlu mu?",
  caseContext: canonicalOwned.context,
}, pkg)
assert.equal(verifiedMixedBuVakada.status, "answer",
  "'Bu vakada' ifadesi teori sorusundan güvenle ayrıştırılmalı")

const verifiedCaseOnly = resolveDnaV3Retrieval({
  question: "Bu rapordaki bulguları özetle.",
  caseContext: canonicalOwned.context,
}, pkg)
assert.equal(verifiedCaseOnly.status, "answer",
  "Kimliği doğrulanmış raporun enumerated güvenli alanları bounded vaka cevabı üretebilmeli")
assert.equal(verifiedCaseOnly.intent, "case")
assert.equal(verifiedCaseOnly.classification, "case_finding")
assert.ok(verifiedCaseOnly.answerUnits.some((unit) =>
  unit.authority === "case_report" && unit.caseFieldIds.length === 1))
assert.ok(doesDnaV3CaseAnswerMatchContext(canonicalOwned.context, verifiedCaseOnly))
assert.doesNotMatch(JSON.stringify(verifiedCaseOnly), /(?:anamnesis|ham yanıt|internal\.rule|trace|ruleId)/i)

const verifiedPreserved = resolveDnaV3Retrieval({
  question: "Bu rapordaki korunmuş kapasiteleri özetle.",
  caseContext: canonicalOwned.context,
}, pkg)
assert.equal(verifiedPreserved.status, "answer")
assert.ok(verifiedPreserved.answerUnits.some((unit) => unit.section === "preserved_capacity"))

const verifiedCounter = resolveDnaV3Retrieval({
  question: "Bu rapordaki karşı kanıtları özetle.",
  caseContext: canonicalOwned.context,
}, pkg)
assert.equal(verifiedCounter.status, "answer")
assert.ok(verifiedCounter.answerUnits.some((unit) => unit.section === "preserved_capacity"))

const emptyOwned = createCanonicalOwnedDnaCaseContext({
  anamnesis: "Bu serbest metin hiçbir zaman vaka cevabına girmemelidir.",
  answers: [{ secret: "ham yanıt" }],
  trace: { ruleId: "internal.rule" },
}, {
  reportId: "55555555-5555-4555-8555-555555555555",
  loadedReportId: "55555555-5555-4555-8555-555555555555",
  assessmentId: "66666666-6666-4666-8666-666666666666",
  loadedAssessmentId: "66666666-6666-4666-8666-666666666666",
  clientId: "77777777-7777-4777-8777-777777777777",
  loadedClientId: "77777777-7777-4777-8777-777777777777",
  ownerId: "88888888-8888-4888-8888-888888888888",
  sessionUserId: "88888888-8888-4888-8888-888888888888",
})
attachVerifiedReportCaseAuthorityInternal(
  emptyOwned.context,
  createVerifiedReportCaseAuthorityInternal(DNA_OWNED_CASE_CONTEXT_VERSION),
)
const emptyCaseOnly = resolveDnaV3Retrieval({
  question: "Bu rapordaki bulguları özetle.",
  caseContext: emptyOwned.context,
}, pkg)
assert.equal(emptyCaseOnly.status, "not_available",
  "Yalnız genel eksik-veri sınırı taşıyan legacy/basic bağlamda vaka bulgusu uydurulmamalı")
assert.doesNotMatch(JSON.stringify(emptyCaseOnly), /(?:serbest metin|ham yanıt|internal\.rule|trace|ruleId)/i)

const verifiedUnknownMixed = resolveDnaV3Retrieval({
  question: "Bu rapordaki kuantum dolanıklığı bulgusu literatürle uyumlu mu?",
  caseContext: canonicalOwned.context,
}, pkg)
assert.equal(verifiedUnknownMixed.status, "not_available")

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

const partiallyUnknownTwoQuestions = resolveDnaV3Retrieval({
  question: "İnsula nedir? Kuantum dolanıklığı nedir?",
}, pkg)
assert.equal(partiallyUnknownTwoQuestions.status, "clarification")
assert.equal(partiallyUnknownTwoQuestions.sources.length, 0)
assert.equal(partiallyUnknownTwoQuestions.answerUnits.length, 0)
assert.doesNotMatch(
  JSON.stringify(partiallyUnknownTwoQuestions),
  new RegExp(CLAIMS[0].summaryTr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  "Kısmen eşleşen birleşik soru, kaynak kartı olmadan bilimsel yanıt metni sızdırmamalı",
)

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
assert.equal(dnaV3CaseAgeGroupFromMonths(96), "childhood")
assert.equal(doesDnaV3LockedAgeBoundaryMatchCase("childhood", 96), true)
assert.equal(doesDnaV3LockedAgeBoundaryMatchCase("adult", 96), false)
assert.equal(resolveDnaV3Retrieval({
  question: "Bu rapordaki prefrontal korteks bulgusu literatürle uyumlu mu?",
  caseContext: canonicalOwned.context,
}, adultOnly).status, "not_available",
"Çocuk vaka bağlamı yalnız yetişkin kapsamlı teori iddiasını kullanmamalı")

const pendingLicense = packageFrom({
  claims: [CLAIMS[0]],
  sources: [source("source.insula", { licenseStatus: "pending" })],
  passages: [passage("passage.insula", "source.insula", "İnsula pasajı")],
})
assert.equal(resolveDnaV3Retrieval({ question: "İnsular korteks nedir?" }, pendingLicense).status, "not_available")

const sourceWithoutCitationTarget = packageFrom({
  claims: [CLAIMS[0]],
  sources: [source("source.insula", { doi: null, officialUrl: null })],
  passages: [passage("passage.insula", "source.insula", "İnsula pasajı")],
})
assert.equal(resolveDnaV3Retrieval({ question: "İnsular korteks nedir?" }, sourceWithoutCitationTarget).status,
  "not_available", "Kaynak kartı DOI veya resmî URL olmadan gösterilmemeli")

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

const tamperedEvidenceErrors = validateDnaV3AnswerEvidence({
  summary: exact.summary,
  details: exact.details,
  limitations: exact.limitations,
  units: exact.answerUnits.map((unit, index) => index === 0
    ? { ...unit, passageIds: ["passage.forged"] }
    : unit),
  sources: exact.sources.map((card, index) => index === 0
    ? { ...card, supportedClaim: "Kaynağın desteklemediği geniş iddia." }
    : card),
  pkg,
})
assert.ok(tamperedEvidenceErrors.some((error) => error.startsWith("unit:passage_not_entailed")))
assert.ok(tamperedEvidenceErrors.some((error) => error.startsWith("source_card:presentation_mismatch")))

const unsupportedTextErrors = validateDnaV3AnswerEvidence({
  summary: "Pasajın desteklemediği genişletilmiş bilimsel iddia.",
  details: exact.details,
  limitations: exact.limitations,
  units: exact.answerUnits.map((unit, index) => index === 0
    ? { ...unit, text: "Pasajın desteklemediği genişletilmiş bilimsel iddia." }
    : unit),
  sources: exact.sources,
  pkg,
})
assert.ok(unsupportedTextErrors.some((error) => error.startsWith("unit:text_not_claim_bound")))

const multiPassageClaim = Object.freeze({
  ...CLAIMS[0],
  id: "claim.insula.multi",
  sourceClaimId: "claim.insula.multi",
  passageIds: Object.freeze(["passage.multi.1", "passage.multi.2", "passage.multi.3", "passage.multi.4"]),
  sourceIds: Object.freeze(["source.multi"]),
})
const secondDisplayedClaim = Object.freeze({
  ...CLAIMS[1],
  id: "claim.interoception.second",
  sourceClaimId: "claim.interoception.second",
  passageIds: Object.freeze(["passage.second"]),
  sourceIds: Object.freeze(["source.second"]),
})
const cardCoveragePackage = packageFrom({
  claims: [multiPassageClaim, secondDisplayedClaim],
  sources: [source("source.multi"), source("source.second")],
  passages: [
    ...multiPassageClaim.passageIds.map((passageId) =>
      passage(passageId, "source.multi", `Çoklu pasaj ${passageId}`)),
    passage("passage.second", "source.second", "İkinci iddianın pasajı"),
  ],
})
const coverageUnits = [
  createDnaV3ScientificUnit({ claim: multiPassageClaim, text: multiPassageClaim.summaryTr }),
  createDnaV3ScientificUnit({ claim: secondDisplayedClaim, text: secondDisplayedClaim.summaryTr }),
]
const balancedCards = createDnaV3SourceCards(
  [multiPassageClaim, secondDisplayedClaim],
  cardCoveragePackage,
  4,
)
assert.ok(balancedCards.some((card) => card.supportedClaimId === secondDisplayedClaim.sourceClaimId),
  "Çok pasajlı ilk iddia ikinci görünen iddianın kaynak kartını tüketmemeli")
assert.equal(validateDnaV3AnswerEvidence({
  summary: multiPassageClaim.summaryTr,
  details: [secondDisplayedClaim.summaryTr],
  limitations: [],
  units: coverageUnits,
  sources: balancedCards,
  pkg: cardCoveragePackage,
}).length, 0)
const missingDisplayedCardErrors = validateDnaV3AnswerEvidence({
  summary: multiPassageClaim.summaryTr,
  details: [secondDisplayedClaim.summaryTr],
  limitations: [],
  units: coverageUnits,
  sources: balancedCards.filter((card) => card.supportedClaimId !== secondDisplayedClaim.sourceClaimId),
  pkg: cardCoveragePackage,
})
assert.ok(missingDisplayedCardErrors.some((error) =>
  error.startsWith("unit:displayed_source_card_missing")))

const forbiddenCaseFieldErrors = validateDnaV3AnswerEvidence({
  summary: verifiedMixed.summary,
  details: verifiedMixed.details,
  limitations: verifiedMixed.limitations,
  units: verifiedMixed.answerUnits.map((unit) => unit.authority === "case_report"
    ? { ...unit, caseFieldIds: ["anamnesis"] }
    : unit),
  sources: verifiedMixed.sources,
  pkg,
})
assert.ok(forbiddenCaseFieldErrors.some((error) => error.startsWith("unit:case_binding_invalid")))

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
