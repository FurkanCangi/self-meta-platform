#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { inspectDnaChatSafety } from "../src/lib/dna/chat/safety"
import {
  scoreDnaTextMatch,
} from "../src/lib/dna/chat/text"
import {
  assertContained,
  assertSecureParentChain,
  canonicalSha256,
  resolveSecureRoot,
  secureAtomicWriteFile,
  sha256Bytes,
} from "./dna-secure-artifact"

const QA_VERSION = "dna-external-science-offline-qa@1"
const EXPECTED_PACKAGE_VERSION = "dna-external-science-candidate@1"
const EXPECTED_TOPIC_COUNT = 14
const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-qa-current.json"
const CANDIDATE_PACKAGE_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
const RAW_OUTPUT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/external-science-qa/prebook-science-qa-v1/raw-result.json"

type CandidateTopic = {
  id: string
  title: string
  aliases: string[]
  sourceId: string
  authority: string
  ownerBookAuthority: boolean
  topicSha256: string
}

type CandidateSource = {
  id: string
  title: string
  integrityState: string
  passageLicenseDecision: string
  runtimeEligible: boolean
  releaseEligible: boolean
  sourceSha256: string
}

type CandidatePassage = {
  id: string
  sourceId: string
  originalText: string
  originalLanguage: string
  ageScope: string
  claimBoundary: string
  licenseStatus: string
  runtimeEligible: boolean
  releaseEligible: boolean
  passageSha256: string
}

type CandidateClaim = {
  id: string
  sourceId: string
  topicId: string
  passageId: string
  proposition: string
  ageScope: string
  causalStatus: string
  evidenceLevel: string
  claimBoundary: string
  publicationStatus: string
  relationClass: string
  dnaProductRelation: string
  runtimeEligible: boolean
  releaseEligible: boolean
  claimSha256: string
}

type CandidateAnswerUnit = {
  id: string
  topicId: string
  claimId: string
  passageId: string
  sourceId: string
  visibleCitationRequired: boolean
  maximumGraphHops: number
  multiStepMechanismAllowed: boolean
  answerUnitSha256: string
}

type CandidateLexicalEntry = {
  topicId: string
  title: string
  aliases: string[]
  keywords: string[]
}

type CandidatePackage = {
  schemaVersion: string
  basisAt: string
  authorityClass: string
  runtimeEligible: boolean
  releaseEligible: boolean
  activationAllowed: boolean
  activeRuntimeGeneration: string
  topics: CandidateTopic[]
  sources: CandidateSource[]
  passages: CandidatePassage[]
  claims: CandidateClaim[]
  relations: unknown[]
  answerUnits: CandidateAnswerUnit[]
  lexicalIndex: CandidateLexicalEntry[]
  counts: Record<string, number>
  verification: Record<string, number>
  boundary: string
  packageSha256: string
}

type ProbeKind =
  | "catalog_anchor"
  | "natural_paraphrase"
  | "hard_neighbor"
  | "ambiguous"
  | "unsupported"

type Probe = {
  id: string
  kind: ProbeKind
  question: string
  expectedTopicId: string | null
  pairId?: string
}

type Ranking = {
  topicId: string
  title: string
  score: number
  method: string
  pattern: string | null
}

type ProbeResult = Probe & {
  actualTopicId: string | null
  top: Ranking | null
  second: Ranking | null
  margin: number
  correct: boolean
  safetyBlocked: boolean
  safetyCategory: string
  safetyCode: string | null
}

type ClaimGuardResult = {
  claimId: string
  topicId: string
  sourceId: string
  passageId: string
  passed: boolean
  checks: Record<string, boolean>
  failures: string[]
}

const NATURAL_PARAPHRASES: Record<string, readonly [string, string]> = {
  "external.selfreg_measurement": [
    "Çocukların kendi davranış ve duygularını yönetme becerisini değerlendiren araçların geçerliği nasıl incelenir?",
    "Bir çocuk ölçeğinin tutarlılığı ve ölçüm kalitesi nasıl yorumlanır?",
  ],
  "external.circadian_light": [
    "Gündüz ve akşam maruz kalınan ışık biyolojik saat açısından nasıl değerlendirilir?",
    "Gece ortamındaki aydınlatma için bilimsel öneriler neye dayanır?",
  ],
  "external.measurement_cosmin": [
    "Bir sağlık ölçeğinin geçerlik, güvenirlik ve duyarlılığı nasıl kalite değerlendirmesine alınır?",
    "Ölçek seçerken yapı geçerliği ve test tekrar test bulguları nasıl tartılır?",
  ],
  "external.parent_emotion_regulation": [
    "Bakım verenin duygularını yönetme biçimi çocuğun düzenleme süreçleriyle araştırmalarda nasıl ilişkilendiriliyor?",
    "Anne babanın öfke ve sakinleşme örüntülerine dair araştırmalar ne söylüyor?",
  ],
  "external.autonomic_testing": [
    "Ayağa kalkma sırasında kalp hızı ve tansiyon yanıtını inceleyen laboratuvar değerlendirmeleri nelerdir?",
    "Otonom işlev araştırmalarında kullanılan kardiyak refleks değerlendirmeleri nelerdir?",
  ],
  "external.executive_function_development": [
    "Çocuklukta planlama, ketleme ve bilişsel esneklik nasıl olgunlaşır?",
    "Gelişimsel örneklemlerde çalışma belleği ve inhibisyon birlikte nasıl incelenir?",
  ],
  "external.hrv_biofeedback_methods": [
    "Kalp atım aralıklarına dayalı geri bildirim çalışmalarında yöntem nasıl standartlaştırılır?",
    "Rezonans frekanslı solunum geri bildirimi araştırmalarında protokol nasıl raporlanır?",
  ],
  "external.hrv_context": [
    "Kalp atım aralığı değişkenliği yorumlanırken solunum, beden pozisyonu ve yaş neden önemlidir?",
    "Aynı kişide kardiyak değişkenlik günün koşullarına göre neden farklılaşabilir?",
  ],
  "external.hrv_measurement": [
    "R-R aralıklarından türetilen zaman ve frekans alanı ölçütleri nasıl raporlanır?",
    "Kısa süreli kalp ritmi değişkenliği kaydında artefaktlar nasıl ele alınır?",
  ],
  "external.insula_interoception": [
    "Beden içinden gelen sinyallerin kortikal temsili hangi beyin alanıyla ilişkilidir?",
    "İç organlardan gelen duyumların fark edilmesinde ada bölgesinin rolü nedir?",
  ],
  "external.pfc_cognitive_control": [
    "Hedefe yönelik davranışta üst düzey kontrol ve ketleme hangi frontal süreçlerle ilişkilidir?",
    "Çalışma belleği ile bilişsel esnekliğin ön beyin süreçleriyle bağlantısı nedir?",
  ],
  "external.prisma_cosmin_reporting": [
    "Ölçüm araçlarını inceleyen sistematik derlemelerde arama, seçim ve raporlama nasıl şeffaflaştırılır?",
    "Bir ölçüm aracı derlemesinin raporlama kontrol listesi hangi başlıkları kapsar?",
  ],
  "external.polyvagal_theory": [
    "Ventral ve dorsal vagal açıklamaların ampirik sınırları nasıl değerlendirilir?",
    "Evrimsel otonom hiyerarşi iddialarına yönelik bilimsel eleştiriler nelerdir?",
  ],
  "external.sleep_emotional_reactivity": [
    "Uykusuzluk sonrası olumsuz uyaranlara verilen duygusal yanıtlar nasıl değişir?",
    "Uyku süresinin kısalması duygu tepkilerinin şiddetiyle nasıl ilişkilendirilir?",
  ],
}

const HARD_NEIGHBOR_PAIRS: readonly {
  id: string
  left: { topicId: string; question: string }
  right: { topicId: string; question: string }
}[] = [
  {
    id: "hrv_measurement_vs_context",
    left: { topicId: "external.hrv_measurement", question: "HRV ölçümü ve teknik raporlama standardı nedir?" },
    right: { topicId: "external.hrv_context", question: "HRV etkenleri ve bağlamsal yorum sınırları nelerdir?" },
  },
  {
    id: "hrv_measurement_vs_biofeedback",
    left: { topicId: "external.hrv_measurement", question: "Psychophysiology HRV kayıt ölçütlerini nasıl raporlar?" },
    right: { topicId: "external.hrv_biofeedback_methods", question: "HRV biofeedback araştırma yöntemleri nasıl raporlanır?" },
  },
  {
    id: "cosmin_measurement_vs_reporting",
    left: { topicId: "external.measurement_cosmin", question: "COSMIN ile ölçüm aracı değerlendirmesi neyi inceler?" },
    right: { topicId: "external.prisma_cosmin_reporting", question: "PRISMA COSMIN ile sistematik derleme raporlaması neyi inceler?" },
  },
  {
    id: "selfreg_measurement_vs_cosmin",
    left: { topicId: "external.selfreg_measurement", question: "Çocuklarda öz düzenleme ölçümü için psikometrik özellikler nelerdir?" },
    right: { topicId: "external.measurement_cosmin", question: "Genel bir ölçüm aracının measurement properties değerlendirmesi nasıl yapılır?" },
  },
  {
    id: "insula_vs_pfc",
    left: { topicId: "external.insula_interoception", question: "İnsular korteks ve interosepsiyon ilişkisi nedir?" },
    right: { topicId: "external.pfc_cognitive_control", question: "Prefrontal korteks ve bilişsel kontrol ilişkisi nedir?" },
  },
  {
    id: "circadian_vs_sleep_reactivity",
    left: { topicId: "external.circadian_light", question: "Sirkadiyen ışık ve günlük ritim ilişkisi nedir?" },
    right: { topicId: "external.sleep_emotional_reactivity", question: "Uyku ve duygusal reaktivite ilişkisi nedir?" },
  },
  {
    id: "parent_emotion_vs_selfreg_measurement",
    left: { topicId: "external.parent_emotion_regulation", question: "Parent emotion regulation araştırmaları neyi gösterir?" },
    right: { topicId: "external.selfreg_measurement", question: "Self regulation measurement araştırmaları neyi gösterir?" },
  },
  {
    id: "executive_development_vs_pfc_control",
    left: { topicId: "external.executive_function_development", question: "Yürütücü işlev gelişimi çocuklukta nasıl incelenir?" },
    right: { topicId: "external.pfc_cognitive_control", question: "Executive control prefrontal süreçlerle nasıl incelenir?" },
  },
  {
    id: "autonomic_testing_vs_polyvagal",
    left: { topicId: "external.autonomic_testing", question: "Tilt table ve kardiyovasküler otonom test neyi ölçer?" },
    right: { topicId: "external.polyvagal_theory", question: "Polyvagal teori için bilimsel kanıt sınırı nedir?" },
  },
  {
    id: "hrv_context_vs_circadian",
    left: { topicId: "external.hrv_context", question: "Kalp hızı değişkenliği yorumunda bağlamsal etkenler nelerdir?" },
    right: { topicId: "external.circadian_light", question: "Circadian light önerilerinde gündüz ve gece bağlamı nasıldır?" },
  },
  {
    id: "parent_emotion_vs_sleep_reactivity",
    left: { topicId: "external.parent_emotion_regulation", question: "Ebeveyn etkisi duygu düzenleme araştırmalarında nasıl ele alınır?" },
    right: { topicId: "external.sleep_emotional_reactivity", question: "Sleep emotional reactivity araştırmaları neyi inceler?" },
  },
  {
    id: "prisma_reporting_vs_hrv_reporting",
    left: { topicId: "external.prisma_cosmin_reporting", question: "OMI reporting ve PRISMA COSMIN kontrol listesi nedir?" },
    right: { topicId: "external.hrv_measurement", question: "HRV raporlama ve ölçüm standardı nedir?" },
  },
]

const AMBIGUOUS_PROBES: readonly string[] = [
  "HRV hakkında bilimsel çerçeve nedir?",
  "COSMIN hakkında bilgi verir misin?",
  "Ölçüm ve raporlama nasıl yapılır?",
  "Düzenleme araştırmaları ne söylüyor?",
  "Otonom süreçleri açıklar mısın?",
  "Duygusal düzenleme hakkında kanıt nedir?",
  "Çocuk gelişiminde kontrol süreçleri nelerdir?",
  "Kalp ritmi araştırmaları nasıl yorumlanır?",
  "Sinir sistemi ve davranış ilişkisi nedir?",
  "Uyku ve biyolojik süreçler hakkında ne biliniyor?",
]

const UNSUPPORTED_PROBES: readonly string[] = [
  "Hipokampusun epizodik bellekteki rolü nedir?",
  "Amigdala korku koşullanmasına nasıl katılır?",
  "Serebellum motor öğrenmede ne yapar?",
  "Bazal gangliyonlar hareket seçimini nasıl etkiler?",
  "Dopamin ödül tahmin hatasıyla nasıl ilişkilidir?",
  "Serotonin sentezi hangi basamaklardan oluşur?",
  "EEG alfa bant gücü nasıl hesaplanır?",
  "fMRI BOLD sinyalinin fizyolojik temeli nedir?",
  "Kortizol uyanma yanıtı nasıl ölçülür?",
  "HPA ekseninde negatif geri bildirim nasıl işler?",
  "Vestibüler sistem dengeyi nasıl sağlar?",
  "Duyusal modülasyon bozukluğu nasıl tanımlanır?",
  "Eş-regülasyonun gelişimsel bileşenleri nelerdir?",
  "Allostatik yük hangi biyobelirteçlerle incelenir?",
  "Solunum sinüs aritmisinin hücresel mekanizması nedir?",
  "Epileptik nöbetlerde kortikal yayılım nasıl olur?",
  "Travmatik anıların pekişmesi nasıl gerçekleşir?",
  "Otizmde sosyal biliş ağları hakkında ne biliniyor?",
  "DEHB'de katekolamin sistemleri nasıl etkilenir?",
  "Şizofrenide varsayılan mod ağı bulguları nelerdir?",
  "Migrende kortikal yayılan depresyon nedir?",
  "Bağırsak beyin ekseni mikrobiyota üzerinden nasıl işler?",
  "Oksitosin sosyal bağlanmayla nasıl ilişkilidir?",
  "Bellek konsolidasyonunda uyku iğcikleri ne yapar?",
  "Nöroinflamasyonda mikroglia hangi rolleri üstlenir?",
  "Vagus siniri stimülasyonunun klinik etkileri nelerdir?",
  "Genel biofeedback etkinliği hakkında kanıt nedir?",
  "Aktigrafi ile uyku evreleri doğrudan ölçülebilir mi?",
  "Bir ölçeğin kültürlerarası uyarlaması nasıl yapılır?",
  "Ağrı duyarlılığında talamusun rolü nedir?",
]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function rawSha256(value: string | Buffer): string {
  return sha256Bytes(value)
}

function withoutKey<T extends Record<string, unknown>>(value: T, key: keyof T): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...value }
  delete copy[String(key)]
  return copy
}

function resolveResearchRoot(requested: string): string {
  return resolveSecureRoot(requested, true)
}

function readCandidatePackage(path: string): CandidatePackage {
  assert(existsSync(path), `external_science_qa_candidate_missing:${path}`)
  assert(!lstatSync(path).isSymbolicLink(), "external_science_qa_candidate_symlink_rejected")
  return JSON.parse(readFileSync(path, "utf8")) as CandidatePackage
}

function recordHashValid(record: Record<string, unknown>, hashKey: string): boolean {
  const recorded = record[hashKey]
  return typeof recorded === "string" && recorded === canonicalSha256(withoutKey(record, hashKey))
}

function buildClaimGuards(candidate: CandidatePackage): ClaimGuardResult[] {
  const topicById = new Map(candidate.topics.map((entry) => [entry.id, entry]))
  const sourceById = new Map(candidate.sources.map((entry) => [entry.id, entry]))
  const passageById = new Map(candidate.passages.map((entry) => [entry.id, entry]))
  const unitsByClaim = new Map<string, CandidateAnswerUnit[]>()
  for (const unit of candidate.answerUnits) {
    unitsByClaim.set(unit.claimId, [...(unitsByClaim.get(unit.claimId) ?? []), unit])
  }

  return candidate.claims.map((claim) => {
    const topic = topicById.get(claim.topicId)
    const source = sourceById.get(claim.sourceId)
    const passage = passageById.get(claim.passageId)
    const units = unitsByClaim.get(claim.id) ?? []
    const unit = units[0]
    const checks: Record<string, boolean> = {
      claimHash: recordHashValid(claim as unknown as Record<string, unknown>, "claimSha256"),
      topicExists: Boolean(topic),
      sourceExists: Boolean(source),
      passageExists: Boolean(passage),
      singleAnswerUnit: units.length === 1,
      topicSourceMatches: topic?.sourceId === claim.sourceId,
      passageSourceMatches: passage?.sourceId === claim.sourceId,
      answerUnitBindingsMatch: Boolean(unit)
        && unit.topicId === claim.topicId
        && unit.sourceId === claim.sourceId
        && unit.passageId === claim.passageId,
      propositionVerbatimInPassage: Boolean(passage?.originalText.includes(claim.proposition)),
      ageScopeMatchesPassage: passage?.ageScope === claim.ageScope,
      claimBoundaryPresent: claim.claimBoundary.trim().length > 0,
      passageBoundaryPresent: Boolean(passage?.claimBoundary.trim()),
      sourceIntegrityClean: source?.integrityState === "verified_clean",
      passageLicenseCleared: source?.passageLicenseDecision === "cleared"
        && passage?.licenseStatus === "approved",
      citationRequired: unit?.visibleCitationRequired === true,
      graphLimitedToOneHop: unit?.maximumGraphHops === 1,
      multiStepMechanismDisabled: unit?.multiStepMechanismAllowed === false,
      candidatePublicationOnly: claim.publicationStatus === "bounded_candidate_not_published",
      evidenceNotOverstated: claim.evidenceLevel === "not_assessed",
      dnaProductRelationNotEstablished: claim.dnaProductRelation === "not_established",
      relationClassNone: claim.relationClass === "none",
      runtimeIneligible: claim.runtimeEligible === false
        && passage?.runtimeEligible === false
        && source?.runtimeEligible === false,
      releaseIneligible: claim.releaseEligible === false
        && passage?.releaseEligible === false
        && source?.releaseEligible === false,
    }
    const failures = Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name)
    return {
      claimId: claim.id,
      topicId: claim.topicId,
      sourceId: claim.sourceId,
      passageId: claim.passageId,
      passed: failures.length === 0,
      checks,
      failures,
    }
  })
}

function buildProbes(candidate: CandidatePackage): Probe[] {
  const supported = candidate.topics.flatMap((topic) => {
    const lexical = [topic.title, ...topic.aliases]
    const anchors = lexical.map((term, index) => ({
      id: `anchor:${topic.id}:${index + 1}`,
      kind: "catalog_anchor" as const,
      question: index === 0
        ? `${term} konusunda genel bilimsel çerçeve nedir?`
        : index === 1
          ? `${term} nasıl tanımlanır ve hangi sınırlarla yorumlanır?`
          : index === 2
            ? `${term} alanında yöntem ve kanıt durumu nedir?`
            : `${term} için kaynakların desteklediği iddia sınırı nedir?`,
      expectedTopicId: topic.id,
    }))
    const natural = NATURAL_PARAPHRASES[topic.id]
    assert(natural?.length === 2, `external_science_qa_paraphrase_missing:${topic.id}`)
    return [
      ...anchors,
      ...natural.map((question, index) => ({
        id: `paraphrase:${topic.id}:${index + 1}`,
        kind: "natural_paraphrase" as const,
        question,
        expectedTopicId: topic.id,
      })),
    ]
  })
  const neighbors = HARD_NEIGHBOR_PAIRS.flatMap((pair) => [
    {
      id: `neighbor:${pair.id}:left`,
      kind: "hard_neighbor" as const,
      pairId: pair.id,
      question: pair.left.question,
      expectedTopicId: pair.left.topicId,
    },
    {
      id: `neighbor:${pair.id}:right`,
      kind: "hard_neighbor" as const,
      pairId: pair.id,
      question: pair.right.question,
      expectedTopicId: pair.right.topicId,
    },
  ])
  const ambiguous = AMBIGUOUS_PROBES.map((question, index) => ({
    id: `ambiguous:${String(index + 1).padStart(2, "0")}`,
    kind: "ambiguous" as const,
    question,
    expectedTopicId: null,
  }))
  const unsupported = UNSUPPORTED_PROBES.map((question, index) => ({
    id: `unsupported:${String(index + 1).padStart(2, "0")}`,
    kind: "unsupported" as const,
    question,
    expectedTopicId: null,
  }))
  return [...supported, ...neighbors, ...ambiguous, ...unsupported]
}

function rankTopics(question: string, candidate: CandidatePackage): Ranking[] {
  const topicById = new Map(candidate.topics.map((entry) => [entry.id, entry]))
  return candidate.lexicalIndex
    .map((entry) => {
      const topic = topicById.get(entry.topicId)
      assert(topic, `external_science_qa_lexical_topic_missing:${entry.topicId}`)
      const match = scoreDnaTextMatch(question, [entry.title, ...entry.aliases])
      return {
        topicId: entry.topicId,
        title: entry.title,
        score: match.score,
        method: match.method,
        pattern: match.pattern,
      }
    })
    .sort((left, right) => right.score - left.score || left.topicId.localeCompare(right.topicId, "en"))
}

function routeQuestion(question: string, candidate: CandidatePackage): {
  actualTopicId: string | null
  top: Ranking | null
  second: Ranking | null
  margin: number
} {
  const ranking = rankTopics(question, candidate)
  const top = ranking[0] ?? null
  const second = ranking[1] ?? null
  const margin = Number(((top?.score ?? 0) - (second?.score ?? 0)).toFixed(6))
  const actualTopicId = top && top.score >= 0.5 && margin >= 0.08 ? top.topicId : null
  return { actualTopicId, top, second, margin }
}

function evaluateProbes(probes: readonly Probe[], candidate: CandidatePackage): ProbeResult[] {
  return probes.map((probe) => {
    const route = routeQuestion(probe.question, candidate)
    const safety = inspectDnaChatSafety(probe.question)
    return {
      ...probe,
      ...route,
      correct: route.actualTopicId === probe.expectedTopicId,
      safetyBlocked: safety.blocked,
      safetyCategory: safety.category,
      safetyCode: safety.code,
    }
  })
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(6))
}

function summarizeProbeKind(results: readonly ProbeResult[], kind: ProbeKind) {
  const rows = results.filter((entry) => entry.kind === kind)
  const correct = rows.filter((entry) => entry.correct).length
  return {
    total: rows.length,
    correct,
    accuracy: ratio(correct, rows.length),
    failures: rows.filter((entry) => !entry.correct).map((entry) => entry.id),
  }
}

function buildTopicCoverage(candidate: CandidatePackage) {
  const claimCounts = new Map<string, number>()
  const passageCounts = new Map<string, Set<string>>()
  const answerUnitCounts = new Map<string, number>()
  for (const claim of candidate.claims) {
    claimCounts.set(claim.topicId, (claimCounts.get(claim.topicId) ?? 0) + 1)
    const passages = passageCounts.get(claim.topicId) ?? new Set<string>()
    passages.add(claim.passageId)
    passageCounts.set(claim.topicId, passages)
  }
  for (const unit of candidate.answerUnits) {
    answerUnitCounts.set(unit.topicId, (answerUnitCounts.get(unit.topicId) ?? 0) + 1)
  }
  const lexicalByTopic = new Map(candidate.lexicalIndex.map((entry) => [entry.topicId, entry]))
  const rows = candidate.topics.map((topic) => {
    const lexical = lexicalByTopic.get(topic.id)
    const claims = claimCounts.get(topic.id) ?? 0
    const passages = passageCounts.get(topic.id)?.size ?? 0
    const answerUnits = answerUnitCounts.get(topic.id) ?? 0
    const covered = claims > 0
      && passages > 0
      && answerUnits === claims
      && Boolean(lexical)
      && (lexical?.aliases.length ?? 0) >= 3
      && (lexical?.keywords.length ?? 0) > 0
    return {
      topicId: topic.id,
      sourceId: topic.sourceId,
      claims,
      passages,
      answerUnits,
      aliases: lexical?.aliases.length ?? 0,
      keywords: lexical?.keywords.length ?? 0,
      covered,
    }
  })
  return {
    expected: EXPECTED_TOPIC_COUNT,
    actual: rows.length,
    covered: rows.filter((entry) => entry.covered).length,
    rows,
  }
}

function buildDeterministicPayload(candidate: CandidatePackage) {
  const claimGuards = buildClaimGuards(candidate)
  const topicCoverage = buildTopicCoverage(candidate)
  const probes = buildProbes(candidate)
  const probeResults = evaluateProbes(probes, candidate)
  const safeTheoryRows = probeResults
  const safeAllowed = safeTheoryRows.filter((entry) => !entry.safetyBlocked).length
  const hardPairsBothCorrect = HARD_NEIGHBOR_PAIRS.filter((pair) => {
    const rows = probeResults.filter((entry) => entry.pairId === pair.id)
    return rows.length === 2 && rows.every((entry) => entry.correct)
  }).length
  const structuralChecks = {
    packageSchema: candidate.schemaVersion === EXPECTED_PACKAGE_VERSION,
    packageHash: candidate.packageSha256 === canonicalSha256(
      withoutKey(candidate as unknown as Record<string, unknown>, "packageSha256"),
    ),
    packageAuthority: candidate.authorityClass === "external_science_candidate",
    runtimeIneligible: candidate.runtimeEligible === false,
    releaseIneligible: candidate.releaseEligible === false,
    activationForbidden: candidate.activationAllowed === false,
    runtimeStillV2: candidate.activeRuntimeGeneration === "v2_legacy",
    noRelations: candidate.relations.length === 0,
    noDnaProductClaims: candidate.counts.dnaProductClaims === 0,
    topicsHashed: candidate.topics.every((entry) =>
      recordHashValid(entry as unknown as Record<string, unknown>, "topicSha256")),
    sourcesHashed: candidate.sources.every((entry) =>
      recordHashValid(entry as unknown as Record<string, unknown>, "sourceSha256")),
    passagesHashed: candidate.passages.every((entry) =>
      recordHashValid(entry as unknown as Record<string, unknown>, "passageSha256")),
    answerUnitsHashed: candidate.answerUnits.every((entry) =>
      recordHashValid(entry as unknown as Record<string, unknown>, "answerUnitSha256")),
    uniqueTopicIds: new Set(candidate.topics.map((entry) => entry.id)).size === candidate.topics.length,
    uniqueSourceIds: new Set(candidate.sources.map((entry) => entry.id)).size === candidate.sources.length,
    uniquePassageIds: new Set(candidate.passages.map((entry) => entry.id)).size === candidate.passages.length,
    uniqueClaimIds: new Set(candidate.claims.map((entry) => entry.id)).size === candidate.claims.length,
    uniqueAnswerUnitIds: new Set(candidate.answerUnits.map((entry) => entry.id)).size === candidate.answerUnits.length,
    declaredCountsMatch: candidate.counts.topics === candidate.topics.length
      && candidate.counts.sources === candidate.sources.length
      && candidate.counts.passages === candidate.passages.length
      && candidate.counts.claims === candidate.claims.length
      && candidate.counts.relations === candidate.relations.length
      && candidate.counts.answerUnits === candidate.answerUnits.length,
    expectedSourceCount: candidate.sources.length === EXPECTED_TOPIC_COUNT,
    lexicalTopicCount: candidate.lexicalIndex.length === EXPECTED_TOPIC_COUNT,
    oneTopicPerSource: new Set(candidate.topics.map((entry) => entry.sourceId)).size
      === candidate.sources.length,
    declaredVerificationClean: Object.values(candidate.verification).every((value) => value === 0),
  }
  const kindSummary = {
    catalogAnchor: summarizeProbeKind(probeResults, "catalog_anchor"),
    naturalParaphrase: summarizeProbeKind(probeResults, "natural_paraphrase"),
    hardNeighbor: summarizeProbeKind(probeResults, "hard_neighbor"),
    ambiguous: summarizeProbeKind(probeResults, "ambiguous"),
    unsupported: summarizeProbeKind(probeResults, "unsupported"),
  }
  const claimGuardsPassed = claimGuards.filter((entry) => entry.passed).length
  const structuralPassed = Object.values(structuralChecks).every(Boolean)
  const bindingPassed = claimGuardsPassed === claimGuards.length && claimGuards.length >= 200
  const coveragePassed = topicCoverage.actual === EXPECTED_TOPIC_COUNT
    && topicCoverage.covered === EXPECTED_TOPIC_COUNT
  const safeTheoryAllowedRate = ratio(safeAllowed, safeTheoryRows.length)
  const hardNeighborAccuracy = kindSummary.hardNeighbor.accuracy
  const unsupportedAbstention = kindSummary.unsupported.accuracy
  const ambiguousAbstention = kindSummary.ambiguous.accuracy
  const anchorAccuracy = kindSummary.catalogAnchor.accuracy
  const paraphraseAccuracy = kindSummary.naturalParaphrase.accuracy
  const developmentRetrievalGate = anchorAccuracy >= 0.95
    && hardNeighborAccuracy >= 0.9
    && unsupportedAbstention >= 0.9
    && safeTheoryAllowedRate >= 0.98
  const flexibilityGate = paraphraseAccuracy >= 0.8 && ambiguousAbstention >= 0.8

  return {
    schemaVersion: QA_VERSION,
    evaluatedPackage: {
      relativePath: CANDIDATE_PACKAGE_RELATIVE_PATH,
      schemaVersion: candidate.schemaVersion,
      basisAt: candidate.basisAt,
      packageSha256: candidate.packageSha256,
      authorityClass: candidate.authorityClass,
      runtimeEligible: candidate.runtimeEligible,
      releaseEligible: candidate.releaseEligible,
      counts: {
        topics: candidate.topics.length,
        sources: candidate.sources.length,
        passages: candidate.passages.length,
        claims: candidate.claims.length,
        relations: candidate.relations.length,
        answerUnits: candidate.answerUnits.length,
      },
    },
    boundaries: {
      networkAccessUsed: false,
      localLlmExecuted: false,
      runtimeFilesMutated: false,
      candidateActivated: false,
      releaseDecisionChanged: false,
      ownerBookAuthorityUsed: false,
    },
    structural: {
      checks: structuralChecks,
      passed: structuralPassed,
    },
    topicCoverage,
    claimPassageBinding: {
      total: claimGuards.length,
      passed: claimGuardsPassed,
      failed: claimGuards.length - claimGuardsPassed,
      coverage: ratio(claimGuardsPassed, claimGuards.length),
      guards: claimGuards,
    },
    retrieval: {
      decisionRule: {
        minimumTopScore: 0.5,
        minimumMargin: 0.08,
        patterns: "candidate lexicalIndex title and aliases; existing deterministic text scorer",
      },
      probes: probeResults,
      summary: kindSummary,
      hardNeighborPairs: {
        total: HARD_NEIGHBOR_PAIRS.length,
        bothCorrect: hardPairsBothCorrect,
        accuracy: ratio(hardPairsBothCorrect, HARD_NEIGHBOR_PAIRS.length),
      },
    },
    overRefusal: {
      safeTheoryProbes: safeTheoryRows.length,
      allowed: safeAllowed,
      blocked: safeTheoryRows.length - safeAllowed,
      allowedRate: safeTheoryAllowedRate,
      blockedProbeIds: safeTheoryRows.filter((entry) => entry.safetyBlocked).map((entry) => entry.id),
    },
    rawScores: {
      structuralIntegrity: structuralPassed ? 1 : 0,
      claimPassageBinding: ratio(claimGuardsPassed, claimGuards.length),
      topicCoverage: ratio(topicCoverage.covered, EXPECTED_TOPIC_COUNT),
      catalogAnchorAccuracy: anchorAccuracy,
      naturalParaphraseAccuracy: paraphraseAccuracy,
      hardNeighborAccuracy,
      unsupportedAbstention,
      ambiguousAbstention,
      safeTheoryNonRefusal: safeTheoryAllowedRate,
    },
    acceptance: {
      offlineIntegrityGate: structuralPassed && bindingPassed && coveragePassed,
      developmentRetrievalGate,
      flexibilityDiagnosticGate: flexibilityGate,
      overallPrebookQa: structuralPassed && bindingPassed && coveragePassed
        ? developmentRetrievalGate && flexibilityGate
          ? "pass_development_only"
          : "partial_development_only"
        : "fail_integrity",
      runtimeReleaseAuthority: "none",
      v3ReleaseDecision: "no_go_unchanged",
    },
    limitations: [
      "The 14 topics each have exactly one source, so cross-source synthesis and contradiction handling are not evaluated.",
      "All 220 claims have evidenceLevel=not_assessed; this QA cannot authorize evidence-strength language.",
      "The candidate has zero graph relations and cannot evaluate multi-hop reasoning.",
      "Claim propositions and passages are English; Turkish generated-answer quality is not evaluated.",
      "Catalog-anchor and hard-neighbor probes are development diagnostics derived from public topic labels, not an independent blinded holdout.",
      "Natural-paraphrase and abstention scores measure a lexical-only offline baseline, not the production engine or an LLM.",
      "The same deterministic safety gate is observed read-only for safe-theory over-refusal; no unsafe-refusal claim is made here.",
      "No local LLM, network lookup, runtime activation, release transition, or owner-book authority was used.",
    ],
  }
}

function buildRun(candidate: CandidatePackage) {
  const deterministicPayload = buildDeterministicPayload(candidate)
  const firstHash = canonicalSha256(deterministicPayload)
  const repeatHashes = Array.from({ length: 20 }, () =>
    canonicalSha256(buildDeterministicPayload(candidate)))
  const deterministic = repeatHashes.every((hash) => hash === firstHash)
  return {
    ...deterministicPayload,
    determinism: {
      repeats: 20,
      uniqueHashes: [...new Set(repeatHashes)].length,
      deterministic,
      evaluationSha256: firstHash,
    },
  }
}

function smallManifest(run: ReturnType<typeof buildRun>, rawOutputSha256: string) {
  return {
    schemaVersion: "dna-external-science-offline-qa-manifest@1",
    recordedAt: new Date().toISOString(),
    qaVersion: QA_VERSION,
    candidatePackage: run.evaluatedPackage,
    rawOutput: {
      researchSsdRelativePath: RAW_OUTPUT_RELATIVE_PATH,
      rawSha256: rawOutputSha256,
      evaluationSha256: run.determinism.evaluationSha256,
    },
    counts: {
      topics: run.topicCoverage.actual,
      sources: run.evaluatedPackage.counts.sources,
      claimsGuarded: run.claimPassageBinding.total,
      queryProbes: run.retrieval.probes.length,
      safeTheoryProbes: run.overRefusal.safeTheoryProbes,
      deterministicRepeats: run.determinism.repeats,
    },
    rawScores: run.rawScores,
    acceptance: run.acceptance,
    determinism: run.determinism,
    limitations: run.limitations,
    releaseBoundary: {
      runtimeGeneration: "v2_legacy",
      candidateRuntimeEligible: false,
      candidateReleaseEligible: false,
      v3ReleaseDecision: "no_go_unchanged",
    },
  }
}

export function stableManifestProjection(manifest: ReturnType<typeof smallManifest>) {
  const { recordedAt: _recordedAt, ...projection } = manifest
  return projection
}

export function assertManifestProjectionMatch(
  recorded: ReturnType<typeof smallManifest>,
  expected: ReturnType<typeof smallManifest>,
): true {
  assert(
    canonicalSha256(stableManifestProjection(recorded))
      === canonicalSha256(stableManifestProjection(expected)),
    "external_science_qa_repo_manifest_drift",
  )
  return true
}

export function main() {
  const repoRoot = resolveSecureRoot(process.cwd())
  assert(existsSync(join(repoRoot, "package.json")), "external_science_qa_repo_root_invalid")
  const researchRoot = resolveResearchRoot(
    process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD",
  )
  const candidatePath = assertContained(researchRoot, join(researchRoot, CANDIDATE_PACKAGE_RELATIVE_PATH))
  const rawOutputPath = assertContained(researchRoot, join(researchRoot, RAW_OUTPUT_RELATIVE_PATH))
  const manifestPath = assertContained(repoRoot, join(repoRoot, REPO_MANIFEST_RELATIVE_PATH))
  assertSecureParentChain(researchRoot, candidatePath, false)
  const candidate = readCandidatePackage(candidatePath)
  const run = buildRun(candidate)
  const rawText = `${JSON.stringify(run, null, 2)}\n`
  const rawOutputSha256 = rawSha256(rawText)
  const manifest = smallManifest(run, rawOutputSha256)

  const writeManifest = process.argv.includes("--write-manifest")
  if (!writeManifest) {
    assert(existsSync(manifestPath), "external_science_qa_repo_manifest_missing_run_with_write_manifest")
    assert(!lstatSync(manifestPath).isSymbolicLink(), "external_science_qa_repo_manifest_symlink_rejected")
    const recorded = JSON.parse(readFileSync(manifestPath, "utf8")) as ReturnType<typeof smallManifest>
    assertManifestProjectionMatch(recorded, manifest)
  }

  const rawWrite = secureAtomicWriteFile(researchRoot, rawOutputPath, rawText)
  assert(rawWrite.sha256 === rawOutputSha256, "external_science_qa_raw_write_hash_drift")
  if (writeManifest) {
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`
    const manifestWrite = secureAtomicWriteFile(repoRoot, manifestPath, manifestText)
    assert(
      manifestWrite.sha256 === rawSha256(manifestText),
      "external_science_qa_manifest_write_hash_drift",
    )
  }

  assert(run.structural.passed, "external_science_qa_structural_integrity_failed")
  assert(run.topicCoverage.covered === EXPECTED_TOPIC_COUNT, "external_science_qa_topic_coverage_failed")
  assert(run.claimPassageBinding.failed === 0, "external_science_qa_claim_binding_failed")
  assert(run.claimPassageBinding.total >= 200, "external_science_qa_claim_guard_count_below_200")
  assert(run.determinism.deterministic, "external_science_qa_determinism_failed")
  assert(run.overRefusal.allowedRate >= 0.98, "external_science_qa_safe_theory_over_refusal_failed")

  console.log(JSON.stringify({
    ok: true,
    qaVersion: QA_VERSION,
    candidatePackageSha256: candidate.packageSha256,
    rawOutput: RAW_OUTPUT_RELATIVE_PATH,
    rawOutputSha256,
    counts: manifest.counts,
    rawScores: run.rawScores,
    acceptance: run.acceptance,
    deterministicRepeats: run.determinism.repeats,
    runtimeReleaseAuthority: "none",
  }, null, 2))
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
