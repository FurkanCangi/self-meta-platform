# DNA Chat Student-First — evidence-role Candidate 6 local gate

Date: 2026-09-03
Status: **LOCAL PASS / targeted provider preflight pending**

## Structural intervention

Every locked claim now has one deterministic role:

- `target`: directly names/describes the active target;
- `context`: supports the target topic without naming a competing concept;
- `contrast`: describes the other side of a comparison.

Claims are selected in `target → context → contrast` order rather than source-file order. Example and example-binding slots do not receive contrast claims. Deterministic answer trace metadata also selects a non-contrast claim, and the secondary semantic judge receives the role labels.

This fixes the Candidate 5 defect without deleting or changing source text: the phone-number sentence remains in the owner book, but is classified as short-term-memory contrast evidence rather than a working-memory example.

## Local evidence

- TypeScript compile: PASS;
- answer plans: 40/40;
- every target plan has non-contrast evidence: PASS;
- phone-number claim classified as `contrast`: PASS;
- working-memory definition classified as `target`: PASS;
- contrast claim used for target example mutation rejected: PASS;
- mock answer executions: 40/40;
- provider routes: 31;
- local safety routes: 9;
- evidence-first Student40 contracts: unchanged 40/40;
- student-language metamorphic suite: unchanged 79/79;
- raw outputs stored: 0.

## Next bounded action

Run one provider preflight on `STUDENT40-C02-T07`. It must produce a same-scenario planning/working-memory example without using the phone-number contrast as a working-memory example. Only a PASS may open one immutable Candidate 6 visible Student40 replay.

No source text, product route, production configuration, deployment, fixture, gold, or threshold was changed.
