import fs from "node:fs/promises";
import path from "node:path";

import { listFixturePaths, runSingleFixture, type FixturePayload } from "./run-dna-report";
import { analyzeReportLanguageQuality } from "../src/lib/dna/reportLanguageQuality";

const OUTPUT_DIR = "/tmp/dna-language-qa-100";
const CASE_COUNT = 100;

function clampScore(value: number): number {
  return Math.max(10, Math.min(50, Math.round(value)));
}

async function ensureCleanDir(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

function mutateScores(scores: FixturePayload["scores"], index: number): FixturePayload["scores"] {
  const delta = ((index % 5) - 2) * 2;
  const mutated: FixturePayload["scores"] = {};
  for (const [key, value] of Object.entries(scores || {})) {
    mutated[key] = clampScore(Number(value) + delta + (key.length % 3) - 1);
  }
  return mutated;
}

function mutateAnswers(answers: number[] | undefined, index: number): number[] | undefined {
  if (!Array.isArray(answers) || answers.length !== 60) return answers;
  return answers.map((answer, answerIndex) => {
    if ((answerIndex + index) % 17 !== 0) return answer;
    return Math.max(1, Math.min(5, Number(answer) + (index % 2 === 0 ? -1 : 1)));
  });
}

function mutateFixture(base: FixturePayload, index: number): FixturePayload {
  return {
    ...base,
    clientCode: `LANG-QA-${String(index + 1).padStart(3, "0")}`,
    clientName: `Dil QA Vaka ${String(index + 1).padStart(3, "0")}`,
    scores: mutateScores(base.scores, index),
    answers: mutateAnswers(base.answers, index),
  };
}

async function buildCaseFixtures(): Promise<string[]> {
  const fixturePaths = await listFixturePaths();
  const generatedDir = path.join(OUTPUT_DIR, "fixtures");
  await fs.mkdir(generatedDir, { recursive: true });

  const generatedPaths: string[] = [];
  for (let index = 0; index < CASE_COUNT; index += 1) {
    const sourcePath = fixturePaths[index % fixturePaths.length];
    const raw = await fs.readFile(sourcePath, "utf8");
    const base = JSON.parse(raw) as FixturePayload;
    const generated = mutateFixture(base, index);
    const target = path.join(generatedDir, `dna-language-qa-${String(index + 1).padStart(3, "0")}.json`);
    await fs.writeFile(target, JSON.stringify(generated, null, 2), "utf8");
    generatedPaths.push(target);
  }
  return generatedPaths;
}

async function copyReportOutputs(sourceOutputDir: string, targetDir: string) {
  await fs.mkdir(targetDir, { recursive: true });
  for (const fileName of ["final-report.md", "report-meta.json", "report-with-metrics.md"]) {
    const source = path.join(sourceOutputDir, fileName);
    const target = path.join(targetDir, fileName === "report-meta.json" ? "language-meta.json" : fileName);
    await fs.copyFile(source, target).catch(() => undefined);
  }
}

async function run() {
  await ensureCleanDir(OUTPUT_DIR);
  const generatedFixtures = await buildCaseFixtures();
  const results = [];

  for (let index = 0; index < generatedFixtures.length; index += 1) {
    const fixturePath = generatedFixtures[index];
    const result = await runSingleFixture(fixturePath, true);
    const language = analyzeReportLanguageQuality(result.finalText);
    const caseDir = path.join(OUTPUT_DIR, `case-${String(index + 1).padStart(3, "0")}`);
    await copyReportOutputs(result.outputDir, caseDir);
    await fs.writeFile(path.join(caseDir, "language-score.json"), JSON.stringify(language, null, 2), "utf8");

    results.push({
      caseNo: index + 1,
      fixturePath,
      profileType: result.profileType,
      globalLevel: result.globalLevel,
      score: language.score,
      classification: language.classification,
      issueCodes: language.issues.map((issue) => issue.code),
      highIssueCodes: language.issues.filter((issue) => issue.severity === "high").map((issue) => issue.code),
      outputDir: caseDir,
    });
  }

  const averageScore =
    Math.round((results.reduce((sum, result) => sum + result.score, 0) / Math.max(results.length, 1)) * 10) / 10;
  const problemCases = results.filter((result) => result.classification === "problem" || result.highIssueCodes.length > 0);
  const needsReviewCases = results.filter((result) => result.classification === "needs_review" && result.highIssueCodes.length === 0);

  const summary = [
    "# DNA Intelligence 100 Vaka Dil Akıcılığı QA",
    "",
    `- Vaka sayısı: ${results.length}`,
    `- Ortalama dil skoru: ${averageScore}/100`,
    `- Strong: ${results.filter((result) => result.classification === "strong").length}`,
    `- Needs review: ${needsReviewCases.length}`,
    `- Problem/kötü: ${problemCases.length}`,
    "",
    "## Sorunlu Vakalar",
    "",
    ...(problemCases.length
      ? problemCases.map((result) => `- ${result.caseNo}: ${result.profileType} | skor ${result.score} | ${result.highIssueCodes.join(", ") || result.issueCodes.join(", ")}`)
      : ["- Yok"]),
    "",
    "## İnceleme Gerektiren Vakalar",
    "",
    ...(needsReviewCases.length
      ? needsReviewCases.slice(0, 20).map((result) => `- ${result.caseNo}: ${result.profileType} | skor ${result.score} | ${result.issueCodes.join(", ") || "minor"}`)
      : ["- Yok"]),
  ].join("\n");

  await fs.writeFile(path.join(OUTPUT_DIR, "language-qa-summary.md"), summary, "utf8");
  await fs.writeFile(path.join(OUTPUT_DIR, "language-qa-results.json"), JSON.stringify({ averageScore, results }, null, 2), "utf8");

  console.log("=== DNA LANGUAGE QA 100 ===");
  console.log(`Vaka sayisi: ${results.length}`);
  console.log(`Ortalama dil skoru: ${averageScore}/100`);
  console.log(`Problem/kotu vaka: ${problemCases.length}`);
  console.log(`Ozet: ${path.join(OUTPUT_DIR, "language-qa-summary.md")}`);

  if (averageScore < 92 || problemCases.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
