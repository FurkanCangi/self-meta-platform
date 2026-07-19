#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"

const root = resolve(
  process.env.DNA_SOURCE_LIBRARY_ROOT
    || process.argv.find((arg) => arg.startsWith("--root="))?.slice(7)
    || "/Volumes/ResearchSSD/Datasets/SelfMetaAI/dna-knowledge/source-library",
)
const outputRoot = join(root, "governance-audit", "v1")
const rawPath = join(outputRoot, "raw-online-identity-responses.json")
const identityPath = join(outputRoot, "identity-audit.json")
const priorityPath = join(outputRoot, "priority-input-audit.json")
const licensePath = join(outputRoot, "component-license-audit.json")
const summaryPath = join(outputRoot, "audit-summary.json")
const refresh = process.argv.includes("--refresh")
const checkedAt = new Date().toISOString().slice(0, 10)

if (!root.startsWith("/Volumes/ResearchSSD/") || !existsSync(root)) {
  throw new Error(`ResearchSSD source library unavailable: ${root}`)
}
mkdirSync(outputRoot, { recursive: true })

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function sha256(value) {
  return createHash("sha256").update(
    typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value),
  ).digest("hex")
}

function sha256File(path) {
  return sha256(readFileSync(path))
}

function canonicalDoi(value) {
  if (!value) return null
  return String(value).trim().replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/[.,;:]+$/, "").toLowerCase()
}

function canonicalPmid(value) {
  if (!value) return null
  return String(value).trim().replace(/^pmid\s*:\s*/i, "")
}

function canonicalPmcid(value) {
  if (!value) return null
  return String(value).trim().replace(/^pmcid\s*:\s*/i, "").toUpperCase()
}

function canonicalIsbn(value) {
  if (!value) return null
  return String(value).replace(/^isbn(?:-1[03])?\s*:\s*/i, "").replace(/[\s-]/g, "").toUpperCase()
}

function canonicalText(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

function titleMatches(left, right) {
  const a = canonicalText(left)
  const b = canonicalText(right)
  if (!a || !b) return false
  if (a === b) return true
  const aa = new Set(a.split(" "))
  const bb = new Set(b.split(" "))
  const intersection = [...aa].filter((token) => bb.has(token)).length
  const union = new Set([...aa, ...bb]).size
  return intersection / Math.max(1, union) >= 0.92
}

function firstYear(...values) {
  for (const value of values) {
    const match = String(value ?? "").match(/(?:18|19|20|21)\d{2}/)
    if (match) return Number(match[0])
  }
  return null
}

function sourceRootFor(recordPath) {
  const container = dirname(recordPath)
  return basename(container) === "audit" ? dirname(container) : container
}

function walk(directory) {
  const output = []
  if (!existsSync(directory)) return output
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) output.push(...walk(absolute))
    else if (entry.isFile()) output.push(absolute)
  }
  return output
}

function classifyLicense(value) {
  const normalized = String(value || "").normalize("NFKC").trim().toUpperCase().replace(/_/g, "-")
  if (/\b(?:CC0|CC ZERO)\b/.test(normalized)) return "cc0"
  if (/\b(?:NC|NON[- ]?COMMERCIAL)\b/.test(normalized)) return "blocked_nc"
  if (/\b(?:ND|NO DERIVATIVES)\b/.test(normalized)) return "blocked_nd"
  if (/ALL RIGHTS RESERVED|FULL RIGHTS|APA COPYRIGHT|NO OPEN COMMERCIAL REUSE|^COPYRIGHT\b/.test(normalized)) return "all_rights_reserved"
  if (/\bCC[- ]?BY[- ]?SA\b/.test(normalized)) return "cc_by_sa"
  if (/\bCC[- ]?BY\b/.test(normalized) && /(?:EXCEPT|UNLESS) WHERE OTHERWISE NOTED/.test(normalized)) return "cc_by_with_exceptions"
  if (/\bCC[- ]?BY\b/.test(normalized)) return "cc_by"
  return "unknown"
}

function extractLocalSource(row, recordPath, record) {
  const bibliography = record.bibliography || {}
  const identifiers = record.identifiers || {}
  const licenseValue = typeof record.license === "string"
    ? record.license
    : record.license?.spdx || record.license?.name || row.license || "unknown"
  const licenseUrl = typeof record.license === "object" ? record.license?.url : record.licenseUrl
  const rootForSource = sourceRootFor(recordPath)
  const contentFiles = walk(rootForSource)
    .filter((path) => /\.(?:pdf|epub|xml|xhtml|html)$/i.test(path))
    .sort()
  const licenseVerifiedInArtifact = Boolean(
    typeof record.license === "object"
      && (record.license?.verifiedInPdf || record.license?.verifiedInArtifact),
  )
  const licenseArtifact = licenseVerifiedInArtifact
    ? contentFiles.find((path) => record.license?.verifiedInPdf && /\.pdf$/i.test(path)) || contentFiles[0] || null
    : null
  const authors = Array.isArray(record.authors || bibliography.authors)
    ? (record.authors || bibliography.authors).map(String)
    : []
  return {
    sourceId: String(record.id || record.slug || row.id),
    kind: "source",
    recordPath: relative(root, recordPath),
    title: String(record.title || bibliography.title || row.title),
    authors,
    year: Number(record.year || bibliography.year || row.year),
    venue: String(record.venue || bibliography.venue || bibliography.journal || "") || null,
    doi: canonicalDoi(record.doi || bibliography.doi || identifiers.doi || row.doi),
    pmid: canonicalPmid(record.pmid || bibliography.pmid || identifiers.pmid || row.pmid),
    pmcid: canonicalPmcid(record.pmcid || bibliography.pmcid || identifiers.pmcid || row.pmcid),
    isbn: canonicalIsbn(record.isbn || bibliography.isbn || identifiers.isbn || row.isbn),
    design: String(record.studyDesign || record.evidenceType || bibliography.evidenceType || record.sourceRole || "unknown"),
    categories: Array.isArray(record.categories) ? record.categories.map(String) : [],
    license: licenseValue,
    licenseUrl: String(licenseUrl || record.officialUrl || record.officialAccess?.landingUrl || row.officialUrl || "https://example.invalid")
      .replace(/^http:\/\//, "https://"),
    retrievedAt: String(record.retrievedAt || record.officialAccess?.downloadedAt || checkedAt).slice(0, 10),
    evidenceSha256: sha256File(recordPath),
    declaredAgeScope: record.ageScope ?? bibliography.ageScope ?? null,
    declaredSampleScope: record.sampleScope ?? bibliography.sampleScope ?? null,
    hasContentArtifact: contentFiles.length > 0,
    licenseVerifiedInArtifact: Boolean(licenseArtifact),
    licenseArtifactRelativePath: licenseArtifact ? relative(root, licenseArtifact) : null,
    licenseArtifactSha256: licenseArtifact ? sha256File(licenseArtifact) : null,
    mixedEmbeddedMaterial: Boolean(record.license?.mixedEmbeddedMaterial)
      || /(?:EXCEPT|UNLESS) WHERE OTHERWISE NOTED/i.test(licenseValue),
    runtimeCandidate: record.runtimeEligibility !== "metadata_only_do_not_ingest_as_evidence"
      && record.reviewStatus !== "reference_only"
      && record.reviewStatus !== "remote_reference_only",
  }
}

const verification = readJson(join(root, "manifests", "verification-report.json"))
const onlineManifest = readJson(join(root, "manifests", "online-source-verification.json"))
const restrictedIndexPath = join(root, "restricted-metadata", "sources.json")
const restrictedIndex = readJson(restrictedIndexPath)
const localSources = verification.sources.map((row) => {
  const recordPath = join(root, row.recordPath)
  return extractLocalSource(row, recordPath, readJson(recordPath))
})
for (const [index, row] of restrictedIndex.sources.entries()) {
  localSources.push({
    sourceId: String(row.id),
    kind: "restricted_metadata",
    recordPath: `restricted-metadata/sources.json#sources[${index}]`,
    title: String(row.title),
    authors: Array.isArray(row.authors) ? row.authors.map(String) : [],
    year: Number(row.year),
    venue: row.venue || null,
    doi: canonicalDoi(row.doi),
    pmid: canonicalPmid(row.pmid),
    pmcid: canonicalPmcid(row.pmcid),
    isbn: canonicalIsbn(row.isbn),
    design: /guideline/i.test(row.title) ? "guideline" : /review|meta-analysis|evaluation|response|theory/i.test(row.title) ? "review_or_theory" : "unknown",
    categories: Array.isArray(row.categories) ? row.categories.map(String) : [],
    license: String(row.license || "unknown"),
    licenseUrl: String(row.officialUrl || "https://example.invalid").replace(/^http:\/\//, "https://"),
    retrievedAt: String(restrictedIndex.retrievedAt || checkedAt).slice(0, 10),
    evidenceSha256: sha256File(restrictedIndexPath),
    declaredAgeScope: row.ageScope ?? null,
    declaredSampleScope: row.sampleScope ?? null,
    hasContentArtifact: false,
    licenseVerifiedInArtifact: false,
    licenseArtifactRelativePath: null,
    licenseArtifactSha256: null,
    mixedEmbeddedMaterial: true,
    runtimeCandidate: false,
  })
}
localSources.sort((a, b) => a.sourceId.localeCompare(b.sourceId))

async function fetchJson(url, options = {}) {
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "SelfMetaAI-DNA-SourceAuditor/1.0 (research@selfmetacognition.com)",
          accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
        ...options,
      })
      if (response.status === 404) return null
      if (response.status === 429 || response.status >= 500) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 500 * (attempt + 1)))
        continue
      }
      if (!response.ok) throw new Error(`${response.status} ${url}`)
      return await response.json()
    } catch (error) {
      lastError = error
      await new Promise((resolveWait) => setTimeout(resolveWait, 500 * (attempt + 1)))
    }
  }
  throw lastError
}

async function collectRawResponses() {
  const pmids = [...new Set(localSources.map((source) => source.pmid).filter(Boolean))]
  const pubmed = pmids.length
    ? await fetchJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(",")}&retmode=json`)
    : null
  const crossref = {}
  const europePmc = {}
  for (const source of localSources.filter((row) => row.doi)) {
    const encoded = encodeURIComponent(source.doi)
    const result = await fetchJson(`https://api.crossref.org/works/${encoded}`)
    crossref[source.doi] = result?.message || null
    if (!result?.message) {
      const fallback = await fetchJson(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(source.doi)}&format=json&pageSize=5`,
      )
      europePmc[source.doi] = fallback?.resultList?.result || []
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 90))
  }
  const isbn = {}
  for (const source of localSources.filter((row) => row.isbn)) {
    isbn[source.isbn] = await fetchJson(`https://openlibrary.org/isbn/${source.isbn}.json`)
  }
  return {
    schemaVersion: "dna-source-identity-raw-authority-responses@1",
    retrievedAt: new Date().toISOString(),
    authorities: {
      crossref: "https://api.crossref.org/works/{doi}",
      pubmed: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
      europePmcFallback: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
      isbnSecondaryCatalog: "https://openlibrary.org/isbn/{isbn}.json",
    },
    pubmed,
    crossref,
    europePmc,
    isbn,
  }
}

let raw
if (!refresh && existsSync(rawPath)) raw = readJson(rawPath)
else {
  raw = await collectRawResponses()
  writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8")
}

const existingOnlineByDoi = new Map(onlineManifest.records.map((record) => [
  canonicalDoi(record.normalizedDoi || record.doi),
  record,
]))
const pubmedResult = raw.pubmed?.result || {}
const localByDoi = new Map(localSources.filter((row) => row.doi).map((row) => [row.doi, row]))

function crossrefYear(work) {
  return work?.published?.["date-parts"]?.[0]?.[0]
    || work?.issued?.["date-parts"]?.[0]?.[0]
    || work?.created?.["date-parts"]?.[0]?.[0]
    || null
}

function crossrefAuthors(work) {
  return Array.isArray(work?.author)
    ? work.author.map((author) => [author.given, author.family].filter(Boolean).join(" ")).filter(Boolean)
    : []
}

function pubmedIds(summary) {
  const ids = Object.fromEntries((summary?.articleids || [])
    .filter((entry) => ["doi", "pubmed", "pmc"].includes(entry.idtype))
    .map((entry) => [entry.idtype, entry.value]))
  return {
    doi: canonicalDoi(ids.doi),
    pmid: canonicalPmid(ids.pubmed),
    pmcid: canonicalPmcid(ids.pmc),
  }
}

function isSecondaryDesign(source) {
  return source.recordPath.startsWith("textbooks/")
    || /review|meta|guideline|consensus|nomenclature|standard|ontology|white.paper|textbook|book|theory|perspective|reporting|circuit.based approaches/i
      .test(`${source.design} ${source.title}`)
}

function relationDois(work) {
  const output = []
  for (const [relation, rows] of Object.entries(work?.relation || {})) {
    for (const row of rows || []) {
      const doi = canonicalDoi(row.id)
      if (doi) output.push({ relation, doi })
    }
  }
  return output
}

function isOutgoingCorrectionRelation(relation) {
  return /^(?:is-(?:correction|erratum|corrigendum)-of|corrects|updates)$/i.test(relation)
}

function isIncomingCorrectionRelation(relation) {
  return /^(?:is-corrected-by|is-updated-by|has-(?:correction|erratum|update))$/i.test(relation)
}

function normalizeAgeScope(value) {
  const normalized = canonicalText(value)
  if (!normalized) return "not_reported"
  if (/all ages|lifespan|life span/.test(normalized)) return "all_ages"
  if (/older adult|geriatric|elderly/.test(normalized)) return "older_adult"
  if (/adolesc|youth|teen/.test(normalized)) return "adolescent"
  if (/pediatric|paediatric|child|infant|preschool|school age/.test(normalized)) return "pediatric"
  if (/adult/.test(normalized)) return "adult"
  if (/mixed|developmental/.test(normalized)) return "mixed"
  return "not_reported"
}

function normalizeSampleScope(value) {
  const normalized = canonicalText(value)
  if (!normalized) return "not_reported"
  if (/measurement|validation|psychometric|normative/.test(normalized)) return "measurement_validation_sample"
  if (/mixed/.test(normalized)) return "mixed_population"
  if (/clinical|patient|diagnos/.test(normalized)) return "clinical_population"
  if (/general|community|population based|healthy/.test(normalized)) return "general_population"
  if (/not applicable/.test(normalized)) return "not_applicable"
  return "not_reported"
}

if (isOutgoingCorrectionRelation("is-corrected-by") || !isIncomingCorrectionRelation("is-corrected-by")) {
  throw new Error("correction_relation_direction_gate_failed")
}

const identityRecords = []
const mismatchReasons = []
for (const source of localSources) {
  const crossref = source.doi ? raw.crossref[source.doi] : null
  const fallback = source.doi ? raw.europePmc[source.doi]?.[0] : null
  const existing = source.doi ? existingOnlineByDoi.get(source.doi) : null
  const pubmed = source.pmid ? pubmedResult[source.pmid] : null
  const remotePubmedIds = pubmedIds(pubmed)
  const authorityTitle = pubmed?.title || crossref?.title?.[0] || fallback?.title || source.title
  const authorityYear = firstYear(pubmed?.pubdate, pubmed?.epubdate)
    || crossrefYear(crossref)
    || Number(fallback?.pubYear)
    || source.year
  const authorityAuthors = crossrefAuthors(crossref).length
    ? crossrefAuthors(crossref)
    : Array.isArray(pubmed?.authors) ? pubmed.authors.map((author) => author.name).filter(Boolean)
      : fallback?.authorString ? fallback.authorString.split(",").map((author) => author.trim()).filter(Boolean)
        : source.authors
  const authorityVenue = crossref?.["container-title"]?.[0]
    || pubmed?.fulljournalname || pubmed?.source || fallback?.journalTitle || source.venue
  const remoteDoi = canonicalDoi(crossref?.DOI || fallback?.doi || existing?.normalizedDoi)
  const remotePmid = canonicalPmid(pubmed ? remotePubmedIds.pmid : fallback?.pmid)
  const remotePmcid = canonicalPmcid(pubmed ? remotePubmedIds.pmcid : fallback?.pmcid)
  const isbnAuthority = source.isbn ? raw.isbn[source.isbn] : null
  const remoteIsbn = isbnAuthority ? canonicalIsbn(source.isbn) : null
  const isbnTitleVerified = source.isbn === null || (isbnAuthority && titleMatches(source.title, isbnAuthority.title))
  const isbnYearVerified = source.isbn === null || (isbnAuthority && (
    !isbnAuthority.publish_date || firstYear(isbnAuthority.publish_date) === source.year
  ))
  const doiVerified = source.doi === null || remoteDoi === source.doi
  const pubmedVerified = source.pmid === null || (
    pubmed && remotePmid === source.pmid
      && (source.doi === null || canonicalDoi(remotePubmedIds.doi) === source.doi)
      && (source.pmcid === null || remotePmcid === source.pmcid)
  )
  const titleVerified = titleMatches(source.title, authorityTitle)
  const yearVerified = source.year === authorityYear
  const authorityMetadataComplete = authorityAuthors.length > 0 && Boolean(authorityVenue)
  const isbnVerified = source.isbn === null || Boolean(remoteIsbn && isbnTitleVerified && isbnYearVerified)
  const hasPrimaryIdentifier = Boolean(source.doi || source.pmid || source.isbn)
  const verified = hasPrimaryIdentifier && doiVerified && pubmedVerified
    && isbnVerified && titleVerified && yearVerified && authorityMetadataComplete
  const reasons = []
  if (!hasPrimaryIdentifier) reasons.push("no_primary_online_identifier")
  if (!doiVerified) reasons.push("doi_mismatch")
  if (!pubmedVerified) reasons.push("pubmed_pmc_crosswalk_mismatch")
  if (source.isbn && !isbnAuthority) reasons.push("isbn_authority_unavailable")
  else if (!isbnVerified) reasons.push("isbn_authority_mismatch")
  if (!titleVerified) reasons.push("title_mismatch")
  if (!yearVerified) reasons.push("year_mismatch")
  if (!authorityMetadataComplete) reasons.push("authors_or_venue_missing")
  if (reasons.some((reason) => /mismatch/.test(reason))) {
    mismatchReasons.push({ sourceId: source.sourceId, reasons })
  }

  const relations = relationDois(crossref)
  const preprintRelation = relations.find((row) => /preprint|version/i.test(row.relation))
  const outgoingCorrections = relations.filter((row) => isOutgoingCorrectionRelation(row.relation))
  const incomingCorrections = relations.filter((row) => isIncomingCorrectionRelation(row.relation))
  const outgoingCorrection = outgoingCorrections[0] || null
  const target = outgoingCorrection ? localByDoi.get(outgoingCorrection.doi) : null
  const correctionRelations = [
    ...outgoingCorrections.map((relation) => ({
      direction: "corrects",
      relationType: relation.relation,
      targetDoi: relation.doi,
      targetSourceId: localByDoi.get(relation.doi)?.sourceId || null,
    })),
    ...incomingCorrections.map((relation) => ({
      direction: "is_corrected_by",
      relationType: relation.relation,
      targetDoi: relation.doi,
      targetSourceId: localByDoi.get(relation.doi)?.sourceId || null,
    })),
  ].sort((left, right) => left.direction.localeCompare(right.direction)
    || left.targetDoi.localeCompare(right.targetDoi))
  const correctionResolution = correctionRelations.length === 0
    ? "not_applicable"
    : correctionRelations.every((relation) => relation.targetSourceId !== null)
      ? "resolved"
      : "pending"
  const titleIsCorrection = /^(?:correction|erratum|corrigendum)\b/i.test(source.title)
  const publicationRole = titleIsCorrection || outgoingCorrection
    ? "correction_notice"
    : /guideline|consensus|standard/i.test(source.design) ? "guideline"
      : /book|textbook/i.test(source.design) ? "book" : "article"
  const versionStatus = crossref?.type === "posted-content" || /preprint/i.test(crossref?.subtype || "")
    ? "preprint"
    : crossref || existing?.status === "verified_match" ? "version_of_record" : "unknown"
  const relatedPublished = preprintRelation ? localByDoi.get(preprintRelation.doi) : null
  const workId = relatedPublished ? `work:${relatedPublished.sourceId}` : `work:${source.sourceId}`
  const evidencePayload = { crossref, pubmed, fallback, existing }
  const cohortResolution = isSecondaryDesign(source) ? "not_applicable" : "unknown"

  identityRecords.push({
    sourceId: source.sourceId,
    workId,
    versionId: `version:${source.sourceId}:${versionStatus}`,
    versionStatus,
    publicationRole,
    correctionOfWorkId: target ? `work:${target.sourceId}` : null,
    correctionResolution,
    correctionRelations,
    cohortFamilyId: null,
    cohortResolution,
    bibliography: {
      title: source.title,
      authors: source.authors,
      year: source.year,
      venue: source.venue,
    },
    verifiedBibliography: {
      title: authorityTitle,
      authors: authorityAuthors,
      year: authorityYear,
      venue: authorityVenue || null,
    },
    identifiers: {
      doi: source.doi,
      pmid: source.pmid,
      pmcid: source.pmcid,
      isbn: source.isbn,
    },
    verifiedIdentifiers: {
      doi: remoteDoi,
      pmid: remotePmid,
      pmcid: remotePmcid,
      isbn: remoteIsbn,
    },
    identityVerification: {
      status: verified ? "verified" : reasons.some((reason) => /mismatch/.test(reason)) ? "mismatch" : "pending",
      authority: [source.doi ? "Crossref/Europe PMC" : null, source.pmid ? "PubMed" : null, source.isbn ? "OpenLibrary secondary catalog" : null]
        .filter(Boolean).join(" + ") || "local manifest only",
      verifiedAt: checkedAt,
      evidenceSha256: sha256(evidencePayload),
    },
    audit: {
      sourceRecordPath: source.recordPath,
      reasons,
      crossrefType: crossref?.type || null,
      crossrefSubtype: crossref?.subtype || null,
      relations,
      incomingCorrectionProvenance: incomingCorrections,
      externalCorrectionTargetDoi: outgoingCorrection && !target ? outgoingCorrection.doi : null,
      cohortReason: cohortResolution === "not_applicable" ? `secondary_or_reference_design:${source.design}` : "primary_cohort_not_resolved",
    },
  })
}

function componentDecision(source, component) {
  const policy = classifyLicense(source.license)
  const hasLicenseEvidence = /^https:\/\//.test(source.licenseUrl)
    && !/(?:example\.invalid|placeholder)/i.test(source.licenseUrl)
  if (component === "metadata") return "cleared"
  if (["table", "figure", "scale", "test_items"].includes(component)) return "restricted"
  if (["blocked_nc", "blocked_nd", "all_rights_reserved"].includes(policy)) return "restricted"
  if (!hasLicenseEvidence || policy === "unknown") return "unknown"
  if ((component === "full_text" || component === "passage") && policy === "cc_by_with_exceptions") return "restricted"
  if (!source.hasContentArtifact || !source.runtimeCandidate) return "metadata_only"
  if (["abstract", "full_text", "passage"].includes(component)
    && ["cc0", "cc_by", "cc_by_sa"].includes(policy)
    && source.licenseVerifiedInArtifact) return "cleared"
  return "unknown"
}

const components = ["metadata", "abstract", "full_text", "passage", "table", "figure", "scale", "test_items"]
function classifyPriorityInput(source) {
  const text = `${source.sourceId} ${source.design} ${source.title} ${source.categories.join(" ")}`.toLowerCase()
  let role
  let psychometricRole = null
  if (/polyvagal.*(?:exposition|porges-2021|current-status|response)/.test(text)) role = "theory_exposition"
  else if (/polyvagal.*(?:critique|premises|evaluation|untenable)/.test(text)) role = "theory_critique"
  else if (/textbook|foundational_book|^book\.|\/textbooks\//.test(`${source.design.toLowerCase()} ${source.sourceId} ${source.recordPath}`)) role = "textbook"
  else if (/psychometric|self-regulation measures|cosmin.*systematic review/.test(text)) {
    role = "measurement_systematic_review"
    psychometricRole = "systematic_review"
  } else if (/measurement|reporting.guideline|publication guidelines|autonomic testing|tripod|prisma-cosmin/.test(text)) {
    role = "measurement_standard"
    psychometricRole = "reporting_standard"
  } else if (/systematic|meta.analysis|umbrella.review|scoping.review/.test(text)) role = "systematic_review_meta_analysis"
  else if (/evidence.based.*guideline|clinical.practice.guideline/.test(text)) role = "evidence_based_guideline"
  else if (/consensus|nomenclature|standard|ontology|perspective/.test(text)) role = "consensus_or_nomenclature_standard"
  else role = "narrative_review"

  let population = "not_reported"
  if (role === "textbook" || role === "theory_exposition" || role === "theory_critique") population = "not_applicable"
  else if (/animal|cell type|cellular|synaptic|neurocardiology|translational/.test(text)) population = "mixed_human_animal"
  else if (/human|child|adult|autis|doctor|parent|emotion|sleep|stress|interoception|executive|clinical|patient|hrv|heart rate/.test(text)) population = "human"

  return {
    sourceId: source.sourceId,
    role,
    population,
    ageScope: normalizeAgeScope(source.declaredAgeScope),
    sampleScope: normalizeSampleScope(source.declaredSampleScope),
    psychometricRole,
    publicationVersion: identityRecords.find((record) => record.sourceId === source.sourceId)?.versionStatus || "unknown",
    auditBasis: {
      design: source.design,
      categories: source.categories,
      boundary: population === "mixed_human_animal"
        ? "Human and animal mechanism evidence must be represented separately before claim support."
        : population === "not_reported"
          ? "Population is unresolved; population-sensitive claim support is blocked."
          : null,
    },
  }
}

const priorityRecords = localSources.map(classifyPriorityInput)
const licenseRecords = localSources.map((source) => {
  const policy = classifyLicense(source.license)
  const attributionRequired = ["cc_by", "cc_by_sa", "cc_by_with_exceptions"].includes(policy)
  return {
    sourceId: source.sourceId,
    declaredLicense: source.license,
    policy,
    obligations: {
      attributionRequired,
      shareAlikeRequired: policy === "cc_by_sa",
    },
    components: components.map((component) => {
      const decision = componentDecision(source, component)
      const allowed = decision === "cleared"
      const evidenceBasis = component === "metadata"
        ? "metadata_fact"
        : allowed && source.licenseVerifiedInArtifact
          ? "verified_in_artifact"
          : "unverified"
      return {
        component,
        decision,
        commercialUse: allowed ? "allowed" : decision === "restricted" ? "prohibited" : "unknown",
        adaptation: allowed ? "allowed" : decision === "restricted" ? "prohibited" : "unknown",
        textAndDataMining: allowed ? "allowed" : decision === "restricted" ? "prohibited" : "unknown",
        redisplay: allowed ? "allowed" : decision === "restricted" ? "prohibited" : "unknown",
        thirdPartyMaterialReviewed: false,
        evidence: {
          sourceId: source.sourceId,
          url: source.licenseUrl.startsWith("https://") ? source.licenseUrl : "https://example.invalid/licence-unavailable",
          checkedAt: source.retrievedAt || checkedAt,
          sha256: evidenceBasis === "verified_in_artifact"
            ? source.licenseArtifactSha256
            : source.evidenceSha256,
          basis: evidenceBasis,
          artifactRelativePath: evidenceBasis === "verified_in_artifact"
            ? source.licenseArtifactRelativePath
            : null,
        },
      }
    }),
    audit: {
      sourceRecordPath: source.recordPath,
      hasContentArtifact: source.hasContentArtifact,
      mixedEmbeddedMaterial: source.mixedEmbeddedMaterial,
      runtimeCandidate: source.runtimeCandidate,
      missingLicenseEvidence: !/^https:\/\//.test(source.licenseUrl)
        || /(?:example\.invalid|placeholder)/i.test(source.licenseUrl),
      licenseVerifiedInArtifact: source.licenseVerifiedInArtifact,
      licenseArtifactRelativePath: source.licenseArtifactRelativePath,
    },
  }
})

const identityAudit = {
  schemaVersion: "dna-source-identity-audit@1",
  auditedAt: new Date().toISOString(),
  authorityResponseSha256: sha256File(rawPath),
  records: identityRecords,
}
const licenseAudit = {
  schemaVersion: "dna-component-license-audit@1",
  auditedAt: new Date().toISOString(),
  records: licenseRecords,
}
const priorityAudit = {
  schemaVersion: "dna-source-priority-input-audit@1",
  auditedAt: identityAudit.auditedAt,
  records: priorityRecords,
}
writeFileSync(identityPath, `${JSON.stringify(identityAudit, null, 2)}\n`, "utf8")
writeFileSync(priorityPath, `${JSON.stringify(priorityAudit, null, 2)}\n`, "utf8")
writeFileSync(licensePath, `${JSON.stringify(licenseAudit, null, 2)}\n`, "utf8")

const decisionCounts = {}
for (const record of licenseRecords) for (const component of record.components) {
  const key = `${component.component}:${component.decision}`
  decisionCounts[key] = (decisionCounts[key] || 0) + 1
}
const identityCounts = Object.fromEntries(["verified", "pending", "mismatch"].map((status) => [
  status,
  identityRecords.filter((record) => record.identityVerification.status === status).length,
]))
const cohortCounts = Object.fromEntries(["resolved", "not_applicable", "unknown"].map((status) => [
  status,
  identityRecords.filter((record) => record.cohortResolution === status).length,
]))
const correctionResolutionCounts = Object.fromEntries(["resolved", "pending", "not_applicable"].map((status) => [
  status,
  identityRecords.filter((record) => record.correctionResolution === status).length,
]))
const summary = {
  schemaVersion: "dna-source-governance-online-audit-summary@1",
  auditedAt: identityAudit.auditedAt,
  counts: {
    records: localSources.length,
    identity: identityCounts,
    cohorts: cohortCounts,
    corrections: correctionResolutionCounts,
    componentMatricesCompleted: licenseRecords.length,
    componentsAudited: licenseRecords.length * components.length,
    priorityRecordsCompleted: priorityRecords.length,
    priorityRoleCounts: Object.fromEntries([...new Set(priorityRecords.map((record) => record.role))].sort().map((role) => [
      role,
      priorityRecords.filter((record) => record.role === role).length,
    ])),
    populationScopeCounts: Object.fromEntries([...new Set(priorityRecords.map((record) => record.population))].sort().map((population) => [
      population,
      priorityRecords.filter((record) => record.population === population).length,
    ])),
    ageScopeCounts: Object.fromEntries([...new Set(priorityRecords.map((record) => record.ageScope))].sort().map((ageScope) => [
      ageScope,
      priorityRecords.filter((record) => record.ageScope === ageScope).length,
    ])),
    sampleScopeCounts: Object.fromEntries([...new Set(priorityRecords.map((record) => record.sampleScope))].sort().map((sampleScope) => [
      sampleScope,
      priorityRecords.filter((record) => record.sampleScope === sampleScope).length,
    ])),
    licenseDecisionCounts: decisionCounts,
    mismatchRecords: mismatchReasons.length,
    correctionRelationDirectionGatePassed: true,
  },
  ledgers: {
    rawAuthorityResponses: { path: relative(root, rawPath), bytes: statSync(rawPath).size, sha256: sha256File(rawPath) },
    identityAudit: { path: relative(root, identityPath), bytes: statSync(identityPath).size, sha256: sha256File(identityPath) },
    priorityInputAudit: { path: relative(root, priorityPath), bytes: statSync(priorityPath).size, sha256: sha256File(priorityPath) },
    componentLicenseAudit: { path: relative(root, licensePath), bytes: statSync(licensePath).size, sha256: sha256File(licensePath) },
  },
  mismatchReasons,
}
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8")

console.log(JSON.stringify({ root, outputRoot, ...summary.counts, summarySha256: sha256File(summaryPath) }, null, 2))
