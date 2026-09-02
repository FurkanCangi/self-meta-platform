# DNA Chat Student-First — Phase 2 candidate 15 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Production/deployment: none
- Gold/fixture/threshold/prompt mutation: none
- Fresh Student60 access: none
- Candidate 15 retry: none

Candidate 15 separated comparison referent anchoring from comparison target completion. A one-sided comparison can obtain its missing side from the latest referent; a complete explicit pair is not expanded by referent targets; an unrelated pair remains unbound.

## Local evidence — PASS

- Resolver contrastive matrix: 16/16
- Obligation/compiler: 15/15
- Adapter/provider-boundary/fixture/measurement gates: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Calls: 8
- Input/output tokens: 15,656 / 1,226
- Cached input: 9,180
- Cost: 14,753 micro-USD (`$0.014753`)
- Average latency: 3,080 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 13/40
- Full pass: 11/13 evaluated; 11/40 gate denominator
- Wrong target: 1
- Wrong referent/history/safety: 0/0/0
- Calls: 13
- Input/output tokens: 25,346 / 2,020
- Cached input: 13,784
- Cost: 25,066 micro-USD (`$0.025066`)
- Average latency: 2,946 ms
- Fixture mutation: false

Failures:

1. `STUDENT40-C02-T04`: non-critical task-label mismatch (`observe` instead of `case_reasoning`); targets, referent, obligations, history, and safety passed.
2. `STUDENT40-C02-T05`: critical target error on a return turn. `conversationAction=return`, referent `STUDENT40-C02-T03`, and explicit current target `working_memory` were correct, but primary task `compare` was evaluated before the return-target branch. Referent targets (`executive_functions`, `inhibition`) leaked into the final target set.

Total provider evidence cost: 39,819 micro-USD (`$0.039819`).

Candidate 15's targeted compare-referent repair passed: `STUDENT40-C02-T02` now had the correct referent.

## Root cause and next branch

Conversation action and semantic task are independent axes, but target derivation gives `compare` precedence over `return`. A history return may point to an entity/example while the current message explicitly names a new semantic target. In that case the referent anchors the conversation but must not contribute its semantic targets.

The next candidate must make one action-first target-binding intervention:

1. session summary remains history-wide;
2. return with explicit allowed targets uses only those targets;
3. return without explicit targets inherits referent targets;
4. only non-return compare turns use comparison-side completion/union;
5. ordinary compare and history-return contrastive cases must both remain green.

No prompt patch, validator, gold edit, threshold change, or retry of candidate 15 is permitted.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: FAIL
- Later gates: blocked
- Best fully passing checkpoint: `79f4ed2`
