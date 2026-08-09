import assert from "node:assert/strict"

import {
  DNA_ENGINE_VERSION_ENV,
  resolveDnaTournamentExecutionPlan,
} from "../src/lib/dna/chat/tournament/engineMode"

const missing = resolveDnaTournamentExecutionPlan({})
assert.equal(missing.requestedVersion, "legacy")
assert.equal(missing.publicRuntimeVersion, "legacy")
assert.equal(missing.tournamentShadowEnabled, false)
assert.equal(missing.reason, "default_legacy")

const legacy = resolveDnaTournamentExecutionPlan({ [DNA_ENGINE_VERSION_ENV]: "legacy" })
assert.equal(legacy.requestedVersion, "legacy")
assert.equal(legacy.tournamentShadowEnabled, false)
assert.equal(legacy.fallbackVersion, "legacy")

const tournament = resolveDnaTournamentExecutionPlan({ [DNA_ENGINE_VERSION_ENV]: "tournament" })
assert.equal(tournament.requestedVersion, "tournament")
assert.equal(tournament.publicRuntimeVersion, "legacy")
assert.equal(tournament.tournamentShadowEnabled, true)
assert.equal(tournament.fallbackVersion, "legacy")

const invalid = resolveDnaTournamentExecutionPlan({ [DNA_ENGINE_VERSION_ENV]: "future" })
assert.equal(invalid.requestedVersion, "legacy")
assert.equal(invalid.tournamentShadowEnabled, false)
assert.equal(invalid.reason, "invalid_value_fell_back")

console.log("DNA tournament engine mode: 4/4 PASS")

