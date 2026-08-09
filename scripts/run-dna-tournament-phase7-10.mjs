import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"

const ROOT = process.cwd()
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ARCH = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const CHECKPOINT = path.join(ARCH, "phase-7-10-checkpoint.json")
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value) => createHash("sha256").update(value).digest("hex")
const fileSha = (file) => sha(readFileSync(file))
const checkpoints = existsSync(CHECKPOINT) ? JSON.parse(readFileSync(CHECKPOINT, "utf8")) : { schemaVersion: "dna-phase7-10-checkpoint@1", phases: {} }

function digest(files) {
  return sha(files.map((file) => `${file}:${fileSha(path.isAbsolute(file) ? file : path.join(ROOT, file))}`).join("\n"))
}
function execute(id, command, inputs, outputs) {
  const inputSha256 = digest(inputs)
  const current = checkpoints.phases[id]
  const outputHashesMatch = outputs.every((file) => existsSync(file)
    && current?.outputHashes?.[path.basename(file)] === fileSha(file))
  if (current?.inputSha256 === inputSha256 && outputHashesMatch) {
    console.log(JSON.stringify({ phase: id, status: "checkpoint_reused" }))
    return
  }
  const result = spawnSync(command[0], command.slice(1), { cwd: ROOT, env: { ...process.env, RESEARCH_SSD_ROOT: SSD }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr)
    throw new Error(`${id}_failed:${result.status}`)
  }
  if (!outputs.every((file) => existsSync(file))) throw new Error(`${id}_output_missing`)
  checkpoints.phases[id] = { inputSha256, completedAt: new Date().toISOString(), outputHashes: Object.fromEntries(outputs.map((file) => [path.basename(file), fileSha(file)])) }
  mkdirSync(path.dirname(CHECKPOINT), { recursive: true, mode: 0o700 })
  writeFileSync(CHECKPOINT, stable(checkpoints), { mode: 0o600 })
}

execute("phase7", ["npm", "run", "chat:tournament:phase7:load"], [
  "scripts/run-dna-tournament-phase7-load.ts",
  "docs/dna-intelligence/architecture-tournament/v2/phase-2/layer-tournament-manifest.json",
  "docs/dna-intelligence/architecture-tournament/v2/phase-3/manifest.json",
], [path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-7/manifest.json")])

execute("phase8_base", ["npm", "run", "chat:tournament:phase8:base:ssd"], [
  "scripts/dna_tournament_human_architectures.py",
  path.join(ARCH, "sealed/human-evaluation-questions.json"),
  path.join(ARCH, "phase-2/e5-unit-embeddings.npy"),
], [path.join(ARCH, "phase-8/human-architecture-base.json"), path.join(ARCH, "phase-8/human-luna-requests.json")])

execute("phase8_luna", ["npm", "run", "chat:tournament:phase8:luna:ssd"], [
  "scripts/run-dna-tournament-phase8-luna.mjs",
  path.join(ARCH, "phase-8/human-luna-requests.json"),
], [path.join(ARCH, "phase-8/human-architecture-results.json")])

execute("phase8_package", ["npm", "run", "chat:tournament:phase8:package:ssd"], [
  "scripts/build-dna-tournament-phase8-package.mjs",
  path.join(ARCH, "phase-8/human-architecture-results.json"),
  path.join(ARCH, "sealed/human-answer-key.json"),
], [path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-8/manifest.json"), path.join(ARCH, "phase-8/blind-human-evaluator.html")])

execute("phase9", ["npm", "run", "chat:tournament:phase9"], [
  "scripts/finalize-dna-tournament-phase9.mjs",
  "docs/dna-intelligence/architecture-tournament/v2/phase-7/manifest.json",
  "docs/dna-intelligence/architecture-tournament/v2/phase-8/manifest.json",
], [path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-9/manifest.json")])

execute("phase10", ["npm", "run", "chat:tournament:phase10"], [
  "scripts/build-dna-tournament-phase10-manifest.mjs",
  "src/lib/dna/chat/tournament/componentFlags.ts",
  "docs/dna-intelligence/architecture-tournament/v2/phase-9/manifest.json",
], [path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-10/manifest.json")])

const verify = spawnSync("npm", ["run", "chat:tournament:phase7-10:verify"], { cwd: ROOT, env: { ...process.env, RESEARCH_SSD_ROOT: SSD }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
if (verify.stdout) process.stdout.write(verify.stdout)
if (verify.status !== 0) { if (verify.stderr) process.stderr.write(verify.stderr); process.exit(verify.status ?? 1) }
console.log(JSON.stringify({ ok: true, phases: Object.keys(checkpoints.phases), checkpoint: CHECKPOINT }))
