import fs from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { LunaReportRealizer } from "../src/lib/dna/reportV2/lunaReportRealizer.server"
import { runReportV2Shadow } from "../src/lib/dna/reportV2/runner"

dotenv.config({ path: path.join(process.cwd(), ".env.local"), quiet: true })
dotenv.config({ path: path.join(process.cwd(), ".env"), quiet: true })

async function main() {
  const fixtures = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts/fixtures/report-v2/legacy-five.json"), "utf8"))
  const result = await runReportV2Shadow(fixtures[0], { realizer: new LunaReportRealizer({ safetyIdentifier: "report-v2-shadow-smoke" }) })
  const attempts = result.trace.realizationAttempts.filter((attempt) => attempt.provider === "luna")
  console.log(JSON.stringify({
    pass: result.validation.pass,
    providerCalls: result.providerCalls,
    fallbackUsed: result.fallbackUsed,
    attempts: attempts.map((attempt) => ({ attempt: attempt.attempt, responseIdPresent: Boolean(attempt.responseId), usage: attempt.usage, latencyMs: Math.round(attempt.latencyMs) })),
    finalReportHash: result.trace.finalReportHash,
  }, null, 2))
}

void main()
