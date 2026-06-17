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
    fixturePath: fixture("dna-fully-typical-development.json"),
    mode: "balanced",
    expectedGlobalLevel: "Tipik",
    expectedProfileIncludes: ["Dengeli / Korunmuş Profil"],
    forbiddenPhrases: ["birincil kırılgan alan", "yaygın regülasyon yükü", "yüksek klinik yük"],
    minLiteratureParagraphs: 3,
    minApaReferences: 3,
  },
  {
    key: "selective-interoception",
    fixturePath: fixture("dna-global-typical-selective-interoception.json"),
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
    fixturePath: fixture("dna-dual-sensory-emotional-overload.json"),
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
    fixturePath: fixture("dna-adhd-executive-load.json"),
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
    fixturePath: fixture("dna-adaptive-daily-living.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Fizyolojik Toparlanma", "Yükü"],
    forbiddenPhrases: ["seçici bir kırılganlık"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "age-mismatch-warning",
    fixturePath: fixture("dna-age-mismatch-warning.json"),
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
    fixturePath: fixture("dna-item-level-linkage.json"),
    mode: "paired",
    expectedGlobalLevel: "Atipik",
    expectedProfileIncludes: ["Duyusal"],
    requiredPhrases: ["Ölçek içi mikro-kanıt", "işitsel uyaran yükü"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "motor-praxis-supported",
    fixturePath: fixture("dna-new-06-somatodyspraxia-motor-planning.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Praksi", "Motor Planlama", "Yükü"],
    requiredPhrases: ["motor planlama", "görev"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "multi-test-single-axis",
    fixturePath: fixture("dna-language-pragmatic-load.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Dilsel", "Sosyal-Pragmatik", "Yükü"],
    requiredPhrases: ["dilsel", "sosyal"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-tscore-briefp",
    fixturePath: fixture("dna-format-briefp-tscore-clinical.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Yürütücü", "Yükü"],
    requiredPhrases: ["T skoru", "Ek Test Kanıt Profili"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-percentile-adaptive",
    fixturePath: fixture("dna-format-pedicat-percentile-adaptive.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Günlük Yaşam", "Öz Bakım", "Yükü"],
    requiredPhrases: ["percentil", "PEDI-CAT", "Ek Test Kanıt Profili"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-standard-score-motor",
    fixturePath: fixture("dna-format-pdms3-standard-score-motor.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Motor", "Regülasyon Yükü"],
    requiredPhrases: ["standart skoru", "PDMS-3", "motor planlama"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-age-equivalent-language",
    fixturePath: fixture("dna-format-pls-age-equivalent-language.json"),
    mode: "paired",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Dilsel", "Yükü"],
    requiredPhrases: ["yaş eşdeğeri", "PLS-5", "sözel talep"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-preserved-adaptive",
    fixturePath: fixture("dna-format-preserved-vineland-abas.json"),
    mode: "balanced",
    expectedGlobalLevel: "Tipik",
    expectedProfileIncludes: ["Dengeli / Korunmuş Profil"],
    requiredPhrases: ["korunmuş", "Vineland-3", "ABAS-3"],
    forbiddenPhrases: ["yüksek klinik yük", "yaygın regülasyon yükü"],
    minLiteratureParagraphs: 3,
    minApaReferences: 3,
  },
  {
    key: "evidence-limited-mixed-raw-preserved",
    fixturePath: fixture("dna-evidence-limited-mixed-raw-preserved.json"),
    mode: "paired",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Geçiş", "Ko-Regülasyon"],
    requiredPhrases: [
      "kanıt-sınırlı",
      "Aileden gelen bilgiye göre",
      "Terapist gözleminde",
      "Ham puan tek başına yorum gücünü sınırlar",
      "Korunmuş/yaş uyumlu sonuç"
    ],
    forbiddenPhrases: ["Beden-temelli toparlanma ve interoseptif düzenleme yükü", "Günlük yaşam ve öz bakım akışını sürdürme yükü"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
  {
    key: "format-mixed-language-social",
    fixturePath: fixture("dna-format-mixed-multi-test.json"),
    mode: "widespread",
    expectedGlobalLevel: "Riskli",
    expectedProfileIncludes: ["Dilsel", "Sosyal-Pragmatik", "Yükü"],
    requiredPhrases: ["standart skoru", "T skoru", "scaled score"],
    minLiteratureParagraphs: 3,
    minApaReferences: 4,
  },
];
