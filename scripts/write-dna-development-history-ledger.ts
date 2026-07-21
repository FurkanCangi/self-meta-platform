#!/usr/bin/env node

import { materializeDnaDevelopmentHistoryLedger } from
  "../src/lib/dna/chat/evaluation/developmentHistoryStore"

function main(): void {
  const result = materializeDnaDevelopmentHistoryLedger({
    researchRoot: process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD",
    write: process.argv.includes("--write"),
  })
  console.log(JSON.stringify({ ok: true, ...result }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : "dna_development_history_unknown_error")
  process.exitCode = 1
}
