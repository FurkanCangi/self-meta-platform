import { DNA_CHAT_CANONICAL_BENCHMARK_TABLES } from "./canonicalBenchmarkData"
import {
  DNA_CHAT_CATALOG_VERSION,
  type DnaChatCatalogBenchmarkQuestion,
  type DnaChatCatalogCategory,
  type DnaChatQueryKind,
} from "./types"

type CanonicalQuestionRow = {
  sourceCategory: DnaChatCatalogCategory
  sourceCode: string
  sourceQuestionCategory: string | null
  question: string
  expectedLabel: string
  canonicalRow: string
  semanticFamily: string
}

const CATEGORY_ID_PREFIX: Record<DnaChatCatalogCategory, string> = {
  self_regulation: "selfreg",
  central_nervous_system: "cns",
  autonomic_nervous_system: "ans",
  sympathetic_parasympathetic: "sympara",
}

function normalizeBenchmarkText(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function parseCanonicalRows(
  sourceCategory: DnaChatCatalogCategory,
  table: string,
): CanonicalQuestionRow[] {
  return table.trim().split("\n").map((canonicalRow) => {
    const cells = canonicalRow.split("|").slice(1, -1).map((cell) => cell.trim())
    if (cells.length !== 3 && cells.length !== 4) {
      throw new Error(`${sourceCategory}: geçersiz kanonik soru satırı: ${canonicalRow}`)
    }
    const [sourceCode, sourceQuestionCategory, question, expectedLabel] = cells.length === 4
      ? cells
      : [cells[0], null, cells[1], cells[2]]
    if (!sourceCode || !question || !expectedLabel) {
      throw new Error(`${sourceCategory}: eksik kanonik soru alanı: ${canonicalRow}`)
    }
    return {
      sourceCategory,
      sourceCode,
      sourceQuestionCategory,
      question,
      expectedLabel,
      canonicalRow,
      semanticFamily: normalizeBenchmarkText(question),
    }
  })
}

const canonicalRows = (Object.entries(DNA_CHAT_CANONICAL_BENCHMARK_TABLES) as Array<
  [DnaChatCatalogCategory, string]
>).flatMap(([sourceCategory, table]) => parseCanonicalRows(sourceCategory, table))

function stableFamilyHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const familyContainsRefusal = new Map<string, boolean>()
for (const row of canonicalRows) {
  familyContainsRefusal.set(
    row.semanticFamily,
    (familyContainsRefusal.get(row.semanticFamily) ?? false) || row.expectedLabel === "Güvenli ret",
  )
}

function isHoldoutFamily(row: CanonicalQuestionRow): boolean {
  // Selection is stable across ordering changes. Forty percent leaves a safe margin
  // above the 30% acceptance gate; a refusal anywhere in a duplicate-text family
  // puts the whole family in holdout.
  return familyContainsRefusal.get(row.semanticFamily) === true ||
    stableFamilyHash(row.semanticFamily) % 100 < 40
}

function inferExpectedQueryKind(row: CanonicalQuestionRow): DnaChatQueryKind | null {
  // Annotation is independent from the runtime classifier. An explicit
  // question category is the strongest document signal; in three-column
  // tables the wording itself outranks the requested answer format (for
  // example, an "ilişki var mı?" question may still request a kanıt özeti).
  const category = normalizeBenchmarkText(row.sourceQuestionCategory ?? "")
  const label = normalizeBenchmarkText(row.expectedLabel)
  const question = normalizeBenchmarkText(row.question)

  if (label === "guvenli ret" || label === "bilgi bulunamadi") return null

  if (/\b(?:fark\w*|ayni sey|ayni terim|ayni kavram|ayni yapi|ayni mi\w*|karsit\w*|birbirine ters|nasil ayril\w*)\b/.test(question)) {
    return "comparison"
  }
  if (category === "dna iliskisi") return "dna_relation"
  if (category === "olcum") return "measurement"
  if (category === "gelisim" || label.startsWith("gelisimsel")) return "development"
  if (category === "kanit") return "evidence"
  if (category === "yanlis varsayim") return "misconception"
  if (category === "iliski") {
    return /\bdna\b/.test(question) ? "dna_relation" : "relation"
  }
  if (/\bdna\b/.test(question) && /\b(?:iliski|iliskilendir|alan|puan|profil|rapor|olcer|olcum|dogrula)\b/.test(question)) {
    return "dna_relation"
  }
  if (/\b(?:nasil olcul\w*|neyi olcer|ne olcer|olcum\w*|hangi olcum|sensor\w*|test bataryasi|neyi ifade eder)\b/.test(question)) {
    return "measurement"
  }
  if (/\b(?:iliski|iliskili|baglanti|katki|etkileyebilir|ayni anda|ayni yonde)\b/.test(question)) {
    return "relation"
  }
  if (/\b(?:kanit\w*|bilimsel|guvenilir\w*|biyobelirtec\w*|nedensel\w*|ongor\w*|kalici|aktaril\w*|tartismali|dogrulan\w*|yeterli|neden zor|dikkatle|tek basina|her zaman)\b/.test(question)) {
    return "evidence"
  }
  if (/\b(?:erken cocukluk|okul cagi|okul oncesi|bebek\w*|yenidogan\w*|infant\w*|ergen\w*|puberte|prematur\w*|dogumda|hangi yas|kac yas|yas ilerledikce|olgunlas\w*|yetiskin\w*.+cocuk\w*|cocuk\w*.+yetiskin\w*)\b/.test(question)) {
    return "development"
  }
  if (/\b(?:nedir|ne demek|ne anlama|ne kastediliyor|ne ise yarar|neyi gosterir|nasil calisir|icinde midir|ne yani)\b/.test(question)) {
    return "definition"
  }

  if (category === "karsilastirma" || label === "karsilastirma") return "comparison"
  if (label === "kuramsal iliski") return "relation"
  if (label === "kanit ozeti") return "evidence"
  if (category === "tanim" || label === "tanim") return "definition"
  // Ayrıntı/açıklama and refusal labels describe the desired response, not a
  // unique query intent, so no artificial kind label is invented for them.
  return null
}

type TopicRule = {
  topicId: string
  patterns: readonly RegExp[]
}

const TOPIC_RULES: readonly TopicRule[] = [
  { topicId: "ans.polyvagal", patterns: [/\b(?:poli|poly)vagal\b/, /\bdorsal vagal\b/, /\bventral vagal\b/, /\bvagal shutdown\b/] },
  { topicId: "ans.autonomic_space", patterns: [/\botonom uzam\b/, /\bsempatovagal denge\b/, /\bsempatik ve parasempatik sistemler ayni anda\b/] },
  { topicId: "ans.measurement_limits", patterns: [/\botonom test\b/, /\botonom olcum\b/, /\bans olcum\b/, /\bgiyilebilir\b/, /\bakilli saat\b/, /\becg\b/, /\bppg\b/, /\bpep\b/, /\bpupillometri\b/, /\bbarorefleks\b/] },
  { topicId: "cns.central_autonomic_network", patterns: [/\bmerkezi otonom ag\b/, /\bcentral autonomic network\b/, /\bcan\b/] },
  { topicId: "cns.reverse_inference", patterns: [/\btersine cikarim\b/, /\bdavranistan beyin bolgesi\b/, /\blokalizasyon hatasi\b/] },
  { topicId: "cns.distributed_networks", patterns: [/\bdagitik beyin ag/, /\bdagitik ag/, /\btek bir oz duzenleme merkezi\b/, /\bag duzeyi aciklama\b/] },
  { topicId: "cns.salience_network", patterns: [/\bsalience ag/, /\bonem ag/, /\bbelirginlik ag/] },
  { topicId: "cns.prefrontal_control", patterns: [/\bprefrontal korteks\b/, /\bfrontal lob\b/, /\bprefrontal cortex\b/] },
  { topicId: "cns.insula", patterns: [/\binsular korteks\b/, /\binsula\b/] },
  { topicId: "selfreg.self_control", patterns: [/\bself kontrol\b/, /\boz kontrol\b/] },
  { topicId: "selfreg.executive_functions", patterns: [/\byurutucu islev/, /\bexecutive function/, /\bketleyici kontrol\b/, /\binhibitor kontrol\b/, /\bcalisma bellegi\b/, /\bbilissel esneklik\b/] },
  { topicId: "selfreg.coregulation", patterns: [/\bes regulasyon\b/, /\bko regulasyon\b/, /\bco regulation\b/] },
  { topicId: "selfreg.reactivity_recovery", patterns: [/\breaktivite\b/, /\btepkisellik\b/, /\btoparlanma\b/] },
  { topicId: "ans.allostasis", patterns: [/\ballostaz\w*/, /\ballostatik\w*/] },
  { topicId: "ans.homeostasis", patterns: [/\bhomeostaz\w*/] },
  { topicId: "ans.hrv", patterns: [/\bhrv\b/, /\bhrw\b/, /\brsa\b/, /\brmssd\b/, /\bhf hrv\b/, /\blf hrv\b/, /\blf hf\b/, /\bkalp hizi degiskenlig/] },
  { topicId: "ans.eda", patterns: [/\beda\b/, /\belektrodermal\b/, /\bderi iletkenlig/] },
  { topicId: "ans.interoception", patterns: [/\binterosepsiyon\b/, /\binteroseptif\b/, /\bic duyum\b/] },
  { topicId: "ans.sympathetic_parasympathetic", patterns: [/\bsempatik\b/, /\bparasempatik\b/] },
  { topicId: "selfreg.core", patterns: [/\bself regulasyon\b/, /\boz duzenleme\b/] },
  { topicId: "cns.overview", patterns: [/\bmerkezi sinir sistemi\b/, /\bcns\b/] },
  { topicId: "ans.overview", patterns: [/\botonom sinir sistemi\b/, /\botonom sistem\b/, /\bans\b/] },
]

function inferExpectedTopicId(row: CanonicalQuestionRow): string | null {
  // Conservative semantic annotation against the published live-topic scope.
  // This list is deliberately independent from catalog search scores/aliases so
  // the benchmark can expose routing regressions instead of mirroring them.
  const normalized = normalizeBenchmarkText(row.question)

  if (
    /\b(?:cocuk|bebek|yenidogan|infant|okul oncesi|ergen|yetiskin|yas|norm|puberte|prematur)\b/.test(normalized) &&
    /\b(?:hrv|rsa|otonom|ans)\b/.test(normalized)
  ) return "ans.development"
  if (
    /\b(?:cocuk|erken cocukluk|okul cagi|ergen|yetiskin|yas)\b/.test(normalized) &&
    /\b(?:self regulasyon|oz duzenleme|regulasyon)\b/.test(normalized)
  ) return "selfreg.development"
  if (/\b(?:tek bir oz duzenleme merkezi|ag duzeyi aciklama)\b/.test(normalized)) {
    return "cns.distributed_networks"
  }
  if (/\bhomeostaz\w*/.test(normalized) && /\ballostaz\w*/.test(normalized)) {
    return "ans.allostasis"
  }

  let best: { topicId: string; index: number; length: number; ruleIndex: number } | null = null
  for (let ruleIndex = 0; ruleIndex < TOPIC_RULES.length; ruleIndex += 1) {
    const rule = TOPIC_RULES[ruleIndex]
    if (!rule) continue
    for (const pattern of rule.patterns) {
      const match = pattern.exec(normalized)
      if (!match) continue
      const candidate = { topicId: rule.topicId, index: match.index, length: match[0].length, ruleIndex }
      if (
        !best || candidate.index < best.index ||
        (candidate.index === best.index && candidate.length > best.length) ||
        (candidate.index === best.index && candidate.length === best.length && candidate.ruleIndex < best.ruleIndex)
      ) best = candidate
    }
  }
  return best?.topicId ?? null
}

function buildBenchmarkQuestion(row: CanonicalQuestionRow): DnaChatCatalogBenchmarkQuestion {
  const isRefusal = row.expectedLabel === "Güvenli ret"
  const expectedTopicId = inferExpectedTopicId(row)
  const isCanonicalNotAvailable = row.expectedLabel === "Bilgi bulunamadı"
  const evaluationScope = isRefusal
    ? "safety_refusal" as const
    : isCanonicalNotAvailable || !expectedTopicId
      ? "unsupported_safe" as const
      : "supported_answerable" as const

  return Object.freeze({
    version: DNA_CHAT_CATALOG_VERSION,
    id: `benchmark.${CATEGORY_ID_PREFIX[row.sourceCategory]}.${row.sourceCode.toLocaleLowerCase("tr-TR")}`,
    sourceCategory: row.sourceCategory,
    sourceCode: row.sourceCode,
    sourceQuestionCategory: row.sourceQuestionCategory,
    documentExpected: row.expectedLabel,
    canonicalRow: row.canonicalRow,
    semanticFamily: row.semanticFamily,
    question: row.question,
    expectedQueryKind: inferExpectedQueryKind(row),
    expectedTopicId,
    expected: isRefusal ? "refusal" : evaluationScope === "supported_answerable" ? "answer" : "not_available",
    evaluationScope,
    holdout: isHoldoutFamily(row),
  })
}

export const DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS: readonly DnaChatCatalogBenchmarkQuestion[] =
  Object.freeze(canonicalRows.map(buildBenchmarkQuestion))
