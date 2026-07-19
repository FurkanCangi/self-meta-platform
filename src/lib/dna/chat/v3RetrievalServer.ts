import "server-only"

import { DNA_V3_STATIC_PACKAGE } from "./catalog/generated/v3/server"
import {
  DNA_CURRENT_V3_RELEASE_PACKAGE,
} from "./governance/releaseCompiler"
import { evaluateDnaChatRuntimeRelease } from "./governance/runtimeReleaseGate"
import { resolveDnaV3Retrieval } from "./v3RetrievalCore"
import { adaptDnaV3StaticPackageForRetrieval } from "./v3RetrievalPackageAdapter"
import type { DnaChatSafeCaseContext } from "./types"

const DNA_V3_RETRIEVAL_PACKAGE = adaptDnaV3StaticPackageForRetrieval(DNA_V3_STATIC_PACKAGE)

/** Server-only V3 retrieval boundary. The committed package is never caller supplied. */
export function resolveCommittedDnaV3Retrieval(input: Readonly<{
  question: string
  previousTopic?: string | null
  caseContext?: DnaChatSafeCaseContext | null
}>) {
  if (DNA_V3_STATIC_PACKAGE.manifest.runtimeEligible) {
    const decision = evaluateDnaChatRuntimeRelease({
      generation: "v3",
      engineVersion: "dna-chat-engine@3",
      releasePackageInputSha256: DNA_V3_STATIC_PACKAGE.manifest.releasePackageInputSha256,
      candidates: DNA_CURRENT_V3_RELEASE_PACKAGE.releasedCandidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        authorizationDigest: candidate.authorizationDigest,
      })),
    })
    if (!decision.allowed) throw new Error(`dna_v3_runtime_release_denied:${decision.blockCode}`)
  }
  return resolveDnaV3Retrieval(input, DNA_V3_RETRIEVAL_PACKAGE)
}
