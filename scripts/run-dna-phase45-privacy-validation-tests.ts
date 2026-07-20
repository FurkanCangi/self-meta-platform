import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildDnaChatAuditMetadata,
  createDnaChatSafeCaseContext,
  resolveDnaChat,
  resolveDnaChatApiRequest,
  type DnaChatApiAuditInput,
  type DnaChatCaseLoadResult,
} from "../src/lib/dna/chat"
import {
  DNA_PHASE_45_ATTACK_MATRIX,
  evaluateDnaPhase45PrivacyGate,
  type DnaPhase45Observation,
} from "../src/lib/dna/chat/evaluation/phase45to47Validation"

const root = process.cwd()
const routeSource = readFileSync(join(root, "src/app/api/app/dna-chat/route.ts"), "utf8")
const ownedCaseSource = readFileSync(join(root, "src/lib/dna/chat/ownedCaseAnswer.ts"), "utf8")
const privacyOpsSource = readFileSync(join(root, "src/lib/security/privacyOps.ts"), "utf8")

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

const safeCaseContext = createDnaChatSafeCaseContext({
  dataStatus: "synthetic",
  ageMonths: 72,
  chatContext: {
    primaryAxis: "Sentetik rapor ekseni",
    caseEvidenceLines: ["Sentetik vaka dayanağı."],
    counterEvidenceLines: ["Sentetik karşı kanıt."],
    preservedCapacityLines: ["Sentetik korunmuş kapasite."],
    dataLimitations: ["Biyolojik ölçüm bulunmamaktadır."],
  },
})

function dependencies(input: Readonly<{
  loadResult?: DnaChatCaseLoadResult
  auditOk?: boolean
  requestId?: string
}> = {}) {
  const audits: DnaChatApiAuditInput[] = []
  let loadCalls = 0
  return {
    audits,
    get loadCalls() { return loadCalls },
    value: {
      createRequestId: () => input.requestId || "phase45-contract-request",
      loadCaseAnswer: async ({ question, mode, previousTopic }: {
        question: string
        mode?: "theory" | "dna" | "case"
        previousTopic?: string | null
      }) => {
        loadCalls += 1
        return input.loadResult ?? {
          ok: true as const,
          answer: resolveDnaChat({
            question,
            mode,
            previousTopic,
            caseContext: safeCaseContext,
          }),
        }
      },
      writeAudit: async (audit: DnaChatApiAuditInput) => {
        audits.push(audit)
        return { ok: input.auditOk !== false }
      },
    },
  }
}

async function main() {
  assert.equal(DNA_PHASE_45_ATTACK_MATRIX.length, 16)
  assert.equal(new Set(DNA_PHASE_45_ATTACK_MATRIX.map((row) => row.id)).size, 16)
  for (const requiredCategory of [
    "cross_account",
    "enumeration",
    "transport",
    "cache",
    "concurrency",
    "session",
    "audit",
    "database",
    "query_layer",
    "telemetry",
  ]) {
    assert.ok(DNA_PHASE_45_ATTACK_MATRIX.some((row) => row.category === requiredCategory))
  }

  const missingLoad: DnaChatCaseLoadResult = {
    ok: false,
    status: 404,
    error: "report_not_found",
  }
  const canonical404s = new Set<string>()
  for (let index = 0; index < 64; index += 1) {
    const foreignDeps = dependencies({ loadResult: missingLoad, requestId: `foreign-${index}` })
    const missingDeps = dependencies({ loadResult: missingLoad, requestId: `missing-${index}` })
    const foreign = await resolveDnaChatApiRequest({
      question: "Son raporumu özetle.",
      reportId: randomUUID(),
    }, foreignDeps.value)
    const missing = await resolveDnaChatApiRequest({
      question: "Son raporumu özetle.",
      reportId: randomUUID(),
    }, missingDeps.value)
    assert.equal(foreign.status, 404)
    assert.deepEqual(foreign.body, { ok: false, error: "report_not_found" })
    assert.deepEqual(foreign.body, missing.body)
    assert.equal(foreignDeps.audits.length, 0)
    assert.equal(missingDeps.audits.length, 0)
    canonical404s.add(JSON.stringify(foreign.body))
    canonical404s.add(JSON.stringify(missing.body))
  }
  assert.equal(canonical404s.size, 1, "64 foreign/missing pair must be indistinguishable")

  const failedAuditDeps = dependencies({ auditOk: false })
  const failedAudit = await resolveDnaChatApiRequest({
    question: "Son raporumu özetle.",
    reportId: randomUUID(),
  }, failedAuditDeps.value)
  assert.equal(failedAuditDeps.loadCalls, 1)
  assert.equal(failedAudit.status, 503)
  assert.deepEqual(failedAudit.body, { ok: false, error: "audit_unavailable" })

  const telemetrySentinel = "CLINICAL_CONTENT_MUST_NOT_APPEAR"
  const auditInput = {
    requestId: "phase45-audit",
    mode: "case",
    intentId: "selfreg.synthetic",
    classification: "case_finding",
    outcome: "answered",
    engineVersion: "dna-chat-engine@2",
    runtimeGeneration: "v2_legacy",
    catalogVersion: "dna-chat-catalog@2",
    packageVersion: "dna-chat-catalog@2",
    packageSha256: null,
    intendedUseVersion: "dna-intelligence-intended-use@1",
    sourceIds: ["source.safe"],
    authorityContractVersion: "dna-knowledge-authority@1",
    policyVersion: "dna-intelligence-intended-use@1",
    authoritySet: ["case_information"],
    responseDepth: "standard",
    latencyCategory: "lt_100ms",
    errorCode: null,
    question: telemetrySentinel,
    answer: telemetrySentinel,
    reportId: telemetrySentinel,
    clientCode: telemetrySentinel,
    caseEvidence: telemetrySentinel,
    passageText: telemetrySentinel,
  } as DnaChatApiAuditInput & Record<string, unknown>
  const minimizedAudit = buildDnaChatAuditMetadata(auditInput)
  assert.doesNotMatch(JSON.stringify(minimizedAudit), new RegExp(telemetrySentinel))

  assert.match(routeSource, /Cache-Control["']:\s*["']private, no-store/)
  assert.match(routeSource, /Vary:\s*["']Cookie["']/)
  assert.match(routeSource, /\.eq\(["']owner_id["'],\s*userId\)/)
  assert.match(ownedCaseSource, /\.eq\(["']owner_id["'],\s*input\.userId\)/)
  assert.doesNotMatch(ownedCaseSource, /isAdminRole|adminScope|ownerAuditEmail/)
  assert.doesNotMatch(routeSource, /console\.(?:log|warn|error)\([^\n]*(?:question|reportId|clientCode)/)
  assert.doesNotMatch(privacyOpsSource, /console\.(?:log|warn|error)\([^\n]*(?:metadata|ipAddress|userAgent)/)

  const current = evaluateDnaPhase45PrivacyGate([])
  assert.equal(current.status, "not_ready")
  assert.equal(current.allowedMarketingStatement, null)
  assert.equal(current.blockerCodes.filter((code) => code.startsWith("phase45_scenario_missing:")).length, 16)

  const evaluatorFixture: DnaPhase45Observation[] = DNA_PHASE_45_ATTACK_MATRIX.map((scenario) => ({
    scenarioId: scenario.id,
    scope: scenario.minimumScope,
    status: "pass",
    attempts: scenario.category === "enumeration" ? 32 : 1,
    leakCount: 0,
    ...(scenario.id === "random_foreign_uuid" ? { foreignMissingEquivalent: true } : {}),
    ...(scenario.id === "case_audit_write_failure" ? { auditFailOpenCount: 0 } : {}),
    ...(scenario.id === "audit_and_telemetry_content_minimization"
      ? { forbiddenTelemetryContentCount: 0 }
      : {}),
    artifactSha256: sha256({ contractFixture: scenario.id }),
  }))
  const evaluatorPass = evaluateDnaPhase45PrivacyGate(evaluatorFixture)
  assert.equal(evaluatorPass.status, "pass")
  assert.match(evaluatorPass.allowedMarketingStatement || "", /^Belirtilen \d+ sentetik çapraz hesap denemesinde 0 sızıntı gözlendi\.$/)
  assert.doesNotMatch(evaluatorPass.allowedMarketingStatement || "", /imkansız|imkânsız|%100/i)

  const crossEnvironmentSubstitution = evaluateDnaPhase45PrivacyGate(
    evaluatorFixture.map((row, index) => index === 0
      ? { ...row, scope: "database_instrumentation" }
      : row),
  )
  assert.equal(crossEnvironmentSubstitution.status, "not_ready")
  assert.ok(crossEnvironmentSubstitution.blockerCodes.includes(
    `phase45_evidence_scope_insufficient:${evaluatorFixture[0]!.scenarioId}`,
  ), "DB instrumentation üretim black-box kanıtının yerine geçmemeli")

  const evaluatorFailure = evaluateDnaPhase45PrivacyGate(evaluatorFixture.map((row, index) =>
    index === 0 ? { ...row, status: "fail", leakCount: 1 } : row))
  assert.equal(evaluatorFailure.status, "fail")
  assert.equal(evaluatorFailure.allowedMarketingStatement, null)

  console.log(JSON.stringify({
    ok: true,
    localContract: {
      attackMatrixScenarios: DNA_PHASE_45_ATTACK_MATRIX.length,
      foreignMissingPairs: 64,
      foreignMissingIndistinguishable: true,
      caseAuditFailClosed: true,
      telemetryContentSentinelExcluded: true,
      noStoreContractPresent: true,
      ownerChainContractPresent: true,
    },
    releaseEvidence: {
      status: current.status,
      note: "Production synthetic and database-instrumented observations were not created by this local contract test.",
      missingScenarioCount: current.blockerCodes.filter((code) => code.startsWith("phase45_scenario_missing:")).length,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
