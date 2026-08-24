export type TherapistLocationInput = Readonly<{
  country: string
  city: string
  district?: string
}>

export type GeocodingCandidate = Readonly<{
  lat?: unknown
  lon?: unknown
  display_name?: unknown
  place_id?: unknown
  address?: Record<string, unknown> | null
  namedetails?: Record<string, unknown> | null
}>

export type VerifiedTherapistLocation = Readonly<{
  latitude: number
  longitude: number
  precision: "district" | "city"
  providerPlaceId: string
  displayName: string
}>

const COUNTRY_EQUIVALENTS = [
  ["turkiye", "turkey"],
  ["amerika birlesik devletleri", "united states", "united states of america", "usa", "abd"],
  ["birlesik krallik", "united kingdom", "great britain", "uk"],
  ["almanya", "germany", "deutschland"],
  ["fransa", "france"],
  ["hollanda", "netherlands", "the netherlands", "nederland"],
  ["ispanya", "spain", "espana"],
  ["italya", "italy", "italia"],
] as const

const ADDRESS_PLACE_FIELDS = [
  "city_district",
  "district",
  "borough",
  "suburb",
  "municipality",
  "county",
  "city",
  "town",
  "village",
  "state_district",
  "state",
  "province",
] as const

export function normalizeGeocodingText(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function placeNameMatches(expectedValue: string, actualValue: unknown) {
  const expected = normalizeGeocodingText(expectedValue)
  const actual = normalizeGeocodingText(actualValue)
  if (!expected || !actual) return false
  if (expected === actual) return true
  return ` ${actual} `.includes(` ${expected} `)
}

function countryMatches(expectedCountry: string, candidate: GeocodingCandidate) {
  const actualCountry = normalizeGeocodingText(candidate.address?.country)
  const expected = normalizeGeocodingText(expectedCountry)
  if (placeNameMatches(expected, actualCountry)) return true

  const countryCode = String(candidate.address?.country_code || "").trim().toUpperCase()
  if (countryCode.length === 2) {
    const localizedCountryNames = [countryCode]
    for (const locale of ["tr", "en"]) {
      try {
        localizedCountryNames.push(new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) || "")
      } catch {
        // Unknown region codes are rejected by the remaining checks.
      }
    }
    if (localizedCountryNames.some((name) => placeNameMatches(expected, name))) return true
  }

  return COUNTRY_EQUIVALENTS.some((group) => {
    const normalizedGroup = group.map(normalizeGeocodingText)
    return normalizedGroup.includes(expected) && normalizedGroup.includes(actualCountry)
  })
}

function addressContainsPlace(expected: string, candidate: GeocodingCandidate) {
  const addressValues = ADDRESS_PLACE_FIELDS.map((field) => candidate.address?.[field]).filter(Boolean)
  const namedPlaceValues = Object.entries(candidate.namedetails || {})
    .filter(([key]) => key === "name" || key.startsWith("name:") || key.startsWith("alt_name:"))
    .map(([, value]) => value)
    .filter(Boolean)
  return (
    addressValues.some((value) => placeNameMatches(expected, value)) ||
    namedPlaceValues.some((value) => placeNameMatches(expected, value)) ||
    placeNameMatches(expected, candidate.display_name)
  )
}

function parseCoordinate(value: unknown, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(String(value || ""))
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null
}

export function selectVerifiedGeocodingCandidate(
  input: TherapistLocationInput,
  candidates: readonly GeocodingCandidate[],
): VerifiedTherapistLocation | null {
  const country = normalizeGeocodingText(input.country)
  const city = normalizeGeocodingText(input.city)
  const district = normalizeGeocodingText(input.district)
  if (!country || !city) return null

  for (const candidate of candidates) {
    const latitude = parseCoordinate(candidate.lat, -90, 90)
    const longitude = parseCoordinate(candidate.lon, -180, 180)
    if (latitude === null || longitude === null) continue
    if (!countryMatches(country, candidate)) continue
    if (!addressContainsPlace(city, candidate)) continue
    if (district && !addressContainsPlace(district, candidate)) continue

    return {
      latitude,
      longitude,
      precision: district ? "district" : "city",
      providerPlaceId: String(candidate.place_id || ""),
      displayName: String(candidate.display_name || "").slice(0, 500),
    }
  }

  return null
}

export function buildTherapistLocationQuery(input: TherapistLocationInput) {
  return [input.district, input.city, input.country]
    .map((value) => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(", ")
}
