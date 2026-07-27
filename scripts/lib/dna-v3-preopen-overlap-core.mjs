import { createHash } from "node:crypto"

export const PREOPEN_RECEIPT_SCHEMA = "dna-turkish-retrieval-v3-preopen-overlap-receipt@1"
export const PREOPEN_MANIFEST_SCHEMA = "dna-turkish-retrieval-v3-preopen-overlap-manifest@1"

const SHA256_PATTERN = /^[a-f0-9]{64}$/

const SEMANTIC_STOPWORDS = new Set([
  "acikla", "aciklar", "aciklarimisin", "aciklar", "anlat", "anlatir", "bakim",
  "bilgi", "bilimsel", "bir", "bu", "cevap", "detayli", "fark", "genel", "gibi",
  "hangi", "hakkinda", "icin", "ile", "kanit", "kaynak", "kisaca", "konu",
  "konusunda", "kuram", "literatur", "mi", "midir", "nasil", "ne", "neden",
  "nedir", "nelerdir", "olarak", "ozetle", "soru", "soyle", "su", "teori",
  "uzerinden", "ve", "veya", "yanit",
])

export function fail(code) {
  throw new Error(code)
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, child]) => [key, canonicalize(child)]))
  }
  return value
}

export function stableJson(value) {
  return JSON.stringify(canonicalize(value))
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8")
  return createHash("sha256").update(bytes).digest("hex")
}

export function stableSha256(value) {
  return sha256(stableJson(value))
}

export function withoutKey(value, key) {
  return Object.fromEntries(Object.entries(value).filter(([candidate]) => candidate !== key))
}

export function assertExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code)
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const wanted = [...expected].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) fail(code)
}

export function assertSha256(value, code) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail(code)
}

export function normalizeTurkishQuestion(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
    .replace(/\b(?:ne anlama gelir|ne demektir|ne demek|nasil tanimlanir)\b/g, "nedir")
    .replace(/\b(?:aciklar misin|aciklayabilir misin|anlatir misin)\b/g, "acikla")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function editDistanceAtMostOne(left, right) {
  if (left === right) return true
  if (Math.abs(left.length - right.length) > 1) return false
  if (/^\d+$/.test(left) || /^\d+$/.test(right)) return false
  let first = left
  let second = right
  if (first.length > second.length) [first, second] = [second, first]
  let edits = 0
  for (let i = 0, j = 0; i < first.length || j < second.length;) {
    if (first[i] === second[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (first.length === second.length) {
      i += 1
      j += 1
    } else {
      j += 1
    }
  }
  return edits === 1
}

export function isNearDuplicate(leftValue, rightValue) {
  const left = normalizeTurkishQuestion(leftValue).split(" ").filter(Boolean)
  const right = normalizeTurkishQuestion(rightValue).split(" ").filter(Boolean)
  if (!left.length || !right.length) return false
  if (left.join(" ") === right.join(" ")) return true
  if (Math.abs(left.length - right.length) > 1) return false
  const rightUnused = [...right]
  let matches = 0
  for (const token of left) {
    const exactIndex = rightUnused.indexOf(token)
    if (exactIndex >= 0) {
      matches += 1
      rightUnused.splice(exactIndex, 1)
      continue
    }
    const fuzzyIndex = rightUnused.findIndex((candidate) =>
      token.length >= 5 && candidate.length >= 5
      && editDistanceAtMostOne(token, candidate))
    if (fuzzyIndex >= 0) {
      matches += 1
      rightUnused.splice(fuzzyIndex, 1)
    }
  }
  return matches / Math.max(left.length, right.length) >= 0.9
}

function lightStem(token) {
  return token.replace(/(?:lari|leri|lar|ler|dir|tir|dur|tur|dan|den|nin|nun|in|un|lik|lık|luk|si|sı|su|sü)$/, "")
}

export function semanticFamilyFingerprint(value) {
  return [...new Set(normalizeTurkishQuestion(value).split(" ")
    .filter((token) => token.length >= 3 && !SEMANTIC_STOPWORDS.has(token))
    .map(lightStem)
    .filter((token) => token.length >= 3))]
    .sort((left, right) => left.localeCompare(right, "en"))
    .join(" ")
}

export function analyzeOverlap(developmentQuestions, holdoutQuestions) {
  if (!Array.isArray(developmentQuestions) || !Array.isArray(holdoutQuestions)
    || !developmentQuestions.length || !holdoutQuestions.length
    || [...developmentQuestions, ...holdoutQuestions]
      .some((question) => typeof question !== "string" || !question.trim())) {
    fail("dna_v3_preopen_question_input_invalid")
  }
  const developmentExact = new Set(developmentQuestions.map((question) => question.trim()))
  const developmentNormalized = new Set(developmentQuestions.map(normalizeTurkishQuestion))
  const developmentFamilies = new Set(developmentQuestions
    .map(semanticFamilyFingerprint).filter(Boolean))
  let exactOverlap = 0
  let normalizedOverlap = 0
  let nearDuplicateOverlap = 0
  let semanticFamilyOverlap = 0
  for (const question of holdoutQuestions) {
    if (developmentExact.has(question.trim())) exactOverlap += 1
    const normalized = normalizeTurkishQuestion(question)
    if (developmentNormalized.has(normalized)) normalizedOverlap += 1
    if (developmentQuestions.some((candidate) => isNearDuplicate(question, candidate))) {
      nearDuplicateOverlap += 1
    }
    const fingerprint = semanticFamilyFingerprint(question)
    if (fingerprint && developmentFamilies.has(fingerprint)) semanticFamilyOverlap += 1
  }
  return Object.freeze({
    exactOverlap,
    normalizedOverlap,
    nearDuplicateOverlap,
    semanticFamilyOverlap,
  })
}

export function assertZeroOverlap(overlap) {
  assertExactKeys(overlap, [
    "exactOverlap", "normalizedOverlap", "nearDuplicateOverlap", "semanticFamilyOverlap",
  ], "dna_v3_preopen_overlap_fields_invalid")
  if (Object.values(overlap).some((value) => value !== 0)) {
    fail("dna_v3_preopen_overlap_nonzero")
  }
  return overlap
}

export function assertPreopenReceipt(receipt) {
  assertExactKeys(receipt, [
    "schemaVersion", "recordedAt", "status", "inputBindings", "counts", "overlap",
    "methods", "validation", "boundaries", "receiptSha256",
  ], "dna_v3_preopen_receipt_fields_invalid")
  if (receipt.schemaVersion !== PREOPEN_RECEIPT_SCHEMA
    || receipt.status !== "pass_zero_cross_set_overlap"
    || !Number.isFinite(Date.parse(receipt.recordedAt))
    || new Date(receipt.recordedAt).toISOString() !== receipt.recordedAt
    || stableSha256(withoutKey(receipt, "receiptSha256")) !== receipt.receiptSha256) {
    fail("dna_v3_preopen_receipt_identity_invalid")
  }
  assertExactKeys(receipt.inputBindings, [
    "holdoutSealedPayloadSha256", "holdoutFileSha256", "holdoutManifestFileSha256",
    "candidatePackageSha256", "candidatePackageFileSha256", "frozenAdapterSha256",
    "frozenAdapterFileSha256", "workingAdapterFileSha256",
    "developmentFamilyBankFileSha256", "developmentReportFileSha256",
    "freezeManifestFileSha256", "developmentRepoManifestFileSha256",
    "routingCoreFileSha256", "developmentGeneratorFileSha256",
    "artifactBuilderFileSha256", "integrityScriptFileSha256",
    "integrityCoreFileSha256",
  ], "dna_v3_preopen_receipt_binding_fields_invalid")
  for (const hash of Object.values(receipt.inputBindings)) {
    assertSha256(hash, "dna_v3_preopen_receipt_binding_hash_invalid")
  }
  assertExactKeys(receipt.counts, [
    "holdoutQuestions", "developmentQuestions", "tuningQuestions",
    "developmentFamilyHoldoutQuestions", "metamorphicQuestions",
  ], "dna_v3_preopen_receipt_count_fields_invalid")
  if (receipt.counts.holdoutQuestions !== 196 || receipt.counts.developmentQuestions !== 177
    || receipt.counts.tuningQuestions !== 42
    || receipt.counts.developmentFamilyHoldoutQuestions !== 42
    || receipt.counts.metamorphicQuestions !== 93) {
    fail("dna_v3_preopen_receipt_counts_invalid")
  }
  assertZeroOverlap(receipt.overlap)
  assertExactKeys(receipt.methods, [
    "exact", "normalized", "nearDuplicate", "semanticFamily",
  ], "dna_v3_preopen_receipt_method_fields_invalid")
  if (receipt.methods.exact !== "trimmed_utf8_exact@1"
    || receipt.methods.normalized !== "turkish_nfkd_ascii_prompt_normalization@1"
    || receipt.methods.nearDuplicate !== "token_edit_distance_at_most_one_90_percent@1"
    || receipt.methods.semanticFamily !== "sorted_meaningful_light_stem_fingerprint@1") {
    fail("dna_v3_preopen_receipt_methods_invalid")
  }
  assertExactKeys(receipt.validation, [
    "deterministicRepeats", "uniqueAggregateHashes",
  ], "dna_v3_preopen_receipt_validation_fields_invalid")
  if (receipt.validation.deterministicRepeats !== 20
    || receipt.validation.uniqueAggregateHashes !== 1) {
    fail("dna_v3_preopen_receipt_determinism_invalid")
  }
  assertExactKeys(receipt.boundaries, [
    "aggregateOnly", "payloadReadByIntegrityRole", "questionTextStored",
    "questionIdsStored", "failureExamplesStored", "visibleToAdapterTuning",
    "adapterTuningUseAllowed", "independentHumanValidation", "runtimeEligible",
    "releaseEligible", "activationAllowed",
  ], "dna_v3_preopen_receipt_boundary_fields_invalid")
  if (receipt.boundaries?.aggregateOnly !== true
    || receipt.boundaries?.payloadReadByIntegrityRole !== true
    || receipt.boundaries?.questionTextStored !== false
    || receipt.boundaries?.questionIdsStored !== false
    || receipt.boundaries?.failureExamplesStored !== false
    || receipt.boundaries?.visibleToAdapterTuning !== false
    || receipt.boundaries?.adapterTuningUseAllowed !== false
    || receipt.boundaries?.independentHumanValidation !== false
    || receipt.boundaries?.runtimeEligible !== false
    || receipt.boundaries?.releaseEligible !== false
    || receipt.boundaries?.activationAllowed !== false) {
    fail("dna_v3_preopen_receipt_boundary_invalid")
  }
  return receipt
}

export function assertPreopenManifest(manifest) {
  assertExactKeys(manifest, [
    "schemaVersion", "recordedAt", "status", "receipt", "inputBindings", "counts",
    "overlap", "methods", "validation", "boundaries", "manifestSha256",
  ], "dna_v3_preopen_manifest_fields_invalid")
  if (manifest.schemaVersion !== PREOPEN_MANIFEST_SCHEMA
    || manifest.status !== "pass_zero_cross_set_overlap"
    || stableSha256(withoutKey(manifest, "manifestSha256")) !== manifest.manifestSha256
    || manifest.receipt?.researchSsdRelativePath
      !== "Datasets/DNA-Intelligence/evaluations/turkish-retrieval-v3/preopen-integrity/source-derived-v3-overlap-receipt.json"
    || manifest.receipt?.fileMode !== "0600") {
    fail("dna_v3_preopen_manifest_identity_invalid")
  }
  assertSha256(manifest.receipt?.rawSha256, "dna_v3_preopen_manifest_receipt_hash_invalid")
  assertSha256(manifest.receipt?.receiptSha256, "dna_v3_preopen_manifest_receipt_hash_invalid")
  assertPreopenReceipt({
    schemaVersion: PREOPEN_RECEIPT_SCHEMA,
    recordedAt: manifest.recordedAt,
    status: manifest.status,
    inputBindings: manifest.inputBindings,
    counts: manifest.counts,
    overlap: manifest.overlap,
    methods: manifest.methods,
    validation: manifest.validation,
    boundaries: manifest.boundaries,
    receiptSha256: manifest.receipt.receiptSha256,
  })
  return manifest
}
