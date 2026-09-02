# DNA Chat Student-First — text-slot Candidate 4 local gate

Date: 2026-09-03
Status: **LOCAL PASS / targeted provider preflight pending**

## Final simplification

The provider no longer authors any target, obligation, claim, policy, or block identifier. The response schema contains one fixed named text slot for each ordered obligation plus `illustrationKind`.

The executor attaches all metadata from the already-validated execution plan and composes the visible answer from the slot texts. Provider-created duplicate or outside-envelope IDs are therefore impossible by construction.

The boundary still enforces:

- every required slot exists exactly once;
- visible active-target names;
- target-to-locked-evidence envelope membership;
- critical safety wording in the owning slot;
- example and presentation requirements;
- no internal contract-language leak;
- one provider call per grounded turn;
- rejected-candidate call/token telemetry;
- zero raw-output storage.

## Local evidence

- TypeScript compile: PASS;
- answer plan: 40/40;
- mock text-slot execution: 40/40;
- provider routes: 31;
- local safety routes: 9;
- evidence-first Student40 contracts: 40/40;
- student-language metamorphic suite: 79/79;
- all existing answer-executor mutation checks: PASS;
- provider calls in semantic/local gates: 0.

## Stop condition

Run one targeted provider preflight on `STUDENT40-C01-T02`. If it fails, stop the answer-executor experiment for a new architecture decision. If it passes, the immutable Candidate 4 SHA receives one exact visible Student40 replay.

No product route, production configuration, deployment, fixture, gold, or threshold was changed.
