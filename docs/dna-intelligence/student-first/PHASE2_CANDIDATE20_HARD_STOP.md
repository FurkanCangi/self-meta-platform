# DNA Chat Student-First — Phase 2 candidate 20 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 20 retry: none

Candidate 20 made presentation-only continuation a valid semantic frame. An all-false semantic-act set is accepted only when the turn is history-backed, non-start/non-summary, and `preserveMeaning=true`; the referenced scientific task is inherited rather than inventing a new user task.

## Local evidence — PASS

- Obligation/compiler cases: 18/18
- History-backed presentation-only continuation: PASS
- Non-preserving all-false frame: rejected
- Start-turn all-false frame: rejected
- Resolver contrastive matrix: 31/31
- Provider boundary/repair mocks: PASS
- Adapter/fixture/measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Provider attempts: 8
- Repaired turns: 0
- Input/output tokens: 17,410 / 1,278
- Cached input: 0
- Cost: 25,078 micro-USD (`$0.025078`)
- Average logical-turn latency: 2,560 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 14/40
- Full pass: 9/14 evaluated; 9/40 gate denominator
- Wrong target: 0
- Wrong referent: 0
- Wrong history/action: 1
- Unsafe decision: 0
- Provider attempts: 14
- Repaired turns: 0
- Input/output tokens: 30,513 / 2,255
- Cached input: 2,560
- Cost: 41,739 micro-USD (`$0.041739`)
- Average logical-turn latency: 2,669 ms
- Fixture mutation: false

Non-critical failures before the stop:

1. `STUDENT40-C01-T06`: wrong primary task/obligations/components; targets remained correct.
2. `STUDENT40-C01-T07`: wrong primary task/obligations/components; targets and referent remained correct.
3. `STUDENT40-C02-T03`: one presentation mismatch.
4. `STUDENT40-C02-T04`: `observe` versus `case_reasoning`; answer-driving obligations and all critical dimensions passed.

Critical failure:

- `STUDENT40-C02-T06`: the presentation-only frame was accepted with no repair. Target `working_memory`, referent `STUDENT40-C02-T05`, and `preserve_target_while_simplifying` all passed. The provider classified the style correction as `conversationAction=repair`; the expected action is `continue` because the user changes presentation, not semantic content.

Total provider evidence cost: 66,817 micro-USD (`$0.066817`).

Candidate 20's targeted ontology fix succeeded: T06 no longer fails structured-frame validation and required zero repair attempts.

## Root cause and next branch

Content correction and presentation correction are separate axes, but provider `repair` is still accepted for a preserve-meaning style-only turn. This incorrectly marks conversation history even though target/referent/meaning are unchanged.

The next candidate must make one action/presentation orthogonality intervention:

1. explicit return and summary cues retain current priority;
2. a history-backed `preserveMeaning=true` turn without explicit target rejection/content correction resolves to `continue`;
3. explicit content rejection remains `repair`, even when plain language is also requested;
4. ordinary continuation and genuine repair contrastives must pass;
5. raw message remains ephemeral.

No prompt-only patch, gold edit, threshold change, or retry of candidate 20 is authorized.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: FAIL
- Visible-answer and later gates: blocked
- Best fully passing checkpoint: `79f4ed2`
