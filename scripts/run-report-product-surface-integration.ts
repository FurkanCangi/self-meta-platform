import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { ASSESSMENT_SCORING_VERSION } from "../src/lib/assessment/itemScoring"
import { extractAgeMonthsFromAnamnez, isSupportedAgeMonths } from "../src/lib/dna/ageUtils"
import { validateAndNormalizeClinicalReport } from "../src/lib/dna/clinicalSafetyValidator"
import { buildJuryReadyReport } from "../src/lib/dna/reportJury"
import * as reportText from "../src/lib/dna/reportText"
import { answersForJuryTotals } from "./fixtures/dna-report-jury-cases"

type ModuleExports = Record<string, unknown>

function loadTranspiledModule(sourcePath: string, stubs: Record<string, unknown>): ModuleExports {
  const source = fs.readFileSync(sourcePath, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: sourcePath,
  }).outputText
  const moduleRecord: { exports: ModuleExports } = { exports: {} }
  const localRequire = (specifier: string) => Object.prototype.hasOwnProperty.call(stubs, specifier) ? stubs[specifier] : require(specifier)
  const evaluate = new Function("require", "module", "exports", "__filename", "__dirname", output)
  evaluate(localRequire, moduleRecord, moduleRecord.exports, sourcePath, path.dirname(sourcePath))
  return moduleRecord.exports
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

class SupabaseQueryMock {
  private operation: "read" | "insert" = "read"
  private filters = new Map<string, unknown>()

  constructor(private table: string, private state: RouteState) {}
  select() { return this }
  eq(column: string, value: unknown) { this.filters.set(column, value); return this }
  is() { return this }
  in() { return this }
  not() { return this }
  order() { return this }
  limit() { return this }
  insert(payload: unknown) { this.operation = "insert"; this.state.insertPayload = payload; return this }
  maybeSingle() { return Promise.resolve(this.result(true)) }
  single() { return Promise.resolve(this.result(true)) }
  then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
    return Promise.resolve(this.result(false)).then(onFulfilled, onRejected)
  }

  private result(single: boolean) {
    if (this.table === "profiles") return { data: { role: "therapist" }, error: null }
    if (this.table === "clients") return { data: single ? { id: "client-1", child_code: "SURFACE-CASE" } : [{ id: "client-1", child_code: "SURFACE-CASE" }], error: null }
    if (this.table === "assessments_v2") {
      const row = { id: "assessment-1", client_id: "client-1" }
      return { data: single ? row : [row], error: null }
    }
    if (this.table === "reports" && this.operation === "insert") {
      this.state.insertCount += 1
      return this.state.insertShouldFail
        ? { data: null, error: { message: "synthetic insert failure" } }
        : { data: { id: "report-1", created_at: "2026-09-03T08:00:00.000Z" }, error: null }
    }
    if (this.table === "reports") return { data: [], error: null }
    return { data: single ? null : [], error: null }
  }
}

type RouteState = {
  creditMode: "success" | "empty"
  consumeCount: number
  grantCount: number
  insertCount: number
  insertShouldFail: boolean
  insertPayload: unknown
}

function routeHarness(state: RouteState) {
  const database = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: (table: string) => new SupabaseQueryMock(table, state),
  }
  const jsonResponse = (body: unknown, init?: { status?: number }) => new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  })
  return {
    "next/server": { NextResponse: { json: jsonResponse } },
    "next/headers": { cookies: async () => ({ getAll: () => [], set: () => undefined }) },
    "@supabase/ssr": { createServerClient: () => database },
    "@/lib/security/apiGuards": {
      requireTrustedMutation: async () => null,
      requireConfirmedUser: async () => ({ ok: true, user: { id: "user-1", email: "clinician@example.invalid" } }),
    },
    "@/lib/security/payloadGuards": { rejectServerControlledFields: () => ({ ok: true }) },
    "@/lib/security/anomalyDetection": { evaluateAccountRisk: async () => undefined, recordAccountSecurityEvent: async () => undefined },
    "@/lib/security/privacyOps": { getPrivacyAuditContext: async () => ({ ipAddress: null, userAgent: null }), recordDataAccessAuditEvent: async () => undefined },
    "@/lib/security/rateLimit": { checkRateLimit: async () => ({ ok: true }), rateLimitResponse: () => jsonResponse({ ok: false }, { status: 429 }) },
    "@/lib/security/schemaGuards": {
      readJsonWithSchema: async (request: Request, schema: { safeParse: (value: unknown) => { success: boolean; data?: unknown } }) => {
        const parsed = schema.safeParse(await request.json())
        return parsed.success ? { ok: true, data: parsed.data } : { ok: false, response: jsonResponse({ ok: false }, { status: 400 }) }
      },
    },
    "@/lib/security/reportCredits": {
      consumeReportCredit: async () => {
        state.consumeCount += 1
        return state.creditMode === "success" ? { ok: true, remaining: 2 } : { ok: false, error: "report_credit_required", remaining: 0 }
      },
      grantReportCredits: async () => { state.grantCount += 1; return { ok: true } },
    },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => database },
    "@/lib/owner/ownerAccess": { isOwnerAuditEmail: () => false },
    "@/lib/dna/reportJury/index": { buildJuryReadyReport },
    "@/lib/dna/chat/reportSnapshot": { buildDnaChatSnapshotContext: () => ({}) },
    "@/lib/dna/ageUtils": { extractAgeMonthsFromAnamnez, isSupportedAgeMonths },
    "@/lib/dna/reportText": reportText,
    "@/lib/dna/clinicalSafetyValidator": { validateAndNormalizeClinicalReport },
    "@/lib/assessment/assessmentEngine": { calculateAssessment },
    "@/lib/assessment/itemScoring": { ASSESSMENT_SCORING_VERSION },
  }
}

async function runRouteCase(state: RouteState, body: Record<string, unknown>) {
  const routePath = path.join(process.cwd(), "src/app/api/ai-report/route.ts")
  const route = loadTranspiledModule(routePath, routeHarness(state)) as { POST: (request: Request) => Promise<Response> }
  return route.POST(new Request("http://localhost/api/ai-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }))
}

async function main() {
  let providerCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    providerCalls += 1
    throw new Error("PROVIDER_CALL_FORBIDDEN_IN_PRODUCT_SURFACE_TEST")
  }) as typeof fetch
  try {
    const answers = answersForJuryTotals([42, 19, 43, 41, 40, 44])
    const calculated = calculateAssessment(answers)
    const scores = {
      fizyolojik: calculated.fizyolojik,
      duyusal: calculated.duyusal,
      duygusal: calculated.duygusal,
      bilissel: calculated.bilissel,
      yurutucu: calculated.yurutucu,
      intero: calculated.intero,
      toplam: calculated.toplam,
    }
    const input = {
      clientCode: "SURFACE-CASE",
      clientId: "client-1",
      assessmentId: "assessment-1",
      ageMonths: 54,
      anamnez: "Evde elektrik süpürgesi çalışınca kulaklarını kapatıp odadan ayrılıyor. Sessiz odada aynı etkinliği tamamlıyor.",
      answers: [...answers],
      scores,
    }
    const result = await buildJuryReadyReport(input)
    assert.equal(result.validation.pass, true, result.validation.failureCodes.join(","))
    const emphasized = result.lockedLanguagePlan.sections.flatMap((section) => section.paragraphs).filter((paragraph) => paragraph.emphasis === "full_bold").map((paragraph) => paragraph.text)
    const productText = reportText.applyFullBoldClinicalReportParagraphs(result.finalReport, emphasized)

    const viewPath = path.join(process.cwd(), "src/components/report/ClinicalReportView.tsx")
    const view = loadTranspiledModule(viewPath, { "@/lib/dna/reportText": reportText }) as { default: React.ComponentType<{ text: string; reportDate?: string }> }
    const markup = renderToStaticMarkup(React.createElement(view.default, { text: productText, reportDate: "2026-09-03T08:00:00.000Z" }))
    assert.equal(count(markup, /<section\b/gu), 5)
    assert.equal(count(markup, /<strong class="font-bold">/gu), 3)
    assert.equal(markup.includes("**"), false)
    assert.match(markup, /dna-report-decision/u)
    assert.match(markup, /p-4 md:p-5/u)
    assert.doesNotMatch(markup, /min-w-\[/u)

    const legacyText = [
      "1. Klinik Karar Özeti\nEski özet.",
      "2. Klinik Kanıt Profili\nEski kanıt.",
      "3. Alan Bazlı Klinik Yorum\nEski alan yorumu.",
      "4. Klinik Örüntü ve Formülasyon\nEski örüntü.",
      "5. Anamnez, Gözlem ve Test Uyumunun Değerlendirilmesi\nEski uyum.",
      "6. Klinik Önceliklendirme Notu\nEski öncelik.",
      "7. Klinik Sonuç\nEski sonuç.",
      "8. Literatürle Uyumlu Klinik Dayanak\nEski literatür.",
    ].join("\n\n")
    const legacyMarkup = renderToStaticMarkup(React.createElement(view.default, { text: legacyText }))
    assert.equal(count(legacyMarkup, /<section\b/gu), 8)

    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8")
    assert.match(css, /@media print/u)
    assert.match(css, /\.dna-print-report-shell/u)
    assert.match(css, /\.dna-clinical-report/u)
    assert.match(css, /break-inside:\s*avoid-page/u)
    assert.match(css, /@page\s*\{[\s\S]*?size:\s*A4/u)

    const successState: RouteState = { creditMode: "success", consumeCount: 0, grantCount: 0, insertCount: 0, insertShouldFail: false, insertPayload: null }
    const successResponse = await runRouteCase(successState, input)
    const successPayload = await successResponse.json() as Record<string, unknown>
    assert.equal(successResponse.status, 200)
    assert.deepEqual(Object.keys(successPayload).sort(), ["createdAt", "deterministic", "existing", "ok", "remainingReportCredits", "report", "reportId"].sort())
    assert.equal(successPayload.ok, true)
    assert.equal(successPayload.existing, false)
    assert.equal(successPayload.report, successPayload.deterministic)
    assert.equal(successState.consumeCount, 1)
    assert.equal(successState.insertCount, 1)
    assert.equal(successState.grantCount, 0)

    const emptyState: RouteState = { creditMode: "empty", consumeCount: 0, grantCount: 0, insertCount: 0, insertShouldFail: false, insertPayload: null }
    const emptyResponse = await runRouteCase(emptyState, input)
    const emptyPayload = await emptyResponse.json() as Record<string, unknown>
    assert.equal(emptyResponse.status, 402)
    assert.equal(emptyPayload.error, "report_credit_required")
    assert.equal(emptyState.consumeCount, 1)
    assert.equal(emptyState.insertCount, 0)

    const rollbackState: RouteState = { creditMode: "success", consumeCount: 0, grantCount: 0, insertCount: 0, insertShouldFail: true, insertPayload: null }
    const rollbackResponse = await runRouteCase(rollbackState, input)
    assert.equal(rollbackResponse.status, 500)
    assert.equal(rollbackState.consumeCount, 1)
    assert.equal(rollbackState.insertCount, 1)
    assert.equal(rollbackState.grantCount, 1)

    assert.equal(providerCalls, 0)
    console.log(JSON.stringify({
      currentHeadingCount: 5,
      legacyHeadingCount: 8,
      strongDecisionCount: 3,
      rawMarkdownVisible: 0,
      responsiveMarkup: true,
      a4PrintContract: true,
      apiSuccessStatus: successResponse.status,
      creditRequiredStatus: emptyResponse.status,
      failedInsertCreditRefunds: rollbackState.grantCount,
      providerCalls,
      pass: true,
    }, null, 2))
  } finally {
    globalThis.fetch = originalFetch
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
