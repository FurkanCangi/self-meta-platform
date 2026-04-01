import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

import { buildAdvancedReport, type DomainScoreMap } from "../src/lib/selfmeta/reportEngine";
import { rewriteClinicalReport } from "../src/lib/selfmeta/aiRewrite";
import { buildLiteratureAlignedSection } from "../src/lib/selfmeta/literatureNote";
import {
  splitClinicalReportSections,
  getClinicalReportSectionHeadings,
  hasAllCanonicalReportSections,
  mergeClinicalReportSections,
  normalizeClinicalReportText,
} from "../src/lib/selfmeta/reportText";
import { type AnamnezRecord } from "../src/lib/selfmeta/anamnezUtils";
import { isSupportedAgeMonths } from "../src/lib/selfmeta/ageUtils";
import { estimateRagCoverage, selectProRagContext } from "../src/lib/selfmeta/ragSelector";
import {
  getNarrativeGuardViolations,
  hasCriticalNarrativeGuardViolation,
  type NarrativeGuardViolation,
} from "../src/lib/selfmeta/reportQuality";

export type FixturePayload = {
  clientCode: string;
  clientName?: string;
  ageMonths: number;
  anamnez: string | AnamnezRecord;
  scores: DomainScoreMap;
  answers?: number[];
};

const DEFAULT_FIXTURE_PATH = path.resolve(process.cwd(), "scripts", "fixtures", "selfmeta-rich-case.json");
const OUTPUT_DIR = "/tmp/selfmeta-report-output";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLevel(v: string): string {
  const x = String(v || "")
    .toLowerCase()
    .trim()
    .replace(/\.\s*olarak görünmektedir\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (x.includes("atipik")) return "Atipik";
  if (x.includes("riskli")) return "Riskli";
  if (x.includes("tipik")) return "Tipik";
  return "";
}

function hasLevelMismatch(
  text: string,
  domainSummary: Record<string, string> | undefined
): boolean {
  if (!text || !domainSummary) return false;

  const allLevels = ["Tipik", "Riskli", "Atipik"];
  const relevantSections = splitClinicalReportSections(text).filter((section) =>
    section.heading === "2. Sayısal Sonuç Özeti" || section.heading === "3. Alan Bazlı Klinik Yorum"
  );
  const lines = relevantSections.flatMap((section) => section.body.split(/\n+/));

  for (const [domain, rawLevel] of Object.entries(domainSummary)) {
    const expected = normalizeLevel(rawLevel);
    if (!domain || !expected) continue;

    const domainRe = new RegExp(escapeRegex(domain), "i");
    const matchingLines = lines.filter((ln) => {
      const line = String(ln || "").trim();
      if (!line || !domainRe.test(line)) return false;
      return (
        line.startsWith(`- ${domain}:`) ||
        line.startsWith(`${domain}:`) ||
        line.startsWith(`${domain} `) ||
        line === domain
      );
    });

    for (const ln of matchingLines) {
      const foundLevels = allLevels.filter((lvl) => ln.includes(lvl));
      if (foundLevels.length > 0 && !foundLevels.includes(expected)) {
        return true;
      }
    }
  }

  return false;
}

function shouldFallbackToDeterministic(
  aiText: string,
  clinicalAnalysis: {
    domainSummary?: Record<string, string>;
  } | undefined,
  reportMeta?: {
    domainResults?: Array<{ key: string; label: string; score: number; level: string }>
    globalLevel?: string
    profileType?: string
  }
): boolean {
  if (!aiText || !aiText.trim()) return true;
  if (!hasAllCanonicalReportSections(aiText)) return true;
  if (hasLevelMismatch(aiText, clinicalAnalysis?.domainSummary)) return true;
  if (
    reportMeta?.domainResults?.length &&
    reportMeta.globalLevel &&
    reportMeta.profileType &&
    hasCriticalNarrativeGuardViolation({
      text: aiText,
      domainResults: reportMeta.domainResults,
      globalLevel: reportMeta.globalLevel,
      profileType: reportMeta.profileType,
    })
  ) {
    return true;
  }
  return false;
}

function getFallbackReason(
  aiText: string,
  clinicalAnalysis: {
    domainSummary?: Record<string, string>;
  } | undefined,
  reportMeta?: {
    domainResults?: Array<{ key: string; label: string; score: number; level: string }>
    globalLevel?: string
    profileType?: string
  }
): string | null {
  if (!aiText || !aiText.trim()) return "empty";
  if (!hasAllCanonicalReportSections(aiText)) return "missing_sections";
  if (hasLevelMismatch(aiText, clinicalAnalysis?.domainSummary)) return "level_mismatch";
  if (
    reportMeta?.domainResults?.length &&
    reportMeta.globalLevel &&
    reportMeta.profileType &&
    hasCriticalNarrativeGuardViolation({
      text: aiText,
      domainResults: reportMeta.domainResults,
      globalLevel: reportMeta.globalLevel,
      profileType: reportMeta.profileType,
    })
  ) {
    return "narrative_guard";
  }
  return null;
}

function appendOptionalSection(baseText: string, optionalSection?: string | null): string {
  const main = String(baseText || "").trim();
  const extra = String(optionalSection || "").trim();
  if (!extra) return main;
  return [main, extra].filter(Boolean).join("\n\n");
}

function parseArgs(argv: string[]) {
  const fixtureIndex = argv.findIndex((arg) => arg === "--fixture");
  const fixturePath =
    fixtureIndex >= 0 && argv[fixtureIndex + 1]
      ? path.resolve(process.cwd(), argv[fixtureIndex + 1])
      : DEFAULT_FIXTURE_PATH;

  return {
    fixturePath,
    runAll: argv.includes("--all"),
    deterministicOnly: argv.includes("--deterministic-only"),
  };
}

async function loadFixture(fixturePath: string): Promise<FixturePayload> {
  const raw = await fs.readFile(fixturePath, "utf8");
  return JSON.parse(raw) as FixturePayload;
}

async function ensureOutputDir(outputDir: string) {
  await fs.mkdir(outputDir, { recursive: true });
}

function slugifyFixtureName(input: string): string {
  return path
    .basename(input, ".json")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tokenize(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü\s]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function jaccardSimilarity(aText: string, bText: string): number {
  const a = new Set(tokenize(aText));
  const b = new Set(tokenize(bText));

  if (!a.size && !b.size) return 1;

  const union = new Set([...a, ...b]);
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  return union.size ? intersection / union.size : 0;
}

function estimateAiContributionPercent(deterministicText: string, aiMergedText: string): number {
  const deterministicSections = new Map(
    splitClinicalReportSections(deterministicText).map((section) => [section.heading, section.body])
  );
  const aiSections = new Map(
    splitClinicalReportSections(aiMergedText).map((section) => [section.heading, section.body])
  );

  let totalWeight = 0;
  let weightedInfluence = 0;

  for (const [heading, deterministicBody] of deterministicSections.entries()) {
    const detBody = String(deterministicBody || "").trim();
    const aiBody = String(aiSections.get(heading) || "").trim();
    const weight = Math.max(tokenize(detBody).length, 1);

    totalWeight += weight;

    if (!aiBody || aiBody === detBody) continue;

    const similarity = jaccardSimilarity(detBody, aiBody);
    const influencePercent = Math.max(0, Math.min(100, Math.round((1 - similarity) * 100)));
    weightedInfluence += influencePercent * weight;
  }

  return totalWeight ? Math.round(weightedInfluence / totalWeight) : 0;
}

function buildTechnicalSummaryBlock(meta: {
  finalDeterministicContributionPct: number;
  finalAiContributionPct: number;
  finalRagContributionPct: number;
  aiDraftRagCoveragePct: number;
  fallbackUsed: boolean;
  aiDraftNarrativeGuardViolations?: NarrativeGuardViolation[];
  narrativeGuardViolations: NarrativeGuardViolation[];
}) {
  return [
    "Teknik Uretim Ozeti (Test Amacli)",
    `- Final deterministic katki (tahmini): %${meta.finalDeterministicContributionPct}`,
    `- Final AI katki (tahmini): %${meta.finalAiContributionPct}`,
    `- Final RAG katki (tahmini): %${meta.finalRagContributionPct}`,
    `- AI taslak RAG coverage: %${meta.aiDraftRagCoveragePct}`,
    `- AI draft narrative guard issue sayisi: ${(meta.aiDraftNarrativeGuardViolations || []).length}`,
    `- Fallback: ${meta.fallbackUsed ? "Evet" : "Hayir"}`,
    `- Narrative guard issue sayisi: ${meta.narrativeGuardViolations.length}`,
  ].join("\n");
}

async function writeOutputs(payload: {
  outputDir: string;
  deterministic: string;
  aiDraft: string;
  mergedDraft: string;
  final: string;
  technicalSummary: string;
  meta: Record<string, unknown>;
}) {
  await ensureOutputDir(payload.outputDir);

  await fs.writeFile(path.join(payload.outputDir, "deterministic-report.md"), payload.deterministic, "utf8");
  await fs.writeFile(path.join(payload.outputDir, "ai-draft.md"), payload.aiDraft, "utf8");
  await fs.writeFile(path.join(payload.outputDir, "merged-draft.md"), payload.mergedDraft, "utf8");
  await fs.writeFile(path.join(payload.outputDir, "final-report.md"), payload.final, "utf8");
  await fs.writeFile(
    path.join(payload.outputDir, "report-with-metrics.md"),
    `${payload.technicalSummary}\n\n---\n\n${payload.final}`.trim(),
    "utf8"
  );
  await fs.writeFile(path.join(payload.outputDir, "report-meta.json"), JSON.stringify(payload.meta, null, 2), "utf8");
}

export async function listFixturePaths(): Promise<string[]> {
  const fixtureDir = path.resolve(process.cwd(), "scripts", "fixtures");
  const entries = await fs.readdir(fixtureDir);
  return entries
    .filter((entry) => entry.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b, "tr"))
    .map((entry) => path.join(fixtureDir, entry));
}

export async function runSingleFixture(fixturePath: string, deterministicOnly: boolean) {
  const fixture = await loadFixture(fixturePath);

  if (!fixture?.clientCode) {
    throw new Error("Fixture icinde clientCode zorunlu.");
  }

  if (!isSupportedAgeMonths(fixture.ageMonths)) {
    throw new Error("Fixture ageMonths desteklenen bantlardan biri olmali: 24-35, 36-47, 48-59, 60-71 ay.");
  }

  const report = buildAdvancedReport({
    clientCode: fixture.clientCode,
    ageMonths: fixture.ageMonths,
    anamnez: fixture.anamnez,
    answers: Array.isArray(fixture.answers) ? fixture.answers : undefined,
    scores: fixture.scores || {},
  });

  if (!report.clinicalAnalysis) {
    throw new Error("clinicalAnalysis olusmadi.");
  }

  const ragContext = selectProRagContext(report.clinicalAnalysis);
  let aiText = "";
  let aiError: string | null = null;

  if (!deterministicOnly) {
    try {
      aiText = await rewriteClinicalReport(report.clinicalAnalysis);
    } catch (error) {
      aiError = error instanceof Error ? error.message : String(error);
    }
  }

  const mergedAiText = mergeClinicalReportSections(aiText, report.deterministicReport);
  const fallbackReason = getFallbackReason(mergedAiText, report.clinicalAnalysis, {
    domainResults: report.domainResults,
    globalLevel: report.globalLevel,
    profileType: report.profileType,
  });
  const aiDraftNarrativeGuardViolations = getNarrativeGuardViolations({
    text: mergedAiText,
    domainResults: report.domainResults,
    globalLevel: report.globalLevel,
    profileType: report.profileType,
  });
  const useFallback = Boolean(fallbackReason);
  const literatureSection = buildLiteratureAlignedSection(report.clinicalAnalysis);
  const finalText = normalizeClinicalReportText(
    appendOptionalSection(useFallback ? report.deterministicReport : mergedAiText, literatureSection?.text)
  );
  const deterministicText = normalizeClinicalReportText(
    appendOptionalSection(report.deterministicReport, literatureSection?.text)
  );
  const aiDraftRagCoveragePct = aiText ? estimateRagCoverage(aiText, ragContext).overall : 0;
  const aiContributionDraftPct = aiText ? estimateAiContributionPercent(report.deterministicReport, mergedAiText) : 0;
  const finalAiContributionPct = useFallback ? 0 : aiContributionDraftPct;
  const finalRagContributionPct = Math.round((finalAiContributionPct * aiDraftRagCoveragePct) / 100);
  const finalDeterministicContributionPct = Math.max(0, 100 - finalAiContributionPct);
  const narrativeGuardViolations = getNarrativeGuardViolations({
    text: finalText,
    domainResults: report.domainResults,
    globalLevel: report.globalLevel,
    profileType: report.profileType,
  });
  const technicalSummary = buildTechnicalSummaryBlock({
    finalDeterministicContributionPct,
    finalAiContributionPct,
    finalRagContributionPct,
    aiDraftRagCoveragePct,
    aiDraftNarrativeGuardViolations,
    fallbackUsed: useFallback,
    narrativeGuardViolations,
  });
  const outputDir = path.join(OUTPUT_DIR, slugifyFixtureName(fixturePath));

  const meta = {
    fixturePath,
    clientCode: fixture.clientCode,
    clientName: fixture.clientName || "",
    ageMonths: fixture.ageMonths,
    totalScore: report.totalScore,
    globalLevel: report.globalLevel,
    profileType: report.profileType,
    deterministicOnly,
    aiError,
    aiLength: aiText.length,
    aiHeadings: getClinicalReportSectionHeadings(aiText || ""),
    mergedHeadings: getClinicalReportSectionHeadings(mergedAiText || ""),
    fallbackUsed: useFallback,
    fallbackReason,
    aiDraftContributionPct: aiContributionDraftPct,
    aiDraftRagCoveragePct,
    aiDraftNarrativeGuardViolations,
    finalDeterministicContributionPct,
    finalAiContributionPct,
    finalRagContributionPct,
    literatureSources: literatureSection?.sourceIds || [],
    narrativeGuardViolations,
  };

  await writeOutputs({
    outputDir,
    deterministic: deterministicText,
    aiDraft: aiText,
    mergedDraft: mergedAiText,
    final: finalText,
    technicalSummary,
    meta,
  });

  return {
    fixturePath,
    outputDir,
    clientCode: fixture.clientCode,
    clientName: fixture.clientName || "",
    ageMonths: fixture.ageMonths,
    totalScore: report.totalScore,
    globalLevel: report.globalLevel,
    profileType: report.profileType,
    aiUsed: !deterministicOnly && Boolean(aiText),
    aiError,
    fallbackUsed: useFallback,
    fallbackReason,
    finalDeterministicContributionPct,
    finalAiContributionPct,
    finalRagContributionPct,
    aiDraftRagCoveragePct,
    narrativeGuardViolations,
    finalText,
  };
}

export async function run() {
  const { fixturePath, runAll, deterministicOnly } = parseArgs(process.argv.slice(2));
  const fixturePaths = runAll ? await listFixturePaths() : [fixturePath];
  const results = [];

  for (const currentFixturePath of fixturePaths) {
    const result = await runSingleFixture(currentFixturePath, deterministicOnly);
    results.push(result);

    console.log("");
    console.log("=== SELF META FIXTURE RUN ===");
    console.log(`Fixture: ${result.fixturePath}`);
    console.log(`Danisan: ${result.clientName || "-"} | Kod: ${result.clientCode} | Yas: ${result.ageMonths} ay`);
    console.log(`Toplam Skor: ${result.totalScore} | Genel Duzey: ${result.globalLevel} | Profil: ${result.profileType}`);
    console.log(`AI Kullanildi: ${result.aiUsed ? "Evet" : deterministicOnly ? "Hayir (deterministic-only)" : "Hayir"}`);
    console.log(`Fallback: ${result.fallbackUsed ? "Evet" : "Hayir"}`);
    console.log(`Final deterministic: %${result.finalDeterministicContributionPct} | Final AI: %${result.finalAiContributionPct} | Final RAG: %${result.finalRagContributionPct} | AI draft RAG coverage: %${result.aiDraftRagCoveragePct}`);
    if (result.aiError) {
      console.log(`AI Hata: ${result.aiError}`);
    }
    console.log(`Ciktilar: ${result.outputDir}`);
    console.log("");
    console.log("=== FINAL REPORT ===");
    console.log("");
    console.log(result.finalText);
    console.log("");
  }

  if (results.length > 1) {
    console.log("=== TOPLU OZET ===");
    for (const result of results) {
      console.log(
        `- ${path.basename(result.fixturePath)} | Profil: ${result.profileType} | Final AI %${result.finalAiContributionPct} | Final RAG %${result.finalRagContributionPct} | Fallback: ${result.fallbackUsed ? "Evet" : "Hayir"}`
      );
    }
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
