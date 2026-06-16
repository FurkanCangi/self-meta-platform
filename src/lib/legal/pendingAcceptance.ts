import { ACTIVE_LEGAL_DOCUMENTS, type PlanCode } from "./documents"

export const PENDING_LEGAL_ACCEPTANCE_STORAGE_KEY = "dna_signup_pending_legal_acceptance"

export type PendingLegalAcceptance = {
  planCode: PlanCode
  sourcePath: string
  method: "email" | "google"
  acceptedAt: string
  documentVersion?: string
}

export function createPendingLegalAcceptance({
  planCode,
  sourcePath,
  method,
}: {
  planCode: PlanCode
  sourcePath: string
  method: "email" | "google"
}): PendingLegalAcceptance {
  return {
    planCode,
    sourcePath,
    method,
    acceptedAt: new Date().toISOString(),
    documentVersion: ACTIVE_LEGAL_DOCUMENTS[0]?.version,
  }
}

