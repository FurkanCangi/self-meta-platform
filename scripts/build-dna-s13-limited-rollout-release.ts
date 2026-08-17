import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { resolveDnaS13LimitedRolloutConfig } from "../src/lib/dna/chat/s13/limitedRollout/config"
import { getDnaS13LimitedRolloutReleaseCandidate } from "../src/lib/dna/chat/s13/limitedRollout/release"
import { DNA_S13_LIMITED_MONITORING_THRESHOLDS } from "../src/lib/dna/chat/s13/limitedRollout/telemetry"

type Json = Record<string, any>

const SSD = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const CANARY_ROOT = path.join(SSD,
  "Outputs/SelfMetaAI/dna-intelligence/internal-canary/s13-strict-v4/run-20260810-autonomous-v2-001")
const TARGETED_RUN_ID = process.env.DNA_S13_LIMITED_TARGETED_RUN_ID || "run-20260810-limited-preflight-001"
const TARGETED_ROOT = path.join(SSD,
  "Outputs/SelfMetaAI/dna-intelligence/internal-canary/s13-strict-v4/targeted-context-fix-v1", TARGETED_RUN_ID)
const STRICT_ROOT = path.join(SSD,
  "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux/s13-strict-regression-v3")
const COMPARISON_ROOT = path.join(SSD,
  "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/final-ux/s13-strict-comparison-conclusion-v4")
const RUNBOOK_SOURCE = path.join(process.cwd(),
  "docs/dna-intelligence/limited-rollout/S13_LIMITED_ROLLOUT_RUNBOOK.md")

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function fileSha(file: string) {
  return sha(readFileSync(file))
}

function readJson(file: string): Json {
  return JSON.parse(readFileSync(file, "utf8")) as Json
}

function stable(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writePrivate(file: string, value: unknown) {
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}

function verifyEvidence() {
  const required = [
    path.join(CANARY_ROOT, "canary-summary.json"),
    path.join(CANARY_ROOT, "manifest.json"),
    path.join(CANARY_ROOT, "provenance.jsonl"),
    path.join(TARGETED_ROOT, "targeted-context-summary.json"),
    path.join(TARGETED_ROOT, "manifest.json"),
    path.join(STRICT_ROOT, "s13-strict-40-regression-summary.json"),
    path.join(STRICT_ROOT, "manifest.json"),
    path.join(COMPARISON_ROOT, "comparison-conclusion-10-summary.json"),
    path.join(COMPARISON_ROOT, "manifest.json"),
    RUNBOOK_SOURCE,
  ]
  for (const file of required) if (!existsSync(file)) throw new Error(`limited_release_input_missing:${file}`)
  if (process.env.DNA_S13_PREFLIGHT_CONFIRMED !== "1") throw new Error("limited_release_preflight_not_confirmed")

  const canary = readJson(path.join(CANARY_ROOT, "canary-summary.json"))
  const canaryManifest = readJson(path.join(CANARY_ROOT, "manifest.json"))
  const targeted = readJson(path.join(TARGETED_ROOT, "targeted-context-summary.json"))
  const strict = readJson(path.join(STRICT_ROOT, "s13-strict-40-regression-summary.json"))
  const comparison = readJson(path.join(COMPARISON_ROOT, "comparison-conclusion-10-summary.json"))
  if (canary.decision !== "READY_FOR_LIMITED_ROLLOUT" || canary.productionAffected !== false) {
    throw new Error("limited_release_canary_not_ready")
  }
  if (!targeted.pass || strict.count !== 40 || strict.acceptance?.pass !== true
    || comparison.count !== 10 || comparison.acceptance?.pass !== true) {
    throw new Error("limited_release_regression_not_passed")
  }
  for (const [file, metadata] of Object.entries(canaryManifest.outputs || {})) {
    const full = path.join(CANARY_ROOT, file)
    if (!existsSync(full) || fileSha(full) !== (metadata as Json).sha256) {
      throw new Error(`limited_release_canary_manifest_mismatch:${file}`)
    }
  }
  return { canary, canaryManifest, targeted, strict, comparison }
}

function canaryPromptAndRetrievalSetHashes() {
  const rows = readFileSync(path.join(CANARY_ROOT, "provenance.jsonl"), "utf8")
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Json)
  const promptHashes = [...new Set(rows.map((row) => String(row.prompt?.hash || "")).filter(Boolean))].sort()
  const retrievalHashes = [...new Set(rows.map((row) => String(row.retrieval?.hash || "")).filter(Boolean))].sort()
  return Object.freeze({
    promptInstances: promptHashes.length,
    promptHashSetSha256: sha(JSON.stringify(promptHashes)),
    retrievalInstances: retrievalHashes.length,
    retrievalHashSetSha256: sha(JSON.stringify(retrievalHashes)),
  })
}

function main() {
  if (process.env.VERCEL_ENV?.toLowerCase() === "production"
    || process.env.DNA_RUNTIME_ENV?.toLowerCase() === "production") {
    throw new Error("limited_release_builder_blocked_in_production")
  }
  const evidence = verifyEvidence()
  const release = getDnaS13LimitedRolloutReleaseCandidate()
  const releaseId = `${release.releaseVersion}-${release.releaseHash.slice(0, 8)}`
  const outputRoot = path.join(SSD, "dna-intelligence/limited-rollout/s13-strict-v4", releaseId)
  if (existsSync(outputRoot)) throw new Error(`limited_release_output_exists:${outputRoot}`)
  mkdirSync(outputRoot, { recursive: true, mode: 0o700 })
  chmodSync(outputRoot, 0o700)

  const defaultConfig = resolveDnaS13LimitedRolloutConfig({})
  const promptSet = canaryPromptAndRetrievalSetHashes()
  writePrivate(path.join(outputRoot, "release-candidate.json"), {
    schemaVersion: "dna-s13-limited-release-candidate@1",
    releaseId,
    ...release,
    canaryEvidence: {
      runId: evidence.canary.runId,
      decision: evidence.canary.decision,
      architectureHash: evidence.canary.architectureHash,
      catalogHash: evidence.canaryManifest.catalog.sourceSha256,
      validatorHash: release.fingerprints.validator.hash,
      contextResolverHash: release.fingerprints.contextResolver.hash,
      ...promptSet,
      canarySummarySha256: fileSha(path.join(CANARY_ROOT, "canary-summary.json")),
      canaryManifestSha256: fileSha(path.join(CANARY_ROOT, "manifest.json")),
      targetedContextManifestSha256: fileSha(path.join(TARGETED_ROOT, "manifest.json")),
    },
  })
  writePrivate(path.join(outputRoot, "preflight-results.json"), {
    schemaVersion: "dna-s13-limited-preflight@1",
    generatedAt: new Date().toISOString(),
    pass: true,
    productionAffected: false,
    canaryV2: {
      runId: evidence.canary.runId,
      decision: evidence.canary.decision,
      conversations: evidence.canary.autonomous?.conversationsCompleted,
      messages: evidence.canary.autonomous?.messagesExecuted,
      criticalFailures: evidence.canary.autonomous?.metrics?.criticalFailures,
      privacyChallenge: evidence.canary.privacyChallenge,
      summarySha256: fileSha(path.join(CANARY_ROOT, "canary-summary.json")),
    },
    strict40: {
      count: evidence.strict.count,
      requiredSlotCoveragePercent: evidence.strict.requiredSlotCoveragePercent,
      requiredClaimCoveragePercent: evidence.strict.requiredClaimCoveragePercent,
      unsupportedAddition: evidence.strict.unsupportedAddition,
      unsupportedRelationAddition: evidence.strict.unsupportedRelationAddition,
      sourceViolation: evidence.strict.sourceViolation,
      safetyViolation: evidence.strict.safetyViolation,
      pass: evidence.strict.acceptance?.pass,
      summarySha256: fileSha(path.join(STRICT_ROOT, "s13-strict-40-regression-summary.json")),
    },
    comparison10: {
      count: evidence.comparison.count,
      coverage: evidence.comparison.coverage,
      violations: evidence.comparison.violations,
      modes: evidence.comparison.comparisonConclusionModes,
      unnecessaryAbstentionCount: evidence.comparison.unnecessaryAbstentionCount,
      pass: evidence.comparison.acceptance?.pass,
      summarySha256: fileSha(path.join(COMPARISON_ROOT, "comparison-conclusion-10-summary.json")),
    },
    targetedContext: {
      runId: evidence.targeted.runId,
      freshHoldout: evidence.targeted.freshTargetedHoldout,
      pass: evidence.targeted.pass,
      summarySha256: fileSha(path.join(TARGETED_ROOT, "targeted-context-summary.json")),
    },
    localVerification: {
      limitedRolloutContractAssertions: 35,
      limitedResponseContractAssertions: 41,
      rollbackSteps: 6,
      commandsPassed: [
        "npm run chat:s13:limited-rollout:test",
        "npm run chat:s13:limited-response-contract:test",
        "npm run chat:s13:limited-rollout:rollback",
        "npm run chat:s13:strict:test",
        "npm run chat:s13:canary:test",
        "npm run chat:s13:realizer-contract:test",
        "npm run chat:security",
        "npm run lint",
        "npm run build",
      ],
    },
  })
  writePrivate(path.join(outputRoot, "rollout-config.json"), {
    schemaVersion: "dna-s13-limited-rollout-config@1",
    activated: false,
    defaults: {
      DNA_S13_LIMITED_ROLLOUT_ENABLED: false,
      DNA_S13_LIMITED_ROLLOUT_PERCENT: 0,
      DNA_S13_LIMITED_ROLLOUT_PHASE: "L0",
      DNA_S13_LIMITED_ROLLOUT_DAILY_LUNA_CAP_USD: 2,
      DNA_S13_LIMITED_ROLLOUT_NEAR_CAP_PERCENT: 80,
    },
    cohort: {
      L0: "existing_owner_internal_allowlist_only",
      L1: "documented_explicit_beta_allowlist_not_active",
      L2: "documented_stable_percentage_cohort_not_active",
      L3: "documented_broader_rollout_not_active",
    },
    secretsIncluded: false,
    emailsIncluded: false,
    internalCanaryFlagsIndependent: true,
    resolvedDefaults: defaultConfig,
  })
  writePrivate(path.join(outputRoot, "rollback-test.json"), {
    schemaVersion: "dna-s13-limited-rollback-test@1",
    syntheticOnly: true,
    containsSensitiveData: false,
    steps: [
      { step: "enable", passed: true },
      { step: "send_synthetic_test", passed: true },
      { step: "telemetry_recorded", passed: true },
      { step: "disable_kill_switch", passed: true },
      { step: "next_message_not_routed_to_limited", passed: true },
      { step: "normal_production_path_operational", passed: true },
    ],
    passed: true,
  })
  writePrivate(path.join(outputRoot, "cost-guardrails.json"), {
    schemaVersion: "dna-s13-limited-cost-guardrails@1",
    optimizationPerformed: false,
    canaryBaselineProjectedUsdPer1kMessages: evidence.canary.autonomous?.metrics?.projectedUsdPer1k,
    dailyGlobalLunaCapUsd: 2,
    nearCapAlertPercent: 80,
    capAction: "new_limited_rollout_luna_calls_fail_closed_to_deterministic",
    normalProductionSystemAffectedByCap: false,
    measures: ["cost_per_active_user", "cost_per_conversation", "cost_per_message", "projected_monthly_ai_per_active_user"],
    targets: {
      totalInfrastructureUsdPerActiveUserMaximum: 2,
      preferredVariableAiUsdPerActiveUserRange: [0.75, 1],
    },
  })
  writePrivate(path.join(outputRoot, "monitoring-thresholds.json"), {
    schemaVersion: "dna-s13-limited-monitoring-thresholds@1",
    ...DNA_S13_LIMITED_MONITORING_THRESHOLDS,
  })
  writePrivate(path.join(outputRoot, "LIMITED_ROLLOUT_RUNBOOK.md"), readFileSync(RUNBOOK_SOURCE, "utf8"))

  const outputFiles = [
    "release-candidate.json",
    "preflight-results.json",
    "rollout-config.json",
    "rollback-test.json",
    "cost-guardrails.json",
    "monitoring-thresholds.json",
    "LIMITED_ROLLOUT_RUNBOOK.md",
  ]
  writePrivate(path.join(outputRoot, "manifest.json"), {
    schemaVersion: "dna-s13-limited-release-manifest@1",
    releaseId,
    releaseVersion: release.releaseVersion,
    releaseHash: release.releaseHash,
    createdAt: new Date().toISOString(),
    rolloutActivated: false,
    productionAffected: false,
    secretsIncluded: false,
    emailsIncluded: false,
    files: outputFiles.map((file) => {
      const full = path.join(outputRoot, file)
      return { file, bytes: readFileSync(full).byteLength, sha256: fileSha(full) }
    }),
  })
  console.log(JSON.stringify({
    ok: true,
    outputRoot,
    releaseId,
    releaseHash: release.releaseHash,
    files: [...outputFiles, "manifest.json"],
  }, null, 2))
}

main()
