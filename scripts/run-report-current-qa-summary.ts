import fs from "node:fs/promises";
import path from "node:path";

import { listFixturePaths } from "./run-dna-report";

const FIXTURE_OUTPUT_ROOT = "/tmp/dna-report-output";
const LANGUAGE_QA_ROOT = "/tmp/dna-language-qa-100";
const EXTREME_QA_ROOT = "/tmp/dna-extreme-complex-qa-100";
const SUMMARY_PATH = "/tmp/dna-current-qa-summary.md";

const FORBIDDEN_VISIBLE_PATTERNS: Array<[string, RegExp]> = [
  ["treatment_word", /\b(?:tedavi|müdahale|terapi|seans|ilaç|danışmanlık|destek planı|uygulama yönergesi)\b/i],
  ["directive_modal_language", /\b(?:yapılmalıdır|uygulanmalıdır|başlanmalıdır|gerekir)\b/i],
  ["practice_plan_language", /\b(?:program|protokol|egzersiz listesi|ödev|seans akışı)\b/i],
  ["diagnostic_semantic_language", /\b(?:tanı ile uyumlu|belirtisidir|semptom|bozukluk|patoloji)\b/i],
  ["causal_certainty_claim", /\b(?:kesin olarak|kesin neden(?!-sonuç)|neden olur|doğrudan neden|tek başına gösterir|açıkça gösterir|kanıtlar nitelikte|kanıtlamaktadır|kanıtlanmıştır|kanıtladı)\b/i],
  ["automation_claim", /\b(?:otomatik klinik karar|klinik kararı verir|karar yerine geçer|uzman değerlendirmesi yerine geçer)\b/i],
  ["technical_scale_word", /\b(?:madde düzeyi|anket maddesi|yanıt dizisi|soru numarası)\b/i],
  ["visible_item_token", /\bITEM\b/],
  ["legacy_watch_range", /watch range/i],
  ["awkward_caregiver_intro", /Aile tarafından\s+evde/i],
  ["internal_underscore_id", /\b(?:language_social_pragmatic|language_communication|social_pragmatic|adaptive_daily_living|motor_praxis|physiological_interoceptive|evidence_limited_mixed)\b/],
];

function slugifyFixtureName(input: string): string {
  return path
    .basename(input, ".json")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeReadText(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function listCaseReportPaths(root: string, childDir = ""): Promise<string[]> {
  const base = childDir ? path.join(root, childDir) : root;
  if (!(await fileExists(base))) return [];
  const entries = await fs.readdir(base, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && /^case-\d+$/i.test(entry.name))
    .map((entry) => path.join(base, entry.name, "final-report.md"));
}

async function getCurrentReportPaths(): Promise<Array<{ group: string; filePath: string }>> {
  const fixturePaths = await listFixturePaths();
  const fixtureReports = fixturePaths.map((fixturePath) => ({
    group: "fixture",
    filePath: path.join(FIXTURE_OUTPUT_ROOT, slugifyFixtureName(fixturePath), "final-report.md"),
  }));

  const languageReports = (await listCaseReportPaths(LANGUAGE_QA_ROOT)).map((filePath) => ({
    group: "language-qa",
    filePath,
  }));

  const extremeReports = (await listCaseReportPaths(EXTREME_QA_ROOT, "cases")).map((filePath) => ({
    group: "extreme-qa",
    filePath,
  }));

  return [...fixtureReports, ...languageReports, ...extremeReports];
}

async function run() {
  const reportPaths = await getCurrentReportPaths();
  const missing = [];
  const issues = [];
  let scanned = 0;

  for (const report of reportPaths) {
    const text = await safeReadText(report.filePath);
    if (!text) {
      missing.push(report);
      continue;
    }

    scanned += 1;
    for (const [code, pattern] of FORBIDDEN_VISIBLE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        issues.push({
          group: report.group,
          filePath: report.filePath,
          code,
          evidence: match[0],
        });
      }
    }
  }

  const issueCounts = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.code] = (acc[issue.code] || 0) + 1;
    return acc;
  }, {});

  const summary = [
    "# DNA Current Scoped QA Summary",
    "",
    `- Fixture output root: ${FIXTURE_OUTPUT_ROOT}`,
    `- Language QA root: ${LANGUAGE_QA_ROOT}`,
    `- Extreme QA root: ${EXTREME_QA_ROOT}`,
    `- Beklenen rapor girdisi: ${reportPaths.length}`,
    `- Taranan görünür rapor: ${scanned}`,
    `- Eksik güncel rapor: ${missing.length}`,
    `- Görünür kalıp sorunu: ${issues.length}`,
    "",
    "## Sorun Dağılımı",
    "",
    ...(Object.keys(issueCounts).length
      ? Object.entries(issueCounts).map(([code, count]) => `- ${code}: ${count}`)
      : ["- Yok"]),
    "",
    "## İlk Örnekler",
    "",
    ...(issues.length
      ? issues.slice(0, 20).map((issue) => `- ${issue.group}: ${issue.code} | ${issue.evidence} | ${issue.filePath}`)
      : ["- Yok"]),
  ].join("\n");

  await fs.writeFile(SUMMARY_PATH, summary, "utf8");

  console.log("=== DNA CURRENT SCOPED QA SUMMARY ===");
  console.log(`Taranan gorunur rapor: ${scanned}`);
  console.log(`Eksik guncel rapor: ${missing.length}`);
  console.log(`Gorunur kalip sorunu: ${issues.length}`);
  console.log(`Ozet: ${SUMMARY_PATH}`);

  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
