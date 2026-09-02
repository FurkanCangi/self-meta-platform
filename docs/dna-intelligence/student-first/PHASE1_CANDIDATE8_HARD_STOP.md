# DNA Chat Student-First — Phase 1 candidate 8 hard stop

Date: 2026-09-02

## Candidate decision

- Candidate: single nullable referent pointer
- Parent commit: `48eadfe`
- Production-path activation: none
- Deployment: none
- Frozen/sealed fixture mutation: none
- Existing key reused; secret value not printed or changed

Candidate 8:

- replaced coupled provider fields `referent.kind + referent.turnId` with one `referentTurnId`;
- derives `none / active / history` locally from pointer position and conversation action;
- continues to derive referent targets and final target sets from semantic state;
- kept Smoke8 questions and expected decisions unchanged.

## Verification

### Local gates — PASS

- TypeScript: PASS
- Provider-boundary mocks: PASS
- Referent/target/frame/obligation compiler: 13/13 PASS
- Latest pointer -> active: PASS
- Return pointer -> history: PASS
- T02 target union: PASS
- Raw error/output persistence: 0

### Candidate 8 synthetic provider preflight — PASS

- Calls: 1
- Structured frame: valid
- Input tokens: 1,623
- Output tokens: 128
- Cost: 2,391 micro-USD (`$0.002391`)
- Latency: 2,730 ms
- Raw output logged: no

### Exact unchanged Smoke8 — FAIL / hard-stop

- `SMOKE8-T01` to `SMOKE8-T03`: PASS
- Failed turn: `SMOKE8-T04`
- Certified failure code: `summary_scope_mismatch`
- Completed correct contracts: 3/8
- Provider calls: 4
- Total Smoke8 usage: 6,963 input / 519 output tokens
- Total Smoke8 cost: 10,077 micro-USD (`$0.010077`)
- Average provider latency: 2,174 ms
- Extra retry: none
- Student40/Fresh60: not run/opened

## Certified root cause

The referent and T02 target-resolution failures are resolved in this candidate. T04 is an observation task, but the provider activated at least one summary-scope boolean. Candidate 8 treats any non-summary summary scope as an invalid frame.

This exposes another responsibility-boundary issue: core answer scope is mostly implied by the semantic task and should not be independently re-decided by provider booleans.

- summarize always requires `known`;
- observe and case_reasoning always require single-observation limit plus additional context;
- optional summary extras matter only for summarize;
- optional observation extras are useful primarily when another task, such as compare, also asks an observation-limit question.

## Next architecture decision

Candidate 9 must make facet scope task-gated:

1. replace `summaryScope` with optional summary extras (`unknown`, `observationFocus`);
2. derive `summaryScope.known=true` locally for summarize and false otherwise;
3. derive both observation duties locally for observe/case_reasoning;
4. accept observation extras only for task combinations where they are meaningful, such as compare;
5. ignore unrelated provider facet flags instead of turning them into obligations or invalidating the frame;
6. run local task/facet matrix tests, one provider preflight, then unchanged Smoke8 once.

Candidate 8 will not be patched or rerun under the same identity.
