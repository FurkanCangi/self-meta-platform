# DNA Chat Student-First — B1-R0 authority migration map

Date: 2026-09-02
Status: **COMPLETE / NO RUNTIME BEHAVIOR CHANGE**

## Boundary

This map freezes Candidate 34 (`a4541e5`) as the final provider-first candidate and assigns every semantic field to an Architecture B1 layer. It does not change production, deployment, the Student40 fixture, thresholds, gold labels, Fresh Student60, or the current runtime path.

## Old authority map

The provider-first frame currently authors all of these fields in one open-ended response:

| Existing field | Current source | Current local handling | B1 owner |
|---|---|---|---|
| `semanticActs` | provider | priority resolver and request-intent grounding | observed facts plus closed unresolved task choice |
| `conversationAction` | provider | deterministic correction after provider output | deterministic request policy |
| `focusTargetIds` | provider | explicit-target completion and role demotion | explicit facts plus state candidate envelope |
| `contextTargetIds` | provider | overlap validation and role grounding | observed context facts |
| `rejectedTargetIds` | provider | repair-only filtering | explicit current-message rejection facts |
| `referentTurnId` | provider | history validation and fallback inference | state candidate envelope plus closed referent choice |
| `referentRole` | provider | role validation and case-chain resolution | deterministic cue and state compatibility policy |
| `presentation` | provider | request-intent grounding | observed presentation facts; provider only for bounded ambiguity |
| `summaryExtras` | provider | obligation compilation | deterministic current-message facts |
| `observationExtras` | provider | obligation compilation | deterministic current-message facts |
| safety intent | derived from resolved primary task | local obligation compiler | deterministic safety-intent facts |
| answer obligations | local compiler | already deterministic | unchanged local compiler |

## B1 layer map

### `ObservedRequestFacts`

Owns facts visible in the current message:

- explicit scientific target evidence;
- context-only behavior evidence;
- current rejections;
- semantic task candidates;
- conversation action cues;
- presentation cues;
- reference cues;
- treatment, diagnosis, and observation safety intent.

Raw user text is transient input and is not retained in the returned facts.

### `StateCandidateEnvelope`

Owns the only semantic IDs that a later provider step may select:

- focus-eligible target IDs with provenance;
- bounded referent turn IDs and roles;
- task candidates;
- deterministic conversation action and safety intent.

History-only or context-only targets remain visible for reasoning but are not automatically focus-eligible.

### `UnresolvedRequestSlots` — B1-R2

Will contain only closed choices among the candidate envelope. This layer is not implemented in B1-R1. Until B1-R2 and its boundary tests pass, the current provider runtime remains unchanged and no online candidate is authorized.

### `ResolvedStudentRequest` — B1-R2/R3

Will compile the final request with per-field provenance. Existing obligation compilation, privacy-safe state, measurement, and development adapters remain downstream consumers.

## Critical migration decisions

1. Conversation action is no longer a provider-owned field.
2. Treatment and diagnosis safety intent is no longer inferred from a provider-selected primary task.
3. Explicit targets are authoritative; context/goal wording cannot become focus without allowed state provenance.
4. A target-free treatment request may inherit only one active compatible target. Multiple active candidates produce typed ambiguity.
5. Treatment-boundary requests do not inherit an old case referent.
6. Broad summaries may use bounded history; explicit summaries may use only current explicit scope.
7. The provider will not receive permission to create new target, referent, action, or safety IDs.

## B1-R0 exit result

- Candidate 34 evidence frozen: PASS
- Existing provider-authoritative fields enumerated: PASS
- New owner assigned to every field: PASS
- Runtime behavior changed: no
- Provider calls: 0
- Production/deployment: none
