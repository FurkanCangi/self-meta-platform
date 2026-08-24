export type TherapistDirectoryProfile = {
  userId: string
  firstName: string
  lastName: string
  profession: string
  title: string
  workplace: string
  country: string
  city: string
  district: string
  publicPhone: string
  publicEmail: string
  shortAddress: string
  specialties: string
  educationCompletedAt: string | null
  publicListingEnabled: boolean
  publicationStatus: "pending" | "approved" | "hidden" | "rejected"
  updatedAt: string | null
  latitude: number | null
  longitude: number | null
  locationPrecision: "district" | "city" | null
  locationVerifiedAt: string | null
}

export type PublicTherapist = {
  id: string
  fullName: string
  firstName: string
  lastName: string
  profession: string
  title: string
  workplace: string
  country: string
  city: string
  district: string
  phone: string
  email: string
  shortAddress: string
  specialties: string[]
  latitude: number | null
  longitude: number | null
  locationPrecision: "district" | "city" | null
}

const MAX_TEXT_LENGTH = 220
const MAX_LONG_TEXT_LENGTH = 900

export const MAX_DIRECTORY_SPECIALTIES = 10
export const MAX_DIRECTORY_SPECIALTY_LENGTH = 80

export const DIRECTORY_REQUIRED_FIELD_LABELS: Record<string, string> = {
  firstName: "ad",
  lastName: "soyad",
  profession: "meslek",
  workplace: "kurum adı",
  country: "ülke",
  city: "şehir",
  shortAddress: "adres",
  location: "doğrulanabilir ülke/şehir/ilçe",
  specialties: "en az bir uzmanlık alanı",
}

function cleanText(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

function cleanEmail(value: unknown) {
  return cleanText(value, 180).toLowerCase()
}

function cleanPhone(value: unknown) {
  return cleanText(value, 80).replace(/[^\d+()\s-]/g, "")
}

export function parseDirectorySpecialties(value: unknown) {
  const candidates = Array.isArray(value) ? value : String(value || "").split(/[,;\n]/)
  const seen = new Set<string>()

  return candidates.reduce<string[]>((items, candidate) => {
    const cleaned = cleanText(candidate, MAX_DIRECTORY_SPECIALTY_LENGTH)
    const key = cleaned.toLocaleLowerCase("tr-TR")
    if (!cleaned || seen.has(key) || items.length >= MAX_DIRECTORY_SPECIALTIES) return items

    seen.add(key)
    items.push(cleaned)
    return items
  }, [])
}

export function hasTooManyDirectorySpecialties(value: unknown) {
  const candidates = Array.isArray(value) ? value : String(value || "").split(/[,;\n]/)
  return candidates.map((item) => cleanText(item, MAX_DIRECTORY_SPECIALTY_LENGTH)).filter(Boolean).length > MAX_DIRECTORY_SPECIALTIES
}

export function normalizeDirectoryInput(input: Record<string, unknown>) {
  return {
    first_name: cleanText(input.firstName),
    last_name: cleanText(input.lastName),
    profession: cleanText(input.profession),
    title: cleanText(input.title),
    workplace: cleanText(input.workplace),
    country: cleanText(input.country),
    city: cleanText(input.city),
    district: cleanText(input.district),
    public_phone: cleanPhone(input.publicPhone),
    public_email: cleanEmail(input.publicEmail),
    short_address: cleanText(input.shortAddress, 320),
    specialties: cleanText(parseDirectorySpecialties(input.specialties).join(", "), MAX_LONG_TEXT_LENGTH),
    public_listing_enabled: Boolean(input.publicListingEnabled),
  }
}

export function getDirectoryPublicationMissingFields(input: ReturnType<typeof normalizeDirectoryInput>) {
  const missing: string[] = []
  if (!input.first_name) missing.push("firstName")
  if (!input.last_name) missing.push("lastName")
  if (!input.profession) missing.push("profession")
  if (!input.workplace) missing.push("workplace")
  if (!input.country) missing.push("country")
  if (!input.city) missing.push("city")
  if (!input.short_address) missing.push("shortAddress")
  if (parseDirectorySpecialties(input.specialties).length === 0) missing.push("specialties")
  return missing
}

export function mapDirectoryRow(row: any): TherapistDirectoryProfile {
  return {
    userId: String(row?.user_id || ""),
    firstName: String(row?.first_name || ""),
    lastName: String(row?.last_name || ""),
    profession: String(row?.profession || ""),
    title: String(row?.title || ""),
    workplace: String(row?.workplace || ""),
    country: String(row?.country || ""),
    city: String(row?.city || ""),
    district: String(row?.district || ""),
    publicPhone: String(row?.public_phone || ""),
    publicEmail: String(row?.public_email || ""),
    shortAddress: String(row?.short_address || ""),
    specialties: String(row?.specialties || ""),
    educationCompletedAt: row?.education_completed_at ? String(row.education_completed_at) : null,
    publicListingEnabled: Boolean(row?.public_listing_enabled),
    publicationStatus: (row?.publication_status || "pending") as TherapistDirectoryProfile["publicationStatus"],
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
    latitude: readCoordinate(row?.location_latitude, -90, 90),
    longitude: readCoordinate(row?.location_longitude, -180, 180),
    locationPrecision: row?.location_precision === "district" || row?.location_precision === "city" ? row.location_precision : null,
    locationVerifiedAt: row?.location_verified_at ? String(row.location_verified_at) : null,
  }
}

export function mapPublicTherapist(row: any): PublicTherapist {
  const firstName = String(row?.first_name || "").trim()
  const lastName = String(row?.last_name || "").trim()
  const specialties = parseDirectorySpecialties(row?.specialties)

  return {
    id: String(row?.user_id || ""),
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" ") || "DNA Uzmanı",
    profession: String(row?.profession || "").trim(),
    title: String(row?.title || "").trim(),
    workplace: String(row?.workplace || "").trim(),
    country: String(row?.country || "").trim(),
    city: String(row?.city || "").trim(),
    district: String(row?.district || "").trim(),
    phone: String(row?.public_phone || "").trim(),
    email: String(row?.public_email || "").trim(),
    shortAddress: String(row?.short_address || "").trim(),
    specialties,
    latitude: readCoordinate(row?.location_latitude, -90, 90),
    longitude: readCoordinate(row?.location_longitude, -180, 180),
    locationPrecision: row?.location_precision === "district" || row?.location_precision === "city" ? row.location_precision : null,
  }
}

export function isPublicTherapistComplete(therapist: PublicTherapist) {
  return Boolean(
    therapist.firstName &&
      therapist.lastName &&
      therapist.profession &&
      therapist.workplace &&
      therapist.country &&
      therapist.city &&
      therapist.shortAddress &&
      therapist.specialties.length > 0 &&
      therapist.latitude !== null &&
      therapist.longitude !== null &&
      therapist.locationPrecision,
  )
}

function readCoordinate(value: unknown, minimum: number, maximum: number) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(String(value ?? ""))
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null
}
