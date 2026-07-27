# Dış bilim Türkçe tam-kapsam kör çalışma paketleri

Bu kapı, daha önce uzlaştırılan 42 fizibilite kaydına dokunmadan kalan 178 dış-bilim
iddiası için iki ayrı, boş yazar çalışma paketi hazırlar. Paketler çeviri değildir;
yalnız ileride yürütülecek A ve B geçişlerinin kaynak girdileridir.

## Kapsam ve körlük

- Aday paketteki 220 iddianın 42'si mevcut uzlaştırma seçim kümesine bağlı olarak
  korunur; A ve B paketlerinin her biri kalan 178 iddiayı tam birer kez taşır.
- Her öğe konu, kaynak, pasaj, iddia ve cevap-birimi kimlikleri ile bunların kanonik
  hash bağlarını taşır.
- Konular geçişe özgü deterministik bir sıralamayla round-robin dağıtılır.
- A ve B paketleri farklı çalışma öğesi kimlikleri ve farklı sıralar kullanır.
- Paketlerde Türkçe çıktı, uzlaştırma kararı veya diğer geçişin çıktı yolu/hash'i
  bulunmaz.
- Tam iddia ve pasaj metni yalnız ResearchSSD üzerindeki `0600` dosyalardadır.
  Repository manifesti yalnız sayım, sınır ve hash özetleri içerir.

## Çalıştırma

```bash
node scripts/dna-external-science-turkish-full-coverage-workpacks.mjs write
node scripts/dna-external-science-turkish-full-coverage-workpacks.mjs verify
node scripts/run-dna-external-science-turkish-full-coverage-workpacks-tests.mjs
```

Üretici yerel diske sessiz geri dönüşü, yaprak/ebeveyn sembolik bağlantılarını,
dosya modu sapmasını, aday/selection/manifest hash sapmasını, eksik veya yinelenen
kapsamı ve repository metin sızıntısını reddeder.

## Yetki sınırı

Bu hazırlık `runtimeEligible=false`, `releaseEligible=false` ve
`activationAllowed=false` kalır. Çeviri, uzlaştırma, bağımsız insan incelemesi,
owner onayı veya V3 aktivasyonu gerçekleştirmez. Canlı varsayılan V2'dir; V3 kararı
değişmeden `NO-GO` kalır.
