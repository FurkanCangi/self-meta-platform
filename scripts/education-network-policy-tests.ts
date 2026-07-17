import {
  evaluateEducationNetworkPolicy,
  getTrustedVercelClientIp,
  isIpInCidr,
  type EducationNetworkRangeArtifact,
} from "../src/lib/security/educationNetworkPolicy"
import bundledArtifactJson from "../src/lib/security/data/education-network-ranges.json"

const failures: string[] = []
let checkCount = 0

function check(name: string, condition: unknown) {
  checkCount += 1
  if (!condition) failures.push(name)
}

const bundledArtifact = bundledArtifactJson as EducationNetworkRangeArtifact
const bundledTor = bundledArtifact.sources.find((source) => source.id === "tor-exit")
const bundledApple = bundledArtifact.sources.find((source) => source.id === "apple-private-relay")
const generatedAt = bundledArtifact.generatedAt ? new Date(bundledArtifact.generatedAt) : null

check("bundled artifact has a valid generation time", Boolean(generatedAt && Number.isFinite(generatedAt.getTime())))
check(
  "bundled artifact uses only the official sources",
  bundledArtifact.sources.length === 2 &&
    bundledTor?.url === "https://check.torproject.org/torbulkexitlist" &&
    bundledApple?.url === "https://mask-api.icloud.com/egress-ip-ranges.csv"
)
check("bundled Tor ranges are populated", (bundledTor?.ranges.length || 0) >= 100)
check("bundled Apple ranges are populated", (bundledApple?.ranges.length || 0) >= 1_000)
check(
  "bundled source hashes are SHA-256 values",
  bundledArtifact.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256 || ""))
)
check(
  "bundled CIDRs are syntactically usable",
  bundledArtifact.sources.every((source) =>
    source.ranges.every((range) => isIpInCidr(range.split("/", 1)[0] || "", range))
  )
)

if (bundledTor?.ranges[0] && generatedAt) {
  const bundledTorDecision = evaluateEducationNetworkPolicy(new Headers(), {
    artifact: bundledArtifact,
    clientIp: bundledTor.ranges[0].split("/", 1)[0],
    mode: "observe",
    now: generatedAt,
  })
  check(
    "bundled Tor range is observed",
    bundledTorDecision.reason === "known_anonymity_network_observed" &&
      bundledTorDecision.matchedSource === "tor-exit"
  )
} else {
  check("bundled Tor range is observed", false)
}

const freshArtifact: EducationNetworkRangeArtifact = {
  version: 1,
  generatedAt: "2026-07-15T00:00:00.000Z",
  maxAgeDays: 30,
  sources: [
    {
      id: "tor-exit",
      name: "Tor fixture",
      url: "https://check.torproject.org/torbulkexitlist",
      fetchedAt: "2026-07-15T00:00:00.000Z",
      sha256: "fixture",
      ranges: ["198.51.100.17/32", "2001:db8:42::/48"],
    },
    {
      id: "apple-private-relay",
      name: "Apple fixture",
      url: "https://mask-api.icloud.com/egress-ip-ranges.csv",
      fetchedAt: "2026-07-15T00:00:00.000Z",
      sha256: "fixture",
      ranges: ["203.0.113.0/24", "2001:db8:99::/48"],
    },
  ],
}

check("IPv4 exact CIDR", isIpInCidr("198.51.100.17", "198.51.100.17/32"))
check("IPv4 subnet CIDR", isIpInCidr("203.0.113.99", "203.0.113.0/24"))
check("IPv4 outside CIDR", !isIpInCidr("203.0.114.1", "203.0.113.0/24"))
check("IPv6 compressed CIDR", isIpInCidr("2001:db8:42::abcd", "2001:db8:42::/48"))
check("IPv6 outside CIDR", !isIpInCidr("2001:db8:43::1", "2001:db8:42::/48"))
check("IPv4-mapped IPv6", isIpInCidr("::ffff:203.0.113.4", "203.0.113.0/24"))
check("invalid IP rejected", !isIpInCidr("not-an-ip", "203.0.113.0/24"))

const vercelHeaders = new Headers({
  "x-vercel-id": "fra1::example",
  "x-vercel-forwarded-for": "203.0.113.8",
})
const spoofableHeaders = new Headers({ "x-forwarded-for": "203.0.113.8" })
check("trusted Vercel IP read", getTrustedVercelClientIp(vercelHeaders) === "203.0.113.8")
check("untrusted forwarded IP ignored", getTrustedVercelClientIp(spoofableHeaders) === null)

const now = new Date("2026-07-17T00:00:00.000Z")
const observed = evaluateEducationNetworkPolicy(new Headers(), {
  artifact: freshArtifact,
  clientIp: "203.0.113.8",
  mode: "observe",
  now,
})
check(
  "known range observed without blocking",
  observed.action === "allow" &&
    observed.reason === "known_anonymity_network_observed" &&
    observed.matchedSource === "apple-private-relay" &&
    observed.shouldAudit
)

const enforced = evaluateEducationNetworkPolicy(new Headers(), {
  artifact: freshArtifact,
  clientIp: "198.51.100.17",
  mode: "enforce",
  now,
})
check(
  "known range blocked in enforce mode",
  enforced.action === "block" && enforced.reason === "known_anonymity_network" && enforced.matchedSource === "tor-exit"
)

const ordinary = evaluateEducationNetworkPolicy(new Headers(), {
  artifact: freshArtifact,
  clientIp: "192.0.2.9",
  mode: "enforce",
  now,
})
check("unknown network allowed", ordinary.action === "allow" && ordinary.reason === "not_listed" && !ordinary.shouldAudit)

const stale = evaluateEducationNetworkPolicy(new Headers(), {
  artifact: { ...freshArtifact, generatedAt: "2026-05-01T00:00:00.000Z" },
  clientIp: "198.51.100.17",
  mode: "enforce",
  now,
})
check("stale match fails open", stale.action === "allow" && stale.reason === "list_stale_observe" && stale.shouldAudit)

const missingIp = evaluateEducationNetworkPolicy(new Headers(), {
  artifact: freshArtifact,
  mode: "enforce",
  now,
})
check("missing trusted IP fails open", missingIp.action === "allow" && missingIp.reason === "missing_trusted_ip")

if (failures.length) {
  console.error(`Education network policy tests failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Education network policy tests passed (${checkCount}/${checkCount}).`)
