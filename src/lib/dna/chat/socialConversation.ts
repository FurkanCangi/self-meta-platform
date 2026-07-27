import { normalizeDnaChatText } from "./text"

export const DNA_CHAT_SOCIAL_CONVERSATION_VERSION = "dna-chat-social-conversation@1"

export type DnaChatSocialIntent =
  | "greeting"
  | "wellbeing"
  | "thanks"
  | "farewell"
  | "capabilities"

export type DnaChatSocialMatch = {
  intent: DnaChatSocialIntent
  intentId: `social_${DnaChatSocialIntent}`
  topic: `conversation.${DnaChatSocialIntent}`
  summary: string
}

const SOCIAL_UTTERANCES: Record<DnaChatSocialIntent, readonly string[]> = {
  greeting: [
    "merhaba",
    "merhabalar",
    "selam",
    "selamlar",
    "hey",
    "mrb",
    "slm",
    "gunaydin",
    "iyi gunler",
    "iyi aksamlar",
    "iyi geceler",
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
  ],
  thanks: [
    "tesekkurler",
    "tesekkur ederim",
    "cok tesekkur ederim",
    "sag ol",
    "sagol",
    "eyvallah",
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
    "kimsin",
    "ne yapabilirsin",
    "bana nasil yardim edebilirsin",
    "ne ise yariyorsun",
    "sen nesin",
  ],
}

const SOCIAL_RESPONSES: Record<DnaChatSocialIntent, string> = {
  greeting: "Merhaba! Buradayım. DNA kavramları, nörofizyoloji ve rapor bulguları hakkında konuşabiliriz.",
  wellbeing: "İyiyim, teşekkür ederim. Hazırım; DNA ve nörofizyolojiyle ilgili konuları birlikte inceleyebiliriz.",
  thanks: "Rica ederim. Yardımcı olabildiysem ne mutlu.",
  farewell: "Görüşmek üzere. İstediğiniz zaman yeniden devam edebiliriz.",
  capabilities: "DNA kavramlarını ve temel nörofizyolojiyi açıklayabilir, kavramları karşılaştırabilir ve seçtiğiniz rapordaki güvenli bulguları genel bilgilerden ayrı ele alabilirim.",
}

const SOCIAL_INTENT_BY_UTTERANCE = new Map<string, DnaChatSocialIntent>(
  Object.entries(SOCIAL_UTTERANCES).flatMap(([intent, utterances]) =>
    utterances.map((utterance) => [normalizeDnaChatText(utterance), intent as DnaChatSocialIntent] as const)),
)

/**
 * Small talk is deliberately exact-match only. This keeps a greeting such as
 * "Merhaba, insula nedir?" in the scientific router instead of swallowing the
 * actual question.
 */
export function resolveDnaChatSocialConversation(
  question: string,
): DnaChatSocialMatch | null {
  const normalized = normalizeDnaChatText(question)
  const intent = SOCIAL_INTENT_BY_UTTERANCE.get(normalized)
  if (!intent) return null

  return {
    intent,
    intentId: `social_${intent}`,
    topic: `conversation.${intent}`,
    summary: SOCIAL_RESPONSES[intent],
  }
}
