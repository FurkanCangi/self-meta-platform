import assert from "node:assert/strict"

import {
  requestDnaS13StructuredOutput,
  requestDnaS13StructuredOutputDetailed,
} from "../src/lib/dna/chat/s13/server"
import {
  createEmptyStudentConversationState,
  studentSemanticFrameSchema,
  validateStudentSemanticFrame,
  validateStudentSemanticFrameDetailed,
} from "../src/lib/dna/chat/studentFirst"
import {
  DNA_STUDENT_MAX_PROVIDER_CALLS_PER_TURN,
  DNA_STUDENT_MAX_PROVIDER_ATTEMPTS,
  DNA_STUDENT_MAX_TRANSPORT_RETRIES_PER_TURN,
  interpretStudentRequestWithProvider,
} from "../src/lib/dna/chat/studentFirst/semanticInterpreter.server"

const base = Object.freeze({
  name: "dna_provider_boundary_test",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["ok"],
    properties: { ok: { type: "boolean" } },
  },
  instructions: "Return the requested structure.",
  content: "test",
  maxOutputTokens: 32,
  apiKey: "test-key-not-a-secret",
})

function mockResponse(payload: unknown, status = 200): typeof fetch {
  return (async () => new Response(
    typeof payload === "string" ? payload : JSON.stringify(payload),
    { status, headers: { "content-type": "application/json" } },
  )) as typeof fetch
}

function mockSequence(rows: readonly Readonly<{ payload: unknown; status?: number }>[]): Readonly<{
  fetchImpl: typeof fetch
  calls: () => number
}> {
  let index = 0
  return Object.freeze({
    fetchImpl: (async () => {
      const row = rows[index++]
      if (!row) throw new Error("unexpected mock provider call")
      return new Response(JSON.stringify(row.payload), {
        status: row.status ?? 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch,
    calls: () => index,
  })
}

function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key))
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  return Object.prototype.hasOwnProperty.call(row, key) || Object.values(row).some((item) => hasKey(item, key))
}

async function main() {
  const success = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: mockResponse({
      id: "resp_test",
      output_text: JSON.stringify({ ok: true }),
      usage: { input_tokens: 10, output_tokens: 2, input_tokens_details: { cached_tokens: 3 } },
    }),
  })
  if (!success.ok) throw new Error(success.failure.reason)
  assert.deepEqual(success.result.value, { ok: true })
  assert.deepEqual(success.result.usage, { inputTokens: 10, cachedInputTokens: 3, outputTokens: 2 })

  const http400 = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: mockResponse({ error: { type: "invalid_request_error", code: "invalid_json_schema", message: "must not be exposed" } }, 400),
  })
  assert.deepEqual(http400, {
    ok: false,
    failure: { reason: "http_error", httpStatus: 400, apiErrorType: "invalid_request_error", apiErrorCode: "invalid_json_schema" },
  })
  assert.equal(JSON.stringify(http400).includes("must not be exposed"), false)

  const auth = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: mockResponse({ error: { type: "invalid_request_error", code: "invalid_api_key" } }, 401),
  })
  assert.equal(auth.ok, false)
  if (auth.ok) throw new Error("expected auth failure")
  assert.equal(auth.failure.httpStatus, 401)
  assert.equal(auth.failure.apiErrorCode, "invalid_api_key")

  const quota = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: mockResponse({ error: { type: "insufficient_quota", code: "insufficient_quota" } }, 429),
  })
  assert.equal(quota.ok, false)
  if (quota.ok) throw new Error("expected quota failure")
  assert.equal(quota.failure.apiErrorCode, "insufficient_quota")

  const rateLimit = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: mockResponse({ error: { type: "rate_limit_error", code: "rate_limit_exceeded" } }, 429),
  })
  assert.equal(rateLimit.ok, false)
  if (rateLimit.ok) throw new Error("expected rate-limit failure")
  assert.equal(rateLimit.failure.apiErrorCode, "rate_limit_exceeded")

  const invalidResponseJson = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: mockResponse("not-json"),
  })
  assert.equal(invalidResponseJson.ok, false)
  if (invalidResponseJson.ok) throw new Error("expected response-json failure")
  assert.equal(invalidResponseJson.failure.reason, "invalid_response_json")

  const empty = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: mockResponse({ id: "resp_empty" }),
  })
  assert.equal(empty.ok, false)
  if (empty.ok) throw new Error("expected empty-output failure")
  assert.equal(empty.failure.reason, "empty_output")

  const invalidOutputJson = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: mockResponse({ output_text: "{" }),
  })
  assert.equal(invalidOutputJson.ok, false)
  if (invalidOutputJson.ok) throw new Error("expected output-json failure")
  assert.equal(invalidOutputJson.failure.reason, "invalid_output_json")

  const timeout = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: (async () => { throw new DOMException("aborted", "AbortError") }) as typeof fetch,
  })
  assert.equal(timeout.ok, false)
  if (timeout.ok) throw new Error("expected timeout")
  assert.equal(timeout.failure.reason, "timeout")

  const network = await requestDnaS13StructuredOutputDetailed({
    ...base,
    fetchImpl: (async () => { throw new Error("network detail must not escape") }) as typeof fetch,
  })
  assert.equal(network.ok, false)
  if (network.ok) throw new Error("expected network failure")
  assert.equal(network.failure.reason, "network_error")
  assert.equal(JSON.stringify(network).includes("network detail"), false)

  const previousKey = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    const missingKey = await requestDnaS13StructuredOutputDetailed({
      ...base,
      apiKey: "",
      fetchImpl: (async () => { throw new Error("fetch must not run") }) as typeof fetch,
    })
    assert.equal(missingKey.ok, false)
    if (missingKey.ok) throw new Error("expected missing key")
    assert.equal(missingKey.failure.reason, "missing_key")
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  }

  const legacyNull = await requestDnaS13StructuredOutput({
    ...base,
    fetchImpl: mockResponse({ error: { type: "invalid_request_error", code: "invalid_json_schema" } }, 400),
  })
  assert.equal(legacyNull, null, "legacy callers must retain null-on-failure behavior")

  const state = createEmptyStudentConversationState()
  const schema = studentSemanticFrameSchema(state)
  assert.equal(hasKey(schema, "uniqueItems"), false, "student provider schema must stay within the known working subset")
  assert.equal(hasKey(schema, "obligationKinds"), false, "provider must not own final answer obligations")
  assert.equal(hasKey(schema, "mentionedTargetIds"), false, "flat target mentions must not remain in the provider schema")
  assert.equal(hasKey(schema, "focusTargetIds"), true)
  assert.equal(hasKey(schema, "contextTargetIds"), true)
  const validFrame = {
    semanticActs: {
      define: true,
      explain: false,
      compare: false,
      example: false,
      case_reasoning: false,
      summarize: false,
      observe: false,
      evidence: false,
      treatment_boundary: false,
    },
    conversationAction: "start",
    focusTargetIds: ["executive_functions"],
    contextTargetIds: [],
    rejectedTargetIds: [],
    referentTurnId: null,
    referentRole: "none",
    presentation: { depth: "standard", language: "standard", format: "prose", example: "none", grouping: "integrated", requestedSentenceCount: null, preserveMeaning: false },
    summaryExtras: { unknown: false, observationFocus: false },
    observationExtras: { singleObservationLimit: false, additionalContext: false },
  }
  assert.ok(validateStudentSemanticFrame(validFrame, state))
  assert.equal(validateStudentSemanticFrame({ ...validFrame, focusTargetIds: ["executive_functions", "executive_functions"] }, state), null)
  assert.deepEqual(
    validateStudentSemanticFrameDetailed({ ...validFrame, focusTargetIds: ["executive_functions", "executive_functions"] }, state),
    { ok: false, failureCode: "invalid_focus_targets" },
  )
  assert.deepEqual(
    validateStudentSemanticFrameDetailed({ ...validFrame, contextTargetIds: ["executive_functions"] }, state),
    { ok: false, failureCode: "target_role_overlap" },
  )
  assert.equal(validateStudentSemanticFrame({ ...validFrame, summaryExtras: { unknown: "yes", observationFocus: false } }, state), null)
  assert.deepEqual(
    validateStudentSemanticFrameDetailed({ ...validFrame, semanticActs: Object.fromEntries(Object.keys(validFrame.semanticActs).map((key) => [key, false])) }, state),
    { ok: false, failureCode: "invalid_semantic_acts" },
  )

  const emptyActsFrame = {
    ...validFrame,
    semanticActs: Object.fromEntries(Object.keys(validFrame.semanticActs).map((key) => [key, false])),
  }
  const repairSuccessSequence = mockSequence([
    { payload: { id: "resp_repair_1", output_text: JSON.stringify(emptyActsFrame), usage: { input_tokens: 10, output_tokens: 2 } } },
    { payload: { id: "resp_repair_2", output_text: JSON.stringify(validFrame), usage: { input_tokens: 11, output_tokens: 3, input_tokens_details: { cached_tokens: 4 } } } },
  ])
  const repaired = await interpretStudentRequestWithProvider({
    turnId: "REPAIR-BOUNDARY-T01",
    message: "yürütücü işlevler ne demek",
    state,
    apiKey: "test-key-not-a-secret",
    fetchImpl: repairSuccessSequence.fetchImpl,
  })
  assert.equal(repaired.ok, true)
  assert.equal(repairSuccessSequence.calls(), DNA_STUDENT_MAX_PROVIDER_ATTEMPTS)
  assert.equal(repaired.provider.attempts, 2)
  assert.equal(repaired.provider.semanticAttempts, 2)
  assert.equal(repaired.provider.transportRetries, 0)
  assert.equal(repaired.provider.repairAttempted, true)
  assert.equal(repaired.provider.usageComplete, true)
  assert.deepEqual(repaired.provider.usage, { inputTokens: 21, cachedInputTokens: 4, outputTokens: 5 })

  const repairFailureSequence = mockSequence([
    { payload: { id: "resp_repair_fail_1", output_text: JSON.stringify(emptyActsFrame), usage: { input_tokens: 7, output_tokens: 2 } } },
    { payload: { id: "resp_repair_fail_2", output_text: JSON.stringify(emptyActsFrame), usage: { input_tokens: 8, output_tokens: 2 } } },
  ])
  const repairFailed = await interpretStudentRequestWithProvider({
    turnId: "REPAIR-BOUNDARY-T02",
    message: "yürütücü işlevler ne demek",
    state,
    apiKey: "test-key-not-a-secret",
    fetchImpl: repairFailureSequence.fetchImpl,
  })
  assert.equal(repairFailed.ok, false)
  if (repairFailed.ok || repairFailed.reason !== "invalid_structured_output") throw new Error("expected bounded repair failure")
  assert.equal(repairFailed.failureCode, "invalid_semantic_acts")
  assert.equal(repairFailed.provider.attempts, 2)
  assert.equal(repairFailed.provider.semanticAttempts, 2)
  assert.equal(repairFailed.provider.transportRetries, 0)
  assert.deepEqual(repairFailed.provider.usage, { inputTokens: 15, cachedInputTokens: 0, outputTokens: 4 })
  assert.equal(repairFailureSequence.calls(), DNA_STUDENT_MAX_PROVIDER_ATTEMPTS, "a second invalid frame must hard-stop without a third call")

  let transportRecoveryCalls = 0
  const transportRecovered = await interpretStudentRequestWithProvider({
    turnId: "TRANSPORT-BOUNDARY-T01",
    message: "yürütücü işlevler ne demek",
    state,
    apiKey: "test-key-not-a-secret",
    fetchImpl: (async () => {
      transportRecoveryCalls += 1
      if (transportRecoveryCalls === 1) throw new DOMException("aborted", "AbortError")
      return new Response(JSON.stringify({
        id: "resp_transport_recovered",
        output_text: JSON.stringify(validFrame),
        usage: { input_tokens: 12, output_tokens: 3 },
      }), { status: 200, headers: { "content-type": "application/json" } })
    }) as typeof fetch,
  })
  assert.equal(transportRecovered.ok, true)
  assert.equal(transportRecoveryCalls, 2)
  assert.equal(transportRecovered.provider.attempts, 2)
  assert.equal(transportRecovered.provider.semanticAttempts, 1)
  assert.equal(transportRecovered.provider.transportRetries, 1)
  assert.equal(transportRecovered.provider.repairAttempted, false)
  assert.equal(transportRecovered.provider.usageComplete, false, "an aborted request may have unreported provider usage")

  let terminalTransportCalls = 0
  const terminalTransportFailure = await interpretStudentRequestWithProvider({
    turnId: "TRANSPORT-BOUNDARY-T02",
    message: "yürütücü işlevler ne demek",
    state,
    apiKey: "test-key-not-a-secret",
    fetchImpl: (async () => {
      terminalTransportCalls += 1
      throw new DOMException("aborted", "AbortError")
    }) as typeof fetch,
  })
  assert.equal(terminalTransportFailure.ok, false)
  if (terminalTransportFailure.ok || terminalTransportFailure.reason !== "provider_failure") throw new Error("expected bounded transport failure")
  assert.equal(terminalTransportFailure.failure.reason, "timeout")
  assert.equal(terminalTransportCalls, 2)
  assert.equal(terminalTransportFailure.provider.attempts, 2)
  assert.equal(terminalTransportFailure.provider.semanticAttempts, 1)
  assert.equal(terminalTransportFailure.provider.transportRetries, DNA_STUDENT_MAX_TRANSPORT_RETRIES_PER_TURN)
  assert.equal(terminalTransportFailure.provider.usageComplete, false)

  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_PROVIDER_BOUNDARY_LOCAL",
    failureClassesCovered: 9,
    secretOrRawErrorMessagesPersisted: 0,
    legacyBehaviorPreserved: true,
    studentSchemaKnownSubset: true,
    runtimeUniquenessValidation: true,
    providerOwnsFinalObligations: false,
    targetRolesSeparated: true,
    boundedStructuredRepair: true,
    maxProviderAttemptsPerTurn: DNA_STUDENT_MAX_PROVIDER_ATTEMPTS,
    boundedTransportRetry: true,
    maxTransportRetriesPerTurn: DNA_STUDENT_MAX_TRANSPORT_RETRIES_PER_TURN,
    maxProviderCallsPerTurn: DNA_STUDENT_MAX_PROVIDER_CALLS_PER_TURN,
    transportFailureUsageMarkedPartial: true,
    aggregateRepairUsage: true,
    rawProviderOutputReusedForRepair: false,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
