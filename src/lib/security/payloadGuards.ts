import "server-only"

export const SERVER_CONTROLLED_PAYLOAD_FIELDS = new Set([
  "role",
  "owner_id",
  "user_id",
  "organization_id",
  "entitlement_status",
  "payment_status",
  "plan",
  "is_admin",
  "created_by",
  "deleted_at",
])

export type PayloadGuardResult =
  | { ok: true }
  | { ok: false; fields: string[] }

function collectServerControlledFields(value: unknown, path: string, fields: Set<string>) {
  if (!value || typeof value !== "object") return

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectServerControlledFields(item, `${path}[${index}]`, fields))
    return
  }

  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key
    if (SERVER_CONTROLLED_PAYLOAD_FIELDS.has(key)) {
      fields.add(childPath)
    }
    collectServerControlledFields(childValue, childPath, fields)
  }
}

export function rejectServerControlledFields(payload: unknown): PayloadGuardResult {
  const fields = new Set<string>()
  collectServerControlledFields(payload, "", fields)
  if (fields.size === 0) return { ok: true }
  return { ok: false, fields: Array.from(fields).sort() }
}

export function assertNoServerControlledFields(payload: unknown) {
  const result = rejectServerControlledFields(payload)
  if (!result.ok) {
    throw new Error(`server_controlled_fields_present:${result.fields.join(",")}`)
  }
}
