# DNA Intelligence V3 kapsam matrisi

Sürüm: `dna-coverage-map@1`
Tarih: 2026-07-19

Bu harita bir yayın veya bilimsel geçerlik listesi değildir. On bilim alanını on dört boyutta çaprazlayarak tam **140 benzersiz hücre** oluşturur. Her hücre; güvenli soru ailelerini, yaş kapsamını, iddia sınırını, aday kaynak kimliklerini ve otomatik test kimliğini taşır.

## Kontrollü durumlar

| Durum | Hücre | Anlamı |
|---|---:|---|
| `release_ready` | 0 | Yalnız yaşam döngüsünde hem iddiası hem kaynağı `released` olan hücre kullanılabilir. Başlangıçta böyle bir V3 çifti yoktur. |
| `bounded_partial` | 120 | Aday kaynak vardır; çok geçişli V3 denetimi ve release kaydı yoktur. Yalnız kapsam sınırı gösterilebilir (`boundary_only`); canlı bilimsel iddiayı destekleyemez. |
| `not_available` | 10 | Bilinmeyenler boyutunda tamamlanmış kontrollü kanıt yoktur; sistem bunu açıkça belirtmelidir. |
| `prohibited` | 10 | Genel bilimden DNA geçerliği, DNA alanı veya vaka biyolojik mekanizması çıkarma yasaktır. Yalnız sınır açıklanabilir. |

## On kanonik bilim alanı

1. Hücresel nörofizyoloji
2. Merkezi sinir sistemi ve ağlar
3. Otonom sinir sistemi ve HRV
4. Stres, uyarılma, reaktivite ve toparlanma
5. İnterosepsiyon ve duyusal süreçler
6. Duygusal düzenleme, öz-düzenleme ve eş-regülasyon
7. Dikkat, çalışma belleği ve yürütücü işlevler
8. Uyku ve sirkadiyen süreçler
9. Gelişim ve nörogelişimsel farklılıklar
10. Ölçüm, vaka yorumu ve klinik sınırlar

Her alan şu on dört boyuta ayrılır: tanım, anatomi, işlev, gelişim, ölçüm, kanıt düzeyi, tartışmalı teoriler, yaş kapsamı, tipik gelişim, nörogelişimsel farklılıklar, DNA ile ilişki, vaka yorum sınırları, yanlış bilinenler ve bilinmeyenler.

## Release kapısı

`candidateSourceIds` yalnız taranacak adayları gösterir. Kaynak varlığı, eski katalogdaki `sourceVerified` alanı veya bir DOI tek başına V3 yayın yetkisi vermez. `release_ready` için hücrede hem `releaseEvidence.claimIds` hem `releaseEvidence.sourceIds` bulunmalı ve bunların yaşam döngüsü kayıtları gerçekten `released` olmalıdır. DNA kitabı gelene kadar DNA ürün tanımları bu matrisle yayınlanmaz.

Makinece okunabilir kanonik matris `src/lib/dna/chat/governance/coverageMap.ts`, sabit özet sözleşmesi ise `coverage-gap-contract.json` dosyasındadır.
