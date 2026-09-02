# DNA Chat Student-First — Phase 2 candidate 11 hard stop

Date: 2026-09-02

## Decision

- Gate: `STUDENT40_SEMANTIC_CONTRACT`
- Result: **FAIL / HARD STOP**
- Production activation: none
- Deployment: none
- Frozen or sealed fixture mutation: none
- Fresh Student60 access: none
- Repeated semantic run after failure: none

Candidate 11 added the versioned legacy-to-current Student40 measurement adapter, one capped evaluation runner, a deterministic explicit-target rule for return turns, and an explicit 15-second timeout for the student semantic interpreter. It did not change the Student40 gold, threshold, production routing, or any sealed holdout.

## Local verification

- Obligation/compiler cases: 15/15 PASS
- Student40 adapter: PASS
- Student40 fixture conversations/turns: 5/40
- Student40 fixture SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Required threshold: at least 36/40 full passes
- Critical-error allowance: zero target, referent, history, or safety failures
- Provider boundary mocks: PASS; nine failure classes; zero secret/raw error persistence
- Fixture mutation: false

## Provider infrastructure recovery

The first attempted evaluation ended before any semantic row was evaluated because the shared provider request was aborted by the pre-existing 5-second timeout.

- Evaluated turns: 0
- Provider calls: 1
- Cost: 0 micro-USD
- Failure: `provider_failure/timeout/no_status/no_code`

The student interpreter was given an explicit 15-second timeout while the shared legacy default remains 5 seconds. One capped preflight then passed:

- Calls: 1
- Structured frame: valid
- Input/output tokens: 1,715 / 152
- Cached input tokens: 1,712
- Cost: 1,087 micro-USD (`$0.001087`)
- Latency: 2,873 ms
- Raw output logged: no

## Authoritative Student40 result

The real evaluation stopped at the first critical semantic failure, as required.

- Evaluated turns: 11/40
- Full passes: 8/11 evaluated; 8/40 gate denominator
- Wrong target: 0
- Wrong referent: 1
- Wrong history/action: 0
- Unsafe decision: 0
- Provider calls: 11
- Input/output tokens: 21,339 / 1,709
- Cached input tokens: 2,831
- Cost: 29,046 micro-USD (`$0.029046`)
- Average latency: 3,235 ms
- Raw provider output logged: no
- Fixture mutation: false

Failures before the stop:

1. `STUDENT40-C01-T04`: correct targets, but primary task resolved to `observe` instead of `compare`; comparison obligations were therefore missing.
2. `STUDENT40-C01-T06`: correct targets, but primary task resolved to `case_reasoning` instead of `explain`; per-component obligations were therefore missing.
3. `STUDENT40-C02-T03`: task, targets, example obligations, and presentation were correct, but the implicit example request was not anchored to `STUDENT40-C02-T02`; this is the first critical referent failure.

Total provider evidence cost in this candidate: 30,133 micro-USD (`$0.030133`).

## Root-cause attribution

Two structural defects are evidenced:

1. The fixed primary-task priority promotes `observe` over `compare` and `case_reasoning` over `explain`, even when the student's surface request explicitly asks to compare or explain separate components. This converts correct targets into the wrong answer contract.
2. A context-dependent example turn can inherit the correct active targets without receiving an explicit referent pointer. The compiler therefore produces the right subject but loses the conversation anchor.

This is not evidence of a knowledge, catalog, composer, validator, UI, session, build, privacy, or production-routing defect. Those downstream branches were not reached.

## Next bounded branch

Do not rerun Student40 on candidate 11. The next candidate, if authorized, should make one structural intervention in the request resolver:

- prefer explicit student discourse operators (`compare`, component-wise `explain`, `example`) over contextual clinical framing when both acts are present; and
- deterministically anchor a context-dependent example/explanation to the latest compatible semantic turn when no explicit target or referent is supplied.

The intervention must first pass a small local contrastive matrix covering the three failed patterns and their safety opposites. Only then may Student40 be run once again. Fresh60, Natural Mini24, visible-answer evaluation, Scientific250, Full602, UI, build, provider canary, and deployment remain blocked.

## Best candidate

The last passing architecture checkpoint remains Phase 1 candidate 10 at commit `79f4ed2` (Smoke8 8/8). Candidate 11 is diagnostic evidence, not a promoted product candidate.
