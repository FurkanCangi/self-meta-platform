# DNA Intelligence local Qwen3 controlled-router pilot

## Status

This pilot is **development-only and currently resource-gate blocked**. It is not a chat answer generator, is not part of the live runtime, and is not eligible for release or activation.

The allowed development input contains 14 external-science topic cards and 177 development cases:

- 42 tuning-family cases
- 42 family-separated development cases
- 93 metamorphic and safety cases

Locked V1/V2/V3 holdout payloads, official claim/result files, and official aggregate results are outside this pilot. The model receives no case report and may return only:

```json
{"action":"retrieve|clarify|abstain","topicId":"allowed topic id or null"}
```

No clinical prose is generated.

## Safety and integrity design

The input builder mechanically verifies:

- candidate and adapter authority/self hashes;
- candidate, adapter, routing-core, generator, and builder file bindings;
- 14 topic, 166 passage, 220 claim, and 220 answer-unit reference integrity;
- one-hop/no-multi-step answer-unit boundaries;
- exact topic-card, case, bank, semantic-family, action, and expected-label schemas;
- a canonical bundle hash before writing a `0600` ResearchSSD artifact.

The runner applies diagnosis, treatment, medication, dose, prescription, prognosis, personal biological-inference, and prompt-injection gates before the model. Model output is strict-schema parsed against the topic allowlist; extra fields, prose, markdown, hallucinated topics, invalid JSON, or within-run nondeterminism fail closed to `abstain` and cannot be counted as a correct model prediction.

Generation is fixed to temperature `0`, seed `20260724`, exactly three repeats, and batch size `1`. The reported determinism result is only **within the same process and run**. Cold-process determinism has not been tested.

Smoke artifacts and canonical 177-case artifacts use different paths. Only an exact 177-case full run can write the canonical manifest. Verification requires exact input counts, non-empty safety families, strict manifest allowlists, current runner/builder/input/candidate/adapter/model/config/tokenizer/environment provenance hashes, and a matching `0600` SSD report.

## Resource gate and current evidence

Apple XNU defines memory-pressure values as `0 normal`, `1 warning`, `2 urgent`, and `3 critical`. The runner therefore refuses to load the model unless the pre-run level is `0`, and checks pressure, process RSS, and MLX peak memory before and after every generation. MLX peak and process RSS are each capped at 6 GiB. See [Apple XNU memorystatus notification documentation](https://github.com/apple-oss-distributions/xnu/blob/main/doc/vm/memorystatus_notify.md).

On 2026-07-24 the machine was at pressure level `1` while idle; model attempts observed level `2`. The corrected guard stopped without writing smoke or canonical results. The 177-case full run was not started.

A preliminary six-case smoke made before the corrected OS-pressure interpretation returned 6/6 correct, 6/6 strict JSON, and 6/6 stable across three within-run repeats. It measured approximately 2.26 GB active MLX memory and 3.56 GB peak MLX memory. That evidence is retained under the explicit `pre-resource-gate` name and is **not an accepted smoke gate**.

Current non-model checks:

- input builder and authority/reference validation: passed;
- Python compilation: passed;
- 30 strict-output, clinical-safety, inference, injection, path-isolation, source-drift, incomplete-full, and pressure-contract tests: passed;
- fail-closed attempt at pressure level 1: passed; no model load and no smoke/canonical write.

## ResearchSSD and repository boundary

Raw development questions, detailed rows, output hashes, and prompts remain only under:

`/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/local-router-pilot/qwen3-4b-instruct-2507-4bit`

Repository evidence is aggregate/hash-only. Model and virtual environment remain under ResearchSSD. There is no external model API, new package, database migration, runtime activation, release authority, or owner approval in this pilot.

## Safe continuation

Run these only after the Mac reports pressure level `0`:

```bash
npm run chat:local-router-pilot:preflight
npm run chat:local-router-pilot:smoke
npm run chat:local-router-pilot:verify-smoke
npm run chat:local-router-pilot:run
npm run chat:local-router-pilot:verify
```

If pressure becomes warning/urgent/critical or either memory cap is exceeded, the run must remain blocked. A low accuracy result, once a safe full run is possible, must be preserved without tuning against locked or official evaluation material.
