export type ResearchCategoryKey =
  | "interosepsiyon"
  | "duyusal-regulasyon"
  | "duygusal-regulasyon"
  | "yurutucu-islevler"
  | "gelisim-ve-baglam"
  | "olcum-ve-metodoloji";

export type ResearchStudyType =
  | "meta_analysis"
  | "systematic_review"
  | "scoping_review"
  | "longitudinal"
  | "observational"
  | "review";

export type ResearchNote = {
  id: string;
  title: string;
  category: ResearchCategoryKey;
  categoryLabel: string;
  studyType: ResearchStudyType;
  studyTypeLabel: string;
  year: number;
  ageScope: string | null;
  clinicalFocus: string;
  interpretationBoundary: string;
  inlineCitation: string;
  apaReference: string;
  doi: string | null;
  pmid: string | null;
  sourceUrl: string;
  verifiedAt: string;
};

export const RESEARCH_CATEGORY_LABELS: Record<ResearchCategoryKey, string> = {
  interosepsiyon: "İnterosepsiyon",
  "duyusal-regulasyon": "Duyusal Regülasyon",
  "duygusal-regulasyon": "Duygusal Regülasyon",
  "yurutucu-islevler": "Yürütücü İşlevler",
  "gelisim-ve-baglam": "Gelişim ve Bağlam",
  "olcum-ve-metodoloji": "Ölçüm ve Metodoloji",
};

export const RESEARCH_STUDY_TYPE_LABELS: Record<ResearchStudyType, string> = {
  meta_analysis: "Meta-analiz",
  systematic_review: "Sistematik derleme",
  scoping_review: "Kapsam derlemesi",
  longitudinal: "Boylamsal çalışma",
  observational: "Gözlemsel çalışma",
  review: "Derleme",
};
