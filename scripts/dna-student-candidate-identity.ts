import { createHash } from "node:crypto"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

export const STUDENT_CANDIDATE_IDENTITY_VERSION = "student-candidate-application-bound@3"

function sourceFiles(root: string): readonly string[] {
  return readdirSync(root).flatMap((name) => {
    const entry = path.join(root, name)
    return statSync(entry).isDirectory() ? sourceFiles(entry) : /\.(?:ts|json)$/.test(entry) ? [entry] : []
  }).sort()
}

export function studentCandidateSourceFiles(): readonly string[] {
  // Bind the actual application path, including runtime selection, public
  // serialization and source data. The old component-only recipe missed a
  // runtime handoff change. Historical identities/results remain untouched.
  return Object.freeze([
    ...sourceFiles("src/lib/dna/chat"),
    "src/app/api/app/dna-chat/route.ts",
    "src/app/dna-asistani/DnaAssistantClient.tsx",
    "src/lib/dna/reportPrivacy.ts",
    "scripts/dna-adaptive-semantic-judge-a.ts",
    "scripts/dna-student-candidate-identity.ts",
  ])
}

// This source identity is not a complete build/deployment attestation.
// Full602 additionally requires its separate runtime/replay dependency identity.
export function studentCandidateSha256(readSource: (file: string) => Buffer = readFileSync): string {
  const digest = createHash("sha256").update(STUDENT_CANDIDATE_IDENTITY_VERSION).update("\0")
  for (const file of studentCandidateSourceFiles()) digest.update(file).update("\0").update(readSource(file)).update("\0")
  return digest.digest("hex")
}
