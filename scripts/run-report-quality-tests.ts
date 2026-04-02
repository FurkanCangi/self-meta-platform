import fs from "node:fs/promises";
import path from "node:path";

import { QUALITY_CASE_SPECS, type QualityCaseSpec } from "./report-quality-cases";
import { runSingleFixture } from "./run-selfmeta-report";
import { hasAllCanonicalReportSections, splitClinicalReportSections } from "../src/lib/selfmeta/reportText";

const OUTPUT_DIR = "/tmp/selfmeta-report-output/quality-gates";

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
  const withoutHeading = beforeReferences.replace(/^7\.\s*Literatürle Uyumlu Klinik Not\s*/i, "").trim();
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

function validateCase(spec: QualityCaseSpec, result: Awaited<ReturnType<typeof runSingleFixture>>, withAi: boolean) {
  const failures: string[] = [];
  const finalText = result.finalText;
  const patternSection = getSectionBody(finalText, "4.");
  const fitSection = getSectionBody(finalText, "5.");
  const conclusionSection = getSectionBody(finalText, "6.");
  const literatureSection = getRawSectionText(finalText, "7.");

  if (!hasAllCanonicalReportSections(finalText)) {
    failures.push("Final rapor canonical section setini taşımıyor.");
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

  if (spec.requiredPhrases?.length && !includesAll(finalText, spec.requiredPhrases)) {
    failures.push(`Gerekli ifadelerden en az biri eksik: ${spec.requiredPhrases.join(" | ")}`);
  }

  if (spec.forbiddenPhrases?.length && includesAny(finalText, spec.forbiddenPhrases)) {
    failures.push(`Yasaklı anlatı ifadesi bulundu: ${spec.forbiddenPhrases.join(" | ")}`);
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

  const apaReferenceCount = countApaReferences(literatureSection);
  if (apaReferenceCount < (spec.minApaReferences || 0)) {
    failures.push(`APA kaynak sayısı az: ${apaReferenceCount}`);
  }

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
    "# Self Meta Report Quality Gates",
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
