import {
  DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST,
  activeDnaMarketingClaimByText,
  validateDnaMarketingEvidenceManifest,
  verifyDnaMarketingEvidenceManifest,
  type DnaMarketingEvidenceVerification,
  type DnaMarketingEvidenceManifest,
} from "./marketingEvidence"
import {
  DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE,
  DNA_CURRENT_V3_RELEASE_EVIDENCE_ROOT,
  type DnaReleaseEvidenceBundle,
} from "../release/releaseEvidenceBundle"

export const DNA_PRODUCT_LANGUAGE_POLICY_VERSION = "dna-product-language-tr@1" as const

export const DNA_APPROVED_CORE_PRODUCT_DEFINITION_TR =
  "DNA Intelligence, kaynak kontrollü DNA bilgi ve vaka tartışma asistanıdır. Haricî LLM ve çalışma zamanı internet araması kullanmaz. Yanıtlarını sürümlü, kaynak-bağlı bilgi kataloğu ve yalnız kullanıcıya ait seçilmiş rapor bağlamından oluşturur. Tanı, tedavi, ilaç, prognoz veya doğrudan biyolojik mekanizma üretmez."

export const DNA_CONDITIONAL_SOURCE_AUDIT_LANGUAGE_TR =
  "Dış bilimsel içerik, çok katmanlı kaynak, yöntem, karşı kanıt, güvenlik ve atıf denetiminden geçirilmiştir."

export const DNA_PROHIBITED_PRODUCT_PHRASES_TR = Object.freeze([
  "Uzman onaylı",
  "10 milyon bilgiyle eğitildi",
  "%100 doğru",
  "Halüsinasyon yapmaz",
  "Sızıntı imkânsız",
  "Klinik olarak kanıtlandı",
  "Tanı koyan AI",
  "Tanı koyan yapay zeka",
  "Terapistin yerini alır",
  "En gelişmiş AI",
  "En gelişmiş yapay zeka",
  "Tüm soruları bilir",
  "En güncel bilim",
  "Tamamen ücretsiz",
] as const)

export const DNA_APPROVED_QUALIFIER_LANGUAGE_TR = Object.freeze([
  "Haricî LLM token/API maliyeti yok",
  "Bağımsız klinik validasyon değildir",
  "Kaynak kesme tarihi: …",
  "X benzersiz doğrulanmış kaynak",
  "Y passage-bağlı bilgi birimi",
  "Z kilitli değerlendirme sorusu",
  "Belirtilen testte x/y başarı",
] as const)

const DNA_NON_CLAIM_BOUNDARY_LANGUAGE_TR = Object.freeze([
  "Bağımsız klinik validasyon değildir",
] as const)

export type DnaProductLanguageDecision = Readonly<{
  policyVersion: typeof DNA_PRODUCT_LANGUAGE_POLICY_VERSION
  allowed: boolean
  reasonCodes: readonly string[]
  matchedActiveClaimIds: readonly string[]
}>

function canonicalTurkish(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.filter(Boolean))].sort())
}

/**
 * Rejects categorical overclaims everywhere, and requires a current active
 * manifest entry for numerical or evaluation language. The approved core
 * definition is a versioned product boundary, not a V3 performance claim.
 */
export function verifyDnaProductLanguageAgainstReleaseEvidence(input: Readonly<{
  text: string
  manifest: DnaMarketingEvidenceManifest
  releaseEvidence?: Readonly<{
    bundle: DnaReleaseEvidenceBundle
    evidenceRoot: string
  }> | null
  /** @deprecated Caller-supplied verification seals are intentionally ignored. */
  evidenceVerification?: DnaMarketingEvidenceVerification | null
}>): DnaProductLanguageDecision {
  const reasons: string[] = []
  const matchedActiveClaimIds: string[] = []
  const canonicalText = canonicalTurkish(input.text)
  for (const phrase of DNA_PROHIBITED_PRODUCT_PHRASES_TR) {
    if (canonicalText.includes(canonicalTurkish(phrase))) {
      reasons.push(`product_language_prohibited:${canonicalTurkish(phrase).replace(/ /g, "_")}`)
    }
  }

  const coreDefinitionOnly = input.text.trim() === DNA_APPROVED_CORE_PRODUCT_DEFINITION_TR
  const nonClaimBoundaryOnly = DNA_NON_CLAIM_BOUNDARY_LANGUAGE_TR
    .some((text) => input.text.trim() === text)
  if (!coreDefinitionOnly && !nonClaimBoundaryOnly) {
    let evidenceVerification: DnaMarketingEvidenceVerification | null = null
    if (input.releaseEvidence) {
      try {
        evidenceVerification = verifyDnaMarketingEvidenceManifest({
          manifest: input.manifest,
          evidenceBundle: input.releaseEvidence.bundle,
          evidenceRoot: input.releaseEvidence.evidenceRoot,
        })
      } catch {
        reasons.push("product_language_release_evidence_invalid")
      }
    } else {
      reasons.push("product_language_release_evidence_missing")
    }
    const manifestValidation = validateDnaMarketingEvidenceManifest(
      input.manifest,
      evidenceVerification,
    )
    if (!manifestValidation.valid) reasons.push("product_language_manifest_invalid")
    if (input.manifest.releaseStatus !== "ready" || !input.manifest.v3ReleaseReady) {
      reasons.push("product_language_release_not_ready")
    }
    const claim = manifestValidation.valid && input.manifest.releaseStatus === "ready"
      && input.manifest.v3ReleaseReady
      ? activeDnaMarketingClaimByText(
        input.manifest,
        input.text.trim(),
        input.releaseEvidence ?? null,
      )
      : null
    if (claim) matchedActiveClaimIds.push(claim.claimId)
    else reasons.push("product_language_claim_not_in_active_manifest")
  }

  return Object.freeze({
    policyVersion: DNA_PRODUCT_LANGUAGE_POLICY_VERSION,
    allowed: reasons.length === 0,
    reasonCodes: sortedUnique(reasons),
    matchedActiveClaimIds: sortedUnique(matchedActiveClaimIds),
  })
}

/**
 * The only action-facing product-language decision. Callers provide text only;
 * the manifest, release bundle and artifact root are committed authorities.
 * Synthetic or caller-authored evidence can be exercised only through the
 * explicitly named offline verifier above and cannot authorize a public claim.
 */
export function evaluateDnaProductLanguage(input: Readonly<{
  text: string
}>): DnaProductLanguageDecision {
  const releaseEvidence = DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE
    && DNA_CURRENT_V3_RELEASE_EVIDENCE_ROOT
    ? Object.freeze({
        bundle: DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE,
        evidenceRoot: DNA_CURRENT_V3_RELEASE_EVIDENCE_ROOT,
      })
    : null
  return verifyDnaProductLanguageAgainstReleaseEvidence({
    text: input.text,
    manifest: DNA_CURRENT_MARKETING_EVIDENCE_MANIFEST,
    releaseEvidence,
  })
}
