export const LITERATURE_SECTION_HEADING = "7. Literatürle Uyumlu Klinik Not"

type ClinicalAnalysis = {
  globalLevel: string
  profileType: string
  weakDomains?: string[]
  strongDomains?: string[]
  matchedDomains?: string[]
  primaryWeakDomain?: string
  anamnezConsistency?: string
  contrastSummary?: string
}

type LiteratureSource = {
  id: string
  citation: string
  shortLabel: string
}

const VERIFIED_LITERATURE_SOURCES: Record<string, LiteratureSource> = {
  SELF_REGULATION_FRAME: {
    id: "SELF_REGULATION_FRAME",
    shortLabel: "[1]",
    citation: "[1] School Readiness and Self-Regulation: A Developmental Psychobiological Approach.",
  },
  SENSORY_OVER_RESPONSIVITY: {
    id: "SENSORY_OVER_RESPONSIVITY",
    shortLabel: "[2]",
    citation: "[2] Sensory Over-Responsivity: An Early Risk Factor for Anxiety and Behavioral Challenges in Young Children.",
  },
  EMOTION_DYSREGULATION: {
    id: "EMOTION_DYSREGULATION",
    shortLabel: "[3]",
    citation: "[3] Emotion dysregulation: A theme in search of definition.",
  },
  CO_REGULATION: {
    id: "CO_REGULATION",
    shortLabel: "[4]",
    citation: "[4] Co-Regulation From Birth Through Young Adulthood: A Practice Brief.",
  },
  INTEROCEPTION_DMIM: {
    id: "INTEROCEPTION_DMIM",
    shortLabel: "[6]",
    citation: "[6] Development and Psychometric Evaluation of the Novel Dynamic Metacognitive Interoception Measure (DMIM).",
  },
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function includesDomain(domains: string[] | undefined, value: string) {
  return Array.isArray(domains) && domains.includes(value)
}

function trimSentences(sentences: Array<string | null | undefined>) {
  return sentences
    .map((sentence) => String(sentence || "").trim())
    .filter(Boolean)
}

export function buildLiteratureAlignedSection(
  analysis: ClinicalAnalysis
): {
  text: string
  sourceIds: string[]
} | null {
  if (!analysis) return null

  const weakDomains = analysis.weakDomains || []
  const strongDomains = analysis.strongDomains || []
  const matchedDomains = analysis.matchedDomains || []
  const sourceIds: string[] = ["SELF_REGULATION_FRAME"]
  const sentences: string[] = []

  sentences.push(
    "Erken çocukluk literatürü, self-regülasyonun tek bir belirti kümesi değil; beden temelli sinyaller, duyusal yanıt, dikkat ve duygusal toparlanmanın birlikte örgütlendiği gelişimsel bir yapı olduğunu vurgular [1]."
  )

  if (includesDomain(weakDomains, "Duyusal Regülasyon")) {
    sourceIds.push("SENSORY_OVER_RESPONSIVITY")
    sentences.push(
      "Bu profilde duyusal regülasyon alanındaki kırılganlık öne çıktığında, çevresel uyaran yükünün davranışsal ve duygusal düzenlenmeyi zorlaştırabildiğini bildiren okul öncesi çalışmalarla uyumlu bir örüntü görülür [2]."
    )
  }

  if (
    includesDomain(weakDomains, "Bilişsel Regülasyon") ||
    includesDomain(weakDomains, "Yürütücü İşlev")
  ) {
    sentences.push(
      "Okul öncesi öz-düzenleme çerçevesi, dikkat sürdürme, görev organizasyonu ve davranış kontrolü süreçlerinin aynı gelişimsel düzenleme sistemi içinde birlikte ele alınması gerektiğini vurgular; bu nedenle bilişsel ve yürütücü alandaki kırılganlıkların birlikte okunması literatürle uyumludur [1]."
    )
  }

  if (
    includesDomain(weakDomains, "Duygusal Regülasyon") ||
    includesDomain(matchedDomains, "Duygusal Regülasyon")
  ) {
    sourceIds.push("EMOTION_DYSREGULATION")
    sentences.push(
      "Duygusal yükselme ve toparlanma hızının işlevsel bir regülasyon ekseni olarak yorumlanması, duygusal zorlanmanın tanısal değil düzenleyici bir süreç olarak ele alınması gerektiğini vurgulayan çerçeveyle tutarlıdır [3]."
    )
  }

  if (
    includesDomain(weakDomains, "İnterosepsiyon") ||
    includesDomain(matchedDomains, "İnterosepsiyon") ||
    analysis.primaryWeakDomain === "İnterosepsiyon"
  ) {
    sourceIds.push("INTEROCEPTION_DMIM")
    sentences.push(
      "İnterosepsiyon alanındaki seçici kırılganlık, beden sinyallerini fark etme ve bu sinyalleri günlük düzenlenmede kullanma kapasitesinin klinik açıdan önemli olabileceğini gösteren gelişmekte olan literatürle uyumludur; ancak bu alandaki okul öncesi ölçüm kanıtı daha sınırlı olduğu için yorum temkinli tutulmalıdır [6]."
    )
  }

  if (
    matchedDomains.length > 0 ||
    /bağlam|durumsal|kısmi ayrışma|tutarl/i.test(String(analysis.anamnezConsistency || ""))
  ) {
    sourceIds.push("CO_REGULATION")
    sentences.push(
      "Anamnez verisinin yorum içine aktif biçimde katılması, regülasyon görünümünün bakımveren desteği, günlük rutinler ve çevresel taleplerle birlikte okunması gerektiğini vurgulayan ko-regülasyon yaklaşımıyla uyumludur [4]."
    )
  }

  if (
    weakDomains.length >= 2 &&
    includesDomain(weakDomains, "Duyusal Regülasyon") &&
    includesDomain(weakDomains, "Duygusal Regülasyon")
  ) {
    sourceIds.push("SENSORY_OVER_RESPONSIVITY")
    sentences.push(
      "Özellikle duyusal ve duygusal alanlar birlikte zorlandığında, çevresel uyaran yükünün duygusal toparlanmayı güçleştirebildiğine ilişkin kanıt çizgisi bu örüntüyü daha anlaşılır kılar [2]."
    )
  }

  if (
    weakDomains.length >= 2 &&
    includesDomain(weakDomains, "Bilişsel Regülasyon") &&
    includesDomain(weakDomains, "Yürütücü İşlev")
  ) {
    sentences.push(
      "Bilişsel ve yürütücü alanların birlikte zorlandığı örüntülerde, dikkat sürdürme ile davranışın hedefe göre düzenlenmesi aynı işlevsel yük içinde ele alınır; bu yorum erken öz-düzenleme literatüründeki bütüncül çerçeveyle uyumludur [1]."
    )
  }

  if (
    includesDomain(weakDomains, "Duyusal Regülasyon") &&
    (includesDomain(weakDomains, "Bilişsel Regülasyon") || includesDomain(weakDomains, "Yürütücü İşlev"))
  ) {
    sourceIds.push("SENSORY_OVER_RESPONSIVITY")
    sentences.push(
      "Duyusal yüklenmenin dikkat ve görev sürdürme üzerinde ikincil yük oluşturabilmesi, özellikle çevresel talep arttığında daha görünür hale gelen çok etkenli regülasyon örüntüsüyle uyumlu bir açıklama sunar [1][2]."
    )
  }

  if (
    weakDomains.length === 1 &&
    strongDomains.length > 0 &&
    /Seçici Kırılganlık/i.test(String(analysis.profileType || ""))
  ) {
    sentences.push(
      "Tek alanlı ve seçici görünen kırılganlığın korunmuş alanlarla birlikte okunması, literatürde önerilen asimetrik ama işlevsel olarak anlamlı regülasyon örüntüsü yaklaşımıyla tutarlıdır [1]."
    )
  }

  if (
    strongDomains.length > 0 &&
    weakDomains.length > 0 &&
    /korunmuş|karşıtlık/i.test(String(analysis.contrastSummary || ""))
  ) {
    sentences.push(
      "Korunmuş alanların görünür kılınması da klinik açıdan önemlidir; çünkü erken öz-düzenleme yazınında göreli güçlü alanların günlük işlevsellik üzerinde dengeleyici rol oynayabileceği vurgulanır [1]."
    )
  }

  const uniqueSourceIds = uniq(sourceIds)
  const uniqueSentences = uniq(trimSentences(sentences)).slice(0, 6)

  if (uniqueSentences.length === 0) return null

  const citations = uniqueSourceIds
    .map((sourceId) => VERIFIED_LITERATURE_SOURCES[sourceId])
    .filter(Boolean)
    .map((source) => source.citation)

  const introBlock = uniqueSentences.slice(0, 3).join(" ")
  const detailBlock = uniqueSentences.slice(3).join(" ")

  const body = [
    introBlock,
    detailBlock,
    "Kaynaklar:",
    ...citations,
  ]
    .filter(Boolean)
    .join("\n")
    .trim()

  return {
    text: `${LITERATURE_SECTION_HEADING}\n${body}`,
    sourceIds: uniqueSourceIds,
  }
}
