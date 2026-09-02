# DNA Chat Student-First — Phase 2 candidate 13 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Production/deployment: none
- Fixture/gold/threshold/prompt changes: none
- Fresh Student60 access: none
- Candidate 13 Student40 retries: none

Candidate 13 replaced the target-free referent fallback with state-compatible referent resolution. An explicit provider pointer still wins; otherwise context-binding tasks can use the latest semantic turn only when current targets are absent or compatible. Explicit unrelated targets remain unbound, and return semantics are unchanged.

## Local evidence — PASS

- Resolver contrastive matrix: 10/10
- Obligation/compiler: 15/15
- Student40 adapter: PASS
- Provider boundary: PASS
- Fixture and measurement integrity: PASS
- Student40 SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

The matrix added positive and negative proofs for a compatible case/observation referent and an unrelated new target that must not inherit prior context.

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Calls: 8
- Input/output tokens: 15,656 / 1,227
- Cached input tokens: 9,180
- Cost: 14,759 micro-USD (`$0.014759`)
- Average latency: 2,461 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

The run stopped at the first critical error.

- Evaluated: 5/40
- Full pass: 4/5 evaluated; 4/40 gate denominator
- Wrong target: 1
- Wrong referent/history/safety: 0/0/0
- Calls: 5
- Input/output tokens: 9,394 / 787
- Cached input tokens: 5,708
- Cost: 8,981 micro-USD (`$0.008981`)
- Average latency: 3,203 ms
- Fixture mutation: false

Failure:

- `STUDENT40-C01-T05`: the request correctly rejected `attention` and retained `self_regulation` plus `recovery`. The provider also supplied the previous comparison as referent. The compiler filtered rejected targets from current mentions, but then reintroduced `attention` while unioning referent targets. Actual targets became `attention`, `self_regulation`, `recovery`.

Total provider evidence cost: 23,740 micro-USD (`$0.023740`).

## Root cause and next branch

Target rejection is implemented as an input-local filter rather than a final request-contract invariant. Any later merge from referent or active state can therefore reintroduce a target explicitly rejected in the current repair turn.

The next candidate must make one structural invariant:

- derive candidate targets from mention/referent/state according to task;
- after all merges, remove every current-turn `rejectedTargetId` from the final target set;
- preserve historical discussion for session summaries; rejection must not erase history;
- prove referent, active-state, compare, repair, and summary contrastive cases locally.

No new validator, gold edit, threshold change, provider prompt patch, or retry of candidate 13 is permitted.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: FAIL
- Downstream visible answer/certification/live gates: blocked
- Best fully passing checkpoint: `79f4ed2`
