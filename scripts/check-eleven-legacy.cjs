// Read the unchanged legacy scenario builder without invoking its large export run.
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const engine = require("../compiled-eleven/src/lib/dna/reportJury")
const baseRoot = process.env.REPORT_ELEVEN_BASE_COMPILED
const beforeEngine = baseRoot ? require(path.join(baseRoot, "src/lib/dna/reportJury")) : null
const output = path.resolve(process.env.REPORT_ELEVEN_OUTPUT || "output-eleven")
const file = path.resolve("scripts/run-report-final-polish-1000.ts")
let source = fs.readFileSync(file, "utf8")
source = source.slice(0, source.lastIndexOf("main().catch")) + "\nmodule.exports = { makeScenarios, toInput };"
const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText
const record = { exports: {} }
const localRequire = name => name.startsWith("../src/") ? require(path.resolve("compiled-eleven", name.slice(3))) : name.startsWith("./fixtures/") ? require(path.resolve("compiled-regression/scripts", name.slice(2))) : require(name)
new Function("require", "module", "exports", script)(localRequire, record, record.exports)
let networkAttempts = 0
globalThis.fetch = async () => { networkAttempts++; throw Error("LEGACY_NETWORK_FORBIDDEN") }
async function main() {
  const rows = [], examples = {}, classes = {}, confidenceChanges = []
  const limit = Number(process.env.REPORT_ELEVEN_LEGACY_LIMIT || 1000)
  const start = Number(process.env.REPORT_ELEVEN_LEGACY_START || 0)
  for (const [i, scenario] of record.exports.makeScenarios().slice(start, start + limit).entries()) {
    const input = record.exports.toInput(scenario)
    let result
    try { result = await engine.buildJuryReadyReport(input) } catch (error) {
      const code = String(error)
      classes[code] = (classes[code] || 0) + 1
      if (!examples[code]) { examples[code] = { scenario }; console.log(JSON.stringify({ error: code, scenario })) }
      rows.push({ id: scenario.id, category: scenario.category, accepted: false, codes: [code] })
      continue
    }
    const before = beforeEngine ? await beforeEngine.buildJuryReadyReport(input) : null
    const accepted = result.validation.pass && result.templateSemanticLeakage.pass && result.reportStatus === "ready_for_therapist_review"
    const beforeAccepted = before ? before.validation.pass && before.templateSemanticLeakage.pass && before.reportStatus === "ready_for_therapist_review" : null
    const scoreDrift = before && (before.base.v1.totalScore !== result.base.v1.totalScore || before.overallClassification !== result.overallClassification)
    const priorityDrift = before && JSON.stringify(before.priorityProfile) !== JSON.stringify(result.priorityProfile)
    if (before && before.confidence.category !== result.confidence.category) confidenceChanges.push({ id: scenario.id, before: before.confidence, after: result.confidence, qualityBefore: before.dataQuality, qualityAfter: result.dataQuality })
    rows.push({ id: scenario.id, category: scenario.category, accepted, beforeAccepted, scoreDrift, priorityDrift, codes: result.validation.failureCodes })
    for (const code of result.validation.failureCodes) {
      classes[code] = (classes[code] || 0) + 1
      if (!examples[code]) examples[code] = { scenario, finalReport: result.finalReport, quality: result.dataQuality, facts: result.caseScopedEvidenceEnvelope, details: result.validation.visibleClaimFailureDetails, leakage: result.templateSemanticLeakage }
    }
    if ((i + 1) % 100 === 0) console.log(JSON.stringify({ completed: i + 1, failed: rows.filter(r => !r.accepted).length, classes }))
  }
  const summary = { cases: rows.length, accepted: rows.filter(r => r.accepted).length, beforeAccepted: beforeEngine ? rows.filter(r => r.beforeAccepted).length : null, scoreDrift: rows.filter(r => r.scoreDrift).length, priorityDrift: rows.filter(r => r.priorityDrift).length, confidenceChanges: confidenceChanges.length, classes, networkAttempts, providerCostUsd: 0, rows }
  fs.mkdirSync(output, { recursive: true })
  fs.writeFileSync(path.join(output, "legacy-1000-summary.json"), JSON.stringify(summary, null, 2))
  fs.writeFileSync(path.join(output, "legacy-confidence-changes.json"), JSON.stringify(confidenceChanges, null, 2))
  fs.writeFileSync(path.join(output, "legacy-failure-examples.json"), JSON.stringify(examples, null, 2))
  console.log(JSON.stringify({ ...summary, rows: undefined }))
  process.exitCode = summary.accepted === summary.cases && !summary.scoreDrift && !summary.priorityDrift && !networkAttempts ? 0 : 1
}
main().catch(error => { console.error(error); process.exitCode = 1 })
