import { NextResponse } from "next/server"
import { z } from "zod"
import { createDnaChatLunaSafetyIdentifier } from "@/lib/dna/chat/lunaServer"
import { resolveDnaS13CanaryAccess } from "@/lib/dna/chat/s13/canary/access.server"
import { hashDnaS13CanaryTester } from "@/lib/dna/chat/s13/canary/feedback"
import { DnaS13CanaryPrivacyError, runDnaS13CanaryMessage } from "@/lib/dna/chat/s13/canary/runner.server"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"

const schema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/u),
  question: z.string().trim().min(2).max(600),
  responseDepth: z.enum(["short", "standard", "deep"]).default("standard"),
  conversationTopicIds: z.array(z.string().trim().min(2).max(180)).max(2).default([]),
})

export async function POST(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response
  const access = resolveDnaS13CanaryAccess(auth.user.email)
  if (!access.allowed) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

  const rateLimit = await checkRateLimit({
    key: `dna-s13-internal-canary-message:${auth.user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)
  const parsed = await readJsonWithSchema(request, schema)
  if (!parsed.ok) return parsed.response

  try {
    const message = await runDnaS13CanaryMessage({
      flags: access.flags,
      sessionId: parsed.data.sessionId,
      testerIdHash: hashDnaS13CanaryTester(auth.user.id),
      question: parsed.data.question,
      responseDepth: parsed.data.responseDepth,
      conversationTopicIds: parsed.data.conversationTopicIds,
      safetyIdentifier: createDnaChatLunaSafetyIdentifier(auth.user.id),
    })
    return NextResponse.json({ ok: true, message: { ...message, provenance: null } })
  } catch (error) {
    if (error instanceof DnaS13CanaryPrivacyError) {
      return NextResponse.json({ ok: false, error: error.code }, { status: 422 })
    }
    console.error("[dna-s13-canary] message_failed", error)
    return NextResponse.json({ ok: false, error: "dna_s13_canary_message_failed" }, { status: 500 })
  }
}
