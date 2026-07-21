#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"

import {
  buildDnaCorrectionResolutionAttestation,
  canonicalDoi,
  canonicalPmcid,
  sha256,
  validateDnaCorrectionResolutionAttestation,
} from "./dna-correction-resolution-lib.mjs"

const SOURCE_ID = "tripod-ai-2024"
const SOURCE_RECORD_RELATIVE_PATH = "evidence/cognition-development/tripod-ai-2024/source.json"
const CORRECTION_NOTICE_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11025451/fullTextXML"
const CURRENT_JATS_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11019967/fullTextXML"
const PUBLISHER_PDF_URL = "https://www.bmj.com/content/bmj/385/bmj-2023-078378.full.pdf"
const USER_AGENT = "DNA-Intelligence-Source-Audit/1.0 (mailto:research@selfmeta.ai)"

const researchSsdInput = process.env.RESEARCH_SSD_ROOT
if (!researchSsdInput) throw new Error("RESEARCH_SSD_ROOT is required")
const researchSsdCandidate = resolve(researchSsdInput)
if (!existsSync(researchSsdCandidate)) throw new Error("ResearchSSD root is not mounted")
const researchSsdRoot = realpathSync(researchSsdCandidate)
const sourceRootCandidate = resolve(
  process.env.DNA_SOURCE_LIBRARY_ROOT
    || join(researchSsdRoot, "Datasets", "SelfMetaAI", "dna-knowledge", "source-library"),
)
if (!existsSync(sourceRootCandidate)) throw new Error(`Source library unavailable: ${sourceRootCandidate}`)
const sourceRoot = realpathSync(sourceRootCandidate)
if (!(sourceRoot === researchSsdRoot || sourceRoot.startsWith(`${researchSsdRoot}${sep}`))) {
  throw new Error("Source library escapes ResearchSSD")
}
const refresh = process.argv.includes("--refresh")
const offlineVerify = process.argv.includes("--offline-verify")
if (refresh === offlineVerify) throw new Error("Choose exactly one mode: --refresh or --offline-verify")

const auditRoot = join(sourceRoot, "correction-audit", "v1")
const historyRoot = join(auditRoot, "history")
const currentPointerPath = join(auditRoot, "current.json")

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function assertContained(path) {
  const candidate = resolve(path)
  if (!(candidate === sourceRoot || candidate.startsWith(`${sourceRoot}${sep}`))) {
    throw new Error(`Correction audit path escapes source root: ${path}`)
  }
  return candidate
}

function resolveRelative(relativePath) {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("..")) {
    throw new Error(`Unsafe correction audit relative path: ${relativePath}`)
  }
  return assertContained(join(sourceRoot, relativePath))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function writeJson(path, value, options = undefined) {
  writeFileSync(path, jsonBytes(value), options || "utf8")
}

function xmlDecode(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&amp;|&#38;|&#x26;/gi, "&")
    .replace(/&lt;|&#60;|&#x3c;/gi, "<")
    .replace(/&gt;|&#62;|&#x3e;/gi, ">")
    .replace(/&#x2019;|&#8217;/gi, "'")
    .replace(/\s+/g, " ").trim()
}

function canonicalText(value) {
  return xmlDecode(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim().replace(/\s+/g, " ")
}

function tagValue(xml, tag, attributeName, attributeValue) {
  const attributePattern = attributeName
    ? `(?=[^>]*\\b${attributeName}=["']${attributeValue}["'])`
    : ""
  const match = String(xml).match(new RegExp(`<${tag}\\b${attributePattern}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return match ? xmlDecode(match[1]) : ""
}

function tagAttribute(xml, tag, attributeName, requiredAttributeName, requiredAttributeValue) {
  const required = requiredAttributeName
    ? `(?=[^>]*\\b${requiredAttributeName}=["']${requiredAttributeValue}["'])`
    : ""
  const match = String(xml).match(new RegExp(`<${tag}\\b${required}[^>]*\\b${attributeName}=["']([^"']+)["'][^>]*>`, "i"))
  return match?.[1] || ""
}

function noticeFacts(bytes) {
  const xml = bytes.toString("utf8")
  const bodyMatch = xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  const bodyText = xmlDecode(bodyMatch?.[1] || "")
  const normalizedBody = canonicalText(bodyText)
  const expectedScopeTail = "minor changes have been made to correct the authors affiliations the article and pdf have been updated"
  const relationTag = xml.match(/<related-article\b[^>]*>[\s\S]*?<\/related-article>/i)?.[0] || ""
  const targetPmcid = tagAttribute(relationTag, "ext-link", "xlink:href", "ext-link-type", "pmcid")
  const targetDoi = canonicalDoi(bodyText.match(/10\.1136\/bmj-2023-078378/i)?.[0] || "")
  const day = Number(tagValue(xml, "day"))
  const month = Number(tagValue(xml, "month"))
  const year = Number(tagValue(xml, "year"))
  const publicationDate = Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year)
    ? new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
    : ""
  return {
    articleType: tagAttribute(xml, "article", "article-type"),
    doi: tagValue(xml, "article-id", "pub-id-type", "doi"),
    pmcid: tagValue(xml, "article-id", "pub-id-type", "pmcid"),
    publicationDate,
    relationType: tagAttribute(xml, "related-article", "related-article-type"),
    targetDoi,
    targetPmcid,
    scope: normalizedBody.endsWith(expectedScopeTail) ? "author_affiliations_only" : "unresolved",
    minorChanges: normalizedBody.includes("minor changes have been made"),
    otherAffectedFieldsIndicated: !normalizedBody.endsWith(expectedScopeTail),
    articleUpdated: normalizedBody.includes("the article and pdf have been updated"),
    pdfUpdated: normalizedBody.includes("the article and pdf have been updated"),
    normalizedStatementSha256: sha256(normalizedBody),
  }
}

function mainJatsFacts(bytes) {
  const xml = bytes.toString("utf8")
  return {
    doi: tagValue(xml, "article-id", "pub-id-type", "doi"),
    pmcid: tagValue(xml, "article-id", "pub-id-type", "pmcid"),
  }
}

function pdfModifiedAt(path) {
  const result = spawnSync("pdfinfo", [path], { encoding: "utf8", timeout: 30_000 })
  if (result.error || result.status !== 0) {
    throw new Error(`pdfinfo_failed:${result.error?.message || result.stderr || result.status}`)
  }
  const value = result.stdout.match(/^ModDate:\s+(.+)$/m)?.[1]?.trim() || ""
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) throw new Error("pdf_mod_date_unparseable")
  return new Date(parsed).toISOString()
}

async function fetchBytes(url, expectedHosts, allowFailure = false) {
  const parsed = new URL(url)
  if (parsed.protocol !== "https:" || !expectedHosts.includes(parsed.hostname)) {
    throw new Error(`Correction authority URL not allowlisted: ${url}`)
  }
  const response = await fetch(parsed, {
    redirect: "follow",
    headers: { accept: "*/*", "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(60_000),
  })
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!response.ok && !allowFailure) throw new Error(`Authority HTTP ${response.status}: ${url}`)
  return {
    bytes,
    status: response.status,
    contentType: response.headers.get("content-type"),
    finalUrl: response.url,
  }
}

function verifyArchive(pointer) {
  if (pointer.schemaVersion !== "dna-correction-resolution-current@1") {
    throw new Error("correction_current_pointer_schema_invalid")
  }
  const manifestPath = resolveRelative(pointer.manifestRelativePath)
  const manifest = readJson(manifestPath)
  if (sha256(manifest) !== pointer.manifestSha256) throw new Error("correction_manifest_hash_mismatch")
  if (manifest.schemaVersion !== "dna-correction-resolution-archive-manifest@1") {
    throw new Error("correction_archive_manifest_schema_invalid")
  }
  for (const file of manifest.files) {
    const path = resolveRelative(file.relativePath)
    if (!existsSync(path)) throw new Error(`correction_archive_file_missing:${file.relativePath}`)
    const bytes = readFileSync(path)
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
      throw new Error(`correction_archive_file_mismatch:${file.relativePath}`)
    }
  }
  const attestationPath = resolveRelative(manifest.attestationRelativePath)
  const attestation = readJson(attestationPath)
  const validation = validateDnaCorrectionResolutionAttestation(attestation)
  if (!validation.ok) throw new Error(`correction_attestation_invalid:${validation.errors.join(",")}`)
  if (attestation.attestationSha256 !== manifest.attestationSha256) {
    throw new Error("correction_attestation_manifest_binding_mismatch")
  }
  const noticePath = resolveRelative(attestation.correctionNotice.archivedRelativePath)
  if (sha256(readFileSync(noticePath)) !== attestation.correctionNotice.sha256) {
    throw new Error("correction_notice_attestation_binding_mismatch")
  }
  const sourceRecordPath = resolveRelative(attestation.source.sourceRecordPath)
  if (sha256(readFileSync(sourceRecordPath)) !== attestation.source.manifestSha256) {
    throw new Error("correction_source_manifest_drift")
  }
  for (const artifact of [attestation.artifacts.jats, attestation.artifacts.pdf]) {
    const localPath = resolveRelative(artifact.localRelativePath)
    if (sha256(readFileSync(localPath)) !== artifact.localSha256) {
      throw new Error(`correction_local_artifact_drift:${artifact.localRelativePath}`)
    }
  }
  return { pointer, manifest, attestation }
}

if (offlineVerify) {
  if (!existsSync(currentPointerPath)) throw new Error("correction_current_pointer_missing")
  const verified = verifyArchive(readJson(currentPointerPath))
  console.log(JSON.stringify({
    ok: true,
    mode: "offline-verify",
    runId: verified.pointer.runId,
    status: verified.attestation.decision.status,
    attestationSha256: verified.attestation.attestationSha256,
  }, null, 2))
  process.exit(0)
}

const checkedAt = new Date().toISOString()
const sourceRecordPath = resolveRelative(SOURCE_RECORD_RELATIVE_PATH)
const sourceRecordBytes = readFileSync(sourceRecordPath)
const sourceRecord = JSON.parse(sourceRecordBytes.toString("utf8"))
if (sourceRecord.id !== SOURCE_ID) throw new Error("tripod_source_record_id_mismatch")
const localJatsPath = resolveRelative(join(dirname(SOURCE_RECORD_RELATIVE_PATH), sourceRecord.structuredTextArtifact.path))
const localPdfPath = resolveRelative(join(dirname(SOURCE_RECORD_RELATIVE_PATH), sourceRecord.artifact.path))
const localJatsBytes = readFileSync(localJatsPath)
const localPdfBytes = readFileSync(localPdfPath)
const [noticeResponse, jatsResponse, pdfResponse, publisherPdfResponse] = await Promise.all([
  fetchBytes(CORRECTION_NOTICE_URL, ["www.ebi.ac.uk"]),
  fetchBytes(CURRENT_JATS_URL, ["www.ebi.ac.uk"]),
  fetchBytes(sourceRecord.officialAccess.downloadUrl, ["discovery.ucl.ac.uk"]),
  fetchBytes(PUBLISHER_PDF_URL, ["www.bmj.com"], true),
])
const notice = noticeFacts(noticeResponse.bytes)
const localJats = mainJatsFacts(localJatsBytes)
const remoteJats = mainJatsFacts(jatsResponse.bytes)
if (canonicalDoi(localJats.doi) !== canonicalDoi(remoteJats.doi)
  || canonicalPmcid(localJats.pmcid) !== canonicalPmcid(remoteJats.pmcid)) {
  throw new Error("current_jats_authority_identity_mismatch")
}

mkdirSync(historyRoot, { recursive: true })
const timestamp = checkedAt.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
const runId = `${timestamp}--${sha256(noticeResponse.bytes).slice(0, 16)}`
const runRoot = join(historyRoot, runId)
if (existsSync(runRoot)) throw new Error(`correction_audit_run_already_exists:${runId}`)
mkdirSync(runRoot, { recursive: false })
const runRootReal = realpathSync(runRoot)
if (!(runRootReal === sourceRoot || runRootReal.startsWith(`${sourceRoot}${sep}`))) {
  throw new Error("correction_history_root_escape")
}
const noticeArchivePath = join(runRoot, "bmj-q902-notice.jats.xml")
const noticeArchiveRelativePath = relative(sourceRoot, noticeArchivePath).replaceAll("\\", "/")
const attestationPath = join(runRoot, "tripod-ai-2024-correction-resolution-attestation.json")
const attestationRelativePath = relative(sourceRoot, attestationPath).replaceAll("\\", "/")
const manifestPath = join(runRoot, "manifest.json")
const manifestRelativePath = relative(sourceRoot, manifestPath).replaceAll("\\", "/")

const manifestArtifactHashesMatch = sha256(localJatsBytes) === sourceRecord.structuredTextArtifact.sha256
  && sha256(localPdfBytes) === sourceRecord.artifact.sha256
  && localJatsBytes.length === sourceRecord.structuredTextArtifact.bytes
  && localPdfBytes.length === sourceRecord.artifact.bytes
const attestation = buildDnaCorrectionResolutionAttestation({
  attestationId: "correction.tripod-ai-2024.bmj-q902",
  checkedAt,
  source: {
    sourceId: SOURCE_ID,
    doi: sourceRecord.bibliography.doi,
    pmcid: sourceRecord.bibliography.pmcid,
    sourceRecordPath: SOURCE_RECORD_RELATIVE_PATH,
    downloadedAt: sourceRecord.officialAccess.downloadedAt,
    manifestSha256: sha256(sourceRecordBytes),
    manifestArtifactHashesMatch,
  },
  correctionNotice: {
    ...notice,
    sourceUrl: CORRECTION_NOTICE_URL,
    archivedRelativePath: noticeArchiveRelativePath,
    bytes: noticeResponse.bytes.length,
    sha256: sha256(noticeResponse.bytes),
  },
  artifacts: {
    jats: {
      localRelativePath: relative(sourceRoot, localJatsPath).replaceAll("\\", "/"),
      remoteUrl: CURRENT_JATS_URL,
      retrievedAt: checkedAt,
      doi: remoteJats.doi,
      pmcid: remoteJats.pmcid,
      localBytes: localJatsBytes.length,
      remoteBytes: jatsResponse.bytes.length,
      localSha256: sha256(localJatsBytes),
      remoteSha256: sha256(jatsResponse.bytes),
      manifestSha256: sourceRecord.structuredTextArtifact.sha256,
      authority: "Europe PMC current fullTextXML",
    },
    pdf: {
      localRelativePath: relative(sourceRoot, localPdfPath).replaceAll("\\", "/"),
      remoteUrl: sourceRecord.officialAccess.downloadUrl,
      retrievedAt: checkedAt,
      documentModifiedAt: pdfModifiedAt(localPdfPath),
      localBytes: localPdfBytes.length,
      remoteBytes: pdfResponse.bytes.length,
      localSha256: sha256(localPdfBytes),
      remoteSha256: sha256(pdfResponse.bytes),
      manifestSha256: sourceRecord.artifact.sha256,
      authority: "UCL Discovery official institutional repository; publisher-version copy",
      publisherEndpoint: {
        url: PUBLISHER_PDF_URL,
        status: publisherPdfResponse.status,
        contentType: publisherPdfResponse.contentType,
        usableAsEvidence: publisherPdfResponse.status === 200
          && /application\/pdf/i.test(publisherPdfResponse.contentType || ""),
      },
    },
  },
})
const validation = validateDnaCorrectionResolutionAttestation(attestation)
if (!validation.ok) throw new Error(`generated_correction_attestation_invalid:${validation.errors.join(",")}`)

writeFileSync(noticeArchivePath, noticeResponse.bytes, { flag: "wx" })
writeJson(attestationPath, attestation, { encoding: "utf8", flag: "wx" })
const files = [noticeArchivePath, attestationPath].map((path) => {
  const bytes = readFileSync(path)
  return {
    relativePath: relative(sourceRoot, path).replaceAll("\\", "/"),
    bytes: bytes.length,
    sha256: sha256(bytes),
  }
})
const manifest = {
  schemaVersion: "dna-correction-resolution-archive-manifest@1",
  runId,
  createdAt: checkedAt,
  sourceId: SOURCE_ID,
  status: attestation.decision.status,
  attestationRelativePath,
  attestationSha256: attestation.attestationSha256,
  files,
}
writeJson(manifestPath, manifest, { encoding: "utf8", flag: "wx" })
const pointer = {
  schemaVersion: "dna-correction-resolution-current@1",
  runId,
  checkedAt,
  manifestRelativePath,
  manifestSha256: sha256(manifest),
  attestationSha256: attestation.attestationSha256,
}
mkdirSync(auditRoot, { recursive: true })
writeJson(currentPointerPath, pointer)
const verified = verifyArchive(pointer)
console.log(JSON.stringify({
  ok: true,
  mode: "refresh",
  runId,
  status: verified.attestation.decision.status,
  sourceIntegrityResolution: verified.attestation.decision.sourceIntegrityResolution,
  attestationSha256: verified.attestation.attestationSha256,
  manifestSha256: pointer.manifestSha256,
  publisherPdfStatus: publisherPdfResponse.status,
  evidence: {
    correctionNoticeSha256: attestation.correctionNotice.sha256,
    currentJatsSha256: attestation.artifacts.jats.localSha256,
    currentPdfSha256: attestation.artifacts.pdf.localSha256,
  },
}, null, 2))
