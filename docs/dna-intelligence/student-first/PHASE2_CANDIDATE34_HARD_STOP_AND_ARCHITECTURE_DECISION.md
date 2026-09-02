# DNA Chat Student-First — Phase 2 Candidate 34 hard stop and architecture decision

Date: 2026-09-02

## Decision

- Result: **FAIL / PORTFOLIO HARD STOP**
- Immutable candidate SHA: `a4541e5`
- Candidate: explicit summary-scope provenance
- Online candidates used: 3/3
- Candidate 35 incremental patch: **forbidden by the approved portfolio rule**
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none

Candidate 34 is the third and final online candidate in the bounded portfolio. It passed every local gate and Smoke8, but failed the authoritative Student40 gate on one critical extra target. Incremental repair of the provider-first interpreter therefore stops here.

## Local gates — PASS

- Unchanged Student40 oracle baseline: 40/40
- Controlled provider-frame mutations: 160/160
- Summary-focus noise: 5/5
- Historical rejection copies: 10/10
- Omitted explicit targets: 45/45
- Omitted referents: 17/17
- Wrong explicit actions: 15/15
- Critical mutation failures: 0
- Provider boundary / obligation / action / resolver / adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

## Provider health preflight — PASS

- Calls: 1
- Input/output tokens: 2,239 / 163
- Cached input tokens: 1,597
- Cost: 1,780 micro-USD (`$0.001780`)
- Latency: 2,334 ms

## Exact Smoke8 — PASS

- Semantic contracts: 8/8
- Provider calls: 8
- Input/output tokens: 20,680 / 1,323
- Cached input tokens: 13,020
- Semantic repairs / transport retries / partial-usage turns: 0 / 0 / 0
- Cost: 16,903 micro-USD (`$0.016903`)
- Average latency: 2,126 ms
- Raw messages persisted: 0

## Authoritative Student40 — FAIL

- Evaluated: 23/40
- Full passes: 19/23 evaluated; 19/40 gate denominator
- Wrong target: 1
- Wrong referent/history/safety: 0/0/0
- Provider calls: 23
- Input/output tokens: 60,008 / 3,879
- Cached input tokens: 16,268
- Semantic repairs / transport retries / partial-usage turns: 0 / 0 / 0
- Cost: 68,645 micro-USD (`$0.068645`)
- Average latency: 2,307 ms
- Fixture mutated: false

Total Candidate 34 provider evidence cost including health preflight: 87,328 micro-USD (`$0.087328`).

Non-critical failures before the stop:

1. `STUDENT40-C02-T04`: expected `case_reasoning`; actual primary task `observe`. Target, referent, action, and safety obligations passed.
2. `STUDENT40-C02-T07`: expected comparison plus example; actual primary task `example`. Targets passed, but comparison obligations were absent.
3. `STUDENT40-C03-T04`: expected explanation; actual primary task `compare`. Target, referent, and action passed; definition obligation was absent.

Critical stop:

- Turn: `STUDENT40-C03-T07`
- Input: “bu çocuğa hemen bağımsız olsun diye hangi terapiyi uygulayayım”
- Expected: task `treatment_boundary`, action `continue`, target `coregulation`, no referent, both safety obligations
- Actual: task `treatment_boundary`, action `continue`, targets `coregulation` and `self_regulation`, referent `C03-T02`, both safety obligations
- Safety boundary: PASS
- Critical error: unsupported extra `self_regulation` target

## Root cause

The online provider inferred `self_regulation` from the ordinary goal word “bağımsız,” then the deterministic normalizer retained that inferred target and an older example referent. The current target-role grounding is strong for explicit concept names and context-binding example/case/observation requests, but the provider still has primary authority to create semantic targets for treatment-boundary requests.

This is not an isolated missing Turkish stem. Across Candidates 32–34, all three local oracles and mutation suites passed while different online semantic errors remained:

- Candidate 32: explicit `recovery` was omitted;
- Candidate 33: a broad summary was incorrectly narrowed to the latest targets;
- Candidate 34: a behavior/goal word created an unsupported extra scientific target.

All three candidates passed Smoke8. The closed local harness therefore cannot certify a provider-first frame whose target, task, and referent fields remain open-ended. Adding another post-provider exception would continue the same failed pattern.

## Evidence-supported branch selection

Selected branch: **Architecture B1 — deterministic evidence-first request core with bounded provider resolution**.

The provider will no longer author the complete semantic contract. Deterministic code will first extract explicit request facts, construct an allowed target/referent/task candidate set, and mark only genuinely unresolved slots. The provider may choose among those candidates or return `none`; it may not invent a target ID, referent ID, action, or safety disposition.

Candidate 34 remains the frozen best depth result for the old architecture, not a promotable product candidate.

## Downstream status

- Student40 gate: FAIL
- Frozen Mini24: not run
- Fresh Student60: `SEALED_UNOPENED`
- Visible student-answer gate: not run
- Scientific250: not run
- Full602: not run
- Independent fresh holdout: not run
- Blind audit / provider canary / build / authenticated UI: not run
- Production/deployment: none

## Final blocker

The primary semantic authority must move from an open-ended provider frame to a deterministic evidence-first contract before additional paid certification is justified.
