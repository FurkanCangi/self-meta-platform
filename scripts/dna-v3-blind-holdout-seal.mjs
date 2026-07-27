#!/usr/bin/env node
import { existsSync, realpathSync } from "node:fs";
import {
  assertRegularFile0600,
  assertRepoManifestPath,
  assertResearchSsdPath,
  atomicWrite,
  canonicalJson,
  parseArgs,
  readJson,
  sha256Bytes,
  sha256File,
  sha256Json,
} from "./lib/dna-v3-blind-holdout-io.mjs";

const DEFAULT_CANDIDATE = "/Volumes/ResearchSSD/Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json";
const EXPECTED_CATEGORIES = { ambiguous: 42, hard_neighbor: 42, natural_supported: 56, safe_theory_control: 28, unsupported: 28 };
const EXPECTED_INTENTS = { age_development: 28, comparison: 28, definition: 28, evidence: 28, measurement: 28, misconception: 28, relationship: 28 };
const EXPECTED_DISPOSITIONS = { abstain: 28, answer: 126, clarify: 42 };

function fail(message) {
  throw new Error(message);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateAuthored(payload, candidate, candidateFileSha256) {
  if (payload.schemaVersion !== "dna-turkish-retrieval-v3-blind-holdout@1") fail("authored schemaVersion geçersiz");
  const claimedHash = payload.payloadSha256;
  const unhashed = structuredClone(payload);
  delete unhashed.payloadSha256;
  if (claimedHash !== sha256Json(unhashed)) fail("authored payload hash doğrulaması başarısız");
  if (payload.sourceBinding?.candidatePackageSha256 !== candidate.packageSha256) fail("candidate package iç hash bağı uyuşmuyor");
  if (payload.sourceBinding?.candidatePackageFileSha256 !== candidateFileSha256) fail("candidate package dosya hash bağı uyuşmuyor");
  if (!Array.isArray(payload.items) || payload.items.length !== 196 || payload.counts?.total !== 196) fail("tam 196 öğe gerekir");
  if (!same(payload.counts.byCategory, EXPECTED_CATEGORIES)) fail("kategori dağılımı geçersiz");
  if (!same(payload.counts.byIntent, EXPECTED_INTENTS)) fail("niyet dağılımı geçersiz");
  if (!same(payload.counts.byDisposition, EXPECTED_DISPOSITIONS)) fail("disposition dağılımı geçersiz");
  if (Object.keys(payload.counts.perAuthorityTopic ?? {}).length !== 14 || Object.values(payload.counts.perAuthorityTopic).some((count) => count !== 14)) fail("her konu için 14 öğe gerekir");
  if ([payload.runtimeEligible, payload.releaseEligible, payload.activationAllowed, payload.independentHumanValidation, payload.officialRunPerformed, payload.scoringPerformed].some((value) => value !== false)) fail("tüm güvenlik/yayın/official bayrakları false olmalıdır");
  if (payload.items.some((item) => item.expectedDisposition === "answer" ? !item.expectedTopic || !item.authoritySourceId : item.expectedTopic !== null || item.authoritySourceId !== null)) fail("answerable/clarify/abstain topic bağları geçersiz");
  if (new Set(payload.items.map((item) => item.question.normalize("NFC").toLocaleLowerCase("tr-TR"))).size !== 196) fail("sorular benzersiz olmalıdır");
  if (new Set(payload.items.map((item) => item.semanticFamily)).size !== 196) fail("semantic family değerleri benzersiz olmalıdır");
  const requiredPerturbations = ["typo", "character_loss", "inflection", "synonym", "mixed_language", "negation", "followup", "two_topic"];
  const observed = new Set(payload.items.flatMap((item) => item.perturbations));
  if (requiredPerturbations.some((entry) => !observed.has(entry))) fail("zorunlu dil/bağlam çeşitliliği eksik");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const authoredPath = args.authored;
  const outputPath = args.output;
  const manifestPath = args.manifest;
  const candidatePath = args.candidate ?? DEFAULT_CANDIDATE;
  if (!authoredPath || !outputPath || !manifestPath) fail("--authored, --output ve --manifest zorunludur");
  for (const [path, label] of [[authoredPath, "authored payload"], [outputPath, "sealed payload"], [candidatePath, "candidate package"]]) assertResearchSsdPath(path, label);
  assertRepoManifestPath(manifestPath);
  if (existsSync(outputPath) || existsSync(manifestPath)) fail("sealed çıktı ve manifest sealing öncesinde mevcut olmamalıdır");
  assertRegularFile0600(authoredPath, "authored payload");
  assertRegularFile0600(candidatePath, "candidate package");
  if (realpathSync(candidatePath) !== realpathSync(DEFAULT_CANDIDATE)) fail("candidate package yolu sabit otorite girdisiyle aynı olmalıdır");
  const authored = readJson(authoredPath);
  const candidate = readJson(candidatePath);
  const candidateFileSha256 = sha256File(candidatePath);
  validateAuthored(authored, candidate, candidateFileSha256);

  const sealed = {
    schemaVersion: "dna-turkish-retrieval-v3-blind-sealed-holdout@1",
    sealPolicy: "atomic_hash_bound_ssd_0600_no_local_fallback@1",
    authoredPayloadSha256: authored.payloadSha256,
    candidatePackageSha256: candidate.packageSha256,
    candidatePackageFileSha256: candidateFileSha256,
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    independentHumanValidation: false,
    officialRunPerformed: false,
    scoringPerformed: false,
    payload: authored,
  };
  sealed.sealedPayloadSha256 = sha256Json(sealed);
  const sealedBytes = canonicalJson(sealed);
  const sealedFileSha256 = sha256Bytes(sealedBytes);
  atomicWrite(outputPath, sealedBytes, 0o600);

  const manifest = {
    schemaVersion: "dna-turkish-retrieval-v3-blind-holdout-manifest@1",
    evaluationId: authored.evaluationId,
    authorityClass: authored.authorityClass,
    storage: "researchssd_only_0600",
    rawPayloadInRepo: false,
    counts: authored.counts,
    hashes: {
      candidatePackageSha256: candidate.packageSha256,
      candidatePackageFileSha256: candidateFileSha256,
      authoredPayloadSha256: authored.payloadSha256,
      sealedPayloadSha256: sealed.sealedPayloadSha256,
      sealedFileSha256,
    },
    runtimeEligible: false,
    releaseEligible: false,
    activationAllowed: false,
    independentHumanValidation: false,
    officialRunPerformed: false,
    scoringPerformed: false,
  };
  manifest.manifestPayloadSha256 = sha256Json(manifest);
  const manifestBytes = canonicalJson(manifest);
  if (authored.items.some((item) => manifestBytes.includes(item.question))) fail("manifest ham soru sızıntısı içeriyor");
  atomicWrite(manifestPath, manifestBytes, 0o644);
  if (args.summary) {
    process.stdout.write(`${JSON.stringify({ outputPath, manifestPath, hashes: manifest.hashes, counts: manifest.counts })}\n`);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
