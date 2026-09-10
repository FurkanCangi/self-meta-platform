# Report: eleven reviewed issues / exact-ten replay

Scope: local Report-only repair of the 11 issues reviewed on 2026-09-06. No provider calls, database writes, production deployment or Chat changes.

Base: `c4e3e2ac8927ca1306a0fe422ede83e9a499b7a3`. The concurrent Chat checkout is deliberately not used as the Report baseline.

## Changes

1. Explicitly unavailable therapist observations are not counted as an available source.
2. Unknown/unasked topics do not become reported functional difficulties.
3. Negation is interpreted at clause scope; negative reports are not reversed into difficulties.
4. Drawing is not an intervention. Observing multiple conditions does not establish a performance decline or an intervention effect.
5. A single preserved/difficult subtask cannot label an entire source as opposing another source. Individual relations remain available in the evidence trace.
6. Material sleep difficulties, interrupted morning activity, late toileting/accidents and negative pain reports remain visible.
7. Clothing/handwashing success does not establish interoceptive awareness; a success in one condition does not establish dependence on support in unobserved conditions.
8. Caregiver and child subjects are not mechanically joined. Unambiguous Turkish spelling is repaired; incomplete movement notes are explicitly incomplete, not completed by inventing an action. Genuine questions and pasted instructions stay excluded.
9. A short note is not a short observation duration.
10. An exact caregiver-completed external test result keeps its external-test attribution. Altered-result negative controls still fail.
11. Clinical emphasis uses supported tasks and bounds; exact sentence repetitions are removed without deleting unique evidence. The short concrete sock event is retained while the pasted instruction is excluded.

Additional regression edges: a difficulty entered in a form's strengths field remains a difficulty; starting to report a headache is not successful task initiation; incomplete button closure is not successful dressing; a qualified behavior followed by noisy `???` punctuation is not discarded as an actual question.

## Decision and confidence boundaries

No scoring code, age thresholds, source catalog, knowledge bridge, Chat or API contract was changed. Score-derived overall classification and the complete area-priority profile are compared with the immutable baseline. Five current product headings and eight legacy compatibility headings remain tested.

This is **not language-only**: corrected observation/source accounting and evidence interpretation can change confidence. Confidence weights and thresholds are not changed, but the evidence inputs are corrected. Exact-ten confidence changes must be reported separately, not hidden behind a blanket `decision drift = 0` claim. The two affected professor-fixture checks retain their old hashes and verify that every non-confidence decision field still matches.

The old average word-count assertion rewarded repeated text. It is replaced by an assertion that every usable observed canonical fact remains visible; the existing per-case severe-content-loss guard remains. Exact wording assertions are updated only for their equivalent new wording. Safety, unsupported-claim, provenance and semantic leakage gates remain active.

## Reproduction

From this Report worktree with dependencies installed:

```sh
node scripts/run-report-eleven-all-checks.cjs
node scripts/check-eleven-legacy.cjs
```

The exact ten inputs, including 60 answers, are in `scripts/fixtures/report-eleven-exact10.json`. `REPORT_ELEVEN_OUTPUT` selects a run-specific output directory. The exact-ten runner generates each case twice and rejects network use.

The second command reads the unchanged 1,000-case scenario generator without invoking its large artifact exporter. To compare old and new engines in the same run, set `REPORT_ELEVEN_BASE_COMPILED` to an independently compiled base checkout; otherwise before/after fields are explicitly unavailable. `REPORT_ELEVEN_LEGACY_START` and `REPORT_ELEVEN_LEGACY_LIMIT` allow bounded diagnostic slices. Final certification must use all 1,000 cases.

Generated outputs are not committed. Review raw reports, sealed evidence, test logs and before/after examples together. Automated PASS is not an independent clinician's quality rating or proof of live production behavior.
