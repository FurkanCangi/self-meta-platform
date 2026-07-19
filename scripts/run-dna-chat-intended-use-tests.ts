import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import matrixJson from "./dna-chat-fixtures/intended-use-matrix.json"
import {
  DNA_INTELLIGENCE_AUDIT_NOTICE_TR,
  createDnaChatSafeCaseContext,
  resolveDnaChat,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
} from "../src/lib/dna/chat"
import {
  createVerifiedTestCaseContext,
  TEST_REPORT_LINEAGE_IDS,
} from "./dna-chat-test-helpers"
import {
  DNA_INTELLIGENCE_INTENDED_USE_CONTRACT,
  DNA_INTELLIGENCE_INTENDED_USE_VERSION,
  DNA_INTELLIGENCE_PROHIBITED_CAPABILITY_IDS,
  DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
  DNA_INTELLIGENCE_SUPPORTED_CAPABILITY_IDS,
} from "../src/lib/dna/chat/intendedUse"

type SupportedFixture = {
  capabilityId: string
  question: string
  expectedOutcome: string
  expectedClassification: string
  expectedTopic: string | null
  requiresSources?: boolean
  requiresCaseContext?: boolean
  requiresCaseEvidence?: boolean
  requiresEvidenceSummary?: boolean
  requiredLimitation?: string
  expectedEvidenceLevel?: string
  expectedAgeScope?: string
}

type ProhibitedFixture = {
  capabilityId: string
  question: string
  expectedSafetyCategory: string
}

type ProhibitedHoldoutFixture = ProhibitedFixture & {
  id: string
}

type AdditionalBoundaryFixture = {
  id: string
  question: string
  expectedSafetyCategory: string
}

type NegativePairFixture = {
  allowedQuestion: string
  blockedQuestion: string
  blockedSafetyCategory: string
}

const matrix = matrixJson as {
  schemaVersion: string
  intendedUseVersion: string
  supported: SupportedFixture[]
  prohibited: ProhibitedFixture[]
  prohibitedHoldout: ProhibitedHoldoutFixture[]
  additionalSafetyBoundaries: AdditionalBoundaryFixture[]
  adversarialRegression: ProhibitedHoldoutFixture[]
  negativePairs: NegativePairFixture[]
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8")
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "en"))
}

const safeCaseContext = createDnaChatSafeCaseContext({
  dataStatus: "synthetic",
  ageMonths: 96,
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
    primaryAxis: "Fizyolojik regülasyon alanında göreli zorlanma",
    caseEvidenceLines: ["Fizyolojik alan Riskli düzeydedir."],
    counterEvidenceLines: ["Bilişsel alan Tipik düzeydedir."],
    preservedCapacityLines: ["Bilişsel regülasyon göreli korunmuştur."],
    dataLimitations: ["Doğrudan fizyolojik ölçüm bulunmamaktadır."],
  },
})

const ownedSafeCaseContext = createVerifiedTestCaseContext({
  dataStatus: "deidentified",
  ageMonths: safeCaseContext.ageMonths,
  scores: safeCaseContext.scores,
  levels: safeCaseContext.levels,
  chatContext: {
    primaryAxis: safeCaseContext.chatContext.primaryAxis,
    secondaryAxes: safeCaseContext.chatContext.secondaryAxes,
    caseEvidenceLines: safeCaseContext.chatContext.evidence,
    counterEvidenceLines: safeCaseContext.chatContext.counterEvidence,
    preservedCapacityLines: safeCaseContext.chatContext.preservedCapacities,
    dataLimitations: safeCaseContext.chatContext.limitations,
  },
})

async function main() {
  assert.equal(matrix.schemaVersion, "dna-chat-intended-use-matrix@1")
  assert.equal(matrix.intendedUseVersion, DNA_INTELLIGENCE_INTENDED_USE_VERSION)
  assert.equal(DNA_INTELLIGENCE_INTENDED_USE_CONTRACT.version, DNA_INTELLIGENCE_INTENDED_USE_VERSION)

  assert.deepEqual(
    sorted(matrix.supported.map((row) => row.capabilityId)),
    sorted(DNA_INTELLIGENCE_SUPPORTED_CAPABILITY_IDS),
    "Her desteklenen yetenek matriste tam bir kez bulunmalı",
  )
  assert.deepEqual(
    sorted(matrix.prohibited.map((row) => row.capabilityId)),
    sorted(DNA_INTELLIGENCE_PROHIBITED_CAPABILITY_IDS),
    "Her yasak yetenek matriste tam bir kez bulunmalı",
  )
  assert.equal(new Set(matrix.supported.map((row) => row.capabilityId)).size, matrix.supported.length)
  assert.equal(new Set(matrix.prohibited.map((row) => row.capabilityId)).size, matrix.prohibited.length)
  assert.equal(new Set(matrix.prohibitedHoldout.map((row) => row.id)).size, matrix.prohibitedHoldout.length)
  for (const capabilityId of DNA_INTELLIGENCE_PROHIBITED_CAPABILITY_IDS) {
    assert.ok(
      matrix.prohibitedHoldout.filter((row) => row.capabilityId === capabilityId).length >= 3,
      `${capabilityId}: en az üç bağımsız holdout paraphrase zorunlu`,
    )
  }

  for (const row of matrix.supported) {
    const response = resolveDnaChat({
      question: row.question,
      ...(row.requiresCaseContext ? { caseContext: safeCaseContext } : {}),
    })
    assert.equal(response.outcome, row.expectedOutcome, `${row.capabilityId}: outcome`)
    assert.equal(
      response.classification,
      row.expectedClassification,
      `${row.capabilityId}: classification`,
    )
    assert.equal(response.topic, row.expectedTopic, `${row.capabilityId}: topic`)
    assert.deepEqual(
      response.intendedUse,
      DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
      `${row.capabilityId}: intended-use descriptor`,
    )
    if (row.requiresSources) {
      assert.ok(response.sources.length > 0, `${row.capabilityId}: kaynak zorunlu`)
    } else {
      assert.equal(response.sources.length, 0, `${row.capabilityId}: kaynak üretilmemeli`)
    }
    if (row.requiresCaseEvidence) {
      assert.ok(response.caseEvidence.length > 0, `${row.capabilityId}: rapor dayanağı zorunlu`)
    }
    if (row.requiresEvidenceSummary) {
      assert.ok(response.evidenceSummary, `${row.capabilityId}: kanıt özeti zorunlu`)
      assert.ok(response.evidenceSummary?.level, `${row.capabilityId}: kanıt düzeyi zorunlu`)
      assert.ok(response.evidenceSummary?.ageScope, `${row.capabilityId}: yaş kapsamı zorunlu`)
      assert.ok(response.evidenceSummary?.sampleScope, `${row.capabilityId}: örneklem sınırı zorunlu`)
      assert.ok(response.evidenceSummary?.boundary, `${row.capabilityId}: iddia sınırı zorunlu`)
    }
    if (row.expectedEvidenceLevel) {
      assert.equal(response.evidenceSummary?.level, row.expectedEvidenceLevel, `${row.capabilityId}: kanıt düzeyi`)
    }
    if (row.expectedAgeScope) {
      assert.equal(response.evidenceSummary?.ageScope, row.expectedAgeScope, `${row.capabilityId}: yaş kapsamı`)
    }
    if (row.capabilityId === "show_age_and_sample_boundaries") {
      assert.match(response.evidenceSummary?.sampleScope ?? "", /yapılandırılmamıştır/)
      assert.match(response.evidenceSummary?.ageScope ?? "", /Yetişkin/)
    }
    if (row.capabilityId === "show_claim_linked_sources") {
      for (const source of response.sources) {
        assert.ok(source.id && (source.title || source.labelTr), "Kaynak kimliği ve başlığı zorunlu")
        assert.ok(source.claimBoundary, `${source.id}: iddia sınırı zorunlu`)
        assert.ok(source.ageScope, `${source.id}: yaş kapsamı zorunlu`)
        assert.ok(source.studyType, `${source.id}: çalışma türü zorunlu`)
        assert.ok(source.sampleScope, `${source.id}: örneklem sınırı zorunlu`)
      }
    }
    if (row.requiredLimitation) {
      assert.ok(
        response.limitations.includes(row.requiredLimitation),
        `${row.capabilityId}: zorunlu sınırlılık eksik`,
      )
    }
  }

  for (const row of matrix.prohibited) {
    const response = resolveDnaChat({ question: row.question, caseContext: safeCaseContext })
    assert.equal(response.outcome, "refused", `${row.capabilityId}: reddedilmeli`)
    assert.equal(response.classification, "refusal", `${row.capabilityId}: refusal sınıfı`)
    assert.equal(response.safety.category, row.expectedSafetyCategory, `${row.capabilityId}: kategori`)
    assert.equal(response.sources.length, 0, `${row.capabilityId}: kaynak sızmamalı`)
    assert.equal(response.caseEvidence.length, 0, `${row.capabilityId}: vaka dayanağı sızmamalı`)
  }

  for (const row of matrix.prohibitedHoldout) {
    const response = resolveDnaChat({ question: row.question, caseContext: safeCaseContext })
    assert.equal(response.outcome, "refused", `${row.id}: holdout reddedilmeli`)
    assert.equal(response.classification, "refusal", `${row.id}: holdout refusal sınıfı`)
    assert.equal(response.safety.category, row.expectedSafetyCategory, `${row.id}: holdout kategori`)
    assert.equal(response.sources.length, 0, `${row.id}: holdout kaynak sızmamalı`)
    assert.equal(response.caseEvidence.length, 0, `${row.id}: holdout vaka dayanağı sızmamalı`)
  }

  for (const row of matrix.additionalSafetyBoundaries) {
    const response = resolveDnaChat({ question: row.question, caseContext: safeCaseContext })
    assert.equal(response.classification, "refusal", `${row.id}: reddedilmeli`)
    assert.equal(response.safety.category, row.expectedSafetyCategory, `${row.id}: kategori`)
    assert.equal(response.sources.length, 0, `${row.id}: kaynak sızmamalı`)
    assert.equal(response.caseEvidence.length, 0, `${row.id}: vaka dayanağı sızmamalı`)
  }

  for (const row of matrix.adversarialRegression) {
    const response = resolveDnaChat({ question: row.question, caseContext: safeCaseContext })
    assert.equal(response.outcome, "refused", `${row.id}: dış prob regresyonu reddedilmeli`)
    assert.equal(response.classification, "refusal", `${row.id}: dış prob refusal sınıfı`)
    assert.equal(response.safety.category, row.expectedSafetyCategory, `${row.id}: dış prob kategori`)
    assert.equal(response.sources.length, 0, `${row.id}: dış prob kaynak sızmamalı`)
    assert.equal(response.caseEvidence.length, 0, `${row.id}: dış prob vaka dayanağı sızmamalı`)
  }

  for (const row of matrix.negativePairs) {
    const allowed = resolveDnaChat({ question: row.allowedQuestion })
    const blocked = resolveDnaChat({ question: row.blockedQuestion, caseContext: safeCaseContext })
    assert.notEqual(allowed.classification, "refusal", `İzinli sınır sorusu yanlış reddedildi: ${row.allowedQuestion}`)
    assert.equal(blocked.classification, "refusal", `Riskli eş reddedilmedi: ${row.blockedQuestion}`)
    assert.equal(blocked.safety.category, row.blockedSafetyCategory)
  }

  let loadCalls = 0
  const audits: DnaChatApiAuditInput[] = []
  const apiDependencies = {
    createRequestId: () => "phase-1-intended-use-request",
    loadCaseAnswer: async ({ question, mode, previousTopic }: {
      question: string
      mode?: "theory" | "dna" | "case"
      previousTopic?: string | null
    }) => {
      loadCalls += 1
      return {
        ok: true as const,
        answer: resolveDnaChat({ question, mode, previousTopic, caseContext: ownedSafeCaseContext }),
      }
    },
    writeAudit: async (input: DnaChatApiAuditInput) => {
      audits.push(input)
      return { ok: true }
    },
  }
  const theoryWithForeignReport = await resolveDnaChatApiRequest({
    question: "İnsular korteks nedir?",
    reportId: "foreign-report-id",
  }, apiDependencies)
  assert.equal(theoryWithForeignReport.status, 200)
  assert.equal(loadCalls, 0, "Teori sorusu reportId taşısa bile raporu okumamalı")
  assert.deepEqual(
    theoryWithForeignReport.body.intendedUse,
    DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    "API kanonik kullanım sözleşmesini taşımalı",
  )
  assert.equal(theoryWithForeignReport.body.intendedUseVersion, undefined)

  const ownedReportAnswer = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.",
    reportId: TEST_REPORT_LINEAGE_IDS.reportId,
  }, apiDependencies)
  assert.equal(ownedReportAnswer.status, 200)
  assert.equal(loadCalls, 1)
  assert.equal(audits.at(-1)?.mode, "case")
  assert.equal(audits.at(-1)?.intendedUseVersion, DNA_INTELLIGENCE_INTENDED_USE_VERSION)

  const contractArtifact = JSON.parse(
    readWorkspaceFile("docs/dna-intelligence/governance/intended-use-contract.json"),
  ) as unknown
  assert.deepEqual(
    contractArtifact,
    JSON.parse(JSON.stringify(DNA_INTELLIGENCE_INTENDED_USE_CONTRACT)),
    "Dokümante sözleşme runtime kanoniğiyle birebir aynı olmalı",
  )
  assert.equal(
    DNA_INTELLIGENCE_INTENDED_USE_CONTRACT.brandArchitecture.approach.kind,
    "therapist_education_and_clinical_reasoning_framework",
  )
  assert.equal(
    DNA_INTELLIGENCE_INTENDED_USE_CONTRACT.brandArchitecture.platform.kind,
    "deterministic_assessment_and_report_drafting_platform",
  )
  assert.equal(
    DNA_INTELLIGENCE_INTENDED_USE_CONTRACT.brandArchitecture.assistant.kind,
    "deterministic_source_controlled_information_assistant",
  )
  assert.match(
    DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.runtimeTr,
    /haricî LLM.*internetten bilgi arama kullanılmaz/,
  )
  assert.match(
    DNA_INTELLIGENCE_INTENDED_USE_CONTRACT.userQualificationBoundaryTr,
    /eğitim tamamlama durumunu teknik bir erişim koşulu olarak doğrulamaz/,
  )
  assert.match(DNA_INTELLIGENCE_AUDIT_NOTICE_TR, /intent etiketi.*kaynak kimlikleri/)
  assert.match(DNA_INTELLIGENCE_AUDIT_NOTICE_TR, /soru veya cevap metni.*rapor kimliği.*vaka bulgusu içermez/)
  assert.doesNotMatch(DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.privacyTr, /klinik içerik taşımayan/)

  const assistantSource = readWorkspaceFile("src/app/dna-asistani/DnaAssistantClient.tsx")
  const assistantPage = readWorkspaceFile("src/app/dna-asistani/page.tsx")
  const starterSource = readWorkspaceFile("src/app/starter/page.tsx")
  const reportsSource = readWorkspaceFile("src/app/reports/page.tsx")
  const apiSource = readWorkspaceFile("src/lib/dna/chat/apiResolver.ts")
  const safetySource = readWorkspaceFile("src/lib/dna/chat/safety.ts")
  assert.match(assistantSource, /DNA_INTELLIGENCE_PUBLIC_INTENDED_USE/)
  assert.match(assistantSource, /DNA_INTELLIGENCE_COMPOSER_NOTICE_TR/)
  assert.match(assistantSource, /DNA_INTELLIGENCE_AUDIT_NOTICE_TR/)
  assert.match(assistantSource, /DNA_INTELLIGENCE_PUBLIC_INTENDED_USE\.runtimeTr/)
  assert.doesNotMatch(assistantSource, />Mesajlar kaydedilmez</)
  assert.match(assistantPage, /DNA_INTELLIGENCE_PUBLIC_INTENDED_USE\.descriptionTr/)
  assert.ok(
    (starterSource.match(/DNA_INTELLIGENCE_ENTRY_DESCRIPTION_TR/g) ?? []).length >= 3,
    "Starter importu ve iki giriş yüzeyi aynı kanonik açıklamayı kullanmalı",
  )
  assert.doesNotMatch(reportsSource, />\s*Rapora sor\s*</)
  assert.match(reportsSource, /yapılandırılmış rapor bulgularını genel literatürden ayrı/)
  assert.match(apiSource, /intendedUse: answer\.intendedUse/)
  assert.match(safetySource, /runtime_self_learning_not_supported/)
  assert.match(safetySource, /DNA_INTELLIGENCE_PUBLIC_INTENDED_USE\.boundaryTr/)

  const legalSurfaces = [
    "src/app/terms/page.tsx",
    "src/app/privacy/page.tsx",
    "src/app/package-agreement/page.tsx",
    "src/app/kvkk/page.tsx",
    "src/app/retention-policy/page.tsx",
    "src/app/explicit-consent/page.tsx",
  ]
  for (const path of legalSurfaces) {
    const source = readWorkspaceFile(path)
    assert.match(source, /DNA_INTELLIGENCE_(?:PUBLIC_INTENDED_USE|AUDIT_NOTICE_TR)/, `${path}: kanonik bağ eksik`)
  }

  const publicSurfaces = [
    "src/app/layout.tsx",
    "src/app/components/LandingHeroV2.tsx",
    "src/app/components/LandingHeader.tsx",
    "src/app/components/SolutionsGrid.tsx",
    "src/app/components/ClinicalJourneySection.tsx",
    "src/app/components/FooterContact.tsx",
    "src/app/components/FinalCTA.tsx",
    "src/app/components/TherapistsSection.tsx",
    "src/app/iletisim/ContactForm.tsx",
    "src/app/starter/page.tsx",
    "src/app/cozumler/page.tsx",
    "src/app/dna-nedir/page.tsx",
    "src/app/dna-nedir/content.ts",
    "src/app/dna-nedir/DnaInfoPage.tsx",
    "src/app/self-regulasyon-nedir/page.tsx",
    "src/app/klinik-alanlar/[slug]/page.tsx",
  ]
  const forbiddenMarketingClaims = [
    "Klinik yapay zekâ platformu",
    "yapay zekâ destekli içgörüler",
    "Kişiye özel terapi planlarını hızlıca oluşturun",
    "Klinik raporlarınızı otomatik oluşturun",
    "Self-regülasyon alanları beyin bölgelerine bağlanan",
    "Müdahale kararını en anlamlı klinik alanlardan başlayarak sıralayın",
    "Uzman onayı bekliyor",
    "yüzeydeki dikkatsizliğin olası klinik kaynaklarını ayırt etmeye yardım eder",
    "Örüntüleri ve öncelikleri görünür kılar",
    "Klinik örüntüleri, güçlü alanları ve öncelikleri görünür kılar",
    "Özet, klinik öncelikler, hedefler ve takip göstergeleri",
    "AI analizini çalıştırın",
    "Sistem verileri birlikte okuyarak örüntüleri ve öncelikleri düzenlesin",
    "Klinik karar desteği",
    "Birincil öncelik",
    "Veriden karara, tek çizgide",
    "Üç aşamada bulgudan klinik önceliğe",
    "AI ne yapar?",
    "AI rapor taslağı",
    "AI destekli klinik raporlama örneği",
    "Klinik karar destek altyapısı",
    "AI destekli raporlama",
    "Klinisyen onaylı rapor taslağı",
    "klinik karar destek çıktısı",
    "deterministik bir karar destek raporu",
    "klinik karar destek raporu",
    "Platform karar destek sağlar",
    "Platform uzmanlara karar destek aracı sunar",
    "karar destek mantığıyla",
  ]
  for (const path of [...publicSurfaces, ...legalSurfaces]) {
    const source = readWorkspaceFile(path)
    for (const claim of forbiddenMarketingClaims) {
      assert.ok(!source.includes(claim), `${path}: yasak veya yanıltıcı pazarlama iddiası: ${claim}`)
    }
  }
  const landingHeroSource = readWorkspaceFile("src/app/components/LandingHeroV2.tsx")
  const solutionsSource = readWorkspaceFile("src/app/components/SolutionsGrid.tsx")
  const clinicalJourneySource = readWorkspaceFile("src/app/components/ClinicalJourneySection.tsx")
  const clinicalAreasSource = readWorkspaceFile("src/app/klinik-alanlar/[slug]/page.tsx")
  const finalCtaSource = readWorkspaceFile("src/app/components/FinalCTA.tsx")
  const contactSource = readWorkspaceFile("src/app/iletisim/ContactForm.tsx")
  const explicitConsentSource = readWorkspaceFile("src/app/explicit-consent/page.tsx")
  assert.match(landingHeroSource, /DNA_INTELLIGENCE_PLATFORM_DESCRIPTION_TR/)
  assert.match(landingHeroSource, /DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR/)
  assert.match(landingHeroSource, /haricî LLM veya internetten bilgi arama kullanılmaz/)
  assert.match(solutionsSource, /yazılım terapi veya seans planı üretmez/)
  assert.match(solutionsSource, /terapist incelemesi ve düzenlemesinden sonra/)
  assert.match(clinicalJourneySource, /klinik önceliği terapist belirler/)
  assert.match(clinicalAreasSource, /fizyolojik durumu doğrudan ölçmez/)
  assert.match(clinicalAreasSource, /Platform biyolojik yük veya otonom durum çıkarımı yapmaz/)
  assert.match(finalCtaSource, /DNA_INTELLIGENCE_PLATFORM_DESCRIPTION_TR/)
  assert.match(finalCtaSource, /DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR/)
  assert.match(contactSource, /Deterministik raporlama/)
  assert.match(explicitConsentSource, /DNA_INTELLIGENCE_PUBLIC_INTENDED_USE\.privacyTr/)
  assert.match(explicitConsentSource, /DNA_INTELLIGENCE_PUBLIC_INTENDED_USE\.runtimeTr/)
  const dnaInfoSource = readWorkspaceFile("src/app/dna-nedir/DnaInfoPage.tsx")
  assert.match(dnaInfoSource, /Klinik önceliği terapist belirler/)
  assert.match(dnaInfoSource, /hedef veya takip kararı üretilmez/)
  assert.match(dnaInfoSource, /Deterministik motor ne yapar\?/)
  assert.doesNotMatch(
    dnaInfoSource,
    /(?:AI|Sistem|DNA Intelligence)[^.!?]{0,160}(?:öncelikleri görünür kılar|klinik öncelikleri yapılandırır|bir sonraki klinik kararı hazırlar)/,
  )

  const matrixBytes = readWorkspaceFile("scripts/dna-chat-fixtures/intended-use-matrix.json")
  const contractBytes = readWorkspaceFile("docs/dna-intelligence/governance/intended-use-contract.json")
  console.log(JSON.stringify({
    ok: true,
    intendedUseVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
    supportedCoverage: `${matrix.supported.length}/${DNA_INTELLIGENCE_SUPPORTED_CAPABILITY_IDS.length}`,
    prohibitedCoverage: `${matrix.prohibited.length}/${DNA_INTELLIGENCE_PROHIBITED_CAPABILITY_IDS.length}`,
    additionalSafetyBoundaries: matrix.additionalSafetyBoundaries.length,
    adversarialRegression: matrix.adversarialRegression.length,
    prohibitedHoldout: matrix.prohibitedHoldout.length,
    negativePairs: matrix.negativePairs.length,
    surfaces: {
      engine: true,
      api: true,
      assistantUi: true,
      entryMarketing: true,
      publicMarketing: true,
      reportCta: true,
      legal: true,
    },
    evidence: {
      matrixSha256: sha256(matrixBytes),
      contractSha256: sha256(contractBytes),
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
