# DNA Chat Student-First — Phase 2 batch failure diagnostic

Date: 2026-09-02

## Decision

The serial micro-candidate loop is closed. No Candidate 22 patch was selected from one failing sentence alone.

This diagnostic reconciles all Phase 2 candidate reports against the unchanged open Student40 fixture before selecting the next structural boundary. It does not read Fresh Student60, change a gold label or threshold, call a provider, mutate production, or deploy.

## Authoritative sources

- Phase 2 candidate reports: 11 (`Candidate 11` through `Candidate 21`)
- Student40: 5 conversations / 40 turns
- Student40 SHA-256: `e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65`
- Reproducible command: `npm run chat:student:batch-diagnostic`
- Fresh Student60: not read; remains sealed

## Quantified pattern

Across Candidate 11–20, the reports contain 26 Student40 failure observations on only 9 distinct turns. Six recurring turns contain 23/26 observations (**88.5%**):

| Turn | Recurrences | Main boundary exercised |
| --- | ---: | --- |
| `STUDENT40-C02-T04` | 7 | case/observation request and case-entity referent |
| `STUDENT40-C01-T06` | 4 | explicit component explanation versus contextual case framing |
| `STUDENT40-C02-T03` | 4 | implicit example and previous comparison anchor |
| `STUDENT40-C02-T05` | 3 | return action, case entity, and explicit retargeting |
| `STUDENT40-C02-T06` | 3 | presentation-only continuation |
| `STUDENT40-C01-T07` | 2 | observation request over prior multi-component turn |

Critical signals overlap because Candidate 18 had both target and history/action failure:

- referent: 4
- target: 3
- history/action: 2
- provider-frame validity: 2
- answer obligation: 1

The candidate reports record 422,474 micro-USD (`$0.422474`) of provider evidence for Candidate 11–21. This is diagnostic cost, not proof of passing quality.

## Verified architecture gap

The provider already returns independent `semanticActs`, but the contract compiler collapses them to one primary `semanticTask` before compiling answer obligations. Secondary explicit acts are not preserved in `StudentRequestContract` or conversation history.

At the same time, `presentation.example` can independently add the content obligation `give_concrete_example`. This reverses ownership:

- a scientific act may be lost because it is secondary;
- a delivery/style facet may create a scientific content duty.

Candidate 21 exposes the second failure. In `SMOKE8-T04`, “bu örnekte” is a discourse reference, not a request for a new example. The provider kept the primary task as observation but a presentation example value caused an extra `give_concrete_example` obligation.

The unchanged Smoke8 passed Candidate 20 and failed Candidate 21 before Candidate 21's targeted turn. Candidate 21 changed conversation-action resolution, not `obligationCompiler.ts`. Therefore the T04 result is also evidence that a provider-owned optional facet makes the gate variable.

## Selected single structural intervention

**Boundary:** `semantic-acts-own-content-obligations`

Rules:

1. Preserve every explicit semantic act in the compiled request contract and semantic history.
2. Keep `semanticTask` only as the primary routing label.
3. Compile scientific content obligations from semantic acts and task-gated scopes.
4. Presentation fields may control language, depth, format, grouping, sentence count, and example style, but may not independently create a scientific content obligation.
5. If `presentation.example` is non-`none` while no example act exists, normalize it to `none` before contract compilation.
6. A compare+example request must retain comparison and example obligations in one natural answer.
7. A reference such as “bu örnekte” with observation act but no example act must not request another example.

This is one responsibility-boundary change, not another validator layer and not a phrase-specific patch.

## Candidate 22 gate plan

1. Contract and history type migration.
2. Local contrastives for compare+example, example-reference+observe, presentation-only continuation, return, repair, and summary.
3. Existing provider-boundary, adapter, fixture, and measurement tests.
4. Exact unchanged Smoke8 once.
5. Only if Smoke8 is 8/8, exact Student40 once.
6. First failed gate closes Candidate 22; no same-candidate paid rerun.

## Current certification status

- Phase 0: PASS
- Phase 1 architecture: PASS
- Phase 2 Student40: blocked at Smoke8 after Candidate 21
- Frozen Mini24 / Fresh60 / visible-answer / later certification: not opened
- Production/deployment: none
- Best fully passing checkpoint: `79f4ed2`

