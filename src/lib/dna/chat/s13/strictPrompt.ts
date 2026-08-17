import type { DnaS13StrictPlan } from "./strictContracts"

export const DNA_S13_STRICT_PROMPT_VERSION = "dna-s13-strict-prompts@15" as const

export function dnaS13StrictRealizationSchema(plan: DnaS13StrictPlan) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["slotRealizations", "unsupportedAddition"],
    properties: {
      slotRealizations: {
        type: "array",
        minItems: plan.slots.length,
        maxItems: plan.slots.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["slotId", "text", "usedClaimIds"],
          properties: {
            slotId: { type: "string", enum: plan.slots.map((slot) => slot.id) },
            text: { type: "string", minLength: 2, maxLength: 2_000 },
            usedClaimIds: {
              type: "array",
              minItems: 0,
              maxItems: Math.max(1, ...plan.slots.map((slot) => slot.lockedClaimIds.length)),
              items: { type: "string", enum: plan.lockedClaimIds },
            },
          },
        },
      },
      unsupportedAddition: { type: "boolean" },
    },
  }
}

export function dnaS13StrictInstructions(repairFailureCodes: readonly string[] = []) {
  return [
    "Sen bilimsel içerik seçen bir model değilsin; yalnız kilitlenmiş içerik planını doğal Türkçeye dönüştüren bir dil katmanısın.",
    "Her slotu ayrı yaz ve verilen sırayı koru. O slotun lockedClaims listesindeki bütün claim kimliklerini usedClaimIds alanında aynen kullan.",
    "Her slotta önce required rolündeki claim ile soruya doğrudan cevap ver; explanatory rolündeki sınır veya açıklamayı ancak bundan sonra yaz.",
    "Claim seçme, çıkarma, başka claimle değiştirme veya farklı slottaki claimi kullanma.",
    "Yeni bilimsel bilgi, örnek, mekanizma, sayı, yaş veya popülasyon, nedensellik, ilişki, klinik yorum ya da kaynak ekleme.",
    "Çünkü, bunun nedeni, bu nedenle, dolayısıyla, sonucunda, yol açar, neden olur, buna bağlı olarak, böylece veya bu yüzden gibi ilişki bağlaçlarını yalnız relationContracts açıkça izin veriyorsa kullan.",
    "İki ayrı claim arasında izinli relation contract yoksa bunları nötr ve ayrı cümlelerle yaz; aralarında neden, sonuç, açıklama, karşıtlık, sıra, eşdeğerlik veya hiyerarşi kurma.",
    "Kullanıcının açıkla, anlat veya biraz aç talebinde yalnız kilitli claimler izin veriyorsa bunları 2-4 bağlantılı ve akıcı cümleyle açıkla.",
    "Kaynak atomlarını mekanik biçimde art arda yapıştırma; anlamı ve kesinlik düzeyini değiştirmeden günlük, profesyonel ve anlaşılır Türkçe kullan.",
    "comparison_conclusion kontrollü metni dışında claim cümlelerini aynen kopyalama; aynı anlamı koruyarak sözdizimini doğal biçimde yeniden kur.",
    "Göndermeden önce birebir eşleşme kontrolü yap: kontrollü sonuç dışında hiçbir text alanı lockedClaims.text cümlesini aynen içermesin. Cümle başını, sözcük sırasını veya yüklemi doğal biçimde yeniden kur; yeni anlam ekleme.",
    "Arousal terimine Türkçe çekim eki ekleme; Türkçe ek gerektiğinde 'uyarılma düzeyi' ifadesini kullan.",
    "İki soru varsa iki slotu da eksiksiz yanıtla. Claim kimliklerini cevap metninde gösterme.",
    "Slotun requestedFacet değeri verified_example ise yalnız lockedClaims içindeki somut olayı veya senaryoyu örnek olarak aktar; tanım, sınır ya da ilişki bilgisini örnek gibi sunma.",
    "Slotun requestedFacet değeri function ise yalnız lockedClaims içinde açıkça verilen işlev, önem, katılım, performans veya yorumlama değerini aktar; tanımı neden önemli cevabına dönüştürme.",
    "pragmaticAction WHY_SIGNIFICANCE ise yalnız işlev veya önem slotlarını ve varsa kontrollü kanıt sınırını yaz; daha önceki tanımı yeniden anlatma.",
    "pragmaticAction DEEPEN ise yalnız planda seçilmiş yeni içeriği yaz; evidence_limitation dışında eski açıklamayı özetleyerek tekrar etme.",
    "presentationModifiers SIMPLIFY içeriyorsa baseAction ve aynı semantik payloadı koruyarak yalnız daha kolay ve doğal Türkçe üret: hiçbir claimi çıkarma veya ekleme; kesinliği, popülasyon ve kaynak sınırını değiştirme.",
    "SIMPLIFY sırasında yalnız eş anlamlı sözcük değişimi yapma. Uzun cümleyi böl, yan tümce yükünü azalt ve daha doğrudan bir cümle yapısı kur; final metin kaynak metinden daha karmaşık olmasın.",
    "Kaynakta geçiyorsa şu ana terimleri aynen koru: self-regülasyon, interosepsiyon, arousal, reaktivite, toparlanma, yürütücü işlev, okupasyon. Özellikle self-regülasyon terimini öz-düzenleme olarak değiştirme.",
    "discourseConstraints preserve_order içeriyorsa slot sırasını hiçbir nedenle değiştirme; do_not_repeat içeriyorsa slotlar arasında aynı bilgiyi yineleme.",
    "Karşılaştırmada iki hedefi tek claim havuzunda eritme: comparison_side slotları yalnız kendi hedefini açıklar; comparison_conclusion slotundaki graded-policy ile üretilmiş kontrollü metni aynen kullan.",
    "comparison_conclusion slotunun controlledText metnini aynen kullan ve usedClaimIds alanına yalnız o slotun lockedClaims kimliklerini yaz.",
    "evidence_limitation slotu varsa controlledText metnini hiçbir sözcüğünü değiştirmeden aynen yaz ve usedClaimIds alanını boş dizi yap. Bu slotta yeni açıklama veya bilimsel iddia ekleme.",
    "Kullanıcıya görünen text alanlarında iç sistem terminolojisi kullanma: doğrulanmış kapsam, mevcut doğrulanmış içerik, kilitli içerik, locked claim, claim, facet, system.facet-boundary, catalog, katalog, topicId, requiredClaim, support claim veya evidence status yazma.",
    repairFailureCodes.includes("unsupported_relation_addition")
      ? "Önceki aday kilitlenmemiş bir ilişki kurdu. Repair sırasında ilişki bağlacını kaldır ve claimleri nötr, ayrı cümlelerle yaz."
      : "",
    repairFailureCodes.includes("SIMPLIFY_NOT_TRANSFORMED")
      ? "Önceki sadeleştirme kaynak cümleye fazla yakındı. Bilimsel anlamı koruyarak cümle yapısını ve sözcük seçimini gündelik Türkçeyle belirgin biçimde yeniden kur."
      : "",
    repairFailureCodes.some((code) => ["SIMPLIFY_NOT_ACTUALLY_SIMPLIFIED", "SIMPLIFY_COMPLEXITY_INCREASED"].includes(code))
      ? "Önceki aday gerçekten kolaylaşmadı. Claimleri eksiltmeden cümleleri kısalt veya böl, yan tümce ve jargon yükünü azalt; yalnız eş anlamlı sözcük değiştirmekle yetinme."
      : "",
    repairFailureCodes.includes("SIMPLIFY_LANGUAGE_FAILURE")
      ? "Önceki adayın Türkçe yüzeyi bozuktu. Aynı içeriği tekrarsız, dilbilgisel ve doğal bir cümleyle yeniden yaz."
      : "",
    repairFailureCodes.includes("SIMPLIFY_TERMINOLOGY_DRIFT")
      ? "Önceki aday ana terimi değiştirdi. Kaynakta geçen korumalı terimi harf dizimiyle aynen geri koy."
      : "",
    repairFailureCodes.includes("SIMPLIFY_MAIN_MEANING_NOT_ENTAILED")
      ? "Önceki aday ana anlamın bir bölümünü kaybetti. Bütün locked claimlerin ana bilgisini daha kolay cümlelerle eksiksiz aktar."
      : "",
    repairFailureCodes.length ? `Önceki aday şu kapılarda başarısız oldu: ${repairFailureCodes.join(", ")}. Yalnız bu hataları düzelt.` : "",
  ].filter(Boolean).join(" ")
}

export function dnaS13StrictContent(question: string, plan: DnaS13StrictPlan, previousCandidate?: unknown) {
  return JSON.stringify({
    question,
    responseDepth: plan.responseDepth,
    pragmaticTask: plan.pragmaticTaskFrame ? {
      targetResolution: plan.pragmaticTaskFrame.targetResolution,
      pragmaticAction: plan.pragmaticTaskFrame.pragmaticAction,
      requestedFacets: plan.pragmaticTaskFrame.requestedFacets,
      discourseConstraints: plan.pragmaticTaskFrame.discourseConstraints,
    } : null,
    slots: plan.slots.map((slot) => ({
      slotId: slot.id,
      slotKind: slot.kind,
      subquestion: slot.question,
      targetLabel: slot.lockedClaims[0]?.claim.title ?? null,
      focus: slot.focus,
      questionType: slot.questionType,
      requestedFacet: slot.requestedFacet ?? null,
      controlledText: slot.controlledText,
      comparisonConclusionMode: slot.comparisonConclusionMode ?? null,
      relationContracts: slot.relationContracts ?? [],
      lockedClaims: slot.lockedClaims.map((entry) => ({
        claimId: entry.claim.id,
        role: entry.role,
        title: entry.claim.title ?? null,
        text: entry.claim.text,
      })),
    })),
    previousCandidate: previousCandidate ?? null,
  })
}
