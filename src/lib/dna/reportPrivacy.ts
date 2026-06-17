const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){10,}/g
const ADDRESS_HINT_PATTERN = /\b(?:mah\.?|mahalle|sok\.?|sokak|cad\.?|cadde|no:?\s*\d+|apartman|daire)\b[^,\n]*/gi

const PII_KEY_PATTERNS = [
  /clientName/i,
  /clientCode/i,
  /adSoyad/i,
  /name$/i,
  /email/i,
  /phone/i,
  /telefon/i,
  /address/i,
  /adres/i,
  /anamnez/i,
  /external_clinical_findings/i,
  /parent_concerns/i,
  /therapist_comments/i,
]

export function redactReportTextForPrivacy(value: unknown): string {
  return String(value || "")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]")
    .replace(ADDRESS_HINT_PATTERN, "[redacted-address]")
}

function shouldRedactKey(key: string): boolean {
  return PII_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

export function redactReportDebugValue(value: unknown, key = ""): unknown {
  if (value == null) return value
  if (typeof value === "string") {
    if (shouldRedactKey(key)) return value ? "[redacted]" : ""
    return redactReportTextForPrivacy(value)
  }
  if (typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) {
    return value.map((item) => redactReportDebugValue(item, key))
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      out[entryKey] = shouldRedactKey(entryKey) ? "[redacted]" : redactReportDebugValue(entryValue, entryKey)
    }
    return out
  }
  return value
}

export function redactReportDebugMeta<T extends Record<string, unknown>>(meta: T): T {
  return redactReportDebugValue(meta) as T
}
