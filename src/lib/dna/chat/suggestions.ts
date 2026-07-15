import type { DnaChatMode } from "./types"

export const DNA_CHAT_STARTER_QUESTIONS: Readonly<Record<DnaChatMode, readonly string[]>> =
  Object.freeze({
    theory: Object.freeze([
      "Sempatik ve parasempatik sistem self-regülasyonda nasıl çalışır?",
      "Uyarılma ile toparlanma arasındaki fark nedir?",
      "Ko-regülasyon neden gelişimsel olarak önemlidir?",
    ]),
    dna: Object.freeze([
      "DNA'nın altı regülasyon alanı nelerdir?",
      "İnterosepsiyon alanı neyi değerlendirir?",
      "Raporun güven düzeyi nasıl yorumlanır?",
    ]),
    case: Object.freeze([
      "Bu raporun ana bulgusu nedir?",
      "Bu bulguyu sınırlayan karşı kanıt var mı?",
      "Raporda korunmuş kapasite olarak ne görülüyor?",
    ]),
  })
