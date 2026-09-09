import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { openStudentReplayJournal } from "./dna-student-replay-journal"
import { replayHash } from "./dna-student-application-replay"
import { calculateDnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"

export const STABILIZATION_BUDGET_MICROUSD = 20_000_000
export function reserveStabilizationRequest(body: Record<string, unknown>, spent: number) {
  assert.equal(body.model, "gpt-5.6-luna", "unapproved_model")
  assert.equal(body.store, false, "provider_storage_forbidden")
  const bytes = Buffer.byteLength(JSON.stringify(body))
  assert.ok(bytes <= 200_000, "request_size_limit")
  assert.ok(Number.isInteger(body.max_output_tokens) && Number(body.max_output_tokens) > 0
    && Number(body.max_output_tokens) <= 6000, "unbounded_output")
  // UTF-8 byte count bounds byte-tokenized input conservatively, including schema.
  const reserve = bytes + Number(body.max_output_tokens) * 6 + 10_000
  assert.ok(spent + reserve <= STABILIZATION_BUDGET_MICROUSD, "stabilization_total_budget_stop")
  return reserve
}

/** One task-wide, single-writer ledger independent of future product/judge versions. */
export function installStabilizationBudget() {
  const identity = replayHash("dna-b1-stabilization-user-approved-20usd-20260907")
  const { journal, file } = openStudentReplayJournal("budget", identity, identity)
  const events = existsSync(file) ? readFileSync(file, "utf8").trim().split(/\n/).filter(Boolean).map(l => JSON.parse(l)) : []
  const last = new Map<string, any>()
  for (const e of events) last.set(e.key, e)
  assert.ok([...last.values()].every(e => e.stage === "completed"), "budget_pending_call_do_not_retry")
  let spent = [...last.values()].reduce((n, e) => n + e.value.chargedMicrousd, 0)
  let stopped = [...last.values()].some(e => !e.value.exactUsage)
  let calls = last.size
  const beforeSpent = spent, beforeCalls = calls
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    assert.ok(!stopped, "budget_usage_uncertain_stop")
    assert.equal(String(url), "https://api.openai.com/v1/responses", "unapproved_external_endpoint")
    const text = String(init?.body), body = JSON.parse(text)
    const reservation = reserveStabilizationRequest(body, spent)
    let response: Response | undefined
    const request = { ordinal: ++calls, requestSha256: replayHash(text), reservedMicrousd: reservation }
    const charge = await journal.once(`call-${calls}`, request, async () => {
      try {
        response = await original(url, init)
        const raw = await response.clone().json() as any, u = raw?.usage
        const cached = u?.input_tokens_details?.cached_tokens ?? 0
        const exact = response.ok && Number.isSafeInteger(u?.input_tokens) && Number.isSafeInteger(u?.output_tokens)
          && Number.isSafeInteger(cached) && cached >= 0 && cached <= u.input_tokens
          && u.input_tokens >= 0 && u.output_tokens >= 0
        const actual = exact ? calculateDnaChatLunaUsage({ inputTokens: u.input_tokens,
          cachedInputTokens: cached, outputTokens: u.output_tokens }).costMicrousd : reservation
        return { chargedMicrousd: Math.max(0, actual), exactUsage: !!exact, httpStatus: response.status,
          reservationExceeded: actual > reservation }
      } catch {
        return { chargedMicrousd: reservation, exactUsage: false, httpStatus: null, reservationExceeded: false }
      }
    })
    spent += charge.chargedMicrousd
    stopped = !charge.exactUsage || charge.reservationExceeded || spent > STABILIZATION_BUDGET_MICROUSD
    if (!response) throw new Error("provider_response_unknown_reserved_budget_stop")
    return response
  }
  return { file, snapshot: () => ({ capMicrousd: STABILIZATION_BUDGET_MICROUSD, chargedMicrousd: spent,
    newChargedMicrousd: spent - beforeSpent, calls, newCalls: calls - beforeCalls, usageUncertainStop: stopped }),
    restore: () => { globalThis.fetch = original } }
}
