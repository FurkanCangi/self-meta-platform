#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

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
const rebuildFromRaw = process.argv.includes("--rebuild-from-raw")
const jatsLicenseReportOnly = process.argv.includes("--verify-jats-licenses-read-only")
const checkedAt = new Date().toISOString().slice(0, 10)
const AUDITOR_IMPLEMENTATION_VERSION = "dna-source-governance-auditor@2"
const JATS_LICENSE_INSPECTION_VERSION = "dna-jats-license-inspector@2"
const officialAuthorityRegistryPath = resolve(
  dirname(resolve(process.argv[1])),
  "..",
  "docs/dna-intelligence/governance/v3/official-source-authority-registry.json",
)

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

const OFFICIAL_AUTHORITY_HOSTS = new Set([
  "ecampusontario.pressbooks.pub",
  "open.umn.edu",
  "openlibrary-repo.ecampusontario.ca",
  "uw.pressbooks.pub",
  "www.apa.org",
  "www.autismcrc.com.au",
  "www.palomar.edu",
])

const BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
  + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

function assertOfficialAuthorityUrl(value) {
  const url = new URL(String(value))
  if (url.protocol !== "https:" || !OFFICIAL_AUTHORITY_HOSTS.has(url.hostname)) {
    throw new Error(`official_authority_url_not_allowlisted:${value}`)
  }
  return url.toString()
}

const officialAuthorityRegistry = readJson(officialAuthorityRegistryPath)
if (officialAuthorityRegistry.schemaVersion !== "dna-official-source-authority-registry@1") {
  throw new Error("official_authority_registry_schema_invalid")
}
const officialAuthorityRules = new Map()
for (const record of officialAuthorityRegistry.records || []) {
  if (!record?.sourceId || officialAuthorityRules.has(record.sourceId)) {
    throw new Error("official_authority_registry_source_id_invalid_or_duplicate")
  }
  if (record.url) assertOfficialAuthorityUrl(record.url)
  if (record.landingUrl) assertOfficialAuthorityUrl(record.landingUrl)
  if (record.documentUrl) assertOfficialAuthorityUrl(record.documentUrl)
  officialAuthorityRules.set(record.sourceId, Object.freeze({ ...record }))
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
  if (intersection / Math.max(1, union) >= 0.92) return true
  const shorter = Math.min(aa.size, bb.size)
  const longer = Math.max(aa.size, bb.size)
  return intersection === shorter && shorter / Math.max(1, longer) >= 0.75
}

function authorFamily(value) {
  return canonicalText(value).split(" ").filter(Boolean).at(-1) || ""
}

function authorsMatch(expected, observed) {
  if (!expected.length) return true
  if (!observed.length) return false
  const left = new Set(expected.map(authorFamily).filter(Boolean))
  const right = new Set(observed.map(authorFamily).filter(Boolean))
  const matched = [...left].filter((value) => right.has(value)).length
  return matched / Math.max(1, left.size) >= 0.8
}

function authorsMatchExactly(expected, observed) {
  const left = expected.map(authorFamily).filter(Boolean).sort()
  const right = observed.map(authorFamily).filter(Boolean).sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function exactCanonicalTextMatch(left, right) {
  return Boolean(canonicalText(left)) && canonicalText(left) === canonicalText(right)
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

const PASSAGE_OPEN_LICENSE_POLICIES = new Set(["cc0", "cc_by", "cc_by_sa"])

function decodeAuthorityXmlText(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

function stripXml(value) {
  return decodeXmlText(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim()
}

function creativeCommonsPolicyFromUrl(value) {
  try {
    const url = new URL(decodeXmlText(value).trim())
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    if (hostname !== "creativecommons.org") return null
    const pathname = url.pathname.toLowerCase().replace(/\/+$/, "/")
    if (/^\/publicdomain\/zero\/(?:1\.0\/)?$/.test(pathname)) {
      return { policy: "cc0", url: "https://creativecommons.org/publicdomain/zero/1.0/" }
    }
    const match = pathname.match(/^\/licenses\/([^/]+)\/(?:[0-9.]+\/)?$/)
    if (!match) return null
    const code = match[1]
    if (code.includes("nc")) return { policy: "blocked_nc", url: `https://creativecommons.org${pathname}` }
    if (code.includes("nd")) return { policy: "blocked_nd", url: `https://creativecommons.org${pathname}` }
    if (code === "by-sa") return { policy: "cc_by_sa", url: `https://creativecommons.org${pathname}` }
    if (code === "by") return { policy: "cc_by", url: `https://creativecommons.org${pathname}` }
    return null
  } catch {
    return null
  }
}

function licensePoliciesFromLabel(value) {
  const normalized = stripXml(value).normalize("NFKC").toUpperCase()
  const policies = new Set()
  if (/\b(?:NOT|IS NOT|ISN'T)\s+(?:LICENSED|DISTRIBUTED|AVAILABLE|COVERED)[^.]{0,160}\b(?:CC|CREATIVE COMMONS)\b/.test(normalized)
    || /\bNO\s+(?:CC|CREATIVE COMMONS)\b[^.]{0,80}\bLICEN[CS]E\b/.test(normalized)) {
    policies.add("blocked_explicit_negation")
  }
  if (/\b(?:CC[- ]?BY[- ]?NC|NON[- ]?COMMERCIAL|NO COMMERCIAL RE[- ]?USE)\b/.test(normalized)) {
    policies.add("blocked_nc")
  }
  if (/\b(?:CC[- ]?BY(?:[- ]?NC)?[- ]?ND|NO DERIVATIVES?)\b/.test(normalized)) {
    policies.add("blocked_nd")
  }
  if (/\b(?:CC0|CC ZERO|CREATIVE COMMONS ZERO)\b/.test(normalized)) policies.add("cc0")
  if (/\bCC[- ]?BY[- ]?SA\b|CREATIVE COMMONS ATTRIBUTION(?:[- ]| )SHAREALIKE\b/.test(normalized)) {
    policies.add("cc_by_sa")
  } else if (/\bCC[- ]?BY\b|CREATIVE COMMONS ATTRIBUTION(?:\s+[0-9.]+)?(?:\s+INTERNATIONAL)?\s+LICEN[CS]E\b/.test(normalized)) {
    policies.add("cc_by")
  }
  return policies
}

function maskXmlNonMarkup(value) {
  return String(value)
    .replace(/<!--[\s\S]*?-->/g, (match) => " ".repeat(match.length))
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (match) => " ".repeat(match.length))
    .replace(/<\?[\s\S]*?\?>/g, (match) => " ".repeat(match.length))
}

function xmlMarkupEnd(value, start, declaration = false) {
  let quote = null
  let bracketDepth = 0
  for (let index = start + 1; index < value.length; index += 1) {
    const character = value[index]
    if (quote) {
      if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (declaration && character === "[") bracketDepth += 1
    if (declaration && character === "]" && bracketDepth > 0) bracketDepth -= 1
    if (character === ">" && bracketDepth === 0) return index
  }
  return -1
}

function parseXmlElementRanges(value) {
  const xml = maskXmlNonMarkup(value)
  const elements = []
  const stack = []
  let cursor = 0
  while (cursor < xml.length) {
    const start = xml.indexOf("<", cursor)
    if (start < 0) break
    if (xml.startsWith("<!", start)) {
      const end = xmlMarkupEnd(xml, start, true)
      if (end < 0) return null
      cursor = end + 1
      continue
    }
    const end = xmlMarkupEnd(xml, start)
    if (end < 0) return null
    const markup = xml.slice(start, end + 1)
    const closing = markup.match(/^<\s*\/\s*([A-Za-z_][\w.:-]*)\s*>$/)
    if (closing) {
      const openIndex = stack.pop()
      if (openIndex === undefined || elements[openIndex].qualifiedName !== closing[1]) {
        return null
      }
      elements[openIndex].end = end + 1
      cursor = end + 1
      continue
    }
    const opening = markup.match(/^<\s*([A-Za-z_][\w.:-]*)\b/)
    if (!opening) {
      cursor = end + 1
      continue
    }
    const qualifiedName = opening[1]
    const element = {
      qualifiedName,
      localName: qualifiedName.split(":").at(-1).toLowerCase(),
      start,
      openEnd: end + 1,
      end: /\/\s*>$/.test(markup) ? end + 1 : null,
      parentIndex: stack.length > 0 ? stack.at(-1) : null,
    }
    const elementIndex = elements.push(element) - 1
    if (element.end === null) stack.push(elementIndex)
    cursor = end + 1
  }
  if (stack.length > 0) return null
  return { xml, elements }
}

function inspectJatsNarrativePassageLicense(xml, declaredPolicy, declaredLicenseUrl) {
  if (!PASSAGE_OPEN_LICENSE_POLICIES.has(declaredPolicy)) {
    return { verified: false, reason: "manifest_license_not_open_for_passage", licenseUrl: null }
  }
  const parsed = parseXmlElementRanges(xml)
  if (!parsed) {
    return { verified: false, reason: "jats_xml_structure_invalid", licenseUrl: null }
  }
  const bodyStart = parsed.elements.find((element) => element.localName === "body")?.start
    ?? Number.POSITIVE_INFINITY
  const articleMetaIndexes = parsed.elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.localName === "article-meta"
      && element.start < bodyStart
      && element.parentIndex !== null
      && parsed.elements[element.parentIndex]?.localName === "front")
    .map(({ index }) => index)
  if (articleMetaIndexes.length !== 1) {
    return {
      verified: false,
      reason: articleMetaIndexes.length === 0
        ? "jats_article_meta_missing"
        : "jats_article_meta_ambiguous",
      licenseUrl: null,
    }
  }
  const [articleMetaIndex] = articleMetaIndexes
  const permissionsIndexes = parsed.elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.localName === "permissions"
      && element.parentIndex === articleMetaIndex)
    .map(({ index }) => index)
  if (permissionsIndexes.length === 0) {
    return { verified: false, reason: "jats_permissions_missing", licenseUrl: null }
  }
  const permissions = permissionsIndexes.map((index) => {
    const element = parsed.elements[index]
    return parsed.xml.slice(element.start, element.end)
  }).join("\n")
  const licenseIndexes = parsed.elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.localName === "license"
      && permissionsIndexes.includes(element.parentIndex))
    .map(({ index }) => index)
  if (licenseIndexes.length === 0) {
    return { verified: false, reason: "jats_license_element_missing", licenseUrl: null }
  }
  const licenseText = licenseIndexes.map((index) => {
    const element = parsed.elements[index]
    return parsed.xml.slice(element.start, element.end)
  }).join("\n")
  const allUrls = [...licenseText.matchAll(/(?:xlink:href|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => creativeCommonsPolicyFromUrl(match[1])).filter(Boolean)
  const textualUrls = [...decodeXmlText(licenseText).matchAll(/https?:\/\/creativecommons\.org\/(?:licenses|publicdomain)\/[^\s<)"']+/gi)]
    .map((match) => creativeCommonsPolicyFromUrl(match[0])).filter(Boolean)
  const licenseRefs = [...licenseText.matchAll(/<ali:license_ref\b[^>]*>([\s\S]*?)<\/ali:license_ref>/gi)]
    .map((match) => creativeCommonsPolicyFromUrl(stripXml(match[1]))).filter(Boolean)
  const allPolicies = new Set([
    ...allUrls.map((entry) => entry.policy),
    ...textualUrls.map((entry) => entry.policy),
    ...licensePoliciesFromLabel(permissions),
  ])
  if (allPolicies.has("blocked_explicit_negation")) {
    return { verified: false, reason: "jats_permissions_explicit_negation", licenseUrl: null }
  }
  if (allPolicies.has("blocked_nc")) {
    return { verified: false, reason: "jats_permissions_block_noncommercial", licenseUrl: null }
  }
  if (allPolicies.has("blocked_nd")) {
    return { verified: false, reason: "jats_permissions_block_no_derivatives", licenseUrl: null }
  }

  const labelPolicies = licensePoliciesFromLabel(licenseText)
  const primaryUrlEntries = licenseRefs.length > 0
    ? licenseRefs
    : [...allUrls, ...textualUrls]
  const primaryPolicies = new Set(primaryUrlEntries.map((entry) => entry.policy))
  if (primaryPolicies.size !== 1) {
    return {
      verified: false,
      reason: primaryPolicies.size === 0 ? "jats_license_url_missing" : "jats_license_ambiguous",
      licenseUrl: null,
    }
  }
  const [jatsPolicy] = primaryPolicies
  if (jatsPolicy !== declaredPolicy) {
    return { verified: false, reason: "manifest_jats_license_mismatch", licenseUrl: null }
  }
  if (labelPolicies.size > 0 && !labelPolicies.has(declaredPolicy)) {
    return { verified: false, reason: "manifest_jats_license_label_mismatch", licenseUrl: null }
  }
  const declaredUrl = creativeCommonsPolicyFromUrl(declaredLicenseUrl)
  if (!declaredUrl || declaredUrl.policy !== declaredPolicy) {
    return { verified: false, reason: "manifest_license_url_unverified", licenseUrl: null }
  }
  const primaryCanonicalUrls = new Set(primaryUrlEntries.map((entry) => entry.url))
  if (primaryCanonicalUrls.size !== 1) {
    return { verified: false, reason: "jats_license_url_ambiguous", licenseUrl: null }
  }
  const [matchedUrl] = primaryCanonicalUrls
  if (matchedUrl !== declaredUrl.url) {
    return { verified: false, reason: "manifest_jats_license_url_mismatch", licenseUrl: null }
  }
  return {
    verified: true,
    reason: "jats_narrative_passage_license_matched",
    licenseUrl: matchedUrl,
  }
}

function declaredJatsArtifacts(record, recordPath) {
  const sourceRoot = sourceRootFor(recordPath)
  const entries = []
  const structured = record.structuredTextArtifact
  if (structured && /jats/i.test(`${structured.format || ""} ${structured.mediaType || ""} ${structured.path || ""}`)) {
    entries.push({
      path: structured.path,
      base: dirname(recordPath),
      sha256: structured.sha256,
      bytes: structured.bytes,
    })
  }
  for (const artifact of Array.isArray(record.artifacts) ? record.artifacts : []) {
    if (!/jats/i.test(`${artifact.format || ""} ${artifact.mediaType || ""} ${artifact.relativePath || artifact.path || ""}`)) continue
    entries.push({
      path: artifact.relativePath || artifact.path,
      base: dirname(recordPath),
      sha256: artifact.sha256,
      bytes: artifact.bytes,
    })
  }
  for (const file of Array.isArray(record.files) ? record.files : []) {
    if (!/\.jats\.xml$/i.test(String(file.path || ""))) continue
    entries.push({ path: file.path, base: sourceRoot, sha256: file.sha256, bytes: file.bytes })
  }
  return entries
}

function verifyJatsNarrativePassageLicense({
  libraryRoot,
  record,
  recordPath,
  declaredPolicy,
  declaredLicenseUrl,
}) {
  const sourceRoot = sourceRootFor(recordPath)
  const realSourceRoot = realpathSync(sourceRoot)
  const candidates = declaredJatsArtifacts(record, recordPath)
  if (candidates.length === 0) {
    return {
      verified: false,
      reason: "jats_artifact_not_declared",
      artifactRelativePath: null,
      artifactSha256: null,
      licenseUrl: null,
    }
  }
  const verified = []
  const failures = []
  const seen = new Set()
  for (const candidate of candidates) {
    const absolutePath = resolve(candidate.base, String(candidate.path || ""))
    const sourceRelative = relative(sourceRoot, absolutePath)
    if (!sourceRelative || sourceRelative.startsWith("../") || sourceRelative === ".." || sourceRelative.includes("\\")) {
      failures.push("jats_artifact_path_outside_source")
      continue
    }
    if (seen.has(absolutePath)) continue
    seen.add(absolutePath)
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      failures.push("jats_artifact_missing")
      continue
    }
    if (lstatSync(absolutePath).isSymbolicLink()) {
      failures.push("jats_artifact_symlink_forbidden")
      continue
    }
    const realArtifactPath = realpathSync(absolutePath)
    const realSourceRelative = relative(realSourceRoot, realArtifactPath)
    if (!realSourceRelative || realSourceRelative.startsWith("../")
      || realSourceRelative === ".." || realSourceRelative.includes("\\")) {
      failures.push("jats_artifact_realpath_outside_source")
      continue
    }
    if (!/^[a-f0-9]{64}$/i.test(String(candidate.sha256 || ""))) {
      failures.push("jats_artifact_manifest_hash_missing")
      continue
    }
    const bytes = readFileSync(absolutePath)
    const actualSha256 = sha256(bytes)
    if (actualSha256 !== String(candidate.sha256).toLowerCase()) {
      failures.push("jats_artifact_manifest_hash_mismatch")
      continue
    }
    if (Number.isFinite(Number(candidate.bytes)) && Number(candidate.bytes) !== bytes.byteLength) {
      failures.push("jats_artifact_manifest_bytes_mismatch")
      continue
    }
    const inspection = inspectJatsNarrativePassageLicense(
      bytes.toString("utf8"),
      declaredPolicy,
      declaredLicenseUrl,
    )
    if (!inspection.verified) {
      failures.push(inspection.reason)
      continue
    }
    verified.push({
      artifactRelativePath: relative(libraryRoot, absolutePath),
      artifactSha256: actualSha256,
      licenseUrl: inspection.licenseUrl,
    })
  }
  if (failures.length > 0 || verified.length !== 1) {
    return {
      verified: false,
      reason: failures.sort()[0] || "jats_artifact_ambiguous",
      artifactRelativePath: null,
      artifactSha256: null,
      licenseUrl: null,
    }
  }
  return {
    verified: true,
    reason: "jats_narrative_passage_license_matched",
    ...verified[0],
  }
}

function runJatsLicenseSyntheticTests() {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "dna-jats-license-"))
  let caseCount = 0
  let negativeCaseCount = 0
  const runCase = ({
    name,
    declaredLicense = "CC-BY-4.0",
    declaredLicenseUrl = "https://creativecommons.org/licenses/by/4.0/",
    xml,
    expectedVerified,
    expectedReason = null,
    omitHash = false,
    wrongHash = false,
    wrongBytes = false,
    symlinkMode = null,
    artifactRelativePath = "raw/article.jats.xml",
  }) => {
    caseCount += 1
    if (!expectedVerified) negativeCaseCount += 1
    const caseRoot = join(temporaryRoot, name)
    const rawRoot = join(caseRoot, "raw")
    mkdirSync(rawRoot, { recursive: true })
    const artifactPath = resolve(caseRoot, artifactRelativePath)
    mkdirSync(dirname(artifactPath), { recursive: true })
    if (symlinkMode === "direct_inside") {
      const targetPath = join(rawRoot, "target.jats.xml")
      writeFileSync(targetPath, xml, "utf8")
      symlinkSync(targetPath, artifactPath)
    } else if (symlinkMode === "parent_outside") {
      const externalRoot = join(temporaryRoot, `${name}-external`)
      mkdirSync(externalRoot, { recursive: true })
      writeFileSync(join(externalRoot, "article.jats.xml"), xml, "utf8")
      const linkedRoot = dirname(artifactPath)
      rmSync(linkedRoot, { recursive: true, force: true })
      symlinkSync(externalRoot, linkedRoot, "dir")
    } else {
      writeFileSync(artifactPath, xml, "utf8")
    }
    const bytes = readFileSync(artifactPath)
    const recordPath = join(caseRoot, "source.json")
    const record = {
      id: name,
      license: { spdx: declaredLicense, url: declaredLicenseUrl },
      structuredTextArtifact: {
        format: "JATS XML",
        path: artifactRelativePath,
        bytes: wrongBytes ? bytes.byteLength + 1 : bytes.byteLength,
        sha256: omitHash ? null : wrongHash ? "0".repeat(64) : sha256(bytes),
      },
    }
    writeFileSync(recordPath, `${JSON.stringify(record)}\n`, "utf8")
    const result = verifyJatsNarrativePassageLicense({
      libraryRoot: temporaryRoot,
      record,
      recordPath,
      declaredPolicy: classifyLicense(declaredLicense),
      declaredLicenseUrl,
    })
    if (result.verified !== expectedVerified) {
      throw new Error(`${name}: expected verified=${expectedVerified}; got ${JSON.stringify(result)}`)
    }
    if (expectedReason && result.reason !== expectedReason) {
      throw new Error(`${name}: expected ${expectedReason}; got ${result.reason}`)
    }
  }
  const article = (permissions, body = `<sec><p>Narrative passage.</p></sec>`) => `<article><front><article-meta>${permissions}</article-meta></front><body>${body}</body></article>`
  const byPermissions = `<permissions><license><ali:license_ref>https://creativecommons.org/licenses/by/4.0/</ali:license_ref><license-p>Creative Commons Attribution 4.0 International License (CC BY). Images and other third-party material may require separate permission.</license-p></license></permissions>`
  try {
    runCase({ name: "cc-by-positive", xml: article(byPermissions), expectedVerified: true })
    runCase({
      name: "cc-by-label-only-blocked",
      xml: article(`<permissions><license><license-p>Creative Commons Attribution 4.0 International License (CC BY).</license-p></license></permissions>`),
      expectedVerified: false,
      expectedReason: "jats_license_url_missing",
    })
    runCase({
      name: "commented-permissions-cannot-authorize-article",
      xml: article(`<!-- ${byPermissions} -->`),
      expectedVerified: false,
      expectedReason: "jats_permissions_missing",
    })
    runCase({
      name: "cdata-permissions-cannot-authorize-article",
      xml: article(`<![CDATA[${byPermissions}]]>`),
      expectedVerified: false,
      expectedReason: "jats_permissions_missing",
    })
    runCase({
      name: "nested-custom-meta-permissions-cannot-authorize-article",
      xml: article(`<custom-meta-group>${byPermissions}</custom-meta-group>`),
      expectedVerified: false,
      expectedReason: "jats_permissions_missing",
    })
    runCase({
      name: "creative-commons-version-mismatch",
      xml: article(`<permissions><license><ali:license_ref>https://creativecommons.org/licenses/by/3.0/</ali:license_ref><license-p>Creative Commons Attribution 3.0 License (CC BY).</license-p></license></permissions>`),
      expectedVerified: false,
      expectedReason: "manifest_jats_license_url_mismatch",
    })
    runCase({
      name: "cc-by-sa-positive",
      declaredLicense: "CC-BY-SA-4.0",
      declaredLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      xml: article(`<permissions><license><ali:license_ref>https://creativecommons.org/licenses/by-sa/4.0/</ali:license_ref><license-p>Creative Commons Attribution-ShareAlike License (CC BY-SA).</license-p></license></permissions>`),
      expectedVerified: true,
    })
    runCase({
      name: "cc0-positive",
      declaredLicense: "CC0-1.0",
      declaredLicenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      xml: article(`<permissions><license><ali:license_ref>https://creativecommons.org/publicdomain/zero/1.0/</ali:license_ref><license-p>Creative Commons Zero (CC0).</license-p></license></permissions>`),
      expectedVerified: true,
    })
    runCase({ name: "missing-permissions", xml: article(""), expectedVerified: false, expectedReason: "jats_permissions_missing" })
    runCase({
      name: "body-permissions-cannot-authorize-article",
      xml: article("", `<fig><permissions><license><ali:license_ref>https://creativecommons.org/licenses/by/4.0/</ali:license_ref><license-p>CC BY 4.0</license-p></license></permissions></fig>`),
      expectedVerified: false,
      expectedReason: "jats_permissions_missing",
    })
    runCase({ name: "manifest-nc", declaredLicense: "CC-BY-NC-4.0", xml: article(byPermissions), expectedVerified: false, expectedReason: "manifest_license_not_open_for_passage" })
    runCase({
      name: "jats-nc",
      xml: article(`<permissions><license><ali:license_ref>https://creativecommons.org/licenses/by-nc/4.0/</ali:license_ref><license-p>CC BY-NC</license-p></license></permissions>`),
      expectedVerified: false,
      expectedReason: "jats_permissions_block_noncommercial",
    })
    runCase({
      name: "jats-nd",
      xml: article(`<permissions><license><ali:license_ref>https://creativecommons.org/licenses/by-nd/4.0/</ali:license_ref><license-p>CC BY-ND</license-p></license></permissions>`),
      expectedVerified: false,
      expectedReason: "jats_permissions_block_no_derivatives",
    })
    runCase({
      name: "manifest-jats-mismatch",
      declaredLicense: "CC-BY-SA-4.0",
      declaredLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      xml: article(byPermissions),
      expectedVerified: false,
      expectedReason: "manifest_jats_license_mismatch",
    })
    runCase({
      name: "conflicting-no-commercial",
      xml: article(`<permissions><copyright-statement>No commercial re-use.</copyright-statement><license><ali:license_ref>https://creativecommons.org/licenses/by/4.0/</ali:license_ref><license-p>CC BY 4.0</license-p></license></permissions>`),
      expectedVerified: false,
      expectedReason: "jats_permissions_block_noncommercial",
    })
    runCase({
      name: "explicit-license-negation",
      xml: article(`<permissions><license><ali:license_ref>https://creativecommons.org/licenses/by/4.0/</ali:license_ref><license-p>This article is not licensed under the terms of the Creative Commons CC BY agreement.</license-p></license></permissions>`),
      expectedVerified: false,
      expectedReason: "jats_permissions_explicit_negation",
    })
    runCase({
      name: "manifest-license-url-invalid",
      declaredLicenseUrl: "https://example.invalid/claimed-cc-by",
      xml: article(byPermissions),
      expectedVerified: false,
      expectedReason: "manifest_license_url_unverified",
    })
    runCase({ name: "missing-hash", xml: article(byPermissions), omitHash: true, expectedVerified: false, expectedReason: "jats_artifact_manifest_hash_missing" })
    runCase({ name: "hash-mismatch", xml: article(byPermissions), wrongHash: true, expectedVerified: false, expectedReason: "jats_artifact_manifest_hash_mismatch" })
    runCase({ name: "bytes-mismatch", xml: article(byPermissions), wrongBytes: true, expectedVerified: false, expectedReason: "jats_artifact_manifest_bytes_mismatch" })
    runCase({ name: "path-outside-source", xml: article(byPermissions), artifactRelativePath: "../outside.jats.xml", expectedVerified: false, expectedReason: "jats_artifact_path_outside_source" })
    runCase({ name: "direct-symlink-forbidden", xml: article(byPermissions), symlinkMode: "direct_inside", expectedVerified: false, expectedReason: "jats_artifact_symlink_forbidden" })
    runCase({ name: "parent-symlink-outside-source", xml: article(byPermissions), artifactRelativePath: "linked/article.jats.xml", symlinkMode: "parent_outside", expectedVerified: false, expectedReason: "jats_artifact_realpath_outside_source" })
    runCase({
      name: "unknown-jats-license",
      xml: article(`<permissions><license><license-p>Open access.</license-p></license></permissions>`),
      expectedVerified: false,
      expectedReason: "jats_license_url_missing",
    })
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
  return { ok: true, caseCount, negativeCaseCount }
}

if (process.argv.includes("--self-test-jats-license")) {
  console.log(JSON.stringify({
    ...runJatsLicenseSyntheticTests(),
    inspectionVersion: JATS_LICENSE_INSPECTION_VERSION,
    auditorScriptSha256: sha256File(resolve(process.argv[1])),
  }, null, 2))
  process.exit(0)
}

if (process.argv.includes("--self-test-official-adapters")) {
  console.log(JSON.stringify({
    ...runOfficialAdapterSyntheticTests(),
    auditorVersion: AUDITOR_IMPLEMENTATION_VERSION,
    officialAuthorityRegistrySha256: sha256File(officialAuthorityRegistryPath),
    auditorScriptSha256: sha256File(resolve(process.argv[1])),
  }, null, 2))
  process.exit(0)
}

if (!root.startsWith("/Volumes/ResearchSSD/") || !existsSync(root)) {
  throw new Error(`ResearchSSD source library unavailable: ${root}`)
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
  const jatsNarrativePassageLicense = verifyJatsNarrativePassageLicense({
    libraryRoot: root,
    record,
    recordPath,
    declaredPolicy: classifyLicense(licenseValue),
    declaredLicenseUrl: licenseUrl,
  })
  const declaredArtifactPath = record.artifact?.path
    ? resolve(rootForSource, String(record.artifact.path)) : null
  const declaredArtifactWithinSource = declaredArtifactPath
    ? !relative(rootForSource, declaredArtifactPath).startsWith("..")
      && relative(rootForSource, declaredArtifactPath) !== ".."
    : false
  const realSourceRoot = existsSync(rootForSource) ? realpathSync(rootForSource) : null
  const realDeclaredArtifactPath = declaredArtifactPath && existsSync(declaredArtifactPath)
    ? realpathSync(declaredArtifactPath) : null
  const realArtifactRelative = realSourceRoot && realDeclaredArtifactPath
    ? relative(realSourceRoot, realDeclaredArtifactPath) : null
  const declaredArtifactRealpathWithinSource = Boolean(realArtifactRelative
    && !realArtifactRelative.startsWith("..") && realArtifactRelative !== ".."
    && !realArtifactRelative.includes("\\"))
  const localArtifact = declaredArtifactPath && declaredArtifactWithinSource
    && declaredArtifactRealpathWithinSource
    && existsSync(declaredArtifactPath) && statSync(declaredArtifactPath).isFile()
    && !lstatSync(declaredArtifactPath).isSymbolicLink()
    ? {
      relativePath: relative(root, declaredArtifactPath),
      declaredSha256: /^[a-f0-9]{64}$/i.test(String(record.artifact?.sha256 || ""))
        ? String(record.artifact.sha256).toLowerCase() : null,
      actualSha256: sha256File(declaredArtifactPath),
      declaredBytes: Number.isInteger(Number(record.artifact?.bytes))
        ? Number(record.artifact.bytes) : null,
      actualBytes: statSync(declaredArtifactPath).size,
    }
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
    jatsNarrativePassageLicense,
    localArtifact,
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
    jatsNarrativePassageLicense: {
      verified: false,
      reason: "jats_artifact_not_declared",
      artifactRelativePath: null,
      artifactSha256: null,
      licenseUrl: null,
    },
    mixedEmbeddedMaterial: true,
    runtimeCandidate: false,
  })
}
localSources.sort((a, b) => a.sourceId.localeCompare(b.sourceId))

if (jatsLicenseReportOnly) {
  const jatsRecords = localSources.filter((source) =>
    source.jatsNarrativePassageLicense.reason !== "jats_artifact_not_declared")
  console.log(JSON.stringify({
    ok: true,
    root,
    mode: "read_only_no_audit_output_written",
    inspectionVersion: JATS_LICENSE_INSPECTION_VERSION,
    auditorScriptSha256: sha256File(resolve(process.argv[1])),
    declaredJatsRecords: jatsRecords.length,
    verifiedNarrativePassageRecords: jatsRecords.filter((source) =>
      source.jatsNarrativePassageLicense.verified).length,
    reasonCounts: Object.fromEntries([...new Set(jatsRecords.map((source) =>
      source.jatsNarrativePassageLicense.reason))].sort().map((reason) => [
      reason,
      jatsRecords.filter((source) => source.jatsNarrativePassageLicense.reason === reason).length,
    ])),
    records: jatsRecords.map((source) => ({
      sourceId: source.sourceId,
      verified: source.jatsNarrativePassageLicense.verified,
      reason: source.jatsNarrativePassageLicense.reason,
      artifactRelativePath: source.jatsNarrativePassageLicense.artifactRelativePath,
      artifactSha256: source.jatsNarrativePassageLicense.artifactSha256,
    })),
  }, null, 2))
  process.exit(0)
}

if (!refresh && !rebuildFromRaw) {
  throw new Error("source_governance_audit_write_requires_refresh_or_rebuild_from_raw")
}

mkdirSync(outputRoot, { recursive: true })

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

async function fetchAuthorityBytes(
  url,
  accept,
  userAgent = "SelfMetaAI-DNA-SourceAuditor/2.0 (research@selfmetacognition.com)",
  maxBytes = 64 * 1024 * 1024,
  allowedRedirectUrls = [],
) {
  const initialUrl = assertOfficialAuthorityUrl(url)
  const allowedUrls = new Set([
    new URL(initialUrl).toString(),
    ...allowedRedirectUrls.map((value) => new URL(assertOfficialAuthorityUrl(value)).toString()),
  ])
  let lastError
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      let requestUrl = initialUrl
      let response
      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        response = await fetch(requestUrl, {
          headers: {
            "user-agent": userAgent,
            accept,
          },
          redirect: "manual",
          signal: AbortSignal.timeout(30_000),
        })
        if (![301, 302, 303, 307, 308].includes(response.status)) break
        const location = response.headers.get("location")
        if (!location) throw new Error("official_authority_redirect_location_missing")
        const nextUrl = new URL(location, requestUrl).toString()
        assertOfficialAuthorityUrl(nextUrl)
        if (!allowedUrls.has(nextUrl)) {
          throw new Error(`official_authority_redirect_not_registered:${nextUrl}`)
        }
        requestUrl = nextUrl
        if (redirectCount === 5) throw new Error("official_authority_redirect_limit_exceeded")
      }
      if (response.status === 429 || response.status >= 500) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 500 * (attempt + 1)))
        continue
      }
      if (!response.ok) throw new Error(`${response.status} ${url}`)
      const advertisedBytes = Number(response.headers.get("content-length"))
      if (Number.isFinite(advertisedBytes) && advertisedBytes > maxBytes) {
        throw new Error(`official_authority_response_too_large:${advertisedBytes}`)
      }
      const finalUrl = new URL(response.url)
      if (finalUrl.protocol !== "https:" || !OFFICIAL_AUTHORITY_HOSTS.has(finalUrl.hostname)) {
        throw new Error(`official_authority_redirect_not_allowlisted:${response.url}`)
      }
      if (!response.body) throw new Error("official_authority_response_body_missing")
      const reader = response.body.getReader()
      const chunks = []
      let totalBytes = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          totalBytes += value.byteLength
          if (totalBytes > maxBytes) {
            await reader.cancel("official_authority_response_too_large")
            throw new Error(`official_authority_response_too_large:${totalBytes}`)
          }
          chunks.push(Buffer.from(value))
        }
      } finally {
        reader.releaseLock()
      }
      const bytes = Buffer.concat(chunks, totalBytes)
      return {
        bytes,
        finalUrl: response.url,
        contentType: response.headers.get("content-type") || "",
      }
    } catch (error) {
      lastError = error
      await new Promise((resolveWait) => setTimeout(resolveWait, 500 * (attempt + 1)))
    }
  }
  throw lastError
}

function decodeXmlText(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").trim()
}

function authorityXmlValues(xml, localName) {
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return [...String(xml || "").matchAll(new RegExp(`<dc:${escaped}[^>]*>([\\s\\S]*?)<\\/dc:${escaped}>`, "gi"))]
    .map((match) => decodeAuthorityXmlText(match[1])).filter(Boolean)
}

function decodeHtmlAttribute(value) {
  return decodeAuthorityXmlText(value)
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&nbsp;/gi, " ")
}

function htmlTagAttributes(tag) {
  const attributes = {}
  for (const attribute of String(tag || "").matchAll(
    /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
  )) {
    attributes[attribute[1].toLowerCase()] = decodeHtmlAttribute(
      attribute[2] ?? attribute[3] ?? attribute[4] ?? "",
    ).trim()
  }
  return attributes
}

function htmlMetaValues(html, expectedName) {
  const values = []
  for (const match of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = htmlTagAttributes(match[0])
    if (String(attributes.name || "").toLowerCase() === expectedName.toLowerCase()
      && attributes.content) values.push(attributes.content)
  }
  return values
}

function htmlAnchorHrefs(html, baseUrl) {
  return [...String(html || "").matchAll(/<a\b[^>]*>/gi)].flatMap((match) => {
    const href = htmlTagAttributes(match[0]).href
    if (!href) return []
    try {
      return [new URL(href, baseUrl).toString()]
    } catch {
      return []
    }
  })
}

function pressbooksMetadataFromHtml(rule, html) {
  const publicationDate = htmlMetaValues(html, "citation_publication_date")[0] || null
  const citationYear = htmlMetaValues(html, "citation_year")[0] || null
  const yearBasisValue = rule.yearBasis === "citation_publication_date"
    ? publicationDate : citationYear
  const metadata = {
    title: htmlMetaValues(html, "citation_title")[0] || null,
    authors: htmlMetaValues(html, "citation_author"),
    year: firstYear(yearBasisValue),
    publisher: htmlMetaValues(html, "citation_publisher")[0] || null,
    isbn: htmlMetaValues(html, "citation_isbn")[0] || null,
    version: null,
  }
  return {
    ...metadata,
    registryTitleMatched: exactCanonicalTextMatch(rule.expectedTitle, metadata.title),
    registryAuthorsMatched: authorsMatchExactly(rule.expectedAuthors || [], metadata.authors),
    registryYearMatched: Number(rule.expectedYear) === metadata.year,
  }
}

function pdfMetadataFromEvidence(rule, extractedText) {
  const normalizedText = canonicalText(extractedText)
  const expectedTitle = String(rule.expectedTitle || "").trim()
  const expectedAuthors = Array.isArray(rule.expectedAuthors)
    ? rule.expectedAuthors.map((value) => String(value).trim()).filter(Boolean)
    : []
  const expectedYear = Number(rule.expectedYear) || null
  const expectedVersion = rule.expectedVersion === null || rule.expectedVersion === undefined
    ? null : String(rule.expectedVersion).trim()
  const titleMatched = Boolean(expectedTitle)
    && normalizedText.includes(canonicalText(expectedTitle))
  const matchedAuthors = expectedAuthors.filter((author) =>
    normalizedText.includes(canonicalText(author)))
  const yearMatched = Boolean(expectedYear)
    && new RegExp(`\\b${expectedYear}\\b`).test(extractedText)
  const versionMatched = expectedVersion === null
    || new RegExp(`\\bversion\\s+${expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
      .test(extractedText)
  const publisherMatched = !rule.publisher
    || normalizedText.includes(canonicalText(rule.publisher))
  return {
    title: titleMatched ? expectedTitle : null,
    authors: matchedAuthors,
    year: yearMatched ? expectedYear : null,
    version: versionMatched ? expectedVersion : null,
    titleMatched,
    authorsMatched: matchedAuthors.length === expectedAuthors.length,
    yearMatched,
    versionMatched,
    publisherMatched,
  }
}

function assertRuleFinalUrl(rule, requestedUrl, finalUrl) {
  const allowed = new Set([
    new URL(requestedUrl).toString(),
    ...(Array.isArray(rule.allowedFinalUrls) ? rule.allowedFinalUrls.map((url) => new URL(url).toString()) : []),
  ])
  if (!allowed.has(new URL(finalUrl).toString())) {
    throw new Error(`official_authority_unexpected_redirect:${finalUrl}`)
  }
}

function inspectPdfEnvelope(document, rule) {
  if (!/application\/pdf/i.test(document.contentType)) {
    throw new Error(`official_pdf_content_type_invalid:${document.contentType}`)
  }
  if (!document.bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("official_pdf_signature_invalid")
  }
  if (!document.bytes.subarray(Math.max(0, document.bytes.length - 4096)).includes(Buffer.from("%%EOF"))) {
    throw new Error("official_pdf_eof_missing")
  }
  if (rule.expectedDocumentBytes && document.bytes.length !== Number(rule.expectedDocumentBytes)) {
    throw new Error(`official_pdf_byte_count_mismatch:${document.bytes.length}`)
  }
  const documentSha256 = sha256(document.bytes)
  if (rule.expectedDocumentSha256
    && documentSha256 !== String(rule.expectedDocumentSha256).toLowerCase()) {
    throw new Error(`official_pdf_sha256_mismatch:${documentSha256}`)
  }
  const info = spawnSync("pdfinfo", ["-"], {
    input: document.bytes,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
  })
  if (info.status !== 0 || !info.stdout || info.error) {
    throw new Error("official_pdf_info_failed")
  }
  const value = (label) => info.stdout.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"))?.[1]?.trim() || null
  const pages = Number(value("Pages")) || null
  const encrypted = value("Encrypted")
  if (!pages || pages < 1 || pages > 2000) throw new Error(`official_pdf_page_count_invalid:${pages}`)
  if (rule.expectedPages && pages !== Number(rule.expectedPages)) {
    throw new Error(`official_pdf_page_count_mismatch:${pages}`)
  }
  if (!/^no$/i.test(String(encrypted))) throw new Error(`official_pdf_encryption_forbidden:${encrypted}`)
  const title = value("Title")
  const author = value("Author")
  if (rule.expectedPdfInfoTitle && !exactCanonicalTextMatch(rule.expectedPdfInfoTitle, title)) {
    throw new Error("official_pdf_info_title_mismatch")
  }
  if (rule.expectedPdfInfoAuthor && !exactCanonicalTextMatch(rule.expectedPdfInfoAuthor, author)) {
    throw new Error("official_pdf_info_author_mismatch")
  }
  return { title, author, pages, encrypted, documentSha256, infoSha256: sha256(info.stdout) }
}

function runOfficialAdapterSyntheticTests() {
  let caseCount = 0
  let negativeCaseCount = 0
  const requireCase = (condition, name) => {
    caseCount += 1
    if (!condition) throw new Error(`official_adapter_self_test_failed:${name}`)
  }
  const requireFailure = (callback, name) => {
    caseCount += 1
    negativeCaseCount += 1
    try {
      callback()
    } catch {
      return
    }
    throw new Error(`official_adapter_negative_self_test_failed:${name}`)
  }
  const pressbooksRule = {
    yearBasis: "citation_publication_date",
    expectedTitle: "A & B",
    expectedAuthors: ["Ada Lovelace", "Alan Turing"],
    expectedYear: 2024,
  }
  const pressbooksHtml = `<meta content="A &amp; B" name="citation_title">
    <meta name="citation_publication_date" content="2024-02-03">
    <meta content="Ada Lovelace" name="citation_author">
    <meta name="citation_author" content="Alan Turing">`
  const pressbooks = pressbooksMetadataFromHtml(pressbooksRule, pressbooksHtml)
  requireCase(pressbooks.registryTitleMatched, "pressbooks_exact_title")
  requireCase(pressbooks.registryAuthorsMatched, "pressbooks_exact_authors")
  requireCase(pressbooks.registryYearMatched, "pressbooks_year_basis")
  const forbiddenFallback = pressbooksMetadataFromHtml(pressbooksRule,
    `${pressbooksHtml.replace(/<meta name="citation_publication_date"[^>]+>/, "")}<meta name="citation_year" content="2024">`)
  requireCase(forbiddenFallback.year === null, "pressbooks_year_fallback_forbidden")
  requireCase(!authorsMatchExactly(pressbooksRule.expectedAuthors, ["Ada Lovelace"]),
    "pressbooks_partial_author_set_rejected")

  const pdfRule = {
    expectedTitle: "Clinical Guidance",
    expectedAuthors: ["Ada Lovelace"],
    expectedYear: 2024,
    expectedVersion: "1.2",
    publisher: "Example Association",
  }
  const pdfText = "Clinical Guidance Ada Lovelace Version 1.2 Example Association 2024"
  const pdfMetadata = pdfMetadataFromEvidence(pdfRule, pdfText)
  requireCase(Object.entries(pdfMetadata).filter(([key]) => key.endsWith("Matched"))
    .every(([, matched]) => matched === true), "pdf_metadata_all_fields")
  requireCase(!pdfMetadataFromEvidence(pdfRule, pdfText.replace("Ada Lovelace", "Grace Hopper")).authorsMatched,
    "pdf_metadata_missing_author_rejected")
  requireCase(!pdfMetadataFromEvidence(pdfRule, pdfText.replace("2024", "2023")).yearMatched,
    "pdf_metadata_wrong_year_rejected")
  requireCase(!pdfMetadataFromEvidence(pdfRule, pdfText.replace("Version 1.2", "Version 1.1")).versionMatched,
    "pdf_metadata_wrong_version_rejected")
  requireCase(!pdfMetadataFromEvidence(pdfRule, pdfText.replace("Example Association", "Other Publisher")).publisherMatched,
    "pdf_metadata_wrong_publisher_rejected")
  requireFailure(() => assertRuleFinalUrl({ allowedFinalUrls: [] },
    "https://www.apa.org/a.pdf", "https://www.palomar.edu/a.pdf"), "cross_record_redirect")
  requireFailure(() => inspectPdfEnvelope({
    contentType: "text/html",
    bytes: Buffer.from("%PDF-invalid%%EOF"),
  }, {}), "pdf_mime")
  requireFailure(() => inspectPdfEnvelope({
    contentType: "application/pdf",
    bytes: Buffer.from("not-a-pdf%%EOF"),
  }, {}), "pdf_signature")
  requireFailure(() => inspectPdfEnvelope({
    contentType: "application/pdf",
    bytes: Buffer.from("%PDF-no-eof"),
  }, {}), "pdf_eof")
  return { ok: true, caseCount, negativeCaseCount }
}

function officialMetadataFromRaw(source, rule, rawRecord) {
  if (!rule || !rawRecord || rawRecord.error) return null
  if (rule.adapter === "open_textbook_library_json") {
    const data = rawRecord.response?.data
    if (!data || Number(data.id) !== Number(rule.catalogId)) return null
    const authors = (data.contributors || []).filter((row) => row.contribution === "Author")
      .map((row) => [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "))
      .filter(Boolean)
    const publisher = data.publishers?.[0] || null
    const year = rule.yearBasis === "publisher_year" ? Number(publisher?.year || 0)
      : Number(data.copyright_year || 0)
    return {
      title: String(data.title || "") || null,
      authors,
      year: Number.isInteger(year) && year > 0 ? year : null,
      venue: null,
      publisher: String(publisher?.name || "") || null,
      isbn: canonicalIsbn(data.isbn13 || data.formats?.find((row) => row.isbn)?.isbn),
      version: null,
      authority: "Open Textbook Library official catalog JSON",
      verified: Boolean(data.title && authors.length > 0 && year > 0),
    }
  }
  if (rule.adapter === "oai_dc") {
    const xml = rawRecord.responseXml
    const relations = authorityXmlValues(xml, "relation")
    const years = authorityXmlValues(xml, "date").flatMap((value) => value.match(/\b(?:19|20)\d{2}\b/g) || [])
      .map(Number)
    return {
      title: authorityXmlValues(xml, "title")[0] || null,
      authors: authorityXmlValues(xml, "creator"),
      year: years.includes(Number(source.year)) ? Number(source.year) : years[0] || null,
      venue: null,
      publisher: authorityXmlValues(xml, "publisher")[0] || null,
      isbn: null,
      version: null,
      authority: "eCampusOntario official OAI-PMH record",
      verified: Boolean(authorityXmlValues(xml, "title")[0]
        && authorityXmlValues(xml, "creator").length > 0
        && years.length > 0
        && relations.includes(rule.expectedOfficialRelation)),
    }
  }
  if (rule.adapter === "official_pressbooks_html") {
    const metadata = rawRecord.metadata
    return metadata ? {
      title: metadata.title || null,
      authors: Array.isArray(metadata.authors) ? metadata.authors : [],
      year: metadata.year || null,
      venue: null,
      publisher: metadata.publisher || null,
      isbn: canonicalIsbn(metadata.isbn),
      version: metadata.version || null,
      authority: "Official Pressbooks publication metadata",
      verified: Boolean(metadata.title && metadata.authors?.length > 0 && metadata.year
        && metadata.registryTitleMatched && metadata.registryAuthorsMatched
        && metadata.registryYearMatched),
    } : null
  }
  if (rule.adapter === "official_pdf_metadata") {
    const metadata = rawRecord.document?.metadata
    return metadata ? {
      title: metadata.title || null,
      authors: Array.isArray(metadata.authors) ? metadata.authors : [],
      year: metadata.year || null,
      venue: null,
      publisher: rule.publisher || null,
      isbn: canonicalIsbn(metadata.isbn),
      version: metadata.version || null,
      authority: "Official publisher PDF metadata evidence",
      verified: Boolean(
        metadata.titleMatched
        && metadata.authorsMatched
        && metadata.yearMatched
        && metadata.versionMatched
        && metadata.publisherMatched
        && metadata.documentHashMatched
        && metadata.localArtifactMatched
      ),
    } : null
  }
  if (rule.adapter === "official_guideline_pdf") {
    const metadata = rawRecord.document?.metadata
    return metadata ? {
      title: metadata.title || null,
      authors: [],
      year: metadata.year || null,
      venue: null,
      publisher: rule.publisher || null,
      isbn: canonicalIsbn(metadata.isbn),
      version: null,
      authority: "Autism CRC official landing page and guideline PDF",
      verified: Boolean(rawRecord.landing?.secondEdition2023
        && metadata.title && metadata.year === 2023
        && canonicalIsbn(metadata.isbn) === canonicalIsbn(rule.expectedIsbn)),
    } : null
  }
  return null
}

async function fetchOfficialAuthorityRecord(rule) {
  try {
    if (rule.adapter === "open_textbook_library_json") {
      const response = await fetchJson(assertOfficialAuthorityUrl(rule.url), {
        headers: { accept: "application/json" },
      })
      return { adapter: rule.adapter, url: rule.url, response }
    }
    if (rule.adapter === "oai_dc") {
      const response = await fetchAuthorityBytes(rule.url, "application/xml,text/xml;q=0.9")
      return {
        adapter: rule.adapter,
        url: rule.url,
        finalUrl: response.finalUrl,
        contentType: response.contentType,
        responseSha256: sha256(response.bytes),
        responseXml: response.bytes.toString("utf8"),
      }
    }
    if (rule.adapter === "official_pressbooks_html") {
      const response = await fetchAuthorityBytes(
        rule.url,
        "text/html",
        BROWSER_USER_AGENT,
        2 * 1024 * 1024,
        rule.allowedFinalUrls || [],
      )
      assertRuleFinalUrl(rule, rule.url, response.finalUrl)
      if (!/text\/html/i.test(response.contentType)) {
        throw new Error(`official_pressbooks_content_type_invalid:${response.contentType}`)
      }
      const html = response.bytes.toString("utf8")
      const metadata = pressbooksMetadataFromHtml(rule, html)
      if (response.bytes.length < Number(rule.expectedMinBytes || 1)) {
        throw new Error(`official_pressbooks_response_too_small:${response.bytes.length}`)
      }
      if (!metadata.title || metadata.authors.length === 0 || !metadata.year
        || /captcha|cf-chl-|challenge-platform|cf-turnstile/i.test(html)) {
        throw new Error("official_pressbooks_required_metadata_missing")
      }
      return {
        adapter: rule.adapter,
        url: rule.url,
        finalUrl: response.finalUrl,
        bytes: response.bytes.length,
        contentType: response.contentType,
        responseSha256: sha256(response.bytes),
        extractedMetadataSha256: sha256(JSON.stringify(metadata)),
        metadata,
      }
    }
    if (rule.adapter === "official_pdf_metadata") {
      const [landing, document] = await Promise.all([
        rule.landingUrl
          ? fetchAuthorityBytes(rule.landingUrl, "text/html", BROWSER_USER_AGENT,
            4 * 1024 * 1024, rule.allowedLandingFinalUrls || [])
          : Promise.resolve(null),
        fetchAuthorityBytes(rule.documentUrl, "application/pdf", BROWSER_USER_AGENT,
          64 * 1024 * 1024, rule.allowedDocumentFinalUrls || []),
      ])
      assertRuleFinalUrl(rule, rule.documentUrl, document.finalUrl)
      if (landing) assertRuleFinalUrl(rule, rule.landingUrl, landing.finalUrl)
      const pdfInfo = inspectPdfEnvelope(document, rule)
      const landingHtml = landing ? landing.bytes.toString("utf8") : ""
      if (landing && (!/text\/html/i.test(landing.contentType)
        || landing.bytes.length < 1000
        || /captcha|cf-chl-|challenge-platform|cf-turnstile/i.test(landingHtml))) {
        throw new Error("official_pdf_landing_response_invalid")
      }
      if (rule.requireLandingDocumentLink
        && !htmlAnchorHrefs(landingHtml, landing.finalUrl).includes(new URL(rule.documentUrl).toString())) {
        throw new Error("official_pdf_landing_document_link_missing")
      }
      const extracted = spawnSync("pdftotext", ["-f", "1", "-l", "3", "-layout", "-", "-"], {
        input: document.bytes,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30_000,
      })
      if (extracted.status !== 0 || !extracted.stdout || extracted.error) {
        throw new Error("official_pdf_metadata_text_extraction_failed")
      }
      const metadata = pdfMetadataFromEvidence(rule, extracted.stdout)
      metadata.documentHashMatched = !rule.expectedDocumentSha256
        || pdfInfo.documentSha256 === String(rule.expectedDocumentSha256).toLowerCase()
      const source = localSources.find((row) => row.sourceId === rule.sourceId)
      metadata.localArtifactMatched = !rule.requireLocalArtifactMatch || Boolean(
        source?.localArtifact
        && source.localArtifact.declaredSha256 === source.localArtifact.actualSha256
        && source.localArtifact.actualBytes === source.localArtifact.declaredBytes
        && source.localArtifact.actualSha256 === pdfInfo.documentSha256,
      )
      return {
        adapter: rule.adapter,
        landing: landing ? {
          url: rule.landingUrl,
          finalUrl: landing.finalUrl,
          bytes: landing.bytes.length,
          sha256: sha256(landing.bytes),
          contentType: landing.contentType,
        } : null,
        document: {
          url: rule.documentUrl,
          finalUrl: document.finalUrl,
          bytes: document.bytes.length,
          sha256: sha256(document.bytes),
          contentType: document.contentType,
          extractedMetadataSha256: sha256(JSON.stringify(metadata)),
          pdfInfo,
          metadata,
        },
      }
    }
    if (rule.adapter === "official_guideline_pdf") {
      const [landing, document] = await Promise.all([
        fetchAuthorityBytes(rule.landingUrl, "text/html",
          "SelfMetaAI-DNA-SourceAuditor/2.0 (research@selfmetacognition.com)",
          4 * 1024 * 1024, rule.allowedLandingFinalUrls || []),
        fetchAuthorityBytes(rule.documentUrl, "application/pdf",
          "SelfMetaAI-DNA-SourceAuditor/2.0 (research@selfmetacognition.com)",
          64 * 1024 * 1024, rule.allowedDocumentFinalUrls || []),
      ])
      assertRuleFinalUrl(rule, rule.documentUrl, document.finalUrl)
      assertRuleFinalUrl(rule, rule.landingUrl, landing.finalUrl)
      const pdfInfo = inspectPdfEnvelope(document, rule)
      const landingText = landing.bytes.toString("utf8")
      const extracted = spawnSync("pdftotext", ["-f", "1", "-l", "8", "-layout", "-", "-"], {
        input: document.bytes,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30_000,
      })
      if (extracted.status !== 0 || !extracted.stdout || extracted.error) throw new Error("official_guideline_pdf_text_extraction_failed")
      const text = extracted.stdout
      const isbn = text.match(/ISBN\s*:\s*([0-9X -]{10,25})/i)?.[1]?.trim() || null
      const year = /\bUPDATED\s+2023\b/i.test(text) ? 2023 : null
      const title = /National Guideline[\s\S]{0,100}?assessment and diagnosis[\s\S]{0,80}?autism in Australia/i.test(text)
        ? "National Guideline for the assessment and diagnosis of autism in Australia"
        : null
      return {
        adapter: rule.adapter,
        landing: {
          url: rule.landingUrl,
          finalUrl: landing.finalUrl,
          bytes: landing.bytes.length,
          sha256: sha256(landing.bytes),
          contentType: landing.contentType,
          secondEdition2023: /second edition\s*\(2023\)|second \(2023\) edition/i.test(landingText),
        },
        document: {
          url: rule.documentUrl,
          finalUrl: document.finalUrl,
          bytes: document.bytes.length,
          sha256: sha256(document.bytes),
          contentType: document.contentType,
          extractedMetadataSha256: sha256(JSON.stringify({ title, year, isbn })),
          pdfInfo,
          metadata: { title, year, isbn },
        },
      }
    }
    throw new Error(`official_authority_adapter_unsupported:${rule.adapter}`)
  } catch (error) {
    return { adapter: rule.adapter, error: String(error?.message || error) }
  }
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
  const officialMetadata = {}
  for (const rule of [...officialAuthorityRules.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId))) {
    officialMetadata[rule.sourceId] = await fetchOfficialAuthorityRecord(rule)
  }
  return {
    schemaVersion: "dna-source-identity-raw-authority-responses@2",
    retrievedAt: new Date().toISOString(),
    authorities: {
      crossref: "https://api.crossref.org/works/{doi}",
      pubmed: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
      europePmcFallback: "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
      isbnSecondaryCatalog: "https://openlibrary.org/isbn/{isbn}.json",
      officialSourceRegistrySha256: sha256File(officialAuthorityRegistryPath),
    },
    pubmed,
    crossref,
    europePmc,
    isbn,
    officialMetadata,
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

function declaredPublicationRole(source) {
  if (source.recordPath.startsWith("textbooks/")
    || /book|textbook|foundational_book|open_educational_textbook|reference_only/i.test(source.design)) {
    return "book"
  }
  if (/guideline|consensus|standard/i.test(source.design)) return "guideline"
  return "article"
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
  const declaredRole = declaredPublicationRole(source)
  const officialRule = officialAuthorityRules.get(source.sourceId) || null
  const officialRaw = raw.officialMetadata?.[source.sourceId] || null
  const official = officialMetadataFromRaw(source, officialRule, officialRaw)
  const crossref = source.doi ? raw.crossref[source.doi] : null
  const fallback = source.doi ? raw.europePmc[source.doi]?.[0] : null
  const existing = source.doi ? existingOnlineByDoi.get(source.doi) : null
  const pubmed = source.pmid ? pubmedResult[source.pmid] : null
  const remotePubmedIds = pubmedIds(pubmed)
  const authorityTitle = pubmed?.title || crossref?.title?.[0] || fallback?.title
    || official?.title || null
  const authorityYear = firstYear(pubmed?.pubdate, pubmed?.epubdate)
    || crossrefYear(crossref)
    || Number(fallback?.pubYear)
    || official?.year
    || null
  const authorityAuthors = crossrefAuthors(crossref).length
    ? crossrefAuthors(crossref)
    : Array.isArray(pubmed?.authors) ? pubmed.authors.map((author) => author.name).filter(Boolean)
      : fallback?.authorString ? fallback.authorString.split(",").map((author) => author.trim()).filter(Boolean)
        : official?.authors || []
  const authorityVenue = crossref?.["container-title"]?.[0]
    || pubmed?.fulljournalname || pubmed?.source || fallback?.journalTitle
    || official?.venue || null
  const remoteDoi = canonicalDoi(crossref?.DOI || fallback?.doi || existing?.normalizedDoi)
  const remotePmid = canonicalPmid(pubmed ? remotePubmedIds.pmid : fallback?.pmid)
  const remotePmcid = canonicalPmcid(pubmed ? remotePubmedIds.pmcid : fallback?.pmcid)
  const isbnAuthority = source.isbn ? raw.isbn[source.isbn] : null
  const officialIsbnVerified = Boolean(source.isbn && official?.verified
    && canonicalIsbn(official.isbn) === canonicalIsbn(source.isbn))
  const remoteIsbn = officialIsbnVerified
    ? canonicalIsbn(official.isbn)
    : isbnAuthority ? canonicalIsbn(source.isbn) : null
  const isbnAuthorityTitle = officialIsbnVerified ? official?.title : isbnAuthority?.title
  const isbnAuthorityYear = officialIsbnVerified ? official?.year : firstYear(isbnAuthority?.publish_date)
  const isbnTitleVerified = source.isbn === null
    || Boolean(isbnAuthorityTitle && titleMatches(source.title, isbnAuthorityTitle))
  const isbnYearVerified = source.isbn === null
    || isbnAuthorityYear === null
    || isbnAuthorityYear === source.year
  const doiVerified = source.doi === null || remoteDoi === source.doi
  const pubmedVerified = source.pmid === null || (
    pubmed && remotePmid === source.pmid
      && (source.doi === null || canonicalDoi(remotePubmedIds.doi) === source.doi)
      && (source.pmcid === null || remotePmcid === source.pmcid)
  )
  const titleVerified = titleMatches(source.title, authorityTitle)
  const yearVerified = source.year === authorityYear
  const authorVerified = authorsMatch(source.authors, authorityAuthors)
  const officialVerified = !officialRule || Boolean(official?.verified)
  // Books do not have a journal/container and therefore must not be held to an
  // article-only venue requirement. A guideline with no named author list may
  // use the corporate publisher asserted by its official document authority.
  const authorityMetadataComplete = declaredRole === "guideline" && source.authors.length === 0
    ? Boolean(official?.publisher)
    : authorityAuthors.length > 0 && (declaredRole !== "article" || Boolean(authorityVenue))
  const isbnVerified = source.isbn === null || Boolean(remoteIsbn && isbnTitleVerified && isbnYearVerified)
  const hasPrimaryIdentifier = Boolean(source.doi || source.pmid || source.isbn)
  const hasPrimaryAuthority = hasPrimaryIdentifier || Boolean(official?.verified)
  const verified = hasPrimaryAuthority && officialVerified && doiVerified && pubmedVerified
    && isbnVerified && titleVerified && yearVerified && authorVerified && authorityMetadataComplete
  const reasons = []
  if (!hasPrimaryAuthority) reasons.push("no_primary_online_authority")
  if (officialRule && !officialRaw) reasons.push("official_authority_unavailable")
  else if (officialRule && officialRaw?.error) reasons.push("official_authority_unavailable")
  else if (officialRule && !officialVerified) reasons.push("official_authority_mismatch")
  if (!doiVerified) reasons.push("doi_mismatch")
  if (!pubmedVerified) reasons.push("pubmed_pmc_crosswalk_mismatch")
  if (source.isbn && !isbnAuthority && !officialIsbnVerified) reasons.push("isbn_authority_unavailable")
  else if (!isbnVerified) reasons.push("isbn_authority_mismatch")
  if (!authorityTitle) reasons.push("title_authority_unavailable")
  else if (!titleVerified) reasons.push("title_mismatch")
  if (!authorityYear) reasons.push("year_authority_unavailable")
  else if (!yearVerified) reasons.push("year_mismatch")
  if (source.authors.length > 0 && authorityAuthors.length === 0) reasons.push("author_authority_unavailable")
  else if (!authorVerified) reasons.push("author_mismatch")
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
    : declaredRole
  const versionStatus = crossref?.type === "posted-content" || /preprint/i.test(crossref?.subtype || "")
    ? "preprint"
    : crossref || existing?.status === "verified_match" || official?.verified
      ? "version_of_record" : "unknown"
  const relatedPublished = preprintRelation ? localByDoi.get(preprintRelation.doi) : null
  const workId = relatedPublished ? `work:${relatedPublished.sourceId}` : `work:${source.sourceId}`
  const evidencePayload = {
    crossref,
    pubmed,
    fallback,
    existing,
    officialRaw,
    localArtifact: source.localArtifact || null,
    officialSourceRegistrySha256: sha256File(officialAuthorityRegistryPath),
  }
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
      publisher: official?.publisher || crossref?.publisher || null,
      version: official?.version || null,
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
      authority: [
        source.doi ? "Crossref/Europe PMC" : null,
        source.pmid ? "PubMed" : null,
        source.isbn && !officialIsbnVerified ? "OpenLibrary secondary catalog" : null,
        official?.authority || null,
      ]
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
      officialAuthorityRegistrySha256: officialRule ? sha256File(officialAuthorityRegistryPath) : null,
      officialAuthorityAdapter: officialRule?.adapter || null,
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
  if (source.mixedEmbeddedMaterial && (component === "abstract" || component === "full_text")) {
    return "restricted"
  }
  if ((component === "full_text" || component === "passage") && policy === "cc_by_with_exceptions") return "restricted"
  if (!source.hasContentArtifact || !source.runtimeCandidate) return "metadata_only"
  if (component === "passage") {
    return ["cc0", "cc_by", "cc_by_sa"].includes(policy)
      && source.jatsNarrativePassageLicense?.verified
      ? "cleared"
      : "unknown"
  }
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
      const passageJatsEvidence = component === "passage"
        && allowed
        && source.jatsNarrativePassageLicense?.verified
      const evidenceBasis = component === "metadata"
        ? "metadata_fact"
        : passageJatsEvidence || allowed && source.licenseVerifiedInArtifact
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
        scope: component === "passage" && passageJatsEvidence
          ? "narrative_passage_only_tables_figures_supplements_excluded_by_parser"
          : null,
        evidence: {
          sourceId: source.sourceId,
          url: passageJatsEvidence
            ? source.jatsNarrativePassageLicense.licenseUrl
            : source.licenseUrl.startsWith("https://") ? source.licenseUrl : "https://example.invalid/licence-unavailable",
          checkedAt: source.retrievedAt || checkedAt,
          sha256: evidenceBasis === "verified_in_artifact"
            ? passageJatsEvidence
              ? source.jatsNarrativePassageLicense.artifactSha256
              : source.licenseArtifactSha256
            : source.evidenceSha256,
          basis: evidenceBasis,
          artifactRelativePath: evidenceBasis === "verified_in_artifact"
            ? passageJatsEvidence
              ? source.jatsNarrativePassageLicense.artifactRelativePath
              : source.licenseArtifactRelativePath
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
      jatsNarrativePassageLicense: source.jatsNarrativePassageLicense,
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
  schemaVersion: "dna-component-license-audit@2",
  auditedAt: new Date().toISOString(),
  auditorImplementation: {
    version: AUDITOR_IMPLEMENTATION_VERSION,
    jatsLicenseInspectionVersion: JATS_LICENSE_INSPECTION_VERSION,
    scriptSha256: sha256File(resolve(process.argv[1])),
  },
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
