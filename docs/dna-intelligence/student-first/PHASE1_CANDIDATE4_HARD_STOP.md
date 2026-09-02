# DNA Chat Student-First — Phase 1 candidate 4 hard stop

Date: 2026-09-02

## Candidate decision

- Candidate: provider-boundary certification and structured-output schema compatibility
- Parent commit: `0d734617e4e26a255dfd7841de41989944349f86`
- Production-path activation: none
- Deployment: none
- Frozen/sealed fixture mutation: none
- Existing key reused; secret value not printed or changed

Candidate 4 changed infrastructure responsibility only:

- added privacy-safe failure classes without API error messages, response bodies, raw student messages, or secrets;
- preserved legacy `null` behavior for existing S13 callers;
- removed `uniqueItems` from the provider JSON schema while keeping runtime uniqueness rejection;
- added repeatable local provider-boundary mock tests;
- added one-call synthetic provider preflight;
- kept Smoke8 questions and expected decisions unchanged.

## Verification

### Local provider boundary — PASS

- TypeScript: PASS
- Failure classes covered: 9
- Raw error messages/secrets persisted: 0
- Legacy S13 failure behavior: preserved
- Student schema known working subset: PASS
- Runtime uniqueness validation: PASS

### Synthetic provider preflight — PASS

- Calls: 1
- Structured frame: valid
- Input tokens: 1,681
- Output tokens: 110
- Cost: 2,341 micro-USD (`$0.002341`)
- Latency: 3,456 ms
- Raw output logged: no

### Exact unchanged Smoke8 — FAIL / hard-stop

- `SMOKE8-T01`: PASS
- Failed turn: `SMOKE8-T02`
- Completed correct turns before failure: 1/8
- Attempted Smoke8 provider calls: 2
- Extra retry: none
- Student40/Fresh60: not run/opened
- Smoke8 usage/cost: not captured by the previous fail-output path; no fabricated estimate is reported

Input:

> dürtüyü durdurmak bununla aynı şey mi yoksa içindeki parçalardan biri mi

Expected obligations:

```json
[
  "distinguish_targets",
  "explain_relation"
]
```

Actual obligations:

```json
[
  "cover_requested_component",
  "distinguish_targets",
  "explain_relation",
  "use_history_anchor"
]
```

## Root cause

The semantic interpreter is also acting as the answer-obligation planner. It correctly recognized the comparison, but over-planned two answer duties:

1. an active conversational referent was turned into `use_history_anchor`, although that obligation is reserved for an explicit return to an older turn;
2. asking whether inhibition is a component was turned into `cover_requested_component`, although the user asked for a relationship comparison, not a component-by-component answer.

This is a responsibility-boundary error. Provider interpretation should describe semantic facts; the deterministic contract compiler should derive core answer obligations from semantic task, conversation action, referent kind, and presentation. Optional user-requested facets need their own narrow semantic representation and must not be mixed with final obligation planning.

## Next architecture decision

Candidate 5 must structurally separate semantic interpretation from answer-obligation compilation:

1. remove final `obligationKinds` ownership from the provider frame;
2. derive default obligations deterministically from `semanticTask` and `conversationAction`;
3. represent only optional explicit answer facets in a narrow typed field;
4. compile and deduplicate final obligations locally;
5. make failure output include accumulated safe usage/cost;
6. run local contract tests, then one provider preflight, then unchanged Smoke8 once.

Candidate 4 will not be patched or rerun under the same identity.
