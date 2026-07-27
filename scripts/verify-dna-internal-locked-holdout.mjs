#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { extname, join, relative, resolve, sep } from "node:path"

const MANIFEST_PATH = resolve(
  "docs/dna-intelligence/program/evidence/internal-locked-turkish-holdout-current.json",
)
const EXPECTED_LABEL = "internal_locked_holdout_not_independent_human_validation"
const EXPECTED_SCHEMA = "dna-internal-locked-turkish-holdout@1"
const EXPECTED_SPLITS = Object.freeze({
  natural_supported: 70,
  hard_neighbor: 14,
  ambiguous: 14,
  unsupported: 14,
  safe_theory_control: 14,
})
const REQUIRED_ITEM_KEYS = Object.freeze([
  "ageBoundary",
  "allowedClaimIds",
  "answerability",
  "causalBoundary",
  "expectedTopic",
  "forbiddenTopics",
  "id",
  "itemSha256",
  "provenance",
  "queryKind",
  "question",
  "questionSha256",
  "referenceAnswer",
  "safetyBoundary",
  "semanticFamily",
  "split",
])

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
}

function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8")
  return createHash("sha256").update(input).digest("hex")
}

function stableSha256(value) {
  return sha256(stableJson(value))
}

function fail(code) {
  throw new Error(code)
}

function exactKeys(value, keys, code) {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  const expected = [...keys].sort((left, right) => left.localeCompare(right, "en"))
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(code)
  }
}

function normalizeTurkish(value) {
  return value
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

function nearDuplicate(leftValue, rightValue) {
  const left = normalizeTurkish(leftValue).split(" ").filter(Boolean)
  const right = normalizeTurkish(rightValue).split(" ").filter(Boolean)
  const leftText = left.join(" ")
  const rightText = right.join(" ")
  if (!leftText || !rightText) return false
  if (leftText === rightText) return true
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
      token.length >= 5 && candidate.length >= 5 && editDistanceAtMostOne(token, candidate))
    if (fuzzyIndex >= 0) {
      matches += 1
      rightUnused.splice(fuzzyIndex, 1)
    }
  }
  return matches / Math.max(left.length, right.length) >= 0.9
}

function readJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    fail(code)
  }
}

function assertResearchSsdRoot() {
  const configured = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  if (!existsSync(configured) || !lstatSync(configured).isDirectory()) {
    fail("dna_locked_holdout_research_ssd_missing")
  }
  const root = realpathSync(configured)
  if (root !== "/Volumes/ResearchSSD" && !root.startsWith(`/Volumes/ResearchSSD${sep}`)) {
    fail("dna_locked_holdout_local_fallback_forbidden")
  }
  return root
}

function resolveInside(root, relativePath, code) {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("..")) fail(code)
  const candidate = resolve(root, relativePath)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) fail(code)
  return candidate
}

function assertRegularFileInsideSsd(root, path, options = {}) {
  const relativePath = relative(root, path)
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    fail(options.code || "dna_locked_holdout_path_escape")
  }
  let current = root
  const parts = relativePath.split(sep).filter(Boolean)
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index])
    if (!existsSync(current)) fail(options.code || "dna_locked_holdout_path_missing")
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) fail(options.symlinkCode || "dna_locked_holdout_symlink_forbidden")
    if (index < parts.length - 1 && !stat.isDirectory()) {
      fail(options.code || "dna_locked_holdout_parent_not_directory")
    }
    if (index === parts.length - 1 && !stat.isFile()) {
      fail(options.code || "dna_locked_holdout_leaf_not_regular_file")
    }
  }
  const real = realpathSync(path)
  if (real !== root && !real.startsWith(`${root}${sep}`)) {
    fail(options.code || "dna_locked_holdout_realpath_escape")
  }
  if (options.mode !== undefined && (lstatSync(path).mode & 0o777) !== options.mode) {
    fail(options.modeCode || "dna_locked_holdout_mode_mismatch")
  }
  return real
}

function collectQuestionStrings(root) {
  const results = new Set()
  const allowedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json"])
  const excludedDirectories = new Set([".git", ".next", ".tmp", "node_modules"])
  const roots = [join(root, "scripts"), join(root, "src/lib/dna/chat")]
  for (const scanRoot of roots) {
    const stack = [scanRoot]
    while (stack.length > 0) {
      const current = stack.pop()
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!excludedDirectories.has(entry.name)) stack.push(join(current, entry.name))
          continue
        }
        if (!allowedExtensions.has(extname(entry.name))) continue
        const source = readFileSync(join(current, entry.name), "utf8")
        for (const pattern of [/"((?:\\.|[^"\\])*)"/gs, /'((?:\\.|[^'\\])*)'/gs, /`((?:\\.|[^`\\])*)`/gs]) {
          for (const match of source.matchAll(pattern)) {
            const text = match[1].replace(/\\n/g, " ").replace(/\\["'`]/g, (value) => value.slice(1))
            if (text.includes("?") && text.length >= 10 && text.length <= 600) {
              results.add(normalizeTurkish(text))
            }
          }
        }
      }
    }
  }
  return results
}

function verifyArtifactBytes(bytes, expectedSha256) {
  if (sha256(bytes) !== expectedSha256) fail("dna_locked_holdout_artifact_hash_mismatch")
  let artifact
  try {
    artifact = JSON.parse(bytes.toString("utf8"))
  } catch {
    fail("dna_locked_holdout_artifact_json_invalid")
  }
  return artifact
}

function assertManifestArtifactBinding(manifest, bytes) {
  if (bytes.length !== manifest.artifact.byteCount) fail("dna_locked_holdout_byte_count_mismatch")
  return verifyArtifactBytes(bytes, manifest.artifact.sha256)
}

function assertManifestCounts(manifest, artifact) {
  const splitCounts = Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((split) => [
    split,
    artifact.items.filter((item) => item.split === split).length,
  ]))
  const answerable = artifact.items.filter((item) => item.answerability === "answerable").length
  const clarification = artifact.items.filter((item) => item.answerability === "clarify").length
  const unsupported = artifact.items.filter((item) => item.answerability === "unsupported").length
  if (manifest.counts.total !== artifact.items.length
    || manifest.counts.topics !== 14
    || manifest.counts.answerable !== answerable
    || manifest.counts.clarification !== clarification
    || manifest.counts.unsupported !== unsupported
    || Object.entries(splitCounts).some(([split, count]) => manifest.splits[split] !== count)) {
    fail("dna_locked_holdout_manifest_count_drift")
  }
}

function expectFailure(fn, expectedCode, failureCode) {
  let rejected = false
  try {
    fn()
  } catch (error) {
    rejected = error instanceof Error && error.message === expectedCode
  }
  if (!rejected) fail(failureCode)
}

function runNegativeIntegrityTests(ssdRoot, manifest, artifactBytes, artifact) {
  const tamperedBytes = Buffer.from(artifactBytes)
  tamperedBytes[Math.max(0, tamperedBytes.length - 2)] ^= 1
  expectFailure(
    () => verifyArtifactBytes(tamperedBytes, manifest.artifact.sha256),
    "dna_locked_holdout_artifact_hash_mismatch",
    "dna_locked_holdout_hash_tamper_not_rejected",
  )
  expectFailure(
    () => assertManifestArtifactBinding({
      ...manifest,
      artifact: { ...manifest.artifact, byteCount: manifest.artifact.byteCount + 1 },
    }, artifactBytes),
    "dna_locked_holdout_byte_count_mismatch",
    "dna_locked_holdout_byte_tamper_not_rejected",
  )
  expectFailure(
    () => assertManifestArtifactBinding({
      ...manifest,
      artifact: { ...manifest.artifact, sha256: "0".repeat(64) },
    }, artifactBytes),
    "dna_locked_holdout_artifact_hash_mismatch",
    "dna_locked_holdout_manifest_drift_not_rejected",
  )
  expectFailure(
    () => assertManifestCounts({
      ...manifest,
      splits: { ...manifest.splits, natural_supported: manifest.splits.natural_supported + 1 },
    }, artifact),
    "dna_locked_holdout_manifest_count_drift",
    "dna_locked_holdout_manifest_count_drift_not_rejected",
  )

  const sandbox = mkdtempSync(join(ssdRoot, ".dna-locked-holdout-negative-"))
  try {
    chmodSync(sandbox, 0o700)
    const privateFile = join(sandbox, "private.json")
    writeFileSync(privateFile, "{}\n", { mode: 0o600 })
    const leafSymlink = join(sandbox, "leaf-link.json")
    symlinkSync(privateFile, leafSymlink)
    expectFailure(
      () => assertRegularFileInsideSsd(ssdRoot, leafSymlink),
      "dna_locked_holdout_symlink_forbidden",
      "dna_locked_holdout_leaf_symlink_not_rejected",
    )

    const parentSymlink = join(sandbox, "escape-parent")
    symlinkSync(process.cwd(), parentSymlink)
    expectFailure(
      () => assertRegularFileInsideSsd(ssdRoot, join(parentSymlink, "package.json")),
      "dna_locked_holdout_symlink_forbidden",
      "dna_locked_holdout_parent_symlink_escape_not_rejected",
    )

    const looseModeFile = join(sandbox, "loose-mode.json")
    writeFileSync(looseModeFile, "{}\n", { mode: 0o644 })
    chmodSync(looseModeFile, 0o644)
    expectFailure(
      () => assertRegularFileInsideSsd(ssdRoot, looseModeFile, { mode: 0o600 }),
      "dna_locked_holdout_mode_mismatch",
      "dna_locked_holdout_mode_tamper_not_rejected",
    )
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
}

function verify() {
  const repositoryRoot = process.cwd()
  const ssdRoot = assertResearchSsdRoot()
  const manifest = readJson(MANIFEST_PATH, "dna_locked_holdout_manifest_unreadable")
  exactKeys(manifest, [
    "artifact", "authorities", "counts", "label", "privacyBoundary", "schemaVersion",
    "splits", "validation",
  ], "dna_locked_holdout_manifest_unknown_or_missing_field")
  exactKeys(manifest.artifact, [
    "byteCount", "researchSsdRelativePath", "sha256",
  ], "dna_locked_holdout_manifest_artifact_unknown_or_missing_field")
  exactKeys(manifest.authorities, [
    "candidatePackageResearchSsdRelativePath", "candidatePackageSha256",
    "developmentLedgerResearchSsdRelativePath", "developmentLedgerSha256",
    "prebookDraftResearchSsdRelativePath", "prebookDraftSha256",
  ], "dna_locked_holdout_manifest_authorities_unknown_or_missing_field")
  exactKeys(manifest.counts, [
    "answerable", "clarification", "topics", "total", "unsupported",
  ], "dna_locked_holdout_manifest_counts_unknown_or_missing_field")
  exactKeys(manifest.splits, Object.keys(EXPECTED_SPLITS),
    "dna_locked_holdout_manifest_splits_unknown_or_missing_field")
  exactKeys(manifest.privacyBoundary, [
    "fullPayloadStoredOnlyOnResearchSsd", "fullQuestionAnswerPayloadInRepository",
    "independentHumanValidation", "releaseEligible", "runtimeEligible",
    "visibleToAdapterTuning",
  ], "dna_locked_holdout_manifest_privacy_unknown_or_missing_field")
  exactKeys(manifest.validation, [
    "artifactMode", "atomicWriteFsyncRenameReadback", "byteTamperFailClosed",
    "deterministicRepeats", "exactOverlap", "hashTamperFailClosed",
    "leafSymlinkFailClosed", "manifestDriftFailClosed", "modeTamperFailClosed",
    "nearDuplicateOverlap", "normalizedOverlap", "parentSymlinkEscapeFailClosed",
    "semanticFamilyOverlap", "ssdFallbackAllowed", "tamperFailClosed",
    "uniqueGenerationHashes",
  ], "dna_locked_holdout_manifest_validation_unknown_or_missing_field")
  if (manifest.schemaVersion !== "dna-internal-locked-turkish-holdout-manifest@1"
    || manifest.label !== EXPECTED_LABEL) fail("dna_locked_holdout_manifest_contract_mismatch")
  if (manifest.privacyBoundary.fullQuestionAnswerPayloadInRepository !== false
    || manifest.privacyBoundary.fullPayloadStoredOnlyOnResearchSsd !== true
    || manifest.privacyBoundary.visibleToAdapterTuning !== false
    || manifest.privacyBoundary.runtimeEligible !== false
    || manifest.privacyBoundary.releaseEligible !== false
    || manifest.privacyBoundary.independentHumanValidation !== false) {
    fail("dna_locked_holdout_manifest_privacy_boundary_mismatch")
  }

  const artifactPath = resolveInside(
    ssdRoot,
    manifest.artifact.researchSsdRelativePath,
    "dna_locked_holdout_artifact_path_invalid",
  )
  assertRegularFileInsideSsd(ssdRoot, artifactPath, {
    code: "dna_locked_holdout_artifact_missing_no_fallback",
    mode: 0o600,
    modeCode: "dna_locked_holdout_artifact_mode_mismatch",
  })
  const artifactBytes = readFileSync(artifactPath)
  const artifact = assertManifestArtifactBinding(manifest, artifactBytes)
  assertManifestCounts(manifest, artifact)
  const { artifactSha256, ...artifactPayload } = artifact
  if (artifactSha256 !== stableSha256(artifactPayload)) fail("dna_locked_holdout_internal_hash_mismatch")
  if (artifact.schemaVersion !== EXPECTED_SCHEMA || artifact.status !== "sealed"
    || artifact.label !== EXPECTED_LABEL) fail("dna_locked_holdout_artifact_contract_mismatch")

  const candidatePath = resolveInside(
    ssdRoot,
    manifest.authorities.candidatePackageResearchSsdRelativePath,
    "dna_locked_holdout_candidate_path_invalid",
  )
  assertRegularFileInsideSsd(ssdRoot, candidatePath, {
    code: "dna_locked_holdout_candidate_unreadable",
  })
  const candidate = readJson(candidatePath, "dna_locked_holdout_candidate_unreadable")
  if (candidate.packageSha256 !== manifest.authorities.candidatePackageSha256
    || artifact.authorities.candidatePackageSha256 !== candidate.packageSha256) {
    fail("dna_locked_holdout_candidate_authority_mismatch")
  }
  const topics = new Map(candidate.topics.map((topic) => [topic.id, topic]))
  const claims = new Map(candidate.claims.map((claim) => [claim.id, claim]))

  const ledgerPath = resolveInside(
    ssdRoot,
    manifest.authorities.developmentLedgerResearchSsdRelativePath,
    "dna_locked_holdout_development_ledger_path_invalid",
  )
  assertRegularFileInsideSsd(ssdRoot, ledgerPath, {
    code: "dna_locked_holdout_development_ledger_unreadable",
  })
  const ledger = readJson(ledgerPath, "dna_locked_holdout_development_ledger_unreadable")
  if (ledger.ledgerSha256 !== manifest.authorities.developmentLedgerSha256
    || artifact.authorities.developmentLedgerSha256 !== ledger.ledgerSha256) {
    fail("dna_locked_holdout_development_ledger_authority_mismatch")
  }
  const draftPath = resolveInside(
    ssdRoot,
    manifest.authorities.prebookDraftResearchSsdRelativePath,
    "dna_locked_holdout_prebook_draft_path_invalid",
  )
  assertRegularFileInsideSsd(ssdRoot, draftPath, {
    code: "dna_locked_holdout_prebook_draft_unreadable",
  })
  const draft = readJson(draftPath, "dna_locked_holdout_prebook_draft_unreadable")
  if (draft.canonicalPayloadSha256 !== manifest.authorities.prebookDraftSha256
    || artifact.authorities.prebookDraftSha256 !== draft.canonicalPayloadSha256) {
    fail("dna_locked_holdout_prebook_draft_authority_mismatch")
  }

  const developmentNormalized = new Set()
  const developmentFamilies = new Set()
  for (const batch of ledger.batches) {
    for (const entry of batch.entries) {
      developmentNormalized.add(entry.normalizedQuestion)
      developmentFamilies.add(entry.semanticFamilyProvenanceSha256)
    }
  }
  for (const question of draft.questions) {
    developmentNormalized.add(normalizeTurkish(question.question))
    developmentFamilies.add(question.semanticFamilyProvenanceSha256)
  }
  for (const normalized of collectQuestionStrings(repositoryRoot)) developmentNormalized.add(normalized)
  const developmentMeanings = [...developmentNormalized]

  if (!Array.isArray(artifact.items) || artifact.items.length !== manifest.counts.total) {
    fail("dna_locked_holdout_item_count_mismatch")
  }
  const ids = new Set()
  const questions = new Set()
  const families = new Set()
  const splitCounts = Object.fromEntries(Object.keys(EXPECTED_SPLITS).map((key) => [key, 0]))
  const topicCounts = new Map()
  for (const item of artifact.items) {
    exactKeys(item, REQUIRED_ITEM_KEYS, "dna_locked_holdout_item_unknown_or_missing_field")
    if (ids.has(item.id)) fail("dna_locked_holdout_duplicate_item_id")
    ids.add(item.id)
    if (!(item.split in splitCounts)) fail("dna_locked_holdout_unknown_split")
    splitCounts[item.split] += 1

    const normalizedQuestion = normalizeTurkish(item.question)
    if (!normalizedQuestion || item.questionSha256 !== sha256(item.question)) {
      fail("dna_locked_holdout_question_hash_mismatch")
    }
    if (questions.has(normalizedQuestion)) fail("dna_locked_holdout_duplicate_normalized_question")
    questions.add(normalizedQuestion)
    if (developmentNormalized.has(normalizedQuestion)) fail("dna_locked_holdout_development_text_overlap")
    if (developmentMeanings.some((meaning) => nearDuplicate(normalizedQuestion, meaning))) {
      fail("dna_locked_holdout_development_near_duplicate_overlap")
    }

    const familyHash = stableSha256(normalizeTurkish(item.semanticFamily.canonicalMeaning))
    if (familyHash !== item.semanticFamily.provenanceSha256) {
      fail("dna_locked_holdout_semantic_family_hash_mismatch")
    }
    if (families.has(familyHash)) fail("dna_locked_holdout_duplicate_semantic_family")
    if (developmentFamilies.has(familyHash)) fail("dna_locked_holdout_development_family_overlap")
    families.add(familyHash)

    const { itemSha256, ...itemPayload } = item
    if (itemSha256 !== stableSha256(itemPayload)) fail("dna_locked_holdout_item_hash_mismatch")
    if (!Array.isArray(item.allowedClaimIds) || !Array.isArray(item.forbiddenTopics)
      || !item.ageBoundary?.scope || !item.ageBoundary?.rule
      || !item.causalBoundary?.status || !item.causalBoundary?.rule
      || !item.safetyBoundary?.classification || !item.safetyBoundary?.requiredStatement) {
      fail("dna_locked_holdout_required_boundary_missing")
    }
    if (item.answerability === "answerable") {
      if (!topics.has(item.expectedTopic) || item.allowedClaimIds.length === 0
        || item.forbiddenTopics.includes(item.expectedTopic)) {
        fail("dna_locked_holdout_answerable_contract_mismatch")
      }
      topicCounts.set(item.expectedTopic, (topicCounts.get(item.expectedTopic) || 0) + 1)
      for (const claimId of item.allowedClaimIds) {
        const claim = claims.get(claimId)
        if (!claim || claim.topicId !== item.expectedTopic) fail("dna_locked_holdout_claim_topic_mismatch")
      }
    } else if (item.expectedTopic !== null || item.allowedClaimIds.length !== 0) {
      fail("dna_locked_holdout_unanswerable_contract_mismatch")
    }
    if (item.forbiddenTopics.some((topicId) => !topics.has(topicId))) {
      fail("dna_locked_holdout_unknown_forbidden_topic")
    }
    if (item.referenceAnswer.citationClaimIds.join("\u0000") !== item.allowedClaimIds.join("\u0000")) {
      fail("dna_locked_holdout_answer_claim_binding_mismatch")
    }
    if (item.provenance.candidatePackageSha256 !== candidate.packageSha256
      || item.provenance.authorityClass !== "external_science_candidate") {
      fail("dna_locked_holdout_item_provenance_mismatch")
    }
  }

  for (const [split, expected] of Object.entries(EXPECTED_SPLITS)) {
    if (splitCounts[split] !== expected || manifest.splits[split] !== expected) {
      fail("dna_locked_holdout_split_count_mismatch")
    }
  }
  if (topicCounts.size !== 14 || [...topicCounts.values()].some((count) => count !== 7)) {
    fail("dna_locked_holdout_topic_coverage_mismatch")
  }
  const itemHashes = new Set()
  for (let repeat = 0; repeat < 20; repeat += 1) itemHashes.add(stableSha256(artifact.items))
  if (itemHashes.size !== 1 || [...itemHashes][0] !== artifact.generation.itemsSha256
    || artifact.generation.repeats !== 20 || artifact.generation.uniqueHashes !== 1) {
    fail("dna_locked_holdout_determinism_mismatch")
  }

  runNegativeIntegrityTests(ssdRoot, manifest, artifactBytes, artifact)

  if (manifest.validation.exactOverlap !== 0 || manifest.validation.normalizedOverlap !== 0
    || manifest.validation.semanticFamilyOverlap !== 0
    || manifest.validation.nearDuplicateOverlap !== 0
    || manifest.validation.deterministicRepeats !== 20
    || manifest.validation.uniqueGenerationHashes !== 1
    || manifest.validation.tamperFailClosed !== true
    || manifest.validation.hashTamperFailClosed !== true
    || manifest.validation.byteTamperFailClosed !== true
    || manifest.validation.manifestDriftFailClosed !== true
    || manifest.validation.parentSymlinkEscapeFailClosed !== true
    || manifest.validation.leafSymlinkFailClosed !== true
    || manifest.validation.modeTamperFailClosed !== true
    || manifest.validation.artifactMode !== "0600"
    || manifest.validation.atomicWriteFsyncRenameReadback !== true
    || manifest.validation.ssdFallbackAllowed !== false) {
    fail("dna_locked_holdout_manifest_validation_mismatch")
  }
  return Object.freeze({
    ok: true,
    hash: manifest.artifact.sha256,
    count: artifact.items.length,
    path: artifactPath,
    splits: splitCounts,
  })
}

try {
  process.stdout.write(`${JSON.stringify(verify())}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "dna_locked_holdout_unknown_error"}\n`)
  process.exitCode = 1
}
