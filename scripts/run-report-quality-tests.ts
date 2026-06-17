import fs from "node:fs/promises";
import path from "node:path";

import { QUALITY_CASE_SPECS, type QualityCaseSpec } from "./report-quality-cases";
import { runSingleFixture } from "./run-dna-report";
import { VERIFIED_LITERATURE_SOURCES } from "../src/lib/dna/literatureNote";
import {
  countWeakHedges,
  hasForbiddenClinicalCitation,
  hasForbiddenClinicalDetermination,
} from "../src/lib/dna/reportQuality";
import { hasAllCanonicalReportSections, splitClinicalReportSections } from "../src/lib/dna/reportText";
import { questions } from "../src/lib/dna/questions";
import { analyzeReportLanguageQuality } from "../src/lib/dna/reportLanguageQuality";

const OUTPUT_DIR = "/tmp/dna-report-output/quality-gates";

type QualityFailure = {
  caseKey: string;
  message: string;
};

type QualityResult = {
  caseKey: string;
  fixturePath: string;
  profileType: string;
  globalLevel: string;
  finalAiContributionPct: number;
  finalRagContributionPct: number;
  fallbackUsed: boolean;
  passed: boolean;
  failures: string[];
};

function parseArgs(argv: string[]) {
  return {
    withAi: argv.includes("--with-ai"),
    smokeOnly: argv.includes("--smoke-only"),
  };
}

function getSectionBody(text: string, headingPrefix: string): string {
  const section = splitClinicalReportSections(text).find((entry) => entry.heading.startsWith(headingPrefix));
  return String(section?.body || "").trim();
}

function getRawSectionText(text: string, headingPrefix: string): string {
  const escapedHeading = headingPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|\\n)(${escapedHeading}[^\\n]*\\n[\\s\\S]*?)(?=\\n\\d+\\.\\s|$)`, "i");
  const match = text.match(pattern);
  return String(match?.[1] || "").trim();
}

function countLiteratureParagraphs(rawSectionText: string): number {
  const beforeReferences = rawSectionText.split(/Kaynaklar\s*\(APA 7\)\s*:/i)[0] || "";
  const withoutHeading = beforeReferences.replace(/^8\.\s*Literatürle Uyumlu Klinik Dayanak\s*/i, "").trim();
  if (!withoutHeading) return 0;
  return withoutHeading
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function countApaReferences(rawSectionText: string): number {
  const afterReferences = rawSectionText.split(/Kaynaklar\s*\(APA 7\)\s*:/i)[1] || "";
  return afterReferences
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-ZÇĞİÖŞÜ]/.test(entry) && /\(\d{4}\)/.test(entry)).length;
}

function includesAll(text: string, phrases: string[]): boolean {
  const normalized = text.toLocaleLowerCase("tr-TR");
  return phrases.every((phrase) => normalized.includes(phrase.toLocaleLowerCase("tr-TR")));
}

function includesAny(text: string, phrases: string[]): boolean {
  const normalized = text.toLocaleLowerCase("tr-TR");
  return phrases.some((phrase) => normalized.includes(phrase.toLocaleLowerCase("tr-TR")));
}

function getClinicalMainText(text: string): string {
  return splitClinicalReportSections(text)
    .filter((section) => !section.heading.startsWith("8."))
    .map((section) => `${section.heading}\n${section.body}`)
    .join("\n\n");
}

function collectInlineCitations(text: string): string[] {
  return Array.from(
    new Set(
      Array.from(
        String(text || "").matchAll(
          /\([A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü'’-]+(?:\s+(?:&|and)\s+[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşü'’-]+|\s+et al\.)?,\s*(?:19|20)\d{2}\)/g
        )
      ).map((match) => match[0])
    )
  );
}

function listApaReferences(rawSectionText: string): string[] {
  const afterReferences = rawSectionText.split(/Kaynaklar\s*\(APA 7\)\s*:/i)[1] || "";
  return afterReferences
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter((entry) => /^[A-ZÇĞİÖŞÜ]/.test(entry) && /\(\d{4}\)/.test(entry));
}

function validateRegistryOnlyLiterature(rawSectionText: string): string[] {
  const failures: string[] = [];
  const allowedInline = new Set(Object.values(VERIFIED_LITERATURE_SOURCES).map((source) => source.inlineCitation));
  const allowedReferences = new Set(Object.values(VERIFIED_LITERATURE_SOURCES).map((source) => source.apaReference));
  const inlineCitations = collectInlineCitations(rawSectionText);
  const references = listApaReferences(rawSectionText);
  const externalInline = inlineCitations.filter((citation) => !allowedInline.has(citation));
  const externalReferences = references.filter((reference) => !allowedReferences.has(reference));

  if (!rawSectionText.trim()) {
    failures.push("Literatür bölümü bulunamadı.");
  }
  if (externalInline.length > 0) {
    failures.push(`Registry dışı inline citation bulundu: ${externalInline.join(", ")}`);
  }
  if (externalReferences.length > 0) {
    failures.push(`Registry dışı APA kaynak bulundu: ${externalReferences.join(" | ")}`);
  }
  if (inlineCitations.length === 0 || references.length === 0) {
    failures.push("Literatür bölümünde registry citation/reference çifti görünmüyor.");
  }

  return failures;
}

function requiresClassificationExplanation(
  result: Awaited<ReturnType<typeof runSingleFixture>>
): boolean {
  const levels = new Set((result.domainResults || []).map((domain) => domain.level));
  return levels.size > 0 && (levels.size > 1 || !levels.has(result.globalLevel));
}

function hasClassificationExplanation(decisionSection: string): boolean {
  return /toplam skor/i.test(decisionSection) && /alan.*(kendi|50 puanlık|puan eşi|eşiğ|eşi)/i.test(decisionSection);
}

async function readMetricsText(outputDir: string): Promise<string> {
  return fs.readFile(path.join(outputDir, "report-with-metrics.md"), "utf8").catch(() => "");
}

function hasDecisionSynthesis(sectionBody: string): boolean {
  return /(öncelikli klinik hipotez|en güçlü klinik hipotez|mevcut verilerle en güçlü klinik eksen|temel klinik eksen|temel sorun|klinik eksen|karar|sentez|profil sınıflaması|sonuç olarak|sonuç|bu nedenle|dolayısıyla|genel sınıflama|örüntü|işaret etmektedir|işaret eder|göstermektedir|uyumludur|yoğunlaşmaktadır|doğrudan uyum|açık uyum|örtüşmektedir|düşündürmektedir)/i.test(
    sectionBody
  );
}

function countCaseSpecificEvidenceSentences(text: string): number {
  const evidencePatterns = [
    /ses|gürültü|gurultu|hareket yükü|hareket yuku|uyaran/i,
    /görevden kop|gorevden kop|görevde kal|gorevde kal|toparlanma süresi|toparlanma suresi/i,
    /motor planlama|praksi|sekans|beden organizasyonu|koordinasyon/i,
    /öz bakım|oz bakim|giyinme|rutin|başlatma|baslatma|sürdürme|surdurme/i,
    /terapist gözlemi|terapist gozlemi|anamnez|dış test|dis test|ölçek içi mikro-kanıt|olcek ici mikro-kanit/i,
  ];

  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => evidencePatterns.some((pattern) => pattern.test(sentence))).length;
}

function getKnownExternalTestNames(text: string): string[] {
  const known = [
    "Sensory Profile 2",
    "BRIEF-P",
    "BRIEF2",
    "Conners 4",
    "Conners Early Childhood",
    "Conners EC",
    "SIPT",
    "PDMS-3",
    "MABC-3",
    "BOT-2",
    "MFUN",
    "Beery VMI",
    "Vineland-3",
    "ABAS-3",
    "PEDI-CAT",
    "CELF Preschool-3",
    "PLS-5",
    "CCC-2",
    "SRS-2",
  ];
  const haystack = String(text || "").toLocaleLowerCase("tr-TR");
  return known.filter((name) => haystack.includes(name.toLocaleLowerCase("tr-TR")));
}

function validateCase(spec: QualityCaseSpec, result: Awaited<ReturnType<typeof runSingleFixture>>, withAi: boolean) {
  const failures: string[] = [];
  const finalText = result.finalText;
  const clinicalMainText = getClinicalMainText(finalText);
  const decisionSummarySection = getSectionBody(finalText, "1.");
  const evidenceProfileSection = getSectionBody(finalText, "2.");
  const patternSection = getSectionBody(finalText, "4.");
  const fitSection = getSectionBody(finalText, "5.");
  const prioritizationSection = getSectionBody(finalText, "6.");
  const conclusionSection = getSectionBody(finalText, "7.");
  const literatureSection = getRawSectionText(finalText, "8.");
  const languageQuality = analyzeReportLanguageQuality(finalText);

  if (!hasAllCanonicalReportSections(finalText)) {
    failures.push("Final rapor canonical section setini taşımıyor.");
  }

  const mainSections = splitClinicalReportSections(finalText).filter((section) =>
    /^[1-7]\.\s/.test(section.heading)
  );
  for (const section of mainSections) {
    if (!hasDecisionSynthesis(section.body)) {
      failures.push(`${section.heading} bölümünde karar/sentez cümlesi zayıf.`);
    }
  }

  if (!/Klinik karar cümlesi:|öncelikli klinik hipotez|en güçlü klinik hipotez|mevcut verilerle en güçlü klinik eksen|temel klinik eksen|ana klinik eksen/i.test(decisionSummarySection)) {
    failures.push("1. Klinik Karar Özeti beklenen hipotez/karar dilini taşımıyor.");
  }

  if (!/öncelikli klinik hipotez|en güçlü klinik hipotez|(?:mevcut verilerle\s*)?en güçlü klinik eksen|veri güven(?: düzeyi)?|karar güveni/i.test(prioritizationSection)) {
    failures.push("6. Klinik Önceliklendirme Notu beklenen hipotez/eksen/güven dilini taşımıyor.");
  }

  if (
    !/(Klinik karar cümlesi:|Karar özeti:)/i.test(prioritizationSection) ||
    !/(Klinik formülasyon:|Formülasyon özeti:)/i.test(prioritizationSection)
  ) {
    failures.push("6. Klinik Önceliklendirme Notu profesör düzeyi karar/formülasyon özetini taşımıyor.");
  }

  if (!/Klinik öncelik sırası:/i.test(prioritizationSection)) {
    failures.push("6. Klinik Önceliklendirme Notu klinik öncelik sırası üretmiyor.");
  }

  if (requiresClassificationExplanation(result) && !hasClassificationExplanation(`${evidenceProfileSection}\n${prioritizationSection}`)) {
    failures.push("Global/domain sınıflama farkı kanıt profili veya karar notunda toplam skor ve alan eşiği farkıyla açıklanmıyor.");
  }

  if (hasForbiddenClinicalCitation(clinicalMainText)) {
    failures.push("Klinik ana bölümlerde AI/rapor kaynak, DOI, APA veya inline citation üretmiş.");
  }

  if (hasForbiddenClinicalDetermination(clinicalMainText)) {
    failures.push("Klinik ana bölümlerde tanı/tedavi/kesin müdahale hükmü dili bulundu.");
  }

  if (countWeakHedges(clinicalMainText) > 10) {
    failures.push("Zayıf hedge kalıpları fazla; karar/sentez dili yeterince net değil.");
  }

  if (countCaseSpecificEvidenceSentences(clinicalMainText) < 2) {
    failures.push("Vaka-özel kanıt cümlesi sayısı düşük.");
  }

  const sourceExternalTests = new Set(getKnownExternalTestNames(result.sourceExternalClinicalFindings || ""));
  const reportExternalTests = getKnownExternalTestNames(clinicalMainText);
  const inventedTests = reportExternalTests.filter((testName) => !sourceExternalTests.has(testName));
  if (inventedTests.length > 0) {
    failures.push(`Inputta olmayan dış test adı rapora girmiş: ${inventedTests.join(", ")}`);
  }

  if (result.globalLevel !== spec.expectedGlobalLevel) {
    failures.push(`Beklenen genel düzey ${spec.expectedGlobalLevel}, gelen ${result.globalLevel}.`);
  }

  if (!spec.expectedProfileIncludes.every((needle) => result.profileType.includes(needle))) {
    failures.push(`Profil adı beklenen kalıbı taşımıyor: ${spec.expectedProfileIncludes.join(" + ")} | gelen: ${result.profileType}`);
  }

  if (result.narrativeGuardViolations.length > 0) {
    failures.push(
      `Narrative guard ihlali var: ${result.narrativeGuardViolations.map((issue) => issue.code).join(", ")}`
    );
  }

  const blockingLanguageIssues = languageQuality.issues.filter((issue) => issue.severity === "high");
  if (blockingLanguageIssues.length > 0) {
    failures.push(
      `Dil kalite guard ihlali var: ${blockingLanguageIssues.map((issue) => issue.code).join(", ")}`
    );
  }

  if (spec.requiredPhrases?.length && !includesAll(finalText, spec.requiredPhrases)) {
    failures.push(`Gerekli ifadelerden en az biri eksik: ${spec.requiredPhrases.join(" | ")}`);
  }

  if (spec.forbiddenPhrases?.length && includesAny(finalText, spec.forbiddenPhrases)) {
    failures.push(`Yasaklı anlatı ifadesi bulundu: ${spec.forbiddenPhrases.join(" | ")}`);
  }

  if (spec.key === "item-linkage") {
    const questionTextsInReport = questions
      .map((question) => question.text.trim())
      .filter((text) => text.length > 8 && finalText.includes(text));
    if (questionTextsInReport.length > 0) {
      failures.push(`Mikro-kanıt çıktısı doğrudan soru metni içeriyor: ${questionTextsInReport.slice(0, 2).join(" | ")}`);
    }
    if (/(?:\b\d{1,2}\.\s*soru\b|\bsoru\s*\d{1,2}\b|madde düzeyinde|maddeler:|maddesinin)/i.test(finalText)) {
      failures.push("Mikro-kanıt çıktısı soru numarası veya eski madde dili içeriyor.");
    }
  }

  if (spec.mode === "balanced" && includesAny(patternSection + "\n" + conclusionSection, ["seçici bir kırılganlık", "yaygın regülasyon yükü"])) {
    failures.push("Dengeli vakada seçici/yaygın risk dili kullanılmış.");
  }

  if (spec.mode === "selective" && !/seçici/i.test(result.profileType + "\n" + patternSection)) {
    failures.push("Seçici vaka seçici dil ile ifade edilmiyor.");
  }

  if (spec.mode === "paired" && /seçici bir kırılganlık/i.test(patternSection)) {
    failures.push("Çift eksenli vaka örüntü analizinde yanlışlıkla seçici diye anlatılmış.");
  }

  if (spec.mode === "widespread" && /seçici bir kırılganlık/i.test(patternSection + "\n" + conclusionSection)) {
    failures.push("Yaygın vaka örüntü veya sonuç kısmında seçici diye anlatılmış.");
  }

  if (spec.requireAgeMismatchWarning && !/ana klinik karar mekanizmasına dahil edilmemeli/i.test(fitSection)) {
    failures.push("Yaş uyumsuz dış test uyarısı fit bölümünde görünmüyor.");
  }

  const literatureParagraphCount = countLiteratureParagraphs(literatureSection);
  if (literatureParagraphCount < (spec.minLiteratureParagraphs || 0)) {
    failures.push(`Literatür paragrafı az: ${literatureParagraphCount}`);
  }

  if (!/yorum sınırı|tanı, nedensellik veya müdahale reçetesi üretmez/i.test(literatureSection)) {
    failures.push("Literatür bölümü kaynak kullanım sınırını açıkça yazmıyor.");
  }

  const apaReferenceCount = countApaReferences(literatureSection);
  if (apaReferenceCount < (spec.minApaReferences || 0)) {
    failures.push(`APA kaynak sayısı az: ${apaReferenceCount}`);
  }

  failures.push(...validateRegistryOnlyLiterature(literatureSection));

  if (withAi && typeof spec.expectedAiMinContributionPct === "number") {
    if (result.finalAiContributionPct < spec.expectedAiMinContributionPct) {
      failures.push(
        `AI katkısı beklenen eşiğin altında: %${result.finalAiContributionPct} < %${spec.expectedAiMinContributionPct}`
      );
    }
    if (result.fallbackUsed) {
      failures.push("AI quality modunda rapor fallback'e düştü.");
    }
  }

  return failures;
}

async function ensureOutputDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function writeSummary(results: QualityResult[], label: string) {
  await ensureOutputDir();

  const markdown = [
    "# DNA Intelligence Report Quality Gates",
    "",
    ...results.map((result) =>
      [
        `## ${result.caseKey}`,
        `- Fixture: ${result.fixturePath}`,
        `- Profil: ${result.profileType}`,
        `- Genel düzey: ${result.globalLevel}`,
        `- Final AI: %${result.finalAiContributionPct}`,
        `- Final RAG: %${result.finalRagContributionPct}`,
        `- Fallback: ${result.fallbackUsed ? "Evet" : "Hayır"}`,
        `- Durum: ${result.passed ? "PASS" : "FAIL"}`,
        ...(result.failures.length ? result.failures.map((failure) => `- Hata: ${failure}`) : []),
        "",
      ].join("\n")
    ),
  ].join("\n");

  await fs.writeFile(path.join(OUTPUT_DIR, `quality-summary-${label}.md`), markdown, "utf8");
  await fs.writeFile(path.join(OUTPUT_DIR, `quality-summary-${label}.json`), JSON.stringify(results, null, 2), "utf8");
}

async function runQualityFixture(spec: QualityCaseSpec, withAi: boolean) {
  const deterministicOnly = !withAi;
  return runSingleFixture(spec.fixturePath, deterministicOnly);
}

async function main() {
  const { withAi, smokeOnly } = parseArgs(process.argv.slice(2));
  const specs = smokeOnly
    ? QUALITY_CASE_SPECS.filter((spec) => typeof spec.expectedAiMinContributionPct === "number")
    : QUALITY_CASE_SPECS;
  const results: QualityResult[] = [];
  const failures: QualityFailure[] = [];

  for (const spec of specs) {
    const result = await runQualityFixture(spec, withAi);
    const caseFailures = validateCase(spec, result, withAi);
    const metricsText = await readMetricsText(result.outputDir);
    if (!withAi && (!/Runtime RAG:\s*%0/i.test(metricsText) || !/Deterministic Knowledge Base:\s*Aktif/i.test(metricsText))) {
      caseFailures.push("Deterministic üretimde Runtime RAG %0 ve Knowledge Base Aktif metrik ayrımı görünmüyor.");
    }
    if (!withAi && (!/Trace:\s*Aktif/i.test(metricsText) || !/Selected atoms:\s*[1-9]\d*/i.test(metricsText))) {
      caseFailures.push("Deterministic üretimde trace aktif ve seçili atom metrikleri görünmüyor.");
    }
    if (!result.trace?.active || !result.auditTrail?.inputHash) {
      caseFailures.push("Rapor trace/auditTrail üretmiyor.");
    }
    if ((result.trace?.validationIssues || []).length > 0) {
      caseFailures.push(`Trace validation issue var: ${(result.trace?.validationIssues || []).join(" | ")}`);
    }
    const invalidAtoms = (result.trace?.selectedAtoms || []).filter(
      (atom) => !atom.evidenceIds?.length || !atom.ruleIds?.length || !atom.confidence || typeof atom.priority !== "number" || !atom.sections?.length
    );
    if (invalidAtoms.length > 0) {
      caseFailures.push(`Eksik trace alanı olan atom var: ${invalidAtoms.map((atom) => atom.id).join(", ")}`);
    }
    if (
      /raw-score-only|raw-ext/i.test(result.fixturePath) &&
      /Klinik karar cümlesi:\s*bu raporda birincil klinik eksen/i.test(result.finalText)
    ) {
      caseFailures.push("Ham puan-only vakada karar cümlesi eski eksen şablonuna düştü.");
    }
    const passed = caseFailures.length === 0;

    results.push({
      caseKey: spec.key,
      fixturePath: spec.fixturePath,
      profileType: result.profileType,
      globalLevel: result.globalLevel,
      finalAiContributionPct: result.finalAiContributionPct,
      finalRagContributionPct: result.finalRagContributionPct,
      fallbackUsed: result.fallbackUsed,
      passed,
      failures: caseFailures,
    });

    for (const failure of caseFailures) {
      failures.push({ caseKey: spec.key, message: failure });
    }
  }

  const summaryLabel = withAi ? (smokeOnly ? "ai-smoke" : "ai-full") : "deterministic";
  await writeSummary(results, summaryLabel);

  console.log("");
  console.log("=== REPORT QUALITY GATES ===");
  for (const result of results) {
    console.log(
      `- ${result.caseKey} | ${result.passed ? "PASS" : "FAIL"} | Profil: ${result.profileType} | Final AI %${result.finalAiContributionPct} | Final RAG %${result.finalRagContributionPct}`
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("=== FAILURES ===");
    for (const failure of failures) {
      console.log(`- ${failure.caseKey}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log(`Tum quality gate'ler gecti. Ozet: ${path.join(OUTPUT_DIR, `quality-summary-${summaryLabel}.md`)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
