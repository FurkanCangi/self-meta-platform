# DNA Intelligence Clinical Golden Case Review Protocol

Date: 2026-06-17

This protocol defines the next human-review layer for deterministic report quality. It does not change production behavior.

## Purpose

Automated QA can verify determinism, safety, language cleanliness, trace coverage, and synthetic edge-case stability. It cannot fully validate whether the clinical formulation is the best expert-level interpretation. Golden cases fill that gap.

## Golden Case Set

Maintain 30-50 de-identified cases covering:

- balanced or preserved profiles,
- selective interoception,
- sensory-emotional load,
- executive-behavioral load,
- physiological/interoceptive load,
- motor/praxis load,
- adaptive daily living load,
- language load,
- social-pragmatic load,
- language plus social-pragmatic load,
- mixed or contradictory evidence,
- age-incompatible external tests,
- raw-score-only external tests,
- preserved external tests with risk scores,
- severe anamnesis with typical scores.

## Review Dimensions

Each case should be rated 0-10 on:

- mechanism selection,
- evidence-to-claim fit,
- counter-evidence use,
- preserved capacity calibration,
- external test weighting,
- anamnesis and observation specificity,
- certainty calibration,
- differential formulation safety,
- language clarity,
- clinical usefulness for professional review.

## Acceptance Targets

- Mean total quality: at least 90/100.
- No case below 80/100 without a documented engine issue or input limitation.
- Mechanism selection: no case below 8/10.
- Evidence-to-claim fit: no case below 8/10.
- Safety: zero diagnostic, practice-direction, directive, or causal-certainty claims.

## Reviewer Notes

Reviewer feedback should identify the exact report sentence, the preferred clinical interpretation, and which evidence source supports the correction. Feedback should be converted into deterministic rules, fixtures, or audit checks. Free-form LLM rewrite should not be used to patch individual cases.

## Regression Use

When a golden case is updated:

- preserve the anonymized input,
- preserve the expected mechanism family,
- preserve the expected counter-evidence and preserved-capacity behavior,
- store only de-identified clinical summaries,
- run the full deterministic QA suite before accepting the update.
