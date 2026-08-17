import { normalizeDnaChatText } from "../text"
import type { DnaS13Claim } from "./contracts"
import type { DnaS13StrictRelationContract, DnaS13StrictRelationType } from "./strictContracts"

export const DNA_S13_STRICT_RELATION_CONTRACT_VERSION = "dna-s13-strict-relations@1" as const

const RELATION_MARKERS: Readonly<Record<DnaS13StrictRelationType, readonly string[]>> = Object.freeze({
  causality: Object.freeze(["bunun nedeni", "çünkü", "neden olabilir", "neden olur", "yol açabilir", "yol açar"]),
  consequence: Object.freeze([
    "bunun sonucunda", "buna bağlı olarak", "bu nedenle", "dolayısıyla", "sonucunda", "böylece", "bu yüzden",
  ]),
  explanation: Object.freeze(["başka bir deyişle", "diğer bir deyişle", "yani"]),
  contrast: Object.freeze(["buna karşın", "buna rağmen", "aynı kalırken", "rağmen", "oysa", "ancak", "fakat"]),
  temporal_order: Object.freeze(["ardından", "daha sonra", "sonrasında", "önce", "sonra"]),
  equivalence: Object.freeze(["eşdeğerdir", "aynı anlama gelir", "aynı düzeyde"]),
  hierarchy: Object.freeze(["alt başlığıdır", "üst başlığıdır", "parçasıdır", "kapsar"]),
  comparison_conclusion: Object.freeze(["temel fark", "temel ayrım", "ayrılmalıdır"]),
})

export type DnaS13DetectedRelation = Readonly<{
  type: DnaS13StrictRelationType
  marker: string
  normalizedMarker: string
}>

export function detectDnaS13Relations(text: string): readonly DnaS13DetectedRelation[] {
  // “yanı sıra” is additive, not the explanatory connective “yani”. Relation
  // markers are also matched as complete normalized phrases, not substrings.
  const normalized = normalizeDnaChatText(text).replace(/\byani sira\b/g, " ")
  const containsMarker = (marker: string) => {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "u").test(normalized)
  }
  const candidates = Object.entries(RELATION_MARKERS)
    .flatMap(([type, markers]) => markers.map((marker) => ({
      type: type as DnaS13StrictRelationType,
      marker,
      normalizedMarker: normalizeDnaChatText(marker),
    })))
    .filter((entry) => containsMarker(entry.normalizedMarker))
    .sort((left, right) => right.normalizedMarker.length - left.normalizedMarker.length)
  return Object.freeze(candidates.filter((entry, index, rows) =>
    rows.findIndex((other) => other.type === entry.type
      && other.normalizedMarker.includes(entry.normalizedMarker)) === index,
  ))
}

export function relationContractsFromClaim(claim: DnaS13Claim): readonly DnaS13StrictRelationContract[] {
  const detected = [...detectDnaS13Relations(claim.text)]
  const normalized = normalizeDnaChatText(claim.text)
  // Turkish realizations commonly use “kapsar” for a source sentence that
  // defines a capacity/process through its included elements (“içerir”,
  // “örnektir”, “... kapasitesidir”). This preserves the source relation type
  // without requiring one exact connective.
  if (!detected.some((relation) => relation.type === "hierarchy")
    && /\b(?:icerir\w*|ornektir\w*|kapasitesidir\w*|surecidir\w*)\b/u.test(normalized)) {
    detected.push(Object.freeze({
      type: "hierarchy" as const,
      marker: "semantic inclusion",
      normalizedMarker: "semantic inclusion",
    }))
  }
  return Object.freeze(detected.map((relation, index) => Object.freeze({
    id: `relation:${claim.id}:${relation.type}:${index + 1}`,
    version: DNA_S13_STRICT_RELATION_CONTRACT_VERSION,
    type: relation.type,
    support: "claim_text" as const,
    sourceClaimIds: Object.freeze([claim.id]),
    targetClaimIds: Object.freeze([claim.id]),
    surfaceMarkers: Object.freeze([relation.marker]),
    controlledText: null,
  })))
}

export function relationMarkerAllowed(
  detected: DnaS13DetectedRelation,
  contracts: readonly DnaS13StrictRelationContract[],
) {
  // The contract locks the semantic relation type, not one Turkish connective.
  // A claim that explicitly supports causality may therefore be realized with
  // either “çünkü” or “bunun nedeni”; an unsupported relation type still fails.
  return contracts.some((contract) => contract.type === detected.type)
}
