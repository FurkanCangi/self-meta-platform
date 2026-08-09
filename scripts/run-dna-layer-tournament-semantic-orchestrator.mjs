import { spawnSync } from "node:child_process"

const python = "/Volumes/ResearchSSD/Tools/SelfMetaAI/dna-embedding/.venv/bin/python"
for (const stage of ["base", "crossencoder"]) {
  const result = spawnSync(python, ["scripts/dna_layer_tournament_semantic.py", `--stage=${stage}`], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HF_HOME: process.env.HF_HOME || "/Volumes/ResearchSSD/Models/huggingface",
      RESEARCH_SSD_ROOT: process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Semantik ${stage} alt süreci başarısız.\n`)
    process.exit(result.status ?? 1)
  }
}
console.log(JSON.stringify({ ok: true, stages: ["base", "crossencoder"] }))
