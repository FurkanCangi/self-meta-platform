# Bounded development review — not release acceptance

## Immutable development cycle 1

Source identity (not commit): `36cbe7a267b94c9ccf7e382d5f5cbf8157e840a62443565d1ff061593401b1db`.
Base HEAD: `670b720ed20ca8d40b60f4a229908b31859954c1`; integration merge and product changes were uncommitted.
Evidence: `/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_V1_BOUNDED_CLOSEOUT_20260910/development-cycle-1`.
All 70 turns executed; original judge outputs: 69 PASS, 0 MINOR, 1 FAIL.
145 new provider calls, $0.485273; tracked program cumulative 1062 calls / $3.680605.
No runtime/HTTP500/503/empty answer. These results are DEVELOPMENT_DIAGNOSTIC, not acceptance.

## Material findings, separate from original judge records

1. **box3-sci-013 — confirmed source fidelity defect.** Question asks the essence/definition of Teneffüs ve Serbest Zaman. Selected claims describe social/motor demands, possible difficulty in unstructured recess, and explicitly reject assuming free time is easier. All three are context-role claims. The producer saw only the first claim and invented “kendi kendine düzenleyerek sürdürdüğü okul zamanı”. Existing judge rejected unsupported science. Cycle 2 preserves the full selected contextual unit, including qualifications and claim identities, instead of projecting it as a new formal definition.
2. **ONEHOUR24-T03 — confirmed internal scenario contradiction, missed by the judge.** The activity says the student continues the task instead of taking a short reward. The self-control eventStep then says “ders görevine devam etmeyi erteler”. This reverses which behavior is delayed and materially misapplies the concept. Original PASS remains immutable; this separate AI-assisted review does not claim independent human adjudication. Cycle 2 adds explicit shared-activity actor/object/goal ownership to the existing composer instructions and input contract. This prompt correction is not a deterministic proof; it requires fresh development evidence and subsequent official acceptance.
3. **NMINI-C01-T09 — prior scope inversion not reproduced.** Fresh visible answer and existing judges passed with source-authoritative scope projection. Wrong provider choices and reversed source order are also injected locally. Not a new official gate PASS.
4. **ONEHOUR24-T11 — prior forgetting-to-remembering inversion not reproduced.** New answer explicitly retains forgetting both instruction steps. Existing judge PASS; generic polarity local checks remain applicable, not a guarantee of all semantic correctness.
5. **Prior source-copy 503 / Scientific 033** — recorded-source local regression and current development route both return nonempty answers. No old FAIL was rewritten.

## Review uncertainties and P2 backlog

- ONEHOUR24-T08: user asks to simplify the previous answer; frozen expectation requests concept explanation while preceding turn was an observation-limit explanation. Current answer keeps targets but returns to definitions. Preserve as question/history/task interpretation uncertainty, not silently change gold or claim human approval.
- ONEHOUR24-T12: “aynı örnekte” can mean one shared scenario or the preceding scenario. Frozen expectation does not explicitly lock the previous negative event. Current context preserves instruction receipt but not forgetting. Preserve ambiguity; do not invent an extra gold requirement or automatic PASS for historical fidelity.
- Long repetitive explanations in ONEHOUR24-T06/T07/T14 and Student40-C01-T06/T07; repeated safety clauses; mechanical target prefixes and lowercase labels: P2 where meaning and requested duty remain correct. No polish-only third cycle.
- All remaining visible answers were read as Turkish prose as well as checked against their stored result. This is AI-assisted inspection, not independent human acceptance.

## Release preparation

Latest remote main `de6a0b6a0efa24dac89c6c663ccb460ef3c81d1d` merged into the isolated release tree before freeze. Report files match that main exactly. Explicit server-only release flag plus 64-hex source identity enables the student runtime; no browser header or local flag enables production. No production setting changed.
GitHub records successful historical production deployment 6292117740 at that main SHA. Vercel project read still returns 403; current alias/rollback authority is unverified. A single specific access request was sent. No bypass, environment pull, push or deploy occurred.
