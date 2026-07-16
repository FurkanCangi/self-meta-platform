import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  DNA_CHAT_RAW_REVIEW_CANONICAL_FILES,
  DNA_CHAT_RAW_REVIEW_MANIFEST,
  type DnaChatRawReviewCategory,
  type DnaChatRawReviewRecordType,
} from "../src/lib/dna/chat/catalog/rawReviewManifest"

type CanonicalPattern = Readonly<{
  recordType: DnaChatRawReviewRecordType
  pattern: RegExp
}>

const CANONICAL_PATTERNS: Readonly<Record<DnaChatRawReviewCategory, readonly CanonicalPattern[]>> = {
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
}

function recordKey(category: DnaChatRawReviewCategory, recordType: DnaChatRawReviewRecordType, sourceCode: string) {
  return `${category}:${recordType}:${sourceCode}`
}

const canonicalRecords = Object.entries(CANONICAL_PATTERNS).flatMap(([rawCategory, patterns]) => {
  const category = rawCategory as DnaChatRawReviewCategory
  const canonicalFile = DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[category]
  const markdown = fs.readFileSync(path.join(process.cwd(), canonicalFile), "utf8")

  return patterns.flatMap(({ recordType, pattern }) =>
    Array.from(markdown.matchAll(pattern), (match) => ({
      category,
      recordType,
      sourceCode: match[1],
      canonicalFile,
    })),
  )
})

const manifestKeys = DNA_CHAT_RAW_REVIEW_MANIFEST.map((record) =>
  recordKey(record.category, record.recordType, record.sourceCode),
)
const canonicalKeys = canonicalRecords.map((record) =>
  recordKey(record.category, record.recordType, record.sourceCode),
)

assert.equal(new Set(manifestKeys).size, manifestKeys.length, "Manifest category/type/sourceCode kayıtları benzersiz olmalı")
assert.equal(new Set(canonicalKeys).size, canonicalKeys.length, "Kanonik category/type/sourceCode kayıtları benzersiz olmalı")
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
  assert.equal(record.canonicalFile, DNA_CHAT_RAW_REVIEW_CANONICAL_FILES[record.category])
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

assert.deepEqual(totals, { claims: 102, conceptCards: 114, sources: 151 })
assert.equal(DNA_CHAT_RAW_REVIEW_MANIFEST.length, 367)

console.log(JSON.stringify({
  ok: true,
  manifestRecords: DNA_CHAT_RAW_REVIEW_MANIFEST.length,
  canonicalRecords: canonicalRecords.length,
  totals,
  reviewStatus: "expert_pending",
  runtimeDisposition: "cataloged_for_review",
}, null, 2))
