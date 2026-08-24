import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/lib/security/rateLimit"
import {
  buildTherapistLocationQuery,
  normalizeGeocodingText,
  selectVerifiedGeocodingCandidate,
  type GeocodingCandidate,
  type TherapistLocationInput,
  type VerifiedTherapistLocation,
} from "@/lib/therapists/geocoding"

const DEFAULT_GEOCODER_URL = "https://nominatim.openstreetmap.org/search"
const DEFAULT_USER_AGENT =
  "DNAIntelligenceTherapistDirectory/1.0 (https://self-meta-platform.vercel.app; self.metacognition.institute@gmail.com)"

type LocationResolution =
  | { status: "verified"; location: VerifiedTherapistLocation; queryHash: string; provider: string }
  | { status: "not_found" | "deferred" | "provider_error"; location: null; queryHash: string; provider: string }

function locationQueryHash(input: TherapistLocationInput) {
  const canonical = [input.country, input.city, input.district]
    .map(normalizeGeocodingText)
    .join("|")
  return createHash("sha256").update(canonical).digest("hex")
}

function isFresh(timestamp: unknown, maxAgeMs: number) {
  const value = Date.parse(String(timestamp || ""))
  return Number.isFinite(value) && Date.now() - value <= maxAgeMs
}

export async function resolveVerifiedTherapistLocation(
  admin: SupabaseClient,
  input: TherapistLocationInput,
): Promise<LocationResolution> {
  const queryHash = locationQueryHash(input)
  const provider = "nominatim"
  const { data: cached } = await admin
    .from("therapist_location_cache")
    .select("status, latitude, longitude, precision, provider_place_id, display_name, verified_at, retry_after")
    .eq("query_hash", queryHash)
    .maybeSingle()

  if (
    cached?.status === "verified" &&
    isFresh(cached.verified_at, 180 * 24 * 60 * 60 * 1000) &&
    Number.isFinite(cached.latitude) &&
    Number.isFinite(cached.longitude) &&
    (cached.precision === "district" || cached.precision === "city")
  ) {
    return {
      status: "verified",
      queryHash,
      provider,
      location: {
        latitude: cached.latitude,
        longitude: cached.longitude,
        precision: cached.precision,
        providerPlaceId: String(cached.provider_place_id || ""),
        displayName: String(cached.display_name || ""),
      },
    }
  }

  if (cached && cached.status !== "verified" && Date.parse(String(cached.retry_after || "")) > Date.now()) {
    return { status: cached.status === "not_found" ? "not_found" : "provider_error", location: null, queryHash, provider }
  }

  const rateLimit = await checkRateLimit({ key: "therapist-geocoding-global", limit: 1, windowMs: 1_100 })
  if (!rateLimit.ok) return { status: "deferred", location: null, queryHash, provider }

  const query = buildTherapistLocationQuery(input)
  const endpoint = new URL(process.env.THERAPIST_GEOCODER_URL || DEFAULT_GEOCODER_URL)
  endpoint.searchParams.set("q", query)
  endpoint.searchParams.set("format", "jsonv2")
  endpoint.searchParams.set("addressdetails", "1")
  endpoint.searchParams.set("namedetails", "1")
  endpoint.searchParams.set("layer", "address")
  endpoint.searchParams.set("limit", "5")

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "accept-language": "tr,en;q=0.8",
        referer: "https://self-meta-platform.vercel.app/",
        "user-agent": process.env.THERAPIST_GEOCODER_USER_AGENT || DEFAULT_USER_AGENT,
      },
      signal: AbortSignal.timeout(7_000),
    })
    if (!response.ok) throw new Error(`geocoder_http_${response.status}`)

    const payload = await response.json()
    const candidates = Array.isArray(payload) ? (payload as GeocodingCandidate[]) : []
    const location = selectVerifiedGeocodingCandidate(input, candidates)
    const now = new Date().toISOString()

    await admin.from("therapist_location_cache").upsert(
      location
        ? {
            query_hash: queryHash,
            country: input.country,
            city: input.city,
            district: input.district || "",
            status: "verified",
            latitude: location.latitude,
            longitude: location.longitude,
            precision: location.precision,
            provider,
            provider_place_id: location.providerPlaceId,
            display_name: location.displayName,
            verified_at: now,
            retry_after: null,
            updated_at: now,
          }
        : {
            query_hash: queryHash,
            country: input.country,
            city: input.city,
            district: input.district || "",
            status: "not_found",
            latitude: null,
            longitude: null,
            precision: null,
            provider,
            provider_place_id: "",
            display_name: "",
            verified_at: null,
            retry_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            updated_at: now,
          },
      { onConflict: "query_hash" },
    )

    return location
      ? { status: "verified", location, queryHash, provider }
      : { status: "not_found", location: null, queryHash, provider }
  } catch (error) {
    console.error("[therapist-directory] geocoding provider unavailable", {
      error: error instanceof Error ? error.message : "unknown",
    })
    return { status: "provider_error", location: null, queryHash, provider }
  }
}
