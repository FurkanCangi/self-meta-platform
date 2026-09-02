# DNA Chat Student-First — obligation-support Candidate 2 hard stop

Date: 2026-09-03
Candidate SHA: `c5b1adf`
Status: **FAIL / visible Student40 not opened**

## Bounded provider preflight

- turn: `STUDENT40-C01-T02`;
- provider calls: 1;
- result: `candidate_invalid / obligation_not_visible`;
- raw provider outputs stored: 0;
- exact visible Student40 replay: not run;
- synthetic student and all later gates: blocked.

The turn has no critical clinical-safety obligation, and the structured schema already enforces non-empty support text. Therefore this failure isolates the remaining defect: the provider did not reproduce its obligation-support text verbatim inside the separately generated answer field.

## Root cause

Candidate 2 added typed support but still asked the model to duplicate the same natural-language content across two independent fields and relied on exact cross-field equality. That is an unstable realization contract, not a semantic-quality signal.

The executor returned rejected-candidate provider telemetry internally, but the one-turn preflight failure formatter did not emit that telemetry. The run therefore proves one call and zero raw-output storage, but does not provide a trustworthy token/cost figure. Candidate 3 must make failure telemetry visible in its aggregate report.

## Structural branch selected

Do not expand the substring rule and do not rerun Candidate 2. Candidate 3 may eliminate cross-field text duplication:

1. the provider returns typed visible answer blocks;
2. every block has a unique block ID, text, target IDs, obligation IDs, claim IDs, and policy IDs;
3. the executor constructs the final visible answer only by joining those blocks;
4. obligation support is therefore structural membership in the final answer, not a second copy of prose;
5. local validation rejects missing, duplicate, outside-envelope, and unsupported block references;
6. the secondary semantic judge remains responsible for wrong-but-true and semantic adequacy.

Candidate 3 must pass all local mutations and one exact failure-turn provider preflight before receiving one immutable visible Student40 replay.

No product route, production configuration, deployment, fixture, gold, or threshold was changed.
