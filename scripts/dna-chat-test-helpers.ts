import { createDnaChatSafeCaseContext } from "../src/lib/dna/chat/caseContext"
import type {
  DnaChatCaseContextInput,
  DnaChatSafeCaseContext,
} from "../src/lib/dna/chat/types"

export const TEST_REPORT_LINEAGE_IDS = Object.freeze({
  reportId: "11111111-1111-4111-8111-111111111111",
  assessmentId: "22222222-2222-4222-8222-222222222222",
  clientId: "33333333-3333-4333-8333-333333333333",
  ownerId: "44444444-4444-4444-8444-444444444444",
})

/**
 * Unit scripts never mint production report authority. They use an explicitly
 * synthetic context; the production case path is covered separately by the
 * canonical snapshot and live cross-account gates.
 */
export function createVerifiedTestCaseContext(
  input: DnaChatCaseContextInput | DnaChatSafeCaseContext,
): DnaChatSafeCaseContext {
  return createDnaChatSafeCaseContext({
    ...input,
    dataStatus: "synthetic",
  })
}
