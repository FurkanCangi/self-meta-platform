import assert from "node:assert/strict"

import {
  requestDnaS13StructuredOutput,
  requestDnaS13StructuredOutputDetailed,
} from "../src/lib/dna/chat/s13/server"
import {
  createEmptyStudentConversationState,
  studentSemanticFrameSchema,
  validateStudentSemanticFrame,
} from "../src/lib/dna/chat/studentFirst"

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
  const validFrame = {
    semanticTask: "define",
    conversationAction: "start",
    targetIds: ["executive_functions"],
    rejectedTargetIds: [],
    comparisonTargetIds: [],
    componentTargetIds: [],
    referent: { kind: "none", turnId: null, targetIds: [] },
    presentation: { depth: "standard", language: "standard", format: "prose", example: "none", requestedSentenceCount: null },
    obligationKinds: ["define_target"],
    ambiguity: "none",
    safetyIntent: "general_education",
  }
  assert.ok(validateStudentSemanticFrame(validFrame, state))
  assert.equal(validateStudentSemanticFrame({ ...validFrame, targetIds: ["executive_functions", "executive_functions"] }, state), null)

  console.log(JSON.stringify({
    ok: true,
    gate: "STUDENT_PROVIDER_BOUNDARY_LOCAL",
    failureClassesCovered: 9,
    secretOrRawErrorMessagesPersisted: 0,
    legacyBehaviorPreserved: true,
    studentSchemaKnownSubset: true,
    runtimeUniquenessValidation: true,
  }, null, 2))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
