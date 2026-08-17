import { createHash } from "node:crypto"

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  )
}

export function stableDnaS13Json(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

export function hashDnaS13Artifact(value: unknown) {
  return createHash("sha256").update(stableDnaS13Json(value)).digest("hex")
}
