# DNA Chat Student-First — target-ownership Candidate 5 hard stop

Date: 2026-09-03
Candidate SHA: `0588cbf`
Status: **FAIL / stopped at first critical semantic failure**

## Targeted preflight — PASS

- turn: `STUDENT40-C03-T02`;
- provider calls: 1;
- input tokens: 1,200;
- cached input tokens: 1,197;
- output tokens: 110;
- cost: 783 micro-USD;
- raw outputs stored: 0.

## Exact visible Student40 — FAIL at turn 15

- frozen fixture SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`;
- fixture changed: no;
- evaluated turns: 15/40;
- PASS turns: 14;
- MINOR turns: 0;
- first failed turn: `STUDENT40-C02-T07`;
- failure stage: secondary semantic execution judge;
- failure: `UNSUPPORTED_SCIENCE`;
- composer calls: 13;
- local safety answers: 2;
- judge calls: 15;
- input tokens: 52,956;
- cached input tokens: 22,460;
- output tokens: 4,145;
- measured cost: 57,612 micro-USD;
- raw outputs stored: 0.

All four requested obligations were judged satisfied or supported by an explicit limitation. The critical failure was scientific binding: the answer presented keeping a phone number briefly in mind as a working-memory example.

## Root cause

The locked owner-book topic explicitly states that keeping a phone number for a few seconds is an example of short-term memory, while working memory requires preserving information while also processing or updating it. The answer executor packaged all claims under the working-memory comparison topic as if they were interchangeable positive evidence for working memory.

The missing layer is claim role/polarity. A source sentence may be true and correctly retrieved yet still be contrast evidence rather than support for the active target. Claim-ID membership alone cannot prevent a wrong-but-true target binding.

## Structural branch selected

Candidate 6 may add deterministic evidence roles:

- `target`: directly describes the active target;
- `context`: supports the topic without naming a competing concept;
- `contrast`: describes the other side of a comparison and cannot support a positive target example.

Example and target-binding slots must not receive `contrast` claims. Deterministic trace metadata must select a non-contrast claim. The secondary judge must receive the role labels. Local tests must prove that the phone-number claim is `contrast` for working memory and that the actual working-memory definition remains available.

No product route, production configuration, deployment, fixture, gold, or threshold was changed. Synthetic student and all later gates remain blocked.
