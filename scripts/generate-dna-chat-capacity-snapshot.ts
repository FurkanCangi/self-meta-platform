import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS,
  DNA_CHAT_CATALOG_CLAIMS,
  DNA_CHAT_CATALOG_PROVENANCE,
  DNA_CHAT_CATALOG_RELATIONS,
  DNA_CHAT_CATALOG_SAFETY_RULES,
  DNA_CHAT_CATALOG_SOURCES,
  DNA_CHAT_CATALOG_TOPICS,
  DNA_CHAT_QUERY_KINDS,
} from "../src/lib/dna/chat/catalog"

type DenseKnowledgeUnit = Readonly<{
  claimId: string
  dimensions: readonly string[]
  domain: string
  passageId: string
  sourceId: string
  topicId: string
}>

type DenseRuntime = Readonly<{
  counts: Readonly<{
    externalCandidatesPreserved: number
    externalUnitsLive: number
    ownerUnits: number
  }>
  pipelineVersion: string
  runtimePolicy?: Readonly<Record<string, boolean>>
  source: Readonly<{
    approvalStatus: string
    citationStatus: string
    id: string
    scientificValidationStatus: string
    sha256: string
    title: string
  }>
  units: readonly DenseKnowledgeUnit[]
}>

type DenseManifest = Readonly<{
  counts: Readonly<{
    externalCandidatesPreserved: number
    externalUnitsLive: number
    lockedHoldoutQuestions: number
    openDevelopmentQuestions: number
    ownerKnowledgeUnits: number
    ownerSentencesTerminal: number
    questionSurfaces: number
  }>
  coverage: Readonly<{
    matrixSha256: string
    unfilledCellCount: number
  }>
  evaluation: Readonly<{
    holdoutFirstResultImmutable: boolean
    lockedHoldoutCurrentEngineResult: EvaluationResult
    lockedHoldoutFirstResult: EvaluationResult
    openDevelopment: EvaluationResult
  }>
  hashes: Readonly<Record<string, string>>
  manifestSha256: string
  pipelineVersion: string
  runtimePolicy: Readonly<{
    embedding: boolean
    externalLlm: boolean
    newDatabaseTable: boolean
    runtimeInternet: boolean
    vectorDatabase: boolean
  }>
  source: Readonly<{
    approvalStatus: string
    citationStatus: string
    scientificValidationStatus: string
  }>
  terminalDecisions: Readonly<Record<string, number>>
}>

type OwnerBookManifest = Readonly<{
  counts: Readonly<{
    citationPendingSentences: number
    sentences: number
    sentencesWithInlineCitation: number
    sentencesWithoutInlineCitation: number
  }>
  runtimeSha256: string
}>

type ExternalCandidateManifest = Readonly<{
  liveRuntime: string
  releaseEligible: boolean
  runtimeEligible: boolean
  status: string
  summary: Readonly<{
    evaluationSummary: Readonly<{
      holdoutCount: number
    }>
    flexBankOverlapCount: number
    sourceInventory: Readonly<{
      licensedRuntimeCandidateCount: number
      licensedRuntimeCandidatePages: number
      uniquePdfArtifactCount: number
    }>
    uniquePrimaryClaimCount: number
    uniquePrimaryPassageCount: number
    uniqueQuestionFormCount: number
    unitCount: number
    unitsSha256: string
  }>
}>

type EvaluationResult = Readonly<{
  accuracy: number
  caseCount: number
  correct: number
  p95Ms: number
  resultSha256: string
}>

const ROOT = process.cwd()
const EVIDENCE_DIR = path.join(ROOT, "docs/dna-intelligence/program/evidence")
const CURRENT_JSON = path.join(EVIDENCE_DIR, "dna-chat-capacity-current.json")
const CURRENT_MD = path.join(ROOT, "docs/dna-intelligence/chat-capacity-current.md")
const DENSE_MANIFEST_PATH = path.join(
  ROOT,
  "src/lib/dna/chat/catalog/generated/dense/manifest.json",
)
const DENSE_RUNTIME_PATH = path.join(
  ROOT,
  "src/lib/dna/chat/catalog/generated/dense/runtime.json",
)
const OWNER_BOOK_MANIFEST_PATH = path.join(
  ROOT,
  "src/lib/dna/chat/catalog/generated/owner-book/manifest.json",
)
const EXTERNAL_CANDIDATE_PATH = path.join(
  ROOT,
  "docs/dna-intelligence/program/evidence/book-catalog-v32-current.json",
)

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function countBy(values: readonly string[]) {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)))
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function fileSha256(filePath: string) {
  return sha256(fs.readFileSync(filePath))
}

function stableBenchmarkFamilyCount() {
  return new Set(DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.map((entry) => entry.semanticFamily)).size
}

function buildSnapshot(asOf: string) {
  assert.match(asOf, /^\d{4}-\d{2}-\d{2}$/)
  const denseManifest = readJson<DenseManifest>(DENSE_MANIFEST_PATH)
  const denseRuntime = readJson<DenseRuntime>(DENSE_RUNTIME_PATH)
  const ownerBookManifest = readJson<OwnerBookManifest>(OWNER_BOOK_MANIFEST_PATH)
  const externalCandidate = readJson<ExternalCandidateManifest>(EXTERNAL_CANDIDATE_PATH)

  assert.equal(denseRuntime.units.length, denseManifest.counts.ownerKnowledgeUnits)
  assert.equal(denseRuntime.counts.ownerUnits, denseRuntime.units.length)
  assert.equal(
    ownerBookManifest.counts.sentences,
    denseManifest.counts.ownerSentencesTerminal,
  )
  assert.equal(
    externalCandidate.summary.unitCount,
    denseManifest.counts.externalCandidatesPreserved,
  )
  assert.equal(denseRuntime.counts.externalUnitsLive, 0)

  const ownerUniqueClaims = new Set(denseRuntime.units.map((unit) => unit.claimId)).size
  const ownerUniquePassages = new Set(denseRuntime.units.map((unit) => unit.passageId)).size
  const ownerUniqueTopics = new Set(denseRuntime.units.map((unit) => unit.topicId)).size
  const ownerUniqueSources = new Set(denseRuntime.units.map((unit) => unit.sourceId)).size
  const ownerDomainDistribution = countBy(denseRuntime.units.map((unit) => unit.domain))
  const ownerDimensionDistribution = countBy(
    denseRuntime.units.flatMap((unit) => unit.dimensions),
  )

  assert.equal(ownerUniqueClaims, denseRuntime.units.length)
  assert.equal(ownerUniquePassages, denseRuntime.units.length)
  assert.equal(ownerUniqueSources, 1)

  const catalogHoldout = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter(
    (entry) => entry.holdout,
  ).length
  const catalogRefusals = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter(
    (entry) => entry.evaluationScope === "safety_refusal",
  ).length
  const catalogSupported = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter(
    (entry) => entry.evaluationScope === "supported_answerable",
  ).length
  const claimSourceLinks = DNA_CHAT_CATALOG_CLAIMS.reduce(
    (total, claim) => total + claim.sourceIds.length,
    0,
  )
  const relationSourceLinks = DNA_CHAT_CATALOG_RELATIONS.reduce(
    (total, relation) => total + relation.sourceIds.length,
    0,
  )
  const passageLinkedClaims = DNA_CHAT_CATALOG_CLAIMS.filter(
    (claim) => (claim.passageIds?.length ?? 0) > 0,
  )
  const claimPassageLinks = passageLinkedClaims.reduce(
    (total, claim) => total + (claim.passageIds?.length ?? 0),
    0,
  )
  const uniqueCatalogPassages = new Set(
    passageLinkedClaims.flatMap((claim) => claim.passageIds ?? []),
  ).size
  const liveFactRecords = denseRuntime.units.length + DNA_CHAT_CATALOG_CLAIMS.length
  const coverageCells = 140
  const filledCoverageCells = coverageCells - denseManifest.coverage.unfilledCellCount
  const supportedQueryKinds = DNA_CHAT_QUERY_KINDS.filter((kind) => kind !== "unknown")

  const identitySeed = JSON.stringify({
    asOf,
    denseManifestSha256: denseManifest.manifestSha256,
    catalog: {
      claims: DNA_CHAT_CATALOG_CLAIMS.length,
      relations: DNA_CHAT_CATALOG_RELATIONS.length,
      sources: DNA_CHAT_CATALOG_SOURCES.length,
      topics: DNA_CHAT_CATALOG_TOPICS.length,
    },
  })
  const snapshotId = `${asOf}-${sha256(identitySeed).slice(0, 12)}`

  const payload = {
    schemaVersion: "dna-chat-capacity-snapshot@1",
    snapshotId,
    asOf,
    interpretation: {
      primaryRule: "Bilgi birimi, soru yüzeyi, kaynak ve test sorusu ayrı paydalardır.",
      liveFactRecordDefinition: "Canlı owner-book atomları ile canlı kaynak-bağlı katalog iddialarının aritmetik toplamıdır.",
      globalUniquenessStatus: "not_deduplicated_across_owner_book_and_verified_catalog",
      marketingUniqueKnowledgeUnits: null,
      reason: "İki canlı katman arasında küresel semantik tekilleştirme tamamlanmadı.",
    },
    architecture: {
      engine: externalCandidate.liveRuntime,
      catalogVersion: "dna-chat-catalog@2",
      pipelineVersion: denseManifest.pipelineVersion,
      mode: "deterministic_source_grounded",
      runtimeInternet: denseManifest.runtimePolicy.runtimeInternet,
      externalLlm: denseManifest.runtimePolicy.externalLlm,
      embedding: denseManifest.runtimePolicy.embedding,
      vectorDatabase: denseManifest.runtimePolicy.vectorDatabase,
      responseProfiles: ["short", "standard", "deep"],
      supportedQueryKinds,
      supportedQueryKindCount: supportedQueryKinds.length,
      maximumCompoundSubQuestions: 2,
    },
    liveInventory: {
      ownerBook: {
        documents: ownerUniqueSources,
        terminalSentences: denseManifest.counts.ownerSentencesTerminal,
        terminalDecisionDistribution: denseManifest.terminalDecisions,
        atomicKnowledgeUnits: denseRuntime.units.length,
        uniqueClaims: ownerUniqueClaims,
        uniquePassages: ownerUniquePassages,
        uniqueTopics: ownerUniqueTopics,
        questionSurfaces: denseManifest.counts.questionSurfaces,
        domainDistribution: ownerDomainDistribution,
        dimensionDistribution: ownerDimensionDistribution,
        citationMappingPendingSentences: ownerBookManifest.counts.citationPendingSentences,
        sentencesWithInlineCitation: ownerBookManifest.counts.sentencesWithInlineCitation,
        sentencesWithoutInlineCitation: ownerBookManifest.counts.sentencesWithoutInlineCitation,
        approvalStatus: denseManifest.source.approvalStatus,
        scientificValidationStatus: denseManifest.source.scientificValidationStatus,
      },
      verifiedScienceCatalog: {
        researchPacks: DNA_CHAT_CATALOG_PROVENANCE.length,
        canonicalTopics: DNA_CHAT_CATALOG_TOPICS.length,
        sourceLinkedClaims: DNA_CHAT_CATALOG_CLAIMS.length,
        exactPassageLinkedClaims: passageLinkedClaims.length,
        claimPassageLinks,
        uniqueCatalogPassages,
        explicitSingleStepRelations: DNA_CHAT_CATALOG_RELATIONS.length,
        verifiedSourceRecords: DNA_CHAT_CATALOG_SOURCES.length,
        claimSourceLinks,
        averageSourcesPerClaim: round(claimSourceLinks / DNA_CHAT_CATALOG_CLAIMS.length, 3),
        relationSourceLinks,
        safetyRules: DNA_CHAT_CATALOG_SAFETY_RULES.length,
        canonicalBenchmarkQuestions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length,
        canonicalBenchmarkHoldoutQuestions: catalogHoldout,
        canonicalSemanticFamilies: stableBenchmarkFamilyCount(),
        canonicalSafetyRefusals: catalogRefusals,
        canonicalSupportedAnswerable: catalogSupported,
      },
      totals: {
        liveFactRecords,
        globallyDeduplicatedLiveKnowledgeUnits: null,
        globallyDeduplicated: false,
        liveQuestionSurfaces: denseManifest.counts.questionSurfaces,
        liveSafetyRules: DNA_CHAT_CATALOG_SAFETY_RULES.length,
      },
    },
    coverage: {
      domains: 10,
      dimensions: 14,
      totalCells: coverageCells,
      filledCells: filledCoverageCells,
      unfilledCells: denseManifest.coverage.unfilledCellCount,
      filledPercent: round((filledCoverageCells / coverageCells) * 100, 2),
      matrixSha256: denseManifest.coverage.matrixSha256,
    },
    evaluation: {
      denseCatalog: {
        openDevelopment: denseManifest.evaluation.openDevelopment,
        lockedHoldoutFirst: denseManifest.evaluation.lockedHoldoutFirstResult,
        lockedHoldoutCurrent: denseManifest.evaluation.lockedHoldoutCurrentEngineResult,
        lockedFirstResultImmutable: denseManifest.evaluation.holdoutFirstResultImmutable,
        totalCurrentEvaluatedQuestions:
          denseManifest.evaluation.openDevelopment.caseCount
          + denseManifest.evaluation.lockedHoldoutCurrentEngineResult.caseCount,
        openAndCurrentHoldoutDescriptiveAccuracy: round(
          ((denseManifest.evaluation.openDevelopment.correct
            + denseManifest.evaluation.lockedHoldoutCurrentEngineResult.correct)
            / (denseManifest.evaluation.openDevelopment.caseCount
              + denseManifest.evaluation.lockedHoldoutCurrentEngineResult.caseCount)) * 100,
          3,
        ),
        combinedAccuracyIsOfficialSingleScore: false,
      },
      canonicalCatalog: {
        questions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length,
        holdoutQuestions: catalogHoldout,
        semanticFamilies: stableBenchmarkFamilyCount(),
        safetyRefusalQuestions: catalogRefusals,
      },
    },
    lockedCandidates: {
      externalScience: {
        status: externalCandidate.status,
        units: externalCandidate.summary.unitCount,
        uniquePrimaryClaims: externalCandidate.summary.uniquePrimaryClaimCount,
        uniquePrimaryPassages: externalCandidate.summary.uniquePrimaryPassageCount,
        uniqueQuestionForms: externalCandidate.summary.uniqueQuestionFormCount,
        pdfArtifacts: externalCandidate.summary.sourceInventory.uniquePdfArtifactCount,
        licensedRuntimeCandidateSources:
          externalCandidate.summary.sourceInventory.licensedRuntimeCandidateCount,
        licensedRuntimeCandidatePages:
          externalCandidate.summary.sourceInventory.licensedRuntimeCandidatePages,
        holdoutQuestions: externalCandidate.summary.evaluationSummary.holdoutCount,
        flexibilityBankOverlap: externalCandidate.summary.flexBankOverlapCount,
        runtimeEligible: externalCandidate.runtimeEligible,
        releaseEligible: externalCandidate.releaseEligible,
        unitsLive: denseManifest.counts.externalUnitsLive,
      },
    },
    derivedMetrics: {
      ownerAcceptedTerminalDecisionPercent: round(
        ((denseManifest.terminalDecisions.accepted ?? 0)
          / denseManifest.counts.ownerSentencesTerminal) * 100,
        2,
      ),
      questionSurfacesPerOwnerKnowledgeUnit: round(
        denseManifest.counts.questionSurfaces / denseRuntime.units.length,
        3,
      ),
      ownerKnowledgeUnitsPerTerminalSentence: round(
        denseRuntime.units.length / denseManifest.counts.ownerSentencesTerminal,
        3,
      ),
      externalCandidateActivationPercent: round(
        (denseManifest.counts.externalUnitsLive
          / denseManifest.counts.externalCandidatesPreserved) * 100,
        2,
      ),
    },
    claimLanguage: {
      allowed: [
        `${denseRuntime.units.length.toLocaleString("tr-TR")} owner-book atomik bilgi birimi canlıdır.`,
        `${DNA_CHAT_CATALOG_CLAIMS.length.toLocaleString("tr-TR")} doğrulanmış kaynak bağlantılı katalog iddiası canlıdır.`,
        `${denseManifest.counts.questionSurfaces.toLocaleString("tr-TR")} deterministik soru yüzeyi desteklenmektedir.`,
        `${externalCandidate.summary.unitCount.toLocaleString("tr-TR")} dış-bilim bilgi birimi yayın dışı aday pakette kilitlidir.`,
      ],
      prohibited: [
        `${liveFactRecords.toLocaleString("tr-TR")} küresel olarak benzersiz bilgi birimi`,
        `${denseManifest.counts.questionSurfaces.toLocaleString("tr-TR")} soruyla eğitilmiş LLM`,
        `${externalCandidate.summary.unitCount.toLocaleString("tr-TR")} dış-bilim birimi canlı`,
        "Uzmanlarca doğrulanmış kitap modeli",
      ],
    },
    sourceIntegrity: {
      denseManifestSha256: denseManifest.manifestSha256,
      denseRuntimeSha256: fileSha256(DENSE_RUNTIME_PATH),
      ownerBookRuntimeSha256: ownerBookManifest.runtimeSha256,
      ownerBookSourceSha256: denseRuntime.source.sha256,
      externalCandidateUnitsSha256: externalCandidate.summary.unitsSha256,
      canonicalCatalogIdentitySha256: sha256(JSON.stringify({
        topics: DNA_CHAT_CATALOG_TOPICS.map((entry) => entry.id),
        claims: DNA_CHAT_CATALOG_CLAIMS.map((entry) => entry.id),
        relations: DNA_CHAT_CATALOG_RELATIONS.map((entry) => entry.id),
        sources: DNA_CHAT_CATALOG_SOURCES.map((entry) => entry.id),
        safetyRules: DNA_CHAT_CATALOG_SAFETY_RULES.map((entry) => entry.id),
        benchmarks: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.map((entry) => entry.id),
      })),
    },
  }

  return {
    ...payload,
    snapshotSha256: sha256(JSON.stringify(payload)),
  }
}

type CapacitySnapshot = ReturnType<typeof buildSnapshot>

function markdown(snapshot: CapacitySnapshot) {
  const owner = snapshot.liveInventory.ownerBook
  const catalog = snapshot.liveInventory.verifiedScienceCatalog
  const candidate = snapshot.lockedCandidates.externalScience
  const evaluation = snapshot.evaluation.denseCatalog
  const domainRows = Object.entries(owner.domainDistribution)
    .map(([domain, count]) => `| ${domain} | ${count.toLocaleString("tr-TR")} |`)
    .join("\n")

  return `# DNA Asistanı kapasite kaydı

Tarih: **${snapshot.asOf}**
Kayıt kimliği: \`${snapshot.snapshotId}\`

Bu kayıt, chat boxın bilgi miktarını şişirmeden izlemek için oluşturuldu. Bilgi birimi,
soru yüzeyi, kaynak, konu, ilişki ve test sorusu ayrı ölçülür.

## Kısa sonuç

| Ölçü | Mevcut sayı | Anlamı |
|---|---:|---|
| Kitaptan canlı atomik bilgi | ${owner.atomicKnowledgeUnits.toLocaleString("tr-TR")} | Her biri tek kitap pasajına bağlı cevap atomu |
| Kaynak bağlantılı canlı katalog iddiası | ${catalog.sourceLinkedClaims.toLocaleString("tr-TR")} | Sürümlü araştırma kataloğundan seçilen doğrulanmış güvenli alt küme |
| Birebir pasaj bağlı bilimsel iddia | ${catalog.exactPassageLinkedClaims.toLocaleString("tr-TR")} | Kaynak kimliği ve tam passage hash'i birlikte denetlenmiş yeni alt küme |
| Canlı bilgi kaydı toplamı | ${snapshot.liveInventory.totals.liveFactRecords.toLocaleString("tr-TR")} | İki katmanın aritmetik toplamı; küresel benzersizlik iddiası değildir |
| Farklı soru yüzeyi | ${owner.questionSurfaces.toLocaleString("tr-TR")} | Aynı bilginin akademik, gündelik, hatalı ve bağlamsal sorulma biçimleri |
| Kanonik konu | ${catalog.canonicalTopics.toLocaleString("tr-TR")} | Kaynaklı klasik katalogdaki yönlendirme başlıkları |
| Kitap konu bölümü | ${owner.uniqueTopics.toLocaleString("tr-TR")} | Kitap içindeki ayrı başlık/bağlam düğümleri |
| Açık tek-adımlı ilişki | ${catalog.explicitSingleStepRelations.toLocaleString("tr-TR")} | Zincirleme mekanizma üretmeden kullanılabilen graf kenarı |
| Doğrulanmış kaynak kaydı | ${catalog.verifiedSourceRecords.toLocaleString("tr-TR")} | Canlı klasik katalog kaynakları |
| Güvenlik kuralı | ${catalog.safetyRules.toLocaleString("tr-TR")} | Tanı, tedavi, nedensellik ve veri sınırları |

## Matematiksel görünüm

Canlı envanter vektörü:

\`L = (Kₒ, Cᵥ, Pᵥ, Q, T, R, S, G) = (${owner.atomicKnowledgeUnits}, ${catalog.sourceLinkedClaims}, ${catalog.exactPassageLinkedClaims}, ${owner.questionSurfaces}, ${catalog.canonicalTopics}, ${catalog.explicitSingleStepRelations}, ${catalog.verifiedSourceRecords}, ${catalog.safetyRules})\`

- \`Kₒ\`: owner-book atomik bilgi birimi
- \`Cᵥ\`: doğrulanmış kaynak bağlantılı katalog iddiası
- \`Pᵥ\`: birebir passage hash'iyle denetlenmiş katalog iddiası
- \`Q\`: deterministik soru yüzeyi
- \`T\`: kanonik konu
- \`R\`: açık tek-adımlı ilişki
- \`S\`: doğrulanmış kaynak kaydı
- \`G\`: güvenlik kuralı

Ham canlı bilgi kaydı: \`Kₒ + Cᵥ = ${owner.atomicKnowledgeUnits} + ${catalog.sourceLinkedClaims} = ${snapshot.liveInventory.totals.liveFactRecords}\`.
Bu sayı iki katman arasında anlam tekilleştirmesi yapılmadığı için “${snapshot.liveInventory.totals.liveFactRecords}
benzersiz bilgi” olarak kullanılamaz.

Her kitap bilgi birimi için ortalama **${snapshot.derivedMetrics.questionSurfacesPerOwnerKnowledgeUnit}** soru yüzeyi vardır.
10 × 14 kapsam matrisinin **${snapshot.coverage.filledCells}/${snapshot.coverage.totalCells}** hücresi doludur
(**%${snapshot.coverage.filledPercent}**); ${snapshot.coverage.unfilledCells} hücre açıktır.

## Kitap bilgi dağılımı

| Alan | Bilgi birimi |
|---|---:|
${domainRows}

Kitabın ${owner.terminalSentences.toLocaleString("tr-TR")} cümlesinin tamamı terminal karara bağlandı.
${owner.atomicKnowledgeUnits.toLocaleString("tr-TR")} atomik birim canlıdır. ${owner.sentencesWithInlineCitation.toLocaleString("tr-TR")}
cümlede metin içi atıf vardır; cümle–kaynakça eşlemesi henüz ayrıca tamamlanmadığı için kitap,
bağımsız bilimsel doğrulama olarak sunulmaz.

## Test gücü

- Açık geliştirme: **${evaluation.openDevelopment.correct}/${evaluation.openDevelopment.caseCount} = %${evaluation.openDevelopment.accuracy}**
- Kilitli holdout ilk sonuç: **${evaluation.lockedHoldoutFirst.correct}/${evaluation.lockedHoldoutFirst.caseCount} = %${evaluation.lockedHoldoutFirst.accuracy}**
- Kilitli holdout güncel motor: **${evaluation.lockedHoldoutCurrent.correct}/${evaluation.lockedHoldoutCurrent.caseCount} = %${evaluation.lockedHoldoutCurrent.accuracy}**
- Güncel holdout motor p95: **${evaluation.lockedHoldoutCurrent.p95Ms} ms**
- Eski kanonik benchmark: **${catalog.canonicalBenchmarkQuestions.toLocaleString("tr-TR")}** soru; bunun **${catalog.canonicalBenchmarkHoldoutQuestions.toLocaleString("tr-TR")}** tanesi holdout

Açık geliştirme ile holdout tek bir resmî doğruluk puanına birleştirilmez. Açık set motoru
iyileştirmek, holdout ise genellemeyi görmek içindir.

## Henüz canlı olmayan rezerv

- ${candidate.units.toLocaleString("tr-TR")} dış-bilim aday bilgi birimi
- ${candidate.uniquePrimaryPassages.toLocaleString("tr-TR")} benzersiz birincil pasaj
- ${candidate.uniqueQuestionForms.toLocaleString("tr-TR")} soru biçimi
- ${candidate.pdfArtifacts.toLocaleString("tr-TR")} benzersiz PDF artefaktı
- Canlı birim: **${candidate.unitsLive}**; runtime ve release kapıları kapalıdır

## Büyümeyi nasıl izleyeceğiz?

Yeni içerik eklediğimiz her turda aynı ölçüler yeniden üretilecek. Öncelik sırası:

1. Küresel tekilleştirilmiş bilgi birimi
2. Dolu kapsam hücresi
3. Kilitli holdout doğruluğu
4. Desteklenen doğal soru yüzeyi
5. Kaynak ve atıf kapsamı

Soru yüzeyini artırmak tek başına bilgi kapasitesini artırmış sayılmaz.
`
}

function compareFile(filePath: string, expected: string) {
  assert.ok(fs.existsSync(filePath), `capacity_snapshot_missing:${path.relative(ROOT, filePath)}`)
  assert.equal(
    fs.readFileSync(filePath, "utf8"),
    expected,
    `capacity_snapshot_stale:${path.relative(ROOT, filePath)}`,
  )
}

function main() {
  const mode = process.argv[2] ?? "verify"
  assert.ok(mode === "write" || mode === "verify", "usage: capacity-snapshot <write|verify>")

  const current = fs.existsSync(CURRENT_JSON)
    ? readJson<CapacitySnapshot>(CURRENT_JSON)
    : null
  const explicitAsOf = process.argv.find((argument) => argument.startsWith("--as-of="))
    ?.slice("--as-of=".length)
  const asOf = mode === "verify"
    ? current?.asOf
    : explicitAsOf ?? process.env.DNA_CHAT_CAPACITY_AS_OF ?? new Date().toISOString().slice(0, 10)
  assert.ok(asOf, "capacity_snapshot_as_of_missing")

  const snapshot = buildSnapshot(asOf)
  const json = `${JSON.stringify(snapshot, null, 2)}\n`
  const md = markdown(snapshot)
  const historyPath = path.join(
    EVIDENCE_DIR,
    `dna-chat-capacity-${snapshot.snapshotId}.json`,
  )

  if (mode === "write") {
    fs.writeFileSync(CURRENT_JSON, json)
    if (fs.existsSync(historyPath)) compareFile(historyPath, json)
    else fs.writeFileSync(historyPath, json, { flag: "wx" })
    fs.writeFileSync(CURRENT_MD, md)
  } else {
    compareFile(CURRENT_JSON, json)
    compareFile(historyPath, json)
    compareFile(CURRENT_MD, md)
  }

  console.log(JSON.stringify({
    ok: true,
    mode,
    snapshotId: snapshot.snapshotId,
    liveFactRecords: snapshot.liveInventory.totals.liveFactRecords,
    globallyDeduplicated: snapshot.liveInventory.totals.globallyDeduplicated,
    ownerKnowledgeUnits: snapshot.liveInventory.ownerBook.atomicKnowledgeUnits,
    verifiedCatalogClaims: snapshot.liveInventory.verifiedScienceCatalog.sourceLinkedClaims,
    questionSurfaces: snapshot.liveInventory.ownerBook.questionSurfaces,
    coveragePercent: snapshot.coverage.filledPercent,
    lockedHoldoutAccuracy: snapshot.evaluation.denseCatalog.lockedHoldoutCurrent.accuracy,
    externalCandidateUnitsLive: snapshot.lockedCandidates.externalScience.unitsLive,
  }, null, 2))
}

main()
