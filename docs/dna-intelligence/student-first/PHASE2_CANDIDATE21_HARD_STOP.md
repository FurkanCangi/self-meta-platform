# DNA Chat Student-First — Phase 2 candidate 21 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: action/presentation orthogonality
- Parent commit: `fba7997`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Student40: not run
- Candidate 21 retry: none

Candidate 21 kept explicit content correction as `repair`, but resolved a history-backed style-only `preserveMeaning` turn as `continue`. Explicit return and summary cues retained priority.

## Local evidence — PASS

- Resolver contrastives: 35/35
- Obligation/compiler cases: 18/18
- Provider boundary and bounded repair mocks: PASS
- Student40 adapter: PASS
- Fixture integrity: PASS
- Measurement invariants: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

## Exact Smoke8 — FAIL

- Correct contracts before stop: 3/8
- Failed turn: `SMOKE8-T04`
- Expected obligations: `state_single_observation_limit`, `name_additional_context`
- Unexpected extra obligation: `give_concrete_example`
- Provider calls: 4
- Input/output tokens: 8,077 / 639
- Cached input tokens: 5,192
- Cost: 7,239 micro-USD (`$0.007239`)
- Average logical-turn latency: 2,603 ms

Input:

> bu örnekte tek gözlemle inhibisyonu zayıf diyebilir miyim başka neye bakarım

The phrase `bu örnekte` refers to the previous example. It does not request another example.

## Root cause

The provider-owned presentation facet does not reliably distinguish a discourse mention of an example from a request to generate a new example. When the provider emits a non-`none` example presentation value, the deterministic obligation compiler unconditionally adds `give_concrete_example`.

The unchanged Smoke8 passed Candidate 20 but failed Candidate 21 before reaching Candidate 21's targeted style-only turn. Candidate 21 does not modify example interpretation. This is therefore also evidence of provider-dependent gate variance, not evidence that Candidate 21 regressed T04 deterministically.

## Process finding

The serial first-failure protocol prevented unsafe promotion, but it converted each newly exposed natural-language distinction into another micro-candidate. Repeated compile/provider/stop cycles produced strong forensic evidence but poor elapsed-time efficiency. No background job was found doing productive work after the last run.

The next development run must not open Candidate 22 as another one-sentence patch. Before another paid gate, it needs one bounded diagnostic batch over the already-open development fixtures that separates:

1. explicit user requests from discourse mentions;
2. stable deterministic failures from provider variance;
3. primary semantic task from optional presentation facets;
4. failures fixable at one shared ownership boundary from unrelated failures.

Only one evidence-supported structural intervention should follow that batch. The unchanged Smoke8 remains the first paid gate.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: blocked at Smoke8
- Visible-answer and later gates: not run
- Best fully passing checkpoint: `79f4ed2`

