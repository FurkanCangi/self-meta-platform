import "server-only"

import { isOwnerAuditEmail } from "@/lib/owner/ownerAccess"
import { isDnaS13CanaryTester, resolveDnaS13CanaryFlags } from "./flags"

export function resolveDnaS13CanaryAccess(email: string | null | undefined) {
  const flags = resolveDnaS13CanaryFlags()
  const allowed = isOwnerAuditEmail(email) && isDnaS13CanaryTester(email, flags)
  return Object.freeze({ allowed, flags })
}
