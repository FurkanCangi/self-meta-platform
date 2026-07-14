import {
  buildLiteratureAlignedSection,
  CATALOG_LITERATURE_SELECTIONS,
  VERIFIED_LITERATURE_SOURCES,
  type LiteratureSource,
} from "../src/lib/dna/literatureNote"

type Scenario = {
  key: string
  ageMonths: number
  analysis: Parameters<typeof buildLiteratureAlignedSection>[0]
}

const TRUSTED_NON_DOI_SOURCES = new Set(["ROSANBALM_MURRAY_2017"])
const DOI_PATTERN = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i

const SCENARIOS: Scenario[] = [
  {
    key: "balanced",
    ageMonths: 40,
    analysis: {
      globalLevel: "Tipik",
      profileType: "Dengeli / Korunmuş Profil",
      weakDomains: [],
      strongDomains: ["Duyusal Regülasyon", "Yürütücü İşlev"],
      matchedDomains: [],
    },
  },
  {
    key: "sensory-emotional",
    ageMonths: 53,
    analysis: {
      globalLevel: "Riskli",
      profileType: "Duyusal-Duygusal Regülasyon Güçlüğü",
      weakDomains: ["Duyusal Regülasyon", "Duygusal Regülasyon"],
      strongDomains: ["Bilişsel Regülasyon"],
      matchedDomains: ["Duyusal Regülasyon", "Duygusal Regülasyon"],
      primaryWeakDomain: "Duyusal Regülasyon",
      externalClinicalFindings: ["Sensory Profile 2 ile uyaran yoğunluğu belirgin"],
      externalTestCategories: ["sensory_processing"],
      primaryExternalTestCategory: "sensory_processing",
    },
  },
  {
    key: "physiological-interoception",
    ageMonths: 31,
    analysis: {
      globalLevel: "Riskli",
      profileType: "Fizyolojik Toparlanma ve İnterosepsiyon Güçlüğü",
      weakDomains: ["Fizyolojik Regülasyon", "İnterosepsiyon"],
      strongDomains: ["Duyusal Regülasyon"],
      matchedDomains: ["Fizyolojik Regülasyon", "İnterosepsiyon"],
      primaryWeakDomain: "İnterosepsiyon",
      therapistInsights: ["Bedensel sinyalleri geç fark ediyor ve toparlanma uzuyor"],
    },
  },
  {
    key: "executive-cognitive",
    ageMonths: 64,
    analysis: {
      globalLevel: "Atipik",
      profileType: "Yürütücü ve Bilişsel Regülasyon Güçlüğü",
      weakDomains: ["Yürütücü İşlev", "Bilişsel Regülasyon"],
      strongDomains: ["Duyusal Regülasyon"],
      matchedDomains: ["Yürütücü İşlev", "Bilişsel Regülasyon"],
      primaryWeakDomain: "Yürütücü İşlev",
      therapistInsights: ["Görevi başlatma, sürdürme ve sıralamada zorlanıyor"],
      externalClinicalFindings: ["BRIEF-P yürütücü işlev bulguları"],
      externalTestCategories: ["executive_behavior"],
      primaryExternalTestCategory: "executive_behavior",
    },
  },
  {
    key: "adaptive-daily-living",
    ageMonths: 58,
    analysis: {
      globalLevel: "Riskli",
      profileType: "Günlük Yaşam ve Regülasyon Güçlüğü",
      weakDomains: ["Fizyolojik Regülasyon", "Duygusal Regülasyon"],
      strongDomains: ["Bilişsel Regülasyon"],
      matchedDomains: ["Fizyolojik Regülasyon"],
      primaryWeakDomain: "Fizyolojik Regülasyon",
      externalTestIds: ["vineland3", "pedi_cat"],
      externalTestCategories: ["adaptive_daily_living"],
      primaryExternalTestCategory: "adaptive_daily_living",
      externalClinicalFindings: ["Günlük yaşam ve özbakım akışında yardım ihtiyacı"],
    },
  },
  {
    key: "social-pragmatic",
    ageMonths: 61,
    analysis: {
      globalLevel: "Riskli",
      profileType: "Sosyal-Pragmatik Regülasyon Güçlüğü",
      weakDomains: ["Duygusal Regülasyon", "Yürütücü İşlev"],
      strongDomains: ["Fizyolojik Regülasyon"],
      matchedDomains: ["Duygusal Regülasyon"],
      primaryWeakDomain: "Duygusal Regülasyon",
      externalTestIds: ["ccc2", "srs2"],
      externalTestCategories: ["social_pragmatic"],
      primaryExternalTestCategory: "social_pragmatic",
      therapistInsights: ["Akran grubunda karşılıklılığı sürdürmekte zorlanıyor"],
    },
  },
  {
    key: "language-communication",
    ageMonths: 47,
    analysis: {
      globalLevel: "Riskli",
      profileType: "Dilsel Talep Altında Regülasyon Güçlüğü",
      weakDomains: ["Bilişsel Regülasyon", "Yürütücü İşlev"],
      strongDomains: ["Duyusal Regülasyon"],
      matchedDomains: ["Bilişsel Regülasyon"],
      primaryWeakDomain: "Bilişsel Regülasyon",
      externalTestIds: ["celf_preschool3", "pls5"],
      externalTestCategories: ["language_communication"],
      primaryExternalTestCategory: "language_communication",
      externalClinicalFindings: ["Dilsel yönerge karmaşıklığı arttığında görevden kopuyor"],
    },
  },
  {
    key: "motor-praxis",
    ageMonths: 50,
    analysis: {
      globalLevel: "Riskli",
      profileType: "Motor Planlama ve Beden Organizasyonu Güçlüğü",
      weakDomains: ["Yürütücü İşlev", "Duyusal Regülasyon"],
      strongDomains: ["Duygusal Regülasyon"],
      matchedDomains: ["Yürütücü İşlev"],
      primaryWeakDomain: "Yürütücü İşlev",
      externalTestIds: ["pdms3", "mabc3", "beery_vmi"],
      externalTestCategories: ["motor_praxis"],
      primaryExternalTestCategory: "motor_praxis",
      externalClinicalFindings: ["Motor planlama, praksi ve koordinasyon bulguları"],
    },
  },
  {
    key: "widespread",
    ageMonths: 69,
    analysis: {
      globalLevel: "Atipik",
      profileType: "Yaygın Regülasyon Güçlüğü",
      weakDomains: [
        "Fizyolojik Regülasyon",
        "Duyusal Regülasyon",
        "Duygusal Regülasyon",
        "Bilişsel Regülasyon",
        "Yürütücü İşlev",
        "İnterosepsiyon",
      ],
      strongDomains: [],
      matchedDomains: ["Duyusal Regülasyon", "Duygusal Regülasyon", "Yürütücü İşlev"],
      primaryWeakDomain: "Duyusal Regülasyon",
      therapistInsights: ["Uyaran arttığında dikkat, duygu ve beden organizasyonu birlikte zorlanıyor"],
      externalClinicalFindings: ["Duyusal, dikkat ve günlük yaşam bulguları aynı örüntüde birleşiyor"],
    },
  },
]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function normalizeDoi(doi: string): string {
  return doi.trim().toLowerCase()
}

function collectInlineCitations(text: string): string[] {
  const haystack = String(text || "")
  return Array.from(
    new Set(
      Array.from(haystack.matchAll(/\(([^()\n]*(?:19|20)\d{2}[^()\n]*)\)/g)).flatMap(
        (match) =>
          String(match[1] || "")
            .split(/\s*;\s*/)
            .map((part) => part.trim())
            .filter((part) => /^[A-ZÇĞİÖŞÜ].*,\s*(?:19|20)\d{2}$/.test(part))
            .map((part) => `(${part})`)
      )
    )
  )
}

function listReferences(text: string): string[] {
  const afterReferences = text.split(/Kaynaklar\s*\(APA 7\)\s*:/i)[1] || ""
  return afterReferences
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function validateRegistry(): void {
  const entries = Object.entries(VERIFIED_LITERATURE_SOURCES)
  assert(entries.length >= 38, `Kaynak havuzu beklenenden küçük: ${entries.length}`)

  const doiOwners = new Map<string, string>()
  const inlineOwners = new Map<string, string>()
  const referenceOwners = new Map<string, string>()

  for (const [key, source] of entries) {
    assert(key === source.id, `Registry anahtarı ile source.id uyuşmuyor: ${key}`)
    assert(source.inlineCitation.trim().length > 0, `${key}: inline citation eksik`)
    assert(source.apaReference.trim().length > 0, `${key}: APA kaynak eksik`)
    assert(source.claimBoundary.trim().length >= 40, `${key}: claimBoundary yetersiz`)
    assert(/^https:\/\//i.test(source.url), `${key}: URL HTTPS değil`)
    assert(/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt), `${key}: verifiedAt geçersiz`)
    assert(!inlineOwners.has(source.inlineCitation), `${key}: yinelenen inline citation`)
    assert(!referenceOwners.has(source.apaReference), `${key}: yinelenen APA kaynak`)
    inlineOwners.set(source.inlineCitation, key)
    referenceOwners.set(source.apaReference, key)

    if (source.publicationYear) {
      assert(
        source.inlineCitation.includes(String(source.publicationYear)),
        `${key}: publicationYear inline citation ile uyuşmuyor`
      )
      assert(
        source.apaReference.includes(`(${source.publicationYear})`),
        `${key}: publicationYear APA kaynak ile uyuşmuyor`
      )
    }

    if (source.pmid) {
      assert(/^\d{6,9}$/.test(source.pmid), `${key}: PMID biçimi geçersiz`)
    }

    if (source.doi) {
      const normalized = normalizeDoi(source.doi)
      assert(DOI_PATTERN.test(source.doi), `${key}: DOI biçimi geçersiz`)
      assert(
        source.apaReference.toLowerCase().includes(normalized),
        `${key}: DOI APA kaynak içinde bulunmuyor`
      )
      assert(!doiOwners.has(normalized), `${key}: DOI ${doiOwners.get(normalized)} ile yineleniyor`)
      doiOwners.set(normalized, key)
    } else {
      assert(TRUSTED_NON_DOI_SOURCES.has(key), `${key}: DOI yok ve güvenilir istisna listesinde değil`)
    }
  }

  for (const [area, sourceIds] of Object.entries(CATALOG_LITERATURE_SELECTIONS)) {
    assert(sourceIds.length >= 4, `${area}: katalog havuzu çok küçük`)
    assert(new Set(sourceIds).size === sourceIds.length, `${area}: yinelenen kaynak kimliği var`)
    for (const sourceId of sourceIds) {
      assert(Boolean(VERIFIED_LITERATURE_SOURCES[sourceId]), `${area}: bilinmeyen kaynak ${sourceId}`)
    }
  }
}

function validateGeneratedSections(): void {
  const allUsedSources = new Set<string>()
  const recentUsedSources = new Set<string>()
  const variantSets = new Set<string>()

  for (const scenario of SCENARIOS) {
    const context = { ageMonths: scenario.ageMonths, stableSeed: scenario.key }
    const section = buildLiteratureAlignedSection(scenario.analysis, context)
    const repeated = buildLiteratureAlignedSection(scenario.analysis, context)
    assert(section, `${scenario.key}: literatür bölümü üretilemedi`)
    assert(repeated, `${scenario.key}: ikinci literatür bölümü üretilemedi`)
    assert(JSON.stringify(section) === JSON.stringify(repeated), `${scenario.key}: çıktı deterministik değil`)

    const body = section.text.split(/Kaynaklar\s*\(APA 7\)\s*:/i)[0] || ""
    const citations = collectInlineCitations(body)
    const references = listReferences(section.text)
    const selectedIds = Array.from(new Set(section.sourceIds))
    const citedIds = citations
      .map((citation) =>
        Object.values(VERIFIED_LITERATURE_SOURCES).find(
          (source) => source.inlineCitation === citation
        )?.id
      )
      .filter((sourceId): sourceId is string => Boolean(sourceId))
    const referencedIds = references
      .map((reference) =>
        Object.values(VERIFIED_LITERATURE_SOURCES).find(
          (source) => source.apaReference === reference
        )?.id
      )
      .filter((sourceId): sourceId is string => Boolean(sourceId))

    assert(citations.length > 0, `${scenario.key}: inline citation yok`)
    assert(references.length > 0, `${scenario.key}: APA kaynak yok`)
    assert(citedIds.length === citations.length, `${scenario.key}: registry dışı inline citation var`)
    assert(referencedIds.length === references.length, `${scenario.key}: registry dışı APA kaynak var`)
    assert(new Set(references).size === references.length, `${scenario.key}: yinelenen APA kaynak var`)

    for (const sourceId of selectedIds) {
      const source = VERIFIED_LITERATURE_SOURCES[sourceId]
      assert(source, `${scenario.key}: bilinmeyen sourceId ${sourceId}`)
      assert(citedIds.includes(sourceId), `${scenario.key}: metinde kullanılmayan sourceId ${sourceId}`)
      assert(references.includes(source.apaReference), `${scenario.key}: kaynakçada eksik sourceId ${sourceId}`)
      allUsedSources.add(sourceId)
      if ((source.publicationYear || 0) >= 2021) recentUsedSources.add(sourceId)
    }

    for (const sourceId of citedIds) {
      assert(selectedIds.includes(sourceId), `${scenario.key}: sourceIds dışında atıf ${sourceId}`)
    }
    for (const sourceId of referencedIds) {
      assert(selectedIds.includes(sourceId), `${scenario.key}: sourceIds dışında kaynak ${sourceId}`)
      assert(citedIds.includes(sourceId), `${scenario.key}: metinde kullanılmayan kaynak ${sourceId}`)
    }

    variantSets.add([...selectedIds].sort().join("|"))
  }

  const baseScenario = SCENARIOS.find((scenario) => scenario.key === "widespread")!
  for (let index = 0; index < 12; index += 1) {
    const variant = buildLiteratureAlignedSection(baseScenario.analysis, {
      ageMonths: baseScenario.ageMonths,
      stableSeed: `coverage-${index}`,
    })
    assert(variant, `coverage-${index}: literatür bölümü üretilemedi`)
    for (const sourceId of variant.sourceIds) {
      allUsedSources.add(sourceId)
      if ((VERIFIED_LITERATURE_SOURCES[sourceId]?.publicationYear || 0) >= 2021) {
        recentUsedSources.add(sourceId)
      }
    }
    variantSets.add([...variant.sourceIds].sort().join("|"))
  }

  assert(allUsedSources.size >= 25, `Kaynak çeşitliliği yetersiz: ${allUsedSources.size}`)
  assert(recentUsedSources.size >= 12, `Güncel kaynak çeşitliliği yetersiz: ${recentUsedSources.size}`)
  assert(variantSets.size >= 8, `Vaka-özel kaynak varyasyonu yetersiz: ${variantSets.size}`)

  console.log(
    `Literatür üretim kapsamı: ${allUsedSources.size} benzersiz kaynak, ` +
      `${recentUsedSources.size} güncel kaynak, ${variantSets.size} deterministik varyant.`
  )
}

function normalizeTokens(value: string): string[] {
  const stopWords = new Set([
    "with",
    "from",
    "that",
    "this",
    "between",
    "through",
    "children",
    "child",
    "review",
    "systematic",
    "meta",
    "analysis",
  ])
  return Array.from(
    new Set(
      value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 4 && !stopWords.has(token))
    )
  )
}

function titleOverlap(title: string, apaReference: string): number {
  const titleTokens = normalizeTokens(title)
  const apaTokens = new Set(normalizeTokens(apaReference))
  if (titleTokens.length === 0) return 1
  return titleTokens.filter((token) => apaTokens.has(token)).length / titleTokens.length
}

async function verifyWithPubMed(source: LiteratureSource): Promise<boolean> {
  if (!source.pmid) return false
  const response = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${source.pmid}&retmode=json`
  )
  if (!response.ok) return false
  const payload = (await response.json()) as {
    result?: Record<
      string,
      | {
          title?: string
          articleids?: Array<{ idtype?: string; value?: string }>
        }
      | string[]
    >
  }
  const record = payload.result?.[source.pmid] as
    | {
        title?: string
        articleids?: Array<{ idtype?: string; value?: string }>
      }
    | undefined
  if (!record?.title || titleOverlap(record.title, source.apaReference) < 0.55) {
    return false
  }
  if (!source.doi) return true
  const pubMedDoi = record.articleids?.find(
    (articleId) => String(articleId.idtype || "").toLowerCase() === "doi"
  )?.value
  return Boolean(pubMedDoi && normalizeDoi(pubMedDoi) === normalizeDoi(source.doi))
}

async function verifyOnline(): Promise<void> {
  let verified = 0
  const failures: string[] = []

  for (const source of Object.values(VERIFIED_LITERATURE_SOURCES)) {
    if (!source.doi) {
      verified += 1
      continue
    }

    try {
      const response = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(source.doi)}`,
        { headers: { "User-Agent": "DNA-Intelligence-Literature-Integrity/1.0" } }
      )
      if (response.ok) {
        const payload = (await response.json()) as {
          message?: { DOI?: string; title?: string[] }
        }
        const remoteDoi = normalizeDoi(String(payload.message?.DOI || ""))
        const remoteTitle = String(payload.message?.title?.[0] || "")
        if (
          remoteDoi === normalizeDoi(source.doi) &&
          remoteTitle &&
          titleOverlap(remoteTitle, source.apaReference) >= 0.55
        ) {
          verified += 1
          continue
        }
      }

      if (await verifyWithPubMed(source)) {
        verified += 1
        continue
      }
      failures.push(source.id)
    } catch {
      if (await verifyWithPubMed(source).catch(() => false)) {
        verified += 1
      } else {
        failures.push(source.id)
      }
    }
  }

  assert(failures.length === 0, `Çevrim içi doğrulanamayan kaynaklar: ${failures.join(", ")}`)
  console.log(`Çevrim içi kaynak doğrulaması: ${verified}/${Object.keys(VERIFIED_LITERATURE_SOURCES).length}`)
}

async function main() {
  validateRegistry()
  validateGeneratedSections()

  if (process.argv.includes("--online")) {
    await verifyOnline()
  }

  console.log(
    `Literatür bütünlük testleri geçti: ${Object.keys(VERIFIED_LITERATURE_SOURCES).length} doğrulanmış kaynak.`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
