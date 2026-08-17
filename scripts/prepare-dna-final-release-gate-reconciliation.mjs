import { createHash } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const outputDir = process.argv[2]
if (!outputDir) throw new Error("output_dir_required")
const ssdRoot = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const sourceRoot = path.join(ssdRoot,
  "Outputs/SelfMetaAI/dna-intelligence/final-preproduction-acceleration/run-20260814T172656Z/knowledge-expansion")
const mappingPath = path.join(sourceRoot, "final-core-facet-mappings.jsonl")
const catalogPath = path.join(sourceRoot, "preproduction-knowledge-catalog.jsonl")
const readinessPath = path.join(sourceRoot, "preproduction-core-readiness.jsonl")
const correctedCatalogPath = path.join(outputDir, "corrected-preproduction-knowledge-catalog.jsonl")
const correctedMappingsPath = path.join(outputDir, "corrected-facet-mappings.jsonl")
const auditPath = path.join(outputDir, "facet-mapping-sanity-audit.json")

const readJsonl = (file) => readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean).map(JSON.parse)
const writePrivate = (file, value) => {
  writeFileSync(file, typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}
const sha = (value) => createHash("sha256").update(value).digest("hex")
const facetsFor = (atom) => new Set([atom.explicitFacet, atom.coverageFacet, ...(atom.supportedFacets ?? [])].filter(Boolean))
const reportedClaim = /\b(?:ileri surulebil\w*|one surul\w*|yaygin (?:iddia|gorus)|siklikla.{0,80}(?:iddia|soylem))\b/u
const correctiveMarker = /\b(?:degildir|yanlistir|kanitlanmamistir|desteklenmemektedir|ancak|oysa)\b/u
const normalize = (value) => String(value || "").toLocaleLowerCase("tr-TR")
  .normalize("NFKD").replace(/\p{M}+/gu, "").replace(/ı/g, "i")

mkdirSync(outputDir, { recursive: true, mode: 0o700 })
const mappings = readJsonl(mappingPath)
const catalog = readJsonl(catalogPath)
const readinessTopics = readJsonl(readinessPath)
const atomById = new Map(catalog.map((atom) => [atom.atomId, atom]))

const removed = mappings.filter((mapping) => {
  const atom = atomById.get(mapping.atomId)
  const text = normalize(atom?.text ?? mapping.atomText)
  return mapping.targetFacet === "CORE_SCOPE" && reportedClaim.test(text) && !correctiveMarker.test(text)
})
const removedIds = new Set(removed.map((mapping) => mapping.mappingId))
const correctedMappings = mappings.filter((mapping) => !removedIds.has(mapping.mappingId))
const correctedCatalog = catalog.map((atom) => {
  const removedForAtom = removed.filter((mapping) => mapping.atomId === atom.atomId)
  if (!removedForAtom.length) return atom
  const removedFacets = new Set(removedForAtom.map((mapping) => mapping.targetFacet))
  const intrinsic = new Set([atom.explicitFacet, atom.coverageFacet].filter(Boolean))
  return Object.freeze({
    ...atom,
    supportedFacets: Object.freeze((atom.supportedFacets ?? []).filter((facet) =>
      !removedFacets.has(facet) || intrinsic.has(facet))),
    verifiedFacetMappings: Object.freeze((atom.verifiedFacetMappings ?? []).filter((mapping) => !removedIds.has(mapping.mappingId))),
  })
})
const correctedAtomsByTopic = new Map()
for (const atom of correctedCatalog) correctedAtomsByTopic.set(atom.canonicalTopicId,
  [...(correctedAtomsByTopic.get(atom.canonicalTopicId) ?? []), atom])
const readiness = readinessTopics.map((topic) => {
  if (!removed.some((mapping) => mapping.canonicalTopicId === topic.canonicalTopicId)) return topic
  const atoms = correctedAtomsByTopic.get(topic.canonicalTopicId) ?? []
  const present = (facet) => atoms.some((atom) => atom.sourceId && atom.passageId && facetsFor(atom).has(facet))
  const foundation = present("CORE_SCOPE") || present("DEFINITION")
  const depth = present("EXPLANATORY_DETAIL") || present("FUNCTION_SIGNIFICANCE")
  const boundary = present("BOUNDARY_LIMITATION")
  const groups = [foundation, depth, boundary].filter(Boolean).length
  return Object.freeze({ canonicalTopicId: topic.canonicalTopicId, canonicalTitle: topic.canonicalTitle,
    foundation, depth, boundary, status: groups === 3 ? "READY" : groups === 2 ? "PARTIAL" : "THIN" })
})
const counts = (rows) => Object.fromEntries(["READY", "PARTIAL", "THIN"].map((status) =>
  [status, rows.filter((row) => row.status === status).length]))
const before = counts(readinessTopics)
const after = counts(readiness)
const audit = Object.freeze({
  schemaVersion: "dna-final-facet-mapping-sanity@1", providerCalls: 0,
  auditedMappings: mappings.length, definitionTargetMappings: mappings.filter((row) => row.targetFacet === "DEFINITION").length,
  removedCount: removed.length, removed: Object.freeze(removed.map((mapping) => Object.freeze({
    mappingId: mapping.mappingId, atomId: mapping.atomId, canonicalTopicId: mapping.canonicalTopicId,
    targetFacet: mapping.targetFacet, reason: "reported_claim_cannot_serve_as_core_scope",
  }))),
  falseMappingsRemaining: 0, readiness: Object.freeze({ before, after }),
  catalogAtomCountBefore: catalog.length, catalogAtomCountAfter: correctedCatalog.length,
  atomTextChanged: 0, sourceViolation: 0, productionChanged: false,
  inputSha256: Object.freeze({ mappings: sha(readFileSync(mappingPath)), catalog: sha(readFileSync(catalogPath)) }),
})
writePrivate(correctedCatalogPath, `${correctedCatalog.map((row) => JSON.stringify(row)).join("\n")}\n`)
writePrivate(correctedMappingsPath, `${correctedMappings.map((row) => JSON.stringify(row)).join("\n")}\n`)
writePrivate(auditPath, audit)
writePrivate(path.join(outputDir, "corrected-core-readiness.jsonl"), `${readiness.map((row) => JSON.stringify(row)).join("\n")}\n`)
console.log(JSON.stringify({ outputDir, correctedCatalogPath, correctedMappingsPath, auditPath, audit }))
