# Bounded comparison repair

Base commit: 46f40777da18ef953995b40539c985b9fb1d8b75.
Source identity (not commit): 9d98ac2bb9ea709b4c55ac4dae1bc04e68b33f0ba4dcf6109ec8ea9fa5565d6b.

The owner requested correction after the authenticated Preview follow-up produced an unrelated relation answer. This is a narrowly reopened target-binding defect, not a new architecture, benchmark, prompt or judge project. The earlier frozen-engine identity and Final70 disposition are historical evidence, not acceptance of this changed candidate.

## Reproduction and source evidence

After “Çalışma belleği nedir? Kısa ve sade anlatır mısın?”, “Peki kısa süreli bellekten farkı ne?” resolves locally to compare with only working_memory and ambiguity comparison_side_missing. The target lexicon lacked short_term_memory. The original visible Preview answer discussed factors affecting working-memory tasks instead of the requested distinction. Exact live internal interpretation was not retained; the missing target is independently reproduced, not inferred from a guessed model trace.

Existing approved section owner-book:heading:1574:9f3497890b directly contains both definitions. Claim owner.unit:2250:17bb99566535 defines short-term memory; owner.unit:2251:067ce1c9a50f defines working-memory processing/updating. No source text was added or changed.

Registering the missing concept exposed a second deterministic defect: the runtime handoff deduplicated concept crosswalks by source section. It discarded one target and failed execution-plan validation. The fix retains concept bindings while still deduplicating retrieval sections. A rejected concept cannot remove a different active concept's shared source; concept-level rejection and identical-target polarity conflict remain enforced.

## Verification

Network-free regression: 16 request controls, four composer/validator comparison executions (same and separate source sections), nominal inflections, reversed comparison, target switch, typed rejection, unchanged legacy primary-topic lookup and local treatment refusal. PASS; real external calls zero. Full TypeScript and git diff --check PASS.

Model prompts, scientific sources, gold, judge, thresholds, authentication and Report unchanged. Old HTTP200-but-irrelevant answer and historical failures remain preserved. No independent acceptance or production readiness is asserted. A new two-turn authenticated Preview smoke is reserved separately; no retry for a better semantic result.
