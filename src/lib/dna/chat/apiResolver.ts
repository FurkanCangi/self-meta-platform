import { resolveDnaChat } from "./engine"
import { evaluateDnaChatRuntimeRelease } from "./governance/runtimeReleaseGate"
import { DNA_INTELLIGENCE_PUBLIC_INTENDED_USE } from "./intendedUse"
import { DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION } from "./knowledgeAuthority"
import type { DnaKnowledgeAuthorityRef } from "./knowledgeAuthority"
import {
  createDnaV2RuntimeAnswer,
  isDnaChatRuntimeAnswerAuthentic,
  type DnaChatRuntimeAnswer,
  type DnaChatRuntimeMetadata,
} from "./runtimeAnswer"
import type {
  DnaChatAnswerUnit,
  DnaChatMode,
  DnaChatResponse,
  DnaChatRoute,
} from "./types"
import {
  DNA_V3_RESPONSE_DEPTH_SPEC,
  resolveDnaV3ResponseDepth,
  type DnaV3ResponseDepth,
} from "./v3ResponseProfiles"
import type { DnaV3RetrievalAnswer } from "./v3RetrievalCore"
import type { DnaV3AnswerAuthority, DnaV3AnswerUnit } from "./v3AnswerEvidence"

export type DnaChatApiPayload = {
  question: string
  reportId?: string
  mode?: DnaChatMode
  responseDepth?: DnaV3ResponseDepth
  context?: { previousTopic?: string }
}

export type DnaChatLatencyCategory = "lt_100ms" | "100_to_999ms" | "gte_1000ms"
export type DnaChatAuditErrorCode =
  | "invalid_payload"
  | "mode_report_mismatch"
  | "unauthorized"
  | "session_expired"
  | "report_not_found"
  | "payload_too_large"
  | "too_many_requests"
  | "audit_unavailable"
  | "dna_chat_failed"

export type DnaChatApiAuditInput = {
  requestId: string
  mode: DnaChatMode | DnaChatRoute
  intentId: string | null
  classification: DnaChatResponse["classification"]
  outcome: DnaChatResponse["outcome"]
  engineVersion: string
  runtimeGeneration: DnaChatRuntimeMetadata["generation"]
  catalogVersion: string
  packageVersion: string
  packageSha256: string | null
  intendedUseVersion: string
  sourceIds: string[]
  authorityContractVersion: string
  policyVersion: string
  authoritySet: string[]
  responseDepth: DnaV3ResponseDepth
  latencyCategory: DnaChatLatencyCategory
  errorCode: DnaChatAuditErrorCode | null
}

export const DNA_CHAT_AUDIT_METADATA_KEYS = Object.freeze([
  "request_id",
  "mode",
  "intent",
  "classification",
  "outcome",
  "engine_version",
  "runtime_generation",
  "catalog_version",
  "package_version",
  "package_sha256",
  "intended_use_version",
  "authority_contract_version",
  "policy_version",
  "authority_set",
  "refused",
  "source_ids",
  "response_depth",
  "latency_category",
  "error_code",
] as const)

export function buildDnaChatAuditMetadata(input: DnaChatApiAuditInput) {
  return {
    request_id: input.requestId,
    mode: input.mode,
    intent: input.intentId,
    classification: input.classification,
    outcome: input.outcome,
    engine_version: input.engineVersion,
    runtime_generation: input.runtimeGeneration,
    catalog_version: input.catalogVersion,
    package_version: input.packageVersion,
    package_sha256: input.packageSha256,
    intended_use_version: input.intendedUseVersion,
    authority_contract_version: input.authorityContractVersion,
    policy_version: input.policyVersion,
    authority_set: Array.from(new Set(input.authoritySet.filter(Boolean))).sort(),
    refused: input.classification === "refusal" || input.outcome === "refused",
    source_ids: Array.from(new Set(input.sourceIds.filter(Boolean))).slice(0, 16),
    response_depth: input.responseDepth,
    latency_category: input.latencyCategory,
    error_code: input.errorCode,
  }
}

export type DnaChatCaseLoadResult =
  | { ok: true; answer: DnaChatResponse | DnaChatRuntimeAnswer }
  | { ok: false; status: 404 | 500; error: "report_not_found" | "dna_chat_failed" }

export type DnaChatApiResolverDependencies = {
  createRequestId: () => string
  resolveRuntimeAnswer?: (input: Readonly<{
    question: string
    mode?: DnaChatMode
    previousTopic?: string | null
    responseDepth: DnaV3ResponseDepth
  }>) => Promise<DnaChatRuntimeAnswer> | DnaChatRuntimeAnswer
  loadCaseAnswer: (input: {
    reportId: string
    question: string
    mode?: DnaChatMode
    previousTopic?: string | null
    responseDepth: DnaV3ResponseDepth
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

function sourceIdsFromAnswer(answer: DnaChatResponse, maxSources: number): string[] {
  return Array.from(new Set(answer.sources.map((source) => source.id).filter(Boolean))).slice(0, maxSources)
}

function sourceIdsFromRuntime(runtime: DnaChatRuntimeAnswer, maxSources: number): string[] {
  if (runtime.generation === "v2_legacy") return sourceIdsFromAnswer(runtime.answer, maxSources)
  return Array.from(new Set(runtime.answer.sources
    .map((source) => source.sourceId)
    .filter(Boolean))).slice(0, maxSources)
}

function latencyCategory(elapsedMs: number): DnaChatLatencyCategory {
  if (elapsedMs < 100) return "lt_100ms"
  if (elapsedMs < 1_000) return "100_to_999ms"
  return "gte_1000ms"
}

function monotonicNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}

function responseUnits(
  answer: DnaChatResponse,
  responseDepth: DnaV3ResponseDepth,
  visibleSourceIds: ReadonlySet<string>,
): DnaChatAnswerUnit[] {
  const spec = DNA_V3_RESPONSE_DEPTH_SPEC[responseDepth]
  let candidates: DnaChatAnswerUnit[]
  if (responseDepth === "short") {
    const summary = answer.answerUnits.find((unit) => unit.kind === "summary") ?? answer.answerUnits[0]
    const boundary = answer.answerUnits.find((unit) =>
      unit.kind === "safety_boundary" || unit.kind === "limitation")
    candidates = [summary, boundary].filter((unit): unit is DnaChatAnswerUnit => Boolean(unit))
  } else {
    candidates = answer.answerUnits.filter((unit, index, all) => {
      if (unit.role !== "scientific_evidence" && unit.role !== "dna_specific_validation") return true
      const scientificIndex = all.slice(0, index + 1).filter((candidate) =>
        candidate.role === "scientific_evidence" || candidate.role === "dna_specific_validation").length
      return scientificIndex <= spec.maxScientificUnits
    })
  }

  const maxUnits = responseDepth === "short" ? 2 : responseDepth === "standard" ? 7 : 16
  return [...new Map(candidates.map((unit) => [unit.id, {
    ...unit,
    sourceIds: unit.sourceIds.filter((sourceId) => visibleSourceIds.has(sourceId)),
  }])).values()]
    .filter((unit) => {
      const requiresSource = unit.role === "product_definition"
        || unit.role === "scientific_evidence"
        || unit.role === "dna_specific_validation"
      return !requiresSource || unit.sourceIds.length > 0
    })
    .slice(0, maxUnits)
}

function responseSources(answer: DnaChatResponse, maxSources: number) {
  const sourceById = new Map(answer.sources.map((source) => [source.id, source]))
  const prioritizedIds = answer.answerUnits.flatMap((unit) => unit.sourceIds)
  const ordered = [
    ...prioritizedIds.flatMap((sourceId) => {
      const source = sourceById.get(sourceId)
      return source ? [source] : []
    }),
    ...answer.sources,
  ]
  return [...new Map(ordered.map((source) => [source.id, source])).values()].slice(0, maxSources)
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

function publicAnswer(
  answer: DnaChatResponse,
  requestId: string,
  responseDepth: DnaV3ResponseDepth,
) {
  const spec = DNA_V3_RESPONSE_DEPTH_SPEC[responseDepth]
  const sources = responseSources(answer, spec.maxSources)
  const visibleSourceIds = new Set(sources.map((source) => source.id))
  const detailsLimit = responseDepth === "short" ? 0 : responseDepth === "standard" ? 4 : 12
  const secondaryLimit = responseDepth === "short" ? 1 : responseDepth === "standard" ? 4 : 8
  return {
    ok: true,
    requestId,
    responseDepth,
    classification: answer.classification,
    summary: answer.summary,
    details: answer.details.slice(0, detailsLimit),
    sources: sources.map((source) => ({
      ...source,
      authority: publicAuthority(source.authority),
    })),
    answerUnits: responseUnits(answer, responseDepth, visibleSourceIds).map((unit) => ({
      ...unit,
      authority: publicAuthority(unit.authority),
    })),
    authoritySummary: answer.authoritySummary,
    caseEvidence: answer.caseEvidence.slice(0, secondaryLimit),
    limitations: answer.limitations.slice(0, secondaryLimit),
    safetyBoundary: answer.safetyBoundary,
    intendedUse: answer.intendedUse,
    suggestedQuestions: answer.suggestedQuestions.slice(0, responseDepth === "short" ? 2 : 3),
    engineVersion: answer.engineVersion,
    topic: answer.topic,
    ...(answer.contextRequest ? { contextRequest: answer.contextRequest } : {}),
    ...(answer.evidenceSummary ? { evidenceSummary: answer.evidenceSummary } : {}),
  }
}

type PublicV3Authority = Readonly<{
  contractVersion: typeof DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION
  layer: "dna_product_information" | "external_scientific_information" | "case_information" | "safety_and_product_boundaries"
  approvalRequirement: "owner_approved" | "codex_multi_pass_audited" | "report_derived" | "policy_enforced"
  verificationStatus: "verified"
  releaseEligible: true
  labelTr: string
  boundaryTr: string
}>

function publicV3Authority(authority: DnaV3AnswerAuthority): PublicV3Authority {
  if (authority === "dna_product") {
    return Object.freeze({
      contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
      layer: "dna_product_information",
      approvalRequirement: "owner_approved",
      verificationStatus: "verified",
      releaseEligible: true,
      labelTr: "DNA ürün bilgisi · sahip onaylı",
      boundaryTr: "Sahip onayı ürün tanımını destekler; tek başına bilimsel geçerlik veya biyolojik mekanizma kanıtı değildir.",
    })
  }
  if (authority === "case_report") {
    return Object.freeze({
      contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
      layer: "case_information",
      approvalRequirement: "report_derived",
      verificationStatus: "verified",
      releaseEligible: true,
      labelTr: "Seçili rapor bulgusu",
      boundaryTr: "Yalnız sahipliği doğrulanmış raporun güvenli yapılandırılmış bağlamıdır; biyolojik mekanizma ölçümü değildir.",
    })
  }
  if (authority === "safety_policy") {
    return Object.freeze({
      contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
      layer: "safety_and_product_boundaries",
      approvalRequirement: "policy_enforced",
      verificationStatus: "verified",
      releaseEligible: true,
      labelTr: "Güvenlik ve ürün sınırı",
      boundaryTr: "Sürümlü ürün politikası diğer bilgi katmanlarından üstündür.",
    })
  }
  return Object.freeze({
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    layer: "external_scientific_information",
    approvalRequirement: "codex_multi_pass_audited",
    verificationStatus: "verified",
    releaseEligible: true,
    labelTr: "Dış bilimsel bilgi · çok geçişli denetlenmiş",
    boundaryTr: "Bilimsel bilgi kendi iddia, pasaj, yaş ve örneklem sınırı içinde kullanılır; DNA ürün geçerliğini kendiliğinden kurmaz.",
  })
}

function publicV3Unit(
  unit: DnaV3AnswerUnit,
  answer: DnaV3RetrievalAnswer,
  publicCardIdByInternalId: ReadonlyMap<string, string>,
  publicUnitId: string,
) {
  const inLimitations = answer.limitations.includes(unit.text)
  const fallbackKind = unit.id.match(/^policy::v3-fallback-(summary|detail|limitation|safety-boundary)(?:-|$)/)?.[1]
  const kind = unit.authority === "case_report"
    ? "case_evidence" as const
    : unit.authority === "safety_policy"
      ? fallbackKind === "summary"
        ? "summary" as const
        : fallbackKind === "detail"
          ? "detail" as const
          : fallbackKind === "limitation"
            ? "limitation" as const
            : fallbackKind === "safety-boundary"
              ? "safety_boundary" as const
              : unit.section === "case_non_inference" || unit.section === "boundary"
                ? "safety_boundary" as const
                : "limitation" as const
      : unit.text === answer.summary
        ? "summary" as const
        : inLimitations
          ? "limitation" as const
          : "detail" as const
  const role = unit.authority === "dna_product"
    ? "product_definition" as const
    : unit.authority === "external_science"
      ? "scientific_evidence" as const
      : unit.authority === "case_report"
        ? "case_finding" as const
        : "safety_boundary" as const
  const citationCardIds = answer.sources
    .filter((source) =>
      unit.claimIds.includes(source.supportedClaimId)
      && unit.passageIds.includes(source.passageId)
      && unit.sourceIds.includes(source.sourceId))
    .flatMap((source) => {
      const publicCardId = publicCardIdByInternalId.get(source.id)
      return publicCardId ? [publicCardId] : []
    })
  return {
    id: publicUnitId,
    section: unit.section,
    kind,
    role,
    text: unit.text,
    authority: publicV3Authority(unit.authority),
    sourceIds: [...unit.sourceIds],
    citationCardIds,
  }
}

function fallbackV3PolicyUnits(answer: DnaV3RetrievalAnswer): readonly DnaV3AnswerUnit[] {
  type FallbackUnitSpec = Readonly<{
    kind: "summary" | "detail" | "limitation" | "safety-boundary"
    section: DnaV3AnswerUnit["section"]
    text: string
    index: number
  }>
  const candidates: FallbackUnitSpec[] = [
    { kind: "summary", section: "definition", text: answer.summary, index: 0 },
    ...answer.details.map((text, index) => ({
      kind: "detail" as const,
      section: "function_or_relation" as const,
      text,
      index,
    })),
    ...answer.limitations.map((text, index) => ({
      kind: "limitation" as const,
      section: "counter_evidence" as const,
      text,
      index,
    })),
    {
      kind: "safety-boundary",
      section: "boundary",
      text: answer.safetyBoundary,
      index: 0,
    },
  ]

  // Keep every distinct visible statement. If the same sentence occurs in
  // more than one field, the later and stricter semantic role wins while the
  // original display position stays deterministic (Map replacement semantics).
  const distinctByText = new Map<string, FallbackUnitSpec>()
  for (const candidate of candidates) {
    const text = candidate.text.trim()
    if (!text) continue
    distinctByText.set(text, { ...candidate, text })
  }

  return Object.freeze([...distinctByText.values()].map((candidate) => Object.freeze({
    id: `policy::v3-fallback-${candidate.kind}-${candidate.index + 1}`,
    section: candidate.section,
    authority: "safety_policy" as const,
    text: candidate.text,
    claimIds: Object.freeze([]),
    passageIds: Object.freeze([]),
    sourceIds: Object.freeze([]),
    caseFieldIds: Object.freeze([]),
  })))
}

function publicV3Answer(
  answer: DnaV3RetrievalAnswer,
  requestId: string,
  runtime: DnaChatRuntimeMetadata,
) {
  const units = answer.answerUnits.length ? answer.answerUnits : fallbackV3PolicyUnits(answer)
  if (!units.length) return null
  const publicCardIdByInternalId = new Map(answer.sources.map((source, index) =>
    [source.id, `citation-card-${index + 1}`]))
  const publicUnits = units.map((unit, index) => publicV3Unit(
    unit,
    answer,
    publicCardIdByInternalId,
    `answer-unit-${index + 1}`,
  ))
  if (units.some((unit, index) =>
    (unit.authority === "external_science" || unit.authority === "dna_product")
    && publicUnits[index].citationCardIds.length === 0)) {
    return null
  }
  const authorityBySourceId = new Map<string, DnaV3AnswerAuthority>()
  for (const unit of units) {
    for (const sourceId of unit.sourceIds) {
      if (!authorityBySourceId.has(sourceId)) authorityBySourceId.set(sourceId, unit.authority)
    }
  }
  const authorities = [...new Map(publicUnits
    .map((unit) => [unit.authority.layer, unit.authority])).values()]
  const caseEvidence = units
    .filter((unit) => unit.authority === "case_report" && unit.section === "case_finding")
    .map((unit) => unit.text)
  return {
    ok: true,
    requestId,
    responseDepth: answer.responseDepth,
    classification: answer.classification,
    summary: answer.summary,
    details: [...answer.details],
    sources: answer.sources.map((source) => ({
      id: publicCardIdByInternalId.get(source.id),
      sourceId: source.sourceId,
      type: "literature",
      title: source.title,
      authors: source.authors,
      year: source.year,
      sourceType: source.sourceType,
      doi: source.doi,
      officialUrl: source.officialUrl,
      locator: source.locator,
      evidenceLevel: source.evidenceLevel,
      ageScope: source.ageScope,
      supportedClaim: source.supportedClaim,
      knownBoundary: source.knownBoundary,
      supportedBoundary: source.supportedBoundary,
      excerptTr: source.supportedClaim,
      claimBoundary: source.knownBoundary,
      url: source.officialUrl ?? (source.doi ? `https://doi.org/${source.doi}` : undefined),
      authority: publicV3Authority(authorityBySourceId.get(source.sourceId) ?? "external_science"),
    })),
    answerUnits: publicUnits,
    authoritySummary: authorities,
    caseEvidence,
    limitations: [...answer.limitations],
    safetyBoundary: answer.safetyBoundary,
    intendedUse: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
    suggestedQuestions: [...answer.suggestedQuestions],
    engineVersion: runtime.engineVersion,
    runtimeGeneration: runtime.generation,
    catalogVersion: runtime.catalogVersion,
    packageVersion: runtime.packageVersion,
    packageSha256: runtime.packageSha256,
    topic: answer.topic,
    ...(answer.contextRequest ? { contextRequest: answer.contextRequest } : {}),
    ...(answer.evidenceSummary ? {
      evidenceSummary: {
        ...answer.evidenceSummary,
        sampleScope: "Kaynak kartında belirtilen yayın ve örneklem kapsamıyla sınırlıdır.",
      },
    } : {}),
  }
}

function publicRuntimeAnswer(
  runtime: DnaChatRuntimeAnswer,
  requestId: string,
  responseDepth: DnaV3ResponseDepth,
) {
  if (runtime.generation === "v3") return publicV3Answer(runtime.answer, requestId, runtime.metadata)
  return {
    ...publicAnswer(runtime.answer, requestId, responseDepth),
    runtimeGeneration: runtime.metadata.generation,
    catalogVersion: runtime.metadata.catalogVersion,
    packageVersion: runtime.metadata.packageVersion,
    packageSha256: runtime.metadata.packageSha256,
  }
}

function normalizeLoadedRuntimeAnswer(
  answer: DnaChatResponse | DnaChatRuntimeAnswer,
): DnaChatRuntimeAnswer | null {
  if (isDnaChatRuntimeAnswerAuthentic(answer)) return answer
  try {
    return createDnaV2RuntimeAnswer(answer as DnaChatResponse)
  } catch {
    return null
  }
}

export async function resolveDnaChatApiRequest(
  payload: DnaChatApiPayload,
  dependencies: DnaChatApiResolverDependencies,
): Promise<DnaChatApiResolution> {
  const startedAt = monotonicNow()
  const legacyCaseMode = payload.mode === "case"
  const responseDepth = resolveDnaV3ResponseDepth(payload.question, payload.responseDepth)
  let runtimeAnswer = dependencies.resolveRuntimeAnswer
    ? await dependencies.resolveRuntimeAnswer({
        mode: payload.mode,
        question: payload.question,
        previousTopic: payload.context?.previousTopic || null,
        responseDepth,
      })
    : createDnaV2RuntimeAnswer(resolveDnaChat({
        mode: payload.mode,
        question: payload.question,
        previousTopic: payload.context?.previousTopic || null,
      }))

  if (!isDnaChatRuntimeAnswerAuthentic(runtimeAnswer)) {
    return { status: 500, body: { ok: false, error: "dna_chat_failed" }, accessedCaseReport: false }
  }

  let accessedCaseReport = false
  const requiresCaseContext = runtimeAnswer.generation === "v3"
    ? runtimeAnswer.answer.intent !== "theory" || runtimeAnswer.answer.contextRequest?.type === "report"
    : runtimeAnswer.answer.route === "case" || runtimeAnswer.answer.contextRequest?.type === "report"
  if (requiresCaseContext && payload.reportId) {
    const loaded = await dependencies.loadCaseAnswer({
      reportId: payload.reportId,
      question: payload.question,
      mode: payload.mode,
      previousTopic: payload.context?.previousTopic || null,
      responseDepth,
    })
    if (!loaded.ok) {
      return {
        status: loaded.status,
        body: { ok: false, error: loaded.error },
        accessedCaseReport: false,
      }
    }

    accessedCaseReport = true
    const normalized = normalizeLoadedRuntimeAnswer(loaded.answer)
    if (!normalized) {
      return {
        status: 500,
        body: { ok: false, error: "dna_chat_failed" },
        accessedCaseReport: true,
      }
    }
    runtimeAnswer = normalized
  }

  // Engine-version allowlisting is not an authenticity proof: a caller could
  // copy an arbitrary object and label it with an allowed version. Require the
  // exact, unchanged object minted by the engine before any audit or public
  // response work.
  if (!isDnaChatRuntimeAnswerAuthentic(runtimeAnswer)) {
    return {
      status: 500,
      body: { ok: false, error: "dna_chat_failed" },
      accessedCaseReport,
    }
  }

  // The current engine is retained only through the explicit V2 rollback
  // policy. Any future/forged engine version fails closed until it supplies a
  // V3 descriptor whose package hash and candidate authorization digests match
  // the committed release package.
  const runtimeRelease = runtimeAnswer.generation === "v2_legacy"
    ? evaluateDnaChatRuntimeRelease({
        generation: "v2_legacy",
        engineVersion: runtimeAnswer.metadata.engineVersion,
      })
    : { allowed: true }
  if (!runtimeRelease.allowed) {
    return {
      status: 500,
      body: { ok: false, error: "dna_chat_failed" },
      accessedCaseReport,
    }
  }

  const requestId = dependencies.createRequestId()
  // Public serialization is part of the success contract. Validate it before
  // writing a success audit so an unbound/missing citation can never be logged
  // as an answered request and then returned as a 500.
  const publicBody = publicRuntimeAnswer(runtimeAnswer, requestId, responseDepth)
  if (!publicBody) {
    return {
      status: 500,
      body: { ok: false, error: "dna_chat_failed" },
      accessedCaseReport,
    }
  }
  let route: DnaChatRoute
  let outcome: DnaChatResponse["outcome"]
  let intentId: string | null
  let authoritySet: string[]
  let intendedUseVersion: string
  if (runtimeAnswer.generation === "v3") {
    const answer = runtimeAnswer.answer
    route = answer.intent === "theory" ? "theory" : "case"
    outcome = answer.status === "answer"
      ? "answered"
      : answer.status === "refusal"
        ? "refused"
        : answer.status
    intentId = answer.topic
    authoritySet = Array.from(new Set(
      (answer.answerUnits.length ? answer.answerUnits : [{ authority: "safety_policy" as const }])
        .map((unit) => publicV3Authority(unit.authority).layer),
    ))
    intendedUseVersion = DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.version
  } else {
    const answer = runtimeAnswer.answer
    route = answer.route
    outcome = answer.outcome
    intentId = answer.intentId
    authoritySet = answer.authoritySummary.map((entry) => entry.layer)
    intendedUseVersion = answer.intendedUse.version
  }
  const audit = await dependencies.writeAudit({
    requestId,
    mode: route === "unknown"
      ? (legacyCaseMode ? "case" : (payload.mode ?? "unknown"))
      : route,
    intentId,
    classification: runtimeAnswer.answer.classification,
    outcome,
    engineVersion: runtimeAnswer.metadata.engineVersion,
    runtimeGeneration: runtimeAnswer.metadata.generation,
    catalogVersion: runtimeAnswer.metadata.catalogVersion,
    packageVersion: runtimeAnswer.metadata.packageVersion,
    packageSha256: runtimeAnswer.metadata.packageSha256,
    intendedUseVersion,
    sourceIds: sourceIdsFromRuntime(runtimeAnswer, DNA_V3_RESPONSE_DEPTH_SPEC[responseDepth].maxSources),
    authorityContractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    policyVersion: intendedUseVersion,
    authoritySet,
    responseDepth,
    latencyCategory: latencyCategory(monotonicNow() - startedAt),
    errorCode: null,
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
    body: publicBody,
    accessedCaseReport,
  }
}
