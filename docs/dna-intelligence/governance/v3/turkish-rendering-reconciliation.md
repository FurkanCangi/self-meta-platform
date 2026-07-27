# Türkçe bilimsel aktarım uzlaştırması

Bu kapı, nötr seçim sözleşmesindeki aynı 42 İngilizce önerme ve pasaj için
üretilen A ile hizalanmış B Türkçe aktarımlarını kaynaklarına yeniden bağlayarak
karara bağlar. Karar verici her kayıtta kaynak önerme ve pasajını yeniden okur;
yaş/kanıt sınırı, nedensellik, ihtiyat dili, olumsuzlama, sayılar, ek klinik
sonuç, örnek, mekanizma, tanı ve tedavi eklemelerini ayrı ayrı kontrol eder.

## Sonuç

- Kapsam: 14 konu, 42 kayıt.
- Sonlandırılan: 42; karantinaya alınan: 0.
- Karar dağılımı: 2 birebir aynı, 22 anlamsal olarak eşdeğer, 13 A tercih,
  5 B tercih.
- Uzlaştırma artifact SHA-256:
  `f0230a06c46fee5de353fb460abbfaadc49b486cea7dca9aea1315c91efa9427`
- Ham dosya SHA-256:
  `8a0eaf400ba0c42036fd87b177a2a4a347d9993088b3a01972d10b60bd1efe3e`
- Karar artifact SHA-256:
  `9d277e2b174fd36de466dd5fc7850af36c674e8411be022d08f330d97ce4fa1f`
- Aynı sabit girdilerle 20 çalıştırma tek artifact hash'i üretmiştir.

İngilizce kaynak metinleri, A/B aktarımları, seçilen nihai aktarım ve kayıt
düzeyi kararlar yalnız ResearchSSD üzerindeki `0600` dosyalarda tutulur. Repo
manifesti yalnız hash, sayı, dağılım ve yetki sınırlarını taşır.

## Fail-closed kuralları

- Nötr seçim, candidate paket, kaynak, claim ve pasaj kimliği ile hash'leri
  birebir eşleşmeden çıktı üretilemez.
- Nihai metin yalnız A veya B'den byte düzeyinde kopyalanabilir; üçüncü bir
  aktarım üretilemez.
- Seçilen taraf kaynak-sadık olarak işaretlenmemişse kayıt yayımlanamaz.
- Çözülemeyen kayıt `contested_quarantined` olur ve nihai metni `null` kalır.
- Bilinmeyen alan, bozuk öz-hash, eksik karar, tekrar kimlik, sembolik bağlantı,
  dosya izin hatası veya yol kaçışı koşuyu durdurur.
- Kilitli holdout, geliştirme adaptörü ve değerlendirme sonuçları bu çalışma
  sırasında okunmaz.

## Yetki sınırı

Bu çıktı bağımsız insan çeviri/klinik uzman doğrulaması değildir. Yalnız
`external_science_candidate` hazırlığıdır; `runtimeEligible`,
`releaseEligible`, `activationAllowed`, adapter ve owner-book yetkileri kapalı
kalır. DNA kitabı onayı veya V3 canlıya alma kararı vermez; canlı V2 motorunu
değiştirmez.

Doğrulama komutu:

```bash
npm run chat:turkish-rendering-reconciliation:verify:ssd
```
