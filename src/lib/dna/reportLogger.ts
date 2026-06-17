type LogFields = Record<string, unknown>

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|email|phone|tel|address|adres|anamnez|report|rapor|client|danisan|danışan|child|cocuk|çocuk|name|isim|ad_soyad|full_name|notes?|notlar?|clinical|session)/i

function isEnabled(value?: string) {
  return String(value || "").trim().toLowerCase() === "true"
}

export function isAiReportDebugEnabled() {
  return isEnabled(process.env.OPENAI_REPORT_DEBUG) || isEnabled(process.env.DNA_REPORT_DEBUG)
}

function redactLogValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) return "[redacted]"

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item, index) => redactLogValue(`${key}.${index}`, item))
  }

  if (value && typeof value === "object") {
    const out: LogFields = {}
    for (const [childKey, childValue] of Object.entries(value as LogFields)) {
      out[childKey] = redactLogValue(childKey, childValue)
    }
    return out
  }

  if (typeof value === "string" && value.length > 160) {
    return `${value.slice(0, 160)}...[truncated]`
  }

  return value
}

export function redactLogFields(fields: LogFields) {
  const out: LogFields = {}
  for (const [key, value] of Object.entries(fields || {})) {
    out[key] = redactLogValue(key, value)
  }
  return out
}

export function logAiReportDebug(event: string, fields: LogFields = {}) {
  if (!isAiReportDebugEnabled()) return
  console.info("[AI-REPORT]", event, redactLogFields(fields))
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    const candidate = error as Error & {
      status?: unknown
      code?: unknown
      type?: unknown
    }

    return {
      name: error.name,
      message: error.message,
      status: typeof candidate.status === "number" || typeof candidate.status === "string" ? candidate.status : undefined,
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      type: typeof candidate.type === "string" ? candidate.type : undefined,
    }
  }

  return {
    message: String(error || "unknown_error"),
  }
}

export function logAiReportError(event: string, error: unknown, fields: LogFields = {}) {
  console.error("[AI-REPORT]", event, {
    ...redactLogFields(fields),
    error: safeError(error),
  })
}
