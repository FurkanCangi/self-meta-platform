# DNA Chat Student-First — obligation-support Candidate 2 local gate

Date: 2026-09-03
Status: **LOCAL PASS / targeted provider preflight pending**

## One structural intervention

The answer-executor envelope now replaces the ungrounded `satisfiedObligationIds` declaration with one typed `obligationSupport` record per obligation. Each record carries the exact obligation ID and a short text span that must occur verbatim in the visible answer.

The deterministic boundary verifies:

- exact obligation-ID coverage;
- duplicate obligation IDs;
- empty or oversized support;
- support absent from the visible answer;
- critical safety-policy wording;
- exact target visibility, locked-claim membership, presentation, and policy coverage.

Semantic adequacy remains the responsibility of the separate execution judge. The executor no longer treats broad whole-answer keyword matching as proof that comparison or relation duties were fulfilled.

Rejected provider candidates now return call count, response ID, token usage, latency, and the `rawOutputStored: false` invariant. This closes the Candidate 1 cost-accounting gap without persisting raw provider output.

## Local evidence

- TypeScript compile: PASS;
- answer plans: 40/40;
- answer executions with mock provider: 40/40;
- grounded provider route: 31;
- local safety route: 9;
- missing obligation support rejected: yes;
- duplicate obligation support rejected: yes;
- invisible obligation support rejected: yes;
- wrong target and invented claim rejected: yes;
- Student40 evidence-first contracts: 40/40;
- metamorphic student-language suite: 79/79;
- provider calls in semantic/local gates: 0;
- raw outputs stored: 0.

## Next bounded action

Run one real-provider preflight on the exact Candidate 1 failure turn `STUDENT40-C01-T02`. Only a PASS may open one exact visible Student40 replay on the immutable Candidate 2 SHA.

No product route, production configuration, deployment, fixture, gold, or threshold was changed.
