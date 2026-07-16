import assert from "node:assert/strict"

import { DNA_CHAT_CATALOG_SOURCES } from "../src/lib/dna/chat/catalog"

const REQUEST_TIMEOUT_MS = 15_000
const DOI_CONCURRENCY = 6
const PUBMED_DOI_ALIASES: Readonly<Record<string, readonly string[]>> = {
  MCINTOSH_ET_AL_1999: ["10.1017/s0012162299001267"],
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "SelfMeta-DNA-Catalog-Source-Check/2.0",
        ...(init?.headers || {}),
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function verifyDoi(doi: string) {
  const url = `https://doi.org/api/handles/${encodeURIComponent(doi)}`
  const response = await fetchWithTimeout(url)
  assert.equal(response.ok, true, `DOI çözümlenemedi (${response.status}): ${doi}`)
  const payload = (await response.json()) as { responseCode?: number; handle?: string }
  assert.equal(payload.responseCode, 1, `DOI handle geçersiz: ${doi}`)
  assert.equal(payload.handle?.toLowerCase(), doi.toLowerCase(), `DOI handle eşleşmiyor: ${doi}`)
}

async function verifyDois(dois: readonly string[]) {
  let nextIndex = 0
  const workers = Array.from(
    { length: Math.min(DOI_CONCURRENCY, dois.length) },
    async () => {
      while (nextIndex < dois.length) {
        const index = nextIndex
        nextIndex += 1
        await verifyDoi(dois[index])
      }
    },
  )
  await Promise.all(workers)
}

async function verifyPubmed(pmids: readonly string[]) {
  if (!pmids.length) return new Map<string, { dois: Set<string>; title: string }>()

  const url = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi")
  url.searchParams.set("db", "pubmed")
  url.searchParams.set("id", pmids.join(","))
  url.searchParams.set("retmode", "json")
  url.searchParams.set("tool", "self_meta_dna_catalog")

  const response = await fetchWithTimeout(url.toString())
  assert.equal(response.ok, true, `PubMed doğrulaması başarısız (${response.status})`)
  const payload = (await response.json()) as {
    result?: Record<string, unknown> & { uids?: string[] }
  }
  const uids = new Set(payload.result?.uids || [])
  for (const pmid of pmids) assert.ok(uids.has(pmid), `PubMed kaydı çözümlenemedi: ${pmid}`)

  const metadataByPmid = new Map<string, { dois: Set<string>; title: string }>()
  for (const pmid of pmids) {
    const row = payload.result?.[pmid] as
      | { articleids?: Array<{ idtype?: string; value?: string }>; title?: string }
      | undefined
    const dois = new Set(
      (row?.articleids || [])
        .filter((entry) => entry.idtype?.toLowerCase() === "doi" && entry.value)
        .map((entry) => String(entry.value).toLowerCase()),
    )
    metadataByPmid.set(pmid, { dois, title: String(row?.title || "") })
  }
  return metadataByPmid
}

async function verifyOfficialUrl(url: string) {
  let response = await fetchWithTimeout(url, {
    method: "HEAD",
    redirect: "follow",
    headers: { accept: "application/pdf,text/html;q=0.9,*/*;q=0.5" },
  })
  if (response.status === 403 || response.status === 405) {
    response = await fetchWithTimeout(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "application/pdf,text/html;q=0.9,*/*;q=0.5",
        range: "bytes=0-1023",
      },
    })
  }
  assert.equal(response.ok, true, `Resmî kaynak URL'si çözümlenemedi (${response.status}): ${url}`)
  assert.match(new URL(response.url).protocol, /^https:$/, `Kaynak HTTPS üzerinde kalmalı: ${url}`)
}

function normalizedTitleTokens(value: string) {
  return new Set(
    value
      .toLocaleLowerCase("en-US")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length > 2),
  )
}

function titlesMatch(catalogTitle: string, pubmedTitle: string) {
  const catalog = normalizedTitleTokens(catalogTitle)
  const pubmed = normalizedTitleTokens(pubmedTitle)
  if (!catalog.size || !pubmed.size) return false
  const intersection = Array.from(catalog).filter((token) => pubmed.has(token)).length
  return intersection / Math.min(catalog.size, pubmed.size) >= 0.7
}

async function main() {
  const dois = Array.from(
    new Set(DNA_CHAT_CATALOG_SOURCES.flatMap((source) => source.doi ? [source.doi] : [])),
  ).sort()
  const pmids = Array.from(
    new Set(DNA_CHAT_CATALOG_SOURCES.flatMap((source) => source.pmid ? [source.pmid] : [])),
  ).sort((left, right) => Number(left) - Number(right))
  const urlOnlySources = DNA_CHAT_CATALOG_SOURCES.filter((source) => !source.doi && !source.pmid)

  const [, pubmedMetadata] = await Promise.all([
    verifyDois(dois),
    verifyPubmed(pmids),
    Promise.all(urlOnlySources.map((source) => verifyOfficialUrl(source.url))),
  ])

  for (const source of DNA_CHAT_CATALOG_SOURCES) {
    if (!source.pmid) continue
    const metadata = pubmedMetadata.get(source.pmid)
    assert.ok(metadata, `${source.id}: PubMed üstverisi bulunamadı`)
    assert.ok(
      titlesMatch(source.title, metadata.title),
      `${source.id}: katalog başlığı PubMed ${source.pmid} başlığıyla eşleşmiyor`,
    )
    if (!source.doi) continue
    const pubmedDois = metadata.dois
    if (!pubmedDois.size) continue
    const acceptedDois = new Set([
      source.doi.toLowerCase(),
      ...(PUBMED_DOI_ALIASES[source.id] || []).map((doi) => doi.toLowerCase()),
    ])
    assert.ok(
      Array.from(pubmedDois).some((doi) => acceptedDois.has(doi)),
      `${source.id}: PMID ${source.pmid} ile DOI ${source.doi} eşleşmiyor`,
    )
  }

  console.log(JSON.stringify({
    ok: true,
    checkedAt: new Date().toISOString(),
    sources: DNA_CHAT_CATALOG_SOURCES.length,
    uniqueDois: dois.length,
    uniquePmids: pmids.length,
    doiPmidPairs: DNA_CHAT_CATALOG_SOURCES.filter((source) => source.doi && source.pmid).length,
    verifiedUrlOnlySources: urlOnlySources.length,
    verifiedCoverage: DNA_CHAT_CATALOG_SOURCES.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
