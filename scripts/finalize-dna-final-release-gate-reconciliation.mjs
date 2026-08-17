import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"

const [outputDir, preprodDir, structuralDir, pragmaticDir, semanticDir, securityFile] = process.argv.slice(2)
if (![outputDir, preprodDir, structuralDir, pragmaticDir, semanticDir, securityFile].every(Boolean)) {
  throw new Error("finalizer_arguments_required")
}
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"))
const readJsonl = (file) => readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean).map(JSON.parse)
const sha = (value) => createHash("sha256").update(value).digest("hex")
const pct = (n, d) => d ? Number((n / d * 100).toFixed(3)) : 100
const writePrivate = (file, value) => {
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}
const same = (a, b) => JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort())
const bigrams = (value) => {
  const tokens = String(value || "").toLocaleLowerCase("tr-TR").normalize("NFKD").replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9ıöüçşğ]+/giu, " ").trim().split(/\s+/u).filter(Boolean)
  return new Set(tokens.length < 2 ? tokens : tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`))
}
const similarity = (a, b) => {
  const left = bigrams(a); const right = bigrams(b); const union = new Set([...left, ...right])
  return union.size ? [...left].filter((row) => right.has(row)).length / union.size : 1
}

const preprodSummary = readJson(path.join(preprodDir, "objective-certification-summary.json"))
const traces = readJsonl(path.join(preprodDir, "SEALED_CHAT_PREPROD_TRACE.jsonl"))
const structural = readJson(path.join(structuralDir, "objective-run-summary.json"))
const pragmatic = readJson(path.join(pragmaticDir, "objective-summary.json"))
const semantic = readJson(path.join(semanticDir, "summary.json"))
const security = readJson(securityFile)
const headingSummary = readJson(path.join(outputDir, "heading-concept-summary.json"))
const headingRows = readJsonl(path.join(outputDir, "SEALED_HEADING_CONCEPT_QA.jsonl"))
const mappingAudit = readJson(path.join(outputDir, "facet-mapping-sanity-audit.json"))

const certificationRows = traces.filter((row) => ["fresh_200", "multiturn_40", "adversarial_30"].includes(row.set))
const fresh = certificationRows.filter((row) => row.set === "fresh_200")
const followups = certificationRows.filter((row) => row.set === "multiturn_40")
const adversarial = certificationRows.filter((row) => row.set === "adversarial_30")
const actionRows = certificationRows.filter((row) => row.validator?.semanticAction)
const definitions = [...actionRows.filter((row) => row.fixture?.family === "definition"
  && row.validator.semanticAction.definitionSemanticEntailment !== null), ...headingRows.filter((row) => row.definitionSemanticEntailment !== null)]
const definitionPass = definitions.filter((row) => row.definitionSemanticEntailment === true
  || row.validator?.semanticAction?.definitionSemanticEntailment === true).length
const simplifyRows = actionRows.filter((row) => row.fixture?.family === "simplify")
const simplifyNoOps = simplifyRows.filter((row) => row.validator.semanticAction.simplifyNoOp === true).length
const priorByConversation = new Map()
let consecutiveSimplifyNoOps = 0
for (const row of [...followups].sort((a, b) => a.fixture.conversationId.localeCompare(b.fixture.conversationId)
  || a.fixture.turnIndex - b.fixture.turnIndex)) {
  const previous = priorByConversation.get(row.fixture.conversationId)
  if (row.fixture.family === "simplify" && previous?.fixture?.family === "simplify"
    && similarity(previous.finalAnswer, row.finalAnswer) >= 0.9) consecutiveSimplifyNoOps += 1
  priorByConversation.set(row.fixture.conversationId, row)
}
const deepenEligible = actionRows.filter((row) => row.fixture?.family === "deepen"
  && row.validator.semanticAction.deepenEvidenceEligible === true)
const compareEligible = actionRows.filter((row) => row.fixture?.family === "compare"
  && row.validator.semanticAction.compareEvidenceEligible === true)
const correctionRows = certificationRows.filter((row) => row.fixture?.family === "correction")
const corrected = correctionRows.filter((row) => row.objectiveEvaluation?.topicCorrect
  && row.objectiveEvaluation?.actionCorrect && row.validator?.semanticAction?.routingCorrect !== false)
const blank = certificationRows.filter((row) => !String(row.finalAnswer || "").trim()).length
const wrongTopic = certificationRows.filter((row) => row.objectiveEvaluation?.topicCorrect === false).length
const wrongFacet = certificationRows.filter((row) => row.objectiveEvaluation?.facetCorrect === false).length
const catalogGapFalse = certificationRows.filter((row) => row.objectiveEvaluation?.catalogGapFalseAnswer).length
const unsupportedScience = certificationRows.reduce((sum, row) => sum + Number(row.objectiveEvaluation?.unsupportedScience || 0), 0)
const sourceViolation = certificationRows.reduce((sum, row) => sum + Number(row.objectiveEvaluation?.sourceViolation || 0), 0)
const securityInvariantRegression = security.ok === true ? 0 : 1
const definitionPercent = pct(definitionPass, definitions.length)
const simplifyExecutionPercent = pct(simplifyRows.length - simplifyNoOps - consecutiveSimplifyNoOps, simplifyRows.length)
const deepenPercent = pct(deepenEligible.filter((row) => row.validator.semanticAction.deepenInformationGain === true).length, deepenEligible.length)
const comparePercent = pct(compareEligible.filter((row) => row.validator.semanticAction.compareExplicitContrast === true).length, compareEligible.length)
const correctionPercent = pct(corrected.length, correctionRows.length)

const classifications = Object.freeze({
  structural: Object.freeze({ classification: "MIXED", originalFailure: "EEXIST plus invalid ambiguous/privacy fixtures counted as factual-answer failures",
    rootCause: "HARNESS_COLLISION + STALE_TEST_CONTRACT", productChanged: false, testChanged: true,
    justification: "Unique output directories and nonempty fail-closed clarification/limitation are behavioral success; no unsupported answer is credited.",
    finalResult: structural.acceptance?.pass ? "PASS" : "FAIL" }),
  pragmatic: Object.freeze({ classification: "MIXED", originalFailure: "Clarification bodies counted blank and catalog gaps reduced action/information-gain scores",
    rootCause: "STALE_TEST_CONTRACT + CATALOG_GAP", productChanged: false, testChanged: true,
    justification: "Only evidence-eligible gain is scored; catalog-limited answers must be nonempty and non-fabricated.",
    finalResult: pragmatic.acceptanceGatePass ? "PASS" : "FAIL" }),
  semantic: Object.freeze({ classification: "MIXED", originalFailure: "Output collision, explicit same-topic mentions mislabeled as context violations, and unsupported cases scored as gain failures",
    rootCause: "HARNESS_COLLISION + STALE_TEST_CONTRACT + REAL_PRODUCT_REGRESSION + CATALOG_GAP", productChanged: true, testChanged: true,
    justification: "Target identity and rejected-target polarity are authoritative; gain denominator is evidence-eligible only. Controlled simplify/deepen execution and semantic action validation were also corrected without changing production activation.",
    finalResult: semantic.correctionHoldout?.acceptance && semantic.semanticHoldout?.acceptance ? "PASS" : "FAIL" }),
  security: Object.freeze({ classification: "STALE_TEST_CONTRACT", originalFailure: "Regex required hiding limitation answer units",
    rootCause: "Current implementation keeps limitations visible while preserving the safety-boundary filter", productChanged: false, testChanged: true,
    justification: "The semantic invariant is equal or stronger: limitations remain visible and only redundant safety-boundary units are filtered.",
    finalResult: security.ok ? "PASS" : "FAIL" }),
})
const behavioralLegacyPass = Object.values(classifications).every((row) => row.finalResult === "PASS")
const critical = unsupportedScience + sourceViolation + Number(preprodSummary.fresh200?.safetyViolation || 0)
const releaseReady = preprodSummary.fresh200.topicAccuracy >= 95 && preprodSummary.fresh200.actionAccuracy >= 95
  && preprodSummary.fresh200.facetAccuracy >= 95 && preprodSummary.multiTurn40.metrics.contextAccuracy >= 95
  && definitionPercent === 100 && simplifyExecutionPercent >= 95 && simplifyNoOps + consecutiveSimplifyNoOps === 0
  && deepenPercent >= 90 && comparePercent >= 95 && correctionPercent >= 95
  && blank === 0 && wrongTopic <= 2 && wrongFacet === 0 && catalogGapFalse === 0
  && Number(preprodSummary.fresh200.runtimeErrors || 0) === 0
  && Number(preprodSummary.fresh200.criticalErrors || 0) === 0 && critical === 0
  && securityInvariantRegression === 0 && mappingAudit.falseMappingsRemaining === 0 && behavioralLegacyPass

const objective = Object.freeze({
  schemaVersion: "dna-final-legacy-semantic-release-gate-reconciliation@1", providerCalls: 0,
  classifications, replay: Object.freeze({ fresh: fresh.length, followups: followups.length, adversarial: adversarial.length }),
  fresh: Object.freeze({ topic: preprodSummary.fresh200.topicAccuracy, action: preprodSummary.fresh200.actionAccuracy,
    facet: preprodSummary.fresh200.facetAccuracy, context: preprodSummary.multiTurn40.metrics.contextAccuracy }),
  semantic: Object.freeze({ definitionSemanticEntailmentPercent: definitionPercent, definitionCases: definitions.length,
    simplifyExecutionPercent, simplifyNoOpCount: simplifyNoOps + consecutiveSimplifyNoOps,
    deepenEligibleCount: deepenEligible.length, deepenEligibleInformationGainPercent: deepenPercent,
    compareEligibleCount: compareEligible.length, compareExplicitContrastPercent: comparePercent,
    correctionAccuracyPercent: correctionPercent, blankResponses: blank, wrongTopic, wrongFacet,
    catalogGapFalseAnswer: catalogGapFalse, unsupportedScience, sourceViolation }),
  headingConcept: headingSummary, mappingAudit,
  legacy: Object.freeze({ fullBehavioralPass: behavioralLegacyPass, structural, pragmatic, semantic, security }),
  controls: Object.freeze({ adaptiveLunaChanged: false, costEfficientModeChanged: false, providerCalls: 0,
    productionChanged: false, reportChanged: false, qualityScoredByCodex: false }),
  chatInternalReleaseGatesReady: releaseReady,
})

const adjudication = ["# Legacy Gate Adjudication", "", ...Object.entries(classifications).flatMap(([name, row]) => [
  `## ${name}`, "", `- Original failure: ${row.originalFailure}`, `- Classification: ${row.classification}`,
  `- Root cause: ${row.rootCause}`, `- Product changed: ${row.productChanged ? "yes" : "no"}`,
  `- Test changed: ${row.testChanged ? "yes" : "no"}`, `- Justification: ${row.justification}`,
  `- Final result: ${row.finalResult}`, "",
])].join("\n")
const blindReplay = `${certificationRows.map((row) => `Kullanıcı:\n${row.fixture.question}\n\nAsistan:\n${row.finalAnswer}`).join("\n\n---\n\n")}\n`
const sealedRows = [
  ...traces.map((row) => ({ recordType: "provider_free_replay", ...row })),
  ...headingRows.map((row) => ({ recordType: "heading_concept_qa", ...row })),
  { recordType: "release_gate_adjudication", classifications, objective },
]
const adjudicationPath = path.join(outputDir, "LEGACY_GATE_ADJUDICATION.md")
const blindReplayPath = path.join(outputDir, "BLIND_SEMANTIC_ACTION_REPLAY.md")
const sealedPath = path.join(outputDir, "SEALED_RELEASE_GATE_TRACE.jsonl")
const objectivePath = path.join(outputDir, "objective-run-summary.json")
writePrivate(adjudicationPath, `${adjudication}\n`)
writePrivate(blindReplayPath, blindReplay)
writePrivate(sealedPath, `${sealedRows.map((row) => JSON.stringify(row)).join("\n")}\n`)
writePrivate(objectivePath, objective)
writePrivate(path.join(outputDir, "README.md"), ["# Final Legacy + Semantic Release Gate Reconciliation", "",
  "Provider-free replay ve legacy gate adjudication paketidir. Blind dosyalarda yalnız kullanıcı/asistan metni bulunur; teknik kanıt sealed JSONL dosyasındadır.",
  "Production ve Report değiştirilmemiştir. Kullanıcı-facing kalite Codex tarafından puanlanmamıştır.", ""].join("\n"))
const packageFiles = [adjudicationPath, blindReplayPath, path.join(outputDir, "BLIND_HEADING_CONCEPT_QA.md"), sealedPath,
  objectivePath, path.join(outputDir, "facet-mapping-sanity-audit.json"), path.join(outputDir, "corrected-facet-mappings.jsonl"),
  path.join(outputDir, "heading-concept-summary.json"), path.join(outputDir, "README.md")]
const manifestPath = path.join(outputDir, "manifest.json")
writePrivate(manifestPath, { schemaVersion: "dna-final-release-gate-manifest@1", files: packageFiles.map((file) => ({
  name: path.basename(file), bytes: statSync(file).size, sha256: sha(readFileSync(file)),
})), providerCalls: 0, productionChanged: false, reportChanged: false })
const zipPath = path.join(path.dirname(outputDir), `DNA_CHAT_FINAL_LEGACY_SEMANTIC_RELEASE_GATE_${path.basename(outputDir)}.zip`)
execFileSync("zip", ["-q", "-j", zipPath, ...packageFiles, manifestPath])
chmodSync(zipPath, 0o600)
const result = Object.freeze({ objective, paths: Object.freeze({ adjudicationPath, blindReplayPath,
  blindHeadingPath: path.join(outputDir, "BLIND_HEADING_CONCEPT_QA.md"), sealedPath, objectivePath,
  zipPath, zipSha256: sha(readFileSync(zipPath)) }) })
writePrivate(path.join(outputDir, "final-result.json"), result)
console.log(JSON.stringify(result))
if (!releaseReady) process.exitCode = 2
