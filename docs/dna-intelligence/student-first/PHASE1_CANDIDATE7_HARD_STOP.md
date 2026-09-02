# DNA Chat Student-First — Phase 1 candidate 7 hard stop

Date: 2026-09-02

## Candidate decision

- Candidate: current-message target mentions plus state-aware target resolution
- Parent commit: `39e6498`
- Production-path activation: none
- Deployment: none
- Frozen/sealed fixture mutation: none
- Existing key reused; secret value not printed or changed

Candidate 7:

- reduced provider target responsibility to current-message `mentionedTargetIds`;
- stopped asking the provider to return final target or comparison sets;
- reads referent targets from validated semantic history locally;
- derives compare targets from referent + current mentions;
- derives summary targets from conversation history;
- resolves rejected, return, and active targets locally.

## Verification

### Local gates — PASS

- TypeScript: PASS
- Provider-boundary mocks: PASS
- Target resolver / frame / obligation compiler: 13/13 PASS
- T02 active-referent comparison merge: PASS
- Rejected-target removal: PASS
- History return: PASS
- Session-summary target union: PASS
- Raw error/output persistence: 0

### Candidate 7 synthetic provider preflight — PASS

- Calls: 1
- Structured frame: valid
- Input tokens: 1,605
- Output tokens: 133
- Cost: 2,403 micro-USD (`$0.002403`)
- Latency: 4,822 ms
- Raw output logged: no

### Exact unchanged Smoke8 — FAIL / hard-stop

- `SMOKE8-T01`: PASS
- Failed turn: `SMOKE8-T02`
- Certified failure code: `invalid_referent`
- Completed correct contracts: 1/8
- Provider calls: 2
- Total Smoke8 usage: 3,301 input / 266 output tokens
- Total Smoke8 cost: 4,897 micro-USD (`$0.004897`)
- Average provider latency: 2,406 ms
- Extra retry: none
- Student40/Fresh60: not run/opened

## Certified root cause

The provider response passed the API schema but failed the typed referent invariant. The provider still selects two coupled referent fields (`kind` and `turnId`). These can be semantically inconsistent even though each field independently satisfies JSON schema.

Raw output is intentionally not logged, so this run does not claim whether the invalid pair was `active + null`, `none + T01`, or another invalid combination.

The referent type does not need provider judgment:

- null pointer means `none`;
- a pointer to the latest semantic turn means `active`;
- a pointer to an older turn, or a validated explicit return, means `history`.

## Next architecture decision

Candidate 8 must simplify referent interpretation:

1. provider returns only `referentTurnId: string | null`;
2. schema restricts non-null values to known history turn IDs;
3. local resolver derives `none / active / history` from pointer position and conversation action;
4. return action requires a non-null validated history pointer;
5. final targets remain locally resolved from current mentions + referent state;
6. run local referent-pointer tests, one provider preflight, then unchanged Smoke8 once.

Candidate 7 will not be patched or rerun under the same identity.
