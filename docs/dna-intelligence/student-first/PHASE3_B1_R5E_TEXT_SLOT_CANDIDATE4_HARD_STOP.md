# DNA Chat Student-First — text-slot Candidate 4 hard stop

Date: 2026-09-03
Candidate SHA: `868da0f`
Status: **FAIL / stopped at first critical failure**

## Targeted preflight — PASS

- turn: `STUDENT40-C01-T02`;
- provider calls: 1;
- input tokens: 1,835;
- output tokens: 219;
- cost: 3,149 micro-USD;
- raw outputs stored: 0.

## Exact visible Student40 — FAIL at turn 18

- frozen fixture SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`;
- fixture changed: no;
- evaluated turns: 18/40;
- PASS turns: 17;
- MINOR turns: 0;
- first failed turn: `STUDENT40-C03-T02`;
- failure: `candidate_invalid / target_not_visible`;
- composer calls: 16;
- local safety answers: 2;
- judge calls: 17;
- input tokens: 58,910;
- cached input tokens: 1,832;
- output tokens: 4,782;
- measured cost: 85,954 micro-USD;
- raw outputs stored: 0.

The failed question asks for the teacher-softens-voice example to be explained as co-regulation. The B1 contract correctly resolved `coregulation`, the previous-turn referent, concrete-example presentation, and both example obligations. The request and evidence layers were not the failure.

## Root cause

Candidate 4 removed provider-authored metadata and passed 17 consecutive visible answers. On the eighteenth turn, the provider explained the example without writing a controlled visible alias such as `eş düzenleme` or `ko-regülasyon`. The executor correctly rejected the answer. A prompt instruction alone is therefore not sufficient to guarantee visible target identity.

## Evidence-supported branch

Candidate 5 may move visible target naming into deterministic composition:

1. prepend one controlled, non-scientific target label phrase to the first answer slot;
2. use only active targets from the validated plan;
3. do not add a sentence or alter requested sentence counts;
4. leave provider prose, evidence, safety, obligation, and semantic-judge gates unchanged.

This makes target identity a code-owned invariant rather than another provider compliance request. Candidate 5 must pass a local prefix/target mutation gate and a one-turn provider preflight on `STUDENT40-C03-T02` before one immutable visible Student40 replay.

No product route, production configuration, deployment, fixture, gold, or threshold was changed.
