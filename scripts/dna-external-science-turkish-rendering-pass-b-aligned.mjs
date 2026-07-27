#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto"
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { assertNeutralSelectionContract } from "./dna-external-science-turkish-neutral-selection.mjs"

const VERSION = "dna-external-science-turkish-rendering-pass-b-aligned@1"
const AUTHORING_SCHEMA = "dna-external-science-turkish-rendering-pass-b-aligned-authoring@1"
const MANIFEST_SCHEMA = "dna-external-science-turkish-rendering-pass-b-aligned-manifest@1"
const PROVENANCE = "codex_translation_pass_b_aligned_not_independent_human_review"
const CANDIDATE_PATH =
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
const SELECTION_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-neutral-selection/feasibility-v1/selection-contract.json"
const OUTPUT_ROOT =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b-aligned/feasibility-v1"
const AUTHORING_PATH = `${OUTPUT_ROOT}/authored-renderings.json`
const ARTIFACT_PATH = `${OUTPUT_ROOT}/rendering-artifact.json`
const REPO_MANIFEST =
  "docs/dna-intelligence/program/evidence/external-science-turkish-rendering-pass-b-aligned-current.json"
const EXPECTED_SELECTION_SET_SHA =
  "19dbb3434f72d023c79fb321781c1be8be43d7376033320d99a36f7f25f910a3"
const AUTHORING_KEYS = Object.freeze([
  "authoringSha256",
  "provenance",
  "renderings",
  "schemaVersion",
])
const AUTHORING_RECORD_KEYS = Object.freeze([
  "claimId",
  "decision",
  "turkishRendering",
])

function fail(code) {
  throw new Error(code)
}

function canonicalize(value) {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return value
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== "object") fail("dna_aligned_b_non_json_value")
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, child]) => [key, canonicalize(child)]))
}

function stableSha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function seal(value, key) {
  return { ...value, [key]: stableSha256(value) }
}

function assertHash(value, code) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(code)
}

function assertExactKeys(value, expected, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code)
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"))
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code)
}

function assertAuthoringContract(authoring) {
  assertExactKeys(authoring, AUTHORING_KEYS, "dna_aligned_b_authoring_shape_invalid")
  if (authoring.schemaVersion !== AUTHORING_SCHEMA || authoring.provenance !== PROVENANCE
    || stableSha256(omit(authoring, "authoringSha256")) !== authoring.authoringSha256
    || !Array.isArray(authoring.renderings) || authoring.renderings.length !== 42
    || new Set(authoring.renderings.map((entry) => entry.claimId)).size !== 42) {
    fail("dna_aligned_b_authoring_invalid")
  }
  for (const entry of authoring.renderings) {
    assertExactKeys(entry, AUTHORING_RECORD_KEYS, "dna_aligned_b_authoring_record_shape_invalid")
    if (typeof entry.claimId !== "string" || !entry.claimId
      || typeof entry.turkishRendering !== "string"
      || typeof entry.decision !== "string" || !entry.decision.trim()
      || entry.decision !== entry.decision.trim() || entry.decision.length > 1_000) {
      fail("dna_aligned_b_authoring_record_invalid")
    }
  }
}

function resolveRoot() {
  const requested = resolve(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD")
  if (!existsSync(requested) || lstatSync(requested).isSymbolicLink()
    || !lstatSync(requested).isDirectory()) fail("dna_aligned_b_ssd_root_invalid")
  const root = realpathSync(requested)
  if (root !== "/Volumes/ResearchSSD" && !root.startsWith(`/Volumes/ResearchSSD${sep}`)) {
    fail("dna_aligned_b_local_fallback_forbidden")
  }
  return root
}

function contained(root, requested, code) {
  const target = resolve(requested)
  const delta = relative(root, target)
  if (!delta || delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) {
    fail(code)
  }
  return target
}

function assertSecurePath(root, requested, { file = true, mode0600 = false } = {}) {
  const target = contained(root, requested, "dna_aligned_b_path_escape")
  let current = root
  for (const part of relative(root, target).split(sep).filter(Boolean)) {
    current = join(current, part)
    if (!existsSync(current)) fail("dna_aligned_b_input_missing")
    const metadata = lstatSync(current)
    if (metadata.isSymbolicLink()) fail("dna_aligned_b_symlink_forbidden")
    if (current !== target && !metadata.isDirectory()) fail("dna_aligned_b_parent_invalid")
    if (current === target && file && !metadata.isFile()) fail("dna_aligned_b_file_invalid")
  }
  if (mode0600 && (statSync(target).mode & 0o777) !== 0o600) {
    fail("dna_aligned_b_input_mode_invalid")
  }
  const real = realpathSync(target)
  const delta = relative(root, real)
  if (delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) {
    fail("dna_aligned_b_realpath_escape")
  }
  return target
}

function readJson(root, relativePath, mode0600 = true) {
  const path = assertSecurePath(root, join(root, relativePath), { mode0600 })
  const bytes = readFileSync(path)
  return { value: JSON.parse(bytes.toString("utf8")), rawSha256: sha256(bytes) }
}

function ensureSecureParents(root, target) {
  const safe = contained(root, target, "dna_aligned_b_output_escape")
  let current = root
  for (const part of relative(root, dirname(safe)).split(sep).filter(Boolean)) {
    current = join(current, part)
    if (!existsSync(current)) mkdirSync(current, { mode: 0o700 })
    const metadata = lstatSync(current)
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      fail("dna_aligned_b_output_parent_invalid")
    }
  }
  if (existsSync(safe) && lstatSync(safe).isSymbolicLink()) {
    fail("dna_aligned_b_output_symlink_forbidden")
  }
  return safe
}

function secureAtomicWrite(root, requested, bytes) {
  const target = ensureSecureParents(root, requested)
  const temporary = join(dirname(target), `.${basename(target)}.${randomBytes(12).toString("hex")}.tmp`)
  let descriptor
  try {
    descriptor = openSync(temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
    let offset = 0
    while (offset < bytes.length) offset += writeSync(descriptor, bytes, offset, bytes.length - offset)
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    chmodSync(temporary, 0o600)
    renameSync(temporary, target)
    const directoryDescriptor = openSync(dirname(target), constants.O_RDONLY)
    try { fsyncSync(directoryDescriptor) } finally { closeSync(directoryDescriptor) }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
  const written = assertSecurePath(root, target, { mode0600: true })
  const actual = readFileSync(written)
  if (!actual.equals(bytes)) fail("dna_aligned_b_output_readback_mismatch")
  return { path: written, rawSha256: sha256(actual), bytes: actual.length }
}

function normalizedTurkish(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/ş/g, "s")
    .replace(/ğ/g, "g").replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u")
}

function numericSequence(value) {
  const normalized = value.replace(/−/g, "-").replace(/²/g, "2")
    .replace(/\btwelve\b/gi, "12").replace(/\bone\s+or\s+two\b/gi, "1 or 2")
    .replace(/(\d)\s*[-–]\s*(?=\d)/g, "$1 to ")
  return (normalized.match(/-?\d+(?:[.,]\d+)?/g) || []).map((token) => token.replace(",", "."))
}

function sourceHasNegation(value) {
  return /\b(?:not|no|without|neither|nor)\b|does not|did not|was not|were not|free from|do not/i.test(value)
}

function renderingHasNegation(value) {
  return /degil|bulunmam|olmad|olmayabilir|dislamaz|taramadik|kullanmayan|anlasilmamistir|olusturulmamistir/.test(
    normalizedTurkish(value),
  )
}

function assertFidelity(claim, rendering) {
  if (rendering.trim() !== rendering || rendering.length < 12) {
    fail(`dna_aligned_b_rendering_invalid:${claim.id}`)
  }
  if (JSON.stringify(numericSequence(claim.proposition))
    !== JSON.stringify(numericSequence(rendering))) {
    fail(`dna_aligned_b_numbers_changed:${claim.id}`)
  }
  if (sourceHasNegation(claim.proposition) && !renderingHasNegation(rendering)) {
    fail(`dna_aligned_b_negation_lost:${claim.id}`)
  }
  const normalized = normalizedTurkish(rendering)
  const hedgeChecks = [
    [/tentatively/i, /gecici/],
    [/\bassociated\b|association/i, /iliski/],
    [/\bsuggested\b/i, /dusundur/],
    [/\boften\b/i, /cogu zaman/],
    [/\b(?:could|may|can)\b/i, /abilir|ebilir|olmayabilir/],
    [/\bshould\b/i, /malidir|melidir/],
    [/approximation/i, /yaklasik/],
    [/poorly understood/i, /yeterince anlasilmamistir/],
    [/more analysis is required/i, /gerekmektedir/],
  ]
  for (const [sourceCue, targetCue] of hedgeChecks) {
    if (sourceCue.test(claim.proposition) && !targetCue.test(normalized)) {
      fail(`dna_aligned_b_hedge_lost:${claim.id}`)
    }
  }
  if (/neden olur|yol acar|dogrudan etkiler|kesin olarak kanitlar/.test(normalized)) {
    fail(`dna_aligned_b_causal_upgrade:${claim.id}`)
  }
  if (claim.causalStatus === "associational"
    && !/iliski|ardindan|izleyen|eslik|birlikte|baglant/.test(normalized)) {
    fail(`dna_aligned_b_association_marker_missing:${claim.id}`)
  }
  if (/tani koy|tedavi edilmeli|ilac (?:oner|kullanilmali)|doz (?:oner|ayarla)|seans plani|prognoz (?:ver|tahmin)/.test(normalized)) {
    fail(`dna_aligned_b_clinical_addition:${claim.id}`)
  }
  if (/mekanizmasi sudur|beyinde su yolla|biyolojik olarak kanitlar/.test(normalized)) {
    fail(`dna_aligned_b_mechanism_addition:${claim.id}`)
  }
  return {
    numberSequencePreserved: true,
    negationPreserved: true,
    hedgePreserved: true,
    causalStrengthPreserved: true,
    noAddedClinicalAction: true,
    noAddedMechanism: true,
  }
}

function omit(value, key) {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function buildArtifact(inputs) {
  const { candidate, selection, authoring } = inputs
  if (candidate.schemaVersion !== "dna-external-science-candidate@1"
    || stableSha256(omit(candidate, "packageSha256")) !== candidate.packageSha256
    || candidate.runtimeEligible !== false || candidate.releaseEligible !== false
    || candidate.activationAllowed !== false || candidate.activeRuntimeGeneration !== "v2_legacy") {
    fail("dna_aligned_b_candidate_invalid")
  }
  assertNeutralSelectionContract(selection)
  if (selection.selectionSetSha256 !== EXPECTED_SELECTION_SET_SHA
    || selection.candidatePackageSha256 !== candidate.packageSha256
    || selection.candidateFileSha256 !== inputs.candidateRawSha256
    || selection.runtimeEligible !== false || selection.releaseEligible !== false
    || selection.activationAllowed !== false || selection.selections.length !== 42) {
    fail("dna_aligned_b_selection_invalid")
  }
  assertAuthoringContract(authoring)
  const authoredByClaim = new Map(authoring.renderings.map((entry) => [entry.claimId, entry]))
  if (selection.selections.some((entry) => !authoredByClaim.has(entry.claimId))) {
    fail("dna_aligned_b_authoring_selection_mismatch")
  }
  const topics = new Map(candidate.topics.map((entry) => [entry.id, entry]))
  const sources = new Map(candidate.sources.map((entry) => [entry.id, entry]))
  const claims = new Map(candidate.claims.map((entry) => [entry.id, entry]))
  const passages = new Map(candidate.passages.map((entry) => [entry.id, entry]))
  const renderings = selection.selections.map((selected) => {
    const topic = topics.get(selected.topicId)
    const source = sources.get(selected.sourceId)
    const claim = claims.get(selected.claimId)
    const passage = passages.get(selected.passageId)
    const authored = authoredByClaim.get(selected.claimId)
    if (!topic || !source || !claim || !passage || !authored
      || claim.topicId !== topic.id || claim.sourceId !== source.id
      || claim.passageId !== passage.id || passage.sourceId !== source.id
      || claim.claimSha256 !== selected.candidateClaimSha256
      || passage.passageSha256 !== selected.candidatePassageSha256
      || stableSha256(omit(claim, "claimSha256")) !== claim.claimSha256
      || stableSha256(omit(passage, "passageSha256")) !== passage.passageSha256
      || stableSha256(omit(source, "sourceSha256")) !== source.sourceSha256
      || stableSha256(omit(topic, "topicSha256")) !== topic.topicSha256
      || topic.ownerBookAuthority !== false || source.runtimeEligible !== false
      || source.releaseEligible !== false || claim.runtimeEligible !== false
      || claim.releaseEligible !== false || passage.runtimeEligible !== false
      || passage.releaseEligible !== false) {
      fail(`dna_aligned_b_candidate_binding_invalid:${selected.claimId}`)
    }
    const base = {
      id: `turkish-rendering-b-aligned:${claim.id}`,
      neutralSelectionId: selected.id,
      neutralSelectionSha256: selected.selectionSha256,
      slot: selected.slot,
      topicId: topic.id,
      sourceId: source.id,
      claimId: claim.id,
      passageId: passage.id,
      candidateHashes: {
        topicSha256: topic.topicSha256,
        sourceSha256: source.sourceSha256,
        claimSha256: claim.claimSha256,
        passageSha256: passage.passageSha256,
      },
      originalProposition: claim.proposition,
      originalPropositionSha256: sha256(claim.proposition),
      turkishRendering: authored.turkishRendering,
      turkishRenderingSha256: sha256(authored.turkishRendering),
      decision: authored.decision,
      bindings: {
        ageScope: claim.ageScope,
        passageAgeScope: passage.ageScope,
        evidenceLevel: claim.evidenceLevel,
        causalStatus: claim.causalStatus,
        claimBoundarySha256: sha256(claim.claimBoundary),
        passageBoundarySha256: sha256(passage.claimBoundary),
        publicationStatus: claim.publicationStatus,
        relationClass: claim.relationClass,
        dnaProductRelation: claim.dnaProductRelation,
      },
      fidelity: assertFidelity(claim, authored.turkishRendering),
      provenance: PROVENANCE,
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
    }
    return seal(base, "renderingRecordSha256")
  })
  const base = {
    schemaVersion: VERSION,
    sealedAt: selection.sealedAt,
    status: "candidate_translation_pass_b_aligned",
    authorityClass: "external_science_candidate_translation_feasibility",
    provenance: PROVENANCE,
    input: {
      candidateRelativePath: CANDIDATE_PATH,
      candidateFileSha256: inputs.candidateRawSha256,
      candidatePackageSha256: candidate.packageSha256,
      neutralSelectionRelativePath: SELECTION_PATH,
      neutralSelectionFileSha256: inputs.selectionRawSha256,
      neutralSelectionArtifactSha256: selection.artifactSha256,
      selectionSetSha256: selection.selectionSetSha256,
      authoringRelativePath: AUTHORING_PATH,
      authoringFileSha256: inputs.authoringRawSha256,
      authoringSha256: authoring.authoringSha256,
    },
    renderings,
    counts: {
      topics: new Set(renderings.map((entry) => entry.topicId)).size,
      sources: new Set(renderings.map((entry) => entry.sourceId)).size,
      renderings: renderings.length,
      start: renderings.filter((entry) => entry.slot === "start").length,
      middle: renderings.filter((entry) => entry.slot === "middle").length,
      end: renderings.filter((entry) => entry.slot === "end").length,
      fidelityPassed: renderings.length,
    },
    verification: {
      neutralSelectionBound: true,
      candidateBindingsVerified: renderings.length,
      fidelityPassed: renderings.length,
      deterministicRepeats: 20,
      deterministicUniqueHashes: 1,
      passAArtifactRead: false,
      lockedHoldoutAccessed: false,
      textInRepoManifest: false,
    },
    boundaries: {
      candidateOnly: true,
      independentHumanReview: false,
      runtimeAuthority: "none",
      releaseAuthority: "none",
      activationAuthority: "none",
      adapterAuthority: "none",
      ownerBookAuthority: "none",
      v3ReleaseDecision: "no_go_unchanged",
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    adapterAuthority: false,
    ownerBookAuthority: false,
  }
  return seal(base, "artifactSha256")
}

function loadInputs(root) {
  const candidate = readJson(root, CANDIDATE_PATH)
  const selection = readJson(root, SELECTION_PATH)
  const authoring = readJson(root, AUTHORING_PATH)
  return {
    candidate: candidate.value,
    candidateRawSha256: candidate.rawSha256,
    selection: selection.value,
    selectionRawSha256: selection.rawSha256,
    authoring: authoring.value,
    authoringRawSha256: authoring.rawSha256,
  }
}

function buildManifest(artifact, output) {
  return {
    schemaVersion: MANIFEST_SCHEMA,
    recordedAt: artifact.sealedAt,
    version: VERSION,
    provenance: PROVENANCE,
    inputHashes: {
      candidatePackageSha256: artifact.input.candidatePackageSha256,
      candidateFileSha256: artifact.input.candidateFileSha256,
      neutralSelectionArtifactSha256: artifact.input.neutralSelectionArtifactSha256,
      neutralSelectionFileSha256: artifact.input.neutralSelectionFileSha256,
      selectionSetSha256: artifact.input.selectionSetSha256,
      authoringSha256: artifact.input.authoringSha256,
      authoringFileSha256: artifact.input.authoringFileSha256,
    },
    output: {
      researchSsdRelativePath: ARTIFACT_PATH,
      rawSha256: output.rawSha256,
      artifactSha256: artifact.artifactSha256,
      byteCount: output.bytes,
      fileMode: "0600",
    },
    counts: artifact.counts,
    acceptance: {
      neutralSelectionBinding: "pass",
      exactCoverage: "pass",
      fidelityGate: "pass",
      deterministic: "pass",
      textLeakGate: "pass",
      candidateOnly: true,
    },
    boundaries: artifact.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
  }
}

function assertManifestSafe(manifest, artifact) {
  const serialized = JSON.stringify(manifest)
  for (const record of artifact.renderings) {
    if (serialized.includes(record.originalProposition)
      || serialized.includes(record.turkishRendering)
      || serialized.includes(record.decision)) fail("dna_aligned_b_manifest_text_leak")
  }
}

function main() {
  const command = process.argv[2] || "verify"
  if (!["build", "verify", "print-manifest"].includes(command) || process.argv.length !== 3) {
    fail("dna_aligned_b_command_invalid")
  }
  const root = resolveRoot()
  const inputs = loadInputs(root)
  const artifact = buildArtifact(inputs)
  const hashes = Array.from({ length: 20 }, () => buildArtifact(inputs).artifactSha256)
  if (new Set(hashes).size !== 1 || hashes[0] !== artifact.artifactSha256) {
    fail("dna_aligned_b_nondeterministic")
  }
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8")
  const output = command === "build" || command === "print-manifest"
    ? secureAtomicWrite(root, join(root, ARTIFACT_PATH), bytes)
    : (() => {
      const path = assertSecurePath(root, join(root, ARTIFACT_PATH), { mode0600: true })
      const actual = readFileSync(path)
      if (!actual.equals(bytes)) fail("dna_aligned_b_artifact_drift")
      return { path, rawSha256: sha256(actual), bytes: actual.length }
    })()
  const manifest = buildManifest(artifact, output)
  assertManifestSafe(manifest, artifact)
  if (command === "print-manifest") {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
    return
  }
  const manifestPath = assertSecurePath(process.cwd(), join(process.cwd(), REPO_MANIFEST), {
    mode0600: false,
  })
  const recorded = JSON.parse(readFileSync(manifestPath, "utf8"))
  if (stableSha256(recorded) !== stableSha256(manifest)) fail("dna_aligned_b_manifest_drift")
  process.stdout.write(`${JSON.stringify({
    ok: true,
    version: VERSION,
    counts: artifact.counts,
    deterministicRepeats: hashes.length,
    uniqueHashes: new Set(hashes).size,
    selectionSetSha256: artifact.input.selectionSetSha256,
    artifactSha256: artifact.artifactSha256,
    rawSha256: output.rawSha256,
    boundaries: artifact.boundaries,
  }, null, 2)}\n`)
}

export {
  ARTIFACT_PATH,
  AUTHORING_PATH,
  EXPECTED_SELECTION_SET_SHA,
  PROVENANCE,
  REPO_MANIFEST,
  VERSION,
  assertFidelity,
  buildArtifact,
  buildManifest,
  loadInputs,
  secureAtomicWrite,
  stableSha256,
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
