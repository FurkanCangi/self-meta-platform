import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, join, relative, resolve } from "node:path"

import {
  DNA_GAP_PROTOCOL_CUTOFF_DATE,
  DNA_GAP_SEARCH_PROTOCOLS,
} from "../src/lib/dna/chat/governance/gapProtocols"

const SNAPSHOT_VERSION = "dna-gap-search-execution@1" as const
const API_CAP = 100
const DEFAULT_SSD_ROOT = "/Volumes/ResearchSSD"
const DEFAULT_RAW_BASE = join(
  DEFAULT_SSD_ROOT,
  "Datasets/DNA-Intelligence/source-searches/v3/2026-07-19",
)
const REPO_SNAPSHOT_PATH = resolve(
  process.cwd(),
  "docs/dna-intelligence/governance/v3/gap-search-execution-2026-07-19.json",
)
const USER_AGENT = "DNA-Intelligence-Gap-Audit/1.0 (source-governance; no clinical use)"

type PublicApi = "PubMed" | "Crossref" | "OpenAlex"

type DownloadedRecord = {
  rawId: string
  protocolId: string
  api: PublicApi
  externalId: string
  title: string
  abstract: string
  year: number | null
  doi: string | null
  pmid: string | null
  url: string | null
  recordType: string | null
}

type HttpAttempt = {
  attempt: number
  status: number | null
  ok: boolean
  durationMs: number
  error: string | null
}

type HttpEvidence = {
  method: "GET"
  url: string
  status: number | null
  ok: boolean
  attempts: readonly HttpAttempt[]
  responseSha256: string
  responseBytes: number
  rawRelativePath: string
  error: string | null
}

type ApiExecution = {
  api: PublicApi
  query: string
  querySha256: string
  endpoint: string
  status: "success" | "partial" | "failed"
  http: readonly HttpEvidence[]
  identifiedReported: number | null
  downloadCap: number
  downloadedMetadata: number
  truncatedByCap: boolean | null
  metadataSha256: string
  error: string | null
}

type RawManifestEntry = {
  relativePath: string
  bytes: number
  sha256: string
}

type FetchResult = {
  url: string
  status: number | null
  ok: boolean
  text: string
  attempts: readonly HttpAttempt[]
  error: string | null
}

type ScreeningRule = {
  includeAny: readonly string[]
  requireGroups?: readonly (readonly string[])[]
}

const SCREENING_RULES: Readonly<Record<string, ScreeningRule>> = Object.freeze({
  "gap.cellular.ion_plasticity_glia_neuromodulators": {
    includeAny: ["ion channel", "synaptic plastic", "glia", "astrocy", "microglia", "neuromodulat"],
  },
  "gap.cns.brainstem_thalamus_basal_ganglia_cerebellum": {
    includeAny: ["brainstem", "brain stem", "thalam", "basal ganglia", "cerebell"],
  },
  "gap.ans.central_network_baroreflex_respiration_posture": {
    includeAny: ["central autonomic", "baroreflex", "heart rate variability", "hrv", "autonomic network"],
  },
  "gap.stress.hpa_sam_child_adolescent_development": {
    includeAny: ["hpa", "hypothalamic pituitary adrenal", "sympathoadrenal", "stress reactiv", "cortisol"],
    requireGroups: [["child", "adolesc", "pediatric", "youth", "pubert", "infant"]],
  },
  "gap.sensory.vestibular_proprioceptive_tactile_auditory_modulation": {
    includeAny: ["vestibular", "propriocept", "tactile", "somatosensory", "auditory", "sensory modulation"],
  },
  "gap.coregulation.developmental_cultural_boundaries": {
    includeAny: ["co-regulation", "coregulation", "dyadic regulation", "interpersonal regulation", "synchron"],
  },
  "gap.executive.task_impurity": {
    includeAny: ["executive function", "cognitive control", "task impurity", "working memory", "inhibitory control"],
    requireGroups: [["reliab", "valid", "test-retest", "task impurity", "latent", "psychometric"]],
  },
  "gap.sleep.pediatric_circadian_development": {
    includeAny: ["sleep", "circadian", "chronotype"],
    requireGroups: [["child", "adolesc", "pediatric", "youth", "infant"]],
  },
  "gap.development.conditions_adult_neurodiversity": {
    includeAny: ["adhd", "attention deficit", "developmental coordination", "dyslexia", "language disorder", "tourette", "neurodivers"],
  },
  "gap.measurement.dna_psychometrics_individual_uncertainty": {
    includeAny: ["dna assessment", "dna profile"],
    requireGroups: [["psychometric", "reliab", "valid", "measurement invariance", "measurement error"]],
  },
})

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function stripMarkup(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]*>/g, " "))
}

function decodeXml(value: string): string {
  return stripMarkup(value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code))))
}

function normalizeDoi(value: unknown): string | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "")
    .split(/[?#]/)[0]
    .replace(/[\s.,;:)\]}]+$/g, "")
  return /^10\.\d{4,9}\/.+/.test(normalized) ? normalized : null
}

function normalizePmid(value: unknown): string | null {
  const match = String(value ?? "").match(/(?:pubmed\.ncbi\.nlm\.nih\.gov\/)?(\d{5,10})/)
  return match?.[1] ?? null
}

function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
}

function xmlFirst(block: string, expression: RegExp): string {
  return decodeXml(expression.exec(block)?.[1] ?? "")
}

function xmlAll(block: string, expression: RegExp): string[] {
  return [...block.matchAll(expression)].map((match) => decodeXml(match[1] ?? "")).filter(Boolean)
}

function pubmedRecords(xml: string, protocolId: string): DownloadedRecord[] {
  return [...xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)].flatMap((match) => {
    const block = match[1]
    const pmid = normalizePmid(xmlFirst(block, /<PMID[^>]*>([\s\S]*?)<\/PMID>/))
    const title = xmlFirst(block, /<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/)
    if (!pmid && !title) return []
    const abstracts = xmlAll(block, /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
    const doi = normalizeDoi(xmlFirst(block, /<ArticleId[^>]*IdType="doi"[^>]*>([\s\S]*?)<\/ArticleId>/))
    const yearText = xmlFirst(block, /<(?:ArticleDate|PubDate)[^>]*>[\s\S]*?<Year>(\d{4})<\/Year>[\s\S]*?<\/(?:ArticleDate|PubDate)>/)
      || xmlFirst(block, /<MedlineDate[^>]*>(\d{4})[^<]*<\/MedlineDate>/)
    const recordType = xmlAll(block, /<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g).join("; ") || null
    return [{
      rawId: `PubMed:${pmid ?? sha256(title).slice(0, 16)}`,
      protocolId,
      api: "PubMed" as const,
      externalId: pmid ?? sha256(title).slice(0, 16),
      title,
      abstract: abstracts.join(" "),
      year: /^\d{4}$/.test(yearText) ? Number(yearText) : null,
      doi,
      pmid,
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null,
      recordType,
    }]
  })
}

function crossrefYear(item: Record<string, unknown>): number | null {
  for (const field of ["published", "published-print", "published-online", "issued", "created"]) {
    const value = item[field] as { "date-parts"?: unknown } | undefined
    const year = Array.isArray(value?.["date-parts"])
      ? Number((value?.["date-parts"] as unknown[][])[0]?.[0])
      : NaN
    if (Number.isInteger(year)) return year
  }
  return null
}

function crossrefRecords(json: unknown, protocolId: string): DownloadedRecord[] {
  const message = (json as { message?: { items?: unknown[] } })?.message
  if (!Array.isArray(message?.items)) return []
  return message.items.flatMap((raw, index) => {
    const item = raw as Record<string, unknown>
    const titleField = Array.isArray(item.title) ? item.title[0] : item.title
    const title = normalizeWhitespace(String(titleField ?? ""))
    const doi = normalizeDoi(item.DOI)
    if (!title && !doi) return []
    return [{
      rawId: `Crossref:${doi ?? `${protocolId}:${index}`}`,
      protocolId,
      api: "Crossref" as const,
      externalId: doi ?? `${protocolId}:${index}`,
      title,
      abstract: stripMarkup(String(item.abstract ?? "")),
      year: crossrefYear(item),
      doi,
      pmid: null,
      url: typeof item.URL === "string" ? item.URL : doi ? `https://doi.org/${doi}` : null,
      recordType: typeof item.type === "string" ? item.type : null,
    }]
  })
}

function abstractFromInvertedIndex(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ""
  const tokens: Array<[number, string]> = []
  for (const [word, positions] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(positions)) continue
    for (const position of positions) {
      if (Number.isInteger(position)) tokens.push([Number(position), word])
    }
  }
  return tokens.sort((left, right) => left[0] - right[0]).map((entry) => entry[1]).join(" ")
}

function openAlexRecords(json: unknown, protocolId: string): DownloadedRecord[] {
  const results = (json as { results?: unknown[] })?.results
  if (!Array.isArray(results)) return []
  return results.flatMap((raw, index) => {
    const item = raw as Record<string, unknown>
    const title = normalizeWhitespace(String(item.title ?? ""))
    const doi = normalizeDoi(item.doi)
    const ids = item.ids && typeof item.ids === "object" ? item.ids as Record<string, unknown> : {}
    const pmid = normalizePmid(ids.pmid)
    const id = String(item.id ?? `${protocolId}:${index}`).replace(/^https?:\/\/openalex\.org\//, "")
    if (!title && !doi && !pmid) return []
    return [{
      rawId: `OpenAlex:${id}`,
      protocolId,
      api: "OpenAlex" as const,
      externalId: id,
      title,
      abstract: abstractFromInvertedIndex(item.abstract_inverted_index),
      year: Number.isInteger(item.publication_year) ? Number(item.publication_year) : null,
      doi,
      pmid,
      url: typeof item.doi === "string" ? item.doi : typeof item.id === "string" ? item.id : null,
      recordType: typeof item.type === "string" ? item.type : null,
    }]
  })
}

async function fetchWithRetry(url: string): Promise<FetchResult> {
  const attempts: HttpAttempt[] = []
  let finalText = ""
  let finalStatus: number | null = null
  let finalError: string | null = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const started = performance.now()
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(45_000),
      })
      finalText = await response.text()
      finalStatus = response.status
      finalError = response.ok ? null : `http_${response.status}`
      attempts.push({
        attempt,
        status: response.status,
        ok: response.ok,
        durationMs: Number((performance.now() - started).toFixed(3)),
        error: finalError,
      })
      if (response.ok) return { url, status: response.status, ok: true, text: finalText, attempts, error: null }
      if (response.status !== 429 && response.status < 500) break
    } catch (error) {
      finalError = error instanceof Error ? error.message : String(error)
      attempts.push({
        attempt,
        status: null,
        ok: false,
        durationMs: Number((performance.now() - started).toFixed(3)),
        error: finalError,
      })
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1_000))
  }
  return { url, status: finalStatus, ok: false, text: finalText, attempts, error: finalError ?? "network_error" }
}

async function writeRaw(
  runRoot: string,
  manifest: RawManifestEntry[],
  relativePath: string,
  content: string,
): Promise<RawManifestEntry> {
  const target = join(runRoot, relativePath)
  await mkdir(resolve(target, ".."), { recursive: true })
  await writeFile(target, content, "utf8")
  const entry = {
    relativePath,
    bytes: Buffer.byteLength(content),
    sha256: sha256(content),
  }
  manifest.push(entry)
  return entry
}

async function httpEvidence(
  runRoot: string,
  manifest: RawManifestEntry[],
  relativePath: string,
  result: FetchResult,
): Promise<HttpEvidence> {
  const raw = await writeRaw(runRoot, manifest, relativePath, result.text)
  return {
    method: "GET",
    url: result.url,
    status: result.status,
    ok: result.ok,
    attempts: result.attempts,
    responseSha256: raw.sha256,
    responseBytes: raw.bytes,
    rawRelativePath: raw.relativePath,
    error: result.error,
  }
}

async function runPubMed(
  protocolId: string,
  query: string,
  directory: string,
  runRoot: string,
  manifest: RawManifestEntry[],
): Promise<{ execution: ApiExecution; records: DownloadedRecord[] }> {
  const params = new URLSearchParams({
    db: "pubmed",
    retmode: "json",
    retmax: String(API_CAP),
    sort: "relevance",
    datetype: "pdat",
    mindate: "1900/01/01",
    maxdate: DNA_GAP_PROTOCOL_CUTOFF_DATE.replaceAll("-", "/"),
    term: query,
  })
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${params}`
  const search = await fetchWithRetry(searchUrl)
  const http: HttpEvidence[] = [await httpEvidence(runRoot, manifest, `${directory}/pubmed-search.raw.json`, search)]
  if (!search.ok) {
    return {
      execution: {
        api: "PubMed", query, querySha256: sha256(query), endpoint: "NCBI E-utilities eSearch/eFetch",
        status: "failed", http, identifiedReported: null, downloadCap: API_CAP,
        downloadedMetadata: 0, truncatedByCap: null, metadataSha256: sha256("[]"), error: search.error,
      },
      records: [],
    }
  }

  let payload: { esearchresult?: { count?: string; idlist?: string[] } }
  try {
    payload = JSON.parse(search.text)
  } catch {
    return {
      execution: {
        api: "PubMed", query, querySha256: sha256(query), endpoint: "NCBI E-utilities eSearch/eFetch",
        status: "failed", http, identifiedReported: null, downloadCap: API_CAP,
        downloadedMetadata: 0, truncatedByCap: null, metadataSha256: sha256("[]"), error: "invalid_search_json",
      },
      records: [],
    }
  }
  const identified = Number(payload.esearchresult?.count ?? 0)
  const ids = Array.isArray(payload.esearchresult?.idlist) ? payload.esearchresult!.idlist!.slice(0, API_CAP) : []
  if (ids.length === 0) {
    return {
      execution: {
        api: "PubMed", query, querySha256: sha256(query), endpoint: "NCBI E-utilities eSearch/eFetch",
        status: "success", http, identifiedReported: identified, downloadCap: API_CAP,
        downloadedMetadata: 0, truncatedByCap: identified > 0, metadataSha256: sha256("[]"), error: null,
      },
      records: [],
    }
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 350))
  const fetchParams = new URLSearchParams({ db: "pubmed", retmode: "xml", id: ids.join(",") })
  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams}`
  const fetched = await fetchWithRetry(fetchUrl)
  http.push(await httpEvidence(runRoot, manifest, `${directory}/pubmed-fetch.raw.xml`, fetched))
  const records = fetched.ok ? pubmedRecords(fetched.text, protocolId) : []
  const metadata = canonicalJson(records)
  await writeRaw(runRoot, manifest, `${directory}/pubmed-metadata.normalized.json`, metadata)
  return {
    execution: {
      api: "PubMed", query, querySha256: sha256(query), endpoint: "NCBI E-utilities eSearch/eFetch",
      status: fetched.ok ? "success" : "partial", http, identifiedReported: identified,
      downloadCap: API_CAP, downloadedMetadata: records.length, truncatedByCap: identified > ids.length,
      metadataSha256: sha256(metadata), error: fetched.error,
    },
    records,
  }
}

async function runCrossref(
  protocolId: string,
  query: string,
  directory: string,
  runRoot: string,
  manifest: RawManifestEntry[],
): Promise<{ execution: ApiExecution; records: DownloadedRecord[] }> {
  const params = new URLSearchParams({
    "query.bibliographic": query,
    rows: String(API_CAP),
    filter: `until-pub-date:${DNA_GAP_PROTOCOL_CUTOFF_DATE}`,
    select: "DOI,title,abstract,published,published-print,published-online,issued,created,URL,type",
  })
  const url = `https://api.crossref.org/works?${params}`
  const fetched = await fetchWithRetry(url)
  const http = [await httpEvidence(runRoot, manifest, `${directory}/crossref.raw.json`, fetched)]
  let payload: unknown = null
  let parseError: string | null = null
  if (fetched.ok) {
    try { payload = JSON.parse(fetched.text) } catch { parseError = "invalid_crossref_json" }
  }
  const records = payload ? crossrefRecords(payload, protocolId) : []
  const identifiedRaw = (payload as { message?: { "total-results"?: unknown } } | null)?.message?.["total-results"]
  const identified = Number.isFinite(Number(identifiedRaw)) ? Number(identifiedRaw) : null
  const metadata = canonicalJson(records)
  await writeRaw(runRoot, manifest, `${directory}/crossref-metadata.normalized.json`, metadata)
  const ok = fetched.ok && !parseError
  return {
    execution: {
      api: "Crossref", query, querySha256: sha256(query), endpoint: "Crossref REST API /works",
      status: ok ? "success" : "failed", http, identifiedReported: identified,
      downloadCap: API_CAP, downloadedMetadata: records.length,
      truncatedByCap: identified === null ? null : identified > records.length,
      metadataSha256: sha256(metadata), error: fetched.error ?? parseError,
    },
    records,
  }
}

async function runOpenAlex(
  protocolId: string,
  query: string,
  directory: string,
  runRoot: string,
  manifest: RawManifestEntry[],
): Promise<{ execution: ApiExecution; records: DownloadedRecord[] }> {
  const params = new URLSearchParams({
    search: query,
    "per-page": String(API_CAP),
    filter: `from_publication_date:1900-01-01,to_publication_date:${DNA_GAP_PROTOCOL_CUTOFF_DATE}`,
  })
  const url = `https://api.openalex.org/works?${params}`
  const fetched = await fetchWithRetry(url)
  const http = [await httpEvidence(runRoot, manifest, `${directory}/openalex.raw.json`, fetched)]
  let payload: unknown = null
  let parseError: string | null = null
  if (fetched.ok) {
    try { payload = JSON.parse(fetched.text) } catch { parseError = "invalid_openalex_json" }
  }
  const records = payload ? openAlexRecords(payload, protocolId) : []
  const identifiedRaw = (payload as { meta?: { count?: unknown } } | null)?.meta?.count
  const identified = Number.isFinite(Number(identifiedRaw)) ? Number(identifiedRaw) : null
  const metadata = canonicalJson(records)
  await writeRaw(runRoot, manifest, `${directory}/openalex-metadata.normalized.json`, metadata)
  const ok = fetched.ok && !parseError
  return {
    execution: {
      api: "OpenAlex", query, querySha256: sha256(query), endpoint: "OpenAlex REST API /works",
      status: ok ? "success" : "failed", http, identifiedReported: identified,
      downloadCap: API_CAP, downloadedMetadata: records.length,
      truncatedByCap: identified === null ? null : identified > records.length,
      metadataSha256: sha256(metadata), error: fetched.error ?? parseError,
    },
    records,
  }
}

function mergeRecord(existing: DownloadedRecord, incoming: DownloadedRecord): DownloadedRecord {
  return {
    ...existing,
    title: incoming.title.length > existing.title.length ? incoming.title : existing.title,
    abstract: incoming.abstract.length > existing.abstract.length ? incoming.abstract : existing.abstract,
    year: existing.year ?? incoming.year,
    doi: existing.doi ?? incoming.doi,
    pmid: existing.pmid ?? incoming.pmid,
    url: existing.url ?? incoming.url,
    recordType: existing.recordType ?? incoming.recordType,
  }
}

function deduplicate(records: readonly DownloadedRecord[]) {
  const sorted = [...records].sort((left, right) =>
    `${left.api}:${left.externalId}`.localeCompare(`${right.api}:${right.externalId}`, "en"))
  const canonical: DownloadedRecord[] = []
  const rawIdsByIndex: string[][] = []
  const byDoi = new Map<string, number>()
  const byPmid = new Map<string, number>()
  const byTitleYear = new Map<string, number>()

  for (const record of sorted) {
    const titleYear = record.title ? `${normalizeTitle(record.title)}::${record.year ?? "unknown"}` : ""
    const matchIndex = (record.doi ? byDoi.get(record.doi) : undefined)
      ?? (record.pmid ? byPmid.get(record.pmid) : undefined)
      ?? (titleYear ? byTitleYear.get(titleYear) : undefined)
    if (matchIndex !== undefined) {
      canonical[matchIndex] = mergeRecord(canonical[matchIndex], record)
      rawIdsByIndex[matchIndex].push(record.rawId)
      if (record.doi) byDoi.set(record.doi, matchIndex)
      if (record.pmid) byPmid.set(record.pmid, matchIndex)
      if (titleYear) byTitleYear.set(titleYear, matchIndex)
      continue
    }
    const index = canonical.length
    canonical.push(record)
    rawIdsByIndex.push([record.rawId])
    if (record.doi) byDoi.set(record.doi, index)
    if (record.pmid) byPmid.set(record.pmid, index)
    if (titleYear) byTitleYear.set(titleYear, index)
  }

  const ledger = canonical.map((record, index) => ({
    canonicalId: record.doi ? `doi:${record.doi}` : record.pmid ? `pmid:${record.pmid}` : `title-year:${sha256(`${normalizeTitle(record.title)}::${record.year ?? "unknown"}`).slice(0, 24)}`,
    doi: record.doi,
    pmid: record.pmid,
    normalizedTitleYear: `${normalizeTitle(record.title)}::${record.year ?? "unknown"}`,
    mergedRawIds: [...rawIdsByIndex[index]].sort(),
    record,
  }))
  return { records: canonical, ledger }
}

function screenRecord(record: DownloadedRecord, rule: ScreeningRule): string | null {
  if (!record.title) return "missing_title"
  if (record.year !== null && record.year > 2026) return "after_cutoff_date"
  const type = (record.recordType ?? "").toLocaleLowerCase("en-US")
  if (/^(?:dataset|component|reference-entry|grant|peer-review)$/.test(type)) return "unsupported_record_type"
  const text = `${record.title} ${record.abstract}`.toLocaleLowerCase("en-US")
  const animalSignal = /\b(?:mice|mouse|murine|rats?|rodent|zebrafish|non-human primate)\b/.test(text)
  const humanSignal = /\b(?:human|people|person|persons|participant|patient|child|adolesc|adult|infant|youth)\b/.test(text)
  if (animalSignal && !humanSignal) return "animal_only_title_abstract_signal"
  if (!rule.includeAny.some((term) => text.includes(term))) return "off_topic_title_abstract"
  if (rule.requireGroups?.some((group) => !group.some((term) => text.includes(term)))) {
    return "missing_required_scope_signal"
  }
  return null
}

async function runProtocol(
  protocol: (typeof DNA_GAP_SEARCH_PROTOCOLS)[number],
  index: number,
  runRoot: string,
  rawManifest: RawManifestEntry[],
) {
  const directory = `${String(index + 1).padStart(2, "0")}-${safePathSegment(protocol.id)}`
  const queryByApi = new Map(protocol.exactQueries.map((entry) => [entry.database, entry.query]))
  assert.deepEqual(new Set(queryByApi.keys()), new Set(["PubMed", "Crossref", "OpenAlex"]))

  const [pubmed, crossref, openAlex] = await Promise.all([
    runPubMed(protocol.id, queryByApi.get("PubMed")!, directory, runRoot, rawManifest),
    runCrossref(protocol.id, queryByApi.get("Crossref")!, directory, runRoot, rawManifest),
    runOpenAlex(protocol.id, queryByApi.get("OpenAlex")!, directory, runRoot, rawManifest),
  ])
  const apiExecutions = [pubmed.execution, crossref.execution, openAlex.execution]
  const downloaded = [...pubmed.records, ...crossref.records, ...openAlex.records]
  const dedupe = deduplicate(downloaded)
  const screeningRule = SCREENING_RULES[protocol.id]
  assert.ok(screeningRule, `${protocol.id}: deterministic screening rule missing`)
  const screening = dedupe.ledger.map((entry) => {
    const exclusionReason = screenRecord(entry.record, screeningRule)
    return {
      canonicalId: entry.canonicalId,
      decision: exclusionReason ? "exclude_at_title_abstract" : "advance_to_manual_full_text_review",
      exclusionReason,
      titleAbstractSha256: sha256(`${entry.record.title}\n${entry.record.abstract}`),
    }
  })
  const exclusionReasons: Record<string, number> = {}
  for (const entry of screening) {
    if (entry.exclusionReason) exclusionReasons[entry.exclusionReason] = (exclusionReasons[entry.exclusionReason] ?? 0) + 1
  }
  const titleAbstractExcluded = Object.values(exclusionReasons).reduce((sum, count) => sum + count, 0)
  const normalizedMetadata = canonicalJson(downloaded)
  const dedupeLedger = canonicalJson(dedupe.ledger)
  const screeningLedger = canonicalJson(screening)
  await writeRaw(runRoot, rawManifest, `${directory}/downloaded-metadata.all-apis.json`, normalizedMetadata)
  await writeRaw(runRoot, rawManifest, `${directory}/dedupe-ledger.json`, dedupeLedger)
  await writeRaw(runRoot, rawManifest, `${directory}/title-abstract-screening-ledger.json`, screeningLedger)

  const successfulApis = apiExecutions.filter((entry) => entry.status === "success").length
  const executionStatus = successfulApis === 3
    ? "identification_and_title_abstract_screening_executed_full_text_pending"
    : successfulApis === 0
      ? "failed_no_screening"
      : "partial_api_execution_full_text_pending"
  const identifiedKnown = apiExecutions.filter((entry) => entry.identifiedReported !== null)
  return {
    protocolId: protocol.id,
    domainId: protocol.domainId,
    protocolDefinitionSha256: sha256(JSON.stringify(protocol)),
    executionStatus,
    apiExecutions,
    counts: {
      identifiedReportedAcrossApisNonDeduplicated: identifiedKnown.reduce((sum, entry) => sum + entry.identifiedReported!, 0),
      identifiedCountCompleteAcrossAllApis: identifiedKnown.length === 3,
      downloadedMetadata: downloaded.length,
      deduplicatedMetadata: dedupe.records.length,
      duplicatesRemoved: downloaded.length - dedupe.records.length,
      titleAbstractScreened: dedupe.records.length,
      titleAbstractExcluded,
      advancedToManualFullTextReview: dedupe.records.length - titleAbstractExcluded,
      fullTextAssessed: null,
      includedInEvidenceBase: null,
    },
    exclusionReasons,
    metadataLimitations: {
      recordsWithoutAbstract: dedupe.records.filter((entry) => !entry.abstract).length,
      recordsWithoutYear: dedupe.records.filter((entry) => entry.year === null).length,
      recordsWithoutDoiAndPmid: dedupe.records.filter((entry) => !entry.doi && !entry.pmid).length,
    },
    dedupePolicy: ["canonical DOI", "PMID", "normalized title plus year"],
    screeningPolicy: "deterministic_title_abstract_only",
    releaseReadyClaims: 0,
    evidenceBaseInclusionPerformed: false,
    ledgerHashes: {
      downloadedMetadataSha256: sha256(normalizedMetadata),
      dedupeLedgerSha256: sha256(dedupeLedger),
      titleAbstractScreeningLedgerSha256: sha256(screeningLedger),
    },
  }
}

async function verifySnapshot(snapshotPath: string) {
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as {
    storagePolicy: "research_ssd_required_no_local_fallback"
    rawRootRelative: string
    rawManifest: RawManifestEntry[]
    rawArtifactManifestSha256: string
    snapshotPayloadSha256: string
    [key: string]: unknown
  }
  const { snapshotPayloadSha256, ...payload } = snapshot
  assert.equal(sha256(JSON.stringify(payload)), snapshotPayloadSha256, "snapshot payload hash")
  const sortedManifest = [...snapshot.rawManifest].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  assert.equal(sha256(JSON.stringify(sortedManifest)), snapshot.rawArtifactManifestSha256, "raw manifest hash")
  const ssdRoot = process.env.RESEARCH_SSD_ROOT || DEFAULT_SSD_ROOT
  await access(ssdRoot).catch(() => {
    throw new Error("ResearchSSD bağlı değil, önce SSD'yi tak.")
  })
  assert.equal(snapshot.storagePolicy, "research_ssd_required_no_local_fallback")
  assert.ok(!snapshot.rawRootRelative.startsWith("/") && !snapshot.rawRootRelative.includes(".."))
  const rawRoot = join(ssdRoot, snapshot.rawRootRelative)
  for (const entry of sortedManifest) {
    const content = await readFile(join(rawRoot, entry.relativePath))
    assert.equal(content.byteLength, entry.bytes, `${entry.relativePath}: byte count`)
    assert.equal(sha256(content), entry.sha256, `${entry.relativePath}: sha256`)
  }
  console.log("DNA gap search snapshot verified", JSON.stringify({
    snapshotPath: relative(process.cwd(), snapshotPath),
    storagePolicy: snapshot.storagePolicy,
    rawRootRelative: snapshot.rawRootRelative,
    rawFiles: sortedManifest.length,
    rawArtifactManifestSha256: snapshot.rawArtifactManifestSha256,
  }))
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has("--verify-snapshot")) {
    await verifySnapshot(REPO_SNAPSHOT_PATH)
    return
  }
  if (!args.has("--run")) {
    throw new Error("Use --run for a live public-API search or --verify-snapshot for frozen evidence verification.")
  }

  const ssdRoot = process.env.RESEARCH_SSD_ROOT || DEFAULT_SSD_ROOT
  await access(ssdRoot).catch(() => {
    throw new Error("ResearchSSD bağlı değil, önce SSD'yi tak.")
  })
  const rawBase = process.env.DNA_GAP_RAW_ROOT || (ssdRoot === DEFAULT_SSD_ROOT
    ? DEFAULT_RAW_BASE
    : join(ssdRoot, "Datasets/DNA-Intelligence/source-searches/v3/2026-07-19"))
  const rawBaseRelative = relative(ssdRoot, rawBase)
  if (rawBaseRelative.startsWith("..") || rawBaseRelative.startsWith("/")) {
    throw new Error("dna_gap_raw_root_must_be_inside_research_ssd")
  }
  const protocolSetSha256 = sha256(JSON.stringify(DNA_GAP_SEARCH_PROTOCOLS))
  const executedAt = new Date().toISOString()
  const runId = `dna-gap-search-20260719-${protocolSetSha256.slice(0, 12)}-${executedAt.replace(/[-:.TZ]/g, "")}`
  const runRoot = join(rawBase, runId)
  await mkdir(rawBase, { recursive: true })
  await mkdir(runRoot, { recursive: false })
  const rawManifest: RawManifestEntry[] = []
  const protocolExecutions = []
  for (const [index, protocol] of DNA_GAP_SEARCH_PROTOCOLS.entries()) {
    protocolExecutions.push(await runProtocol(protocol, index, runRoot, rawManifest))
  }

  const sortedManifest = [...rawManifest].sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const totals = protocolExecutions.reduce((sum, entry) => ({
    identifiedReportedAcrossApisNonDeduplicated:
      sum.identifiedReportedAcrossApisNonDeduplicated + entry.counts.identifiedReportedAcrossApisNonDeduplicated,
    downloadedMetadata: sum.downloadedMetadata + entry.counts.downloadedMetadata,
    deduplicatedMetadata: sum.deduplicatedMetadata + entry.counts.deduplicatedMetadata,
    duplicatesRemoved: sum.duplicatesRemoved + entry.counts.duplicatesRemoved,
    titleAbstractScreened: sum.titleAbstractScreened + entry.counts.titleAbstractScreened,
    titleAbstractExcluded: sum.titleAbstractExcluded + entry.counts.titleAbstractExcluded,
    advancedToManualFullTextReview: sum.advancedToManualFullTextReview + entry.counts.advancedToManualFullTextReview,
  }), {
    identifiedReportedAcrossApisNonDeduplicated: 0,
    downloadedMetadata: 0,
    deduplicatedMetadata: 0,
    duplicatesRemoved: 0,
    titleAbstractScreened: 0,
    titleAbstractExcluded: 0,
    advancedToManualFullTextReview: 0,
  })
  const executionStatus = protocolExecutions.every((entry) =>
    entry.executionStatus === "identification_and_title_abstract_screening_executed_full_text_pending")
    ? "identification_and_title_abstract_screening_executed_full_text_pending"
    : protocolExecutions.some((entry) => entry.executionStatus !== "failed_no_screening")
      ? "partial_api_execution_full_text_pending"
      : "failed_no_screening"
  const snapshotWithoutHash = {
    version: SNAPSHOT_VERSION,
    runId,
    frozenForDate: DNA_GAP_PROTOCOL_CUTOFF_DATE,
    executedAt,
    executionStatus,
    protocolSetSha256,
    apiDownloadCapPerProtocolPerApi: API_CAP,
    apiCapBoundary: "Reported identified totals come from each API. Only the first 100 metadata records per protocol/API were downloaded; dedupe and screening counts therefore apply only to downloaded metadata.",
    publicApis: ["NCBI PubMed E-utilities", "Crossref REST API", "OpenAlex REST API"],
    storagePolicy: "research_ssd_required_no_local_fallback",
    rawRootRelative: relative(ssdRoot, runRoot),
    rawManifest: sortedManifest,
    rawArtifactManifestSha256: sha256(JSON.stringify(sortedManifest)),
    protocolExecutions,
    totals: {
      ...totals,
      fullTextAssessed: null,
      includedInEvidenceBase: null,
      releaseReadyClaims: 0,
    },
    boundaries: {
      searchExecutionIsNotEvidenceRelease: true,
      titleAbstractAdvanceIsNotInclusion: true,
      fullTextAssessmentPending: true,
      dnaValidationNotEstablished: true,
      prismaIsReproducibilityReportingNotCertification: true,
    },
  }
  const snapshot = {
    ...snapshotWithoutHash,
    snapshotPayloadSha256: sha256(JSON.stringify(snapshotWithoutHash)),
  }
  await writeFile(REPO_SNAPSHOT_PATH, canonicalJson(snapshot), "utf8")
  await writeFile(join(runRoot, basename(REPO_SNAPSHOT_PATH)), canonicalJson(snapshot), "utf8")
  console.log("DNA gap searches completed", JSON.stringify({
    snapshotPath: relative(process.cwd(), REPO_SNAPSHOT_PATH),
    storagePolicy: snapshot.storagePolicy,
    rawRootRelative: snapshot.rawRootRelative,
    executionStatus,
    protocols: protocolExecutions.length,
    apiCalls: protocolExecutions.reduce((sum, entry) => sum + entry.apiExecutions.length, 0),
    totals: snapshot.totals,
    rawFiles: sortedManifest.length,
    rawArtifactManifestSha256: snapshot.rawArtifactManifestSha256,
    snapshotPayloadSha256: snapshot.snapshotPayloadSha256,
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
