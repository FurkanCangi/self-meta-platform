import crypto from "node:crypto"
import path from "node:path"

import { runSingleFixture } from "./run-dna-report"

const FIXTURES = [
  "scripts/fixtures/dna-new-08-adaptive-daily-living-friction.json",
  "scripts/fixtures/dna-item-level-linkage.json",
  "scripts/fixtures/dna-evidence-limited-mixed-raw-preserved.json",
  "scripts/fixtures/dna-age-mismatch-warning.json",
  "scripts/fixtures/dna-new-06-somatodyspraxia-motor-planning.json",
]

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`
}

function hash(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex")
}

async function main() {
  const failures: string[] = []

  for (const fixture of FIXTURES) {
    const fixturePath = path.resolve(process.cwd(), fixture)
    const hashes: string[] = []
    for (let index = 0; index < 10; index += 1) {
      const result = await runSingleFixture(fixturePath, true)
      hashes.push(
        hash({
          finalText: result.finalText,
          auditTrail: result.auditTrail,
          selectedAtoms: result.trace?.selectedAtoms || [],
          suppressedAtoms: result.trace?.suppressedAtoms || [],
          reportVersionMeta: result.reportVersionMeta,
        })
      )
    }
    const unique = Array.from(new Set(hashes))
    if (unique.length !== 1) {
      failures.push(`${fixture}: 10 koşuda ${unique.length} farklı hash üretildi.`)
    }
    console.log(`${path.basename(fixture)}: ${unique[0] || "NO_HASH"}`)
  }

  console.log("=== REPORT DETERMINISM ===")
  if (failures.length) {
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exit(1)
  }
  console.log("PASS: seçili fixture setinde 10/10 hash stabil.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
