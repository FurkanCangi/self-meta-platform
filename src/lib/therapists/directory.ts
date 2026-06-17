export type TherapistDirectoryProfile = {
  userId: string
  firstName: string
  lastName: string
  profession: string
  title: string
  workplace: string
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
}

export type PublicTherapist = {
  id: string
  fullName: string
  firstName: string
  lastName: string
  profession: string
  title: string
  workplace: string
  city: string
  district: string
  phone: string
  email: string
  shortAddress: string
  specialties: string[]
}

const MAX_TEXT_LENGTH = 220
const MAX_LONG_TEXT_LENGTH = 900

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

export function normalizeDirectoryInput(input: Record<string, unknown>) {
  return {
    first_name: cleanText(input.firstName),
    last_name: cleanText(input.lastName),
    profession: cleanText(input.profession),
    title: cleanText(input.title),
    workplace: cleanText(input.workplace),
    city: cleanText(input.city),
    district: cleanText(input.district),
    public_phone: cleanPhone(input.publicPhone),
    public_email: cleanEmail(input.publicEmail),
    short_address: cleanText(input.shortAddress, 320),
    specialties: cleanText(input.specialties, MAX_LONG_TEXT_LENGTH),
    public_listing_enabled: Boolean(input.publicListingEnabled),
  }
}

export function mapDirectoryRow(row: any): TherapistDirectoryProfile {
  return {
    userId: String(row?.user_id || ""),
    firstName: String(row?.first_name || ""),
    lastName: String(row?.last_name || ""),
    profession: String(row?.profession || ""),
    title: String(row?.title || ""),
    workplace: String(row?.workplace || ""),
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
  }
}

export function mapPublicTherapist(row: any): PublicTherapist {
  const firstName = String(row?.first_name || "").trim()
  const lastName = String(row?.last_name || "").trim()
  const specialties = String(row?.specialties || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6)

  return {
    id: String(row?.user_id || ""),
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" ") || "DNA Uzmanı",
    profession: String(row?.profession || "").trim(),
    title: String(row?.title || "").trim(),
    workplace: String(row?.workplace || "").trim(),
    city: String(row?.city || "").trim(),
    district: String(row?.district || "").trim(),
    phone: String(row?.public_phone || "").trim(),
    email: String(row?.public_email || "").trim(),
    shortAddress: String(row?.short_address || "").trim(),
    specialties,
  }
}
