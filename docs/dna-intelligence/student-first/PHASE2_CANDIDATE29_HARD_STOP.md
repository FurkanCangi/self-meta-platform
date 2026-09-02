# DNA Chat Student-First — Phase 2 candidate 29 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: action-aware focus grounding
- Parent commit: `c79258d`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Candidate 29 retry: none

Candidate 29 limits behavior-derived focus demotion to ordinary `continue` context-binding turns. `repair`, `return`, `start`, and `summarize_session` preserve the provider-interpreted focus. This corrects Candidate 28's overreach without adding Turkish behavior-phrase exceptions.

## Local gates — PASS

- Provider focus-action matrix: PASS for `continue`, `repair`, `return`, `start`, and `summarize_session`
- Candidate 28 ordinary-continuation demotion: PASS
- Candidate 28 explicit scientific focus: PASS
- Candidate 28 repair replacement focus: PASS (`self_regulation`, `recovery` preserved)
- Obligation compiler: 33/33
- Action-compatibility matrix: 8/8
- Resolver contrastives: 42/42
- Provider boundary, bounded repair, and bounded transport retry: PASS
- Adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

## Exact unchanged Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Semantic repairs: 0
- Transport retries: 0
- Partial-usage turns: 0
- Input/output tokens: 20,328 / 1,314
- Cached input tokens: 13,020
- Cost: 16,497 micro-USD (`$0.016497`)
- Average latency: 2,601 ms
- Raw messages persisted: 0

The first sandboxed command could not access the provider network and returned `network_error` with zero reported token usage. It is an infrastructure pre-execution failure, not an authoritative candidate measurement. The unchanged command was then run once with network permission and produced the result above.

## Authoritative Student40 — FAIL

- Evaluated: 20/40
- Full passes: 15/20 evaluated; 15/40 gate denominator
- Wrong target: 0
- Wrong referent: 1
- Wrong history/safety: 0/0
- Provider calls: 20
- Semantic repairs: 0
- Transport retries: 0
- Partial-usage turns: 0
- Input/output tokens: 50,790 / 3,347
- Cached input tokens: 19,508
- Cost: 53,320 micro-USD (`$0.053320`)
- Average latency: 2,776 ms
- Fixture mutated: false

Total authoritative Candidate 29 provider evidence cost: 69,817 micro-USD (`$0.069817`).

Non-critical failures before the stop:

1. `STUDENT40-C01-T06`: component-wise explanation was classified as `compare`; targets were correct.
2. `STUDENT40-C02-T03`: task, targets, referent, and obligations passed; presentation differed.
3. `STUDENT40-C02-T04`: `observe` instead of `case_reasoning`; answer-driving obligations and critical dimensions passed.
4. `STUDENT40-C02-T07`: example was selected instead of comparison-plus-example; targets were correct, comparison obligations were missing.

Critical stop:

- Turn: `STUDENT40-C03-T04`
- Input: “yani eş düzenleme her durumda iyi diyemeyiz dimi bağlama göre mi”
- Expected: `explain`, target `coregulation`, referent `STUDENT40-C03-T03`
- Actual: `explain`, target `coregulation`, referent `null`
- Obligations, action, target, history, and safety: PASS

## Root cause

The compatible-referent fallback is task-class incomplete. It binds example, case, observation, comparison, and preserve-meaning turns, but excludes a same-target explanatory continuation. The provider correctly extracted the target and task yet omitted the pointer; the compiler had no discourse-continuation rule capable of recovering it.

This is not a target-grounding regression: Candidate 29 fixed both previously observed focus errors. It is also not evidence of a catalog, retrieval, composer, visible-answer, UI, session, privacy, build, or production defect because those downstream stages were not reached.

## Selected next branch

Do not rerun or patch Candidate 29. Candidate 30 should make referent recovery task-complete for compatible discourse continuation:

1. explicit valid provider pointer remains authoritative;
2. a `continue` explanation whose non-empty focus is fully compatible with the immediately previous turn may inherit that latest turn as an utterance referent;
3. unrelated or newly introduced targets must not inherit a referent;
4. `repair`, `return`, `start`, and `summarize_session` retain their current action-specific behavior;
5. context-binding case/entity rules remain unchanged;
6. local positive and negative contrastives must pass before exact Smoke8 and one Student40 run.

This is one resolver-policy intervention, not a phrase list, validator layer, gold edit, or threshold change.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local + Smoke8: PASS
- Phase 2 Student40: FAIL at 20/40
- Frozen Mini24 / Fresh60 / visible-answer / later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`
