#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUTHOR = join(REPO_ROOT, "scripts/dna-v3-blind-holdout-author.mjs");
const SEAL = join(REPO_ROOT, "scripts/dna-v3-blind-holdout-seal.mjs");
const CANDIDATE = "/Volumes/ResearchSSD/Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function run(script, args, expectedSuccess = true) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  if ((result.status === 0) !== expectedSuccess) {
    throw new Error(`beklenmeyen komut sonucu (${result.status}): ${script}\n${result.stderr}`);
  }
  return result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const specIndex = argv.indexOf("--spec");
  if (specIndex < 0 || !argv[specIndex + 1]) throw new Error("--spec zorunludur");
  return { spec: resolve(argv[specIndex + 1]) };
}

const tests = [];
function test(name, fn) {
  fn();
  tests.push(name);
}

function main() {
  const { spec } = parseArgs(process.argv.slice(2));
  const runId = randomUUID();
  const root = `/Volumes/ResearchSSD/Datasets/DNA-Intelligence/evaluations/turkish-retrieval-v3/security-tests/${runId}`;
  const manifest = join(REPO_ROOT, `docs/dna-intelligence/program/evidence/.dna-v3-blind-test-${runId}.json`);
  const deterministicManifests = [];
  mkdirSync(root, { recursive: true, mode: 0o700 });
  try {
    const copiedSpec = join(root, "author-spec.json");
    copyFileSync(spec, copiedSpec);
    chmodSync(copiedSpec, 0o600);

    const outputs = [];
    test("20x deterministic authoring", () => {
      for (let index = 0; index < 20; index += 1) {
        const output = join(root, `authored-${String(index).padStart(2, "0")}.json`);
        run(AUTHOR, ["--spec", copiedSpec, "--candidate", CANDIDATE, "--output", output]);
        outputs.push(output);
      }
      const hashes = new Set(outputs.map(sha256));
      assert(hashes.size === 1, "20 authoring çıktısı byte-identical değil");
    });

    test("0600 authored mode", () => {
      assert((statSync(outputs[0]).mode & 0o777) === 0o600, "authored çıktı modu 0600 değil");
    });

    test("atomic collision refusal", () => {
      const before = sha256(outputs[0]);
      run(AUTHOR, ["--spec", copiedSpec, "--candidate", CANDIDATE, "--output", outputs[0]], false);
      assert(sha256(outputs[0]) === before, "çakışma mevcut çıktıyı değiştirdi");
      assert(readdirSync(root).every((name) => !name.endsWith(".tmp")), "geçici dosya artığı kaldı");
    });

    test("local fallback refusal", () => {
      run(AUTHOR, ["--spec", copiedSpec, "--candidate", CANDIDATE, "--output", `/tmp/dna-v3-${runId}.json`], false);
      assert(!existsSync(`/tmp/dna-v3-${runId}.json`), "yerel fallback dosyası oluştu");
    });

    test("input symlink refusal", () => {
      const link = join(root, "spec-link.json");
      symlinkSync(copiedSpec, link);
      run(AUTHOR, ["--spec", link, "--candidate", CANDIDATE, "--output", join(root, "symlink-input-output.json")], false);
    });

    test("output symlink refusal", () => {
      const link = join(root, "output-link.json");
      symlinkSync(outputs[0], link);
      run(AUTHOR, ["--spec", copiedSpec, "--candidate", CANDIDATE, "--output", link], false);
      assert(lstatSync(link).isSymbolicLink(), "symlink beklenmedik biçimde değişti");
    });

    test("0600 input enforcement", () => {
      const loose = join(root, "loose-spec.json");
      copyFileSync(copiedSpec, loose);
      chmodSync(loose, 0o644);
      run(AUTHOR, ["--spec", loose, "--candidate", CANDIDATE, "--output", join(root, "loose-output.json")], false);
    });

    test("authority path pin", () => {
      const copiedCandidate = join(root, "candidate-copy.json");
      copyFileSync(CANDIDATE, copiedCandidate);
      chmodSync(copiedCandidate, 0o600);
      run(AUTHOR, ["--spec", copiedSpec, "--candidate", copiedCandidate, "--output", join(root, "candidate-copy-output.json")], false);
    });

    const sealedOutputs = [];
    test("20x deterministic sealing and modes", () => {
      for (let index = 0; index < 20; index += 1) {
        const sealedPath = join(root, `sealed-${String(index).padStart(2, "0")}.json`);
        const manifestPath = index === 0
          ? manifest
          : join(REPO_ROOT, `docs/dna-intelligence/program/evidence/.dna-v3-blind-test-${runId}-${String(index).padStart(2, "0")}.json`);
        run(SEAL, ["--authored", outputs[index], "--candidate", CANDIDATE, "--output", sealedPath, "--manifest", manifestPath]);
        sealedOutputs.push(sealedPath);
        deterministicManifests.push(manifestPath);
      }
      assert(new Set(sealedOutputs.map(sha256)).size === 1, "20 sealing çıktısı byte-identical değil");
      assert(new Set(deterministicManifests.map((path) => readFileSync(path, "utf8"))).size === 1, "20 manifest byte-identical değil");
      assert((statSync(sealedOutputs[0]).mode & 0o777) === 0o600, "sealed çıktı modu 0600 değil");
      assert((statSync(manifest).mode & 0o777) === 0o644, "repo manifest modu 0644 değil");
    });

    const sealed = sealedOutputs[0];

    test("manifest aggregate-only and hash binding", () => {
      const authored = JSON.parse(readFileSync(outputs[0], "utf8"));
      const manifestPayload = JSON.parse(readFileSync(manifest, "utf8"));
      const manifestText = readFileSync(manifest, "utf8");
      assert(!("items" in manifestPayload) && !manifestText.includes('"question"'), "manifest ham payload alanı içeriyor");
      assert(authored.items.every((item) => !manifestText.includes(item.question)), "manifest soru metni sızdırıyor");
      assert(manifestPayload.hashes.sealedFileSha256 === sha256(sealed), "sealed dosya hash bağı uyuşmuyor");
    });

    test("tamper refusal", () => {
      const tampered = join(root, "tampered-authored.json");
      const value = JSON.parse(readFileSync(outputs[0], "utf8"));
      value.items[0].question = `${value.items[0].question.slice(0, -1)} gerçekten?`;
      writeFileSync(tampered, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
      chmodSync(tampered, 0o600);
      run(SEAL, ["--authored", tampered, "--candidate", CANDIDATE, "--output", join(root, "tampered-sealed.json"), "--manifest", join(REPO_ROOT, `docs/dna-intelligence/program/evidence/.dna-v3-blind-tamper-${runId}.json`)], false);
    });

    test("manifest preflight atomic refusal", () => {
      const existingManifest = join(REPO_ROOT, `docs/dna-intelligence/program/evidence/.dna-v3-blind-existing-${runId}.json`);
      const wouldBeSealed = join(root, "manifest-collision-sealed.json");
      writeFileSync(existingManifest, "{}\n", { mode: 0o644 });
      run(SEAL, ["--authored", outputs[0], "--candidate", CANDIDATE, "--output", wouldBeSealed, "--manifest", existingManifest], false);
      assert(!existsSync(wouldBeSealed), "manifest çakışması kısmi sealed çıktı bıraktı");
      rmSync(existingManifest, { force: true });
    });

    test("sealed collision refusal", () => {
      const before = sha256(sealed);
      run(SEAL, ["--authored", outputs[0], "--candidate", CANDIDATE, "--output", sealed, "--manifest", join(REPO_ROOT, `docs/dna-intelligence/program/evidence/.dna-v3-blind-collision-${runId}.json`)], false);
      assert(sha256(sealed) === before, "sealed çakışma mevcut çıktıyı değiştirdi");
    });

    process.stdout.write(`${JSON.stringify({ ok: true, assertions: tests.length, tests })}\n`);
  } finally {
    rmSync(root, { recursive: true, force: true });
    for (const path of deterministicManifests) rmSync(path, { force: true });
    rmSync(manifest, { force: true });
    rmSync(join(REPO_ROOT, `docs/dna-intelligence/program/evidence/.dna-v3-blind-tamper-${runId}.json`), { force: true });
    rmSync(join(REPO_ROOT, `docs/dna-intelligence/program/evidence/.dna-v3-blind-collision-${runId}.json`), { force: true });
    rmSync(join(REPO_ROOT, `docs/dna-intelligence/program/evidence/.dna-v3-blind-existing-${runId}.json`), { force: true });
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
