#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_ARTIFACT_DIR,
  DEFAULT_CANDIDATE_PACKAGE,
  buildSourceDerivedAdapter,
  sha256,
  stableStringify,
} from "./dna-turkish-retrieval-v3-source-derived-core.mjs";
import {
  createDevelopmentBanks,
  runDevelopmentEvaluation,
} from "./dna-turkish-retrieval-v3-source-derived-development.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_MANIFEST = path.join(REPO_ROOT, "docs/dna-intelligence/program/evidence/turkish-retrieval-v3-source-derived-current.json");

function parseArgs(argv) {
  const args = { command: "all", candidatePackage: DEFAULT_CANDIDATE_PACKAGE, artifactDir: DEFAULT_ARTIFACT_DIR, repoManifest: REPO_MANIFEST };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("--")) args.command = rest.shift();
  while (rest.length) {
    const flag = rest.shift();
    const value = rest.shift();
    if (flag === "--candidate-package") args.candidatePackage = value;
    else if (flag === "--artifact-dir") args.artifactDir = value;
    else if (flag === "--repo-manifest") args.repoManifest = value;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!["write", "freeze", "verify", "all"].includes(args.command)) throw new Error(`Unknown command: ${args.command}`);
  return args;
}

function secureWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(temporaryPath, 0o600);
  fs.renameSync(temporaryPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function normalWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporaryPath, filePath);
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readCandidatePackage(filePath) {
  if (/(?:locked|official|result|overlap)/iu.test(filePath)) throw new Error("Forbidden evaluation/result-like input path.");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeArtifacts(args) {
  const candidatePackage = readCandidatePackage(args.candidatePackage);
  const adapter = buildSourceDerivedAdapter(candidatePackage);
  const banks = createDevelopmentBanks(adapter);
  const workingPath = path.join(args.artifactDir, "source-derived-adapter.json");
  const bankPath = path.join(args.artifactDir, "development-bank-family-split.json");
  secureWriteJson(workingPath, adapter);
  secureWriteJson(bankPath, {
    schemaVersion: "dna.turkish-retrieval-v3-source-derived.family-split.v1",
    authorityClass: "development_only_source_derived",
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    tuning: {
      semanticFamilies: [...new Set(banks.tuning.map((testCase) => testCase.semanticFamily))].sort(),
      caseHashes: banks.tuning.map((testCase) => sha256(stableStringify(testCase))).sort(),
    },
    holdout: {
      semanticFamilies: [...new Set(banks.holdout.map((testCase) => testCase.semanticFamily))].sort(),
      caseHashes: banks.holdout.map((testCase) => sha256(stableStringify(testCase))).sort(),
    },
    metamorphic: {
      semanticFamilies: [...new Set(banks.metamorphic.map((testCase) => testCase.semanticFamily))].sort(),
      caseHashes: banks.metamorphic.map((testCase) => sha256(stableStringify(testCase))).sort(),
    },
  });
  return { adapter, workingPath, bankPath };
}

function freezeArtifacts(args, adapterOverride) {
  const workingPath = path.join(args.artifactDir, "source-derived-adapter.json");
  const adapter = adapterOverride ?? JSON.parse(fs.readFileSync(workingPath, "utf8"));
  const expectedHash = sha256(stableStringify(Object.fromEntries(Object.entries(adapter).filter(([key]) => key !== "adapterSha256"))));
  if (adapter.adapterSha256 !== expectedHash) throw new Error("Working adapter content hash mismatch.");
  const frozenPath = path.join(args.artifactDir, "frozen-source-derived-adapter.json");
  secureWriteJson(frozenPath, adapter);
  if (!fs.readFileSync(workingPath).equals(fs.readFileSync(frozenPath))) throw new Error("Freeze did not preserve exact adapter bytes.");
  return { adapter, frozenPath };
}

function evaluateAndManifest(args, adapter) {
  const report = runDevelopmentEvaluation(adapter, { determinismRuns: 20 });
  const reportPath = path.join(args.artifactDir, "development-report.json");
  secureWriteJson(reportPath, report);
  const artifactFiles = [
    "source-derived-adapter.json",
    "frozen-source-derived-adapter.json",
    "development-bank-family-split.json",
    "development-report.json",
  ];
  const artifactHashes = Object.fromEntries(artifactFiles.map((name) => [name, fileSha256(path.join(args.artifactDir, name))]));
  const freezeManifest = {
    schemaVersion: "dna.turkish-retrieval-v3-source-derived.freeze-manifest.v1",
    authorityClass: "development_only_source_derived",
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    forbiddenInputsRead: false,
    sourcePackageSha256: adapter.sourcePackageSha256,
    adapterSha256: adapter.adapterSha256,
    artifactHashes,
    aggregate: {
      topics: report.counts.topics,
      answerUnits: report.counts.answerUnits,
      tuningCases: report.counts.tuningCases,
      holdoutCases: report.counts.holdoutCases,
      metamorphicCases: report.counts.metamorphicCases,
      determinismRuns: report.counts.determinismRuns,
      p95LatencyMs: report.performance.p95LatencyMs,
      gates: report.gates,
      allGatesPassed: report.allGatesPassed,
    },
  };
  const freezeManifestPath = path.join(args.artifactDir, "freeze-manifest.json");
  secureWriteJson(freezeManifestPath, freezeManifest);
  const repoManifest = {
    schemaVersion: "dna.turkish-retrieval-v3-source-derived.repo-aggregate.v1",
    authorityClass: "development_only_source_derived",
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    ownerAuthority: false,
    sourcePackageSha256: adapter.sourcePackageSha256,
    adapterSha256: adapter.adapterSha256,
    freezeManifestSha256: fileSha256(freezeManifestPath),
    aggregate: freezeManifest.aggregate,
  };
  normalWriteJson(args.repoManifest, repoManifest);
  return { report, reportPath, freezeManifestPath, repoManifest };
}

function verifyArtifacts(args) {
  const names = [
    "source-derived-adapter.json",
    "frozen-source-derived-adapter.json",
    "development-bank-family-split.json",
    "development-report.json",
    "freeze-manifest.json",
  ];
  for (const name of names) {
    const filePath = path.join(args.artifactDir, name);
    const mode = fs.statSync(filePath).mode & 0o777;
    if (mode !== 0o600) throw new Error(`${name} must have mode 0600, found ${mode.toString(8)}.`);
  }
  const workingPath = path.join(args.artifactDir, names[0]);
  const frozenPath = path.join(args.artifactDir, names[1]);
  if (!fs.readFileSync(workingPath).equals(fs.readFileSync(frozenPath))) throw new Error("Working and frozen adapters differ.");
  const adapter = JSON.parse(fs.readFileSync(frozenPath, "utf8"));
  const expectedAdapterHash = sha256(stableStringify(Object.fromEntries(Object.entries(adapter).filter(([key]) => key !== "adapterSha256"))));
  if (adapter.adapterSha256 !== expectedAdapterHash) throw new Error("Frozen adapter integrity mismatch.");
  const manifest = JSON.parse(fs.readFileSync(path.join(args.artifactDir, "freeze-manifest.json"), "utf8"));
  for (const [name, expectedHash] of Object.entries(manifest.artifactHashes)) {
    if (fileSha256(path.join(args.artifactDir, name)) !== expectedHash) throw new Error(`Artifact hash mismatch: ${name}`);
  }
  const report = JSON.parse(fs.readFileSync(path.join(args.artifactDir, "development-report.json"), "utf8"));
  if (!report.allGatesPassed) throw new Error(`Development gates failed: ${JSON.stringify(report.gates)}`);
  const repoManifest = JSON.parse(fs.readFileSync(args.repoManifest, "utf8"));
  if (repoManifest.freezeManifestSha256 !== fileSha256(path.join(args.artifactDir, "freeze-manifest.json"))) throw new Error("Repo aggregate does not bind the freeze manifest.");
  for (const field of ["runtimeEligible", "releaseEligible", "activationAllowed", "ownerAuthority"]) {
    if (adapter[field] !== false || manifest[field] !== false || repoManifest[field] !== false) throw new Error(`Authority flag ${field} must remain false.`);
  }
  return {
    verified: true,
    adapterSha256: adapter.adapterSha256,
    freezeManifestSha256: fileSha256(path.join(args.artifactDir, "freeze-manifest.json")),
    repoManifestSha256: fileSha256(args.repoManifest),
    artifactHashes: manifest.artifactHashes,
    aggregate: manifest.aggregate,
  };
}

const args = parseArgs(process.argv.slice(2));
let adapter;
if (args.command === "write" || args.command === "all") adapter = writeArtifacts(args).adapter;
if (args.command === "freeze" || args.command === "all") adapter = freezeArtifacts(args, adapter).adapter;
if (args.command === "all") evaluateAndManifest(args, adapter);
const output = args.command === "verify" || args.command === "all" ? verifyArtifacts(args) : { command: args.command, ok: true, adapterSha256: adapter?.adapterSha256 };
console.log(JSON.stringify(output, null, 2));
