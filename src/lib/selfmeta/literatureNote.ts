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
  therapistInsights?: string[]
  externalClinicalFindings?: string[]
}

type LiteratureSource = {
  id: string
  inlineCitation: string
  apaReference: string
}

type LiteratureBlock = {
  text: string
  sourceIds: string[]
}

const VERIFIED_LITERATURE_SOURCES: Record<string, LiteratureSource> = {
  BLAIR_RAVER_2015: {
    id: "BLAIR_RAVER_2015",
    inlineCitation: "(Blair & Raver, 2015)",
    apaReference:
      "Blair, C., & Raver, C. C. (2015). School readiness and self-regulation: A developmental psychobiological approach. Annual Review of Psychology, 66, 711-731. https://doi.org/10.1146/annurev-psych-010814-015221",
  },
  CARPENTER_ET_AL_2019: {
    id: "CARPENTER_ET_AL_2019",
    inlineCitation: "(Carpenter et al., 2019)",
    apaReference:
      "Carpenter, K. L. H., Baranek, G. T., Copeland, W. E., Compton, S., Zucker, N., Dawson, G., & Egger, H. L. (2019). Sensory over-responsivity: An early risk factor for anxiety and behavioral challenges in young children. Journal of Abnormal Child Psychology, 47(6), 1075-1088. https://doi.org/10.1007/s10802-018-0502-y",
  },
  THOMPSON_2019: {
    id: "THOMPSON_2019",
    inlineCitation: "(Thompson, 2019)",
    apaReference:
      "Thompson, R. A. (2019). Emotion dysregulation: A theme in search of definition. Development and Psychopathology, 31(3), 805-815. https://doi.org/10.1017/S0954579419000282",
  },
  ROSANBALM_MURRAY_2017: {
    id: "ROSANBALM_MURRAY_2017",
    inlineCitation: "(Rosanbalm & Murray, 2017)",
    apaReference:
      "Rosanbalm, K. D., & Murray, D. W. (2017). Co-regulation from birth through young adulthood: A practice brief. Office of Planning, Research, and Evaluation, Administration for Children and Families, U.S. Department of Health and Human Services.",
  },
  DIAMOND_2013: {
    id: "DIAMOND_2013",
    inlineCitation: "(Diamond, 2013)",
    apaReference:
      "Diamond, A. (2013). Executive functions. Annual Review of Psychology, 64, 135-168. https://doi.org/10.1146/annurev-psych-113011-143750",
  },
  PINNA_EDWARDS_2020: {
    id: "PINNA_EDWARDS_2020",
    inlineCitation: "(Pinna & Edwards, 2020)",
    apaReference:
      "Pinna, T., & Edwards, D. J. (2020). A systematic review of associations between interoception, vagal tone, and emotional regulation: Potential applications for mental health, wellbeing, psychological flexibility, and chronic conditions. Frontiers in Psychology, 11, 1792. https://doi.org/10.3389/fpsyg.2020.01792",
  },
}

function includesDomain(domains: string[] | undefined, value: string) {
  return Array.isArray(domains) && domains.includes(value)
}

function hasAnyDomain(domains: string[] | undefined, values: string[]) {
  return values.some((value) => includesDomain(domains, value))
}

function uniqueNonEmpty(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      items
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  )
}

function hasPattern(texts: string[] | undefined, pattern: RegExp) {
  return Array.isArray(texts) && texts.some((text) => pattern.test(String(text || "")))
}

function buildRegulationParagraph(analysis: ClinicalAnalysis): LiteratureBlock {
  const levelText =
    String(analysis.globalLevel || "").toLowerCase() === "tipik"
      ? "genel düzeyde büyük ölçüde korunmuş"
      : "birden fazla alt sistemin birlikte düşünülmesini gerektiren"

  return {
    text: [
    `Erken çocukluk literatürü, self-regülasyonu tek bir belirti kümesi olarak değil; bedensel uyarılma, dikkat, duygu düzenleme ve davranış kontrolünün birlikte örgütlendiği gelişimsel bir yapı olarak ele alır ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`,
    `Bu nedenle mevcut profil, yalnız tek tek alan skorlarıyla değil, ${levelText} çok boyutlu bir düzenleme örüntüsü olarak yorumlanmalıdır.`,
    `Aynı çerçeve, okul öncesi dönemde öz-düzenlemenin yetişkin desteği, günlük yapı ve ko-regülasyon süreçlerinden bağımsız düşünülemeyeceğini vurgular ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`,
    `Dikkat sürdürme, davranışı durdurma, çalışma belleği ve esnek geçiş gibi süreçlerin ortak düzenleyici omurga içinde yer alması da yürütücü işlev literatürüyle uyumludur ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`,
  ].join(" "),
    sourceIds: [
      VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.id,
      VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.id,
      VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.id,
    ],
  }
}

function buildDomainParagraph(analysis: ClinicalAnalysis): LiteratureBlock {
  const weakDomains = analysis.weakDomains || []
  const matchedDomains = analysis.matchedDomains || []
  const therapistInsights = analysis.therapistInsights || []
  const externalClinicalFindings = analysis.externalClinicalFindings || []
  const balancedProfile = String(analysis.globalLevel || "").toLowerCase() === "tipik" && weakDomains.length === 0
  const explicitInteroContext =
    hasPattern(externalClinicalFindings, /intero|fizyolojik|bedensel|yorgunluk|huzursuzluk|susama|açlık|aclik|tuvalet/i) ||
    hasPattern(therapistInsights, /bedensel|yorgunluk|huzursuzluk|susama|açlık|aclik|tuvalet|ritim|mola/i)
  const supportsSensoryContext =
    hasAnyDomain(weakDomains, ["Duyusal Regülasyon"]) ||
    (!balancedProfile && hasAnyDomain(matchedDomains, ["Duyusal Regülasyon"])) ||
    hasPattern(externalClinicalFindings, /sensory profile|spm|duyusal/i)
  const supportsExecutiveContext =
    hasAnyDomain(weakDomains, ["Bilişsel Regülasyon", "Yürütücü İşlev"]) ||
    hasPattern(externalClinicalFindings, /brief|conners|basc|yürütücü|yurutucu|dikkat/i) ||
    hasPattern(therapistInsights, /gorev|görev|dikkat|plan|baslat|başlat|sirala|sırala/i)
  const supportsAdaptiveContext =
    hasPattern(externalClinicalFindings, /abas|vineland|pedi-cat|uyumsal|gunluk yasam|günlük yaşam|özbakim|ozbakim/i)
  const supportsSocialCommunicationContext =
    hasPattern(externalClinicalFindings, /srs-?2|ccc-?2|pragmatik|sosyal iletişim|sosyal iletisim/i) ||
    hasPattern(therapistInsights, /grup|akran|sosyal|karsilikli|karşılıklı/i)
  const sourceIds: string[] = []

  const sensorySentence = supportsSensoryContext
    ? `Bu vakada duyusal yük ve çevresel tetikleyicilerin görünür olması, erken çocuklukta duyusal aşırı yanıtlılığın davranışsal ve duygusal zorlanmalarla ilişkili olabileceğini gösteren bulgularla örtüşmektedir ${VERIFIED_LITERATURE_SOURCES.CARPENTER_ET_AL_2019.inlineCitation}.`
    : ""

  const emotionSentence = hasAnyDomain(weakDomains, ["Duygusal Regülasyon"]) || (!balancedProfile && hasAnyDomain(matchedDomains, ["Duygusal Regülasyon"]))
    ? `Duygusal toparlanma, yoğunluk ve yatışma hızının bir düzenleyici süreç olarak ele alınması, duygusal zorlanmanın tanı değil işlevsel regülasyon ekseni olarak yorumlanması gerektiğini vurgulayan kuramsal çerçeveyle tutarlıdır ${VERIFIED_LITERATURE_SOURCES.THOMPSON_2019.inlineCitation}.`
    : ""

  const interoSentence = hasAnyDomain(weakDomains, ["İnterosepsiyon", "Fizyolojik Regülasyon"]) ||
    (!balancedProfile && hasAnyDomain(matchedDomains, ["İnterosepsiyon", "Fizyolojik Regülasyon"])) ||
    analysis.primaryWeakDomain === "İnterosepsiyon" ||
    analysis.primaryWeakDomain === "Fizyolojik Regülasyon" ||
    explicitInteroContext
      ? `Bedensel sinyallerin fark edilmesi ve bu sinyallerin duygusal düzenleme ile ilişkisi üzerine yapılan sistematik derlemeler, interoseptif süreçlerin klinik yorumda temkinli ama anlamlı bir eksen olarak ele alınabileceğini düşündürmektedir ${VERIFIED_LITERATURE_SOURCES.PINNA_EDWARDS_2020.inlineCitation}.`
      : ""

  const adaptiveSentence = supportsAdaptiveContext
    ? `Uyumsal davranış ve günlük yaşam becerilerinin göreli korunmuş ya da yapılandırılmış biçimde sürdürülebilmesi, öz-düzenleme kapasitesinin gündelik işlevselliğe nasıl yansıdığını görünür kılar ve bu tür verilerin klinik yoruma katılması gelişimsel öz-düzenleme çerçevesiyle uyumludur ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`
    : ""

  const socialCommunicationSentence = supportsSocialCommunicationContext
    ? `Sosyal iletişim, karşılıklılık ve pragmatik işlevselliğe ilişkin ek bulguların bağlama duyarlı biçimde ele alınması, regülasyon örüntüsünün yalnız test skorlarıyla değil bakımveren ve terapist gözlemleriyle birlikte okunması gerektiğini vurgulayan yaklaşım ile tutarlıdır ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`
    : ""

  const balancedNeutralSentence =
    balancedProfile && !sensorySentence && !emotionSentence && !interoSentence && !adaptiveSentence && !socialCommunicationSentence
      ? `Alanların genel olarak tipik aralıkta kalması, dikkat, duygu düzenleme ve davranış kontrolü süreçlerinin yaşa uygun sınırlar içinde birlikte işleyebildiğini düşündürür; bu görünüm, öz-düzenlemenin koruyucu gelişimsel yönlerini vurgulayan yazınla uyumludur ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`
      : ""

  if (sensorySentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.CARPENTER_ET_AL_2019.id)
  if (emotionSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.THOMPSON_2019.id)
  if (interoSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.PINNA_EDWARDS_2020.id)
  if (adaptiveSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.id)
  if (socialCommunicationSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.id)
  if (balancedNeutralSentence) sourceIds.push(VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.id)

  return {
    text: [
      sensorySentence,
      emotionSentence,
      interoSentence,
      adaptiveSentence,
      socialCommunicationSentence,
      balancedNeutralSentence,
    ]
      .filter(Boolean)
      .join(" "),
    sourceIds,
  }
}

function buildIntegrationParagraph(analysis: ClinicalAnalysis): LiteratureBlock {
  const therapistInsights = analysis.therapistInsights || []
  const externalClinicalFindings = analysis.externalClinicalFindings || []
  const balancedProfile = String(analysis.globalLevel || "").toLowerCase() === "tipik" && (analysis.weakDomains || []).length === 0
  const contrastSentence =
    analysis.strongDomains && analysis.strongDomains.length > 0
      ? `Ayrıca korunmuş alanların açıkça belirtilmesi önemlidir; çünkü erken öz-düzenleme yazınında göreli güçlü sistemlerin günlük işlevsellik üzerinde dengeleyici rol oynayabileceği vurgulanır ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`
      : `Korunmuş alanların sınırlı olduğu örüntülerde bile, profilin bütününü bağlam içinde okumak ve tek bir skor üzerinden aşırı yorum yapmamak gerekir ${VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.inlineCitation}.`

  const caseSentence = balancedProfile
    ? `Korunmuş profillerde dikkat, davranış ve beden temelli düzenleme süreçlerinin yaşa uygun sınırlar içinde birlikte işleyebilmesi, erken çocuklukta öz-düzenlemenin koruyucu yönlerini görünür kılan gelişimsel çerçeveyle uyumludur ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`
    : hasAnyDomain(analysis.weakDomains, ["Bilişsel Regülasyon", "Yürütücü İşlev"])
    ? `Bilişsel ve yürütücü alanlara yayılan kırılganlıkların birlikte ele alınması, dikkat, çalışma belleği, inhibisyon ve esnekliğin aynı düzenleyici sistem içinde işlendiğini gösteren yürütücü işlev literatürüyle desteklenir ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`
    : `Skor örüntüsünün tek bir alanda görünse bile diğer düzenleyici sistemlerle birlikte yorumlanması, erken çocuklukta öz-düzenleme süreçlerinin parçalı değil etkileşimli işlediğini gösteren yazınla uyumludur ${VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.inlineCitation}.`

  const observationSentence =
    therapistInsights.length > 0 || externalClinicalFindings.length > 0
      ? `Bakımveren anlatısına terapist gözlemi ve yaşa uygun ek test bulgularının eklenmesi, profilin bağlamsal anlamını güçlendirir ve klinik kararın yalnız bir kaynağa dayanmamasını sağlar ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`
      : `Bakımveren gözlemlerinin tek başına değil, klinik bağlamla birlikte okunması öz-düzenleme yorumunu daha güvenilir hale getirir ${VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.inlineCitation}.`

  return {
    text: [
    observationSentence,
    caseSentence,
    contrastSentence,
  ].join(" "),
    sourceIds: [
      VERIFIED_LITERATURE_SOURCES.ROSANBALM_MURRAY_2017.id,
      VERIFIED_LITERATURE_SOURCES.DIAMOND_2013.id,
      VERIFIED_LITERATURE_SOURCES.BLAIR_RAVER_2015.id,
    ],
  }
}

export function buildLiteratureAlignedSection(
  analysis: ClinicalAnalysis
): {
  text: string
  sourceIds: string[]
} | null {
  if (!analysis) return null

  const paragraph1 = buildRegulationParagraph(analysis)
  const paragraph2 = buildDomainParagraph(analysis)
  const paragraph3 = buildIntegrationParagraph(analysis)

  const sourceIds = uniqueNonEmpty([
    ...paragraph1.sourceIds,
    ...paragraph2.sourceIds,
    ...paragraph3.sourceIds,
  ])

  const references = uniqueNonEmpty(
    sourceIds.map((sourceId) => VERIFIED_LITERATURE_SOURCES[sourceId]?.apaReference)
  )

  const body = [
    paragraph1.text,
    paragraph2.text,
    paragraph3.text,
    "Kaynaklar (APA 7):",
    ...references,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim()

  return {
    text: `${LITERATURE_SECTION_HEADING}\n${body}`,
    sourceIds,
  }
}
