# Çoklu Vaka Deterministic Test Raporu

Tarih: 2026-06-16

Amaç: Deterministic rapor motorunun birbirinden farklı 5 vaka ailesinde klinik karar dili, mekanizma tutarlılığı ve bölüm kalitesini birlikte değerlendirmek.

## Test Kapsamı

Bu testte aşağıdaki 5 fixture deterministic hatta çalıştırıldı:

1. `scripts/fixtures/selfmeta-new-01-balanced-routine-strength.json`
2. `scripts/fixtures/selfmeta-new-03-sensory-emotional-overload.json`
3. `scripts/fixtures/selfmeta-new-05-physiological-interoceptive-fatigue.json`
4. `scripts/fixtures/selfmeta-new-06-somatodyspraxia-motor-planning.json`
5. `scripts/fixtures/selfmeta-language-pragmatic-load.json`

Tüm koşularda teknik durum aynıdır:

- `AI Kullanildi: Hayir`
- `Fallback: Hayir`
- `Final deterministic: %100`
- `Final AI: %0`
- `Final RAG: %0`

## Vaka Özeti

| Vaka | Profil | Genel Sonuç | Kalite Kararı |
|---|---|---|---|
| `selfmeta-new-01-balanced-routine-strength` | Dengeli / Korunmuş Profil | Korunmuş profil dili var, fakat formülasyon yanlış mekanizmaya kayıyor | Zayıf |
| `selfmeta-new-03-sensory-emotional-overload` | Duyusal-Duygusal Regülasyon Profili | Klinik eksen doğru, fakat formülasyon hâlâ skor cümlesine fazla yaslanıyor | Orta |
| `selfmeta-new-05-physiological-interoceptive-fatigue` | Fizyolojik Toparlanma ve Beden Temelli Regülasyon Yükü | Mekanizma dili güçlü ve tutarlı | Güçlü |
| `selfmeta-new-06-somatodyspraxia-motor-planning` | Praksi ve Motor Planlama ile İlişkili Regülasyon Yükü | Motor/praksi hattı net, karar ve formülasyon profesör formatına yakın | Güçlü |
| `selfmeta-language-pragmatic-load` | Dilsel ve Sosyal-Pragmatik Talep Altında Regülasyon Yükü | Birleşik mekanizma açık, dış test bağlamı iyi entegre | Güçlü |

## İyi Sonuçlar

### 1. Mekanizma temelli yazım artık birçok vaka ailesinde gerçekten çalışıyor

En iyi performans `motor_praxis`, `physiological_interoceptive` ve `language_social_pragmatic` vakalarında görüldü.

Bu üç vakada:

- karar cümlesi skor özetinden değil mekanizmadan kuruluyor
- formülasyon bölümü birincil klinik mekanizmayı taşıyor
- önceliklendirme bölümü ikincil yayılım alanlarını doğru ayırıyor
- rapor tanı veya tedavi hükmüne kaymıyor

### 2. Dış test entegrasyonu daha klinik hale gelmiş

Özellikle şu iki vaka güçlü:

- `selfmeta-new-06-somatodyspraxia-motor-planning`
- `selfmeta-language-pragmatic-load`

Bu raporlarda dış testler yalnız liste olarak geçmiyor; motor planlama ya da dilsel-sosyal yükü açıklayan bağlamsal kanıt olarak kullanılıyor.

### 3. Teknik hat yok

Seçilen 5 vakanın tamamında:

- deterministic üretim temiz çalıştı
- fallback olmadı
- section yapısı korundu
- canlı AI/RAG katkısı sıfır kaldı

## Kötü veya Zayıf Sonuçlar

### 1. Korunmuş profilde formülasyon yanlış mekanizmaya kayıyor

En önemli kalite sorunu `selfmeta-new-01-balanced-routine-strength` vakasında görüldü.

Sorun:

- `1. Klinik Karar Özeti` korunmuş profili doğru okuyor
- fakat `4. Klinik Örüntü ve Formülasyon` ve `6. Klinik Önceliklendirme Notu` içinde formülasyon cümlesi adaptive-daily-living mekanizmasına kayıyor

Görülen sorunlu davranış:

- korunmuş profilde ana formülasyon yine de
  `Öz bakım ve günlük yaşam akışını başlatma...`
  hattına sapıyor

Bu, preserved/balanced profil için mekanizma seçimi ya da mekanizma formülasyon fallback mantığında artık ayrı bir bug kaldığını gösteriyor.

Karar:

- Bu vaka şu an profesör seviyesi kaliteyi karşılamıyor.

### 2. Duyusal-duygusal vakada formülasyon hâlâ skor-merkezli

`selfmeta-new-03-sensory-emotional-overload` vakasında ana klinik eksen doğru seçiliyor. Ancak `6. Klinik Önceliklendirme Notu` içindeki formülasyon şu yapıya dönüyor:

- `skor örüntüsü ile vaka içi kanıt birlikte okunduğunda...`
- ardından doğrudan en düşük alan cümlesi kullanılıyor

Bu artık önceki sürümlerden iyi olsa da hâlâ istenen seviyede değil.

Beklenen:

- duyusal yük + duygusal toparlanma ilişkisi üzerinden tam mekanizma cümlesi

Mevcut:

- en düşük skor bilgisini ana formülasyon taşıyor

Karar:

- Bu vaka kabul edilebilir ama henüz güçlü değil.

### 3. Bazı bölümlerde tekrar hâlâ yüksek

Özellikle güçlü vakalarda bile şu tekrar yapısı sürüyor:

- `1. Klinik Karar Özeti`
- `6. Klinik Önceliklendirme Notu`

Bu iki bölümde aynı hipotez ve aynı formülasyon cümlesi çok benzer biçimde yeniden yazılıyor.

Bu kaliteyi bozmuyor ama raporu biraz uzun ve döngüsel hissettiriyor.

## Vaka Bazlı Değerlendirme

### A. `selfmeta-new-01-balanced-routine-strength`

İyi:

- Korunmuş profil dili doğru açılıyor
- gereksiz patolojikleştirme yok
- sonuç bölümü dengeli

Kötü:

- formülasyon preserved profile uymuyor
- yanlışlıkla adaptive günlük yaşam mekanizmasına sapıyor
- bu yüzden iç tutarlılık bozuluyor

Nihai karar: `Zayıf`

### B. `selfmeta-new-03-sensory-emotional-overload`

İyi:

- duyusal ana eksen doğru seçiliyor
- duygusal ve interoseptif yayılım mantıklı
- dış test bağlamı destekleyici

Kötü:

- ana formülasyonun bir kısmı hâlâ lowest-score odaklı
- conclusion dili genel kalıyor, mekanizma kadar keskin değil

Nihai karar: `Orta`

### C. `selfmeta-new-05-physiological-interoceptive-fatigue`

İyi:

- beden-temelli toparlanma mekanizması çok net
- interosepsiyon/fizyolojik çift ekseni iyi taşınıyor
- karar, formülasyon ve sonuç aynı klinik hatta kalıyor

Kötü:

- bölüm tekrarları biraz yüksek

Nihai karar: `Güçlü`

### D. `selfmeta-new-06-somatodyspraxia-motor-planning`

İyi:

- motor/praksi hattı en olgun vaka
- dış test entegrasyonu güçlü
- skor değil mekanizma merkezde
- önceliklendirme net

Kötü:

- tekrar hâlâ var ama klinik kaliteyi bozmuyor

Nihai karar: `Güçlü`

### E. `selfmeta-language-pragmatic-load`

İyi:

- birleşik dilsel + sosyal-pragmatik mekanizma açık
- bilişsel/duygusal/yürütücü yayılım doğru kuruluyor
- karar ve sonuç birbirini destekliyor

Kötü:

- tekrar var
- terapist gözlemi çok kısa olduğunda önceliklendirme bölümü biraz kuru kalabiliyor

Nihai karar: `Güçlü`

## Genel Sonuç

Bu 5 vaka testine göre deterministic motorun son durumu şöyle okunmalı:

- `3/5` vaka güçlü
- `1/5` vaka orta
- `1/5` vaka zayıf

En güçlü profil aileleri:

1. motor / praksi
2. fizyolojik / interoseptif
3. dilsel + sosyal-pragmatik birleşik mekanizma

Henüz zayıf kalan alanlar:

1. korunmuş / balanced profil formülasyonu
2. default ya da non-mechanism duyusal-duygusal vakalarda skor-merkezli formülasyon kalıntısı
3. karar özeti ile önceliklendirme arasındaki tekrar yoğunluğu

## Çıktı Dosyaları

- [Balanced Report](/tmp/selfmeta-report-output/selfmeta-new-01-balanced-routine-strength/final-report.md)
- [Sensory Emotional Report](/tmp/selfmeta-report-output/selfmeta-new-03-sensory-emotional-overload/final-report.md)
- [Physiological Interoceptive Report](/tmp/selfmeta-report-output/selfmeta-new-05-physiological-interoceptive-fatigue/final-report.md)
- [Motor Praxis Report](/tmp/selfmeta-report-output/selfmeta-new-06-somatodyspraxia-motor-planning/final-report.md)
- [Language Social Report](/tmp/selfmeta-report-output/selfmeta-language-pragmatic-load/final-report.md)
