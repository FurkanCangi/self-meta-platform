import assert from "node:assert/strict"

import {
  resolveDnaS13LimitedRolloutConfig,
  resolveDnaS13LimitedRolloutGate,
} from "../src/lib/dna/chat/s13/limitedRollout/config"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"

const syntheticQuestion = "Sentetik test: Çalışma belleği nedir?"
const telemetry: Array<{ route: string; privacyAllowed: boolean }> = []
let normalProductionCalls = 0

function simulate(config: ReturnType<typeof resolveDnaS13LimitedRolloutConfig>) {
  const gate = resolveDnaS13LimitedRolloutGate({
    config,
    subjectKey: "synthetic-owner",
    trustedOwner: true,
  })
  if (gate.routed) {
    const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: syntheticQuestion })
    telemetry.push({ route: "s13_limited", privacyAllowed: privacy.allowed })
    return "s13_limited"
  }
  normalProductionCalls += 1
  return "normal_production"
}

const enabled = resolveDnaS13LimitedRolloutConfig({
  DNA_S13_LIMITED_ROLLOUT_ENABLED: "true",
  DNA_S13_LIMITED_ROLLOUT_PERCENT: "0",
  DNA_S13_LIMITED_ROLLOUT_PHASE: "L0",
})
const disabled = resolveDnaS13LimitedRolloutConfig({
  DNA_S13_LIMITED_ROLLOUT_ENABLED: "false",
  DNA_S13_LIMITED_ROLLOUT_PERCENT: "0",
  DNA_S13_LIMITED_ROLLOUT_PHASE: "L0",
})

assert.equal(simulate(enabled), "s13_limited")
assert.equal(telemetry.length, 1)
assert.equal(telemetry[0]?.privacyAllowed, true)
assert.equal(simulate(disabled), "normal_production")
assert.equal(normalProductionCalls, 1)

console.log(JSON.stringify({
  schemaVersion: "dna-s13-limited-rollback-test@1",
  syntheticOnly: true,
  containsSensitiveData: false,
  steps: [
    { step: "enable", passed: true },
    { step: "send_synthetic_test", passed: true },
    { step: "telemetry_recorded", passed: telemetry.length === 1 },
    { step: "disable_kill_switch", passed: true },
    { step: "next_message_not_routed_to_limited", passed: normalProductionCalls === 1 },
    { step: "normal_production_path_operational", passed: normalProductionCalls === 1 },
  ],
  passed: true,
}, null, 2))
