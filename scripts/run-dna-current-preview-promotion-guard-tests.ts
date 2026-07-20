import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  DNA_CURRENT_PREVIEW_PROMOTION_GUARD_VERSION,
  DNA_CURRENT_PRODUCTION_RELEASE_GUARD_VERSION,
  evaluateCurrentDnaProductionRelease,
  evaluateCurrentDnaPreviewPromotion,
} from "../src/lib/dna/chat/release/currentPreviewPromotionGuard"

assert.equal(evaluateCurrentDnaPreviewPromotion.length, 0,
  "Action-facing current guard must not accept caller-supplied release state")

const decision = evaluateCurrentDnaPreviewPromotion()
assert.equal(decision.schemaVersion, DNA_CURRENT_PREVIEW_PROMOTION_GUARD_VERSION)
assert.equal(decision.allowed, false,
  "Current release must remain blocked while preview/evidence/attestation are absent")
assert.equal(decision.decision, "blocked")
assert.equal(decision.mutationPerformed, false)
assert.equal(decision.promotionInstruction, null)
assert.ok(decision.blockCodes.includes("current_preview_manifest_missing_or_invalid"))
assert.ok(decision.blockCodes.includes("current_release_evidence_missing_or_invalid"))
assert.ok(decision.blockCodes.includes("current_evaluation_attestation_missing_or_invalid"))
assert.ok(decision.blockCodes.includes("current_release_authority_binding_mismatch"))
assert.ok(decision.blockCodes.includes("current_release_hard_no_go"))

assert.equal(evaluateCurrentDnaProductionRelease.length, 0,
  "Action-facing production guard must not accept caller-supplied release state")
const productionDecision = evaluateCurrentDnaProductionRelease()
assert.equal(productionDecision.schemaVersion, DNA_CURRENT_PRODUCTION_RELEASE_GUARD_VERSION)
assert.equal(productionDecision.released, false)
assert.equal(productionDecision.mutationPerformed, false)
assert.equal(productionDecision.productionDeploymentId, null)
assert.ok(productionDecision.blockCodes.includes("current_preview_promotion_not_authorized"))
assert.ok(productionDecision.blockCodes.includes("current_release_hard_no_go"))

const guardSource = readFileSync(
  "src/lib/dna/chat/release/currentPreviewPromotionGuard.ts",
  "utf8",
)
const checkSource = readFileSync(
  "scripts/run-dna-current-preview-promotion-check.ts",
  "utf8",
)

assert.match(guardSource, /evaluateCurrentDnaV3ReleaseHardNoGo\(\)/)
assert.match(guardSource, /DNA_CURRENT_V3_PREVIEW_VERIFICATION_MANIFEST/)
assert.match(guardSource, /DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE/)
assert.match(guardSource, /DNA_CURRENT_V3_EVALUATION_RELEASE_ATTESTATION/)
assert.match(guardSource, /method: "promote_existing_preview"/)
assert.match(guardSource, /evaluateCurrentDnaProductionRelease/)
assert.match(guardSource, /DNA_CURRENT_V3_PRODUCTION_VERIFICATION_MANIFEST/)
assert.match(guardSource, /DNA_CURRENT_V3_PRODUCTION_EXTERNAL_LIVE_OBSERVATION_ATTESTATION/)
assert.doesNotMatch(guardSource, /releaseHardNoGoAllowed:\s*true/)
assert.doesNotMatch(checkSource, /exec(File|Sync|FileSync|spawn|spawnSync)\s*\(/,
  "Check-only script must not execute a deployment command")
assert.doesNotMatch(checkSource, /vercel\s+(deploy|promote|--prod)/i)
assert.match(checkSource, /check_only_command/)

console.log(JSON.stringify({
  ok: true,
  guardVersion: decision.schemaVersion,
  currentDecision: decision.decision,
  mutationPerformed: decision.mutationPerformed,
  blockCodes: decision.blockCodes,
}, null, 2))
