import { NextResponse } from "next/server"
import { checkRateLimit, getClientRateLimitKey, rateLimitResponse } from "@/lib/security/rateLimit"

function envFlag(value?: string | null) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase())
}

function envText(key: string, fallback: string | null = null) {
  const value = String(process.env[key] || "").trim()
  return value || fallback
}

export async function GET(request: Request) {
  const rateLimit = await checkRateLimit({
    key: getClientRateLimitKey(request, "runtime-config"),
    limit: 300,
    windowMs: 60 * 60 * 1000,
  })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt)

  const maintenanceEnabled = envFlag(process.env.APP_MAINTENANCE_ENABLED)
  const response = NextResponse.json({
    ok: true,
    webVersion: envText("APP_WEB_VERSION", process.env.npm_package_version || "dev"),
    minimumShellVersion: envText("APP_MIN_SHELL_VERSION", "1.0.0"),
    recommendedShellVersion: envText("APP_RECOMMENDED_SHELL_VERSION", "1.0.0"),
    maintenance: {
      enabled: maintenanceEnabled,
      message: maintenanceEnabled
        ? envText("APP_MAINTENANCE_MESSAGE", "Kısa bir bakım çalışması yapıyoruz. Lütfen biraz sonra tekrar deneyin.")
        : null,
      retryAfterSeconds: Number(process.env.APP_MAINTENANCE_RETRY_AFTER_SECONDS || 900),
    },
    updateNotice: {
      enabled: envFlag(process.env.APP_UPDATE_NOTICE_ENABLED),
      severity: envText("APP_UPDATE_NOTICE_SEVERITY", "info"),
      title: envText("APP_UPDATE_NOTICE_TITLE"),
      message: envText("APP_UPDATE_NOTICE_MESSAGE"),
    },
    storeUrls: {
      ios: envText("APP_STORE_IOS_URL"),
      android: envText("APP_STORE_ANDROID_URL"),
    },
  })

  response.headers.set("Cache-Control", "no-store")
  return response
}
