#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs"
import { join, relative, resolve, sep } from "node:path"

import {
  assertAdapterConfig,
  assertEvaluatorModuleRelativePath,
  assertFrozenAdapter,
  assertPureEvaluatorSource,
  createFrozenAdapter,
  sha256,
} from "./lib/dna-locked-retrieval-core.mjs"
import {
  resolveSecureRoot,
  secureAtomicWriteNew,
} from "./lib/dna-secure-artifact.mjs"

const DEFAULT_DEVELOPMENT_QA_MANIFEST =
  "docs/dna-intelligence/program/evidence/external-science-qa-current.json"
const DEFAULT_OUTPUT =
  "Datasets/DNA-Intelligence/evaluation/frozen-adapters/turkish-retrieval-v1/adapter.json"
const FORBIDDEN_TUNING_ROOTS = Object.freeze([
  "Datasets/DNA-Intelligence/evaluation",
])

function fail(code) {
  throw new Error(code)
}

function parseArgs(argv) {
  const command = argv[0]
  const options = {}
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--") || index + 1 >= argv.length) fail("dna_adapter_cli_invalid")
    options[token.slice(2)] = argv[index + 1]
    index += 1
  }
  return { command, options }
}

function assertSsdRoot() {
  const configured = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
  return resolveSecureRoot(configured, { requiredPrefix: "/Volumes/ResearchSSD" })
}

function resolveRelative(root, relativePath, code) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/")
    || relativePath.includes("..")) fail(code)
  const target = resolve(root, relativePath)
  if (target === root || !target.startsWith(`${root}${sep}`)) fail(code)
  return target
}

function assertNoSymlinkFile(root, path, options = {}) {
  const rel = relative(root, path)
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) fail(options.code || "dna_adapter_path_escape")
  let current = root
  const parts = rel.split(sep).filter(Boolean)
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index])
    if (!existsSync(current)) fail(options.code || "dna_adapter_path_missing")
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) fail(options.symlinkCode || "dna_adapter_symlink_forbidden")
    if (index < parts.length - 1 && !stat.isDirectory()) fail(options.code || "dna_adapter_parent_invalid")
    if (index === parts.length - 1 && !stat.isFile()) fail(options.code || "dna_adapter_file_invalid")
  }
  const real = realpathSync(path)
  if (real !== root && !real.startsWith(`${root}${sep}`)) fail(options.code || "dna_adapter_realpath_escape")
  if (options.mode !== undefined && (lstatSync(path).mode & 0o777) !== options.mode) {
    fail(options.modeCode || "dna_adapter_mode_mismatch")
  }
  return real
}

function readJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    fail(code)
  }
}

function loadEvaluator(repositoryRoot, relativePath) {
  assertEvaluatorModuleRelativePath(relativePath)
  const path = resolveRelative(repositoryRoot, relativePath, "dna_adapter_evaluator_path_invalid")
  assertNoSymlinkFile(repositoryRoot, path, {
    code: "dna_adapter_evaluator_missing",
    symlinkCode: "dna_adapter_evaluator_symlink_forbidden",
  })
  const bytes = readFileSync(path)
  assertPureEvaluatorSource(bytes.toString("utf8"))
  return { path, bytes, sha256: sha256(bytes) }
}

function developmentAuthorities(repositoryRoot, ssdRoot, manifestRelativePath) {
  const manifestPath = resolveRelative(
    repositoryRoot,
    manifestRelativePath,
    "dna_adapter_development_manifest_path_invalid",
  )
  assertNoSymlinkFile(repositoryRoot, manifestPath, {
    code: "dna_adapter_development_manifest_missing",
  })
  const manifest = readJson(manifestPath, "dna_adapter_development_manifest_invalid")
  const candidatePath = resolveRelative(
    ssdRoot,
    manifest.candidatePackage?.relativePath,
    "dna_adapter_candidate_path_invalid",
  )
  const qaPath = resolveRelative(
    ssdRoot,
    manifest.rawOutput?.researchSsdRelativePath,
    "dna_adapter_development_qa_path_invalid",
  )
  assertNoSymlinkFile(ssdRoot, candidatePath, { code: "dna_adapter_candidate_missing" })
  assertNoSymlinkFile(ssdRoot, qaPath, { code: "dna_adapter_development_qa_missing" })
  const candidateBytes = readFileSync(candidatePath)
  const qaBytes = readFileSync(qaPath)
  const candidate = readJson(candidatePath, "dna_adapter_candidate_invalid")
  if (candidate.packageSha256 !== manifest.candidatePackage?.packageSha256) {
    fail("dna_adapter_candidate_authority_mismatch")
  }
  if (sha256(qaBytes) !== manifest.rawOutput?.rawSha256) {
    fail("dna_adapter_development_qa_hash_mismatch")
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.rawOutput?.evaluationSha256 || "")) {
    fail("dna_adapter_development_evaluation_hash_invalid")
  }
  return {
    candidatePackageSha256: candidate.packageSha256,
    developmentQaEvaluationSha256: manifest.rawOutput.evaluationSha256,
    tuningInputs: [
      {
        id: "candidate-package",
        kind: "candidate_package",
        location: "research_ssd",
        relativePath: manifest.candidatePackage.relativePath,
        sha256: sha256(candidateBytes),
      },
      {
        id: "development-qa",
        kind: "development_qa",
        location: "research_ssd",
        relativePath: manifest.rawOutput.researchSsdRelativePath,
        sha256: sha256(qaBytes),
      },
    ],
  }
}

function freeze(options) {
  const repositoryRoot = process.cwd()
  const ssdRoot = assertSsdRoot()
  if (!options.config || !options.evaluator || !options["frozen-at"]) {
    fail("dna_adapter_freeze_inputs_required")
  }
  const configPath = resolveRelative(repositoryRoot, options.config, "dna_adapter_config_path_invalid")
  assertNoSymlinkFile(repositoryRoot, configPath, { code: "dna_adapter_config_missing" })
  const configBytes = readFileSync(configPath)
  const config = readJson(configPath, "dna_adapter_config_invalid_json")
  assertAdapterConfig(config)
  const evaluator = loadEvaluator(repositoryRoot, options.evaluator)
  const authority = developmentAuthorities(
    repositoryRoot,
    ssdRoot,
    options["development-qa-manifest"] || DEFAULT_DEVELOPMENT_QA_MANIFEST,
  )
  const adapter = createFrozenAdapter({
    adapterId: options["adapter-id"] || "external-science-turkish-retrieval-v1",
    frozenAt: options["frozen-at"],
    candidatePackageSha256: authority.candidatePackageSha256,
    developmentQaEvaluationSha256: authority.developmentQaEvaluationSha256,
    evaluatorModule: options.evaluator,
    codeSha256: evaluator.sha256,
    config,
    tuningInputAllowlist: [
      ...authority.tuningInputs,
      {
        id: "adapter-config",
        kind: "adapter_config",
        location: "repo",
        relativePath: options.config,
        sha256: sha256(configBytes),
      },
    ],
    forbiddenInputPaths: FORBIDDEN_TUNING_ROOTS,
  })
  assertFrozenAdapter(adapter, { expectedCodeSha256: evaluator.sha256 })
  const outputRelative = options.output || DEFAULT_OUTPUT
  const outputPath = resolveRelative(ssdRoot, outputRelative, "dna_adapter_output_path_invalid")
  const serialized = `${JSON.stringify(adapter, null, 2)}\n`
  secureAtomicWriteNew(ssdRoot, outputPath, serialized)
  return { ok: true, adapterSha256: adapter.adapterSha256, path: outputPath }
}

function verify(options) {
  const repositoryRoot = process.cwd()
  const ssdRoot = assertSsdRoot()
  const adapterRelative = options.adapter || options.output || DEFAULT_OUTPUT
  const adapterPath = resolveRelative(ssdRoot, adapterRelative, "dna_adapter_path_invalid")
  assertNoSymlinkFile(ssdRoot, adapterPath, {
    code: "dna_adapter_missing",
    symlinkCode: "dna_adapter_symlink_forbidden",
    mode: 0o600,
    modeCode: "dna_adapter_mode_mismatch",
  })
  const adapter = readJson(adapterPath, "dna_adapter_invalid_json")
  const evaluator = loadEvaluator(repositoryRoot, adapter.evaluatorModule)
  assertFrozenAdapter(adapter, { expectedCodeSha256: evaluator.sha256 })
  return { ok: true, adapterSha256: adapter.adapterSha256, path: adapterPath }
}

try {
  const { command, options } = parseArgs(process.argv.slice(2))
  const result = command === "freeze" ? freeze(options)
    : command === "verify" ? verify(options)
      : fail("dna_adapter_command_invalid")
  process.stdout.write(`${JSON.stringify(result)}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "dna_adapter_unknown_error"}\n`)
  process.exitCode = 1
}
