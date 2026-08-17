import { getDnaOwnerBookRuntimeStatus } from "../../ownerBookRuntime"
import { DNA_S13_CONVERSATION_CONTEXT_VERSION, DNA_S13_CONTEXT_OPERATIONS } from "../conversationContext"
import { DNA_S13_CANARY_ARCHITECTURE_HASH, DNA_S13_CANARY_ARCHITECTURE_VERSION } from "../canary/freeze"
import { hashDnaS13Artifact } from "../strictHash"
import { DNA_S13_REALIZER_CONTRACT_VERSION } from "../strictRealizer"
import { DNA_S13_STRICT_PLAN_VERSION } from "../strictContracts"
import { DNA_S13_STRICT_PROMPT_VERSION } from "../strictPrompt"
import { DNA_S13_STRICT_FAILURES, DNA_S13_STRICT_VALIDATOR_VERSION } from "../strictValidator"
import { DNA_S13_LIMITED_ROLLOUT_RELEASE_VERSION } from "./responseContract"

export const DNA_INTELLIGENCE_RELEASE_VERSION = "dna-intelligence-v1" as const
export const DNA_S13_STRICT_RELEASE_VERSION = "s13-strict-v4" as const
export const DNA_S13_CONTEXT_FIX_RELEASE_VERSION = "conversation-context-fix-v1" as const
export { DNA_S13_LIMITED_ROLLOUT_RELEASE_VERSION } from "./responseContract"

export function getDnaS13LimitedRolloutReleaseCandidate() {
  const catalog = getDnaOwnerBookRuntimeStatus()
  const promptHash = hashDnaS13Artifact({
    version: DNA_S13_STRICT_PROMPT_VERSION,
    planVersion: DNA_S13_STRICT_PLAN_VERSION,
    realizerContractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
  })
  const validatorHash = hashDnaS13Artifact({
    version: DNA_S13_STRICT_VALIDATOR_VERSION,
    failureCodes: DNA_S13_STRICT_FAILURES,
  })
  const contextResolverHash = hashDnaS13Artifact({
    version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
    operations: DNA_S13_CONTEXT_OPERATIONS,
  })
  const fingerprints = Object.freeze({
    architecture: Object.freeze({
      version: DNA_S13_CANARY_ARCHITECTURE_VERSION,
      hash: DNA_S13_CANARY_ARCHITECTURE_HASH,
    }),
    catalog: Object.freeze({ version: catalog.retrievalVersion, hash: catalog.sourceSha256 }),
    retrieval: Object.freeze({ version: catalog.retrievalVersion, hash: catalog.sourceSha256 }),
    prompt: Object.freeze({ version: DNA_S13_STRICT_PROMPT_VERSION, hash: promptHash }),
    validator: Object.freeze({ version: DNA_S13_STRICT_VALIDATOR_VERSION, hash: validatorHash }),
    contextResolver: Object.freeze({
      version: DNA_S13_CONVERSATION_CONTEXT_VERSION,
      hash: contextResolverHash,
    }),
  })
  const releaseBase = Object.freeze({
    dnaIntelligenceVersion: DNA_INTELLIGENCE_RELEASE_VERSION,
    s13StrictVersion: DNA_S13_STRICT_RELEASE_VERSION,
    conversationContextFixVersion: DNA_S13_CONTEXT_FIX_RELEASE_VERSION,
    releaseVersion: DNA_S13_LIMITED_ROLLOUT_RELEASE_VERSION,
    fingerprints,
  })
  return Object.freeze({
    ...releaseBase,
    releaseHash: hashDnaS13Artifact(releaseBase),
    immutable: true as const,
    canaryPassed: true as const,
    rolloutActivated: false as const,
    trainingEnabled: false as const,
  })
}
