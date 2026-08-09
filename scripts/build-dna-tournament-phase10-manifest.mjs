import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const REPO = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-10")
const PHASE9 = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-9/manifest.json")
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const sha = (value) => createHash("sha256").update(value).digest("hex")
const phase9 = JSON.parse(readFileSync(PHASE9, "utf8"))
const humanComplete = phase9.boundaries.independentHumanEvaluationComplete === true
const manifest = {
  schemaVersion: "dna-architecture-canary-release-phase10@1",
  generatedAt: new Date().toISOString(),
  status: humanComplete ? "ready_for_local_shadow" : "infrastructure_ready_rollout_blocked_human_evaluation",
  sequence: ["local_shadow", "production_shadow", "internal", "10", "50", "100"],
  independentFlags: {
    semanticParser: "DNA_TOURNAMENT_SEMANTIC_PARSER_ENABLED",
    embedding: "DNA_TOURNAMENT_EMBEDDING_ENABLED",
    reranker: "DNA_TOURNAMENT_RERANKER_ENABLED",
    controlledNlg: "DNA_TOURNAMENT_CONTROLLED_NLG_ENABLED",
    localSlm: "DNA_TOURNAMENT_LOCAL_SLM_ENABLED",
    lunaParsing: "DNA_TOURNAMENT_LUNA_PARSING_ENABLED",
    lunaRealization: "DNA_TOURNAMENT_LUNA_REALIZATION_ENABLED",
    lunaFallback: "DNA_TOURNAMENT_LUNA_FALLBACK_ENABLED",
  },
  stageFlag: "DNA_TOURNAMENT_CANARY_STAGE",
  releaseAuthorizationFlags: {
    humanEvaluation: "DNA_TOURNAMENT_HUMAN_EVALUATION_COMPLETE",
    productionWinner: "DNA_TOURNAMENT_PRODUCTION_WINNER",
    attestationSha256: "DNA_TOURNAMENT_RELEASE_ATTESTATION_SHA256",
  },
  legacyFallback: { guaranteed: true, engineFlag: "DNA_ENGINE_VERSION=legacy", tournamentDefault: "shadow_only" },
  liveGates: ["greeting", "noisy_spelling", "followup_correction", "low_lexical_overlap", "two_subquestions", "unsupported_relation", "safety", "synthetic_case", "cross_account_isolation", "audit_fail_closed", "production_latency", "actual_cost", "synthetic_cleanup"],
  gateEvidence: {
    automatedSafetyPhase4: "PASS for S1/S2/S5",
    phase7CostLoad: "complete",
    phase8Package: "complete",
    independentHumanRatings: humanComplete ? "complete" : "pending",
    productionWinner: phase9.productionWinner?.architecture ?? null,
  },
  activation: {
    codeMayDeployWithAllFlagsOff: true,
    productionShadowAllowed: true,
    internalOrPercentRolloutAllowed: humanComplete && Boolean(phase9.productionWinner),
    currentAction: humanComplete ? "local_shadow" : "keep_legacy_and_collect_human_ratings",
  },
  boundaries: { productionAnswerChanged: false, percentRolloutStarted: false, syntheticProductionDataCreated: false, syntheticCleanupRequired: false },
  sourceHashes: { phase9: sha(readFileSync(PHASE9)) },
}
mkdirSync(REPO, { recursive: true })
writeFileSync(path.join(REPO, "manifest.json"), stable(manifest))
writeFileSync(path.join(REPO, "README.md"), `# DNA Architecture Tournament — Faz 10\n\nBağımsız katman bayrakları ve canary sırası kodlandı. Kod bütün bayraklar kapalıyken güvenle dağıtılabilir; legacy motor geri dönüşü korunur. ${humanComplete ? "Kör insan kapısı tamamlandığı için local shadow başlatılabilir." : "Gerçek insan değerlendirmesi tamamlanmadığı için internal, %10, %50 ve %100 yayın otomatik olarak engellenir."}\n`)
writeFileSync(path.join(REPO, "SHA256SUMS"), `${["README.md", "manifest.json"].map((name) => `${sha(readFileSync(path.join(REPO, name)))}  ${name}`).join("\n")}\n`)
console.log(JSON.stringify({ ok: true, status: manifest.status, internalRolloutAllowed: manifest.activation.internalOrPercentRolloutAllowed }))
