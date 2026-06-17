import path from "node:path";

export type QualityCaseMode = "balanced" | "selective" | "paired" | "widespread";

export type QualityCaseSpec = {
  key: string;
  fixturePath: string;
  mode: QualityCaseMode;
  expectedGlobalLevel: "Tipik" | "Riskli" | "Atipik";
  expectedProfileIncludes: string[];
  requiredPhrases?: string[];
  forbiddenPhrases?: string[];
  requireAgeMismatchWarning?: boolean;
  minLiteratureParagraphs?: number;
  minApaReferences?: number;
  expectedAiMinContributionPct?: number;
};

function fixture(name: string): string {
  return path.resolve(process.cwd(), "scripts", "fixtures", name);
}

export const QUALITY_CASE_SPECS: QualityCaseSpec[] = [
  {
    key: "fully-typical",
    fixturePath: fixture("selfmeta-fully-typical-development.json"),
    mode: "balanced",
    expectedGlobalLevel: "Tipik",
    expectedProfileIncludes: ["Dengeli / Korunmuş Profil"],
    forbiddenPhrases: ["birincil kırılgan alan", "yaygın regülasyon yükü", "yüksek klinik yük"],
    minLiteratureParagraphs: 3,
    minApaReferences: 3,
  },
  {
    key: "selective-interoception",
    fixturePath: fixture("selfmeta-global-typical-selective-interoception.json"),
    mode: "selective",
    expectedGlobalLevel: "Tipik",
    expectedProfileIncludes: ["İnterosepsiyon", "Seçici"],
    requiredPhrases: ["seçici"],
    forbiddenPhrases: ["yaygın regülasyon yükü"],
    minLiteratureParagraphs: 3,
    minApaReferences: 3,
    expectedAiMinContributionPct: 35,
  },
  {
    key: "paired-sensory-emotional",
    fixturePath: fixture("selfmeta-dual-sensory-emotional-overload.json"),
    mode: "paired",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Duyusal-Duygusal"],
    requiredPhrases: ["Duyusal Regülasyon", "Duygusal Regülasyon"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
    expectedAiMinContributionPct: 35,
  },
  {
    key: "widespread-executive",
    fixturePath: fixture("selfmeta-adhd-executive-load.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Yürütücü-Duygusal", "Yükü"],
    forbiddenPhrases: ["seçici bir kırılganlık"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
    expectedAiMinContributionPct: 35,
  },
  {
    key: "widespread-adaptive",
    fixturePath: fixture("selfmeta-adaptive-daily-living.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Fizyolojik Toparlanma", "Yükü"],
    forbiddenPhrases: ["seçici bir kırılganlık"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "age-mismatch-warning",
    fixturePath: fixture("selfmeta-age-mismatch-warning.json"),
    mode: "selective",
    expectedGlobalLevel: "Tipik",
    expectedProfileIncludes: ["Yürütücü İşlev", "Seçici"],
    requireAgeMismatchWarning: true,
    requiredPhrases: ["ana klinik karar mekanizmasına dahil edilmemeli"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "item-linkage",
    fixturePath: fixture("selfmeta-item-level-linkage.json"),
    mode: "paired",
    expectedGlobalLevel: "Atipik",
    expectedProfileIncludes: ["Duyusal"],
    requiredPhrases: ["Anamnezle en güçlü örtüşen maddeler", "Madde düzeyinde dikkat çeken bulgular"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "motor-praxis-supported",
    fixturePath: fixture("selfmeta-new-06-somatodyspraxia-motor-planning.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Praksi", "Motor Planlama", "Yükü"],
    requiredPhrases: ["motor planlama", "görev"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "multi-test-single-axis",
    fixturePath: fixture("selfmeta-language-pragmatic-load.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Dilsel", "Sosyal-Pragmatik", "Yükü"],
    requiredPhrases: ["dilsel", "sosyal"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-tscore-briefp",
    fixturePath: fixture("selfmeta-format-briefp-tscore-clinical.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Yürütücü", "Yükü"],
    requiredPhrases: ["T skoru", "Ek Test Kanıt Profili"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-percentile-adaptive",
    fixturePath: fixture("selfmeta-format-pedicat-percentile-adaptive.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Günlük Yaşam", "Öz Bakım", "Yükü"],
    requiredPhrases: ["percentil", "PEDI-CAT", "Ek Test Kanıt Profili"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-standard-score-motor",
    fixturePath: fixture("selfmeta-format-pdms3-standard-score-motor.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Motor", "Regülasyon Yükü"],
    requiredPhrases: ["standart skoru", "PDMS-3", "motor planlama"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-age-equivalent-language",
    fixturePath: fixture("selfmeta-format-pls-age-equivalent-language.json"),
    mode: "paired",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Dilsel", "Yükü"],
    requiredPhrases: ["yas esdegeri", "PLS-5", "sözel talep"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-preserved-adaptive",
    fixturePath: fixture("selfmeta-format-preserved-vineland-abas.json"),
    mode: "balanced",
    expectedGlobalLevel: "Tipik",
    expectedProfileIncludes: ["Dengeli / Korunmuş Profil"],
    requiredPhrases: ["korunmuş", "Vineland-3", "ABAS-3"],
    forbiddenPhrases: ["yüksek klinik yük", "yaygın regülasyon yükü"],
    minLiteratureParagraphs: 3,
    minApaReferences: 3,
  },
  {
    key: "format-mixed-language-social",
    fixturePath: fixture("selfmeta-format-mixed-multi-test.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Dilsel", "Sosyal-Pragmatik", "Yükü"],
    requiredPhrases: ["standart skoru", "T skoru", "scaled score"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
];
