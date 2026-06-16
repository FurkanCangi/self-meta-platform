export type LegalDocumentId =
  | "terms"
  | "privacy"
  | "kvkk"
  | "explicit_consent"
  | "retention_policy"
  | "package_agreement"

export type LegalDocument = {
  id: LegalDocumentId
  title: string
  version: string
  href: string
}

export type PlanCode = "student" | "graduate" | "professional" | "enterprise" | "none"

export const LEGAL_DOCUMENT_VERSION = "2026-06-01"

export const ACTIVE_LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: "terms",
    title: "Kullanım Şartları ve Hizmet Koşulları",
    version: LEGAL_DOCUMENT_VERSION,
    href: "/terms",
  },
  {
    id: "privacy",
    title: "Gizlilik Politikası",
    version: LEGAL_DOCUMENT_VERSION,
    href: "/privacy",
  },
  {
    id: "kvkk",
    title: "KVKK Aydınlatma Metni",
    version: LEGAL_DOCUMENT_VERSION,
    href: "/kvkk",
  },
  {
    id: "explicit_consent",
    title: "Açık Rıza Metni",
    version: LEGAL_DOCUMENT_VERSION,
    href: "/explicit-consent",
  },
  {
    id: "retention_policy",
    title: "Saklama ve İmha Politikası",
    version: LEGAL_DOCUMENT_VERSION,
    href: "/retention-policy",
  },
  {
    id: "package_agreement",
    title: "Paket Satın Alma ve Hizmet Sözleşmesi",
    version: LEGAL_DOCUMENT_VERSION,
    href: "/package-agreement",
  },
]

export const PACKAGE_PLANS: Record<Exclude<PlanCode, "none">, { label: string; price: string }> = {
  student: {
    label: "Öğrenci Paketi",
    price: "500 TL / Ay",
  },
  graduate: {
    label: "Mezun Paketi",
    price: "1500 TL / Ay",
  },
  professional: {
    label: "Gelişmiş (Profesyonel) Paket",
    price: "3000 TL / Ay",
  },
  enterprise: {
    label: "Kurumsal Paket",
    price: "10.000 TL / Ay",
  },
}

export const PACKAGE_PLAN_PRICES_MINOR: Record<Exclude<PlanCode, "none">, number> = {
  student: 50000,
  graduate: 150000,
  professional: 300000,
  enterprise: 1000000,
}

export function normalizePlanCode(value?: string | null): PlanCode {
  const raw = String(value || "").trim().toLowerCase()
  if (raw === "student" || raw === "graduate" || raw === "professional" || raw === "enterprise") {
    return raw
  }
  return "none"
}

export function getPlanLabel(planCode?: string | null) {
  const normalized = normalizePlanCode(planCode)
  if (normalized === "none") return "Seçilmemiş Paket"
  return PACKAGE_PLANS[normalized].label
}

export function getAcceptedDocumentsSnapshot() {
  return ACTIVE_LEGAL_DOCUMENTS.map((document) => ({
    id: document.id,
    title: document.title,
    version: document.version,
    href: document.href,
  }))
}

export function hasAcceptedActiveDocuments(
  acceptedDocuments: unknown,
  requiredDocuments: LegalDocument[] = ACTIVE_LEGAL_DOCUMENTS
) {
  if (!Array.isArray(acceptedDocuments)) return false

  return requiredDocuments.every((required) =>
    acceptedDocuments.some((accepted) => {
      if (!accepted || typeof accepted !== "object") return false
      const row = accepted as Partial<LegalDocument>
      return row.id === required.id && row.version === required.version
    })
  )
}
