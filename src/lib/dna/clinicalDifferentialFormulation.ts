import type { ClinicalEvidenceMap, ClinicalMechanismType } from "./clinicalAnalysis"

export type DifferentialFormulation = {
  id: string
  text: string
  evidenceAtomIds: string[]
  ruleIds: string[]
  confidence: "yüksek" | "orta" | "sınırlı"
}

const DIFFERENTIAL_TEXT: Record<ClinicalMechanismType | "balanced", string> = {
  motor_praxis:
    "Bu örüntü yalnız dikkat sürekliliği diliyle açıklanamayacak kadar motor görev yükü ve beden organizasyonu bağlamında değişkenlik göstermektedir.",
  adaptive_daily_living:
    "Bu örüntü yalnız isteksizlik veya motivasyon azalması gibi yüzeysel bir okumayla sınırlanamaz; günlük rutin akışını başlatma ve sürdürme yükü klinik açıklamada ayrı tutulur.",
  social_pragmatic:
    "Bu örüntü yalnız sosyal ilgi düzeyi üzerinden okunmaz; sosyal-pragmatik talep arttığında düzenleme, esneklik ve toparlanma yükünün birlikte değişmesi daha açıklayıcıdır.",
  language_communication:
    "Bu örüntü yalnız genel dikkat diliyle açıklanmaz; sözel talep ve yönerge karmaşıklığı arttığında bilgiyi işleme ve görevde kalma yükü belirginleşir.",
  language_social_pragmatic:
    "Bu örüntü yalnız dilsel ya da yalnız sosyal başlıkla daraltılamaz; dilsel yük ile sosyal-pragmatik talep aynı işlevsel hatta birleşir.",
  physiological_interoceptive:
    "Bu örüntü medikal bir açıklama üretmeden, beden sinyali, yorgunluk ve toparlanma bağlamında artan düzenleme yükü olarak okunur.",
  selective_interoception:
    "Bu örüntü yaygın bir kapasite düşüklüğü gibi genişletilmez; içsel bedensel sinyal farkındalığı hattında seçici ve bağlama duyarlı biçimde ele alınır.",
  evidence_limited_mixed:
    "Bu örüntü tek bir dış test ya da tek bir anlatı kaynağıyla açıklanmaz; kaynaklar arası ayrışma karar dilini bağlamla sınırlı tutar.",
  default:
    "Bu örüntü yalnız en düşük puan üzerinden açıklanmaz; skor örüntüsü, gözlem ve bağlamsal veri birlikte tartıldığında klinik anlam kazanır.",
  balanced:
    "Bu profil risk diliyle genişletilmez; korunmuş düzenleme zemini içinde yalnız bağlama duyarlı hassasiyetler ayırt edilir.",
}

function hasEnoughEvidence(evidenceMap: ClinicalEvidenceMap): boolean {
  const channels =
    (evidenceMap.caseEvidenceLines.length ? 1 : 0) +
    (evidenceMap.anamnesisEvidence.length ? 1 : 0) +
    (evidenceMap.therapistObservationEvidence.length ? 1 : 0) +
    (evidenceMap.externalTestSupport.length ? 1 : 0) +
    ((evidenceMap.contextMatrix?.length || 0) > 0 ? 1 : 0)
  return channels >= 2 || evidenceMap.confidenceLevel !== "sınırlı"
}

export function buildDifferentialFormulation(evidenceMap: ClinicalEvidenceMap): DifferentialFormulation | null {
  if (!hasEnoughEvidence(evidenceMap)) return null
  const key: ClinicalMechanismType | "balanced" =
    evidenceMap.primaryAxisKind === "balanced" ? "balanced" : evidenceMap.clinicalMechanism || "default"
  const ruleId = `rule.differential.${key}`
  return {
    id: `differential.${key}`,
    text: DIFFERENTIAL_TEXT[key],
    evidenceAtomIds: ["evidence.mechanism.primary"],
    ruleIds: [ruleId],
    confidence: evidenceMap.confidenceLevel,
  }
}

