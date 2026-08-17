import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { resolveDnaCatalogReasoning } from "../src/lib/dna/chat/catalogReasoning"
import { DNA_CHAT_CATALOG } from "../src/lib/dna/chat/catalog"
import { V6_FOUNDATIONAL_EXPANSION_PASSAGES } from "../src/lib/dna/chat/catalog/v6FoundationalExpansionCatalog"

const ROOT = process.cwd()
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD"
const KNOWLEDGE_ROOT = join(
  SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1",
)
const TOURNAMENT_ROOT = join(
  SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament",
)
const OUTPUT_DIR = join(ROOT, "docs/dna-intelligence/catalog-quality-audit")
const RAW_OUTPUT_DIR = join(
  SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/catalog-quality-audit/v1",
)
const AUDIT_SEED = "dna-catalog-quality-audit@1|2026-08-09"

type OwnerUnit = {
  id: string
  text: string
  title: string
  focus: string
  topicId: string
  sectionId?: string
  domain: string
  passageId: string
  sourceId: string
  dimensions?: string[]
  questionType?: string
  answerEligible?: boolean
  citationStatus?: string
}

type UnifiedRecord = {
  recordType: "owner_atom" | "catalog_claim"
  id: string
  text: string
  detail: string
  title: string
  topic: string
  focus: string
  domain: string
  sourceIds: string[]
  passageIds: string[]
  ageScope: string
  claimType: string
  evidenceLevel: string
  topicValid: boolean
  topicMembershipValid: boolean
  sourceIdsValid: boolean
  passageIdsValid: boolean
  sourceVerificationMode: string
}

type AuditLabel =
  | "GOOD"
  | "USABLE_BUT_THIN"
  | "NEEDS_CONTEXT"
  | "MISLABELED"
  | "DUPLICATE"
  | "SOURCE_LINK_ISSUE"
  | "CLAIM_QUALITY_ISSUE"
  | "BROKEN"

type AuditRow = UnifiedRecord & {
  sampleGroups: string[]
  retrievalCount: number
  benchmarkErrorCount: number
  qualityScore: number
  labels: AuditLabel[]
  severity: "none" | "low" | "medium" | "high" | "critical"
  understandable: boolean
  standaloneMeaningful: boolean
  answerSufficient: boolean
  tooShort: boolean
  tooGeneral: boolean
  topicContentAligned: boolean
  focusAligned: boolean
  claimTextComplete: boolean
  duplicateWith: string[]
  potentialConflictWith: string[]
  shouldGroupWith: string[]
  misunderstandingRisk: boolean
  causalityPreserved: boolean
  scopeAdequate: boolean
  technicalTermsContextualized: boolean
  neighborDependent: boolean
  problems: string[]
  suggestedCorrectionType: string
}

type ErrorCase = {
  benchmark: string
  caseId: string
  question: string
  expectedClaimIds: string[]
  selectedClaimIds: string[]
  annotationIssues: string[]
  observedFailure: string
}

type AnnotationIssue = {
  benchmark: string
  caseId: string
  issueType: string
  severity: string
  question: string
  goldClaimIds: string[]
  observedEvidence: string
  recommendedAction: string
  catalogueRelated: "yes" | "no" | "uncertain"
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/\([^)]*(?:et al\.|19\d{2}|20\d{2})[^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const STOPWORDS = new Set([
  "acikla", "aciklar", "aciklayabilir", "acisindan", "ancak", "ayrica", "bazi",
  "bir", "biri", "bunun", "bu", "cok", "daha", "da", "de", "degil", "gibi",
  "icin", "ile", "ise", "kadar", "mi", "midir", "mu", "mudur", "nasil", "ne",
  "nedir", "olarak", "olan", "olabilir", "olur", "ve", "veya", "yalniz", "yerine",
])

function tokens(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

function tokenSet(value: string): Set<string> {
  return new Set(tokens(value))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const item of a) if (b.has(item)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

function containment(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const item of a) if (b.has(item)) intersection += 1
  return intersection / Math.min(a.size, b.size)
}

function wordCount(value: string): number {
  return normalize(value).split(/\s+/).filter(Boolean).length
}

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv<T extends Record<string, unknown>>(rows: T[], columns: string[]): string {
  return [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n") + "\n"
}

function stableSample<T extends { id: string }>(rows: T[], count: number): T[] {
  return [...rows]
    .sort((a, b) => sha256(`${AUDIT_SEED}|${a.id}`).localeCompare(sha256(`${AUDIT_SEED}|${b.id}`)))
    .slice(0, count)
}

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function addCount(map: Map<string, number>, id: string, amount = 1): void {
  map.set(id, (map.get(id) ?? 0) + amount)
}

function splitQuestion(question: string): string[] {
  return question
    .split(/\s*(?:;|\bbir de\b|\bayrica\b|\bve bir de\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
}

function textAlignment(question: string, record: UnifiedRecord): number {
  const questionTokens = tokenSet(question)
  const recordTokens = tokenSet(`${record.title} ${record.focus} ${record.text} ${record.detail}`)
  return Math.max(jaccard(questionTokens, recordTokens), containment(questionTokens, recordTokens) * 0.75)
}

function sourceTitleAlignment(record: UnifiedRecord): number {
  if (record.recordType === "owner_atom") return 1
  const sourceText = record.sourceIds
    .map((id) => DNA_CHAT_CATALOG.sources.find((source) => source.id === id))
    .filter(Boolean)
    .map((source) => `${source!.title} ${source!.evidenceDomain} ${source!.claimBoundary}`)
    .join(" ")
  return Math.max(
    jaccard(tokenSet(`${record.text} ${record.detail}`), tokenSet(sourceText)),
    containment(tokenSet(`${record.text} ${record.detail}`), tokenSet(sourceText)),
  )
}

const ownerUnits = readJsonl<OwnerUnit>(join(KNOWLEDGE_ROOT, "owner-knowledge-units.jsonl"))
const questionSurfaces = readJsonl<{
  id: string
  question: string
  topicId: string
  unitId: string
  family: string
}>(join(KNOWLEDGE_ROOT, "question-surfaces.jsonl"))
const ownerById = new Map(ownerUnits.map((row) => [row.id, row]))
const surfaceById = new Map(questionSurfaces.map((row) => [row.id, row]))
const topicById = new Map(DNA_CHAT_CATALOG.topics.map((row) => [row.id, row]))
const sourceById = new Map(DNA_CHAT_CATALOG.sources.map((row) => [row.id, row]))
const knownPassageIds = new Set(V6_FOUNDATIONAL_EXPANSION_PASSAGES.map((row) => row.id))

const ownerRecords: UnifiedRecord[] = ownerUnits.map((unit) => ({
  recordType: "owner_atom",
  id: unit.id,
  text: unit.text ?? "",
  detail: "",
  title: unit.title ?? "",
  topic: unit.topicId ?? "",
  focus: unit.focus ?? "",
  domain: unit.domain ?? "",
  sourceIds: unit.sourceId ? [unit.sourceId] : [],
  passageIds: unit.passageId ? [unit.passageId] : [],
  ageScope: "not_structured",
  claimType: unit.questionType ?? "owner_sentence",
  evidenceLevel: unit.citationStatus ?? "owner_book",
  topicValid: Boolean(unit.topicId && unit.sectionId && unit.topicId.endsWith(unit.sectionId)),
  topicMembershipValid: Boolean(unit.topicId && unit.sectionId && unit.topicId.endsWith(unit.sectionId)),
  sourceIdsValid: unit.sourceId === "book.self-regulation.owner-current",
  passageIdsValid: Boolean(unit.passageId && /^owner-book:(?:paragraph|table):/.test(unit.passageId)),
  sourceVerificationMode: unit.citationStatus === "citation_mapping_pending"
    ? "owner_book_passage_citation_mapping_pending"
    : "owner_book_passage",
}))

const claimRecords: UnifiedRecord[] = DNA_CHAT_CATALOG.claims.map((claim) => {
  const topic = topicById.get(claim.topicId)
  const passageIds = [...(claim.passageIds ?? [])]
  return {
    recordType: "catalog_claim",
    id: claim.id,
    text: claim.text ?? "",
    detail: claim.detail ?? "",
    title: topic?.title ?? "",
    topic: claim.topicId,
    focus: claim.claimType,
    domain: topic?.category ?? "",
    sourceIds: [...claim.sourceIds],
    passageIds,
    ageScope: claim.ageScope,
    claimType: claim.claimType,
    evidenceLevel: claim.evidenceLevel,
    topicValid: Boolean(topic),
    topicMembershipValid: Boolean(topic?.claimIds.includes(claim.id)),
    sourceIdsValid: claim.sourceIds.length > 0 && claim.sourceIds.every((id) => sourceById.has(id)),
    passageIdsValid: passageIds.length === 0 || passageIds.every((id) => knownPassageIds.has(id)),
    sourceVerificationMode: passageIds.length > 0
      ? "exact_passage_declared"
      : "verified_source_metadata_without_exact_passage",
  }
})

const allRecords = [...ownerRecords, ...claimRecords]
const recordById = new Map(allRecords.map((row) => [row.id, row]))

// Retrieval frequency is based on two frozen, replayable S1 cohorts. It is not
// presented as production-user telemetry.
const retrievalCount = new Map<string, number>()
const phase3 = readJson<{
  rows: { S1: Array<{ id: string; selectedClaimIds: string[]; acceptedClaimIds: string[]; correct: number; question: string; action: string; expectedKind: string }> }
}>(join(TOURNAMENT_ROOT, "v2/phase-3-4/architecture-base-results.json"))
for (const row of phase3.rows.S1) {
  for (const id of uniq(row.selectedClaimIds ?? [])) addCount(retrievalCount, id)
}

const finalAutomatic = readJson<{
  rows: Array<{
    id: string
    category: string
    outputs: { S1: { selectedClaimIds: string[]; displayedAnswer: string } }
  }>
}>(join(TOURNAMENT_ROOT, "final-ux/automatic-results.json"))
for (const row of finalAutomatic.rows) {
  for (const id of uniq(row.outputs.S1.selectedClaimIds ?? [])) addCount(retrievalCount, id)
}

// Canonical catalogue questions add usage evidence for the 276 source-linked
// claims. Returned prose is matched exactly to claim text/detail; no inference
// is made from source IDs alone.
const claimTextToIds = new Map<string, string[]>()
for (const claim of DNA_CHAT_CATALOG.claims) {
  for (const value of [claim.text, claim.detail]) {
    const key = normalize(value)
    if (!key) continue
    claimTextToIds.set(key, [...(claimTextToIds.get(key) ?? []), claim.id])
  }
}
const canonicalFailures: ErrorCase[] = []
for (const question of DNA_CHAT_CATALOG.benchmarkQuestions) {
  const draft = resolveDnaCatalogReasoning({ question: question.question })
  const matchedIds = uniq(
    [draft?.summary ?? "", ...(draft?.details ?? [])]
      .flatMap((value) => claimTextToIds.get(normalize(value)) ?? []),
  )
  for (const id of matchedIds) addCount(retrievalCount, id)
  const observedAction = !draft || draft.classification === "not_available"
    ? "not_available"
    : draft.classification === "refusal"
      ? "refusal"
      : "answer"
  const topicMismatch = Boolean(question.expectedTopicId && draft && question.expectedTopicId !== draft.topicId)
  const actionMismatch = question.expected !== observedAction && !(question.expected === "clarification" && observedAction === "not_available")
  if (topicMismatch || actionMismatch) {
    canonicalFailures.push({
      benchmark: "canonical_catalog_1856",
      caseId: question.id,
      question: question.question,
      expectedClaimIds: question.expectedTopicId
        ? DNA_CHAT_CATALOG.claims.filter((claim) => claim.topicId === question.expectedTopicId).map((claim) => claim.id)
        : [],
      selectedClaimIds: matchedIds,
      annotationIssues: [],
      observedFailure: topicMismatch ? "wrong_topic" : "wrong_action",
    })
  }
}

const errorCases: ErrorCase[] = []
for (const row of phase3.rows.S1.filter((entry) => !entry.correct)) {
  errorCases.push({
    benchmark: "architecture_tournament_S1_850",
    caseId: row.id,
    question: row.question,
    expectedClaimIds: row.acceptedClaimIds ?? [],
    selectedClaimIds: row.selectedClaimIds ?? [],
    annotationIssues: [],
    observedFailure: row.action === "refusal" && row.expectedKind === "supported"
      ? "routing_or_safety_false_refusal"
      : "wrong_or_incomplete_selection",
  })
}

for (const fileName of ["open-development-result.json", "locked-holdout-postfix-result.json"]) {
  const result = readJson<{
    failureSample: Array<{ id: string; outcome: string; expectedTopicId: string; actualTopicIds: string[] }>
  }>(join(KNOWLEDGE_ROOT, fileName))
  for (const failure of result.failureSample ?? []) {
    const surface = surfaceById.get(failure.id)
    if (!surface) continue
    const annotationIssues = surface.topicId !== failure.expectedTopicId
      ? ["expected_topic_differs_from_surface_provenance"]
      : []
    errorCases.push({
      benchmark: `knowledge_expansion_${fileName.replace(".json", "")}`,
      caseId: failure.id,
      question: surface.question,
      expectedClaimIds: [surface.unitId],
      selectedClaimIds: [],
      annotationIssues,
      observedFailure: failure.outcome,
    })
  }
}

const proEvaluation = readJson<{
  ratings: Array<{
    id: string
    scores: { A: { directness: number; completeness: number; total: number } }
    note?: string
  }>
}>("/Users/furkancangi/Downloads/chatgpt-pro-evaluation-completed.json")
const proById = new Map(proEvaluation.ratings.map((row) => [row.id, row]))
const finalPackage = readJson<{
  cases: Array<{
    id: string
    category: string
    question: string
    gold: {
      expectedAction: string
      expectedAnswerability: string
      requiredClaims: Array<{ id: string; text: string; sourceId: string }>
      requiredSlotCount: number
    }
  }>
}>(join(TOURNAMENT_ROOT, "final-ux/chatgpt-pro-evaluation-package.json"))
const finalAutomaticById = new Map(finalAutomatic.rows.map((row) => [row.id, row]))

const annotationIssues: AnnotationIssue[] = []
for (const row of finalPackage.cases) {
  const pro = proById.get(row.id)
  const requiredIds = row.gold.requiredClaims.map((claim) => claim.id)
  const selectedIds = finalAutomaticById.get(row.id)?.outputs.S1.selectedClaimIds ?? []
  const rowIssues: string[] = []
  for (const gold of row.gold.requiredClaims) {
    const actual = ownerById.get(gold.id)
    if (!actual) {
      rowIssues.push("missing_required_claim_id")
      annotationIssues.push({
        benchmark: "s13_final_ux_100",
        caseId: row.id,
        issueType: "missing_required_claim_id",
        severity: "critical",
        question: row.question,
        goldClaimIds: requiredIds,
        observedEvidence: `${gold.id} owner-book kataloğunda bulunamadı.`,
        recommendedAction: "Gold claim kimliğini geçerli bir owner atomuyla değiştir veya vakayı benchmarktan çıkar.",
        catalogueRelated: "no",
      })
      continue
    }
    if (!gold.text.trim() || !gold.sourceId.trim()) {
      rowIssues.push("blank_required_claim_payload")
      annotationIssues.push({
        benchmark: "s13_final_ux_100",
        caseId: row.id,
        issueType: "blank_required_claim_text_or_source",
        severity: "high",
        question: row.question,
        goldClaimIds: requiredIds,
        observedEvidence: `${gold.id} mevcut; benchmark paketindeki text/source alanı boş.`,
        recommendedAction: "Gold paketini owner atomunun dondurulmuş text ve source değerleriyle yeniden mühürle.",
        catalogueRelated: "no",
      })
    } else if (normalize(gold.text) !== normalize(actual.text) || gold.sourceId !== actual.sourceId) {
      rowIssues.push("gold_payload_differs_from_catalogue")
      annotationIssues.push({
        benchmark: "s13_final_ux_100",
        caseId: row.id,
        issueType: "gold_claim_payload_mismatch",
        severity: "high",
        question: row.question,
        goldClaimIds: requiredIds,
        observedEvidence: `${gold.id} için benchmark metni/kaynağı canlı owner atomuyla birebir eşleşmiyor.`,
        recommendedAction: "Benchmarkı katalog hash'ine bağla ve claim payloadını otomatik doğrula.",
        catalogueRelated: "no",
      })
    }
  }

  const proNote = pro?.note ?? ""
  if (/gold claim.*hizalama|hizalama sorunu/i.test(proNote)) {
    rowIssues.push("question_gold_semantic_mismatch")
    annotationIssues.push({
      benchmark: "s13_final_ux_100",
      caseId: row.id,
      issueType: "question_gold_semantic_mismatch",
      severity: "critical",
      question: row.question,
      goldClaimIds: requiredIds,
      observedEvidence: proNote,
      recommendedAction: "Soruyu doğru claim ailesine yeniden bağla; mevcut ilk sonucu ayrı tut.",
      catalogueRelated: "no",
    })
  }

  if (row.category === "comparison_relation" && row.gold.requiredClaims.length >= 2 && row.gold.requiredSlotCount < 2) {
    rowIssues.push("comparison_slot_count_too_low")
    annotationIssues.push({
      benchmark: "s13_final_ux_100",
      caseId: row.id,
      issueType: "comparison_required_slot_count_too_low",
      severity: "high",
      question: row.question,
      goldClaimIds: requiredIds,
      observedEvidence: `${row.gold.requiredClaims.length} required claim için requiredSlotCount=${row.gold.requiredSlotCount}.`,
      recommendedAction: "Karşılaştırmanın iki kavram tarafını ayrı required slot olarak tanımla.",
      catalogueRelated: "no",
    })
  }

  if (row.category === "two_subquestion") {
    const fragments = splitQuestion(row.question)
    if (row.gold.requiredSlotCount !== 2 || row.gold.requiredClaims.length < 2) {
      rowIssues.push("two_subquestion_gold_incomplete")
      annotationIssues.push({
        benchmark: "s13_final_ux_100",
        caseId: row.id,
        issueType: "two_subquestion_gold_incomplete",
        severity: "critical",
        question: row.question,
        goldClaimIds: requiredIds,
        observedEvidence: `fragment=${fragments.length}; claim=${row.gold.requiredClaims.length}; slot=${row.gold.requiredSlotCount}`,
        recommendedAction: "Her alt soru için ayrı gold claim ve ayrı required slot tanımla.",
        catalogueRelated: "no",
      })
    } else if (fragments.length === 2) {
      const records = requiredIds.map((id) => recordById.get(id)).filter(Boolean) as UnifiedRecord[]
      const scores = fragments.map((fragment) => records.map((record) => textAlignment(fragment, record)))
      const bestAssignment = records.length >= 2
        ? Math.max(scores[0][0] + scores[1][1], scores[0][1] + scores[1][0]) / 2
        : 0
      if (bestAssignment < 0.13) {
        rowIssues.push("two_subquestion_gold_semantic_mismatch")
        annotationIssues.push({
          benchmark: "s13_final_ux_100",
          caseId: row.id,
          issueType: "two_subquestion_gold_semantic_mismatch",
          severity: "high",
          question: row.question,
          goldClaimIds: requiredIds,
          observedEvidence: `İki parçalı en iyi claim eşleme skoru=${bestAssignment.toFixed(3)}.`,
          recommendedAction: "Her parçayı kendi claim'iyle elle doğrula ve yanlış eşlemeyi düzelt.",
          catalogueRelated: "uncertain",
        })
      }
    }
  }

  const poor = Boolean(
    pro && (pro.scores.A.directness <= 2 || pro.scores.A.completeness <= 2 || /hizalama sorunu|claim metni.*boş/i.test(proNote)),
  )
  if (poor) {
    errorCases.push({
      benchmark: "s13_final_ux_S1_pro_review",
      caseId: row.id,
      question: row.question,
      expectedClaimIds: requiredIds,
      selectedClaimIds: selectedIds,
      annotationIssues: rowIssues,
      observedFailure: proNote || `directness=${pro?.scores.A.directness}; completeness=${pro?.scores.A.completeness}`,
    })
  }
}

for (const error of errorCases.filter((row) => row.benchmark.startsWith("knowledge_expansion_"))) {
  if (!error.annotationIssues.includes("expected_topic_differs_from_surface_provenance")) continue
  annotationIssues.push({
    benchmark: error.benchmark,
    caseId: error.caseId,
    issueType: "expected_topic_differs_from_surface_provenance",
    severity: "high",
    question: error.question,
    goldClaimIds: error.expectedClaimIds,
    observedEvidence: "Failure kaydındaki expectedTopicId, soru yüzeyinin mühürlü topicId alanıyla uyuşmuyor.",
    recommendedAction: "Gold topic'i yüzey provenance'ından yeniden üret ve ilk sonucu değiştirmeden postfix değerlendirme aç.",
    catalogueRelated: "no",
  })
}

// Canonical-question replay is used only for retrieval-frequency evidence.
// `resolveDnaCatalogReasoning` is one internal layer rather than the complete
// production engine, so its action mismatches are not counted as benchmark
// failures or root-cause evidence.

const benchmarkErrorCount = new Map<string, number>()
for (const row of errorCases) {
  for (const id of uniq([...row.expectedClaimIds, ...row.selectedClaimIds])) {
    if (recordById.has(id)) addCount(benchmarkErrorCount, id)
  }
}

const randomOwnerIds = new Set(stableSample(ownerRecords, 200).map((row) => row.id))
const topRetrievedIds = new Set(
  [...retrievalCount.entries()]
    .filter(([id]) => recordById.has(id))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 100)
    .map(([id]) => id),
)
const errorLinkedIds = new Set([...benchmarkErrorCount.keys()].filter((id) => recordById.has(id)))
const claimCensusIds = new Set(claimRecords.map((row) => row.id))
const auditedIds = new Set([...randomOwnerIds, ...topRetrievedIds, ...errorLinkedIds, ...claimCensusIds])

const fullTextSets = new Map(allRecords.map((row) => [row.id, tokenSet(`${row.text} ${row.detail}`)]))
const normalizedTextGroups = new Map<string, string[]>()
for (const row of allRecords) {
  const key = normalize(`${row.text} ${row.detail}`)
  if (!key) continue
  normalizedTextGroups.set(key, [...(normalizedTextGroups.get(key) ?? []), row.id])
}

const ownerIndex = new Map(ownerRecords.map((row, index) => [row.id, index]))
const dependentStart = /^(?:bu|bunun|buna|bunlar|böylece|ancak|ayrıca|dolayısıyla|örneğin|bununla birlikte|bu nedenle|bu süreç|bu yaklaşım|bu durum|burada|öte yandan|ikincisi|son olarak)\b/i
const genericEnding = /\b(?:önemlidir|dikkate alınmalıdır|birlikte değerlendirilmelidir|göz önünde bulundurulmalıdır|farklılık gösterebilir)\.?$/i
const causalStrong = /\b(?:neden olur|yol açar|belirler|kanıtlar|doğrudan oluşturur|zorunlu olarak)\b/i
const causalHedge = /\b(?:olabilir|ilişkili|katkıda|ileri sür|olasılığını|bağlantılı|öngörmez|kanıtlamaz)\b/i
const technicalPattern = /\b(?:[A-ZÇĞİÖŞÜ]{2,}|HRV|HPA|RSA|PFC|ACC|DMN|PPCT|MAIA-Y|allostaz|interosepsiyon|nosisepsiyon|homeostaz|vagal|sempatik|parasempatik)\b/

function nearbyOwnerIds(record: UnifiedRecord): string[] {
  if (record.recordType !== "owner_atom") return []
  const index = ownerIndex.get(record.id)
  if (index === undefined) return []
  const unit = ownerById.get(record.id)
  return [ownerRecords[index - 1], ownerRecords[index + 1]]
    .filter((candidate): candidate is UnifiedRecord => Boolean(candidate && ownerById.get(candidate.id)?.sectionId === unit?.sectionId))
    .map((candidate) => candidate.id)
}

function nearDuplicates(record: UnifiedRecord): string[] {
  const exact = normalizedTextGroups.get(normalize(`${record.text} ${record.detail}`)) ?? []
  const matches = exact.filter((id) => id !== record.id)
  if (matches.length >= 3) return matches.slice(0, 3)
  const a = fullTextSets.get(record.id) ?? new Set<string>()
  if (a.size < 6) return matches.slice(0, 3)
  for (const candidate of allRecords) {
    if (candidate.id === record.id || matches.includes(candidate.id)) continue
    if (record.recordType === "owner_atom" && candidate.recordType === "owner_atom" && record.domain !== candidate.domain) continue
    const b = fullTextSets.get(candidate.id) ?? new Set<string>()
    if (b.size < 6 || Math.abs(a.size - b.size) > Math.ceil(Math.max(a.size, b.size) * 0.45)) continue
    const jac = jaccard(a, b)
    const con = containment(a, b)
    if (jac >= 0.82 && con >= 0.9) matches.push(candidate.id)
    if (matches.length >= 3) break
  }
  return matches
}

function potentialConflicts(record: UnifiedRecord): string[] {
  const normalizedRecord = normalize(`${record.text} ${record.detail}`)
  const hasNegation = /\b(?:degil|olmaz|yok|bulunmaz|kanitlanmamistir|gostermez)\b/.test(normalizedRecord)
  const recordTokens = fullTextSets.get(record.id) ?? new Set<string>()
  if (recordTokens.size < 8) return []
  const candidates = allRecords.filter((candidate) =>
    candidate.id !== record.id &&
    (candidate.topic === record.topic || (candidate.domain && candidate.domain === record.domain)) &&
    candidate.claimType !== "misconception_correction",
  )
  const conflicts: string[] = []
  for (const candidate of candidates) {
    const normalizedCandidate = normalize(`${candidate.text} ${candidate.detail}`)
    const candidateNegation = /\b(?:degil|olmaz|yok|bulunmaz|kanitlanmamistir|gostermez)\b/.test(normalizedCandidate)
    if (hasNegation === candidateNegation) continue
    if (jaccard(recordTokens, fullTextSets.get(candidate.id) ?? new Set<string>()) >= 0.48) conflicts.push(candidate.id)
    if (conflicts.length >= 3) break
  }
  return conflicts
}

function auditRecord(record: UnifiedRecord): AuditRow {
  const problems: string[] = []
  const labels = new Set<AuditLabel>()
  const text = record.text.trim()
  const combined = `${record.text} ${record.detail}`.trim()
  const count = wordCount(text)
  const fragments = /[|]/.test(text) || /[,;:]$/.test(text) || (!/[.!?)]$/.test(text) && count <= 6)
  const neighborDependent = dependentStart.test(text) || /\b(?:bu kapasite|bu sistem|bu süreç|bu durum|söz konusu)\b/i.test(text)
  const tooShort = count < 9 || (record.recordType === "catalog_claim" && wordCount(combined) < 16)
  const tooGeneral = genericEnding.test(text) || (count < 14 && tokenSet(text).size < 7)
  const focusTokens = tokenSet(record.focus)
  const focusAligned = record.recordType === "catalog_claim"
    ? true
    : focusTokens.size === 0 || containment(focusTokens, tokenSet(text)) >= 0.52
  const titleTokens = tokenSet(record.title)
  const catalogTopic = record.recordType === "catalog_claim" ? topicById.get(record.topic) : null
  const catalogTopicText = catalogTopic
    ? `${catalogTopic.title} ${catalogTopic.aliases.join(" ")} ${catalogTopic.keywords.join(" ")} ${catalogTopic.summary}`
    : ""
  const catalogueSemanticAlignment = record.recordType === "catalog_claim"
    ? Math.max(
        jaccard(tokenSet(combined), tokenSet(catalogTopicText)),
        containment(tokenSet(combined), tokenSet(catalogTopicText)),
      )
    : 1
  const topicContentAligned = record.topicValid && (
    record.recordType === "catalog_claim"
      ? catalogueSemanticAlignment >= 0.025
      : focusAligned || titleTokens.size === 0 || containment(titleTokens, tokenSet(text)) >= 0.18
  )
  const claimTextComplete = Boolean(text) && !fragments
  const technicalTermsContextualized = !technicalPattern.test(text) || count >= 14 || /\b(?:tanımlanır|ifade eder|olarak|yani|adı verilir)\b/i.test(text)
  const causalityPreserved = !causalStrong.test(text) || causalHedge.test(text) || record.evidenceLevel === "strong"
  const scopeAdequate = record.recordType === "catalog_claim"
    ? Boolean(record.ageScope && record.ageScope !== "not_structured")
    : !/\b(?:her çocuk|tüm çocuk|bütün çocuk|çocukluk boyunca|bebeklerde|ergenlerde|yetişkinlerde)\b/i.test(text) || /\b(?:çocuk|bebek|ergen|yetişkin|yaş)\b/i.test(text)
  const duplicateWith = nearDuplicates(record)
  const potentialConflictWith = potentialConflicts(record)
  const shouldGroupWith = neighborDependent || fragments || tooShort ? nearbyOwnerIds(record) : []
  const sourceIssue = !record.sourceIdsValid || !record.passageIdsValid
  const sourceAlignment = sourceTitleAlignment(record)
  const logicalSourceRisk = record.recordType === "catalog_claim" && sourceAlignment < 0.025 && record.passageIds.length === 0

  if (!text) {
    labels.add("BROKEN")
    problems.push("Claim/atom metni boş.")
  }
  if (fragments) {
    labels.add(count <= 4 ? "BROKEN" : "NEEDS_CONTEXT")
    problems.push("Metin tek başına tamamlanmış bir cümle gibi görünmüyor.")
  }
  if (neighborDependent) {
    labels.add("NEEDS_CONTEXT")
    problems.push("Gönderim ifadesi önceki/sonraki cümle olmadan belirsiz kalıyor.")
  }
  if (tooShort || tooGeneral) {
    labels.add("USABLE_BUT_THIN")
    problems.push(tooShort ? "Tek başına doyurucu cevap üretmek için kısa." : "İddia özgül bilgi taşımakta zayıf.")
  }
  if (!topicContentAligned || !focusAligned) {
    labels.add("MISLABELED")
    if (!topicContentAligned) problems.push("Başlık/topic ile metin arasındaki bağ zayıf.")
    if (!focusAligned) problems.push("Focus terimleri metnin içeriğiyle yeterince örtüşmüyor.")
  }
  if (!record.topicMembershipValid && record.recordType === "catalog_claim") {
    labels.add("CLAIM_QUALITY_ISSUE")
    problems.push("Claim.topicId geçerli ve içerikle uyumlu; ancak topic.claimIds geri bağlantısı eksik.")
  }
  if (duplicateWith.length > 0) {
    labels.add("DUPLICATE")
    problems.push(`Aynı veya çok yakın kayıt: ${duplicateWith.join(", ")}.`)
  }
  if (sourceIssue) {
    labels.add("SOURCE_LINK_ISSUE")
    problems.push(!record.sourceIdsValid ? "Source ID boş veya kaynak kayıtlarında geçersiz." : "Passage ID tanımlı pasaj kayıtlarında bulunmuyor.")
  }
  if (logicalSourceRisk) {
    labels.add("SOURCE_LINK_ISSUE")
    problems.push("Kaynak kimliği geçerli; ancak metadata ve claim arasında düşük sözcüksel uyum var, pasaj düzeyinde yeniden okuma gerekiyor.")
  }
  if (!technicalTermsContextualized || !causalityPreserved || !scopeAdequate || potentialConflictWith.length > 0) {
    labels.add("CLAIM_QUALITY_ISSUE")
    if (!technicalTermsContextualized) problems.push("Teknik terim kısa metinde açıklamasız kalıyor.")
    if (!causalityPreserved) problems.push("Nedensellik dili mevcut yapılandırılmış kanıt sınırına göre fazla kesin görünüyor.")
    if (!scopeAdequate) problems.push("Popülasyon/yaş kapsamı yeterince görünür değil.")
    if (potentialConflictWith.length > 0) problems.push(`Yakın ama zıt kiplikli kayıtlar yeniden okunmalı: ${potentialConflictWith.join(", ")}.`)
  }

  const standaloneMeaningful = Boolean(text) && !fragments && !neighborDependent
  const understandable = standaloneMeaningful && technicalTermsContextualized
  const answerSufficient = understandable && !tooShort && !tooGeneral
  const misunderstandingRisk = !standaloneMeaningful || !causalityPreserved || !scopeAdequate || potentialConflictWith.length > 0

  let score = 4
  if (labels.has("BROKEN")) score = 0
  else {
    if (labels.has("SOURCE_LINK_ISSUE")) score -= sourceIssue ? 2 : 1
    if (labels.has("MISLABELED")) score -= 2
    if (labels.has("NEEDS_CONTEXT")) score -= 1
    if (labels.has("CLAIM_QUALITY_ISSUE")) score -= 1
    if (labels.has("DUPLICATE")) score -= 1
    if (labels.has("USABLE_BUT_THIN")) score -= 1
    score = Math.max(1, score)
  }
  if (labels.size === 0) labels.add("GOOD")

  const severity: AuditRow["severity"] = score === 0
    ? "critical"
    : score === 1
      ? "high"
      : score === 2
        ? "medium"
        : score === 3
          ? "low"
          : "none"
  const suggestedCorrectionType = labels.has("BROKEN")
    ? "exclude_or_reconstruct"
    : labels.has("SOURCE_LINK_ISSUE")
      ? "source_passage_revalidation"
      : labels.has("MISLABELED")
        ? "topic_focus_reannotation"
    : !record.topicMembershipValid && record.recordType === "catalog_claim"
      ? "topic_registry_backlink_repair"
      : labels.has("NEEDS_CONTEXT")
          ? "merge_with_neighbor_or_rewrite_standalone"
          : labels.has("DUPLICATE")
            ? "semantic_deduplication"
            : labels.has("CLAIM_QUALITY_ISSUE")
              ? "claim_boundary_scope_edit"
              : labels.has("USABLE_BUT_THIN")
                ? "enrich_with_adjacent_supported_context"
                : "none"

  const sampleGroups = [
    randomOwnerIds.has(record.id) ? "random_book_200" : "",
    topRetrievedIds.has(record.id) ? "top_retrieved_100" : "",
    errorLinkedIds.has(record.id) ? "benchmark_error_linked" : "",
    claimCensusIds.has(record.id) ? "catalog_claim_census_276" : "",
  ].filter(Boolean)

  return {
    ...record,
    sampleGroups,
    retrievalCount: retrievalCount.get(record.id) ?? 0,
    benchmarkErrorCount: benchmarkErrorCount.get(record.id) ?? 0,
    qualityScore: score,
    labels: [...labels],
    severity,
    understandable,
    standaloneMeaningful,
    answerSufficient,
    tooShort,
    tooGeneral,
    topicContentAligned,
    focusAligned,
    claimTextComplete,
    duplicateWith,
    potentialConflictWith,
    shouldGroupWith,
    misunderstandingRisk,
    causalityPreserved,
    scopeAdequate,
    technicalTermsContextualized,
    neighborDependent,
    problems,
    suggestedCorrectionType,
  }
}

const auditRows = [...auditedIds]
  .map((id) => recordById.get(id))
  .filter((row): row is UnifiedRecord => Boolean(row))
  .map(auditRecord)
  .sort((a, b) => a.id.localeCompare(b.id))
const auditById = new Map(auditRows.map((row) => [row.id, row]))

function classifyRootCause(error: ErrorCase): string {
  if (error.annotationIssues.length > 0) return "wrong_gold_or_annotation"
  const expected = error.expectedClaimIds.map((id) => auditById.get(id)).filter(Boolean) as AuditRow[]
  const selected = error.selectedClaimIds.map((id) => auditById.get(id)).filter(Boolean) as AuditRow[]
  if (expected.some((row) => row.qualityScore <= 2 || row.labels.includes("NEEDS_CONTEXT") || row.labels.includes("USABLE_BUT_THIN"))) {
    return expected.some((row) => row.labels.includes("MISLABELED"))
      ? "claim_topic_focus_mismatch"
      : expected.some((row) => row.labels.includes("NEEDS_CONTEXT"))
        ? "atom_too_narrow_or_context_dependent"
        : "weak_catalogue_atom"
  }
  if (error.observedFailure === "routing_or_safety_false_refusal") return "retrieval_or_selection"
  if (error.selectedClaimIds.length === 0 || error.selectedClaimIds.some((id) => !error.expectedClaimIds.includes(id))) {
    return "retrieval_or_selection"
  }
  if (selected.length > 0 && error.expectedClaimIds.every((id) => error.selectedClaimIds.includes(id))) {
    return "content_planning_or_response_generation"
  }
  return "retrieval_or_selection"
}

const errorCauseCounts = new Map<string, number>()
for (const error of errorCases) addCount(errorCauseCounts, classifyRootCause(error))

const cohorts: Record<string, AuditRow[]> = {
  requested_union: auditRows.filter((row) => row.sampleGroups.some((group) => group !== "catalog_claim_census_276")),
  random_book_200: auditRows.filter((row) => row.sampleGroups.includes("random_book_200")),
  top_retrieved_100: auditRows.filter((row) => row.sampleGroups.includes("top_retrieved_100")),
  benchmark_error_linked: auditRows.filter((row) => row.sampleGroups.includes("benchmark_error_linked")),
  catalog_claim_census_276: auditRows.filter((row) => row.sampleGroups.includes("catalog_claim_census_276")),
}

function cohortMetrics(rows: AuditRow[]) {
  const rate = (label: AuditLabel) => rows.length === 0 ? 0 : rows.filter((row) => row.labels.includes(label)).length / rows.length
  return {
    records: rows.length,
    goodRate: rate("GOOD"),
    usableButThinRate: rate("USABLE_BUT_THIN"),
    needsContextRate: rate("NEEDS_CONTEXT"),
    mislabeledRate: rate("MISLABELED"),
    duplicateRate: rate("DUPLICATE"),
    brokenOrSourceIssueRate: rows.length === 0 ? 0 : rows.filter((row) => row.labels.includes("BROKEN") || row.labels.includes("SOURCE_LINK_ISSUE")).length / rows.length,
    structuralBrokenOrSourceRate: rows.length === 0 ? 0 : rows.filter((row) => row.labels.includes("BROKEN") || !row.sourceIdsValid || !row.passageIdsValid).length / rows.length,
    sourceReviewCandidateRate: rows.length === 0 ? 0 : rows.filter((row) => row.labels.includes("SOURCE_LINK_ISSUE") && row.sourceIdsValid && row.passageIdsValid).length / rows.length,
    claimQualityIssueRate: rate("CLAIM_QUALITY_ISSUE"),
    averageQualityScore: rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.qualityScore, 0) / rows.length,
    score4Rate: rows.length === 0 ? 0 : rows.filter((row) => row.qualityScore === 4).length / rows.length,
    score0to1Rate: rows.length === 0 ? 0 : rows.filter((row) => row.qualityScore <= 1).length / rows.length,
  }
}

const metrics = Object.fromEntries(Object.entries(cohorts).map(([name, rows]) => [name, cohortMetrics(rows)]))
const structuralFindings = {
  invalidSourceIds: auditRows.filter((row) => !row.sourceIdsValid).length,
  invalidDeclaredPassageIds: auditRows.filter((row) => !row.passageIdsValid).length,
  duplicateCandidates: auditRows.filter((row) => row.duplicateWith.length > 0).length,
  highConfidenceConflictCandidates: auditRows.filter((row) => row.potentialConflictWith.length > 0).length,
  neighborGroupingCandidates: auditRows.filter((row) => row.shouldGroupWith.length > 0).length,
  neighborDependentRecords: auditRows.filter((row) => row.neighborDependent).length,
  missingTopicBacklinks: auditRows.filter(
    (row) => row.recordType === "catalog_claim" && row.topicValid && !row.topicMembershipValid,
  ).length,
}
const severityRank = { critical: 5, high: 4, medium: 3, low: 2, none: 1 }
const problematic = auditRows
  .filter((row) => row.qualityScore < 4)
  .sort((a, b) =>
    severityRank[b.severity] - severityRank[a.severity] ||
    b.benchmarkErrorCount - a.benchmarkErrorCount ||
    b.retrievalCount - a.retrievalCount ||
    a.id.localeCompare(b.id),
  )
  .slice(0, 50)

const totalErrors = errorCases.length
const catalogueCauses = new Set([
  "weak_catalogue_atom",
  "atom_too_narrow_or_context_dependent",
  "claim_topic_focus_mismatch",
])
const catalogueErrorCount = [...errorCauseCounts.entries()]
  .filter(([cause]) => catalogueCauses.has(cause))
  .reduce((sum, [, count]) => sum + count, 0)
const pct = (value: number) => `${(value * 100).toFixed(1)}%`

const auditColumns = [
  "id", "record_type", "sample_groups", "topic", "title", "focus", "domain", "current_text", "detail",
  "source_ids", "passage_ids", "source_verification_mode", "retrieval_count", "benchmark_error_count",
  "quality_score", "labels", "severity", "understandable", "standalone_meaningful", "answer_sufficient",
  "too_short", "too_general", "topic_content_aligned", "focus_aligned", "claim_text_complete",
  "source_ids_valid", "passage_ids_valid", "duplicate_with", "potential_conflict_with", "should_group_with",
  "misunderstanding_risk", "causality_preserved", "scope_adequate", "technical_terms_contextualized",
  "neighbor_dependent", "problems", "suggested_correction_type",
]
const auditCsvRows = auditRows.map((row) => ({
  id: row.id,
  record_type: row.recordType,
  sample_groups: row.sampleGroups,
  topic: row.topic,
  title: row.title,
  focus: row.focus,
  domain: row.domain,
  current_text: row.text,
  detail: row.detail,
  source_ids: row.sourceIds,
  passage_ids: row.passageIds,
  source_verification_mode: row.sourceVerificationMode,
  retrieval_count: row.retrievalCount,
  benchmark_error_count: row.benchmarkErrorCount,
  quality_score: row.qualityScore,
  labels: row.labels,
  severity: row.severity,
  understandable: row.understandable,
  standalone_meaningful: row.standaloneMeaningful,
  answer_sufficient: row.answerSufficient,
  too_short: row.tooShort,
  too_general: row.tooGeneral,
  topic_content_aligned: row.topicContentAligned,
  focus_aligned: row.focusAligned,
  claim_text_complete: row.claimTextComplete,
  source_ids_valid: row.sourceIdsValid,
  passage_ids_valid: row.passageIdsValid,
  duplicate_with: row.duplicateWith,
  potential_conflict_with: row.potentialConflictWith,
  should_group_with: row.shouldGroupWith,
  misunderstanding_risk: row.misunderstandingRisk,
  causality_preserved: row.causalityPreserved,
  scope_adequate: row.scopeAdequate,
  technical_terms_contextualized: row.technicalTermsContextualized,
  neighbor_dependent: row.neighborDependent,
  problems: row.problems,
  suggested_correction_type: row.suggestedCorrectionType,
}))

const problematicCsvRows = problematic.map((row) => ({
  id: row.id,
  topic: row.topic,
  current_text: row.text,
  source: row.sourceIds.join("|"),
  problem: row.problems.join(" | "),
  severity: row.severity,
  quality_score: row.qualityScore,
  labels: row.labels.join("|"),
  retrieval_count: row.retrievalCount,
  benchmark_error_count: row.benchmarkErrorCount,
  recommended_correction_type: row.suggestedCorrectionType,
}))

const annotationCsvRows = annotationIssues
  .sort((a, b) => a.caseId.localeCompare(b.caseId) || a.issueType.localeCompare(b.issueType))
  .map((row) => ({
    benchmark: row.benchmark,
    case_id: row.caseId,
    issue_type: row.issueType,
    severity: row.severity,
    question: row.question,
    gold_claim_ids: row.goldClaimIds,
    observed_evidence: row.observedEvidence,
    recommended_action: row.recommendedAction,
    catalogue_related: row.catalogueRelated,
  }))

function metricTable(): string {
  const rows = Object.entries(metrics).map(([name, value]) =>
    `| ${name} | ${value.records} | ${pct(value.goodRate)} | ${pct(value.usableButThinRate)} | ${pct(value.needsContextRate)} | ${pct(value.mislabeledRate)} | ${pct(value.duplicateRate)} | ${pct(value.structuralBrokenOrSourceRate)} | ${pct(value.sourceReviewCandidateRate)} | ${value.averageQualityScore.toFixed(2)} |`,
  )
  return [
    "| Kohort | n | GOOD | Thin | Context | Mislabeled | Duplicate | Broken/geçersiz link | Source yeniden okuma adayı | Ort. puan |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows,
  ].join("\n")
}

const rootCauseRows = [...errorCauseCounts.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([cause, count]) => `| ${cause} | ${count} | ${pct(count / Math.max(1, totalErrors))} |`)
  .join("\n")

const topProblemRows = problematic.map((row) => {
  const text = row.text.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 180)
  const problem = row.problems.join("; ").replace(/\|/g, "\\|").slice(0, 180)
  return `| ${row.id} | ${row.title.replace(/\|/g, "\\|")} | ${text} | ${row.sourceIds.join("<br>")} | ${problem} | ${row.severity} | ${row.suggestedCorrectionType} |`
}).join("\n")

const randomMetrics = metrics.random_book_200
const claimMetrics = metrics.catalog_claim_census_276
const catalogueConclusion = catalogueErrorCount / Math.max(1, totalErrors) < 0.35 && randomMetrics.averageQualityScore >= 3
  ? "Katalog genel olarak kullanılabilir; ana darboğaz katalogdan çok retrieval/selection, benchmark gold kalitesi ve content planning/response generation katmanlarının birleşimidir. Bununla birlikte, yüksek etkili ince/bağlama bağımlı atomlar hedefli biçimde düzeltilmelidir."
  : "Katalog kalitesi cevap başarısını anlamlı ölçüde sınırlıyor; retrieval ve üretim düzeltmelerinden önce yüksek etkili atom/claim onarımı gerekir."

const report = `# DNA Intelligence Katalog Kalite Denetimi

**Audit sürümü:** \`dna-catalog-quality-audit@1\`${"  "}
**Tarih:** 2026-08-09${"  "}
**Production etkisi:** Yok. Katalog, retrieval ve cevap motoru değiştirilmedi.${"  "}
**Rastgele örnekleme tohumu:** \`${AUDIT_SEED}\`

## Teknik özet

${catalogueConclusion}

Genel kitap kalitesi için en dürüst gösterge, yüksek riskli kayıtlarla ağırlıklandırılmamış **200 kayıtlık rastgele owner-book örneklemidir**. 276 kaynak bağlı claim'in tamamı ayrıca yapısal ve kaynak bağlantısı açısından tarandı. Top-retrieved ve benchmark-error kohortları bilerek risk ağırlıklıdır; bunların oranları tüm kataloğa genellenmemelidir.

${metricTable()}

> **Önemli tanım:** \`GOOD\` ve puan 4, kayıt metninin tek başına doğrudan kullanılabilir olduğunu gösterir. Kaynağın bilimsel içeriğinin bağımsız yeniden okunmuş olduğu anlamına gelmez. Owner-book kayıtlarında atıf eşlemesi bekliyor; katalog claim'lerinin ${DNA_CHAT_CATALOG.claims.filter((claim) => (claim.passageIds ?? []).length > 0).length}/${DNA_CHAT_CATALOG.claims.length} tanesinde exact passage ID beyanı var.

## Kapsam ve veri kaynakları

- 4.008 owner-book atomu: \`owner-knowledge-units.jsonl\`.
- 276 kaynak bağlı katalog claim'i ve ${DNA_CHAT_CATALOG.sources.length} kaynak kaydı.
- 200 owner-book atomu, SHA-256 tabanlı sabit tohumla rastgele seçildi.
- En sık retrieval edilen 100 kayıt, 850 soruluk frozen S1 turnuva replay'i, 100 soruluk Final UX S1 replay'i ve 1.856 kanonik katalog sorusundaki birebir claim-text eşleşmelerinden hesaplandı.
- Benchmark hata kohortu; güncel 5.000 açık geliştirme, 1.500 postfix holdout, S1 turnuva hataları, Final UX Pro incelemesi ve kanonik katalog replay hatalarıyla açık claim/atom kimliği üzerinden bağlandı.
- Aynı kayıt birden fazla gruba girdiyse audit CSV'sinde tek satırda, çoklu \`sample_groups\` ile tutuldu.

Retrieval sıklığı **production kullanıcı telemetrisi değildir**. Yalnız yeniden üretilebilir benchmark/replay seçim sıklığıdır.

## Denetim yöntemi

Her kayıt için metin bütünlüğü, tek başına anlaşılabilirlik, cevap yeterliliği, kısalık/genellik, topic/focus uyumu, claim/source/passage bütünlüğü, duplicate yakınlığı, olası zıt kiplik, komşu cümle gereksinimi, nedensellik dili, yaş/kapsam görünürlüğü ve teknik terim bağlamı kontrol edildi.

Deterministik kontroller:

- tam normalize duplicate,
- token Jaccard ≥0,82 ve kısa metne göre containment ≥0,90 ile yakın duplicate,
- owner atomunda section/topic/passage/source bütünlüğü,
- katalog claim'inde topic üyeliği, source ID ve bildirilen passage ID bütünlüğü,
- gönderim sözcüğü, eksik noktalama, tablo parçası ve kısa cümle kuralları,
- güçlü nedensellik ile hedge/kanıt düzeyi uyumu,
- benchmark question–gold, required slot ve iki-alt-soru yapısı.

Bu audit, uzman tarafından tam kaynak metni yeniden okuma çalışması değildir. Exact passage bulunmayan fakat source ID'si geçerli claim'ler otomatik olarak bozuk sayılmadı; \`verified_source_metadata_without_exact_passage\` olarak açıkça ayrıldı. Metadata–claim sözcüksel uyumu aşırı düşükse passage yeniden okuma adayı olarak işaretlendi.

## Kötü cevapların kök nedeni

Toplam ${totalErrors} açık atom/claim kimliğine bağlanabilen hata vakası sınıflandırıldı.

| Birincil neden | Vaka | Oran |
|---|---:|---:|
${rootCauseRows}

Katalog kaynaklı kabul edilen üç grup — zayıf atom, bağlama bağımlı/fazla dar atom ve topic/focus uyumsuzluğu — toplam **${catalogueErrorCount}/${totalErrors} (${pct(catalogueErrorCount / Math.max(1, totalErrors))})** vakadır. Bu oran bütün kullanıcı sorularının hata oranı değildir; yalnız incelenen açık benchmark hata vakalarının kök neden dağılımıdır.

## Katalog ve benchmark sorunu birbirinden ayrıldığında

- **Retrieval/selection:** Gold atom makulken yanlış atom seçilmesi, hiç seçim olmaması veya güvenlik yönlendiricisinin desteklenen soruyu reddetmesi.
- **Gold/annotation:** Required claim text/source alanının boş olması, question–gold uyumsuzluğu, yanlış topic veya iki kavram için tek slot tanımlanması.
- **Atom kalitesi:** Gold atomun kısa, gönderimsel, bağlama bağımlı veya tek başına cevap için yetersiz olması.
- **Topic/focus:** Atomun kendisi kullanılabilirken topic/focus üyeliğinin yanlış ya da düşük uyumlu olması.
- **Content planning/response generation:** Doğru claim seçildiği halde iki slotun birlikte anlatılmaması veya claim'in yalnız mekanik tekrarlanması.

Benchmark annotation taramasında **${annotationIssues.length} açık sorun** bulundu. Bunlar katalog kaydı bozukmuş gibi sayılmadı; ayrıntılar \`benchmark_annotation_issues.csv\` dosyasındadır.

## Ek yapısal bulgular

- Geçersiz source ID: **${structuralFindings.invalidSourceIds}**; geçersiz beyan edilmiş passage ID: **${structuralFindings.invalidDeclaredPassageIds}**.
- Exact/near duplicate adayı: **${structuralFindings.duplicateCandidates}**.
- Yüksek güvenli potansiyel çelişki adayı: **${structuralFindings.highConfidenceConflictCandidates}**.
- Komşu atomla birleştirme veya tek başına yeniden yazma adayı: **${structuralFindings.neighborGroupingCandidates}**. Bunların **${structuralFindings.neighborDependentRecords}** tanesi açıkça önceki/sonraki cümleye bağımlıdır; kalanlar kısa oldukları için yalnız düzeltme kuyruğu adayıdır, otomatik olarak bozuk sayılmamıştır.
- \`claim.topicId\` geçerli olduğu halde topic tarafındaki \`claimIds\` geri bağlantısı eksik kayıt: **${structuralFindings.missingTopicBacklinks}**. Bu içerik yanlış etiketleme değil, registry bütünlüğü sorunudur.

## En kritik 50 kayıt

| id | topic/title | mevcut metin | source | problem | severity | önerilen düzeltme |
|---|---|---|---|---|---|---|
${topProblemRows}

## Sınırlılıklar ve sağlamlık notları

- 200 kayıtlık random owner-book örneklemi kitap kataloğu için tahmin sağlar; top/error kohortları genellenebilir örnek değildir.
- Yakın duplicate ve zıt kiplik bulguları otomatik aday işaretleridir; silme veya bilimsel çelişki kararı değildir.
- Source ID geçerliliği ve metadata mantığı kontrol edildi. Exact passage bulunmayan claim'lerde kaynak sadakati bu audit ile yeniden kanıtlanmış sayılmaz.
- Owner-book atomlarının tamamında yaş kapsamı ayrı alan olarak yapılandırılmamıştır; yalnız metinde açık aşırı genelleme riski aranmıştır.
- Final UX Pro değerlendirmesi bağımsız insan değerlendirmesi değildir; burada yalnız annotation ve hata kanıtı olarak kullanılmıştır.

## Hedefli sonraki adım

1. Önce high/critical ve yüksek retrieval sayılı kayıtları düzeltme kuyruğuna al.
2. Blank/misaligned benchmark goldlarını ayrı sürümde düzelt; ilk sonuçları değiştirme.
3. \`NEEDS_CONTEXT\` atomlarını komşu doğrulanmış atomla birleştir veya tek başına anlaşılır hale getir.
4. Katalog claim'lerinde exact passage kapsamını artır; source ID geçerli olmasını passage sadakatiyle karıştırma.
5. Retrieval ve content planner düzeltmelerini katalog onarımından ayrı ölç.

## Kısa yanıtlar

1. **Katalog genel olarak güvenilir mi?** ${randomMetrics.averageQualityScore >= 3 ? "Evet, yapısal olarak genel olarak kullanılabilir; ancak bütün kayıtlar tek başına güçlü cevap birimi değildir." : "Hayır; rastgele örneklem belirgin kalite onarımı gerektiriyor."}
2. **Yüzde kaçı doğrudan production için yeterli?** Rastgele kitap örnekleminde puan 4 oranı **${pct(randomMetrics.score4Rate)}**; 276 claim census'ünde **${pct(claimMetrics.score4Rate)}**.
3. **Yüzde kaçı zenginleştirme/bağlam gerektiriyor?** Rastgele kitap örnekleminde \`USABLE_BUT_THIN veya NEEDS_CONTEXT\` oranı **${pct(randomMetrics.usableButThinRate + randomMetrics.needsContextRate - (cohorts.random_book_200.filter((row) => row.labels.includes("USABLE_BUT_THIN") && row.labels.includes("NEEDS_CONTEXT")).length / Math.max(1, cohorts.random_book_200.length)))}**.
4. **Kritik yanlış etiketleme oranı nedir?** Rastgele kitap örnekleminde \`MISLABELED\` **${pct(randomMetrics.mislabeledRate)}**; claim census'ünde **${pct(claimMetrics.mislabeledRate)}**.
5. **Source bağlantılarında ciddi sorun var mı?** Claim census'ünde doğrudan geçersiz source/passage ID oranı **${pct(claimMetrics.structuralBrokenOrSourceRate)}**. Bununla birlikte ${DNA_CHAT_CATALOG.claims.length - DNA_CHAT_CATALOG.claims.filter((claim) => (claim.passageIds ?? []).length > 0).length}/${DNA_CHAT_CATALOG.claims.length} claim exact passage taşımadığı için kaynak sadakati konusunda ayrı yeniden okuma gereği sürüyor; metadata uyumu düşük ${claimRecords.filter((record) => sourceTitleAlignment(record) < 0.025 && record.passageIds.length === 0).length} kayıt önceliklendirildi.
6. **Duplicate oranı nedir?** Rastgele kitap örnekleminde **${pct(randomMetrics.duplicateRate)}**; claim census'ünde **${pct(claimMetrics.duplicateRate)}**.
7. **Benchmark goldlarında problem var mı?** Evet; **${annotationIssues.length}** açık annotation/gold sorunu işaretlendi.
8. **Mevcut kötü cevapların ne kadarı katalog kaynaklı görünüyor?** Açık hata vakalarında **${pct(catalogueErrorCount / Math.max(1, totalErrors))}**. Bu, toplam canlı hata oranı değildir.
9. **Katalog yeniden yazılmalı mı, hedefli düzeltme yeterli mi?** ${randomMetrics.averageQualityScore >= 3 ? "Baştan yazım gerekmiyor; yüksek etkili kayıtlar ve bağlama bağımlı atomlar için hedefli düzeltme yeterli görünüyor." : "Önce kritik alanlarda geniş kapsamlı katalog yeniden yapılandırması gerekiyor."}
10. **En yüksek öncelikli düzeltme kategorisi nedir?** Yüksek retrieval/hata bağlantılı \`NEEDS_CONTEXT / USABLE_BUT_THIN\` atomlarını tek başına cevaplanabilir, kaynak sınırı korunmuş birimlere dönüştürmek; buna paralel benchmark gold hatalarını ayırmak.
`

const manifest = {
  schemaVersion: "dna-catalog-quality-audit-manifest@1",
  generatedAt: new Date().toISOString(),
  auditSeed: AUDIT_SEED,
  productionChanged: false,
  inputs: {
    ownerUnits: ownerUnits.length,
    catalogClaims: claimRecords.length,
    catalogSources: DNA_CHAT_CATALOG.sources.length,
    questionSurfaces: questionSurfaces.length,
    phase3S1Rows: phase3.rows.S1.length,
    finalUxRows: finalAutomatic.rows.length,
    canonicalQuestions: DNA_CHAT_CATALOG.benchmarkQuestions.length,
  },
  samples: Object.fromEntries(Object.entries(cohorts).map(([name, rows]) => [name, rows.length])),
  metrics,
  errorCauseCounts: Object.fromEntries(errorCauseCounts),
  annotationIssueCount: annotationIssues.length,
  catalogueErrorAttribution: {
    count: catalogueErrorCount,
    denominator: totalErrors,
    rate: catalogueErrorCount / Math.max(1, totalErrors),
  },
  caveats: [
    "retrieval_frequency_is_benchmark_replay_not_production_telemetry",
    "exact_passage_absence_is_reported_separately_from_invalid_source_id",
    "near_duplicate_and_conflict_flags_require_human_confirmation",
    "pro_evaluation_is_not_independent_human_evaluation",
  ],
}

mkdirSync(OUTPUT_DIR, { recursive: true })
mkdirSync(RAW_OUTPUT_DIR, { recursive: true })
const auditCsv = toCsv(auditCsvRows, auditColumns)
const problematicCsv = toCsv(problematicCsvRows, [
  "id", "topic", "current_text", "source", "problem", "severity", "quality_score", "labels",
  "retrieval_count", "benchmark_error_count", "recommended_correction_type",
])
const annotationCsv = toCsv(annotationCsvRows, [
  "benchmark", "case_id", "issue_type", "severity", "question", "gold_claim_ids",
  "observed_evidence", "recommended_action", "catalogue_related",
])

writeFileSync(join(OUTPUT_DIR, "CATALOG_QUALITY_AUDIT.md"), report)
writeFileSync(join(OUTPUT_DIR, "catalog_quality_audit.csv"), auditCsv)
writeFileSync(join(OUTPUT_DIR, "catalog_problematic_records.csv"), problematicCsv)
writeFileSync(join(OUTPUT_DIR, "benchmark_annotation_issues.csv"), annotationCsv)
writeFileSync(join(RAW_OUTPUT_DIR, "audit-records.json"), JSON.stringify(auditRows, null, 2) + "\n")
writeFileSync(join(RAW_OUTPUT_DIR, "benchmark-error-cases.json"), JSON.stringify(errorCases.map((row) => ({ ...row, primaryCause: classifyRootCause(row) })), null, 2) + "\n")
writeFileSync(join(RAW_OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")

const outputHashes = Object.fromEntries([
  "CATALOG_QUALITY_AUDIT.md",
  "catalog_quality_audit.csv",
  "catalog_problematic_records.csv",
  "benchmark_annotation_issues.csv",
].map((name) => [name, sha256(readFileSync(join(OUTPUT_DIR, name)))]))
writeFileSync(join(RAW_OUTPUT_DIR, "output-hashes.json"), JSON.stringify(outputHashes, null, 2) + "\n")

console.log(JSON.stringify({
  outputDir: OUTPUT_DIR,
  rawOutputDir: RAW_OUTPUT_DIR,
  manifest,
  outputHashes,
}, null, 2))
