import { evaluateCurrentDnaPreviewPromotion } from "../src/lib/dna/chat/release/currentPreviewPromotionGuard"

const args = process.argv.slice(2)
if (args.some((arg) => arg !== "--check")) {
  console.error(JSON.stringify({
    ok: false,
    error: "check_only_command",
    allowedArguments: ["--check"],
    mutationPerformed: false,
  }, null, 2))
  process.exitCode = 2
} else {
  const decision = evaluateCurrentDnaPreviewPromotion()
  console.log(JSON.stringify({
    ok: decision.allowed,
    mode: "check_only",
    mutationPerformed: decision.mutationPerformed,
    decision: decision.decision,
    checkedOutGitSha: decision.checkedOutGitSha,
    previewDeploymentId: decision.previewDeploymentId,
    blockCodes: decision.blockCodes,
  }, null, 2))
  if (!decision.allowed) process.exitCode = 1
}
