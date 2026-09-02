# DNA Chat Student-First — Phase 1 candidate 6 hard stop

Date: 2026-09-02

## Candidate decision

- Candidate: field-level semantic validation evidence and local component-target derivation
- Parent commit: `56f899b`
- Production-path activation: none
- Deployment: none
- Frozen/sealed fixture mutation: none
- Existing key reused; secret value not printed or changed

Candidate 6:

- replaced provider-selected `componentTargetIds` with presentation grouping (`integrated` / `separate_each`);
- derives component targets locally only for multi-target `explain + separate_each` requests;
- added privacy-safe semantic validation failure codes;
- carries provider usage and latency evidence even when a frame fails local validation;
- kept Smoke8 questions and expected decisions unchanged.

## Verification

### Local gates — PASS

- TypeScript: PASS
- Provider-boundary mocks: PASS
- Frame/obligation compiler: 9/9 PASS
- Compare + integrated component coverage: 0
- Explain + separate-each component targets: locally derived correctly
- Raw error/output persistence: 0

### Candidate 6 synthetic provider preflight — PASS

- Calls: 1
- Structured frame: valid
- Input tokens: 1,708
- Output tokens: 141
- Cost: 2,554 micro-USD (`$0.002554`)
- Latency: 2,304 ms
- Raw output logged: no

### Exact unchanged Smoke8 — FAIL / hard-stop

- `SMOKE8-T01`: PASS
- Failed turn: `SMOKE8-T02`
- Certified failure code: `comparison_side_missing`
- Completed correct contracts: 1/8
- Provider calls: 2
- Total Smoke8 usage: 3,506 input / 292 output tokens
- Total Smoke8 cost: 5,258 micro-USD (`$0.005258`)
- Average provider latency: 2,426 ms
- Extra retry: none
- Student40/Fresh60: not run/opened

## Certified root cause

The provider recognized T02 as a comparison but returned fewer than two resolved `comparisonTargetIds`. The current message explicitly names inhibition while “bununla” points to executive functions in T01. The provider did not reliably merge the current target and referent target into one resolved comparison set.

Candidate 5's one-item component hypothesis is not supported by Candidate 6 evidence and is rejected.

The frame still gives the provider two responsibilities:

1. identify targets explicitly mentioned in the current message and its referent;
2. resolve those inputs into final target and comparison sets.

The second responsibility should be deterministic conversation-state resolution.

## Next architecture decision

Candidate 7 must separate target mention interpretation from target resolution:

1. provider returns only current-message `mentionedTargetIds`, rejected targets, and typed referent;
2. local resolver removes rejected targets and merges mentioned + referent targets according to semantic task/action;
3. comparison targets are locally derived as the resolved target set for compare tasks;
4. session-summary targets are locally derived from semantic history;
5. return targets are anchored to the validated history referent;
6. run local target-resolution tests, one provider preflight, then unchanged Smoke8 once.

Candidate 6 will not be patched or rerun under the same identity.
