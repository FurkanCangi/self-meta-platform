import {
  VERIFIED_LITERATURE_SOURCES,
  type LiteratureSource,
} from "../../lib/dna/literatureNote";
import {
  RESEARCH_CATEGORY_LABELS,
  RESEARCH_STUDY_TYPE_LABELS,
  type ResearchCategoryKey,
  type ResearchNote,
  type ResearchStudyType,
} from "./researchNotesTypes";

type NoteSpec = {
  sourceId: string;
  title: string;
  category: ResearchCategoryKey;
  studyType?: ResearchStudyType;
};

const NOTE_SPECS: NoteSpec[] = [
  {
    sourceId: "MAYER_BENAROUS_ET_AL_2025",
    title: "Gençlerde interosepsiyon profilleri ve ruh sağlığı",
    category: "interosepsiyon",
  },
  {
    sourceId: "CLARK_ET_AL_2025",
    title: "Pediatrik ergoterapide interosepsiyon uygulamaları",
    category: "interosepsiyon",
    studyType: "scoping_review",
  },
  {
    sourceId: "PINNA_EDWARDS_2020",
    title: "İnterosepsiyon, vagal tonus ve duygu düzenleme ilişkisi",
    category: "interosepsiyon",
    studyType: "systematic_review",
  },
  {
    sourceId: "PILLER_ET_AL_2025",
    title: "Çocuk ve gençlerde duyusal temelli müdahaleler",
    category: "duyusal-regulasyon",
  },
  {
    sourceId: "SHAHBAZI_MIRZAKHANI_2021",
    title: "Çocuklarda duyusal işlemleme değerlendirmesi",
    category: "duyusal-regulasyon",
  },
  {
    sourceId: "CARPENTER_ET_AL_2019",
    title: "Küçük çocuklarda duyusal aşırı yanıtlılık",
    category: "duyusal-regulasyon",
    studyType: "observational",
  },
  {
    sourceId: "BEN_SASSON_ET_AL_2009",
    title: "Otizm spektrumunda duyusal modülasyon belirtileri",
    category: "duyusal-regulasyon",
    studyType: "meta_analysis",
  },
  {
    sourceId: "CASE_SMITH_ET_AL_2015",
    title: "Otizmli çocuklarda duyusal işlemleme müdahaleleri",
    category: "duyusal-regulasyon",
    studyType: "systematic_review",
  },
  {
    sourceId: "FREITAG_ET_AL_2023",
    title: "Çocuk ve ergenlerde duygu düzensizliğinin anketle ölçümü",
    category: "duygusal-regulasyon",
  },
  {
    sourceId: "RESTOY_ET_AL_2024",
    title: "Otizmde duygu düzenleme ve duygu düzensizliği",
    category: "duygusal-regulasyon",
  },
  {
    sourceId: "URBEN_ET_AL_2025",
    title: "İrritabilite ve öz düzenleyici kontrol süreçleri",
    category: "duygusal-regulasyon",
  },
  {
    sourceId: "LIANG_ET_AL_2025",
    title: "Okul öncesinde duygu düzenleme ve akran kabulü",
    category: "duygusal-regulasyon",
  },
  {
    sourceId: "DE_RAEYMAECKER_DHAR_2022",
    title: "Orta çocuklukta ebeveynlerin duygu düzenlemeye etkisi",
    category: "duygusal-regulasyon",
  },
  {
    sourceId: "STUCKE_DOEBEL_2024",
    title: "Erken çocukluk yürütücü işlevleri ve sosyal-davranışsal sonuçlar",
    category: "yurutucu-islevler",
  },
  {
    sourceId: "SILVA_ET_AL_2022",
    title: "Okul öncesi yürütücü işlev değerlendirmesi",
    category: "yurutucu-islevler",
  },
  {
    sourceId: "BAO_ET_AL_2024",
    title: "Motor yeterlik ve yürütücü işlev ilişkisi",
    category: "yurutucu-islevler",
  },
  {
    sourceId: "SCIONTI_ET_AL_2023",
    title: "Çocuklukta anlatı becerileri ve yürütücü işlevler",
    category: "yurutucu-islevler",
  },
  {
    sourceId: "FOGEL_ET_AL_2023",
    title: "Gelişimsel koordinasyon bozukluğunda motor beceri ve yürütücü işlevler",
    category: "yurutucu-islevler",
    studyType: "systematic_review",
  },
  {
    sourceId: "LI_ET_AL_2026",
    title: "Temel motor beceri müdahaleleri ve yürütücü işlevler",
    category: "yurutucu-islevler",
  },
  {
    sourceId: "MASEK_ET_AL_2023",
    title: "Erken iletişim etkileşimleri ve okul öncesi yürütücü işlevler",
    category: "gelisim-ve-baglam",
  },
  {
    sourceId: "ROMEO_ET_AL_2022",
    title: "Okul öncesinde dil ve yürütücü işlev gelişimi",
    category: "gelisim-ve-baglam",
  },
  {
    sourceId: "SANKALAITE_ET_AL_2021",
    title: "Öğretmen-çocuk etkileşimi, yürütücü işlev ve öz düzenleme",
    category: "gelisim-ve-baglam",
  },
  {
    sourceId: "VERHAGEN_ET_AL_2024",
    title: "Ebeveyn-çocuk ko-regülasyonu ve çocuk sonuçları",
    category: "gelisim-ve-baglam",
  },
  {
    sourceId: "CHEN_ET_AL_2024",
    title: "Çocuklarda öz düzenleme ölçüm araçları",
    category: "olcum-ve-metodoloji",
  },
];

function getPublicationYear(source: LiteratureSource): number {
  if (source.publicationYear) return source.publicationYear;
  const match = source.apaReference.match(/\((19|20)\d{2}\)/);
  if (!match) {
    throw new Error(`Research note source ${source.id} has no publication year.`);
  }
  return Number(match[0].slice(1, -1));
}

function getStudyType(spec: NoteSpec, source: LiteratureSource): ResearchStudyType {
  const studyType = spec.studyType ?? source.studyType;
  if (!studyType || !(studyType in RESEARCH_STUDY_TYPE_LABELS)) {
    throw new Error(`Research note source ${source.id} has no supported study type.`);
  }
  return studyType as ResearchStudyType;
}

function splitClaimBoundary(claimBoundary: string) {
  const separatorIndex = claimBoundary.indexOf(";");
  if (separatorIndex === -1) {
    return {
      clinicalFocus: claimBoundary,
      interpretationBoundary: "Bu yayın tek başına bireysel tanı, nedensellik veya müdahale protokolü oluşturmaz.",
    };
  }

  return {
    clinicalFocus: claimBoundary.slice(0, separatorIndex).trim(),
    interpretationBoundary: claimBoundary.slice(separatorIndex + 1).trim(),
  };
}

export function getResearchNotes(): ResearchNote[] {
  return NOTE_SPECS.map((spec) => {
    const source = VERIFIED_LITERATURE_SOURCES[spec.sourceId];
    if (!source) {
      throw new Error(`Verified literature source not found: ${spec.sourceId}`);
    }

    const studyType = getStudyType(spec, source);
    const { clinicalFocus, interpretationBoundary } = splitClaimBoundary(source.claimBoundary);

    return {
      id: source.id,
      title: spec.title,
      category: spec.category,
      categoryLabel: RESEARCH_CATEGORY_LABELS[spec.category],
      studyType,
      studyTypeLabel: RESEARCH_STUDY_TYPE_LABELS[studyType],
      year: getPublicationYear(source),
      ageScope: source.ageScope ?? null,
      clinicalFocus,
      interpretationBoundary,
      inlineCitation: source.inlineCitation,
      apaReference: source.apaReference,
      doi: source.doi,
      pmid: source.pmid ?? null,
      sourceUrl: source.url,
      verifiedAt: source.verifiedAt,
    };
  }).sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "tr-TR"));
}
