import assert from "node:assert/strict"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { AGE_NORM_BANDS, classifyTotalScore } from "../src/lib/dna/normativeBands"
import { buildJuryReadyReport, TemplateSemanticLeakageValidator, type JuryReportResult } from "../src/lib/dna/reportJury"
import { JURY_CHALLENGE_CASES, answersForJuryTotals } from "./fixtures/dna-report-jury-cases"

async function runCase(testCase: typeof JURY_CHALLENGE_CASES[number]) {
  const answers = answersForJuryTotals(testCase.totals)
  const scores = calculateAssessment(answers)
  return buildJuryReadyReport({ clientCode: testCase.id, ageMonths: testCase.ageMonths, anamnez: testCase.anamnez, answers, scores: { fizyolojik: scores.fizyolojik, duyusal: scores.duyusal, duygusal: scores.duygusal, bilissel: scores.bilissel, yurutucu: scores.yurutucu, intero: scores.intero, toplam: scores.toplam } })
}

async function runTotals(id: string, totals: readonly [number, number, number, number, number, number]) {
  const answers = answersForJuryTotals(totals)
  const scores = calculateAssessment(answers)
  return buildJuryReadyReport({ clientCode: id, ageMonths: 60, anamnez: "Başvuru sebebi: Günlük görevlerde güçlük bildiriliyor. Terapist yorumları: Yapılandırılmış görevde performans doğrudan gözlendi.", answers, scores: { fizyolojik: scores.fizyolojik, duyusal: scores.duyusal, duygusal: scores.duygusal, bilissel: scores.bilissel, yurutucu: scores.yurutucu, intero: scores.intero, toplam: scores.toplam } })
}

async function main() {
  for (const band of AGE_NORM_BANDS) {
    assert.equal(classifyTotalScore(band.total.atypicalMax, { ageMonths: band.minMonths }), "Atipik")
    assert.equal(classifyTotalScore(band.total.atypicalMax + 1, { ageMonths: band.minMonths }), "Riskli")
    assert.equal(classifyTotalScore(band.total.riskMax, { ageMonths: band.maxMonths }), "Riskli")
    assert.equal(classifyTotalScore(band.total.riskMax + 1, { ageMonths: band.maxMonths }), "Tipik")
  }
  assert.equal(classifyTotalScore(143), "Atipik")
  assert.equal(classifyTotalScore(144), "Riskli")
  assert.equal(classifyTotalScore(221), "Riskli")
  assert.equal(classifyTotalScore(222), "Tipik")

  const results: JuryReportResult[] = []
  let legacyMismatchCount = 0
  for (const testCase of JURY_CHALLENGE_CASES) {
    const answers = answersForJuryTotals(testCase.totals)
    const legacy = calculateAssessment(answers)
    if (legacy.siniflama !== testCase.expectedOverallClassification) legacyMismatchCount += 1
    const result = await runCase(testCase)
    assert.equal(result.overallClassification, testCase.expectedOverallClassification, `${testCase.id}: canonical classification`)
    assert.equal(result.validation.classificationConsistent, true, `${testCase.id}: rendered classification`)
    assert.equal(result.validation.profileBreadthConsistent, true, `${testCase.id}: breadth consistency`)
    assert.equal(result.validation.therapistObservationConsistent, true, `${testCase.id}: observation consistency`)
    assert.equal(result.validation.externalTestExtractionRecall, 1, `${testCase.id}: external extraction recall`)
    assert.equal(result.validation.criticalInternalContradictionCount, 0, `${testCase.id}: internal contradiction`)
    assert.equal(result.validation.pass, true, `${testCase.id}: ${result.validation.failureCodes.join(",")}`)
    assert.equal(result.reportStatus, "ready_for_therapist_review", `${testCase.id}: critic status`)
    assert.equal(result.critic.status, "pass", `${testCase.id}: ${JSON.stringify(result.critic.findings)}`)
    assert.equal(result.validation.unsupportedDiagnosisCount, 0)
    assert.equal(result.validation.unsupportedCausalityCount, 0)
    assert.equal(result.validation.unsupportedBiologicalMechanismCount, 0)
    assert.equal(result.validation.unsupportedSourceCount, 0)
    assert.equal(result.validation.templateSemanticLeakageCount, 0, `${testCase.id}: template semantic leakage`)
    assert.equal(result.templateSemanticLeakage.pass, true, `${testCase.id}: ${JSON.stringify(result.templateSemanticLeakage.findings)}`)
    assert.equal(result.validation.invalidExternalEvidenceUsedIds.length, 0)
    assert.equal(result.validation.missingValidExternalEvidenceIds.length, 0)
    assert.equal(result.languageProvider, "deterministic")
    assert.equal(result.languageFallbackUsed, false)
    // Tekrar cümleleri içerik sayılmaz; semantik kapsam kapıları sıfırken 800 kelime
    // gerçek klinik ayrıntının yanlışlıkla budanmasına karşı yeterli alt sınırdır.
    assert.ok(result.validation.wordCount >= 800, `${testCase.id}: severe content-loss guard`)
    assert.equal(result.validation.rawNoisyAnamnesisLeakCount, 0, `${testCase.id}: raw noisy anamnesis`)
    assert.equal(result.validation.grammarFragmentCount, 0, `${testCase.id}: grammar fragment`)
    assert.equal(result.validation.domainListGrammarErrorCount, 0, `${testCase.id}: domain-list grammar`)
    assert.equal(result.validation.affectedDomainCountMismatchCount, 0, `${testCase.id}: affected-domain count`)
    assert.equal(result.validation.semanticDecisionRepetitionCount, 0, `${testCase.id}: semantic decision repetition`)
    assert.equal(result.validation.profileLanguageContradictionCount, 0, `${testCase.id}: profile language contradiction`)
    assert.equal(result.validation.closePriorityOverstatementCount, 0, `${testCase.id}: close-priority overstatement`)
    assert.equal(result.validation.boldDecisionContentPass, true, `${testCase.id}: bold decision content`)
    assert.ok(result.literature.referenceCount >= 5 && result.literature.referenceCount <= 10, `${testCase.id}: literature density`)
    assert.equal(result.literature.domainSpecific, true, `${testCase.id}: domain-specific literature`)
    results.push(result)
  }
  const averageWordCount = results.reduce((sum, result) => sum + result.validation.wordCount, 0) / results.length
  assert.ok(averageWordCount >= 1000, `average repetition-aware substantive report depth: ${averageWordCount}`)
  assert.equal(legacyMismatchCount, 4, "known before-state classification mismatch count")

  const case1 = results.find((result) => result.input.clientCode === "ADV-BE-01")!
  assert.equal(case1.externalEvidence.find((entry) => entry.id === "spm2")?.validity_status, "partially_interpretable")
  assert.equal(case1.confidence.category, "Orta")

  const case3 = results.find((result) => result.input.clientCode === "ADV-BE-03")!
  assert.equal(case3.therapistObservation.present, true)
  assert.equal(case3.rawExternalTests.some((entry) => entry.test_name === "WPPSI-IV"), true)
  assert.equal(case3.externalEvidence.some((entry) => entry.test_name === "WPPSI-IV" && entry.evidence_direction === "supports_preserved_function" && entry.decision_relevant), true)
  assert.equal(case3.externalEvidence.find((entry) => entry.id === "brief_p")?.validity_status, "partially_interpretable")

  const case4 = results.find((result) => result.input.clientCode === "ADV-BE-04")!
  assert.equal(case4.therapistObservation.present, true)
  assert.equal(case4.therapistObservation.shortObservation, true)

  const case6 = results.find((result) => result.input.clientCode === "ADV-BE-06")!
  assert.equal(case6.priorityProfile.profile_breadth, "broad_multidomain")
  assert.equal(case6.priorityProfile.primary_priority, "executive")
  assert.doesNotMatch(case6.lockedLanguagePlan.sections.find((section) => section.id === "summary")!.paragraphs.map((entry) => entry.text).join(" "), /profil[^.]{0,80}seçici güçlük olarak/iu)

  const case8 = results.find((result) => result.input.clientCode === "ADV-BE-08")!
  const spm2 = case8.externalEvidence.find((entry) => entry.id === "spm2")
  const vineland = case8.externalEvidence.find((entry) => entry.id === "vineland3")
  const brief = case8.externalEvidence.find((entry) => entry.id === "brief_p")
  assert.ok(spm2?.decision_relevant && spm2.evidence_direction === "supports_difficulty", "ADV-BE-08 SPM-2 difficulty support")
  assert.ok(vineland?.decision_relevant && vineland.evidence_direction === "supports_preserved_function", "ADV-BE-08 Vineland-3 preserved support")
  assert.ok(brief && !brief.decision_relevant && brief.validity_status === "invalid", "ADV-BE-08 invalid BRIEF-P excluded")
  assert.match(case8.finalReport, /Sensory Processing Measure, Second Edition \(SPM-2\).+güçlük yönündeki bulguyu desteklemektedir/iu)
  assert.match(case8.finalReport, /Vineland-3.+korunmuş kapasite bulunduğunu göstermektedir/iu)

  const humanSurfaceAnswers = answersForJuryTotals([40, 21, 40, 36, 24, 40])
  const humanSurfaceScores = calculateAssessment(humanSurfaceAnswers)
  const humanSurface = await buildJuryReadyReport({
    clientCode: "HUMAN-SURFACE-MULTIFACTOR",
    ageMonths: 64,
    anamnez: "Başvuru sebebi: Kantin sırasında ses, tepsi kullanımı ve para üstünü izleme aynı anda devreye girdiğinde sıradan çıkıp alışverişi bitiremiyor. Aile bunun duyusal yük mü yoksa planlama güçlüğü mü olduğundan emin değil.\nTerapist yorumları: Kulaklık kullanılmadan, daha sakin bir köşede yazılı üç adımla alışveriş oyununu tamamladı.\nEk klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: işitsel belirgin güçlük | Klinik yorum: gürültüde katılım etkilenir. Test 2: Test adı: Vineland-3 | Puan / sonuç: günlük yaşam becerileri yaşa uygun | Klinik yorum: temel alışveriş ve özbakım becerileri korunmuş. Test 3: Test adı: BRIEF-P | Puan / sonuç: form geçersiz, çok eksik | Klinik yorum: yorumlanamaz.",
    answers: humanSurfaceAnswers,
    scores: { fizyolojik: humanSurfaceScores.fizyolojik, duyusal: humanSurfaceScores.duyusal, duygusal: humanSurfaceScores.duygusal, bilissel: humanSurfaceScores.bilissel, yurutucu: humanSurfaceScores.yurutucu, intero: humanSurfaceScores.intero, toplam: humanSurfaceScores.toplam },
  })
  assert.equal(humanSurface.priorityProfile.primary_priority, "sensory")
  assert.deepEqual(humanSurface.priorityProfile.secondary_priorities, ["cognitive", "executive"])
  assert.match(humanSurface.finalReport, /Bulgular en çok duyusal regülasyon alanındaki güçlüğü desteklemektedir/iu)
  assert.match(humanSurface.finalReport, /çevresel düzenleme ile görev yapılandırması aynı anda uygulanmıştır/iu)
  assert.match(humanSurface.finalReport, /günlük yaşam güçlüğü yalnız duyusal regülasyon ile açıklanmamalıdır/iu)
  assert.doesNotMatch(humanSurface.finalReport, /Birincil öncelik klinik ağırlık sırasını gösterir/iu)
  assert.doesNotMatch(humanSurface.finalReport, /bu bilgi desteklemediği bir klinik alana bağlanmamıştır/iu)
  assert.doesNotMatch(humanSurface.finalReport, /yorumun günlük yaşamdaki kapsamını daraltmaktadır/iu)
  assert.doesNotMatch(humanSurface.finalReport, /Karşılaştırılabilir vaka bilgileri aynı yöndeki klinik bulguyu desteklemektedir/iu)
  assert.equal(humanSurface.validation.materialRepetitionFailureCount, 0)
  assert.equal(humanSurface.validation.pass, true, humanSurface.validation.failureCodes.join(","))

  const sparse = results.find((result) => result.input.clientCode === "ADV-BE-09")!
  assert.equal(sparse.dataQuality.status, "insufficient")
  assert.equal(sparse.validation.sparseFunctionalOverreachCount, 0)
  assert.deepEqual(sparse.caseScopedEvidenceEnvelope.functional_evidence_profile, {
    has_concrete_daily_life_example: false,
    has_context_specific_performance_example: false,
    has_task_specific_performance_example: false,
    has_caregiver_functional_report: false,
    has_caregiver_functional_example: false,
    has_caregiver_context_example: false,
    has_caregiver_preserved_capacity_example: false,
    has_caregiver_task_example: false,
    has_caregiver_difficulty_example: false,
    has_caregiver_directional_complaint: false,
    has_caregiver_functional_evidence: false,
    has_therapist_observation: false,
    has_preserved_capacity_in_action: false,
    has_performance_variability_evidence: false,
  })
  assert.equal(sparse.templateSemanticLeakage.finding_count, 0)
  assert.match(sparse.finalReport, /gözlenmiş bir işlev kaybı olarak yorumlamamaktadır/iu)
  assert.doesNotMatch(sparse.finalReport, /günlük yaşamda görülen performans|günlük performanstaki değişkenlik|performansın hangi koşullarda bozulduğu|günlük görevlerde ortaya çıkan|bakım verenin bildirdiği işlevsel güçlük/iu)

  const contextOnlyAnswers = answersForJuryTotals([48, 11, 48, 48, 48, 12])
  const contextOnlyScores = calculateAssessment(contextOnlyAnswers)
  const contextOnly = await buildJuryReadyReport({
    clientCode: "CONTEXT-ONLY-FUNCTIONAL",
    ageMonths: 66,
    anamnez: "Bakım veren etiketli kıyafetleri giyemediğini ve diş fırçalarken banyodan kaçtığını bildiriyor. Okulda kalabalık sırada kulaklarını kapatıyor; sessiz sınıfta resim etkinliğini bitirebiliyor. Terapist gözleminde beklenmedik dokunmada geri çekilme görüldü.",
    answers: contextOnlyAnswers,
    scores: { fizyolojik: contextOnlyScores.fizyolojik, duyusal: contextOnlyScores.duyusal, duygusal: contextOnlyScores.duygusal, bilissel: contextOnlyScores.bilissel, yurutucu: contextOnlyScores.yurutucu, intero: contextOnlyScores.intero, toplam: contextOnlyScores.toplam },
  })
  assert.equal(contextOnly.caseScopedEvidenceEnvelope.functional_evidence_profile.has_concrete_daily_life_example, true)
  assert.equal(contextOnly.caseScopedEvidenceEnvelope.functional_evidence_profile.has_task_specific_performance_example, false)
  assert.equal(new TemplateSemanticLeakageValidator().validate(contextOnly.lockedLanguagePlan, "Günlük performansta görülen güçlük, belgelenen okul ve banyo örnekleriyle sınırlı yorumlanmaktadır.").pass, true)
  assert.equal(new TemplateSemanticLeakageValidator().validate(sparse.lockedLanguagePlan, "Günlük performansta görülen güçlük belirgindir.").findings.some((finding) => finding.code === "FUNCTIONAL_PATTERN_WITHOUT_FUNCTIONAL_EVIDENCE"), true)

  const confidenceCategories = new Set(results.map((result) => result.confidence.category))
  assert.ok(confidenceCategories.size >= 3, `confidence differentiation: ${[...confidenceCategories].join(",")}`)

  const functionalChecks: Array<[string, RegExp]> = [
    ["ADV-BE-01", /uyaranları filtrelemek|duyusal/iu],
    ["ADV-BE-02", /duygusal yoğunluk|yeniden etkinliğe dönmek/iu],
    ["ADV-BE-03", /çalışma belleği|başlatma, sıralama/iu],
    ["ADV-BE-04", /açlık, susuzluk, tuvalet/iu],
    ["ADV-BE-07", /uyku-uyanıklık|yorgunluk, enerji/iu],
  ]
  for (const [id, pattern] of functionalChecks) assert.match(results.find((result) => result.input.clientCode === id)!.finalReport, pattern, `${id}: domain-specific functional wording`)

  const externalVariants = [
    "Ek klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: işitsel belirgin güçlük | Klinik yorum: gürültüde katılım etkilenir. Test 2: Test adı: Sensory Profile 2 | Puan / sonuç: işitsel alan beklenenden çok | Klinik yorum: duyusal yükte güçlük.",
    "Ek klinik test / bulgular: Test 1: Test adı: BRIEF-P | Puan / sonuç: form geçersiz, eksik | Klinik yorum: yorumlanamaz.",
    "Dış test yok. Günlük örnek sınırlı.",
    "Ek klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: | Klinik yorum: bilgi yok.",
  ]
  for (const [index, anamnez] of externalVariants.entries()) {
    const base = JURY_CHALLENGE_CASES[0]
    const answers = answersForJuryTotals(base.totals)
    const calculated = calculateAssessment(answers)
    const result = await buildJuryReadyReport({ clientCode: `EXT-${index + 1}`, ageMonths: 60, anamnez, answers, scores: { fizyolojik: calculated.fizyolojik, duyusal: calculated.duyusal, duygusal: calculated.duygusal, bilissel: calculated.bilissel, yurutucu: calculated.yurutucu, intero: calculated.intero, toplam: calculated.toplam } })
    assert.equal(result.validation.invalidExternalEvidenceUsedIds.length, 0)
    assert.equal(result.validation.missingValidExternalEvidenceIds.length, 0)
  }

  const invalidBoundaryAnswers = answersForJuryTotals([44, 24, 41, 42, 43, 44])
  const invalidBoundaryScores = calculateAssessment(invalidBoundaryAnswers)
  const invalidBoundary = await buildJuryReadyReport({
    clientCode: "INVALID-EXTERNAL-BOUNDARY",
    ageMonths: 69,
    anamnez: "Başvuru sebebi: Bakım veren oyun alanında çocuklar bağırdığında ortamdan uzaklaşıyor. Ek klinik test / bulgular: Test 1: Test adı: SPM-2 | Puan / sonuç: yalnız boş kapak sayfası var | Klinik yorum: sonuç bilgisi yetersiz. Test 2: Test adı: bilinmeyen test | Puan / sonuç: yüksek gibi | Klinik yorum: form adı ve normu okunmuyor.",
    answers: invalidBoundaryAnswers,
    scores: { fizyolojik: invalidBoundaryScores.fizyolojik, duyusal: invalidBoundaryScores.duyusal, duygusal: invalidBoundaryScores.duygusal, bilissel: invalidBoundaryScores.bilissel, yurutucu: invalidBoundaryScores.yurutucu, intero: invalidBoundaryScores.intero, toplam: invalidBoundaryScores.toplam },
  })
  assert.equal(invalidBoundary.externalEvidence.filter((entry) => entry.decision_relevant).length, 0)
  assert.equal(invalidBoundary.validation.invalidExternalEvidenceUsedIds.length, 0)
  assert.match(invalidBoundary.finalReport, /Sensory Processing Measure, Second Edition \(SPM-2\).+klinik kararda kullanılmamıştır/iu)
  assert.match(invalidBoundary.finalReport, /Bilinmeyen test.+klinik kararda kullanılmamıştır/iu)

  const typoAnswers = answersForJuryTotals([42, 18, 43, 44, 27, 45])
  const typoScores = calculateAssessment(typoAnswers)
  const typoSurface = await buildJuryReadyReport({
    clientCode: "TYPO-SOURCE-SEPARATION",
    ageMonths: 54,
    anamnez: "basvuru sebebı islak boya eline degdiginde uyaran sona erene kadar goreve donemiyor bazen de hic olmuyo??? terapist yorumu yazili uc adim verildiginde isi bitirebiliyor ama oda sessizdi dis test yok",
    answers: typoAnswers,
    scores: { fizyolojik: typoScores.fizyolojik, duyusal: typoScores.duyusal, duygusal: typoScores.duygusal, bilissel: typoScores.bilissel, yurutucu: typoScores.yurutucu, intero: typoScores.intero, toplam: typoScores.toplam },
  })
  assert.equal(typoSurface.therapistObservation.present, true)
  assert.equal(typoSurface.caseScopedEvidenceEnvelope.anamnesis_evidence.some((fact) => /[ıI]slak boya/iu.test(fact.statement)), true)
  assert.equal(typoSurface.caseScopedEvidenceEnvelope.anamnesis_evidence.some((fact) => /^başvuru sebeb/iu.test(fact.statement)), false)
  assert.doesNotMatch(typoSurface.finalReport, /(?:olmuyo|bilmio|yapcag|\?{2,})/iu)
  assert.doesNotMatch(typoSurface.finalReport, /diğer iki alan/iu)
  assert.equal(typoSurface.validation.pass, true, typoSurface.validation.failureCodes.join(","))

  const broadSparseAnswers = answersForJuryTotals([23, 24, 25, 26, 27, 28])
  const broadSparseScores = calculateAssessment(broadSparseAnswers)
  const broadSparse = await buildJuryReadyReport({
    clientCode: "BROAD-SPARSE-NO-FALSE-PRESERVATION",
    ageMonths: 45,
    anamnez: "Başvuru sebebi: bilgi yok. Terapist yorumları: gözlem yapılmadı. Dış test yok.",
    answers: broadSparseAnswers,
    scores: { fizyolojik: broadSparseScores.fizyolojik, duyusal: broadSparseScores.duyusal, duygusal: broadSparseScores.duygusal, bilissel: broadSparseScores.bilissel, yurutucu: broadSparseScores.yurutucu, intero: broadSparseScores.intero, toplam: broadSparseScores.toplam },
  })
  assert.equal(broadSparse.priorityProfile.profile_breadth, "broad_multidomain")
  assert.doesNotMatch(broadSparse.finalReport, /diğer beş alan(?:ın)? (?:yaş grubuna göre )?beklenen/iu)
  assert.doesNotMatch(broadSparse.finalReport, /(?:seçici ayrışma|birincil öncelik|görece en belirgin)/iu)
  const boldDecisions = broadSparse.lockedLanguagePlan.sections.flatMap((section) => section.paragraphs).filter((paragraph) => paragraph.emphasis === "full_bold")
  assert.equal(boldDecisions.length, 3)
  assert.equal(boldDecisions.every((paragraph) => paragraph.sentenceProvenance.length >= 1 && paragraph.sentenceProvenance.length <= 2), true)
  assert.equal(broadSparse.validation.pass, true, broadSparse.validation.failureCodes.join(","))

  const mixedExternalAnswers = answersForJuryTotals([41, 42, 41, 19, 41, 40])
  const mixedExternalScores = calculateAssessment(mixedExternalAnswers)
  const mixedExternal = await buildJuryReadyReport({
    clientCode: "MIXED-EXTERNAL-PROVENANCE",
    ageMonths: 57,
    anamnez: "Başvuru sebebi: Sınıf rehberi bilişsel regülasyon alanında okulda hikâyedeki üç olayı sıralarken ortadaki olayı atlıyor; aile bilişsel regülasyon alanında evde iki bilgi görsel kartla sunulduğunda doğru eşliyor. Terapist yorumları: Seans kaydında kısa yönerge ve görsel işaret birlikte sunulduğunda doğru eşliyor. Ek klinik test / bulgular: Test 1: Test adı: Sensory Processing Measure Preschool | Puan / sonuç: beklenen sınırlar | Klinik yorum: yapılandırılmış kısa oturumda yaş düzeyine uygun sonuç.",
    answers: mixedExternalAnswers,
    scores: { fizyolojik: mixedExternalScores.fizyolojik, duyusal: mixedExternalScores.duyusal, duygusal: mixedExternalScores.duygusal, bilissel: mixedExternalScores.bilissel, yurutucu: mixedExternalScores.yurutucu, intero: mixedExternalScores.intero, toplam: mixedExternalScores.toplam },
  })
  assert.equal(mixedExternal.validation.wrongSourceAttributionCount, 0)
  assert.equal(mixedExternal.validation.unsupportedVisibleCaseClaimCount, 0)
  assert.equal(mixedExternal.validation.pass, true, mixedExternal.validation.failureCodes.join(","))
  assert.match(mixedExternal.finalReport, /Sensory Processing Measure, Second Edition \(SPM-2\): yorumlanabilir\. Bildirilen sonuç: beklenen sınırlar\./iu)
  const mixedExternalContradiction = mixedExternal.lockedLanguagePlan.sections.flatMap((section) => section.paragraphs).find((paragraph) => paragraph.id === "decision.contradiction")
  assert.ok(mixedExternalContradiction?.sentenceProvenance.some((sentence) => sentence.supporting_case_fact_ids.some((id) => id.includes("fact.external"))))

  const breadthCases: Array<[string, readonly [number, number, number, number, number, number], JuryReportResult["priorityProfile"]["profile_breadth"]]> = [
    ["BREADTH-ONE", [40, 17, 40, 40, 40, 40], "selective_single_domain"],
    ["BREADTH-ONE-RISK", [40, 17, 40, 36, 40, 40], "focused_multidomain"],
    ["BREADTH-TWO-ATYPICAL", [40, 17, 40, 40, 20, 40], "focused_multidomain"],
    ["BREADTH-WIDESPREAD-RISK", [25, 24, 27, 26, 28, 29], "broad_multidomain"],
    ["BREADTH-WIDESPREAD-SEVERE", [25, 24, 27, 26, 23, 28], "broad_multidomain"],
    ["BREADTH-PRESERVED", [44, 44, 44, 44, 44, 44], "preserved"],
  ]
  for (const [id, totals, expected] of breadthCases) {
    const result = await runTotals(id, totals)
    assert.equal(result.priorityProfile.profile_breadth, expected, id)
  }

  console.log(JSON.stringify({
    cases: results.length,
    legacyClassificationConsistency: `${results.length - legacyMismatchCount}/${results.length}`,
    candidateClassificationConsistency: `${results.filter((result) => result.validation.classificationConsistent).length}/${results.length}`,
    confidenceDistribution: Object.fromEntries([...confidenceCategories].map((category) => [category, results.filter((result) => result.confidence.category === category).length])),
    averageWordCount,
    pass: true,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
