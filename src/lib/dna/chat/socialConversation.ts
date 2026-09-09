import { normalizeDnaChatText } from "./text"

export const DNA_CHAT_SOCIAL_CONVERSATION_VERSION = "dna-chat-social-conversation@5"

export type DnaChatSocialIntent =
  | "greeting"
  | "wellbeing"
  | "thanks"
  | "farewell"
  | "capabilities"
  | "orientation"
  | "simplification"
  | "conciseness"
  | "source_order"

export type DnaChatSocialMatch = {
  intent: DnaChatSocialIntent
  intentId: `social_${DnaChatSocialIntent}`
  topic: `conversation.${DnaChatSocialIntent}`
  summary: string
}

const SOCIAL_UTTERANCES: Record<DnaChatSocialIntent, readonly string[]> = {
  greeting: [
    "merhaba",
    "meraba",
    "merhabalar",
    "selam",
    "selamlar",
    "hey",
    "mrb",
    "slm",
    "gunaydin",
    "iyi gunler",
    "iyi aksamlar",
    "iyi aksamlar kolay gelsin",
    "iyi geceler",
    "kolay gelsin",
  ],
  wellbeing: [
    "nasilsin",
    "nasil gidiyor",
    "ne haber",
    "naber",
    "keyfin nasil",
    "sen nasilsin",
    "merhaba nasilsin",
    "selam nasilsin",
    "selam naber",
    "slm nbr",
  ],
  thanks: [
    "tesekkurler",
    "tesekkur ederim",
    "tesekkur ettim",
    "cok tesekkur ederim",
    "sag ol",
    "sagol",
    "saol",
    "eyvallah",
    "eyw",
  ],
  farewell: [
    "gorusuruz",
    "gorusmek uzere",
    "hosca kal",
    "kendine iyi bak",
    "bay bay",
  ],
  capabilities: [
    "sen kimsin",
    "sen kimsin ne yapiyorsun",
    "sen kimsin ne yapiyosun",
    "kimsin",
    "ne yapabilirsin",
    "bana nasil yardim edebilirsin",
    "ne ise yariyorsun",
    "sen nesin",
  ],
  orientation: [
    "nereden baslayayim",
    "hangi konudan baslayalim",
  ],
  simplification: [
    "anlamadim",
    "cok teknik",
  ],
  conciseness: [
    "sadece sonucu soyle",
    "tek cumleyle soyle",
  ],
  source_order: [
    "kaynaklari sonra ver",
    "kaynaklari en sona koy",
  ],
}

const SOCIAL_RESPONSES: Record<DnaChatSocialIntent, string> = {
  greeting: "Merhaba! Buradayım. DNA Intelligence hakkında bilgi verebilirim.",
  wellbeing: "İyiyim, teşekkür ederim. Hazırım; DNA Intelligence hakkında konuşabiliriz.",
  thanks: "Rica ederim. Yardımcı olabildiysem ne mutlu.",
  farewell: "Görüşmek üzere. İstediğiniz zaman yeniden devam edebiliriz.",
  capabilities: "DNA Intelligence kapsamındaki kavramları açıklayabilir, karşılaştırabilir ve seçtiğiniz rapordaki güvenli bulguları genel bilgilerden ayrı ele alabilirim.",
  orientation: "Öz düzenleme kavramından başlayabiliriz; sonra duyusal, duygusal ve yürütücü alanlarla ilişkisini sırayla ele alabiliriz.",
  simplification: "Elbette daha basit anlatabilirim. Anlamadığınız kısmı veya kavramı yazın; aynı konuyu kısa, açık ve öğrenci diliyle yeniden açıklayayım.",
  conciseness: "Kısa cevap: DNA Intelligence, kavramları açıklar, karşılaştırır ve güvenli rapor bulgularını genel bilgiden ayırır.",
  source_order: "Tamam; önce açıklamayı vereceğim, kullandığım kaynakları en sonda göstereceğim.",
}

const SOCIAL_INTENT_BY_UTTERANCE = new Map<string, DnaChatSocialIntent>(
  Object.entries(SOCIAL_UTTERANCES).flatMap(([intent, utterances]) =>
    utterances.map((utterance) => [normalizeDnaChatText(utterance), intent as DnaChatSocialIntent] as const)),
)

function canonicalSocialOnlySurface(question: string): string {
  const normalized = normalizeDnaChatText(question)
  // Keep repairs whole-message and intent-specific. General fuzzy matching at
  // this boundary could swallow a greeting followed by a scientific question.
  if (/^merhaba+$/u.test(normalized)) return "merhaba"
  if (/^nasilsin bugun$/u.test(normalized)) return "nasilsin"
  return normalized
}

/**
 * Small talk is deliberately exact-match only. This keeps a greeting such as
 * "Merhaba, insula nedir?" in the scientific router instead of swallowing the
 * actual question.
 */
export function resolveDnaChatSocialConversation(
  question: string,
): DnaChatSocialMatch | null {
  const normalized = canonicalSocialOnlySurface(question)
  const intent = SOCIAL_INTENT_BY_UTTERANCE.get(normalized)
  if (!intent) return null

  return {
    intent,
    intentId: `social_${intent}`,
    topic: `conversation.${intent}`,
    summary: SOCIAL_RESPONSES[intent],
  }
}
