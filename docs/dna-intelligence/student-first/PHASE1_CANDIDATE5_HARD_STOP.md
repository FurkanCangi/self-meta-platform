# DNA Chat Student-First — Phase 1 candidate 5 hard stop

Date: 2026-09-02

## Candidate decision

- Candidate: semantic interpretation / answer-obligation compilation separation
- Parent commit: `706e422`
- Production-path activation: none
- Deployment: none
- Frozen/sealed fixture mutation: none
- Existing key reused; secret value not printed or changed

Candidate 5 made one structural responsibility change:

- the provider no longer selects final `obligationKinds`;
- the provider describes semantic facts: task, action, targets, referent, presentation, summary scope, observation scope, and separately requested component targets;
- one deterministic compiler derives and deduplicates final answer obligations;
- active referents cannot create a history-return obligation unless `conversationAction=return`;
- safe usage/cost evidence is emitted on Smoke8 failure.

## Verification

### Local gates — PASS

- TypeScript: PASS
- Provider-boundary mocks: PASS
- Provider owns final obligations: false
- Deterministic obligation compiler: 7/7 cases PASS
- Duplicate obligation output: 0
- Candidate 4 T02 obligation over-planning case: locally resolved

### Candidate 5 synthetic provider preflight — PASS

- Calls: 1
- Structured frame: valid
- Input tokens: 1,770
- Output tokens: 140
- Cost: 2,610 micro-USD (`$0.002610`)
- Latency: 2,426 ms
- Raw output logged: no

### Exact unchanged Smoke8 — FAIL / hard-stop

- `SMOKE8-T01`: PASS
- Failed turn: `SMOKE8-T02`
- Failure: `invalid_structured_output`
- Completed correct contracts: 1/8
- Provider calls attempted: 2
- Recorded successful-frame usage: 1,778 input / 140 output tokens; 2,618 micro-USD
- T02 invalid-frame usage is not available in the current failure result; total cost is therefore not claimed
- Extra retry: none
- Student40/Fresh60: not run/opened

## Root cause status

The T02 provider response passed the API JSON schema boundary but failed a local semantic-frame invariant. Candidate 5 currently collapses all invariant failures into `invalid_structured_output`, so the exact invalid field is not certified.

Strong but unconfirmed hypothesis: T02's membership phrase (“içindeki parçalardan biri mi”) was still represented as one `componentTargetId`. Candidate 5 intentionally rejects a one-item component-coverage request because component-by-component coverage requires at least two named targets. This hypothesis is consistent with Candidate 4's extra `cover_requested_component`, but raw provider output was not logged and the exact invariant must not be inferred as fact.

## Next architecture decision

Candidate 6 must improve the semantic boundary rather than patch T02 wording:

1. return a privacy-safe semantic validation failure code and provider usage for invalid frames;
2. replace provider-selected `componentTargetIds` with a semantic grouping mode such as `integrated` versus `separate_each`;
3. derive component targets locally from validated target IDs only when grouping is `separate_each`;
4. retain summary scope, observation scope, referent, and presentation as independent facts;
5. run local frame diagnostics, one provider preflight, then unchanged Smoke8 once.

Candidate 5 will not be patched or rerun under the same identity.
