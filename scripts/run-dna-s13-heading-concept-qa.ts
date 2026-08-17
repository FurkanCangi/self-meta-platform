import { createHash } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { DnaS13QueryFrame, DnaS13Subquestion } from "../src/lib/dna/chat/s13/contracts"
import { DNA_S13_QUERY_FRAME_VERSION } from "../src/lib/dna/chat/s13/contracts"
import { resolveDnaS13PragmaticTask } from "../src/lib/dna/chat/s13/pragmaticTask"
import {
  DnaS13KnowledgeV2ShadowProvider,
  runDnaS13KnowledgeV2Shadow,
  type DnaKnowledgeV2Atom,
  type DnaKnowledgeV2Facet,
  type DnaKnowledgeV2Snapshot,
} from "../src/lib/dna/chat/s13/shadowKnowledgeV2"
import { DeterministicRealizer } from "../src/lib/dna/chat/s13/strictRealizer"
import { runDnaS13StrictRuntime } from "../src/lib/dna/chat/s13/strictRuntime"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"

type Json = Record<string, any>
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name}_required`)
  return value
}
const OUTPUT_DIR = requiredEnvironment("DNA_FINAL_RECONCILIATION_OUTPUT")
const CATALOG = requiredEnvironment("DNA_FINAL_PREPROD_CATALOG")
const KNOWLEDGE_ROOT = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence/knowledge-core-v2-consolidation/run-001")
const BLIND = path.join(OUTPUT_DIR, "BLIND_HEADING_CONCEPT_QA.md")
const SEALED = path.join(OUTPUT_DIR, "SEALED_HEADING_CONCEPT_QA.jsonl")
const SUMMARY = path.join(OUTPUT_DIR, "heading-concept-summary.json")

const json = (file: string) => JSON.parse(readFileSync(file, "utf8")) as Json
const jsonl = (file: string) => readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Json)
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
const writePrivate = (file: string, value: string | unknown) => {
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

const FACETS = new Set<DnaKnowledgeV2Facet>([
  "CORE_SCOPE", "DEFINITION", "FUNCTION_SIGNIFICANCE", "BOUNDARY_LIMITATION",
  "EXPLANATORY_DETAIL", "EXAMPLE", "RELATION_COMPARISON",
])

function toAtom(row: Json): DnaKnowledgeV2Atom {
  return Object.freeze({
    atomId: String(row.atomId), text: String(row.text), canonicalTopicId: String(row.canonicalTopicId),
    canonicalTitle: String(row.canonicalTitle), sourceId: String(row.sourceId), passageId: String(row.passageId),
    explicitFacet: row.explicitFacet ?? null, coverageFacet: row.coverageFacet ?? null,
    supportedFacets: Object.freeze((row.supportedFacets ?? []).map(String).filter((facet: string) => FACETS.has(facet as DnaKnowledgeV2Facet)) as DnaKnowledgeV2Facet[]),
    claimRoleV2: row.claimRoleV2 ?? null, selfContained: row.selfContained === true,
    standaloneFinalAnswerEligible: row.standaloneFinalAnswerEligible === true,
    answerEligible: row.answerEligible === true, dimensions: Object.freeze((row.dimensions ?? []).map(String)),
    domain: row.domain ?? null, sourceSectionId: row.sourceSectionId ?? null,
    authorityClass: row.authorityClass ?? null, citationStatus: row.citationStatus ?? null,
  })
}

function snapshot(): DnaKnowledgeV2Snapshot {
  const topics = json(path.join(KNOWLEDGE_ROOT, "canonical_topics.json")).canonicalTopics as Json[]
  const aliases = json(path.join(KNOWLEDGE_ROOT, "topic_alias_map.json")).aliases as Json[]
  const bundles = json(path.join(KNOWLEDGE_ROOT, "answer_bundles.json")).bundles as Json[]
  return Object.freeze({
    canonicalTopics: Object.freeze(topics.map((topic) => Object.freeze({
      canonicalTopicId: String(topic.canonicalTopicId), canonicalTitle: String(topic.canonicalTitle),
      aliases: Object.freeze((topic.aliases ?? []).map(String)), oldTopicIds: Object.freeze((topic.oldTopicIds ?? []).map(String)),
      applicableFacets: Object.freeze((topic.applicableFacets ?? []) as DnaKnowledgeV2Facet[]), atomIds: Object.freeze((topic.atomIds ?? []).map(String)),
    }))),
    aliases: Object.freeze(aliases.map((alias) => Object.freeze({
      oldTopicId: String(alias.oldTopicId), canonicalTopicId: String(alias.canonicalTopicId), backwardCompatible: alias.backwardCompatible === true,
    }))),
    atoms: Object.freeze(jsonl(CATALOG).map(toAtom)),
    bundles: Object.freeze(bundles.map((bundle) => Object.freeze({
      bundleId: String(bundle.bundleId), canonicalTopicId: String(bundle.canonicalTopicId), leadAtomId: String(bundle.leadAtomId),
      supportAtomIds: Object.freeze((bundle.supportAtomIds ?? []).map(String)), orderedAtomIds: Object.freeze((bundle.orderedAtomIds ?? []).map(String)),
      selfContainedAsBundle: bundle.selfContainedAsBundle === true, standaloneLeadForbidden: bundle.standaloneLeadForbidden === true,
      finalAnswerEligible: bundle.finalAnswerEligible === true,
    }))),
  })
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  const provider = new DnaS13KnowledgeV2ShadowProvider(snapshot())
  const classified = provider.snapshot.canonicalTopics.flatMap((topic) => {
    const concept = provider.classifyConceptType(topic.canonicalTopicId)
    if (!concept) return []
    const requested = concept.conceptType === "CANONICAL_CONCEPT" ? "DEFINITION" : "CORE_SCOPE"
    const retrievalStatus = provider.retrieve(topic.canonicalTopicId, requested).status
    if (concept.conceptType === "CANONICAL_CONCEPT" && retrievalStatus === "UNSUPPORTED") return []
    return [{ topic, concept, retrievalStatus }]
  })
  const selected = (["SECTION_HEADING", "COMPOSITE_TOPIC", "CANONICAL_CONCEPT"] as const)
    .flatMap((conceptType) => classified.filter((row) => row.concept.conceptType === conceptType).slice(0, 10))
  if (selected.length !== 30) throw new Error(`heading_concept_pool_short:${selected.length}`)
  const rows: Json[] = []
  for (const [index, { topic, concept, retrievalStatus }] of selected.entries()) {
    const question = `${topic.canonicalTitle} nedir?`
    const task = resolveDnaS13PragmaticTask({
      question, responseDepth: "standard", correction: false, contextInherited: false, namedTargetCount: 1,
      targets: Object.freeze([Object.freeze({ topicId: topic.canonicalTopicId, surface: topic.canonicalTitle, polarity: "ACTIVE_TARGET" as const })]),
    })
    const subquestion: DnaS13Subquestion = Object.freeze({
      id: "q1", question, intent: "scientific_question", topicId: topic.canonicalTopicId,
      focus: "definition", questionType: "definition", followUp: false, correction: false,
      comparisonTargetTopicIds: Object.freeze([]), answerabilityHint: "supported",
      requestedFacets: Object.freeze(["definition"] as const),
    })
    const frame: DnaS13QueryFrame = Object.freeze({
      version: DNA_S13_QUERY_FRAME_VERSION, normalizedQuestion: normalizeDnaChatText(question), responseDepth: "standard",
      uncertain: false, subquestions: Object.freeze([subquestion]),
    })
    const prepared = runDnaS13KnowledgeV2Shadow({ frame, pragmaticTaskFrame: task, provider })
    const runtime = await runDnaS13StrictRuntime({
      question, normalizedQuestion: frame.normalizedQuestion, queryFrame: frame, plan: prepared.shadow.plan,
      realizer: new DeterministicRealizer(), catalog: Object.freeze({ version: "reconciled-catalog@1", hash: sha(readFileSync(CATALOG)) }),
      retrieval: Object.freeze({ version: provider.version, hash: sha(`${topic.canonicalTopicId}|definition`) }),
      privacy: Object.freeze({ category: "general_non_sensitive", containsClinicalOrCaseData: false,
        containsPersonalData: false, automaticTrainingAllowed: false, reasons: Object.freeze(["synthetic_provider_free_qa"]) }),
      trainingCandidateRequested: false,
    })
    const semantic = runtime.finalValidation.semanticAction
    rows.push(Object.freeze({
      id: `heading-concept-${String(index + 1).padStart(2, "0")}`, question, answer: runtime.answer,
      conceptType: concept.conceptType, conceptTypeEvidenceCodes: concept.evidenceCodes,
      retrievalStatus,
      requestedFacet: "definition", retrievals: prepared.shadow.retrievals,
      definitionSemanticEntailment: semantic.definitionSemanticEntailment,
      actionExecutionCorrect: semantic.actionExecutionCorrect, finalAnswerNonempty: semantic.finalAnswerNonempty,
      pseudoDefinition: concept.conceptType !== "CANONICAL_CONCEPT"
        && prepared.shadow.plan.slots.some((slot) => slot.lockedClaimIds.length > 0)
        && !prepared.shadow.plan.facetEvidenceMatrix?.some((entry) => entry.allowedDerivationType === "heading_scope_for_definition"),
      validator: runtime.finalValidation, providerCalls: 0, productionEligible: false,
    }))
  }
  const blind = `${rows.map((row) => `Kullanıcı:\n${row.question}\n\nAsistan:\n${row.answer}`).join("\n\n---\n\n")}\n`
  const definitionEligible = rows.filter((row) => row.definitionSemanticEntailment !== null)
  const summary = Object.freeze({
    schemaVersion: "dna-s13-heading-concept-qa@1", cases: rows.length,
    distribution: Object.freeze(Object.fromEntries(["CANONICAL_CONCEPT", "SECTION_HEADING", "COMPOSITE_TOPIC"]
      .map((type) => [type, rows.filter((row) => row.conceptType === type).length]))),
    supportedDefinitionCases: definitionEligible.length,
    definitionSemanticEntailmentPercent: definitionEligible.length
      ? Math.round((definitionEligible.filter((row) => row.definitionSemanticEntailment === true).length / definitionEligible.length) * 10_000) / 100 : 100,
    safeLimitationCases: rows.filter((row) => row.validator.semanticAction.safeEvidenceLimitation).length,
    pseudoDefinitionCount: rows.filter((row) => row.pseudoDefinition).length,
    actionExecutionFailureCount: rows.filter((row) => !row.actionExecutionCorrect).length,
    blankAnswerCount: rows.filter((row) => !row.finalAnswerNonempty).length,
    providerCalls: 0, productionChanged: false, qualityScoredByCodex: false,
  })
  writePrivate(BLIND, blind)
  writePrivate(SEALED, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`)
  writePrivate(SUMMARY, summary)
  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, blind: BLIND, sealed: SEALED, summary }))
  if (summary.pseudoDefinitionCount || summary.actionExecutionFailureCount || summary.blankAnswerCount) process.exitCode = 1
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})
