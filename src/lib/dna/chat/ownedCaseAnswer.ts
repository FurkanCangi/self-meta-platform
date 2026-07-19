import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"

import {
  attachVerifiedReportCaseAuthorityInternal,
} from "./caseContext"
import {
  createVerifiedReportCaseAuthorityInternal,
} from "./knowledgeAuthority"
import {
  createCanonicalOwnedDnaCaseContext,
  DNA_OWNED_CASE_CONTEXT_VERSION,
} from "./ownedCaseContextCore"
import type { DnaChatMode } from "./types"
import type { DnaV3ResponseDepth } from "./v3ResponseProfiles"
import { resolveCommittedDnaChatRuntime } from "./v3RetrievalServer"
import type { DnaChatRuntimeAnswer } from "./runtimeAnswer"

type ReportRow = {
  id: string
  assessment_id: string | null
  snapshot_json: unknown
}

type AssessmentRow = {
  id: string
  client_id: string | null
}

type ClientRow = {
  id: string
  owner_id: string | null
}

export type DnaOwnedCaseAnswerResult =
  | { ok: true; answer: DnaChatRuntimeAnswer }
  | { ok: false; status: 404 | 500; error: "report_not_found" | "dna_chat_failed" }

/**
 * Server-only production boundary for report-derived answers.
 *
 * The user-scoped Supabase client and RLS are used for every read. The full
 * report -> active assessment -> active client -> session owner chain is
 * re-read here, then the snapshot is reduced to an enumerated canonical
 * context. Neither a caller-supplied ownership flag nor free report text can
 * mint report-derived authority.
 */
export async function resolveOwnedDnaCaseAnswer(input: {
  userId: string
  reportId: string
  question: string
  mode?: DnaChatMode
  previousTopic?: string | null
  responseDepth?: DnaV3ResponseDepth | null
}): Promise<DnaOwnedCaseAnswerResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: reportData, error: reportError } = await supabase
      .from("reports")
      .select("id, assessment_id, snapshot_json")
      .eq("id", input.reportId)
      .maybeSingle()

    if (reportError) return { ok: false, status: 500, error: "dna_chat_failed" }
    const report = reportData as ReportRow | null
    if (!report?.id || !report.assessment_id) {
      return { ok: false, status: 404, error: "report_not_found" }
    }

    const { data: assessmentData, error: assessmentError } = await supabase
      .from("assessments_v2")
      .select("id, client_id")
      .eq("id", report.assessment_id)
      .is("deleted_at", null)
      .maybeSingle()

    if (assessmentError) return { ok: false, status: 500, error: "dna_chat_failed" }
    const assessment = assessmentData as AssessmentRow | null
    if (!assessment?.id || !assessment.client_id) {
      return { ok: false, status: 404, error: "report_not_found" }
    }

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id, owner_id")
      .eq("id", assessment.client_id)
      .eq("owner_id", input.userId)
      .is("deleted_at", null)
      .maybeSingle()

    if (clientError) return { ok: false, status: 500, error: "dna_chat_failed" }
    const client = clientData as ClientRow | null
    if (!client?.id || client.owner_id !== input.userId) {
      return { ok: false, status: 404, error: "report_not_found" }
    }

    const canonical = createCanonicalOwnedDnaCaseContext(report.snapshot_json, {
      reportId: input.reportId,
      loadedReportId: report.id,
      assessmentId: report.assessment_id,
      loadedAssessmentId: assessment.id,
      clientId: assessment.client_id,
      loadedClientId: client.id,
      ownerId: client.owner_id,
      sessionUserId: input.userId,
    })
    // Both source and final-safe hashes are calculated and bound inside the
    // canonicalizer. Keeping the provenance object reachable until issuance
    // makes the mint depend on the completed canonical pass, not raw input.
    if (
      !canonical.provenance.sourcePayloadSha256 ||
      !canonical.provenance.safeContextSha256 ||
      !canonical.provenance.lineageBindingSha256
    ) {
      return { ok: false, status: 500, error: "dna_chat_failed" }
    }

    const authority = createVerifiedReportCaseAuthorityInternal(
      DNA_OWNED_CASE_CONTEXT_VERSION,
    )
    attachVerifiedReportCaseAuthorityInternal(canonical.context, authority)

    return {
      ok: true,
      answer: resolveCommittedDnaChatRuntime({
        mode: input.mode,
        question: input.question,
        previousTopic: input.previousTopic,
        caseContext: canonical.context,
        responseDepth: input.responseDepth,
      }),
    }
  } catch {
    return { ok: false, status: 500, error: "dna_chat_failed" }
  }
}
