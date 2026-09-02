# DNA Chat Student-First — Phase 2 candidate 19 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 19 retry: none

Candidate 19 added an ephemeral high-confidence Turkish conversation-action resolver. Explicit return, correction, and session-summary cues override a conflicting provider action; ordinary content remains provider-owned and raw text is never persisted.

## Local evidence — PASS

- Resolver contrastive matrix: 31/31
- Explicit return cue overrides provider `continue`: PASS
- Ordinary “göreve dönüyor” wording does not false-trigger return: PASS
- Explicit repair/summary cues: PASS
- Empty state forces `start`: PASS
- State-v3 entity/utterance and bounded-chain cases: PASS
- Provider boundary/repair mocks: PASS
- Obligation/compiler, adapter, fixture, measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Provider attempts: 8
- Repaired turns: 0
- Input/output tokens: 17,002 / 1,276
- Cached input: 10,084
- Cost: 15,586 micro-USD (`$0.015586`)
- Average logical-turn latency: 2,311 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Stopped turn: `STUDENT40-C02-T06`
- Stop: `invalid_structured_output/invalid_semantic_acts`
- Evaluated contracts: 13/40
- Full pass: 11/13 evaluated; 11/40 gate denominator
- Wrong target/referent/history/safety: 0/0/0/0
- Provider attempts: 15
- Repaired turns: 1
- Input/output tokens: 32,110 / 2,429
- Cached input: 16,413
- Cost: 31,917 micro-USD (`$0.031917`)
- Average logical-turn latency: 3,020 ms
- Fixture mutation: false

Non-critical failures:

1. `STUDENT40-C01-T07`: provider selected component-wise `explain` instead of `observe`; targets/referent/history/safety remained correct.
2. `STUDENT40-C02-T04`: provider selected `observe` instead of `case_reasoning`; answer-driving obligations and critical dimensions passed.

The stop row is a presentation-only simplification request. Both provider attempts returned every semantic-act boolean false. The current validator treats that as invalid even though the request asks only to preserve and restate the preceding meaning in plainer language.

Total provider evidence cost: 47,503 micro-USD (`$0.047503`).

Candidate 19's targeted action fix succeeded: `STUDENT40-C02-T05` passed all critical dimensions and the run reached T06.

## Root cause and next branch

The ontology incorrectly requires at least one new scientific semantic act on every turn. A valid presentation-only continuation (`preserveMeaning=true`, existing history, non-start action) has no new define/explain/compare/etc. act. The bounded repair cannot correct a validity rule that rejects the semantically appropriate all-false frame.

The next candidate must make one ontology intervention:

1. parse all semantic-act booleans even when all are false;
2. allow an all-false set only for a history-backed presentation-only continuation with `preserveMeaning=true`;
3. reject all-false start, ordinary content, and non-preserving turns;
4. compile the continuation against its resolved referent/active target without inventing a new user task;
5. keep one-repair behavior unchanged for genuinely invalid frames.

No prompt-only patch, gold edit, threshold change, or retry of candidate 19 is authorized.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: provider-frame validity FAIL
- Visible-answer and later gates: blocked
- Best fully passing checkpoint: `79f4ed2`
