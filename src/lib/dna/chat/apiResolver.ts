import { resolveDnaChat } from "./engine"
import { evaluateDnaChatRuntimeRelease } from "./governance/runtimeReleaseGate"
import { DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION } from "./knowledgeAuthority"
import type { DnaKnowledgeAuthorityRef } from "./knowledgeAuthority"
import type {
  DnaChatMode,
  DnaChatResponse,
  DnaChatRoute,
} from "./types"

export type DnaChatApiPayload = {
  question: string
  reportId?: string
  mode?: DnaChatMode
  context?: { previousTopic?: string }
}

export type DnaChatApiAuditInput = {
  requestId: string
  mode: DnaChatMode | DnaChatRoute
  intentId: string | null
  classification: DnaChatResponse["classification"]
  outcome: DnaChatResponse["outcome"]
  engineVersion: string
  intendedUseVersion: string
  sourceIds: string[]
  authorityContractVersion: string
  policyVersion: string
  authoritySet: string[]
}

export const DNA_CHAT_AUDIT_METADATA_KEYS = Object.freeze([
  "request_id",
  "mode",
  "intent",
  "classification",
  "engine_version",
  "intended_use_version",
  "authority_contract_version",
  "policy_version",
  "authority_set",
  "refused",
  "source_ids",
] as const)

export function buildDnaChatAuditMetadata(input: DnaChatApiAuditInput) {
  return {
    request_id: input.requestId,
    mode: input.mode,
    intent: input.intentId,
    classification: input.classification,
    engine_version: input.engineVersion,
    intended_use_version: input.intendedUseVersion,
    authority_contract_version: input.authorityContractVersion,
    policy_version: input.policyVersion,
    authority_set: Array.from(new Set(input.authoritySet.filter(Boolean))).sort(),
    refused: input.classification === "refusal" || input.outcome === "refused",
    source_ids: Array.from(new Set(input.sourceIds.filter(Boolean))).slice(0, 16),
  }
}

export type DnaChatCaseLoadResult =
  | { ok: true; answer: DnaChatResponse }
  | { ok: false; status: 404 | 500; error: "report_not_found" | "dna_chat_failed" }

export type DnaChatApiResolverDependencies = {
  createRequestId: () => string
  loadCaseAnswer: (input: {
    reportId: string
    question: string
    mode?: DnaChatMode
    previousTopic?: string | null
  }) => Promise<DnaChatCaseLoadResult>
  writeAudit: (input: DnaChatApiAuditInput) => Promise<{ ok: boolean }>
}

export type DnaChatApiResolution = {
  status: 200 | 404 | 500 | 503
  body: Record<string, unknown>
  accessedCaseReport: boolean
}

export type DnaChatBodyReadResult =
  | { ok: true; raw: string }
  | { ok: false; error: "invalid_payload" | "payload_too_large" }

export async function readDnaChatRequestBody(
  request: Request,
  maxBytes: number,
): Promise<DnaChatBodyReadResult> {
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, error: "payload_too_large" }
  }

  if (!request.body) return { ok: true, raw: "" }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  try {
    reader = request.body.getReader()
    const decoder = new TextDecoder()
    let raw = ""
    let totalBytes = 0

    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      totalBytes += chunk.value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, error: "payload_too_large" }
      }
      raw += decoder.decode(chunk.value, { stream: true })
    }

    raw += decoder.decode()
    return { ok: true, raw }
  } catch {
    await reader?.cancel().catch(() => undefined)
    return { ok: false, error: "invalid_payload" }
  }
}

function sourceIdsFromAnswer(answer: DnaChatResponse): string[] {
  return Array.from(new Set(answer.sources.map((source) => source.id).filter(Boolean))).slice(0, 16)
}

function publicAuthority(authority: DnaKnowledgeAuthorityRef) {
  const publicEvidence = authority.proof?.kind === "owner_approval"
    ? {
        bookVersion: authority.proof.bookVersion,
        sectionId: authority.proof.sectionId,
        passageId: authority.proof.passageId,
      }
    : authority.proof?.kind === "report_lineage"
      ? { contextVersion: authority.proof.contextVersion }
      : authority.proof?.kind === "policy_contract"
        ? { policyVersion: authority.proof.policyVersion }
        : undefined
  return {
    contractVersion: authority.contractVersion,
    layer: authority.layer,
    approvalRequirement: authority.approvalRequirement,
    verificationStatus: authority.verificationStatus,
    releaseEligible: authority.releaseEligible,
    labelTr: authority.labelTr,
    boundaryTr: authority.boundaryTr,
    ...(publicEvidence ? { evidence: publicEvidence } : {}),
  }
}

function publicAnswer(answer: DnaChatResponse, requestId: string) {
  return {
    ok: true,
    requestId,
    classification: answer.classification,
    summary: answer.summary,
    details: answer.details,
    sources: answer.sources.map((source) => ({
      ...source,
      authority: publicAuthority(source.authority),
    })),
    answerUnits: answer.answerUnits.map((unit) => ({
      ...unit,
      authority: publicAuthority(unit.authority),
    })),
    authoritySummary: answer.authoritySummary,
    caseEvidence: answer.caseEvidence,
    limitations: answer.limitations,
    safetyBoundary: answer.safetyBoundary,
    intendedUse: answer.intendedUse,
    suggestedQuestions: answer.suggestedQuestions,
    engineVersion: answer.engineVersion,
    topic: answer.topic,
    ...(answer.contextRequest ? { contextRequest: answer.contextRequest } : {}),
    ...(answer.evidenceSummary ? { evidenceSummary: answer.evidenceSummary } : {}),
  }
}

export async function resolveDnaChatApiRequest(
  payload: DnaChatApiPayload,
  dependencies: DnaChatApiResolverDependencies,
): Promise<DnaChatApiResolution> {
  const legacyCaseMode = payload.mode === "case"
  let answer = await resolveDnaChat({
    mode: payload.mode,
    question: payload.question,
    previousTopic: payload.context?.previousTopic || null,
  })

  let accessedCaseReport = false
  const requiresCaseContext = answer.route === "case" || answer.contextRequest?.type === "report"
  if (requiresCaseContext && payload.reportId) {
    const loaded = await dependencies.loadCaseAnswer({
      reportId: payload.reportId,
      question: payload.question,
      mode: payload.mode,
      previousTopic: payload.context?.previousTopic || null,
    })
    if (!loaded.ok) {
      return {
        status: loaded.status,
        body: { ok: false, error: loaded.error },
        accessedCaseReport: false,
      }
    }

    accessedCaseReport = true
    answer = loaded.answer
  }

  // The current engine is retained only through the explicit V2 rollback
  // policy. Any future/forged engine version fails closed until it supplies a
  // V3 descriptor whose candidate IDs are present in the committed release
  // package.
  const runtimeRelease = evaluateDnaChatRuntimeRelease({
    generation: "v2_legacy",
    engineVersion: answer.engineVersion,
  })
  if (!runtimeRelease.allowed) {
    return {
      status: 500,
      body: { ok: false, error: "dna_chat_failed" },
      accessedCaseReport,
    }
  }

  const requestId = dependencies.createRequestId()
  const audit = await dependencies.writeAudit({
    requestId,
    mode: answer.route === "unknown"
      ? (legacyCaseMode ? "case" : (payload.mode ?? "unknown"))
      : answer.route,
    intentId: answer.intentId,
    classification: answer.classification,
    outcome: answer.outcome,
    engineVersion: answer.engineVersion,
    intendedUseVersion: answer.intendedUse.version,
    sourceIds: sourceIdsFromAnswer(answer),
    authorityContractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    policyVersion: answer.intendedUse.version,
    authoritySet: answer.authoritySummary.map((entry) => entry.layer),
  })

  if (!audit.ok && accessedCaseReport) {
    return {
      status: 503,
      body: { ok: false, error: "audit_unavailable" },
      accessedCaseReport,
    }
  }

  return {
    status: 200,
    body: publicAnswer(answer, requestId),
    accessedCaseReport,
  }
}
