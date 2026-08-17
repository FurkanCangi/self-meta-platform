import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const OUTPUT_DIR = process.env.DNA_V1_RECONCILIATION_DIR?.trim()
  || path.join(ROOT, ".tmp/dna-v1-release-reconciliation")

const PRODUCT_EXACT = new Set([
  "src/app/api/app/dna-chat/feedback/route.ts",
  "src/app/api/app/dna-chat/route.ts",
  "src/app/dna-asistani/DnaAssistantClient.tsx",
  "src/app/dna-asistani/DnaIssueFeedback.tsx",
  "src/lib/dna/chat/ownerBookRuntime.ts",
])

const RELEASE_EXACT = new Set([
  "docs/dna-intelligence/architecture-tournament/final-ux/S13_COMPARISON_CONCLUSION_V4.md",
  "docs/dna-intelligence/architecture-tournament/final-ux/S13_INTERNAL_CANARY.md",
  "docs/dna-intelligence/architecture-tournament/final-ux/S13_REALIZER_FUTURE_PROOFING.md",
  "docs/dna-intelligence/architecture-tournament/final-ux/S13_STRICT_ARCHITECTURE.md",
  "docs/dna-intelligence/architecture-tournament/final-ux/S13_VALIDATOR_SPEC.md",
  "docs/dna-intelligence/architecture-tournament/final-ux/S13_WRITING_CONTRACT.md",
  "docs/dna-intelligence/limited-rollout/S13_LIMITED_ROLLOUT_RUNBOOK.md",
  "docs/dna-intelligence/report-v2/v1-baseline.json",
  "package.json",
  "scripts/build-dna-s13-limited-rollout-release.ts",
  "scripts/finalize-dna-chat-final-preproduction.mjs",
  "scripts/finalize-dna-final-release-gate-reconciliation.mjs",
  "scripts/finalize-dna-v1-production-promotion-abort.mjs",
  "scripts/finalize-dna-v1-release-scope.mjs",
  "scripts/prepare-dna-final-release-gate-reconciliation.mjs",
  "scripts/reconcile-dna-v1-release-tree.mjs",
  "scripts/report-v2-cases.ts",
  "scripts/run-dna-adaptive-realization-tests.ts",
  "scripts/run-dna-catalog-quality-audit.ts",
  "scripts/run-dna-chat-final-preproduction.ts",
  "scripts/run-dna-chat-forbidden-imports.ts",
  "scripts/run-dna-chat-security-tests.ts",
  "scripts/run-dna-e2e-user-intent-certification.ts",
  "scripts/run-dna-final-legacy-regressions.mjs",
  "scripts/run-dna-international-gate-adjudication.ts",
  "scripts/run-dna-knowledge-core-v2-shadow-tests.ts",
  "scripts/run-dna-knowledge-core-v2-shadow.ts",
  "scripts/run-dna-paired-luna-value-test.ts",
  "scripts/run-dna-s13-tests.ts",
  "tsconfig.dna-final-legacy.json",
  "tsconfig.dna-final-preproduction.json",
  "tsconfig.dna-international-adjudication.json",
  "tsconfig.e2e-intent-certification.json",
  "tsconfig.knowledge-v2-shadow.json",
  "tsconfig.paired-luna-value-test.json",
  "tsconfig.report-runner.json",
  "tsconfig.report-v2.json",
  "tsconfig.s13-verification.json",
])

const GENERATED_EXACT = new Set([
  "docs/dna-intelligence/architecture-tournament/final-ux/S13_BENCHMARK_ANNOTATION_REPAIR.md",
  "docs/dna-intelligence/architecture-tournament/final-ux/s13-benchmark-annotation-corrections.json",
  "docs/dna-intelligence/report-v2/R0_CURRENT_PIPELINE_AUDIT.md",
  "docs/dna-intelligence/report-v2/R9_OBJECTIVE_REPORT.md",
])

const UNRELATED_EXACT = new Set([
  "tsconfig.dna-final-simplify.json",
])

function classificationFor(file) {
  if (PRODUCT_EXACT.has(file)
    || file.startsWith("src/lib/dna/chat/s13/")
    || file.startsWith("src/lib/dna/reportV2/")) {
    return ["A_REQUIRED_V1_PRODUCT_SOURCE", "Validated V1 Chat or Report implementation source.", true]
  }
  if (RELEASE_EXACT.has(file)
    || file.startsWith("src/app/api/owner-audit/dna-canary/")
    || file.startsWith("src/app/api/owner-audit/dna-limited-rollout/")
    || file.startsWith("src/app/owner-audit/dna-canary/")
    || file.startsWith("scripts/fixtures/report-v2/")
    || file.startsWith("scripts/test-shims/")
    || file.startsWith("scripts/run-dna-s13-")
    || file.startsWith("scripts/run-report-v2-")) {
    return ["B_REQUIRED_V1_TEST_RELEASE_INFRA", "Required V1 contract, regression, monitoring, manifest, or rollback evidence source.", true]
  }
  if (GENERATED_EXACT.has(file)
    || file.startsWith("artifacts/")
    || file.startsWith("deliverables/")
    || file.startsWith("exports/")
    || file.startsWith("docs/dna-intelligence/catalog-quality-audit/")) {
    return ["C_GENERATED_OUTPUT_ARTIFACT", "Generated evidence or export; not production or release source.", false]
  }
  if (file.startsWith(".tmp/") || file.startsWith(".next/") || file.startsWith("node_modules/")) {
    return ["D_TEMP_CACHE_BUILD", "Temporary build or cache output.", false]
  }
  if (UNRELATED_EXACT.has(file)
    || file.startsWith("scripts/audit-dna-s13-eval")
    || file.includes("simplify")
    || /scripts\/(?:run-dna-(?:catalog-acceptance|core-|final-core|gap-|high-rigor|high-yield|knowledge-source|large-batch|priority-source|recovered-corpus|scientific-authority|scientific-source|targeted-scientific))/.test(file)) {
    return ["E_UNRELATED_EXISTING_FILE", "Existing enrichment, deferred SIMPLIFY, or prior evaluation work outside frozen V1 promotion scope.", false]
  }
  return ["F_AMBIGUOUS", "No safe release-scope classification rule matched.", false]
}

function csvCell(value) {
  const text = String(value ?? "")
  return /[",\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const raw = execFileSync("git", ["status", "--porcelain=v1", "-z", "-uall"], {
  cwd: ROOT,
  encoding: "utf8",
})
const records = raw.split("\0").filter(Boolean).map((entry) => {
  const status = entry.slice(0, 2)
  const file = entry.slice(3)
  const [classification, reason, includeInReleaseCommit] = classificationFor(file)
  return Object.freeze({ path: file, status, classification, reason, includeInReleaseCommit })
}).sort((left, right) => left.path.localeCompare(right.path))

const counts = Object.fromEntries([
  "A_REQUIRED_V1_PRODUCT_SOURCE",
  "B_REQUIRED_V1_TEST_RELEASE_INFRA",
  "C_GENERATED_OUTPUT_ARTIFACT",
  "D_TEMP_CACHE_BUILD",
  "E_UNRELATED_EXISTING_FILE",
  "F_AMBIGUOUS",
].map((key) => [key, records.filter((row) => row.classification === key).length]))

const summary = Object.freeze({
  schemaVersion: "dna-v1-release-tree-reconciliation@1",
  generatedAt: new Date().toISOString(),
  initialSnapshot: Object.freeze({ modified: 15, untracked: 124 }),
  expandedCurrentFileRows: records.length,
  counts: Object.freeze(counts),
  releaseCommitPaths: Object.freeze(records.filter((row) => row.includeInReleaseCommit).map((row) => row.path)),
  ambiguousPaths: Object.freeze(records.filter((row) => row.classification === "F_AMBIGUOUS").map((row) => row.path)),
})

mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
const csvHeader = ["path", "status", "classification", "reason", "includeInReleaseCommit"]
const csv = [csvHeader.join(","), ...records.map((record) => csvHeader.map((key) => csvCell(record[key])).join(","))].join("\n")
writeFileSync(path.join(OUTPUT_DIR, "release-tree-inventory.csv"), `${csv}\n`, { mode: 0o600 })
writeFileSync(path.join(OUTPUT_DIR, "release-tree-inventory.json"), `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 })
writeFileSync(path.join(OUTPUT_DIR, "release-tree-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 })
writeFileSync(path.join(OUTPUT_DIR, "release-commit-paths.txt"), `${summary.releaseCommitPaths.join("\n")}\n`, { mode: 0o600 })

const digest = createHash("sha256").update(JSON.stringify({ records, summary })).digest("hex")
console.log(JSON.stringify({ outputDir: OUTPUT_DIR, digest, ...summary }, null, 2))
if (summary.ambiguousPaths.length > 0) process.exitCode = 2
