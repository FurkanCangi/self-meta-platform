import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { performance } from "node:perf_hooks"
import { join } from "node:path"

import { resolveDnaOwnerBook } from "../src/lib/dna/chat/ownerBookRuntime"

type BankCase = Readonly<{
  id: string
  unitId: string
  topicId: string
  family: string
  question: string
  conversationTopicIds?: readonly string[]
  normalizedSha256: string
}>

type Bank = Readonly<{
  schemaVersion: string
  pipelineVersion: string
  caseCount: number
  logicalSha256: string
  cases: readonly BankCase[]
}>

const mode = process.argv[2]
assert.ok(mode === "open" || mode === "holdout", "mode must be open or holdout")

const researchRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const root = join(
  researchRoot,
  "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1",
)
const bankPath = join(root, mode === "open"
  ? "open-development-5000.json"
  : "locked-holdout-1500.json")
const resultPath = join(root, mode === "open"
  ? "open-development-result.json"
  : "locked-holdout-first-result.json")
const postfixResultPath = join(root, "locked-holdout-postfix-result.json")

const bank = JSON.parse(readFileSync(bankPath, "utf8")) as Bank
assert.equal(bank.cases.length, bank.caseCount)

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

const evaluationBinding = {
  runtimePackageSha256: fileSha256(join(
    process.cwd(),
    "src/lib/dna/chat/catalog/generated/dense/runtime.json",
  )),
  retrieverSha256: fileSha256(join(
    process.cwd(),
    "src/lib/dna/chat/ownerBookRuntime.ts",
  )),
}
const resumableResultPath = mode === "open"
  ? resultPath
  : existsSync(resultPath)
    ? postfixResultPath
    : resultPath
if (existsSync(resumableResultPath)) {
  const existing = JSON.parse(readFileSync(resumableResultPath, "utf8"))
  if (existing.bankLogicalSha256 === bank.logicalSha256
    && existing.runtimePackageSha256 === evaluationBinding.runtimePackageSha256
    && existing.retrieverSha256 === evaluationBinding.retrieverSha256) {
    console.log(JSON.stringify(existing, null, 2))
    assert.ok(existing.accuracy >= (mode === "open" ? 98 : 95))
    assert.ok(existing.p95Ms < 25)
    process.exit(0)
  }
}

const failures: Array<{
  id: string
  family: string
  expectedTopicId: string
  actualTopicIds: readonly string[]
  outcome: "not_found" | "wrong_topic"
}> = []
const familyCounts = new Map<string, { total: number; correct: number }>()
const durations: number[] = []

for (const row of bank.cases) {
  const startedAt = performance.now()
  const match = resolveDnaOwnerBook(row.question, row.conversationTopicIds ?? [])
  durations.push(performance.now() - startedAt)
  const correct = Boolean(match?.topicIds.includes(row.topicId))
  const aggregate = familyCounts.get(row.family) ?? { total: 0, correct: 0 }
  aggregate.total += 1
  aggregate.correct += Number(correct)
  familyCounts.set(row.family, aggregate)
  if (!correct) {
    failures.push({
      id: row.id,
      family: row.family,
      expectedTopicId: row.topicId,
      actualTopicIds: match?.topicIds ?? [],
      outcome: match ? "wrong_topic" : "not_found",
    })
  }
}

durations.sort((left, right) => left - right)
const correct = bank.caseCount - failures.length
const accuracy = Number(((correct / bank.caseCount) * 100).toFixed(3))
const p95Ms = Number(durations[Math.ceil(durations.length * 0.95) - 1].toFixed(3))
const result = {
  schemaVersion: "dna-knowledge-expansion-evaluation-result@1",
  mode,
  pipelineVersion: bank.pipelineVersion,
  ...evaluationBinding,
  bankLogicalSha256: bank.logicalSha256,
  caseCount: bank.caseCount,
  correct,
  accuracy,
  p95Ms,
  familyResults: Object.fromEntries([...familyCounts].sort(([left], [right]) =>
    left.localeCompare(right)).map(([family, value]) => [family, {
      ...value,
      accuracy: Number(((value.correct / value.total) * 100).toFixed(3)),
    }])),
  failureCount: failures.length,
  failureSample: failures.slice(0, 100),
}
const resultWithHash = {
  ...result,
  resultSha256: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
}

mkdirSync(root, { recursive: true })
if (mode === "holdout" && existsSync(resultPath)) {
  // The first blind result is immutable. Any engine change is evaluated into
  // a separate postfix record so the historical observation is never hidden.
  writeFileSync(postfixResultPath, `${JSON.stringify(resultWithHash, null, 2)}\n`, { mode: 0o600 })
} else {
  writeFileSync(resultPath, `${JSON.stringify(resultWithHash, null, 2)}\n`, { mode: 0o600 })
}

console.log(JSON.stringify(resultWithHash, null, 2))

if (mode === "open") {
  assert.ok(accuracy >= 98, `open accuracy ${accuracy}% is below 98%`)
} else {
  assert.ok(accuracy >= 95, `holdout accuracy ${accuracy}% is below 95%`)
}
assert.ok(p95Ms < 25, `retrieval p95 ${p95Ms} ms is not below 25 ms`)
