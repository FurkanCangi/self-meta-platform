import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const RUN_ID = process.env.DNA_FINAL_PREPROD_RUN_ID?.trim() || "run-20260814T172656Z"
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUTPUT_DIR = process.env.DNA_FINAL_PREPROD_RUN_DIR?.trim()
  ? path.join(process.env.DNA_FINAL_PREPROD_RUN_DIR.trim(), "certification")
  : path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/final-preproduction-acceleration", RUN_ID, "certification")
const COMPILED = path.join(ROOT, ".tmp/dna-final-legacy")
const NODE_PATH = path.join(ROOT, "node_modules/next/dist/compiled")

function sha(value) {
  return createHash("sha256").update(value).digest("hex")
}

function runNode(name, relativeFile, categories) {
  const started = Date.now()
  const result = spawnSync(process.execPath, ["--conditions=react-server", path.join(COMPILED, relativeFile)], {
    cwd: ROOT,
    env: { ...process.env, NODE_PATH, RESEARCH_SSD_ROOT: SSD_ROOT },
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  })
  const stdout = result.stdout || ""
  const stderr = result.stderr || ""
  return Object.freeze({
    name,
    categories: Object.freeze(categories),
    pass: result.status === 0 && !result.error,
    exitCode: result.status,
    signal: result.signal,
    durationMs: Date.now() - started,
    stdoutSha256: sha(stdout),
    stderrSha256: sha(stderr),
    stdoutTail: stdout.trim().split(/\r?\n/u).slice(-12).join("\n"),
    stderrTail: stderr.trim().split(/\r?\n/u).slice(-12).join("\n"),
    error: result.error?.message ?? null,
  })
}

const suites = [
  ["S13 core", "scripts/run-dna-s13-tests.js", ["S13", "compare", "science/source"]],
  ["Realizer contract", "scripts/run-dna-s13-realizer-contract-tests.js", ["realizer contract", "deterministic"]],
  ["Canary contracts", "scripts/run-dna-s13-canary-tests.js", ["structural routing", "multi-target"]],
  ["Limited rollout", "scripts/run-dna-s13-limited-rollout-tests.js", ["limited rollout", "privacy"]],
  ["Limited response contract", "scripts/run-dna-s13-limited-response-contract-tests.js", ["response contract", "privacy"]],
  ["Structural holdout", "scripts/run-dna-s13-structural-holdout.js", ["structural routing", "correction polarity", "multi-target"]],
  ["Pragmatic holdout", "scripts/run-dna-s13-pragmatic-generalization-holdout.js", ["deepen", "simplify", "compare"]],
  ["Semantic operation holdout", "scripts/run-dna-s13-semantic-operation-holdout.js", ["correction polarity", "deepen", "simplify"]],
  ["Privacy validation", "scripts/run-dna-phase45-privacy-validation-tests.js", ["privacy"]],
  ["Source governance", "scripts/run-dna-chat-source-governance-tests.js", ["science/source"]],
  ["Source integrity", "scripts/run-dna-source-integrity-archive-tests.js", ["science/source"]],
  ["Owner book runtime", "scripts/run-dna-owner-book-runtime-tests.js", ["science/source", "routing"]],
  ["Conversation flexibility", "scripts/run-dna-chat-conversation-flex-tests.js", ["context", "multi-target"]],
  ["Chat security", "scripts/run-dna-chat-security-tests.js", ["privacy", "security"]],
  ["Chat API contract", "scripts/run-dna-chat-api-contract-tests.js", ["response contract"]],
  ["Adaptive realization", "scripts/run-dna-adaptive-realization-tests.js", ["realizer contract", "deterministic"]],
  ["Knowledge V2 shadow", "scripts/run-dna-knowledge-core-v2-shadow-tests.js", ["science/source", "response contract"]],
  ["External science QA", "scripts/run-dna-external-science-qa-hardening-tests.js", ["science/source"]],
]

const results = suites.map(([name, file, categories]) => runNode(name, file, categories))
const requiredCategories = [
  "structural routing", "S13", "correction polarity", "compare", "deepen", "simplify",
  "multi-target", "privacy", "science/source", "realizer contract", "limited rollout", "response contract",
]
const categoryCoverage = Object.fromEntries(requiredCategories.map((category) => [
  category,
  results.filter((row) => row.categories.includes(category)).map((row) => ({ name: row.name, pass: row.pass })),
]))
const pass = results.every((row) => row.pass)
  && Object.values(categoryCoverage).every((rows) => rows.length > 0 && rows.some((row) => row.pass))
const summary = Object.freeze({
  schemaVersion: "dna-chat-final-preproduction-legacy-regression@1",
  runId: RUN_ID,
  generatedAt: new Date().toISOString(),
  providerCalls: 0,
  providerCostUsd: 0,
  suites: results.length,
  passed: results.filter((row) => row.pass).length,
  failed: results.filter((row) => !row.pass).length,
  requiredCategoryCoverage: categoryCoverage,
  results,
  pass,
})

mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
const output = path.join(OUTPUT_DIR, "legacy-regression-summary.json")
writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
chmodSync(output, 0o600)
console.log(JSON.stringify({ output, pass, suites: results.length, passed: summary.passed, failed: summary.failed }))
if (!pass) process.exitCode = 1
