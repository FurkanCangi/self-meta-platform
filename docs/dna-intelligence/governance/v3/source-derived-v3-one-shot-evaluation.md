# Source-Derived V3 Blind One-Shot Evaluation

Bu akış yalnız `turkish-retrieval-v3-source-derived` geliştirme adapteri içindir.
V1/V2 claim, result, harness veya holdout otoritelerini kullanmaz ve değiştirmez.
Sonuç bağımsız insan doğrulaması değildir; runtime, release veya aktivasyon
yetkisi vermez.

## Pre-open overlap kapısı

Kilitli holdout performans koşusundan önce ayrı bütünlük rolü şu aileleri
karşılaştırır:

- 42 tuning sorusu
- 42 development family-holdout sorusu
- 93 metamorphic soru
- 196 bağımsız V3 blind holdout sorusu

Exact, Türkçe normalize edilmiş exact, token edit-distance tabanlı
near-duplicate ve semantic-family eşleşmelerinin tamamı sıfır olmalıdır.
Hesap 20 kez yinelenir ve tek aggregate hash zorunludur. Bütünlük rolü holdout
payloadını bu kontrol için okur; soru metni, soru kimliği veya failure sample
makbuza, repo manifestine ya da komut çıktısına yazılmaz.

Makbuz ResearchSSD üzerinde atomik ve `0600` izinlidir. Adapter, working/frozen
adapter byte'ları, candidate package, family bank, development report, freeze
manifest, iki repo evidence manifesti ve ilgili kaynak kodlarının byte hashleri
makbuza bağlanır. Repo yalnız aggregate manifest taşır.

24 Temmuz 2026 sonucu: exact `0`, normalized `0`, near-duplicate `0`,
semantic-family `0`; 20 tekrarda tek aggregate hash. Makbuz SHA-256:
`46e2c7cfbb6f97b4d40fde7a69710923d00711d031fe8edcb8a3c47ea06e3dbf`.

## Resmî tek-koşu sınırı

Harness pre-open makbuzunu ve bütün adapter/core/development/freeze/candidate/
holdout/code byte hashlerini payload açılmadan doğrular. Ardından claim dosyası
`O_EXCL | O_NOFOLLOW` ve `0600` ile yazılıp `fsync` edilir. Holdout yalnız claim
kalıcı olduktan sonra açılır. Sonraki herhangi bir hata claim'i korur ve yeniden
koşu yasaktır.

Parent/leaf symlink, path escape, yanlış mod, local fallback, hash drift,
evaluator output, input mutation ve async sonuç fail-closed reddedilir. Adapter
ve holdout deep-freeze edilir. Her soru 20 kez çalıştırılır; tek prediction hash
zorunludur.

Sonuç yalnız aggregate overall, category split, intent grubu, topic,
clarification, abstention, safe-theory routing/non-refusal, p95 ve determinism
metriklerini taşır. Soru/failure metni veya kimliği içermez. Düşük kalite sonucu
silinmez; kalite kapısı `fail` olarak kaydedilir.

Hedefler: overall, natural, hard-neighbor, ambiguous ve safe-theory en az
`0.95`; unsupported `1.00`; safe-theory non-refusal en az `0.98`; p95 `<25 ms`.

## Komutlar

```bash
npm run chat:locked-evaluation-v3:preopen:test:ssd
npm run chat:locked-evaluation-v3:preopen:write:ssd
npm run chat:locked-evaluation-v3:preopen:verify:ssd
npm run chat:locked-evaluation-v3:test:ssd
npm run chat:locked-evaluation-v3:result:test:ssd

# Tek-seferlik resmî koşu 24 Temmuz 2026 tarihinde tüketildi; tekrar çalıştırılamaz.
npm run chat:locked-evaluation-v3:official:ssd

# Yalnız resmî sonuç mevcut olduktan sonra.
npm run chat:locked-evaluation-v3:result:build:ssd
npm run chat:locked-evaluation-v3:result:verify:ssd
```

## Tüketilmiş resmî V3 sonucu

Resmî ilk koşu yeniden çalıştırılmadan kaydedildi ve kalite kapısı `fail` oldu.
Genel doğruluk `0.346939`; doğal destekli sorular `0.410714`, zor komşular
`0.285714`, belirsiz sorular `0.261905`, desteklenmeyen sorular `0.535714` ve
güvenli teori yönlendirmesi `0.25` olarak ölçüldü. Safety non-refusal
`0.642857` ile hedefin altında kaldı. Determinizm 20 tekrarda tek hash ve p95
`9.432667 ms` olarak geçti; bu iki sonuç düşük yönlendirme doğruluğunu telafi
etmez.

Aggregate kanıt
`docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-locked-evaluation-v3-current.json`
dosyasındadır. Soru metni ve başarısız öğe kimliği repoya alınmadı. Bu holdout
tüketilmiştir; sonucu kullanarak adapter tuning veya yeniden koşu yapılamaz.
Runtime, release ve activation false; V3 kararı `NO-GO` kalır.
