# DNA Chat Student-First — Phase 2 candidate 24 hard stop

Date: 2026-09-02

## Decision

- Result: **FAIL / HARD STOP**
- Candidate: focus target versus context target roles
- Parent commit: `33993ff`
- Production/deployment: none
- Gold/fixture/threshold mutation: none
- Fresh Student60 access: none
- Student40: not run
- Candidate 24 retry: none

Candidate 24 replaces flat `mentionedTargetIds` with:

- `focusTargetIds`: concepts the current request asks the answer to address;
- `contextTargetIds`: behaviors/concepts present only inside a case or example description.

Context targets are persisted as privacy-safe IDs but cannot enter final answer targets. The request and conversation-state versions were advanced for this structural migration.

## Local gates — PASS

- Provider schema contains focus/context target roles: PASS
- Flat target-mention field removed: PASS
- Focus/context overlap rejected: PASS
- Obligation compiler: 20/20
- Resolver contrastives: 39/39
- Provider boundary/failure taxonomy: PASS
- Bounded semantic repair and transport retry: PASS
- Adapter / fixture / measurement: PASS
- Student40 SHA-256 unchanged: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Fresh Student60: `SEALED_UNOPENED`

Targeted local cases passed:

1. a coregulation example containing contextual `recovery` keeps only `coregulation` as the final target;
2. an explicit recovery question keeps `recovery` as focus;
3. a target-free example inherits the compatible prior focus;
4. context IDs do not enter active target or summary target unions.

## Exact unchanged Smoke8 — FAIL

- Correct contracts before stop: 3/8
- Failed turn: `SMOKE8-T04`
- Expected obligations: `state_single_observation_limit`, `name_additional_context`
- Unexpected extra obligation: `define_target`
- Provider calls: 4
- Input/output tokens: 9,290 / 664
- Cached input tokens: 0
- Cost: 13,274 micro-USD (`$0.013274`)
- Average logical-turn latency: 2,729 ms

Input:

> bu örnekte tek gözlemle inhibisyonu zayıf diyebilir miyim başka neye bakarım

## Root cause

The focus/context target migration did not directly create the extra obligation. The provider activated a generic definition/explanation semantic act alongside the primary observation act. The Candidate 22 obligation architecture currently adds `define_target` whenever `define` or `explain` appears in the requested semantic-act set, unless compare/example also appears.

That rule ignores obligation-family compatibility. In an observation-primary request, a generic supporting explanation act must not independently create a definition duty. The correct observation duties were also present, so this is over-coverage rather than a missing task, target, referent, or safety decision.

The unchanged T04 passed Candidate 22 and Candidate 23, then failed after the provider-facing target-role schema/prompt changed. This is further evidence that optional provider act combinations vary while the deterministic obligation compiler needs a stable compatibility matrix.

Candidate 24 does not prove or disprove the targeted `STUDENT40-C03-T02` fix live because Student40 was correctly blocked at Smoke8.

## Selected next branch

Do not patch the phrase or discard semantic-act preservation. The next single structural intervention must add a semantic obligation-family compatibility matrix:

1. treatment-boundary and summary remain terminal families;
2. observation/case primary tasks compile observation duties without a generic definition duty;
3. define/explain compile `define_target` only when the primary task is define/explain;
4. compare may retain explicit example and task-gated observation extras;
5. example-primary retains example and binding duties;
6. return, repair, presentation-only continuation, component coverage, and safety duties remain orthogonal;
7. local cross-product tests cover observe+explain, compare+example, treatment+explain, summarize+explain, define+explain, and presentation-only frames.

Only after that local matrix passes may unchanged Smoke8 and one Student40 run be opened. No prompt-only patch, validator, gold edit, threshold change, same-candidate retry, or production mutation is authorized.

## Status

- Phase 0: PASS
- Phase 1: PASS
- Phase 2 local: PASS
- Phase 2 Smoke8: FAIL at 3/8
- Phase 2 Student40 and later gates: not run
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`

