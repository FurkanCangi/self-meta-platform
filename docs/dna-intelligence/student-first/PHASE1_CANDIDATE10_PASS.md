# DNA Chat Student-First — Phase 1 candidate 10 PASS

Date: 2026-09-02

## Candidate decision

- Candidate: multi-label semantic acts plus local primary-task resolution
- Parent commit: `0aa1aa4`
- Production-path activation: none
- Deployment: none
- Frozen/sealed fixture mutation: none
- Existing key reused; secret value not printed or changed

Candidate 10 completed the structural responsibility split:

- provider returns independent semantic-act booleans rather than one mutually exclusive task;
- local resolver selects the primary task;
- explicit definition wins over generic explanation when both are present;
- a return/restate turn can inherit its semantic task from the referenced history turn;
- final targets, comparison targets, component targets, referent kind/targets, summary scope, observation scope, ambiguity, safety intent, and answer obligations are derived locally;
- provider retains only raw-language interpretation responsibilities: semantic acts, conversation action, current-message target mentions, rejected mentions, one referent pointer, presentation requests, and optional task-gated facets.

## Verification

### Local gates — PASS

- TypeScript: PASS
- Provider-boundary mocks: PASS
- Multi-act / referent / target / task-facet / obligation matrix: 14/14 PASS
- Provider owns final obligations: false
- Raw errors, raw provider output, API secret persistence: 0

### Candidate 10 synthetic provider preflight — PASS

- Calls: 1
- Structured frame: valid
- Input tokens: 1,715
- Output tokens: 152
- Cost: 2,627 micro-USD (`$0.002627`)
- Latency: 2,732 ms
- Raw output logged: no

### Exact unchanged Smoke8 — PASS

- Correct semantic contracts: 8/8
- Provider calls: 8
- Input tokens: 15,656
- Output tokens: 1,231
- Cost: 23,042 micro-USD (`$0.023042`)
- Average provider latency: 2,469 ms
- Raw messages persisted in state: 0
- Answered telemetry excluded from quality: PASS
- Final active targets: executive functions, inhibition, working memory, planning
- Rejected target memory: inhibition
- Compact privacy-safe summary length: 366

Total Candidate 10 provider evidence cost: 25,669 micro-USD (`$0.025669`).

### Phase 0 regression — PASS

- Natural Mini24 frozen: PASS
- Student40: 5 conversations / 40 turns / open development
- Fresh Student60: 6 conversations / 60 turns / `SEALED_UNOPENED`
- Unique fixture turn IDs/messages: 100/100
- Measurement: `answered` excluded
- Student40 gate: 36/40
- Zero-critical dimensions: target, referent, history, safety

## Phase decision

Phase 1 gate is achieved. Candidate 10 is the first architecture candidate authorized to proceed to the open Student40 semantic-development gate.

Before Student40 provider execution:

1. keep the Student40 fixture byte-identical;
2. add a versioned adapter that maps the historical single `operation` annotation to current semantic task, conversation action, presentation, and obligations;
3. prove adapter mappings locally, including `repair`, `return`, and `simplify`;
4. run Student40 once with a 40-call and cost cap;
5. require at least 36/40 full semantic passes and zero wrong target, referent, history, or safety decisions.

Fresh Student60 remains sealed until both Student40 semantic and visible-answer gates pass.
