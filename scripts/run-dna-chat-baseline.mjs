import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const BASELINE_DIR = path.join(ROOT, "docs/dna-intelligence/baselines/dna-chat-v2")
const MANIFEST_PATH = path.join(BASELINE_DIR, "baseline-manifest.json")
const EVIDENCE_PATH = path.join(BASELINE_DIR, "gate-evidence.json")
const SHA_SUMS_PATH = path.join(BASELINE_DIR, "SHA256SUMS")
const TMP_RESULTS_PATH = path.join(ROOT, ".tmp/dna-chat-baseline/latest-gate-results.json")
const ROOT_HARNESS_OUT = path.join(ROOT, ".tmp/dna-chat-baseline-harness")
const ROLLBACK_GIT_SHA = "5ed87217280a40e4566a04289d4c98b1f3883494"
const ROLLBACK_TAG = "dna-chat-v2-baseline-20260719"
const WORKTREE = path.join(os.tmpdir(), `selfmeta-dna-chat-v2-${process.pid}`)
const WRITE = process.argv.includes("--write")

const gateCommands = [
  { id: "raw-review", command: "node", args: [".tmp/dna-chat-baseline/scripts/run-dna-chat-raw-review-tests.js"] },
  { id: "catalog", command: "node", args: [".tmp/dna-chat-baseline/scripts/run-dna-chat-catalog-tests.js"] },
  { id: "reasoning", command: "node", args: [".tmp/dna-chat-baseline/scripts/run-dna-chat-reasoning-tests.js"] },
  { id: "security", command: "node", args: [".tmp/dna-chat-baseline/scripts/run-dna-chat-security-tests.js"] },
  { id: "api", command: "node", args: [".tmp/dna-chat-baseline/scripts/run-dna-chat-api-contract-tests.js"] },
  { id: "quality", command: "node", args: [".tmp/dna-chat-baseline/scripts/run-dna-chat-quality-tests.js"] },
  { id: "determinism", command: "node", args: [".tmp/dna-chat-baseline/scripts/run-dna-chat-determinism-tests.js"] },
  { id: "lint", command: "npm", args: ["--silent", "run", "lint"] },
  { id: "build", command: "npm", args: ["--silent", "run", "build"] },
]

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function run(command, args, options = {}) {
  const startedAt = performance.now()
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  })
  const durationMs = Math.round(performance.now() - startedAt)
  if (options.echo !== false) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }
  if (result.error) throw result.error
  assert.equal(result.status, 0, `${command} ${args.join(" ")} başarısız oldu`)
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", durationMs }
}

function parseJsonOutput(stdout, gateId) {
  const trimmed = stdout.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    if (gateId === "build" || gateId === "lint") return null
    throw new Error(`${gateId}: başarı çıktısı tek JSON nesnesi değil`)
  }
}

function writeChecksums() {
  const files = ["README.md", "baseline-manifest.json", "gate-evidence.json", "regression-fixtures.json"]
  const lines = files
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((file) => `${sha256(fs.readFileSync(path.join(BASELINE_DIR, file)))}  ${file}`)
  fs.writeFileSync(SHA_SUMS_PATH, `${lines.join("\n")}\n`, "utf8")
}

function rootHarnessPath() {
  return path.join(ROOT_HARNESS_OUT, "scripts/capture-dna-chat-baseline.js")
}

function compileRootHarness() {
  run("npx", [
    "tsc",
    "-p",
    "tsconfig.report-runner.json",
    "--outDir",
    path.relative(ROOT, ROOT_HARNESS_OUT),
  ])
}

function prepareRollbackWorktree() {
  assert.ok(!fs.existsSync(WORKTREE), `Geçici worktree zaten var: ${WORKTREE}`)
  run("git", ["worktree", "add", "--detach", WORKTREE, ROLLBACK_GIT_SHA])
  const cleanStatus = run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: WORKTREE, echo: false },
  ).stdout
  assert.equal(cleanStatus, "", "Rollback source worktree harness eklenmeden önce temiz olmalı")
  const testedTreeSha = run(
    "git",
    ["rev-parse", "HEAD^{tree}"],
    { cwd: WORKTREE, echo: false },
  ).stdout.trim()

  const nodeModules = path.join(ROOT, "node_modules")
  assert.ok(fs.existsSync(nodeModules), "Ana çalışma ağacında node_modules bulunamadı")
  const nodeModulesTarget = path.join(WORKTREE, "node_modules")
  const cloneResult = spawnSync("cp", ["-cR", nodeModules, nodeModulesTarget], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
  if (cloneResult.status !== 0) {
    run("cp", ["-R", nodeModules, nodeModulesTarget], { echo: false })
  }
  const npmLs = run("npm", ["ls", "--all", "--json"], { cwd: WORKTREE, echo: false })
  const npmLsResult = JSON.parse(npmLs.stdout)
  assert.equal(npmLsResult.problems, undefined, "Rollback bağımlılık ağacında npm ls problemi bulundu")
  const packageLock = run(
    "git",
    ["show", `${ROLLBACK_GIT_SHA}:package-lock.json`],
    { echo: false },
  ).stdout
  const installedPackageLockPath = path.join(nodeModulesTarget, ".package-lock.json")
  assert.ok(fs.existsSync(installedPackageLockPath), "Kurulu bağımlılık ağacında hidden package lock yok")
  const dependencyValidation = {
    status: "passed",
    packageLockSha256: sha256(packageLock),
    installedPackageLockSha256: sha256(fs.readFileSync(installedPackageLockPath)),
    npmLsAllStdoutSha256: sha256(npmLs.stdout),
  }

  fs.mkdirSync(path.join(WORKTREE, "scripts"), { recursive: true })
  fs.copyFileSync(
    path.join(ROOT, "scripts/capture-dna-chat-baseline.ts"),
    path.join(WORKTREE, "scripts/capture-dna-chat-baseline.ts"),
  )
  fs.copyFileSync(
    path.join(ROOT, "scripts/run-dna-chat-baseline.mjs"),
    path.join(WORKTREE, "scripts/run-dna-chat-baseline.mjs"),
  )
  fs.mkdirSync(path.dirname(path.join(WORKTREE, "docs/dna-intelligence/baselines/dna-chat-v2")), { recursive: true })
  fs.cpSync(BASELINE_DIR, path.join(WORKTREE, "docs/dna-intelligence/baselines/dna-chat-v2"), {
    recursive: true,
  })

  const temporaryTsconfig = {
    extends: "./tsconfig.report-runner.json",
    include: [
      "scripts/capture-dna-chat-baseline.ts",
      "scripts/run-dna-chat-quality-tests.ts",
      "scripts/run-dna-chat-security-tests.ts",
      "scripts/run-dna-chat-determinism-tests.ts",
      "scripts/run-dna-chat-reasoning-tests.ts",
      "scripts/run-dna-chat-catalog-tests.ts",
      "scripts/run-dna-chat-raw-review-tests.ts",
      "scripts/run-dna-chat-api-contract-tests.ts",
      "scripts/report-quality-cases.ts",
      "src/lib/dna/**/*.ts",
      "src/lib/assessment/**/*.ts",
    ],
  }
  fs.writeFileSync(
    path.join(WORKTREE, "tsconfig.dna-chat-baseline.json"),
    `${JSON.stringify(temporaryTsconfig, null, 2)}\n`,
    "utf8",
  )
  return { testedTreeSha, dependencyValidation }
}

function cleanupRollbackWorktree() {
  if (!fs.existsSync(WORKTREE)) return
  const result = spawnSync("git", ["worktree", "remove", "--force", WORKTREE], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.status !== 0) {
    process.stderr.write(result.stderr || `Geçici worktree kaldırılamadı: ${WORKTREE}\n`)
  }
  spawnSync("git", ["worktree", "prune"], { cwd: ROOT, encoding: "utf8" })
}

function verifyRemoteRollbackTag() {
  const local = run(
    "git",
    ["rev-parse", "--verify", `${ROLLBACK_TAG}^{commit}`],
    { echo: false },
  ).stdout.trim()
  assert.equal(local, ROLLBACK_GIT_SHA, "Yerel rollback tag'i V2 commit'ine çözülmüyor")
  const remoteOutput = run(
    "git",
    [
      "ls-remote",
      "--tags",
      "origin",
      `refs/tags/${ROLLBACK_TAG}`,
      `refs/tags/${ROLLBACK_TAG}^{}`,
    ],
    { echo: false },
  ).stdout
  const peeledLine = remoteOutput
    .split("\n")
    .find((line) => line.endsWith(`refs/tags/${ROLLBACK_TAG}^{}`))
  assert.ok(peeledLine, "Uzak annotated rollback tag'inin peeled commit kaydı bulunamadı")
  const peeledGitSha = peeledLine.split(/\s+/)[0]
  assert.equal(peeledGitSha, ROLLBACK_GIT_SHA, "Uzak rollback tag'i V2 commit'ine çözülmüyor")
  return {
    remote: "origin",
    tag: ROLLBACK_TAG,
    ref: `refs/tags/${ROLLBACK_TAG}`,
    peeledGitSha,
    verified: true,
  }
}

fs.mkdirSync(path.dirname(TMP_RESULTS_PATH), { recursive: true })
compileRootHarness()

if (WRITE) {
  run("node", [rootHarnessPath(), "--write"])
} else {
  run("node", [rootHarnessPath()])
}

let testedSourceTreeSha = ""
let dependencyValidation = null
let results = []
try {
  const prepared = prepareRollbackWorktree()
  testedSourceTreeSha = prepared.testedTreeSha
  dependencyValidation = prepared.dependencyValidation
  run("npx", [
    "tsc",
    "-p",
    "tsconfig.dna-chat-baseline.json",
    "--outDir",
    ".tmp/dna-chat-baseline",
  ], { cwd: WORKTREE })
  run("node", [
    ".tmp/dna-chat-baseline/scripts/capture-dna-chat-baseline.js",
    "--compare-current-only",
  ], { cwd: WORKTREE })

  results = []
  for (const gate of gateCommands) {
    const output = run(gate.command, gate.args, { cwd: WORKTREE })
    results.push({
      id: gate.id,
      command: [gate.command, ...gate.args].join(" "),
      status: "passed",
      durationMs: output.durationMs,
      stdoutSha256: sha256(output.stdout),
      stderrSha256: sha256(output.stderr),
      result: parseJsonOutput(output.stdout, gate.id),
    })
  }
} finally {
  cleanupRollbackWorktree()
}

const manifestSha256 = sha256(fs.readFileSync(MANIFEST_PATH))
const remoteRollback = WRITE
  ? verifyRemoteRollbackTag()
  : JSON.parse(fs.readFileSync(EVIDENCE_PATH, "utf8")).remoteRollback
const evidence = {
  schemaVersion: "dna-intelligence-baseline-gate-evidence@1",
  baselineVersion: "dna-intelligence-v2-baseline@1",
  capturedOn: "2026-07-19",
  rollbackGitSha: ROLLBACK_GIT_SHA,
  verificationGitSha: ROLLBACK_GIT_SHA,
  testedSourceGitSha: ROLLBACK_GIT_SHA,
  testedSourceTreeSha,
  sourceWorktreeCleanBeforeHarness: true,
  harnessFilesAddedAfterCleanCheck: [
    "scripts/capture-dna-chat-baseline.ts",
    "scripts/run-dna-chat-baseline.mjs",
    "docs/dna-intelligence/baselines/dna-chat-v2/**",
    "tsconfig.dna-chat-baseline.json",
    "node_modules (copy-on-write clone or physical copy)",
  ],
  remoteRollback,
  dependencyValidation,
  manifestSha256,
  verificationTooling: [
    "scripts/capture-dna-chat-baseline.ts",
    "scripts/run-dna-chat-baseline.mjs",
  ].map((file) => ({
    file,
    sha256: sha256(fs.readFileSync(path.join(ROOT, file))),
  })),
  environment: {
    node: process.version,
    npm: run("npm", ["--version"], { echo: false }).stdout.trim(),
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
  },
  gates: results,
  scope: {
    localOfflineGates: true,
    sourceExecution: "clean_detached_git_worktree_at_rollback_commit",
    onlineSourceVerification: "deferred_to_source_integrity_phase",
    liveCrossAccountVerification: "deferred_to_verified_production_release",
  },
}

fs.writeFileSync(TMP_RESULTS_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")

if (WRITE) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true })
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")
  writeChecksums()
  run("node", [rootHarnessPath()])
}

console.log(JSON.stringify({
  ok: true,
  baselineVersion: "dna-intelligence-v2-baseline@1",
  rollbackGitSha: ROLLBACK_GIT_SHA,
  testedSourceTreeSha,
  sourceExecution: "clean_detached_git_worktree_at_rollback_commit",
  writeMode: WRITE,
  gates: results.map(({ id, status, durationMs }) => ({ id, status, durationMs })),
  latestEvidence: path.relative(ROOT, TMP_RESULTS_PATH),
  ...(WRITE ? { frozenEvidence: path.relative(ROOT, EVIDENCE_PATH) } : {}),
}, null, 2))
