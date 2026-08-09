import { spawnSync } from "node:child_process"
import path from "node:path"

const root = process.cwd()
const runner = path.join(root, ".tmp/dna-layer-tournament/scripts/run-dna-layer-tournament.js")
const layerTotals = { A: 6, C: 6 }

function execute(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [runner, ...args], {
    cwd: root,
    env: { ...process.env, RESEARCH_SSD_ROOT: process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD", ...extraEnv },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Turnuva alt süreci ${result.status} koduyla kapandı.\n`)
    process.exit(result.status ?? 1)
  }
}

for (const layer of ["A", "C"]) {
  const total = layerTotals[layer]
  for (let part = 0; part < total; part += 1) execute([`--layer=${layer}`], { DNA_TOURNAMENT_CHUNK_TOTAL: String(total), DNA_TOURNAMENT_CHUNK_PART: String(part) })
}
execute(["--layer=merge"], { DNA_TOURNAMENT_A_TOTAL: String(layerTotals.A), DNA_TOURNAMENT_C_TOTAL: String(layerTotals.C) })
console.log(JSON.stringify({ ok: true, chunks: layerTotals, layers: ["A0", "A1", "C0", "C1", "C2"] }))
