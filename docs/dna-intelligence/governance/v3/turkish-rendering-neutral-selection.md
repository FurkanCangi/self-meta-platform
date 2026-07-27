# Türkçe Rendering Nötr Seçim Otoritesi

Bu fizibilite bileşeni, iki bağımsız Türkçe rendering geçişinin aynı 42 örneği işlemesini sağlar. Önceki A ve B artefaktları değiştirilmez.

## Neden gerekli?

İlk karşılaştırma iki geçişin 14 konu ve 42 kayıt içermesine rağmen yalnız 29 claim/passage seçiminde kesiştiğini gösterdi. A'ya özgü 13 ve B'ye özgü 13 seçim bulundu. Bu nedenle içerik uzlaştırması fail-closed durduruldu; hiçbir rendering final seçilmedi.

Nötr sözleşme, kanonik candidate package'e karşı doğrulanmış 42 seçim kimliğini mühürler. Her seçim yalnız slot, konu, kaynak, claim ve passage kimlikleri ile candidate claim/passage hash'lerini taşır. Kaynak cümlesi, claim önermesi, önceki Türkçe rendering, soru veya cevap metni taşımaz. Böylece sonraki bağımsız geçiş hangi örnekleri işleyeceğini bilir fakat önceki çeviriyi göremez.

## Güvenlik ve otorite sınırı

- Tam sözleşme yalnız ResearchSSD'de `0600` modunda tutulur.
- Repo manifesti yalnız aggregate sayılar ve hash'ler taşır.
- Parent/leaf symlink, path escape, mode ve byte/hash tamper fail-closed davranır.
- Aynı girdiler 20 üretimde tek hash vermelidir.
- Provenance `codex_multi_pass_candidate_identity_audit` olarak kaydedilir; bağımsız insan incelemesi değildir.
- Runtime, release, activation, adapter, owner-book ve reconciliation otoritesi vermez.
- Locked holdout, adapter, evaluator ve development değerlendirme yüzeyleri bu akışta kullanılmaz.

## Komutlar

```bash
npm run chat:turkish-rendering-neutral-selection:test:ssd
npm run chat:turkish-rendering-neutral-selection:write:ssd
npm run chat:turkish-rendering-neutral-selection:verify:ssd
```

Yeni bağımsız rendering geçişi bu sözleşmedeki 42 kimliği kullandıktan ve selection-set hash'i birebir eşleştikten sonra uzlaştırma yeniden başlatılabilir.
