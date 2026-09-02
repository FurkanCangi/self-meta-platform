# DNA Chat Student-First — typed-block Candidate 3 hard stop

Date: 2026-09-03
Candidate SHA: `5bff276`
Status: **FAIL / stopped at first critical failure**

## Targeted preflight — PASS

The exact Candidate 1 failure turn `STUDENT40-C01-T02` passed:

- provider calls: 1;
- input tokens: 1,426;
- output tokens: 341;
- cost: 3,472 micro-USD;
- raw outputs stored: 0.

The visible answer correctly distinguished self-control from self-regulation and described self-control as the narrower capacity.

## Exact visible Student40 — FAIL

- fixture SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`;
- fixture changed: no;
- evaluated turns: 2/40;
- PASS turns: 1;
- first failed turn: `STUDENT40-C01-T02`;
- failure: `candidate_invalid / duplicate_contract_reference`;
- composer calls: 2;
- judge calls: 1;
- input tokens: 3,654;
- cached input tokens: 1,423;
- output tokens: 766;
- measured cost: 6,970 micro-USD;
- raw outputs stored: 0.

## Root cause

Candidate 3 made the visible answer deterministic from blocks, but still asked the provider to emit block IDs and set-like target, obligation, claim, and policy ID arrays. The one-turn preflight and exact gate produced different metadata validity on the same turn and immutable SHA. This demonstrates nondeterministic provider-authored metadata rather than a request-contract or frozen-gold defect.

## Final simplification branch

Do not relax duplicate rejection and do not rerun Candidate 3. Candidate 4 may remove provider-authored metadata entirely:

1. generate a fixed schema with one named text slot per ordered obligation;
2. ask the provider to return only Turkish text and illustration kind;
3. attach targets, obligations, locked claims, and policy units deterministically from the execution plan;
4. compose the final answer from the ordered slots;
5. retain target visibility, critical safety, presentation, evidence-envelope, and secondary semantic-judge gates.

This branch removes an unreliable responsibility from the model rather than normalizing or ignoring invalid metadata. If its targeted preflight fails, the answer-executor structural experiment stops for a new architecture decision.

No product route, production configuration, deployment, fixture, gold, or threshold was changed.
