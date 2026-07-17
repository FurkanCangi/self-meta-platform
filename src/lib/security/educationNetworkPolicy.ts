import networkRangeArtifact from "./data/education-network-ranges.json"

export type EducationNetworkPolicyMode = "observe" | "enforce"
export type EducationNetworkSource = "tor-exit" | "apple-private-relay"
export type EducationNetworkPolicyReason =
  | "not_listed"
  | "known_anonymity_network"
  | "known_anonymity_network_observed"
  | "list_stale_observe"
  | "missing_trusted_ip"

export type EducationNetworkRangeArtifact = {
  version: number
  generatedAt: string | null
  maxAgeDays: number
  sources: Array<{
    id: EducationNetworkSource
    name: string
    url: string
    fetchedAt: string | null
    sha256: string | null
    ranges: string[]
  }>
}

export type EducationNetworkPolicyDecision = {
  action: "allow" | "block"
  mode: EducationNetworkPolicyMode
  reason: EducationNetworkPolicyReason
  matchedSource?: EducationNetworkSource
  listAgeDays: number | null
  shouldAudit: boolean
}

type ParsedIp = {
  version: 4 | 6
  bits: 32 | 128
  value: bigint
}

type EducationNetworkPolicyOptions = {
  artifact?: EducationNetworkRangeArtifact
  clientIp?: string | null
  mode?: EducationNetworkPolicyMode
  now?: Date
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

function parseIpv4(value: string): bigint | null {
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

function normalizeIpText(value: string) {
  const first = value.split(",", 1)[0]?.trim() || ""
  if (first.startsWith("[")) {
    const closingBracket = first.indexOf("]")
    if (closingBracket > 0) return first.slice(1, closingBracket)
  }

  const withoutZone = first.split("%", 1)[0] || ""
  const ipv4WithPort = withoutZone.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)
  return ipv4WithPort?.[1] || withoutZone
}

function parseIpv6(value: string): bigint | null {
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

function parseIp(value: string): ParsedIp | null {
  const normalized = normalizeIpText(value)
  if (!normalized) return null

  const mappedIpv4 = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)
  if (mappedIpv4?.[1]) {
    const parsed = parseIpv4(mappedIpv4[1])
    return parsed === null ? null : { version: 4, bits: 32, value: parsed }
  }

  const ipv4 = parseIpv4(normalized)
  if (ipv4 !== null) return { version: 4, bits: 32, value: ipv4 }
  const ipv6 = parseIpv6(normalized)
  if (ipv6 !== null) return { version: 6, bits: 128, value: ipv6 }
  return null
}

export function isIpInCidr(ipAddress: string, cidr: string) {
  const [networkText, prefixText, ...extra] = cidr.trim().split("/")
  if (!networkText || !prefixText || extra.length) return false

  const ip = parseIp(ipAddress)
  const network = parseIp(networkText)
  const prefix = Number(prefixText)
  if (!ip || !network || ip.version !== network.version || !Number.isInteger(prefix)) return false
  if (prefix < 0 || prefix > ip.bits) return false

  const hostBits = BigInt(ip.bits - prefix)
  const one = BigInt(1)
  const mask =
    hostBits === BigInt(ip.bits)
      ? BigInt(0)
      : ((one << BigInt(ip.bits)) - one) ^ ((one << hostBits) - one)
  return (ip.value & mask) === (network.value & mask)
}

export function getTrustedVercelClientIp(headers: Headers) {
  // Vercel overwrites these headers at its edge. Requiring x-vercel-id prevents a
  // caller from turning an arbitrary local/proxied header into a trusted signal.
  if (!headers.get("x-vercel-id")) return null
  const candidate = headers.get("x-vercel-forwarded-for") || headers.get("x-forwarded-for")
  const normalized = candidate ? normalizeIpText(candidate) : ""
  return normalized && parseIp(normalized) ? normalized : null
}

function configuredMode(): EducationNetworkPolicyMode {
  return process.env.EDUCATION_NETWORK_POLICY_MODE === "enforce" ? "enforce" : "observe"
}

function artifactAgeDays(artifact: EducationNetworkRangeArtifact, now: Date) {
  if (!artifact.generatedAt) return null
  const generatedAt = new Date(artifact.generatedAt)
  const ageMilliseconds = now.getTime() - generatedAt.getTime()
  if (!Number.isFinite(generatedAt.getTime()) || ageMilliseconds < 0) return null
  return ageMilliseconds / MILLISECONDS_PER_DAY
}

export function evaluateEducationNetworkPolicy(
  headers: Headers,
  options: EducationNetworkPolicyOptions = {}
): EducationNetworkPolicyDecision {
  const artifact = options.artifact || (networkRangeArtifact as EducationNetworkRangeArtifact)
  const mode = options.mode || configuredMode()
  const now = options.now || new Date()
  const clientIp = options.clientIp === undefined ? getTrustedVercelClientIp(headers) : options.clientIp
  const listAgeDays = artifactAgeDays(artifact, now)
  const hasRanges = artifact.sources.some((source) => source.ranges.length > 0)
  const stale = listAgeDays === null || listAgeDays > artifact.maxAgeDays || !hasRanges

  if (!clientIp || !parseIp(clientIp)) {
    return {
      action: "allow",
      mode,
      reason: "missing_trusted_ip",
      listAgeDays,
      shouldAudit: true,
    }
  }

  const matchedSource = artifact.sources.find((source) =>
    source.ranges.some((range) => isIpInCidr(clientIp, range))
  )?.id

  if (stale) {
    return {
      action: "allow",
      mode,
      reason: "list_stale_observe",
      ...(matchedSource ? { matchedSource } : {}),
      listAgeDays,
      shouldAudit: true,
    }
  }

  if (!matchedSource) {
    return {
      action: "allow",
      mode,
      reason: "not_listed",
      listAgeDays,
      shouldAudit: false,
    }
  }

  if (mode === "enforce") {
    return {
      action: "block",
      mode,
      reason: "known_anonymity_network",
      matchedSource,
      listAgeDays,
      shouldAudit: true,
    }
  }

  return {
    action: "allow",
    mode,
    reason: "known_anonymity_network_observed",
    matchedSource,
    listAgeDays,
    shouldAudit: true,
  }
}
