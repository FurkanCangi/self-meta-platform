# DNA Chat Student-First — visible Student40 Candidate 1 hard stop

Date: 2026-09-02
Candidate SHA: `b7e01d0`
Status: **FAIL / stopped at first critical failure**

## Exact run

- gate: `STUDENT_B1_VISIBLE_STUDENT40`;
- frozen fixture SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`;
- fixture changed: no;
- evaluated turns: 2/40;
- PASS turns: 1;
- first failed turn: `STUDENT40-C01-T02`;
- failure stage: answer executor;
- failure: `candidate_invalid / obligation_not_visible`;
- raw provider outputs stored: 0;
- later gates opened: no.

The failed question asks whether self-control is the same as self-regulation or narrower. Its frozen contract correctly preserved `compare`, both targets, the previous-turn referent, and the two obligations `distinguish_targets` and `explain_relation`. The request resolver and evidence handoff were therefore not the failed layer.

## Root cause

The provider answer envelope could assert a list of satisfied obligation IDs, while the deterministic verifier attempted to infer visible fulfillment from broad regular expressions over the whole answer. It could report only the aggregate `obligation_not_visible` code, not the exact obligation and exact supporting phrase. This is a contract-boundary defect between answer realization and answer verification: machine declarations and visible prose are not joined by typed evidence.

The exact run also exposed incomplete failure telemetry. Provider usage and call count are returned only for accepted candidates, so the rejected second-turn provider call is absent from the aggregate usage. The reported 2,103 input tokens, 347 output tokens, and 4,185 micro-USD therefore cover accepted work only and are not a complete run-cost measurement.

## Authorized structural branch

Candidate 2 may make one bounded structural intervention at the answer-executor boundary:

1. require one typed visible support span for every obligation;
2. verify exact obligation-ID coverage, uniqueness, non-empty support, and verbatim presence in the visible answer;
3. keep deterministic critical safety/presentation checks;
4. leave semantic adequacy to the independent execution judge rather than pretending a whole-answer keyword rule is semantic proof;
5. return provider call/usage telemetry for rejected candidates without storing raw output.

Candidate 2 must pass local missing/duplicate/invisible-support mutations and one compare-turn provider preflight before a new immutable SHA receives one exact Student40 replay. Candidate 1 must not be rerun.

No product route, production configuration, deployment, fixture, gold, or threshold was changed.
