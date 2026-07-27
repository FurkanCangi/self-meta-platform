# Dış bilim Türkçe Pass A — kalan 178 kayıt

Bu geçiş, tam-kapsam Pass A çalışma paketindeki 178 iddia/cevap biriminin Türkçe
kaynak-sadık aktarımını mühürler. Önceki 42 kayıt bu artefakta alınmaz ve
değiştirilmez.

## Körlük ve kaynak sınırı

- Geçiş yalnız Pass A çalışma paketini ve bu paketteki claim/passage bağlarını okur.
- Pass B çıktısı ve uzlaştırma metni/kararı girdi değildir.
- Her Türkçe aktarım tek claim ve tek passage sınırında kalır; yeni mekanizma,
  klinik çıkarım veya DNA ürün geçerliği eklemez.
- Yaş, kanıt, nedensellik ve claim-boundary alanları kayıt başına hash ile bağlanır.
- Tam kaynak ve Türkçe metin yalnız ResearchSSD üzerindeki `0600` dosyalardadır.
  Repository manifesti kimlik veya metin içermez.

## Doğrulama

```bash
node scripts/dna-external-science-turkish-pass-a-remaining-authoring.mjs write
node scripts/dna-external-science-turkish-pass-a-remaining-authoring.mjs verify
node scripts/run-dna-external-science-turkish-pass-a-remaining-authoring-tests.mjs
```

Kapı; 178/178 tam kapsamı, exact kayıt şeklini, workpack/candidate/source/passage/
claim/answer-unit hashlerini, sayı-negasyon-ihtiyat-nedensellik sinyallerini, 20
tekrarda deterministikliği, dosya modunu, symlink ve local-fallback reddini ve repo
metin-sızıntısı yasağını denetler.

## Yetki sınırı

Artefaktın durumu `pass_a_remaining_178_candidate_only` değeridir.
`runtimeEligible`, `releaseEligible`, `activationAllowed`, `ownerAuthority` ve
`independentHumanReview` alanlarının tamamı `false` kalır. Bu çıktı Pass B,
uzlaştırma, owner onayı veya V3 aktivasyonu yerine geçmez.
