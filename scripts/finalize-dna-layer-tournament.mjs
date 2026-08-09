import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const ARCH = path.join(SSD, "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2")
const OUT = path.join(ARCH, "phase-2")
const REPO = path.join(ROOT, "docs/dna-intelligence/architecture-tournament/v2/phase-2")
const sha = (value) => createHash("sha256").update(value).digest("hex")
const read = (name) => JSON.parse(readFileSync(path.join(OUT, name), "utf8"))
const stable = (value) => `${JSON.stringify(value, null, 2)}\n`
const fileHash = (name) => sha(readFileSync(path.join(OUT, name)))

const deterministic = read("deterministic-layer-results.json")
const semantic = read("semantic-retrieval-results.json")
const luna = read("luna-layer-results.json")
const local = read("local-slm-layer-results.json")
const benchmark = JSON.parse(readFileSync(path.join(ARCH, "manifest.json"), "utf8"))

const lunaGuardRows = luna.rows.C4.filter((row) => row.unsupportedClaim > 0)
const lunaAdjudication = {
  guardAlerts: lunaGuardRows.length,
  confirmedUnsupportedAdditions: 2,
  confirmedIds: ["arch-followup_correction_focus-166", "arch-followup_correction_focus-167"],
  falsePositiveGuardIds: ["arch-noisy_colloquial_incomplete-040", "arch-noisy_colloquial_incomplete-083"],
  basis: "codex_source_claim_reread_not_independent_human_validation",
}

const summary = {
  schemaVersion: "dna-architecture-layer-tournament-phase2@1",
  generatedAt: new Date().toISOString(),
  benchmarkSha256: benchmark.benchmarkSha256,
  benchmark: { development: 600, lockedAutomated: 250, blindHuman: 150 },
  status: "automated_layer_tournament_complete_blind_human_preference_pending",
  postSealSelectionRevision: {
    sealedFirstResultPreserved: true,
    layerCFrom: ["C1_improved_controlled_nlg", "C2_retrieve_and_fill"],
    layerCTo: ["C0_existing_deterministic", "C2_retrieve_and_fill"],
    reason: "C0 locked completeness and relevance exceeded C1; finalist interpretation was corrected without changing any locked answer or metric.",
  },
  layerA: {
    A0: deterministic.layerA.A0,
    A1: deterministic.layerA.A1,
    A2: semantic.layerA.A2,
    A3: luna.layerA.A3,
    A4: local.layerA.A4,
    automatedFinalists: ["A1_improved_deterministic", "A2_e5_linear_parser"],
    decision: "A1 has the strongest topic/focus/comparison routing at zero marginal cost; A2 has the strongest intent and frame exact match but adds about 871 MB peak RSS and sub-second CPU latency. A3 and A4 do not advance.",
  },
  layerB: {
    ...semantic.layerB,
    automatedFinalists: ["B0_legacy_lexical", "B1_e5_hybrid_rrf"],
    decision: "B0 reached Recall@5 1.0 on this lexical-heavy locked set. B1 reached 0.9973 and remains the semantic challenger. B2 was slower, less accurate and failed unsupported discrimination on its fixed resource-gate sample.",
  },
  layerC: {
    C0: deterministic.layerC.C0,
    C1: deterministic.layerC.C1,
    C2: deterministic.layerC.C2,
    C3: local.layerC.C3,
    C4: { ...luna.layerC.C4, sourceFidelityAdjudication: lunaAdjudication, disqualifiedByMandatoryZero: lunaAdjudication.confirmedUnsupportedAdditions > 0 },
    automatedFinalists: ["C0_existing_deterministic", "C2_retrieve_and_fill"],
    decision: "C0 has the strongest locked completeness/relevance and C2 the strongest Turkish naturalness heuristic; both preserve all mandatory zeros. C1 did not materially beat C0. C4 is more fluent but added a child population qualifier in two answers; C3 is grounded in its sample but too slow and lacks full locked coverage. Blind human preference is still pending.",
  },
  costsAndResources: {
    lunaMeasuredSuccessfulRunsUsd: luna.usage.costMicrousd / 1_000_000,
    lunaUsage: luna.usage,
    localQwen: local.resources,
    e5PeakRssMb: semantic.layerA.A2.peakRssMb,
    crossEncoderPeakRssMb: semantic.layerB.B2.peakRssMb,
  },
  sourceArtifacts: Object.fromEntries(["deterministic-layer-results.json", "semantic-retrieval-results.json", "luna-layer-results.json", "local-slm-layer-results.json"].map((name) => [name, fileHash(name)])),
  boundaries: {
    productionAffected: false,
    runtimeEligible: false,
    releaseEligible: false,
    engineDefault: "legacy",
    rawQuestionsInRepository: false,
    rawModelAnswersInRepository: false,
    independentHumanEvaluationComplete: false,
  },
}

mkdirSync(OUT, { recursive: true, mode: 0o700 })
writeFileSync(path.join(OUT, "phase-2-summary.json"), stable(summary), { mode: 0o600 })
chmodSync(path.join(OUT, "phase-2-summary.json"), 0o600)

const sealed = path.join(ARCH, "sealed/phase-2-locked-first-results.json")
if (!existsSync(sealed)) {
  writeFileSync(sealed, stable({ schemaVersion: "dna-phase2-locked-first-results@1", createdAt: summary.generatedAt, benchmarkSha256: summary.benchmarkSha256, resultSha256: sha(stable(summary)), status: summary.status, automatedFinalists: { layerA: summary.layerA.automatedFinalists, layerB: summary.layerB.automatedFinalists, layerC: summary.layerC.automatedFinalists } }), { mode: 0o444, flag: "wx" })
  chmodSync(sealed, 0o444)
}

mkdirSync(REPO, { recursive: true })
const repoManifest = {
  ...summary,
  sourceArtifacts: summary.sourceArtifacts,
  ssdSummarySha256: sha(stable(summary)),
  rawRowsStoredAt: "ResearchSSD only",
}
writeFileSync(path.join(REPO, "layer-tournament-manifest.json"), stable(repoManifest))
writeFileSync(path.join(REPO, "README.md"), `# DNA Architecture Tournament — Faz 2\n\nKatman bazlı otomatik turnuva tamamlandı. Production motoru değiştirilmedi. Otomatik finalistler: A1/A2, B0/B1 ve C0/C2. Luna C4 iki doğrulanmış kaynak dışı yaş/popülasyon eklemesi nedeniyle sıfır-sadakat kapısını geçemedi. Yerel Qwen parser/yazım challenger'ı kaynak kapısı örnekleminde yavaş ve düşük doğruluklu kaldı. 150 soruluk kör insan tercihi bağımsız değerlendirme olarak hâlâ bekliyor.\n`)
const checksumNames = ["README.md", "layer-tournament-manifest.json"]
writeFileSync(path.join(REPO, "SHA256SUMS"), `${checksumNames.map((name) => `${sha(readFileSync(path.join(REPO, name)))}  ${name}`).join("\n")}\n`)
console.log(JSON.stringify({ ok: true, status: summary.status, automatedFinalists: { A: summary.layerA.automatedFinalists, B: summary.layerB.automatedFinalists, C: summary.layerC.automatedFinalists }, lunaUsd: summary.costsAndResources.lunaMeasuredSuccessfulRunsUsd }))
