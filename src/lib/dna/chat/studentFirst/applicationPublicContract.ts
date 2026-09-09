export const STUDENT_APPLICATION_RESPONSE_VERSION = "dna-student-application-response@1" as const
export const STUDENT_APPLICATION_RUNTIME = "student_first_candidate" as const
export const STUDENT_APPLICATION_REFUSAL_VERSION = "dna-student-application-refusal@2" as const

export function hasValidStudentApplicationResponse(row: Record<string, unknown>): boolean {
  const contract = row.studentCandidate as Record<string, unknown> | null
  return row.runtimeGeneration === STUDENT_APPLICATION_RUNTIME
    && Boolean(contract && contract.schemaVersion === STUDENT_APPLICATION_RESPONSE_VERSION
      && contract.releaseEligible === false && contract.rawMessagesStored === false
      && ["prose", "bullets", "table"].includes(String(contract.presentationFormat))
      && typeof contract.candidateSha256 === "string" && /^[a-f0-9]{64}$/.test(contract.candidateSha256)
      && contract.candidateSha256 === row.packageSha256)
    && typeof row.engineVersion === "string" && (row.engineVersion.startsWith("dna-student-answer-executor@")
      // Read historical @1 envelopes without certifying their text against @2.
      // Candidate/replay identity and releaseEligible=false remain mandatory.
      || ([STUDENT_APPLICATION_REFUSAL_VERSION, "dna-student-application-refusal@1"].includes(row.engineVersion) && row.classification === "refusal"
        && row.outcome === "refused" && contract?.executionMode === "normal_refusal_completion"))
    && row.limitedRolloutContract === undefined && row.limitedRolloutFeedbackEligible !== true
    && row.packageVersion === STUDENT_APPLICATION_RESPONSE_VERSION
}
