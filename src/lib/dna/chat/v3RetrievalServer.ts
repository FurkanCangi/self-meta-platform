import "server-only"

import { DNA_V3_STATIC_PACKAGE } from "./catalog/generated/v3/server"
import {
  DNA_CURRENT_V3_RELEASE_PACKAGE,
} from "./governance/releaseCompiler"
import { evaluateDnaChatRuntimeRelease } from "./governance/runtimeReleaseGate"
import { validateCurrentDnaV3StaticPackage } from "./governance/v3StaticPackage"
import { resolveDnaChat } from "./engine"
import {
  createDnaV2RuntimeAnswer,
  createDnaV3RuntimeAnswerInternal,
  type DnaChatRuntimeAnswer,
} from "./runtimeAnswer"
import { selectDnaChatRuntime } from "./runtimeSelection"
import { resolveDnaV3Retrieval } from "./v3RetrievalCore"
import { adaptDnaV3StaticPackageForRetrieval } from "./v3RetrievalPackageAdapter"
import type { DnaChatMode, DnaChatSafeCaseContext } from "./types"
import type { DnaV3ResponseDepth } from "./v3ResponseProfiles"

/**
 * Revalidate the loader export at the runtime import boundary. This prevents a
 * modified loader from serving content that only reuses an older descriptor or
 * manifest hash while bypassing the loader's own validation call.
 */
const DNA_V3_VALIDATED_STATIC_PACKAGE = validateCurrentDnaV3StaticPackage(
  DNA_V3_STATIC_PACKAGE,
)
const DNA_V3_RETRIEVAL_PACKAGE = adaptDnaV3StaticPackageForRetrieval(
  DNA_V3_VALIDATED_STATIC_PACKAGE,
)

function committedRuntimeSelection() {
  const releaseDecision = DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.runtimeEligible
    ? evaluateDnaChatRuntimeRelease({
        generation: "v3",
        engineVersion: "dna-chat-engine@3",
        packageSha256: DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.packageSha256,
        releasePackageInputSha256:
          DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.releasePackageInputSha256,
        candidates: DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates.map((candidate) => ({
          candidateId: candidate.candidateId,
          authorizationDigest: candidate.authorizationDigest,
        })),
      })
    : null
  return selectDnaChatRuntime({
    runtimeEligible: DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.runtimeEligible,
    releaseAllowed: releaseDecision?.allowed === true,
    manifestCounts: {
      sources: DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.counts.included.sources,
      passages: DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.counts.included.passages,
      claims: DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.counts.included.claims,
      claimPassageLinks:
        DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.counts.included.claimPassageLinks,
      lexicalEntries:
        DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.counts.included.lexicalEntries,
    },
    loadedCounts: {
      sources: DNA_V3_VALIDATED_STATIC_PACKAGE.sources.length,
      passages: DNA_V3_VALIDATED_STATIC_PACKAGE.passages.length,
      claims: DNA_V3_VALIDATED_STATIC_PACKAGE.claims.length,
      claimPassageLinks: DNA_V3_VALIDATED_STATIC_PACKAGE.claimPassageLinks.length,
      lexicalEntries: DNA_V3_VALIDATED_STATIC_PACKAGE.lexicalIndex.entries.length,
    },
  })
}

export function getCommittedDnaChatRuntimeStatus() {
  const selection = committedRuntimeSelection()
  return Object.freeze({
    ...selection,
    engineVersion: selection.generation === "v3"
      ? "dna-chat-engine@3"
      : selection.generation === "v2_legacy"
        ? "dna-chat-engine@2"
        : null,
    catalogVersion: selection.generation !== "v2_legacy"
      ? DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.graphVersion
      : "dna-chat-catalog@2",
    packageVersion: selection.generation !== "v2_legacy"
      ? DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.schemaVersion
      : "dna-chat-catalog@2",
    packageSha256: selection.generation !== "v2_legacy"
      ? DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.packageSha256
      : null,
  })
}

/** Server-only V3 retrieval boundary. The committed package is never caller supplied. */
export function resolveCommittedDnaV3Retrieval(input: Readonly<{
  question: string
  previousTopic?: string | null
  caseContext?: DnaChatSafeCaseContext | null
  responseDepth?: DnaV3ResponseDepth | null
}>) {
  const selection = committedRuntimeSelection()
  if (selection.generation !== "v3") {
    throw new Error(`dna_v3_runtime_unavailable:${selection.reason}`)
  }
  return resolveDnaV3Retrieval(input, DNA_V3_RETRIEVAL_PACKAGE)
}

/**
 * Production runtime switch. The current empty V3 trust root stays explicitly
 * on V2. Once a nonempty committed package is both runtime-eligible and passes
 * the release tuple gate, the same API path moves to V3 automatically.
 */
export function resolveCommittedDnaChatRuntime(input: Readonly<{
  question: string
  mode?: DnaChatMode
  previousTopic?: string | null
  caseContext?: DnaChatSafeCaseContext | null
  responseDepth?: DnaV3ResponseDepth | null
}>): DnaChatRuntimeAnswer {
  const selection = committedRuntimeSelection()
  if (selection.generation === "blocked") {
    throw new Error(`dna_chat_runtime_selection_blocked:${selection.reason}`)
  }
  if (selection.generation === "v2_legacy") {
    return createDnaV2RuntimeAnswer(resolveDnaChat({
      question: input.question,
      mode: input.mode,
      previousTopic: input.previousTopic,
      caseContext: input.caseContext ?? undefined,
    }))
  }

  if (!DNA_V3_RETRIEVAL_PACKAGE.sources.length
    || !DNA_V3_RETRIEVAL_PACKAGE.passages.length
    || !DNA_V3_RETRIEVAL_PACKAGE.claims.length
    || !DNA_V3_RETRIEVAL_PACKAGE.claimPassageLinks.length
    || !DNA_V3_RETRIEVAL_PACKAGE.lexicalIndex.length) {
    throw new Error("dna_chat_runtime_selection_blocked:v3_retrieval_adapter_incomplete")
  }

  return createDnaV3RuntimeAnswerInternal({
    answer: resolveDnaV3Retrieval(input, DNA_V3_RETRIEVAL_PACKAGE),
    catalogVersion: DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.graphVersion,
    packageVersion: DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.schemaVersion,
    packageSha256: DNA_V3_VALIDATED_STATIC_PACKAGE.manifest.packageSha256,
  })
}
