# Türkçe bilimsel aktarım — hizalanmış B geçişi

Bu geçiş, ilk A ve B çeviri denemelerinin farklı claim/pasaj kümeleri seçmesi
nedeniyle oluşturuldu. Nötr seçim otoritesi 14 konudan toplam 42 claim ve
pasajı yalnız kimlik ve hash düzeyinde mühürler. Hizalanmış B geçişi aynı 42
kaydı A metinlerini okumadan Türkçeye aktarır.

## Kanıt zinciri

- Nötr seçim kümesi SHA-256:
  `19dbb3434f72d023c79fb321781c1be8be43d7376033320d99a36f7f25f910a3`
- Hizalanmış B artifact SHA-256:
  `372167730f13acc6fd05420f7f5650dcf678c0f91a23c1718f0230c9911ff86a`
- Ham dosya SHA-256:
  `51a34817651983910c67482af7ebdfd2ecd057455edcdd1ebfd78d062d1fff06`
- Kapsam: 14 konu, 14 kaynak, 42 claim/pasaj ve 42/42 otomatik sadakat
  kontrolü.
- Üretim 20 kez yinelendi ve tek artifact hash'i verdi.

İngilizce önerme, Türkçe aktarım ve karar notları yalnız ResearchSSD üzerinde
`0600` dosyalarda tutulur. Repo manifesti metin taşımaz.

## Sınır

Bu çalışma bir Codex çoklu geçişidir; bağımsız insan çeviri doğrulaması veya
klinik uzman onayı değildir. Sonuç `candidate_only` kalır ve runtime, release,
activation, adapter, owner-book ya da V3 yayınlama yetkisi vermez. A ve
hizalanmış B çıktıları ayrıca bağımsız uzlaştırma kapısından geçmeden cevap
birimi olarak kullanılamaz.
