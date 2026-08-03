import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  predictDnaSemanticRouter,
  stableDnaSemanticHash,
  trainDnaSemanticRouter,
  type DnaSemanticRouterArtifact,
  type DnaSemanticRouterTrainingExample,
} from "../src/lib/dna/chat/semanticRouterFtrl"

type Surface = {
  id: string
  question: string
  family: string
  topicId: string
  unitId: string
  normalizedSha256: string
  conversationTopicIds?: string[]
}

type DenseUnit = { id: string; domain: string; dimensions: string[] }

const root = process.cwd()
const ssdRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const knowledgeRoot = join(ssdRoot, "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1")
const openPath = join(knowledgeRoot, "open-development-5000.json")
const lockedPath = join(knowledgeRoot, "locked-holdout-1500.json")
const densePath = join(root, "src/lib/dna/chat/catalog/generated/dense/runtime.json")
const artifactPath = join(root, "src/lib/dna/chat/catalog/generated/semantic-router/artifact.json")
const manifestPath = join(root, "docs/dna-intelligence/program/evidence/dna-semantic-router-v1.json")

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function kindFor(row: Surface, unit: DenseUnit) {
  if (row.family === "comparison") return "comparison"
  if (row.family === "evidence") return "evidence"
  if (row.family === "development") return "development"
  if (row.family === "followup" || row.family === "repair") return "followup"
  if (unit.dimensions.includes("measurement")) return "measurement"
  if (unit.dimensions.includes("relation")) return "relation"
  return "definition"
}

function topForPrefix(artifact: DnaSemanticRouterArtifact, text: string, prefix: string) {
  return predictDnaSemanticRouter(artifact, text).find((row) => row.label.startsWith(prefix))?.label ?? null
}

function scoreArtifact(
  artifact: DnaSemanticRouterArtifact,
  rows: readonly { example: DnaSemanticRouterTrainingExample; domain: string; kind: string }[],
) {
  let domainCorrect = 0
  let kindCorrect = 0
  for (const row of rows) {
    domainCorrect += Number(topForPrefix(artifact, row.example.text, "domain:") === `domain:${row.domain}`)
    kindCorrect += Number(topForPrefix(artifact, row.example.text, "kind:") === `kind:${row.kind}`)
  }
  return {
    domainAccuracy: rows.length ? domainCorrect / rows.length : 0,
    kindAccuracy: rows.length ? kindCorrect / rows.length : 0,
    macroAccuracy: rows.length ? (domainCorrect + kindCorrect) / (rows.length * 2) : 0,
  }
}

const openFile = JSON.parse(readFileSync(openPath, "utf8")) as { cases: Surface[]; logicalSha256: string }
const lockedFile = JSON.parse(readFileSync(lockedPath, "utf8")) as { cases: Surface[]; logicalSha256: string }
const dense = JSON.parse(readFileSync(densePath, "utf8")) as { units: DenseUnit[] }
assert.equal(openFile.cases.length, 5_000)
assert.equal(lockedFile.cases.length, 1_500)
const unitById = new Map(dense.units.map((unit) => [unit.id, unit]))
const lockedHashes = new Set(lockedFile.cases.map((row) => row.normalizedSha256))
const lockedFamilies = new Set(lockedFile.cases.map((row) => `${row.unitId}:${row.family}`))

const mapped = openFile.cases.flatMap((row) => {
  const unit = unitById.get(row.unitId)
  assert.ok(unit, `Missing dense unit ${row.unitId}`)
  assert.ok(!lockedHashes.has(row.normalizedSha256), `Locked hash leaked: ${row.id}`)
  assert.ok(!lockedFamilies.has(`${row.unitId}:${row.family}`), `Locked semantic family leaked: ${row.id}`)
  const kind = kindFor(row, unit)
  return [{
    example: {
      text: row.question,
      labels: [`domain:${unit.domain}`, `kind:${kind}`],
      contextTokens: row.conversationTopicIds ?? [],
    },
    domain: unit.domain,
    kind,
  }]
})
const development = mapped.filter((row) => stableDnaSemanticHash(row.example.text) % 5 !== 0)
const validation = mapped.filter((row) => stableDnaSemanticHash(row.example.text) % 5 === 0)
const labels = [...new Set(mapped.flatMap((row) => row.example.labels))].sort()
const trainingCorpusSha256 = sha(stableJson(development.map((row) => row.example)))
const holdoutExclusionSha256 = sha(stableJson({
  lockedLogicalSha256: lockedFile.logicalSha256,
  lockedHashes: [...lockedHashes].sort(),
  lockedFamilies: [...lockedFamilies].sort(),
}))
const grid = [
  { alpha: 0.08, beta: 1, l1: 0.02, l2: 0.8, epochs: 3 },
  { alpha: 0.12, beta: 1, l1: 0.02, l2: 0.6, epochs: 4 },
] as const
const trainedAt = "2026-08-03T00:00:00.000Z"
const candidates = grid.map((hyperparameters, index) => {
  const artifact = trainDnaSemanticRouter({
    examples: development.map((row) => row.example),
    labels,
    modelVersion: `dna-semantic-router-ftrl@1-grid-${index + 1}`,
    trainedAt,
    trainingCorpusSha256,
    holdoutExclusionSha256,
    hyperparameters,
  })
  return { artifact, score: scoreArtifact(artifact, validation) }
}).sort((left, right) =>
  right.score.macroAccuracy - left.score.macroAccuracy ||
  JSON.stringify(left.artifact).length - JSON.stringify(right.artifact).length)
const selected = candidates[0]
assert.ok(selected)
const artifact = { ...selected.artifact, modelVersion: "dna-semantic-router-ftrl@1" }
const artifactText = `${JSON.stringify(artifact)}\n`
writeFileSync(artifactPath, artifactText)
const manifest = {
  schemaVersion: "dna-semantic-router-manifest@1",
  routerVersion: "dna-semantic-router@1",
  engineTarget: "dna-chat-engine@2.1",
  runtimeGeneration: "v2_legacy",
  algorithm: "ftrl_proximal_ovr",
  trainingRows: development.length,
  validationRows: validation.length,
  lockedRowsExcluded: lockedFile.cases.length,
  labels,
  selectedHyperparameters: artifact.hyperparameters,
  validation: selected.score,
  trainingCorpusSha256,
  holdoutExclusionSha256,
  artifactSha256: sha(artifactText),
  artifactBytes: Buffer.byteLength(artifactText),
  runtimeTraining: false,
  userMessageRetention: false,
  externalLlm: false,
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify(manifest, null, 2))
