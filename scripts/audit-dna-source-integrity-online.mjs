#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  realpathSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path"
import { spawnSync } from "node:child_process"

import { validateDnaCorrectionResolutionAttestation } from "./dna-correction-resolution-lib.mjs"

import {
  DNA_SOURCE_ACQUISITION_LEDGER_VERSION,
  evaluateDnaSourceIntegrity,
  inferDnaSourceUpdateDirection,
  isSafeDnaAcquisitionRelativePath,
  normalizeDnaSourceUpdateType,
  resolveDnaAcquisitionArtifactWithinRoot,
  verifyDnaSourceAcquisitionLedger,
} from "../src/lib/dna/chat/governance/sourceIntegrity.ts"

const researchSsdRootInput = process.env.RESEARCH_SSD_ROOT
if (!researchSsdRootInput) throw new Error("RESEARCH_SSD_ROOT is required")
const researchSsdRootCandidate = resolve(researchSsdRootInput)
if (!existsSync(researchSsdRootCandidate)) throw new Error("ResearchSSD root is not mounted")
const researchSsdRoot = realpathSync(researchSsdRootCandidate)
const repositoryRoot = resolve(dirname(resolve(process.argv[1])), "..")
const correctionAttestationPath = resolve(
  repositoryRoot,
  "docs/dna-intelligence/governance/v3/correction-resolution-attestations/tripod-ai-2024.json",
)
const rootCandidate = resolve(
  process.env.DNA_SOURCE_LIBRARY_ROOT
    || process.argv.find((argument) => argument.startsWith("--root="))?.slice(7)
    || join(researchSsdRoot, "Datasets", "SelfMetaAI", "dna-knowledge", "source-library"),
)
const refresh = process.argv.includes("--refresh")
const offlineVerify = process.argv.includes("--offline-verify")
if (refresh === offlineVerify) {
  throw new Error("Choose exactly one mode: --refresh or --offline-verify")
}
if (!(rootCandidate === researchSsdRootCandidate || rootCandidate.startsWith(`${researchSsdRootCandidate}${sep}`))
  || !existsSync(rootCandidate)) {
  throw new Error(`ResearchSSD source library unavailable: ${rootCandidate}`)
}
const root = realpathSync(rootCandidate)
if (!(root === researchSsdRoot || root.startsWith(`${researchSsdRoot}${sep}`))) {
  throw new Error("ResearchSSD source library realpath escapes configured root")
}
const checkedAt = new Date().toISOString()
const integrityOutputRoot = join(root, "integrity-audit", "v1")
const acquisitionOutputRoot = join(root, "acquisition-audit", "v1")
const integrityRawPath = join(integrityOutputRoot, "raw-online-integrity-responses.json")
const integrityAuditPath = join(integrityOutputRoot, "source-integrity-audit.json")
const integritySummaryPath = join(integrityOutputRoot, "source-integrity-summary.json")
const acquisitionLedgerPath = join(acquisitionOutputRoot, "acquisition-ledger.json")
const acquisitionVerificationPath = join(acquisitionOutputRoot, "acquisition-verification.json")
const auditHistoryRoot = join(root, "audit-history", "v1")
const auditHistoryCurrentPath = join(auditHistoryRoot, "current.json")
if (!offlineVerify) {
  mkdirSync(integrityOutputRoot, { recursive: true })
  mkdirSync(acquisitionOutputRoot, { recursive: true })
  mkdirSync(auditHistoryRoot, { recursive: true })
  for (const directory of [integrityOutputRoot, acquisitionOutputRoot, auditHistoryRoot]) {
    const real = realpathSync(directory)
    if (!(real === root || real.startsWith(`${root}${sep}`))) {
      throw new Error(`Audit output directory escapes source root: ${directory}`)
    }
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function loadVerifiedCorrectionAttestations() {
  if (!existsSync(correctionAttestationPath)) return new Map()
  const attestation = readJson(correctionAttestationPath)
  const validation = validateDnaCorrectionResolutionAttestation(attestation)
  if (!validation.ok || attestation.decision?.status !== "verified_applied") return new Map()
  const verifier = spawnSync(
    process.execPath,
    [resolve(repositoryRoot, "scripts/verify-dna-correction-resolution-attestation.mjs"), "--ssd"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, RESEARCH_SSD_ROOT: researchSsdRoot },
      timeout: 60_000,
    },
  )
  if (verifier.status !== 0) return new Map()
  try {
    const result = JSON.parse(verifier.stdout)
    if (!result.ok || result.attestationSha256 !== attestation.attestationSha256
      || result.ssdArchiveVerified !== true) return new Map()
  } catch {
    return new Map()
  }
  return new Map([[attestation.source.sourceId, Object.freeze({
    schemaVersion: attestation.schemaVersion,
    attestationId: attestation.attestationId,
    attestationSha256: attestation.attestationSha256,
    checkedAt: attestation.checkedAt,
    decision: attestation.decision,
    passedCheckCount: attestation.checks.filter((check) => check.status === "passed").length,
    requiredCheckCount: attestation.checks.length,
    ssdArchiveVerified: true,
  })]])
}

function readContainedJson(path) {
  const relativePath = relative(root, path).replaceAll("\\", "/")
  const safePath = resolveDnaAcquisitionArtifactWithinRoot(root, relativePath)
  return readJson(safePath)
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
}

function sha256(value) {
  return createHash("sha256").update(
    Buffer.isBuffer(value) || typeof value === "string" ? value : stableJson(value),
  ).digest("hex")
}

function sha256File(path) {
  return sha256(readFileSync(path))
}

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writeJson(path, value) {
  writeFileSync(path, jsonBytes(value), "utf8")
}

function writeImmutableJson(path, value) {
  writeFileSync(path, jsonBytes(value), { encoding: "utf8", flag: "wx" })
}

function timestampToken(value) {
  return String(value || "unknown-time").replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
}

function archiveAuditBundle(bundle) {
  const namedValues = [
    ["raw-online-integrity-responses.json", bundle.rawOnline],
    ["source-integrity-audit.json", bundle.integrityAudit],
    ["source-integrity-summary.json", bundle.integritySummary],
    ["acquisition-ledger.json", bundle.acquisitionLedger],
    ["acquisition-verification.json", bundle.acquisitionVerification],
  ]
  const contentHashes = Object.fromEntries(namedValues.map(([name, value]) => [name, sha256(value)]))
  const bundleSha256 = sha256(contentHashes)
  const runId = `${timestampToken(bundle.integrityAudit.checkedAt || bundle.acquisitionLedger.generatedAt)}--${bundleSha256.slice(0, 16)}`
  const runRoot = join(auditHistoryRoot, runId)
  const manifestPath = join(runRoot, "manifest.json")
  if (existsSync(runRoot)) {
    const manifest = readContainedJson(manifestPath)
    if (manifest.bundleSha256 !== bundleSha256) throw new Error("dna_integrity_history_run_collision")
    for (const file of manifest.files || []) {
      const absolute = resolveDnaAcquisitionArtifactWithinRoot(root, file.relativePath)
      if (sha256File(absolute) !== file.sha256) throw new Error("dna_integrity_history_file_hash_mismatch")
    }
    return { runId, manifest, manifestPath }
  }
  mkdirSync(runRoot, { recursive: false })
  const runRootReal = realpathSync(runRoot)
  if (!(runRootReal === root || runRootReal.startsWith(`${root}${sep}`))) {
    throw new Error("dna_integrity_history_root_escape")
  }
  const files = []
  for (const [name, value] of namedValues) {
    const path = join(runRoot, name)
    writeImmutableJson(path, value)
    files.push(Object.freeze({
      relativePath: relative(root, path).replaceAll("\\", "/"),
      sha256: sha256File(path),
      bytes: statSync(path).size,
    }))
  }
  const manifest = {
    schemaVersion: "dna-source-audit-history-manifest@1",
    runId,
    auditedAt: bundle.integrityAudit.checkedAt || bundle.acquisitionLedger.generatedAt,
    bundleSha256,
    files,
  }
  writeImmutableJson(manifestPath, manifest)
  return { runId, manifest, manifestPath }
}

function archiveCurrentAuditIfComplete() {
  const paths = [
    integrityRawPath,
    integrityAuditPath,
    integritySummaryPath,
    acquisitionLedgerPath,
    acquisitionVerificationPath,
  ]
  if (!paths.every(existsSync)) return null
  return archiveAuditBundle({
    rawOnline: readContainedJson(integrityRawPath),
    integrityAudit: readContainedJson(integrityAuditPath),
    integritySummary: readContainedJson(integritySummaryPath),
    acquisitionLedger: readContainedJson(acquisitionLedgerPath),
    acquisitionVerification: readContainedJson(acquisitionVerificationPath),
  })
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

const priorArchivedAudit = refresh ? archiveCurrentAuditIfComplete() : null
const verifiedCorrectionAttestations = loadVerifiedCorrectionAttestations()

function canonicalDoi(value) {
  if (!value) return null
  return String(value).trim().replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/[.,;:]+$/, "").toLowerCase()
}

function canonicalIsbn(value) {
  if (!value) return null
  return String(value).replace(/^isbn(?:-1[03])?\s*:\s*/i, "")
    .replace(/[^0-9X]/gi, "").toUpperCase() || null
}

function firstString(value) {
  if (Array.isArray(value)) return value.find((item) => typeof item === "string") || null
  return typeof value === "string" ? value : null
}

function firstYear(...values) {
  for (const value of values) {
    const match = String(value ?? "").match(/(?:18|19|20|21)\d{2}/)
    if (match) return Number(match[0])
  }
  return null
}

function crossrefYear(work) {
  return work?.published?.["date-parts"]?.[0]?.[0]
    || work?.issued?.["date-parts"]?.[0]?.[0]
    || work?.created?.["date-parts"]?.[0]?.[0]
    || null
}

function cslYear(work) {
  return work?.issued?.["date-parts"]?.[0]?.[0]
    || work?.published?.["date-parts"]?.[0]?.[0]
    || firstYear(work?.issued?.raw, work?.published?.raw)
}

function personNames(rows) {
  return Array.isArray(rows) ? rows.map((person) => {
    if (typeof person === "string") return person
    return [person?.given, person?.family || person?.name].filter(Boolean).join(" ")
  }).filter(Boolean) : []
}

function remoteAuthors({ crossref, doiCsl, pubmed, europePmc, officialIdentity }) {
  const candidates = [
    personNames(crossref?.author),
    personNames(doiCsl?.author),
    Array.isArray(pubmed?.authors) ? pubmed.authors.map((author) => author.name).filter(Boolean) : [],
    Array.isArray(europePmc?.authorList?.author)
      ? europePmc.authorList.author.map((author) => author.fullName || author.lastName).filter(Boolean) : [],
    officialIdentity ? [...(officialIdentity.verifiedBibliography?.authors || [])] : [],
  ]
  return candidates.find((authors) => authors.length > 0) || []
}

function canonicalText(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

function titleSimilarity(expected, observed) {
  const left = new Set(canonicalText(expected).split(" ").filter(Boolean))
  const right = new Set(canonicalText(observed).split(" ").filter(Boolean))
  const intersection = [...left].filter((token) => right.has(token)).length
  return intersection / Math.max(1, new Set([...left, ...right]).size)
}

function bestTitle(expected, candidates) {
  return candidates.filter(Boolean).sort((left, right) =>
    titleSimilarity(expected, right) - titleSimilarity(expected, left)
    || String(left).localeCompare(String(right)))[0] || null
}

function crossrefUpdate(update, direction) {
  const source = String(update?.source || "").toLowerCase()
  return {
    type: normalizeDnaSourceUpdateType(update?.type || update?.label),
    authority: source === "retraction-watch"
      ? "crossref_retraction_watch"
      : "crossref_publisher",
    direction,
    noticeId: canonicalDoi(update?.DOI) || String(update?.["record-id"] || "") || null,
    noticeUrl: update?.DOI ? `https://doi.org/${canonicalDoi(update.DOI)}` : null,
    observedAt: update?.updated?.["date-time"] || null,
  }
}

function pubmedCorrectionUpdate(update) {
  const type = normalizeDnaSourceUpdateType(update?.type)
  const referenceDoi = String(update?.reference || "").match(/10\.\d{4,9}\/[^\s]+/i)?.[0]
  return {
    type,
    authority: "europe_pmc",
    direction: inferDnaSourceUpdateDirection(String(update?.type || "")),
    noticeId: referenceDoi ? canonicalDoi(referenceDoi) : String(update?.id || "") || null,
    noticeUrl: update?.id ? `https://pubmed.ncbi.nlm.nih.gov/${update.id}/` : null,
    observedAt: null,
  }
}

async function fetchJson(url, options = {}) {
  let lastError = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "SelfMetaAI-DNA-IntegrityAuditor/2.0 (research@selfmetacognition.com)",
          accept: "application/json",
          ...(options.headers || {}),
        },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfterSeconds = Number(response.headers.get("retry-after") || 1)
          await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.max(1000, retryAfterSeconds * 1000)))
          continue
        }
        if (response.status >= 500 && attempt < 3) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * (attempt + 1)))
          continue
        }
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, 300 * (attempt + 1)))
    }
  }
  throw lastError
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

function runOfflineVerification() {
  const rawOnline = readContainedJson(integrityRawPath)
  const integrityAudit = readContainedJson(integrityAuditPath)
  const integritySummary = readContainedJson(integritySummaryPath)
  const ledger = readContainedJson(acquisitionLedgerPath)
  const savedAcquisition = readContainedJson(acquisitionVerificationPath)
  const integrityDecisions = integrityAudit.records.map((record) => {
    const evaluated = evaluateDnaSourceIntegrity(record.auditInput)
    return {
      sourceId: record.sourceId,
      accepted: evaluated.auditSha256 === record.auditSha256
        && evaluated.state === record.state
        && stableJson(evaluated.identityChecks) === stableJson(record.identityChecks),
    }
  })
  const observations = ledger.entries.map(observeArtifact)
  const verifiedLedger = verifyDnaSourceAcquisitionLedger({
    entries: ledger.entries,
    observedArtifacts: observations,
  })
  let auditHistoryCurrentValid = false
  if (existsSync(auditHistoryCurrentPath)) {
    try {
      const pointer = readContainedJson(auditHistoryCurrentPath)
      const manifestPath = resolveDnaAcquisitionArtifactWithinRoot(root, pointer.manifestRelativePath)
      const manifest = readJson(manifestPath)
      auditHistoryCurrentValid = pointer.runId === manifest.runId
        && pointer.manifestSha256 === sha256File(manifestPath)
        && pointer.bundleSha256 === manifest.bundleSha256
        && (manifest.files || []).every((file) => {
          const path = resolveDnaAcquisitionArtifactWithinRoot(root, file.relativePath)
          return sha256File(path) === file.sha256 && statSync(path).size === file.bytes
        })
    } catch {
      auditHistoryCurrentValid = false
    }
  }
  const checks = {
    sourceCount47: integrityAudit.records.length === 47,
    integrityRecordsReproducible: integrityDecisions.every((decision) => decision.accepted),
    rawAuthorityHashMatched: integrityAudit.rawAuthorityResponsesSha256 === sha256(rawOnline),
    integrityAuditHashMatched: integritySummary.auditSha256 === sha256(integrityAudit),
    ledgerVersionMatched: ledger.schemaVersion === DNA_SOURCE_ACQUISITION_LEDGER_VERSION,
    ledgerHasRelativePathsOnly: ledger.entries.every((entry) => !entry.relativePath.startsWith("/")
      && !entry.relativePath.includes("..") && !entry.relativePath.includes("\\")),
    ledgerContainsNoSsdAbsolutePath: !JSON.stringify(ledger).includes(researchSsdRoot),
    acquisitionArtifactsAccepted: verifiedLedger.accepted,
    acquisitionAuditHashMatched: verifiedLedger.auditSha256 === savedAcquisition.auditSha256,
    auditHistoryCurrentValid,
  }
  const result = {
    ok: Object.values(checks).every(Boolean),
    mode: "offline_verify_no_network_no_writes",
    checks,
    integrity: {
      sourceCount: integrityAudit.records.length,
      reproducibleCount: integrityDecisions.filter((decision) => decision.accepted).length,
      stateCounts: integritySummary.stateCounts,
    },
    acquisition: {
      entryCount: ledger.entries.length,
      acceptedCount: verifiedLedger.acceptedCount,
      rejectedCount: verifiedLedger.rejectedCount,
    },
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (!result.ok) process.exitCode = 1
}

if (offlineVerify) {
  runOfflineVerification()
  process.exit(process.exitCode || 0)
}

function localSourceMetadata() {
  const result = new Map()
  for (const path of walk(root).filter((candidate) => basename(candidate) === "source.json")) {
    if (path.includes("/integrity-audit/") || path.includes("/acquisition-audit/")) continue
    const record = readJson(path)
    const sourceId = String(record.id || record.slug || "")
    if (!sourceId) continue
    const bibliography = record.bibliography || {}
    result.set(sourceId, {
      path,
      record,
      publisher: String(record.publisher || bibliography.publisher || "") || null,
      venue: String(record.venue || bibliography.venue || bibliography.journal || "") || null,
      version: String(record.version || bibliography.version || "") || null,
    })
  }
  const restricted = readContainedJson(join(root, "restricted-metadata", "sources.json"))
  for (const row of restricted.sources || []) {
    result.set(String(row.id), {
      path: join(root, "restricted-metadata", "sources.json"),
      record: row,
      publisher: String(row.publisher || "") || null,
      venue: String(row.venue || "") || null,
      version: String(row.version || row.bibliography?.version || "") || null,
    })
  }
  return result
}

const identityAudit = readContainedJson(join(root, "governance-audit", "v1", "identity-audit.json"))
const identityRaw = readContainedJson(join(root, "governance-audit", "v1", "raw-online-identity-responses.json"))
const previousIntegrity = existsSync(integrityAuditPath) ? readContainedJson(integrityAuditPath) : null
const previousById = new Map((previousIntegrity?.records || []).map((row) => [row.sourceId, row]))
const localMetadata = localSourceMetadata()
const identityRecords = [...identityAudit.records].sort((a, b) => a.sourceId.localeCompare(b.sourceId))
const allPmids = [...new Set(identityRecords.map((identity) =>
  String(identity.identifiers?.pmid || identity.verifiedIdentifiers?.pmid || "")).filter(Boolean))]
let pubmedBatch = null
let pubmedBatchError = null
if (allPmids.length > 0) {
  try {
    pubmedBatch = await fetchJson(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${encodeURIComponent(allPmids.join(","))}&retmode=json`,
    )
  } catch (error) {
    pubmedBatchError = String(error?.message || error)
  }
}

const integrityFacts = await mapLimit(identityRecords, 2, async (identity) => {
  const doi = canonicalDoi(identity.identifiers?.doi || identity.verifiedIdentifiers?.doi)
  const pmid = String(identity.identifiers?.pmid || identity.verifiedIdentifiers?.pmid || "") || null
  const local = localMetadata.get(identity.sourceId)
  const correctionAttestation = verifiedCorrectionAttestations.get(identity.sourceId) || null
  const officialRaw = identityRaw.officialMetadata?.[identity.sourceId] || null
  const officialApplicable = Object.prototype.hasOwnProperty.call(
    identityRaw.officialMetadata || {}, identity.sourceId,
  )
  const officialObservedIdentity = officialApplicable && !officialRaw?.error ? identity : null
  const officialIdentity = officialObservedIdentity
    && identity.identityVerification?.status === "verified"
    && /official|Open Textbook Library|eCampusOntario|Autism CRC/i.test(identity.identityVerification?.authority || "")
    ? identity : null
  let crossref = null
  let crossrefError = null
  let doiRegistrationAgency = null
  let doiRegistrationAgencyError = null
  let doiCsl = null
  let doiCslError = null
  let europePmc = null
  let europePmcError = null
  let pubmed = null
  let pubmedError = null

  if (doi) {
    try {
      const agencyRows = await fetchJson(`https://doi.org/ra/${encodeURIComponent(doi)}`)
      doiRegistrationAgency = Array.isArray(agencyRows) ? agencyRows[0] || null : null
    } catch (error) {
      doiRegistrationAgencyError = String(error?.message || error)
    }
    const registrationAgency = String(doiRegistrationAgency?.RA || "").toLowerCase()
    if (registrationAgency === "crossref") {
      try {
        crossref = (await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)).message
      } catch (error) {
        crossrefError = String(error?.message || error)
      }
    } else if (doiRegistrationAgency) {
      try {
        doiCsl = await fetchJson(`https://doi.org/${encodeURIComponent(doi)}`, {
          headers: { accept: "application/vnd.citationstyles.csl+json" },
        })
      } catch (error) {
        doiCslError = String(error?.message || error)
      }
    }
  }
  if (pmid) {
    try {
      europePmc = (await fetchJson(
        `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(`EXT_ID:${pmid} AND SRC:MED`)}&format=json&resultType=core&pageSize=1`,
      )).resultList?.result?.[0] || null
      if (!europePmc) europePmcError = "no_result"
    } catch (error) {
      europePmcError = String(error?.message || error)
    }
    pubmed = pubmedBatch?.result?.[pmid] || null
    if (!pubmed) pubmedError = pubmedBatchError || "no_result"
  }

  const registrationAgency = String(doiRegistrationAgency?.RA || "").toLowerCase()
  const isCrossrefDoi = registrationAgency === "crossref"
  const crossrefUpdatedBy = Array.isArray(crossref?.["updated-by"]) ? crossref["updated-by"] : []
  const crossrefUpdateTo = Array.isArray(crossref?.["update-to"]) ? crossref["update-to"] : []
  const europeCorrections = europePmc?.commentCorrectionList?.commentCorrection || []
  const integrityRelevantEuropeCorrections = europeCorrections.filter((item) =>
    normalizeDnaSourceUpdateType(item?.type) !== "unknown")
  const updates = [
    ...crossrefUpdatedBy.map((item) => crossrefUpdate(item, "updates_source")),
    ...crossrefUpdateTo.map((item) => crossrefUpdate(item, "source_updates_other")),
    ...integrityRelevantEuropeCorrections.map(pubmedCorrectionUpdate),
  ]
  const publicationTypes = [
    ...(Array.isArray(pubmed?.pubtype) ? pubmed.pubtype : []),
    ...(Array.isArray(europePmc?.pubTypeList?.pubType) ? europePmc.pubTypeList.pubType : []),
  ]
  const expectedVenue = identity.bibliography?.venue || local?.venue
    || identity.verifiedBibliography?.venue || null
  // Some legacy article manifests stored the journal/container in the
  // `publisher` field. If that value is the same as the independently resolved
  // venue, treat it as an unasserted publisher instead of comparing a journal
  // title with Crossref's publishing organization.
  const publisherIsVenueAlias = Boolean(local?.publisher && expectedVenue
    && canonicalText(local.publisher) === canonicalText(expectedVenue))
  const expectedPublisher = publisherIsVenueAlias ? null : local?.publisher || null
  const expectedYear = Number(identity.bibliography?.year) || null
  const expectedAuthors = Array.isArray(identity.bibliography?.authors)
    ? identity.bibliography.authors.filter(Boolean) : []
  const expectedIsbn = canonicalIsbn(identity.identifiers?.isbn)
  const expectedVersion = local?.version || null
  const observedYearCandidates = [...new Set([
    crossrefYear(crossref),
    cslYear(doiCsl),
    firstYear(pubmed?.pubdate, pubmed?.epubdate),
    Number(europePmc?.pubYear) || null,
    Number(officialObservedIdentity?.verifiedBibliography?.year) || null,
  ].filter((year) => Number.isInteger(year) && year > 0))]
  // Online-first and issue publication years can legitimately differ. Prefer
  // the locally asserted year only when at least one independent authority
  // reports it; otherwise retain the first authority year and fail closed.
  const observedYear = observedYearCandidates.includes(expectedYear)
    ? expectedYear : observedYearCandidates[0] || null
  const observedAuthors = remoteAuthors({
    crossref,
    doiCsl,
    pubmed,
    europePmc,
    officialIdentity: officialObservedIdentity,
  })
  const observedIsbn = canonicalIsbn(
    firstString(crossref?.ISBN) || firstString(doiCsl?.ISBN)
      || officialObservedIdentity?.verifiedIdentifiers?.isbn,
  )
  const observedVersion = officialIdentity?.verifiedBibliography?.version || null
  const input = {
    sourceId: identity.sourceId,
    checkedAt,
    publicationKind: identity.publicationRole === "book"
      ? "book"
      : identity.publicationRole === "guideline" ? "guideline" : "article",
    expected: {
      title: identity.bibliography?.title || "",
      doi,
      year: expectedYear,
      authors: expectedAuthors,
      isbn: expectedIsbn,
      version: expectedVersion,
      venue: expectedVenue,
      publisher: expectedPublisher,
    },
    observed: {
      title: bestTitle(identity.bibliography?.title || "", [
        firstString(crossref?.title), doiCsl?.title, pubmed?.title, europePmc?.title,
        officialObservedIdentity?.verifiedBibliography?.title,
      ]),
      doi: canonicalDoi(crossref?.DOI || doiCsl?.DOI
        || pubmed?.articleids?.find((item) => item.idtype === "doi")?.value || europePmc?.doi),
      year: observedYear,
      authors: observedAuthors,
      isbn: observedIsbn,
      version: observedVersion,
      venue: firstString(crossref?.["container-title"]) || doiCsl?.["container-title"]
        || pubmed?.source || europePmc?.journalInfo?.journal?.title
        || officialObservedIdentity?.verifiedBibliography?.venue || null,
      publisher: String(crossref?.publisher || doiCsl?.publisher
        || officialObservedIdentity?.verifiedBibliography?.publisher || "") || null,
    },
    authorityCoverage: {
      doiRegistrationAgency: doi
        ? doiRegistrationAgency ? "checked" : "unavailable" : "not_applicable",
      doiMetadata: doi
        ? crossref || doiCsl ? "checked" : "unavailable" : "not_applicable",
      officialMetadata: officialApplicable
        ? officialRaw && !officialRaw.error ? "checked" : "unavailable" : "not_applicable",
      crossref: doi ? isCrossrefDoi ? crossref ? "checked" : "unavailable" : "not_applicable" : "not_applicable",
      retractionWatch: doi ? isCrossrefDoi ? crossref ? "checked" : "unavailable" : "not_applicable" : "not_applicable",
      crossmark: doi ? isCrossrefDoi ? crossref ? "checked" : "unavailable" : "not_applicable" : "not_applicable",
      pubmed: pmid ? pubmed ? "checked" : "unavailable" : "not_applicable",
      europePmc: pmid ? europePmc ? "checked" : "unavailable" : "not_applicable",
    },
    updates,
    publicationTypes,
    correctionResolution: correctionAttestation?.decision.sourceIntegrityResolution === "applied"
      ? "applied"
      : identity.correctionResolution === "resolved"
      || identity.correctionResolution === "applied"
      ? "applied"
      : identity.correctionResolution === "not_applicable" ? "not_applicable" : "pending",
    reinstatementReview: local?.record.reinstatementReview || null,
    priorHistory: previousById.get(identity.sourceId)?.history || [],
  }
  const record = evaluateDnaSourceIntegrity(input)
  return {
    sourceId: identity.sourceId,
    input,
    record,
    raw: {
      doiRegistrationAgency,
      doiRegistrationAgencyError,
      doiCsl,
      doiCslError,
      crossref,
      crossrefError,
      europePmc,
      europePmcError,
      pubmed,
      pubmedError,
      officialMetadata: officialRaw,
      officialIdentityEvidenceSha256: officialApplicable
        ? identity.identityVerification?.evidenceSha256 || null : null,
      correctionAttestation,
    },
    metadataNormalization: {
      publisherExpectation: publisherIsVenueAlias
        ? "legacy_venue_alias_not_used_as_publisher_assertion"
        : expectedPublisher ? "local_publisher_assertion" : "not_asserted",
    },
    correctionAttestation,
    crossmark: {
      updatePolicy: crossref?.["update-policy"] || null,
      updatedByCount: crossrefUpdatedBy.length,
      updateToCount: crossrefUpdateTo.length,
      retractionWatchMarkerCount: [...crossrefUpdatedBy, ...crossrefUpdateTo]
        .filter((item) => String(item?.source || "").toLowerCase() === "retraction-watch").length,
    },
  }
})

const rawOnline = {
  schemaVersion: "dna-source-integrity-raw-authority-responses@2",
  checkedAt,
  authorities: {
    crossref: "https://api.crossref.org/works/{doi}",
    doiRegistrationAgency: "https://doi.org/ra/{doi}",
    doiCslMetadata: "https://doi.org/{doi} with application/vnd.citationstyles.csl+json",
    retractionWatch: "Crossref updated-by/update-to source=retraction-watch",
    crossmark: "Crossref updated-by/update-to/update-policy",
    pubmed: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
    europePmc: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
  officialMetadata: "hash-bound official source authority pass from governance-audit/v1",
    correctionResolution: "repository attestation plus append-only ResearchSSD evidence archive",
  },
  responses: Object.fromEntries(integrityFacts.map((fact) => [fact.sourceId, fact.raw])),
}

const integrityRecords = integrityFacts.map((fact) => ({
  ...fact.record,
  auditInput: fact.input,
  inputSha256: sha256(fact.input),
  rawAuthorityResponseSha256: sha256(fact.raw),
  crossmark: fact.crossmark,
  correctionAttestation: fact.correctionAttestation,
  metadataNormalization: fact.metadataNormalization,
}))
const integrityCounts = Object.fromEntries(
  ["verified_clean", "corrected", "superseded", "pending", "quarantined", "withdrawn"]
    .map((state) => [state, integrityRecords.filter((record) => record.state === state).length]),
)
const authorityUnavailableCount = integrityRecords.filter((record) =>
  Object.values(record.authorityCoverage).some((state) => state === "unavailable")).length
const integrityAudit = {
  schemaVersion: "dna-source-integrity-audit@2",
  checkedAt,
  sourceCount: integrityRecords.length,
  rawAuthorityResponses: "integrity-audit/v1/raw-online-integrity-responses.json",
  rawAuthorityResponsesSha256: sha256(rawOnline),
  records: integrityRecords,
}
const integritySummary = {
  schemaVersion: "dna-source-integrity-summary@1",
  checkedAt,
  sourceCount: integrityRecords.length,
  stateCounts: integrityCounts,
  eligibleCount: integrityRecords.filter((record) => record.runtimeEligibility === "eligible").length,
  blockedCount: integrityRecords.filter((record) => record.runtimeEligibility !== "eligible").length,
  authorityUnavailableCount,
  updateSignalCount: integrityRecords.reduce((total, record) => total + record.updates.length, 0),
  retractionWatchMarkerCount: integrityFacts.reduce((total, fact) => total + fact.crossmark.retractionWatchMarkerCount, 0),
  retractionOrWithdrawalCount: integrityRecords.filter((record) => record.state === "withdrawn").length,
  expressionOfConcernCount: integrityRecords.filter((record) =>
    record.reasonCodes.includes("expression_of_concern_detected")).length,
  auditSha256: sha256(integrityAudit),
}

function mediaTypeFor(path, declared) {
  if (declared) return String(declared).toLowerCase()
  const extension = extname(path).toLowerCase()
  if (extension === ".pdf") return "application/pdf"
  if ([".xml", ".xhtml"].includes(extension)) return "application/xml"
  if (extension === ".html") return "text/html"
  if (extension === ".epub") return "application/epub+zip"
  return "application/octet-stream"
}

function licenseFor(record) {
  if (typeof record.license === "string") return record.license
  return String(record.license?.spdx || record.license?.name || "unknown")
}

function acquisitionMethodFor({ record, descriptor, sourceUrl, mediaType }) {
  const sourceType = String(descriptor.sourceType || "").toLowerCase()
  if (sourceType === "institutional_repository"
    || /ebi\.ac\.uk|ncbi\.nlm\.nih\.gov|ftp\.ncbi|discovery\.ucl\.ac\.uk|iris\.ru\.is|vtechworks\.lib\.vt\.edu|eprints\./i
      .test(sourceUrl)) {
    return "institutional_repository_download"
  }
  if (sourceType === "official_publisher" || record.officialAccess?.downloadUrl) {
    return "official_publisher_download"
  }
  if (/pressbooks|open\.umn\.edu|openoregon|ecampusontario/i.test(sourceUrl)
    || record.sourceRole === "foundational_book") {
    return "official_open_textbook_export"
  }
  if (/xml|metadata/i.test(mediaType) || /metadata/i.test(record.acquisitionNote || "")) {
    return "official_metadata_retrieval"
  }
  return "unknown_legacy_acquisition"
}

function sourceRootFor(sourcePath) {
  return basename(dirname(sourcePath)) === "audit" ? dirname(dirname(sourcePath)) : dirname(sourcePath)
}

const CURATED_DOWNLOAD_URLS = Object.freeze({
  "book.science-of-sleep|raw/science-of-sleep.print.pdf":
    "https://dspace.lib.hawaii.edu/server/api/core/bitstreams/2479df39-be30-4aee-a065-1a09587e57bd/content",
  "review.grossman-2023-polyvagal-premises|raw/grossman-2023.official-metadata.xml":
    "https://api.elsevier.com/content/article/pii/S0301051123001060",
  "review.porges-2021-polyvagal-theory|raw/porges-2021.jats.xml":
    "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9216697/fullTextXML",
})

function downloadUrlFor({ record, descriptor, sourceId, descriptorPath, sourceUrl }) {
  if (descriptor.downloadUrl) {
    return { url: String(descriptor.downloadUrl), evidence: "explicit_artifact" }
  }
  if (descriptor.sourceUrl) {
    return { url: String(descriptor.sourceUrl), evidence: "explicit_artifact" }
  }
  if (record.officialAccess?.downloadUrl) {
    return { url: String(record.officialAccess.downloadUrl), evidence: "official_access" }
  }
  const officialUrl = String(record.officialUrl || record.landingUrl || "").replace(/\/$/, "")
  let officialHost = ""
  try {
    officialHost = new URL(officialUrl).hostname
  } catch {
    officialHost = ""
  }
  if (/\.pressbooks\.pub$/i.test(officialHost)) {
    const type = /\.epub$/i.test(descriptorPath)
      ? "epub"
      : /\.pressbooks\.xml$/i.test(descriptorPath)
        ? "wxr"
        : /\.print\.pdf$/i.test(descriptorPath)
          ? "print_pdf"
          : /\.pdf$/i.test(descriptorPath) ? "pdf" : null
    if (type) {
      return { url: `${officialUrl}/open/download?type=${type}`, evidence: "deterministic_export_endpoint" }
    }
  }
  const curated = CURATED_DOWNLOAD_URLS[`${sourceId}|${descriptorPath}`]
  if (curated) return { url: curated, evidence: "curated_registry" }
  return { url: "", evidence: "curated_registry" }
}

function artifactDescriptorsForSource(sourcePath) {
  const record = readJson(sourcePath)
  const sourceId = String(record.id || record.slug || "")
  if (!sourceId) return []
  const descriptors = []
  if (record.artifact?.path) {
    descriptors.push({ ...record.artifact, relativePath: record.artifact.path, _base: sourceRootFor(sourcePath) })
  }
  if (record.structuredTextArtifact?.path) {
    descriptors.push({
      ...record.structuredTextArtifact,
      relativePath: record.structuredTextArtifact.path,
      _base: sourceRootFor(sourcePath),
    })
  }
  for (const artifact of record.artifacts || []) {
    descriptors.push({ ...artifact, _base: dirname(sourcePath) })
  }
  for (const file of record.files || []) {
    descriptors.push({ ...file, relativePath: file.path, _base: sourceRootFor(sourcePath) })
  }
  return descriptors.map((descriptor) => {
    const absolute = resolve(descriptor._base, descriptor.relativePath)
    const relativePath = relative(root, absolute).replaceAll("\\", "/")
    const sourceUrl = String(
      descriptor.sourceUrl || record.officialAccess?.downloadUrl || record.officialUrl
      || record.landingUrl || record.officialAccess?.landingUrl || "",
    )
    const mediaType = mediaTypeFor(relativePath, descriptor.mediaType || descriptor.format)
    const descriptorPath = String(descriptor.relativePath).replaceAll("\\", "/")
    const download = downloadUrlFor({ record, descriptor, sourceId, descriptorPath, sourceUrl })
    return {
      sourceId,
      relativePath,
      sourceUrl,
      downloadUrl: String(download.url || ""),
      downloadUrlEvidence: download.evidence,
      acquiredAt: String(record.officialAccess?.downloadedAt || record.retrievedAt || ""),
      mediaType,
      bytes: Number(descriptor.bytes || 0),
      sha256: String(descriptor.sha256 || "").toLowerCase(),
      license: licenseFor(record),
      acquisitionMethod: acquisitionMethodFor({ record, descriptor, sourceUrl, mediaType }),
    }
  })
}

const sourceJsonPaths = walk(root).filter((path) => basename(path) === "source.json"
  && !path.includes("/integrity-audit/") && !path.includes("/acquisition-audit/"))
const declaredEntries = sourceJsonPaths.flatMap(artifactDescriptorsForSource)
const declaredByPath = new Map(declaredEntries.map((entry) => [entry.relativePath, entry]))
const rawArtifactPaths = walk(root).filter((path) => path.includes("/raw/"))
for (const absolute of rawArtifactPaths) {
  const relativePath = relative(root, absolute).replaceAll("\\", "/")
  if (!declaredByPath.has(relativePath)) {
    declaredEntries.push({
      sourceId: `unmapped:${relativePath.split("/raw/")[0]}`,
      relativePath,
      sourceUrl: "",
      downloadUrl: "",
      downloadUrlEvidence: "curated_registry",
      acquiredAt: "",
      mediaType: mediaTypeFor(relativePath, null),
      bytes: 0,
      sha256: "",
      license: "unknown",
      acquisitionMethod: "unknown_legacy_acquisition",
    })
  }
}
declaredEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

function formatIntegrity(path, mediaType) {
  if (!existsSync(path)) return "failed"
  if (/pdf/i.test(mediaType)) {
    const buffer = readFileSync(path)
    const startsPdf = buffer.subarray(0, 5).toString("ascii") === "%PDF-"
    const tail = buffer.subarray(Math.max(0, buffer.length - 4096)).toString("latin1")
    return startsPdf && tail.includes("%%EOF") ? "passed" : "failed"
  }
  if (/xml/i.test(mediaType)) {
    const result = spawnSync("xmllint", ["--noout", path], { encoding: "utf8" })
    if (result.error?.code === "ENOENT") return "failed"
    return result.status === 0 ? "passed" : "failed"
  }
  if (/epub/i.test(mediaType)) {
    const result = spawnSync("unzip", ["-tqq", path], { encoding: "utf8" })
    return result.status === 0 ? "passed" : "failed"
  }
  return "not_applicable"
}

function observeArtifact(entry) {
  try {
    const absolute = resolveDnaAcquisitionArtifactWithinRoot(root, entry.relativePath)
    return {
      relativePath: entry.relativePath,
      exists: true,
      bytes: statSync(absolute).size,
      sha256: sha256File(absolute),
      formatIntegrity: formatIntegrity(absolute, entry.mediaType),
      rootContainment: "passed",
    }
  } catch (error) {
    const missing = String(error?.message || error) === "dna_acquisition_artifact_missing"
    return {
      relativePath: entry.relativePath,
      exists: false,
      bytes: null,
      sha256: null,
      formatIntegrity: "failed",
      rootContainment: missing && isSafeDnaAcquisitionRelativePath(entry.relativePath) ? "passed" : "failed",
    }
  }
}

const observations = declaredEntries.map(observeArtifact)
const ledgerVerification = verifyDnaSourceAcquisitionLedger({
  entries: declaredEntries,
  observedArtifacts: observations,
})
const acquisitionLedger = {
  schemaVersion: DNA_SOURCE_ACQUISITION_LEDGER_VERSION,
  generatedAt: checkedAt,
  rootPolicy: "ResearchSSD_relative_paths_only",
  entries: declaredEntries,
}
const acquisitionVerification = {
  schemaVersion: "dna-source-acquisition-verification@1",
  generatedAt: checkedAt,
  ledgerSha256: sha256(acquisitionLedger),
  rawArtifactCount: rawArtifactPaths.length,
  observedArtifacts: observations,
  ...ledgerVerification,
}
const currentAuditArchive = archiveAuditBundle({
  rawOnline,
  integrityAudit,
  integritySummary,
  acquisitionLedger,
  acquisitionVerification,
})
writeJson(integrityRawPath, rawOnline)
writeJson(integrityAuditPath, integrityAudit)
writeJson(integritySummaryPath, integritySummary)
writeJson(acquisitionLedgerPath, acquisitionLedger)
writeJson(acquisitionVerificationPath, acquisitionVerification)
const historyManifestRelativePath = relative(root, currentAuditArchive.manifestPath).replaceAll("\\", "/")
writeJson(auditHistoryCurrentPath, {
  schemaVersion: "dna-source-audit-history-current@1",
  updatedAt: checkedAt,
  runId: currentAuditArchive.runId,
  bundleSha256: currentAuditArchive.manifest.bundleSha256,
  manifestRelativePath: historyManifestRelativePath,
  manifestSha256: sha256File(currentAuditArchive.manifestPath),
})

const result = {
  ok: integrityRecords.length === 47
    && integrityRecords.every((record) => record.state !== undefined)
    && ledgerVerification.accepted,
  root: "ResearchSSD:/Datasets/SelfMetaAI/dna-knowledge/source-library",
  checkedAt,
  integrity: integritySummary,
  acquisition: {
    rawArtifactCount: rawArtifactPaths.length,
    ledgerEntryCount: declaredEntries.length,
    acceptedCount: ledgerVerification.acceptedCount,
    rejectedCount: ledgerVerification.rejectedCount,
    ledgerSha256: sha256(acquisitionLedger),
    verificationSha256: sha256(acquisitionVerification),
  },
  history: {
    currentRunId: currentAuditArchive.runId,
    previousRunId: priorArchivedAudit?.runId || null,
    manifest: historyManifestRelativePath,
  },
  refresh,
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (!result.ok) process.exitCode = 1
