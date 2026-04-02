import fs from "node:fs/promises";
import path from "node:path";

import { listFixturePaths, runSingleFixture, type FixturePayload } from "./run-selfmeta-report";
import { extractExternalClinicalFindings, getAnamnezThemeSignals, type AnamnezRecord } from "../src/lib/selfmeta/anamnezUtils";
import { analyzeExternalClinicalTests } from "../src/lib/selfmeta/externalTestRegistry";
import { splitClinicalReportSections } from "../src/lib/selfmeta/reportText";

const OUTPUT_DIR = "/tmp/selfmeta-report-output/deterministic-audit";

type AuditIssueCode =
  | "profile_generic_name"
  | "profile_category_mismatch"
  | "motor_praxis_underweighted"
  | "adaptive_daily_living_underweighted"
  | "language_communication_underweighted"
  | "social_pragmatic_underweighted"
  | "age_mismatch_warning_weak"
  | "sensory_theme_leakage"
  | "attention_theme_leakage"
  | "intero_overweighted"
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
  age_mismatch_warning_weak: "Yaş uyumsuz dış test uyarısı zayıf",
  sensory_theme_leakage: "Duyusal tema sızıntısı var",
  attention_theme_leakage: "Dikkat/görev sürdürme tema sızıntısı var",
  intero_overweighted: "İnterosepsiyon gereğinden fazla ağırlık alıyor",
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
  return {
    domains: String(sections.get("3. Alan Bazlı Klinik Yorum") || ""),
    pattern: String(sections.get("4. Örüntü Analizi") || ""),
    fit: String(sections.get("5. Anamnez – Test Uyum Değerlendirmesi") || ""),
    conclusion: String(sections.get("6. Kısa Sonuç") || ""),
    literature: String(sections.get("7. Literatürle Uyumlu Klinik Not") || ""),
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
  anamnezRecord: AnamnezRecord;
  ageMonths: number;
  narrativeGuardCount: number;
}) {
  const issueCodes: AuditIssueCode[] = [];
  const normalizedProfile = normalizeText(params.profileType);
  const normalizedReport = normalizeText(params.finalText);
  const sectionBodies = getSectionBodies(params.finalText);
  const coreText = normalizeText(
    [sectionBodies.domains, sectionBodies.pattern, sectionBodies.fit, sectionBodies.conclusion].join("\n")
  );
  const interoFocusText = normalizeText([sectionBodies.pattern, sectionBodies.fit, sectionBodies.conclusion].join("\n"));
  const anamnezSignals = getAnamnezThemeSignals(params.anamnezRecord);
  const externalText = extractExternalClinicalFindings(params.anamnezRecord).join("\n");
  const externalAnalysis = analyzeExternalClinicalTests(externalText, params.ageMonths);
  const compatibleCategories = new Set(externalAnalysis.compatibleCategories);
  const primaryCategory = externalAnalysis.primaryCompatibleCategory;
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
        compatibleCategories.has("adaptive_daily_living") &&
        hasAny(normalizedProfile, [/interosepsiyon/, /fizyolojik/, /beden temelli/])) ||
      (primaryCategory === "language_communication" &&
        compatibleCategories.has("social_pragmatic") &&
        profileMentionsCategory(normalizedProfile, "social_pragmatic")) ||
      (primaryCategory === "social_pragmatic" &&
        compatibleCategories.has("language_communication") &&
        profileMentionsCategory(normalizedProfile, "language_communication"));

    if (!primaryAligned && !contextualOverride) {
      issueCodes.push("profile_category_mismatch");
    }
  }

  if (compatibleCategories.has("motor_praxis")) {
    if (!hasAny(coreText, [/praksi/, /motor plan/, /beden organiz/, /sekans/, /giyin/, /iki taraflı/, /koordinasyon/])) {
      issueCodes.push("motor_praxis_underweighted");
    }
  }

  if (compatibleCategories.has("adaptive_daily_living")) {
    if (!hasAny(coreText, [/öz bakım/, /günlük yaşam/, /rutin/, /tuvalet/, /giyin/, /katılım/, /başlatma/, /tamamlama/])) {
      issueCodes.push("adaptive_daily_living_underweighted");
    }
  }

  if (compatibleCategories.has("language_communication")) {
    if (!hasAny(coreText, [/dil/, /yönerge/, /sözel/, /anlama/, /ifade/])) {
      issueCodes.push("language_communication_underweighted");
    }
  }

  if (compatibleCategories.has("social_pragmatic")) {
    if (!hasAny(coreText, [/sosyal/, /pragmatik/, /karşılıklılık/, /etkileşim/, /akran/])) {
      issueCodes.push("social_pragmatic_underweighted");
    }
  }

  if (externalAnalysis.incompatible.length > 0) {
    if (!/ana klinik karar mekanizmasına dahil edilmemeli/i.test(sectionBodies.fit)) {
      issueCodes.push("age_mismatch_warning_weak");
    }
  }

  if (!anamnezSignals.sensory && hasAny(normalizedReport, [/duyusal yüklenme/, /çevresel ve dokunsal hassasiyet/, /duyusal hassasiyet/])) {
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
    !compatibleCategories.has("adaptive_daily_living") &&
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

  return {
    issueCodes: Array.from(new Set(issueCodes)),
    compatibleCategories: Array.from(compatibleCategories),
    incompatibleCount: externalAnalysis.incompatible.length,
  };
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
    "# Self Meta Deterministic Audit",
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
  const fixturePaths = await listFixturePaths();
  const results: FixtureAudit[] = [];

  for (const fixturePath of fixturePaths) {
    const fixture = await loadFixture(fixturePath);
    const result = await runSingleFixture(fixturePath, true);
    const anamnezRecord = toAnamnezRecord(fixture.anamnez);
    const issueResult = getIssueCodes({
      profileType: result.profileType,
      finalText: result.finalText,
      anamnezRecord,
      ageMonths: fixture.ageMonths,
      narrativeGuardCount: result.narrativeGuardViolations.length,
    });

    results.push({
      fixture: fixturePath,
      clientCode: result.clientCode,
      ageMonths: fixture.ageMonths,
      profileType: result.profileType,
      globalLevel: result.globalLevel,
      issueCodes: issueResult.issueCodes,
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
