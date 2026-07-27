import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { collectCurrentDnaEvaluationEngineSourceFiles } from "../src/lib/dna/chat/evaluation/evaluationGovernance"

function sourceListSha256(files: readonly string[]): string {
  return createHash("sha256").update(files.join("\0"), "utf8").digest("hex")
}

function engineCodeHash(projectRoot: string, files: readonly string[]): string {
  const hash = createHash("sha256")
  for (const relativePath of files) {
    const source = readFileSync(join(projectRoot, relativePath), "utf8")
    if (!source.length) throw new Error(`dna_evaluation_engine_source_empty:${relativePath}`)
    hash.update(relativePath, "utf8")
    hash.update("\0", "utf8")
    hash.update(source, "utf8")
    hash.update("\0", "utf8")
  }
  return hash.digest("hex")
}

const projectRoot = process.cwd()
const files = collectCurrentDnaEvaluationEngineSourceFiles(projectRoot)
process.stdout.write(`${JSON.stringify({
  count: files.length,
  files,
  sourceListSha256: sourceListSha256(files),
  engineCodeHash: engineCodeHash(projectRoot, files),
}, null, 2)}\n`)
