# DNA Chat Student-First — Phase 1 candidate 2 hard stop

Date: 2026-09-02

## Candidate decision

- Candidate: orthogonal request-contract axes
- Parent commit: `53d81df5dc0690ccf22f7cffc687a4d850d4c933`
- Production mutation: none
- Deployment: none
- Provider calls/cost: 0 / $0
- Frozen or sealed fixture mutation: none

Candidate 2 separated:

- `semanticTask`
- `conversationAction`
- `presentation`

This structural change resolved Candidate 1's first-turn collision: a plain-language definition remained `semanticTask=define` while `presentation.language=plain_student`.

## Verification

- TypeScript preflight: PASS
- Student Smoke8: FAIL / hard-stop
- Completed contracts before failure: 3/8
- Failed turn: `SMOKE8-T04`

Input:

> bu örnekte tek gözlemle inhibisyonu zayıf diyebilir miyim başka neye bakarım

Expected:

```json
{
  "semanticTask": "observe",
  "conversationAction": "continue",
  "targetIds": ["inhibition"]
}
```

Actual semantic task: `explain`

## Root cause

The contract shape is now correct, but raw-language interpretation is still a surface-regex classifier. The observation cue recognizes the bare phrase `tek gözlem` but not the natural Turkish inflection `tek gözlemle`, because the word-boundary pattern ends before the suffix.

Adding one more suffix alternative would only patch this exact sentence. Normal Turkish can express the same intent as `tek gözlemle`, `bir kere görerek`, `sadece bunu gördüğümde`, or `tek dersten`. Candidate 2 therefore fails the architecture requirement, not merely a fixture spelling case.

## Next architecture decision

Candidate 3 must introduce a typed semantic-interpreter boundary:

1. hard safety/privacy remains deterministic;
2. raw Turkish is interpreted into the three-axis request contract by one bounded semantic interpreter;
3. the state reducer consumes only validated structured fields;
4. lexical rules may normalize identifiers and enforce schema limits, but may not decide the user's semantic task;
5. Smoke8 must still run unchanged and must exercise the full raw-message-to-contract path.

Candidate 2 will not be patched or rerun. No Student40, holdout, provider preflight, or production step is authorized from this result.
