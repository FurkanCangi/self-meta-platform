# DNA Chat Student-First — evidence-role Candidate 6 hard stop

Date: 2026-09-03
Candidate SHA: `49ca31c`
Status: **STRUCTURAL PREFLIGHT PASS / PRODUCT-SEMANTIC FAIL / full Student40 not opened**

## Targeted provider preflight

- turn: `STUDENT40-C02-T07`;
- request: show planning and working memory separately in the same example;
- provider calls: 1;
- input tokens: 3,057;
- output tokens: 192;
- cost: 4,209 micro-USD;
- raw outputs stored: 0.

Evidence-role invariants passed:

- the phone-number short-term-memory contrast was not used;
- working-memory target evidence remained available;
- target names and four existing obligations were structurally present;
- no contrast claim was attached to the example slots.

## Product-semantic failure

The visible answer used two different scenarios:

- planning: ordering transportation, accommodation, and activity steps for a trip;
- working memory: keeping numbers in mind and reversing them.

The student explicitly asked for both concepts to be shown separately **inside the same example**. Therefore the answer did not fully execute the natural-language request even though the current deterministic preflight passed.

## Root cause

The B1 request contract represents this turn as `compare` plus `give_concrete_example` and `bind_example_to_target`. It has no field or obligation for shared-scenario composition. The secondary judge schema likewise cannot identify this missing condition from an explicit contract requirement. The missing authority is upstream in request/obligation compilation, not in retrieval or answer formatting.

## Global stop and next phase

Candidate 6 must not receive a full Student40 replay. Do not patch the answer prompt to say “same example” and do not relax the judge.

The next authorized phase must add one versioned structural concept:

1. detect explicit shared-scenario language such as `aynı örnekte`, `tek örnek içinde`, and ordinary Turkish variants;
2. represent it in the request contract without changing frozen questions or gold;
3. compile a dedicated `use_shared_scenario` answer obligation;
4. bind both requested targets to the same scenario block;
5. add positive/negative/metamorphic local tests;
6. rerun the exact failure-turn provider preflight only after local gates pass;
7. only then open a new immutable visible Student40 candidate.

The one-hour synthetic student simulation, Mini24, Fresh60, Scientific250, Full602, holdout, canary, build/UI, and production remain blocked.

No source text, product route, production configuration, deployment, fixture, gold, or threshold was changed.
