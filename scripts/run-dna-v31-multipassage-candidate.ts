import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, relative, resolve, sep } from "node:path"

import {
  DNA_V31_MULTIPASSAGE_SCHEMA,
  hashDnaV31Value,
  renderDnaV31Candidate,
  stableDnaV31Json,
  type DnaV31CandidateUnit,
  type DnaV31Family,
  type DnaV31MultipassageCandidate,
  type DnaV31Source,
  validateDnaV31Candidate,
} from "../src/lib/dna/chat/v31MultiPassageCandidate"

type JsonRecord = Record<string, any>

const RESEARCH_SSD_ROOT = resolve(process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD")
const CANDIDATE_INPUT = resolve(
  RESEARCH_SSD_ROOT,
  "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json",
)
const RECONCILIATION_42 = resolve(
  RESEARCH_SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-reconciliation/feasibility-v1/reconciliation-artifact.json",
)
const RECONCILIATION_178 = resolve(
  RESEARCH_SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-remaining-reconciliation/prebook-v1/reconciliation-artifact.json",
)
const OUTPUT_ROOT = resolve(
  RESEARCH_SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/v31-multipassage-candidate/v1",
)
const CANDIDATE_OUTPUT = resolve(OUTPUT_ROOT, "candidate.json")
const STRESS_WORKPACK_OUTPUT = resolve(OUTPUT_ROOT, "stress-reactivity-recovery-workpack.json")
const SENSORY_WORKPACK_OUTPUT = resolve(OUTPUT_ROOT, "sensory-modulation-workpack.json")
const REPO_MANIFEST = resolve(
  process.cwd(),
  "docs/dna-intelligence/program/evidence/v31-multipassage-candidate-current.json",
)

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex")

function assertSsdPath(path: string): void {
  const delta = relative(RESEARCH_SSD_ROOT, resolve(path))
  if (delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) {
    throw new Error("dna_v31_ssd_path_escape")
  }
}

function assertNoSymlinkChain(path: string): void {
  let cursor = resolve(path)
  while (cursor !== dirname(cursor)) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`dna_v31_symlink_forbidden:${cursor}`)
    }
    cursor = dirname(cursor)
  }
}

function readSecureJson(path: string): JsonRecord {
  assertSsdPath(path)
  assertNoSymlinkChain(path)
  if (!existsSync(path) || !lstatSync(path).isFile()) throw new Error(`dna_v31_input_missing:${path}`)
  if ((statSync(path).mode & 0o777) !== 0o600) throw new Error(`dna_v31_input_mode_invalid:${path}`)
  const real = realpathSync(path)
  assertSsdPath(real)
  return JSON.parse(readFileSync(real, "utf8")) as JsonRecord
}

function atomicWrite(path: string, bytes: string, mode: number): void {
  if (path.startsWith(`${RESEARCH_SSD_ROOT}${sep}`)) assertSsdPath(path)
  assertNoSymlinkChain(dirname(path))
  mkdirSync(dirname(path), { recursive: true, mode: path.startsWith(RESEARCH_SSD_ROOT) ? 0o700 : 0o755 })
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error("dna_v31_output_symlink_forbidden")
  const temporary = resolve(dirname(path), `.${process.pid}.${Date.now()}.tmp`)
  try {
    writeFileSync(temporary, bytes, { mode })
    renameSync(temporary, path)
    chmodSync(path, mode)
    if (readFileSync(path, "utf8") !== bytes) throw new Error("dna_v31_output_readback_mismatch")
  } finally {
    rmSync(temporary, { force: true })
  }
}

function renderingIndex(first: JsonRecord, second: JsonRecord): Map<string, JsonRecord> {
  const rows = [...first.records, ...second.records]
  assert.equal(rows.length, 220)
  const index = new Map<string, JsonRecord>()
  for (const row of rows) {
    assert(!index.has(row.claimId), `duplicate rendering ${row.claimId}`)
    const faithful = row.selectedSide === "a" || row.selectedSide === "b"
      ? row.selectedSide === "a" ? row.sourceFaithfulA === true : row.sourceFaithfulB === true
      : row.decision?.fidelity?.sourceFidelity === true
        && row.decision?.fidelity?.noAddedMechanism === true
        && row.decision?.fidelity?.causalStrengthPreserved === true
    assert.equal(faithful, true, `source fidelity missing ${row.claimId}`)
    assert.equal(sha256(row.finalRendering), row.finalRenderingSha256)
    index.set(row.claimId, row)
  }
  return index
}

const FAMILY_SELECTIONS = Object.freeze({
  neuroanatomy: Object.freeze([
    ["external.insula_interoception", "This region can be anatomically divided"],
    ["external.pfc_cognitive_control", "CC has often been considered synonymous"],
    ["external.insula_interoception", "Functional neuroimaging studies revealed"],
  ]),
  sleep: Object.freeze([
    ["external.circadian_light", "Throughout the daytime"],
    ["external.sleep_emotional_reactivity", "underlying mechanisms explaining sleep-dependent"],
    ["external.circadian_light", "These recommendations are derived based on data"],
  ]),
  interoception: Object.freeze([
    ["external.insula_interoception", "This region can be anatomically divided"],
    ["external.insula_interoception", "Functional neuroimaging studies revealed"],
  ]),
} as const)

function selectClaim(candidate: JsonRecord, topicId: string, propositionFragment: string): JsonRecord {
  const matches = candidate.claims.filter((claim: JsonRecord) => (
    claim.topicId === topicId && claim.proposition.includes(propositionFragment)
  ))
  assert.equal(matches.length, 1, `claim selection mismatch ${topicId}:${propositionFragment}`)
  return matches[0]
}

function buildCandidate(): Readonly<{
  candidate: DnaV31MultipassageCandidate
  manifest: JsonRecord
  stressWorkpack: JsonRecord
  sensoryWorkpack: JsonRecord
}> {
  const sourceCandidate = readSecureJson(CANDIDATE_INPUT)
  const reconciliation42 = readSecureJson(RECONCILIATION_42)
  const reconciliation178 = readSecureJson(RECONCILIATION_178)
  assert.equal(sourceCandidate.runtimeEligible, false)
  assert.equal(sourceCandidate.releaseEligible, false)
  assert.deepEqual(sourceCandidate.verification, {
    orphanSources: 0,
    orphanPassages: 0,
    orphanClaims: 0,
    orphanRelations: 0,
    claimsWithoutPassage: 0,
    answerUnitsWithoutSingleClaimPassageLink: 0,
    unlicensedPassages: 0,
    multiStepMechanisms: 0,
    unauthorizedBiologicalInferences: 0,
  })

  const sources = new Map(sourceCandidate.sources.map((row: JsonRecord) => [row.id, row]))
  const passages = new Map(sourceCandidate.passages.map((row: JsonRecord) => [row.id, row]))
  const answerUnits = new Map(sourceCandidate.answerUnits.map((row: JsonRecord) => [row.claimId, row]))
  const renderings = renderingIndex(reconciliation42, reconciliation178)
  const unitMap = new Map<string, DnaV31CandidateUnit>()
  const familyUnits = new Map<string, string[]>()

  for (const [familyId, selections] of Object.entries(FAMILY_SELECTIONS)) {
    const ids: string[] = []
    for (const [topicId, fragment] of selections) {
      const claim = selectClaim(sourceCandidate, topicId, fragment)
      const passage = passages.get(claim.passageId) as JsonRecord | undefined
      const source = sources.get(claim.sourceId) as JsonRecord | undefined
      const answerUnit = answerUnits.get(claim.id) as JsonRecord | undefined
      const rendering = renderings.get(claim.id)
      assert(passage && source && answerUnit && rendering)
      assert.equal(passage.sourceId, source.id)
      assert.equal(answerUnit.passageId, passage.id)
      assert.equal(answerUnit.sourceId, source.id)
      assert.equal(passage.licenseStatus, "approved")
      assert.equal(source.integrityState, "verified_clean")
      assert.equal(source.passageLicenseDecision, "cleared")
      assert.equal(answerUnit.maximumGraphHops, 1)
      assert.equal(answerUnit.multiStepMechanismAllowed, false)
      const id = `v31.unit:${claim.id}`
      const unit: DnaV31CandidateUnit = Object.freeze({
        id,
        claimId: claim.id,
        passageId: passage.id,
        sourceId: source.id,
        textTr: rendering.finalRendering,
        textTrSha256: rendering.finalRenderingSha256,
        sourcePassageSha256: passage.contentSha256,
        claimBoundary: claim.claimBoundary,
        maximumGraphHops: 1,
        multiStepMechanismAllowed: false,
        sourceFaithful: true,
      })
      unitMap.set(id, unit)
      ids.push(id)
    }
    familyUnits.set(familyId, ids)
  }

  const usedSourceIds = new Set([...unitMap.values()].map((unit) => unit.sourceId))
  const candidateSources: DnaV31Source[] = [...usedSourceIds]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((id) => {
      const source = sources.get(id) as JsonRecord
      return Object.freeze({
        id: source.id,
        title: source.title,
        workIdentity: `${source.artifactId}:${source.artifactSha256}`,
        integrityState: "verified_clean" as const,
        passageLicenseDecision: "cleared" as const,
        methodGate: "bounded_candidate_passed" as const,
        sourceFidelityGate: "reconciled_passed" as const,
      })
    })

  const successFamily = (
    id: DnaV31Family["id"],
    reason: string,
  ): DnaV31Family => {
    const unitIds = familyUnits.get(id) || []
    const independentSourceCount = new Set(unitIds.map((unitId) => unitMap.get(unitId)!.sourceId)).size
    return Object.freeze({ id, status: "candidate_success", reason, unitIds: Object.freeze(unitIds), independentSourceCount })
  }
  const unavailableFamily = (
    id: DnaV31Family["id"],
    reason: string,
  ): DnaV31Family => Object.freeze({
    id,
    status: "not_available",
    reason,
    unitIds: Object.freeze([]),
    independentSourceCount: 0,
  })

  const families: DnaV31Family[] = [
    successFamily("neuroanatomy", "Insula ve prefrontal bilişsel kontrol için üç ayrı pasaj ve iki bağımsız kaynak bağı doğrulandı."),
    successFamily("sleep", "Sirkadiyen ışık ve uyku-duygusal reaktivite için üç ayrı pasaj ve iki bağımsız kaynak bağı doğrulandı."),
    successFamily("interoception", "İnsula-interosepsiyon için iki ayrı pasaj doğrulandı; iki pasajın aynı incelemeden geldiği açıkça sayıldı."),
    unavailableFamily("stress_reactivity_recovery", "Mühürlü dış-bilim paketinde stres, reaktivite ve toparlanmayı birlikte ve doğrudan destekleyen iki uygun pasaj bulunmuyor."),
    unavailableFamily("sensory_modulation", "Mühürlü dış-bilim paketinde duyusal modülasyonu doğrudan destekleyen iki uygun pasaj bulunmuyor."),
  ]

  const payload = {
    schemaVersion: DNA_V31_MULTIPASSAGE_SCHEMA,
    authorityClass: "external_science_candidate" as const,
    runtimeEligible: false as const,
    releaseEligible: false as const,
    activationAllowed: false as const,
    liveRuntime: "dna-chat-engine@2" as const,
    sources: Object.freeze(candidateSources),
    units: Object.freeze([...unitMap.values()].sort((left, right) => left.id.localeCompare(right.id, "en"))),
    families: Object.freeze(families),
    inputHashes: Object.freeze({
      externalScienceCandidate: sha256(readFileSync(CANDIDATE_INPUT)),
      reconciliation42: sha256(readFileSync(RECONCILIATION_42)),
      reconciliation178: sha256(readFileSync(RECONCILIATION_178)),
    }),
    verification: Object.freeze({
      orphanUnits: 0 as const,
      unlicensedPassages: 0 as const,
      duplicatePassagesWithinFamily: 0 as const,
      duplicateMeaningsWithinFamily: 0 as const,
      unsupportedCausalSynthesis: 0 as const,
      multiStepMechanisms: 0 as const,
    }),
  }
  const candidate: DnaV31MultipassageCandidate = Object.freeze({
    ...payload,
    packageSha256: hashDnaV31Value(payload),
  })
  const summary = validateDnaV31Candidate(candidate)

  const workpack = (id: string, familyId: string, reason: string): JsonRecord => ({
    schemaVersion: "dna-v3.1-terminal-workpack@1",
    id,
    authorityClass: "external_science_candidate",
    familyId,
    screenedCandidatePackageSha256: candidate.inputHashes.externalScienceCandidate,
    terminalDecision: "not_available",
    reason,
    requiredIndependentSources: 2,
    selectedPassages: 0,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
  })
  const stressWorkpack = workpack(
    "v31.workpack.stress-reactivity-recovery",
    "stress_reactivity_recovery",
    families[3].reason,
  )
  const sensoryWorkpack = workpack(
    "v31.workpack.sensory-modulation",
    "sensory_modulation",
    families[4].reason,
  )
  const manifest = {
    schemaVersion: "dna-v3.1-multipassage-candidate-manifest@1",
    candidateSchemaVersion: candidate.schemaVersion,
    candidatePackageSha256: candidate.packageSha256,
    inputHashes: candidate.inputHashes,
    counts: summary,
    familyDecisions: Object.fromEntries(candidate.families.map((family) => [family.id, {
      status: family.status,
      units: family.unitIds.length,
      independentSources: family.independentSourceCount,
    }])),
    verification: candidate.verification,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    liveRuntime: "dna-chat-engine@2",
    boundary: "Bu paket yayın dışı V3.1 denemesidir; DNA kitabı ve nihai yayın kapıları tamamlanmadan API veya kullanıcı arayüzüne bağlanamaz.",
  }
  return { candidate, manifest, stressWorkpack, sensoryWorkpack }
}

function writeArtifacts(): JsonRecord {
  const built = buildCandidate()
  atomicWrite(CANDIDATE_OUTPUT, stableDnaV31Json(built.candidate), 0o600)
  atomicWrite(STRESS_WORKPACK_OUTPUT, stableDnaV31Json(built.stressWorkpack), 0o600)
  atomicWrite(SENSORY_WORKPACK_OUTPUT, stableDnaV31Json(built.sensoryWorkpack), 0o600)
  atomicWrite(REPO_MANIFEST, stableDnaV31Json(built.manifest), 0o644)
  return built.manifest
}

function verifyArtifacts(): JsonRecord {
  const built = buildCandidate()
  const observedCandidate = readSecureJson(CANDIDATE_OUTPUT) as DnaV31MultipassageCandidate
  validateDnaV31Candidate(observedCandidate)
  assert.equal(stableDnaV31Json(observedCandidate), stableDnaV31Json(built.candidate))
  assert.equal(readFileSync(STRESS_WORKPACK_OUTPUT, "utf8"), stableDnaV31Json(built.stressWorkpack))
  assert.equal(readFileSync(SENSORY_WORKPACK_OUTPUT, "utf8"), stableDnaV31Json(built.sensoryWorkpack))
  assert.equal(readFileSync(REPO_MANIFEST, "utf8"), stableDnaV31Json(built.manifest))
  assert.equal((statSync(CANDIDATE_OUTPUT).mode & 0o777), 0o600)
  assert.equal((statSync(STRESS_WORKPACK_OUTPUT).mode & 0o777), 0o600)
  assert.equal((statSync(SENSORY_WORKPACK_OUTPUT).mode & 0o777), 0o600)

  for (const family of observedCandidate.families) {
    for (const profile of ["short", "standard", "deep"] as const) {
      const hashes = new Set<string>()
      for (let index = 0; index < 20; index += 1) {
        hashes.add(hashDnaV31Value(renderDnaV31Candidate(observedCandidate, family.id, profile)))
      }
      assert.equal(hashes.size, 1, `${family.id}:${profile} is not deterministic`)
    }
  }
  const short = renderDnaV31Candidate(observedCandidate, "neuroanatomy", "short")
  const standard = renderDnaV31Candidate(observedCandidate, "neuroanatomy", "standard")
  const deep = renderDnaV31Candidate(observedCandidate, "neuroanatomy", "deep")
  assert.equal(short.units.length, 1)
  assert.equal(standard.units.length, 2)
  assert.equal(deep.units.length, 3)

  const liveFiles = [
    "src/app/api/app/dna-chat/route.ts",
    "src/lib/dna/chat/apiResolver.ts",
    "src/lib/dna/chat/engine.ts",
    "src/lib/dna/chat/runtimeSelection.ts",
  ]
  for (const path of liveFiles) {
    assert(!readFileSync(resolve(process.cwd(), path), "utf8").includes("v31MultiPassageCandidate"))
  }
  const liveV3Manifest = JSON.parse(readFileSync(
    resolve(process.cwd(), "src/lib/dna/chat/catalog/generated/v3/manifest.json"),
    "utf8",
  ))
  assert.equal(liveV3Manifest.runtimeEligible, false)
  assert.equal(liveV3Manifest.counts.included.claims, 0)
  return built.manifest
}

const command = process.argv[2] || "verify"
if (command === "build") {
  console.log(JSON.stringify({ ok: true, command, manifest: writeArtifacts() }, null, 2))
} else if (command === "verify" || command === "test") {
  console.log(JSON.stringify({ ok: true, command, manifest: verifyArtifacts() }, null, 2))
} else {
  throw new Error("Usage: run-dna-v31-multipassage-candidate.ts build|verify|test")
}
