# DNA Chat Student-First — shared-scenario Candidate 7 hard stop

Date: 2026-09-03
Candidate SHA: `0d52675`
Status: **TARGETED PRODUCT PASS / exact visible Student40 FAIL / stopped at first critical failure**

## Structural intervention

Candidate 7 added one versioned request and execution concept without changing the frozen fixture, gold, or threshold:

- `presentation.exampleScope = shared` for explicit language such as `aynı örnekte`;
- a dedicated `use_shared_scenario` answer obligation;
- deterministic grouping of `give_concrete_example`, `bind_example_to_target`, and `use_shared_scenario` in one answer block;
- rejection of candidates that split those obligations across blocks.

## Local gates — PASS

- TypeScript compile: PASS;
- obligation compiler: 33/33;
- evidence-first core: PASS;
- student-language metamorphic suite: 79/79;
- answer plans: 40/40;
- answer executor: 40/40;
- unchanged Student40 request contracts: 40/40;
- shared-scenario duties grouped in one block: PASS;
- split-shared-scenario mutation rejected: PASS;
- fixture SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`;
- fixture mutated: no.

## Targeted provider preflight — PASS

- turn: `STUDENT40-C02-T07`;
- request: show planning and working memory separately in the same example;
- provider calls: 1;
- input/output tokens: 2,567 / 216;
- cost: 3,863 micro-USD;
- raw outputs stored: 0.

The visible answer used one exam-preparation scenario. It identified planning as choosing and ordering study steps and working memory as retaining and processing information during the same study situation. Both targets and all three example duties were bound to one deterministic block.

## Exact visible Student40 — FAIL at turn 3

- evaluated turns: 3/40;
- PASS turns: 2;
- MINOR turns: 0;
- critical failures: 1;
- first failed turn: `STUDENT40-C01-T03`;
- request: `bunu derste zorlanan bi öğrenci üzerinden minicik örnekle anlat`;
- correct frozen contract: example, targets `self_regulation` and `self_control`, concrete/brief presentation, obligations `give_concrete_example` and `bind_example_to_target`;
- failure stage: answer executor before secondary semantic judging;
- failure: `candidate_invalid / obligation_not_visible`;
- composer calls: 3;
- judge calls: 2;
- input/output tokens: 7,896 / 820;
- measured cost: 12,816 micro-USD;
- raw outputs stored: 0.

## Root cause

For this turn, only `give_concrete_example` can produce `obligation_not_visible`: its local check requires a small lexical cue set such as `örnek`, `örneğin`, `mesela`, `varsay`, or `düşün` inside the designated block. `bind_example_to_target` currently has no lexical visibility condition. The provider therefore produced a candidate whose example block did not contain a recognized cue, and the answer was rejected before the independent semantic judge could assess whether the prose actually executed the example request.

The exact rejected prose was not stored by design, so the report does not invent or reconstruct it. The evidence proves a brittle provider-to-lexical-gate boundary; it does not prove that the hidden prose was semantically good or bad.

## Independent integration finding

The legacy S13 visible-handoff diagnostic also stopped at `STUDENT40-C01-T06` with `dna_s13_limited_telemetry_invalid`. The B1 handoff supplied three correct active topics, while the legacy limited-rollout telemetry schema accepts at most two routing topic IDs. Targets, action, and validator output were correct before telemetry validation. This is a later runtime-parity blocker, not the cause of the Candidate 7 visible-answer failure.

## Global stop

Candidate 7 must not be rerun. Do not relax the lexical check, add another regex, change the fixture, lower the threshold, or bypass the independent judge. The next architecture decision must move example realization evidence out of provider-chosen lexical markers and into a deterministic typed composition boundary, then separately reconcile multi-target B1 handoffs with limited-rollout telemetry.

The synthetic one-hour student simulation, Frozen Mini24, Fresh Student60, Scientific250, Full602, fresh holdout, provider canary, build/UI, and production remain blocked and were not opened.

No product route, production configuration, deployment, fixture, gold, threshold, or owner-book source text was changed.
