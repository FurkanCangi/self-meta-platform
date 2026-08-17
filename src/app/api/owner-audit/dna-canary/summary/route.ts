import { NextResponse } from "next/server"
import { resolveDnaS13CanaryAccess } from "@/lib/dna/chat/s13/canary/access.server"
import { hashDnaS13CanaryTester } from "@/lib/dna/chat/s13/canary/feedback"
import { readDnaS13CanarySession, writeDnaS13CanarySummary } from "@/lib/dna/chat/s13/canary/store.server"
import { summarizeDnaS13Canary } from "@/lib/dna/chat/s13/canary/summary"
import { requireConfirmedUser } from "@/lib/security/apiGuards"

export async function GET(request: Request) {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth.response
  const access = resolveDnaS13CanaryAccess(auth.user.email)
  if (!access.allowed) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  const sessionId = new URL(request.url).searchParams.get("sessionId") || ""
  if (!/^[a-zA-Z0-9_-]{8,80}$/u.test(sessionId)) {
    return NextResponse.json({ ok: false, error: "invalid_session_id" }, { status: 400 })
  }
  const session = await readDnaS13CanarySession(access.flags.outputRoot, sessionId)
  const testerIdHash = hashDnaS13CanaryTester(auth.user.id)
  const ownMessages = session.messages.filter((row) => row.testerIdHash === testerIdHash)
  const ownMessageIds = new Set(ownMessages.map((row) => row.messageId))
  const summary = summarizeDnaS13Canary({
    sessionId,
    messages: ownMessages,
    feedback: session.feedback.filter((row) => ownMessageIds.has(row.messageId)),
    trainingAnnotations: session.trainingAnnotations.filter((row) => ownMessageIds.has(row.messageId)),
    privacyRejectionCount: session.privacyRejections.filter((row) => row.testerIdHash === testerIdHash).length,
  })
  await writeDnaS13CanarySummary(access.flags.outputRoot, sessionId, summary)
  return NextResponse.json({ ok: true, summary })
}
