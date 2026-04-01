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
    requiredPhrases: ["seçici bir kırılganlık"],
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
    expectedProfileIncludes: ["Yürütücü İşlev", "Yükü"],
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
    expectedProfileIncludes: ["Yürütücü İşlev", "Yükü"],
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
];
