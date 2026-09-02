# DNA Chat Student-First — Phase 2 candidate 18 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 18 retry: none

Candidate 18 introduced conversation-state v3 and request-contract v5. Referents now distinguish `utterance` from `case_entity`, every semantic-history snapshot preserves its resolved referent, and a bounded local chain can resolve an observation-about-a-child back to the example turn that introduced that child.

## Local evidence — PASS

- Resolver contrastive matrix: 25/25
- Entity chain collapse to example anchor: PASS
- Utterance return remains on last statement: PASS
- Unrelated case cannot inherit entity: PASS
- History remains bounded to 8 turns: PASS
- Truncated parent cannot create dangling pointer: PASS
- Raw messages persisted: 0
- Provider boundary and one-repair mocks: PASS
- Obligation/compiler: 15/15
- Adapter/fixture/measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh60: `SEALED_UNOPENED`

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Referent roles checked: utterance/entity/history cases
- Provider attempts: 8
- Repaired turns: 0
- Input/output tokens: 17,002 / 1,277
- Cached input: 0
- Cost: 24,664 micro-USD (`$0.024664`)
- Average logical-turn latency: 3,333 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 13/40
- Full pass: 9/13 evaluated; 9/40 gate denominator
- Wrong target: 1
- Wrong referent: 0
- Wrong history/action: 1
- Unsafe decision: 0
- Provider attempts: 14
- Repaired turns: 1
- Input/output tokens: 29,782 / 2,258
- Cached input: 2,458
- Cost: 41,118 micro-USD (`$0.041118`)
- Average logical-turn latency: 3,216 ms
- Fixture mutation: false

Non-critical failures before the stop:

1. `STUDENT40-C01-T06`: `compare` instead of component-wise `explain`; targets correct.
2. `STUDENT40-C02-T03`: one presentation mismatch; task, targets, referent, and obligations correct.
3. `STUDENT40-C02-T04`: `observe` instead of `case_reasoning`; answer-driving obligations and critical dimensions correct.

Critical failure:

- `STUDENT40-C02-T05`: the entity architecture correctly resolved the referent to `STUDENT40-C02-T03`, but the provider returned `conversationAction=continue` despite the explicit Turkish return cue “dönelim.” Because the action was not `return`, the normal compare branch merged prior targets and omitted `use_history_anchor`.

Total provider evidence cost: 65,782 micro-USD (`$0.065782`).

Candidate 18's targeted architecture succeeded on the previously failing dimension: wrong referent count is zero and T05 points to T03. The bounded repair path was also exercised once and allowed the run to continue.

## Root cause and next branch

High-confidence conversation movements (`return`, `repair`, `summarize_session`) remain provider-only. A stochastic provider action can therefore bypass otherwise correct deterministic target and obligation rules.

The next candidate must make one hybrid conversation-action intervention:

1. explicit Turkish return cues such as “dönelim,” “ilk anlattığın,” and “başa dönelim” deterministically resolve to `return`;
2. explicit correction cues resolve to `repair`;
3. explicit session-summary cues resolve to `summarize_session`;
4. otherwise the validated provider action remains authoritative;
5. raw text is used ephemerally and never persisted;
6. positive and negative contrastive cases must pass before Smoke8 and one Student40 run.

No new answer validator, gold edit, threshold change, or retry of candidate 18 is authorized.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 semantic Student40: FAIL
- Visible-answer and later gates: blocked
- Best fully passing checkpoint: `79f4ed2`
