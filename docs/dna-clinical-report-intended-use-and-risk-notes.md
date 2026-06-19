# DNA Intelligence Deterministic Report Intended-Use and Risk Notes

Date: 2026-06-17

This note is a product and engineering control document for the deterministic clinical report engine. It is not a legal, regulatory, or medical-device classification opinion.

## Intended Use Boundary

The report engine produces deterministic clinical formulation text from structured regulation scores, anamnesis, therapist observation, supported external test summaries, deterministic knowledge-base rules, and verified literature registry entries.

The visible report must remain:

- descriptive,
- hypothesis-level,
- context-sensitive,
- evidence-calibrated,
- non-diagnostic,
- non-prescriptive,
- reproducible from the same input.

The visible report must not:

- diagnose,
- exclude a diagnosis,
- prescribe a practice plan,
- recommend sessions or medication,
- provide a direct family instruction list,
- claim causal certainty,
- replace therapist review,
- automate a final clinical decision.

## Human Review Boundary

The deterministic engine is designed to support report drafting and clinical reasoning traceability. It does not replace professional review. Production responses do not expose debug trace, internal evidence atoms, rule ids, raw item-level details, or private identifiers.

## Risk Controls Already in the Code Path

- Production report path is deterministic and does not import LLM, runtime RAG, or AI rewrite modules.
- Claim registry blocks diagnostic, practice-direction, directive modal, causal certainty, and automation claims.
- Clinical safety validator runs on the visible report text.
- Privacy test verifies production response does not return trace/debug data.
- Determinism test verifies stable final output and stable decision trace hash.
- Audit verifies sentence trace coverage, reasoning score breakdown, claim guard, unsupported specificity, and deterministic knowledge-base status.

## Traceability Controls

Internal CLI/debug metadata may include:

- input hash,
- decision trace hash,
- selected and suppressed atom ids,
- sentence-level trace,
- evidence source ids,
- rule ids,
- confidence subscores,
- mechanism score breakdown,
- external test evidence weights.

These fields are intended for engineering audit, regression testing, and clinical QA review. They should not be returned in ordinary production report responses.

## External Test Boundary

External tests do not modify DNA score values. They only calibrate:

- evidence weight,
- mechanism confidence,
- source agreement,
- interpretation boundaries,
- counter-evidence,
- preserved-capacity language.

Age-incompatible, raw-score-only, missing-result, qualitative-only, preserved, or unsupported tests must not strengthen the main clinical mechanism.

## Compliance Follow-Up

Before broader commercial or regulated clinical positioning, a separate compliance review should assess the product claims, user role, decision impact, risk management file, and software lifecycle controls against the appropriate official frameworks, including:

- FDA Clinical Decision Support Software guidance,
- EU MDCG 2019-11 rev.1,
- ISO 14971:2019 risk management principles,
- IEC 62304 software lifecycle process expectations.

This document does not determine applicability of those frameworks; it records the current engineering safety boundary.
