import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import path from "node:path"

const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUT = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux")
const DOCS = path.resolve("docs/dna-intelligence/architecture-tournament/final-ux")
const CHECKPOINT = path.join(OUT, "checkpoint.json")
const FREEZE = path.join(OUT, "s13-freeze.json")
const CHALLENGE = path.join(OUT, "final-ux-challenge.json")
const RESULTS = path.join(OUT, "automatic-results.json")
const PRO_PACKAGE = path.join(OUT, "chatgpt-pro-evaluation-package.json")
const PRO_EVALUATION = path.join(OUT, "chatgpt-pro-evaluation.json")
const HUMAN_PACKAGE = path.join(OUT, "human-evaluation-package.json")
const HUMAN_MAPPING = path.join(OUT, "sealed-human-mapping.json")
const FREEZE_AMENDMENT = path.join(OUT, "s13-freeze-amendment.json")
const VERSION = "dna-s13-final-run@1"
const BASELINE_COMMIT = "7bd6422326b5177a25cc456cc4c9b10ba83a3e4d"
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value) => createHash("sha256").update(value).digest("hex")
const fileSha = (file) => sha(readFileSync(file))
const now = () => new Date().toISOString()

function writePrivate(file, value) {
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}

function command(bin, args, options = {}) {
  execFileSync(bin, args, { cwd: process.cwd(), stdio: "inherit", env: process.env, ...options })
}

function git(...args) {
  return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim()
}

function checkpoint() {
  return existsSync(CHECKPOINT)
    ? JSON.parse(readFileSync(CHECKPOINT, "utf8"))
    : { schemaVersion: VERSION, status: "new", completedStages: [], createdAt: now(), heartbeatAt: now(), errors: [] }
}

function saveCheckpoint(value) {
  const next = { ...value, heartbeatAt: now() }
  next.sha256 = sha(stable({ ...next, sha256: undefined }))
  writePrivate(CHECKPOINT, next)
  return next
}

function completeStage(state, stage, extra = {}) {
  return saveCheckpoint({ ...state, ...extra, completedStages: [...new Set([...state.completedStages, stage])] })
}

function hashFiles(files) {
  return Object.fromEntries(files.map((file) => [file, { sha256: fileSha(file), bytes: statSync(file).size }]))
}

function ensurePreflight() {
  if (!existsSync(SSD) || !statSync(SSD).isDirectory()) throw new Error("research_ssd_unavailable")
  mkdirSync(OUT, { recursive: true, mode: 0o700 })
  mkdirSync(DOCS, { recursive: true })
  if (git("rev-parse", "HEAD") !== BASELINE_COMMIT && !git("merge-base", "--is-ancestor", BASELINE_COMMIT, "HEAD")) {
    throw new Error("s13_baseline_not_in_history")
  }
}

function createFreeze() {
  const s13Files = [
    "src/lib/dna/chat/s13/contracts.ts",
    "src/lib/dna/chat/s13/contextToken.ts",
    "src/lib/dna/chat/s13/planner.ts",
    "src/lib/dna/chat/s13/validator.ts",
    "src/lib/dna/chat/s13/pipeline.ts",
    "src/lib/dna/chat/s13/server.ts",
    "scripts/dna_s13_final_core.py",
    "scripts/run-dna-s13-final-online.mjs",
  ]
  const baselineArtifacts = [
    "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2/phase-3-4/architecture-base-results.json",
    "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2/phase-3-4/architecture-luna-results.json",
    "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2/sealed/phase-3-4-locked-first-results.json",
    "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1/owner-knowledge-units.jsonl",
    "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1/question-surfaces.jsonl",
  ].filter(existsSync)
  const freeze = {
    schemaVersion: "dna-s13-freeze@1",
    createdAt: now(),
    baselineCommit: BASELINE_COMMIT,
    workingHeadAtFreeze: git("rev-parse", "HEAD"),
    frozenArchitectures: ["legacy", "S1", "S2", "S5"],
    s13Variants: ["S13-A", "S13-B"],
    frozenThresholds: { s1Confidence: 0.617638, runnerUpMargin: 0.12 },
    model: "gpt-5.6-luna",
    store: false,
    reasoning: "none",
    maximumCallsPerMessage: 3,
    sourceFiles: hashFiles(s13Files),
    baselineArtifacts: hashFiles(baselineArtifacts),
    environmentPresence: {
      openAiKey: Boolean(process.env.OPENAI_API_KEY?.trim() || (() => { try { return /OPENAI_API_KEY\s*=/.test(readFileSync(".env.local", "utf8")) } catch { return false } })()),
      engineVersion: process.env.DNA_ENGINE_VERSION || "legacy_default",
      s13MasterEnabled: process.env.DNA_S13_ENABLED === "1",
    },
    productionAffected: false,
    tuningAfterChallengeForbidden: true,
  }
  freeze.sha256 = sha(stable(freeze))
  writePrivate(FREEZE, freeze)
  return freeze
}

function runLocalGates() {
  const gates = [
    ["npm", ["run", "chat:s13:test"]],
    ["npm", ["run", "chat:luna"]],
    ["npm", ["run", "chat:security"]],
    ["npm", ["run", "chat:api"]],
    ["npm", ["run", "chat:determinism"]],
    ["npm", ["run", "chat:phase45-privacy"]],
    ["npm", ["run", "report:privacy"]],
    ["npm", ["run", "chat:forbidden-imports"]],
    ["npm", ["run", "lint"]],
    ["npm", ["run", "build"]],
  ]
  for (const [bin, args] of gates) command(bin, args)
}

function buildCore() {
  const python = existsSync(path.join(SSD, "Tools/SelfMetaAI/dna-embedding/.venv/bin/python"))
    ? path.join(SSD, "Tools/SelfMetaAI/dna-embedding/.venv/bin/python")
    : "python3"
  if (existsSync(CHALLENGE)) command(python, ["scripts/dna_s13_final_core.py", "verify"])
  else command(python, ["scripts/dna_s13_final_core.py", "build"])
}

function ensureFreezeAmendment() {
  const freeze = JSON.parse(readFileSync(FREEZE, "utf8"))
  const tracked = Object.entries(freeze.sourceFiles)
  const changed = tracked.filter(([file, record]) => existsSync(file) && fileSha(file) !== record.sha256)
  if (!changed.length) return null
  if (changed.length !== 1 || changed[0][0] !== "scripts/dna_s13_final_core.py") {
    throw new Error(`frozen_s13_source_changed:${changed.map(([file]) => file).join(",")}`)
  }
  const source = readFileSync("scripts/dna_s13_final_core.py", "utf8")
  if (!source.includes("SEEDS_PATH = OUT / \"challenge-seeds.json\"") || /^(?:SOCIAL|UNSUPPORTED|SAFETY)\s*=\s*\[/mu.test(source)) {
    throw new Error("freeze_amendment_seed_relocation_guard_failed")
  }
  const amendment = {
    schemaVersion: "dna-s13-freeze-amendment@1",
    reason: "raw_challenge_seed_relocation_no_behavior_change",
    changedFile: changed[0][0],
    previousSha256: changed[0][1].sha256,
    currentSha256: fileSha(changed[0][0]),
    challengeSeedsSha256: fileSha(path.join(OUT, "challenge-seeds.json")),
    sealedChallengeSha256: fileSha(CHALLENGE),
    sealedRetrievalSha256: fileSha(path.join(OUT, "frozen-retrieval.json")),
    automaticResultsSha256: existsSync(RESULTS) ? fileSha(RESULTS) : null,
    createdAt: now(),
    tuningPerformed: false,
    productionAffected: false,
  }
  amendment.sha256 = sha(stable(amendment))
  writePrivate(FREEZE_AMENDMENT, amendment)
  return amendment
}

function validateProEvaluation() {
  const pack = JSON.parse(readFileSync(PRO_PACKAGE, "utf8"))
  const evaluation = JSON.parse(readFileSync(PRO_EVALUATION, "utf8"))
  if (evaluation.schemaVersion !== "dna-s13-pro-evaluation@1" || evaluation.packageSha256 !== pack.packageSha256) throw new Error("pro_evaluation_package_hash_mismatch")
  if (!Array.isArray(evaluation.ratings) || evaluation.ratings.length !== 100) throw new Error("pro_evaluation_incomplete")
  const ids = new Set(pack.cases.map((row) => row.id))
  for (const rating of evaluation.ratings) {
    if (!ids.has(rating.id) || !["A", "B", "C", "D"].includes(rating.preferredResponse)) throw new Error(`pro_evaluation_row_invalid:${rating.id}`)
    for (const label of ["A", "B", "C", "D"]) {
      const score = rating.scores?.[label]
      if (!score || !Number.isFinite(score.total) || score.total < 0 || score.total > 20) throw new Error(`pro_evaluation_score_invalid:${rating.id}:${label}`)
    }
  }
  return { pack, evaluation }
}

function buildHumanPackage(pro) {
  const architectureMapping = JSON.parse(readFileSync(path.join(OUT, "sealed-architecture-mapping.json"), "utf8"))
  const architectureByLabel = new Map(architectureMapping.labels.map((row) => [row.label, row.architecture]))
  const scores = new Map(["A", "B", "C", "D"].map((label) => [label, []]))
  for (const rating of pro.evaluation.ratings) for (const label of scores.keys()) scores.get(label).push(rating.scores[label].total)
  const automatic = JSON.parse(readFileSync(RESULTS, "utf8"))
  const ranked = [...scores].map(([label, values]) => ({ label, architecture: architectureByLabel.get(label), score: values.reduce((a, b) => a + b, 0) / values.length })).filter((row) => automatic.metrics[row.architecture]?.safetyPass && automatic.metrics[row.architecture]?.privacyLeak === 0).sort((a, b) => b.score - a.score || a.architecture.localeCompare(b.architecture)).slice(0, 2)
  if (ranked.length !== 2) throw new Error("human_finalists_unavailable")
  const categories = [...new Set(pro.pack.cases.map((row) => row.category))]
  const selected = []
  let cursor = 0
  while (selected.length < 40) {
    const category = categories[cursor % categories.length]
    const rows = pro.pack.cases.filter((row) => row.category === category && !selected.some((entry) => entry.id === row.id))
    if (rows.length) selected.push(rows[0])
    cursor += 1
    if (cursor > 1000) throw new Error("human_stratification_failed")
  }
  const pair = ranked.map((row) => row.architecture).sort((left, right) => sha(`${pro.pack.packageSha256}:${left}`).localeCompare(sha(`${pro.pack.packageSha256}:${right}`)))
  const labelForArchitecture = new Map([[pair[0], "X"], [pair[1], "Y"]])
  const sourceLabel = new Map(architectureMapping.labels.map((row) => [row.architecture, row.label]))
  const cases = selected.map((row) => ({
    id: row.id, category: row.category, question: row.question, context: row.context,
    responses: Object.fromEntries(pair.map((architecture) => [labelForArchitecture.get(architecture), row.responses[sourceLabel.get(architecture)]])),
  }))
  const packageValue = { schemaVersion: "dna-s13-human-evaluation-package@1", proPackageSha256: pro.pack.packageSha256, count: 40, evaluatorCountRequired: 3, dimensions: ["naturalTurkish", "clarity", "completeness", "questionRelevance", "overallPreference"], labels: ["X", "Y"], cases }
  packageValue.packageSha256 = sha(stable(packageValue))
  writePrivate(HUMAN_PACKAGE, packageValue)
  writePrivate(HUMAN_MAPPING, { schemaVersion: "dna-s13-sealed-human-mapping@1", packageSha256: packageValue.packageSha256, mapping: Object.fromEntries(pair.map((architecture) => [labelForArchitecture.get(architecture), architecture])) })
  for (let index = 1; index <= 3; index += 1) writePrivate(path.join(OUT, `human-evaluation-${index}-template.json`), { schemaVersion: "dna-s13-human-evaluation@1", packageSha256: packageValue.packageSha256, evaluatorId: `evaluator-${index}`, ratings: cases.map((row) => ({ id: row.id, scores: { X: null, Y: null }, preferredResponse: null, note: "" })) })
  return packageValue
}

function finalizeHuman() {
  const pack = JSON.parse(readFileSync(HUMAN_PACKAGE, "utf8"))
  const files = [1, 2, 3].map((index) => path.join(OUT, `human-evaluation-${index}.json`))
  if (!files.every(existsSync)) return null
  const evaluations = files.map((file) => JSON.parse(readFileSync(file, "utf8")))
  for (const evaluation of evaluations) {
    if (evaluation.schemaVersion !== "dna-s13-human-evaluation@1" || evaluation.packageSha256 !== pack.packageSha256 || evaluation.ratings?.length !== 40) throw new Error("human_evaluation_invalid")
    for (const rating of evaluation.ratings) if (!["X", "Y"].includes(rating.preferredResponse)) throw new Error(`human_preference_invalid:${rating.id}`)
  }
  const mapping = JSON.parse(readFileSync(HUMAN_MAPPING, "utf8")).mapping
  const votes = CounterLike(evaluations.flatMap((row) => row.ratings.map((rating) => rating.preferredResponse)))
  const winningLabel = votes.X === votes.Y ? ["X", "Y"].sort((a, b) => mapping[a].localeCompare(mapping[b]))[0] : votes.X > votes.Y ? "X" : "Y"
  const winner = mapping[winningLabel]
  const automatic = JSON.parse(readFileSync(RESULTS, "utf8"))
  const decision = { schemaVersion: "dna-s13-final-decision@1", winner, humanVotes: votes, automaticMetrics: automatic.metrics[winner], productionActivationAllowed: false, nextGate: "internal_then_10_50_100_canary", createdAt: now() }
  decision.releaseAttestationSha256 = sha(stable({ freeze: fileSha(FREEZE), challenge: fileSha(CHALLENGE), results: fileSha(RESULTS), pro: fileSha(PRO_EVALUATION), humans: files.map(fileSha), winner }))
  writePrivate(path.join(OUT, "final-decision.json"), decision)
  const markdown = `# DNA Intelligence S13 Final Comparison\n\nProduction winner adayi: **${winner}**\n\nBu karar otomatik guvenlik kapilari, ChatGPT Pro kor degerlendirmesi ve uc bagimsiz insan degerlendirmesine baglidir. Public aktivasyon henuz yapilmamistir; siradaki kapi internal -> %10 -> %50 -> %100 canary akisidir.\n\nRelease attestation: \`${decision.releaseAttestationSha256}\`\n`
  writePrivate(path.join(OUT, "S13_FINAL_COMPARISON.md"), markdown)
  return decision
}

function CounterLike(values) {
  return values.reduce((result, value) => ({ ...result, [value]: (result[value] || 0) + 1 }), { X: 0, Y: 0 })
}

function syncRepoManifest(state) {
  const files = [FREEZE, FREEZE_AMENDMENT, CHALLENGE, RESULTS, PRO_PACKAGE, HUMAN_PACKAGE, path.join(OUT, "final-decision.json")].filter(existsSync)
  const manifest = {
    schemaVersion: "dna-s13-repository-summary@1",
    status: state.status,
    checkpointSha256: fileSha(CHECKPOINT),
    artifacts: Object.fromEntries(files.map((file) => [path.basename(file), { sha256: fileSha(file), bytes: statSync(file).size }])),
    boundaries: { rawArtifactsOnResearchSsd: true, productionAffected: false, finalWinnerSelected: existsSync(path.join(OUT, "final-decision.json")) },
  }
  writeFileSync(path.join(DOCS, "manifest.json"), stable(manifest))
}

async function main() {
  ensurePreflight()
  let state = checkpoint()
  try {
    if (!state.completedStages.includes("local_gates")) {
      runLocalGates()
      state = completeStage(state, "local_gates")
    }
    if (!state.completedStages.includes("freeze")) {
      const freeze = createFreeze()
      state = completeStage(state, "freeze", { freezeSha256: freeze.sha256 })
    } else if (!existsSync(FREEZE)) throw new Error("freeze_checkpoint_artifact_missing")
    if (!state.completedStages.includes("challenge_and_retrieval")) {
      buildCore()
      state = completeStage(state, "challenge_and_retrieval", { challengeSha256: JSON.parse(readFileSync(CHALLENGE, "utf8")).sha256 })
    } else buildCore()
    ensureFreezeAmendment()
    if (!state.completedStages.includes("automatic_challenge")) {
      command("node", ["scripts/run-dna-s13-final-online.mjs"])
      state = completeStage(state, "automatic_challenge", { proPackageSha256: JSON.parse(readFileSync(PRO_PACKAGE, "utf8")).packageSha256 })
    }
    if (!existsSync(PRO_EVALUATION)) {
      state = saveCheckpoint({ ...state, status: "awaiting_pro_evaluation" })
      syncRepoManifest(state)
      console.log(JSON.stringify({ ok: true, status: state.status, checkpoint: CHECKPOINT, evaluationPackage: PRO_PACKAGE, evaluationTemplate: path.join(OUT, "chatgpt-pro-evaluation-template.json") }))
      return
    }
    const pro = validateProEvaluation()
    if (!state.completedStages.includes("pro_evaluation")) state = completeStage(state, "pro_evaluation")
    if (!existsSync(HUMAN_PACKAGE)) buildHumanPackage(pro)
    if (!state.completedStages.includes("human_package")) state = completeStage(state, "human_package", { humanPackageSha256: JSON.parse(readFileSync(HUMAN_PACKAGE, "utf8")).packageSha256 })
    const finalDecision = finalizeHuman()
    if (!finalDecision) {
      state = saveCheckpoint({ ...state, status: "awaiting_human_evaluation" })
      syncRepoManifest(state)
      console.log(JSON.stringify({ ok: true, status: state.status, humanPackage: HUMAN_PACKAGE, templates: [1, 2, 3].map((index) => path.join(OUT, `human-evaluation-${index}-template.json`)) }))
      return
    }
    state = completeStage(state, "final_decision", { status: "ready_for_canary", winner: finalDecision.winner, releaseAttestationSha256: finalDecision.releaseAttestationSha256 })
    syncRepoManifest(state)
    console.log(JSON.stringify({ ok: true, status: state.status, winner: state.winner, releaseAttestationSha256: state.releaseAttestationSha256 }))
  } catch (error) {
    state = saveCheckpoint({ ...state, status: "failed", errors: [...(state.errors || []), { at: now(), message: error instanceof Error ? error.message : String(error) }] })
    syncRepoManifest(state)
    throw error
  }
}

void main()
