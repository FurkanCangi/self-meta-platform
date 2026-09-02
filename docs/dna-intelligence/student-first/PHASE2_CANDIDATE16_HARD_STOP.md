# DNA Chat Student-First — Phase 2 candidate 16 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Production/deployment: none
- Gold/fixture/threshold/prompt mutation: none
- Fresh Student60 access: none
- Candidate 16 retry: none

Candidate 16 made return target binding action-first. A return with explicit allowed targets now uses only those targets; a target-free return inherits its referenced turn. Comparison-side union applies only to non-return turns.

## Local evidence — PASS

- Resolver contrastive matrix: 18/18
- Obligation/compiler: 15/15
- Adapter/provider-boundary/fixture/measurement gates: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Calls: 8
- Input/output tokens: 15,656 / 1,227
- Cached input: 9,180
- Cost: 14,759 micro-USD (`$0.014759`)
- Average latency: 2,223 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Stopped turn: `STUDENT40-C02-T06`
- Stop reason: `invalid_structured_output/invalid_semantic_acts`
- Evaluated semantic contracts: 13/40
- Full pass: 11/13 evaluated; 11/40 gate denominator
- Wrong target/referent/history/safety: 0/0/0/0
- Provider calls: 14
- Input/output tokens: 27,452 / 2,165
- Cached input: 14,944
- Cost: 26,998 micro-USD (`$0.026998`)
- Average latency: 2,545 ms
- Fixture mutation: false

Non-critical failures before provider stop:

1. `STUDENT40-C01-T06`: provider selected `compare` instead of component-wise `explain`; targets were correct.
2. `STUDENT40-C02-T04`: provider selected `observe` instead of `case_reasoning`; targets, referent, obligations, history, and safety were correct.

The stop row returned all semantic-act booleans false. It satisfied the JSON field shape but violated the runtime invariant requiring at least one semantic act. No contract was compiled for that row.

Total provider evidence cost: 41,757 micro-USD (`$0.041757`).

Candidate 16's targeted return fix passed: `STUDENT40-C02-T05` no longer leaked referent targets.

## Root cause and next branch

The Phase 2 architecture permits at most one correction attempt, but the current student interpreter performs zero repairs. A structurally shaped yet semantically invalid provider frame immediately terminates the candidate.

The next candidate must add one bounded structured repair:

1. first provider result is validated locally;
2. only a typed frame-validation failure may trigger one repair call;
3. repair input contains the original privacy-safe request context and safe failure code, not raw provider output;
4. a second invalid result or provider failure hard-stops;
5. attempts, aggregate usage, latency, and cost remain observable and capped;
6. no answer validator, semantic gold edit, threshold change, or unconstrained retry is allowed.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: provider-structure FAIL
- Later gates: blocked
- Best fully passing checkpoint: `79f4ed2`
