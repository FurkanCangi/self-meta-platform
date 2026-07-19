export const DNA_CHAT_RUNTIME_SELECTION_VERSION =
  "dna-chat-runtime-selection@1" as const

export type DnaChatRuntimeSelectionInput = Readonly<{
  runtimeEligible: boolean
  releaseAllowed: boolean
  manifestCounts: Readonly<{
    sources: number
    passages: number
    claims: number
    claimPassageLinks: number
    lexicalEntries: number
  }>
  loadedCounts: Readonly<{
    sources: number
    passages: number
    claims: number
    claimPassageLinks: number
    lexicalEntries: number
  }>
}>

export type DnaChatRuntimeSelection = Readonly<{
  selectionVersion: typeof DNA_CHAT_RUNTIME_SELECTION_VERSION
  generation: "v2_legacy" | "v3" | "blocked"
  reason:
    | "v3_package_empty"
    | "v3_not_released"
    | "v3_released_package_ready"
    | "v3_released_package_incomplete"
    | "v3_release_gate_denied"
}>

function allZero(counts: DnaChatRuntimeSelectionInput["loadedCounts"]): boolean {
  return Object.values(counts).every((count) => count === 0)
}

function positiveComplete(counts: DnaChatRuntimeSelectionInput["loadedCounts"]): boolean {
  return counts.sources > 0
    && counts.passages > 0
    && counts.claims > 0
    && counts.claimPassageLinks > 0
    && counts.lexicalEntries > 0
}

function countsMatch(input: DnaChatRuntimeSelectionInput): boolean {
  return (Object.keys(input.loadedCounts) as Array<keyof typeof input.loadedCounts>)
    .every((key) => input.loadedCounts[key] === input.manifestCounts[key])
}

/**
 * Chooses only between the committed V2 rollback catalog and a fully released
 * V3 package. A package that claims runtime eligibility but is incomplete or
 * fails its release gate is a deployment error and fails closed; it never
 * silently falls back to a different knowledge authority.
 */
export function selectDnaChatRuntime(
  input: DnaChatRuntimeSelectionInput,
): DnaChatRuntimeSelection {
  const result = (
    generation: DnaChatRuntimeSelection["generation"],
    reason: DnaChatRuntimeSelection["reason"],
  ): DnaChatRuntimeSelection => Object.freeze({
    selectionVersion: DNA_CHAT_RUNTIME_SELECTION_VERSION,
    generation,
    reason,
  })

  if (!input.runtimeEligible) {
    return result("v2_legacy", allZero(input.loadedCounts)
      ? "v3_package_empty"
      : "v3_not_released")
  }
  if (!positiveComplete(input.loadedCounts) || !countsMatch(input)) {
    return result("blocked", "v3_released_package_incomplete")
  }
  if (!input.releaseAllowed) {
    return result("blocked", "v3_release_gate_denied")
  }
  return result("v3", "v3_released_package_ready")
}
