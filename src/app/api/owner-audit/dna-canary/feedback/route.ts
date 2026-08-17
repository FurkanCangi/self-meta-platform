import { NextResponse } from "next/server"
import { z } from "zod"
import { resolveDnaS13CanaryAccess } from "@/lib/dna/chat/s13/canary/access.server"
import {
  buildDnaS13CanaryFeedback,
  deriveDnaS13CanaryTrainingAnnotation,
  hashDnaS13CanaryTester,
} from "@/lib/dna/chat/s13/canary/feedback"
import {
  appendDnaS13CanaryFeedback,
  appendDnaS13CanaryTrainingAnnotation,
  readDnaS13CanarySession,
  writeDnaS13CanarySummary,
} from "@/lib/dna/chat/s13/canary/store.server"
import { summarizeDnaS13Canary } from "@/lib/dna/chat/s13/canary/summary"
import { DNA_S13_CANARY_FEEDBACK_LABELS, DNA_S13_CANARY_LUNA_VALUE_LABELS } from "@/lib/dna/chat/s13/canary/contracts"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"

const schema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/u),
  messageId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/u),
  label: z.enum(DNA_S13_CANARY_FEEDBACK_LABELS),
  note: z.string().trim().max(500).nullable().optional(),
  lunaValue: z.enum(DNA_S13_CANARY_LUNA_VALUE_LABELS).nullable().optional(),
  overallQuality: z.number().int().min(1).max(5).nullable().optional(),
})

export async function POST(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response
  const access = resolveDnaS13CanaryAccess(auth.user.email)
  if (!access.allowed) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

  const rateLimit = await checkRateLimit({
    key: `dna-s13-internal-canary-feedback:${auth.user.id}`,
    limit: 240,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)
  const parsed = await readJsonWithSchema(request, schema)
  if (!parsed.ok) return parsed.response

  try {
    const testerIdHash = hashDnaS13CanaryTester(auth.user.id)
    const before = await readDnaS13CanarySession(access.flags.outputRoot, parsed.data.sessionId)
    const message = before.messages.find((row) => row.messageId === parsed.data.messageId)
    if (!message || message.testerIdHash !== testerIdHash) {
      return NextResponse.json({ ok: false, error: "canary_message_not_found" }, { status: 404 })
    }
    const feedback = buildDnaS13CanaryFeedback({ ...parsed.data, testerIdHash })
    const trainingAnnotation = deriveDnaS13CanaryTrainingAnnotation({ message, feedback })
    await appendDnaS13CanaryFeedback(access.flags.outputRoot, feedback)
    await appendDnaS13CanaryTrainingAnnotation(access.flags.outputRoot, trainingAnnotation)
    const after = await readDnaS13CanarySession(access.flags.outputRoot, parsed.data.sessionId)
    const summary = summarizeDnaS13Canary({
      sessionId: parsed.data.sessionId,
      messages: after.messages,
      feedback: after.feedback,
      trainingAnnotations: after.trainingAnnotations,
      privacyRejectionCount: after.privacyRejections.length,
    })
    await writeDnaS13CanarySummary(access.flags.outputRoot, parsed.data.sessionId, summary)
    return NextResponse.json({ ok: true, feedback, trainingAnnotation, summary })
  } catch (error) {
    const code = error instanceof Error ? error.message : "dna_s13_canary_feedback_failed"
    const privacyBlocked = code === "dna_s13_canary_feedback_note_privacy_blocked"
    if (!privacyBlocked) console.error("[dna-s13-canary] feedback_failed", error)
    return NextResponse.json({ ok: false, error: privacyBlocked ? code : "dna_s13_canary_feedback_failed" }, { status: privacyBlocked ? 422 : 500 })
  }
}
