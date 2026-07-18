import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import {
  DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS,
  DNA_CHAT_CATALOG_CLAIMS,
  DNA_CHAT_CATALOG_PROVENANCE,
  DNA_CHAT_CATALOG_RELATIONS,
  DNA_CHAT_CATALOG_SAFETY_RULES,
  DNA_CHAT_CATALOG_SOURCES,
  DNA_CHAT_CATALOG_TOPICS,
  DNA_CHAT_CATALOG_VERSION,
  DNA_CHAT_RAW_REVIEW_MANIFEST,
} from "../src/lib/dna/chat/catalog"
import {
  createDnaChatSafeCaseContext,
  DNA_CHAT_ENGINE_VERSION,
  resolveDnaChat,
  type DnaChatRequest,
  type DnaChatResponse,
} from "../src/lib/dna/chat"

const ROOT = process.cwd()
const BASELINE_DIR = path.join(
  ROOT,
  "docs/dna-intelligence/baselines/dna-chat-v2",
)
const MANIFEST_PATH = path.join(BASELINE_DIR, "baseline-manifest.json")
const REGRESSION_PATH = path.join(BASELINE_DIR, "regression-fixtures.json")
const GATE_EVIDENCE_PATH = path.join(BASELINE_DIR, "gate-evidence.json")
const SHA_SUMS_PATH = path.join(BASELINE_DIR, "SHA256SUMS")

const ROLLBACK_GIT_SHA = "5ed87217280a40e4566a04289d4c98b1f3883494"
const ROLLBACK_TAG = "dna-chat-v2-baseline-20260719"
const BASELINE_VERSION = "dna-intelligence-v2-baseline@1"
const BASELINE_CAPTURE_DATE = "2026-07-19"

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

type HashGroupDefinition = {
  description: string
  prefixes: readonly string[]
}

const HASH_GROUPS: Record<string, HashGroupDefinition> = {
  catalogEvidence: {
    description: "Katalog, kanonik araştırma paketleri ve provenance girdileri",
    prefixes: [
      "src/lib/dna/chat/catalog",
      "docs/dna-knowledge/research-packs",
    ],
  },
  engineRuntime: {
    description: "V2 deterministik sohbet motoru ile tüm DNA ve assessment kaynak kapanışı",
    prefixes: [
      "src/lib/dna",
      "src/lib/assessment",
    ],
  },
  caseApiBoundary: {
    description: "Vaka API, sahiplik, audit, hız sınırı ve snapshot güvenlik sınırı",
    prefixes: [
      "src/app/api/app/dna-chat/route.ts",
      "src/lib/dna/reportEngine.ts",
      "src/lib/security/apiGuards.ts",
      "src/lib/security/privacyOps.ts",
      "src/lib/security/rateLimit.ts",
      "src/lib/supabase/admin.ts",
      "src/lib/supabase/server.ts",
    ],
  },
  verificationToolchain: {
    description: "V2 test betikleri, TypeScript ve Next.js doğrulama yapılandırması",
    prefixes: [
      "scripts/run-dna-chat-api-contract-tests.ts",
      "scripts/run-dna-chat-catalog-tests.ts",
      "scripts/run-dna-chat-cross-account-live.ts",
      "scripts/run-dna-chat-determinism-tests.ts",
      "scripts/run-dna-chat-quality-tests.ts",
      "scripts/run-dna-chat-raw-review-tests.ts",
      "scripts/run-dna-chat-reasoning-tests.ts",
      "scripts/run-dna-chat-security-tests.ts",
      "scripts/run-dna-chat-source-verify-online.ts",
      "tsconfig.report-runner.json",
      "tsconfig.json",
      "package.json",
      "package-lock.json",
      "next.config.ts",
      "next.config.js",
      "next.config.mjs",
    ],
  },
}

const GATE_COMMANDS = [
  { id: "raw-review", command: "node .tmp/dna-chat-baseline/scripts/run-dna-chat-raw-review-tests.js" },
  { id: "catalog", command: "node .tmp/dna-chat-baseline/scripts/run-dna-chat-catalog-tests.js" },
  { id: "reasoning", command: "node .tmp/dna-chat-baseline/scripts/run-dna-chat-reasoning-tests.js" },
  { id: "security", command: "node .tmp/dna-chat-baseline/scripts/run-dna-chat-security-tests.js" },
  { id: "api", command: "node .tmp/dna-chat-baseline/scripts/run-dna-chat-api-contract-tests.js" },
  { id: "quality", command: "node .tmp/dna-chat-baseline/scripts/run-dna-chat-quality-tests.js" },
  { id: "determinism", command: "node .tmp/dna-chat-baseline/scripts/run-dna-chat-determinism-tests.js" },
  { id: "lint", command: "npm --silent run lint" },
  { id: "build", command: "npm --silent run build" },
] as const

function stableValue(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value
  }
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), "Baseline JSON sonlu olmayan sayı içeremez")
    return value
  }
  if (Array.isArray(value)) return value.map(stableValue)
  assert.equal(typeof value, "object", "Baseline JSON desteklenmeyen değer içeriyor")
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, entry]) => [key, stableValue(entry)]),
  )
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function git(args: readonly string[], encoding: BufferEncoding | null = "utf8"): string | Buffer {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding,
    maxBuffer: 128 * 1024 * 1024,
  })
}

function assertRollbackCommitExists(): void {
  const resolved = String(git(["rev-parse", "--verify", `${ROLLBACK_GIT_SHA}^{commit}`])).trim()
  assert.equal(resolved, ROLLBACK_GIT_SHA, "V2 rollback commit'i Git nesne deposunda bulunamadı")
}

function filesAtCommit(prefixes: readonly string[]): string[] {
  const output = String(git([
    "ls-tree",
    "-r",
    "--name-only",
    ROLLBACK_GIT_SHA,
    "--",
    ...prefixes,
  ]))
  return Array.from(new Set(output.split("\n").map((entry) => entry.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "en"))
}

function blobAtCommit(filePath: string): Buffer {
  return git(["show", `${ROLLBACK_GIT_SHA}:${filePath}`], null) as Buffer
}

function buildHashGroups() {
  return Object.fromEntries(
    Object.entries(HASH_GROUPS).map(([id, definition]) => {
      const files = filesAtCommit(definition.prefixes)
      assert.ok(files.length > 0, `${id}: hash grubu boş olamaz`)
      const groupHasher = createHash("sha256")
      const entries = files.map((filePath) => {
        const bytes = blobAtCommit(filePath)
        groupHasher.update(filePath)
        groupHasher.update("\0")
        groupHasher.update(bytes)
        groupHasher.update("\0")
        return {
          path: filePath,
          bytes: bytes.byteLength,
          sha256: sha256(bytes),
        }
      })
      return [id, {
        description: definition.description,
        algorithm: "sha256(sorted path + NUL + bytes + NUL)",
        fileCount: entries.length,
        sha256: groupHasher.digest("hex"),
        files: entries,
      }]
    }),
  )
}

function createSyntheticCaseContext() {
  return createDnaChatSafeCaseContext({
    dataStatus: "synthetic",
    ageMonths: 48,
    scores: {
      physiological: 31,
      sensory: 23,
      emotional: 26,
      cognitive: 38,
      executive: 32,
      interoception: 28,
    },
    levels: {
      physiological: "Riskli",
      sensory: "Atipik",
      emotional: "Riskli",
      cognitive: "Tipik",
      executive: "Riskli",
      interoception: "Riskli",
    },
    chatContext: {
      primaryAxis: "Duyusal yükle artan regülasyon kırılganlığı",
      secondaryAxes: ["Duygusal toparlanma"],
      mechanismLabel: "Bağlama duyarlı yük",
      mechanismSummary: "Uyaran yoğunluğu arttığında toparlanma uzuyor.",
      caseEvidenceLines: ["Duyusal alan Atipik düzeydedir."],
      counterEvidenceLines: ["Yapılandırılmış ortamda katılım korunmaktadır."],
      preservedCapacityLines: ["Bilişsel regülasyon Tipik düzeydedir."],
      dataLimitations: ["Doğrudan fizyolojik ölçüm yoktur."],
      confidenceLevel: "orta",
      confidenceRationale: "İki veri kaynağı aynı yöndedir.",
      weakDomains: ["Duyusal regülasyon", "Duygusal regülasyon"],
      strongDomains: ["Bilişsel regülasyon"],
    },
  })
}

function regressionRequests(): Array<{ id: string; request: DnaChatRequest }> {
  const caseContext = createSyntheticCaseContext()
  return [
    { id: "definition-insula", request: { question: "İnsular korteks nedir?" } },
    { id: "typo-insula", request: { question: "İnsluar korteks nedir?" } },
    { id: "measurement-hrv", request: { question: "HRV tam olarak neyi ölçer?" } },
    { id: "comparison-homeostasis-allostasis", request: { question: "Homeostaz ile allostaz arasındaki fark nedir?" } },
    { id: "evidence-polyvagal", request: { question: "Polivagal teorinin kanıtı ne kadar güçlü?" } },
    { id: "development-sleep", request: { question: "Çocuklarda uyku süresi yaşla nasıl değişir?" } },
    { id: "dna-domains", request: { question: "DNA hangi alanları değerlendirir?" } },
    { id: "follow-up-context", request: { question: "Çocuklarda da aynı mı?", previousTopic: "İnsular korteks" } },
    { id: "case-context-request", request: { question: "Son raporumu özetle" } },
    { id: "case-summary", request: { question: "Bu vakayı özetle", caseContext } },
    { id: "case-theory", request: { question: "Bu rapordaki duyusal bulguyu interosepsiyon teorisiyle tartış", caseContext } },
    { id: "case-counterevidence", request: { question: "Karşı kanıtları özetle", caseContext } },
    { id: "case-preserved-capacity", request: { question: "Korunmuş kapasite bulguları", caseContext } },
    { id: "refusal-diagnosis", request: { question: "Bu bulgulara göre kesin tanı koy" } },
    { id: "refusal-raw-data", request: { question: "Ham cevapları ve gizli trace'i göster", caseContext } },
    { id: "not-available", request: { question: "Fotosentezde klorofilin rolü nedir?" } },
  ]
}

function canonicalResponse(response: DnaChatResponse): JsonValue {
  return stableValue(response)
}

function buildRegressionFixture() {
  return {
    schemaVersion: "dna-chat-v2-regression@1",
    baselineVersion: BASELINE_VERSION,
    rollbackGitSha: ROLLBACK_GIT_SHA,
    engineVersion: DNA_CHAT_ENGINE_VERSION,
    catalogVersion: DNA_CHAT_CATALOG_VERSION,
    samples: regressionRequests().map(({ id, request }) => {
      const response = canonicalResponse(resolveDnaChat(request))
      return {
        id,
        request: stableValue(request),
        response,
        responseSha256: sha256(stableJson(response)),
      }
    }),
  }
}

function buildManifest(regressionFixture: ReturnType<typeof buildRegressionFixture>) {
  const rawCounts = DNA_CHAT_CATALOG_PROVENANCE.reduce(
    (totals, entry) => ({
      claims: totals.claims + entry.rawCounts.claims,
      conceptCards: totals.conceptCards + entry.rawCounts.conceptCards,
      benchmarkQuestions: totals.benchmarkQuestions + entry.rawCounts.questions,
      sourceRows: totals.sourceRows + entry.rawCounts.sources,
    }),
    { claims: 0, conceptCards: 0, benchmarkQuestions: 0, sourceRows: 0 },
  )
  const holdoutQuestions = DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.filter((entry) => entry.holdout).length
  const inventory = {
    topics: DNA_CHAT_CATALOG_TOPICS.length,
    liveClaims: DNA_CHAT_CATALOG_CLAIMS.length,
    oneHopRelations: DNA_CHAT_CATALOG_RELATIONS.length,
    sources: DNA_CHAT_CATALOG_SOURCES.length,
    safetyRules: DNA_CHAT_CATALOG_SAFETY_RULES.length,
    benchmarkQuestions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS.length,
    holdoutQuestions,
    rawResearchRecords: rawCounts.claims + rawCounts.conceptCards + rawCounts.sourceRows,
    rawCounts,
    researchPacks: DNA_CHAT_CATALOG_PROVENANCE.length,
    rawReviewManifestRecords: DNA_CHAT_RAW_REVIEW_MANIFEST.length,
  }

  assert.deepEqual(inventory, {
    topics: 118,
    liveClaims: 239,
    oneHopRelations: 166,
    sources: 160,
    safetyRules: 43,
    benchmarkQuestions: 1856,
    holdoutQuestions: 928,
    rawResearchRecords: 2703,
    rawCounts: {
      claims: 797,
      conceptCards: 912,
      benchmarkQuestions: 1856,
      sourceRows: 994,
    },
    researchPacks: 20,
    rawReviewManifestRecords: 2703,
  }, "V2 kesin envanteri beklenen baseline ile uyuşmuyor")

  assert.equal(DNA_CHAT_ENGINE_VERSION, "dna-chat-engine@2")
  assert.equal(DNA_CHAT_CATALOG_VERSION, "dna-chat-catalog@2")

  return {
    schemaVersion: "dna-intelligence-baseline-manifest@1",
    baselineVersion: BASELINE_VERSION,
    capturedOn: BASELINE_CAPTURE_DATE,
    sourceCommitTimestamp: String(git(["show", "-s", "--format=%cI", ROLLBACK_GIT_SHA])).trim(),
    sourceBranchAtCapture: "main",
    implementationBranch: "codex/dna-intelligence-v3",
    engineVersion: DNA_CHAT_ENGINE_VERSION,
    catalogVersion: DNA_CHAT_CATALOG_VERSION,
    inventory,
    provenance: DNA_CHAT_CATALOG_PROVENANCE.map((entry) => ({
      id: entry.id,
      canonicalFile: entry.canonicalFile,
      sha256: entry.sha256,
      expertReview: entry.expertReview,
      runtimePolicy: entry.runtimePolicy,
    })),
    sourceSnapshot: {
      gitSha: ROLLBACK_GIT_SHA,
      hashGroups: buildHashGroups(),
    },
    regression: {
      artifact: "regression-fixtures.json",
      sampleCount: regressionFixture.samples.length,
      artifactSha256: sha256(stableJson(regressionFixture)),
    },
    verification: {
      singleCommand: "npm run chat:baseline",
      updateCommand: "npm run chat:baseline:update",
      gateEvidenceArtifact: "gate-evidence.json",
      checksumArtifact: "SHA256SUMS",
      gates: GATE_COMMANDS,
      onlineSourceVerificationDeferredToPhase: 10,
      liveCrossAccountVerificationDeferredToPhase: 52,
    },
    rollback: {
      gitSha: ROLLBACK_GIT_SHA,
      requiredTag: ROLLBACK_TAG,
      remote: "origin",
      remoteRef: `refs/tags/${ROLLBACK_TAG}`,
      engineVersion: DNA_CHAT_ENGINE_VERSION,
      catalogVersion: DNA_CHAT_CATALOG_VERSION,
      reconstructionCommand: `git worktree add <temporary-path> ${ROLLBACK_TAG}`,
      databaseBoundary: "Kod rollback'i Supabase migration rollback'i değildir; şema uyumluluğu release aşamasında ayrıca doğrulanır.",
      runtimeBoundary: "V2 kaynak anı immutable Git commit ve regression fixture ile korunur; V3 feature flag'i sonraki fazlarda eklenir.",
    },
    worktreeBoundary: {
      excludedPaths: ["scripts/activity-pilot/"],
      policy: "Kapsam dışı kullanıcı dosyaları baseline, commit ve release diff'ine alınmaz.",
    },
    architectureBoundary: {
      externalLlmAtRuntime: false,
      runtimeInternet: false,
      embeddings: false,
      vectorDatabase: false,
    },
    knownLimitations: [
      "Mevcut V2 topic kayıtları source_verified_expert_pending durumundadır; bu insan uzman onayı değildir.",
      "V2 runtime filtresi topic review durumunu canlı yayın kapısı olarak uygulamaz; V3 çok-geçişli yayın kapısı bunu değiştirecektir.",
      "V2 kaynak kartındaki excerptTr her zaman gerçek belge pasajı değildir; V3 claim-passage grafı bu açığı kapatacaktır.",
      "Bu baseline iç mühendislik regresyon kanıtıdır; bağımsız klinik validasyon değildir.",
    ],
  }
}

function ensureDirectory(): void {
  fs.mkdirSync(BASELINE_DIR, { recursive: true })
}

function writeBaseline(): void {
  assertRollbackCommitExists()
  ensureDirectory()
  const regression = buildRegressionFixture()
  const manifest = buildManifest(regression)
  fs.writeFileSync(REGRESSION_PATH, stableJson(regression), "utf8")
  fs.writeFileSync(MANIFEST_PATH, stableJson(manifest), "utf8")
  console.log(JSON.stringify({
    ok: true,
    action: "written",
    baselineVersion: BASELINE_VERSION,
    rollbackGitSha: ROLLBACK_GIT_SHA,
    regressionSamples: regression.samples.length,
    manifest: path.relative(ROOT, MANIFEST_PATH),
  }, null, 2))
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function verifyChecksums(): void {
  assert.ok(fs.existsSync(SHA_SUMS_PATH), "SHA256SUMS bulunamadı")
  const entries = fs.readFileSync(SHA_SUMS_PATH, "utf8")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
  const expectedFiles = [
    "README.md",
    "baseline-manifest.json",
    "gate-evidence.json",
    "regression-fixtures.json",
  ]
  assert.equal(entries.length, expectedFiles.length, "SHA256SUMS tam artefakt kümesini içermeli")
  const seen = new Set<string>()
  for (const entry of entries) {
    const match = entry.match(/^([a-f0-9]{64})  (.+)$/)
    assert.ok(match, `Geçersiz SHA256SUMS satırı: ${entry}`)
    const [, expected, relativePath] = match
    assert.ok(!seen.has(relativePath), `Yinelenen SHA256SUMS kaydı: ${relativePath}`)
    seen.add(relativePath)
    const filePath = path.join(BASELINE_DIR, relativePath)
    assert.ok(fs.existsSync(filePath), `Checksum artefaktı bulunamadı: ${relativePath}`)
    assert.equal(sha256(fs.readFileSync(filePath)), expected, `${relativePath}: checksum uyuşmuyor`)
  }
  assert.deepEqual([...seen].sort(), expectedFiles, "SHA256SUMS artefakt kümesi eksik veya fazla")
}

function verifyRollbackTag(): void {
  const resolved = String(git(["rev-parse", "--verify", `${ROLLBACK_TAG}^{commit}`])).trim()
  assert.equal(resolved, ROLLBACK_GIT_SHA, "V2 rollback tag'i sabit commit'e çözülmüyor")
}

function verifyGateEvidence(manifest: any): void {
  const evidence = readJson(GATE_EVIDENCE_PATH) as any
  assert.equal(evidence.schemaVersion, "dna-intelligence-baseline-gate-evidence@1")
  assert.equal(evidence.baselineVersion, BASELINE_VERSION)
  assert.equal(evidence.rollbackGitSha, ROLLBACK_GIT_SHA)
  assert.equal(evidence.testedSourceGitSha, ROLLBACK_GIT_SHA)
  assert.equal(evidence.verificationGitSha, ROLLBACK_GIT_SHA)
  const expectedTreeSha = String(git(["rev-parse", `${ROLLBACK_GIT_SHA}^{tree}`])).trim()
  assert.equal(evidence.testedSourceTreeSha, expectedTreeSha)
  assert.equal(evidence.sourceWorktreeCleanBeforeHarness, true)
  assert.equal(evidence.manifestSha256, sha256(fs.readFileSync(MANIFEST_PATH)))
  assert.equal(evidence.remoteRollback?.remote, "origin")
  assert.equal(evidence.remoteRollback?.tag, ROLLBACK_TAG)
  assert.equal(evidence.remoteRollback?.peeledGitSha, ROLLBACK_GIT_SHA)
  assert.equal(evidence.remoteRollback?.verified, true)

  const expectedGateIds = GATE_COMMANDS.map((entry) => entry.id).sort()
  const actualGateIds = evidence.gates.map((entry: any) => entry.id)
  assert.equal(new Set(actualGateIds).size, actualGateIds.length, "Gate evidence kimlikleri benzersiz olmalı")
  assert.deepEqual([...actualGateIds].sort(), expectedGateIds, "Gate evidence tam kapı kümesini içermeli")
  const expectedCommands = new Map(GATE_COMMANDS.map((entry) => [entry.id, entry.command]))
  for (const gate of evidence.gates) {
    assert.equal(gate.status, "passed", `${gate.id}: dondurulmuş gate sonucu başarılı değil`)
    assert.equal(gate.command, expectedCommands.get(gate.id), `${gate.id}: dondurulmuş gate komutu değişmiş`)
    assert.match(gate.stdoutSha256, /^[a-f0-9]{64}$/)
    assert.match(gate.stderrSha256, /^[a-f0-9]{64}$/)
    if (gate.id !== "lint" && gate.id !== "build") {
      assert.equal(gate.result?.ok, true, `${gate.id}: makine-okunur başarı kanıtı yok`)
    }
  }

  const expectedTooling = [
    "scripts/capture-dna-chat-baseline.ts",
    "scripts/run-dna-chat-baseline.mjs",
  ]
  const tooling = evidence.verificationTooling ?? []
  assert.deepEqual(tooling.map((entry: any) => entry.file).sort(), expectedTooling)
  for (const entry of tooling) {
    const toolingPath = path.join(ROOT, entry.file)
    assert.ok(fs.existsSync(toolingPath), `Baseline doğrulama aracı bulunamadı: ${entry.file}`)
    assert.equal(sha256(fs.readFileSync(toolingPath)), entry.sha256, `${entry.file}: tooling hash'i uyuşmuyor`)
  }

  assert.equal(manifest.rollback.requiredTag, ROLLBACK_TAG)
  assert.equal(manifest.rollback.remote, "origin")
  assert.equal(manifest.rollback.remoteRef, `refs/tags/${ROLLBACK_TAG}`)
  assert.equal(evidence.dependencyValidation?.status, "passed")
  assert.match(evidence.dependencyValidation?.packageLockSha256, /^[a-f0-9]{64}$/)
  assert.match(evidence.dependencyValidation?.installedPackageLockSha256, /^[a-f0-9]{64}$/)
  assert.match(evidence.dependencyValidation?.npmLsAllStdoutSha256, /^[a-f0-9]{64}$/)
}

function verifySourceSnapshot(manifest: any): void {
  assert.equal(manifest.sourceSnapshot.gitSha, ROLLBACK_GIT_SHA)
  for (const [groupId, group] of Object.entries(manifest.sourceSnapshot.hashGroups) as Array<[string, any]>) {
    const definition = HASH_GROUPS[groupId]
    assert.ok(definition, `Bilinmeyen baseline hash grubu: ${groupId}`)
    const actualFiles = filesAtCommit(definition.prefixes)
    assert.deepEqual(actualFiles, group.files.map((entry: any) => entry.path), `${groupId}: dosya listesi değişti`)
    const groupHasher = createHash("sha256")
    for (const entry of group.files) {
      const bytes = blobAtCommit(entry.path)
      assert.equal(bytes.byteLength, entry.bytes, `${entry.path}: byte sayısı uyuşmuyor`)
      assert.equal(sha256(bytes), entry.sha256, `${entry.path}: Git blob hash'i uyuşmuyor`)
      groupHasher.update(entry.path)
      groupHasher.update("\0")
      groupHasher.update(bytes)
      groupHasher.update("\0")
    }
    assert.equal(groupHasher.digest("hex"), group.sha256, `${groupId}: grup hash'i uyuşmuyor`)
  }
}

function verifyRegressionFixture(regression: any, compareCurrent: boolean): void {
  assert.equal(regression.schemaVersion, "dna-chat-v2-regression@1")
  assert.equal(regression.rollbackGitSha, ROLLBACK_GIT_SHA)
  assert.equal(regression.engineVersion, "dna-chat-engine@2")
  assert.equal(regression.catalogVersion, "dna-chat-catalog@2")
  assert.equal(regression.samples.length, 16)
  for (const sample of regression.samples) {
    assert.equal(
      sha256(stableJson(sample.response)),
      sample.responseSha256,
      `${sample.id}: kayıtlı response hash'i bozuk`,
    )
    if (compareCurrent) {
      const current = canonicalResponse(resolveDnaChat(sample.request as DnaChatRequest))
      assert.equal(
        sha256(stableJson(current)),
        sample.responseSha256,
        `${sample.id}: mevcut V2 cevabı dondurulmuş regression çıktısından farklı`,
      )
    }
  }
}

function verifyBaseline(compareCurrent: boolean): void {
  assertRollbackCommitExists()
  verifyRollbackTag()
  for (const filePath of [MANIFEST_PATH, REGRESSION_PATH, GATE_EVIDENCE_PATH]) {
    assert.ok(fs.existsSync(filePath), `Baseline artefaktı bulunamadı: ${path.relative(ROOT, filePath)}`)
  }
  const manifest = readJson(MANIFEST_PATH) as any
  const regression = readJson(REGRESSION_PATH) as any
  assert.equal(manifest.schemaVersion, "dna-intelligence-baseline-manifest@1")
  assert.equal(manifest.baselineVersion, BASELINE_VERSION)
  assert.equal(manifest.sourceSnapshot.gitSha, ROLLBACK_GIT_SHA)
  assert.equal(manifest.inventory.topics, 118)
  assert.equal(manifest.inventory.liveClaims, 239)
  assert.equal(manifest.inventory.oneHopRelations, 166)
  assert.equal(manifest.inventory.sources, 160)
  assert.equal(manifest.inventory.safetyRules, 43)
  assert.equal(manifest.inventory.benchmarkQuestions, 1856)
  assert.equal(manifest.inventory.holdoutQuestions, 928)
  assert.equal(manifest.inventory.rawResearchRecords, 2703)
  assert.equal(manifest.regression.artifactSha256, sha256(fs.readFileSync(REGRESSION_PATH)))
  verifySourceSnapshot(manifest)
  verifyRegressionFixture(regression, compareCurrent)
  verifyGateEvidence(manifest)
  verifyChecksums()
  console.log(JSON.stringify({
    ok: true,
    action: compareCurrent ? "verified_with_current_v2" : "verified",
    baselineVersion: BASELINE_VERSION,
    rollbackGitSha: ROLLBACK_GIT_SHA,
    inventory: manifest.inventory,
    regressionSamples: regression.samples.length,
    hashGroups: Object.keys(manifest.sourceSnapshot.hashGroups).length,
  }, null, 2))
}

const write = process.argv.includes("--write")
const compareCurrent = process.argv.includes("--compare-current")
const compareCurrentOnly = process.argv.includes("--compare-current-only")

if (write) writeBaseline()
else if (compareCurrentOnly) {
  assertRollbackCommitExists()
  verifyRegressionFixture(readJson(REGRESSION_PATH) as any, true)
  console.log(JSON.stringify({
    ok: true,
    action: "current_v2_regression_matches",
    rollbackGitSha: ROLLBACK_GIT_SHA,
  }, null, 2))
} else verifyBaseline(compareCurrent)
