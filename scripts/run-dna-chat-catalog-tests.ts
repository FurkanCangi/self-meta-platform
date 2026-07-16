import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"

import {
  DNA_CHAT_CATALOG,
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS,
  DNA_CHAT_CATALOG_CLAIMS,
  DNA_CHAT_CATALOG_PROVENANCE,
  DNA_CHAT_CATALOG_RELATIONS,
  DNA_CHAT_CATALOG_SAFETY_RULES,
  DNA_CHAT_CATALOG_SOURCES,
  DNA_CHAT_CATALOG_TOPICS,
  DNA_CHAT_CATALOG_VERSION,
  classifyCatalogQueryKind,
  findCatalogTopic,
  getClaimsForTopic,
  getRelationsForTopic,
} from "../src/lib/dna/chat/catalog"
import { VERIFIED_LITERATURE_SOURCES } from "../src/lib/dna/literatureNote"

function assertUnique(values: readonly string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label} benzersiz olmalı`)
}

function sha256(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

function matchCount(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0
}

function percentile(values: readonly number[], p: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0
}

assert.equal(DNA_CHAT_CATALOG.version, DNA_CHAT_CATALOG_VERSION)
assert.equal(DNA_CHAT_CATALOG_VERSION, "dna-chat-catalog@2")
assert.ok(DNA_CHAT_CATALOG_TOPICS.length >= 24, "Dört kategori için yeterli topic bulunmalı")
assert.ok(DNA_CHAT_CATALOG_CLAIMS.length >= 34, "Kaynak bağlı güvenli claim kapsamı eksik")
assert.ok(DNA_CHAT_CATALOG_RELATIONS.length >= 20, "Tek-adımlı graf ilişkileri eksik")
assert.ok(DNA_CHAT_CATALOG_SOURCES.length >= 38, "Doğrulanmış kaynak kapsamı eksik")
assert.ok(DNA_CHAT_CATALOG_SAFETY_RULES.length >= 8, "Katalog güvenlik kuralları eksik")

assertUnique(DNA_CHAT_CATALOG_TOPICS.map((entry) => entry.id), "Topic kimlikleri")
assertUnique(DNA_CHAT_CATALOG_CLAIMS.map((entry) => entry.id), "Claim kimlikleri")
assertUnique(DNA_CHAT_CATALOG_RELATIONS.map((entry) => entry.id), "Relation kimlikleri")
assertUnique(DNA_CHAT_CATALOG_SOURCES.map((entry) => entry.id), "Source kimlikleri")
assertUnique(DNA_CHAT_CATALOG_SAFETY_RULES.map((entry) => entry.id), "Safety kimlikleri")

const categoryCounts = Object.fromEntries(
  [
    "self_regulation",
    "central_nervous_system",
    "autonomic_nervous_system",
    "sympathetic_parasympathetic",
  ].map((category) => [
    category,
    DNA_CHAT_CATALOG_TOPICS.filter((topic) => topic.category === category).length,
  ]),
)
for (const [category, count] of Object.entries(categoryCounts)) {
  assert.ok(count >= 4, `${category} için en az dört canlı topic gerekir`)
}

const topicIds = new Set(DNA_CHAT_CATALOG_TOPICS.map((entry) => entry.id))
const claimIds = new Set(DNA_CHAT_CATALOG_CLAIMS.map((entry) => entry.id))
const sourceIds = new Set(DNA_CHAT_CATALOG_SOURCES.map((entry) => entry.id))

for (const topic of DNA_CHAT_CATALOG_TOPICS) {
  assert.equal(topic.version, DNA_CHAT_CATALOG_VERSION)
  assert.ok(topic.aliases.length > 0 && topic.keywords.length > 0, `${topic.id}: yönlendirme alanı eksik`)
  assert.ok(topic.summary && topic.details.length > 0, `${topic.id}: içerik eksik`)
  assert.ok(topic.claimBoundary, `${topic.id}: iddia sınırı eksik`)
  assert.equal(topic.reviewStatus, "source_verified_expert_pending")
  for (const claimId of topic.claimIds) assert.ok(claimIds.has(claimId), `${topic.id}: bilinmeyen claim ${claimId}`)
  for (const sourceId of topic.sourceIds) assert.ok(sourceIds.has(sourceId), `${topic.id}: bilinmeyen source ${sourceId}`)
}

for (const claim of DNA_CHAT_CATALOG_CLAIMS) {
  assert.ok(topicIds.has(claim.topicId), `${claim.id}: bilinmeyen topic`)
  assert.equal(claim.safetyStatus, "safe")
  assert.equal(claim.sourceVerified, true)
  assert.ok(claim.sourceIds.length > 0, `${claim.id}: canlı claim kaynaksız olamaz`)
  assert.ok(claim.claimType && claim.ageScope && claim.evidenceLevel && claim.dnaRelation)
  for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId), `${claim.id}: bilinmeyen source ${sourceId}`)
}

for (const relation of DNA_CHAT_CATALOG_RELATIONS) {
  assert.ok(topicIds.has(relation.fromTopicId), `${relation.id}: bilinmeyen from topic`)
  assert.ok(topicIds.has(relation.toTopicId), `${relation.id}: bilinmeyen to topic`)
  assert.notEqual(relation.fromTopicId, relation.toTopicId, `${relation.id}: self relation yasak`)
  assert.equal(relation.maxHops, 1, `${relation.id}: yalnız tek-adımlı reasoning kullanılabilir`)
  assert.ok(relation.sourceIds.length > 0, `${relation.id}: relation kaynaksız olamaz`)
  for (const sourceId of relation.sourceIds) assert.ok(sourceIds.has(sourceId), `${relation.id}: bilinmeyen source ${sourceId}`)
}

const dois = DNA_CHAT_CATALOG_SOURCES.flatMap((entry) => entry.doi ? [entry.doi.toLowerCase()] : [])
const pmids = DNA_CHAT_CATALOG_SOURCES.flatMap((entry) => entry.pmid ? [entry.pmid] : [])
assertUnique(dois, "DOI kayıtları")
assertUnique(pmids, "PMID kayıtları")
const existingLiteratureIdByDoi = new Map(
  Object.values(VERIFIED_LITERATURE_SOURCES).flatMap((entry) =>
    entry.doi ? [[entry.doi.toLowerCase(), entry.id] as const] : [],
  ),
)

for (const source of DNA_CHAT_CATALOG_SOURCES) {
  assert.equal(source.sourceVerified, true)
  assert.equal(source.verifiedAt, "2026-07-16")
  assert.ok(source.title && source.authors && source.publication && source.claimBoundary)
  assert.match(source.url, /^https:\/\//, `${source.id}: resmî URL HTTPS olmalı`)
  assert.doesNotMatch(source.url, /sandbox:|utm_|turn\d+(?:search|open|view)|researchgate/i)
  if (source.doi) {
    assert.equal(source.doi, source.doi.trim(), `${source.id}: DOI boşluk içeriyor`)
    assert.doesNotMatch(source.doi, /^https?:\/\//, `${source.id}: DOI yalnız kimlik olmalı`)
    assert.match(source.doi, /^10\.\d{4,9}\//i, `${source.id}: DOI biçimi geçersiz`)
  }
  if (source.pmid) assert.match(source.pmid, /^\d+$/, `${source.id}: PMID biçimi geçersiz`)

  if (source.existingLiteratureId) {
    const existing = VERIFIED_LITERATURE_SOURCES[source.existingLiteratureId]
    assert.ok(existing, `${source.id}: mevcut literatür eşleşmesi bulunamadı`)
    if (source.doi) assert.equal(existing.doi?.toLowerCase(), source.doi.toLowerCase(), `${source.id}: DOI dedupe uyuşmuyor`)
  }
  if (source.doi && existingLiteratureIdByDoi.has(source.doi.toLowerCase())) {
    assert.equal(
      source.existingLiteratureId,
      existingLiteratureIdByDoi.get(source.doi.toLowerCase()),
      `${source.id}: mevcut 38 kaynakla DOI kesişimi tekilleştirilmedi`,
    )
  }
}

const repairedSources = new Map(DNA_CHAT_CATALOG_SOURCES.map((entry) => [entry.id, entry]))
assert.equal(repairedSources.get("BERNTSON_ET_AL_1991")?.doi, "10.1037/0033-295X.98.4.459")
assert.equal(repairedSources.get("DAMPNEY_2016")?.doi, "10.1152/advan.00027.2016")
assert.equal(repairedSources.get("GRAZIANO_DEREFINKO_2013")?.doi, "10.1016/j.biopsycho.2013.04.011")
assert.equal(repairedSources.get("MCINTOSH_ET_AL_1999")?.doi, "10.1111/j.1469-8749.1999.tb00664.x")
assert.equal(repairedSources.get("THAYER_LANE_2009")?.pmid, "18771686")
assert.equal(repairedSources.get("GASIOR_ET_AL_2018")?.pmid, "30405445")
assert.equal(repairedSources.get("WHEDON_ET_AL_2018")?.doi, "10.1002/dev.21636")
assert.equal(repairedSources.get("ALEN_ET_AL_2022")?.doi, "10.1016/j.neubiorev.2022.104734")
assert.equal(repairedSources.get("CHRISTENSEN_ET_AL_2020")?.doi, "10.3389/fnint.2020.00006")
assert.equal(repairedSources.get("PINNA_EDWARDS_2020")?.pmid, "32849058")

const rawTotals = DNA_CHAT_CATALOG_PROVENANCE.reduce(
  (totals, entry) => ({
    claims: totals.claims + entry.rawCounts.claims,
    conceptCards: totals.conceptCards + entry.rawCounts.conceptCards,
    questions: totals.questions + entry.rawCounts.questions,
    sources: totals.sources + entry.rawCounts.sources,
  }),
  { claims: 0, conceptCards: 0, questions: 0, sources: 0 },
)
assert.deepEqual(rawTotals, { claims: 102, conceptCards: 114, questions: 314, sources: 151 })

for (const provenance of DNA_CHAT_CATALOG_PROVENANCE) {
  const filePath = path.join(process.cwd(), provenance.canonicalFile)
  assert.ok(fs.existsSync(filePath), `${provenance.id}: kanonik dosya yok`)
  assert.equal(sha256(filePath), provenance.sha256, `${provenance.id}: SHA-256 uyuşmuyor`)
  assert.equal(provenance.runtimePolicy, "verified_safe_subset_only")
  assert.equal(provenance.expertReview, "pending")
}

const canonicalRecordPatterns = {
  self_regulation: {
    claims: /^\| SR-\d{2} \|/gm,
    conceptCards: /^## KK-\d{2} /gm,
    questions: /^\| SB-\d{2} \|/gm,
    sources: /^\| K\d{2} \|/gm,
  },
  central_nervous_system: {
    claims: /^\| C\d{2} \|/gm,
    conceptCards: /^\| K\d{2} \|/gm,
    questions: /^\| Q\d{2} \|/gm,
    sources: /^\| S\d{2} \|/gm,
  },
  autonomic_nervous_system: {
    claims: /^\| C\d{2} \|/gm,
    conceptCards: /^\| K\d{2} \|/gm,
    questions: /^\| Q\d{2} \|/gm,
    sources: /^\| S\d{2} \|/gm,
  },
  sympathetic_parasympathetic: {
    claims: /^\| İ\d{2} \|/gm,
    conceptCards: /^## KAV-\d{3} /gm,
    questions: /^\| S-\d{3} \|/gm,
    sources: /^\| K\d{2} \|/gm,
  },
} as const

const canonicalRawTotals = { claims: 0, conceptCards: 0, questions: 0, sources: 0 }
for (const provenance of DNA_CHAT_CATALOG_PROVENANCE) {
  const text = fs.readFileSync(path.join(process.cwd(), provenance.canonicalFile), "utf8")
  const patterns = canonicalRecordPatterns[provenance.category]
  const counted = {
    claims: matchCount(text, patterns.claims),
    conceptCards: matchCount(text, patterns.conceptCards),
    questions: matchCount(text, patterns.questions),
    sources: matchCount(text, patterns.sources),
  }
  assert.deepEqual(counted, provenance.rawCounts, `${provenance.id}: ham kayıt sayacı kanonik belgeyle uyuşmuyor`)
  canonicalRawTotals.claims += counted.claims
  canonicalRawTotals.conceptCards += counted.conceptCards
  canonicalRawTotals.questions += counted.questions
  canonicalRawTotals.sources += counted.sources
}
assert.deepEqual(canonicalRawTotals, rawTotals, "Kanonik ham kayıt envanteri provenance toplamıyla uyuşmalı")

const sumsPath = path.join(process.cwd(), "docs", "dna-knowledge", "research-packs", "v1", "SHA256SUMS")
const sums = fs.readFileSync(sumsPath, "utf8")
for (const provenance of DNA_CHAT_CATALOG_PROVENANCE) {
  assert.ok(sums.includes(provenance.sha256), `${provenance.id}: SHA256SUMS kaydı eksik`)
}

assert.equal(DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length, 314)
assertUnique(DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.map((entry) => entry.id), "Benchmark kimlikleri")
assertUnique(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.map((entry) => `${entry.sourceCategory}:${entry.sourceCode}`),
  "Benchmark kaynak kategori/kod çiftleri",
)
assert.equal(
  new Set(DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.map((entry) => entry.question)).size,
  302,
  "Kanonik soru bankasında 302 byte-düzeyi benzersiz metin bulunmalı; paketler arası tekrarlar korunmalı",
)

const canonicalQuestionSources = [
  { category: "self_regulation", code: /^\| SB-\d{2} \|/ },
  { category: "central_nervous_system", code: /^\| Q\d{2} \|/ },
  { category: "autonomic_nervous_system", code: /^\| Q\d{2} \|/ },
  { category: "sympathetic_parasympathetic", code: /^\| S-\d{3} \|/ },
] as const
const provenanceByCategory = new Map(
  DNA_CHAT_CATALOG_PROVENANCE.map((entry) => [entry.category, entry]),
)
const canonicalQuestionRecords = canonicalQuestionSources.flatMap(({ category, code }) => {
  const provenance = provenanceByCategory.get(category)
  assert.ok(provenance, `${category}: provenance bulunamadı`)
  return fs.readFileSync(path.join(process.cwd(), provenance.canonicalFile), "utf8")
    .split("\n")
    .filter((line) => code.test(line))
    .map((canonicalRow) => {
      const cells = canonicalRow.split("|").slice(1, -1).map((cell) => cell.trim())
      assert.ok(cells.length === 3 || cells.length === 4, `${category}: geçersiz soru satırı`)
      const [sourceCode, sourceQuestionCategory, question, documentExpected] = cells.length === 4
        ? cells
        : [cells[0], null, cells[1], cells[2]]
      return { category, sourceCode, sourceQuestionCategory, question, documentExpected, canonicalRow }
    })
})
const catalogQuestionRecords = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.map((entry) => ({
  category: entry.sourceCategory,
  sourceCode: entry.sourceCode,
  sourceQuestionCategory: entry.sourceQuestionCategory,
  question: entry.question,
  documentExpected: entry.documentExpected,
  canonicalRow: entry.canonicalRow,
}))
assert.deepEqual(
  catalogQuestionRecords,
  canonicalQuestionRecords,
  "Benchmark kayıtları dört kanonik Markdown tablosuyla satır-satır ve byte-for-byte eşleşmeli",
)
assert.deepEqual(
  Object.fromEntries(canonicalQuestionSources.map(({ category }) => [
    category,
    catalogQuestionRecords.filter((entry) => entry.category === category).length,
  ])),
  {
    self_regulation: 84,
    central_nervous_system: 60,
    autonomic_nervous_system: 70,
    sympathetic_parasympathetic: 100,
  },
)

function normalizeBenchmarkFamily(value: string) {
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
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function stableBenchmarkHash(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const holdoutCount = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((entry) => entry.holdout).length
assert.ok(holdoutCount / DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length >= 0.3, "Holdout oranı en az %30 olmalı")
const canonicalRefusals = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter(
  (entry) => entry.documentExpected === "Güvenli ret",
)
assert.equal(canonicalRefusals.length, 43, "Dört kanonik tabloda 43 Güvenli ret satırı bulunmalı")
assert.ok(canonicalRefusals.every((entry) => entry.expected === "refusal" && entry.evaluationScope === "safety_refusal"))
const holdoutStatusByFamily = new Map<string, Set<boolean>>()
const refusalFamilies = new Set(canonicalRefusals.map((entry) => entry.semanticFamily))
for (const entry of DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS) {
  assert.equal(entry.semanticFamily, normalizeBenchmarkFamily(entry.question), `${entry.id}: semantik aile normalizasyonu`)
  const statuses = holdoutStatusByFamily.get(entry.semanticFamily) ?? new Set<boolean>()
  statuses.add(entry.holdout)
  holdoutStatusByFamily.set(entry.semanticFamily, statuses)
  const expectedHoldout = refusalFamilies.has(entry.semanticFamily) ||
    stableBenchmarkHash(entry.semanticFamily) % 100 < 40
  assert.equal(entry.holdout, expectedHoldout, `${entry.id}: deterministik holdout seçimi`)
}
assert.ok(
  Array.from(holdoutStatusByFamily.values()).every((statuses) => statuses.size === 1),
  "Aynı semantik soru ailesi eğitim ve bağımsız holdout arasında bölünmemeli",
)
assert.equal(holdoutStatusByFamily.size, 299, "Kanonik benchmark 299 semantik aile içermeli")
const holdoutFamilyCount = Array.from(holdoutStatusByFamily.values()).filter((statuses) => statuses.has(true)).length
assert.ok(holdoutFamilyCount / holdoutStatusByFamily.size >= 0.3, "Semantik soru ailelerinin en az %30'u holdout olmalı")
assert.ok(
  canonicalRefusals.every((entry) => entry.holdout),
  "Bütün 43 kanonik güvenli-ret senaryosu holdout içinde kalmalı",
)

let semanticKindCorrect = 0
let semanticTopicCorrect = 0
const semanticKindFailures: string[] = []
const semanticTopicFailures: string[] = []
const supportedAnswerable = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter(
  (entry) => entry.evaluationScope === "supported_answerable",
)
const kindEvaluable = supportedAnswerable.filter((entry) => entry.expectedQueryKind !== null)
for (const entry of kindEvaluable) {
  const actualKind = classifyCatalogQueryKind(entry.question)
  if (actualKind === entry.expectedQueryKind) semanticKindCorrect += 1
  else semanticKindFailures.push(`${entry.id}: kind ${actualKind}/${entry.expectedQueryKind}`)
}
for (const entry of supportedAnswerable) {
  const actualTopicId = findCatalogTopic(entry.question)?.id ?? null
  if (actualTopicId === entry.expectedTopicId) semanticTopicCorrect += 1
  else semanticTopicFailures.push(`${entry.id}: topic ${actualTopicId ?? "none"}/${entry.expectedTopicId}`)
}
const semanticKindAccuracy = semanticKindCorrect / kindEvaluable.length
const semanticTopicAccuracy = semanticTopicCorrect / supportedAnswerable.length
assert.ok(
  semanticKindAccuracy >= 0.95,
  `Desteklenen/evaluable soru türü doğruluğu %${(semanticKindAccuracy * 100).toFixed(1)}: ` +
  semanticKindFailures.slice(0, 12).join(" | "),
)
assert.ok(
  semanticTopicAccuracy >= 0.95,
  `Desteklenen topic doğruluğu %${(semanticTopicAccuracy * 100).toFixed(1)}: ` +
  semanticTopicFailures.slice(0, 12).join(" | "),
)

const routingCases = [
  ["İnsular korteks nedir?", "cns.insula"],
  ["HRV tam olarak neyi ölçer?", "ans.hrv"],
  ["Merkezi otonom ağ ne demek?", "cns.central_autonomic_network"],
  ["Homeostaz ve allostaz farkı nedir?", "ans.allostasis"],
  ["Polivagal teori kesinleşmiş midir?", "ans.polyvagal"],
] as const
for (const [question, topicId] of routingCases) {
  assert.equal(findCatalogTopic(question)?.id, topicId, `${question}: yanlış topic`)
}
assert.equal(findCatalogTopic("Nefes alıp vermek nedir?"), null, "Kısa EF aliası kelime içinde eşleşmemeli")
assert.equal(findCatalogTopic("Heyecan ne demektir?"), null, "Kısa CAN aliası kelime içinde eşleşmemeli")
assert.equal(
  findCatalogTopic("Bunu biraz daha açıkla", "İnsular korteks")?.id,
  "cns.insula",
  "previousTopic başlık üzerinden çözülebilmeli",
)
assert.equal(
  findCatalogTopic("Peki bunun ilişkisi?", "insula")?.id,
  "cns.insula",
  "previousTopic alias üzerinden çözülebilmeli",
)
assert.equal(
  findCatalogTopic("İnsluar korteks nedir?")?.id,
  "cns.insula",
  "Yaygın insluar yazım hatası güvenli biçimde eşleşmeli",
)
assert.equal(
  findCatalogTopic("İnsular korteks interosepsiyonla nasıl ilişkilidir?")?.id,
  "cns.insula",
  "İlişki sorusunda ilk açık topic korunmalı",
)
assert.ok(
  getRelationsForTopic("cns.insula").some((relation) =>
    [relation.fromTopicId, relation.toTopicId].includes("ans.interoception")
  ),
  "İnsula-interosepsiyon tek-adımlı ilişkisi katalogda bulunmalı",
)
assert.equal(classifyCatalogQueryKind("HRV tam olarak neyi ölçer?"), "measurement")
assert.equal(findCatalogTopic("HRV tam olarak neyi ölçer?")?.id, "ans.hrv")
assert.ok(
  getClaimsForTopic("ans.hrv").some((claim) => claim.claimType === "measurement_boundary"),
  "HRV ölçüm sorusu kaynak bağlı measurement boundary taşımalı",
)

assert.equal(classifyCatalogQueryKind("İnsula nedir?"), "definition")
assert.equal(classifyCatalogQueryKind("Homeostaz ile allostaz arasındaki fark nedir?"), "comparison")
assert.equal(classifyCatalogQueryKind("Çocuklarda HRV yaşa göre değişir mi?"), "development")
assert.equal(classifyCatalogQueryKind("Son raporumu özetle"), "case_finding")
assert.equal(classifyCatalogQueryKind("Rapordaki bulguyu HRV teorisiyle tartış"), "case_theory")

const durations: number[] = []
for (let iteration = 0; iteration < 2_000; iteration += 1) {
  const [question] = routingCases[iteration % routingCases.length]
  const startedAt = performance.now()
  findCatalogTopic(question)
  durations.push(performance.now() - startedAt)
}
const p95 = percentile(durations, 0.95)
assert.ok(p95 < 25, `Katalog yönlendirme p95 ${p95.toFixed(3)} ms; hedef <25 ms`)

console.log(JSON.stringify({
  ok: true,
  version: DNA_CHAT_CATALOG_VERSION,
  rawTotals,
  live: {
    topics: DNA_CHAT_CATALOG_TOPICS.length,
    claims: DNA_CHAT_CATALOG_CLAIMS.length,
    relations: DNA_CHAT_CATALOG_RELATIONS.length,
    sources: DNA_CHAT_CATALOG_SOURCES.length,
    safetyRules: DNA_CHAT_CATALOG_SAFETY_RULES.length,
    benchmarkQuestions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length,
    holdoutCount,
    semanticFamilies: holdoutStatusByFamily.size,
    holdoutFamilies: holdoutFamilyCount,
    familyExclusiveHoldout: true,
    canonicalRefusals: canonicalRefusals.length,
    supportedAnswerable: supportedAnswerable.length,
    kindEvaluable: kindEvaluable.length,
    semanticKindAccuracy: Number((semanticKindAccuracy * 100).toFixed(2)),
    semanticTopicAccuracy: Number((semanticTopicAccuracy * 100).toFixed(2)),
  },
  p95Ms: Number(p95.toFixed(3)),
}, null, 2))

async function verifyOnlineIdentifiers() {
  const doiResults: string[] = []
  for (let offset = 0; offset < dois.length; offset += 5) {
    const batch = dois.slice(offset, offset + 5)
    const resolved = await Promise.all(batch.map(async (doi) => {
      const response = await fetch(
        `https://doi.org/api/handles/${encodeURIComponent(doi)}`,
        { signal: AbortSignal.timeout(15_000) },
      )
      assert.ok(response.ok, `DOI çevrimiçi çözümlenemedi: ${doi} (${response.status})`)
      const body = await response.json() as { responseCode?: number }
      assert.equal(body.responseCode, 1, `DOI Handle kaydı bulunamadı: ${doi}`)
      return doi
    }))
    doiResults.push(...resolved)
  }

  const pmidResponse = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json`,
    { signal: AbortSignal.timeout(20_000) },
  )
  assert.ok(pmidResponse.ok, `PubMed doğrulama isteği başarısız: ${pmidResponse.status}`)
  const pmidBody = await pmidResponse.json() as { result?: { uids?: string[] } }
  const verifiedPmids = new Set(pmidBody.result?.uids ?? [])
  for (const pmid of pmids) assert.ok(verifiedPmids.has(pmid), `PubMed kaydı bulunamadı: ${pmid}`)

  console.log(JSON.stringify({
    ok: true,
    online: true,
    verifiedDois: doiResults.length,
    verifiedPmids: verifiedPmids.size,
  }, null, 2))
}

if (process.argv.includes("--online")) {
  void verifyOnlineIdentifiers().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
