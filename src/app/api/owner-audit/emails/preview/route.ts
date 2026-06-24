import { NextResponse } from "next/server"
import { z } from "zod"
import { assertOwnerAuditAccess } from "@/lib/owner/ownerAccess"
import { isMissingOwnerBulkEmailTable, resolveOwnerEmailRecipients } from "@/lib/owner/ownerBulkEmail"
import { requireConfirmedUser, requireTrustedMutation } from "@/lib/security/apiGuards"
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit"
import { readJsonWithSchema } from "@/lib/security/schemaGuards"

const previewSchema = z.object({
  audience: z.enum(["all", "therapists", "owners", "plan", "manual"]),
  planCode: z.string().trim().max(80).optional().nullable(),
  manualEmails: z.array(z.string().trim().email()).max(500).optional().default([]),
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
    key: `owner-bulk-email:preview:${owner.user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const parsed = await readJsonWithSchema(request, previewSchema)
  if (!parsed.ok) return parsed.response

  if (parsed.data.audience === "plan" && !parsed.data.planCode) {
    return NextResponse.json({ ok: false, error: "Paket seçimi gerekli." }, { status: 400 })
  }

  try {
    const recipients = await resolveOwnerEmailRecipients(parsed.data)
    return NextResponse.json({
      ok: true,
      count: recipients.length,
      sample: recipients.slice(0, 8).map((recipient) => ({
        email: recipient.email,
        fullName: recipient.fullName,
        plan: recipient.plan,
      })),
    })
  } catch (error) {
    if (isMissingOwnerBulkEmailTable(error)) {
      return NextResponse.json({ ok: false, error: "Mail tabloları hazır değil.", setupRequired: true }, { status: 503 })
    }

    console.error("[owner-emails] preview failed", error)
    return NextResponse.json({ ok: false, error: "Alıcı listesi hesaplanamadı." }, { status: 500 })
  }
}
