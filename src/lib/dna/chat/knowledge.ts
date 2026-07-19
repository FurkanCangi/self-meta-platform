import {
  CLINICAL_KNOWLEDGE_CHUNKS,
  WORD_RAG_SOURCE,
} from "../clinicalKnowledgeBase"
import {
  VERIFIED_LITERATURE_SOURCES,
  type LiteratureSource,
} from "../literatureNote"
import { questions } from "../questions"
import { scoreDnaTextMatch } from "./text"
import {
  DNA_CHAT_KNOWLEDGE_CONTRACT_VERSION,
  type DnaChatKnowledgeEntry,
  type DnaChatSourceRef,
} from "./types"
import {
  authorityForDnaContractSource,
  authorityForKnowledgeSourceType,
} from "./authorityRegistry"

const DOMAIN_LABELS: Record<string, string> = {
  physiological: "Fizyolojik regülasyon",
  sensory: "Duyusal regülasyon",
  emotional: "Duygusal regülasyon",
  cognitive: "Bilişsel regülasyon",
  executive: "Yürütücü işlev",
  interoception: "İnterosepsiyon",
}

const scaleCounts = questions.reduce<Record<string, number>>((counts, question) => {
  counts[question.scale] = (counts[question.scale] ?? 0) + 1
  return counts
}, {})

function legacyVerifiedEntry(
  input: Omit<DnaChatKnowledgeEntry, "version" | "evidenceStatus" | "reviewedAt">,
): DnaChatKnowledgeEntry {
  return Object.freeze({
    version: DNA_CHAT_KNOWLEDGE_CONTRACT_VERSION,
    evidenceStatus: "verified" as const,
    reviewedAt: "2026-07-15",
    ...input,
  })
}

export const DNA_CHAT_KNOWLEDGE_ENTRIES: readonly DnaChatKnowledgeEntry[] = Object.freeze([
  legacyVerifiedEntry({
    topic: "sinir-sistemi-genel-cerceve",
    summary:
      "Merkezi sinir sistemi (MSS), beyin ve omurilikte bilgiyi bütünleştiren ana yapıdır; otonom sinir sistemi (OSS) ise bedenin iç dengesine katılan istem dışı düzenleme süreçlerini kapsar.",
    details: [
      "Self-regülasyon, tek bir sinir sistemi bölümüne indirgenmez; bedensel uyarılma, duyusal yanıt, duygu, dikkat ve davranış bağlam içinde birlikte ele alınır.",
      "DNA gözlemsel ve ölçek temelli profil sunar; doğrudan sinir sistemi ölçümü yapmaz.",
    ],
    chunkIds: ["REGULATION_OVERVIEW", "REGULATION_INTERPRETATION_BOUNDARY"],
    sourceIds: ["BLAIR_RAVER_2015"],
    ageScope: "Genel gelişimsel çerçeve; erken çocuklukta bağlam ve eş-regülasyon özellikle önemlidir.",
    claimBoundary:
      "DNA skorlarından MSS veya OSS hastalığı, hasarı, dengesizliği ya da kesin biyolojik mekanizma çıkarılamaz.",
    keywords: ["mss", "oss", "merkezi sinir sistemi", "otonom sinir sistemi", "self regulasyon"],
    exampleQuestions: ["MSS ve OSS nedir?", "Sinir sistemi regülasyonu nasıl etkiler?"],
  }),
  legacyVerifiedEntry({
    topic: "otonom-sinir-sistemi",
    summary:
      "Otonom sinir sistemi, kalp hızı, solunum, sindirim ve uyarılma gibi iç beden süreçlerinin koşullara göre ayarlanmasına katılır.",
    details: [
      "Klinik tartışmada otonom düzenleme, uyarana verilen tepki ve sonrasındaki toparlanma örüntüsü üzerinden temkinli biçimde ele alınır.",
      "Doğrudan fizyolojik ölçüm yoksa gözlemsel bulgu, otonom işlev ölçümü gibi sunulmaz.",
    ],
    chunkIds: ["PHYSIOLOGICAL_REGULATION_CONSTRUCT", "PHYSIOLOGICAL_REGULATION_REPORT_LANGUAGE"],
    sourceIds: ["KAHLE_ET_AL_2018", "GRAZIANO_DEREFINKO_2013"],
    ageScope: "Gelişimsel çerçeve; okul öncesi kanıtlar grup düzeyindedir.",
    claimBoundary:
      "Otonom hastalık, vagal işlev bozukluğu veya kişiye özgü biyolojik neden sonucu üretmez.",
    keywords: ["oss", "otonom", "bedensel denge", "uyarilma", "toparlanma"],
    exampleQuestions: ["Otonom sinir sistemi nedir?", "Otonom düzenleme ne demek?"],
  }),
  legacyVerifiedEntry({
    topic: "sempatik-parasempatik-isleyis",
    summary:
      "Sempatik ve parasempatik süreçler, değişen taleplere göre enerji kullanımı ve bedensel toparlanmanın ayarlanmasına birlikte katılan otonom işleyişlerdir.",
    details: [
      "Bu süreçler basit bir açık-kapalı karşıtlığı değildir; bağlama göre eş zamanlı ve değişken örüntüler gösterebilir.",
      "DNA bu dalları doğrudan ölçmez; yalnız günlük işlevdeki uyarılma ve toparlanma örüntülerini betimler.",
    ],
    chunkIds: ["PHYSIOLOGICAL_REGULATION_CONSTRUCT", "REGULATION_INTERPRETATION_BOUNDARY"],
    sourceIds: ["KAHLE_ET_AL_2018"],
    ageScope: "Genel fizyoloji çerçevesi; vaka çıkarımı için doğrudan ölçüm gerekir.",
    claimBoundary:
      "Sempatik baskınlık, parasempatik yetersizlik, vagus tonu veya polyvagal durum etiketi çıkarılmaz.",
    keywords: ["sempatik", "parasempatik", "otonom dallar", "enerji", "toparlanma"],
    exampleQuestions: ["Sempatik ve parasempatik nasıl çalışır?", "Otonom dallar ne yapar?"],
  }),
  legacyVerifiedEntry({
    topic: "uyarilma-duzeyi",
    summary:
      "Uyarılma düzeyi, kişinin belirli bir anda çevresel ve içsel taleplere yanıt vermeye ne ölçüde hazır olduğunu anlatan değişken bedensel-davranışsal durumdur.",
    details: [
      "Aşırı veya düşük görünüm tek bir gözlemle sabit özellik olarak yorumlanmaz.",
      "Bağlam, yoğunluk, süre ve günlük katılıma etkisi birlikte ele alınır.",
    ],
    chunkIds: ["REGULATION_OVERVIEW", "PHYSIOLOGICAL_REGULATION_CONSTRUCT"],
    sourceIds: ["BLAIR_RAVER_2015"],
    ageScope: "Gelişim boyunca bağlama duyarlıdır; erken çocuklukta dış düzenleme etkisi belirgindir.",
    claimBoundary: "Tek başına nörolojik, psikiyatrik veya otonom bir durum göstermez.",
    keywords: ["uyarilma", "arousal", "hazir olma", "bedensel durum"],
    exampleQuestions: ["Uyarılma düzeyi nedir?", "Arousal ne demek?"],
  }),
  legacyVerifiedEntry({
    topic: "reaktivite",
    summary:
      "Reaktivite, bir uyaran veya talep karşısında tepkinin ne kadar hızlı ve yoğun ortaya çıktığını betimler.",
    details: [
      "Reaktivite ile toparlanma ayrı boyutlardır; güçlü ilk tepki mutlaka uzun toparlanma anlamına gelmez.",
      "Tekrarlanan bağlamlar ve işlevsel etkiler birlikte incelenir.",
    ],
    chunkIds: ["PHYSIOLOGICAL_REGULATION_CONSTRUCT", "REGULATION_REPORT_STYLE"],
    sourceIds: ["KAHLE_ET_AL_2018"],
    ageScope: "Okul öncesi kanıtı grup düzeyindedir; tek vaka için gözlem bağlamı gerekir.",
    claimBoundary: "Nedensellik, otonom hastalık veya sabit mizaç etiketi üretmez.",
    keywords: ["reaktivite", "tepki", "yogunluk", "uyaran"],
    exampleQuestions: ["Reaktivite nedir?", "Uyaran karşısındaki tepki nasıl yorumlanır?"],
  }),
  legacyVerifiedEntry({
    topic: "toparlanma",
    summary:
      "Toparlanma, uyarılma veya zorlanma sonrasında kişinin yeniden daha dengeli işlev düzeyine dönme sürecidir.",
    details: [
      "Süre, gereken dış destek ve farklı bağlamlarda tekrarlanma örüntüsü birlikte değerlendirilir.",
      "Toparlanma hızı yaş, yorgunluk, uyku, çevresel talep ve eş-regülasyonla değişebilir.",
    ],
    chunkIds: ["PHYSIOLOGICAL_REGULATION_CONSTRUCT", "EMOTIONAL_REGULATION_CONSTRUCT"],
    sourceIds: ["KAHLE_ET_AL_2018"],
    ageScope: "Gelişimsel ve bağlamsal bir süreçtir; erken çocuklukta yetişkin desteği olağandır.",
    claimBoundary: "Tek başına tanı, prognoz veya belirli bir biyolojik mekanizma göstermez.",
    keywords: ["toparlanma", "sakinlesme", "dengeye donus", "stres sonrasi"],
    exampleQuestions: ["Toparlanma nedir?", "Sakinleşme süresi neyi anlatır?"],
  }),
  legacyVerifiedEntry({
    topic: "uyku-ve-gunluk-ritim",
    summary:
      "Uyku ve günlük ritim, enerji düzeyi, uyarılma dengesi ve zorlanma sonrası toparlanmanın bağlamsal zeminidir.",
    details: [
      "Uykuya geçiş, gece uyanmaları, yorgunluk ve rutin değişimleri fizyolojik regülasyon yorumuna bağlamsal ağırlık katar.",
      "Ölçek bulgusu tıbbi uyku değerlendirmesi yerine geçmez.",
    ],
    chunkIds: ["ANAMNESIS_SLEEP_AND_ROUTINE", "PHYSIOLOGICAL_REGULATION_ANAMNESIS_INTEGRATION"],
    sourceIds: ["BLAIR_RAVER_2015"],
    ageScope: "Erken çocuklukta rutin, bakımveren desteği ve gelişim dönemiyle birlikte yorumlanır.",
    claimBoundary: "Uyku bozukluğu, tıbbi neden veya tedavi gerekliliği çıkarılmaz.",
    keywords: ["uyku", "ritim", "rutin", "yorgunluk", "gece uyanma"],
    exampleQuestions: ["Uyku regülasyonu nasıl etkiler?", "Günlük ritim neden önemlidir?"],
  }),
  legacyVerifiedEntry({
    topic: "dikkat-ve-yurutucu-kontrol",
    summary:
      "Dikkat ve yürütücü kontrol; odağı sürdürme, bilgiyi zihinde tutma, davranışı duruma göre ayarlama ve hedefe yönelik akışı yönetmede birlikte çalışan süreçlerdir.",
    details: [
      "Bilişsel regülasyon bilgi işleme ve odağı, yürütücü işlev ise başlatma, durdurma, esneklik ve sıralı organizasyonu öne çıkarır.",
      "İki alan ilişkili olsa da aynı yapı olarak veya tek bulgudan tanısal sonuç çıkarılarak yorumlanmaz.",
    ],
    chunkIds: ["COGNITIVE_REGULATION_CONSTRUCT", "EXECUTIVE_FUNCTION_CONSTRUCT", "CROSS_SCALE_COGNITIVE_EXECUTIVE"],
    sourceIds: ["DIAMOND_2013"],
    ageScope: "Gelişimsel kapasitelerdir; görev talebi ve yapılandırma performansı etkiler.",
    claimBoundary: "Dikkat güçlüğünden ADHD, yürütücü bozukluk veya akademik sonuç çıkarılmaz.",
    keywords: ["dikkat", "yurutucu kontrol", "bilissel kontrol", "calisma bellegi", "esneklik"],
    exampleQuestions: ["Dikkat ve yürütücü kontrol nasıl ilişkilidir?", "Bilişsel kontrol ne demek?"],
  }),
])

export const DNA_CHAT_KNOWLEDGE_ENTRY_BY_TOPIC = new Map(
  DNA_CHAT_KNOWLEDGE_ENTRIES.map((entry) => [entry.topic, entry]),
)

const DNA_CONTRACT_SOURCES: Record<string, Omit<DnaChatSourceRef, "authority">> = {
  assessment_overview: {
    id: "dna:assessment_overview",
    type: "dna_contract",
    title: "DNA değerlendirme bilgi sözleşmesi",
    labelTr: "Değerlendirme kapsamı",
    excerptTr:
      "DNA, self-regülasyon profilini altı işlevsel alanda betimleyen yapılandırılmış bir değerlendirmedir.",
    claimBoundary: "Tek başına tanı, kesin neden, prognoz veya klinik karar üretmez.",
  },
  domain_contract: {
    id: "dna:domain_contract",
    type: "dna_contract",
    title: "DNA alan sözleşmesi",
    labelTr: "Altı değerlendirme alanı",
    excerptTr:
      "Fizyolojik, duyusal, duygusal, bilişsel, yürütücü işlev ve interosepsiyon alanları birlikte değerlendirilir.",
    claimBoundary: "Alanlar birbirinden kopuk veya tanısal kategoriler olarak yorumlanmaz.",
  },
  question_contract: {
    id: "dna:question_contract",
    type: "dna_contract",
    title: "DNA soru seti sözleşmesi",
    labelTr: "Soru seti yapısı",
    excerptTr: `Soru setinde ${questions.length} madde vardır; altı alanın her biri ${Math.min(...Object.values(scaleCounts))} maddeyle temsil edilir.`,
    claimBoundary: "Ham madde yanıtları ve danışana ait soru bazlı cevaplar sohbet kaynağına açılmaz.",
  },
  scoring_contract: {
    id: "dna:scoring_contract",
    type: "dna_contract",
    title: "DNA puanlama sözleşmesi",
    labelTr: "Skor yorum sınırı",
    excerptTr:
      "Alan ham skorları 10-50 aralığında bağlamsal ve göreli bir profil olarak ele alınır; ilk beş alan ters, interosepsiyon doğrudan puanlanır.",
    claimBoundary: "Tek bir skor bozukluk, tanı, neden veya tedavi gerekliliği göstermez.",
  },
  report_contract: {
    id: "dna:report_contract",
    type: "dna_contract",
    title: "DNA rapor sözleşmesi",
    labelTr: "Kaynak bağlı klinik sentez",
    excerptTr:
      "Rapor; skor, anamnez, gözlem ve varsa ek test verilerini ana örüntü, karşı kanıt, korunmuş kapasite ve sınırlılıklar halinde birleştirir.",
    claimBoundary: "Rapor klinisyen değerlendirmesinin yerine geçmez.",
  },
  evidence_contract: {
    id: "dna:evidence_contract",
    type: "dna_contract",
    title: "DNA kanıt sözleşmesi",
    labelTr: "Kilitli bilgi ve kaynak kullanımı",
    excerptTr: `Yanıtlar mevcut klinik bilgi tabanı (${WORD_RAG_SOURCE.sourceChunkCount} kaynak parçası), doğrulanmış literatür kataloğu ve açık kimliksiz vaka bağlamıyla sınırlıdır.`,
    claimBoundary: "Kaynak bulunmadığında yeni klinik bilgi üretilmez.",
  },
  privacy_contract: {
    id: "dna:privacy_contract",
    type: "dna_contract",
    title: "DNA mahremiyet sözleşmesi",
    labelTr: "Kimliksiz vaka bağlamı",
    excerptTr:
      "Sohbet yalnız sentetik veya kimliksizleştirilmiş, açık vakaya ait sınırlı bağlamı kabul eder.",
    claimBoundary: "Doğrudan tanımlayıcılar, ham yanıtlar ve vakalar arası karşılaştırma kapsam dışıdır.",
  },
  age_contract: {
    id: "dna:age_contract",
    type: "dna_contract",
    title: "DNA gelişimsel bağlam sözleşmesi",
    labelTr: "Yaş ve gelişim dönemi",
    excerptTr:
      "Yaş, gelişim dönemi, çevresel yapı ve bakımveren eş-regülasyonu bulguların bağlamsal yorumunu etkiler.",
    claimBoundary: "Yaşa dayalı otomatik tanı veya sonuç çıkarımı yapılmaz.",
  },
  use_contract: {
    id: "dna:use_contract",
    type: "dna_contract",
    title: "DNA kullanım sözleşmesi",
    labelTr: "Klinisyen denetimli kullanım",
    excerptTr:
      "DNA, eğitimli terapistin yapılandırılmış değerlendirme ve klinik akıl yürütme sürecine yardımcı olmak için kullanılır.",
    claimBoundary: "Bağımsız klinik karar sistemi değildir.",
  },
}

function cleanKnowledgeTitle(id: string): string {
  return id
    .toLocaleLowerCase("tr-TR")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
    .join(" ")
}

function knowledgeSource(sourceId: string): DnaChatSourceRef | null {
  const id = sourceId.replace(/^kb:/, "")
  const chunk = CLINICAL_KNOWLEDGE_CHUNKS.find((candidate) => candidate.id === id)
  if (!chunk) return null
  return {
    id: `kb:${chunk.id}`,
    type: "clinical_kb",
    title: cleanKnowledgeTitle(chunk.id),
    labelTr: chunk.domain ? DOMAIN_LABELS[chunk.domain] ?? chunk.domain : "DNA klinik bilgi tabanı",
    excerptTr: chunk.text,
    claimBoundary:
      "Bu bilgi betimleyici klinik açıklama içindir; tek vaka için tanı, kesin neden veya uygulama talimatı üretmez.",
    authority: authorityForKnowledgeSourceType("clinical_kb"),
  }
}

function literatureYear(source: LiteratureSource): number | undefined {
  if (source.publicationYear) return source.publicationYear
  const match = source.apaReference.match(/\((19|20)\d{2}\)/)
  return match ? Number(match[0].slice(1, -1)) : undefined
}

function literatureSource(sourceId: string): DnaChatSourceRef | null {
  const id = sourceId.replace(/^lit:/, "")
  const source = VERIFIED_LITERATURE_SOURCES[id]
  if (!source) return null
  return {
    id: `lit:${source.id}`,
    type: "literature",
    title: source.apaReference,
    labelTr: source.inlineCitation,
    excerptTr: source.claimBoundary,
    citation: source.inlineCitation,
    year: literatureYear(source),
    doi: source.doi,
    url: source.url,
    claimBoundary: source.claimBoundary,
    authority: authorityForKnowledgeSourceType("literature"),
  }
}

function knowledgeEntrySource(sourceId: string): DnaChatSourceRef | null {
  const topic = sourceId.replace(/^chat:/, "")
  const entry = DNA_CHAT_KNOWLEDGE_ENTRY_BY_TOPIC.get(topic)
  if (!entry) return null
  return {
    id: `chat:${entry.topic}`,
    type: "knowledge_entry",
    title: entry.exampleQuestions[0] ?? entry.topic,
    labelTr: "Kaynağı doğrulanmış geçiş bilgi girişi",
    excerptTr: entry.summary,
    claimBoundary: entry.claimBoundary,
    authority: authorityForKnowledgeSourceType("knowledge_entry"),
  }
}

export function resolveDnaChatSource(sourceId: string): DnaChatSourceRef | null {
  if (sourceId.startsWith("kb:")) return knowledgeSource(sourceId)
  if (sourceId.startsWith("lit:")) return literatureSource(sourceId)
  if (sourceId.startsWith("chat:")) return knowledgeEntrySource(sourceId)
  if (sourceId.startsWith("dna:")) {
    const sourceName = sourceId.slice(4)
    const source = DNA_CONTRACT_SOURCES[sourceName]
    return source ? { ...source, authority: authorityForDnaContractSource(sourceName) } : null
  }
  return null
}

export function resolveDnaChatSources(
  sourceIds: readonly string[],
  limit = 4,
): DnaChatSourceRef[] {
  const seen = new Set<string>()
  const sources: DnaChatSourceRef[] = []
  for (const sourceId of sourceIds) {
    const source = resolveDnaChatSource(sourceId)
    if (!source || seen.has(source.id)) continue
    seen.add(source.id)
    sources.push(source)
    if (sources.length >= limit) break
  }
  return sources
}

export function findDnaChatLiteratureSources(query: string, limit = 2): DnaChatSourceRef[] {
  return Object.values(VERIFIED_LITERATURE_SOURCES)
    .map((source) => {
      const match = scoreDnaTextMatch(query, [
        source.evidenceDomain,
        source.catalogArea ?? "",
        source.claimBoundary,
        ...(source.relevanceTags ?? []),
      ])
      return { source, score: match.score }
    })
    .filter((entry) => entry.score >= 0.2)
    .sort((left, right) => right.score - left.score || left.source.id.localeCompare(right.source.id))
    .slice(0, Math.max(0, limit))
    .map((entry) => literatureSource(`lit:${entry.source.id}`))
    .filter((source): source is DnaChatSourceRef => Boolean(source))
}
