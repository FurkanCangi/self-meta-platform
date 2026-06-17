import fs from "node:fs/promises"
import path from "node:path"

import { runSingleFixture } from "./run-dna-report"

const FIXTURE = "scripts/fixtures/dna-rich-case.json"
const ROUTE = "src/app/api/ai-report/route.ts"

const FORBIDDEN_META_PATTERNS = [
  /"clientName"\s*:\s*"(?!\[redacted\])/i,
  /"clientCode"\s*:\s*"(?!\[redacted\])/i,
  /"anamnez"\s*:/i,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?\d[\s().-]*){10,}/,
]

async function assertProductionRouteResponseShape() {
  const source = await fs.readFile(path.resolve(process.cwd(), ROUTE), "utf8")
  const responseBlocks = Array.from(source.matchAll(/NextResponse\.json\(\s*\{([\s\S]*?)\}\s*\)/g)).map((match) => match[1])
  const successBlocks = responseBlocks.filter((block) => /\bok\s*:\s*true\b/.test(block))
  const forbidden = ["trace", "auditTrail", "reportVersionMeta", "selectedAtoms", "suppressedAtoms", "triggeredRules", "meta"]
  const failures: string[] = []
  for (const block of successBlocks) {
    for (const key of forbidden) {
      if (new RegExp(`\\b${key}\\b`).test(block)) failures.push(`Production success response ${key} alanını içeriyor.`)
    }
  }
  if (!successBlocks.length) failures.push("Production route success response bloğu bulunamadı.")
  return failures
}

async function main() {
  const fixturePath = path.resolve(process.cwd(), FIXTURE)
  const result = await runSingleFixture(fixturePath, true)
  const metaPath = path.join(result.outputDir, "report-meta.json")
  const metaText = await fs.readFile(metaPath, "utf8")
  const failures: string[] = []

  for (const pattern of FORBIDDEN_META_PATTERNS) {
    if (pattern.test(metaText)) failures.push(`CLI report-meta.json redaction ihlali: ${pattern}`)
  }
  if (!/"clientCode"\s*:\s*"\[redacted\]"/.test(metaText)) failures.push("clientCode redacted görünmüyor.")
  if (!/"clientName"\s*:\s*"\[redacted\]"/.test(metaText)) failures.push("clientName redacted görünmüyor.")
  failures.push(...(await assertProductionRouteResponseShape()))

  console.log("=== REPORT PRIVACY ===")
  console.log(`Meta: ${metaPath}`)
  if (failures.length) {
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exit(1)
  }
  console.log("PASS: production response debug/trace döndürmüyor; CLI meta PII redacted.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
