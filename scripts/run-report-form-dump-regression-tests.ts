import assert from "node:assert/strict"
import { buildJuryReadyReport } from "../src/lib/dna/reportJury"
import { FORM_DUMP_DUPLICATE_EXTERNAL_INPUT } from "./fixtures/dna-report-form-dump-case"

const RAW_FORM_LABEL = /(?:Adı-soyadı|Danışan Kodu|Kayıt Tarihi|Yaş aralığı|Cinsiyet|Kardeş sayısı|Ebeveyn iletişim bilgileri)\s*:/giu

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

async function main() {
  let providerCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    providerCalls += 1
    throw new Error("PROVIDER_CALL_FORBIDDEN_IN_FORM_DUMP_REGRESSION")
  }) as typeof fetch

  try {
    const result = await buildJuryReadyReport(FORM_DUMP_DUPLICATE_EXTERNAL_INPUT)
    const paragraphs = result.lockedLanguagePlan.sections.flatMap((section) => section.paragraphs.map((paragraph) => paragraph.text))
    const duplicateParagraphGroups = Array.from(
      paragraphs.reduce((groups, paragraph) => groups.set(paragraph, (groups.get(paragraph) ?? 0) + 1), new Map<string, number>()).values(),
    ).filter((occurrences) => occurrences > 1).length

    assert.equal(result.overallClassification, "Riskli")
    assert.equal(result.priorityProfile.primary_priority, "cognitive")
    assert.equal(result.base.decisionPlan.primaryFormulation?.id, "domain_physiological")
    assert.equal(result.validation.pass, true, result.validation.failureCodes.join(","))
    assert.equal(result.languageProvider, "deterministic")
    assert.equal(result.languageFallbackUsed, false)
    assert.equal(result.caseScopedEvidenceEnvelope.anamnesis_evidence.length, 0)
    assert.equal(result.caseScopedEvidenceEnvelope.functional_evidence_profile.has_caregiver_functional_evidence, false)
    assert.equal(count(result.finalReport, RAW_FORM_LABEL), 0)
    assert.doesNotMatch(result.finalReport, /Bakım verenin günlük yaşamdan verdiği örnekler:\s*Adı-soyadı/iu)
    assert.doesNotMatch(result.finalReport, /İnterosepsiyon alan puanı ile bakım veren anlatısı aynı yönde değildir/iu)
    assert.equal(result.rawExternalTests.length, 10, "Ham provenance korunmalı")
    assert.equal(result.externalEvidence.length, 5, "Beş benzersiz dış test kalmalı")
    assert.equal(new Set(result.externalEvidence.map((entry) => entry.id)).size, 5)
    assert.equal(result.externalEvidence.every((entry) => !entry.decision_relevant), true)
    assert.equal(count(result.finalReport, /klinik kararda kullanılmamıştır/giu), 5)
    assert.equal(duplicateParagraphGroups, 0)
    assert.equal(result.validation.fullBoldParagraphCount, 3)
    assert.equal(result.validation.unsupportedVisibleClauseCount, 0)
    assert.equal(result.validation.visibleFactualContradictionCount, 0)
    assert.equal(result.validation.unsupportedCausalityCount, 0)

    const olderBandResult = await buildJuryReadyReport({
      ...FORM_DUMP_DUPLICATE_EXTERNAL_INPUT,
      ageMonths: 54,
      answers: [...FORM_DUMP_DUPLICATE_EXTERNAL_INPUT.answers],
      anamnez: `${FORM_DUMP_DUPLICATE_EXTERNAL_INPUT.anamnez} Rapor Yorumu İçin Klinik Anamnez ${FORM_DUMP_DUPLICATE_EXTERNAL_INPUT.anamnez}`,
    })
    assert.equal(olderBandResult.validation.pass, true, olderBandResult.validation.failureCodes.join(","))
    assert.equal(olderBandResult.validation.genericTemplateFailureCount, 0)
    assert.equal(olderBandResult.validation.fullBoldParagraphCount, 3)
    assert.equal(olderBandResult.rawExternalTests.length, 20, "Tekrarlı canlı form provenance'i korunmalı")
    assert.equal(olderBandResult.externalEvidence.length, 5, "Tekrarlı canlı form beş benzersiz dış teste indirgenmeli")
    assert.equal(count(olderBandResult.finalReport, RAW_FORM_LABEL), 0)

    const meaningfulDenseForm = await buildJuryReadyReport({
      ...FORM_DUMP_DUPLICATE_EXTERNAL_INPUT,
      clientCode: "SYNTH-FORM-DUMP-MEANINGFUL",
      answers: [...FORM_DUMP_DUPLICATE_EXTERNAL_INPUT.answers],
      anamnez: "Adı-soyadı: sentetik Danışan Kodu: sentetik Kayıt Tarihi: 2026-08-26 Cinsiyet: belirtilmedi Kardeş sayısı: belirtilmedi Başvuru sebebi: Kantin sırasında metal tepsi düştüğünde kulaklarını kapatıp sıradan çıkıyor. Çocuğun güçlü yanları: Sakin bir odada görsel liste verildiğinde alışveriş oyununu tamamlıyor. Ebeveyn iletişim bilgileri: sentetik@example.invalid",
    })
    assert.equal(meaningfulDenseForm.validation.pass, true, meaningfulDenseForm.validation.failureCodes.join(","))
    assert.ok(meaningfulDenseForm.caseScopedEvidenceEnvelope.anamnesis_evidence.length >= 2, "İşlevsel form değerleri korunmalı")
    assert.match(meaningfulDenseForm.finalReport, /metal tepsi düştüğünde kulaklarını kapatıp sıradan çıkıyor/iu)
    assert.match(meaningfulDenseForm.finalReport, /görsel liste verildiğinde/iu)
    assert.match(meaningfulDenseForm.finalReport, /alışveriş oyununu tamamlıyor/iu)
    assert.equal(count(meaningfulDenseForm.finalReport, RAW_FORM_LABEL), 0)
    assert.doesNotMatch(meaningfulDenseForm.finalReport, /sentetik@example\.invalid/iu)
    assert.equal(providerCalls, 0)

    console.log(JSON.stringify({
      case: FORM_DUMP_DUPLICATE_EXTERNAL_INPUT.clientCode,
      overallClassification: result.overallClassification,
      primaryFormulation: result.base.decisionPlan.primaryFormulation?.id ?? null,
      confidence: result.confidence.category,
      anamnesisEvidenceFacts: result.caseScopedEvidenceEnvelope.anamnesis_evidence.length,
      rawFormLabels: count(result.finalReport, RAW_FORM_LABEL),
      rawExternalMentions: result.rawExternalTests.length,
      canonicalExternalEvidence: result.externalEvidence.length,
      externalBoundaryParagraphs: count(result.finalReport, /klinik kararda kullanılmamıştır/giu),
      duplicateParagraphGroups,
      boldParagraphs: result.validation.fullBoldParagraphCount,
      olderBandGenericBoldFailures: olderBandResult.validation.genericTemplateFailureCount,
      olderBandRawExternalMentions: olderBandResult.rawExternalTests.length,
      olderBandCanonicalExternalEvidence: olderBandResult.externalEvidence.length,
      meaningfulDenseFormFacts: meaningfulDenseForm.caseScopedEvidenceEnvelope.anamnesis_evidence.length,
      providerCalls,
      pass: true,
    }, null, 2))
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
