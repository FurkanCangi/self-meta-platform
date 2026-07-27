#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { createDevelopmentBanks } from "./dna-turkish-retrieval-v3-source-derived-development.mjs"
import {
  DEFAULT_ARTIFACT_DIR,
  DEFAULT_CANDIDATE_PACKAGE,
  stableStringify,
} from "./dna-turkish-retrieval-v3-source-derived-core.mjs"
const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const RESEARCH_SSD_ROOT = "/Volumes/ResearchSSD"
const DEFAULT_ADAPTER = `${DEFAULT_ARTIFACT_DIR}/frozen-source-derived-adapter.json`
const DEFAULT_OUTPUT = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/local-router-pilot/qwen3-4b-instruct-2507-4bit/input-bundle.json"
const TOPIC_ID = /^external\.[a-z0-9_]+$/u
const ACTIONS = new Set(["retrieve", "clarify", "abstain"])
const BANK_FAMILIES = Object.freeze({
  tuning: new Set(["canonical_definition", "alias_scope", "source_term_context"]),
  holdout: new Set(["inflected_measurement", "noisy_scope_question", "mixed_language_relation"]),
  metamorphic: new Set([
    "typo", "character_loss", "inflection", "source_alias_synonym", "mixed_language",
    "two_supported_topics", "unsupported_domain", "safe_theory_boundary",
    "high_stakes_abstain", "generic_domain_clarify",
  ]),
})

function fail(code) {
  throw new Error(code)
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
  }
  return value
}

function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex")
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path))
}

function existingAncestors(path) {
  const rows = []
  let cursor = resolve(path)
  while (true) {
    if (existsSync(cursor)) rows.push(cursor)
    const parent = dirname(cursor)
    if (parent === cursor) return rows
    cursor = parent
  }
}

function assertNoSymlinkComponents(path, label) {
  if (existingAncestors(path).some((entry) => lstatSync(entry).isSymbolicLink())) {
    fail(`dna_local_router_${label}_symlink_forbidden`)
  }
}

function assertResearchSsdPath(path, label) {
  if (!isAbsolute(path)) fail(`dna_local_router_${label}_absolute_path_required`)
  const rel = relative(RESEARCH_SSD_ROOT, resolve(path))
  if (rel === ".." || rel.startsWith(`..${sep}`)) fail(`dna_local_router_${label}_ssd_escape`)
  assertNoSymlinkComponents(path, label)
}

function assertRegularFile0600(path, label) {
  assertNoSymlinkComponents(path, label)
  if (!lstatSync(path).isFile() || (statSync(path).mode & 0o777) !== 0o600) {
    fail(`dna_local_router_${label}_file_or_mode_invalid`)
  }
}

function atomicWrite(path, bytes, mode) {
  const parent = dirname(path)
  mkdirSync(parent, { recursive: true, mode: 0o700 })
  assertNoSymlinkComponents(parent, "output_parent")
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) fail("dna_local_router_output_symlink_forbidden")
  const temp = resolve(parent, `.${process.pid}.${Date.now()}.tmp`)
  let descriptor
  try {
    descriptor = openSync(temp, "wx", mode)
    writeFileSync(descriptor, bytes)
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    renameSync(temp, path)
    chmodSync(path, mode)
    if (readFileSync(path, "utf8") !== bytes) fail("dna_local_router_output_readback_mismatch")
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    rmSync(temp, { force: true })
  }
}

function parseArgs(argv) {
  const outputIndex = argv.indexOf("--output")
  if (argv.length !== 0 && (argv.length !== 2 || outputIndex !== 0)) {
    fail("dna_local_router_input_cli_invalid")
  }
  return outputIndex === 0 ? resolve(argv[1]) : DEFAULT_OUTPUT
}

function parseJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    fail(code)
  }
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join("\0") !== [...keys].sort().join("\0")) fail(code)
}

function omit(value, key) {
  return Object.fromEntries(Object.entries(value).filter(([candidate]) => candidate !== key))
}

function stableSha(value) {
  return sha256Bytes(stableStringify(value))
}

function uniqueIds(rows, label) {
  const ids = rows.map((row) => row?.id)
  if (ids.some((id) => typeof id !== "string" || id.length < 3) || new Set(ids).size !== ids.length) {
    fail(`dna_local_router_${label}_ids_invalid`)
  }
  return new Set(ids)
}

function validateAuthorities(candidate, adapter) {
  if (candidate.schemaVersion !== "dna-external-science-candidate@1"
    || candidate.authorityClass !== "external_science_candidate"
    || candidate.runtimeEligible !== false || candidate.releaseEligible !== false
    || candidate.activationAllowed !== false
    || candidate.packageSha256 !== stableSha(omit(candidate, "packageSha256"))) {
    fail("dna_local_router_candidate_authority_invalid")
  }
  const expectedCounts = {
    topics: 14, sources: 14, passages: 166, claims: 220,
    relations: 0, answerUnits: 220, dnaProductClaims: 0,
  }
  exactKeys(candidate.counts, Object.keys(expectedCounts), "dna_local_router_candidate_counts_schema_invalid")
  if (Object.entries(expectedCounts).some(([key, value]) => candidate.counts[key] !== value)
    || candidate.topics?.length !== 14 || candidate.sources?.length !== 14
    || candidate.passages?.length !== 166 || candidate.claims?.length !== 220
    || candidate.relations?.length !== 0 || candidate.answerUnits?.length !== 220
    || candidate.lexicalIndex?.length !== 14) fail("dna_local_router_candidate_counts_invalid")

  if (adapter.schemaVersion !== "dna.turkish-retrieval-v3-source-derived.adapter.v1"
    || adapter.authorityClass !== "development_only_source_derived"
    || adapter.runtimeEligible !== false || adapter.releaseEligible !== false
    || adapter.activationAllowed !== false || adapter.ownerAuthority !== false
    || adapter.adapterSha256 !== stableSha(omit(adapter, "adapterSha256"))
    || adapter.sourcePackageSha256 !== candidate.packageSha256
    || adapter.sourcePackageContentSha256 !== stableSha(candidate)
    || adapter.inputs?.candidatePackage !== true
    || adapter.inputs?.answerUnitCount !== 220 || adapter.inputs?.sourcePassageCount !== 166
    || adapter.inputs?.lockedPayloads !== false || adapter.inputs?.officialMetrics !== false
    || adapter.inputs?.priorAdapterResults !== false || adapter.topicProfiles?.length !== 14) {
    fail("dna_local_router_adapter_authority_invalid")
  }
}

function validateSourceBindings(candidate, adapter) {
  const topicIds = uniqueIds(candidate.topics, "candidate_topic")
  const sourceIds = uniqueIds(candidate.sources, "candidate_source")
  const passageIds = uniqueIds(candidate.passages, "candidate_passage")
  const claimIds = uniqueIds(candidate.claims, "candidate_claim")
  const answerUnitIds = uniqueIds(candidate.answerUnits, "candidate_answer_unit")
  if ([...topicIds].some((id) => !TOPIC_ID.test(id))) fail("dna_local_router_candidate_topic_id_invalid")
  const claims = new Map(candidate.claims.map((claim) => [claim.id, claim]))
  for (const claim of candidate.claims) {
    if (!topicIds.has(claim.topicId) || !sourceIds.has(claim.sourceId) || !passageIds.has(claim.passageId)) {
      fail("dna_local_router_candidate_claim_binding_invalid")
    }
  }
  for (const unit of candidate.answerUnits) {
    const claim = claims.get(unit.claimId)
    if (!answerUnitIds.has(unit.id) || !claim || !topicIds.has(unit.topicId)
      || !sourceIds.has(unit.sourceId) || !passageIds.has(unit.passageId)
      || unit.topicId !== claim.topicId || unit.sourceId !== claim.sourceId
      || unit.passageId !== claim.passageId || unit.maximumGraphHops !== 1
      || unit.multiStepMechanismAllowed !== false || unit.visibleCitationRequired !== true) {
      fail("dna_local_router_candidate_answer_unit_binding_invalid")
    }
  }
  const lexicalIds = candidate.lexicalIndex.map((entry) => entry?.topicId)
  if (lexicalIds.length !== 14 || new Set(lexicalIds).size !== 14
    || lexicalIds.some((id) => !topicIds.has(id))) fail("dna_local_router_candidate_lexical_binding_invalid")

  const profileIds = adapter.topicProfiles.map((profile) => profile?.topicId)
  if (new Set(profileIds).size !== 14 || profileIds.some((id) => !topicIds.has(id))) {
    fail("dna_local_router_adapter_topic_binding_invalid")
  }
  for (const profile of adapter.topicProfiles) {
    exactKeys(profile, ["topicId", "title", "aliases", "terms", "answerUnits", "theoryBoundary"], "dna_local_router_profile_schema_invalid")
    if (typeof profile.title !== "string" || profile.title.length < 2
      || !Array.isArray(profile.aliases) || profile.aliases.length === 0
      || !Array.isArray(profile.terms) || profile.terms.length === 0
      || !Array.isArray(profile.answerUnits) || profile.answerUnits.length === 0
      || profile.theoryBoundary !== (profile.topicId === "external.polyvagal_theory")) {
      fail("dna_local_router_profile_invalid")
    }
    for (const unit of profile.answerUnits) {
      if (!answerUnitIds.has(unit.answerUnitId) || !claimIds.has(unit.claimId)
        || !passageIds.has(unit.passageId) || !sourceIds.has(unit.sourceId)) {
        fail("dna_local_router_adapter_answer_unit_binding_invalid")
      }
    }
  }
}

function validateCases(cases, topicIds) {
  if (cases.length !== 177 || new Set(cases.map((row) => row.id)).size !== 177) {
    fail("dna_local_router_case_count_or_id_invalid")
  }
  for (const row of cases) {
    exactKeys(row, [
      "bank", "id", "semanticFamily", "question", "expectedAction", "expectedTopicId",
      "expectedTopicIds", "expectedEvidenceBoundary",
    ], "dna_local_router_case_schema_invalid")
    if (!Object.hasOwn(BANK_FAMILIES, row.bank) || !BANK_FAMILIES[row.bank].has(row.semanticFamily)
      || typeof row.id !== "string" || row.id.length < 6
      || typeof row.question !== "string" || row.question.length < 2 || row.question.length > 600
      || !ACTIONS.has(row.expectedAction)) fail("dna_local_router_case_label_invalid")
    if (row.expectedAction === "retrieve") {
      if (!topicIds.has(row.expectedTopicId) || row.expectedTopicIds !== null) {
        fail("dna_local_router_retrieve_expectation_invalid")
      }
    } else if (row.expectedTopicId !== null) fail("dna_local_router_nonretrieve_topic_invalid")
    if (row.expectedTopicIds !== null
      && (row.expectedAction !== "clarify" || row.semanticFamily !== "two_supported_topics"
        || !Array.isArray(row.expectedTopicIds) || row.expectedTopicIds.length !== 2
        || new Set(row.expectedTopicIds).size !== 2
        || row.expectedTopicIds.some((id) => !topicIds.has(id)))) {
      fail("dna_local_router_multitopic_expectation_invalid")
    }
    if (row.expectedEvidenceBoundary !== null
      && (row.expectedTopicId !== "external.polyvagal_theory"
        || row.expectedEvidenceBoundary !== "theory_not_established_fact")) {
      fail("dna_local_router_evidence_boundary_invalid")
    }
  }
}

function sourceCard(profile) {
  const aliases = [...new Set(profile.aliases)].slice(0, 8)
  const routingTerms = profile.terms.slice(0, 16).map((entry) => entry.term)
  return {
    topicId: profile.topicId,
    title: profile.title,
    aliases,
    routingTerms,
    theoryBoundary: profile.theoryBoundary === true,
  }
}

function main() {
  const output = parseArgs(process.argv.slice(2))
  for (const [path, label] of [
    [DEFAULT_CANDIDATE_PACKAGE, "candidate"], [DEFAULT_ADAPTER, "adapter"],
    [output, "output"],
  ]) assertResearchSsdPath(path, label)
  assertRegularFile0600(DEFAULT_CANDIDATE_PACKAGE, "candidate")
  assertRegularFile0600(DEFAULT_ADAPTER, "adapter")
  if (realpathSync(DEFAULT_CANDIDATE_PACKAGE) !== DEFAULT_CANDIDATE_PACKAGE
    || realpathSync(DEFAULT_ADAPTER) !== DEFAULT_ADAPTER) {
    fail("dna_local_router_input_authority_realpath_mismatch")
  }
  const candidate = parseJson(DEFAULT_CANDIDATE_PACKAGE, "dna_local_router_candidate_invalid")
  const adapter = parseJson(DEFAULT_ADAPTER, "dna_local_router_adapter_invalid")
  validateAuthorities(candidate, adapter)
  validateSourceBindings(candidate, adapter)
  const banks = createDevelopmentBanks(adapter)
  const cases = Object.entries(banks).flatMap(([bank, rows]) => rows.map((row) => ({
    bank,
    id: row.id,
    semanticFamily: row.semanticFamily,
    question: row.query,
    expectedAction: row.expectedAction,
    expectedTopicId: row.expectedTopicId ?? null,
    expectedTopicIds: row.expectedTopicIds ?? null,
    expectedEvidenceBoundary: row.expectedEvidenceBoundary ?? null,
  })))
  const topicIds = new Set(adapter.topicProfiles.map((profile) => profile.topicId))
  validateCases(cases, topicIds)
  const payload = {
    schemaVersion: "dna-local-router-pilot-input@1",
    authorityClass: "development_only_source_derived",
    sourceBindings: {
      candidatePackageSha256: candidate.packageSha256,
      candidatePackageFileSha256: sha256File(DEFAULT_CANDIDATE_PACKAGE),
      candidateLogicalSha256: stableSha(candidate),
      adapterSha256: adapter.adapterSha256,
      adapterFileSha256: sha256File(DEFAULT_ADAPTER),
      adapterLogicalSha256: stableSha(adapter),
      routingCoreFileSha256: sha256File(`${REPO_ROOT}/scripts/dna-turkish-retrieval-v3-source-derived-core.mjs`),
      developmentGeneratorFileSha256: sha256File(`${REPO_ROOT}/scripts/dna-turkish-retrieval-v3-source-derived-development.mjs`),
      inputBuilderFileSha256: sha256File(`${REPO_ROOT}/scripts/dna-local-router-pilot-input.mjs`),
    },
    counts: {
      topics: adapter.topicProfiles.length,
      tuning: banks.tuning.length,
      developmentFamilyHoldout: banks.holdout.length,
      metamorphic: banks.metamorphic.length,
      totalCases: cases.length,
    },
    topicCards: adapter.topicProfiles.map(sourceCard),
    cases,
    boundaries: {
      lockedHoldoutRead: false,
      officialAggregateUsedForTuning: false,
      rawQuestionsStoredOnResearchSsdOnly: true,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      ownerAuthority: false,
    },
  }
  const bundle = { ...payload, bundleSha256: sha256Bytes(canonicalJson(payload)) }
  atomicWrite(output, canonicalJson(bundle), 0o600)
  process.stdout.write(`${JSON.stringify({
    ok: true,
    outputSha256: sha256File(output),
    bundleSha256: bundle.bundleSha256,
    counts: bundle.counts,
    boundaries: bundle.boundaries,
  }, null, 2)}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
