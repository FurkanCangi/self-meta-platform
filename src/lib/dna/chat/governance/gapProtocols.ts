import {
  DNA_COVERAGE_CELLS,
  type DnaCoverageCell,
  type DnaScienceDomainId,
} from "./coverageMap"

export const DNA_GAP_PROTOCOLS_VERSION = "dna-gap-protocols@1" as const

export const DNA_GAP_PROTOCOL_CUTOFF_DATE = "2026-07-19" as const

export const DNA_PRISMA_REPRODUCIBILITY_BOUNDARY_TR =
  "PRISMA, arama ve seçim sürecinin yeniden üretilebilir raporlanmasına yardım eder; ürün doğruluğu, kaynak kalitesi, DNA geçerliği veya klinik güvenlik sertifikası değildir." as const

export type DnaGapProtocolExecution =
  | {
      readonly state: "planned"
      readonly run: null
      readonly counts: null
      readonly exclusionCounts: null
    }
  | {
      readonly state: "executed"
      readonly run: {
        readonly runId: string
        readonly executedAt: string
        readonly protocolSha256: string
        readonly rawResultLedgerSha256: string
        readonly screeningLedgerSha256: string
      }
      readonly counts: {
        readonly identified: number
        readonly deduplicated: number
        readonly screened: number
        readonly fullTextAssessed: number
        readonly included: number
      }
      readonly exclusionCounts: Readonly<Record<string, number>>
    }

export type DnaGapSearchProtocol = {
  readonly version: typeof DNA_GAP_PROTOCOLS_VERSION
  readonly id: string
  readonly titleTr: string
  readonly domainId: DnaScienceDomainId
  readonly linkedCellIds: readonly DnaCoverageCell["id"][]
  readonly researchQuestionTr: string
  readonly inclusionCriteriaTr: readonly string[]
  readonly exclusionCriteriaTr: readonly string[]
  readonly ageScopeTr: string
  readonly studyTypesTr: readonly string[]
  readonly cutoffDate: typeof DNA_GAP_PROTOCOL_CUTOFF_DATE
  readonly databases: readonly string[]
  readonly exactQueries: readonly {
    readonly database: string
    readonly query: string
  }[]
  readonly prismaBoundaryTr: typeof DNA_PRISMA_REPRODUCIBILITY_BOUNDARY_TR
  readonly execution: DnaGapProtocolExecution
}

type ProtocolSeed = Omit<
  DnaGapSearchProtocol,
  "version" | "linkedCellIds" | "cutoffDate" | "prismaBoundaryTr" | "execution"
>

function linkedGapCells(domainId: DnaScienceDomainId): readonly DnaCoverageCell["id"][] {
  return Object.freeze(
    DNA_COVERAGE_CELLS
      .filter((cell) =>
        cell.domainId === domainId &&
        (cell.status === "bounded_partial" || cell.status === "not_available"))
      .map((cell) => cell.id),
  )
}

const PLANNED_EXECUTION: DnaGapProtocolExecution = Object.freeze({
  state: "planned",
  run: null,
  counts: null,
  exclusionCounts: null,
})

function protocol(seed: ProtocolSeed): DnaGapSearchProtocol {
  return Object.freeze({
    version: DNA_GAP_PROTOCOLS_VERSION,
    ...seed,
    linkedCellIds: linkedGapCells(seed.domainId),
    cutoffDate: DNA_GAP_PROTOCOL_CUTOFF_DATE,
    prismaBoundaryTr: DNA_PRISMA_REPRODUCIBILITY_BOUNDARY_TR,
    execution: PLANNED_EXECUTION,
    inclusionCriteriaTr: Object.freeze([...seed.inclusionCriteriaTr]),
    exclusionCriteriaTr: Object.freeze([...seed.exclusionCriteriaTr]),
    studyTypesTr: Object.freeze([...seed.studyTypesTr]),
    databases: Object.freeze([...seed.databases]),
    exactQueries: Object.freeze(seed.exactQueries.map((entry) => Object.freeze({ ...entry }))),
  })
}

export const DNA_GAP_SEARCH_PROTOCOLS: readonly DnaGapSearchProtocol[] = Object.freeze([
  protocol({
    id: "gap.cellular.ion_plasticity_glia_neuromodulators",
    titleTr: "İyon kanalları, sinaptik plastisite, glia ve nöromodülatörler",
    domainId: "cellular_neurophysiology",
    researchQuestionTr: "İnsan nörofizyolojisinde iyon kanalları, sinaptik plastisite, glia ve nöromodülatörlerin temel işlevleri hangi kanıtlarla ve hangi klinik çıkarım sınırlarıyla açıklanabilir?",
    inclusionCriteriaTr: ["Hakemli insan çalışması veya insan verisini açıkça ayıran güçlü sentez", "Temel mekanizma ve ölçüm yöntemini açıkça tanımlama", "İngilizce veya Türkçe tam bibliyografik kayıt"],
    exclusionCriteriaTr: ["Yalnız hayvan bulgusunu insana doğrudan genelleme", "Tek hastalık için tedavi veya ilaç önerisi", "DNA ürününü biyolojik olarak doğruladığını iddia etme"],
    ageScopeTr: "Tüm yaşlar; gelişimsel ve yetişkin kanıtları ayrı etiketlenecek.",
    studyTypesTr: ["Konsensüs", "Sistematik derleme", "Güncel kapsamlı derleme", "Doğrudan insan deneysel çalışması"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((ion channel*[Title/Abstract] OR synaptic plasticity[Title/Abstract] OR glia*[Title/Abstract] OR neuromodulator*[Title/Abstract]) AND (human*[Title/Abstract] OR Humans[Mesh])) AND (review[Publication Type] OR systematic review[Title/Abstract] OR consensus[Title/Abstract])" },
      { database: "Crossref", query: "ion channels synaptic plasticity glia neuromodulators human neurophysiology review" },
      { database: "OpenAlex", query: "ion channels synaptic plasticity glia neuromodulators human neurophysiology review" },
    ],
  }),
  protocol({
    id: "gap.cns.brainstem_thalamus_basal_ganglia_cerebellum",
    titleTr: "Beyin sapı, talamus, bazal gangliyonlar ve serebellum",
    domainId: "central_nervous_system_networks",
    researchQuestionTr: "Beyin sapı, talamus, bazal gangliyonlar ve serebellumun düzenleme ile ilişkili ağ işlevleri tek bölge ve tersine çıkarım hatasına düşmeden nasıl açıklanabilir?",
    inclusionCriteriaTr: ["İnsan ağ nörobilimi veya karşılaştırmalı sentez", "Bölge-ağ ayrımını tanımlama", "Yöntem ve örneklem yaşını bildirme"],
    exclusionCriteriaTr: ["Davranıştan bölge aktivitesi çıkarımı", "Tek bölgeyi karmaşık davranışın nedeni sayma", "Olgu sunumunu genel mekanizma kanıtı sayma"],
    ageScopeTr: "Çocuk, ergen ve yetişkin örneklemleri ayrı değerlendirilecek.",
    studyTypesTr: ["Sistematik derleme", "Meta-analiz", "Ağ düzeyi insan nörogörüntüleme", "Gelişimsel kohort"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((brainstem[Title/Abstract] OR thalamus[Title/Abstract] OR basal ganglia[Title/Abstract] OR cerebellum[Title/Abstract]) AND (network*[Title/Abstract] OR regulation[Title/Abstract])) AND (human*[Title/Abstract] OR Humans[Mesh])" },
      { database: "Crossref", query: "brainstem thalamus basal ganglia cerebellum regulation network human review" },
      { database: "OpenAlex", query: "brainstem thalamus basal ganglia cerebellum regulation network human" },
    ],
  }),
  protocol({
    id: "gap.ans.central_network_baroreflex_respiration_posture",
    titleTr: "Merkezi otonom ağ, barorefleks, solunum ve postür etkileri",
    domainId: "autonomic_nervous_system_hrv",
    researchQuestionTr: "Merkezi otonom ağ, barorefleks, solunum ve postür HRV ve diğer otonom ölçümleri hangi koşullarda etkiler?",
    inclusionCriteriaTr: ["İnsan otonom fizyoloji çalışması", "Solunum ve/veya postürü ölçme ya da kontrol etme", "Ölçüm protokolünü raporlama"],
    exclusionCriteriaTr: ["HRV'yi doğrudan sempatik-parasempatik denge skoru sayma", "Davranıştan vagal ton çıkarma", "Kontrolsüz cihaz pazarlama doğrulaması"],
    ageScopeTr: "Pediatrik normlar yetişkin protokollerinden ayrı tutulacak.",
    studyTypesTr: ["Konsensüs", "Yöntemsel sistematik derleme", "Kontrollü fizyoloji çalışması", "Yaşa göre norm çalışması"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((central autonomic network[Title/Abstract] OR baroreflex[Title/Abstract]) AND (respiration[Title/Abstract] OR posture[Title/Abstract] OR heart rate variability[Title/Abstract])) AND Humans[Mesh]" },
      { database: "Crossref", query: "central autonomic network baroreflex respiration posture heart rate variability human" },
      { database: "OpenAlex", query: "central autonomic network baroreflex respiration posture HRV human" },
    ],
  }),
  protocol({
    id: "gap.stress.hpa_sam_child_adolescent_development",
    titleTr: "HPA/SAM sistemleri ve çocuk-ergen stres gelişimi",
    domainId: "stress_arousal_reactivity_recovery",
    researchQuestionTr: "HPA ve SAM sistemlerinin çocukluk ve ergenlikteki gelişimi, reaktivitesi ve toparlanması hangi yöntemlerle ve hangi sınırlarla incelenmiştir?",
    inclusionCriteriaTr: ["Çocuk veya ergen insan örneklemi", "HPA ya da SAM ölçümünü doğrudan raporlama", "Zamanlama ve örnek toplama koşullarını bildirme"],
    exclusionCriteriaTr: ["Davranıştan kortizol veya SAM durumu çıkarımı", "Tek biyobelirteçten kronik stres tanımı", "Tedavi etkinliği çıkarımı"],
    ageScopeTr: "0-18 yaş; pubertal evre bildirimi ayrıca kodlanacak.",
    studyTypesTr: ["Sistematik derleme", "Meta-analiz", "Uzunlamasına kohort", "Kontrollü stres paradigması"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((HPA axis[Title/Abstract] OR hypothalamic pituitary adrenal[Title/Abstract] OR sympathoadrenal[Title/Abstract] OR SAM system[Title/Abstract]) AND (child*[Title/Abstract] OR adolescen*[Title/Abstract]) AND (development*[Title/Abstract] OR reactivity[Title/Abstract] OR recovery[Title/Abstract]))" },
      { database: "Crossref", query: "HPA SAM child adolescent development stress reactivity recovery systematic review" },
      { database: "OpenAlex", query: "HPA SAM child adolescent stress development reactivity recovery" },
    ],
  }),
  protocol({
    id: "gap.sensory.vestibular_proprioceptive_tactile_auditory_modulation",
    titleTr: "Vestibüler, proprioseptif, dokunsal ve işitsel modülasyon",
    domainId: "interoception_sensory_processes",
    researchQuestionTr: "Vestibüler, proprioseptif, dokunsal ve işitsel süreçlerde modülasyon nasıl tanımlanır ve davranışsal ölçümlerin biyolojik çıkarım sınırları nelerdir?",
    inclusionCriteriaTr: ["İnsan duyusal işleme veya psikofizik çalışması", "Duyusal modaliteyi açıkça ayırma", "Ölçüm geçerliği veya belirsizliğini bildirme"],
    exclusionCriteriaTr: ["Tek davranışı duyusal sistem bozukluğu sayma", "Tanısal olmayan ölçeği tanı aracı gibi kullanma", "Müdahale önerisini mekanizma kanıtı sayma"],
    ageScopeTr: "Gelişimsel; pediatrik ve yetişkin ölçümleri ayrı kodlanacak.",
    studyTypesTr: ["Sistematik derleme", "Psikofizik çalışma", "Ölçüm geçerliği", "Gelişimsel kohort"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((vestibular[Title/Abstract] OR propriocept*[Title/Abstract] OR tactile[Title/Abstract] OR auditory[Title/Abstract]) AND (sensory modulation[Title/Abstract] OR sensory processing[Title/Abstract])) AND (human*[Title/Abstract] OR Humans[Mesh])" },
      { database: "Crossref", query: "vestibular proprioceptive tactile auditory sensory modulation human development measurement" },
      { database: "OpenAlex", query: "vestibular proprioceptive tactile auditory sensory modulation human development" },
    ],
  }),
  protocol({
    id: "gap.coregulation.developmental_cultural_boundaries",
    titleTr: "Eş-regülasyonun gelişimsel ve kültürel sınırları",
    domainId: "emotion_self_coregulation",
    researchQuestionTr: "Eş-regülasyonun biçimi yaşa ve kültürel bağlama göre nasıl değişir ve senkroni neden tek başına olumlu düzenleme kanıtı değildir?",
    inclusionCriteriaTr: ["Bakımveren-çocuk veya kişilerarası düzenleme çalışması", "Yaş ve kültürel bağlamı raporlama", "Süreç ile sonuç ölçümünü ayırma"],
    exclusionCriteriaTr: ["Senkroniyi otomatik olarak olumlu sayma", "Tek kültür bulgusunu evrenselleştirme", "Korelasyondan nedensellik çıkarma"],
    ageScopeTr: "Doğumdan yetişkinliğe; gelişim evreleri ve kültürel bağlam ayrı kodlanacak.",
    studyTypesTr: ["Sistematik derleme", "Kültürlerarası çalışma", "Uzunlamasına dyadik çalışma", "Çok yöntemli gözlem"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((co-regulation[Title/Abstract] OR coregulation[Title/Abstract] OR dyadic regulation[Title/Abstract]) AND (development*[Title/Abstract] OR culture[Title/Abstract] OR cross-cultural[Title/Abstract]))" },
      { database: "Crossref", query: "co-regulation dyadic regulation development cultural cross-cultural review" },
      { database: "OpenAlex", query: "co-regulation dyadic regulation development cultural cross-cultural review" },
    ],
  }),
  protocol({
    id: "gap.executive.task_impurity",
    titleTr: "Yürütücü işlevlerde görev saflığı problemi",
    domainId: "attention_working_memory_executive_functions",
    researchQuestionTr: "Yürütücü işlev görevlerindeki görev saflığı ve görev-güvenirlik sorunları ölçüm ve bireysel yorumları nasıl sınırlar?",
    inclusionCriteriaTr: ["Yürütücü işlev görevi veya görev bataryası", "Güvenirlik, yapı geçerliği ya da görev saflığını değerlendirme", "İnsan örneklemi"],
    exclusionCriteriaTr: ["Tek görevden saf bilişsel mekanizma çıkarma", "Görev performansını beyin bölgesi ölçümü sayma", "Tanı veya bireysel prognoz çıkarma"],
    ageScopeTr: "Çocuk, ergen ve yetişkin görevleri ayrı kodlanacak.",
    studyTypesTr: ["Meta-analiz", "Psikometrik çalışma", "Çok görevli latent değişken çalışması", "Test-tekrar test çalışması"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((executive function[Title/Abstract] OR cognitive control[Title/Abstract]) AND (task impurity[Title/Abstract] OR reliability[Title/Abstract] OR construct validity[Title/Abstract] OR test-retest[Title/Abstract]))" },
      { database: "Crossref", query: "executive function task impurity reliability construct validity test retest" },
      { database: "OpenAlex", query: "executive function task impurity reliability construct validity test retest" },
    ],
  }),
  protocol({
    id: "gap.sleep.pediatric_circadian_development",
    titleTr: "Pediatrik uyku ve sirkadiyen gelişim",
    domainId: "sleep_circadian_processes",
    researchQuestionTr: "Uyku mimarisi, uyku ihtiyacı ve sirkadiyen zamanlama çocukluk ve ergenlik boyunca nasıl değişir?",
    inclusionCriteriaTr: ["0-18 yaş insan örneklemi", "Uyku veya sirkadiyen ölçümü doğrudan raporlama", "Yaş grubu ve ölçüm yöntemini açıklama"],
    exclusionCriteriaTr: ["Yetişkin normunu doğrudan çocuğa uygulama", "Uyku yakınmasını tek nedene bağlama", "Bireysel tedavi veya doz önerisi"],
    ageScopeTr: "0-18 yaş; bebeklik, çocukluk ve ergenlik ayrı kodlanacak.",
    studyTypesTr: ["Konsensüs", "Sistematik derleme", "Meta-analiz", "Uzunlamasına uyku çalışması"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((sleep[Title/Abstract] OR circadian[Title/Abstract]) AND (child*[Title/Abstract] OR adolescen*[Title/Abstract] OR pediatric[Title/Abstract]) AND (development*[Title/Abstract] OR maturation[Title/Abstract] OR duration[Title/Abstract]))" },
      { database: "Crossref", query: "pediatric sleep circadian development maturation child adolescent systematic review" },
      { database: "OpenAlex", query: "pediatric sleep circadian development child adolescent systematic review" },
    ],
  }),
  protocol({
    id: "gap.development.conditions_adult_neurodiversity",
    titleTr: "ADHD, DCD, disleksi, dil bozuklukları, Tourette ve yetişkin nöroçeşitliliği",
    domainId: "development_neurodevelopmental_differences",
    researchQuestionTr: "Farklı nörogelişimsel gruplarda ve yetişkin nöroçeşitliliğinde işlevsel çeşitlilik hangi ortak ve ayrışan kanıtlarla tanımlanabilir?",
    inclusionCriteriaTr: ["ADHD, DCD, disleksi, gelişimsel dil bozukluğu, Tourette veya yetişkin nöroçeşitliliği örneklemi", "Tanı grubu ile bireysel yorum sınırını ayırma", "Yaş ve komorbiditeyi raporlama"],
    exclusionCriteriaTr: ["Grup ortalamasını bireysel imza sayma", "Davranıştan tanı çıkarma", "Eksiklik merkezli tek açıklama veya pazarlama içeriği"],
    ageScopeTr: "Çocukluktan yetişkinliğe; yaşam boyu geçişler ayrı kodlanacak.",
    studyTypesTr: ["Sistematik derleme", "Meta-analiz", "Büyük kohort", "Yaşam boyu uzunlamasına çalışma"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((ADHD[Title/Abstract] OR developmental coordination disorder[Title/Abstract] OR dyslexia[Title/Abstract] OR developmental language disorder[Title/Abstract] OR Tourette[Title/Abstract] OR neurodiversity[Title/Abstract]) AND (adult*[Title/Abstract] OR developmental[Title/Abstract] OR lifespan[Title/Abstract]))" },
      { database: "Crossref", query: "ADHD DCD dyslexia language disorder Tourette adult neurodiversity lifespan review" },
      { database: "OpenAlex", query: "ADHD DCD dyslexia language disorder Tourette adult neurodiversity lifespan review" },
    ],
  }),
  protocol({
    id: "gap.measurement.dna_psychometrics_individual_uncertainty",
    titleTr: "DNA'ya özgü psikometri ve bireysel belirsizlik",
    domainId: "measurement_case_clinical_boundaries",
    researchQuestionTr: "DNA aracının güvenirliği, geçerliği, ölçüm değişmezliği ve bireysel belirsizliği hangi DNA-özgü araştırma tasarımlarıyla gösterilebilir?",
    inclusionCriteriaTr: ["Doğrudan DNA ölçüm aracını değerlendiren veri", "Önceden tanımlı örneklem ve analiz planı", "Güvenirlik, geçerlik, değişmezlik veya ölçüm hatasını raporlama"],
    exclusionCriteriaTr: ["Genel nörofizyoloji kaynağını DNA psikometrisi sayma", "Başka aracın geçerliğini DNA'ya aktarma", "Pazarlama iddiası, vaka anekdotu veya yalnız uzman görüşü"],
    ageScopeTr: "DNA'nın amaçlanan yaş grupları; her grup için ayrı değişmezlik ve norm kanıtı gerekir.",
    studyTypesTr: ["Ön kayıtlı psikometrik çalışma", "Doğrulayıcı faktör analizi", "Ölçüm değişmezliği", "Test-tekrar test", "Dış ölçüt geçerliği"],
    databases: ["PubMed", "Crossref", "OpenAlex"],
    exactQueries: [
      { database: "PubMed", query: "((DNA assessment[Title/Abstract] OR DNA profile[Title/Abstract]) AND (psychometric*[Title/Abstract] OR reliability[Title/Abstract] OR validity[Title/Abstract] OR measurement invariance[Title/Abstract] OR measurement error[Title/Abstract]))" },
      { database: "Crossref", query: "DNA assessment psychometric reliability validity measurement invariance measurement error" },
      { database: "OpenAlex", query: "DNA assessment psychometric reliability validity measurement invariance measurement error" },
    ],
  }),
])

export function getCoverageGapCellIds(): readonly DnaCoverageCell["id"][] {
  return DNA_COVERAGE_CELLS
    .filter((cell) => cell.status === "bounded_partial" || cell.status === "not_available")
    .map((cell) => cell.id)
}

export function getUnlinkedCoverageGapCellIds(): readonly DnaCoverageCell["id"][] {
  const linked = new Set(DNA_GAP_SEARCH_PROTOCOLS.flatMap((entry) => entry.linkedCellIds))
  return getCoverageGapCellIds().filter((cellId) => !linked.has(cellId))
}
