# DNA Chat Student-First — typed-block Candidate 3 local gate

Date: 2026-09-03
Status: **LOCAL PASS / targeted provider preflight pending**

## Structural reset

Candidate 3 removes the separate provider-generated answer and support-text fields. The provider now returns only typed visible blocks. The executor deterministically constructs the final answer by joining those block texts in order.

Each block carries:

- a bounded block ID;
- visible Turkish text;
- active target IDs;
- obligation IDs;
- locked claim IDs;
- policy-unit IDs.

Every obligation must occur exactly once across the blocks. Every active target must be named visibly and linked in a block to one of its locked claims. The final answer cannot diverge from its support blocks because it is derived from them rather than generated independently.

## Local evidence

- TypeScript compile: PASS;
- answer plan: 40/40;
- typed-block answer execution with mock provider: 40/40;
- provider routes: 31;
- local safety routes: 9;
- missing/duplicate obligation-block references rejected: yes;
- unbound obligation block rejected: yes;
- wrong target, invisible target, and invented claim rejected: yes;
- rejected-candidate call/token telemetry preserved: yes;
- Student40 request contracts: 40/40;
- student-language metamorphic suite: 79/79;
- raw provider outputs stored: 0.

## Next bounded action

Run one real-provider preflight on `STUDENT40-C01-T02`. The preflight now emits provider telemetry even when the candidate is rejected. Only a PASS may open one exact visible Student40 replay on an immutable Candidate 3 SHA.

No product route, production configuration, deployment, fixture, gold, or threshold was changed.
