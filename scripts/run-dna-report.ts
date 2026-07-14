import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

import { buildAdvancedReport, type DomainScoreMap } from "../src/lib/dna/reportEngine";
import { buildLiteratureAlignedSection } from "../src/lib/dna/literatureNote";
import { normalizeClinicalReportText } from "../src/lib/dna/reportText";
import { type AnamnezRecord } from "../src/lib/dna/anamnezUtils";
import { isSupportedAgeMonths } from "../src/lib/dna/ageUtils";
import { CLINICAL_KNOWLEDGE_CHUNKS, WORD_RAG_SOURCE } from "../src/lib/dna/clinicalKnowledgeBase";
import { sanitizeFinalReportLanguage } from "../src/lib/dna/reportLanguageQuality";
import { validateAndNormalizeClinicalReport } from "../src/lib/dna/clinicalSafetyValidator";
import { redactReportDebugMeta } from "../src/lib/dna/reportPrivacy";
import {
  getNarrativeGuardViolations,
  type NarrativeGuardViolation,
} from "../src/lib/dna/reportQuality";

export type FixturePayload = {
  clientCode: string;
  clientName?: string;
  ageMonths: number;
  anamnez: string | AnamnezRecord;
  scores: DomainScoreMap;
  answers?: number[];
};

const DEFAULT_FIXTURE_PATH = path.resolve(process.cwd(), "scripts", "fixtures", "dna-rich-case.json");
const OUTPUT_DIR = "/tmp/dna-report-output";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

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

function buildTechnicalSummaryBlock(meta: {
  deterministicKnowledgeBaseActive: boolean;
  knowledgeChunkCoverage: string;
  narrativeGuardViolations: NarrativeGuardViolation[];
  traceActive?: boolean;
  selectedAtomCount?: number;
  suppressedAtomCount?: number;
}) {
  return [
    "Teknik Uretim Ozeti (Test Amacli)",
    "- Uretim modu: %100 deterministik",
    "- Harici model cagrisi: Yok",
    `- Yerel klinik bilgi tabani: ${meta.deterministicKnowledgeBaseActive ? "Aktif" : "Pasif"}`,
    `- Yerel bilgi parcasi kapsami: ${meta.knowledgeChunkCoverage}`,
    `- Narrative guard issue sayisi: ${meta.narrativeGuardViolations.length}`,
    `- Trace: ${meta.traceActive ? "Aktif" : "Pasif"}`,
    `- Selected atoms: ${meta.selectedAtomCount ?? 0}`,
    `- Suppressed atoms: ${meta.suppressedAtomCount ?? 0}`,
  ].join("\n");
}

async function writeOutputs(payload: {
  outputDir: string;
  deterministic: string;
  final: string;
  technicalSummary: string;
  meta: Record<string, unknown>;
}) {
  await ensureOutputDir(payload.outputDir);

  await fs.writeFile(path.join(payload.outputDir, "deterministic-report.md"), payload.deterministic, "utf8");
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

export async function runSingleFixture(fixturePath: string, _deterministicOnly = true) {
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

  const literatureSection = buildLiteratureAlignedSection(report.clinicalAnalysis, {
    ageMonths: fixture.ageMonths,
    stableSeed: fixture.clientCode,
  });
  const finalSafety = validateAndNormalizeClinicalReport(
    sanitizeFinalReportLanguage(
      normalizeClinicalReportText(appendOptionalSection(report.deterministicReport, literatureSection?.text))
    )
  );
  const finalText = finalSafety.text;
  const deterministicKnowledgeBaseActive = true;
  const knowledgeChunkCoverage = `${CLINICAL_KNOWLEDGE_CHUNKS.length}/${WORD_RAG_SOURCE.sourceChunkCount}`;
  const narrativeGuardViolations = getNarrativeGuardViolations({
    text: finalText,
    domainResults: report.domainResults,
    globalLevel: report.globalLevel,
    profileType: report.profileType,
  });
  const traceActive = Boolean(report.trace?.active);
  const selectedAtomCount = report.trace?.selectedAtoms.length || 0;
  const suppressedAtomCount = report.trace?.suppressedAtoms.length || 0;
  const technicalSummary = buildTechnicalSummaryBlock({
    deterministicKnowledgeBaseActive,
    knowledgeChunkCoverage,
    narrativeGuardViolations,
    traceActive,
    selectedAtomCount,
    suppressedAtomCount,
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
    domainResults: report.domainResults,
    productionMode: "deterministic",
    externalModelUsed: false,
    deterministicKnowledgeBaseActive,
    knowledgeChunkCoverage,
    trace: report.trace,
    auditTrail: report.auditTrail,
    reportVersionMeta: report.reportVersionMeta,
    selectedAtoms: report.trace?.selectedAtoms || [],
    suppressedAtoms: report.trace?.suppressedAtoms || [],
    triggeredRules: report.trace?.ruleHits || [],
    traceValidationIssues: report.trace?.validationIssues || [],
    literatureSources: literatureSection?.sourceIds || [],
    narrativeGuardViolations,
    clinicalSafetyIssues: finalSafety.issues,
    clinicalSafetyCriticalIssues: finalSafety.criticalIssues,
  };

  await writeOutputs({
    outputDir,
    deterministic: finalText,
    final: finalText,
    technicalSummary,
    meta: redactReportDebugMeta(meta),
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
    domainResults: report.domainResults,
    sourceExternalClinicalFindings:
      typeof fixture.anamnez === "object" && fixture.anamnez !== null
        ? String((fixture.anamnez as Record<string, unknown>).external_clinical_findings || "")
        : String(fixture.anamnez || ""),
    productionMode: "deterministic" as const,
    externalModelUsed: false,
    deterministicKnowledgeBaseActive,
    knowledgeChunkCoverage,
    narrativeGuardViolations,
    trace: report.trace,
    auditTrail: report.auditTrail,
    reportVersionMeta: report.reportVersionMeta,
    finalText,
  };
}

export async function run() {
  const { fixturePath, runAll } = parseArgs(process.argv.slice(2));
  const fixturePaths = runAll ? await listFixturePaths() : [fixturePath];
  const printReportText = String(process.env.DNA_PRINT_REPORT_OUTPUT || "").toLowerCase() === "true";
  const results = [];

  for (const currentFixturePath of fixturePaths) {
    const result = await runSingleFixture(currentFixturePath);
    results.push(result);

    console.log("");
    console.log("=== DNA INTELLIGENCE FIXTURE RUN ===");
    console.log(`Fixture: ${result.fixturePath}`);
    console.log(`Danisan: ${result.clientName || "-"} | Kod: ${result.clientCode} | Yas: ${result.ageMonths} ay`);
    console.log(`Toplam Skor: ${result.totalScore} | Genel Duzey: ${result.globalLevel} | Profil: ${result.profileType}`);
    console.log("Uretim modu: %100 deterministik | Harici model cagrisi: Yok");
    console.log(`Trace: ${result.trace?.active ? "Aktif" : "Pasif"} | Selected atoms: ${result.trace?.selectedAtoms.length || 0} | Suppressed atoms: ${result.trace?.suppressedAtoms.length || 0}`);
    console.log(`Ciktilar: ${result.outputDir}`);
    if (printReportText) {
      console.log("");
      console.log("=== FINAL REPORT ===");
      console.log("");
      console.log(result.finalText);
      console.log("");
    }
  }

  if (results.length > 1) {
    console.log("=== TOPLU OZET ===");
    for (const result of results) {
      console.log(
        `- ${path.basename(result.fixturePath)} | Profil: ${result.profileType} | %100 deterministik`
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
