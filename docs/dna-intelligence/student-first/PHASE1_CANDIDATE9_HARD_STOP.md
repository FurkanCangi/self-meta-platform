# DNA Chat Student-First — Phase 1 candidate 9 hard stop

Date: 2026-09-02

## Candidate decision

- Candidate: task-gated summary and observation facets
- Parent commit: `ad801a0`
- Production-path activation: none
- Deployment: none
- Frozen/sealed fixture mutation: none
- Existing key reused; secret value not printed or changed

Candidate 9:

- replaced final provider summary/observation scopes with task-gated extras;
- derives `summarize_known` locally from the summarize task;
- derives observation-limit and additional-context duties locally for observe/case tasks;
- ignores unrelated scope flags outside their meaningful semantic task;
- kept Smoke8 questions and expected decisions unchanged.

## Verification

### Local gates — PASS

- TypeScript: PASS
- Provider-boundary mocks: PASS
- Task/facet/target/referent/obligation matrix: 14/14 PASS
- T04 observe with incorrect summary extras: locally normalized correctly
- Raw error/output persistence: 0

### Candidate 9 synthetic provider preflight — PASS

- Calls: 1
- Structured frame: valid
- Input tokens: 1,650
- Output tokens: 123
- Cost: 2,388 micro-USD (`$0.002388`)
- Latency: 2,192 ms
- Raw output logged: no

### Exact unchanged Smoke8 — FAIL / hard-stop

- `SMOKE8-T01` to `SMOKE8-T04`: PASS
- Failed turn: `SMOKE8-T05`
- Failure dimension: semantic task
- Expected: `define`
- Actual: `explain`
- Completed correct contracts: 4/8
- Provider calls: 5
- Total Smoke8 usage: 8,995 input / 629 output tokens
- Total Smoke8 cost: 12,769 micro-USD (`$0.012769`)
- Average provider latency: 2,064 ms
- Extra retry: none
- Student40/Fresh60: not run/opened

Input:

> yok inhibisyon kısmını sormuyorum yönergeyi aklında tutamaması çalışma belleği açısından ne demek

## Certified root cause

The remaining failure is no longer provider transport, schema compatibility, obligation planning, target resolution, referent shape, or task/facet gating. The single-choice semantic-task classifier selected `explain` instead of `define` for an explicit definition request embedded in a repair turn.

The frame asks the provider to collapse potentially co-occurring scientific acts into one mutually exclusive label. A repair message can simultaneously contain correction, definition, example, comparison, or observation language. Conversation action was separated earlier, but scientific acts remain single-choice.

## Next architecture decision

Candidate 10 is the final contract-structure intervention in this sequence:

1. provider returns independent semantic-act booleans rather than one `semanticTask`;
2. local resolver selects the primary task from validated acts and conversation history;
3. explicit definition wins over generic explanation when both are present;
4. a return/restate turn can inherit the semantic task from its referenced history turn;
5. safety intent and ambiguity are derived locally rather than re-selected by the provider;
6. run local multi-act resolution tests, one provider preflight, then unchanged Smoke8 once.

If Candidate 10 fails Smoke8, stop adding contract fields or prompt examples. The next branch must be a bounded interpreter/model-strategy study, not Candidate 11 micro-patching.

Candidate 9 will not be patched or rerun under the same identity.
