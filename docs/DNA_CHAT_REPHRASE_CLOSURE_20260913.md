# Answer-rephrase closure

Base commit: fa1b58ac73cedb93588aa5d329973d873490cb4d. User authorized correction and completion of release checks. No model, prompt, science source, gold, threshold, judge, Report Engine or auth changes in this repair.

Observed Preview chain: working-memory definition, comparison to short-term memory, then a request to simplify the last answer. Third application response was HTTP200 but said insufficient content despite the immediately preceding supported comparison. This was a material task failure, not P2; original evidence remains in DNA_V1_PAGE_SESSION_CLOSEOUT_20260913.json.

Local reproduction: presentation.preserveMeaning was false for the prior-answer reformulation family. Deterministic parsing now recognizes explicit last/previous-answer references with wording-only transformation requests, retains the preceding scientific task and targets, and uses existing bound-continuation routing. New explicit targets, substantive tasks, and added-content requests do not inherit this rule. No raw private transcript is added to state.

Local evidence:11 request controls,3 real application-path turns with synthetic composer transport;16 existing comparison request controls and4 comparison executor controls; application TypeScript and diff-check PASS. These are not new live-model acceptance and do not transfer old Final70 results.

Next gate is fresh authenticated critical application smoke on the exact commit, with prior failures preserved and no optimistic cache transfer. Production remains conditional on actual smoke and rollback/integration checks.
