import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUT = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux")
const read = (name) => JSON.parse(readFileSync(path.join(OUT, name), "utf8"))
const sha = (value) => createHash("sha256").update(value).digest("hex")
for (const name of ["checkpoint.json", "s13-freeze.json", "final-ux-challenge.json", "frozen-retrieval.json", "automatic-results.json", "chatgpt-pro-evaluation-package.json"]) {
  if (!existsSync(path.join(OUT, name))) throw new Error(`s13_artifact_missing:${name}`)
}
const checkpoint = read("checkpoint.json")
const freeze = read("s13-freeze.json")
const challenge = read("final-ux-challenge.json")
const retrieval = read("frozen-retrieval.json")
const results = read("automatic-results.json")
const pro = read("chatgpt-pro-evaluation-package.json")
if (freeze.baselineCommit !== "7bd6422326b5177a25cc456cc4c9b10ba83a3e4d" || freeze.productionAffected !== false) throw new Error("s13_freeze_invalid")
for (const [file, record] of Object.entries(freeze.sourceFiles)) {
  if (!existsSync(file)) throw new Error(`s13_frozen_source_missing:${file}`)
  const current = sha(readFileSync(file))
  if (current === record.sha256) continue
  const amendmentPath = path.join(OUT, "s13-freeze-amendment.json")
  if (!existsSync(amendmentPath)) throw new Error(`s13_frozen_source_changed_without_amendment:${file}`)
  const amendment = read("s13-freeze-amendment.json")
  if (file !== amendment.changedFile || record.sha256 !== amendment.previousSha256 || current !== amendment.currentSha256 || amendment.reason !== "raw_challenge_seed_relocation_no_behavior_change" || amendment.tuningPerformed !== false) throw new Error(`s13_freeze_amendment_invalid:${file}`)
}
if (challenge.count !== 100 || Object.values(challenge.distribution).reduce((a, b) => a + b, 0) !== 100 || challenge.leakage.exactNormalized !== 0 || challenge.leakage.nearLexicalFailures !== 0) throw new Error("s13_challenge_invalid")
if (retrieval.rows.length !== 100 || results.rows.length !== 100 || pro.cases.length !== 100) throw new Error("s13_result_count_invalid")
if (results.usage.costMicrousd > 3_000_000 || results.boundaries.productionAffected !== false || results.boundaries.clinicalDataSent !== false) throw new Error("s13_cost_or_boundary_invalid")
for (const architecture of ["S1", "S5", "S13-A", "S13-B"]) {
  if (!results.metrics[architecture]?.safetyPass || results.metrics[architecture]?.privacyLeak !== 0 || results.metrics[architecture]?.validatorFailureShown !== 0) throw new Error(`s13_hard_gate_failed:${architecture}`)
}
if (!new Set(["awaiting_pro_evaluation", "awaiting_human_evaluation", "ready_for_canary"]).has(checkpoint.status)) throw new Error(`s13_checkpoint_status_invalid:${checkpoint.status}`)
const packageCopy = { ...pro }; delete packageCopy.packageSha256
if (pro.packageSha256 !== sha(`${JSON.stringify(packageCopy, null, 2)}\n`)) throw new Error("s13_pro_package_hash_invalid")
console.log(JSON.stringify({ ok: true, status: checkpoint.status, count: challenge.count, costUsd: results.usage.costMicrousd / 1_000_000, metrics: results.metrics }))
