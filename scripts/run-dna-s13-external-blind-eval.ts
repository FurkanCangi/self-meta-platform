import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import dotenv from "dotenv"

import denseKnowledgeRuntimeJson from "../src/lib/dna/chat/catalog/generated/dense/runtime.json"
import { resolveDnaChatApiRequest } from "../src/lib/dna/chat/apiResolver"
import { resolveCommittedDnaChatRuntime } from "../src/lib/dna/chat/v3RetrievalServer"
import { calculateDnaChatLunaUsage, type DnaChatLunaUsage } from "../src/lib/dna/chat/lunaUsage"
import { DNA_CHAT_LUNA_MODEL } from "../src/lib/dna/chat/lunaPolicy"
import { normalizeDnaChatText } from "../src/lib/dna/chat/text"
import type { DnaS13Depth } from "../src/lib/dna/chat/s13/contracts"
import { resolveDnaS13NamedTopicSurfaces } from "../src/lib/dna/chat/s13/conversationContext"
import { resolveDnaS13NoRepeatConstraint } from "../src/lib/dna/chat/s13/pragmaticTask"
import { hashDnaS13LimitedIdentifier } from "../src/lib/dna/chat/s13/limitedRollout/context.server"
import { inspectDnaS13LimitedRolloutPrivacy } from "../src/lib/dna/chat/s13/limitedRollout/privacy"
import {
  runDnaS13LimitedRolloutMessage,
  type DnaS13LimitedTechnicalEvidence,
} from "../src/lib/dna/chat/s13/limitedRollout/runner.server"
import { LunaRealizer } from "../src/lib/dna/chat/s13/strictLunaRealizer.server"
import {
  DeterministicRealizer,
  type DnaS13RealizerAttempt,
  type DnaS13RealizerRequest,
  type Realizer,
} from "../src/lib/dna/chat/s13/strictRealizer"

dotenv.config({ path: ".env.local", override: false, quiet: true })

const DIAGNOSTIC_REPLAY_001 = process.argv.includes("--diagnostic-replay-001")
const DIAGNOSTIC_REPLAY_002 = process.argv.includes("--diagnostic-replay-002")
const DIAGNOSTIC_REPLAY_003 = process.argv.includes("--diagnostic-replay-003")
const DIAGNOSTIC_REPLAY_004 = process.argv.includes("--diagnostic-replay-004")
const DIAGNOSTIC_REPLAY_005 = process.argv.includes("--diagnostic-replay-005")
const DIAGNOSTIC_REPLAY_006 = process.argv.includes("--diagnostic-replay-006")
const DIAGNOSTIC_REPLAY = DIAGNOSTIC_REPLAY_001 || DIAGNOSTIC_REPLAY_002 || DIAGNOSTIC_REPLAY_003 || DIAGNOSTIC_REPLAY_004 || DIAGNOSTIC_REPLAY_005 || DIAGNOSTIC_REPLAY_006
const LOCAL_DIAGNOSTIC_PREFLIGHT = process.argv.includes("--local-deterministic-preflight")
const EXTERNAL_BLIND_EVAL_002 = process.argv.includes("--eval-002")
const EXTERNAL_BLIND_EVAL_003 = process.argv.includes("--eval-003")
const EXTERNAL_BLIND_EVAL_004 = process.argv.includes("--eval-004")
const EXTERNAL_BLIND_EVAL_005 = process.argv.includes("--eval-005")
const EXTERNAL_BLIND_EVAL_006 = process.argv.includes("--eval-006")
const EXTERNAL_BLIND_EVAL_007 = process.argv.includes("--eval-007")
const PACKAGE_COMPLETED_RUN = process.argv.includes("--package-completed-run")
const RETRY_EVAL_002_CONVERSATION = process.argv.find((value) => value.startsWith("--retry-eval-002-conversation="))
  ?.slice("--retry-eval-002-conversation=".length) || null
const RETRY_DIAGNOSTIC_CONVERSATION = process.argv.find((value) => value.startsWith("--retry-diagnostic-conversation="))
  ?.slice("--retry-diagnostic-conversation=".length) || null
const RETRY_CONVERSATION = RETRY_EVAL_002_CONVERSATION ?? RETRY_DIAGNOSTIC_CONVERSATION
const DIAGNOSTIC_RUN_ID = process.argv.find((value) => value.startsWith("--diagnostic-run-id="))?.slice(20) || "001"
const PRIOR_ATTEMPT_SPENT_MICROUSD = Math.max(0, Number(process.argv
  .find((value) => value.startsWith("--prior-attempt-spent-microusd="))
  ?.slice("--prior-attempt-spent-microusd=".length) || 0))
const EVALUATION_ID = DIAGNOSTIC_REPLAY_001
  ? `DNA_S13_EXTERNAL_BLIND_DIAGNOSTIC_REPLAY_001_RUN_${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "_LOCAL_PREFLIGHT" : ""}`
  : DIAGNOSTIC_REPLAY_002
    ? `DNA_S13_EXTERNAL_BLIND_DIAGNOSTIC_REPLAY_002_EVIDENCE_SEMANTICS_RUN_${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "_LOCAL_PREFLIGHT" : ""}`
  : DIAGNOSTIC_REPLAY_003
    ? `DNA_S13_EXTERNAL_BLIND_DIAGNOSTIC_REPLAY_003_SEMANTIC_OPERATION_RUN_${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "_LOCAL_PREFLIGHT" : ""}`
  : DIAGNOSTIC_REPLAY_006
    ? `DNA_S13_EXTERNAL_BLIND_DIAGNOSTIC_REPLAY_006_PRAGMATIC_SUFFICIENCY_RUN_${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "_LOCAL_PREFLIGHT" : ""}`
  : DIAGNOSTIC_REPLAY_005
    ? `DNA_S13_EXTERNAL_BLIND_DIAGNOSTIC_REPLAY_005_STRUCTURAL_SEMANTICS_RUN_${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "_LOCAL_PREFLIGHT" : ""}`
  : DIAGNOSTIC_REPLAY_004
    ? `DNA_S13_EXTERNAL_BLIND_DIAGNOSTIC_REPLAY_004_PRAGMATIC_TASK_RUN_${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "_LOCAL_PREFLIGHT" : ""}`
  : EXTERNAL_BLIND_EVAL_007
    ? "DNA_S13_EXTERNAL_BLIND_EVAL_007"
  : EXTERNAL_BLIND_EVAL_006
    ? "DNA_S13_EXTERNAL_BLIND_EVAL_006"
  : EXTERNAL_BLIND_EVAL_005
    ? "DNA_S13_EXTERNAL_BLIND_EVAL_005"
  : EXTERNAL_BLIND_EVAL_004
    ? "DNA_S13_EXTERNAL_BLIND_EVAL_004"
  : EXTERNAL_BLIND_EVAL_003
    ? "DNA_S13_EXTERNAL_BLIND_EVAL_003"
    : EXTERNAL_BLIND_EVAL_002 ? "DNA_S13_EXTERNAL_BLIND_EVAL_002" : "DNA_S13_EXTERNAL_BLIND_EVAL_001"
const SCHEMA_VERSION = "dna-s13-external-blind-eval@1"
const HARD_CAP_MICROUSD = 1_000_000
const CALL_RESERVE_MICROUSD = 25_000
const NEAR_PARAPHRASE_THRESHOLD = 0.82
const SSD_ROOT = process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD"
const OUTPUT_PARENT = path.join(
  SSD_ROOT,
  "Outputs/SelfMetaAI/dna-intelligence/external-blind-evaluation",
)
const OUTPUT_DIR = path.join(OUTPUT_PARENT, RETRY_CONVERSATION
  ? `${DIAGNOSTIC_REPLAY_001 ? `diagnostic-replay-001-run-${DIAGNOSTIC_RUN_ID}` : "002"}-retry-${RETRY_CONVERSATION}`
  : DIAGNOSTIC_REPLAY_001
  ? `diagnostic-replay-001-after-targeted-fixes-run-${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "-local-preflight" : ""}`
  : DIAGNOSTIC_REPLAY_002
    ? `diagnostic-replay-002-after-evidence-semantics-run-${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "-local-preflight" : ""}`
  : DIAGNOSTIC_REPLAY_003
    ? `diagnostic-replay-003-after-semantic-operation-run-${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "-local-preflight" : ""}`
  : DIAGNOSTIC_REPLAY_006
    ? `diagnostic-replay-006-after-pragmatic-sufficiency-run-${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "-local-preflight" : ""}`
  : DIAGNOSTIC_REPLAY_005
    ? `diagnostic-replay-005-after-structural-semantics-run-${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "-local-preflight" : ""}`
  : DIAGNOSTIC_REPLAY_004
    ? `diagnostic-replay-004-after-pragmatic-task-run-${DIAGNOSTIC_RUN_ID}${LOCAL_DIAGNOSTIC_PREFLIGHT ? "-local-preflight" : ""}`
  : EXTERNAL_BLIND_EVAL_007 ? "007"
  : EXTERNAL_BLIND_EVAL_006 ? "006"
  : EXTERNAL_BLIND_EVAL_005 ? "005"
  : EXTERNAL_BLIND_EVAL_004 ? "004"
  : EXTERNAL_BLIND_EVAL_003 ? "003"
  : EXTERNAL_BLIND_EVAL_002 ? "002" : "001")
const ZIP_PATH = path.join(OUTPUT_PARENT, RETRY_CONVERSATION
  ? `${EVALUATION_ID}_RETRY_${RETRY_CONVERSATION.toUpperCase()}.zip`
  : `${EVALUATION_ID}.zip`)
const CANONICAL_EVAL_002_DIR = path.join(OUTPUT_PARENT, "002")
const CANONICAL_EVAL_002_ZIP = path.join(OUTPUT_PARENT, "DNA_S13_EXTERNAL_BLIND_EVAL_002.zip")
const INTERNAL_EVIDENCE_JARGON = /(?:doğrulanmış kapsam|mevcut doğrulanmış içerik|yeterli doğrulanmış açıklama|kilitli içerik|locked claim|\bclaims?\b|\bfacet\w*\b|system\.facet-boundary|\bcatalog\b|\bkatalog\b|\btopicid\b|\brequiredclaim\b|\bsupport claim\b|\bevidence status\b)/giu
const FILES = Object.freeze({
  blindMarkdown: path.join(OUTPUT_DIR, EXTERNAL_BLIND_EVAL_007 ? "BLIND_CONVERSATIONS.md" : "BLIND_CONVERSATION_REVIEW.md"),
  blindJson: path.join(OUTPUT_DIR, "blind-conversations.json"),
  sealed: path.join(OUTPUT_DIR, "SEALED_TECHNICAL_EVIDENCE.jsonl"),
  summary: path.join(OUTPUT_DIR, EXTERNAL_BLIND_EVAL_007 ? "objective-summary.json" : "objective-run-summary.json"),
  manifest: path.join(OUTPUT_DIR, "manifest.json"),
})

type Profile = "A" | "B" | "C" | "D" | "E" | "F"
type TopicGroup = Readonly<{ a: string; b: string; c: string }>
type Scenario = Readonly<{
  conversationId: string
  profile: Profile
  depth: DnaS13Depth
  messages: readonly string[]
  intentTags?: readonly string[]
}>
type BlindTurn = Readonly<{ role: "user" | "assistant"; text: string }>
type BlindConversation = Readonly<{ conversationId: string; turns: readonly BlindTurn[] }>
type PublicConversationContext = Readonly<{
  topicIds: readonly string[]
  lastQueryKind: "definition" | "comparison" | "relation" | "measurement" | "development" | "evidence" | "case" | "unknown"
}>

const PROFILES: readonly Profile[] = Object.freeze(["A", "B", "C", "D", "E", "F"])
const SOCIAL_TRANSITIONS = new Map<number, string>([
  [0, "iyi akşamlar kolay gelsin"],
  [11, "keyfin nasıl"],
  [22, "sen nesin"],
  [33, "ne işe yarıyorsun"],
  [44, "bana nasıl yardım edebilirsin"],
  [55, "selam nasılsın"],
])

const TOPIC_GROUPS: readonly TopicGroup[] = Object.freeze([
  { a: "Self-Regülasyon Nedir?", b: "Allostaz: Değişerek Dengeyi Sağlamak", c: "Hedef Sakinlik Değil Katılım Olmalıdır" },
  { a: "Arousal, Uyanıklık ve Dikkat Arasındaki Ayrım", b: "Stres Reaktivitesi ve Toparlanma", c: "Fizyolojik Hazır Oluş" },
  { a: "Sempatik Sistem", b: "Parasempatik Sistem", c: "Enterik Sinir Sistemi" },
  { a: "HRV Neyi Gösterir, Neyi Göstermez?", b: "Kalp Hızı Değişkenliği Nedir?", c: "Tek Bir Fizyolojik Ölçümle Regülasyon Belirleme" },
  { a: "İnterosepsiyonun Temel Boyutları", b: "Metakognitif İnteroseptif Farkındalık", c: "İnteroseptif Doğruluk" },
  { a: "Duyusal Modülasyon", b: "Duyusal Ayırt Etme", c: "Dunn’ın Duyusal İşleme Çerçevesi" },
  { a: "Duygusal Anlamlandırma", b: "Bilişsel Duygu Düzenleme", c: "Duygunun Oluşumu ve Düzenlenmesi" },
  { a: "Seçici Dikkat", b: "Sürdürülen Dikkat", c: "Bölünmüş Dikkat" },
  { a: "Çalışma Belleği ve Kısa Süreli Bellek", b: "Sözel Çalışma Belleği", c: "Görsel-Uzamsal Çalışma Belleği" },
  { a: "Yürütücü İşlevlerin Temel Yapısı", b: "Soğuk Yürütücü İşlevler", c: "Sıcak Yürütücü İşlevler" },
  { a: "Uyku ve Fizyolojik Durum", b: "Sirkadiyen Sistem ve Uyku Basıncı", c: "Uyku Bir Fizyolojik Süreç ve Okupasyondur" },
  { a: "Ko-Regülasyon ve Yetişkin Desteği", b: "Sosyal Tamponlama ve Fizyolojik Ko-Regülasyon", c: "Self-Regülasyonun Sosyal Kökeni" },
  { a: "Gelişimsel Değişkenlik", b: "Self-Regülasyonun Dinamik Sistemler Açısından Okunması", c: "Self-Regülasyonun Transaksiyonel Olarak Gelişmesi" },
  { a: "HPA Ekseninin Temel İşleyişi", b: "Akut Stres ve Kronik Stres", c: "Stres Reaktivitesi ve Toparlanma" },
  { a: "Salience Ağı", b: "Frontoparietal Kontrol Ağı", c: "Varsayılan Mod Ağı" },
  { a: "Homeostaz: İç Dengenin Korunması", b: "Allostaz ve İnteroseptif Regülasyon", c: "Fizyolojik Regülasyonun Self-Regülasyon İçindeki Yeri" },
  { a: "Okupasyon Bir Regülasyon Bağlamıdır", b: "Okupasyonel Performans", c: "Aktivite, Performans ve Katılım Arasındaki Ayrım" },
  { a: "Ölçüm Sorunları", b: "Fizyolojik Ölçümler", c: "Davranışsal Derecelendirme Ölçekleri" },
  { a: "DNA Intelligence İçin Merkezî Bir Çerçeve", b: "DNA Intelligence İnteroseptif–Salience Regülasyon Modeli", c: "DNA Intelligence Açısından Bilişsel Regülasyonun Modellenmesi" },
  { a: "Salience ile Arousal Arasındaki Ayrım", b: "Salience ile Dikkat Arasındaki Ayrım", c: "Duyusal İşleme ile Arousal Arasındaki İlişki" },
])

const FOLLOW_UPS = Object.freeze([
  "Neden önemli; az önceki çerçevenin dışına çıkmadan gerekçeyi ayırır mısın?",
  "Peki niye; son yanıtın dayandığı sınırı da tek cümlede belirtir misin?",
  "Bunun önemi ne; kavram ile yorum arasındaki çizgiyi koruyarak söyler misin?",
  "Daha basit anlat; toplantıda aktarılabilecek kadar yalınlaştırır mısın?",
  "Günlük dille söyler misin; teknik anlamı kaybetmeden yeniden kurar mısın?",
  "Teknik olmadan anlat; ancak önceki yanıtın kapsamını genişletme.",
  "Örnek verir misin; yalnız doğrulanmış çerçevenin izin verdiği kadar somutlaştır.",
  "Günlük hayattan örnek; ama örnekten yeni bir kural çıkarmadan anlat.",
  "Biraz daha detay; özellikle önceki açıklamadaki işleyiş basamağını aç.",
  "Bu başlığı biraz derinleştir; yeni neden-sonuç bağı eklemeden ilerle.",
])

const PROFILE_FOLLOW_UP_TAIL: Readonly<Record<Profile, string>> = Object.freeze({
  A: " Lütfen profesyonel bir dille bitir.",
  B: " kısa yaz olur mu",
  C: " Kavramsal türleri açık tut.",
  D: " Tek ana fikir yeter.",
  E: " Gereksiz kesinlik istemiyorum.",
  F: " Hangi tarafı kastettiğini de belirt.",
})

const CLOSING_FOLLOW_UPS: Readonly<Record<Profile, readonly string[]>> = Object.freeze({
  A: Object.freeze(["Neden önemli; son karşılaştırmadaki ortak zemini aşmadan açıklar mısın?", "Biraz daha detay; profesyonel bir özet düzeninde sürdür."]),
  B: Object.freeze(["peki niye, son dedigin yerden devam etsene", "daha basit anlat, uzatmadan toparla"]),
  C: Object.freeze(["Bu başlığı biraz derinleştir; düzey, süreç ve ölçüm iddialarını karıştırma.", "Bunun önemi ne; çıkarım sınırını açık tut."]),
  D: Object.freeze(["Günlük dille söyler misin; tek ana fikirle bitir.", "Örnek verir misin; çok kısa olsun."]),
  E: Object.freeze(["Peki niye; bu kez genelleme yapmadan savını sınırla.", "Daha basit anlat; iddianın fazlasını geri çek."]),
  F: Object.freeze(["Burada ne anlatılıyor; son konuştuğumuz tarafı mı kastediyor?", "Nasıl yani; hangi düzeyden söz ettiğini netleştir."]),
})

function opener(profile: Profile, topic: string) {
  if (profile === "A") return `${topic} kavramının sınırlarını, komşu kavramlara taşmadan açıklar mısın?`
  if (profile === "B") return `ya ${topic} diyolar ya, tam olarak neyi kapsıyo?`
  if (profile === "C") return `${topic} için temel anlamı, işlevi ve yorumlama sınırını aynı çerçevede ayrıştır.`
  if (profile === "D") return `${topic} ne anlatıyor? Çok basit başla.`
  if (profile === "E") return `Şu başlık tartışılırken ${topic} her şeyi açıklıyormuş gibi konuşuluyor; gerçekten kapsamı ne?`
  return `${topic} tarafını açabilir misin; özellikle neye karşılık geliyor?`
}

function comparison(profile: Profile, group: TopicGroup) {
  if (profile === "B") return `${group.b} ile ${group.c} arasındaki fark ne, aynı şeye mi çıkıyolar?`
  if (profile === "C") return `${group.b} ile ${group.c} arasındaki karşılaştırmayı kavramsal düzey ve kanıt sınırıyla kur.`
  if (profile === "D") return `${group.b} ile ${group.c} aynı şey mi? Kısaca ayır.`
  if (profile === "E") return `${group.b} ve ${group.c} karşılaştır; birini öbürünün nedeni ilan etme.`
  if (profile === "F") return `${group.b} ile ${group.c} arasındaki ilişki mi fark mı daha güvenli söylenebilir?`
  return `${group.b} ile ${group.c} arasındaki farkı, yeni bir nedensellik kurmadan açıklar mısın?`
}

function correction(profile: Profile, group: TopicGroup) {
  if (profile === "B") return `yok ilkini deil digerini, yani ${group.c} tarafını soruyom`
  if (profile === "C") return `Hayır, birincisini değil diğerini; ${group.c} başlığını kendi teknik sınırlarıyla ele al.`
  if (profile === "D") return `İlkini değil diğerini anlat; ${group.c} olsun.`
  if (profile === "E") return `Onu değil ${group.c} demek istedim; karşılaştırmayı bırak ve düzelt.`
  if (profile === "F") return `İkincisini soruyorum, diğerini değil; galiba ${group.c} tarafıydı.`
  return `İlkini değil diğerini soruyorum; ${group.c} başlığında kalır mısın?`
}

function topicSwitch(profile: Profile, group: TopicGroup) {
  if (profile === "B") return `konu değişsin: ${group.b} tek başına ne anlatıyo?`
  if (profile === "C") return `Şimdi ${group.b} başlığına geç: ölçüm, süreç ve kuramsal yorum sınırlarını karıştırmadan açıkla.`
  if (profile === "D") return `Başka konu: ${group.b} basitçe nedir?`
  if (profile === "E") return `${group.b} için de aynı kesinlikte konuşulabilir mi; önce kavramın temel anlamını düzgün kur.`
  if (profile === "F") return `Şimdi ${group.b} tarafı... bunun önceki konudan ayrı anlamı ne?`
  return `Konuyu ${group.b} başlığına çevirelim; temel anlamını ve sınırını açıklar mısın?`
}

function compound(profile: Profile, group: TopicGroup) {
  if (profile === "B") return `${group.a} neydi? bi de ${group.c} neden önemli, ayrı ayrı yaz`
  if (profile === "C") return `${group.a} hangi kavramsal işlevi görür? Ayrıca ${group.c} hangi yorumlama sınırını taşır? İki yanıtı ayır.`
  if (profile === "D") return `${group.a} nedir? Sonra ${group.c} neden önemli? İkisini ayrı söyle.`
  if (profile === "E") return `${group.a} her şeyi açıklamaz, değil mi? Bir de ${group.c} için gerçekten ne söylenebilir? Ayrı yanıtla.`
  if (profile === "F") return `${group.a} mı temel olan? ${group.c} da aynı sorunun başka adı mı; iki kısmı ayırabilir misin?`
  return `${group.a} hangi soruyu yanıtlar? Ardından ${group.c} neden önemlidir? İki bölümü ayrı tutar mısın?`
}

function buildMessages(index: number, profile: Profile, group: TopicGroup, length: number) {
  const variant = Math.floor(index / PROFILES.length)
  const spokenGroup = Object.freeze({
    a: group.a.toLocaleLowerCase("tr-TR"),
    b: group.b.toLocaleLowerCase("tr-TR"),
    c: group.c.toLocaleLowerCase("tr-TR"),
  })
  const scientific = [
    opener(profile, spokenGroup.a),
    `${FOLLOW_UPS[variant]!}${PROFILE_FOLLOW_UP_TAIL[profile]}`,
    comparison(profile, spokenGroup),
    correction(profile, spokenGroup),
    topicSwitch(profile, spokenGroup),
    compound(profile, spokenGroup),
    CLOSING_FOLLOW_UPS[profile][variant % 2]!,
  ]
  const social = SOCIAL_TRANSITIONS.get(index)
  return Object.freeze((social ? [social, ...scientific] : scientific).slice(0, length))
}

function scenarios(): readonly Scenario[] {
  const rows = Array.from({ length: 60 }, (_, index) => {
    const profile = PROFILES[index % PROFILES.length]!
    const group = TOPIC_GROUPS[index % TOPIC_GROUPS.length]!
    const length = index < 10 ? 3 : index < 50 ? 5 : 7
    const depth: DnaS13Depth = profile === "D" ? "short" : profile === "C" ? "deep" : "standard"
    return Object.freeze({
      conversationId: `conversation-${String(index + 1).padStart(3, "0")}`,
      profile,
      depth,
      messages: buildMessages(index, profile, group, length),
    })
  })
  return Object.freeze(rows)
}

function eval002TopicGroups(): readonly TopicGroup[] {
  const excluded = new Set(TOPIC_GROUPS.flatMap((group) => [group.a, group.b, group.c])
    .map(normalizeDnaChatText))
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ title?: string; topicId?: string }>[]
  }).units
  const candidates = [...new Map(units.flatMap((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    if (title.length < 7 || title.length > 64 || title.includes("·") || excluded.has(normalizeDnaChatText(title))) return []
    return [[`${topicId}\u0000${title}`, Object.freeze({ title, topicId })] as const]
  })).values()]
    .filter((row) => {
      const normalizedTitle = normalizeDnaChatText(row.title)
      if (/\b(?:otiz\w*|dehb|adhd|tani\w*|teshis\w*|bozuklu\w*|klinik\w*|vaka\w*|olgu\w*|danisan\w*|hasta\w*)\b/.test(normalizedTitle)) {
        return false
      }
      const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
      return resolved.length === 1 && resolved[0]?.topicId === row.topicId
        && [
          `${row.title} başlığını teorik olarak açıkla.`,
          `${row.title} ile başka bir kuramsal başlık aynı kavram mı?`,
          `Önceki değil, ${row.title} başlığını demek istedim.`,
        ].every((question) => inspectDnaS13LimitedRolloutPrivacy({ question, mode: "theory" }).allowed)
    })
    .sort((left, right) => sha(`${EVALUATION_ID}:${left.topicId}`).localeCompare(sha(`${EVALUATION_ID}:${right.topicId}`)))
  if (candidates.length < 60) throw new Error(`blind_eval_002_topic_pool_too_small:${candidates.length}`)
  return Object.freeze(Array.from({ length: 20 }, (_, index) => Object.freeze({
    a: candidates[index * 3]!.title,
    b: candidates[index * 3 + 1]!.title,
    c: candidates[index * 3 + 2]!.title,
  })))
}

function eval002Opener(profile: Profile, topic: string) {
  if (profile === "A") return `${topic} için temel anlamı, işlevi ve yorum sınırını üç kısa bölümde kurar mısın?`
  if (profile === "B") return `${topic} başlığında olay ne; ne işe yarıyor ve nerede fazla yorum yapmış oluruz?`
  if (profile === "C") return `${topic}: çekirdek kapsam, işlevsel anlam ve sınırlılık facetlerini birbirinden ayır.`
  if (profile === "D") return `${topic} için önce özünü, sonra işlevini, en son sınırını söyle.`
  if (profile === "E") return `${topic} anlatılırken hangi anlam destekleniyor, hangi yorum desteklenmiyor? Çekirdek kapsamı da ekle.`
  return `${topic} hangi kapsamı taşır; işlev ile yorum sınırını karıştırmadan yanıtlar mısın?`
}

function eval002Operation(index: number, profile: Profile, topic: string) {
  const tail: Readonly<Record<Profile, string>> = Object.freeze({
    A: "; profesyonel dilde", B: "; çok uzatma", C: "; kavramsal düzeyi koru",
    D: "; tek ana fikirle", E: "; kesinliği artırmadan", F: "; referansı açık tutarak",
  })
  const forms = [
    `Neden önemli olduğunu yalnız az önceki doğrulanmış başlık üzerinden söyler misin${tail[profile]}; ${topic} bağlamında kal.`,
    `Başka bir örnek var mı; kaynakta örnek yoksa bunu açıkça belirt${tail[profile]}; ${topic} dışına çıkma.`,
    `Biraz daha açar mısın; kapsamı büyütmeden ayrıntılandır${tail[profile]}; konu ${topic}.`,
    `Bunu sadeleştir; doğrulanmış sınırı kaybetmeden gündelik Türkçeye çevir${tail[profile]}; ${topic} üzerinde kal.`,
  ]
  return forms[index % forms.length]!
}

function eval002Comparison(profile: Profile, group: TopicGroup) {
  if (profile === "B") return `${group.b} ile ${group.c} aynı kavram mı; doğrulanmış açıklamalar ne kadar ayırıyor?`
  if (profile === "C") return `${group.b} ve ${group.c} için iki tarafı ayrı açıkla, ardından yalnız desteklenebilir ayrımı kur.`
  if (profile === "D") return `${group.b} / ${group.c}: ikisini açıkla ve güvenli farkı tek cümlede söyle.`
  if (profile === "E") return `${group.b} ile ${group.c} arasında kanıtlanmayan bir bağ kurmadan ne ayrımı yapılabilir?`
  if (profile === "F") return `${group.b} ve ${group.c} aynı düzeyde mi; doğrulanmış açıklamalar yetmiyorsa ilişki konusunda dur.`
  return `${group.b} ile ${group.c} karşılaştırmasında önce tarafları, sonra doğrulanmış sonucu verir misin?`
}

function eval002Correction(index: number, profile: Profile, group: TopicGroup) {
  const tail: Readonly<Record<Profile, string>> = Object.freeze({
    A: "Profesyonel biçimde sürdür.", B: "Kısa tut.", C: "Kavramsal sınırı belirt.",
    D: "Tek ana fikir yeter.", E: "Kesinliği artırma.", F: "Hedef başlığı açık söyle.",
  })
  return index % 2 === 0
    ? `Önceki değil, ${group.c} başlığını demek istedim; tek kavram olarak yanıtla. ${tail[profile]}`
    : `İkincisini kastediyorum; ${group.b} / ${group.c} karşılaştırmasını kapatıp yalnız o başlıkta kal. ${tail[profile]}`
}

function eval002TopicSwitch(profile: Profile, group: TopicGroup) {
  const tail: Readonly<Record<Profile, string>> = Object.freeze({
    A: "Kısa bir profesyonel özet ver.", B: "fazla uzatma", C: "Kavramsal kapsamı işlevden ayır.",
    D: "Tek cümleyle başla.", E: "Genelleme yapma.", F: "Yeni başlığı açıkça adlandır.",
  })
  return profile === "B"
    ? `şimdi ayrı bir başlık: ${group.a} için desteklenen ana anlam ne; ${tail[profile]}`
    : `Önceki konuyu kapatalım. ${group.a} başlığının doğrulanmış ana kapsamına geç. ${tail[profile]}`
}

function eval002Compound(profile: Profile, group: TopicGroup) {
  const tail: Readonly<Record<Profile, string>> = Object.freeze({
    A: "Bölümleri numaralandır.", B: "İki kısa parça olsun.", C: "Düzeyleri karıştırma.",
    D: "İkisini de yalın yaz.", E: "İddiaları sınırlı tut.", F: "Hangi yanıtın hangi başlığa ait olduğunu göster.",
  })
  return profile === "D"
    ? `${group.a} öz olarak nedir? Ayrıca ${group.c} için bir sınırlılık var mı? Ayrı yanıtla.`
    : `${group.a} hangi temel kapsamı taşır? Buna ek olarak ${group.c} için desteklenen anlam ile sınırlılığı ikinci bölümde ayır. ${tail[profile]}`
}

function eval002Closing(index: number, profile: Profile, topic: string) {
  const tail: Readonly<Record<Profile, string>> = Object.freeze({
    A: "Profesyonel bir kapanış yap.", B: "Kısaca bitir.", C: "Düzey ayrımını görünür tut.",
    D: "Tek ana fikirle bitir.", E: "Gereksiz kesinlik ekleme.", F: "Referans verilen başlığı adlandır.",
  })
  const forms = [
    "Bu çerçevenin önemini bir kez daha, yeni neden-sonuç iddiası eklemeden toparla.",
    "Somut bir örnek isteyeceğim; doğrulanmış örnek yoksa başka topic kullanma.",
    "Bir kat daha derine in; ama yalnız kilitli kapsamı ayrıntılandır.",
    "Şimdi aynı yanıtı daha yalın ve kısa biçimde yeniden söyle.",
  ]
  return `${forms[index % forms.length]} ${topic} bağlamında kal. ${tail[profile]}`
}

function eval002Scenarios(): readonly Scenario[] {
  const groups = eval002TopicGroups()
  return Object.freeze(Array.from({ length: 60 }, (_, index) => {
    const profile = PROFILES[index % PROFILES.length]!
    const group = groups[index % groups.length]!
    const spokenGroup = Object.freeze({
      a: group.a.toLocaleLowerCase("tr-TR"),
      b: group.b.toLocaleLowerCase("tr-TR"),
      c: group.c.toLocaleLowerCase("tr-TR"),
    })
    const length = index < 10 ? 3 : index < 50 ? 5 : 7
    const depth: DnaS13Depth = profile === "D" ? "short" : profile === "C" ? "deep" : "standard"
    const messages = [
      eval002Opener(profile, spokenGroup.a),
      eval002Operation(index, profile, spokenGroup.a),
      eval002Comparison(profile, spokenGroup),
      eval002Correction(index, profile, spokenGroup),
      eval002TopicSwitch(profile, spokenGroup),
      eval002Compound(profile, spokenGroup),
      eval002Closing(index, profile, spokenGroup.c),
    ].slice(0, length)
    return Object.freeze({
      conversationId: `conversation-${String(index + 1).padStart(3, "0")}`,
      profile,
      depth,
      messages: Object.freeze(messages),
    })
  }))
}

function eval003PriorBlindFiles() {
  return Object.freeze([
    path.join(OUTPUT_PARENT, "001", "blind-conversations.json"),
    path.join(OUTPUT_PARENT, "002", "blind-conversations.json"),
  ])
}

function eval003TopicGroups(): readonly TopicGroup[] {
  const priorQuestions = eval003PriorBlindFiles().flatMap(readPriorQuestions)
    .map(normalizeDnaChatText)
  const excluded = new Set(TOPIC_GROUPS.flatMap((group) => [group.a, group.b, group.c])
    .map(normalizeDnaChatText))
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ title?: string; topicId?: string }>[]
  }).units
  const candidates = [...new Map(units.flatMap((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    const normalizedTitle = normalizeDnaChatText(title)
    if (title.length < 7 || title.length > 64 || title.includes("·") || excluded.has(normalizedTitle)
      || priorQuestions.some((question) => question.includes(normalizedTitle))) return []
    return [[`${topicId}\u0000${title}`, Object.freeze({ title, topicId })] as const]
  })).values()]
    .filter((row) => {
      const normalizedTitle = normalizeDnaChatText(row.title)
      if (/^\d+[.)]?\s/u.test(normalizedTitle)
        || /\b(?:otiz\w*|dehb|adhd|tani\w*|teshis\w*|bozuklu\w*|klinik\w*|vaka\w*|olgu\w*|danisan\w*|hasta\w*|sendrom\w*|terapi\w*|tedavi\w*|mudahale\w*|duyusal diyet\w*|davranis\w*|reseptor\w*|transduksiyon\w*|vestibuler\w*|norogelisim\w*|ogrenme\w*)\b/.test(normalizedTitle)) {
        return false
      }
      const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
      return resolved.length === 1 && resolved[0]?.topicId === row.topicId
        && inspectDnaS13LimitedRolloutPrivacy({ question: `${row.title} hakkında kuramsal bir açıklama yap.`, mode: "theory" }).allowed
    })
    .sort((left, right) => sha(`eval003:${left.topicId}`).localeCompare(sha(`eval003:${right.topicId}`)))
  if (candidates.length < 60) throw new Error(`blind_eval_003_topic_pool_too_small:${candidates.length}`)
  return Object.freeze(Array.from({ length: 20 }, (_, index) => Object.freeze({
    a: candidates[index * 3]!.title,
    b: candidates[index * 3 + 1]!.title,
    c: candidates[index * 3 + 2]!.title,
  })))
}

function eval003Opener(index: number, profile: Profile, topic: string) {
  if (index % 2 === 0) {
    if (profile === "B") return `${topic} deyince aslında neyden söz ediliyor? kısa ve net anlatır mısın`
    if (profile === "D") return `${topic} ne demek? Önce en yalın hâliyle söyle.`
    if (profile === "E") return `${topic} hakkında temel olarak neyi güvenle söyleyebiliriz?`
    return `${topic} denince anlaşılması gereken çekirdek fikri, kapsamını taşırmadan açıklar mısın?`
  }
  if (profile === "B") return `${topic} için ana fikir ne, ne işe yarıyo, nerede yorum fazla kaçar?`
  if (profile === "C") return `${topic} başlığını tanım, işlev ve yorum sınırı bakımından birbirine karıştırmadan çözümle.`
  if (profile === "D") return `${topic}: anlamı, işe yaradığı yer ve sınırı nedir? Basit yaz.`
  if (profile === "F") return `${topic} hangi fikri anlatıyor; işleviyle sınırını ayrı ayrı gösterebilir misin?`
  return `${topic} için temel anlamı, işlevi ve aşırı yorumdan kaçınılacak sınırı ayrı cümlelerle anlatır mısın?`
}

function eval003Operation(index: number, profile: Profile, topic: string) {
  const concise = profile === "B" || profile === "D" ? " Kısa tut." : ""
  const forms = [
    `Bu fikrin neden önemli olduğunu, az önce anlattığın ${topic} çerçevesinde açıklar mısın?${concise}`,
    `${topic} için gündelik yaşamdan bir örnek kurulabiliyor mu? Kaynak buna izin vermiyorsa örnek uydurma.${concise}`,
    `${topic} açıklamasında bir kat daha ayrıntıya iner misin; yeni bir neden-sonuç bağı ekleme.${concise}`,
    `Aynı ${topic} açıklamasını teknik sözcükleri azaltarak yeniden anlatır mısın?${concise}`,
  ]
  return forms[index % forms.length]!
}

function eval003Comparison(profile: Profile, group: TopicGroup) {
  if (profile === "B") return `${group.b} ve ${group.c} birbirinden nasıl ayrılıyo; aynı düzeyde değillerse söyle`
  if (profile === "D") return `${group.b} ile ${group.c} aynı şey mi? İki tarafı da çok kısa açıklayıp ayır.`
  if (profile === "E") return `${group.b} ve ${group.c} arasında yalnız eldeki açıklamaların desteklediği farkı kur; ilişki icat etme.`
  return `${group.b} ile ${group.c} karşılaştırıldığında her biri neyi ifade eder ve güvenle söylenebilen ayrım nedir?`
}

function eval003TwoSubquestion(profile: Profile, group: TopicGroup) {
  if (profile === "B") return `${group.a} neyi anlatıyo? ayrıca ${group.c} niye önemli, iki ayrı cevap yaz`
  if (profile === "D") return `${group.a} nedir? Bir de ${group.c} neden önemlidir? Ayrı ayrı söyle.`
  if (profile === "F") return `Önce ${group.a} hangi fikre karşılık geliyor, sonra ${group.c} için önem nerede; iki kısmı açıkça ayırır mısın?`
  return `${group.a} hangi temel soruya yanıt verir? İkinci olarak ${group.c} neden önemlidir? Yanıtları iki bölümde tut.`
}

function eval003Correction(index: number, profile: Profile, group: TopicGroup) {
  const tail = profile === "B" || profile === "D" ? " Kısaca anlat." : " Önceki başlıkları yanıtın içine taşıma."
  return index % 2 === 0
    ? `Bir düzeltme: ${group.c} değil, ${group.b} başlığını tek başına sormuştum.${tail}`
    : `İkinci kısımda ${group.c} demek istemedim; hedefim ${group.b}. Yalnız onu açıkla.${tail}`
}

function eval003TopicSwitch(profile: Profile, topic: string) {
  if (profile === "B") return `neyse bunu kapatalım, yeni konu ${topic}; bunun ana fikri ne?`
  if (profile === "D") return `Konu değişsin: ${topic} basitçe ne anlatır?`
  if (profile === "F") return `Öncekileri bırakalım. Şimdi ${topic} tarafına geçince hangi kavramdan söz ediyoruz?`
  return `Önceki konuyu kapatıp ${topic} başlığına geçelim; temel kapsamını yeni bir başlangıç olarak açıklar mısın?`
}

function lowOverlapTopic(value: string) {
  return value.toLocaleLowerCase("tr-TR").split(/\s+/u).map((word) => word.length > 5
    ? word.replace(/[aeıioöuü]/giu, "")
    : word).join(" ")
}

function eval003LowOverlapFollowup(index: number, profile: Profile, topic: string) {
  const rough = lowOverlapTopic(topic)
  if (profile === "B") return `az önceki ${rough} mevzusunu daha anlaşılır söylesene, yeni konu açma`
  if (profile === "D") return `${rough} dediğimiz şeyi bir kez daha çok basit anlat.`
  return index % 2 === 0
    ? `Az önceki ${rough} başlığını gündelik Türkçeyle yeniden kur; aynı bağlamda kal.`
    : `${rough} diye konuştuğumuz noktayı biraz derinleştir; önceki konunun dışına çıkma.`
}

function eval003Closing(index: number, profile: Profile, topic: string) {
  const tail = profile === "B" || profile === "D" ? " Tek paragraf yeter." : " Kapsamı genişletme."
  return index % 2 === 0
    ? `${topic} için son bir özet yap: ana fikir ile yorum sınırını yan yana göster.${tail}`
    : `${topic} neden önemli sorusuna son kez daha yalın bir yanıt ver.${tail}`
}

function eval003FreshnessTail(index: number, turnIndex: number) {
  const cycle = Math.floor(index / 20)
  if (cycle === 0) return ""
  const tails = cycle === 1 ? [
    " Yanıtı düzenli kur.",
    " Gerekçeyi ayrı göster.",
    " Sonucu tek cümlede bağla.",
    " Düzeltmeyi başta belirt.",
    " Yeni başlığı açıkça adlandır.",
    " Sözü dolaştırmadan anlat.",
    " Kısa bir kapanış yap.",
  ] : [
    " Gereksiz kesinlik kullanma.",
    " Sınırı görünür bırak.",
    " Tarafları birbirine karıştırma.",
    " Yalnız hedeflenen kavramda kal.",
    " Önceki konuyu geri getirme.",
    " Anlamı değiştirmeden sadeleştir.",
    " Ana düşünceyle bitir.",
  ]
  return tails[turnIndex] ?? ""
}

function eval003Scenarios(): readonly Scenario[] {
  const groups = eval003TopicGroups()
  return Object.freeze(Array.from({ length: 60 }, (_, index) => {
    const profile = PROFILES[index % PROFILES.length]!
    const group = groups[index % groups.length]!
    const spokenGroup = Object.freeze({
      a: group.a.toLocaleLowerCase("tr-TR"),
      b: group.b.toLocaleLowerCase("tr-TR"),
      c: group.c.toLocaleLowerCase("tr-TR"),
    })
    const length = index < 10 ? 3 : index < 50 ? 5 : 7
    const messages = [
      eval003Opener(index, profile, spokenGroup.a),
      eval003Operation(index, profile, spokenGroup.a),
      index % 2 === 0 ? eval003Comparison(profile, spokenGroup) : eval003TwoSubquestion(profile, spokenGroup),
      eval003Correction(index, profile, spokenGroup),
      eval003TopicSwitch(profile, spokenGroup.a),
      eval003LowOverlapFollowup(index, profile, spokenGroup.a),
      eval003Closing(index, profile, spokenGroup.a),
    ].map((message, turnIndex) => `${message}${eval003FreshnessTail(index, turnIndex)}`).slice(0, length)
    const intentTags = [
      index % 2 === 0 ? "normal_single_topic" : "multi_facet",
      ["why_importance", "example", "deepen", "simplify"][index % 4]!,
      index % 2 === 0 ? "comparison" : "two_subquestion",
      "correction",
      "topic_switch",
      "typo_low_lexical_overlap",
      index % 2 === 0 ? "simplify" : "deepen",
    ].slice(0, length)
    const depth: DnaS13Depth = profile === "D" ? "short" : profile === "C" ? "deep" : "standard"
    return Object.freeze({
      conversationId: `conversation-${String(index + 1).padStart(3, "0")}`,
      profile,
      depth,
      messages: Object.freeze(messages),
      intentTags: Object.freeze(intentTags),
    })
  }))
}

function eval004TopicGroups(): readonly TopicGroup[] {
  const priorFiles = ["001", "002", "003"].map((id) => path.join(OUTPUT_PARENT, id, "blind-conversations.json"))
  const priorQuestions = priorFiles.flatMap(readPriorQuestions).map(normalizeDnaChatText)
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ title?: string; topicId?: string }>[]
  }).units
  const candidates = [...new Map(units.flatMap((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    const normalizedTitle = normalizeDnaChatText(title)
    if (title.length < 7 || title.length > 64 || title.includes("·")
      || priorQuestions.some((question) => question.includes(normalizedTitle))) return []
    return [[`${topicId}\u0000${title}`, Object.freeze({ title, topicId })] as const]
  })).values()].filter((row) => {
    const normalizedTitle = normalizeDnaChatText(row.title)
    if (/^\d+[.)]?\s/u.test(normalizedTitle)
      || /\b(?:otiz\w*|dehb|adhd|tani\w*|teshis\w*|bozuklu\w*|klinik\w*|vaka\w*|olgu\w*|danisan\w*|hasta\w*|sendrom\w*|terapi\w*|tedavi\w*|mudahale\w*|duyusal diyet\w*|davranis\w*|norogelisim\w*|ogrenme\w*|travma\w*|reseptor\w*|transduksiyon\w*|vestibuler\w*)\b/u.test(normalizedTitle)) return false
    const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
    return resolved.length === 1 && resolved[0]?.topicId === row.topicId
      && inspectDnaS13LimitedRolloutPrivacy({ question: `${row.title} kuramsal olarak nasıl anlaşılmalı?`, mode: "theory" }).allowed
  }).filter((row) => {
    const topic = row.title.toLocaleLowerCase("tr-TR")
    const peer = "self-regülasyonun temel anlamı"
    const probes = [
      `${topic} hangi düşünce alanını karşılar? Önce özünü kur; işlev ve sınırı gerekiyorsa ayrı tut.`,
      `${topic} konusunda kafam karıştı: burada temel olarak ne anlatılıyor ve ne söylenmiş sayılmaz?`,
      `${topic} başlığını ilk kez duyan biri için güvenli başlangıç noktası nedir?`,
      `Bu noktayı değerli yapan nedir? ${topic} için eldeki açıklamadan taşmadan önemini belirt.`,
      `${topic} gerçek bir yaşam durumunda açıkça örneklenmiş mi? Somut dayanak yoksa örnek üretme.`,
      `${topic} üzerine önce söylenmeyen doğrulanmış bir ayrıntı var mı? Varsa aç, yoksa tekrarlama.`,
      `Şimdi ${topic} açıklamasını günlük konuşma diline çevir; anlam ve sınır aynı kalsın.`,
      `${topic} ile ${peer} karşı karşıya konursa önce birincinin, sonra ikincinin kapsamı nedir?`,
      `Düzeltmem gerek: ${peer} değil, ${topic} hedefim. Yalnız ${topic} anlat.`,
      `Burayı kapatalım ve bağımsız bir konuya geçelim: ${topic}. Yeni başlığın çekirdek anlamını sıfırdan kur.`,
      `${topic} niçin önem taşıyor? Önceki ana açıklamayı yinelemeden yalnız doğrulanmış gerekçeyi toparla.`,
    ]
    return probes.every((question) => inspectDnaS13LimitedRolloutPrivacy({ question, mode: "theory" }).allowed)
  }).sort((left, right) => sha(`eval004:${left.topicId}`).localeCompare(sha(`eval004:${right.topicId}`)))
  if (candidates.length < 60) throw new Error(`blind_eval_004_topic_pool_too_small:${candidates.length}`)
  return Object.freeze(Array.from({ length: 20 }, (_, index) => Object.freeze({
    a: candidates[index * 3]!.title,
    b: candidates[index * 3 + 1]!.title,
    c: candidates[index * 3 + 2]!.title,
  })))
}

function eval004Scenarios(): readonly Scenario[] {
  const groups = eval004TopicGroups()
  return Object.freeze(Array.from({ length: 60 }, (_, index) => {
    const profile = PROFILES[index % PROFILES.length]!
    const group = groups[index % groups.length]!
    const spoken = Object.freeze({
      a: group.a.toLocaleLowerCase("tr-TR"),
      b: group.b.toLocaleLowerCase("tr-TR"),
      c: group.c.toLocaleLowerCase("tr-TR"),
    })
    const short = profile === "B" || profile === "D"
    const openerForms = [
      `${spoken.a} hangi düşünce alanını karşılar? Önce özünü kur${short ? ", kısa yaz" : "; işlev ve sınırı gerekiyorsa ayrı tut"}.`,
      `${spoken.a} konusunda kafam karıştı: burada temel olarak ne anlatılıyor${short ? "?" : " ve ne söylenmiş sayılmaz?"}`,
      `${spoken.a} başlığını ilk kez duyan biri için güvenli başlangıç noktası nedir?`,
    ]
    const operationForms = [
      `Bu noktayı değerli yapan nedir? ${spoken.a} için eldeki açıklamadan taşmadan önemini belirt.`,
      `${spoken.a} gerçek bir yaşam durumunda açıkça örneklenmiş mi? Somut dayanak yoksa örnek üretme.`,
      `${spoken.a} üzerine önce söylenmeyen doğrulanmış bir ayrıntı var mı? Varsa aç, yoksa tekrarlama.`,
      `Şimdi ${spoken.a} açıklamasını günlük konuşma diline çevir; anlam ve sınır aynı kalsın.`,
    ]
    const compareOrOrder = index % 2 === 0
      ? `${spoken.b} ile ${spoken.c} karşı karşıya konursa önce birincinin, sonra ikincinin kapsamı nedir; en sonda yalnız desteklenen ayrımı söyle.`
      : `İlk bölümde ${spoken.a} için ana anlamı ver. İkinci bölümde ${spoken.c} neden dikkate alınır sorusunu yanıtla; sırayı değiştirme.`
    const correction = index % 2 === 0
      ? `Düzeltmem gerek: ${spoken.c} değil, ${spoken.b} hedefim. Önceki tarafı kapatıp yalnız ${spoken.b} anlat.`
      : `${spoken.c} demek istemedim; bırak onu. Asıl hedef ${spoken.b}, sadece bu başlıkla devam et.`
    const topicSwitch = `Burayı kapatalım ve bağımsız bir konuya geçelim: ${spoken.a}. Yeni başlığın çekirdek anlamını sıfırdan kur.`
    const rough = lowOverlapTopic(spoken.a)
    const lowOverlap = index % 2 === 0
      ? `şu ${rough} dediğimiz şeyi daha sade söyler misin, başka başlığa kayma`
      : `${rough} konusunu bir adım ilerlet; önceki yanıtta olmayan güvenli ayrıntı yoksa bunu belirt.`
    const closing = index % 2 === 0
      ? `${spoken.a} için elde kalan ana fikir ve yorum sınırını kısa bir kapanışta yan yana getir.`
      : `${spoken.a} niçin önem taşıyor? Önceki ana açıklamayı yinelemek yerine yalnız doğrulanmış gerekçeyi toparla.`
    const messages = [
      openerForms[index % openerForms.length]!, operationForms[index % operationForms.length]!, compareOrOrder,
      correction, topicSwitch, lowOverlap, closing,
    ].slice(0, index < 10 ? 3 : index < 50 ? 5 : 7)
      .map((message, turn) => `${message}${Math.floor(index / 20) === 0 ? "" : Math.floor(index / 20) === 1
        ? [" Düzenli ilerle.", " Sonucu ayır.", " İki kısmı görünür tut.", " Hedefi başta söyle.", " Eski konuyu taşıma.", " Yeni bilgi ölçütünü koru.", " Tek paragrafla bitir."][turn]
        : [" Gereksiz iddia ekleme.", " Kanıt sınırını koru.", " Sıralamayı bozma.", " Reddedilen başlığı kullanma.", " Yeni başlangıcı açık tut.", " Aynı bilgiyi döndürme.", " Gerekçeyi net bırak."][turn]}`)
    const intentTags = [
      index % 3 === 0 ? "normal_single_topic" : "multi_facet",
      ["why_importance", "example", "deepen", "simplify"][index % 4]!,
      index % 2 === 0 ? "comparison" : "two_subquestion",
      "correction", "topic_switch", "typo_low_lexical_overlap", index % 2 === 0 ? "simplify" : "deepen",
    ].slice(0, messages.length)
    return Object.freeze({
      conversationId: `conversation-${String(index + 1).padStart(3, "0")}`,
      profile,
      depth: profile === "D" ? "short" as const : profile === "C" ? "deep" as const : "standard" as const,
      messages: Object.freeze(messages),
      intentTags: Object.freeze(intentTags),
    })
  }))
}

function eval005TopicGroups(): readonly TopicGroup[] {
  const priorFiles = ["001", "002", "003", "004"]
    .map((id) => path.join(OUTPUT_PARENT, id, "blind-conversations.json"))
  const priorQuestions = priorFiles.flatMap(readPriorQuestions).map(normalizeDnaChatText)
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ title?: string; topicId?: string }>[]
  }).units
  const candidates = [...new Map(units.flatMap((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    const normalizedTitle = normalizeDnaChatText(title)
    if (title.length < 7 || title.length > 64 || title.includes("·")
      || priorQuestions.some((question) => question.includes(normalizedTitle))) return []
    return [[`${topicId}\u0000${title}`, Object.freeze({ title, topicId })] as const]
  })).values()].filter((row) => {
    const normalizedTitle = normalizeDnaChatText(row.title)
    if (/^\d+[.)]?\s/u.test(normalizedTitle)
      || /\b(?:otiz\w*|dehb|adhd|tani\w*|teshis\w*|bozuklu\w*|klinik\w*|vaka\w*|olgu\w*|danisan\w*|hasta\w*|sendrom\w*|terapi\w*|tedavi\w*|mudahale\w*|duyusal diyet\w*|davranis\w*|norogelisim\w*|ogrenme\w*|travma\w*|reseptor\w*|transduksiyon\w*|vestibuler\w*|anatomik\w*|profile|ebeveyn\w*|ogretmen\w*)\b/u.test(normalizedTitle)) return false
    const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
    if (resolved.length !== 1 || resolved[0]?.topicId !== row.topicId) return false
    const topic = row.title.toLocaleLowerCase("tr-TR")
    const probes = [
      `${topic} sözü burada hangi temel düşünceyi anlatıyor?`,
      `${topic} neden dikkate değer sayılıyor?`,
      `${topic} için elde yeni bir ayrıntı varsa açar mısın?`,
      `${topic} için kaynakta gerçekten somut bir örnek bulunuyor mu?`,
      `${topic} ifadesini daha gündelik bir dille yeniden kurar mısın?`,
    ]
    return probes.every((question) => inspectDnaS13LimitedRolloutPrivacy({ question, mode: "theory" }).allowed)
  }).sort((left, right) => sha(`eval005:${left.topicId}`).localeCompare(sha(`eval005:${right.topicId}`)))
  if (candidates.length < 180) throw new Error(`blind_eval_005_topic_pool_too_small:${candidates.length}`)
  return Object.freeze(Array.from({ length: 60 }, (_, index) => Object.freeze({
    a: candidates[index * 3]!.title,
    b: candidates[index * 3 + 1]!.title,
    c: candidates[index * 3 + 2]!.title,
  })))
}

function eval005Scenarios(): readonly Scenario[] {
  const groups = eval005TopicGroups()
  const openerForms = [
    (topic: string) => `${topic} sözü burada hangi temel düşünceyi anlatıyor? Önce kısa çerçeveyi kurar mısın?`,
    (topic: string) => `${topic} hakkında güvenle söylenebilecek ana nokta ne; kapsamın bittiği yeri de belirtir misin?`,
    (topic: string) => `İlk defa karşılaşıyorum: ${topic} nasıl anlaşılmalı? Gerekiyorsa anlamı ile işlevini ayır.`,
    (topic: string) => `${topic} başlığına giriş yapar mısın; özünü kaybetmeden düzenli anlat.`,
  ] as const
  const operationForms = [
    (topic: string) => `${topic} neden dikkate değer sayılıyor? Önceki açıklamayı yinelemeden, varsa desteklenen gerekçeyi söyle.`,
    (topic: string) => `${topic} için elde yeni bir ayrıntı varsa açar mısın? Aynı bilgiyi başka sözlerle tekrarlama.`,
    (topic: string) => `${topic} için kaynakta gerçekten somut bir örnek bulunuyor mu? Yoksa bir durum uydurma.`,
    (topic: string) => `${topic} ifadesini şimdi daha gündelik bir dille yeniden kurar mısın? Bilimsel kapsam değişmesin.`,
  ] as const
  return Object.freeze(groups.map((group, index) => {
    const profile = PROFILES[index % PROFILES.length]!
    const spoken = Object.freeze({
      a: group.a.toLocaleLowerCase("tr-TR"),
      b: group.b.toLocaleLowerCase("tr-TR"),
      c: group.c.toLocaleLowerCase("tr-TR"),
    })
    const compareOrOrder = index % 2 === 0
      ? `${spoken.b} ile ${spoken.c} yan yana ele alındığında her biri neyi karşılıyor? Ardından eldeki bilginin izin verdiği farkı açıkça bağla.`
      : `İki ayrı isteğim var: önce ${spoken.b} için ana kapsamı söyle, sonra ${spoken.c} niçin önemli sorusunu yanıtla.`
    const correction = index % 2 === 0
      ? `Az önce hedefi yanlış söyledim; ${spoken.c} değil ${spoken.b} üzerinde kalmak istiyorum. Yalnız doğru hedefi açıkla.`
      : `Düzeltme yapayım: asıl sorduğum ${spoken.b}. ${spoken.c} tarafını yanıtına geri taşıma.`
    const topicSwitch = index % 3 === 0
      ? `Şimdi önceki konuları bırakalım. Yeni başlığım ${spoken.c}; bunu bağımsız bir başlangıç olarak açıkla.`
      : `Başka bir konuya geçiyorum: ${spoken.c}. Eski başlıkları karıştırmadan temel fikri kur.`
    const rough = lowOverlapTopic(spoken.c)
    const lowOverlap = index % 2 === 0
      ? `${rough} dediğimiz noktayı daha yalın söyler misin; anlamı daraltma ya da genişletme`
      : `şu ${rough} meselesinde bir adım daha gidebilir miyiz, yeni doğrulanmış ayrıntı yoksa açıkça söyle`
    const closing = index % 2 === 0
      ? `${spoken.c} açısından asıl önemi tek paragrafta toparla; önceki açıklamayı yeniden anlatma.`
      : `${spoken.c} için ana fikirle sınırı kısa bir özet halinde birleştir.`
    const messages = [
      openerForms[index % openerForms.length]!(spoken.a),
      operationForms[index % operationForms.length]!(spoken.a),
      compareOrOrder,
      correction,
      topicSwitch,
      lowOverlap,
      closing,
    ].slice(0, index < 10 ? 3 : index < 50 ? 5 : 7)
      .map((message, turnIndex) => `${message}${index % 3 === 0
        ? ["", " Gerekçeyi ayrı tut.", " İstenen sırayı koru.", " Düzeltmeyi başta görünür kıl.", " Yeni konuya doğrudan gir.", " Aynı iddiayı döndürme.", " Kısa bitir."][turnIndex]
        : index % 3 === 1
          ? [" Gereksiz kesinlik ekleme.", " Yeni bir bağ kurma.", " İki bölümü karıştırma.", " Eski hedefi kullanma.", " Önceki konuyu anma.", " Kanıt sınırında kal.", " Sonucu net bırak."][turnIndex]
          : [" Ana düşünceyle başla.", " Yalnız sorulan işlemi yap.", " Tarafları açık adlandır.", " Doğru başlığa geç.", " Bağımsız yanıtla.", " Teknik dili azalt.", " Tek ana fikir yeter."][turnIndex]}`)
    const intentTags = [
      index % 2 === 0 ? "normal_single_topic" : "multi_facet",
      ["why_importance", "deepen", "example", "simplify"][index % 4]!,
      index % 2 === 0 ? "comparison" : "two_subquestion",
      "correction",
      "topic_switch",
      "typo_low_lexical_overlap",
      "summarize",
    ].slice(0, messages.length)
    return Object.freeze({
      conversationId: `conversation-${String(index + 1).padStart(3, "0")}`,
      profile,
      depth: profile === "D" ? "short" as const : profile === "C" ? "deep" as const : "standard" as const,
      messages: Object.freeze(messages),
      intentTags: Object.freeze(intentTags),
    })
  }))
}

function eval006TopicGroups(): readonly TopicGroup[] {
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ title?: string; topicId?: string }>[]
  }).units
  const candidates = [...new Map(units.flatMap((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    const normalized = normalizeDnaChatText(title)
    if (title.length < 7 || title.length > 68 || title.includes("·") || /^\d+[.)]?\s/u.test(normalized)
      || /\b(?:tani\w*|vaka\w*|danisan\w*|hasta\w*|tedavi\w*|terapi\w*|mudahale\w*|otiz\w*|dehb|bozuklu\w*|sendrom\w*|travma\w*|klinik\w*|profil\w*)\b/u.test(normalized)) return []
    return [[topicId, Object.freeze({ title, topicId })] as const]
  })).values()].filter((row) => {
    const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
    return resolved.length === 1 && resolved[0]?.topicId === row.topicId
      && inspectDnaS13LimitedRolloutPrivacy({ question: `${row.title.toLocaleLowerCase("tr-TR")} ne anlatıyor?`, mode: "theory" }).allowed
  }).sort((left, right) => sha(`eval006:${left.topicId}`).localeCompare(sha(`eval006:${right.topicId}`)))
  if (candidates.length < 180) throw new Error(`blind_eval_006_topic_pool_too_small:${candidates.length}`)
  return Object.freeze(Array.from({ length: 60 }, (_, index) => Object.freeze({
    a: candidates[index * 3]!.title,
    b: candidates[index * 3 + 1]!.title,
    c: candidates[index * 3 + 2]!.title,
  })))
}

function eval006Scenarios(): readonly Scenario[] {
  const groups = eval006TopicGroups()
  const followup = [
    (topic: string) => `Peki bu, ${topic} açısından neden önemli?`,
    (topic: string) => `${topic} ne işe yarıyor yani?`,
    (topic: string) => `${topic} tarafını biraz daha açar mısın?`,
    (topic: string) => `${topic} için günlük bir örnek var mı?`,
    (topic: string) => `${topic} çok teknik oldu; daha sade söyler misin?`,
  ] as const
  return Object.freeze(groups.map((group, index) => {
    const profile = PROFILES[index % PROFILES.length]!
    const a = group.a.toLocaleLowerCase("tr-TR")
    const b = group.b.toLocaleLowerCase("tr-TR")
    const c = group.c.toLocaleLowerCase("tr-TR")
    const opener = profile === "B" ? `ya ${a} tam olarak ne?`
      : profile === "C" ? `${a} kavramının kuramsal kapsamını açıklar mısın?`
        : profile === "D" ? `${a} çok teknik geliyor; basitçe nedir?`
          : profile === "E" ? `${a} hakkında neyi güvenle söyleyebiliriz?`
            : profile === "F" ? `${a} tarafını biraz açar mısın?`
              : `${a} ne anlatıyor? İlk kez duyuyorum.`
    const compare = profile === "B" ? `${b} ile ${c} arasındaki fark ne?`
      : profile === "D" ? `${b} ve ${c} aynı şey mi? Kısaca ayırır mısın?`
        : `${b} ile ${c} karşılaştırıldığında ikisini birbirinden ayıran nokta ne?`
    const correction = index % 2 === 0
      ? `Yok, ${b} değil ${c} demek istemiştim. Yalnız onu anlatır mısın?`
      : `Düzeltme: ${c} tarafını değil ${b} tarafını soruyorum; orada kalalım.`
    const switchTurn = profile === "B" ? `neyse başka konu: ${a}. burada ana fikir ne?`
      : `Öncekileri bırakalım; şimdi ${a} hakkında konuşalım. Ana fikir ne?`
    const sixth = index % 2 === 0
      ? `az önceki ${lowOverlapTopic(a)} konusundan devam; bir adım daha gider miyiz?`
      : `İki şey soracağım: ${b} ne demek, bir de ${c} neden önemli?`
    const seventh = index % 3 === 0
      ? `${a} konusunda kitapta gerçek bir örnek var mı? Yoksa olmadığını söyle.`
      : index % 3 === 1
        ? `${a} biraz fazla teknik kaldı; az önceki fikri gündelik dille toparlar mısın?`
        : `${a} için yeni bir nokta varsa ekle; aynı şeyi tekrar anlatma.`
    const allMessages = [
      opener,
      followup[index % followup.length]!(a),
      compare,
      correction,
      switchTurn,
      sixth,
      seventh,
    ]
    const length = index < 10 ? 3 : index < 50 ? 5 : 7
    const intentTags = [
      index % 3 === 0 ? "casual_single_topic" : index % 3 === 1 ? "academic_single_topic" : "normal_single_topic",
      ["why_importance", "why_importance", "deepen", "example", "simplify"][index % 5]!,
      "comparison",
      "correction",
      "topic_switch",
      index % 2 === 0 ? "typo_low_lexical_overlap" : "two_subquestion",
      index % 3 === 0 ? "unsupported_evidence" : index % 3 === 1 ? "simplify" : "deepen",
    ].slice(0, length)
    return Object.freeze({
      conversationId: `conversation-${String(index + 1).padStart(3, "0")}`,
      profile,
      depth: profile === "D" ? "short" as const : profile === "C" ? "deep" as const : "standard" as const,
      messages: Object.freeze(allMessages.slice(0, length)),
      intentTags: Object.freeze(intentTags),
    })
  }))
}

function eval007TopicGroups(): readonly TopicGroup[] {
  const units = (denseKnowledgeRuntimeJson as unknown as {
    units: readonly Readonly<{ title?: string; topicId?: string }>[]
  }).units
  const candidates = [...new Map(units.flatMap((row) => {
    const title = String(row.title || "").trim()
    const topicId = String(row.topicId || "").trim()
    const normalized = normalizeDnaChatText(title)
    if (title.length < 7 || title.length > 68 || title.includes("·") || /^\d+[.)]?\s/u.test(normalized)
      || /(?:okul|cocu|ogrenil)/u.test(normalized)
      || /\b(?:tani\w*|vaka\w*|danisan\w*|hasta\w*|tedavi\w*|terapi\w*|mudahale\w*|otiz\w*|dehb|bozuklu\w*|sendrom\w*|travma\w*|klinik\w*|profil\w*|ogretmen\w*|ebeveyn\w*|cocuk\w*|okul\w*|ogrenme\w*|ergen\w*)\b/u.test(normalized)) return []
    return [[topicId, Object.freeze({ title, topicId })] as const]
  })).values()].filter((row) => {
    const resolved = resolveDnaS13NamedTopicSurfaces(row.title)
    return resolved.length === 1 && resolved[0]?.topicId === row.topicId
      && inspectDnaS13LimitedRolloutPrivacy({ question: `${row.title.toLocaleLowerCase("tr-TR")} ne anlama geliyor?`, mode: "theory" }).allowed
  }).sort((left, right) => sha(`eval007:${left.topicId}`).localeCompare(sha(`eval007:${right.topicId}`)))
  if (candidates.length < 180) throw new Error(`blind_eval_007_topic_pool_too_small:${candidates.length}`)
  const groups = Object.freeze(Array.from({ length: 60 }, (_, index) => Object.freeze({
    a: candidates[index * 3]!.title,
    b: candidates[index * 3 + 1]!.title,
    c: candidates[index * 3 + 2]!.title,
  })))
  const distinctTopics = new Set(groups.flatMap((group) => [group.a, group.b, group.c]).map(normalizeDnaChatText))
  if (distinctTopics.size < 180) throw new Error(`blind_eval_007_distinct_topic_count_invalid:${distinctTopics.size}`)
  return groups
}

function eval007Scenarios(): readonly Scenario[] {
  const groups = eval007TopicGroups()
  const openerForms = [
    (topic: string) => `Bir yerde ${topic} ifadesini gördüm. Bunu ilk kez duyan biri için nasıl açıklarsın?`,
    (topic: string) => `${topic} denince hangi temel düşünce anlaşılmalı? Önce özüyle başlayabilir misin?`,
    (topic: string) => `${topic} hakkında kafam karıştı; kavramın ne söylediğini doğal bir dille anlatır mısın?`,
    (topic: string) => `${topic} için kısa bir giriş yapıp temel anlamı söyler misin?`,
  ] as const
  const followupForms = [
    (topic: string) => `Bu noktada ${topic} neden önem taşıyor? İlk cevabı tekrarlamadan gerekçeyi söyleyebilir misin?`,
    (topic: string) => `${topic} pratikte ne işe yarıyor diye sorsam, eldeki bilgi ne kadarını yanıtlıyor?`,
    (topic: string) => `Biraz daha açalım: ${topic} konusunda ilk yanıta eklenebilecek gerçekten farklı nokta ne?`,
    (topic: string) => `${topic} için anlaşılır bir örnek verebilir misin? Kaynakta yoksa örnek uydurma.`,
    (topic: string) => `${topic} açıklaması ağır geldi. Aynı anlamı gündelik Türkçeyle yeniden kurar mısın?`,
  ] as const
  return Object.freeze(groups.map((group, index) => {
    const profile = PROFILES[index % PROFILES.length]!
    const a = group.a.toLocaleLowerCase("tr-TR")
    const b = group.b.toLocaleLowerCase("tr-TR")
    const c = group.c.toLocaleLowerCase("tr-TR")
    const compareOrTwo = index % 2 === 0
      ? `${b} ile ${c} arasındaki ayrımı bir türlü oturtamadım. En belirgin farkı konuşur gibi anlatır mısın?`
      : `İki ayrı sorum var: ${b} ne anlama geliyor; ${c} ise neden önemli? Sırayla yanıtlar mısın?`
    const correctionTurn = index % 2 === 0
      ? `Bir düzeltme yapayım: ${b} değil, ${c} üzerinde durmak istemiştim. Yalnız o başlığa dönelim.`
      : `Yanlış ifade ettim; ${c} yerine ${b} demek istiyordum. Cevabı buna göre düzeltir misin?`
    const switchTurn = index % 3 === 0
      ? `Şimdi konuyu değiştireyim. ${c} başlığı kendi başına ne anlatıyor?`
      : `Önceki başlıkları kapatalım; yeni sorum ${c}. Bunu bağımsız olarak açıklar mısın?`
    const lowLexicalOrTwo = index % 2 === 0
      ? `şu ${lowOverlapTopic(c)} kısmını tam kavrayamadım, brz dha açar mısın?`
      : `${a} için temel anlamı, ${c} için de önemini istiyorum; ikisini karıştırmadan söyler misin?`
    const closingTurn = index % 3 === 0
      ? `${c} için somut bir örnek gerçekten destekleniyor mu? Desteklenmiyorsa bunu açık söyle.`
      : index % 3 === 1
        ? `${c} konusunu son kez sadeleştir; tek paragrafta, doğal bir dille toparla.`
        : `${c} hakkında önceki cevaba eklenebilecek yeni bir ayrıntı var mı? Aynı noktayı döndürme.`
    const messages = [
      openerForms[index % openerForms.length]!(a),
      followupForms[index % followupForms.length]!(a),
      compareOrTwo,
      correctionTurn,
      switchTurn,
      lowLexicalOrTwo,
      closingTurn,
    ]
    const length = index < 10 ? 3 : index < 50 ? 5 : 7
    const intentTags = [
      "normal_single_topic",
      ["why_importance", "why_importance", "deepen", "example", "simplify"][index % 5]!,
      index % 2 === 0 ? "comparison" : "two_subquestion",
      "correction",
      "topic_switch",
      index % 2 === 0 ? "typo_low_lexical_overlap" : "two_subquestion",
      index % 3 === 0 ? "example" : index % 3 === 1 ? "simplify" : "deepen",
    ].slice(0, length)
    return Object.freeze({
      conversationId: `conversation-${String(index + 1).padStart(3, "0")}`,
      profile,
      depth: profile === "D" ? "short" as const : profile === "C" ? "deep" as const : "standard" as const,
      messages: Object.freeze(messages.slice(0, length)),
      intentTags: Object.freeze(intentTags),
    })
  }))
}

function diagnosticReplayScenarios(): readonly Scenario[] {
  const sourceEvaluation = DIAGNOSTIC_REPLAY_006 ? "006" : DIAGNOSTIC_REPLAY_005 ? "005" : DIAGNOSTIC_REPLAY_004 ? "004" : DIAGNOSTIC_REPLAY_003 ? "003" : DIAGNOSTIC_REPLAY_002 ? "002" : "001"
  const source = path.join(OUTPUT_PARENT, sourceEvaluation, "blind-conversations.json")
  if (!existsSync(source)) throw new Error(`blind_eval_${sourceEvaluation}_conversations_missing`)
  const conversations = JSON.parse(readFileSync(source, "utf8")) as readonly BlindConversation[]
  const sealedSource = path.join(OUTPUT_PARENT, sourceEvaluation, "SEALED_TECHNICAL_EVIDENCE.jsonl")
  const intentByTurn = existsSync(sealedSource) ? new Map(readFileSync(sealedSource, "utf8").trim().split("\n")
    .filter(Boolean).map((line) => {
      const row = JSON.parse(line) as any
      return [`${row.conversationId}:${row.turnIndex}`, String(row.syntheticIntent || "other")] as const
    })) : new Map<string, string>()
  const rows = conversations.map((conversation, index) => {
    const profile = PROFILES[index % PROFILES.length]!
    const messages = conversation.turns.filter((turn) => turn.role === "user").map((turn) => turn.text)
    const depth: DnaS13Depth = profile === "D" ? "short" : profile === "C" ? "deep" : "standard"
    const intentTags = Object.freeze(messages.map((_, turnIndex) =>
      intentByTurn.get(`${conversation.conversationId}:${turnIndex + 1}`) ?? "other"))
    return Object.freeze({ conversationId: conversation.conversationId, profile, depth, messages: Object.freeze(messages), intentTags })
  })
  if (rows.length !== 60 || rows.flatMap((row) => row.messages).length !== 300) {
    throw new Error(`blind_eval_${sourceEvaluation}_diagnostic_fixture_shape_invalid`)
  }
  return Object.freeze(rows)
}

function sha(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex")
}

function stable(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function writePrivate(file: string, value: string | unknown) {
  writeFileSync(file, typeof value === "string" ? value : stable(value), { mode: 0o600 })
  chmodSync(file, 0o600)
}

function appendPrivate(file: string, value: unknown) {
  appendFileSync(file, `${JSON.stringify(value)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return 0
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))] ?? 0
}

function evidenceSupportMetrics(sealedRows: readonly any[]) {
  const requested = sealedRows.flatMap((row) => row.facetEvidenceMatrix ?? [])
    .filter((entry: any) => entry.status !== "NOT_REQUESTED")
  const direct = requested.filter((entry: any) => entry.status === "SUPPORTED_DIRECT").length
  const derived = requested.filter((entry: any) => entry.status === "SUPPORTED_DERIVED").length
  const unsupported = requested.filter((entry: any) => entry.status === "UNSUPPORTED").length
  const omitted = sealedRows.reduce((sum, row) => sum
    + Number(row.validator?.finalValidation?.omittedSupportedFacetCount ?? 0), 0)
  const corrections = sealedRows.filter((row) => row.contextOperation === "replace_previous_target")
  const accurateCorrections = corrections.filter((row) => row.semanticOperation?.correctionTargetAccurate === true).length
  const contextualRows = sealedRows.filter((row) => row.contextResolution?.expectedContextualTurn === true)
  const lowLexicalRows = sealedRows.filter((row) => row.contextResolution?.expectedLowLexicalTurn === true)
  const lowLexicalDeepenRows = lowLexicalRows.filter((row) => row.contextResolution?.expectedDeepen === true)
  const intraTurnRows = sealedRows.filter((row) => row.contextResolution?.expectedIntraTurnCoreference === true)
  const contrastEligibleRows = sealedRows.filter((row) => row.comparison?.verifiedDefinitionsAllowContrast === true)
  const knowledgeGaps = sealedRows.flatMap((row) => row.knowledgeGaps ?? [])
  return Object.freeze({
    requestedFacetCount: requested.length,
    directSupportedFacetCount: direct,
    derivedSupportedFacetCount: derived,
    unsupportedFacetCount: unsupported,
    omittedSupportedFacetCount: omitted,
    scientificFacetCoveragePercent: requested.length
      ? Number(((direct + derived) / requested.length * 100).toFixed(3)) : 100,
    syntheticFacetBoundaryRequiredClaimCount: sealedRows.reduce((sum, row) => sum
      + Number(row.guardrails?.syntheticFacetBoundaryRequiredClaimCount ?? 0), 0),
    internalEvidenceJargonCount: sealedRows.reduce((sum, row) => sum
      + Number(row.guardrails?.internalEvidenceJargonCount ?? 0), 0),
    facetEntailmentFalsePositiveCount: sealedRows.reduce((sum, row) => sum
      + Number(row.validator?.finalValidation?.facetEntailmentFalsePositiveCount ?? 0), 0),
    falseExampleSupportCount: sealedRows.reduce((sum, row) => sum
      + Number(row.validator?.finalValidation?.falseExampleSupportCount ?? 0), 0),
    falseSignificanceSupportCount: sealedRows.reduce((sum, row) => sum
      + Number(row.validator?.finalValidation?.falseSignificanceSupportCount ?? 0), 0),
    correctionRejectedTargetLeakCount: sealedRows.reduce((sum, row) => sum
      + Number(row.validator?.finalValidation?.correctionRejectedTargetLeakCount ?? 0), 0),
    activeCorrectionTargetAccuracyPercent: corrections.length
      ? Number((accurateCorrections / corrections.length * 100).toFixed(3)) : 100,
    informationGainMeasuredCount: sealedRows.filter((row) =>
      typeof row.semanticOperation?.followupInformationGain === "boolean").length,
    informationGainSuccessRate: (() => {
      const followups = sealedRows.filter((row) => typeof row.semanticOperation?.followupInformationGain === "boolean")
      return followups.length ? Number((followups.filter((row) => row.semanticOperation.followupInformationGain).length
        / followups.length * 100).toFixed(3)) : "N/A"
    })(),
    followupInformationGainRatePercent: (() => {
      const followups = sealedRows.filter((row) => typeof row.semanticOperation?.followupInformationGain === "boolean")
      return followups.length ? Number((followups.filter((row) => row.semanticOperation.followupInformationGain).length
        / followups.length * 100).toFixed(3)) : "N/A"
    })(),
    contextAnchoredFallbackViolationCount: sealedRows.reduce((sum, row) => sum
      + Number(row.semanticOperation?.contextAnchoredFallbackViolation ?? 0), 0),
    contextualTurnResolutionRate: rateOrNA(contextualRows.filter((row) => row.contextResolution.resolved).length, contextualRows.length),
    contextualTurnCount: contextualRows.length,
    lowLexicalContextResolutionRate: rateOrNA(lowLexicalRows.filter((row) => row.contextResolution.resolved).length, lowLexicalRows.length),
    lowLexicalContextCount: lowLexicalRows.length,
    lowLexicalDeepenResolutionRate: rateOrNA(lowLexicalDeepenRows.filter((row) => row.contextResolution.resolved).length, lowLexicalDeepenRows.length),
    lowLexicalDeepenCount: lowLexicalDeepenRows.length,
    missingPragmaticFrameCount: sealedRows.filter((row) => row.contextResolution?.expectedPragmaticFrame
      && !row.pragmaticTask).length,
    topicThesisConsistencyViolationCount: sealedRows.reduce((sum, row) => sum
      + Number(row.validator?.finalValidation?.topicThesisContradictionCount ?? 0), 0),
    nonSelfContainedFinalClaimCount: sealedRows.reduce((sum, row) => sum
      + Number(row.validator?.finalValidation?.nonSelfContainedFinalClaimCount ?? 0), 0),
    intraTurnCoreferenceAccuracy: rateOrNA(intraTurnRows.filter((row) => row.contextResolution.resolvedIntraTurnCoreference).length, intraTurnRows.length),
    intraTurnCoreferenceCount: intraTurnRows.length,
    genericComparisonConclusionCount: sealedRows.filter((row) => row.comparison?.genericConclusion === true).length,
    comparisonContrastSpecificityRate: rateOrNA(contrastEligibleRows.filter((row) => row.comparison?.specificConclusion === true).length, contrastEligibleRows.length),
    comparisonContrastEligibleCount: contrastEligibleRows.length,
    explicitNoRepeatViolationCount: sealedRows.filter((row) => row.discourseConstraints?.explicitNoRepeatViolation === true).length,
    semanticRepeatWithoutNeedCount: sealedRows.reduce((sum, row) => sum
      + Number(row.semanticOperation?.semanticRepeatWithoutNeedCount ?? 0), 0),
    availableButNotSelectedCount: knowledgeGaps.filter((gap: any) => gap.classification === "AVAILABLE_BUT_NOT_SELECTED").length,
    catalogGapCount: knowledgeGaps.filter((gap: any) => gap.classification === "CATALOG_GAP").length,
    catalogGapDistribution: Object.freeze(Object.fromEntries([
      "definition", "function_significance", "example", "boundary", "comparison", "deepening",
    ].map((kind) => [kind, knowledgeGaps.filter((gap: any) =>
      gap.classification === "CATALOG_GAP" && gap.missingEvidenceType === kind).length]))),
    answerSufficiencyFailureCount: sealedRows.reduce((sum, row) => sum
      + (row.validator?.failureCodes ?? []).filter((code: string) => [
        "DEFINE_NOT_SATISFIED", "WHY_NOT_SATISFIED", "DEEPEN_NO_INFORMATION_GAIN",
        "EXAMPLE_NOT_SATISFIED", "COMPARE_CONCLUSION_NOT_INFORMATIVE", "SIMPLIFY_NOT_TRANSFORMED",
      ].includes(code)).length, 0),
    subquestionOrderViolationCount: sealedRows.reduce((sum, row) => sum
      + Number(row.validator?.finalValidation?.subquestionOrderViolationCount ?? 0), 0),
  })
}

const EXPECTED_PRAGMATIC_ACTION: Readonly<Record<string, string>> = Object.freeze({
  why_importance: "WHY_SIGNIFICANCE",
  deepen: "DEEPEN",
  simplify: "SIMPLIFY",
  example: "EXAMPLE",
  comparison: "COMPARE",
  correction: "CORRECT_TARGET",
})

function rateOrNA(numerator: number, denominator: number) {
  return denominator ? Number((numerator / denominator * 100).toFixed(3)) : "N/A"
}

function pragmaticTaskMetrics(sealedRows: readonly any[]) {
  const annotated = sealedRows.flatMap((row) => {
    const expected = EXPECTED_PRAGMATIC_ACTION[String(row.syntheticIntent || "")]
    return expected ? [Object.freeze({ row, expected })] : []
  })
  const actionRows = (action: string) => annotated.filter((entry) => entry.expected === action)
  const actionRate = (action: string) => {
    const rows = actionRows(action)
    return rateOrNA(rows.filter((entry) => entry.row.pragmaticTask?.pragmaticAction === action).length, rows.length)
  }
  const informationGainRows = sealedRows.filter((row) =>
    typeof row.semanticOperation?.followupInformationGain === "boolean")
  const noRepeatRows = sealedRows.filter((row) =>
    row.pragmaticTask?.discourseConstraints?.includes("do_not_repeat"))
  return Object.freeze({
    pragmaticActionAccuracy: rateOrNA(annotated.filter((entry) =>
      entry.row.pragmaticTask?.pragmaticAction === entry.expected).length, annotated.length),
    pragmaticActionAnnotatedCount: annotated.length,
    whyActionResolutionRate: actionRate("WHY_SIGNIFICANCE"),
    deepenActionResolutionRate: actionRate("DEEPEN"),
    simplifyActionResolutionRate: actionRate("SIMPLIFY"),
    exampleActionResolutionRate: actionRate("EXAMPLE"),
    comparisonActionResolutionRate: actionRate("COMPARE"),
    informationGainMeasuredCount: informationGainRows.length,
    informationGainSuccessRate: rateOrNA(informationGainRows.filter((row) =>
      row.semanticOperation.followupInformationGain === true).length, informationGainRows.length),
    missingComparisonConclusionCount: sealedRows.filter((row) => row.pragmaticTask?.pragmaticAction === "COMPARE"
      && !row.requiredSlots?.some((slot: any) => slot.kind === "comparison_conclusion")).length,
    repeatedClaimDespiteNoRepeatCount: noRepeatRows.filter((row) => {
      const shown = new Set(row.semanticOperation?.alreadyShownClaimIds ?? [])
      return (row.selectedRequiredClaims ?? []).some((claim: any) => shown.has(claim.id))
    }).length,
    noRepeatMeasuredCount: noRepeatRows.length,
  })
}

function legacyEval002FacetReclassification(sealedRows: readonly any[]) {
  if (!DIAGNOSTIC_REPLAY_002) return null
  const source = path.join(OUTPUT_PARENT, "002", "SEALED_TECHNICAL_EVIDENCE.jsonl")
  const legacyRows = readFileSync(source, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as any)
  const current = new Map(sealedRows.map((row) => [`${row.conversationId}:${row.turnIndex}`, row]))
  const counts = { requestedFacetCount: 0, directSupportedFacetCount: 0, derivedSupportedFacetCount: 0, unsupportedFacetCount: 0, omittedSupportedFacetCount: 0 }
  for (const legacy of legacyRows) {
    const row = current.get(`${legacy.conversationId}:${legacy.turnIndex}`)
    if (!row) continue
    const statuses = new Map<string, string[]>((row.facetEvidenceMatrix ?? [])
      .filter((entry: any) => entry.status !== "NOT_REQUESTED")
      .reduce((pairs: [string, string[]][], entry: any) => {
        const pair = pairs.find(([facet]) => facet === entry.facet)
        if (pair) pair[1].push(entry.status)
        else pairs.push([entry.facet, [entry.status]])
        return pairs
      }, []))
    for (const facet of legacy.requestedFacets ?? []) {
      counts.requestedFacetCount += 1
      const status = statuses.get(facet)?.shift() ?? "UNSUPPORTED"
      if (status === "SUPPORTED_DIRECT") counts.directSupportedFacetCount += 1
      else if (status === "SUPPORTED_DERIVED") counts.derivedSupportedFacetCount += 1
      else counts.unsupportedFacetCount += 1
    }
    counts.omittedSupportedFacetCount += Number(row.validator?.finalValidation?.omittedSupportedFacetCount ?? 0)
  }
  return Object.freeze({
    ...counts,
    scientificFacetCoveragePercent: counts.requestedFacetCount
      ? Number(((counts.directSupportedFacetCount + counts.derivedSupportedFacetCount)
        / counts.requestedFacetCount * 100).toFixed(3)) : 100,
  })
}

function tokenBigrams(value: string) {
  const tokens = normalizeDnaChatText(value).split(" ").filter(Boolean)
  if (tokens.length < 2) return new Set(tokens)
  return new Set(tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`))
}

function similarity(left: string, right: string) {
  const a = tokenBigrams(left)
  const b = tokenBigrams(right)
  const union = new Set([...a, ...b])
  if (!union.size) return 0
  return [...a].filter((value) => b.has(value)).length / union.size
}

function extractQuestions(value: unknown, result: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) extractQuestions(item, result)
    return
  }
  if (!value || typeof value !== "object") return
  const row = value as Record<string, unknown>
  if (typeof row.question === "string" && row.question.trim()) result.push(row.question.trim())
  if (row.role === "user" && typeof row.text === "string" && row.text.trim()) result.push(row.text.trim())
  for (const nested of Object.values(row)) extractQuestions(nested, result)
}

function readPriorQuestions(file: string) {
  if (!existsSync(file)) return []
  const raw = readFileSync(file, "utf8").trim()
  if (!raw) return []
  const values: unknown[] = []
  if (file.endsWith(".jsonl")) {
    for (const line of raw.split("\n").filter(Boolean)) {
      try { values.push(JSON.parse(line) as unknown) } catch {}
    }
  } else {
    try { values.push(JSON.parse(raw) as unknown) } catch {}
  }
  const questions: string[] = []
  for (const value of values) extractQuestions(value, questions)
  return questions
}

function priorEvidenceFiles() {
  const base = path.join(SSD_ROOT, "Outputs/SelfMetaAI/dna-intelligence")
  return Object.freeze([
    path.join(base, "architecture-tournament/final-ux/s13-strict-regression-v3/s13-strict-40-regression-raw.json"),
    path.join(base, "architecture-tournament/final-ux/s13-strict-comparison-conclusion-v4/comparison-conclusion-10-raw.json"),
    path.join(base, "internal-canary/s13-strict-v4/targeted-context-fix-v1/run-20260810-rc1-1-preflight-001/fresh-targeted-holdout-80.jsonl"),
    path.join(base, "internal-canary/s13-strict-v4/targeted-context-fix-v1/run-20260810-rc1-1-preflight-001/run-003-failure-replay.jsonl"),
    path.join(base, "internal-canary/s13-strict-v4/run-20260810-autonomous-003/messages.jsonl"),
    path.join(base, "internal-canary/s13-strict-v4/run-20260810-autonomous-v2-001/messages.jsonl"),
    ...(EXTERNAL_BLIND_EVAL_002 ? [path.join(base, "external-blind-evaluation/001/blind-conversations.json")] : []),
    ...(EXTERNAL_BLIND_EVAL_003 || EXTERNAL_BLIND_EVAL_004 || EXTERNAL_BLIND_EVAL_005 || EXTERNAL_BLIND_EVAL_006 || EXTERNAL_BLIND_EVAL_007 ? [
      path.join(base, "external-blind-evaluation/001/blind-conversations.json"),
      path.join(base, "external-blind-evaluation/002/blind-conversations.json"),
      ...(EXTERNAL_BLIND_EVAL_004 || EXTERNAL_BLIND_EVAL_005 || EXTERNAL_BLIND_EVAL_006 || EXTERNAL_BLIND_EVAL_007
        ? [path.join(base, "external-blind-evaluation/003/blind-conversations.json")] : []),
      ...(EXTERNAL_BLIND_EVAL_005 || EXTERNAL_BLIND_EVAL_006 || EXTERNAL_BLIND_EVAL_007
        ? [path.join(base, "external-blind-evaluation/004/blind-conversations.json")] : []),
      ...(EXTERNAL_BLIND_EVAL_006 || EXTERNAL_BLIND_EVAL_007
        ? [path.join(base, "external-blind-evaluation/005/blind-conversations.json")] : []),
      ...(EXTERNAL_BLIND_EVAL_007
        ? [path.join(base, "external-blind-evaluation/006/blind-conversations.json")] : []),
    ] : []),
  ])
}

function validateFixture(rows: readonly Scenario[], groups: readonly TopicGroup[] = TOPIC_GROUPS) {
  if (rows.length !== 60) throw new Error(`blind_eval_conversation_count_invalid:${rows.length}`)
  const messages = rows.flatMap((row) => row.messages)
  if (messages.length !== 300) throw new Error(`blind_eval_message_count_invalid:${messages.length}`)
  const lengths = rows.map((row) => row.messages.length)
  if (lengths.filter((value) => value === 3).length !== 10
    || lengths.filter((value) => value === 5).length !== 40
    || lengths.filter((value) => value === 7).length !== 10) {
    throw new Error("blind_eval_length_distribution_invalid")
  }
  for (const profile of PROFILES) {
    if (rows.filter((row) => row.profile === profile).length !== 10) {
      throw new Error(`blind_eval_profile_distribution_invalid:${profile}`)
    }
  }
  if ((EXTERNAL_BLIND_EVAL_003 || EXTERNAL_BLIND_EVAL_004 || EXTERNAL_BLIND_EVAL_005 || EXTERNAL_BLIND_EVAL_006 || EXTERNAL_BLIND_EVAL_007)
    && rows.some((row) => row.intentTags?.length !== row.messages.length)) {
    throw new Error("blind_eval_fresh_intent_distribution_invalid")
  }
  const exact = new Set<string>()
  const privacyRejected: string[] = []
  for (const message of messages) {
    const normalized = normalizeDnaChatText(message)
    if (exact.has(normalized)) throw new Error(`blind_eval_internal_duplicate:${normalized}`)
    exact.add(normalized)
    const privacy = inspectDnaS13LimitedRolloutPrivacy({ question: message, mode: "theory" })
    if (!privacy.allowed) privacyRejected.push(`${message} [${privacy.reasonCodes.join(",")}]`)
  }
  if (privacyRejected.length) {
    throw new Error(`blind_eval_privacy_fixture_rejected:${privacyRejected.length}:${privacyRejected.slice(0, 12).join(" || ")}`)
  }
  const ambiguousTopics: string[] = []
  for (const group of groups) {
    for (const topic of [group.a, group.b, group.c]) {
      const resolved = resolveDnaS13NamedTopicSurfaces(topic)
      if (resolved.length !== 1) ambiguousTopics.push(`${topic}:${resolved.length}`)
    }
  }
  if (ambiguousTopics.length) throw new Error(`blind_eval_topic_surface_ambiguous:${ambiguousTopics.join("|")}`)
  const priorFiles = priorEvidenceFiles()
  const prior = [...new Set(priorFiles.flatMap(readPriorQuestions).map((value) => value.trim()).filter(Boolean))]
  const priorNormalized = new Set(prior.map(normalizeDnaChatText))
  let maximumSimilarity = 0
  let closest: Readonly<{ message: string; prior: string; score: number }> | null = null
  for (const message of messages) {
    if (priorNormalized.has(normalizeDnaChatText(message))) {
      throw new Error(`blind_eval_prior_exact_reuse:${message}`)
    }
    for (const priorMessage of prior) {
      const score = similarity(message, priorMessage)
      if (score > maximumSimilarity) {
        maximumSimilarity = score
        closest = { message, prior: priorMessage, score }
      }
      if (score >= NEAR_PARAPHRASE_THRESHOLD) {
        throw new Error(`blind_eval_prior_near_paraphrase:${score.toFixed(3)}:${message}`)
      }
    }
  }
  return Object.freeze({
    priorFiles: Object.freeze(priorFiles.filter(existsSync)),
    priorQuestionCount: prior.length,
    exactReuseCount: 0,
    nearParaphraseCount: 0,
    threshold: NEAR_PARAPHRASE_THRESHOLD,
    maximumSimilarity: Number(maximumSimilarity.toFixed(6)),
    closestPairHashes: closest ? Object.freeze({
      messageSha256: sha(closest.message),
      priorSha256: sha(closest.prior),
    }) : null,
  })
}

class HardCapRealizer implements Realizer {
  readonly identity
  private readonly inner: LunaRealizer
  private usages: DnaChatLunaUsage[] = []
  private readonly initialSpentMicrousd: number
  externalCalls = 0
  deniedCalls = 0
  stopReason: string | null = null

  constructor(apiKey: string, safetyIdentifier: string, initialSpentMicrousd = 0) {
    this.inner = new LunaRealizer({ apiKey, safetyIdentifier })
    this.identity = this.inner.identity
    this.initialSpentMicrousd = Math.max(0, initialSpentMicrousd)
  }

  totalUsage() {
    return Object.freeze(this.usages.reduce<DnaChatLunaUsage>((total, value) => ({
      inputTokens: total.inputTokens + value.inputTokens,
      cachedInputTokens: total.cachedInputTokens + value.cachedInputTokens,
      outputTokens: total.outputTokens + value.outputTokens,
      costMicrousd: total.costMicrousd + value.costMicrousd,
    }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }))
  }

  canStartMessage() {
    return !this.stopReason
      && this.initialSpentMicrousd + this.totalUsage().costMicrousd + CALL_RESERVE_MICROUSD <= HARD_CAP_MICROUSD
  }

  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    if (!this.canStartMessage()) {
      this.deniedCalls += 1
      this.stopReason = this.stopReason ?? "luna_hard_cap_reserve_reached"
      throw new Error(this.stopReason)
    }
    this.externalCalls += 1
    const attempt = await this.inner.realize(input)
    const usage = calculateDnaChatLunaUsage(attempt.usage)
    this.usages.push(usage)
    if (this.initialSpentMicrousd + this.totalUsage().costMicrousd > HARD_CAP_MICROUSD) {
      this.stopReason = "luna_hard_cap_exceeded"
      throw new Error(this.stopReason)
    }
    return attempt
  }
}

class LocalPreflightRealizer implements Realizer {
  private readonly inner = new DeterministicRealizer()
  readonly identity = this.inner.identity
  externalCalls = 0
  deniedCalls = 0
  stopReason: string | null = null

  totalUsage(): DnaChatLunaUsage {
    return Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 })
  }

  canStartMessage() {
    return true
  }

  realize(input: DnaS13RealizerRequest) {
    return this.inner.realize(input)
  }
}

function publicContext(body: Record<string, unknown>): PublicConversationContext | null {
  const value = body.conversationContext
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const topicIds = Array.isArray(row.topicIds)
    ? row.topicIds.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 2)
    : []
  const kind = String(row.lastQueryKind || "") as PublicConversationContext["lastQueryKind"]
  if (!topicIds.length || !["definition", "comparison", "relation", "measurement", "development", "evidence", "case", "unknown"].includes(kind)) return null
  return Object.freeze({ topicIds: Object.freeze(topicIds), lastQueryKind: kind })
}

function limitedContextToken(body: Record<string, unknown>) {
  const value = body.conversationContext
  if (!value || typeof value !== "object") return null
  const token = (value as Record<string, unknown>).limitedRolloutContextToken
  return typeof token === "string" && token.trim() ? token : null
}

function visibleAnswerText(body: Record<string, unknown>) {
  const topic = typeof body.topic === "string" ? body.topic : ""
  const summary = typeof body.summary === "string" ? body.summary.trim() : ""
  const details = Array.isArray(body.details)
    ? body.details.map((value) => String(value || "").trim()).filter(Boolean)
    : []
  if (topic.startsWith("conversation.")) return summary
  if (body.classification === "not_available") return [summary, details[0]].filter(Boolean).join("\n\n")
  const units = Array.isArray(body.answerUnits) ? body.answerUnits.flatMap((value) => {
    if (!value || typeof value !== "object") return []
    const row = value as Record<string, unknown>
    const kind = String(row.kind || "")
    const section = String(row.section || "")
    const text = typeof row.text === "string" ? row.text.trim() : ""
    if (!text || (kind === "safety_boundary" && section !== "case_non_inference")) return []
    return [text]
  }) : []
  return (units.length ? units : [summary, ...details]).filter(Boolean).join("\n\n")
}

async function deterministicNormalPath(input: Readonly<{
  question: string
  depth: DnaS13Depth
  context: PublicConversationContext | null
  subjectId: string
}>) {
  return resolveDnaChatApiRequest({
    question: input.question,
    mode: "theory",
    responseDepth: input.depth,
    ...(input.context ? { context: {
      topicIds: [...input.context.topicIds],
      lastQueryKind: input.context.lastQueryKind,
    } } : {}),
  }, {
    createRequestId: randomUUID,
    resolveRuntimeAnswer: (runtimeInput) => resolveCommittedDnaChatRuntime({
      ...runtimeInput,
      rolloutSubjectKey: input.subjectId,
    }),
    loadCaseAnswer: async () => ({ ok: false as const, status: 404 as const, error: "report_not_found" as const }),
    writeAudit: async () => ({ ok: true }),
  })
}

function selectedClaims(evidence: DnaS13LimitedTechnicalEvidence | null, role: "required" | "explanatory") {
  if (!evidence) return Object.freeze([])
  const selected = evidence.plan.slots.flatMap((slot) => slot.lockedClaims
    .filter((entry) => entry.role === role)
    .map((entry) => entry.claim))
  return Object.freeze([...new Map(selected.map((claim) => [claim.id, Object.freeze({
    id: claim.id,
    text: claim.text,
    passageId: claim.passageId,
    sourceIds: claim.sourceIds,
    topicId: claim.topicId,
  })])).values()])
}

function internalEvidenceJargonCount(value: string | null) {
  return value ? (value.match(INTERNAL_EVIDENCE_JARGON) ?? []).length : 0
}

function sealedEvidence(input: Readonly<{
  scenario: Scenario
  turnIndex: number
  messageId: string
  question: string
  finalAnswer: string | null
  assistantMessageProduced: boolean
  limited: Awaited<ReturnType<typeof runDnaS13LimitedRolloutMessage>> | null
  technical: DnaS13LimitedTechnicalEvidence | null
  privacy: ReturnType<typeof inspectDnaS13LimitedRolloutPrivacy>
  finalPath: "s13_limited" | "deterministic_normal_fallback" | "runtime_error"
  fallbackReason: string | null
  totalLatencyMs: number
  error: string | null
  priorVerifiedContextAvailable: boolean
}>) {
  const telemetry = input.limited?.telemetry ?? null
  const runtime = input.technical?.runtime ?? null
  const pragmaticTask = input.technical?.pragmaticTaskFrame ?? input.technical?.plan.pragmaticTaskFrame ?? null
  const comparison = pragmaticTask?.pragmaticAction === "COMPARE"
  const relation = input.technical?.queryFrame.subquestions.some((row) => row.questionType === "relation") ?? false
  const sourceViolation = telemetry?.validation.sourceViolationCount ?? 0
  const privacyLeak = !input.privacy.allowed && (telemetry?.realization.lunaCalls ?? 0) > 0 ? 1 : 0
  const semanticAudit = input.technical?.plan.semanticOperationAudit ?? null
  const activeTargetIds = semanticAudit?.targets.filter((target) => target.polarity === "ACTIVE_TARGET")
    .map((target) => target.topicId) ?? []
  const rejectedTargetIds = new Set(semanticAudit?.targets.filter((target) => target.polarity === "REJECTED_TARGET")
    .map((target) => target.topicId) ?? [])
  const plannedTopicIds = input.technical?.plan.slots.map((slot) => slot.topicId) ?? []
  const correctionTargetAccurate = input.technical?.contextOperation === "replace_previous_target"
    ? activeTargetIds.length === 1 && plannedTopicIds.length > 0
      && plannedTopicIds.every((topicId) => topicId === activeTargetIds[0])
      && plannedTopicIds.every((topicId) => !rejectedTargetIds.has(topicId))
    : null
  const syntheticIntent = input.scenario.intentTags?.[input.turnIndex - 1] ?? null
  const normalizedUserQuestion = normalizeDnaChatText(input.question)
  const expectedLowLexicalTurn = syntheticIntent === "typo_low_lexical_overlap"
  const expectedDeepen = expectedLowLexicalTurn && /\b(?:bir adim|derin\w*|ayrinti\w*|detay\w*|devam\w*)\b/u.test(normalizedUserQuestion)
  const expectedContextualTurn = input.priorVerifiedContextAvailable && [
    "why_importance", "deepen", "simplify", "example", "summarize", "typo_low_lexical_overlap",
  ].includes(String(syntheticIntent || ""))
  const expectedIntraTurnCoreference = /\b(?:sonra|ardindan)\b.{0,180}\b(?:modelin|bunun|bu modelin|bu yaklasimin|bu teorinin|bu kavramin|onun|ilkinin|ikincisinin)\b/u
    .test(normalizedUserQuestion)
  const anchoredOperation = /^(?:expand|simplify|why|example|explain|summarize)_same_topic$/u
    .test(input.technical?.contextOperation ?? "")
  const contextResolved = plannedTopicIds.length > 0 && input.finalPath === "s13_limited"
  const contextAnchoredFallbackViolation = (expectedContextualTurn || anchoredOperation)
    && !contextResolved ? 1 : 0
  const conclusionSlot = input.technical?.plan.slots.find((slot) => slot.kind === "comparison_conclusion") ?? null
  const normalizedConclusion = normalizeDnaChatText(conclusionSlot?.controlledText ?? "")
  const genericConclusion = runtime?.finalValidation.comparisonUserFacingSpecificity === false
    || /(?:farkli icerikleri tarif eder|burada ayni kavram olarak kullanilmaz|ayrim bu iki acik kapsam arasindadir|dogrulanmis kapsam)/u.test(normalizedConclusion)
  const verifiedDefinitionsAllowContrast = ["direct", "safe_categorical_inference", "contrast_by_verified_definitions"]
    .includes(input.technical?.plan.comparisonConclusionMode ?? "")
  const specificConclusion = verifiedDefinitionsAllowContrast && !genericConclusion
  const noRepeat = resolveDnaS13NoRepeatConstraint(input.question)
  const shownClaimIds = new Set(semanticAudit?.alreadyShownClaimIds ?? [])
  const repeatedRequiredClaim = selectedClaims(input.technical, "required").some((claim) => shownClaimIds.has(claim.id))
  return Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:sealed-evidence@1`,
    evaluationId: EVALUATION_ID,
    conversationId: input.scenario.conversationId,
    messageId: input.messageId,
    turnIndex: input.turnIndex,
    profile: input.scenario.profile,
    syntheticIntent,
    createdAt: new Date().toISOString(),
    userMessageSha256: sha(input.question),
    normalizedQuery: input.technical?.normalizedQuery ?? normalizeDnaChatText(input.question),
    contextOperation: input.technical?.contextOperation ?? telemetry?.routing.operation ?? null,
    contextResolutionMethod: input.technical?.contextResolutionMethod ?? null,
    pragmaticTask: pragmaticTask ? Object.freeze({
      version: pragmaticTask.version,
      targetResolution: pragmaticTask.targetResolution,
      targets: pragmaticTask.targets,
      pragmaticAction: pragmaticTask.pragmaticAction,
      requestedFacets: pragmaticTask.requestedFacets,
      discourseConstraints: pragmaticTask.discourseConstraints,
    }) : null,
    contextResolution: Object.freeze({
      priorVerifiedTargetAvailable: input.priorVerifiedContextAvailable,
      expectedContextualTurn,
      expectedLowLexicalTurn,
      expectedDeepen,
      expectedIntraTurnCoreference,
      expectedPragmaticFrame: Boolean(expectedContextualTurn || expectedIntraTurnCoreference
        || EXPECTED_PRAGMATIC_ACTION[String(syntheticIntent || "")]),
      resolved: contextResolved,
      resolvedIntraTurnCoreference: expectedIntraTurnCoreference
        ? input.technical?.contextResolutionMethod === "intra_turn_coreference"
          && new Set(input.technical.matches.map((match) => match.topicId)).size === 1
        : null,
    }),
    parsedTopic: input.technical ? input.technical.matches.map((match) => Object.freeze({
      topicId: match.topicId,
      topic: match.topic,
    })) : Object.freeze([]),
    questionType: input.technical?.queryFrame.subquestions.map((row) => row.questionType)
      ?? telemetry?.routing.questionTypes ?? Object.freeze([]),
    requestedFacets: input.technical?.queryFrame.subquestions.flatMap((row) => row.requestedFacets ?? [])
      ?? Object.freeze([]),
    facetEvidenceMatrix: input.technical?.plan.facetEvidenceMatrix ?? Object.freeze([]),
    answerSufficiency: input.technical?.plan.answerSufficiency ?? Object.freeze([]),
    knowledgeGaps: input.technical?.plan.knowledgeGaps ?? Object.freeze([]),
    semanticOperation: Object.freeze({
      operation: semanticAudit?.operation ?? input.technical?.contextOperation ?? null,
      targets: semanticAudit?.targets ?? Object.freeze([]),
      alreadyShownClaimIds: semanticAudit?.alreadyShownClaimIds ?? Object.freeze([]),
      alreadyAnsweredFacets: semanticAudit?.alreadyAnsweredFacets ?? Object.freeze([]),
      followupInformationGain: semanticAudit?.followupInformationGain ?? null,
      semanticRepeatWithoutNeedCount: semanticAudit?.semanticRepeatWithoutNeedCount ?? 0,
      correctionTargetAccurate,
      contextAnchoredFallbackViolation,
      orderedSubquestionIds: input.technical?.plan.orderedSubquestionIds ?? Object.freeze([]),
    }),
    selectedRequiredClaims: selectedClaims(input.technical, "required"),
    selectedExplanatoryClaims: selectedClaims(input.technical, "explanatory"),
    requiredSlots: input.technical?.plan.slots.map((slot) => Object.freeze({
      id: slot.id,
      kind: slot.kind,
      topicId: slot.topicId,
      questionType: slot.questionType,
      requestedFacet: slot.requestedFacet ?? null,
      requiredClaimIds: slot.requiredClaimIds,
      lockedClaimIds: slot.lockedClaimIds,
    })) ?? Object.freeze([]),
    retrievalConfidence: input.technical?.matches.map((match) => Object.freeze({
      topicId: match.topicId,
      score: match.score,
      headingCoverage: match.headingCoverage,
      leafHeadingCoverage: match.leafHeadingCoverage,
    })) ?? null,
    realization: Object.freeze({
      provider: runtime?.provenance.realizer.provider ?? telemetry?.realization.provider ?? "none",
      model: runtime?.provenance.realizer.model ?? null,
      status: runtime?.provenance.status ?? telemetry?.realization.status ?? "error",
      lunaUsed: (telemetry?.realization.lunaCalls ?? 0) > 0,
      lunaCalls: telemetry?.realization.lunaCalls ?? 0,
      rawFirstOutput: runtime?.provenance.rawFirstOutput ?? null,
      finalAcceptedOutput: runtime?.provenance.finalAcceptedOutput ?? null,
    }),
    repair: Object.freeze({
      used: (telemetry?.realization.repairCalls ?? 0) > 0,
      calls: telemetry?.realization.repairCalls ?? 0,
      rawOutput: runtime?.provenance.rawRepairOutput ?? null,
    }),
    fallback: Object.freeze({
      used: input.finalPath === "deterministic_normal_fallback",
      reason: input.fallbackReason,
      finalPath: input.finalPath,
    }),
    validator: Object.freeze({
      pass: runtime?.finalValidation.pass ?? telemetry?.validation.pass ?? false,
      failureCodes: runtime?.finalValidation.failureCodes ?? telemetry?.validation.failureCodes ?? Object.freeze([]),
      finalValidation: runtime?.finalValidation ?? null,
      rejectedAttemptValidations: runtime?.rejectedAttemptValidations ?? Object.freeze([]),
      unsupportedFactCount: telemetry?.validation.unsupportedFactCount ?? 0,
      unsupportedRelationCount: telemetry?.validation.unsupportedRelationCount ?? 0,
      sourceViolationCount: sourceViolation,
      safetyViolationCount: telemetry?.validation.safetyViolationCount ?? 0,
    }),
    relation: Object.freeze({
      requested: relation,
      unsupportedRelationCount: telemetry?.validation.unsupportedRelationCount ?? 0,
    }),
    comparison: Object.freeze({
      requested: comparison,
      sideASupported: telemetry?.retrieval.comparisonSideASupported ?? null,
      sideBSupported: telemetry?.retrieval.comparisonSideBSupported ?? null,
      conclusionMode: input.technical?.plan.comparisonConclusionMode ?? null,
      conclusionSupportClaimIds: input.technical?.plan.comparisonConclusionSupportClaimIds ?? Object.freeze([]),
      conclusionViolationCount: telemetry?.validation.comparisonConclusionViolationCount ?? 0,
      genericConclusion,
      specificConclusion,
      verifiedDefinitionsAllowContrast,
    }),
    abstention: Object.freeze({
      used: telemetry?.realization.abstained ?? false,
      mode: input.technical?.plan.comparisonConclusionMode === "abstain" ? "comparison_abstain" : null,
    }),
    latency: Object.freeze({
      totalMs: input.totalLatencyMs,
      retrievalMs: telemetry?.latency.retrievalMs ?? 0,
      lunaMs: telemetry?.latency.lunaMs ?? 0,
      validatorMs: telemetry?.latency.validatorMs ?? 0,
    }),
    tokenUsage: Object.freeze({
      inputTokens: telemetry?.realization.inputTokens ?? 0,
      cachedInputTokens: telemetry?.realization.cachedInputTokens ?? 0,
      outputTokens: telemetry?.realization.outputTokens ?? 0,
    }),
    cost: Object.freeze({
      microusd: telemetry?.realization.costMicrousd ?? 0,
      usd: Number(((telemetry?.realization.costMicrousd ?? 0) / 1_000_000).toFixed(6)),
      pricingModel: DNA_CHAT_LUNA_MODEL,
    }),
    privacy: Object.freeze({
      allowed: input.privacy.allowed,
      category: input.privacy.category,
      reasonCodes: input.privacy.reasonCodes,
      questionHash: input.privacy.questionHash,
      automaticTrainingAllowed: false,
    }),
    sourceStatus: Object.freeze({
      sourceViolationCount: sourceViolation,
      ownerBookSourceIds: input.technical
        ? [...new Set(input.technical.matches.map((match) => match.sourceId))]
        : Object.freeze([]),
      finalResponseProduced: input.assistantMessageProduced,
    }),
    guardrails: Object.freeze({
      privacyViolationCount: privacyLeak,
      crossAccountViolationCount: telemetry?.crossAccountViolationCount ?? 0,
      unsupportedFactCount: telemetry?.validation.unsupportedFactCount ?? 0,
      unsupportedRelationCount: telemetry?.validation.unsupportedRelationCount ?? 0,
      sourceViolationCount: sourceViolation,
      safetyViolationCount: telemetry?.validation.safetyViolationCount ?? 0,
      syntheticFacetBoundaryRequiredClaimCount: input.technical?.plan.slots.reduce((sum, slot) => sum
        + slot.requiredClaimIds.filter((claimId) => claimId.startsWith("system.facet-boundary:")).length, 0) ?? 0,
      internalEvidenceJargonCount: internalEvidenceJargonCount(input.finalAnswer),
      facetEntailmentFalsePositiveCount: runtime?.finalValidation.facetEntailmentFalsePositiveCount ?? 0,
      falseExampleSupportCount: runtime?.finalValidation.falseExampleSupportCount ?? 0,
      falseSignificanceSupportCount: runtime?.finalValidation.falseSignificanceSupportCount ?? 0,
      correctionRejectedTargetLeakCount: runtime?.finalValidation.correctionRejectedTargetLeakCount ?? 0,
      contextAnchoredFallbackViolationCount: contextAnchoredFallbackViolation,
      subquestionOrderViolationCount: runtime?.finalValidation.subquestionOrderViolationCount ?? 0,
    }),
    topicSemantics: input.technical?.plan.topicSemanticFrames ?? Object.freeze([]),
    discourseConstraints: Object.freeze({
      explicitNoRepeatRequested: noRepeat.doNotRepeat,
      explicitNoRepeatViolation: noRepeat.doNotRepeat && repeatedRequiredClaim,
    }),
    finalDisplayedAnswer: input.finalAnswer,
    finalDisplayedAnswerSha256: input.finalAnswer ? sha(input.finalAnswer) : null,
    assistantMessageProduced: input.assistantMessageProduced,
    automaticTrainingUse: "prohibited",
    trainingCandidate: false,
    error: input.error,
  })
}

function blindMarkdown(conversations: readonly BlindConversation[]) {
  return `${conversations.map((conversation, index) => {
    const turns = conversation.turns.map((turn) => `${turn.role === "user" ? "USER" : "DNA"}\n\n${turn.text}`).join("\n\n")
    return `Conversation ${String(index + 1).padStart(3, "0")}\n\n${turns}`
  }).join("\n\n")}\n`
}

function syntheticIntentDistribution(rows: readonly Scenario[]) {
  const tags = rows.flatMap((row) => row.intentTags ?? [])
  return Object.freeze(Object.fromEntries([...new Set(tags)].sort().map((tag) => [
    tag,
    tags.filter((value) => value === tag).length,
  ])))
}

function sealedTokenUsage(sealedRows: readonly any[]) {
  return Object.freeze(sealedRows.reduce((total, row) => ({
    inputTokens: total.inputTokens + Number(row.tokenUsage?.inputTokens ?? 0),
    cachedInputTokens: total.cachedInputTokens + Number(row.tokenUsage?.cachedInputTokens ?? 0),
    outputTokens: total.outputTokens + Number(row.tokenUsage?.outputTokens ?? 0),
  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 }))
}

function validateBlindFiles(markdown: string, conversations: readonly BlindConversation[]) {
  const forbiddenMarkdown = /(?:\bselected topic\b|\btopicId\b|\bclaimId\b|\bvalidator\b|\bLuna\b|\bdeterministic\b|\brepair\b|\bfallback\b|\bconfidence\b|\bcost\b|\blatency\b|\baudit\b|\bprofile(?:Id|Distribution)\b|\bprofile\s*:|\bexpected\b|\bgold\b|\bpass\b|\bfail\b|\berror\b)/iu
  if (forbiddenMarkdown.test(markdown)) throw new Error("blind_eval_markdown_technical_metadata_detected")
  for (const conversation of conversations) {
    if (Object.keys(conversation).sort().join(",") !== "conversationId,turns") throw new Error("blind_eval_json_conversation_shape_invalid")
    for (const turn of conversation.turns) {
      if (Object.keys(turn).sort().join(",") !== "role,text") throw new Error("blind_eval_json_turn_shape_invalid")
    }
  }
}

function fileMeta(file: string) {
  const value = readFileSync(file)
  return Object.freeze({ name: path.basename(file), bytes: value.byteLength, sha256: sha(value) })
}

type CompletedPackageRetry = Readonly<{
  reason: string
  rerunConversationIds: readonly string[]
  rerunFullConversations: true
  answerQualitySelection: false
  preRetryZipPath: string
  preRetryZipSha256: string
  retryCostMicrousd: number
  retryLunaCalls: number
}>

function packageCompletedEvidence(input: Readonly<{
  rows: readonly Scenario[]
  novelty: ReturnType<typeof validateFixture> | Readonly<Record<string, any>>
  files: typeof FILES
  zipPath: string
  actualCostMicrousd?: number
  actualLunaCalls?: number
  actualRepairs?: number
  technicalRetry?: CompletedPackageRetry
  allowIncomplete?: boolean
}>) {
  const { rows, novelty, files, zipPath } = input
  if (!existsSync(files.sealed)) throw new Error("completed_run_sealed_evidence_missing")
  if (existsSync(zipPath)) throw new Error("completed_run_zip_already_exists")
  const sealedRows = readFileSync(files.sealed, "utf8").trim().split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as any)
  if (sealedRows.length !== 300 || (!input.allowIncomplete
    && sealedRows.some((row) => row.error !== null || !row.assistantMessageProduced))) {
    throw new Error("completed_run_not_complete")
  }
  const byTurn = new Map(sealedRows.map((row) => [`${row.conversationId}:${row.turnIndex}`, row]))
  const blind = rows.map((scenario) => Object.freeze({
    conversationId: scenario.conversationId,
    turns: Object.freeze(scenario.messages.flatMap((question, index) => {
      const evidence = byTurn.get(`${scenario.conversationId}:${index + 1}`)
      if (!evidence) throw new Error("completed_diagnostic_evidence_missing")
      return [
        Object.freeze({ role: "user" as const, text: question }),
        ...(evidence.finalDisplayedAnswer
          ? [Object.freeze({ role: "assistant" as const, text: String(evidence.finalDisplayedAnswer) })]
          : []),
      ]
    })),
  }))
  const markdown = blindMarkdown(blind)
  validateBlindFiles(markdown, blind)
  writePrivate(files.blindMarkdown, markdown)
  writePrivate(files.blindJson, blind)
  const evidenceSupport = evidenceSupportMetrics(sealedRows)
  const namedCorrections = sealedRows.filter((row) => row.contextOperation === "replace_previous_target"
    && row.contextResolutionMethod === "correction_named_target")
  const namedCorrectionSuccessCount = namedCorrections.filter((row) => row.requiredSlots.length > 0
    && row.fallback.finalPath === "s13_limited").length
  const diagnosticMetrics = Object.freeze({
    lockedPlanNormalFallbackCount: sealedRows.filter((row) => row.requiredSlots.length > 0
      && row.fallback.finalPath === "deterministic_normal_fallback").length,
    finalPassWithFailureCodesCount: sealedRows.filter((row) => row.validator.pass && row.validator.failureCodes.length > 0).length,
    exampleUnrelatedFallbackCount: sealedRows.filter((row) => row.contextOperation === "example_same_topic"
      && row.fallback.finalPath !== "s13_limited").length,
    whyUnrelatedFallbackCount: sealedRows.filter((row) => row.contextOperation === "why_same_topic"
      && row.fallback.finalPath !== "s13_limited").length,
    exactNamedCorrection: Object.freeze({
      requested: namedCorrections.length,
      succeeded: namedCorrectionSuccessCount,
      percent: namedCorrections.length ? Number((namedCorrectionSuccessCount / namedCorrections.length * 100).toFixed(3)) : 100,
    }),
    evidenceSupport,
    pragmaticTask: pragmaticTaskMetrics(sealedRows),
    legacyEval002FacetReclassification: legacyEval002FacetReclassification(sealedRows),
    comparisonConclusionModes: Object.freeze(Object.fromEntries([
      "direct", "safe_categorical_inference", "contrast_by_verified_definitions", "abstain",
    ].map((mode) => [mode, sealedRows.filter((row) => row.comparison.conclusionMode === mode).length]))),
  })
  const finalEvidenceCostMicrousd = sealedRows.reduce((sum, row) => sum + row.cost.microusd, 0)
  const costMicrousd = input.actualCostMicrousd ?? finalEvidenceCostMicrousd
  if (costMicrousd > HARD_CAP_MICROUSD) throw new Error("completed_run_cost_cap_exceeded")
  const latencies = sealedRows.map((row) => Number(row.latency.totalMs || 0))
  const answeredRows = sealedRows.filter((row) => row.assistantMessageProduced && row.finalDisplayedAnswer)
  const errorRows = sealedRows.filter((row) => row.error !== null || !row.assistantMessageProduced)
  const completedConversations = rows.filter((scenario) => scenario.messages.every((_, index) => {
    const evidence = byTurn.get(`${scenario.conversationId}:${index + 1}`)
    return Boolean(evidence?.assistantMessageProduced && evidence.finalDisplayedAnswer)
  })).length
  const summary = Object.freeze({
    conversationCount: blind.length,
    userMessageCount: 300,
    assistantAnswerCount: answeredRows.length,
    completedMessageCount: answeredRows.length,
    errorMessageCount: errorRows.length,
    completedConversationCount: completedConversations,
    incompleteConversationCount: blind.length - completedConversations,
    lunaCalls: input.actualLunaCalls ?? sealedRows.reduce((sum, row) => sum + row.realization.lunaCalls, 0),
    repairs: input.actualRepairs ?? sealedRows.reduce((sum, row) => sum + row.repair.calls, 0),
    fallbacks: sealedRows.filter((row) => row.fallback.finalPath === "deterministic_normal_fallback").length,
    criticalDeterministicViolations: sealedRows.reduce((sum, row) => sum
      + row.guardrails.privacyViolationCount + row.guardrails.crossAccountViolationCount
      + row.guardrails.unsupportedFactCount + row.guardrails.unsupportedRelationCount
      + row.guardrails.sourceViolationCount + row.guardrails.safetyViolationCount, 0),
    tokenUsage: sealedTokenUsage(sealedRows),
    totalCostUsd: Number((costMicrousd / 1_000_000).toFixed(6)),
    p50LatencyMs: Number(percentile(latencies, 0.5).toFixed(3)),
    p95LatencyMs: Number(percentile(latencies, 0.95).toFixed(3)),
    diagnosticMetrics,
    ...(input.technicalRetry ? { technicalRetry: input.technicalRetry } : {}),
  })
  writePrivate(files.summary, summary)
  const preManifestFiles = [files.blindMarkdown, files.blindJson, files.sealed, files.summary]
  writePrivate(files.manifest, Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:manifest@1`,
    evaluationId: EVALUATION_ID,
    createdAt: new Date().toISOString(),
    runtime: Object.freeze({
      primary: "current_s13_strict_v4_limited_internal_runtime",
      fallback: "current_deterministic_normal_runtime",
      model: LOCAL_DIAGNOSTIC_PREFLIGHT ? "deterministic-locked-plan@1" : DNA_CHAT_LUNA_MODEL,
      localDiagnosticPreflight: LOCAL_DIAGNOSTIC_PREFLIGHT,
      productionBehaviorChanged: false,
      architectureResearchPerformed: false,
    }),
    sampling: Object.freeze({
      syntheticNonSensitive: true,
      goldAnswers: false,
      codexQualityScoring: false,
      cherryPicking: false,
      plannedConversationCount: 60,
      plannedUserMessageCount: 300,
      profileDistribution: Object.fromEntries(PROFILES.map((profile) => [profile, rows.filter((row) => row.profile === profile).length])),
      lengthDistribution: Object.freeze({ short3: 10, medium5: 40, long7: 10 }),
      ...(EXTERNAL_BLIND_EVAL_006 ? {
        distinctBaseTopicCount: new Set(eval006TopicGroups().flatMap((group) => [group.a, group.b, group.c])
          .map(normalizeDnaChatText)).size,
        syntheticIntentDistribution: syntheticIntentDistribution(rows),
      } : {}),
      novelty,
      ...(input.technicalRetry ? { technicalRetry: input.technicalRetry } : {}),
    }),
    costGuardrail: Object.freeze({ hardCapUsd: 1, stoppedByCostCap: false, stopReason: null }),
    blindIsolation: Object.freeze({
      markdownTechnicalMetadataDetected: false,
      jsonTechnicalMetadataDetected: false,
      profilesPresentInBlindFiles: false,
      sealedEvidenceSeparate: true,
    }),
    files: Object.freeze(preManifestFiles.map(fileMeta)),
  }))
  execFileSync("zip", ["-q", "-j", zipPath, ...preManifestFiles, files.manifest])
  chmodSync(zipPath, 0o600)
  const result = Object.freeze({
    evaluationId: EVALUATION_ID,
    ...summary,
    blindTechnicalMetadataAbsent: true,
    zipPath,
    zipBytes: statSync(zipPath).size,
    zipSha256: sha(readFileSync(zipPath)),
  })
  console.log(JSON.stringify(result))
  return result
}

function packageCompletedDiagnosticRun(rows: readonly Scenario[], novelty: ReturnType<typeof validateFixture> | Readonly<Record<string, any>>) {
  if (!DIAGNOSTIC_REPLAY) throw new Error("completed_diagnostic_mode_required")
  return packageCompletedEvidence({ rows, novelty, files: FILES, zipPath: ZIP_PATH })
}

function packageExistingEvaluationRun(rows: readonly Scenario[], novelty: ReturnType<typeof validateFixture> | Readonly<Record<string, any>>) {
  if (!EXTERNAL_BLIND_EVAL_006) throw new Error("completed_eval006_mode_required")
  return packageCompletedEvidence({ rows, novelty, files: FILES, zipPath: ZIP_PATH, allowIncomplete: true })
}

function mergeTechnicalRetry(input: Readonly<{
  fixtureRows: readonly Scenario[]
  novelty: ReturnType<typeof validateFixture> | Readonly<Record<string, any>>
  retryRows: readonly any[]
  retryCostMicrousd: number
  retryLunaCalls: number
  retryRepairs: number
}>) {
  const target = RETRY_CONVERSATION
  const diagnosticRetry = Boolean(DIAGNOSTIC_REPLAY_001 && RETRY_DIAGNOSTIC_CONVERSATION)
  if (!target || (!EXTERNAL_BLIND_EVAL_002 && !diagnosticRetry)) throw new Error("blind_eval_retry_mode_required")
  if (input.retryRows.length === 0 || input.retryRows.some((row) => row.conversationId !== target
    || row.error !== null || !row.assistantMessageProduced)) throw new Error("eval002_retry_rows_invalid")
  const canonicalDir = diagnosticRetry
    ? path.join(OUTPUT_PARENT, `diagnostic-replay-001-after-targeted-fixes-run-${DIAGNOSTIC_RUN_ID}`)
    : CANONICAL_EVAL_002_DIR
  const canonicalZip = diagnosticRetry
    ? path.join(OUTPUT_PARENT, `DNA_S13_EXTERNAL_BLIND_DIAGNOSTIC_REPLAY_001_RUN_${DIAGNOSTIC_RUN_ID}.zip`)
    : CANONICAL_EVAL_002_ZIP
  const canonicalFiles = Object.freeze({
    blindMarkdown: path.join(canonicalDir, "BLIND_CONVERSATION_REVIEW.md"),
    blindJson: path.join(canonicalDir, "blind-conversations.json"),
    sealed: path.join(canonicalDir, "SEALED_TECHNICAL_EVIDENCE.jsonl"),
    summary: path.join(canonicalDir, "objective-run-summary.json"),
    manifest: path.join(canonicalDir, "manifest.json"),
  })
  if (!Object.values(canonicalFiles).every(existsSync) || !existsSync(canonicalZip)) {
    throw new Error("blind_eval_canonical_pre_retry_evidence_missing")
  }
  const originalSummary = JSON.parse(readFileSync(canonicalFiles.summary, "utf8")) as any
  const originalRows = readFileSync(canonicalFiles.sealed, "utf8").trim().split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as any)
  const mergedByTurn = new Map(originalRows.filter((row) => row.conversationId !== target)
    .map((row) => [`${row.conversationId}:${row.turnIndex}`, row]))
  for (const row of input.retryRows) mergedByTurn.set(`${row.conversationId}:${row.turnIndex}`, row)
  const mergedRows = input.fixtureRows.flatMap((scenario) => scenario.messages.map((_, index) => {
    const row = mergedByTurn.get(`${scenario.conversationId}:${index + 1}`)
    if (!row) throw new Error(`eval002_retry_merge_turn_missing:${scenario.conversationId}:${index + 1}`)
    return row
  }))
  if (mergedRows.length !== 300 || mergedRows.some((row) => row.error !== null || !row.assistantMessageProduced)) {
    throw new Error("eval002_retry_merge_not_complete")
  }

  const backupStem = diagnosticRetry ? `diagnostic-replay-001-run-${DIAGNOSTIC_RUN_ID}` : "002"
  const backupDir = path.join(OUTPUT_PARENT, `${backupStem}-pre-retry-${target}`)
  const backupZip = path.join(OUTPUT_PARENT, `${EVALUATION_ID}_PRE_RETRY_${target.toUpperCase()}.zip`)
  if (existsSync(backupDir) || existsSync(backupZip)) throw new Error("eval002_retry_backup_already_exists")
  mkdirSync(backupDir, { recursive: true, mode: 0o700 })
  for (const file of Object.values(canonicalFiles)) copyFileSync(file, path.join(backupDir, path.basename(file)))
  const preRetryZipSha256 = sha(readFileSync(canonicalZip))
  renameSync(canonicalZip, backupZip)
  writePrivate(canonicalFiles.sealed, `${mergedRows.map((row) => JSON.stringify(row)).join("\n")}\n`)

  const originalCostMicrousd = Math.round(Number(originalSummary.totalCostUsd || 0) * 1_000_000)
  const technicalRetry = Object.freeze({
    reason: diagnosticRetry
      ? "canonical_title_negation_misclassified_as_correction"
      : "catalog_title_internal_ve_misparsed_as_comparison_separator",
    rerunConversationIds: Object.freeze([target]),
    rerunFullConversations: true as const,
    answerQualitySelection: false as const,
    preRetryZipPath: backupZip,
    preRetryZipSha256,
    retryCostMicrousd: input.retryCostMicrousd,
    retryLunaCalls: input.retryLunaCalls,
  })
  return packageCompletedEvidence({
    rows: input.fixtureRows,
    novelty: input.novelty,
    files: canonicalFiles,
    zipPath: canonicalZip,
    actualCostMicrousd: originalCostMicrousd + input.retryCostMicrousd,
    actualLunaCalls: Number(originalSummary.lunaCalls || 0) + input.retryLunaCalls,
    actualRepairs: Number(originalSummary.repairs || 0) + input.retryRepairs,
    technicalRetry,
  })
}

async function main() {
  if (!existsSync(SSD_ROOT)) throw new Error("research_ssd_not_mounted")
  const activeGroups = EXTERNAL_BLIND_EVAL_007 ? eval007TopicGroups()
    : EXTERNAL_BLIND_EVAL_006 ? eval006TopicGroups()
    : EXTERNAL_BLIND_EVAL_005 ? eval005TopicGroups()
    : EXTERNAL_BLIND_EVAL_004 ? eval004TopicGroups()
    : EXTERNAL_BLIND_EVAL_003 ? eval003TopicGroups()
    : EXTERNAL_BLIND_EVAL_002 ? eval002TopicGroups() : TOPIC_GROUPS
  const fixtureRows = DIAGNOSTIC_REPLAY ? diagnosticReplayScenarios()
    : EXTERNAL_BLIND_EVAL_007 ? eval007Scenarios()
    : EXTERNAL_BLIND_EVAL_006 ? eval006Scenarios()
    : EXTERNAL_BLIND_EVAL_005 ? eval005Scenarios()
    : EXTERNAL_BLIND_EVAL_004 ? eval004Scenarios()
      : EXTERNAL_BLIND_EVAL_003 ? eval003Scenarios()
      : EXTERNAL_BLIND_EVAL_002 ? eval002Scenarios() : scenarios()
  const rows = RETRY_CONVERSATION
    ? fixtureRows.filter((row) => row.conversationId === RETRY_CONVERSATION)
    : fixtureRows
  if (RETRY_CONVERSATION && (rows.length !== 1
    || (!EXTERNAL_BLIND_EVAL_002 && !(DIAGNOSTIC_REPLAY_001 && RETRY_DIAGNOSTIC_CONVERSATION)))) {
    throw new Error("blind_eval_retry_conversation_invalid")
  }
  const novelty = DIAGNOSTIC_REPLAY
    ? Object.freeze({
        priorFiles: Object.freeze([path.join(OUTPUT_PARENT,
          DIAGNOSTIC_REPLAY_006 ? "006" : DIAGNOSTIC_REPLAY_005 ? "005" : DIAGNOSTIC_REPLAY_004 ? "004" : DIAGNOSTIC_REPLAY_003 ? "003" : DIAGNOSTIC_REPLAY_002 ? "002" : "001", "blind-conversations.json")]),
        priorQuestionCount: 300,
        exactReuseCount: 300,
        nearParaphraseCount: 0,
        threshold: NEAR_PARAPHRASE_THRESHOLD,
        maximumSimilarity: 1,
        closestPairHashes: null,
      })
    : validateFixture(fixtureRows, activeGroups)
  if (process.argv.includes("--validate-fixture-only")) {
    console.log(JSON.stringify({
      evaluationId: EVALUATION_ID,
      conversationCount: fixtureRows.length,
      userMessageCount: fixtureRows.flatMap((row) => row.messages).length,
      novelty,
    }))
    return
  }
  if (PACKAGE_COMPLETED_RUN) {
    if (DIAGNOSTIC_REPLAY) packageCompletedDiagnosticRun(fixtureRows, novelty)
    else packageExistingEvaluationRun(fixtureRows, novelty)
    return
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim() || ""
  if (!LOCAL_DIAGNOSTIC_PREFLIGHT && !apiKey) throw new Error("openai_api_key_missing")
  if (existsSync(OUTPUT_DIR) || existsSync(ZIP_PATH)) throw new Error("blind_eval_output_already_exists")
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 })
  writePrivate(FILES.sealed, "")

  const subjectId = `external-blind-eval-${sha(EVALUATION_ID).slice(0, 16)}`
  const telemetrySecret = sha(`${EVALUATION_ID}:telemetry-secret`)
  const contextSecret = sha(`${EVALUATION_ID}:context-secret`)
  const subjectIdHash = hashDnaS13LimitedIdentifier({ secret: telemetrySecret, kind: "subject", value: subjectId })
  if (!subjectIdHash) throw new Error("blind_eval_subject_hash_failed")
  const retryCanonicalDir = DIAGNOSTIC_REPLAY_001
    ? path.join(OUTPUT_PARENT, `diagnostic-replay-001-after-targeted-fixes-run-${DIAGNOSTIC_RUN_ID}`)
    : CANONICAL_EVAL_002_DIR
  const preRetrySummary = RETRY_CONVERSATION
    ? JSON.parse(readFileSync(path.join(retryCanonicalDir, "objective-run-summary.json"), "utf8")) as any
    : null
  const preRetrySpentMicrousd = Math.round(Number(preRetrySummary?.totalCostUsd || 0) * 1_000_000)
  const realizer = LOCAL_DIAGNOSTIC_PREFLIGHT
    ? new LocalPreflightRealizer()
    : new HardCapRealizer(
        apiKey,
        `external-blind-eval:${sha(subjectId).slice(0, 24)}`,
        preRetrySpentMicrousd + PRIOR_ATTEMPT_SPENT_MICROUSD,
      )
  const blind: BlindConversation[] = []
  const latencies: number[] = []
  let assistantAnswerCount = 0
  let completedMessageCount = 0
  let errorMessageCount = 0
  let completedConversationCount = 0
  let incompleteConversationCount = 0
  let repairs = 0
  let fallbacks = 0
  let criticalViolations = 0
  let stoppedByCostCap = false
  const sealedRows: any[] = []

  for (const scenario of rows) {
    const turns: BlindTurn[] = []
    let limitedToken: string | null = null
    let normalContext: PublicConversationContext | null = null
    let complete = true
    const conversationIdHash = hashDnaS13LimitedIdentifier({
      secret: telemetrySecret,
      kind: "conversation",
      value: `${subjectId}\u0000${scenario.conversationId}`,
    })
    if (!conversationIdHash) throw new Error("blind_eval_conversation_hash_failed")

    for (let index = 0; index < scenario.messages.length; index += 1) {
      if (!realizer.canStartMessage()) {
        realizer.stopReason = realizer.stopReason ?? "luna_hard_cap_reserve_reached"
        stoppedByCostCap = true
        complete = false
        break
      }
      const question = scenario.messages[index]!
      const priorVerifiedContextAvailable = Boolean(limitedToken || normalContext?.topicIds.length)
      const messageId = randomUUID()
      const started = performance.now()
      const privacy = inspectDnaS13LimitedRolloutPrivacy({ question, mode: "theory" })
      turns.push(Object.freeze({ role: "user", text: question }))
      let limited: Awaited<ReturnType<typeof runDnaS13LimitedRolloutMessage>> | null = null
      let technical: DnaS13LimitedTechnicalEvidence | null = null
      let finalAnswer: string | null = null
      let finalPath: "s13_limited" | "deterministic_normal_fallback" | "runtime_error" = "runtime_error"
      let fallbackReason: string | null = null
      let error: string | null = null
      try {
        limited = await runDnaS13LimitedRolloutMessage({
          requestId: messageId,
          subjectId,
          subjectIdHash,
          conversationIdHash,
          sessionId: conversationIdHash.slice(0, 40),
          question,
          responseDepth: scenario.depth,
          contextToken: limitedToken,
          contextSecret,
          privacy,
          rolloutPhase: "L0",
          safetyIdentifier: `external-blind-eval:${sha(subjectId).slice(0, 24)}`,
          realizer,
          technicalObserver: (value) => { technical = value },
        })
        repairs += limited.telemetry.realization.repairCalls
        const messageCritical = (limited.telemetry.validation.unsupportedFactCount
          + limited.telemetry.validation.unsupportedRelationCount
          + limited.telemetry.validation.sourceViolationCount
          + limited.telemetry.validation.safetyViolationCount
          + limited.telemetry.crossAccountViolationCount
          + (!privacy.allowed && limited.telemetry.realization.lunaCalls > 0 ? 1 : 0))
        criticalViolations += messageCritical
        if (limited.kind === "answered") {
          finalAnswer = visibleAnswerText(limited.body)
          if (!finalAnswer) throw new Error("blind_eval_empty_limited_display_answer")
          finalPath = "s13_limited"
          limitedToken = limitedContextToken(limited.body)
          normalContext = publicContext(limited.body)
        } else {
          fallbacks += 1
          fallbackReason = limited.reason
          const normal = await deterministicNormalPath({
            question,
            depth: scenario.depth,
            context: normalContext,
            subjectId,
          })
          if (normal.status !== 200 || normal.body.ok !== true) {
            throw new Error(`blind_eval_normal_fallback_failed:${normal.status}:${String(normal.body.error || "unknown")}`)
          }
          finalAnswer = visibleAnswerText(normal.body)
          if (!finalAnswer) throw new Error("blind_eval_empty_fallback_display_answer")
          finalPath = "deterministic_normal_fallback"
          limitedToken = null
          normalContext = publicContext(normal.body)
        }
        turns.push(Object.freeze({ role: "assistant", text: finalAnswer }))
        assistantAnswerCount += 1
        completedMessageCount += 1
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "unknown_runtime_error"
        errorMessageCount += 1
        complete = false
        limitedToken = null
        normalContext = null
        if (error.includes("luna_hard_cap")) {
          stoppedByCostCap = true
          realizer.stopReason = realizer.stopReason ?? error
        }
      }
      const totalLatencyMs = performance.now() - started
      latencies.push(totalLatencyMs)
      const evidenceRow = sealedEvidence({
        scenario,
        turnIndex: index + 1,
        messageId,
        question,
        finalAnswer,
        assistantMessageProduced: Boolean(finalAnswer),
        limited,
        technical,
        privacy,
        finalPath,
        fallbackReason,
        totalLatencyMs,
        error,
        priorVerifiedContextAvailable,
      })
      sealedRows.push(evidenceRow)
      appendPrivate(FILES.sealed, evidenceRow)
      if ((completedMessageCount + errorMessageCount) % 10 === 0) {
        console.log(JSON.stringify({
          progress: completedMessageCount + errorMessageCount,
          assistantAnswers: assistantAnswerCount,
          errors: errorMessageCount,
          lunaCalls: realizer.externalCalls,
          costMicrousd: realizer.totalUsage().costMicrousd,
        }))
      }
      if (stoppedByCostCap) break
    }
    blind.push(Object.freeze({ conversationId: scenario.conversationId, turns: Object.freeze(turns) }))
    if (complete && turns.filter((turn) => turn.role === "user").length === scenario.messages.length
      && turns.filter((turn) => turn.role === "assistant").length === scenario.messages.length) {
      completedConversationCount += 1
    } else {
      incompleteConversationCount += 1
    }
    if (stoppedByCostCap) break
  }

  const markdown = blindMarkdown(blind)
  validateBlindFiles(markdown, blind)
  writePrivate(FILES.blindMarkdown, markdown)
  writePrivate(FILES.blindJson, blind)
  const usage = realizer.totalUsage()
  const lockedPlanNormalFallbackCount = sealedRows.filter((row) => row.requiredSlots.length > 0
    && row.fallback.finalPath === "deterministic_normal_fallback").length
  const finalPassWithFailureCodesCount = sealedRows.filter((row) => row.validator.pass
    && row.validator.failureCodes.length > 0).length
  const exampleUnrelatedFallbackCount = sealedRows.filter((row) => row.contextOperation === "example_same_topic"
    && row.fallback.finalPath !== "s13_limited").length
  const whyUnrelatedFallbackCount = sealedRows.filter((row) => row.contextOperation === "why_same_topic"
    && row.fallback.finalPath !== "s13_limited").length
  const namedCorrections = sealedRows.filter((row) => row.contextOperation === "replace_previous_target"
    && row.contextResolutionMethod === "correction_named_target")
  const namedCorrectionSuccessCount = namedCorrections.filter((row) => row.requiredSlots.length > 0
    && row.fallback.finalPath === "s13_limited").length
  const evidenceSupport = evidenceSupportMetrics(sealedRows)
  const comparisonModes = Object.freeze(Object.fromEntries([
    "direct", "safe_categorical_inference", "contrast_by_verified_definitions", "abstain",
  ].map((mode) => [mode, sealedRows.filter((row) => row.comparison.conclusionMode === mode).length])))
  const diagnosticMetrics = Object.freeze({
    lockedPlanNormalFallbackCount,
    finalPassWithFailureCodesCount,
    exampleUnrelatedFallbackCount,
    whyUnrelatedFallbackCount,
    exactNamedCorrection: Object.freeze({
      requested: namedCorrections.length,
      succeeded: namedCorrectionSuccessCount,
      percent: namedCorrections.length ? Number((namedCorrectionSuccessCount / namedCorrections.length * 100).toFixed(3)) : 100,
    }),
    evidenceSupport,
    pragmaticTask: pragmaticTaskMetrics(sealedRows),
    legacyEval002FacetReclassification: legacyEval002FacetReclassification(sealedRows),
    comparisonConclusionModes: comparisonModes,
  })
  const summary = Object.freeze({
    conversationCount: blind.length,
    userMessageCount: blind.reduce((sum, conversation) => sum + conversation.turns.filter((turn) => turn.role === "user").length, 0),
    assistantAnswerCount,
    completedMessageCount,
    errorMessageCount,
    completedConversationCount,
    incompleteConversationCount,
    lunaCalls: realizer.externalCalls,
    repairs,
    fallbacks,
    criticalDeterministicViolations: criticalViolations,
    tokenUsage: Object.freeze({
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
    }),
    totalCostUsd: Number((usage.costMicrousd / 1_000_000).toFixed(6)),
    p50LatencyMs: Number(percentile(latencies, 0.5).toFixed(3)),
    p95LatencyMs: Number(percentile(latencies, 0.95).toFixed(3)),
    diagnosticMetrics,
  })
  writePrivate(FILES.summary, summary)
  const preManifestFiles = [FILES.blindMarkdown, FILES.blindJson, FILES.sealed, FILES.summary]
  const manifest = Object.freeze({
    schemaVersion: `${SCHEMA_VERSION}:manifest@1`,
    evaluationId: EVALUATION_ID,
    createdAt: new Date().toISOString(),
    runtime: Object.freeze({
      primary: "current_s13_strict_v4_limited_internal_runtime",
      fallback: "current_deterministic_normal_runtime",
      model: LOCAL_DIAGNOSTIC_PREFLIGHT ? "deterministic-locked-plan@1" : DNA_CHAT_LUNA_MODEL,
      localDiagnosticPreflight: LOCAL_DIAGNOSTIC_PREFLIGHT,
      productionBehaviorChanged: false,
      architectureResearchPerformed: false,
    }),
    sampling: Object.freeze({
      syntheticNonSensitive: true,
      goldAnswers: false,
      codexQualityScoring: false,
      cherryPicking: false,
      plannedConversationCount: 60,
      plannedUserMessageCount: 300,
      profileDistribution: Object.fromEntries(PROFILES.map((profile) => [profile, rows.filter((row) => row.profile === profile).length])),
      lengthDistribution: Object.freeze({ short3: 10, medium5: 40, long7: 10 }),
      distinctBaseTopicCount: new Set(activeGroups.flatMap((group) => [group.a, group.b, group.c])
        .map(normalizeDnaChatText)).size,
      syntheticIntentDistribution: syntheticIntentDistribution(rows),
      novelty: Object.freeze({
        comparedPriorFileSha256: novelty.priorFiles.map((file) => Object.freeze({ file: path.basename(file), sha256: sha(readFileSync(file)) })),
        priorQuestionCount: novelty.priorQuestionCount,
        exactReuseCount: novelty.exactReuseCount,
        nearParaphraseCount: novelty.nearParaphraseCount,
        nearParaphraseThreshold: novelty.threshold,
        maximumObservedSimilarity: novelty.maximumSimilarity,
        closestPairHashes: novelty.closestPairHashes,
        l0RawPromptStatus: "not_persisted_by_existing_privacy_safe_telemetry",
      }),
    }),
    costGuardrail: Object.freeze({
      hardCapUsd: 1,
      reservePerCallUsd: CALL_RESERVE_MICROUSD / 1_000_000,
      priorAttemptSpentUsd: Number((PRIOR_ATTEMPT_SPENT_MICROUSD / 1_000_000).toFixed(6)),
      stoppedByCostCap,
      stopReason: realizer.stopReason,
    }),
    blindIsolation: Object.freeze({
      markdownTechnicalMetadataDetected: false,
      jsonTechnicalMetadataDetected: false,
      profilesPresentInBlindFiles: false,
      sealedEvidenceSeparate: true,
    }),
    files: Object.freeze(preManifestFiles.map(fileMeta)),
  })
  writePrivate(FILES.manifest, manifest)
  const packageFiles = [...preManifestFiles, FILES.manifest]
  execFileSync("zip", ["-q", "-j", ZIP_PATH, ...packageFiles])
  chmodSync(ZIP_PATH, 0o600)
  const zipBytes = statSync(ZIP_PATH).size
  console.log(JSON.stringify({
    evaluationId: EVALUATION_ID,
    ...summary,
    blindTechnicalMetadataAbsent: true,
    stoppedByCostCap,
    zipPath: ZIP_PATH,
    zipBytes,
    zipSha256: sha(readFileSync(ZIP_PATH)),
  }))
  if (RETRY_CONVERSATION) {
    mergeTechnicalRetry({
      fixtureRows,
      novelty,
      retryRows: sealedRows,
      retryCostMicrousd: usage.costMicrousd,
      retryLunaCalls: realizer.externalCalls,
      retryRepairs: repairs,
    })
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "external_blind_eval_failed")
  process.exitCode = 1
})
