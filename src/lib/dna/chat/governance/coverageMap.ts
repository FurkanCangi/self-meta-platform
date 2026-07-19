/**
 * Faz 5 knowledge coverage map.
 *
 * This is a governance inventory, not a publication list. A candidate source
 * only identifies material to be screened by the V3 lifecycle. It cannot
 * support a runtime answer until the corresponding claim and source have both
 * reached `released` through the lifecycle registry.
 */

export const DNA_COVERAGE_MAP_VERSION = "dna-coverage-map@1" as const

export const DNA_COVERAGE_STATUSES = [
  "release_ready",
  "bounded_partial",
  "not_available",
  "prohibited",
] as const

export type DnaCoverageStatus = (typeof DNA_COVERAGE_STATUSES)[number]

export const DNA_SCIENCE_DOMAINS = Object.freeze([
  { id: "cellular_neurophysiology", labelTr: "Hücresel nörofizyoloji", ageScope: "all_ages" },
  { id: "central_nervous_system_networks", labelTr: "Merkezi sinir sistemi ve ağlar", ageScope: "developmental" },
  { id: "autonomic_nervous_system_hrv", labelTr: "Otonom sinir sistemi ve HRV", ageScope: "mixed" },
  { id: "stress_arousal_reactivity_recovery", labelTr: "Stres, uyarılma, reaktivite ve toparlanma", ageScope: "developmental" },
  { id: "interoception_sensory_processes", labelTr: "İnterosepsiyon ve duyusal süreçler", ageScope: "developmental" },
  { id: "emotion_self_coregulation", labelTr: "Duygusal düzenleme, öz-düzenleme ve eş-regülasyon", ageScope: "developmental" },
  { id: "attention_working_memory_executive_functions", labelTr: "Dikkat, çalışma belleği ve yürütücü işlevler", ageScope: "developmental" },
  { id: "sleep_circadian_processes", labelTr: "Uyku ve sirkadiyen süreçler", ageScope: "developmental" },
  { id: "development_neurodevelopmental_differences", labelTr: "Gelişim ve nörogelişimsel farklılıklar", ageScope: "developmental" },
  { id: "measurement_case_clinical_boundaries", labelTr: "Ölçüm, vaka yorumu ve klinik sınırlar", ageScope: "all_ages" },
] as const)

export type DnaScienceDomainId = (typeof DNA_SCIENCE_DOMAINS)[number]["id"]

export const DNA_COVERAGE_DIMENSIONS = Object.freeze([
  { id: "definition", labelTr: "Tanım" },
  { id: "anatomy", labelTr: "Anatomi" },
  { id: "function", labelTr: "İşlev" },
  { id: "development", labelTr: "Gelişim" },
  { id: "measurement", labelTr: "Ölçüm" },
  { id: "evidence_level", labelTr: "Kanıt düzeyi" },
  { id: "contested_theories", labelTr: "Tartışmalı teoriler" },
  { id: "age_scope", labelTr: "Yaş kapsamı" },
  { id: "typical_development", labelTr: "Tipik gelişim" },
  { id: "neurodevelopmental_differences", labelTr: "Nörogelişimsel farklılıklar" },
  { id: "dna_relation", labelTr: "DNA ile ilişki" },
  { id: "case_interpretation_boundaries", labelTr: "Vaka yorum sınırları" },
  { id: "misconceptions", labelTr: "Yanlış bilinenler" },
  { id: "unknowns", labelTr: "Bilinmeyenler" },
] as const)

export type DnaCoverageDimensionId = (typeof DNA_COVERAGE_DIMENSIONS)[number]["id"]

export type DnaCoverageAgeScope =
  | "all_ages"
  | "developmental"
  | "early_childhood"
  | "childhood"
  | "adolescence"
  | "adult_weighted"
  | "mixed"

export type DnaCoverageCell = {
  readonly version: typeof DNA_COVERAGE_MAP_VERSION
  readonly id: `${DnaScienceDomainId}.${DnaCoverageDimensionId}`
  readonly domainId: DnaScienceDomainId
  readonly dimensionId: DnaCoverageDimensionId
  readonly status: DnaCoverageStatus
  readonly safeQuestionFamilies: readonly string[]
  readonly boundaryTr: string
  readonly ageScope: DnaCoverageAgeScope
  /** Candidate-only identifiers; these are never proof of runtime release. */
  readonly candidateSourceIds: readonly string[]
  readonly releaseEvidence: {
    readonly claimIds: readonly string[]
    readonly sourceIds: readonly string[]
  }
  readonly testCoverage: {
    readonly contractTestIds: readonly string[]
    /** `boundary_only` never authorizes an unreleased scientific claim. */
    readonly requiredOutcomes: readonly ("bounded_answer" | "boundary_only" | "not_available" | "refusal")[]
  }
}

const DOMAIN_CANDIDATE_SOURCE_IDS = Object.freeze({
  cellular_neurophysiology: ["KNUDSEN_2004", "KOLK_RAKIC_2022"],
  central_nervous_system_networks: ["SAPER_2002", "UDDIN_ET_AL_2017", "POLDRAK_2006"],
  autonomic_nervous_system_hrv: ["WEHRWEIN_ET_AL_2016", "TASK_FORCE_HRV_1996", "LABORDE_ET_AL_2017"],
  stress_arousal_reactivity_recovery: ["MCEWEN_1998", "CHROUSOS_2009", "GUNNAR_QUEVEDO_2007"],
  interoception_sensory_processes: ["KHALSA_ET_AL_2018", "DUNN_2001", "CRITCHLEY_HARRISON_2013"],
  emotion_self_coregulation: ["GROSS_2015", "INZLICHT_ET_AL_2021", "BIRK_ET_AL_2022_COREG"],
  attention_working_memory_executive_functions: ["DIAMOND_2013", "BADDELEY_2000", "HEDGE_ET_AL_2018"],
  sleep_circadian_processes: ["BORBELY_ET_AL_2016", "PARUTHI_ET_AL_2016", "ASTILL_ET_AL_2012"],
  development_neurodevelopmental_differences: ["KNUDSEN_2004", "SAMEROFF_2010", "MASTEN_CICCHETTI_2010"],
  measurement_case_clinical_boundaries: ["AERA_APA_NCME_2014", "MOKKINK_ET_AL_2010_COSMIN", "APA_ASSESSMENT_GUIDELINES_2020"],
} as const satisfies Readonly<Record<DnaScienceDomainId, readonly string[]>>)

const QUESTION_FAMILY_BY_DIMENSION = Object.freeze({
  definition: (domain: string) => [`${domain} nasıl tanımlanır?`, `${domain} hangi kavramlardan ayrılır?`],
  anatomy: (domain: string) => [`${domain} ile ilişkili temel yapılar nelerdir?`, `${domain} anatomisi hangi düzeylerde ele alınır?`],
  function: (domain: string) => [`${domain} hangi genel işlevlerle ilişkilidir?`, `${domain} işlevi hangi sınırlar içinde açıklanabilir?`],
  development: (domain: string) => [`${domain} gelişim boyunca nasıl değişir?`, `${domain} gelişiminde grup düzeyindeki bulgular nelerdir?`],
  measurement: (domain: string) => [`${domain} araştırmalarda nasıl ölçülür?`, `${domain} ölçümlerinin yorum sınırları nelerdir?`],
  evidence_level: (domain: string) => [`${domain} için kanıtın gücü nedir?`, `${domain} bulgularında hangi çalışma türleri daha güçlüdür?`],
  contested_theories: (domain: string) => [`${domain} alanındaki tartışmalı teoriler nelerdir?`, `${domain} teorilerinin destekleri ve eleştirileri nelerdir?`],
  age_scope: (domain: string) => [`${domain} kanıtları hangi yaş gruplarını kapsar?`, `${domain} için yetişkin bulguları çocuklara genellenebilir mi?`],
  typical_development: (domain: string) => [`${domain} tipik gelişimde nasıl çeşitlilik gösterir?`, `${domain} için normal varyasyon ne anlama gelir?`],
  neurodevelopmental_differences: (domain: string) => [`${domain} nörogelişimsel farklılıklarda grup düzeyinde nasıl incelenir?`, `${domain} bulguları neden tanı göstergesi değildir?`],
  dna_relation: (domain: string) => [`${domain} literatürü DNA ürününü doğrular mı?`, `${domain} bulgusundan DNA alanı çıkarılabilir mi?`],
  case_interpretation_boundaries: (domain: string) => [`${domain} bilgisi vaka raporuyla nasıl sınırlandırılarak yan yana konur?`, `${domain} hakkında raporda ölçülmeyen ne söylenemez?`],
  misconceptions: (domain: string) => [`${domain} hakkında sık görülen yanlış inanışlar nelerdir?`, `${domain} hangi tek nedenli açıklamalara indirgenemez?`],
  unknowns: (domain: string) => [`${domain} alanında henüz bilinmeyenler nelerdir?`, `${domain} hakkında hangi sorulara güvenli cevap verilemiyor?`],
} as const satisfies Readonly<Record<DnaCoverageDimensionId, (domain: string) => readonly string[]>>)

function statusForDimension(dimensionId: DnaCoverageDimensionId): DnaCoverageStatus {
  if (dimensionId === "dna_relation") return "prohibited"
  if (dimensionId === "unknowns") return "not_available"
  return "bounded_partial"
}

function boundaryFor(status: DnaCoverageStatus, domainLabel: string): string {
  if (status === "prohibited") {
    return `${domainLabel} literatürü DNA ürün geçerliğini kanıtlamaz; davranıştan biyolojik mekanizma veya DNA alanı çıkarımı yapılamaz. Yalnız bu sınır açıklanabilir.`
  }
  if (status === "not_available") {
    return `${domainLabel} için kontrollü katalogda bu soruyu destekleyecek tamamlanmış V3 denetimi yoktur; yanıt bilinmiyor veya katalogda yok olarak verilmelidir.`
  }
  if (status === "release_ready") {
    return `${domainLabel} için yalnız releaseEvidence içindeki yaşam döngüsü kilitli iddia ve kaynakların sınırı içinde yanıt verilebilir.`
  }
  return `${domainLabel} için aday kaynaklar vardır ancak V3 çok geçişli denetimi ve release kaydı tamamlanmamıştır; bu hücre canlı bilimsel iddiayı destekleyemez.`
}

function outcomeFor(status: DnaCoverageStatus): "bounded_answer" | "boundary_only" | "not_available" | "refusal" {
  if (status === "prohibited") return "refusal"
  if (status === "not_available") return "not_available"
  if (status === "release_ready") return "bounded_answer"
  return "boundary_only"
}

/**
 * No Faz 5 cell is release-ready at initialization: the V3 science lifecycle
 * contains no multi-pass-audited, released claim/source pair yet. This is a
 * deliberate fail-closed snapshot, not a judgment that the legacy catalog is
 * scientifically false.
 */
export const DNA_COVERAGE_CELLS: readonly DnaCoverageCell[] = Object.freeze(
  DNA_SCIENCE_DOMAINS.flatMap((domain) =>
    DNA_COVERAGE_DIMENSIONS.map((dimension) => {
      const status = statusForDimension(dimension.id)
      return Object.freeze({
        version: DNA_COVERAGE_MAP_VERSION,
        id: `${domain.id}.${dimension.id}`,
        domainId: domain.id,
        dimensionId: dimension.id,
        status,
        safeQuestionFamilies: Object.freeze([...QUESTION_FAMILY_BY_DIMENSION[dimension.id](domain.labelTr)]),
        boundaryTr: boundaryFor(status, domain.labelTr),
        ageScope: domain.ageScope,
        candidateSourceIds: Object.freeze([...DOMAIN_CANDIDATE_SOURCE_IDS[domain.id]]),
        releaseEvidence: Object.freeze({
          claimIds: Object.freeze([] as string[]),
          sourceIds: Object.freeze([] as string[]),
        }),
        testCoverage: Object.freeze({
          contractTestIds: Object.freeze([`coverage.${domain.id}.${dimension.id}`]),
          requiredOutcomes: Object.freeze([outcomeFor(status)]),
        }),
      }) as DnaCoverageCell
    }),
  ),
)

export const DNA_COVERAGE_MAP = Object.freeze({
  version: DNA_COVERAGE_MAP_VERSION,
  generatedAt: "2026-07-19",
  domains: DNA_SCIENCE_DOMAINS,
  dimensions: DNA_COVERAGE_DIMENSIONS,
  cells: DNA_COVERAGE_CELLS,
  releasePolicy: "released_claim_and_source_pair_required" as const,
  initialReleaseReadyCount: 0,
})

export function getCoverageCell(
  domainId: DnaScienceDomainId,
  dimensionId: DnaCoverageDimensionId,
): DnaCoverageCell | null {
  return DNA_COVERAGE_CELLS.find(
    (cell) => cell.domainId === domainId && cell.dimensionId === dimensionId,
  ) ?? null
}

export function isCoverageCellReleaseReady(cell: DnaCoverageCell): boolean {
  return cell.status === "release_ready" &&
    cell.releaseEvidence.claimIds.length > 0 &&
    cell.releaseEvidence.sourceIds.length > 0
}
