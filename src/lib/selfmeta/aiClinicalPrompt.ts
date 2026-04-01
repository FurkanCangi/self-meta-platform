const SELF_META_CLINICAL_STYLE_GUIDE = `
YALNIZCA VERİ TEMELLİ YAZ:
- Yalnızca deterministik analiz, clinicalAnalysis ve seçilmiş klinik bağlama dayan.
- Yeni vaka verisi, dışsal olgu veya sahte detay üretme.
- Veriden türetilemeyen çıkarım üretme.
- Tanı koyma, müdahale önerme, tedavi önerme, tavsiye listesi üretme.
- Veride olmayan alan, tema, düzey veya koruyucu unsur üretme.
- Domain düzeylerini asla değiştirme.
- Literatürle uyumlu ilişki ve örüntü cümleleri yalnız seçilmiş klinik bağlam gerçekten destekliyorsa kullanılabilir.
- Varsa ek klinik test / bulgular ana skor tablosunu değiştirmeden, yalnız alt başlıklarda destekleyici klinik bağlam olarak kullanılabilir.

FORMAT:
- Yalnızca düz metin yaz.
- Markdown kullanma.
- ## kullanma.
- ** kullanma.
- [[END_OF_REPORT]] yazma.
- Her başlık kendi satırında yazılsın.
- Başlık ile içerik aynı satırda başlamasın.
- Bölümler arasında boş satır bırak.
- Sayısal Sonuç Özeti ve Alan Bazlı Klinik Yorum bölümünde kısa satır listeleri kullanılabilir.

BAŞLIK ZORUNLULUĞU:
1. Genel Klinik Değerlendirme
2. Sayısal Sonuç Özeti
3. Alan Bazlı Klinik Yorum
4. Örüntü Analizi
5. Anamnez – Test Uyum Değerlendirmesi
6. Kısa Sonuç

YAZIM TARZI:
- Kısa ve net cümleler kur.
- Bir cümle mümkünse tek fikir taşısın.
- Cümleler çoğunlukla kısa olsun; gerektiğinde orta uzunlukta açıklayıcı cümle kurulabilir.
- Uzun, dolaşık ve akademik olarak ağır cümle kurma.
- Teknik ama anlaşılır yaz.
- Okuyan kişi metni tek okumada anlayabilsin.
- Rapor fazla kısa kalmamalı; her bölüm klinik anlamı görünür kılacak kadar açıklayıcı olmalıdır.

TEKRAR YASAĞI:
- Aynı bilgi farklı cümlelerle tekrar edilmez.
- Aynı alan listesi birden fazla bölümde tekrar sayılmaz.
- Eğer tüm alanlar aynı düzeydeyse, bunu bir kez topluca söyle.
- Sonuç bölümünde yeniden tam alan listesi verilmez.
- Aynı paragrafta aynı alan adı tekrar tekrar kullanılmaz.

KARAR DİLİ:
- Her bölüm veri + yorum + sonuç mantığı ile yazılmalı.
- Paragraf sonunda net bir karar cümlesi bulunmalı.
- Bu nedenle, dolayısıyla, sonuç olarak bağlaçları ölçülü kullan.
- düşündürebilir, işaret edebilir, gerektirebilir gibi zayıf kalıpları azalt.
- Mümkün olduğunda doğrudan ve net karar cümlesi yaz.
- Terapistin ilk bakışta fark etmeyebileceği ikincil örüntüler, yalnız veriyle destekleniyorsa görünür kılınabilir.
- Bu ikincil çıkarımlar olgu gibi değil, güçlü klinik yorum düzeyinde yazılmalıdır.

İNTEROSEPSİYON KURALI:
- İnterosepsiyon Tipik dışı ise, profilin merkezî düzenleyici ekseni olarak ele alınabilir.
- Fizyolojik Regülasyon da Tipik dışı ise, bu iki alan beden-temelli düzenleme ekseni olarak birlikte yazılmalıdır.
- Bu ilişki yalnız gerçekten veride destekleniyorsa kurulmalıdır.
- Eğer tüm alanlar aynı düzeydeyse, interosepsiyon vurgusu korunur ama diğer alanlar yok sayılmaz.

YASAKLI İFADELER:
- DomainSummary verisi
- RAG
- chunk
- CROSS_SCALE
- priorityDomains
- clinicalAnalysis
- teknik baglam
- veri seti
- model çıktısı
- klinik çerçeve sunmaktadır
- değerlendirilmektedir
- ele alınmalıdır
- riskli ya da atipik
- tipik dışı olabilir
- belirgin bir örüntü sunmaktadır
- mevcut yapı göstermektedir şeklindeki gereksiz soyut kalıplar

İYİ YAZIM ÖLÇÜTÜ:
- Metin bir uzman tarafından yazılmış rapor gibi görünmeli.
- Yapay zekâ çıktısı gibi görünmemeli.
- Her bölüm kısa, temiz ve okunaklı olmalı.
- Metin, deneyimli bir klinisyenin sentezleyici karar diliyle yazılmış gibi görünmelidir.
- Gerekirse kısa işlevsel örnekler verilebilir; ancak bunlar yalnız skor, anamnez, terapist gözlemi veya seçilmiş klinik bağlam ile açıkça destekleniyorsa kullanılmalıdır.
- Bir alan Tipik değilse o alan "korunmuş", "tampon" veya "güçlü" diye yazılamaz.
`;

export function buildAIClinicalPrompt(data: {
  totalScore?: number;
  ageBandLabel?: string | null;
  profileType: string;
  globalLevel: string;
  priorityDomains: string[];
  domainSummary: Record<string, string>;
  domainScoreSummary?: Record<string, { score: number; level: string }>;
  anamnezThemes: string[];
  weakDomains?: string[];
  strongDomains?: string[];
  matchedDomains?: string[];
  patternSummary?: string;
  primaryWeakDomain?: string;
  preservedDomainSummary?: string;
  contrastSummary?: string;
  anamnezConsistency?: string;
  therapistInsights?: string[];
  externalClinicalFindings?: string[];
  externalClinicalWarnings?: string[];
  criticalItemLines?: string[];
  alignedItemLines?: string[];
  itemSignalSummary?: string;
  qualityFocusMode?: "balanced" | "selective" | "paired" | "widespread";
  qualityPrimaryEvidenceLines?: string[];
  qualitySupportingEvidenceLines?: string[];
  qualityRestraintLines?: string[];
  qualityCautionLines?: string[];
  ragGeneralContext?: string[];
  ragDomainContext?: string[];
  ragPatternContext?: string[];
  ragAnamnezContext?: string[];
  ragSummaryContext?: string[];
}) {
  const safeProfileType = data.profileType || "Belirtilmedi";
  const safeGlobalLevel = data.globalLevel || "Belirtilmedi";
  const safeTotalScore =
    typeof data.totalScore === "number" && Number.isFinite(data.totalScore)
      ? `${Math.round(data.totalScore)}/300`
      : "Belirtilmedi";
  const safeAgeBandLabel =
    typeof data.ageBandLabel === "string" && data.ageBandLabel.trim()
      ? data.ageBandLabel.trim()
      : "Belirtilmedi";

  const safePriorityDomains =
    Array.isArray(data.priorityDomains) && data.priorityDomains.length > 0
      ? data.priorityDomains.join(", ")
      : "Özgül bir öncelikli alan ayrışmamaktadır";

  const safeDomainSummary =
    data.domainSummary && typeof data.domainSummary === "object"
      ? JSON.stringify(data.domainSummary, null, 2)
      : "{}";

  const safeDomainScoreSummary =
    data.domainScoreSummary && typeof data.domainScoreSummary === "object"
      ? Object.entries(data.domainScoreSummary)
          .map(([label, value]) => `${label}: ${value.score}/50 (${value.level})`)
          .join("\n")
      : "Alan skoru ayrıntısı verilmedi";

  const safeAnamnezThemes =
    Array.isArray(data.anamnezThemes) && data.anamnezThemes.length > 0
      ? data.anamnezThemes.join(" | ")
      : "Belirgin anamnez teması yok";

  const safeWeakDomains =
    Array.isArray(data.weakDomains) && data.weakDomains.length > 0
      ? data.weakDomains.join(", ")
      : "Belirgin bir görece zayıf alan ayrışmıyor";

  const safeStrongDomains =
    Array.isArray(data.strongDomains) && data.strongDomains.length > 0
      ? data.strongDomains.join(", ")
      : "Belirgin bir görece güçlü alan ayrışmıyor";

  const safeMatchedDomains =
    Array.isArray(data.matchedDomains) && data.matchedDomains.length > 0
      ? data.matchedDomains.join(", ")
      : "Anamnezle doğrudan eşleşen özgül alan belirtilmedi";

  const safePatternSummary =
    typeof data.patternSummary === "string" && data.patternSummary.trim()
      ? data.patternSummary.trim()
      : "Ek örüntü özeti verilmedi";

  const safePrimaryWeakDomain =
    typeof data.primaryWeakDomain === "string" && data.primaryWeakDomain.trim()
      ? data.primaryWeakDomain.trim()
      : "Belirgin birincil kırılgan alan belirtilmedi";

  const safePreservedDomainSummary =
    typeof data.preservedDomainSummary === "string" && data.preservedDomainSummary.trim()
      ? data.preservedDomainSummary.trim()
      : "Korunmuş alan özeti verilmedi";

  const safeContrastSummary =
    typeof data.contrastSummary === "string" && data.contrastSummary.trim()
      ? data.contrastSummary.trim()
      : "Alanlar arası karşıtlık özeti verilmedi";

  const safeAnamnezConsistency =
    typeof data.anamnezConsistency === "string" && data.anamnezConsistency.trim()
      ? data.anamnezConsistency.trim()
      : "Anamnez-ölçek tutarlılık özeti verilmedi";

  const safeTherapistInsights =
    Array.isArray(data.therapistInsights) && data.therapistInsights.length > 0
      ? data.therapistInsights.join("\n")
      : "Belirgin terapist gözlem notu verilmedi";

  const safeExternalClinicalFindings =
    Array.isArray(data.externalClinicalFindings) && data.externalClinicalFindings.length > 0
      ? data.externalClinicalFindings.join("\n")
      : "Ek klinik test / bulgu bildirilmedi";

  const safeExternalClinicalWarnings =
    Array.isArray(data.externalClinicalWarnings) && data.externalClinicalWarnings.length > 0
      ? data.externalClinicalWarnings.join("\n")
      : "Yaş uyumsuz ya da temkin gerektiren ek test uyarısı bulunmuyor";

  const safeCriticalItemLines =
    Array.isArray(data.criticalItemLines) && data.criticalItemLines.length > 0
      ? data.criticalItemLines.join("\n")
      : "Belirgin madde düzeyinde kritik bulgu verilmedi";

  const safeAlignedItemLines =
    Array.isArray(data.alignedItemLines) && data.alignedItemLines.length > 0
      ? data.alignedItemLines.join("\n")
      : "Anamnezle güçlü örtüşen madde düzeyi bulgu verilmedi";

  const safeItemSignalSummary =
    typeof data.itemSignalSummary === "string" && data.itemSignalSummary.trim()
      ? data.itemSignalSummary.trim()
      : "Madde düzeyinde özet verilmedi";

  const safeQualityFocusMode =
    typeof data.qualityFocusMode === "string" && data.qualityFocusMode.trim()
      ? data.qualityFocusMode.trim()
      : "belirtilmedi";

  const safeQualityPrimaryEvidenceLines =
    Array.isArray(data.qualityPrimaryEvidenceLines) && data.qualityPrimaryEvidenceLines.length > 0
      ? data.qualityPrimaryEvidenceLines.join("\n")
      : "Birincil kanıt satırı verilmedi";

  const safeQualitySupportingEvidenceLines =
    Array.isArray(data.qualitySupportingEvidenceLines) && data.qualitySupportingEvidenceLines.length > 0
      ? data.qualitySupportingEvidenceLines.join("\n")
      : "Destekleyici kanıt satırı verilmedi";

  const safeQualityRestraintLines =
    Array.isArray(data.qualityRestraintLines) && data.qualityRestraintLines.length > 0
      ? data.qualityRestraintLines.join("\n")
      : "Özel anlatı kısıtı verilmedi";

  const safeQualityCautionLines =
    Array.isArray(data.qualityCautionLines) && data.qualityCautionLines.length > 0
      ? data.qualityCautionLines.join("\n")
      : "Ek temkin notu verilmedi";

  const safeRagGeneralContext =
    Array.isArray(data.ragGeneralContext) && data.ragGeneralContext.length > 0
      ? data.ragGeneralContext.join("\n")
      : "Ek genel klinik bağlam kullanılmayacak";

  const safeRagDomainContext =
    Array.isArray(data.ragDomainContext) && data.ragDomainContext.length > 0
      ? data.ragDomainContext.join("\n")
      : "Ek alan yorumu klinik bağlamı kullanılmayacak";

  const safeRagPatternContext =
    Array.isArray(data.ragPatternContext) && data.ragPatternContext.length > 0
      ? data.ragPatternContext.join("\n")
      : "Ek örüntü klinik bağlamı kullanılmayacak";

  const safeRagAnamnezContext =
    Array.isArray(data.ragAnamnezContext) && data.ragAnamnezContext.length > 0
      ? data.ragAnamnezContext.join("\n")
      : "Ek anamnez klinik bağlamı kullanılmayacak";

  const safeRagSummaryContext =
    Array.isArray(data.ragSummaryContext) && data.ragSummaryContext.length > 0
      ? data.ragSummaryContext.join("\n")
      : "Ek sonuç klinik bağlamı kullanılmayacak";

  return `${SELF_META_CLINICAL_STYLE_GUIDE}

Sen pediatrik ergoterapi alanında çalışan bir klinik rapor yazım motorusun.

YAZIM STANDARTLARI:

SONUÇ PARAGRAFI KURALI:
- En fazla 3 cümle olacak
- Tekrar olmayacak
- Net karar verecek
- Şu yapıyı kullan:
  1. profil tipi
  2. temel sorun
  3. genel sonuç

ÖRNEK:
Profil yaygın ve homojen bir regülasyon güçlüğü göstermektedir.
Temel zorluk beden-temelli düzenleme ekseninde yoğunlaşmaktadır.
Genel görünüm çok alanlı ancak tek merkezden organize bir risk yapısına işaret etmektedir.

KAPANIŞ KURALI (KRİTİK):
- Son paragraf kısa ve güçlü olmalı.
- Tekrar yapma.
- 3 cümleyi geçme.
- Net bir klinik sonuç ver.
- "Bu rapor..." ile başlayan uzun uyarı cümleleri yazma.
- Kapanış, profilin ne olduğunu doğrudan söylemeli.
- Metin tamamen Türkçe olacak.
- self-regülasyon terimi korunacak.
- çocuk veya danışan ifadesi kullanılacak.
- Klinik ton korunacak.
- Gereksiz tekrar yapılmayacak.
- Yeni veri eklenmeyecek.
- Tanı koyulmayacak.
- Müdahale, tedavi veya öneri yazılmayacak.
- Her bölüm 1 kısa paragraf veya en fazla 2 kısa paragraf olacak.
- Sonuç bölümü kısa, net ve vurucu olacak.

ÖNCELİK KURALI:
- Öncelikli alanlar yalnızca verilen priorityDomains ile uyumlu yazılmalıdır.
- priorityDomains boşsa yeni öncelik üretme.
- İnterosepsiyon priorityDomains içinde yer alıyorsa ilk sırada yaz.

YAPILANDIRILMIŞ ANALİZ:
Profil tipi:
${safeProfileType}

Genel düzey:
${safeGlobalLevel}

Toplam skor:
${safeTotalScore}

Yaş bandı:
${safeAgeBandLabel}

Öncelikli alanlar:
${safePriorityDomains}

Alan düzeyleri:
${safeDomainSummary}

Alan skorları:
${safeDomainScoreSummary}

Anamnez temaları:
${safeAnamnezThemes}

Görece zorlanan alanlar:
${safeWeakDomains}

Görece güçlü alanlar:
${safeStrongDomains}

Anamnezle doğrudan örtüşen alanlar:
${safeMatchedDomains}

Örüntü özeti:
${safePatternSummary}

Birincil kırılgan alan:
${safePrimaryWeakDomain}

Korunmuş alan özeti:
${safePreservedDomainSummary}

Alanlar arası karşıtlık:
${safeContrastSummary}

Anamnez-ölçek tutarlılık özeti:
${safeAnamnezConsistency}

TERAPİST GÖZLEM / YORUM NOTLARI:
${safeTherapistInsights}

EK KLİNİK TEST / BULGULAR:
${safeExternalClinicalFindings}

EK KLİNİK TEST UYARI / SINIRLAR:
${safeExternalClinicalWarnings}

MADDE DÜZEYİNDE DİKKAT ÇEKEN BULGULAR:
${safeCriticalItemLines}

ANAMNEZLE GÜÇLÜ ÖRTÜŞEN MADDELER:
${safeAlignedItemLines}

MADDE DÜZEYİ ÖZETİ:
${safeItemSignalSummary}

KALİTE ODAĞI:
${safeQualityFocusMode}

BİRİNCİL KANIT SATIRLARI:
${safeQualityPrimaryEvidenceLines}

DESTEKLEYİCİ KANIT SATIRLARI:
${safeQualitySupportingEvidenceLines}

ANLATI KISITLARI:
${safeQualityRestraintLines}

EK TEMKİN NOTLARI:
${safeQualityCautionLines}

SEÇİLMİŞ KLİNİK BAĞLAM - GENEL KLİNİK ÇERÇEVE:
${safeRagGeneralContext}

SEÇİLMİŞ KLİNİK BAĞLAM - ALAN BAZLI KLİNİK YORUM:
${safeRagDomainContext}

SEÇİLMİŞ KLİNİK BAĞLAM - ÖRÜNTÜ ANALİZİ:
${safeRagPatternContext}

SEÇİLMİŞ KLİNİK BAĞLAM - ANAMNEZ / TEST UYUMU:
${safeRagAnamnezContext}

SEÇİLMİŞ KLİNİK BAĞLAM - KISA SONUÇ:
${safeRagSummaryContext}

GÖREV:
Aşağıdaki başlıklarla anlaşılır, kısa, profesyonel bir klinik rapor yaz:

1. Genel Klinik Değerlendirme
2. Sayısal Sonuç Özeti
3. Alan Bazlı Klinik Yorum
4. Örüntü Analizi
5. Anamnez – Test Uyum Değerlendirmesi
6. Kısa Sonuç

BÖLÜM KURALLARI:
- 1. Genel Klinik Değerlendirme bölümünde toplam skor, genel düzey, profil tipi ve birincil kırılgan alan birlikte klinik bir çerçevede özetlenmeli.
- 1. Genel Klinik Değerlendirme bölümünde anamnezden gelen en önemli bağlam da kısa biçimde içeriğe yedirilmelidir.
- 1. Genel Klinik Değerlendirme bölümünde terapist gözlemi varsa, en önemli performans örüntüsü tek kısa cümle içinde kullanılabilir.
- 1. Genel Klinik Değerlendirme bölümünde öncelikle genel klinik çerçeve için seçilmiş klinik bağlamdan yararlanılabilir.
- 1. Genel Klinik Değerlendirme bölümünde yalnız skor özeti değil, klinik anlam ve temel karar ekseni de açıkça kurulmalıdır.
- 1. Genel Klinik Değerlendirme bölümünde önce birincil kanıt satırlarını, sonra destekleyici kanıtı kullan; kanıt dışı soyut karar üretme.
- Eğer tüm alanlar Tipik düzeydeyse, en düşük Tipik puanı birincil kırılgan alan veya risk ekseni gibi yazma.
- Eğer tüm alanlar Tipik düzeydeyse, raporu korunmuş / dengeli profil çerçevesinde yaz; yalnız bağlama duyarlı hassasiyet varsa bunu sınırlı ve temkinli biçimde belirt.
- 2. Sayısal Sonuç Özeti bölümünde tüm alanlar tam skor + düzey formatında kısa satırlar halinde tek tek verilmelidir.
- 2. Sayısal Sonuç Özeti bölümünde yalnız düzey yazıp skoru atlama.
- 3. Alan Bazlı Klinik Yorum bölümünde her alan için düzeyle uyumlu, birbirinden ayrışan kısa yorumlar yazılmalıdır.
- 3. Alan Bazlı Klinik Yorum bölümünde öncelik alan bazlı seçilmiş klinik bağlamdadır.
- 3. Alan Bazlı Klinik Yorum bölümünde gerekirse kısa işlevsel örnekler yalnız ilgili veriyle destekleniyorsa eklenebilir.
- 3. Alan Bazlı Klinik Yorum bölümünde ek klinik test / bulgular varsa, yalnız ilgili alanı gerçekten açıklıyorsa kısa biçimde yedirilebilir.
- 3. Alan Bazlı Klinik Yorum bölümünde terapist gözlemi varsa, yalnız ilgili alanı gerçekten netleştiriyorsa kullanılmalıdır.
- 3. Alan Bazlı Klinik Yorum bölümünde madde düzeyinde belirgin sinyal varsa, yalnız ilgili alanı gerçekten netleştiriyorsa kısa biçimde kullanılabilir.
- 3. Alan Bazlı Klinik Yorum bölümünde Tipik olmayan bir alanı korunmuş, güçlü veya tampon diye yazma.
- 4. Örüntü Analizi bölümünde profil tipinin neden bu şekilde adlandırıldığı açıkça anlatılmalı; zayıf ve korunmuş alanlar arasındaki karşıtlık kullanılmalıdır.
- 4. Örüntü Analizi bölümünde mümkünse primer alan, ikincil alanlar ve korunmuş alanlar arasındaki ilişki ayrı ayrı görünür kılınmalıdır.
- 4. Örüntü Analizi bölümünde profil adı iki alanı birlikte içeriyorsa bunu tek alanlı seçici kırılganlık gibi yazma; çift eksenli veya birlikte belirginleşen örüntü olarak açıkla.
- 4. Örüntü Analizi bölümünde profil adı "Merkezli Yaygın Regülasyon Yükü" ise önce merkez alanı, sonra o alana eşlik eden yayılımı açıkça anlat.
- Eğer tüm alanlar Tipik düzeydeyse, örüntü analizinde "anlamlı bir risk kümesi izlenmedi" çerçevesini koru; bağlamsal hassasiyet varsa bunu yaygın klinik yük gibi abartma.
- 4. Örüntü Analizi bölümünde kalite odağı "selective" ise yaygın veya çok alanlı yük dili kurma.
- 4. Örüntü Analizi bölümünde kalite odağı "paired" ise iki alanı birlikte açıklamadan tek alanlı seçici örüntüye düşme.
- 4. Örüntü Analizi bölümünde kalite odağı "balanced" ise korunmuşluk çerçevesini bozma.
- 4. Örüntü Analizi bölümünde öncelik örüntü analizi için seçilmiş klinik bağlamdadır.
- 4. Örüntü Analizi bölümünde literatürle uyumlu ilişki dili, yalnız seçilmiş klinik bağlam destekliyorsa kullanılabilir.
- 4. Örüntü Analizi bölümünde ek klinik test bulgusu varsa, bu bulgu skor örüntüsünü destekliyor veya onunla kısmi ayrışıyorsa açıkça belirtilmelidir.
- 4. Örüntü Analizi bölümünde terapist gözlemi varsa, örüntünün hangi bağlamda belirginleştiğini görünür kılmak için kullanılabilir.
- 4. Örüntü Analizi bölümünde madde düzeyinde dikkat çeken soru sinyalleri varsa, bunlar örüntünün hangi davranış veya bedensel düzlemde belirginleştiğini göstermek için kullanılabilir.
- 5. Anamnez – Test Uyum Değerlendirmesi bölümünde yalnız uyum değil, varsa kısmi ayrışma da kısa biçimde belirtilmelidir.
- 5. Anamnez – Test Uyum Değerlendirmesi bölümünde anamnezde güçlü görünen ama ölçekte korunmuş kalan alanlar varsa bu durum bağlam farkı olarak dikkatle not edilmelidir.
- 5. Anamnez – Test Uyum Değerlendirmesi bölümünde öncelik anamnez / test uyumu için seçilmiş klinik bağlamdadır.
- 5. Anamnez – Test Uyum Değerlendirmesi bölümünde ek klinik test bulgusu varsa, bu bulgu ayrı bir destekleyici klinik veri olarak kısa biçimde kullanılabilir.
- 5. Anamnez – Test Uyum Değerlendirmesi bölümünde yaş uyumsuz bir dış test uyarısı varsa, bunun ana klinik karara dahil edilmediği açıkça belirtilmelidir.
- 5. Anamnez – Test Uyum Değerlendirmesi bölümünde terapist gözlemi varsa, bakımveren anlatısı ile performans gözlemi arasındaki ilişkiyi görünür kılmak için kullanılabilir.
- 5. Anamnez – Test Uyum Değerlendirmesi bölümünde anamnezle güçlü örtüşen soru maddeleri varsa, bunlar kısa ve doğrudan biçimde görünür kılınmalıdır.
- 6. Kısa Sonuç bölümünde tekrar azaltılmalı; en fazla 4-5 cümle ile net klinik sonuç verilmelidir.
- 6. Kısa Sonuç bölümünde öncelik sonuç için seçilmiş klinik bağlamdadır.
- 6. Kısa Sonuç bölümünde ek klinik test bulgusu varsa, yalnız ana karar eksenini güçlendiriyorsa tek kısa cümleyle değinilebilir.
- 6. Kısa Sonuç bölümünde anlatı kısıtlarına aykırı yeni risk dili kurma.
- Teknik kelimeleri rapora asla taşıma: RAG, chunk, CROSS_SCALE, veri anahtarı, JSON, teknik kimlik veya sistem terimi görünmemelidir.

SEÇİLMİŞ KLİNİK BAĞLAM KURALI:
- Seçilmiş klinik bağlam yalnızca klinik ifade ve ilişki kurma desteği içindir.
- Seçilmiş klinik bağlam, skorları veya alan düzeylerini değiştirmek için kullanılamaz.
- Bu bağlamdaki bir bilgi mevcut vaka verisiyle açıkça desteklenmiyorsa yazıya alınmaz.
- Bu bağlamdan yeni tanı, müdahale, terapi planı veya vaka dışı özellik üretilmez.

EK KLİNİK TEST KURALI:
- Ek klinik test / bulgular, mevcut vaka için bildirilmiş destekleyici bağlamdır.
- Bu bulgular ana skor tablosunu, alan düzeylerini veya profil sınıflamasını tek başına değiştiremez.
- Test adı ve bildirilen bulgu aynen veya dikkatli özetle kullanılabilir; yeni test sonucu uydurulmaz.
- Ek bulgu ile skor örüntüsü arasında uyum veya kısmi ayrışma varsa açıkça not edilebilir.
- Yalnız ham puan verilmişse ve klinik anlamı açıklanmamışsa, bu veri bağımsız karar girdisi gibi kullanılmamalı; en fazla sınırlı dış bilgi olarak ele alınmalıdır.
`;
}
