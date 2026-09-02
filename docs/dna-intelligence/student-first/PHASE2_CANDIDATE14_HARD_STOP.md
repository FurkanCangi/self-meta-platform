# DNA Chat Student-First — Phase 2 candidate 14 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Production/deployment: none
- Gold/fixture/threshold/prompt mutation: none
- Fresh Student60 access: none
- Candidate 14 retry: none

Candidate 14 added one post-merge target invariant: a target rejected in the current turn cannot re-enter through referent or active-state union. Session summaries still retain historically discussed targets.

## Local evidence — PASS

- Resolver contrastive matrix: 12/12
- Obligation/compiler: 15/15
- Adapter/provider-boundary/fixture/measurement gates: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

The new matrix proved both sides: rejected targets cannot re-enter through a referenced comparison, while the same historically discussed target remains available to a later session summary.

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Calls: 8
- Input/output tokens: 15,656 / 1,230
- Cached input: 9,180
- Cost: 14,777 micro-USD (`$0.014777`)
- Average latency: 2,086 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 10/40
- Full pass: 9/10 evaluated; 9/40 gate denominator
- Wrong target: 0
- Wrong referent: 1
- Wrong history/safety: 0/0
- Calls: 10
- Input/output tokens: 19,473 / 1,555
- Cached input: 11,488
- Cost: 18,468 micro-USD (`$0.018468`)
- Average latency: 3,770 ms
- Fixture mutation: false

Failure:

- `STUDENT40-C02-T02`: the system correctly produced the `compare` task, both targets (`executive_functions`, `inhibition`), and both comparison obligations. The provider omitted the pointer to the immediately preceding definition, so the contract referent was `null` instead of `STUDENT40-C02-T01`.

Total provider evidence cost: 33,245 micro-USD (`$0.033245`).

Candidate 14's targeted repair passed: `STUDENT40-C01-T05` no longer reintroduced rejected `attention`.

## Root cause and next branch

Compare turns are excluded from local compatible-referent recovery, and comparison target derivation always unions referenced targets. Those two responsibilities must be separated:

1. A compare request may infer the latest turn as conversational referent when the current message supplies one target, or supplies a complete target pair overlapping the latest turn.
2. If two or more explicit comparison targets are already present, they are complete and must not be expanded with every referent target.
3. If only one comparison target is explicit, the referent supplies the missing comparison side.
4. A completely unrelated explicit pair must not inherit an old referent.

The next candidate must prove these contrastive cases locally before Smoke8 and one Student40 run. Candidate 14 must not be rerun.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: FAIL
- Later gates: blocked
- Best fully passing checkpoint: `79f4ed2`
