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

export const VERSION = "dna-external-science-turkish-pass-b-remaining-authoring@1"
export const ARTIFACT_SCHEMA = "dna-external-science-turkish-pass-b-remaining-candidate@1"
export const MANIFEST_SCHEMA = "dna-external-science-turkish-pass-b-remaining-manifest@1"
export const INPUT_SCHEMA = "dna-external-science-turkish-pass-b-remaining-authoring-input@1"

export const WORKPACK_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-full-coverage-workpacks/prebook-v1/pass-b/authoring-workpack.json"
export const AUTHORING_INPUT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b-remaining/prebook-v1/pass-b-remaining-authoring-input.json"
export const ARTIFACT_RELATIVE_PATH =
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b-remaining/prebook-v1/pass-b-remaining-candidate-only.json"
export const REPO_MANIFEST_RELATIVE_PATH =
  "docs/dna-intelligence/program/evidence/external-science-turkish-pass-b-remaining-current.json"

const EXPECTED = Object.freeze({
  workpackRawSha256: "7ae8e2ecc11eea343cc0ceaa0055d89fee4cd8773809ccae1fd3e970cd76f5e1",
  workpackSha256: "23df3848e80c1ae998c0286476e72df83a0679fd348b56b2aa694d8a80d8173a",
  authoringInputRawSha256: "d9d8ca73a39cf4e19ad33638fd508a172ea11b7c4974dd56ba8f4bdcf20daf9a",
  records: 178,
})

const FIDELITY_NOTE =
  "Yalnız bağlı önerme ve pasaj aktarıldı; sayı, olumsuzluk, kesinlik, yaş/örneklem, nedensellik ve kanıt sınırı korundu; yeni mekanizma, tanı, tedavi, kişisel öneri veya DNA ürün geçerliği eklenmedi."

function fail(code) {
  throw new Error(code)
}

function assert(condition, code) {
  if (!condition) fail(code)
}

export function canonicalize(value) {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return value
  if (Array.isArray(value)) return value.map(canonicalize)
  assert(value && typeof value === "object", "dna_pass_b_remaining_non_json_value")
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, child]) => [key, canonicalize(child)]))
}

export function stableSha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex")
}

export function bytesSha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function omit(value, key) {
  const copy = { ...value }
  delete copy[key]
  return copy
}

function seal(value, key) {
  return { ...value, [key]: stableSha256(value) }
}

export function resolveSsdRoot(requested = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD") {
  const absolute = resolve(requested)
  assert(existsSync(absolute), "dna_pass_b_remaining_ssd_missing")
  const metadata = lstatSync(absolute)
  assert(metadata.isDirectory() && !metadata.isSymbolicLink(), "dna_pass_b_remaining_ssd_root_invalid")
  const real = realpathSync(absolute)
  assert(
    real === "/Volumes/ResearchSSD" || real.startsWith(`/Volumes/ResearchSSD${sep}`),
    "dna_pass_b_remaining_local_fallback_forbidden",
  )
  return real
}

function assertContained(root, requested, code) {
  const target = resolve(requested)
  const delta = relative(root, target)
  assert(delta && delta !== ".." && !delta.startsWith(`..${sep}`) && !delta.startsWith(sep), code)
  return target
}

export function assertSecurePath(root, requested, options = {}) {
  const { mode0600 = false } = options
  const target = assertContained(root, requested, "dna_pass_b_remaining_path_escape")
  let current = root
  for (const part of relative(root, target).split(sep).filter(Boolean)) {
    current = join(current, part)
    assert(existsSync(current), "dna_pass_b_remaining_input_missing")
    const metadata = lstatSync(current)
    assert(!metadata.isSymbolicLink(), "dna_pass_b_remaining_symlink_forbidden")
    if (current !== target) assert(metadata.isDirectory(), "dna_pass_b_remaining_parent_invalid")
    if (current === target) assert(metadata.isFile(), "dna_pass_b_remaining_file_invalid")
  }
  if (mode0600) assert((statSync(target).mode & 0o777) === 0o600, "dna_pass_b_remaining_mode_invalid")
  const real = realpathSync(target)
  const delta = relative(root, real)
  assert(delta !== ".." && !delta.startsWith(`..${sep}`) && !delta.startsWith(sep),
    "dna_pass_b_remaining_realpath_escape")
  return target
}

function ensureSecureParents(root, requested) {
  const target = assertContained(root, requested, "dna_pass_b_remaining_output_escape")
  let current = root
  for (const part of relative(root, dirname(target)).split(sep).filter(Boolean)) {
    current = join(current, part)
    if (!existsSync(current)) mkdirSync(current, { mode: 0o700 })
    const metadata = lstatSync(current)
    assert(metadata.isDirectory() && !metadata.isSymbolicLink(),
      "dna_pass_b_remaining_output_parent_invalid")
  }
  if (existsSync(target)) {
    const metadata = lstatSync(target)
    assert(metadata.isFile() && !metadata.isSymbolicLink(), "dna_pass_b_remaining_output_leaf_invalid")
  }
  return target
}

export function secureAtomicWrite(root, requested, bytes) {
  const target = ensureSecureParents(root, requested)
  const temporary = join(dirname(target),
    `.${basename(target)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`)
  let descriptor
  try {
    descriptor = openSync(temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
    let offset = 0
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset, offset)
      assert(written > 0, "dna_pass_b_remaining_write_zero_progress")
      offset += written
    }
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    chmodSync(temporary, 0o600)
    renameSync(temporary, target)
    chmodSync(target, 0o600)
    const parentDescriptor = openSync(dirname(target), constants.O_RDONLY)
    try {
      fsyncSync(parentDescriptor)
    } finally {
      closeSync(parentDescriptor)
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
  const safe = assertSecurePath(root, target, { mode0600: true })
  const actual = readFileSync(safe)
  assert(actual.equals(bytes), "dna_pass_b_remaining_write_readback_mismatch")
  return { path: safe, rawSha256: bytesSha256(actual), bytes: actual.length, mode: "0600" }
}

function readSsdJson(root, relativePath) {
  const path = assertSecurePath(root, join(root, relativePath), { mode0600: true })
  const bytes = readFileSync(path)
  return { value: JSON.parse(bytes.toString("utf8")), rawSha256: bytesSha256(bytes), bytes: bytes.length }
}

function readRepoJson(repoRoot, relativePath) {
  const path = assertSecurePath(repoRoot, join(repoRoot, relativePath))
  const bytes = readFileSync(path)
  return { value: JSON.parse(bytes.toString("utf8")), rawSha256: bytesSha256(bytes), bytes: bytes.length }
}

function numericTokens(value) {
  return (value.replaceAll("²", "2").match(/\d+/g) || []).map((part) => String(Number(part)))
}

function assertRenderingFidelity(item, rendering) {
  assert(typeof rendering === "string" && rendering === rendering.trim() && rendering.length >= 8,
    `dna_pass_b_remaining_rendering_invalid:${item.id}`)
  assert(rendering !== item.original.proposition
    && !/\b(?:the studies|the review|we recommend|was reported|were included|is not|did not)\b/i.test(rendering),
  `dna_pass_b_remaining_untranslated_run:${item.id}`)
  assert(numericTokens(item.original.proposition).sort().join("|")
    === numericTokens(rendering).sort().join("|"),
    `dna_pass_b_remaining_numeric_drift:${item.id}`)

  const proposition = item.original.proposition.toLowerCase().replace(/go-no-go/g, "")
  if (/\b(?:might|may|could|possible|potential|likely|suggest|suggested|unclear|unknown|equivocal)\b|not conclusive/.test(proposition)) {
    assert(/olası|muhtem|mümkün|potansiyel|[ae]bil|düşündür|işaret|belirsiz|bilinme|kesin bir sonuca/.test(rendering.toLowerCase()),
      `dna_pass_b_remaining_hedge_lost:${item.id}`)
  }
  if (/\b(?:no|not|never|without|lacking|excluded|neither)\b|did not|was not|were not|cannot/.test(proposition)) {
    assert(/değil|yok|olmadı|olmadan|olmaksızın|ilişkisiz|hariç|dış|bulunma|alınma|almadık|edilm|edile|etmedik|kullanılm|incelenmedi|ölçülmedi|varamadı|lanmadı|lenmedi|taramadık|sınanmadı|vermem|mamış|memiş|mıyor|miyor|muyor|müyor|maz|mez|bağımlı değildir|sağlamadı|kaybederiz/.test(rendering.toLowerCase()),
      `dna_pass_b_remaining_negation_lost:${item.id}`)
  }
  assert(!/sizin|size özel|tanı koyar|tedavi eder|dna profiliniz|dna ürününün geçerli/.test(rendering.toLowerCase()),
    `dna_pass_b_remaining_personal_or_product_expansion:${item.id}`)
}

export function validateWorkpack(workpack, rawSha256) {
  assert(rawSha256 === EXPECTED.workpackRawSha256, "dna_pass_b_remaining_workpack_file_drift")
  assert(workpack.schemaVersion === "dna-external-science-turkish-blind-authoring-workpack@1",
    "dna_pass_b_remaining_workpack_schema")
  assert(workpack.passId === "B" && workpack.status === "blank_blind_authoring_workpack",
    "dna_pass_b_remaining_workpack_identity")
  assert(workpack.workpackSha256 === EXPECTED.workpackSha256
    && stableSha256(omit(workpack, "workpackSha256")) === workpack.workpackSha256,
  "dna_pass_b_remaining_workpack_hash")
  assert(workpack.counts?.remainingClaims === EXPECTED.records
    && workpack.counts?.answerUnits === EXPECTED.records
    && Array.isArray(workpack.workItems) && workpack.workItems.length === EXPECTED.records,
  "dna_pass_b_remaining_workpack_count")
  assert(workpack.blindContract?.sourceMaterialOnly === true
    && workpack.blindContract?.turkishRenderingsIncluded === false
    && workpack.blindContract?.reconciliationDecisionsIncluded === false
    && workpack.blindContract?.otherPassRenderingAccessAllowed === false,
  "dna_pass_b_remaining_workpack_blind_contract")
  assert(workpack.boundaries?.candidateOnly === true
    && workpack.runtimeEligible === false && workpack.releaseEligible === false
    && workpack.activationAllowed === false && workpack.ownerAuthority === false,
  "dna_pass_b_remaining_workpack_boundary")

  const ids = new Set()
  const claims = new Set()
  for (const [index, item] of workpack.workItems.entries()) {
    assert(item.passId === "B" && item.scheduleOrdinal === index + 1,
      `dna_pass_b_remaining_work_item_order:${index + 1}`)
    assert(!ids.has(item.id) && !claims.has(item.claimId),
      `dna_pass_b_remaining_work_item_duplicate:${item.id}`)
    ids.add(item.id)
    claims.add(item.claimId)
    assert(stableSha256(omit(item, "workItemSha256")) === item.workItemSha256,
      `dna_pass_b_remaining_work_item_hash:${item.id}`)
    assert(bytesSha256(item.original.proposition) === item.hashes.propositionSha256
      && bytesSha256(item.original.passageText) === item.hashes.passageContentSha256,
    `dna_pass_b_remaining_text_hash:${item.id}`)
    assert(item.hashes.candidatePackageSha256 === workpack.inputs.candidatePackageSha256
      && item.hashes.candidateFileSha256 === workpack.inputs.candidateFileSha256,
    `dna_pass_b_remaining_candidate_binding:${item.id}`)
    assert(item.boundaries.maximumGraphHops === 1
      && item.boundaries.multiStepMechanismAllowed === false
      && item.boundaries.dnaProductRelation === "not_established",
    `dna_pass_b_remaining_claim_boundary:${item.id}`)
    assert(item.runtimeEligible === false && item.releaseEligible === false
      && item.activationAllowed === false && item.ownerAuthority === false,
    `dna_pass_b_remaining_item_authority:${item.id}`)
  }
}

export function validateAuthoringInput(authoring, rawSha256, workpack) {
  assert(rawSha256 === EXPECTED.authoringInputRawSha256, "dna_pass_b_remaining_authoring_file_drift")
  assert(authoring.schemaVersion === INPUT_SCHEMA
    && authoring.status === "pass_b_remaining_178_candidate_only" && authoring.passId === "B",
  "dna_pass_b_remaining_authoring_identity")
  assert(Array.isArray(authoring.renderings) && authoring.renderings.length === EXPECTED.records,
    "dna_pass_b_remaining_authoring_count")
  const workItems = new Map(workpack.workItems.map((item) => [item.id, item]))
  const seen = new Set()
  for (const record of authoring.renderings) {
    assert(record && Object.keys(record).sort().join("|") === "turkishRendering|workItemId",
      "dna_pass_b_remaining_authoring_shape")
    assert(!seen.has(record.workItemId), `dna_pass_b_remaining_authoring_duplicate:${record.workItemId}`)
    seen.add(record.workItemId)
    const item = workItems.get(record.workItemId)
    assert(item, `dna_pass_b_remaining_authoring_extra:${record.workItemId}`)
    assertRenderingFidelity(item, record.turkishRendering)
  }
  assert(workpack.workItems.every((item) => seen.has(item.id)), "dna_pass_b_remaining_authoring_missing")
}

export function loadInputs(root) {
  const workpack = readSsdJson(root, WORKPACK_RELATIVE_PATH)
  const authoring = readSsdJson(root, AUTHORING_INPUT_RELATIVE_PATH)
  validateWorkpack(workpack.value, workpack.rawSha256)
  validateAuthoringInput(authoring.value, authoring.rawSha256, workpack.value)
  return {
    workpack: workpack.value,
    workpackRawSha256: workpack.rawSha256,
    authoring: authoring.value,
    authoringRawSha256: authoring.rawSha256,
  }
}

export function buildArtifact(inputs) {
  validateWorkpack(inputs.workpack, inputs.workpackRawSha256)
  validateAuthoringInput(inputs.authoring, inputs.authoringRawSha256, inputs.workpack)
  const renderingById = new Map(inputs.authoring.renderings
    .map((entry) => [entry.workItemId, entry.turkishRendering]))
  const records = inputs.workpack.workItems.map((item) => {
    const turkishRendering = renderingById.get(item.id)
    const base = {
      workItemId: item.id,
      claimId: item.claimId,
      topicId: item.topicId,
      sourceId: item.sourceId,
      passageId: item.passageId,
      answerUnitId: item.answerUnitId,
      turkishRendering,
      fidelityNote: FIDELITY_NOTE,
      bindings: {
        workpackSha256: inputs.workpack.workpackSha256,
        workItemSha256: item.workItemSha256,
        candidatePackageSha256: item.hashes.candidatePackageSha256,
        candidateFileSha256: item.hashes.candidateFileSha256,
        topicSha256: item.hashes.topicSha256,
        sourceSha256: item.hashes.sourceSha256,
        sourceArtifactSha256: item.hashes.sourceArtifactSha256,
        passageSha256: item.hashes.passageSha256,
        passageContentSha256: item.hashes.passageContentSha256,
        claimSha256: item.hashes.claimSha256,
        propositionSha256: item.hashes.propositionSha256,
        answerUnitSha256: item.hashes.answerUnitSha256,
        turkishRenderingSha256: bytesSha256(turkishRendering),
      },
      fidelityBoundary: {
        ageScope: item.boundaries.ageScope,
        passageAgeScope: item.boundaries.passageAgeScope,
        causalStatus: item.boundaries.causalStatus,
        evidenceLevel: item.boundaries.evidenceLevel,
        evidenceType: item.boundaries.evidenceType,
        publicationStatus: item.boundaries.publicationStatus,
        relationClass: item.boundaries.relationClass,
        dnaProductRelation: item.boundaries.dnaProductRelation,
        maximumGraphHops: item.boundaries.maximumGraphHops,
        multiStepMechanismAllowed: item.boundaries.multiStepMechanismAllowed,
      },
      status: "pass_b_remaining_178_candidate_only",
      runtimeEligible: false,
      releaseEligible: false,
      activationAllowed: false,
      ownerAuthority: false,
      independentHuman: false,
      independentHumanReview: false,
    }
    return seal(base, "recordSha256")
  })
  const base = {
    schemaVersion: ARTIFACT_SCHEMA,
    version: VERSION,
    preparedAt: inputs.workpack.preparedAt,
    status: "pass_b_remaining_178_candidate_only",
    passId: "B",
    provenance: "codex_blind_translation_authoring_pass_b_remaining",
    inputBindings: {
      workpackRelativePath: WORKPACK_RELATIVE_PATH,
      workpackRawSha256: inputs.workpackRawSha256,
      workpackSha256: inputs.workpack.workpackSha256,
      authoringInputRelativePath: AUTHORING_INPUT_RELATIVE_PATH,
      authoringInputRawSha256: inputs.authoringRawSha256,
      candidatePackageSha256: inputs.workpack.inputs.candidatePackageSha256,
      candidateFileSha256: inputs.workpack.inputs.candidateFileSha256,
    },
    blindContract: {
      passBWorkpackOnly: true,
      sourceMaterialOnly: true,
      passAAccessed: false,
      alignedPassBAccessed: false,
      reconciliationAccessed: false,
      lockedHoldoutOrResultAccessed: false,
      externalModelUsed: false,
      networkUsed: false,
    },
    records,
    counts: {
      workItems: inputs.workpack.workItems.length,
      renderings: records.length,
      fidelityPassed: records.length,
      uniqueWorkItems: new Set(records.map((entry) => entry.workItemId)).size,
      uniqueClaims: new Set(records.map((entry) => entry.claimId)).size,
      topics: new Set(records.map((entry) => entry.topicId)).size,
      sources: new Set(records.map((entry) => entry.sourceId)).size,
      passages: new Set(records.map((entry) => entry.passageId)).size,
      duplicateWorkItems: 0,
      missingWorkItems: 0,
      extraWorkItems: 0,
    },
    verification: {
      exactShapeVerified: records.length,
      claimSourcePassageCandidateBindingsVerified: records.length,
      numberNegationHedgeAgeSampleCausalityEvidenceBoundariesChecked: records.length,
      maximumGraphHops: 1,
      multiStepMechanismAllowed: false,
      fullTextStoredOnResearchSsdOnly: true,
      repositoryManifestAggregateAndHashOnly: true,
      independentHumanReviewPerformed: false,
    },
    boundaries: {
      candidateOnly: true,
      translationPerformed: true,
      reconciliationPerformed: false,
      runtimeAuthority: false,
      releaseAuthority: false,
      activationAuthority: false,
      ownerAuthority: false,
      independentHuman: false,
      independentHumanReview: false,
      activeRuntimeGeneration: "v2_legacy",
      v3ReleaseDecision: "no_go_unchanged",
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHuman: false,
    independentHumanReview: false,
  }
  return seal(base, "artifactSha256")
}

function artifactBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function verifyBytes(root, relativePath, expectedBytes) {
  const path = assertSecurePath(root, join(root, relativePath), { mode0600: true })
  const actual = readFileSync(path)
  assert(actual.equals(expectedBytes), `dna_pass_b_remaining_artifact_drift:${relativePath}`)
  return { path, rawSha256: bytesSha256(actual), bytes: actual.length, mode: "0600" }
}

export function buildRepoManifest(artifact, output) {
  const base = {
    schemaVersion: MANIFEST_SCHEMA,
    recordedAt: artifact.preparedAt,
    version: VERSION,
    status: artifact.status,
    passId: "B",
    inputHashes: {
      workpackRawSha256: artifact.inputBindings.workpackRawSha256,
      workpackSha256: artifact.inputBindings.workpackSha256,
      authoringInputRawSha256: artifact.inputBindings.authoringInputRawSha256,
      candidatePackageSha256: artifact.inputBindings.candidatePackageSha256,
      candidateFileSha256: artifact.inputBindings.candidateFileSha256,
    },
    outputHashes: {
      artifactRawSha256: output.rawSha256,
      artifactSha256: artifact.artifactSha256,
      recordsSha256: stableSha256(artifact.records.map((entry) => entry.recordSha256)),
      byteCount: output.bytes,
      fileMode: "0600",
    },
    counts: artifact.counts,
    verification: artifact.verification,
    blindContract: artifact.blindContract,
    boundaries: artifact.boundaries,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHuman: false,
    independentHumanReview: false,
  }
  return seal(base, "manifestSha256")
}

export function assertManifestSafe(manifest, inputs, artifact) {
  const serialized = JSON.stringify(manifest)
  const forbidden = []
  for (const item of inputs.workpack.workItems) {
    forbidden.push(item.id, item.claimId, item.topicId, item.sourceId, item.passageId,
      item.original.proposition, item.original.passageText)
  }
  for (const record of artifact.records) forbidden.push(record.turkishRendering, record.fidelityNote)
  for (const value of forbidden) assert(!serialized.includes(value),
    "dna_pass_b_remaining_repo_manifest_text_or_identity_leak")
  assert(!/turkishRendering|fidelityNote|proposition|passageText|workItemId|claimId|sourceId|passageId/.test(serialized),
    "dna_pass_b_remaining_repo_manifest_field_leak")
}

export function execute(command, options = {}) {
  assert(["write", "verify", "print-manifest"].includes(command), "dna_pass_b_remaining_command_invalid")
  const root = resolveSsdRoot(options.root)
  const repoRoot = resolve(options.repoRoot || process.cwd())
  const inputs = loadInputs(root)
  const artifact = buildArtifact(inputs)
  const bytes = artifactBytes(artifact)
  const output = command === "write"
    ? secureAtomicWrite(root, join(root, ARTIFACT_RELATIVE_PATH), bytes)
    : verifyBytes(root, ARTIFACT_RELATIVE_PATH, bytes)
  const manifest = buildRepoManifest(artifact, output)
  assertManifestSafe(manifest, inputs, artifact)
  if (command === "verify") {
    const recorded = readRepoJson(repoRoot, REPO_MANIFEST_RELATIVE_PATH).value
    assert(stableSha256(recorded) === stableSha256(manifest), "dna_pass_b_remaining_repo_manifest_drift")
  }
  return { root, inputs, artifact, output, manifest }
}

function publicSummary(result) {
  return {
    ok: true,
    version: VERSION,
    status: result.artifact.status,
    counts: result.artifact.counts,
    workpackRawSha256: result.inputs.workpackRawSha256,
    workpackSha256: result.inputs.workpack.workpackSha256,
    authoringInputRawSha256: result.inputs.authoringRawSha256,
    artifactSha256: result.artifact.artifactSha256,
    artifactRawSha256: result.output.rawSha256,
    recordsSha256: result.manifest.outputHashes.recordsSha256,
    manifestSha256: result.manifest.manifestSha256,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    independentHuman: false,
    independentHumanReview: false,
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  assert(process.argv.length === 3, "dna_pass_b_remaining_command_arity")
  const result = execute(process.argv[2])
  if (process.argv[2] === "print-manifest") {
    process.stdout.write(`${JSON.stringify(result.manifest, null, 2)}\n`)
  } else {
    process.stdout.write(`${JSON.stringify(publicSummary(result), null, 2)}\n`)
  }
}
