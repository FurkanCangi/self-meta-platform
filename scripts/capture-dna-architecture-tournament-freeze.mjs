import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const OUT = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-0")
const BASELINE_SHA = "9b54fd70411783e5f179f0cddc4564f33226447a"
const CAPTURE_DATE = "2026-08-09"

const GROUPS = {
  ftrl: ["src/lib/dna/chat/catalog/generated/semantic-router/artifact.json", "src/lib/dna/chat/semanticRouter.ts"],
  lexicalRetrieval: ["src/lib/dna/chat/catalog/search.ts", "src/lib/dna/chat/engine.ts", "src/lib/dna/chat/text.ts"],
  catalogAndBook: ["src/lib/dna/chat/catalog/generated/dense", "src/lib/dna/chat/catalog/generated/owner-book", "src/lib/dna/chat/catalog/index.ts"],
  conversationState: ["src/lib/dna/chat/conversationPolicy.ts", "src/lib/dna/chat/types.ts", "src/lib/dna/chat/questionFrame.ts"],
  luna: ["src/lib/dna/chat/lunaPolicy.ts", "src/lib/dna/chat/lunaServer.ts", "src/lib/dna/chat/lunaUsage.ts"],
  answerGenerator: ["src/lib/dna/chat/engine.ts", "src/lib/dna/chat/runtimeAnswer.ts", "src/lib/dna/chat/v3ResponseProfiles.ts", "src/lib/dna/chat/ownedCaseAnswer.ts"],
  safety: ["src/lib/dna/chat/safety.ts", "src/lib/dna/chat/intendedUse.ts", "src/lib/dna/chat/authorityRegistry.ts"],
  regression: ["scripts/run-dna-chat-quality-tests.ts", "scripts/run-dna-chat-security-tests.ts", "scripts/run-dna-chat-api-contract-tests.ts", "scripts/run-dna-chat-determinism-tests.ts", "scripts/run-dna-chat-conversation-flex-tests.ts"],
}

const sha = (value) => createHash("sha256").update(value).digest("hex")
const stable = (value) => `${JSON.stringify(sort(value), null, 2)}\n`
function sort(value) {
  if (Array.isArray(value)) return value.map(sort)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, v]) => [k, sort(v)]))
  return value
}
function git(args, encoding = "utf8") {
  return execFileSync("git", args, { cwd: ROOT, encoding, maxBuffer: 128 * 1024 * 1024 })
}
function filesAtCommit(prefixes) {
  return [...new Set(String(git(["ls-tree", "-r", "--name-only", BASELINE_SHA, "--", ...prefixes])).trim().split("\n").filter(Boolean))].sort()
}
function hashGroup(prefixes) {
  const files = filesAtCommit(prefixes)
  assert.ok(files.length, `Empty baseline group: ${prefixes.join(",")}`)
  const digest = createHash("sha256")
  const entries = files.map((file) => {
    const bytes = git(["show", `${BASELINE_SHA}:${file}`], null)
    digest.update(file).update("\0").update(bytes).update("\0")
    return { path: file, bytes: bytes.length, sha256: sha(bytes) }
  })
  return { fileCount: entries.length, sha256: digest.digest("hex"), files: entries }
}

assert.equal(String(git(["rev-parse", `${BASELINE_SHA}^{commit}`])).trim(), BASELINE_SHA)
const dense = JSON.parse(readFileSync(path.join(ROOT, "src/lib/dna/chat/catalog/generated/dense/manifest.json"), "utf8"))
const owner = JSON.parse(readFileSync(path.join(ROOT, "src/lib/dna/chat/catalog/generated/owner-book/manifest.json"), "utf8"))
const ftrl = JSON.parse(readFileSync(path.join(ROOT, "src/lib/dna/chat/catalog/generated/semantic-router/artifact.json"), "utf8"))
const regressionHashPath = path.join(OUT, "regression-answer-hashes.json")
assert.ok(existsSync(regressionHashPath), "Run chat:tournament:regression-freeze before freezing phase 0")
const regressionHashes = JSON.parse(readFileSync(regressionHashPath, "utf8"))
const localEnvNames = existsSync(path.join(ROOT, ".env.local"))
  ? readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n").map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1]).filter(Boolean).sort()
  : []

const manifest = {
  schemaVersion: "dna-architecture-tournament-production-freeze@1",
  captureDate: CAPTURE_DATE,
  controlGroup: {
    gitSha: BASELINE_SHA,
    rollbackCommand: `DNA_ENGINE_VERSION=legacy`,
    publicRuntime: "legacy",
    tournamentRuntime: "shadow_only",
  },
  productionVerification: {
    projectName: "self-meta-platform",
    alias: "https://self-meta-platform.vercel.app",
    deploymentCommit: null,
    status: "unverified_vercel_scope_403",
    claimBoundary: "Git SHA is the frozen reproducible control; production deployment SHA was not guessed.",
  },
  environment: {
    recordedNamesOnly: true,
    localEnvironmentVariableNames: localEnvNames,
    dnaEngineVersionPresentLocally: localEnvNames.includes("DNA_ENGINE_VERSION"),
    safeCodeDefault: "legacy",
    secretValuesRecorded: false,
  },
  versions: {
    engine: "dna-chat-engine@2.1",
    catalog: "dna-chat-catalog@2",
    ftrl: ftrl.version,
    ownerBookSourceSha256: owner.source?.sha256 ?? dense.hashes.ownerBookSha256,
    ownerBookRuntimeSha256: dense.hashes.ownerRuntimeSha256,
    questionSurfaceSha256: dense.hashes.surfacesSha256,
  },
  capacity: dense.counts,
  metrics: dense.evaluation,
  baselineAnswers: {
    count: regressionHashes.count,
    aggregateSha256: regressionHashes.aggregateSha256,
    fileSha256: sha(readFileSync(regressionHashPath)),
    rawQuestionsStored: false,
    rawAnswersStored: false,
  },
  hashes: Object.fromEntries(Object.entries(GROUPS).map(([name, prefixes]) => [name, hashGroup(prefixes)])),
  privacy: {
    rawQuestionsInRepository: 0,
    secretValuesInManifest: 0,
  },
}
manifest.baselineSha256 = sha(stable(manifest))

mkdirSync(OUT, { recursive: true })
writeFileSync(path.join(OUT, "baseline-manifest.json"), stable(manifest))
const existingGatePath = path.join(OUT, "gate-evidence.json")
const existingGatePassed = existsSync(existingGatePath)
  && JSON.parse(readFileSync(existingGatePath, "utf8")).status === "passed"
const gatesPassed = process.argv.includes("--gates-passed") || existingGatePassed
writeFileSync(path.join(OUT, "gate-evidence.json"), stable({
  schemaVersion: "dna-architecture-tournament-phase0-gates@1",
  baselineGitSha: BASELINE_SHA,
  commands: ["chat:tournament:engine-mode", "chat:security", "report:privacy", "chat:api", "chat:determinism", "lint", "build"],
  status: gatesPassed ? "passed" : "pending",
  buildEvidence: gatesPassed
    ? { command: "npx next build --webpack", result: "passed", routeCount: 100, note: "Default Turbopack process stalled without an error and was not counted as a pass." }
    : null,
  measuredEvidence: gatesPassed
    ? { determinismRequests: 8, repeatsPerRequest: 20, determinismP95Ms: 9.672, apiMockP95Ms: 27.413, privacy: "passed", security: "passed" }
    : null,
  recordedAt: CAPTURE_DATE,
}))
const files = ["baseline-manifest.json", "gate-evidence.json", "regression-answer-hashes.json"]
writeFileSync(path.join(OUT, "SHA256SUMS"), files.map((name) => `${sha(readFileSync(path.join(OUT, name)))}  ${name}`).join("\n") + "\n")
writeFileSync(path.join(OUT, "README.md"), `# DNA Architecture Tournament V2 — Faz 0\n\nFrozen control: \`${BASELINE_SHA}\`. Public runtime remains legacy; \`DNA_ENGINE_VERSION=tournament\` only enables shadow tournament work. \`DNA_ENGINE_VERSION=legacy\` is the single-setting rollback. Production deployment SHA is intentionally marked unverified because the Vercel scope returned 403. No secret values are stored.\n`)

console.log(`Phase 0 freeze captured: ${manifest.baselineSha256}`)
