import { cleanMeaningfulText, type AnamnezRecord } from "./anamnezUtils"
import { questions, type Question } from "./questions"

type DomainContext = {
  key: string
  label: string
  level: string
  score: number
}

type ThemeRule = {
  id: string
  label: string
  questionPattern: RegExp
  contextPattern: RegExp
}

export type ItemSignal = {
  questionId: number
  domainKey: string
  domainLabel: string
  text: string
  answer: number
  concernScore: number
  matchedThemes: string[]
  matchedThemeLabels: string[]
}

export type ItemLevelAnalysis = {
  criticalItems: ItemSignal[]
  alignedItems: ItemSignal[]
  criticalLines: string[]
  alignedLines: string[]
  signalSummary: string
}

const DOMAIN_LABELS: Record<string, string> = {
  fizyolojik: "Fizyolojik Regülasyon",
  duyusal: "Duyusal Regülasyon",
  duygusal: "Duygusal Regülasyon",
  bilissel: "Bilişsel Regülasyon",
  yurutucu: "Yürütücü İşlev",
  intero: "İnterosepsiyon",
}

const THEME_RULES: ThemeRule[] = [
  {
    id: "sleep_rhythm",
    label: "uyku ve fizyolojik ritim",
    questionPattern: /uyku|uyanır|solunumu|midesi|donuklaşır/i,
    contextPattern: /uyku|uyan|gece|ritim|solunum|mide|bulant|yorgun/i,
  },
  {
    id: "eating_body_needs",
    label: "beslenme ve bedensel ihtiyaçlar",
    questionPattern: /yemek|acıktığını|susadığını/i,
    contextPattern: /beslen|iştah|istah|yemek|acıkl|aclik|sus|içme|icme/i,
  },
  {
    id: "toilet_body_awareness",
    label: "tuvalet ve bedensel farkındalık",
    questionPattern: /tuvalet|ağrı|agri|sicak|sıcak|soğuk|soguk|vücudundaki değişimleri/i,
    contextPattern: /tuvalet|kabız|kabiz|ishal|ağrı|agri|sıcak|sicak|soğuk|soguk|bedensel/i,
  },
  {
    id: "sound_noise_load",
    label: "ses ve gürültü yükü",
    questionPattern: /ses|duymuyormuş|ani ses/i,
    contextPattern: /ses|gürültü|gurultu|kalabalık|kalabalik/i,
  },
  {
    id: "visual_sensory_load",
    label: "görsel duyusal yük",
    questionPattern: /ışıktan|hareketli nesneleri takip|nesneler yokmuş/i,
    contextPattern: /ışık|isik|parlak|görsel|hareketli/i,
  },
  {
    id: "touch_hygiene",
    label: "dokunsal hassasiyet ve hijyen farkındalığı",
    questionPattern: /yumuşak dokular|kirli olduğunu/i,
    contextPattern: /dokun|dokunsal|etiket|kumaş|saç kes|tırnak|kirli|yüz yıka|banyo/i,
  },
  {
    id: "food_selectivity",
    label: "yemek seçiciliği",
    questionPattern: /yeni yemekleri denemek istemez/i,
    contextPattern: /yeni yemek|yemek seç|reddettiği yemek|reddet/i,
  },
  {
    id: "emotion_recovery",
    label: "duygusal yoğunluk ve toparlanma",
    questionPattern: /öfke|üzüldüğünde|hayal kırıklığı|aşırı tepki|sakinleşmesi uzun|beklemek zorunda kaldığında/i,
    contextPattern: /öfke|sinir|kriz|ağla|duygusal|taşma|tasma|sakinleş|sakinles|bekle/i,
  },
  {
    id: "novelty_anxiety",
    label: "yenilik ve çevresel geçişlerde huzursuzluk",
    questionPattern: /yeni ortamlarda kolay huzursuz/i,
    contextPattern: /yeni ortam|geçiş|gecis|yeni yer|huzursuz/i,
  },
  {
    id: "attention_task",
    label: "dikkat ve görev sürdürme",
    questionPattern: /göreve başlama|etkinliği tamamlamadan|dikkatini sürdürmekte|yönergeyi takip|görev sırasında dikkatini kaybeder|görevleri tamamlamakta|talimatları takip|dikkati kolay dağılır|organize olmakta/i,
    contextPattern: /dikkat|odak|görev|gorev|yönerge|yonerge|oyunda kal|görevde kal|başlama|baslama|tamamlama|organize/i,
  },
  {
    id: "planning_rules",
    label: "planlama ve kural takibi",
    questionPattern: /planlamakta|yeni kuralları öğrenmesi|planlama gerektiren|kurallı oyunlarda|kuralları hatırlamakta|planlı hareket/i,
    contextPattern: /plan|kural|sıra|sira|bekleme|inhibisyon|durdur/i,
  },
  {
    id: "impulse_behavior_control",
    label: "davranış kontrolü ve inhibisyon",
    questionPattern: /davranışlarını kontrol etmekte|sırasını beklemekte|bir işi bitirmeden başka işe/i,
    contextPattern: /davranış|davranis|dürtü|durtu|bekleme|sıra|sira|kontrol/i,
  },
  {
    id: "intero_body_signals",
    label: "içsel bedensel sinyal farkındalığı",
    questionPattern: /acıktığını fark eder|susadığını fark eder|tuvalet ihtiyacını fark eder|yorgun olduğunu fark eder|kalp atışının hızlandığını fark eder|stresli olduğunu fark eder|rahatladığında bunu fark eder/i,
    contextPattern: /bedensel|fizyolojik|yorgun|sus|acıkl|aclik|kalp|gergin|stres|mola|su/i,
  },
]

function getDomainLabel(scale: string): string {
  return DOMAIN_LABELS[scale] || scale
}

function clampLikert(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return 3
  return Math.max(1, Math.min(5, Math.round(num)))
}

function buildContextText(
  anamnezRecord?: AnamnezRecord,
  therapistInsights: string[] = [],
  externalClinicalFindings: string[] = []
) {
  const recordText = anamnezRecord
    ? Object.values(anamnezRecord)
        .map((value) => cleanMeaningfulText(value))
        .filter(Boolean)
        .join(" ")
    : ""

  return [recordText, ...therapistInsights, ...externalClinicalFindings]
    .map((value) => cleanMeaningfulText(value))
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function getMatchedThemes(question: Question, contextText: string): ThemeRule[] {
  return THEME_RULES.filter(
    (rule) => rule.questionPattern.test(question.text) && rule.contextPattern.test(contextText)
  )
}

function getConcernScore(_question: Question, answer: number): number {
  // Mevcut sistem toplam/domain skoru mantigiyla uyumlu: dusuk puan daha belirgin kirilganlik kabul edilir.
  return 6 - answer
}

function getConcernDescriptor(_question: Question, _answer: number, concernScore: number): string {
  if (concernScore >= 5) return "çok düşük puanlı ayrışması"
  if (concernScore >= 4) return "düşük puanlı ayrışması"
  return "orta düzeyde ayrışması"
}

function buildNarrativeLine(item: ItemSignal, purpose: "critical" | "aligned"): string {
  const descriptor = getConcernDescriptor(
    { id: item.questionId, text: item.text, scale: "" },
    item.answer,
    item.concernScore
  )
  const quoted = `"${item.text}"`
  const themeText =
    item.matchedThemeLabels.length > 0
      ? `${item.matchedThemeLabels.slice(0, 2).join(" ve ")} temasıyla`
      : "klinik örüntüyle"

  if (purpose === "aligned") {
    return `${quoted} maddesinin ${descriptor}, anamnezde tarif edilen ${themeText} doğrudan örtüşmektedir.`
  }

  return `${quoted} maddesinin ${descriptor}, ${item.domainLabel} alanındaki madde düzeyindeki belirgin sinyallerden biri olduğunu göstermektedir.`
}

export function analyzeItemLevelSignals(params: {
  answers?: number[] | null
  anamnezRecord?: AnamnezRecord
  therapistInsights?: string[]
  externalClinicalFindings?: string[]
  domainResults: DomainContext[]
}): ItemLevelAnalysis | null {
  const answers = Array.isArray(params.answers) ? params.answers.slice(0, questions.length) : []
  if (answers.length !== questions.length) return null

  const contextText = buildContextText(
    params.anamnezRecord,
    params.therapistInsights || [],
    params.externalClinicalFindings || []
  )
  const domainLevelMap = new Map(params.domainResults.map((d) => [d.key, d.level]))

  const signals: ItemSignal[] = questions.map((question, index) => {
    const answer = clampLikert(answers[index])
    const concernScore = getConcernScore(question, answer)
    const matchedThemes = getMatchedThemes(question, contextText)

    return {
      questionId: question.id,
      domainKey: question.scale,
      domainLabel: getDomainLabel(question.scale),
      text: question.text,
      answer,
      concernScore,
      matchedThemes: matchedThemes.map((theme) => theme.id),
      matchedThemeLabels: matchedThemes.map((theme) => theme.label),
    }
  })

  const ranked = [...signals]
    .filter((signal) => signal.concernScore >= 3)
    .sort((a, b) => {
      const aDomainLevel = String(domainLevelMap.get(a.domainKey) || "")
      const bDomainLevel = String(domainLevelMap.get(b.domainKey) || "")
      const aLevelWeight = aDomainLevel === "Atipik" ? 2 : aDomainLevel === "Riskli" ? 1 : 0
      const bLevelWeight = bDomainLevel === "Atipik" ? 2 : bDomainLevel === "Riskli" ? 1 : 0
      const aScore = a.concernScore * 10 + a.matchedThemes.length * 4 + aLevelWeight * 3
      const bScore = b.concernScore * 10 + b.matchedThemes.length * 4 + bLevelWeight * 3

      if (bScore !== aScore) return bScore - aScore
      return a.questionId - b.questionId
    })

  const matchedRanked = ranked.filter((signal) => signal.matchedThemes.length > 0)
  const unmatchedRanked = ranked.filter((signal) => signal.matchedThemes.length === 0)
  const criticalItems = [...matchedRanked, ...unmatchedRanked].slice(0, 4)
  const alignedItems = ranked
    .filter((signal) => signal.matchedThemes.length > 0 && signal.concernScore >= 3)
    .slice(0, 3)

  if (criticalItems.length === 0 && alignedItems.length === 0) {
    return null
  }

  const criticalLines = criticalItems.slice(0, 3).map((item) => buildNarrativeLine(item, "critical"))
  const alignedLines = alignedItems.slice(0, 3).map((item) => buildNarrativeLine(item, "aligned"))

  const summaryParts: string[] = []
  if (criticalItems.length > 0) {
    summaryParts.push(
      `Madde düzeyinde en belirgin sinyaller ${criticalItems
        .slice(0, 3)
        .map((item) => `"${item.text}"`)
        .join(", ")} maddelerinde görülmektedir.`
    )
  }
  if (alignedItems.length > 0) {
    summaryParts.push(
      `Anamnezle en güçlü örtüşen maddeler ${alignedItems
        .slice(0, 2)
        .map((item) => `"${item.text}"`)
        .join(" ve ")} şeklinde ayrışmaktadır.`
    )
  }

  return {
    criticalItems,
    alignedItems,
    criticalLines,
    alignedLines,
    signalSummary: summaryParts.join(" "),
  }
}
