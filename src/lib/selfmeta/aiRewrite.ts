import OpenAI from "openai"
import { buildAIClinicalPrompt } from "./aiClinicalPrompt"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY tanımlı değil.")
  }

  return new OpenAI({
    apiKey,
    timeout: 180000,
    maxRetries: 2,
  })
}

export async function rewriteClinicalReport(analysis: {
  profileType: string
  globalLevel: string
  priorityDomains: string[]
  domainSummary: Record<string, string>
  anamnezThemes: string[]
}) {
  const prompt = buildAIClinicalPrompt(analysis)
  const client = getClient()

  let lastError: unknown = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client.responses.create({
        model: process.env.OPENAI_REPORT_MODEL || "gpt-5",
        input: prompt,
        max_output_tokens: 3200,
      })

      const text = (res.output_text || "").trim()

      if (!text) {
        throw new Error("AI rewrite boş döndü.")
      }

      return text
    } catch (err) {
      lastError = err
      if (attempt < 3) {
        await sleep(2000 * attempt)
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI rewrite isteği başarısız oldu.")
}
