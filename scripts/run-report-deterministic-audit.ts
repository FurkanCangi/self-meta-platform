import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { listFixturePaths, runSingleFixture, type FixturePayload } from "./run-dna-report";
import { extractExternalClinicalFindings, getAnamnezThemeSignals, type AnamnezRecord } from "../src/lib/dna/anamnezUtils";
import { analyzeExternalClinicalTests, SUPPORTED_EXTERNAL_TESTS } from "../src/lib/dna/externalTestRegistry";
import { CLINICAL_KNOWLEDGE_CHUNKS, WORD_RAG_SOURCE } from "../src/lib/dna/clinicalKnowledgeBase";
import { splitClinicalReportSections } from "../src/lib/dna/reportText";

const OUTPUT_DIR = "/tmp/dna-report-output/deterministic-audit";

type AuditIssueCode =
  | "profile_generic_name"
  | "profile_category_mismatch"
  | "motor_praxis_underweighted"
  | "adaptive_daily_living_underweighted"
  | "language_communication_underweighted"
  | "social_pragmatic_underweighted"
  | "adaptive_mechanism_weak"
  | "language_mechanism_weak"
  | "social_mechanism_weak"
  | "physiological_mechanism_weak"
  | "evidence_limited_mixed_missing"
  | "preserved_or_raw_external_overweighted"
  | "anamnez_fit_specificity_missing"
  | "mechanism_lowest_score_leak"
  | "external_test_profile_missing"
  | "external_test_quality_boundary_missing"
  | "deterministic_kb_metric_missing"
  | "age_mismatch_warning_weak"
  | "sensory_theme_leakage"
  | "attention_theme_leakage"
  | "intero_overweighted"
  | "trace_coverage_missing"
  | "external_registry_metadata_missing"
  | "micro_evidence_leak"
  | "reasoning_trace_missing"
  | "sentence_trace_missing"
  | "unsupported_specificity"
  | "decision_trace_hash_missing"
  | "trace_quality_metrics_missing"
  | "sentence_evidence_resolution_weak"
  | "redundancy_score_high"
  | "external_weight_missing"
  | "claim_guard_violation"
  | "narrative_guard_violation";

type FixtureAudit = {
  fixture: string;
  clientCode: string;
  ageMonths: number;
  profileType: string;
  globalLevel: string;
  issueCodes: AuditIssueCode[];
  compatibleCategories: string[];
  incompatibleCount: number;
};

const ISSUE_LABELS: Record<AuditIssueCode, string> = {
  profile_generic_name: "Profil adı fazla jenerik",
  profile_category_mismatch: "Profil adı test/anamnez kategorisiyle tam hizalı değil",
  motor_praxis_underweighted: "Motor-praksi hattı metinde yeterince baskın değil",
  adaptive_daily_living_underweighted: "Uyumsal/günlük yaşam hattı yeterince baskın değil",
  language_communication_underweighted: "Dilsel yük hattı metinde zayıf kalıyor",
  social_pragmatic_underweighted: "Sosyal-pragmatik hat metinde zayıf kalıyor",
  adaptive_mechanism_weak: "Günlük yaşam/öz bakım mekanizması yeterince açık değil",
  language_mechanism_weak: "Dilsel mekanizma yeterince açık değil",
  social_mechanism_weak: "Sosyal-pragmatik mekanizma yeterince açık değil",
  physiological_mechanism_weak: "Beden-temelli toparlanma mekanizması yeterince açık değil",
  evidence_limited_mixed_missing: "Karma/sınırlı kanıtta kanıt-sınırlı mekanizma görünmüyor",
  preserved_or_raw_external_overweighted: "Ham/preserved dış test karar ağırlığını gereğinden fazla büyütüyor",
  anamnez_fit_specificity_missing: "Anamnez uyumu bakımveren/terapist/test üçgenini vaka özgü göstermiyor",
  mechanism_lowest_score_leak: "Ana klinik bölümlerde lowest-score mekanizması sızıyor",
  external_test_profile_missing: "Ek test kanıt profili raporda görünmüyor",
  external_test_quality_boundary_missing: "Ek test yorum sınırı/kalite uyarısı zayıf",
  deterministic_kb_metric_missing: "Runtime RAG / deterministic KB metrik ayrımı görünmüyor",
  age_mismatch_warning_weak: "Yaş uyumsuz dış test uyarısı zayıf",
  sensory_theme_leakage: "Duyusal tema sızıntısı var",
  attention_theme_leakage: "Dikkat/görev sürdürme tema sızıntısı var",
  intero_overweighted: "İnterosepsiyon gereğinden fazla ağırlık alıyor",
  trace_coverage_missing: "Trace coverage eksik",
  external_registry_metadata_missing: "Ek test registry metadata eksik",
  micro_evidence_leak: "Mikro-kanıt soru/madde/item dili sızdırıyor",
  reasoning_trace_missing: "Reasoning trace skor kırılımı eksik",
  sentence_trace_missing: "Ana klinik cümle sentence trace coverage eksik",
  unsupported_specificity: "Bağlam/mekanizma özgüllüğü yeterli kanıtla desteklenmiyor",
  decision_trace_hash_missing: "Decision trace hash eksik",
  trace_quality_metrics_missing: "Trace kalite metrikleri eksik",
  sentence_evidence_resolution_weak: "Sentence trace gerçek evidence atomlarına yeterince ayrışmıyor",
  redundancy_score_high: "Bölümler arası iddia tekrar skoru yüksek",
  external_weight_missing: "Ek test ağırlık skoru eksik",
  claim_guard_violation: "Claim/intended-use guard ihlali var",
  narrative_guard_violation: "Narrative guard ihlali var",
};

function normalizeText(value: string): string {
  return String(value || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function profileMentionsCategory(profileText: string, category: string): boolean {
  if (category === "adaptive_daily_living") {
    return hasAny(profileText, [/günlük yaşam/, /gunluk yasam/, /öz bakım/, /oz bakim/, /uyum/, /uyumsal/]);
  }
  if (category === "executive_behavior") {
    return hasAny(profileText, [/yürütücü/, /yurutucu/, /görev/, /gorev/, /davranış organizasyonu/, /davranis organizasyonu/]);
  }
  if (category === "language_communication") {
    return hasAny(profileText, [/dilsel/, /dil/, /sözel/, /sozel/, /yönerge/, /yonerge/]);
  }
  if (category === "social_pragmatic") {
    return hasAny(profileText, [/sosyal/, /pragmatik/, /karşılıklılık/, /karsiliklilik/]);
  }
  if (category === "motor_praxis") {
    return hasAny(profileText, [/praksi/, /motor/, /beden organiz/, /sekans/]);
  }
  if (category === "sensory_processing") {
    return hasAny(profileText, [/duyusal/, /dokunsal/, /sensory/]);
  }
  if (category === "development_general") {
    return hasAny(profileText, [/gelişimsel/, /gelisimsel/, /korunmuş/, /korunmus/, /dengeli/]);
  }
  return false;
}

function getSectionBodies(text: string) {
  const sections = new Map(splitClinicalReportSections(text).map((section) => [section.heading, section.body]));
  const getFirst = (headings: string[]) => {
    for (const heading of headings) {
      const body = sections.get(heading);
      if (body) return String(body);
    }
    return "";
  };
  return {
    domains: getFirst(["3. Alan Bazlı Klinik Yorum"]),
    pattern: getFirst(["4. Klinik Örüntü ve Formülasyon", "4. Örüntü Analizi"]),
    fit: getFirst([
      "5. Anamnez, Gözlem ve Test Uyumunun Değerlendirilmesi",
      "5. Anamnez – Test Uyum Değerlendirmesi",
    ]),
    conclusion: getFirst(["7. Klinik Sonuç", "6. Kısa Sonuç"]),
    literature: getFirst(["8. Literatürle Uyumlu Klinik Dayanak"]),
  };
}

async function loadFixture(fixturePath: string): Promise<FixturePayload> {
  const raw = await fs.readFile(fixturePath, "utf8");
  return JSON.parse(raw) as FixturePayload;
}

function toAnamnezRecord(anamnez: FixturePayload["anamnez"]): AnamnezRecord {
  if (!anamnez) return {};
  if (typeof anamnez === "string") return { raw_summary: anamnez };
  return anamnez;
}

function getIssueCodes(params: {
  profileType: string;
  finalText: string;
  metricsText: string;
  anamnezRecord: AnamnezRecord;
  ageMonths: number;
  narrativeGuardCount: number;
}) {
  const issueCodes: AuditIssueCode[] = [];
  const normalizedProfile = normalizeText(params.profileType);
  const normalizedReport = normalizeText(params.finalText);
  const sectionBodies = getSectionBodies(params.finalText);
  const decisionSummaryBody = splitClinicalReportSections(params.finalText).find((section) => section.heading.startsWith("1."))?.body || "";
  const prioritizationBody = splitClinicalReportSections(params.finalText).find((section) => section.heading.startsWith("6."))?.body || "";
  const coreText = normalizeText(
    [sectionBodies.domains, sectionBodies.pattern, sectionBodies.fit, sectionBodies.conclusion].join("\n")
  );
  const mechanismText = normalizeText(
    splitClinicalReportSections(params.finalText)
      .filter((section) => ["1.", "4.", "6."].some((prefix) => section.heading.startsWith(prefix)))
      .map((section) => `${section.heading}\n${section.body}`)
      .join("\n")
  );
  const formulationAnchors = normalizeText(
    [sectionBodies.pattern, prioritizationBody]
      .map((body) => {
        const match = body.match(/Klinik formülasyon:\s*[^.\n!?]+[.!?]?/i);
        return match?.[0] || "";
      })
      .join("\n")
  );
  const decisionAnchor = normalizeText(
    decisionSummaryBody
      .split(/\n+/)
      .slice(0, 4)
      .join(" ")
  );
  const interoFocusText = normalizeText([sectionBodies.pattern, sectionBodies.fit, sectionBodies.conclusion].join("\n"));
  const anamnezSignals = getAnamnezThemeSignals(params.anamnezRecord);
  const rawExternalText =
    typeof params.anamnezRecord.external_clinical_findings === "string"
      ? params.anamnezRecord.external_clinical_findings
      : extractExternalClinicalFindings(params.anamnezRecord).join("\n");
  const externalAnalysis = analyzeExternalClinicalTests(rawExternalText, params.ageMonths);
  const compatibleCategories = new Set(externalAnalysis.compatibleCategories);
  const decisionCategories = new Set(externalAnalysis.decisionCompatibleCategories);
  const primaryCategory = externalAnalysis.primaryCompatibleCategory;
  const hasLimitedExternalEvidence = externalAnalysis.matches.some(
    (match) =>
      match.ageCompatible === false ||
      match.resultQuality === "ham_puan_only" ||
      match.resultQuality === "missing_result" ||
      match.resultQuality === "qualitative_only"
  );
  const hasPreservedExternalEvidence = externalAnalysis.matches.some(
    (match) => match.ageCompatible === true && match.resultDirection === "expected_or_preserved"
  );
  const hasMixedLimitedEvidence =
    externalAnalysis.mixedValidity ||
    (hasLimitedExternalEvidence && hasPreservedExternalEvidence) ||
    (hasLimitedExternalEvidence && externalAnalysis.decisionCompatible.length > 0);
  const profileIsBalanced = /dengeli \/ korunmuş profil|dengeli \/ korunmus profil/.test(normalizedProfile);
  const profileIsSelective = /seçici|secici/.test(normalizedProfile);

  if (
    normalizedProfile === normalizeText("Ayrışan Regülasyon Profili") ||
    /ağırlıklı profil$/.test(normalizedProfile)
  ) {
    issueCodes.push("profile_generic_name");
  }

  if (primaryCategory && !profileIsBalanced) {
    const primaryAligned = profileMentionsCategory(normalizedProfile, primaryCategory);
    const contextualOverride =
      (primaryCategory === "adaptive_daily_living" &&
        hasAny(normalizedProfile, [/interosepsiyon/, /fizyolojik/, /yürütücü-beden temelli/, /yurutucu-beden temelli/])) ||
      primaryCategory === "development_general" ||
      (primaryCategory === "executive_behavior" &&
        ((profileIsSelective &&
          hasAny(normalizedProfile, [/duygusal regülasyon/, /interosepsiyon/, /yürütücü/, /yurutucu/])) ||
          hasAny(normalizedProfile, [/geçiş/, /gecis/, /ko-regülasyon/, /ko-regulasyon/, /ko-reg/])) ) ||
      (primaryCategory === "sensory_processing" &&
        decisionCategories.has("adaptive_daily_living") &&
        hasAny(normalizedProfile, [/interosepsiyon/, /fizyolojik/, /beden temelli/])) ||
      (primaryCategory === "language_communication" &&
        decisionCategories.has("social_pragmatic") &&
        profileMentionsCategory(normalizedProfile, "social_pragmatic")) ||
      (primaryCategory === "social_pragmatic" &&
        decisionCategories.has("language_communication") &&
        profileMentionsCategory(normalizedProfile, "language_communication")) ||
      (hasMixedLimitedEvidence && hasAny(normalizedProfile, [/kanıt-sınırlı/, /kanit-sinirli/, /karma/]));

    if (!primaryAligned && !contextualOverride) {
      issueCodes.push("profile_category_mismatch");
    }
  }

  if (decisionCategories.has("motor_praxis")) {
    if (!hasAny(coreText, [/praksi/, /motor plan/, /beden organiz/, /sekans/, /giyin/, /iki taraflı/, /koordinasyon/])) {
      issueCodes.push("motor_praxis_underweighted");
    }
  }

  const profileIsAdaptive = /günlük yaşam|gunluk yasam|öz bakım|oz bakim/.test(normalizedProfile);
  const profileIsLanguage = /dilsel|sözel|sozel/.test(normalizedProfile);
  const profileIsSocial = /sosyal-pragmatik|pragmatik|karşılıklılık|karsiliklilik/.test(normalizedProfile);
  const profileIsPhysioIntero = /fizyolojik toparlanma|beden temelli|interosepsiyon/.test(normalizedProfile);

  if (decisionCategories.has("adaptive_daily_living")) {
    if (!hasAny(coreText, [/öz bakım/, /günlük yaşam/, /rutin/, /tuvalet/, /giyin/, /katılım/, /başlatma/, /tamamlama/])) {
      issueCodes.push("adaptive_daily_living_underweighted");
    }
    if (profileIsAdaptive && !hasAny(mechanismText, [/öz bakım ve günlük yaşam akışını başlatma/, /öz bakım ve günlük yaşam akışı/, /günlük yaşam ve öz bakım akışını sürdürme yükü/])) {
      issueCodes.push("adaptive_mechanism_weak");
    }
  }

  if (decisionCategories.has("language_communication")) {
    if (!hasAny(coreText, [/dil/, /yönerge/, /sözel/, /anlama/, /ifade/])) {
      issueCodes.push("language_communication_underweighted");
    }
    if (profileIsLanguage && !hasAny(mechanismText, [/sözel talep ve yönerge karmaşıklığı/, /dilsel yük ile sosyal-pragmatik talep/, /dilsel talep ve sözel işleme yükü/])) {
      issueCodes.push("language_mechanism_weak");
    }
  }

  if (decisionCategories.has("social_pragmatic")) {
    if (!hasAny(coreText, [/sosyal/, /pragmatik/, /karşılıklılık/, /etkileşim/, /akran/])) {
      issueCodes.push("social_pragmatic_underweighted");
    }
    if (profileIsSocial && !hasAny(mechanismText, [/sosyal karşılıklılık/, /pragmatik esneklik/, /sosyal-pragmatik talep/])) {
      issueCodes.push("social_mechanism_weak");
    }
  }

  if (
    profileIsPhysioIntero &&
    !hasAny(mechanismText, [
      /beden-temelli toparlanma/,
      /interoseptif düzenleme/,
      /içsel sinyalleri düzenlemeye katma/,
      /içsel bedensel sinyalleri/,
      /seçici bir interoseptif kırılganlık/,
    ])
  ) {
    issueCodes.push("physiological_mechanism_weak");
  }

  if (externalAnalysis.incompatible.length > 0) {
    if (!/ana klinik karar mekanizmasına dahil edilmemeli/i.test(sectionBodies.fit)) {
      issueCodes.push("age_mismatch_warning_weak");
    }
  }

  if (
    externalAnalysis.matches.length > 0 &&
    (!/(Ek Test Kanıt Profili|Ek test bulguları):/i.test(sectionBodies.fit) ||
      !/yaş\/kapsam:|resmi kullanım aralığı/i.test(sectionBodies.fit) ||
      !/Alan:/i.test(sectionBodies.fit) ||
      !/Puan:/i.test(sectionBodies.fit) ||
      !/Sonuç:/i.test(sectionBodies.fit) ||
      !/Sınır:|Yorum sınırı:|Yorumda /i.test(sectionBodies.fit))
  ) {
    issueCodes.push("external_test_profile_missing");
  }

  if (
    externalAnalysis.qualityFlagLines.length > 0 &&
    !/Yorum sınırı:|Yorumda |ham puan|yaş uyumsuz|yas uyumsuz|ana mekanizma veya karar ağırlığını artırmak için kullanılmadı|ana mekanizmayı veya ana klinik yorumu güçlendirmek için kullanılmadı/i.test(sectionBodies.fit)
  ) {
    issueCodes.push("external_test_quality_boundary_missing");
  }

  if (
    hasMixedLimitedEvidence &&
    !hasAny(normalizedReport, [/kanıt-sınırlı/, /kanıt sınırlı/, /kanıt kanalları tam yakınsama göstermedi/])
  ) {
    issueCodes.push("evidence_limited_mixed_missing");
  }

  if (
    hasMixedLimitedEvidence &&
    decisionCategories.size === 0 &&
    hasAny(decisionAnchor, [
      /beden-temelli toparlanma/,
      /günlük yaşam ve öz bakım/,
      /praksi ve motor planlama/,
      /motor planlama ve beden organizasyonu/,
      /dilsel talep/,
      /sosyal-pragmatik/,
    ])
  ) {
    issueCodes.push("preserved_or_raw_external_overweighted");
  }

  const hasCaregiverSource =
    typeof params.anamnezRecord.parent_concerns_goals === "string" ||
    typeof params.anamnezRecord.referral_reason === "string";
  const hasTherapistSource = typeof params.anamnezRecord.therapist_comments === "string";
  if (
    (hasCaregiverSource || hasTherapistSource || externalAnalysis.matches.length > 0) &&
    ((hasCaregiverSource && !/(?:Aile tarafından|aileden gelen bilgi)/i.test(sectionBodies.fit)) ||
      (hasTherapistSource && !/Terapist gözleminde/i.test(sectionBodies.fit)) ||
      (externalAnalysis.matches.length > 0 && !/(Ek Test Kanıt Profili|Ek test bulguları):/i.test(sectionBodies.fit)))
  ) {
    issueCodes.push("anamnez_fit_specificity_missing");
  }

  if (
    !/Runtime RAG:\s*%0/i.test(params.metricsText) ||
    !/Deterministic Knowledge Base:\s*Aktif/i.test(params.metricsText) ||
    !/Trace:\s*Aktif/i.test(params.metricsText) ||
    !/Selected atoms:\s*[1-9]\d*/i.test(params.metricsText)
  ) {
    issueCodes.push("deterministic_kb_metric_missing");
  }

  if (!anamnezSignals.sensory && hasAny(normalizedReport, [/duyusal yüklenme/, /çevresel ve dokunsal hassasiyet/])) {
    issueCodes.push("sensory_theme_leakage");
  }

  if (
    !anamnezSignals.cognitiveExecutive &&
    hasAny(normalizedReport, [/çok uyaranlı bağlamlarda dikkat ve görev sürdürme güçlüğü/, /dikkat ve görev sürdürme güçlüğü/])
  ) {
    issueCodes.push("attention_theme_leakage");
  }

  if (
    !anamnezSignals.bodyIntero &&
    !decisionCategories.has("adaptive_daily_living") &&
    hasAny(interoFocusText, [
      /interosepsiyon alanının atipik düzeyi/,
      /interosepsiyon alanı, .*bütünleştirici bir eksen/,
      /görece en çok zorlanan eksen .*interosepsiyon/,
      /acıktığını fark eder/,
      /susadığını fark eder/,
    ])
  ) {
    issueCodes.push("intero_overweighted");
  }

  if (params.narrativeGuardCount > 0) {
    issueCodes.push("narrative_guard_violation");
  }

  if (
    (profileIsAdaptive || profileIsLanguage || profileIsSocial || profileIsPhysioIntero) &&
    (hasAny(formulationAnchors, [/klinik formülasyon:\s*.*en düşük alan/i]) ||
      hasAny(decisionAnchor, [/en düşük alan/i]))
  ) {
    issueCodes.push("mechanism_lowest_score_leak");
  }

  return {
    issueCodes: Array.from(new Set(issueCodes)),
    compatibleCategories: Array.from(compatibleCategories),
    incompatibleCount: externalAnalysis.incompatible.length,
  };
}

function readWordRagChunkIds(): string[] {
  const script = `
import re, sys, zipfile
from xml.etree import ElementTree as ET
p = sys.argv[1]
z = zipfile.ZipFile(p)
xml = z.read('word/document.xml')
z.close()
root = ET.fromstring(xml)
ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
text = '\\n'.join(''.join(t.text or '' for t in para.findall('.//w:t', ns)) for para in root.findall('.//w:p', ns))
ids = re.findall(r'CHUNK_ID:\\s*([A-Z0-9_]+)', text)
print('\\n'.join(ids))
`.trim();
  const output = execFileSync("python3", ["-c", script, path.resolve(process.cwd(), WORD_RAG_SOURCE.primary)], {
    encoding: "utf8",
  });
  return output.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function assertKnowledgeBaseCoverage() {
  const ragIds = new Set(readWordRagChunkIds());
  const kbIds = new Set(CLINICAL_KNOWLEDGE_CHUNKS.map((chunk) => chunk.id));
  const missing = Array.from(ragIds).filter((id) => !kbIds.has(id)).sort();
  if (missing.length > 0 || ragIds.size !== WORD_RAG_SOURCE.sourceChunkCount) {
    throw new Error(
      `Word RAG coverage failed. expected=${WORD_RAG_SOURCE.sourceChunkCount} actual=${ragIds.size} missing=${missing.join(", ")}`
    );
  }
}

function assertExternalTestRegistryMetadata(): string[] {
  const missing: string[] = [];
  for (const test of SUPPORTED_EXTERNAL_TESTS) {
    if (!test.ageRange || !Number.isFinite(test.minAgeMonths) || !Number.isFinite(test.maxAgeMonths)) missing.push(`${test.id}: ageRange`);
    if (!test.scoreSystem || test.scoreSystem.length < 8) missing.push(`${test.id}: scoreSystem`);
    if (!test.resultLevels || test.resultLevels.length < 8) missing.push(`${test.id}: resultLevels`);
    if (!test.domainsMeasured?.length) missing.push(`${test.id}: domainsMeasured`);
    if (!test.interpretationBoundaries || test.interpretationBoundaries.length < 12) missing.push(`${test.id}: interpretationBoundaries`);
    if (!test.dnaRelation || test.dnaRelation.length < 8) missing.push(`${test.id}: dnaRelation`);
    if (!test.sourceLinks?.length || test.sourceLinks.some((link) => !/^https?:\/\//i.test(link))) missing.push(`${test.id}: sourceLinks`);
    if (/item|madde|norm tablosu|manual item|scoring table/i.test(`${test.reportUse} ${test.interpretationBoundaries}`)) {
      missing.push(`${test.id}: proprietary_content_boundary`);
    }
  }
  return missing;
}

function getTraceAuditIssues(result: Awaited<ReturnType<typeof runSingleFixture>>): AuditIssueCode[] {
  const issues: AuditIssueCode[] = [];
  const trace = result.trace;
  const mechanismRule = trace?.ruleHits?.find((rule) => rule.ruleType === "mechanism");
  if (!trace?.active || !mechanismRule || !result.auditTrail?.inputHash) {
    issues.push("trace_coverage_missing");
  }
  const invalidAtoms = trace?.selectedAtoms?.filter(
    (atom) =>
      !atom.id ||
      !atom.evidenceIds?.length ||
      !atom.ruleIds?.length ||
      !atom.confidence ||
      typeof atom.priority !== "number" ||
      !atom.sections?.length ||
      !atom.safetyTags?.length
  ) || [];
  if (invalidAtoms.length > 0 || (trace?.validationIssues || []).length > 0) {
    issues.push("trace_coverage_missing");
  }
  const reasoning = trace?.reasoning;
  const selectedMechanism = trace?.ruleHits?.find((rule) => rule.ruleType === "mechanism")?.id.replace(/^rule\.mechanism\./, "");
  const selectedBreakdown = reasoning?.mechanismScoreBreakdown?.find((item) => item.mechanism === selectedMechanism);
  if (
    !reasoning?.confidenceSubscores ||
    !reasoning?.mechanismScoreBreakdown?.length ||
    !selectedBreakdown ||
    !Number.isFinite(selectedBreakdown.finalMechanismScore)
  ) {
    issues.push("reasoning_trace_missing");
  }
  if (!result.auditTrail?.decisionTraceHash || result.auditTrail.decisionTraceHash.length < 12) {
    issues.push("decision_trace_hash_missing");
  }
  if (
    typeof result.auditTrail?.redundancyScore !== "number" ||
    typeof result.auditTrail?.unsupportedSpecificityRate !== "number" ||
    typeof trace?.qualityMetrics?.evidenceToSentenceCoverage !== "number"
  ) {
    issues.push("trace_quality_metrics_missing");
  }
  const sentenceTraces = trace?.sentenceTraces || [];
  const invalidSentenceTrace = sentenceTraces.some(
    (sentence) =>
      !sentence.sentenceId ||
      !sentence.textHash ||
      !sentence.evidenceAtomIds?.length ||
      !sentence.ruleIds?.length ||
      !sentence.confidence ||
      !sentence.safetyTags?.length
  );
  if (!sentenceTraces.length || invalidSentenceTrace) {
    issues.push("sentence_trace_missing");
  }
  const lowResolutionSentenceTrace = sentenceTraces.some(
    (sentence) =>
      sentence.claimType !== "descriptive" &&
      sentence.evidenceAtomIds.length === 1 &&
      sentence.evidenceAtomIds[0] === "evidence.mechanism.primary"
  );
  if (lowResolutionSentenceTrace) {
    issues.push("sentence_evidence_resolution_weak");
  }
  if ((trace?.qualityMetrics?.redundancyScore || 0) > 12 || (result.auditTrail?.redundancyScore || 0) > 12) {
    issues.push("redundancy_score_high");
  }
  if ((trace?.suppressedAtoms || []).some((atom) => atom.reason === "unsupported_specificity")) {
    issues.push("unsupported_specificity");
  }
  if ((trace?.qualityMetrics?.unsupportedSpecificityRate || 0) > 0 || (result.auditTrail?.unsupportedSpecificityRate || 0) > 0) {
    issues.push("unsupported_specificity");
  }
  const externalEvidenceSources = (trace?.evidenceSources || []).filter((source) => source.kind === "external_test");
  if (externalEvidenceSources.some((source) => !/kanıt ağırlığı:\s*\d+\/(?:none|limited|moderate|strong|balancing)/i.test(source.summary || ""))) {
    issues.push("external_weight_missing");
  }
  if ((trace?.claimGuardIssues || []).some((issue) => issue.severity === "critical")) {
    issues.push("claim_guard_violation");
  }
  if (/(?:age-mismatch|raw-score|raw-preserved|format-preserved|preserved-vineland|typical-vineland|typical-abas)/i.test(result.fixturePath) && !(trace?.suppressedAtoms || []).length) {
    issues.push("trace_coverage_missing");
  }
  if (/(?:\b\d{1,2}\.\s*soru\b|\bsoru\s*\d{1,2}\b|madde düzeyinde|anket maddesi|yanıt dizisi|soru numarası)/i.test(result.finalText)) {
    issues.push("micro_evidence_leak");
  }
  return issues;
}

function buildMarkdownSummary(results: FixtureAudit[]) {
  const issueCounts = new Map<AuditIssueCode, number>();
  const examples = new Map<AuditIssueCode, string[]>();

  for (const result of results) {
    for (const code of result.issueCodes) {
      issueCounts.set(code, (issueCounts.get(code) || 0) + 1);
      const list = examples.get(code) || [];
      if (list.length < 5) list.push(path.basename(result.fixture));
      examples.set(code, list);
    }
  }

  const sortedIssues = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1]);

  return [
    "# DNA Intelligence Deterministic Audit",
    "",
    `Toplam fixture: ${results.length}`,
    `Sorun bulunan fixture: ${results.filter((item) => item.issueCodes.length > 0).length}`,
    "",
    "## En Sık Sorunlar",
    ...sortedIssues.flatMap(([code, count]) => [
      `- ${ISSUE_LABELS[code]}: ${count}`,
      `  Ornekler: ${(examples.get(code) || []).join(", ")}`,
    ]),
    "",
    "## Fixture Bazli Ozet",
    ...results.map((result) => {
      const issues =
        result.issueCodes.length > 0
          ? result.issueCodes.map((code) => ISSUE_LABELS[code]).join(" | ")
          : "Sorun saptanmadi";
      return `- ${path.basename(result.fixture)} | Profil: ${result.profileType} | Duzey: ${result.globalLevel} | Issue: ${issues}`;
    }),
    "",
  ].join("\n");
}

async function main() {
  assertKnowledgeBaseCoverage();
  const externalRegistryIssues = assertExternalTestRegistryMetadata();
  const fixturePaths = await listFixturePaths();
  const results: FixtureAudit[] = [];

  for (const fixturePath of fixturePaths) {
    const fixture = await loadFixture(fixturePath);
    const result = await runSingleFixture(fixturePath, true);
    const metricsText = await fs
      .readFile(path.join(result.outputDir, "report-with-metrics.md"), "utf8")
      .catch(() => "");
    const anamnezRecord = toAnamnezRecord(fixture.anamnez);
    const issueResult = getIssueCodes({
      profileType: result.profileType,
      finalText: result.finalText,
      metricsText,
      anamnezRecord,
      ageMonths: fixture.ageMonths,
      narrativeGuardCount: result.narrativeGuardViolations.length,
    });
    const traceIssueCodes = getTraceAuditIssues(result);

    results.push({
      fixture: fixturePath,
      clientCode: result.clientCode,
      ageMonths: fixture.ageMonths,
      profileType: result.profileType,
      globalLevel: result.globalLevel,
      issueCodes: Array.from(new Set([...issueResult.issueCodes, ...traceIssueCodes, ...(externalRegistryIssues.length ? ["external_registry_metadata_missing" as AuditIssueCode] : [])])),
      compatibleCategories: issueResult.compatibleCategories,
      incompatibleCount: issueResult.incompatibleCount,
    });
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, "audit-summary.json"), JSON.stringify(results, null, 2), "utf8");
  await fs.writeFile(path.join(OUTPUT_DIR, "audit-summary.md"), buildMarkdownSummary(results), "utf8");

  console.log("");
  console.log("=== DETERMINISTIC AUDIT ===");
  console.log(`Toplam fixture: ${results.length}`);
  console.log(`Sorun bulunan fixture: ${results.filter((item) => item.issueCodes.length > 0).length}`);
  if (externalRegistryIssues.length > 0) {
    console.log(`External registry metadata issue: ${externalRegistryIssues.slice(0, 10).join(" | ")}`);
  }

  const issueCounts = new Map<AuditIssueCode, number>();
  for (const result of results) {
    for (const code of result.issueCodes) {
      issueCounts.set(code, (issueCounts.get(code) || 0) + 1);
    }
  }

  for (const [code, count] of Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${code}: ${count}`);
  }

  console.log("");
  console.log(`Ozet: ${path.join(OUTPUT_DIR, "audit-summary.md")}`);
  if (issueCounts.size > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
