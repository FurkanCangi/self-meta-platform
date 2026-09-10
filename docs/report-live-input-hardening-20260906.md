# Report live-input hardening

Baseline: `815b19eb697489b23dc25fc389f5f9177f6abb60`.

The two reports reviewed on 3 and 5 September predate that release. Their
structural input problems are reproduced with synthetic cases, not copied
patient records. Existing clinical records are immutable and are not rewritten.

## Scoped changes

- Unmistakable keyboard/filler-only observation clauses are excluded. Short
  meaningful observations and the clinical part of mixed notes remain available.
- A short note still does not imply a short observation duration (already fixed
  in the baseline).
- A score indicates the scale result, not a confirmed observed disability.
  Existing conditional functional explanations remain; no new patient details.
- Out-of-range domain scores no longer claim that the child has no preserved
  skills. The report distinguishes measured scores from daily-life abilities.
- Common affirmative aorist forms (`bitirir`, `tamamlar`, etc.) retain explicitly
  reported ability; negative forms are tested separately.
- Equivalent observation-scope sentences share one wording and are emitted once
  by the existing exact-sentence deduplicator.
- The preserved-capacity critic requires the actual locked capacity/boundary
  paragraphs, not the mere occurrence of a keyword. A negative control removes
  those paragraphs but leaves the keyword: this must fail.
- Report opts into age/claim-purpose filtering before literature selection.
  Intervention/diagnosis-specific sources cannot stand in for general
  construct/measurement sources. Middle-childhood and unspecified youth scope
  do not establish preschool applicability; numerical age scopes are enforced.
- Scientific explanations are separated into readable citation-linked paragraphs.
  Paragraph provenance includes the sources actually cited in that paragraph.

## Protected boundaries

No scoring formula, normative band, priority-ranking rule, confidence weight,
Chat file/catalog, knowledge bridge, API contract, product heading, schema,
environment variable or secret is changed. Source catalog data and the default
legacy literature output are compared with the independent baseline. Only the
Report caller enables the additional eligibility policy.

Evidence cleanup can change confidence inputs; confidence differences are
measured and must be reported rather than declared impossible.

The old jury test's 800-word floor counted bibliography entries. In ADV-BE-04,
compatible source selection reduced 826 total words to 792 while clinical text
grew from 456 to 458. It is replaced by an immutable-baseline clinical-body loss
guard plus the existing exact usable-case-fact coverage checks. Safety,
entailment, omission, source attribution and scoring gates are retained.

## Reproduce (no provider or database access)

```sh
node scripts/run-report-eleven-all-checks.cjs
REPORT_LIVE_INPUT_BASE_COMPILED=/path/to/baseline/compiled-eleven node scripts/run-report-live-input-hardening.cjs
REPORT_ELEVEN_BASE_COMPILED=/path/to/baseline/compiled-eleven REPORT_ELEVEN_OUTPUT=output-live-input node scripts/check-eleven-legacy.cjs
```

The targeted harness has 30 synthetic cases at age-band boundaries, minimal
positive/negative pairs, and independently compiled before/after comparisons.
The 1,000-case run is the unchanged legacy generator. No automated PASS is a
clinical quality score or proof of an authenticated live report transaction.

## Source-selection rationale

- [De Raeymaecker & Dhar (2022)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9406957/)
  targets middle childhood, including the 6–12-year interval; it is not an
  age-matched preschool measurement reference.
- [Piller et al. (2025)](https://www.frontiersin.org/journals/pediatrics/articles/10.3389/fped.2025.1720179/full)
  evaluates sensory-based interventions, not general assessment instrumentation.
- [Shahbazi & Mirzakhani (2021)](https://pubmed.ncbi.nlm.nih.gov/33558812/)
  specifically reviews sensory-processing assessment instruments for ages 0–14.
- [Garon et al. (2008)](https://pubmed.ncbi.nlm.nih.gov/18193994/)
  addresses preschool working memory, inhibition and shifting.

These checks narrow source use; they do not establish case-level causality or
validate a diagnosis.
