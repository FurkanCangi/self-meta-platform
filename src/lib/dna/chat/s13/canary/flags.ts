export const DNA_S13_CANARY_ENV = Object.freeze({
  enabled: "DNA_S13_INTERNAL_CANARY_ENABLED",
  uiEnabled: "DNA_S13_INTERNAL_CANARY_UI_ENABLED",
  lunaEnabled: "DNA_S13_INTERNAL_CANARY_LUNA_ENABLED",
  testerEmails: "DNA_S13_INTERNAL_CANARY_TESTER_EMAILS",
  outputRoot: "DNA_S13_INTERNAL_CANARY_OUTPUT_ROOT",
} as const)

export const DNA_S13_CANARY_DEFAULT_OUTPUT_ROOT =
  "/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/internal-canary/s13-strict-v4" as const

export type DnaS13CanaryFlags = Readonly<{
  enabled: boolean
  uiEnabled: boolean
  lunaEnabled: boolean
  productionBlocked: boolean
  testerEmails: readonly string[]
  outputRoot: string
}>

function enabled(value: string | undefined) {
  return value?.trim() === "1"
}

function emails(value: string | undefined) {
  return Object.freeze([...new Set(String(value || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean))])
}

export function resolveDnaS13CanaryFlags(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DnaS13CanaryFlags {
  const productionBlocked = env.VERCEL_ENV?.trim().toLowerCase() === "production"
    || env.DNA_RUNTIME_ENV?.trim().toLowerCase() === "production"
  const master = enabled(env[DNA_S13_CANARY_ENV.enabled]) && !productionBlocked
  return Object.freeze({
    enabled: master,
    uiEnabled: master && enabled(env[DNA_S13_CANARY_ENV.uiEnabled]),
    lunaEnabled: master && enabled(env[DNA_S13_CANARY_ENV.lunaEnabled]),
    productionBlocked,
    testerEmails: emails(env[DNA_S13_CANARY_ENV.testerEmails]),
    outputRoot: env[DNA_S13_CANARY_ENV.outputRoot]?.trim() || DNA_S13_CANARY_DEFAULT_OUTPUT_ROOT,
  })
}

export function isDnaS13CanaryTester(
  email: string | null | undefined,
  flags: DnaS13CanaryFlags,
) {
  const normalized = String(email || "").trim().toLowerCase()
  return Boolean(flags.enabled && flags.uiEnabled && normalized && flags.testerEmails.includes(normalized))
}
