import "server-only"

import { NextResponse } from "next/server"
import { z, type ZodType } from "zod"

export const jsonObjectSchema = z.record(z.string(), z.unknown())

export type JsonObject = z.infer<typeof jsonObjectSchema>

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

function invalidPayloadResponse(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 })
}

export async function readJsonWithSchema<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return { ok: false, response: invalidPayloadResponse("invalid_json") }
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, response: invalidPayloadResponse("invalid_payload") }
  }

  return { ok: true, data: parsed.data }
}

export function parseJsonTextWithSchema<T>(
  payload: string,
  schema: ZodType<T>,
): ParseResult<T | null> {
  if (!payload.trim()) return { ok: true, data: null }

  let parsedPayload: unknown
  try {
    parsedPayload = JSON.parse(payload)
  } catch {
    return { ok: false, response: invalidPayloadResponse("invalid_json") }
  }

  const parsed = schema.safeParse(parsedPayload)
  if (!parsed.success) {
    return { ok: false, response: invalidPayloadResponse("invalid_payload") }
  }

  return { ok: true, data: parsed.data }
}
