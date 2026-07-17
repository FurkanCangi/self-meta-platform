import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  DNA_CHAT_RAW_REVIEW_CANONICAL_FILES,
  DNA_CHAT_RAW_REVIEW_MANIFEST,
  type DnaChatRawReviewPackId,
  type DnaChatRawReviewRecordType,
} from "../src/lib/dna/chat/catalog/rawReviewManifest"
import { DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS } from "../src/lib/dna/chat/catalog/benchmarkQuestions"
import { DNA_CHAT_CATALOG_PROVENANCE } from "../src/lib/dna/chat/catalog/provenance"
import { DNA_CHAT_RESEARCH_PACK_CATEGORIES } from "../src/lib/dna/chat/catalog/types"

type CanonicalPattern = Readonly<{
  recordType: DnaChatRawReviewRecordType
  pattern: RegExp
}>

const CANONICAL_PATTERNS: Readonly<Record<DnaChatRawReviewPackId, readonly CanonicalPattern[]>> = {
  self_regulation: [
    { recordType: "claim", pattern: /^\| (SR-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK-\d{2}) /gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  central_nervous_system: [
    { recordType: "claim", pattern: /^\| (C\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^\| (K\d{2}) \|/gm },
    { recordType: "source", pattern: /^\| (S\d{2}) \|/gm },
  ],
  autonomic_nervous_system: [
    { recordType: "claim", pattern: /^\| (C\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^\| (K\d{2}) \|/gm },
    { recordType: "source", pattern: /^\| (S\d{2}) \|/gm },
  ],
  sympathetic_parasympathetic: [
    { recordType: "claim", pattern: /^\| (İ\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KAV-\d{3}) /gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  prefrontal_processes: [
    { recordType: "claim", pattern: /^\| (PFC-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK-\d{2}) /gm },
    { recordType: "source", pattern: /^\| (S\d{1,2}) \|/gm },
  ],
  anterior_cingulate_cortex: [
    { recordType: "claim", pattern: /^\| (ACC-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^### (KK-\d{2}) —/gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  insular_cortex: [
    { recordType: "claim", pattern: /^\| (İ\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^### (KK\d{2}) —/gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  interoception: [
    { recordType: "claim", pattern: /^\| (İ\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK\d{2}) —/gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  arousal_reactivity: [
    { recordType: "claim", pattern: /^\| (UR-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK-\d{2}) /gm },
    { recordType: "source", pattern: /^\| (S\d{2}) \|/gm },
  ],
  recovery_self_organization: [
    { recordType: "claim", pattern: /^\| (T-\d{3}) \|/gm },
    { recordType: "concept_card", pattern: /^\| (KK-\d{2}) \|/gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  sensory_modulation: [
    { recordType: "claim", pattern: /^\| (DM\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK\d{2}) —/gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  emotion_regulation: [
    { recordType: "claim", pattern: /^\| (DD-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK\d{2})\./gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  stress_systems: [
    { recordType: "claim", pattern: /^\| (SS-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK-\d{2}) /gm },
    { recordType: "source", pattern: /^\| (S\d{2}) \|/gm },
  ],
  sleep_daily_rhythm: [
    { recordType: "claim", pattern: /^\| (UGR-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK-\d{2}) —/gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  executive_functions: [
    { recordType: "claim", pattern: /^\| (Yİ\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK\d{2}) —/gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  attention_working_memory: [
    { recordType: "claim", pattern: /^\| (DB-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK\d{2})\./gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  case_report_boundaries: [
    { recordType: "claim", pattern: /^\| (VRY-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK-\d{2}) /gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  dna_six_domains: [
    { recordType: "claim", pattern: /^\| (AA-\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^### (KK-\d{2}) /gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  developmental_differences: [
    { recordType: "claim", pattern: /^\| (GF\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^\| (KK\d{2}) \|/gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
  coregulation: [
    { recordType: "claim", pattern: /^\| (İ\d{2}) \|/gm },
    { recordType: "concept_card", pattern: /^## (KK\d{2})\./gm },
    { recordType: "source", pattern: /^\| (K\d{2}) \|/gm },
  ],
}

const CANONICAL_QUESTION_PATTERNS: Readonly<Record<DnaChatRawReviewPackId, RegExp>> = {
  self_regulation: /^\| SB-\d{2} \|/,
  central_nervous_system: /^\| Q\d{2} \|/,
  autonomic_nervous_system: /^\| Q\d{2} \|/,
  sympathetic_parasympathetic: /^\| S-\d{3} \|/,
  prefrontal_processes: /^\| Q\d{2} \|/,
  anterior_cingulate_cortex: /^\| S\d{3} \|/,
  insular_cortex: /^\| TS\d{2} \|/,
  interoception: /^\| S\d{3} \|/,
  arousal_reactivity: /^\| Q\d{2} \|/,
  recovery_self_organization: /^\| S-\d{3} \|/,
  sensory_modulation: /^\| S\d{3} \|/,
  emotion_regulation: /^\| SQ\d{3} \|/,
  stress_systems: /^\| Q\d{3} \|/,
  sleep_daily_rhythm: /^\| SB-\d{3} \|/,
  executive_functions: /^\| S\d{3} \|/,
  attention_working_memory: /^\| SQ\d{3} \|/,
  case_report_boundaries: /^\| Q-\d{3} \|/,
  dna_six_domains: /^\| S-\d{3} \|/,
  developmental_differences: /^\| S\d{3} \|/,
  coregulation: /^\| S\d{3} \|/,
}

function recordKey(sourcePackId: DnaChatRawReviewPackId, recordType: DnaChatRawReviewRecordType, sourceCode: string) {
  return `${sourcePackId}:${recordType}:${sourceCode}`
}

const canonicalRecords = Object.entries(CANONICAL_PATTERNS).flatMap(([rawSourcePackId, patterns]) => {
  const sourcePackId = rawSourcePackId as DnaChatRawReviewPackId
  const canonicalFile = DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[sourcePackId]
  const markdown = fs.readFileSync(path.join(process.cwd(), canonicalFile), "utf8")

  return patterns.flatMap(({ recordType, pattern }) =>
    Array.from(markdown.matchAll(pattern), (match) => ({
      sourcePackId,
      recordType,
      sourceCode: match[1],
      canonicalFile,
    })),
  )
})

const manifestKeys = DNA_CHAT_RAW_REVIEW_MANIFEST.map((record) =>
  recordKey(record.sourcePackId, record.recordType, record.sourceCode),
)
const canonicalKeys = canonicalRecords.map((record) =>
  recordKey(record.sourcePackId, record.recordType, record.sourceCode),
)

assert.equal(new Set(manifestKeys).size, manifestKeys.length, "Manifest pack/type/sourceCode kayıtları benzersiz olmalı")
assert.equal(new Set(canonicalKeys).size, canonicalKeys.length, "Kanonik pack/type/sourceCode kayıtları benzersiz olmalı")
assert.deepEqual(
  [...manifestKeys].sort(),
  [...canonicalKeys].sort(),
  "Manifest, kanonik Markdown dosyalarındaki her non-question kaydı bire bir karşılamalı",
)

assert.equal(
  new Set(DNA_CHAT_RAW_REVIEW_MANIFEST.map((record) => record.id)).size,
  DNA_CHAT_RAW_REVIEW_MANIFEST.length,
  "Stable manifest kimlikleri benzersiz olmalı",
)

for (const record of DNA_CHAT_RAW_REVIEW_MANIFEST) {
  assert.equal(record.canonicalFile, DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[record.sourcePackId])
  assert.equal(record.category, DNA_CHAT_RESEARCH_PACK_CATEGORIES[record.sourcePackId])
  assert.equal(record.reviewStatus, "expert_pending")
  assert.equal(record.runtimeDisposition, "cataloged_for_review")
  assert.match(record.id, /^raw\.[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/)
}

const totals = DNA_CHAT_RAW_REVIEW_MANIFEST.reduce(
  (counts, record) => {
    if (record.recordType === "claim") counts.claims += 1
    if (record.recordType === "concept_card") counts.conceptCards += 1
    if (record.recordType === "source") counts.sources += 1
    return counts
  },
  { claims: 0, conceptCards: 0, sources: 0 },
)

assert.deepEqual(totals, { claims: 797, conceptCards: 912, sources: 994 })
assert.equal(DNA_CHAT_RAW_REVIEW_MANIFEST.length, 2703)

const v2PackIds: readonly DnaChatRawReviewPackId[] = [
  "prefrontal_processes",
  "anterior_cingulate_cortex",
  "insular_cortex",
  "interoception",
]

const v3PackIds: readonly DnaChatRawReviewPackId[] = [
  "arousal_reactivity",
  "recovery_self_organization",
  "sensory_modulation",
  "emotion_regulation",
]

const v4PackIds: readonly DnaChatRawReviewPackId[] = [
  "stress_systems",
  "sleep_daily_rhythm",
  "executive_functions",
  "attention_working_memory",
]

const v5PackIds: readonly DnaChatRawReviewPackId[] = [
  "case_report_boundaries",
  "dna_six_domains",
  "developmental_differences",
  "coregulation",
]

const canonicalQuestionRows = Object.entries(CANONICAL_QUESTION_PATTERNS).flatMap(([rawSourcePackId, pattern]) => {
  const sourcePackId = rawSourcePackId as DnaChatRawReviewPackId
  const canonicalFile = DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[sourcePackId]
  return fs.readFileSync(path.join(process.cwd(), canonicalFile), "utf8")
    .split("\n")
    .filter((line) => pattern.test(line))
    .map((canonicalRow) => ({ sourcePackId, canonicalRow }))
})
const benchmarkQuestionRows = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.map((record) => ({
  sourcePackId: record.sourcePackId,
  canonicalRow: record.canonicalRow,
}))
assert.deepEqual(
  benchmarkQuestionRows,
  canonicalQuestionRows,
  "Benchmark kayıtları yirmi kanonik soru tablosuyla sıralı ve byte-for-byte eşleşmeli",
)
assert.equal(DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length, 1856)
assert.equal(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((record) => v2PackIds.includes(record.sourcePackId)).length,
  318,
  "V2 paketlerinde 318 gerçek soru satırı bulunmalı",
)
assert.equal(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((record) => v3PackIds.includes(record.sourcePackId)).length,
  366,
  "V3 paketlerinde 366 gerçek soru satırı bulunmalı",
)
assert.equal(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((record) => v4PackIds.includes(record.sourcePackId)).length,
  420,
  "V4 paketlerinde 420 gerçek soru satırı bulunmalı",
)
assert.equal(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((record) => v5PackIds.includes(record.sourcePackId)).length,
  438,
  "V5 paketlerinde 438 gerçek soru satırı bulunmalı",
)
assert.deepEqual(
  Object.fromEntries(v5PackIds.map((sourcePackId) => [
    sourcePackId,
    {
      claims: DNA_CHAT_RAW_REVIEW_MANIFEST.filter((record) =>
        record.sourcePackId === sourcePackId && record.recordType === "claim").length,
      conceptCards: DNA_CHAT_RAW_REVIEW_MANIFEST.filter((record) =>
        record.sourcePackId === sourcePackId && record.recordType === "concept_card").length,
      questions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((record) =>
        record.sourcePackId === sourcePackId).length,
      sources: DNA_CHAT_RAW_REVIEW_MANIFEST.filter((record) =>
        record.sourcePackId === sourcePackId && record.recordType === "source").length,
    },
  ])),
  {
    case_report_boundaries: { claims: 48, conceptCards: 51, questions: 110, sources: 50 },
    dna_six_domains: { claims: 66, conceptCards: 63, questions: 132, sources: 91 },
    developmental_differences: { claims: 54, conceptCards: 48, questions: 80, sources: 54 },
    coregulation: { claims: 50, conceptCards: 75, questions: 116, sources: 60 },
  },
  "V5 ham paket sayıları kanonik teslimlerle eşleşmeli",
)
assert.ok(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS
    .filter((record) => [
      "sensory_modulation",
      "sleep_daily_rhythm",
      "executive_functions",
      "dna_six_domains",
      "developmental_differences",
    ].includes(record.sourcePackId))
    .every((record) => Boolean(record.sourceAnswerGuidance)),
  "Beş ve altı sütunlu kanonik soru tablolarının yanıt yönü kayıpsız korunmalı",
)
assert.ok(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS
    .filter((record) => ![
      "sensory_modulation",
      "sleep_daily_rhythm",
      "executive_functions",
      "dna_six_domains",
      "developmental_differences",
    ].includes(record.sourcePackId))
    .every((record) => record.sourceAnswerGuidance === null),
  "Beşinci alanı olmayan soru tablolarına yapay yönlendirme eklenmemeli",
)
assert.ok(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS
    .filter((record) => ["executive_functions", "developmental_differences"].includes(record.sourcePackId))
    .every((record) => Boolean(record.sourceCitationCodes)),
  "Altıncı kanonik kaynak-kodu alanı kayıpsız korunmalı",
)
assert.ok(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS
    .filter((record) => !["executive_functions", "developmental_differences"].includes(record.sourcePackId))
    .every((record) => record.sourceCitationCodes === null),
  "Altıncı alanı olmayan soru tablolarına yapay kaynak kodu eklenmemeli",
)
assert.equal(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((record) => record.expected === "refusal" && !record.holdout).length,
  0,
  "Güvenli ret sorularının tamamı holdout olmalı",
)
assert.equal(
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((record) => record.documentExpected === "Güvenli ret").length,
  329,
  "Yirmi kanonik soru bankasında toplam 329 Güvenli ret satırı bulunmalı",
)

assert.equal(DNA_CHAT_CATALOG_PROVENANCE.length, 20)
assert.equal(
  new Set(DNA_CHAT_CATALOG_PROVENANCE.map((record) => record.sourcePackId)).size,
  DNA_CHAT_CATALOG_PROVENANCE.length,
  "Her araştırma paketinin tek provenance kaydı olmalı",
)
for (const provenance of DNA_CHAT_CATALOG_PROVENANCE) {
  const canonicalFile = DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[provenance.sourcePackId]
  const canonicalPath = path.join(process.cwd(), canonicalFile)
  const bytes = fs.readFileSync(canonicalPath)
  const actualSha256 = createHash("sha256").update(bytes).digest("hex")
  assert.equal(provenance.canonicalFile, canonicalFile)
  assert.equal(provenance.category, DNA_CHAT_RESEARCH_PACK_CATEGORIES[provenance.sourcePackId])
  assert.equal(provenance.sha256, actualSha256, `${provenance.sourcePackId}: SHA-256 uyuşmuyor`)
  assert.deepEqual(provenance.rawCounts, {
    claims: DNA_CHAT_RAW_REVIEW_MANIFEST.filter((record) =>
      record.sourcePackId === provenance.sourcePackId && record.recordType === "claim").length,
    conceptCards: DNA_CHAT_RAW_REVIEW_MANIFEST.filter((record) =>
      record.sourcePackId === provenance.sourcePackId && record.recordType === "concept_card").length,
    questions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((record) =>
      record.sourcePackId === provenance.sourcePackId).length,
    sources: DNA_CHAT_RAW_REVIEW_MANIFEST.filter((record) =>
      record.sourcePackId === provenance.sourcePackId && record.recordType === "source").length,
  })
  const sums = fs.readFileSync(path.join(path.dirname(canonicalPath), "SHA256SUMS"), "utf8")
  assert.ok(
    sums.includes(`${actualSha256}  ${path.basename(canonicalPath)}`),
    `${provenance.sourcePackId}: SHA256SUMS kaydı bulunamadı`,
  )
}

for (const sourcePackId of [...v2PackIds, ...v3PackIds, ...v4PackIds, ...v5PackIds]) {
  const canonicalFile = DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[sourcePackId]
  const bytes = fs.readFileSync(path.join(process.cwd(), canonicalFile))
  assert.equal(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, `${sourcePackId}: UTF-8 BOM olmamalı`)
}

console.log(JSON.stringify({
  ok: true,
  researchPacks: Object.keys(CANONICAL_PATTERNS).length,
  manifestRecords: DNA_CHAT_RAW_REVIEW_MANIFEST.length,
  canonicalRecords: canonicalRecords.length,
  totals,
  reviewStatus: "expert_pending",
  runtimeDisposition: "cataloged_for_review",
}, null, 2))
