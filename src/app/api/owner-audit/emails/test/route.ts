import { NextResponse } from "next/server"
import { z } from "zod"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { isOwnerBulkEmailConfigured, sendOwnerBulkEmailToRecipient } from "@/lib/owner/ownerBulkEmail"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"

const testSchema = z.object({
  campaignType: z.enum(["system", "education", "marketing"]),
  subject: z.string().trim().min(3).max(160),
  previewText: z.string().trim().max(180).optional().nullable(),
  body: z.string().trim().min(10).max(5000),
  actionLabel: z.string().trim().max(60).optional().nullable(),
  actionUrl: z.string().trim().max(300).optional().nullable(),
})

async function requireOwner() {
  const auth = await requireConfirmedUser()
  if (!auth.ok) return auth

  try {
    assertOwnerAuditAccess(auth.user.email)
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    }
  }

  return auth
}

export async function POST(request: Request) {
  const trusted = await requireTrustedMutation(request)
  if (trusted) return trusted

  const owner = await requireOwner()
  if (!owner.ok) return owner.response

  const rateLimit = await checkRateLimit({
    key: `owner-bulk-email:test:${owner.user.id}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, testSchema)
  if (!parsed.ok) return parsed.response

  if (!isOwnerBulkEmailConfigured()) {
    return NextResponse.json({ ok: false, error: "Mail ayarı tamamlanmamış. SMTP bilgileri eksik." }, { status: 503 })
  }

  try {
    await sendOwnerBulkEmailToRecipient({
      recipient: {
        userId: owner.user.id,
        email: String(owner.user.email || "").toLowerCase(),
        fullName: String(owner.user.user_metadata?.full_name || owner.user.user_metadata?.name || "Owner"),
        plan: "owner",
        role: "owner",
      },
      campaign: {
        ...parsed.data,
        audience: "owners",
        subject: `[TEST] ${parsed.data.subject}`,
      },
      appOrigin: new URL(request.url).origin,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[owner-emails] test send failed", error)
    return NextResponse.json({ ok: false, error: "Test maili gönderilemedi." }, { status: 500 })
  }
}
