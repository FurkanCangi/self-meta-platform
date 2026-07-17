import { createHash } from "node:crypto"
import { rename, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  type EducationNetworkRangeArtifact,
  type EducationNetworkSource,
} from "../src/lib/security/educationNetworkPolicy"

// Apple'ın resmi dosyası 2026-07 itibarıyla 12 MB'ı aşıyor. Sınır, hatalı ya
// da beklenmedik derecede büyük bir yanıtın belleği tüketmesini önlemeye devam
// ederken iki resmi kaynağın güncel boyutlarına güvenli pay bırakır.
const MAX_SOURCE_BYTES = 32 * 1024 * 1024
const OUTPUT_PATH = path.join(process.cwd(), "src/lib/security/data/education-network-ranges.json")

type ParsedNetwork = {
  version: 4 | 6
  bits: 32 | 128
  network: bigint
  prefix: number
}

const sources: Array<{
  id: EducationNetworkSource
  name: string
  url: string
  minimumRanges: number
  parse: (body: string) => string[]
}> = [
  {
    id: "tor-exit",
    name: "Tor Project exit relay list",
    url: "https://check.torproject.org/torbulkexitlist",
    minimumRanges: 500,
    parse: parseTorExitList,
  },
  {
    id: "apple-private-relay",
    name: "Apple iCloud Private Relay egress ranges",
    url: "https://mask-api.icloud.com/egress-ip-ranges.csv",
    minimumRanges: 5_000,
    parse: parseApplePrivateRelayList,
  },
]

function fullPrefix(address: string) {
  return address.includes(":") ? 128 : 32
}

function parseIpv4(value: string) {
  const parts = value.split(".")
  if (parts.length !== 4) return null

  let parsed = BigInt(0)
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    parsed = (parsed << BigInt(8)) | BigInt(octet)
  }
  return parsed
}

function parseIpv6(value: string) {
  let normalized = value.toLowerCase()
  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":")
    if (lastColon < 0) return null
    const ipv4 = parseIpv4(normalized.slice(lastColon + 1))
    if (ipv4 === null) return null
    const high = Number((ipv4 >> BigInt(16)) & BigInt(0xffff)).toString(16)
    const low = Number(ipv4 & BigInt(0xffff)).toString(16)
    normalized = `${normalized.slice(0, lastColon)}:${high}:${low}`
  }

  const halves = normalized.split("::")
  if (halves.length > 2) return null

  const left = halves[0] ? halves[0].split(":") : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  if (halves.length === 1 && left.length !== 8) return null
  if (left.length + right.length > 8) return null

  const zeroCount = halves.length === 2 ? 8 - left.length - right.length : 0
  if (halves.length === 2 && zeroCount < 1) return null
  const groups = [...left, ...Array.from({ length: zeroCount }, () => "0"), ...right]
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null

  return groups.reduce(
    (result, group) => (result << BigInt(16)) | BigInt(Number.parseInt(group, 16)),
    BigInt(0)
  )
}

function parseNetwork(value: string): ParsedNetwork | null {
  const [address, prefixText, ...extra] = value.trim().split("/")
  if (!address || !prefixText || extra.length) return null

  const version = address.includes(":") ? 6 : 4
  const bits = version === 6 ? 128 : 32
  const parsed = version === 6 ? parseIpv6(address) : parseIpv4(address)
  const prefix = Number(prefixText)
  if (parsed === null || !Number.isInteger(prefix) || prefix < 0 || prefix > bits) return null

  const hostBits = BigInt(bits - prefix)
  const allBits = (BigInt(1) << BigInt(bits)) - BigInt(1)
  const mask = hostBits === BigInt(bits) ? BigInt(0) : allBits ^ ((BigInt(1) << hostBits) - BigInt(1))
  return { version, bits, network: parsed & mask, prefix }
}

function formatIpv4(value: bigint) {
  return [24, 16, 8, 0].map((shift) => Number((value >> BigInt(shift)) & BigInt(0xff))).join(".")
}

function formatIpv6(value: bigint) {
  const groups = Array.from({ length: 8 }, (_, index) =>
    Number((value >> BigInt((7 - index) * 16)) & BigInt(0xffff)).toString(16)
  )

  let bestStart = -1
  let bestLength = 0
  for (let index = 0; index < groups.length; ) {
    if (groups[index] !== "0") {
      index += 1
      continue
    }
    let end = index + 1
    while (end < groups.length && groups[end] === "0") end += 1
    if (end - index > bestLength) {
      bestStart = index
      bestLength = end - index
    }
    index = end
  }

  if (bestLength < 2) return groups.join(":")
  const before = groups.slice(0, bestStart).join(":")
  const after = groups.slice(bestStart + bestLength).join(":")
  return `${before}::${after}`
}

function formatNetwork(network: ParsedNetwork) {
  const address = network.version === 4 ? formatIpv4(network.network) : formatIpv6(network.network)
  return `${address}/${network.prefix}`
}

function networkCoverage(network: ParsedNetwork) {
  return BigInt(1) << BigInt(network.bits - network.prefix)
}

function collapseCidrs(values: string[]) {
  const parsedValues = values.map(parseNetwork)
  if (parsedValues.some((network) => !network)) {
    throw new Error("Resmi ağ listesi geçersiz CIDR içeriyor; mevcut dosya korunuyor")
  }
  const ordered = (parsedValues as ParsedNetwork[]).sort(
      (left, right) =>
        left.version - right.version ||
        (left.network < right.network ? -1 : left.network > right.network ? 1 : left.prefix - right.prefix)
    )

  // Ağ başlangıcına göre sıralandığında bir önceki aralığın bitişinden önce
  // başlayan CIDR onun içinde kalır. Böylece tekrar ve kapsanan alt ağlar tek
  // geçişte ayıklanır.
  const nonOverlapping: ParsedNetwork[] = []
  let previousVersion: 4 | 6 | null = null
  let coveredUntil = BigInt(-1)
  for (const network of ordered) {
    if (network.version !== previousVersion) {
      previousVersion = network.version
      coveredUntil = BigInt(-1)
    }
    if (network.network <= coveredUntil) continue
    nonOverlapping.push(network)
    coveredUntil = network.network + networkCoverage(network) - BigInt(1)
  }

  const coverageBefore = nonOverlapping.reduce(
    (total, network) => total + networkCoverage(network),
    BigInt(0)
  )

  // Yalnızca aynı büyüklükte, art arda gelen ve ortak üst ağ sınırına hizalı
  // iki kardeş CIDR birleştirilir. Ardışık birleşmeler yığının son iki öğesiyle
  // tekrar denenir; kapsam genişlemez ve yanlış pozitif IP eklenmez.
  const collapsed: ParsedNetwork[] = []
  for (const network of nonOverlapping) {
    collapsed.push(network)
    while (collapsed.length >= 2) {
      const right = collapsed[collapsed.length - 1]!
      const left = collapsed[collapsed.length - 2]!
      if (left.version !== right.version || left.prefix !== right.prefix || left.prefix === 0) break

      const blockSize = networkCoverage(left)
      if (left.network + blockSize !== right.network) break
      if (left.network % (blockSize * BigInt(2)) !== BigInt(0)) break

      collapsed.splice(collapsed.length - 2, 2, { ...left, prefix: left.prefix - 1 })
    }
  }

  const coverageAfter = collapsed.reduce(
    (total, network) => total + networkCoverage(network),
    BigInt(0)
  )
  if (coverageAfter !== coverageBefore) {
    throw new Error("CIDR birleştirme doğrulaması başarısız: IP kapsamı değişti")
  }

  return collapsed.map(formatNetwork)
}

function parseTorExitList(body: string) {
  return collapseCidrs(
    body
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((address) => `${address}/${fullPrefix(address)}`)
  )
}

function parseApplePrivateRelayList(body: string) {
  return collapseCidrs(
    body
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.split(",", 1)[0]?.trim() || "")
      .filter(Boolean)
  )
}

async function fetchText(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: { "user-agent": "SelfMetaAI-EducationNetworkListUpdater/1.0" },
    })
    if (!response.ok) throw new Error(`${url} HTTP ${response.status}`)

    const declaredLength = Number(response.headers.get("content-length"))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
      throw new Error(`${url} boş veya izin verilen boyuttan büyük`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error(`${url} yanıt gövdesi okunamadı`)
    const chunks: Uint8Array[] = []
    let receivedBytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value.byteLength
      if (receivedBytes > MAX_SOURCE_BYTES) {
        await reader.cancel()
        throw new Error(`${url} izin verilen boyuttan büyük`)
      }
      chunks.push(value)
    }
    if (!receivedBytes) throw new Error(`${url} boş yanıt döndürdü`)

    const body = Buffer.concat(chunks, receivedBytes).toString("utf8")
    if (!body.trim()) throw new Error(`${url} boş yanıt döndürdü`)
    return body
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const write = process.argv.includes("--write")
  const generatedAt = new Date().toISOString()
  const artifactSources: EducationNetworkRangeArtifact["sources"] = []

  for (const source of sources) {
    const body = await fetchText(source.url)
    const ranges = source.parse(body)
    if (ranges.length < source.minimumRanges) {
      throw new Error(`${source.name}: ${ranges.length} aralık doğrulandı; en az ${source.minimumRanges} bekleniyordu`)
    }
    artifactSources.push({
      id: source.id,
      name: source.name,
      url: source.url,
      fetchedAt: generatedAt,
      sha256: createHash("sha256").update(body).digest("hex"),
      ranges,
    })
  }

  const artifact: EducationNetworkRangeArtifact = {
    version: 1,
    generatedAt,
    maxAgeDays: 30,
    sources: artifactSources,
  }
  const output = `${JSON.stringify(artifact, null, 2)}\n`

  if (!write) {
    console.log("Kuru çalışma başarılı; dosya değiştirilmedi.")
    for (const source of artifact.sources) console.log(`${source.name}: ${source.ranges.length} aralık`)
    console.log("Yazmak için: npm run security:update-network-ranges")
    return
  }

  const temporaryPath = `${OUTPUT_PATH}.tmp`
  await writeFile(temporaryPath, output, { encoding: "utf8", mode: 0o600 })
  await rename(temporaryPath, OUTPUT_PATH)
  console.log(`${OUTPUT_PATH} atomik olarak güncellendi.`)
  for (const source of artifact.sources) console.log(`${source.name}: ${source.ranges.length} doğrulanmış CIDR`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
